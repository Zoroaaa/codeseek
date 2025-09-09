// src/services/extraction-validator.js - 根据实际搜索数据优化的URL验证和工具函数
import { 
  SOURCE_DOMAIN_PATTERNS, 
  DETAIL_URL_PATTERNS, 
  SEARCH_EXCLUDE_PATTERNS,
  SPAM_DOMAINS,
  NAVIGATION_TEXTS,
  CODE_PATTERNS,
  SOURCE_SPECIFIC_CONFIG
} from '../constants.js';

export class ExtractionValidatorService {
  constructor() {
    // 根据实际搜索数据更新的源模式（移除JavLibrary）
    this.sourcePatterns = {
      'javbus': /javbus\.com/,
      'javdb': /javdb\.com/,
      'jable': /jable\.tv/,
      'javgg': /javgg\.net/,
      'javmost': /javmost\.com/,
      'sukebei': /sukebei\.nyaa\.si/,
      'javguru': /jav\.guru/
    };
  }

  // ==================== 源检测方法 ====================

  /**
   * 检测源类型 - 根据实际搜索数据优化
   * @param {string} url - URL
   * @param {string} sourceId - 源ID
   * @returns {string} 源类型
   */
  detectSourceType(url, sourceId) {
    const urlLower = url.toLowerCase();
    
    for (const [type, pattern] of Object.entries(this.sourcePatterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }
    
    if (sourceId) return sourceId;
    
    return 'generic';
  }

  /**
   * 从URL推断可能的源类型
   * @param {string} url - URL
   * @returns {string} 推断的源类型
   */
  inferSourceTypeFromUrl(url) {
    return this.detectSourceType(url);
  }

  // ==================== URL验证方法 ====================

  /**
   * 检查URL是否为详情页面 - 根据实际数据增强版本
   * @param {string} url - URL
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为详情页
   */
  isDetailPageUrl(url, sourceType, expectedDomain) {
    if (!url || typeof url !== 'string') return false;

    const urlLower = url.toLowerCase();
    const urlDomain = this.extractDomain(url);

    // 验证域名一致性（HTTP链接）- 支持子域名
    if (url.startsWith('http') && expectedDomain && !this.isDomainOrSubdomainMatch(urlDomain, expectedDomain)) {
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
        
      case 'jable':
        return this.isJableDetailPage(url);
        
      case 'javgg':
        return this.isJavGGDetailPage(url);
        
      case 'javmost':
        return this.isJavMostDetailPage(url);
        
      case 'sukebei':
        return this.isSukebeiDetailPage(url);
        
      case 'javguru':
        return this.isJavGuruDetailPage(url);
        
      default:
        return this.isGenericDetailPage(url);
    }
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
      console.log(`⌐ 详情URL无效`);
      return false;
    }

    // 2. 不能与搜索URL完全相同
    if (this.normalizeUrl(detailUrl) === this.normalizeUrl(searchUrl)) {
      console.log(`⌐ 详情URL与搜索URL相同`);
      return false;
    }

    // 3. 域名必须一致（支持子域名）
    const detailDomain = this.extractDomain(detailUrl);
    const searchDomain = this.extractDomain(searchUrl);
    
    if (!this.isDomainOrSubdomainMatch(detailDomain, searchDomain)) {
      console.log(`⌐ 域名不一致: ${detailDomain} != ${searchDomain}`);
      return false;
    }

    // 4. 必须是详情页面格式
    if (!this.isDetailPageUrl(detailUrl, sourceType, searchDomain)) {
      console.log(`⌐ 不是有效的详情页面格式`);
      return false;
    }

    console.log(`✅ 详情页面URL验证通过`);
    return true;
  }

  /**
   * 检查URL是否包含搜索指示器 - 新增方法
   * @param {string} url - URL
   * @returns {boolean} 是否包含搜索指示器
   */
  containsSearchIndicators(url) {
    const urlLower = url.toLowerCase();
    return SEARCH_EXCLUDE_PATTERNS.some(indicator => urlLower.includes(indicator));
  }

  // ==================== 源特定的详情页验证方法 ====================

  /**
   * JavBus详情页面验证 - 根据实际数据 /IPX-156
   */
  isJavBusDetailPage(url) {
    // JavBus详情页就是直接的番号路径：/IPX-156
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    const notGenrePage = !url.toLowerCase().includes('/genre/');
    const notActressPage = !url.toLowerCase().includes('/actresses/');
    
    return hasCodePattern && notSearchPage && notGenrePage && notActressPage;
  }

  /**
   * JavDB详情页面验证 - 根据实际数据 /v/KkZ97
   */
  isJavDBDetailPage(url) {
    // JavDB详情页是 /v/xxxx 格式
    const hasVideoPattern = /\/v\/[a-zA-Z0-9]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasVideoPattern && notSearchPage;
  }

  /**
   * Jable详情页面验证 - 根据实际数据 /videos/ipx-156/
   */
  isJableDetailPage(url) {
    // Jable详情页是视频页面 /videos/xxx
    const hasVideoPath = /\/videos\/[^\/\?]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasVideoPath && notSearchPage;
  }

  /**
   * JavGG详情页面验证 - 根据实际数据 /jav/ipx-156-reduce-mosaic/
   */
  isJavGGDetailPage(url) {
    // JavGG详情页格式：/jav/[code-description]
    const hasJavPath = /\/jav\/[a-z0-9\-]+/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasJavPath && notSearchPage;
  }

  /**
   * JavMost详情页面验证 - 根据实际数据 /IPX-156/ （注意子域名）
   */
  isJavMostDetailPage(url) {
    // JavMost详情页就是番号路径，支持子域名如www5.javmost.com
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasCodePattern && notSearchPage;
  }

  /**
   * Sukebei详情页面验证 - 根据实际数据 /view/3403743
   */
  isSukebeiDetailPage(url) {
    // Sukebei详情页是种子页面 /view/数字
    const hasViewPattern = /\/view\/\d+/.test(url);
    
    return hasViewPattern;
  }

  /**
   * JavGuru详情页面验证 - 根据实际数据 /268681/ipx-156-sana-matsunaga...
   */
  isJavGuruDetailPage(url) {
    // JavGuru的详情页面模式：数字ID+详细描述
    const notSearchPage = !url.toLowerCase().includes('?s=');
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(url);
    
    return notSearchPage && hasDetailPattern;
  }

  /**
   * 通用详情页面验证
   */
  isGenericDetailPage(url) {
    const urlLower = url.toLowerCase();
    
    // 详情页面特征
    const detailIndicators = [
      '/video/', '/watch/', '/play/', '/view/', '/detail/',
      '/movie/', '/film/', '/content/', '/jav/'
    ];
    
    const hasDetailIndicator = detailIndicators.some(indicator => 
      urlLower.includes(indicator)
    );
    
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    
    return hasDetailIndicator || hasCodePattern;
  }

  // ==================== 域名处理方法 ====================

  /**
   * 提取域名 - 工具方法
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
   * 检查域名是否匹配 - 简单版本
   * @param {string} url - 要检查的URL
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 域名是否匹配
   */
  isDomainMatch(url, expectedDomain) {
    if (!url || !expectedDomain) return false;
    
    try {
      const urlDomain = new URL(url).hostname.toLowerCase();
      return urlDomain === expectedDomain.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * 检查域名或子域名是否匹配 - 增强版本，支持子域名
   * @param {string} linkDomain - 链接域名
   * @param {string} expectedDomain - 期望域名
   * @returns {boolean} 是否匹配
   */
  isDomainOrSubdomainMatch(linkDomain, expectedDomain) {
    if (!linkDomain || !expectedDomain) return false;
    
    const linkDomainLower = linkDomain.toLowerCase();
    const expectedDomainLower = expectedDomain.toLowerCase();
    
    // 完全匹配
    if (linkDomainLower === expectedDomainLower) return true;
    
    // 子域名匹配 - 重要：支持www5.javmost.com等
    if (linkDomainLower.endsWith('.' + expectedDomainLower)) return true;
    
    return false;
  }

  /**
   * 检查是否为子域名 - 工具方法
   * @param {string} linkDomain - 链接域名
   * @param {string} baseDomain - 基础域名
   * @returns {boolean} 是否为子域名
   */
  isDomainOrSubdomain(linkDomain, baseDomain) {
    if (!linkDomain || !baseDomain) return false;
    
    const linkDomainLower = linkDomain.toLowerCase();
    const baseDomainLower = baseDomain.toLowerCase();
    
    // 完全匹配
    if (linkDomainLower === baseDomainLower) return true;
    
    // 子域名匹配
    if (linkDomainLower.endsWith('.' + baseDomainLower)) return true;
    
    return false;
  }

  /**
   * 标准化URL - 工具方法
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

  // ==================== URL处理工具方法 ====================

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
   * 验证URL格式
   * @param {string} url - URL
   * @returns {boolean} 是否为有效URL
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

  // ==================== 文本处理工具方法 ====================

  /**
   * 从文本中提取番号 - 使用优化的正则表达式
   * @param {string} text - 文本
   * @returns {string} 番号
   */
  extractCodeFromText(text) {
    if (!text) return '';
    
    // 使用综合匹配模式
    const match = text.match(CODE_PATTERNS.combined);
    if (match) {
      return match[1].toUpperCase();
    }
    
    return '';
  }

  /**
   * 从标题中提取番号
   * @param {string} title - 标题
   * @returns {string} 番号
   */
  extractCodeFromTitle(title) {
    return this.extractCodeFromText(title);
  }

  /**
   * 从URL中提取番号
   * @param {string} url - URL
   * @returns {string} 番号
   */
  extractCodeFromUrl(url) {
    if (!url) return '';
    
    const patterns = [
      /\/([A-Z]{2,6}-?\d{3,6})(?:\/|$|-)/i,  // 路径中的番号
      /[?&].*?([A-Z]{2,6}-?\d{3,6})/i        // 查询参数中的番号
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    
    return '';
  }

  /**
   * 计算文本相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const normalize = (str) => str.toLowerCase().replace(/[^\w\d]/g, '');
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1;
    
    // 简单的词汇重叠计算
    const words1 = norm1.split(/\s+/).filter(w => w.length > 2);
    const words2 = norm2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  // ==================== 数据验证工具方法 ====================

  /**
   * 验证日期格式
   * @param {string} dateStr - 日期字符串
   * @returns {string} 验证后的日期字符串
   */
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
   * @param {any} rating - 评分
   * @returns {number} 验证后的评分
   */
  validateRating(rating) {
    if (rating === null || rating === undefined) return 0;
    
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    
    return Math.max(0, Math.min(10, numRating));
  }

  // ==================== 高级验证方法 ====================

  /**
   * 验证和过滤下载链接 - 根据实际垃圾链接增强版本
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
      
      // 对于HTTP链接，验证域名一致性（支持子域名）
      if (link.url.startsWith('http')) {
        const linkDomain = this.extractDomain(link.url);
        if (!this.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
          console.log(`⌐ 过滤不同域名的下载链接: ${link.url} (${linkDomain} != ${expectedDomain})`);
          return false;
        }
      }
      
      // 过滤掉垃圾域名
      const urlLower = link.url.toLowerCase();
      if (SPAM_DOMAINS.some(domain => urlLower.includes(domain))) {
        console.log(`⌐ 过滤垃圾域名链接: ${link.url}`);
        return false;
      }
      
      // 排除明显的导航链接
      const nameLower = (link.name || '').toLowerCase();
      if (NAVIGATION_TEXTS.some(text => nameLower.includes(text.toLowerCase()))) {
        console.log(`⌐ 过滤导航文本链接: ${link.name}`);
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

  /**
   * 检查链接是否为高质量详情URL
   * @param {string} url - URL
   * @param {string} source - 源
   * @returns {boolean} 是否为高质量URL
   */
  isHighQualityDetailUrl(url, source) {
    const urlLower = url.toLowerCase();
    
    // 包含番号的URL优先级高
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(url)) return true;
    
    // 检查是否匹配已知的高质量模式
    const sourceType = this.detectSourceType(url, source);
    const patterns = DETAIL_URL_PATTERNS[sourceType];
    
    if (patterns) {
      return patterns.some(pattern => pattern.test(url));
    }
    
    return false;
  }

  /**
   * 增强版匹配分数计算
   * @param {Object} link - 链接对象
   * @param {Object} searchResult - 搜索结果
   * @param {string} searchKeyword - 搜索关键词
   * @returns {number} 增强后的匹配分数
   */
  calculateEnhancedMatchScore(link, searchResult, searchKeyword) {
    let score = link.score || 0;
    
    // 番号完全匹配加分
    if (searchKeyword && link.code) {
      if (searchKeyword.toLowerCase() === link.code.toLowerCase()) {
        score += 40;
      } else if (link.code.toLowerCase().includes(searchKeyword.toLowerCase()) || 
                 searchKeyword.toLowerCase().includes(link.code.toLowerCase())) {
        score += 25;
      }
    }
    
    // 标题相似度加分
    if (searchResult.title && link.title) {
      const titleSimilarity = this.calculateTextSimilarity(
        searchResult.title.toLowerCase(), 
        link.title.toLowerCase()
      );
      score += titleSimilarity * 15;
    }
    
    // 高质量URL加分
    if (this.isHighQualityDetailUrl(link.url, searchResult.source)) {
      score += 10;
    }
    
    // 特定提取源加分
    if (link.extractedFrom === 'javbus_moviebox' || 
        link.extractedFrom === 'javdb_video' ||
        link.extractedFrom === 'javgg_video' ||
        link.extractedFrom === 'jable_video' ||
        link.extractedFrom === 'javmost_video' ||
        link.extractedFrom === 'sukebei_torrent' ||
        link.extractedFrom === 'javguru_video') {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  // ==================== 搜索结果验证 ====================

  /**
   * 验证搜索结果链接有效性 - 严格版本
   * @param {string} href - 链接地址
   * @param {string} content - 链接内容
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为有效搜索结果链接
   */
  isValidSearchResultLink(href, content, sourceType, expectedDomain) {
    if (!href || typeof href !== 'string') return false;

    const hrefLower = href.toLowerCase();
    const contentLower = (content || '').toLowerCase();

    // 通用排除规则
    if (SEARCH_EXCLUDE_PATTERNS.some(pattern => hrefLower.includes(pattern))) {
      return false;
    }

    // 排除导航文本
    if (NAVIGATION_TEXTS.some(text => contentLower.includes(text.toLowerCase()))) {
      return false;
    }

    // 排除纯数字（分页链接）
    if (/^\s*\d+\s*$/.test(content)) {
      return false;
    }

    // 增强的域名检查
    if (expectedDomain) {
      const linkDomain = this.extractDomain(href);
      if (!this.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
        // 检查已知的垃圾域名
        if (SPAM_DOMAINS.some(domain => linkDomain.includes(domain))) {
          console.log(`⌐ 检测到垃圾域名: ${linkDomain}`);
          return false;
        }
        
        console.log(`⌐ 域名不匹配: ${linkDomain} != ${expectedDomain}`);
        return false;
      }
    }

    // 根据源类型进行特定验证
    switch (sourceType?.toLowerCase()) {
      case 'javbus':
        return this.isValidJavBusSearchLink(href, content);
      case 'javdb':
        return this.isValidJavDBSearchLink(href, content);
      case 'jable':
        return this.isValidJableSearchLink(href, content);
      case 'javgg':
        return this.isValidJavGGSearchLink(href, content);
      case 'javmost':
        return this.isValidJavMostSearchLink(href, content);
      case 'sukebei':
        return this.isValidSukebeiSearchLink(href, content);
      case 'javguru':
        return this.isValidJavGuruSearchLink(href, content);
      default:
        return this.isValidGenericSearchLink(href, content);
    }
  }

  /**
   * JavBus搜索链接验证 - 根据实际数据
   */
  isValidJavBusSearchLink(href, content) {
    // 必须包含番号路径：/IPX-156
    if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) return false;
    
    // 排除搜索页面
    if (href.toLowerCase().includes('/search')) return false;
    
    return true;
  }

  /**
   * JavDB搜索链接验证 - 根据实际数据
   */
  isValidJavDBSearchLink(href, content) {
    // JavDB详情页格式：/v/xxxx
    if (/\/v\/[a-zA-Z0-9]+/.test(href)) return true;
    
    // 排除搜索页面
    if (href.toLowerCase().includes('/search')) return false;
    
    return false;
  }

  /**
   * Jable搜索链接验证 - 根据实际数据，严格版本
   */
  isValidJableSearchLink(href, content) {
    // Jable视频页格式：/videos/xxx
    if (!/\/videos\/[^\/]+/.test(href)) return false;
    
    // 严格检查：必须是jable.tv域名
    const domain = this.extractDomain(href);
    if (domain !== 'jable.tv') {
      console.log(`⌐ Jable链接域名错误: ${domain}`);
      return false;
    }
    
    return true;
  }

  /**
   * JavGG搜索链接验证 - 根据实际数据
   */
  isValidJavGGSearchLink(href, content) {
    // JavGG详情页格式：/jav/[code-description]
    if (!/\/jav\/[a-z0-9\-]+/i.test(href)) return false;
    
    // 检查域名
    const domain = this.extractDomain(href);
    const allowedDomains = ['javgg.net'];
    
    return allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
  }

  /**
   * JavMost搜索链接验证 - 支持子域名
   */
  isValidJavMostSearchLink(href, content) {
    // 必须包含番号路径
    if (!/\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(href)) return false;
    
    // 检查域名 - 支持子域名
    const domain = this.extractDomain(href);
    return this.isDomainOrSubdomain(domain, 'javmost.com');
  }

  /**
   * Sukebei搜索链接验证 - 根据实际数据
   */
  isValidSukebeiSearchLink(href, content) {
    // Sukebei详情页格式：/view/数字
    if (/\/view\/\d+/.test(href)) return true;
    
    // 或包含番号的内容
    return /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }

  /**
   * JavGuru搜索链接验证 - 根据实际数据
   */
  isValidJavGuruSearchLink(href, content) {
    // JavGuru的详情页面模式：/数字/描述
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(href);
    
    // 排除搜索页面
    const notSearchPage = !href.toLowerCase().includes('?s=');
    
    return hasDetailPattern && notSearchPage;
  }

  /**
   * 通用搜索链接验证
   */
  isValidGenericSearchLink(href, content) {
    // 必须匹配常见详情页模式
    const detailPatterns = DETAIL_URL_PATTERNS;
    const allPatterns = Object.values(detailPatterns).flat();
    
    return allPatterns.some(pattern => pattern.test(href)) ||
           /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }
}

// 创建单例实例
export const extractionValidator = new ExtractionValidatorService();
export default extractionValidator;