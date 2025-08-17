// Dashboard应用逻辑
import { APP_CONSTANTS } from '../core/constants.js';
import configManager from '../core/config.js';
import { showLoading, showToast } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { isDevEnv, debounce } from '../utils/helpers.js'; // 🔧 添加debounce导入
import authManager from '../services/auth.js';
import themeManager from '../services/theme.js';
import apiService from '../services/api.js';

export class DashboardApp {
  constructor() {
    this.currentUser = null;
    this.favorites = [];
    this.searchHistory = [];
    this.currentTab = 'overview';
    this.isInitialized = false;
    this.init();
  }

  async init() {
    try {
      // 开发环境URL修正
      const isDev = isDevEnv();
      if (isDev && !window.location.pathname.endsWith('.html')) {
        console.log('开发环境修正URL到 .html 以便文件直开');
        window.location.replace('./dashboard.html' + window.location.search);
        return;
      }
      
      showLoading(true);
      
      // 初始化配置
      await configManager.init();
      
      // 检查认证状态
      await this.checkAuth();
      
      // 绑定事件
      this.bindEvents();
      
      // 加载云端数据
      await this.loadCloudData();
      
      // 初始化主题
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

  // 纯云端数据加载
  async loadCloudData() {
    if (!this.currentUser) {
      console.log('用户未登录，无法加载数据');
      return;
    }

    try {
      // 并行加载收藏夹和搜索历史
      const [favoritesResult, historyResult] = await Promise.allSettled([
        apiService.getFavorites(),
        apiService.getSearchHistory()
      ]);

      // 处理收藏夹数据
      if (favoritesResult.status === 'fulfilled') {
        this.favorites = favoritesResult.value || [];
      } else {
        console.error('加载收藏夹失败:', favoritesResult.reason);
        this.favorites = [];
      }

      // 处理搜索历史数据
      if (historyResult.status === 'fulfilled') {
        const cloudHistory = historyResult.value || [];
        this.searchHistory = cloudHistory.map(item => ({
          id: item.id || `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          keyword: item.keyword || item.query,
          query: item.query || item.keyword,
          source: item.source || 'unknown',
          timestamp: item.timestamp || item.createdAt || Date.now(),
          count: item.count || 1
        })).filter(item => {
          return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
        });
      } else {
        console.error('加载搜索历史失败:', historyResult.reason);
        this.searchHistory = [];
      }

      // 加载当前标签页数据
      await this.loadTabData(this.currentTab);

    } catch (error) {
      console.error('加载云端数据失败:', error);
      showToast('数据加载失败', 'error');
      this.favorites = [];
      this.searchHistory = [];
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

    // 设置表单事件
    this.bindSettingsEvents();
    
    // 密码修改按钮
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    if (changePasswordBtn) {
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }

    // 数据操作按钮
    this.bindDataActionButtons();

    // 收藏夹搜索和排序
    this.bindFavoritesControls();
  }

  // 绑定数据操作按钮
  bindDataActionButtons() {
    const buttonMap = {
      syncAllDataBtn: () => this.syncAllData(),
      exportDataBtn: () => this.exportData(),
      exportFavoritesBtn: () => this.exportFavorites(),
      clearAllHistoryBtn: () => this.clearAllHistory(),
      clearAllDataBtn: () => this.clearAllData(),
      deleteAccountBtn: () => this.deleteAccount(),
      resetSettingsBtn: () => this.resetSettings(),
      saveSettingsBtn: () => this.saveSettings()
    };

    Object.entries(buttonMap).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  // 绑定收藏夹控件 (修复debounce使用)
  bindFavoritesControls() {
    const favoritesSearchBtn = document.getElementById('favoritesSearchBtn');
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');
    
    if (favoritesSearchBtn) {
      favoritesSearchBtn.addEventListener('click', () => this.searchFavorites());
    }
    
    if (favoritesSearch) {
      // 🔧 使用正确导入的debounce
      favoritesSearch.addEventListener('input', debounce(() => this.searchFavorites(), 300));
      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchFavorites();
      });
    }
    
    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => this.searchFavorites());
    }
  }

  // 绑定模态框事件
  bindModalEvents() {
    const passwordModal = document.getElementById('passwordModal');
    const closeBtns = document.querySelectorAll('.close');
    const passwordForm = document.getElementById('passwordForm');

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    if (passwordModal) {
      passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) this.closeModals();
      });
    }

    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }
  }

  // 绑定设置事件
  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
      });
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

  // 加载概览数据
  async loadOverviewData() {
    try {
      const [searchStats] = await Promise.allSettled([
        apiService.getSearchStats()
      ]);
      
      const stats = searchStats.status === 'fulfilled' ? searchStats.value : {
        total: this.searchHistory.length,
        today: 0,
        thisWeek: 0,
        topQueries: []
      };
      
      // 更新UI
      const totalSearchesEl = document.getElementById('totalSearches');
      const totalFavoritesEl = document.getElementById('totalFavorites');
      const activeDaysEl = document.getElementById('activeDays');
      const userLevelEl = document.getElementById('userLevel');

      if (totalSearchesEl) totalSearchesEl.textContent = stats.total || 0;
      if (totalFavoritesEl) totalFavoritesEl.textContent = this.favorites.length;
      
      const activeDays = this.calculateActiveDays();
      if (activeDaysEl) activeDaysEl.textContent = activeDays;
      
      const level = this.calculateUserLevel();
      if (userLevelEl) userLevelEl.textContent = level;

      await this.loadRecentActivity();

    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  // 加载设置数据
  async loadSettingsData() {
    try {
      const settings = await apiService.getUserSettings();
      
      const autoSyncEl = document.getElementById('autoSync');
      const enableCacheEl = document.getElementById('enableCache');
      const themeModeEl = document.getElementById('themeMode');
      const maxFavoritesEl = document.getElementById('maxFavorites');

      if (autoSyncEl) autoSyncEl.checked = settings.autoSync !== false;
      if (enableCacheEl) enableCacheEl.checked = settings.cacheResults !== false;
      if (themeModeEl) themeModeEl.value = settings.theme || 'auto';
      if (maxFavoritesEl) maxFavoritesEl.value = settings.maxFavoritesPerUser ?? 500;

    } catch (error) {
      console.error('加载设置失败:', error);
      showToast('加载设置失败', 'error');
    }
  }

  // 同步收藏 - 直接与API交互
  async syncFavorites() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      await apiService.syncFavorites(this.favorites);
      showToast('收藏夹同步成功', 'success');
    } catch (error) {
      console.error('同步收藏失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 移除收藏
  async removeFavorite(favoriteId) {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这个收藏吗？')) return;

    const index = this.favorites.findIndex(f => f.id === favoriteId);
    if (index >= 0) {
      try {
        showLoading(true);
        
        // 从数组中移除
        this.favorites.splice(index, 1);
        
        // 同步到云端
        await apiService.syncFavorites(this.favorites);
        
        // 重新加载数据以确保一致性
        await this.loadFavoritesData();
        showToast('收藏已删除', 'success');
        
      } catch (error) {
        console.error('删除收藏失败:', error);
        showToast('删除失败: ' + error.message, 'error');
        
        // 重新加载云端数据以恢复状态
        await this.loadCloudData();
      } finally {
        showLoading(false);
      }
    }
  }

  // 清空搜索历史
  async clearAllHistory() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？此操作不可恢复。')) return;

    try {
      showLoading(true);
      
      // 使用API清空
      await apiService.clearAllSearchHistory();
      
      // 清空本地数据
      this.searchHistory = [];
      
      // 重新加载数据
      await this.loadHistoryData();
      
      showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 清空所有数据
  async clearAllData() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有数据吗？此操作不可恢复，建议先导出数据备份。')) return;
    if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

    try {
      showLoading(true);
      
      // 清空云端数据
      await Promise.all([
        apiService.clearAllSearchHistory(),
        apiService.syncFavorites([]) // 传空数组清空收藏
      ]);
      
      // 清空本地数据
      this.favorites = [];
      this.searchHistory = [];
      
      // 重新加载数据
      await this.loadCloudData();
      
      showToast('所有数据已清空', 'success');
    } catch (error) {
      console.error('清空数据失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 保存设置
  async saveSettings() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      const ui = this.collectSettings();
      const payload = {
        theme: ui.themeMode,
        autoSync: !!ui.autoSync,
        cacheResults: !!ui.enableCache,
        maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
        maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10)
      };
      
      await apiService.updateUserSettings(payload);
      showToast('设置保存成功', 'success');
      this.markSettingsSaved();
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存设置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 数据同步
  async syncAllData() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      showToast('正在同步数据...', 'info');
      
      // 同步收藏夹到云端
      await apiService.syncFavorites(this.favorites);
      
      // 重新从云端加载数据以确保一致性
      await this.loadCloudData();
      
      showToast('数据同步成功', 'success');
    } catch (error) {
      console.error('数据同步失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 数据导出
  async exportData() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      // 从云端重新获取最新数据
      const [favorites, history, settings] = await Promise.all([
        apiService.getFavorites(),
        apiService.getSearchHistory(),
        apiService.getUserSettings()
      ]);

      const data = {
        favorites: favorites || this.favorites,
        searchHistory: history || this.searchHistory,
        settings: settings || this.collectSettings(),
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `magnet-search-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('数据导出成功', 'success');
    } catch (error) {
      console.error('导出数据失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 收藏夹导出
  async exportFavorites() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      // 从云端获取最新收藏数据
      const favorites = await apiService.getFavorites();
      
      const data = {
        favorites: favorites || this.favorites,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorites-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('收藏导出成功', 'success');
    } catch (error) {
      console.error('导出收藏失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 重置设置
  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    // 重置为默认设置
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
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value;
        } else {
          element.value = value;
        }
      }
    });

    this.markSettingsChanged();
    showToast('设置已重置为默认值，请点击保存', 'success');
  }

  // 初始化主题
  initTheme() {
    // 只调用主题管理器的应用方法，不绑定事件
    themeManager.applyTheme();
  }

  // 切换主题
  toggleTheme() {
    // 直接调用全局主题管理器，不需要额外绑定事件
    themeManager.toggleTheme();
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

  // 以下方法保持不变，但移除任何本地存储引用
  loadOverviewDataFromLocal() {
    const totalSearchesEl = document.getElementById('totalSearches');
    const totalFavoritesEl = document.getElementById('totalFavorites');
    const activeDaysEl = document.getElementById('activeDays');
    const userLevelEl = document.getElementById('userLevel');

    if (totalSearchesEl) totalSearchesEl.textContent = this.searchHistory.length;
    if (totalFavoritesEl) totalFavoritesEl.textContent = this.favorites.length;
    if (activeDaysEl) activeDaysEl.textContent = this.calculateActiveDays();
    if (userLevelEl) userLevelEl.textContent = this.calculateUserLevel();
  }

  async loadFavoritesData() {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;

    if (this.favorites.length === 0) {
      favoritesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">📌</span>
          <p>暂无收藏</p>
          <a href="index.html" class="btn-primary">去搜索</a>
        </div>
      `;
      return;
    }

    favoritesList.innerHTML = this.favorites.map(fav => `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url">${escapeHtml(fav.url)}</div>
          <div class="favorite-meta">
            <span>关键词: ${escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')">
            访问
          </button>
          <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }

  async loadHistoryData() {
    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');
    const uniqueKeywords = document.getElementById('uniqueKeywords');
    const avgPerDay = document.getElementById('avgPerDay');

    if (historyCount) historyCount.textContent = this.searchHistory.length;
    
    const unique = new Set(this.searchHistory.map(h => h.keyword)).size;
    if (uniqueKeywords) uniqueKeywords.textContent = unique;

    const daysActive = this.calculateActiveDays() || 1;
    if (avgPerDay) avgPerDay.textContent = Math.round(this.searchHistory.length / daysActive);

    if (!historyList) return;

    if (this.searchHistory.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🕐</span>
          <p>暂无搜索历史</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = this.searchHistory.slice(0, 50).map(item => `
      <div class="history-item">
        <div class="history-content">
          <div class="history-keyword">${escapeHtml(item.keyword)}</div>
          <div class="history-time">${formatRelativeTime(item.timestamp)}</div>
        </div>
        <div class="history-actions">
          <button class="action-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
            重新搜索
          </button>
        </div>
      </div>
    `).join('');
  }

  async loadStatsData() {
    console.log('加载统计数据');
  }

  changePassword() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
      modal.style.display = 'block';
      setTimeout(() => {
        const currentPassword = document.getElementById('currentPassword');
        if (currentPassword) currentPassword.focus();
      }, 100);
    }
  }

  async handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('请填写所有字段', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('新密码确认不一致', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('新密码至少6个字符', 'error');
      return;
    }

    try {
      showLoading(true);
      
      const response = await apiService.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        showToast('密码修改成功', 'success');
        this.closeModals();
        document.getElementById('passwordForm').reset();
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      showToast('密码修改失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
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
    if (this.searchHistory.length === 0) return 0;
    
    const dates = new Set(
      this.searchHistory.map(h => new Date(h.timestamp).toDateString())
    );
    return dates.size;
  }

  calculateUserLevel() {
    const totalActions = this.searchHistory.length + this.favorites.length;
    
    if (totalActions < 10) return '新手';
    if (totalActions < 50) return '熟练';
    if (totalActions < 200) return '专业';
    if (totalActions < 500) return '专家';
    return '大师';
  }

  async loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    const activities = [
      ...this.searchHistory.slice(0, 5).map(h => ({
        type: 'search',
        content: `搜索了 "${h.keyword}"`,
        time: h.timestamp,
        icon: '🔍'
      })),
      ...this.favorites.slice(0, 5).map(f => ({
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
          <div class="activity-text">${escapeHtml(activity.content)}</div>
          <div class="activity-time">${formatRelativeTime(activity.time)}</div>
        </div>
      </div>
    `).join('');
  }

  escapeHtml(text) {
    return escapeHtml(text);
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
  }

  async deleteAccount() {
    const confirmText = '我确定要删除账户';
    const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
    
    if (userInput !== confirmText) {
      showToast('确认文本不匹配，取消删除', 'info');
      return;
    }

    try {
      showLoading(true);
      
      const response = await apiService.deleteAccount();
      
      if (response.success) {
        showToast('账户已删除', 'success');
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  searchFavorites() {
    const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';
    
    let filteredFavorites = this.favorites;

    if (searchTerm) {
      filteredFavorites = this.favorites.filter(fav => 
        fav.title.toLowerCase().includes(searchTerm) ||
        fav.subtitle.toLowerCase().includes(searchTerm) ||
        fav.keyword.toLowerCase().includes(searchTerm)
      );
    }

    switch (sortBy) {
      case 'date-desc':
        filteredFavorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        break;
      case 'date-asc':
        filteredFavorites.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
        break;
      case 'name-asc':
        filteredFavorites.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        filteredFavorites.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    this.renderFilteredFavorites(filteredFavorites);
  }

  renderFilteredFavorites(favorites) {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;

    if (favorites.length === 0) {
      favoritesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的收藏</p>
        </div>
      `;
      return;
    }

    favoritesList.innerHTML = favorites.map(fav => `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url">${escapeHtml(fav.url)}</div>
          <div class="favorite-meta">
            <span>关键词: ${escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')">
            访问
          </button>
          <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }
}

export default DashboardApp;