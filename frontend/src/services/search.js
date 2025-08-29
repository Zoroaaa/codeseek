// 集成增强检查器的搜索服务 - 替换原有的search.js
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';
import authManager from './auth.js';
import EnhancedSearchSourceChecker from './advanced-source-checker.js';
import { AdvancedSearchUI } from '../components/advanced-search-ui.js';

class SearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION;
    this.userSettings = null;
    
    // 使用增强的搜索源检查器
    this.sourceChecker = new AdvancedSourceChecker();
  }

  /**
   * 升级版搜索源可用性检查 - 使用增强检查器
   */
  async checkSourcesAvailability(sources, options = {}) {
    const { 
      timeout = 10000, 
      showProgress = true,
      useCache = true,
      strategy = 'comprehensive', // comprehensive, basic, fast
      parallel = true
    } = options;
    
    try {
      return await this.sourceChecker.checkSourcesAvailability(sources, {
        timeout,
        showProgress,
        useCache,
        strategy,
        parallel
      });
    } catch (error) {
      console.error('搜索源可用性检查失败:', error);
      
      if (showProgress) {
        showToast('搜索源检查失败，将使用所有配置的搜索源', 'warning');
      }
      
      // 降级处理：返回所有源但标记为未检查
      return sources.map(source => ({
        ...source,
        available: true, // 假设可用以免影响搜索
        status: 'unchecked',
        error: '检查器故障',
        lastChecked: Date.now(),
        reliability: 0.5 // 中等可靠性
      }));
    }
  }

  /**
   * 智能搜索源筛选 - 基于可靠性和用户偏好
   */
  async filterOptimalSources(checkedSources, options = {}) {
    const {
      minReliability = 0.3,    // 最低可靠性阈值
      maxSources = 10,         // 最大搜索源数量
      preferFastSources = true, // 优先选择快速响应的源
      includePartial = true     // 是否包含部分可用的源
    } = options;

    let filteredSources = checkedSources.filter(source => {
      // 基本可用性过滤
      if (!source.available && !includePartial) return false;
      if (source.status === 'error') return false;
      
      // 可靠性过滤
      if (source.reliability !== undefined && source.reliability < minReliability) {
        return false;
      }
      
      return true;
    });

    // 按优先级排序
    filteredSources.sort((a, b) => {
      // 1. 优先考虑完全可用的源
      if (a.available !== b.available) {
        return b.available - a.available;
      }
      
      // 2. 可靠性排序
      const reliabilityA = a.reliability || 0.5;
      const reliabilityB = b.reliability || 0.5;
      if (Math.abs(reliabilityA - reliabilityB) > 0.1) {
        return reliabilityB - reliabilityA;
      }
      
      // 3. 响应时间排序（如果启用快速偏好）
      if (preferFastSources && a.responseTime && b.responseTime) {
        return a.responseTime - b.responseTime;
      }
      
      // 4. 内置优先级
      return (a.priority || 999) - (b.priority || 999);
    });

    // 限制数量
    filteredSources = filteredSources.slice(0, maxSources);
    
    console.log(`智能筛选：从 ${checkedSources.length} 个源中选择了 ${filteredSources.length} 个优质源`);
    
    return filteredSources;
  }

  /**
   * 执行搜索 - 集成增强检查功能
   */
  async performSearch(keyword, options = {}) {
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 获取用户设置
    let useCache = options.useCache;
    let checkSourceStatus = options.checkSourceStatus;
    let checkStrategy = options.checkStrategy || 'fast';
    
    if (useCache === undefined || checkSourceStatus === undefined) {
      try {
        if (authManager.isAuthenticated()) {
          const userSettings = await this.getUserSettings();
          if (useCache === undefined) {
            useCache = userSettings.cacheResults !== false;
          }
          if (checkSourceStatus === undefined) {
            checkSourceStatus = userSettings.checkSourceStatus === true;
          }
          // 根据用户设置调整检查策略
          if (userSettings.quickSearch === true) {
            checkStrategy = 'basic';
          } else if (userSettings.thoroughCheck === true) {
            checkStrategy = 'comprehensive';
          }
        } else {
          useCache = true;
          checkSourceStatus = false;
        }
      } catch (error) {
        console.warn('获取用户设置失败，使用默认值:', error);
        useCache = true;
        checkSourceStatus = false;
      }
    }

    const { saveToHistory = true } = options;

    // 检查缓存
    if (useCache) {
      const cached = this.getCachedResults(keyword);
      if (cached) {
        showToast('使用缓存结果', 'info', 2000);
        return cached;
      }
    }

    // 获取并检查搜索源
    let enabledSources = await this.getEnabledSearchSources();
    
    if (checkSourceStatus && enabledSources.length > 0) {
      try {
        console.log(`开始进行 ${checkStrategy} 级别的搜索源检查...`);
        
        const checkedSources = await this.checkSourcesAvailability(enabledSources, {
          showProgress: true,
          useCache: true,
          strategy: checkStrategy,
          timeout: checkStrategy === 'fast' ? 5000 : 10000
        });
        
        // 智能筛选最优搜索源
        const optimalSources = await this.filterOptimalSources(checkedSources, {
          minReliability: 0.2, // 降低阈值以包含更多源
          maxSources: 12,
          preferFastSources: checkStrategy === 'fast',
          includePartial: true
        });

        if (optimalSources.length > 0) {
          enabledSources = optimalSources;
          console.log(`选择了 ${optimalSources.length} 个优质搜索源`);
        } else {
          console.warn('没有找到合适的搜索源，使用原始配置');
          showToast('搜索源质量检查完成，将显示所有结果', 'info');
        }
        
        // 记录检查结果到分析系统
        if (authManager.isAuthenticated()) {
          await this.recordSourceCheckAnalytics(checkedSources, optimalSources);
        }
        
      } catch (error) {
        console.error('搜索源状态检查失败:', error);
        showToast('搜索源检查遇到问题，使用所有配置的源', 'warning');
      }
    }

    // 构建搜索结果
    const results = this.buildSearchResultsFromSources(keyword, enabledSources);

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

  /**
   * 从指定的搜索源构建结果 - 增强版本
   */
  buildSearchResultsFromSources(keyword, sources) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    
    return sources.map(source => ({
      id: `result_${keyword}_${source.id}_${timestamp}`,
      title: source.name,
      subtitle: source.subtitle,
      url: source.urlTemplate.replace('{keyword}', encodedKeyword),
      icon: source.icon,
      keyword: keyword,
      timestamp: timestamp,
      source: source.id,
      
      // 增强信息
      available: source.available,
      status: source.status,
      responseTime: source.responseTime,
      lastChecked: source.lastChecked,
      reliability: source.reliability,
      
      // 质量指标
      qualityScore: this.calculateSourceQualityScore(source),
      
      // 推荐级别
      recommendLevel: this.calculateRecommendLevel(source)
    }));
  }

  /**
   * 计算搜索源质量评分
   */
  calculateSourceQualityScore(source) {
    let score = 0;
    
    // 可用性评分 (40%)
    if (source.available) {
      score += 40;
      if (source.status === 'online') score += 10;
    }
    
    // 可靠性评分 (30%)
    if (source.reliability !== undefined) {
      score += source.reliability * 30;
    } else {
      score += 15; // 默认中等可靠性
    }
    
    // 响应时间评分 (20%)
    if (source.responseTime) {
      if (source.responseTime < 2000) score += 20;
      else if (source.responseTime < 5000) score += 15;
      else if (source.responseTime < 8000) score += 10;
      else score += 5;
    } else {
      score += 10; // 默认中等速度
    }
    
    // 内置源加分 (10%)
    if (source.isBuiltin) {
      score += 10;
    } else {
      score += 5; // 自定义源稍低评分
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * 计算推荐级别
   */
  calculateRecommendLevel(source) {
    const qualityScore = this.calculateSourceQualityScore(source);
    
    if (qualityScore >= 85) return 'excellent';
    if (qualityScore >= 70) return 'good';
    if (qualityScore >= 50) return 'fair';
    return 'poor';
  }

  /**
   * 记录搜索源检查分析数据
   */
  async recordSourceCheckAnalytics(checkedSources, selectedSources) {
    try {
      const analytics = {
        totalChecked: checkedSources.length,
        availableSources: checkedSources.filter(s => s.available).length,
        selectedSources: selectedSources.length,
        avgReliability: this.calculateAverageReliability(checkedSources),
        avgResponseTime: this.calculateAverageResponseTime(checkedSources),
        statusDistribution: this.getStatusDistribution(checkedSources),
        timestamp: Date.now()
      };
      
      await apiService.recordAction('source_availability_check', analytics);
      
      // 如果有API支持，也记录到后端
      if (apiService.recordSourceStatusCheck) {
        await apiService.recordSourceStatusCheck(checkedSources);
      }
      
    } catch (error) {
      console.error('记录搜索源分析数据失败:', error);
    }
  }

  /**
   * 计算平均可靠性
   */
  calculateAverageReliability(sources) {
    const reliableSources = sources.filter(s => s.reliability !== undefined);
    if (reliableSources.length === 0) return 0;
    
    return reliableSources.reduce((sum, s) => sum + s.reliability, 0) / reliableSources.length;
  }

  /**
   * 计算平均响应时间
   */
  calculateAverageResponseTime(sources) {
    const sourcesWithTime = sources.filter(s => s.responseTime);
    if (sourcesWithTime.length === 0) return 0;
    
    return sourcesWithTime.reduce((sum, s) => sum + s.responseTime, 0) / sourcesWithTime.length;
  }

  /**
   * 获取状态分布
   */
  getStatusDistribution(sources) {
    const distribution = {};
    sources.forEach(source => {
      const status = source.status || 'unknown';
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  /**
   * 获取检查器统计信息
   */
  getSourceCheckerStats() {
    return this.sourceChecker.getStatistics();
  }

  /**
   * 清除所有缓存
   */
  clearCache() {
    this.searchCache.clear();
    this.sourceChecker.clearCache();
    console.log('所有缓存已清理');
  }

  /**
   * 手动触发单个搜索源的详细检查
   */
  async performDetailedSourceCheck(sourceId) {
    try {
      const allSources = await this.getEnabledSearchSources();
      const source = allSources.find(s => s.id === sourceId);
      
      if (!source) {
        throw new Error('找不到指定的搜索源');
      }
      
      const result = await this.sourceChecker.checkSingleSource(source, {
        timeout: 15000,
        useCache: false,
        strategy: 'comprehensive'
      });
      
      showToast(`${source.name} 详细检查完成`, 'success');
      return result;
      
    } catch (error) {
      console.error('详细搜索源检查失败:', error);
      showToast('详细检查失败: ' + error.message, 'error');
      throw error;
    }
  }

  // 以下是原有方法的保留，保持向后兼容性
  
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
  
  clearUserSettingsCache() {
    this.userSettings = null;
    console.log('用户设置缓存已清除');
  }
  
  async getEnabledSearchSources() {
    try {
      if (!authManager.isAuthenticated()) {
        const defaultSources = ['javbus', 'javdb', 'javlibrary'];
        return APP_CONSTANTS.SEARCH_SOURCES.filter(
          source => defaultSources.includes(source.id)
        );
      }

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
      
      const filteredSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => validSources.includes(source.id)
      );

      return filteredSources;
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      const defaultSources = ['javbus', 'javdb', 'javlibrary'];
      return APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => defaultSources.includes(source.id)
      );
    }
  }

  getCachedResults(keyword) {
    const cached = this.searchCache.get(keyword);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
      return cached.results;
    }
    
    if (cached) {
      this.searchCache.delete(keyword);
    }
    
    return null;
  }

  cacheResults(keyword, results) {
    if (this.searchCache.size >= 100) {
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    
    this.searchCache.set(keyword, {
      results,
      timestamp: Date.now()
    });
  }

  async saveToHistory(keyword) {
    try {
      await apiService.saveSearchHistory(keyword, 'manual');
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }

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

  getCacheStats() {
    const searchStats = {
      size: this.searchCache.size,
      items: []
    };
    
    for (const [keyword, data] of this.searchCache) {
      searchStats.items.push({
        keyword,
        timestamp: data.timestamp,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > this.cacheExpiration
      });
    }
    
    const sourceCheckerStats = this.getSourceCheckerStats();
    
    return {
      searchCache: searchStats,
      sourceChecker: sourceCheckerStats
    };
  }

  async warmupCache(keywords = []) {
    for (const keyword of keywords) {
      try {
        const sources = await this.getEnabledSearchSources();
        const results = this.buildSearchResultsFromSources(keyword, sources);
        this.cacheResults(keyword, results);
        console.log(`缓存预热: ${keyword}`);
      } catch (error) {
        console.error(`缓存预热失败 ${keyword}:`, error);
      }
    }
  }
}

// 搜索历史管理器保持不变
export class SearchHistoryManager {
  constructor() {
    this.maxHistorySize = APP_CONSTANTS.LIMITS.MAX_HISTORY;
  }

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

  async getHistory() {
    try {
      return await apiService.getSearchHistory();
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  async deleteHistoryItem(historyId) {
    try {
      await apiService.deleteSearchHistory(historyId);
      return true;
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      return false;
    }
  }

  async clearAllHistory() {
    try {
      await apiService.clearAllSearchHistory();
      return true;
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      return false;
    }
  }

  async getSearchStats() {
    try {
      return await apiService.getSearchStats();
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
  }

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

  sortHistoryByTime(history, descending = true) {
    return history.sort((a, b) => {
      const timeA = a.timestamp || a.createdAt || 0;
      const timeB = b.timestamp || b.createdAt || 0;
      return descending ? timeB - timeA : timeA - timeB;
    });
  }

  sortHistoryByFrequency(history, descending = true) {
    return history.sort((a, b) => {
      const countA = a.count || 1;
      const countB = b.count || 1;
      return descending ? countB - countA : countA - countB;
    });
  }
}

export const searchService = new SearchService();
export const searchHistoryManager = new SearchHistoryManager();
export default searchService;