// 应用常量定义 - 集成详情提取功能支持
export const APP_CONSTANTS = {
  // 应用信息
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '1.3.0', // 🔧 版本升级，支持详情提取功能
  
  // 本地存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    CUSTOM_SOURCES: 'custom_search_sources',
    CUSTOM_CATEGORIES: 'custom_source_categories',
    SOURCE_STATUS_CACHE: 'source_status_cache',
    // 🆕 详情提取相关缓存
    DETAIL_EXTRACTION_CACHE: 'detail_extraction_cache',
    DETAIL_CONFIG_CACHE: 'detail_config_cache'
  },
  
  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
    // 🆕 详情提取API配置
    DETAIL_EXTRACTION_TIMEOUT: 15000, // 详情提取超时时间
    DETAIL_CACHE_DURATION: 86400000, // 详情缓存24小时
    DETAIL_BATCH_SIZE: 20, // 最大批量提取数量
    DETAIL_MAX_CONCURRENT: 3 // 最大并发提取数量
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
    
    // 🆕 详情提取限制
    MAX_DETAIL_EXTRACTIONS_PER_BATCH: 20, // 每批最大提取数量
    MIN_DETAIL_EXTRACTION_TIMEOUT: 5000, // 最小超时时间
    MAX_DETAIL_EXTRACTION_TIMEOUT: 30000, // 最大超时时间
    MIN_DETAIL_CACHE_DURATION: 3600000, // 最小缓存时间（1小时）
    MAX_DETAIL_CACHE_DURATION: 604800000, // 最大缓存时间（7天）
    MAX_AUTO_EXTRACTIONS: 10 // 自动提取最大数量
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

  // 🆕 详情提取状态枚举
  DETAIL_EXTRACTION_STATUS: {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    SUCCESS: 'success',
    ERROR: 'error',
    TIMEOUT: 'timeout',
    CACHED: 'cached',
    PARTIAL: 'partial'
  },

  // 🆕 支持详情提取的搜索源
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'javlibrary', 'jable', 'javmost', 
    'missav', 'javhdporn', 'javgg', 'av01', 'sukebei'
  ],

  // 搜索源分类定义
  SOURCE_CATEGORIES: {
    database: {
      id: 'database',
      name: '📚 番号资料站',
      description: '提供详细的番号信息、封面和演员资料',
      icon: '📚',
      color: '#3b82f6',
      isBuiltin: true,
      order: 1,
      supportsDetailExtraction: true // 🆕 支持详情提取
    },
    streaming: {
      id: 'streaming',
      name: '🎥 在线播放平台',
      description: '提供在线观看和下载服务',
      icon: '🎥',
      color: '#10b981',
      isBuiltin: true,
      order: 2,
      supportsDetailExtraction: true // 🆕 支持详情提取
    },
    torrent: {
      id: 'torrent',
      name: '🧲 磁力搜索',
      description: '提供磁力链接和种子文件',
      icon: '🧲',
      color: '#f59e0b',
      isBuiltin: true,
      order: 3,
      supportsDetailExtraction: true // 🆕 支持详情提取
    },
    community: {
      id: 'community',
      name: '💬 社区论坛',
      description: '用户交流讨论和资源分享',
      icon: '💬',
      color: '#8b5cf6',
      isBuiltin: true,
      order: 4,
      supportsDetailExtraction: false // 论坛类不支持详情提取
    },
    others: {
      id: 'others',
      name: '🌟 其他资源',
      description: '其他类型的搜索资源',
      icon: '🌟',
      color: '#6b7280',
      isBuiltin: true,
      order: 99,
      supportsDetailExtraction: false
    }
  },
  
  // 增强版搜索来源 - 标记详情提取支持
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
    },
    {
      id: 'javfinder',
      name: 'JavFinder',
      subtitle: '智能搜索引擎，结果精准',
      icon: '🔎',
      urlTemplate: 'https://javfinder.is/search/{keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: false // 不支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: false // 不支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
    },
    {
      id: 'javhdporn',
      name: 'JavHD.porn',
      subtitle: '高清资源下载，质量优秀',
      icon: '📽️',
      urlTemplate: 'https://javhd.porn/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 6,
      isActive: true,
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: false // 不支持详情提取
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
      supportsDetailExtraction: false // 磁力站不支持详情提取
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
      supportsDetailExtraction: false // 磁力站不支持详情提取
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
      supportsDetailExtraction: false // 磁力站不支持详情提取
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
      supportsDetailExtraction: true // 🆕 支持详情提取
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
      supportsDetailExtraction: false // 论坛不支持详情提取
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
      supportsDetailExtraction: false // 论坛不支持详情提取
    }
  ],
  
  // 搜索源和分类验证规则
  VALIDATION_RULES: {
    SOURCE: {
      REQUIRED_FIELDS: [ 'name', 'urlTemplate', 'category'],
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
    '🎭', '🎪', '🎦', '📽️', '⚡', '💫', '🌙', '🔗',
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
    ADMIN: 'admin',
    PREMIUM: 'premium',
    // 🆕 详情提取权限
    DETAIL_EXTRACTION: 'detail_extraction',
    DETAIL_EXTRACTION_BATCH: 'detail_extraction_batch',
    DETAIL_EXTRACTION_HISTORY: 'detail_extraction_history'
  },
  
  // 用户行为追踪事件
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
    
    // 🆕 详情提取相关事件
    DETAIL_EXTRACTION_STARTED: 'detail_extraction_started',
    DETAIL_EXTRACTION_COMPLETED: 'detail_extraction_completed',
    DETAIL_EXTRACTION_FAILED: 'detail_extraction_failed',
    DETAIL_BATCH_EXTRACTION_STARTED: 'detail_batch_extraction_started',
    DETAIL_BATCH_EXTRACTION_COMPLETED: 'detail_batch_extraction_completed',
    DETAIL_CACHE_HIT: 'detail_cache_hit',
    DETAIL_CACHE_CLEARED: 'detail_cache_cleared',
    DOWNLOAD_LINK_CLICKED: 'download_link_clicked',
    MAGNET_LINK_COPIED: 'magnet_link_copied',
    IMAGE_PREVIEW_OPENED: 'image_preview_opened'
  },
  
  // 错误代码定义
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
    
    // 🆕 详情提取错误代码
    DETAIL_EXTRACTION_TIMEOUT: 'DETAIL_EXTRACTION_TIMEOUT',
    DETAIL_EXTRACTION_ERROR: 'DETAIL_EXTRACTION_ERROR',
    DETAIL_EXTRACTION_UNSUPPORTED_SOURCE: 'DETAIL_EXTRACTION_UNSUPPORTED_SOURCE',
    DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED: 'DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED',
    DETAIL_EXTRACTION_PERMISSION_DENIED: 'DETAIL_EXTRACTION_PERMISSION_DENIED',
    DETAIL_CACHE_ERROR: 'DETAIL_CACHE_ERROR'
  },
  
  // 🆕 增强：默认用户设置 - 添加详情提取设置
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
    retryFailedSources: false,
    
    // 🆕 详情提取默认设置
    enableDetailExtraction: true, // 默认开启详情提取
    autoExtractDetails: true, // 默认开启自动提取
    maxAutoExtractions: 5, // 自动提取最大数量
    detailExtractionTimeout: 15000, // 详情提取超时时间
    detailCacheDuration: 86400000, // 详情缓存时间（24小时）
    extractionBatchSize: 3, // 批量提取大小
    showScreenshots: true, // 显示截图
    showDownloadLinks: true, // 显示下载链接
    showMagnetLinks: true, // 显示磁力链接
    showActressInfo: true, // 显示演员信息
    compactMode: false, // 紧凑模式
    enableImagePreview: true, // 启用图片预览
    showExtractionProgress: true, // 显示提取进度
    enableContentFilter: false, // 启用内容过滤
    contentFilterKeywords: [] // 内容过滤关键词
  },
  
  // 搜索源管理相关常量
  SOURCE_MANAGEMENT: {
    DEFAULT_CATEGORY: 'others',
    SORT_OPTIONS: {
      NAME_ASC: 'name_asc',
      NAME_DESC: 'name_desc',
      CATEGORY: 'category',
      PRIORITY: 'priority',
      CREATED_DATE: 'created_date',
      STATUS: 'status',
      DETAIL_SUPPORT: 'detail_support' // 🆕 按详情提取支持排序
    },
    FILTER_OPTIONS: {
      ALL: 'all',
      BUILTIN: 'builtin',
      CUSTOM: 'custom',
      ENABLED: 'enabled',
      DISABLED: 'disabled',
      AVAILABLE: 'available',
      UNAVAILABLE: 'unavailable',
      SUPPORTS_DETAIL: 'supports_detail', // 🆕 按详情提取支持过滤
      NO_DETAIL: 'no_detail' // 🆕 不支持详情提取的源
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
    USER_AGENT: 'MagnetSearch/1.3.0 StatusChecker'
  },

  // 🆕 详情提取配置
  DETAIL_EXTRACTION_CONFIG: {
    DEFAULT_TIMEOUT: 15000, // 默认超时时间
    MIN_TIMEOUT: 5000, // 最小超时时间
    MAX_TIMEOUT: 30000, // 最大超时时间
    DEFAULT_CACHE_DURATION: 86400000, // 默认缓存时间（24小时）
    MIN_CACHE_DURATION: 3600000, // 最小缓存时间（1小时）
    MAX_CACHE_DURATION: 604800000, // 最大缓存时间（7天）
    DEFAULT_BATCH_SIZE: 3, // 默认批量大小
    MAX_BATCH_SIZE: 20, // 最大批量大小
    MAX_CONCURRENT_EXTRACTIONS: 3, // 最大并发提取数
    RETRY_ATTEMPTS: 2, // 重试次数
    RETRY_DELAY: 1000, // 重试延迟
    ENABLE_CACHE: true, // 启用缓存
    ENABLE_PROGRESS: true, // 启用进度显示
    
    // 内容类型检测
    CONTENT_TYPES: {
      TORRENT: 'torrent',
      DOWNLOAD: 'download', 
      VIDEO: 'video',
      MEDIA: 'media',
      BASIC: 'basic',
      UNKNOWN: 'unknown'
    },
    
    // 支持的图片格式
    SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    
    // 支持的下载类型
    SUPPORTED_DOWNLOAD_TYPES: ['http', 'https', 'ftp', 'magnet'],
    
    // 质量评分权重
    QUALITY_WEIGHTS: {
      RESPONSE_TIME: 0.3, // 响应时间权重
      CONTENT_COMPLETENESS: 0.4, // 内容完整性权重
      IMAGE_QUALITY: 0.2, // 图片质量权重
      METADATA_RICHNESS: 0.1 // 元数据丰富度权重
    }
  }
};