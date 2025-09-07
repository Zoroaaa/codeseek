// src/services/user/user-service.js
// 用户信息服务 - 从api.js拆分的用户相关功能

export class UserService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.userCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
  }

  // 初始化
  initialize() {
    // 监听认证状态变化，清理用户缓存
    if (this.authService) {
      this.authService.onAuthStateChanged((event) => {
        if (event.type === 'logout') {
          this.clearUserCache();
        }
      });
    }
  }

  // 获取用户资料
  async getUserProfile(userId = null) {
    try {
      const targetUserId = userId || this.getCurrentUserId();
      
      if (!targetUserId) {
        throw new Error('用户ID不能为空');
      }

      // 检查缓存
      const cacheKey = `profile_${targetUserId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, profile: cached };
      }

      const endpoint = userId ? `/api/user/profile/${userId}` : '/api/user/profile';
      const response = await this.apiClient.get(endpoint);

      if (response.success) {
        // 缓存结果
        this.setCachedData(cacheKey, response.profile);
        return { success: true, profile: response.profile };
      } else {
        throw new Error(response.message || '获取用户资料失败');
      }
    } catch (error) {
      console.error('获取用户资料失败:', error);
      return { 
        success: false, 
        error: error.message,
        profile: null 
      };
    }
  }

  // 更新用户资料
  async updateProfile(profileData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!profileData || typeof profileData !== 'object') {
        throw new Error('用户资料数据格式错误');
      }

      // 验证更新字段
      const allowedFields = [
        'username', 'email', 'displayName', 'bio', 'avatar',
        'website', 'location', 'birthDate', 'gender', 'preferences'
      ];

      const validData = {};
      Object.keys(profileData).forEach(key => {
        if (allowedFields.includes(key) && profileData[key] !== undefined) {
          validData[key] = profileData[key];
        }
      });

      if (Object.keys(validData).length === 0) {
        throw new Error('没有有效的更新字段');
      }

      const response = await this.apiClient.put('/api/user/profile', validData);

      if (response.success) {
        // 清除缓存以强制重新获取
        this.clearUserCache();
        
        // 更新当前用户信息
        if (this.authService.getCurrentUser()) {
          const updatedUser = { ...this.authService.getCurrentUser(), ...validData };
          this.authService.setAuth(updatedUser, this.authService.getToken());
        }

        return { 
          success: true, 
          message: response.message || '资料更新成功',
          profile: response.profile 
        };
      } else {
        throw new Error(response.message || '更新用户资料失败');
      }
    } catch (error) {
      console.error('更新用户资料失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 修改密码
  async changePassword(currentPassword, newPassword) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!currentPassword || !newPassword) {
        throw new Error('密码不能为空');
      }

      if (newPassword.length < 6) {
        throw new Error('新密码长度至少6位');
      }

      const response = await this.apiClient.put('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (response.success) {
        return { 
          success: true, 
          message: response.message || '密码修改成功' 
        };
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 删除账户
  async deleteAccount() {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      // 确认操作
      const confirmed = confirm('确定要删除账户吗？此操作不可撤销！');
      if (!confirmed) {
        return { success: false, error: '操作已取消' };
      }

      const response = await this.apiClient.post('/api/auth/delete-account');

      if (response.success) {
        // 清除所有数据
        this.clearUserCache();
        this.authService.clearAuth();
        
        return { 
          success: true, 
          message: response.message || '账户已删除' 
        };
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取用户统计信息
  async getUserStats(userId = null) {
    try {
      const targetUserId = userId || this.getCurrentUserId();
      
      if (!targetUserId) {
        throw new Error('用户ID不能为空');
      }

      // 检查缓存
      const cacheKey = `stats_${targetUserId}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, stats: cached };
      }

      const endpoint = userId ? `/api/user/stats/${userId}` : '/api/user/stats';
      const response = await this.apiClient.get(endpoint);

      if (response.success) {
        const stats = response.stats || {
          searchCount: 0,
          favoritesCount: 0,
          sharedSourcesCount: 0,
          downloadedSourcesCount: 0,
          joinDate: null,
          lastActive: null
        };

        // 缓存结果（较短时间）
        this.setCachedData(cacheKey, stats, 2 * 60 * 1000); // 2分钟缓存
        
        return { success: true, stats };
      } else {
        throw new Error(response.message || '获取用户统计失败');
      }
    } catch (error) {
      console.error('获取用户统计失败:', error);
      return { 
        success: false, 
        error: error.message,
        stats: {
          searchCount: 0,
          favoritesCount: 0,
          sharedSourcesCount: 0,
          downloadedSourcesCount: 0,
          joinDate: null,
          lastActive: null
        }
      };
    }
  }

  // 获取用户活动记录
  async getUserActivity(options = {}) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      const params = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        type: options.type || 'all'
      };

      const response = await this.apiClient.get('/api/user/activity', params);

      if (response.success) {
        return { 
          success: true, 
          activities: response.activities || [],
          total: response.total || 0
        };
      } else {
        throw new Error(response.message || '获取用户活动失败');
      }
    } catch (error) {
      console.error('获取用户活动失败:', error);
      return { 
        success: false, 
        error: error.message,
        activities: [],
        total: 0
      };
    }
  }

  // 更新用户偏好设置
  async updatePreferences(preferences) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!preferences || typeof preferences !== 'object') {
        throw new Error('偏好设置数据格式错误');
      }

      const response = await this.apiClient.put('/api/user/preferences', {
        preferences
      });

      if (response.success) {
        // 清除缓存
        this.clearUserCache();
        
        return { 
          success: true, 
          message: response.message || '偏好设置已更新',
          preferences: response.preferences 
        };
      } else {
        throw new Error(response.message || '更新偏好设置失败');
      }
    } catch (error) {
      console.error('更新偏好设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取用户偏好设置
  async getPreferences() {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      // 检查缓存
      const cacheKey = `preferences_${this.getCurrentUserId()}`;
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { success: true, preferences: cached };
      }

      const response = await this.apiClient.get('/api/user/preferences');

      if (response.success) {
        const preferences = response.preferences || {};
        
        // 缓存结果
        this.setCachedData(cacheKey, preferences);
        
        return { success: true, preferences };
      } else {
        throw new Error(response.message || '获取偏好设置失败');
      }
    } catch (error) {
      console.error('获取偏好设置失败:', error);
      return { 
        success: false, 
        error: error.message,
        preferences: {}
      };
    }
  }

  // 验证用户邮箱
  async verifyEmail(verificationCode) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!verificationCode) {
        throw new Error('验证码不能为空');
      }

      const response = await this.apiClient.post('/api/user/verify-email', {
        code: verificationCode
      });

      if (response.success) {
        // 更新用户信息
        if (this.authService.getCurrentUser()) {
          const updatedUser = { 
            ...this.authService.getCurrentUser(), 
            emailVerified: true 
          };
          this.authService.setAuth(updatedUser, this.authService.getToken());
        }

        return { 
          success: true, 
          message: response.message || '邮箱验证成功' 
        };
      } else {
        throw new Error(response.message || '邮箱验证失败');
      }
    } catch (error) {
      console.error('邮箱验证失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 重新发送验证邮件
  async resendVerificationEmail() {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      const response = await this.apiClient.post('/api/user/resend-verification');

      if (response.success) {
        return { 
          success: true, 
          message: response.message || '验证邮件已发送' 
        };
      } else {
        throw new Error(response.message || '发送验证邮件失败');
      }
    } catch (error) {
      console.error('发送验证邮件失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取当前用户ID
  getCurrentUserId() {
    return this.authService?.getCurrentUser()?.id || null;
  }

  // 缓存管理
  getCachedData(key) {
    const cached = this.userCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.expiry) {
      return cached.data;
    }
    
    if (cached) {
      this.userCache.delete(key);
    }
    
    return null;
  }

  setCachedData(key, data, expiry = this.cacheExpiry) {
    this.userCache.set(key, {
      data,
      timestamp: Date.now(),
      expiry
    });
  }

  clearUserCache() {
    this.userCache.clear();
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.userCache.entries()) {
      if (now - value.timestamp >= value.expiry) {
        this.userCache.delete(key);
      }
    }
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      size: this.userCache.size,
      keys: Array.from(this.userCache.keys())
    };
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      apiClientConnected: !!this.apiClient,
      authServiceConnected: !!this.authService,
      isAuthenticated: this.authService?.isAuthenticated() || false,
      cacheSize: this.userCache.size
    };
  }

  // 销毁服务
  destroy() {
    this.clearUserCache();
  }
}

export default UserService;