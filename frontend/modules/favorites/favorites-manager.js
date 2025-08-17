import { apiClient } from '../api/api-client.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';
import { ArrayUtils } from '../utils/array.js';
import { StringUtils } from '../utils/string.js';
import { DateUtils } from '../utils/date.js';

/**
 * 收藏管理器
 */
export class FavoritesManager {
  constructor() {
    this.favorites = [];
    this.filteredFavorites = [];
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    
    this.bindEvents();
    this.isInitialized = true;
  }

  bindEvents() {
    // 搜索和排序控件
    const favoritesSearch = document.getElementById('favoritesSearch');
    const favoritesSort = document.getElementById('favoritesSort');

    if (favoritesSearch) {
      favoritesSearch.addEventListener('input', debounce(() => {
        this.filterAndSort();
      }, APP_CONSTANTS.UI.DEBOUNCE_DELAY));

      favoritesSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.filterAndSort();
      });
    }

    if (favoritesSort) {
      favoritesSort.addEventListener('change', () => {
        this.filterAndSort();
      });
    }
  }

  async loadFavorites() {
    try {
      loading.show();
      
      const cloudFavorites = await apiClient.getFavorites();
      this.favorites = cloudFavorites || [];
      this.filteredFavorites = [...this.favorites];
      
      this.renderFavorites();
      
      console.log(`✅ 收藏加载完成: ${this.favorites.length}个收藏`);
    } catch (error) {
      console.error('加载收藏失败:', error);
      toast.error('加载收藏失败');
      this.favorites = [];
      this.filteredFavorites = [];
      this.renderFavorites();
    } finally {
      loading.hide();
    }
  }

  async addFavorite(item) {
    if (!item || !item.title || !item.url) {
      toast.error('收藏项数据不完整');
      return false;
    }

    // 检查是否已存在
    const exists = this.favorites.some(fav => fav.url === item.url);
    if (exists) {
      toast.warning('该项目已在收藏中');
      return false;
    }

    // 检查数量限制
    if (this.favorites.length >= APP_CONSTANTS.LIMITS.MAX_FAVORITES) {
      toast.error(`收藏数量已达上限 (${APP_CONSTANTS.LIMITS.MAX_FAVORITES})`);
      return false;
    }

    try {
      loading.show();

      const favorite = {
        id: this.generateId(),
        title: item.title,
        subtitle: item.subtitle || '',
        url: item.url,
        icon: item.icon || '🔗',
        keyword: item.keyword || '',
        addedAt: new Date().toISOString()
      };

      // 本地添加
      this.favorites.unshift(favorite);
      this.filterAndSort();

      // 同步到云端
      await apiClient.syncFavorites(this.favorites);
      
      toast.success('已添加收藏');
      return true;

    } catch (error) {
      console.error('添加收藏失败:', error);
      toast.error('添加收藏失败: ' + error.message);
      
      // 回滚本地操作
      await this.loadFavorites();
      return false;
    } finally {
      loading.hide();
    }
  }

  async removeFavorite(favoriteId) {
    if (!favoriteId) return false;

    const index = this.favorites.findIndex(fav => fav.id === favoriteId);
    if (index < 0) {
      toast.error('收藏项不存在');
      return false;
    }

    if (!confirm('确定要删除这个收藏吗？')) return false;

    try {
      loading.show();

      // 本地删除
      const removed = this.favorites.splice(index, 1)[0];
      this.filterAndSort();

      // 同步到云端
      await apiClient.syncFavorites(this.favorites);
      
      toast.success('收藏已删除');
      return true;

    } catch (error) {
      console.error('删除收藏失败:', error);
      toast.error('删除收藏失败: ' + error.message);
      
      // 回滚本地操作
      await this.loadFavorites();
      return false;
    } finally {
      loading.hide();
    }
  }

  async syncFavorites() {
    try {
      loading.show();
      
      await apiClient.syncFavorites(this.favorites);
      toast.success('收藏同步成功');
    } catch (error) {
      console.error('收藏同步失败:', error);
      toast.error('收藏同步失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  filterAndSort() {
    const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
    const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';

    // 过滤
    let filtered = this.favorites;
    if (searchTerm) {
      filtered = this.favorites.filter(fav => 
        fav.title.toLowerCase().includes(searchTerm) ||
        fav.subtitle.toLowerCase().includes(searchTerm) ||
        fav.keyword.toLowerCase().includes(searchTerm) ||
        fav.url.toLowerCase().includes(searchTerm)
      );
    }

    // 排序
    switch (sortBy) {
      case 'date-desc':
        filtered = ArrayUtils.sortBy(filtered, 'addedAt', true);
        break;
      case 'date-asc':
        filtered = ArrayUtils.sortBy(filtered, 'addedAt', false);
        break;
      case 'name-asc':
        filtered = ArrayUtils.sortBy(filtered, 'title', false);
        break;
      case 'name-desc':
        filtered = ArrayUtils.sortBy(filtered, 'title', true);
        break;
    }

    this.filteredFavorites = filtered;
    this.renderFavorites();
  }

  renderFavorites() {
    const favoritesContainer = document.getElementById('favorites') || 
                             document.getElementById('favoritesList');
    
    if (!favoritesContainer) return;

    if (this.filteredFavorites.length === 0) {
      const isEmpty = this.favorites.length === 0;
      favoritesContainer.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">📌</span>
          <p>${isEmpty ? '暂无收藏，搜索后添加收藏吧！' : '没有找到匹配的收藏'}</p>
          ${isEmpty ? '<p><small>登录后可以同步收藏到云端</small></p>' : ''}
        </div>
      `;
      return;
    }

    favoritesContainer.innerHTML = this.filteredFavorites.map(fav => 
      this.createFavoriteHTML(fav)
    ).join('');
  }

  createFavoriteHTML(fav) {
    return `
      <div class="favorite-item" data-id="${fav.id}">
        <div class="favorite-content">
          <div class="favorite-title">
            <span class="favorite-icon">${fav.icon}</span>
            <span class="favorite-name">${StringUtils.escapeHtml(fav.title)}</span>
          </div>
          <div class="favorite-subtitle">${StringUtils.escapeHtml(fav.subtitle)}</div>
          <div class="favorite-url" title="${StringUtils.escapeHtml(fav.url)}">
            ${StringUtils.truncate(fav.url, 60)}
          </div>
          <div class="favorite-meta">
            <span>关键词: ${StringUtils.escapeHtml(fav.keyword)}</span>
            <span>添加时间: ${DateUtils.formatRelativeTime(fav.addedAt)}</span>
          </div>
        </div>
        <div class="favorite-actions">
          <button class="action-btn visit-btn" onclick="favoritesManager.openFavorite('${StringUtils.escapeHtml(fav.url)}')">
            访问
          </button>
          <button class="action-btn copy-btn" onclick="favoritesManager.copyToClipboard('${StringUtils.escapeHtml(fav.url)}')">
            复制
          </button>
          <button class="action-btn remove-btn" onclick="favoritesManager.removeFavorite('${fav.id}')">
            删除
          </button>
        </div>
      </div>
    `;
  }

  openFavorite(url) {
    try {
      // 记录访问行为
      apiClient.recordAction('visit_favorite', { url }).catch(console.error);
      
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('已在新标签页打开');
    } catch (error) {
      console.error('打开收藏失败:', error);
      toast.error('无法打开链接');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('已复制到剪贴板');
      
      // 记录复制行为
      apiClient.recordAction('copy_favorite', { url: text }).catch(console.error);
    } catch (error) {
      // 降级到旧方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('已复制到剪贴板');
      } catch (err) {
        toast.error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  }

  async exportFavorites() {
    try {
      const data = {
        favorites: this.favorites,
        exportTime: new Date().toISOString(),
        version: APP_CONSTANTS.APP.VERSION
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

      toast.success('收藏导出成功');
    } catch (error) {
      console.error('导出收藏失败:', error);
      toast.error('导出失败: ' + error.message);
    }
  }

  async importFavorites(file) {
    try {
      loading.show();
      
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.favorites || !Array.isArray(data.favorites)) {
        throw new Error('文件格式不正确');
      }

      // 合并收藏，避免重复
      const existingUrls = new Set(this.favorites.map(fav => fav.url));
      const newFavorites = data.favorites.filter(fav => 
        fav.url && !existingUrls.has(fav.url)
      );
      
      if (newFavorites.length > 0) {
        this.favorites.push(...newFavorites);
        this.filterAndSort();
        
        // 同步到云端
        await this.syncFavorites();
        
        toast.success(`成功导入${newFavorites.length}个收藏`);
      } else {
        toast.info('没有新的收藏需要导入');
      }
    } catch (error) {
      console.error('导入收藏失败:', error);
      toast.error('导入失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }

  // 检查是否已收藏
  isFavorited(url) {
    return this.favorites.some(fav => fav.url === url);
  }

  // 根据URL查找收藏
  findByUrl(url) {
    return this.favorites.find(fav => fav.url === url);
  }

  // 获取收藏统计
  getStats() {
    return {
      total: this.favorites.length,
      filtered: this.filteredFavorites.length,
      sources: this.getSourceStats(),
      recent: this.getRecentStats()
    };
  }

  getSourceStats() {
    const sourceCount = {};
    this.favorites.forEach(fav => {
      try {
        const domain = new URL(fav.url).hostname;
        sourceCount[domain] = (sourceCount[domain] || 0) + 1;
      } catch (error) {
        sourceCount['unknown'] = (sourceCount['unknown'] || 0) + 1;
      }
    });
    return sourceCount;
  }

  getRecentStats() {
    const now = new Date();
    const stats = { today: 0, thisWeek: 0, thisMonth: 0 };
    
    this.favorites.forEach(fav => {
      const addedDate = new Date(fav.addedAt);
      
      if (DateUtils.isToday(addedDate)) stats.today++;
      if (DateUtils.isThisWeek(addedDate)) stats.thisWeek++;
      if (DateUtils.isThisMonth(addedDate)) stats.thisMonth++;
    });
    
    return stats;
  }

  generateId() {
    return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取所有收藏
  getFavorites() {
    return this.favorites;
  }

  // 设置收藏列表
  setFavorites(favorites) {
    this.favorites = favorites || [];
    this.filteredFavorites = [...this.favorites];
    this.renderFavorites();
  }

  // 清空收藏
  async clearAllFavorites() {
    if (!confirm('确定要清空所有收藏吗？此操作不可恢复。')) return;

    try {
      loading.show();
      
      this.favorites = [];
      this.filteredFavorites = [];
      
      await apiClient.syncFavorites(this.favorites);
      this.renderFavorites();
      
      toast.success('收藏已清空');
    } catch (error) {
      console.error('清空收藏失败:', error);
      toast.error('清空失败: ' + error.message);
    } finally {
      loading.hide();
    }
  }
}

// 创建全局实例
export const favoritesManager = new FavoritesManager();