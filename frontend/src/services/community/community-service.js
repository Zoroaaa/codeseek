// src/services/community/community-service.js
// 社区统计和概览服务 - 新增服务

export class CommunityService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.notificationService = null;
    
    this.statsCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService, notificationService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
    console.log('社区服务已初始化');
  }

  // 获取社区统计概览
  async getCommunityStats() {
    try {
      // 检查缓存
      if (this.isStatsCacheValid()) {
        return { 
          success: true, 
          stats: this.statsCache,
          fromCache: true 
        };
      }

      const response = await this.apiClient.get('/api/community/stats');
      
      if (response.success) {
        const stats = this.processStatsData(response.stats || {});
        this.cacheStats(stats);
        
        return { 
          success: true, 
          stats,
          fromCache: false 
        };
      } else {
        throw new Error(response.message || '获取社区统计失败');
      }
    } catch (error) {
      console.error('获取社区统计失败:', error);
      
      // 返回默认统计作为降级
      const defaultStats = this.getDefaultStats();
      return { 
        success: false, 
        stats: defaultStats,
        error: error.message,
        fromCache: false 
      };
    }
  }

  // 获取用户社区统计
  async getUserCommunityStats() {
    try {
      if (!this.authService?.isAuthenticated()) {
        return {
          success: false,
          stats: null,
          error: '用户未登录'
        };
      }
      
      const response = await this.apiClient.get('/api/community/user/stats');
      
      if (response.success) {
        const stats = this.processUserStatsData(response.stats || {});
        
        return { 
          success: true, 
          stats 
        };
      } else {
        throw new Error(response.message || '获取用户社区统计失败');
      }
    } catch (error) {
      console.error('获取用户社区统计失败:', error);
      
      return {
        success: false,
        stats: this.getDefaultUserStats(),
        error: error.message
      };
    }
  }

  // 搜索社区内容
  async searchCommunityContent(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        throw new Error('搜索查询不能为空');
      }
      
      const params = new URLSearchParams();
      params.append('q', query.trim());
      
      if (options.category && options.category !== 'all') {
        params.append('category', options.category);
      }
      if (options.limit && options.limit > 0) {
        params.append('limit', Math.min(options.limit, 50).toString());
      }
      if (options.offset && options.offset >= 0) {
        params.append('offset', options.offset.toString());
      }
      if (options.sort) {
        params.append('sort', options.sort);
      }
      if (options.timeRange) {
        params.append('timeRange', options.timeRange);
      }
      if (options.type) {
        params.append('type', options.type);
      }
      
      const endpoint = `/api/community/search?${params.toString()}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          results: this.processSearchResults(response.results || []),
          total: response.total || 0,
          query: response.query || query,
          suggestions: response.suggestions || [],
          facets: response.facets || {}
        };
      } else {
        throw new Error(response.message || '搜索社区内容失败');
      }
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      return {
        success: false,
        results: [],
        total: 0,
        error: error.message
      };
    }
  }

  // 获取社区最近活动
  async getRecentActivity(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.limit) {
        params.append('limit', Math.min(options.limit, 100).toString());
      }
      if (options.type) {
        params.append('type', options.type);
      }
      if (options.timeRange) {
        params.append('timeRange', options.timeRange);
      }
      
      const endpoint = `/api/community/activity${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          activities: this.processActivityData(response.activities || [])
        };
      } else {
        throw new Error(response.message || '获取社区活动失败');
      }
    } catch (error) {
      console.error('获取社区活动失败:', error);
      return {
        success: false,
        activities: [],
        error: error.message
      };
    }
  }

  // 获取热门内容
  async getTrendingContent(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.category) {
        params.append('category', options.category);
      }
      if (options.timeRange) {
        params.append('timeRange', options.timeRange);
      }
      if (options.limit) {
        params.append('limit', Math.min(options.limit, 50).toString());
      }
      
      const endpoint = `/api/community/trending${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          trending: {
            sources: this.processTrendingData(response.trending?.sources || []),
            tags: this.processTrendingData(response.trending?.tags || []),
            searches: this.processTrendingData(response.trending?.searches || [])
          }
        };
      } else {
        throw new Error(response.message || '获取热门内容失败');
      }
    } catch (error) {
      console.error('获取热门内容失败:', error);
      return {
        success: false,
        trending: {
          sources: [],
          tags: [],
          searches: []
        },
        error: error.message
      };
    }
  }

  // 获取社区排行榜
  async getCommunityLeaderboard(type = 'contributors', options = {}) {
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      
      if (options.limit) {
        params.append('limit', Math.min(options.limit, 100).toString());
      }
      if (options.timeRange) {
        params.append('timeRange', options.timeRange);
      }
      
      const endpoint = `/api/community/leaderboard?${params.toString()}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          leaderboard: this.processLeaderboardData(response.leaderboard || []),
          type,
          timeRange: options.timeRange || 'all'
        };
      } else {
        throw new Error(response.message || '获取排行榜失败');
      }
    } catch (error) {
      console.error('获取社区排行榜失败:', error);
      return {
        success: false,
        leaderboard: [],
        error: error.message
      };
    }
  }

  // 获取社区公告
  async getCommunityAnnouncements(options = {}) {
    try {
      const params = new URLSearchParams();
      
      if (options.limit) {
        params.append('limit', Math.min(options.limit, 20).toString());
      }
      if (options.active !== undefined) {
        params.append('active', options.active.toString());
      }
      
      const endpoint = `/api/community/announcements${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.apiClient.get(endpoint);
      
      if (response.success) {
        return {
          success: true,
          announcements: this.processAnnouncementsData(response.announcements || [])
        };
      } else {
        throw new Error(response.message || '获取社区公告失败');
      }
    } catch (error) {
      console.error('获取社区公告失败:', error);
      return {
        success: false,
        announcements: [],
        error: error.message
      };
    }
  }

  // 举报社区内容
  async reportContent(contentType, contentId, reportData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!contentType || !contentId || !reportData) {
        throw new Error('举报信息不完整');
      }

      const validTypes = ['source', 'tag', 'comment', 'user'];
      if (!validTypes.includes(contentType)) {
        throw new Error('无效的内容类型');
      }

      const validReasons = ['spam', 'inappropriate', 'copyright', 'malicious', 'misleading', 'other'];
      if (!validReasons.includes(reportData.reason)) {
        throw new Error('无效的举报原因');
      }

      if (!reportData.details || reportData.details.trim().length < 10) {
        throw new Error('举报详情至少需要10个字符');
      }

      const payload = {
        contentType,
        contentId,
        reason: reportData.reason,
        details: reportData.details.trim(),
        category: reportData.category || 'general',
        evidence: reportData.evidence || null
      };

      const response = await this.apiClient.post('/api/community/reports', payload);

      if (response.success) {
        this.showNotification('举报已提交，我们会尽快处理', 'success');
        
        return {
          success: true,
          message: response.message || '举报已提交',
          reportId: response.reportId
        };
      } else {
        throw new Error(response.message || '提交举报失败');
      }
    } catch (error) {
      console.error('举报内容失败:', error);
      this.showNotification(error.message, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 获取社区规则
  async getCommunityRules() {
    try {
      const response = await this.apiClient.get('/api/community/rules');
      
      if (response.success) {
        return {
          success: true,
          rules: response.rules || []
        };
      } else {
        throw new Error(response.message || '获取社区规则失败');
      }
    } catch (error) {
      console.error('获取社区规则失败:', error);
      return {
        success: false,
        rules: this.getDefaultRules(),
        error: error.message
      };
    }
  }

  // 数据处理方法
  processStatsData(rawStats) {
    return {
      totalSources: rawStats.totalSources || 0,
      totalDownloads: rawStats.totalDownloads || 0,
      totalUsers: rawStats.totalUsers || 0,
      totalReviews: rawStats.totalReviews || 0,
      averageRating: rawStats.averageRating || 0,
      categoriesCount: rawStats.categoriesCount || 0,
      topCategories: rawStats.topCategories || [],
      recentActivity: rawStats.recentActivity || [],
      growthStats: {
        sourcesGrowth: rawStats.growthStats?.sourcesGrowth || 0,
        usersGrowth: rawStats.growthStats?.usersGrowth || 0,
        downloadsGrowth: rawStats.growthStats?.downloadsGrowth || 0
      }
    };
  }

  processUserStatsData(rawStats) {
    return {
      general: {
        sharedSources: rawStats.general?.sharedSources || rawStats.sharedSources || 0,
        sourcesDownloaded: rawStats.general?.sourcesDownloaded || rawStats.sourcesDownloaded || 0,
        totalLikes: rawStats.general?.totalLikes || rawStats.totalLikes || 0,
        totalDownloads: rawStats.general?.totalDownloads || rawStats.totalDownloads || 0,
        totalViews: rawStats.general?.totalViews || rawStats.totalViews || 0,
        reviewsGiven: rawStats.general?.reviewsGiven || rawStats.reviewsGiven || 0,
        tagsCreated: rawStats.general?.tagsCreated || rawStats.tagsCreated || 0,
        reputationScore: rawStats.general?.reputationScore || rawStats.reputationScore || 0,
        contributionLevel: rawStats.general?.contributionLevel || rawStats.contributionLevel || 'beginner'
      },
      recentShares: rawStats.recentShares || []
    };
  }

  processSearchResults(results) {
    return results.map(result => ({
      id: result.id,
      type: result.type || 'source',
      title: result.title || result.name,
      description: result.description || result.subtitle || '',
      category: result.category,
      tags: result.tags || [],
      score: result.score || 0,
      createdAt: result.createdAt || result.timestamp,
      author: result.author || result.user,
      stats: result.stats || {}
    }));
  }

  processActivityData(activities) {
    return activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      action: activity.action,
      user: activity.user,
      target: activity.target,
      timestamp: activity.timestamp,
      description: activity.description
    }));
  }

  processTrendingData(items) {
    return items.map(item => ({
      id: item.id,
      name: item.name || item.title,
      count: item.count || item.score || 0,
      growth: item.growth || 0,
      category: item.category
    }));
  }

  processLeaderboardData(leaderboard) {
    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: entry.user,
      score: entry.score || 0,
      stats: entry.stats || {},
      badge: this.getUserBadge(entry.score || 0)
    }));
  }

  processAnnouncementsData(announcements) {
    return announcements.map(announcement => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type || 'info',
      priority: announcement.priority || 'normal',
      author: announcement.author,
      createdAt: announcement.createdAt,
      expiresAt: announcement.expiresAt,
      isActive: announcement.isActive !== false
    }));
  }

  // 获取用户徽章
  getUserBadge(score) {
    if (score >= 1000) return { name: '传奇贡献者', color: '#ff6b35' };
    if (score >= 500) return { name: '超级贡献者', color: '#f7931e' };
    if (score >= 100) return { name: '活跃贡献者', color: '#1cb841' };
    if (score >= 50) return { name: '贡献者', color: '#4dabf7' };
    return { name: '新手', color: '#868e96' };
  }

  // 默认数据
  getDefaultStats() {
    return {
      totalSources: 0,
      totalDownloads: 0,
      totalUsers: 0,
      totalReviews: 0,
      averageRating: 0,
      categoriesCount: 0,
      topCategories: [],
      recentActivity: [],
      growthStats: {
        sourcesGrowth: 0,
        usersGrowth: 0,
        downloadsGrowth: 0
      }
    };
  }

  getDefaultUserStats() {
    return {
      general: {
        sharedSources: 0,
        sourcesDownloaded: 0,
        totalLikes: 0,
        totalDownloads: 0,
        totalViews: 0,
        reviewsGiven: 0,
        tagsCreated: 0,
        reputationScore: 0,
        contributionLevel: 'beginner'
      },
      recentShares: []
    };
  }

  getDefaultRules() {
    return [
      {
        id: 1,
        title: '尊重他人',
        description: '保持友善和尊重的交流环境'
      },
      {
        id: 2,
        title: '分享优质内容',
        description: '确保分享的搜索源真实有效'
      },
      {
        id: 3,
        title: '遵守法律法规',
        description: '不分享违法或侵权内容'
      }
    ];
  }

  // 缓存管理
  cacheStats(stats) {
    this.statsCache = stats;
    this.cacheTimestamp = Date.now();
  }

  isStatsCacheValid() {
    return this.statsCache && 
           this.cacheTimestamp && 
           Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  clearStatsCache() {
    this.statsCache = null;
    this.cacheTimestamp = null;
  }

  // 工具方法
  showNotification(message, type = 'info') {
    if (this.notificationService) {
      this.notificationService.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 获取服务统计
  getServiceStats() {
    return {
      cacheValid: this.isStatsCacheValid(),
      cacheTimestamp: this.cacheTimestamp
    };
  }

  // 健康检查
  healthCheck() {
    const dependenciesStatus = {
      apiClient: !!this.apiClient,
      authService: !!this.authService,
      notificationService: !!this.notificationService
    };

    return {
      status: 'healthy',
      dependencies: dependenciesStatus,
      cache: {
        valid: this.isStatsCacheValid(),
        timestamp: this.cacheTimestamp
      },
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    this.clearStatsCache();
  }
}

export default CommunityService;