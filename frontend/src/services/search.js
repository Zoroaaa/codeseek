// 搜索服务模块 - 集成增强版搜索源状态检查功能
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';
import authManager from './auth.js';
import enhancedSourceChecker from './enhanced-source-checker.js';

class SearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION;
    this.userSettings = null;
    
    // 状态检查统计
    this.checkStats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0
    };
  }

  // 执行搜索 - 集成增强状态检查
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
  
  // 获取用户可用的搜索源
  async getEnabledSearchSources() {
    try {
      // 如果用户未登录，使用默认搜索源
      if (!authManager.isAuthenticated()) {
        const defaultSources = ['javbus', 'javdb', 'javlibrary'];
        return APP_CONSTANTS.SEARCH_SOURCES.filter(
          source => defaultSources.includes(source.id)
        );
      }

      // 获取用户设置
      let userSettings;
      try {
        userSettings = await this.getUserSettings();
      } catch (error) {
        console.error('获取用户设置失败，使用默认搜索源:', error);
        const defaultSources = ['javbus', 'javdb', 'javlibrary'];
        return APP_CONSTANTS.SEARCH_SOURCES.filter(
          source => defaultSources.includes(source.id)
        );
      }

      const enabledSources = userSettings.searchSources || ['javbus', 'javdb', 'javlibrary'];
      
      // 验证搜索源ID的有效性
      const validSources = enabledSources.filter(sourceId => 
        APP_CONSTANTS.SEARCH_SOURCES.some(source => source.id === sourceId)
      );
      
      if (validSources.length === 0) {
        console.warn('用户设置的搜索源无效，使用默认源');
        const defaultSources = ['javbus', 'javdb', 'javlibrary'];
        return APP_CONSTANTS.SEARCH_SOURCES.filter(
          source => defaultSources.includes(source.id)
        );
      }
      
      // 合并内置搜索源和自定义搜索源
      const builtinSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => validSources.includes(source.id)
      );
      
      const customSources = userSettings.customSearchSources || [];
      const enabledCustomSources = customSources.filter(
        source => validSources.includes(source.id)
      );

      return [...builtinSources, ...enabledCustomSources];
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      const defaultSources = ['javbus', 'javdb', 'javlibrary'];
      return APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => defaultSources.includes(source.id)
      );
    }
  }

  // 构建搜索结果 - 使用增强状态检查
  async buildSearchResults(keyword, options = {}) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    const { checkStatus = false, userSettings = null } = options;
    
    try {
      // 获取用户可用的搜索源
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log(`使用 ${enabledSources.length} 个搜索源:`, enabledSources.map(s => s.name));
      
      // 如果启用了状态检查，使用增强检查器
      let sourcesWithStatus = enabledSources;
      if (checkStatus && userSettings) {
        console.log('开始增强状态检查...');
        this.updateCheckStats('started');
        
        try {
          const checkResults = await enhancedSourceChecker.checkMultipleSources(
            enabledSources, 
            userSettings
          );
          
          // 处理检查结果
          sourcesWithStatus = this.processStatusCheckResults(enabledSources, checkResults, userSettings);
          
          this.updateCheckStats('completed', checkResults);
          
        } catch (error) {
          console.error('状态检查失败:', error);
          this.updateCheckStats('failed');
          showToast('搜索源状态检查失败，使用默认配置', 'warning', 3000);
        }
      }
      
      return this.buildResultsFromSources(sourcesWithStatus, keyword, encodedKeyword, timestamp);
      
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      // 增强错误处理：如果获取搜索源失败，使用默认源
      const defaultSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => ['javbus', 'javdb', 'javlibrary'].includes(source.id)
      );
      
      return this.buildResultsFromSources(defaultSources, keyword, encodedKeyword, timestamp);
    }
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
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore,
        verified: result.verified || false
      };
      
      // 根据用户设置决定是否包含不可用的源
      if (userSettings.skipUnavailableSources) {
        if (result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE || 
            result.status === APP_CONSTANTS.SOURCE_STATUS.UNKNOWN) {
          processedSources.push(processedSource);
        }
      } else {
        processedSources.push(processedSource);
      }
    });
    
    const availableCount = processedSources.filter(s => 
      s.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
    ).length;
    
    console.log(`状态检查完成: ${availableCount}/${checkResults.length} 个搜索源可用`);
    
    if (availableCount === 0 && userSettings.skipUnavailableSources) {
      console.warn('所有搜索源都不可用，回退到包含所有源');
      return checkResults.map(({ source, result }) => ({
        ...sourcesMap.get(source.id),
        status: result.status,
        statusText: this.getStatusText(result.status),
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0
      }));
    }
    
    return processedSources;
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
        result.lastChecked = source.lastChecked;
        result.responseTime = source.responseTime;
        result.availabilityScore = source.availabilityScore;
        result.verified = source.verified;
      }
      
      return result;
    });
  }

  // 更新检查统计
  updateCheckStats(action, checkResults = null) {
    switch (action) {
      case 'started':
        this.checkStats.totalChecks++;
        break;
      case 'completed':
        if (checkResults) {
          const successful = checkResults.filter(r => 
            r.result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
          ).length;
          this.checkStats.successfulChecks += successful;
          
          // 计算平均响应时间
          const responseTimes = checkResults
            .map(r => r.result.responseTime)
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

  // 手动检查所有搜索源状态（用于测试功能）
  async checkAllSourcesStatus() {
    try {
      const userSettings = await this.getUserSettings();
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log('手动检查所有搜索源状态...');
      
      const checkResults = await enhancedSourceChecker.checkMultipleSources(
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
          lastChecked: result.lastChecked,
          responseTime: result.responseTime || 0,
          availabilityScore: result.availabilityScore,
          verified: result.verified || false
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
      const result = await enhancedSourceChecker.checkSourceStatus(source, userSettings);
      
      return {
        id: source.id,
        name: source.name,
        status: result.status,
        statusText: this.getStatusText(result.status),
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore,
        verified: result.verified || false,
        checkDetails: result.checkDetails
      };
    } catch (error) {
      console.error(`检查搜索源 ${sourceId} 状态失败:`, error);
      throw error;
    }
  }

  // 清除搜索源状态缓存
  clearSourceStatusCache() {
    enhancedSourceChecker.statusCache.clear();
    console.log('搜索源状态缓存已清除');
  }

  // 获取搜索源状态检查统计
  getStatusCheckStats() {
    return {
      ...this.checkStats,
      checkerStats: enhancedSourceChecker.getCheckingStats()
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
    this.clearSourceStatusCache();
    console.log('所有缓存已清理');
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

  // 导出搜索服务状态
  exportServiceStatus() {
    return {
      cacheStats: this.getCacheStats(),
      checkStats: this.getStatusCheckStats(),
      userSettings: this.userSettings,
      timestamp: Date.now()
    };
  }
}

// 搜索历史管理器
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