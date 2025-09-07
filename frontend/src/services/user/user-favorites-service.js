// src/services/user/user-favorites-service.js
// 用户收藏服务 - 从api.js拆分的收藏相关功能

export class UserFavoritesService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.favoritesCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = 2 * 60 * 1000; // 2分钟缓存
    this.syncInProgress = false;
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
  }

  // 初始化
  initialize() {
    // 监听认证状态变化
    if (this.authService) {
      this.authService.onAuthStateChanged((event) => {
        if (event.type === 'logout') {
          this.clearFavoritesCache();
        } else if (event.type === 'login') {
          // 登录后自动同步收藏
          this.syncFavorites().catch(console.error);
        }
      });
    }
  }

  // 获取收藏列表
  async getFavorites() {
    try {
      // 检查缓存
      if (this.isFavoritesCacheValid()) {
        return { 
          success: true, 
          favorites: this.favoritesCache,
          fromCache: true 
        };
      }

      // 如果用户未登录，返回空列表
      if (!this.authService?.isAuthenticated()) {
        return { 
          success: true, 
          favorites: [],
          message: '用户未登录' 
        };
      }

      const response = await this.apiClient.get('/api/user/favorites');

      if (response.success) {
        const favorites = this.validateFavorites(response.favorites || []);
        this.cacheFavorites(favorites);
        
        return { 
          success: true, 
          favorites,
          fromCache: false 
        };
      } else {
        throw new Error(response.message || '获取收藏列表失败');
      }
    } catch (error) {
      console.error('获取收藏列表失败:', error);
      return { 
        success: false, 
        favorites: [],
        error: error.message 
      };
    }
  }

  // 添加收藏
  async addFavorite(item) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!item || !item.title || !item.url) {
        throw new Error('收藏项目信息不完整');
      }

      // 验证收藏项目数据
      const validatedItem = this.validateFavoriteItem(item);

      const response = await this.apiClient.post('/api/user/favorites', {
        favorite: validatedItem
      });

      if (response.success) {
        // 更新缓存
        if (this.favoritesCache) {
          this.favoritesCache.unshift(validatedItem);
        }
        
        return { 
          success: true, 
          message: response.message || '添加收藏成功',
          favorite: validatedItem 
        };
      } else {
        throw new Error(response.message || '添加收藏失败');
      }
    } catch (error) {
      console.error('添加收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 删除收藏
  async removeFavorite(itemId) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!itemId) {
        throw new Error('收藏项目ID不能为空');
      }

      const response = await this.apiClient.delete(`/api/user/favorites/${itemId}`);

      if (response.success) {
        // 更新缓存
        if (this.favoritesCache) {
          this.favoritesCache = this.favoritesCache.filter(fav => fav.id !== itemId);
        }
        
        return { 
          success: true, 
          message: response.message || '删除收藏成功' 
        };
      } else {
        throw new Error(response.message || '删除收藏失败');
      }
    } catch (error) {
      console.error('删除收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 同步收藏（批量操作）
  async syncFavorites(favorites = null) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (this.syncInProgress) {
        return { 
          success: false, 
          error: '同步操作正在进行中' 
        };
      }

      this.syncInProgress = true;

      let favoritesToSync = favorites;
      
      // 如果没有提供收藏列表，获取本地收藏
      if (!favoritesToSync) {
        const { success, favorites: localFavorites } = await this.getFavorites();
        if (!success) {
          throw new Error('获取本地收藏失败');
        }
        favoritesToSync = localFavorites;
      }

      // 验证收藏数据
      const validFavorites = this.validateFavorites(favoritesToSync);

      const response = await this.apiClient.post('/api/user/favorites', {
        favorites: validFavorites
      });

      if (response.success) {
        // 更新缓存
        this.cacheFavorites(validFavorites);
        
        return { 
          success: true, 
          message: response.message || '收藏同步成功',
          syncedCount: validFavorites.length 
        };
      } else {
        throw new Error(response.message || '收藏同步失败');
      }
    } catch (error) {
      console.error('同步收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  // 按分类获取收藏
  async getFavoritesByCategory(category) {
    try {
      const { success, favorites } = await this.getFavorites();
      
      if (success) {
        const filteredFavorites = category === 'all' 
          ? favorites 
          : favorites.filter(fav => fav.category === category);
          
        return { 
          success: true, 
          favorites: filteredFavorites,
          category 
        };
      } else {
        throw new Error('获取收藏列表失败');
      }
    } catch (error) {
      console.error('按分类获取收藏失败:', error);
      return { 
        success: false, 
        favorites: [],
        error: error.message 
      };
    }
  }

  // 创建收藏分类
  async createCategory(categoryData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!categoryData || !categoryData.name) {
        throw new Error('分类名称不能为空');
      }

      const validatedCategory = {
        name: categoryData.name.trim(),
        description: categoryData.description?.trim() || '',
        color: categoryData.color || '#007bff',
        icon: categoryData.icon || '📁'
      };

      const response = await this.apiClient.post('/api/user/favorite-categories', {
        category: validatedCategory
      });

      if (response.success) {
        return { 
          success: true, 
          message: response.message || '分类创建成功',
          category: response.category 
        };
      } else {
        throw new Error(response.message || '创建分类失败');
      }
    } catch (error) {
      console.error('创建收藏分类失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取收藏分类列表
  async getCategories() {
    try {
      if (!this.authService?.isAuthenticated()) {
        return { 
          success: true, 
          categories: this.getDefaultCategories() 
        };
      }

      const response = await this.apiClient.get('/api/user/favorite-categories');

      if (response.success) {
        const categories = response.categories || this.getDefaultCategories();
        return { 
          success: true, 
          categories 
        };
      } else {
        throw new Error(response.message || '获取分类列表失败');
      }
    } catch (error) {
      console.error('获取收藏分类失败:', error);
      return { 
        success: false, 
        categories: this.getDefaultCategories(),
        error: error.message 
      };
    }
  }

  // 更新收藏项目
  async updateFavorite(itemId, updates) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!itemId) {
        throw new Error('收藏项目ID不能为空');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('更新数据不能为空');
      }

      const response = await this.apiClient.put(`/api/user/favorites/${itemId}`, {
        updates
      });

      if (response.success) {
        // 更新缓存
        if (this.favoritesCache) {
          const index = this.favoritesCache.findIndex(fav => fav.id === itemId);
          if (index !== -1) {
            this.favoritesCache[index] = { ...this.favoritesCache[index], ...updates };
          }
        }
        
        return { 
          success: true, 
          message: response.message || '收藏更新成功',
          favorite: response.favorite 
        };
      } else {
        throw new Error(response.message || '更新收藏失败');
      }
    } catch (error) {
      console.error('更新收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 搜索收藏
  searchFavorites(query, favorites = null) {
    try {
      const searchIn = favorites || this.favoritesCache || [];
      
      if (!query || query.trim().length === 0) {
        return searchIn;
      }

      const searchTerm = query.toLowerCase().trim();
      
      return searchIn.filter(favorite => {
        return (
          favorite.title?.toLowerCase().includes(searchTerm) ||
          favorite.description?.toLowerCase().includes(searchTerm) ||
          favorite.tags?.some(tag => tag.toLowerCase().includes(searchTerm)) ||
          favorite.category?.toLowerCase().includes(searchTerm)
        );
      });
    } catch (error) {
      console.error('搜索收藏失败:', error);
      return [];
    }
  }

  // 导出收藏
  async exportFavorites(format = 'json') {
    try {
      const { success, favorites } = await this.getFavorites();
      
      if (!success) {
        throw new Error('获取收藏列表失败');
      }

      const exportData = {
        favorites,
        exportTime: new Date().toISOString(),
        totalCount: favorites.length,
        version: '1.0'
      };

      switch (format.toLowerCase()) {
        case 'json':
          return {
            success: true,
            data: JSON.stringify(exportData, null, 2),
            filename: `favorites_${new Date().toISOString().split('T')[0]}.json`,
            mimeType: 'application/json'
          };
        
        case 'csv':
          const csvData = this.convertToCSV(favorites);
          return {
            success: true,
            data: csvData,
            filename: `favorites_${new Date().toISOString().split('T')[0]}.csv`,
            mimeType: 'text/csv'
          };
        
        default:
          throw new Error('不支持的导出格式');
      }
    } catch (error) {
      console.error('导出收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 导入收藏
  async importFavorites(data, format = 'json') {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      let favorites = [];

      switch (format.toLowerCase()) {
        case 'json':
          const jsonData = typeof data === 'string' ? JSON.parse(data) : data;
          favorites = jsonData.favorites || jsonData;
          break;
        
        case 'csv':
          favorites = this.parseCSV(data);
          break;
        
        default:
          throw new Error('不支持的导入格式');
      }

      const validFavorites = this.validateFavorites(favorites);
      
      const result = await this.syncFavorites(validFavorites);
      
      if (result.success) {
        return { 
          success: true, 
          message: `成功导入 ${validFavorites.length} 个收藏`,
          importedCount: validFavorites.length 
        };
      } else {
        throw new Error(result.error || '导入收藏失败');
      }
    } catch (error) {
      console.error('导入收藏失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 验证收藏数据
  validateFavorites(favorites) {
    if (!Array.isArray(favorites)) {
      return [];
    }

    return favorites.filter(fav => {
      return fav && fav.title && fav.url && 
             typeof fav.title === 'string' && 
             typeof fav.url === 'string';
    }).map(fav => this.validateFavoriteItem(fav));
  }

  // 验证单个收藏项目
  validateFavoriteItem(item) {
    return {
      id: item.id || this.generateId(),
      title: item.title.trim(),
      url: item.url.trim(),
      description: item.description?.trim() || '',
      category: item.category || 'default',
      tags: Array.isArray(item.tags) ? item.tags : [],
      addedAt: item.addedAt || Date.now(),
      favicon: item.favicon || null,
      screenshot: item.screenshot || null
    };
  }

  // 生成ID
  generateId() {
    return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取默认分类
  getDefaultCategories() {
    return [
      { id: 'default', name: '默认', color: '#007bff', icon: '📁' },
      { id: 'jav', name: 'JAV', color: '#e91e63', icon: '🎬' },
      { id: 'movie', name: '电影', color: '#ff9800', icon: '🎭' },
      { id: 'torrent', name: '种子', color: '#4caf50', icon: '🌱' },
      { id: 'other', name: '其他', color: '#9e9e9e', icon: '📂' }
    ];
  }

  // CSV转换
  convertToCSV(favorites) {
    const headers = ['Title', 'URL', 'Description', 'Category', 'Tags', 'Added Date'];
    const rows = favorites.map(fav => [
      fav.title,
      fav.url,
      fav.description || '',
      fav.category || '',
      Array.isArray(fav.tags) ? fav.tags.join(';') : '',
      new Date(fav.addedAt).toISOString()
    ]);

    return [headers, ...rows].map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  // CSV解析
  parseCSV(csvData) {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const favorites = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      
      if (values.length >= 2 && values[0] && values[1]) {
        favorites.push({
          title: values[0],
          url: values[1],
          description: values[2] || '',
          category: values[3] || 'default',
          tags: values[4] ? values[4].split(';') : [],
          addedAt: values[5] ? new Date(values[5]).getTime() : Date.now()
        });
      }
    }

    return favorites;
  }

  // 缓存管理
  cacheFavorites(favorites) {
    this.favoritesCache = favorites;
    this.cacheTimestamp = Date.now();
  }

  isFavoritesCacheValid() {
    return this.favoritesCache && 
           this.cacheTimestamp && 
           Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  clearFavoritesCache() {
    this.favoritesCache = null;
    this.cacheTimestamp = null;
  }

  // 获取收藏统计
  getFavoritesStats() {
    const favorites = this.favoritesCache || [];
    
    const stats = {
      total: favorites.length,
      byCategory: {},
      recentlyAdded: 0
    };

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    favorites.forEach(fav => {
      // 按分类统计
      const category = fav.category || 'default';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // 最近添加统计
      if (fav.addedAt && fav.addedAt > weekAgo) {
        stats.recentlyAdded++;
      }
    });

    return stats;
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      apiClientConnected: !!this.apiClient,
      authServiceConnected: !!this.authService,
      isAuthenticated: this.authService?.isAuthenticated() || false,
      cacheValid: this.isFavoritesCacheValid(),
      cacheSize: this.favoritesCache?.length || 0,
      syncInProgress: this.syncInProgress
    };
  }

  // 销毁服务
  destroy() {
    this.clearFavoritesCache();
    this.syncInProgress = false;
  }
}
export { UserFavoritesService };
export default UserFavoritesService;