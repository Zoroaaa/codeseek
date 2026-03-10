// src/components/search/SearchResultsRenderer.js - 重构版搜索结果渲染器
// 版本: v2.1.0 - 适配后端Enhanced Proxy Worker v2.0.0
// 注意：只重构代理相关功能，非代理功能保持原样

import { APP_CONSTANTS } from '../../core/constants.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../../utils/format.js';
import favoritesManager from '../favorites.js';
import authManager from '../../services/auth.js';
import proxyService from '../../services/proxy-service.js'; // 使用重构后的代理服务

export class SearchResultsRenderer {
  constructor() {
    this.currentResults = [];
    this.config = {};
    this.proxyEnabled = false;
    
    // 新增：代理状态跟踪
    this.proxyStatus = {
      enabled: false,
      healthy: true,
      backendVersion: null,
      lastChecked: null
    };
  }

  /**
   * 初始化结果渲染器（重构代理部分）
   */
  async init() {
    try {
      // 初始化代理服务（适配重构后的服务）
      const initResult = await proxyService.init();
      if (initResult.success) {
        this.proxyEnabled = proxyService.isProxyEnabled();
        this.updateProxyStatus();
      } else {
        console.warn('代理服务初始化失败:', initResult.error);
        this.proxyEnabled = false;
      }
      
      this.bindResultsEvents();
      this.bindProxyEvents(); // 使用重构后的代理事件处理
      
      console.log('搜索结果渲染器初始化完成', {
        proxyEnabled: this.proxyEnabled,
        proxyStatus: this.proxyStatus,
        backendVersion: proxyService.getProxyStatus().backend?.version
      });
    } catch (error) {
      console.error('搜索结果渲染器初始化失败:', error);
      this.proxyEnabled = false;
    }
  }
  
  /**
   * 更新配置 - 保持原样
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('SearchResultsRenderer: 无效的配置对象');
      return;
    }

    this.config = { ...this.config, ...config };
    
    console.log('SearchResultsRenderer: 配置已更新', this.config);
    
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 获取当前配置 - 保持原样
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 处理配置变更 - 保持原样
   */
  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * 显示搜索结果（保持原样，只重构代理相关部分）
   */
  displaySearchResults(keyword, results, config) {
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 【重构】处理代理URL转换
    const processedResults = this.processResultsWithProxy(results);
    
    // 计算状态统计 - 保持原样
    const statusStats = this.calculateStatusStats(processedResults);
    
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        const availableCount = statusStats.available;
        const unavailableCount = statusStats.unavailable + statusStats.timeout + statusStats.error;
        const totalCount = processedResults.length;
        const contentMatches = statusStats.contentMatches || 0;
        
        statusInfo = ` | 可用: ${availableCount}/${totalCount}`;
        
        if (unavailableCount > 0) {
          statusInfo += ` | 不可用: ${unavailableCount}`;
        }
        
        if (contentMatches > 0) {
          statusInfo += ` | 内容匹配: ${contentMatches}`;
        }
      }
      
      // 【重构】代理状态信息显示
      let proxyInfo = '';
      if (this.proxyEnabled) {
        const proxiedCount = processedResults.filter(r => r.isProxied).length;
        const backendInfo = this.proxyStatus.backendVersion ? ` (v${this.proxyStatus.backendVersion})` : '';
        proxyInfo = ` | 代理访问: ${proxiedCount}${backendInfo}`;
      }
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${processedResults.length}个结果${statusInfo}${proxyInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      
      // 【重构】在结果容器前添加代理开关UI
      const proxyControlsHTML = this.createProxyControlsHTML();
      const resultsHTML = processedResults.map(result => this.createResultHTML(result, config)).join('');
      
      resultsContainer.innerHTML = `${proxyControlsHTML}${resultsHTML}`;
    }
    
    // 隐藏状态指示器 - 保持原样
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
    
    // 滚动到结果区域 - 保持原样
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // 【重构】触发结果渲染完成事件
    document.dispatchEvent(new CustomEvent('searchResultsRendered', {
      detail: { 
        keyword, 
        results: processedResults, 
        resultCount: processedResults.length,
        statusStats,
        proxyEnabled: this.proxyEnabled,
        proxyStatus: this.proxyStatus // 新增代理状态信息
      }
    }));
  }

  /**
   * 【重构】处理搜索结果的代理URL转换
   */
  processResultsWithProxy(results) {
    return results.map(result => {
      const processed = { ...result };
      
      if (this.proxyEnabled) {
        try {
          // 使用重构后的代理服务转换URL
          processed.proxyUrl = proxyService.convertToProxyUrl(result.url);
          processed.originalUrl = result.url;
          processed.isProxied = processed.proxyUrl !== result.url;
          processed.displayUrl = processed.proxyUrl;
          
          // 新增：记录转换统计
          if (processed.isProxied) {
            proxyService.updateStats('urlConverted', result.url);
          }
        } catch (error) {
          console.warn('URL代理转换失败:', error, result.url);
          processed.displayUrl = result.url;
          processed.isProxied = false;
          proxyService.updateStats('conversionError', result.url);
        }
      } else {
        processed.displayUrl = result.url;
        processed.isProxied = false;
      }
      
      return processed;
    });
  }

  /**
   * 【重构】创建代理控制面板HTML
   */
  createProxyControlsHTML() {
    const proxyStatus = proxyService.getProxyStatus();
    const isEnabled = proxyStatus.enabled;
    const isHealthy = proxyStatus.isHealthy !== false;
    
    // 【重构】适配后端Enhanced版本的状态显示
    const getToggleText = () => {
      if (proxyStatus.status === 'checking') return '🔄 检查中...';
      if (proxyStatus.status === 'error') return '⚠️ 代理服务异常';
      return isEnabled ? '🔒 代理已启用' : '🔓 启用代理模式';
    };
    
    const toggleText = getToggleText();
    const statusClass = isEnabled ? 'proxy-enabled' : 'proxy-disabled';
    const healthClass = isHealthy ? 'proxy-healthy' : 'proxy-unhealthy';
    
    // 【重构】代理状态详细信息（适配后端数据）
    let statusDetails = '';
    if (isEnabled) {
      const supportedCount = proxyStatus.supportedDomains || 0;
      const stats = proxyStatus.stats;
      const backend = proxyStatus.backend;
      const performance = proxyStatus.performance;
      
      statusDetails = `
        <div class="proxy-status-details">
          <small>
            支持 ${supportedCount} 个域名 | 
            总请求: ${stats?.totalRequests || 0} | 
            成功: ${stats?.successfulRequests || 0}
            ${performance?.avgResponseTime ? ` | 响应: ${performance.avgResponseTime}ms` : ''}
            ${performance?.cacheStats?.hitRate ? ` | 缓存: ${(performance.cacheStats.hitRate * 100).toFixed(1)}%` : ''}
            ${backend?.version ? ` | 后端: v${backend.version}` : ''}
            ${stats?.lastUsed ? ` | 最后使用: ${formatRelativeTime(stats.lastUsed)}` : ''}
          </small>
        </div>
      `;
    }
    
    // 【重构】健康状态警告（适配后端健康检查）
    const healthWarning = !isHealthy && isEnabled ? `
      <div class="proxy-health-warning">
        <span class="warning-icon">⚠️</span>
        <span>代理服务器响应异常，可能影响访问效果</span>
        ${proxyStatus.lastHealthCheck ? `
          <small>最后检查: ${formatRelativeTime(proxyStatus.lastHealthCheck)}</small>
        ` : ''}
      </div>
    ` : '';
    
    return `
      <div class="proxy-controls-panel ${statusClass} ${healthClass}">
        <div class="proxy-toggle-section">
          <button class="proxy-toggle-btn" id="proxyToggleBtn" 
                  data-action="toggleProxy"
                  ${proxyStatus.status === 'checking' ? 'disabled' : ''}>
            <span class="toggle-text">${toggleText}</span>
            <span class="toggle-indicator ${isEnabled ? 'enabled' : 'disabled'}"></span>
          </button>
          
          ${isEnabled ? `
            <button class="proxy-info-btn" id="proxyInfoBtn" 
                    data-action="showProxyInfo" 
                    title="查看代理状态详情">
              <span>ℹ️</span>
            </button>
            
            <button class="proxy-cache-btn" id="proxyCacheBtn" 
                    data-action="clearProxyCache" 
                    title="清理代理缓存">
              <span>🗑️</span>
            </button>
          ` : ''}
          
          <div class="proxy-help-text">
            <small>
              ${isEnabled ? 
                '代理模式已启用，搜索结果将通过代理服务器访问' : 
                '启用代理模式可访问受限制的搜索源'
              }
            </small>
          </div>
        </div>
        
        ${statusDetails}
        ${healthWarning}
      </div>
    `;
  }

  /**
   * 创建搜索结果HTML（保持原样，只重构代理相关部分）
   */
  createResultHTML(result, config) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    
    // 状态指示器HTML - 保持原样
    let statusIndicator = '';
    if (result.status) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status);
      const statusTime = result.lastChecked ? 
        `检查时间: ${formatRelativeTime(result.lastChecked)}` : '';
      
      let statusDetails = [];
      if (result.responseTime > 0) {
        statusDetails.push(`响应: ${result.responseTime}ms`);
      }
      if (result.qualityScore > 0) {
        statusDetails.push(`质量: ${result.qualityScore}/100`);
      }
      if (result.contentMatch) {
        statusDetails.push('内容匹配');
      }
      if (result.fromCache) {
        statusDetails.push('缓存');
      }
      
      const detailsText = statusDetails.length > 0 ? ` (${statusDetails.join(', ')})` : '';
      
      let unavailableReasonHTML = '';
      if (isUnavailable && result.unavailableReason) {
        unavailableReasonHTML = `<div class="unavailable-reason">原因: ${escapeHtml(result.unavailableReason)}</div>`;
      }
      
      statusIndicator = `
        <div class="result-status ${statusClass}" title="${statusText}${detailsText} ${statusTime}">
          <span class="status-icon">${this.getStatusIcon(result.status)}</span>
          <span class="status-text">${statusText}</span>
          ${result.contentMatch ? '<span class="content-match-badge">✓</span>' : ''}
          ${result.fromCache ? '<span class="cache-badge">💾</span>' : ''}
          ${result.isProxied ? '<span class="proxy-badge">🔒</span>' : ''}
        </div>
        ${unavailableReasonHTML}
      `;
    }
    
    // 【重构】访问按钮HTML（支持双链接和更好的状态显示）
    const visitButtonHTML = isUnavailable ? `
      <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
        <span>不可用</span>
      </button>
    ` : `
      <div class="visit-buttons-group">
        <button class="action-btn visit-btn primary" 
                data-action="visit" 
                data-url="${escapeHtml(result.displayUrl)}" 
                data-source="${result.source}"
                title="${result.isProxied ? '通过代理访问（Enhanced v2.0）' : '直接访问'}">
          <span>${result.isProxied ? '🔒 代理访问' : '直接访问'}</span>
        </button>
        
        ${result.isProxied ? `
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
    
    // 【重构】URL显示逻辑优化
    let displayUrlInfo = '';
    if (result.isProxied) {
      displayUrlInfo = `
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
      displayUrlInfo = `
        <div class="result-url" title="${escapeHtml(result.url)}">
          ${truncateUrl(result.url)}
        </div>
      `;
    }
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''} ${result.isProxied ? 'result-proxied' : ''}" 
           data-id="${result.id}" 
           data-result-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          ${displayUrlInfo}
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
          ${result.status ? `
            <button class="action-btn status-btn" data-action="checkStatus" data-source="${result.source}" data-result-id="${result.id}" title="重新检查状态">
              <span>🔄</span>
            </button>
            ${result.status !== APP_CONSTANTS.SOURCE_STATUS.UNKNOWN ? `
              <button class="action-btn details-btn" data-action="viewDetails" data-result-id="${result.id}" title="查看详细状态">
                <span>ℹ️</span>
              </button>
            ` : ''}
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 绑定结果事件（保持原样，只扩展代理功能）
   */
  bindResultsEvents() {
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const resultId = button.dataset.resultId;
      const source = button.dataset.source;

      // 触发相应的事件，让主组件处理
      switch (action) {
        case 'visit':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'visit', url, source }
          }));
          break;
        case 'favorite':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'favorite', resultId }
          }));
          break;
        case 'copy':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'copy', url }
          }));
          break;
        case 'checkStatus':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'checkStatus', source, resultId }
          }));
          break;
        case 'viewDetails':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'viewDetails', resultId }
          }));
          break;
        // 【重构】代理相关动作
        case 'toggleProxy':
          this.handleProxyToggle();
          break;
        case 'showProxyInfo':
          this.showProxyInfo();
          break;
        case 'clearProxyCache':
          this.handleProxyCacheClear();
          break;
      }
    });

    // 监听收藏变化事件 - 保持原样
    document.addEventListener('favoritesChanged', () => {
      this.updateFavoriteButtons();
    });
  }

  /**
   * 【重构】绑定代理相关事件
   */
  bindProxyEvents() {
    // 监听代理状态变化
    document.addEventListener('proxyStatusChanged', (e) => {
      this.proxyEnabled = e.detail.enabled;
      this.updateProxyStatus(e.detail);
      this.refreshResultsForProxyChange();
      console.log('代理状态已变更:', e.detail);
    });

    // 监听代理健康检查失败
    document.addEventListener('proxyHealthCheckFailed', (e) => {
      console.warn('代理健康检查失败:', e.detail.error);
      this.proxyStatus.healthy = false;
      this.showProxyHealthWarning(e.detail.error);
    });
  }

  /**
   * 【重构】更新代理状态信息
   */
  updateProxyStatus(statusDetail = null) {
    const proxyStatus = proxyService.getProxyStatus();
    
    this.proxyStatus = {
      enabled: proxyStatus.enabled,
      healthy: proxyStatus.isHealthy !== false,
      backendVersion: proxyStatus.backend?.version || null,
      lastChecked: proxyStatus.lastHealthCheck,
      performance: proxyStatus.performance,
      ...statusDetail
    };
  }

  /**
   * 【重构】处理代理开关切换
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
        console.log('代理状态切换成功:', result.message);
        
        // 显示成功通知
        this.showNotification('success', result.message, {
          responseTime: result.responseTime,
          backendVersion: result.backendInfo?.version
        });
      } else {
        console.error('代理状态切换失败:', result.error);
        this.showError(`代理切换失败: ${result.error}`);
      }
    } catch (error) {
      console.error('代理切换异常:', error);
      this.showError(`代理切换异常: ${error.message}`);
    }

    if (toggleBtn) {
      toggleBtn.disabled = false;
    }
  }

  /**
   * 【重构】显示代理信息（适配后端Enhanced版本）
   */
  showProxyInfo() {
    const status = proxyService.getProxyStatus();
    const performance = status.performance || {};
    const backend = status.backend || {};
    
    const info = `
代理状态详情 (Enhanced Proxy v${status.version || '2.1.0'})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

基本信息:
  状态: ${status.enabled ? '已启用' : '已禁用'}
  服务器: ${status.server}
  支持域名: ${status.supportedDomains} 个
  健康状态: ${status.isHealthy ? '正常' : '异常'}

后端信息:
  版本: v${backend.version || '未知'}
  最后更新: ${backend.lastUpdated ? new Date(backend.lastUpdated).toLocaleString() : '未知'}
  功能特性: ${backend.features ? Object.keys(backend.features).join(', ') : '未知'}

性能指标:
  平均响应时间: ${performance.avgResponseTime || 0}ms
  成功率: ${((performance.successRate || 0) * 100).toFixed(1)}%
  缓存命中率: ${performance.cacheStats ? (performance.cacheStats.hitRate * 100).toFixed(1) : '0'}%
  队列长度: ${performance.queueStatus?.queueLength || 0}
  活跃请求: ${performance.queueStatus?.activeRequests || 0}

统计信息:
  总请求: ${status.stats?.totalRequests || 0}
  成功请求: ${status.stats?.successfulRequests || 0}
  失败请求: ${status.stats?.failedRequests || 0}
  缓存命中: ${status.stats?.cacheHits || 0}
  降级成功: ${status.stats?.fallbackSuccesses || 0}
  ${status.stats?.lastUsed ? `最后使用: ${new Date(status.stats.lastUsed).toLocaleString()}` : ''}

健康检查:
  最后检查: ${status.lastHealthCheck ? new Date(status.lastHealthCheck).toLocaleString() : '未检查'}
  重试次数: ${status.retryCount || 0}
    `;
    
    // 使用更好的显示方式（可以后续改为模态框）
    alert(info);
  }

  /**
   * 【重构】处理代理缓存清理
   */
  async handleProxyCacheClear() {
    const cacheBtn = document.getElementById('proxyCacheBtn');
    if (cacheBtn) {
      cacheBtn.disabled = true;
      cacheBtn.innerHTML = '<span>清理中...</span>';
    }

    try {
      const result = await proxyService.clearProxyCache();
      
      let message = '缓存清理完成';
      const details = [];
      
      if (result.frontend) details.push('前端缓存');
      if (result.backend) details.push('后端KV缓存');
      
      if (details.length > 0) {
        message += `: ${details.join('、')}`;
      }
      
      if (result.errors.length > 0) {
        message += `\n警告: ${result.errors.join(', ')}`;
      }
      
      this.showNotification('success', message);
      console.log('代理缓存清理结果:', result);
    } catch (error) {
      console.error('代理缓存清理失败:', error);
      this.showError(`缓存清理失败: ${error.message}`);
    }

    if (cacheBtn) {
      cacheBtn.disabled = false;
      cacheBtn.innerHTML = '<span>🗑️</span>';
    }
  }

  /**
   * 【重构】刷新结果以应用代理变化
   */
  refreshResultsForProxyChange() {
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 【重构】显示代理健康警告
   */
  showProxyHealthWarning(error) {
    const warning = document.createElement('div');
    warning.className = 'proxy-health-warning-toast';
    warning.innerHTML = `
      <div class="warning-content">
        <span class="warning-icon">⚠️</span>
        <span>代理服务异常: ${error}</span>
        <button class="close-warning" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.insertBefore(warning, document.body.firstChild);
    
    // 5秒后自动移除
    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 5000);
  }

  /**
   * 【重构】显示通知
   */
  showNotification(type, message, details = null) {
    const notification = document.createElement('div');
    notification.className = `proxy-notification notification-${type}`;
    
    let detailsHtml = '';
    if (details) {
      const detailItems = [];
      if (details.responseTime) detailItems.push(`响应: ${details.responseTime}ms`);
      if (details.backendVersion) detailItems.push(`后端: v${details.backendVersion}`);
      if (detailItems.length > 0) {
        detailsHtml = `<small>(${detailItems.join(', ')})</small>`;
      }
    }
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
        <span>${message}</span>
        ${detailsHtml}
        <button class="close-notification" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.insertBefore(notification, document.body.firstChild);
    
    // 3秒后自动移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * 显示错误信息 - 保持原样
   */
  showError(message) {
    console.error(message);
    alert(message);
  }

  /**
   * 更新收藏按钮状态 - 保持原样
   */
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

  /**
   * 清空搜索结果 - 保持原样
   */
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

  /**
   * 【重构】导出搜索结果（包含增强的代理信息）
   */
  async exportResults() {
    if (this.currentResults.length === 0) {
      return { success: false, error: '没有搜索结果可以导出' };
    }

    try {
      const proxyStatus = proxyService.getProxyStatus();
      
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0',
        
        // 【重构】增强的代理信息
        proxyInfo: {
          enabled: this.proxyEnabled,
          status: this.proxyStatus,
          backendInfo: proxyStatus.backend,
          performance: proxyStatus.performance,
          processedResults: this.currentResults.filter(r => r.isProxied).length,
          supportedDomains: proxyStatus.supportedDomains,
          stats: proxyStatus.stats,
          version: proxyStatus.version
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-enhanced-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新单个结果的状态 - 保持原样
   */
  updateResultStatus(resultId, statusData) {
    const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
    if (resultIndex === -1) return false;

    this.currentResults[resultIndex] = {
      ...this.currentResults[resultIndex],
      ...statusData
    };

    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (resultElement) {
      const updatedHTML = this.createResultHTML(this.currentResults[resultIndex], this.config);
      resultElement.outerHTML = updatedHTML;
    }

    return true;
  }

  /**
   * 获取当前结果 - 保持原样
   */
  getCurrentResults() {
    return [...this.currentResults];
  }

  /**
   * 查找结果 - 保持原样
   */
  findResult(resultId) {
    return this.currentResults.find(r => r.id === resultId);
  }

  /**
   * 【重构】获取结果统计（包含增强的代理信息）
   */
  getResultsStats() {
    const statusStats = this.calculateStatusStats(this.currentResults);
    
    // 【重构】增强的代理统计
    const proxyStats = {
      total: this.currentResults.length,
      proxied: this.currentResults.filter(r => r.isProxied).length,
      direct: this.currentResults.filter(r => !r.isProxied).length,
      enabled: this.proxyEnabled,
      status: this.proxyStatus,
      backendVersion: this.proxyStatus.backendVersion,
      performance: this.proxyStatus.performance
    };
    
    return {
      total: this.currentResults.length,
      statusStats,
      proxyStats,
      sources: [...new Set(this.currentResults.map(r => r.source))],
      timeRange: this.currentResults.length > 0 ? {
        oldest: Math.min(...this.currentResults.map(r => r.timestamp)),
        newest: Math.max(...this.currentResults.map(r => r.timestamp))
      } : null
    };
  }

  // ===================== 辅助方法（保持原样） =====================

  /**
   * 计算状态统计 - 保持原样
   */
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

  /**
   * 判断结果是否不可用 - 保持原样
   */
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  /**
   * 获取状态样式类 - 保持原样
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
   * 获取状态文本 - 保持原样
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
   * 获取状态图标 - 保持原样
   */
  getStatusIcon(status) {
    const statusIcons = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '✅',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 设置搜索状态显示 - 保持原样
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
   * 隐藏搜索状态显示 - 保持原样
   */
  hideSearchStatus() {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
  }

  /**
   * 【重构】清理资源
   */
  cleanup() {
    this.currentResults = [];
    proxyService.cleanup(); // 清理代理服务资源
    console.log('搜索结果渲染器资源已清理');
  }
}

export default SearchResultsRenderer;