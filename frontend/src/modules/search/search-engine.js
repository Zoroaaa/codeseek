import { APP_CONSTANTS } from '../../shared/constants.js';
import { StringUtils } from '../utils/string.js';
import { generateId } from '../utils/common.js';

/**
 * 搜索引擎模块
 */
export class SearchEngine {
  constructor() {
    this.sources = APP_CONSTANTS.SEARCH.SOURCES;
    this.cache = new Map();
    this.cacheExpiry = APP_CONSTANTS.API.CACHE_DURATION;
  }

  // 验证搜索关键词
  validateKeyword(keyword) {
    if (!keyword || typeof keyword !== 'string') {
      return { valid: false, message: '搜索关键词不能为空' };
    }

    const trimmed = keyword.trim();
    
    if (trimmed.length < APP_CONSTANTS.SEARCH.MIN_KEYWORD_LENGTH) {
      return { valid: false, message: `搜索关键词至少${APP_CONSTANTS.SEARCH.MIN_KEYWORD_LENGTH}个字符` };
    }

    if (trimmed.length > APP_CONSTANTS.SEARCH.MAX_KEYWORD_LENGTH) {
      return { valid: false, message: `搜索关键词最多${APP_CONSTANTS.SEARCH.MAX_KEYWORD_LENGTH}个字符` };
    }

    if (/[<>]/.test(trimmed)) {
      return { valid: false, message: '搜索关键词包含非法字符' };
    }

    return { valid: true, keyword: trimmed };
  }

  // 构建搜索结果
  buildSearchResults(keyword) {
    const validation = this.validateKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const validKeyword = validation.keyword;
    const encodedKeyword = encodeURIComponent(validKeyword);
    const timestamp = Date.now();
    
    return Object.entries(this.sources).map(([key, source]) => ({
      id: `result_${validKeyword}_${key}_${timestamp}`,
      title: source.name,
      subtitle: this.getSourceDescription(key),
      url: this.buildSourceUrl(key, encodedKeyword),
      icon: source.icon,
      keyword: validKeyword,
      timestamp: timestamp,
      source: key
    }));
  }

  // 获取搜索源描述
  getSourceDescription(sourceKey) {
    const descriptions = {
      javbus: '番号+磁力一体站，信息完善',
      javdb: '极简风格番号资料站，轻量快速',
      javlibrary: '评论活跃，女优搜索详尽',
      av01: '快速预览站点，封面大图清晰',
      missav: '中文界面，封面高清，信息丰富',
      btsow: '中文磁力搜索引擎，番号资源丰富'
    };
    return descriptions[sourceKey] || '专业搜索资源';
  }

  // 构建搜索源URL
  buildSourceUrl(sourceKey, encodedKeyword) {
    const urlTemplates = {
      javbus: `https://www.javbus.com/search/${encodedKeyword}`,
      javdb: `https://javdb.com/search?q=${encodedKeyword}&f=all`,
      javlibrary: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodedKeyword}`,
      av01: `https://av01.tv/search?keyword=${encodedKeyword}`,
      missav: `https://missav.com/search/${encodedKeyword}`,
      btsow: `https://btsow.com/search/${encodedKeyword}`
    };
    
    return urlTemplates[sourceKey] || '';
  }

  // 缓存管理
  getCachedResults(keyword) {
    const cacheKey = this.getCacheKey(keyword);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.results;
    }
    
    return null;
  }

  cacheResults(keyword, results) {
    const cacheKey = this.getCacheKey(keyword);
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    // 清理过期缓存
    this.cleanExpiredCache();
  }

  getCacheKey(keyword) {
    return `search_${keyword.toLowerCase().trim()}`;
  }

  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  // 搜索建议
  generateSuggestions(history, query) {
    if (!query || !Array.isArray(history)) return [];

    return history
      .filter(item => {
        if (!item || !item.keyword) return false;
        return item.keyword.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, APP_CONSTANTS.SEARCH.MAX_SUGGESTIONS)
      .map(item => ({
        text: item.keyword,
        type: 'history',
        timestamp: item.timestamp
      }));
  }

  // 搜索统计
  analyzeSearchPatterns(history) {
    if (!Array.isArray(history)) return {};

    const patterns = {
      totalSearches: history.length,
      uniqueKeywords: new Set(history.map(h => h.keyword)).size,
      topKeywords: this.getTopKeywords(history),
      searchFrequency: this.getSearchFrequency(history),
      sourcesUsed: this.getSourcesUsage(history)
    };

    return patterns;
  }

  getTopKeywords(history, limit = 10) {
    const keywordCount = {};
    
    history.forEach(item => {
      if (item.keyword) {
        keywordCount[item.keyword] = (keywordCount[item.keyword] || 0) + 1;
      }
    });

    return Object.entries(keywordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  getSearchFrequency(history) {
    const frequency = {};
    const now = new Date();
    
    history.forEach(item => {
      const date = new Date(item.timestamp);
      const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 7) frequency.thisWeek = (frequency.thisWeek || 0) + 1;
      if (daysDiff < 30) frequency.thisMonth = (frequency.thisMonth || 0) + 1;
      if (daysDiff < 365) frequency.thisYear = (frequency.thisYear || 0) + 1;
    });

    return frequency;
  }

  getSourcesUsage(history) {
    const sourceCount = {};
    
    history.forEach(item => {
      if (item.source) {
        sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
      }
    });

    return sourceCount;
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      size: this.cache.size,
      totalSize: 0,
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      const entrySize = JSON.stringify(value).length;
      stats.totalSize += entrySize;
      stats.entries.push({
        key,
        size: entrySize,
        timestamp: value.timestamp,
        age: Date.now() - value.timestamp
      });
    }

    return stats;
  }
}

// 创建全局实例
export const searchEngine = new SearchEngine();