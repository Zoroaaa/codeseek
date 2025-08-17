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
      DEV_URL: this.getConfigValue('CF_DEV_API_URL', 'https://codeseek.zadi.workers.dev'),
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
      return this.getConfigValue('CF_DEV_API_URL', 'https://codeseek.zadi.workers.dev');
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