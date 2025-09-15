// src/core/constants.js - 适配后端架构升级：移除详情提取硬编码配置，保持其他功能完整
// 详情提取配置已完全迁移至 detail-config.js，由 detail-config-api.js 动态管理

export const APP_CONSTANTS = {
  // 应用信息 - 保持不变
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '2.0.0', // 版本升级，适配新架构
  
  // 本地存储键名 - 保持不变
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    CUSTOM_SOURCES: 'custom_search_sources',
    CUSTOM_CATEGORIES: 'custom_source_categories',
    SOURCE_STATUS_CACHE: 'source_status_cache',
    // 详情提取相关缓存 - 仅保留必要的本地存储键
    DETAIL_CONFIG_CACHE: 'detail_config_cache_v2', // 版本升级
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats_v2' // 版本升级
  },
  
  // API配置 - 移除详情提取硬编码，保留系统级配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
    // 移除详情提取API硬编码配置，这些现在由后端DetailConfigService动态管理
  },
  
  // 用户限制 - 保持不变，详情提取限制已移至后端constants.js
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
    MAX_STATUS_CACHE_DURATION: 3600000
    // 移除详情提取相关限制，这些现在由后端CONFIG常量和SYSTEM_VALIDATION管理
  },
  
  // 主题选项 - 保持不变
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },
  
  // 连接状态 - 保持不变
  CONNECTION_STATUS: {
    CHECKING: 'checking',
    CONNECTED: 'connected',
    WARNING: 'warning',
    ERROR: 'error'
  },
  
  // 搜索源状态枚举 - 保持不变
  SOURCE_STATUS: {
    UNKNOWN: 'unknown',
    CHECKING: 'checking',
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    TIMEOUT: 'timeout',
    ERROR: 'error'
  },

  // 详情提取状态枚举 - 与后端DETAIL_EXTRACTION_STATUS完全同步
  DETAIL_EXTRACTION_STATUS: {
    SUCCESS: 'success',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    CACHED: 'cached',
    PARTIAL: 'partial'
  },

  // 支持详情提取的搜索源 - 与后端SUPPORTED_SOURCE_TYPES同步
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'jable', 'javmost', 
    'javgg', 'sukebei', 'javguru', 'generic'
  ],

  // 搜索源分类定义 - 保持不变，增强详情提取支持标识
  SOURCE_CATEGORIES: {
    database: {
      id: 'database',
      name: '📚 番号资料站',
      description: '提供详细的番号信息、封面和演员资料',
      icon: '📚',
      color: '#3b82f6',
      isBuiltin: true,
      order: 1,
      supportsDetailExtraction: true,
      extractionPriority: 'high'
    },
    streaming: {
      id: 'streaming',
      name: '🎥 在线播放平台',
      description: '提供在线观看和下载服务',
      icon: '🎥',
      color: '#10b981',
      isBuiltin: true,
      order: 2,
      supportsDetailExtraction: true,
      extractionPriority: 'medium'
    },
    torrent: {
      id: 'torrent',
      name: '🧲 磁力搜索',
      description: '提供磁力链接和种子文件',
      icon: '🧲',
      color: '#f59e0b',
      isBuiltin: true,
      order: 3,
      supportsDetailExtraction: true,
      extractionPriority: 'low'
    },
    community: {
      id: 'community',
      name: '💬 社区论坛',
      description: '用户交流讨论和资源分享',
      icon: '💬',
      color: '#8b5cf6',
      isBuiltin: true,
      order: 4,
      supportsDetailExtraction: false,
      extractionPriority: 'none'
    },
    others: {
      id: 'others',
      name: '🌟 其他资源',
      description: '其他类型的搜索资源',
      icon: '🌟',
      color: '#6b7280',
      isBuiltin: true,
      order: 99,
      supportsDetailExtraction: false,
      extractionPriority: 'none'
    }
  },
  
  // 搜索源 - 简化详情提取相关信息，详细配置由后端管理
  SEARCH_SOURCES: [
    // 番号资料站
    {
      id: 'javbus',
      name: 'JavBus',
      subtitle: '番号+磁力一体站，信息完善',
      icon: '🎬',
      urlTemplate: 'https://www.javbus.com/search/{keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: true // 简化标识，详细能力由后端管理
    },
    {
      id: 'javdb',
      name: 'JavDB',
      subtitle: '极简风格番号资料站，轻量快速',
      icon: '📚',
      urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
      category: 'database',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: true
    },
    {
      id: 'javlibrary',
      name: 'JavLibrary',
      subtitle: '评论活跃，女优搜索详尽',
      icon: '📖',
      urlTemplate: 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'javfinder',
      name: 'JavFinder',
      subtitle: '智能搜索引擎，结果精准',
      icon: '🔍',
      urlTemplate: 'https://javfinder.is/search/{keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: false
    },
    
    // 在线播放平台
    {
      id: 'jable',
      name: 'Jable',
      subtitle: '高清在线观看，支持多种格式',
      icon: '📺',
      urlTemplate: 'https://jable.tv/search/{keyword}/',
      category: 'streaming',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: true
    },
    {
      id: 'javmost',
      name: 'JavMost',
      subtitle: '免费在线观看，更新及时',
      icon: '🎦',
      urlTemplate: 'https://javmost.com/search/{keyword}/',
      category: 'streaming',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: true
    },
    {
      id: 'javguru',
      name: 'JavGuru',
      subtitle: '多线路播放，观看流畅',
      icon: '🎭',
      urlTemplate: 'https://jav.guru/?s={keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: true
    },
    {
      id: 'av01',
      name: 'AV01',
      subtitle: '快速预览站点，封面大图清晰',
      icon: '🎥',
      urlTemplate: 'https://av01.tv/search?keyword={keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'missav',
      name: 'MissAV',
      subtitle: '中文界面，封面高清，信息丰富',
      icon: '💫',
      urlTemplate: 'https://missav.com/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 5,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'javhdporn',
      name: 'JavHD.porn',
      subtitle: '高清资源下载，质量优秀',
      icon: '🎬',
      urlTemplate: 'https://javhd.porn/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 6,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'javgg',
      name: 'JavGG',
      subtitle: '免费观看平台，速度稳定',
      icon: '⚡',
      urlTemplate: 'https://javgg.net/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 7,
      isActive: true,
      supportsDetailExtraction: true
    },
    {
      id: 'javhihi',
      name: 'JavHiHi',
      subtitle: '在线播放，无需下载',
      icon: '🎪',
      urlTemplate: 'https://javhihi.com/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 8,
      isActive: true,
      supportsDetailExtraction: false
    },
    
    // 磁力搜索
    {
      id: 'btsow',
      name: 'BTSOW',
      subtitle: '中文磁力搜索引擎，番号资源丰富',
      icon: '🧲',
      urlTemplate: 'https://btsow.com/search/{keyword}',
      category: 'torrent',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'magnetdl',
      name: 'MagnetDL',
      subtitle: '磁力链接搜索，资源覆盖全面',
      icon: '🔗',
      urlTemplate: 'https://www.magnetdl.com/search/?q={keyword}',
      category: 'torrent',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'torrentkitty',
      name: 'TorrentKitty',
      subtitle: '种子搜索引擎，下载资源丰富',
      icon: '🐱',
      urlTemplate: 'https://www.torrentkitty.tv/search/{keyword}',
      category: 'torrent',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 'sukebei',
      name: 'Sukebei',
      subtitle: '成人内容种子站，资源全面',
      icon: '🌙',
      urlTemplate: 'https://sukebei.nyaa.si/?q={keyword}',
      category: 'torrent',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: true
    },
    
    // 社区论坛
    {
      id: 'sehuatang',
      name: '色花堂',
      subtitle: '综合论坛社区，资源丰富',
      icon: '🌸',
      urlTemplate: 'https://sehuatang.org/search.php?keyword={keyword}',
      category: 'community',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: false
    },
    {
      id: 't66y',
      name: 'T66Y',
      subtitle: '老牌论坛，资源更新快',
      icon: '📋',
      urlTemplate: 'https://t66y.com/search.php?keyword={keyword}',
      category: 'community',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: false
    }
  ],
  
  // 搜索源和分类验证规则 - 保持不变，移除详情提取相关验证
  VALIDATION_RULES: {
    SOURCE: {
      REQUIRED_FIELDS: ['name', 'urlTemplate', 'category'],
      URL_PATTERN: /^https?:\/\/.+\{keyword\}.*/,
      NAME_PATTERN: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.()（）]+$/,
      ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
      FORBIDDEN_DOMAINS: [
        'localhost', '127.0.0.1', '0.0.0.0',
        'file://', 'javascript:', 'data:', 'vbscript:'
      ]
    },
    CATEGORY: {
      REQUIRED_FIELDS: ['name', 'icon'],
      NAME_PATTERN: /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_.()（）]+$/,
      ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
      ICON_PATTERN: /^[\u{1F000}-\u{1F9FF}]|^[\u{2600}-\u{26FF}]|^[\u{2700}-\u{27BF}]/u,
      COLOR_PATTERN: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
    }
    // 移除DETAIL_EXTRACTION验证规则，这些现在由后端VALIDATION_RULES管理
  },
  
  // 默认颜色选项 - 保持不变
  DEFAULT_COLORS: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308'
  ],
  
  // 默认图标选项 - 保持不变
  DEFAULT_ICONS: [
    '📚', '🎥', '🧲', '💬', '🌟', '🔍', '📺', '🎬',
    '🎭', '🎪', '🎦', '🎬', '⚡', '💫', '🌙', '🔗',
    '🐱', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲'
  ],
  
  // 权限定义 - 保持不变
  PERMISSIONS: {
    SEARCH: 'search',
    FAVORITE: 'favorite',
    HISTORY: 'history',
    SYNC: 'sync',
    CUSTOM_SOURCES: 'custom_sources',
    CUSTOM_CATEGORIES: 'custom_categories',
    ADMIN: 'admin',
    PREMIUM: 'premium',
    // 详情提取权限 - 简化
    DETAIL_EXTRACTION: 'detail_extraction',
    DETAIL_EXTRACTION_CONFIG: 'detail_extraction_config'
  },
  
  // 用户行为追踪事件 - 保持不变，简化详情提取事件
  ANALYTICS_EVENTS: {
    SEARCH_PERFORMED: 'search_performed',
    RESULT_CLICKED: 'result_clicked',
    FAVORITE_ADDED: 'favorite_added',
    FAVORITE_REMOVED: 'favorite_removed',
    CUSTOM_SOURCE_ADDED: 'custom_source_added',
    CUSTOM_SOURCE_EDITED: 'custom_source_edited',
    CUSTOM_SOURCE_DELETED: 'custom_source_deleted',
    CUSTOM_CATEGORY_ADDED: 'custom_category_added',
    CUSTOM_CATEGORY_EDITED: 'custom_category_edited',
    CUSTOM_CATEGORY_DELETED: 'custom_category_deleted',
    SETTINGS_UPDATED: 'settings_updated',
    DATA_EXPORTED: 'data_exported',
    HISTORY_CLEARED: 'history_cleared',
    SOURCE_STATUS_CHECK_STARTED: 'source_status_check_started',
    SOURCE_STATUS_CHECK_COMPLETED: 'source_status_check_completed',
    SOURCE_STATUS_CHECK_FAILED: 'source_status_check_failed',
    
    // 详情提取相关事件 - 简化为核心事件
    DETAIL_EXTRACTION_STARTED: 'detail_extraction_started',
    DETAIL_EXTRACTION_COMPLETED: 'detail_extraction_completed',
    DETAIL_EXTRACTION_FAILED: 'detail_extraction_failed',
    DETAIL_CONFIG_UPDATED: 'detail_config_updated'
  },
  
  // 错误代码定义 - 简化详情提取错误代码
  ERROR_CODES: {
    INVALID_SEARCH_SOURCE: 'INVALID_SEARCH_SOURCE',
    INVALID_SOURCE_CATEGORY: 'INVALID_SOURCE_CATEGORY',
    MAX_CUSTOM_SOURCES_REACHED: 'MAX_CUSTOM_SOURCES_REACHED',
    MAX_CUSTOM_CATEGORIES_REACHED: 'MAX_CUSTOM_CATEGORIES_REACHED',
    DUPLICATE_SOURCE_ID: 'DUPLICATE_SOURCE_ID',
    DUPLICATE_SOURCE_NAME: 'DUPLICATE_SOURCE_NAME',
    DUPLICATE_CATEGORY_ID: 'DUPLICATE_CATEGORY_ID',
    DUPLICATE_CATEGORY_NAME: 'DUPLICATE_CATEGORY_NAME',
    INVALID_URL_TEMPLATE: 'INVALID_URL_TEMPLATE',
    FORBIDDEN_DOMAIN: 'FORBIDDEN_DOMAIN',
    SOURCE_NOT_FOUND: 'SOURCE_NOT_FOUND',
    CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
    CATEGORY_IN_USE: 'CATEGORY_IN_USE',
    SOURCE_STATUS_CHECK_TIMEOUT: 'SOURCE_STATUS_CHECK_TIMEOUT',
    SOURCE_STATUS_CHECK_ERROR: 'SOURCE_STATUS_CHECK_ERROR',
    SOURCE_STATUS_CACHE_EXPIRED: 'SOURCE_STATUS_CACHE_EXPIRED',
    
    // 详情提取错误代码 - 核心错误
    DETAIL_EXTRACTION_ERROR: 'DETAIL_EXTRACTION_ERROR',
    DETAIL_CONFIG_ERROR: 'DETAIL_CONFIG_ERROR'
  },
  
  // 默认用户设置 - 移除详情提取硬编码配置
  DEFAULT_USER_SETTINGS: {
    theme: 'auto',
    searchSources: ['javbus', 'javdb', 'javlibrary'],
    customSearchSources: [],
    customSourceCategories: [],
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
    
    // 注意：详情提取相关设置已完全迁移至 detail-config.js
    // 这些设置将通过 DetailConfigAPI 动态获取和管理
  },
  
  // 搜索源管理相关常量 - 保持不变
  SOURCE_MANAGEMENT: {
    DEFAULT_CATEGORY: 'others',
    SORT_OPTIONS: {
      NAME_ASC: 'name_asc',
      NAME_DESC: 'name_desc',
      CATEGORY: 'category',
      PRIORITY: 'priority',
      CREATED_DATE: 'created_date',
      STATUS: 'status',
      DETAIL_SUPPORT: 'detail_support'
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
      NO_DETAIL: 'no_detail'
    }
  },

  // 搜索源状态检查配置 - 保持不变
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
    USER_AGENT: 'MagnetSearch/2.0.0 StatusChecker'
  },

  // UI配置常量 - 保持不变
  UI_CONFIG: {
    DETAIL_CARD: {
      ANIMATION_DURATION: 300,
      MAX_TITLE_LENGTH: 100,
      MAX_DESCRIPTION_LENGTH: 500,
      THUMBNAIL_SIZE: { width: 240, height: 320 },
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

  // 性能监控配置 - 保持不变
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

  // 详情提取配置API端点 - 与 detail-config.js 对接
  DETAIL_CONFIG_ENDPOINTS: {
    GET_CONFIG: '/api/detail/config',
    UPDATE_CONFIG: '/api/detail/config',
    RESET_CONFIG: '/api/detail/config/reset',
    APPLY_PRESET: '/api/detail/config/preset',
    GET_SUPPORTED_SITES: '/api/detail/supported-sites',
    VALIDATE_PARSER: '/api/detail/validate-parser',
    SERVICE_STATS: '/api/detail/service-stats',
    RELOAD_PARSER: '/api/detail/reload-parser'
  }
  
  
// 将 migratedConfigKeys 提取为模块级常量
const MIGRATED_CONFIG_KEYS = [
  'enableDetailExtraction', 
  'autoExtractDetails', 
  'detailExtractionTimeout',
  'detailCacheDuration', 
  'extractionBatchSize', 
  'maxRetryAttempts',
  'maxDownloadLinks', 
  'maxMagnetLinks', 
  'maxScreenshots'
];
};

// 导出常用常量 - 保持向后兼容
export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const THEMES = APP_CONSTANTS.THEMES;
export const SOURCE_CATEGORIES = APP_CONSTANTS.SOURCE_CATEGORIES;
export const SEARCH_SOURCES = APP_CONSTANTS.SEARCH_SOURCES;
export const DETAIL_EXTRACTION_SOURCES = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES;
export const DETAIL_EXTRACTION_STATUS = APP_CONSTANTS.DETAIL_EXTRACTION_STATUS;
export const DEFAULT_USER_SETTINGS = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
export const PERMISSIONS = APP_CONSTANTS.PERMISSIONS;
export const ERROR_CODES = APP_CONSTANTS.ERROR_CODES;
export const ANALYTICS_EVENTS = APP_CONSTANTS.ANALYTICS_EVENTS;
export const VALIDATION_RULES = APP_CONSTANTS.VALIDATION_RULES;
export const SOURCE_MANAGEMENT = APP_CONSTANTS.SOURCE_MANAGEMENT;

// 工具函数 - 保持不变
export function getStorageKey(key) {
  return STORAGE_KEYS[key] || key;
}

export function isDetailExtractionSupported(sourceId) {
  return DETAIL_EXTRACTION_SOURCES.includes(sourceId);
}

export function getSourceByCategory(category) {
  return SEARCH_SOURCES.filter(source => source.category === category);
}

export function getSourcesSupportingDetailExtraction() {
  return SEARCH_SOURCES.filter(source => source.supportsDetailExtraction);
}

// 新增：详情提取配置相关工具函数
export function getDetailConfigEndpoint(endpoint) {
  return APP_CONSTANTS.DETAIL_CONFIG_ENDPOINTS[endpoint.toUpperCase()];
}

// 向后兼容性检查函数
export function validateLegacySettings(settings) {
  const warnings = [];
  
  // 使用模块级常量
  MIGRATED_CONFIG_KEYS.forEach(key => {
    if (settings.hasOwnProperty(key)) {
      warnings.push(`配置项 ${key} 已迁移至详情提取配置管理，请使用 DetailConfigAPI 进行管理`);
    }
  });
  
  return warnings;
}

// 架构升级信息
export const ARCHITECTURE_INFO = {
  version: '2.0.0',
  upgrades: {
    detailExtraction: {
      migratedToBackend: true,
      dynamicConfiguration: true,
      modularParsers: true,
      unifiedDataStructure: true,
      improvedCaching: true,
      enhancedValidation: true
    }
  },
  compatibility: {
    backwardCompatible: true,
    deprecatedFields: MIGRATED_CONFIG_KEYS, // ✅ 现在可以正常引用了
    migrationGuide: 'https://docs.example.com/migration-v2'
  }
};

// 默认导出 - 保持向后兼容
export default APP_CONSTANTS;