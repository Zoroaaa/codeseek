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