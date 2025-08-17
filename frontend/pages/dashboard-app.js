import { dashboardManager } from '../modules/dashboard/dashboard-manager.js';
import { authManager } from '../modules/auth/auth-manager.js';
import { themeManager } from '../modules/ui/theme-manager.js';
import { performanceMonitor } from '../modules/performance/performance-monitor.js';
import { configManager } from '../modules/core/config.js';
import { isDevEnv } from '../modules/utils/common.js';

/**
 * Dashboard页面应用类
 */
export class DashboardApp {
  constructor() {
    this.isInitialized = false;
  }

  async init() {
    try {
      // 检查开发环境URL修正
      if (this.needsUrlCorrection()) {
        return; // URL修正会导致页面重新加载
      }

      // 初始化性能监控
      if (configManager.getConfig().ENABLE_DEBUG) {
        performanceMonitor.init();
        performanceMonitor.mark('dashboard-init-start');
      }

      // 初始化核心模块
      this.initCoreModules();

      // 初始化Dashboard管理器
      await dashboardManager.init();

      this.isInitialized = true;

      if (performanceMonitor.isInitialized) {
        performanceMonitor.mark('dashboard-init-end');
        const initTime = performanceMonitor.measure('dashboard-init', 'dashboard-init-start', 'dashboard-init-end');
        console.log(`⏱️ Dashboard初始化耗时: ${initTime.toFixed(2)}ms`);
      }

    } catch (error) {
      console.error('❌ Dashboard应用初始化失败:', error);
      throw error;
    }
  }

  needsUrlCorrection() {
    const isDev = isDevEnv();
    
    if (isDev && !window.location.pathname.endsWith('.html')) {
      console.log('开发环境修正URL到 .html 以便文件直开');
      window.location.replace('./dashboard.html' + window.location.search);
      return true;
    }
    
    return false;
  }

  initCoreModules() {
    // 初始化认证管理器
    authManager.init();
    
    // 初始化主题管理器
    themeManager.init();
    
    // 初始化配置管理器
    configManager.init();
  }

  getInitializationStatus() {
    return {
      isInitialized: this.isInitialized,
      dashboardReady: dashboardManager.isInitialized,
      authReady: authManager.isInitialized,
      themeReady: themeManager.isInitialized,
      performanceMonitoring: performanceMonitor.isInitialized
    };
  }
}

// 创建全局实例
export const dashboardApp = new DashboardApp();