// src/parsers/JavGuruParser.js - JavGuru站点专用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

export class JavGuruParser extends BaseParser {
  constructor() {
    super('javguru');
  }

  /**
   * JavGuru站点名称
   */
  getSiteName() {
    return 'JavGuru';
  }

  /**
   * JavGuru站点描述
   */
  getSiteDescription() {
    return 'Jav.Guru - 日本AV资源平台';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'basic_info', 'description'];
  }

  /**
   * 验证是否为有效的JavGuru详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    // JavGuru详情页格式: /268681/ipx-156-sana-matsunaga-has-been-celibate-for-30-days... 或 https://jav.guru/268681/ipx-156...
    const patterns = [
      /\/\d+\/[a-z0-9\-]+/i,
      /jav\.guru\/\d+\/[a-z0-9\-]+/i
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 从JavGuru搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始提取JavGuru详情链接...');

    try {
      const videoSelectors = [
        '.video-item a',
        '.movie-item a',
        '.item a',
        'a[href]:not([href*="?s="]):not([href*="/search"])'
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
          if (this.containsSearchIndicators(fullUrl)) return;
          
          // JavGuru详情页面特征：/数字/描述
          if (!this.isValidDetailUrl(fullUrl)) return;
          
          // 提取标题信息
          const titleElement = link.querySelector('.title, h3, .video-title') || link;
          const title = titleElement.textContent?.trim() || link.getAttribute('title') || '';
          const code = this.extractCode(title) || this.extractCode(fullUrl);
          const score = this.calculateMatchScore({ title, code }, searchKeyword);
          
          console.log(`找到JavGuru详情链接: ${fullUrl} (分数: ${score})`);
          
          detailLinks.push(new DetailLinkData({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'javguru_video'
          }));
        });
        
        if (detailLinks.length > 0) break;
      }

      // 如果没找到，尝试更宽泛的匹配
      if (detailLinks.length === 0) {
        console.log('尝试宽泛匹配...');
        this.extractJavGuruLinksLoose(doc, baseUrl, searchKeyword, detailLinks);
      }

    } catch (error) {
      console.error('JavGuru详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`JavGuru提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks;
  }

  /**
   * JavGuru宽泛匹配（后备方案）
   */
  extractJavGuruLinksLoose(doc, baseUrl, searchKeyword, detailLinks) {
    // 查找任何符合JavGuru格式的链接
    const loosePattern = /<a[^>]*href="([^"]*\/\d+\/[a-z0-9\-]+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = loosePattern.exec(doc.html || '')) !== null) {
      const href = match[1];
      const content = match[2];
      
      const fullUrl = this.resolveUrl(href, baseUrl);
      
      if (this.isSameDomain(fullUrl, baseUrl) &&
          !this.containsSearchIndicators(fullUrl) && 
          !this.isSameUrl(fullUrl, baseUrl)) {
        
        const title = this.extractTitleFromContent(content);
        const code = this.extractCode(title) || this.extractCode(fullUrl);
        const score = this.calculateMatchScore({ title, code }, searchKeyword);
        
        detailLinks.push(new DetailLinkData({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'javguru_loose'
        }));
      }
    }
  }

  /**
   * 解析JavGuru详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始解析JavGuru详情页面...');

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
        director: this.extractText(doc, '.director a, .info .director'),
        studio: this.extractText(doc, '.studio a, .info .studio'),
        label: this.extractText(doc, '.label a, .info .label'),
        series: this.extractText(doc, '.series a, .info .series'),
        
        // 发布信息
        releaseDate: this.extractReleaseDate(doc),
        duration: this.extractDuration(this.extractText(doc, '.duration, .info .duration')),
        
        // 技术信息
        quality: this.extractText(doc, '.quality, .video-quality'),
        fileSize: this.extractText(doc, '.file-size, .size'),
        resolution: this.extractText(doc, '.resolution, .video-resolution'),
        
        // 分类标签
        tags: this.extractTags(doc),
        
        // 下载信息
        downloadLinks: this.extractDownloadLinks(doc, 'a[href*="download"], .download-link', originalUrl),
        magnetLinks: this.extractMagnetLinks(doc, 'a[href^="magnet:"]'),
        
        // 其他信息
        description: this.extractDescription(doc),
        rating: this.extractRating(this.extractText(doc, '.rating, .score')),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('JavGuru详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('JavGuru详情页面解析失败:', error);
      throw new Error(`JavGuru页面解析失败: ${error.message}`);
    }
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    const selectors = ['h1', '.video-title', '.title', '.post-title', '.entry-title'];
    
    for (const selector of selectors) {
      const title = this.extractText(doc, selector);
      if (title && title.length > 5 && title.length < 300) {
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
      'h1', '.video-title', '.title', '.code', '.video-meta'
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
      '.poster img',
      '.cover img',
      '.thumbnail img',
      'img[class*="cover"]',
      '.featured-image img'
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
      '.screenshots img',
      '.preview img', 
      '.gallery img',
      '.sample img',
      'img[class*="screenshot"]',
      '.video-images img'
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
      '.actress a',
      '.performer a',
      '.actors a',
      '.cast a',
      '.stars a',
      '.models a'
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
    const selectors = [
      '.release-date',
      '.date',
      '.publish-date',
      '.info .date',
      '.meta .date',
      'time'
    ];
    
    for (const selector of selectors) {
      const dateText = this.extractText(doc, selector);
      const date = this.extractDate(dateText);
      if (date) return date;
    }
    
    return '';
  }

  /**
   * 提取标签
   */
  extractTags(doc) {
    const selectors = [
      '.tag a',
      '.genre a', 
      '.category a',
      '.tags a',
      '.categories a',
      '.labels a'
    ];
    
    const excludeTexts = ['演员', '导演', '制作商', '发行商', '系列', '发行日期', '时长'];
    
    for (const selector of selectors) {
      const tags = this.extractMultipleTexts(doc, selector);
      const filteredTags = tags.filter(tag => !excludeTexts.includes(tag));
      if (filteredTags.length > 0) return filteredTags;
    }
    
    return [];
  }

  /**
   * 提取描述
   */
  extractDescription(doc) {
    const selectors = [
      '.description',
      '.summary', 
      '.content',
      '.intro',
      '.synopsis',
      '.post-content',
      '.entry-content'
    ];
    
    for (const selector of selectors) {
      const desc = this.extractText(doc, selector);
      if (desc && desc.length > 10) {
        return desc;
      }
    }
    
    return '';
  }

  /**
   * 检查是否包含搜索指示器
   */
  containsSearchIndicators(url) {
    const indicators = [
      '?s=', '/search/', '/search?', '?q=', '?search=',
      '/page/', '/list/', '/category/', '/tag/'
    ];
    
    const urlLower = url.toLowerCase();
    return indicators.some(indicator => urlLower.includes(indicator));
  }

  /**
   * 从内容中提取标题
   */
  extractTitleFromContent(content) {
    const titlePatterns = [
      /title="([^"]+)"/i,
      /alt="([^"]+)"/i,
      /<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/i,
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let title = match[1].replace(/<[^>]*>/g, '').trim();
        if (title.length > 5 && title.length < 300) {
          return title;
        }
      }
    }
    
    // 如果没有找到标题，尝试提取纯文本
    const cleanText = content.replace(/<[^>]*>/g, '').trim();
    if (cleanText.length > 5 && cleanText.length < 300) {
      return cleanText;
    }
    
    return '';
  }

  /**
   * 获取JavGuru特定的请求头
   */
  getRequestHeaders() {
    return {
      ...super.getRequestHeaders(),
      'Referer': 'https://jav.guru/'
    };
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

export default JavGuruParser;