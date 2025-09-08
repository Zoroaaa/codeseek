// src/config/parser-rules.js - 网站解析规则配置
export class ParserRulesConfig {
  constructor() {
    this.rules = {
      // JavBus 解析规则
      javbus: {
        title: {
          selector: 'h3, .title, title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '.header .title span, h3 span, .info span:first-child',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: '.screencap img, .bigImage img, .poster img',
          attribute: 'src',
          fallback: 'data-src'
        },
        screenshots: {
          selector: '.sample-box img, .screenshot img, .preview img',
          attribute: 'src',
          fallback: 'data-src'
        },
        actresses: {
          selector: '.star-name a, .actress a, .info .genre:contains("演員") a',
          extractProfile: true
        },
        director: {
          selector: '.info .genre:contains("導演") a, .director a',
          transform: [{ type: 'trim' }]
        },
        studio: {
          selector: '.info .genre:contains("製作商") a, .studio a',
          transform: [{ type: 'trim' }]
        },
        label: {
          selector: '.info .genre:contains("發行商") a, .label a',
          transform: [{ type: 'trim' }]
        },
        series: {
          selector: '.info .genre:contains("系列") a, .series a',
          transform: [{ type: 'trim' }]
        },
        releaseDate: {
          selector: '.info .genre:contains("發行日期"), .release-date',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        duration: {
          selector: '.info .genre:contains("長度"), .duration',
          transform: [
            { type: 'extract', pattern: '(\\d+)\\s*分', group: 1 }
          ]
        },
        description: {
          selector: '.description, .summary, .intro',
          transform: [{ type: 'trim' }]
        },
        tags: {
          selector: '.genre a, .tag a, .category a',
          excludeTexts: ['演員', '導演', '製作商', '發行商', '系列', '發行日期', '長度']
        },
        magnetLinks: {
          selector: 'a[href^="magnet:"], .magnet-link',
          extractSize: '.size, .filesize',
          extractSeeders: '.seeders, .seeds'
        },
        downloadLinks: {
          selector: 'a[href*="download"], .download-link',
          extractSize: '.size',
          extractQuality: '.quality'
        },
        rating: {
          selector: '.rating, .score, .rate',
          transform: [
            { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
          ]
        }
      },

      // JavDB 解析规则
      javdb: {
        title: {
          selector: 'h2.title, .video-title, title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '.first-block .value, .video-meta strong',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: '.video-cover img, .cover img',
          attribute: 'src',
          fallback: 'data-src'
        },
        screenshots: {
          selector: '.tile-images img, .preview-images img',
          attribute: 'src',
          fallback: 'data-src'
        },
        actresses: {
          selector: '.panel-block:contains("演員") .value a, .actress-tag a',
          extractProfile: true
        },
        director: {
          selector: '.panel-block:contains("導演") .value, .director',
          transform: [{ type: 'trim' }]
        },
        studio: {
          selector: '.panel-block:contains("片商") .value, .studio',
          transform: [{ type: 'trim' }]
        },
        label: {
          selector: '.panel-block:contains("廠牌") .value, .label',
          transform: [{ type: 'trim' }]
        },
        series: {
          selector: '.panel-block:contains("系列") .value, .series',
          transform: [{ type: 'trim' }]
        },
        releaseDate: {
          selector: '.panel-block:contains("時間") .value, .release-date',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        duration: {
          selector: '.panel-block:contains("時長") .value, .duration',
          transform: [
            { type: 'extract', pattern: '(\\d+)', group: 1 }
          ]
        },
        description: {
          selector: '.description, .content',
          transform: [{ type: 'trim' }]
        },
        tags: {
          selector: '.panel-block:contains("類別") .tag a, .genre-tag a',
          excludeTexts: ['演員', '導演', '片商', '廠牌', '系列', '時間', '時長']
        },
        magnetLinks: {
          selector: 'a[href^="magnet:"], .magnet-link',
          extractSize: '.size',
          extractSeeders: '.seeds'
        },
        rating: {
          selector: '.score, .rating',
          transform: [
            { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
          ]
        }
      },

      // JavLibrary 解析规则
      javlibrary: {
        title: {
          selector: '#video_title .post-title, h3',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '#video_id .text, .id',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: '#video_jacket_img, .cover img',
          attribute: 'src'
        },
        actresses: {
          selector: '#video_cast .star a, .cast a',
          extractProfile: true
        },
        director: {
          selector: '#video_director a, .director a',
          transform: [{ type: 'trim' }]
        },
        studio: {
          selector: '#video_maker a, .maker a',
          transform: [{ type: 'trim' }]
        },
        label: {
          selector: '#video_label a, .label a',
          transform: [{ type: 'trim' }]
        },
        releaseDate: {
          selector: '#video_date .text, .date',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        duration: {
          selector: '#video_length .text, .length',
          transform: [
            { type: 'extract', pattern: '(\\d+)', group: 1 }
          ]
        },
        tags: {
          selector: '#video_genres a, .genre a',
          excludeTexts: []
        },
        rating: {
          selector: '.score, #video_review .score',
          transform: [
            { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
          ]
        }
      },

      // Jable 解析规则
      jable: {
        title: {
          selector: '.title-video, h1, .video-title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '.models a, .video-detail strong',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: '.video-cover img, video[poster]',
          attribute: 'src',
          fallback: 'poster'
        },
        screenshots: {
          selector: '.video-screenshots img, .preview img',
          attribute: 'src',
          fallback: 'data-src'
        },
        actresses: {
          selector: '.models a, .actress a',
          extractProfile: true
        },
        releaseDate: {
          selector: '.video-detail .date, .publish-time',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        duration: {
          selector: '.video-detail .duration, .length',
          transform: [
            { type: 'extract', pattern: '(\\d+)', group: 1 }
          ]
        },
        tags: {
          selector: '.tag a, .category a',
          excludeTexts: []
        },
        downloadLinks: {
          selector: 'a[href*="download"], .download-btn',
          extractQuality: '.quality, .resolution'
        }
      },

      // MissAV 解析规则
      missav: {
        title: {
          selector: '.space-y-2 h1, .video-title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '.text-secondary, .video-code',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: '.video-cover img, video[poster]',
          attribute: 'src',
          fallback: 'poster'
        },
        actresses: {
          selector: '.actress a, .performer a',
          extractProfile: true
        },
        releaseDate: {
          selector: '.text-secondary:contains("發行時間"), .release-date',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        duration: {
          selector: '.text-secondary:contains("影片時長"), .duration',
          transform: [
            { type: 'extract', pattern: '(\\d+)', group: 1 }
          ]
        },
        tags: {
          selector: '.tag a, .genre a',
          excludeTexts: []
        }
      },

      // Sukebei (磁力站) 解析规则
      sukebei: {
        title: {
          selector: '.torrent-title, h3, .title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: '.torrent-title, .title',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        magnetLinks: {
          selector: 'a[href^="magnet:"], .magnet',
          extractSize: '.size, .torrent-size',
          extractSeeders: '.seeders, .seeds',
          extractLeechers: '.leechers, .peers'
        },
        downloadLinks: {
          selector: 'a[href$=".torrent"], .torrent-download',
          extractSize: '.size'
        },
        releaseDate: {
          selector: '.date, .upload-time',
          transform: [
            { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 }
          ]
        },
        fileSize: {
          selector: '.size, .file-size',
          transform: [{ type: 'trim' }]
        }
      },

      // 通用解析规则（作为后备）
      generic: {
        title: {
          selector: 'h1, h2, h3, .title, title',
          transform: [
            { type: 'replace', pattern: '\\s+', replacement: ' ' },
            { type: 'trim' }
          ]
        },
        code: {
          selector: 'h1, h2, h3, .title, .code',
          transform: [
            { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
            { type: 'uppercase' }
          ]
        },
        coverImage: {
          selector: 'img[class*="cover"], img[class*="poster"], img[class*="thumb"]',
          attribute: 'src',
          fallback: 'data-src'
        },
        screenshots: {
          selector: 'img[class*="screenshot"], img[class*="preview"], img[class*="sample"]',
          attribute: 'src',
          fallback: 'data-src'
        },
        actresses: {
          selector: 'a[class*="actress"], a[class*="performer"], a[class*="star"]',
          extractProfile: true
        },
        description: {
          selector: '.description, .summary, .content, .intro',
          transform: [{ type: 'trim' }]
        },
        tags: {
          selector: '.tag a, .genre a, .category a',
          excludeTexts: []
        },
        magnetLinks: {
          selector: 'a[href^="magnet:"]',
          extractSize: '.size',
          extractSeeders: '.seeds, .seeders'
        },
        downloadLinks: {
          selector: 'a[href*="download"], .download',
          extractSize: '.size'
        },
        rating: {
          selector: '.rating, .score, .rate',
          transform: [
            { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
          ]
        }
      }
    };
  }

  /**
   * 根据源类型获取解析规则
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 解析规则对象
   */
  getParserRules(sourceType) {
    if (!sourceType || typeof sourceType !== 'string') {
      return this.rules.generic;
    }

    const normalizedType = sourceType.toLowerCase();
    return this.rules[normalizedType] || this.rules.generic;
  }

  /**
   * 添加自定义解析规则
   * @param {string} sourceType - 源类型
   * @param {Object} rules - 解析规则
   * @returns {boolean} 是否添加成功
   */
  addCustomRules(sourceType, rules) {
    if (!sourceType || !rules || typeof rules !== 'object') {
      return false;
    }

    try {
      this.rules[sourceType.toLowerCase()] = {
        ...this.rules.generic,
        ...rules
      };
      
      console.log(`已添加 ${sourceType} 的自定义解析规则`);
      return true;
    } catch (error) {
      console.error('添加自定义解析规则失败:', error);
      return false;
    }
  }

  /**
   * 更新现有解析规则
   * @param {string} sourceType - 源类型
   * @param {Object} updates - 规则更新
   * @returns {boolean} 是否更新成功
   */
  updateRules(sourceType, updates) {
    if (!sourceType || !updates || typeof updates !== 'object') {
      return false;
    }

    const normalizedType = sourceType.toLowerCase();
    
    if (!this.rules[normalizedType]) {
      console.warn(`源类型 ${sourceType} 不存在，无法更新规则`);
      return false;
    }

    try {
      this.rules[normalizedType] = {
        ...this.rules[normalizedType],
        ...updates
      };
      
      console.log(`已更新 ${sourceType} 的解析规则`);
      return true;
    } catch (error) {
      console.error('更新解析规则失败:', error);
      return false;
    }
  }

  /**
   * 删除解析规则
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否删除成功
   */
  deleteRules(sourceType) {
    if (!sourceType) return false;

    const normalizedType = sourceType.toLowerCase();
    
    if (normalizedType === 'generic') {
      console.warn('不能删除通用解析规则');
      return false;
    }

    if (this.rules[normalizedType]) {
      delete this.rules[normalizedType];
      console.log(`已删除 ${sourceType} 的解析规则`);
      return true;
    }

    return false;
  }

  /**
   * 获取所有支持的源类型
   * @returns {Array} 源类型数组
   */
  getSupportedSourceTypes() {
    return Object.keys(this.rules);
  }

  /**
   * 验证解析规则的完整性
   * @param {Object} rules - 解析规则
   * @returns {Object} 验证结果
   */
  validateRules(rules) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    if (!rules || typeof rules !== 'object') {
      result.valid = false;
      result.errors.push('规则必须是对象类型');
      return result;
    }

    // 检查必需的规则字段
    const requiredFields = ['title', 'coverImage'];
    const recommendedFields = ['code', 'actresses', 'description', 'tags'];

    requiredFields.forEach(field => {
      if (!rules[field]) {
        result.valid = false;
        result.errors.push(`缺少必需字段: ${field}`);
      }
    });

    recommendedFields.forEach(field => {
      if (!rules[field]) {
        result.warnings.push(`建议添加字段: ${field}`);
      }
    });

    // 验证选择器格式
    Object.keys(rules).forEach(field => {
      const rule = rules[field];
      if (rule && rule.selector) {
        try {
          // 简单的CSS选择器验证
          if (typeof rule.selector !== 'string' || rule.selector.trim() === '') {
            result.warnings.push(`字段 ${field} 的选择器无效`);
          }
        } catch (error) {
          result.warnings.push(`字段 ${field} 的选择器格式错误: ${error.message}`);
        }
      }
    });

    return result;
  }

  /**
   * 从URL推断可能的源类型
   * @param {string} url - URL
   * @returns {string} 推断的源类型
   */
  inferSourceTypeFromUrl(url) {
    if (!url || typeof url !== 'string') {
      return 'generic';
    }

    const urlLower = url.toLowerCase();
    
    // URL模式匹配
    const patterns = {
      'javbus': /javbus\.com/,
      'javdb': /javdb\.com/,
      'javlibrary': /javlibrary\.com/,
      'jable': /jable\.tv/,
      'javmost': /javmost\.com/,
      'missav': /missav\.com/,
      'javhdporn': /javhd\.porn/,
      'javgg': /javgg\.net/,
      'av01': /av01\.tv/,
      'sukebei': /sukebei\.nyaa\.si/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }

    return 'generic';
  }

  /**
   * 导出解析规则配置
   * @returns {Object} 配置数据
   */
  exportRules() {
    return {
      version: '1.0',
      exportTime: Date.now(),
      rules: { ...this.rules }
    };
  }

  /**
   * 导入解析规则配置
   * @param {Object} configData - 配置数据
   * @returns {boolean} 是否导入成功
   */
  importRules(configData) {
    if (!configData || !configData.rules) {
      console.error('无效的配置数据');
      return false;
    }

    try {
      // 备份当前规则
      const backup = { ...this.rules };
      
      // 合并导入的规则
      this.rules = {
        ...this.rules,
        ...configData.rules
      };

      console.log('解析规则导入成功');
      return true;

    } catch (error) {
      console.error('导入解析规则失败:', error);
      // 恢复备份
      if (backup) {
        this.rules = backup;
      }
      return false;
    }
  }
}

// 创建单例实例
export const parserRules = new ParserRulesConfig();
export default parserRules;