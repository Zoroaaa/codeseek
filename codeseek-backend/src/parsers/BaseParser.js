// src/parsers/BaseParser.js - 抽象基类解析器

import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';
import { cloudflareHTMLParser } from '../utils/html-parser.js';
import { extractionValidator } from '../services/extraction-validator.js';
import { CONFIG } from '../constants.js';

/**
 * 抽象基类解析器
 * 所有站点解析器都应该继承此类
 */
export class BaseParser {
  constructor(sourceType) {
    if (new.target === BaseParser) {
      throw new Error('BaseParser 是抽象类，不能直接实例化');
    }
    
    this.sourceType = sourceType;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    this.timeout = CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT;
  }

  /**
   * 抽象方法：从搜索页面提取详情页链接
   * 子类必须实现此方法
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    throw new Error('extractDetailLinks 方法必须在子类中实现');
  }

  /**
   * 抽象方法：解析详情页面内容
   * 子类必须实现此方法
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    throw new Error('parseDetailPage 方法必须在子类中实现');
  }

  /**
   * 验证是否为有效的详情页URL
   * 子类可以重写此方法
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    return extractionValidator.isDetailPageUrl(url, this.sourceType);
  }

  /**
   * 验证是否为同一域名
   * @param {string} url - 要验证的URL
   * @param {string} baseUrl - 基础URL
   * @returns {boolean} 是否为同一域名
   */
  isSameDomain(url, baseUrl) {
    const urlDomain = extractionValidator.extractDomain(url);
    const baseDomain = extractionValidator.extractDomain(baseUrl);
    return extractionValidator.isDomainOrSubdomainMatch(urlDomain, baseDomain);
  }

  /**
   * 解析HTML文档
   * @param {string} htmlContent - HTML内容
   * @returns {Document} 解析后的文档对象
   */
  parseHTML(htmlContent) {
    return cloudflareHTMLParser.parseFromString(htmlContent);
  }

  /**
   * 提取文本内容
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {string} attribute - 属性名（可选）
   * @returns {string} 提取的文本
   */
  extractText(element, selector, attribute = null) {
    try {
      const targetElement = selector ? element.querySelector(selector) : element;
      if (!targetElement) return '';

      if (attribute) {
        return targetElement.getAttribute(attribute) || '';
      } else {
        return targetElement.textContent?.trim() || '';
      }
    } catch (error) {
      console.warn(`提取文本失败 [${selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取多个文本内容
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {string} attribute - 属性名（可选）
   * @returns {Array} 文本数组
   */
  extractMultipleTexts(element, selector, attribute = null) {
    try {
      const elements = element.querySelectorAll(selector);
      const texts = [];

      elements.forEach(el => {
        let text = '';
        if (attribute) {
          text = el.getAttribute(attribute) || '';
        } else {
          text = el.textContent?.trim() || '';
        }
        
        if (text) {
          texts.push(text);
        }
      });

      return texts;
    } catch (error) {
      console.warn(`提取多个文本失败 [${selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取图片URL
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {string} baseUrl - 基础URL
   * @returns {string} 图片URL
   */
  extractImageUrl(element, selector, baseUrl) {
    try {
      const img = element.querySelector(selector);
      if (!img) return '';

      const src = img.getAttribute('src') || 
                  img.getAttribute('data-src') || 
                  img.getAttribute('data-original') || '';

      if (src) {
        return extractionValidator.resolveRelativeUrl(src, baseUrl);
      }

      return '';
    } catch (error) {
      console.warn(`提取图片URL失败 [${selector}]:`, error.message);
      return '';
    }
  }

  /**
   * 提取多个图片URL
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {string} baseUrl - 基础URL
   * @param {number} maxCount - 最大数量
   * @returns {Array} 图片URL数组
   */
  extractMultipleImageUrls(element, selector, baseUrl, maxCount = CONFIG.DETAIL_EXTRACTION.MAX_SCREENSHOTS) {
    try {
      const images = element.querySelectorAll(selector);
      const urls = [];

      for (let i = 0; i < Math.min(images.length, maxCount); i++) {
        const img = images[i];
        const src = img.getAttribute('src') || 
                    img.getAttribute('data-src') || 
                    img.getAttribute('data-original') || '';

        if (src) {
          const fullUrl = extractionValidator.resolveRelativeUrl(src, baseUrl);
          if (fullUrl) {
            urls.push(fullUrl);
          }
        }
      }

      return urls;
    } catch (error) {
      console.warn(`提取多个图片URL失败 [${selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取番号
   * @param {string} text - 文本内容
   * @returns {string} 番号
   */
  extractCode(text) {
    return extractionValidator.extractCodeFromText(text) || '';
  }

  /**
   * 提取日期
   * @param {string} text - 文本内容
   * @returns {string} 日期（YYYY-MM-DD格式）
   */
  extractDate(text) {
    if (!text) return '';
    
    const dateMatch = text.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = dateMatch[2].padStart(2, '0');
      const day = dateMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    const isoMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      return isoMatch[1];
    }
    
    return '';
  }

  /**
   * 提取评分
   * @param {string} text - 文本内容
   * @returns {number} 评分
   */
  extractRating(text) {
    if (!text) return 0;
    
    const ratingMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (ratingMatch) {
      const rating = parseFloat(ratingMatch[1]);
      return Math.min(Math.max(rating, 0), 10); // 限制在0-10之间
    }
    
    return 0;
  }

  /**
   * 提取时长（分钟）
   * @param {string} text - 文本内容
   * @returns {string} 时长
   */
  extractDuration(text) {
    if (!text) return '';
    
    const durationMatch = text.match(/(\d+)\s*[分钟min]/i);
    if (durationMatch) {
      return durationMatch[1] + '分钟';
    }
    
    const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const totalMinutes = hours * 60 + minutes;
      return totalMinutes + '分钟';
    }
    
    return text.trim();
  }

  /**
   * 提取演员信息
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @returns {Array} 演员信息数组
   */
  extractActors(element, selector) {
    try {
      const actorElements = element.querySelectorAll(selector);
      const actors = [];

      actorElements.forEach(el => {
        const name = el.textContent?.trim() || '';
        if (name && name !== '---' && name !== '-') {
          const actor = { name };
          
          // 尝试提取演员链接
          const link = el.getAttribute('href') || 
                      el.querySelector('a')?.getAttribute('href') || '';
          if (link) {
            actor.profileUrl = link;
          }
          
          // 尝试提取演员头像
          const avatar = el.querySelector('img')?.getAttribute('src') || '';
          if (avatar) {
            actor.avatar = avatar;
          }
          
          actors.push(actor);
        }
      });

      return actors;
    } catch (error) {
      console.warn(`提取演员信息失败 [${selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取磁力链接
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {number} maxCount - 最大数量
   * @returns {Array} 磁力链接数组
   */
  extractMagnetLinks(element, selector, maxCount = CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS) {
    try {
      const magnetElements = element.querySelectorAll(selector);
      const magnets = [];

      for (let i = 0; i < Math.min(magnetElements.length, maxCount); i++) {
        const el = magnetElements[i];
        const magnet = el.getAttribute('href') || el.textContent?.trim() || '';
        
        if (magnet && magnet.startsWith('magnet:?xt=urn:btih:')) {
          const link = {
            magnet,
            name: el.getAttribute('title') || el.textContent?.trim() || '磁力链接'
          };
          
          // 提取文件大小
          const sizeElement = el.querySelector('.size, .filesize') ||
                             el.parentElement?.querySelector('.size, .filesize');
          if (sizeElement) {
            link.size = sizeElement.textContent?.trim() || '';
          }
          
          // 提取种子信息
          const seedersElement = el.querySelector('.seeders, .seeds') ||
                                el.parentElement?.querySelector('.seeders, .seeds');
          if (seedersElement) {
            link.seeders = parseInt(seedersElement.textContent) || 0;
          }
          
          const leechersElement = el.querySelector('.leechers, .peers') ||
                                 el.parentElement?.querySelector('.leechers, .peers');
          if (leechersElement) {
            link.leechers = parseInt(leechersElement.textContent) || 0;
          }
          
          magnets.push(link);
        }
      }

      return magnets;
    } catch (error) {
      console.warn(`提取磁力链接失败 [${selector}]:`, error.message);
      return [];
    }
  }

  /**
   * 提取下载链接
   * @param {Element} element - DOM元素
   * @param {string} selector - 选择器
   * @param {string} baseUrl - 基础URL
   * @param {number} maxCount - 最大数量
   * @returns {Array} 下载链接数组
   */
  extractDownloadLinks(element, selector, baseUrl, maxCount = CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS) {
    try {
      const linkElements = element.querySelectorAll(selector);
      const links = [];

      for (let i = 0; i < Math.min(linkElements.length, maxCount); i++) {
        const el = linkElements[i];
        const url = el.getAttribute('href') || '';
        const name = el.textContent?.trim() || '下载链接';
        
        if (url && !url.startsWith('magnet:')) {
          const link = {
            url: extractionValidator.resolveRelativeUrl(url, baseUrl),
            name,
            type: this.detectLinkType(url, name)
          };
          
          // 提取文件大小
          const sizeElement = el.querySelector('.size, .filesize');
          if (sizeElement) {
            link.size = sizeElement.textContent?.trim() || '';
          }
          
          // 提取质量信息
          const qualityElement = el.querySelector('.quality, .resolution');
          if (qualityElement) {
            link.quality = qualityElement.textContent?.trim() || '';
          }
          
          links.push(link);
        }
      }

      return links;
    } catch (error) {
      console.warn(`提取下载链接失败 [${selector}]:`, error.message);
      return [];
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

    if (urlLower.includes('stream') || urlLower.includes('play') || nameLower.includes('在线')) {
      return 'stream';
    }

    return 'download';
  }

  /**
   * 清理和验证数据
   * @param {Object} data - 原始数据
   * @returns {ParsedData} 清理后的数据
   */
  cleanAndValidateData(data) {
    const parsedData = new ParsedData({
      ...data,
      sourceType: this.sourceType,
      extractedAt: Date.now()
    });

    // 验证数据
    const validation = parsedData.validate();
    if (!validation.valid) {
      console.warn(`数据验证警告:`, validation.errors);
    }

    return parsedData;
  }

  /**
   * 计算匹配分数
   * @param {Object} link - 链接对象
   * @param {string} searchKeyword - 搜索关键词
   * @returns {number} 匹配分数
   */
  calculateMatchScore(link, searchKeyword) {
    if (!searchKeyword) return 50;

    let score = 0;
    const keyword = searchKeyword.toLowerCase();
    const title = (link.title || '').toLowerCase();
    const code = (link.code || '').toLowerCase();

    // 番号完全匹配
    if (code && keyword === code) {
      score += 40;
    } else if (code && (code.includes(keyword) || keyword.includes(code))) {
      score += 30;
    }

    // 标题匹配
    if (title && keyword === title) {
      score += 30;
    } else if (title && title.includes(keyword)) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * 获取站点特定的请求头
   * @returns {Object} 请求头对象
   */
  getRequestHeaders() {
    return {
      'User-Agent': this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
  }

  /**
   * 获取站点信息
   * @returns {Object} 站点信息
   */
  getSiteInfo() {
    return {
      type: this.sourceType,
      name: this.getSiteName(),
      description: this.getSiteDescription(),
      supportedFeatures: this.getSupportedFeatures()
    };
  }

  /**
   * 获取站点名称（子类可重写）
   * @returns {string} 站点名称
   */
  getSiteName() {
    return this.sourceType.toUpperCase();
  }

  /**
   * 获取站点描述（子类可重写）
   * @returns {string} 站点描述
   */
  getSiteDescription() {
    return `${this.sourceType} 解析器`;
  }

  /**
   * 获取支持的功能（子类可重写）
   * @returns {Array} 支持的功能列表
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links'];
  }
}

export default BaseParser;