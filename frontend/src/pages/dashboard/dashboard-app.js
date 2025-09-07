// Dashboard主应用 - 重构版本，使用新的服务架构
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';

// 🆕 导入服务引导器
import { initializeApp, getService, getServices } from '../../services/services-bootstrap.js';

// 导入页面管理器
import OverviewManager from './overview-manager.js';
import FavoritesManager from './favorites-manager.js';
import HistoryManager from './history-manager.js';
import SourcesManager from './sources-manager.js';
import CategoriesManager from './categories-manager.js';
import SettingsManager from './settings-manager.js';
import StatsManager from './stats-manager.js';
import { CommunityManager } from './community-manager.js';

export class DashboardApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.isInitialized = false;
    this.servicesReady = false;
    this.initializationPromise = null; // 🔧 添加初始化Promise追踪
    
    // 🔧 安全地初始化页面管理器
    this.managers = {};
    this.initializeManagers();
    
    // 🔧 自动启动初始化，但不阻塞构造函数
    this.initializationPromise = this.init();
  }

  // 🔧 新增：安全地初始化管理器
  initializeManagers() {
    const managerConfigs = [
      { name: 'overview', class: OverviewManager },
      { name: 'favorites', class: FavoritesManager },
      { name: 'history', class: HistoryManager },
      { name: 'sources', class: SourcesManager },
      { name: 'categories', class: CategoriesManager },
      { name: 'community', class: CommunityManager },
      { name: 'settings', class: SettingsManager },
      { name: 'stats', class: StatsManager }
    ];

    for (const config of managerConfigs) {
      try {
        if (config.class && typeof config.class === 'function') {
          this.managers[config.name] = new config.class(this);
          console.log(`✅ ${config.name} 管理器创建成功`);
        } else {
          console.warn(`⚠️ ${config.name} 管理器类不存在，创建占位符`);
          this.managers[config.name] = this.createPlaceholderManager(config.name);
        }
      } catch (error) {
        console.error(`❌ 创建 ${config.name} 管理器失败:`, error);
        this.managers[config.name] = this.createPlaceholderManager(config.name);
      }
    }
  }

  // 🔧 新增：创建占位符管理器
  createPlaceholderManager(name) {
    return {
      name: name,
      isPlaceholder: true,
      init: async () => {
        console.log(`占位符管理器 ${name} 初始化（无操作）`);
        return true;
      },
      loadData: async () => {
        console.log(`占位符管理器 ${name} 加载数据（无操作）`);
        return true;
      },
      loadTabData: async () => {
        console.log(`占位符管理器 ${name} 加载标签数据（无操作）`);
        return true;
      }
    };
  }

  async init() {
    try {
      const isDev = isDevEnv();
      if (isDev && !window.location.pathname.endsWith('.html')) {
        console.log('开发环境修正URL到 .html 以便文件直开');
        window.location.replace('./dashboard.html' + window.location.search);
        return;
      }
      
      showLoading(true);
      
      // 🔧 先初始化配置
      console.log('开始初始化配置...');
      if (window.configManager) {
        await window.configManager.init();
        console.log('配置初始化完成');
      }
      
      // 🆕 初始化服务架构
      console.log('开始初始化服务架构...');
      await initializeApp();
      this.servicesReady = true;
      console.log('服务架构初始化完成');
      
      // 🆕 获取核心服务
      const { authService, themeService } = getServices('authService', 'themeService');
      
      // 🔧 验证关键服务是否可用
      if (!authService) {
        throw new Error('认证服务未正确初始化');
      }
      
      await this.checkAuth();
      this.bindEvents();
      await this.loadCloudData();
      
      // 初始化所有页面管理器
      for (const [name, manager] of Object.entries(this.managers)) {
        if (manager.init) {
          try {
            await manager.init();
            console.log(`✅ ${name} 管理器初始化成功`);
          } catch (error) {
            console.error(`❌ ${name} 管理器初始化失败:`, error);
            // 不抛出错误，允许其他管理器继续初始化
          }
        }
      }
      
      // 🆕 初始化主题服务
      if (themeService) {
        themeService.init();
      }
      
      this.isInitialized = true;
      console.log('Dashboard初始化完成');
      
      return true;
      
    } catch (error) {
      console.error('Dashboard初始化失败:', error);
      
      // 🔧 更友好的错误处理
      let errorMessage = '初始化失败，请重新登录';
      
      if (error.message.includes('服务')) {
        errorMessage = '服务连接失败，请检查网络后重试';
      } else if (error.message.includes('认证')) {
        errorMessage = '登录状态已过期，请重新登录';
      }
      
      showToast(errorMessage, 'error');
      
      // 🔧 延迟跳转，给用户看到错误信息的时间
      setTimeout(() => {
        window.location.replace('./index.html');
      }, 2000);
      
      throw error; // 重新抛出错误以便调用者处理
      
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：等待初始化完成的方法
  async waitForInitialization() {
    if (this.initializationPromise) {
      try {
        await this.initializationPromise;
        return true;
      } catch (error) {
        console.error('等待初始化完成时发生错误:', error);
        return false;
      }
    }
    return this.isInitialized;
  }

  // 🔧 改进：检查认证状态 - 使用新的认证服务
  async checkAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('未找到认证token');
    }

    try {
      // 🔧 增加服务可用性检查
      const authService = getService('authService');
      if (!authService) {
        throw new Error('认证服务不可用');
      }
      
      const result = await authService.verifyToken();
      
      if (!result.success || !result.user) {
        throw new Error('Token验证失败');
      }
      
      this.currentUser = result.user;
      this.updateUserUI();
    } catch (error) {
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      throw new Error(`认证失败: ${error.message}`);
    }
  }

  // 🔧 改进：加载云端数据 - 使用新的用户服务
  async loadCloudData() {
    if (!this.currentUser) {
      console.log('用户未登录，无法加载数据');
      return;
    }

    try {
      // 让各个管理器自己加载数据
      const loadPromises = Object.entries(this.managers).map(([name, manager]) => {
        if (manager.loadData) {
          return manager.loadData().catch(error => {
            console.error(`${name} 管理器加载数据失败:`, error);
            // 不抛出错误，允许其他管理器继续加载
          });
        }
        return Promise.resolve();
      });

      await Promise.allSettled(loadPromises);
      await this.loadTabData(this.currentTab);

    } catch (error) {
      console.error('加载云端数据失败:', error);
      showToast('数据加载失败', 'error');
    }
  }

  // 绑定事件
  bindEvents() {
    // 标签切换
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });

    // 🆕 退出登录 - 使用新的认证服务
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    this.bindModalEvents();
  }

  bindModalEvents() {
    const closeBtns = document.querySelectorAll('.close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModals();
      }
    });
  }

  switchTab(tabName) {
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });

    this.currentTab = tabName;
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    const manager = this.managers[tabName];
    if (manager && manager.loadTabData) {
      try {
        await manager.loadTabData();
      } catch (error) {
        console.error(`加载 ${tabName} 页面数据失败:`, error);
        showToast(`加载 ${tabName} 数据失败`, 'error');
      }
    }
  }

  updateUserUI() {
    const username = document.getElementById('username');
    if (username && this.currentUser) {
      username.textContent = this.currentUser.username;
    }
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    Object.values(this.managers).forEach(manager => {
      if (manager.resetEditingState) {
        manager.resetEditingState();
      }
    });
  }

  // 🔧 改进：退出登录 - 使用新的认证服务
  async logout() {
    if (confirm('确定要退出登录吗？')) {
      try {
        const authService = getService('authService');
        if (authService) {
          await authService.logout();
        }
        showToast('已退出登录', 'success');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1000);
      } catch (error) {
        console.error('退出登录失败:', error);
        localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
        window.location.href = 'index.html';
      }
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  // 🔧 改进：状态检查方法
  isReady() {
    return this.isInitialized && this.servicesReady;
  }

  getManager(name) {
    return this.managers[name];
  }

  // 🆕 获取服务的便捷方法
  getService(serviceName) {
    if (!this.servicesReady) {
      console.warn('服务尚未就绪，请等待初始化完成');
      return null;
    }
    try {
      return getService(serviceName);
    } catch (error) {
      console.error(`获取服务 ${serviceName} 失败:`, error);
      return null;
    }
  }

  // 委托给设置管理器的方法
  async saveSettings() {
    return this.delegateToManager('settings', 'saveSettings');
  }

  async changePassword() {
    return this.delegateToManager('settings', 'changePassword');
  }

  async clearAllData() {
    return this.delegateToManager('settings', 'clearAllData');
  }

  async deleteAccount() {
    return this.delegateToManager('settings', 'deleteAccount');
  }

  async exportData() {
    return this.delegateToManager('settings', 'exportData');
  }

  async syncFavorites() {
    return this.delegateToManager('favorites', 'syncFavorites');
  }

  async exportFavorites() {
    return this.delegateToManager('favorites', 'exportFavorites');
  }

  async searchFavorites() {
    const favoritesManager = this.managers.favorites;
    if (favoritesManager && favoritesManager.searchFavorites) {
      return favoritesManager.searchFavorites();
    }
  }

  async syncHistory() {
    return this.delegateToManager('history', 'syncHistory');
  }

  async clearAllHistory() {
    return this.delegateToManager('history', 'clearAllHistory');
  }

  async exportSources() {
    return this.delegateToManager('sources', 'exportSources');
  }

  async enableAllSources() {
    return this.delegateToManager('sources', 'enableAllSources');
  }

  async disableAllSources() {
    return this.delegateToManager('sources', 'disableAllSources');
  }

  async resetToDefaults() {
    return this.delegateToManager('sources', 'resetToDefaults');
  }

  async exportCategories() {
    return this.delegateToManager('categories', 'exportCategories');
  }

  async resetSettings() {
    return this.delegateToManager('settings', 'resetSettings');
  }

  // 🔧 新增：统一的管理器方法委托
  async delegateToManager(managerName, methodName, ...args) {
    const manager = this.managers[managerName];
    if (manager && manager[methodName]) {
      try {
        return await manager[methodName](...args);
      } catch (error) {
        console.error(`${managerName} 管理器的 ${methodName} 方法执行失败:`, error);
        showToast(`操作失败: ${error.message}`, 'error');
      }
    } else {
      console.error(`${managerName} 管理器未找到或 ${methodName} 方法不存在`);
      showToast(`${managerName} 管理器未初始化`, 'error');
    }
  }
}

export default DashboardApp;