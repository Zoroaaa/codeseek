// src/utils/html-parser.js - 根据实际搜索数据优化的HTML解析器
import { CONFIG } from '../constants.js';

export class CloudflareHTMLParser {
  constructor() {
    this.elementCache = new Map();
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.HTML_PARSER_CACHE_SIZE;
    this.debugMode = false;
  }

  parseFromString(htmlContent) {
    return new CloudflareDocument(htmlContent);
  }

  setDebugMode(enabled) {
    this.debugMode = enabled;
  }

  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }
}

class CloudflareDocument {
  constructor(html) {
    this.html = html || '';
    this.elementCache = new Map();
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.HTML_PARSER_CACHE_SIZE;
  }

  querySelector(selector) {
    const elements = this.querySelectorAll(selector);
    return elements.length > 0 ? elements[0] : null;
  }

  querySelectorAll(selector) {
    // 检查缓存
    const cacheKey = `all:${selector}`;
    if (this.elementCache.has(cacheKey)) {
      return this.elementCache.get(cacheKey);
    }

    const elements = this._parseSelector(selector);
    
    // 缓存管理
    if (this.elementCache.size >= this.maxCacheSize) {
      this.elementCache.clear();
    }
    this.elementCache.set(cacheKey, elements);
    return elements;
  }

  _parseSelector(selector) {
    const elements = [];
    
    console.log(`=== 开始解析选择器: ${selector} ===`);
    
    // 根据选择器类型选择解析策略
    if (selector.includes('.movie-box')) {
      this._parseJavBusMovieBox(elements);
    }
    else if (selector.includes('.movie-list') || selector.includes('.grid-item') || selector.includes('.video-node')) {
      this._parseJavDBContainers(elements);
    }
    else if (selector.includes('.video-item') || selector.includes('.list-videos')) {
      this._parseJableContainers(elements);
    }
    else if (selector.includes('tr td:first-child') || selector.includes('.torrent-name')) {
      this._parseSukebeiTorrents(elements);
    }
    else if (selector.startsWith('a[href') || (selector.includes('a') && selector.includes('[href'))) {
      this._parseGenericLinks(elements, selector);
    }
    else if (selector === 'title') {
      this._parseTitleTag(elements);
    }
    else {
      this._parseGenericSelector(elements, selector);
    }

    console.log(`=== 选择器解析完成: ${selector}，找到 ${elements.length} 个元素 ===`);
    return elements;
  }

  /**
   * JavBus movie-box 解析 - 根据实际数据优化
   */
  _parseJavBusMovieBox(elements) {
    console.log('开始解析JavBus movie-box链接...');
    
    // JavBus的movie-box结构模式
    const movieBoxPatterns = [
      // 主要模式：<a class="movie-box" href="/IPX-156">
      /<a[^>]*class="[^"]*movie-box[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      // 备用模式：href在class之前
      /<a[^>]*href="([^"]+)"[^>]*class="[^"]*movie-box[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    ];

    let foundAny = false;
    
    for (const pattern of movieBoxPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        foundAny = true;
        const href = match[1];
        const content = match[2];
        
        console.log(`检查movie-box链接: ${href}`);
        
        // JavBus详情页验证：必须是 /番号 格式
        if (this._isValidJavBusLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`✓ 添加JavBus movie-box链接: ${href}`);
        } else {
          console.log(`✗ 跳过JavBus链接: ${href}`);
        }
      }
      
      if (foundAny) break;
    }

    // 如果没找到，尝试更宽松的匹配
    if (!foundAny) {
      console.log('尝试宽松匹配...');
      this._parseJavBusLinksLoose(elements);
    }

    console.log(`JavBus解析找到 ${elements.length} 个有效链接`);
  }

  /**
   * JavBus 宽松匹配（后备方案）
   */
  _parseJavBusLinksLoose(elements) {
    // 查找任何包含番号的javbus链接
    const loosePattern = /<a[^>]*href="([^"]*\/[A-Z]{2,6}-?\d{3,6}[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = loosePattern.exec(this.html)) !== null) {
      const href = match[1];
      const content = match[2];
      
      if (!href.includes('/search') && !href.includes('/page')) {
        const element = this._createMovieElement(href, content, match[0]);
        elements.push(element);
        console.log(`✓ 宽松匹配添加: ${href}`);
      }
    }
  }

  /**
   * JavDB 容器解析 - 根据实际数据优化
   */
  _parseJavDBContainers(elements) {
    console.log('开始解析JavDB容器链接...');
    
    const containerPatterns = [
      // movie-list容器
      /<div[^>]*class="[^"]*movie-list[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // grid-item容器
      /<div[^>]*class="[^"]*grid-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // video-node容器
      /<div[^>]*class="[^"]*video-node[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of containerPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        this._extractLinksFromContainer(containerContent, elements, 'javdb');
      }
    }

    // 如果容器匹配失败，尝试直接匹配JavDB特征链接
    if (elements.length === 0) {
      this._parseJavDBDirectLinks(elements);
    }

    console.log(`JavDB解析找到 ${elements.length} 个有效链接`);
  }

  /**
   * JavDB 直接链接匹配
   */
  _parseJavDBDirectLinks(elements) {
    const directPatterns = [
      // /v/ 格式的链接 - JavDB的实际格式
      /<a[^>]*href="([^"]*\/v\/[a-zA-Z0-9]+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    ];

    for (const pattern of directPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const href = match[1];
        const content = match[2];
        
        if (this._isValidJavDBLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`✓ JavDB直接匹配: ${href}`);
        }
      }
    }
  }

  /**
   * Jable 容器解析 - 根据实际数据优化
   */
  _parseJableContainers(elements) {
    console.log('开始解析Jable容器链接...');
    
    const containerPatterns = [
      /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*list-videos[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of containerPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        this._extractLinksFromContainer(containerContent, elements, 'jable');
      }
    }

    // 直接匹配 /videos/ 链接 - Jable的实际格式
    if (elements.length === 0) {
      const directPattern = /<a[^>]*href="([^"]*\/videos\/[^\/\?"]+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      
      while ((match = directPattern.exec(this.html)) !== null) {
        const href = match[1];
        const content = match[2];
        
        if (this._isValidJableLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`✓ Jable直接匹配: ${href}`);
        }
      }
    }

    console.log(`Jable解析找到 ${elements.length} 个有效链接`);
  }

  /**
   * Sukebei 种子解析 - 根据实际数据优化
   */
  _parseSukebeiTorrents(elements) {
    console.log('开始解析Sukebei种子链接...');
    
    // 方法1: 表格行匹配
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    
    while ((match = rowPattern.exec(this.html)) !== null) {
      const rowContent = match[1];
      
      // 查找第一个td中的链接
      const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/i;
      const tdMatch = tdPattern.exec(rowContent);
      
      if (tdMatch) {
        this._extractLinksFromContainer(tdMatch[1], elements, 'sukebei');
      }
    }

    // 方法2: 直接匹配 /view/ 链接 - Sukebei的实际格式
    if (elements.length === 0) {
      const directPattern = /<a[^>]*href="([^"]*\/view\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let directMatch;
      
      while ((directMatch = directPattern.exec(this.html)) !== null) {
        const href = directMatch[1];
        const content = directMatch[2];
        
        if (this._isValidSukebeiLink(href, content)) {
          const element = this._createMovieElement(href, content, directMatch[0]);
          elements.push(element);
          console.log(`✓ Sukebei直接匹配: ${href}`);
        }
      }
    }

    console.log(`Sukebei解析找到 ${elements.length} 个有效链接`);
  }

  /**
   * 通用链接解析 - 根据实际数据平衡版本
   */
  _parseGenericLinks(elements, selector) {
    console.log(`开始解析通用链接，选择器: ${selector}`);
    
    const patterns = [];
    
    // 根据选择器构建匹配模式
    if (selector.includes('[href*="/"]')) {
      patterns.push(/<a[^>]*href="([^"]*\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    if (selector.includes('[title]')) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    if (patterns.length === 0) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }

    for (const pattern of patterns) {
      let match;
      let count = 0;
      const maxLinks = CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE;
      
      while ((match = pattern.exec(this.html)) !== null && count < maxLinks) {
        count++;
        const href = match[1];
        const content = match[3] || match[2];
        const titleAttr = pattern.source.includes('title') ? match[2] : null;
        
        // 宽松但合理的验证
        if (this._isValidGenericLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          if (titleAttr) {
            element.titleAttribute = titleAttr;
          }
          elements.push(element);
          console.log(`✓ 通用链接匹配: ${href}`);
        }
      }
      
      if (count >= maxLinks) {
        console.log(`已达到通用链接处理限制 (${maxLinks})，停止处理`);
      }
    }

    console.log(`通用链接解析找到 ${elements.length} 个有效链接 (限制: ${CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE})`);
  }

  /**
   * 从容器中提取链接
   */
  _extractLinksFromContainer(containerContent, elements, sourceType) {
    const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    
    while ((linkMatch = linkPattern.exec(containerContent)) !== null) {
      const href = linkMatch[1];
      const content = linkMatch[2];
      
      if (this._isValidMovieLink(href, content, sourceType)) {
        const element = this._createMovieElement(href, content, linkMatch[0]);
        elements.push(element);
        console.log(`✓ ${sourceType}容器链接: ${href}`);
      }
    }
  }

  /**
   * 创建电影元素对象
   */
  _createMovieElement(href, content, elementHtml) {
    const element = new CloudflareElement(href, content, this.html, elementHtml);
    
    // 预提取常用信息
    element.extractedTitle = this._extractTitleFromContent(content);
    element.extractedCode = this._extractCodeFromContent(content, href);
    element.extractedDate = this._extractDateFromContent(content);
    
    return element;
  }

  /**
   * 从内容中提取标题
   */
  _extractTitleFromContent(content) {
    const titlePatterns = [
      /title="([^"]+)"/i,
      /alt="([^"]+)"/i,
      /<span[^>]*>(.*?)<\/span>/i,
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i,
      /<div[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/div>/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let title = match[1].replace(/<[^>]*>/g, '').trim();
        // 过滤掉明显的非标题内容
        if (title.length > 5 && title.length < 500 && !this._isNavigationText(title)) {
          return title;
        }
      }
    }
    
    return '';
  }

  /**
   * 从内容中提取番号
   */
  _extractCodeFromContent(content, href) {
    const sources = [content, href];
    const codePattern = /([A-Z]{2,6}-?\d{3,6})/i;
    
    for (const source of sources) {
      if (source) {
        const match = source.match(codePattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }
    
    return '';
  }

  /**
   * 从内容中提取日期
   */
  _extractDateFromContent(content) {
    const datePattern = /<date>(\d{4}-\d{2}-\d{2})<\/date>/i;
    const match = content.match(datePattern);
    return match ? match[1] : '';
  }

  /**
   * 验证是否为导航文本
   */
  _isNavigationText(text) {
    const navTexts = [
      'english', '中文', '日本語', '한국어', '有碼', '無碼', '女優', '類別',
      '論壇', '下一页', '上一页', '首页', 'next', 'prev', 'page', 'home',
      'login', 'register', 'terms', 'privacy', 'contact', 'about', 'help'
    ];
    
    const textLower = text.toLowerCase();
    return navTexts.some(navText => textLower.includes(navText.toLowerCase())) ||
           /^\s*\d+\s*$/.test(text); // 纯数字
  }

  /**
   * 验证电影链接 - 根据实际数据平衡版本
   */
  _isValidMovieLink(href, content, sourceType) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    // 基本排除规则 - 只排除明显的非内容链接
    const excludePatterns = [
      '/search/', '/page/', '?page=', '/category/', '/genre/', '/tag/', '/forum/',
      '/login', '/register', '/terms', '/privacy', '/help', '/contact', '/about',
      '.css', '.js', '.png', '.jpg', '.gif', '.ico', 'javascript:', '/#'
    ];
    
    if (excludePatterns.some(pattern => hrefLower.includes(pattern))) {
      return false;
    }
    
    // 根据源类型进行特定验证
    switch (sourceType) {
      case 'javbus':
        return this._isValidJavBusLink(href, content);
      case 'javdb':
        return this._isValidJavDBLink(href, content);
      case 'jable':
        return this._isValidJableLink(href, content);
      case 'sukebei':
        return this._isValidSukebeiLink(href, content);
      case 'javgg':
        return this._isValidJavGGLink(href, content);
      case 'javmost':
        return this._isValidJavMostLink(href, content);
      case 'javguru':
        return this._isValidJavGuruLink(href, content);
      default:
        return this._isValidGenericLink(href, content);
    }
  }

  /**
   * JavBus链接验证 - 根据实际数据 /IPX-156
   */
  _isValidJavBusLink(href, content) {
    // 必须包含番号路径：/IPX-156
    const hasCode = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('javbus');
    
    return hasCode && isDomainOk;
  }

  /**
   * JavDB链接验证 - 根据实际数据 /v/KkZ97
   */
  _isValidJavDBLink(href, content) {
    const isDetailFormat = /\/v\/[a-zA-Z0-9]+/.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('javdb');
    const notSearchPage = !href.includes('/search') && !href.includes('/actors');
    
    return isDetailFormat && isDomainOk && notSearchPage;
  }

  /**
   * Jable链接验证 - 根据实际数据 /videos/ipx-156/
   */
  _isValidJableLink(href, content) {
    const isVideoFormat = /\/videos\/[^\/\?]+/.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('jable.tv');
    const notSearchPage = !href.includes('/search');
    
    return isVideoFormat && isDomainOk && notSearchPage;
  }

  /**
   * Sukebei链接验证 - 根据实际数据 /view/3403743
   */
  _isValidSukebeiLink(href, content) {
    const isDetailFormat = /\/view\/\d+/.test(href) || /[A-Z]{2,6}-?\d{3,6}/i.test(content);
    const isDomainOk = !href.startsWith('http') || href.includes('sukebei.nyaa.si');
    
    return isDetailFormat && isDomainOk;
  }

  /**
   * JavGG链接验证 - 根据实际数据 /jav/ipx-156-reduce-mosaic/
   */
  _isValidJavGGLink(href, content) {
    const isJavFormat = /\/jav\/[a-z0-9\-]+/i.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('javgg.net');
    const notSearchPage = !href.includes('/search');
    
    return isJavFormat && isDomainOk && notSearchPage;
  }

  /**
   * JavMost链接验证 - 根据实际数据 /IPX-156/ （支持子域名）
   */
  _isValidJavMostLink(href, content) {
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('javmost.com');
    const notSearchPage = !href.includes('/search');
    
    return hasCodePattern && isDomainOk && notSearchPage;
  }

  /**
   * JavGuru链接验证 - 根据实际数据 /268681/ipx-156-sana-matsunaga...
   */
  _isValidJavGuruLink(href, content) {
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(href);
    const isDomainOk = !href.startsWith('http') || href.includes('jav.guru');
    const notSearchPage = !href.includes('?s=');
    
    return hasDetailPattern && isDomainOk && notSearchPage;
  }

  /**
   * 通用链接验证 - 平衡版本
   */
  _isValidGenericLink(href, content) {
    // 基本URL格式检查
    if (!this._isValidUrl(href)) return false;
    
    // 内容不能是明显的导航文本
    const contentText = content ? content.replace(/<[^>]*>/g, '').trim() : '';
    if (contentText && this._isNavigationText(contentText)) return false;
    
    // 优先保留包含番号的链接
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(href) || /[A-Z]{2,6}-?\d{3,6}/i.test(contentText)) {
      return true;
    }
    
    // 或者看起来像详情页的链接
    const detailPatterns = [
      /\/v\/[a-zA-Z0-9]+/,
      /\?v=[a-zA-Z0-9]+/,
      /\/videos\/[^\/]+/,
      /\/view\/\d+/,
      /\/watch\/[^\/]+/,
      /\/play\/[^\/]+/,
      /\/movie\/[^\/]+/,
      /\/jav\/[^\/]+/,
      /\/\d+\/[a-z0-9\-]+/i
    ];
    
    return detailPatterns.some(pattern => pattern.test(href));
  }

  /**
   * URL格式验证
   */
  _isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      if (url.startsWith('http')) {
        new URL(url);
        return true;
      } else if (url.startsWith('/')) {
        return true; // 相对URL
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 解析title标签
   */
  _parseTitleTag(elements) {
    const titleMatch = this.html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      elements.push(new CloudflareElement('', titleMatch[1], this.html, titleMatch[0]));
    }
  }

  /**
   * 解析通用选择器
   */
  _parseGenericSelector(elements, selector) {
    console.log(`处理通用选择器: ${selector}`);
    
    // 简单的class选择器 .classname
    if (selector.startsWith('.') && !selector.includes(' ')) {
      const className = selector.substring(1);
      const pattern = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)<\/[^>]*>`, 'gi');
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        elements.push(new CloudflareElement('', match[1], this.html, match[0]));
      }
    }
    // 简单的标签选择器
    else if (/^[a-zA-Z]+$/.test(selector)) {
      const pattern = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector}>`, 'gi');
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        elements.push(new CloudflareElement('', match[1], this.html, match[0]));
      }
    }
  }

  /**
   * 从URL提取域名
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return '';
    }
  }
}

class CloudflareElement {
  constructor(href, innerHTML, fullHtml, elementHtml) {
    this.href = href || '';
    this.innerHTML = innerHTML || '';
    this.fullHtml = fullHtml || '';
    this.elementHtml = elementHtml || '';
    this.titleAttribute = null;
    this._textContent = null;
    
    // 预提取的信息
    this.extractedTitle = '';
    this.extractedCode = '';
    this.extractedDate = '';
  }

  getAttribute(attr) {
    if (attr === 'href') {
      return this.href;
    }
    
    if (attr === 'title') {
      // 优先返回预提取的标题
      if (this.extractedTitle) return this.extractedTitle;
      if (this.titleAttribute) return this.titleAttribute;
      
      // 从元素HTML中提取title属性
      const titleMatch = this.elementHtml.match(/title="([^"]+)"/i);
      if (titleMatch) return titleMatch[1];
      
      // 从img标签的title属性提取
      const imgTitleMatch = this.innerHTML.match(/<img[^>]*title="([^"]+)"/i);
      if (imgTitleMatch) return imgTitleMatch[1];
      
      // 从alt属性提取
      const altMatch = this.innerHTML.match(/<img[^>]*alt="([^"]+)"/i);
      if (altMatch) return altMatch[1];
      
      return null;
    }
    
    if (attr === 'onclick') {
      const onclickMatch = this.elementHtml.match(/onclick="([^"]+)"/i);
      return onclickMatch ? onclickMatch[1] : null;
    }

    if (attr === 'class') {
      const classMatch = this.elementHtml.match(/class="([^"]+)"/i);
      return classMatch ? classMatch[1] : null;
    }
    
    // 通用属性提取
    const attrRegex = new RegExp(`${attr}="([^"]+)"`, 'i');
    const match = this.elementHtml.match(attrRegex);
    return match ? match[1] : null;
  }

  get textContent() {
    if (this._textContent !== null) {
      return this._textContent;
    }
    
    // 清理HTML标签，保留文本内容
    this._textContent = this.innerHTML
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')   // 移除style
      .replace(/<[^>]*>/g, '')                                           // 移除所有HTML标签
      .replace(/&nbsp;/g, ' ')                                           // 替换&nbsp;
      .replace(/&amp;/g, '&')                                            // 替换&amp;
      .replace(/&lt;/g, '<')                                             // 替换&lt;
      .replace(/&gt;/g, '>')                                             // 替换&gt;
      .replace(/&quot;/g, '"')                                           // 替换&quot;
      .replace(/\s+/g, ' ')                                              // 合并多个空白字符
      .trim();
    
    return this._textContent;
  }

  querySelector(selector) {
    // 在当前元素内查找子元素
    const elements = this.querySelectorAll(selector);
    return elements.length > 0 ? elements[0] : null;
  }

  querySelectorAll(selector) {
    const elements = [];
    
    // 在innerHTML中查找匹配的子元素
    if (selector.includes('.title')) {
      this._findTitleElements(elements);
    } else if (selector.includes('.video-number') || selector.includes('.uid')) {
      this._findCodeElements(elements);
    } else if (selector === 'img') {
      this._findImageElements(elements);
    } else if (selector.startsWith('.')) {
      this._findElementsByClass(elements, selector.substring(1));
    } else if (/^[a-zA-Z]+$/.test(selector)) {
      this._findElementsByTag(elements, selector);
    }
    
    return elements;
  }

  _findTitleElements(elements) {
    const patterns = [
      /<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi,
      /<[^>]*class="[^"]*video-title[^"]*"[^>]*>(.*?)<\/[^>]*>/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(this.innerHTML)) !== null) {
        elements.push(new CloudflareElement('', match[1], this.fullHtml, match[0]));
      }
    });
  }

  _findCodeElements(elements) {
    const patterns = [
      /<[^>]*class="[^"]*video-number[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<[^>]*class="[^"]*uid[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<span[^>]*>(.*?)<\/span>/gi,
      /<strong[^>]*>(.*?)<\/strong>/gi
    ];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(this.innerHTML)) !== null) {
        const content = match[1].trim();
        // 检查是否看起来像番号
        if (/[A-Z]{2,6}-?\d{3,6}/i.test(content)) {
          elements.push(new CloudflareElement('', content, this.fullHtml, match[0]));
        }
      }
    });
  }

  _findImageElements(elements) {
    const regex = /<img[^>]*>/gi;
    let match;
    
    while ((match = regex.exec(this.innerHTML)) !== null) {
      const imgElement = new CloudflareElement('', '', this.fullHtml, match[0]);
      elements.push(imgElement);
    }
  }

  _findElementsByClass(elements, className) {
    const pattern = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)<\/[^>]*>`, 'gi');
    let match;
    
    while ((match = pattern.exec(this.innerHTML)) !== null) {
      elements.push(new CloudflareElement('', match[1], this.fullHtml, match[0]));
    }
  }

  _findElementsByTag(elements, tagName) {
    const pattern = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'gi');
    let match;
    
    while ((match = pattern.exec(this.innerHTML)) !== null) {
      elements.push(new CloudflareElement('', match[1], this.fullHtml, match[0]));
    }
  }

  closest(selector) {
    // 简单实现，在实际项目中可能需要更复杂的逻辑
    return null;
  }
}

// 导出解析器
export const cloudflareHTMLParser = new CloudflareHTMLParser();
export default cloudflareHTMLParser;