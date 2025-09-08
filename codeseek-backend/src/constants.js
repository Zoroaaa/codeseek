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
        MAX_CONCURRENT_EXTRACTIONS: 3,
        MAX_RETRY_ATTEMPTS: 2,
        RETRY_DELAY: 1000,
        SUPPORTED_SOURCES: [
            'javbus', 'javdb', 'javlibrary', 'jable', 'javmost', 
            'missav', 'javhdporn', 'javgg', 'av01', 'sukebei'
        ]
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
    }
};