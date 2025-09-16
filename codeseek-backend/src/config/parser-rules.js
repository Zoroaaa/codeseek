// src/config/parser-rules.js - 根据实际搜索数据优化的解析规则配置
export class ParserRulesConfig {
  constructor() {
    this.rules = {
      // JavBus 解析规则 - 实际验证版本
      javbus: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavBus的详情页直接是番号格式: /IPX-156
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"]):not([href*="/genre"]):not([href*="/actress"])',
              titleSelector: 'img[title], img[alt]',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                '/search/', '/category/', '/star/', '/studio/', '/label/', '/genre/',
                '/actresses/', '/uncensored/', '/forum/', '/doc/', '/page/', '/en',
                '/ja', '/ko', '/#', '.css', '.js', 'javascript:', '/terms', '/privacy'
              ],
              // 实际验证：JavBus详情页就是 /番号 格式
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
            },
            {
              // 备用：movie-box内的链接
              selector: '.movie-box a[href]',
              titleSelector: 'img',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/category/', '/genre/', '/actresses/'],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
            }
          ]
        },
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
            selector: '.star-name a, .actress a, .info .genre:contains("演员") a',
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
            excludeTexts: ['演员', '導演', '製作商', '發行商', '系列', '發行日期', '長度']
          },
          magnetLinks: {
            selector: 'a[href^="magnet:"], .magnet-link',
            extractSize: '.size, .filesize',
            extractSeeders: '.seeders, .seeds'
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download-link',
            extractSize: '.size',
            extractQuality: '.quality',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
          },
          rating: {
            selector: '.rating, .score, .rate',
            transform: [
              { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
            ]
          }
        }
      },

      // JavDB 解析规则 - 实际验证版本
javdb: {
    searchPage: {
        detailLinkSelectors: [
            {
                // 主要选择器：精确匹配 .movie-list .item a 结构
                selector: '.movie-list .item a',
                titleAttribute: 'title',  // 优先使用title属性
                titleSelector: '.video-title, strong',  // 备用标题选择器
                codeSelector: 'strong, .video-number',  // 番号选择器
                mustContainCode: false,  // 不强制要求包含番号（因为有些可能在title属性中）
                strictDomainCheck: true,  // 严格域名检查
                excludeHrefs: [
                    '/search/', '/actors/', '/makers/', '/publishers/', 
                    '/categories/', '/tags/', '?page=', '&page=',
                    '?q=', '&q=', '/ja', '/en', '/ko'
                ],
                requirePattern: /^\/v\/[a-zA-Z0-9]+$/,  // 严格的JavDB详情页格式
                allowedDomainPatterns: [
                    /^.*\.javdb\.com$/,
                    /^javdb\.com$/
                ],
                // 新增：特定的验证规则
                customValidation: {
                    // 必须是/v/开头的相对URL
                    hrefPattern: /^\/v\/[a-zA-Z0-9]+$/,
                    // title属性必须存在且不为空（优先级验证）
                    preferTitleAttribute: true,
                    // 允许的class属性值
                    allowedClasses: ['box'],
                    // 最小标题长度
                    minTitleLength: 5
                }
            },
            {
                // 备用选择器1：带class="box"的链接
                selector: '.movie-list a.box',
                titleAttribute: 'title',
                mustContainCode: false,
                strictDomainCheck: true,
                excludeHrefs: ['/search/', '/actors/', '/makers/', '/publishers/'],
                requirePattern: /^\/v\/[a-zA-Z0-9]+$/,
                allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/]
            },
            {
                // 备用选择器2：任何/v/格式的链接
                selector: 'a[href^="/v/"]',
                titleAttribute: 'title',
                titleSelector: '.video-title, .title, h4, strong',
                mustContainCode: false,
                strictDomainCheck: true,
                excludeHrefs: ['/search/', '/actors/', '/makers/', '/publishers/'],
                requirePattern: /^\/v\/[a-zA-Z0-9]+$/,
                allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/]
            },
            {
                // 备用选择器3：容器内的链接
                selector: '.grid-item a, .video-node a, .video-item a',
                titleSelector: '.video-title, .title, h4',
                codeSelector: '.video-number, .uid, .meta strong',
                mustContainCode: false,
                strictDomainCheck: true,
                excludeHrefs: ['/search/', '/actors/', '/makers/', '/publishers/'],
                allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/]
            }
        ],
        // 新增：页面级别的配置
        pageConfig: {
            // 容器选择器优先级
            containerSelectors: [
                '.movie-list',
                '.grid-container', 
                '.video-list',
                '.search-results'
            ],
            // item选择器优先级
            itemSelectors: [
                '.item',
                '.grid-item',
                '.video-item',
                '.movie-item'
            ],
            // 最大链接处理数量
            maxLinksPerPage: 100,
            // 调试模式
            debugMode: false
        }
    },
    detailPage: {
        title: {
            selector: 'h2.title, .video-title, .page-title, title',
            transform: [
                { type: 'replace', pattern: '\\s+', replacement: ' ' },
                { type: 'trim' },
                { type: 'replace', pattern: '^JavDB\\s*-\\s*', replacement: '' } // 移除JavDB前缀
            ]
        },
        code: {
            selector: '.first-block .value, .video-meta strong, .panel-block strong, [data-clipboard-text]',
            transform: [
                { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
                { type: 'uppercase' }
            ],
            // 备用提取方法
            fallbackSelectors: [
                '.title', '.video-title', 'h1', 'h2'
            ]
        },
        coverImage: {
            selector: '.video-cover img, .cover img, .poster img, .movie-poster img',
            attribute: 'src',
            fallback: 'data-src',
            // 图片URL处理
            transform: [
                { type: 'resolve_url' }, // 解析相对URL
                { type: 'remove_query' }  // 移除查询参数
            ]
        },
        screenshots: {
            selector: '.tile-images img, .preview-images img, .gallery img, .screenshots img',
            attribute: 'src',
            fallback: 'data-src',
            maxCount: 20  // 限制截图数量
        },
        actresses: {
            selector: '.panel-block:contains("演员") .value a, .actress-tag a, .performers a',
            extractProfile: true,
            // 演员信息提取配置
            profileConfig: {
                nameSelector: null, // 使用链接文本作为姓名
                linkAttribute: 'href',
                imageSelector: 'img',
                imageAttribute: 'src'
            }
        },
        director: {
            selector: '.panel-block:contains("導演") .value, .director, .panel-block:contains("导演") .value',
            transform: [{ type: 'trim' }]
        },
        studio: {
            selector: '.panel-block:contains("片商") .value, .studio, .panel-block:contains("制作商") .value',
            transform: [{ type: 'trim' }]
        },
        label: {
            selector: '.panel-block:contains("廠牌") .value, .label, .panel-block:contains("发行商") .value',
            transform: [{ type: 'trim' }]
        },
        series: {
            selector: '.panel-block:contains("系列") .value, .series',
            transform: [{ type: 'trim' }]
        },
        releaseDate: {
            selector: '.panel-block:contains("時間") .value, .release-date, .panel-block:contains("发布日期") .value',
            transform: [
                { type: 'extract', pattern: '(\\d{4}-\\d{2}-\\d{2})', group: 1 },
                { type: 'extract', pattern: '(\\d{4}\\/\\d{2}\\/\\d{2})', group: 1, replacement: '$1' },
                { type: 'replace', pattern: '\\/', replacement: '-' }
            ]
        },
        duration: {
            selector: '.panel-block:contains("時長") .value, .duration, .panel-block:contains("时长") .value',
            transform: [
                { type: 'extract', pattern: '(\\d+)', group: 1 }
            ]
        },
        description: {
            selector: '.description, .content, .summary, .intro',
            transform: [
                { type: 'trim' },
                { type: 'replace', pattern: '\\s+', replacement: ' ' }
            ]
        },
        tags: {
            selector: '.panel-block:contains("類別") .tag a, .genre-tag a, .category-tag a, .tags a',
            excludeTexts: ['演員', '導演', '片商', '廠牌', '系列', '時間', '時長'],
            // 标签处理配置
            tagConfig: {
                maxCount: 50,
                minLength: 2,
                excludePatterns: [/^\d+$/, /^[a-zA-Z]$/] // 排除纯数字和单字母
            }
        },
        magnetLinks: {
            selector: 'a[href^="magnet:"], .magnet-link, [data-clipboard-text^="magnet:"]',
            extractSize: '.size, .file-size',
            extractSeeders: '.seeds, .seeders',
            extractLeechers: '.leechers, .peers',
            // 磁力链接验证
            validation: {
                minHashLength: 40,
                requireTrackers: false
            }
        },
        downloadLinks: {
            selector: 'a[href*="download"], .download-link, .download-btn',
            extractSize: '.size',
            extractQuality: '.quality, .resolution',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/],
            // 下载链接配置
            downloadConfig: {
                allowedExtensions: ['.torrent', '.zip', '.rar'],
                maxFileSize: '10GB',
                requireAuth: false
            }
        },
        rating: {
            selector: '.score, .rating, .rate, .vote-average',
            transform: [
                { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 },
                { type: 'normalize', min: 0, max: 10 } // 标准化评分到0-10范围
            ]
        },
        // 新增：页面特定配置
        pageValidation: {
            // 页面必须包含的元素（验证是否为详情页）
            requiredElements: [
                '.video-cover, .cover, .poster',
                '.panel-block, .video-meta, .movie-info'
            ],
            // 页面不应包含的元素（验证不是其他类型页面）
            excludedElements: [
                '.search-form',
                '.pagination',
                '.actor-grid'
            ]
        }
    },
    // 新增：URL处理配置
    urlConfig: {
        baseUrl: 'https://javdb.com',
        searchPath: '/search',
        detailPathPattern: /^\/v\/[a-zA-Z0-9]+$/,
        // URL标准化规则
        normalization: {
            removeTrailingSlash: true,
            lowercaseHost: true,
            removeDefaultPort: true
        },
        // 重定向处理
        redirectHandling: {
            maxRedirects: 3,
            allowedRedirectDomains: ['javdb.com', '*.javdb.com']
        }
    },
    // 新增：错误处理配置
    errorHandling: {
        retryAttempts: 3,
        retryDelay: 1000, // 毫秒
        fallbackSelectors: true,
        logLevel: 'info' // 'debug', 'info', 'warn', 'error'
    }
},

      // Jable 解析规则 - 实际验证版本
      jable: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Jable详情页格式: /videos/ipx-156/
              selector: 'a[href*="/videos/"]:not([href*="/search"])',
              titleSelector: '.title, .video-title',
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/categories/', '/models/'],
              requirePattern: /\/videos\/[^\/]+/,
              allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/]
            },
            {
              // 备用：video-item中的链接
              selector: '.video-item a, .list-videos a',
              titleSelector: '.title, h4, .video-title',
              mustContainCode: false,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/],
              excludeHrefs: ['/search/', '/categories/', '/models/']
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
            extractQuality: '.quality, .resolution',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/]
          }
        }
      },

      // JavGG 解析规则 - 实际验证版本
      javgg: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGG详情页格式: /jav/ipx-156-reduce-mosaic/
              selector: 'a[href*="/jav/"]:not([href*="/search"])',
              titleSelector: '.title, .video-title, h3',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/category/', '/tag/', '/page/'],
              requirePattern: /\/jav\/[a-z0-9\-]+/i,
              allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/]
            },
            {
              // 备用：通用容器中的链接
              selector: '.video-item a, .movie-item a, .item a',
              titleSelector: '.title, h3, .video-title',
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/],
              excludeHrefs: ['/search/', '/category/', '/tag/']
            }
          ]
        },
        detailPage: {
          title: {
            selector: 'h1, .video-title, .title',
            transform: [
              { type: 'replace', pattern: '\\s+', replacement: ' ' },
              { type: 'trim' }
            ]
          },
          code: {
            selector: 'h1, .video-title, .code, .video-meta',
            transform: [
              { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
              { type: 'uppercase' }
            ]
          },
          coverImage: {
            selector: '.video-cover img, .poster img, .cover img',
            attribute: 'src',
            fallback: 'data-src'
          },
          screenshots: {
            selector: '.screenshots img, .preview img, .gallery img',
            attribute: 'src',
            fallback: 'data-src'
          },
          actresses: {
            selector: '.actress a, .performer a, .stars a',
            extractProfile: true
          },
          description: {
            selector: '.description, .summary, .content',
            transform: [{ type: 'trim' }]
          },
          tags: {
            selector: '.tag a, .genre a, .category a',
            excludeTexts: []
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download-link',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/]
          }
        }
      },

      // Sukebei (磁力站) 解析规则 - 实际验证版本
      sukebei: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Sukebei详情页格式: /view/3403743
              selector: 'a[href*="/view/"]:not([href*="/?"])',
              titleSelector: null,
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ['/user/', '/?'],
              requirePattern: /\/view\/\d+/,
              allowedDomainPatterns: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/]
            },
            {
              // 备用：表格中的torrent名称链接
              selector: 'tr td:first-child a, .torrent-name a',
              titleSelector: null,
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/],
              excludeHrefs: ['/user/', '/?']
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

      // JavMost 解析规则 - 实际验证版本（支持子域名）
      javmost: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavMost详情页格式: /IPX-156/ （注意支持www5等子域名）
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/tag"])',
              titleSelector: '.title, h3, .video-title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/tag/', '/category/', '/page/'],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/]
            },
            {
              // 备用：video-item中的链接
              selector: '.video-item a, .movie-item a',
              titleSelector: '.title, h3',
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/],
              excludeHrefs: ['/search/', '/tag/', '/category/']
            }
          ]
        },
        detailPage: {
          title: {
            selector: 'h1, .video-title, .title',
            transform: [
              { type: 'replace', pattern: '\\s+', replacement: ' ' },
              { type: 'trim' }
            ]
          },
          code: {
            selector: 'h1, .video-code, .title',
            transform: [
              { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
              { type: 'uppercase' }
            ]
          },
          coverImage: {
            selector: '.video-cover img, .poster img',
            attribute: 'src',
            fallback: 'data-src'
          },
          actresses: {
            selector: '.actress a, .performer a',
            extractProfile: true
          },
          description: {
            selector: '.description, .summary',
            transform: [{ type: 'trim' }]
          },
          downloadLinks: {
            selector: 'a[href*="/"][title], .download-link',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/]
          }
        }
      },

      // JavGuru 解析规则 - 实际验证版本
      javguru: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGuru详情页格式: /268681/ipx-156-sana-matsunaga-has-been-celibate-for-30-days-she-is-given-a-large-dose-of-a-powerful-aphrodisiac/
              selector: 'a[href]:not([href*="?s="]):not([href*="/search"])',
              titleSelector: '.title, h3',
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ['?s=', '/search/', '/category/'],
              requirePattern: /\/\d+\/[a-z0-9\-]+/i,
              allowedDomainPatterns: [/^.*\.jav\.guru$/, /^jav\.guru$/]
            }
          ]
        },
        detailPage: {
          title: {
            selector: 'h1, .video-title',
            transform: [
              { type: 'replace', pattern: '\\s+', replacement: ' ' },
              { type: 'trim' }
            ]
          },
          code: {
            selector: 'h1, .video-title',
            transform: [
              { type: 'extract', pattern: '([A-Z]{2,6}-?\\d{3,6})', group: 1 },
              { type: 'uppercase' }
            ]
          }
        }
      },

      // 通用解析规则（作为后备）- 严格修复版
      generic: {
        searchPage: {
          detailLinkSelectors: [
            {
              // 最严格：必须包含番号的链接
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"]):not([href*="/category"])',
              titleSelector: '.title, h1, h2, h3, h4, img[alt]',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                '/search/', '/category/', '/tag/', '/list/', '/page/', '/genre/',
                '/actresses/', '/studio/', '/label/', '/forum/', '/doc/', '/terms',
                '/privacy', '/#', '.css', '.js', 'javascript:', '/rss', '/sitemap'
              ],
              requirePattern: /[A-Z]{2,6}-?\d{3,6}/i
            },
            {
              // 中等严格：容器内的链接
              selector: '.item a, .movie a, .video a, .result a',
              titleSelector: '.title, h1, h2, h3, h4, img[alt]',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/category/', '/tag/', '/list/', '/page/']
            },
            {
              // 最宽松：所有链接（最严格过滤）
              selector: 'a[href]:not([href*="/search"]):not([href*="/page"])',
              titleSelector: '.title, h1, h2, h3, h4, img[alt]',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                '/search/', '/category/', '/tag/', '/list/', '/page/', '?page',
                '/genre/', '/actresses/', '/studio/', '/label/', '/forum/', '/doc/',
                '/terms', '/privacy', '/#', '.css', '.js', 'javascript:', '/en',
                '/ja', '/ko', '/rss', '/sitemap', '/api/', '/ajax/'
              ]
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
            extractSize: '.size',
            strictValidation: true
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
   * 验证链接是否为有效的详情链接 - 增强版，包含严格域名检查
   * @param {string} href - 链接地址
   * @param {string} content - 链接内容
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为有效详情链接
   */
  isValidDetailLink(href, content, sourceType, expectedDomain) {
    if (!href || typeof href !== 'string') return false;

    const searchPageRules = this.getSearchPageRules(sourceType);
    if (!searchPageRules || !searchPageRules.detailLinkSelectors) return true;

    const hrefLower = href.toLowerCase();
    const contentLower = (content || '').toLowerCase();

    // 检查所有选择器配置的排除规则
    for (const selectorConfig of searchPageRules.detailLinkSelectors) {
      
      // 1. 增强的域名检查 - 支持子域名模式
      if (selectorConfig.strictDomainCheck !== false && expectedDomain) {
        const linkDomain = this.extractDomainFromUrl(href);
        
        // 检查域名模式匹配（新增功能）
        if (selectorConfig.allowedDomainPatterns && selectorConfig.allowedDomainPatterns.length > 0) {
          const domainMatches = selectorConfig.allowedDomainPatterns.some(pattern => 
            pattern.test && pattern.test(linkDomain)
          );
          if (!domainMatches) {
            console.log(`⌐ 域名不匹配模式: ${linkDomain} (模式: ${selectorConfig.allowedDomainPatterns.map(p => p.source).join(', ')})`);
            return false;
          }
        } else {
          // 标准域名一致性检查 - 支持子域名
          if (!this.isDomainOrSubdomain(linkDomain, expectedDomain)) {
            console.log(`⌐ 域名不匹配: ${linkDomain} != ${expectedDomain}`);
            return false;
          }
        }

        // 检查域名黑名单
        if (selectorConfig.excludeDomains && selectorConfig.excludeDomains.length > 0) {
          if (selectorConfig.excludeDomains.some(domain => linkDomain.includes(domain))) {
            console.log(`⌐ 域名在黑名单: ${linkDomain}`);
            return false;
          }
        }
      }

      // 2. 排除路径检查
      if (selectorConfig.excludeHrefs) {
        const isExcluded = selectorConfig.excludeHrefs.some(excludePattern => 
          hrefLower.includes(excludePattern.toLowerCase())
        );
        if (isExcluded) {
          console.log(`⌐ URL包含排除模式: ${href}`);
          return false;
        }
      }

      // 3. 必需模式检查
      if (selectorConfig.requirePattern) {
        if (!selectorConfig.requirePattern.test(href)) {
          console.log(`⌐ URL不匹配必需模式: ${href}`);
          return false;
        }
      }

      // 4. 必须包含番号检查
      if (selectorConfig.mustContainCode) {
        if (!this.containsCode(href) && !this.containsCode(content)) {
          console.log(`⌐ 链接和内容都不包含番号: ${href}`);
          return false;
        }
      }
    }

    return true;
  }

  /**
   * 检查是否为域名或子域名 - 新增方法
   * @param {string} linkDomain - 链接域名
   * @param {string} expectedDomain - 期望域名
   * @returns {boolean} 是否匹配
   */
  isDomainOrSubdomain(linkDomain, expectedDomain) {
    if (!linkDomain || !expectedDomain) return false;
    
    const linkDomainLower = linkDomain.toLowerCase();
    const expectedDomainLower = expectedDomain.toLowerCase();
    
    // 完全匹配
    if (linkDomainLower === expectedDomainLower) return true;
    
    // 子域名匹配
    if (linkDomainLower.endsWith('.' + expectedDomainLower)) return true;
    
    return false;
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
   * 从URL提取域名
   * @param {string} url - URL
   * @returns {string} 域名
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return '';
    }
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
    
    // URL模式匹配 - 根据实际数据优化
    const patterns = {
      'javbus': /javbus\.com/,
      'javdb': /javdb\.com/,
      'jable': /jable\.tv/,
      'javgg': /javgg\.net/,
      'javmost': /javmost\.com/,
      'sukebei': /sukebei\.nyaa\.si/,
      'javguru': /jav\.guru/
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
      version: '3.0',
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

  /**
   * 获取所有支持的源类型
   * @returns {Array} 源类型数组
   */
  getSupportedSourceTypes() {
    return Object.keys(this.rules).filter(type => type !== 'generic');
  }
}

// 创建单例实例
export const parserRules = new ParserRulesConfig();
export default parserRules;