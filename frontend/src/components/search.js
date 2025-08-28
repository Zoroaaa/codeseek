// 搜索组件 - 添加搜索源状态显示功能
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { debounce } from '../utils/helpers.js';
import searchService, { searchHistoryManager } from '../services/search.js';
import authManager from '../services/auth.js';
import favoritesManager from './favorites.js';
import apiService from '../services/api.js';

export class SearchManager {
  constructor() {
    this.currentResults = [];
    this.searchHistory = [];
    this.isInitialized = false;
    // 新增：用户设置缓存
    this.userSettings = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadSearchHistory();
      await this.loadUserSettings(); // 新增：加载用户设置
      this.bindEvents();
      this.handleURLParams();
      this.exposeGlobalMethods();
      this.isInitialized = true;
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
    }
  }
  
  // 🆕 新增：加载用户设置
  async loadUserSettings() {
    if (authManager.isAuthenticated()) {
      try {
        this.userSettings = await apiService.getUserSettings();
      } catch (error) {
        console.error('加载用户设置失败:', error);
        this.userSettings = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
      }
    } else {
      this.userSettings = APP_CONSTANTS.DEFAULT_USER_SETTINGS;
    }
  }
  
  exposeGlobalMethods() {
    window.searchManager = {
      openResult: (url, source) => this.openResult(url, source),
      toggleFavorite: (resultId) => this.toggleFavorite(resultId),
      copyToClipboard: (text) => this.copyToClipboard(text),
      searchFromHistory: (keyword) => this.searchFromHistory(keyword),
      deleteHistoryItem: (historyId) => this.deleteHistoryItem(historyId),
      // 🆕 新增：重新检查搜索源状态
      recheckSourceStatus: (resultId) => this.recheckSourceStatus(resultId),
      // 🆕 新增：显示搜索源详细状态
      showSourceStatus: (resultId) => this.showSourceStatus(resultId)
    };
  }

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

  // 🔧 修改：执行搜索 - 支持状态检查
  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      showToast('请输入搜索关键词', 'error');
      searchInput?.focus();
      return;
    }

    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      showToast(validation.errors[0], 'error');
      return;
    }

    try {
      showLoading(true);
      
      this.hideQuickTips();

      // 🆕 使用用户设置中的状态检查配置
      const checkSourceStatus = this.userSettings?.checkSourceStatus || false;
      const saveToHistory = authManager.isAuthenticated();

      // 执行搜索（会自动进行状态检查如果启用）
      const results = await searchService.performSearch(keyword, {
        checkSourceStatus,
        saveToHistory
      });
      
      this.displaySearchResults(keyword, results);

      if (saveToHistory) {
        await this.addToHistory(keyword);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 修改：显示搜索结果 - 支持状态信息显示
  displaySearchResults(keyword, results) {
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    if (searchInfo) {
      const availableCount = results.filter(r => r.available !== false).length;
      const statusInfo = this.userSettings?.checkSourceStatus ? 
        ` (${availableCount}/${results.length} 个源可用)` : '';
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${results.length}个结果${statusInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
      this.bindResultsEvents(resultsContainer);
    }

    this.currentResults = results;
    
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
  
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
        case 'recheck': // 🆕 新增：重新检查状态
          this.recheckSourceStatus(resultId);
          break;
        case 'status': // 🆕 新增：显示详细状态
          this.showSourceStatus(resultId);
          break;
      }
    });
  }

  // 🔧 修改：创建搜索结果HTML - 添加状态显示
  createResultHTML(result) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const showStatus = this.userSettings?.showSourceStatus && result.hasOwnProperty('available');
    
    // 🆕 状态指示器
    let statusIndicator = '';
    if (showStatus) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status, result.available);
      const responseTimeText = result.responseTime ? ` (${result.responseTime}ms)` : '';
      
      statusIndicator = `
        <div class="result-status ${statusClass}" title="${statusText}${responseTimeText}">
          <span class="status-dot"></span>
          <span class="status-text">${statusText}</span>
          ${result.responseTime ? `<span class="response-time">${result.responseTime}ms</span>` : ''}
        </div>
      `;
    }
    
    return `
      <div class="result-item ${result.available === false ? 'result-unavailable' : ''}" data-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          ${statusIndicator}
          <div class="result-url" title="${escapeHtml(result.url)}">
            ${truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${result.lastChecked ? `<span class="result-checked">检查于 ${new Date(result.lastChecked).toLocaleTimeString()}</span>` : ''}
          </div>
        </div>
        <div class="result-actions">
          <button class="action-btn visit-btn ${result.available === false ? 'disabled' : ''}" 
                  data-action="visit" data-url="${escapeHtml(result.url)}" data-source="${result.source}"
                  ${result.available === false ? 'disabled title="搜索源当前不可用"' : ''}>
            <span>访问</span>
          </button>
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.url)}">
            <span>复制</span>
          </button>
          ${showStatus ? `
            <button class="action-btn status-btn" data-action="recheck" data-result-id="${result.id}" 
                    title="重新检查状态">
              <span>🔄</span>
            </button>
            <button class="action-btn info-btn" data-action="status" data-result-id="${result.id}" 
                    title="查看详细状态">
              <span>ℹ️</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 🆕 新增：获取状态CSS类
  getStatusClass(status) {
    switch (status) {
      case 'online': return 'status-online';
      case 'offline': return 'status-offline';
      case 'error': return 'status-error';
      case 'timeout': return 'status-timeout';
      case 'checking': return 'status-checking';
      default: return 'status-unknown';
    }
  }

  // 🆕 新增：获取状态文本
  getStatusText(status, available) {
    if (available === true) return '可用';
    if (available === false) {
      switch (status) {
        case 'timeout': return '超时';
        case 'error': return '错误';
        case 'offline': return '离线';
        default: return '不可用';
      }
    }
    return '未检查';
  }

  // 🆕 新增：重新检查单个搜索源状态
  async recheckSourceStatus(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) return;

    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (resultElement) {
      // 显示检查中状态
      const statusElement = resultElement.querySelector('.result-status');
      if (statusElement) {
        statusElement.className = 'result-status status-checking';
        statusElement.querySelector('.status-text').textContent = '检查中...';
      }
    }

    try {
      // 创建源对象进行检查
      const sourceToCheck = {
        id: result.source,
        name: result.title,
        urlTemplate: result.url.replace(encodeURIComponent(result.keyword), '{keyword}'),
        icon: result.icon
      };

      const checkedSources = await searchService.checkSourcesAvailability([sourceToCheck], {
        showProgress: false,
        useCache: false // 强制重新检查
      });

      if (checkedSources.length > 0) {
        const checkedResult = checkedSources[0];
        
        // 更新结果数据
        Object.assign(result, {
          available: checkedResult.available,
          status: checkedResult.status,
          responseTime: checkedResult.responseTime,
          lastChecked: checkedResult.lastChecked
        });

        // 更新显示
        this.updateResultStatus(resultId, checkedResult);
        
        const statusText = this.getStatusText(checkedResult.status, checkedResult.available);
        showToast(`${result.title}: ${statusText}`, checkedResult.available ? 'success' : 'warning');
      }
    } catch (error) {
      console.error('重新检查状态失败:', error);
      showToast('状态检查失败', 'error');
      
      // 恢复未知状态
      if (resultElement) {
        const statusElement = resultElement.querySelector('.result-status');
        if (statusElement) {
          statusElement.className = 'result-status status-unknown';
          statusElement.querySelector('.status-text').textContent = '检查失败';
        }
      }
    }
  }

  // 🆕 新增：更新结果状态显示
  updateResultStatus(resultId, statusData) {
    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (!resultElement) return;

    const statusElement = resultElement.querySelector('.result-status');
    if (statusElement) {
      const statusClass = this.getStatusClass(statusData.status);
      const statusText = this.getStatusText(statusData.status, statusData.available);
      
      statusElement.className = `result-status ${statusClass}`;
      statusElement.querySelector('.status-text').textContent = statusText;
      
      const responseTimeElement = statusElement.querySelector('.response-time');
      if (responseTimeElement) {
        responseTimeElement.textContent = statusData.responseTime ? `${statusData.responseTime}ms` : '';
      }
    }

    // 更新访问按钮状态
    const visitBtn = resultElement.querySelector('.visit-btn');
    if (visitBtn) {
      if (statusData.available === false) {
        visitBtn.classList.add('disabled');
        visitBtn.disabled = true;
        visitBtn.title = '搜索源当前不可用';
      } else {
        visitBtn.classList.remove('disabled');
        visitBtn.disabled = false;
        visitBtn.title = '';
      }
    }

    // 更新整个结果项的类
    if (statusData.available === false) {
      resultElement.classList.add('result-unavailable');
    } else {
      resultElement.classList.remove('result-unavailable');
    }
  }

  // 🆕 新增：显示详细状态信息
  showSourceStatus(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) return;

    const statusInfo = `
搜索源: ${result.title}
状态: ${this.getStatusText(result.status, result.available)}
响应时间: ${result.responseTime ? result.responseTime + 'ms' : '未知'}
最后检查: ${result.lastChecked ? new Date(result.lastChecked).toLocaleString() : '未检查'}
URL: ${result.url}
    `.trim();

    alert(statusInfo);
  }

  openResult(url, source) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast('已在新标签页打开', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('visit_site', { url, source }).catch(console.error);
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      showToast('无法打开链接', 'error');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('copy_url', { url: text }).catch(console.error);
      }
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板', 'success');
      } catch (err) {
        showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  async toggleFavorite(resultId) {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
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

  async loadSearchHistory() {
    if (!authManager.isAuthenticated()) {
      this.searchHistory = [];
      this.renderHistory();
      return;
    }

    try {
      this.searchHistory = await searchHistoryManager.getHistory();
      this.renderHistory();
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.renderHistory();
    }
  }

  async addToHistory(keyword) {
    const settings = await apiService.getUserSettings();
    const maxHistory = settings.maxHistoryPerUser || 100;
    
    if (this.searchHistory.length >= maxHistory) {
        const oldestId = this.searchHistory[this.searchHistory.length - 1].id;
        await apiService.deleteSearchHistory(oldestId);
        this.searchHistory.pop();
    }

    if (!authManager.isAuthenticated()) return;

    try {
      await searchHistoryManager.addToHistory(keyword, 'manual');
      
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
      showToast('保存搜索历史失败', 'warning');
    }
  }

  async deleteHistoryItem(historyId) {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      await apiService.deleteSearchHistory(historyId);
      
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      this.renderHistory();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    if (this.searchHistory.length === 0) {
      if (historySection) historySection.style.display = 'none';
      return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
      historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => 
        `<div class="history-item-container">
          <span class="history-item" data-keyword="${escapeHtml(item.keyword)}">
            ${escapeHtml(item.keyword)}
          </span>
          <button class="history-delete-btn" data-history-id="${item.id}" title="删除这条记录">
            ×
          </button>
        </div>`
      ).join('');

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
    }
  }

  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  async clearAllHistory() {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？')) return;
    
    try {
      showLoading(true);
      
      await searchHistoryManager.clearAllHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

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
    showToast('搜索结果已清除', 'success');
  }

  async exportResults() {
    if (this.currentResults.length === 0) {
      showToast('没有搜索结果可以导出', 'error');
      return;
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0'
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

      showToast('搜索结果导出成功', 'success');
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  handleSearchInput(value) {
    if (value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
  }

  showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return;
    
    const suggestions = searchService.getSearchSuggestions(query, this.searchHistory);
    this.renderSearchSuggestions(suggestions);
  }

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
    
    if (suggestions.length === 0) {
      suggestionsContainer.style.display = 'none';
      return;
    }
    
    suggestionsContainer.innerHTML = suggestions.map(item => {
      const displayText = item.keyword || item.query;
      return `
        <div class="suggestion-item" data-keyword="${escapeHtml(displayText)}">
          <span class="suggestion-icon">🕒</span>
          <span class="suggestion-text">${escapeHtml(displayText)}</span>
        </div>
      `;
    }).join('');
    
    suggestionsContainer.addEventListener('click', (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      if (suggestionItem) {
        const keyword = suggestionItem.dataset.keyword;
        this.searchFromHistory(keyword);
      }
    });
    
    suggestionsContainer.style.display = 'block';
  }

  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  hideQuickTips() {
    const quickTips = document.getElementById('quickTips');
    if (quickTips) {
      quickTips.style.display = 'none';
    }
  }
}

export const searchManager = new SearchManager();
export default searchManager;