// src/services/search/search-service.js
// 搜索引擎服务 - 从search.js重构

import { APP_CONSTANTS } from '../../core/constants.js';
import { validateSearchKeyword } from '../../utils/validation.js';

export class SearchService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.userSettingsService = null;
    this.userHistoryService = null;
    this.sourceCheckerService = null;
    this.searchSourcesService = null;
    this.notificationService = null;
    
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION || 300000; // 5分钟
    this.searchStats = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageResponseTime: 0
    };
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [
      apiClient, 
      authService, 
      userSettingsService, 
      userHistoryService,
      sourceCheckerService,
      searchSourcesService,
      notificationService
    ] = dependencies;
    
    this.apiClient = apiClient;
    this.authService = authService;
    this.userSettingsService = userSettingsService;
    this.userHistoryService = userHistoryService;
    this.sourceCheckerService = sourceCheckerService;
    this.searchSourcesService = searchSourcesService;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
    console.log('搜索服务已初始化');
  }

  // 执行搜索 - 主要方法
  async performSearch(keyword, options = {}) {
    const startTime = Date.now();
    
    try {
      // 验证搜索关键词
      const validation = validateSearchKeyword(keyword);
      if (!validation.valid) {
        throw new Error(validation.errors[0]);
      }

      this.searchStats.totalSearches++;

      // 获取用户设置
      const userSettings = await this.getUserSettings();
      const useCache = options.useCache !== undefined ? options.useCache : userSettings.cacheResults;
      const { saveToHistory = true } = options;

      // 检查缓存
      if (useCache) {
        const cached = this.getCachedResults(keyword);
        if (cached) {
          this.showNotification('使用缓存结果', 'info', 2000);
          return cached;
        }
      }

      // 构建搜索结果
      const results = await this.buildSearchResults(keyword, {
        checkStatus: userSettings.checkSourceStatus,
        userSettings
      });

      // 缓存结果
      if (useCache) {
        this.cacheResults(keyword, results);
      }

      // 保存到搜索历史
      if (saveToHistory && this.authService?.isAuthenticated()) {
        this.saveToHistory(keyword).catch(console.error);
      }

      // 更新统计
      this.searchStats.successfulSearches++;
      this.updateAverageResponseTime(Date.now() - startTime);

      return results;
    } catch (error) {
      this.searchStats.failedSearches++;
      console.error('搜索执行失败:', error);
      
      this.showNotification(error.message || '搜索失败，请稍后重试', 'error');
      
      throw error;
    }
  }

  // 构建搜索结果
  async buildSearchResults(keyword, options = {}) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    const { checkStatus = false, userSettings = null } = options;
    
    try {
      // 获取启用的搜索源
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log(`使用 ${enabledSources.length} 个搜索源:`, enabledSources.map(s => s.name));
      
      let sourcesWithStatus = enabledSources;
      
      // 如果启用了状态检查，使用源检查器服务
      if (checkStatus && this.sourceCheckerService && userSettings) {
        console.log('开始搜索源状态检查...');
        
        try {
          const checkResults = await this.sourceCheckerService.checkMultipleSources(
            enabledSources, 
            userSettings,
            keyword
          );
          
          // 处理检查结果
          sourcesWithStatus = this.processStatusCheckResults(enabledSources, checkResults, userSettings);
          
          console.log(`状态检查完成: ${sourcesWithStatus.length}/${enabledSources.length} 个源可用`);
          
        } catch (error) {
          console.error('搜索源状态检查失败:', error);
          this.showNotification('搜索源状态检查失败，使用默认配置', 'warning', 3000);
        }
      }
      
      return this.buildResultsFromSources(sourcesWithStatus, keyword, encodedKeyword, timestamp);
      
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      
      // 降级处理：使用默认搜索源
      const defaultSources = this.getDefaultSearchSources();
      return this.buildResultsFromSources(defaultSources, keyword, encodedKeyword, timestamp);
    }
  }

  // 获取启用的搜索源
  async getEnabledSearchSources() {
    try {
      if (this.searchSourcesService) {
        return await this.searchSourcesService.getEnabledSources();
      }
      
      // 降级处理
      return this.getDefaultSearchSources();
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      return this.getDefaultSearchSources();
    }
  }

  // 获取默认搜索源
  getDefaultSearchSources() {
    const defaultSources = ['javbus', 'javdb', 'javlibrary'];
    return APP_CONSTANTS.SEARCH_SOURCES.filter(
      source => defaultSources.includes(source.id)
    );
  }

  // 处理状态检查结果
  processStatusCheckResults(originalSources, checkResults, userSettings) {
    const sourcesMap = new Map(originalSources.map(s => [s.id, s]));
    const processedSources = [];
    
    checkResults.forEach(({ source, result }) => {
      const originalSource = sourcesMap.get(source.id);
      if (!originalSource) {
        console.warn(`未找到原始搜索源: ${source.id}`);
        return;
      }
      
      const processedSource = {
        ...originalSource,
        status: result.status,
        statusText: this.getStatusText(result.status),
        errorMessage: result.error || null,
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore || 0,
        verified: result.verified || result.contentMatch || false,
        contentMatch: result.contentMatch || false,
        qualityScore: result.qualityScore || 0,
        fromCache: result.fromCache || false,
        unavailableReason: this.getUnavailableReason(result)
      };
      
      processedSources.push(processedSource);
    });
    
    // 按可用性排序
    return this.sortSourcesByAvailability(processedSources);
  }

  // 根据可用性排序搜索源
  sortSourcesByAvailability(sources) {
    return sources.sort((a, b) => {
      // 优先级：可用 > 未知 > 超时 > 不可用 > 错误
      const statusPriority = {
        [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 0,
        [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: 1,
        [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 2,
        [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 3,
        [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 4,
        [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: 5
      };

      const priorityA = statusPriority[a.status] ?? 99;
      const priorityB = statusPriority[b.status] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // 同等状态下，按响应时间排序
      if (a.responseTime && b.responseTime) {
        return a.responseTime - b.responseTime;
      }

      // 最后按内容匹配度排序
      if (a.contentMatch && !b.contentMatch) return -1;
      if (!a.contentMatch && b.contentMatch) return 1;

      return 0;
    });
  }

  // 从搜索源构建结果
  buildResultsFromSources(sources, keyword, encodedKeyword, timestamp) {
    return sources.map(source => {
      const result = {
        id: `result_${keyword}_${source.id}_${timestamp}`,
        title: source.name,
        subtitle: source.subtitle,
        url: source.urlTemplate.replace('{keyword}', encodedKeyword),
        icon: source.icon,
        keyword: keyword,
        timestamp: timestamp,
        source: source.id
      };
      
      // 如果进行了状态检查，添加状态信息
      if (source.status) {
        result.status = source.status;
        result.statusText = source.statusText;
        result.errorMessage = source.errorMessage;
        result.unavailableReason = source.unavailableReason;
        result.lastChecked = source.lastChecked;
        result.responseTime = source.responseTime;
        result.availabilityScore = source.availabilityScore;
        result.verified = source.verified;
        result.contentMatch = source.contentMatch;
        result.qualityScore = source.qualityScore;
        result.fromCache = source.fromCache;
      }
      
      return result;
    });
  }

  // 获取状态文本描述
  getStatusText(status) {
    const statusTexts = {
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '未知',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '检查中',
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '可用',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '不可用',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '超时',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '错误'
    };
    
    return statusTexts[status] || '未知';
  }

  // 获取不可用原因的详细描述
  getUnavailableReason(result) {
    if (result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
      return null;
    }

    const reasons = [];
    
    switch (result.status) {
      case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
        reasons.push('连接超时');
        if (result.responseTime > 10000) {
          reasons.push(`响应时间过长 (${Math.round(result.responseTime/1000)}秒)`);
        }
        break;
      
      case APP_CONSTANTS.SOURCE_STATUS.ERROR:
        if (result.httpStatus) {
          reasons.push(`HTTP错误 ${result.httpStatus}`);
        }
        if (result.error) {
          reasons.push(result.error);
        } else {
          reasons.push('服务器错误');
        }
        break;
      
      case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
        reasons.push('服务不可用');
        if (result.httpStatus === 404) {
          reasons.push('页面不存在');
        } else if (result.httpStatus >= 500) {
          reasons.push('服务器内部错误');
        }
        break;
      
      default:
        if (result.error) {
          reasons.push(result.error);
        } else {
          reasons.push('未知原因');
        }
    }

    return reasons.length > 0 ? reasons.join('，') : '检查失败';
  }

  // 获取搜索建议
  getSearchSuggestions(query, history = []) {
    if (!query || typeof query !== 'string') return [];
    
    return history
      .filter(item => {
        if (!item) return false;
        
        const searchTerm = item.keyword || item.query;
        if (!searchTerm || typeof searchTerm !== 'string') {
          return false;
        }
        
        return searchTerm.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, 5);
  }

  // 预热缓存
  async warmupCache(keywords = []) {
    for (const keyword of keywords) {
      try {
        const results = await this.buildSearchResults(keyword);
        this.cacheResults(keyword, results);
        console.log(`缓存预热: ${keyword}`);
      } catch (error) {
        console.error(`缓存预热失败 ${keyword}:`, error);
      }
    }
  }

  // 结果排序
  sortResultsByRelevance(results, keyword = '') {
    if (!keyword) return results;
    
    return results.sort((a, b) => {
      // 优先考虑状态
      if (a.status && b.status) {
        const statusA = a.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 0 : 1;
        const statusB = b.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 0 : 1;
        
        if (statusA !== statusB) {
          return statusA - statusB;
        }
      }
      
      // 其次考虑匹配度
      const scoreA = this.calculateRelevanceScore(a, keyword);
      const scoreB = this.calculateRelevanceScore(b, keyword);
      
      return scoreB - scoreA;
    });
  }

  // 计算相关性得分
  calculateRelevanceScore(result, keyword) {
    let score = 0;
    
    // 标题匹配
    if (result.title && result.title.toLowerCase().includes(keyword.toLowerCase())) {
      score += 10;
    }
    
    // 状态得分
    if (result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
      score += 20;
    }
    
    // 内容匹配
    if (result.contentMatch) {
      score += 15;
    }
    
    // 响应时间得分（响应越快得分越高）
    if (result.responseTime) {
      score += Math.max(0, 10 - result.responseTime / 1000);
    }
    
    return score;
  }

  // 用户设置获取
  async getUserSettings() {
    try {
      if (this.userSettingsService && this.authService?.isAuthenticated()) {
        const { success, settings } = await this.userSettingsService.getSettings();
        return success ? settings : this.getDefaultSearchSettings();
      }
      return this.getDefaultSearchSettings();
    } catch (error) {
      console.error('获取用户设置失败:', error);
      return this.getDefaultSearchSettings();
    }
  }

  getDefaultSearchSettings() {
    return {
      cacheResults: true,
      checkSourceStatus: false,
      sourceStatusCheckTimeout: 10000,
      sourceStatusCacheDuration: 300000,
      skipUnavailableSources: false,
      showSourceStatus: true,
      retryFailedSources: true
    };
  }

  // 保存到搜索历史
  async saveToHistory(keyword) {
    try {
      if (this.userHistoryService) {
        await this.userHistoryService.addToHistory(keyword, 'manual');
      }
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }

  // 缓存管理
  getCachedResults(keyword) {
    const cached = this.searchCache.get(keyword);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
      return cached.results;
    }
    
    // 清理过期缓存
    if (cached) {
      this.searchCache.delete(keyword);
    }
    
    return null;
  }

  cacheResults(keyword, results) {
    // 限制缓存大小
    if (this.searchCache.size >= 100) {
      // 删除最旧的缓存项
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    
    this.searchCache.set(keyword, {
      results,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.searchCache.clear();
    console.log('搜索缓存已清理');
  }

  // 统计相关方法
  updateAverageResponseTime(responseTime) {
    const currentAvg = this.searchStats.averageResponseTime;
    const totalSearches = this.searchStats.totalSearches;
    
    this.searchStats.averageResponseTime = Math.round(
      (currentAvg * (totalSearches - 1) + responseTime) / totalSearches
    );
  }

  getSearchStats() {
    return {
      ...this.searchStats,
      cacheSize: this.searchCache.size,
      cacheHitRate: this.calculateCacheHitRate()
    };
  }

  calculateCacheHitRate() {
    if (this.searchStats.totalSearches === 0) return 0;
    
    // 这是一个简化的计算，实际应该跟踪缓存命中次数
    return Math.round((this.searchCache.size / this.searchStats.totalSearches) * 100);
  }

  // 工具方法
  showNotification(message, type = 'info', duration = 3000) {
    if (this.notificationService) {
      this.notificationService.showToast(message, type, duration);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      searchCache: {
        size: this.searchCache.size,
        items: []
      }
    };
    
    // 搜索结果缓存统计
    for (const [keyword, data] of this.searchCache) {
      stats.searchCache.items.push({
        keyword,
        timestamp: data.timestamp,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > this.cacheExpiration
      });
    }
    
    return stats;
  }

  // 导出服务状态
  exportServiceStatus() {
    return {
      type: 'search-service',
      stats: this.getSearchStats(),
      cacheStats: this.getCacheStats(),
      settings: this.getDefaultSearchSettings(),
      timestamp: Date.now(),
      version: '2.0.0'
    };
  }

  // 健康检查
  healthCheck() {
    const dependenciesStatus = {
      apiClient: !!this.apiClient,
      authService: !!this.authService,
      userSettingsService: !!this.userSettingsService,
      userHistoryService: !!this.userHistoryService,
      sourceCheckerService: !!this.sourceCheckerService,
      searchSourcesService: !!this.searchSourcesService,
      notificationService: !!this.notificationService
    };

    return {
      status: 'healthy',
      dependencies: dependenciesStatus,
      stats: this.searchStats,
      cacheSize: this.searchCache.size,
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    this.clearCache();
    this.searchStats = {
      totalSearches: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageResponseTime: 0
    };
  }
}
export { SearchService };
export default SearchService;