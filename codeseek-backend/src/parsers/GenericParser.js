// src/parsers/GenericParser.js - 通用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

/**
 * 通用解析器
 * 作为后备方案，当没有专门的站点解析器时使用
 */
export class GenericParser extends BaseParser {
  constructor() {
    super('generic');
  }

  /**
   * 通用解析器名称
   */
  getSiteName() {
    return '通用解析器';
  }

  /**
   * 通用解析器描述
   */
  getSiteDescription() {
    return '通用解析器 - 适用于未明确支持的站点';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'basic_parsing'];
  }

  /**
   * 验证是否为有效的详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // 排除明显的非详情页面链接
    const excludePatterns = [
      '/search', '/category', '/tag', '/list', '/page', '?page',
      '/login', '/register', '/user', '/profile', '/settings',
      '/forum', '/doc', '/terms', '/privacy', '/#'
    ];
    
    if (excludePatterns.some(pattern => urlLower.includes(pattern))) {
      return false;
    }
    
    // 检查是否包含番号或详情页面特征
    const detailPatterns = [
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,  // 直接番号路径
      /\/v\/[a-zA-Z0-9]+/,               // JavDB格式
      /\/videos\/[^\/]+/,                // Jable格式
      /\/jav\/[^\/]+/,                   // JavGG格式
      /\/view\/\d+/,                     // Sukebei格式
      /\/\d+\/[a-z0-9\-]+/i,            // JavGuru格式
      /\/(watch|play|video|movie)\//     // 通用视频页面
    ];
    
    return detailPatterns.some(pattern => pattern.test(url)) || 
           /[A-Z]{2,6}-?\d{3,6}/i.test(url); // URL中包含番号
  }

  /**
   * 从搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始通用详情链接提取...');

    try {
      // 多种选择器策略
      const selectorStrategies = [
        // 优先查找包含番号的链接
        'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])',
        // 查找带标题的链接
        'a[href*="/"][title]:not([href*="/search"])',
        // 查找容器内的链接
        '.item a, .movie a, .video a, .result a, .card a',
        // 查找列表项中的链接
        'li a, tr a, .list-item a'
      ];

      for (const selector of selectorStrategies) {
        console.log(`尝试选择器: ${selector}`);
        const links = doc.querySelectorAll(selector);
        console.log(`找到 ${links.length} 个候选链接`);
        
        let processedCount = 0;
        const maxProcessed = 50; // 限制处理数量以提高性能
        
        for (const link of links) {
          if (processedCount >= maxProcessed) {
            console.log(`已达到处理限制 (${maxProcessed})，停止处理`);
            break;
          }
          
          const href = link.getAttribute('href');
          if (!href) continue;

          const fullUrl = this.resolveUrl(href, baseUrl);
          
          // 域名验证
          if (!this.isSameDomain(fullUrl, baseUrl)) {
            continue;
          }
          
          // 确保不是搜索URL本身
          if (this.isSameUrl(fullUrl, baseUrl)) {
            continue;
          }
          
          // 验证是否为详情页链接
          if (!this.isValidDetailUrl(fullUrl)) {
            continue;
          }

          const title = link.getAttribute('title') || link.textContent?.trim() || '';
          const code = this.extractCode(title) || this.extractCode(fullUrl);
          
          // 如果有搜索关键词，进行相关性过滤
          let score = 50; // 默认分数
          if (searchKeyword) {
            score = this.calculateMatchScore({ title, code }, searchKeyword);
            if (score < 20) {
              continue; // 分数太低，跳过
            }
          }

          detailLinks.push(new DetailLinkData({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'generic'
          }));
          
          processedCount++;
        }

        // 如果找到足够的链接就停止
        if (detailLinks.length >= 10) {
          console.log(`已找到足够的链接 (${detailLinks.length})，停止搜索`);
          break;
        }
      }

    } catch (error) {
      console.error('通用详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`通用提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks.slice(0, 20); // 限制返回数量
  }

  /**
   * 解析详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始通用详情页面解析...');

    try {
      const data = {
        // 基本信息
        title: this.extractGenericTitle(doc) || originalTitle || '未知标题',
        code: this.extractGenericCode(doc, originalUrl),
        
        // 媒体信息
        cover: this.extractGenericCover(doc, originalUrl),
        screenshots: this.extractGenericScreenshots(doc, originalUrl),
        
        // 演员信息
        actors: this.extractGenericActors(doc),
        
        // 发布信息
        releaseDate: this.extractGenericDate(doc),
        duration: this.extractGenericDuration(doc),
        
        // 分类标签
        tags: this.extractGenericTags(doc),
        
        // 下载信息
        magnetLinks: this.extractMagnetLinks(doc, 'a[href^="magnet:"]'),
        downloadLinks: this.extractGenericDownloadLinks(doc, originalUrl),
        
        // 其他信息
        description: this.extractGenericDescription(doc),
        rating: this.extractGenericRating(doc),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('通用详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('通用详情页面解析失败:', error);
      
      // 返回基本数据，避免完全失败
      return this.cleanAndValidateData({
        title: originalTitle || '未知标题',
        originalUrl,
        detailUrl: originalUrl,
        extractionError: error.message
      });
    }
  }

  /**
   * 提取通用标题
   */
  extractGenericTitle(doc) {
    const selectors = [
      'h1', 'h2', 'h3', '.title', '.video-title', '.movie-title',
      '.post-title', '.entry-title', 'title'
    ];
    
    for (const selector of selectors) {
      const title = this.extractText(doc, selector);
      if (title && title.length > 5 && title.length < 200) {
        return title.replace(/\s+/g, ' ').trim();
      }
    }
    
    return '';
  }

  /**
   * 提取通用番号
   */
  extractGenericCode(doc, url) {
    // 先从页面内容中查找
    const selectors = [
      '.code', '.video-code', '.movie-code', '.id', 
      'h1', 'h2', 'h3', '.title'
    ];
    
    for (const selector of selectors) {
      const text = this.extractText(doc, selector);
      const code = this.extractCode(text);
      if (code) return code;
    }
    
    // 从URL中提取
    return this.extractCode(url);
  }

  /**
   * 提取通用封面
   */
  extractGenericCover(doc, baseUrl) {
    const selectors = [
      'img[class*="cover"]', 'img[class*="poster"]', 'img[class*="thumb"]',
      '.cover img', '.poster img', '.thumbnail img', '.featured-image img',
      'img[src*="cover"]', 'img[src*="poster"]', 'img[src*="thumb"]'
    ];
    
    for (const selector of selectors) {
      const url = this.extractImageUrl(doc, selector, baseUrl);
      if (url) return url;
    }
    
    return '';
  }

  /**
   * 提取通用截图
   */
  extractGenericScreenshots(doc, baseUrl) {
    const selectors = [
      'img[class*="screenshot"]', 'img[class*="preview"]', 'img[class*="sample"]',
      '.screenshots img', '.previews img', '.samples img', '.gallery img'
    ];
    
    for (const selector of selectors) {
      const screenshots = this.extractMultipleImageUrls(doc, selector, baseUrl, 10);
      if (screenshots.length > 0) return screenshots;
    }
    
    return [];
  }

  /**
   * 提取通用演员
   */
  extractGenericActors(doc) {
    const selectors = [
      'a[class*="actress"]', 'a[class*="actor"]', 'a[class*="performer"]',
      'a[class*="star"]', '.actress a', '.actors a', '.performers a',
      '.cast a', '.stars a'
    ];
    
    for (const selector of selectors) {
      const actors = this.extractActors(doc, selector);
      if (actors.length > 0) return actors;
    }
    
    return [];
  }

  /**
   * 提取通用日期
   */
  extractGenericDate(doc) {
    const selectors = [
      '.date', '.release-date', '.publish-date', '.created-date',
      '[class*="date"]', 'time', '.time'
    ];
    
    for (const selector of selectors) {
      const dateText = this.extractText(doc, selector);
      const date = this.extractDate(dateText);
      if (date) return date;
    }
    
    return '';
  }

  /**
   * 提取通用时长
   */
  extractGenericDuration(doc) {
    const selectors = [
      '.duration', '.length', '.runtime', '[class*="duration"]',
      '[class*="length"]', '[class*="time"]'
    ];
    
    for (const selector of selectors) {
      const durationText = this.extractText(doc, selector);
      const duration = this.extractDuration(durationText);
      if (duration) return duration;
    }
    
    return '';
  }

  /**
   * 提取通用标签
   */
  extractGenericTags(doc) {
    const selectors = [
      '.tag a', '.tags a', '.genre a', '.genres a', '.category a',
      '.categories a', '.label a', '.labels a'
    ];
    
    for (const selector of selectors) {
      const tags = this.extractMultipleTexts(doc, selector);
      if (tags.length > 0) return tags;
    }
    
    return [];
  }

  /**
   * 提取通用描述
   */
  extractGenericDescription(doc) {
    const selectors = [
      '.description', '.summary', '.synopsis', '.content', '.intro',
      '.overview', '.plot', '.details', '[class*="desc"]'
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
   * 提取通用评分
   */
  extractGenericRating(doc) {
    const selectors = [
      '.rating', '.score', '.rate', '.stars', '[class*="rating"]',
      '[class*="score"]'
    ];
    
    for (const selector of selectors) {
      const ratingText = this.extractText(doc, selector);
      const rating = this.extractRating(ratingText);
      if (rating > 0) return rating;
    }
    
    return 0;
  }

  /**
   * 提取通用下载链接
   */
  extractGenericDownloadLinks(doc, baseUrl) {
    const selectors = [
      'a[href*="download"]', '.download a', '.downloads a',
      'a[class*="download"]', 'a[href$=".torrent"]'
    ];
    
    for (const selector of selectors) {
      const links = this.extractDownloadLinks(doc, selector, baseUrl, 5);
      if (links.length > 0) return links;
    }
    
    return [];
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

export default GenericParser;