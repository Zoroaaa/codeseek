// src/components/search/SearchHistoryManager.js - 搜索历史管理子组件
import { APP_CONSTANTS } from '../../core/constants-1.js';
import { showToast, showLoading } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import { searchHistoryManager as apiHistoryManager } from '../../services/search.js';
import apiService from '../../services/api.js';
import authManager from '../../services/auth.js';

export class SearchHistoryManager {
  constructor() {
    this.searchHistory = [];
    this.maxHistoryItems = 100;
  }

  /**
   * 初始化历史管理器
   */
  async init() {
    try {
      await this.loadSearchHistory();
      this.bindHistoryEvents();
      console.log('搜索历史管理器初始化完成');
    } catch (error) {
      console.error('搜索历史管理器初始化失败:', error);
    }
  }

  /**
   * 加载搜索历史
   */
  async loadSearchHistory() {
    if (!authManager.isAuthenticated()) {
      this.searchHistory = [];
      this.renderHistory();
      return;
    }

    try {
      this.searchHistory = await apiHistoryManager.getHistory();
      this.renderHistory();
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.renderHistory();
    }
  }

  /**
   * 添加到历史记录
   */
  async addToHistory(keyword) {
    if (!authManager.isAuthenticated()) return;

    try {
      const settings = await apiService.getUserSettings();
      const maxHistory = settings.maxHistoryPerUser || this.maxHistoryItems;
      
      // 如果超出限制，删除最旧的记录
      if (this.searchHistory.length >= maxHistory) {
        const oldestId = this.searchHistory[this.searchHistory.length - 1].id;
        await apiService.deleteSearchHistory(oldestId);
        this.searchHistory.pop();
      }

      await apiHistoryManager.addToHistory(keyword, 'manual');
      
      // 从本地数组中移除重复项
      this.searchHistory = this.searchHistory.filter(item => 
        item.keyword !== keyword
      );
      
      // 添加新项到数组开头
      this.searchHistory.unshift({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        keyword: keyword,
        query: keyword,
        timestamp: Date.now(),
        count: 1,
        source: 'manual'
      });

      // 确保不超过最大限制
      const maxHistoryLimit = APP_CONSTANTS.LIMITS.MAX_HISTORY;
      if (this.searchHistory.length > maxHistoryLimit) {
        this.searchHistory = this.searchHistory.slice(0, maxHistoryLimit);
      }

      this.renderHistory();
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      showToast('保存搜索历史失败', 'warning');
    }
  }

  /**
   * 渲染搜索历史
   */
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
    }
  }

  /**
   * 从历史记录搜索
   */
  searchFromHistory(keyword) {
    // 触发历史搜索事件
    document.dispatchEvent(new CustomEvent('historySearchRequested', {
      detail: { keyword }
    }));
  }

  /**
   * 删除单条历史记录
   */
  async deleteHistoryItem(historyId) {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      // 调用API删除
      await apiService.deleteSearchHistory(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      // 重新渲染历史列表
      this.renderHistory();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 清空搜索历史
   */
  async clearAllHistory() {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？')) return;
    
    try {
      showLoading(true);
      
      await apiHistoryManager.clearAllHistory();
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

  /**
   * 绑定历史事件
   */
  bindHistoryEvents() {
    // 绑定历史列表点击事件
    document.addEventListener('click', (e) => {
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

    // 绑定清空历史按钮
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    }

    // 监听认证状态变更
    document.addEventListener('authStateChanged', () => {
      this.loadSearchHistory();
    });
  }

  /**
   * 获取搜索建议
   */
  getSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return [];
    
    const queryLower = query.toLowerCase();
    return this.searchHistory
      .filter(item => item.keyword.toLowerCase().includes(queryLower))
      .slice(0, 5); // 最多返回5个建议
  }

  /**
   * 获取历史统计
   */
  getHistoryStats() {
    return {
      totalItems: this.searchHistory.length,
      recentItems: this.searchHistory.slice(0, 10).length,
      oldestTimestamp: this.searchHistory.length > 0 ? 
        Math.min(...this.searchHistory.map(item => item.timestamp)) : null,
      newestTimestamp: this.searchHistory.length > 0 ? 
        Math.max(...this.searchHistory.map(item => item.timestamp)) : null
    };
  }

  /**
   * 导出搜索历史
   */
  exportHistory() {
    const exportData = {
      searchHistory: this.searchHistory,
      stats: this.getHistoryStats(),
      exportTime: new Date().toISOString(),
      version: '3.0.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('搜索历史导出成功', 'success');
  }

  /**
   * 获取当前历史列表
   */
  getHistory() {
    return [...this.searchHistory];
  }

  /**
   * 检查关键词是否在历史中
   */
  isInHistory(keyword) {
    return this.searchHistory.some(item => item.keyword === keyword);
  }

  /**
   * 获取最近搜索的关键词
   */
  getRecentKeywords(limit = 5) {
    return this.searchHistory
      .slice(0, limit)
      .map(item => item.keyword);
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.searchHistory = [];
    console.log('搜索历史管理器资源已清理');
  }
}

export default SearchHistoryManager;