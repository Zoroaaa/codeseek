// src/parsers/JavDBParser.js - JavDB站点专用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

export class JavDBParser extends BaseParser {
  constructor() {
    super('javdb');
  }

  /**
   * JavDB站点名称
   */
  getSiteName() {
    return 'JavDB';
  }

  /**
   * JavDB站点描述
   */
  getSiteDescription() {
    return 'JavDB - 日本成人影片数据库';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'screenshots', 'actress_info', 'tags'];
  }

  /**
   * 验证是否为有效的JavDB详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    // JavDB详情页格式: /v/KkZ97 或 https://javdb.com/v/KkZ97
    const patterns = [
      /\/v\/[a-zA-Z0-9]+/,
      /javdb\.com\/v\/[a-zA-Z0-9]+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 从JavDB搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始提取JavDB详情链接...');

    try {
      // JavDB的视频项目选择器
      const videoSelectors = [
        '.movie-list .item a',
        '.grid-item a', 
        '.video-node a',
        'a[href*="/v/"]'
      ];

      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);

        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;

          const fullUrl = this.resolveUrl(href, baseUrl);
          
          // 验证域名一致性
          if (!this.isSameDomain(fullUrl, baseUrl)) return;
          
          // 确保不是搜索URL本身
          if (this.isSameUrl(fullUrl, baseUrl)) return;
          
          // JavDB详情页格式验证：/v/xxxx
          if (!this.isValidDetailUrl(fullUrl)) return;
          
          // 避免搜索页面
          if (fullUrl.includes('/search')) return;
          
          // 提取标题信息
          const titleElement = link.querySelector('.video-title, .title, h4') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = this.extractCode(title) || this.extractCode(fullUrl);
          const score = this.calculateMatchScore({ title, code }, searchKeyword);
          
          detailLinks.push(new DetailLinkData({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'javdb_video'
          }));
        });
        
        if (detailLinks.length > 0) break;
      }

    } catch (error) {
      console.error('JavDB详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`JavDB提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks;
  }

  /**
   * 解析JavDB详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始解析JavDB详情页面...');

    try {
      const data = {
        // 基本信息
        title: this.extractTitle(doc),
        code: this.extractCode(doc),
        
        // 媒体信息
        cover: this.extractCoverImage(doc, originalUrl),
        screenshots: this.extractScreenshots(doc, originalUrl),
        
        // 演员信息
        actors: this.extractActorsInfo(doc),
        director: this.extractText(doc, '.panel-block:contains("導演") .value'),
        studio: this.extractText(doc, '.panel-block:contains("片商") .value'),
        label: this.extractText(doc, '.panel-block:contains("廠牌") .value'),
        series: this.extractText(doc, '.panel-block:contains("系列") .value'),
        
        // 发布信息
        releaseDate: this.extractReleaseDate(doc),
        duration: this.extractDuration(this.extractText(doc, '.panel-block:contains("時長") .value')),
        
        // 分类标签
        tags: this.extractTags(doc),
        
        // 下载信息
        magnetLinks: this.extractMagnetLinks(doc, 'a[href^="magnet:"]'),
        
        // 其他信息
        description: this.extractText(doc, '.description, .content'),
        rating: this.extractRating(this.extractText(doc, '.score, .rating')),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('JavDB详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('JavDB详情页面解析失败:', error);
      throw new Error(`JavDB页面解析失败: ${error.message}`);
    }
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    const selectors = ['h2.title', '.video-title', 'title'];
    
    for (const selector of selectors) {
      const title = this.extractText(doc, selector);
      if (title && title.length > 5) {
        return title.replace(/\s+/g, ' ').trim();
      }
    }
    
    return '';
  }

  /**
   * 提取番号
   */
  extractCode(doc) {
    const selectors = [
      '.first-block .value',
      '.video-meta strong',
      'h2.title'
    ];
    
    for (const selector of selectors) {
      const text = this.extractText(doc, selector);
      const code = this.extractCode(text);
      if (code) return code;
    }
    
    return '';
  }

  /**
   * 提取封面图片
   */
  extractCoverImage(doc, baseUrl) {
    const selectors = [
      '.video-cover img',
      '.cover img'
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
      '.tile-images img',
      '.preview-images img'
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
      '.panel-block:contains("演員") .value a',
      '.actress-tag a'
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
    const dateText = this.extractText(doc, '.panel-block:contains("時間") .value');
    return this.extractDate(dateText);
  }

  /**
   * 提取标签
   */
  extractTags(doc) {
    const excludeTexts = ['演員', '導演', '片商', '廠牌', '系列', '時間', '時長'];
    const tagElements = doc.querySelectorAll('.panel-block:contains("類別") .tag a, .genre-tag a');
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
   * 获取JavDB特定的请求头
   */
  getRequestHeaders() {
    return {
      ...super.getRequestHeaders(),
      'Referer': 'https://javdb.com/'
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
      const normalizedUrl = link.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(normalizedUrl)) {
        return false;
      }
      seen.add(normalizedUrl);
      return true;
    });
  }
}

export default JavDBParser;