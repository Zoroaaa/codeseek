// 概览页面管理器
import { escapeHtml, formatRelativeTime } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class OverviewManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.stats = {
      totalSearches: 0,
      totalFavorites: 0,
      totalSources: 0,
      userLevel: '新手'
    };
    this.recentActivity = [];
  }

  async init() {
    console.log('🏠 初始化概览管理器');
  }

  async loadData() {
    // 基础数据由其他管理器提供，这里主要做汇总
  }

  async loadTabData() {
    try {
      await this.loadOverviewData();
      await this.loadRecentActivity();
    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  async loadOverviewData() {
    try {
      const [searchStats] = await Promise.allSettled([
        apiService.getSearchStats()
      ]);
      
      const stats = searchStats.status === 'fulfilled' ? searchStats.value : {
        total: this.getSearchHistoryCount(),
        today: 0,
        thisWeek: 0,
        topQueries: []
      };
      
      // 更新UI
      this.updateStatsUI(stats);
      
    } catch (error) {
      console.error('加载概览数据失败:', error);
      this.loadOverviewDataFromLocal();
    }
  }

  updateStatsUI(stats) {
    const elements = {
      totalSearches: document.getElementById('totalSearches'),
      totalFavorites: document.getElementById('totalFavorites'),
      totalSources: document.getElementById('totalSources'),
      userLevel: document.getElementById('userLevel')
    };

    if (elements.totalSearches) elements.totalSearches.textContent = stats.total || 0;
    if (elements.totalFavorites) elements.totalFavorites.textContent = this.getFavoritesCount();
    if (elements.totalSources) elements.totalSources.textContent = this.getSourcesCount();
    
    const level = this.calculateUserLevel();
    if (elements.userLevel) elements.userLevel.textContent = level;
  }

  async loadRecentActivity() {
    const activityList = document.getElementById('activityList');
    if (!activityList) return;

    try {
      // 获取搜索历史和收藏数据
      const searchHistory = this.getSearchHistory();
      const favorites = this.getFavorites();

      const activities = [
        ...searchHistory.slice(0, 5).map(h => ({
          type: 'search',
          content: `搜索了 "${h.keyword}"`,
          time: h.timestamp,
          icon: '🔍'
        })),
        ...favorites.slice(0, 5).map(f => ({
          type: 'favorite',
          content: `收藏了 "${f.title}"`,
          time: new Date(f.addedAt).getTime(),
          icon: '⭐'
        }))
      ].sort((a, b) => b.time - a.time).slice(0, 10);

      if (activities.length === 0) {
        activityList.innerHTML = '<p class="empty-state">暂无活动记录</p>';
        return;
      }

      activityList.innerHTML = activities.map(activity => `
        <div class="activity-item">
          <span class="activity-icon">${activity.icon}</span>
          <div class="activity-content">
            <div class="activity-text">${escapeHtml(activity.content)}</div>
            <div class="activity-time">${formatRelativeTime(activity.time)}</div>
          </div>
        </div>
      `).join('');

    } catch (error) {
      console.error('加载最近活动失败:', error);
      activityList.innerHTML = '<p class="empty-state">加载活动记录失败</p>';
    }
  }

  loadOverviewDataFromLocal() {
    const elements = {
      totalSearches: document.getElementById('totalSearches'),
      totalFavorites: document.getElementById('totalFavorites'),
      totalSources: document.getElementById('totalSources'),
      userLevel: document.getElementById('userLevel')
    };

    if (elements.totalSearches) elements.totalSearches.textContent = this.getSearchHistoryCount();
    if (elements.totalFavorites) elements.totalFavorites.textContent = this.getFavoritesCount();
    if (elements.totalSources) elements.totalSources.textContent = this.getSourcesCount();
    if (elements.userLevel) elements.userLevel.textContent = this.calculateUserLevel();
  }

  calculateUserLevel() {
    const totalActions = this.getSearchHistoryCount() + this.getFavoritesCount();
    
    if (totalActions < 10) return '新手';
    if (totalActions < 50) return '熟练';
    if (totalActions < 200) return '专业';
    if (totalActions < 500) return '专家';
    return '大师';
  }

  // 从其他管理器获取数据的辅助方法
  getSearchHistoryCount() {
    const historyManager = this.app.getManager('history');
    return historyManager ? historyManager.getHistoryCount() : 0;
  }

  getFavoritesCount() {
    const favoritesManager = this.app.getManager('favorites');
    return favoritesManager ? favoritesManager.getFavoritesCount() : 0;
  }

  getSourcesCount() {
    const sourcesManager = this.app.getManager('sources');
    return sourcesManager ? sourcesManager.getTotalSourcesCount() : 0;
  }

  getSearchHistory() {
    const historyManager = this.app.getManager('history');
    return historyManager ? historyManager.getSearchHistory() : [];
  }

  getFavorites() {
    const favoritesManager = this.app.getManager('favorites');
    return favoritesManager ? favoritesManager.getFavorites() : [];
  }
}

export default OverviewManager;