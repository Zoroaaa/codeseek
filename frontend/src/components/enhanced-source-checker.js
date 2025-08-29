// 增强版搜索源状态检查服务 - 提高准确性和可靠性
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast } from '../utils/dom.js';

class EnhancedSourceChecker {
  constructor() {
    this.statusCache = new Map();
    this.retryQueue = new Map();
    this.activeChecks = new Set();
    
    // 检查策略配置
    this.checkStrategies = [
      { method: 'HEAD', weight: 0.4, timeout: 5000 },
      { method: 'GET', weight: 0.6, timeout: 8000, maxBytes: 1024 }
    ];
    
    // 域名健康度缓存
    this.domainHealth = new Map();
    
    // 网络质量检测
    this.networkQuality = {
      rtt: 0,
      bandwidth: 0,
      lastUpdate: 0
    };
  }

  // 主要的状态检查方法 - 使用多策略验证
  async checkSourceStatus(source, userSettings = {}) {
    const sourceId = source.id;
    const cacheKey = `status_${sourceId}`;
    
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
      // 预检查：域名DNS解析和基础连通性
      const preCheckResult = await this.performPreCheck(source);
      if (!preCheckResult.success) {
        const result = {
          status: preCheckResult.status,
          lastChecked: Date.now(),
          error: preCheckResult.error,
          responseTime: preCheckResult.responseTime || 0
        };
        this.cacheResult(sourceId, result, userSettings);
        return result;
      }

      // 主检查：使用多种策略验证
      const mainCheckResult = await this.performMainCheck(source, userSettings);
      
      // 后验证：对可疑结果进行二次确认
      const finalResult = await this.performPostValidation(source, mainCheckResult, userSettings);
      
      this.cacheResult(sourceId, finalResult, userSettings);
      
      // 更新域名健康度
      this.updateDomainHealth(source, finalResult);
      
      return finalResult;

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

  // 预检查：DNS解析和基础连通性
  async performPreCheck(source) {
    try {
      const url = new URL(source.urlTemplate.replace('{keyword}', 'test'));
      const hostname = url.hostname;
      
      // 检查域名是否在黑名单中
      if (this.isHostnameBlacklisted(hostname)) {
        return {
          success: false,
          status: APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE,
          error: '域名在黑名单中'
        };
      }

      // DNS预解析检查（使用简单的连接测试）
      const dnsStart = Date.now();
      try {
        // 使用fetch进行快速DNS解析检查
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 3000);
        
        await fetch(`https://${hostname}/favicon.ico`, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors' // 避免CORS问题
        });
        
        const dnsTime = Date.now() - dnsStart;
        
        // DNS解析时间过长可能表示网络问题
        if (dnsTime > 2000) {
          console.warn(`${hostname} DNS解析较慢: ${dnsTime}ms`);
        }
        
        return { success: true, dnsTime };
        
      } catch (error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            status: APP_CONSTANTS.SOURCE_STATUS.TIMEOUT,
            error: 'DNS解析超时',
            responseTime: Date.now() - dnsStart
          };
        }
        
        // 网络错误通常意味着连接问题
        return {
          success: false,
          status: APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE,
          error: 'DNS解析失败',
          responseTime: Date.now() - dnsStart
        };
      }
      
    } catch (error) {
      return {
        success: false,
        status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
        error: `预检查失败: ${error.message}`
      };
    }
  }

  // 主检查：多策略验证
  async performMainCheck(source, userSettings) {
    const testUrl = source.urlTemplate.replace('{keyword}', 'test');
    const timeout = (userSettings.sourceStatusCheckTimeout || 8) * 1000;
    
    const results = [];
    
    // 并发执行多个检查策略
    const checkPromises = this.checkStrategies.map(strategy => 
      this.executeCheckStrategy(testUrl, strategy, timeout)
    );
    
    const strategyResults = await Promise.allSettled(checkPromises);
    
    // 分析结果并计算加权分数
    let totalWeight = 0;
    let availableWeight = 0;
    
    strategyResults.forEach((result, index) => {
      const strategy = this.checkStrategies[index];
      totalWeight += strategy.weight;
      
      if (result.status === 'fulfilled' && result.value.success) {
        availableWeight += strategy.weight;
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || '检查失败',
          strategy: strategy.method
        });
      }
    });
    
    // 计算可用性分数
    const availabilityScore = totalWeight > 0 ? availableWeight / totalWeight : 0;
    
    // 根据分数和结果模式确定最终状态
    const finalStatus = this.determineStatus(availabilityScore, results);
    
    return {
      status: finalStatus,
      lastChecked: Date.now(),
      availabilityScore,
      responseTime: this.calculateAverageResponseTime(results),
      checkDetails: results.map(r => ({
        success: r.success,
        responseTime: r.responseTime || 0,
        httpStatus: r.httpStatus,
        error: r.error
      }))
    };
  }

  // 执行单个检查策略
  async executeCheckStrategy(url, strategy, globalTimeout) {
    const startTime = Date.now();
    const timeout = Math.min(strategy.timeout, globalTimeout);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const options = {
        method: strategy.method,
        signal: controller.signal,
        headers: {
          'User-Agent': 'MagnetSearch-StatusChecker/1.0',
          'Accept': strategy.method === 'GET' ? 'text/html,*/*' : '*/*',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        mode: 'cors',
        credentials: 'omit'
      };
      
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;
      
      clearTimeout(timeoutId);
      
      // 对于GET请求，尝试读取部分内容以确认服务正常
      let contentCheck = true;
      if (strategy.method === 'GET' && response.ok) {
        contentCheck = await this.validateResponseContent(response, strategy.maxBytes || 1024);
      }
      
      const success = response.ok && contentCheck;
      
      return {
        success,
        httpStatus: response.status,
        statusText: response.statusText,
        responseTime,
        contentLength: response.headers.get('content-length'),
        contentType: response.headers.get('content-type'),
        server: response.headers.get('server'),
        strategy: strategy.method
      };
      
    } catch (error) {
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `${strategy.method}请求超时`,
          responseTime,
          strategy: strategy.method
        };
      }
      
      return {
        success: false,
        error: error.message,
        responseTime,
        strategy: strategy.method
      };
    }
  }

  // 验证响应内容
  async validateResponseContent(response, maxBytes) {
    try {
      const reader = response.body.getReader();
      let bytesRead = 0;
      let hasValidContent = false;
      
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        
        bytesRead += value.length;
        
        // 检查是否包含HTML标签或其他有效内容指示
        const chunk = new TextDecoder().decode(value);
        if (chunk.includes('<html') || chunk.includes('<HTML') || 
            chunk.includes('<body') || chunk.includes('<title')) {
          hasValidContent = true;
          break;
        }
      }
      
      reader.releaseLock();
      return hasValidContent || bytesRead > 100; // 如果有足够内容也认为有效
      
    } catch (error) {
      console.warn('内容验证失败:', error);
      return true; // 内容验证失败时不影响主要检查结果
    }
  }

  // 后验证：对可疑结果进行二次确认
  async performPostValidation(source, mainResult, userSettings) {
    // 如果主检查结果确信度很高，直接返回
    if (mainResult.availabilityScore >= 0.8 || mainResult.availabilityScore <= 0.2) {
      return mainResult;
    }
    
    // 对于不确定的结果，进行二次验证
    console.log(`对 ${source.name} 进行二次验证，分数: ${mainResult.availabilityScore}`);
    
    try {
      const testUrl = source.urlTemplate.replace('{keyword}', 'verification');
      const quickCheck = await this.executeCheckStrategy(testUrl, 
        { method: 'HEAD', timeout: 3000 }, 5000);
      
      if (quickCheck.success && mainResult.availabilityScore >= 0.4) {
        return {
          ...mainResult,
          status: APP_CONSTANTS.SOURCE_STATUS.AVAILABLE,
          verified: true
        };
      } else if (!quickCheck.success && mainResult.availabilityScore <= 0.6) {
        return {
          ...mainResult,
          status: APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE,
          verified: true
        };
      }
      
    } catch (error) {
      console.warn('二次验证失败:', error);
    }
    
    return mainResult;
  }

  // 根据分数和结果确定最终状态
  determineStatus(score, results) {
    if (score >= 0.7) {
      return APP_CONSTANTS.SOURCE_STATUS.AVAILABLE;
    } else if (score <= 0.3) {
      // 检查是否所有结果都是超时
      const allTimeout = results.every(r => 
        !r.success && (r.error?.includes('超时') || r.error?.includes('timeout'))
      );
      
      return allTimeout ? 
        APP_CONSTANTS.SOURCE_STATUS.TIMEOUT : 
        APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE;
    } else {
      // 中等分数时需要更仔细的判断
      const hasSuccessfulCheck = results.some(r => r.success);
      const hasTimeoutError = results.some(r => 
        r.error?.includes('超时') || r.error?.includes('timeout')
      );
      
      if (hasSuccessfulCheck) {
        return APP_CONSTANTS.SOURCE_STATUS.AVAILABLE;
      } else if (hasTimeoutError) {
        return APP_CONSTANTS.SOURCE_STATUS.TIMEOUT;
      } else {
        return APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE;
      }
    }
  }

  // 计算平均响应时间
  calculateAverageResponseTime(results) {
    const validResults = results.filter(r => r.responseTime && r.responseTime > 0);
    if (validResults.length === 0) return 0;
    
    const totalTime = validResults.reduce((sum, r) => sum + r.responseTime, 0);
    return Math.round(totalTime / validResults.length);
  }

  // 批量检查多个搜索源
  async checkMultipleSources(sources, userSettings = {}) {
    const concurrency = userSettings.maxConcurrentChecks || 3;
    const results = [];
    
    console.log(`开始批量检查 ${sources.length} 个搜索源，并发数: ${concurrency}`);
    
    // 分批处理
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
      
      // 批次间短暂延迟，避免过度请求
      if (i + concurrency < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return results;
  }

  // 缓存管理
  getCachedStatus(sourceId) {
    return this.statusCache.get(`status_${sourceId}`);
  }

  isCacheValid(cached, userSettings) {
    if (!cached) return false;
    
    const cacheDuration = (userSettings.sourceStatusCacheDuration || 300) * 1000;
    const age = Date.now() - cached.lastChecked;
    
    // 根据状态调整缓存有效期
    const statusMultiplier = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 1.0,
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 0.5, // 不可用状态缓存时间减半
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 0.3,     // 超时状态缓存时间更短
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 0.2        // 错误状态缓存时间最短
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
    
    // 限制缓存大小
    if (this.statusCache.size > 1000) {
      const oldestKey = this.statusCache.keys().next().value;
      this.statusCache.delete(oldestKey);
    }
  }

  // 域名健康度管理
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

  getDomainHealth(hostname) {
    return this.domainHealth.get(hostname) || {
      successRate: 0.5,
      successCount: 0,
      totalCount: 0
    };
  }

  // 黑名单检查
  isHostnameBlacklisted(hostname) {
    const blacklist = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '192.168.',
      '10.',
      '172.16.'
    ];
    
    return blacklist.some(blocked => hostname.includes(blocked));
  }

  // 网络质量自适应
  async detectNetworkQuality() {
    const start = Date.now();
    
    try {
      // 使用多个CDN端点测试网络质量
      const testEndpoints = [
        'https://www.google.com/favicon.ico',
        'https://www.cloudflare.com/favicon.ico',
        'https://cdn.jsdelivr.net/gh/jquery/jquery@3.6.0/dist/jquery.min.js'
      ];
      
      const promises = testEndpoints.map(url => 
        fetch(url, { method: 'HEAD', mode: 'no-cors' })
          .then(() => Date.now() - start)
          .catch(() => Infinity)
      );
      
      const results = await Promise.all(promises);
      const validResults = results.filter(time => time !== Infinity);
      
      if (validResults.length > 0) {
        this.networkQuality.rtt = Math.min(...validResults);
        this.networkQuality.lastUpdate = Date.now();
        
        // 根据网络质量调整检查策略
        this.adaptCheckStrategies();
      }
      
    } catch (error) {
      console.warn('网络质量检测失败:', error);
    }
  }

  adaptCheckStrategies() {
    const { rtt } = this.networkQuality;
    
    if (rtt > 2000) {
      // 网络较慢时，减少GET请求权重
      this.checkStrategies[0].weight = 0.7; // HEAD
      this.checkStrategies[1].weight = 0.3; // GET
    } else if (rtt < 500) {
      // 网络较快时，增加GET请求权重以获得更准确结果
      this.checkStrategies[0].weight = 0.3; // HEAD
      this.checkStrategies[1].weight = 0.7; // GET
    }
  }

  // 统计和监控
  getCheckingStats() {
    return {
      cacheSize: this.statusCache.size,
      activeChecks: this.activeChecks.size,
      domainHealthEntries: this.domainHealth.size,
      networkQuality: this.networkQuality
    };
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, value] of this.statusCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.statusCache.delete(key);
      }
    }
    
    console.log(`缓存清理完成，剩余 ${this.statusCache.size} 个条目`);
  }

  // 导出检查结果用于分析
  exportCheckResults() {
    const results = {
      cache: Array.from(this.statusCache.entries()),
      domainHealth: Array.from(this.domainHealth.entries()),
      networkQuality: this.networkQuality,
      timestamp: Date.now()
    };
    
    return JSON.stringify(results, null, 2);
  }
}

// 创建全局实例
export const enhancedSourceChecker = new EnhancedSourceChecker();

// 定期清理缓存
setInterval(() => {
  enhancedSourceChecker.cleanupExpiredCache();
}, 60 * 60 * 1000); // 每小时清理一次

// 定期检测网络质量
setInterval(() => {
  enhancedSourceChecker.detectNetworkQuality();
}, 5 * 60 * 1000); // 每5分钟检测一次

export default enhancedSourceChecker;