// src/services/extraction-validator.js - URL验证 + 源检测 + 工具函数
export class ExtractionValidatorService {
  constructor() {
    this.sourcePatterns = {
      'javbus': /javbus\.com/,
      'javdb': /javdb\.com/,
      'javlibrary': /javlibrary\.com/,
      'jable': /jable\.tv/,
      'javgg': /javgg\.net/,
      'javmost': /javmost\.com/,
      'missav': /missav\.com/,
      'javhdporn': /javhd\.porn/,
      'av01': /av01\.tv/,
      'sukebei': /sukebei\.nyaa\.si/,
      'javguru': /jav\.guru/
    };
  }

  // ==================== 源检测方法 ====================

  /**
   * 检测源类型
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

    // 验证域名一致性（HTTP链接）- 支持子域名
    if (url.startsWith('http') && !this.isDomainOrSubdomainMatch(urlDomain, expectedDomain)) {
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
        
      case 'javgg':
        return this.isJavGGDetailPage(url);
        
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

    // 3. 域名必须一致（支持子域名）
    const detailDomain = this.extractDomain(detailUrl);
    const searchDomain = this.extractDomain(searchUrl);
    
    if (!this.isDomainOrSubdomainMatch(detailDomain, searchDomain)) {
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

  // ==================== 源特定的详情页验证方法 ====================

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
   * JavGG详情页面验证 - 新增方法
   */
  isJavGGDetailPage(url) {
    // JavGG详情页格式：/jav/[code]
    const hasJavPath = /\/jav\/[A-Z]{2,6}-?\d{3,6}[^\/]*\/?/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasJavPath && notSearchPage;
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
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes('/search');
    
    return hasCodePattern && notSearchPage;
  }

  /**
   * JavGuru详情页面验证 - 新增方法
   */
  isJavGuruDetailPage(url) {
    // JavGuru的详情页面模式
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
   * 检查域名是否匹配 - 新增方法
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
   * 检查域名或子域名是否匹配 - 新增工具方法
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
    
    // 子域名匹配
    if (linkDomainLower.endsWith('.' + expectedDomainLower)) return true;
    
    return false;
  }

  /**
   * 检查是否为子域名 - 新增工具方法
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
   * 从文本中提取番号
   * @param {string} text - 文本
   * @returns {string} 番号
   */
  extractCodeFromText(text) {
    if (!text) return '';
    
    // 常见番号格式正则表达式
    const patterns = [
      /([A-Z]{2,6}-?\d{3,6})/i,  // ABC-123, ABCD123
      /([A-Z]+\d{3,6})/i,        // ABC123
      /(\d{3,6}[A-Z]{2,6})/i     // 123ABC
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
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
      
      // 对于HTTP链接，验证域名一致性（支持子域名）
      if (link.url.startsWith('http')) {
        const linkDomain = this.extractDomain(link.url);
        if (!this.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
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
        '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', 'agent_code'
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

  /**
   * 检查链接是否为高质量详情URL
   * @param {string} url - URL
   * @param {string} source - 源
   * @returns {boolean} 是否为高质量URL
   */
  isHighQualityDetailUrl(url, source) {
    const urlLower = url.toLowerCase();
    
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(url)) return true;
    
    const qualityPatterns = [
      /\/v\/[a-zA-Z0-9]+/,
      /\?v=[a-zA-Z0-9]+/,
      /\/videos\/[^\/]+/,
      /\/view\/\d+/,
      /\/jav\/[^\/]+/
    ];
    
    return qualityPatterns.some(pattern => pattern.test(url));
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
        link.extractedFrom === 'javlibrary_video' ||
        link.extractedFrom === 'javgg_video') {
      score += 15;
    }
    
    return Math.min(100, Math.max(0, score));
  }
}

// 创建单例实例
export const extractionValidator = new ExtractionValidatorService();
export default extractionValidator;