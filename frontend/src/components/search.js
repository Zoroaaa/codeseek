// 增强版搜索组件 - 重构版本：使用新服务架构
import { APP_CONSTANTS } from '../core/constants.js';
import { getService } from '../services/services-bootstrap.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { debounce } from '../utils/helpers.js';
import favoritesManager from './favorites.js';

export class SearchManager {
  constructor() {
    this.currentResults = [];
    this.searchHistory = [];
    this.isInitialized = false;
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
    
    // 服务实例将在init时获取
    this.searchService = null;
    this.userHistoryService = null;
    this.authService = null;
    this.userSettingsService = null;
    this.sourceCheckerService = null;
    this.notificationService = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 获取服务实例
      this.searchService = getService('searchService');
      this.userHistoryService = getService('userHistoryService');
      this.authService = getService('authService');
      this.userSettingsService = getService('userSettingsService');
      this.sourceCheckerService = getService('sourceCheckerService');
      this.notificationService = getService('notificationService');

      await this.loadSearchHistory();
      this.bindEvents();
      this.handleURLParams();
      this.exposeGlobalMethods();
      this.isInitialized = true;
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
      this.notificationService?.showToast('搜索管理器初始化失败', 'error');
    }
  }
  
  // 暴露必要的全局方法
  exposeGlobalMethods() {
    window.searchManager = {
      openResult: (url, source) => this.openResult(url, source),
      toggleFavorite: (resultId) => this.toggleFavorite(resultId),
      copyToClipboard: (text) => this.copyToClipboard(text),
      searchFromHistory: (keyword) => this.searchFromHistory(keyword),
      deleteHistoryItem: (historyId) => this.deleteHistoryItem(historyId),
      checkSourceStatus: (sourceId) => this.checkSingleSourceStatus(sourceId),
      refreshSourceStatus: () => this.refreshAllSourcesStatus(),
      toggleStatusCheck: () => this.toggleStatusCheck(),
      viewStatusHistory: () => this.viewStatusHistory()
    };
  }

  // 绑定事件
  bindEvents() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.performSearch());
    }

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.performSearch();
      });

      searchInput.addEventListener('input', debounce((e) => {
        this.handleSearchInput(e.target.value);
      }, 300));

      searchInput.addEventListener('focus', () => {
        this.showSearchSuggestions();
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });
    }

    if (clearResultsBtn) {
      clearResultsBtn.addEventListener('click', () => this.clearResults());
    }

    if (exportResultsBtn) {
      exportResultsBtn.addEventListener('click', () => this.exportResults());
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    }

    this.bindKeyboardShortcuts();
  }

  // 绑定键盘快捷键
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      if (e.key === 'Escape') {
        this.hideSearchSuggestions();
      }
    });
  }

  // 处理URL参数
  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = searchQuery;
        setTimeout(() => {
          this.performSearch();
        }, 500);
      }
    }
  }

  // 执行搜索 - 增强版，支持后端状态检查
  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      this.notificationService.showToast('请输入搜索关键词', 'error');
      searchInput?.focus();
      return;
    }

    // 验证关键词
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      this.notificationService.showToast(validation.errors[0], 'error');
      return;
    }

    try {
      showLoading(true);
      
      // 隐藏提示区域
      this.hideQuickTips();

      // 显示搜索状态检查进度（如果可用）
      await this.showSearchStatusIfEnabled(keyword);

      // 获取搜索选项
      const useCache = true; // 默认启用缓存
      const saveToHistory = this.authService.isAuthenticated();

      // 执行搜索
      const results = await this.searchService.performSearch(keyword, {
        useCache,
        saveToHistory
      });
      
      // 显示搜索结果
      this.displaySearchResults(keyword, results);

      // 更新搜索历史
      if (saveToHistory) {
        await this.addToHistory(keyword);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      this.notificationService.showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
    }
  }

  // 显示搜索状态检查进度
  async showSearchStatusIfEnabled(keyword) {
    try {
      if (!this.authService.isAuthenticated()) return;

      const userSettings = await this.userSettingsService.getSettings();
      const checkTimeout = userSettings.sourceStatusCheckTimeout || 8000;
      
      if (!userSettings.checkSourceStatus) return;

      this.statusCheckInProgress = true;
      this.lastStatusCheckKeyword = keyword;

      // 显示状态检查提示
      this.notificationService.showToast('正在检查搜索源状态并进行内容匹配...', 'info', checkTimeout);

      // 如果页面有状态指示器，显示它
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
    } catch (error) {
      console.warn('显示状态检查进度失败:', error);
    }
  }

  // 显示搜索结果 - 增强版，支持状态显示和不可用结果处理
  displaySearchResults(keyword, results) {
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 添加数据类型检查
    if (!Array.isArray(results)) {
      console.warn('搜索结果不是数组:', results);
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div class="empty-state"><p>搜索结果格式异常</p></div>';
      }
      return;
    }
    
    // 计算状态统计（包括不可用结果统计）
    const statusStats = this.calculateStatusStats(results);
    
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        const availableCount = statusStats.available;
        const unavailableCount = statusStats.unavailable + statusStats.timeout + statusStats.error;
        const totalCount = results.length;
        const contentMatches = statusStats.contentMatches || 0;
        
        statusInfo = ` | 可用: ${availableCount}/${totalCount}`;
        
        // 显示不可用数量
        if (unavailableCount > 0) {
          statusInfo += ` | 不可用: ${unavailableCount}`;
        }
        
        // 添加内容匹配信息
        if (contentMatches > 0) {
          statusInfo += ` | 内容匹配: ${contentMatches}`;
        }
      }
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${results.length}个结果${statusInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      try {
        // 使用grid布局而不是简单的join，以支持不可用结果的特殊样式
        resultsContainer.className = 'results-grid';
        resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
        
        // 绑定事件委托
        this.bindResultsEvents(resultsContainer);
      } catch (error) {
        console.error('渲染搜索结果失败:', error);
        resultsContainer.innerHTML = '<div class="empty-state"><p>渲染结果失败</p></div>';
      }
    }

    this.currentResults = results;
    
    // 隐藏状态指示器
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // 计算状态统计（包括不可用结果统计）
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

    // 添加数据类型检查
    if (!Array.isArray(results)) {
      return stats;
    }

    results.forEach(result => {
      if (result && result.status) {
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
        
        // 统计内容匹配和缓存使用
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
  
  // 绑定结果区域事件
  bindResultsEvents(container) {
    container.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const resultId = button.dataset.resultId;
      const source = button.dataset.source;

      switch (action) {
        case 'visit':
          this.openResult(url, source);
          break;
        case 'favorite':
          this.toggleFavorite(resultId);
          break;
        case 'copy':
          this.copyToClipboard(url);
          break;
        case 'checkStatus':
          this.checkSingleSourceStatus(source, resultId);
          break;
        case 'viewDetails':
          this.viewSourceStatusDetails(resultId);
          break;
      }
    });
  }

  // 创建搜索结果HTML - 支持不可用结果的特殊显示
  createResultHTML(result) {
    // 添加数据验证
    if (!result || typeof result !== 'object') {
      console.warn('搜索结果项数据无效:', result);
      return '';
    }

    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    
    // 状态指示器HTML（增强版，包含不可用原因）
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
    
    // 访问按钮状态（不可用时禁用）
    const visitButtonHTML = isUnavailable ? `
      <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
        <span>不可用</span>
      </button>
    ` : `
      <button class="action-btn visit-btn" data-action="visit" data-url="${escapeHtml(result.url || '')}" data-source="${escapeHtml(result.source || '')}">
        <span>访问</span>
      </button>
    `;
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''}" data-id="${result.id || ''}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon || '🔗'}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title || '未知标题')}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle || '')}</div>
          <div class="result-url" title="${escapeHtml(result.url || '')}">
            ${truncateUrl(result.url || '')}
          </div>
          <div class="result-meta">
            <span class="result-source">${escapeHtml(result.source || '')}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp || Date.now())}</span>
            ${statusIndicator}
          </div>
        </div>
        <div class="result-actions">
          ${visitButtonHTML}
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id || ''}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.url || '')}">
            <span>复制</span>
          </button>
          ${result.status ? `
            <button class="action-btn status-btn" data-action="checkStatus" data-source="${escapeHtml(result.source || '')}" data-result-id="${result.id || ''}" title="重新检查状态">
              <span>🔄</span>
            </button>
            ${result.status !== APP_CONSTANTS.SOURCE_STATUS.UNKNOWN ? `
              <button class="action-btn details-btn" data-action="viewDetails" data-result-id="${result.id || ''}" title="查看详细状态">
                <span>ℹ️</span>
              </button>
            ` : ''}
          ` : ''}
        </div>
      </div>
    `;
  }

  // 判断结果是否不可用
  isResultUnavailable(result) {
    if (!result || !result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  // 获取状态样式类
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

  // 获取状态文本
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

  // 获取状态图标
  getStatusIcon(status) {
    const statusIcons = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '✅',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '❌',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
  }

  // 检查单个搜索源状态
  async checkSingleSourceStatus(sourceId, resultId) {
    try {
      showLoading(true);
      this.notificationService.showToast(`正在检查 ${sourceId} 状态...`, 'info');

      // 调用源检查服务
      const statusResult = await this.sourceCheckerService.checkSourceStatus(sourceId);

      if (statusResult) {
        // 更新结果中的状态
        const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
        if (resultIndex !== -1) {
          this.currentResults[resultIndex] = {
            ...this.currentResults[resultIndex],
            status: statusResult.status,
            statusText: statusResult.statusText,
            unavailableReason: statusResult.unavailableReason,
            lastChecked: statusResult.lastChecked,
            responseTime: statusResult.responseTime,
            availabilityScore: statusResult.availabilityScore,
            verified: statusResult.verified,
            contentMatch: statusResult.contentMatch,
            fromCache: statusResult.fromCache
          };
          
          // 重新渲染该结果项
          const resultElement = document.querySelector(`[data-id="${resultId}"]`);
          if (resultElement) {
            resultElement.outerHTML = this.createResultHTML(this.currentResults[resultIndex]);
          }
        }

        const statusEmoji = statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? '✅' : '❌';
        const contentInfo = statusResult.contentMatch ? '，内容匹配' : '';
        let reasonInfo = '';
        
        // 显示不可用原因
        if (statusResult.unavailableReason && statusResult.status !== APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
          reasonInfo = `，原因：${statusResult.unavailableReason}`;
        }
        
        this.notificationService.showToast(
          `${sourceId} ${statusEmoji} ${statusResult.statusText}${contentInfo}${reasonInfo}`, 
          statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 'success' : 'warning',
          5000
        );
      }
    } catch (error) {
      console.error('检查搜索源状态失败:', error);
      this.notificationService.showToast('状态检查失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 刷新所有搜索源状态
  async refreshAllSourcesStatus() {
    if (!this.currentResults || this.currentResults.length === 0) {
      this.notificationService.showToast('没有搜索结果需要刷新状态', 'warning');
      return;
    }

    try {
      showLoading(true);
      this.notificationService.showToast('正在刷新所有搜索源状态...', 'info');

      const statusSummary = await this.sourceCheckerService.checkAllSourcesStatus();
      
      // 更新所有结果的状态
      this.currentResults.forEach(result => {
        const sourceStatus = statusSummary.sources.find(s => s.id === result.source);
        if (sourceStatus) {
          result.status = sourceStatus.status;
          result.statusText = sourceStatus.statusText;
          result.unavailableReason = sourceStatus.unavailableReason;
          result.lastChecked = sourceStatus.lastChecked;
          result.responseTime = sourceStatus.responseTime;
          result.availabilityScore = sourceStatus.availabilityScore;
          result.verified = sourceStatus.verified;
          result.contentMatch = sourceStatus.contentMatch;
          result.fromCache = sourceStatus.fromCache;
        }
      });

      // 重新渲染结果列表
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults);

      const contentMatches = statusSummary.sources.filter(s => s.contentMatch).length;
      const unavailableCount = statusSummary.unavailable + statusSummary.timeout + statusSummary.error;
      const contentInfo = contentMatches > 0 ? `，${contentMatches} 个内容匹配` : '';
      const unavailableInfo = unavailableCount > 0 ? `，${unavailableCount} 个不可用` : '';
      
      this.notificationService.showToast(
        `状态刷新完成: ${statusSummary.available}/${statusSummary.total} 可用${contentInfo}${unavailableInfo}`, 
        'success'
      );
    } catch (error) {
      console.error('刷新搜索源状态失败:', error);
      this.notificationService.showToast('刷新状态失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 查看搜索源状态详情（增强版，显示不可用原因）
  async viewSourceStatusDetails(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result || !result.status) {
      this.notificationService.showToast('无状态详情可查看', 'warning');
      return;
    }

    // 构建详情信息
    const details = [
      `搜索源: ${result.title}`,
      `状态: ${result.statusText || this.getStatusText(result.status)}`,
      `最后检查: ${result.lastChecked ? new Date(result.lastChecked).toLocaleString() : '未知'}`,
    ];

    // 显示不可用原因
    if (result.unavailableReason && this.isResultUnavailable(result)) {
      details.push(`不可用原因: ${result.unavailableReason}`);
    }

    if (result.responseTime > 0) {
      details.push(`响应时间: ${result.responseTime}ms`);
    }

    if (result.availabilityScore > 0) {
      details.push(`可用性评分: ${result.availabilityScore}/100`);
    }

    if (result.qualityScore > 0) {
      details.push(`内容质量: ${result.qualityScore}/100`);
    }

    if (result.contentMatch !== undefined) {
      details.push(`内容匹配: ${result.contentMatch ? '是' : '否'}`);
    }

    if (result.fromCache) {
      details.push(`数据来源: 缓存`);
    }

    // 显示详情（这里简单用alert，实际项目中可以用模态框）
    alert(details.join('\n'));
  }

  // 切换状态检查功能
  async toggleStatusCheck() {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录以使用状态检查功能', 'error');
      return;
    }

    try {
      const userSettings = await this.userSettingsService.getSettings();
      const newStatus = !userSettings.checkSourceStatus;
      
      await this.userSettingsService.updateSettings({
        ...userSettings,
        checkSourceStatus: newStatus
      });
      
      this.notificationService.showToast(`搜索源状态检查已${newStatus ? '启用' : '禁用'}`, 'success');
      
    } catch (error) {
      console.error('切换状态检查失败:', error);
      this.notificationService.showToast('设置更新失败: ' + error.message, 'error');
    }
  }

  // 查看状态检查历史
  async viewStatusHistory() {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录以查看状态历史', 'error');
      return;
    }

    try {
      showLoading(true);
      const historyData = await this.sourceCheckerService.getStatusHistory({ limit: 20 });
      
      if (historyData.success && historyData.history.length > 0) {
        // 简单显示历史（实际项目中可以用更好的UI）
        const historyText = historyData.history.map(item => 
          `${item.sourceId}: ${item.status} (${item.keyword}) - ${new Date(item.lastChecked).toLocaleString()}`
        ).join('\n');
        
        alert(`状态检查历史:\n\n${historyText}`);
      } else {
        this.notificationService.showToast('暂无状态检查历史', 'info');
      }
    } catch (error) {
      console.error('获取状态历史失败:', error);
      this.notificationService.showToast('获取历史失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 打开搜索结果
  openResult(url, source) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      this.notificationService.showToast('已在新标签页打开', 'success');
      
      if (this.authService.isAuthenticated()) {
        this.userHistoryService.recordAction('visit_site', { url, source }).catch(console.error);
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      this.notificationService.showToast('无法打开链接', 'error');
    }
  }

  // 复制到剪贴板
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.showToast('已复制到剪贴板', 'success');
      
      if (this.authService.isAuthenticated()) {
        this.userHistoryService.recordAction('copy_url', { url: text }).catch(console.error);
      }
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.notificationService.showToast('已复制到剪贴板', 'success');
      } catch (err) {
        this.notificationService.showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  // 切换收藏状态
  async toggleFavorite(resultId) {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录后再收藏', 'error');
      return;
    }

    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) return;

    const isFavorited = favoritesManager.isFavorited(result.url);
    
    if (isFavorited) {
      const favorite = favoritesManager.favorites.find(fav => fav.url === result.url);
      if (favorite) {
        await favoritesManager.removeFavorite(favorite.id);
      }
    } else {
      await favoritesManager.addFavorite(result);
    }

    this.updateFavoriteButtons();
  }

  // 更新收藏按钮状态
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

  // 加载搜索历史
  async loadSearchHistory() {
    if (!this.authService.isAuthenticated()) {
      this.searchHistory = [];
      this.renderHistory();
      return;
    }

    try {
      const result = await this.userHistoryService.getHistory();
      
      // 添加数据类型检查
      if (Array.isArray(result)) {
        this.searchHistory = result;
      } else if (result && Array.isArray(result.history)) {
        this.searchHistory = result.history;
      } else if (result && result.success && Array.isArray(result.data)) {
        this.searchHistory = result.data;
      } else {
        console.warn('搜索历史数据格式异常:', result);
        this.searchHistory = [];
      }
      
      this.renderHistory();
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.renderHistory();
    }
  }

  // 添加到历史记录
  async addToHistory(keyword) {
    if (!this.authService.isAuthenticated()) return;

    try {
      await this.userHistoryService.addToHistory(keyword, 'manual');
      
      // 更新本地历史
      this.searchHistory = this.searchHistory.filter(item => 
        item.keyword !== keyword
      );
      
      this.searchHistory.unshift({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        keyword: keyword,
        query: keyword,
        timestamp: Date.now(),
        count: 1,
        source: 'manual'
      });

      const maxHistory = APP_CONSTANTS.LIMITS.MAX_HISTORY;
      if (this.searchHistory.length > maxHistory) {
        this.searchHistory = this.searchHistory.slice(0, maxHistory);
      }

      this.renderHistory();
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      this.notificationService.showToast('保存搜索历史失败', 'warning');
    }
  }

  // 删除单条历史记录
  async deleteHistoryItem(historyId) {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      // 调用服务删除
      await this.userHistoryService.deleteHistoryItem(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      // 重新渲染历史列表
      this.renderHistory();
      
      this.notificationService.showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      this.notificationService.showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 渲染搜索历史
  renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    // 添加数据类型检查
    if (!Array.isArray(this.searchHistory) || this.searchHistory.length === 0) {
      if (historySection) historySection.style.display = 'none';
      return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
      try {
        historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => {
          if (!item || typeof item !== 'object') return '';
          
          const keyword = escapeHtml(item.keyword || item.query || '');
          const id = item.id || '';
          
          return `<div class="history-item-container">
            <span class="history-item" data-keyword="${keyword}">
              ${keyword}
            </span>
            <button class="history-delete-btn" data-history-id="${id}" title="删除这条记录">
              ×
            </button>
          </div>`;
        }).join('');

        // 绑定历史项点击事件
        historyList.addEventListener('click', (e) => {
          const historyItem = e.target.closest('.history-item');
          const deleteBtn = e.target.closest('.history-delete-btn');
          
          if (deleteBtn) {
            e.stopPropagation();
            const historyId = deleteBtn.dataset.historyId;
            this.deleteHistoryItem(historyId);
          } else if (historyItem) {
            const keyword = historyItem.dataset.keyword;
            this.searchFromHistory(keyword);
          }
        });
      } catch (error) {
        console.error('渲染搜索历史失败:', error);
        historyList.innerHTML = '<div class="empty-state"><p>渲染历史失败</p></div>';
      }
    }
  }

  // 从历史记录搜索
  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  // 清空搜索历史
  async clearAllHistory() {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？')) return;
    
    try {
      showLoading(true);
      
      await this.userHistoryService.clearAllHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      this.notificationService.showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      this.notificationService.showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 清空搜索结果
  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');
    const clearResultsBtn = document.getElementById('clearResultsBtn');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';

    this.currentResults = [];
    this.notificationService.showToast('搜索结果已清除', 'success');
  }

  // 导出搜索结果
  async exportResults() {
    if (this.currentResults.length === 0) {
      this.notificationService.showToast('没有搜索结果可以导出', 'error');
      return;
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0',
        statusCheckEnabled: this.statusCheckInProgress,
        lastCheckKeyword: this.lastStatusCheckKeyword
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

      this.notificationService.showToast('搜索结果导出成功', 'success');
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      this.notificationService.showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 处理搜索输入
  handleSearchInput(value) {
    if (value && value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
  }

  // 显示搜索建议
  showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return;
    
    try {
      const suggestions = this.searchService.getSearchSuggestions(query, this.searchHistory);
      this.renderSearchSuggestions(suggestions);
    } catch (error) {
      console.error('获取搜索建议失败:', error);
    }
  }

  // 渲染搜索建议
  renderSearchSuggestions(suggestions) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'searchSuggestions';
      suggestionsContainer.className = 'search-suggestions';
      
      const searchInput = document.getElementById('searchInput');
      if (searchInput && searchInput.parentNode) {
        searchInput.parentNode.appendChild(suggestionsContainer);
      }
    }
    
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      suggestionsContainer.style.display = 'none';
      return;
    }
    
    try {
      suggestionsContainer.innerHTML = suggestions.map(item => {
        const displayText = item.keyword || item.query || '';
        return `
          <div class="suggestion-item" data-keyword="${escapeHtml(displayText)}">
            <span class="suggestion-icon">🕒</span>
            <span class="suggestion-text">${escapeHtml(displayText)}</span>
          </div>
        `;
      }).join('');
      
      // 绑定建议点击事件
      suggestionsContainer.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        if (suggestionItem) {
          const keyword = suggestionItem.dataset.keyword;
          this.searchFromHistory(keyword);
        }
      });
      
      suggestionsContainer.style.display = 'block';
    } catch (error) {
      console.error('渲染搜索建议失败:', error);
      suggestionsContainer.style.display = 'none';
    }
  }

  // 隐藏搜索建议
  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  // 隐藏快速提示
  hideQuickTips() {
    const quickTips = document.getElementById('quickTips');
    if (quickTips) {
      quickTips.style.display = 'none';
    }
  }
}

// 创建全局实例
export const searchManager = new SearchManager();
export default searchManager;