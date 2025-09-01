// 后端API调用版搜索源状态检查服务 - 解决CORS问题并实现内容匹配检查
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';

class backendSourceChecker {
  constructor() {
    this.statusCache = new Map();
    this.retryQueue = new Map();
    this.activeChecks = new Set();
    
    // 检查统计
    this.checkStats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      backendCalls: 0
    };
    
    // 本地缓存配置
    this.localCacheConfig = {
      maxSize: 1000,
      defaultTTL: 300000, // 5分钟
      statusMultipliers: {
        [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 1.0,
        [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 0.5,
        [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 0.3,
        [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 0.2
      }
    };
  }

  // 主要的状态检查方法 - 使用后端API
  async checkSourceStatus(source, userSettings = {}) {
    const sourceId = source.id;
    
    // 防止重复检查
    if (this.activeChecks.has(sourceId)) {
      console.log(`跳过重复检查: ${sourceId}`);
      const cached = this.getCachedStatus(sourceId);
      return cached || {
        status: APP_CONSTANTS.SOURCE_STATUS.CHECKING,
        lastChecked: Date.now(),
        fromCache: false
      };
    }

    // 检查本地缓存有效性
    const cached = this.getCachedStatus(sourceId);
    if (this.isCacheValid(cached, userSettings)) {
      console.log(`使用本地缓存: ${sourceId}`);
      this.checkStats.cacheHits++;
      return {
        ...cached,
        fromCache: true
      };
    }

    this.activeChecks.add(sourceId);

    try {
      // 调用后端API进行单个搜索源检查
      const keyword = this.generateTestKeyword();
      const result = await this.callBackendCheck([source], keyword, userSettings);
      
      if (result && result.results && result.results.length > 0) {
        const sourceResult = result.results[0];
        const processedResult = this.processBackendResult(sourceResult);
        
        this.cacheResult(sourceId, processedResult, userSettings);
        this.updateCheckStats('completed', [processedResult]);
        
        return {
          ...processedResult,
          fromCache: false
        };
      } else {
        throw new Error('后端API返回数据格式错误');
      }

    } catch (error) {
      console.error(`检查源状态失败 ${sourceId}:`, error);
      this.updateCheckStats('failed');
      
      const errorResult = {
        status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
        lastChecked: Date.now(),
        error: error.message,
        responseTime: 0,
        available: false,
        contentMatch: false
      };
      
      this.cacheResult(sourceId, errorResult, userSettings);
      return {
        ...errorResult,
        fromCache: false
      };
      
    } finally {
      this.activeChecks.delete(sourceId);
    }
  }

  // 批量检查多个搜索源状态
  async checkMultipleSources(sources, userSettings = {}, keyword = null) {
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      console.warn('搜索源列表为空');
      return [];
    }

    console.log(`开始批量检查 ${sources.length} 个搜索源状态`);
    this.updateCheckStats('started');
    
    try {
      // 生成测试关键词
      const testKeyword = keyword || this.generateTestKeyword();
      
      // 检查本地缓存，分离已缓存和需要检查的源
      const { cachedResults, uncachedSources } = this.separateCachedSources(sources, userSettings);
      
      console.log(`本地缓存命中: ${cachedResults.length}/${sources.length}, 需要后端检查: ${uncachedSources.length}`);
      
      let backendResults = [];
      
      // 如果有需要检查的源，调用后端API
      if (uncachedSources.length > 0) {
        try {
          const apiResponse = await this.callBackendCheck(uncachedSources, testKeyword, userSettings);
          
          if (apiResponse && apiResponse.results) {
            backendResults = apiResponse.results.map(result => this.processBackendResult(result));
            
            // 缓存后端返回的结果
            backendResults.forEach(result => {
              const source = uncachedSources.find(s => s.id === result.sourceId);
              if (source) {
                this.cacheResult(result.sourceId, result, userSettings);
              }
            });
            
            this.checkStats.backendCalls++;
          } else {
            console.error('后端API返回数据格式错误:', apiResponse);
          }
        } catch (error) {
          console.error('调用后端检查API失败:', error);
          
          // 为未检查的源生成错误结果
          backendResults = uncachedSources.map(source => ({
            sourceId: source.id,
            sourceName: source.name,
            status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
            available: false,
            contentMatch: false,
            responseTime: 0,
            lastChecked: Date.now(),
            error: error.message,
            fromCache: false
          }));
        }
      }
      
      // 合并缓存结果和后端结果
      const allResults = [...cachedResults, ...backendResults];
      
      // 构造返回格式，匹配原有接口
      const finalResults = sources.map(source => {
        const result = allResults.find(r => r.sourceId === source.id);
        return result ? { 
          source, 
          result: {
            ...result,
            verified: result.contentMatch || false,
            availabilityScore: this.calculateAvailabilityScore(result)
          }
        } : {
          source,
          result: {
            sourceId: source.id,
            sourceName: source.name,
            status: APP_CONSTANTS.SOURCE_STATUS.UNKNOWN,
            available: false,
            contentMatch: false,
            responseTime: 0,
            lastChecked: Date.now(),
            fromCache: false
          }
        };
      });
      
      this.updateCheckStats('completed', backendResults);
      
      console.log(`批量检查完成: ${finalResults.length} 个结果`);
      return finalResults;
      
    } catch (error) {
      console.error('批量检查搜索源状态失败:', error);
      this.updateCheckStats('failed');
      
      // 返回错误结果
      return sources.map(source => ({
        source,
        result: {
          sourceId: source.id,
          sourceName: source.name,
          status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
          available: false,
          contentMatch: false,
          responseTime: 0,
          lastChecked: Date.now(),
          error: error.message,
          fromCache: false
        }
      }));
    }
  }

  // 调用后端检查API
  async callBackendCheck(sources, keyword, userSettings = {}) {
    try {
      const options = {
        timeout: userSettings.sourceStatusCheckTimeout || 10000,
        checkContentMatch: true,
        maxConcurrency: 3
      };
      
      console.log(`调用后端API检查 ${sources.length} 个搜索源, 关键词: ${keyword}`);
      
      const response = await apiService.checkSourcesStatus(sources, keyword, options);
      
      if (!response.success) {
        throw new Error(response.message || '后端检查失败');
      }
      
      console.log(`后端检查完成: ${response.summary?.available || 0}/${response.summary?.total || 0} 可用`);
      
      return response;
      
    } catch (error) {
      console.error('调用后端检查API失败:', error);
      throw error;
    }
  }

  // 处理后端返回的结果
  processBackendResult(backendResult) {
    return {
      sourceId: backendResult.sourceId,
      sourceName: backendResult.sourceName,
      status: this.normalizeStatus(backendResult.status),
      available: Boolean(backendResult.available),
      contentMatch: Boolean(backendResult.contentMatch),
      responseTime: backendResult.responseTime || 0,
      qualityScore: backendResult.qualityScore || 0,
      httpStatus: backendResult.httpStatus,
      lastChecked: backendResult.lastChecked || Date.now(),
      matchDetails: backendResult.matchDetails || {},
      error: backendResult.error,
      fromCache: false
    };
  }

  // 标准化状态值
  normalizeStatus(status) {
    const statusMap = {
      'available': APP_CONSTANTS.SOURCE_STATUS.AVAILABLE,
      'unavailable': APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE,
      'timeout': APP_CONSTANTS.SOURCE_STATUS.TIMEOUT,
      'error': APP_CONSTANTS.SOURCE_STATUS.ERROR,
      'checking': APP_CONSTANTS.SOURCE_STATUS.CHECKING,
      'unknown': APP_CONSTANTS.SOURCE_STATUS.UNKNOWN
    };
    
    return statusMap[status] || APP_CONSTANTS.SOURCE_STATUS.UNKNOWN;
  }

  // 生成测试关键词
  generateTestKeyword() {
    const testKeywords = [
      'MIMK-001', 
      'SSIS-001', 
      'PRED-001',
      'JUL-001',
      'MIDE-001'
    ];
    
    return testKeywords[Math.floor(Math.random() * testKeywords.length)];
  }

  // 分离已缓存和未缓存的搜索源
  separateCachedSources(sources, userSettings) {
    const cachedResults = [];
    const uncachedSources = [];
    
    sources.forEach(source => {
      const cached = this.getCachedStatus(source.id);
      
      if (this.isCacheValid(cached, userSettings)) {
        cachedResults.push({
          ...cached,
          sourceId: source.id,
          sourceName: source.name,
          fromCache: true
        });
        this.checkStats.cacheHits++;
      } else {
        uncachedSources.push(source);
      }
    });
    
    return { cachedResults, uncachedSources };
  }

  // 计算可用性评分
  calculateAvailabilityScore(result) {
    let score = 0;
    
    if (result.available) score += 60;
    if (result.contentMatch) score += 30;
    if (result.responseTime && result.responseTime < 3000) score += 10;
    if (result.qualityScore) score += Math.min(result.qualityScore * 0.1, 10);
    
    return Math.min(100, score);
  }

  // 缓存管理方法
  getCachedStatus(sourceId) {
    return this.statusCache.get(`status_${sourceId}`);
  }

  isCacheValid(cached, userSettings) {
    if (!cached) return false;
    
    const cacheDuration = userSettings.sourceStatusCacheDuration || this.localCacheConfig.defaultTTL;
    const age = Date.now() - cached.lastChecked;
    
    // 根据状态调整缓存时间
    const statusMultiplier = this.localCacheConfig.statusMultipliers[cached.status] || 1.0;
    const adjustedDuration = cacheDuration * statusMultiplier;
    
    return age < adjustedDuration;
  }

  cacheResult(sourceId, result, userSettings) {
    const cacheKey = `status_${sourceId}`;
    
    this.statusCache.set(cacheKey, {
      ...result,
      cacheTimestamp: Date.now()
    });
    
    // 限制缓存大小
    if (this.statusCache.size > this.localCacheConfig.maxSize) {
      const oldestKey = this.statusCache.keys().next().value;
      this.statusCache.delete(oldestKey);
    }
  }

  // 统计管理方法
  updateCheckStats(action, results = []) {
    switch (action) {
      case 'started':
        this.checkStats.totalChecks++;
        break;
      case 'completed':
        if (results && results.length > 0) {
          const successful = results.filter(r => r.available).length;
          this.checkStats.successfulChecks += successful;
          
          // 计算平均响应时间
          const responseTimes = results
            .map(r => r.responseTime)
            .filter(time => time && time > 0);
          
          if (responseTimes.length > 0) {
            const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            this.checkStats.averageResponseTime = Math.round(
              (this.checkStats.averageResponseTime + avgTime) / 2
            );
          }
        }
        break;
      case 'failed':
        this.checkStats.failedChecks++;
        break;
    }
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, value] of this.statusCache.entries()) {
      if (value.cacheTimestamp && now - value.cacheTimestamp > maxAge) {
        this.statusCache.delete(key);
      }
    }
    
    console.log(`缓存清理完成，剩余 ${this.statusCache.size} 个条目`);
  }

  // 手动清理缓存
  clearCache() {
    this.statusCache.clear();
    console.log('搜索源状态本地缓存已清空');
  }

  // 获取检查统计
  getCheckingStats() {
    return {
      ...this.checkStats,
      cacheSize: this.statusCache.size,
      activeChecks: this.activeChecks.size,
      cacheHitRate: this.checkStats.totalChecks > 0 ? 
        (this.checkStats.cacheHits / this.checkStats.totalChecks * 100).toFixed(1) + '%' : '0%'
    };
  }

  // 预热缓存（使用后端API）
  async warmupCache(sources, userSettings = {}) {
    console.log(`开始预热缓存: ${sources.length} 个搜索源`);
    
    try {
      const keyword = this.generateTestKeyword();
      await this.checkMultipleSources(sources, userSettings, keyword);
      console.log('缓存预热完成');
    } catch (error) {
      console.error('缓存预热失败:', error);
    }
  }

  // 获取状态检查历史（从后端）
  async getStatusHistory(options = {}) {
    try {
      return await apiService.getSourceStatusHistory(options);
    } catch (error) {
      console.error('获取状态检查历史失败:', error);
      return {
        success: false,
        history: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 导出服务状态
  exportServiceStatus() {
    return {
      type: 'backend-checker',
      checkStats: this.getCheckingStats(),
      cacheConfig: this.localCacheConfig,
      timestamp: Date.now(),
      version: '2.0.0'
    };
  }

  // 健康检查
  async performHealthCheck() {
    try {
      // 测试后端API连接
      const testSources = [{
        id: 'test',
        name: 'Test Source',
        urlTemplate: 'https://example.com/search/{keyword}'
      }];
      
      const startTime = Date.now();
      const result = await this.callBackendCheck(testSources, 'test');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        backendConnected: true,
        responseTime,
        cacheSize: this.statusCache.size,
        timestamp: Date.now()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        backendConnected: false,
        error: error.message,
        cacheSize: this.statusCache.size,
        timestamp: Date.now()
      };
    }
  }
}

// 创建后端版检查器实例
export const backendSourceChecker = new BackendSourceChecker();

// 定期清理缓存
setInterval(() => {
  backendSourceChecker.cleanupExpiredCache();
}, 60 * 60 * 1000); // 每小时清理一次

// 兼容性导出
export const backendSourceChecker = new BackendSourceChecker();
export default backendSourceChecker;