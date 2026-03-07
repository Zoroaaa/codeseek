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
  }

  async init() {
    console.log('初始化社区管理器');
    try {
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
      showToast('加载社区数据失败: ' + error.message, 'error');
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

  // 搜索社区内容
  async searchCommunity(query) {
    return await this.communitySources.searchCommunity(query);
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
      ready: this.isReady()
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
      
      showToast('检测到数据库更新，正在应用修复...', 'info');
      
      // 延迟提示用户刷新
      setTimeout(() => {
        if (confirm('数据库已更新，是否刷新页面以获得最新功能？')) {
          window.location.reload();
        }
      }, 3000);
      
      return;
    }
    
    // 其他错误的处理
    showToast(`操作失败: ${error.message}`, 'error');
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
      currentPage: this.communitySources.currentPage
    };
  }

  logDebugInfo() {
    console.log('社区管理器调试信息:', this.getDebugInfo());
  }
}

export default CommunityManager;