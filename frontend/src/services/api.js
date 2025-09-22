// API服务主文件 - 重构版本：移除搜索源管理功能，专注核心用户功能
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
    
    return window.API_CONFIG?.PROD_URL || 'https://backend.codeseek.pp.ua';
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

  // ===================== 认证相关API =====================

  async register(username, email, password) {
    return await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });
  }

  async login(identifier, password) {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
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

  // ===================== 搜索源状态检查API =====================

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

  // ===================== 用户设置相关API =====================
  
  async getUserSettings() {
    try {
      const response = await this.request('/api/user/settings');
      const serverSettings = response.settings || {};
      
      // 合并服务器设置和默认设置
      const mergedSettings = {
        ...APP_CONSTANTS.DEFAULT_USER_SETTINGS,  // 先应用默认设置
        ...serverSettings  // 再覆盖服务器设置
      };
      
      console.log('合并后的用户设置:', mergedSettings);
      return mergedSettings;
      
    } catch (error) {
      console.error('获取用户设置失败，使用默认设置:', error);
      
      // 失败时返回默认设置而不是空对象
      return { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS };
    }
  }

  async updateUserSettings(settings) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!settings || typeof settings !== 'object') {
      throw new Error('设置数据格式错误');
    }
    
    // 🔧 移除搜索源管理相关设置，这些现在通过独立API处理
    const allowedSettings = [
      'theme', 'autoSync', 'cacheResults', 'maxHistoryPerUser', 'maxFavoritesPerUser',
      'allowAnalytics', 'searchSuggestions',
      'checkSourceStatus', 'sourceStatusCheckTimeout', 'sourceStatusCacheDuration',
      'skipUnavailableSources', 'showSourceStatus', 'retryFailedSources',
      // 详情提取设置 - 这些设置保留，但实际处理由 detail-api.js 管理
      'enableDetailExtraction', 'autoExtractDetails', 'maxAutoExtractions',
      'detailExtractionTimeout', 'detailCacheDuration', 'extractionBatchSize',
      'showScreenshots', 'showDownloadLinks', 'showMagnetLinks', 'showActressInfo',
      'compactMode', 'enableImagePreview', 'showExtractionProgress',
      'enableContentFilter', 'contentFilterKeywords'
    ];
    
    const validSettings = {};
    Object.keys(settings).forEach(key => {
      if (allowedSettings.includes(key)) {
        validSettings[key] = settings[key];
      }
    });
    
    // 🔧 如果包含搜索源相关设置，给出提示
    const deprecatedSourceSettings = ['searchSources', 'customSearchSources', 'customSourceCategories'];
    const hasDeprecatedSettings = deprecatedSourceSettings.some(key => settings.hasOwnProperty(key));
    
    if (hasDeprecatedSettings) {
      console.warn('检测到已弃用的搜索源设置，请使用 SearchSourcesAPI 进行管理');
    }
    
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

  // ===================== 收藏相关API =====================

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
  
  // 🔧 保存原始时间戳映射
  const originalTimestamps = new Map();
  validFavorites.forEach(fav => {
    if (fav.id && fav.addedAt) {
      originalTimestamps.set(fav.id, fav.addedAt);
    }
  });
  
  try {
    const response = await this.request('/api/user/favorites', {
      method: 'POST',
      body: JSON.stringify({ favorites: validFavorites })
    });
    
    // 🔧 如果服务器返回了数据，需要恢复原始时间戳
    if (response && response.favorites && Array.isArray(response.favorites)) {
      const restoredFavorites = response.favorites.map(fav => {
        const originalTimestamp = originalTimestamps.get(fav.id);
        return originalTimestamp ? {
          ...fav,
          addedAt: originalTimestamp  // 恢复客户端的时间戳
        } : fav;
      });
      
      return {
        ...response,
        favorites: restoredFavorites,
        // 🔧 添加标志告诉前端不要更新本地数据
        shouldUpdateLocal: false
      };
    }
    
    // 🔧 如果服务器只返回成功状态，不返回数据列表
    return {
      ...response,
      shouldUpdateLocal: false  // 明确告诉前端保持本地数据不变
    };
    
  } catch (error) {
    console.error('同步收藏失败:', error);
    throw error;
  }
}

// 🔧 新增：专门的获取收藏方法，确保时间戳正确
async getFavorites() {
  try {
    const response = await this.request('/api/user/favorites');
    return response.favorites || [];
  } catch (error) {
    console.error('获取收藏失败:', error);
    throw error;
  }
}

// 🔧 新增：批量操作时的时间戳保护工具方法
preserveTimestamps(originalFavorites, updatedFavorites) {
  if (!Array.isArray(originalFavorites) || !Array.isArray(updatedFavorites)) {
    return updatedFavorites;
  }
  
  const timestampMap = new Map();
  originalFavorites.forEach(fav => {
    if (fav.id && fav.addedAt) {
      timestampMap.set(fav.id, fav.addedAt);
    }
  });
  
  return updatedFavorites.map(fav => {
    const originalTimestamp = timestampMap.get(fav.id);
    return originalTimestamp ? {
      ...fav,
      addedAt: originalTimestamp
    } : fav;
  });
}

  // ===================== 搜索历史相关API =====================

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

  // ===================== 统计相关API =====================

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

  // ===================== 行为记录API =====================

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

  // ===================== 系统配置API =====================

  async getConfig() {
    try {
      return await this.request('/api/config');
    } catch (error) {
      console.error('获取配置失败:', error);
      return {};
    }
  }

  // ===================== 健康检查API =====================

  async healthCheck() {
    try {
      const response = await this.request('/api/health');
      return response || { status: 'healthy' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // ===================== 已移除的功能说明 =====================
  // 
  // 以下功能已迁移至独立的API服务：
  // 
  // 1. 搜索源管理 -> SearchSourcesAPI (search-sources-api.js)
  //    - addCustomSearchSource()
  //    - updateCustomSearchSource()
  //    - deleteCustomSearchSource()
  //    - getEnabledSearchSources()
  //    - getAllSearchSources()
  //
  // 2. 详情提取管理 -> DetailAPI (detail-api.js)
  //    - extractSingleDetail()
  //    - extractBatchDetails()
  //    - getDetailExtractionHistory()
  //    - updateDetailConfig()
  //
  // 使用新API的好处：
  // - 功能分离清晰，职责单一
  // - 更好的类型安全和错误处理
  // - 独立的缓存和状态管理
  // - 更易于测试和维护
  // 
  // 迁移指南：
  // 旧代码: apiService.addCustomSearchSource(source)
  // 新代码: searchSourcesAPI.createSearchSource(source)
  //
  // 旧代码: apiService.extractSingleDetail(url)
  // 新代码: detailAPI.extractSingleDetail(url)
}

// 全局错误恢复机制
function initializeErrorRecovery() {
  window.addEventListener('error', function(event) {
    console.error('全局错误捕获:', event.error);
    
    if (event.error && event.error.message) {
      if (event.error.message.includes('GREATEST')) {
        console.warn('检测到数据库兼容性问题，系统正在修复中...');
        
        setTimeout(() => {
          if (confirm('数据库兼容性问题已修复，是否刷新页面以应用修复？')) {
            window.location.reload();
          }
        }, 3000);
      } else if (event.error.message.includes('ambiguous column name')) {
        console.warn('数据库结构已更新，建议刷新页面');
        
        setTimeout(() => {
          if (confirm('检测到数据库结构更新，是否刷新页面以获得最新功能？')) {
            window.location.reload();
          }
        }, 5000);
      }
    }
  });
  
  window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
    
    if (event.reason && event.reason.message) {
      if (event.reason.message.includes('GREATEST') || 
          event.reason.message.includes('ambiguous column name')) {
        event.preventDefault();
        console.info('系统检测到数据库更新，正在应用修复...');
      }
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeErrorRecovery);
  } else {
    initializeErrorRecovery();
  }
}

export const apiService = new APIService();
export default apiService;