// main.js - 主页面导航站点代理支持版
// 版本: v3.1.0 - 导航站点支持代理访问

import { APP_CONSTANTS } from '../../core/constants.js';
import configManager from '../../core/config.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';
import networkUtils from '../../utils/network.js';
import authManager from '../../services/auth.js';
import themeManager from '../../services/theme.js';
import unifiedSearchManager from '../../components/search.js';
import favoritesManager from '../../components/favorites.js';
import searchSourcesAPI from '../../services/search-sources-api.js';
import emailVerificationService from '../../services/email-verification-service.js';
import { emailVerificationUI } from '../../components/email-verification-ui.js';
import proxyService from '../../services/proxy-service.js';

class MagnetSearchApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.CHECKING || 'checking';
    
    this.allSearchSources = [];
    this.allCategories = [];
    this.majorCategories = [];
    
    this.dataLoadStatus = {
      isLoading: false,
      hasLoaded: false,
      lastLoadTime: 0,
      retryCount: 0
    };
    
    this.performanceMetrics = {
      initTime: 0,
      searchCount: 0,
      errorCount: 0
    };
    
    this.init();
  }

  async init() {
    const startTime = performance.now();
    
    try {
      showLoading(true);
      console.log('🚀 初始化磁力快搜应用...');
      
      this.showConnectionStatus();
      await configManager.init();
      this.bindEvents();
      themeManager.init();
      await this.initEmailVerificationService();
      await this.checkAuthStatus();
      
      if (!this.currentUser) {
        await this.initForGuest();
      } else {
        await this.initForUser();
      }

      await this.testConnection();
      this.handleURLParams();
      
      this.performanceMetrics.initTime = performance.now() - startTime;
      this.isInitialized = true;
      this.hideConnectionStatus();
      
      console.log(`✅ 应用初始化完成 (${Math.round(this.performanceMetrics.initTime)}ms)`);
      
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
      this.updateConnectionStatus('连接失败');
      this.performanceMetrics.errorCount++;
      showToast('应用初始化失败,请刷新页面重试', 'error', 5000);
    } finally {
      showLoading(false);
    }
  }

  async initForGuest() {
    console.log('👤 初始化访客模式...');
    
    document.getElementById('loginModal').style.display = 'block';
    document.querySelector('.main-content').style.display = 'none';
    
    await this.loadMinimalFallbackData();
    await this.initSiteNavigation();
  }

  async initForUser() {
    console.log('👨‍💻 初始化用户模式...');
    
    document.querySelector('.main-content').style.display = 'block';
    
    try {
      searchSourcesAPI.setToken(this.getAuthToken());
      await this.initUserComponents();
      await this.loadUserData();
      this.updateUserUI();
    } catch (error) {
      console.error('用户模式初始化失败:', error);
      await this.handleUserInitError(error);
    }
  }

  getAuthToken() {
    return localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
  }

  async initUserComponents() {
    console.log('🔧 初始化用户组件...');
    
    await unifiedSearchManager.init();
    
    console.log('🔡 正在初始化代理服务...');
    await proxyService.init();
    
    if (proxyService.isProxyEnabled()) {
      console.log('✅ 代理服务已启用');
      showToast('代理模式已启用，可访问受限制的搜索源', 'success', 3000);
    } else {
      console.log('ℹ️ 代理服务未启用');
    }
    
    console.log('⭐ 正在初始化收藏管理器...');
    await favoritesManager.init();
    
    console.log('✅ 用户组件初始化完成');
  }

  async loadUserData() {
    console.log('📊 加载用户数据...');
    
    try {
      await Promise.all([
        this.loadSearchSourcesFromAPI(),
        this.loadUserFavorites()
      ]);
      
      await this.initSiteNavigation();
      
      console.log('✅ 用户数据加载完成');
    } catch (error) {
      console.error('加载用户数据失败:', error);
      await this.loadMinimalFallbackData();
      await this.initSiteNavigation();
      throw error;
    }
  }

  async loadUserFavorites() {
    try {
      if (favoritesManager.isInitialized) {
        console.log('正在加载用户收藏...');
        await favoritesManager.loadFavorites();
        console.log('收藏数据加载完成');
      }
    } catch (error) {
      console.error('加载收藏数据失败:', error);
    }
  }

  async handleUserInitError(error) {
    console.error('用户初始化失败，回退到访客模式:', error);
    
    this.currentUser = null;
    localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
    searchSourcesAPI.setToken(null);
    
    await this.initForGuest();
    showToast('用户数据加载失败，请重新登录', 'warning', 5000);
  }

  async loadSearchSourcesFromAPI() {
    if (this.dataLoadStatus.isLoading) {
      console.log('数据正在加载中，跳过重复请求');
      while (this.dataLoadStatus.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    const timeSinceLastLoad = Date.now() - this.dataLoadStatus.lastLoadTime;
    if (this.dataLoadStatus.hasLoaded && timeSinceLastLoad < 30000) {
      console.log('数据最近已加载，跳过重复加载');
      return;
    }

    this.dataLoadStatus.isLoading = true;
    const maxRetries = 3;
    let lastError = null;

    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        console.log(`从搜索源API加载数据... (尝试 ${retry + 1}/${maxRetries + 1})`);
        
        if (!searchSourcesAPI.token) {
          searchSourcesAPI.setToken(this.getAuthToken());
        }
        
        const [majorCategories, categories, sources] = await Promise.all([
          searchSourcesAPI.getMajorCategories().catch(err => {
            console.warn('获取大类失败:', err);
            return [];
          }),
          searchSourcesAPI.getSourceCategories({
            includeSystem: true
          }).catch(err => {
            console.warn('获取分类失败:', err);
            return [];
          }),
          searchSourcesAPI.getSearchSources({
            includeSystem: true,
            enabledOnly: false
          }).catch(err => {
            console.warn('获取搜索源失败:', err);
            return [];
          })
        ]);
        
        this.majorCategories = majorCategories || [];
        this.allCategories = categories || [];
        this.allSearchSources = sources || [];
        
        this.dataLoadStatus.hasLoaded = true;
        this.dataLoadStatus.lastLoadTime = Date.now();
        this.dataLoadStatus.retryCount = 0;
        
        console.log(`已加载 ${this.majorCategories.length} 个大类，${this.allCategories.length} 个分类，${this.allSearchSources.length} 个搜索源`);
        break;
        
      } catch (error) {
        lastError = error;
        this.dataLoadStatus.retryCount++;
        
        console.warn(`从API加载搜索源失败 (尝试 ${retry + 1}/${maxRetries + 1}):`, error);
        
        if (retry < maxRetries) {
          const delay = Math.pow(2, retry) * 1000;
          console.log(`等待 ${delay}ms 后重试...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    this.dataLoadStatus.isLoading = false;

    if (!this.dataLoadStatus.hasLoaded) {
      console.warn('从API加载搜索源失败，使用最小回退方案:', lastError);
      await this.loadMinimalFallbackData();
      showToast('数据加载失败，正在使用离线数据', 'warning', 3000);
    }
  }

  async loadMinimalFallbackData() {
    try {
      this.majorCategories = [
        {
          id: 'search_sources',
          name: '搜索源',
          icon: '🔍',
          description: '支持番号搜索的网站',
          requiresKeyword: true,
          displayOrder: 1,
          order: 1
        },
        {
          id: 'browse_sites',
          name: '浏览站点',
          icon: '🌐',
          description: '仅供访问,不参与搜索',
          requiresKeyword: false,
          displayOrder: 2,
          order: 2
        }
      ];

      this.allCategories = [
        {
          id: 'database',
          name: '番号资料站',
          icon: '📚',
          description: '提供详细的番号信息、封面和演员资料',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 1,
          isSystem: true,
          displayOrder: 1
        },
        {
          id: 'streaming',
          name: '在线播放平台',
          icon: '🎥',
          description: '提供在线观看和下载服务',
          majorCategoryId: 'browse_sites',
          defaultSearchable: false,
          defaultSiteType: 'browse',
          searchPriority: 5,
          isSystem: true,
          displayOrder: 1
        },
        {
          id: 'torrent',
          name: '磁力搜索',
          icon: '🧲',
          description: '提供磁力链接和种子文件',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 3,
          isSystem: true,
          displayOrder: 3
        }
      ];

      this.allSearchSources = [
        {
          id: 'javbus',
          name: 'JavBus',
          subtitle: '番号+磁力一体站,信息完善',
          icon: '🎬',
          categoryId: 'database',
          urlTemplate: 'https://www.javbus.com/search/{keyword}',
          searchable: true,
          siteType: 'search',
          searchPriority: 1,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true
        },
        {
          id: 'javdb',
          name: 'JavDB',
          subtitle: '极简风格番号资料站,轻量快速',
          icon: '📚',
          categoryId: 'database',
          urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
          searchable: true,
          siteType: 'search',
          searchPriority: 2,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true
        }
      ];

      this.dataLoadStatus.hasLoaded = true;
      this.dataLoadStatus.lastLoadTime = Date.now();

      console.log('已加载最小回退数据');
      
    } catch (error) {
      console.error('加载回退数据失败:', error);
      this.majorCategories = [];
      this.allCategories = [];
      this.allSearchSources = [];
    }
  }

  async initEmailVerificationService() {
    try {
      console.log('初始化邮箱验证服务...');
      
      if (emailVerificationService && emailVerificationUI) {
        console.log('邮箱验证服务初始化成功');
        window.emailVerificationService = emailVerificationService;
        window.emailVerificationUI = emailVerificationUI;
      } else {
        console.warn('邮箱验证服务初始化不完整');
      }
      
    } catch (error) {
      console.error('邮箱验证服务初始化失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  /**
   * 🔴 关键修改：初始化站点导航，支持代理访问
   */
  async initSiteNavigation() {
    try {
      if (this.allSearchSources.length === 0 && !this.dataLoadStatus.hasLoaded) {
        await this.loadSearchSourcesFromAPI();
      }
      
      this.renderSiteNavigation(this.allSearchSources);
    } catch (error) {
      console.error('初始化站点导航失败:', error);
      const sitesSection = document.getElementById('sitesSection');
      if (sitesSection) {
        sitesSection.innerHTML = `
          <h2>资源站点导航</h2>
          <div class="empty-state">
            <p>加载站点数据失败</p>
            <button onclick="window.app && window.app.loadSearchSourcesFromAPI().then(() => window.app.initSiteNavigation())" class="btn-primary">重新加载</button>
          </div>
        `;
      }
    }
  }

  /**
   * 🔴 关键修改：渲染站点导航，所有链接支持代理
   */
  renderSiteNavigation(sourcesToDisplay = null) {
    const sitesSection = document.getElementById('sitesSection');
    if (!sitesSection) return;

    const sources = sourcesToDisplay || this.allSearchSources;

    if (sources.length === 0) {
      sitesSection.innerHTML = `
        <h2>资源站点导航</h2>
        <div class="empty-state">
          <p>暂无可用的搜索源</p>
          <p>请在个人中心搜索源管理页面添加搜索源</p>
          <button onclick="window.app && window.app.navigateToDashboard()" class="btn-primary">前往设置</button>
        </div>
      `;
      return;
    }

    const majorCategories = this.majorCategories.sort((a, b) => (a.order || a.displayOrder || 999) - (b.order || b.displayOrder || 999));
    
    // 🔴 添加代理状态显示
    const proxyStatus = proxyService.getProxyStatus();
    const proxyStatusHTML = proxyStatus.enabled ? `
      <div class="proxy-status-banner">
        <span class="proxy-indicator active">🔒</span>
        <span>代理模式已启用 - 所有导航链接将通过代理访问</span>
        <button onclick="window.app && window.app.toggleNavigationProxy()" class="btn-secondary">关闭代理</button>
      </div>
    ` : `
      <div class="proxy-status-banner disabled">
        <span class="proxy-indicator">🔓</span>
        <span>代理模式未启用 - 导航链接将直接访问</span>
        <button onclick="window.app && window.app.toggleNavigationProxy()" class="btn-primary">启用代理</button>
      </div>
    `;
    
    let navigationHTML = `
      <h2>资源站点导航</h2>
      ${proxyStatusHTML}
    `;

    majorCategories.forEach(majorCategory => {
      const categorySourcesWithSubcategories = this.getSourcesByMajorCategoryWithSubcategories(sources, majorCategory.id);
      
      if (categorySourcesWithSubcategories.length === 0) return;

      navigationHTML += `
        <div class="major-category-section">
          <h3 class="major-category-title">
            ${majorCategory.icon} ${majorCategory.name}
            <small>(${categorySourcesWithSubcategories.length}个站点)</small>
          </h3>
          <p class="major-category-desc">${majorCategory.description}</p>
          
          <div class="subcategories-container">
            ${this.renderSubcategoriesWithSources(categorySourcesWithSubcategories, majorCategory.id)}
          </div>
        </div>
      `;
    });
    
    sitesSection.innerHTML = navigationHTML;
  }

  getSourcesByMajorCategoryWithSubcategories(sources, majorCategoryId) {
    return sources.filter(source => {
      const sourceCategoryId = source.categoryId || source.category;
      const category = this.allCategories.find(cat => cat.id === sourceCategoryId);
      
      if (!category) {
        console.warn(`源 ${source.id} 的分类 ${sourceCategoryId} 未找到`);
        return false;
      }
      
      const categoryMajorId = category.majorCategoryId || category.majorCategory;
      return categoryMajorId === majorCategoryId;
    });
  }

  renderSubcategoriesWithSources(sources, majorCategoryId) {
    const sourcesBySubcategory = {};
    
    sources.forEach(source => {
      const sourceCategoryId = source.categoryId || source.category;
      const subcategory = this.allCategories.find(cat => cat.id === sourceCategoryId);
      
      if (subcategory) {
        if (!sourcesBySubcategory[subcategory.id]) {
          sourcesBySubcategory[subcategory.id] = {
            category: subcategory,
            sources: []
          };
        }
        sourcesBySubcategory[subcategory.id].sources.push(source);
      }
    });

    const sortedSubcategories = Object.values(sourcesBySubcategory)
      .sort((a, b) => {
        const orderA = a.category.displayOrder || a.category.order || 999;
        const orderB = b.category.displayOrder || b.category.order || 999;
        return orderA - orderB;
      });

    return sortedSubcategories.map(({ category, sources }) => {
      const isSearchable = majorCategoryId === 'search_sources';
      
      return `
        <div class="subcategory-section">
          <h4 class="subcategory-title">
            ${category.icon} ${category.name}
            <span class="source-count">${sources.length}个站点</span>
            ${isSearchable ? '<span class="searchable-indicator">参与搜索</span>' : '<span class="browse-indicator">仅浏览</span>'}
          </h4>
          <p class="subcategory-desc">${category.description || ''}</p>
          
          <div class="sites-grid">
            ${sources.map(source => this.renderSiteItem(source, isSearchable)).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * 🔴 关键修改：渲染站点项，支持代理访问
   */
  renderSiteItem(source, isSearchable) {
    let isEnabled = true;
    
    try {
      if (unifiedSearchManager.isInitialized) {
        // 可以添加检查逻辑
      }
    } catch (error) {
      console.warn('检查搜索源启用状态失败:', error);
    }

    const statusClass = isEnabled ? 'enabled' : 'disabled';
    const statusText = isEnabled ? '可用' : '未启用';
    
    const badges = [];
    
    if (!isSearchable) {
      badges.push('<span class="non-searchable-badge">仅浏览</span>');
    } else if (source.searchPriority && source.searchPriority <= 3) {
      badges.push('<span class="priority-badge">优先</span>');
    }
    
    // 🔴 关键修改：构建站点URL，根据代理状态决定是否使用代理
    let siteUrl;
    try {
      let testUrl = source.urlTemplate;
      
      if (testUrl.includes('{keyword}')) {
        testUrl = testUrl.replace('{keyword}', 'temp');
      }
      
      const urlObj = new URL(testUrl);
      siteUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      
      if (urlObj.port) {
        siteUrl += `:${urlObj.port}`;
      }
      
      // 🔴 关键：如果代理启用，转换为代理URL
      if (proxyService.isProxyEnabled()) {
        siteUrl = proxyService.convertToProxyUrl(siteUrl);
        badges.push('<span class="proxy-badge">🔒</span>');
      }
      
    } catch (error) {
      console.warn('解析站点URL失败:', source.urlTemplate, error);
      siteUrl = source.urlTemplate.replace('{keyword}', '');
    }
    
    return `
      <a href="${siteUrl}" 
         class="site-item ${isSearchable ? 'searchable' : 'browse-only'}"
         target="_blank"
         data-source-id="${source.id}"
         data-original-url="${source.urlTemplate}">
        <div class="site-info">
          <div class="site-header">
            <strong>${source.icon || '📄'} ${source.name}</strong>
            <div class="site-badges">
              ${source.isCustom || !source.isSystem ? '<span class="custom-badge">自定义</span>' : ''}
              ${badges.join('')}
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
          <span class="site-subtitle">${source.subtitle || ''}</span>
        </div>
      </a>
    `;
  }

  /**
   * 🔴 新增：切换导航代理模式
   */
  async toggleNavigationProxy() {
    try {
      const result = await proxyService.toggleProxy();
      if (result.success) {
        // 重新渲染导航，更新所有链接
        this.renderSiteNavigation(this.allSearchSources);
        showToast(result.message, 'success');
      } else {
        showToast(`代理切换失败: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('切换导航代理失败:', error);
      showToast(`代理切换异常: ${error.message}`, 'error');
    }
  }

  showConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
      status.style.display = 'flex';
      this.updateConnectionStatus('正在连接...');
    }
  }

  hideConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    const connectedStatus = APP_CONSTANTS.CONNECTION_STATUS?.CONNECTED || 'connected';
    if (status && this.connectionStatus === connectedStatus) {
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    }
  }

  updateConnectionStatus(text) {
    const statusText = document.querySelector('#connectionStatus .status-text');
    const indicator = document.querySelector('#connectionStatus .status-indicator');
    
    if (statusText) statusText.textContent = text;
    
    if (indicator) {
      indicator.className = `status-indicator ${this.connectionStatus}`;
    }
  }

  async testConnection() {
    try {
      this.updateConnectionStatus('检查连接...');
      const config = configManager.getConfig();
      const result = await networkUtils.testAPIConnection(config.BASE_URL);
      
      const connectedStatus = APP_CONSTANTS.CONNECTION_STATUS?.CONNECTED || 'connected';
      const warningStatus = APP_CONSTANTS.CONNECTION_STATUS?.WARNING || 'warning';
      const errorStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
      
      if (result.connected) {
        this.connectionStatus = connectedStatus;
        this.updateConnectionStatus('连接正常');
        console.log('API连接正常');
      } else {
        this.connectionStatus = warningStatus;
        this.updateConnectionStatus('连接不稳定');
        console.warn('API连接不稳定');
      }
    } catch (error) {
      this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
      this.updateConnectionStatus('连接失败');
      this.performanceMetrics.errorCount++;
      console.error('API连接失败:', error);
    }
  }

  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = searchQuery;
        if (unifiedSearchManager.isInitialized) {
          setTimeout(() => {
            unifiedSearchManager.performSearch();
            this.performanceMetrics.searchCount++;
          }, 500);
        }
      }
    }
  }

  bindEvents() {
    this.bindModalEvents();
    this.bindKeyboardShortcuts();
    this.bindNetworkEvents();
    
    document.addEventListener('searchResultsRendered', () => {
      this.performanceMetrics.searchCount++;
    });

    this.bindEmailVerificationEvents();
  }

  bindEmailVerificationEvents() {
    window.addEventListener('emailChanged', (event) => {
      console.log('用户邮箱已更改:', event.detail);
      if (this.currentUser) {
        this.currentUser.email = event.detail.newEmail;
        this.updateUserUI();
      }
    });

    window.addEventListener('accountDeleted', () => {
      console.log('用户账户已删除');
      this.handleAccountDeleted();
    });

    window.addEventListener('verificationExpired', (event) => {
      console.log('验证码已过期:', event.detail);
      showToast('验证码已过期,请重新获取', 'warning');
    });
  }

  async handleAccountDeleted() {
    try {
      this.currentUser = null;
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
      
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.cleanup();
      }
      
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      showToast('账户已删除,正在跳转...', 'info');
      
      setTimeout(() => {
        window.location.href = './index.html';
      }, 2000);
      
    } catch (error) {
      console.error('处理账户删除失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
      showToast('请填写用户名和密码', 'error');
      return;
    }

    try {
      showLoading(true, '正在登录...');
      
      const result = await authManager.login(username, password);
      
      if (result.success) {
        this.currentUser = result.user;
        console.log('登录成功:', this.currentUser.username);
        
        this.closeModals();
        document.querySelector('.main-content').style.display = 'block';
        
        this.dataLoadStatus.hasLoaded = false;
        this.dataLoadStatus.lastLoadTime = 0;
        
        searchSourcesAPI.setToken(result.token || this.getAuthToken());
        
        await this.initUserComponents();
        await this.loadUserData();
        this.updateUserUI();
        this.handleURLParams();
        
        document.getElementById('loginForm').reset();
        this.performanceMetrics.searchCount = 0;
        
        showToast('登录成功!', 'success');
      }
    } catch (error) {
      console.error('登录失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('登录失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  bindModalEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const closeBtns = document.querySelectorAll('.close');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const showPasswordReset = document.getElementById('showPasswordReset');

    if (loginBtn) loginBtn.addEventListener('click', () => this.showLoginModal());
    if (showRegister) showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterModal();
    });
    if (showLogin) showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginModal();
    });
    
    if (showPasswordReset) showPasswordReset.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('loginModal').style.display = 'none';
      emailVerificationUI.showPasswordResetModal();
    });

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });

    const dashboardLink = document.querySelector('a[onclick*="navigateToDashboard"]');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToDashboard();
      });
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModals();
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    });
  }

  bindNetworkEvents() {
    networkUtils.onNetworkChange((isOnline) => {
      if (isOnline && this.isInitialized) {
        setTimeout(() => {
          this.testConnection();
        }, 1000);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isInitialized) {
        setTimeout(() => {
          this.checkConnectionStatus();
        }, 100);
      }
    });
  }

  showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (registerModal) registerModal.style.display = 'none';
    if (loginModal) {
      loginModal.style.display = 'block';
      setTimeout(() => {
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput) usernameInput.focus();
      }, 100);
    }
  }

  showRegisterModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) {
      registerModal.style.display = 'block';
      setTimeout(() => {
        const usernameInput = document.getElementById('regUsername');
        if (usernameInput) usernameInput.focus();
      }, 100);
    }
  }

  closeModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
  }

  async handleRegister(event) {
    event.preventDefault();
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('submitting');
      submitBtn.textContent = '注册中...';
    }
    
    const username = document.getElementById('regUsername')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;

    if (!username || !email || !password || !confirmPassword) {
      showToast('请填写所有字段', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    if (password.length < 6) {
      showToast('密码长度至少6个字符', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('请输入有效的邮箱地址', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    try {
      this.closeModals();
      
      emailVerificationUI.verificationData = {
        username,
        email,
        password
      };
      
      emailVerificationUI.showRegistrationVerificationModal(email);
      
    } catch (error) {
      console.error('注册流程启动失败:', error);
    try {
      this.closeModals();
      
      emailVerificationUI.verificationData = {
        username,
        email,
        password
      };
      
      emailVerificationUI.showRegistrationVerificationModal(email);
      
    } catch (error) {
      console.error('注册流程启动失败:', error);
      showToast('注册失败: ' + error.message, 'error');
      this.resetSubmitButton(submitBtn);
      this.performanceMetrics.errorCount++;
    } finally {
      this.resetSubmitButton(submitBtn);
    }
  }
  }

  resetSubmitButton(submitBtn) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('submitting');
      submitBtn.textContent = '注册并验证邮箱';
    }
  }

  async checkAuthStatus() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      console.log('未找到认证token');
      return;
    }

    try {
      const isValid = await authManager.verifyToken();
      if (isValid) {
        this.currentUser = authManager.getCurrentUser();
        console.log('用户认证成功:', this.currentUser.username);
      } else {
        console.log('Token验证失败,已清除');
      }
    } catch (error) {
      console.error('验证token失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');
    const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');

    if (this.currentUser) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (username) username.textContent = this.currentUser.username;
      if (syncFavoritesBtn) syncFavoritesBtn.style.display = 'inline-block';
      
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = () => this.logout();
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (userInfo) userInfo.style.display = 'none';
      if (syncFavoritesBtn) syncFavoritesBtn.style.display = 'none';
    }
  }

  async logout() {
    try {
      showLoading(true, '正在退出...');
      
      await authManager.logout();
      this.currentUser = null;
      
      searchSourcesAPI.setToken(null);
      this.updateUserUI();
      
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.cleanup();
      }
      
      this.dataLoadStatus.hasLoaded = false;
      this.dataLoadStatus.lastLoadTime = 0;
      this.dataLoadStatus.retryCount = 0;
      
      this.allSearchSources = [];
      this.allCategories = [];
      this.majorCategories = [];
      
      await this.initForGuest();
      
      this.performanceMetrics = {
        initTime: this.performanceMetrics.initTime,
        searchCount: 0,
        errorCount: 0
      };
      
      showToast('已退出登录', 'info');
      
    } catch (error) {
      console.error('退出登录失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('退出登录失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async navigateToDashboard() {
    try {
      showLoading(true);
      console.log('导航到Dashboard');

      const isDev = isDevEnv();
      const dashboardUrl = isDev ? './dashboard.html' : './dashboard';
      
      window.location.href = dashboardUrl;

    } catch (error) {
      console.error('跳转到dashboard失败:', error);
      showToast('跳转失败: ' + error.message, 'error');
      this.performanceMetrics.errorCount++;
    } finally {
      showLoading(false);
    }
  }

  checkConnectionStatus() {
    if (this.isInitialized) {
      this.testConnection();
    }
  }

  getMajorCategoryForSource(source) {
    if (!source) return null;
    
    const categoryId = source.categoryId || source.category;
    const category = this.allCategories.find(cat => cat.id === categoryId);
    
    if (!category) return null;
    
    return category.majorCategoryId || category.majorCategory;
  }

  getPerformanceStats() {
    const stats = {
      ...this.performanceMetrics,
      uptime: this.isInitialized ? performance.now() - this.performanceMetrics.initTime : 0,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    };
    
    const totalOperations = stats.searchCount;
    stats.errorRate = totalOperations > 0 ? (stats.errorCount / totalOperations * 100).toFixed(2) + '%' : '0%';
    
    return stats;
  }

  exportAppState() {
    return {
      isInitialized: this.isInitialized,
      connectionStatus: this.connectionStatus,
      currentUser: this.currentUser ? {
        username: this.currentUser.username,
        email: this.currentUser.email
      } : null,
      dataLoadStatus: this.dataLoadStatus,
      performanceStats: this.getPerformanceStats(),
      proxyStatus: proxyService.getProxyStatus(),
      timestamp: Date.now(),
      version: APP_CONSTANTS.DEFAULT_VERSION || '3.1.0'
    };
  }
}

window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  if (window.app && window.app.performanceMetrics) {
    window.app.performanceMetrics.errorCount++;
  }
  const errorStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
  if (window.app && window.app.connectionStatus !== errorStatus) {
    showToast('应用出现错误,请刷新页面重试', 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  if (window.app && window.app.performanceMetrics) {
    window.app.performanceMetrics.errorCount++;
  }
  if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
    if (window.app && window.app.currentUser) {
      window.app.logout();
    }
  }
});

export default MagnetSearchApp;