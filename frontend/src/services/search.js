// 搜索服务模块 - 支持搜索源状态检查功能
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';
import authManager from './auth.js';

class SearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION;
    this.userSettings = null; // 缓存用户设置
    
    // 🆕 搜索源状态检查相关
    this.statusCache = new Map();
    this.statusCheckInProgress = new Set();
    this.statusCheckTimeout = APP_CONSTANTS.API.SOURCE_CHECK_TIMEOUT;
    this.statusCacheDuration = APP_CONSTANTS.API.SOURCE_STATUS_CACHE_DURATION;
  }

  // 执行搜索 - 支持搜索源状态检查
  async performSearch(keyword, options = {}) {
    // 验证搜索关键词
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 从用户设置或选项获取配置
    let useCache = options.useCache;
    if (useCache === undefined) {
      try {
        if (authManager.isAuthenticated()) {
          const userSettings = await this.getUserSettings();
          useCache = true; // 总是启用搜索结果缓存以提升性能
        } else {
          useCache = true; // 未登录用户也启用缓存
        }
      } catch (error) {
        console.warn('获取缓存设置失败，使用默认值:', error);
        useCache = true; // 默认启用缓存
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

    // 🆕 获取用户的搜索源状态检查设置
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
  
  // 清除用户设置缓存（当用户更改设置后调用）
  clearUserSettingsCache() {
    this.userSettings = null;
    console.log('用户设置缓存已清除');
  }
  
  // 获取用户启用的搜索源
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

  // 🆕 构建搜索结果 - 支持搜索源状态检查
  async buildSearchResults(keyword, options = {}) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    const { checkStatus = false, userSettings = null } = options;
    
    try {
      // 获取用户启用的搜索源
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log(`使用 ${enabledSources.length} 个搜索源:`, enabledSources.map(s => s.name));
      
      // 🆕 如果启用了状态检查，先检查搜索源状态
      let sourcesWithStatus = enabledSources;
      if (checkStatus && userSettings) {
        console.log('开始检查搜索源状态...');
        sourcesWithStatus = await this.checkSourcesStatus(enabledSources, userSettings);
        
        // 根据用户设置决定是否跳过不可用的搜索源
        if (userSettings.skipUnavailableSources) {
          const availableSources = sourcesWithStatus.filter(
            source => source.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ||
                     source.status === APP_CONSTANTS.SOURCE_STATUS.UNKNOWN
          );
          console.log(`跳过不可用搜索源，剩余 ${availableSources.length} 个可用源`);
          sourcesWithStatus = availableSources;
        }
      }
      
      return sourcesWithStatus.map(source => {
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
        
        // 🆕 如果进行了状态检查，添加状态信息
        if (checkStatus && source.status) {
          result.status = source.status;
          result.statusText = this.getStatusText(source.status);
          result.lastChecked = source.lastChecked;
        }
        
        return result;
      });
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      // 增强错误处理：如果获取搜索源失败，使用默认源
      const defaultSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => ['javbus', 'javdb', 'javlibrary'].includes(source.id)
      );
      
      return defaultSources.map(source => ({
        id: `result_${keyword}_${source.id}_${timestamp}`,
        title: source.name,
        subtitle: source.subtitle,
        url: source.urlTemplate.replace('{keyword}', encodedKeyword),
        icon: source.icon,
        keyword: keyword,
        timestamp: timestamp,
        source: source.id
      }));
    }
  }

  // 🆕 检查搜索源状态
  async checkSourcesStatus(sources, userSettings) {
    const timeout = (userSettings.sourceStatusCheckTimeout || 8) * 1000;
    const cacheDuration = (userSettings.sourceStatusCacheDuration || 300) * 1000;
    const concurrentChecks = APP_CONSTANTS.SOURCE_STATUS_CHECK.CONCURRENT_CHECKS;
    
    console.log(`开始检查 ${sources.length} 个搜索源状态，超时时间: ${timeout}ms, 缓存时间: ${cacheDuration}ms`);
    
    const sourcesWithStatus = [];
    
    // 分批并发检查
    for (let i = 0; i < sources.length; i += concurrentChecks) {
      const batch = sources.slice(i, i + concurrentChecks);
      const batchPromises = batch.map(source => this.checkSingleSourceStatus(source, timeout, cacheDuration));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const source = batch[index];
          if (result.status === 'fulfilled') {
            sourcesWithStatus.push({ ...source, ...result.value });
          } else {
            console.warn(`检查搜索源 ${source.name} 状态失败:`, result.reason);
            sourcesWithStatus.push({
              ...source,
              status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
              lastChecked: Date.now(),
              error: result.reason?.message || '检查失败'
            });
          }
        });
      } catch (error) {
        console.error('批量检查搜索源状态失败:', error);
        // 添加未检查的源
        batch.forEach(source => {
          sourcesWithStatus.push({
            ...source,
            status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
            lastChecked: Date.now(),
            error: '批量检查失败'
          });
        });
      }
    }
    
    console.log('搜索源状态检查完成');
    return sourcesWithStatus;
  }

  // 🆕 检查单个搜索源状态
  async checkSingleSourceStatus(source, timeout, cacheDuration) {
    const cacheKey = `status_${source.id}`;
    const now = Date.now();
    
    // 检查缓存
    if (this.statusCache.has(cacheKey)) {
      const cached = this.statusCache.get(cacheKey);
      if (now - cached.timestamp < cacheDuration) {
        console.log(`使用缓存状态: ${source.name} - ${cached.status}`);
        return {
          status: cached.status,
          lastChecked: cached.timestamp,
          fromCache: true
        };
      } else {
        // 缓存过期
        this.statusCache.delete(cacheKey);
      }
    }
    
    // 防止重复检查
    if (this.statusCheckInProgress.has(source.id)) {
      console.log(`跳过重复检查: ${source.name}`);
      return {
        status: APP_CONSTANTS.SOURCE_STATUS.CHECKING,
        lastChecked: now
      };
    }
    
    this.statusCheckInProgress.add(source.id);
    
    try {
      // 构造测试URL（使用通用关键词）
      const testUrl = source.urlTemplate.replace('{keyword}', 'test');
      
      console.log(`检查搜索源状态: ${source.name} - ${testUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(testUrl, {
          method: 'HEAD', // 使用HEAD方法减少带宽
          signal: controller.signal,
          headers: {
            'User-Agent': APP_CONSTANTS.SOURCE_STATUS_CHECK.USER_AGENT
          },
          redirect: 'follow'
        });
        
        clearTimeout(timeoutId);
        
        const status = response.ok ? 
          APP_CONSTANTS.SOURCE_STATUS.AVAILABLE : 
          APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE;
        
        const statusInfo = {
          status,
          lastChecked: now,
          httpStatus: response.status,
          responseTime: Date.now() - now
        };
        
        // 缓存结果
        this.statusCache.set(cacheKey, {
          ...statusInfo,
          timestamp: now
        });
        
        console.log(`搜索源状态检查完成: ${source.name} - ${status} (${response.status})`);
        
        return statusInfo;
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn(`搜索源状态检查超时: ${source.name}`);
          const statusInfo = {
            status: APP_CONSTANTS.SOURCE_STATUS.TIMEOUT,
            lastChecked: now,
            error: '检查超时'
          };
          
          // 缓存超时结果（较短时间）
          this.statusCache.set(cacheKey, {
            ...statusInfo,
            timestamp: now
          });
          
          return statusInfo;
        } else {
          throw fetchError;
        }
      }
      
    } catch (error) {
      console.error(`检查搜索源 ${source.name} 状态失败:`, error);
      
      const statusInfo = {
        status: APP_CONSTANTS.SOURCE_STATUS.ERROR,
        lastChecked: now,
        error: error.message
      };
      
      // 缓存错误结果（较短时间）
      this.statusCache.set(cacheKey, {
        ...statusInfo,
        timestamp: now
      });
      
      return statusInfo;
      
    } finally {
      this.statusCheckInProgress.delete(source.id);
    }
  }

  // 🆕 获取状态文本描述
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

  // 🆕 手动检查所有搜索源状态（用于测试功能）
  async checkAllSourcesStatus() {
    try {
      const userSettings = await this.getUserSettings();
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log('手动检查所有搜索源状态...');
      
      // 清除缓存以强制重新检查
      this.statusCache.clear();
      
      const sourcesWithStatus = await this.checkSourcesStatus(enabledSources, userSettings);
      
      // 返回状态摘要
      const statusSummary = {
        total: sourcesWithStatus.length,
        available: sourcesWithStatus.filter(s => s.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE).length,
        unavailable: sourcesWithStatus.filter(s => s.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE).length,
        timeout: sourcesWithStatus.filter(s => s.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT).length,
        error: sourcesWithStatus.filter(s => s.status === APP_CONSTANTS.SOURCE_STATUS.ERROR).length,
        sources: sourcesWithStatus
      };
      
      console.log('所有搜索源状态检查完成:', statusSummary);
      
      return statusSummary;
    } catch (error) {
      console.error('检查所有搜索源状态失败:', error);
      throw error;
    }
  }

  // 🆕 清除搜索源状态缓存
  clearSourceStatusCache() {
    this.statusCache.clear();
    console.log('搜索源状态缓存已清除');
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

  // 🆕 清理所有缓存
  clearAllCache() {
    this.searchCache.clear();
    this.statusCache.clear();
    console.log('所有缓存已清理');
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      searchCache: {
        size: this.searchCache.size,
        items: []
      },
      statusCache: {
        size: this.statusCache.size,
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
    
    // 搜索源状态缓存统计
    for (const [sourceId, data] of this.statusCache) {
      stats.statusCache.items.push({
        sourceId,
        status: data.status,
        timestamp: data.timestamp,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > this.statusCacheDuration
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