// src/components/search/SearchResultsRenderer.js - 升级版搜索结果渲染器 v4.0.0
// 集成代理功能v4.0.0，支持所有新特性，保留所有原有非代理功能
import { APP_CONSTANTS } from '../../core/constants.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../../utils/format.js';
import favoritesManager from '../favorites.js';
import authManager from '../../services/auth.js';
import proxyService from '../../services/proxy-service.js';
import { proxyConfig } from '../../core/proxy-config.js';

export class SearchResultsRenderer {
  constructor() {
    this.currentResults = [];
    this.config = {};
    this.proxyEnabled = false;
    
    // v4.0.0: 新增状态追踪
    this.proxyStatus = 'disabled';
    this.healthStatus = 'unknown';
    this.performanceMetrics = {};
    
    // v4.0.0: 事件监听器管理
    this.eventListeners = [];
    
    console.log('[SearchResultsRenderer v4.0.0] Initializing...');
  }

  /**
   * v4.0.0 初始化渲染器
   */
  async init() {
    try {
      console.log('[SearchResultsRenderer v4.0.0] Starting initialization...');
      
      // 初始化代理服务
      const proxyInit = await proxyService.init();
      if (!proxyInit.success) {
        console.warn('[SearchResultsRenderer v4.0.0] Proxy service init failed:', proxyInit.error);
      }
      
      this.proxyEnabled = proxyService.isProxyEnabled();
      
      // 绑定事件
      this.bindResultsEvents();
      this.bindProxyEvents();
      
      // v4.0.0: 初始化状态监控
      this.initializeStatusMonitoring();
      
      console.log('[SearchResultsRenderer v4.0.0] Initialized successfully', {
        proxyEnabled: this.proxyEnabled,
        proxyStatus: proxyService.getProxyStatus(),
        version: proxyConfig.version
      });
      
      return { success: true };
    } catch (error) {
      console.error('[SearchResultsRenderer v4.0.0] Initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * v4.0.0 初始化状态监控
   */
  initializeStatusMonitoring() {
    // 定期更新性能指标显示
    const updateInterval = setInterval(() => {
      if (this.proxyEnabled) {
        const status = proxyService.getProxyStatus();
        this.performanceMetrics = status.performance;
        this.updatePerformanceDisplay();
      }
    }, 10000); // 每10秒更新一次

    this.eventListeners.push(() => clearInterval(updateInterval));
  }

  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('[SearchResultsRenderer v4.0.0] Invalid config object');
      return;
    }

    this.config = { ...this.config, ...config };
    console.log('[SearchResultsRenderer v4.0.0] Config updated:', this.config);
    
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  getConfig() {
    return { ...this.config };
  }

  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * v4.0.0 显示搜索结果（完全重写，集成所有新特性）
   */
  displaySearchResults(keyword, results, config) {
    console.log(`[SearchResultsRenderer v4.0.0] Displaying ${results.length} results for "${keyword}"`);
    
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // v4.0.0: 智能结果处理
    const processedResults = this.processResultsWithProxy(results);
    
    // 计算状态统计
    const statusStats = this.calculateStatusStats(processedResults);
    const proxyStats = this.calculateProxyStats(processedResults);
    
    // v4.0.0: 增强的搜索信息显示
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        statusInfo = ` | 可用: ${statusStats.available}/${processedResults.length}`;
        if (statusStats.unavailable > 0) {
          statusInfo += ` | 不可用: ${statusStats.unavailable}`;
        }
      }
      
      // v4.0.0: 代理统计信息
      let proxyInfo = '';
      if (this.proxyEnabled) {
        proxyInfo = ` | 代理访问: ${proxyStats.proxied}`;
        if (proxyStats.specialLinks > 0) {
          proxyInfo += ` | 特殊链接: ${proxyStats.specialLinks}`;
        }
      }
      
      // v4.0.0: 性能信息
      let performanceInfo = '';
      if (this.performanceMetrics.avgResponseTime) {
        performanceInfo = ` | 响应: ${this.performanceMetrics.avgResponseTime}ms`;
      }
      
      searchInfo.innerHTML = `
        <div class="search-info-main">
          搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
          (${processedResults.length}个结果${statusInfo}${proxyInfo}${performanceInfo})
        </div>
        <div class="search-info-meta">
          <small>${new Date().toLocaleString()} | v${proxyConfig.version.frontend}</small>
        </div>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      
      // v4.0.0: 创建完整的UI
      const proxyControlsHTML = this.createProxyControlsHTML();
      const performanceMonitorHTML = this.createPerformanceMonitorHTML();
      const resultsHTML = processedResults.map(result => this.createResultHTML(result, config)).join('');
      
      resultsContainer.innerHTML = `
        ${proxyControlsHTML}
        ${performanceMonitorHTML}
        <div class="results-list">
          ${resultsHTML}
        </div>
      `;
    }
    
    this.hideSearchStatus();
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // v4.0.0: 触发增强的结果渲染完成事件
    document.dispatchEvent(new CustomEvent('searchResultsRendered', {
      detail: { 
        keyword, 
        results: processedResults, 
        resultCount: processedResults.length,
        statusStats,
        proxyStats,
        proxyEnabled: this.proxyEnabled,
        version: proxyConfig.version
      }
    }));
  }

  /**
   * v4.0.0 智能结果处理（支持特殊协议和优化）
   */
  processResultsWithProxy(results) {
    return results.map(result => {
      const processed = { ...result };
      
      // v4.0.0: 检测特殊协议
      processed.isSpecialProtocol = this.isSpecialProtocol(result.url);
      processed.resourceType = this.detectResourceType(result.url);
      processed.domainCategory = this.getDomainCategory(result.url);
      
      if (this.proxyEnabled) {
        try {
          // 使用代理服务进行URL转换
          processed.proxyUrl = proxyService.convertToProxyUrl(result.url);
          processed.originalUrl = result.url;
          processed.isProxied = processed.proxyUrl !== result.url;
          processed.displayUrl = processed.isProxied ? processed.proxyUrl : result.url;
          
          // v4.0.0: 特殊协议保持原样
          if (processed.isSpecialProtocol) {
            processed.displayUrl = result.url;
            processed.isProxied = false; // 特殊协议不需要代理标记
            processed.preservedProtocol = true;
          }
        } catch (error) {
          console.warn(`[SearchResultsRenderer v4.0.0] URL conversion failed for ${result.url}:`, error);
          processed.displayUrl = result.url;
          processed.isProxied = false;
          processed.conversionError = error.message;
        }
      } else {
        processed.displayUrl = result.url;
        processed.isProxied = false;
      }
      
      return processed;
    });
  }

  /**
   * v4.0.0 创建增强的代理控制面板
   */
  createProxyControlsHTML() {
    const proxyStatus = proxyService.getProxyStatus();
    const isEnabled = proxyStatus.enabled;
    const isHealthy = proxyStatus.isHealthy !== false;
    
    // v4.0.0: 动态状态文本
    const getStatusText = () => {
      if (!isEnabled) return '🔓 启用代理模式';
      if (!isHealthy) return '⚠️ 代理服务异常';
      if (proxyStatus.status === 'smart') return '🧠 智能代理模式';
      return '🔒 代理已启用';
    };
    
    const statusClass = isEnabled ? 'proxy-enabled' : 'proxy-disabled';
    const healthClass = isHealthy ? 'proxy-healthy' : 'proxy-unhealthy';
    
    // v4.0.0: 详细状态信息
    let statusDetails = '';
    if (isEnabled) {
      const stats = proxyStatus.stats;
      const performance = proxyStatus.performance;
      
      statusDetails = `
        <div class="proxy-status-details">
          <div class="status-row">
            <span class="status-label">支持域名:</span>
            <span class="status-value">${proxyStatus.supportedDomains}</span>
            <span class="status-label">成功率:</span>  
            <span class="status-value">${performance.successRate}</span>
          </div>
          <div class="status-row">
            <span class="status-label">响应时间:</span>
            <span class="status-value">${performance.avgResponseTime}ms</span>
            <span class="status-label">缓存命中:</span>
            <span class="status-value">${(performance.cacheStats.hitRate * 100).toFixed(1)}%</span>
          </div>
          ${performance.redirectCount > 0 ? `
            <div class="status-row">
              <span class="status-label">重定向处理:</span>
              <span class="status-value">${performance.redirectCount}</span>
              <span class="status-label">特殊链接:</span>
              <span class="status-value">${performance.specialLinksProcessed}</span>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    return `
      <div class="proxy-controls-panel ${statusClass} ${healthClass}">
        <div class="proxy-header">
          <div class="proxy-title">
            <h3>代理控制中心 v${proxyConfig.version.frontend}</h3>
            <div class="proxy-version-info">
              <small>后端: v${proxyConfig.version.backend} | 前端: v${proxyConfig.version.frontend}</small>
            </div>
          </div>
          
          <div class="proxy-actions">
            <button class="proxy-toggle-btn ${statusClass}" id="proxyToggleBtn" data-action="toggleProxy">
              <span class="toggle-text">${getStatusText()}</span>
              <span class="toggle-indicator ${isEnabled ? 'enabled' : 'disabled'}"></span>
            </button>
            
            ${isEnabled ? `
              <button class="proxy-info-btn" id="proxyInfoBtn" data-action="showProxyInfo" title="查看详细状态">
                ℹ️
              </button>
              <button class="proxy-diagnostics-btn" id="proxyDiagnosticsBtn" data-action="runDiagnostics" title="运行诊断">
                🔧
              </button>
            ` : ''}
          </div>
        </div>
        
        ${statusDetails}
        
        ${!isHealthy && isEnabled ? `
          <div class="proxy-health-warning">
            <span class="warning-icon">⚠️</span>
            <span>代理服务器响应异常，可能影响访问效果</span>
          </div>
        ` : ''}
        
        <div class="proxy-help-text">
          <small>
            ${isEnabled ? 
              '代理模式已启用，搜索结果将通过代理服务器访问，支持磁力链接和特殊协议保护' : 
              '启用代理模式可访问受限制的搜索源，支持智能缓存和重定向处理'
            }
          </small>
        </div>
      </div>
    `;
  }

  /**
   * v4.0.0 创建性能监控面板
   */
  createPerformanceMonitorHTML() {
    if (!this.proxyEnabled) return '';
    
    const performance = this.performanceMetrics;
    const queueStatus = performance.queueStatus || {};
    const cacheStats = performance.cacheStats || {};
    
    return `
      <div class="performance-monitor-panel" id="performanceMonitor">
        <div class="performance-header">
          <h4>性能监控</h4>
          <button class="performance-toggle" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
            📊
          </button>
        </div>
        
        <div class="performance-metrics">
          <div class="metric-group">
            <div class="metric">
              <span class="metric-label">平均响应:</span>
              <span class="metric-value">${performance.avgResponseTime || 0}ms</span>
            </div>
            <div class="metric">
              <span class="metric-label">成功率:</span>
              <span class="metric-value">${performance.successRate || '100%'}</span>
            </div>
          </div>
          
          <div class="metric-group">
            <div class="metric">
              <span class="metric-label">队列长度:</span>
              <span class="metric-value">${queueStatus.queueLength || 0}</span>
            </div>
            <div class="metric">
              <span class="metric-label">活跃请求:</span>
              <span class="metric-value">${queueStatus.activeRequests || 0}</span>
            </div>
          </div>
          
          <div class="metric-group">
            <div class="metric">
              <span class="metric-label">缓存命中:</span>
              <span class="metric-value">${((cacheStats.hitRate || 0) * 100).toFixed(1)}%</span>
            </div>
            <div class="metric">
              <span class="metric-label">内存使用:</span>
              <span class="metric-value">${cacheStats.memoryUsage?.current || 0}KB</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * v4.0.0 创建增强的结果项HTML
   */
  createResultHTML(result, config) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    
    // v4.0.0: 状态指示器增强
    let statusIndicator = '';
    if (result.status) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status);
      
      let statusDetails = [];
      if (result.responseTime > 0) statusDetails.push(`响应: ${result.responseTime}ms`);
      if (result.qualityScore > 0) statusDetails.push(`质量: ${result.qualityScore}/100`);
      if (result.contentMatch) statusDetails.push('内容匹配');
      if (result.fromCache) statusDetails.push('缓存');
      
      const detailsText = statusDetails.length > 0 ? ` (${statusDetails.join(', ')})` : '';
      
      statusIndicator = `
        <div class="result-status ${statusClass}" title="${statusText}${detailsText}">
          <span class="status-icon">${this.getStatusIcon(result.status)}</span>
          <span class="status-text">${statusText}</span>
          ${result.contentMatch ? '<span class="content-match-badge">✓</span>' : ''}
          ${result.fromCache ? '<span class="cache-badge">💾</span>' : ''}
          ${result.isProxied ? '<span class="proxy-badge">🔒</span>' : ''}
          ${result.preservedProtocol ? '<span class="protocol-badge">🔗</span>' : ''}
        </div>
      `;
    }
    
    // v4.0.0: 智能访问按钮
    const visitButtonHTML = this.createVisitButtonsHTML(result, isUnavailable);
    
    // v4.0.0: URL显示逻辑优化
    const displayUrlInfo = this.createURLDisplayHTML(result);
    
    // v4.0.0: 资源类型和域名分类显示
    let resourceInfo = '';
    if (result.resourceType || result.domainCategory) {
      resourceInfo = `
        <div class="result-resource-info">
          ${result.resourceType ? `<span class="resource-type">${result.resourceType}</span>` : ''}
          ${result.domainCategory ? `<span class="domain-category">${result.domainCategory}</span>` : ''}
        </div>
      `;
    }
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''} ${result.isProxied ? 'result-proxied' : ''} ${result.preservedProtocol ? 'result-special-protocol' : ''}" 
           data-id="${result.id}" 
           data-result-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          ${displayUrlInfo}
          ${resourceInfo}
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${statusIndicator}
          </div>
        </div>
        <div class="result-actions">
          ${visitButtonHTML}
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.displayUrl)}">
            <span>复制</span>
          </button>
          ${this.createActionButtonsHTML(result)}
        </div>
      </div>
    `;
  }

  /**
   * v4.0.0 创建访问按钮HTML
   */
  createVisitButtonsHTML(result, isUnavailable) {
    if (isUnavailable) {
      return `
        <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
          <span>不可用</span>
        </button>
      `;
    }
    
    // v4.0.0: 特殊协议处理
    if (result.preservedProtocol) {
      return `
        <button class="action-btn visit-btn special-protocol" 
                data-action="visit" 
                data-url="${escapeHtml(result.url)}" 
                data-source="${result.source}"
                title="特殊协议链接（${result.url.split(':')[0]}）">
          <span>🔗 ${result.url.split(':')[0].toUpperCase()}</span>
        </button>
      `;
    }
    
    // v4.0.0: 代理和直接访问按钮
    return `
      <div class="visit-buttons-group">
        <button class="action-btn visit-btn primary" 
                data-action="visit" 
                data-url="${escapeHtml(result.displayUrl)}" 
                data-source="${result.source}"
                title="${result.isProxied ? '通过代理访问' : '直接访问'}">
          <span>${result.isProxied ? '🔒 代理访问' : '直接访问'}</span>
        </button>
        
        ${result.isProxied && result.originalUrl ? `
          <button class="action-btn visit-btn secondary" 
                  data-action="visit" 
                  data-url="${escapeHtml(result.originalUrl)}" 
                  data-source="${result.source}"
                  title="尝试直接访问原始链接">
            <span class="small-text">🔗 原始</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * v4.0.0 创建URL显示HTML
   */
  createURLDisplayHTML(result) {
    if (result.isProxied && result.proxyUrl !== result.originalUrl) {
      return `
        <div class="result-urls">
          <div class="result-url proxy-url" title="${escapeHtml(result.proxyUrl)}">
            <span class="url-label">🔒 代理:</span> ${truncateUrl(result.proxyUrl)}
          </div>
          <div class="result-url original-url" title="${escapeHtml(result.originalUrl)}">
            <span class="url-label">🔗 原始:</span> ${truncateUrl(result.originalUrl)}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="result-url" title="${escapeHtml(result.url)}">
          ${truncateUrl(result.url)}
        </div>
      `;
    }
  }

  /**
   * v4.0.0 创建操作按钮HTML
   */
  createActionButtonsHTML(result) {
    let buttons = '';
    
    if (result.status) {
      buttons += `
        <button class="action-btn status-btn" data-action="checkStatus" data-source="${result.source}" data-result-id="${result.id}" title="重新检查状态">
          <span>🔄</span>
        </button>
      `;
      
      if (result.status !== 'unknown') {
        buttons += `
          <button class="action-btn details-btn" data-action="viewDetails" data-result-id="${result.id}" title="查看详细状态">
            <span>ℹ️</span>
          </button>
        `;
      }
    }
    
    // v4.0.0: 代理特定按钮
    if (this.proxyEnabled && result.isProxied) {
      buttons += `
        <button class="action-btn proxy-btn" data-action="testProxy" data-result-id="${result.id}" title="测试代理连接">
          <span>📡</span>
        </button>
      `;
    }
    
    return buttons;
  }

  /**
   * v4.0.0 绑定事件（增强版）
   */
  bindResultsEvents() {
    const handler = (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const resultId = button.dataset.resultId;
      const source = button.dataset.source;

      // v4.0.0: 扩展的操作处理
      switch (action) {
        case 'visit':
          this.dispatchResultAction('visit', { url, source });
          break;
        case 'favorite':
          this.dispatchResultAction('favorite', { resultId });
          break;
        case 'copy':
          this.handleCopyUrl(url);
          break;
        case 'checkStatus':
          this.dispatchResultAction('checkStatus', { source, resultId });
          break;
        case 'viewDetails':
          this.dispatchResultAction('viewDetails', { resultId });
          break;
        case 'testProxy':
          this.handleTestProxy(resultId);
          break;
        // v4.0.0: 代理相关操作
        case 'toggleProxy':
          this.handleProxyToggle();
          break;
        case 'showProxyInfo':
          this.showProxyInfo();
          break;
        case 'runDiagnostics':
          this.runDiagnostics();
          break;
      }
    };

    document.addEventListener('click', handler);
    this.eventListeners.push(() => document.removeEventListener('click', handler));

    // v4.0.0: 监听收藏变化
    const favoritesHandler = () => this.updateFavoriteButtons();
    document.addEventListener('favoritesChanged', favoritesHandler);
    this.eventListeners.push(() => document.removeEventListener('favoritesChanged', favoritesHandler));
  }

  /**
   * v4.0.0 绑定代理事件
   */
  bindProxyEvents() {
    // 监听代理状态变化
    const statusHandler = (e) => {
      console.log('[SearchResultsRenderer v4.0.0] Proxy status changed:', e.detail);
      this.proxyEnabled = e.detail.enabled;
      this.proxyStatus = e.detail.status;
      this.healthStatus = e.detail.healthy ? 'healthy' : 'unhealthy';
      this.refreshResultsForProxyChange();
    };
    
    document.addEventListener('proxyStatusChanged', statusHandler);
    this.eventListeners.push(() => document.removeEventListener('proxyStatusChanged', statusHandler));

    // 监听健康检查失败
    const healthHandler = (e) => {
      console.warn('[SearchResultsRenderer v4.0.0] Proxy health check failed:', e.detail.error);
      this.showProxyHealthWarning(e.detail.error);
    };
    
    document.addEventListener('proxyHealthCheckFailed', healthHandler);
    this.eventListeners.push(() => document.removeEventListener('proxyHealthCheckFailed', healthHandler));
  }

  /**
   * v4.0.0 处理代理开关切换
   */
  async handleProxyToggle() {
    const toggleBtn = document.getElementById('proxyToggleBtn');
    if (toggleBtn) {
      toggleBtn.disabled = true;
      toggleBtn.innerHTML = '<span class="toggle-text">切换中...</span>';
    }

    try {
      const result = await proxyService.toggleProxy();
      if (result.success) {
        console.log('[SearchResultsRenderer v4.0.0] Proxy toggled successfully:', result.message);
        this.showNotification('success', result.message);
      } else {
        console.error('[SearchResultsRenderer v4.0.0] Proxy toggle failed:', result.error);
        this.showNotification('error', `代理切换失败: ${result.error}`);
      }
    } catch (error) {
      console.error('[SearchResultsRenderer v4.0.0] Proxy toggle exception:', error);
      this.showNotification('error', `代理切换异常: ${error.message}`);
    }

    if (toggleBtn) {
      toggleBtn.disabled = false;
    }
  }

  /**
   * v4.0.0 显示代理信息
   */
  async showProxyInfo() {
    const status = proxyService.getProxyStatus();
    
    const info = `
代理服务状态报告 v${proxyConfig.version.frontend}

🔗 连接信息:
  服务器: ${status.server}
  状态: ${status.enabled ? '已启用' : '已禁用'}
  健康: ${status.isHealthy ? '正常' : '异常'}
  支持域名: ${status.supportedDomains} 个

📊 性能统计:
  平均响应时间: ${status.performance.avgResponseTime}ms
  成功率: ${status.performance.successRate}
  重定向处理: ${status.performance.redirectCount}
  特殊链接: ${status.performance.specialLinksProcessed}

💾 缓存状态:
  命中率: ${(status.performance.cacheStats.hitRate * 100).toFixed(1)}%
  缓存条目: ${status.performance.cacheStats.size}
  内存使用: ${status.performance.cacheStats.memoryUsage?.current || 0}KB

⚙️ 队列状态:
  队列长度: ${status.performance.queueStatus.queueLength}
  活跃请求: ${status.performance.queueStatus.activeRequests}

🔧 版本信息:
  后端: v${proxyConfig.version.backend}
  前端: v${proxyConfig.version.frontend}
  兼容性: v${proxyConfig.version.compatibility}

最后健康检查: ${status.lastHealthCheck ? new Date(status.lastHealthCheck).toLocaleString() : '未检查'}
    `;
    
    // 创建模态框显示信息（简化实现）
    this.showModal('代理服务信息', `<pre>${info}</pre>`);
  }

  /**
   * v4.0.0 运行诊断
   */
  async runDiagnostics() {
    this.showNotification('info', '正在运行诊断...');
    
    try {
      const diagnostics = await proxyService.runDiagnostics();
      
      const report = `
诊断报告 - ${new Date().toLocaleString()}

✅ 配置验证: ${diagnostics.config.isValid ? '通过' : '失败'}
${diagnostics.config.issues.length > 0 ? '❌ 问题: ' + diagnostics.config.issues.join(', ') : ''}
${diagnostics.config.warnings.length > 0 ? '⚠️ 警告: ' + diagnostics.config.warnings.join(', ') : ''}

🌐 连接测试: ${diagnostics.connectivity?.success ? '成功' : '失败'}
响应时间: ${diagnostics.connectivity?.responseTime || 'N/A'}ms

📈 性能指标:
  平均响应: ${Math.round(diagnostics.performance.metrics.avgResponseTime)}ms
  成功率: ${(diagnostics.performance.metrics.successRate * 100).toFixed(1)}%
  缓存命中率: ${(diagnostics.performance.cache.hitRate * 100).toFixed(1)}%

🧠 智能模式:
  状态: ${diagnostics.smartMode.enabled ? '启用' : '禁用'}
  域名缓存: ${diagnostics.smartMode.domainCacheSize} 个

💡 建议:
${diagnostics.recommendations.length > 0 ? diagnostics.recommendations.map(r => '• ' + r).join('\n') : '• 当前配置良好'}

❌ 最近错误: ${diagnostics.errors.length} 个
      `;
      
      this.showModal('诊断报告', `<pre>${report}</pre>`);
      
    } catch (error) {
      console.error('[SearchResultsRenderer v4.0.0] Diagnostics failed:', error);
      this.showNotification('error', `诊断失败: ${error.message}`);
    }
  }

  /**
   * v4.0.0 处理测试代理
   */
  async handleTestProxy(resultId) {
    const result = this.findResult(resultId);
    if (!result) return;
    
    try {
      this.showNotification('info', '正在测试代理连接...');
      
      // 使用代理服务发送测试请求
      const response = await proxyService.makeProxyRequest(result.originalUrl, {
        method: 'HEAD',
        timeout: 10000
      });
      
      if (response.ok) {
        this.showNotification('success', '代理连接测试成功');
      } else {
        this.showNotification('warning', `代理连接测试失败: HTTP ${response.status}`);
      }
      
    } catch (error) {
      console.error('[SearchResultsRenderer v4.0.0] Proxy test failed:', error);
      this.showNotification('error', `代理测试失败: ${error.message}`);
    }
  }

  handleCopyUrl(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.showNotification('success', 'URL已复制到剪贴板');
      }).catch(() => {
        this.showNotification('error', '复制失败');
      });
    } else {
      // 降级方案
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.showNotification('success', 'URL已复制到剪贴板');
      } catch (error) {
        this.showNotification('error', '复制失败');
      }
      document.body.removeChild(textArea);
    }
  }

  dispatchResultAction(action, data) {
    document.dispatchEvent(new CustomEvent('resultActionRequested', {
      detail: { action, ...data }
    }));
  }

  refreshResultsForProxyChange() {
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  updatePerformanceDisplay() {
    const monitor = document.getElementById('performanceMonitor');
    if (!monitor) return;
    
    const newHTML = this.createPerformanceMonitorHTML();
    if (newHTML) {
      monitor.outerHTML = newHTML;
    }
  }

  showProxyHealthWarning(error) {
    this.showNotification('warning', `代理服务异常: ${error}`, 5000);
  }

  /**
   * v4.0.0 显示通知
   */
  showNotification(type, message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${this.getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  showModal(title, content) {
    // 简化的模态框实现
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // ===================== 辅助方法 =====================

  calculateProxyStats(results) {
    return {
      total: results.length,
      proxied: results.filter(r => r.isProxied).length,
      direct: results.filter(r => !r.isProxied).length,
      specialLinks: results.filter(r => r.preservedProtocol).length,
      enabled: this.proxyEnabled
    };
  }

  isSpecialProtocol(url) {
    const specialProtocols = ['magnet:', 'thunder:', 'ed2k:', 'ftp:', 'ftps:'];
    return specialProtocols.some(protocol => url.toLowerCase().startsWith(protocol));
  }

  detectResourceType(url) {
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      const ext = pathname.split('.').pop();
      
      const typeMap = {
        'html': 'webpage',
        'torrent': 'torrent',
        'mp4': 'video',
        'jpg': 'image',
        'png': 'image'
      };
      
      return typeMap[ext] || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  getDomainCategory(url) {
    try {
      const hostname = new URL(url).hostname;
      
      if (hostname.includes('jav') || hostname.includes('av01')) return 'video';
      if (hostname.includes('nyaa') || hostname.includes('torrent')) return 'torrent';
      if (hostname.includes('library') || hostname.includes('db')) return 'database';
      
      return 'other';
    } catch {
      return 'unknown';
    }
  }

  // 重用原有的辅助方法
  calculateStatusStats(results) {
    const stats = {
      hasStatus: false,
      available: 0,
      unavailable: 0,
      timeout: 0,
      error: 0,
      unknown: 0,
      contentMatches: 0,
      fromCache: 0
    };

    results.forEach(result => {
      if (result.status) {
        stats.hasStatus = true;
        switch (result.status) {
          case APP_CONSTANTS.SOURCE_STATUS.AVAILABLE:
            stats.available++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
            stats.unavailable++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
            stats.timeout++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.ERROR:
            stats.error++;
            break;
          default:
            stats.unknown++;
        }
        
        if (result.contentMatch) {
          stats.contentMatches++;
        }
        if (result.fromCache) {
          stats.fromCache++;
        }
      }
    });

    return stats;
  }

  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';
    if (exportResultsBtn) exportResultsBtn.style.display = 'none';

    this.currentResults = [];
    document.dispatchEvent(new CustomEvent('searchResultsCleared'));
  }

  async exportResults() {
    if (this.currentResults.length === 0) {
      return { success: false, error: '没有搜索结果可以导出' };
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: proxyConfig.version,
        proxyInfo: {
          enabled: this.proxyEnabled,
          status: proxyService.getProxyStatus(),
          processedResults: this.currentResults.filter(r => r.isProxied).length,
          specialLinks: this.currentResults.filter(r => r.preservedProtocol).length
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-v${proxyConfig.version.frontend}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('[SearchResultsRenderer v4.0.0] Export failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新单个结果的状态
   */
  updateResultStatus(resultId, statusData) {
    const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
    if (resultIndex === -1) return false;

    // 更新结果数据
    this.currentResults[resultIndex] = {
      ...this.currentResults[resultIndex],
      ...statusData
    };

    // 重新渲染该结果项
    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (resultElement) {
      const updatedHTML = this.createResultHTML(this.currentResults[resultIndex], this.config);
      resultElement.outerHTML = updatedHTML;
    }

    return true;
  }

  updateFavoriteButtons() {
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(btn => {
      const resultItem = btn.closest('.result-item');
      const resultId = resultItem?.dataset.id;
      const result = this.currentResults.find(r => r.id === resultId);
      
      if (result) {
        const isFavorited = favoritesManager.isFavorited(result.url);
        btn.querySelector('span').textContent = isFavorited ? '已收藏' : '收藏';
        btn.classList.toggle('favorited', isFavorited);
      }
    });
  }

  findResult(resultId) {
    return this.currentResults.find(r => r.id === resultId);
  }

  hideSearchStatus() {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
  }

  getCurrentResults() {
    return [...this.currentResults];
  }

  getResultsStats() {
    const statusStats = this.calculateStatusStats(this.currentResults);
    const proxyStats = this.calculateProxyStats(this.currentResults);
    
    return {
      total: this.currentResults.length,
      statusStats,
      proxyStats,
      sources: [...new Set(this.currentResults.map(r => r.source))],
      version: proxyConfig.version
    };
  }

  // ===================== 原有辅助方法（保持不变）=====================

  /**
   * 判断结果是否不可用
   */
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  /**
   * 获取状态样式类
   */
  getStatusClass(status) {
    const statusClasses = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 'status-available',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 'status-unavailable',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 'status-timeout',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 'status-error',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: 'status-checking',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: 'status-unknown'
    };
    return statusClasses[status] || 'status-unknown';
  }

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusTexts = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '可用',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '不可用',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '超时',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '错误',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '检查中',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '未知'
    };
    return statusTexts[status] || '未知';
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const statusIcons = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '✅',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '❌',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 设置搜索状态显示
   */
  showSearchStatus(keyword) {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'block';
      statusIndicator.innerHTML = `
        <div class="status-check-progress">
          <div class="progress-spinner"></div>
          <span>检查搜索源状态中...</span>
          <small>正在验证 "${escapeHtml(keyword)}" 的内容匹配</small>
        </div>
      `;
    }
  }

  /**
   * v4.0.0 清理资源
   */
  cleanup() {
    // 清理事件监听器
    this.eventListeners.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[SearchResultsRenderer v4.0.0] Cleanup error:', error);
      }
    });
    this.eventListeners = [];
    
    this.currentResults = [];
    
    // 清理代理服务
    if (proxyService && typeof proxyService.cleanup === 'function') {
      proxyService.cleanup();
    }
    
    console.log('[SearchResultsRenderer v4.0.0] Resources cleaned up');
  }
}

export default SearchResultsRenderer;