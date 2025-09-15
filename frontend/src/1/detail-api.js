// src/services/detail-api.js - 适配后端新架构的详情提取API服务
// 与后端 DetailExtractionService 和模块化解析器架构完全对接

import apiService from './api.js';
import authManager from './auth.js';
import detailConfigAPI from './detail-config-api.js';
import { 
  DETAIL_EXTRACTION_STATUS,
  DEFAULT_USER_CONFIG 
} from '../core/detail-config.js';
import { APP_CONSTANTS } from '../core/constants.js';

class DetailAPIService {
  constructor() {
    this.requestCache = new Map();
    this.maxCacheSize = 100;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
    this.progressCallbacks = new Map();
    this.extractionQueue = new Map();
    this.retryDelays = [1000, 2000, 5000]; // 重试延迟时间
    this.version = '2.0.0'; // 架构升级版本
    
    // 状态常量 - 与后端同步
    this.EXTRACTION_STATUS = DETAIL_EXTRACTION_STATUS;
    
    // 支持的源类型 - 与后端SUPPORTED_SOURCE_TYPES同步
    this.SUPPORTED_SOURCES = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES;
    
    // API端点 - 适配新架构
    this.ENDPOINTS = {
      EXTRACT_SINGLE: '/api/detail/extract-single',
      EXTRACT_BATCH: '/api/detail/extract-batch',
      SUPPORTED_SITES: '/api/detail/supported-sites',
      VALIDATE_PARSER: '/api/detail/validate-parser',
      SERVICE_STATS: '/api/detail/service-stats',
      RELOAD_PARSER: '/api/detail/reload-parser',
      HISTORY: '/api/detail/history',
      CACHE_STATS: '/api/detail/cache/stats',
      CACHE_CLEAR: '/api/detail/cache/clear',
      CACHE_DELETE: '/api/detail/cache/delete',
      STATS: '/api/detail/stats'
    };
  }

  /**
   * 获取用户配置并应用到API调用选项 - 动态配置版本
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
   * 提取单个搜索结果的详情信息 - 新架构版本
   * 对应后端 extractSingleDetailHandler
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

      // 构建与后端完全匹配的请求数据 - 适配新架构
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

      console.log(`开始提取详情 (新架构): ${searchResult.title}`);
      console.log('使用配置:', configOptions);

      const response = await apiService.request(this.ENDPOINTS.EXTRACT_SINGLE, {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: configOptions.timeout
      });

      if (!response.success) {
        throw new Error(response.message || '详情提取失败');
      }

      // 处理后端响应 - 适配新架构响应格式
      const result = this.processExtractionResponse(response, searchResult);

      // 本地缓存成功的结果
      if (result.extractionStatus === this.EXTRACTION_STATUS.SUCCESS && configOptions.useLocalCache !== false) {
        this.setToLocalCache(cacheKey, result);
      }

      console.log(`详情提取完成 (新架构): ${searchResult.title} (状态: ${result.extractionStatus})`);
      return result;

    } catch (error) {
      console.error(`详情提取失败 [${searchResult.title}]:`, error);
      return this.createErrorResult(error, searchResult);
    }
  }

  /**
   * 批量提取搜索结果的详情信息 - 新架构版本
   * 对应后端 extractBatchDetailsHandler
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
      
      // 构建与后端完全匹配的请求数据 - 适配新架构
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

      console.log(`开始批量提取 ${searchResults.length} 个结果的详情 (新架构)`);
      console.log('批量提取配置:', configOptions);

      // 设置进度回调
      if (options.onProgress && typeof options.onProgress === 'function') {
        this.progressCallbacks.set(batchId, options.onProgress);
      }

      const response = await apiService.request(this.ENDPOINTS.EXTRACT_BATCH, {
        method: 'POST',
        body: JSON.stringify(requestData),
        timeout: configOptions.timeout * 2 // 批量请求给更长超时时间
      });

      // 清理进度回调
      this.progressCallbacks.delete(batchId);

      if (!response.success) {
        throw new Error(response.message || '批量详情提取失败');
      }

      // 处理批量响应 - 适配新架构响应格式
      return this.processBatchResponse(response, searchResults, options);

    } catch (error) {
      console.error('批量详情提取失败:', error);
      throw error;
    }
  }

  /**
   * 🆕 获取支持的站点信息 - 新架构端点
   * 对应后端 getSupportedSitesHandler
   */
  async getSupportedSites() {
    try {
      console.log('获取支持的站点信息 (新架构)');

      const response = await apiService.request(this.ENDPOINTS.SUPPORTED_SITES);

      if (!response.success) {
        throw new Error(response.message || '获取支持站点失败');
      }

      const sitesData = response.data || response;

      return {
        sites: sitesData.sites || [],
        metadata: sitesData.metadata || {
          architecture: 'modular_parsers',
          totalSites: 0,
          dataStructureVersion: '2.0'
        },
        // 站点详细信息
        siteDetails: this.buildSiteDetailsMap(sitesData.sites || []),
        // 解析器信息
        parsersInfo: sitesData.parsersInfo || [],
        lastUpdated: Date.now()
      };

    } catch (error) {
      console.error('获取支持站点失败:', error);
      return {
        sites: [],
        metadata: {
          architecture: 'modular_parsers',
          totalSites: 0,
          error: error.message
        },
        siteDetails: {},
        parsersInfo: [],
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * 🆕 验证解析器状态 - 新架构端点
   * 对应后端 validateParserHandler
   */
  async validateParser(sourceType) {
    if (!sourceType) {
      throw new Error('源类型不能为空');
    }

    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    try {
      console.log(`验证解析器状态 (新架构): ${sourceType}`);

      const params = new URLSearchParams({ sourceType });
      const response = await apiService.request(`${this.ENDPOINTS.VALIDATE_PARSER}?${params}`);

      if (!response.success) {
        throw new Error(response.message || '验证解析器失败');
      }

      const validationData = response.data || response;

      return {
        sourceType,
        validation: validationData.validation || {
          isValid: false,
          errors: ['验证失败'],
          features: []
        },
        metadata: validationData.metadata || {
          architecture: 'modular_parsers',
          timestamp: Date.now()
        }
      };

    } catch (error) {
      console.error('验证解析器失败:', error);
      return {
        sourceType,
        validation: {
          isValid: false,
          errors: [error.message],
          features: []
        },
        metadata: {
          architecture: 'modular_parsers',
          timestamp: Date.now(),
          error: error.message
        }
      };
    }
  }

  /**
   * 🆕 获取服务统计信息 - 新架构端点
   * 对应后端 getServiceStatsHandler
   */
  async getServiceStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    try {
      console.log('获取服务统计信息 (新架构)');

      const response = await apiService.request(this.ENDPOINTS.SERVICE_STATS);

      if (!response.success) {
        throw new Error(response.message || '获取服务统计失败');
      }

      const statsData = response.data || response;

      return {
        stats: statsData.stats || this.getDefaultServiceStats(),
        timestamp: statsData.timestamp || Date.now(),
        // 🆕 新架构特有统计
        parserFactory: statsData.parserFactory || {},
        supportedSites: statsData.supportedSites || [],
        serviceInfo: statsData.serviceInfo || {
          version: '2.0.0',
          architecture: 'modular_parsers'
        }
      };

    } catch (error) {
      console.error('获取服务统计失败:', error);
      return {
        stats: this.getDefaultServiceStats(),
        timestamp: Date.now(),
        error: error.message,
        parserFactory: {},
        supportedSites: [],
        serviceInfo: {
          version: '2.0.0',
          architecture: 'modular_parsers',
          error: error.message
        }
      };
    }
  }

  /**
   * 🆕 重新加载解析器 - 新架构端点（管理员功能）
   * 对应后端 reloadParserHandler
   */
  async reloadParser(sourceType) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    if (!sourceType) {
      throw new Error('源类型不能为空');
    }

    try {
      console.log(`重新加载解析器 (新架构): ${sourceType}`);

      const response = await apiService.request(this.ENDPOINTS.RELOAD_PARSER, {
        method: 'POST',
        body: JSON.stringify({ sourceType })
      });

      if (!response.success) {
        throw new Error(response.message || '重载解析器失败');
      }

      const reloadData = response.data || response;

      return {
        success: reloadData.success !== false,
        sourceType,
        message: reloadData.message || `${sourceType} 解析器重载成功`
      };

    } catch (error) {
      console.error('重载解析器失败:', error);
      return {
        success: false,
        sourceType,
        message: `${sourceType} 解析器重载失败: ${error.message}`,
        error: error.message
      };
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
   * 获取详情提取历史 - 保持兼容性
   * 对应后端 getDetailExtractionHistoryHandler
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

      const endpoint = `${this.ENDPOINTS.HISTORY}${params.toString() ? `?${params.toString()}` : ''}`;
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
   * 获取详情缓存统计 - 保持兼容性
   * 对应后端 getDetailCacheStatsHandler
   */
  async getCacheStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await apiService.request(this.ENDPOINTS.CACHE_STATS);

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
   * 清理详情缓存 - 保持兼容性
   * 对应后端 clearDetailCacheHandler
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

      const response = await apiService.request(`${this.ENDPOINTS.CACHE_CLEAR}?${params.toString()}`, {
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
   * 删除特定URL的详情缓存 - 保持兼容性
   * 对应后端 deleteDetailCacheHandler
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
      const response = await apiService.request(this.ENDPOINTS.CACHE_DELETE, {
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
   * 获取详情提取统计信息 - 保持兼容性
   * 对应后端 getDetailExtractionStatsHandler
   */
  async getStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未登录');
    }

    try {
      const response = await apiService.request(this.ENDPOINTS.STATS);

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
   * 处理单个提取响应 - 适配新架构
   */
  processExtractionResponse(response, originalResult) {
    const data = response.data || response;
    const detailInfo = data.detailInfo || data;
    const metadata = data.metadata || {};

    console.log('处理提取响应 (新架构):', {
      originalId: originalResult.id,
      originalTitle: originalResult.title,
      responseTitle: detailInfo.title,
      extractionStatus: detailInfo.extractionStatus,
      architecture: metadata.architecture || 'modular_parsers'
    });

    // 🆕 适配新架构的ParsedData格式
    return {
      // 关键修复：确保原始ID被正确保留并优先使用
      id: originalResult.id,
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
      
      // 🆕 新架构数据结构 - 适配ParsedData格式
      cover: detailInfo.cover || detailInfo.coverImage || '',
      coverImage: detailInfo.cover || detailInfo.coverImage || '', // 兼容性
      screenshots: Array.isArray(detailInfo.screenshots) ? detailInfo.screenshots : [],
      
      // 演员信息 - 支持actors和actresses字段
      actors: Array.isArray(detailInfo.actors) ? detailInfo.actors : 
              (Array.isArray(detailInfo.actresses) ? detailInfo.actresses : []),
      actresses: Array.isArray(detailInfo.actresses) ? detailInfo.actresses :
                 (Array.isArray(detailInfo.actors) ? detailInfo.actors : []), // 兼容性
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
      
      // 下载信息 - 支持新架构的链接格式
      downloadLinks: this.processDownloadLinks(detailInfo.downloadLinks || detailInfo.links),
      magnetLinks: this.processMagnetLinks(detailInfo.magnetLinks || detailInfo.links),
      links: detailInfo.links || [], // 新架构统一链接格式
      
      // 其他信息
      description: detailInfo.description || '',
      tags: this.processTags(detailInfo.tags || detailInfo.genres),
      genres: detailInfo.genres || detailInfo.tags || [], // 兼容性
      rating: typeof detailInfo.rating === 'number' ? detailInfo.rating : 0,
      
      // 提取元数据
      extractionStatus: detailInfo.extractionStatus || this.EXTRACTION_STATUS.SUCCESS,
      extractionTime: detailInfo.extractionTime || metadata.totalTime || 0,
      extractedAt: detailInfo.extractedAt || Date.now(),
      fromCache: metadata.fromCache || detailInfo.extractionStatus === this.EXTRACTION_STATUS.CACHED,
      retryCount: metadata.retryCount || 0,
      cacheKey: metadata.cacheKey || null,
      
      // 🆕 新架构元数据
      architecture: metadata.architecture || 'modular_parsers',
      dataStructureVersion: metadata.dataStructureVersion || '2.0',
      parser: metadata.parser || detailInfo.sourceType,
      configApplied: metadata.configApplied || false
    };
  }

  /**
   * 处理批量响应 - 适配新架构
   */
  processBatchResponse(response, originalResults, options) {
    const data = response.data || response;
    const results = data.results || [];
    const stats = data.stats || {};
    const summary = data.summary || {};
    const metadata = data.metadata || {};

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
        fromCache: result.extractionStatus === this.EXTRACTION_STATUS.CACHED,
        // 🆕 新架构标识
        architecture: metadata.architecture || 'modular_parsers',
        dataStructureVersion: metadata.dataStructureVersion || '2.0'
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
      },
      // 🆕 新架构元数据
      metadata: {
        architecture: metadata.architecture || 'modular_parsers',
        dataStructureVersion: metadata.dataStructureVersion || '2.0',
        batchSize: metadata.batchSize || originalResults.length,
        maxConcurrency: metadata.maxConcurrency || 1
      }
    };
  }

  /**
   * 🆕 处理下载链接 - 适配新架构链接格式
   */
  processDownloadLinks(links) {
    if (!Array.isArray(links)) return [];
    
    return links
      .filter(link => link.type === 'download' || link.type === 'http' || link.type === 'https')
      .map(link => ({
        url: link.url,
        name: link.name || '下载链接',
        size: link.size || '',
        quality: link.quality || '',
        type: link.type || 'download'
      }));
  }

  /**
   * 🆕 处理磁力链接 - 适配新架构链接格式
   */
  processMagnetLinks(links) {
    if (!Array.isArray(links)) return [];
    
    return links
      .filter(link => link.type === 'magnet')
      .map(link => ({
        magnet: link.url,
        url: link.url, // 兼容性
        name: link.name || '磁力链接',
        size: link.size || '',
        seeders: link.seeders || 0,
        leechers: link.leechers || 0
      }));
  }

  /**
   * 🆕 处理标签 - 适配新架构标签格式
   */
  processTags(tags) {
    if (!Array.isArray(tags)) return [];
    
    return tags.filter(tag => tag && tag.trim())
               .map(tag => typeof tag === 'string' ? tag.trim() : tag.name || '');
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
      suggestions: this.generateErrorSuggestions(error.name, error.message),
      // 🆕 新架构错误信息
      architecture: 'modular_parsers',
      dataStructureVersion: '2.0'
    };
  }

  // ===================== 新架构特有方法 =====================

  /**
   * 构建站点详细信息映射
   */
  buildSiteDetailsMap(sites) {
    const siteDetails = {};
    
    sites.forEach(site => {
      if (site.sourceType) {
        siteDetails[site.sourceType] = {
          className: site.className || 'UnknownParser',
          siteInfo: site.siteInfo || {},
          isActive: site.isActive !== false,
          features: site.siteInfo?.features || [],
          performance: site.siteInfo?.performance || {},
          lastValidated: site.siteInfo?.lastValidated || null,
          error: site.error || null
        };
      }
    });
    
    return siteDetails;
  }

  /**
   * 获取默认服务统计
   */
  getDefaultServiceStats() {
    return {
      parserFactory: {
        supportedSites: 0,
        cachedParsers: 0,
        supportedSitesList: [],
        cachedParsersList: []
      },
      supportedSites: [],
      serviceInfo: {
        version: '2.0.0',
        architecture: 'modular_parsers',
        features: []
      }
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
    
    // 系统级限制检查
    const maxBatchSize = 20; // 与后端CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE同步
    if (searchResults.length > maxBatchSize) {
      return {
        valid: false,
        message: `批量处理数量不能超过 ${maxBatchSize} 个`
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
   * 推断源类型
   */
  inferSourceType(url) {
    if (!url) return 'generic';
    
    const urlLower = url.toLowerCase();
    
    for (const sourceType of this.SUPPORTED_SOURCES) {
      if (sourceType !== 'generic' && urlLower.includes(sourceType)) {
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
      extractedAt: cached.extractedAt || Date.now(),
      // 🆕 新架构缓存标识
      architecture: cached.architecture || 'modular_parsers',
      dataStructureVersion: cached.dataStructureVersion || '2.0'
    };
  }

  // ===================== 本地缓存管理 =====================

  /**
   * 生成缓存键
   */
  generateCacheKey(url) {
    if (!url) return '';
    try {
      return 'detail_v2_' + btoa(encodeURIComponent(url)).substring(0, 16);
    } catch (error) {
      return 'detail_v2_' + url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }
  }

  /**
   * 生成批次ID
   */
  generateBatchId() {
    return 'batch_v2_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
      createdAt: Date.now(),
      version: '2.0' // 新架构版本标识
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
    console.log('本地详情缓存已清空 (v2.0)');
  }

  /**
   * 获取本地缓存统计
   */
  getLocalCacheStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalSize = 0;
    let v2Count = 0;

    for (const [key, cached] of this.requestCache) {
      if (now > cached.expiresAt) {
        expiredCount++;
      }
      if (cached.version === '2.0') {
        v2Count++;
      }
      totalSize += JSON.stringify(cached.data).length;
    }

    return {
      totalItems: this.requestCache.size,
      expiredItems: expiredCount,
      maxSize: this.maxCacheSize,
      totalSize,
      averageSize: this.requestCache.size > 0 ? Math.round(totalSize / this.requestCache.size) : 0,
      // 🆕 新架构统计
      v2Items: v2Count,
      version: '2.0'
    };
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
      console.log(`清理了 ${cleanedCount} 个本地过期缓存项 (v2.0)`);
    }

    return cleanedCount;
  }

  // ===================== 保持向后兼容的方法 =====================

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
        suggestions.push('如果问题持续，请联系支持');
        break;
    }
    
    return suggestions;
  }

  // ===================== 默认数据和工具方法 =====================

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
      [this.EXTRACTION_STATUS.TIMEOUT]: { text: '超时', color: 'orange', icon: 'ⱱ' }
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

  // 获取默认统计数据的方法保持不变...
  getDefaultGlobalStats() {
    return {
      totalItems: 0,
      expiredItems: 0,
      totalSize: 0,
      averageSize: 0,
      hitRate: 0
    };
  }

  getDefaultUserStats() {
    return {
      totalExtractions: 0,
      successfulExtractions: 0,
      cachedExtractions: 0,
      averageTime: 0,
      successRate: 0,
      cacheHitRate: 0
    };
  }

  getDefaultEfficiencyStats() {
    return {
      hitRate: 0,
      timeSavedPerRequest: 0,
      totalTimeSaved: 0,
      efficiency: 'unknown'
    };
  }

  getDefaultPerformanceStats() {
    return {
      averageTime: 0,
      fastestTime: 0,
      slowestTime: 0
    };
  }

  getDefaultTrendStats() {
    return {
      daily: [],
      weekly: [],
      monthly: []
    };
  }

  getDefaultSummary() {
    return {
      totalExtractions: 0,
      averageTime: 0,
      topSource: 'unknown'
    };
  }

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
   * 检查服务健康状态 - 新架构版本
   */
  async checkServiceHealth() {
    try {
      const startTime = Date.now();
      
      // 🆕 使用新架构端点进行健康检查
      const [statsHealth, sitesHealth, configHealth] = await Promise.allSettled([
        this.getServiceStats(),
        this.getSupportedSites(),
        detailConfigAPI.checkServiceHealth()
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: statsHealth.status === 'fulfilled',
        responseTime,
        timestamp: Date.now(),
        version: this.version,
        architecture: 'modular_parsers',
        components: {
          stats: statsHealth.status === 'fulfilled',
          sites: sitesHealth.status === 'fulfilled',
          config: configHealth.status === 'fulfilled' && configHealth.value?.healthy
        },
        localCache: {
          size: this.requestCache.size,
          maxSize: this.maxCacheSize,
          hitRate: this.calculateLocalCacheHitRate()
        },
        features: {
          modularParsers: true,
          dynamicConfiguration: true,
          enhancedCaching: true,
          unifiedDataStructure: true
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: Date.now(),
        version: this.version,
        architecture: 'modular_parsers',
        components: {
          stats: false,
          sites: false,
          config: false
        },
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
   * 导出服务状态 - 新架构版本
   */
  exportServiceStatus() {
    return {
      type: 'detail-api-service',
      version: this.version,
      architecture: 'modular_parsers',
      endpoints: this.ENDPOINTS,
      localCacheStats: this.getLocalCacheStats(),
      cacheExpiration: this.cacheExpiration,
      maxCacheSize: this.maxCacheSize,
      activeProgressCallbacks: this.progressCallbacks.size,
      extractionQueue: this.extractionQueue.size,
      retryDelays: this.retryDelays,
      supportedSources: this.SUPPORTED_SOURCES,
      timestamp: Date.now(),
      features: {
        modularParsers: true,
        dynamicConfiguration: true,
        unifiedDataStructure: true,
        enhancedErrorHandling: true,
        improvedCaching: true,
        batchProcessing: true,
        configAwareProcessing: true,
        progressTracking: true,
        retryMechanism: true,
        statisticsReporting: true,
        backendSync: true,
        parserValidation: true,
        serviceStats: true,
        parserReload: true
      }
    };
  }

  /**
   * 重置服务状态 - 新架构版本
   */
  resetService() {
    this.clearLocalCache();
    this.progressCallbacks.clear();
    this.extractionQueue.clear();
    
    // 重置配置服务
    detailConfigAPI.reset();
    
    console.log(`详情提取服务已重置 (${this.version})`);
  }

  /**
   * 获取服务信息 - 新架构版本
   */
  getServiceInfo() {
    return {
      version: this.version,
      architecture: 'modular_parsers',
      supportedSources: this.SUPPORTED_SOURCES,
      extractionStatuses: this.EXTRACTION_STATUS,
      endpoints: this.ENDPOINTS,
      cacheStats: this.getLocalCacheStats(),
      configService: {
        available: true,
        version: detailConfigAPI.version,
        cached: detailConfigAPI.isConfigCacheValid(),
        lastUpdate: detailConfigAPI.lastCacheTime
      },
      features: this.exportServiceStatus().features
    };
  }
}

// 创建单例实例
export const detailAPIService = new DetailAPIService();
export default detailAPIService;