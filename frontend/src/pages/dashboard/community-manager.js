// 社区管理器主文件 - 协调标签和搜索源两个专门的管理器
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import CommunityTagsManager from './community-tags-manager.js';
import CommunitySourcesManager from './community-sources-manager.js';

export class CommunityManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.isInitialized = false;
    
    // 初始化专门的管理器
    this.communityTags = new CommunityTagsManager(dashboardApp);
    this.communitySources = new CommunitySourcesManager(dashboardApp);
    
    // 🔧 新架构：服务实例引用
    this.communityService = null;
    this.notificationService = null;
  }

  async init() {
    console.log('初始化社区管理器');
    try {
      // 🔧 新架构：获取所需的服务实例
      this.communityService = this.app.getService('communityService');
      this.notificationService = this.app.getService('notificationService');
      
      if (!this.communityService) {
        console.warn('社区服务未找到，某些功能可能受限');
      }
      
      // 初始化子管理器
      await Promise.all([
        this.communityTags.init(),
        this.communitySources.init()
      ]);
      
      this.isInitialized = true;
      console.log('社区管理器初始化完成');
    } catch (error) {
      console.error('社区管理器初始化失败:', error);
      throw error;
    }
  }

  async loadTabData() {
    if (!this.isInitialized) {
      await this.init();
    }
    
    try {
      showLoading(true);
      
      // 先绑定事件
      await this.bindEvents();
      
      // 🔧 调整加载顺序，确保标签数据优先加载
      await Promise.all([
        this.communityTags.loadAvailableTags(), // 首先加载标签数据
        this.communitySources.loadUserCommunityStats(),
        this.communityTags.loadPopularTags()
      ]);
      
      // 标签数据加载完成后再加载搜索源列表
      await this.communitySources.loadCommunitySourcesList();
      
      this.communitySources.renderCommunityControls();
      this.communitySources.updateCommunityStats();
      
    } catch (error) {
      console.error('加载社区数据失败:', error);
      
      // 🔧 新架构：使用通知服务
      if (this.notificationService) {
        this.notificationService.showToast('加载社区数据失败: ' + error.message, 'error');
      } else {
        showToast('加载社区数据失败: ' + error.message, 'error');
      }
    } finally {
      showLoading(false);
    }
  }

  async bindEvents() {
    const waitForDOM = () => {
      return new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      });
    };
    
    await waitForDOM();
    
    console.log('开始绑定社区管理器事件');
    
    // 绑定搜索和过滤事件 - 委托给搜索源管理器
    await this.communitySources.bindEvents();

    // 绑定标签相关按钮事件
    const tagCreateBtn = document.getElementById('tagCreateBtn');
    if (tagCreateBtn) {
      tagCreateBtn.addEventListener('click', () => this.communityTags.showCreateTagModal());
    }

    const tagManageBtn = document.getElementById('tagManageBtn');
    if (tagManageBtn) {
        tagManageBtn.addEventListener('click', () => this.communityTags.showManageMyTagsModal());
    }

    console.log('社区管理器所有事件绑定完成');
  }

  // ==============================================
  // 公共API方法 - 保持向后兼容性
  // ==============================================

  // 标签相关方法 - 委托给标签管理器
  async loadAvailableTags() {
    return await this.communityTags.loadAvailableTags();
  }

  async loadPopularTags() {
    return await this.communityTags.loadPopularTags();
  }

  showCreateTagModal() {
    return this.communityTags.showCreateTagModal();
  }

  showEditTagModal(tagId) {
    return this.communityTags.showEditTagModal(tagId);
  }

  confirmDeleteTag(tagId, tagName) {
    return this.communityTags.confirmDeleteTag(tagId, tagName);
  }

  showManageMyTagsModal() {
    return this.communityTags.showManageMyTagsModal();
  }

  // 搜索源相关方法 - 委托给搜索源管理器
  async loadCommunitySourcesList() {
    return await this.communitySources.loadCommunitySourcesList();
  }

  async loadUserCommunityStats() {
    return await this.communitySources.loadUserCommunityStats();
  }

  showShareSourceModal() {
    return this.communitySources.showShareSourceModal();
  }

  showMySharesModal() {
    return this.communitySources.showMySharesModal();
  }

  async downloadSource(sourceId) {
    return await this.communitySources.downloadSource(sourceId);
  }

  async toggleLike(sourceId) {
    return await this.communitySources.toggleLike(sourceId);
  }

  async viewSourceDetails(sourceId) {
    return await this.communitySources.viewSourceDetails(sourceId);
  }

  showReviewModal(sourceId) {
    return this.communitySources.showReviewModal(sourceId);
  }

  showReportModal(sourceId) {
    return this.communitySources.showReportModal(sourceId);
  }

  async goToPage(page) {
    return await this.communitySources.goToPage(page);
  }

  async searchByTag(tagName) {
    return await this.communitySources.searchByTag(tagName);
  }

  confirmDeleteShare(sourceId, sourceName) {
    return this.communitySources.confirmDeleteShare(sourceId, sourceName);
  }

  editMyShare(sourceId) {
    return this.communitySources.editMyShare(sourceId);
  }

  async showTagSourcesModal(tagId, tagName) {
    return await this.communitySources.showTagSourcesModal(tagId, tagName);
  }

  // 标签选择器相关方法 - 委托处理
  filterTags(searchTerm) {
    return this.communitySources.filterTags(searchTerm);
  }

  updateSelectedTags() {
    return this.communitySources.updateSelectedTags();
  }

  removeSelectedTag(tagId) {
    return this.communitySources.removeSelectedTag(tagId);
  }

  // 渲染相关方法 - 委托处理
  renderCommunityControls() {
    return this.communitySources.renderCommunityControls();
  }

  updateCommunityStats() {
    return this.communitySources.updateCommunityStats();
  }

  // 公共数据访问方法
  getTotalCommunityStats() {
    return this.communitySources.getTotalCommunityStats();
  }

  getCurrentSources() {
    return this.communitySources.getCurrentSources();
  }

  getCurrentPagination() {
    return this.communitySources.getCurrentPagination();
  }

  getUserStats() {
    return this.communitySources.getUserStats();
  }

  getAvailableTags() {
    return this.communityTags.getAvailableTags();
  }

  getPopularTags() {
    return this.communityTags.getPopularTags();
  }

  // 刷新社区数据
  async refreshCommunityData() {
    console.log('刷新社区数据');
    await this.loadTabData();
  }

  // 搜索社区内容 - 🔧 使用新的服务架构
  async searchCommunity(query) {
    try {
      // 如果有社区服务，优先使用服务层搜索
      if (this.communityService && typeof this.communityService.searchCommunityContent === 'function') {
        const result = await this.communityService.searchCommunityContent(query, {
          includeInactive: false,
          limit: 20
        });
        
        if (result.success) {
          // 更新搜索源管理器的数据
          this.communitySources.handleSearchResults(result.data, query);
          return result;
        }
      }
      
      // 降级到搜索源管理器的搜索功能
      return await this.communitySources.searchCommunity(query);
      
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      
      if (this.notificationService) {
        this.notificationService.showToast('搜索失败: ' + error.message, 'error');
      }
      
      throw error;
    }
  }

  // ==============================================
  // 内部协调方法
  // ==============================================

  // 当标签数据更新时，通知搜索源管理器
  async onTagsUpdated() {
    console.log('标签数据已更新，通知搜索源管理器');
    
    // 如果搜索源列表已经加载，重新渲染以显示正确的标签名称
    const currentSources = this.communitySources.getCurrentSources();
    const currentPagination = this.communitySources.getCurrentPagination();
    
    if (currentSources && currentSources.length > 0) {
      console.log('重新渲染搜索源列表以显示更新后的标签');
      this.communitySources.renderCommunitySourcesList(currentSources, currentPagination);
    }
  }

  // 当搜索源数据更新时，通知标签管理器
  async onSourcesUpdated() {
    console.log('搜索源数据已更新，检查是否需要更新标签使用统计');
    
    // 可以在这里添加标签使用统计的更新逻辑
    // 例如重新加载热门标签
    await this.communityTags.loadPopularTags();
  }

  // ==============================================
  // 🔧 新架构：社区统计和概览功能
  // ==============================================

  // 🆕 获取社区统计概览
  async getCommunityOverview() {
    try {
      if (this.communityService && typeof this.communityService.getCommunityStats === 'function') {
        const stats = await this.communityService.getCommunityStats();
        return stats;
      }
      
      // 降级方案：从各个管理器收集统计信息
      const [userStats, tagsStats] = await Promise.all([
        this.communitySources.getUserStats() || {},
        this.getCommunityTagsStats()
      ]);
      
      return {
        success: true,
        data: {
          userStats,
          tagsStats,
          timestamp: Date.now()
        }
      };
      
    } catch (error) {
      console.error('获取社区概览失败:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }

  // 🆕 获取社区标签统计
  async getCommunityTagsStats() {
    try {
      const availableTags = this.communityTags.getAvailableTags() || [];
      const popularTags = this.communityTags.getPopularTags() || [];
      
      return {
        totalTags: availableTags.length,
        popularTagsCount: popularTags.length,
        officialTagsCount: availableTags.filter(tag => tag.isOfficial).length,
        userTagsCount: availableTags.filter(tag => !tag.isOfficial).length,
        averageUsage: availableTags.length > 0 ? 
          availableTags.reduce((sum, tag) => sum + (tag.usageCount || 0), 0) / availableTags.length : 0
      };
    } catch (error) {
      console.error('获取标签统计失败:', error);
      return {
        totalTags: 0,
        popularTagsCount: 0,
        officialTagsCount: 0,
        userTagsCount: 0,
        averageUsage: 0
      };
    }
  }

  // 🆕 获取最近社区活动
  async getRecentActivity() {
    try {
      if (this.communityService && typeof this.communityService.getRecentActivity === 'function') {
        return await this.communityService.getRecentActivity();
      }
      
      // 降级方案：从本地数据构建活动列表
      const recentSources = this.communitySources.getCurrentSources()?.slice(0, 5) || [];
      const recentTags = this.communityTags.getPopularTags()?.slice(0, 3) || [];
      
      const activities = [
        ...recentSources.map(source => ({
          type: 'source_shared',
          data: source,
          timestamp: source.created_at || Date.now()
        })),
        ...recentTags.map(tag => ({
          type: 'tag_popular',
          data: tag,
          timestamp: Date.now()
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
      
      return {
        success: true,
        activities
      };
      
    } catch (error) {
      console.error('获取最近活动失败:', error);
      return {
        success: false,
        activities: []
      };
    }
  }

  // 🆕 获取趋势内容
  async getTrendingContent() {
    try {
      if (this.communityService && typeof this.communityService.getTrendingContent === 'function') {
        return await this.communityService.getTrendingContent();
      }
      
      // 降级方案：基于本地数据分析趋势
      const sources = this.communitySources.getCurrentSources() || [];
      const tags = this.communityTags.getPopularTags() || [];
      
      // 按下载量和点赞数排序找出热门内容
      const trendingSources = sources
        .sort((a, b) => (b.download_count + b.like_count) - (a.download_count + a.like_count))
        .slice(0, 5);
      
      const trendingTags = tags
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
        .slice(0, 5);
      
      return {
        success: true,
        trending: {
          sources: trendingSources,
          tags: trendingTags
        }
      };
      
    } catch (error) {
      console.error('获取趋势内容失败:', error);
      return {
        success: false,
        trending: {
          sources: [],
          tags: []
        }
      };
    }
  }

  // ==============================================
  // 状态管理
  // ==============================================

  isReady() {
    return this.isInitialized && 
           this.communityTags.isInitialized && 
           this.communitySources.isInitialized;
  }

  getManagerStatus() {
    return {
      main: this.isInitialized,
      tags: this.communityTags.isInitialized,
      sources: this.communitySources.isInitialized,
      ready: this.isReady(),
      services: {
        communityService: !!this.communityService,
        notificationService: !!this.notificationService
      }
    };
  }

  // ==============================================
  // 错误处理和恢复
  // ==============================================

  async handleError(error, context = 'unknown') {
    console.error(`社区管理器错误 (${context}):`, error);
    
    // 根据错误类型采取不同的处理策略
    if (error.message.includes('ambiguous column name') || 
        error.message.includes('GREATEST')) {
      console.log('检测到数据库兼容性问题，尝试恢复...');
      
      const message = '检测到数据库更新，正在应用修复...';
      if (this.notificationService) {
        this.notificationService.showToast(message, 'info');
      } else {
        showToast(message, 'info');
      }
      
      // 延迟提示用户刷新
      setTimeout(() => {
        if (confirm('数据库已更新，是否刷新页面以获得最新功能？')) {
          window.location.reload();
        }
      }, 3000);
      
      return;
    }
    
    // 其他错误的处理
    const message = `操作失败: ${error.message}`;
    if (this.notificationService) {
      this.notificationService.showToast(message, 'error');
    } else {
      showToast(message, 'error');
    }
  }

  // ==============================================
  // 🔧 新架构：服务健康检查
  // ==============================================

  async performHealthCheck() {
    const healthStatus = {
      communityManager: {
        status: this.isInitialized ? 'healthy' : 'unhealthy',
        initialized: this.isInitialized
      },
      communityTags: {
        status: this.communityTags.isInitialized ? 'healthy' : 'unhealthy',
        initialized: this.communityTags.isInitialized,
        tagsCount: this.communityTags.getAvailableTags()?.length || 0
      },
      communitySources: {
        status: this.communitySources.isInitialized ? 'healthy' : 'unhealthy',
        initialized: this.communitySources.isInitialized,
        sourcesCount: this.communitySources.getCurrentSources()?.length || 0
      },
      services: {
        communityService: this.communityService ? 'available' : 'unavailable',
        notificationService: this.notificationService ? 'available' : 'unavailable'
      }
    };

    const overallHealth = Object.values(healthStatus).every(status => 
      typeof status === 'object' ? status.status !== 'unhealthy' : true
    );

    return {
      status: overallHealth ? 'healthy' : 'degraded',
      details: healthStatus,
      timestamp: Date.now()
    };
  }

  // ==============================================
  // 调试和诊断方法
  // ==============================================

  getDebugInfo() {
    return {
      initialized: this.isInitialized,
      managersStatus: this.getManagerStatus(),
      tagsCount: this.communityTags.getAvailableTags()?.length || 0,
      popularTagsCount: this.communityTags.getPopularTags()?.length || 0,
      sourcesCount: this.communitySources.getCurrentSources()?.length || 0,
      userStats: this.communitySources.getUserStats(),
      currentFilters: this.communitySources.currentFilters,
      currentPage: this.communitySources.currentPage,
      servicesAvailable: {
        communityService: !!this.communityService,
        notificationService: !!this.notificationService
      }
    };
  }

  logDebugInfo() {
    console.log('社区管理器调试信息:', this.getDebugInfo());
  }

  // ==============================================
  // 🔧 新架构：服务层集成测试
  // ==============================================

  async testServicesIntegration() {
    console.log('开始测试社区管理器服务集成...');
    
    const tests = [
      {
        name: '标签服务测试',
        test: async () => {
          const tagsService = this.app.getService('communityTagsService');
          if (!tagsService) throw new Error('标签服务未找到');
          
          const result = await tagsService.getAllTags({ active: true });
          return result.success;
        }
      },
      {
        name: '社区源服务测试',
        test: async () => {
          const sourcesService = this.app.getService('communitySourcesService');
          if (!sourcesService) throw new Error('社区源服务未找到');
          
          const result = await sourcesService.getCommunitySearchSources({ limit: 1 });
          return result.success;
        }
      },
      {
        name: '通知服务测试',
        test: async () => {
          if (!this.notificationService) throw new Error('通知服务未找到');
          
          this.notificationService.showToast('服务测试成功', 'success');
          return true;
        }
      }
    ];

    const results = [];
    
    for (const test of tests) {
      try {
        const result = await test.test();
        results.push({
          name: test.name,
          status: result ? 'passed' : 'failed',
          error: null
        });
        console.log(`✅ ${test.name}: 通过`);
      } catch (error) {
        results.push({
          name: test.name,
          status: 'failed',
          error: error.message
        });
        console.error(`❌ ${test.name}: ${error.message}`);
      }
    }

    const passedCount = results.filter(r => r.status === 'passed').length;
    const totalCount = results.length;
    
    console.log(`服务集成测试完成: ${passedCount}/${totalCount} 通过`);
    
    if (this.notificationService) {
      this.notificationService.showToast(
        `服务测试完成: ${passedCount}/${totalCount} 通过`, 
        passedCount === totalCount ? 'success' : 'warning'
      );
    }
    
    return {
      passed: passedCount,
      total: totalCount,
      results
    };
  }
}

export default CommunityManager;