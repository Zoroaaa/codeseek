// src/parsers/JableParser.js - Jable站点专用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

export class JableParser extends BaseParser {
  constructor() {
    super('jable');
  }

  /**
   * Jable站点名称
   */
  getSiteName() {
    return 'Jable';
  }

  /**
   * Jable站点描述
   */
  getSiteDescription() {
    return 'Jable.TV - 在线视频播放平台';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'streaming', 'actress_info'];
  }

  /**
   * 验证是否为有效的Jable详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    // Jable详情页格式: /videos/ipx-156/ 或 https://jable.tv/videos/ipx-156/
    const patterns = [
      /\/videos\/[^\/\?]+/,
      /jable\.tv\/videos\/[^\/\?]+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 从Jable搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始提取Jable详情链接...');

    try {
      const videoSelectors = [
        '.video-item a[href*="/videos/"]',
        '.list-videos a[href*="/videos/"]',
        'a[href*="/videos/"]:not([href*="/search"])'
      ];

      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`选择器 ${selector} 找到 ${links.length} 个链接`);

        links.forEach(link => {
          const href = link.getAttribute('href');
          if (!href) return;

          const fullUrl = this.resolveUrl(href, baseUrl);
          
          // Jable严格域名检查 - 必须是jable.tv域名
          const linkDomain = this.extractDomain(fullUrl);
          if (linkDomain !== 'jable.tv') return;
          
          if (this.isSameUrl(fullUrl, baseUrl)) return;
          
          // Jable详情页格式：/videos/xxx
          if (!this.isValidDetailUrl(fullUrl)) return;
          if (fullUrl.includes('/search')) return;
          
          const titleElement = link.querySelector('.title, h4, .video-title') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = this.extractCode(title) || this.extractCode(fullUrl);
          const score = this.calculateMatchScore({ title, code }, searchKeyword);
          
          detailLinks.push(new DetailLinkData({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'jable_video'
          }));
        });
        
        if (detailLinks.length > 0) break;
      }

    } catch (error) {
      console.error('Jable详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`Jable提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks;
  }

  /**
   * 解析Jable详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始解析Jable详情页面...');

    try {
      const data = {
        // 基本信息
        title: this.extractTitle(doc),
        code: this.extractCode(doc, originalUrl),
        
        // 媒体信息
        cover: this.extractCoverImage(doc, originalUrl),
        screenshots: this.extractScreenshots(doc, originalUrl),
        
        // 演员信息
        actors: this.extractActorsInfo(doc),
        
        // 发布信息
        releaseDate: this.extractReleaseDate(doc),
        duration: this.extractDuration(this.extractText(doc, '.video-detail .duration, .length')),
        
        // 分类标签
        tags: this.extractTags(doc),
        
        // 下载信息 - Jable主要是在线播放
        links: this.extractStreamingLinks(doc, originalUrl),
        
        // 其他信息
        description: this.extractText(doc, '.description, .content'),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('Jable详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('Jable详情页面解析失败:', error);
      throw new Error(`Jable页面解析失败: ${error.message}`);
    }
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    const selectors = ['.title-video', 'h1', '.video-title'];
    
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
  extractCode(doc, url) {
    // 先从页面内容中查找
    const selectors = [
      '.models a',
      '.video-detail strong',
      '.title-video'
    ];
    
    for (const selector of selectors) {
      const text = this.extractText(doc, selector);
      const code = super.extractCode(text);
      if (code) return code;
    }
    
    // 从URL中提取
    return super.extractCode(url);
  }

  /**
   * 提取封面图片
   */
  extractCoverImage(doc, baseUrl) {
    const selectors = [
      '.video-cover img',
      'video[poster]'
    ];
    
    // 对于video标签，获取poster属性
    const video = doc.querySelector('video[poster]');
    if (video) {
      const poster = video.getAttribute('poster');
      if (poster) {
        return this.resolveUrl(poster, baseUrl);
      }
    }
    
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
      '.video-screenshots img',
      '.preview img'
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
      '.models a',
      '.actress a'
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
    const dateText = this.extractText(doc, '.video-detail .date, .publish-time');
    return this.extractDate(dateText);
  }

  /**
   * 提取标签
   */
  extractTags(doc) {
    const tagElements = doc.querySelectorAll('.tag a, .category a');
    const tags = [];

    tagElements.forEach(el => {
      const tag = el.textContent?.trim() || '';
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    });

    return tags;
  }

  /**
   * 提取流媒体链接
   */
  extractStreamingLinks(doc, baseUrl) {
    const links = [];
    
    // 查找视频播放链接
    const videoElements = doc.querySelectorAll('video source, video');
    videoElements.forEach(el => {
      const src = el.getAttribute('src') || el.getAttribute('data-src');
      if (src) {
        links.push({
          type: 'stream',
          url: this.resolveUrl(src, baseUrl),
          name: '在线播放',
          quality: el.getAttribute('data-quality') || 'unknown'
        });
      }
    });
    
    // 查找下载按钮
    const downloadElements = doc.querySelectorAll('a[href*="download"], .download-btn');
    downloadElements.forEach(el => {
      const href = el.getAttribute('href');
      if (href) {
        links.push({
          type: 'download',
          url: this.resolveUrl(href, baseUrl),
          name: el.textContent?.trim() || '下载链接',
          quality: el.querySelector('.quality, .resolution')?.textContent?.trim() || ''
        });
      }
    });
    
    return links;
  }

  /**
   * 获取Jable特定的请求头
   */
  getRequestHeaders() {
    return {
      ...super.getRequestHeaders(),
      'Referer': 'https://jable.tv/'
    };
  }

  /**
   * 提取域名
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
   * 辅助方法：解析URL
   */
  resolveUrl(href, baseUrl) {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('/')) {
      try {
        const urlObj = new URL(baseUrl);
        return `${urlObj.protocol}//${urlObj.host}${href}`;
      } catch {
        return href;
      }
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

export default JableParser;