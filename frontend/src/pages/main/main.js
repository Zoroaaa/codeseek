// 主应用入口 - 清理版本：移除详情提取相关功能，保留核心搜索和用户管理功能
import { APP_CONSTANTS } from '../../core/constants.js';
import configManager from '../../core/config.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';
import networkUtils from '../../utils/network.js';
import authManager from '../../services/auth.js';
import themeManager from '../../services/theme.js';
import unifiedSearchManager from '../../components/search.js';
import favoritesManager from '../../components/favorites.js';
import apiService from '../../services/api.js';
// 导入新的搜索源管理API
import searchSourcesAPI from '../../services/search-sources-api.js';
// 导入邮箱验证服务和UI组件
import emailVerificationService from '../../services/email-verification-service.js';
import { emailVerificationUI } from '../../components/email-verification-ui.js';
import proxyService from '../../services/proxy-service.js';

class MagnetSearchApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.CHECKING || 'checking';
    
    // 移除硬编码数据,完全从API获取
    this.allSearchSources = [];
    this.allCategories = [];
    this.majorCategories = [];
    
    // 性能监控
    this.performanceMetrics = {
      initTime: 0,
      searchCount: 0,
      errorCount: 0
    };
    
    this.init();
  }

  // 优化: 改进初始化流程
  async init() {
    const startTime = performance.now();
    
    try {
      showLoading(true);
      console.log('🚀 初始化磁力快搜应用...');
      
      // 显示连接状态
      this.showConnectionStatus();
      
      // 初始化配置
      await configManager.init();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 初始化邮箱验证服务
      await this.initEmailVerificationService();
      
      // 检查认证状态并根据结果决定后续流程
      const isAuthenticated = await this.checkAuthStatus();
      
      if (!isAuthenticated) {
        // 未认证用户: 显示登录界面和基础数据
        console.log('📱 未认证用户,显示登录界面');
        document.getElementById('loginModal').style.display = 'block';
        document.querySelector('.main-content').style.display = 'none';
        
        // 加载基础数据用于展示
        await this.loadMinimalFallbackData();
      } else {
        // 已认证用户: 显示主界面
        console.log('👤 已认证用户,显示主界面');
        document.querySelector('.main-content').style.display = 'block';
      }

      // 初始化站点导航
      await this.initSiteNavigation();

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数
      this.handleURLParams();
      
      // 记录初始化性能
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

  // 优化: 改进搜索源API加载
  async loadSearchSourcesFromAPI() {
    try {
      console.log('📡 从API加载搜索源数据...');
      
      // 确保认证状态
      if (!this.currentUser) {
        throw new Error('用户未认证,无法加载搜索源');
      }
      
      // 验证token有效性
      const isTokenValid = await authManager.verifyToken();
      if (!isTokenValid) {
        throw new Error('认证token无效,请重新登录');
      }
      
      // 并行加载所有数据类型
      const loadPromises = [
        searchSourcesAPI.getMajorCategories(),
        searchSourcesAPI.getSourceCategories({ includeSystem: true }),
        searchSourcesAPI.getSearchSources({ includeSystem: true, enabledOnly: false })
      ];
      
      const [majorCategories, categories, sources] = await Promise.all(loadPromises);
      
      // 验证数据有效性
      this.majorCategories = Array.isArray(majorCategories) ? majorCategories : [];
      this.allCategories = Array.isArray(categories) ? categories : [];
      this.allSearchSources = Array.isArray(sources) ? sources : [];
      
      console.log(`✅ API数据加载完成: ${this.majorCategories.length}个大类, ${this.allCategories.length}个分类, ${this.allSearchSources.length}个搜索源`);
      
      // 如果所有数据都为空,可能是API问题,使用回退数据
      if (this.majorCategories.length === 0 && this.allCategories.length === 0 && this.allSearchSources.length === 0) {
        console.warn('⚠️ API返回空数据,使用回退方案');
        await this.loadMinimalFallbackData();
      }
      
    } catch (error) {
      console.warn('⚠️ 从API加载搜索源失败:', error);
      await this.loadMinimalFallbackData();
      throw error; // 重新抛出错误以便上层处理
    }
  }

  // 最小回退方案（仅在API完全不可用时使用）
async loadMinimalFallbackData() {
  try {
    // 创建最基本的大类 - 必须包含正确的字段结构
    this.majorCategories = [
      {
        id: 'search_sources',
        name: '🔍 搜索源',
        icon: '🔍',
        description: '支持番号搜索的网站',
        requiresKeyword: true,
        displayOrder: 1,
        order: 1
      },
      {
        id: 'browse_sites',
        name: '🌐 浏览站点',
        icon: '🌐',
        description: '仅供访问,不参与搜索',
        requiresKeyword: false,
        displayOrder: 2,
        order: 2
      }
    ];

    // 创建最基本的分类 - 必须包含 majorCategoryId 字段
    this.allCategories = [
      {
        id: 'database',
        name: '📚 番号资料站',
        icon: '📚',
        description: '提供详细的番号信息、封面和演员资料',
        majorCategoryId: 'search_sources',  // 关键:使用 majorCategoryId
        defaultSearchable: true,
        defaultSiteType: 'search',
        searchPriority: 1,
        isSystem: true,
        displayOrder: 1
      },
      {
        id: 'streaming',
        name: '🎥 在线播放平台',
        icon: '🎥',
        description: '提供在线观看和下载服务',
        majorCategoryId: 'browse_sites',  // 关键:使用 majorCategoryId
        defaultSearchable: false,
        defaultSiteType: 'browse',
        searchPriority: 5,
        isSystem: true,
        displayOrder: 1
      },
      {
        id: 'torrent',
        name: '🧲 磁力搜索',
        icon: '🧲',
        description: '提供磁力链接和种子文件',
        majorCategoryId: 'search_sources',  // 关键:使用 majorCategoryId
        defaultSearchable: true,
        defaultSiteType: 'search',
        searchPriority: 3,
        isSystem: true,
        displayOrder: 3
      }
    ];

    // 创建最基本的搜索源 - 必须包含 categoryId 字段
    this.allSearchSources = [
      {
        id: 'javbus',
        name: 'JavBus',
        subtitle: '番号+磁力一体站,信息完善',
        icon: '🎬',
        categoryId: 'database',  // 关键:使用 categoryId
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
        categoryId: 'database',  // 关键:使用 categoryId
        urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
        searchable: true,
        siteType: 'search',
        searchPriority: 2,
        requiresKeyword: true,
        isSystem: true,
        userEnabled: true
      }
    ];

    console.log('🔧 已加载最小回退数据');
    
  } catch (error) {
    console.error('❌ 加载回退数据失败:', error);
    // 设置为空数组,防止应用崩溃
    this.majorCategories = [];
    this.allCategories = [];
    this.allSearchSources = [];
  }
}

  // 初始化邮箱验证服务
  async initEmailVerificationService() {
    try {
      console.log('📧 初始化邮箱验证服务...');
      
      // 邮箱验证服务已经通过导入自动初始化
      // 这里可以进行一些额外的配置或检查
      
      // 验证服务可用性
      if (emailVerificationService && emailVerificationUI) {
        console.log('✅ 邮箱验证服务初始化成功');
        
        // 设置全局访问
        window.emailVerificationService = emailVerificationService;
        window.emailVerificationUI = emailVerificationUI;
      } else {
        console.warn('⚠️ 邮箱验证服务初始化不完整');
      }
      
    } catch (error) {
      console.error('❌ 邮箱验证服务初始化失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  // 初始化站点导航 - 使用动态数据
  async initSiteNavigation() {
    try {
      // 确保数据已加载
      if (this.allSearchSources.length === 0) {
        await this.loadSearchSourcesFromAPI();
      }
      
      this.renderSiteNavigation(this.allSearchSources);
    } catch (error) {
      console.error('初始化站点导航失败:', error);
      // 显示错误状态
      const sitesSection = document.getElementById('sitesSection');
      if (sitesSection) {
        sitesSection.innerHTML = `
          <h2>🌐 资源站点导航</h2>
          <div class="empty-state">
            <p>加载站点数据失败</p>
            <button onclick="window.app && window.app.loadSearchSourcesFromAPI().then(() => window.app.initSiteNavigation())" class="btn-primary">重新加载</button>
          </div>
        `;
      }
    }
  }

  // 渲染站点导航 - 使用动态数据
renderSiteNavigation(sourcesToDisplay = null) {
  const sitesSection = document.getElementById('sitesSection');
  if (!sitesSection) return;

  const sources = sourcesToDisplay || this.allSearchSources;

  if (sources.length === 0) {
    sitesSection.innerHTML = `
      <h2>🌐 资源站点导航</h2>
      <div class="empty-state">
        <p>暂无可用的搜索源</p>
        <p>请在个人中心搜索源管理页面添加搜索源</p>
        <button onclick="window.app && window.app.navigateToDashboard()" class="btn-primary">前往设置</button>
      </div>
    `;
    return;
  }

  // 使用动态获取的大类数据
  const majorCategories = this.majorCategories.sort((a, b) => (a.order || a.displayOrder || 999) - (b.order || b.displayOrder || 999));
  
  let navigationHTML = `
    <h2>🌐 资源站点导航</h2>
  `;

  // 按大分类渲染各个部分
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

  // 新增:获取按大分类和小分类组织的源
getSourcesByMajorCategoryWithSubcategories(sources, majorCategoryId) {
  return sources.filter(source => {
    // 关键修复:同时支持 categoryId 和 category 字段
    const sourceCategoryId = source.categoryId || source.category;
    const category = this.allCategories.find(cat => cat.id === sourceCategoryId);
    
    if (!category) {
      console.warn(`源 ${source.id} 的分类 ${sourceCategoryId} 未找到`);
      return false;
    }
    
    // 关键修复:同时支持 majorCategoryId 和 majorCategory 字段
    const categoryMajorId = category.majorCategoryId || category.majorCategory;
    return categoryMajorId === majorCategoryId;
  });
}

  // 新增:渲染小分类及其下的源
renderSubcategoriesWithSources(sources, majorCategoryId) {
  // 按小分类分组
  const sourcesBySubcategory = {};
  
  sources.forEach(source => {
    // 关键修复:兼容字段名
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

  // 按小分类的 order/displayOrder 排序
  const sortedSubcategories = Object.values(sourcesBySubcategory)
    .sort((a, b) => {
      const orderA = a.category.displayOrder || a.category.order || 999;
      const orderB = b.category.displayOrder || b.category.order || 999;
      return orderA - orderB;
    });

  return sortedSubcategories.map(({ category, sources }) => {
    // 关键修复:根据大类判断是否可搜索
    const isSearchable = majorCategoryId === 'search_sources';
    
    return `
      <div class="subcategory-section">
        <h4 class="subcategory-title">
          ${category.icon} ${category.name}
          <span class="source-count">${sources.length}个站点</span>
          ${isSearchable ? '<span class="searchable-indicator">🔍 参与搜索</span>' : '<span class="browse-indicator">🌐 仅浏览</span>'}
        </h4>
        <p class="subcategory-desc">${category.description || ''}</p>
        
        <div class="sites-grid">
          ${sources.map(source => this.renderSiteItem(source, isSearchable)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

  // 渲染单个站点项,包括可用状态和详情提取支持标识
renderSiteItem(source, isSearchable) {
  // 通过统一搜索管理器检查源的可用状态
  let isEnabled = true; // 默认显示为可用,具体可用状态由搜索时判断
  
  try {
    if (unifiedSearchManager.isInitialized) {
      // 这里可以添加检查逻辑,当前简化处理
    }
  } catch (error) {
    console.warn('检查搜索源可用状态失败:', error);
  }

  const statusClass = isEnabled ? 'enabled' : 'disabled';
  const statusText = isEnabled ? '可用' : '未可用';
  
  const badges = [];
  
  if (!isSearchable) {
    badges.push('<span class="non-searchable-badge">仅浏览</span>');
  } else if (source.searchPriority && source.searchPriority <= 3) {
    badges.push('<span class="priority-badge">优先</span>');
  }
  
  // 根据网站类型调整URL处理
  let siteUrl = source.urlTemplate;
  if (source.searchable === false) {
    // 浏览站点直接使用基础URL
    siteUrl = siteUrl.replace('/{keyword}', '').replace('?q={keyword}&f=all', '').replace('/search/{keyword}', '');
  } else {
    // 搜索源移除关键词占位符以供直接访问
    siteUrl = siteUrl.replace('{keyword}', '');
  }
  
  return `
    <a href="${siteUrl}" 
       class="site-item ${isSearchable ? 'searchable' : 'browse-only'}"
       target="_blank">
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

  // 优化: 改进组件初始化
  async initComponents() {
    try {
      console.log('📦 开始初始化组件...');
      
      // 1. 首先初始化代理服务
      console.log('🔗 初始化代理服务...');
      await proxyService.init();
      if (proxyService.isProxyEnabled()) {
        console.log('✅ 代理服务已启用');
      }
      
      // 2. 初始化统一搜索管理器
      console.log('🔍 初始化搜索管理器...');
      if (!unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.init();
      } else {
        // 如果已经初始化,重新设置用户状态
        await unifiedSearchManager.refreshUserData();
      }
      
      // 3. 初始化收藏管理器
      console.log('⭐ 初始化收藏管理器...');
      if (!favoritesManager.isInitialized) {
        await favoritesManager.init();
      } else {
        // 如果已经初始化,清空旧数据准备重新加载
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      console.log('✅ 组件初始化完成');
      
    } catch (error) {
      console.error('组件初始化失败:', error);
      this.performanceMetrics.errorCount++;
      throw error;
    }
  }

  // 新增: 清理组件状态
  async cleanupComponents() {
    try {
      // 只清理必要的状态,不完全销毁组件
      if (unifiedSearchManager.isInitialized) {
        // 清理搜索结果但保持组件活跃
        unifiedSearchManager.clearSearchResults();
      }
      
      if (favoritesManager.isInitialized) {
        // 清空收藏列表准备重新加载
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
    } catch (error) {
      console.warn('清理组件状态时出错:', error);
      // 不抛出错误,继续初始化流程
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
    const connectedStatus = APP_CONSTANTS.CONNECTION_STATUS?.CONNECTED || 'connected';
    if (status && this.connectionStatus === connectedStatus) {
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
      
      const connectedStatus = APP_CONSTANTS.CONNECTION_STATUS?.CONNECTED || 'connected';
      const warningStatus = APP_CONSTANTS.CONNECTION_STATUS?.WARNING || 'warning';
      const errorStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
      
      if (result.connected) {
        this.connectionStatus = connectedStatus;
        this.updateConnectionStatus('连接正常');
        console.log('✅ API连接正常');
      } else {
        this.connectionStatus = warningStatus;
        this.updateConnectionStatus('连接不稳定');
        console.warn('⚠️ API连接不稳定');
      }
    } catch (error) {
      this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.ERROR || 'error';
      this.updateConnectionStatus('连接失败');
      this.performanceMetrics.errorCount++;
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
        // 如果已初始化统一搜索管理器,则自动执行搜索
        if (unifiedSearchManager.isInitialized) {
          setTimeout(() => {
            unifiedSearchManager.performSearch();
            this.performanceMetrics.searchCount++;
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
    
    // 监听统一搜索管理器的搜索事件,更新性能计数
    document.addEventListener('searchResultsRendered', () => {
      this.performanceMetrics.searchCount++;
    });

    // 绑定邮箱验证相关事件
    this.bindEmailVerificationEvents();
  }

  // 绑定邮箱验证相关事件
  bindEmailVerificationEvents() {
    // 监听邮箱更改成功事件
    window.addEventListener('emailChanged', (event) => {
      console.log('用户邮箱已更改:', event.detail);
      if (this.currentUser) {
        this.currentUser.email = event.detail.newEmail;
        this.updateUserUI();
      }
    });

    // 监听账户删除事件
    window.addEventListener('accountDeleted', () => {
      console.log('用户账户已删除');
      this.handleAccountDeleted();
    });

    // 监听验证码过期事件
    window.addEventListener('verificationExpired', (event) => {
      console.log('验证码已过期:', event.detail);
      showToast('验证码已过期,请重新获取', 'warning');
    });
  }

  // 处理账户删除
  async handleAccountDeleted() {
    try {
      // 清除当前用户信息
      this.currentUser = null;
      
      // 清除本地存储
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
      
      // 清空搜索管理器数据
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.cleanup();
      }
      
      // 清空收藏管理器数据
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      showToast('账户已删除,正在跳转...', 'info');
      
      // 跳转到主页
      setTimeout(() => {
        window.location.href = './index.html';
      }, 2000);
      
    } catch (error) {
      console.error('处理账户删除失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  // 修改:用户登录后更新站点导航
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
        console.log('✅ 登录成功,开始初始化用户数据...');
        
        // 1. 首先设置用户状态
        this.currentUser = result.user;
        this.updateUserUI();
        
        // 2. 显示主内容区域
        document.querySelector('.main-content').style.display = 'block';
        this.closeModals();
        
        // 3. 等待一下确保认证状态完全建立
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 4. 按顺序初始化组件和数据
        await this.initializeUserSession();
        
        // 5. 处理URL参数
        this.handleURLParams();
        
        // 6. 清空登录表单
        document.getElementById('loginForm').reset();
        
        console.log('✅ 用户会话初始化完成');
        showToast('登录成功!', 'success');
        
      }
    } catch (error) {
      console.error('登录失败:', error);
      showToast('登录失败: ' + error.message, 'error');
      this.performanceMetrics.errorCount++;
    } finally {
      showLoading(false);
    }
  }

  // 新增: 统一的用户会话初始化方法
  async initializeUserSession() {
    try {
      console.log('🔄 开始初始化用户会话...');
      
      // 1. 重置错误计数
      this.performanceMetrics.searchCount = 0;
      
      // 2. 先确保组件处于干净状态
      await this.cleanupComponents();
      
      // 3. 初始化核心组件 (按依赖顺序)
      console.log('📦 初始化核心组件...');
      await this.initComponents();
      
      // 4. 加载搜索源数据 (需要认证状态)
      console.log('📊 加载用户数据...');
      await this.loadUserData();
      
      // 5. 重新初始化站点导航
      console.log('🌐 更新站点导航...');
      await this.initSiteNavigation();
      
      console.log('✅ 用户会话初始化完成');
      
    } catch (error) {
      console.error('❌ 用户会话初始化失败:', error);
      showToast('数据加载失败,正在重试...', 'warning');
      
      // 重试一次
      setTimeout(async () => {
        try {
          await this.retryUserDataLoading();
        } catch (retryError) {
          console.error('重试失败:', retryError);
          showToast('数据加载失败,请刷新页面重试', 'error');
        }
      }, 2000);
    }
  }

  // 新增: 重试用户数据加载
  async retryUserDataLoading() {
    console.log('🔄 重试加载用户数据...');
    
    // 确保认证状态有效
    const isAuthValid = await authManager.verifyToken();
    if (!isAuthValid) {
      throw new Error('认证状态无效,请重新登录');
    }
    
    // 重新加载数据
    await this.loadUserData();
    await this.initSiteNavigation();
    
    showToast('数据加载成功!', 'success');
  }

  // 新增: 加载用户相关数据
  async loadUserData() {
    // 确保用户已登录
    if (!this.currentUser) {
      throw new Error('用户未登录');
    }
    
    try {
      // 并行加载数据以提高性能
      const [sourcesResult, favoritesResult] = await Promise.allSettled([
        this.loadSearchSourcesFromAPI(),
        this.loadUserFavorites()
      ]);
      
      // 检查搜索源加载结果
      if (sourcesResult.status === 'rejected') {
        console.warn('搜索源加载失败:', sourcesResult.reason);
        // 使用回退数据但不抛出错误
        await this.loadMinimalFallbackData();
      }
      
      // 检查收藏加载结果
      if (favoritesResult.status === 'rejected') {
        console.warn('收藏数据加载失败:', favoritesResult.reason);
        // 收藏加载失败不影响主流程
      }
      
    } catch (error) {
      console.error('加载用户数据失败:', error);
      // 确保至少有基础数据可用
      await this.loadMinimalFallbackData();
      throw error;
    }
  }

  // 新增: 加载用户收藏数据
  async loadUserFavorites() {
    if (favoritesManager && favoritesManager.isInitialized) {
      try {
        await favoritesManager.loadFavorites();
        console.log('✅ 收藏数据加载完成');
      } catch (error) {
        console.warn('收藏数据加载失败:', error);
        // 重置为空收藏列表
        favoritesManager.favorites = [];
      }
    }
  }


  // 绑定模态框事件
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
    
    // 忘记密码链接
    if (showPasswordReset) showPasswordReset.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('loginModal').style.display = 'none';
      emailVerificationUI.showPasswordResetModal();
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
      
      // Ctrl+K 或 Cmd+K 聚焦搜索框
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

  // 绑定网络事件
  bindNetworkEvents() {
    networkUtils.onNetworkChange((isOnline) => {
      if (isOnline && this.isInitialized) {
        setTimeout(() => {
          this.testConnection();
        }, 1000);
      }
    });

    // 页面可视性变化处理
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

  // 修改处理注册 - 集成邮箱验证
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

    if (password.length < 6) {
      showToast('密码长度至少6个字符', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showToast('请输入有效的邮箱地址', 'error');
      this.resetSubmitButton(submitBtn);
      return;
    }

    try {
      // 使用邮箱验证流程
      // 先关闭注册模态框
      this.closeModals();
      
      // 存储注册数据供验证时使用
      emailVerificationUI.verificationData = {
        username,
        email,
        password
      };
      
      // 显示邮箱验证模态框
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

  // 重置提交按钮状态
  resetSubmitButton(submitBtn) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('submitting');
      submitBtn.textContent = '注册并验证邮箱';
    }
  }

  // 优化: 改进认证状态检查
  async checkAuthStatus() {
    const token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    if (!token) {
      console.log('未找到认证token');
      return false;
    }

    try {
      console.log('🔐 验证用户认证状态...');
      const isValid = await authManager.verifyToken();
      
      if (isValid) {
        this.currentUser = authManager.getCurrentUser();
        this.updateUserUI();
        console.log('✅ 用户认证有效:', this.currentUser.username);
        
        // 认证有效,初始化用户会话
        await this.initializeUserSession();
        return true;
      } else {
        console.log('Token验证失败,已清除');
        return false;
      }
    } catch (error) {
      console.error('验证token失败:', error);
      this.performanceMetrics.errorCount++;
      return false;
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

  // 优化: 改进退出登录逻辑
  async logout() {
    try {
      showLoading(true, '正在退出...');
      console.log('🚪 开始退出登录...');
      
      // 1. 清理认证状态
      await authManager.logout();
      this.currentUser = null;
      
      // 2. 清理组件状态 (但不完全销毁)
      await this.cleanupUserSession();
      
      // 3. 更新UI状态
      this.updateUserUI();
      
      // 4. 重置为未登录状态的基础数据
      await this.resetToLoggedOutState();
      
      // 5. 显示登录界面
      document.querySelector('.main-content').style.display = 'none';
      this.showLoginModal();
      
      console.log('✅ 退出登录完成');
      showToast('已退出登录', 'info');
      
    } catch (error) {
      console.error('退出登录失败:', error);
      showToast('退出登录时出现错误', 'error');
      this.performanceMetrics.errorCount++;
    } finally {
      showLoading(false);
    }
  }

  // 新增: 清理用户会话
  async cleanupUserSession() {
    try {
      console.log('🧹 清理用户会话...');
      
      // 清理搜索管理器数据但保持组件可用
      if (unifiedSearchManager.isInitialized) {
        unifiedSearchManager.clearSearchResults();
        unifiedSearchManager.resetToGuestMode();
      }
      
      // 清理收藏管理器数据
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      // 清空搜索源数据
      this.allSearchSources = [];
      this.allCategories = [];
      this.majorCategories = [];
      
    } catch (error) {
      console.warn('清理用户会话时出错:', error);
    }
  }

  // 新增: 重置为未登录状态
  async resetToLoggedOutState() {
    try {
      // 加载最小回退数据用于展示
      await this.loadMinimalFallbackData();
      
      // 重新初始化站点导航(显示基础源)
      await this.initSiteNavigation();
      
      // 重置性能指标
      this.performanceMetrics = {
        initTime: this.performanceMetrics.initTime,
        searchCount: 0,
        errorCount: 0
      };
      
    } catch (error) {
      console.error('重置登出状态失败:', error);
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
      this.performanceMetrics.errorCount++;
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

//获取源所属的大类 
getMajorCategoryForSource(source) {
  if (!source) return null;
  
  // 关键修复:兼容字段名
  const categoryId = source.categoryId || source.category;
  const category = this.allCategories.find(cat => cat.id === categoryId);
  
  if (!category) return null;
  
  // 关键修复:兼容字段名
  return category.majorCategoryId || category.majorCategory;
}

  // 获取应用性能统计
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
    
    // 计算错误率
    const totalOperations = stats.searchCount;
    stats.errorRate = totalOperations > 0 ? (stats.errorCount / totalOperations * 100).toFixed(2) + '%' : '0%';
    
    return stats;
  }

  // 导出应用状态
  exportAppState() {
    return {
      isInitialized: this.isInitialized,
      connectionStatus: this.connectionStatus,
      currentUser: this.currentUser ? {
        username: this.currentUser.username,
        email: this.currentUser.email
      } : null,
      performanceStats: this.getPerformanceStats(),
      timestamp: Date.now(),
      version: APP_CONSTANTS.DEFAULT_VERSION || '3.0.0'
    };
  }
}

// 全局错误处理
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

// 导出到全局作用域
export default MagnetSearchApp;