// 统计页面管理器
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { showToast } from '../utils/dom.js';
import apiService from '../services/api.js';

export class StatsManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.statsData = {
      searchStats: {},
      categoryStats: {},
      sourceStats: {},
      timeStats: {}
    };
  }

  async init() {
    console.log('📊 初始化统计管理器');
  }

  async loadData() {
    // 统计数据在切换到统计标签时加载
  }

  async loadTabData() {
    await this.loadStatsData();
  }

  async loadStatsData() {
    if (!this.app.getCurrentUser()) {
      this.renderEmptyStats();
      return;
    }

    try {
      // 从各个管理器获取数据进行统计分析
      await this.collectStatsFromManagers();
      await this.loadServerStats();
      this.renderStatsCharts();
      this.renderStatsSummary();
    } catch (error) {
      console.error('加载统计数据失败:', error);
      showToast('加载统计数据失败', 'error');
      this.renderEmptyStats();
    }
  }

  async collectStatsFromManagers() {
    const favoritesManager = this.app.getManager('favorites');
    const historyManager = this.app.getManager('history');
    const sourcesManager = this.app.getManager('sources');
    const categoriesManager = this.app.getManager('categories');

    // 收集基础统计数据
    this.statsData.basicStats = {
      totalFavorites: favoritesManager ? favoritesManager.getFavoritesCount() : 0,
      totalSearches: historyManager ? historyManager.getHistoryCount() : 0,
      uniqueKeywords: historyManager ? historyManager.getUniqueKeywordsCount() : 0,
      activeDays: historyManager ? historyManager.getActiveDaysCount() : 0,
      totalSources: sourcesManager ? sourcesManager.getTotalSourcesCount() : 0,
      enabledSources: sourcesManager ? sourcesManager.getEnabledSourcesCount() : 0,
      totalCategories: categoriesManager ? categoriesManager.getAllCategories().length : 0
    };

    // 分析搜索历史
    if (historyManager) {
      this.analyzeSearchHistory(historyManager.getSearchHistory());
    }

    // 分析收藏数据
    if (favoritesManager) {
      this.analyzeFavorites(favoritesManager.getFavorites());
    }

    // 分析搜索源使用情况
    if (sourcesManager && historyManager) {
      this.analyzeSourceUsage(
        sourcesManager.getAllSearchSources(),
        historyManager.getSearchHistory()
      );
    }
  }

  analyzeSearchHistory(searchHistory) {
    if (!searchHistory || searchHistory.length === 0) {
      this.statsData.searchStats = {};
      return;
    }

    // 按时间分析
    const timeAnalysis = this.analyzeByTime(searchHistory);
    
    // 按关键词频率分析
    const keywordAnalysis = this.analyzeKeywordFrequency(searchHistory);
    
    // 按搜索源分析
    const sourceAnalysis = this.analyzeBySource(searchHistory);

    this.statsData.searchStats = {
      timeAnalysis,
      keywordAnalysis,
      sourceAnalysis
    };
  }

  analyzeFavorites(favorites) {
    if (!favorites || favorites.length === 0) {
      this.statsData.favoriteStats = {};
      return;
    }

    // 按时间分析收藏趋势
    const timeAnalysis = this.analyzeByTime(favorites.map(f => ({
      timestamp: new Date(f.addedAt).getTime()
    })));

    this.statsData.favoriteStats = {
      timeAnalysis,
      totalCount: favorites.length
    };
  }

  analyzeSourceUsage(allSources, searchHistory) {
    const sourceUsage = {};
    
    // 统计每个搜索源的使用次数
    searchHistory.forEach(item => {
      const sourceId = item.source || 'unknown';
      sourceUsage[sourceId] = (sourceUsage[sourceId] || 0) + 1;
    });

    // 获取搜索源详细信息
    const sourceStats = Object.entries(sourceUsage).map(([sourceId, count]) => {
      const source = allSources.find(s => s.id === sourceId);
      return {
        id: sourceId,
        name: source ? source.name : '未知搜索源',
        icon: source ? source.icon : '❓',
        count,
        percentage: Math.round((count / searchHistory.length) * 100)
      };
    }).sort((a, b) => b.count - a.count);

    this.statsData.sourceStats = sourceStats;
  }

  analyzeByTime(dataArray) {
    if (!dataArray || dataArray.length === 0) return {};

    const now = Date.now();
    const timeRanges = {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      last7Days: Array(7).fill(0),
      last30Days: Array(30).fill(0)
    };

    dataArray.forEach(item => {
      const timestamp = item.timestamp;
      const daysDiff = Math.floor((now - timestamp) / (1000 * 60 * 60 * 24));
      
      // 今天
      if (daysDiff === 0) {
        timeRanges.today++;
      }
      
      // 这周
      if (daysDiff < 7) {
        timeRanges.thisWeek++;
        timeRanges.last7Days[6 - daysDiff]++;
      }
      
      // 这个月
      if (daysDiff < 30) {
        timeRanges.thisMonth++;
        timeRanges.last30Days[29 - daysDiff]++;
      }
    });

    return timeRanges;
  }

  analyzeKeywordFrequency(searchHistory) {
    const keywordCount = {};
    
    searchHistory.forEach(item => {
      const keyword = item.keyword;
      keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
    });

    return Object.entries(keywordCount)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // 取前20个高频关键词
  }

  analyzeBySource(searchHistory) {
    const sourceCount = {};
    
    searchHistory.forEach(item => {
      const source = item.source || 'unknown';
      sourceCount[source] = (sourceCount[source] || 0) + 1;
    });

    return Object.entries(sourceCount)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);
  }

  async loadServerStats() {
    try {
      const serverStats = await apiService.getSearchStats();
      this.statsData.serverStats = serverStats;
    } catch (error) {
      console.warn('获取服务器统计数据失败:', error);
      this.statsData.serverStats = {};
    }
  }

  renderStatsCharts() {
    this.renderSearchTrendChart();
    this.renderSourceUsageChart();
    this.renderKeywordCloud();
    this.renderActivityHeatmap();
  }

  renderSearchTrendChart() {
    const chartContainer = document.getElementById('searchTrendChart');
    if (!chartContainer) return;

    const timeData = this.statsData.searchStats?.timeAnalysis?.last30Days || [];
    
    if (timeData.every(count => count === 0)) {
      chartContainer.innerHTML = '<p class="empty-chart">暂无搜索趋势数据</p>';
      return;
    }

    // 简单的文本图表，实际项目中可以使用 Chart.js 等图表库
    const maxValue = Math.max(...timeData);
    const chartHTML = timeData.map((value, index) => {
      const height = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
      const date = new Date();
      date.setDate(date.getDate() - (29 - index));
      
      return `
        <div class="chart-bar" title="${date.toLocaleDateString()}: ${value}次搜索">
          <div class="bar-fill" style="height: ${height}%"></div>
          <div class="bar-label">${date.getDate()}</div>
        </div>
      `;
    }).join('');

    chartContainer.innerHTML = `
      <div class="simple-chart">
        <div class="chart-title">最近30天搜索趋势</div>
        <div class="chart-bars">${chartHTML}</div>
      </div>
    `;
  }

  renderSourceUsageChart() {
    const chartContainer = document.getElementById('sourceUsageChart');
    if (!chartContainer) return;

    const sourceStats = this.statsData.sourceStats || [];
    
    if (sourceStats.length === 0) {
      chartContainer.innerHTML = '<p class="empty-chart">暂无搜索源使用数据</p>';
      return;
    }

    const chartHTML = sourceStats.slice(0, 10).map(stat => `
      <div class="usage-item">
        <div class="usage-source">
          <span class="source-icon">${stat.icon}</span>
          <span class="source-name">${escapeHtml(stat.name)}</span>
        </div>
        <div class="usage-bar">
          <div class="usage-fill" style="width: ${stat.percentage}%"></div>
        </div>
        <div class="usage-count">${stat.count}次 (${stat.percentage}%)</div>
      </div>
    `).join('');

    chartContainer.innerHTML = `
      <div class="usage-chart">
        <div class="chart-title">搜索源使用统计</div>
        <div class="usage-list">${chartHTML}</div>
      </div>
    `;
  }

  renderKeywordCloud() {
    const container = document.getElementById('keywordCloud');
    if (!container) return;

    const keywords = this.statsData.searchStats?.keywordAnalysis || [];
    
    if (keywords.length === 0) {
      container.innerHTML = '<p class="empty-chart">暂无关键词数据</p>';
      return;
    }

    const maxCount = Math.max(...keywords.map(k => k.count));
    const cloudHTML = keywords.slice(0, 20).map(keyword => {
      const size = Math.max(12, Math.round((keyword.count / maxCount) * 24));
      return `
        <span class="keyword-tag" style="font-size: ${size}px;" title="${keyword.count}次搜索">
          ${escapeHtml(keyword.keyword)}
        </span>
      `;
    }).join('');

    container.innerHTML = `
      <div class="keyword-cloud">
        <div class="chart-title">热门搜索关键词</div>
        <div class="cloud-content">${cloudHTML}</div>
      </div>
    `;
  }

  renderActivityHeatmap() {
    const container = document.getElementById('activityHeatmap');
    if (!container) return;

    const timeData = this.statsData.searchStats?.timeAnalysis?.last7Days || [];
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    
    const maxValue = Math.max(...timeData);
    const heatmapHTML = timeData.map((value, index) => {
      const intensity = maxValue > 0 ? Math.round((value / maxValue) * 4) : 0;
      return `
        <div class="heatmap-cell intensity-${intensity}" title="${days[index]}: ${value}次搜索">
          <div class="cell-day">${days[index]}</div>
          <div class="cell-value">${value}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="activity-heatmap">
        <div class="chart-title">一周活动热力图</div>
        <div class="heatmap-grid">${heatmapHTML}</div>
      </div>
    `;
  }

  renderStatsSummary() {
    const container = document.getElementById('statsSummary');
    if (!container) return;

    const stats = this.statsData.basicStats || {};
    
    container.innerHTML = `
      <div class="stats-summary">
        <div class="summary-cards">
          <div class="stats-card">
            <div class="card-icon">🔍</div>
            <div class="card-content">
              <div class="card-number">${stats.totalSearches || 0}</div>
              <div class="card-label">总搜索次数</div>
            </div>
          </div>
          
          <div class="stats-card">
            <div class="card-icon">⭐</div>
            <div class="card-content">
              <div class="card-number">${stats.totalFavorites || 0}</div>
              <div class="card-label">收藏数量</div>
            </div>
          </div>
          
          <div class="stats-card">
            <div class="card-icon">🎯</div>
            <div class="card-content">
              <div class="card-number">${stats.uniqueKeywords || 0}</div>
              <div class="card-label">不同关键词</div>
            </div>
          </div>
          
          <div class="stats-card">
            <div class="card-icon">📅</div>
            <div class="card-content">
              <div class="card-number">${stats.activeDays || 0}</div>
              <div class="card-label">活跃天数</div>
            </div>
          </div>
          
          <div class="stats-card">
            <div class="card-icon">🌐</div>
            <div class="card-content">
              <div class="card-number">${stats.enabledSources || 0}/${stats.totalSources || 0}</div>
              <div class="card-label">已启用搜索源</div>
            </div>
          </div>
          
          <div class="stats-card">
            <div class="card-icon">📂</div>
            <div class="card-content">
              <div class="card-number">${stats.totalCategories || 0}</div>
              <div class="card-label">搜索分类</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderEmptyStats() {
    const containers = [
      'searchTrendChart',
      'sourceUsageChart', 
      'keywordCloud',
      'activityHeatmap',
      'statsSummary'
    ];

    containers.forEach(id => {
      const container = document.getElementById(id);
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">📊</span>
            <p>暂无统计数据</p>
            <p>开始搜索以生成统计信息</p>
          </div>
        `;
      }
    });
  }

  // 获取统计数据的公共方法
  getStatsData() {
    return this.statsData;
  }

  getBasicStats() {
    return this.statsData.basicStats || {};
  }
}

export default StatsManager;