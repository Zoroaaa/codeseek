// src/interfaces/ParsedData.js - 统一的数据结构接口

/**
 * 统一的解析数据结构
 * 所有站点解析器都应该返回这个格式的数据
 */
export class ParsedData {
  constructor(data = {}) {
    // 基本信息
    this.title = data.title || '';
    this.originalTitle = data.originalTitle || '';
    this.code = data.code || '';
    
    // 媒体信息
    this.cover = data.cover || '';
    this.screenshots = data.screenshots || [];
    
    // 演员和制作信息
    this.actors = data.actors || [];
    this.actresses = data.actresses || []; // 兼容旧字段
    this.director = data.director || '';
    this.studio = data.studio || '';
    this.label = data.label || '';
    this.series = data.series || '';
    
    // 发布信息
    this.releaseDate = data.releaseDate || '';
    this.duration = data.duration || '';
    
    // 分类和标签
    this.tags = data.tags || [];
    this.genres = data.genres || [];
    
    // 技术信息
    this.quality = data.quality || '';
    this.fileSize = data.fileSize || '';
    this.resolution = data.resolution || '';
    
    // 下载链接
    this.links = data.links || [];
    this.magnetLinks = data.magnetLinks || [];
    this.downloadLinks = data.downloadLinks || [];
    
    // 其他信息
    this.description = data.description || '';
    this.rating = data.rating || 0;
    
    // 元数据
    this.sourceType = data.sourceType || '';
    this.originalUrl = data.originalUrl || '';
    this.detailUrl = data.detailUrl || '';
    this.extractedAt = data.extractedAt || Date.now();
  }

  /**
   * 验证数据完整性
   */
  validate() {
    const errors = [];
    
    if (!this.title && !this.code) {
      errors.push('标题和番号至少需要一个');
    }
    
    if (this.releaseDate && !this.isValidDate(this.releaseDate)) {
      errors.push('发布日期格式无效');
    }
    
    if (this.rating && (this.rating < 0 || this.rating > 10)) {
      errors.push('评分必须在0-10之间');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 检查日期格式是否有效
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      title: this.title,
      originalTitle: this.originalTitle,
      code: this.code,
      cover: this.cover,
      screenshots: this.screenshots,
      actors: this.actors.length > 0 ? this.actors : this.actresses, // 优先使用actors
      director: this.director,
      studio: this.studio,
      label: this.label,
      series: this.series,
      releaseDate: this.releaseDate,
      duration: this.duration,
      tags: this.tags.length > 0 ? this.tags : this.genres, // 优先使用tags
      quality: this.quality,
      fileSize: this.fileSize,
      resolution: this.resolution,
      links: this.mergeAllLinks(),
      description: this.description,
      rating: this.rating,
      sourceType: this.sourceType,
      originalUrl: this.originalUrl,
      detailUrl: this.detailUrl,
      extractedAt: this.extractedAt
    };
  }

  /**
   * 合并所有类型的链接
   */
  mergeAllLinks() {
    const allLinks = [];
    
    // 添加磁力链接
    this.magnetLinks.forEach(link => {
      allLinks.push({
        type: 'magnet',
        url: link.magnet || link.url,
        name: link.name || '磁力链接',
        size: link.size || '',
        seeders: link.seeders || 0,
        leechers: link.leechers || 0
      });
    });
    
    // 添加下载链接
    this.downloadLinks.forEach(link => {
      allLinks.push({
        type: link.type || 'download',
        url: link.url,
        name: link.name || '下载链接',
        size: link.size || '',
        quality: link.quality || ''
      });
    });
    
    // 添加其他链接
    this.links.forEach(link => {
      if (typeof link === 'string') {
        allLinks.push({
          type: 'unknown',
          url: link,
          name: '链接'
        });
      } else {
        allLinks.push({
          type: link.type || 'unknown',
          url: link.url || link,
          name: link.name || '链接',
          size: link.size || '',
          quality: link.quality || ''
        });
      }
    });
    
    return allLinks;
  }

  /**
   * 从旧格式数据创建实例
   */
  static fromLegacyData(legacyData) {
    return new ParsedData({
      title: legacyData.title,
      originalTitle: legacyData.originalTitle,
      code: legacyData.code,
      cover: legacyData.coverImage,
      screenshots: legacyData.screenshots,
      actors: legacyData.actresses || legacyData.actors,
      director: legacyData.director,
      studio: legacyData.studio,
      label: legacyData.label,
      series: legacyData.series,
      releaseDate: legacyData.releaseDate,
      duration: legacyData.duration,
      tags: legacyData.tags,
      quality: legacyData.quality,
      fileSize: legacyData.fileSize,
      resolution: legacyData.resolution,
      magnetLinks: legacyData.magnetLinks,
      downloadLinks: legacyData.downloadLinks,
      description: legacyData.description,
      rating: legacyData.rating,
      sourceType: legacyData.sourceType,
      originalUrl: legacyData.originalUrl,
      detailUrl: legacyData.detailUrl || legacyData.detailPageUrl,
      extractedAt: legacyData.extractedAt
    });
  }
}

/**
 * 搜索结果中的详情链接数据结构
 */
export class DetailLinkData {
  constructor(data = {}) {
    this.url = data.url || '';
    this.title = data.title || '';
    this.code = data.code || '';
    this.score = data.score || 0;
    this.extractedFrom = data.extractedFrom || '';
  }

  /**
   * 验证链接数据
   */
  validate() {
    const errors = [];
    
    if (!this.url) {
      errors.push('链接URL不能为空');
    }
    
    try {
      new URL(this.url);
    } catch {
      errors.push('链接URL格式无效');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default ParsedData;