// 历史页面管理器
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class HistoryManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.searchHistory = [];
  }

  async init() {
    console.log('🕒 初始化历史管理器');
  }

  async loadData() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录，无法加载历史数据');
      return;
    }

    try {
      const historyResult = await apiService.getSearchHistory();
      
      if (historyResult) {
        this.searchHistory = historyResult.map(item => ({
          id: item.id || `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          keyword: item.keyword || item.query,
          query: item.query || item.keyword,
          source: item.source || 'unknown',
          timestamp: item.timestamp || item.createdAt || Date.now(),
          count: item.count || 1
        })).filter(item => {
          return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
        });
      } else {
        this.searchHistory = [];
      }
      
      console.log(`加载了 ${this.searchHistory.length} 条搜索历史`);
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
    }
  }

  async loadTabData() {
    await this.loadHistoryData();
  }

  async loadHistoryData() {
    const historyList = document.getElementById('historyList');
    const historyCount = document.getElementById('historyCount');
    const uniqueKeywords = document.getElementById('uniqueKeywords');
    const avgPerDay = document.getElementById('avgPerDay');

    // 更新统计数据
    if (historyCount) historyCount.textContent = this.searchHistory.length;
    
    const unique = new Set(this.searchHistory.map(h => h.keyword)).size;
    if (uniqueKeywords) uniqueKeywords.textContent = unique;

    const daysActive = this.calculateActiveDays() || 1;
    if (avgPerDay) avgPerDay.textContent = Math.round(this.searchHistory.length / daysActive);

    if (!historyList) return;

    if (this.searchHistory.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🕒</span>
          <p>暂无搜索历史</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = this.searchHistory.slice(0, 50).map(item => `
      <div class="history-item">
        <div class="history-content">
          <div class="history-keyword">${escapeHtml(item.keyword)}</div>
          <div class="history-time">${formatRelativeTime(item.timestamp)}</div>
        </div>
        <div class="history-actions">
          <button class="action-btn search-again-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
            重新搜索
          </button>
          <button class="action-btn delete-history-btn" onclick="app.getManager('history').deleteHistoryItem('${item.id}')" title="删除这条记录">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }

  calculateActiveDays() {
    if (this.searchHistory.length === 0) return 0;
    
    const dates = new Set(
      this.searchHistory.map(h => new Date(h.timestamp).toDateString())
    );
    return dates.size;
  }

  // 删除单条搜索历史记录
  async deleteHistoryItem(historyId) {
    if (!this.app.getCurrentUser()) {
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
      
      // 重新加载历史数据
      await this.loadHistoryData();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
      
      // 重新加载云端数据以恢复状态
      await this.loadData();
    } finally {
      showLoading(false);
    }
  }

  // 清空搜索历史
  async clearAllHistory() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？此操作不可恢复。')) return;

    try {
      showLoading(true);
      
      // 使用API清空
      await apiService.clearAllSearchHistory();
      
      // 清空本地数据
      this.searchHistory = [];
      
      // 重新加载数据
      await this.loadHistoryData();
      
      showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 公共方法供其他管理器调用
  getSearchHistory() {
    return this.searchHistory;
  }

  getHistoryCount() {
    return this.searchHistory.length;
  }

  getUniqueKeywordsCount() {
    return new Set(this.searchHistory.map(h => h.keyword)).size;
  }

  getActiveDaysCount() {
    return this.calculateActiveDays();
  }
}

export default HistoryManager;