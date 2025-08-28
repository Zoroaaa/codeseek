// 搜索服务模块 - 添加搜索源状态检查功能
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
    this.userSettings = null;
    // 新增：搜索源状态缓存
    this.sourceStatusCache = new Map();
    this.statusCacheExpiration = 300000; // 5分钟缓存
  }

  // 🆕 新增：检查搜索源可用性
  async checkSourcesAvailability(sources, options = {}) {
    const { 
      timeout = 8000, 
      showProgress = true,
      useCache = true 
    } = options;
    
    if (showProgress) {
      showToast('正在检查搜索源可用性...', 'info', 2000);
    }
    
    const checkPromises = sources.map(async (source) => {
      // 检查缓存
      if (useCache) {
        const cached = this.getSourceStatusFromCache(source.id);
        if (cached) {
          return { ...source, ...cached };
        }
      }
      
      const startTime = Date.now();
      
      try {
        const isAvailable = await this.testSourceConnection(source, timeout);
        const responseTime = Date.now() - startTime;
        
        const result = {
          ...source,
          available: isAvailable,
          status: isAvailable ? 'online' : 'offline',
          responseTime,
          lastChecked: Date.now()
        };
        
        // 缓存结果
        if (useCache) {
          this.cacheSourceStatus(source.id, {
            available: isAvailable,
            status: result.status,
            responseTime,
            lastChecked: result.lastChecked
          });
        }
        
        return result;
      } catch (error) {
        console.warn(`检查搜索源 ${source.name} 失败:`, error);
        
        const result = {
          ...source,
          available: false,
          status: 'error',
          error: error.message,
          responseTime: Date.now() - startTime,
          lastChecked: Date.now()
        };
        
        // 缓存错误结果（但时间更短）
        if (useCache) {
          this.cacheSourceStatus(source.id, {
            available: false,
            status: 'error',
            error: error.message,
            lastChecked: result.lastChecked
          }, 60000); // 1分钟缓存
        }
        
        return result;
      }
    });
    
    const results = await Promise.allSettled(checkPromises);
    const checkedSources = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          ...sources[index],
          available: false,
          status: 'check_failed',
          error: result.reason?.message || '检查失败'
        };
      }
    });
    
    const availableCount = checkedSources.filter(s => s.available).length;
    const totalCount = checkedSources.length;
    
    if (showProgress) {
      if (availableCount === totalCount) {
        showToast(`所有 ${totalCount} 个搜索源都可用`, 'success');
      } else if (availableCount === 0) {
        showToast('所有搜索源都不可用，将显示全部源', 'warning');
      } else {
        showToast(`${availableCount}/${totalCount} 个搜索源可用`, 'info');
      }
    }
    
    return checkedSources;
  }
  
  // 🆕 新增：测试单个搜索源连接
  async testSourceConnection(source, timeout = 8000) {
    const baseUrl = this.extractBaseUrl(source.urlTemplate);
    
    // 方法1：尝试加载网站图标
    const faviconTest = this.testFaviconLoad(baseUrl, timeout);
    
    // 方法2：尝试使用img元素检查
    const imageTest = this.testImageLoad(baseUrl + '/favicon.ico', timeout);
    
    // 方法3：对于支持的网站，尝试JSONP或其他方式
    const customTest = this.testCustomMethod(source, timeout);
    
    try {
      // 并行执行多种检查方法，任意一个成功就认为可用
      const results = await Promise.allSettled([
        faviconTest,
        imageTest,
        customTest
      ]);
      
      // 如果任何一个方法成功，就认为网站可用
      return results.some(result => 
        result.status === 'fulfilled' && result.value === true
      );
    } catch (error) {
      console.warn(`测试搜索源连接失败 ${source.name}:`, error);
      return false;
    }
  }
  
  // 🆕 新增：通过favicon加载测试网站可用性
  testFaviconLoad(baseUrl, timeout) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        resolve(false);
      }, timeout);
      
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      
      // 尝试加载网站的favicon
      img.src = baseUrl + '/favicon.ico?_t=' + Date.now();
    });
  }
  
  // 🆕 新增：通过图片加载测试
  testImageLoad(imageUrl, timeout) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        resolve(false);
      }, timeout);
      
      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };
      
      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      
      img.src = imageUrl + '?_t=' + Date.now();
    });
  }
  
  // 🆕 新增：针对特定网站的自定义检查方法
  async testCustomMethod(source, timeout) {
    // 对于一些知名网站，可以使用特殊的检查方法
    const hostname = this.extractHostname(source.urlTemplate);
    
    switch (hostname) {
      case 'javbus.com':
      case 'www.javbus.com':
        // JavBus 特殊检查
        return this.testJavBusAvailability(timeout);
      case 'javdb.com':
        // JavDB 特殊检查
        return this.testJavDBAvailability(timeout);
      default:
        // 默认方法：尝试fetch with no-cors
        return this.testNoCorsFetch(source.urlTemplate.replace('{keyword}', 'test'), timeout);
    }
  }
  
  // 🆕 新增：no-cors fetch测试
  async testNoCorsFetch(url, timeout) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      // 如果没有抛出异常，认为可以访问
      return true;
    } catch (error) {
      if (error.name === 'AbortError') {
        return false; // 超时
      }
      // 其他错误可能是网络问题，但不一定意味着网站不可用
      return false;
    }
  }
  
  // 🆕 新增：JavBus 特殊检查方法
  async testJavBusAvailability(timeout) {
    // 可以尝试加载JavBus的特定资源
    return this.testImageLoad('https://www.javbus.com/images/logo.png', timeout);
  }
  
  // 🆕 新增：JavDB 特殊检查方法
  async testJavDBAvailability(timeout) {
    // 可以尝试加载JavDB的特定资源
    return this.testImageLoad('https://javdb.com/favicon.ico', timeout);
  }
  
  // 🆕 新增：从URL模板提取基础URL
  extractBaseUrl(urlTemplate) {
    try {
      const url = new URL(urlTemplate.replace('{keyword}', 'test'));
      return `${url.protocol}//${url.hostname}`;
    } catch (error) {
      console.error('提取基础URL失败:', error);
      return '';
    }
  }
  
  // 🆕 新增：从URL模板提取主机名
  extractHostname(urlTemplate) {
    try {
      const url = new URL(urlTemplate.replace('{keyword}', 'test'));
      return url.hostname;
    } catch (error) {
      console.error('提取主机名失败:', error);
      return '';
    }
  }
  
  // 🆕 新增：缓存搜索源状态
  cacheSourceStatus(sourceId, status, expiration = this.statusCacheExpiration) {
    this.sourceStatusCache.set(sourceId, {
      ...status,
      timestamp: Date.now(),
      expiration
    });
  }
  
  // 🆕 新增：从缓存获取搜索源状态
  getSourceStatusFromCache(sourceId) {
    const cached = this.sourceStatusCache.get(sourceId);
    if (cached && Date.now() - cached.timestamp < cached.expiration) {
      const { timestamp, expiration, ...status } = cached;
      return status;
    }
    
    // 清理过期缓存
    if (cached) {
      this.sourceStatusCache.delete(sourceId);
    }
    
    return null;
  }
  
  // 🆕 新增：清理状态缓存
  clearStatusCache() {
    this.sourceStatusCache.clear();
    console.log('搜索源状态缓存已清理');
  }

  // 🔧 修改：执行搜索 - 添加状态检查选项
  async performSearch(keyword, options = {}) {
    // 验证搜索关键词
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 获取用户设置
    let useCache = options.useCache;
    let checkSourceStatus = options.checkSourceStatus;
    
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
        } else {
          useCache = true;
          checkSourceStatus = false; // 未登录用户默认不检查
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

    // 🔧 修改：获取搜索源并检查状态
    let enabledSources = await this.getEnabledSearchSources();
    
    if (checkSourceStatus && enabledSources.length > 0) {
      try {
        const checkedSources = await this.checkSourcesAvailability(enabledSources, {
          showProgress: true,
          useCache: true
        });
        
        // 只使用可用的搜索源，但如果全部不可用则使用全部
        const availableSources = checkedSources.filter(s => s.available);
        if (availableSources.length > 0) {
          enabledSources = availableSources;
        } else {
          console.warn('所有搜索源都不可用，将使用全部源');
          showToast('所有搜索源检查都失败，将显示全部结果', 'warning');
        }
      } catch (error) {
        console.error('检查搜索源状态失败:', error);
        showToast('搜索源状态检查失败，使用全部源', 'warning');
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
  
  // 🔧 新增：从指定的搜索源构建结果
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
      // 新增：包含可用性信息
      available: source.available,
      status: source.status,
      responseTime: source.responseTime,
      lastChecked: source.lastChecked
    }));
  }

  // 原有方法保持不变...
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

  // 原有的其他方法...
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

  clearCache() {
    this.searchCache.clear();
    this.clearStatusCache();
    console.log('所有缓存已清理');
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
    
    const statusStats = {
      size: this.sourceStatusCache.size,
      items: []
    };
    
    for (const [sourceId, data] of this.sourceStatusCache) {
      statusStats.items.push({
        sourceId,
        status: data.status,
        available: data.available,
        timestamp: data.timestamp,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > data.expiration
      });
    }
    
    return {
      searchCache: searchStats,
      statusCache: statusStats
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

// 搜索历史管理器保持不变...
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