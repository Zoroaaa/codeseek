// 应用主入口文件
import { errorHandler } from './shared/error-handler.js';
import { configManager } from './modules/core/config.js';
import { indexApp } from './pages/index-app.js';
import { dashboardApp } from './pages/dashboard-app.js';

/**
 * 应用初始化管理器
 */
class AppInitializer {
  constructor() {
    this.initialized = false;
    this.initStartTime = null;
  }

  async init() {
    if (this.initialized) return;

    this.initStartTime = performance.now();
    console.log('🚀 应用初始化开始（纯云端模式）');

    try {
      // 初始化错误处理
      errorHandler.init();

      // 初始化配置
      configManager.init();

      // 检查版本更新
      this.checkVersion();

      // 根据当前页面初始化对应的应用
      await this.initPageApp();

      // 初始化完成
      this.initialized = true;
      const initTime = performance.now() - this.initStartTime;
      console.log(`✅ 应用初始化完成 (${initTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      errorHandler.handleError('App Initialization Error', error);
      throw error;
    }
  }

  async initPageApp() {
    const currentPage = this.getCurrentPage();
    
    console.log(`📄 初始化${currentPage}页面应用`);
    
    switch (currentPage) {
      case 'dashboard':
        // 设置全局引用
        window.dashboardApp = dashboardApp;
        window.app = dashboardApp.dashboardManager || dashboardApp;
        
        await dashboardApp.init();
        break;
        
      case 'index':
      default:
        // 设置全局引用
        window.indexApp = indexApp;
        window.app = indexApp;
        
        await indexApp.init();
		console.log('[Init] IndexApp初始化完成');
        break;
    }
  }

  getCurrentPage() {
    const pathname = window.location.pathname;
    
    if (pathname.includes('dashboard')) {
      return 'dashboard';
    } else if (pathname.includes('index') || pathname === '/' || pathname === '') {
      return 'index';
    }
    
    return 'index'; // 默认为首页
  }

  checkVersion() {
    const config = configManager.getConfig();
    const currentVersion = config.APP_VERSION;
    const storedVersion = localStorage.getItem('app_version');
    
    if (!storedVersion || storedVersion !== currentVersion) {
      console.log(`📦 应用版本更新: ${storedVersion} -> ${currentVersion}`);
      
      // 清理旧版本数据
      this.cleanupLegacyData();
      
      // 更新版本号
      localStorage.setItem('app_version', currentVersion);
      
      // 显示更新提示
      if (storedVersion && window.toast) {
        window.toast.success(`应用已更新到版本 ${currentVersion}`);
      }
    }
  }

  cleanupLegacyData() {
    // 清理旧版本的业务数据，保留系统设置
    const keysToRemove = [
      'search_history', 'favorites', 'user_settings', 
      'search_cache_', 'temp_', 'cache'
    ];
    
    const allKeys = Object.keys(localStorage);
    let removedCount = 0;
    
    allKeys.forEach(key => {
      const shouldRemove = keysToRemove.some(pattern => 
        key.startsWith(pattern) || key.includes(pattern)
      );
      
      if (shouldRemove) {
        try {
          localStorage.removeItem(key);
          removedCount++;
        } catch (error) {
          console.error(`清理数据失败 ${key}:`, error);
        }
      }
    });
    
    if (removedCount > 0) {
      console.log(`🧹 清理了 ${removedCount} 个旧版本数据项`);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      initTime: this.initStartTime ? performance.now() - this.initStartTime : null,
      currentPage: this.getCurrentPage(),
      config: configManager.getConfig()
    };
  }
}

// 创建全局初始化器
const appInitializer = new AppInitializer();
window.appInitializer = appInitializer;

// DOM加载完成后自动初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await appInitializer.init();
    console.log('🎯 应用核心初始化完成，等待具体模块初始化...');
  } catch (error) {
    console.error('💥 应用初始化失败:', error);
    
    // 显示错误提示
    if (window.toast) {
      window.toast.error('应用初始化失败，请刷新页面重试', 5000);
    } else {
      alert('应用初始化失败，请刷新页面重试');
    }
  }
});

// 处理页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.app) {
    setTimeout(() => {
      if (window.app.checkConnectionStatus) {
        window.app.checkConnectionStatus();
      }
    }, 100);
  }
});

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  if (window.app && appInitializer.initialized) {
    errorHandler.handleError('Global Error', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
    if (window.app && window.app.logout) {
      window.app.logout();
    }
  }
  errorHandler.handleError('Unhandled Promise Rejection', event.reason);
});

// 导出到全局作用域（向后兼容）
window.AppInitializer = AppInitializer;

console.log('✅ 纯云端模式工具库已加载');