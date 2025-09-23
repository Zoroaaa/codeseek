// src/services/search.js - 清理版本：移除详情提取相关代码，保留核心搜索功能
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';
import authManager from './auth.js';
import backendSourceChecker from './enhanced-source-checker.js';
import searchSourcesAPI from './search-sources-api.js';

class SearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION;
    this.userSettings = null;
    
    // 搜索源缓存
    this.sourcesCache = null;
    this.sourcesCacheTimestamp = 0;
    this.sourcesCacheExpiry = 300000; // 5分钟缓存
    
    // 状态检查统计
    this.checkStats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      backendCalls: 0
    };
  }

  // 执行搜索 - 集成后端状态检查
  async performSearch(keyword, options = {}) {
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 获取用户设置
    let useCache = options.useCache;
    if (useCache === undefined) {
      try {
        if (authManager.isAuthenticated()) {
          const userSettings = await this.getUserSettings();
          useCache = userSettings.cacheResults !== false;
        } else {
          useCache = true;
        }
      } catch (error) {
        console.warn('获取缓存设置失败，使用默认值:', error);
        useCache = true;
      }
    }

    const { saveToHistory = true } = options;

    // 检查搜索结果缓存
    if (useCache) {
      const cached = this.getCachedResults(keyword);
      if (cached) {
        showToast('使用缓存结果', 'info', 2000);
        return cached;
      }
    }

    // 获取用户的搜索源状态检查设置
    let shouldCheckStatus = false;
    let userSettings = null;
    
    try {
      if (authManager.isAuthenticated()) {
        userSettings = await this.getUserSettings();
        shouldCheckStatus = userSettings.checkSourceStatus === true;
      }
    } catch (error) {
      console.warn('获取状态检查设置失败:', error);
    }

    // 构建搜索结果
    const results = await this.buildSearchResults(keyword, {
      checkStatus: shouldCheckStatus,
      userSettings
    });

    // 缓存结果
    if (useCache) {
      this.cacheResults(keyword, results);
    }

    // 保存到搜索历史
    if (saveToHistory && authManager.isAuthenticated()) {
      this.saveToHistory(keyword).catch(console.error);
    }

    return results;
  }
  
  // 统一的用户设置获取方法
  async getUserSettings() {
    if (!this.userSettings || Date.now() - this.userSettings.timestamp > 60000) {
      try {
        const settings = await apiService.getUserSettings();
        this.userSettings = {
          data: settings,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('获取用户设置失败:', error);
        throw error;
      }
    }
    return this.userSettings.data;
  }
  
  // 清除用户设置缓存
  clearUserSettingsCache() {
    this.userSettings = null;
    console.log('用户设置缓存已清除');
  }
  
  // 获取可用的搜索源（通过API动态获取）
  async getEnabledSearchSources(options = {}) {
    const { 
      includeNonSearchable = false,  // 是否包含非搜索源
      keyword = ''                   // 搜索关键词（用于智能判断）
    } = options;

    try {
      // 检查缓存
      if (this.sourcesCache && 
          Date.now() - this.sourcesCacheTimestamp < this.sourcesCacheExpiry) {
        console.log('使用搜索源缓存');
        return this.filterAndSortSources(this.sourcesCache, includeNonSearchable, keyword);
      }

      // 如果用户未登录，使用系统默认配置
      if (!authManager.isAuthenticated()) {
        console.log('用户未登录，使用系统默认搜索源');
        const defaultSources = await this.getSystemDefaultSources();
        return this.filterAndSortSources(defaultSources, includeNonSearchable, keyword);
      }

      // 获取用户的搜索源配置
      let sources;
      try {
        sources = await searchSourcesAPI.getSearchSources({
          includeSystem: true,
          enabledOnly: true
        });
        console.log(`从API获取到 ${sources.length} 个已可用的搜索源`);
      } catch (error) {
        console.error('获取用户搜索源失败，使用系统默认:', error);
        const defaultSources = await this.getSystemDefaultSources();
        return this.filterAndSortSources(defaultSources, includeNonSearchable, keyword);
      }

      // 缓存搜索源
      this.sourcesCache = sources;
      this.sourcesCacheTimestamp = Date.now();
      
      return this.filterAndSortSources(sources, includeNonSearchable, keyword);
      
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      // 最终回退：使用硬编码的默认源
      const fallbackSources = await this.getFallbackSources();
      return this.filterAndSortSources(fallbackSources, includeNonSearchable, keyword);
    }
  }

  // 获取系统默认搜索源
  async getSystemDefaultSources() {
    try {
      // 从搜索源API获取系统默认配置
      const allSources = await searchSourcesAPI.getSearchSources({
        includeSystem: true,
        searchable: true
      });
      
      // 返回默认推荐的搜索源
      const defaultSourceIds = ['javbus', 'javdb', 'javlibrary', 'btsow'];
      return allSources.filter(source => defaultSourceIds.includes(source.id));
    } catch (error) {
      console.error('获取系统默认搜索源失败:', error);
      return this.getFallbackSources();
    }
  }

  // 获取回退搜索源（硬编码最小集合）
  async getFallbackSources() {
    // 最小可用搜索源集合，仅用于紧急情况
    return [
      {
        id: 'javbus',
        name: 'JavBus',
        subtitle: '番号+磁力一体站，信息完善',
        icon: '🎬',
        urlTemplate: 'https://www.javbus.com/search/{keyword}',
        searchable: true,
        siteType: 'search',
        searchPriority: 1,
        requiresKeyword: true,
        isSystem: true,
        userEnabled: true
      },
      {
        id: 'javdb',
        name: 'JavDB',
        subtitle: '极简风格番号资料站，轻量快速',
        icon: '📚',
        urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
        searchable: true,
        siteType: 'search',
        searchPriority: 2,
        requiresKeyword: true,
        isSystem: true,
        userEnabled: true
      }
    ];
  }

  // 过滤和排序搜索源
  filterAndSortSources(sources, includeNonSearchable, keyword) {
    let filteredSources = [...sources];
    
    // 如果不包含非搜索源，过滤掉 searchable: false 的源
    if (!includeNonSearchable) {
      filteredSources = filteredSources.filter(source => source.searchable !== false);
    }
    
    // 只保留可用的搜索源
    filteredSources = filteredSources.filter(source => source.userEnabled !== false);
    
    // 根据搜索优先级排序
    filteredSources.sort((a, b) => {
      const priorityA = a.searchPriority || a.priority || 99;
      const priorityB = b.searchPriority || b.priority || 99;
      return priorityA - priorityB;
    });
    
    // 智能模式：如果关键词不像番号，调整源的优先级
    if (keyword && !this.looksLikeProductCode(keyword)) {
      // 对于普通关键词，优先使用通用搜索引擎
      filteredSources = filteredSources.sort((a, b) => {
        // 如果源支持通用搜索，提升优先级
        if (a.supportsGeneralSearch && !b.supportsGeneralSearch) return -1;
        if (!a.supportsGeneralSearch && b.supportsGeneralSearch) return 1;
        return 0;
      });
    }
    
    return filteredSources;
  }

  // 判断是否像番号的辅助方法
  looksLikeProductCode(keyword) {
    // 番号通常格式: ABC-123, MIMK-186 等
    const productCodePattern = /^[A-Z]{2,6}-?\d{3,6}$/i;
    return productCodePattern.test(keyword.trim());
  }

  // 构建搜索结果 - 使用新的搜索源API
  async buildSearchResults(keyword, options = {}) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    const { checkStatus = false, userSettings = null } = options;
    
    try {
      // 获取搜索源时，根据关键词类型决定
      const enabledSources = await this.getEnabledSearchSources({
        includeNonSearchable: false,  // 搜索时不包含浏览站
        keyword: keyword
      });
      
      console.log(`使用 ${enabledSources.length} 个搜索源进行搜索:`, enabledSources.map(s => s.name));
      
      // 如果可用了状态检查，使用后端检查器
      let sourcesWithStatus = enabledSources;
      if (checkStatus && userSettings) {
        console.log('开始后端状态检查...');
        this.updateCheckStats('started');
        
        try {
          // 使用后端检查器，传入实际的搜索关键词以进行内容匹配检查
          const checkResults = await backendSourceChecker.checkMultipleSources(
            enabledSources, 
            userSettings,
            keyword // 传入实际关键词进行精确内容匹配
          );
          
          // 处理检查结果
          sourcesWithStatus = this.processStatusCheckResults(enabledSources, checkResults, userSettings);
          
          this.updateCheckStats('completed', checkResults);
          
          console.log(`后端状态检查完成: ${sourcesWithStatus.length}/${enabledSources.length} 个源可用`);
          
        } catch (error) {
          console.error('后端状态检查失败:', error);
          this.updateCheckStats('failed');
          showToast('搜索源状态检查失败，使用默认配置', 'warning', 3000);
        }
      }
      
      return this.buildResultsFromSources(sourcesWithStatus, keyword, encodedKeyword, timestamp);
      
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      // 增强错误处理：如果获取搜索源失败，使用回退源
      const fallbackSources = await this.getFallbackSources();
      
      return this.buildResultsFromSources(fallbackSources, keyword, encodedKeyword, timestamp);
    }
  }

  // 处理状态检查结果方法 - 不再过滤不可用源，而是保留所有源
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
      
      // 修改：不再根据skipUnavailableSources过滤，保留所有源
      processedSources.push(processedSource);
    });
    
    const availableCount = processedSources.filter(s => 
      s.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
    ).length;
    
    console.log(`状态检查完成: ${availableCount}/${checkResults.length} 个搜索源可用`);
    
    // 按状态排序 - 可用的源在前，不可用的在后
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

      // 同等状态下，按响应时间排序（响应快的在前）
      if (a.responseTime && b.responseTime) {
        return a.responseTime - b.responseTime;
      }

      // 最后按内容匹配度排序
      if (a.contentMatch && !b.contentMatch) return -1;
      if (!a.contentMatch && b.contentMatch) return 1;

      return 0;
    });
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

  // 更新检查统计
  updateCheckStats(action, checkResults = null) {
    switch (action) {
      case 'started':
        this.checkStats.totalChecks++;
        this.checkStats.backendCalls++;
        break;
      case 'completed':
        if (checkResults) {
          const successful = checkResults.filter(cr => 
            cr.result && cr.result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
          ).length;
          this.checkStats.successfulChecks += successful;
          
          // 计算平均响应时间
          const responseTimes = checkResults
            .map(cr => cr.result?.responseTime)
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

  // 使用后端API手动检查所有搜索源状态
  async checkAllSourcesStatus() {
    try {
      const userSettings = await this.getUserSettings();
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log('手动检查所有搜索源状态...');
      
      // 使用后端检查器
      const checkResults = await backendSourceChecker.checkMultipleSources(
        enabledSources, 
        userSettings
      );
      
      // 处理结果并返回状态摘要
      const statusSummary = {
        total: checkResults.length,
        available: 0,
        unavailable: 0,
        timeout: 0,
        error: 0,
        averageResponseTime: 0,
        sources: []
      };
      
      let totalResponseTime = 0;
      let validResponseCount = 0;
      
      checkResults.forEach(({ source, result }) => {
        const sourceResult = {
          id: source.id,
          name: source.name,
          status: result.status,
          statusText: this.getStatusText(result.status),
          unavailableReason: this.getUnavailableReason(result),
          lastChecked: result.lastChecked,
          responseTime: result.responseTime || 0,
          availabilityScore: result.availabilityScore || 0,
          verified: result.verified || false,
          contentMatch: result.contentMatch || false,
          fromCache: result.fromCache || false
        };
        
        statusSummary.sources.push(sourceResult);
        
        // 统计各状态数量
        switch (result.status) {
          case APP_CONSTANTS.SOURCE_STATUS.AVAILABLE:
            statusSummary.available++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
            statusSummary.unavailable++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
            statusSummary.timeout++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.ERROR:
            statusSummary.error++;
            break;
        }
        
        // 计算平均响应时间
        if (result.responseTime && result.responseTime > 0) {
          totalResponseTime += result.responseTime;
          validResponseCount++;
        }
      });
      
      if (validResponseCount > 0) {
        statusSummary.averageResponseTime = Math.round(totalResponseTime / validResponseCount);
      }
      
      console.log('所有搜索源状态检查完成:', statusSummary);
      
      // 更新统计信息
      this.updateCheckStats('completed', checkResults);
      
      return statusSummary;
    } catch (error) {
      console.error('检查所有搜索源状态失败:', error);
      this.updateCheckStats('failed');
      throw error;
    }
  }

  // 检查单个搜索源状态
  async checkSingleSourceStatus(sourceId) {
    try {
      const enabledSources = await this.getEnabledSearchSources();
      const source = enabledSources.find(s => s.id === sourceId);
      
      if (!source) {
        throw new Error(`未找到搜索源: ${sourceId}`);
      }
      
      const userSettings = await this.getUserSettings();
      
      // 使用后端检查器
      const result = await backendSourceChecker.checkSourceStatus(source, userSettings);
      
      return {
        id: source.id,
        name: source.name,
        status: result.status,
        statusText: this.getStatusText(result.status),
        unavailableReason: this.getUnavailableReason(result),
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore || 0,
        verified: result.verified || false,
        contentMatch: result.contentMatch || false,
        checkDetails: result.checkDetails || {},
        fromCache: result.fromCache || false
      };
    } catch (error) {
      console.error(`检查搜索源 ${sourceId} 状态失败:`, error);
      throw error;
    }
  }

  // 清除搜索源缓存
  clearSourcesCache() {
    this.sourcesCache = null;
    this.sourcesCacheTimestamp = 0;
    // 同时清除搜索源API的缓存
    searchSourcesAPI.clearCache();
    console.log('搜索源缓存已清除');
  }

  // 清除搜索源状态缓存
  clearSourceStatusCache() {
    backendSourceChecker.clearCache();
    console.log('搜索源状态缓存已清除');
  }

  // 获取搜索源状态检查统计
  getStatusCheckStats() {
    return {
      ...this.checkStats,
      checkerStats: backendSourceChecker.getCheckingStats()
    };
  }

  // 获取缓存结果
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

  // 缓存搜索结果
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

  // 保存到搜索历史
  async saveToHistory(keyword) {
    try {
      await apiService.saveSearchHistory(keyword, 'manual');
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
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

  // 清理搜索缓存
  clearCache() {
    this.searchCache.clear();
    console.log('搜索缓存已清理');
  }

  // 清理所有缓存
  clearAllCache() {
    this.searchCache.clear();
    this.clearSourcesCache();
    this.clearSourceStatusCache();
    console.log('所有缓存已清理');
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      searchCache: {
        size: this.searchCache.size,
        items: []
      },
      sourcesCache: {
        size: this.sourcesCache ? this.sourcesCache.length : 0,
        timestamp: this.sourcesCacheTimestamp,
        expired: Date.now() - this.sourcesCacheTimestamp > this.sourcesCacheExpiry
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

  // 预热缓存（预加载常用搜索）
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

  // 预热搜索源缓存
  async warmupSourcesCache() {
    try {
      console.log('开始预热搜索源缓存...');
      await this.getEnabledSearchSources();
      console.log('搜索源缓存预热完成');
    } catch (error) {
      console.error('搜索源缓存预热失败:', error);
    }
  }

  // 导出搜索服务状态
  exportServiceStatus() {
    return {
      type: 'optimized-api-search-service',
      cacheStats: this.getCacheStats(),
      checkStats: this.getStatusCheckStats(),
      userSettings: this.userSettings,
      sourcesCache: {
        size: this.sourcesCache ? this.sourcesCache.length : 0,
        timestamp: this.sourcesCacheTimestamp,
        expired: Date.now() - this.sourcesCacheTimestamp > this.sourcesCacheExpiry
      },
      timestamp: Date.now(),
      version: '2.3.1'
    };
  }

  // 获取搜索源管理器实例（用于UI组件）
  getSearchSourcesAPI() {
    return searchSourcesAPI;
  }

  // 刷新搜索源配置
  async refreshSearchSources() {
    this.clearSourcesCache();
    this.clearUserSettingsCache();
    console.log('搜索源配置已刷新');
  }
}

// 搜索历史管理器（保持不变）
export class SearchHistoryManager {
  constructor() {
    this.maxHistorySize = APP_CONSTANTS.LIMITS.MAX_HISTORY;
  }

  // 添加到历史记录
  async addToHistory(keyword, source = 'manual') {
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      console.warn('无效的搜索关键词，跳过添加到历史');
      return;
    }

    try {
      await apiService.saveSearchHistory(keyword.trim(), source);
      return true;
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      return false;
    }
  }

  // 获取搜索历史
  async getHistory() {
    try {
      return await apiService.getSearchHistory();
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  // 删除历史记录项
  async deleteHistoryItem(historyId) {
    try {
      await apiService.deleteSearchHistory(historyId);
      return true;
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      return false;
    }
  }

  // 清空所有历史记录
  async clearAllHistory() {
    try {
      await apiService.clearAllSearchHistory();
      return true;
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      return false;
    }
  }

  // 获取搜索统计
  async getSearchStats() {
    try {
      return await apiService.getSearchStats();
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
  }

  // 搜索历史去重
  deduplicateHistory(history) {
    const seen = new Set();
    return history.filter(item => {
      const key = item.keyword || item.query;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // 按时间排序历史记录
  sortHistoryByTime(history, descending = true) {
    return history.sort((a, b) => {
      const timeA = a.timestamp || a.createdAt || 0;
      const timeB = b.timestamp || b.createdAt || 0;
      return descending ? timeB - timeA : timeA - timeB;
    });
  }

  // 按频率排序历史记录
  sortHistoryByFrequency(history, descending = true) {
    return history.sort((a, b) => {
      const countA = a.count || 1;
      const countB = b.count || 1;
      return descending ? countB - countA : countA - countB;
    });
  }
}

// 创建服务实例
export const searchService = new SearchService();
export const searchHistoryManager = new SearchHistoryManager();
export default searchService;