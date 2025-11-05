// 历史页面管理器 - 修复版本
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class HistoryManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.searchHistory = [];
    this.filteredHistory = [];
    this.currentSearchQuery = '';
    this.currentTimeFilter = 'all';
  }

  async init() {
    console.log('🕒 初始化历史管理器');
    this.bindEvents();
  }

  async loadData() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录,无法加载历史数据');
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
      
      // 初始化过滤结果
      this.filteredHistory = [...this.searchHistory];
      
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.filteredHistory = [];
    }
  }

  async loadTabData() {
    await this.loadHistoryData();
  }

  bindEvents() {
    // 绑定搜索框事件
    const historySearch = document.getElementById('historySearch');
    if (historySearch) {
      historySearch.addEventListener('input', (e) => {
        this.currentSearchQuery = e.target.value.trim();
        this.applyFilters();
      });
      
      // 支持回车搜索
      historySearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.currentSearchQuery = e.target.value.trim();
          this.applyFilters();
        }
      });
    }

    // 绑定时间筛选器事件
    const historyTimeFilter = document.getElementById('historyTimeFilter');
    if (historyTimeFilter) {
      historyTimeFilter.addEventListener('change', (e) => {
        this.currentTimeFilter = e.target.value;
        this.applyFilters();
      });
    }

    // 绑定清空历史按钮
    const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');
    if (clearAllHistoryBtn) {
      clearAllHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    }

    console.log('历史管理器事件绑定完成');
  }

  // 应用搜索和时间筛选
  applyFilters() {
    let filtered = [...this.searchHistory];

    // 应用搜索筛选
    if (this.currentSearchQuery) {
      const query = this.currentSearchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.keyword.toLowerCase().includes(query)
      );
    }

    // 应用时间筛选
    if (this.currentTimeFilter !== 'all') {
      const now = Date.now();
      const timeRanges = {
        'today': 24 * 60 * 60 * 1000,           // 今天
        'week': 7 * 24 * 60 * 60 * 1000,        // 本周
        'month': 30 * 24 * 60 * 60 * 1000       // 本月
      };

      const range = timeRanges[this.currentTimeFilter];
      if (range) {
        filtered = filtered.filter(item => 
          (now - item.timestamp) <= range
        );
      }
    }

    this.filteredHistory = filtered;
    this.renderHistoryList();
  }

  async loadHistoryData() {
    // 应用当前筛选条件
    this.applyFilters();
    
    // 更新统计数据
    this.updateHistoryStats();
    
    // 生成关键词云
    this.generateKeywordCloud();
  }

  updateHistoryStats() {
    const historyCount = document.getElementById('historyCount');
    const uniqueKeywords = document.getElementById('uniqueKeywords');
    const avgPerDay = document.getElementById('avgPerDay');

    // 更新统计数据 - 使用原始数据而非过滤后的数据
    if (historyCount) {
      historyCount.textContent = this.searchHistory.length;
    }
    
    const unique = new Set(this.searchHistory.map(h => h.keyword)).size;
    if (uniqueKeywords) {
      uniqueKeywords.textContent = unique;
    }

    const daysActive = this.calculateActiveDays() || 1;
    if (avgPerDay) {
      avgPerDay.textContent = Math.round(this.searchHistory.length / daysActive);
    }
  }

  renderHistoryList() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;

    if (this.filteredHistory.length === 0) {
      const emptyMessage = this.currentSearchQuery || this.currentTimeFilter !== 'all'
        ? '未找到符合条件的搜索记录'
        : '暂无搜索历史';
        
      historyList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🕒</span>
          <p>${emptyMessage}</p>
          ${this.currentSearchQuery || this.currentTimeFilter !== 'all' ? 
            '<button class="btn-secondary" onclick="app.getManager(\'history\').clearFilters()">清除筛选</button>' : 
            ''}
        </div>
      `;
      return;
    }

    // 按时间降序排序(最新的在前)
    const sortedHistory = [...this.filteredHistory].sort((a, b) => b.timestamp - a.timestamp);

    historyList.innerHTML = sortedHistory.map(item => `
      <div class="history-item" data-history-id="${item.id}">
        <div class="history-content">
          <div class="history-keyword">${escapeHtml(item.keyword)}</div>
          <div class="history-meta">
            <span class="history-time">${formatRelativeTime(item.timestamp)}</span>
            ${item.count > 1 ? `<span class="history-count">搜索 ${item.count} 次</span>` : ''}
            <span class="history-source">${this.getSourceLabel(item.source)}</span>
          </div>
        </div>
        <div class="history-actions">
          <button class="action-btn search-again-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'" title="使用此关键词重新搜索">
            🔍 重新搜索
          </button>
          <button class="action-btn delete-history-btn" onclick="app.getManager('history').deleteHistoryItem('${item.id}')" title="删除这条记录">
            🗑️ 删除
          </button>
        </div>
      </div>
    `).join('');

    console.log(`渲染了 ${sortedHistory.length} 条历史记录`);
  }

  // 生成关键词云
  generateKeywordCloud() {
    const keywordCloud = document.getElementById('keywordCloud');
    if (!keywordCloud) return;

    // 统计关键词频率
    const keywordFreq = {};
    this.searchHistory.forEach(item => {
      const keyword = item.keyword;
      keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
    });

    // 转换为数组并排序
    const keywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20); // 只取前20个

    if (keywords.length === 0) {
      keywordCloud.innerHTML = '<p style="text-align: center; color: var(--text-muted);">暂无热门搜索</p>';
      return;
    }

    // 找出最大和最小频率,用于计算字体大小
    const maxFreq = keywords[0][1];
    const minFreq = keywords[keywords.length - 1][1];

    keywordCloud.innerHTML = keywords.map(([keyword, freq]) => {
      // 根据频率计算字体大小 (12px - 24px)
      const size = minFreq === maxFreq ? 16 : 
        12 + ((freq - minFreq) / (maxFreq - minFreq)) * 12;
      
      return `
        <span class="keyword-tag" 
              style="font-size: ${size}px; opacity: ${0.6 + (freq / maxFreq) * 0.4};"
              onclick="window.location.href='./index.html?q=${encodeURIComponent(keyword)}'"
              title="搜索 ${freq} 次">
          ${escapeHtml(keyword)}
        </span>
      `;
    }).join('');
  }

  // 清除筛选条件
  clearFilters() {
    this.currentSearchQuery = '';
    this.currentTimeFilter = 'all';
    
    const historySearch = document.getElementById('historySearch');
    const historyTimeFilter = document.getElementById('historyTimeFilter');
    
    if (historySearch) historySearch.value = '';
    if (historyTimeFilter) historyTimeFilter.value = 'all';
    
    this.applyFilters();
    showToast('已清除筛选条件', 'info');
  }

  calculateActiveDays() {
    if (this.searchHistory.length === 0) return 0;
    
    const dates = new Set(
      this.searchHistory.map(h => new Date(h.timestamp).toDateString())
    );
    return dates.size;
  }

  // 获取来源标签
  getSourceLabel(source) {
    const sourceLabels = {
      'manual': '手动搜索',
      'suggestion': '搜索建议',
      'history': '历史记录',
      'unknown': '未知'
    };
    return sourceLabels[source] || source;
  }

  // 删除单条搜索历史记录
  async deleteHistoryItem(historyId) {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗?')) return;

    try {
      showLoading(true);
      
      // 调用API删除
      await apiService.deleteSearchHistory(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      this.filteredHistory = this.filteredHistory.filter(item => item.id !== historyId);
      
      // 重新渲染
      this.renderHistoryList();
      this.updateHistoryStats();
      this.generateKeywordCloud();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
      
      // 重新加载云端数据以恢复状态
      await this.loadData();
      await this.loadHistoryData();
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

    if (!confirm('确定要清空所有搜索历史吗?此操作不可恢复。')) return;

    try {
      showLoading(true);
      
      // 使用API清空
      await apiService.clearAllSearchHistory();
      
      // 清空本地数据
      this.searchHistory = [];
      this.filteredHistory = [];
      
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

  // 导出搜索历史
  exportHistory() {
    if (this.searchHistory.length === 0) {
      showToast('没有搜索历史可以导出', 'warning');
      return;
    }

    const exportData = {
      searchHistory: this.searchHistory,
      stats: {
        total: this.searchHistory.length,
        uniqueKeywords: new Set(this.searchHistory.map(h => h.keyword)).size,
        activeDays: this.calculateActiveDays()
      },
      exportTime: new Date().toISOString(),
      version: '1.0.0'
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

  // 公共方法供其他管理器调用
  getSearchHistory() {
    return this.searchHistory;
  }

  getFilteredHistory() {
    return this.filteredHistory;
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

  // 搜索历史中的关键词
  searchInHistory(query) {
    if (!query) {
      this.currentSearchQuery = '';
      this.applyFilters();
      return;
    }

    this.currentSearchQuery = query;
    this.applyFilters();
  }

  // 按时间范围筛选
  filterByTimeRange(range) {
    this.currentTimeFilter = range;
    this.applyFilters();
  }
}

export default HistoryManager;