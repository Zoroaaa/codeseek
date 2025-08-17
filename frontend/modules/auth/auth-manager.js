import { apiClient } from '../api/api-client.js';
import { storage } from '../storage/storage-manager.js';
import { EVENT_NAMES, APP_CONSTANTS } from '../../shared/constants.js';
import { toast } from '../utils/toast.js';
import { loading } from '../ui/loading.js';

/**
 * 认证管理器
 */
export class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.refreshTimer = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.loadStoredAuth();
    this.setupTokenRefresh();
    this.bindEvents();
    this.isInitialized = true;
  }

  bindEvents() {
    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type } = event.detail;
      if (type === 'logout') {
        this.clearAuth();
      }
    });
  }

  loadStoredAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    const user = storage.getItem('current_user');
    
    if (token && user) {
      this.setAuth(user, token);
    }
  }

  setAuth(user, token) {
    this.currentUser = user;
    this.token = token;
    
    localStorage.setItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN, token);
    storage.setItem('current_user', user);
    
    apiClient.setToken(token);
    this.startTokenRefresh();
    this.dispatchAuthEvent('login', user);
  }

  clearAuth() {
    const previousUser = this.currentUser;
    
    this.currentUser = null;
    this.token = null;
    
    localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    storage.removeItem('current_user');
    
    apiClient.setToken(null);
    this.stopTokenRefresh();
    this.dispatchAuthEvent('logout', previousUser);
  }

  isAuthenticated() {
    return !!(this.currentUser && this.token);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getToken() {
    return this.token;
  }

  async login(username, password) {
    try {
      loading.show();
      
      const response = await apiClient.login(username, password);
      
      if (response.success && response.user && response.token) {
        this.setAuth(response.user, response.token);
        toast.success(`欢迎回来，${response.user.username}！`);
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      toast.error(error.message || '登录失败，请稍后重试');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async register(username, email, password) {
    try {
      loading.show();
      
      const validation = this.validateRegistration(username, email, password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      const response = await apiClient.register(username, email, password);
      
      if (response.success) {
        toast.success('注册成功！请登录您的账户');
        return { success: true };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      toast.error(error.message || '注册失败，请稍后重试');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async logout() {
    try {
      if (this.token) {
        await apiClient.logout();
      }
    } catch (error) {
      console.error('退出登录请求失败:', error);
    } finally {
      this.clearAuth();
      toast.success('已退出登录');
    }
  }

  async verifyToken() {
    if (!this.token) return false;

    try {
      const response = await apiClient.verifyToken(this.token);
      
      if (response.success && response.user) {
        this.currentUser = response.user;
        storage.setItem('current_user', response.user);
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

  async changePassword(currentPassword, newPassword) {
    try {
      loading.show();
      
      const response = await apiClient.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        toast.success('密码修改成功');
        return { success: true };
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      console.error('密码修改失败:', error);
      toast.error(error.message || '密码修改失败');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  async deleteAccount() {
    try {
      loading.show();
      
      const response = await apiClient.deleteAccount();
      
      if (response.success) {
        this.clearAuth();
        toast.success('账户已删除');
        return { success: true };
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      toast.error(error.message || '删除账户失败');
      return { success: false, message: error.message };
    } finally {
      loading.hide();
    }
  }

  validateRegistration(username, email, password) {
    if (!username || username.length < 3) {
      return { valid: false, message: '用户名至少3个字符' };
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { valid: false, message: '用户名只能包含字母、数字和下划线' };
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { valid: false, message: '请输入有效的邮箱地址' };
    }

    if (!password || password.length < 6) {
      return { valid: false, message: '密码至少6个字符' };
    }

    return { valid: true };
  }

  setupTokenRefresh() {
    this.refreshTimer = setInterval(() => {
      if (this.isAuthenticated()) {
        this.verifyToken();
      }
    }, 30 * 60 * 1000); // 每30分钟检查一次
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

  dispatchAuthEvent(type, user) {
    const event = new CustomEvent(EVENT_NAMES.AUTH_STATE_CHANGED, {
      detail: { type, user }
    });
    window.dispatchEvent(event);
  }

  getUserPermissions() {
    if (!this.currentUser) return [];
    return this.currentUser.permissions || [];
  }

  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes('admin');
  }

  requireAuth(message = '此操作需要登录') {
    if (!this.isAuthenticated()) {
      toast.error(message);
      return false;
    }
    return true;
  }
}

// 创建全局实例
export const authManager = new AuthManager();