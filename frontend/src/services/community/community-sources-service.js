// src/services/community/community-sources-service.js
// 社区搜索源服务 - 从community-sources-api.js重构

export class CommunitySourcesService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.notificationService = null;
    
    this.sourcesCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService, notificationService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
    console.log('社区搜索源服务已初始化');
  }

  // 获取社区搜索源列表（支持高级筛选）
  async getCommunitySearchSources(options = {}) {
    try {
      const cacheKey = this.generateCacheKey('list', options);
      
      // 检查缓存
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          ...cached,
          fromCache: true
        };
      }

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
      
      const response = await this.apiClient.get(endpoint);
      
      const result = {
        success: true,
        sources: this.processSourcesList(response.sources || []),
        pagination: response.pagination || {},
        filters: response.filters || {},
        total: response.pagination?.total || 0
      };

      // 缓存结果
      this.setCachedData(cacheKey, result);
      
      return {
        ...result,
        fromCache: false
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

  // 获取单个搜索源详情
  async getCommunitySourceDetails(sourceId) {
    try {
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      const cacheKey = this.generateCacheKey('detail', { sourceId });
      
      // 检查缓存
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          source: cached.source,
          fromCache: true
        };
      }
      
      const response = await this.apiClient.get(`/api/community/sources/${sourceId}`);
      
      if (response.success) {
        const processedSource = this.processSourceDetail(response.source);
        
        const result = {
          source: processedSource
        };

        // 缓存结果
        this.setCachedData(cacheKey, result);
        
        return {
          success: true,
          source: processedSource,
          fromCache: false
        };
      } else {
        throw new Error(response.message || '获取搜索源详情失败');
      }
    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      return {
        success: false,
        source: null,
        error: error.message
      };
    }
  }

  // 分享搜索源到社区
  async shareSourceToCommunity(sourceData) {
    try {
      if (!this.authService?.isAuthenticated()) {
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
      
      // 处理标签 - 使用标签ID数组
      const processedTags = Array.isArray(sourceData.tags) 
        ? sourceData.tags.slice(0, 10).filter(tagId => tagId && typeof tagId === 'string')
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
      
      console.log('分享搜索源到社区:', payload);
      
      const response = await this.apiClient.post('/api/community/sources', payload);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('list');
        
        this.showNotification('搜索源分享成功', 'success');
        
        return {
          success: true,
          message: response.message || '分享成功',
          sourceId: response.sourceId,
          status: response.status || 'active'
        };
      } else {
        throw new Error(response.message || '分享失败');
      }
      
    } catch (error) {
      console.error('分享搜索源失败:', error);
      
      // 处理标签相关错误
      if (error.message.includes('tags') || error.message.includes('tag_id')) {
        throw new Error('标签数据格式错误，请重新选择标签');
      }
      
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 下载/采用社区搜索源
  async downloadCommunitySource(sourceId) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      const response = await this.apiClient.post(`/api/community/sources/${sourceId}/download`);
      
      if (response.success) {
        this.showNotification('搜索源下载成功', 'success');
        
        return {
          success: true,
          message: response.message || '下载成功',
          newSourceId: response.newSourceId,
          source: response.source
        };
      } else {
        throw new Error(response.message || '下载失败');
      }
      
    } catch (error) {
      console.error('下载社区搜索源失败:', error);
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 点赞/收藏搜索源
  async toggleSourceLike(sourceId, likeType = 'like') {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      const validTypes = ['like', 'favorite', 'bookmark'];
      if (!validTypes.includes(likeType)) {
        throw new Error('无效的操作类型');
      }
      
      const response = await this.apiClient.post(`/api/community/sources/${sourceId}/like`, {
        type: likeType
      });
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('detail');
        
        const actionText = response.action === 'added' ? '已添加' : '已移除';
        this.showNotification(`${actionText}${this.getLikeTypeText(likeType)}`, 'success');
        
        return {
          success: true,
          action: response.action, // 'added' or 'removed'
          message: response.message,
          newCount: response.newCount
        };
      } else {
        throw new Error(response.message || '操作失败');
      }
      
    } catch (error) {
      console.error('点赞操作失败:', error);
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 评价搜索源
  async reviewCommunitySource(sourceId, reviewData) {
    try {
      if (!this.authService?.isAuthenticated()) {
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
      
      const response = await this.apiClient.post(`/api/community/sources/${sourceId}/review`, payload);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('detail');
        
        this.showNotification('评价提交成功', 'success');
        
        return {
          success: true,
          message: response.message || '评价提交成功',
          reviewId: response.reviewId
        };
      } else {
        throw new Error(response.message || '评价提交失败');
      }
      
    } catch (error) {
      console.error('提交评价失败:', error);
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 举报搜索源
  async reportCommunitySource(sourceId, reportData) {
    try {
      if (!this.authService?.isAuthenticated()) {
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
      
      const response = await this.apiClient.post(`/api/community/sources/${sourceId}/report`, payload);
      
      if (response.success) {
        this.showNotification('举报已提交，我们会尽快处理', 'success');
        
        return {
          success: true,
          message: response.message || '举报已提交，我们会尽快处理',
          reportId: response.reportId
        };
      } else {
        throw new Error(response.message || '举报提交失败');
      }
      
    } catch (error) {
      console.error('提交举报失败:', error);
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 编辑社区分享的搜索源
  async editCommunitySource(sourceId, updates) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new Error('更新数据不能为空');
      }
      
      // 验证更新字段
      const allowedFields = ['name', 'subtitle', 'icon', 'description', 'tags', 'category'];
      const payload = {};
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          payload[key] = updates[key];
        }
      });
      
      if (Object.keys(payload).length === 0) {
        throw new Error('没有有效的更新字段');
      }
      
      // 验证必填字段
      if (payload.name && payload.name.trim().length < 2) {
        throw new Error('搜索源名称至少需要2个字符');
      }
      
      if (payload.category && !['jav', 'movie', 'torrent', 'other'].includes(payload.category)) {
        throw new Error('无效的分类');
      }
      
      // 处理标签数组
      if (payload.tags && Array.isArray(payload.tags)) {
        payload.tags = payload.tags.slice(0, 10).filter(tagId => 
          tagId && typeof tagId === 'string'
        );
      }
      
      console.log('编辑搜索源:', sourceId, payload);
      
      const response = await this.apiClient.put(`/api/community/sources/${sourceId}`, payload);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('detail');
        this.clearCacheByPattern('list');
        
        this.showNotification('搜索源更新成功', 'success');
        
        return {
          success: true,
          message: response.message || '更新成功',
          sourceId: response.sourceId || sourceId,
          updatedFields: response.updatedFields || Object.keys(payload)
        };
      } else {
        throw new Error(response.message || response.error || '更新失败');
      }
      
    } catch (error) {
      console.error('编辑搜索源失败:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('不存在') || error.message.includes('404')) {
        errorMessage = '搜索源不存在或您无权编辑';
      } else if (error.message.includes('权限')) {
        errorMessage = '您没有权限编辑此搜索源';
      } else if (error.message.includes('已存在')) {
        errorMessage = '搜索源名称已存在，请使用其他名称';
      } else if (error.message.includes('标签')) {
        errorMessage = '所选标签无效，请重新选择';
      }
      
      this.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // 删除社区搜索源
  async deleteCommunitySource(sourceId) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      // 添加ID格式验证
      if (typeof sourceId !== 'string' || sourceId.length < 10) {
        throw new Error('搜索源ID格式无效');
      }
      
      console.log('API删除搜索源请求:', sourceId);
      
      const response = await this.apiClient.delete(`/api/community/sources/${encodeURIComponent(sourceId)}`);
      
      console.log('API删除响应:', response);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('detail');
        this.clearCacheByPattern('list');
        
        this.showNotification('搜索源删除成功', 'success');
        
        return {
          success: true,
          message: response.message || '删除成功',
          deletedId: response.deletedId || sourceId,
          operations: response.operations || []
        };
      } else {
        throw new Error(response.message || response.error || '删除失败');
      }
      
    } catch (error) {
      console.error('删除API请求失败:', error);
      
      // 增强的错误处理
      let errorMessage = error.message;
      
      if (error.name === 'TimeoutError') {
        errorMessage = '删除请求超时，请稍后重试';
      } else if (error.message.includes('GREATEST')) {
        errorMessage = '数据库函数兼容性问题已修复，请刷新页面重试';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系管理员';
      } else if (error.message.includes('404')) {
        errorMessage = '搜索源不存在或已被删除';
      } else if (error.message.includes('403')) {
        errorMessage = '没有权限删除此搜索源';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      }
      
      this.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // 获取用户的社区统计
  async getUserCommunityStats() {
    try {
      if (!this.authService?.isAuthenticated()) {
        return {
          success: false,
          stats: null,
          error: '用户未登录'
        };
      }
      
      const cacheKey = this.generateCacheKey('userStats', {});
      
      // 检查缓存
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          stats: cached.stats,
          fromCache: true
        };
      }
      
      console.log('请求用户社区统计数据');
      
      const response = await this.apiClient.get('/api/community/user/stats');
      
      console.log('用户社区统计响应:', response);
      
      // 确保返回完整的统计结构，包括浏览量
      const stats = {
        general: {
          sharedSources: response.stats?.general?.sharedSources || response.stats?.sharedSources || 0,
          sourcesDownloaded: response.stats?.general?.sourcesDownloaded || response.stats?.sourcesDownloaded || 0,
          totalLikes: response.stats?.general?.totalLikes || response.stats?.totalLikes || 0,
          totalDownloads: response.stats?.general?.totalDownloads || response.stats?.totalDownloads || 0,
          totalViews: response.stats?.general?.totalViews || response.stats?.totalViews || 0,
          reviewsGiven: response.stats?.general?.reviewsGiven || response.stats?.reviewsGiven || 0,
          tagsCreated: response.stats?.general?.tagsCreated || response.stats?.tagsCreated || 0,
          reputationScore: response.stats?.general?.reputationScore || response.stats?.reputationScore || 0,
          contributionLevel: response.stats?.general?.contributionLevel || response.stats?.contributionLevel || 'beginner'
        },
        recentShares: response.stats?.recentShares || []
      };

      const result = { stats };
      
      // 缓存结果
      this.setCachedData(cacheKey, result);
      
      return {
        success: true,
        stats: stats,
        fromCache: false
      };
    } catch (error) {
      console.error('获取用户社区统计失败:', error);
      
      // 即使出错也返回基本的统计结构
      return {
        success: false,
        stats: {
          general: {
            sharedSources: 0,
            sourcesDownloaded: 0,
            totalLikes: 0,
            totalDownloads: 0,
            totalViews: 0,
            reviewsGiven: 0,
            tagsCreated: 0,
            reputationScore: 0,
            contributionLevel: 'beginner'
          },
          recentShares: []
        },
        error: error.message
      };
    }
  }

  // 搜索社区搜索源
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
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          sources: this.processSourcesList(response.sources || []),
          query: response.query,
          total: response.total || 0,
          suggestions: response.suggestions || []
        };
      } else {
        throw new Error(response.message || '搜索失败');
      }
      
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

  // 数据处理方法
  processSourcesList(sources) {
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      subtitle: source.subtitle || '',
      icon: source.icon || '🔍',
      description: source.description || '',
      category: source.category,
      tags: source.tags || [],
      author: source.author || source.user,
      stats: {
        views: source.stats?.views || source.stats?.view_count || 0,
        downloads: source.stats?.downloads || source.stats?.download_count || 0,
        likes: source.stats?.likes || source.stats?.like_count || 0,
        rating: source.stats?.rating || source.stats?.average_rating || 0
      },
      createdAt: source.createdAt || source.created_at,
      updatedAt: source.updatedAt || source.updated_at,
      isVerified: source.isVerified || source.is_verified || false,
      isFeatured: source.isFeatured || source.is_featured || false
    }));
  }

  processSourceDetail(source) {
    if (!source) return null;
    
    return {
      ...source,
      stats: {
        views: source.stats?.views || source.stats?.view_count || 0,
        downloads: source.stats?.downloads || source.stats?.download_count || 0,
        likes: source.stats?.likes || source.stats?.like_count || 0,
        rating: source.stats?.rating || source.stats?.average_rating || 0,
        reviewCount: source.stats?.reviewCount || source.stats?.review_count || 0
      }
    };
  }

  // 缓存管理
  generateCacheKey(type, options) {
    const optionsStr = JSON.stringify(options);
    return `${type}_${btoa(optionsStr).slice(0, 20)}`;
  }

  getCachedData(key) {
    const cached = this.sourcesCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    if (cached) {
      this.sourcesCache.delete(key);
    }
    
    return null;
  }

  setCachedData(key, data) {
    // 限制缓存大小
    if (this.sourcesCache.size >= 50) {
      const firstKey = this.sourcesCache.keys().next().value;
      this.sourcesCache.delete(firstKey);
    }
    
    this.sourcesCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCacheByPattern(pattern) {
    for (const [key] of this.sourcesCache) {
      if (key.includes(pattern)) {
        this.sourcesCache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.sourcesCache.clear();
  }

  // 工具方法
  getLikeTypeText(type) {
    const typeTexts = {
      'like': '点赞',
      'favorite': '收藏',
      'bookmark': '书签'
    };
    return typeTexts[type] || '操作';
  }

  showNotification(message, type = 'info') {
    if (this.notificationService) {
      this.notificationService.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      size: this.sourcesCache.size,
      keys: Array.from(this.sourcesCache.keys())
    };
  }

  // 健康检查
  healthCheck() {
    const dependenciesStatus = {
      apiClient: !!this.apiClient,
      authService: !!this.authService,
      notificationService: !!this.notificationService
    };

    return {
      status: 'healthy',
      dependencies: dependenciesStatus,
      cache: this.getCacheStats(),
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    this.clearAllCache();
  }
}

export default CommunitySourcesService;