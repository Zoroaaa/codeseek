// src/services/content-parser.js - 更新版本：支持搜索页面和详情页面分层解析
import { parserRules } from '../config/parser-rules.js';

export class ContentParserService {
  constructor() {
    this.parseTimeout = 10000;
    this.maxRetries = 2;
  }

  /**
   * 从搜索页面中提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 解析选项
   * @returns {Array} 详情页链接数组
   */
  async extractDetailLinksFromSearchPage(htmlContent, options = {}) {
    const { sourceType, baseUrl, searchKeyword } = options;
    
    console.log(`从搜索页面提取详情链接，源类型: ${sourceType}`);

    try {
      // 创建DOM解析器
      const parser = this.createDOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // 获取搜索页面解析规则
      const searchPageRules = parserRules.getSearchPageRules(sourceType);
      if (!searchPageRules || !searchPageRules.detailLinkSelectors) {
        console.warn(`未找到 ${sourceType} 的搜索页面解析规则`);
        return this.extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword);
      }

      const detailLinks = [];
      const selectors = searchPageRules.detailLinkSelectors;

      // 尝试每个选择器配置
      for (const selectorConfig of selectors) {
        console.log(`尝试选择器: ${selectorConfig.selector}`);
        
        const links = doc.querySelectorAll(selectorConfig.selector);
        console.log(`找到 ${links.length} 个候选链接`);

        for (const linkElement of links) {
          const href = linkElement.getAttribute('href');
          if (!href) continue;

          // 构建完整URL
          const fullUrl = this.resolveRelativeUrl(href, baseUrl);

          // 验证链接有效性
          if (!this.isValidDetailLink(fullUrl, selectorConfig)) {
            continue;
          }

          // 提取链接相关信息
          const linkInfo = this.extractLinkInfo(linkElement, selectorConfig, searchKeyword);
          if (linkInfo) {
            detailLinks.push({
              url: fullUrl,
              ...linkInfo
            });
          }
        }

        // 如果找到了链接，可以选择停止或继续查找更多
        if (detailLinks.length > 0) {
          console.log(`使用选择器 ${selectorConfig.selector} 找到 ${detailLinks.length} 个详情链接`);
          break; // 找到就停止，避免重复
        }
      }

      // 如果没有找到任何链接，使用通用规则
      if (detailLinks.length === 0) {
        console.log('使用通用规则提取详情链接');
        return this.extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword);
      }

      console.log(`搜索页面链接提取完成，找到 ${detailLinks.length} 个详情链接`);
      return detailLinks;

    } catch (error) {
      console.error('搜索页面链接提取失败:', error);
      return [];
    }
  }

  /**
   * 解析详情页面内容
   * @param {string} htmlContent - HTML内容
   * @param {Object} options - 解析选项
   * @returns {Object} 解析后的详情信息
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { sourceType, originalUrl, originalTitle } = options;
    
    console.log(`开始解析详情页面内容，源类型: ${sourceType}`);

    try {
      // 创建DOM解析器
      const parser = this.createDOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // 获取详情页面解析规则
      const detailPageRules = parserRules.getDetailPageRules(sourceType);
      if (!detailPageRules) {
        console.warn(`未找到 ${sourceType} 的详情页面解析规则，使用通用规则`);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      }

      console.log(`使用 ${sourceType} 专用详情页解析规则`);

      // 应用解析规则
      const detailInfo = {
        sourceType,
        originalUrl,
        
        // 基本信息
        title: this.extractByRule(doc, detailPageRules.title),
        originalTitle: this.extractByRule(doc, detailPageRules.originalTitle),
        code: this.extractByRule(doc, detailPageRules.code),
        
        // 媒体信息
        coverImage: this.extractImageByRule(doc, detailPageRules.coverImage, originalUrl),
        screenshots: this.extractMultipleImagesByRule(doc, detailPageRules.screenshots, originalUrl),
        
        // 演员信息
        actresses: this.extractActressesByRule(doc, detailPageRules.actresses),
        director: this.extractByRule(doc, detailPageRules.director),
        studio: this.extractByRule(doc, detailPageRules.studio),
        label: this.extractByRule(doc, detailPageRules.label),
        series: this.extractByRule(doc, detailPageRules.series),
        
        // 发布信息
        releaseDate: this.extractByRule(doc, detailPageRules.releaseDate),
        duration: this.extractByRule(doc, detailPageRules.duration),
        
        // 技术信息
        quality: this.extractByRule(doc, detailPageRules.quality),
        fileSize: this.extractByRule(doc, detailPageRules.fileSize),
        resolution: this.extractByRule(doc, detailPageRules.resolution),
        
        // 下载信息
        downloadLinks: this.extractDownloadLinksByRule(doc, detailPageRules.downloadLinks, originalUrl),
        magnetLinks: this.extractMagnetLinksByRule(doc, detailPageRules.magnetLinks),
        
        // 其他信息
        description: this.extractByRule(doc, detailPageRules.description),
        tags: this.extractTagsByRule(doc, detailPageRules.tags),
        rating: this.extractRatingByRule(doc, detailPageRules.rating)
      };

      // 数据清理和验证
      const cleanedInfo = this.cleanAndValidateData(detailInfo);
      
      console.log(`详情页面解析完成，提取到 ${Object.keys(cleanedInfo).length} 个字段`);
      return cleanedInfo;

    } catch (error) {
      console.error('详情页面解析失败:', error);
      
      // 降级到通用解析
      try {
        const parser = this.createDOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      } catch (fallbackError) {
        console.error('通用解析也失败:', fallbackError);
        throw new Error(`页面解析失败: ${error.message}`);
      }
    }
  }

  /**
   * 提取链接相关信息
   * @param {Element} linkElement - 链接元素
   * @param {Object} selectorConfig - 选择器配置
   * @param {string} searchKeyword - 搜索关键词
   * @returns {Object|null} 链接信息
   */
  extractLinkInfo(linkElement, selectorConfig, searchKeyword) {
    try {
      let title = '';
      let code = '';
      let score = 0; // 匹配分数

      // 提取标题
      if (selectorConfig.titleAttribute) {
        title = linkElement.getAttribute(selectorConfig.titleAttribute) || '';
      } else if (selectorConfig.titleSelector) {
        const titleElement = linkElement.querySelector(selectorConfig.titleSelector) ||
                           linkElement.closest('.item, .movie, .video, .result')?.querySelector(selectorConfig.titleSelector);
        title = titleElement?.textContent?.trim() || '';
      } else {
        title = linkElement.textContent?.trim() || '';
      }

      // 提取番号
      if (selectorConfig.codeSelector) {
        const codeElement = linkElement.querySelector(selectorConfig.codeSelector) ||
                          linkElement.closest('.item, .movie, .video, .result')?.querySelector(selectorConfig.codeSelector);
        code = codeElement?.textContent?.trim() || '';
      }

      // 如果没有显式番号，从标题中提取
      if (!code) {
        code = this.extractCodeFromText(title);
      }

      // 计算匹配分数
      if (searchKeyword) {
        score = this.calculateMatchScore(title, code, searchKeyword);
      }

      // 验证是否需要包含番号
      if (selectorConfig.mustContainCode && !code) {
        return null;
      }

      return {
        title: title || '未知标题',
        code: code || '',
        score,
        extractedFrom: 'searchPage'
      };

    } catch (error) {
      console.warn('提取链接信息失败:', error);
      return null;
    }
  }

  /**
   * 验证详情链接的有效性
   * @param {string} url - 链接URL
   * @param {Object} selectorConfig - 选择器配置
   * @returns {boolean} 是否有效
   */
  isValidDetailLink(url, selectorConfig) {
    if (!url || typeof url !== 'string') return false;

    // 检查排除的链接模式
    if (selectorConfig.excludeHrefs) {
      const isExcluded = selectorConfig.excludeHrefs.some(excludePattern => 
        url.toLowerCase().includes(excludePattern.toLowerCase())
      );
      if (isExcluded) return false;
    }

    // 检查是否为有效的HTTP(S)链接
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * 计算匹配分数
   * @param {string} title - 标题
   * @param {string} code - 番号
   * @param {string} searchKeyword - 搜索关键词
   * @returns {number} 匹配分数 (0-100)
   */
  calculateMatchScore(title, code, searchKeyword) {
    if (!searchKeyword) return 50; // 默认分数

    let score = 0;
    const keyword = searchKeyword.toLowerCase();
    const titleLower = title.toLowerCase();
    const codeLower = code.toLowerCase();

    // 番号完全匹配 (40分)
    if (code && keyword === codeLower) {
      score += 40;
    }
    // 番号包含匹配 (30分)
    else if (code && (codeLower.includes(keyword) || keyword.includes(codeLower))) {
      score += 30;
    }

    // 标题完全匹配 (30分)
    if (keyword === titleLower) {
      score += 30;
    }
    // 标题包含匹配 (20分)
    else if (titleLower.includes(keyword)) {
      score += 20;
    }

    // 关键词相似度匹配 (最多30分)
    const similarity = this.calculateTextSimilarity(titleLower, keyword);
    score += Math.round(similarity * 30);

    return Math.min(100, score);
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

  /**
   * 使用通用规则提取详情链接
   * @param {Document} doc - DOM文档
   * @param {string} baseUrl - 基础URL
   * @param {string} searchKeyword - 搜索关键词
   * @returns {Array} 详情链接数组
   */
  extractDetailLinksWithGenericRules(doc, baseUrl, searchKeyword) {
    const detailLinks = [];
    
    try {
      // 通用选择器列表
      const genericSelectors = [
        'a[href*="/"][title]',
        '.item a, .movie a, .video a, .result a',
        'a[href]'
      ];

      for (const selector of genericSelectors) {
        const links = doc.querySelectorAll(selector);
        
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href) continue;

          const fullUrl = this.resolveRelativeUrl(href, baseUrl);
          
          // 简单验证
          if (!this.isGenericDetailLink(fullUrl)) continue;

          const title = link.getAttribute('title') || link.textContent?.trim() || '';
          const code = this.extractCodeFromText(title);
          
          // 如果有搜索关键词，只保留相关的链接
          if (searchKeyword) {
            const score = this.calculateMatchScore(title, code, searchKeyword);
            if (score < 20) continue; // 分数太低，跳过
          }

          detailLinks.push({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score: searchKeyword ? this.calculateMatchScore(title, code, searchKeyword) : 50,
            extractedFrom: 'generic'
          });
        }

        if (detailLinks.length > 0) break; // 找到就停止
      }

      // 按分数排序
      detailLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
      
    } catch (error) {
      console.error('通用规则提取详情链接失败:', error);
    }

    return detailLinks;
  }

  /**
   * 检查是否为通用详情链接
   * @param {string} url - URL
   * @returns {boolean} 是否为详情链接
   */
  isGenericDetailLink(url) {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // 排除明显的非详情页链接
    const excludePatterns = [
      '/search', '/category', '/tag', '/list', '/page', '?page',
      '/login', '/register', '/user', '/profile', '/settings',
      '.css', '.js', '.png', '.jpg', '.gif', '.ico'
    ];
    
    return !excludePatterns.some(pattern => urlLower.includes(pattern));
  }

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
   * 创建DOM解析器
   * @returns {DOMParser} DOM解析器实例
   */
  createDOMParser() {
    if (typeof DOMParser !== 'undefined') {
      return new DOMParser();
    }
    
    // Node.js环境的替代方案
    if (typeof require !== 'undefined') {
      try {
        const { JSDOM } = require('jsdom');
        return {
          parseFromString: (html, mimeType) => new JSDOM(html).window.document
        };
      } catch (e) {
        console.warn('JSDOM不可用，使用简单解析器');
      }
    }
    
    // 简单的HTML解析器（作为后备方案）
    return {
      parseFromString: (html) => ({
        querySelector: (selector) => null,
        querySelectorAll: (selector) => [],
        textContent: html.replace(/<[^>]*>/g, '')
      })
    };
  }

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

  // === 以下是原有的详情页面解析方法，保持不变 ===

  /**
   * 根据规则提取内容
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {string} 提取的内容
   */
  extractByRule(doc, rule) {
    if (!rule || !rule.selector) return '';

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return '';

      let text = '';
      
      if (rule.attribute) {
        text = element.getAttribute(rule.attribute) || '';
      } else {
        text = element.textContent || element.innerText || '';
      }

      // 应用文本处理规则
      if (rule.transform) {
        text = this.applyTextTransform(text, rule.transform);
      }

      return text.trim();

    } catch (error) {
      console.warn(`提取失败 [${rule.selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {string} 图片URL
   */
  extractImageByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return '';

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return '';

      let imageUrl = '';
      
      if (rule.attribute) {
        imageUrl = element.getAttribute(rule.attribute) || '';
      } else {
        imageUrl = element.getAttribute('src') || element.getAttribute('data-src') || '';
      }

      // 处理相对URL
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = this.resolveRelativeUrl(imageUrl, baseUrl);
      }

      return imageUrl;

    } catch (error) {
      console.warn(`图片提取失败 [${rule.selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取多个图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 图片URL数组
   */
  extractMultipleImagesByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const imageUrls = [];

      elements.forEach(element => {
        let imageUrl = '';
        
        if (rule.attribute) {
          imageUrl = element.getAttribute(rule.attribute) || '';
        } else {
          imageUrl = element.getAttribute('src') || element.getAttribute('data-src') || '';
        }

        if (imageUrl) {
          if (!imageUrl.startsWith('http')) {
            imageUrl = this.resolveRelativeUrl(imageUrl, baseUrl);
          }
          imageUrls.push(imageUrl);
        }
      });

      return imageUrls;

    } catch (error) {
      console.warn(`多图片提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取演员信息
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 演员信息数组
   */
  extractActressesByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const actresses = [];

      elements.forEach(element => {
        const name = element.textContent?.trim() || '';
        if (name) {
          const actress = { name };
          
          // 提取演员链接
          const link = element.getAttribute('href') || 
                      element.querySelector('a')?.getAttribute('href') || '';
          if (link) {
            actress.profileUrl = link;
          }

          // 提取演员头像
          const avatar = element.querySelector('img')?.getAttribute('src') || '';
          if (avatar) {
            actress.avatar = avatar;
          }

          actresses.push(actress);
        }
      });

      return actresses;

    } catch (error) {
      console.warn(`演员信息提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取下载链接
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 下载链接数组
   */
  extractDownloadLinksByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const downloadLinks = [];

      elements.forEach(element => {
        const url = element.getAttribute('href') || '';
        const name = element.textContent?.trim() || '下载链接';
        
        if (url) {
          const link = {
            name,
            url: this.resolveRelativeUrl(url, baseUrl),
            type: this.detectLinkType(url, name)
          };

          // 提取文件大小信息
          const sizeText = element.querySelector('.size, .filesize')?.textContent || '';
          if (sizeText) {
            link.size = sizeText.trim();
          }

          // 提取质量信息
          const qualityText = element.querySelector('.quality, .resolution')?.textContent || '';
          if (qualityText) {
            link.quality = qualityText.trim();
          }

          downloadLinks.push(link);
        }
      });

      return downloadLinks;

    } catch (error) {
      console.warn(`下载链接提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取磁力链接
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 磁力链接数组
   */
  extractMagnetLinksByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const magnetLinks = [];

      elements.forEach(element => {
        const magnet = element.getAttribute('href') || element.textContent || '';
        
        if (magnet.startsWith('magnet:?xt=urn:btih:')) {
          const name = element.getAttribute('title') || 
                      element.querySelector('.name, .title')?.textContent?.trim() || 
                      '磁力链接';

          const link = { name, magnet };

          // 提取文件大小
          const sizeElement = element.querySelector('.size, .filesize') || 
                             element.parentElement?.querySelector('.size, .filesize');
          if (sizeElement) {
            link.size = sizeElement.textContent?.trim() || '';
          }

          // 提取种子信息
          const seedersElement = element.querySelector('.seeders, .seeds') ||
                                element.parentElement?.querySelector('.seeders, .seeds');
          if (seedersElement) {
            link.seeders = parseInt(seedersElement.textContent) || 0;
          }

          const leechersElement = element.querySelector('.leechers, .peers') ||
                                 element.parentElement?.querySelector('.leechers, .peers');
          if (leechersElement) {
            link.leechers = parseInt(leechersElement.textContent) || 0;
          }

          magnetLinks.push(link);
        }
      });

      return magnetLinks;

    } catch (error) {
      console.warn(`磁力链接提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取标签
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 标签数组
   */
  extractTagsByRule(doc, rule) {
    if (!rule || !rule.selector) return [];

    try {
      const elements = doc.querySelectorAll(rule.selector);
      const tags = [];

      elements.forEach(element => {
        const tag = element.textContent?.trim() || '';
        if (tag && !tags.includes(tag)) {
          // 检查是否在排除列表中
          if (rule.excludeTexts && rule.excludeTexts.includes(tag)) {
            return;
          }
          tags.push(tag);
        }
      });

      return tags;

    } catch (error) {
      console.warn(`标签提取失败 [${rule.selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取评分
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {number} 评分
   */
  extractRatingByRule(doc, rule) {
    if (!rule || !rule.selector) return 0;

    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return 0;

      let ratingText = element.textContent?.trim() || '';
      
      if (rule.attribute) {
        ratingText = element.getAttribute(rule.attribute) || '';
      }

      // 解析评分数字
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      if (ratingMatch) {
        return parseFloat(ratingMatch[1]);
      }

      return 0;

    } catch (error) {
      console.warn(`评分提取失败 [${rule.selector}]:`, error.message);
      return 0;
    }
  }

  /**
   * 应用文本转换
   * @param {string} text - 原始文本
   * @param {Array} transforms - 转换规则
   * @returns {string} 转换后的文本
   */
  applyTextTransform(text, transforms) {
    if (!Array.isArray(transforms)) return text;

    let result = text;

    transforms.forEach(transform => {
      switch (transform.type) {
        case 'replace':
          if (transform.pattern && transform.replacement !== undefined) {
            const regex = new RegExp(transform.pattern, transform.flags || 'g');
            result = result.replace(regex, transform.replacement);
          }
          break;
          
        case 'trim':
          result = result.trim();
          break;
          
        case 'uppercase':
          result = result.toUpperCase();
          break;
          
        case 'lowercase':
          result = result.toLowerCase();
          break;
          
        case 'extract':
          if (transform.pattern) {
            const regex = new RegExp(transform.pattern, transform.flags || '');
            const match = result.match(regex);
            if (match && match[transform.group || 1]) {
              result = match[transform.group || 1];
            }
          }
          break;
      }
    });

    return result;
  }

  /**
   * 检测链接类型
   * @param {string} url - 链接URL
   * @param {string} name - 链接名称
   * @returns {string} 链接类型
   */
  detectLinkType(url, name) {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();

    if (urlLower.includes('magnet:') || nameLower.includes('磁力')) {
      return 'magnet';
    }
    
    if (urlLower.includes('.torrent') || nameLower.includes('种子')) {
      return 'torrent';
    }
    
    if (urlLower.includes('ed2k:') || nameLower.includes('电驴')) {
      return 'ed2k';
    }
    
    if (urlLower.includes('ftp://') || nameLower.includes('ftp')) {
      return 'ftp';
    }
    
    if (urlLower.includes('pan.baidu.com') || nameLower.includes('百度网盘')) {
      return 'baidu_pan';
    }
    
    if (urlLower.includes('drive.google.com') || nameLower.includes('google drive')) {
      return 'google_drive';
    }

    return 'http';
  }

  /**
   * 通用解析规则（作为后备方案）
   * @param {Document} doc - DOM文档
   * @param {string} originalUrl - 原始URL
   * @param {string} originalTitle - 原始标题
   * @returns {Object} 解析结果
   */
  parseWithGenericRules(doc, originalUrl, originalTitle) {
    console.log('使用通用解析规则');

    try {
      const result = {
        title: originalTitle,
        originalUrl,
        sourceType: 'generic'
      };

      // 尝试从页面标题提取信息
      const pageTitle = doc.querySelector('title')?.textContent?.trim() || '';
      if (pageTitle && pageTitle !== originalTitle) {
        result.title = pageTitle;
      }

      // 尝试提取番号
      const codeMatch = (pageTitle || originalTitle).match(/([A-Z]{2,6}-?\d{3,6})/i);
      if (codeMatch) {
        result.code = codeMatch[1].toUpperCase();
      }

      // 尝试提取封面图片
      const possibleCoverSelectors = [
        'img[class*="cover"]',
        'img[class*="poster"]',
        'img[class*="thumb"]',
        '.cover img',
        '.poster img',
        '.thumbnail img',
        'img[src*="cover"]',
        'img[src*="poster"]'
      ];

      for (const selector of possibleCoverSelectors) {
        const img = doc.querySelector(selector);
        if (img) {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (src) {
            result.coverImage = this.resolveRelativeUrl(src, originalUrl);
            break;
          }
        }
      }

      // 尝试提取描述
      const possibleDescSelectors = [
        '.description',
        '.summary',
        '.synopsis',
        '[class*="desc"]',
        '[class*="summary"]'
      ];

      for (const selector of possibleDescSelectors) {
        const desc = doc.querySelector(selector);
        if (desc) {
          result.description = desc.textContent?.trim() || '';
          if (result.description.length > 50) break;
        }
      }

      // 尝试提取磁力链接
      const magnetLinks = [];
      const magnetElements = doc.querySelectorAll('a[href^="magnet:"]');
      magnetElements.forEach(element => {
        const magnet = element.getAttribute('href');
        const name = element.textContent?.trim() || '磁力链接';
        if (magnet) {
          magnetLinks.push({ name, magnet });
        }
      });
      result.magnetLinks = magnetLinks;

      // 尝试提取下载链接
      const downloadLinks = [];
      const downloadElements = doc.querySelectorAll('a[href*="download"], a[class*="download"], .download a');
      downloadElements.forEach(element => {
        const url = element.getAttribute('href');
        const name = element.textContent?.trim() || '下载链接';
        if (url && !url.startsWith('magnet:')) {
          downloadLinks.push({
            name,
            url: this.resolveRelativeUrl(url, originalUrl),
            type: this.detectLinkType(url, name)
          });
        }
      });
      result.downloadLinks = downloadLinks;

      console.log('通用解析完成');
      return result;

    } catch (error) {
      console.error('通用解析失败:', error);
      return {
        title: originalTitle,
        originalUrl,
        sourceType: 'generic',
        extractionError: error.message
      };
    }
  }

  /**
   * 清理和验证数据
   * @param {Object} data - 原始数据
   * @returns {Object} 清理后的数据
   */
  cleanAndValidateData(data) {
    const cleaned = {};

    Object.keys(data).forEach(key => {
      const value = data[key];
      
      if (value === null || value === undefined) {
        return;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          cleaned[key] = trimmed;
        }
      } else if (Array.isArray(value)) {
        const filtered = value.filter(item => 
          item !== null && 
          item !== undefined && 
          (typeof item !== 'string' || item.trim())
        );
        if (filtered.length > 0) {
          cleaned[key] = filtered;
        }
      } else {
        cleaned[key] = value;
      }
    });

    return cleaned;
  }
}

// 创建单例实例
export const contentParser = new ContentParserService();
export default contentParser;