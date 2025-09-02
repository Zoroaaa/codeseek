// API服务增强版本 - 完善社区功能相关API
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

  // 社区搜索源API集合 - 完整版
  
  // 修复：获取社区搜索源列表（支持高级筛选）
  async getCommunitySearchSources(options = {}) {
    try {
      const params = new URLSearchParams();
      
      // 分页参数
      if (options.page && options.page > 0) params.append('page', options.page.toString());
      if (options.limit && options.limit > 0) params.append('limit', Math.min(options.limit, 100).toString());
      
      // 筛选参数
      if (options.category && options.category !== 'all') {
        params.append('category', options.category);
      }
      if (options.search && options.search.trim()) {
        params.append('search', options.search.trim());
      }
      if (options.tags && options.tags.length > 0) {
        params.append('tags', options.tags.join(','));
      }
      if (options.author) {
        params.append('author', options.author);
      }
      
      // 排序参数
      if (options.sort) params.append('sort', options.sort);
      if (options.order && ['asc', 'desc'].includes(options.order)) {
        params.append('order', options.order);
      }
      
      // 特殊筛选
      if (options.featured) params.append('featured', 'true');
      if (options.verified) params.append('verified', 'true');
      if (options.minRating && options.minRating > 0) {
        params.append('minRating', options.minRating.toString());
      }
      if (options.minDownloads && options.minDownloads > 0) {
        params.append('minDownloads', options.minDownloads.toString());
      }
      
      const endpoint = `/api/community/sources${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('请求社区搜索源:', endpoint);
      
      const response = await this.request(endpoint);
      
      return {
        success: true,
        sources: response.sources || [],
        pagination: response.pagination || {},
        filters: response.filters || {},
        total: response.pagination?.total || 0
      };
      
    } catch (error) {
      console.error('获取社区搜索源列表失败:', error);
      return {
        success: false,
        sources: [],
        pagination: {},
        total: 0,
        error: error.message
      };
    }
  }

  // 获取单个搜索源详情（包含完整信息）
  async getCommunitySourceDetails(sourceId) {
    try {
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      const response = await this.request(`/api/community/sources/${sourceId}`);
      return {
        success: true,
        source: response.source
      };
    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      return {
        success: false,
        source: null,
        error: error.message
      };
    }
  }

  // 分享搜索源到社区（支持完整参数）
  async shareSourceToCommunity(sourceData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    // 验证必需字段
    const requiredFields = ['name', 'urlTemplate', 'category'];
    const missingFields = requiredFields.filter(field => !sourceData[field] || sourceData[field].trim() === '');
    
    if (missingFields.length > 0) {
      throw new Error(`缺少必需字段: ${missingFields.join(', ')}`);
    }
    
    // 验证URL模板
    if (!sourceData.urlTemplate.includes('{keyword}')) {
      throw new Error('URL模板必须包含{keyword}占位符');
    }
    
    // 处理标签
    const processedTags = Array.isArray(sourceData.tags) 
      ? sourceData.tags.slice(0, 10).filter(tag => tag && tag.trim())
      : [];
    
    const payload = {
      name: sourceData.name.trim(),
      subtitle: sourceData.subtitle?.trim() || '',
      icon: sourceData.icon?.trim() || '🔍',
      urlTemplate: sourceData.urlTemplate.trim(),
      category: sourceData.category,
      description: sourceData.description?.trim() || '',
      tags: processedTags,
      isPublic: sourceData.isPublic !== false,
      allowComments: sourceData.allowComments !== false
    };
    
    try {
      console.log('分享搜索源到社区:', payload);
      
      const response = await this.request('/api/community/sources', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      return {
        success: true,
        message: response.message || '分享成功',
        sourceId: response.sourceId,
        status: response.status || 'active'
      };
      
    } catch (error) {
      console.error('分享搜索源失败:', error);
      throw error;
    }
  }

  // 下载/采用社区搜索源
  async downloadCommunitySource(sourceId) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }
    
    try {
      const response = await this.request(`/api/community/sources/${sourceId}/download`, {
        method: 'POST'
      });
      
      return {
        success: true,
        message: response.message || '下载成功',
        newSourceId: response.newSourceId,
        source: response.source
      };
      
    } catch (error) {
      console.error('下载社区搜索源失败:', error);
      throw error;
    }
  }

  // 点赞/收藏搜索源（支持多种类型）
  async toggleSourceLike(sourceId, likeType = 'like') {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }
    
    const validTypes = ['like', 'favorite', 'bookmark'];
    if (!validTypes.includes(likeType)) {
      throw new Error('无效的操作类型');
    }
    
    try {
      const response = await this.request(`/api/community/sources/${sourceId}/like`, {
        method: 'POST',
        body: JSON.stringify({ type: likeType })
      });
      
      return {
        success: true,
        action: response.action, // 'added' or 'removed'
        message: response.message,
        newCount: response.newCount
      };
      
    } catch (error) {
      console.error('点赞操作失败:', error);
      throw error;
    }
  }

  // 评价搜索源（支持匿名和完整评价）
  async reviewCommunitySource(sourceId, reviewData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }
    
    // 验证评分
    if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
      throw new Error('评分必须在1-5之间');
    }
    
    const payload = {
      rating: parseInt(reviewData.rating),
      comment: reviewData.comment?.trim() || '',
      isAnonymous: Boolean(reviewData.isAnonymous),
      tags: Array.isArray(reviewData.tags) ? reviewData.tags.slice(0, 5) : []
    };
    
    try {
      const response = await this.request(`/api/community/sources/${sourceId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      return {
        success: true,
        message: response.message || '评价提交成功',
        reviewId: response.reviewId
      };
      
    } catch (error) {
      console.error('提交评价失败:', error);
      throw error;
    }
  }

  // 举报搜索源（支持多种举报类型）
  async reportCommunitySource(sourceId, reportData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }
    
    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }
    
    if (!reportData.reason || !reportData.details) {
      throw new Error('举报原因和详细说明不能为空');
    }
    
    const validReasons = ['spam', 'inappropriate', 'copyright', 'malicious', 'misleading', 'other'];
    if (!validReasons.includes(reportData.reason)) {
      throw new Error('无效的举报原因');
    }
    
    const payload = {
      reason: reportData.reason,
      details: reportData.details.trim(),
      category: reportData.category || 'general',
      evidence: reportData.evidence || null
    };
    
    try {
      const response = await this.request(`/api/community/sources/${sourceId}/report`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      return {
        success: true,
        message: response.message || '举报已提交，我们会尽快处理',
        reportId: response.reportId
      };
      
    } catch (error) {
      console.error('提交举报失败:', error);
      throw error;
    }
  }

  // 修复：获取用户社区统计（完整版）
  async getUserCommunityStats() {
    if (!this.token) {
      return {
        success: false,
        stats: null,
        error: '用户未登录'
      };
    }
    
    try {
      console.log('请求用户社区统计数据');
      
      const response = await this.request('/api/community/user/stats');
      
      console.log('用户社区统计响应:', response);
      
      // 确保返回完整的统计结构
      const stats = {
        general: {
          sharedSources: response.stats?.general?.sharedSources || response.stats?.sharedSources || 0,
          sourcesDownloaded: response.stats?.general?.sourcesDownloaded || response.stats?.sourcesDownloaded || 0,
          totalLikes: response.stats?.general?.totalLikes || response.stats?.totalLikes || 0,
          totalDownloads: response.stats?.general?.totalDownloads || response.stats?.totalDownloads || 0,
          reviewsGiven: response.stats?.general?.reviewsGiven || response.stats?.reviewsGiven || 0,
          reputationScore: response.stats?.general?.reputationScore || response.stats?.reputationScore || 0,
          contributionLevel: response.stats?.general?.contributionLevel || response.stats?.contributionLevel || 'beginner'
        },
        recentShares: response.stats?.recentShares || []
      };
      
      return {
        success: true,
        stats: stats
      };
    } catch (error) {
      console.error('获取用户社区统计失败:', error);
      return {
        success: false,
        stats: {
          general: {
            sharedSources: 0,
            sourcesDownloaded: 0,
            totalLikes: 0,
            totalDownloads: 0,
            reviewsGiven: 0,
            reputationScore: 0,
            contributionLevel: 'beginner'
          },
          recentShares: []
        },
        error: error.message
      };
    }
  }

  // 修复：获取热门标签（支持分类筛选）
  async getPopularTags(category = null) {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.append('category', category);
      }
      
      const endpoint = `/api/community/tags${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('请求热门标签:', endpoint);
      
      const response = await this.request(endpoint);
      
      console.log('热门标签响应:', response);
      
      // 确保返回标准格式的标签数据
      const tags = (response.tags || []).map(tag => {
        if (typeof tag === 'string') {
          return {
            name: tag,
            usageCount: 1,
            count: 1,
            isOfficial: false
          };
        }
        return {
          name: tag.name || tag.tag || 'Unknown',
          usageCount: tag.usageCount || tag.count || tag.usage_count || 0,
          count: tag.count || tag.usageCount || tag.usage_count || 0,
          isOfficial: tag.isOfficial || tag.is_official || false,
          color: tag.color || null
        };
      });
      
      return {
        success: true,
        tags: tags
      };
    } catch (error) {
      console.error('获取热门标签失败:', error);
      return {
        success: false,
        tags: [],
        error: error.message
      };
    }
  }

  // 搜索社区搜索源（高级搜索）
  async searchCommunityPosts(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('搜索查询不能为空');
      }
      
      const params = new URLSearchParams();
      params.append('q', query.trim());
      
      if (options.category && options.category !== 'all') {
        params.append('category', options.category);
      }
      if (options.limit && options.limit > 0) {
        params.append('limit', Math.min(options.limit, 50).toString());
      }
      if (options.offset && options.offset >= 0) {
        params.append('offset', options.offset.toString());
      }
      if (options.sort) {
        params.append('sort', options.sort);
      }
      if (options.timeRange) {
        params.append('timeRange', options.timeRange);
      }
      
      const endpoint = `/api/community/search?${params.toString()}`;
      const response = await this.request(endpoint);
      
      return {
        success: true,
        sources: response.sources || [],
        query: response.query,
        total: response.total || 0,
        suggestions: response.suggestions || []
      };
      
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      return {
        success: false,
        sources: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 获取社区统计概览
  async getCommunityStats() {
    try {
      const response = await this.request('/api/community/stats');
      
      return {
        success: true,
        stats: response.stats || {
          totalSources: 0,
          totalDownloads: 0,
          totalUsers: 0,
          totalReviews: 0,
          averageRating: 0,
          categoriesCount: 0,
          topCategories: [],
          recentActivity: []
        }
      };
    } catch (error) {
      console.error('获取社区统计失败:', error);
      return {
        success: false,
        stats: null,
        error: error.message
      };
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

// 创建单例实例
export const apiService = new APIService();
export default apiService;