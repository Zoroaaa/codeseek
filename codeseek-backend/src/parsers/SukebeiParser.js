// src/parsers/SukebeiParser.js - Sukebei站点专用解析器

import { BaseParser } from './BaseParser.js';
import { ParsedData, DetailLinkData } from '../interfaces/ParsedData.js';

export class SukebeiParser extends BaseParser {
  constructor() {
    super('sukebei');
  }

  /**
   * Sukebei站点名称
   */
  getSiteName() {
    return 'Sukebei';
  }

  /**
   * Sukebei站点描述
   */
  getSiteDescription() {
    return 'Sukebei Nyaa - 种子资源下载站';
  }

  /**
   * 支持的功能
   */
  getSupportedFeatures() {
    return ['detail_extraction', 'search_links', 'magnet_links', 'torrent_files', 'seeders_info'];
  }

  /**
   * 验证是否为有效的Sukebei详情页URL
   * @param {string} url - URL
   * @returns {boolean} 是否有效
   */
  isValidDetailUrl(url) {
    if (!url) return false;
    
    // Sukebei详情页格式: /view/3403743 或 https://sukebei.nyaa.si/view/3403743
    const patterns = [
      /\/view\/\d+/,
      /sukebei\.nyaa\.si\/view\/\d+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
  }

  /**
   * 从Sukebei搜索页面提取详情页链接
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 选项
   * @returns {Array<DetailLinkData>} 详情页链接数组
   */
  async extractDetailLinks(htmlContent, options = {}) {
    const { baseUrl, searchKeyword } = options;
    const doc = this.parseHTML(htmlContent);
    const detailLinks = [];

    console.log('开始提取Sukebei详情链接...');

    try {
      // 方法1: 表格行匹配
      const rows = doc.querySelectorAll('tr');
      console.log(`找到 ${rows.length} 个表格行`);

      rows.forEach((row, index) => {
        // 查找第一个td中的链接
        const firstTd = row.querySelector('td:first-child');
        if (!firstTd) return;

        const link = firstTd.querySelector('a[href*="/view/"]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        const fullUrl = this.resolveUrl(href, baseUrl);
        
        // 验证域名一致性
        if (!this.isSameDomain(fullUrl, baseUrl)) return;
        
        // 确保不是搜索URL本身
        if (this.isSameUrl(fullUrl, baseUrl)) return;
        
        // Sukebei详情页格式验证：/view/数字
        if (!this.isValidDetailUrl(fullUrl)) return;
        
        // 提取标题信息（种子名称）
        const title = link.textContent?.trim() || link.getAttribute('title') || '';
        const code = this.extractCode(title);
        
        // 计算匹配分数
        let score = this.calculateMatchScore({ title, code }, searchKeyword);
        
        // 对于种子站，如果标题包含番号，加分
        if (code && title.toLowerCase().includes(code.toLowerCase())) {
          score += 20;
        }
        
        console.log(`找到Sukebei详情链接: ${fullUrl} (分数: ${score})`);
        
        detailLinks.push(new DetailLinkData({
          url: fullUrl,
          title: title || '未知标题',
          code: code || '',
          score,
          extractedFrom: 'sukebei_table_row'
        }));
      });

      // 方法2: 直接匹配 /view/ 链接 - Sukebei的实际格式
      if (detailLinks.length === 0) {
        console.log('表格行方式未找到，尝试直接链接方式');
        
        const directLinks = doc.querySelectorAll('a[href*="/view/"]:not([href*="/?"])');
        directLinks.forEach(link => {
          const href = link.getAttribute('href');
          const fullUrl = this.resolveUrl(href, baseUrl);
          
          if (this.isValidDetailUrl(fullUrl) && 
              !this.isSameUrl(fullUrl, baseUrl) &&
              this.isSameDomain(fullUrl, baseUrl)) {
            
            const title = link.textContent?.trim() || link.getAttribute('title') || '';
            const code = this.extractCode(title);
            const score = this.calculateMatchScore({ title, code }, searchKeyword);
            
            detailLinks.push(new DetailLinkData({
              url: fullUrl,
              title: title || '未知标题',
              code: code || '',
              score,
              extractedFrom: 'sukebei_direct'
            }));
          }
        });
      }

      // 方法3: 宽泛匹配（后备方案）
      if (detailLinks.length === 0) {
        console.log('尝试宽泛匹配...');
        this.extractSukebeiLinksLoose(doc, baseUrl, searchKeyword, detailLinks);
      }

    } catch (error) {
      console.error('Sukebei详情链接提取失败:', error);
    }

    // 去重和排序
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`Sukebei提取完成，找到 ${uniqueLinks.length} 个有效链接`);
    return uniqueLinks;
  }

  /**
   * Sukebei宽泛匹配（后备方案）
   */
  extractSukebeiLinksLoose(doc, baseUrl, searchKeyword, detailLinks) {
    // 查找任何包含番号的种子名称
    const loosePattern = /<a[^>]*href="([^"]*\/view\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = loosePattern.exec(doc.html || '')) !== null) {
      const href = match[1];
      const content = match[2];
      
      const fullUrl = this.resolveUrl(href, baseUrl);
      
      if (this.isSameDomain(fullUrl, baseUrl) &&
          !this.isSameUrl(fullUrl, baseUrl)) {
        
        const title = this.extractTitleFromContent(content);
        const code = this.extractCode(title);
        
        // 对种子文件，检查是否包含番号
        if (code || this.containsVideoTerms(title)) {
          const score = this.calculateMatchScore({ title, code }, searchKeyword);
          
          detailLinks.push(new DetailLinkData({
            url: fullUrl,
            title: title || '未知标题',
            code: code || '',
            score,
            extractedFrom: 'sukebei_loose'
          }));
        }
      }
    }
  }

  /**
   * 解析Sukebei详情页面内容
   * @param {string} htmlContent - 详情页面HTML内容
   * @param {Object} options - 选项
   * @returns {ParsedData} 解析后的数据
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { originalUrl, originalTitle } = options;
    const doc = this.parseHTML(htmlContent);

    console.log('开始解析Sukebei详情页面...');

    try {
      const data = {
        // 基本信息
        title: this.extractTitle(doc),
        code: this.extractCode(doc, originalUrl),
        
        // 发布信息
        releaseDate: this.extractReleaseDate(doc),
        fileSize: this.extractFileSize(doc),
        
        // 下载信息
        magnetLinks: this.extractMagnetLinks(doc, 'a[href^="magnet:"], .magnet'),
        downloadLinks: this.extractTorrentLinks(doc, originalUrl),
        
        // 种子特有信息
        seeders: this.extractSeeders(doc),
        leechers: this.extractLeechers(doc),
        completedDownloads: this.extractCompletedDownloads(doc),
        
        // 技术信息
        category: this.extractCategory(doc),
        
        // 其他信息
        description: this.extractDescription(doc),
        
        // 元数据
        originalUrl,
        detailUrl: originalUrl
      };

      console.log('Sukebei详情页面解析完成');
      return this.cleanAndValidateData(data);

    } catch (error) {
      console.error('Sukebei详情页面解析失败:', error);
      throw new Error(`Sukebei页面解析失败: ${error.message}`);
    }
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    const selectors = [
      '.torrent-title', 
      'h3', 
      '.title',
      '.panel-title',
      'h1'
    ];
    
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
      '.torrent-title', 
      '.title',
      'h3',
      'h1'
    ];
    
    for (const selector of selectors) {
      const text = this.extractText(doc, selector);
      const code = super.extractCode(text);
      if (code) return code;
    }
    
    // 从URL中提取（通常Sukebei的URL不包含番号）
    return super.extractCode(url);
  }

  /**
   * 提取发布日期
   */
  extractReleaseDate(doc) {
    const selectors = [
      '.date', 
      '.upload-time',
      '.torrent-date',
      'time',
      '.timestamp'
    ];
    
    for (const selector of selectors) {
      const dateText = this.extractText(doc, selector);
      const date = this.extractDate(dateText);
      if (date) return date;
    }
    
    return '';
  }

  /**
   * 提取文件大小
   */
  extractFileSize(doc) {
    const selectors = [
      '.size', 
      '.file-size',
      '.torrent-size',
      '.filesize'
    ];
    
    for (const selector of selectors) {
      const size = this.extractText(doc, selector);
      if (size && (size.includes('GB') || size.includes('MB'))) {
        return size.trim();
      }
    }
    
    return '';
  }

  /**
   * 提取种子数
   */
  extractSeeders(doc) {
    const selectors = [
      '.seeders', 
      '.seeds',
      '.torrent-seeders'
    ];
    
    for (const selector of selectors) {
      const seedersText = this.extractText(doc, selector);
      const seeders = parseInt(seedersText);
      if (!isNaN(seeders)) return seeders;
    }
    
    return 0;
  }

  /**
   * 提取下载数
   */
  extractLeechers(doc) {
    const selectors = [
      '.leechers', 
      '.peers',
      '.torrent-leechers'
    ];
    
    for (const selector of selectors) {
      const leechersText = this.extractText(doc, selector);
      const leechers = parseInt(leechersText);
      if (!isNaN(leechers)) return leechers;
    }
    
    return 0;
  }

  /**
   * 提取完成下载数
   */
  extractCompletedDownloads(doc) {
    const selectors = [
      '.completed', 
      '.downloads',
      '.torrent-completed'
    ];
    
    for (const selector of selectors) {
      const completedText = this.extractText(doc, selector);
      const completed = parseInt(completedText);
      if (!isNaN(completed)) return completed;
    }
    
    return 0;
  }

  /**
   * 提取分类
   */
  extractCategory(doc) {
    const selectors = [
      '.category', 
      '.torrent-category',
      '.cat'
    ];
    
    for (const selector of selectors) {
      const category = this.extractText(doc, selector);
      if (category) return category.trim();
    }
    
    return '';
  }

  /**
   * 提取种子文件链接
   */
  extractTorrentLinks(doc, baseUrl) {
    const links = [];
    
    const torrentElements = doc.querySelectorAll('a[href$=".torrent"], .torrent-download');
    torrentElements.forEach(el => {
      const href = el.getAttribute('href');
      if (href) {
        links.push({
          type: 'torrent',
          url: this.resolveUrl(href, baseUrl),
          name: el.textContent?.trim() || '种子文件',
          size: this.extractText(el.parentElement, '.size') || ''
        });
      }
    });
    
    return links;
  }

  /**
   * 提取描述
   */
  extractDescription(doc) {
    const selectors = [
      '.description',
      '.torrent-description', 
      '.content',
      '.details'
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
   * 检查是否包含视频相关术语
   */
  containsVideoTerms(text) {
    if (!text) return false;
    
    const videoTerms = [
      '1080p', '720p', '480p', 'HD', 'FHD',
      'mp4', 'mkv', 'avi', 'wmv',
      'uncensored', 'censored', 'JAV'
    ];
    
    const textLower = text.toLowerCase();
    return videoTerms.some(term => textLower.includes(term.toLowerCase()));
  }

  /**
   * 从内容中提取标题
   */
  extractTitleFromContent(content) {
    // 清理HTML标签
    const cleanText = content.replace(/<[^>]*>/g, '').trim();
    
    if (cleanText.length > 5 && cleanText.length < 300) {
      return cleanText;
    }
    
    return '';
  }

  /**
   * 获取Sukebei特定的请求头
   */
  getRequestHeaders() {
    return {
      ...super.getRequestHeaders(),
      'Referer': 'https://sukebei.nyaa.si/'
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

export default SukebeiParser;