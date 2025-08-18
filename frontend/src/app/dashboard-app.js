// Dashboard应用逻辑 - 增强版本，支持自定义搜索源管理
import { APP_CONSTANTS } from '../core/constants.js';
import configManager from '../core/config.js';
import { showLoading, showToast } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { isDevEnv, debounce } from '../utils/helpers.js';
import authManager from '../services/auth.js';
import themeManager from '../services/theme.js';
import apiService from '../services/api.js';
import searchService from '../services/search.js';

export class DashboardApp {
  constructor() {
    this.currentUser = null;
    this.favorites = [];
    this.searchHistory = [];
    this.currentTab = 'overview';
    this.allSearchSources = []; // 🔧 新增：所有可用搜索源
    this.customSearchSources = []; // 🔧 新增：自定义搜索源
    this.editingCustomSource = null; // 🔧 新增：正在编辑的自定义搜索源
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
      
      // 🔧 新增：加载搜索源数据
      await this.loadSearchSources();
      
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

  // 🔧 新增：加载搜索源数据
  async loadSearchSources() {
    try {
      const response = await apiService.request('/api/search-sources');
      this.allSearchSources = response.allSources || [];
      this.customSearchSources = response.customSources || [];
      console.log(`加载了 ${this.allSearchSources.length} 个搜索源，其中 ${this.customSearchSources.length} 个自定义`);
    } catch (error) {
      console.error('加载搜索源失败:', error);
      // 使用默认搜索源
      this.allSearchSources = APP_CONSTANTS.SEARCH_SOURCES;
      this.customSearchSources = [];
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

    // 数据操作按钮
    this.bindDataActionButtons();

    // 收藏夹控件
    this.bindFavoritesControls();

    // 🔧 新增：自定义搜索源管理事件
    this.bindCustomSourceEvents();
  }

  // 🔧 新增：绑定自定义搜索源管理事件
  bindCustomSourceEvents() {
    const addCustomSourceBtn = document.getElementById('addCustomSourceBtn');
    const customSourceForm = document.getElementById('customSourceForm');
    const customSourceModal = document.getElementById('customSourceModal');

    if (addCustomSourceBtn) {
      addCustomSourceBtn.addEventListener('click', () => this.showCustomSourceModal());
    }

    if (customSourceForm) {
      customSourceForm.addEventListener('submit', (e) => this.handleCustomSourceSubmit(e));
    }

    // 模态框关闭事件
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModals();
      }
      if (e.target.classList.contains('close')) {
        this.closeModals();
      }
    });
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

  // 绑定收藏夹控件
  bindFavoritesControls() {
    const favoritesSearchBtn = document.getElementById('favoritesSearchBtn');
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');
    
    if (favoritesSearchBtn) {
      favoritesSearchBtn.addEventListener('click', () => this.searchFavorites());
    }
    
    if (favoritesSearch) {
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

  // 🔧 修复：加载设置数据 - 支持自定义搜索源
  async loadSettingsData() {
    try {
      const settings = await apiService.getUserSettings();
      
      const themeModeEl = document.getElementById('themeMode');
      const maxFavoritesEl = document.getElementById('maxFavorites');
      const allowAnalyticsEl = document.getElementById('allowAnalytics');
      const searchSuggestionsEl = document.getElementById('searchSuggestions');

      if (themeModeEl) themeModeEl.value = settings.theme || 'auto';
      if (maxFavoritesEl) maxFavoritesEl.value = settings.maxFavoritesPerUser ?? 500;
      if (allowAnalyticsEl) allowAnalyticsEl.checked = settings.allowAnalytics !== false;
      if (searchSuggestionsEl) searchSuggestionsEl.checked = settings.searchSuggestions !== false;

      // 🔧 修复：加载搜索源设置，结合自定义搜索源
      const enabledSources = settings.searchSources || ['javbus', 'javdb', 'javlibrary'];
      this.customSearchSources = settings.customSearchSources || [];
      
      await this.loadSearchSourceSettings(enabledSources);

    } catch (error) {
      console.error('加载设置失败:', error);
      showToast('加载设置失败', 'error');
      // 出错时加载默认搜索源设置
      await this.loadSearchSourceSettings(['javbus', 'javdb', 'javlibrary']);
    }
  }

  // 🔧 修复：专门的搜索源设置加载方法
  async loadSearchSourceSettings(enabledSources) {
    // 清空现有的搜索源设置区域
    const searchSourcesContainer = document.getElementById('searchSourcesContainer');
    if (!searchSourcesContainer) {
      console.warn('找不到搜索源设置容器');
      return;
    }
    
    // 重新加载搜索源数据以确保最新
    await this.loadSearchSources();
    
    // 生成搜索源复选框HTML
    const sourceCheckboxesHTML = this.allSearchSources.map(source => `
      <label class="search-source-item" ${source.isCustom ? 'data-custom="true"' : ''}>
        <input type="checkbox" value="${source.id}" ${enabledSources.includes(source.id) ? 'checked' : ''}>
        <span class="source-info">
          <span class="source-name">${source.icon} ${source.name}</span>
          <span class="source-subtitle">${source.subtitle}</span>
          ${source.isCustom ? `
            <div class="custom-source-actions">
              <button type="button" class="btn-edit-source" data-source-id="${source.id}" title="编辑">✏️</button>
              <button type="button" class="btn-delete-source" data-source-id="${source.id}" title="删除">🗑️</button>
            </div>
          ` : ''}
        </span>
      </label>
    `).join('');
    
    const addButtonHTML = `
      <div class="add-custom-source-section">
        <button type="button" id="addCustomSourceBtn" class="btn-primary add-custom-source-btn">
          <span>➕</span>
          <span>添加自定义搜索源</span>
        </button>
      </div>
    `;
    
    searchSourcesContainer.innerHTML = sourceCheckboxesHTML + addButtonHTML;
    
    // 重新绑定自定义搜索源事件
    this.bindCustomSourceEvents();
    this.bindCustomSourceActionEvents();
  }

  // 🔧 新增：绑定自定义搜索源操作事件
  bindCustomSourceActionEvents() {
    // 编辑按钮事件
    document.querySelectorAll('.btn-edit-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.sourceId;
        this.editCustomSource(sourceId);
      });
    });

    // 删除按钮事件
    document.querySelectorAll('.btn-delete-source').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sourceId = btn.dataset.sourceId;
        this.deleteCustomSource(sourceId);
      });
    });
  }

  // 🔧 修复：保存设置 - 添加搜索源变更检测和前端更新
  async saveSettings() {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      const ui = this.collectSettings();
      
      // 验证至少选择了一个搜索源
      if (!ui.searchSources || ui.searchSources.length === 0) {
        showToast('请至少选择一个搜索源', 'error');
        return;
      }
      
      // 🔧 新增：获取当前搜索源设置用于比较
      let oldSearchSources = [];
      try {
        const currentSettings = await apiService.getUserSettings();
        oldSearchSources = currentSettings.searchSources || [];
      } catch (error) {
        console.warn('获取当前设置失败:', error);
      }
      
      const payload = {
        theme: ui.themeMode,
        searchSources: ui.searchSources,
        maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
        maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10),
        allowAnalytics: !!ui.allowAnalytics,
        searchSuggestions: !!ui.searchSuggestions,
        customSearchSources: this.customSearchSources // 🔧 新增：包含自定义搜索源
      };
      
      await apiService.updateUserSettings(payload);
      
      // 立即应用主题设置
      if (payload.theme) {
        themeManager.setTheme(payload.theme);
      }
      
      // 🔧 修复：清除搜索服务的用户设置缓存，确保下次搜索使用新设置
      if (searchService && searchService.clearUserSettingsCache) {
        searchService.clearUserSettingsCache();
      }
      
      // 🔧 新增：如果搜索源发生变化，通知主页面更新站点导航
      const searchSourcesChanged = JSON.stringify(oldSearchSources.sort()) !== JSON.stringify(ui.searchSources.sort());
      if (searchSourcesChanged) {
        // 发送自定义事件通知主页面更新站点导航
        window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
          detail: { newSources: ui.searchSources }
        }));
        
        console.log('搜索源设置已变更，已通知主页面更新站点导航');
      }
      
      showToast('设置保存成功', 'success');
      this.markSettingsSaved();
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存设置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 修复：收集设置时处理搜索源
  collectSettings() {
    const settings = {};
    
    // 基础设置
    const themeModeEl = document.getElementById('themeMode');
    const maxFavoritesEl = document.getElementById('maxFavorites');
    const historyRetentionEl = document.getElementById('historyRetention');
    const allowAnalyticsEl = document.getElementById('allowAnalytics');
    const searchSuggestionsEl = document.getElementById('searchSuggestions');
    
    if (themeModeEl) settings.themeMode = themeModeEl.value;
    if (maxFavoritesEl) settings.maxFavorites = maxFavoritesEl.value;
    if (historyRetentionEl) settings.historyRetention = historyRetentionEl.value;
    if (allowAnalyticsEl) settings.allowAnalytics = allowAnalyticsEl.checked;
    if (searchSuggestionsEl) settings.searchSuggestions = searchSuggestionsEl.checked;
    
    // 🔧 修复：收集搜索源设置
    const searchSourceCheckboxes = document.querySelectorAll('#searchSourcesContainer input[type="checkbox"]:checked');
    settings.searchSources = Array.from(searchSourceCheckboxes).map(checkbox => checkbox.value);
    
    return settings;
  }

  // 🔧 修复：重置设置
  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    // 重置为默认设置
    const defaultSettings = {
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true,
      searchSources: ['javbus', 'javdb', 'javlibrary'] // 默认搜索源
    };

    // 重置基础设置
    Object.entries(defaultSettings).forEach(([key, value]) => {
      if (key === 'searchSources') return; // 搜索源单独处理
      
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value;
        } else {
          element.value = value;
        }
      }
    });

    // 🔧 重置搜索源设置
    const sourceCheckboxes = document.querySelectorAll('#searchSourcesContainer input[type="checkbox"]');
    sourceCheckboxes.forEach(checkbox => {
      checkbox.checked = defaultSettings.searchSources.includes(checkbox.value);
    });

    this.markSettingsChanged();
    showToast('设置已重置为默认值，请点击保存', 'success');
  }

  // 🔧 新增：显示自定义搜索源模态框
  showCustomSourceModal(source = null) {
    this.editingCustomSource = source;
    
    // 获取或创建模态框
    let modal = document.getElementById('customSourceModal');
    if (!modal) {
      modal = this.createCustomSourceModal();
      document.body.appendChild(modal);
    }
    
    // 填充表单数据
    const form = document.getElementById('customSourceForm');
    if (form) {
      if (source) {
        // 编辑模式
        form.sourceId.value = source.id;
        form.sourceName.value = source.name;
        form.sourceSubtitle.value = source.subtitle || '';
        form.sourceIcon.value = source.icon || '🔍';
        form.sourceUrl.value = source.urlTemplate;
        modal.querySelector('h2').textContent = '编辑自定义搜索源';
        modal.querySelector('[type="submit"]').textContent = '更新搜索源';
      } else {
        // 新增模式
        form.reset();
        form.sourceIcon.value = '🔍';
        modal.querySelector('h2').textContent = '添加自定义搜索源';
        modal.querySelector('[type="submit"]').textContent = '添加搜索源';
      }
    }
    
    modal.style.display = 'block';
    setTimeout(() => {
      const nameInput = form.sourceName;
      if (nameInput) nameInput.focus();
    }, 100);
  }

  // 🔧 新增：创建自定义搜索源模态框
  createCustomSourceModal() {
    const modal = document.createElement('div');
    modal.id = 'customSourceModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义搜索源</h2>
        <form id="customSourceForm">
          <input type="hidden" name="sourceId">
          
          <div class="form-group">
            <label for="sourceName">搜索源名称 *</label>
            <input type="text" name="sourceName" id="sourceName" required maxlength="50" 
                   placeholder="例如：我的搜索站">
          </div>
          
          <div class="form-group">
            <label for="sourceSubtitle">描述信息</label>
            <input type="text" name="sourceSubtitle" id="sourceSubtitle" maxlength="100" 
                   placeholder="例如：专业的搜索引擎">
          </div>
          
          <div class="form-group">
            <label for="sourceIcon">图标</label>
            <input type="text" name="sourceIcon" id="sourceIcon" maxlength="5" 
                   placeholder="🔍" value="🔍">
          </div>
          
          <div class="form-group">
            <label for="sourceUrl">搜索URL模板 *</label>
            <input type="url" name="sourceUrl" id="sourceUrl" required 
                   placeholder="https://example.com/search?q={keyword}">
            <small class="form-help">
              URL中必须包含 <code>{keyword}</code> 占位符，搜索时会被替换为实际关键词
            </small>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">添加搜索源</button>
          </div>
        </form>
      </div>
    `;
    return modal;
  }

  // 🔧 新增：处理自定义搜索源表单提交
  async handleCustomSourceSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const sourceData = {
      id: formData.get('sourceId') || null,
      name: formData.get('sourceName').trim(),
      subtitle: formData.get('sourceSubtitle').trim(),
      icon: formData.get('sourceIcon').trim() || '🔍',
      urlTemplate: formData.get('sourceUrl').trim()
    };
    
    // 验证数据
    if (!sourceData.name || !sourceData.urlTemplate) {
      showToast('请填写必需的字段', 'error');
      return;
    }
    
    if (!sourceData.urlTemplate.includes('{keyword}')) {
      showToast('URL模板必须包含{keyword}占位符', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingCustomSource) {
        // 更新现有搜索源
        await apiService.updateCustomSearchSource(sourceData.id, sourceData);
        showToast('自定义搜索源更新成功', 'success');
      } else {
        // 添加新的搜索源
        await apiService.addCustomSearchSource(sourceData);
        showToast('自定义搜索源添加成功', 'success');
      }
      
      // 重新加载搜索源数据
      await this.loadSearchSources();
      
      // 重新加载设置页面
      await this.loadSettingsData();
      
      // 关闭模态框
      this.closeModals();
      
    } catch (error) {
      console.error('保存自定义搜索源失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：编辑自定义搜索源
  editCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    this.showCustomSourceModal(source);
  }

  // 🔧 新增：删除自定义搜索源
  async deleteCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义搜索源"${source.name}"吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      
      await apiService.deleteCustomSearchSource(sourceId);
      
      // 重新加载搜索源数据
      await this.loadSearchSources();
      
      // 重新加载设置页面
      await this.loadSettingsData();
      
      showToast('自定义搜索源删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
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

  // 删除单条搜索历史记录
  async deleteHistoryItem(historyId) {
    if (!this.currentUser) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      // 调用API删除
      await apiService.deleteSearchHistory(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      // 重新加载历史数据
      await this.loadHistoryData();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
      
      // 重新加载云端数据以恢复状态
      await this.loadCloudData();
    } finally {
      showLoading(false);
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
        customSearchSources: this.customSearchSources, // 🔧 新增：导出自定义搜索源
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

  // 修改密码
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

  // 修改：加载历史数据，添加删除按钮
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
          <span style="font-size: 3rem;">🕒</span>
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
          <button class="action-btn search-again-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
            重新搜索
          </button>
          <button class="action-btn delete-history-btn" onclick="app.deleteHistoryItem('${item.id}')" title="删除这条记录">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }

  async loadStatsData() {
    console.log('加载统计数据');
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
    this.editingCustomSource = null; // 🔧 重置编辑状态
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

  escapeHtml(text) {
    return escapeHtml(text);
  }
}

export default DashboardApp;