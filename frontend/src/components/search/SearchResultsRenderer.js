// src/components/search/SearchResultsRenderer.js - 搜索结果渲染子组件（代理功能集成版）
import { APP_CONSTANTS } from '../../core/constants.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../../utils/format.js';
import favoritesManager from '../favorites.js';
import authManager from '../../services/auth.js';
import proxyService from '../../services/proxy-service.js'; // 新增：导入代理服务

export class SearchResultsRenderer {
  constructor() {
    this.currentResults = [];
    this.config = {}; // 添加配置属性
    this.proxyEnabled = false; // 新增：代理状态
  }

  /**
   * 初始化结果渲染器
   */
  async init() {
    try {
      // 初始化代理服务
      await proxyService.init();
      this.proxyEnabled = proxyService.isProxyEnabled();
      
      this.bindResultsEvents();
      this.bindProxyEvents(); // 新增：绑定代理相关事件
      
      console.log('搜索结果渲染器初始化完成', {
        proxyEnabled: this.proxyEnabled,
        proxyStatus: proxyService.getProxyStatus()
      });
    } catch (error) {
      console.error('搜索结果渲染器初始化失败:', error);
    }
  }
  
  /**
   * 更新配置 - 新增方法
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('SearchResultsRenderer: 无效的配置对象');
      return;
    }

    // 合并配置
    this.config = { ...this.config, ...config };
    
    console.log('SearchResultsRenderer: 配置已更新', this.config);
    
    // 如果当前有结果，重新渲染以应用新配置
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 获取当前配置 - 新增方法
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 处理配置变更 - 新增方法（别名方法，兼容不同调用方式）
   */
  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * 显示搜索结果（集成代理功能）
   */
  displaySearchResults(keyword, results, config) {
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 处理代理URL转换（新增功能）
    const processedResults = this.processResultsWithProxy(results);
    
    // 计算状态统计
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
      
      // 添加详情提取信息
      let detailExtractionInfo = '';
      if (config.enableDetailExtraction) {
        const supportedCount = processedResults.filter(r => this.shouldExtractDetail(r)).length;
        detailExtractionInfo = ` | 支持详情提取: ${supportedCount}`;
      }
      
      // 新增：代理状态信息
      let proxyInfo = '';
      if (this.proxyEnabled) {
        const proxiedCount = processedResults.filter(r => r.isProxied).length;
        proxyInfo = ` | 代理访问: ${proxiedCount}`;
      }
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${processedResults.length}个结果${statusInfo}${detailExtractionInfo}${proxyInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      
      // 在结果容器前添加代理开关UI（新增功能）
      const proxyControlsHTML = this.createProxyControlsHTML();
      const resultsHTML = processedResults.map(result => this.createResultHTML(result, config)).join('');
      
      resultsContainer.innerHTML = `${proxyControlsHTML}${resultsHTML}`;
    }
    
    // 隐藏状态指示器
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // 触发结果渲染完成事件
    document.dispatchEvent(new CustomEvent('searchResultsRendered', {
      detail: { 
        keyword, 
        results: processedResults, 
        resultCount: processedResults.length,
        statusStats,
        proxyEnabled: this.proxyEnabled
      }
    }));
  }

  /**
   * 处理搜索结果的代理URL转换（新增方法）
   */
  processResultsWithProxy(results) {
    return results.map(result => {
      const processed = { ...result };
      
      if (this.proxyEnabled) {
        // 转换为代理URL
        processed.proxyUrl = proxyService.convertToProxyUrl(result.url);
        processed.originalUrl = result.url;
        processed.isProxied = processed.proxyUrl !== result.url;
        processed.displayUrl = processed.proxyUrl; // 主要显示的URL
      } else {
        processed.displayUrl = result.url;
        processed.isProxied = false;
      }
      
      return processed;
    });
  }

  /**
   * 创建代理控制面板HTML（新增方法）
   */
  createProxyControlsHTML() {
    const proxyStatus = proxyService.getProxyStatus();
    const isEnabled = proxyStatus.enabled;
    const isHealthy = proxyStatus.isHealthy !== false; // 默认为健康
    
    const toggleText = isEnabled ? '🔒 代理已启用' : '🔓 启用代理模式';
    const statusClass = isEnabled ? 'proxy-enabled' : 'proxy-disabled';
    const healthClass = isHealthy ? 'proxy-healthy' : 'proxy-unhealthy';
    
    // 代理状态详细信息
    let statusDetails = '';
    if (isEnabled) {
      const supportedCount = proxyStatus.supportedDomains || 0;
      const stats = proxyStatus.stats;
      statusDetails = `
        <div class="proxy-status-details">
          <small>
            支持 ${supportedCount} 个域名 | 
            总请求: ${stats?.totalRequests || 0} | 
            成功: ${stats?.successfulRequests || 0}
            ${stats?.lastUsed ? ` | 最后使用: ${formatRelativeTime(stats.lastUsed)}` : ''}
          </small>
        </div>
      `;
    }
    
    return `
      <div class="proxy-controls-panel ${statusClass} ${healthClass}">
        <div class="proxy-toggle-section">
          <button class="proxy-toggle-btn" id="proxyToggleBtn" data-action="toggleProxy">
            <span class="toggle-text">${toggleText}</span>
            <span class="toggle-indicator ${isEnabled ? 'enabled' : 'disabled'}"></span>
          </button>
          
          ${isEnabled ? `
            <button class="proxy-info-btn" id="proxyInfoBtn" data-action="showProxyInfo" title="查看代理状态详情">
              <span>ℹ️</span>
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
        
        ${!isHealthy && isEnabled ? `
          <div class="proxy-health-warning">
            <span class="warning-icon">⚠️</span>
            <span>代理服务器响应异常，可能影响访问效果</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建搜索结果HTML（集成代理功能）
   */
  createResultHTML(result, config) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    
    // 状态指示器HTML
    let statusIndicator = '';
    if (result.status) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status);
      const statusTime = result.lastChecked ? 
        `检查时间: ${formatRelativeTime(result.lastChecked)}` : '';
      
      // 详细状态信息
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
      
      // 不可用原因显示
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
    
    // 访问按钮HTML（支持双链接）
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
                title="${result.isProxied ? '通过代理访问' : '直接访问'}">
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

    // 详情提取按钮
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable && config.enableDetailExtraction ? `
      <button class="action-btn detail-btn" data-action="extractDetail" data-result-id="${result.id}" title="提取详情信息">
        <span class="btn-icon">📋</span>
        <span class="btn-text">详情</span>
      </button>
    ` : '';
    
    // URL显示逻辑优化
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
          ${detailExtractionButtonHTML}
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
        
        <!-- 详情显示容器 -->
        <div class="result-detail-container" style="display: none;">
          <!-- 详情内容将在这里动态插入 -->
        </div>
      </div>
    `;
  }

  /**
   * 绑定结果事件（扩展代理功能）
   */
  bindResultsEvents() {
    // 使用事件委托处理结果点击事件
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
        case 'extractDetail':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'extractDetail', resultId }
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
        // 新增：代理相关动作
        case 'toggleProxy':
          this.handleProxyToggle();
          break;
        case 'showProxyInfo':
          this.showProxyInfo();
          break;
      }
    });

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateFavoriteButtons();
    });
  }

  /**
   * 绑定代理相关事件（新增方法）
   */
  bindProxyEvents() {
    // 监听代理状态变化
    document.addEventListener('proxyStatusChanged', (e) => {
      this.proxyEnabled = e.detail.enabled;
      this.refreshResultsForProxyChange();
      console.log('代理状态已变更:', e.detail);
    });

    // 监听代理健康检查失败
    document.addEventListener('proxyHealthCheckFailed', (e) => {
      console.warn('代理健康检查失败:', e.detail.error);
      this.showProxyHealthWarning(e.detail.error);
    });
  }

  /**
   * 处理代理开关切换（新增方法）
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
        // 状态变化会通过事件处理
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
   * 显示代理信息（新增方法）
   */
  showProxyInfo() {
    const status = proxyService.getProxyStatus();
    const info = `
代理状态: ${status.enabled ? '已启用' : '已禁用'}
代理服务器: ${status.server}
支持域名: ${status.supportedDomains} 个
统计信息:
  - 总请求: ${status.stats?.totalRequests || 0}
  - 成功请求: ${status.stats?.successfulRequests || 0}
  - 失败请求: ${status.stats?.failedRequests || 0}
  ${status.stats?.lastUsed ? `- 最后使用: ${new Date(status.stats.lastUsed).toLocaleString()}` : ''}

健康状态: ${status.isHealthy ? '正常' : '异常'}
最后检查: ${status.lastHealthCheck ? new Date(status.lastHealthCheck).toLocaleString() : '未检查'}
    `;
    
    alert(info); // 简单实现，后续可以改为模态框
  }

  /**
   * 刷新结果以应用代理变化（新增方法）
   */
  refreshResultsForProxyChange() {
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 显示代理健康警告（新增方法）
   */
  showProxyHealthWarning(error) {
    // 在页面顶部显示警告
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
    
    // 3秒后自动移除
    setTimeout(() => {
      if (warning.parentNode) {
        warning.parentNode.removeChild(warning);
      }
    }, 3000);
  }

  /**
   * 显示错误信息（新增方法）
   */
  showError(message) {
    // 简单的错误提示，后续可以改进
    console.error(message);
    alert(message);
  }

  /**
   * 更新收藏按钮状态
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
   * 清空搜索结果
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

    // 触发结果清空事件
    document.dispatchEvent(new CustomEvent('searchResultsCleared'));
  }

  /**
   * 导出搜索结果（包含代理信息）
   */
  async exportResults(extractionStats = {}) {
    if (this.currentResults.length === 0) {
      return { success: false, error: '没有搜索结果可以导出' };
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0',
        extractionStats,
        proxyInfo: { // 新增：代理相关信息
          enabled: this.proxyEnabled,
          status: proxyService.getProxyStatus(),
          processedResults: this.currentResults.filter(r => r.isProxied).length
        }
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

      return { success: true };
    } catch (error) {
      console.error('导出搜索结果失败:', error);
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
      const updatedHTML = this.createResultHTML(this.currentResults[resultIndex], {
        enableDetailExtraction: true // 假设启用了详情提取
      });
      resultElement.outerHTML = updatedHTML;
    }

    return true;
  }

  /**
   * 获取当前结果
   */
  getCurrentResults() {
    return [...this.currentResults];
  }

  /**
   * 查找结果
   */
  findResult(resultId) {
    return this.currentResults.find(r => r.id === resultId);
  }

  /**
   * 获取结果统计（包含代理信息）
   */
  getResultsStats() {
    const statusStats = this.calculateStatusStats(this.currentResults);
    const proxyStats = {
      total: this.currentResults.length,
      proxied: this.currentResults.filter(r => r.isProxied).length,
      direct: this.currentResults.filter(r => !r.isProxied).length,
      enabled: this.proxyEnabled
    };
    
    return {
      total: this.currentResults.length,
      statusStats,
      proxyStats, // 新增：代理统计
      sources: [...new Set(this.currentResults.map(r => r.source))],
      timeRange: this.currentResults.length > 0 ? {
        oldest: Math.min(...this.currentResults.map(r => r.timestamp)),
        newest: Math.max(...this.currentResults.map(r => r.timestamp))
      } : null
    };
  }

  // ===================== 辅助方法 =====================

  /**
   * 计算状态统计
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
   * 判断结果是否不可用
   */
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  /**
   * 判断是否应该提取详情
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    return APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source) || false;
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
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
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
   * 隐藏搜索状态显示
   */
  hideSearchStatus() {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.currentResults = [];
    proxyService.cleanup(); // 新增：清理代理服务资源
    console.log('搜索结果渲染器资源已清理');
  }
}

export default SearchResultsRenderer;