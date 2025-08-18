// 搜索服务模块 - 修复版本
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
  }

  // 🔧 修复：执行搜索 - 从用户设置获取缓存配置
  async performSearch(keyword, options = {}) {
    // 验证搜索关键词
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 🔧 修复：从用户设置获取缓存配置而不是前端元素
    let useCache = options.useCache;
    if (useCache === undefined) {
      // 如果没有明确指定，从用户设置获取
      try {
        if (authManager.isAuthenticated()) {
          const userSettings = await this.getUserSettings();
          // 注意：由于前端已移除缓存设置，这里总是默认启用缓存
          useCache = true; // 总是启用缓存以提升性能
        } else {
          useCache = true; // 未登录用户也启用缓存
        }
      } catch (error) {
        console.warn('获取缓存设置失败，使用默认值:', error);
        useCache = true; // 默认启用缓存
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

    // 构建搜索结果（现在会根据用户设置过滤搜索源）
    const results = await this.buildSearchResults(keyword);

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
  
  // 🔧 修复：统一的用户设置获取方法
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
  
  // 🔧 新增：清除用户设置缓存（当用户更改设置后调用）
  clearUserSettingsCache() {
    this.userSettings = null;
    console.log('用户设置缓存已清除');
  }
  
  // 🔧 修复：获取用户设置的搜索源
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
        // 如果获取失败，使用默认搜索源
        const defaultSources = ['javbus', 'javdb', 'javlibrary'];
        return APP_CONSTANTS.SEARCH_SOURCES.filter(
          source => defaultSources.includes(source.id)
        );
      }

      const enabledSources = userSettings.searchSources || ['javbus', 'javdb', 'javlibrary'];
      
      // 🔧 新增：验证搜索源ID的有效性
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
      
      // 过滤出用户启用的搜索源
      const filteredSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => validSources.includes(source.id)
      );

      return filteredSources;
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      // 🔧 增强错误处理：出错时返回默认搜索源
      const defaultSources = ['javbus', 'javdb', 'javlibrary'];
      return APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => defaultSources.includes(source.id)
      );
    }
  }

  // 🔧 修复：构建搜索结果 - 使用用户选择的搜索源
  async buildSearchResults(keyword) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    
    try {
      // 获取用户启用的搜索源
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log(`使用 ${enabledSources.length} 个搜索源:`, enabledSources.map(s => s.name));
      
      return enabledSources.map(source => ({
        id: `result_${keyword}_${source.id}_${timestamp}`,
        title: source.name,
        subtitle: source.subtitle,
        url: source.urlTemplate.replace('{keyword}', encodedKeyword),
        icon: source.icon,
        keyword: keyword,
        timestamp: timestamp,
        source: source.id
      }));
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      // 🔧 增强错误处理：如果获取搜索源失败，使用默认源
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

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      size: this.searchCache.size,
      items: []
    };
    
    for (const [keyword, data] of this.searchCache) {
      stats.items.push({
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