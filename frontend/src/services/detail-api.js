// src/services/detail-api.js - 集成用户配置服务的详情提取API
// 与后端 detail.js 处理器完全对接，支持动态配置

import apiService from './api.js';
import authManager from './auth.js';
import detailConfigAPI from './detail-config-api.js';
import { 
  DETAIL_EXTRACTION_STATUS,
  DEFAULT_USER_CONFIG 
} from '../core/detail-config.js';
import { LIMITS } from '../core/constants.js';

class DetailAPIService {
  constructor() {
    this.requestCache = new Map();
    this.maxCacheSize = 100;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
    this.progressCallbacks = new Map();
    this.extractionQueue = new Map();
    this.retryDelays = [1000, 2000, 5000]; // 重试延迟时间
    
    // 状态常量 - 与后端同步
    this.EXTRACTION_STATUS = DETAIL_EXTRACTION_STATUS;
    
    // 支持的源类型
    this.SUPPORTED_SOURCES = [
      'javbus', 'javdb', 'jable', 'javgg', 'javmost', 'sukebei', 'javguru'
    ];
    
    // 系统限制 - 从 constants.js 获取
    this.LIMITS = LIMITS.DETAIL_EXTRACTION;
  }

  /**
   * 获取用户配置并应用到API调用选项
   */
  async getConfigAwareOptions(overrides = {}) {
    try {
      // 获取用户配置
      let userConfig;
      if (authManager.isAuthenticated()) {
        const configData = await detailConfigAPI.getUserConfig();
        userConfig = configData.config || DEFAULT_USER_CONFIG;
      } else {
        userConfig = DEFAULT_USER_CONFIG;
      }
      
      // 合并用户配置和覆盖选项
      return this.mergeConfigWithOverrides(userConfig, overrides);
    } catch (error) {
      console.error('获取用户配置失败，使用默认配置:', error);
      return this.mergeConfigWithOverrides(DEFAULT_USER_CONFIG, overrides);
    }
  }

  /**
   * 合并用户配置和覆盖选项
   */
  mergeConfigWithOverrides(userConfig, overrides) {
    return {
      // 基础选项
      enableCache: userConfig.enableCache && (overrides.enableCache !== false),
      timeout: overrides.timeout || userConfig.extractionTimeout,
      enableRetry: userConfig.enableRetry && (overrides.enableRetry !== false),
      maxRetries: overrides.maxRetries || userConfig.maxRetryAttempts,
      
      // 内容控制
      maxDownloadLinks: overrides.maxDownloadLinks || userConfig.maxDownloadLinks,
      maxMagnetLinks: overrides.maxMagnetLinks || userConfig.maxMagnetLinks,
      maxScreenshots: overrides.maxScreenshots || userConfig.maxScreenshots,
      
      // 质量控制
      strictValidation: overrides.strictValidation !== undefined ? 
        overrides.strictValidation : userConfig.enableStrictDomainCheck,
      requireMinimumData: userConfig.requireMinimumData,
      validateImageUrls: userConfig.validateImageUrls,
      validateDownloadLinks: userConfig.validateDownloadLinks,
      
      // 过滤选项
      enableContentFilter: userConfig.enableContentFilter,
      contentFilterKeywords: userConfig.contentFilterKeywords,
      enableSpamFilter: userConfig.enableSpamFilter,
      
      // 其他选项
      sourceType: overrides.sourceType || null,
      preferOriginalSources: userConfig.preferOriginalSources,
      enableAutoCodeExtraction: userConfig.enableAutoCodeExtraction,
      useLocalCache: overrides.useLocalCache !== false && userConfig.enableLocalCache
    };
  }

  /**
   * 提取单个搜索结果的详情信息 - 配置感知版本
   */
  async extractSingleDetail(searchResult, options = {}) {
    if (!searchResult || !searchResult.url) {
      throw new Error('搜索结果数据不完整');
    }

    try {
      // 获取配置感知的选项
      const configOptions = await this.getConfigAwareOptions(options);
      
      // 检查本地缓存
      const cacheKey = this.generateCacheKey(searchResult.url);
      if (configOptions.useLocalCache !== false) {
        const cached = this.getFromLocalCache(cacheKey);
        if (cached) {
          console.log(`本地缓存命中: ${searchResult.title}`);
          return this.enhanceExtractionResult(cached, searchResult);
        }
      }

      // 构建与后端完全匹配的请求数据
      const requestData = {
        searchResult: {
          url: searchResult.url,
          title: searchResult.title || '',
          source: searchResult.source || '',
          keyword: searchResult.keyword || searchResult.query || '',
          code: searchResult.code || '',
          id: searchResult.id || this.generateResultId(searchResult.url)
        },
        options: configOptions
      };

      console.log(`开始提取详情: ${searchResult.title}`);
      console.log('使用配置:', configOptions);

      const response = await apiService.request('/api/detail/extract-single', {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: configOptions.timeout
      });

      if (!response.success) {
        throw new Error(response.message || '详情提取失败');
      }

      // 处理后端响应 - 匹配buildSuccessResponse结构
      const result = this.processExtractionResponse(response, searchResult);

      // 本地缓存成功的结果
      if (result.extractionStatus === this.EXTRACTION_STATUS.SUCCESS && configOptions.useLocalCache !== false) {
        this.setToLocalCache(cacheKey, result);
      }

      console.log(`详情提取完成: ${searchResult.title} (状态: ${result.extractionStatus})`);
      return result;

    } catch (error) {
      console.error(`详情提取失败 [${searchResult.title}]:`, error);
      return this.createErrorResult(error, searchResult);
    }
  }

  /**
   * 批量提取搜索结果的详情信息 - 配置感知版本
   */
  async extractBatchDetails(searchResults, options = {}) {
    // 输入验证 - 与后端validateBatchInput匹配
    const validation = this.validateBatchInput(searchResults, options);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    try {
      // 获取配置感知的批量选项
      const configOptions = await this.getBatchConfigOptions(options);
      
      // 生成批次ID用于进度跟踪
      const batchId = this.generateBatchId();
      
      // 构建与后端完全匹配的请求数据
      const requestData = {
        searchResults: searchResults.map(result => ({
          url: result.url,
          title: result.title || '',
          source: result.source || '',
          keyword: result.keyword || result.query || '',
          code: result.code || '',
          id: result.id || this.generateResultId(result.url)
        })),
        options: {
          ...configOptions,
          batchId: batchId
        }
      };

      console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);
      console.log('批量提取配置:', configOptions);

      // 设置进度回调
      if (options.onProgress && typeof options.onProgress === 'function') {
        this.progressCallbacks.set(batchId, options.onProgress);
      }

      const response = await apiService.request('/api/detail/extract-batch', {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: configOptions.timeout * 2 // 批量请求给更长超时时间
      });

      // 清理进度回调
      this.progressCallbacks.delete(batchId);

      if (!response.success) {
        throw new Error(response.message || '批量详情提取失败');
      }

      // 处理批量响应 - 匹配buildBatchSuccessResponse结构
      return this.processBatchResponse(response, searchResults, options);

    } catch (error) {
      console.error('批量详情提取失败:', error);
      throw error;
    }
  }

  /**
   * 获取批量提取的配置选项
   */
  async getBatchConfigOptions(overrides = {}) {
    const baseOptions = await this.getConfigAwareOptions(overrides);
    
    // 获取用户配置
    let userConfig;
    try {
      if (authManager.isAuthenticated()) {
        const configData = await detailConfigAPI.getUserConfig();
        userConfig = configData.config || DEFAULT_USER_CONFIG;
      } else {
        userConfig = DEFAULT_USER_CONFIG;
      }
    } catch (error) {
      userConfig = DEFAULT_USER_CONFIG;
    }
    
    return {
      ...baseOptions,
      // 批量特定选项
      batchSize: overrides.batchSize || userConfig.extractionBatchSize,
      maxConcurrency: userConfig.enableConcurrentExtraction ? 
        (overrides.maxConcurrency || userConfig.maxConcurrentExtractions) : 1,
      enableSmartBatching: userConfig.enableSmartBatching,
      progressInterval: overrides.progressInterval || 1000,
      stopOnError: overrides.stopOnError || false
    };
  }

  /**
   * 获取详情提取历史 - 与后端getDetailExtractionHistoryHandler匹配
   */
  async getExtractionHistory(options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const params = new URLSearchParams();
      
      // 构建查询参数 - 匹配后端parseHistoryParams
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

      return this.enhanceHistoryData(response.data || response);

    } catch (error) {
      console.error('获取详情提取历史失败:', error);
      throw error;
    }
  }

  /**
   * 获取详情缓存统计 - 与后端getDetailCacheStatsHandler匹配
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
        global: statsData.global || this.getDefaultGlobalStats(),
        user: statsData.user || this.getDefaultUserStats(),
        sourceTypes: Array.isArray(statsData.sourceTypes) ? statsData.sourceTypes : [],
        efficiency: statsData.efficiency || this.getDefaultEfficiencyStats(),
        recommendations: Array.isArray(statsData.recommendations) ? statsData.recommendations : [],
        local: this.getLocalCacheStats()
      };

    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return this.getDefaultCacheStats();
    }
  }

  /**
   * 清理详情缓存 - 与后端clearDetailCacheHandler匹配
   */
  async clearCache(operation = 'expired', options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    // 验证操作类型
    const validOperations = ['expired', 'all', 'lru', 'selective'];
    if (!validOperations.includes(operation)) {
      throw new Error('无效的清理操作类型');
    }

    try {
      const params = new URLSearchParams();
      params.append('operation', operation);
      
      // 添加清理选项参数 - 匹配后端parseClearParams
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
      this.handleLocalCacheClear(operation, options);

      return this.enhanceClearResult(response.data || response, operation);

    } catch (error) {
      console.error('清理缓存失败:', error);
      throw error;
    }
  }

  /**
   * 删除特定URL的详情缓存 - 与后端deleteDetailCacheHandler匹配
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
   * 获取详情提取统计信息 - 与后端getDetailExtractionStatsHandler匹配
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
        user: statsData.user || this.getDefaultUserStats(),
        sources: Array.isArray(statsData.sources) ? statsData.sources : [],
        performance: statsData.performance || this.getDefaultPerformanceStats(),
        cache: statsData.cache || this.getDefaultCacheStats(),
        trends: statsData.trends || this.getDefaultTrendStats(),
        realtime: statsData.realtime || {},
        summary: statsData.summary || this.getDefaultSummary(),
        insights: Array.isArray(statsData.insights) ? statsData.insights : []
      };

    } catch (error) {
      console.error('获取详情提取统计失败:', error);
      return this.getDefaultStatsResponse();
    }
  }

  // ===================== 响应处理方法 =====================

  /**
   * 处理单个提取响应
   */
  processExtractionResponse(response, originalResult) {
    const data = response.data || response;
    const detailInfo = data.detailInfo || data;
    const metadata = data.metadata || {};

    console.log('处理提取响应:', {
      originalId: originalResult.id,
      originalTitle: originalResult.title,
      responseTitle: detailInfo.title,
      extractionStatus: detailInfo.extractionStatus
    });

    // 与后端buildSuccessResponse结构保持一致
    return {
      // 关键修复：确保原始ID被正确保留并优先使用
      id: originalResult.id,  // 明确设置为原始搜索结果的ID
      originalId: originalResult.id,
      
      // 从原始搜索结果继承的基础信息
      originalUrl: originalResult.url,
      originalTitle: originalResult.title,
      originalSource: originalResult.source,
      source: originalResult.source, // 保持兼容性
      
      // 后端返回的详情信息会覆盖同名字段
      title: detailInfo.title || originalResult.title || '未知标题',
      code: detailInfo.code || '',
      sourceType: detailInfo.sourceType || 'unknown',
      
      // URL信息
      detailUrl: detailInfo.detailPageUrl || detailInfo.detailUrl || originalResult.url,
      searchUrl: detailInfo.searchUrl || originalResult.url,
      url: detailInfo.detailUrl || originalResult.url, // 兼容性字段
      
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
      rating: typeof detailInfo.rating === 'number' ? detailInfo.rating : 0,
      
      // 提取元数据
      extractionStatus: detailInfo.extractionStatus || this.EXTRACTION_STATUS.SUCCESS,
      extractionTime: detailInfo.extractionTime || metadata.totalTime || 0,
      extractedAt: detailInfo.extractedAt || Date.now(),
      fromCache: metadata.fromCache || detailInfo.extractionStatus === this.EXTRACTION_STATUS.CACHED,
      retryCount: metadata.retryCount || 0,
      cacheKey: metadata.cacheKey || null
    };
  }

  /**
   * 处理批量响应
   */
  processBatchResponse(response, originalResults, options) {
    const data = response.data || response;
    const results = data.results || [];
    const stats = data.stats || {};
    const summary = data.summary || {};

    // 本地缓存成功的结果
    if (options.useLocalCache !== false) {
      results.forEach(result => {
        if (result.extractionStatus === this.EXTRACTION_STATUS.SUCCESS || 
            result.extractionStatus === this.EXTRACTION_STATUS.CACHED) {
          const cacheKey = this.generateCacheKey(result.url || result.searchUrl);
          this.setToLocalCache(cacheKey, result);
        }
      });
    }

    return {
      results: results.map(result => ({
        ...result,
        // 确保所有结果都有必需的字段
        title: result.title || '未知标题',
        code: result.code || '',
        sourceType: result.sourceType || 'unknown',
        extractionStatus: result.extractionStatus || this.EXTRACTION_STATUS.ERROR,
        extractionTime: result.extractionTime || 0,
        extractedAt: result.extractedAt || Date.now(),
        fromCache: result.extractionStatus === this.EXTRACTION_STATUS.CACHED
      })),
      stats: {
        total: stats.total || results.length,
        successful: stats.successful || results.filter(r => r.extractionStatus === this.EXTRACTION_STATUS.SUCCESS).length,
        cached: stats.cached || results.filter(r => r.extractionStatus === this.EXTRACTION_STATUS.CACHED).length,
        failed: stats.failed || results.filter(r => r.extractionStatus === this.EXTRACTION_STATUS.ERROR).length,
        partial: stats.partial || results.filter(r => r.extractionStatus === this.EXTRACTION_STATUS.PARTIAL).length,
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
  }

  /**
   * 创建错误结果
   */
  createErrorResult(error, originalResult) {
    return {
      ...originalResult,
      extractionStatus: this.EXTRACTION_STATUS.ERROR,
      extractionError: error.message,
      errorType: error.name || 'UnknownError',
      extractionTime: 0,
      extractedAt: Date.now(),
      fromCache: false,
      retryable: ['TimeoutError', 'NetworkError'].includes(error.name),
      suggestions: this.generateErrorSuggestions(error.name, error.message)
    };
  }

  // ===================== 验证和工具方法 =====================

  /**
   * 批量输入验证 - 与后端validateBatchInput匹配
   */
  validateBatchInput(searchResults, options) {
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return {
        valid: false,
        message: '搜索结果列表不能为空'
      };
    }
    
    if (searchResults.length > this.LIMITS.MAX_BATCH_SIZE) {
      return {
        valid: false,
        message: `批量处理数量不能超过 ${this.LIMITS.MAX_BATCH_SIZE} 个`
      };
    }
    
    const invalidResults = [];
    searchResults.forEach((result, index) => {
      if (!result || !result.url) {
        invalidResults.push({ index, issue: 'missing_url' });
      } else {
        try {
          new URL(result.url);
        } catch {
          invalidResults.push({ index, issue: 'invalid_url', url: result.url });
        }
      }
    });
    
    if (invalidResults.length > 0) {
      return {
        valid: false,
        message: '存在无效的搜索结果数据',
        details: { invalidResults }
      };
    }
    
    return { valid: true };
  }

  /**
   * 验证超时时间
   */
  validateTimeout(timeout) {
    const timeoutNum = Number(timeout);
    if (isNaN(timeoutNum)) return this.LIMITS.DEFAULT_TIMEOUT;
    
    return Math.min(Math.max(timeoutNum, this.LIMITS.MIN_TIMEOUT), this.LIMITS.MAX_TIMEOUT);
  }

  /**
   * 推断源类型
   */
  inferSourceType(url) {
    if (!url) return 'generic';
    
    const urlLower = url.toLowerCase();
    
    for (const sourceType of this.SUPPORTED_SOURCES) {
      if (urlLower.includes(sourceType)) {
        return sourceType;
      }
    }
    
    return 'generic';
  }

  /**
   * 生成结果ID
   */
  generateResultId(url) {
    try {
      return 'result_' + btoa(encodeURIComponent(url)).substring(0, 16);
    } catch (error) {
      return 'result_' + url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }
  }

  /**
   * 增强提取结果
   */
  enhanceExtractionResult(cached, originalResult) {
    return {
      ...originalResult,
      ...cached,
      fromCache: true,
      extractionStatus: this.EXTRACTION_STATUS.CACHED,
      extractedAt: cached.extractedAt || Date.now()
    };
  }

  /**
   * 增强历史数据
   */
  enhanceHistoryData(historyData) {
    return {
      history: (historyData.history || []).map(item => ({
        ...item,
        relativeTime: this.getRelativeTime(item.createdAt),
        statusBadge: this.getStatusBadge(item.extractionStatus),
        performanceRating: this.getPerformanceRating(item.extractionTime),
        estimatedQuality: this.getEstimatedQuality(item)
      })),
      pagination: historyData.pagination || {
        total: 0,
        limit: 20,
        offset: 0,
        hasMore: false,
        currentPage: 1,
        totalPages: 1
      },
      filters: historyData.filters || {}
    };
  }

  /**
   * 增强清理结果
   */
  enhanceClearResult(resultData, operation) {
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
   * 生成批次ID
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

  /**
   * 处理本地缓存清理
   */
  handleLocalCacheClear(operation, options) {
    switch (operation) {
      case 'all':
        this.clearLocalCache();
        break;
      case 'expired':
        this.cleanupLocalExpiredCache();
        break;
      case 'lru':
        if (options.count) {
          const keys = Array.from(this.requestCache.keys()).slice(0, options.count);
          keys.forEach(key => this.requestCache.delete(key));
        }
        break;
    }
  }

  // ===================== 默认数据和工具方法 =====================

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
      [this.EXTRACTION_STATUS.SUCCESS]: { text: '成功', color: 'green', icon: '✓' },
      [this.EXTRACTION_STATUS.CACHED]: { text: '缓存', color: 'blue', icon: '⚡' },
      [this.EXTRACTION_STATUS.PARTIAL]: { text: '部分', color: 'yellow', icon: '⚠' },
      [this.EXTRACTION_STATUS.ERROR]: { text: '失败', color: 'red', icon: '✗' },
      [this.EXTRACTION_STATUS.TIMEOUT]: { text: '超时', color: 'orange', icon: '⏱' }
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
    
    if (item.extractionStatus === this.EXTRACTION_STATUS.SUCCESS) score += 3;
    else if (item.extractionStatus === this.EXTRACTION_STATUS.CACHED) score += 2;
    
    if (score >= 6) return 'high';
    if (score >= 4) return 'medium';
    if (score >= 2) return 'low';
    return 'unknown';
  }

  /**
   * 获取默认全局统计
   */
  getDefaultGlobalStats() {
    return {
      totalItems: 0,
      expiredItems: 0,
      totalSize: 0,
      averageSize: 0,
      hitRate: 0,
      oldestItem: null,
      newestItem: null,
      mostAccessed: null
    };
  }

  /**
   * 获取默认用户统计
   */
  getDefaultUserStats() {
    return {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      successRate: 0,
      cacheItems: 0,
      averageSize: 0,
      totalAccess: 0,
      hitRate: 0
    };
  }

  /**
   * 获取默认效率统计
   */
  getDefaultEfficiencyStats() {
    return {
      hitRate: 0,
      timeSavedPerRequest: 0,
      totalTimeSaved: 0,
      efficiency: 'unknown'
    };
  }

  /**
   * 获取默认性能统计
   */
  getDefaultPerformanceStats() {
    return {
      averageTime: 0,
      fastestTime: 0,
      slowestTime: 0
    };
  }

  /**
   * 获取默认趋势统计
   */
  getDefaultTrendStats() {
    return {
      daily: [],
      weekly: [],
      monthly: []
    };
  }

  /**
   * 获取默认摘要
   */
  getDefaultSummary() {
    return {
      totalExtractions: 0,
      averageTime: 0,
      topSource: 'unknown'
    };
  }

  /**
   * 获取默认缓存统计
   */
  getDefaultCacheStats() {
    return {
      global: this.getDefaultGlobalStats(),
      user: this.getDefaultUserStats(),
      sourceTypes: [],
      efficiency: this.getDefaultEfficiencyStats(),
      recommendations: [],
      local: this.getLocalCacheStats()
    };
  }

  /**
   * 获取默认统计响应
   */
  getDefaultStatsResponse() {
    return {
      user: this.getDefaultUserStats(),
      sources: [],
      performance: this.getDefaultPerformanceStats(),
      cache: this.getDefaultCacheStats(),
      trends: this.getDefaultTrendStats(),
      realtime: {},
      summary: this.getDefaultSummary(),
      insights: []
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

    const validStatuses = Object.values(this.EXTRACTION_STATUS);
    if (!validStatuses.includes(result.extractionStatus)) {
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
      results.filter(r => r.extractionStatus === this.EXTRACTION_STATUS.SUCCESS || 
                         r.extractionStatus === this.EXTRACTION_STATUS.CACHED);

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
        },
        configService: await detailConfigAPI.checkServiceHealth()
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

  /**
   * 导出服务状态
   */
  exportServiceStatus() {
    return {
      type: 'detail-api-service',
      version: '3.0.0',
      localCacheStats: this.getLocalCacheStats(),
      cacheExpiration: this.cacheExpiration,
      maxCacheSize: this.maxCacheSize,
      activeProgressCallbacks: this.progressCallbacks.size,
      extractionQueue: this.extractionQueue.size,
      retryDelays: this.retryDelays,
      supportedSources: this.SUPPORTED_SOURCES,
      limits: this.LIMITS,
      timestamp: Date.now(),
      features: {
        enhancedErrorHandling: true,
        improvedCaching: true,
        batchProcessing: true,
        configAwareProcessing: true, // 新增：配置感知处理
        progressTracking: true,
        retryMechanism: true,
        statisticsReporting: true,
        backendSync: true,
        dynamicConfiguration: true // 新增：动态配置功能
      }
    };
  }

  /**
   * 重置服务状态
   */
  resetService() {
    this.clearLocalCache();
    this.progressCallbacks.clear();
    this.extractionQueue.clear();
    
    // 重置配置服务
    detailConfigAPI.reset();
    
    console.log('详情提取服务已重置');
  }

  /**
   * 获取服务配置信息
   */
  getServiceInfo() {
    return {
      supportedSources: this.SUPPORTED_SOURCES,
      limits: this.LIMITS,
      extractionStatuses: this.EXTRACTION_STATUS,
      cacheStats: this.getLocalCacheStats(),
      version: '3.0.0',
      configService: {
        available: true,
        cached: detailConfigAPI.isConfigCacheValid(),
        lastUpdate: detailConfigAPI.lastCacheTime
      }
    };
  }

  /**
   * 获取当前生效的配置摘要
   */
  async getEffectiveConfigSummary() {
    try {
      const configData = await detailConfigAPI.getUserConfig();
      const config = configData.config;
      
      return {
        extractionEnabled: config.enableDetailExtraction,
        autoExtraction: config.autoExtractDetails,
        timeout: config.extractionTimeout,
        batchSize: config.extractionBatchSize,
        concurrency: config.enableConcurrentExtraction ? config.maxConcurrentExtractions : 1,
        cacheEnabled: config.enableCache,
        localCacheEnabled: config.enableLocalCache,
        retryEnabled: config.enableRetry,
        maxRetries: config.maxRetryAttempts,
        isDefault: configData.isDefault,
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('获取生效配置摘要失败:', error);
      return {
        extractionEnabled: DEFAULT_USER_CONFIG.enableDetailExtraction,
        autoExtraction: DEFAULT_USER_CONFIG.autoExtractDetails,
        timeout: DEFAULT_USER_CONFIG.extractionTimeout,
        batchSize: DEFAULT_USER_CONFIG.extractionBatchSize,
        concurrency: DEFAULT_USER_CONFIG.maxConcurrentExtractions,
        cacheEnabled: DEFAULT_USER_CONFIG.enableCache,
        localCacheEnabled: DEFAULT_USER_CONFIG.enableLocalCache,
        retryEnabled: DEFAULT_USER_CONFIG.enableRetry,
        maxRetries: DEFAULT_USER_CONFIG.maxRetryAttempts,
        isDefault: true,
        error: error.message
      };
    }
  }

  /**
   * 预加载用户配置（用于优化性能）
   */
  async preloadUserConfig() {
    if (authManager.isAuthenticated()) {
      try {
        await detailConfigAPI.getUserConfig();
        console.log('用户配置预加载完成');
        return true;
      } catch (error) {
        console.warn('用户配置预加载失败:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 监听配置变更（如果需要实时更新）
   */
  onConfigChange(callback) {
    if (typeof callback === 'function') {
      // 简单的配置变更监听机制
      this.configChangeCallback = callback;
      
      // 当配置更新时调用回调
      const originalUpdateConfig = detailConfigAPI.updateUserConfig.bind(detailConfigAPI);
      detailConfigAPI.updateUserConfig = async (...args) => {
        const result = await originalUpdateConfig(...args);
        if (result.valid && this.configChangeCallback) {
          this.configChangeCallback(result.config);
        }
        return result;
      };
    }
  }

  /**
   * 移除配置变更监听
   */
  offConfigChange() {
    this.configChangeCallback = null;
  }
}

// 创建单例实例
export const detailAPIService = new DetailAPIService();
export default detailAPIService;