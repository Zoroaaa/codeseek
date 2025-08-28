// 应用常量定义 - 添加搜索源状态检查相关配置
export const APP_CONSTANTS = {
  // 应用信息
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '1.3.1', // 版本升级，支持搜索源状态检查
  
  // 本地存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    CUSTOM_SOURCES: 'custom_search_sources',
    CUSTOM_CATEGORIES: 'custom_source_categories',
    SOURCE_STATUS_CACHE: 'source_status_cache' // 新增：搜索源状态缓存
  },
  
  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000, // 新增：搜索源状态检查超时时间
    SOURCE_STATUS_CACHE_DURATION: 300000 // 新增：搜索源状态缓存时间（5分钟）
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
    MAX_CONCURRENT_SOURCE_CHECKS: 10 // 新增：最大并发检查搜索源数量
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
  
  // 新增：搜索源状态
  SOURCE_STATUS: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    ERROR: 'error',
    CHECKING: 'checking',
    UNKNOWN: 'unknown',
    TIMEOUT: 'timeout'
  },
  
  // 搜索源分类定义
  SOURCE_CATEGORIES: {
    database: {
      id: 'database',
      name: '📚 番号资料站',
      description: '提供详细的番号信息、封面和演员资料',
      icon: '📚',
      color: '#3b82f6',
      isBuiltin: true,
      order: 1
    },
    streaming: {
      id: 'streaming',
      name: '🎥 在线播放平台',
      description: '提供在线观看和下载服务',
      icon: '🎥',
      color: '#10b981',
      isBuiltin: true,
      order: 2
    },
    torrent: {
      id: 'torrent',
      name: '🧲 磁力搜索',
      description: '提供磁力链接和种子文件',
      icon: '🧲',
      color: '#f59e0b',
      isBuiltin: true,
      order: 3
    },
    community: {
      id: 'community',
      name: '💬 社区论坛',
      description: '用户交流讨论和资源分享',
      icon: '💬',
      color: '#8b5cf6',
      isBuiltin: true,
      order: 4
    },
    others: {
      id: 'others',
      name: '🌟 其他资源',
      description: '其他类型的搜索资源',
      icon: '🌟',
      color: '#6b7280',
      isBuiltin: true,
      order: 99
    }
  },
  
  // 搜索来源配置 - 添加状态检查相关信息
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
      // 新增：状态检查配置
      checkMethod: 'favicon', // 检查方式：favicon, image, custom, fetch
      statusCheckUrl: 'https://www.javbus.com/favicon.ico', // 用于状态检查的URL
      expectedStatusCode: [200, 301, 302], // 期望的HTTP状态码
      timeout: 8000 // 超时时间（毫秒）
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javdb.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://www.javlibrary.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 10000 // JavLibrary通常较慢
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javfinder.is/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://jable.tv/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javmost.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://jav.guru/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://av01.tv/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://missav.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javhd.porn/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javgg.net/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://javhihi.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://btsow.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://www.magnetdl.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://www.torrentkitty.tv/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://sukebei.nyaa.si/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 8000
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://sehuatang.org/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 10000 // 论坛通常较慢
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
      checkMethod: 'favicon',
      statusCheckUrl: 'https://t66y.com/favicon.ico',
      expectedStatusCode: [200, 301, 302],
      timeout: 10000
    }
  ],
  
  // 搜索源和分类验证规则
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
    },
    // 新增：状态检查验证规则
    STATUS_CHECK: {
      TIMEOUT_RANGE: [1000, 30000], // 超时时间范围 1-30秒
      VALID_CHECK_METHODS: ['favicon', 'image', 'fetch', 'custom'],
      VALID_STATUS_CODES: [200, 201, 301, 302, 304, 403, 404] // 有效的HTTP状态码
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
    SOURCE_STATUS_CHECK: 'source_status_check', // 新增：搜索源状态检查权限
    ADMIN: 'admin',
    PREMIUM: 'premium'
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
    SOURCE_STATUS_CHECKED: 'source_status_checked', // 新增
    SOURCE_STATUS_CHECK_ENABLED: 'source_status_check_enabled', // 新增
    SOURCE_STATUS_CHECK_DISABLED: 'source_status_check_disabled', // 新增
    SETTINGS_UPDATED: 'settings_updated',
    DATA_EXPORTED: 'data_exported',
    HISTORY_CLEARED: 'history_cleared'
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
    SOURCE_STATUS_CHECK_FAILED: 'SOURCE_STATUS_CHECK_FAILED', // 新增
    SOURCE_STATUS_CHECK_TIMEOUT: 'SOURCE_STATUS_CHECK_TIMEOUT', // 新增
    INVALID_STATUS_CHECK_METHOD: 'INVALID_STATUS_CHECK_METHOD' // 新增
  },
  
  // 默认用户设置 - 添加状态检查相关选项
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
    // 新增：搜索源状态检查设置
    checkSourceStatus: false, // 是否启用搜索源状态检查
    sourceStatusCheckTimeout: 8000, // 状态检查超时时间
    sourceStatusCacheDuration: 300000, // 状态缓存持续时间（5分钟）
    skipUnavailableSources: true, // 是否跳过不可用的搜索源
    showSourceStatus: true, // 是否在结果中显示搜索源状态
    retryFailedSources: false // 是否重试失败的搜索源
  },
  
  // 搜索源管理相关常量
  SOURCE_MANAGEMENT: {
    DEFAULT_CATEGORY: 'others',
    SORT_OPTIONS: {
      NAME_ASC: 'name_asc',
      NAME_DESC: 'name_desc',
      CATEGORY: 'category',
      PRIORITY: 'priority',
      STATUS: 'status', // 新增：按状态排序
      RESPONSE_TIME: 'response_time', // 新增：按响应时间排序
      CREATED_DATE: 'created_date'
    },
    FILTER_OPTIONS: {
      ALL: 'all',
      BUILTIN: 'builtin',
      CUSTOM: 'custom',
      ENABLED: 'enabled',
      DISABLED: 'disabled',
      ONLINE: 'online', // 新增：在线状态
      OFFLINE: 'offline', // 新增：离线状态
      ERROR: 'error' // 新增：错误状态
    },
    // 新增：状态检查相关选项
    STATUS_CHECK_OPTIONS: {
      CHECK_METHODS: {
        FAVICON: 'favicon',
        IMAGE: 'image',
        FETCH: 'fetch',
        CUSTOM: 'custom'
      },
      DEFAULT_TIMEOUT: 8000,
      MIN_TIMEOUT: 1000,
      MAX_TIMEOUT: 30000,
      RETRY_ATTEMPTS: 1,
      CACHE_DURATION: 300000
    }
  }
};