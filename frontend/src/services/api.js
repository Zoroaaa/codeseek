// API服务模块 - 完整支持搜索源状态检查功能
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';

class APIService {
  constructor() {
    this.baseURL = this.getAPIBaseURL();
    this.token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  getAPIBaseURL() {
    if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
      return window.API_CONFIG.BASE_URL;
    }
    
    const isDev = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
    }
    
    return window.API_CONFIG?.PROD_URL || 'https://codeseek-backend.tvhub.pp.ua';
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    }
  }

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

    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
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
        
        if (response.status === 401) {
          this.setToken(null);
          throw new Error('认证失败，请重新登录');
        }
        
        if (response.status >= 500 && attempt < this.maxRetries - 1) {
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
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        
        if ((error.name === 'TypeError' || error.message.includes('fetch')) && 
            attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }
    }
    
    console.error(`API请求失败 (${endpoint}):`, lastError);
    throw lastError;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 认证相关API
  async register(username, email, password) {
    return await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  }

  async login(username, password) {
    const response = await this.request('/api/auth/login', {
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
    
    try {
      return await this.request('/api/auth/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
    } catch (error) {
      console.error('Token验证失败:', error);
      throw error;
    }
  }

  async changePassword(currentPassword, newPassword) {
    return await this.request('/api/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ 
        currentPassword, 
        newPassword 
      })
    });
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('退出登录失败:', error);
    } finally {
      this.setToken(null);
    }
  }

  async deleteAccount() {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    try {
      const response = await this.request('/api/auth/delete-account', {
        method: 'POST'
      });
      
      if (response.success) {
        this.setToken(null);
      }
      
      return response;
    } catch (error) {
      console.error('删除账户失败:', error);
      throw error;
    }
  }

  // 收藏相关API
  async syncFavorites(favorites) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!Array.isArray(favorites)) {
      throw new Error('收藏数据格式错误');
    }
    
    const validFavorites = favorites.filter(fav => {
      return fav && fav.title && fav.url && 
             typeof fav.title === 'string' && 
             typeof fav.url === 'string';
    });
    
    if (validFavorites.length !== favorites.length) {
      console.warn('过滤了无效的收藏数据');
    }
    
    try {
      return await this.request('/api/user/favorites', {
        method: 'POST',
        body: JSON.stringify({ favorites: validFavorites })
      });
    } catch (error) {
      console.error('同步收藏失败:', error);
      throw error;
    }
  }

  async getFavorites() {
    const response = await this.request('/api/user/favorites');
    return response.favorites || [];
  }

  // 搜索历史相关API
  async syncSearchHistory(history) {
    try {
      const validHistory = history.filter(item => {
        return item && (item.query || item.keyword) && 
               typeof (item.query || item.keyword) === 'string' && 
               (item.query || item.keyword).trim().length > 0;
      }).map(item => ({
        id: item.id || generateId(),
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
    } catch (error) {
      console.error('同步搜索历史失败:', error);
      throw error;
    }
  }

  async saveSearchHistory(query, source = 'unknown') {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('搜索关键词不能为空');
    }

    return await this.request('/api/user/search-history', {
      method: 'POST',
      body: JSON.stringify({ 
        query: query.trim(), 
        source: source,
        timestamp: Date.now() 
      })
    });
  }

  async getSearchHistory() {
    try {
      const response = await this.request('/api/user/search-history');
      const history = response.history || response.searchHistory || [];
      
      return history.filter(item => {
        return item && (item.query || item.keyword) && 
               typeof (item.query || item.keyword) === 'string';
      }).map(item => ({
        ...item,
        keyword: item.keyword || item.query,
        query: item.query || item.keyword
      }));
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  async clearAllSearchHistory() {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    try {
      return await this.request('/api/user/search-history?operation=clear', {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      throw error;
    }
  }

  async deleteSearchHistory(historyId) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!historyId) {
      throw new Error('历史记录ID不能为空');
    }
    
    try {
      return await this.request(`/api/user/search-history/${historyId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      throw error;
    }
  }

  // 🔧 完整的用户设置API - 支持所有状态检查相关设置
  async getUserSettings() {
    try {
      const response = await this.request('/api/user/settings');
      const settings = response.settings || {};
      
      // 🆕 确保状态检查相关设置有默认值
      return {
        ...APP_CONSTANTS.DEFAULT_USER_SETTINGS,
        ...settings,
        // 确保状态检查设置的数据类型正确
        checkSourceStatus: Boolean(settings.checkSourceStatus),
        sourceStatusCheckTimeout: Number(settings.sourceStatusCheckTimeout) || 8000,
        sourceStatusCacheDuration: Number(settings.sourceStatusCacheDuration) || 300000,
        skipUnavailableSources: settings.skipUnavailableSources !== false,
        showSourceStatus: settings.showSourceStatus !== false,
        retryFailedSources: Boolean(settings.retryFailedSources)
      };
    } catch (error) {
      console.error('获取用户设置失败:', error);
      return { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS };
    }
  }

  // 🔧 增强的用户设置更新API - 完整支持状态检查设置
  async updateUserSettings(settings) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!settings || typeof settings !== 'object') {
      throw new Error('设置数据格式错误');
    }
    
    // 🆕 扩展允许的设置字段，包含所有状态检查相关设置
    const allowedSettings = [
      'theme', 
      'autoSync', 
      'cacheResults', 
      'maxHistoryPerUser', 
      'maxFavoritesPerUser',
      'searchSources',
      'customSearchSources',
      'customSourceCategories',
      'allowAnalytics',
      'searchSuggestions',
      // 🆕 状态检查相关设置
      'checkSourceStatus',
      'sourceStatusCheckTimeout',
      'sourceStatusCacheDuration',
      'skipUnavailableSources',
      'showSourceStatus',
      'retryFailedSources'
    ];
    
    const validSettings = {};
    Object.keys(settings).forEach(key => {
      if (allowedSettings.includes(key)) {
        validSettings[key] = settings[key];
      }
    });
    
    // 🆕 验证状态检查设置
    if (validSettings.hasOwnProperty('checkSourceStatus')) {
      validSettings.checkSourceStatus = Boolean(validSettings.checkSourceStatus);
    }
    
    if (validSettings.hasOwnProperty('sourceStatusCheckTimeout')) {
      const timeout = Number(validSettings.sourceStatusCheckTimeout);
      const [minTimeout, maxTimeout] = APP_CONSTANTS.VALIDATION_RULES.STATUS_CHECK.TIMEOUT_RANGE;
      if (timeout < minTimeout || timeout > maxTimeout) {
        throw new Error(`状态检查超时时间必须在 ${minTimeout}-${maxTimeout} 毫秒之间`);
      }
      validSettings.sourceStatusCheckTimeout = timeout;
    }
    
    if (validSettings.hasOwnProperty('sourceStatusCacheDuration')) {
      const cacheDuration = Number(validSettings.sourceStatusCacheDuration);
      if (cacheDuration < 60000 || cacheDuration > 3600000) { // 1分钟到1小时
        throw new Error('状态缓存时间必须在 60000-3600000 毫秒之间');
      }
      validSettings.sourceStatusCacheDuration = cacheDuration;
    }
    
    // 其他布尔类型设置的验证
    ['skipUnavailableSources', 'showSourceStatus', 'retryFailedSources'].forEach(key => {
      if (validSettings.hasOwnProperty(key)) {
        validSettings[key] = Boolean(validSettings[key]);
      }
    });
    
    // 验证搜索源数据格式
    if (validSettings.searchSources && !Array.isArray(validSettings.searchSources)) {
      throw new Error('搜索源格式错误：必须是数组');
    }
    
    if (validSettings.customSearchSources && !Array.isArray(validSettings.customSearchSources)) {
      throw new Error('自定义搜索源格式错误：必须是数组');
    }
    
    if (validSettings.customSourceCategories && !Array.isArray(validSettings.customSourceCategories)) {
      throw new Error('自定义分类格式错误：必须是数组');
    }
    
    // 验证自定义搜索源格式
    if (validSettings.customSearchSources) {
      const invalidSources = validSettings.customSearchSources.filter(source => 
        !source || !source.id || !source.name || !source.urlTemplate ||
        typeof source.id !== 'string' || typeof source.name !== 'string' || 
        typeof source.urlTemplate !== 'string'
      );
      
      if (invalidSources.length > 0) {
        throw new Error('自定义搜索源格式错误：缺少必需字段');
      }
    }
    
    if (validSettings.customSourceCategories) {
      const invalidCategories = validSettings.customSourceCategories.filter(category => 
        !category || !category.id || !category.name || !category.icon ||
        typeof category.id !== 'string' || typeof category.name !== 'string' || 
        typeof category.icon !== 'string'
      );
      
      if (invalidCategories.length > 0) {
        throw new Error('自定义分类格式错误：缺少必需字段');
      }
    }
    
    try {
      const response = await this.request('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: validSettings })
      });
      
      // 🆕 记录状态检查设置变更的分析事件
      if (validSettings.hasOwnProperty('checkSourceStatus')) {
        const eventName = validSettings.checkSourceStatus ? 
          'SOURCE_STATUS_CHECK_ENABLED' : 
          'SOURCE_STATUS_CHECK_DISABLED';
        
        this.recordAction(APP_CONSTANTS.ANALYTICS_EVENTS[eventName], {
          timeout: validSettings.sourceStatusCheckTimeout,
          cacheDuration: validSettings.sourceStatusCacheDuration,
          skipUnavailable: validSettings.skipUnavailableSources,
          showStatus: validSettings.showSourceStatus
        }).catch(console.error);
      }
      
      return response;
    } catch (error) {
      console.error('更新用户设置失败:', error);
      throw error;
    }
  }

  // 🆕 新增：搜索源状态检查相关API
  async recordSourceStatusCheck(checkResults) {
    if (!this.token) return;
    
    try {
      const summary = {
        totalSources: checkResults.length,
        availableSources: checkResults.filter(s => s.available).length,
        avgResponseTime: checkResults.reduce((sum, s) => sum + (s.responseTime || 0), 0) / checkResults.length,
        checkTimestamp: Date.now()
      };
      
      return await this.recordAction(APP_CONSTANTS.ANALYTICS_EVENTS.SOURCE_STATUS_CHECKED, summary);
    } catch (error) {
      console.error('记录状态检查结果失败:', error);
    }
  }

  // 自定义搜索源管理API
  async addCustomSearchSource(source) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!source || !source.name || !source.urlTemplate) {
      throw new Error('缺少必需字段：name, urlTemplate');
    }
    
    if (!source.id) {
      source.id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    const newSource = {
      id: source.id,
      name: source.name.trim(),
      subtitle: source.subtitle?.trim() || '自定义搜索源',
      icon: source.icon?.trim() || '🔍',
      urlTemplate: source.urlTemplate.trim(),
      category: source.category || 'others',
      isCustom: true,
      createdAt: Date.now(),
      // 🆕 状态检查配置
      checkMethod: source.checkMethod || 'favicon',
      statusCheckUrl: source.statusCheckUrl || null,
      timeout: source.timeout || APP_CONSTANTS.API.SOURCE_CHECK_TIMEOUT
    };
    
    try {
      const currentSettings = await this.getUserSettings();
      const customSources = currentSettings.customSearchSources || [];
      
      const existingSource = customSources.find(s => 
        s.id === newSource.id || s.name === newSource.name
      );
      
      if (existingSource) {
        throw new Error('搜索源ID或名称已存在');
      }
      
      const updatedCustomSources = [...customSources, newSource];
      
      return await this.updateUserSettings({
        ...currentSettings,
        customSearchSources: updatedCustomSources
      });
    } catch (error) {
      console.error('添加自定义搜索源失败:', error);
      throw error;
    }
  }

  async updateCustomSearchSource(sourceId, updates) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    try {
      const currentSettings = await this.getUserSettings();
      const customSources = currentSettings.customSearchSources || [];
      
      const sourceIndex = customSources.findIndex(s => s.id === sourceId);
      if (sourceIndex === -1) {
        throw new Error('未找到指定的自定义搜索源');
      }
      
      customSources[sourceIndex] = {
        ...customSources[sourceIndex],
        ...updates,
        updatedAt: Date.now()
      };
      
      return await this.updateUserSettings({
        ...currentSettings,
        customSearchSources: customSources
      });
    } catch (error) {
      console.error('更新自定义搜索源失败:', error);
      throw error;
    }
  }

  async deleteCustomSearchSource(sourceId) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    try {
      const currentSettings = await this.getUserSettings();
      let customSources = currentSettings.customSearchSources || [];
      let enabledSources = currentSettings.searchSources || [];
      
      const sourceExists = customSources.some(s => s.id === sourceId);
      if (!sourceExists) {
        throw new Error('未找到指定的自定义搜索源');
      }
      
      customSources = customSources.filter(s => s.id !== sourceId);
      enabledSources = enabledSources.filter(id => id !== sourceId);
      
      return await this.updateUserSettings({
        ...currentSettings,
        customSearchSources: customSources,
        searchSources: enabledSources
      });
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      throw error;
    }
  }

  // 统计相关API
  async getSearchStats() {
    if (!this.token) {
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
    
    try {
      return await this.request('/api/user/search-stats');
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
  }

  // 行为记录API
  async recordAction(action, data) {
    try {
      return await this.request('/api/actions/record', {
        method: 'POST',
        body: JSON.stringify({ action, data })
      });
    } catch (e) { 
      console.error('记录行为失败:', e); 
    }
  }

  // 系统配置API
  async getConfig() {
    try {
      return await this.request('/api/config');
    } catch (error) {
      console.error('获取配置失败:', error);
      return {};
    }
  }

  // 健康检查API
  async healthCheck() {
    try {
      const response = await this.request('/api/health');
      return response || { status: 'healthy' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }
}

export const apiService = new APIService();
export default apiService;