// 收藏管理组件 - 重构版本：使用新服务架构 - 修复数据类型问题
import { getService } from '../services/services-bootstrap.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';

export class FavoritesManager {
  constructor() {
    this.favorites = []; // 🔧 确保初始化为数组
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

  // 🔧 修复：加载收藏 - 正确处理服务返回的对象格式
  async loadFavorites() {
    if (!this.authService.isAuthenticated()) {
      this.favorites = [];
      this.renderFavorites();
      return;
    }

    try {
      const result = await this.userFavoritesService.getFavorites();
      
      // 🔧 修复：正确处理服务返回的对象格式
      if (result && result.success && Array.isArray(result.favorites)) {
        this.favorites = result.favorites;
      } else {
        console.warn('收藏服务返回格式异常:', result);
        this.favorites = [];
        if (result && result.error) {
          this.notificationService?.showToast('加载收藏失败: ' + result.error, 'error');
        }
      }
      
      this.renderFavorites();
    } catch (error) {
      console.error('加载收藏失败:', error);
      this.favorites = [];
      this.renderFavorites();
      this.notificationService?.showToast('加载收藏失败: ' + error.message, 'error');
    }
  }

  // 渲染收藏 (添加事件委托)
  renderFavorites(favoritesToRender = null) {
    const container = document.getElementById('favorites');
    if (!container) return;

    // 🔧 添加安全检查：确保使用的数据是数组
    const renderList = favoritesToRender || this.favorites;
    
    if (!Array.isArray(renderList)) {
      console.error('渲染数据不是数组类型:', renderList);
      container.innerHTML = this.createEmptyState();
      return;
    }

    if (renderList.length === 0) {
      container.innerHTML = this.createEmptyState();
      return;
    }

    container.innerHTML = renderList.map(fav => this.createFavoriteHTML(fav)).join('');
    
    // 绑定事件委托
    this.bindFavoritesEvents(container);
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
    return `
      <div class="favorite-item" data-id="${favorite.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${favorite.icon}</span>
            <span class="favorite-name">${escapeHtml(favorite.title)}</span>
          </div>
          <div class="favorite-subtitle">${escapeHtml(favorite.subtitle)}</div>
          <div class="favorite-url">${escapeHtml(favorite.url)}</div>
          <div class="favorite-meta">
            <span>关键词: ${escapeHtml(favorite.keyword)}</span>
            <span>添加时间: ${formatRelativeTime(favorite.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" data-action="visit" data-url="${escapeHtml(favorite.url)}">
            访问
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(favorite.url)}">
            复制
          </button>
          <button class="action-btn remove-btn" data-action="remove" data-id="${favorite.id}">
            删除
          </button>
        </div>
      </div>
    `;
  }

  // 创建空状态
  createEmptyState() {
    const isAuthenticated = this.authService.isAuthenticated();
    return `
      <div class="empty-state">
        <span style="font-size: 3rem;">📌</span>
        <p>暂无收藏${isAuthenticated ? '，搜索后添加收藏吧！' : ''}</p>
        ${!isAuthenticated ? '<p><small>登录后可以同步收藏到云端</small></p>' : ''}
      </div>
    `;
  }

  // 🔧 修复：添加收藏 - 正确处理服务返回值
  async addFavorite(item) {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录后再收藏', 'error');
      return false;
    }

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

    try {
      showLoading(true);
      
      // 🔧 修复：正确处理服务返回值
      const result = await this.userFavoritesService.addFavorite(item);
      
      if (result && result.success) {
        // 添加到本地 - 使用服务返回的favorite对象，如果没有则使用item
        const favoriteToAdd = result.favorite || {
          ...item,
          id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          addedAt: Date.now()
        };
        
        this.favorites.unshift(favoriteToAdd);
        this.renderFavorites();
        
        this.notificationService.showToast('已添加收藏', 'success');
        return true;
      } else {
        throw new Error(result?.error || '添加收藏失败');
      }

    } catch (error) {
      console.error('添加收藏失败:', error);
      this.notificationService.showToast('添加收藏失败: ' + error.message, 'error');
      return false;
    } finally {
      showLoading(false);
    }
  }

  // 🔧 修复：移除收藏 - 正确处理服务返回值
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
        
        // 🔧 修复：正确处理服务返回值
        const result = await this.userFavoritesService.removeFavorite(favoriteId);
        
        if (result && result.success) {
          this.notificationService.showToast('已移除收藏', 'success');
        } else {
          // 如果服务端操作失败，回滚本地操作
          this.favorites.splice(index, 0, removedFavorite);
          this.renderFavorites();
          throw new Error(result?.error || '移除收藏失败');
        }
        
      } catch (error) {
        console.error('移除收藏失败:', error);
        this.notificationService.showToast('移除收藏失败: ' + error.message, 'error');
        
        // 回滚本地操作
        if (index >= 0 && index < this.favorites.length) {
          this.favorites.splice(index, 0, removedFavorite);
          this.renderFavorites();
        }
        
      } finally {
        showLoading(false);
      }
    }
  }

  // 🔧 修复：同步收藏 - 正确处理服务返回值
  async syncFavorites() {
    if (!this.authService.isAuthenticated()) {
      this.notificationService.showToast('请先登录', 'error');
      return;
    }

    try {
      showLoading(true);
      
      const result = await this.userFavoritesService.syncFavorites();
      
      if (result && result.success) {
        // 重新加载收藏
        await this.loadFavorites();
        this.notificationService.showToast('收藏夹同步成功', 'success');
      } else {
        throw new Error(result?.error || '同步失败');
      }
    } catch (error) {
      console.error('收藏夹同步失败:', error);
      this.notificationService.showToast(`收藏夹同步失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 修复：导入收藏 - 正确处理服务返回值
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
            // 🔧 修复：使用服务批量导入
            const result = await this.userFavoritesService.importFavorites(newFavorites);
            
            if (result && result.success) {
              // 重新加载收藏
              await this.loadFavorites();
              this.notificationService.showToast(`成功导入${newFavorites.length}个收藏`, 'success');
            } else {
              throw new Error(result?.error || '导入失败');
            }
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

    // 🔧 添加安全检查：确保favorites是数组
    if (!Array.isArray(this.favorites)) {
      console.error('收藏数据不是数组类型:', this.favorites);
      this.renderFavorites([]);
      return;
    }

    const filteredFavorites = this.favorites.filter(fav => 
      fav.title.toLowerCase().includes(query.toLowerCase()) ||
      fav.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      fav.keyword.toLowerCase().includes(query.toLowerCase())
    );

    this.renderFavorites(filteredFavorites);
  }

  // 排序收藏
  sortFavorites(sortBy) {
    // 🔧 添加安全检查：确保favorites是数组
    if (!Array.isArray(this.favorites)) {
      console.error('收藏数据不是数组类型:', this.favorites);
      return;
    }

    let sortedFavorites = [...this.favorites];

    switch (sortBy) {
      case 'date-desc':
        sortedFavorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        break;
      case 'date-asc':
        sortedFavorites.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
        break;
      case 'name-asc':
        sortedFavorites.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        sortedFavorites.sort((a, b) => b.title.localeCompare(a.title));
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
    // 🔧 添加安全检查：确保favorites是数组
    if (!Array.isArray(this.favorites)) {
      console.error('收藏数据不是数组类型:', this.favorites);
      return false;
    }
    
    return this.favorites.some(fav => fav.url === url);
  }

  // 获取收藏统计
  getStats() {
    // 🔧 添加安全检查：确保favorites是数组
    if (!Array.isArray(this.favorites)) {
      console.error('收藏数据不是数组类型:', this.favorites);
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
    // 🔧 添加安全检查
    if (!Array.isArray(this.favorites)) return {};

    const groups = {};
    this.favorites.forEach(fav => {
      const keyword = fav.keyword || 'unknown';
      groups[keyword] = (groups[keyword] || 0) + 1;
    });
    return groups;
  }

  // 获取最近添加数量（7天内）
  getRecentCount() {
    // 🔧 添加安全检查
    if (!Array.isArray(this.favorites)) return 0;

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.favorites.filter(fav => new Date(fav.addedAt) > weekAgo).length;
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