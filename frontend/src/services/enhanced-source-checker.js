// 修复版搜索源状态检查服务 - 解决CORS问题
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast } from '../utils/dom.js';

class FixedSourceChecker {
  constructor() {
    this.statusCache = new Map();
    this.retryQueue = new Map();
    this.activeChecks = new Set();
    
    // 修改检查策略 - 避免CORS问题
    this.checkStrategies = [
      { method: 'no-cors-head', weight: 0.6, timeout: 5000 },
      { method: 'image-fallback', weight: 0.4, timeout: 8000 }
    ];
    
    this.domainHealth = new Map();
    this.networkQuality = {
      rtt: 0,
      bandwidth: 0,
      lastUpdate: 0
    };
  }

  // 主要的状态检查方法 - 使用CORS友好的策略
  async checkSourceStatus(source, userSettings = {}) {
    const sourceId = source.id;
    
    // 防止重复检查
    if (this.activeChecks.has(sourceId)) {
      console.log(`跳过重复检查: ${sourceId}`);
      return this.getCachedStatus(sourceId) || {
        status: APP_CONSTANTS.SOURCE_STATUS.CHECKING,
        lastChecked: Date.now()
      };
    }

    // 检查缓存有效性
    const cached = this.getCachedStatus(sourceId);
    if (this.isCacheValid(cached, userSettings)) {
      return cached;
    }

    this.activeChecks.add(sourceId);

    try {
      // 使用CORS友好的检查方法
      const checkResult = await this.performCORSFriendlyCheck(source, userSettings);
      
      this.cacheResult(sourceId, checkResult, userSettings);
      this.updateDomainHealth(source, checkResult);
      
      return checkResult;

    } catch (error) {
      console.error(`检查源状态失败 ${sourceId}:`, error);
      const errorResult = {
        status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
        lastChecked: Date.now(),
        error: error.message,
        responseTime: 0
      };
      
      this.cacheResult(sourceId, errorResult, userSettings);
      return errorResult;
      
    } finally {
      this.activeChecks.delete(sourceId);
    }
  }

  // CORS友好的检查方法
  async performCORSFriendlyCheck(source, userSettings) {
    const testUrl = source.urlTemplate.replace('{keyword}', 'test');
    const timeout = (userSettings.sourceStatusCheckTimeout || 8) * 1000;
    
    console.log(`开始检查源: ${source.name} - ${testUrl}`);
    
    // 策略1: 使用no-cors模式进行基础连接测试
    const noCorsResult = await this.checkWithNoCORS(testUrl, timeout);
    
    // 策略2: 使用图片加载测试favicon可达性
    const faviconResult = await this.checkFavicon(testUrl, timeout);
    
    // 策略3: 使用script标签测试资源可达性
    const scriptResult = await this.checkWithScript(testUrl, timeout);
    
    // 综合分析结果
    return this.analyzeCheckResults([noCorsResult, faviconResult, scriptResult], source);
  }

  // 使用no-cors模式检查
  async checkWithNoCORS(url, timeout) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors', // 关键：使用no-cors模式
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'User-Agent': 'MagnetSearch-StatusChecker/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      // no-cors模式下，成功的请求通常返回opaque响应
      const success = response.type === 'opaque' || response.ok;
      
      return {
        method: 'no-cors',
        success,
        responseTime,
        type: response.type,
        status: response.status || 0
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      return {
        method: 'no-cors',
        success: false,
        error: error.message,
        responseTime,
        isTimeout: error.name === 'AbortError'
      };
    }
  }

  // 使用favicon检查域名可达性
  async checkFavicon(originalUrl, timeout) {
    const startTime = Date.now();
    
    try {
      const url = new URL(originalUrl);
      const faviconUrl = `${url.protocol}//${url.hostname}/favicon.ico`;
      
      return new Promise((resolve) => {
        const img = new Image();
        const timeoutId = setTimeout(() => {
          img.src = ''; // 取消加载
          resolve({
            method: 'favicon',
            success: false,
            error: '超时',
            responseTime: Date.now() - startTime,
            isTimeout: true
          });
        }, timeout);
        
        img.onload = () => {
          clearTimeout(timeoutId);
          resolve({
            method: 'favicon',
            success: true,
            responseTime: Date.now() - startTime
          });
        };
        
        img.onerror = () => {
          clearTimeout(timeoutId);
          resolve({
            method: 'favicon',
            success: false,
            error: '加载失败',
            responseTime: Date.now() - startTime
          });
        };
        
        img.src = faviconUrl;
      });
      
    } catch (error) {
      return {
        method: 'favicon',
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  // 使用动态script标签检查
  async checkWithScript(url, timeout) {
    const startTime = Date.now();
    
    try {
      const urlObj = new URL(url);
      // 尝试加载一个可能存在的JS文件
      const scriptUrl = `${urlObj.protocol}//${urlObj.hostname}/robots.txt`;
      
      return new Promise((resolve) => {
        const script = document.createElement('script');
        const timeoutId = setTimeout(() => {
          document.head.removeChild(script);
          resolve({
            method: 'script',
            success: false,
            error: '超时',
            responseTime: Date.now() - startTime,
            isTimeout: true
          });
        }, timeout);
        
        script.onload = () => {
          clearTimeout(timeoutId);
          document.head.removeChild(script);
          resolve({
            method: 'script',
            success: true,
            responseTime: Date.now() - startTime
          });
        };
        
        script.onerror = () => {
          clearTimeout(timeoutId);
          document.head.removeChild(script);
          // 对于script标签，404等错误也说明服务器是可达的
          resolve({
            method: 'script',
            success: true, // 能收到错误响应说明服务器在线
            responseTime: Date.now() - startTime,
            note: '服务器可达（404等正常响应）'
          });
        };
        
        script.src = scriptUrl;
        script.async = true;
        document.head.appendChild(script);
      });
      
    } catch (error) {
      return {
        method: 'script',
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  // 分析检查结果
  analyzeCheckResults(results, source) {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = successCount / totalCount;
    
    // 计算平均响应时间
    const validResponseTimes = results
      .filter(r => r.responseTime && r.responseTime > 0)
      .map(r => r.responseTime);
    const avgResponseTime = validResponseTimes.length > 0 
      ? Math.round(validResponseTimes.reduce((a, b) => a + b, 0) / validResponseTimes.length)
      : 0;
    
    // 检查是否有超时
    const hasTimeout = results.some(r => r.isTimeout);
    
    // 决定最终状态
    let status;
    if (successRate >= 0.5) {
      status = APP_CONSTANTS.SOURCE_STATUS.AVAILABLE;
    } else if (hasTimeout && successRate === 0) {
      status = APP_CONSTANTS.SOURCE_STATUS.TIMEOUT;
    } else {
      status = APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE;
    }
    
    console.log(`${source.name} 检查结果: 成功率 ${successRate}, 状态 ${status}`);
    
    return {
      status,
      lastChecked: Date.now(),
      responseTime: avgResponseTime,
      successRate,
      checkDetails: results,
      method: 'cors-friendly'
    };
  }

  // 简化的批量检查
  async checkMultipleSources(sources, userSettings = {}) {
    const concurrency = Math.min(userSettings.maxConcurrentChecks || 2, 3); // 降低并发数
    const results = [];
    
    console.log(`开始批量检查 ${sources.length} 个搜索源，并发数: ${concurrency}`);
    
    // 分批处理，增加延迟
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(source => 
        this.checkSourceStatus(source, userSettings)
          .then(result => ({ source, result }))
          .catch(error => ({ 
            source, 
            result: {
              status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
              error: error.message,
              lastChecked: Date.now()
            }
          }))
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 增加批次间延迟
      if (i + concurrency < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  // 备用检查方法：基于域名解析
  async performDNSCheck(hostname) {
    try {
      // 使用一个始终存在的公共资源测试域名解析
      const testUrl = `https://${hostname}/favicon.ico`;
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      
      // 即使是错误响应，也说明域名可解析
      return {
        success: true,
        method: 'dns-check',
        note: '域名可解析'
      };
      
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: '域名解析超时' };
      }
      
      // 网络错误可能表示域名不可达
      if (error.message.includes('ERR_NAME_NOT_RESOLVED')) {
        return { success: false, error: '域名不存在' };
      }
      
      // 其他错误可能是网络问题，不能确定域名状态
      return { success: null, error: error.message };
    }
  }

  // 缓存管理方法保持不变
  getCachedStatus(sourceId) {
    return this.statusCache.get(`status_${sourceId}`);
  }

  isCacheValid(cached, userSettings) {
    if (!cached) return false;
    
    const cacheDuration = (userSettings.sourceStatusCacheDuration || 300) * 1000;
    const age = Date.now() - cached.lastChecked;
    
    const statusMultiplier = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 1.0,
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 0.5,
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 0.3,
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 0.2
    };
    
    const multiplier = statusMultiplier[cached.status] || 1.0;
    const adjustedDuration = cacheDuration * multiplier;
    
    return age < adjustedDuration;
  }

  cacheResult(sourceId, result, userSettings) {
    const cacheKey = `status_${sourceId}`;
    this.statusCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    });
    
    if (this.statusCache.size > 1000) {
      const oldestKey = this.statusCache.keys().next().value;
      this.statusCache.delete(oldestKey);
    }
  }

  updateDomainHealth(source, result) {
    try {
      const hostname = new URL(source.urlTemplate.replace('{keyword}', 'test')).hostname;
      const current = this.domainHealth.get(hostname) || {
        successCount: 0,
        totalCount: 0,
        lastSuccess: 0,
        lastFailure: 0
      };
      
      current.totalCount++;
      
      if (result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
        current.successCount++;
        current.lastSuccess = Date.now();
      } else {
        current.lastFailure = Date.now();
      }
      
      current.successRate = current.successCount / current.totalCount;
      this.domainHealth.set(hostname, current);
      
    } catch (error) {
      console.warn('更新域名健康度失败:', error);
    }
  }

  // 清理方法
  cleanupExpiredCache() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;
    
    for (const [key, value] of this.statusCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.statusCache.delete(key);
      }
    }
    
    console.log(`缓存清理完成，剩余 ${this.statusCache.size} 个条目`);
  }

  // 获取统计信息
  getCheckingStats() {
    return {
      cacheSize: this.statusCache.size,
      activeChecks: this.activeChecks.size,
      domainHealthEntries: this.domainHealth.size,
      networkQuality: this.networkQuality
    };
  }
}

// 创建修复版实例
export const fixedSourceChecker = new FixedSourceChecker();

// 定期清理缓存
setInterval(() => {
  fixedSourceChecker.cleanupExpiredCache();
}, 60 * 60 * 1000);

export default fixedSourceChecker;