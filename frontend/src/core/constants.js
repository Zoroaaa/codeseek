// src/core/constants.js - 保守优化版本：只移除详情提取配置硬编码，保持其他功能完整
// 详情提取配置已迁移至 detail-config.js，由 detail-config-api.js 动态管理

export const APP_CONSTANTS = {
  // 应用信息 - 保持不变
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '1.4.0', // 版本升级，完善详情提取功能集成
  
  // 本地存储键名 - 保持不变，只添加详情配置相关
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    CUSTOM_SOURCES: 'custom_search_sources',
    CUSTOM_CATEGORIES: 'custom_source_categories',
    SOURCE_STATUS_CACHE: 'source_status_cache',
    // 详情提取相关缓存 - 保持不变
    DETAIL_EXTRACTION_CACHE: 'detail_extraction_cache',
    DETAIL_CONFIG_CACHE: 'detail_config_cache', // 新增：配置缓存
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats',
    DETAIL_USER_PREFERENCES: 'detail_user_preferences'
  },
  
  // API配置 - 保持原有功能，添加详情配置管理端点
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
    // 详情提取API配置 - 与后端完全对齐，但移除用户可配置部分
    DETAIL_EXTRACTION_TIMEOUT: 15000, // 系统默认值，用户可通过配置API修改
    DETAIL_CACHE_DURATION: 86400000, // 系统默认值，用户可通过配置API修改
    DETAIL_BATCH_SIZE: 20, // 系统最大值
    DETAIL_MAX_CONCURRENT: 3, // 系统默认值
    DETAIL_HEALTH_CHECK_INTERVAL: 300000,
    DETAIL_RETRY_DELAY: 1000,
    DETAIL_PROGRESS_UPDATE_INTERVAL: 1000
  },

  // 网站类型定义
  SITE_TYPES: {
    SEARCH: 'search',       // 真正的搜索源（需要关键词）
    BROWSE: 'browse',       // 浏览型网站（不需要关键词）  
    REFERENCE: 'reference'  // 参考资料站（可选关键词）
  },
  
  // 用户限制 - 保持不变
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
    
    // 详情提取限制 - 保留系统级限制，与后端 constants.js 同步
    MAX_DETAIL_EXTRACTIONS_PER_BATCH: 20, // 系统最大值
    MIN_DETAIL_EXTRACTION_TIMEOUT: 5000, // 系统最小值
    MAX_DETAIL_EXTRACTION_TIMEOUT: 30000, // 系统最大值
    MIN_DETAIL_CACHE_DURATION: 3600000, // 系统最小值
    MAX_DETAIL_CACHE_DURATION: 604800000, // 系统最大值
    MAX_AUTO_EXTRACTIONS: 10, // 系统最大值
    MAX_DOWNLOAD_LINKS: 15, // 系统最大值（用户可在此范围内配置）
    MAX_MAGNET_LINKS: 15, // 系统最大值（用户可在此范围内配置）
    MAX_SCREENSHOTS: 20, // 系统最大值（用户可在此范围内配置）
    MAX_CONTENT_FILTER_KEYWORDS: 50, // 系统最大值
    MAX_DETAIL_CARD_CACHE_SIZE: 100,
    MIN_QUALITY_SCORE: 0,
    MAX_QUALITY_SCORE: 100
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

  // 详情提取状态枚举 - 保持不变，与后端同步
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

  // 详情提取质量等级 - 保持不变
  DETAIL_QUALITY_LEVELS: {
    EXCELLENT: { min: 80, label: '优秀', color: '#10b981', icon: '⭐' },
    GOOD: { min: 60, label: '良好', color: '#3b82f6', icon: '✅' },
    FAIR: { min: 40, label: '一般', color: '#f59e0b', icon: '⚠️' },
    POOR: { min: 0, label: '较差', color: '#ef4444', icon: '❌' }
  },

  // 支持详情提取的搜索源 - 保持不变
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'jable', 'javmost', 
    'javgg',  'sukebei','javguru'
  ],

  // 详情提取源能力映射 - 保持不变
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

  // 🔧 新增：大分类定义（搜索源 vs 浏览站点），支持动态管理
  MAJOR_CATEGORIES: {
    SEARCH_SOURCES: {
      id: 'search_sources',
      name: '🔍 搜索源',
      description: '支持番号搜索的网站',
      icon: '🔍',
      requiresKeyword: true,
      order: 1,
      // 🔧 新增：网站类型映射
      supportedSiteTypes: ['search'],
      defaultSiteType: 'search'
    },
    BROWSE_SITES: {
      id: 'browse_sites', 
      name: '🌐 浏览站点',
      description: '仅供访问，不参与搜索',
      icon: '🌐',
      requiresKeyword: false,
      order: 2,
      // 🔧 新增：网站类型映射
      supportedSiteTypes: ['browse', 'reference'],
      defaultSiteType: 'browse'
    },
    // 🔧 新增：第三个大类以支持完整的功能
    REFERENCE_RESOURCES: {
      id: 'reference_resources',
      name: '📚 参考资源',
      description: '信息查询和参考类站点',
      icon: '📚',
      requiresKeyword: false,
      order: 3,
      // 🔧 新增：网站类型映射
      supportedSiteTypes: ['reference', 'browse'],
      defaultSiteType: 'reference'
    }
  },

  // 搜索源分类定义 - 添加默认搜索配置和大分类归属
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
      extractionPriority: 'high',
      typicalCapabilities: ['screenshots', 'actresses', 'metadata', 'rating'],
      defaultSearchable: true,      // 该类别默认可搜索
      defaultSiteType: 'search',    // 该类别默认网站类型
      searchPriority: 1,            // 搜索优先级
      majorCategory: 'search_sources' // 🔧 归属大分类
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
      extractionPriority: 'medium',
      typicalCapabilities: ['screenshots', 'downloadLinks', 'actresses', 'metadata'],
      defaultSearchable: false,     // 默认不参与搜索
      defaultSiteType: 'browse',
      searchPriority: 5,
      majorCategory: 'browse_sites' // 🔧 归属大分类
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
      extractionPriority: 'low',
      typicalCapabilities: ['magnetLinks', 'downloadLinks', 'metadata'],
      defaultSearchable: true,
      defaultSiteType: 'search',
      searchPriority: 3,
      majorCategory: 'search_sources' // 🔧 归属大分类
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
      extractionPriority: 'none',
      typicalCapabilities: [],
      defaultSearchable: false,
      defaultSiteType: 'browse',
      searchPriority: 10,
      majorCategory: 'browse_sites' // 🔧 归属大分类
    },
    reference: {
      id: 'reference',
      name: '📖 参考查询',
      description: '信息查询和参考资料站点',
      icon: '📖',
      color: '#06b6d4',
      isBuiltin: true,
      order: 5,
      supportsDetailExtraction: false,
      extractionPriority: 'none',
      typicalCapabilities: [],
      defaultSearchable: false,
      defaultSiteType: 'reference',
      searchPriority: 8,
      majorCategory: 'reference_resources' // 🔧 归属新的大分类
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
      extractionPriority: 'none',
      typicalCapabilities: [],
      defaultSearchable: false,
      defaultSiteType: 'browse',
      searchPriority: 10,
      majorCategory: 'browse_sites' // 🔧 归属大分类
    }
  },
  
  // 增强版搜索源 - 🔧 调整非搜索源的URL模板，移除搜索后缀
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
      supportsDetailExtraction: true,
      extractionQuality: 'excellent',
      averageExtractionTime: 3000,
      supportedFeatures: ['screenshots', 'downloadLinks', 'magnetLinks', 'actresses', 'metadata', 'description', 'rating', 'tags'],
      searchable: true,         // 是否参与搜索
      siteType: 'search',       // 网站类型
      searchPriority: 1,        // 搜索优先级 (1-10)
      requiresKeyword: true     // 是否需要关键词
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
      extractionQuality: 'good',
      averageExtractionTime: 2500,
      supportedFeatures: ['screenshots', 'magnetLinks', 'actresses', 'metadata', 'description', 'rating', 'tags'],
      searchable: true,
      siteType: 'search',
      searchPriority: 2,
      requiresKeyword: true
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
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'search',
      searchPriority: 3,
      requiresKeyword: true
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
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'search',
      searchPriority: 4,
      requiresKeyword: true
    },
    
    // 在线播放平台 - 🔧 调整URL模板，移除搜索后缀
    {
      id: 'jable',
      name: 'Jable',
      subtitle: '高清在线观看，支持多种格式',
      icon: '📺',
      urlTemplate: 'https://jable.tv', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 3500,
      supportedFeatures: ['screenshots', 'downloadLinks', 'actresses', 'metadata', 'description', 'tags'],
      searchable: false,        // 播放平台默认不参与搜索
      siteType: 'browse',
      searchPriority: 5,
      requiresKeyword: false
    },
    {
      id: 'javmost',
      name: 'JavMost',
      subtitle: '免费在线观看，更新及时',
      icon: '🎦',
      urlTemplate: 'https://javmost.com', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 4500,
      supportedFeatures: ['screenshots', 'downloadLinks', 'magnetLinks', 'actresses', 'metadata', 'description'],
      searchable: false,
      siteType: 'browse',
      searchPriority: 6,
      requiresKeyword: false
    },
    {
      id: 'javguru',
      name: 'JavGuru',
      subtitle: '多线路播放，观看流畅',
      icon: '🎭',
      urlTemplate: 'https://jav.guru', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,
      siteType: 'browse',
      searchPriority: 7,
      requiresKeyword: false
    },
    {
      id: 'av01',
      name: 'AV01',
      subtitle: '快速预览站点，封面大图清晰',
      icon: '🎥',
      urlTemplate: 'https://av01.tv', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,
      siteType: 'browse',
      searchPriority: 8,
      requiresKeyword: false
    },
    {
      id: 'missav',
      name: 'MissAV',
      subtitle: '中文界面，封面高清，信息丰富',
      icon: '💫',
      urlTemplate: 'https://missav.com', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 5,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,
      siteType: 'browse',
      searchPriority: 9,
      requiresKeyword: false
    },
    {
      id: 'javhdporn',
      name: 'JavHD.porn',
      subtitle: '高清资源下载，质量优秀',
      icon: '🎬',
      urlTemplate: 'https://javhd.porn', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 6,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,
      siteType: 'browse',
      searchPriority: 10,
      requiresKeyword: false
    },
    {
      id: 'javgg',
      name: 'JavGG',
      subtitle: '免费观看平台，速度稳定',
      icon: '⚡',
      urlTemplate: 'https://javgg.net', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 7,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 4500,
      supportedFeatures: ['screenshots', 'actresses', 'metadata'],
      searchable: false,
      siteType: 'browse',
      searchPriority: 11,
      requiresKeyword: false
    },
    {
      id: 'javhihi',
      name: 'JavHiHi',
      subtitle: '在线播放，无需下载',
      icon: '🎪',
      urlTemplate: 'https://javhihi.com', // 🔧 移除搜索后缀
      category: 'streaming',
      isBuiltin: true,
      priority: 8,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 5000,
      supportedFeatures: ['screenshots', 'actresses'],
      searchable: false,
      siteType: 'browse',
      searchPriority: 12,
      requiresKeyword: false
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
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'search',
      searchPriority: 2,
      requiresKeyword: true
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
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'search',
      searchPriority: 3,
      requiresKeyword: true
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
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'search',
      searchPriority: 4,
      requiresKeyword: true
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
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 6000,
      supportedFeatures: ['downloadLinks', 'magnetLinks', 'metadata', 'description', 'tags'],
      searchable: true,
      siteType: 'search',
      searchPriority: 5,
      requiresKeyword: true
    },
    
    // 社区论坛 - 🔧 调整URL模板，移除搜索后缀
    {
      id: 'sehuatang',
      name: '色花堂',
      subtitle: '综合论坛社区，资源丰富',
      icon: '🌸',
      urlTemplate: 'https://sehuatang.org', // 🔧 移除搜索后缀
      category: 'community',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,        // 不参与搜索
      siteType: 'browse',
      searchPriority: 99,
      requiresKeyword: false
    },
    {
      id: 't66y',
      name: 'T66Y',
      subtitle: '老牌论坛，资源更新快',
      icon: '📋',
      urlTemplate: 'https://t66y.com', // 🔧 移除搜索后缀
      category: 'community',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,        // 不参与搜索
      siteType: 'browse',
      searchPriority: 99,
      requiresKeyword: false
    },
    
    // 🔧 新增：参考资源类
    {
      id: 'wikijav',
      name: 'WikiJAV',
      subtitle: '番号信息百科，数据完整',
      icon: '📖',
      urlTemplate: 'https://wikijav.com/search/{keyword}',
      category: 'reference',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: true,
      siteType: 'reference',
      searchPriority: 6,
      requiresKeyword: true
    },
    {
      id: 'javinfo',
      name: 'JavInfo',
      subtitle: '番号信息查询，演员资料',
      icon: '📄',
      urlTemplate: 'https://javinfo.net', // 参考类可以不需要搜索
      category: 'reference',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: [],
      searchable: false,
      siteType: 'reference',
      searchPriority: 99,
      requiresKeyword: false
    }
  ],
  
  // 搜索源和分类验证规则 - 🔧 调整URL验证规则
  VALIDATION_RULES: {
    SOURCE: {
      REQUIRED_FIELDS: ['name', 'urlTemplate', 'category'],
      URL_PATTERN: /^https?:\/\/.+/, // 🔧 修改：不强制要求{keyword}
      SEARCH_URL_PATTERN: /^https?:\/\/.+\{keyword\}.*/, // 🔧 新增：搜索源URL验证
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
    '🐱', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲',
    '📖', '📄', '📊', '📈', '📉', '📌', '📍', '🏷️'
  ],
  
  // 权限定义 - 保持不变，添加详情提取配置权限
  PERMISSIONS: {
    SEARCH: 'search',
    FAVORITE: 'favorite',
    HISTORY: 'history',
    SYNC: 'sync',
    CUSTOM_SOURCES: 'custom_sources',
    CUSTOM_CATEGORIES: 'custom_categories',
    ADMIN: 'admin',
    PREMIUM: 'premium',
    // 详情提取权限
    DETAIL_EXTRACTION: 'detail_extraction',
    DETAIL_EXTRACTION_BATCH: 'detail_extraction_batch',
    DETAIL_EXTRACTION_HISTORY: 'detail_extraction_history',
    DETAIL_EXTRACTION_CACHE_MANAGEMENT: 'detail_extraction_cache_management',
    DETAIL_EXTRACTION_CONFIG: 'detail_extraction_config', // 新增：配置管理权限
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats'
  },
  
  // 用户行为追踪事件 - 保持不变，添加配置相关事件
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
    // 新增：配置相关事件
    DETAIL_CONFIG_UPDATED: 'detail_config_updated',
    DETAIL_CONFIG_RESET: 'detail_config_reset',
    DETAIL_CONFIG_PRESET_APPLIED: 'detail_config_preset_applied'
  },
  
  // 错误代码定义 - 保持不变，添加配置相关错误
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
    // 新增：配置相关错误
    DETAIL_CONFIG_VALIDATION_ERROR: 'DETAIL_CONFIG_VALIDATION_ERROR',
    DETAIL_CONFIG_SAVE_ERROR: 'DETAIL_CONFIG_SAVE_ERROR',
    DETAIL_CONFIG_LOAD_ERROR: 'DETAIL_CONFIG_LOAD_ERROR',
    DETAIL_CONFIG_PRESET_NOT_FOUND: 'DETAIL_CONFIG_PRESET_NOT_FOUND'
  },
  
  // 默认用户设置 - 移除详情提取硬编码配置，其他保持不变
  DEFAULT_USER_SETTINGS: {
    theme: 'auto',
    searchSources: ['javbus', 'javdb', 'javlibrary', 'btsow'],  // 默认只可用搜索类型的源
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
    
    // 注意：详情提取相关设置已迁移至 detail-config.js
    // 这些设置将通过 DetailConfigAPI 动态获取和管理
    // enableDetailExtraction, autoExtractDetails 等配置不再硬编码在此处
  },
  
  // 搜索源管理相关常量 - 保持不变，增强详情提取支持
  SOURCE_MANAGEMENT: {
    DEFAULT_CATEGORY: 'others',
    SORT_OPTIONS: {
      NAME_ASC: 'name_asc',
      NAME_DESC: 'name_desc',
      CATEGORY: 'category',
      PRIORITY: 'priority',
      CREATED_DATE: 'created_date',
      STATUS: 'status',
      DETAIL_SUPPORT: 'detail_support',
      EXTRACTION_QUALITY: 'extraction_quality',
      AVERAGE_TIME: 'average_time',
      SITE_TYPE: 'site_type',              // 新增：按网站类型排序
      SEARCHABLE: 'searchable',            // 新增：按可搜索性排序
      MAJOR_CATEGORY: 'major_category'     // 🔧 新增：按大分类排序
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
      SEARCHABLE: 'searchable',            // 新增：可搜索源
      BROWSE_ONLY: 'browse_only',          // 新增：仅浏览站点
      SEARCH_SOURCES: 'search_sources',    // 🔧 新增：搜索源大类
      BROWSE_SITES: 'browse_sites',        // 🔧 新增：浏览站点大类
      REFERENCE_RESOURCES: 'reference_resources' // 🔧 新增：参考资源大类
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
    USER_AGENT: 'MagnetSearch/1.4.0 StatusChecker'
  },

  // 详情提取配置 - 保留系统级配置，移除用户可配置部分
  DETAIL_EXTRACTION_CONFIG: {
    // 系统级技术限制（与后端 constants.js 完全同步）
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

  // UI配置常量 - 保持不变
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

  // 缓存策略配置 - 保持不变
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

  // 新增：详情提取配置API端点（与 detail-config.js 对接）
  DETAIL_CONFIG_ENDPOINTS: {
    GET_CONFIG: '/api/detail/config',
    UPDATE_CONFIG: '/api/detail/config',
    RESET_CONFIG: '/api/detail/config/reset',
    APPLY_PRESET: '/api/detail/config/preset'
  }
};

// 导出常用常量 - 保持向后兼容
export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const THEMES = APP_CONSTANTS.THEMES;
export const SOURCE_CATEGORIES = APP_CONSTANTS.SOURCE_CATEGORIES;
export const SEARCH_SOURCES = APP_CONSTANTS.SEARCH_SOURCES;
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
export const SITE_TYPES = APP_CONSTANTS.SITE_TYPES; // 新增导出
export const MAJOR_CATEGORIES = APP_CONSTANTS.MAJOR_CATEGORIES; // 🔧 新增导出

// 工具函数 - 保持不变
export function getStorageKey(key) {
  return STORAGE_KEYS[key] || key;
}

export function isDetailExtractionSupported(sourceId) {
  return DETAIL_EXTRACTION_SOURCES.includes(sourceId);
}

export function getDetailExtractionCapabilities(sourceId) {
  return DETAIL_EXTRACTION_CAPABILITIES[sourceId] || null;
}

export function getSourceByCategory(category) {
  return SEARCH_SOURCES.filter(source => source.category === category);
}

export function getSourcesSupportingDetailExtraction() {
  return SEARCH_SOURCES.filter(source => source.supportsDetailExtraction);
}

// 新增：网站类型相关工具函数
export function getSearchableSources() {
  return SEARCH_SOURCES.filter(source => source.searchable !== false);
}

export function getBrowseOnlySources() {
  return SEARCH_SOURCES.filter(source => source.searchable === false);
}

export function getSourcesBySiteType(siteType) {
  return SEARCH_SOURCES.filter(source => source.siteType === siteType);
}

export function isSearchableSource(sourceId) {
  const source = SEARCH_SOURCES.find(s => s.id === sourceId);
  return source ? source.searchable !== false : false;
}

// 🔧 新增：大分类相关工具函数
export function getSourcesByMajorCategory(majorCategoryId) {
  return SEARCH_SOURCES.filter(source => {
    const category = SOURCE_CATEGORIES[source.category];
    return category && category.majorCategory === majorCategoryId;
  });
}

export function getCategoriesByMajorCategory(majorCategoryId) {
  return Object.values(SOURCE_CATEGORIES).filter(category => 
    category.majorCategory === majorCategoryId
  );
}

export function getMajorCategoryForSource(sourceId) {
  const source = SEARCH_SOURCES.find(s => s.id === sourceId);
  if (!source) return null;
  
  const category = SOURCE_CATEGORIES[source.category];
  return category ? category.majorCategory : null;
}

// 🔧 新增：根据大分类获取支持的网站类型
export function getSupportedSiteTypesByMajorCategory(majorCategoryId) {
  const majorCategory = MAJOR_CATEGORIES[majorCategoryId];
  return majorCategory ? majorCategory.supportedSiteTypes : [];
}

// 🔧 新增：获取大分类的默认网站类型
export function getDefaultSiteTypeForMajorCategory(majorCategoryId) {
  const majorCategory = MAJOR_CATEGORIES[majorCategoryId];
  return majorCategory ? majorCategory.defaultSiteType : 'search';
}

// 新增：详情提取配置相关工具函数
export function getDetailConfigEndpoint(endpoint) {
  return APP_CONSTANTS.DETAIL_CONFIG_ENDPOINTS[endpoint.toUpperCase()];
}

export function isDetailExtractionEnabled() {
  // 这个函数现在应该通过 DetailConfigAPI 来获取用户配置
  // 这里只返回系统级开关状态
  return true; // 系统级默认可用，具体用户配置由 detail-config-api.js 管理
}

// 🔧 新增：URL验证工具函数
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

// 🔧 新增：获取网站类型标签
export function getSiteTypeLabel(siteType) {
  const labels = {
    [SITE_TYPES.SEARCH]: '搜索源',
    [SITE_TYPES.BROWSE]: '浏览站',
    [SITE_TYPES.REFERENCE]: '参考站'
  };
  return labels[siteType] || '搜索源';
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
  
  return warnings;
}

// 默认导出 - 保持向后兼容
export default APP_CONSTANTS;