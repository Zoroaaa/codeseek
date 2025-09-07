// src/services/auth/auth-service.js
// 认证核心服务 - 从auth.js重构

import { APP_CONSTANTS } from '../../core/constants.js';
import { validateUsername, validateEmail, validatePassword } from '../../utils/validation.js';

export class AuthService {
  constructor() {
    this.apiClient = null; // 将通过依赖注入设置
    this.currentUser = null;
    this.token = null;
    this.refreshTimer = null;
    this.eventListeners = new Set();
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, notificationService] = dependencies;
    this.apiClient = apiClient;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
    this.loadStoredAuth();
    this.setupTokenRefresh();
  }

  // 从本地存储加载认证信息
  loadStoredAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    const userStr = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER);
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.setAuth(user, token);
      } catch (error) {
        console.error('解析用户信息失败:', error);
        this.clearAuth();
      }
    }
  }

  // 设置认证信息
  setAuth(user, token) {
    this.currentUser = user;
    this.token = token;
    
    // 存储到本地
    localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
    localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    
    // 设置API token
    if (this.apiClient) {
      this.apiClient.setToken(token);
    }
    
    // 启动token刷新定时器
    this.startTokenRefresh();
    
    // 触发认证状态变化事件
    this.dispatchAuthEvent('login', user);
  }

  // 清除认证信息
  clearAuth() {
    const previousUser = this.currentUser;
    
    this.currentUser = null;
    this.token = null;
    
    // 清除本地存储
    localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER);
    
    // 清除API token
    if (this.apiClient) {
      this.apiClient.clearToken();
    }
    
    // 停止token刷新
    this.stopTokenRefresh();
    
    // 触发认证状态变化事件
    this.dispatchAuthEvent('logout', previousUser);
  }

  // 登录
  async login(username, password) {
    try {
      this.showLoading(true);
      
      const response = await this.apiClient.post('/api/auth/login', {
        username,
        password
      });
      
      if (response.success && response.user && response.token) {
        this.setAuth(response.user, response.token);
        this.showNotification(`欢迎回来，${response.user.username}！`, 'success');
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      this.showNotification(error.message || '登录失败，请稍后重试', 'error');
      return { success: false, message: error.message };
    } finally {
      this.showLoading(false);
    }
  }

  // 注册
  async register(username, email, password) {
    try {
      this.showLoading(true);
      
      // 客户端验证
      const validation = this.validateRegistration(username, email, password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      const response = await this.apiClient.post('/api/auth/register', {
        username,
        email,
        password
      });
      
      if (response.success) {
        this.showNotification('注册成功！请登录您的账户', 'success');
        return { success: true };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      this.showNotification(error.message || '注册失败，请稍后重试', 'error');
      return { success: false, message: error.message };
    } finally {
      this.showLoading(false);
    }
  }

  // 退出登录
  async logout() {
    try {
      if (this.token) {
        await this.apiClient.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('退出登录请求失败:', error);
    } finally {
      this.clearAuth();
      this.showNotification('已退出登录', 'success');
    }
  }

  // 验证token
  async verifyToken() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await this.apiClient.post('/api/auth/verify-token', {
        token: this.token
      });
      
      if (response.success && response.user) {
        this.currentUser = response.user;
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER, JSON.stringify(response.user));
        return true;
      } else {
        this.clearAuth();
        return false;
      }
    } catch (error) {
      console.error('验证token失败:', error);
      this.clearAuth();
      return false;
    }
  }

  // 修改密码
  async changePassword(currentPassword, newPassword) {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      const response = await this.apiClient.put('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      if (response.success) {
        this.showNotification('密码修改成功', 'success');
        return { success: true };
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      console.error('修改密码失败:', error);
      this.showNotification(error.message || '密码修改失败', 'error');
      return { success: false, message: error.message };
    }
  }

  // 删除账户
  async deleteAccount() {
    try {
      if (!this.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      const response = await this.apiClient.post('/api/auth/delete-account');

      if (response.success) {
        this.clearAuth();
        this.showNotification('账户已删除', 'success');
        return { success: true };
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      this.showNotification(error.message || '删除账户失败', 'error');
      return { success: false, message: error.message };
    }
  }

  // 注册验证
  validateRegistration(username, email, password) {
    const usernameResult = validateUsername(username);
    if (!usernameResult.valid) {
      return { valid: false, message: usernameResult.errors[0] };
    }

    const emailResult = validateEmail(email);
    if (!emailResult.valid) {
      return { valid: false, message: emailResult.errors[0] };
    }

    const passwordResult = validatePassword(password);
    if (!passwordResult.valid) {
      return { valid: false, message: passwordResult.errors[0] };
    }

    return { valid: true };
  }

  // Token刷新机制
  setupTokenRefresh() {
    // 每30分钟检查一次token有效性
    this.refreshTimer = setInterval(() => {
      if (this.isAuthenticated()) {
        this.refreshToken();
      }
    }, 30 * 60 * 1000);
  }

  startTokenRefresh() {
    this.stopTokenRefresh();
    this.setupTokenRefresh();
  }

  stopTokenRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // 刷新token
  async refreshToken() {
    try {
      const response = await this.apiClient.post('/api/auth/refresh');
      
      if (response.success && response.token) {
        this.token = response.token;
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, response.token);
        this.apiClient.setToken(response.token);
      } else {
        this.clearAuth();
      }
    } catch (error) {
      console.error('刷新token失败:', error);
      this.clearAuth();
    }
  }

  // 状态查询方法
  isAuthenticated() {
    return !!(this.currentUser && this.token);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.token;
  }

  getUserId() {
    return this.currentUser?.id || null;
  }

  getUsername() {
    return this.currentUser?.username || null;
  }

  // 事件管理
  dispatchAuthEvent(type, user) {
    const event = new CustomEvent('authStateChanged', {
      detail: { type, user }
    });
    window.dispatchEvent(event);
  }

  onAuthStateChanged(callback) {
    const handler = (event) => callback(event.detail);
    window.addEventListener('authStateChanged', handler);
    this.eventListeners.add(handler);
    return handler;
  }

  offAuthStateChanged(callback) {
    window.removeEventListener('authStateChanged', callback);
    this.eventListeners.delete(callback);
  }

  // 权限检查
  requireAuth(message = '此操作需要登录') {
    if (!this.isAuthenticated()) {
      this.showNotification(message, 'error');
      // 触发登录模态框
      setTimeout(() => {
        this.dispatchAuthEvent('require_login', null);
      }, 100);
      return false;
    }
    return true;
  }

  // 工具方法
  showNotification(message, type) {
    if (this.notificationService) {
      this.notificationService.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  showLoading(show) {
    if (typeof window.showLoading === 'function') {
      window.showLoading(show);
    }
  }

  // 健康检查
  healthCheck() {
    return {
      status: this.isAuthenticated() ? 'authenticated' : 'not_authenticated',
      user: this.currentUser ? {
        id: this.currentUser.id,
        username: this.currentUser.username
      } : null,
      tokenExists: !!this.token,
      refreshTimerActive: !!this.refreshTimer
    };
  }

  // 销毁服务
  destroy() {
    this.stopTokenRefresh();
    
    // 清理事件监听器
    this.eventListeners.forEach(handler => {
      window.removeEventListener('authStateChanged', handler);
    });
    this.eventListeners.clear();
    
    this.clearAuth();
  }
}

export default AuthService;