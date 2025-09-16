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
    extractionPriority: 'high',
    typicalCapabilities: ['screenshots', 'actresses', 'metadata', 'rating']
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
    typicalCapabilities: ['screenshots', 'downloadLinks', 'actresses', 'metadata']
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
    typicalCapabilities: ['magnetLinks', 'downloadLinks', 'metadata']
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
    typicalCapabilities: []
  },
  tools: {
    id: 'tools',
    name: '🔧 专业工具',
    description: '自动化工具和媒体管理资源',
    icon: '🔧',
    color: '#ef4444',
    isBuiltin: true,
    order: 5,
    supportsDetailExtraction: false,
    extractionPriority: 'none',
    typicalCapabilities: []
  },
  gallery: {
    id: 'gallery',
    name: '🖼️ 图片资源',
    description: '高清剧照、截图和写真集',
    icon: '🖼️',
    color: '#06b6d4',
    isBuiltin: true,
    order: 6,
    supportsDetailExtraction: true,
    extractionPriority: 'medium',
    typicalCapabilities: ['screenshots', 'actresses', 'metadata']
  },
  review: {
    id: 'review',
    name: '⭐ 评测推荐',
    description: '专业评测文章和排行榜',
    icon: '⭐',
    color: '#f97316',
    isBuiltin: true,
    order: 7,
    supportsDetailExtraction: false,
    extractionPriority: 'none',
    typicalCapabilities: []
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
    typicalCapabilities: []
  }
},

// 增强版搜索源 - 保持完整功能，完善详情提取支持标识
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
    supportedFeatures: ['screenshots', 'downloadLinks', 'magnetLinks', 'actresses', 'metadata', 'description', 'rating', 'tags']
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
    supportedFeatures: ['screenshots', 'magnetLinks', 'actresses', 'metadata', 'description', 'rating', 'tags']
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
    supportedFeatures: []
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
    supportedFeatures: []
  },
  {
    id: 'javtrailers',
    name: 'JavTrailers',
    subtitle: '预告片资源丰富，支持预览',
    icon: '📽️',
    urlTemplate: 'https://javtrailers.com/search/{keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 5,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 3200,
    supportedFeatures: ['screenshots', 'actresses', 'metadata', 'description', 'tags']
  },
  {
    id: 'javmodel',
    name: 'JavModel',
    subtitle: '女优资料详细，照片高清',
    icon: '👩',
    urlTemplate: 'https://javmodel.com/search?q={keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 6,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 2800,
    supportedFeatures: ['screenshots', 'actresses', 'metadata', 'rating']
  },
  {
    id: 'javboss',
    name: 'JavBoss',
    subtitle: '界面现代化，搜索功能强大',
    icon: '💼',
    urlTemplate: 'https://javboss.com/search/{keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 7,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 3500,
    supportedFeatures: ['screenshots', 'actresses', 'metadata', 'description']
  },
  {
    id: 'javbangers',
    name: 'JavBangers',
    subtitle: '评分系统完善，用户互动性强',
    icon: '💥',
    urlTemplate: 'https://javbangers.com/search?keyword={keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 8,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javdude',
    name: 'JavDude',
    subtitle: '更新速度快，资源覆盖全面',
    icon: '🤵',
    urlTemplate: 'https://javdude.com/search/{keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 9,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'warashiasian',
    name: 'Warashi-Asian-Pornstars',
    subtitle: '亚洲女优专业资料库',
    icon: '👸',
    urlTemplate: 'https://warashi-asian-pornstars.fr/en/s/{keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 10,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'asianscreens',
    name: 'AsianScreens',
    subtitle: '截图资源丰富，画质优秀',
    icon: '📺',
    urlTemplate: 'https://asianscreens.com/search/{keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 11,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javseenit',
    name: 'JavSeenIt',
    subtitle: '用户标记系统，个性化推荐',
    icon: '👁️',
    urlTemplate: 'https://javseenit.com/search?q={keyword}',
    category: 'database',
    isBuiltin: true,
    priority: 12,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 3500,
    supportedFeatures: ['screenshots', 'downloadLinks', 'actresses', 'metadata', 'description', 'tags']
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
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 4500,
    supportedFeatures: ['screenshots', 'downloadLinks', 'magnetLinks', 'actresses', 'metadata', 'description']
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 4500,
    supportedFeatures: ['screenshots', 'actresses', 'metadata']
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
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 5000,
    supportedFeatures: ['screenshots', 'actresses']
  },
  {
    id: 'spankbang',
    name: 'SpankBang',
    subtitle: '国际知名平台，资源多样化',
    icon: '🌍',
    urlTemplate: 'https://spankbang.com/s/{keyword}/',
    category: 'streaming',
    isBuiltin: true,
    priority: 9,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'xvideos',
    name: 'Xvideos',
    subtitle: '全球最大成人视频平台之一',
    icon: '🌐',
    urlTemplate: 'https://www.xvideos.com/?k={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 10,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'pornhub',
    name: 'Pornhub',
    subtitle: '用户上传内容丰富，互动性强',
    icon: '🔶',
    urlTemplate: 'https://www.pornhub.com/video/search?search={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 11,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'xnxx',
    name: 'XNXX',
    subtitle: '老牌平台，稳定可靠',
    icon: '🔸',
    urlTemplate: 'https://www.xnxx.com/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 12,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javhdtoday',
    name: 'JavHD.today',
    subtitle: '高清资源专门站点',
    icon: '📱',
    urlTemplate: 'https://javhd.today/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 13,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 3800,
    supportedFeatures: ['screenshots', 'downloadLinks', 'actresses', 'metadata']
  },
  {
    id: 'javfree',
    name: 'JavFree',
    subtitle: '免费资源平台，无需注册',
    icon: '🆓',
    urlTemplate: 'https://javfree.me/search?q={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 14,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 4200,
    supportedFeatures: ['screenshots', 'actresses', 'metadata']
  },
  {
    id: 'superjav',
    name: 'SuperJAV',
    subtitle: '分类详细，搜索便捷',
    icon: '🦸',
    urlTemplate: 'https://superjav.com/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 15,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javbabe',
    name: 'JavBabe',
    subtitle: '界面友好，播放流畅',
    icon: '👶',
    urlTemplate: 'https://javbabe.com/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 16,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'hclips',
    name: 'HClips',
    subtitle: '高清资源，缓存速度快',
    icon: '📎',
    urlTemplate: 'https://hclips.com/search/{keyword}/',
    category: 'streaming',
    isBuiltin: true,
    priority: 17,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javleak',
    name: 'JavLeak',
    subtitle: '独家资源，更新及时',
    icon: '💧',
    urlTemplate: 'https://javleak.com/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 18,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'tokyohot',
    name: 'Tokyo-Hot',
    subtitle: '日本本土知名品牌官方站',
    icon: '🗾',
    urlTemplate: 'https://www.tokyo-hot.com/search?keyword={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 19,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'caribbean',
    name: 'Caribbean',
    subtitle: '加勒比海品牌官方平台',
    icon: '🏝️',
    urlTemplate: 'https://www.caribbeancom.com/search/{keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 20,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: '1pondo',
    name: '1Pondo',
    subtitle: '一本道官方网站',
    icon: '1️⃣',
    urlTemplate: 'https://www.1pondo.tv/search/?keyword={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 21,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'fc2ppv',
    name: 'FC2-PPV',
    subtitle: '个人制作视频平台',
    icon: '🔤',
    urlTemplate: 'https://adult.contents.fc2.com/search/?keyword={keyword}',
    category: 'streaming',
    isBuiltin: true,
    priority: 22,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportedFeatures: []
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
    supportedFeatures: []
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
    supportedFeatures: []
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
    supportedFeatures: ['downloadLinks', 'magnetLinks', 'metadata', 'description', 'tags']
  },
  {
    id: 'btdigg',
    name: 'BTDigg',
    subtitle: '老牌磁力搜索引擎，索引庞大',
    icon: '⛏️',
    urlTemplate: 'https://btdigg.org/search?q={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 5,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'zooqle',
    name: 'Zooqle',
    subtitle: '界面现代化，搜索精准',
    icon: '🔍',
    urlTemplate: 'https://zooqle.com/search?q={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 6,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'torrentproject',
    name: 'TorrentProject',
    subtitle: '种子资源聚合平台',
    icon: '📂',
    urlTemplate: 'https://torrentproject.se/?s={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 7,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'torlock',
    name: 'Torlock',
    subtitle: '验证种子质量，安全可靠',
    icon: '🔒',
    urlTemplate: 'https://www.torlock.com/search/{keyword}/1.html',
    category: 'torrent',
    isBuiltin: true,
    priority: 8,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'extratorrents',
    name: 'ExtraTorrent',
    subtitle: '资源分类详细，下载量显示',
    icon: '➕',
    urlTemplate: 'https://extratorrent.si/search/?search={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 9,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'limetorrents',
    name: 'LimeTorrents',
    subtitle: '绿色界面，用户友好',
    icon: '🍋',
    urlTemplate: 'https://www.limetorrents.lol/search/all/{keyword}/',
    category: 'torrent',
    isBuiltin: true,
    priority: 10,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'torrentz2',
    name: 'Torrentz2',
    subtitle: '多源搜索聚合器',
    icon: '2️⃣',
    urlTemplate: 'https://torrentz2.eu/search?f={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 11,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'skytorrents',
    name: 'SkyTorrents',
    subtitle: '无广告，搜索快速',
    icon: '☁️',
    urlTemplate: 'https://www.skytorrents.lol/search/all/ed/1/?search={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 12,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'nyaasi',
    name: 'Nyaa.si',
    subtitle: '亚洲内容种子站',
    icon: '🐾',
    urlTemplate: 'https://nyaa.si/?q={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 13,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 5500,
    supportedFeatures: ['downloadLinks', 'magnetLinks', 'metadata', 'description']
  },
  {
    id: 'tokyotosho',
    name: 'TokyoTosho',
    subtitle: '日本内容专门站',
    icon: '🗼',
    urlTemplate: 'https://www.tokyotosho.info/search.php?terms={keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 14,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javtorrent',
    name: 'JavTorrent',
    subtitle: '专门的JAV种子搜索',
    icon: '🔍',
    urlTemplate: 'https://javtorrent.re/search/{keyword}',
    category: 'torrent',
    isBuiltin: true,
    priority: 15,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
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
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: '91pornforum',
    name: '91porn论坛',
    subtitle: '用户活跃度高，讨论热烈',
    icon: '9️⃣',
    urlTemplate: 'https://91porn.com/search?keyword={keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 3,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'caoliu',
    name: '草榴社区',
    subtitle: '历史悠久，影响力大',
    icon: '🌿',
    urlTemplate: 'https://caoliu.com/search?keyword={keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 4,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'sis001',
    name: '第一会所',
    subtitle: '资源分享活跃，分类详细',
    icon: '🏢',
    urlTemplate: 'https://sis001.com/search?q={keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 5,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'yese',
    name: '夜色',
    subtitle: '综合性社区，内容多样',
    icon: '🌃',
    urlTemplate: 'https://yese.org/search/{keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 6,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'playboyforum',
    name: '花花公子论坛',
    subtitle: '国际化社区，质量较高',
    icon: '🐰',
    urlTemplate: 'https://playboy.com/search?q={keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 7,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'avwolfforum',
    name: 'AV狼论坛',
    subtitle: '专业讨论，资源评价详细',
    icon: '🐺',
    urlTemplate: 'https://avwolf.com/search/{keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 8,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javforum',
    name: 'JavForum',
    subtitle: '英文社区，国际用户多',
    icon: '🌐',
    urlTemplate: 'https://javforum.com/search/{keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 9,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'asiaadultforum',
    name: 'Asia-Adult-Forum',
    subtitle: '亚洲成人内容专门论坛',
    icon: '🌏',
    urlTemplate: 'https://asia-adult-forum.com/search?keyword={keyword}',
    category: 'community',
    isBuiltin: true,
    priority: 10,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  
  // 专业工具
  {
    id: 'javscript',
    name: 'JavScript',
    subtitle: '自动化下载脚本分享',
    icon: '📜',
    urlTemplate: 'https://javscript.org/search/{keyword}',
    category: 'tools',
    isBuiltin: true,
    priority: 1,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javscraper',
    name: 'JavScraper',
    subtitle: '刮削器工具资源',
    icon: '🔧',
    urlTemplate: 'https://github.com/javscraper/search?q={keyword}',
    category: 'tools',
    isBuiltin: true,
    priority: 2,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'embyjav',
    name: 'Emby-JAV',
    subtitle: '媒体服务器插件资源',
    icon: '📺',
    urlTemplate: 'https://github.com/emby-jav/search?q={keyword}',
    category: 'tools',
    isBuiltin: true,
    priority: 3,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'kodijav',
    name: 'Kodi-JAV',
    subtitle: 'Kodi插件和主题',
    icon: '📱',
    urlTemplate: 'https://kodi-jav.com/search/{keyword}',
    category: 'tools',
    isBuiltin: true,
    priority: 4,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'stashjav',
    name: 'Stash-JAV',
    subtitle: '个人媒体管理工具',
    icon: '📦',
    urlTemplate: 'https://stash-jav.com/search/{keyword}',
    category: 'tools',
    isBuiltin: true,
    priority: 5,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  
  // 图片资源
  {
    id: 'javpics',
    name: 'JavPics',
    subtitle: '高清剧照截图',
    icon: '📸',
    urlTemplate: 'https://javpics.com/search/{keyword}',
    category: 'gallery',
    isBuiltin: true,
    priority: 1,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 2800,
    supportedFeatures: ['screenshots', 'actresses', 'metadata']
  },
  {
    id: 'javgallery',
    name: 'JavGallery',
    subtitle: '女优写真集合',
    icon: '🖼️',
    urlTemplate: 'https://javgallery.com/search?q={keyword}',
    category: 'gallery',
    isBuiltin: true,
    priority: 2,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'good',
    averageExtractionTime: 3200,
    supportedFeatures: ['screenshots', 'actresses', 'metadata']
  },
  {
    id: 'asianbabecams',
    name: 'AsianBabeCams',
    subtitle: '实时直播平台',
    icon: '📹',
    urlTemplate: 'https://asianbabecams.com/search/{keyword}',
    category: 'gallery',
    isBuiltin: true,
    priority: 3,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javsnapshot',
    name: 'JavSnapshot',
    subtitle: '精选截图收集',
    icon: '📷',
    urlTemplate: 'https://javsnapshot.com/search/{keyword}',
    category: 'gallery',
    isBuiltin: true,
    priority: 4,
    isActive: true,
    supportsDetailExtraction: true,
    extractionQuality: 'fair',
    averageExtractionTime: 3500,
    supportedFeatures: ['screenshots', 'metadata']
  },
  
  // 评测推荐
  {
    id: 'javreviews',
    name: 'JAVReviews',
    subtitle: '专业评测文章',
    icon: '📝',
    urlTemplate: 'https://javreviews.com/search/{keyword}',
    category: 'review',
    isBuiltin: true,
    priority: 1,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'bestjav',
    name: 'BestJAV',
    subtitle: '排行榜和推荐',
    icon: '🏆',
    urlTemplate: 'https://bestjav.com/search?keyword={keyword}',
    category: 'review',
    isBuiltin: true,
    priority: 2,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'javrating',
    name: 'JavRating',
    subtitle: '用户评分系统',
    icon: '⭐',
    urlTemplate: 'https://javrating.com/search/{keyword}',
    category: 'review',
    isBuiltin: true,
    priority: 3,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  },
  {
    id: 'topjav',
    name: 'TopJAV',
    subtitle: '热门内容排行',
    icon: '🔥',
    urlTemplate: 'https://topjav.com/search?q={keyword}',
    category: 'review',
    isBuiltin: true,
    priority: 4,
    isActive: true,
    supportsDetailExtraction: false,
    extractionQuality: 'none',
    averageExtractionTime: 0,
    supportedFeatures: []
  }
  ],
  
  // 搜索源和分类验证规则 - 保持不变
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
    '🱡', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲'
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
      AVERAGE_TIME: 'average_time'
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
      FAST_EXTRACTION: 'fast_extraction'
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

// 新增：详情提取配置相关工具函数
export function getDetailConfigEndpoint(endpoint) {
  return APP_CONSTANTS.DETAIL_CONFIG_ENDPOINTS[endpoint.toUpperCase()];
}

export function isDetailExtractionEnabled() {
  // 这个函数现在应该通过 DetailConfigAPI 来获取用户配置
  // 这里只返回系统级开关状态
  return true; // 系统级默认启用，具体用户配置由 detail-config-api.js 管理
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