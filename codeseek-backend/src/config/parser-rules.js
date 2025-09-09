// src/config/parser-rules.js - 严格优化版本：精确的解析规则配置
export class ParserRulesConfig {
  constructor() {
    this.rules = {
      // JavBus 解析规则 - 修复版
      javbus: {
        // 搜索页面详情链接提取规则
        searchPage: {
          detailLinkSelectors: [
            {
              // 精确匹配包含番号的详情页链接
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"]):not([href*="/genre"]):not([href*="/actress"])',
              titleSelector: 'img[title], img[alt]',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false, // 修改：放宽域名检查以支持子域名
              excludeHrefs: [
                '/search/', '/category/', '/star/', '/studio/', '/label/', '/genre/',
                '/actresses/', '/uncensored/', '/forum/', '/doc/', '/page/', '/en',
                '/ja', '/ko', '/#', '.css', '.js', 'javascript:', '/terms', '/privacy',
                '/rss', '/sitemap', '/api/', '/ajax/', '/admin/'
              ],
              // 必须匹配番号模式
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
              // 新增：严格的垃圾链接排除
              excludeDomains: [
                'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
                'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
                'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
                'mnaspm.com', 'asacp.org', 'pr0rze.vip', 'go.mnaspm.com'
              ]
            },
            {
              // 备用：movie-box内的链接
              selector: '.movie-box a[href]',
              titleSelector: 'img',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/category/', '/genre/', '/actresses/'],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i
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
            extractQuality: '.quality',
            // 新增：严格的下载链接过滤
            strictValidation: true,
            excludeDomains: [
              'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
              'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
              'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
              'mnaspm.com', 'asacp.org', 'pr0rze.vip', 'go.mnaspm.com'
            ]
          },
          rating: {
            selector: '.rating, .score, .rate',
            transform: [
              { type: 'extract', pattern: '(\\d+(?:\\.\\d+)?)', group: 1 }
            ]
          }
        }
      },

      // JavDB 解析规则 - 修复版
      javdb: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavDB专用：/v/格式的详情页链接
              selector: 'a[href*="/v/"]:not([href*="/search"])',
              titleSelector: '.video-title, .title, h4',
              mustContainCode: false, // JavDB的/v/链接通常是详情页
              strictDomainCheck: false, // 修改：支持子域名
              excludeHrefs: ['/search/', '/actors/', '/makers/', '/publishers/'],
              requirePattern: /\/v\/[a-zA-Z0-9]+/
            },
            {
              // 备用：grid-item或movie-list中的链接
              selector: '.movie-list .item a, .grid-item a, .video-node a',
              titleSelector: '.video-title, .title, h4',
              codeSelector: '.video-number, .uid, .meta strong',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/actors/', '/makers/', '/publishers/']
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

      // JavLibrary 解析规则 - 修复版
      javlibrary: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavLibrary专用：?v=格式的详情页链接
              selector: 'a[href*="?v="]:not([href*="vl_searchbyid"])',
              titleSelector: '.title, img[title]',
              titleAttribute: 'title',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/vl_searchbyid', '/vl_star', '/vl_director'],
              requirePattern: /\?v=[a-zA-Z0-9]+/
            },
            {
              // 备用：videos区域的链接
              selector: '.videos .video a, .video-title a',
              titleSelector: '.title, .video-title',
              codeSelector: '.id',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['/vl_searchbyid', '/vl_star', '/vl_director']
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

      // Jable 解析规则 - 严格修复版
      jable: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Jable专用：/videos/格式的详情页链接，严格域名验证
              selector: 'a[href*="/videos/"]:not([href*="/search"])',
              titleSelector: '.title, .video-title',
              mustContainCode: false, // Jable的视频链接通常是详情页
              strictDomainCheck: false, // 修改：支持子域名
              excludeHrefs: ['/search/', '/categories/', '/models/'],
              requirePattern: /\/videos\/[^\/]+/,
              // 修改：放宽域名白名单以支持子域名
              allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/],
              excludeDomains: [
                'go.mnaspm.com', 'mnaspm.com', 'asacp.org', 'seedmm.cyou', 
                'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip'
              ]
            },
            {
              // 备用：video-item中的链接，但必须是同域名
              selector: '.video-item a, .list-videos a',
              titleSelector: '.title, h4, .video-title',
              mustContainCode: true,
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
            // 新增：严格过滤垃圾链接
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/], // 只允许同域名下载链接
            excludeDomains: [
              'go.mnaspm.com', 'mnaspm.com', 'asacp.org', 'seedmm.cyou',
              'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
              'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc'
            ]
          }
        }
      },

      // 新增：JavGG 解析规则 - 根据实际链接优化
      javgg: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGG专用：/jav/格式的详情页链接
              selector: 'a[href*="/jav/"]:not([href*="/search"])',
              titleSelector: '.title, .video-title, h3',
              mustContainCode: true, // JavGG的链接通常包含番号
              strictDomainCheck: false,
              excludeHrefs: ['/search/', '/category/', '/tag/', '/page/'],
              requirePattern: /\/jav\/[A-Z]{2,6}-?\d{3,6}[^\/]*\/?/i,
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

      // Sukebei (磁力站) 解析规则 - 修复版
      sukebei: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Sukebei专用：/view/格式的详情页链接
              selector: 'a[href*="/view/"]:not([href*="/?"])',
              titleSelector: null, // 直接使用链接文本
              mustContainCode: false, // Sukebei的/view/链接是详情页
              strictDomainCheck: false,
              excludeHrefs: ['/user/', '/?'],
              requirePattern: /\/view\/\d+/,
              allowedDomainPatterns: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/]
            },
            {
              // 备用：表格中的torrent名称链接
              selector: 'tr td:first-child a, .torrent-name a',
              titleSelector: null, // 直接使用链接文本
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

      // JavMost 解析规则 - 修复版 (支持子域名)
      javmost: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavMost专用：包含番号的详情页链接
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/tag"])',
              titleSelector: '.title, h3, .video-title',
              mustContainCode: true,
              strictDomainCheck: false, // 修改：支持子域名
              excludeHrefs: ['/search/', '/tag/', '/category/', '/page/'],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/] // 支持www5.javmost.com等子域名
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
            allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/],
            excludeDomains: [
              'go.mnaspm.com', 'mnaspm.com', 'asacp.org'
            ]
          }
        }
      },

      // JavGuru 解析规则 - 新增
      javguru: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGuru的详情页通常不在搜索页面，搜索页面主要是跳转
              selector: 'a[href*="/watch/"]:not([href*="?s="])',
              titleSelector: '.title, h3',
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ['?s=', '/search/', '/category/'],
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
              strictDomainCheck: false, // 修改：通用规则也支持子域名
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
            console.log(`❌ 域名不匹配模式: ${linkDomain} (模式: ${selectorConfig.allowedDomainPatterns.map(p => p.source).join(', ')})`);
            return false;
          }
        } else {
          // 标准域名一致性检查 - 支持子域名
          if (!this.isDomainOrSubdomain(linkDomain, expectedDomain)) {
            console.log(`❌ 域名不匹配: ${linkDomain} != ${expectedDomain}`);
            return false;
          }
        }

        // 检查域名黑名单
        if (selectorConfig.excludeDomains && selectorConfig.excludeDomains.length > 0) {
          if (selectorConfig.excludeDomains.some(domain => linkDomain.includes(domain))) {
            console.log(`❌ 域名在黑名单: ${linkDomain}`);
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
          console.log(`❌ URL包含排除模式: ${href}`);
          return false;
        }
      }

      // 3. 必需模式检查
      if (selectorConfig.requirePattern) {
        if (!selectorConfig.requirePattern.test(href)) {
          console.log(`❌ URL不匹配必需模式: ${href}`);
          return false;
        }
      }

      // 4. 必须包含番号检查
      if (selectorConfig.mustContainCode) {
        if (!this.containsCode(href) && !this.containsCode(content)) {
          console.log(`❌ 链接和内容都不包含番号: ${href}`);
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
   * 验证搜索结果链接有效性 - 严格版本
   * @param {string} href - 链接地址
   * @param {string} content - 链接内容
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为有效搜索结果链接
   */
  isValidSearchResultLink(href, content, sourceType, expectedDomain) {
    if (!href || typeof href !== 'string') return false;

    const hrefLower = href.toLowerCase();
    const contentLower = (content || '').toLowerCase();

    // 通用排除规则 - 更严格
    const universalExcludes = [
      '/search/', '/page/', '/category/', '/genre/', '/actresses/', '/studio/',
      '/forum/', '/doc/', '/terms', '/privacy', '/#', '.css', '.js', '.png',
      '.jpg', '.gif', '.ico', 'javascript:', '/en', '/ja', '/ko', '/rss',
      '/sitemap', '/api/', '/ajax/', '/admin/', '/login', '/register'
    ];

    if (universalExcludes.some(pattern => hrefLower.includes(pattern))) {
      return false;
    }

    // 排除导航文本 - 更全面
    const navTexts = [
      'english', '中文', '日本語', '한국의', '有碼', '無碼', '女優', '類別',
      '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', '高清',
      '字幕', '欧美', 'rta', '2257', 'next', 'prev', 'page', 'home', 'forum',
      'contact', 'about', 'help', 'faq', 'support', '帮助', '联系', '关于'
    ];

    if (navTexts.some(text => contentLower.includes(text.toLowerCase()))) {
      return false;
    }

    // 排除纯数字（分页链接）
    if (/^\s*\d+\s*$/.test(content)) {
      return false;
    }

    // 增强的域名检查
    if (expectedDomain) {
      const linkDomain = this.extractDomainFromUrl(href);
      if (!this.isDomainOrSubdomain(linkDomain, expectedDomain)) {
        // 检查已知的垃圾域名
        const spamDomains = [
          'go.mnaspm.com', 'mnaspm.com', 'asacp.org', 'seedmm.cyou',
          'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
          'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
          'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
          'pr0rze.vip'
        ];
        
        if (spamDomains.some(domain => linkDomain.includes(domain))) {
          console.log(`❌ 检测到垃圾域名: ${linkDomain}`);
          return false;
        }
        
        console.log(`❌ 域名不匹配: ${linkDomain} != ${expectedDomain}`);
        return false;
      }
    }

    // 根据源类型进行专门验证
    switch (sourceType?.toLowerCase()) {
      case 'javbus':
        return this.isValidJavBusSearchLink(href, content);
      case 'javdb':
        return this.isValidJavDBSearchLink(href, content);
      case 'javlibrary':
        return this.isValidJavLibrarySearchLink(href, content);
      case 'jable':
        return this.isValidJableSearchLink(href, content);
      case 'javgg':
        return this.isValidJavGGSearchLink(href, content);
      case 'missav':
        return this.isValidMissAVSearchLink(href, content);
      case 'sukebei':
        return this.isValidSukebeiSearchLink(href, content);
      case 'javmost':
        return this.isValidJavMostSearchLink(href, content);
      case 'javguru':
        return this.isValidJavGuruSearchLink(href, content);
      default:
        return this.isValidGenericSearchLink(href, content);
    }
  }

  /**
   * JavBus搜索链接验证
   */
  isValidJavBusSearchLink(href, content) {
    // 必须包含番号路径
    if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) return false;
    
    // 排除搜索页面
    if (href.toLowerCase().includes('/search')) return false;
    
    return true;
  }

  /**
   * JavDB搜索链接验证
   */
  isValidJavDBSearchLink(href, content) {
    // JavDB详情页格式
    if (/\/v\/[a-zA-Z0-9]+/.test(href)) return true;
    
    // 或包含番号的路径
    if (/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) return true;
    
    return false;
  }

  /**
   * JavLibrary搜索链接验证
   */
  isValidJavLibrarySearchLink(href, content) {
    // JavLibrary详情页格式
    if (!/\?v=[a-zA-Z0-9]+/.test(href)) return false;
    
    // 排除搜索页
    if (href.toLowerCase().includes('vl_searchbyid')) return false;
    
    return true;
  }

  /**
   * Jable搜索链接验证 - 严格版本
   */
  isValidJableSearchLink(href, content) {
    // Jable视频页格式
    if (!/\/videos\/[^\/]+/.test(href)) return false;
    
    // 严格检查：必须是jable.tv域名
    const domain = this.extractDomainFromUrl(href);
    if (domain !== 'jable.tv') {
      console.log(`❌ Jable链接域名错误: ${domain}`);
      return false;
    }
    
    return true;
  }

  /**
   * JavGG搜索链接验证 - 新增
   */
  isValidJavGGSearchLink(href, content) {
    // JavGG详情页格式：/jav/[code]
    if (!/\/jav\/[A-Z]{2,6}-?\d{3,6}[^\/]*\/?/i.test(href)) return false;
    
    // 检查域名
    const domain = this.extractDomainFromUrl(href);
    const allowedDomains = ['javgg.net'];
    
    return allowedDomains.some(allowed => domain === allowed || domain.endsWith('.' + allowed));
  }

  /**
   * MissAV搜索链接验证
   */
  isValidMissAVSearchLink(href, content) {
    // 必须包含番号
    return /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href);
  }

  /**
   * Sukebei搜索链接验证
   */
  isValidSukebeiSearchLink(href, content) {
    // Sukebei详情页格式
    if (/\/view\/\d+/.test(href)) return true;
    
    // 或包含番号的内容
    return /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }

  /**
   * JavMost搜索链接验证 - 支持子域名
   */
  isValidJavMostSearchLink(href, content) {
    // 必须包含番号路径
    if (!/\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(href)) return false;
    
    // 检查域名 - 支持子域名
    const domain = this.extractDomainFromUrl(href);
    return this.isDomainOrSubdomain(domain, 'javmost.com');
  }

  /**
   * JavGuru搜索链接验证
   */
  isValidJavGuruSearchLink(href, content) {
    // JavGuru的详情页面模式
    const hasDetailPattern = /\/(watch|video|play)\//.test(href.toLowerCase()) || 
                           /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href);
    
    // 排除搜索页面
    const notSearchPage = !href.toLowerCase().includes('?s=');
    
    return hasDetailPattern && notSearchPage;
  }

  /**
   * 通用搜索链接验证
   */
  isValidGenericSearchLink(href, content) {
    // 必须匹配常见详情页模式
    const detailPatterns = [
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,  // 直接番号路径
      /\/v\/[a-zA-Z0-9]+/,               // JavDB格式
      /\?v=[a-zA-Z0-9]+/,                // JavLibrary格式
      /\/videos\/[^\/]+/,                // Jable格式
      /\/jav\/[^\/]+/,                   // JavGG格式
      /\/view\/\d+/                      // Sukebei格式
    ];
    
    return detailPatterns.some(pattern => pattern.test(href)) ||
           /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }

  /**
   * 验证下载链接的有效性 - 新增方法
   * @param {string} url - 下载链接URL
   * @param {string} name - 链接名称
   * @param {string} expectedDomain - 期望的域名
   * @param {Object} rules - 验证规则
   * @returns {boolean} 是否为有效下载链接
   */
  isValidDownloadLink(url, name, expectedDomain, rules = {}) {
    if (!url || typeof url !== 'string') return false;

    const urlLower = url.toLowerCase();
    const nameLower = (name || '').toLowerCase();
    const linkDomain = this.extractDomainFromUrl(url);

    // 严格域名检查
    if (rules.strictValidation && expectedDomain) {
      // 检查域名模式匹配
      if (rules.allowedDomainPatterns && rules.allowedDomainPatterns.length > 0) {
        const domainMatches = rules.allowedDomainPatterns.some(pattern => 
          pattern.test && pattern.test(linkDomain)
        );
        if (!domainMatches) {
          console.log(`❌ 下载链接域名不在白名单: ${linkDomain}`);
          return false;
        }
      } else {
        // 标准域名检查
        if (!this.isDomainOrSubdomain(linkDomain, expectedDomain)) {
          console.log(`❌ 下载链接域名不匹配: ${linkDomain} != ${expectedDomain}`);
          return false;
        }
      }

      // 检查域名黑名单
      if (rules.excludeDomains && rules.excludeDomains.length > 0) {
        if (rules.excludeDomains.some(domain => urlLower.includes(domain))) {
          console.log(`❌ 下载链接域名在黑名单: ${linkDomain}`);
          return false;
        }
      }
    }

    // 排除明显的导航链接
    const excludeTexts = [
      'english', '中文', '日本語', '한국의', '有碼', '無碼', '女優', '類別',
      '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', 'agent_code',
      'rta', '2257', 'contact', 'about', 'help', 'support'
    ];

    if (excludeTexts.some(text => nameLower.includes(text.toLowerCase()))) {
      console.log(`❌ 排除导航文本链接: ${name}`);
      return false;
    }

    return true;
  }

  // 其余方法保持不变...
  
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
      'javgg': /javgg\.net/,
      'javmost': /javmost\.com/,
      'missav': /missav\.com/,
      'javhdporn': /javhd\.porn/,
      'av01': /av01\.tv/,
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
      version: '2.3',
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