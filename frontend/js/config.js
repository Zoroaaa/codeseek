// 配置文件 - 兼容ES6模块和传统script标签
(function(global) {
  'use strict';

  // 环境检测
  const isDev = () => {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('localhost') ||
           window.location.port === '3000' ||
           window.location.port === '5000' ||
           window.location.port === '8080';
  };

  // API配置
  const API_CONFIG = {
    // 应用信息
    APP_NAME: 'CodeSeek',
    APP_VERSION: '2.0.0',
    
    // API地址配置
    BASE_URL: isDev() 
      ? 'http://localhost:8787' 
      : 'https://codeseek-backend.tvhub.pp.ua',
      
    // 开发环境URL
    DEV_URL: 'http://localhost:8787',
    
    // 生产环境URL
    PROD_URL: 'https://codeseek-backend.tvhub.pp.ua',
    
    // API超时设置
    TIMEOUT: 30000,
    
    // 重试设置
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    
    // 分析统计
    ENABLE_ANALYTICS: true,
    
    // 调试模式
    ENABLE_DEBUG: isDev(),
    
    // 缓存设置
    CACHE_DURATION: 5 * 60 * 1000, // 5分钟
    
    // 存储键名
    STORAGE_KEYS: {
      AUTH_TOKEN: 'auth_token',
      THEME: 'theme_preference',
      USER_SETTINGS: 'user_settings',
      SEARCH_CACHE: 'search_cache_',
      APP_VERSION: 'app_version'
    },
    
    // 请求头
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '2.0.0',
      'X-Client-Platform': 'web'
    },
    
    // 功能开关
    FEATURES: {
      CLOUD_SYNC: true,
      OFFLINE_MODE: false,
      SEARCH_SUGGESTIONS: true,
      AUTO_SAVE: true,
      EXPORT_DATA: true,
      IMPORT_DATA: true
    },
    
    // 限制设置
    LIMITS: {
      MAX_SEARCH_HISTORY: 1000,
      MAX_FAVORITES: 2000,
      MAX_SEARCH_LENGTH: 100,
      MAX_RESULTS_PER_PAGE: 50
    },
    
    // 搜索源配置
    SEARCH_SOURCES: [
      {
        id: 'javbus',
        name: 'JavBus',
        subtitle: '番号+磁力一体站，信息完善',
        icon: '🌐',
        urlTemplate: 'https://www.javbus.com/search/{keyword}'
      },
      {
        id: 'javdb',
        name: 'JavDB',
        subtitle: '极简风格番号资料站，轻量快速',
        icon: '📚',
        urlTemplate: 'https://javdb.com/search?q={keyword}'
      },
      {
        id: 'javlibrary',
        name: 'JavLibrary',
        subtitle: '评论活跃，女优搜索详尽',
        icon: '📖',
        urlTemplate: 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}'
      },
      {
        id: 'av01',
        name: 'AV01',
        subtitle: '磁力搜索聚合平台',
        icon: '🔍',
        urlTemplate: 'https://www.av01.tv/search/{keyword}'
      },
      {
        id: 'missav',
        name: 'MissAV',
        subtitle: '在线播放平台',
        icon: '🎥',
        urlTemplate: 'https://missav.com/search/{keyword}'
      }
    ]
  };

  // 主题配置
  const THEME_CONFIG = {
    THEMES: {
      LIGHT: 'light',
      DARK: 'dark',
      AUTO: 'auto'
    },
    DEFAULT_THEME: 'light'
  };

  // 网络状态常量
  const CONNECTION_STATUS = {
    CHECKING: 'checking',
    CONNECTED: 'connected',
    WARNING: 'warning',
    ERROR: 'error'
  };

  // 用户权限常量
  const PERMISSIONS = {
    ADMIN: 'admin',
    PREMIUM: 'premium',
    USER: 'user'
  };

  // 合并所有配置
  const CONFIG = {
    ...API_CONFIG,
    THEMES: THEME_CONFIG.THEMES,
    DEFAULT_THEME: THEME_CONFIG.DEFAULT_THEME,
    CONNECTION_STATUS,
    PERMISSIONS,
    
    // 工具方法
    isDev,
    
    // 获取完整API URL
    getApiUrl: (endpoint = '') => {
      const baseUrl = API_CONFIG.BASE_URL;
      return endpoint.startsWith('/') 
        ? `${baseUrl}${endpoint}` 
        : `${baseUrl}/${endpoint}`;
    },
    
    // 获取搜索URL
    getSearchUrl: (sourceId, keyword) => {
      const source = API_CONFIG.SEARCH_SOURCES.find(s => s.id === sourceId);
      if (!source) {
        throw new Error(`Unknown search source: ${sourceId}`);
      }
      return source.urlTemplate.replace('{keyword}', encodeURIComponent(keyword));
    },
    
    // 环境信息
    getEnvironmentInfo: () => ({
      isDev: isDev(),
      hostname: window.location.hostname,
      port: window.location.port,
      protocol: window.location.protocol,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      online: navigator.onLine,
      cookieEnabled: navigator.cookieEnabled
    })
  };

  // 导出配置到全局
  if (typeof window !== 'undefined') {
    window.API_CONFIG = CONFIG;
    window.APP_CONFIG = CONFIG; // 别名
  }

  // 如果支持模块系统，也导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
  }

  // ES6模块导出
  if (typeof global.define === 'function' && global.define.amd) {
    global.define([], () => CONFIG);
  }

  // 控制台输出配置信息（仅开发环境）
  if (isDev() && typeof console !== 'undefined') {
    console.log('🔧 应用配置已加载:', CONFIG);
    console.log('🌍 环境信息:', CONFIG.getEnvironmentInfo());
  }

})(typeof window !== 'undefined' ? window : this);