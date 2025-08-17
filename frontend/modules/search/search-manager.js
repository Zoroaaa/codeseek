import { searchEngine } from './search-engine.js';
import { apiClient } from '../api/api-client.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';
import { debounce } from '../utils/common.js';

/**
 * 搜索管理器
 */
export class SearchManager {
  constructor() {
    this.searchHistory = [];
    this.currentResults = [];
    this.isInitialized = false;
    this.suggestionCallbacks = new Set();
  }

  init() {
    if (this.isInitialized) return;
    
    this.bindSearchEvents();
    this.isInitialized = true;
  }

  bindSearchEvents() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch();
        }
      });

      // 搜索建议
      const debouncedSuggestion = debounce((value) => {
        this.handleSearchInput(value);
      }, APP_CONSTANTS.UI.DEBOUNCE_DELAY);

      searchInput.addEventListener('input', (e) => {
        debouncedSuggestion(e.target.value);
      });

      searchInput.addEventListener('focus', () => {
        this.showSearchSuggestions();
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.performSearch();
      });
    }
  }

  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      toast.error('请输入搜索关键词');
      searchInput?.focus();
      return;
    }

    try {
      loading.show();
      this.hideQuickTips();

      // 添加到搜索历史
      await this.addToHistory(keyword);

      // 执行搜索
      const results = await this.searchKeyword(keyword);
      
      // 显示搜索结果
      this.displaySearchResults(keyword, results);

      // 记录搜索行为
      this.recordSearchAction(keyword, results);

    } catch (error) {
      console.error('搜索失败:', error);
      toast.error(`搜索失败: ${error.message}`);
    } finally {
      loading.hide();
    }
  }

  async searchKeyword(keyword) {
    const cacheResults = document.getElementById('cacheResults')?.checked;
    
    // 检查缓存
    if (cacheResults) {
      const cached = searchEngine.getCachedResults(keyword);
      if (cached) {
        toast.info('使用缓存结果', 2000);
        return cached;
      }
    }

    // 构建搜索结果
    const results = searchEngine.buildSearchResults(keyword);

    // 缓存结果
    if (cacheResults) {
      searchEngine.cacheResults(keyword, results);
    }

    return results;
  }

  async addToHistory(keyword) {
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      console.warn('无效的搜索关键词，跳过添加到历史');
      return;
    }

    const trimmedKeyword = keyword.trim();
    
    // 本地添加以立即更新UI
    this.searchHistory = this.searchHistory.filter(item => 
      item && item.keyword && item.keyword !== trimmedKeyword
    );
    
    this.searchHistory.unshift({
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      keyword: trimmedKeyword,
      query: trimmedKeyword,
      timestamp: Date.now(),
      count: 1,
      source: 'manual'
    });

    // 限制数量
    const maxHistory = APP_CONSTANTS.LIMITS.MAX_HISTORY;
    if (this.searchHistory.length > maxHistory) {
      this.searchHistory = this.searchHistory.slice(0, maxHistory);
    }

    this.renderHistory();

    // 保存到云端
    try {
      await apiClient.saveSearchHistory(trimmedKeyword, 'manual');
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      toast.warning('保存搜索历史失败');
    }
  }

  displaySearchResults(keyword, results) {
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');

    if (resultsSection) resultsSection.style.display = 'block';
    
    if (searchInfo) {
      searchInfo.innerHTML = `
        搜索关键词: <strong>${this.escapeHtml(keyword)}</strong> 
        (${results.length}个结果) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (resultsContainer) {
      resultsContainer.innerHTML = results.map(result => 
        this.createResultHTML(result)
      ).join('');
    }

    this.currentResults = results;
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  createResultHTML(result) {
    return `
      <div class="result-item" data-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${this.escapeHtml(result.title)}</div>
          <div class="result-subtitle">${this.escapeHtml(result.subtitle)}</div>
          <div class="result-url" title="${this.escapeHtml(result.url)}">
            ${this.truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${this.formatRelativeTime(result.timestamp)}</span>
          </div>
        </div>
        <div class="result-actions">
          <button class="action-btn visit-btn" onclick="searchManager.openResult('${this.escapeHtml(result.url)}', '${result.source}')" title="访问网站">
            <span>访问</span>
          </button>
          <button class="action-btn copy-btn" onclick="searchManager.copyToClipboard('${this.escapeHtml(result.url)}')" title="复制链接">
            <span>复制</span>
          </button>
        </div>
      </div>
    `;
  }

  openResult(url, source) {
    try {
      // 记录访问行为
      apiClient.recordAction('visit_site', { url, source }).catch(console.error);
      
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('已在新标签页打开');
    } catch (error) {
      console.error('打开链接失败:', error);
      toast.error('无法打开链接');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
      
      // 记录复制行为
      apiClient.recordAction('copy_url', { url: text }).catch(console.error);
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('已复制到剪贴板');
      } catch (err) {
        toast.error('复制失败');
      }
      document.body.removeChild(textArea);
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
        `<span class="history-item" onclick="searchManager.searchFromHistory('${this.escapeHtml(item.keyword)}')">
          ${this.escapeHtml(item.keyword)}
        </span>`
      ).join('');
    }
  }

  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
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
    if (!query) return;
    
    const suggestions = searchEngine.generateSuggestions(this.searchHistory, query);
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
    
    suggestionsContainer.innerHTML = suggestions.map(item => `
      <div class="suggestion-item" onclick="searchManager.searchFromHistory('${this.escapeHtml(item.text)}')">
        <span class="suggestion-icon">🕐</span>
        <span class="suggestion-text">${this.escapeHtml(item.text)}</span>
      </div>
    `).join('');
    
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

  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';

    this.currentResults = [];
    toast.success('搜索结果已清除');
  }

  async clearHistory() {
    try {
      loading.show();
      
      await apiClient.clearAllSearchHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      toast.success('搜索历史已清除');
    } catch (error) {
      console.error('清除搜索历史失败:', error);
      toast.error('清除失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  async loadSearchHistory() {
    try {
      const cloudHistory = await apiClient.getSearchHistory();
      
      if (cloudHistory && cloudHistory.length > 0) {
        this.searchHistory = cloudHistory.filter(item => {
          return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
        });
        
        this.renderHistory();
      }
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  }

  recordSearchAction(keyword, results) {
    if (navigator.onLine) {
      apiClient.recordAction('search', { 
        keyword, 
        resultCount: results.length,
        timestamp: Date.now() 
      }).catch(console.error);
    }
  }

  // 工具方法
  escapeHtml(text) {
    if (!text) return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  truncateUrl(url) {
    if (url.length <= 50) return url;
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname.length > 20 ? urlObj.pathname.substr(0, 20) + '...' : urlObj.pathname}`;
    } catch (error) {
      return url.substr(0, 50) + '...';
    }
  }

  formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    
    if (diff < minute) {
      return '刚刚';
    } else if (diff < hour) {
      return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
      return `${Math.floor(diff / hour)}小时前`;
    } else {
      return new Date(timestamp).toLocaleDateString();
    }
  }

  // 获取搜索统计
  getSearchStats() {
    return searchEngine.analyzeSearchPatterns(this.searchHistory);
  }

  // 获取当前结果
  getCurrentResults() {
    return this.currentResults;
  }

  // 设置搜索历史
  setSearchHistory(history) {
    this.searchHistory = history || [];
    this.renderHistory();
  }
}

// 创建全局实例
export const searchManager = new SearchManager();