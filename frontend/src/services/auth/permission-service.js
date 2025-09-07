// src/services/auth/permission-service.js
// 权限管理服务 - 从auth.js拆分

import { APP_CONSTANTS } from '../../core/constants.js';

export class PermissionService {
  constructor() {
    this.authService = null; // 将通过依赖注入设置
    this.permissionCache = new Map();
    this.roleHierarchy = {
      admin: ['premium', 'user'],
      premium: ['user'],
      user: []
    };
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [authService] = dependencies;
    this.authService = authService;
  }

  // 初始化
  initialize() {
    // 监听认证状态变化，清理权限缓存
    if (this.authService) {
      this.authService.onAuthStateChanged((event) => {
        if (event.type === 'logout') {
          this.clearPermissionCache();
        }
      });
    }
  }

  // 获取当前用户
  getCurrentUser() {
    return this.authService ? this.authService.getCurrentUser() : null;
  }

  // 检查用户权限
  hasPermission(permission, user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser || !targetUser.permissions) {
      return false;
    }
    
    // 检查缓存
    const cacheKey = `${targetUser.id}_${permission}`;
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey);
    }
    
    const hasPermission = this.checkPermissionInternal(targetUser, permission);
    
    // 缓存结果
    this.permissionCache.set(cacheKey, hasPermission);
    
    return hasPermission;
  }

  // 内部权限检查逻辑
  checkPermissionInternal(user, permission) {
    // 直接权限检查
    if (user.permissions.includes(permission)) {
      return true;
    }
    
    // 管理员拥有所有权限
    if (user.permissions.includes(APP_CONSTANTS.PERMISSIONS.ADMIN)) {
      return true;
    }
    
    // 角色继承检查
    for (const userRole of user.permissions) {
      if (this.roleHierarchy[userRole] && this.roleHierarchy[userRole].includes(permission)) {
        return true;
      }
    }
    
    return false;
  }

  // 检查多个权限（需要全部满足）
  hasAllPermissions(permissions, user = null) {
    if (!Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.every(permission => this.hasPermission(permission, user));
  }

  // 检查多个权限（满足任一即可）
  hasAnyPermission(permissions, user = null) {
    if (!Array.isArray(permissions)) {
      return false;
    }
    
    return permissions.some(permission => this.hasPermission(permission, user));
  }

  // 检查当前用户权限
  checkCurrentUserPermission(permission) {
    return this.hasPermission(permission);
  }

  // 获取用户权限列表
  getUserPermissions(user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser || !targetUser.permissions) {
      return [];
    }
    
    return [...targetUser.permissions];
  }

  // 获取用户有效权限（包含继承）
  getEffectivePermissions(user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser || !targetUser.permissions) {
      return [];
    }
    
    const effective = new Set(targetUser.permissions);
    
    // 添加继承的权限
    for (const role of targetUser.permissions) {
      if (this.roleHierarchy[role]) {
        this.roleHierarchy[role].forEach(inherited => effective.add(inherited));
      }
    }
    
    return Array.from(effective);
  }

  // 角色检查方法
  isAdmin(user = null) {
    return this.hasPermission(APP_CONSTANTS.PERMISSIONS.ADMIN, user);
  }

  isPremiumUser(user = null) {
    return this.hasPermission(APP_CONSTANTS.PERMISSIONS.PREMIUM, user);
  }

  isRegularUser(user = null) {
    return this.hasPermission(APP_CONSTANTS.PERMISSIONS.USER, user);
  }

  isModerator(user = null) {
    return this.hasPermission(APP_CONSTANTS.PERMISSIONS.MODERATOR, user);
  }

  // 功能权限检查
  canManageSources(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.MANAGE_SOURCES
    ], user);
  }

  canManageUsers(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.MANAGE_USERS
    ], user);
  }

  canShareToComumnity(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.PREMIUM,
      APP_CONSTANTS.PERMISSIONS.SHARE_SOURCES
    ], user);
  }

  canCreateTags(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.PREMIUM,
      APP_CONSTANTS.PERMISSIONS.CREATE_TAGS
    ], user);
  }

  canModerateContent(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.MODERATOR
    ], user);
  }

  // 资源访问权限
  canAccessAdvancedSearch(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.PREMIUM
    ], user);
  }

  canAccessAnalytics(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.VIEW_ANALYTICS
    ], user);
  }

  canExportData(user = null) {
    return this.hasAnyPermission([
      APP_CONSTANTS.PERMISSIONS.ADMIN,
      APP_CONSTANTS.PERMISSIONS.PREMIUM,
      APP_CONSTANTS.PERMISSIONS.EXPORT_DATA
    ], user);
  }

  // 权限验证装饰器
  requirePermission(permission, errorMessage = null) {
    return (target, propertyKey, descriptor) => {
      const originalMethod = descriptor.value;
      
      descriptor.value = function(...args) {
        if (!this.permissionService.hasPermission(permission)) {
          const message = errorMessage || `需要 ${permission} 权限才能执行此操作`;
          throw new Error(message);
        }
        
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  }

  // 验证用户操作
  validateUserAction(action, user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser) {
      return {
        allowed: false,
        reason: '用户未登录'
      };
    }
    
    const actionPermissions = {
      'create_source': [APP_CONSTANTS.PERMISSIONS.PREMIUM, APP_CONSTANTS.PERMISSIONS.ADMIN],
      'share_source': [APP_CONSTANTS.PERMISSIONS.SHARE_SOURCES, APP_CONSTANTS.PERMISSIONS.ADMIN],
      'delete_source': [APP_CONSTANTS.PERMISSIONS.ADMIN],
      'moderate_content': [APP_CONSTANTS.PERMISSIONS.MODERATOR, APP_CONSTANTS.PERMISSIONS.ADMIN],
      'manage_users': [APP_CONSTANTS.PERMISSIONS.MANAGE_USERS, APP_CONSTANTS.PERMISSIONS.ADMIN],
      'view_analytics': [APP_CONSTANTS.PERMISSIONS.VIEW_ANALYTICS, APP_CONSTANTS.PERMISSIONS.ADMIN]
    };
    
    const requiredPermissions = actionPermissions[action];
    
    if (!requiredPermissions) {
      return {
        allowed: false,
        reason: '未知操作'
      };
    }
    
    const hasPermission = this.hasAnyPermission(requiredPermissions, targetUser);
    
    return {
      allowed: hasPermission,
      reason: hasPermission ? null : `需要以下权限之一: ${requiredPermissions.join(', ')}`
    };
  }

  // 权限提示
  getPermissionError(permission) {
    const permissionMessages = {
      [APP_CONSTANTS.PERMISSIONS.ADMIN]: '此操作需要管理员权限',
      [APP_CONSTANTS.PERMISSIONS.PREMIUM]: '此功能仅限高级用户使用',
      [APP_CONSTANTS.PERMISSIONS.MODERATOR]: '此操作需要版主权限',
      [APP_CONSTANTS.PERMISSIONS.MANAGE_SOURCES]: '您没有管理搜索源的权限',
      [APP_CONSTANTS.PERMISSIONS.SHARE_SOURCES]: '您没有分享搜索源的权限',
      [APP_CONSTANTS.PERMISSIONS.CREATE_TAGS]: '您没有创建标签的权限'
    };
    
    return permissionMessages[permission] || `缺少必要权限: ${permission}`;
  }

  // 权限提示方法
  requireAuth(message = '此操作需要登录') {
    if (!this.authService || !this.authService.isAuthenticated()) {
      if (this.authService) {
        return this.authService.requireAuth(message);
      } else {
        console.error('权限服务：认证服务未初始化');
        return false;
      }
    }
    return true;
  }

  // 权限检查并显示错误
  checkPermissionWithError(permission, showError = true) {
    if (!this.requireAuth()) {
      return false;
    }
    
    if (!this.hasPermission(permission)) {
      if (showError) {
        const errorMessage = this.getPermissionError(permission);
        this.showNotification(errorMessage, 'error');
      }
      return false;
    }
    
    return true;
  }

  // 批量权限检查
  checkMultiplePermissions(permissions, requireAll = true) {
    if (!this.requireAuth()) {
      return false;
    }
    
    if (requireAll) {
      return this.hasAllPermissions(permissions);
    } else {
      return this.hasAnyPermission(permissions);
    }
  }

  // 清理权限缓存
  clearPermissionCache() {
    this.permissionCache.clear();
  }

  // 工具方法
  showNotification(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 获取权限统计
  getPermissionStats(user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser) {
      return null;
    }
    
    const permissions = this.getUserPermissions(targetUser);
    const effectivePermissions = this.getEffectivePermissions(targetUser);
    
    return {
      userId: targetUser.id,
      username: targetUser.username,
      directPermissions: permissions,
      effectivePermissions: effectivePermissions,
      roleLevel: this.getUserRoleLevel(targetUser),
      isAdmin: this.isAdmin(targetUser),
      isPremium: this.isPremiumUser(targetUser)
    };
  }

  // 获取用户角色级别
  getUserRoleLevel(user = null) {
    const targetUser = user || this.getCurrentUser();
    
    if (!targetUser) {
      return 0;
    }
    
    if (this.isAdmin(targetUser)) return 3;
    if (this.isPremiumUser(targetUser)) return 2;
    if (this.isRegularUser(targetUser)) return 1;
    
    return 0;
  }

  // 健康检查
  healthCheck() {
    const currentUser = this.getCurrentUser();
    
    return {
      status: 'healthy',
      authServiceConnected: !!this.authService,
      currentUser: currentUser ? {
        id: currentUser.id,
        permissions: this.getUserPermissions(currentUser)
      } : null,
      cacheSize: this.permissionCache.size
    };
  }

  // 销毁服务
  destroy() {
    this.clearPermissionCache();
  }
}
export { PermissionService };
export default PermissionService;