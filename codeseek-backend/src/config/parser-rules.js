// src/config/parser-rules.js - 更新版本：支持从搜索页面提取详情链接
export class ParserRulesConfig {
  constructor() {
    this.rules = {
      // JavBus 解析规则
      javbus: {
        // 搜索页面详情链接提取规则
        searchPage: {
          detailLinkSelectors: [
            {
              selector: '.movie-box a[href*="/"], .item a[href*="/"]',
              titleSelector: '.movie-box .title, .item .title, .movie-box h3, .item h3',
              codeSelector: '.movie-box .video-number, .item .video-number, .movie-box span',
              mustContainCode: true,
              excludeHrefs: ['/search', '/category', '/star', '/studio', '/label']
            },
            {
              selector: 'a[href*="/"][title]',
              titleAttribute: 'title',
              mustContainCode: true,
              excludeHrefs: ['/search', '/category', '/star', '/studio', '/label']
            }
          ]
        },
        // 详情页面内容解析规则
        detailPage: {
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
        }
      },

      // JavDB 解析规则
      javdb: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: '.movie-list .item a, .grid-item a, .video-node a',
              titleSelector: '.video-title, .title, h4',
              codeSelector: '.video-number, .uid, .meta strong',
              mustContainCode: true,
              excludeHrefs: ['/search', '/actors', '/makers', '/publishers']
            },
            {
              selector: 'a[href*="/v/"]',
              titleSelector: '.video-title, .title',
              mustContainCode: false // JavDB的/v/链接通常是详情页
            }
          ]
        },
        detailPage: {
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
        }
      },

      // JavLibrary 解析规则
      javlibrary: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: '.videos .video a, .video-title a',
              titleSelector: '.title, .video-title',
              codeSelector: '.id',
              mustContainCode: true,
              excludeHrefs: ['/vl_searchbyid', '/vl_star', '/vl_director']
            },
            {
              selector: 'a[href*="?v="]',
              titleSelector: '.title, img[title]',
              titleAttribute: 'title',
              mustContainCode: true
            }
          ]
        },
        detailPage: {
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
        }
      },

      // Jable 解析规则
      jable: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: '.video-item a, .list-videos a',
              titleSelector: '.title, h4, .video-title',
              mustContainCode: true,
              excludeHrefs: ['/search', '/categories', '/models']
            },
            {
              selector: 'a[href*="/videos/"]',
              titleSelector: '.title, .video-title',
              mustContainCode: false // Jable的视频链接通常是详情页
            }
          ]
        },
        detailPage: {
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
        }
      },

      // MissAV 解析规则
      missav: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: '.group a, .space-y-2 a, .thumbnail a',
              titleSelector: '.title, .text-secondary, h3',
              mustContainCode: true,
              excludeHrefs: ['/search', '/actresses', '/categories']
            },
            {
              selector: 'a[href*="/"][title*="-"]',
              titleAttribute: 'title',
              mustContainCode: true
            }
          ]
        },
        detailPage: {
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
        }
      },

      // Sukebei (磁力站) 解析规则
      sukebei: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: 'tr td:first-child a, .torrent-name a',
              titleSelector: null, // 直接使用链接文本
              mustContainCode: true,
              excludeHrefs: ['/user/', '/?']
            },
            {
              selector: 'a[href*="/view/"]',
              titleSelector: null,
              mustContainCode: false // Sukebei的/view/链接是详情页
            }
          ]
        },
        detailPage: {
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
        }
      },

      // 通用解析规则（作为后备）
      generic: {
        searchPage: {
          detailLinkSelectors: [
            {
              selector: 'a[href*="/"][title]',
              titleAttribute: 'title',
              mustContainCode: true,
              excludeHrefs: ['/search', '/category', '/tag', '/list']
            },
            {
              selector: '.item a, .movie a, .video a, .result a',
              titleSelector: '.title, h1, h2, h3, h4, img[alt]',
              mustContainCode: true,
              excludeHrefs: ['/search', '/category', '/tag', '/list']
            },
            {
              selector: 'a[href]',
              titleSelector: '.title, h1, h2, h3, h4, img[alt]',
              mustContainCode: true,
              excludeHrefs: ['/search', '/category', '/tag', '/list', '/page', '?page']
            }
          ]
        },
        detailPage: {
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
      }
    };
  }

  /**
   * 根据源类型获取搜索页面规则
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 搜索页面规则对象
   */
  getSearchPageRules(sourceType) {
    if (!sourceType || typeof sourceType !== 'string') {
      return this.rules.generic.searchPage;
    }

    const normalizedType = sourceType.toLowerCase();
    const rules = this.rules[normalizedType];
    return rules ? rules.searchPage : this.rules.generic.searchPage;
  }

  /**
   * 根据源类型获取详情页面规则
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 详情页面规则对象
   */
  getDetailPageRules(sourceType) {
    if (!sourceType || typeof sourceType !== 'string') {
      return this.rules.generic.detailPage;
    }

    const normalizedType = sourceType.toLowerCase();
    const rules = this.rules[normalizedType];
    return rules ? rules.detailPage : this.rules.generic.detailPage;
  }

  /**
   * 根据源类型获取解析规则（兼容旧接口）
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 解析规则对象
   */
  getParserRules(sourceType) {
    return this.getDetailPageRules(sourceType);
  }

  /**
   * 获取详情链接选择器配置
   * @param {string} sourceType - 源类型
   * @returns {Array} 选择器配置数组
   */
  getDetailLinkSelectors(sourceType) {
    const searchPageRules = this.getSearchPageRules(sourceType);
    return searchPageRules ? searchPageRules.detailLinkSelectors : [];
  }

  /**
   * 验证是否为有效的详情链接
   * @param {string} href - 链接地址
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否为有效详情链接
   */
  isValidDetailLink(href, sourceType) {
    if (!href || typeof href !== 'string') return false;

    const searchPageRules = this.getSearchPageRules(sourceType);
    if (!searchPageRules || !searchPageRules.detailLinkSelectors) return true;

    // 检查所有选择器配置的排除规则
    for (const selectorConfig of searchPageRules.detailLinkSelectors) {
      if (selectorConfig.excludeHrefs) {
        const isExcluded = selectorConfig.excludeHrefs.some(excludePattern => 
          href.toLowerCase().includes(excludePattern.toLowerCase())
        );
        if (isExcluded) return false;
      }
    }

    return true;
  }

  /**
   * 检查链接是否包含番号
   * @param {string} text - 文本内容
   * @returns {boolean} 是否包含番号
   */
  containsCode(text) {
    if (!text) return false;
    return /[A-Z]{2,6}-?\d{3,6}/i.test(text);
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
        searchPage: {
          detailLinkSelectors: rules.searchPage?.detailLinkSelectors || this.rules.generic.searchPage.detailLinkSelectors
        },
        detailPage: {
          ...this.rules.generic.detailPage,
          ...rules.detailPage
        }
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
      if (updates.searchPage) {
        this.rules[normalizedType].searchPage = {
          ...this.rules[normalizedType].searchPage,
          ...updates.searchPage
        };
      }

      if (updates.detailPage) {
        this.rules[normalizedType].detailPage = {
          ...this.rules[normalizedType].detailPage,
          ...updates.detailPage
        };
      }
      
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

    // 检查搜索页面规则
    if (rules.searchPage) {
      if (!rules.searchPage.detailLinkSelectors || !Array.isArray(rules.searchPage.detailLinkSelectors)) {
        result.warnings.push('缺少搜索页面详情链接选择器');
      }
    }

    // 检查详情页面规则
    if (rules.detailPage) {
      const requiredFields = ['title', 'coverImage'];
      const recommendedFields = ['code', 'actresses', 'description', 'tags'];

      requiredFields.forEach(field => {
        if (!rules.detailPage[field]) {
          result.valid = false;
          result.errors.push(`缺少必需字段: ${field}`);
        }
      });

      recommendedFields.forEach(field => {
        if (!rules.detailPage[field]) {
          result.warnings.push(`建议添加字段: ${field}`);
        }
      });
    } else {
      result.warnings.push('缺少详情页面解析规则');
    }

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
      version: '2.0',
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

// 额外的搜索页面规则配置
const searchPageRules = {
  javguru: {
    detailLinkSelectors: [{
      selector: '.post-inner a',  // 文章链接选择器
      titleSelector: '.post-title',
      mustContainCode: true
    }]
  },
  javgg: {
    detailLinkSelectors: [{
      selector: '.movie-box',  // 影片卡片选择器
      titleSelector: 'img',
      titleAttribute: 'title',
      mustContainCode: true
    }]
  },
  sukebei: {
    detailLinkSelectors: [{
      selector: 'tr.success td:nth-child(2) a',  // 种子标题链接
      titleSelector: 'a',
      mustContainCode: true
    }]
  }
};