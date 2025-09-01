// Dashboard主应用 - 重构版本，负责总体协调
import { APP_CONSTANTS } from '../../core/constants.js';
import configManager from '../../core/config.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';
import authManager from '../../services/auth.js';
import themeManager from '../../services/theme.js';
import apiService from '../../services/api.js';

// 导入页面管理器
import OverviewManager from './overview-manager.js';
import FavoritesManager from './favorites-manager.js';
import HistoryManager from './history-manager.js';
import SourcesManager from './sources-manager.js';
import CategoriesManager from './categories-manager.js';
import SettingsManager from './settings-manager.js';
import StatsManager from './stats-manager.js';

export class DashboardApp {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.isInitialized = false;
    
    // 初始化页面管理器
    this.managers = {
      overview: new OverviewManager(this),
      favorites: new FavoritesManager(this),
      history: new HistoryManager(this),
      sources: new SourcesManager(this),
      categories: new CategoriesManager(this),
      settings: new SettingsManager(this),
      stats: new StatsManager(this)
    };
    
    this.init();
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
      
      await configManager.init();
      await this.checkAuth();
      
      this.bindEvents();
      await this.loadCloudData();
      
      // 初始化所有页面管理器
      for (const manager of Object.values(this.managers)) {
        if (manager.init) {
          await manager.init();
        }
      }
      
      themeManager.init();
      
      this.isInitialized = true;
      console.log('✅ Dashboard初始化完成');
      
    } catch (error) {
      console.error('❌ Dashboard初始化失败:', error);
      showToast('初始化失败，请重新登录', 'error');
      
      setTimeout(() => {
        window.location.replace('./index.html');
      }, 2000);
    } finally {
      showLoading(false);
    }
  }

  // 检查认证状态
  async checkAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('未找到认证token');
    }

    try {
      const result = await apiService.verifyToken(token);
      if (!result.success || !result.user) {
        throw new Error('Token验证失败');
      }
      
      this.currentUser = result.user;
      this.updateUserUI();
    } catch (error) {
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      throw new Error('认证失败');
    }
  }

  // 加载云端数据
  async loadCloudData() {
    if (!this.currentUser) {
      console.log('用户未登录，无法加载数据');
      return;
    }

    try {
      // 让各个管理器自己加载数据
      const loadPromises = Object.values(this.managers).map(manager => {
        if (manager.loadData) {
          return manager.loadData().catch(error => {
            console.error(`${manager.constructor.name} 加载数据失败:`, error);
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

    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // 模态框事件
    this.bindModalEvents();
  }

  // 绑定模态框事件
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

  // 切换标签
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

  // 加载标签数据
  async loadTabData(tabName) {
    const manager = this.managers[tabName];
    if (manager && manager.loadTabData) {
      await manager.loadTabData();
    }
  }

  // 更新用户UI
  updateUserUI() {
    const username = document.getElementById('username');
    if (username && this.currentUser) {
      username.textContent = this.currentUser.username;
    }
  }

  // 关闭模态框
  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
    });
    
    // 通知所有管理器重置编辑状态
    Object.values(this.managers).forEach(manager => {
      if (manager.resetEditingState) {
        manager.resetEditingState();
      }
    });
  }

  // 退出登录
  async logout() {
    if (confirm('确定要退出登录吗？')) {
      try {
        await apiService.logout();
        localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
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

  // 获取当前用户
  getCurrentUser() {
    return this.currentUser;
  }

  // 检查是否已初始化
  isReady() {
    return this.isInitialized;
  }

  // 获取指定管理器
  getManager(name) {
    return this.managers[name];
  }

  // ============ 修复：添加委托方法 ============
  
  // 委托给设置管理器的方法
  async saveSettings() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.saveSettings) {
      return await settingsManager.saveSettings();
    } else {
      console.error('设置管理器未找到或saveSettings方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }

  async changePassword() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.changePassword) {
      return settingsManager.changePassword();
    } else {
      console.error('设置管理器未找到或changePassword方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }

  async clearAllData() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.clearAllData) {
      return await settingsManager.clearAllData();
    } else {
      console.error('设置管理器未找到或clearAllData方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }

  async deleteAccount() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.deleteAccount) {
      return await settingsManager.deleteAccount();
    } else {
      console.error('设置管理器未找到或deleteAccount方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }

  async exportData() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.exportData) {
      return await settingsManager.exportData();
    } else {
      console.error('设置管理器未找到或exportData方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }

  async syncFavorites() {
    const favoritesManager = this.managers.favorites;
    if (favoritesManager && favoritesManager.syncFavorites) {
      return await favoritesManager.syncFavorites();
    } else {
      console.error('收藏管理器未找到或syncFavorites方法不存在');
      showToast('收藏管理器未初始化', 'error');
    }
  }

  async exportFavorites() {
    const favoritesManager = this.managers.favorites;
    if (favoritesManager && favoritesManager.exportFavorites) {
      return await favoritesManager.exportFavorites();
    } else {
      console.error('收藏管理器未找到或exportFavorites方法不存在');
      showToast('收藏管理器未初始化', 'error');
    }
  }

  async searchFavorites() {
    const favoritesManager = this.managers.favorites;
    if (favoritesManager && favoritesManager.searchFavorites) {
      return favoritesManager.searchFavorites();
    } else {
      console.error('收藏管理器未找到或searchFavorites方法不存在');
    }
  }

  async syncHistory() {
    const historyManager = this.managers.history;
    if (historyManager && historyManager.syncHistory) {
      return await historyManager.syncHistory();
    } else {
      console.error('历史管理器未找到或syncHistory方法不存在');
      showToast('历史管理器未初始化', 'error');
    }
  }

  async clearAllHistory() {
    const historyManager = this.managers.history;
    if (historyManager && historyManager.clearAllHistory) {
      return await historyManager.clearAllHistory();
    } else {
      console.error('历史管理器未找到或clearAllHistory方法不存在');
      showToast('历史管理器未初始化', 'error');
    }
  }

  async exportSources() {
    const sourcesManager = this.managers.sources;
    if (sourcesManager && sourcesManager.exportSources) {
      return await sourcesManager.exportSources();
    } else {
      console.error('搜索源管理器未找到或exportSources方法不存在');
      showToast('搜索源管理器未初始化', 'error');
    }
  }

  async enableAllSources() {
    const sourcesManager = this.managers.sources;
    if (sourcesManager && sourcesManager.enableAllSources) {
      return sourcesManager.enableAllSources();
    } else {
      console.error('搜索源管理器未找到或enableAllSources方法不存在');
      showToast('搜索源管理器未初始化', 'error');
    }
  }

  async disableAllSources() {
    const sourcesManager = this.managers.sources;
    if (sourcesManager && sourcesManager.disableAllSources) {
      return sourcesManager.disableAllSources();
    } else {
      console.error('搜索源管理器未找到或disableAllSources方法不存在');
      showToast('搜索源管理器未初始化', 'error');
    }
  }

  async resetToDefaults() {
    const sourcesManager = this.managers.sources;
    if (sourcesManager && sourcesManager.resetToDefaults) {
      return sourcesManager.resetToDefaults();
    } else {
      console.error('搜索源管理器未找到或resetToDefaults方法不存在');
      showToast('搜索源管理器未初始化', 'error');
    }
  }

  async exportCategories() {
    const categoriesManager = this.managers.categories;
    if (categoriesManager && categoriesManager.exportCategories) {
      return await categoriesManager.exportCategories();
    } else {
      console.error('分类管理器未找到或exportCategories方法不存在');
      showToast('分类管理器未初始化', 'error');
    }
  }

  // 重置设置
  async resetSettings() {
    const settingsManager = this.managers.settings;
    if (settingsManager && settingsManager.resetSettings) {
      return settingsManager.resetSettings();
    } else {
      console.error('设置管理器未找到或resetSettings方法不存在');
      showToast('设置管理器未初始化', 'error');
    }
  }
}

export default DashboardApp;