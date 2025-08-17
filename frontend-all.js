

我将帮您将前端代码改造成ES6模块系统，并重新组织文件结构。根据您的代码分析，我建议采用以下新的文件结构：

src/
├── modules/
│   ├── core/
│   ├── api/
│   ├── auth/
│   ├── storage/
│   ├── ui/
│   ├── utils/
│   ├── search/
│   ├── favorites/
│   └── dashboard/
├── pages/
└── shared/
现在开始逐个文件进行改造：

1. src/shared/constants.js
javascript
// 应用常量定义
export const APP_CONSTANTS = {
  // 应用信息
  APP: {
    NAME: '磁力快搜',
    VERSION: '1.1.0',
    DESCRIPTION: '专业的磁力搜索工具，支持云端同步，智能搜索'
  },

  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    ENDPOINTS: {
      HEALTH: '/api/health',
      CONFIG: '/api/config',
      AUTH: {
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        LOGOUT: '/api/auth/logout',
        VERIFY: '/api/auth/verify-token',
        CHANGE_PASSWORD: '/api/auth/change-password',
        DELETE_ACCOUNT: '/api/auth/delete-account'
      },
      USER: {
        FAVORITES: '/api/user/favorites',
        SEARCH_HISTORY: '/api/user/search-history',
        SETTINGS: '/api/user/settings',
        STATS: '/api/user/search-stats',
        ANALYTICS: '/api/user/analytics'
      },
      ACTIONS: {
        RECORD: '/api/actions/record'
      }
    }
  },

  // 存储配置
  STORAGE: {
    KEYS: {
      AUTH_TOKEN: 'auth_token',
      THEME: 'theme',
      APP_VERSION: 'app_version',
      API_CONFIG: 'api_config'
    },
    ALLOWED_SYSTEM_KEYS: ['theme', 'app_version', 'auth_token', 'api_config']
  },

  // UI配置
  UI: {
    TOAST_DURATION: 3000,
    LOADING_MIN_DURATION: 100,
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 1000,
    MODAL_ANIMATION_DURATION: 300
  },

  // 搜索配置
  SEARCH: {
    MIN_KEYWORD_LENGTH: 2,
    MAX_KEYWORD_LENGTH: 100,
    MAX_SUGGESTIONS: 5,
    SOURCES: {
      JAVBUS: { name: 'JavBus', icon: '🎬', baseUrl: 'https://www.javbus.com' },
      JAVDB: { name: 'JavDB', icon: '📚', baseUrl: 'https://javdb.com' },
      JAVLIBRARY: { name: 'JavLibrary', icon: '📖', baseUrl: 'https://www.javlibrary.com' },
      AV01: { name: 'AV01', icon: '🎥', baseUrl: 'https://av01.tv' },
      MISSAV: { name: 'MissAV', icon: '💫', baseUrl: 'https://missav.com' },
      BTSOW: { name: 'btsow', icon: '🧲', baseUrl: 'https://btsow.com' }
    }
  },

  // 用户限制
  LIMITS: {
    MAX_FAVORITES: 1000,
    MAX_HISTORY: 1000,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 6,
    MAX_PASSWORD_LENGTH: 50
  },

  // 网络配置
  NETWORK: {
    CONNECTION_CHECK_INTERVAL: 60000, // 1分钟
    OFFLINE_RETRY_DELAY: 5000,
    MAX_SYNC_RETRIES: 3
  },

  // 主题配置
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  }
};

// 权限常量
export const PERMISSIONS = {
  SEARCH: 'search',
  FAVORITE: 'favorite', 
  HISTORY: 'history',
  SYNC: 'sync',
  ADMIN: 'admin',
  PREMIUM: 'premium'
};

// 错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// 事件名称
export const EVENT_NAMES = {
  AUTH_STATE_CHANGED: 'authStateChanged',
  THEME_CHANGED: 'themeChanged',
  NETWORK_STATE_CHANGED: 'networkStateChanged',
  DATA_SYNCED: 'dataSynced'
};
2. src/shared/error-handler.js
javascript
import { ERROR_CODES, EVENT_NAMES } from './constants.js';

/**
 * 全局错误处理器
 */
export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 50;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    window.addEventListener('error', (event) => {
      this.handleError('JavaScript Error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Unhandled Promise Rejection', event.reason);
      
      if (this.isAuthError(event.reason)) {
        this.handleAuthError(event.reason);
      }
      
      event.preventDefault();
    });

    this.initialized = true;
  }

  isAuthError(error) {
    if (!error) return false;
    
    const message = error.message || String(error);
    return message.includes('认证失败') || 
           message.includes('401') ||
           message.includes('Unauthorized') ||
           message.includes('Token验证失败');
  }

  handleAuthError(error) {
    console.warn('🔐 检测到认证错误，清理认证状态');
    
    localStorage.removeItem('auth_token');
    
    const event = new CustomEvent(EVENT_NAMES.AUTH_STATE_CHANGED, {
      detail: { type: 'logout', reason: 'auth_error' }
    });
    window.dispatchEvent(event);
    
    if (window.location.pathname.includes('dashboard')) {
      window.location.href = './index.html';
    }
  }

  handleError(type, error, extra = {}) {
    const errorInfo = {
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...extra
    };

    this.addToLog(errorInfo);
    console.error(`🚨 ${type}:`, errorInfo);

    // 发送到服务器（如果API可用）
    if (navigator.onLine && window.apiClient) {
      window.apiClient.recordAction('error', errorInfo).catch(console.error);
    }
  }

  addToLog(errorInfo) {
    this.errorLog.unshift(errorInfo);
    
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  getErrorLog() {
    return [...this.errorLog];
  }

  clearErrorLog() {
    this.errorLog = [];
  }

  safeExecute(func, fallback = null, context = 'function') {
    try {
      return func();
    } catch (error) {
      this.handleError(`Safe Execute Error (${context})`, error);
      return fallback;
    }
  }

  async safeAsyncExecute(asyncFunc, fallback = null, context = 'async function') {
    try {
      return await asyncFunc();
    } catch (error) {
      this.handleError(`Safe Async Execute Error (${context})`, error);
      return fallback;
    }
  }
}

// 创建全局实例
export const errorHandler = new ErrorHandler();
3. src/modules/core/config.js
javascript
/**
 * 核心配置管理模块
 */
export class ConfigManager {
  constructor() {
    this.config = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return this.config;

    this.config = {
      BASE_URL: this.getAPIBaseURL(),
      DEV_URL: this.getConfigValue('CF_DEV_API_URL', 'http://localhost:8787'),
      PROD_URL: this.getConfigValue('CF_PROD_API_URL', this.getDefaultProdURL()),
      APP_NAME: this.getConfigValue('CF_APP_NAME', '磁力快搜'),
      APP_VERSION: this.getConfigValue('CF_APP_VERSION', '1.1.0'),
      ENABLE_ANALYTICS: this.getBooleanConfig('CF_ENABLE_ANALYTICS', false),
      ENABLE_DEBUG: this.getBooleanConfig('CF_ENABLE_DEBUG', this.isDevelopment()),
      ENABLE_OFFLINE_MODE: this.getBooleanConfig('CF_ENABLE_OFFLINE_MODE', true),
      API_TIMEOUT: parseInt(this.getConfigValue('CF_API_TIMEOUT', '10000')),
      RETRY_ATTEMPTS: parseInt(this.getConfigValue('CF_RETRY_ATTEMPTS', '3')),
      CACHE_DURATION: parseInt(this.getConfigValue('CF_CACHE_DURATION', '1800000'))
    };

    this.config.BASE_URL = this.validateAndFixURL(this.config.BASE_URL);
    this.initialized = true;

    if (this.config.ENABLE_DEBUG) {
      this.logDebugInfo();
    }

    return this.config;
  }

  getConfigValue(key, defaultValue) {
    if (typeof window[key] !== 'undefined') {
      return window[key];
    }
    
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const paramKey = key.toLowerCase().replace(/^cf_/, '');
    if (urlParams.has(paramKey)) {
      return urlParams.get(paramKey);
    }
    
    return defaultValue;
  }

  getBooleanConfig(key, defaultValue) {
    const value = this.getConfigValue(key, defaultValue);
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  isDevelopment() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.local') ||
           window.location.port !== '' ||
           window.location.search.includes('dev=1');
  }

  getDefaultProdURL() {
    if (window.location.protocol === 'https:') {
      return 'https://codeseek.zadi.workers.dev';
    } else {
      return '/api';
    }
  }

  getAPIBaseURL() {
    if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
      return window.API_CONFIG.BASE_URL;
    }
    
    if (this.isDevelopment()) {
      return this.getConfigValue('CF_DEV_API_URL', 'http://localhost:8787');
    }
    
    return this.getConfigValue('CF_PROD_API_URL', this.getDefaultProdURL());
  }

  validateAndFixURL(url) {
    if (!url) return '/api';
    
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        
        if (window.location.protocol === 'https:' && urlObj.protocol === 'http:') {
          console.warn('⚠️ 检测到混合内容问题，尝试使用HTTPS');
          urlObj.protocol = 'https:';
          return urlObj.toString().replace(/\/$/, '');
        }
        
        return url.replace(/\/$/, '');
      }
      
      return url.replace(/\/$/, '');
      
    } catch (error) {
      console.warn('⚠️ URL格式错误，使用默认配置:', error.message);
      return '/api';
    }
  }

  logDebugInfo() {
    console.group('🔧 应用配置信息');
    console.log('📍 API地址:', this.config.BASE_URL);
    console.log('🏠 当前域名:', window.location.hostname);
    console.log('🌐 协议:', window.location.protocol);
    console.log('🚀 版本:', this.config.APP_VERSION);
    console.log('🔍 开发模式:', this.isDevelopment());
    console.log('📊 分析统计:', this.config.ENABLE_ANALYTICS);
    console.groupEnd();
  }

  getConfig() {
    return this.config || this.init();
  }

  updateConfig(updates) {
    if (!this.config) this.init();
    Object.assign(this.config, updates);
    return this.config;
  }
}

// 创建全局配置管理器实例
export const configManager = new ConfigManager();
4. src/modules/utils/string.js
javascript
/**
 * 字符串工具函数
 */
export const StringUtils = {
  // 截断字符串
  truncate(str, length, suffix = '...') {
    if (!str || str.length <= length) return str;
    return str.substring(0, length) + suffix;
  },

  // 移除HTML标签
  stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  // 转义HTML
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;'
    };
    return String(text).replace(/[&<>"'/]/g, s => map[s]);
  },

  // 反转义HTML
  unescapeHtml(text) {
    if (!text) return '';
    const map = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#039;': "'",
      '&#x2F;': '/'
    };
    return String(text).replace(/&(amp|lt|gt|quot|#039|#x2F);/g, s => map[s]);
  },

  // 首字母大写
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // 驼峰转短横线
  kebabCase(str) {
    if (!str) return '';
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  },

  // 短横线转驼峰
  camelCase(str) {
    if (!str) return '';
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  },

  // 生成随机字符串
  random(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

export default StringUtils;
5. src/modules/utils/date.js
javascript
/**
 * 日期时间工具函数
 */
export const DateUtils = {
  // 格式化日期
  formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const options = {
      short: { year: 'numeric', month: 'short', day: 'numeric' },
      long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
      time: { hour: '2-digit', minute: '2-digit' },
      datetime: { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      }
    };

    try {
      return d.toLocaleDateString('zh-CN', options[format] || options.short);
    } catch (error) {
      return d.toLocaleDateString();
    }
  },

  // 格式化相对时间
  formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    
    if (isNaN(diff)) return '';
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
      return `${Math.floor(diff / day)}天前`;
    } else if (diff < month) {
      return `${Math.floor(diff / week)}周前`;
    } else if (diff < year) {
      return `${Math.floor(diff / month)}月前`;
    } else {
      return `${Math.floor(diff / year)}年前`;
    }
  },

  // 获取时间戳
  getTimestamp() {
    return Date.now();
  },

  // 检查是否为今天
  isToday(date) {
    const today = new Date();
    const target = new Date(date);
    
    return today.getDate() === target.getDate() &&
           today.getMonth() === target.getMonth() &&
           today.getFullYear() === target.getFullYear();
  },

  // 检查是否为本周
  isThisWeek(date) {
    const now = new Date();
    const target = new Date(date);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    return target >= weekStart;
  },

  // 检查是否为本月
  isThisMonth(date) {
    const now = new Date();
    const target = new Date(date);
    
    return now.getMonth() === target.getMonth() &&
           now.getFullYear() === target.getFullYear();
  }
};

export default DateUtils;
6. src/modules/utils/common.js
javascript
/**
 * 通用工具函数
 */

// 防抖函数
export function debounce(func, wait, immediate = false) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(this, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(this, args);
  };
}

// 节流函数
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 深拷贝对象
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (obj instanceof RegExp) {
    return new RegExp(obj);
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = deepClone(obj[key]);
    });
    return cloned;
  }
  
  return obj;
}

// 生成唯一ID
export function generateId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = chars.length;
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charactersLength));
  }
  
  return result;
}

// 检查是否为开发环境
export function isDevEnv() {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         window.location.port !== '' ||
         window.location.search.includes('dev=1');
}

// 异步延迟函数
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 重试函数
export async function retry(fn, maxAttempts = 3, delayMs = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      await delay(delayMs * attempt);
    }
  }
  
  throw lastError;
}

// 安全的JSON解析
export function safeJsonParse(str, fallback = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('JSON解析失败:', error);
    return fallback;
  }
}

// 安全的JSON字符串化
export function safeJsonStringify(obj, fallback = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('JSON字符串化失败:', error);
    return fallback;
  }
}
7. src/modules/utils/array.js
javascript
/**
 * 数组工具函数
 */
export const ArrayUtils = {
  // 移除重复项
  unique(arr, key = null) {
    if (!Array.isArray(arr)) return [];
    
    if (key) {
      const seen = new Set();
      return arr.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        if (seen.has(val)) {
          return false;
        }
        seen.add(val);
        return true;
      });
    }
    return [...new Set(arr)];
  },

  // 分组
  groupBy(arr, key) {
    if (!Array.isArray(arr)) return {};
    
    return arr.reduce((groups, item) => {
      const val = typeof key === 'function' ? key(item) : item[key];
      groups[val] = groups[val] || [];
      groups[val].push(item);
      return groups;
    }, {});
  },

  // 排序
  sortBy(arr, key, desc = false) {
    if (!Array.isArray(arr)) return [];
    
    return [...arr].sort((a, b) => {
      const aVal = typeof key === 'function' ? key(a) : a[key];
      const bVal = typeof key === 'function' ? key(b) : b[key];
      
      if (aVal < bVal) return desc ? 1 : -1;
      if (aVal > bVal) return desc ? -1 : 1;
      return 0;
    });
  },

  // 分块
  chunk(arr, size) {
    if (!Array.isArray(arr) || size <= 0) return [];
    
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  // 随机排序
  shuffle(arr) {
    if (!Array.isArray(arr)) return [];
    
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // 查找差异
  difference(arr1, arr2, key = null) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
    
    if (key) {
      const set2 = new Set(arr2.map(item => typeof key === 'function' ? key(item) : item[key]));
      return arr1.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        return !set2.has(val);
      });
    }
    
    const set2 = new Set(arr2);
    return arr1.filter(item => !set2.has(item));
  },

  // 交集
  intersection(arr1, arr2, key = null) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
    
    if (key) {
      const set2 = new Set(arr2.map(item => typeof key === 'function' ? key(item) : item[key]));
      return arr1.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        return set2.has(val);
      });
    }
    
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
  },

  // 合并去重
  union(arr1, arr2, key = null) {
    if (!Array.isArray(arr1)) arr1 = [];
    if (!Array.isArray(arr2)) arr2 = [];
    
    return this.unique([...arr1, ...arr2], key);
  },

  // 分页
  paginate(arr, page = 1, pageSize = 10) {
    if (!Array.isArray(arr)) return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = arr.slice(startIndex, endIndex);
    const total = arr.length;
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
};

export default ArrayUtils;
8. src/modules/utils/url.js
javascript
/**
 * URL工具函数
 */
export const URLUtils = {
  // 检查URL是否有效
  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  // 提取域名
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (_) {
      return '';
    }
  },

  // 添加协议
  addProtocol(url) {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  },

  // 构建查询字符串
  buildQueryString(params) {
    return Object.keys(params)
      .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },

  // 解析查询字符串
  parseQueryString(queryString) {
    const params = {};
    if (!queryString) return params;
    
    const pairs = (queryString.startsWith('?') ? queryString.slice(1) : queryString).split('&');
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    
    return params;
  },

  // 获取文件扩展名
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot > 0) {
        return pathname.slice(lastDot + 1).toLowerCase();
      }
    } catch (error) {
      console.error('获取文件扩展名失败:', error);
    }
    
    return '';
  },

  // 截断URL显示
  truncateUrl(url, maxLength = 50) {
    if (!url || url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      
      if (domain.length + path.length <= maxLength) {
        return `${domain}${path}`;
      }
      
      const availableLength = maxLength - domain.length - 3; // 3 for '...'
      if (availableLength > 0) {
        return `${domain}${path.substring(0, availableLength)}...`;
      }
      
      return domain.length <= maxLength ? domain : domain.substring(0, maxLength - 3) + '...';
    } catch (error) {
      return url.length <= maxLength ? url : url.substring(0, maxLength - 3) + '...';
    }
  },

  // 获取当前页面的查询参数
  getCurrentParams() {
    return this.parseQueryString(window.location.search);
  },

  // 更新当前页面的查询参数
  updateCurrentParams(newParams, replace = false) {
    const currentParams = this.getCurrentParams();
    const updatedParams = { ...currentParams, ...newParams };
    
    // 移除值为null或undefined的参数
    Object.keys(updatedParams).forEach(key => {
      if (updatedParams[key] === null || updatedParams[key] === undefined) {
        delete updatedParams[key];
      }
    });
    
    const queryString = this.buildQueryString(updatedParams);
    const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
    
    if (replace) {
      window.history.replaceState({}, '', newUrl);
    } else {
      window.history.pushState({}, '', newUrl);
    }
  }
};

export default URLUtils;
继续输出后面的文件...




Retry
继续输出

Edit

规划下一批前端模块化代码输出顺序


9. src/modules/ui/toast.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * Toast通知组件
 */
export class ToastManager {
  constructor() {
    this.toastElement = null;
    this.currentTimeout = null;
    this.init();
  }

  init() {
    this.toastElement = document.getElementById('toast');
    if (!this.toastElement) {
      console.warn('Toast元素未找到');
    }
  }

  show(message, type = 'info', duration = APP_CONSTANTS.UI.TOAST_DURATION) {
    if (!this.toastElement) {
      console.warn('Toast元素不可用');
      return;
    }

    // 清除之前的类和超时
    this.toastElement.className = 'toast';
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }

    // 设置消息和类型
    this.toastElement.textContent = message;
    this.toastElement.classList.add(type, 'show');

    // 自动隐藏
    this.currentTimeout = setTimeout(() => {
      this.hide();
    }, duration);

    // 点击关闭
    this.toastElement.onclick = () => {
      this.hide();
    };
  }

  hide() {
    if (this.toastElement) {
      this.toastElement.classList.remove('show');
    }
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

// 创建全局实例
export const toast = new ToastManager();

// 向后兼容的全局函数
export function showToast(message, type = 'info', duration = APP_CONSTANTS.UI.TOAST_DURATION) {
  toast.show(message, type, duration);
}
10. src/modules/ui/loading.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 加载动画管理器
 */
export class LoadingManager {
  constructor() {
    this.loadingElement = null;
    this.isVisible = false;
    this.minDurationTimeout = null;
    this.init();
  }

  init() {
    this.loadingElement = document.getElementById('loading');
    if (!this.loadingElement) {
      console.warn('Loading元素未找到');
    }
  }

  show(minDuration = APP_CONSTANTS.UI.LOADING_MIN_DURATION) {
    if (!this.loadingElement) return;

    this.isVisible = true;
    this.loadingElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // 确保最小显示时间，避免闪烁
    if (this.minDurationTimeout) {
      clearTimeout(this.minDurationTimeout);
    }
    
    this.minDurationTimeout = setTimeout(() => {
      this.minDurationTimeout = null;
    }, minDuration);
  }

  hide() {
    if (!this.loadingElement) return;

    const doHide = () => {
      this.isVisible = false;
      this.loadingElement.style.display = 'none';
      document.body.style.overflow = '';
    };

    // 如果还在最小显示时间内，等待完成后隐藏
    if (this.minDurationTimeout) {
      setTimeout(doHide, APP_CONSTANTS.UI.LOADING_MIN_DURATION);
    } else {
      doHide();
    }
  }

  toggle(show) {
    if (show) {
      this.show();
    } else {
      this.hide();
    }
  }

  getState() {
    return this.isVisible;
  }
}

// 创建全局实例
export const loading = new LoadingManager();

// 向后兼容的全局函数
export function showLoading(show) {
  loading.toggle(show);
}
11. src/modules/ui/modal.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 模态框管理器
 */
export class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.init();
  }

  init() {
    // 绑定全局关闭事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });

    // 绑定所有模态框的关闭按钮
    this.bindCloseButtons();
  }

  bindCloseButtons() {
    document.querySelectorAll('.modal .close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.close(modal.id);
        }
      });
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.close(modal.id);
        }
      });
    });
  }

  open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`模态框 ${modalId} 未找到`);
      return false;
    }

    // 设置显示
    modal.style.display = 'block';
    this.activeModals.add(modalId);

    // 焦点管理
    if (options.focusElement) {
      setTimeout(() => {
        const focusEl = modal.querySelector(options.focusElement);
        if (focusEl) focusEl.focus();
      }, APP_CONSTANTS.UI.MODAL_ANIMATION_DURATION);
    }

    // 防止页面滚动
    if (this.activeModals.size === 1) {
      document.body.style.overflow = 'hidden';
    }

    return true;
  }

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    modal.style.display = 'none';
    this.activeModals.delete(modalId);

    // 恢复页面滚动
    if (this.activeModals.size === 0) {
      document.body.style.overflow = '';
    }

    // 清理表单
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());

    return true;
  }

  closeAll() {
    this.activeModals.forEach(modalId => {
      this.close(modalId);
    });
  }

  isOpen(modalId) {
    return this.activeModals.has(modalId);
  }

  getActiveModals() {
    return Array.from(this.activeModals);
  }

  // 便捷方法
  showLogin() {
    return this.open('loginModal', { focusElement: '#loginUsername' });
  }

  showRegister() {
    return this.open('registerModal', { focusElement: '#regUsername' });
  }

  showPasswordChange() {
    return this.open('passwordModal', { focusElement: '#currentPassword' });
  }
}

// 创建全局实例
export const modal = new ModalManager();
12. src/modules/storage/storage-manager.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';
import { safeJsonParse, safeJsonStringify } from '../utils/common.js';

/**
 * 存储管理器 - 仅用于系统设置
 */
export class StorageManager {
  constructor() {
    this.allowedKeys = APP_CONSTANTS.STORAGE.ALLOWED_SYSTEM_KEYS;
  }

  // 安全的localStorage操作 - 仅限系统设置
  setItem(key, value) {
    if (!this.allowedKeys.includes(key)) {
      console.warn(`StorageManager: 不允许存储业务数据 "${key}"`);
      return false;
    }

    try {
      const serialized = safeJsonStringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('存储数据失败:', error);
      return false;
    }
  }

  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? safeJsonParse(item, defaultValue) : defaultValue;
    } catch (error) {
      console.error('读取数据失败:', error);
      return defaultValue;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('删除数据失败:', error);
      return false;
    }
  }

  // 清理所有业务数据，保留系统设置
  clearBusinessData() {
    const keysToRemove = [
      'search_history', 'favorites', 'user_settings', 
      'search_cache_', 'temp_', 'cache'
    ];
    
    const allKeys = Object.keys(localStorage);
    let removedCount = 0;
    
    allKeys.forEach(key => {
      const shouldRemove = keysToRemove.some(pattern => 
        key.startsWith(pattern) || key.includes(pattern)
      );
      
      if (shouldRemove && !this.allowedKeys.includes(key)) {
        try {
          localStorage.removeItem(key);
          removedCount++;
        } catch (error) {
          console.error(`清理业务数据失败 ${key}:`, error);
        }
      }
    });
    
    console.log(`✅ 已清理${removedCount}个业务数据项，保留系统设置`);
    return removedCount;
  }

  // 获取存储使用情况
  getStorageUsage() {
    let total = 0;
    const itemCount = localStorage.length;
    const items = {};
    
    for (let i = 0; i < itemCount; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        const size = key.length + (value ? value.length : 0);
        total += size;
        items[key] = {
          size,
          sizeKB: (size / 1024).toFixed(2),
          type: this.allowedKeys.includes(key) ? 'system' : 'unknown'
        };
      }
    }
    
    return {
      total,
      totalKB: (total / 1024).toFixed(2),
      totalMB: (total / (1024 * 1024)).toFixed(2),
      itemCount,
      items
    };
  }

  // 检查存储容量
  checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => {
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          usagePercentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      });
    }
    return Promise.resolve(null);
  }
}

// 创建全局实例
export const storage = new StorageManager();
13. src/modules/network/network-utils.js
javascript
import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { delay } from '../utils/common.js';

/**
 * 网络工具和状态监控
 */
export class NetworkUtils {
  constructor() {
    this.callbacks = new Set();
    this.connectionInfo = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // 定期检查连接状态
    setInterval(() => {
      this.updateConnectionInfo();
    }, APP_CONSTANTS.NETWORK.CONNECTION_CHECK_INTERVAL);

    this.isInitialized = true;
  }

  // 检查网络状态
  isOnline() {
    return navigator.onLine;
  }

  // 监听网络状态变化
  onNetworkChange(callback) {
    this.callbacks.add(callback);
    
    // 添加事件监听器（避免重复添加）
    if (this.callbacks.size === 1) {
      this.init();
    }

    // 返回取消监听的函数
    return () => {
      this.callbacks.delete(callback);
    };
  }

  handleOnline() {
    console.log('🌐 网络已连接');
    
    const event = new CustomEvent(EVENT_NAMES.NETWORK_STATE_CHANGED, {
      detail: { online: true }
    });
    window.dispatchEvent(event);

    this.callbacks.forEach(callback => {
      try {
        callback(true);
      } catch (error) {
        console.error('网络状态回调执行失败:', error);
      }
    });
  }

  handleOffline() {
    console.log('🔵 网络已断开');

    const event = new CustomEvent(EVENT_NAMES.NETWORK_STATE_CHANGED, {
      detail: { online: false }
    });
    window.dispatchEvent(event);

    this.callbacks.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('网络状态回调执行失败:', error);
      }
    });
  }

  // 测试网络连接
  async testConnection(url, timeout = 5000) {
    if (!navigator.onLine) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('网络连接测试失败:', error);
      return false;
    }
  }

  // 获取连接信息（实验性API）
  updateConnectionInfo() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        timestamp: Date.now()
      };
    }
    return this.connectionInfo;
  }

  getConnectionInfo() {
    return this.connectionInfo;
  }

  // 测试API连接
  async testAPIConnection(baseURL, timeout = 8000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${baseURL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { connected: true, status: response.status, data };
      } else {
        return { connected: false, status: response.status };
      }
    } catch (error) {
      return { 
        connected: false, 
        error: error.name === 'AbortError' ? 'timeout' : error.message 
      };
    }
  }

  // 等待网络连接
  async waitForConnection(maxWait = 30000) {
    if (this.isOnline()) return true;

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.isOnline()) {
          resolve(true);
        } else if (Date.now() - startTime >= maxWait) {
          resolve(false);
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  // 网络重试包装器
  async withRetry(fn, maxRetries = APP_CONSTANTS.NETWORK.MAX_SYNC_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isOnline()) {
          await this.waitForConnection();
        }
        
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) break;
        
        await delay(APP_CONSTANTS.NETWORK.OFFLINE_RETRY_DELAY * attempt);
      }
    }
    
    throw lastError;
  }
}

// 创建全局实例
export const networkUtils = new NetworkUtils();
14. src/modules/api/api-client.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';
import { configManager } from '../core/config.js';
import { networkUtils } from '../network/network-utils.js';
import { delay, retry } from '../utils/common.js';

/**
 * API客户端类
 */
export class APIClient {
  constructor() {
    this.baseURL = null;
    this.token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    this.maxRetries = APP_CONSTANTS.API.RETRY_ATTEMPTS;
    this.timeout = APP_CONSTANTS.API.TIMEOUT;
    this.init();
  }

  init() {
    const config = configManager.getConfig();
    this.baseURL = config.BASE_URL;
    this.maxRetries = config.RETRY_ATTEMPTS;
    this.timeout = config.API_TIMEOUT;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    }
  }

  getToken() {
    return this.token;
  }

  // 基础请求方法
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method: 'GET',
      credentials: 'omit',
      ...options,
      headers
    };

    return retry(async () => {
      // 网络状态检查
      if (!navigator.onLine) {
        throw new Error('网络连接不可用');
      }
      
      const response = await fetch(url, config);
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        return await response.text();
      }
      
      // 401错误特殊处理
      if (response.status === 401) {
        this.setToken(null);
        throw new Error('认证失败，请重新登录');
      }
      
      const errorText = await response.text().catch(() => '');
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        if (errorText) errorMessage += `: ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }, this.maxRetries, 1000);
  }

  // 认证相关API
  async register(username, email, password) {
    return await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  }

  async login(username, password) {
    const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (response.success && response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async verifyToken(token) {
    if (!token) {
      throw new Error('Token不能为空');
    }
    
    return await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.VERIFY, {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  }

  async logout() {
    try {
      await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.LOGOUT, { 
        method: 'POST' 
      });
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      this.setToken(null);
    }
  }

  async changePassword(currentPassword, newPassword) {
    return await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  }

  async deleteAccount() {
    const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.AUTH.DELETE_ACCOUNT, {
      method: 'POST'
    });
    
    if (response.success) {
      this.setToken(null);
    }
    
    return response;
  }

  // 用户数据相关API
  async getFavorites() {
    const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.FAVORITES);
    return response.favorites || [];
  }

  async syncFavorites(favorites) {
    if (!Array.isArray(favorites)) {
      throw new Error('收藏数据格式错误');
    }
    
    const validFavorites = favorites.filter(fav => {
      return fav && fav.title && fav.url && 
             typeof fav.title === 'string' && 
             typeof fav.url === 'string';
    });
    
    return await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.FAVORITES, {
      method: 'POST',
      body: JSON.stringify({ favorites: validFavorites })
    });
  }

  async getSearchHistory() {
    const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.SEARCH_HISTORY);
    const history = response.history || response.searchHistory || [];
    
    return history.filter(item => {
      return item && (item.query || item.keyword) && 
             typeof (item.query || item.keyword) === 'string';
    }).map(item => ({
      ...item,
      keyword: item.keyword || item.query,
      query: item.query || item.keyword
    }));
  }

  async saveSearchHistory(query, source = 'unknown') {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('搜索关键词不能为空');
    }

    return await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.SEARCH_HISTORY, {
      method: 'POST',
      body: JSON.stringify({ 
        query: query.trim(), 
        source: source,
        timestamp: Date.now() 
      })
    });
  }

  async syncSearchHistory(history) {
    const validHistory = history.filter(item => {
      return item && (item.query || item.keyword) && 
             typeof (item.query || item.keyword) === 'string' && 
             (item.query || item.keyword).trim().length > 0;
    }).map(item => ({
      id: item.id || this.generateId(),
      query: item.query || item.keyword,
      keyword: item.query || item.keyword,
      source: item.source || 'unknown',
      timestamp: item.timestamp || Date.now()
    }));

    return await this.request('/api/user/sync/search-history', {
      method: 'POST',
      body: JSON.stringify({ 
        searchHistory: validHistory,
        history: validHistory
      })
    });
  }

  async clearAllSearchHistory() {
    return await this.request(`${APP_CONSTANTS.API.ENDPOINTS.USER.SEARCH_HISTORY}?operation=clear`, {
      method: 'DELETE'
    });
  }

  async deleteSearchHistory(historyId) {
    if (!historyId) {
      throw new Error('历史记录ID不能为空');
    }
    
    return await this.request(`${APP_CONSTANTS.API.ENDPOINTS.USER.SEARCH_HISTORY}/${historyId}`, {
      method: 'DELETE'
    });
  }

  async getSearchStats() {
    try {
      return await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.STATS);
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
  }

  async getUserSettings() {
    try {
      const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.SETTINGS);
      return response.settings || {};
    } catch (error) {
      console.error('获取用户设置失败:', error);
      return {};
    }
  }

  async updateUserSettings(settings) {
    if (!settings || typeof settings !== 'object') {
      throw new Error('设置数据格式错误');
    }
    
    const allowedSettings = [
      'theme', 'autoSync', 'cacheResults', 
      'maxHistoryPerUser', 'maxFavoritesPerUser'
    ];
    
    const validSettings = {};
    Object.keys(settings).forEach(key => {
      if (allowedSettings.includes(key)) {
        validSettings[key] = settings[key];
      }
    });
    
    return await this.request(APP_CONSTANTS.API.ENDPOINTS.USER.SETTINGS, {
      method: 'PUT',
      body: JSON.stringify({ settings: validSettings })
    });
  }

  // 系统API
  async getConfig() {
    try {
      return await this.request(APP_CONSTANTS.API.ENDPOINTS.CONFIG);
    } catch (error) {
      console.error('获取配置失败:', error);
      return {};
    }
  }

  async healthCheck() {
    try {
      const response = await this.request(APP_CONSTANTS.API.ENDPOINTS.HEALTH);
      return response || { status: 'healthy' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async recordAction(action, data) {
    try {
      return await this.request(APP_CONSTANTS.API.ENDPOINTS.ACTIONS.RECORD, {
        method: 'POST',
        body: JSON.stringify({ action, data })
      });
    } catch (error) {
      console.error('记录行为失败:', error);
    }
  }

  // 工具方法
  generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : 
           Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// 创建全局实例
export const apiClient = new APIClient();
15. src/modules/auth/auth-manager.js
javascript
import { apiClient } from '../api/api-client.js';
import { storage } from '../storage/storage-manager.js';
import { EVENT_NAMES, APP_CONSTANTS } from '../../shared/constants.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';

/**
 * 认证管理器
 */
export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.refreshTimer = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.loadStoredAuth();
    this.setupTokenRefresh();
    this.bindEvents();
    this.isInitialized = true;
  }

  bindEvents() {
    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type } = event.detail;
      if (type === 'logout') {
        this.clearAuth();
      }
    });
  }

  loadStoredAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    const user = storage.getItem('current_user');
    
    if (token && user) {
      this.setAuth(user, token);
    }
  }

  setAuth(user, token) {
    this.currentUser = user;
    this.token = token;
    
    localStorage.setItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN, token);
    storage.setItem('current_user', user);
    
    apiClient.setToken(token);
    this.startTokenRefresh();
    this.dispatchAuthEvent('login', user);
  }

  clearAuth() {
    const previousUser = this.currentUser;
    
    this.currentUser = null;
    this.token = null;
    
    localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    storage.removeItem('current_user');
    
    apiClient.setToken(null);
    this.stopTokenRefresh();
    this.dispatchAuthEvent('logout', previousUser);
  }

  isAuthenticated() {
    return !!(this.currentUser && this.token);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.token;
  }

  async login(username, password) {
    try {
      loading.show();
      
      const response = await apiClient.login(username, password);
      
      if (response.success && response.user && response.token) {
        this.setAuth(response.user, response.token);
        toast.success(`欢迎回来，${response.user.username}！`);
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      toast.error(error.message || '登录失败，请稍后重试');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async register(username, email, password) {
    try {
      loading.show();
      
      const validation = this.validateRegistration(username, email, password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      const response = await apiClient.register(username, email, password);
      
      if (response.success) {
        toast.success('注册成功！请登录您的账户');
        return { success: true };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      toast.error(error.message || '注册失败，请稍后重试');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async logout() {
    try {
      if (this.token) {
        await apiClient.logout();
      }
    } catch (error) {
      console.error('退出登录请求失败:', error);
    } finally {
      this.clearAuth();
      toast.success('已退出登录');
    }
  }

  async verifyToken() {
    if (!this.token) return false;

    try {
      const response = await apiClient.verifyToken(this.token);
      
      if (response.success && response.user) {
        this.currentUser = response.user;
        storage.setItem('current_user', response.user);
        return true;
      } else {
        this.clearAuth();
        return false;
      }
    } catch (error) {
      console.error('验证token失败:', error);
      this.clearAuth();
      return false;
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      loading.show();
      
      const response = await apiClient.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        toast.success('密码修改成功');
        return { success: true };
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      console.error('密码修改失败:', error);
      toast.error(error.message || '密码修改失败');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async deleteAccount() {
    try {
      loading.show();
      
      const response = await apiClient.deleteAccount();
      
      if (response.success) {
        this.clearAuth();
        toast.success('账户已删除');
        return { success: true };
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      toast.error(error.message || '删除账户失败');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  validateRegistration(username, email, password) {
    if (!username || username.length < 3) {
      return { valid: false, message: '用户名至少3个字符' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, message: '用户名只能包含字母、数字和下划线' };
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, message: '请输入有效的邮箱地址' };
    }

    if (!password || password.length < 6) {
      return { valid: false, message: '密码至少6个字符' };
    }

    return { valid: true };
  }

  setupTokenRefresh() {
    this.refreshTimer = setInterval(() => {
      if (this.isAuthenticated()) {
        this.verifyToken();
      }
    }, 30 * 60 * 1000); // 每30分钟检查一次
  }

  startTokenRefresh() {
    this.stopTokenRefresh();
    this.setupTokenRefresh();
  }

  stopTokenRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  dispatchAuthEvent(type, user) {
    const event = new CustomEvent(EVENT_NAMES.AUTH_STATE_CHANGED, {
      detail: { type, user }
    });
    window.dispatchEvent(event);
  }

  getUserPermissions() {
    if (!this.currentUser) return [];
    return this.currentUser.permissions || [];
  }

  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes('admin');
  }

  requireAuth(message = '此操作需要登录') {
    if (!this.isAuthenticated()) {
      toast.error(message);
      return false;
    }
    return true;
  }
}

// 创建全局实例
export const authManager = new AuthManager();
继续输出后面的文件...




Retry
继续输出

Edit



规划前端代码重构，列出模块化输出清单


16. src/modules/ui/theme-manager.js
javascript
import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { storage } from '../storage/storage-manager.js';
import { toast } from './toast.js';

/**
 * 主题管理器
 */
export class ThemeManager {
  constructor() {
    if (ThemeManager.instance) {
      return ThemeManager.instance;
    }
    
    ThemeManager.instance = this;
    this.theme = storage.getItem(APP_CONSTANTS.STORAGE.KEYS.THEME) || APP_CONSTANTS.THEMES.LIGHT;
    this.isInitialized = false;
    this.eventBound = false;
  }

  init() {
    if (this.isInitialized) return;

    this.applyTheme();
    this.bindThemeToggle();
    this.bindSystemThemeChange();
    this.isInitialized = true;
  }

  bindThemeToggle() {
    if (!this.eventBound) {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTheme();
        });
        this.eventBound = true;
      } else {
        console.warn('主题切换按钮未找到 (ID: themeToggle)');
      }
    }
  }

  bindSystemThemeChange() {
    // 监听系统主题变化
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
          this.applyTheme();
        }
      });
    }
  }

  applyTheme() {
    let effectiveTheme = this.theme;
    
    // 如果是自动模式，根据系统主题决定
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        effectiveTheme = APP_CONSTANTS.THEMES.DARK;
      } else {
        effectiveTheme = APP_CONSTANTS.THEMES.LIGHT;
      }
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    storage.setItem(APP_CONSTANTS.STORAGE.KEYS.THEME, this.theme);
    
    // 更新按钮图标
    this.updateToggleButton(effectiveTheme);
  }

  updateToggleButton(effectiveTheme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icons = {
        [APP_CONSTANTS.THEMES.LIGHT]: '🌙',
        [APP_CONSTANTS.THEMES.DARK]: '☀️',
        [APP_CONSTANTS.THEMES.AUTO]: '🌓'
      };
      
      themeToggle.textContent = icons[effectiveTheme] || '🌙';
      themeToggle.setAttribute('title', `当前: ${this.getThemeDisplayName(effectiveTheme)}`);
    }
  }

  getThemeDisplayName(theme) {
    const names = {
      [APP_CONSTANTS.THEMES.LIGHT]: '浅色模式',
      [APP_CONSTANTS.THEMES.DARK]: '深色模式',
      [APP_CONSTANTS.THEMES.AUTO]: '跟随系统'
    };
    return names[theme] || '未知';
  }

  toggleTheme() {
    console.log('主题切换: ' + this.theme + ' -> ' + this.getNextTheme());
    
    this.theme = this.getNextTheme();
    this.applyTheme();
    
    // 触发自定义事件
    const event = new CustomEvent(EVENT_NAMES.THEME_CHANGED, {
      detail: { theme: this.theme }
    });
    document.dispatchEvent(event);

    // 显示提示
    toast.success(`主题已切换至${this.getThemeDisplayName(this.theme)}`);
  }

  getNextTheme() {
    const themes = [APP_CONSTANTS.THEMES.LIGHT, APP_CONSTANTS.THEMES.DARK, APP_CONSTANTS.THEMES.AUTO];
    const currentIndex = themes.indexOf(this.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return themes[nextIndex];
  }

  setTheme(theme) {
    if (Object.values(APP_CONSTANTS.THEMES).includes(theme)) {
      this.theme = theme;
      this.applyTheme();
      
      const event = new CustomEvent(EVENT_NAMES.THEME_CHANGED, {
        detail: { theme: this.theme }
      });
      document.dispatchEvent(event);
    }
  }

  getTheme() {
    return this.theme;
  }

  getCurrentEffectiveTheme() {
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? APP_CONSTANTS.THEMES.DARK 
        : APP_CONSTANTS.THEMES.LIGHT;
    }
    return this.theme;
  }
}

// 创建全局实例
export const themeManager = new ThemeManager();

// 监听主题变化事件
document.addEventListener(EVENT_NAMES.THEME_CHANGED, (e) => {
  console.log('主题已更改:', e.detail.theme);
});
17. src/modules/search/search-engine.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';
import { StringUtils } from '../utils/string.js';
import { generateId } from '../utils/common.js';

/**
 * 搜索引擎模块
 */
export class SearchEngine {
  constructor() {
    this.sources = APP_CONSTANTS.SEARCH.SOURCES;
    this.cache = new Map();
    this.cacheExpiry = APP_CONSTANTS.API.CACHE_DURATION;
  }

  // 验证搜索关键词
  validateKeyword(keyword) {
    if (!keyword || typeof keyword !== 'string') {
      return { valid: false, message: '搜索关键词不能为空' };
    }

    const trimmed = keyword.trim();
    
    if (trimmed.length < APP_CONSTANTS.SEARCH.MIN_KEYWORD_LENGTH) {
      return { valid: false, message: `搜索关键词至少${APP_CONSTANTS.SEARCH.MIN_KEYWORD_LENGTH}个字符` };
    }

    if (trimmed.length > APP_CONSTANTS.SEARCH.MAX_KEYWORD_LENGTH) {
      return { valid: false, message: `搜索关键词最多${APP_CONSTANTS.SEARCH.MAX_KEYWORD_LENGTH}个字符` };
    }

    if (/[<>]/.test(trimmed)) {
      return { valid: false, message: '搜索关键词包含非法字符' };
    }

    return { valid: true, keyword: trimmed };
  }

  // 构建搜索结果
  buildSearchResults(keyword) {
    const validation = this.validateKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const validKeyword = validation.keyword;
    const encodedKeyword = encodeURIComponent(validKeyword);
    const timestamp = Date.now();
    
    return Object.entries(this.sources).map(([key, source]) => ({
      id: `result_${validKeyword}_${key}_${timestamp}`,
      title: source.name,
      subtitle: this.getSourceDescription(key),
      url: this.buildSourceUrl(key, encodedKeyword),
      icon: source.icon,
      keyword: validKeyword,
      timestamp: timestamp,
      source: key
    }));
  }

  // 获取搜索源描述
  getSourceDescription(sourceKey) {
    const descriptions = {
      javbus: '番号+磁力一体站，信息完善',
      javdb: '极简风格番号资料站，轻量快速',
      javlibrary: '评论活跃，女优搜索详尽',
      av01: '快速预览站点，封面大图清晰',
      missav: '中文界面，封面高清，信息丰富',
      btsow: '中文磁力搜索引擎，番号资源丰富'
    };
    return descriptions[sourceKey] || '专业搜索资源';
  }

  // 构建搜索源URL
  buildSourceUrl(sourceKey, encodedKeyword) {
    const urlTemplates = {
      javbus: `https://www.javbus.com/search/${encodedKeyword}`,
      javdb: `https://javdb.com/search?q=${encodedKeyword}&f=all`,
      javlibrary: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodedKeyword}`,
      av01: `https://av01.tv/search?keyword=${encodedKeyword}`,
      missav: `https://missav.com/search/${encodedKeyword}`,
      btsow: `https://btsow.com/search/${encodedKeyword}`
    };
    
    return urlTemplates[sourceKey] || '';
  }

  // 缓存管理
  getCachedResults(keyword) {
    const cacheKey = this.getCacheKey(keyword);
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.results;
    }
    
    return null;
  }

  cacheResults(keyword, results) {
    const cacheKey = this.getCacheKey(keyword);
    this.cache.set(cacheKey, {
      results,
      timestamp: Date.now()
    });
    
    // 清理过期缓存
    this.cleanExpiredCache();
  }

  getCacheKey(keyword) {
    return `search_${keyword.toLowerCase().trim()}`;
  }

  cleanExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheExpiry) {
        this.cache.delete(key);
      }
    }
  }

  // 搜索建议
  generateSuggestions(history, query) {
    if (!query || !Array.isArray(history)) return [];

    return history
      .filter(item => {
        if (!item || !item.keyword) return false;
        return item.keyword.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, APP_CONSTANTS.SEARCH.MAX_SUGGESTIONS)
      .map(item => ({
        text: item.keyword,
        type: 'history',
        timestamp: item.timestamp
      }));
  }

  // 搜索统计
  analyzeSearchPatterns(history) {
    if (!Array.isArray(history)) return {};

    const patterns = {
      totalSearches: history.length,
      uniqueKeywords: new Set(history.map(h => h.keyword)).size,
      topKeywords: this.getTopKeywords(history),
      searchFrequency: this.getSearchFrequency(history),
      sourcesUsed: this.getSourcesUsage(history)
    };

    return patterns;
  }

  getTopKeywords(history, limit = 10) {
    const keywordCount = {};
    
    history.forEach(item => {
      if (item.keyword) {
        keywordCount[item.keyword] = (keywordCount[item.keyword] || 0) + 1;
      }
    });

    return Object.entries(keywordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([keyword, count]) => ({ keyword, count }));
  }

  getSearchFrequency(history) {
    const frequency = {};
    const now = new Date();
    
    history.forEach(item => {
      const date = new Date(item.timestamp);
      const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 7) frequency.thisWeek = (frequency.thisWeek || 0) + 1;
      if (daysDiff < 30) frequency.thisMonth = (frequency.thisMonth || 0) + 1;
      if (daysDiff < 365) frequency.thisYear = (frequency.thisYear || 0) + 1;
    });

    return frequency;
  }

  getSourcesUsage(history) {
    const sourceCount = {};
    
    history.forEach(item => {
      if (item.source) {
        sourceCount[item.source] = (sourceCount[item.source] || 0) + 1;
      }
    });

    return sourceCount;
  }

  // 清理缓存
  clearCache() {
    this.cache.clear();
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      size: this.cache.size,
      totalSize: 0,
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      const entrySize = JSON.stringify(value).length;
      stats.totalSize += entrySize;
      stats.entries.push({
        key,
        size: entrySize,
        timestamp: value.timestamp,
        age: Date.now() - value.timestamp
      });
    }

    return stats;
  }
}

// 创建全局实例
export const searchEngine = new SearchEngine();
18. src/modules/search/search-manager.js
javascript
import { searchEngine } from './search-engine.js';
import { apiClient } from '../api/api-client.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';
import { debounce } from '../utils/common.js';

/**
 * 搜索管理器
 */
export class SearchManager {
  constructor() {
    this.searchHistory = [];
    this.currentResults = [];
    this.isInitialized = false;
    this.suggestionCallbacks = new Set();
  }

  init() {
    if (this.isInitialized) return;
    
    this.bindSearchEvents();
    this.isInitialized = true;
  }

  bindSearchEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch();
        }
      });

      // 搜索建议
      const debouncedSuggestion = debounce((value) => {
        this.handleSearchInput(value);
      }, APP_CONSTANTS.UI.DEBOUNCE_DELAY);

      searchInput.addEventListener('input', (e) => {
        debouncedSuggestion(e.target.value);
      });

      searchInput.addEventListener('focus', () => {
        this.showSearchSuggestions();
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.performSearch();
      });
    }
  }

  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      toast.error('请输入搜索关键词');
      searchInput?.focus();
      return;
    }

    try {
      loading.show();
      this.hideQuickTips();

      // 添加到搜索历史
      await this.addToHistory(keyword);

      // 执行搜索
      const results = await this.searchKeyword(keyword);
      
      // 显示搜索结果
      this.displaySearchResults(keyword, results);

      // 记录搜索行为
      this.recordSearchAction(keyword, results);

    } catch (error) {
      console.error('搜索失败:', error);
      toast.error(`搜索失败: ${error.message}`);
    } finally {
      loading.hide();
    }
  }

  async searchKeyword(keyword) {
    const cacheResults = document.getElementById('cacheResults')?.checked;
    
    // 检查缓存
    if (cacheResults) {
      const cached = searchEngine.getCachedResults(keyword);
      if (cached) {
        toast.info('使用缓存结果', 2000);
        return cached;
      }
    }

    // 构建搜索结果
    const results = searchEngine.buildSearchResults(keyword);

    // 缓存结果
    if (cacheResults) {
      searchEngine.cacheResults(keyword, results);
    }

    return results;
  }

  async addToHistory(keyword) {
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      console.warn('无效的搜索关键词，跳过添加到历史');
      return;
    }

    const trimmedKeyword = keyword.trim();
    
    // 本地添加以立即更新UI
    this.searchHistory = this.searchHistory.filter(item => 
      item && item.keyword && item.keyword !== trimmedKeyword
    );
    
    this.searchHistory.unshift({
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyword: trimmedKeyword,
      query: trimmedKeyword,
      timestamp: Date.now(),
      count: 1,
      source: 'manual'
    });

    // 限制数量
    const maxHistory = APP_CONSTANTS.LIMITS.MAX_HISTORY;
    if (this.searchHistory.length > maxHistory) {
      this.searchHistory = this.searchHistory.slice(0, maxHistory);
    }

    this.renderHistory();

    // 保存到云端
    try {
      await apiClient.saveSearchHistory(trimmedKeyword, 'manual');
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      toast.warning('保存搜索历史失败');
    }
  }

  displaySearchResults(keyword, results) {
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');

    if (resultsSection) resultsSection.style.display = 'block';
    
    if (searchInfo) {
      searchInfo.innerHTML = `
        搜索关键词: <strong>${this.escapeHtml(keyword)}</strong> 
        (${results.length}个结果) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (resultsContainer) {
      resultsContainer.innerHTML = results.map(result => 
        this.createResultHTML(result)
      ).join('');
    }

    this.currentResults = results;
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  createResultHTML(result) {
    return `
      <div class="result-item" data-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${this.escapeHtml(result.title)}</div>
          <div class="result-subtitle">${this.escapeHtml(result.subtitle)}</div>
          <div class="result-url" title="${this.escapeHtml(result.url)}">
            ${this.truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${this.formatRelativeTime(result.timestamp)}</span>
          </div>
        </div>
        <div class="result-actions">
          <button class="action-btn visit-btn" onclick="searchManager.openResult('${this.escapeHtml(result.url)}', '${result.source}')" title="访问网站">
            <span>访问</span>
          </button>
          <button class="action-btn copy-btn" onclick="searchManager.copyToClipboard('${this.escapeHtml(result.url)}')" title="复制链接">
            <span>复制</span>
          </button>
        </div>
      </div>
    `;
  }

  openResult(url, source) {
    try {
      // 记录访问行为
      apiClient.recordAction('visit_site', { url, source }).catch(console.error);
      
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('已在新标签页打开');
    } catch (error) {
      console.error('打开链接失败:', error);
      toast.error('无法打开链接');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
      
      // 记录复制行为
      apiClient.recordAction('copy_url', { url: text }).catch(console.error);
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('已复制到剪贴板');
      } catch (err) {
        toast.error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  }

  renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    if (this.searchHistory.length === 0) {
      if (historySection) historySection.style.display = 'none';
      return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
      historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => 
        `<span class="history-item" onclick="searchManager.searchFromHistory('${this.escapeHtml(item.keyword)}')">
          ${this.escapeHtml(item.keyword)}
        </span>`
      ).join('');
    }
  }

  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  handleSearchInput(value) {
    if (value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
  }

  showSearchSuggestions(query) {
    if (!query) return;
    
    const suggestions = searchEngine.generateSuggestions(this.searchHistory, query);
    this.renderSearchSuggestions(suggestions);
  }

  renderSearchSuggestions(suggestions) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'searchSuggestions';
      suggestionsContainer.className = 'search-suggestions';
      
      const searchInput = document.getElementById('searchInput');
      if (searchInput && searchInput.parentNode) {
        searchInput.parentNode.appendChild(suggestionsContainer);
      }
    }
    
    if (suggestions.length === 0) {
      suggestionsContainer.style.display = 'none';
      return;
    }
    
    suggestionsContainer.innerHTML = suggestions.map(item => `
      <div class="suggestion-item" onclick="searchManager.searchFromHistory('${this.escapeHtml(item.text)}')">
        <span class="suggestion-icon">🕐</span>
        <span class="suggestion-text">${this.escapeHtml(item.text)}</span>
      </div>
    `).join('');
    
    suggestionsContainer.style.display = 'block';
  }

  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  hideQuickTips() {
    const quickTips = document.getElementById('quickTips');
    if (quickTips) {
      quickTips.style.display = 'none';
    }
  }

  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';

    this.currentResults = [];
    toast.success('搜索结果已清除');
  }

  async clearHistory() {
    try {
      loading.show();
      
      await apiClient.clearAllSearchHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      toast.success('搜索历史已清除');
    } catch (error) {
      console.error('清除搜索历史失败:', error);
      toast.error('清除失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async loadSearchHistory() {
    try {
      const cloudHistory = await apiClient.getSearchHistory();
      
      if (cloudHistory && cloudHistory.length > 0) {
        this.searchHistory = cloudHistory.filter(item => {
          return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
        });
        
        this.renderHistory();
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  }

  recordSearchAction(keyword, results) {
    if (navigator.onLine) {
      apiClient.recordAction('search', { 
        keyword, 
        resultCount: results.length,
        timestamp: Date.now() 
      }).catch(console.error);
    }
  }

  // 工具方法
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  truncateUrl(url) {
    if (url.length <= 50) return url;
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname.length > 20 ? urlObj.pathname.substr(0, 20) + '...' : urlObj.pathname}`;
    } catch (error) {
      return url.substr(0, 50) + '...';
    }
  }

  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  // 获取搜索统计
  getSearchStats() {
    return searchEngine.analyzeSearchPatterns(this.searchHistory);
  }

  // 获取当前结果
  getCurrentResults() {
    return this.currentResults;
  }

  // 设置搜索历史
  setSearchHistory(history) {
    this.searchHistory = history || [];
    this.renderHistory();
  }
}

// 创建全局实例
export const searchManager = new SearchManager();
19. src/modules/favorites/favorites-manager.js
javascript
import { apiClient } from '../api/api-client.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';
import { ArrayUtils } from '../utils/array.js';
import { StringUtils } from '../utils/string.js';
import { DateUtils } from '../utils/date.js';

/**
 * 收藏管理器
 */
export class FavoritesManager {
  constructor() {
    this.favorites = [];
    this.filteredFavorites = [];
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    
    this.bindEvents();
    this.isInitialized = true;
  }

  bindEvents() {
    // 搜索和排序控件
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');

    if (favoritesSearch) {
      favoritesSearch.addEventListener('input', debounce(() => {
        this.filterAndSort();
      }, APP_CONSTANTS.UI.DEBOUNCE_DELAY));

      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.filterAndSort();
      });
    }

    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => {
        this.filterAndSort();
      });
    }
  }

  async loadFavorites() {
    try {
      loading.show();
      
      const cloudFavorites = await apiClient.getFavorites();
      this.favorites = cloudFavorites || [];
      this.filteredFavorites = [...this.favorites];
      
      this.renderFavorites();
      
      console.log(`✅ 收藏加载完成: ${this.favorites.length}个收藏`);
    } catch (error) {
      console.error('加载收藏失败:', error);
      toast.error('加载收藏失败');
      this.favorites = [];
      this.filteredFavorites = [];
      this.renderFavorites();
    } finally {
      loading.hide();
    }
  }

  async addFavorite(item) {
    if (!item || !item.title || !item.url) {
      toast.error('收藏项数据不完整');
      return false;
    }

    // 检查是否已存在
    const exists = this.favorites.some(fav => fav.url === item.url);
    if (exists) {
      toast.warning('该项目已在收藏中');
      return false;
    }

    // 检查数量限制
    if (this.favorites.length >= APP_CONSTANTS.LIMITS.MAX_FAVORITES) {
      toast.error(`收藏数量已达上限 (${APP_CONSTANTS.LIMITS.MAX_FAVORITES})`);
      return false;
    }

    try {
      loading.show();

      const favorite = {
        id: this.generateId(),
        title: item.title,
        subtitle: item.subtitle || '',
        url: item.url,
        icon: item.icon || '🔗',
        keyword: item.keyword || '',
        addedAt: new Date().toISOString()
      };

      // 本地添加
      this.favorites.unshift(favorite);
      this.filterAndSort();

      // 同步到云端
      await apiClient.syncFavorites(this.favorites);
      
      toast.success('已添加收藏');
      return true;

    } catch (error) {
      console.error('添加收藏失败:', error);
      toast.error('添加收藏失败: ' + error.message);
      
      // 回滚本地操作
      await this.loadFavorites();
      return false;
    } finally {
      loading.hide();
    }
  }

  async removeFavorite(favoriteId) {
    if (!favoriteId) return false;

    const index = this.favorites.findIndex(fav => fav.id === favoriteId);
    if (index < 0) {
      toast.error('收藏项不存在');
      return false;
    }

    if (!confirm('确定要删除这个收藏吗？')) return false;

    try {
      loading.show();

      // 本地删除
      const removed = this.favorites.splice(index, 1)[0];
      this.filterAndSort();

      // 同步到云端
      await apiClient.syncFavorites(this.favorites);
      
      toast.success('收藏已删除');
      return true;

    } catch (error) {
      console.error('删除收藏失败:', error);
      toast.error('删除收藏失败: ' + error.message);
      
      // 回滚本地操作
      await this.loadFavorites();
      return false;
    } finally {
      loading.hide();
    }
  }

  async syncFavorites() {
    try {
      loading.show();
      
      await apiClient.syncFavorites(this.favorites);
      toast.success('收藏同步成功');
    } catch (error) {
      console.error('收藏同步失败:', error);
      toast.error('收藏同步失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  filterAndSort() {
    const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';

    // 过滤
    let filtered = this.favorites;
    if (searchTerm) {
      filtered = this.favorites.filter(fav => 
        fav.title.toLowerCase().includes(searchTerm) ||
        fav.subtitle.toLowerCase().includes(searchTerm) ||
        fav.keyword.toLowerCase().includes(searchTerm) ||
        fav.url.toLowerCase().includes(searchTerm)
      );
    }

    // 排序
    switch (sortBy) {
      case 'date-desc':
        filtered = ArrayUtils.sortBy(filtered, 'addedAt', true);
        break;
      case 'date-asc':
        filtered = ArrayUtils.sortBy(filtered, 'addedAt', false);
        break;
      case 'name-asc':
        filtered = ArrayUtils.sortBy(filtered, 'title', false);
        break;
      case 'name-desc':
        filtered = ArrayUtils.sortBy(filtered, 'title', true);
        break;
    }

    this.filteredFavorites = filtered;
    this.renderFavorites();
  }

  renderFavorites() {
    const favoritesContainer = document.getElementById('favorites') || 
                             document.getElementById('favoritesList');
    
    if (!favoritesContainer) return;

    if (this.filteredFavorites.length === 0) {
      const isEmpty = this.favorites.length === 0;
      favoritesContainer.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">📌</span>
          <p>${isEmpty ? '暂无收藏，搜索后添加收藏吧！' : '没有找到匹配的收藏'}</p>
          ${isEmpty ? '<p><small>登录后可以同步收藏到云端</small></p>' : ''}
        </div>
      `;
      return;
    }

    favoritesContainer.innerHTML = this.filteredFavorites.map(fav => 
      this.createFavoriteHTML(fav)
    ).join('');
  }

  createFavoriteHTML(fav) {
    return `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${StringUtils.escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${StringUtils.escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url" title="${StringUtils.escapeHtml(fav.url)}">
            ${StringUtils.truncate(fav.url, 60)}
          </div>
          <div class="favorite-meta">
            <span>关键词: ${StringUtils.escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${DateUtils.formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="favoritesManager.openFavorite('${StringUtils.escapeHtml(fav.url)}')">
            访问
          </button>
          <button class="action-btn copy-btn" onclick="favoritesManager.copyToClipboard('${StringUtils.escapeHtml(fav.url)}')">
            复制
          </button>
          <button class="action-btn remove-btn" onclick="favoritesManager.removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `;
  }

  openFavorite(url) {
    try {
      // 记录访问行为
      apiClient.recordAction('visit_favorite', { url }).catch(console.error);
      
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('已在新标签页打开');
    } catch (error) {
      console.error('打开收藏失败:', error);
      toast.error('无法打开链接');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
      
      // 记录复制行为
      apiClient.recordAction('copy_favorite', { url: text }).catch(console.error);
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('已复制到剪贴板');
      } catch (err) {
        toast.error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  }

  async exportFavorites() {
    try {
      const data = {
        favorites: this.favorites,
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorites-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('收藏导出成功');
    } catch (error) {
      console.error('导出收藏失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  async importFavorites(file) {
    try {
      loading.show();
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.favorites || !Array.isArray(data.favorites)) {
        throw new Error('文件格式不正确');
      }

      // 合并收藏，避免重复
      const existingUrls = new Set(this.favorites.map(fav => fav.url));
      const newFavorites = data.favorites.filter(fav => 
        fav.url && !existingUrls.has(fav.url)
      );
      
      if (newFavorites.length > 0) {
        this.favorites.push(...newFavorites);
        this.filterAndSort();
        
        // 同步到云端
        await this.syncFavorites();
        
        toast.success(`成功导入${newFavorites.length}个收藏`);
      } else {
        toast.info('没有新的收藏需要导入');
      }
    } catch (error) {
      console.error('导入收藏失败:', error);
      toast.error('导入失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  // 检查是否已收藏
  isFavorited(url) {
    return this.favorites.some(fav => fav.url === url);
  }

  // 根据URL查找收藏
  findByUrl(url) {
    return this.favorites.find(fav => fav.url === url);
  }

  // 获取收藏统计
  getStats() {
    return {
      total: this.favorites.length,
      filtered: this.filteredFavorites.length,
      sources: this.getSourceStats(),
      recent: this.getRecentStats()
    };
  }

  getSourceStats() {
    const sourceCount = {};
    this.favorites.forEach(fav => {
      try {
        const domain = new URL(fav.url).hostname;
        sourceCount[domain] = (sourceCount[domain] || 0) + 1;
      } catch (error) {
        sourceCount['unknown'] = (sourceCount['unknown'] || 0) + 1;
      }
    });
    return sourceCount;
  }

  getRecentStats() {
    const now = new Date();
    const stats = { today: 0, thisWeek: 0, thisMonth: 0 };
    
    this.favorites.forEach(fav => {
      const addedDate = new Date(fav.addedAt);
      
      if (DateUtils.isToday(addedDate)) stats.today++;
      if (DateUtils.isThisWeek(addedDate)) stats.thisWeek++;
      if (DateUtils.isThisMonth(addedDate)) stats.thisMonth++;
    });
    
    return stats;
  }

  generateId() {
    return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取所有收藏
  getFavorites() {
    return this.favorites;
  }

  // 设置收藏列表
  setFavorites(favorites) {
    this.favorites = favorites || [];
    this.filteredFavorites = [...this.favorites];
    this.renderFavorites();
  }

  // 清空收藏
  async clearAllFavorites() {
    if (!confirm('确定要清空所有收藏吗？此操作不可恢复。')) return;

    try {
      loading.show();
      
      this.favorites = [];
      this.filteredFavorites = [];
      
      await apiClient.syncFavorites(this.favorites);
      this.renderFavorites();
      
      toast.success('收藏已清空');
    } catch (error) {
      console.error('清空收藏失败:', error);
      toast.error('清空失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }
}

// 创建全局实例
export const favoritesManager = new FavoritesManager();
20. src/modules/dashboard/dashboard-manager.js
javascript
import { authManager } from '../auth/auth-manager.js';
import { favoritesManager } from '../favorites/favorites-manager.js';
import { searchManager } from '../search/search-manager.js';
import { apiClient } from '../api/api-client.js';
import { modal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { themeManager } from '../ui/theme-manager.js';
import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { debounce } from '../utils/common.js';
import { ArrayUtils } from '../utils/array.js';
import { DateUtils } from '../utils/date.js';

/**
 * Dashboard管理器
 */
export class DashboardManager {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.isInitialized = false;
    this.tabData = new Map();
  }

  async init() {
    try {
      loading.show();
      console.log('🚀 初始化Dashboard应用...');
      
      // 检查认证状态
      await this.checkAuth();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 加载云端数据
      await this.loadCloudData();
      
      this.isInitialized = true;
      console.log('✅ Dashboard初始化完成');
      
    } catch (error) {
      console.error('❌ Dashboard初始化失败:', error);
      toast.error('初始化失败，请重新登录');
      
      setTimeout(() => {
        window.location.replace('./index.html');
      }, 2000);
    } finally {
      loading.hide();
    }
  }

  async checkAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('未找到认证token');
    }

    try {
      const result = await apiClient.verifyToken(token);
      if (!result.success || !result.user) {
        throw new Error('Token验证失败');
      }
      
      this.currentUser = result.user;
      authManager.setAuth(result.user, token);
      this.updateUserUI();
    } catch (error) {
      localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      throw new Error('认证失败');
    }
  }

  bindEvents() {
    // 标签切换
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // 模态框事件
    this.bindModalEvents();

    // 设置表单事件
    this.bindSettingsEvents();

    // 数据操作按钮
    this.bindDataOperations();

    // 收藏夹搜索和排序
    this.bindFavoritesControls();

    // 主题切换
    document.addEventListener(EVENT_NAMES.THEME_CHANGED, () => {
      console.log('Dashboard检测到主题变化');
    });
  }

  bindModalEvents() {
    const passwordModal = document.getElementById('passwordModal');
    const closeBtns = document.querySelectorAll('.close');
    const passwordForm = document.getElementById('passwordForm');

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => modal.closeAll());
    });

    if (passwordModal) {
      passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) modal.closeAll();
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }
  }

  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
      });
    });

    // 按钮事件
    const buttons = {
      changePasswordBtn: () => this.changePassword(),
      saveSettingsBtn: () => this.saveSettings(),
      resetSettingsBtn: () => this.resetSettings()
    };

    Object.entries(buttons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  bindDataOperations() {
    const operations = {
      syncAllDataBtn: () => this.syncAllData(),
      exportDataBtn: () => this.exportData(),
      exportFavoritesBtn: () => this.exportFavorites(),
      clearAllHistoryBtn: () => this.clearAllHistory(),
      clearAllDataBtn: () => this.clearAllData(),
      deleteAccountBtn: () => this.deleteAccount()
    };

    Object.entries(operations).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  bindFavoritesControls() {
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');
    
    if (favoritesSearch) {
      const debouncedSearch = debounce(() => this.searchFavorites(), APP_CONSTANTS.UI.DEBOUNCE_DELAY);
      favoritesSearch.addEventListener('input', debouncedSearch);
      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchFavorites();
      });
    }
    
    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => this.searchFavorites());
    }
  }

  async loadCloudData() {
    if (!this.currentUser) {
      console.log('用户未登录，无法加载数据');
      return;
    }

    try {
      // 并行加载数据
      const [favoritesResult, historyResult] = await Promise.allSettled([
        favoritesManager.loadFavorites(),
        searchManager.loadSearchHistory()
      ]);

      if (favoritesResult.status === 'rejected') {
        console.error('加载收藏夹失败:', favoritesResult.reason);
      }

      if (historyResult.status === 'rejected') {
        console.error('加载搜索历史失败:', historyResult.reason);
      }

      // 加载当前标签页数据
      await this.loadTabData(this.currentTab);

    } catch (error) {
      console.error('加载云端数据失败:', error);
      toast.error('数据加载失败');
    }
  }

  switchTab(tabName) {
    // 更新菜单状态
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });

    this.currentTab = tabName;
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case 'overview':
        await this.loadOverviewData();
        break;
      case 'favorites':
        await this.loadFavoritesData();
        break;
      case 'history':
        await this.loadHistoryData();
        break;
      case 'settings':
        await this.loadSettingsData();
        break;
      case 'stats':
        await this.loadStatsData();
        break;
    }
  }

  async loadOverviewData() {
    try {
      const [searchStats] = await Promise.allSettled([
        apiClient.getSearchStats()
      ]);
      
      const stats = searchStats.status === 'fulfilled' ? searchStats.value : {
        total: searchManager.searchHistory.length,
        today: 0,
        thisWeek: 0,
        topQueries: []
      };
      
      // 更新UI
      this.updateElement('totalSearches', stats.total || 0);
      this.updateElement('totalFavorites', favoritesManager.getFavorites().length);
      this.updateElement('activeDays', this.calculateActiveDays());
      this.updateElement('userLevel', this.calculateUserLevel());

      await this.loadRecentActivity();

    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  async loadFavoritesData() {
    favoritesManager.renderFavorites();
  }

  async loadHistoryData() {
    const history = searchManager.searchHistory;
    
    this.updateElement('historyCount', history.length);
    this.updateElement('uniqueKeywords', new Set(history.map(h => h.keyword)).size);
    this.updateElement('avgPerDay', Math.round(history.length / (this.calculateActiveDays() || 1)));

    this.renderHistoryList(history);
  }

  async loadSettingsData() {
    try {
      const settings = await apiClient.getUserSettings();
      
      this.updateSettingElement('autoSync', settings.autoSync !== false);
      this.updateSettingElement('enableCache', settings.cacheResults !== false);
      this.updateSettingElement('themeMode', settings.theme || 'auto');
      this.updateSettingElement('maxFavorites', settings.maxFavoritesPerUser ?? 500);

    } catch (error) {
      console.error('加载设置失败:', error);
      toast.error('加载设置失败');
    }
  }

  async loadStatsData() {
    console.log('加载统计数据');
    // TODO: 实现统计数据加载
  }

  async loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const favorites = favoritesManager.getFavorites();
    const history = searchManager.searchHistory;

    const activities = [
      ...history.slice(0, 5).map(h => ({
        type: 'search',
        content: `搜索了 "${h.keyword}"`,
        time: h.timestamp,
        icon: '🔍'
      })),
      ...favorites.slice(0, 5).map(f => ({
        type: 'favorite',
        content: `收藏了 "${f.title}"`,
        time: new Date(f.addedAt).getTime(),
        icon: '⭐'
      }))
    ].sort((a, b) => b.time - a.time).slice(0, 10);

    if (activities.length === 0) {
      activityList.innerHTML = '<p class="empty-state">暂无活动记录</p>';
      return;
    }

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <span class="activity-icon">${activity.icon}</span>
        <div class="activity-content">
          <div class="activity-text">${this.escapeHtml(activity.content)}</div>
          <div class="activity-time">${DateUtils.formatRelativeTime(activity.time)}</div>
        </div>
      </div>
    `).join('');
  }

  renderHistoryList(history) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🕐</span>
          <p>暂无搜索历史</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = history.slice(0, 50).map(item => `
      <div class="history-item">
        <div class="history-content">
          <div class="history-keyword">${this.escapeHtml(item.keyword)}</div>
          <div class="history-time">${DateUtils.formatRelativeTime(item.timestamp)}</div>
        </div>
        <div class="history-actions">
          <button class="action-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
            重新搜索
          </button>
        </div>
      </div>
    `).join('');
  }

  searchFavorites() {
    favoritesManager.filterAndSort();
  }

  async changePassword() {
    modal.showPasswordChange();
  }

  async handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('新密码确认不一致');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('新密码至少6个字符');
      return;
    }

    const result = await authManager.changePassword(currentPassword, newPassword);
    
    if (result.success) {
      modal.closeAll();
      document.getElementById('passwordForm').reset();
    }
  }

  async saveSettings() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      loading.show();
      const settings = this.collectSettings();
      const payload = {
        theme: settings.themeMode,
        autoSync: !!settings.autoSync,
        cacheResults: !!settings.enableCache,
        maxFavoritesPerUser: parseInt(settings.maxFavorites, 10),
        maxHistoryPerUser: settings.historyRetention === '-1' ? 999999 : parseInt(settings.historyRetention, 10)
      };
      
      await apiClient.updateUserSettings(payload);
      toast.success('设置保存成功');
      this.markSettingsSaved();
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存设置失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    const defaultSettings = {
      autoSync: true,
      enableCache: true,
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true
    };

    Object.entries(defaultSettings).forEach(([key, value]) => {
      this.updateSettingElement(key, value);
    });

    this.markSettingsChanged();
    toast.success('设置已重置为默认值，请点击保存');
  }

  async syncAllData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      loading.show();
      toast.info('正在同步数据...');
      
      await favoritesManager.syncFavorites();
      await this.loadCloudData();
      
      toast.success('数据同步成功');
    } catch (error) {
      console.error('数据同步失败:', error);
      toast.error('同步失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async exportData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      const [favorites, history, settings] = await Promise.all([
        apiClient.getFavorites(),
        apiClient.getSearchHistory(),
        apiClient.getUserSettings()
      ]);

      const data = {
        favorites: favorites || favoritesManager.getFavorites(),
        searchHistory: history || searchManager.searchHistory,
        settings: settings || this.collectSettings(),
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
      };

      this.downloadJSON(data, `magnet-search-data-${new Date().toISOString().split('T')[0]}.json`);
      toast.success('数据导出成功');
    } catch (error) {
      console.error('导出数据失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  async exportFavorites() {
    await favoritesManager.exportFavorites();
  }

  async clearAllHistory() {
    await searchManager.clearHistory();
    await this.loadHistoryData();
  }

  async clearAllData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    if (!confirm('确定要清空所有数据吗？此操作不可恢复，建议先导出数据备份。')) return;
    if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

    try {
      loading.show();
      
      await Promise.all([
        apiClient.clearAllSearchHistory(),
        apiClient.syncFavorites([])
      ]);
      
      favoritesManager.setFavorites([]);
      searchManager.setSearchHistory([]);
      
      await this.loadCloudData();
      
      toast.success('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      toast.error('清空失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async deleteAccount() {
    const confirmText = '我确定要删除账户';
    const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
    
    if (userInput !== confirmText) {
      toast.info('确认文本不匹配，取消删除');
      return;
    }

    const result = await authManager.deleteAccount();
    
    if (result.success) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    }
  }

  async logout() {
    if (confirm('确定要退出登录吗？')) {
      await authManager.logout();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }
  }

  // 工具方法
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  updateSettingElement(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    
    if (element.type === 'checkbox') {
      element.checked = value;
    } else {
      element.value = value;
    }
  }

  collectSettings() {
    const settings = {};
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    
    settingInputs.forEach(input => {
      if (input.type === 'checkbox') {
        settings[input.id] = input.checked;
      } else {
        settings[input.id] = input.value;
      }
    });
    
    return settings;
  }

  markSettingsChanged() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置*';
      saveBtn.classList.add('changed');
    }
  }

  markSettingsSaved() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置';
      saveBtn.classList.remove('changed');
    }
  }

  calculateActiveDays() {
    const history = searchManager.searchHistory;
    if (history.length === 0) return 0;
    
    const dates = new Set(
      history.map(h => new Date(h.timestamp).toDateString())
    );
    return dates.size;
  }

  calculateUserLevel() {
    const totalActions = searchManager.searchHistory.length + favoritesManager.getFavorites().length;
    
    if (totalActions < 10) return '新手';
    if (totalActions < 50) return '熟练';
    if (totalActions < 200) return '专业';
    if (totalActions < 500) return '专家';
    return '大师';
  }

  updateUserUI() {
    const username = document.getElementById('username');
    if (username && this.currentUser) {
      username.textContent = this.currentUser.username;
    }
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// 创建全局实例
export const dashboardManager = new DashboardManager();
继续输出最后几个重要文件...




Retry
继续输出

Edit



规划并准备输出多个关键模块化文件


21. src/modules/sync/cloud-sync-manager.js
javascript
import { apiClient } from '../api/api-client.js';
import { networkUtils } from '../network/network-utils.js';
import { EVENT_NAMES, APP_CONSTANTS } from '../../shared/constants.js';
import { delay } from '../utils/common.js';

/**
 * 云端数据同步管理器
 */
export class CloudSyncManager {
  constructor() {
    this.syncQueue = new Map();
    this.isOnline = navigator.onLine;
    this.pendingOperations = new Set();
    this.lastSyncTime = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    // 监听网络状态
    networkUtils.onNetworkChange((isOnline) => {
      this.isOnline = isOnline;
      if (isOnline) {
        this.processPendingSync();
      }
    });

    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type } = event.detail;
      if (type === 'logout') {
        this.clearQueue();
      }
    });

    this.isInitialized = true;
  }

  // 添加同步任务
  addSyncTask(operation, data, priority = 'normal') {
    const taskId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.syncQueue.set(taskId, {
      id: taskId,
      operation,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: APP_CONSTANTS.NETWORK.MAX_SYNC_RETRIES
    });

    console.log(`📋 添加同步任务: ${operation} (${taskId})`);
    
    if (this.isOnline) {
      this.processTask(taskId);
    }
    
    return taskId;
  }

  // 处理单个任务
  async processTask(taskId) {
    const task = this.syncQueue.get(taskId);
    if (!task || this.pendingOperations.has(taskId)) return;

    this.pendingOperations.add(taskId);

    try {
      console.log(`🔄 执行同步任务: ${task.operation}`);
      
      let result;
      switch (task.operation) {
        case 'sync_favorites':
          result = await apiClient.syncFavorites(task.data);
          break;
        case 'save_search_history':
          result = await apiClient.saveSearchHistory(task.data.query, task.data.source);
          break;
        case 'sync_search_history':
          result = await apiClient.syncSearchHistory(task.data);
          break;
        case 'update_settings':
          result = await apiClient.updateUserSettings(task.data);
          break;
        case 'record_action':
          result = await apiClient.recordAction(task.data.action, task.data.data);
          break;
        default:
          throw new Error(`未知的同步操作: ${task.operation}`);
      }

      // 任务成功
      this.syncQueue.delete(taskId);
      this.lastSyncTime = Date.now();
      console.log(`✅ 同步任务完成: ${task.operation}`);
      
      // 触发同步完成事件
      this.dispatchSyncEvent('completed', { taskId, operation: task.operation });
      
    } catch (error) {
      console.error(`❌ 同步任务失败: ${task.operation}`, error);
      
      // 重试逻辑
      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        console.log(`🔄 任务重试 ${task.retryCount}/${task.maxRetries}: ${task.operation}`);
        setTimeout(() => this.processTask(taskId), Math.pow(2, task.retryCount) * 1000);
      } else {
        console.error(`💀 任务最终失败: ${task.operation}`);
        this.syncQueue.delete(taskId);
        this.dispatchSyncEvent('failed', { taskId, operation: task.operation, error: error.message });
      }
    } finally {
      this.pendingOperations.delete(taskId);
    }
  }

  // 处理所有待同步任务
  async processPendingSync() {
    if (!this.isOnline || this.syncQueue.size === 0) return;

    console.log(`🌐 网络恢复，处理 ${this.syncQueue.size} 个待同步任务`);
    
    const taskIds = Array.from(this.syncQueue.keys());
    for (const taskId of taskIds) {
      if (this.syncQueue.has(taskId)) {
        await this.processTask(taskId);
        // 添加小延迟避免请求过于频繁
        await delay(200);
      }
    }
  }

  // 批量同步收藏
  async syncFavorites(favorites) {
    return this.addSyncTask('sync_favorites', favorites, 'high');
  }

  // 同步搜索历史
  async syncSearchHistory(history) {
    return this.addSyncTask('sync_search_history', history, 'normal');
  }

  // 保存单条搜索历史
  async saveSearchHistory(query, source = 'unknown') {
    return this.addSyncTask('save_search_history', { query, source }, 'normal');
  }

  // 更新用户设置
  async updateUserSettings(settings) {
    return this.addSyncTask('update_settings', settings, 'high');
  }

  // 记录用户行为
  async recordAction(action, data) {
    return this.addSyncTask('record_action', { action, data }, 'low');
  }

  // 强制同步所有数据
  async forceSyncAll() {
    if (!this.isOnline) {
      throw new Error('网络不可用，无法同步');
    }

    console.log('🔄 强制同步所有数据');
    
    try {
      // 获取所有本地数据
      const favorites = window.favoritesManager?.getFavorites() || [];
      const searchHistory = window.searchManager?.searchHistory || [];
      
      // 并行同步
      await Promise.all([
        this.syncFavorites(favorites),
        this.syncSearchHistory(searchHistory)
      ]);
      
      console.log('✅ 强制同步完成');
      this.dispatchSyncEvent('force_sync_completed');
      
    } catch (error) {
      console.error('❌ 强制同步失败:', error);
      this.dispatchSyncEvent('force_sync_failed', { error: error.message });
      throw error;
    }
  }

  // 智能同步：根据数据变化自动决定同步策略
  async smartSync(dataType, data, options = {}) {
    const { priority = 'normal', immediate = false } = options;
    
    if (immediate && this.isOnline) {
      // 立即同步
      switch (dataType) {
        case 'favorites':
          return await apiClient.syncFavorites(data);
        case 'search_history':
          return await apiClient.syncSearchHistory(data);
        case 'settings':
          return await apiClient.updateUserSettings(data);
      }
    } else {
      // 添加到队列
      return this.addSyncTask(`sync_${dataType}`, data, priority);
    }
  }

  // 获取同步状态
  getStatus() {
    return {
      isOnline: this.isOnline,
      queueSize: this.syncQueue.size,
      pendingCount: this.pendingOperations.size,
      lastSyncTime: this.lastSyncTime,
      isInitialized: this.isInitialized,
      tasks: Array.from(this.syncQueue.values()).map(task => ({
        operation: task.operation,
        timestamp: task.timestamp,
        retryCount: task.retryCount,
        priority: task.priority
      }))
    };
  }

  // 获取详细的同步统计
  getSyncStats() {
    const tasks = Array.from(this.syncQueue.values());
    const stats = {
      total: tasks.length,
      byOperation: {},
      byPriority: { high: 0, normal: 0, low: 0 },
      retrying: 0,
      oldestTask: null,
      averageAge: 0
    };

    if (tasks.length === 0) return stats;

    const now = Date.now();
    let totalAge = 0;

    tasks.forEach(task => {
      // 按操作类型统计
      stats.byOperation[task.operation] = (stats.byOperation[task.operation] || 0) + 1;
      
      // 按优先级统计
      stats.byPriority[task.priority]++;
      
      // 重试任务统计
      if (task.retryCount > 0) stats.retrying++;
      
      // 任务年龄
      const age = now - task.timestamp;
      totalAge += age;
      
      if (!stats.oldestTask || age > (now - stats.oldestTask.timestamp)) {
        stats.oldestTask = task;
      }
    });

    stats.averageAge = totalAge / tasks.length;
    
    return stats;
  }

  // 清空队列
  clearQueue() {
    this.syncQueue.clear();
    this.pendingOperations.clear();
    console.log('🗑️ 同步队列已清空');
  }

  // 重试失败的任务
  retryFailedTasks() {
    const failedTasks = Array.from(this.syncQueue.values())
      .filter(task => task.retryCount >= task.maxRetries);
    
    failedTasks.forEach(task => {
      task.retryCount = 0;
      this.processTask(task.id);
    });
    
    console.log(`🔄 重试 ${failedTasks.length} 个失败任务`);
  }

  // 暂停同步
  pauseSync() {
    this.isPaused = true;
    console.log('⏸️ 同步已暂停');
  }

  // 恢复同步
  resumeSync() {
    this.isPaused = false;
    console.log('▶️ 同步已恢复');
    if (this.isOnline) {
      this.processPendingSync();
    }
  }

  // 设置同步优先级
  updateTaskPriority(taskId, newPriority) {
    const task = this.syncQueue.get(taskId);
    if (task) {
      task.priority = newPriority;
      console.log(`📝 任务 ${taskId} 优先级已更新为 ${newPriority}`);
    }
  }

  // 取消任务
  cancelTask(taskId) {
    if (this.syncQueue.delete(taskId)) {
      this.pendingOperations.delete(taskId);
      console.log(`❌ 任务 ${taskId} 已取消`);
      return true;
    }
    return false;
  }

  // 触发同步事件
  dispatchSyncEvent(type, detail = {}) {
    const event = new CustomEvent(EVENT_NAMES.DATA_SYNCED, {
      detail: { type, ...detail, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  // 监听同步事件
  onSyncEvent(callback) {
    window.addEventListener(EVENT_NAMES.DATA_SYNCED, callback);
    return () => window.removeEventListener(EVENT_NAMES.DATA_SYNCED, callback);
  }

  // 清理过期任务
  cleanupExpiredTasks(maxAge = 24 * 60 * 60 * 1000) { // 24小时
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [taskId, task] of this.syncQueue.entries()) {
      if (now - task.timestamp > maxAge) {
        this.syncQueue.delete(taskId);
        this.pendingOperations.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期同步任务`);
    }
  }

  // 健康检查
  healthCheck() {
    const status = this.getStatus();
    const stats = this.getSyncStats();
    
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };

    // 检查队列大小
    if (status.queueSize > 50) {
      health.status = 'warning';
      health.issues.push('同步队列过大');
      health.recommendations.push('考虑清理过期任务或检查网络连接');
    }

    // 检查重试任务
    if (stats.retrying > 10) {
      health.status = 'warning';
      health.issues.push('重试任务过多');
      health.recommendations.push('检查API连接状态');
    }

    // 检查最后同步时间
    if (status.lastSyncTime && Date.now() - status.lastSyncTime > 60 * 60 * 1000) {
      health.status = 'warning';
      health.issues.push('长时间未同步');
      health.recommendations.push('检查网络连接和认证状态');
    }

    return health;
  }
}

// 创建全局实例
export const cloudSyncManager = new CloudSyncManager();
22. src/modules/navigation/navigation-manager.js
javascript
import { isDevEnv } from '../utils/common.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 导航管理器
 */
export class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.bindNavigationEvents();
    this.handleInitialNavigation();
    this.isInitialized = true;
  }

  bindNavigationEvents() {
    // 监听浏览器前进后退
    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });

    // 绑定导航链接
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (link && this.isInternalLink(link.href)) {
        event.preventDefault();
        this.navigateTo(link.href);
      }
    });
  }

  handleInitialNavigation() {
    // 处理页面重定向问题
    this.handleRedirectIssues();
    
    // 处理URL参数
    this.handleURLParams();
  }

  handleRedirectIssues() {
    const isDev = isDevEnv();
    
    if (!isDev) {
      return; // 生产环境不做任何"修正"，避免与 Clean URLs 冲突
    }

    // 开发环境纠正到 .html，方便本地静态文件访问
    if (!window.location.pathname.endsWith('.html')) {
      if (window.location.pathname.endsWith('/dashboard')) {
        window.location.replace('./dashboard.html' + window.location.search);
        return;
      }
      if (window.location.pathname.endsWith('/index') || window.location.pathname === '/') {
        window.location.replace('./index.html' + window.location.search);
        return;
      }
    }
  }

  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && this.currentPage === 'index') {
      // 延迟执行搜索，等待应用初始化完成
      setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && window.searchManager) {
          searchInput.value = searchQuery;
          window.searchManager.performSearch();
        }
      }, 1000);
    }
  }

  handlePopState(event) {
    const newPage = this.getCurrentPage();
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      console.log('页面导航:', newPage);
    }
  }

  getCurrentPage() {
    const pathname = window.location.pathname;
    
    if (pathname.includes('dashboard')) {
      return 'dashboard';
    } else if (pathname.includes('index') || pathname === '/' || pathname === '') {
      return 'index';
    }
    
    return 'unknown';
  }

  isInternalLink(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  async navigateTo(url, options = {}) {
    const { useReplace = false, retryOnError = true, maxRetries = 2, timeout = 5000 } = options;
    const isDev = isDevEnv();

    return new Promise((resolve, reject) => {
      try {
        // 统一前缀
        let target = url.startsWith('./') || url.startsWith('/') ? url : `./${url}`;

        // 开发环境：确保有 .html 后缀；生产环境：确保没有 .html 后缀
        if (isDev) {
          if (!/\.html(\?|$)/i.test(target)) {
            const [path, query = ''] = target.split('?');
            target = path.replace(/\/$/, '') + '.html' + (query ? '?' + query : '');
          }
        } else {
          // 去掉 .html（让 Cloudflare Pages 的 clean URLs 工作）
          target = target.replace(/\.html(\?|$)/i, (_, q) => q || '');
        }

        console.log(`📄 导航到: ${target} (${isDev ? '开发' : '生产'}环境)`);

        // 进行跳转
        if (useReplace) {
          window.location.replace(target);
        } else {
          window.location.href = target;
        }

        // 超时保护
        const timeoutId = setTimeout(() => {
          reject(new Error('导航超时'));
        }, timeout);

        // 页面跳转后这段一般不会执行到 resolve
        // 但为了完整性还是保留
        setTimeout(() => {
          clearTimeout(timeoutId);
          resolve();
        }, 100);

      } catch (error) {
        console.error('页面导航失败:', error);
        
        if (retryOnError && maxRetries > 0) {
          console.warn('导航失败，重试中...', error);
          setTimeout(() => {
            this.navigateTo(url, { ...options, maxRetries: maxRetries - 1 })
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject(error);
        }
      }
    });
  }

  async navigateToDashboard() {
    try {
      loading.show();

      const authToken = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      if (!authToken) {
        throw new Error('用户未登录');
      }

      console.log('🏠 导航到Dashboard');

      // 生产环境跳 /dashboard（无 .html），开发环境会在 navigateTo 内自动补 .html
      await this.navigateTo('dashboard', { useReplace: true });

    } catch (error) {
      console.error('跳转到dashboard失败:', error);
      toast.error('跳转失败: ' + error.message);

      if (error.message.includes('认证') || error.message.includes('未登录')) {
        if (window.modal) {
          window.modal.showLogin();
        }
      }
    } finally {
      loading.hide();
    }
  }

  async navigateToIndex() {
    try {
      await this.navigateTo('index');
    } catch (error) {
      console.error('跳转到首页失败:', error);
      toast.error('跳转失败: ' + error.message);
    }
  }

  // 刷新当前页面
  refresh() {
    window.location.reload();
  }

  // 后退
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigateToIndex();
    }
  }

  // 前进
  goForward() {
    window.history.forward();
  }

  // 更新URL参数而不重新加载页面
  updateURL(params, replace = false) {
    const url = new URL(window.location);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }

  // 获取当前URL参数
  getURLParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  }

  // 检查当前页面
  isCurrentPage(pageName) {
    return this.currentPage === pageName;
  }

  // 获取页面标题
  getPageTitle() {
    const titles = {
      index: '磁力快搜 - 专业版',
      dashboard: '用户面板 - 磁力快搜'
    };
    
    return titles[this.currentPage] || '磁力快搜';
  }

  // 设置页面标题
  setPageTitle(title) {
    document.title = title;
  }

  // 添加面包屑导航
  updateBreadcrumb(items) {
    const breadcrumb = document.querySelector('.breadcrumb');
    if (!breadcrumb) return;

    breadcrumb.innerHTML = items.map((item, index) => {
      const isLast = index === items.length - 1;
      if (isLast) {
        return `<span class="breadcrumb-item active">${item.text}</span>`;
      } else {
        return `<a href="${item.href}" class="breadcrumb-item">${item.text}</a>`;
      }
    }).join('<span class="breadcrumb-separator">/</span>');
  }

  // 检查是否可以访问某个页面
  canAccessPage(pageName) {
    const protectedPages = ['dashboard'];
    
    if (protectedPages.includes(pageName)) {
      const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      return !!token;
    }
    
    return true;
  }

  // 重定向到登录页面
  redirectToLogin(returnUrl = null) {
    const currentUrl = returnUrl || window.location.pathname + window.location.search;
    this.updateURL({ return: currentUrl }, true);
    
    if (window.modal) {
      window.modal.showLogin();
    } else {
      this.navigateToIndex();
    }
  }

  // 处理登录后的重定向
  handlePostLoginRedirect() {
    const params = this.getURLParams();
    const returnUrl = params.return;
    
    if (returnUrl) {
      this.navigateTo(returnUrl);
    }
  }
}

// 创建全局实例
export const navigationManager = new NavigationManager();

// 全局导航函数（向后兼容）
export function navigateToDashboard() {
  return navigationManager.navigateToDashboard();
}

export function navigateToPage(url, options = {}) {
  return navigationManager.navigateTo(url, options);
}
23. src/modules/performance/performance-monitor.js
javascript
import { APP_CONSTANTS } from '../../shared/constants.js';
import { apiClient } from '../api/api-client.js';

/**
 * 性能监控模块
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.setupPerformanceObservers();
    this.startMemoryMonitoring();
    this.bindPageVisibilityEvents();
    this.isInitialized = true;

    console.log('📊 性能监控已启动');
  }

  setupPerformanceObservers() {
    // 监听导航性能
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          this.handleNavigationEntries(list.getEntries());
        });
        navigationObserver.observe({ type: 'navigation', buffered: true });
        this.observers.set('navigation', navigationObserver);

        // 监听资源加载
        const resourceObserver = new PerformanceObserver((list) => {
          this.handleResourceEntries(list.getEntries());
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
        this.observers.set('resource', resourceObserver);

        // 监听用户交互
        const eventObserver = new PerformanceObserver((list) => {
          this.handleEventEntries(list.getEntries());
        });
        eventObserver.observe({ type: 'event', buffered: true });
        this.observers.set('event', eventObserver);

      } catch (error) {
        console.warn('性能观察器设置失败:', error);
      }
    }
  }

  handleNavigationEntries(entries) {
    entries.forEach(entry => {
      const metrics = {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        loadComplete: entry.loadEventEnd - entry.loadEventStart,
        domInteractive: entry.domInteractive - entry.fetchStart,
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: this.getLargestContentfulPaint()
      };

      this.metrics.set('navigation', metrics);
      console.log('📈 页面性能指标:', metrics);

      // 发送到服务器（如果启用分析）
      if (APP_CONSTANTS.ENABLE_ANALYTICS) {
        this.reportMetrics('navigation', metrics);
      }
    });
  }

  handleResourceEntries(entries) {
    const resources = entries.map(entry => ({
      name: entry.name,
      type: this.getResourceType(entry),
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0
    }));

    this.metrics.set('resources', resources);

    // 分析慢加载资源
    const slowResources = resources.filter(r => r.duration > 1000);
    if (slowResources.length > 0) {
      console.warn('🐌 慢加载资源:', slowResources);
    }
  }

  handleEventEntries(entries) {
    entries.forEach(entry => {
      if (entry.duration > 100) {
        console.warn('⚠️ 长时间交互事件:', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        });
      }
    });
  }

  startMemoryMonitoring() {
    if (!performance.memory) return;

    const checkMemory = () => {
      const memory = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };

      this.metrics.set('memory', memory);

      // 内存使用警告
      const usagePercent = (memory.used / memory.limit) * 100;
      if (usagePercent > 80) {
        console.warn('🚨 内存使用率过高:', `${usagePercent.toFixed(1)}%`);
      }
    };

    // 每30秒检查一次内存
    setInterval(checkMemory, 30000);
    checkMemory(); // 立即执行一次
  }

  bindPageVisibilityEvents() {
    let startTime = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏
        const sessionDuration = Date.now() - startTime;
        this.metrics.set('sessionDuration', sessionDuration);
      } else {
        // 页面重新可见
        startTime = Date.now();
      }
    });

    // 页面卸载时记录会话时间
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Date.now() - startTime;
      this.reportMetrics('session', { duration: sessionDuration });
    });
  }

  // 测量函数执行时间
  measureTime(func, label = 'function') {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }

  // 异步函数执行时间
  async measureAsyncTime(asyncFunc, label = 'async function') {
    const start = performance.now();
    const result = await asyncFunc();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }

  // 标记性能点
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  // 测量性能
  measure(name, startMark, endMark) {
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name);
        return entries[entries.length - 1]?.duration || 0;
      } catch (error) {
        console.error('性能测量失败:', error);
        return 0;
      }
    }
    return 0;
  }

  // 获取First Paint
  getFirstPaint() {
    const entries = performance.getEntriesByType('paint');
    const fpEntry = entries.find(entry => entry.name === 'first-paint');
    return fpEntry ? fpEntry.startTime : null;
  }

  // 获取First Contentful Paint
  getFirstContentfulPaint() {
    const entries = performance.getEntriesByType('paint');
    const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry ? fcpEntry.startTime : null;
  }

  // 获取Largest Contentful Paint
  getLargestContentfulPaint() {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry ? lastEntry.startTime : null);
          observer.disconnect();
        });

        try {
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (error) {
          resolve(null);
        }

        // 超时处理
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 5000);
      } else {
        resolve(null);
      }
    });
  }

  // 获取资源类型
  getResourceType(entry) {
    if (entry.initiatorType) {
      return entry.initiatorType;
    }
    
    const url = entry.name;
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    
    return 'other';
  }

  // 获取所有性能指标
  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // 获取性能摘要
  getPerformanceSummary() {
    const navigation = this.metrics.get('navigation') || {};
    const memory = this.metrics.get('memory') || {};
    const resources = this.metrics.get('resources') || [];

    return {
      pageLoad: {
        domReady: navigation.domInteractive,
        loadComplete: navigation.loadComplete,
        firstPaint: navigation.firstPaint,
        firstContentfulPaint: navigation.firstContentfulPaint
      },
      resources: {
        total: resources.length,
        cached: resources.filter(r => r.cached).length,
        slow: resources.filter(r => r.duration > 1000).length,
        totalSize: resources.reduce((sum, r) => sum + r.size, 0)
      },
      memory: {
        used: memory.used,
        total: memory.total,
        usage: memory.used && memory.limit ? (memory.used / memory.limit * 100).toFixed(1) + '%' : 'N/A'
      }
    };
  }

  // 报告性能指标
  async reportMetrics(type, metrics) {
    if (!navigator.onLine) return;

    try {
      await apiClient.recordAction('performance', {
        type,
        metrics,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    } catch (error) {
      console.error('性能指标上报失败:', error);
    }
  }

  // 检查性能问题
  checkPerformanceIssues() {
    const issues = [];
    const navigation = this.metrics.get('navigation') || {};
    const memory = this.metrics.get('memory') || {};
    const resources = this.metrics.get('resources') || [];

    // 检查页面加载时间
    if (navigation.loadComplete > 3000) {
      issues.push({
        type: 'slow_load',
        message: '页面加载时间过长',
        value: navigation.loadComplete,
        suggestion: '优化资源加载和代码'
      });
    }

    // 检查首次内容绘制
    if (navigation.firstContentfulPaint > 2500) {
      issues.push({
        type: 'slow_fcp',
        message: '首次内容绘制时间过长',
        value: navigation.firstContentfulPaint,
        suggestion: '优化关键路径渲染'
      });
    }

    // 检查内存使用
    if (memory.used && memory.limit) {
      const usagePercent = (memory.used / memory.limit) * 100;
      if (usagePercent > 75) {
        issues.push({
          type: 'high_memory',
          message: '内存使用率过高',
          value: usagePercent + '%',
          suggestion: '检查内存泄漏和优化代码'
        });
      }
    }

    // 检查慢资源
    const slowResources = resources.filter(r => r.duration > 2000);
    if (slowResources.length > 0) {
      issues.push({
        type: 'slow_resources',
        message: `发现${slowResources.length}个慢加载资源`,
        value: slowResources.map(r => r.name),
        suggestion: '优化资源大小和加载策略'
      });
    }

    return issues;
  }

  // 生成性能报告
  generateReport() {
    const summary = this.getPerformanceSummary();
    const issues = this.checkPerformanceIssues();
    
    return {
      summary,
      issues,
      recommendations: this.getRecommendations(issues),
      timestamp: new Date().toISOString()
    };
  }

  // 获取性能建议
  getRecommendations(issues) {
    const recommendations = [];

    if (issues.some(i => i.type === 'slow_load')) {
      recommendations.push('启用资源压缩和缓存');
      recommendations.push('使用CDN加速静态资源');
    }

    if (issues.some(i => i.type === 'slow_fcp')) {
      recommendations.push('内联关键CSS');
      recommendations.push('延迟加载非关键资源');
    }

    if (issues.some(i => i.type === 'high_memory')) {
      recommendations.push('检查和修复内存泄漏');
      recommendations.push('优化大对象的使用');
    }

    return recommendations;
  }

  // 清理监控器
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    this.metrics.clear();
    console.log('🧹 性能监控已清理');
  }
}

// 创建全局实例
export const performanceMonitor = new PerformanceMonitor();
24. src/pages/index-app.js
javascript
import { authManager } from '../modules/auth/auth-manager.js';
import { searchManager } from '../modules/search/search-manager.js';
import { favoritesManager } from '../modules/favorites/favorites-manager.js';
import { themeManager } from '../modules/ui/theme-manager.js';
import { modal } from '../modules/ui/modal.js';
import { toast } from '../modules/ui/toast.js';
import { loading } from '../modules/ui/loading.js';
import { cloudSyncManager } from '../modules/sync/cloud-sync-manager.js';
import { navigationManager } from '../modules/navigation/navigation-manager.js';
import { configManager } from '../modules/core/config.js';
import { apiClient } from '../modules/api/api-client.js';
import { APP_CONSTANTS, EVENT_NAMES } from '../shared/constants.js';

/**
 * 首页应用主类
 */
export class IndexApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = 'checking';
  }

  async init() {
    try {
      loading.show();
      console.log('🚀 初始化磁力快搜应用...');
      
      // 显示连接状态
      this.showConnectionStatus();
      
      // 加载系统配置
      await this.loadConfig();
      
      // 初始化核心模块
      this.initCoreModules();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 检查认证状态
      await this.checkAuthStatus();
      
      // 根据认证状态显示界面
      if (!this.currentUser) {
        document.getElementById('loginModal').style.display = 'block';
        document.querySelector('.main-content').style.display = 'none';
      } else {
        document.querySelector('.main-content').style.display = 'block';
        await this.loadUserData();
      }

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数
      navigationManager.handleURLParams();
      
      this.isInitialized = true;
      this.hideConnectionStatus();
      console.log('✅ 应用初始化完成');
      
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      this.connectionStatus = 'error';
      this.updateConnectionStatus('连接失败');
      toast.error('应用初始化失败，请刷新页面重试');
    } finally {
      loading.hide();
    }
  }

  async loadConfig() {
    try {
      configManager.init();
      const systemConfig = await apiClient.getConfig();
      console.log('📋 系统配置已加载:', systemConfig);
    } catch (error) {
      console.error('配置加载失败:', error);
    }
  }

  initCoreModules() {
    // 初始化各个管理器
    authManager.init();
    searchManager.init();
    favoritesManager.init();
    cloudSyncManager.init();
    navigationManager.init();
  }

  bindEvents() {
    // 认证相关事件
    this.bindAuthEvents();
    
    // 搜索相关事件
    this.bindSearchEvents();
    
    // 收藏相关事件
    this.bindFavoriteEvents();
    
    // 全局键盘快捷键
    this.bindKeyboardShortcuts();

    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type, user } = event.detail;
      if (type === 'login') {
        this.handleUserLogin(user);
      } else if (type === 'logout') {
        this.handleUserLogout();
      }
    });
  }

  bindAuthEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginBtn) loginBtn.addEventListener('click', () => modal.showLogin());
    if (showRegister) showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      modal.showRegister();
    });
    if (showLogin) showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      modal.showLogin();
    });

    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));

    // Dashboard导航
    const dashboardLink = document.querySelector('a[href*="dashboard"]');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigationManager.navigateToDashboard();
      });
    }
  }

  bindSearchEvents() {
    // 搜索管理器已经处理了搜索相关事件
    // 这里只需要绑定一些额外的UI事件
    
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    if (clearResultsBtn) clearResultsBtn.addEventListener('click', () => searchManager.clearResults());
    if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => this.exportResults());
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => searchManager.clearHistory());
  }

  bindFavoriteEvents() {
    const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');
    const importFavoritesBtn = document.getElementById('importFavoritesBtn');
    
    if (syncFavoritesBtn) syncFavoritesBtn.addEventListener('click', () => favoritesManager.syncFavorites());
    if (importFavoritesBtn) importFavoritesBtn.addEventListener('click', () => this.importFavorites());
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Escape 关闭模态框
      if (e.key === 'Escape') {
        modal.closeAll();
      }
    });
  }

  async checkAuthStatus() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    if (!token) {
      console.log('未找到认证token');
      return;
    }

    try {
      const result = await apiClient.verifyToken(token);
      if (result.success && result.user) {
        this.currentUser = result.user;
        authManager.setAuth(result.user, token);
        this.updateUserUI();
        console.log('✅ 用户认证成功:', this.currentUser.username);
      } else {
        localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
        console.log('Token验证失败，已清除');
      }
    } catch (error) {
      console.error('验证token失败:', error);
      localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    }
  }

  async loadUserData() {
    if (!this.currentUser) return;

    try {
      // 并行加载用户数据
      await Promise.all([
        favoritesManager.loadFavorites(),
        searchManager.loadSearchHistory()
      ]);
      
      console.log('✅ 用户数据加载完成');
    } catch (error) {
      console.error('加载用户数据失败:', error);
      toast.warning('部分数据加载失败');
    }
  }

  async testConnection() {
    try {
      this.updateConnectionStatus('检查连接...');
      const health = await apiClient.healthCheck();
      
      if (health.status === 'healthy') {
        this.connectionStatus = 'connected';
        this.updateConnectionStatus('连接正常');
        console.log('✅ API连接正常');
      } else {
        this.connectionStatus = 'warning';
        this.updateConnectionStatus('连接不稳定');
        console.warn('⚠️ API连接不稳定');
      }
    } catch (error) {
      this.connectionStatus = 'error';
      this.updateConnectionStatus('连接失败');
      console.error('❌ API连接失败:', error);
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }

    const result = await authManager.login(username, password);
    
    if (result.success) {
      this.currentUser = result.user;
      
      // 显示主内容区域
      document.querySelector('.main-content').style.display = 'block';
      
      // 关闭模态框
      modal.closeAll();
      
      // 登录后立即加载云端数据
      await this.loadUserData();
      
      // 处理URL参数（如搜索查询）
      navigationManager.handleURLParams();
      
      // 清空登录表单
      document.getElementById('loginForm').reset();
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    
    // 添加防止重复提交机制
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('submitting');
      submitBtn.textContent = '注册中...';
    }
    
    try {
      const username = document.getElementById('regUsername')?.value.trim();
      const email = document.getElementById('regEmail')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regConfirmPassword')?.value;

      // 客户端验证
      if (!username || !email || !password || !confirmPassword) {
        toast.error('请填写所有字段');
        return;
      }

      if (password !== confirmPassword) {
        toast.error('两次输入的密码不一致');
        return;
      }

      const result = await authManager.register(username, email, password);
      
      if (result.success) {
        modal.showLogin();
        
        // 清空注册表单
        document.getElementById('registerForm').reset();
        
        // 预填用户名到登录表单
        const loginUsername = document.getElementById('loginUsername');
        if (loginUsername) loginUsername.value = username;
      }
    } finally {
      // 重置按钮状态
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('submitting');
        submitBtn.textContent = '注册';
      }
    }
  }

  handleUserLogin(user) {
    this.currentUser = user;
    this.updateUserUI();
    
    // 显示同步相关按钮
    const syncButtons = document.querySelectorAll('#syncFavoritesBtn, #importFavoritesBtn');
    syncButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });
  }

  handleUserLogout() {
    this.currentUser = null;
    
    // 清空所有数据
    searchManager.setSearchHistory([]);
    favoritesManager.setFavorites([]);
    
    // 更新UI
    this.updateUserUI();
    
    // 隐藏主界面
    document.querySelector('.main-content').style.display = 'none';
    
    // 显示登录模态框
    modal.showLogin();
    
    // 隐藏同步相关按钮
    const syncButtons = document.querySelectorAll('#syncFavoritesBtn, #importFavoritesBtn');
    syncButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  }

  updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');

    if (this.currentUser) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (username) username.textContent = this.currentUser.username;
      
      // 绑定退出登录事件
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = () => this.logout();
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (userInfo) userInfo.style.display = 'none';
    }
  }

  async logout() {
    await authManager.logout();
  }

  async exportResults() {
    const results = searchManager.getCurrentResults();
    if (results.length === 0) {
      toast.error('没有搜索结果可以导出');
      return;
    }

    try {
      const data = {
        results,
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('搜索结果导出成功');
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  importFavorites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await favoritesManager.importFavorites(file);
      }
    };
    
    input.click();
  }

  // 连接状态管理
  showConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
      status.style.display = 'flex';
      this.updateConnectionStatus('正在连接...');
    }
  }

  hideConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status && this.connectionStatus === 'connected') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    }
  }

  updateConnectionStatus(text) {
    const statusText = document.querySelector('#connectionStatus .status-text');
    const indicator = document.querySelector('#connectionStatus .status-indicator');
    
    if (statusText) statusText.textContent = text;
    
    if (indicator) {
      indicator.className = `status-indicator ${this.connectionStatus}`;
    }
  }

  checkConnectionStatus() {
    if (this.isInitialized) {
      this.testConnection();
    }
  }

  // 添加到收藏
  async addToFavorites(item) {
    if (!this.currentUser) {
      toast.error('请先登录后再收藏');
      return false;
    }
    
    return await favoritesManager.addFavorite(item);
  }

  // 检查是否已收藏
  isFavorited(url) {
    return favoritesManager.isFavorited(url);
  }

  // 获取应用状态
  getAppStatus() {
    return {
      isInitialized: this.isInitialized,
      currentUser: this.currentUser,
      connectionStatus: this.connectionStatus,
      searchResults: searchManager.getCurrentResults().length,
      favorites: favoritesManager.getFavorites().length,
      searchHistory: searchManager.searchHistory.length
    };
  }
}

// 创建全局实例
export const indexApp = new IndexApp();
25. src/pages/dashboard-app.js
javascript
import { dashboardManager } from '../modules/dashboard/dashboard-manager.js';
import { authManager } from '../modules/auth/auth-manager.js';
import { themeManager } from '../modules/ui/theme-manager.js';
import { performanceMonitor } from '../modules/performance/performance-monitor.js';
import { configManager } from '../modules/core/config.js';
import { isDevEnv } from '../modules/utils/common.js';

/**
 * Dashboard页面应用类
 */
export class DashboardApp {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    try {
      // 检查开发环境URL修正
      if (this.needsUrlCorrection()) {
        return; // URL修正会导致页面重新加载
      }

      // 初始化性能监控
      if (configManager.getConfig().ENABLE_DEBUG) {
        performanceMonitor.init();
        performanceMonitor.mark('dashboard-init-start');
      }

      // 初始化核心模块
      this.initCoreModules();

      // 初始化Dashboard管理器
      await dashboardManager.init();

      this.isInitialized = true;

      if (performanceMonitor.isInitialized) {
        performanceMonitor.mark('dashboard-init-end');
        const initTime = performanceMonitor.measure('dashboard-init', 'dashboard-init-start', 'dashboard-init-end');
        console.log(`⏱️ Dashboard初始化耗时: ${initTime.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error('❌ Dashboard应用初始化失败:', error);
      throw error;
    }
  }

  needsUrlCorrection() {
    const isDev = isDevEnv();
    
    if (isDev && !window.location.pathname.endsWith('.html')) {
      console.log('开发环境修正URL到 .html 以便文件直开');
      window.location.replace('./dashboard.html' + window.location.search);
      return true;
    }
    
    return false;
  }

  initCoreModules() {
    // 初始化认证管理器
    authManager.init();
    
    // 初始化主题管理器
    themeManager.init();
    
    // 初始化配置管理器
    configManager.init();
  }

  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      dashboardReady: dashboardManager.isInitialized,
      authReady: authManager.isInitialized,
      themeReady: themeManager.isInitialized,
      performanceMonitoring: performanceMonitor.isInitialized
    };
  }
}

// 创建全局实例
export const dashboardApp = new DashboardApp();
26. src/main.js
javascript
// 应用主入口文件
import { errorHandler } from './shared/error-handler.js';
import { configManager } from './modules/core/config.js';
import { indexApp } from './pages/index-app.js';
import { dashboardApp } from './pages/dashboard-app.js';

/**
 * 应用初始化管理器
 */
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initStartTime = null;
  }

  async init() {
    if (this.initialized) return;

    this.initStartTime = performance.now();
    console.log('🚀 应用初始化开始（纯云端模式）');

    try {
      // 初始化错误处理
      errorHandler.init();

      // 初始化配置
      configManager.init();

      // 检查版本更新
      this.checkVersion();

      // 根据当前页面初始化对应的应用
      await this.initPageApp();

      // 初始化完成
      this.initialized = true;
      const initTime = performance.now() - this.initStartTime;
      console.log(`✅ 应用初始化完成 (${initTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      errorHandler.handleError('App Initialization Error', error);
      throw error;
    }
  }

  async initPageApp() {
    const currentPage = this.getCurrentPage();
    
    console.log(`📄 初始化${currentPage}页面应用`);
    
    switch (currentPage) {
      case 'dashboard':
        // 设置全局引用
        window.dashboardApp = dashboardApp;
        window.app = dashboardApp.dashboardManager || dashboardApp;
        
        await dashboardApp.init();
        break;
        
      case 'index':
      default:
        // 设置全局引用
        window.indexApp = indexApp;
        window.app = indexApp;
        
        await indexApp.init();
        break;
    }
  }

  getCurrentPage() {
    const pathname = window.location.pathname;
    
    if (pathname.includes('dashboard')) {
      return 'dashboard';
    } else if (pathname.includes('index') || pathname === '/' || pathname === '') {
      return 'index';
    }
    
    return 'index'; // 默认为首页
  }

  checkVersion() {
    const config = configManager.getConfig();
    const currentVersion = config.APP_VERSION;
    const storedVersion = localStorage.getItem('app_version');
    
    if (!storedVersion || storedVersion !== currentVersion) {
      console.log(`📦 应用版本更新: ${storedVersion} -> ${currentVersion}`);
      
      // 清理旧版本数据
      this.cleanupLegacyData();
      
      // 更新版本号
      localStorage.setItem('app_version', currentVersion);
      
      // 显示更新提示
      if (storedVersion && window.toast) {
        window.toast.success(`应用已更新到版本 ${currentVersion}`);
      }
    }
  }

  cleanupLegacyData() {
    // 清理旧版本的业务数据，保留系统设置
    const keysToRemove = [
      'search_history', 'favorites', 'user_settings', 
      'search_cache_', 'temp_', 'cache'
    ];
    
    const allKeys = Object.keys(localStorage);
    let removedCount = 0;
    
    allKeys.forEach(key => {
      const shouldRemove = keysToRemove.some(pattern => 
        key.startsWith(pattern) || key.includes(pattern)
      );
      
      if (shouldRemove) {
        try {
          localStorage.removeItem(key);
          removedCount++;
        } catch (error) {
          console.error(`清理数据失败 ${key}:`, error);
        }
      }
    });
    
    if (removedCount > 0) {
      console.log(`🧹 清理了 ${removedCount} 个旧版本数据项`);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      initTime: this.initStartTime ? performance.now() - this.initStartTime : null,
      currentPage: this.getCurrentPage(),
      config: configManager.getConfig()
    };
  }
}

// 创建全局初始化器
const appInitializer = new AppInitializer();
window.appInitializer = appInitializer;

// DOM加载完成后自动初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await appInitializer.init();
    console.log('🎯 应用核心初始化完成，等待具体模块初始化...');
  } catch (error) {
    console.error('💥 应用初始化失败:', error);
    
    // 显示错误提示
    if (window.toast) {
      window.toast.error('应用初始化失败，请刷新页面重试', 5000);
    } else {
      alert('应用初始化失败，请刷新页面重试');
    }
  }
});

// 处理页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.app) {
    setTimeout(() => {
      if (window.app.checkConnectionStatus) {
        window.app.checkConnectionStatus();
      }
    }, 100);
  }
});

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  if (window.app && appInitializer.initialized) {
    errorHandler.handleError('Global Error', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
    if (window.app && window.app.logout) {
      window.app.logout();
    }
  }
  errorHandler.handleError('Unhandled Promise Rejection', event.reason);
});

// 导出到全局作用域（向后兼容）
window.AppInitializer = AppInitializer;

console.log('✅ 纯云端模式工具库已加载');
这样，整个前端应用就完成了ES6模块化改造。新的文件结构更加清晰，各个模块职责分明，便于维护和扩展。每个模块都是独立的，可以单独测试和使用，同时保持了与后端API的完全兼容。






