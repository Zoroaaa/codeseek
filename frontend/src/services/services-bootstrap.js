// src/services/services-bootstrap.js
// 服务初始化器 - 整合所有服务并设置依赖关系

// Core services
import { serviceRegistry } from './core/service-registry.js';
import { APIClient } from './core/api-client.js';
import { ErrorHandler } from './core/error-handler.js';

// Auth services
import { AuthService } from './auth/auth-service.js';
import { PermissionService } from './auth/permission-service.js';

// User services
import { UserService } from './user/user-service.js';
import { UserSettingsService } from './user/user-settings-service.js';
import { UserFavoritesService } from './user/user-favorites-service.js';
import { UserHistoryService } from './user/user-history-service.js';

// Search services
import { SearchService } from './search/search-service.js';
import { SearchSourcesService } from './search/search-sources-service.js';
import { SourceCheckerService } from './search/source-checker-service.js';

// Community services
import { CommunityService } from './community/community-service.js';
import { CommunitySourcesService } from './community/community-sources-service.js';
import { CommunityTagsService } from './community/community-tags-service.js';

// System services
import { ThemeService } from './system/theme-service.js';
import { NotificationService } from './system/notification-service.js';
import { CacheService } from './system/cache-service.js';

/**
 * 服务初始化器类
 * 负责注册所有服务并管理依赖关系
 */
export class ServicesBootstrap {
  constructor() {
    this.isInitialized = false;
    this.initializationOrder = [];
    this.serviceInstances = new Map();
    this.initializationErrors = [];
  }

  /**
   * 注册所有服务
   */
  registerServices() {
    console.log('开始注册服务...');

    try {
      // 1. Core Services (最基础的服务，无依赖)
      serviceRegistry.register('apiClient', APIClient, []);
      serviceRegistry.register('errorHandler', ErrorHandler, []);
      serviceRegistry.register('cacheService', CacheService, []);
      serviceRegistry.register('notificationService', NotificationService, []);

      // 2. System Services (依赖核心服务)
      serviceRegistry.register('themeService', ThemeService, ['notificationService']);

      // 3. Auth Services (依赖核心服务)
      serviceRegistry.register('authService', AuthService, ['apiClient', 'notificationService']);
      serviceRegistry.register('permissionService', PermissionService, ['authService']);

      // 4. User Services (依赖认证和核心服务)
      serviceRegistry.register('userService', UserService, ['apiClient', 'authService']);
      serviceRegistry.register('userSettingsService', UserSettingsService, ['apiClient', 'authService']);
      serviceRegistry.register('userFavoritesService', UserFavoritesService, ['apiClient', 'authService']);
      serviceRegistry.register('userHistoryService', UserHistoryService, ['apiClient', 'authService']);

      // 5. Search Services (依赖多个服务)
      serviceRegistry.register('sourceCheckerService', SourceCheckerService, ['apiClient', 'notificationService']);
      serviceRegistry.register('searchSourcesService', SearchSourcesService, [
        'apiClient', 'authService', 'userSettingsService', 'notificationService'
      ]);
      serviceRegistry.register('searchService', SearchService, [
        'apiClient', 'authService', 'userSettingsService', 'userHistoryService', 
        'sourceCheckerService', 'searchSourcesService', 'notificationService'
      ]);

      // 6. Community Services (依赖认证和核心服务)
      serviceRegistry.register('communityService', CommunityService, [
        'apiClient', 'authService', 'notificationService'
      ]);
      serviceRegistry.register('communitySourcesService', CommunitySourcesService, [
        'apiClient', 'authService', 'notificationService'
      ]);
      serviceRegistry.register('communityTagsService', CommunityTagsService, [
        'apiClient', 'authService', 'notificationService'
      ]);

      console.log('服务注册完成');
      return true;
    } catch (error) {
      console.error('服务注册失败:', error);
      throw error;
    }
  }

  /**
   * 初始化所有服务
   */
  async initializeServices() {
    try {
      console.log('开始初始化服务...');

      // 注册服务
      this.registerServices();

      // 初始化服务注册器
      serviceRegistry.initialize();

      // 获取所有服务实例（这会触发依赖注入和初始化）
      const serviceNames = [
        // 按依赖顺序初始化
        'apiClient', 'errorHandler', 'cacheService', 'notificationService',
        'themeService', 'authService', 'permissionService',
        'userService', 'userSettingsService', 'userFavoritesService', 'userHistoryService',
        'sourceCheckerService', 'searchSourcesService', 'searchService',
        'communityService', 'communitySourcesService', 'communityTagsService'
      ];

      for (const serviceName of serviceNames) {
        try {
          console.log(`正在初始化服务: ${serviceName}`);
          const service = serviceRegistry.get(serviceName);
          this.serviceInstances.set(serviceName, service);
          this.initializationOrder.push(serviceName);
          console.log(`服务 ${serviceName} 初始化成功`);
        } catch (error) {
          console.error(`服务 ${serviceName} 初始化失败:`, error);
          this.initializationErrors.push({
            serviceName,
            error: error.message,
            timestamp: Date.now()
          });
          
          // 对于关键服务，抛出错误停止初始化
          if (['apiClient', 'authService', 'notificationService'].includes(serviceName)) {
            throw new Error(`关键服务 ${serviceName} 初始化失败: ${error.message}`);
          }
          
          // 对于非关键服务，继续初始化其他服务
          console.warn(`非关键服务 ${serviceName} 初始化失败，继续初始化其他服务`);
        }
      }

      this.isInitialized = true;
      console.log('所有服务初始化完成');

      // 进行健康检查
      await this.performHealthCheck();

      // 如果有错误但不是致命的，记录警告
      if (this.initializationErrors.length > 0) {
        console.warn('服务初始化过程中发现问题:', this.initializationErrors);
      }

      return true;
    } catch (error) {
      console.error('服务初始化失败:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * 获取服务实例
   */
  getService(serviceName) {
    if (!this.isInitialized) {
      throw new Error('服务尚未初始化，请先调用 initializeServices()');
    }

    try {
      return serviceRegistry.get(serviceName);
    } catch (error) {
      console.error(`获取服务 ${serviceName} 失败:`, error);
      return null;
    }
  }

  /**
   * 获取所有服务实例
   */
  getAllServices() {
    if (!this.isInitialized) {
      throw new Error('服务尚未初始化，请先调用 initializeServices()');
    }

    const services = {};
    for (const serviceName of this.initializationOrder) {
      try {
        const service = this.serviceInstances.get(serviceName);
        if (service) {
          services[serviceName] = service;
        }
      } catch (error) {
        console.warn(`获取服务 ${serviceName} 时出错:`, error);
      }
    }
    return services;
  }

  /**
   * 健康检查
   */
  async performHealthCheck() {
    console.log('执行服务健康检查...');

    const healthStatus = await serviceRegistry.checkHealth();
    
    let totalServices = 0;
    let healthyServices = 0;
    const issues = [];

    for (const [serviceName, status] of Object.entries(healthStatus)) {
      totalServices++;
      
      if (status.status === 'healthy') {
        healthyServices++;
      } else {
        issues.push({
          service: serviceName,
          status: status.status,
          error: status.error
        });
      }
    }

    const overallHealth = {
      status: issues.length === 0 ? 'healthy' : 'degraded',
      totalServices,
      healthyServices,
      issues,
      initializationErrors: this.initializationErrors,
      timestamp: Date.now()
    };

    if (issues.length > 0) {
      console.warn('发现服务健康问题:', issues);
    } else {
      console.log(`所有 ${totalServices} 个服务健康状态良好`);
    }

    return overallHealth;
  }

  /**
   * 重新加载服务
   */
  async reloadService(serviceName) {
    try {
      console.log(`重新加载服务: ${serviceName}`);
      
      const reloadedService = serviceRegistry.reload(serviceName);
      this.serviceInstances.set(serviceName, reloadedService);
      
      console.log(`服务 ${serviceName} 重新加载成功`);
      return reloadedService;
    } catch (error) {
      console.error(`服务 ${serviceName} 重新加载失败:`, error);
      throw error;
    }
  }

  /**
   * 获取服务统计信息
   */
  getServicesStatus() {
    return {
      isInitialized: this.isInitialized,
      initializationOrder: this.initializationOrder,
      serviceCount: this.serviceInstances.size,
      initializationErrors: this.initializationErrors,
      registryStatus: serviceRegistry.getServiceStatus(),
      timestamp: Date.now()
    };
  }

  /**
   * 销毁所有服务
   */
  destroy() {
    console.log('开始销毁服务...');

    try {
      // 按相反顺序销毁服务
      const destroyOrder = [...this.initializationOrder].reverse();
      
      for (const serviceName of destroyOrder) {
        try {
          const service = this.serviceInstances.get(serviceName);
          if (service && typeof service.destroy === 'function') {
            service.destroy();
          }
          console.log(`服务 ${serviceName} 销毁成功`);
        } catch (error) {
          console.error(`服务 ${serviceName} 销毁失败:`, error);
        }
      }

      // 销毁服务注册器
      serviceRegistry.destroy();

      // 清理状态
      this.serviceInstances.clear();
      this.initializationOrder = [];
      this.initializationErrors = [];
      this.isInitialized = false;

      console.log('所有服务已销毁');
    } catch (error) {
      console.error('服务销毁过程中出现错误:', error);
    }
  }
}

/**
 * 全局服务管理器实例
 */
export const servicesManager = new ServicesBootstrap();

/**
 * 便捷的初始化函数
 */
export async function initializeApp() {
  try {
    await servicesManager.initializeServices();
    
    // 将服务挂载到全局对象以便于调试和访问
    if (typeof window !== 'undefined') {
      window.services = servicesManager.getAllServices();
      window.servicesManager = servicesManager;
    }
    
    return servicesManager;
  } catch (error) {
    console.error('应用初始化失败:', error);
    throw error;
  }
}

/**
 * 便捷的服务获取函数
 */
export function getService(serviceName) {
  return servicesManager.getService(serviceName);
}

/**
 * 便捷的多服务获取函数
 */
export function getServices(...serviceNames) {
  const services = {};
  for (const serviceName of serviceNames) {
    try {
      services[serviceName] = servicesManager.getService(serviceName);
    } catch (error) {
      console.warn(`获取服务 ${serviceName} 失败:`, error);
      services[serviceName] = null;
    }
  }
  return services;
}

/**
 * 应用关闭清理函数
 */
export function shutdownApp() {
  servicesManager.destroy();
}

// 页面卸载时自动清理
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    shutdownApp();
  });
}

export default servicesManager;