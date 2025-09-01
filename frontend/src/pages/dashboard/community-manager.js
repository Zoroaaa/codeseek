// 社区管理器 - 处理搜索源共享社区功能
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
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

  async loadData() {
    // 由于社区数据较多，在加载标签页时再获取
    console.log('社区管理器 loadData 被调用');
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
      showToast('加载社区数据失败', 'error');
    } finally {
      showLoading(false);
    }
  }

  async bindEvents() {
    // 等待DOM就绪
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
      console.log('搜索输入事件已绑定');
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
      console.log('搜索按钮事件已绑定');
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
      console.log('分类过滤器事件已绑定');
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [sort, order] = e.target.value.split('-');
        this.currentFilters.sort = sort;
        this.currentFilters.order = order;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
      console.log('排序选择器事件已绑定');
    }

    if (featuredToggle) {
      featuredToggle.addEventListener('change', (e) => {
        this.currentFilters.featured = e.target.checked;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
      console.log('推荐过滤器事件已绑定');
    }

    // 绑定分享按钮事件
    const shareSourceBtn = document.getElementById('shareSourceBtn');
    if (shareSourceBtn) {
      shareSourceBtn.addEventListener('click', () => this.showShareSourceModal());
      console.log('分享按钮事件已绑定');
    }

    // 绑定我的分享按钮事件
    const mySharesBtn = document.getElementById('mySharesBtn');
    if (mySharesBtn) {
      mySharesBtn.addEventListener('click', () => this.showMyShares());
      console.log('我的分享按钮事件已绑定');
    }

    console.log('社区管理器所有事件绑定完成');
  }

  async loadCommunitySourcesList() {
    try {
      console.log('开始加载社区搜索源列表');
      
      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        limit: this.currentLimit.toString(),
        ...this.currentFilters
      });

      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/community/sources?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 获取社区搜索源失败`);
      }

      const data = await response.json();
      console.log('社区数据加载成功:', data);
      
      this.renderCommunitySourcesList(data.sources || [], data.pagination || {});

    } catch (error) {
      console.error('加载社区搜索源列表失败:', error);
      showToast('加载搜索源列表失败: ' + error.message, 'error');
      
      // 显示错误状态
      const container = document.getElementById('communitySourcesList');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">❌</span>
            <p>加载搜索源失败</p>
            <p>错误信息: ${error.message}</p>
            <button class="btn-primary" onclick="window.app.getManager('community').loadCommunitySourcesList()">
              重新加载
            </button>
          </div>
        `;
      }
    }
  }

  async loadUserCommunityStats() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录，跳过加载社区统计');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/community/user/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.userStats = data.stats;
        console.log('用户社区统计加载成功:', this.userStats);
      } else {
        console.warn('加载用户社区统计失败:', response.status);
      }
    } catch (error) {
      console.warn('加载用户社区统计失败:', error);
    }
  }

  async loadPopularTags() {
    try {
      const response = await fetch('/api/community/tags');
      if (response.ok) {
        const data = await response.json();
        this.popularTags = data.tags || [];
        this.renderPopularTags();
        console.log('热门标签加载成功:', this.popularTags.length, '个标签');
      } else {
        console.warn('加载热门标签失败:', response.status);
      }
    } catch (error) {
      console.warn('加载热门标签失败:', error);
    }
  }

  renderCommunityControls() {
    // 更新分类过滤器选项
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
      console.log('分类过滤器已更新');
    }
  }

  renderCommunitySourcesList(sources, pagination) {
    const container = document.getElementById('communitySourcesList');
    if (!container) {
      console.error('找不到社区搜索源容器');
      return;
    }

    console.log('渲染社区搜索源列表:', sources.length, '个源');

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

    // 绑定源项目事件
    this.bindSourceItemEvents();
  }

  renderCommunitySourceItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
      Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    const ratingStars = this.renderRatingStars(source.stats.rating || 0);
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
              <span class="tag ${tag.isOfficial ? 'official' : ''}" style="color: ${tag.color || '#666'}">
                ${escapeHtml(tag.name)}
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="source-stats">
          <div class="stat-item">
            <span class="stat-icon">🔥</span>
            <span class="stat-value">${this.formatNumber(source.stats.downloads || 0)}</span>
            <span class="stat-label">下载</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👍</span>
            <span class="stat-value">${this.formatNumber(source.stats.likes || 0)}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <div class="rating-display">
              ${ratingStars}
              <span class="rating-count">(${source.stats.reviewCount || 0})</span>
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

    const { page = 1, totalPages = 1, hasPrev = false, hasNext = false } = pagination;
    
    return `
      <div class="pagination">
        <button class="pagination-btn" 
                ${!hasPrev ? 'disabled' : ''} 
                onclick="window.app.getManager('community').goToPage(${page - 1})">
          ‹ 上一页
        </button>
        
        <div class="pagination-info">
          <span>第 ${page} 页，共 ${totalPages} 页</span>
        </div>
        
        <button class="pagination-btn" 
                ${!hasNext ? 'disabled' : ''} 
                onclick="window.app.getManager('community').goToPage(${page + 1})">
          下一页 ›
        </button>
      </div>
    `;
  }

  renderPopularTags() {
    const container = document.getElementById('popularTagsList');
    if (!container || !this.popularTags || this.popularTags.length === 0) {
      console.log('跳过渲染热门标签 - 容器不存在或没有标签数据');
      return;
    }

    const tagsHTML = this.popularTags.slice(0, 20).map(tag => `
      <span class="tag-item ${tag.isOfficial ? 'official' : ''}" 
            style="color: ${tag.color || '#666'}" 
            onclick="window.app.getManager('community').searchByTag('${escapeHtml(tag.name)}')">
        ${escapeHtml(tag.name)} (${tag.usageCount || 0})
      </span>
    `).join('');

    container.innerHTML = `
      <div class="tags-cloud">
        ${tagsHTML}
      </div>
    `;
    
    console.log('热门标签渲染完成:', this.popularTags.length, '个标签');
  }

  bindSourceItemEvents() {
    // 这里可以绑定额外的事件，大部分事件通过onclick处理
    console.log('绑定搜索源项目事件');
  }

  async goToPage(page) {
    console.log('跳转到页面:', page);
    this.currentPage = page;
    await this.loadCommunitySourcesList();
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

  async downloadSource(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('下载搜索源:', sourceId);

    try {
      showLoading(true);
      
      const response = await fetch(`/api/community/sources/${sourceId}/download`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || '下载成功', 'success');
        
        // 通知主页面更新搜索源
        window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
          detail: { action: 'added', source: data.source }
        }));
        
        // 更新下载计数（可选：重新加载当前页面）
        setTimeout(() => this.loadCommunitySourcesList(), 1000);
      } else {
        showToast(data.message || '下载失败', 'error');
      }

    } catch (error) {
      console.error('下载搜索源失败:', error);
      showToast('下载失败，请稍后重试', 'error');
    } finally {
      showLoading(false);
    }
  }

  async toggleLike(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('切换点赞状态:', sourceId);

    try {
      const response = await fetch(`/api/community/sources/${sourceId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: 'like' })
      });

      const data = await response.json();

      if (response.ok) {
        showToast(data.message || '操作成功', 'success', 2000);
        
        // 更新按钮状态
        const likeBtn = document.querySelector(`[data-source-id="${sourceId}"].like-btn`);
        if (likeBtn) {
          if (data.action === 'added') {
            likeBtn.classList.add('liked');
          } else {
            likeBtn.classList.remove('liked');
          }
        }
        
        // 可选：更新点赞计数
        setTimeout(() => this.loadCommunitySourcesList(), 1000);
      } else {
        showToast(data.message || '操作失败', 'error');
      }

    } catch (error) {
      console.error('点赞操作失败:', error);
      showToast('操作失败，请稍后重试', 'error');
    }
  }

  async viewSourceDetails(sourceId) {
    console.log('查看搜索源详情:', sourceId);
    
    try {
      showLoading(true);
      
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/community/sources/${sourceId}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 获取搜索源详情失败`);
      }

      const data = await response.json();
      this.showSourceDetailsModal(data.source);

    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      showToast('获取详情失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  showSourceDetailsModal(source) {
    // 简化版详情显示 - 实际项目中应该创建完整的模态框
    const details = `
搜索源详情：
• 名称：${source.name}
• 描述：${source.description || '无'}
• URL模板：${source.urlTemplate}
• 分类：${source.category}
• 作者：${source.author ? source.author.name : 'Unknown'}
• 下载次数：${source.stats.downloads || 0}
• 点赞数：${source.stats.likes || 0}
• 评分：${source.stats.rating || 0}/5.0
    `;
    
    alert(details);
    console.log('显示搜索源详情:', source);
  }

  showShareSourceModal() {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('显示分享搜索源模态框');

    // 简化版分享表单 - 实际项目中应该创建完整的模态框
    const name = prompt('请输入搜索源名称：');
    if (!name) return;
    
    const urlTemplate = prompt('请输入URL模板（必须包含{keyword}）：');
    if (!urlTemplate || !urlTemplate.includes('{keyword}')) {
      showToast('URL模板必须包含{keyword}占位符', 'error');
      return;
    }
    
    const description = prompt('请输入描述（可选）：') || '';
    
    this.submitShareSource({
      name: name.trim(),
      urlTemplate: urlTemplate.trim(),
      category: 'other',
      description: description.trim(),
      tags: []
    });
  }

  async submitShareSource(sourceData) {
    console.log('提交分享搜索源:', sourceData);
    
    try {
      showLoading(true);
      
      const response = await fetch('/api/community/sources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sourceData)
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message || '分享成功', 'success');
        
        // 刷新社区列表
        await this.loadCommunitySourcesList();
        
        // 刷新用户统计
        await this.loadUserCommunityStats();
      } else {
        showToast(result.message || '分享失败', 'error');
      }

    } catch (error) {
      console.error('分享搜索源失败:', error);
      showToast('分享失败，请稍后重试', 'error');
    } finally {
      showLoading(false);
    }
  }

  // 辅助方法
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

  updateCommunityStats() {
    if (!this.userStats) {
      console.log('没有用户统计数据，跳过更新');
      return;
    }

    console.log('更新社区统计显示');

    const elements = {
      userSharedCount: document.getElementById('userSharedCount'),
      userDownloadsCount: document.getElementById('userDownloadsCount'),
      userLikesCount: document.getElementById('userLikesCount'),
      userReputationScore: document.getElementById('userReputationScore')
    };

    const stats = this.userStats.general || {};
    
    if (elements.userSharedCount) elements.userSharedCount.textContent = stats.sharedSources || 0;
    if (elements.userDownloadsCount) elements.userDownloadsCount.textContent = stats.sourcesDownloaded || 0;
    if (elements.userLikesCount) elements.userLikesCount.textContent = stats.totalLikes || 0;
    if (elements.userReputationScore) elements.userReputationScore.textContent = stats.reputationScore || 0;
  }

  // 显示我的分享
  async showMyShares() {
    console.log('显示我的分享');
    // 这里可以实现显示用户自己分享的搜索源
    this.currentFilters = {
      ...this.currentFilters,
      userId: this.app.getCurrentUser()?.id
    };
    await this.loadCommunitySourcesList();
  }

  // 公共方法供其他管理器调用
  getTotalCommunityStats() {
    return this.communityStats;
  }
}

export default CommunityManager;