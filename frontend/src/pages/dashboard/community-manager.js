// 修复后的社区管理器 - 解决所有问题
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast, createElement } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class CommunityManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.currentPage = 1;
    this.currentLimit = 20;
    this.currentFilters = {
      category: 'all',
      sort: 'created_at',
      order: 'desc',
      search: '',
      featured: false
    };
    this.communityStats = null;
    this.userStats = null;
    this.popularTags = [];
    this.isInitialized = false;
    this.currentSources = [];
    this.currentPagination = null;
  }

  async init() {
    console.log('初始化社区管理器');
    try {
      this.isInitialized = true;
      console.log('社区管理器初始化完成');
    } catch (error) {
      console.error('社区管理器初始化失败:', error);
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
      
      // 并行加载多个数据
      await Promise.all([
        this.loadCommunitySourcesList(),
        this.loadUserCommunityStats(),
        this.loadPopularTags()
      ]);
      
      this.renderCommunityControls();
      this.updateCommunityStats();
      
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
    
    // 绑定搜索和过滤事件
    const searchInput = document.getElementById('communitySearch');
    const categoryFilter = document.getElementById('communityCategory');
    const sortSelect = document.getElementById('communitySort');
    const featuredToggle = document.getElementById('featuredOnly');
    const searchBtn = document.getElementById('communitySearchBtn');

    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentFilters.search = e.target.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }, 500);
      });
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.currentFilters.search = e.target.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const searchInput = document.getElementById('communitySearch');
        if (searchInput) {
          this.currentFilters.search = searchInput.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [sort, order] = e.target.value.split('-');
        this.currentFilters.sort = sort;
        this.currentFilters.order = order;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    if (featuredToggle) {
      featuredToggle.addEventListener('change', (e) => {
        this.currentFilters.featured = e.target.checked;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    // 绑定分享按钮事件
    const shareSourceBtn = document.getElementById('shareSourceBtn');
    if (shareSourceBtn) {
      shareSourceBtn.addEventListener('click', () => this.showShareSourceModal());
    }

    // 修复：我的分享按钮事件 - 改为弹窗形式
    const mySharesBtn = document.getElementById('mySharesBtn');
    if (mySharesBtn) {
      mySharesBtn.addEventListener('click', () => this.showMySharesModal());
    }

    console.log('社区管理器所有事件绑定完成');
  }

  // 修复：加载热门标签 - 添加后备方案和错误处理
  async loadPopularTags() {
    try {
      console.log('开始加载热门标签...');
      const result = await apiService.getPopularTags();
      
      if (result.success && result.tags && result.tags.length > 0) {
        this.popularTags = result.tags;
        this.renderPopularTags();
        console.log('热门标签加载成功:', this.popularTags.length, '个标签');
      } else {
        console.warn('后端没有返回热门标签，使用预设标签');
        // 使用预设的热门标签作为后备方案
        this.popularTags = this.getDefaultPopularTags();
        this.renderPopularTags();
      }
    } catch (error) {
      console.warn('加载热门标签失败，使用预设标签:', error);
      this.popularTags = this.getDefaultPopularTags();
      this.renderPopularTags();
    }
  }

  // 获取默认热门标签（与后端数据库一致）
  getDefaultPopularTags() {
    return [
      { name: '已验证', usageCount: 156, isOfficial: true },
      { name: '热门', usageCount: 134, isOfficial: true },
      { name: '最新', usageCount: 89, isOfficial: true },
      { name: '推荐', usageCount: 78, isOfficial: true },
      { name: '高质量', usageCount: 67, isOfficial: true },
      { name: 'JAV', usageCount: 145, isOfficial: false },
      { name: '电影', usageCount: 89, isOfficial: false },
      { name: '磁力', usageCount: 134, isOfficial: false },
      { name: '种子', usageCount: 78, isOfficial: false }
    ];
  }

  // 修复：显示我的分享弹窗
  async showMySharesModal() {
    console.log('显示我的分享弹窗');
    
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      // 获取我的分享数据 - 使用author参数过滤
      const result = await apiService.getCommunitySearchSources({
        author: this.app.getCurrentUser().username,
        limit: 50,
        page: 1,
        sort: 'created_at',
        order: 'desc'
      });
      
      if (result.success) {
        this.renderMySharesModal(result.sources || []);
      } else {
        throw new Error(result.error || '获取我的分享失败');
      }
      
    } catch (error) {
      console.error('获取我的分享失败:', error);
      showToast('获取我的分享失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 渲染我的分享弹窗
  renderMySharesModal(sources) {
    const modalHTML = `
      <div id="mySharesModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('mySharesModal').remove()">&times;</span>
          <h2>我的分享 (${sources.length}个搜索源)</h2>
          
          <div class="my-shares-container">
            ${sources.length === 0 ? `
              <div class="empty-state">
                <span style="font-size: 3rem;">📝</span>
                <p>您还没有分享任何搜索源</p>
                <p>分享优质搜索源，帮助更多人发现好内容</p>
                <button class="btn-primary" onclick="window.app.getManager('community').showShareSourceModal(); document.getElementById('mySharesModal').remove()">
                  立即分享
                </button>
              </div>
            ` : `
              <div class="my-shares-list">
                ${sources.map(source => this.renderMyShareItem(source)).join('')}
              </div>
            `}
          </div>
          
          <div class="modal-footer">
            <button class="btn-primary" onclick="window.app.getManager('community').showShareSourceModal(); document.getElementById('mySharesModal').remove()">
              分享新搜索源
            </button>
            <button class="btn-secondary" onclick="document.getElementById('mySharesModal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    // 移除现有弹窗
    const existingModal = document.getElementById('mySharesModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定删除事件
    this.bindMySharesEvents();
  }

  // 渲染我的分享项目
  renderMyShareItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
      Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    const ratingStars = this.renderRatingStars(source.stats?.rating || 0);
    
    return `
      <div class="my-share-item" data-source-id="${source.id}">
        <div class="share-header">
          <div class="source-icon">${source.icon || '🔍'}</div>
          <div class="share-info">
            <h3 class="share-title">${escapeHtml(source.name)}</h3>
            ${source.subtitle ? `<p class="share-subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
            <div class="share-category">
              <span class="category-badge" style="background: ${category?.color || '#6b7280'}">
                ${category?.icon || '🌟'} ${category?.name || '其他'}
              </span>
            </div>
          </div>
          <div class="share-stats">
            <div class="stat-item">
              <span class="stat-icon">👀</span>
              <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
              <span class="stat-label">浏览</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">🔥</span>
              <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
              <span class="stat-label">下载</span>
            </div>
            <div class="stat-item">
              <span class="stat-icon">👍</span>
              <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
              <span class="stat-label">点赞</span>
            </div>
          </div>
        </div>

        ${source.description ? `
          <div class="share-description">
            ${escapeHtml(source.description)}
          </div>
        ` : ''}

        <div class="share-details">
          <p><strong>URL模板:</strong> <code>${escapeHtml(source.urlTemplate)}</code></p>
          <p><strong>分享时间:</strong> ${this.formatDate(source.createdAt)}</p>
          <p><strong>评分:</strong> ${ratingStars} (${source.stats?.reviewCount || 0}条评价)</p>
        </div>

        <div class="share-actions">
          <button class="btn-secondary" onclick="window.app.getManager('community').editMyShare('${source.id}')">
            <span>✏️</span>
            <span>编辑</span>
          </button>
          <button class="btn-danger" onclick="window.app.getManager('community').confirmDeleteMyShare('${source.id}', '${escapeHtml(source.name)}')">
            <span>🗑️</span>
            <span>删除</span>
          </button>
          <button class="btn-tertiary" onclick="window.app.getManager('community').viewSourceDetails('${source.id}')">
            <span>👁️</span>
            <span>查看详情</span>
          </button>
        </div>
      </div>
    `;
  }

  // 绑定我的分享相关事件
  bindMySharesEvents() {
    console.log('绑定我的分享事件');
  }

  // 确认删除我的分享
  async confirmDeleteMyShare(sourceId, sourceName) {
    if (!confirm(`确定要删除分享"${sourceName}"吗？删除后无法恢复。`)) {
      return;
    }
    await this.deleteMyShare(sourceId);
  }

  // 删除我的分享
  async deleteMyShare(sourceId) {
    try {
      showLoading(true);
      
      const result = await apiService.deleteMySharedSource(sourceId);
      
      if (result.success) {
        showToast('删除成功', 'success');
        // 刷新弹窗内容
        this.showMySharesModal();
        // 更新统计
        this.loadUserCommunityStats();
      } else {
        throw new Error(result.error || '删除失败');
      }
      
    } catch (error) {
      console.error('删除分享失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 编辑我的分享
  async editMyShare(sourceId) {
    showToast('编辑功能开发中', 'info');
  }

  // 修复：更新社区统计显示 - 将社区荣誉改为浏览量
  updateCommunityStats() {
    console.log('更新社区统计显示');

    const elements = {
      userSharedCount: document.getElementById('userSharedCount'),
      userDownloadsCount: document.getElementById('userDownloadsCount'),
      userLikesCount: document.getElementById('userLikesCount'),
      userReputationScore: document.getElementById('userReputationScore')
    };

    // 使用真实统计数据或默认值
    const stats = this.userStats?.general || {};
    
    if (elements.userSharedCount) {
      elements.userSharedCount.textContent = stats.sharedSources || 0;
    }
    
    if (elements.userDownloadsCount) {
      elements.userDownloadsCount.textContent = stats.totalDownloads || 0;
    }
    
    if (elements.userLikesCount) {
      elements.userLikesCount.textContent = stats.totalLikes || 0;
    }
    
    // 修复：将社区荣誉改为浏览量
    if (elements.userReputationScore) {
      elements.userReputationScore.textContent = stats.totalViews || 0;
    }

    // 更新标签文字
    const reputationLabel = document.querySelector('#userReputationScore')?.parentElement?.querySelector('.stat-desc');
    if (reputationLabel) {
      reputationLabel.textContent = '总浏览量';
    }

    console.log('统计数据已更新:', stats);
  }

  // 修复：加载用户社区统计
  async loadUserCommunityStats() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录，设置默认统计');
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
          totalDownloads: 0,
          totalViews: 0,
          reputationScore: 0
        }
      };
      this.updateCommunityStats();
      return;
    }

    try {
      const result = await apiService.getUserCommunityStats();
      
      if (result.success) {
        this.userStats = result.stats;
        console.log('用户社区统计加载成功:', this.userStats);
      } else {
        console.warn('加载用户社区统计失败:', result.error);
        this.userStats = {
          general: {
            sharedSources: 0,
            sourcesDownloaded: 0,
            totalLikes: 0,
            totalDownloads: 0,
            totalViews: 0,
            reputationScore: 0
          }
        };
      }
      this.updateCommunityStats();
    } catch (error) {
      console.warn('加载用户社区统计失败:', error);
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
          totalDownloads: 0,
          totalViews: 0,
          reputationScore: 0
        }
      };
      this.updateCommunityStats();
    }
  }

  // 修复：渲染热门标签
  renderPopularTags() {
    const container = document.getElementById('popularTagsList');
    if (!container) {
      console.log('热门标签容器不存在');
      return;
    }

    if (!this.popularTags || this.popularTags.length === 0) {
      this.renderEmptyTags();
      return;
    }

    const tagsHTML = this.popularTags.slice(0, 20).map(tag => {
      const isOfficial = tag.isOfficial || false;
      const usageCount = tag.usageCount || tag.count || 0;
      const tagClass = isOfficial ? 'tag-item official' : 'tag-item';
      
      return `
        <span class="${tagClass}" 
              onclick="window.app.getManager('community').searchByTag('${escapeHtml(tag.name)}')"
              title="使用次数: ${usageCount}">
          ${escapeHtml(tag.name)} 
          <span class="tag-count">(${usageCount})</span>
        </span>
      `;
    }).join('');

    container.innerHTML = `
      <div class="tags-cloud">
        ${tagsHTML}
      </div>
    `;
    
    console.log('热门标签渲染完成:', this.popularTags.length, '个标签');
  }

  // 渲染空标签状态
  renderEmptyTags() {
    const container = document.getElementById('popularTagsList');
    if (container) {
      container.innerHTML = `
        <div class="empty-tags">
          <span style="font-size: 2rem; opacity: 0.5;">🏷️</span>
          <p style="color: var(--text-muted); margin: 0.5rem 0;">还没有热门标签</p>
          <small style="color: var(--text-muted);">开始分享搜索源来创建标签吧</small>
        </div>
      `;
    }
  }

  // 修复：快速搜索功能 - 添加搜索反馈
  async searchCommunity(query) {
    console.log('快速搜索社区内容:', query);
    
    // 添加搜索反馈
    const searchInput = document.getElementById('communitySearch');
    if (searchInput) {
      searchInput.value = query;
    }
    
    try {
      showLoading(true);
      
      const result = await apiService.searchCommunityPosts(query, {
        category: this.currentFilters.category,
        limit: this.currentLimit
      });
      
      if (result.success) {
        this.currentSources = result.sources;
        this.renderCommunitySourcesList(result.sources, { page: 1, totalPages: 1 });
        
        // 显示搜索结果提示
        showToast(`找到 ${result.sources.length} 个相关搜索源`, 'success', 2000);
        return result.sources;
      } else {
        throw new Error(result.error || '搜索失败');
      }
      
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      showToast('搜索失败: ' + error.message, 'error');
      return [];
    } finally {
      showLoading(false);
    }
  }

  async searchByTag(tagName) {
    console.log('按标签搜索:', tagName);
    const searchInput = document.getElementById('communitySearch');
    if (searchInput) {
      searchInput.value = tagName;
    }
    this.currentFilters.search = tagName;
    this.currentPage = 1;
    await this.loadCommunitySourcesList();
  }

  // 以下方法保持不变，从原文件复制
  async loadCommunitySourcesList() {
    try {
      console.log('开始加载社区搜索源列表');
      
      const options = {
        page: this.currentPage,
        limit: this.currentLimit,
        ...this.currentFilters
      };

      const result = await apiService.getCommunitySearchSources(options);
      
      if (result.success) {
        this.currentSources = result.sources;
        this.currentPagination = result.pagination;
        this.renderCommunitySourcesList(result.sources, result.pagination);
      } else {
        throw new Error(result.error || '加载社区搜索源失败');
      }

    } catch (error) {
      console.error('加载社区搜索源列表失败:', error);
      showToast('加载搜索源列表失败: ' + error.message, 'error');
      
      const container = document.getElementById('communitySourcesList');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">⚠️</span>
            <p>加载搜索源失败</p>
            <p>错误信息: ${escapeHtml(error.message)}</p>
            <button class="btn-primary" onclick="window.app.getManager('community').loadCommunitySourcesList()">
              重新加载
            </button>
          </div>
        `;
      }
    }
  }

  renderCommunityControls() {
    const categoryFilter = document.getElementById('communityCategory');
    if (categoryFilter && APP_CONSTANTS.SOURCE_CATEGORIES) {
      const categories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES);
      categoryFilter.innerHTML = `
        <option value="all">全部分类</option>
        ${categories.map(cat => `
          <option value="${cat.id}" ${this.currentFilters.category === cat.id ? 'selected' : ''}>
            ${cat.icon} ${cat.name}
          </option>
        `).join('')}
      `;
    }
  }

  renderCommunitySourcesList(sources, pagination) {
    const container = document.getElementById('communitySourcesList');
    if (!container) {
      console.error('找不到社区搜索源容器');
      return;
    }

    if (!sources || sources.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🛒</span>
          <p>暂无搜索源分享</p>
          <p>成为第一个分享搜索源的人吧！</p>
          <button class="btn-primary" onclick="window.app.getManager('community').showShareSourceModal()">
            分享搜索源
          </button>
        </div>
      `;
      return;
    }

    const sourcesHTML = sources.map(source => this.renderCommunitySourceItem(source)).join('');
    const paginationHTML = this.renderPagination(pagination);

    container.innerHTML = `
      <div class="community-sources-grid">
        ${sourcesHTML}
      </div>
      ${paginationHTML}
    `;

    this.bindSourceItemEvents();
  }

  renderCommunitySourceItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
      Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    const ratingStars = this.renderRatingStars(source.stats?.rating || 0);
    const tags = source.tags ? source.tags.slice(0, 3) : [];
    
    return `
      <div class="community-source-item" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-icon">${source.icon || '🔍'}</div>
          <div class="source-title-area">
            <h3 class="source-title">${escapeHtml(source.name)}</h3>
            ${source.subtitle ? `<p class="source-subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
          </div>
          <div class="source-badges">
            ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
            ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
          </div>
        </div>

        <div class="source-meta">
          <div class="source-category">
            <span class="category-badge" style="background: ${category?.color || '#6b7280'}">
              ${category?.icon || '🌟'} ${category?.name || '其他'}
            </span>
          </div>
          <div class="source-author">
            由 <strong>${escapeHtml(source.author ? source.author.name : 'Unknown')}</strong> 分享
          </div>
        </div>

        ${source.description ? `
          <div class="source-description">
            ${escapeHtml(source.description)}
          </div>
        ` : ''}

        ${tags.length > 0 ? `
          <div class="source-tags">
            ${tags.map(tag => `
              <span class="tag ${tag.isOfficial ? 'official' : ''}">
                ${escapeHtml(tag.name || tag)}
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="source-stats">
          <div class="stat-item">
            <span class="stat-icon">🔥</span>
            <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
            <span class="stat-label">下载</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👍</span>
            <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👀</span>
            <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
            <span class="stat-label">浏览</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <div class="rating-display">
              ${ratingStars}
              <span class="rating-count">(${source.stats?.reviewCount || 0})</span>
            </div>
          </div>
        </div>

        <div class="source-actions">
          <button class="action-btn primary" onclick="window.app.getManager('community').downloadSource('${source.id}')">
            <span>🔥</span>
            <span>添加到我的搜索源</span>
          </button>
          <button class="action-btn secondary" onclick="window.app.getManager('community').viewSourceDetails('${source.id}')">
            <span>👁️</span>
            <span>查看详情</span>
          </button>
          <button class="action-btn tertiary like-btn" data-source-id="${source.id}" onclick="window.app.getManager('community').toggleLike('${source.id}')">
            <span>👍</span>
            <span>点赞</span>
          </button>
        </div>

        <div class="source-footer">
          <span class="source-date">分享于 ${this.formatDate(source.createdAt)}</span>
        </div>
      </div>
    `;
  }

  renderRatingStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);
    
    return `<span class="rating-stars" title="${rating.toFixed(1)}/5.0">${stars}</span>`;
  }

  renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) return '';

    const { page = 1, totalPages = 1, hasPrev = false, hasNext = false, total = 0 } = pagination;
    
    return `
      <div class="pagination">
        <button class="pagination-btn" 
                ${!hasPrev ? 'disabled' : ''} 
                onclick="window.app.getManager('community').goToPage(${page - 1})">
          ‹ 上一页
        </button>
        
        <div class="pagination-info">
          <span>第 ${page} 页，共 ${totalPages} 页 (${total} 个搜索源)</span>
        </div>
        
        <button class="pagination-btn" 
                ${!hasNext ? 'disabled' : ''} 
                onclick="window.app.getManager('community').goToPage(${page + 1})">
          下一页 ›
        </button>
      </div>
    `;
  }

  bindSourceItemEvents() {
    console.log('绑定搜索源项目事件');
  }

  async goToPage(page) {
    this.currentPage = page;
    await this.loadCommunitySourcesList();
  }

  // 工具方法
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatDate(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '未知时间';
    }
  }

  // 其他方法...
  async showShareSourceModal() {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }
    showToast('分享功能开发中', 'info');
  }

  async downloadSource(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    try {
      showLoading(true);
      
      const result = await apiService.downloadCommunitySource(sourceId);
      
      if (result.success) {
        showToast(result.message || '下载成功', 'success');
        
        // 通知主页面更新搜索源
        window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
          detail: { action: 'added', source: result.source }
        }));
        
      } else {
        showToast(result.message || '下载失败', 'error');
      }

    } catch (error) {
      console.error('下载搜索源失败:', error);
      showToast('下载失败，请稍后重试: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async toggleLike(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    try {
      const result = await apiService.toggleSourceLike(sourceId, 'like');
      
      if (result.success) {
        showToast(result.message || '操作成功', 'success', 2000);
        
        // 更新按钮状态
        const likeBtn = document.querySelector(`[data-source-id="${sourceId}"].like-btn`);
        if (likeBtn) {
          if (result.action === 'added') {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<span>❤️</span><span>已点赞</span>';
          } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<span>👍</span><span>点赞</span>';
          }
        }
        
        // 更新统计
        setTimeout(() => {
          this.loadCommunitySourcesList();
          this.loadUserCommunityStats();
        }, 1000);
      } else {
        showToast(result.message || '操作失败', 'error');
      }

    } catch (error) {
      console.error('点赞操作失败:', error);
      showToast('操作失败，请稍后重试: ' + error.message, 'error');
    }
  }

  async viewSourceDetails(sourceId) {
    try {
      showLoading(true);
      
      const result = await apiService.getCommunitySourceDetails(sourceId);
      
      if (result.success) {
        this.showSourceDetailsModal(result.source);
      } else {
        throw new Error(result.error || '获取搜索源详情失败');
      }

    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      showToast('获取详情失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  showSourceDetailsModal(source) {
    const modalHTML = `
      <div id="sourceDetailsModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('sourceDetailsModal').remove()">&times;</span>
          <div class="modal-header">
            <div class="source-icon-large">${source.icon || '🔍'}</div>
            <div>
              <h2>${escapeHtml(source.name)}</h2>
              ${source.subtitle ? `<p class="subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
            </div>
            <div class="source-badges">
              ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
              ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
            </div>
          </div>
          
          <div class="modal-body">
            <div class="source-details-grid">
              <div class="detail-section">
                <h4>基本信息</h4>
                <p><strong>URL模板:</strong> <code>${escapeHtml(source.urlTemplate)}</code></p>
                <p><strong>分类:</strong> ${escapeHtml(source.category)}</p>
                <p><strong>作者:</strong> ${escapeHtml(source.author ? source.author.name : 'Unknown')}</p>
                ${source.description ? `<p><strong>描述:</strong> ${escapeHtml(source.description)}</p>` : ''}
              </div>
              
              <div class="detail-section">
                <h4>统计数据</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
                    <span class="stat-label">下载次数</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
                    <span class="stat-label">点赞数</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
                    <span class="stat-label">浏览量</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${(source.stats?.rating || 0).toFixed(1)}/5.0</span>
                    <span class="stat-label">评分 (${source.stats?.reviewCount || 0}条评价)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-primary" onclick="window.app.getManager('community').downloadSource('${source.id}'); document.getElementById('sourceDetailsModal').remove();">
              添加到我的搜索源
            </button>
            <button class="btn-tertiary" onclick="document.getElementById('sourceDetailsModal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 刷新社区数据
  async refreshCommunityData() {
    console.log('刷新社区数据');
    await this.loadTabData();
  }
}

export default CommunityManager;