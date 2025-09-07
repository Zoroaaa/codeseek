// src/services/community/community-tags-service.js
// 社区标签服务 - 从community-tags-api.js重构

export class CommunityTagsService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.notificationService = null;
    
    this.tagsCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10分钟缓存
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
    console.log('社区标签服务已初始化');
  }

  // 获取所有可用标签
  async getAllTags(options = {}) {
    try {
      const cacheKey = this.generateCacheKey('all', options);
      
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
      
      if (options.category && options.category !== 'all') {
        params.append('category', options.category);
      }
      if (options.official !== undefined) {
        params.append('official', options.official.toString());
      }
      if (options.active !== undefined) {
        params.append('active', options.active.toString());
      }
      
      const endpoint = `/api/community/tags${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        const result = {
          tags: this.processTagsList(response.tags || []),
          total: response.total || 0
        };

        // 缓存结果
        this.setCachedData(cacheKey, result);
        
        return {
          success: true,
          ...result,
          fromCache: false
        };
      } else {
        throw new Error(response.message || '获取标签列表失败');
      }
      
    } catch (error) {
      console.error('获取所有标签失败:', error);
      
      if (error.message.includes('no such column: tags_created')) {
        return {
          success: false,
          tags: [],
          total: 0,
          error: '数据库需要添加 tags_created 列，请执行: ALTER TABLE community_user_stats ADD COLUMN tags_created INTEGER DEFAULT 0;'
        };
      }
      
      return {
        success: false,
        tags: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 创建新标签
  async createTag(tagData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!tagData || !tagData.name) {
        throw new Error('标签名称不能为空');
      }
      
      // 验证标签名称
      const name = tagData.name.trim();
      if (name.length < 2 || name.length > 20) {
        throw new Error('标签名称长度必须在2-20个字符之间');
      }
      
      const payload = {
        name: name,
        description: tagData.description?.trim() || '',
        color: tagData.color || '#3b82f6'
      };
      
      // 验证颜色格式
      if (!/^#[0-9a-fA-F]{6}$/.test(payload.color)) {
        throw new Error('颜色格式不正确');
      }
      
      console.log('创建标签请求数据:', payload);
      
      const response = await this.apiClient.post('/api/community/tags', payload);
      
      console.log('创建标签响应:', response);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('all');
        this.clearCacheByPattern('popular');
        
        this.showNotification('标签创建成功', 'success');
        
        return {
          success: true,
          tag: response.tag,
          message: response.message || '标签创建成功'
        };
      } else {
        // 处理服务器返回的错误
        throw new Error(response.message || response.error || '创建标签失败');
      }
      
    } catch (error) {
      console.error('创建标签API请求失败:', error);
      
      // 增强的错误分类和处理
      let errorMessage = error.message;
      
      if (error.message.includes('ambiguous column name')) {
        errorMessage = '数据库列名冲突，请联系管理员更新数据库架构';
      } else if (error.message.includes('SQLITE_ERROR')) {
        errorMessage = 'SQL执行错误，请检查数据格式或联系技术支持';
      } else if (error.message.includes('UNIQUE constraint')) {
        errorMessage = '标签名称已存在，请使用其他名称';
      } else if (error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else if (error.message.includes('401') || error.message.includes('认证')) {
        errorMessage = '认证失败，请重新登录';
      } else if (error.message.includes('403') || error.message.includes('权限')) {
        errorMessage = '没有权限执行此操作';
      } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请稍后重试或联系管理员';
      }
      
      this.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }

  // 更新标签
  async updateTag(tagId, updates) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!tagId) {
        throw new Error('标签ID不能为空');
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new Error('更新数据不能为空');
      }
      
      const allowedFields = ['description', 'color', 'isActive'];
      const payload = {};
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          payload[key] = updates[key];
        }
      });
      
      if (Object.keys(payload).length === 0) {
        throw new Error('没有有效的更新字段');
      }
      
      // 验证颜色格式
      if (payload.color && !/^#[0-9a-fA-F]{6}$/.test(payload.color)) {
        throw new Error('颜色格式不正确');
      }
      
      console.log('更新标签:', tagId, payload);
      
      const response = await this.apiClient.put(`/api/community/tags/${tagId}`, payload);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('all');
        this.clearCacheByPattern('detail');
        
        this.showNotification('标签更新成功', 'success');
        
        return {
          success: true,
          message: response.message || '标签更新成功'
        };
      } else {
        throw new Error(response.message || '更新标签失败');
      }
      
    } catch (error) {
      console.error('更新标签失败:', error);
      
      // 处理后端架构变更错误
      if (error.message.includes('tag_active')) {
        throw new Error('数据库架构已更新，请刷新页面重试');
      }
      
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 删除标签
  async deleteTag(tagId) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!tagId) {
        throw new Error('标签ID不能为空');
      }
      
      console.log('删除标签:', tagId);
      
      const response = await this.apiClient.delete(`/api/community/tags/${tagId}`);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('all');
        this.clearCacheByPattern('detail');
        this.clearCacheByPattern('popular');
        
        this.showNotification('标签删除成功', 'success');
        
        return {
          success: true,
          message: response.message || '标签删除成功',
          deletedId: response.deletedId || tagId
        };
      } else {
        throw new Error(response.message || '删除标签失败');
      }
      
    } catch (error) {
      console.error('删除标签失败:', error);
      
      // 处理特定的业务逻辑错误
      if (error.message.includes('usage_count')) {
        throw new Error('标签正在被使用中，无法删除');
      } else if (error.message.includes('is_official')) {
        throw new Error('无法删除官方标签');
      }
      
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 获取热门标签（仅真实数据，去掉预设标签）
  async getPopularTags(category = null) {
    try {
      const cacheKey = this.generateCacheKey('popular', { category });
      
      // 检查缓存
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          tags: cached.tags,
          fromCache: true
        };
      }

      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.append('category', category);
      }
      
      const endpoint = `/api/community/tags${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('请求热门标签:', endpoint);
      
      const response = await this.apiClient.get(endpoint);
      
      console.log('热门标签响应:', response);
      
      // 只返回有真实使用数据的标签，过滤掉预设标签
      const realTags = (response.tags || [])
        .filter(tag => {
          const usageCount = tag.usageCount || tag.count || tag.usage_count || 0;
          return usageCount > 0; // 只保留真实使用过的标签
        })
        .map(tag => {
          if (typeof tag === 'string') {
            return {
              name: tag,
              usageCount: 1,
              count: 1,
              isOfficial: false
            };
          }
          return {
            id: tag.id,
            name: tag.name || tag.tag || 'Unknown',
            usageCount: tag.usageCount || tag.count || tag.usage_count || 0,
            count: tag.count || tag.usageCount || tag.usage_count || 0,
            isOfficial: tag.isOfficial || tag.is_official || false,
            color: tag.color || tag.tag_color || null
          };
        })
        .sort((a, b) => (b.usageCount || b.count) - (a.usageCount || a.count)); // 按使用次数排序
      
      console.log('过滤后的真实标签数量:', realTags.length);

      const result = { tags: realTags };
      
      // 缓存结果
      this.setCachedData(cacheKey, result);
      
      return {
        success: true,
        tags: realTags,
        fromCache: false
      };
    } catch (error) {
      console.error('获取热门标签失败:', error);
      
      // 处理标签系统相关错误
      if (error.message.includes('ambiguous column name') || 
          error.message.includes('is_active')) {
        console.warn('标签系统正在更新中');
        return {
          success: false,
          tags: [],
          error: '标签系统正在更新中，请稍后重试'
        };
      }
      
      return {
        success: false,
        tags: [],
        error: error.message
      };
    }
  }

  // 编辑标签
  async editTag(tagId, updates) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!tagId) {
        throw new Error('标签ID不能为空');
      }
      
      if (!updates || typeof updates !== 'object') {
        throw new Error('更新数据不能为空');
      }
      
      const allowedFields = ['name', 'description', 'color', 'isActive'];
      const payload = {};
      
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          payload[key] = updates[key];
        }
      });
      
      if (Object.keys(payload).length === 0) {
        throw new Error('没有有效的更新字段');
      }
      
      // 验证字段
      if (payload.name) {
        const trimmedName = payload.name.trim();
        if (trimmedName.length < 2 || trimmedName.length > 20) {
          throw new Error('标签名称长度必须在2-20个字符之间');
        }
        payload.name = trimmedName;
      }
      
      if (payload.color && !/^#[0-9a-fA-F]{6}$/.test(payload.color)) {
        throw new Error('颜色格式不正确，请使用#RRGGBB格式');
      }
      
      console.log('编辑标签:', tagId, payload);
      
      const response = await this.apiClient.put(`/api/community/tags/${tagId}`, payload);
      
      if (response.success) {
        // 清除相关缓存
        this.clearCacheByPattern('all');
        this.clearCacheByPattern('detail');
        this.clearCacheByPattern('popular');
        
        this.showNotification('标签更新成功', 'success');
        
        return {
          success: true,
          message: response.message || '标签更新成功',
          tagId: response.tagId || tagId,
          updatedFields: response.updatedFields || Object.keys(payload)
        };
      } else {
        throw new Error(response.message || response.error || '更新失败');
      }
      
    } catch (error) {
      console.error('编辑标签失败:', error);
      
      let errorMessage = error.message;
      if (error.message.includes('权限')) {
        errorMessage = '您没有权限编辑此标签';
      } else if (error.message.includes('已存在')) {
        errorMessage = '标签名称已存在，请使用其他名称';  
      } else if (error.message.includes('ambiguous column name')) {
        errorMessage = '数据库结构正在更新中，请稍后重试';
      }
      
      this.showNotification(errorMessage, 'error');
      throw new Error(errorMessage);
    }
  }
  
  // 获取单个标签详情
  async getTagDetails(tagId) {
    try {
      if (!tagId) {
        throw new Error('标签ID不能为空');
      }
      
      const cacheKey = this.generateCacheKey('detail', { tagId });
      
      // 检查缓存
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return {
          success: true,
          tag: cached.tag,
          fromCache: true
        };
      }
      
      const response = await this.apiClient.get(`/api/community/tags/${tagId}`);
      
      if (response.success) {
        const processedTag = this.processTagDetail(response.tag);
        
        const result = { tag: processedTag };
        
        // 缓存结果
        this.setCachedData(cacheKey, result);
        
        return {
          success: true,
          tag: processedTag,
          fromCache: false
        };
      } else {
        throw new Error(response.message || '获取标签详情失败');
      }
    } catch (error) {
      console.error('获取标签详情失败:', error);
      return {
        success: false,
        tag: null,
        error: error.message
      };
    }
  }

  // 批量操作标签状态
  async batchUpdateTagsStatus(tagIds, isActive) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!Array.isArray(tagIds) || tagIds.length === 0) {
        throw new Error('标签ID列表不能为空');
      }
      
      const promises = tagIds.map(tagId => 
        this.editTag(tagId, { isActive })
      );
      
      const results = await Promise.allSettled(promises);
      
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;
      
      const message = `成功更新 ${successes} 个标签，失败 ${failures} 个`;
      
      if (successes > 0) {
        this.showNotification(message, 'success');
      } else {
        this.showNotification(message, 'warning');
      }
      
      return {
        success: successes > 0,
        message,
        successes,
        failures,
        details: results
      };
      
    } catch (error) {
      console.error('批量更新标签状态失败:', error);
      this.showNotification(error.message, 'error');
      throw error;
    }
  }

  // 搜索标签
  async searchTags(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }

      const params = new URLSearchParams();
      params.append('q', query.trim());
      
      if (options.limit) {
        params.append('limit', Math.min(options.limit, 50).toString());
      }
      if (options.category) {
        params.append('category', options.category);
      }
      
      const endpoint = `/api/community/tags/search?${params.toString()}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          tags: this.processTagsList(response.tags || []),
          total: response.total || 0,
          query
        };
      } else {
        throw new Error(response.message || '搜索标签失败');
      }
    } catch (error) {
      console.error('搜索标签失败:', error);
      return {
        success: false,
        tags: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 数据处理方法
  processTagsList(tags) {
    return tags.map(tag => this.processTagDetail(tag));
  }

  processTagDetail(tag) {
    if (!tag) return null;
    
    if (typeof tag === 'string') {
      return {
        id: null,
        name: tag,
        description: '',
        color: '#3b82f6',
        usageCount: 0,
        isOfficial: false,
        isActive: true,
        createdAt: null
      };
    }
    
    return {
      id: tag.id,
      name: tag.name || tag.tag || '',
      description: tag.description || '',
      color: tag.color || tag.tag_color || '#3b82f6',
      usageCount: tag.usageCount || tag.count || tag.usage_count || 0,
      isOfficial: tag.isOfficial || tag.is_official || false,
      isActive: tag.isActive !== false,
      createdAt: tag.createdAt || tag.created_at,
      updatedAt: tag.updatedAt || tag.updated_at,
      author: tag.author || tag.user
    };
  }

  // 缓存管理
  generateCacheKey(type, options) {
    const optionsStr = JSON.stringify(options);
    return `${type}_${btoa(optionsStr).slice(0, 20)}`;
  }

  getCachedData(key) {
    const cached = this.tagsCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    
    if (cached) {
      this.tagsCache.delete(key);
    }
    
    return null;
  }

  setCachedData(key, data) {
    // 限制缓存大小
    if (this.tagsCache.size >= 30) {
      const firstKey = this.tagsCache.keys().next().value;
      this.tagsCache.delete(firstKey);
    }
    
    this.tagsCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCacheByPattern(pattern) {
    for (const [key] of this.tagsCache) {
      if (key.includes(pattern)) {
        this.tagsCache.delete(key);
      }
    }
  }

  clearAllCache() {
    this.tagsCache.clear();
  }

  // 标签验证
  validateTagData(tagData) {
    const errors = [];

    if (!tagData.name || tagData.name.trim().length < 2) {
      errors.push('标签名称至少需要2个字符');
    }

    if (tagData.name && tagData.name.trim().length > 20) {
      errors.push('标签名称不能超过20个字符');
    }

    if (tagData.color && !/^#[0-9a-fA-F]{6}$/.test(tagData.color)) {
      errors.push('颜色格式必须为#RRGGBB');
    }

    if (tagData.description && tagData.description.length > 200) {
      errors.push('标签描述不能超过200个字符');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 工具方法
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
      size: this.tagsCache.size,
      keys: Array.from(this.tagsCache.keys())
    };
  }

  // 获取标签统计
  getTagsStats() {
    const allTags = [];
    for (const [, cached] of this.tagsCache) {
      if (cached.data.tags) {
        allTags.push(...cached.data.tags);
      } else if (cached.data.tag) {
        allTags.push(cached.data.tag);
      }
    }

    return {
      totalCached: allTags.length,
      officialTags: allTags.filter(tag => tag.isOfficial).length,
      activeTags: allTags.filter(tag => tag.isActive).length
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
      stats: this.getTagsStats(),
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    this.clearAllCache();
  }
}
export { CommunityTagsService };
export default CommunityTagsService;