import { authManager } from '../modules/auth/auth-manager.js';
import { searchManager } from '../modules/search/search-manager.js';
import { favoritesManager } from '../modules/favorites/favorites-manager.js';
import { themeManager } from '../modules/ui/theme-manager.js';
import { modal } from '../modules/ui/modal.js';
//import { toast } from '../modules/ui/toast.js';
import { loading } from '../modules/ui/loading.js';
import { cloudSyncManager } from '../modules/sync/cloud-sync-manager.js';
import { navigationManager } from '../modules/navigation/navigation-manager.js';
import { configManager } from '../modules/core/config.js';
import { apiClient } from '../modules/api/api-client.js';
import { APP_CONSTANTS, EVENT_NAMES } from '../shared/constants.js';

/**
 * 首页应用主类
 */
export class IndexApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = 'checking';
  }

  async init() {
    try {
      loading.show();
      console.log('🚀 初始化磁力快搜应用...');
      
      // 显示连接状态
      this.showConnectionStatus();
      
      // 加载系统配置
      await this.loadConfig();
      
      // 初始化核心模块
      this.initCoreModules();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 检查认证状态
      await this.checkAuthStatus();
      
      // 根据认证状态显示界面
      if (!this.currentUser) {
        document.getElementById('loginModal').style.display = 'block';
        document.querySelector('.main-content').style.display = 'none';
      } else {
        document.querySelector('.main-content').style.display = 'block';
        await this.loadUserData();
      }

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数
      navigationManager.handleURLParams();
      
      this.isInitialized = true;
      this.hideConnectionStatus();
      console.log('✅ 应用初始化完成');
      
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      this.connectionStatus = 'error';
      this.updateConnectionStatus('连接失败');
      toast.error('应用初始化失败，请刷新页面重试');
    } finally {
      loading.hide();
    }
  }

  async loadConfig() {
    try {
      configManager.init();
      const systemConfig = await apiClient.getConfig();
      console.log('📋 系统配置已加载:', systemConfig);
    } catch (error) {
      console.error('配置加载失败:', error);
    }
  }

  initCoreModules() {
    // 初始化各个管理器
    authManager.init();
    searchManager.init();
    favoritesManager.init();
    cloudSyncManager.init();
    navigationManager.init();
  }

  bindEvents() {
    // 认证相关事件
    this.bindAuthEvents();
    
    // 搜索相关事件
    this.bindSearchEvents();
    
    // 收藏相关事件
    this.bindFavoriteEvents();
    
    // 全局键盘快捷键
    this.bindKeyboardShortcuts();

    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type, user } = event.detail;
      if (type === 'login') {
        this.handleUserLogin(user);
      } else if (type === 'logout') {
        this.handleUserLogout();
      }
    });
  }

  bindAuthEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginBtn) loginBtn.addEventListener('click', () => modal.showLogin());
    if (showRegister) showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      modal.showRegister();
    });
    if (showLogin) showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      modal.showLogin();
    });

    if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));

    // Dashboard导航
    const dashboardLink = document.querySelector('a[href*="dashboard"]');
    if (dashboardLink) {
      dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigationManager.navigateToDashboard();
      });
    }
  }

  bindSearchEvents() {
    // 搜索管理器已经处理了搜索相关事件
    // 这里只需要绑定一些额外的UI事件
    
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    
    if (clearResultsBtn) clearResultsBtn.addEventListener('click', () => searchManager.clearResults());
    if (exportResultsBtn) exportResultsBtn.addEventListener('click', () => this.exportResults());
    if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => searchManager.clearHistory());
  }

  bindFavoriteEvents() {
    const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');
    const importFavoritesBtn = document.getElementById('importFavoritesBtn');
    
    if (syncFavoritesBtn) syncFavoritesBtn.addEventListener('click', () => favoritesManager.syncFavorites());
    if (importFavoritesBtn) importFavoritesBtn.addEventListener('click', () => this.importFavorites());
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Escape 关闭模态框
      if (e.key === 'Escape') {
        modal.closeAll();
      }
    });
  }

  async checkAuthStatus() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    if (!token) {
      console.log('未找到认证token');
      return;
    }

    try {
      const result = await apiClient.verifyToken(token);
      if (result.success && result.user) {
        this.currentUser = result.user;
        authManager.setAuth(result.user, token);
        this.updateUserUI();
        console.log('✅ 用户认证成功:', this.currentUser.username);
      } else {
        localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
        console.log('Token验证失败，已清除');
      }
    } catch (error) {
      console.error('验证token失败:', error);
      localStorage.removeItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
    }
  }

  async loadUserData() {
    if (!this.currentUser) return;

    try {
      // 并行加载用户数据
      await Promise.all([
        favoritesManager.loadFavorites(),
        searchManager.loadSearchHistory()
      ]);
      
      console.log('✅ 用户数据加载完成');
    } catch (error) {
      console.error('加载用户数据失败:', error);
      toast.warning('部分数据加载失败');
    }
  }

  async testConnection() {
    try {
      this.updateConnectionStatus('检查连接...');
      const health = await apiClient.healthCheck();
      
      if (health.status === 'healthy') {
        this.connectionStatus = 'connected';
        this.updateConnectionStatus('连接正常');
        console.log('✅ API连接正常');
      } else {
        this.connectionStatus = 'warning';
        this.updateConnectionStatus('连接不稳定');
        console.warn('⚠️ API连接不稳定');
      }
    } catch (error) {
      this.connectionStatus = 'error';
      this.updateConnectionStatus('连接失败');
      console.error('❌ API连接失败:', error);
    }
  }

  async handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
      toast.error('请填写用户名和密码');
      return;
    }

    const result = await authManager.login(username, password);
    
    if (result.success) {
      this.currentUser = result.user;
      
      // 显示主内容区域
      document.querySelector('.main-content').style.display = 'block';
      
      // 关闭模态框
      modal.closeAll();
      
      // 登录后立即加载云端数据
      await this.loadUserData();
      
      // 处理URL参数（如搜索查询）
      navigationManager.handleURLParams();
      
      // 清空登录表单
      document.getElementById('loginForm').reset();
    }
  }

  async handleRegister(event) {
    event.preventDefault();
    
    // 添加防止重复提交机制
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('submitting');
      submitBtn.textContent = '注册中...';
    }
    
    try {
      const username = document.getElementById('regUsername')?.value.trim();
      const email = document.getElementById('regEmail')?.value.trim();
      const password = document.getElementById('regPassword')?.value;
      const confirmPassword = document.getElementById('regConfirmPassword')?.value;

      // 客户端验证
      if (!username || !email || !password || !confirmPassword) {
        toast.error('请填写所有字段');
        return;
      }

      if (password !== confirmPassword) {
        toast.error('两次输入的密码不一致');
        return;
      }

      const result = await authManager.register(username, email, password);
      
      if (result.success) {
        modal.showLogin();
        
        // 清空注册表单
        document.getElementById('registerForm').reset();
        
        // 预填用户名到登录表单
        const loginUsername = document.getElementById('loginUsername');
        if (loginUsername) loginUsername.value = username;
      }
    } finally {
      // 重置按钮状态
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('submitting');
        submitBtn.textContent = '注册';
      }
    }
  }

  handleUserLogin(user) {
    this.currentUser = user;
    this.updateUserUI();
    
    // 显示同步相关按钮
    const syncButtons = document.querySelectorAll('#syncFavoritesBtn, #importFavoritesBtn');
    syncButtons.forEach(btn => {
      if (btn) btn.style.display = 'inline-block';
    });
  }

  handleUserLogout() {
    this.currentUser = null;
    
    // 清空所有数据
    searchManager.setSearchHistory([]);
    favoritesManager.setFavorites([]);
    
    // 更新UI
    this.updateUserUI();
    
    // 隐藏主界面
    document.querySelector('.main-content').style.display = 'none';
    
    // 显示登录模态框
    modal.showLogin();
    
    // 隐藏同步相关按钮
    const syncButtons = document.querySelectorAll('#syncFavoritesBtn, #importFavoritesBtn');
    syncButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  }

  updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');

    if (this.currentUser) {
      if (loginBtn) loginBtn.style.display = 'none';
      if (userInfo) userInfo.style.display = 'flex';
      if (username) username.textContent = this.currentUser.username;
      
      // 绑定退出登录事件
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = () => this.logout();
      }
    } else {
      if (loginBtn) loginBtn.style.display = 'inline-block';
      if (userInfo) userInfo.style.display = 'none';
    }
  }

  async logout() {
    await authManager.logout();
  }

  async exportResults() {
    const results = searchManager.getCurrentResults();
    if (results.length === 0) {
      toast.error('没有搜索结果可以导出');
      return;
    }

    try {
      const data = {
        results,
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('搜索结果导出成功');
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  importFavorites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await favoritesManager.importFavorites(file);
      }
    };
    
    input.click();
  }

  // 连接状态管理
  showConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status) {
      status.style.display = 'flex';
      this.updateConnectionStatus('正在连接...');
    }
  }

  hideConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    if (status && this.connectionStatus === 'connected') {
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

  checkConnectionStatus() {
    if (this.isInitialized) {
      this.testConnection();
    }
  }

  // 添加到收藏
  async addToFavorites(item) {
    if (!this.currentUser) {
      toast.error('请先登录后再收藏');
      return false;
    }
    
    return await favoritesManager.addFavorite(item);
  }

  // 检查是否已收藏
  isFavorited(url) {
    return favoritesManager.isFavorited(url);
  }

  // 获取应用状态
  getAppStatus() {
    return {
      isInitialized: this.isInitialized,
      currentUser: this.currentUser,
      connectionStatus: this.connectionStatus,
      searchResults: searchManager.getCurrentResults().length,
      favorites: favoritesManager.getFavorites().length,
      searchHistory: searchManager.searchHistory.length
    };
  }
}

// 创建全局实例
export const indexApp = new IndexApp();