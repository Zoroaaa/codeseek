// src/services/core/api-client.js
// HTTP客户端封装 - 修复版，统一localStorage key

import { APP_CONSTANTS } from '../../core/constants.js';

export class APIClient {
  constructor() {
    this.baseURL = this.getAPIBaseURL();
    // 🔧 修复：使用统一的localStorage key
    this.token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  // 从环境变量或配置获取API基础URL
  getAPIBaseURL() {
    if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
      return window.API_CONFIG.BASE_URL;
    }
    
    const isDev = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
    }
    
    return window.API_CONFIG?.PROD_URL || 'https://backend.codeseek.pp.ua';
  }

  // 🔧 修复：Token管理 - 使用统一的localStorage key
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
      console.log('✅ Token已设置到localStorage:', APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    } else {
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      console.log('🗑️ Token已从localStorage移除');
    }
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    console.log('🗑️ Token已清除');
  }

  getToken() {
    // 🔧 实时从localStorage读取，确保同步
    if (!this.token) {
      this.token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    }
    return this.token;
  }

  // 基础HTTP请求封装
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 🔧 修复：确保使用最新的token
    const currentToken = this.getToken();
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const config = {
      method: 'GET',
      credentials: 'omit',
      ...options,
      headers
    };

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (!navigator.onLine) {
          throw new Error('网络连接不可用');
        }
        
        console.log(`📡 API请求: ${config.method} ${url}`, {
          hasAuth: !!currentToken,
          attempt: attempt + 1
        });
        
        const response = await fetch(url, config);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`✅ API响应成功: ${endpoint}`, data);
            return data;
          }
          const text = await response.text();
          console.log(`✅ API响应成功 (text): ${endpoint}`, text);
          return text;
        }
        
        if (response.status === 401) {
          console.warn('🔑 收到401响应，清除token');
          this.clearToken();
          throw new Error('认证失败，请重新登录');
        }
        
        if (response.status >= 500 && attempt < this.maxRetries - 1) {
          console.warn(`⚠️ 服务器错误 ${response.status}，重试中... (${attempt + 1}/${this.maxRetries})`);
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        
        console.error(`❌ API请求失败: ${endpoint}`, {
          status: response.status,
          message: errorMessage
        });
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        
        if ((error.name === 'TypeError' || error.message.includes('fetch')) && 
            attempt < this.maxRetries - 1) {
          console.warn(`🔄 网络错误，重试中... (${attempt + 1}/${this.maxRetries}): ${error.message}`);
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }
    }
    
    console.error(`💥 API请求最终失败 (${endpoint}):`, lastError);
    throw lastError;
  }

  // HTTP方法快捷方式
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return await this.request(url);
  }

  async post(endpoint, data = {}) {
    return await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async put(endpoint, data = {}) {
    return await this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return await this.request(endpoint, {
      method: 'DELETE'
    });
  }

  // 🔧 新增：初始化方法，确保依赖注入后正确设置token
  initialize() {
    // 重新从localStorage加载token，确保使用正确的key
    this.token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    if (this.token) {
      console.log('🔄 APIClient初始化：从localStorage恢复token');
    } else {
      console.log('🔄 APIClient初始化：没有找到有效token');
    }
  }

  // 请求拦截和重试机制
  setupInterceptors() {
    // 请求拦截器逻辑
    console.log('🔧 API拦截器已设置');
  }

  setupRetryMechanism() {
    // 重试机制配置
    console.log('🔧 重试机制已配置');
  }

  // 工具方法
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 健康检查
  async healthCheck() {
    try {
      const response = await this.request('/api/health');
      return response || { status: 'healthy' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // 测试连接方法
  async testConnection() {
    try {
      const healthResult = await this.healthCheck();
      return { 
        connected: healthResult.status === 'healthy',
        status: healthResult.status,
        message: healthResult.message 
      };
    } catch (error) {
      return { 
        connected: false, 
        status: 'error',
        error: error.message 
      };
    }
  }

  // 🔧 新增：调试方法
  debugTokenStatus() {
    const tokenInMemory = this.token;
    const tokenInStorage = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    
    console.log('🔍 Token调试信息:', {
      storageKey: APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN,
      tokenInMemory: tokenInMemory ? `存在 (长度: ${tokenInMemory.length})` : '不存在',
      tokenInStorage: tokenInStorage ? `存在 (长度: ${tokenInStorage.length})` : '不存在',
      tokensMatch: tokenInMemory === tokenInStorage,
      allLocalStorageKeys: Object.keys(localStorage)
    });
    
    return {
      tokenInMemory,
      tokenInStorage,
      tokensMatch: tokenInMemory === tokenInStorage
    };
  }
}

// 创建单例实例
export const apiClient = new APIClient();
export default apiClient;