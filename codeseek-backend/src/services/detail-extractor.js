// src/services/detail-extractor.js - 番号详情提取服务
import { utils } from '../utils.js';
import { contentParser } from './content-parser.js';
import { cacheManager } from './cache-manager.js';
import { CONFIG } from '../constants.js';

export class DetailExtractorService {
  constructor() {
    this.maxConcurrentExtractions = 3;
    this.defaultTimeout = 15000;
    this.retryAttempts = 2;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  /**
   * 批量提取详情信息
   * @param {Array} searchResults - 搜索结果数组
   * @param {Object} options - 提取选项
   * @returns {Array} 包含详情信息的结果数组
   */
  async extractBatchDetails(searchResults, options = {}) {
    const {
      enableCache = true,
      timeout = this.defaultTimeout,
      onProgress = null,
      enableRetry = true
    } = options;

    console.log(`开始批量提取 ${searchResults.length} 个结果的详情信息`);

    const results = [];
    const concurrency = Math.min(this.maxConcurrentExtractions, searchResults.length);

    // 分批处理，避免同时发起过多请求
    for (let i = 0; i < searchResults.length; i += concurrency) {
      const batch = searchResults.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (result, index) => {
        try {
          const globalIndex = i + index;
          
          // 检查缓存
          if (enableCache) {
            const cached = await cacheManager.getDetailCache(result.url);
            if (cached) {
              console.log(`使用缓存详情: ${result.title}`);
              onProgress && onProgress({
                current: globalIndex + 1,
                total: searchResults.length,
                status: 'cached',
                item: result.title
              });
              
              return {
                ...result,
                ...cached,
                extractionStatus: 'cached',
                extractionTime: 0
              };
            }
          }

          // 提取详情
          const extractedDetails = await this.extractSingleDetail(result, {
            timeout,
            enableRetry
          });

          // 缓存结果
          if (enableCache && extractedDetails.extractionStatus === 'success') {
            await cacheManager.setDetailCache(result.url, extractedDetails, 24 * 60 * 60 * 1000); // 24小时缓存
          }

          onProgress && onProgress({
            current: globalIndex + 1,
            total: searchResults.length,
            status: extractedDetails.extractionStatus,
            item: result.title
          });

          return {
            ...result,
            ...extractedDetails
          };

        } catch (error) {
          console.error(`批量提取详情失败 [${result.title}]:`, error);
          
          onProgress && onProgress({
            current: i + index + 1,
            total: searchResults.length,
            status: 'error',
            item: result.title,
            error: error.message
          });

          return {
            ...result,
            extractionStatus: 'error',
            extractionError: error.message,
            extractionTime: 0
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间延迟，避免频繁请求
      if (i + concurrency < searchResults.length) {
        await utils.delay(500);
      }
    }

    console.log(`批量提取完成: ${results.length}/${searchResults.length}`);
    return results;
  }

  /**
   * 提取单个结果的详情信息
   * @param {Object} searchResult - 搜索结果对象
   * @param {Object} options - 提取选项
   * @returns {Object} 详情信息对象
   */
  async extractSingleDetail(searchResult, options = {}) {
    const { timeout = this.defaultTimeout, enableRetry = true } = options;
    const startTime = Date.now();

    try {
      console.log(`开始提取详情: ${searchResult.title} - ${searchResult.url}`);

      // 检测搜索源类型
      const sourceType = this.detectSourceType(searchResult.url, searchResult.source);
      console.log(`检测到搜索源类型: ${sourceType}`);

      // 获取页面内容
      const pageContent = await this.fetchPageContent(searchResult.url, timeout);
      
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error('页面内容为空或过短');
      }

      // 解析详情信息
      const detailInfo = await contentParser.parseDetailPage(pageContent, {
        sourceType,
        originalUrl: searchResult.url,
        originalTitle: searchResult.title
      });

      const extractionTime = Date.now() - startTime;

      // 验证和增强数据
      const validatedDetails = this.validateAndEnhanceDetails(detailInfo, searchResult);

      console.log(`详情提取成功: ${searchResult.title} (${extractionTime}ms)`);

      return {
        ...validatedDetails,
        extractionStatus: 'success',
        extractionTime,
        sourceType,
        extractedAt: Date.now()
      };

    } catch (error) {
      const extractionTime = Date.now() - startTime;
      console.error(`详情提取失败 [${searchResult.title}]:`, error);

      // 重试机制
      if (enableRetry && this.retryAttempts > 0) {
        console.log(`尝试重试提取: ${searchResult.title}`);
        await utils.delay(1000);
        
        return await this.extractSingleDetail(searchResult, {
          ...options,
          enableRetry: false // 避免无限重试
        });
      }

      return {
        extractionStatus: 'error',
        extractionError: error.message,
        extractionTime,
        extractedAt: Date.now()
      };
    }
  }

  /**
   * 获取页面内容
   * @param {string} url - 页面URL
   * @param {number} timeout - 超时时间
   * @returns {string} 页面HTML内容
   */
  async fetchPageContent(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
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
   * 检测搜索源类型
   * @param {string} url - 搜索结果URL
   * @param {string} sourceId - 搜索源ID
   * @returns {string} 搜索源类型
   */
  detectSourceType(url, sourceId) {
    const urlLower = url.toLowerCase();
    
    // 基于URL特征检测
    if (urlLower.includes('javbus.com')) return 'javbus';
    if (urlLower.includes('javdb.com')) return 'javdb';
    if (urlLower.includes('javlibrary.com')) return 'javlibrary';
    if (urlLower.includes('jable.tv')) return 'jable';
    if (urlLower.includes('javmost.com')) return 'javmost';
    if (urlLower.includes('missav.com')) return 'missav';
    if (urlLower.includes('javhd.porn')) return 'javhdporn';
    if (urlLower.includes('javgg.net')) return 'javgg';
    if (urlLower.includes('av01.tv')) return 'av01';
    if (urlLower.includes('sukebei.nyaa.si')) return 'sukebei';
    
    // 基于搜索源ID
    if (sourceId) return sourceId;
    
    // 默认类型
    return 'generic';
  }

  /**
   * 验证和增强详情数据
   * @param {Object} detailInfo - 解析的详情信息
   * @param {Object} searchResult - 原始搜索结果
   * @returns {Object} 验证后的详情信息
   */
  validateAndEnhanceDetails(detailInfo, searchResult) {
    const validated = {
      // 基本信息
      title: detailInfo.title || searchResult.title || '未知标题',
      originalTitle: detailInfo.originalTitle || '',
      code: detailInfo.code || this.extractCodeFromTitle(searchResult.title) || '',
      
      // 媒体信息
      coverImage: this.validateImageUrl(detailInfo.coverImage) || '',
      screenshots: (detailInfo.screenshots || []).filter(url => this.validateImageUrl(url)),
      
      // 演员信息
      actresses: detailInfo.actresses || [],
      director: detailInfo.director || '',
      studio: detailInfo.studio || '',
      label: detailInfo.label || '',
      series: detailInfo.series || '',
      
      // 发布信息
      releaseDate: this.validateDate(detailInfo.releaseDate) || '',
      duration: detailInfo.duration || '',
      
      // 技术信息
      quality: detailInfo.quality || '',
      fileSize: detailInfo.fileSize || '',
      resolution: detailInfo.resolution || '',
      
      // 下载链接
      downloadLinks: this.validateDownloadLinks(detailInfo.downloadLinks || []),
      magnetLinks: this.validateMagnetLinks(detailInfo.magnetLinks || []),
      
      // 其他信息
      description: detailInfo.description || '',
      tags: detailInfo.tags || [],
      rating: this.validateRating(detailInfo.rating),
      
      // 元数据
      detailUrl: searchResult.url,
      sourceType: detailInfo.sourceType || 'unknown'
    };

    return validated;
  }

  /**
   * 从标题中提取番号
   * @param {string} title - 标题
   * @returns {string} 番号
   */
  extractCodeFromTitle(title) {
    if (!title) return '';
    
    // 常见番号格式正则表达式
    const patterns = [
      /([A-Z]{2,6}-?\d{3,6})/i,  // ABC-123, ABCD123
      /([A-Z]+\d{3,6})/i,        // ABC123
      /(\d{3,6}[A-Z]{2,6})/i     // 123ABC
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  /**
   * 验证图片URL
   * @param {string} url - 图片URL
   * @returns {boolean} 是否有效
   */
  validateImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 验证日期格式
   * @param {string} dateStr - 日期字符串
   * @returns {string} 格式化的日期
   */
  validateDate(dateStr) {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    } catch {
      return '';
    }
  }

  /**
   * 验证下载链接
   * @param {Array} links - 下载链接数组
   * @returns {Array} 验证后的链接数组
   */
  validateDownloadLinks(links) {
    if (!Array.isArray(links)) return [];
    
    return links.filter(link => {
      if (!link || typeof link !== 'object') return false;
      
      try {
        if (link.url) {
          const urlObj = new URL(link.url);
          return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        }
        return false;
      } catch {
        return false;
      }
    }).map(link => ({
      name: link.name || '下载链接',
      url: link.url,
      type: link.type || 'unknown',
      size: link.size || '',
      quality: link.quality || ''
    }));
  }

  /**
   * 验证磁力链接
   * @param {Array} magnetLinks - 磁力链接数组
   * @returns {Array} 验证后的磁力链接数组
   */
  validateMagnetLinks(magnetLinks) {
    if (!Array.isArray(magnetLinks)) return [];
    
    return magnetLinks.filter(link => {
      if (!link || typeof link !== 'object') return false;
      return link.magnet && link.magnet.startsWith('magnet:?xt=urn:btih:');
    }).map(link => ({
      name: link.name || '磁力链接',
      magnet: link.magnet,
      size: link.size || '',
      seeders: link.seeders || 0,
      leechers: link.leechers || 0,
      quality: link.quality || '',
      addedDate: link.addedDate || ''
    }));
  }

  /**
   * 验证评分
   * @param {number|string} rating - 评分
   * @returns {number} 验证后的评分
   */
  validateRating(rating) {
    if (rating === null || rating === undefined) return 0;
    
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    
    return Math.max(0, Math.min(10, numRating));
  }

  /**
   * 获取提取统计信息
   * @returns {Object} 统计信息
   */
  getExtractionStats() {
    return {
      totalExtractions: this.totalExtractions || 0,
      successfulExtractions: this.successfulExtractions || 0,
      failedExtractions: this.failedExtractions || 0,
      averageExtractionTime: this.averageExtractionTime || 0,
      cacheHitRate: this.cacheHitRate || 0
    };
  }
}

// 创建单例实例
export const detailExtractor = new DetailExtractorService();
export default detailExtractor;