// src/services/detail-extractor.js - 优化版本：严格的详情页面识别和域名验证
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
   * 提取单个结果的详情信息 - 优化版本
   * @param {Object} searchResult - 搜索结果对象
   * @param {Object} options - 提取选项
   * @returns {Object} 详情信息对象
   */
  async extractSingleDetail(searchResult, options = {}) {
    const { timeout = this.defaultTimeout, enableRetry = true } = options;
    const startTime = Date.now();

    try {
      console.log(`=== 开始提取详情 (优化版本) ===`);
      console.log(`标题: ${searchResult.title}`);
      console.log(`搜索URL: ${searchResult.url}`);

      // 检测搜索源类型
      const sourceType = this.detectSourceType(searchResult.url, searchResult.source);
      const searchDomain = this.extractDomain(searchResult.url);
      
      console.log(`检测到搜索源类型: ${sourceType}`);
      console.log(`搜索域名: ${searchDomain}`);

      // 第一步：确定真正的详情页面URL
      const detailPageUrl = await this.findActualDetailPageUrl(searchResult, sourceType, searchDomain, timeout);
      console.log(`确定的详情页面URL: ${detailPageUrl}`);

      // 验证详情页面URL的有效性
      if (!this.validateDetailPageUrl(detailPageUrl, searchResult.url, sourceType)) {
        throw new Error('未找到有效的详情页面URL');
      }

      // 第二步：获取详情页面内容
      const pageContent = await this.fetchPageContent(detailPageUrl, timeout);
      
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error('详情页面内容为空或过短');
      }

      console.log(`详情页面内容长度: ${pageContent.length}`);

      // 第三步：解析详情信息
      const detailInfo = await contentParser.parseDetailPage(pageContent, {
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
        searchDomain
      );

      console.log(`详情提取成功: ${searchResult.title} (${extractionTime}ms)`);

      return {
        ...validatedDetails,
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
        await utils.delay(1000);
        
        return await this.extractSingleDetail(searchResult, {
          ...options,
          enableRetry: false
        });
      }

      return {
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
   * 查找真正的详情页面URL - 优化版本
   * @param {Object} searchResult - 搜索结果
   * @param {string} sourceType - 源类型
   * @param {string} searchDomain - 搜索域名
   * @param {number} timeout - 超时时间
   * @returns {string} 详情页面URL
   */
  async findActualDetailPageUrl(searchResult, sourceType, searchDomain, timeout) {
    try {
      console.log(`=== 查找真实详情页面URL (优化版本) ===`);
      console.log(`搜索结果URL: ${searchResult.url}`);
      console.log(`源类型: ${sourceType}`);
      console.log(`搜索域名: ${searchDomain}`);
      
      // 检查URL是否已经是详情页
      const isAlreadyDetail = this.isDetailPageUrl(searchResult.url, sourceType, searchDomain);
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

      // 使用 contentParser 从搜索页面提取详情链接
      console.log(`开始从搜索页面提取详情链接...`);
      const detailLinks = await contentParser.extractDetailLinksFromSearchPage(searchPageContent, {
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
          console.log(`匹配分数: ${bestMatch.score}`);
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
   * 过滤有效的详情链接 - 新增方法
   * @param {Array} detailLinks - 详情链接数组
   * @param {string} searchDomain - 搜索域名
   * @param {string} searchUrl - 搜索URL
   * @param {string} sourceType - 源类型
   * @returns {Array} 过滤后的有效链接数组
   */
  filterValidDetailLinks(detailLinks, searchDomain, searchUrl, sourceType) {
    console.log(`=== 过滤有效详情链接 ===`);
    console.log(`原始链接数量: ${detailLinks.length}`);
    console.log(`搜索域名: ${searchDomain}`);
    console.log(`搜索URL: ${searchUrl}`);

    const validLinks = detailLinks.filter(link => {
      // 1. 基本验证
      if (!link || !link.url || typeof link.url !== 'string') {
        console.log(`❌ 跳过无效链接: ${link?.url || 'undefined'}`);
        return false;
      }

      // 2. 域名一致性检查（磁力链接等特殊协议除外）
      if (link.url.startsWith('http')) {
        const linkDomain = this.extractDomain(link.url);
        if (linkDomain !== searchDomain) {
          console.log(`❌ 跳过不同域名链接: ${link.url} (${linkDomain} != ${searchDomain})`);
          return false;
        }
      }

      // 3. 确保不是搜索页面本身
      if (this.normalizeUrl(link.url) === this.normalizeUrl(searchUrl)) {
        console.log(`❌ 跳过相同的搜索URL: ${link.url}`);
        return false;
      }

      // 4. 检查是否为详情页面URL
      if (!this.isDetailPageUrl(link.url, sourceType, searchDomain)) {
        console.log(`❌ 跳过非详情页面: ${link.url}`);
        return false;
      }

      // 5. 排除明显的搜索页面特征
      if (this.containsSearchIndicators(link.url)) {
        console.log(`❌ 跳过包含搜索指示器的链接: ${link.url}`);
        return false;
      }

      console.log(`✅ 通过验证的详情链接: ${link.url}`);
      return true;
    });

    console.log(`过滤后有效链接数量: ${validLinks.length}`);
    return validLinks;
  }

  /**
   * 检查URL是否包含搜索指示器 - 新增方法
   * @param {string} url - URL
   * @returns {boolean} 是否包含搜索指示器
   */
  containsSearchIndicators(url) {
    const urlLower = url.toLowerCase();
    
    const searchIndicators = [
      '/search/', '/search?', '?q=', '?s=', '?query=', '?keyword=',
      '/page/', '/list/', '/category/', '/genre/', '/actresses/',
      '/studio/', '/label/', '/uncensored/', '/forum/', '/doc/',
      '/terms', '/privacy', '/login', '/register'
    ];

    return searchIndicators.some(indicator => urlLower.includes(indicator));
  }

  /**
   * 检查URL是否为详情页面 - 增强版本
   * @param {string} url - URL
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为详情页
   */
  isDetailPageUrl(url, sourceType, expectedDomain) {
    if (!url || typeof url !== 'string') return false;

    const urlLower = url.toLowerCase();
    const urlDomain = this.extractDomain(url);

    // 验证域名一致性（HTTP链接）
    if (url.startsWith('http') && urlDomain !== expectedDomain) {
      return false;
    }

    // 排除明显的非详情页面
    if (this.containsSearchIndicators(url)) {
      return false;
    }

    // 根据源类型进行专门验证
    switch (sourceType) {
      case 'javbus':
        return this.isJavBusDetailPage(url);
        
      case 'javdb':
        return this.isJavDBDetailPage(url);
        
      case 'javlibrary':
        return this.isJavLibraryDetailPage(url);
        
      case 'jable':
        return this.isJableDetailPage(url);
        
      case 'missav':
        return this.isMissAVDetailPage(url);
        
      case 'sukebei':
        return this.isSukebeiDetailPage(url);
        
      case 'javmost':
        return this.isJavMostDetailPage(url);
        
      case 'javguru':
        return this.isJavGuruDetailPage(url);
        
      default:
        return this.isGenericDetailPage(url);
    }
  }

  /**
   * JavBus详情页面验证 - 新增方法
   */
  isJavBusDetailPage(url) {
    // JavBus详情页通常包含番号路径，如 /ABC-123
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    const notGenrePage = !url.toLowerCase().includes('/genre/');
    const notActressPage = !url.toLowerCase().includes('/actresses/');
    
    return hasCodePattern && notSearchPage && notGenrePage && notActressPage;
  }

  /**
   * JavDB详情页面验证 - 新增方法
   */
  isJavDBDetailPage(url) {
    // JavDB详情页通常是 /v/xxxx 格式
    const hasVideoPattern = /\/v\/[a-zA-Z0-9]+/.test(url);
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return (hasVideoPattern || hasCodePattern) && notSearchPage;
  }

  /**
   * JavLibrary详情页面验证 - 新增方法
   */
  isJavLibraryDetailPage(url) {
    // JavLibrary详情页通常包含 ?v= 参数
    const hasVideoParam = /\?v=[a-zA-Z0-9]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes('vl_searchbyid');
    
    return hasVideoParam && notSearchPage;
  }

  /**
   * Jable详情页面验证 - 新增方法
   */
  isJableDetailPage(url) {
    // Jable详情页通常是视频页面 /videos/xxx
    const hasVideoPath = /\/videos\/[^\/\?]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasVideoPath && notSearchPage;
  }

  /**
   * MissAV详情页面验证 - 新增方法
   */
  isMissAVDetailPage(url) {
    // MissAV详情页通常包含番号
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    const notActressPage = !url.toLowerCase().includes('/actresses/');
    
    return hasCodePattern && notSearchPage && notActressPage;
  }

  /**
   * Sukebei详情页面验证 - 新增方法
   */
  isSukebeiDetailPage(url) {
    // Sukebei详情页通常是种子页面 /view/数字
    const hasViewPattern = /\/view\/\d+/.test(url);
    
    return hasViewPattern;
  }

  /**
   * JavMost详情页面验证 - 新增方法
   */
  isJavMostDetailPage(url) {
    // JavMost详情页通常包含番号路径
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasCodePattern && notSearchPage;
  }

  /**
   * JavGuru详情页面验证 - 新增方法
   */
  isJavGuruDetailPage(url) {
    // JavGuru的详情页模式
    const notSearchPage = !url.toLowerCase().includes('?s=');
    const hasDetailIndicators = /\/(watch|video|play)\//.test(url.toLowerCase()) || 
                               /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    
    return notSearchPage && hasDetailIndicators;
  }

  /**
   * 通用详情页面验证 - 新增方法
   */
  isGenericDetailPage(url) {
    const urlLower = url.toLowerCase();
    
    // 详情页面特征
    const detailIndicators = [
      '/video/', '/watch/', '/play/', '/view/', '/detail/',
      '/movie/', '/film/', '/content/'
    ];
    
    const hasDetailIndicator = detailIndicators.some(indicator => 
      urlLower.includes(indicator)
    );
    
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    
    return hasDetailIndicator || hasCodePattern;
  }

  /**
   * 验证详情页面URL - 新增方法
   * @param {string} detailUrl - 详情页面URL
   * @param {string} searchUrl - 搜索URL
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否为有效的详情页面URL
   */
  validateDetailPageUrl(detailUrl, searchUrl, sourceType) {
    console.log(`=== 验证详情页面URL ===`);
    console.log(`详情URL: ${detailUrl}`);
    console.log(`搜索URL: ${searchUrl}`);

    // 1. 基本验证
    if (!detailUrl || typeof detailUrl !== 'string') {
      console.log(`❌ 详情URL无效`);
      return false;
    }

    // 2. 不能与搜索URL完全相同
    if (this.normalizeUrl(detailUrl) === this.normalizeUrl(searchUrl)) {
      console.log(`❌ 详情URL与搜索URL相同`);
      return false;
    }

    // 3. 域名必须一致
    const detailDomain = this.extractDomain(detailUrl);
    const searchDomain = this.extractDomain(searchUrl);
    
    if (detailDomain !== searchDomain) {
      console.log(`❌ 域名不一致: ${detailDomain} != ${searchDomain}`);
      return false;
    }

    // 4. 必须是详情页面格式
    if (!this.isDetailPageUrl(detailUrl, sourceType, searchDomain)) {
      console.log(`❌ 不是有效的详情页面格式`);
      return false;
    }

    console.log(`✅ 详情页面URL验证通过`);
    return true;
  }

  /**
   * 提取域名 - 新增工具方法
   * @param {string} url - URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  /**
   * 标准化URL - 新增工具方法
   * @param {string} url - URL
   * @returns {string} 标准化的URL
   */
  normalizeUrl(url) {
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      // 移除尾部斜杠和常见查询参数
      let normalized = urlObj.origin + urlObj.pathname;
      
      // 移除尾部斜杠
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }
      
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * 验证和增强详情数据 - 增强版本
   * @param {Object} detailInfo - 解析的详情信息
   * @param {Object} searchResult - 原始搜索结果
   * @param {string} detailPageUrl - 详情页URL
   * @param {string} searchDomain - 搜索域名
   * @returns {Object} 验证后的详情信息
   */
  validateAndEnhanceDetails(detailInfo, searchResult, detailPageUrl, searchDomain) {
    const validated = {
      // 基本信息
      title: detailInfo.title || searchResult.title || '未知标题',
      originalTitle: detailInfo.originalTitle || '',
      code: detailInfo.code || this.extractCodeFromUrl(detailPageUrl) || 
            this.extractCodeFromTitle(searchResult.title) || '',
      
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
      
      // 下载链接 - 严格过滤，确保域名一致
      downloadLinks: this.validateAndFilterDownloadLinks(detailInfo.downloadLinks || [], searchDomain),
      magnetLinks: this.validateMagnetLinks(detailInfo.magnetLinks || []),
      
      // 其他信息
      description: detailInfo.description || '',
      tags: detailInfo.tags || [],
      rating: this.validateRating(detailInfo.rating),
      
      // 元数据
      detailUrl: detailPageUrl,
      searchUrl: searchResult.url,
      sourceType: detailInfo.sourceType || 'unknown'
    };

    return validated;
  }

  /**
   * 验证和过滤下载链接 - 增强版本，增加域名验证
   * @param {Array} links - 下载链接数组
   * @param {string} expectedDomain - 期望的域名
   * @returns {Array} 过滤后的链接数组
   */
  validateAndFilterDownloadLinks(links, expectedDomain) {
    if (!Array.isArray(links)) return [];
    
    return links.filter(link => {
      if (!link || typeof link !== 'object') return false;
      
      // 验证URL有效性
      if (!link.url || !this.validateImageUrl(link.url)) return false;
      
      // 对于HTTP链接，验证域名一致性
      if (link.url.startsWith('http')) {
        const linkDomain = this.extractDomain(link.url);
        if (linkDomain !== expectedDomain) {
          console.log(`❌ 过滤不同域名的下载链接: ${link.url} (${linkDomain} != ${expectedDomain})`);
          return false;
        }
      }
      
      // 过滤掉明显的垃圾链接
      const urlLower = link.url.toLowerCase();
      const nameLower = (link.name || '').toLowerCase();
      
      const excludeDomains = [
        'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
        'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
        'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
        'mnaspm.com', 'asacp.org', 'pr0rze.vip'
      ];
      
      // 排除垃圾域名
      if (excludeDomains.some(domain => urlLower.includes(domain))) {
        console.log(`❌ 过滤垃圾域名链接: ${link.url}`);
        return false;
      }
      
      // 排除明显的导航链接
      const excludeTexts = [
        'english', '中文', '日本語', '한국의', '有碼', '無碼', '女優', '類別',
        '論壇', '下一頁', '上一頁', '首頁', 'terms', 'privacy', '登入', 'agent_code'
      ];
      
      if (excludeTexts.some(text => nameLower.includes(text.toLowerCase()))) {
        console.log(`❌ 过滤导航文本链接: ${link.name}`);
        return false;
      }
      
      return true;
    }).map(link => ({
      name: link.name || '下载链接',
      url: link.url,
      type: link.type || 'unknown',
      size: link.size || '',
      quality: link.quality || ''
    }));
  }

  // 保持原有的其他验证方法...
  validateImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  validateDate(dateStr) {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

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

  validateRating(rating) {
    if (rating === null || rating === undefined) return 0;
    
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    
    return Math.max(0, Math.min(10, numRating));
  }

  extractCodeFromTitle(title) {
    if (!title) return '';
    
    const patterns = [
      /([A-Z]{2,6}-?\d{3,6})/i,
      /([A-Z]+\d{3,6})/i,
      /(\d{3,6}[A-Z]{2,6})/i
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  extractCodeFromUrl(url) {
    if (!url) return '';
    
    const patterns = [
      /\/([A-Z]{2,6}-?\d{3,6})(?:\/|$)/i,
      /[?&].*?([A-Z]{2,6}-?\d{3,6})/i
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  // 保持原有的其他方法...
  detectSourceType(url, sourceId) {
    const urlLower = url.toLowerCase();
    
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
    if (urlLower.includes('jav.guru')) return 'javguru';
    
    if (sourceId) return sourceId;
    
    return 'generic';
  }

  selectBestDetailLink(detailLinks, searchResult, sourceType) {
    console.log(`=== 选择最佳详情链接 ===`);
    
    const searchKeyword = this.extractSearchKeyword(searchResult);
    console.log(`搜索关键词: ${searchKeyword}`);
    
    const scoredLinks = detailLinks.map(link => {
      const enhancedScore = this.calculateEnhancedMatchScore(link, searchResult, searchKeyword);
      console.log(`链接评分: ${link.url} - ${enhancedScore}分`);
      console.log(`  标题: ${link.title}`);
      console.log(`  番号: ${link.code}`);
      
      return {
        ...link,
        enhancedScore
      };
    });
    
    scoredLinks.sort((a, b) => (b.enhancedScore || 0) - (a.enhancedScore || 0));
    
    const bestLink = scoredLinks[0];
    console.log(`最佳匹配选择: ${bestLink.url} (${bestLink.enhancedScore}分)`);
    
    return bestLink;
  }

  calculateEnhancedMatchScore(link, searchResult, searchKeyword) {
    let score = link.score || 0;
    
    if (searchKeyword && link.code) {
      if (searchKeyword.toLowerCase() === link.code.toLowerCase()) {
        score += 30;
      } else if (link.code.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                 searchKeyword.toLowerCase().includes(link.code.toLowerCase())) {
        score += 20;
      }
    }
    
    if (searchResult.title && link.title) {
      const titleSimilarity = this.calculateTextSimilarity(
        searchResult.title.toLowerCase(), 
        link.title.toLowerCase()
      );
      score += titleSimilarity * 15;
    }
    
    if (this.isHighQualityDetailUrl(link.url, searchResult.source)) {
      score += 10;
    }
    
    if (link.extractedFrom === 'javbus_moviebox' || 
        link.extractedFrom === 'javdb_video' ||
        link.extractedFrom === 'javlibrary_video') {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  isHighQualityDetailUrl(url, source) {
    const urlLower = url.toLowerCase();
    
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(url)) return true;
    
    const qualityPatterns = [
      /\/v\/[a-zA-Z0-9]+/,
      /\?v=[a-zA-Z0-9]+/,
      /\/videos\/[^\/]+/,
      /\/view\/\d+/
    ];
    
    return qualityPatterns.some(pattern => pattern.test(url));
  }

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
    
    const urlCode = this.extractCodeFromUrl(searchResult.url);
    if (urlCode) return urlCode;
    
    return '';
  }

  async fetchPageContent(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`=== 开始获取页面内容 ===`);
      console.log(`URL: ${url}`);
      console.log(`超时时间: ${timeout}ms`);

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

      console.log(`响应状态: ${response.status} ${response.statusText}`);
      console.log(`内容类型: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      
      console.log(`=== 页面内容分析 ===`);
      console.log(`内容长度: ${content.length}`);
      
      const pageAnalysis = this.analyzePageContent(content, url);
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

  analyzePageContent(content, url) {
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
    
    if (contentLower.includes('登录') || contentLower.includes('login') || 
        contentLower.includes('验证码') || contentLower.includes('captcha')) {
      analysis.isLoginPage = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能是登录页面');
    }
    
    if (contentLower.includes('404') || contentLower.includes('not found') ||
        contentLower.includes('page not found')) {
      analysis.is404Page = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能是404页面');
    }
    
    if (contentLower.includes('cloudflare') || 
        contentLower.includes('checking your browser') ||
        contentLower.includes('ddos protection')) {
      analysis.isCloudflareBlocked = true;
      analysis.hasIssues = true;
      analysis.issues.push('可能被Cloudflare拦截');
    }

    const detailIndicators = [
      'video', 'movie', 'download', 'magnet', 'actress', 'genre',
      '演员', '导演', '发行', '番号', '磁力', '下载'
    ];
    
    analysis.hasDetailContent = detailIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    const videoIndicators = ['<video', 'player', '.mp4', '.avi', 'stream'];
    analysis.hasVideoContent = videoIndicators.some(indicator => 
      contentLower.includes(indicator)
    );

    return analysis;
  }

  // 批量提取方法保持不变...
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
            await cacheManager.setDetailCache(result.url, extractedDetails, 24 * 60 * 60 * 1000);
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

export const detailExtractor = new DetailExtractorService();
export default detailExtractor;