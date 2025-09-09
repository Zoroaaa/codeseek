// src/services/detail-api.js - 修复版本：匹配后端API响应结构
import apiService from './api.js';
import authManager from './auth.js';

class DetailAPIService {
  constructor() {
    this.requestCache = new Map();
    this.maxCacheSize = 100;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
  }

  /**
   * 提取单个搜索结果的详情信息
   * @param {Object} searchResult - 搜索结果对象
   * @param {Object} options - 提取选项
   * @returns {Promise<Object>} 详情信息
   */
  async extractSingleDetail(searchResult, options = {}) {
    if (!searchResult || !searchResult.url) {
      throw new Error('搜索结果数据不完整');
    }

    try {
      // 检查本地缓存
      const cacheKey = this.generateCacheKey(searchResult.url);
      if (options.useLocalCache !== false) {
        const cached = this.getFromLocalCache(cacheKey);
        if (cached) {
          console.log(`本地缓存命中: ${searchResult.title}`);
          return cached;
        }
      }

      const requestData = {
        searchResult,
        options: {
          enableCache: options.enableCache !== false,
          timeout: options.timeout || 15000,
          enableRetry: options.enableRetry !== false
        }
      };

      console.log(`开始提取详情: ${searchResult.title}`);

      const response = await apiService.request('/api/detail/extract-single', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (!response.success) {
        throw new Error(response.message || '详情提取失败');
      }

      // 修复：正确获取详情信息
      const detailInfo = response.detailInfo || response.data?.detailInfo;
      
      if (!detailInfo) {
        throw new Error('服务器返回的详情信息为空');
      }

      // 检查提取状态
      if (detailInfo.extractionStatus === 'error') {
        throw new Error(detailInfo.extractionError || '详情提取失败');
      }

      // 组合完整结果
      const result = {
        ...searchResult,
        ...detailInfo,
        // 保留重要的元数据
        extractionTime: response.extractionTime || detailInfo.extractionTime || 0,
        fromCache: response.fromCache || detailInfo.extractionStatus === 'cached',
        extractedAt: detailInfo.extractedAt || Date.now()
      };

      // 本地缓存成功的结果
      if (detailInfo.extractionStatus === 'success' && options.useLocalCache !== false) {
        this.setToLocalCache(cacheKey, result);
      }

      console.log(`详情提取完成: ${searchResult.title} (状态: ${detailInfo.extractionStatus})`);
      return result;

    } catch (error) {
      console.error(`详情提取失败 [${searchResult.title}]:`, error);
      
      // 返回带错误信息的基础结果，而不是抛出异常
      return {
        ...searchResult,
        extractionStatus: 'error',
        extractionError: error.message,
        extractionTime: 0,
        extractedAt: Date.now(),
        fromCache: false
      };
    }
  }

  /**
   * 批量提取搜索结果的详情信息
   * @param {Array} searchResults - 搜索结果数组
   * @param {Object} options - 提取选项
   * @returns {Promise<Object>} 包含结果和统计的对象
   */
  async extractBatchDetails(searchResults, options = {}) {
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      throw new Error('搜索结果列表不能为空');
    }

    const maxBatchSize = 20;
    if (searchResults.length > maxBatchSize) {
      throw new Error(`批量处理数量不能超过 ${maxBatchSize} 个`);
    }

    try {
      const requestData = {
        searchResults,
        options: {
          enableCache: options.enableCache !== false,
          timeout: options.timeout || 15000,
          enableRetry: options.enableRetry !== false,
          onProgress: options.onProgress
        }
      };

      console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);

      const response = await apiService.request('/api/detail/extract-batch', {
        method: 'POST',
        body: JSON.stringify(requestData)
      });

      if (!response.success) {
        throw new Error(response.message || '批量详情提取失败');
      }

      // 修复：正确处理批量响应
      const results = response.results || response.data?.results || [];
      const stats = response.stats || response.data?.stats || {};

      // 本地缓存成功的结果
      if (options.useLocalCache !== false) {
        results.forEach(result => {
          if (result.extractionStatus === 'success') {
            const cacheKey = this.generateCacheKey(result.url || result.searchUrl);
            this.setToLocalCache(cacheKey, result);
          }
        });
      }

      console.log(`批量提取完成: ${results.length}/${searchResults.length}`);
      
      return {
        results,
        stats: {
          total: stats.total || results.length,
          successful: stats.successful || results.filter(r => r.extractionStatus === 'success').length,
          cached: stats.cached || results.filter(r => r.extractionStatus === 'cached').length,
          failed: stats.failed || results.filter(r => r.extractionStatus === 'error').length,
          totalTime: stats.totalTime || 0,
          averageTime: stats.averageTime || 0
        }
      };

    } catch (error) {
      console.error('批量详情提取失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情提取历史
   * @param {Object} options - 查询选项
   * @returns {Promise<Array>} 历史记录数组
   */
  async getExtractionHistory(options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.source) params.append('source', options.source);

      const endpoint = `/api/detail/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiService.request(endpoint);

      if (!response.success) {
        throw new Error(response.message || '获取历史失败');
      }

      return response.history || response.data?.history || [];

    } catch (error) {
      console.error('获取详情提取历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情缓存统计
   * @returns {Promise<Object>} 缓存统计信息
   */
  async getCacheStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await apiService.request('/api/detail/cache/stats');

      if (!response.success) {
        throw new Error(response.message || '获取缓存统计失败');
      }

      return response.stats || response.data?.stats || {};

    } catch (error) {
      console.error('获取缓存统计失败:', error);
      throw error;
    }
  }

  /**
   * 清理详情缓存
   * @param {string} operation - 清理操作类型 ('expired', 'all', 'lru')
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async clearCache(operation = 'expired', options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    if (!['expired', 'all', 'lru'].includes(operation)) {
      throw new Error('无效的清理操作类型');
    }

    try {
      const params = new URLSearchParams();
      params.append('operation', operation);
      
      if (operation === 'lru' && options.count) {
        params.append('count', options.count.toString());
      }

      const response = await apiService.request(`/api/detail/cache/clear?${params.toString()}`, {
        method: 'DELETE'
      });

      if (!response.success) {
        throw new Error(response.message || '清理缓存失败');
      }

      // 清理本地缓存
      if (operation === 'all') {
        this.clearLocalCache();
      }

      return {
        operation: response.operation || operation,
        cleanedCount: response.cleanedCount || 0,
        message: response.message || '缓存清理完成'
      };

    } catch (error) {
      console.error('清理缓存失败:', error);
      throw error;
    }
  }

  /**
   * 删除特定URL的详情缓存
   * @param {string} url - 要删除缓存的URL
   * @returns {Promise<boolean>} 是否删除成功
   */
  async deleteCache(url) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    if (!url) {
      throw new Error('URL参数不能为空');
    }

    try {
      const response = await apiService.request('/api/detail/cache/delete', {
        method: 'DELETE',
        body: JSON.stringify({ url })
      });

      if (!response.success) {
        // 对于404错误，认为删除成功
        if (response.status === 404) {
          console.log('缓存不存在，视为删除成功');
          return true;
        }
        throw new Error(response.message || '删除缓存失败');
      }

      // 删除本地缓存
      const cacheKey = this.generateCacheKey(url);
      this.removeFromLocalCache(cacheKey);

      return true;

    } catch (error) {
      console.error('删除缓存失败:', error);
      return false; // 返回false而不是抛出异常
    }
  }

  /**
   * 获取详情提取配置
   * @returns {Promise<Object>} 配置信息
   */
  async getConfig() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await apiService.request('/api/detail/config');

      if (!response.success) {
        throw new Error(response.message || '获取配置失败');
      }

      return response.config || response.data?.config || {};

    } catch (error) {
      console.error('获取详情提取配置失败:', error);
      // 返回默认配置而不是抛出异常
      return {
        enableDetailExtraction: true,
        autoExtractDetails: false,
        maxAutoExtractions: 5,
        extractionBatchSize: 3,
        extractionTimeout: 15000,
        enableRetry: true,
        enableCache: true,
        showScreenshots: true,
        showDownloadLinks: true,
        showMagnetLinks: true,
        showActressInfo: true,
        compactMode: false,
        enableImagePreview: true
      };
    }
  }

  /**
   * 更新详情提取配置
   * @param {Object} config - 配置更新
   * @returns {Promise<boolean>} 是否更新成功
   */
  async updateConfig(config) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    if (!config || typeof config !== 'object') {
      throw new Error('配置数据格式错误');
    }

    try {
      const response = await apiService.request('/api/detail/config', {
        method: 'PUT',
        body: JSON.stringify({ config })
      });

      if (!response.success) {
        throw new Error(response.message || '更新配置失败');
      }

      return true;

    } catch (error) {
      console.error('更新详情提取配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情提取统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await apiService.request('/api/detail/stats');

      if (!response.success) {
        throw new Error(response.message || '获取统计失败');
      }

      return this.formatStats(response.stats || response.data?.stats || {});

    } catch (error) {
      console.error('获取详情提取统计失败:', error);
      // 返回空统计而不是抛出异常
      return this.formatStats({});
    }
  }

  // ===================== 本地缓存管理 =====================

  /**
   * 生成缓存键
   * @param {string} url - URL
   * @returns {string} 缓存键
   */
  generateCacheKey(url) {
    if (!url) return '';
    try {
      return 'detail_' + btoa(encodeURIComponent(url)).substring(0, 16);
    } catch (error) {
      // 处理特殊字符编码问题
      return 'detail_' + url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }
  }

  /**
   * 从本地缓存获取数据
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存数据
   */
  getFromLocalCache(key) {
    if (!key) return null;
    
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    // 检查是否过期
    if (Date.now() > cached.expiresAt) {
      this.requestCache.delete(key);
      return null;
    }

    // 更新访问时间
    cached.lastAccessed = Date.now();
    return cached.data;
  }

  /**
   * 设置本地缓存
   * @param {string} key - 缓存键
   * @param {Object} data - 数据
   */
  setToLocalCache(key, data) {
    if (!key || !data) return;

    // 限制缓存大小
    if (this.requestCache.size >= this.maxCacheSize) {
      // 删除最旧的缓存项
      const oldestKey = this.findOldestCacheKey();
      if (oldestKey) {
        this.requestCache.delete(oldestKey);
      }
    }

    this.requestCache.set(key, {
      data,
      expiresAt: Date.now() + this.cacheExpiration,
      lastAccessed: Date.now(),
      createdAt: Date.now()
    });
  }

  /**
   * 查找最旧的缓存键
   * @returns {string|null} 最旧的缓存键
   */
  findOldestCacheKey() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, cached] of this.requestCache) {
      if (cached.lastAccessed < oldestTime) {
        oldestTime = cached.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 从本地缓存移除数据
   * @param {string} key - 缓存键
   */
  removeFromLocalCache(key) {
    if (key) {
      this.requestCache.delete(key);
    }
  }

  /**
   * 清空本地缓存
   */
  clearLocalCache() {
    this.requestCache.clear();
    console.log('本地详情缓存已清空');
  }

  /**
   * 获取本地缓存统计
   * @returns {Object} 缓存统计
   */
  getLocalCacheStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;

    for (const [key, cached] of this.requestCache) {
      if (now > cached.expiresAt) {
        expiredCount++;
      }
      // 估算缓存大小
      totalSize += JSON.stringify(cached.data).length;
    }

    return {
      totalItems: this.requestCache.size,
      expiredItems: expiredCount,
      maxSize: this.maxCacheSize,
      totalSize,
      averageSize: this.requestCache.size > 0 ? Math.round(totalSize / this.requestCache.size) : 0
    };
  }

  /**
   * 清理本地过期缓存
   * @returns {number} 清理的数量
   */
  cleanupLocalExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, cached] of this.requestCache) {
      if (now > cached.expiresAt) {
        this.requestCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个本地过期缓存项`);
    }

    return cleanedCount;
  }

  // ===================== 工具方法 =====================

  /**
   * 验证搜索结果格式
   * @param {Object} searchResult - 搜索结果
   * @returns {boolean} 是否有效
   */
  validateSearchResult(searchResult) {
    if (!searchResult || typeof searchResult !== 'object') {
      return false;
    }

    if (!searchResult.url || typeof searchResult.url !== 'string') {
      return false;
    }

    try {
      new URL(searchResult.url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化提取统计信息
   * @param {Object} stats - 原始统计数据
   * @returns {Object} 格式化后的统计数据
   */
  formatStats(stats) {
    if (!stats || typeof stats !== 'object') {
      return {
        user: {
          totalExtractions: 0,
          successfulExtractions: 0,
          failedExtractions: 0,
          successRate: 0,
          cacheHitRate: 0,
          averageExtractionTime: 0,
          todayExtractions: 0
        },
        sources: [],
        cache: {
          totalItems: 0,
          totalSize: 0,
          expiredItems: 0,
          hitRate: 0
        }
      };
    }

    return {
      user: {
        totalExtractions: stats.user?.totalExtractions || 0,
        successfulExtractions: stats.user?.successfulExtractions || 0,
        failedExtractions: stats.user?.failedExtractions || 0,
        successRate: stats.user?.successRate || 0,
        cacheHitRate: stats.user?.cacheHitRate || 0,
        averageExtractionTime: stats.user?.averageExtractionTime || 0,
        todayExtractions: stats.user?.todayExtractions || 0,
        weekExtractions: stats.user?.weekExtractions || 0
      },
      sources: Array.isArray(stats.sources) ? stats.sources : [],
      cache: {
        totalItems: stats.cache?.totalItems || 0,
        totalSize: stats.cache?.totalSize || 0,
        expiredItems: stats.cache?.expiredItems || 0,
        hitRate: stats.cache?.hitRate || 0
      }
    };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  }

  /**
   * 格式化持续时间
   * @param {number} ms - 毫秒数
   * @returns {string} 格式化后的时间
   */
  formatDuration(ms) {
    if (!ms || ms === 0) return '0ms';
    
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    
    return `${(ms / 3600000).toFixed(1)}h`;
  }

  /**
   * 检测内容类型
   * @param {Object} detailInfo - 详情信息
   * @returns {string} 内容类型
   */
  detectContentType(detailInfo) {
    if (!detailInfo || typeof detailInfo !== 'object') {
      return 'unknown';
    }

    // 基于可用字段推断内容类型
    if (detailInfo.magnetLinks && detailInfo.magnetLinks.length > 0) {
      return 'torrent';
    }

    if (detailInfo.downloadLinks && detailInfo.downloadLinks.length > 0) {
      return 'download';
    }

    if (detailInfo.actresses && detailInfo.actresses.length > 0) {
      return 'video';
    }

    if (detailInfo.coverImage) {
      return 'media';
    }

    return 'basic';
  }

  /**
   * 导出详情提取服务状态
   * @returns {Object} 服务状态
   */
  exportServiceStatus() {
    return {
      type: 'detail-api-service',
      localCacheStats: this.getLocalCacheStats(),
      cacheExpiration: this.cacheExpiration,
      maxCacheSize: this.maxCacheSize,
      timestamp: Date.now(),
      version: '1.1.0'
    };
  }
}

// 创建单例实例
export const detailAPIService = new DetailAPIService();
export default detailAPIService;