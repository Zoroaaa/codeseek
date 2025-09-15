// src/parsers/JavBusParser.js - JavBus站点专用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

export class JavBusParser extends BaseParser {
  constructor() {
    super('javbus');
  }

  /**
   * JavBus站点名称
   */
  getSiteName() {
    return 'JavBus';
  }

  /**
   * JavBus站点描述
   */
  getSiteDescription() {
    return 'JavBus - 日本成人影片数据库';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'screenshots', 'magnet_links', 'actress_info'];
  }

  /**
   * 验证是否为有效的JavBus详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    // JavBus详情页格式: /IPX-156 或 https://www.javbus.com/IPX-156
    const patterns = [
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,  // 番号路径格式
      /javbus\.com\/[A-Z]{2,6}-?\d{3,6}/i // 完整URL格式
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 从JavBus搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始提取JavBus详情链接...');

    try {
      // 方法1: 寻找movie-box容器
      const movieBoxes = doc.querySelectorAll('.movie-box');
      console.log(`找到 ${movieBoxes.length} 个movie-box容器`);

      movieBoxes.forEach((box, index) => {
        const link = box.querySelector('a[href]') || box;
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href || href === '#' || href.startsWith('javascript')) return;

        const fullUrl = this.resolveUrl(href, baseUrl);
        
        // 验证是否为有效的JavBus详情页链接
        if (!this.isValidDetailUrl(fullUrl)) return;
        
        // 确保不是搜索页面本身
        if (this.isSameUrl(fullUrl, baseUrl)) return;

        // 提取标题和番号
        const img = box.querySelector('img');
        const title = img ? (img.getAttribute('title') || img.getAttribute('alt') || '') : '';
        const code = this.extractCode(title) || this.extractCode(fullUrl);
        
        // 计算匹配分数
        const score = this.calculateMatchScore({ title, code }, searchKeyword);

        console.log(`找到JavBus详情链接: ${fullUrl} (分数: ${score})`);

        detailLinks.push(new DetailLinkData({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javbus_moviebox'
        }));
      });

      // 方法2: 如果movie-box没找到，尝试直接链接匹配
      if (detailLinks.length === 0) {
        console.log('movie-box方式未找到，尝试直接链接方式');
        
        const directLinks = doc.querySelectorAll('a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])');
        directLinks.forEach(link => {
          const href = link.getAttribute('href');
          const fullUrl = this.resolveUrl(href, baseUrl);
          
          if (this.isValidDetailUrl(fullUrl) && 
              !this.isSameUrl(fullUrl, baseUrl) &&
              this.isSameDomain(fullUrl, baseUrl)) {
            
            const title = link.textContent?.trim() || link.getAttribute('title') || '';
            const code = this.extractCode(title) || this.extractCode(fullUrl);
            const score = this.calculateMatchScore({ title, code }, searchKeyword);
            
            detailLinks.push(new DetailLinkData({
              url: fullUrl,
              title: title || '未知标题',
              code: code || '',
              score,
              extractedFrom: 'javbus_direct'
            }));
          }
        });
      }

    } catch (error) {
      console.error('JavBus详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`JavBus提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks;
  }

  /**
   * 解析JavBus详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始解析JavBus详情页面...');

    try {
      const data = {
        // 基本信息
        title: this.extractTitle(doc),
        code: this.extractCode(this.extractTitle(doc)) || this.extractCode(originalUrl),
        
        // 媒体信息
        cover: this.extractCoverImage(doc, originalUrl),
        screenshots: this.extractScreenshots(doc, originalUrl),
        
        // 演员信息
        actors: this.extractActorsInfo(doc),
        director: this.extractText(doc, '.info .genre:contains("導演") a'),
        studio: this.extractText(doc, '.info .genre:contains("製作商") a'),
        label: this.extractText(doc, '.info .genre:contains("發行商") a'),
        series: this.extractText(doc, '.info .genre:contains("系列") a'),
        
        // 发布信息
        releaseDate: this.extractReleaseDate(doc),
        duration: this.extractDuration(this.extractText(doc, '.info .genre:contains("長度")')),
        
        // 分类标签
        tags: this.extractTags(doc),
        
        // 下载信息
        magnetLinks: this.extractMagnetLinks(doc, 'a[href^="magnet:"]'),
        downloadLinks: this.extractDownloadLinks(doc, 'a[href*="download"]', originalUrl),
        
        // 其他信息
        description: this.extractText(doc, '.description, .summary, .intro'),
        rating: this.extractRating(this.extractText(doc, '.rating, .score, .rate')),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('JavBus详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('JavBus详情页面解析失败:', error);
      throw new Error(`JavBus页面解析失败: ${error.message}`);
    }
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    const selectors = ['h3', '.title', 'title'];
    
    for (const selector of selectors) {
      const title = this.extractText(doc, selector);
      if (title && title.length > 5) {
        return title.replace(/\s+/g, ' ').trim();
      }
    }
    
    return '';
  }

  /**
   * 提取封面图片
   */
  extractCoverImage(doc, baseUrl) {
    const selectors = [
      '.screencap img',
      '.bigImage img', 
      '.poster img',
      'img[class*="cover"]'
    ];
    
    for (const selector of selectors) {
      const url = this.extractImageUrl(doc, selector, baseUrl);
      if (url) return url;
    }
    
    return '';
  }

  /**
   * 提取截图
   */
  extractScreenshots(doc, baseUrl) {
    const selectors = [
      '.sample-box img',
      '.screenshot img',
      '.preview img',
      'img[class*="sample"]'
    ];
    
    for (const selector of selectors) {
      const screenshots = this.extractMultipleImageUrls(doc, selector, baseUrl);
      if (screenshots.length > 0) return screenshots;
    }
    
    return [];
  }

  /**
   * 提取演员信息
   */
  extractActorsInfo(doc) {
    const selectors = [
      '.star-name a',
      '.actress a',
      '.info .genre:contains("演員") a'
    ];
    
    for (const selector of selectors) {
      const actors = this.extractActors(doc, selector);
      if (actors.length > 0) return actors;
    }
    
    return [];
  }

  /**
   * 提取发布日期
   */
  extractReleaseDate(doc) {
    const dateText = this.extractText(doc, '.info .genre:contains("發行日期")');
    return this.extractDate(dateText);
  }

  /**
   * 提取标签
   */
  extractTags(doc) {
    const excludeTexts = ['演員', '導演', '製作商', '發行商', '系列', '發行日期', '長度'];
    const tagElements = doc.querySelectorAll('.genre a, .tag a, .category a');
    const tags = [];

    tagElements.forEach(el => {
      const tag = el.textContent?.trim() || '';
      if (tag && !excludeTexts.includes(tag) && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * 获取JavBus特定的请求头
   */
  getRequestHeaders() {
    return {
      ...super.getRequestHeaders(),
      'Referer': 'https://www.javbus.com/'
    };
  }

  /**
   * 辅助方法：解析URL
   */
  resolveUrl(href, baseUrl) {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.protocol}//${urlObj.host}${href}`;
    }
    return href;
  }

  /**
   * 辅助方法：检查是否为相同URL
   */
  isSameUrl(url1, url2) {
    if (!url1 || !url2) return false;
    
    try {
      const normalizeUrl = (url) => {
        return url.toLowerCase()
                  .replace(/\/$/, '')
                  .replace(/\?.*$/, '')
                  .replace(/#.*$/, '');
      };
      
      return normalizeUrl(url1) === normalizeUrl(url2);
    } catch {
      return false;
    }
  }

  /**
   * 辅助方法：去重链接
   */
  removeDuplicateLinks(links) {
    const seen = new Set();
    return links.filter(link => {
      const normalizedUrl = this.isSameUrl(link.url, '') ? link.url.toLowerCase() : link.url;
      if (seen.has(normalizedUrl)) {
        return false;
      }
      seen.add(normalizedUrl);
      return true;
    });
  }
}

export default JavBusParser;