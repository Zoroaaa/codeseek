// src/core/constants.js - 增强版：新增更多高质量搜索源
// 详情提取配置已迁移至 detail-config.js，由 detail-config-api.js 动态管理

export const APP_CONSTANTS = {
  // 应用信息 - 保持不变
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '1.5.1', // 版本升级，新增更多搜索源
  
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
    // 详情提取相关缓存
    DETAIL_EXTRACTION_CACHE: 'detail_extraction_cache',
    DETAIL_CONFIG_CACHE: 'detail_config_cache',
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats',
    DETAIL_USER_PREFERENCES: 'detail_user_preferences'
  },
  
  // API配置 - 保持原有功能
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

  // 支持详情提取的搜索源 - 扩充
  DETAIL_EXTRACTION_SOURCES: [
    'javbus', 'javdb', 'jable', 'javmost', 
    'javgg', 'sukebei', 'javguru', 'javhub',
    'javdock', 'javdatabase', 'javtiful', 'javtrailers'
  ],

  // 详情提取源能力映射 - 扩充
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
    },
    'javhub': {
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
    'javdock': {
      screenshots: true,
      downloadLinks: false,
      magnetLinks: false,
      actresses: true,
      metadata: true,
      description: true,
      rating: true,
      tags: true,
      quality: 'good'
    },
    'javdatabase': {
      screenshots: true,
      downloadLinks: false,
      magnetLinks: false,
      actresses: true,
      metadata: true,
      description: true,
      rating: false,
      tags: true,
      quality: 'fair'
    },
    'javtiful': {
      screenshots: true,
      downloadLinks: true,
      magnetLinks: false,
      actresses: true,
      metadata: true,
      description: true,
      rating: true,
      tags: true,
      quality: 'excellent'
    },
    'javtrailers': {
      screenshots: true,
      downloadLinks: true,
      magnetLinks: true,
      actresses: true,
      metadata: true,
      description: true,
      rating: true,
      tags: true,
      quality: 'good'
    }
  },

  // 搜索源分类定义 - 新增下载站分类
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
    download: {
      id: 'download',
      name: '💾 下载专站',
      description: '专门提供高质量视频下载服务',
      icon: '💾',
      color: '#06b6d4',
      isBuiltin: true,
      order: 4,
      supportsDetailExtraction: true,
      extractionPriority: 'medium',
      typicalCapabilities: ['downloadLinks', 'screenshots', 'metadata']
    },
    community: {
      id: 'community',
      name: '💬 社区论坛',
      description: '用户交流讨论和资源分享',
      icon: '💬',
      color: '#8b5cf6',
      isBuiltin: true,
      order: 5,
      supportsDetailExtraction: false,
      extractionPriority: 'none',
      typicalCapabilities: []
    },
    search_engine: {
      id: 'search_engine',
      name: '🔍 聚合搜索',
      description: '多源聚合搜索引擎',
      icon: '🔍',
      color: '#ec4899',
      isBuiltin: true,
      order: 6,
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
  
  // 增强版搜索源 - 大幅扩充，新增基于互联网搜索的高质量真实网站
  SEARCH_SOURCES: [
    // 番号资料站 - 扩充
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
      id: 'javhub',
      name: 'JavHub',
      subtitle: '全面资料库，数据准确',
      icon: '🏢',
      urlTemplate: 'https://javhub.net/search?q={keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 5,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 3200,
      supportedFeatures: ['screenshots', 'magnetLinks', 'actresses', 'metadata', 'description', 'rating', 'tags']
    },
    {
      id: 'javdock',
      name: 'JavDock',
      subtitle: '简洁界面，搜索快捷',
      icon: '⚓',
      urlTemplate: 'https://javdock.com/search/{keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 6,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 2800,
      supportedFeatures: ['screenshots', 'actresses', 'metadata', 'description', 'rating', 'tags']
    },
    {
      id: 'javdatabase',
      name: 'JAV Database',
      subtitle: '专业数据库，信息详实',
      icon: '🗄️',
      urlTemplate: 'https://javdatabase.com/search?q={keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 7,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 3500,
      supportedFeatures: ['screenshots', 'actresses', 'metadata', 'description', 'tags']
    },
    // 新增数据库源
    {
      id: 'sougouwiki',
      name: 'SougouWiki',
      subtitle: '日文番号百科，详细女优资料',
      icon: '📘',
      urlTemplate: 'http://sougouwiki.com/index.php?search={keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 8,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 4000,
      supportedFeatures: ['actresses', 'metadata', 'description', 'tags']
    },
    {
      id: 'warashi',
      name: 'Warashi Database',
      subtitle: '全面JAV数据库，包括男优信息',
      icon: '🗃️',
      urlTemplate: 'https://warashi.moe/search?q={keyword}',
      category: 'database',
      isBuiltin: true,
      priority: 9,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    
    // 在线播放平台 - 扩充
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
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 4000,
      supportedFeatures: ['screenshots', 'downloadLinks', 'actresses', 'metadata']
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
    // 新增流媒体源
    {
      id: 'javtiful',
      name: 'JavTiful',
      subtitle: '高清JAV在线观看和下载',
      icon: '🌟',
      urlTemplate: 'https://javtiful.com/search?q={keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 9,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'excellent',
      averageExtractionTime: 3000,
      supportedFeatures: ['screenshots', 'downloadLinks', 'actresses', 'metadata', 'description', 'rating', 'tags']
    },
    {
      id: 'javtrailers',
      name: 'JavTrailers',
      subtitle: '完整JAV预览和下载',
      icon: '🎞️',
      urlTemplate: 'https://javtrailers.com/search/{keyword}',
      category: 'streaming',
      isBuiltin: true,
      priority: 10,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 3500,
      supportedFeatures: ['screenshots', 'downloadLinks', 'magnetLinks', 'actresses', 'metadata']
    },
    
    // 磁力搜索 - 扩充
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
      icon: '🱡',
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
      id: 'nyaasi',
      name: 'Nyaa.si',
      subtitle: '亚洲媒体种子站，质量可靠',
      icon: '🐱',
      urlTemplate: 'https://nyaa.si/?f=0&c=0_0&q={keyword}',
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
      id: 'nyaaland',
      name: 'Nyaa.land',
      subtitle: 'Nyaa镜像站，稳定可靠',
      icon: '🏝️',
      urlTemplate: 'https://nyaa.land/?f=0&c=0_0&q={keyword}',
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
      id: '1337x',
      name: '1337x',
      subtitle: '知名种子站，资源丰富',
      icon: '☠️',
      urlTemplate: 'https://1337x.to/search/{keyword}/1/',
      category: 'torrent',
      isBuiltin: true,
      priority: 7,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    // 新增种子源
    {
      id: 'ijavtorrent',
      name: 'iJavTorrent',
      subtitle: 'JAV专用种子库，高清资源',
      icon: '🧲',
      urlTemplate: 'https://ijavtorrent.com/search/{keyword}',
      category: 'torrent',
      isBuiltin: true,
      priority: 8,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: ['magnetLinks', 'downloadLinks']
    },
    
    // 下载专站 - 新增分类
    {
      id: 'javhd',
      name: 'JavHD',
      subtitle: '高清视频下载，画质优秀',
      icon: '📹',
      urlTemplate: 'https://javhd.today/search/{keyword}',
      category: 'download',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 4000,
      supportedFeatures: ['downloadLinks', 'screenshots', 'metadata']
    },
    {
      id: 'javfull',
      name: 'JavFull',
      subtitle: '完整版本下载，无删减',
      icon: '🎯',
      urlTemplate: 'https://javfull.net/search/{keyword}',
      category: 'download',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 4200,
      supportedFeatures: ['downloadLinks', 'screenshots', 'metadata']
    },
    {
      id: 'jav720',
      name: 'JAV720',
      subtitle: '720P高清下载，文件适中',
      icon: '📱',
      urlTemplate: 'https://jav720.com/search/{keyword}',
      category: 'download',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'fair',
      averageExtractionTime: 4500,
      supportedFeatures: ['downloadLinks', 'screenshots', 'metadata']
    },
    // 新增下载源
    {
      id: 'javtsunami',
      name: 'JavTsunami',
      subtitle: '高清JAV下载和流媒体',
      icon: '🌊',
      urlTemplate: 'https://javtsunami.com/search?q={keyword}',
      category: 'download',
      isBuiltin: true,
      priority: 4,
      isActive: true,
      supportsDetailExtraction: true,
      extractionQuality: 'good',
      averageExtractionTime: 3800,
      supportedFeatures: ['downloadLinks', 'screenshots', 'metadata', 'description']
    },
    
    // 社区论坛 - 扩充
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
      id: 'sis001',
      name: 'SIS001',
      subtitle: '第一会所，老牌资源论坛',
      icon: '🏛️',
      urlTemplate: 'https://sis001.com/forum/search.php?searchsubmit=yes&srchtxt={keyword}',
      category: 'community',
      isBuiltin: true,
      priority: 3,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    // 新增社区源
    {
      id: 'javforum',
      name: 'JAV-Forum',
      subtitle: 'JAV粉丝讨论社区',
      icon: '💬',
      urlTemplate: 'https://www.jav-forum.com/search/{keyword}',
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
      id: 'akibaonline',
      name: 'Akiba-Online',
      subtitle: 'JAV讨论和资源分享论坛',
      icon: '🎌',
      urlTemplate: 'https://www.akiba-online.com/forums/search/{keyword}',
      category: 'community',
      isBuiltin: true,
      priority: 5,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    
    // 聚合搜索 - 新增分类
    {
      id: 'javgle',
      name: 'Javgle',
      subtitle: '多源聚合搜索，结果全面',
      icon: '🌐',
      urlTemplate: 'https://javgle.com/search/{keyword}',
      category: 'search_engine',
      isBuiltin: true,
      priority: 1,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    {
      id: 'javsearch',
      name: 'JavSearch',
      subtitle: '智能聚合搜索引擎',
      icon: '🔎',
      urlTemplate: 'https://javsearch.mobi/search/{keyword}',
      category: 'search_engine',
      isBuiltin: true,
      priority: 2,
      isActive: true,
      supportsDetailExtraction: false,
      extractionQuality: 'none',
      averageExtractionTime: 0,
      supportedFeatures: []
    },
    {
      id: 'javmega',
      name: 'JavMega',
      subtitle: '超级搜索引擎，覆盖多站',
      icon: '🚀',
      urlTemplate: 'https://javmega.co/search/{keyword}',
      category: 'search_engine',
      isBuiltin: true,
      priority: 3,
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
  
  // 默认颜色选项 - 扩充
  DEFAULT_COLORS: [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#eab308',
    '#64748b', '#dc2626', '#059669', '#7c3aed',
    '#be185d', '#0891b2', '#65a30d', '#ea580c'
  ],
  
  // 默认图标选项 - 扩充
  DEFAULT_ICONS: [
    '📚', '🎥', '🧲', '💬', '🌟', '🔍', '📺', '🎬',
    '🎭', '🎪', '🎦', '🎬', '⚡', '💫', '🌙', '🔗',
    '🱡', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲',
    '💾', '📹', '🏢', '⚓', '🗄️', '🐱', '🏝️', '☠️',
    '📱', '🌐', '🔎', '🚀', '🎪', '🏛️', '🔥', '💎'
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
    // 详情提取权限
    DETAIL_EXTRACTION: 'detail_extraction',
    DETAIL_EXTRACTION_BATCH: 'detail_extraction_batch',
    DETAIL_EXTRACTION_HISTORY: 'detail_extraction_history',
    DETAIL_EXTRACTION_CACHE_MANAGEMENT: 'detail_extraction_cache_management',
    DETAIL_EXTRACTION_CONFIG: 'detail_extraction_config',
    DETAIL_EXTRACTION_STATS: 'detail_extraction_stats'
  },
  
  // 用户行为追踪事件 - 保持不变
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
    DETAIL_CONFIG_UPDATED: 'detail_config_updated',
    DETAIL_CONFIG_RESET: 'detail_config_reset',
    DETAIL_CONFIG_PRESET_APPLIED: 'detail_config_preset_applied'
  },
  
  // 错误代码定义 - 保持不变
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
    DETAIL_CONFIG_VALIDATION_ERROR: 'DETAIL_CONFIG_VALIDATION_ERROR',
    DETAIL_CONFIG_SAVE_ERROR: 'DETAIL_CONFIG_SAVE_ERROR',
    DETAIL_CONFIG_LOAD_ERROR: 'DETAIL_CONFIG_LOAD_ERROR',
    DETAIL_CONFIG_PRESET_NOT_FOUND: 'DETAIL_CONFIG_PRESET_NOT_FOUND'
  },
  
  // 默认用户设置 - 保持不变
  DEFAULT_USER_SETTINGS: {
    theme: 'auto',
    searchSources: ['javbus', 'javdb', 'javlibrary', 'jable'],
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
  },
  
  // 搜索源管理相关常量 - 扩充排序和筛选选项
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
      POPULARITY: 'popularity',
      LAST_UPDATED: 'last_updated'
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
      DATABASE: 'database_category',
      STREAMING: 'streaming_category',
      TORRENT: 'torrent_category',
      DOWNLOAD: 'download_category',
      COMMUNITY: 'community_category',
      SEARCH_ENGINE: 'search_engine_category'
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
    USER_AGENT: 'MagnetSearch/1.5.1 StatusChecker'
  },

  // 详情提取配置 - 保持不变
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
    
    // 内容验证规则
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
    
    // 性能优化设置
    PERFORMANCE: {
      PREFETCH_ENABLED: false,
      LAZY_LOADING: true,
      IMAGE_COMPRESSION: true,
      CACHE_PRELOAD: false,
      BACKGROUND_PROCESSING: false,
      QUEUE_PROCESSING: true,
      MEMORY_OPTIMIZATION: true
    },
    
    // 错误处理配置
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

  // 详情提取配置API端点
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

// 工具函数 - 扩充功能
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

export function getSourcesByQuality(quality) {
  return SEARCH_SOURCES.filter(source => source.extractionQuality === quality);
}

export function getSourcesByAverageTime(maxTime) {
  return SEARCH_SOURCES.filter(source => 
    source.averageExtractionTime > 0 && source.averageExtractionTime <= maxTime
  );
}

export function getCategoryStats() {
  const stats = {};
  Object.keys(SOURCE_CATEGORIES).forEach(categoryId => {
    const sourcesInCategory = getSourceByCategory(categoryId);
    stats[categoryId] = {
      totalSources: sourcesInCategory.length,
      activeSources: sourcesInCategory.filter(s => s.isActive).length,
      supportingDetail: sourcesInCategory.filter(s => s.supportsDetailExtraction).length,
      builtinSources: sourcesInCategory.filter(s => s.isBuiltin).length
    };
  });
  return stats;
}

export function getDetailConfigEndpoint(endpoint) {
  return APP_CONSTANTS.DETAIL_CONFIG_ENDPOINTS[endpoint.toUpperCase()];
}

export function isDetailExtractionEnabled() {
  return true; // 系统级默认启用
}

export function validateLegacySettings(settings) {
  const warnings = [];
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

// 新增工具函数
export function getHighQualitySources() {
  return SEARCH_SOURCES.filter(source => 
    source.extractionQuality === 'excellent' || source.extractionQuality === 'good'
  );
}

export function getFastExtractionSources(maxTime = 3000) {
  return SEARCH_SOURCES.filter(source => 
    source.supportsDetailExtraction && 
    source.averageExtractionTime > 0 && 
    source.averageExtractionTime <= maxTime
  );
}

export function getRecommendedSources() {
  return SEARCH_SOURCES.filter(source => 
    source.isActive && 
    source.priority <= 3 && 
    (source.extractionQuality === 'excellent' || source.extractionQuality === 'good')
  ).sort((a, b) => a.priority - b.priority);
}

// 默认导出
export default APP_CONSTANTS;