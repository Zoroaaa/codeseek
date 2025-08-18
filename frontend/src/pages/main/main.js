// 主应用入口 - 优化版本，从constants.js获取搜索源
import { APP_CONSTANTS } from '.../core/constants.js';
import configManager from '.../core/config.js';
import { showLoading, showToast } from '.../utils/dom.js';
import { isDevEnv } from '.../utils/helpers.js';
import networkUtils from '.../utils/network.js';
import authManager from '.../services/auth.js';
import themeManager from '.../services/theme.js';
import searchManager from '.../components/search.js';
import favoritesManager from '.../components/favorites.js';
import apiService from '.../services/api.js';

class MagnetSearchApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.CHECKING;
    
    // 🔧 新增：搜索源和分类管理
    this.allSearchSources = [];
    this.allCategories = [];
    this.enabledSources = [];
    this.customSearchSources = [];
    this.customCategories = [];
    
    this.init();
  }

  async init() {
    try {
      showLoading(true);
      console.log('🚀 初始化磁力快搜应用...');
      
      // 显示连接状态
      this.showConnectionStatus();
      
      // 初始化配置
      await configManager.init();
      
      // 🔧 优化：从constants.js加载内置搜索源和分类
      this.loadBuiltinData();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题（仅从localStorage读取主题设置）
      themeManager.init();
      
      // 检查认证状态
      await this.checkAuthStatus();
      
      // 若未认证，打开登录模态
      if (!this.currentUser) {
        document.getElementById('loginModal').style.display = 'block';
        document.querySelector('.main-content').style.display = 'none';
      } else {
        document.querySelector('.main-content').style.display = 'block';
        // 已登录用户初始化组件
        await this.initComponents();
        // 🔧 加载用户的搜索源设置
        await this.loadUserSearchSettings();
      }

      // 🔧 优化：初始化站点导航
      await this.initSiteNavigation();

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数（如搜索关键词）
      this.handleURLParams();
      
      this.isInitialized = true;
      this.hideConnectionStatus();
      console.log('✅ 应用初始化完成');
      
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.ERROR;
      this.updateConnectionStatus('连接失败');
      showToast('应用初始化失败，请刷新页面重试', 'error', 5000);
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：从constants.js加载内置数据
  loadBuiltinData() {
    try {
      // 加载内置搜索源
      const builtinSources = APP_CONSTANTS.SEARCH_SOURCES.map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      
      // 加载内置分类
      const builtinCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(category => ({
        ...category,
        isBuiltin: true,
        isCustom: false
      }));
      
      console.log(`从constants.js加载了 ${builtinSources.length} 个内置搜索源和 ${builtinCategories.length} 个内置分类`);
      
      // 初始化数据
      this.allSearchSources = [...builtinSources];
      this.allCategories = [...builtinCategories];
      
      // 设置默认启用的搜索源
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      
    } catch (error) {
      console.error('加载内置数据失败:', error);
      // 使用空数组作为后备
      this.allSearchSources = [];
      this.allCategories = [];
      this.enabledSources = [];
    }
  }

  // 🔧 新增：加载用户的搜索源设置
  async loadUserSearchSettings() {
    if (!this.currentUser) return;
    
    try {
      const userSettings = await apiService.getUserSettings();
      
      // 加载用户的自定义搜索源和分类
      this.customSearchSources = userSettings.customSearchSources || [];
      this.customCategories = userSettings.customSourceCategories || [];
      this.enabledSources = userSettings.searchSources || APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      
      // 合并内置和自定义数据
      this.allSearchSources = [
        ...APP_CONSTANTS.SEARCH_SOURCES.map(s => ({ ...s, isBuiltin: true, isCustom: false })),
        ...this.customSearchSources.map(s => ({ ...s, isBuiltin: false, isCustom: true }))
      ];
      
      this.allCategories = [
        ...Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(c => ({ ...c, isBuiltin: true, isCustom: false })),
        ...this.customCategories.map(c => ({ ...c, isBuiltin: false, isCustom: true }))
      ];
      
      console.log(`用户设置：启用 ${this.enabledSources.length} 个搜索源，包含 ${this.customSearchSources.length} 个自定义源`);
      
    } catch (error) {
      console.warn('加载用户搜索源设置失败，使用默认设置:', error);
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
    }
  }

  // 🔧 优化：初始化站点导航
  async initSiteNavigation() {
    try {
      // 使用当前启用的搜索源
      this.renderSiteNavigation(this.enabledSources);
    } catch (error) {
      console.error('初始化站点导航失败:', error);
      // 出错时使用默认配置
      this.renderSiteNavigation(APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources);
    }
  }

  // 🔧 优化：渲染站点导航
  renderSiteNavigation(enabledSourceIds) {
    const sitesSection = document.getElementById('sitesSection');
    if (!sitesSection) return;

    // 过滤出用户启用的搜索源
    const enabledSources = this.allSearchSources.filter(source => 
      enabledSourceIds.includes(source.id)
    );

    // 如果没有启用的搜索源，显示提示
    if (enabledSources.length === 0) {
      sitesSection.innerHTML = `
        <h2>🌐 资源站点导航</h2>
        <div class="empty-state">
          <p>暂无可用的搜索源</p>
          <p>请在个人中心搜索源管理页面启用搜索源</p>
          <button onclick="window.app && window.app.navigateToDashboard()" class="btn-primary">前往设置</button>
        </div>
      `;
      return;
    }

    // 按分类组织搜索源
    const sourcesByCategory = this.groupSourcesByCategory(enabledSources);

    // 生成HTML
    let navigationHTML = '<h2>🌐 资源站点导航</h2><div class="sites-grid">';
    
    // 按分类顺序渲染
    this.allCategories
      .filter(category => sourcesByCategory[category.id] && sourcesByCategory[category.id].length > 0)
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .forEach(category => {
        const sources = sourcesByCategory[category.id];
        navigationHTML += `
          <div class="site-category">
            <h3 style="color: ${category.color || '#6b7280'}">${category.icon} ${category.name}</h3>
            <div class="site-list">
              ${sources.map(source => `
                <a href="${source.urlTemplate.replace('{keyword}', 'search')}" target="_blank" class="site-item" rel="noopener noreferrer">
                  <div class="site-info">
                    <strong>${source.icon} ${source.name}</strong>
                    <span>${source.subtitle}</span>
                  </div>
                </a>
              `).join('')}
            </div>
          </div>
        `;
      });
    
    navigationHTML += '</div>';
    sitesSection.innerHTML = navigationHTML;
  }

  // 🔧 新增：按分类组织搜索源
  groupSourcesByCategory(sources) {
    const grouped = {};
    
    sources.forEach(source => {
      const categoryId = source.category || 'others';
      if (!grouped[categoryId]) {
        grouped[categoryId] = [];
      }
      grouped[categoryId].push(source);
    });
    
    // 按优先级排序每个分类内的搜索源
    Object.keys(grouped).forEach(categoryId => {
      grouped[categoryId].sort((a, b) => {
        if (a.isBuiltin && b.isBuiltin) {
          return (a.priority || 999) - (b.priority || 999);
        }
        if (a.isBuiltin && !b.isBuiltin) return -1;
        if (!a.isBuiltin && b.isBuiltin) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    });
    
    return grouped;
  }

  // 初始化组件
  async initComponents() {
    try {
      // 初始化搜索管理器
      await searchManager.init();
      
      // 初始化收藏管理器
      await favoritesManager.init();
      
      console.log('✅ 组件初始化完成');
    } catch (error) {
      console.error('组件初始化失败:', error);
    }
  }

  // 显示连接状态
  showConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
      status.style.display = 'flex';
      this.updateConnectionStatus('正在连接...');
    }
  }

  // 隐藏连接状态
  hideConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status && this.connectionStatus === APP_CONSTANTS.CONNECTION_STATUS.CONNECTED) {
      setTimeout(() => {
        status.style.display = 'none';
      }, 2000);
    }
  }

  // 更新连接状态
  updateConnectionStatus(text) {
    const statusText = document.querySelector('#connectionStatus .status-text');
    const indicator = document.querySelector('#connectionStatus .status-indicator');
    
    if (statusText) statusText.textContent = text;
    
    if (indicator) {
      indicator.className = `status-indicator ${this.connectionStatus}`;
    }
  }

  // 测试连接
  async testConnection() {
    try {
      this.updateConnectionStatus('检查连接...');
      const config = configManager.getConfig();
      const result = await networkUtils.testAPIConnection(config.BASE_URL);
      
      if (result.connected) {
        this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.CONNECTED;
        this.updateConnectionStatus('连接正常');
        console.log('✅ API连接正常');
      } else {
        this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.WARNING;
        this.updateConnectionStatus('连接不稳定');
        console.warn('⚠️ API连接不稳定');
      }
    } catch (error) {
      this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.ERROR;
      this.updateConnectionStatus('连接失败');
      console.error('❌ API连接失败:', error);
    }
  }

  // 处理URL参数
  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = searchQuery;
        // 如果已初始化搜索管理器，则自动执行搜索
        if (searchManager.isInitialized) {
          setTimeout(() => {
            searchManager.performSearch();
          }, 500);
        }
      }
    }
  }

  // 绑定事件
  bindEvents() {
    // 模态框相关
    this.bindModalEvents();

    // 全局键盘快捷键
    this.bindKeyboardShortcuts();

    // 网络状态监听
    this.bindNetworkEvents();
    
    // 🔧 新增：监听搜索源变更事件
    this.bindSearchSourcesChangeEvent();
  }

  // 🔧 新增：绑定搜索源变更事件监听
  bindSearchSourcesChangeEvent() {
    window.addEventListener('searchSourcesChanged', async (event) => {
      console.log('检测到搜索源设置变更，更新站点导航');
      try {
        // 更新启用的搜索源列表
        this.enabledSources = event.detail.newSources;
        
        // 重新渲染站点导航
        this.renderSiteNavigation(this.enabledSources);
        showToast('站点导航已更新', 'success', 2000);
      } catch (error) {
        console.error('更新站点导航失败:', error);
      }
    });
  }

  // 绑定模态框事件
  bindModalEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const closeBtns = document.querySelectorAll('.close');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');

    if (loginBtn) loginBtn.addEventListener('click', () => this.showLoginModal());
    if (showRegister) showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterModal();
    });
    if (showLogin) showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginModal();
    });

    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });

    // Dashboard链接
    const dashboardLink = document.querySelector('a[onclick*="navigateToDashboard"]');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToDashboard();
      });
    }

    // 表单提交
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
  }

  // 绑定键盘快捷键
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Escape 关闭模态框
      if (e.key === 'Escape') {
        this.closeModals();
      }
    });
  }

  // 绑定网络事件
  bindNetworkEvents() {
    networkUtils.onNetworkChange((isOnline) => {
      if (isOnline && this.isInitialized) {
        setTimeout(() => {
          this.testConnection();
        }, 1000);
      }
    });

    // 页面可见性变化处理
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isInitialized) {
        setTimeout(() => {
          this.checkConnectionStatus();
        }, 100);
      }
    });
  }

  // 显示登录模态框
  showLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (registerModal) registerModal.style.display = 'none';
    if (loginModal) {
      loginModal.style.display = 'block';
      // 聚焦用户名输入框
      setTimeout(() => {
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput) usernameInput.focus();
      }, 100);
    }
  }

  // 显示注册模态框
  showRegisterModal() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) {
      registerModal.style.display = 'block';
      // 聚焦用户名输入框
      setTimeout(() => {
        const usernameInput = document.getElementById('regUsername');
        if (usernameInput) usernameInput.focus();
      }, 100);
    }
  }

  // 关闭模态框
  closeModals() {
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    
    if (loginModal) loginModal.style.display = 'none';
    if (registerModal) registerModal.style.display = 'none';
  }

  // 🔧 修改：用户登录后更新站点导航
  async handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
      showToast('请填写用户名和密码', 'error');
      return;
    }

    try {
      const result = await authManager.login(username, password);
      
      if (result.success) {
        this.currentUser = result.user;
        this.updateUserUI();
        
        // 显示主内容区域
        document.querySelector('.main-content').style.display = 'block';
        
        // 关闭模态框
        this.closeModals();
        
        // 登录后初始化组件
        await this.initComponents();
        
        // 🔧 新增：重新加载用户搜索源设置并更新站点导航
        await this.loadUserSearchSettings();
        await this.initSiteNavigation();
        
        // 处理URL参数（如搜索查询）
        this.handleURLParams();
        
        // 清空登录表单
        document.getElementById('loginForm').reset();
      }
    } catch (error) {
      console.error('登录失败:', error);
    }
  }

  // 处理注册
  async handleRegister(event) {
    event.preventDefault();
    
    // 添加防止重复提交机制
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('submitting');
      const span = document.createElement('span');
      span.textContent = '注册中...';
      submitBtn.innerHTML = '';
      submitBtn.appendChild(span);
    }
    
    const username = document.getElementById('regUsername')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;

    // 客户端验证
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

    try {
      const result = await authManager.register(username, email, password);
      
      if (result.success) {
        showToast('注册成功，请登录', 'success');
        this.showLoginModal();
        
        // 清空注册表单
        document.getElementById('registerForm').reset();
        
        // 预填用户名到登录表单
        const loginUsername = document.getElementById('loginUsername');
        if (loginUsername) loginUsername.value = username;
      }
    } catch (error) {
      console.error('注册失败:', error);
    } finally {
      this.resetSubmitButton(submitBtn);
    }
  }

  // 重置提交按钮状态
  resetSubmitButton(submitBtn) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('submitting');
      submitBtn.textContent = '注册';
    }
  }

  // 检查认证状态
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
        this.updateUserUI();
        console.log('✅ 用户认证成功:', this.currentUser.username);
      } else {
        console.log('Token验证失败，已清除');
      }
    } catch (error) {
      console.error('验证token失败:', error);
    }
  }

  // 更新用户界面
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
      
      // 绑定退出登录事件
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

  // 退出登录
  async logout() {
    try {
      await authManager.logout();
      this.currentUser = null;
      
      // 更新UI
      this.updateUserUI();
      
      // 清空组件数据
      if (searchManager.isInitialized) {
        searchManager.searchHistory = [];
        searchManager.currentResults = [];
        searchManager.renderHistory();
        searchManager.clearResults();
      }
      
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      // 🔧 新增：重置为默认搜索源设置并更新站点导航
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      this.customSearchSources = [];
      this.customCategories = [];
      this.allSearchSources = APP_CONSTANTS.SEARCH_SOURCES.map(s => ({ 
        ...s, 
        isBuiltin: true, 
        isCustom: false 
      }));
      this.allCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(c => ({ 
        ...c, 
        isBuiltin: true, 
        isCustom: false 
      }));
      
      await this.initSiteNavigation();
      
      // 显示登录模态框
      this.showLoginModal();
      
      // 隐藏主界面
      document.querySelector('.main-content').style.display = 'none';
      
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  }

  // 导航到Dashboard
  async navigateToDashboard() {
    try {
      showLoading(true);
      console.log('🏠 导航到Dashboard');

      // 根据环境决定URL格式
      const isDev = isDevEnv();
      const dashboardUrl = isDev ? './dashboard.html' : './dashboard';
      
      window.location.href = dashboardUrl;

    } catch (error) {
      console.error('跳转到dashboard失败:', error);
      showToast('跳转失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 检查连接状态
  checkConnectionStatus() {
    if (this.isInitialized) {
      this.testConnection();
    }
  }

  // 🔧 新增：获取当前启用的搜索源
  getEnabledSources() {
    return this.allSearchSources.filter(source => 
      this.enabledSources.includes(source.id)
    );
  }

  // 🔧 新增：获取指定分类的搜索源
  getSourcesByCategory(categoryId) {
    return this.allSearchSources.filter(source => 
      source.category === categoryId && this.enabledSources.includes(source.id)
    );
  }

  // 🔧 新增：根据ID获取搜索源
  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  // 🔧 新增：根据ID获取分类
  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
  }

  // 🔧 新增：检查搜索源是否启用
  isSourceEnabled(sourceId) {
    return this.enabledSources.includes(sourceId);
  }
}

// 全局错误处理
window.addEventListener('error', (event) => {
  console.error('全局错误:', event.error);
  if (window.app && window.app.connectionStatus !== APP_CONSTANTS.CONNECTION_STATUS.ERROR) {
    showToast('应用出现错误，请刷新页面重试', 'error');
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
  if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
    if (window.app && window.app.currentUser) {
      window.app.logout();
    }
  }
});

// 导出到全局作用域
export default MagnetSearchApp;