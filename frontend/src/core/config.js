// 配置管理模块
import { APP_CONSTANTS } from './constants-1.js';

class ConfigManager {
  constructor() {
    this.config = {};
    this.isInitialized = false;
  }

  // 初始化配置
  async init() {
    if (this.isInitialized) return this.config;

    try {
      // 从环境变量或其他来源获取配置
      this.config = {
        // API基础URL配置
        BASE_URL: this.getConfigValue('CF_API_BASE_URL', null),
        DEV_URL: this.getConfigValue('CF_DEV_API_URL', 'http://localhost:8787'),
        PROD_URL: this.getConfigValue('CF_PROD_API_URL', this.getDefaultProdURL()),
        
        // 应用配置
        APP_NAME: this.getConfigValue('CF_APP_NAME', APP_CONSTANTS.APP_NAME),
        APP_VERSION: this.getConfigValue('CF_APP_VERSION', APP_CONSTANTS.DEFAULT_VERSION),
        
        // 功能开关
        ENABLE_ANALYTICS: this.getBooleanConfig('CF_ENABLE_ANALYTICS', false),
        ENABLE_DEBUG: this.getBooleanConfig('CF_ENABLE_DEBUG', this.isDevelopment()),
        ENABLE_OFFLINE_MODE: this.getBooleanConfig('CF_ENABLE_OFFLINE_MODE', true),
        
        // 性能配置
        API_TIMEOUT: parseInt(this.getConfigValue('CF_API_TIMEOUT', APP_CONSTANTS.API.TIMEOUT)),
        RETRY_ATTEMPTS: parseInt(this.getConfigValue('CF_RETRY_ATTEMPTS', APP_CONSTANTS.API.RETRY_ATTEMPTS)),
        CACHE_DURATION: parseInt(this.getConfigValue('CF_CACHE_DURATION', APP_CONSTANTS.API.CACHE_DURATION))
      };

      // 自动检测并设置最佳API URL
      if (!this.config.BASE_URL) {
        this.config.BASE_URL = this.autoDetectApiURL();
      }

      // 验证URL格式
      this.config.BASE_URL = this.validateAndFixURL(this.config.BASE_URL);

      // 设置全局配置
      window.API_CONFIG = this.config;

      // 开发模式日志
      if (this.config.ENABLE_DEBUG) {
        this.logConfigInfo();
      }

      this.isInitialized = true;
      return this.config;

    } catch (error) {
      console.error('配置初始化失败:', error);
      throw error;
    }
  }

  // 获取配置值
  getConfigValue(key, defaultValue) {
    // 尝试从全局变量获取
    if (typeof window[key] !== 'undefined') {
      return window[key];
    }
    
    // 尝试从环境变量获取（Node.js环境）
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
    
    // 尝试从URL参数获取
    const urlParams = new URLSearchParams(window.location.search);
    const paramKey = key.toLowerCase().replace(/^cf_/, '');
    if (urlParams.has(paramKey)) {
      return urlParams.get(paramKey);
    }
    
    return defaultValue;
  }

  // 获取布尔配置值
  getBooleanConfig(key, defaultValue) {
    const value = this.getConfigValue(key, defaultValue);
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  }

  // 检测是否为开发环境
  isDevelopment() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname.includes('.local') ||
           window.location.port !== '' ||
           window.location.search.includes('dev=1');
  }

  // 获取默认生产环境URL
  getDefaultProdURL() {
    if (window.location.protocol === 'https:') {
      return 'https://backend.codeseek.pp.ua';
    } else {
      return '/api';
    }
  }

  // 自动检测最佳API URL
  autoDetectApiURL() {
    const isDev = this.isDevelopment();
    
    if (isDev) {
      console.log('🔧 检测到开发环境，使用开发API');
      return this.config.DEV_URL;
    } else {
      console.log('🌐 检测到生产环境，使用生产API');
      return this.config.PROD_URL;
    }
  }

  // 验证和修复URL
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

  // 日志配置信息
  logConfigInfo() {
    console.group('🔧 应用配置信息');
    console.log('📍 API地址:', this.config.BASE_URL);
    console.log('🏠 当前域名:', window.location.hostname);
    console.log('🌐 协议:', window.location.protocol);
    console.log('🚀 版本:', this.config.APP_VERSION);
    console.log('🔍 开发模式:', this.isDevelopment());
    console.log('📊 分析统计:', this.config.ENABLE_ANALYTICS);
    console.groupEnd();
  }

  // 获取当前配置
  getConfig() {
    return this.config;
  }

  // 验证配置
  validateConfig() {
    const issues = [];
    
    if (!this.config.BASE_URL) {
      issues.push('BASE_URL 未设置');
    }
    
    if (window.location.protocol === 'https:' && this.config.BASE_URL.startsWith('http:')) {
      issues.push('HTTPS页面使用HTTP API可能存在混合内容问题');
    }
    
    return {
      valid: issues.length === 0,
      issues: issues,
      config: this.config
    };
  }
}

// 创建单例实例
export const configManager = new ConfigManager();
export default configManager;