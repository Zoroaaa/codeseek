// 主应用入口 - 集成统一搜索组件和配置管理架构，新增邮箱验证功能支持
import { APP_CONSTANTS } from '../../core/constants.js';
import configManager from '../../core/config.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { isDevEnv } from '../../utils/helpers.js';
import networkUtils from '../../utils/network.js';
import authManager from '../../services/auth.js';
import themeManager from '../../services/theme.js';
import unifiedSearchManager from '../../components/search.js';
import detailCardManager from '../../components/detail-card.js';
import detailAPIService from '../../services/detail-api.js';
import favoritesManager from '../../components/favorites.js';
import apiService from '../../services/api.js';
// 🆕 导入邮箱验证服务和UI组件
import emailVerificationService from '../../services/email-verification-service.js';
import { emailVerificationUI } from '../../components/email-verification-ui.js';

class MagnetSearchApp {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.connectionStatus = APP_CONSTANTS.CONNECTION_STATUS?.CHECKING || 'checking';
    
    // 搜索源和分类管理 - 简化版本，主要通过统一搜索管理器处理
    this.allSearchSources = [];
    this.allCategories = [];
    
    // 详情提取功能状态
    this.detailExtractionAvailable = false;
    this.detailExtractionEnabled = false;
    
    // 详情提取统计信息 - 通过统一搜索管理器获取
    this.detailExtractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageTime: 0,
      lastExtraction: null
    };
    
    // 性能监控
    this.performanceMetrics = {
      initTime: 0,
      searchCount: 0,
      extractionCount: 0,
      errorCount: 0
    };
    
    this.init();
  }

  async init() {
    const startTime = performance.now();
    
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
      
      // 初始化主题（仅从localStorage读取主题设置）
      themeManager.init();
      
      // 🆕 初始化邮箱验证服务
      await this.initEmailVerificationService();
      
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
        // 检查详情提取功能可用性
        await this.checkDetailExtractionAvailability();
        // 初始化详情提取UI
        await this.initDetailExtractionUI();
      }

      // 初始化站点导航
      await this.initSiteNavigation();

      // 测试API连接
      await this.testConnection();
      
      // 处理URL参数（如搜索关键词）
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
      showToast('应用初始化失败，请刷新页面重试', 'error', 5000);
    } finally {
      showLoading(false);
    }
  }

  // 🆕 初始化邮箱验证服务
  async initEmailVerificationService() {
    try {
      console.log('🔐 初始化邮箱验证服务...');
      
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

  // 从constants.js加载内置数据
  loadBuiltinData() {
    try {
      // 加载内置搜索源
      const builtinSources = (APP_CONSTANTS.SEARCH_SOURCES || []).map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      
      // 加载内置分类
      const builtinCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES || {}).map(category => ({
        ...category,
        isBuiltin: true,
        isCustom: false
      }));
      
      console.log(`从constants.js加载了 ${builtinSources.length} 个内置搜索源和 ${builtinCategories.length} 个内置分类`);
      
      // 初始化数据
      this.allSearchSources = [...builtinSources];
      this.allCategories = [...builtinCategories];
      
    } catch (error) {
      console.error('加载内置数据失败:', error);
      this.performanceMetrics.errorCount++;
      // 使用空数组作为备份
      this.allSearchSources = [];
      this.allCategories = [];
    }
  }

  // 检查详情提取功能可用性 - 通过统一搜索管理器
  async checkDetailExtractionAvailability() {
    if (!this.currentUser) {
      this.detailExtractionAvailable = false;
      this.updateDetailExtractionUI(false);
      return;
    }

    try {
      // 通过统一搜索管理器检查详情提取服务健康状态
      const healthCheck = await detailAPIService.checkServiceHealth();
      this.detailExtractionAvailable = healthCheck.healthy;
      
      if (this.detailExtractionAvailable) {
        // 获取当前详情提取配置和统计
        const configSummary = await detailAPIService.getEffectiveConfigSummary();
        this.detailExtractionEnabled = configSummary.extractionEnabled;
        
        // 获取统计信息
        try {
          const stats = await detailAPIService.getStats();
          this.updateDetailExtractionStats(stats);
        } catch (error) {
          console.warn('获取详情提取统计失败:', error);
        }
        
        // 如果后端支持但用户未启用，显示提示
        if (this.detailExtractionAvailable && !this.detailExtractionEnabled) {
          this.showDetailExtractionNotification();
        }
      }
      
      this.updateDetailExtractionUI(this.detailExtractionAvailable);
      
      console.log(`详情提取功能：${this.detailExtractionAvailable ? '可用' : '不可用'}，用户设置：${this.detailExtractionEnabled ? '启用' : '禁用'}`);
      
    } catch (error) {
      console.warn('检查详情提取功能可用性失败:', error);
      this.detailExtractionAvailable = false;
      this.updateDetailExtractionUI(false);
    }
  }

  // 更新详情提取UI状态
  updateDetailExtractionUI(available) {
    const detailToggleBtn = document.getElementById('detailExtractionToggle');
    const detailStatusSection = document.getElementById('detailExtractionStatus');
    const detailStatusBadge = document.getElementById('detailStatusBadge');
    const detailStatusDescription = document.getElementById('detailStatusDescription');
    const batchExtractBtn = document.getElementById('batchExtractBtn');
    const enableDetailCheckbox = document.getElementById('enableDetailExtraction');
    
    if (detailToggleBtn) {
      detailToggleBtn.style.display = available ? 'inline-block' : 'none';
      detailToggleBtn.classList.toggle('active', this.detailExtractionEnabled);
      detailToggleBtn.title = this.detailExtractionEnabled ? '禁用详情提取' : '启用详情提取';
    }
    
    if (detailStatusSection) {
      detailStatusSection.style.display = available ? 'block' : 'none';
    }
    
    if (detailStatusBadge) {
      detailStatusBadge.textContent = available ? 
        (this.detailExtractionEnabled ? '已启用' : '未启用') : '不可用';
      detailStatusBadge.className = `status-badge ${available ? 
        (this.detailExtractionEnabled ? 'enabled' : 'disabled') : 'unavailable'}`;
    }
    
    if (detailStatusDescription) {
      if (available) {
        detailStatusDescription.textContent = this.detailExtractionEnabled ? 
          '详情提取功能已启用，可以自动获取番号的详细信息。' :
          '详情提取功能可用但未启用，点击上方按钮开启。';
      } else {
        detailStatusDescription.textContent = '详情提取功能当前不可用，可能需要登录或后端服务未启动。';
      }
    }
    
    if (batchExtractBtn) {
      batchExtractBtn.style.display = (available && this.detailExtractionEnabled) ? 'inline-block' : 'none';
    }
    
    if (enableDetailCheckbox) {
      enableDetailCheckbox.disabled = !available;
      enableDetailCheckbox.checked = this.detailExtractionEnabled;
    }
  }

  // 初始化详情提取UI组件
  async initDetailExtractionUI() {
    try {
      // 更新详情提取统计显示
      this.updateDetailExtractionStatsDisplay();
      
      // 绑定详情提取相关事件
      this.bindDetailExtractionEvents();
      
      // 如果用户已启用详情提取，确保详情卡片管理器已初始化
      if (this.detailExtractionEnabled && !detailCardManager.isInitialized) {
        await detailCardManager.init();
      }
      
    } catch (error) {
      console.error('初始化详情提取UI失败:', error);
    }
  }

  // 绑定详情提取相关事件
  bindDetailExtractionEvents() {
    // 监听详情配置变更事件（从统一搜索管理器发出）
    document.addEventListener('searchConfigChanged', (event) => {
      if (event.detail.config) {
        const config = event.detail.config;
        
        // 更新详情提取启用状态
        if (config.enableDetailExtraction !== this.detailExtractionEnabled) {
          this.detailExtractionEnabled = config.enableDetailExtraction;
          this.updateDetailExtractionUI(this.detailExtractionAvailable);
          
          // 触发状态变更事件
          this.dispatchDetailExtractionStateChanged();
        }
      }
    });

    // 监听详情提取完成事件
    document.addEventListener('detailExtractionCompleted', (event) => {
      if (event.detail.stats) {
        this.updateDetailExtractionStats(event.detail.stats);
        this.updateDetailExtractionStatsDisplay();
        this.performanceMetrics.extractionCount++;
      }
    });

    // 绑定详情提取切换按钮
    const detailToggleBtn = document.getElementById('detailExtractionToggle');
    if (detailToggleBtn) {
      detailToggleBtn.addEventListener('click', () => this.toggleDetailExtraction());
    }

    // 绑定批量提取按钮
    const batchExtractBtn = document.getElementById('batchExtractBtn');
    if (batchExtractBtn) {
      batchExtractBtn.addEventListener('click', () => this.batchExtractDetails());
    }
  }

  // 触发详情提取状态变更事件
  dispatchDetailExtractionStateChanged() {
    window.dispatchEvent(new CustomEvent('detailExtractionStateChanged', {
      detail: { enabled: this.detailExtractionEnabled }
    }));
  }

  // 更新详情提取统计信息
  updateDetailExtractionStats(stats) {
    if (stats.user) {
      this.detailExtractionStats = {
        totalExtractions: stats.user.totalExtractions || 0,
        successfulExtractions: stats.user.successfulExtractions || 0,
        failedExtractions: stats.user.failedExtractions || 0,
        cacheHits: stats.user.cacheItems || 0,
        averageTime: stats.performance?.averageTime || 0,
        lastExtraction: stats.user.lastExtraction || null
      };
    }
  }

  // 更新详情提取统计显示
  updateDetailExtractionStatsDisplay() {
    const statsContainer = document.getElementById('detailExtractionStats');
    const supportedCount = document.getElementById('supportedCount');
    const extractedCount = document.getElementById('extractedCount');
    const successRate = document.getElementById('successRate');
    
    if (this.detailExtractionStats.totalExtractions > 0) {
      const rate = Math.round((this.detailExtractionStats.successfulExtractions / this.detailExtractionStats.totalExtractions) * 100);
      
      if (supportedCount) {
        // 通过统一搜索管理器获取支持详情提取的搜索源数量
        try {
          const config = unifiedSearchManager.configManager?.getConfig() || {};
          const supportedSources = this.allSearchSources.filter(source => 
            this.supportsDetailExtraction(source.id)
          ).length;
          supportedCount.textContent = supportedSources;
        } catch (error) {
          supportedCount.textContent = '0';
        }
      }
      
      if (extractedCount) {
        extractedCount.textContent = this.detailExtractionStats.totalExtractions;
      }
      
      if (successRate) {
        successRate.textContent = `${rate}%`;
      }
      
      if (statsContainer) {
        statsContainer.style.display = 'block';
      }
    } else if (statsContainer) {
      statsContainer.style.display = 'none';
    }
  }

  // 显示详情提取功能通知
  showDetailExtractionNotification() {
    // 检查是否已经显示过通知
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
        '• 磁力链接和种子信息\n\n' +
        '是否立即启用此功能？'
      );

      if (enable) {
        this.enableDetailExtraction();
      }

      // 标记通知已显示
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
      // 通过统一搜索管理器的配置管理器更新配置
      if (unifiedSearchManager.configManager) {
        await unifiedSearchManager.configManager.updateDisplayConfig({
          enableDetailExtraction: true
        });
        
        this.detailExtractionEnabled = true;
        
        // 确保详情卡片管理器已初始化
        if (!detailCardManager.isInitialized) {
          await detailCardManager.init();
        }
        
        // 更新UI
        this.updateDetailExtractionUI(this.detailExtractionAvailable);
        
        showToast('详情提取功能已启用！', 'success');
        
        // 触发状态变更事件
        this.dispatchDetailExtractionStateChanged();
      } else {
        throw new Error('配置管理器未初始化');
      }
      
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
      
      // 通过统一搜索管理器的配置管理器更新配置
      if (unifiedSearchManager.configManager) {
        await unifiedSearchManager.configManager.updateDisplayConfig({
          enableDetailExtraction: newState
        });
        
        this.detailExtractionEnabled = newState;
        
        // 如果启用，确保详情卡片管理器已初始化
        if (newState && !detailCardManager.isInitialized) {
          await detailCardManager.init();
        }
        
        // 更新UI
        this.updateDetailExtractionUI(this.detailExtractionAvailable);
        
        // 触发状态变更事件
        this.dispatchDetailExtractionStateChanged();
        
        showToast(`详情提取功能已${newState ? '启用' : '禁用'}`, 'success');
      } else {
        throw new Error('配置管理器未初始化');
      }
      
    } catch (error) {
      console.error('切换详情提取功能失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 批量提取详情
  async batchExtractDetails() {
    if (!this.detailExtractionEnabled) {
      showToast('请先启用详情提取功能', 'warning');
      return;
    }

    // 通过统一搜索管理器执行批量提取
    if (unifiedSearchManager.isInitialized && unifiedSearchManager.extractionManager) {
      try {
        const currentResults = unifiedSearchManager.resultsRenderer.getCurrentResults();
        
        if (!currentResults || currentResults.length === 0) {
          showToast('没有搜索结果可以提取详情', 'warning');
          return;
        }

        // 筛选支持详情提取的结果
        const supportedResults = currentResults.filter(result => 
          this.supportsDetailExtraction(result.source)
        );

        if (supportedResults.length === 0) {
          showToast('当前搜索结果中没有支持详情提取的源', 'info');
          return;
        }

        // 获取当前配置
        const config = unifiedSearchManager.configManager.getConfig();
        const maxCount = Math.min(supportedResults.length, config.maxAutoExtractions || 5);
        
        const count = prompt(`发现 ${supportedResults.length} 个支持详情提取的结果\n请输入要提取的数量 (最多 ${maxCount} 个):`, maxCount.toString());
        
        if (!count || isNaN(count) || count < 1) return;
        
        const extractCount = Math.min(parseInt(count), maxCount);
        const resultsToExtract = supportedResults.slice(0, extractCount);

        // 执行批量提取
        showToast(`开始批量提取 ${extractCount} 个结果的详情...`, 'info');
        
        await unifiedSearchManager.extractionManager.handleDetailExtraction(
          resultsToExtract,
          document.getElementById('searchInput')?.value || '',
          config
        );
        
        // 更新性能计数
        this.performanceMetrics.extractionCount += extractCount;
        
      } catch (error) {
        console.error('批量提取详情失败:', error);
        showToast('批量提取失败: ' + error.message, 'error');
        this.performanceMetrics.errorCount++;
      }
    } else {
      showToast('搜索管理器未正确初始化', 'error');
    }
  }

  // 初始化站点导航 - 集成统一搜索管理器
  async initSiteNavigation() {
    try {
      // 获取所有可用的搜索源（通过统一搜索管理器）
      let searchSources = this.allSearchSources;
      
      // 如果统一搜索管理器已初始化，获取其配置的搜索源
      if (unifiedSearchManager.isInitialized && unifiedSearchManager.configManager) {
        try {
          const config = unifiedSearchManager.configManager.getConfig();
          // 这里可以根据配置过滤搜索源，但当前保持显示所有源
          this.renderSiteNavigation(searchSources);
        } catch (error) {
          console.warn('获取搜索配置失败，使用默认配置:', error);
          this.renderSiteNavigation(searchSources);
        }
      } else {
        this.renderSiteNavigation(searchSources);
      }
    } catch (error) {
      console.error('初始化站点导航失败:', error);
      // 出错时使用默认配置中的所有内置源
      const allBuiltinSources = (APP_CONSTANTS.SEARCH_SOURCES || []).map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      this.renderSiteNavigation(allBuiltinSources);
    }
  }

  // 渲染站点导航 - 显示所有搜索源，并标识详情提取支持
  renderSiteNavigation(sourcesToDisplay = null) {
    const sitesSection = document.getElementById('sitesSection');
    if (!sitesSection) return;

    // 如果没有传入特定的源列表，则显示所有搜索源
    let sources;
    if (sourcesToDisplay && Array.isArray(sourcesToDisplay)) {
      sources = sourcesToDisplay;
    } else {
      sources = this.allSearchSources;
    }

    // 如果没有可显示的搜索源，显示提示
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

    // 按分类组织搜索源
    const sourcesByCategory = this.groupSourcesByCategory(sources);

    // 生成HTML
    let navigationHTML = `
      <h2>🌐 资源站点导航</h2>
      ${this.detailExtractionAvailable ? `
        <div class="detail-extraction-notice">
          <span class="notice-icon">✨</span>
          <span>标有 <strong>📋</strong> 的站点支持详情提取功能</span>
          ${!this.detailExtractionEnabled ? `
            <button onclick="window.app.enableDetailExtraction()" class="enable-detail-btn">启用详情提取</button>
          ` : ''}
        </div>
      ` : ''}
      <div class="sites-grid">
    `;
    
    // 按分类顺序渲染
    this.allCategories
      .filter(category => sourcesByCategory[category.id] && sourcesByCategory[category.id].length > 0)
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .forEach(category => {
        const categorySources = sourcesByCategory[category.id];
        const supportedCount = categorySources.filter(s => this.supportsDetailExtraction(s.id)).length;
        
        navigationHTML += `
          <div class="site-category">
            <h3 style="color: ${category.color || '#6b7280'}">
              ${category.icon} ${category.name}
              ${supportedCount > 0 ? `<span class="detail-support-count">(${supportedCount}个支持详情提取)</span>` : ''}
            </h3>
            <div class="site-list">
              ${categorySources.map(source => this.renderSiteItem(source)).join('')}
            </div>
          </div>
        `;
      });
    
    navigationHTML += '</div>';
    sitesSection.innerHTML = navigationHTML;
  }

  // 渲染单个站点项，包含启用状态和详情提取支持标识
  renderSiteItem(source) {
    // 通过统一搜索管理器检查源的启用状态
    let isEnabled = true; // 默认显示为启用，具体启用状态由搜索时判断
    
    try {
      if (unifiedSearchManager.isInitialized && unifiedSearchManager.configManager) {
        const config = unifiedSearchManager.configManager.getConfig();
        // 这里可以添加检查逻辑，当前简化处理
      }
    } catch (error) {
      console.warn('检查搜索源启用状态失败:', error);
    }

    const statusClass = isEnabled ? 'enabled' : 'disabled';
    const statusText = isEnabled ? '可用' : '未启用';
    const supportsDetailExtraction = this.supportsDetailExtraction(source.id);
    
    return `
      <a href="${source.urlTemplate ? source.urlTemplate.replace('{keyword}', 'search') : '#'}" 
         target="_blank" 
         class="site-item ${statusClass}" 
         rel="noopener noreferrer"
         title="${source.subtitle || source.name} - ${statusText}${supportsDetailExtraction ? ' - 支持详情提取' : ''}">
        <div class="site-info">
          <div class="site-header">
            <strong>${source.icon || '🔍'} ${source.name}</strong>
            <div class="site-badges">
              ${source.isCustom ? '<span class="custom-badge">自定义</span>' : ''}
              ${supportsDetailExtraction ? '<span class="detail-support-badge">📋</span>' : ''}
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
          <span class="site-subtitle">${source.subtitle || ''}</span>
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
      // 初始化统一搜索管理器
      await unifiedSearchManager.init();
      
      // 初始化详情卡片管理器（如果需要）
      if (this.detailExtractionEnabled || this.detailExtractionAvailable) {
        await detailCardManager.init();
      }
      
      // 初始化收藏管理器
      await favoritesManager.init();
      
      console.log('✅ 组件初始化完成');
    } catch (error) {
      console.error('组件初始化失败:', error);
      this.performanceMetrics.errorCount++;
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
        // 如果已初始化统一搜索管理器，则自动执行搜索
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
    
    // 监听统一搜索管理器的搜索事件，更新性能计数
    document.addEventListener('searchResultsRendered', () => {
      this.performanceMetrics.searchCount++;
    });

    // 🆕 绑定邮箱验证相关事件
    this.bindEmailVerificationEvents();
  }

  // 🆕 绑定邮箱验证相关事件
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
      showToast('验证码已过期，请重新获取', 'warning');
    });
  }

  // 🆕 处理账户删除
  async handleAccountDeleted() {
    try {
      // 清除当前用户信息
      this.currentUser = null;
      
      // 清除本地存储
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.USER_INFO);
      
      // 重置应用状态
      this.detailExtractionEnabled = false;
      this.detailExtractionAvailable = false;
      this.updateDetailExtractionUI(false);
      
      // 清空搜索管理器数据
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.cleanup();
      }
      
      // 清空收藏管理器数据
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      showToast('账户已删除，正在跳转...', 'info');
      
      // 跳转到主页
      setTimeout(() => {
        window.location.href = './index.html';
      }, 2000);
      
    } catch (error) {
      console.error('处理账户删除失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  // 修改：用户登录后更新站点导航
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
        
        // 重新初始化站点导航（显示所有源）
        await this.initSiteNavigation();
        
        // 检查详情提取功能可用性
        await this.checkDetailExtractionAvailability();
        
        // 初始化详情提取UI
        await this.initDetailExtractionUI();
        
        // 处理URL参数（如搜索查询）
        this.handleURLParams();
        
        // 清空登录表单
        document.getElementById('loginForm').reset();
        
        this.performanceMetrics.searchCount = 0; // 重置搜索计数
      }
    } catch (error) {
      console.error('登录失败:', error);
      this.performanceMetrics.errorCount++;
    }
  }

  // 绑定模态框事件
  bindModalEvents() {
    const loginBtn = document.getElementById('loginBtn');
    const closeBtns = document.querySelectorAll('.close');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const showPasswordReset = document.getElementById('showPasswordReset'); // 🆕

    if (loginBtn) loginBtn.addEventListener('click', () => this.showLoginModal());
    if (showRegister) showRegister.addEventListener('click', (e) => {
      e.preventDefault();
      this.showRegisterModal();
    });
    if (showLogin) showLogin.addEventListener('click', (e) => {
      e.preventDefault();
      this.showLoginModal();
    });
    
    // 🆕 忘记密码链接
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
      
      // F5 刷新详情提取统计
      if (e.key === 'F5' && e.shiftKey && this.detailExtractionEnabled) {
        e.preventDefault();
        this.refreshDetailExtractionStats();
      }
    });
  }

  // 刷新详情提取统计
  async refreshDetailExtractionStats() {
    try {
      if (!this.detailExtractionEnabled) return;
      
      showToast('正在刷新详情提取统计...', 'info');
      
      const stats = await detailAPIService.getStats();
      this.updateDetailExtractionStats(stats);
      this.updateDetailExtractionStatsDisplay();
      
      showToast('详情提取统计已刷新', 'success');
    } catch (error) {
      console.error('刷新详情提取统计失败:', error);
      showToast('刷新统计失败', 'error');
    }
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

  // 🆕 修改处理注册 - 集成邮箱验证
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
      // 🆕 使用邮箱验证流程
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
      this.performanceMetrics.errorCount++;
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

  // 修改：退出登录时重置为默认显示
  async logout() {
    try {
      await authManager.logout();
      this.currentUser = null;
      
      // 更新UI
      this.updateUserUI();
      
      // 清空统一搜索管理器数据
      if (unifiedSearchManager.isInitialized) {
        await unifiedSearchManager.cleanup();
        // 重新初始化为未登录状态
        await unifiedSearchManager.init();
      }
      
      if (favoritesManager.isInitialized) {
        favoritesManager.favorites = [];
        favoritesManager.renderFavorites();
      }
      
      // 重置详情提取状态
      this.detailExtractionAvailable = false;
      this.detailExtractionEnabled = false;
      this.updateDetailExtractionUI(false);
      
      // 重置为默认内置搜索源，但站点导航仍显示所有源
      this.allSearchSources = (APP_CONSTANTS.SEARCH_SOURCES || []).map(s => ({ 
        ...s, 
        isBuiltin: true, 
        isCustom: false 
      }));
      this.allCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES || {}).map(c => ({ 
        ...c, 
        isBuiltin: true, 
        isCustom: false 
      }));
      
      // 重新初始化站点导航（显示所有内置源）
      await this.initSiteNavigation();
      
      // 显示登录模态框
      this.showLoginModal();
      
      // 隐藏主界面
      document.querySelector('.main-content').style.display = 'none';
      
      // 重置性能指标
      this.performanceMetrics = {
        initTime: this.performanceMetrics.initTime, // 保留初始化时间
        searchCount: 0,
        extractionCount: 0,
        errorCount: 0
      };
      
    } catch (error) {
      console.error('退出登录失败:', error);
      this.performanceMetrics.errorCount++;
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

  // 检查搜索源是否支持详情提取
  supportsDetailExtraction(sourceId) {
    const detailSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [];
    return detailSources.includes(sourceId);
  }

  // 获取应用性能统计
  getPerformanceStats() {
    const stats = {
      ...this.performanceMetrics,
      detailExtractionStats: this.detailExtractionStats,
      uptime: this.isInitialized ? performance.now() - this.performanceMetrics.initTime : 0,
      memoryUsage: performance.memory ? {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      } : null
    };
    
    // 计算错误率
    const totalOperations = stats.searchCount + stats.extractionCount;
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
      detailExtractionEnabled: this.detailExtractionEnabled,
      detailExtractionStats: this.detailExtractionStats,
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
    showToast('应用出现错误，请刷新页面重试', 'error');
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