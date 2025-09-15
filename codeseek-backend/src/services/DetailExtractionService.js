// src/services/DetailExtractionService.js - 重构后的详情提取主服务

import { utils } from '../utils.js';
import { parserFactory } from '../parsers/ParserFactory.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';
import { extractionValidator } from './extraction-validator.js';
import { cacheManager } from './cache-manager.js';
import { CONFIG } from '../constants.js';

/**
 * 重构后的详情提取服务
 * 使用新的Parser架构，支持统一的数据结构
 */
export class DetailExtractionService {
  constructor() {
    this.defaultTimeout = CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT;
    this.maxConcurrentExtractions = CONFIG.DETAIL_EXTRACTION.MAX_CONCURRENT_EXTRACTIONS;
    this.retryAttempts = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS;
    this.retryDelay = CONFIG.DETAIL_EXTRACTION.RETRY_DELAY;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * 提取单个搜索结果的详情信息 - 新架构版本
   * @param {Object} searchResult - 搜索结果对象
   * @param {Object} options - 提取选项
   * @returns {ParsedData} 统一格式的详情数据
   */
  async extractSingleDetail(searchResult, options = {}) {
    const { timeout = this.defaultTimeout, enableRetry = true, enableCache = true } = options;
    const startTime = Date.now();

    try {
      console.log(`=== 开始详情提取 (新架构) ===`);
      console.log(`标题: ${searchResult.title}`);
      console.log(`搜索URL: ${searchResult.url}`);
      console.log(`原始ID: ${searchResult.id}`);

      // 检测源类型
      const sourceType = this.detectSourceType(searchResult);
      console.log(`检测到源类型: ${sourceType}`);

      // 获取对应的解析器
      const parser = parserFactory.getParser(sourceType);
      if (!parser) {
        throw new Error(`无法获取 ${sourceType} 解析器`);
      }

      // 检查缓存
      if (enableCache) {
        const cached = await this.getCachedResult(searchResult.url);
        if (cached) {
          console.log(`使用缓存结果: ${searchResult.title}`);
          return this.buildCachedResult(cached, searchResult, startTime);
        }
      }

      // 第一步：确定真正的详情页面URL
      const detailPageUrl = await this.findDetailPageUrl(searchResult, parser, timeout);
      console.log(`确定的详情页面URL: ${detailPageUrl}`);

      // 第二步：获取详情页面内容
      const pageContent = await this.fetchPageContent(detailPageUrl, parser, timeout);
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error('详情页面内容为空或过短');
      }

      // 第三步：解析详情信息
      const parsedData = await parser.parseDetailPage(pageContent, {
        originalUrl: detailPageUrl,
        originalTitle: searchResult.title
      });

      const extractionTime = Date.now() - startTime;

      // 增强和验证数据
      const enhancedData = this.enhanceExtractedData(parsedData, searchResult, detailPageUrl, extractionTime);

      // 缓存结果
      if (enableCache && enhancedData.extractionStatus === 'success') {
        await this.cacheResult(searchResult.url, enhancedData);
      }

      console.log(`详情提取成功: ${searchResult.title} (${extractionTime}ms)`);
      return enhancedData;

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      console.error(`详情提取失败 [${searchResult.title}]:`, error);

      // 重试机制
      if (enableRetry && this.retryAttempts > 0) {
        console.log(`尝试重试提取: ${searchResult.title}`);
        await utils.delay(this.retryDelay);
        
        return await this.extractSingleDetail(searchResult, {
          ...options,
          enableRetry: false
        });
      }

      // 返回错误结果
      return this.buildErrorResult(searchResult, error, extractionTime);
    }
  }

  /**
   * 批量提取详情信息 - 新架构版本
   * @param {Array} searchResults - 搜索结果数组
   * @param {Object} options - 提取选项
   * @returns {Array} 详情数据数组
   */
  async extractBatchDetails(searchResults, options = {}) {
    const {
      enableCache = true,
      timeout = this.defaultTimeout,
      onProgress = null,
      enableRetry = true,
      maxConcurrency = this.maxConcurrentExtractions
    } = options;

    console.log(`开始批量提取 ${searchResults.length} 个结果的详情信息 (新架构)`);

    const results = [];
    const concurrency = Math.min(maxConcurrency, searchResults.length);

    for (let i = 0; i < searchResults.length; i += concurrency) {
      const batch = searchResults.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (result, index) => {
        try {
          const globalIndex = i + index;
          
          const extractedDetails = await this.extractSingleDetail(result, {
            timeout,
            enableRetry,
            enableCache
          });

          onProgress && onProgress({
            current: globalIndex + 1,
            total: searchResults.length,
            status: extractedDetails.extractionStatus,
            item: result.title
          });

          return extractedDetails;

        } catch (error) {
          console.error(`批量提取详情失败 [${result.title}]:`, error);
          
          onProgress && onProgress({
            current: i + index + 1,
            total: searchResults.length,
            status: 'error',
            item: result.title,
            error: error.message
          });

          return this.buildErrorResult(result, error, 0);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + concurrency < searchResults.length) {
        await utils.delay(500);
      }
    }

    console.log(`批量提取完成: ${results.length}/${searchResults.length} (新架构)`);
    return results;
  }

  /**
   * 检测源类型
   * @param {Object} searchResult - 搜索结果
   * @returns {string} 源类型
   */
  detectSourceType(searchResult) {
    // 优先使用明确指定的源类型
    if (searchResult.source && typeof searchResult.source === 'string') {
      return searchResult.source.toLowerCase();
    }

    // 从URL检测
    if (searchResult.url) {
      return parserFactory.detectSourceTypeFromUrl(searchResult.url);
    }

    return 'generic';
  }

  /**
   * 查找真正的详情页面URL
   * @param {Object} searchResult - 搜索结果
   * @param {BaseParser} parser - 解析器实例
   * @param {number} timeout - 超时时间
   * @returns {string} 详情页面URL
   */
  async findDetailPageUrl(searchResult, parser, timeout) {
    try {
      // 检查URL是否已经是详情页
      if (parser.isValidDetailUrl(searchResult.url)) {
        console.log(`直接使用搜索URL作为详情页: ${searchResult.url}`);
        return searchResult.url;
      }

      // 获取搜索页面内容，查找详情链接
      console.log(`开始获取搜索页面内容以查找详情链接...`);
      const searchPageContent = await this.fetchPageContent(searchResult.url, parser, timeout);
      
      if (!searchPageContent) {
        throw new Error('无法获取搜索页面内容');
      }

      // 使用解析器提取详情链接
      const detailLinks = await parser.extractDetailLinks(searchPageContent, {
        baseUrl: searchResult.url,
        searchKeyword: this.extractSearchKeyword(searchResult)
      });

      if (detailLinks && detailLinks.length > 0) {
        // 验证和选择最佳链接
        const validLinks = detailLinks.filter(link => {
          const validation = link.validate();
          return validation.valid && parser.isSameDomain(link.url, searchResult.url);
        });
        
        if (validLinks.length > 0) {
          // 选择分数最高的链接
          validLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
          const bestMatch = validLinks[0];
          
          console.log(`选择最佳匹配: ${bestMatch.url} (分数: ${bestMatch.score})`);
          return bestMatch.url;
        }
      }

      console.warn('未找到有效的详情链接，使用原始URL');
      return searchResult.url;

    } catch (error) {
      console.error(`查找详情页URL失败: ${error.message}`);
      return searchResult.url;
    }
  }

  /**
   * 获取页面内容
   * @param {string} url - 页面URL
   * @param {BaseParser} parser - 解析器实例
   * @param {number} timeout - 超时时间
   * @returns {string} 页面内容
   */
  async fetchPageContent(url, parser, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`获取页面内容: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: parser.getRequestHeaders()
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      console.log(`页面内容长度: ${content.length}`);
      
      return content;

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 增强提取的数据
   * @param {ParsedData} parsedData - 解析的数据
   * @param {Object} searchResult - 原始搜索结果
   * @param {string} detailPageUrl - 详情页URL
   * @param {number} extractionTime - 提取时间
   * @returns {ParsedData} 增强后的数据
   */
  enhanceExtractedData(parsedData, searchResult, detailPageUrl, extractionTime) {
    // 确保包含原始搜索结果的关键标识信息
    const enhancedData = new ParsedData({
      ...parsedData.toJSON(),
      
      // 保留原始搜索结果的关键标识信息
      id: searchResult.id,
      originalId: searchResult.id,
      originalUrl: searchResult.url,
      originalTitle: searchResult.title,
      originalSource: searchResult.source,
      
      // 更新元数据
      detailUrl: detailPageUrl,
      searchUrl: searchResult.url,
      extractionStatus: 'success',
      extractionTime,
      extractedAt: Date.now()
    });

    return enhancedData;
  }

  /**
   * 构建缓存结果
   * @param {Object} cached - 缓存数据
   * @param {Object} searchResult - 搜索结果
   * @param {number} startTime - 开始时间
   * @returns {ParsedData} 结果数据
   */
  buildCachedResult(cached, searchResult, startTime) {
    const extractionTime = Date.now() - startTime;
    
    return new ParsedData({
      ...cached,
      
      // 保留原始搜索结果信息
      id: searchResult.id,
      originalId: searchResult.id,
      originalUrl: searchResult.url,
      originalTitle: searchResult.title,
      originalSource: searchResult.source,
      
      // 更新缓存状态
      extractionStatus: 'cached',
      extractionTime,
      extractedAt: Date.now()
    });
  }

  /**
   * 构建错误结果
   * @param {Object} searchResult - 搜索结果
   * @param {Error} error - 错误对象
   * @param {number} extractionTime - 提取时间
   * @returns {ParsedData} 错误结果
   */
  buildErrorResult(searchResult, error, extractionTime) {
    return new ParsedData({
      // 保留原始标识信息
      id: searchResult.id,
      originalId: searchResult.id,
      originalUrl: searchResult.url,
      originalTitle: searchResult.title,
      originalSource: searchResult.source,
      
      // 基本信息
      title: searchResult.title || '未知标题',
      
      // 错误状态
      extractionStatus: 'error',
      extractionError: error.message,
      extractionTime,
      extractedAt: Date.now(),
      detailUrl: searchResult.url,
      searchUrl: searchResult.url
    });
  }

  /**
   * 提取搜索关键词
   * @param {Object} searchResult - 搜索结果
   * @returns {string} 搜索关键词
   */
  extractSearchKeyword(searchResult) {
    const sources = [
      searchResult.keyword,
      searchResult.query,
      searchResult.title,
      searchResult.code
    ];
    
    for (const source of sources) {
      if (source && typeof source === 'string' && source.trim()) {
        return source.trim();
      }
    }
    
    // 尝试从URL中提取番号
    const urlCode = extractionValidator.extractCodeFromUrl(searchResult.url);
    if (urlCode) return urlCode;
    
    return '';
  }

  /**
   * 获取缓存结果
   * @param {string} url - URL
   * @returns {Object|null} 缓存结果
   */
  async getCachedResult(url) {
    try {
      return await cacheManager.getDetailCache(url);
    } catch (error) {
      console.warn('获取缓存失败:', error.message);
      return null;
    }
  }

  /**
   * 缓存结果
   * @param {string} url - URL
   * @param {ParsedData} data - 数据
   */
  async cacheResult(url, data) {
    try {
      await cacheManager.setDetailCache(url, data.toJSON(), CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION);
    } catch (error) {
      console.warn('缓存结果失败:', error.message);
    }
  }

  /**
   * 获取支持的站点信息
   * @returns {Array} 支持的站点列表
   */
  getSupportedSites() {
    return parserFactory.getAllParsersInfo();
  }

  /**
   * 验证解析器状态
   * @param {string} sourceType - 源类型
   * @returns {Object} 验证结果
   */
  async validateParser(sourceType) {
    return await parserFactory.validateParser(sourceType);
  }

  /**
   * 获取服务统计信息
   * @returns {Object} 统计信息
   */
  getServiceStats() {
    return {
      parserFactory: parserFactory.getStatistics(),
      supportedSites: parserFactory.getSupportedSites(),
      serviceInfo: {
        version: '2.0.0',
        architecture: 'modular_parsers',
        features: ['unified_data_structure', 'modular_parsers', 'intelligent_caching']
      }
    };
  }

  /**
   * 重新加载指定源的解析器
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否重载成功
   */
  reloadParser(sourceType) {
    return parserFactory.reloadParser(sourceType);
  }

  /**
   * 清除所有解析器缓存
   */
  clearParserCache() {
    parserFactory.clearCache();
  }
}

// 创建单例实例
export const detailExtractionService = new DetailExtractionService();

export default detailExtractionService;