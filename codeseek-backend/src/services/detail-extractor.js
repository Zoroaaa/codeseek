// src/services/detail-extractor.js - 修复版本：支持链接跟踪到详情页面
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

      // 第一步：获取搜索页面内容，查找详情页链接
      const detailPageUrl = await this.findDetailPageUrl(searchResult, sourceType, timeout);
      console.log(`找到详情页面URL: ${detailPageUrl}`);

      // 第二步：获取详情页面内容
      const pageContent = await this.fetchPageContent(detailPageUrl, timeout);
      
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error('详情页面内容为空或过短');
      }

      // 第三步：解析详情信息
      const detailInfo = await contentParser.parseDetailPage(pageContent, {
        sourceType,
        originalUrl: detailPageUrl,  // 使用详情页URL
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
        extractedAt: Date.now(),
        detailPageUrl // 保存详情页URL
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
   * 查找详情页面的实际URL
   * @param {Object} searchResult - 搜索结果
   * @param {string} sourceType - 源类型
   * @param {number} timeout - 超时时间
   * @returns {string} 详情页面URL
   */
// 在 detail-extractor.js 中修改 findDetailPageUrl 方法
async findDetailPageUrl(searchResult, sourceType, timeout) {
  try {
    // 如果搜索结果已经包含详情页URL，直接使用
    if (searchResult.detailUrl) {
      console.log(`使用预设的详情页URL: ${searchResult.detailUrl}`);
      return searchResult.detailUrl;
    }

    // 检查URL是否已经是详情页
    if (this.isDetailPageUrl(searchResult.url, sourceType)) {
      console.log(`搜索URL已经是详情页: ${searchResult.url}`);
      return searchResult.url;
    }

    // 获取搜索页面内容，查找详情链接
    console.log(`从搜索页面查找详情链接: ${searchResult.url}`);
    const searchPageContent = await this.fetchPageContent(searchResult.url, timeout);
    
    if (!searchPageContent) {
      throw new Error('无法获取搜索页面内容');
    }

    // 使用 contentParser 从搜索页面提取详情链接
    const detailLinks = await contentParser.extractDetailLinksFromSearchPage(searchPageContent, {
      sourceType,
      baseUrl: searchResult.url,
      searchKeyword: searchResult.title
    });

    if (detailLinks && detailLinks.length > 0) {
      // 选择匹配度最高的链接
      const bestMatch = detailLinks.reduce((best, current) => 
        (current.score || 0) > (best.score || 0) ? current : best
      );
      
      console.log(`找到最佳匹配详情链接: ${bestMatch.url}`);
      return bestMatch.url;
    }

    // 如果没有找到链接，降级到原始URL
    console.warn('未找到详情链接，使用原始URL');
    return searchResult.url;

  } catch (error) {
    console.warn(`查找详情页URL失败，使用原始URL: ${error.message}`);
    return searchResult.url;
  }
}

  /**
   * 检查URL是否已经是详情页
   * @param {string} url - URL
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否为详情页
   */
  isDetailPageUrl(url, sourceType) {
    const urlLower = url.toLowerCase();
    
    switch (sourceType) {
      case 'javbus':
        // JavBus详情页通常包含番号路径，如 /ABC-123
        return /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url) && !urlLower.includes('/search');
        
      case 'javdb':
        // JavDB详情页通常是 /v/xxxx 格式
        return /\/v\/[a-zA-Z0-9]+/.test(url);
        
      case 'javlibrary':
        // JavLibrary详情页通常包含 ?v= 参数
        return url.includes('?v=') && !urlLower.includes('vl_searchbyid');
        
      case 'jable':
        // Jable详情页通常是视频页面
        return /\/videos\/[^\/]+/.test(url);
        
      case 'missav':
        // MissAV详情页通常包含番号
        return /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url) && !urlLower.includes('/search');
        
      case 'sukebei':
        // Sukebei详情页通常是种子页面
        return /\/view\/\d+/.test(url);
        
      default:
        // 通用检查：包含常见详情页标识
        return !urlLower.includes('/search') && 
               !urlLower.includes('/list') && 
               !urlLower.includes('/category') &&
               (url.includes('?') || /\/[A-Z]{2,6}-?\d{3,6}/i.test(url));
    }
  }

  /**
   * 从搜索页面提取详情URL
   * @param {string} pageContent - 页面内容
   * @param {Object} searchResult - 搜索结果
   * @param {string} sourceType - 源类型
   * @returns {string} 详情页URL
   */
  async extractDetailUrlFromSearchPage(pageContent, searchResult, sourceType) {
    try {
      const parser = this.createDOMParser();
      const doc = parser.parseFromString(pageContent, 'text/html');
      
      // 根据不同源类型使用不同的选择器策略
      const detailLinkSelectors = this.getDetailLinkSelectors(sourceType);
      
      for (const selectorConfig of detailLinkSelectors) {
        const links = doc.querySelectorAll(selectorConfig.selector);
        
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;
          
          // 构建完整URL
          const fullUrl = this.resolveRelativeUrl(href, searchResult.url);
          
          // 验证链接是否匹配搜索结果
          if (this.isMatchingDetailLink(link, searchResult, selectorConfig)) {
            console.log(`找到匹配的详情链接: ${fullUrl}`);
            return fullUrl;
          }
        }
      }
      
      // 如果没有找到匹配的链接，返回第一个可能的详情链接
      const fallbackLink = this.findFallbackDetailLink(doc, searchResult, sourceType);
      if (fallbackLink) {
        return this.resolveRelativeUrl(fallbackLink, searchResult.url);
      }
      
      return null;
      
    } catch (error) {
      console.error('解析详情链接失败:', error);
      return null;
    }
  }

  /**
   * 删除原有的重复方法，避免代码冗余
   */

  // 删除以下方法，因为它们已经在内容解析器中实现：
  // - getDetailLinkSelectors
  // - isMatchingDetailLink  
  // - findFallbackDetailLink
  // - calculateSimilarity
  // - createDOMParser

  /**
   * 解析相对URL为绝对URL
   * @param {string} relativeUrl - 相对URL
   * @param {string} baseUrl - 基础URL
   * @returns {string} 绝对URL
   */
  resolveRelativeUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;

    try {
      const base = new URL(baseUrl);
      const resolved = new URL(relativeUrl, base);
      return resolved.href;
    } catch (error) {
      console.warn('URL解析失败:', error.message);
      return relativeUrl;
    }
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

  // ... 其他现有方法保持不变 ...
  
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
	    // 添加这些日志
  console.log(`=== 页面内容调试 [${url}] ===`);
  console.log('Content Length:', content.length);
  console.log('Content Preview (first 1000 chars):', content.substring(0, 1000));
  console.log('Content Contains Title Tags:', content.includes('<title>'));
  console.log('Content Contains Body Tags:', content.includes('<body>'));
  
  // 检查是否是错误页面或登录页面
  if (content.includes('登录') || content.includes('login') || content.includes('验证码')) {
    console.warn('⚠️ 可能获取到了登录页面');
  }
  if (content.includes('404') || content.includes('Not Found')) {
    console.warn('⚠️ 可能获取到了404页面');
  }
  if (content.includes('cloudflare') || content.includes('checking your browser')) {
    console.warn('⚠️ 可能被Cloudflare拦截');
  }
  
  console.log('=== 页面内容调试结束 ===');
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