// src/services/detail-extractor.js - 根据7个搜索源优化的详情提取主服务
import { utils } from '../utils.js';
import { searchLinkExtractor } from './search-link-extractor.js';
import { detailContentParser } from './detail-content-parser.js';
import { extractionValidator } from './extraction-validator.js';
import { cacheManager } from './cache-manager.js';
import { CONFIG, SOURCE_SPECIFIC_CONFIG, SPAM_DOMAINS } from '../constants.js';

export class DetailExtractorService {
  constructor() {
    this.maxConcurrentExtractions = CONFIG.DETAIL_EXTRACTION.MAX_CONCURRENT_EXTRACTIONS;
    this.defaultTimeout = CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT;
    this.retryAttempts = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS;
    this.retryDelay = CONFIG.DETAIL_EXTRACTION.RETRY_DELAY;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

/**
 * 提取单个搜索结果的详情信息 - 根据实际搜索数据优化版本
 * @param {Object} searchResult - 搜索结果对象
 * @param {Object} options - 提取选项
 * @returns {Object} 详情信息对象
 */
async extractSingleDetail(searchResult, options = {}) {
  const { timeout = this.defaultTimeout, enableRetry = true } = options;
  const startTime = Date.now();

  try {
    console.log(`=== 开始提取详情 (根据实际数据优化) ===`);
    console.log(`标题: ${searchResult.title}`);
    console.log(`搜索URL: ${searchResult.url}`);
    console.log(`原始ID: ${searchResult.id}`); // 添加ID日志

    // 检测搜索源类型 - 使用优化的检测逻辑
    const sourceType = extractionValidator.detectSourceType(searchResult.url, searchResult.source);
    const searchDomain = extractionValidator.extractDomain(searchResult.url);
    
    console.log(`检测到搜索源类型: ${sourceType}`);
    console.log(`搜索域名: ${searchDomain}`);
    console.log(`源配置存在: ${!!SOURCE_SPECIFIC_CONFIG[sourceType]}`);

    // 第一步：确定真正的详情页面URL
    const detailPageUrl = await this.findActualDetailPageUrl(searchResult, sourceType, searchDomain, timeout);
    console.log(`确定的详情页面URL: ${detailPageUrl}`);

    // 验证详情页面URL的有效性
    if (!extractionValidator.validateDetailPageUrl(detailPageUrl, searchResult.url, sourceType)) {
      throw new Error('未找到有效的详情页面URL');
    }

    // 第二步：获取详情页面内容
    const pageContent = await this.fetchPageContent(detailPageUrl, timeout);
    
    if (!pageContent || pageContent.trim().length < 100) {
      throw new Error('详情页面内容为空或过短');
    }

    console.log(`详情页面内容长度: ${pageContent.length}`);

    // 第三步：解析详情信息
    const detailInfo = await detailContentParser.parseDetailPage(pageContent, {
      sourceType,
      originalUrl: detailPageUrl,
      originalTitle: searchResult.title
    });

    const extractionTime = Date.now() - startTime;

    // 验证和增强数据
    const validatedDetails = this.validateAndEnhanceDetails(
      detailInfo, 
      searchResult, 
      detailPageUrl, 
      searchDomain,
      sourceType
    );

    console.log(`详情提取成功: ${searchResult.title} (${extractionTime}ms)`);

    // 关键修复：确保返回包含原始ID的完整数据
    return {
      // 保留原始搜索结果的关键标识信息
      id: searchResult.id,
      originalId: searchResult.id,
      originalUrl: searchResult.url,
      originalTitle: searchResult.title,
      originalSource: searchResult.source,
      
      // 验证后的详情数据
      ...validatedDetails,
      
      // 提取状态和元数据
      extractionStatus: 'success',
      extractionTime,
      sourceType,
      extractedAt: Date.now(),
      detailPageUrl,
      searchUrl: searchResult.url
    };

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

    // 错误情况也要保留原始ID
    return {
      // 保留原始标识信息
      id: searchResult.id,
      originalId: searchResult.id,
      originalUrl: searchResult.url,
      originalTitle: searchResult.title,
      originalSource: searchResult.source,
      
      // 错误状态
      extractionStatus: 'error',
      extractionError: error.message,
      extractionTime,
      extractedAt: Date.now(),
      detailPageUrl: searchResult.url,
      searchUrl: searchResult.url
    };
  }
}

  /**
   * 查找真正的详情页面URL - 根据实际数据优化版本
   * @param {Object} searchResult - 搜索结果
   * @param {string} sourceType - 源类型
   * @param {string} searchDomain - 搜索域名
   * @param {number} timeout - 超时时间
   * @returns {string} 详情页面URL
   */
  async findActualDetailPageUrl(searchResult, sourceType, searchDomain, timeout) {
    try {
      console.log(`=== 查找真实详情页面URL (根据实际数据优化) ===`);
      console.log(`搜索结果URL: ${searchResult.url}`);
      console.log(`源类型: ${sourceType}`);
      console.log(`搜索域名: ${searchDomain}`);
      
      // 检查URL是否已经是详情页
      const isAlreadyDetail = extractionValidator.isDetailPageUrl(searchResult.url, sourceType, searchDomain);
      console.log(`是否已经是详情页: ${isAlreadyDetail}`);
      
      if (isAlreadyDetail) {
        console.log(`直接使用搜索URL作为详情页: ${searchResult.url}`);
        return searchResult.url;
      }

      // 获取搜索页面内容，查找详情链接
      console.log(`开始获取搜索页面内容以查找详情链接...`);
      const searchPageContent = await this.fetchPageContent(searchResult.url, timeout);
      
      console.log(`搜索页面内容长度: ${searchPageContent?.length || 0}`);
      
      if (!searchPageContent) {
        throw new Error('无法获取搜索页面内容');
      }

      // 使用 searchLinkExtractor 从搜索页面提取详情链接
      console.log(`开始从搜索页面提取详情链接...`);
      const detailLinks = await searchLinkExtractor.extractDetailLinksFromSearchPage(searchPageContent, {
        sourceType,
        baseUrl: searchResult.url,
        searchKeyword: this.extractSearchKeyword(searchResult)
      });

      console.log(`提取到的详情链接数量: ${detailLinks?.length || 0}`);
      
      if (detailLinks && detailLinks.length > 0) {
        // 过滤和验证详情链接
        const validLinks = this.filterValidDetailLinks(detailLinks, searchDomain, searchResult.url, sourceType);
        
        if (validLinks.length > 0) {
          // 根据匹配分数和相关性选择最佳链接
          const bestMatch = this.selectBestDetailLink(validLinks, searchResult, sourceType);
          
          console.log(`选择最佳匹配: ${bestMatch.url}`);
          console.log(`匹配分数: ${bestMatch.score || bestMatch.enhancedScore}`);
          console.log(`匹配标题: ${bestMatch.title}`);
          
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
   * 过滤有效的详情链接 - 根据实际数据严格过滤
   */
  filterValidDetailLinks(detailLinks, searchDomain, searchUrl, sourceType) {
    console.log(`=== 过滤有效详情链接 ===`);
    console.log(`原始链接数量: ${detailLinks.length}`);
    console.log(`搜索域名: ${searchDomain}`);
    console.log(`搜索URL: ${searchUrl}`);

    const validLinks = detailLinks.filter(link => {
      // 1. 基本验证
      if (!link || !link.url || typeof link.url !== 'string') {
        console.log(`⌐ 跳过无效链接: ${link?.url || 'undefined'}`);
        return false;
      }

      // 2. 域名一致性检查（支持子域名）
      if (link.url.startsWith('http')) {
        const linkDomain = extractionValidator.extractDomain(link.url);
        if (!extractionValidator.isDomainOrSubdomainMatch(linkDomain, searchDomain)) {
          console.log(`⌐ 跳过不同域名链接: ${link.url} (${linkDomain} != ${searchDomain})`);
          return false;
        }
      }

      // 3. 确保不是搜索页面本身
      if (extractionValidator.normalizeUrl(link.url) === extractionValidator.normalizeUrl(searchUrl)) {
        console.log(`⌐ 跳过相同的搜索URL: ${link.url}`);
        return false;
      }

      // 4. 检查是否为详情页面URL
      if (!extractionValidator.isDetailPageUrl(link.url, sourceType, searchDomain)) {
        console.log(`⌐ 跳过非详情页面: ${link.url}`);
        return false;
      }

      // 5. 排除明显的搜索页面特征
      if (extractionValidator.containsSearchIndicators(link.url)) {
        console.log(`⌐ 跳过包含搜索指示器的链接: ${link.url}`);
        return false;
      }

      // 6. 检查垃圾域名（根据实际遇到的情况）
      const linkDomain = extractionValidator.extractDomain(link.url);
      if (SPAM_DOMAINS.some(spamDomain => linkDomain.includes(spamDomain))) {
        console.log(`⌐ 跳过垃圾域名: ${linkDomain}`);
        return false;
      }

      console.log(`✅ 通过验证的详情链接: ${link.url}`);
      return true;
    });

    console.log(`过滤后有效链接数量: ${validLinks.length}`);
    return validLinks;
  }

  /**
   * 选择最佳详情链接 - 根据实际数据优化版本
   */
  selectBestDetailLink(detailLinks, searchResult, sourceType) {
    console.log(`=== 选择最佳详情链接 ===`);
    
    const searchKeyword = this.extractSearchKeyword(searchResult);
    console.log(`搜索关键词: ${searchKeyword}`);
    
    const scoredLinks = detailLinks.map(link => {
      const enhancedScore = extractionValidator.calculateEnhancedMatchScore(link, searchResult, searchKeyword);
      console.log(`链接评分: ${link.url} - ${enhancedScore}分`);
      console.log(`  标题: ${link.title}`);
      console.log(`  番号: ${link.code}`);
      console.log(`  提取源: ${link.extractedFrom}`);
      
      return {
        ...link,
        enhancedScore
      };
    });
    
    // 按分数排序，优先选择高分链接
    scoredLinks.sort((a, b) => (b.enhancedScore || 0) - (a.enhancedScore || 0));
    
    const bestLink = scoredLinks[0];
    console.log(`最佳匹配选择: ${bestLink.url} (${bestLink.enhancedScore}分)`);
    
    return bestLink;
  }

  /**
   * 验证和增强详情数据 - 根据实际数据优化版本
   */
  validateAndEnhanceDetails(detailInfo, searchResult, detailPageUrl, searchDomain, sourceType) {
    console.log(`=== 验证和增强详情数据 ===`);
    console.log(`源类型: ${sourceType}`);
    console.log(`详情页URL: ${detailPageUrl}`);
    console.log(`搜索域名: ${searchDomain}`);

    const validated = {
      // 基本信息
      title: detailInfo.title || searchResult.title || '未知标题',
      originalTitle: detailInfo.originalTitle || '',
      code: detailInfo.code || 
            extractionValidator.extractCodeFromUrl(detailPageUrl) || 
            extractionValidator.extractCodeFromTitle(searchResult.title) || '',
      
      // 媒体信息
      coverImage: extractionValidator.validateImageUrl(detailInfo.coverImage) ? detailInfo.coverImage : '',
      screenshots: (detailInfo.screenshots || []).filter(url => extractionValidator.validateImageUrl(url)),
      
      // 演员信息
      actresses: detailInfo.actresses || [],
      director: detailInfo.director || '',
      studio: detailInfo.studio || '',
      label: detailInfo.label || '',
      series: detailInfo.series || '',
      
      // 发布信息
      releaseDate: extractionValidator.validateDate(detailInfo.releaseDate) || '',
      duration: detailInfo.duration || '',
      
      // 技术信息
      quality: detailInfo.quality || '',
      fileSize: detailInfo.fileSize || '',
      resolution: detailInfo.resolution || '',
      
      // 下载信息 - 严格过滤，确保域名一致
      downloadLinks: this.validateDownloadLinks(detailInfo.downloadLinks || [], searchDomain, sourceType),
      magnetLinks: extractionValidator.validateMagnetLinks(detailInfo.magnetLinks || []),
      
      // 其他信息
      description: detailInfo.description || '',
      tags: detailInfo.tags || [],
      rating: extractionValidator.validateRating(detailInfo.rating),
      
      // 元数据
      detailUrl: detailPageUrl,
      searchUrl: searchResult.url,
      sourceType: detailInfo.sourceType || sourceType
    };

    console.log(`验证完成，保留字段数量: ${Object.keys(validated).filter(k => validated[k] && (typeof validated[k] !== 'object' || validated[k].length > 0)).length}`);
    return validated;
  }

  /**
   * 验证下载链接 - 根据实际搜索源严格过滤
   */
  validateDownloadLinks(downloadLinks, expectedDomain, sourceType) {
    if (!Array.isArray(downloadLinks)) return [];

    console.log(`=== 验证下载链接 ===`);
    console.log(`原始下载链接数量: ${downloadLinks.length}`);
    console.log(`期望域名: ${expectedDomain}`);
    console.log(`源类型: ${sourceType}`);

    const validLinks = downloadLinks.filter(link => {
      if (!link || !link.url) return false;

      const linkDomain = extractionValidator.extractDomain(link.url);
      
      // 严格域名检查 - 必须匹配或是子域名
      if (!extractionValidator.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
        console.log(`⌐ 过滤不同域名的下载链接: ${link.url} (${linkDomain} != ${expectedDomain})`);
        return false;
      }

      // 检查垃圾域名
      if (SPAM_DOMAINS.some(domain => linkDomain.includes(domain))) {
        console.log(`⌐ 过滤垃圾域名下载链接: ${linkDomain}`);
        return false;
      }

      // 源特定验证
      const sourceConfig = SOURCE_SPECIFIC_CONFIG[sourceType];
      if (sourceConfig && sourceConfig.strictDomain) {
        // 对于需要严格域名检查的源（如Jable），确保域名完全匹配
        if (linkDomain !== expectedDomain) {
          console.log(`⌐ ${sourceType}严格域名检查失败: ${linkDomain} != ${expectedDomain}`);
          return false;
        }
      }

      console.log(`✅ 有效下载链接: ${link.url}`);
      return true;
    });

    console.log(`验证后有效下载链接数量: ${validLinks.length}`);
    return validLinks;
  }

  /**
   * 提取搜索关键词 - 优化版本
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
   * 获取页面内容 - 优化版本，根据源类型调整策略
   */
  async fetchPageContent(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`=== 开始获取页面内容 ===`);
      console.log(`URL: ${url}`);
      console.log(`超时时间: ${timeout}ms`);

      // 根据源类型调整请求头
      const sourceType = extractionValidator.detectSourceType(url);
      const headers = this.getSourceSpecificHeaders(sourceType);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers
      });

      clearTimeout(timeoutId);

      console.log(`响应状态: ${response.status} ${response.statusText}`);
      console.log(`内容类型: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      
      console.log(`=== 页面内容分析 ===`);
      console.log(`内容长度: ${content.length}`);
      
      const pageAnalysis = this.analyzePageContent(content, url, sourceType);
      console.log(`页面分析:`, pageAnalysis);
      
      if (pageAnalysis.hasIssues) {
        console.warn(`⚠️ 页面可能有问题:`, pageAnalysis.issues);
      }
      
      console.log(`=== 页面内容获取完成 ===`);
      return content;

    } catch (error) {
      clearTimeout(timeoutId);
      
      console.error(`=== 页面内容获取失败 ===`);
      console.error(`错误类型: ${error.name}`);
      console.error(`错误信息: ${error.message}`);
      
      if (error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      
      throw error;
    }
  }

  /**
   * 获取源特定的请求头
   */
  getSourceSpecificHeaders(sourceType) {
    const baseHeaders = {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    // 根据源类型添加特定头部
    switch (sourceType) {
      case 'jable':
        // Jable可能需要特定的Referer
        return {
          ...baseHeaders,
          'Referer': 'https://jable.tv/'
        };
      case 'javdb':
        // JavDB可能需要特定的Referer
        return {
          ...baseHeaders,
          'Referer': 'https://javdb.com/'
        };
      default:
        return baseHeaders;
    }
  }

  /**
   * 分析页面内容 - 根据源类型优化版本
   */
  analyzePageContent(content, url, sourceType) {
    const analysis = {
      hasTitle: false,
      hasBody: false,
      isLoginPage: false,
      is404Page: false,
      isCloudflareBlocked: false,
      hasVideoContent: false,
      hasDetailContent: false,
      hasIssues: false,
      issues: []
    };

    if (!content || content.length < 100) {
      analysis.hasIssues = true;
      analysis.issues.push('内容过短或为空');
      return analysis;
    }

    analysis.hasTitle = content.includes('<title>');
    analysis.hasBody = content.includes('<body>');

    const contentLower = content.toLowerCase();
    
    // 检查登录页面
    if (contentLower.includes('登录') || contentLower.includes('login') || 
        contentLower.includes('验证码') || contentLower.includes('captcha')) {
      analysis.isLoginPage = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能是登录页面');
    }
    
    // 检查404页面
    if (contentLower.includes('404') || contentLower.includes('not found') ||
        contentLower.includes('page not found')) {
      analysis.is404Page = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能是404页面');
    }
    
    // 检查Cloudflare拦截
    if (contentLower.includes('cloudflare') || 
        contentLower.includes('checking your browser') ||
        contentLower.includes('ddos protection')) {
      analysis.isCloudflareBlocked = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能被Cloudflare拦截');
    }

    // 根据源类型检查特定内容
    const sourceIndicators = this.getSourceSpecificIndicators(sourceType);
    analysis.hasDetailContent = sourceIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    // 检查视频内容
    const videoIndicators = ['<video', 'player', '.mp4', '.avi', 'stream'];
    analysis.hasVideoContent = videoIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    return analysis;
  }

  /**
   * 获取源特定的内容指示器
   */
  getSourceSpecificIndicators(sourceType) {
    const commonIndicators = [
      'video', 'movie', 'download', 'magnet', 'actress', 'genre',
      '演员', '导演', '发行', '番号', '磁力', '下载'
    ];

    switch (sourceType) {
      case 'javbus':
        return [...commonIndicators, 'movie-box', 'screencap', 'star-name'];
      case 'javdb':
        return [...commonIndicators, 'video-cover', 'panel-block', 'tile-images'];
      case 'jable':
        return [...commonIndicators, 'video-item', 'models', 'video-title'];
      case 'javgg':
        return [...commonIndicators, 'video-cover', 'screenshots'];
      case 'javmost':
        return [...commonIndicators, 'video-item', 'actress'];
      case 'sukebei':
        return [...commonIndicators, 'torrent', 'magnet', 'seeders'];
      case 'javguru':
        return [...commonIndicators, 'video-title', 'description'];
      default:
        return commonIndicators;
    }
  }

  // ==================== 批量提取方法 ====================

  /**
   * 批量提取详情信息 - 保持原有接口
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

    for (let i = 0; i < searchResults.length; i += concurrency) {
      const batch = searchResults.slice(i, i + concurrency);
      
      const batchPromises = batch.map(async (result, index) => {
        try {
          const globalIndex = i + index;
          
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

          const extractedDetails = await this.extractSingleDetail(result, {
            timeout,
            enableRetry
          });

          if (enableCache && extractedDetails.extractionStatus === 'success') {
            await cacheManager.setDetailCache(result.url, extractedDetails, CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION);
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

      if (i + concurrency < searchResults.length) {
        await utils.delay(500);
      }
    }

    console.log(`批量提取完成: ${results.length}/${searchResults.length}`);
    return results;
  }

  /**
   * 获取提取统计信息
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