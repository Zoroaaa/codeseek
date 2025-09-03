// 社区标签管理API服务 - 从api.js拆分出来的标签相关功能
import { generateId } from '../utils/helpers.js';

class CommunityTagsAPI {
  constructor(baseAPIService) {
    this.api = baseAPIService;
  }

  // 🆕 修复：标签管理API集合 - 处理列名冲突和数据库错误
  
  // 获取所有可用标签 - 修复列名冲突处理
  async getAllTags(options = {}) {
    try {
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
        
        const response = await this.api.request(endpoint);
        
        return {
            success: true,
            tags: response.tags || [],
            total: response.total || 0
        };
        
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

  // 创建新标签 - 增强错误处理
  async createTag(tagData) {
    if (!this.api.token) {
      throw new Error('用户未登录');
    }
    
    if (!tagData || !tagData.name) {
      throw new Error('标签名称不能为空');
    }
    
    // 验证标签名称 - 简化验证逻辑
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
    
    try {
      console.log('创建标签请求数据:', payload);
      
      const response = await this.api.request('/api/community/tags', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      console.log('创建标签响应:', response);
      
      if (response.success) {
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
      
      throw new Error(errorMessage);
    }
  }

  // 更新标签 - 处理列名变更
  async updateTag(tagId, updates) {
    if (!this.api.token) {
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
    
    try {
      console.log('更新标签:', tagId, payload);
      
      const response = await this.api.request(`/api/community/tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      return {
        success: true,
        message: response.message || '标签更新成功'
      };
      
    } catch (error) {
      console.error('更新标签失败:', error);
      
      // 🔧 修复：处理后端架构变更错误
      if (error.message.includes('tag_active')) {
        throw new Error('数据库架构已更新，请刷新页面重试');
      }
      
      throw error;
    }
  }

  // 删除标签 - 处理用户权限验证
  async deleteTag(tagId) {
    if (!this.api.token) {
      throw new Error('用户未登录');
    }
    
    if (!tagId) {
      throw new Error('标签ID不能为空');
    }
    
    try {
      console.log('删除标签:', tagId);
      
      const response = await this.api.request(`/api/community/tags/${tagId}`, {
        method: 'DELETE'
      });
      
      return {
        success: true,
        message: response.message || '标签删除成功',
        deletedId: response.deletedId || tagId
      };
      
    } catch (error) {
      console.error('删除标签失败:', error);
      
      // 🔧 修复：处理特定的业务逻辑错误
      if (error.message.includes('usage_count')) {
        throw new Error('标签正在被使用中，无法删除');
      } else if (error.message.includes('is_official')) {
        throw new Error('无法删除官方标签');
      }
      
      throw error;
    }
  }

  // 🔧 修复：获取热门标签（仅真实数据，去掉预设标签）
  async getPopularTags(category = null) {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') {
        params.append('category', category);
      }
      
      const endpoint = `/api/community/tags${params.toString() ? `?${params.toString()}` : ''}`;
      
      console.log('请求热门标签:', endpoint);
      
      const response = await this.api.request(endpoint);
      
      console.log('热门标签响应:', response);
      
      // 🔧 修复：只返回有真实使用数据的标签，过滤掉预设标签
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
      
      return {
        success: true,
        tags: realTags
      };
    } catch (error) {
      console.error('获取热门标签失败:', error);
      
      // 🔧 修复：处理标签系统相关错误
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

  // 🆕 编辑标签 - 增强现有方法
  async editTag(tagId, updates) {
    if (!this.api.token) {
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
    
    try {
      console.log('编辑标签:', tagId, payload);
      
      const response = await this.api.request(`/api/community/tags/${tagId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      
      if (response.success) {
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
      
      throw new Error(errorMessage);
    }
  }
  
  // 🆕 获取单个标签详情
  async getTagDetails(tagId) {
    try {
      if (!tagId) {
        throw new Error('标签ID不能为空');
      }
      
      const response = await this.api.request(`/api/community/tags/${tagId}`);
      
      return {
        success: true,
        tag: response.tag
      };
    } catch (error) {
      console.error('获取标签详情失败:', error);
      return {
        success: false,
        tag: null,
        error: error.message
      };
    }
  }

  // 🆕 批量操作标签状态
  async batchUpdateTagsStatus(tagIds, isActive) {
    if (!this.api.token) {
      throw new Error('用户未登录');
    }
    
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new Error('标签ID列表不能为空');
    }
    
    try {
      const promises = tagIds.map(tagId => 
        this.editTag(tagId, { isActive })
      );
      
      const results = await Promise.allSettled(promises);
      
      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;
      
      return {
        success: successes > 0,
        message: `成功更新 ${successes} 个标签，失败 ${failures} 个`,
        successes,
        failures,
        details: results
      };
      
    } catch (error) {
      console.error('批量更新标签状态失败:', error);
      throw error;
    }
  }
}

export default CommunityTagsAPI;