// src/core/constants.js - 清理版本：移除详情提取相关常量
export const APP_CONSTANTS = {
  // 应用信息
  APP_NAME: '磁力快搜',
  DEFAULT_VERSION: '2.3.1',
  
  // 本地存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    CURRENT_USER: 'current_user',
    THEME: 'theme',
    APP_VERSION: 'app_version',
    API_CONFIG: 'api_config',
    SOURCE_STATUS_CACHE: 'source_status_cache'
  },
  
  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    SOURCE_CHECK_TIMEOUT: 8000,
    SOURCE_STATUS_CACHE_DURATION: 300000,
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
    MAX_STATUS_CACHE_DURATION: 3600000
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
      SUPPORTED_SITE_TYPES: ['search', 'browse', 'reference']
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
      SUPPORTED_SITE_TYPES: ['search', 'browse', 'reference']
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
    '📚', '🎥', '🧲', '💬', '🌟', '📍', '📺', '🎬',
    '🎭', '🎪', '🎦', '🎬', '⚡', '💫', '🌙', '🔗',
    '🎱', '🌸', '📋', '🎯', '🎨', '🎵', '🎮', '🎲'
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
    PREMIUM: 'premium'
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
    SEARCH_SOURCES_EXPORTED: 'search_sources_exported'
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
    SOURCE_STATUS_CACHE_EXPIRED: 'SOURCE_STATUS_CACHE_EXPIRED'
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

  // UI配置常量
  UI_CONFIG: {
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
    }
  },

  // 性能监控配置
  PERFORMANCE_MONITORING: {
    ENABLED: true,
    METRICS: {
      RENDER_TIME: true,
      NETWORK_TIME: true,
      MEMORY_USAGE: true,
      ERROR_RATE: true
    },
    SAMPLING_RATE: 0.1,
    BATCH_SIZE: 100,
    FLUSH_INTERVAL: 300000
  }
};

// 导出常用常量
export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const THEMES = APP_CONSTANTS.THEMES;
export const DEFAULT_USER_SETTINGS = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
export const PERMISSIONS = APP_CONSTANTS.PERMISSIONS;
export const ERROR_CODES = APP_CONSTANTS.ERROR_CODES;
export const ANALYTICS_EVENTS = APP_CONSTANTS.ANALYTICS_EVENTS;
export const VALIDATION_RULES = APP_CONSTANTS.VALIDATION_RULES;
export const SOURCE_MANAGEMENT = APP_CONSTANTS.SOURCE_MANAGEMENT;
export const SITE_TYPES = APP_CONSTANTS.SITE_TYPES;

// 工具函数
export function getStorageKey(key) {
  return STORAGE_KEYS[key] || key;
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

// 向后兼容性检查函数
export function validateLegacySettings(settings) {
  const warnings = [];
  
  // 检查是否使用了已迁移的搜索源配置
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