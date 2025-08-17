import { authManager } from '../auth/auth-manager.js';
import { favoritesManager } from '../favorites/favorites-manager.js';
import { searchManager } from '../search/search-manager.js';
import { apiClient } from '../api/api-client.js';
import { modal } from '../ui/modal.js';
import { toast } from '../utils/toast.js';
import { loading } from '../ui/loading.js';
import { themeManager } from '../ui/theme-manager.js';
import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { debounce } from '../utils/common.js';
import { ArrayUtils } from '../utils/array.js';
import { DateUtils } from '../utils/date.js';

/**
 * Dashboard管理器
 */
export class DashboardManager {
  constructor() {
    this.currentUser = null;
    this.currentTab = 'overview';
    this.isInitialized = false;
    this.tabData = new Map();
  }

  async init() {
    try {
      loading.show();
      console.log('🚀 初始化Dashboard应用...');
      
      // 检查认证状态
      await this.checkAuth();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 加载云端数据
      await this.loadCloudData();
      
      this.isInitialized = true;
      console.log('✅ Dashboard初始化完成');
      
    } catch (error) {
      console.error('❌ Dashboard初始化失败:', error);
      toast.error('初始化失败，请重新登录');
      
      setTimeout(() => {
        window.location.replace('./index.html');
      }, 2000);
    } finally {
      loading.hide();
    }
  }

  async checkAuth() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    if (!token) {
      throw new Error('未找到认证token');
    }

    try {
      const result = await apiClient.verifyToken(token);
      if (!result.success || !result.user) {
        throw new Error('Token验证失败');
      }
      
      this.currentUser = result.user;
      authManager.setAuth(result.user, token);
      this.updateUserUI();
    } catch (error) {
      localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      throw new Error('认证失败');
    }
  }

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

    // 设置表单事件
    this.bindSettingsEvents();

    // 数据操作按钮
    this.bindDataOperations();

    // 收藏夹搜索和排序
    this.bindFavoritesControls();

    // 主题切换
    document.addEventListener(EVENT_NAMES.THEME_CHANGED, () => {
      console.log('Dashboard检测到主题变化');
    });
  }

  bindModalEvents() {
    const passwordModal = document.getElementById('passwordModal');
    const closeBtns = document.querySelectorAll('.close');
    const passwordForm = document.getElementById('passwordForm');

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => modal.closeAll());
    });

    if (passwordModal) {
      passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) modal.closeAll();
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }
  }

  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
      });
    });

    // 按钮事件
    const buttons = {
      changePasswordBtn: () => this.changePassword(),
      saveSettingsBtn: () => this.saveSettings(),
      resetSettingsBtn: () => this.resetSettings()
    };

    Object.entries(buttons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  bindDataOperations() {
    const operations = {
      syncAllDataBtn: () => this.syncAllData(),
      exportDataBtn: () => this.exportData(),
      exportFavoritesBtn: () => this.exportFavorites(),
      clearAllHistoryBtn: () => this.clearAllHistory(),
      clearAllDataBtn: () => this.clearAllData(),
      deleteAccountBtn: () => this.deleteAccount()
    };

    Object.entries(operations).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  bindFavoritesControls() {
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');
    
    if (favoritesSearch) {
      const debouncedSearch = debounce(() => this.searchFavorites(), APP_CONSTANTS.UI.DEBOUNCE_DELAY);
      favoritesSearch.addEventListener('input', debouncedSearch);
      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchFavorites();
      });
    }
    
    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => this.searchFavorites());
    }
  }

  async loadCloudData() {
    if (!this.currentUser) {
      console.log('用户未登录，无法加载数据');
      return;
    }

    try {
      // 并行加载数据
      const [favoritesResult, historyResult] = await Promise.allSettled([
        favoritesManager.loadFavorites(),
        searchManager.loadSearchHistory()
      ]);

      if (favoritesResult.status === 'rejected') {
        console.error('加载收藏夹失败:', favoritesResult.reason);
      }

      if (historyResult.status === 'rejected') {
        console.error('加载搜索历史失败:', historyResult.reason);
      }

      // 加载当前标签页数据
      await this.loadTabData(this.currentTab);

    } catch (error) {
      console.error('加载云端数据失败:', error);
      toast.error('数据加载失败');
    }
  }

  switchTab(tabName) {
    // 更新菜单状态
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // 更新内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === tabName);
    });

    this.currentTab = tabName;
    this.loadTabData(tabName);
  }

  async loadTabData(tabName) {
    switch (tabName) {
      case 'overview':
        await this.loadOverviewData();
        break;
      case 'favorites':
        await this.loadFavoritesData();
        break;
      case 'history':
        await this.loadHistoryData();
        break;
      case 'settings':
        await this.loadSettingsData();
        break;
      case 'stats':
        await this.loadStatsData();
        break;
    }
  }

  async loadOverviewData() {
    try {
      const [searchStats] = await Promise.allSettled([
        apiClient.getSearchStats()
      ]);
      
      const stats = searchStats.status === 'fulfilled' ? searchStats.value : {
        total: searchManager.searchHistory.length,
        today: 0,
        thisWeek: 0,
        topQueries: []
      };
      
      // 更新UI
      this.updateElement('totalSearches', stats.total || 0);
      this.updateElement('totalFavorites', favoritesManager.getFavorites().length);
      this.updateElement('activeDays', this.calculateActiveDays());
      this.updateElement('userLevel', this.calculateUserLevel());

      await this.loadRecentActivity();

    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  async loadFavoritesData() {
    favoritesManager.renderFavorites();
  }

  async loadHistoryData() {
    const history = searchManager.searchHistory;
    
    this.updateElement('historyCount', history.length);
    this.updateElement('uniqueKeywords', new Set(history.map(h => h.keyword)).size);
    this.updateElement('avgPerDay', Math.round(history.length / (this.calculateActiveDays() || 1)));

    this.renderHistoryList(history);
  }

  async loadSettingsData() {
    try {
      const settings = await apiClient.getUserSettings();
      
      this.updateSettingElement('autoSync', settings.autoSync !== false);
      this.updateSettingElement('enableCache', settings.cacheResults !== false);
      this.updateSettingElement('themeMode', settings.theme || 'auto');
      this.updateSettingElement('maxFavorites', settings.maxFavoritesPerUser ?? 500);

    } catch (error) {
      console.error('加载设置失败:', error);
      toast.error('加载设置失败');
    }
  }

  async loadStatsData() {
    console.log('加载统计数据');
    // TODO: 实现统计数据加载
  }

  async loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const favorites = favoritesManager.getFavorites();
    const history = searchManager.searchHistory;

    const activities = [
      ...history.slice(0, 5).map(h => ({
        type: 'search',
        content: `搜索了 "${h.keyword}"`,
        time: h.timestamp,
        icon: '🔍'
      })),
      ...favorites.slice(0, 5).map(f => ({
        type: 'favorite',
        content: `收藏了 "${f.title}"`,
        time: new Date(f.addedAt).getTime(),
        icon: '⭐'
      }))
    ].sort((a, b) => b.time - a.time).slice(0, 10);

    if (activities.length === 0) {
      activityList.innerHTML = '<p class="empty-state">暂无活动记录</p>';
      return;
    }

    activityList.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <span class="activity-icon">${activity.icon}</span>
        <div class="activity-content">
          <div class="activity-text">${this.escapeHtml(activity.content)}</div>
          <div class="activity-time">${DateUtils.formatRelativeTime(activity.time)}</div>
        </div>
      </div>
    `).join('');
  }

  renderHistoryList(history) {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (history.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🕐</span>
          <p>暂无搜索历史</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = history.slice(0, 50).map(item => `
      <div class="history-item">
        <div class="history-content">
          <div class="history-keyword">${this.escapeHtml(item.keyword)}</div>
          <div class="history-time">${DateUtils.formatRelativeTime(item.timestamp)}</div>
        </div>
        <div class="history-actions">
          <button class="action-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
            重新搜索
          </button>
        </div>
      </div>
    `).join('');
  }

  searchFavorites() {
    favoritesManager.filterAndSort();
  }

  async changePassword() {
    modal.showPasswordChange();
  }

  async handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有字段');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('新密码确认不一致');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('新密码至少6个字符');
      return;
    }

    const result = await authManager.changePassword(currentPassword, newPassword);
    
    if (result.success) {
      modal.closeAll();
      document.getElementById('passwordForm').reset();
    }
  }

  async saveSettings() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      loading.show();
      const settings = this.collectSettings();
      const payload = {
        theme: settings.themeMode,
        autoSync: !!settings.autoSync,
        cacheResults: !!settings.enableCache,
        maxFavoritesPerUser: parseInt(settings.maxFavorites, 10),
        maxHistoryPerUser: settings.historyRetention === '-1' ? 999999 : parseInt(settings.historyRetention, 10)
      };
      
      await apiClient.updateUserSettings(payload);
      toast.success('设置保存成功');
      this.markSettingsSaved();
    } catch (error) {
      console.error('保存设置失败:', error);
      toast.error('保存设置失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    const defaultSettings = {
      autoSync: true,
      enableCache: true,
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true
    };

    Object.entries(defaultSettings).forEach(([key, value]) => {
      this.updateSettingElement(key, value);
    });

    this.markSettingsChanged();
    toast.success('设置已重置为默认值，请点击保存');
  }

  async syncAllData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      loading.show();
      toast.info('正在同步数据...');
      
      await favoritesManager.syncFavorites();
      await this.loadCloudData();
      
      toast.success('数据同步成功');
    } catch (error) {
      console.error('数据同步失败:', error);
      toast.error('同步失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async exportData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    try {
      const [favorites, history, settings] = await Promise.all([
        apiClient.getFavorites(),
        apiClient.getSearchHistory(),
        apiClient.getUserSettings()
      ]);

      const data = {
        favorites: favorites || favoritesManager.getFavorites(),
        searchHistory: history || searchManager.searchHistory,
        settings: settings || this.collectSettings(),
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
      };

      this.downloadJSON(data, `magnet-search-data-${new Date().toISOString().split('T')[0]}.json`);
      toast.success('数据导出成功');
    } catch (error) {
      console.error('导出数据失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  async exportFavorites() {
    await favoritesManager.exportFavorites();
  }

  async clearAllHistory() {
    await searchManager.clearHistory();
    await this.loadHistoryData();
  }

  async clearAllData() {
    if (!this.currentUser) {
      toast.error('用户未登录');
      return;
    }

    if (!confirm('确定要清空所有数据吗？此操作不可恢复，建议先导出数据备份。')) return;
    if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

    try {
      loading.show();
      
      await Promise.all([
        apiClient.clearAllSearchHistory(),
        apiClient.syncFavorites([])
      ]);
      
      favoritesManager.setFavorites([]);
      searchManager.setSearchHistory([]);
      
      await this.loadCloudData();
      
      toast.success('所有数据已清空');
    } catch (error) {
      console.error('清空数据失败:', error);
      toast.error('清空失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async deleteAccount() {
    const confirmText = '我确定要删除账户';
    const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
    
    if (userInput !== confirmText) {
      toast.info('确认文本不匹配，取消删除');
      return;
    }

    const result = await authManager.deleteAccount();
    
    if (result.success) {
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);
    }
  }

  async logout() {
    if (confirm('确定要退出登录吗？')) {
      await authManager.logout();
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    }
  }

  // 工具方法
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  updateSettingElement(id, value) {
    const element = document.getElementById(id);
    if (!element) return;
    
    if (element.type === 'checkbox') {
      element.checked = value;
    } else {
      element.value = value;
    }
  }

  collectSettings() {
    const settings = {};
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    
    settingInputs.forEach(input => {
      if (input.type === 'checkbox') {
        settings[input.id] = input.checked;
      } else {
        settings[input.id] = input.value;
      }
    });
    
    return settings;
  }

  markSettingsChanged() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置*';
      saveBtn.classList.add('changed');
    }
  }

  markSettingsSaved() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置';
      saveBtn.classList.remove('changed');
    }
  }

  calculateActiveDays() {
    const history = searchManager.searchHistory;
    if (history.length === 0) return 0;
    
    const dates = new Set(
      history.map(h => new Date(h.timestamp).toDateString())
    );
    return dates.size;
  }

  calculateUserLevel() {
    const totalActions = searchManager.searchHistory.length + favoritesManager.getFavorites().length;
    
    if (totalActions < 10) return '新手';
    if (totalActions < 50) return '熟练';
    if (totalActions < 200) return '专业';
    if (totalActions < 500) return '专家';
    return '大师';
  }

  updateUserUI() {
    const username = document.getElementById('username');
    if (username && this.currentUser) {
      username.textContent = this.currentUser.username;
    }
  }

  downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}

// 创建全局实例
export const dashboardManager = new DashboardManager();