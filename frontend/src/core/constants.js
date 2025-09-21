// src/core/constants.js - 优化版本：增强验证规则，完善搜索源管理配置
export const APP_CONSTANTS = {
  // 应用信息
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '2.3.1', // 版本升级，完成前后端匹配优化
  
  // 本地存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    SOURCE_STATUS_CACHE: 'source_status_cache',
    // 详情提取相关缓存
    DETAIL_EXTRACTION_CACHE: 'detail_extraction_cache',
    DETAIL_CONFIG_CACHE: 'detail_config_cache',
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats',
    DETAIL_USER_PREFERENCES: 'detail_user_preferences'
  },
  
  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
    // 详情提取API配置
    DETAIL_EXTRACTION_TIMEOUT: 15000,
    DETAIL_CACHE_DURATION: 86400000,
    DETAIL_BATCH_SIZE: 20,
    DETAIL_MAX_CONCURRENT: 3,
    DETAIL_HEALTH_CHECK_INTERVAL: 300000,
    DETAIL_RETRY_DELAY: 1000,
    DETAIL_PROGRESS_UPDATE_INTERVAL: 1000,
    // 搜索源管理API端点
    SEARCH_SOURCES: {
      MAJOR_CATEGORIES: '/api/search-sources/major-categories',
      CATEGORIES: '/api/search-sources/categories', 
      SOURCES: '/api/search-sources/sources',
      USER_CONFIGS: '/api/search-sources/user-configs',
      STATS: '/api/search-sources/stats',
      EXPORT: '/api/search-sources/export'
    }
  },

  // 网站类型定义
  SITE_TYPES: {
    SEARCH: 'search',       // 真正的搜索源（需要关键词）
    BROWSE: 'browse',       // 浏览型网站（不需要关键词）  
    REFERENCE: 'reference'  // 参考资料站（可选关键词）
  },
  
  // 用户限制
  LIMITS: {
    MAX_FAVORITES: 1000,
    MAX_HISTORY: 1000,
    MAX_CUSTOM_SOURCES: 100,
    MAX_CUSTOM_CATEGORIES: 20,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 6,
    MAX_SEARCH_KEYWORD_LENGTH: 100,
    MIN_SEARCH_KEYWORD_LENGTH: 2,
    MAX_SOURCE_NAME_LENGTH: 50,
    MAX_SOURCE_SUBTITLE_LENGTH: 100,
    MAX_CATEGORY_NAME_LENGTH: 30,
    MAX_CATEGORY_DESC_LENGTH: 100,
    MIN_SOURCE_CHECK_TIMEOUT: 1000,
    MAX_SOURCE_CHECK_TIMEOUT: 30000,
    MIN_STATUS_CACHE_DURATION: 60000,
    MAX_STATUS_CACHE_DURATION: 3600000,
    // 详情提取限制
    MAX_DETAIL_EXTRACTIONS_PER_BATCH: 20,
    MIN_DETAIL_EXTRACTION_TIMEOUT: 5000,
    MAX_DETAIL_EXTRACTION_TIMEOUT: 30000,
    MIN_DETAIL_CACHE_DURATION: 3600000,
    MAX_DETAIL_CACHE_DURATION: 604800000,
    MAX_AUTO_EXTRACTIONS: 10,
    MAX_DOWNLOAD_LINKS: 15,
    MAX_MAGNET_LINKS: 15,
    MAX_SCREENSHOTS: 20,
    MAX_CONTENT_FILTER_KEYWORDS: 50,
    MAX_DETAIL_CARD_CACHE_SIZE: 100,
    MIN_QUALITY_SCORE: 0,
    MAX_QUALITY_SCORE: 100
  },
  
  // 主题选项
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },
  
  // 连接状态
  CONNECTION_STATUS: {
    CHECKING: 'checking',
    CONNECTED: 'connected',
    WARNING: 'warning',
    ERROR: 'error'
  },
  
  // 搜索源状态枚举
  SOURCE_STATUS: {
    UNKNOWN: 'unknown',
    CHECKING: 'checking',
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    TIMEOUT: 'timeout',
    ERROR: 'error'
  },

  // 详情提取状态枚举
  DETAIL_EXTRACTION_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    SUCCESS: 'success',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    CACHED: 'cached',
    PARTIAL: 'partial',
    FILTERED: 'filtered',
    CANCELLED: 'cancelled',
    RATE_LIMITED: 'rate_limited'
  },

  // 详情提取质量等级
  DETAIL_QUALITY_LEVELS: {
    EXCELLENT: { min: 80, label: '优秀', color: '#10b981', icon: '⭐' },
    GOOD: { min: 60, label: '良好', color: '#3b82f6', icon: '✅' },
    FAIR: { min: 40, label: '一般', color: '#f59e0b', icon: '⚠️' },
    POOR: { min: 0, label: '较差', color: '#ef4444', icon: '❌' }
  },

  // 支持详情提取的搜索源
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'jable', 'javmost', 
    'javgg',  'sukebei','javguru'
  ],

  // 详情提取源能力映射
  DETAIL_EXTRACTION_CAPABILITIES: {
    'javbus': {
      screenshots: true,
      downloadLinks: true,
      magnetLinks: true,
      actresses: true,
      metadata: true,
      description: true,
      rating: true,
      tags: true,
      quality: 'excellent'
    },
    'javdb': {
      screenshots: true,
      downloadLinks: false,
      magnetLinks: true,
      actresses: true,
      metadata: true,
      description: true,
      rating: true,
      tags: true,
      quality: 'good'
    },
    'jable': {
      screenshots: true,
      downloadLinks: true,
      magnetLinks: false,
      actresses: true,
      metadata: true,
      description: true,
      rating: false,
      tags: true,
      quality: 'good'
    },
    'javmost': {
      screenshots: true,
      downloadLinks: true,
      magnetLinks: true,
      actresses: true,
      metadata: true,
      description: true,
      rating: false,
      tags: false,
      quality: 'fair'
    },
    'sukebei': {
      screenshots: false,
      downloadLinks: true,
      magnetLinks: true,
      actresses: false,
      metadata: true,
      description: true,
      rating: false,
      tags: true,
      quality: 'fair'
    }
  },

  // 搜索源和分类验证规则 - 增强版本
  VALIDATION_RULES: {
    SOURCE: {
      REQUIRED_FIELDS: ['name', 'urlTemplate', 'categoryId'],
      URL_PATTERN: /^https?:\/\/.+/, // 基础URL验证
      SEARCH_URL_PATTERN: /^https?:\/\/.+\{keyword\}.*/, // 搜索源URL验证
      NAME_PATTERN: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.()（）]+$/,
      ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
      FORBIDDEN_DOMAINS: [
        'localhost', '127.0.0.1', '0.0.0.0',
        'file://', 'javascript:', 'data:', 'vbscript:'
      ],
      // 新增：更详细的验证规则
      HOMEPAGE_URL_PATTERN: /^https?:\/\/.+/,
      SUBTITLE_MAX_LENGTH: 100,
      DESCRIPTION_MAX_LENGTH: 200,
      PRIORITY_RANGE: { min: 1, max: 10 },
      SUPPORTED_SITE_TYPES: ['search', 'browse', 'reference'],
      SUPPORTED_EXTRACTION_QUALITIES: ['excellent', 'good', 'fair', 'poor', 'none']
    },
    CATEGORY: {
      REQUIRED_FIELDS: ['name', 'icon', 'majorCategoryId'],
      NAME_PATTERN: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.()（）]+$/,
      ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
      ICON_PATTERN: /^[\u{1F000}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u,
      COLOR_PATTERN: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      // 新增：分类特定验证
      DESCRIPTION_MAX_LENGTH: 100,
      PRIORITY_RANGE: { min: 1, max: 10 },
      SUPPORTED_SITE_TYPES: ['search', 'browse', 'reference'],
      SUPPORTED_EXTRACTION_PRIORITIES: ['high', 'medium', 'low', 'none']
    },
    MAJOR_CATEGORY: {
      REQUIRED_FIELDS: ['name', 'icon'],
      NAME_PATTERN: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.()（）]+$/,
      ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
      ICON_PATTERN: /^[\u{1F000}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u,
      COLOR_PATTERN: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
      // 新增：大类特定验证
      DESCRIPTION_MAX_LENGTH: 100
    },
    USER_CONFIG: {
      PRIORITY_RANGE: { min: 1, max: 10 },
      CUSTOM_NAME_MAX_LENGTH: 50,
      CUSTOM_SUBTITLE_MAX_LENGTH: 100,
      NOTES_MAX_LENGTH: 500,
      ICON_PATTERN: /^[\u{1F000}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u
    },
    DETAIL_EXTRACTION: {
      MIN_TITLE_LENGTH: 2,
      MAX_TITLE_LENGTH: 200,
      MIN_DESCRIPTION_LENGTH: 10,
      MAX_DESCRIPTION_LENGTH: 2000,
      MAX_TAG_COUNT: 20,
      MAX_TAG_LENGTH: 30,
      SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      SUPPORTED_URL_PROTOCOLS: ['http', 'https'],
      MAGNET_LINK_PATTERN: /^magnet:\?xt=urn:btih:[a-fA-F0-9]{32,40}.*$/,
      TORRENT_FILE_PATTERN: /^https?:\/\/.+\.torrent$/
    }
  },
  
  // 默认颜色选项
  DEFAULT_COLORS: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308'
  ],
  
  // 默认图标选项
  DEFAULT_ICONS: [
    '📚', '🎥', '🧲', '💬', '🌟', '🔍', '📺', '🎬',
    '🎭', '🎪', '🎦', '🎬', '⚡', '💫', '🌙', '🔗',
    '🐱', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲'
  ],
  
  // 权限定义
  PERMISSIONS: {
    SEARCH: 'search',
    FAVORITE: 'favorite',
    HISTORY: 'history',
    SYNC: 'sync',
    CUSTOM_SOURCES: 'custom_sources',
    CUSTOM_CATEGORIES: 'custom_categories',
    SEARCH_SOURCE_MANAGEMENT: 'search_source_management',
    ADMIN: 'admin',
    PREMIUM: 'premium',
    // 详情提取权限
    DETAIL_EXTRACTION: 'detail_extraction',
    DETAIL_EXTRACTION_BATCH: 'detail_extraction_batch',
    DETAIL_EXTRACTION_HISTORY: 'detail_extraction_history',
    DETAIL_EXTRACTION_CACHE_MANAGEMENT: 'detail_extraction_cache_management',
    DETAIL_EXTRACTION_CONFIG: 'detail_extraction_config',
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats'
  },
  
  // 用户行为追踪事件
  ANALYTICS_EVENTS: {
    SEARCH_PERFORMED: 'search_performed',
    RESULT_CLICKED: 'result_clicked',
    FAVORITE_ADDED: 'favorite_added',
    FAVORITE_REMOVED: 'favorite_removed',
    SETTINGS_UPDATED: 'settings_updated',
    DATA_EXPORTED: 'data_exported',
    HISTORY_CLEARED: 'history_cleared',
    SOURCE_STATUS_CHECK_STARTED: 'source_status_check_started',
    SOURCE_STATUS_CHECK_COMPLETED: 'source_status_check_completed',
    SOURCE_STATUS_CHECK_FAILED: 'source_status_check_failed',
    
    // 搜索源管理相关事件
    MAJOR_CATEGORY_CREATED: 'major_category_created',
    MAJOR_CATEGORY_UPDATED: 'major_category_updated',
    MAJOR_CATEGORY_DELETED: 'major_category_deleted',
    SOURCE_CATEGORY_CREATED: 'source_category_created',
    SOURCE_CATEGORY_UPDATED: 'source_category_updated',
    SOURCE_CATEGORY_DELETED: 'source_category_deleted',
    CUSTOM_SOURCE_ADDED: 'custom_source_added',
    CUSTOM_SOURCE_EDITED: 'custom_source_edited',
    CUSTOM_SOURCE_DELETED: 'custom_source_deleted',
    USER_SOURCE_CONFIG_UPDATED: 'user_source_config_updated',
    SEARCH_SOURCES_EXPORTED: 'search_sources_exported',
    
    // 详情提取相关事件
    DETAIL_EXTRACTION_STARTED: 'detail_extraction_started',
    DETAIL_EXTRACTION_COMPLETED: 'detail_extraction_completed',
    DETAIL_EXTRACTION_FAILED: 'detail_extraction_failed',
    DETAIL_BATCH_EXTRACTION_STARTED: 'detail_batch_extraction_started',
    DETAIL_BATCH_EXTRACTION_COMPLETED: 'detail_batch_extraction_completed',
    DETAIL_CACHE_HIT: 'detail_cache_hit',
    DETAIL_CACHE_CLEARED: 'detail_cache_cleared',
    DOWNLOAD_LINK_CLICKED: 'download_link_clicked',
    MAGNET_LINK_COPIED: 'magnet_link_copied',
    IMAGE_PREVIEW_OPENED: 'image_preview_opened',
    SCREENSHOT_DOWNLOADED: 'screenshot_downloaded',
    ACTRESS_SEARCHED: 'actress_searched',
    TAG_SEARCHED: 'tag_searched',
    DETAIL_CARD_SHARED: 'detail_card_shared',
    DETAIL_EXPORTED: 'detail_exported',
    ISSUE_REPORTED: 'issue_reported',
    DETAIL_QUALITY_RATED: 'detail_quality_rated',
    DETAIL_CONFIG_UPDATED: 'detail_config_updated',
    DETAIL_CONFIG_RESET: 'detail_config_reset',
    DETAIL_CONFIG_PRESET_APPLIED: 'detail_config_preset_applied'
  },
  
  // 错误代码定义
  ERROR_CODES: {
    // 搜索源管理错误代码
    INVALID_MAJOR_CATEGORY: 'INVALID_MAJOR_CATEGORY',
    INVALID_SEARCH_SOURCE: 'INVALID_SEARCH_SOURCE',
    INVALID_SOURCE_CATEGORY: 'INVALID_SOURCE_CATEGORY',
    MAX_CUSTOM_SOURCES_REACHED: 'MAX_CUSTOM_SOURCES_REACHED',
    MAX_CUSTOM_CATEGORIES_REACHED: 'MAX_CUSTOM_CATEGORIES_REACHED',
    DUPLICATE_SOURCE_ID: 'DUPLICATE_SOURCE_ID',
    DUPLICATE_SOURCE_NAME: 'DUPLICATE_SOURCE_NAME',
    DUPLICATE_CATEGORY_ID: 'DUPLICATE_CATEGORY_ID',
    DUPLICATE_CATEGORY_NAME: 'DUPLICATE_CATEGORY_NAME',
    DUPLICATE_MAJOR_CATEGORY_NAME: 'DUPLICATE_MAJOR_CATEGORY_NAME',
    INVALID_URL_TEMPLATE: 'INVALID_URL_TEMPLATE',
    FORBIDDEN_DOMAIN: 'FORBIDDEN_DOMAIN',
    SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
    CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
    MAJOR_CATEGORY_NOT_FOUND: 'MAJOR_CATEGORY_NOT_FOUND',
    CATEGORY_IN_USE: 'CATEGORY_IN_USE',
    MAJOR_CATEGORY_IN_USE: 'MAJOR_CATEGORY_IN_USE',
    SOURCE_STATUS_CHECK_TIMEOUT: 'SOURCE_STATUS_CHECK_TIMEOUT',
    SOURCE_STATUS_CHECK_ERROR: 'SOURCE_STATUS_CHECK_ERROR',
    SOURCE_STATUS_CACHE_EXPIRED: 'SOURCE_STATUS_CACHE_EXPIRED',
    
    // 详情提取错误代码 
    DETAIL_EXTRACTION_TIMEOUT: 'DETAIL_EXTRACTION_TIMEOUT',
    DETAIL_EXTRACTION_ERROR: 'DETAIL_EXTRACTION_ERROR',
    DETAIL_EXTRACTION_UNSUPPORTED_SOURCE: 'DETAIL_EXTRACTION_UNSUPPORTED_SOURCE',
    DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED: 'DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED',
    DETAIL_EXTRACTION_PERMISSION_DENIED: 'DETAIL_EXTRACTION_PERMISSION_DENIED',
    DETAIL_CACHE_ERROR: 'DETAIL_CACHE_ERROR',
    DETAIL_VALIDATION_ERROR: 'DETAIL_VALIDATION_ERROR',
    DETAIL_PARSING_ERROR: 'DETAIL_PARSING_ERROR',
    DETAIL_NETWORK_ERROR: 'DETAIL_NETWORK_ERROR',
    DETAIL_RATE_LIMIT_EXCEEDED: 'DETAIL_RATE_LIMIT_EXCEEDED',
    DETAIL_CONTENT_FILTERED: 'DETAIL_CONTENT_FILTERED',
    DETAIL_SERVICE_UNAVAILABLE: 'DETAIL_SERVICE_UNAVAILABLE',
    DETAIL_CONCURRENT_LIMIT_EXCEEDED: 'DETAIL_CONCURRENT_LIMIT_EXCEEDED',
    DETAIL_CONFIG_VALIDATION_ERROR: 'DETAIL_CONFIG_VALIDATION_ERROR',
    DETAIL_CONFIG_SAVE_ERROR: 'DETAIL_CONFIG_SAVE_ERROR',
    DETAIL_CONFIG_LOAD_ERROR: 'DETAIL_CONFIG_LOAD_ERROR',
    DETAIL_CONFIG_PRESET_NOT_FOUND: 'DETAIL_CONFIG_PRESET_NOT_FOUND'
  },
  
  // 默认用户设置
  DEFAULT_USER_SETTINGS: {
    theme: 'auto',
    maxFavoritesPerUser: 1000,
    maxHistoryPerUser: 1000,
    allowAnalytics: true,
    searchSuggestions: true,
    autoSync: true,
    cacheResults: true,
    checkSourceStatus: false,
    sourceStatusCheckTimeout: 8000,
    sourceStatusCacheDuration: 300000,
    skipUnavailableSources: true,
    showSourceStatus: true,
    retryFailedSources: false
  },
  
  // 搜索源管理相关常量
  SOURCE_MANAGEMENT: {
    DEFAULT_CATEGORY: 'others',
    SORT_OPTIONS: {
      NAME_ASC: 'name_asc',
      NAME_DESC: 'name_desc',
      CATEGORY: 'category',
      MAJOR_CATEGORY: 'major_category',
      PRIORITY: 'priority',
      CREATED_DATE: 'created_date',
      STATUS: 'status',
      DETAIL_SUPPORT: 'detail_support',
      EXTRACTION_QUALITY: 'extraction_quality',
      AVERAGE_TIME: 'average_time',
      SITE_TYPE: 'site_type',
      SEARCHABLE: 'searchable'
    },
    FILTER_OPTIONS: {
      ALL: 'all',
      BUILTIN: 'builtin',
      CUSTOM: 'custom',
      ENABLED: 'enabled',
      DISABLED: 'disabled',
      AVAILABLE: 'available',
      UNAVAILABLE: 'unavailable',
      SUPPORTS_DETAIL: 'supports_detail',
      NO_DETAIL: 'no_detail',
      HIGH_QUALITY: 'high_quality',
      FAST_EXTRACTION: 'fast_extraction',
      SEARCHABLE: 'searchable',
      BROWSE_ONLY: 'browse_only',
      SEARCH_SOURCES: 'search_sources',
      BROWSE_SITES: 'browse_sites'
    }
  },

  // 搜索源状态检查配置
  SOURCE_STATUS_CHECK: {
    DEFAULT_TIMEOUT: 8000,
    MIN_TIMEOUT: 1000,
    MAX_TIMEOUT: 30000,
    DEFAULT_CACHE_DURATION: 300000,
    MIN_CACHE_DURATION: 60000,
    MAX_CACHE_DURATION: 3600000,
    CONCURRENT_CHECKS: 3,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000,
    HTTP_METHOD: 'HEAD',
    FOLLOW_REDIRECTS: true,
    USER_AGENT: 'MagnetSearch/2.3.1 StatusChecker'
  },

  // 详情提取配置
  DETAIL_EXTRACTION_CONFIG: {
    // 系统级技术限制
    DEFAULT_TIMEOUT: 15000,
    MIN_TIMEOUT: 5000,
    MAX_TIMEOUT: 30000,
    DEFAULT_CACHE_DURATION: 86400000,
    MIN_CACHE_DURATION: 3600000,
    MAX_CACHE_DURATION: 604800000,
    DEFAULT_BATCH_SIZE: 3,
    MAX_BATCH_SIZE: 20,
    MAX_CONCURRENT_EXTRACTIONS: 4,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000,
    
    // 系统级功能配置
    ENABLE_CACHE: true,
    ENABLE_PROGRESS: true,
    
    // 内容类型检测
    CONTENT_TYPES: {
      TORRENT: 'torrent',
      DOWNLOAD: 'download', 
      VIDEO: 'video',
      MEDIA: 'media',
      BASIC: 'basic',
      UNKNOWN: 'unknown'
    },
    
    // 支持的格式
    SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'],
    SUPPORTED_DOWNLOAD_TYPES: ['http', 'https', 'ftp', 'magnet', 'ed2k'],
    
    // 质量评分权重
    QUALITY_WEIGHTS: {
      RESPONSE_TIME: 0.2,
      CONTENT_COMPLETENESS: 0.4,
      IMAGE_QUALITY: 0.2,
      METADATA_RICHNESS: 0.1,
      DATA_ACCURACY: 0.1
    },
    
    // 提取优先级定义
    EXTRACTION_PRIORITIES: {
      HIGH: { weight: 1.0, timeout: 15000, retries: 3 },
      MEDIUM: { weight: 0.7, timeout: 12000, retries: 2 },
      LOW: { weight: 0.5, timeout: 10000, retries: 1 },
      NONE: { weight: 0.0, timeout: 0, retries: 0 }
    },
    
    // 内容验证规则（系统级）
    VALIDATION_RULES: {
      MIN_TITLE_LENGTH: 2,
      MAX_TITLE_LENGTH: 200,
      MIN_DESCRIPTION_LENGTH: 5,
      MAX_DESCRIPTION_LENGTH: 2000,
      MAX_SCREENSHOTS: 15,
      MAX_DOWNLOAD_LINKS: 10,
      MAX_MAGNET_LINKS: 10,
      MAX_TAGS: 20,
      MAX_ACTRESSES: 20,
      REQUIRED_FIELDS: ['title', 'extractionStatus'],
      OPTIONAL_FIELDS: ['code', 'description', 'screenshots', 'downloadLinks', 'magnetLinks', 'actresses']
    },
    
    // 性能优化设置（系统级）
    PERFORMANCE: {
      PREFETCH_ENABLED: false,
      LAZY_LOADING: true,
      IMAGE_COMPRESSION: true,
      CACHE_PRELOAD: false,
      BACKGROUND_PROCESSING: false,
      QUEUE_PROCESSING: true,
      MEMORY_OPTIMIZATION: true
    },
    
    // 错误处理配置（系统级）
    ERROR_HANDLING: {
      CONTINUE_ON_ERROR: true,
      LOG_ERRORS: true,
      RETRY_ON_TIMEOUT: true,
      RETRY_ON_NETWORK_ERROR: true,
      FAIL_FAST: false,
      ERROR_THRESHOLD: 0.3
    }
  },

  // UI配置常量
  UI_CONFIG: {
    DETAIL_CARD: {
      ANIMATION_DURATION: 300,
      MAX_TITLE_LENGTH: 100,
      MAX_DESCRIPTION_LENGTH: 500,
      THUMBNAIL_SIZE: { width: 240, height: 320 },
      SCREENSHOT_GRID_COLUMNS: 'auto-fit',
      SCREENSHOT_MIN_WIDTH: 200,
      LAZY_LOAD_THRESHOLD: 100,
      AUTO_HIDE_PROGRESS: 3000
    },
    
    PROGRESS_INDICATOR: {
      UPDATE_INTERVAL: 1000,
      SHOW_PERCENTAGE: true,
      SHOW_TIME_REMAINING: true,
      SHOW_SPEED: false,
      AUTO_HIDE_DELAY: 5000
    },
    
    NOTIFICATIONS: {
      SUCCESS_DURATION: 3000,
      ERROR_DURATION: 5000,
      WARNING_DURATION: 4000,
      INFO_DURATION: 3000,
      MAX_NOTIFICATIONS: 5
    },
    
    BREAKPOINTS: {
      MOBILE: 480,
      TABLET: 768,
      DESKTOP: 1024,
      LARGE: 1200
    }
  },

  // 缓存策略配置
  CACHE_STRATEGY: {
    LOCAL_CACHE: {
      MAX_SIZE: 100,
      TTL: 1800000,
      CLEANUP_INTERVAL: 300000,
      STORAGE_KEY: 'magnet_search_cache'
    },
    
    REMOTE_CACHE: {
      TTL: 86400000,
      MAX_SIZE: 1000,
      COMPRESSION: true,
      VERSIONING: true
    },
    
    IMAGE_CACHE: {
      TTL: 604800000,
      MAX_SIZE: 500,
      COMPRESSION_QUALITY: 0.8,
      THUMBNAIL_GENERATION: true
    }
  },

  // 性能监控配置
  PERFORMANCE_MONITORING: {
    ENABLED: true,
    METRICS: {
      RENDER_TIME: true,
      EXTRACTION_TIME: true,
      NETWORK_TIME: true,
      MEMORY_USAGE: true,
      ERROR_RATE: true
    },
    SAMPLING_RATE: 0.1,
    BATCH_SIZE: 100,
    FLUSH_INTERVAL: 300000
  },

  // 详情提取配置API端点
  DETAIL_CONFIG_ENDPOINTS: {
    GET_CONFIG: '/api/detail/config',
    UPDATE_CONFIG: '/api/detail/config',
    RESET_CONFIG: '/api/detail/config/reset',
    APPLY_PRESET: '/api/detail/config/preset'
  }
};

// 导出常用常量
export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const THEMES = APP_CONSTANTS.THEMES;
export const DETAIL_EXTRACTION_SOURCES = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES;
export const DETAIL_EXTRACTION_CAPABILITIES = APP_CONSTANTS.DETAIL_EXTRACTION_CAPABILITIES;
export const DETAIL_EXTRACTION_STATUS = APP_CONSTANTS.DETAIL_EXTRACTION_STATUS;
export const DETAIL_QUALITY_LEVELS = APP_CONSTANTS.DETAIL_QUALITY_LEVELS;
export const DEFAULT_USER_SETTINGS = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
export const PERMISSIONS = APP_CONSTANTS.PERMISSIONS;
export const ERROR_CODES = APP_CONSTANTS.ERROR_CODES;
export const ANALYTICS_EVENTS = APP_CONSTANTS.ANALYTICS_EVENTS;
export const VALIDATION_RULES = APP_CONSTANTS.VALIDATION_RULES;
export const SOURCE_MANAGEMENT = APP_CONSTANTS.SOURCE_MANAGEMENT;
export const DETAIL_EXTRACTION_CONFIG = APP_CONSTANTS.DETAIL_EXTRACTION_CONFIG;
export const SITE_TYPES = APP_CONSTANTS.SITE_TYPES;

// 工具函数
export function getStorageKey(key) {
  return STORAGE_KEYS[key] || key;
}

export function isDetailExtractionSupported(sourceId) {
  return DETAIL_EXTRACTION_SOURCES.includes(sourceId);
}

export function getDetailExtractionCapabilities(sourceId) {
  return DETAIL_EXTRACTION_CAPABILITIES[sourceId] || null;
}

// URL验证工具函数
export function validateSourceUrl(url, isSearchable) {
  const rules = VALIDATION_RULES.SOURCE;
  
  if (isSearchable) {
    // 搜索源必须包含{keyword}
    return rules.SEARCH_URL_PATTERN.test(url);
  } else {
    // 浏览站点只需要是有效URL
    return rules.URL_PATTERN.test(url);
  }
}

// 验证搜索源数据
export function validateSearchSourceData(data) {
  const errors = [];
  const rules = VALIDATION_RULES.SOURCE;
  
  // 验证必填字段
  for (const field of rules.REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim().length === 0)) {
      errors.push(`${field} 是必填字段`);
    }
  }
  
  // 验证名称格式
  if (data.name && !rules.NAME_PATTERN.test(data.name)) {
    errors.push('名称包含无效字符');
  }
  
  // 验证名称长度
  if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_SOURCE_NAME_LENGTH) {
    errors.push(`名称不能超过${APP_CONSTANTS.LIMITS.MAX_SOURCE_NAME_LENGTH}个字符`);
  }
  
  // 验证URL格式
  if (data.urlTemplate && !rules.URL_PATTERN.test(data.urlTemplate)) {
    errors.push('URL格式不正确');
  }
  
  // 验证搜索源URL
  if (data.searchable && data.urlTemplate && !rules.SEARCH_URL_PATTERN.test(data.urlTemplate)) {
    errors.push('搜索源的URL模板必须包含{keyword}占位符');
  }
  
  // 验证副标题长度
  if (data.subtitle && data.subtitle.length > rules.SUBTITLE_MAX_LENGTH) {
    errors.push(`副标题不能超过${rules.SUBTITLE_MAX_LENGTH}个字符`);
  }
  
  // 验证描述长度
  if (data.description && data.description.length > rules.DESCRIPTION_MAX_LENGTH) {
    errors.push(`描述不能超过${rules.DESCRIPTION_MAX_LENGTH}个字符`);
  }
  
  // 验证优先级范围
  if (data.searchPriority && (data.searchPriority < rules.PRIORITY_RANGE.min || data.searchPriority > rules.PRIORITY_RANGE.max)) {
    errors.push(`搜索优先级必须在${rules.PRIORITY_RANGE.min}-${rules.PRIORITY_RANGE.max}之间`);
  }
  
  // 验证网站类型
  if (data.siteType && !rules.SUPPORTED_SITE_TYPES.includes(data.siteType)) {
    errors.push(`网站类型必须是${rules.SUPPORTED_SITE_TYPES.join('、')}之一`);
  }
  
  // 验证提取质量
  if (data.extractionQuality && !rules.SUPPORTED_EXTRACTION_QUALITIES.includes(data.extractionQuality)) {
    errors.push(`提取质量必须是${rules.SUPPORTED_EXTRACTION_QUALITIES.join('、')}之一`);
  }
  
  // 验证禁用域名
  if (data.urlTemplate) {
    for (const forbidden of rules.FORBIDDEN_DOMAINS) {
      if (data.urlTemplate.includes(forbidden)) {
        errors.push(`URL不能包含禁用域名：${forbidden}`);
        break;
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 验证分类数据
export function validateCategoryData(data) {
  const errors = [];
  const rules = VALIDATION_RULES.CATEGORY;
  
  // 验证必填字段
  for (const field of rules.REQUIRED_FIELDS) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim().length === 0)) {
      errors.push(`${field} 是必填字段`);
    }
  }
  
  // 验证名称格式
  if (data.name && !rules.NAME_PATTERN.test(data.name)) {
    errors.push('名称包含无效字符');
  }
  
  // 验证名称长度
  if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH) {
    errors.push(`名称不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH}个字符`);
  }
  
  // 验证描述长度
  if (data.description && data.description.length > rules.DESCRIPTION_MAX_LENGTH) {
    errors.push(`描述不能超过${rules.DESCRIPTION_MAX_LENGTH}个字符`);
  }
  
  // 验证颜色格式
  if (data.color && !rules.COLOR_PATTERN.test(data.color)) {
    errors.push('颜色格式不正确');
  }
  
  // 验证优先级范围
  if (data.searchPriority && (data.searchPriority < rules.PRIORITY_RANGE.min || data.searchPriority > rules.PRIORITY_RANGE.max)) {
    errors.push(`搜索优先级必须在${rules.PRIORITY_RANGE.min}-${rules.PRIORITY_RANGE.max}之间`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 验证用户配置数据
export function validateUserConfigData(data) {
  const errors = [];
  const rules = VALIDATION_RULES.USER_CONFIG;
  
  if (!data.sourceId) {
    errors.push('搜索源ID是必填字段');
  }
  
  // 验证自定义优先级
  if (data.customPriority && (data.customPriority < rules.PRIORITY_RANGE.min || data.customPriority > rules.PRIORITY_RANGE.max)) {
    errors.push(`自定义优先级必须在${rules.PRIORITY_RANGE.min}-${rules.PRIORITY_RANGE.max}之间`);
  }
  
  // 验证自定义名称长度
  if (data.customName && data.customName.length > rules.CUSTOM_NAME_MAX_LENGTH) {
    errors.push(`自定义名称不能超过${rules.CUSTOM_NAME_MAX_LENGTH}个字符`);
  }
  
  // 验证自定义副标题长度
  if (data.customSubtitle && data.customSubtitle.length > rules.CUSTOM_SUBTITLE_MAX_LENGTH) {
    errors.push(`自定义副标题不能超过${rules.CUSTOM_SUBTITLE_MAX_LENGTH}个字符`);
  }
  
  // 验证备注长度
  if (data.notes && data.notes.length > rules.NOTES_MAX_LENGTH) {
    errors.push(`备注不能超过${rules.NOTES_MAX_LENGTH}个字符`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 详情提取配置相关工具函数
export function getDetailConfigEndpoint(endpoint) {
  return APP_CONSTANTS.DETAIL_CONFIG_ENDPOINTS[endpoint.toUpperCase()];
}

export function isDetailExtractionEnabled() {
  // 系统级默认可用，具体用户配置由 detail-config-api.js 管理
  return true;
}

// 向后兼容性检查函数
export function validateLegacySettings(settings) {
  const warnings = [];
  
  // 检查是否使用了已迁移的详情提取配置
  const detailConfigKeys = [
    'enableDetailExtraction', 'autoExtractDetails', 'detailExtractionTimeout',
    'detailCacheDuration', 'extractionBatchSize', 'maxRetryAttempts'
  ];
  
  detailConfigKeys.forEach(key => {
    if (settings.hasOwnProperty(key)) {
      warnings.push(`配置项 ${key} 已迁移至详情提取配置管理，请使用 DetailConfigAPI 进行管理`);
    }
  });

  // 检查是否使用了硬编码搜索源配置
  const sourceConfigKeys = [
    'searchSources', 'customSearchSources', 'customSourceCategories'
  ];
  
  sourceConfigKeys.forEach(key => {
    if (settings.hasOwnProperty(key)) {
      warnings.push(`配置项 ${key} 已迁移至搜索源管理API，请使用 SearchSourcesAPI 进行管理`);
    }
  });
  
  return warnings;
}

// 默认导出
export default APP_CONSTANTS;