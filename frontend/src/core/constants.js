// 应用常量定义 - 完善版详情提取功能支持
export const APP_CONSTANTS = {
  // 应用信息
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '1.4.0', // 版本升级，完善详情提取功能
  
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
    // 详情提取相关缓存
    DETAIL_EXTRACTION_CACHE: 'detail_extraction_cache',
    DETAIL_CONFIG_CACHE: 'detail_config_cache',
    DETAIL_EXTRACTION_SETTINGS: 'detail_extraction_settings',
    DETAIL_EXTRACTION_HISTORY: 'detail_extraction_history'
  },
  
  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
    // 详情提取API配置
    DETAIL_EXTRACTION_TIMEOUT: 15000, // 详情提取超时时间
    DETAIL_CACHE_DURATION: 86400000, // 详情缓存24小时
    DETAIL_BATCH_SIZE: 20, // 最大批量提取数量
    DETAIL_MAX_CONCURRENT: 4, // 最大并发提取数量
    DETAIL_RETRY_ATTEMPTS: 2, // 详情提取重试次数
    DETAIL_RETRY_DELAY: 1000, // 重试延迟时间
    DETAIL_PROGRESS_UPDATE_INTERVAL: 500 // 进度更新间隔
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
    MAX_DETAIL_EXTRACTIONS_PER_BATCH: 20, // 每批最大提取数量
    MIN_DETAIL_EXTRACTION_TIMEOUT: 5000, // 最小超时时间
    MAX_DETAIL_EXTRACTION_TIMEOUT: 30000, // 最大超时时间
    MIN_DETAIL_CACHE_DURATION: 3600000, // 最小缓存时间（1小时）
    MAX_DETAIL_CACHE_DURATION: 604800000, // 最大缓存时间（7天）
    MAX_AUTO_EXTRACTIONS: 10, // 自动提取最大数量
    MAX_DETAIL_IMAGES_PER_RESULT: 20, // 每个结果最大图片数量
    MAX_DOWNLOAD_LINKS_PER_RESULT: 10, // 每个结果最大下载链接数量
    MAX_MAGNET_LINKS_PER_RESULT: 10 // 每个结果最大磁力链接数量
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
    RETRYING: 'retrying',
    CANCELLED: 'cancelled'
  },

  // 详情提取错误类型
  DETAIL_EXTRACTION_ERROR_TYPES: {
    NETWORK_ERROR: 'network_error',
    TIMEOUT_ERROR: 'timeout_error',
    PARSE_ERROR: 'parse_error',
    VALIDATION_ERROR: 'validation_error',
    PERMISSION_ERROR: 'permission_error',
    RATE_LIMIT_ERROR: 'rate_limit_error',
    SERVER_ERROR: 'server_error',
    UNKNOWN_ERROR: 'unknown_error'
  },

  // 支持详情提取的搜索源（完善版）
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'javlibrary', 'jable', 'javmost', 
    'missav', 'javhdporn', 'javgg', 'av01', 'sukebei',
    'javfinder', 'javguru', 'javhihi' // 新增支持的源
  ],

  // 详情提取优先级源
  DETAIL_EXTRACTION_PRIORITY_SOURCES: [
    'javbus', 'javdb', 'javlibrary', 'jable', 'missav'
  ],

  // 搜索源分类定义（完善版）
  SOURCE_CATEGORIES: {
    database: {
      id: 'database',
      name: '数据资料站',
      description: '提供详细的番号信息、封面和演员资料',
      icon: '📚',
      color: '#3b82f6',
      isBuiltin: true,
      order: 1,
      supportsDetailExtraction: true,
      extractionQuality: 'excellent' // 新增质量评级
    },
    streaming: {
      id: 'streaming',
      name: '在线播放平台',
      description: '提供在线观看和下载服务',
      icon: '🎥',
      color: '#10b981',
      isBuiltin: true,
      order: 2,
      supportsDetailExtraction: true,
      extractionQuality: 'good'
    },
    torrent: {
      id: 'torrent',
      name: '磁力搜索',
      description: '提供磁力链接和种子文件',
      icon: '🧲',
      color: '#f59e0b',
      isBuiltin: true,
      order: 3,
      supportsDetailExtraction: true,
      extractionQuality: 'fair'
    },
    community: {
      id: 'community',
      name: '社区论坛',
      description: '用户交流讨论和资源分享',
      icon: '💬',
      color: '#8b5cf6',
      isBuiltin: true,
      order: 4,
      supportsDetailExtraction: false,
      extractionQuality: 'none'
    },
    others: {
      id: 'others',
      name: '其他资源',
      description: '其他类型的搜索资源',
      icon: '🌟',
      color: '#6b7280',
      isBuiltin: true,
      order: 99,
      supportsDetailExtraction: false,
      extractionQuality: 'none'
    }
  },
  
  // 增强版搜索来源（完善版）
  SEARCH_SOURCES: [
    // 番号资料站（高质量详情提取）
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
      supportsDetailExtraction: true,
      extractionQuality: 'excellent',
      extractionFeatures: ['cover', 'screenshots', 'actresses', 'download_links', 'magnet_links', 'metadata']
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
      supportsDetailExtraction: true,
      extractionQuality: 'excellent',
      extractionFeatures: ['cover', 'screenshots', 'actresses', 'metadata', 'tags']
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
      supportsDetailExtraction: true,
      extractionQuality: 'excellent',
      extractionFeatures: ['cover', 'actresses', 'metadata', 'ratings']
    },
    
    // 在线播放平台（中等质量详情提取）
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
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      extractionFeatures: ['cover', 'screenshots', 'actresses', 'metadata']
    },
    {
      id: 'missav',
      name: 'MissAV',
      subtitle: '中文界面，封面高清，信息丰富',
      icon: '💫',
      urlTemplate: 'https://missav.com/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      extractionFeatures: ['cover', 'screenshots', 'actresses', 'download_links']
    },
    
    // 其他源...（省略以节省空间）
  ],
  
  // 详情提取配置（完善版）
  DETAIL_EXTRACTION_CONFIG: {
    // 基础配置
    DEFAULT_TIMEOUT: 15000,
    MIN_TIMEOUT: 5000,
    MAX_TIMEOUT: 30000,
    DEFAULT_CACHE_DURATION: 86400000, // 24小时
    MIN_CACHE_DURATION: 3600000, // 1小时
    MAX_CACHE_DURATION: 604800000, // 7天
    DEFAULT_BATCH_SIZE: 3,
    MAX_BATCH_SIZE: 20,
    MAX_CONCURRENT_EXTRACTIONS: 4,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 1000,
    
    // 高级配置
    ENABLE_CACHE: true,
    ENABLE_PROGRESS: true,
    ENABLE_VALIDATION: true,
    ENABLE_COMPRESSION: true,
    ENABLE_IMAGE_OPTIMIZATION: true,
    
    // 内容类型检测
    CONTENT_TYPES: {
      TORRENT: 'torrent',
      DOWNLOAD: 'download', 
      VIDEO: 'video',
      MEDIA: 'media',
      BASIC: 'basic',
      ENHANCED: 'enhanced',
      PREMIUM: 'premium',
      UNKNOWN: 'unknown'
    },
    
    // 支持的文件格式
    SUPPORTED_IMAGE_FORMATS: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
    SUPPORTED_VIDEO_FORMATS: ['mp4', 'avi', 'mkv', 'wmv', 'mov', 'flv'],
    SUPPORTED_DOWNLOAD_TYPES: ['http', 'https', 'ftp', 'magnet', 'ed2k'],
    
    // 质量评分权重
    QUALITY_WEIGHTS: {
      RESPONSE_TIME: 0.25, // 响应时间权重
      CONTENT_COMPLETENESS: 0.35, // 内容完整性权重
      IMAGE_QUALITY: 0.20, // 图片质量权重
      METADATA_RICHNESS: 0.15, // 元数据丰富度权重
      DATA_ACCURACY: 0.05 // 数据准确性权重
    },
    
    // 提取优先级
    EXTRACTION_PRIORITIES: {
      COVER_IMAGE: 10,
      TITLE: 9,
      CODE: 9,
      ACTRESSES: 8,
      METADATA: 7,
      SCREENSHOTS: 6,
      DOWNLOAD_LINKS: 5,
      MAGNET_LINKS: 4,
      TAGS: 3,
      DESCRIPTION: 2,
      RATINGS: 1
    },
    
    // 缓存策略
    CACHE_STRATEGIES: {
      AGGRESSIVE: 'aggressive', // 激进缓存
      NORMAL: 'normal', // 正常缓存
      CONSERVATIVE: 'conservative', // 保守缓存
      DISABLED: 'disabled' // 禁用缓存
    }
  },
  
  // 用户行为追踪事件（完善版）
  ANALYTICS_EVENTS: {
    // 基础搜索事件
    SEARCH_PERFORMED: 'search_performed',
    RESULT_CLICKED: 'result_clicked',
    FAVORITE_ADDED: 'favorite_added',
    FAVORITE_REMOVED: 'favorite_removed',
    
    // 详情提取相关事件
    DETAIL_EXTRACTION_STARTED: 'detail_extraction_started',
    DETAIL_EXTRACTION_COMPLETED: 'detail_extraction_completed',
    DETAIL_EXTRACTION_FAILED: 'detail_extraction_failed',
    DETAIL_BATCH_EXTRACTION_STARTED: 'detail_batch_extraction_started',
    DETAIL_BATCH_EXTRACTION_COMPLETED: 'detail_batch_extraction_completed',
    DETAIL_EXTRACTION_CANCELLED: 'detail_extraction_cancelled',
    DETAIL_EXTRACTION_RETRIED: 'detail_extraction_retried',
    DETAIL_CACHE_HIT: 'detail_cache_hit',
    DETAIL_CACHE_MISS: 'detail_cache_miss',
    DETAIL_CACHE_CLEARED: 'detail_cache_cleared',
    
    // 用户交互事件
    DOWNLOAD_LINK_CLICKED: 'download_link_clicked',
    MAGNET_LINK_COPIED: 'magnet_link_copied',
    IMAGE_PREVIEW_OPENED: 'image_preview_opened',
    DETAIL_CARD_EXPANDED: 'detail_card_expanded',
    DETAIL_CARD_COLLAPSED: 'detail_card_collapsed',
    ACTRESS_PROFILE_VIEWED: 'actress_profile_viewed',
    
    // 配置和设置事件
    DETAIL_SETTINGS_CHANGED: 'detail_settings_changed',
    EXTRACTION_MODE_CHANGED: 'extraction_mode_changed',
    CACHE_SETTINGS_CHANGED: 'cache_settings_changed',
    
    // 错误和性能事件
    EXTRACTION_ERROR_OCCURRED: 'extraction_error_occurred',
    EXTRACTION_TIMEOUT_OCCURRED: 'extraction_timeout_occurred',
    EXTRACTION_PERFORMANCE_MEASURED: 'extraction_performance_measured'
  },
  
  // 错误代码定义（完善版）
  ERROR_CODES: {
    // 基础错误
    INVALID_SEARCH_SOURCE: 'INVALID_SEARCH_SOURCE',
    INVALID_SOURCE_CATEGORY: 'INVALID_SOURCE_CATEGORY',
    
    // 详情提取错误
    DETAIL_EXTRACTION_TIMEOUT: 'DETAIL_EXTRACTION_TIMEOUT',
    DETAIL_EXTRACTION_ERROR: 'DETAIL_EXTRACTION_ERROR',
    DETAIL_EXTRACTION_UNSUPPORTED_SOURCE: 'DETAIL_EXTRACTION_UNSUPPORTED_SOURCE',
    DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED: 'DETAIL_EXTRACTION_BATCH_LIMIT_EXCEEDED',
    DETAIL_EXTRACTION_PERMISSION_DENIED: 'DETAIL_EXTRACTION_PERMISSION_DENIED',
    DETAIL_EXTRACTION_RATE_LIMITED: 'DETAIL_EXTRACTION_RATE_LIMITED',
    DETAIL_EXTRACTION_INVALID_RESPONSE: 'DETAIL_EXTRACTION_INVALID_RESPONSE',
    DETAIL_EXTRACTION_PARSE_FAILED: 'DETAIL_EXTRACTION_PARSE_FAILED',
    DETAIL_EXTRACTION_VALIDATION_FAILED: 'DETAIL_EXTRACTION_VALIDATION_FAILED',
    DETAIL_EXTRACTION_CANCELLED_BY_USER: 'DETAIL_EXTRACTION_CANCELLED_BY_USER',
    
    // 缓存相关错误
    DETAIL_CACHE_ERROR: 'DETAIL_CACHE_ERROR',
    DETAIL_CACHE_EXPIRED: 'DETAIL_CACHE_EXPIRED',
    DETAIL_CACHE_CORRUPTED: 'DETAIL_CACHE_CORRUPTED',
    DETAIL_CACHE_QUOTA_EXCEEDED: 'DETAIL_CACHE_QUOTA_EXCEEDED'
  },
  
  // 默认用户设置（完善版）
  DEFAULT_USER_SETTINGS: {
    // 基础设置
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
    
    // 源状态检查设置
    checkSourceStatus: false,
    sourceStatusCheckTimeout: 8000,
    sourceStatusCacheDuration: 300000,
    skipUnavailableSources: true,
    showSourceStatus: true,
    retryFailedSources: false,
    
    // 详情提取默认设置（完善版）
    enableDetailExtraction: true,
    autoExtractDetails: true,
    maxAutoExtractions: 5,
    detailExtractionTimeout: 15000,
    detailCacheDuration: 86400000,
    extractionBatchSize: 3,
    maxConcurrentExtractions: 4,
    enableExtractionRetry: true,
    maxExtractionRetries: 2,
    extractionRetryDelay: 1000,
    
    // 显示选项
    showScreenshots: true,
    showDownloadLinks: true,
    showMagnetLinks: true,
    showActressInfo: true,
    showMetadata: true,
    showTags: true,
    showRatings: true,
    compactMode: false,
    enableImagePreview: true,
    showExtractionProgress: true,
    showExtractionStats: true,
    
    // 高级设置
    enableContentFilter: false,
    contentFilterKeywords: [],
    enableImageOptimization: true,
    enableDataCompression: true,
    preferredImageQuality: 'high',
    preferredExtractionSources: ['javbus', 'javdb'],
    cacheStrategy: 'normal',
    
    // 隐私和安全设置
    enableExtractionHistory: true,
    clearHistoryOnExit: false,
    enableSecureMode: false,
    maskSensitiveData: false
  },
  
  // 详情提取质量等级
  DETAIL_EXTRACTION_QUALITY: {
    EXCELLENT: 'excellent',
    GOOD: 'good',
    FAIR: 'fair',
    POOR: 'poor',
    NONE: 'none'
  },
  
  // 详情提取模式
  DETAIL_EXTRACTION_MODES: {
    AUTO: 'auto', // 自动提取
    MANUAL: 'manual', // 手动提取
    SELECTIVE: 'selective', // 选择性提取
    BATCH: 'batch', // 批量提取
    SMART: 'smart' // 智能提取
  },
  
  // UI常量
  UI_CONSTANTS: {
    ANIMATION_DURATION: 300,
    DEBOUNCE_DELAY: 300,
    TOAST_DURATION: 3000,
    LOADING_MIN_DURATION: 500,
    EXTRACTION_PROGRESS_UPDATE_INTERVAL: 100,
    CARD_ANIMATION_DELAY: 50,
    IMAGE_LAZY_LOAD_THRESHOLD: 100
  }
};