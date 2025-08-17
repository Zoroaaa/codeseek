// 认证服务模块
import { APP_CONSTANTS } from '../core/constants.js';
import { storageManager } from '../utils/storage.js';
import { showToast, showLoading } from '../utils/dom.js';
import { validateUsername, validateEmail, validatePassword } from '../utils/validation.js';
import apiService from './api.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = null;
    this.refreshTimer = null;
    this.init();
  }

  // 初始化认证管理器
  init() {
    this.loadStoredAuth();
    this.setupTokenRefresh();
  }

  // 从本地存储加载认证信息
  loadStoredAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    const user = storageManager.getItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER);
    
    if (token && user) {
      this.setAuth(user, token);
    }
  }

  // 设置认证信息
  setAuth(user, token) {
    this.currentUser = user;
    this.token = token;
    
    // 存储到本地
    localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
    storageManager.setItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER, user);
    
    // 设置API token
    apiService.setToken(token);
    
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
    storageManager.removeItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER);
    
    // 清除API token
    apiService.setToken(null);
    
    // 停止token刷新
    this.stopTokenRefresh();
    
    // 触发认证状态变化事件
    this.dispatchAuthEvent('logout', previousUser);
  }

  // 检查是否已登录
  isAuthenticated() {
    return !!(this.currentUser && this.token);
  }

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser;
  }

  // 获取token
  getToken() {
    return this.token;
  }

  // 登录
  async login(username, password) {
    try {
      showLoading(true);
      
      const response = await apiService.login(username, password);
      
      if (response.success && response.user && response.token) {
        this.setAuth(response.user, response.token);
        showToast(`欢迎回来，${response.user.username}！`, 'success');
        return { success: true, user: response.user };
      } else {
        throw new Error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      showToast(error.message || '登录失败，请稍后重试', 'error');
      return { success: false, message: error.message };
    } finally {
      showLoading(false);
    }
  }

  // 注册
  async register(username, email, password) {
    try {
      showLoading(true);
      
      // 客户端验证
      const validation = this.validateRegistration(username, email, password);
      if (!validation.valid) {
        throw new Error(validation.message);
      }
      
      const response = await apiService.register(username, email, password);
      
      if (response.success) {
        showToast('注册成功！请登录您的账户', 'success');
        return { success: true };
      } else {
        throw new Error(response.message || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      showToast(error.message || '注册失败，请稍后重试', 'error');
      return { success: false, message: error.message };
    } finally {
      showLoading(false);
    }
  }

  // 退出登录
  async logout() {
    try {
      if (this.token) {
        await apiService.logout();
      }
    } catch (error) {
      console.error('退出登录请求失败:', error);
    } finally {
      this.clearAuth();
      showToast('已退出登录', 'success');
    }
  }

  // 验证token
  async verifyToken() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await apiService.verifyToken(this.token);
      
      if (response.success && response.user) {
        this.currentUser = response.user;
        storageManager.setItem(APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER, response.user);
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
      const response = await apiService.request('/api/auth/refresh', {
        method: 'POST'
      });
      
      if (response.success && response.token) {
        this.token = response.token;
        localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, response.token);
        apiService.setToken(response.token);
      } else {
        this.clearAuth();
      }
    } catch (error) {
      console.error('刷新token失败:', error);
      this.clearAuth();
    }
  }

  // 触发认证事件
  dispatchAuthEvent(type, user) {
    const event = new CustomEvent('authStateChanged', {
      detail: { type, user }
    });
    window.dispatchEvent(event);
  }

  // 监听认证状态变化
  onAuthStateChanged(callback) {
    window.addEventListener('authStateChanged', callback);
  }

  // 移除认证状态监听
  offAuthStateChanged(callback) {
    window.removeEventListener('authStateChanged', callback);
  }

  // 获取用户权限
  getUserPermissions() {
    if (!this.currentUser) return [];
    return this.currentUser.permissions || [];
  }

  // 检查权限
  hasPermission(permission) {
    const permissions = this.getUserPermissions();
    return permissions.includes(permission) || permissions.includes(APP_CONSTANTS.PERMISSIONS.ADMIN);
  }

  // 要求认证
  requireAuth(message = '此操作需要登录') {
    if (!this.isAuthenticated()) {
      showToast(message, 'error');
      if (typeof app !== 'undefined' && app.showLoginModal) {
        app.showLoginModal();
      }
      return false;
    }
    return true;
  }
}

// 权限管理器
export const PermissionManager = {
  // 检查用户权限
  hasPermission(user, permission) {
    if (!user || !user.permissions) return false;
    
    return user.permissions.includes(permission) || 
           user.permissions.includes(APP_CONSTANTS.PERMISSIONS.ADMIN);
  },

  // 检查当前用户权限
  checkCurrentUserPermission(permission) {
    const auth = authManager;
    if (!auth || !auth.getCurrentUser()) return false;
    
    return this.hasPermission(auth.getCurrentUser(), permission);
  },

  // 获取权限列表
  getPermissionList(user) {
    if (!user || !user.permissions) return [];
    return user.permissions;
  },

  // 是否为高级用户
  isPremiumUser(user) {
    return this.hasPermission(user, APP_CONSTANTS.PERMISSIONS.PREMIUM);
  },

  // 是否为管理员
  isAdmin(user) {
    return this.hasPermission(user, APP_CONSTANTS.PERMISSIONS.ADMIN);
  }
};

// 创建全局认证管理器实例
export const authManager = new AuthManager();
export default authManager;