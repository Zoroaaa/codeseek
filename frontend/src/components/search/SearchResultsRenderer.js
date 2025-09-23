// src/components/search/SearchResultsRenderer.js - 集成代理功能的搜索结果渲染器
import { APP_CONSTANTS } from '../../core/constants.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../../utils/format.js';
import favoritesManager from '../favorites.js';
import authManager from '../../services/auth.js';

export class SearchResultsRenderer {
  constructor() {
    this.currentResults = [];
    this.config = {};
    
    // 🆕 代理相关配置
    this.proxyEnabled = true;
    this.showProxyIndicator = true;
    this.proxyStats = {
      totalProxyResults: 0,
      proxyClickCount: 0
    };
  }

  /**
   * 初始化结果渲染器
   */
  async init() {
    try {
      this.bindResultsEvents();
      console.log('搜索结果渲染器初始化完成');
    } catch (error) {
      console.error('搜索结果渲染器初始化失败:', error);
    }
  }
  
  /**
   * 更新配置 - 包含代理配置
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('SearchResultsRenderer: 无效的配置对象');
      return;
    }

    // 合并配置
    this.config = { ...this.config, ...config };
    
    // 🆕 更新代理相关配置
    if (config.proxyEnabled !== undefined) {
      this.proxyEnabled = config.proxyEnabled;
    }
    if (config.showProxyIndicator !== undefined) {
      this.showProxyIndicator = config.showProxyIndicator;
    }
    
    console.log('SearchResultsRenderer: 配置已更新', this.config);
    
    // 如果当前有结果，重新渲染以应用新配置
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 处理配置变更
   */
  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * 修复：显示搜索结果 - 集成代理功能提示
   */
  displaySearchResults(keyword, results, config) {
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 计算状态统计
    const statusStats = this.calculateStatusStats(results);
    
    // 修复：统计代理结果
    const proxyResults = results.filter(r => r.proxyEnabled && r.originalUrl && r.url !== r.originalUrl);
    this.proxyStats.totalProxyResults = proxyResults.length;
    
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        const availableCount = statusStats.available;
        const unavailableCount = statusStats.unavailable + statusStats.timeout + statusStats.error;
        const totalCount = results.length;
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
        const supportedCount = results.filter(r => this.shouldExtractDetail(r)).length;
        detailExtractionInfo = ` | 支持详情提取: ${supportedCount}`;
      }
      
      // 修复：添加代理信息
      let proxyInfo = '';
      if (this.proxyEnabled && proxyResults.length > 0) {
        proxyInfo = ` | 🌍 代理访问: ${proxyResults.length}`;
      }
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${results.length}个结果${statusInfo}${detailExtractionInfo}${proxyInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    // 修复：显示代理使用提示
    if (this.proxyEnabled && proxyResults.length > 0 && this.showProxyIndicator) {
      this.showProxyNotice(proxyResults.length);
    }

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      resultsContainer.innerHTML = results.map(result => this.createResultHTML(result, config)).join('');
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
        results, 
        resultCount: results.length,
        statusStats,
        proxyResults: proxyResults.length // 代理结果统计
      }
    }));
  }

  /**
   * 修复：显示代理使用提示
   */
  showProxyNotice(proxyCount) {
    const existingNotice = document.getElementById('proxyNotice');
    if (existingNotice) {
      existingNotice.remove();
    }

    const notice = document.createElement('div');
    notice.id = 'proxyNotice';
    notice.className = 'proxy-notice';
    notice.innerHTML = `
      <div class="proxy-notice-content">
        <span class="proxy-notice-icon">🌍</span>
        <span class="proxy-notice-text">
          已启用代理访问模式，${proxyCount} 个搜索结果将通过代理服务器访问，解决区域限制问题
        </span>
        <button class="proxy-notice-close" onclick="this.parentElement.parentElement.style.display='none'">×</button>
      </div>
    `;
    
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
      resultsSection.insertBefore(notice, resultsSection.firstChild);
      
      // 自动隐藏提示
      setTimeout(() => {
        if (notice.parentNode) {
          notice.style.display = 'none';
        }
      }, 8000);
    }
  }

  /**
   * 创建搜索结果HTML - 修复代理功能标识
   */
  createResultHTML(result, config) {
    const isFavorited = favoritesManager.isFavorited(result.originalUrl || result.url);
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    
    // 修复：准确判断是否使用了代理
    const isProxied = result.proxyEnabled && result.originalUrl && result.url !== result.originalUrl;
    
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
        </div>
        ${unavailableReasonHTML}
      `;
    }

    // 修复：代理指示器
    let proxyIndicator = '';
    if (isProxied && this.showProxyIndicator) {
      proxyIndicator = `
        <div class="proxy-indicator" title="通过代理服务器访问，解决区域限制">
          <span class="proxy-badge">🌍</span>
          <span class="proxy-text">代理访问</span>
        </div>
      `;
    }
    
    // 修复：访问按钮状态 - 包含代理信息
    const visitButtonHTML = isUnavailable ? `
      <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
        <span>不可用</span>
      </button>
    ` : `
      <button class="action-btn visit-btn ${isProxied ? 'proxy-enabled' : ''}" 
              data-action="visit" 
              data-url="${escapeHtml(result.url)}" 
              data-original-url="${escapeHtml(result.originalUrl || result.url)}"
              data-source="${result.source}"
              data-result-id="${result.id}"
              title="${isProxied ? '通过代理访问（解决区域限制）' : '直接访问'}">
        <span class="btn-icon">${isProxied ? '🌍' : '🔗'}</span>
        <span class="btn-text">访问</span>
      </button>
    `;

    // 详情提取按钮
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable && config.enableDetailExtraction ? `
      <button class="action-btn detail-btn" data-action="extractDetail" data-result-id="${result.id}" title="提取详情信息">
        <span class="btn-icon">📋</span>
        <span class="btn-text">详情</span>
      </button>
    ` : '';

    // 修复：复制按钮 - 支持复制原始URL或代理URL
    const copyButtonHTML = `
      <div class="copy-btn-group">
        <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.url)}" title="复制${isProxied ? '代理' : ''}链接">
          <span class="btn-icon">📋</span>
          <span class="btn-text">复制</span>
        </button>
        ${isProxied ? `
          <button class="action-btn copy-original-btn" data-action="copy" data-url="${escapeHtml(result.originalUrl)}" title="复制原始链接">
            <span class="btn-icon">🔗</span>
            <span class="btn-text">原始</span>
          </button>
        ` : ''}
      </div>
    `;
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''} ${isProxied ? 'result-proxied' : ''}" 
           data-id="${result.id}" 
           data-result-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          <div class="result-url" title="${escapeHtml(result.originalUrl || result.url)}">
            ${truncateUrl(result.originalUrl || result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${proxyIndicator}
            ${statusIndicator}
          </div>
        </div>
        <div class="result-actions">
          ${visitButtonHTML}
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          ${copyButtonHTML}
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
   * 修复：绑定结果事件 - 包含代理点击统计
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
      const originalUrl = button.dataset.originalUrl;

      // 修复：记录代理点击统计
      if (action === 'visit' && originalUrl && originalUrl !== url) {
        this.proxyStats.proxyClickCount++;
        this.recordProxyClick(resultId, originalUrl, url);
      }

      // 触发相应的事件，让主组件处理
      switch (action) {
        case 'visit':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'visit', url, source, resultId, originalUrl }
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
      }
    });

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateFavoriteButtons();
    });
  }


  /**
   * 修复：记录代理点击统计
   */
  recordProxyClick(resultId, originalUrl, proxyUrl) {
    console.log(`代理链接点击统计: ${originalUrl} -> ${proxyUrl}`);
    
    // 触发代理点击事件
    document.dispatchEvent(new CustomEvent('proxyLinkClicked', {
      detail: { 
        resultId, 
        originalUrl, 
        proxyUrl,
        timestamp: Date.now()
      }
    }));
  }

  /**
   * 修复：获取代理统计
   */
  getProxyStats() {
    return { ...this.proxyStats };
  }

  /**
   * 修复：更新收藏按钮状态
   */
  updateFavoriteButtons() {
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(btn => {
      const resultItem = btn.closest('.result-item');
      const resultId = resultItem?.dataset.id;
      const result = this.currentResults.find(r => r.id === resultId);
      
      if (result) {
        // 修复：使用原始URL进行收藏判断
        const urlForFavorite = result.originalUrl || result.url;
        const isFavorited = favoritesManager.isFavorited(urlForFavorite);
        btn.querySelector('span').textContent = isFavorited ? '已收藏' : '收藏';
        btn.classList.toggle('favorited', isFavorited);
      }
    });
  }

  /**
   * 修复：清空搜索结果
   */
  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const proxyNotice = document.getElementById('proxyNotice');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';
    if (exportResultsBtn) exportResultsBtn.style.display = 'none';
    if (proxyNotice) proxyNotice.remove(); // 修复：清除代理提示

    this.currentResults = [];

    // 修复：重置代理统计
    this.proxyStats = {
      totalProxyResults: 0,
      proxyClickCount: 0
    };

    // 触发结果清空事件
    document.dispatchEvent(new CustomEvent('searchResultsCleared'));
  }


  /**
   * 修复：导出搜索结果 - 包含代理信息
   */
  async exportResults(extractionStats = {}) {
    if (this.currentResults.length === 0) {
      return { success: false, error: '没有搜索结果可以导出' };
    }

    try {
      const data = {
        results: this.currentResults.map(result => ({
          ...result,
          // 修复：导出时包含代理相关信息
          proxyInfo: result.proxyEnabled ? {
            originalUrl: result.originalUrl,
            proxyUrl: result.url,
            proxyEnabled: result.proxyEnabled
          } : null
        })),
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0',
        extractionStats,
        proxyStats: this.proxyStats // 修复：包含代理统计
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
        enableDetailExtraction: this.config.enableDetailExtraction || true,
        proxyEnabled: this.proxyEnabled,
        showProxyIndicator: this.showProxyIndicator
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
   * 修复：获取结果统计 - 包含代理统计
   */
  getResultsStats() {
    const statusStats = this.calculateStatusStats(this.currentResults);
    
    // 修复：代理相关统计
    const proxyResults = this.currentResults.filter(r => r.proxyEnabled && r.originalUrl && r.url !== r.originalUrl);
    const directResults = this.currentResults.filter(r => !r.proxyEnabled || !r.originalUrl || r.url === r.originalUrl);
    
    return {
      total: this.currentResults.length,
      statusStats,
      sources: [...new Set(this.currentResults.map(r => r.source))],
      timeRange: this.currentResults.length > 0 ? {
        oldest: Math.min(...this.currentResults.map(r => r.timestamp)),
        newest: Math.max(...this.currentResults.map(r => r.timestamp))
      } : null,
      // 修复：代理统计
      proxyStats: {
        proxyResults: proxyResults.length,
        directResults: directResults.length,
        proxyClickCount: this.proxyStats.proxyClickCount,
        proxyEnabled: this.proxyEnabled
      }
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
   * 修复：清理资源 - 包含代理相关清理
   */
  cleanup() {
    this.currentResults = [];
    this.proxyStats = {
      totalProxyResults: 0,
      proxyClickCount: 0
    };
    
    // 清除代理提示
    const proxyNotice = document.getElementById('proxyNotice');
    if (proxyNotice) {
      proxyNotice.remove();
    }
    
    console.log('搜索结果渲染器资源已清理');
  }

}

export default SearchResultsRenderer;