// 完善的社区管理器 - 修复版本，解决所有问题
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

    // 绑定我的分享按钮事件 - 修复
    const mySharesBtn = document.getElementById('mySharesBtn');
    if (mySharesBtn) {
      mySharesBtn.addEventListener('click', () => this.showMyShares());
    }

    console.log('社区管理器所有事件绑定完成');
  }

  // 加载社区搜索源列表
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

  // 修复：加载用户社区统计
  async loadUserCommunityStats() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录，设置默认统计');
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
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
            reputationScore: 0
          }
        };
      }
      // 立即更新统计显示
      this.updateCommunityStats();
    } catch (error) {
      console.warn('加载用户社区统计失败:', error);
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
          reputationScore: 0
        }
      };
      this.updateCommunityStats();
    }
  }

  // 修复：加载真实热门标签
  async loadPopularTags() {
    try {
      const result = await apiService.getPopularTags();
      
      if (result.success && result.tags) {
        this.popularTags = result.tags;
        this.renderPopularTags();
        console.log('热门标签加载成功:', this.popularTags.length, '个标签');
      } else {
        console.warn('加载热门标签失败:', result.error);
        this.popularTags = [];
        this.renderEmptyTags();
      }
    } catch (error) {
      console.warn('加载热门标签失败:', error);
      this.popularTags = [];
      this.renderEmptyTags();
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
            <span class="stat-icon">👁</span>
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
          <button class="action-btn tertiary" onclick="window.app.getManager('community').showReviewModal('${source.id}')">
            <span>💬</span>
            <span>评价</span>
          </button>
          <button class="action-btn tertiary text-warning" onclick="window.app.getManager('community').showReportModal('${source.id}')">
            <span>🚨</span>
            <span>举报</span>
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

  // 修复：显示我的分享
  async showMyShares() {
    console.log('显示我的分享');
    
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      // 保存当前过滤条件
      const originalFilters = { ...this.currentFilters };
      
      // 设置过滤条件为当前用户的分享
      this.currentFilters = {
        category: 'all',
        sort: 'created_at',
        order: 'desc',
        search: '',
        featured: false,
        author: this.app.getCurrentUser().username // 按作者过滤
      };
      
      this.currentPage = 1;
      
      // 加载我的分享
      await this.loadCommunitySourcesList();
      
      showToast('已切换到我的分享', 'success', 2000);
      
      // 更新搜索框显示
      const searchInput = document.getElementById('communitySearch');
      if (searchInput) {
        searchInput.value = '';
      }
      
    } catch (error) {
      console.error('显示我的分享失败:', error);
      showToast('加载我的分享失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 新增：显示分享源模态框（支持选择现有搜索源）
// 修复版本：显示分享源模态框
showShareSourceModal() {
  if (!this.app.getCurrentUser()) {
    showToast('请先登录', 'error');
    return;
  }

  console.log('显示分享搜索源模态框');

  // 获取分类选项
  const getCategoryOptions = () => {
    if (APP_CONSTANTS.SOURCE_CATEGORIES) {
      return Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(cat => 
        `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
      ).join('');
    }
    return `
      <option value="jav">🎬 JAV资源</option>
      <option value="movie">🎭 影视资源</option>
      <option value="torrent">🧲 种子磁力</option>
      <option value="other">🔍 其他搜索</option>
    `;
  };

  // 获取我的搜索源选项
  const getMySourcesOptions = () => {
    const sourcesManager = this.app.getManager('sources');
    if (!sourcesManager) return '<option value="">搜索源管理器未加载</option>';
    
    const allSources = sourcesManager.getAllSearchSources() || [];
    const enabledSources = sourcesManager.enabledSources || [];
    
    const enabledSourcesData = allSources.filter(source => enabledSources.includes(source.id));
    
    if (enabledSourcesData.length === 0) {
      return '<option value="">您还没有启用的搜索源</option>';
    }
    
    return enabledSourcesData.map(source => `
      <option value="${source.id}" 
              data-name="${escapeHtml(source.name)}"
              data-subtitle="${escapeHtml(source.subtitle || '')}"
              data-icon="${escapeHtml(source.icon || '🔍')}"
              data-url="${escapeHtml(source.urlTemplate)}"
              data-category="${source.category || 'other'}">
        ${source.icon || '🔍'} ${source.name} (${source.category || '其他'})
      </option>
    `).join('');
  };

  const modalHTML = `
    <div id="shareSourceModal" class="modal" style="display: block;">
      <div class="modal-content large">
        <span class="close" onclick="document.getElementById('shareSourceModal').remove()">&times;</span>
        <h2>分享搜索源到社区</h2>
        
        <!-- 分享方式选择 -->
        <div class="share-method-selector" style="margin-bottom: 1.5rem;">
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="shareMethod" value="existing" checked>
              <span>从我的搜索源中选择</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="radio" name="shareMethod" value="manual">
              <span>手动填写新搜索源</span>
            </label>
          </div>
        </div>

        <div id="shareFormError" style="display: none;"></div>
        
        <form id="shareSourceForm">
          <!-- 选择现有搜索源区域 -->
          <div id="existingSourceSection">
            <div class="form-group">
              <label for="existingSource">选择搜索源 <span style="color: red;">*</span>:</label>
              <select id="existingSource" name="existingSource" required>
                <option value="">请选择一个搜索源</option>
                ${getMySourcesOptions()}
              </select>
              <small class="form-help">从您已启用的搜索源中选择一个进行分享</small>
              <div class="field-error" id="existingSourceError"></div>
            </div>
          </div>

          <!-- 手动填写区域 -->
          <div id="manualSourceSection" style="display: none;">
            <div class="form-grid">
              <div class="form-group">
                <label for="shareName">搜索源名称 <span style="color: red;">*</span>:</label>
                <input type="text" id="shareName" name="shareName" data-original-required="true" placeholder="例如：JavDB" maxlength="50">
                <div class="field-error" id="shareNameError"></div>
              </div>
              
              <div class="form-group">
                <label for="shareSubtitle">副标题:</label>
                <input type="text" id="shareSubtitle" name="shareSubtitle" placeholder="简短描述" maxlength="100">
              </div>
              
              <div class="form-group">
                <label for="shareIcon">图标 (emoji):</label>
                <input type="text" id="shareIcon" name="shareIcon" placeholder="🔍" maxlength="4" value="🔍">
              </div>
              
              <div class="form-group">
                <label for="shareCategory">分类 <span style="color: red;">*</span>:</label>
                <select id="shareCategory" name="shareCategory" data-original-required="true">
                  <option value="">请选择分类</option>
                  ${getCategoryOptions()}
                </select>
                <div class="field-error" id="shareCategoryError"></div>
              </div>
            </div>
            
            <div class="form-group">
              <label for="shareUrl">URL模板 <span style="color: red;">*</span>:</label>
              <input type="text" id="shareUrl" name="shareUrl" data-original-required="true" 
                placeholder="https://example.com/search?q={keyword}" 
                pattern=".*\\{keyword\\}.*">
              <small class="form-help">URL必须包含{keyword}占位符，例如：https://example.com/search?q={keyword}</small>
              <div class="field-error" id="shareUrlError"></div>
            </div>
          </div>
          
          <!-- 公共字段 -->
          <div class="form-group">
            <label for="shareDescription">详细描述:</label>
            <textarea id="shareDescription" name="shareDescription" placeholder="介绍这个搜索源的特点和用法..." rows="4" maxlength="500"></textarea>
          </div>
          
          <div class="form-group">
            <label for="shareTags">标签 (用逗号分隔):</label>
            <input type="text" id="shareTags" name="shareTags" placeholder="JAV, 影片, 搜索" maxlength="200">
            <small class="form-help">最多10个标签，每个标签不超过20字符</small>
          </div>
          
          <div class="form-actions">
            <button type="submit" class="btn-primary">
              <span>📤</span>
              <span>分享到社区</span>
            </button>
            <button type="button" class="btn-secondary" onclick="document.getElementById('shareSourceModal').remove()">
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // 移除现有模态框
  const existingModal = document.getElementById('shareSourceModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // 绑定事件
  this.bindShareModalEvents();
}

  // 绑定分享模态框事件
// 修复版本：绑定分享模态框事件
bindShareModalEvents() {
  const form = document.getElementById('shareSourceForm');
  const existingSourceSelect = document.getElementById('existingSource');
  const shareMethodRadios = document.querySelectorAll('input[name="shareMethod"]');
  
  if (!form) return;

  // 分享方式切换 - 修复版本
  shareMethodRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      const existingSection = document.getElementById('existingSourceSection');
      const manualSection = document.getElementById('manualSourceSection');
      
      // 获取手动填写区域的必填字段
      const manualRequiredFields = manualSection.querySelectorAll('input[required], select[required]');
      const existingRequiredFields = existingSection.querySelectorAll('select[required]');
      
      if (radio.value === 'existing') {
        // 显示现有搜索源选择，隐藏手动填写
        existingSection.style.display = 'block';
        manualSection.style.display = 'none';
        
        // 移除手动填写字段的required属性
        manualRequiredFields.forEach(field => {
          field.removeAttribute('required');
          field.classList.remove('error');
        });
        
        // 为现有搜索源选择添加required属性
        existingRequiredFields.forEach(field => {
          field.setAttribute('required', 'required');
        });
        
        // 清除手动填写字段的错误状态
        this.clearAllErrors();
        
      } else {
        // 显示手动填写，隐藏现有搜索源选择
        existingSection.style.display = 'none';
        manualSection.style.display = 'block';
        
        // 为手动填写字段添加required属性
        manualRequiredFields.forEach(field => {
          if (field.dataset.originalRequired !== 'false') {
            field.setAttribute('required', 'required');
          }
        });
        
        // 移除现有搜索源选择的required属性
        existingRequiredFields.forEach(field => {
          field.removeAttribute('required');
        });
        
        // 清除现有搜索源的错误状态
        this.clearAllErrors();
      }
    });
  });

  // 现有搜索源选择事件 - 修复版本
  if (existingSourceSelect) {
    existingSourceSelect.addEventListener('change', (e) => {
      const option = e.target.selectedOptions[0];
      if (option && option.value) {
        // 自动填充描述字段
        const descriptionField = document.getElementById('shareDescription');
        if (descriptionField && !descriptionField.value) {
          descriptionField.value = `来自我的搜索源库: ${option.dataset.name}`;
        }
        
        // 清除选择字段的错误状态
        e.target.classList.remove('error');
        const errorDiv = document.getElementById('existingSourceError');
        if (errorDiv) {
          errorDiv.style.display = 'none';
        }
      }
    });
  }

  // 表单提交事件
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    this.submitShareSourceForm(e);
  });
  
  // 绑定表单验证
  this.bindFormValidation();
}

// 新增：清除所有错误状态的方法
clearAllErrors() {
  // 清除所有错误提示
  document.querySelectorAll('.field-error').forEach(errorDiv => {
    errorDiv.style.display = 'none';
  });
  
  // 清除所有字段的错误样式
  document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
    field.classList.remove('error');
    field.style.borderColor = '';
  });
  
  // 清除表单总错误
  const formError = document.getElementById('shareFormError');
  if (formError) {
    formError.style.display = 'none';
  }
}

  // 绑定表单验证事件
  bindFormValidation() {
    // 验证逻辑保持不变
    const form = document.getElementById('shareSourceForm');
    if (!form) return;

    const clearError = (fieldId) => {
      const errorDiv = document.getElementById(fieldId + 'Error');
      if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
      }
      const field = document.getElementById(fieldId);
      if (field) {
        field.style.borderColor = '';
      }
    };

    const showError = (fieldId, message) => {
      const errorDiv = document.getElementById(fieldId + 'Error');
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.color = 'red';
      }
      const field = document.getElementById(fieldId);
      if (field) {
        field.style.borderColor = 'red';
      }
    };

    // 验证搜索源名称
    const nameField = document.getElementById('shareName');
    if (nameField) {
      nameField.addEventListener('blur', () => {
        const value = nameField.value.trim();
        if (!value) {
          showError('shareName', '搜索源名称不能为空');
        } else if (value.length < 2) {
          showError('shareName', '搜索源名称至少需要2个字符');
        } else {
          clearError('shareName');
        }
      });
    }

    // 验证URL模板
    const urlField = document.getElementById('shareUrl');
    if (urlField) {
      urlField.addEventListener('blur', () => {
        const value = urlField.value.trim();
        if (!value) {
          showError('shareUrl', 'URL模板不能为空');
        } else if (!value.includes('{keyword}')) {
          showError('shareUrl', 'URL模板必须包含{keyword}占位符');
        } else {
          try {
            new URL(value.replace('{keyword}', 'test'));
            clearError('shareUrl');
          } catch (error) {
            showError('shareUrl', 'URL格式不正确');
          }
        }
      });
    }
  }

  // 修复版本：提交分享表单
// 修复版本：提交分享表单
async submitShareSourceForm(event) {
  event.preventDefault();
  
  console.log('开始提交分享表单');
  
  const form = document.getElementById('shareSourceForm');
  if (!form) {
    console.error('表单未找到');
    return;
  }

  // 清除之前的错误信息
  this.clearAllErrors();

  const showFormError = (message) => {
    const errorDiv = document.getElementById('shareFormError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast(message, 'error');
    }
  };

  try {
    const shareMethod = document.querySelector('input[name="shareMethod"]:checked')?.value;
    let sourceData;

    if (shareMethod === 'existing') {
      // 从现有搜索源获取数据
      const existingSourceSelect = document.getElementById('existingSource');
      if (!existingSourceSelect || !existingSourceSelect.value) {
        // 显示选择错误
        if (existingSourceSelect) {
          existingSourceSelect.classList.add('error');
        }
        const errorDiv = document.getElementById('existingSourceError') || 
          this.createErrorDiv('existingSource', '请选择一个搜索源');
        errorDiv.textContent = '请选择一个搜索源';
        errorDiv.style.display = 'block';
        return;
      }

      const selectedOption = existingSourceSelect.selectedOptions[0];
      
      // 验证选中的搜索源数据是否完整
      if (!selectedOption.dataset.name || !selectedOption.dataset.url) {
        showFormError('所选搜索源数据不完整，请选择其他搜索源');
        return;
      }

      sourceData = {
        name: selectedOption.dataset.name,
        subtitle: selectedOption.dataset.subtitle || '',
        icon: selectedOption.dataset.icon || '🔍',
        urlTemplate: selectedOption.dataset.url,
        category: selectedOption.dataset.category || 'other',
        description: document.getElementById('shareDescription')?.value.trim() || 
          `来自我的搜索源库: ${selectedOption.dataset.name}`,
        tags: this.parseTags(document.getElementById('shareTags')?.value || '')
      };

    } else {
      // 手动填写的数据
      const name = document.getElementById('shareName')?.value.trim();
      const subtitle = document.getElementById('shareSubtitle')?.value.trim();
      const icon = document.getElementById('shareIcon')?.value.trim() || '🔍';
      const category = document.getElementById('shareCategory')?.value.trim();
      const urlTemplate = document.getElementById('shareUrl')?.value.trim();
      const description = document.getElementById('shareDescription')?.value.trim() || '';
      const tagsString = document.getElementById('shareTags')?.value || '';

      // 验证必填字段
      const errors = [];
      const fieldErrors = {};
      
      if (!name || name.length < 2) {
        errors.push('搜索源名称必须至少2个字符');
        fieldErrors.shareName = '搜索源名称必须至少2个字符';
      }
      
      if (!urlTemplate) {
        errors.push('URL模板不能为空');
        fieldErrors.shareUrl = 'URL模板不能为空';
      } else if (!urlTemplate.includes('{keyword}')) {
        errors.push('URL模板必须包含{keyword}占位符');
        fieldErrors.shareUrl = 'URL模板必须包含{keyword}占位符';
      } else {
        // 验证URL格式
        try {
          new URL(urlTemplate.replace('{keyword}', 'test'));
        } catch (error) {
          errors.push('URL格式不正确');
          fieldErrors.shareUrl = 'URL格式不正确';
        }
      }
      
      if (!category) {
        errors.push('请选择一个分类');
        fieldErrors.shareCategory = '请选择一个分类';
      }

      // 显示字段级错误
      Object.entries(fieldErrors).forEach(([fieldId, message]) => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.classList.add('error');
        }
        
        const errorDiv = document.getElementById(fieldId + 'Error') ||
          this.createErrorDiv(fieldId, message);
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
      });

      if (errors.length > 0) {
        showFormError('请修复以下问题：\n' + errors.join('\n'));
        return;
      }

      sourceData = {
        name,
        subtitle: subtitle || '',
        icon,
        urlTemplate,
        category,
        description,
        tags: this.parseTags(tagsString)
      };
    }
    
    console.log('准备提交的数据:', sourceData);

    showLoading(true);
    
    const result = await apiService.shareSourceToCommunity(sourceData);
    
    if (result.success) {
      showToast(result.message || '分享成功！', 'success');
      document.getElementById('shareSourceModal').remove();
      
      // 刷新社区列表和统计
      await Promise.all([
        this.loadCommunitySourcesList(),
        this.loadUserCommunityStats()
      ]);
      
    } else {
      showFormError(result.message || '分享失败，请重试');
    }

  } catch (error) {
    console.error('分享搜索源失败:', error);
    showFormError('分享失败：' + error.message);
  } finally {
    showLoading(false);
  }
}

// 新增：创建错误提示元素的方法
createErrorDiv(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return null;
  
  const errorDiv = document.createElement('div');
  errorDiv.id = fieldId + 'Error';
  errorDiv.className = 'field-error';
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  // 插入到字段后面
  field.parentNode.insertBefore(errorDiv, field.nextSibling);
  
  return errorDiv;
}
  // 解析标签字符串
  parseTags(tagsString) {
    if (!tagsString) return [];
    return tagsString.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag && tag.length > 0)
      .slice(0, 10);
  }

  // 修复：正确更新社区统计显示
// 修复 community-manager.js 中的 updateCommunityStats 方法
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
  
  // 修复：这里应该显示用户分享的搜索源被下载的总次数
  if (elements.userDownloadsCount) {
    elements.userDownloadsCount.textContent = stats.totalDownloads || 0; // 改为 totalDownloads
  }
  
  // 修复：这里应该显示用户分享的搜索源获得的总点赞数
  if (elements.userLikesCount) {
    elements.userLikesCount.textContent = stats.totalLikes || 0;
  }
  
  if (elements.userReputationScore) {
    elements.userReputationScore.textContent = stats.reputationScore || 0;
  }

  console.log('统计数据已更新:', stats);
  
  // 添加调试信息
  console.log('统计字段映射:', {
    分享数量: stats.sharedSources,
    总下载数: stats.totalDownloads,
    总点赞数: stats.totalLikes,
    声誉分数: stats.reputationScore,
    用户下载数: stats.sourcesDownloaded // 这个字段用于其他地方
  });
}

  // 下载搜索源
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
        
        // 更新下载计数
        setTimeout(() => {
          this.loadCommunitySourcesList();
          this.loadUserCommunityStats();
        }, 1000);
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

  // 切换点赞状态
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
        
        // 更新点赞计数和用户统计
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

  // 查看搜索源详情
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

  // 显示搜索源详情模态框
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
              
              ${source.reviews && source.reviews.length > 0 ? `
                <div class="detail-section">
                  <h4>最新评价</h4>
                  <div class="reviews-list">
                    ${source.reviews.slice(0, 5).map(review => `
                      <div class="review-item">
                        <div class="review-header">
                          <span class="reviewer">${escapeHtml(review.reviewerName)}</span>
                          <span class="review-rating">${this.renderRatingStars(review.rating)}</span>
                          <span class="review-date">${this.formatDate(review.createdAt)}</span>
                        </div>
                        ${review.comment ? `<p class="review-comment">${escapeHtml(review.comment)}</p>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-primary" onclick="window.app.getManager('community').downloadSource('${source.id}'); document.getElementById('sourceDetailsModal').remove();">
              添加到我的搜索源
            </button>
            <button class="btn-secondary" onclick="window.app.getManager('community').showReviewModal('${source.id}')">
              评价这个搜索源
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

  // 显示评价模态框
  showReviewModal(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    const modalHTML = `
      <div id="reviewModal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="document.getElementById('reviewModal').remove()">&times;</span>
          <h2>评价搜索源</h2>
          <form id="reviewForm" onsubmit="window.app.getManager('community').submitReview(event, '${sourceId}')">
            <div class="form-group">
              <label for="reviewRating">评分 (1-5星):</label>
              <div class="rating-input">
                <input type="range" id="reviewRating" min="1" max="5" value="5" oninput="document.getElementById('ratingDisplay').textContent = this.value + '星'">
                <span id="ratingDisplay">5星</span>
              </div>
            </div>
            <div class="form-group">
              <label for="reviewComment">评价内容 (可选):</label>
              <textarea id="reviewComment" placeholder="分享您的使用体验..." rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="reviewAnonymous">
                匿名评价
              </label>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-primary">提交评价</button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('reviewModal').remove()">取消</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 提交评价
  async submitReview(event, sourceId) {
    event.preventDefault();
    
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();
    const isAnonymous = document.getElementById('reviewAnonymous').checked;
    
    try {
      showLoading(true);
      
      const result = await apiService.reviewCommunitySource(sourceId, {
        rating,
        comment,
        isAnonymous
      });
      
      if (result.success) {
        showToast(result.message || '评价提交成功', 'success');
        document.getElementById('reviewModal').remove();
        
        // 刷新列表
        setTimeout(() => this.loadCommunitySourcesList(), 1000);
      } else {
        showToast(result.message || '评价提交失败', 'error');
      }
      
    } catch (error) {
      console.error('提交评价失败:', error);
      showToast('提交失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 显示举报模态框
  showReportModal(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    const modalHTML = `
      <div id="reportModal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="document.getElementById('reportModal').remove()">&times;</span>
          <h2>举报搜索源</h2>
          <form id="reportForm" onsubmit="window.app.getManager('community').submitReport(event, '${sourceId}')">
            <div class="form-group">
              <label for="reportReason">举报原因:</label>
              <select id="reportReason" required>
                <option value="">请选择举报原因</option>
                <option value="spam">垃圾信息</option>
                <option value="inappropriate">内容不当</option>
                <option value="copyright">版权侵犯</option>
                <option value="malicious">恶意链接</option>
                <option value="misleading">信息误导</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reportDetails">详细说明:</label>
              <textarea id="reportDetails" placeholder="请详细说明举报原因..." rows="4" required></textarea>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-danger">提交举报</button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('reportModal').remove()">取消</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 提交举报
  async submitReport(event, sourceId) {
    event.preventDefault();
    
    const reason = document.getElementById('reportReason').value;
    const details = document.getElementById('reportDetails').value.trim();
    
    if (!reason || !details) {
      showToast('请填写完整的举报信息', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      const result = await apiService.reportCommunitySource(sourceId, {
        reason,
        details
      });
      
      if (result.success) {
        showToast(result.message || '举报已提交，我们会尽快处理', 'success');
        document.getElementById('reportModal').remove();
      } else {
        showToast(result.message || '举报提交失败', 'error');
      }
      
    } catch (error) {
      console.error('提交举报失败:', error);
      showToast('提交失败: ' + error.message, 'error');
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

  // 刷新社区数据
  async refreshCommunityData() {
    console.log('刷新社区数据');
    await this.loadTabData();
  }

  // 搜索社区内容
  async searchCommunity(query) {
    console.log('搜索社区内容:', query);
    
    try {
      const result = await apiService.searchCommunityPosts(query, {
        category: this.currentFilters.category,
        limit: this.currentLimit
      });
      
      if (result.success) {
        this.currentSources = result.sources;
        this.renderCommunitySourcesList(result.sources, { page: 1, totalPages: 1 });
        return result.sources;
      } else {
        throw new Error(result.error || '搜索失败');
      }
      
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      showToast('搜索失败: ' + error.message, 'error');
      return [];
    }
  }

  // 公共方法供其他管理器调用
  getTotalCommunityStats() {
    return this.communityStats;
  }
}

export default CommunityManager;