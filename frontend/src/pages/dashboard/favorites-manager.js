// 收藏页面管理器
import { showLoading, showToast } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { debounce } from '../utils/helpers.js';
import apiService from '../services/api.js';

export class FavoritesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.favorites = [];
  }

  async init() {
    console.log('⭐ 初始化收藏管理器');
    this.bindEvents();
  }

  async loadData() {
    if (!this.app.getCurrentUser()) {
      console.log('用户未登录，无法加载收藏数据');
      return;
    }

    try {
      const favoritesResult = await apiService.getFavorites();
      this.favorites = favoritesResult || [];
      console.log(`加载了 ${this.favorites.length} 个收藏`);
    } catch (error) {
      console.error('加载收藏数据失败:', error);
      this.favorites = [];
    }
  }

  async loadTabData() {
    await this.loadFavoritesData();
  }

  bindEvents() {
    // 收藏搜索和排序控件
    const favoritesSearchBtn = document.getElementById('favoritesSearchBtn');
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');
    
    if (favoritesSearchBtn) {
      favoritesSearchBtn.addEventListener('click', () => this.searchFavorites());
    }
    
    if (favoritesSearch) {
      favoritesSearch.addEventListener('input', debounce(() => this.searchFavorites(), 300));
      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.searchFavorites();
      });
    }
    
    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => this.searchFavorites());
    }
  }

  async loadFavoritesData() {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;

    if (this.favorites.length === 0) {
      favoritesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">📌</span>
          <p>暂无收藏</p>
          <a href="index.html" class="btn-primary">去搜索</a>
        </div>
      `;
      return;
    }

    favoritesList.innerHTML = this.favorites.map(fav => `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url">${escapeHtml(fav.url)}</div>
          <div class="favorite-meta">
            <span>关键词: ${escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')">
            访问
          </button>
          <button class="action-btn remove-btn" onclick="app.getManager('favorites').removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }

  searchFavorites() {
    const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';
    
    let filteredFavorites = this.favorites;

    if (searchTerm) {
      filteredFavorites = this.favorites.filter(fav => 
        fav.title.toLowerCase().includes(searchTerm) ||
        fav.subtitle.toLowerCase().includes(searchTerm) ||
        fav.keyword.toLowerCase().includes(searchTerm)
      );
    }

    switch (sortBy) {
      case 'date-desc':
        filteredFavorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        break;
      case 'date-asc':
        filteredFavorites.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
        break;
      case 'name-asc':
        filteredFavorites.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'name-desc':
        filteredFavorites.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }

    this.renderFilteredFavorites(filteredFavorites);
  }

  renderFilteredFavorites(favorites) {
    const favoritesList = document.getElementById('favoritesList');
    if (!favoritesList) return;

    if (favorites.length === 0) {
      favoritesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的收藏</p>
        </div>
      `;
      return;
    }

    favoritesList.innerHTML = favorites.map(fav => `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url">${escapeHtml(fav.url)}</div>
          <div class="favorite-meta">
            <span>关键词: ${escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')">
            访问
          </button>
          <button class="action-btn remove-btn" onclick="app.getManager('favorites').removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `).join('');
  }

  // 同步收藏 - 直接与API交互
  async syncFavorites() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      await apiService.syncFavorites(this.favorites);
      showToast('收藏夹同步成功', 'success');
    } catch (error) {
      console.error('同步收藏失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 移除收藏
  async removeFavorite(favoriteId) {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这个收藏吗？')) return;

    const index = this.favorites.findIndex(f => f.id === favoriteId);
    if (index >= 0) {
      try {
        showLoading(true);
        
        // 从数组中移除
        this.favorites.splice(index, 1);
        
        // 同步到云端
        await apiService.syncFavorites(this.favorites);
        
        // 重新加载数据以确保一致性
        await this.loadFavoritesData();
        showToast('收藏已删除', 'success');
        
      } catch (error) {
        console.error('删除收藏失败:', error);
        showToast('删除失败: ' + error.message, 'error');
        
        // 重新加载云端数据以恢复状态
        await this.loadData();
      } finally {
        showLoading(false);
      }
    }
  }

  // 收藏夹导出
  async exportFavorites() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      // 从云端获取最新收藏数据
      const favorites = await apiService.getFavorites();
      
      const data = {
        favorites: favorites || this.favorites,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `favorites-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('收藏导出成功', 'success');
    } catch (error) {
      console.error('导出收藏失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 公共方法供其他管理器调用
  getFavorites() {
    return this.favorites;
  }

  getFavoritesCount() {
    return this.favorites.length;
  }
}

export default FavoritesManager;