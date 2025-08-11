// API调用模块
class APIService {
    constructor() {
        // 根据环境设置API基础URL
        this.baseURL = this.getAPIBaseURL();
        this.token = localStorage.getItem('auth_token');
    }

    // 获取API基础URL
    getAPIBaseURL() {
        // 生产环境使用你的Cloudflare Worker URL
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
            return 'http://localhost:8787'; // 本地开发
        }
        return 'https://codeseek.zadi.workers.dev/'; // 替换为你的Worker URL
    }

    // 设置认证token
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
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
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token过期，清除本地token
                    this.setToken(null);
                    throw new Error('认证失败，请重新登录');
                }
                
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error(`API请求失败 (${endpoint}):`, error);
            throw error;
        }
    }

    // 用户认证相关API
    async register(username, email, password) {
        const response = await this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        return response;
    }

    async login(username, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    async verifyToken(token) {
        const response = await this.request('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response;
    }

    async logout() {
        try {
            await this.request('/api/auth/logout', {
                method: 'POST'
            });
        } catch (error) {
            console.error('退出登录失败:', error);
        } finally {
            this.setToken(null);
        }
    }

    // 用户数据同步API
    async syncFavorites(favorites) {
        const response = await this.request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ favorites })
        });
        return response;
    }

    async getFavorites() {
        const response = await this.request('/api/user/favorites');
        return response.favorites || [];
    }

    async syncSearchHistory(history) {
        const response = await this.request('/api/user/search-history', {
            method: 'POST',
            body: JSON.stringify({ history })
        });
        return response;
    }

    async getSearchHistory() {
        const response = await this.request('/api/user/search-history');
        return response.history || [];
    }

    // 搜索相关API
    async searchEnhanced(keyword, basicResults) {
        try {
            const response = await this.request('/api/search/enhanced', {
                method: 'POST',
                body: JSON.stringify({ keyword, basicResults })
            });
            return response.results;
        } catch (error) {
            console.error('增强搜索失败:', error);
            return basicResults; // 降级到基础搜索结果
        }
    }

    async getSearchStats() {
        const response = await this.request('/api/search/stats');
        return response;
    }

    async addSearchRecord(keyword, results) {
        try {
            await this.request('/api/search/record', {
                method: 'POST',
                body: JSON.stringify({ keyword, results, timestamp: Date.now() })
            });
        } catch (error) {
            console.error('记录搜索失败:', error);
        }
    }

    // 用户设置API
    async updateUserSettings(settings) {
        const response = await this.request('/api/user/settings', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        return response;
    }

    async getUserSettings() {
        const response = await this.request('/api/user/settings');
        return response.settings || {};
    }

    // 站点信息API
    async getSiteInfo() {
        const response = await this.request('/api/sites/info');
        return response;
    }

    async checkSiteStatus(urls) {
        const response = await this.request('/api/sites/status', {
            method: 'POST',
            body: JSON.stringify({ urls })
        });
        return response;
    }

    // 缓存管理API
    async getCachedSearch(keyword) {
        try {
            const response = await this.request(`/api/cache/search?keyword=${encodeURIComponent(keyword)}`);
            return response;
        } catch (error) {
            return null;
        }
    }

    async setCachedSearch(keyword, results, ttl = 1800) {
        try {
            await this.request('/api/cache/search', {
                method: 'POST',
                body: JSON.stringify({ keyword, results, ttl })
            });
        } catch (error) {
            console.error('缓存搜索结果失败:', error);
        }
    }

    // 统计API
    async getStats() {
        const response = await this.request('/api/stats');
        return response;
    }

    async recordAction(action, data) {
        try {
            await this.request('/api/stats/action', {
                method: 'POST',
                body: JSON.stringify({ action, data, timestamp: Date.now() })
            });
        } catch (error) {
            console.error('记录用户行为失败:', error);
        }
    }

    // 反馈API
    async submitFeedback(feedback) {
        const response = await this.request('/api/feedback', {
            method: 'POST',
            body: JSON.stringify(feedback)
        });
        return response;
    }

    // 健康检查
    async healthCheck() {
        try {
            const response = await this.request('/api/health');
            return response;
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }
}

// 创建全局API实例
const API = new APIService();