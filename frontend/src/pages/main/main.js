// 主应用入口 - 完善版详情提取功能集成
import { APP_CONSTANTS } from '../../core/constants.js';
import configManager from '../../core/config.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';
import networkUtils from '../../utils/network.js';
import authManager from '../../services/auth.js';
import themeManager from '../../services/theme.js';
import unifiedSearchManager from '../../components/search.js';
import favoritesManager from '../../components/favorites.js';
import detailAPIService from '../../services/detail-api.js';
import detailCardManager from '../../components/detail-card.js';
import apiService from '../../services/api.js';

class MagnetSearchApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS.CHECKING;
    
    // 搜索源和分类管理
    this.allSearchSources = [];
    this.allCategories = [];
    this.enabledSources = [];
    this.customSearchSources = [];
    this.customCategories = [];
    
    // 详情提取功能状态管理
    this.detailExtractionAvailable = false;
    this.detailExtractionEnabled = false;
    this.detailExtractionConfig = {};
    this.detailExtractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageExtractionTime: 0
    };
    
    // 详情提取服务状态
    this.detailServiceStatus = {
      isHealthy: false,
      lastHealthCheck: null,
      serviceVersion: null,
      supportedSources: [],
      capabilities: []
    };
    
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
      
      // 从constants.js加载内置数据
      this.loadBuiltinData();
      
      // 绑定事件
      this.bindEvents();
      
      // 初始化主题
      themeManager.init();
      
      // 检查认证状态
      await this.checkAuthStatus();
      
      // 若未认证，打开登录模态
      if (!this.currentUser) {
        document.getElementById('loginModal').style.display = 'block';
        document.querySelector('.main-content').style.display = 'none';
      } else {
        document.querySelector('.main-content').style.display = 'block';
        await this.initComponents();
        await this.loadUserSearchSettings();
        
        // 详情提取功能初始化
        await this.initDetailExtractionService();
      }

      // 初始化站点导航
      await this.initSiteNavigation();

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数
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

  // 从constants.js加载内置数据
  loadBuiltinData() {
    try {
      const builtinSources = APP_CONSTANTS.SEARCH_SOURCES.map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      
      const builtinCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(category => ({
        ...category,
        isBuiltin: true,
        isCustom: false
      }));
      
      console.log(`从constants.js加载了 ${builtinSources.length} 个内置搜索源和 ${builtinCategories.length} 个内置分类`);
      
      this.allSearchSources = [...builtinSources];
      this.allCategories = [...builtinCategories];
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      
    } catch (error) {
      console.error('加载内置数据失败:', error);
      this.allSearchSources = [];
      this.allCategories = [];
      this.enabledSources = [];
    }
  }

  // 加载用户的搜索源设置
  async loadUserSearchSettings() {
    if (!this.currentUser) return;
    
    try {
      const userSettings = await apiService.getUserSettings();
      
      this.customSearchSources = userSettings.customSearchSources || [];
      this.customCategories = userSettings.customSourceCategories || [];
      this.enabledSources = userSettings.searchSources || APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      
      // 加载详情提取设置
      this.detailExtractionEnabled = userSettings.enableDetailExtraction || false;
      this.detailExtractionConfig = {
        autoExtractDetails: userSettings.autoExtractDetails || false,
        maxAutoExtractions: userSettings.maxAutoExtractions || 5,
        extractionBatchSize: userSettings.extractionBatchSize || 3,
        detailExtractionTimeout: userSettings.detailExtractionTimeout || 15000,
        showScreenshots: userSettings.showScreenshots !== false,
        showDownloadLinks: userSettings.showDownloadLinks !== false,
        showMagnetLinks: userSettings.showMagnetLinks !== false,
        showActressInfo: userSettings.showActressInfo !== false,
        compactMode: userSettings.compactMode || false,
        enableImagePreview: userSettings.enableImagePreview !== false,
        cacheStrategy: userSettings.cacheStrategy || 'normal'
      };
      
      this.allSearchSources = [
        ...APP_CONSTANTS.SEARCH_SOURCES.map(s => ({ ...s, isBuiltin: true, isCustom: false })),
        ...this.customSearchSources.map(s => ({ ...s, isBuiltin: false, isCustom: true }))
      ];
      
      this.allCategories = [
        ...Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(c => ({ ...c, isBuiltin: true, isCustom: false })),
        ...this.customCategories.map(c => ({ ...c, isBuiltin: false, isCustom: true }))
      ];
      
      console.log(`用户设置：启用 ${this.enabledSources.length} 个搜索源，包含 ${this.customSearchSources.length} 个自定义源，详情提取：${this.detailExtractionEnabled ? '启用' : '禁用'}`);
      
    } catch (error) {
      console.warn('加载用户搜索源设置失败，使用默认设置:', error);
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      this.detailExtractionEnabled = false;
      this.detailExtractionConfig = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
    }
  }

  // 初始化详情提取服务
  async initDetailExtractionService() {
    if (!this.currentUser) {
      this.detailExtractionAvailable = false;
      this.updateDetailExtractionUI();
      return;
    }

    try {
      console.log('🔋 初始化详情提取服务...');
      
      // 检查后端详情提取服务可用性
      const serviceHealth = await this.checkDetailExtractionServiceHealth();
      this.detailExtractionAvailable = serviceHealth.isHealthy;
      this.detailServiceStatus = serviceHealth;
      
      if (this.detailExtractionAvailable) {
        // 加载详情提取配置
        await this.loadDetailExtractionConfig();
        
        // 加载详情提取统计
        await this.loadDetailExtractionStats();
        
        // 如果后端支持但用户未启用，显示提示
        if (!this.detailExtractionEnabled) {
          this.showDetailExtractionNotification();
        }
        
        console.log('✅ 详情提取服务初始化完成');
      } else {
        console.warn('⚠️ 详情提取服务不可用');
      }
      
      // 更新UI状态
      this.updateDetailExtractionUI();
      
    } catch (error) {
      console.error('详情提取服务初始化失败:', error);
      this.detailExtractionAvailable = false;
      this.updateDetailExtractionUI();
    }
  }

  // 检查详情提取服务健康状态
  async checkDetailExtractionServiceHealth() {
    try {
      const healthStatus = {
        isHealthy: false,
        lastHealthCheck: Date.now(),
        serviceVersion: null,
        supportedSources: [],
        capabilities: [],
        responseTime: 0
      };

      const startTime = Date.now();
      
      // 检查详情提取配置接口
      const config = await detailAPIService.getConfig();
      healthStatus.responseTime = Date.now() - startTime;
      
      if (config.config) {
        healthStatus.isHealthy = true;
        healthStatus.serviceVersion = config.config.version || '1.0.0';
        healthStatus.supportedSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES;
        healthStatus.capabilities = [
          'single_extraction',
          'batch_extraction',
          'cache_management',
          'progress_tracking',
          'error_recovery'
        ];
      }
      
      // 检查详情提取统计接口
      try {
        await detailAPIService.getStats();
        healthStatus.capabilities.push('statistics');
      } catch (error) {
        console.warn('统计接口不可用:', error);
      }
      
      return healthStatus;
      
    } catch (error) {
      console.error('详情提取服务健康检查失败:', error);
      return {
        isHealthy: false,
        lastHealthCheck: Date.now(),
        serviceVersion: null,
        supportedSources: [],
        capabilities: [],
        responseTime: 0,
        error: error.message
      };
    }
  }

  // 加载详情提取配置
  async loadDetailExtractionConfig() {
    try {
      const configResult = await detailAPIService.getConfig();
      
      if (configResult.config) {
        this.detailExtractionConfig = {
          ...this.detailExtractionConfig,
          ...configResult.config,
          systemLimits: configResult.systemLimits,
          usage: configResult.usage
        };
        
        console.log('详情提取配置已加载:', this.detailExtractionConfig);
      }
      
    } catch (error) {
      console.warn('加载详情提取配置失败:', error);
    }
  }

  // 加载详情提取统计
  async loadDetailExtractionStats() {
    try {
      const statsResult = await detailAPIService.getStats();
      
      if (statsResult.user) {
        this.detailExtractionStats = {
          totalExtractions: statsResult.user.totalExtractions || 0,
          successfulExtractions: statsResult.user.successfulExtractions || 0,
          failedExtractions: statsResult.user.failedExtractions || 0,
          cacheHits: statsResult.cache?.hitCount || 0,
          averageExtractionTime: statsResult.performance?.averageTime || 0,
          successRate: statsResult.user.successRate || 0
        };
        
        console.log('详情提取统计已加载:', this.detailExtractionStats);
      }
      
    } catch (error) {
      console.warn('加载详情提取统计失败:', error);
    }
  }

  // 更新详情提取UI状态
  updateDetailExtractionUI() {
    // 更新详情提取状态指示器
    const statusSection = document.getElementById('detailExtractionStatus');
    const statusBadge = document.getElementById('detailStatusBadge');
    const statusDescription = document.getElementById('detailStatusDescription');
    const toggleButton = document.getElementById('detailExtractionToggle');
    
    if (statusSection) {
      if (this.detailExtractionAvailable) {
        statusSection.style.display = 'block';
        
        if (statusBadge) {
          statusBadge.textContent = this.detailExtractionEnabled ? '已启用' : '未启用';
          statusBadge.className = `status-badge ${this.detailExtractionEnabled ? 'enabled' : 'disabled'}`;
        }
        
        if (statusDescription) {
          if (this.detailExtractionEnabled) {
            statusDescription.innerHTML = `
              详情提取功能已启用。支持 ${this.detailServiceStatus.supportedSources.length} 个搜索源的详情提取。
              <br><small>统计信息：成功提取 ${this.detailExtractionStats.successfulExtractions} 次，成功率 ${Math.round(this.detailExtractionStats.successRate * 100)}%</small>
            `;
          } else {
            statusDescription.textContent = '点击启用详情提取功能，可自动获取番号的详细信息，包括封面图片、演员信息、下载链接等。';
          }
        }
      } else {
        statusSection.style.display = 'none';
      }
    }
    
    if (toggleButton) {
      if (this.detailExtractionAvailable && this.currentUser) {
        toggleButton.style.display = 'inline-block';
        toggleButton.title = this.detailExtractionEnabled ? '禁用详情提取' : '启用详情提取';
        toggleButton.className = `detail-extraction-btn ${this.detailExtractionEnabled ? 'enabled' : 'disabled'}`;
      } else {
        toggleButton.style.display = 'none';
      }
    }
    
    // 更新批量提取按钮
    const batchExtractBtn = document.getElementById('batchExtractBtn');
    if (batchExtractBtn) {
      if (this.detailExtractionAvailable && this.detailExtractionEnabled && this.currentUser) {
        batchExtractBtn.style.display = 'inline-block';
      } else {
        batchExtractBtn.style.display = 'none';
      }
    }
    
    // 更新详情提取统计
    this.updateDetailExtractionStatsUI();
  }

  // 更新详情提取统计UI
  updateDetailExtractionStatsUI() {
    const statsSection = document.getElementById('detailExtractionStats');
    const supportedCount = document.getElementById('supportedCount');
    const extractedCount = document.getElementById('extractedCount');
    const successRate = document.getElementById('successRate');
    
    if (statsSection && this.detailExtractionAvailable && this.detailExtractionEnabled) {
      statsSection.style.display = 'block';
      
      if (supportedCount) {
        const currentResults = unifiedSearchManager.currentResults || [];
        const supportedResults = currentResults.filter(result => 
          APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES.includes(result.source)
        );
        supportedCount.textContent = supportedResults.length;
      }
      
      if (extractedCount) {
        extractedCount.textContent = this.detailExtractionStats.successfulExtractions;
      }
      
      if (successRate) {
        successRate.textContent = `${Math.round(this.detailExtractionStats.successRate * 100)}%`;
      }
    } else if (statsSection) {
      statsSection.style.display = 'none';
    }
  }

  // 显示详情提取功能通知
  showDetailExtractionNotification() {
    const notificationShown = localStorage.getItem('detailExtractionNotificationShown');
    if (notificationShown) return;

    setTimeout(() => {
      const enable = confirm(
        '🆕 新功能提醒\n\n' +
        '详情提取功能现已可用！\n' +
        '可以自动获取番号的详细信息，包括：\n' +
        '• 高清封面图片和截图\n' +
        '• 演员信息和作品详情\n' +
        '• 直接可用的下载链接\n' +
        '• 磁力链接和种子信息\n' +
        `• 支持 ${this.detailServiceStatus.supportedSources.length} 个搜索源\n\n` +
        '是否立即启用此功能？'
      );

      if (enable) {
        this.enableDetailExtraction();
      }

      localStorage.setItem('detailExtractionNotificationShown', 'true');
    }, 2000);
  }

  // 启用详情提取功能
  async enableDetailExtraction() {
    if (!this.detailExtractionAvailable) {
      showToast('详情提取功能当前不可用', 'warning');
      return;
    }

    try {
      const userSettings = await apiService.getUserSettings();
      await apiService.updateUserSettings({
        ...userSettings,
        enableDetailExtraction: true
      });
      
      this.detailExtractionEnabled = true;
      
      // 通知统一搜索管理器重新加载配置
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.loadUserConfig();
      }
      
      // 更新UI
      this.updateDetailExtractionUI();
      
      showToast('详情提取功能已启用！', 'success');
      
      // 触发状态变更事件
      window.dispatchEvent(new CustomEvent('detailExtractionStateChanged', {
        detail: { enabled: true }
      }));
      
    } catch (error) {
      console.error('启用详情提取功能失败:', error);
      showToast('启用详情提取功能失败: ' + error.message, 'error');
    }
  }

  // 切换详情提取功能
  async toggleDetailExtraction() {
    if (!this.currentUser) {
      showToast('请先登录后使用详情提取功能', 'error');
      return;
    }

    if (!this.detailExtractionAvailable) {
      showToast('详情提取功能当前不可用', 'warning');
      return;
    }

    try {
      const newState = !this.detailExtractionEnabled;
      const userSettings = await apiService.getUserSettings();
      
      await apiService.updateUserSettings({
        ...userSettings,
        enableDetailExtraction: newState
      });
      
      this.detailExtractionEnabled = newState;
      
      // 通知统一搜索管理器重新加载配置
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.loadUserConfig();
      }
      
      // 更新UI
      this.updateDetailExtractionUI();
      
      // 触发状态变更事件
      window.dispatchEvent(new CustomEvent('detailExtractionStateChanged', {
        detail: { enabled: newState }
      }));
      
      showToast(`详情提取功能已${newState ? '启用' : '禁用'}`, 'success');
      
    } catch (error) {
      console.error('切换详情提取功能失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 获取详情提取服务状态
  getDetailExtractionServiceStatus() {
    return {
      available: this.detailExtractionAvailable,
      enabled: this.detailExtractionEnabled,
      config: this.detailExtractionConfig,
      stats: this.detailExtractionStats,
      serviceStatus: this.detailServiceStatus
    };
  }

  // 初始化站点导航
  async initSiteNavigation() {
    try {
      this.renderSiteNavigation(this.allSearchSources.map(source => source.id));
    } catch (error) {
      console.error('初始化站点导航失败:', error);
      const allBuiltinSourceIds = APP_CONSTANTS.SEARCH_SOURCES.map(source => source.id);
      this.renderSiteNavigation(allBuiltinSourceIds);
    }
  }

  // 渲染站点导航
  renderSiteNavigation(sourceIds = null) {
    const sitesSection = document.getElementById('sitesSection');
    if (!sitesSection) return;

    let sourcesToDisplay;
    if (sourceIds && Array.isArray(sourceIds)) {
      sourcesToDisplay = this.allSearchSources.filter(source => 
        sourceIds.includes(source.id)
      );
    } else {
      sourcesToDisplay = this.allSearchSources;
    }

    if (sourcesToDisplay.length === 0) {
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

    const sourcesByCategory = this.groupSourcesByCategory(sourcesToDisplay);

    let navigationHTML = `
      <h2>🌐 资源站点导航</h2>
      ${this.detailExtractionAvailable ? `
        <div class="detail-extraction-notice">
          <span class="notice-icon">✨</span>
          <span>标有 <strong>🔋</strong> 的站点支持详情提取功能</span>
          ${!this.detailExtractionEnabled ? `
            <button onclick="window.app.enableDetailExtraction()" class="enable-detail-btn">启用详情提取</button>
          ` : ''}
        </div>
      ` : ''}
      <div class="sites-grid">
    `;
    
    this.allCategories
      .filter(category => sourcesByCategory[category.id] && sourcesByCategory[category.id].length > 0)
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .forEach(category => {
        const sources = sourcesByCategory[category.id];
        navigationHTML += `
          <div class="site-category">
            <h3 style="color: ${category.color || '#6b7280'}">${category.icon} ${category.name}</h3>
            <div class="site-list">
              ${sources.map(source => this.renderSiteItem(source)).join('')}
            </div>
          </div>
        `;
      });
    
    navigationHTML += '</div>';
    sitesSection.innerHTML = navigationHTML;
  }

  // 渲染单个站点项
  renderSiteItem(source) {
    const isEnabled = this.enabledSources.includes(source.id);
    const statusClass = isEnabled ? 'enabled' : 'disabled';
    const statusText = isEnabled ? '已启用' : '未启用';
    const supportsDetailExtraction = source.supportsDetailExtraction || APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES.includes(source.id);
    
    // 详情提取质量标识
    let qualityBadge = '';
    if (supportsDetailExtraction && source.extractionQuality) {
      const qualityColors = {
        'excellent': '#10b981',
        'good': '#3b82f6',
        'fair': '#f59e0b',
        'poor': '#ef4444'
      };
      const qualityTexts = {
        'excellent': '优质',
        'good': '良好',
        'fair': '一般',
        'poor': '较差'
      };
      qualityBadge = `<span class="quality-badge" style="background-color: ${qualityColors[source.extractionQuality]}20; color: ${qualityColors[source.extractionQuality]}">${qualityTexts[source.extractionQuality]}</span>`;
    }
    
    return `
      <a href="${source.urlTemplate.replace('{keyword}', 'search')}" 
         target="_blank" 
         class="site-item ${statusClass}" 
         rel="noopener noreferrer"
         title="${source.subtitle || source.name} - ${statusText}${supportsDetailExtraction ? ' - 支持详情提取' : ''}">
        <div class="site-info">
          <div class="site-header">
            <strong>${source.icon} ${source.name}</strong>
            <div class="site-badges">
              ${source.isCustom ? '<span class="custom-badge">自定义</span>' : ''}
              ${supportsDetailExtraction ? '<span class="detail-support-badge">🔋</span>' : ''}
              ${qualityBadge}
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
          <span class="site-subtitle">${source.subtitle || ''}</span>
          ${supportsDetailExtraction && source.extractionFeatures ? `
            <div class="extraction-features">
              <small>支持：${source.extractionFeatures.map(f => {
                const featureNames = {
                  'cover': '封面',
                  'screenshots': '截图',
                  'actresses': '演员',
                  'download_links': '下载',
                  'magnet_links': '磁力',
                  'metadata': '元数据',
                  'tags': '标签',
                  'ratings': '评分'
                };
                return featureNames[f] || f;
              }).join('、')}</small>
            </div>
          ` : ''}
        </div>
      </a>
    `;
  }

  // 按分类组织搜索源
  groupSourcesByCategory(sources) {
    const grouped = {};
    
    sources.forEach(source => {
      const categoryId = source.category || 'others';
      if (!grouped[categoryId]) {
        grouped[categoryId] = [];
      }
      grouped[categoryId].push(source);
    });
    
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
      await unifiedSearchManager.init();
      await favoritesManager.init();
      await detailCardManager.init();
      
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
        if (unifiedSearchManager.isInitialized) {
          setTimeout(() => {
            unifiedSearchManager.performSearch();
          }, 500);
        }
      }
    }
  }

  // 绑定事件
  bindEvents() {
    this.bindModalEvents();
    this.bindKeyboardShortcuts();
    this.bindNetworkEvents();
    this.bindSearchSourcesChangeEvent();
    this.bindDetailExtractionEvents();
  }

  // 绑定详情提取相关事件
  bindDetailExtractionEvents() {
    // 监听详情提取状态变更
    window.addEventListener('detailExtractionStateChanged', async (event) => {
      console.log('检测到详情提取状态变更:', event.detail);
      
      try {
        this.detailExtractionEnabled = event.detail.enabled;
        this.updateDetailExtractionUI();
        this.renderSiteNavigation();
        
        showToast(`详情提取功能已${this.detailExtractionEnabled ? '启用' : '禁用'}`, 'success', 2000);
      } catch (error) {
        console.error('处理详情提取状态变更失败:', error);
      }
    });

    // 监听详情提取配置变更
    window.addEventListener('detailExtractionConfigChanged', async (event) => {
      console.log('检测到详情提取配置变更:', event.detail);
      
      try {
        if (unifiedSearchManager.isInitialized) {
          await unifiedSearchManager.loadUserConfig();
        }
        
        showToast('详情提取配置已更新', 'success', 2000);
      } catch (error) {
        console.error('处理详情提取配置变更失败:', error);
      }
    });

    // 监听详情提取统计更新
    window.addEventListener('detailExtractionStatsUpdated', (event) => {
      this.detailExtractionStats = {
        ...this.detailExtractionStats,
        ...event.detail
      };
      this.updateDetailExtractionStatsUI();
    });
  }

  // 其他方法保持不变...
  // [省略其他已有的方法以节省空间]

  // 导出应用状态（调试用）
  exportAppStatus() {
    return {
      isInitialized: this.isInitialized,
      connectionStatus: this.connectionStatus,
      currentUser: this.currentUser ? {
        username: this.currentUser.username,
        id: this.currentUser.id
      } : null,
      detailExtraction: this.getDetailExtractionServiceStatus(),
      searchSources: {
        total: this.allSearchSources.length,
        enabled: this.enabledSources.length,
        custom: this.customSearchSources.length
      },
      timestamp: Date.now(),
      version: APP_CONSTANTS.DEFAULT_VERSION
    };
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