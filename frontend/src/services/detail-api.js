// src/services/detail-api.js - 根据后端更新同步的前端详情提取API服务
import apiService from './api.js';
import authManager from './auth.js';

class DetailAPIService {
  constructor() {
    this.requestCache = new Map();
    this.maxCacheSize = 100;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
    this.progressCallbacks = new Map();
    this.extractionQueue = new Map();
    this.retryDelays = [1000, 2000, 5000]; // 重试延迟时间
  }

  /**
   * 提取单个搜索结果的详情信息 - 根据后端更新增强版本
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

      // 构建增强版请求数据 - 匹配后端 extractSingleDetailHandler
      const requestData = {
        searchResult: {
          url: searchResult.url,
          title: searchResult.title || '',
          source: searchResult.source || '',
          keyword: searchResult.keyword || '',
          code: searchResult.code || ''
        },
        options: {
          enableCache: options.enableCache !== false,
          timeout: Math.min(Math.max(options.timeout || 15000, 5000), 30000),
          enableRetry: options.enableRetry !== false,
          maxRetries: Math.min(options.maxRetries || 2, 5),
          strictValidation: options.strictValidation !== false,
          sourceType: options.sourceType || null,
          useLocalCache: options.useLocalCache !== false
        }
      };

      console.log(`开始提取详情: ${searchResult.title}`);

      const response = await apiService.request('/api/detail/extract-single', {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: requestData.options.timeout
      });

      if (!response.success) {
        throw new Error(response.message || '详情提取失败');
      }

      // 处理增强版响应结构 - 匹配后端 buildSuccessResponse
      const detailInfo = response.data?.detailInfo || response.detailInfo || {};
      const metadata = response.data?.metadata || response.metadata || {};

      // 检查提取状态
      if (detailInfo.extractionStatus === 'error') {
        throw new Error(detailInfo.extractionError || '详情提取失败');
      }

      // 组合完整结果 - 包含后端所有增强字段
      const result = {
        ...searchResult,
        ...detailInfo,
        // 增强的元数据
        extractionTime: metadata.totalTime || detailInfo.extractionTime || 0,
        fromCache: metadata.fromCache || detailInfo.extractionStatus === 'cached',
        extractedAt: detailInfo.extractedAt || Date.now(),
        retryCount: metadata.retryCount || 0,
        validationPassed: metadata.validationPassed || true,
        cacheKey: metadata.cacheKey || null,
        
        // 确保所有必需字段存在
        title: detailInfo.title || searchResult.title || '未知标题',
        code: detailInfo.code || '',
        sourceType: detailInfo.sourceType || 'unknown',
        detailUrl: detailInfo.detailPageUrl || detailInfo.detailUrl || searchResult.url,
        searchUrl: detailInfo.searchUrl || searchResult.url,
        originalUrl: searchResult.url,
        
        // 媒体信息
        coverImage: detailInfo.coverImage || '',
        screenshots: Array.isArray(detailInfo.screenshots) ? detailInfo.screenshots : [],
        
        // 演员信息
        actresses: Array.isArray(detailInfo.actresses) ? detailInfo.actresses : [],
        director: detailInfo.director || '',
        studio: detailInfo.studio || '',
        label: detailInfo.label || '',
        series: detailInfo.series || '',
        
        // 发布信息
        releaseDate: detailInfo.releaseDate || '',
        duration: detailInfo.duration || '',
        
        // 技术信息
        quality: detailInfo.quality || '',
        fileSize: detailInfo.fileSize || '',
        resolution: detailInfo.resolution || '',
        
        // 下载信息
        downloadLinks: Array.isArray(detailInfo.downloadLinks) ? detailInfo.downloadLinks : [],
        magnetLinks: Array.isArray(detailInfo.magnetLinks) ? detailInfo.magnetLinks : [],
        
        // 其他信息
        description: detailInfo.description || '',
        tags: Array.isArray(detailInfo.tags) ? detailInfo.tags : [],
        rating: typeof detailInfo.rating === 'number' ? detailInfo.rating : 0
      };

      // 本地缓存成功的结果
      if (detailInfo.extractionStatus === 'success' && options.useLocalCache !== false) {
        this.setToLocalCache(cacheKey, result);
      }

      console.log(`详情提取完成: ${searchResult.title} (状态: ${detailInfo.extractionStatus})`);
      return result;

    } catch (error) {
      console.error(`详情提取失败 [${searchResult.title}]:`, error);
      
      // 返回增强版错误信息 - 匹配后端 buildErrorResponse
      const errorResult = {
        ...searchResult,
        extractionStatus: 'error',
        extractionError: error.message,
        errorType: error.name || 'UnknownError',
        extractionTime: 0,
        extractedAt: Date.now(),
        fromCache: false,
        retryable: ['TimeoutError', 'NetworkError'].includes(error.name),
        suggestions: this.generateErrorSuggestions(error.name, error.message)
      };

      // 如果启用重试且有重试次数
      if (options.enableRetry && options.maxRetries > 0 && errorResult.retryable) {
        console.log(`尝试重试提取: ${searchResult.title}`);
        await this.delay(this.retryDelays[0] || 1000);
        
        return await this.extractSingleDetail(searchResult, {
          ...options,
          maxRetries: options.maxRetries - 1
        });
      }

      return errorResult;
    }
  }

  /**
   * 批量提取搜索结果的详情信息 - 根据后端更新增强版本
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
      // 生成批量ID用于进度跟踪
      const batchId = this.generateBatchId();
      
      // 构建增强版请求数据 - 匹配后端 extractBatchDetailsHandler
      const requestData = {
        searchResults: searchResults.map(result => ({
          url: result.url,
          title: result.title || '',
          source: result.source || '',
          keyword: result.keyword || '',
          code: result.code || ''
        })),
        options: {
          enableCache: options.enableCache !== false,
          timeout: Math.min(Math.max(options.timeout || 15000, 5000), 30000),
          enableRetry: options.enableRetry !== false,
          maxRetries: Math.min(options.maxRetries || 2, 5),
          maxConcurrency: Math.min(options.maxConcurrency || 4, 10),
          progressInterval: options.progressInterval || 1000,
          stopOnError: options.stopOnError || false,
          strictValidation: options.strictValidation !== false,
          batchId: batchId
        }
      };

      console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);

      // 设置进度回调
      if (options.onProgress && typeof options.onProgress === 'function') {
        this.progressCallbacks.set(batchId, options.onProgress);
      }

      const response = await apiService.request('/api/detail/extract-batch', {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: requestData.options.timeout * 2 // 批量请求给更长超时时间
      });

      // 清理进度回调
      this.progressCallbacks.delete(batchId);

      if (!response.success) {
        throw new Error(response.message || '批量详情提取失败');
      }

      // 处理增强版批量响应 - 匹配后端 buildBatchSuccessResponse
      const results = response.data?.results || response.results || [];
      const stats = response.data?.stats || response.stats || {};
      const summary = response.data?.summary || response.summary || {};

      // 本地缓存成功的结果
      if (options.useLocalCache !== false) {
        results.forEach(result => {
          if (result.extractionStatus === 'success' || result.extractionStatus === 'cached') {
            const cacheKey = this.generateCacheKey(result.url || result.searchUrl);
            this.setToLocalCache(cacheKey, result);
          }
        });
      }

      console.log(`批量提取完成: ${results.length}/${searchResults.length}`);
      
      return {
        results: results.map(result => ({
          ...result,
          // 确保所有结果都有必需的字段
          title: result.title || '未知标题',
          code: result.code || '',
          sourceType: result.sourceType || 'unknown',
          extractionStatus: result.extractionStatus || 'unknown',
          extractionTime: result.extractionTime || 0,
          extractedAt: result.extractedAt || Date.now(),
          fromCache: result.extractionStatus === 'cached'
        })),
        stats: {
          total: stats.total || results.length,
          successful: stats.successful || results.filter(r => r.extractionStatus === 'success').length,
          cached: stats.cached || results.filter(r => r.extractionStatus === 'cached').length,
          failed: stats.failed || results.filter(r => r.extractionStatus === 'error').length,
          partial: stats.partial || results.filter(r => r.extractionStatus === 'partial').length,
          totalTime: stats.totalTime || 0,
          averageTime: stats.averageTime || 0,
          successRate: stats.successRate || 0,
          cacheHitRate: stats.cacheHitRate || 0,
          performance: stats.performance || {
            itemsPerSecond: 0,
            averageTimePerItem: 0,
            totalTime: 0
          },
          bySource: stats.bySource || {}
        },
        summary: {
          processed: summary.processed || results.length,
          successful: summary.successful || 0,
          failed: summary.failed || 0,
          cached: summary.cached || 0,
          message: summary.message || `批量详情提取完成: ${results.length} 个结果`
        }
      };

    } catch (error) {
      console.error('批量详情提取失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情提取历史 - 根据后端更新增强版本
   * @param {Object} options - 查询选项
   * @returns {Promise<Object>} 历史记录对象
   */
  async getExtractionHistory(options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const params = new URLSearchParams();
      
      // 构建查询参数 - 匹配后端 parseHistoryParams
      if (options.limit) params.append('limit', Math.min(options.limit, 100).toString());
      if (options.offset) params.append('offset', Math.max(options.offset || 0, 0).toString());
      if (options.source) params.append('source', options.source);
      if (options.status) params.append('status', options.status);
      if (options.dateRange) params.append('dateRange', options.dateRange);
      if (options.keyword) params.append('keyword', options.keyword);
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);

      const endpoint = `/api/detail/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiService.request(endpoint);

      if (!response.success) {
        throw new Error(response.message || '获取历史失败');
      }

      const historyData = response.data || response;

      return {
        history: (historyData.history || []).map(item => ({
          ...item,
          // 增强字段 - 匹配后端 enhanceHistoryItem
          relativeTime: this.getRelativeTime(item.createdAt),
          statusBadge: this.getStatusBadge(item.extractionStatus),
          performanceRating: this.getPerformanceRating(item.extractionTime),
          estimatedQuality: this.getEstimatedQuality(item)
        })),
        pagination: historyData.pagination || {
          total: 0,
          limit: options.limit || 20,
          offset: options.offset || 0,
          hasMore: false,
          currentPage: 1,
          totalPages: 1
        },
        filters: historyData.filters || {
          source: options.source,
          status: options.status,
          dateRange: options.dateRange
        }
      };

    } catch (error) {
      console.error('获取详情提取历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情缓存统计 - 根据后端更新增强版本
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

      const statsData = response.data || response;

      return {
        global: statsData.global || {
          totalItems: 0,
          expiredItems: 0,
          totalSize: 0,
          averageSize: 0,
          hitRate: 0,
          oldestItem: null,
          newestItem: null,
          mostAccessed: null
        },
        user: statsData.user || {
          cacheItems: 0,
          averageSize: 0,
          totalAccess: 0,
          hitRate: 0
        },
        sourceTypes: Array.isArray(statsData.sourceTypes) ? statsData.sourceTypes : [],
        efficiency: statsData.efficiency || {
          hitRate: 0,
          timeSavedPerRequest: 0,
          totalTimeSaved: 0,
          efficiency: 'unknown'
        },
        recommendations: Array.isArray(statsData.recommendations) ? statsData.recommendations : [],
        local: this.getLocalCacheStats()
      };

    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return this.getDefaultCacheStats();
    }
  }

  /**
   * 清理详情缓存 - 根据后端更新增强版本
   * @param {string} operation - 清理操作类型
   * @param {Object} options - 清理选项
   * @returns {Promise<Object>} 清理结果
   */
  async clearCache(operation = 'expired', options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    if (!['expired', 'all', 'lru', 'selective'].includes(operation)) {
      throw new Error('无效的清理操作类型');
    }

    try {
      const params = new URLSearchParams();
      params.append('operation', operation);
      
      // 添加清理选项参数 - 匹配后端 parseClearParams
      if (operation === 'lru' && options.count) {
        params.append('count', Math.min(options.count, 1000).toString());
      }
      if (operation === 'selective') {
        if (options.olderThan) params.append('olderThan', options.olderThan);
        if (options.sourceType) params.append('sourceType', options.sourceType);
        if (options.minSize) params.append('minSize', options.minSize.toString());
        if (options.maxSize) params.append('maxSize', options.maxSize.toString());
      }

      const response = await apiService.request(`/api/detail/cache/clear?${params.toString()}`, {
        method: 'DELETE'
      });

      if (!response.success) {
        throw new Error(response.message || '清理缓存失败');
      }

      // 根据操作类型清理本地缓存
      if (operation === 'all') {
        this.clearLocalCache();
      } else if (operation === 'expired') {
        this.cleanupLocalExpiredCache();
      }

      const resultData = response.data || response;

      return {
        operation: resultData.operation || operation,
        cleanedCount: resultData.cleanedCount || 0,
        message: resultData.message || '缓存清理完成',
        details: resultData.details || {},
        stats: resultData.stats || {
          before: { totalItems: 0, totalSize: 0 },
          after: { totalItems: 0, totalSize: 0 },
          freed: { items: 0, size: 0 }
        }
      };

    } catch (error) {
      console.error('清理缓存失败:', error);
      throw error;
    }
  }

  /**
   * 删除特定URL的详情缓存 - 根据后端更新增强版本
   * @param {string|Array} urls - 要删除缓存的URL或URL数组
   * @returns {Promise<Object>} 删除结果
   */
  async deleteCache(urls) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    const urlsArray = Array.isArray(urls) ? urls : [urls];
    
    if (urlsArray.length === 0 || urlsArray.some(url => !url)) {
      throw new Error('URL参数不能为空');
    }

    try {
      const response = await apiService.request('/api/detail/cache/delete', {
        method: 'DELETE',
        body: JSON.stringify({ 
          url: urlsArray.length === 1 ? urlsArray[0] : undefined,
          urls: urlsArray.length > 1 ? urlsArray : undefined
        })
      });

      if (!response.success) {
        throw new Error(response.message || '删除缓存失败');
      }

      // 删除本地缓存
      urlsArray.forEach(url => {
        const cacheKey = this.generateCacheKey(url);
        this.removeFromLocalCache(cacheKey);
      });

      const resultData = response.data || response;

      return {
        successful: resultData.results?.successful || [],
        failed: resultData.results?.failed || [],
        total: resultData.results?.total || urlsArray.length,
        message: resultData.message || '缓存删除完成'
      };

    } catch (error) {
      console.error('删除缓存失败:', error);
      return {
        successful: [],
        failed: urlsArray,
        total: urlsArray.length,
        message: '删除缓存失败: ' + error.message
      };
    }
  }

  /**
   * 获取详情提取配置 - 根据后端更新增强版本
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

      const configData = response.data || response;

      return {
        config: configData.config || this.getDefaultConfig(),
        usage: configData.usage || {},
        recommendations: Array.isArray(configData.recommendations) ? configData.recommendations : [],
        validation: configData.validation || {
          rules: {},
          supportedSources: this.getSupportedSourceTypes()
        },
        systemLimits: configData.config?.systemLimits || this.getSystemLimits(),
        isDefault: configData.config?.isDefault || false
      };

    } catch (error) {
      console.error('获取详情提取配置失败:', error);
      return {
        config: this.getDefaultConfig(),
        usage: {},
        recommendations: [],
        validation: {
          rules: {},
          supportedSources: this.getSupportedSourceTypes()
        },
        systemLimits: this.getSystemLimits(),
        isDefault: true
      };
    }
  }

  /**
   * 更新详情提取配置 - 根据后端更新增强版本
   * @param {Object} config - 配置更新
   * @param {boolean} validateOnly - 是否仅验证
   * @returns {Promise<Object>} 更新结果
   */
  async updateConfig(config, validateOnly = false) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    if (!config || typeof config !== 'object') {
      throw new Error('配置数据格式错误');
    }

    try {
      const response = await apiService.request('/api/detail/config', {
        method: 'PUT',
        body: JSON.stringify({ 
          config,
          validateOnly 
        })
      });

      if (!response.success) {
        const errorData = response.data || response;
        if (errorData.errors) {
          throw new Error(`配置验证失败: ${errorData.errors.join(', ')}`);
        }
        throw new Error(response.message || '更新配置失败');
      }

      const resultData = response.data || response;

      return {
        valid: resultData.valid !== false,
        changes: Array.isArray(resultData.changes) ? resultData.changes : [],
        warnings: Array.isArray(resultData.warnings) ? resultData.warnings : [],
        optimizations: Array.isArray(resultData.optimizations) ? resultData.optimizations : [],
        message: resultData.message || (validateOnly ? '配置验证通过' : '配置更新成功')
      };

    } catch (error) {
      console.error('更新详情提取配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情提取统计信息 - 根据后端更新增强版本
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

      const statsData = response.data || response;

      return {
        user: statsData.user || {
          totalExtractions: 0,
          successfulExtractions: 0,
          failedExtractions: 0,
          successRate: 0
        },
        sources: Array.isArray(statsData.sources) ? statsData.sources : [],
        performance: statsData.performance || {
          averageTime: 0,
          fastestTime: 0,
          slowestTime: 0
        },
        cache: statsData.cache || {
          hitRate: 0,
          totalItems: 0
        },
        trends: statsData.trends || {
          daily: [],
          weekly: [],
          monthly: []
        },
        realtime: statsData.realtime || {},
        summary: statsData.summary || {
          totalExtractions: 0,
          averageTime: 0,
          topSource: 'unknown'
        },
        insights: Array.isArray(statsData.insights) ? statsData.insights : []
      };

    } catch (error) {
      console.error('获取详情提取统计失败:', error);
      return this.getDefaultStats();
    }
  }

  // ===================== 本地缓存管理 =====================

  /**
   * 生成缓存键
   */
  generateCacheKey(url) {
    if (!url) return '';
    try {
      return 'detail_' + btoa(encodeURIComponent(url)).substring(0, 16);
    } catch (error) {
      return 'detail_' + url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }
  }

  /**
   * 生成批量处理ID
   */
  generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 从本地缓存获取数据
   */
  getFromLocalCache(key) {
    if (!key) return null;
    
    const cached = this.requestCache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.requestCache.delete(key);
      return null;
    }

    cached.lastAccessed = Date.now();
    return cached.data;
  }

  /**
   * 设置本地缓存
   */
  setToLocalCache(key, data) {
    if (!key || !data) return;

    if (this.requestCache.size >= this.maxCacheSize) {
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
   */
  getLocalCacheStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;

    for (const [key, cached] of this.requestCache) {
      if (now > cached.expiresAt) {
        expiredCount++;
      }
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
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 生成错误建议
   */
  generateErrorSuggestions(errorType, errorMessage) {
    const suggestions = [];
    
    switch (errorType) {
      case 'TimeoutError':
        suggestions.push('尝试增加超时时间');
        suggestions.push('检查网络连接');
        suggestions.push('稍后重试');
        break;
      case 'ValidationError':
        suggestions.push('检查输入数据格式');
        suggestions.push('确保URL有效');
        break;
      case 'NetworkError':
        suggestions.push('检查网络连接');
        suggestions.push('目标网站可能暂时不可用');
        break;
      case 'ParseError':
        suggestions.push('目标页面结构可能已变更');
        suggestions.push('尝试使用通用解析模式');
        break;
      default:
        suggestions.push('请重试操作');
        break;
    }
    
    return suggestions;
  }

  /**
   * 获取相对时间
   */
  getRelativeTime(timestamp) {
    const now = Date.now();
    const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
    const diff = now - time;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    return `${Math.floor(diff / 604800000)}周前`;
  }

  /**
   * 获取状态徽章
   */
  getStatusBadge(status) {
    const badges = {
      'success': { text: '成功', color: 'green', icon: '✓' },
      'cached': { text: '缓存', color: 'blue', icon: '⚡' },
      'partial': { text: '部分', color: 'yellow', icon: '⚠' },
      'error': { text: '失败', color: 'red', icon: '✗' },
      'timeout': { text: '超时', color: 'orange', icon: 'ⱱ' }
    };
    
    return badges[status] || { text: '未知', color: 'gray', icon: '?' };
  }

  /**
   * 获取性能评级
   */
  getPerformanceRating(extractionTime) {
    if (extractionTime < 3000) return 'excellent';
    if (extractionTime < 8000) return 'good';
    if (extractionTime < 15000) return 'fair';
    return 'poor';
  }

  /**
   * 估算质量
   */
  getEstimatedQuality(item) {
    let score = 0;
    
    if (item.extractionTime < 5000) score += 2;
    else if (item.extractionTime < 10000) score += 1;
    
    if (item.dataSize > 5000) score += 2;
    else if (item.dataSize > 2000) score += 1;
    
    if (item.extractionStatus === 'success') score += 3;
    else if (item.extractionStatus === 'cached') score += 2;
    
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'unknown';
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      enableDetailExtraction: true,
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      extractionTimeout: 15000,
      enableRetry: true,
      maxRetryAttempts: 2,
      enableCache: true,
      cacheDuration: 86400000,
      enableLocalCache: true,
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      compactMode: false,
      enableImagePreview: true,
      showExtractionProgress: true,
      enableContentFilter: false,
      contentFilterKeywords: []
    };
  }

  /**
   * 获取系统限制
   */
  getSystemLimits() {
    return {
      maxTimeout: 30000,
      minTimeout: 5000,
      maxCacheDuration: 604800000,
      minCacheDuration: 3600000,
      maxBatchSize: 20,
      maxDownloadLinks: 10,
      maxMagnetLinks: 10,
      maxScreenshots: 10,
      maxConcurrentExtractions: 4
    };
  }

  /**
   * 获取支持的源类型
   */
  getSupportedSourceTypes() {
    return ['javbus', 'javdb', 'jable', 'javgg', 'javmost', 'sukebei', 'javguru', 'generic'];
  }

  /**
   * 获取默认缓存统计
   */
  getDefaultCacheStats() {
    return {
      global: { totalItems: 0, expiredItems: 0, totalSize: 0, averageSize: 0, hitRate: 0 },
      user: { cacheItems: 0, averageSize: 0, totalAccess: 0, hitRate: 0 },
      sourceTypes: [],
      efficiency: { hitRate: 0, timeSavedPerRequest: 0, totalTimeSaved: 0, efficiency: 'unknown' },
      recommendations: [],
      local: this.getLocalCacheStats()
    };
  }

  /**
   * 获取默认统计
   */
  getDefaultStats() {
    return {
      user: { totalExtractions: 0, successfulExtractions: 0, failedExtractions: 0, successRate: 0 },
      sources: [],
      performance: { averageTime: 0, fastestTime: 0, slowestTime: 0 },
      cache: { hitRate: 0, totalItems: 0 },
      trends: { daily: [], weekly: [], monthly: [] },
      realtime: {},
      summary: { totalExtractions: 0, averageTime: 0, topSource: 'unknown' },
      insights: []
    };
  }

  /**
   * 导出详情提取服务状态
   */
  exportServiceStatus() {
    return {
      type: 'detail-api-service',
      version: '2.1.0', // 更新版本号
      localCacheStats: this.getLocalCacheStats(),
      cacheExpiration: this.cacheExpiration,
      maxCacheSize: this.maxCacheSize,
      activeProgressCallbacks: this.progressCallbacks.size,
      extractionQueue: this.extractionQueue.size,
      retryDelays: this.retryDelays,
      timestamp: Date.now(),
      features: {
        enhancedErrorHandling: true,
        improvedCaching: true,
        batchProcessing: true,
        configValidation: true,
        progressTracking: true,
        retryMechanism: true,
        statisticsReporting: true
      }
    };
  }

  /**
   * 验证提取结果
   */
  validateExtractionResult(result) {
    if (!result || typeof result !== 'object') {
      return { valid: false, error: '结果数据无效' };
    }

    const requiredFields = ['extractionStatus', 'extractedAt'];
    const missingFields = requiredFields.filter(field => !(field in result));
    
    if (missingFields.length > 0) {
      return { 
        valid: false, 
        error: `缺少必需字段: ${missingFields.join(', ')}` 
      };
    }

    if (!['success', 'cached', 'partial', 'error'].includes(result.extractionStatus)) {
      return { 
        valid: false, 
        error: `无效的提取状态: ${result.extractionStatus}` 
      };
    }

    return { valid: true };
  }

  /**
   * 格式化批量结果用于显示
   */
  formatBatchResultsForDisplay(results, options = {}) {
    const { 
      includeErrors = true, 
      sortBy = 'extractionTime',
      maxResults = null 
    } = options;

    let filteredResults = includeErrors ? results : 
      results.filter(r => r.extractionStatus === 'success' || r.extractionStatus === 'cached');

    // 排序
    if (sortBy === 'extractionTime') {
      filteredResults.sort((a, b) => (a.extractionTime || 0) - (b.extractionTime || 0));
    } else if (sortBy === 'title') {
      filteredResults.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    // 限制数量
    if (maxResults && filteredResults.length > maxResults) {
      filteredResults = filteredResults.slice(0, maxResults);
    }

    return filteredResults.map(result => ({
      ...result,
      displayTitle: result.title || result.code || '未知标题',
      statusInfo: this.getStatusBadge(result.extractionStatus),
      performanceInfo: this.getPerformanceRating(result.extractionTime),
      qualityInfo: this.getEstimatedQuality(result),
      formattedTime: this.formatExtractionTime(result.extractionTime)
    }));
  }

  /**
   * 格式化提取时间
   */
  formatExtractionTime(timeMs) {
    if (!timeMs || timeMs === 0) return '0ms';
    
    if (timeMs < 1000) return `${timeMs}ms`;
    if (timeMs < 60000) return `${(timeMs / 1000).toFixed(1)}s`;
    return `${(timeMs / 60000).toFixed(1)}min`;
  }

  /**
   * 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const startTime = Date.now();
      
      // 尝试一个简单的API调用来检查服务状态
      const response = await apiService.request('/api/detail/stats', {
        timeout: 5000
      });
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: response.success,
        responseTime,
        timestamp: Date.now(),
        localCache: {
          size: this.requestCache.size,
          maxSize: this.maxCacheSize,
          hitRate: this.calculateLocalCacheHitRate()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now(),
        localCache: {
          size: this.requestCache.size,
          maxSize: this.maxCacheSize
        }
      };
    }
  }

  /**
   * 计算本地缓存命中率
   */
  calculateLocalCacheHitRate() {
    if (this.requestCache.size === 0) return 0;
    
    let hits = 0;
    let total = 0;
    
    for (const [key, cached] of this.requestCache) {
      total++;
      if (cached.lastAccessed > cached.createdAt) {
        hits++;
      }
    }
    
    return total > 0 ? Math.round((hits / total) * 100) : 0;
  }
}

// 创建单例实例
export const detailAPIService = new DetailAPIService();
export default detailAPIService;