// Enhanced Dashboard应用逻辑 - 深度优化版本，支持搜索源和分类管理
import { APP_CONSTANTS } from '../core/constants.js';
import configManager from '../core/config.js';
import { showLoading, showToast } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { isDevEnv, debounce } from '../utils/helpers.js';
import authManager from '../services/auth.js';
import themeManager from '../services/theme.js';
import apiService from '../services/api.js';
import searchService from '../services/search.js';

export class EnhancedDashboardApp {
  constructor() {
    this.currentUser = null;
    this.favorites = [];
    this.searchHistory = [];
    this.currentTab = 'overview';
    
    // 🔧 优化：从constants.js获取内置数据
    this.builtinSearchSources = [];
    this.builtinCategories = [];
    this.allSearchSources = []; // 内置 + 自定义搜索源
    this.allCategories = []; // 内置 + 自定义分类
    this.customSearchSources = [];
    this.customCategories = [];
    this.enabledSources = [];
    
    // 编辑状态
    this.editingCustomSource = null;
    this.editingCustomCategory = null;
    
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
      
      // 🔧 新增：加载内置数据
      this.loadBuiltinData();
      
      // 初始化配置
      await configManager.init();
      
      // 检查认证状态
      await this.checkAuth();
      
      // 绑定事件
      this.bindEvents();
      
      // 加载云端数据
      await this.loadCloudData();
      
      // 🔧 新增：加载用户搜索源和分类设置
      await this.loadUserSearchSettings();
      
      // 初始化主题
      themeManager.init();
      
      this.isInitialized = true;
      console.log('✅ Enhanced Dashboard初始化完成');
      
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

  // 🔧 新增：从constants.js加载内置数据
  loadBuiltinData() {
    try {
      // 加载内置搜索源
      this.builtinSearchSources = APP_CONSTANTS.SEARCH_SOURCES.map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      
      // 加载内置分类
      this.builtinCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(category => ({
        ...category,
        isBuiltin: true,
        isCustom: false
      }));
      
      // 初始化所有数据
      this.allSearchSources = [...this.builtinSearchSources];
      this.allCategories = [...this.builtinCategories];
      
      console.log(`从constants.js加载了 ${this.builtinSearchSources.length} 个内置搜索源和 ${this.builtinCategories.length} 个内置分类`);
      
    } catch (error) {
      console.error('加载内置数据失败:', error);
      this.builtinSearchSources = [];
      this.builtinCategories = [];
      this.allSearchSources = [];
      this.allCategories = [];
    }
  }

  // 🔧 新增：加载用户搜索源和分类设置
// 🔧 修复2：在 enhanced-dashboard-app.js 中统一字段名处理
// 修改 loadUserSearchSettings 方法
async loadUserSearchSettings() {
  if (!this.currentUser) return;
  
  try {
    const userSettings = await apiService.getUserSettings();
    
    // 🔧 修复：统一使用 customSourceCategories 字段名
    this.customSearchSources = userSettings.customSearchSources || [];
    this.customCategories = userSettings.customSourceCategories || []; // 统一字段名
    this.enabledSources = userSettings.searchSources || APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
    
    // 合并内置和自定义数据
    this.allSearchSources = [
      ...this.builtinSearchSources,
      ...this.customSearchSources.map(s => ({ ...s, isBuiltin: false, isCustom: true }))
    ];
    
    this.allCategories = [
      ...this.builtinCategories,
      ...this.customCategories.map(c => ({ ...c, isBuiltin: false, isCustom: true }))
    ];
    
    console.log(`用户设置：启用 ${this.enabledSources.length} 个搜索源，包含 ${this.customSearchSources.length} 个自定义源和 ${this.customCategories.length} 个自定义分类`);
    
  } catch (error) {
    console.warn('加载用户搜索源设置失败，使用默认设置:', error);
    this.customSearchSources = [];
    this.customCategories = [];
    this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
    
    // 重置为仅内置数据
    this.allSearchSources = [...this.builtinSearchSources];
    this.allCategories = [...this.builtinCategories];
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

    // 数据操作按钮
    this.bindDataActionButtons();

    // 收藏夹控件
    this.bindFavoritesControls();

    // 🔧 新增：自定义搜索源管理事件
    this.bindCustomSourceEvents();
    
    // 🔧 新增：自定义分类管理事件
    this.bindCustomCategoryEvents();
  }

  // 🔧 新增：绑定自定义搜索源管理事件
  bindCustomSourceEvents() {
    // 添加自定义搜索源按钮
    const addCustomSourceBtn = document.getElementById('addCustomSourceBtn');
    if (addCustomSourceBtn) {
      addCustomSourceBtn.addEventListener('click', () => this.showCustomSourceModal());
    }

    // 搜索源筛选和排序
    const sourcesFilter = document.getElementById('sourcesFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const sourcesSort = document.getElementById('sourcesSort');

    if (sourcesFilter) {
      sourcesFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (sourcesSort) {
      sourcesSort.addEventListener('change', () => this.filterAndSortSources());
    }

    // 批量操作按钮
    const enableAllBtn = document.querySelector('[onclick*="enableAllSources"]');
    const disableAllBtn = document.querySelector('[onclick*="disableAllSources"]');
    const resetToDefaultsBtn = document.querySelector('[onclick*="resetToDefaults"]');

    if (enableAllBtn) enableAllBtn.addEventListener('click', () => this.enableAllSources());
    if (disableAllBtn) disableAllBtn.addEventListener('click', () => this.disableAllSources());
    if (resetToDefaultsBtn) resetToDefaultsBtn.addEventListener('click', () => this.resetToDefaults());
  }

  // 🔧 新增：绑定自定义分类管理事件
  bindCustomCategoryEvents() {
    // 添加自定义分类按钮
    const addCustomCategoryBtn = document.getElementById('addCustomCategoryBtn');
    if (addCustomCategoryBtn) {
      addCustomCategoryBtn.addEventListener('click', () => this.showCustomCategoryModal());
    }
  }

  // 绑定数据操作按钮
  bindDataActionButtons() {
    const buttonMap = {
      syncAllDataBtn: () => this.syncAllData(),
      exportDataBtn: () => this.exportData(),
      exportFavoritesBtn: () => this.exportFavorites(),
      exportSourcesBtn: () => this.exportSources(), // 🔧 新增
      exportCategoriesBtn: () => this.exportCategories(), // 🔧 新增
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

    // 模态框外部点击关闭
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModals();
      }
      if (e.target.classList.contains('close')) {
        this.closeModals();
      }
    });
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
      case 'sources': // 🔧 新增：搜索源管理
        await this.loadSourcesData();
        break;
      case 'categories': // 🔧 新增：分类管理
        await this.loadCategoriesData();
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
      const totalSourcesEl = document.getElementById('totalSources'); // 🔧 新增
      const userLevelEl = document.getElementById('userLevel');

      if (totalSearchesEl) totalSearchesEl.textContent = stats.total || 0;
      if (totalFavoritesEl) totalFavoritesEl.textContent = this.favorites.length;
      if (totalSourcesEl) totalSourcesEl.textContent = this.allSearchSources.length; // 🔧 新增
      
      const level = this.calculateUserLevel();
      if (userLevelEl) userLevelEl.textContent = level;

      await this.loadRecentActivity();

    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  // 🔧 新增：加载搜索源管理数据
  async loadSourcesData() {
    try {
      // 重新加载用户设置以确保最新
      await this.loadUserSearchSettings();
      
      // 更新分类筛选选项
      this.updateCategoryFilterOptions();
      
      // 渲染搜索源列表
      this.renderSourcesList();
      
      // 更新统计数据
      this.updateSourcesStats();
      
    } catch (error) {
      console.error('加载搜索源数据失败:', error);
      showToast('加载搜索源数据失败', 'error');
    }
  }

  // 🔧 新增：加载分类管理数据
  async loadCategoriesData() {
    try {
      // 重新加载用户设置以确保最新
      await this.loadUserSearchSettings();
      
      // 渲染内置分类列表
      this.renderBuiltinCategories();
      
      // 渲染自定义分类列表
      this.renderCustomCategories();
      
      // 更新统计数据
      this.updateCategoriesStats();
      
    } catch (error) {
      console.error('加载分类数据失败:', error);
      showToast('加载分类数据失败', 'error');
    }
  }

  // 🔧 新增：更新分类筛选选项
  updateCategoryFilterOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    categoryFilter.innerHTML = `
      <option value="all">全部分类</option>
      ${categoriesHTML}
    `;
  }

  // 🔧 新增：渲染搜索源列表
  renderSourcesList() {
    const sourcesList = document.getElementById('sourcesList');
    if (!sourcesList) return;

    // 获取当前筛选和排序设置
    const filter = document.getElementById('sourcesFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const sort = document.getElementById('sourcesSort')?.value || 'priority';

    // 应用筛选
    let filteredSources = this.allSearchSources;

    if (filter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        switch (filter) {
          case 'enabled':
            return this.enabledSources.includes(source.id);
          case 'disabled':
            return !this.enabledSources.includes(source.id);
          case 'builtin':
            return source.isBuiltin;
          case 'custom':
            return source.isCustom;
          default:
            return true;
        }
      });
    }

    if (categoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => source.category === categoryFilter);
    }

    // 应用排序
    filteredSources.sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          const catA = this.getCategoryById(a.category)?.name || 'Unknown';
          const catB = this.getCategoryById(b.category)?.name || 'Unknown';
          return catA.localeCompare(catB);
        case 'status':
          const statusA = this.enabledSources.includes(a.id) ? 0 : 1;
          const statusB = this.enabledSources.includes(b.id) ? 0 : 1;
          return statusA - statusB;
        case 'priority':
        default:
          if (a.isBuiltin && b.isBuiltin) {
            return (a.priority || 999) - (b.priority || 999);
          }
          if (a.isBuiltin && !b.isBuiltin) return -1;
          if (!a.isBuiltin && b.isBuiltin) return 1;
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    if (filteredSources.length === 0) {
      sourcesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的搜索源</p>
          <button class="btn-primary" onclick="app.showCustomSourceModal()">添加自定义搜索源</button>
        </div>
      `;
      return;
    }

    sourcesList.innerHTML = `
      <div class="sources-grid">
        ${filteredSources.map(source => this.renderSourceItem(source)).join('')}
      </div>
    `;

    // 重新绑定事件
    this.bindSourceItemEvents();
  }

  // 🔧 新增：渲染单个搜索源项目
  renderSourceItem(source) {
    const category = this.getCategoryById(source.category);
    const isEnabled = this.enabledSources.includes(source.id);
    
    return `
      <div class="source-item ${isEnabled ? 'enabled' : 'disabled'}" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-toggle">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                   onchange="app.toggleSourceEnabled('${source.id}', this.checked)">
          </div>
          <div class="source-info">
            <div class="source-name">
              <span class="source-icon">${source.icon}</span>
              <span class="source-title">${escapeHtml(source.name)}</span>
              ${source.isCustom ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
            </div>
            <div class="source-subtitle">${escapeHtml(source.subtitle || '')}</div>
            <div class="source-meta">
              <div class="source-category">
                <span>分类：${category ? `${category.icon} ${category.name}` : '未知分类'}</span>
              </div>
              <div class="source-url">${escapeHtml(source.urlTemplate)}</div>
            </div>
          </div>
        </div>
        <div class="source-actions">
          <button class="action-btn test-btn" onclick="app.testSource('${source.id}')" title="测试搜索">
            测试
          </button>
          <button class="action-btn visit-btn" onclick="app.visitSource('${source.id}')" title="访问网站">
            访问
          </button>
          ${source.isCustom ? `
            <button class="action-btn edit-btn" onclick="app.editCustomSource('${source.id}')" title="编辑">
              编辑
            </button>
            <button class="action-btn delete-btn" onclick="app.deleteCustomSource('${source.id}')" title="删除">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 🔧 新增：绑定搜索源项目事件
  bindSourceItemEvents() {
    // 这里可以绑定额外的事件，目前使用onclick处理
  }

  // 🔧 新增：渲染内置分类列表
  renderBuiltinCategories() {
    const builtinCategoriesList = document.getElementById('builtinCategoriesList');
    if (!builtinCategoriesList) return;

    if (this.builtinCategories.length === 0) {
      builtinCategoriesList.innerHTML = '<p class="empty-state">没有内置分类</p>';
      return;
    }

    builtinCategoriesList.innerHTML = `
      <div class="categories-grid">
        ${this.builtinCategories
          .sort((a, b) => (a.order || 999) - (b.order || 999))
          .map(category => this.renderCategoryItem(category)).join('')}
      </div>
    `;
  }

  // 🔧 新增：渲染自定义分类列表
  renderCustomCategories() {
    const customCategoriesList = document.getElementById('customCategoriesList');
    if (!customCategoriesList) return;

    if (this.customCategories.length === 0) {
      customCategoriesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🎨</span>
          <p>暂无自定义分类</p>
          <button class="btn-primary" onclick="app.showCustomCategoryModal()">添加自定义分类</button>
        </div>
      `;
      return;
    }

    customCategoriesList.innerHTML = `
      <div class="categories-grid">
        ${this.customCategories.map(category => this.renderCategoryItem(category)).join('')}
      </div>
    `;
  }

  // 🔧 新增：渲染单个分类项目
  renderCategoryItem(category) {
    const sourceCount = this.allSearchSources.filter(s => s.category === category.id).length;
    const enabledSourceCount = this.allSearchSources.filter(s => 
      s.category === category.id && this.enabledSources.includes(s.id)
    ).length;
    
    return `
      <div class="category-item ${category.isCustom ? 'custom' : 'builtin'}" data-category-id="${category.id}">
        <div class="category-header">
          <div class="category-icon">${category.icon}</div>
          <div class="category-info">
            <div class="category-name">${escapeHtml(category.name)}</div>
            <div class="category-description">${escapeHtml(category.description || '')}</div>
            <div class="category-meta">
              <span class="category-usage">
                ${enabledSourceCount}/${sourceCount} 个搜索源已启用
              </span>
              ${category.isCustom ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
            </div>
          </div>
        </div>
        <div class="category-actions">
          <button class="action-btn view-btn" onclick="app.viewCategorySources('${category.id}')" title="查看搜索源">
            查看源
          </button>
          ${category.isCustom ? `
            <button class="action-btn edit-btn" onclick="app.editCustomCategory('${category.id}')" title="编辑">
              编辑
            </button>
            <button class="action-btn delete-btn" onclick="app.deleteCustomCategory('${category.id}')" title="删除">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 🔧 新增：更新搜索源统计数据
  updateSourcesStats() {
    const totalSourcesCount = document.getElementById('totalSourcesCount');
    const enabledSourcesCount = document.getElementById('enabledSourcesCount');
    const customSourcesCount = document.getElementById('customSourcesCount');
    const categoriesCount = document.getElementById('categoriesCount');

    if (totalSourcesCount) totalSourcesCount.textContent = this.allSearchSources.length;
    if (enabledSourcesCount) enabledSourcesCount.textContent = this.enabledSources.length;
    if (customSourcesCount) customSourcesCount.textContent = this.customSearchSources.length;
    if (categoriesCount) categoriesCount.textContent = this.allCategories.length;
  }

  // 🔧 新增：更新分类统计数据
  updateCategoriesStats() {
    const totalCategoriesCount = document.getElementById('totalCategoriesCount');
    const builtinCategoriesCount = document.getElementById('builtinCategoriesCount');
    const customCategoriesCount = document.getElementById('customCategoriesCount');
    const usedCategoriesCount = document.getElementById('usedCategoriesCount');

    // 计算使用中的分类数量
    const usedCategories = new Set(this.allSearchSources.map(s => s.category));

    if (totalCategoriesCount) totalCategoriesCount.textContent = this.allCategories.length;
    if (builtinCategoriesCount) builtinCategoriesCount.textContent = this.builtinCategories.length;
    if (customCategoriesCount) customCategoriesCount.textContent = this.customCategories.length;
    if (usedCategoriesCount) usedCategoriesCount.textContent = usedCategories.size;
  }

  // 🔧 新增：筛选和排序搜索源
  filterAndSortSources() {
    this.renderSourcesList();
  }

  // 🔧 新增：切换搜索源启用状态
  async toggleSourceEnabled(sourceId, enabled) {
    try {
      if (enabled) {
        if (!this.enabledSources.includes(sourceId)) {
          this.enabledSources.push(sourceId);
        }
      } else {
        this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      }

      // 保存到云端
      await this.saveSearchSourcesSettings();
      
      // 更新统计
      this.updateSourcesStats();
      
      showToast(`搜索源已${enabled ? '启用' : '禁用'}`, 'success', 2000);
      
    } catch (error) {
      console.error('切换搜索源状态失败:', error);
      showToast('操作失败: ' + error.message, 'error');
      
      // 恢复UI状态
      this.renderSourcesList();
    }
  }

  // 🔧 新增：启用所有搜索源
  async enableAllSources() {
    try {
      this.enabledSources = this.allSearchSources.map(s => s.id);
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已启用所有搜索源', 'success');
    } catch (error) {
      console.error('启用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：禁用所有搜索源
  async disableAllSources() {
    if (!confirm('确定要禁用所有搜索源吗？这将影响搜索功能。')) return;
    
    try {
      this.enabledSources = [];
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已禁用所有搜索源', 'success');
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：重置为默认搜索源
  async resetToDefaults() {
    if (!confirm('确定要重置为默认搜索源配置吗？')) return;
    
    try {
      this.enabledSources = [...APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources];
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已重置为默认配置', 'success');
    } catch (error) {
      console.error('重置搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：测试搜索源
  async testSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      const testUrl = source.urlTemplate.replace('{keyword}', 'test');
      window.open(testUrl, '_blank', 'noopener,noreferrer');
      showToast('已在新窗口中打开测试链接', 'success', 2000);
    } catch (error) {
      console.error('测试搜索源失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：访问搜索源
  async visitSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      // 提取域名
      const urlObj = new URL(source.urlTemplate.replace('{keyword}', ''));
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('访问搜索源失败:', error);
      showToast('访问失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：查看分类下的搜索源
  viewCategorySources(categoryId) {
    // 切换到搜索源管理页面
    this.switchTab('sources');
    
    // 设置分类筛选
    setTimeout(() => {
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.value = categoryId;
        this.filterAndSortSources();
      }
    }, 100);
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
        form.sourceCategory.value = source.category || 'others';
        modal.querySelector('h2').textContent = '编辑自定义搜索源';
        modal.querySelector('[type="submit"]').textContent = '更新搜索源';
      } else {
        // 新增模式
        form.reset();
        form.sourceIcon.value = '🔍';
        form.sourceCategory.value = 'others';
        modal.querySelector('h2').textContent = '添加自定义搜索源';
        modal.querySelector('[type="submit"]').textContent = '添加搜索源';
      }
      
      // 更新分类选择器
      this.updateSourceCategorySelect(form.sourceCategory);
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
          
          <div class="form-row">
            <div class="form-group">
              <label for="sourceName">搜索源名称 *</label>
              <input type="text" name="sourceName" id="sourceName" required maxlength="50" 
                     placeholder="例如：我的搜索站">
            </div>
            
            <div class="form-group">
              <label for="sourceIcon">图标</label>
              <input type="text" name="sourceIcon" id="sourceIcon" maxlength="5" 
                     placeholder="🔍" value="🔍">
            </div>
          </div>
          
          <div class="form-group">
            <label for="sourceSubtitle">描述信息</label>
            <input type="text" name="sourceSubtitle" id="sourceSubtitle" maxlength="100" 
                   placeholder="例如：专业的搜索引擎">
          </div>
          
          <div class="form-group">
            <label for="sourceCategory">搜索源分类 *</label>
            <select name="sourceCategory" id="sourceCategory" required>
              <!-- 分类选项将动态生成 -->
            </select>
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
    
    // 绑定表单提交事件
    const form = modal.querySelector('#customSourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomSourceSubmit(e));
    }
    
    return modal;
  }

  // 🔧 新增：更新搜索源分类选择器
  updateSourceCategorySelect(selectElement) {
    if (!selectElement) return;

    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    selectElement.innerHTML = categoriesHTML;
  }

  // 🔧 新增：处理自定义搜索源表单提交
// 🔧 修复：handleCustomSourceSubmit 方法中的ID处理
async handleCustomSourceSubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const sourceData = {
    id: formData.get('sourceId') || null, // 修复：允许为null
    name: formData.get('sourceName').trim(),
    subtitle: formData.get('sourceSubtitle').trim(),
    icon: formData.get('sourceIcon').trim() || '🔍',
    urlTemplate: formData.get('sourceUrl').trim(),
    category: formData.get('sourceCategory')
  };
  
  // 🔧 修复：验证数据时考虑新增模式
  const validation = this.validateCustomSource(sourceData);
  if (!validation.valid) {
    showToast(validation.message, 'error');
    return;
  }
  
  try {
    showLoading(true);
    
    if (this.editingCustomSource && sourceData.id) {
      // 编辑模式：有ID才进行更新
      await this.updateCustomSource(sourceData);
      showToast('自定义搜索源更新成功', 'success');
    } else {
      // 新增模式：添加新的搜索源
      await this.addCustomSource(sourceData);
      showToast('自定义搜索源添加成功', 'success');
    }
    
    // 重新加载数据
    await this.loadUserSearchSettings();
    await this.loadSourcesData();
    
    // 关闭模态框
    this.closeModals();
    
  } catch (error) {
    console.error('保存自定义搜索源失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

  // 🔧 新增：验证自定义搜索源
// 🔧 修复：validateCustomSource 方法 - 修改验证逻辑
validateCustomSource(sourceData) {
  const rules = APP_CONSTANTS.VALIDATION_RULES.SOURCE;
  
  // 🔧 修复：只验证非ID的必需字段
  const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
  
  // 检查必需字段（除了ID）
  for (const field of requiredFieldsForValidation) {
    if (!sourceData[field] || sourceData[field].trim() === '') {
      return { valid: false, message: `${field} 是必需的` };
    }
  }
  
  // 检查名称格式
  if (!rules.NAME_PATTERN.test(sourceData.name)) {
    return { valid: false, message: '搜索源名称格式不正确' };
  }
  
  // 检查URL格式
  if (!rules.URL_PATTERN.test(sourceData.urlTemplate)) {
    return { valid: false, message: 'URL模板必须包含{keyword}占位符' };
  }
  
  // 检查禁用域名
  try {
    const hostname = new URL(sourceData.urlTemplate.replace('{keyword}', 'test')).hostname;
    if (rules.FORBIDDEN_DOMAINS.some(domain => hostname.includes(domain))) {
      return { valid: false, message: '不允许使用该域名' };
    }
  } catch (error) {
    return { valid: false, message: 'URL格式无效' };
  }
  
  // 🔧 修复：只在新增时检查ID重复（编辑时跳过）
  if (!sourceData.id) {
    const generatedId = this.generateSourceId(sourceData.name);
    if (this.allSearchSources.some(s => s.id === generatedId)) {
      return { valid: false, message: '搜索源名称已存在，请使用不同的名称' };
    }
  }
  
  // 检查分类是否存在
  if (!this.getCategoryById(sourceData.category)) {
    return { valid: false, message: '选择的分类不存在' };
  }
  
  return { valid: true };
}

  // 🔧 新增：生成搜索源ID
  generateSourceId(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) + '_' + Date.now().toString(36);
  }

  // 🔧 新增：添加自定义搜索源
  async addCustomSource(sourceData) {
    // 生成唯一ID
    sourceData.id = this.generateSourceId(sourceData.name);
    sourceData.createdAt = Date.now();
    sourceData.isCustom = true;
    sourceData.isBuiltin = false;
    
    // 添加到本地数组
    this.customSearchSources.push(sourceData);
    this.allSearchSources.push({ ...sourceData, isCustom: true, isBuiltin: false });
    
    // 保存到云端
    await this.saveCustomSearchSources();
  }

  // 🔧 新增：更新自定义搜索源
  async updateCustomSource(sourceData) {
    const index = this.customSearchSources.findIndex(s => s.id === sourceData.id);
    if (index === -1) {
      throw new Error('未找到要更新的搜索源');
    }
    
    // 更新本地数据
    this.customSearchSources[index] = { ...this.customSearchSources[index], ...sourceData };
    
    const allIndex = this.allSearchSources.findIndex(s => s.id === sourceData.id);
    if (allIndex !== -1) {
      this.allSearchSources[allIndex] = { ...this.allSearchSources[allIndex], ...sourceData };
    }
    
    // 保存到云端
    await this.saveCustomSearchSources();
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
      
      // 从本地数组中移除
      this.customSearchSources = this.customSearchSources.filter(s => s.id !== sourceId);
      this.allSearchSources = this.allSearchSources.filter(s => s.id !== sourceId);
      this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      
      // 保存到云端
      await this.saveCustomSearchSources();
      
      // 重新加载页面
      await this.loadSourcesData();
      
      showToast('自定义搜索源删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：显示自定义分类模态框
  showCustomCategoryModal(category = null) {
    this.editingCustomCategory = category;
    
    // 获取或创建模态框
    let modal = document.getElementById('customCategoryModal');
    if (!modal) {
      modal = this.createCustomCategoryModal();
      document.body.appendChild(modal);
    }
    
    // 填充表单数据
    const form = document.getElementById('customCategoryForm');
    if (form) {
      if (category) {
        // 编辑模式
        form.categoryId.value = category.id;
        form.categoryName.value = category.name;
        form.categoryDescription.value = category.description || '';
        form.categoryIcon.value = category.icon || '🌟';
        form.categoryColor.value = category.color || '#6b7280';
        modal.querySelector('h2').textContent = '编辑自定义分类';
        modal.querySelector('[type="submit"]').textContent = '更新分类';
      } else {
        // 新增模式
        form.reset();
        form.categoryIcon.value = '🌟';
        form.categoryColor.value = '#6b7280';
        modal.querySelector('h2').textContent = '添加自定义分类';
        modal.querySelector('[type="submit"]').textContent = '添加分类';
      }
    }
    
    modal.style.display = 'block';
    setTimeout(() => {
      const nameInput = form.categoryName;
      if (nameInput) nameInput.focus();
    }, 100);
  }

  // 🔧 新增：创建自定义分类模态框
  createCustomCategoryModal() {
    const modal = document.createElement('div');
    modal.id = 'customCategoryModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义分类</h2>
        <form id="customCategoryForm">
          <input type="hidden" name="categoryId">
          
          <div class="form-row">
            <div class="form-group">
              <label for="categoryName">分类名称 *</label>
              <input type="text" name="categoryName" id="categoryName" required maxlength="30" 
                     placeholder="例如：我的分类">
            </div>
            
            <div class="form-group">
              <label for="categoryIcon">图标 *</label>
              <select name="categoryIcon" id="categoryIcon" required>
                ${APP_CONSTANTS.DEFAULT_ICONS.map(icon => `
                  <option value="${icon}">${icon}</option>
                `).join('')}
              </select>
            </div>
          </div>
          
          <div class="form-group">
            <label for="categoryDescription">分类描述</label>
            <input type="text" name="categoryDescription" id="categoryDescription" maxlength="100" 
                   placeholder="例如：专门的搜索资源分类">
          </div>
          
          <div class="form-group">
            <label for="categoryColor">分类颜色</label>
            <select name="categoryColor" id="categoryColor">
              ${APP_CONSTANTS.DEFAULT_COLORS.map(color => `
                <option value="${color}" style="background-color: ${color}; color: white;">
                  ${color}
                </option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">添加分类</button>
          </div>
        </form>
      </div>
    `;
    
    // 绑定表单提交事件
    const form = modal.querySelector('#customCategoryForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomCategorySubmit(e));
    }
    
    return modal;
  }

  // 🔧 新增：处理自定义分类表单提交
// 🔧 修复：handleCustomCategorySubmit 方法中的ID处理
async handleCustomCategorySubmit(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const categoryData = {
    id: formData.get('categoryId') || null, // 修复：允许为null
    name: formData.get('categoryName').trim(),
    description: formData.get('categoryDescription').trim(),
    icon: formData.get('categoryIcon'),
    color: formData.get('categoryColor')
  };
  
  // 🔧 修复：验证数据时考虑新增模式
  const validation = this.validateCustomCategory(categoryData);
  if (!validation.valid) {
    showToast(validation.message, 'error');
    return;
  }
  
  try {
    showLoading(true);
    
    if (this.editingCustomCategory && categoryData.id) {
      // 编辑模式：有ID才进行更新
      await this.updateCustomCategory(categoryData);
      showToast('自定义分类更新成功', 'success');
    } else {
      // 新增模式：添加新的分类
      await this.addCustomCategory(categoryData);
      showToast('自定义分类添加成功', 'success');
    }
    
    // 重新加载数据
    await this.loadUserSearchSettings();
    await this.loadCategoriesData();
    
    // 关闭模态框
    this.closeModals();
    
  } catch (error) {
    console.error('保存自定义分类失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

  // 🔧 新增：验证自定义分类
// 🔧 修复：validateCustomCategory 方法 - 修改验证逻辑
validateCustomCategory(categoryData) {
  const rules = APP_CONSTANTS.VALIDATION_RULES.CATEGORY;
  
  // 🔧 修复：只验证非ID的必需字段
  const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
  
  // 检查必需字段（除了ID）
  for (const field of requiredFieldsForValidation) {
    if (!categoryData[field] || categoryData[field].trim() === '') {
      return { valid: false, message: `${field} 是必需的` };
    }
  }
  
  // 检查名称格式
  if (!rules.NAME_PATTERN.test(categoryData.name)) {
    return { valid: false, message: '分类名称格式不正确' };
  }
  
  // 检查颜色格式
  if (categoryData.color && !rules.COLOR_PATTERN.test(categoryData.color)) {
    return { valid: false, message: '颜色格式不正确' };
  }
  
  // 🔧 修复：只在新增时检查ID重复（编辑时跳过）
  if (!categoryData.id) {
    const generatedId = this.generateCategoryId(categoryData.name);
    if (this.allCategories.some(c => c.id === generatedId)) {
      return { valid: false, message: '分类名称已存在，请使用不同的名称' };
    }
  }
  
  // 检查是否超过限制
  if (!categoryData.id && this.customCategories.length >= APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES) {
    return { valid: false, message: `最多只能创建 ${APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES} 个自定义分类` };
  }
  
  return { valid: true };
}

  // 🔧 新增：生成分类ID
  generateCategoryId(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 15) + '_' + Date.now().toString(36);
  }

  // 🔧 新增：添加自定义分类
  async addCustomCategory(categoryData) {
    // 生成唯一ID
    categoryData.id = this.generateCategoryId(categoryData.name);
    categoryData.createdAt = Date.now();
    categoryData.isCustom = true;
    categoryData.isBuiltin = false;
    categoryData.order = 50; // 自定义分类排序权重
    
    // 添加到本地数组
    this.customCategories.push(categoryData);
    this.allCategories.push({ ...categoryData, isCustom: true, isBuiltin: false });
    
    // 保存到云端
    await this.saveCustomCategories();
  }

  // 🔧 新增：更新自定义分类
  async updateCustomCategory(categoryData) {
    const index = this.customCategories.findIndex(c => c.id === categoryData.id);
    if (index === -1) {
      throw new Error('未找到要更新的分类');
    }
    
    // 更新本地数据
    this.customCategories[index] = { ...this.customCategories[index], ...categoryData };
    
    const allIndex = this.allCategories.findIndex(c => c.id === categoryData.id);
    if (allIndex !== -1) {
      this.allCategories[allIndex] = { ...this.allCategories[allIndex], ...categoryData };
    }
    
    // 保存到云端
    await this.saveCustomCategories();
  }

  // 🔧 新增：编辑自定义分类
  editCustomCategory(categoryId) {
    const category = this.customCategories.find(c => c.id === categoryId);
    if (!category) {
      showToast('未找到指定的自定义分类', 'error');
      return;
    }
    
    this.showCustomCategoryModal(category);
  }

  // 🔧 新增：删除自定义分类
  async deleteCustomCategory(categoryId) {
    const category = this.customCategories.find(c => c.id === categoryId);
    if (!category) {
      showToast('未找到指定的自定义分类', 'error');
      return;
    }
    
    // 检查是否有搜索源使用此分类
    const sourcesUsingCategory = this.allSearchSources.filter(s => s.category === categoryId);
    if (sourcesUsingCategory.length > 0) {
      showToast(`无法删除分类"${category.name}"，因为有 ${sourcesUsingCategory.length} 个搜索源正在使用此分类`, 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义分类"${category.name}"吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      
      // 从本地数组中移除
      this.customCategories = this.customCategories.filter(c => c.id !== categoryId);
      this.allCategories = this.allCategories.filter(c => c.id !== categoryId);
      
      // 保存到云端
      await this.saveCustomCategories();
      
      // 重新加载页面
      await this.loadCategoriesData();
      
      showToast('自定义分类删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义分类失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：保存自定义搜索源到云端
// 🔧 修复4：同时修改 saveCustomSearchSources 方法保持一致
async saveCustomSearchSources() {
  const settings = {
    customSearchSources: this.customSearchSources,
    searchSources: this.enabledSources,
    customSourceCategories: this.customCategories // 统一字段名
  };
  
  console.log('保存自定义搜索源设置:', settings); // 添加调试日志
  
  await apiService.updateUserSettings(settings);
}


  // 🔧 新增：保存自定义分类到云端
// 🔧 修复3：修改保存自定义分类的方法，确保字段名一致
async saveCustomCategories() {
  const settings = {
    customSourceCategories: this.customCategories, // 统一使用这个字段名
    customSearchSources: this.customSearchSources,
    searchSources: this.enabledSources
  };
  
  console.log('保存自定义分类设置:', settings); // 添加调试日志
  
  await apiService.updateUserSettings(settings);
}

  // 🔧 新增：保存搜索源设置
// 🔧 修复5：修改 saveSearchSourcesSettings 方法
async saveSearchSourcesSettings() {
  const settings = {
    searchSources: this.enabledSources,
    customSearchSources: this.customSearchSources,
    customSourceCategories: this.customCategories // 统一字段名
  };
  
  console.log('保存搜索源设置:', settings); // 添加调试日志
  
  await apiService.updateUserSettings(settings);
  
  // 通知主页面更新站点导航
  window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
    detail: { newSources: this.enabledSources }
  }));
}

  // 🔧 新增：导出搜索源配置
  async exportSources() {
    try {
      const data = {
        builtinSources: this.builtinSearchSources,
        customSources: this.customSearchSources,
        enabledSources: this.enabledSources,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-sources-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('搜索源配置导出成功', 'success');
    } catch (error) {
      console.error('导出搜索源失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 🔧 新增：导出分类配置
  async exportCategories() {
    try {
      const data = {
        builtinCategories: this.builtinCategories,
        customCategories: this.customCategories,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `source-categories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('分类配置导出成功', 'success');
    } catch (error) {
      console.error('导出分类失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 🔧 修改：加载设置数据 - 移除搜索源管理（已独立为单独页面）
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

    } catch (error) {
      console.error('加载设置失败:', error);
      showToast('加载设置失败', 'error');
    }
  }

  // 🔧 修改：保存设置 - 移除搜索源相关逻辑
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
        maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
        maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10),
        allowAnalytics: !!ui.allowAnalytics,
        searchSuggestions: !!ui.searchSuggestions
      };
      
      await apiService.updateUserSettings(payload);
      
      // 立即应用主题设置
      if (payload.theme) {
        themeManager.setTheme(payload.theme);
      }
      
      // 🔧 清除搜索服务的用户设置缓存，确保下次搜索使用新设置
      if (searchService && searchService.clearUserSettingsCache) {
        searchService.clearUserSettingsCache();
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

  // 🔧 修改：收集设置时移除搜索源
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
    
    return settings;
  }

  // 🔧 修改：重置设置
  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    // 重置为默认设置
    const defaultSettings = {
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true
    };

    // 重置基础设置
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

  // 🔧 新增：根据ID获取搜索源
  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  // 🔧 新增：根据ID获取分类
  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
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
        customCategories: this.customCategories, // 🔧 新增：导出自定义分类
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
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
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
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
    const totalSourcesEl = document.getElementById('totalSources');
    const userLevelEl = document.getElementById('userLevel');

    if (totalSearchesEl) totalSearchesEl.textContent = this.searchHistory.length;
    if (totalFavoritesEl) totalFavoritesEl.textContent = this.favorites.length;
    if (totalSourcesEl) totalSourcesEl.textContent = this.allSearchSources.length;
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
    this.editingCustomCategory = null; // 🔧 重置编辑状态
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

export default EnhancedDashboardApp;