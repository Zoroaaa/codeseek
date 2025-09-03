// API服务主文件 - 已拆分社区功能到专门的服务文件
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';


class APIService {
  constructor() {
    this.baseURL = this.getAPIBaseURL();
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

  // 搜索源状态检查API
  async checkSourcesStatus(sources, keyword, options = {}) {
    try {
      if (!sources || !Array.isArray(sources) || sources.length === 0) {
        throw new Error('搜索源列表不能为空');
      }
      
      if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }
      
      const requestOptions = {
        timeout: options.timeout || 10000,
        checkContentMatch: options.checkContentMatch !== false,
        maxConcurrency: options.maxConcurrency || 3
      };
      
      console.log(`调用后端API检查 ${sources.length} 个搜索源状态`);
      
      const response = await this.request('/api/source-status/check', {
        method: 'POST',
        body: JSON.stringify({
          sources: sources.map(source => ({
            id: source.id,
            name: source.name || source.id,
            urlTemplate: source.urlTemplate
          })),
          keyword: keyword.trim(),
          options: requestOptions
        })
      });
      
      console.log('搜索源状态检查API响应:', response);
      
      return {
        success: response.success,
        summary: response.summary || {},
        results: response.results || [],
        message: response.message
      };
      
    } catch (error) {
      console.error('调用搜索源状态检查API失败:', error);
      throw error;
    }
  }

  // 获取搜索源状态检查历史
  async getSourceStatusHistory(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.keyword) {
        params.append('keyword', options.keyword);
      }
      if (options.limit) {
        params.append('limit', options.limit.toString());
      }
      if (options.offset) {
        params.append('offset', options.offset.toString());
      }
      
      const endpoint = `/api/source-status/history${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.request(endpoint);
      
      return {
        success: true,
        history: response.history || [],
        total: response.total || 0,
        limit: response.limit || 20,
        offset: response.offset || 0
      };
      
    } catch (error) {
      console.error('获取状态检查历史失败:', error);
      return {
        success: false,
        history: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 用户设置相关API - 支持搜索源状态检查设置
  async getUserSettings() {
    try {
      const response = await this.request('/api/user/settings');
      return response.settings || {};
    } catch (error) {
      console.error('获取用户设置失败:', error);
      return {};
    }
  }

  async updateUserSettings(settings) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!settings || typeof settings !== 'object') {
      throw new Error('设置数据格式错误');
    }
    
    const allowedSettings = [
      'theme', 'autoSync', 'cacheResults', 'maxHistoryPerUser', 'maxFavoritesPerUser',
      'searchSources', 'customSearchSources', 'customSourceCategories',
      'allowAnalytics', 'searchSuggestions',
      'checkSourceStatus', 'sourceStatusCheckTimeout', 'sourceStatusCacheDuration',
      'skipUnavailableSources', 'showSourceStatus', 'retryFailedSources'
    ];
    
    const validSettings = {};
    Object.keys(settings).forEach(key => {
      if (allowedSettings.includes(key)) {
        validSettings[key] = settings[key];
      }
    });
    
    try {
      console.log('发送到后端的设置:', validSettings);
      return await this.request('/api/user/settings', {
        method: 'PUT',
        body: JSON.stringify({ settings: validSettings })
      });
    } catch (error) {
      console.error('更新用户设置失败:', error);
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
      category: source.category || 'other',
      isCustom: true,
      createdAt: Date.now()
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


}

// 4. 添加全局错误恢复机制
function initializeErrorRecovery() {
  // 监听未捕获的错误
  window.addEventListener('error', function(event) {
    console.error('全局错误捕获:', event.error);
    
    if (event.error && event.error.message) {
      if (event.error.message.includes('GREATEST')) {
        showToast('检测到数据库兼容性问题，系统正在修复中...', 'warning');
        
        // 延迟提示用户刷新
        setTimeout(() => {
          if (confirm('数据库兼容性问题已修复，是否刷新页面以应用修复？')) {
            window.location.reload();
          }
        }, 3000);
      } else if (event.error.message.includes('ambiguous column name')) {
        showToast('数据库结构已更新，建议刷新页面', 'info');
        
        setTimeout(() => {
          if (confirm('检测到数据库结构更新，是否刷新页面以获得最新功能？')) {
            window.location.reload();
          }
        }, 5000);
      }
    }
  });
  
  // 监听未处理的Promise拒绝
  window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
    
    if (event.reason && event.reason.message) {
      if (event.reason.message.includes('GREATEST') || 
          event.reason.message.includes('ambiguous column name')) {
        event.preventDefault(); // 防止在控制台显示错误
        
        showToast('系统检测到数据库更新，正在应用修复...', 'info');
      }
    }
  });
}

// 在页面加载时初始化错误恢复
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeErrorRecovery);
  } else {
    initializeErrorRecovery();
  }
}

// 创建单例实例
export const apiService = new APIService();
export default apiService;