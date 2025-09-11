// src/constants.js - 优化版本：只保留系统级别的不可变配置
export const CONFIG = {
    // 系统级别的最大限制（安全相关，不可修改）
    MAX_TAGS_PER_USER: 50,
    MAX_SHARES_PER_USER: 50,
    MAX_FAVORITES_PER_USER: 1000,
    MAX_HISTORY_PER_USER: 1000,
    
    // 详情提取系统级别配置（技术限制，不可修改）
    DETAIL_EXTRACTION: {
        // 系统技术限制
        MAX_BATCH_SIZE: 20,
        MIN_BATCH_SIZE: 1,
        MAX_TIMEOUT: 30000,
        MIN_TIMEOUT: 5000,
        MAX_CACHE_DURATION: 604800000, // 7天
        MIN_CACHE_DURATION: 3600000, // 1小时
        MAX_CONCURRENT_EXTRACTIONS: 4,
        
        // 性能和安全限制
        PARSE_TIMEOUT: 10000,
        MAX_RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000,
        
        // 缓存系统限制
        CACHE_MAX_SIZE: 1000,
        CACHE_CLEANUP_INTERVAL: 3600000, // 1小时
        HTML_PARSER_CACHE_SIZE: 100,
        
        // 内容数量限制（防止过载）
        MAX_GENERIC_LINKS_PER_PAGE: 150,
        MAX_DOWNLOAD_LINKS: 15,
        MAX_MAGNET_LINKS: 15,
        MAX_SCREENSHOTS: 20,
    },
    
    // 系统行为枚举（不可变）
    ALLOWED_ACTIONS: [
        'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
        'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
        'sync_data', 'page_view', 'session_start', 'session_end',
        'custom_source_add', 'custom_source_edit', 'custom_source_delete',
        'tag_created', 'tag_updated', 'tag_deleted',
        'detail_extraction', 'batch_detail_extraction', 'detail_cache_access',
        'detail_config_update', 'detail_cache_clear', 'detail_retry',
        'download_click', 'magnet_click', 'copy_magnet', 'image_preview'
    ]
};

// 详情提取状态枚举（系统级别，不可变）
export const DETAIL_EXTRACTION_STATUS = {
    SUCCESS: 'success',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    CACHED: 'cached',
    PARTIAL: 'partial'
};

// 系统级别的验证规则（技术限制）
export const SYSTEM_VALIDATION = {
    extractionTimeout: {
        min: CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT,
        max: CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT
    },
    cacheDuration: {
        min: CONFIG.DETAIL_EXTRACTION.MIN_CACHE_DURATION,
        max: CONFIG.DETAIL_EXTRACTION.MAX_CACHE_DURATION
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

// 固定的系统配置（不变的业务逻辑）
export const VALID_CATEGORIES = ['jav', 'movie', 'torrent', 'other'];
export const VALID_SORT_COLUMNS = ['created_at', 'updated_at', 'rating_score', 'download_count', 'like_count', 'view_count'];

// 支持的源类型（系统级别）
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

// 源域名模式（技术限制，不可变）
export const SOURCE_DOMAIN_PATTERNS = {
    javbus: [/^.*\.javbus\.com$/, /^javbus\.com$/],
    javdb: [/^.*\.javdb\.com$/, /^javdb\.com$/],
    jable: [/^.*\.jable\.tv$/, /^jable\.tv$/],
    javmost: [/^.*\.javmost\.com$/, /^javmost\.com$/],
    javgg: [/^.*\.javgg\.net$/, /^javgg\.net$/],
    sukebei: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/],
    javguru: [/^.*\.jav\.guru$/, /^jav\.guru$/]
};

// 详情页URL模式（技术限制，不可变）
export const DETAIL_URL_PATTERNS = {
    javbus: [/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i],
    javdb: [/\/v\/[a-zA-Z0-9]+/],
    jable: [/\/videos\/[^\/\?]+/],
    javmost: [/\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i],
    javgg: [/\/jav\/[a-z0-9\-]+/i],
    sukebei: [/\/view\/\d+/],
    javguru: [/\/\d+\/[a-z0-9\-]+/i]
};

// 搜索页面排除模式（技术限制，不可变）
export const SEARCH_EXCLUDE_PATTERNS = [
    '/search/', '/search?', '?q=', '?s=', '?query=', '?keyword=',
    '/page/', '/list/', '/category/', '/genre/', '/actresses/',
    '/studio/', '/label/', '/uncensored/', '/forum/', '/doc/',
    '/terms', '/privacy', '/login', '/register', '/user/', '/profile/',
    '/settings/', '/en/', '/ja/', '/ko/', '/#', '.css', '.js', '.png',
    '.jpg', '.gif', '.ico', 'javascript:', '/rss', '/sitemap', '/api/',
    '/ajax/', '/admin/'
];

// 垃圾域名黑名单（安全相关，不可变）
export const SPAM_DOMAINS = [
    'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
    'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
    'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
    'mnaspm.com', 'asacp.org', 'pr0rze.vip', 'go.mnaspm.com'
];

// 导航文本过滤列表（技术限制，不可变）
export const NAVIGATION_TEXTS = [
    'english', '中文', '日本語', '한국어', '有碼', '無碼', '女優', '類別',
    '論壇', '下一页', '上一页', '首页', 'terms', 'privacy', '登入', '高清',
    '字幕', '欧美', 'rta', '2257', 'next', 'prev', 'page', 'home', 'forum',
    'contact', 'about', 'help', 'faq', 'support', '帮助', '联系', '关于',
    'login', 'register', '注册', '登录', 'agent_code'
];

// 番号正则表达式模式（技术限制，不可变）
export const CODE_PATTERNS = {
    standard: /([A-Z]{2,6}-\d{3,6})/i,
    noDash: /([A-Z]{2,6}\d{3,6})/i,
    reverse: /(\d{3,6}[A-Z]{2,6})/i,
    combined: /([A-Z]{2,6}-?\d{3,6})/i
};

// URL标准化配置（技术限制，不可变）
export const URL_NORMALIZATION = {
    removeParams: ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'source'],
    keepParams: {
        javdb: ['q', 'f'],
        sukebei: ['q', 'c'],
        javguru: ['s'],
        generic: ['q', 's', 'search', 'query']
    }
};

// 源特定配置（技术限制，不可变）
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
        strictDomain: true
    },
    javmost: {
        baseUrls: ['https://javmost.com', 'https://www5.javmost.com'],
        searchPath: '/search/',
        detailPattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
        requiresCode: true,
        supportSubdomains: true
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