// src/services/user/user-history-service.js
// 用户历史记录服务 - 从api.js拆分的历史记录相关功能

export class UserHistoryService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.historyCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = 3 * 60 * 1000; // 3分钟缓存
    this.maxLocalHistory = 1000;
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
          this.clearHistoryCache();
        } else if (event.type === 'login') {
          // 登录后自动同步历史记录
          this.syncLocalHistory().catch(console.error);
        }
      });
    }
  }

  // 获取搜索历史
  async getSearchHistory(options = {}) {
    try {
      // 检查缓存
      if (this.isHistoryCacheValid() && !options.forceRefresh) {
        return { 
          success: true, 
          history: this.applyHistoryFilters(this.historyCache, options),
          fromCache: true 
        };
      }

      // 如果用户未登录，返回本地历史
      if (!this.authService?.isAuthenticated()) {
        const localHistory = this.getLocalHistory();
        return { 
          success: true, 
          history: this.applyHistoryFilters(localHistory, options),
          fromCache: false,
          source: 'local'
        };
      }

      const response = await this.apiClient.get('/api/user/search-history');

      if (response.success) {
        const history = this.validateHistory(response.history || response.searchHistory || []);
        this.cacheHistory(history);
        
        return { 
          success: true, 
          history: this.applyHistoryFilters(history, options),
          fromCache: false,
          source: 'server'
        };
      } else {
        throw new Error(response.message || '获取搜索历史失败');
      }
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      
      // 降级到本地历史
      const localHistory = this.getLocalHistory();
      return { 
        success: false, 
        history: this.applyHistoryFilters(localHistory, options),
        error: error.message,
        source: 'local'
      };
    }
  }

  // 添加到历史记录
  async addToHistory(query, source = 'manual', metadata = {}) {
    try {
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
      }

      const historyItem = {
        id: this.generateId(),
        query: query.trim(),
        keyword: query.trim(), // 兼容性字段
        source,
        timestamp: Date.now(),
        createdAt: Date.now(),
        metadata: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          ...metadata
        }
      };

      // 添加到本地历史
      this.addToLocalHistory(historyItem);

      // 如果用户已登录，同步到服务器
      if (this.authService?.isAuthenticated()) {
        try {
          const response = await this.apiClient.post('/api/user/search-history', {
            query: historyItem.query,
            source: historyItem.source,
            timestamp: historyItem.timestamp
          });

          if (response.success) {
            // 更新缓存
            if (this.historyCache) {
              this.historyCache.unshift(historyItem);
              // 限制缓存大小
              if (this.historyCache.length > this.maxLocalHistory) {
                this.historyCache = this.historyCache.slice(0, this.maxLocalHistory);
              }
            }
          }
        } catch (syncError) {
          console.warn('同步历史记录到服务器失败:', syncError);
          // 不影响本地添加操作
        }
      }

      return { 
        success: true, 
        message: '已添加到搜索历史',
        historyItem 
      };
    } catch (error) {
      console.error('添加历史记录失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 删除历史记录项
  async deleteHistoryItem(historyId) {
    try {
      if (!historyId) {
        throw new Error('历史记录ID不能为空');
      }

      // 从本地历史删除
      this.removeFromLocalHistory(historyId);

      // 如果用户已登录，从服务器删除
      if (this.authService?.isAuthenticated()) {
        try {
          const response = await this.apiClient.delete(`/api/user/search-history/${historyId}`);
          
          if (response.success) {
            // 更新缓存
            if (this.historyCache) {
              this.historyCache = this.historyCache.filter(item => 
                item.id !== historyId && item.historyId !== historyId
              );
            }
          }
        } catch (syncError) {
          console.warn('从服务器删除历史记录失败:', syncError);
        }
      }

      return { 
        success: true, 
        message: '历史记录已删除' 
      };
    } catch (error) {
      console.error('删除历史记录失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 清空所有历史记录
  async clearAllHistory() {
    try {
      // 清空本地历史
      this.clearLocalHistory();

      // 如果用户已登录，清空服务器历史
      if (this.authService?.isAuthenticated()) {
        try {
          const response = await this.apiClient.delete('/api/user/search-history?operation=clear');
          
          if (response.success) {
            // 清空缓存
            this.clearHistoryCache();
          }
        } catch (syncError) {
          console.warn('清空服务器历史记录失败:', syncError);
        }
      }

      return { 
        success: true, 
        message: '所有历史记录已清空' 
      };
    } catch (error) {
      console.error('清空历史记录失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取搜索统计
  async getSearchStats() {
    try {
      // 如果用户未登录，使用本地统计
      if (!this.authService?.isAuthenticated()) {
        const localStats = this.getLocalSearchStats();
        return { success: true, stats: localStats };
      }

      const response = await this.apiClient.get('/api/user/search-stats');

      if (response.success) {
        return { 
          success: true, 
          stats: response.stats || this.getDefaultStats() 
        };
      } else {
        throw new Error(response.message || '获取搜索统计失败');
      }
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      
      // 降级到本地统计
      const localStats = this.getLocalSearchStats();
      return { 
        success: false, 
        stats: localStats,
        error: error.message 
      };
    }
  }

  // 获取热门查询
  async getTopQueries(limit = 10) {
    try {
      const { success, history } = await this.getSearchHistory();
      
      if (success) {
        const queryCount = {};
        
        history.forEach(item => {
          const query = item.query || item.keyword;
          if (query) {
            queryCount[query] = (queryCount[query] || 0) + 1;
          }
        });

        const topQueries = Object.entries(queryCount)
          .sort(([,a], [,b]) => b - a)
          .slice(0, limit)
          .map(([query, count]) => ({ query, count }));

        return { 
          success: true, 
          topQueries 
        };
      } else {
        throw new Error('获取历史记录失败');
      }
    } catch (error) {
      console.error('获取热门查询失败:', error);
      return { 
        success: false, 
        topQueries: [],
        error: error.message 
      };
    }
  }

  // 搜索历史记录
  searchHistory(query, history = null) {
    try {
      const searchIn = history || this.historyCache || this.getLocalHistory();
      
      if (!query || query.trim().length === 0) {
        return searchIn;
      }

      const searchTerm = query.toLowerCase().trim();
      
      return searchIn.filter(item => {
        const itemQuery = item.query || item.keyword || '';
        return itemQuery.toLowerCase().includes(searchTerm);
      });
    } catch (error) {
      console.error('搜索历史记录失败:', error);
      return [];
    }
  }

  // 同步本地历史到服务器
  async syncLocalHistory() {
    try {
      if (!this.authService?.isAuthenticated()) {
        return { success: false, error: '用户未登录' };
      }

      const localHistory = this.getLocalHistory();
      
      if (localHistory.length === 0) {
        return { success: true, message: '没有本地历史需要同步' };
      }

      // 批量上传本地历史
      const syncPromises = localHistory.map(item => 
        this.apiClient.post('/api/user/search-history', {
          query: item.query || item.keyword,
          source: item.source || 'local',
          timestamp: item.timestamp || item.createdAt || Date.now()
        }).catch(error => ({ error: error.message, item }))
      );

      const results = await Promise.allSettled(syncPromises);
      
      const successful = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
      const failed = results.length - successful;

      // 清空缓存以强制重新获取
      this.clearHistoryCache();

      return { 
        success: successful > 0, 
        message: `同步完成：成功 ${successful}，失败 ${failed}`,
        syncedCount: successful,
        failedCount: failed
      };
    } catch (error) {
      console.error('同步本地历史失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 本地历史管理
  getLocalHistory() {
    try {
      const stored = localStorage.getItem('searchHistory');
      if (stored) {
        const history = JSON.parse(stored);
        return this.validateHistory(history);
      }
    } catch (error) {
      console.error('读取本地历史失败:', error);
    }
    return [];
  }

  addToLocalHistory(item) {
    try {
      let history = this.getLocalHistory();
      
      // 检查重复（基于查询内容和时间）
      const duplicate = history.find(h => 
        (h.query || h.keyword) === item.query && 
        Math.abs((h.timestamp || h.createdAt) - item.timestamp) < 60000 // 1分钟内
      );
      
      if (!duplicate) {
        history.unshift(item);
        
        // 限制本地历史大小
        if (history.length > this.maxLocalHistory) {
          history = history.slice(0, this.maxLocalHistory);
        }
        
        localStorage.setItem('searchHistory', JSON.stringify(history));
      }
    } catch (error) {
      console.error('添加本地历史失败:', error);
    }
  }

  removeFromLocalHistory(historyId) {
    try {
      const history = this.getLocalHistory();
      const filteredHistory = history.filter(item => 
        item.id !== historyId && item.historyId !== historyId
      );
      
      localStorage.setItem('searchHistory', JSON.stringify(filteredHistory));
    } catch (error) {
      console.error('删除本地历史失败:', error);
    }
  }

  clearLocalHistory() {
    try {
      localStorage.removeItem('searchHistory');
    } catch (error) {
      console.error('清空本地历史失败:', error);
    }
  }

  // 本地搜索统计
  getLocalSearchStats() {
    const history = this.getLocalHistory();
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;

    return {
      total: history.length,
      today: history.filter(item => (item.timestamp || item.createdAt) >= todayStart).length,
      thisWeek: history.filter(item => (item.timestamp || item.createdAt) >= weekStart).length,
      topQueries: this.getTopQueriesFromHistory(history, 5)
    };
  }

  getTopQueriesFromHistory(history, limit = 5) {
    const queryCount = {};
    
    history.forEach(item => {
      const query = item.query || item.keyword;
      if (query) {
        queryCount[query] = (queryCount[query] || 0) + 1;
      }
    });

    return Object.entries(queryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  // 数据验证和处理
  validateHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }

    return history.filter(item => {
      if (!item) return false;
      
      const searchTerm = item.keyword || item.query;
      if (!searchTerm || typeof searchTerm !== 'string') {
        return false;
      }
      
      return true;
    }).map(item => ({
      id: item.id || item.historyId || this.generateId(),
      query: item.query || item.keyword,
      keyword: item.keyword || item.query, // 兼容性
      source: item.source || 'unknown',
      timestamp: item.timestamp || item.createdAt || Date.now(),
      createdAt: item.createdAt || item.timestamp || Date.now()
    }));
  }

  applyHistoryFilters(history, options = {}) {
    let filtered = [...history];

    // 按源过滤
    if (options.source && options.source !== 'all') {
      filtered = filtered.filter(item => item.source === options.source);
    }

    // 按时间范围过滤
    if (options.timeRange) {
      const now = Date.now();
      let startTime;
      
      switch (options.timeRange) {
        case 'today':
          startTime = new Date().setHours(0, 0, 0, 0);
          break;
        case 'week':
          startTime = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case 'month':
          startTime = now - 30 * 24 * 60 * 60 * 1000;
          break;
        default:
          startTime = 0;
      }
      
      filtered = filtered.filter(item => 
        (item.timestamp || item.createdAt) >= startTime
      );
    }

    // 排序
    const sortBy = options.sortBy || 'timestamp';
    const sortOrder = options.sortOrder || 'desc';
    
    filtered.sort((a, b) => {
      const aVal = a[sortBy] || a.timestamp || a.createdAt || 0;
      const bVal = b[sortBy] || b.timestamp || b.createdAt || 0;
      
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    // 分页
    if (options.limit) {
      const offset = options.offset || 0;
      filtered = filtered.slice(offset, offset + options.limit);
    }

    return filtered;
  }

  generateId() {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getDefaultStats() {
    return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
  }

  // 缓存管理
  cacheHistory(history) {
    this.historyCache = history;
    this.cacheTimestamp = Date.now();
  }

  isHistoryCacheValid() {
    return this.historyCache && 
           this.cacheTimestamp && 
           Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  clearHistoryCache() {
    this.historyCache = null;
    this.cacheTimestamp = null;
  }

  // 导出历史记录
  async exportHistory(format = 'json') {
    try {
      const { success, history } = await this.getSearchHistory();
      
      if (!success) {
        throw new Error('获取历史记录失败');
      }

      const exportData = {
        history,
        exportTime: new Date().toISOString(),
        totalCount: history.length,
        version: '1.0'
      };

      switch (format.toLowerCase()) {
        case 'json':
          return {
            success: true,
            data: JSON.stringify(exportData, null, 2),
            filename: `search_history_${new Date().toISOString().split('T')[0]}.json`,
            mimeType: 'application/json'
          };
        
        case 'csv':
          const csvData = this.convertHistoryToCSV(history);
          return {
            success: true,
            data: csvData,
            filename: `search_history_${new Date().toISOString().split('T')[0]}.csv`,
            mimeType: 'text/csv'
          };
        
        default:
          throw new Error('不支持的导出格式');
      }
    } catch (error) {
      console.error('导出历史记录失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  convertHistoryToCSV(history) {
    const headers = ['Query', 'Source', 'Timestamp', 'Date'];
    const rows = history.map(item => [
      item.query || item.keyword,
      item.source || 'unknown',
      item.timestamp || item.createdAt || '',
      new Date(item.timestamp || item.createdAt).toISOString()
    ]);

    return [headers, ...rows].map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
  }

  // 获取历史统计
  getHistoryStats() {
    const history = this.historyCache || this.getLocalHistory();
    
    return {
      total: history.length,
      cacheSize: this.historyCache?.length || 0,
      localSize: this.getLocalHistory().length,
      cacheValid: this.isHistoryCacheValid()
    };
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      apiClientConnected: !!this.apiClient,
      authServiceConnected: !!this.authService,
      isAuthenticated: this.authService?.isAuthenticated() || false,
      cacheValid: this.isHistoryCacheValid(),
      cacheSize: this.historyCache?.length || 0,
      localHistorySize: this.getLocalHistory().length
    };
  }

  // 销毁服务
  destroy() {
    this.clearHistoryCache();
  }
}
export { UserHistoryService };
export default UserHistoryService;