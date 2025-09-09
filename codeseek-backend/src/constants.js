// src/constants.js - 应用常量和配置（集成详情提取）
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
        MAX_GENERIC_LINKS_PER_PAGE: 200, // 每页最大通用链接数
        
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

// 支持的源类型和对应的解析器
export const SUPPORTED_SOURCE_TYPES = {
    javbus: 'javbus',
    javdb: 'javdb', 
    javlibrary: 'javlibrary',
    jable: 'jable',
    javmost: 'javmost',
    missav: 'missav',
    javhdporn: 'javhdporn',
    javgg: 'javgg',
    av01: 'av01',
    sukebei: 'sukebei',
    generic: 'generic'
};

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