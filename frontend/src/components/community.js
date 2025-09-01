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
  }

  async init() {
    console.log('初始化社区管理器');
    this.bindEvents();
  }

  async loadData() {
    // 由于社区数据较多，在加载标签页时再获取
  }

  async loadTabData() {
    try {
      showLoading(true);
      
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

  bindEvents() {
    // 绑定搜索和过滤事件
    const searchInput = document.getElementById('communitySearch');
    const categoryFilter = document.getElementById('communityCategory');
    const sortSelect = document.getElementById('communitySort');
    const featuredToggle = document.getElementById('featuredOnly');

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

    // 绑定我的分享按钮事件
    const mySharesBtn = document.getElementById('mySharesBtn');
    if (mySharesBtn) {
      mySharesBtn.addEventListener('click', () => this.showMyShares());
    }
  }

  async loadCommunitySourcesList() {
    try {
      const params = new URLSearchParams({
        page: this.currentPage.toString(),
        limit: this.currentLimit.toString(),
        ...this.currentFilters
      });

      const response = await fetch(`/api/community/sources?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('获取社区搜索源失败');
      }

      const data = await response.json();
      this.renderCommunitySourcesList(data.sources, data.pagination);

    } catch (error) {
      console.error('加载社区搜索源列表失败:', error);
      showToast('加载搜索源列表失败', 'error');
    }
  }

  async loadUserCommunityStats() {
    if (!this.app.getCurrentUser()) return;

    try {
      const response = await fetch('/api/community/user/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.userStats = data.stats;
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
        this.popularTags = data.tags;
        this.renderPopularTags();
      }
    } catch (error) {
      console.warn('加载热门标签失败:', error);
    }
  }

  renderCommunityControls() {
    // 更新分类过滤器选项
    const categoryFilter = document.getElementById('communityCategory');
    if (categoryFilter) {
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
    if (!container) return;

    if (!sources || sources.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🏛️</span>
          <p>暂无搜索源分享</p>
          <p>成为第一个分享搜索源的人吧！</p>
          <button class="btn-primary" onclick="app.getManager('community').showShareSourceModal()">
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
    const category = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES)
      .find(cat => cat.id === source.category);
    
    const ratingStars = this.renderRatingStars(source.stats.rating);
    const tags = source.tags ? source.tags.slice(0, 3) : [];
    
    return `
      <div class="community-source-item" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-icon">${source.icon}</div>
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
            由 <strong>${escapeHtml(source.author.name)}</strong> 分享
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
              <span class="tag ${tag.isOfficial ? 'official' : ''}" style="color: ${tag.color}">
                ${escapeHtml(tag.name)}
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="source-stats">
          <div class="stat-item">
            <span class="stat-icon">📥</span>
            <span class="stat-value">${this.formatNumber(source.stats.downloads)}</span>
            <span class="stat-label">下载</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👍</span>
            <span class="stat-value">${this.formatNumber(source.stats.likes)}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <div class="rating-display">
              ${ratingStars}
              <span class="rating-count">(${source.stats.reviewCount})</span>
            </div>
          </div>
        </div>

        <div class="source-actions">
          <button class="action-btn primary" onclick="app.getManager('community').downloadSource('${source.id}')">
            <span>📥</span>
            <span>添加到我的搜索源</span>
          </button>
          <button class="action-btn secondary" onclick="app.getManager('community').viewSourceDetails('${source.id}')">
            <span>👁️</span>
            <span>查看详情</span>
          </button>
          <button class="action-btn tertiary like-btn" data-source-id="${source.id}" onclick="app.getManager('community').toggleLike('${source.id}')">
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
    if (pagination.totalPages <= 1) return '';

    const { page, totalPages, hasPrev, hasNext } = pagination;
    
    return `
      <div class="pagination">
        <button class="pagination-btn" 
                ${!hasPrev ? 'disabled' : ''} 
                onclick="app.getManager('community').goToPage(${page - 1})">
          ‹ 上一页
        </button>
        
        <div class="pagination-info">
          <span>第 ${page} 页，共 ${totalPages} 页</span>
        </div>
        
        <button class="pagination-btn" 
                ${!hasNext ? 'disabled' : ''} 
                onclick="app.getManager('community').goToPage(${page + 1})">
          下一页 ›
        </button>
      </div>
    `;
  }

  renderPopularTags() {
    const container = document.getElementById('popularTagsList');
    if (!container || !this.popularTags) return;

    const tagsHTML = this.popularTags.slice(0, 20).map(tag => `
      <span class="tag-item ${tag.isOfficial ? 'official' : ''}" 
            style="color: ${tag.color}" 
            onclick="app.getManager('community').searchByTag('${tag.name}')">
        ${escapeHtml(tag.name)} (${tag.usageCount})
      </span>
    `).join('');

    container.innerHTML = `
      <div class="tags-cloud">
        ${tagsHTML}
      </div>
    `;
  }

  bindSourceItemEvents() {
    // 这里可以绑定额外的事件，大部分事件通过onclick处理
  }

  async goToPage(page) {
    this.currentPage = page;
    await this.loadCommunitySourcesList();
  }

  async searchByTag(tagName) {
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
        showToast(data.message, 'success');
        
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
        showToast(data.message, 'success', 2000);
        
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
    try {
      showLoading(true);
      
      const response = await fetch(`/api/community/sources/${sourceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('获取搜索源详情失败');
      }

      const data = await response.json();
      this.showSourceDetailsModal(data.source);

    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      showToast('获取详情失败', 'error');
    } finally {
      showLoading(false);
    }
  }

  showSourceDetailsModal(source) {
    const modal = this.createSourceDetailsModal(source);
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.remove();
      };
    }

    // 点击背景关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  createSourceDetailsModal(source) {
    const modal = document.createElement('div');
    modal.className = 'modal source-details-modal';
    
    const category = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES)
      .find(cat => cat.id === source.category);
    
    const reviewsHTML = source.reviews.map(review => `
      <div class="review-item">
        <div class="review-header">
          <div class="reviewer-name">${escapeHtml(review.reviewerName)}</div>
          <div class="review-rating">${this.renderRatingStars(review.rating)}</div>
          <div class="review-date">${this.formatDate(review.createdAt)}</div>
        </div>
        ${review.comment ? `<div class="review-comment">${escapeHtml(review.comment)}</div>` : ''}
      </div>
    `).join('');

    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        
        <div class="source-details-header">
          <div class="source-icon-large">${source.icon}</div>
          <div class="source-title-area">
            <h2>${escapeHtml(source.name)}</h2>
            ${source.subtitle ? `<p class="subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
            <div class="source-badges">
              ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
              ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
            </div>
          </div>
        </div>

        <div class="source-details-body">
          <div class="detail-section">
            <h3>基本信息</h3>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">分类：</span>
                <span class="info-value">${category?.icon || '🌟'} ${category?.name || '其他'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">作者：</span>
                <span class="info-value">${escapeHtml(source.author.name)} (声誉: ${source.author.reputation})</span>
              </div>
              <div class="info-item">
                <span class="info-label">URL模板：</span>
                <span class="info-value url-template">${escapeHtml(source.urlTemplate)}</span>
              </div>
            </div>
          </div>

          ${source.description ? `
            <div class="detail-section">
              <h3>描述</h3>
              <p class="description">${escapeHtml(source.description)}</p>
            </div>
          ` : ''}

          <div class="detail-section">
            <h3>统计信息</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">${this.formatNumber(source.stats.downloads)}</div>
                <div class="stat-label">下载次数</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${this.formatNumber(source.stats.likes)}</div>
                <div class="stat-label">点赞数</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${source.stats.rating.toFixed(1)}</div>
                <div class="stat-label">评分 (${source.stats.reviewCount}人评价)</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${this.formatNumber(source.stats.views)}</div>
                <div class="stat-label">浏览量</div>
              </div>
            </div>
          </div>

          ${source.reviews.length > 0 ? `
            <div class="detail-section">
              <h3>用户评价</h3>
              <div class="reviews-list">
                ${reviewsHTML}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="modal-actions">
          <button class="btn-primary" onclick="app.getManager('community').downloadSource('${source.id}')">
            📥 添加到我的搜索源
          </button>
          <button class="btn-secondary" onclick="app.getManager('community').showReviewModal('${source.id}')">
            ⭐ 评价
          </button>
          <button class="btn-tertiary" onclick="app.getManager('community').toggleLike('${source.id}')">
            👍 点赞
          </button>
        </div>
      </div>
    `;

    return modal;
  }

  showShareSourceModal() {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    const modal = this.createShareSourceModal();
    document.body.appendChild(modal);
    modal.style.display = 'block';

    // 绑定表单提交事件
    const form = modal.querySelector('#shareSourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleShareSourceSubmit(e, modal));
    }

    // 绑定关闭事件
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.onclick = () => modal.remove();
    }
  }

  createShareSourceModal() {
    const modal = document.createElement('div');
    modal.className = 'modal share-source-modal';
    
    const categories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES);
    const categoriesHTML = categories.map(cat => `
      <option value="${cat.id}">${cat.icon} ${cat.name}</option>
    `).join('');

    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>分享搜索源到社区</h2>
        
        <form id="shareSourceForm">
          <div class="form-group">
            <label for="sourceName">搜索源名称 *</label>
            <input type="text" id="sourceName" required maxlength="50" 
                   placeholder="例如：我的专用搜索站">
          </div>

          <div class="form-group">
            <label for="sourceSubtitle">简短描述</label>
            <input type="text" id="sourceSubtitle" maxlength="100" 
                   placeholder="一句话介绍这个搜索源">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="sourceIcon">图标</label>
              <input type="text" id="sourceIcon" maxlength="5" 
                     placeholder="🔍" value="🔍">
            </div>
            
            <div class="form-group">
              <label for="sourceCategory">分类 *</label>
              <select id="sourceCategory" required>
                ${categoriesHTML}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="sourceUrl">搜索URL模板 *</label>
            <input type="url" id="sourceUrl" required 
                   placeholder="https://example.com/search?q={keyword}">
            <small class="form-help">
              URL中必须包含 <code>{keyword}</code> 占位符
            </small>
          </div>

          <div class="form-group">
            <label for="sourceDescription">详细描述</label>
            <textarea id="sourceDescription" rows="4" maxlength="500"
                      placeholder="介绍这个搜索源的特点、优势等..."></textarea>
          </div>

          <div class="form-group">
            <label for="sourceTags">标签 (可选)</label>
            <input type="text" id="sourceTags" 
                   placeholder="用逗号分隔，例如：高质量,更新及时,免费">
            <small class="form-help">最多10个标签，帮助其他用户发现您的分享</small>
          </div>

          <div class="form-actions">
            <button type="button" onclick="this.closest('.modal').remove()">取消</button>
            <button type="submit" class="btn-primary">分享到社区</button>
          </div>
        </form>
      </div>
    `;

    return modal;
  }

  async handleShareSourceSubmit(event, modal) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
      name: formData.get('sourceName')?.trim(),
      subtitle: formData.get('sourceSubtitle')?.trim(),
      icon: formData.get('sourceIcon')?.trim() || '🔍',
      urlTemplate: formData.get('sourceUrl')?.trim(),
      category: formData.get('sourceCategory'),
      description: formData.get('sourceDescription')?.trim(),
      tags: formData.get('sourceTags')?.trim().split(',').map(t => t.trim()).filter(t => t)
    };

    // 基本验证
    if (!data.name || !data.urlTemplate || !data.category) {
      showToast('请填写所有必填字段', 'error');
      return;
    }

    if (!data.urlTemplate.includes('{keyword}')) {
      showToast('URL模板必须包含{keyword}占位符', 'error');
      return;
    }

    try {
      showLoading(true);
      
      const response = await fetch('/api/community/sources', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (response.ok) {
        showToast(result.message, 'success');
        modal.remove();
        
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
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  updateCommunityStats() {
    if (!this.userStats) return;

    const elements = {
      userSharedCount: document.getElementById('userSharedCount'),
      userDownloadsCount: document.getElementById('userDownloadsCount'),
      userLikesCount: document.getElementById('userLikesCount'),
      userReputationScore: document.getElementById('userReputationScore')
    };

    const stats = this.userStats.general;
    
    if (elements.userSharedCount) elements.userSharedCount.textContent = stats.sharedSources;
    if (elements.userDownloadsCount) elements.userDownloadsCount.textContent = stats.sourcesDownloaded;
    if (elements.userLikesCount) elements.userLikesCount.textContent = stats.totalLikes;
    if (elements.userReputationScore) elements.userReputationScore.textContent = stats.reputationScore;
  }

  // 显示我的分享
  async showMyShares() {
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