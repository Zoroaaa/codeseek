// src/utils/html-parser.js - 严格优化版本：精确的HTML解析，严格域名验证
export class CloudflareHTMLParser {
  constructor() {
    this.elementCache = new Map();
  }

  parseFromString(htmlContent) {
    return new CloudflareDocument(htmlContent);
  }
}

class CloudflareDocument {
  constructor(html) {
    this.html = html || '';
    this.elementCache = new Map();
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
    
    // 缓存结果
    this.elementCache.set(cacheKey, elements);
    return elements;
  }

  _parseSelector(selector) {
    const elements = [];
    
    console.log(`=== 开始解析选择器: ${selector} ===`);
    
    // 处理JavBus的核心选择器
    if (selector.includes('.movie-box') && selector.includes('a[href')) {
      this._parseMovieBoxLinks(elements);
    }
    // 处理JavDB的核心选择器  
    else if (selector.includes('.movie-list') || selector.includes('.grid-item') || selector.includes('.video-node')) {
      this._parseJavDBLinks(elements);
    }
    // 处理Jable的核心选择器
    else if (selector.includes('.video-item') || selector.includes('.list-videos')) {
      this._parseJableLinks(elements);
    }
    // 处理Sukebei的核心选择器
    else if (selector.includes('tr td:first-child') || selector.includes('.torrent-name')) {
      this._parseSukebeiLinks(elements);
    }
    // 处理JavMost的核心选择器
    else if (selector.includes('.video-item') || selector.includes('.movie-item')) {
      this._parseJavMostLinks(elements);
    }
    // 处理通用的a标签选择器 - 严格优化版本
    else if (selector.startsWith('a[href') || (selector.includes('a') && selector.includes('[href'))) {
      this._parseGenericLinks(elements, selector);
    }
    // 处理title标签
    else if (selector === 'title') {
      this._parseTitleTag(elements);
    }
    // 处理其他选择器
    else {
      this._parseGenericSelector(elements, selector);
    }

    console.log(`=== 选择器解析完成: ${selector}，找到 ${elements.length} 个元素 ===`);
    return elements;
  }

  _parseMovieBoxLinks(elements) {
    // 匹配JavBus的movie-box结构
    console.log('开始解析JavBus movie-box链接...');
    
    const patterns = [
      // 精确匹配包含电影信息的movie-box
      /<div[^>]*class="[^"]*movie-box[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const movieBoxContent = match[1];
        
        // 在movie-box内查找真正的详情页链接
        const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let linkMatch;
        
        while ((linkMatch = linkPattern.exec(movieBoxContent)) !== null) {
          const href = linkMatch[1];
          const content = linkMatch[2];
          
          // 严格验证是否为详情页链接
          if (this._isMovieDetailLink(href, content)) {
            const element = new CloudflareElement(href, content, this.html, linkMatch[0]);
            elements.push(element);
            console.log(`✓ 找到JavBus详情链接: ${href}`);
          } else {
            console.log(`✗ 跳过JavBus非详情链接: ${href}`);
          }
        }
      }
    }

    console.log(`JavBus解析找到 ${elements.length} 个有效链接`);
  }

  _parseJavDBLinks(elements) {
    console.log('开始解析JavDB链接...');
    
    // JavDB的结构模式
    const patterns = [
      // .movie-list .item a
      /<div[^>]*class="[^"]*movie-list[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // .grid-item a
      /<div[^>]*class="[^"]*grid-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // .video-node a  
      /<div[^>]*class="[^"]*video-node[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        
        // 在容器内查找a标签
        const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let linkMatch;
        while ((linkMatch = linkPattern.exec(containerContent)) !== null) {
          const href = linkMatch[1];
          const content = linkMatch[2];
          
          if (this._isJableDetailLink(href, content)) {
            const element = new CloudflareElement(href, content, this.html, linkMatch[0]);
            elements.push(element);
            console.log(`✓ 找到Jable详情链接: ${href}`);
          } else {
            console.log(`✗ 跳过Jable非详情链接: ${href}`);
          }
        }
      }
    }

    console.log(`Jable解析找到 ${elements.length} 个有效链接`);
  }

  _parseSukebeiLinks(elements) {
    console.log('开始解析Sukebei链接...');
    
    // Sukebei的表格结构
    const patterns = [
      // tr td:first-child a - 种子名称链接
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const rowContent = match[1];
        
        // 查找第一个td中的链接
        const firstTdPattern = /<td[^>]*>([\s\S]*?)<\/td>/i;
        const tdMatch = firstTdPattern.exec(rowContent);
        
        if (tdMatch) {
          const tdContent = tdMatch[1];
          const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          let linkMatch;
          
          while ((linkMatch = linkPattern.exec(tdContent)) !== null) {
            const href = linkMatch[1];
            const content = linkMatch[2];
            
            if (this._isSukebeiDetailLink(href, content)) {
              const element = new CloudflareElement(href, content, this.html, linkMatch[0]);
              elements.push(element);
              console.log(`✓ 找到Sukebei详情链接: ${href}`);
            } else {
              console.log(`✗ 跳过Sukebei非详情链接: ${href}`);
            }
          }
        }
      }
    }

    console.log(`Sukebei解析找到 ${elements.length} 个有效链接`);
  }

  _parseJavMostLinks(elements) {
    console.log('开始解析JavMost链接...');
    
    const patterns = [
      // .video-item容器
      /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // .movie-item容器
      /<div[^>]*class="[^"]*movie-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        
        // 在容器内查找a标签
        const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let linkMatch;
        while ((linkMatch = linkPattern.exec(containerContent)) !== null) {
          const href = linkMatch[1];
          const content = linkMatch[2];
          
          if (this._isJavMostDetailLink(href, content)) {
            const element = new CloudflareElement(href, content, this.html, linkMatch[0]);
            elements.push(element);
            console.log(`✓ 找到JavMost详情链接: ${href}`);
          } else {
            console.log(`✗ 跳过JavMost非详情链接: ${href}`);
          }
        }
      }
    }

    console.log(`JavMost解析找到 ${elements.length} 个有效链接`);
  }

  _parseGenericLinks(elements, selector) {
    console.log(`开始解析通用链接，选择器: ${selector}`);
    
    // 更严格的通用链接解析
    const patterns = [];
    
    // a[href*="/"]
    if (selector.includes('[href*="/"]')) {
      patterns.push(/<a[^>]*href="([^"]*\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    // a[href*="/"][title]
    if (selector.includes('[title]')) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    // 通用a[href] - 但要严格过滤
    if (patterns.length === 0) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const href = match[1];
        const content = match[3] || match[2];
        const titleAttr = pattern.source.includes('title') ? match[2] : null;
        
        // 严格过滤：只保留可能的详情页链接
        if (this._isGenericDetailLink(href, content)) {
          const element = new CloudflareElement(href, content, this.html, match[0]);
          if (titleAttr) {
            element.titleAttribute = titleAttr;
          }
          elements.push(element);
          console.log(`✓ 找到通用详情链接: ${href}`);
        } else {
          console.log(`✗ 跳过通用非详情链接: ${href}`);
        }
      }
    }

    console.log(`通用链接解析找到 ${elements.length} 个有效链接`);
  }

  _parseTitleTag(elements) {
    const titleMatch = this.html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      elements.push(new CloudflareElement('', titleMatch[1], this.html, titleMatch[0]));
    }
  }

  _parseGenericSelector(elements, selector) {
    // 处理其他CSS选择器
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
   * 验证JavBus详情链接 - 严格版本
   */
  _isMovieDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    console.log(`验证JavBus链接: ${href}`);
    
    // 1. 必须包含番号模式的路径
    const codePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i;
    if (!codePattern.test(href)) {
      console.log(`✗ 不包含番号模式: ${href}`);
      return false;
    }
    
    // 2. 严格域名检查
    const domain = this._extractDomain(href);
    if (domain && !domain.includes('javbus')) {
      console.log(`✗ 非JavBus域名: ${domain}`);
      return false;
    }
    
    // 3. 排除搜索页面
    if (hrefLower.includes('/search')) {
      console.log(`✗ 搜索页面: ${href}`);
      return false;
    }
    
    // 4. 排除明显的导航链接
    const excludePatterns = [
      '/page/', '/category/', '/genre/', '/actresses/', '/star/', '/studio/', '/label/',
      '/uncensored/', '/forum/', '/doc/', '/#', '.css', '.js', 'javascript:'
    ];
    
    if (excludePatterns.some(pattern => hrefLower.includes(pattern))) {
      console.log(`✗ 包含排除模式: ${href}`);
      return false;
    }
    
    // 5. 验证内容不是导航文本
    const excludeTexts = [
      'english', '中文', '日本語', '한국의', '有碼', '無碼', '女優', '類別',
      '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', '高清',
      '字幕', '欧美', 'rta', '2257'
    ];
    
    const contentLower = (content || '').toLowerCase();
    if (excludeTexts.some(text => contentLower.includes(text.toLowerCase()))) {
      console.log(`✗ 包含导航文本: ${content}`);
      return false;
    }
    
    console.log(`✓ JavBus链接验证通过: ${href}`);
    return true;
  }

  /**
   * 验证JavDB详情链接 - 严格版本
   */
  _isJavDBDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    console.log(`验证JavDB链接: ${href}`);
    
    // 1. 严格域名检查
    const domain = this._extractDomain(href);
    if (domain && !domain.includes('javdb')) {
      console.log(`✗ 非JavDB域名: ${domain}`);
      return false;
    }
    
    // 2. JavDB详情页通常是 /v/xxxx 格式
    if (/\/v\/[a-zA-Z0-9]+/.test(href)) {
      console.log(`✓ JavDB /v/ 格式: ${href}`);
      return true;
    }
    
    // 3. 或者包含番号的路径
    if (/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) {
      console.log(`✓ JavDB番号格式: ${href}`);
      return true;
    }
    
    // 4. 排除明显的非详情页
    const excludePatterns = [
      '/search', '/actors', '/makers', '/publishers', '/categories', '/tags'
    ];
    
    if (excludePatterns.some(pattern => hrefLower.includes(pattern))) {
      console.log(`✗ 包含排除模式: ${href}`);
      return false;
    }
    
    console.log(`✗ JavDB链接格式不匹配: ${href}`);
    return false;
  }

  /**
   * 验证Jable详情链接 - 严格版本
   */
  _isJableDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    console.log(`验证Jable链接: ${href}`);
    
    // 1. 严格域名检查 - 只允许jable.tv
    const domain = this._extractDomain(href);
    if (domain !== 'jable.tv') {
      console.log(`✗ 非Jable域名: ${domain}`);
      return false;
    }
    
    // 2. Jable详情页格式: /videos/xxx
    if (!/\/videos\/[^\/\?]+/.test(href)) {
      console.log(`✗ 非Jable视频格式: ${href}`);
      return false;
    }
    
    // 3. 排除搜索页面
    if (hrefLower.includes('/search')) {
      console.log(`✗ 搜索页面: ${href}`);
      return false;
    }
    
    console.log(`✓ Jable链接验证通过: ${href}`);
    return true;
  }

  /**
   * 验证Sukebei详情链接 - 严格版本
   */
  _isSukebeiDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    console.log(`验证Sukebei链接: ${href}`);
    
    // 1. 严格域名检查
    const domain = this._extractDomain(href);
    if (domain && !domain.includes('sukebei.nyaa.si')) {
      console.log(`✗ 非Sukebei域名: ${domain}`);
      return false;
    }
    
    // 2. Sukebei详情页格式: /view/数字
    if (/\/view\/\d+/.test(href)) {
      console.log(`✓ Sukebei /view/ 格式: ${href}`);
      return true;
    }
    
    // 3. 或者内容包含番号
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(content)) {
      console.log(`✓ Sukebei内容包含番号: ${href}`);
      return true;
    }
    
    console.log(`✗ Sukebei链接格式不匹配: ${href}`);
    return false;
  }

  /**
   * 验证JavMost详情链接 - 严格版本
   */
  _isJavMostDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    
    console.log(`验证JavMost链接: ${href}`);
    
    // 1. 严格域名检查
    const domain = this._extractDomain(href);
    const allowedDomains = ['javmost.com', 'www5.javmost.com'];
    if (domain && !allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed))) {
      console.log(`✗ 非JavMost域名: ${domain}`);
      return false;
    }
    
    // 2. 必须包含番号路径
    if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) {
      console.log(`✗ 不包含番号: ${href}`);
      return false;
    }
    
    // 3. 排除搜索和标签页面
    if (hrefLower.includes('/search') || hrefLower.includes('/tag/')) {
      console.log(`✗ 搜索或标签页面: ${href}`);
      return false;
    }
    
    console.log(`✓ JavMost链接验证通过: ${href}`);
    return true;
  }

  /**
   * 验证通用详情链接 - 严格版本
   */
  _isGenericDetailLink(href, content) {
    if (!href || typeof href !== 'string') return false;
    
    const hrefLower = href.toLowerCase();
    const contentLower = (content || '').toLowerCase();
    
    console.log(`验证通用链接: ${href}`);
    
    // 1. 排除明显的导航和功能链接
    const excludeUrlPatterns = [
      '/search/', '/page/', '/category/', '/genre/', '/actresses/', '/studio/',
      '/uncensored/', '/forum/', '/doc/', '/terms', '/privacy', '/#', 'javascript:',
      '/en', '/ja', '/ko', '.css', '.js', '.png', '.jpg', '.gif', '.ico',
      '/rss', '/sitemap', '/api/', '/ajax/', '/admin/', '/login', '/register',
      
      // 排除已知的广告域名
      'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
      'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
      'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
      'go.mnaspm.com', 'mnaspm.com', 'asacp.org', 'pr0rze.vip'
    ];
    
    // 检查URL是否包含排除模式
    if (excludeUrlPatterns.some(pattern => hrefLower.includes(pattern))) {
      console.log(`✗ URL包含排除模式: ${href}`);
      return false;
    }
    
    // 2. 排除明显的导航文本
    const excludeTexts = [
      'english', '中文', '日本語', '한국의', '有碼', '無碼', '女優', '類別',
      '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', '高清',
      '字幕', '欧美', 'rta', '2257', 'next', 'prev', 'page', 'home', 'forum',
      'contact', 'about', 'help', 'faq', 'support', '帮助', '联系', '关于'
    ];
    
    // 检查内容是否为导航文本
    if (excludeTexts.some(text => contentLower.includes(text.toLowerCase()))) {
      console.log(`✗ 内容为导航文本: ${content}`);
      return false;
    }
    
    // 3. 排除纯数字（分页链接）
    if (/^\s*\d+\s*$/.test(content)) {
      console.log(`✗ 纯数字内容: ${content}`);
      return false;
    }
    
    // 4. 排除过短的内容（除非URL包含番号）
    if (content && content.trim().length < 3 && !/[A-Z]{2,6}-?\d{3,6}/i.test(href)) {
      console.log(`✗ 内容过短且URL无番号: ${content}`);
      return false;
    }
    
    // 5. 优先保留包含番号的链接
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(href) || /[A-Z]{2,6}-?\d{3,6}/i.test(content)) {
      console.log(`✓ 包含番号: ${href}`);
      return true;
    }
    
    // 6. 对于其他链接，要求更严格的条件
    // 必须看起来像详情页路径
    const detailPatterns = [
      /\/v\/[a-zA-Z0-9]+/,  // JavDB格式
      /\?v=[a-zA-Z0-9]+/,   // JavLibrary格式
      /\/videos\/[^\/]+/,   // Jable格式
      /\/view\/\d+/,        // Sukebei格式
      /\/watch\/[^\/]+/,    // 通用观看页面
      /\/play\/[^\/]+/,     // 通用播放页面
      /\/movie\/[^\/]+/,    // 通用电影页面
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i  // 直接番号路径
    ];
    
    const matchesPattern = detailPatterns.some(pattern => pattern.test(href));
    if (matchesPattern) {
      console.log(`✓ 匹配详情页模式: ${href}`);
      return true;
    }
    
    console.log(`✗ 通用链接验证失败: ${href}`);
    return false;
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
  }

  getAttribute(attr) {
    if (attr === 'href') {
      return this.href;
    }
    
    if (attr === 'title') {
      if (this.titleAttribute) return this.titleAttribute;
      
      // 从元素HTML中提取title属性
      const titleMatch = this.elementHtml.match(/title="([^"]+)"/i);
      return titleMatch ? titleMatch[1] : null;
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