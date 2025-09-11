// src/core/constants.js - 更新版本：移除详情提取硬编码配置，只保留系统级别常量
// 详情提取配置已迁移至 detail-config.js 和 detail-config-api.js

export const APP_CONSTANTS = {
  // 应用基本信息
  APP_NAME: '磁力快搜',
  VERSION: '3.0.0',
  
  // 本地存储键名
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    USER_SETTINGS: 'user_settings',
    SEARCH_HISTORY: 'search_history',
    FAVORITES: 'favorites',
    THEME: 'app_theme',
    LAST_SYNC: 'last_sync_time',
    // 详情提取相关的本地存储已移至 detail-api.js 管理
    DETAIL_CACHE: 'detail_extraction_cache',
    CONFIG_CACHE: 'detail_config_cache'
  },

  // API端点 - 添加详情配置相关端点
  API_ENDPOINTS: {
    // 认证相关
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      VERIFY: '/api/auth/verify-token',
      REFRESH: '/api/auth/refresh',
      LOGOUT: '/api/auth/logout',
      CHANGE_PASSWORD: '/api/auth/change-password',
      DELETE_ACCOUNT: '/api/auth/delete-account'
    },
    
    // 用户相关
    USER: {
      SETTINGS: '/api/user/settings',
      FAVORITES: '/api/user/favorites',
      SEARCH_HISTORY: '/api/user/search-history',
      SEARCH_STATS: '/api/user/search-stats'
    },
    
    // 系统相关
    SYSTEM: {
      HEALTH: '/api/health',
      CONFIG: '/api/config',
      SEARCH_SOURCES: '/api/search-sources'
    },
    
    // 搜索源状态检查
    SOURCE_STATUS: {
      CHECK: '/api/source-status/check',
      HISTORY: '/api/source-status/history'
    },
    
    // 社区相关
    COMMUNITY: {
      TAGS: '/api/community/tags',
      SOURCES: '/api/community/sources',
      SEARCH: '/api/community/search',
      USER_STATS: '/api/community/user/stats'
    },
    
    // 详情提取相关 - 引用详情配置常量
    DETAIL: {
      EXTRACT_SINGLE: '/api/detail/extract-single',
      EXTRACT_BATCH: '/api/detail/extract-batch',
      HISTORY: '/api/detail/history',
      STATS: '/api/detail/stats',
      CACHE_STATS: '/api/detail/cache/stats',
      CACHE_CLEAR: '/api/detail/cache/clear',
      CACHE_DELETE: '/api/detail/cache/delete',
      // 配置管理端点 - 从 detail-config.js 导入
      CONFIG: '/api/detail/config',
      CONFIG_RESET: '/api/detail/config/reset',
      CONFIG_PRESET: '/api/detail/config/preset'
    },
    
    // 行为记录
    ACTIONS: {
      RECORD: '/api/actions/record'
    }
  },

  // 系统级别的最大限制（安全相关，不可修改）
  SYSTEM_LIMITS: {
    MAX_FAVORITES_PER_USER: 1000,
    MAX_HISTORY_PER_USER: 1000,
    MAX_CUSTOM_SOURCES_PER_USER: 50,
    MAX_TAGS_PER_USER: 50,
    MAX_SHARES_PER_USER: 50,
    
    // 详情提取的系统级技术限制（与后端 constants.js 同步）
    DETAIL_EXTRACTION: {
      MAX_BATCH_SIZE: 20,
      MIN_BATCH_SIZE: 1,
      MAX_TIMEOUT: 30000,
      MIN_TIMEOUT: 5000,
      MAX_CACHE_DURATION: 604800000, // 7天
      MIN_CACHE_DURATION: 3600000, // 1小时
      MAX_CONCURRENT_EXTRACTIONS: 4,
      
      // 性能和安全限制
      PARSE_TIMEOUT: 10000,
      MAX_RETRY_ATTEMPTS: 3,
      RETRY_DELAY: 1000,
      
      // 缓存系统限制
      CACHE_MAX_SIZE: 1000,
      CACHE_CLEANUP_INTERVAL: 3600000, // 1小时
      HTML_PARSER_CACHE_SIZE: 100,
      
      // 内容数量限制（防止过载）
      MAX_GENERIC_LINKS_PER_PAGE: 150,
      MAX_DOWNLOAD_LINKS: 15,
      MAX_MAGNET_LINKS: 15,
      MAX_SCREENSHOTS: 20
    }
  },

  // 默认用户设置（非详情提取相关）
  DEFAULT_USER_SETTINGS: {
    // 界面设置
    theme: 'auto', // light, dark, auto
    language: 'zh-CN',
    
    // 搜索设置
    searchSources: [], // 将在运行时从服务器获取
    customSearchSources: [],
    customSourceCategories: [],
    
    // 搜索源状态检查设置
    checkSourceStatus: true,
    sourceStatusCheckTimeout: 10000,
    sourceStatusCacheDuration: 300000, // 5分钟
    skipUnavailableSources: false,
    showSourceStatus: true,
    retryFailedSources: true,
    
    // 隐私设置
    allowAnalytics: true,
    searchSuggestions: true,
    
    // 同步设置
    autoSync: true,
    cacheResults: true,
    maxHistoryPerUser: 1000,
    maxFavoritesPerUser: 1000,
    
    // 注意：详情提取相关设置已移至 detail-config-api.js 管理
    // 这些设置将通过 DetailConfigAPI 动态获取和管理
  },

  // 系统行为枚举（不可变）
  ALLOWED_ACTIONS: [
    'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
    'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
    'sync_data', 'page_view', 'session_start', 'session_end',
    'custom_source_add', 'custom_source_edit', 'custom_source_delete',
    'tag_created', 'tag_updated', 'tag_deleted',
    'detail_extraction', 'batch_detail_extraction', 'detail_cache_access',
    'detail_config_update', 'detail_cache_clear', 'detail_retry',
    'download_click', 'magnet_click', 'copy_magnet', 'image_preview',
    // 新增配置相关行为
    'detail_config_reset', 'detail_config_preset_apply', 'detail_config_validate'
  ],

  // 应用主题配置
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  },

  // 搜索源分类
  SOURCE_CATEGORIES: {
    JAV: 'jav',
    MOVIE: 'movie', 
    TORRENT: 'torrent',
    OTHER: 'other'
  },

  // 网络配置
  NETWORK: {
    REQUEST_TIMEOUT: 10000,
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    RATE_LIMIT_DELAY: 100
  },

  // 缓存配置
  CACHE: {
    SEARCH_RESULTS_TTL: 300000, // 5分钟
    SOURCE_STATUS_TTL: 300000, // 5分钟
    USER_SETTINGS_TTL: 3600000, // 1小时
    // 详情提取缓存配置已移至 detail-config.js
  },

  // 分页配置
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    DEFAULT_HISTORY_LIMIT: 50,
    DEFAULT_FAVORITES_LIMIT: 50
  },

  // 验证规则
  VALIDATION: {
    USERNAME: {
      MIN_LENGTH: 3,
      MAX_LENGTH: 20,
      PATTERN: /^[a-zA-Z0-9_]+$/
    },
    PASSWORD: {
      MIN_LENGTH: 6,
      MAX_LENGTH: 50
    },
    EMAIL: {
      PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    SEARCH_QUERY: {
      MIN_LENGTH: 1,
      MAX_LENGTH: 100
    }
  },

  // UI常量
  UI: {
    TOAST_DURATION: 3000,
    LOADING_DELAY: 200,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 200
  },

  // 错误代码
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTH_ERROR: 'AUTH_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    // 详情提取错误代码
    DETAIL_EXTRACTION_ERROR: 'DETAIL_EXTRACTION_ERROR',
    DETAIL_CONFIG_ERROR: 'DETAIL_CONFIG_ERROR'
  },

  // 功能开关（系统级别）
  FEATURES: {
    ENABLE_REGISTRATION: true,
    ENABLE_SEARCH_HISTORY: true,
    ENABLE_FAVORITES: true,
    ENABLE_CUSTOM_SOURCES: true,
    ENABLE_SOURCE_STATUS_CHECK: true,
    ENABLE_COMMUNITY: true,
    ENABLE_ANALYTICS: true,
    // 详情提取功能开关将通过配置服务动态控制
    ENABLE_DETAIL_EXTRACTION: true, // 系统级开关
    ENABLE_DETAIL_CONFIG_MANAGEMENT: true // 配置管理功能开关
  }
};

// 导出快捷访问常量
export const STORAGE_KEYS = APP_CONSTANTS.STORAGE_KEYS;
export const API_ENDPOINTS = APP_CONSTANTS.API_ENDPOINTS;
export const SYSTEM_LIMITS = APP_CONSTANTS.SYSTEM_LIMITS;
export const DEFAULT_USER_SETTINGS = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
export const ALLOWED_ACTIONS = APP_CONSTANTS.ALLOWED_ACTIONS;
export const THEMES = APP_CONSTANTS.THEMES;
export const SOURCE_CATEGORIES = APP_CONSTANTS.SOURCE_CATEGORIES;
export const ERROR_CODES = APP_CONSTANTS.ERROR_CODES;
export const FEATURES = APP_CONSTANTS.FEATURES;

// 工具函数
export function getStorageKey(key) {
  return STORAGE_KEYS[key] || key;
}

export function getAPIEndpoint(category, endpoint) {
  const categoryEndpoints = API_ENDPOINTS[category.toUpperCase()];
  if (!categoryEndpoints) {
    throw new Error(`API类别不存在: ${category}`);
  }
  
  const endpointUrl = categoryEndpoints[endpoint.toUpperCase()];
  if (!endpointUrl) {
    throw new Error(`API端点不存在: ${category}.${endpoint}`);
  }
  
  return endpointUrl;
}

export function isActionAllowed(action) {
  return ALLOWED_ACTIONS.includes(action);
}

export function validateSettings(settings) {
  const errors = [];
  
  if (settings.theme && !Object.values(THEMES).includes(settings.theme)) {
    errors.push('无效的主题设置');
  }
  
  if (settings.maxHistoryPerUser && settings.maxHistoryPerUser > SYSTEM_LIMITS.MAX_HISTORY_PER_USER) {
    errors.push(`历史记录数量不能超过 ${SYSTEM_LIMITS.MAX_HISTORY_PER_USER}`);
  }
  
  if (settings.maxFavoritesPerUser && settings.maxFavoritesPerUser > SYSTEM_LIMITS.MAX_FAVORITES_PER_USER) {
    errors.push(`收藏数量不能超过 ${SYSTEM_LIMITS.MAX_FAVORITES_PER_USER}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// 环境检测
export function getEnvironment() {
  if (typeof window === 'undefined') return 'server';
  
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  return 'production';
}

// 默认导出
export default APP_CONSTANTS;