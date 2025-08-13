// API调用模块 - 完整版本
(function() {
    'use strict';

    class APIService {
        constructor() {
            this.baseURL = this.getAPIBaseURL();
            this.token = localStorage.getItem('auth_token');
            this.currentUserId = null;
            this.maxRetries = 3;
            this.retryDelay = 1000;
        }

        // 获取当前用户ID
        getCurrentUserId() {
            if (this.currentUserId) return this.currentUserId;
            
            const userData = StorageManager.getItem('current_user');
            if (userData && userData.id) {
                this.currentUserId = userData.id;
                return userData.id;
            }
            return null;
        }

        setToken(token) {
            this.token = token;
            if (token) {
                localStorage.setItem('auth_token', token);
            } else {
                localStorage.removeItem('auth_token');
                this.currentUserId = null;
            }
        }

        // 通用请求方法
        async request(endpoint, options = {}) {
            const url = `${this.baseURL}${endpoint}`;
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const config = {
                method: 'GET',
                credentials: 'omit',
                ...options,
                headers
            };

            let lastError;
            for (let attempt = 0; attempt < this.maxRetries; attempt++) {
                try {
                    const response = await fetch(url, config);
                    
                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('application/json')) {
                            return await response.json();
                        }
                        return await response.text();
                    }
                    
                    if (response.status === 401) {
                        this.setToken(null);
                        throw new Error('认证失败，请重新登录');
                    }
                    
                    if (response.status === 403) {
                        throw new Error('无权访问此数据');
                    }
                    
                    const errorText = await response.text().catch(() => '');
                    let errorMessage = `HTTP ${response.status}`;
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) {
                        if (errorText) errorMessage += `: ${errorText}`;
                    }
                    
                    throw new Error(errorMessage);
                    
                } catch (error) {
                    lastError = error;
                    
                    if (error.name === 'TypeError' && attempt < this.maxRetries - 1) {
                        await this.delay(this.retryDelay * (attempt + 1));
                        continue;
                    }
                    break;
                }
            }
            
            console.error(`API请求失败 (${endpoint}):`, lastError);
            throw lastError;
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // 用户注册
        async register(username, email, password) {
            return await this.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
            });
        }

        // 用户登录
        async login(username, password) {
            const response = await this.request('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            if (response.success && response.token) {
                this.setToken(response.token);
                if (response.user && response.user.id) {
                    this.currentUserId = response.user.id;
                }
            }
            
            return response;
        }

        // Token验证
        async verifyToken(token) {
            // 使用GET方式的验证接口
            return await this.request('/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }

        // 退出登录
        async logout() {
            try {
                await this.request('/api/auth/logout', { method: 'POST' });
            } catch (error) {
                console.error('退出登录失败:', error);
            } finally {
                this.setToken(null);
                this.currentUserId = null;
            }
        }

        // 收藏夹操作
        async syncFavorites(favorites) {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法同步收藏');
            }
            
            return await this.request('/api/user/favorites', {
                method: 'POST',
                body: JSON.stringify({ favorites })
            });
        }

        async getFavorites() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法获取收藏');
            }
            
            const response = await this.request('/api/user/favorites');
            return response.favorites || [];
        }

        // 搜索历史操作
        async syncSearchHistory(history) {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法同步搜索历史');
            }

            try {
                // 确保数据格式正确，后端需要query字段
                const validHistory = history.filter(item => {
                    return item && (item.query || item.keyword) && 
                           typeof (item.query || item.keyword) === 'string' && 
                           (item.query || item.keyword).trim().length > 0;
                }).map(item => ({
                    id: item.id || this.generateId(),
                    query: item.query || item.keyword, // 后端主要使用query字段
                    keyword: item.query || item.keyword, // 保持兼容性
                    source: item.source || 'unknown',
                    timestamp: item.timestamp || Date.now()
                }));

                return await this.request('/api/user/sync/search-history', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        searchHistory: validHistory
                    })
                });
            } catch (error) {
                console.error('同步搜索历史失败:', error);
                throw error;
            }
        }

        // 保存单条搜索历史
        async saveSearchHistory(query, source = 'unknown') {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法保存搜索历史');
            }

            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                throw new Error('搜索关键词不能为空');
            }

            return await this.request('/api/user/search-history', {
                method: 'POST',
                body: JSON.stringify({ 
                    query: query.trim(), 
                    source: source,
                    timestamp: Date.now()
                })
            });
        }

        // 获取搜索历史
        async getSearchHistory() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法获取搜索历史');
            }

            try {
                const response = await this.request('/api/user/search-history');
                const history = response.history || response.searchHistory || [];
                
                // 确保返回的数据格式正确，后端返回的是query字段
                return history.map(item => ({
                    ...item,
                    keyword: item.keyword || item.query, // 前端主要使用keyword
                    query: item.query || item.keyword
                }));
            } catch (error) {
                console.error('获取搜索历史失败:', error);
                return [];
            }
        }

        // 获取搜索统计
        async getSearchStats() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法获取统计');
            }

            try {
                return await this.request('/api/user/search-stats');
            } catch (error) {
                console.error('获取搜索统计失败:', error);
                return {
                    total: 0,
                    today: 0,
                    thisWeek: 0,
                    topQueries: []
                };
            }
        }

        // 删除单条搜索历史
        async deleteSearchHistory(historyId) {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录');
            }

            return await this.request(`/api/user/search-history/${historyId}`, {
                method: 'DELETE'
            });
        }

        // 清空搜索历史
        async clearSearchHistory() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录');
            }

            return await this.request('/api/user/search-history', {
                method: 'DELETE'
            });
        }

        // 用户设置操作
        async getUserSettings() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法获取设置');
            }

            try {
                const response = await this.request('/api/user/settings');
                return response.settings || {};
            } catch (error) {
                console.error('获取用户设置失败:', error);
                // 返回默认设置
                return {
                    autoSync: true,
                    enableCache: true,
                    themeMode: 'auto',
                    historyRetention: '90',
                    maxFavorites: '500',
                    allowAnalytics: true,
                    searchSuggestions: true
                };
            }
        }

        async updateUserSettings(settings) {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录，无法更新设置');
            }

            return await this.request('/api/user/settings', {
                method: 'PUT',
                body: JSON.stringify({ settings })
            });
        }

        // 记录用户行为
        async recordAction(action, data) {
            try {
                // 使用后端的analytics/record接口
                return await this.request('/api/analytics/record', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        event: action, // 后端使用event字段
                        data: data || {}, 
                        timestamp: Date.now()
                    })
                });
            } catch (error) {
                console.error('记录行为失败:', error);
                // 静默失败，不影响用户体验
                return { success: false };
            }
        }

        // 获取用户分析统计
        async getAnalyticsStats(days = 30) {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录');
            }

            try {
                return await this.request(`/api/analytics/stats?days=${days}`);
            } catch (error) {
                console.error('获取分析统计失败:', error);
                return {
                    eventStats: [],
                    dailyStats: [],
                    totalEvents: 0
                };
            }
        }

        // 获取用户概览
        async getUserOverview() {
            const userId = this.getCurrentUserId();
            if (!userId) {
                throw new Error('用户未登录');
            }

            try {
                return await this.request('/api/user/overview');
            } catch (error) {
                console.error('获取用户概览失败:', error);
                return {
                    favorites: 0,
                    searchHistory: 0,
                    totalActions: 0,
                    daysSinceRegistration: 0,
                    userLevel: '新手'
                };
            }
        }

        // 搜索接口
        async search(query, options = {}) {
            if (!query || typeof query !== 'string') {
                throw new Error('搜索关键词不能为空');
            }

            const searchParams = new URLSearchParams({
                q: query.trim(),
                page: options.page || 1,
                size: options.size || 20,
                sort: options.sort || 'seeders',
                category: options.category || 'all'
            });

            // 这里暂时返回模拟数据，实际应该调用真实的搜索API
            await this.delay(1000); // 模拟网络延迟
            
            return {
                success: true,
                results: this.generateMockResults(query, options),
                total: 100,
                page: parseInt(options.page) || 1,
                hasMore: true
            };
        }

        // 生成模拟搜索结果（实际项目中应该删除）
        generateMockResults(query, options = {}) {
            const results = [];
            const count = parseInt(options.size) || 20;
            
            for (let i = 0; i < count; i++) {
                results.push({
                    id: this.generateId(),
                    title: `${query} - 搜索结果 ${i + 1}`,
                    subtitle: `高清版本 - 完整资源包`,
                    url: `magnet:?xt=urn:btih:${this.generateId()}&dn=${encodeURIComponent(query)}`,
                    size: formatFileSize(Math.random() * 10000000000),
                    seeders: Math.floor(Math.random() * 1000),
                    leechers: Math.floor(Math.random() * 100),
                    date: new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
                    category: options.category || 'movie',
                    icon: '🎬',
                    source: 'MockAPI',
                    keyword: query
                });
            }
            
            return results;
        }

        // 工具方法
        generateId() {
            return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        async getConfig() {
            try {
                return await this.request('/api/config');
            } catch (error) {
                console.error('获取配置失败:', error);
                return {
                    allowRegistration: true,
                    minUsernameLength: 3,
                    maxUsernameLength: 20,
                    minPasswordLength: 6,
                    maxFavoritesPerUser: 1000,
                    maxHistoryPerUser: 1000,
                    version: '1.0.0'
                };
            }
        }

        async healthCheck() {
            try {
                const response = await this.request('/api/health');
                return response || { status: 'healthy' };
            } catch (error) {
                return { status: 'error', message: error.message };
            }
        }

        // 系统状态检查
        async getSystemStatus() {
            try {
                return await this.request('/api/system/status');
            } catch (error) {
                console.error('获取系统状态失败:', error);
                return { status: 'error', message: error.message };
            }
        }

        // 从环境变量或配置获取API基础URL
        getAPIBaseURL() {
            if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
                return window.API_CONFIG.BASE_URL;
            }
            
            const isDev = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
            
            if (isDev) {
                return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
            }
            
            return window.API_CONFIG?.PROD_URL || 'https://codeseek.zadi.workers.dev';
        }

        // 测试连接
        async testConnection() {
            try {
                const startTime = Date.now();
                await this.healthCheck();
                const endTime = Date.now();
                
                return {
                    success: true,
                    latency: endTime - startTime,
                    timestamp: Date.now()
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        }

        // 批量操作
        async batchRequest(requests) {
            const results = [];
            
            for (const req of requests) {
                try {
                    const result = await this.request(req.endpoint, req.options);
                    results.push({ success: true, data: result });
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            
            return results;
        }
    }

    // 创建全局API实例
    const API = new APIService();
    window.API = API;

    console.log('✅ API服务已加载完成');

})();
