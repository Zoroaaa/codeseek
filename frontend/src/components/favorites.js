// 收藏管理组件 - 重构版本：使用新服务架构
import { getService } from '../services/services-bootstrap.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';

export class FavoritesManager {
  constructor() {
    this.favorites = [];
    this.isInitialized = false;
    
    // 服务实例将在init时获取
    this.userFavoritesService = null;
    this.authService = null;
    this.notificationService = null;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 获取服务实例
      this.userFavoritesService = getService('userFavoritesService');
      this.authService = getService('authService');
      this.notificationService = getService('notificationService');

      await this.loadFavorites();
      this.bindEvents();
      this.exposeGlobalMethods();
      this.isInitialized = true;
    } catch (error) {
      console.error('收藏管理器初始化失败:', error);
      this.notificationService?.showToast('收藏管理器初始化失败', 'error');
    }
  }

  // 绑定事件
  bindEvents() {
    // 收藏搜索
    const favoritesSearch = document.getElementById('favoritesSearch');
    if (favoritesSearch) {
      favoritesSearch.addEventListener('input', (e) => {
        this.searchFavorites(e.target.value);
      });
    }

    // 收藏排序
    const favoritesSort = document.getElementById('favoritesSort');
    if (favoritesSort) {
      favoritesSort.addEventListener('change', (e) => {
        this.sortFavorites(e.target.value);
      });
    }

    // 同步收藏按钮
    const syncBtn = document.getElementById('syncFavoritesBtn');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => {
        this.syncFavorites();
      });
    }

    // 导入收藏按钮
    const importBtn = document.getElementById('importFavoritesBtn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        this.importFavorites();
      });
    }
  }

  // 加载收藏
  async loadFavorites() {
    if (!this.authService.isAuthenticated()) {
      this.favorites = [];
      this.renderFavorites();
      return;
    }

    try {
      const result = await this.userFavoritesService.getFavorites();
      
      // 🔧 添加数据类型检查和验证
      if (Array.isArray(result)) {
        this.favorites = result;
      } else if (result && Array.isArray(result.favorites)) {
        this.favorites = result.favorites;
      } else if (result && result.success && Array.isArray(result.data)) {
        this.favorites = result.data;
      } else {
        console.warn('收藏数据格式异常:', result);
        this.favorites = [];
      }
      
      this.renderFavorites();
    } catch (error) {
      console.error('加载收藏失败:', error);
      this.favorites = [];
      this.renderFavorites();
      this.notificationService?.showToast('加载收藏失败: ' + error.message, 'error');
    }
  }

  // 渲染收藏 (添加事件委托和数据类型检查)
  renderFavorites(favoritesToRender = null) {
    const container = document.getElementById('favorites');
    if (!container) return;

    const renderList = favoritesToRender || this.favorites;

    // 🔧 添加数据类型检查
    if (!Array.isArray(renderList)) {
      console.warn('renderList 不是数组:', renderList);
      container.innerHTML = this.createEmptyState();
      return;
    }

    if (renderList.length === 0) {
      container.innerHTML = this.createEmptyState();
      return;
    }

    try {
      container.innerHTML = renderList.map(fav => this.createFavoriteHTML(fav)).join('');
      
      // 绑定事件委托
      this.bindFavoritesEvents(container);
    } catch (error) {
      console.error('渲染收藏失败:', error);
      container.innerHTML = this.createEmptyState();
      this.notificationService?.showToast('渲染收藏失败', 'error');
    }
  }

  // 绑定收藏夹事件
  bindFavoritesEvents(container) {
    // 移除旧的事件监听器
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);
    
    newContainer.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const id = button.dataset.id;

      switch (action) {
        case 'visit':
          this.openFavorite(url);
          break;
        case 'copy':
          this.copyFavoriteUrl(url);
          break;
        case 'remove':
          this.removeFavorite(id);
          break;
      }
    });
  }

  // 暴露全局方法
  exposeGlobalMethods() {
    window.favoritesManager = {
      openFavorite: (url) => this.openFavorite(url),
      copyFavoriteUrl: (url) => this.copyFavoriteUrl(url),
      removeFavorite: (id) => this.removeFavorite(id)
    };
  }

  // 创建收藏HTML (移除内联事件)
  createFavoriteHTML(favorite) {
    // 🔧 添加数据验证
    if (!favorite || typeof favorite !== 'object') {
      console.warn('收藏项数据无效:', favorite);
      return '';
    }

    const safeTitle = escapeHtml(favorite.title || '未知标题');
    const safeSubtitle = escapeHtml(favorite.subtitle || '');
    const safeUrl = escapeHtml(favorite.url || '');
    const safeKeyword = escapeHtml(favorite.keyword || '');
    const addedAt = favorite.addedAt ? formatRelativeTime(favorite.addedAt) : '未知时间';

    return `
      <div class="favorite-item" data-id="${favorite.id || ''}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${favorite.icon || '🔗'}</span>
            <span class="favorite-name">${safeTitle}</span>
          </div>
          <div class="favorite-subtitle">${safeSubtitle}</div>
          <div class="favorite-url">${safeUrl}</div>
          <div class="favorite-meta">
            <span>关键词: ${safeKeyword}</span>
            <span>添加时间: ${addedAt}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" data-action="visit" data-url="${safeUrl}">
            访问
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${safeUrl}">
            复制
          </button>
          <button class="action-btn remove-btn" data-action="remove" data-id="${favorite.id || ''}">
            删除
          </button>
        </div>
      </div>
    `;
  }

  // 创建空状态
  createEmptyState() {
    const isAuthenticated = this.authService?.isAuthenticated() || false;
    return `
      <div class="empty-state">
        <span style="font-size: 3rem;">📌</span>
        <p>暂无收藏${isAuthenticated ? '，搜索后添加收藏吧！' : ''}</p>
        ${!isAuthenticated ? '<p><small>登录后可以同步收藏到云端</small></p>' : ''}
      </div>
    `;
  }

  // 添加收藏
  async addFavorite(item) {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录后再收藏', 'error');
      return false;
    }

    try {
      // 检查收藏数量限制
      const settings = await this.userFavoritesService.getSettings();
      const maxFavorites = settings?.maxFavoritesPerUser || 500;
      
      if (this.favorites.length >= maxFavorites) {
        this.notificationService.showToast(`收藏已达上限（${maxFavorites}个）`, 'error');
        return false;
      }

      // 检查是否已收藏
      const existingIndex = this.favorites.findIndex(fav => fav.url === item.url);
      if (existingIndex >= 0) {
        this.notificationService.showToast('已经收藏过了', 'info');
        return false;
      }

      showLoading(true);
      
      // 使用服务添加收藏
      const favorite = await this.userFavoritesService.addFavorite(item);
      
      // 添加到本地
      this.favorites.unshift(favorite);
      this.renderFavorites();

      this.notificationService.showToast('已添加收藏', 'success');
      return true;

    } catch (error) {
      console.error('添加收藏失败:', error);
      this.notificationService.showToast('添加收藏失败: ' + error.message, 'error');
      return false;
    } finally {
      showLoading(false);
    }
  }

  // 移除收藏
  async removeFavorite(favoriteId) {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要移除这个收藏吗？')) return;

    const index = this.favorites.findIndex(fav => fav.id === favoriteId);
    if (index >= 0) {
      try {
        showLoading(true);
        
        // 先从本地移除
        const removedFavorite = this.favorites.splice(index, 1)[0];
        this.renderFavorites();
        
        // 使用服务同步到云端
        await this.userFavoritesService.removeFavorite(favoriteId);
        this.notificationService.showToast('已移除收藏', 'success');
        
      } catch (error) {
        console.error('移除收藏失败:', error);
        this.notificationService.showToast('移除收藏失败: ' + error.message, 'error');
        
        // 回滚本地操作
        this.favorites.splice(index, 0, removedFavorite);
        this.renderFavorites();
        
      } finally {
        showLoading(false);
      }
    }
  }

  // 同步收藏
  async syncFavorites() {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录', 'error');
      return;
    }

    try {
      showLoading(true);
      await this.userFavoritesService.syncFavorites();
      
      // 重新加载收藏
      await this.loadFavorites();
      this.notificationService.showToast('收藏夹同步成功', 'success');
    } catch (error) {
      console.error('收藏夹同步失败:', error);
      this.notificationService.showToast(`收藏夹同步失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 导入收藏
  importFavorites() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (data.favorites && Array.isArray(data.favorites)) {
          // 合并收藏，避免重复
          const existingUrls = new Set(this.favorites.map(fav => fav.url));
          const newFavorites = data.favorites.filter(fav => !existingUrls.has(fav.url));
          
          if (newFavorites.length > 0) {
            // 使用服务批量导入
            await this.userFavoritesService.importFavorites(newFavorites);
            
            // 重新加载收藏
            await this.loadFavorites();
            this.notificationService.showToast(`成功导入${newFavorites.length}个收藏`, 'success');
          } else {
            this.notificationService.showToast('没有新的收藏需要导入', 'info');
          }
        } else {
          throw new Error('文件格式不正确');
        }
      } catch (error) {
        console.error('导入收藏失败:', error);
        this.notificationService.showToast('导入失败: ' + error.message, 'error');
      }
    };
    
    input.click();
  }

  // 搜索收藏
  searchFavorites(query = '') {
    if (!query.trim()) {
      this.renderFavorites();
      return;
    }

    // 🔧 确保在搜索前验证数据类型
    if (!Array.isArray(this.favorites)) {
      console.warn('收藏数据不是数组:', this.favorites);
      this.renderFavorites([]);
      return;
    }

    const filteredFavorites = this.favorites.filter(fav => {
      if (!fav || typeof fav !== 'object') return false;
      
      const title = (fav.title || '').toLowerCase();
      const subtitle = (fav.subtitle || '').toLowerCase();
      const keyword = (fav.keyword || '').toLowerCase();
      const searchQuery = query.toLowerCase();
      
      return title.includes(searchQuery) || 
             subtitle.includes(searchQuery) || 
             keyword.includes(searchQuery);
    });

    this.renderFavorites(filteredFavorites);
  }

  // 排序收藏
  sortFavorites(sortBy) {
    // 🔧 确保在排序前验证数据类型
    if (!Array.isArray(this.favorites)) {
      console.warn('收藏数据不是数组:', this.favorites);
      return;
    }

    let sortedFavorites = [...this.favorites];

    switch (sortBy) {
      case 'date-desc':
        sortedFavorites.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
        break;
      case 'date-asc':
        sortedFavorites.sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));
        break;
      case 'name-asc':
        sortedFavorites.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      case 'name-desc':
        sortedFavorites.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
        break;
    }

    this.renderFavorites(sortedFavorites);
  }

  // 打开收藏
  openFavorite(url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      this.notificationService.showToast('已在新标签页打开', 'success');
      
      // 记录访问行为
      if (this.authService.isAuthenticated()) {
        this.userFavoritesService.recordAction('visit_site', { url, source: 'favorites' }).catch(console.error);
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      this.notificationService.showToast('无法打开链接', 'error');
    }
  }

  // 复制收藏URL
  async copyFavoriteUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      this.notificationService.showToast('已复制到剪贴板', 'success');
      
      // 记录复制行为
      if (this.authService.isAuthenticated()) {
        this.userFavoritesService.recordAction('copy_url', { url, source: 'favorites' }).catch(console.error);
      }
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        this.notificationService.showToast('已复制到剪贴板', 'success');
      } catch (err) {
        this.notificationService.showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  // 检查是否已收藏
  isFavorited(url) {
    // 🔧 添加数据类型检查
    if (!Array.isArray(this.favorites)) {
      return false;
    }
    return this.favorites.some(fav => fav && fav.url === url);
  }

  // 获取收藏统计
  getStats() {
    // 🔧 添加数据类型检查
    if (!Array.isArray(this.favorites)) {
      return {
        total: 0,
        byKeyword: {},
        recentCount: 0,
        topKeywords: []
      };
    }

    return {
      total: this.favorites.length,
      byKeyword: this.groupByKeyword(),
      recentCount: this.getRecentCount(),
      topKeywords: this.getTopKeywords()
    };
  }

  // 按关键词分组
  groupByKeyword() {
    const groups = {};
    if (Array.isArray(this.favorites)) {
      this.favorites.forEach(fav => {
        if (fav && typeof fav === 'object') {
          const keyword = fav.keyword || 'unknown';
          groups[keyword] = (groups[keyword] || 0) + 1;
        }
      });
    }
    return groups;
  }

  // 获取最近添加数量（7天内）
  getRecentCount() {
    if (!Array.isArray(this.favorites)) return 0;
    
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.favorites.filter(fav => 
      fav && fav.addedAt && new Date(fav.addedAt) > weekAgo
    ).length;
  }

  // 获取热门关键词
  getTopKeywords() {
    const keywordCounts = this.groupByKeyword();
    return Object.entries(keywordCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([keyword, count]) => ({ keyword, count }));
  }
}

// 创建全局实例
export const favoritesManager = new FavoritesManager();
export default favoritesManager;