// 收藏管理组件
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import apiService from '../services/api.js';
import authManager from '../services/auth.js';

export class FavoritesManager {
  constructor() {
    this.favorites = [];
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadFavorites();
      this.bindEvents();
      this.exposeGlobalMethods(); // 🔧 新增
      this.isInitialized = true;
    } catch (error) {
      console.error('收藏管理器初始化失败:', error);
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
    if (!authManager.isAuthenticated()) {
      this.favorites = [];
      this.renderFavorites();
      return;
    }

    try {
      const cloudFavorites = await apiService.getFavorites();
      this.favorites = cloudFavorites || [];
      this.renderFavorites();
    } catch (error) {
      console.error('加载收藏失败:', error);
      this.favorites = [];
      this.renderFavorites();
    }
  }

  // 渲染收藏 (添加事件委托)
  renderFavorites(favoritesToRender = null) {
    const container = document.getElementById('favorites');
    if (!container) return;

    const renderList = favoritesToRender || this.favorites;

    if (renderList.length === 0) {
      container.innerHTML = this.createEmptyState();
      return;
    }

    container.innerHTML = renderList.map(fav => this.createFavoriteHTML(fav)).join('');
    
    // 🔧 绑定事件委托
    this.bindFavoritesEvents(container);
  }

  // 🔧 新增：绑定收藏夹事件
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
    const isAuthenticated = authManager.isAuthenticated();
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
	  
	      // 检查收藏数量限制
    const settings = await apiService.getUserSettings();
    const maxFavorites = settings.maxFavoritesPerUser || 500;
    
    if (this.favorites.length >= maxFavorites) {
        showToast(`收藏已达上限（${maxFavorites}个）`, 'error');
        return false;
    }
	  
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
      return false;
    }

    // 检查是否已收藏
    const existingIndex = this.favorites.findIndex(fav => fav.url === item.url);
    if (existingIndex >= 0) {
      showToast('已经收藏过了', 'info');
      return false;
    }

    const favorite = {
      id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: item.title,
      subtitle: item.subtitle,
      url: item.url,
      icon: item.icon,
      keyword: item.keyword,
      addedAt: new Date().toISOString()
    };

    try {
      showLoading(true);
      
      // 添加到本地
      this.favorites.unshift(favorite);
      this.renderFavorites();

      // 同步到云端
      await apiService.syncFavorites(this.favorites);
      showToast('已添加收藏', 'success');
      return true;

    } catch (error) {
      console.error('添加收藏失败:', error);
      showToast('添加收藏失败: ' + error.message, 'error');
      
      // 回滚本地操作
      this.favorites.shift();
      this.renderFavorites();
      return false;

    } finally {
      showLoading(false);
    }
  }

  // 移除收藏
async removeFavorite(favoriteId) {
  if (!authManager.isAuthenticated()) {
    showToast('用户未登录', 'error');
    return;
  }

  if (!confirm('确定要移除这个收藏吗？')) return;

  const index = this.favorites.findIndex(fav => fav.id === favoriteId);
  if (index >= 0) {
    try {
      showLoading(true);
      
      // 🔧 深拷贝保存完整的收藏列表和被删除的项目
      const originalFavorites = JSON.parse(JSON.stringify(this.favorites));
      const removedFavorite = originalFavorites[index];
      
      // 先从本地移除
      this.favorites.splice(index, 1);
      this.renderFavorites();
      
      // 同步到云端 - 关键：不使用返回值更新本地数据
      await apiService.syncFavorites(this.favorites);
      showToast('已移除收藏', 'success');
      
    } catch (error) {
      console.error('移除收藏失败:', error);
      showToast('移除收藏失败: ' + error.message, 'error');
      
      // 🔧 回滚：恢复完整的原始列表
      this.favorites = originalFavorites;
      this.renderFavorites();
      
    } finally {
      showLoading(false);
    }
  }
}

  // 同步收藏
async syncFavorites() {
  if (!authManager.isAuthenticated()) {
    showToast('请先登录', 'error');
    return;
  }

  try {
    showLoading(true);
    
    // 🔧 保存当前收藏的时间戳
    const originalFavorites = JSON.parse(JSON.stringify(this.favorites));
    
    const result = await apiService.syncFavorites(this.favorites);
    
    // 🔧 检查服务器是否返回了数据，以及是否需要更新本地
    if (result && result.favorites && !result.shouldUpdateLocal) {
      // 服务器返回了数据但明确表示不需要更新本地
      console.log('同步成功，保持本地数据不变');
    } else if (result && result.favorites && result.shouldUpdateLocal) {
      // 服务器返回了数据且需要更新本地
      this.favorites = apiService.preserveTimestamps(originalFavorites, result.favorites);
      this.renderFavorites();
    }
    // 如果服务器只返回成功状态，不做任何本地数据更新
    
    showToast('收藏夹同步成功', 'success');
  } catch (error) {
    console.error('收藏夹同步失败:', error);
    showToast(`收藏夹同步失败: ${error.message}`, 'error');
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
            this.favorites.push(...newFavorites);
            this.renderFavorites();
            showToast(`成功导入${newFavorites.length}个收藏`, 'success');
            
            // 同步到云端
            if (authManager.isAuthenticated()) {
              await this.syncFavorites();
            }
          } else {
            showToast('没有新的收藏需要导入', 'info');
          }
        } else {
          throw new Error('文件格式不正确');
        }
      } catch (error) {
        console.error('导入收藏失败:', error);
        showToast('导入失败: ' + error.message, 'error');
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

    const filteredFavorites = this.favorites.filter(fav => 
      fav.title.toLowerCase().includes(query.toLowerCase()) ||
      fav.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      fav.keyword.toLowerCase().includes(query.toLowerCase())
    );

    this.renderFavorites(filteredFavorites);
  }

  // 排序收藏
  sortFavorites(sortBy) {
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
      showToast('已在新标签页打开', 'success');
      
      // 记录访问行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('visit_site', { url, source: 'favorites' }).catch(console.error);
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      showToast('无法打开链接', 'error');
    }
  }

  // 复制收藏URL
  async copyFavoriteUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      showToast('已复制到剪贴板', 'success');
      
      // 记录复制行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('copy_url', { url, source: 'favorites' }).catch(console.error);
      }
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板', 'success');
      } catch (err) {
        showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  // 检查是否已收藏
  isFavorited(url) {
    return this.favorites.some(fav => fav.url === url);
  }

  // 获取收藏统计
  getStats() {
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
    this.favorites.forEach(fav => {
      const keyword = fav.keyword || 'unknown';
      groups[keyword] = (groups[keyword] || 0) + 1;
    });
    return groups;
  }

  // 获取最近添加数量（7天内）
  getRecentCount() {
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