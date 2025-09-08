// src/services/content-parser.js - 网页内容解析器
import { parserRules } from '../config/parser-rules.js';

export class ContentParserService {
  constructor() {
    this.parseTimeout = 10000;
    this.maxRetries = 2;
  }

  /**
   * 解析详情页面内容
   * @param {string} htmlContent - HTML内容
   * @param {Object} options - 解析选项
   * @returns {Object} 解析后的详情信息
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { sourceType, originalUrl, originalTitle } = options;
    
    console.log(`开始解析页面内容，源类型: ${sourceType}`);

    try {
      // 创建DOM解析器（使用DOMParser或jsdom）
      const parser = this.createDOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');

      // 获取对应的解析规则
      const rules = parserRules.getParserRules(sourceType);
      if (!rules) {
        console.warn(`未找到 ${sourceType} 的解析规则，使用通用规则`);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      }

      console.log(`使用 ${sourceType} 专用解析规则`);

      // 应用解析规则
      const detailInfo = {
        sourceType,
        originalUrl,
        
        // 基本信息
        title: this.extractByRule(doc, rules.title),
        originalTitle: this.extractByRule(doc, rules.originalTitle),
        code: this.extractByRule(doc, rules.code),
        
        // 媒体信息
        coverImage: this.extractImageByRule(doc, rules.coverImage, originalUrl),
        screenshots: this.extractMultipleImagesByRule(doc, rules.screenshots, originalUrl),
        
        // 演员信息
        actresses: this.extractActressesByRule(doc, rules.actresses),
        director: this.extractByRule(doc, rules.director),
        studio: this.extractByRule(doc, rules.studio),
        label: this.extractByRule(doc, rules.label),
        series: this.extractByRule(doc, rules.series),
        
        // 发布信息
        releaseDate: this.extractByRule(doc, rules.releaseDate),
        duration: this.extractByRule(doc, rules.duration),
        
        // 技术信息
        quality: this.extractByRule(doc, rules.quality),
        fileSize: this.extractByRule(doc, rules.fileSize),
        resolution: this.extractByRule(doc, rules.resolution),
        
        // 下载信息
        downloadLinks: this.extractDownloadLinksByRule(doc, rules.downloadLinks, originalUrl),
        magnetLinks: this.extractMagnetLinksByRule(doc, rules.magnetLinks),
        
        // 其他信息
        description: this.extractByRule(doc, rules.description),
        tags: this.extractTagsByRule(doc, rules.tags),
        rating: this.extractRatingByRule(doc, rules.rating)
      };

      // 数据清理和验证
      const cleanedInfo = this.cleanAndValidateData(detailInfo);
      
      console.log(`页面解析完成，提取到 ${Object.keys(cleanedInfo).length} 个字段`);
      return cleanedInfo;

    } catch (error) {
      console.error('页面解析失败:', error);
      
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