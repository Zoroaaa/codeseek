// src/constants.js - 应用常量和配置（根据实际搜索源优化）
export const CONFIG = {
    MAX_TAGS_PER_USER: 50,
    MAX_SHARES_PER_USER: 50,
    MAX_FAVORITES_PER_USER: 1000,
    MAX_HISTORY_PER_USER: 1000,
    DEFAULT_CACHE_DURATION: 300000, // 5分钟
    
    // 详情提取相关配置
    DETAIL_EXTRACTION: {
        ENABLED: true,
        MAX_BATCH_SIZE: 20,
        MIN_BATCH_SIZE: 1,
        DEFAULT_TIMEOUT: 15000,
        MIN_TIMEOUT: 5000,
        MAX_TIMEOUT: 30000,
        DEFAULT_CACHE_DURATION: 86400000, // 24小时
        MIN_CACHE_DURATION: 3600000, // 1小时
        MAX_CACHE_DURATION: 604800000, // 7天
        MAX_CONCURRENT_EXTRACTIONS: 4,
        RETRY_DELAY: 1000,
        
        // 解析相关配置
        PARSE_TIMEOUT: 10000, // 解析超时时间
        MAX_RETRY_ATTEMPTS: 2, // 最大重试次数
        
        // 缓存相关配置
        CACHE_MAX_SIZE: 1000, // 缓存最大条目数
        CACHE_CLEANUP_INTERVAL: 3600000, // 缓存清理间隔 (1小时)
        
        // HTML解析相关配置
        HTML_PARSER_CACHE_SIZE: 100, // HTML解析器缓存大小
        MAX_GENERIC_LINKS_PER_PAGE: 150, // 每页最大通用链接数（优化性能）
        
        // 下载链接限制配置
        MAX_DOWNLOAD_LINKS: 10, // 单个详情页最大下载链接数
        MAX_MAGNET_LINKS: 10, // 单个详情页最大磁力链接数
        MAX_SCREENSHOTS: 10, // 单个详情页最大截图数
        
    },
    
    ALLOWED_ACTIONS: [
        'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
        'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
        'sync_data', 'page_view', 'session_start', 'session_end',
        'custom_source_add', 'custom_source_edit', 'custom_source_delete',
        'tag_created', 'tag_updated', 'tag_deleted',
        // 详情提取相关动作
        'detail_extraction', 'batch_detail_extraction', 'detail_cache_access',
        'detail_config_update', 'detail_cache_clear', 'detail_retry',
        'download_click', 'magnet_click', 'copy_magnet', 'image_preview'
    ]
};

export const VALID_CATEGORIES = ['jav', 'movie', 'torrent', 'other'];

export const VALID_SORT_COLUMNS = ['created_at', 'updated_at', 'rating_score', 'download_count', 'like_count', 'view_count'];

// 详情提取状态枚举
export const DETAIL_EXTRACTION_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    CACHED: 'cached',
    PARTIAL: 'partial'
};

// 支持的源类型和对应的解析器 - 根据实际搜索数据优化（移除JavLibrary）
export const SUPPORTED_SOURCE_TYPES = {
    javbus: 'javbus',
    javdb: 'javdb', 
    jable: 'jable',
    javmost: 'javmost',
    javgg: 'javgg',
    sukebei: 'sukebei',
    javguru: 'javguru',
    generic: 'generic'
};

// 实际验证的源域名模式 - 根据搜索数据更新
export const SOURCE_DOMAIN_PATTERNS = {
    javbus: [/^.*\.javbus\.com$/, /^javbus\.com$/],
    javdb: [/^.*\.javdb\.com$/, /^javdb\.com$/],
    jable: [/^.*\.jable\.tv$/, /^jable\.tv$/],
    javmost: [/^.*\.javmost\.com$/, /^javmost\.com$/], // 支持www5.javmost.com等子域名
    javgg: [/^.*\.javgg\.net$/, /^javgg\.net$/],
    sukebei: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/],
    javguru: [/^.*\.jav\.guru$/, /^jav\.guru$/]
};

// 实际验证的详情页URL模式 - 根据搜索数据更新
export const DETAIL_URL_PATTERNS = {
    javbus: [
        /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i  // /IPX-156
    ],
    javdb: [
        /\/v\/[a-zA-Z0-9]+/  // /v/KkZ97
    ],
    jable: [
        /\/videos\/[^\/\?]+/  // /videos/ipx-156/
    ],
    javmost: [
        /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i  // /IPX-156/
    ],
    javgg: [
        /\/jav\/[a-z0-9\-]+/i  // /jav/ipx-156-reduce-mosaic/
    ],
    sukebei: [
        /\/view\/\d+/  // /view/3403743
    ],
    javguru: [
        /\/\d+\/[a-z0-9\-]+/i  // /268681/ipx-156-sana-matsunaga-has-been-celibate-for-30-days-she-is-given-a-large-dose-of-a-powerful-aphrodisiac/
    ]
};

// 搜索页面排除模式 - 通用
export const SEARCH_EXCLUDE_PATTERNS = [
    '/search/', '/search?', '?q=', '?s=', '?query=', '?keyword=',
    '/page/', '/list/', '/category/', '/genre/', '/actresses/',
    '/studio/', '/label/', '/uncensored/', '/forum/', '/doc/',
    '/terms', '/privacy', '/login', '/register', '/user/', '/profile/',
    '/settings/', '/en/', '/ja/', '/ko/', '/#', '.css', '.js', '.png',
    '.jpg', '.gif', '.ico', 'javascript:', '/rss', '/sitemap', '/api/',
    '/ajax/', '/admin/'
];

// 垃圾域名黑名单 - 根据实际遇到的垃圾链接更新
export const SPAM_DOMAINS = [
    'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
    'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
    'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
    'mnaspm.com', 'asacp.org', 'pr0rze.vip', 'go.mnaspm.com'
];

// 导航文本过滤列表 - 常见的非内容链接文本
export const NAVIGATION_TEXTS = [
    'english', '中文', '日本語', '한국어', '有碼', '無碼', '女優', '類別',
    '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', '高清',
    '字幕', '欧美', 'rta', '2257', 'next', 'prev', 'page', 'home', 'forum',
    'contact', 'about', 'help', 'faq', 'support', '帮助', '联系', '关于',
    'login', 'register', '注册', '登录', 'agent_code'
];

// 详情提取配置验证规则
export const DETAIL_CONFIG_VALIDATION = {
    extractionTimeout: {
        min: CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT,
        max: CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT
    },
    cacheDuration: {
        min: CONFIG.DETAIL_EXTRACTION.MIN_CACHE_DURATION,
        max: CONFIG.DETAIL_EXTRACTION.MAX_CACHE_DURATION
    },
    maxAutoExtractions: {
        min: 1,
        max: 10
    },
    extractionBatchSize: {
        min: CONFIG.DETAIL_EXTRACTION.MIN_BATCH_SIZE,
        max: CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE
    },
    maxDownloadLinks: {
        min: 1,
        max: CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS
    },
    maxMagnetLinks: {
        min: 1,
        max: CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS
    },
    maxScreenshots: {
        min: 1,
        max: CONFIG.DETAIL_EXTRACTION.MAX_SCREENSHOTS
    }
};

// 番号正则表达式模式 - 更精确的匹配
export const CODE_PATTERNS = {
    // 标准格式：ABC-123, ABCD-1234
    standard: /([A-Z]{2,6}-\d{3,6})/i,
    // 无连字符格式：ABC123, ABCD1234
    noDash: /([A-Z]{2,6}\d{3,6})/i,
    // 反向格式：123ABC (较少见)
    reverse: /(\d{3,6}[A-Z]{2,6})/i,
    // 综合匹配：所有格式
    combined: /([A-Z]{2,6}-?\d{3,6})/i
};

// URL标准化配置
export const URL_NORMALIZATION = {
    // 需要移除的查询参数
    removeParams: ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'],
    // 需要保留的查询参数（按源类型）
    keepParams: {
        javdb: ['q', 'f'],  // 搜索查询和过滤器
        sukebei: ['q', 'c'], // 搜索查询和分类
        javguru: ['s'],      // 搜索查询
        generic: ['q', 's', 'search', 'query']
    }
};

// 源特定配置 - 根据实际搜索验证
export const SOURCE_SPECIFIC_CONFIG = {
    javbus: {
        baseUrls: ['https://www.javbus.com', 'https://javbus.com'],
        searchPath: '/search/',
        detailPattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
        requiresCode: true,
        supportSubdomains: true
    },
    javdb: {
        baseUrls: ['https://javdb.com'],
        searchPath: '/search',
        detailPattern: /\/v\/[a-zA-Z0-9]+/,
        requiresCode: false,
        supportSubdomains: false
    },
    jable: {
        baseUrls: ['https://jable.tv'],
        searchPath: '/search/',
        detailPattern: /\/videos\/[^\/\?]+/,
        requiresCode: false,
        supportSubdomains: false,
        strictDomain: true  // Jable需要严格域名检查
    },
    javmost: {
        baseUrls: ['https://javmost.com', 'https://www5.javmost.com'],
        searchPath: '/search/',
        detailPattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
        requiresCode: true,
        supportSubdomains: true  // 重要：JavMost有多个子域名
    },
    javgg: {
        baseUrls: ['https://javgg.net'],
        searchPath: '/search/',
        detailPattern: /\/jav\/[a-z0-9\-]+/i,
        requiresCode: true,
        supportSubdomains: true
    },
    sukebei: {
        baseUrls: ['https://sukebei.nyaa.si'],
        searchPath: '/',
        detailPattern: /\/view\/\d+/,
        requiresCode: false,
        supportSubdomains: false
    },
    javguru: {
        baseUrls: ['https://jav.guru'],
        searchPath: '/',
        detailPattern: /\/\d+\/[a-z0-9\-]+/i,
        requiresCode: false,
        supportSubdomains: true
    }
};