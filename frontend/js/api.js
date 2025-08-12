// API模块 - 修复版本
class APIManager {
    constructor() {
        this.baseURL = '';
        this.retryCount = 3;
        this.retryDelay = 1000;
    }

    // 初始化
    init() {
        if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
            this.baseURL = window.API_CONFIG.BASE_URL;
            console.log('✅ API初始化完成:', this.baseURL);
        } else {
            console.error('❌ API_CONFIG未配置');
        }
    }

    // 获取请求头
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        const token = localStorage.getItem('auth_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        return headers;
    }

    // 基础请求方法
    async request(endpoint, options = {}) {
        if (!this.baseURL) {
            this.init();
        }

        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.getHeaders(),
            ...options
        };

        for (let attempt = 0; attempt < this.retryCount; attempt++) {
            try {
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    if (response.status === 401) {
                        localStorage.removeItem('auth_token');
                        throw new Error('认证失败，请重新登录');
                    }
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error(`请求失败 (${attempt + 1}/${this.retryCount}):`, error);
                
                if (attempt === this.retryCount - 1) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            }
        }
    }

    // GET请求
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    // POST请求
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT请求
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE请求
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // 健康检查
    async healthCheck() {
        try {
            const response = await this.get('/api/health');
            return response;
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    // 验证Token
    async verifyToken(token) {
        try {
            return await this.post('/api/auth/verify', { token });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 获取收藏夹
    async getFavorites() {
        try {
            return await this.get('/api/favorites');
        } catch (error) {
            console.error('获取收藏失败:', error);
            return [];
        }
    }

    // 添加收藏
    async addFavorite(favorite) {
        try {
            return await this.post('/api/favorites', favorite);
        } catch (error) {
            console.error('添加收藏失败:', error);
            throw error;
        }
    }

    // 删除收藏
    async removeFavorite(favoriteId) {
        try {
            return await this.delete(`/api/favorites/${favoriteId}`);
        } catch (error) {
            console.error('删除收藏失败:', error);
            throw error;
        }
    }

    // 同步收藏
    async syncFavorites(favorites) {
        try {
            return await this.post('/api/favorites/sync', { favorites });
        } catch (error) {
            console.error('同步收藏失败:', error);
            throw error;
        }
    }

    // 获取搜索历史
    async getSearchHistory() {
        try {
            return await this.get('/api/history');
        } catch (error) {
            console.error('获取历史失败:', error);
            return [];
        }
    }

    // 添加搜索记录
    async addSearchRecord(keyword, results) {
        try {
            return await this.post('/api/history', { 
                keyword, 
                results, 
                timestamp: Date.now() 
            });
        } catch (error) {
            console.error('添加搜索记录失败:', error);
            // 不抛出错误，允许静默失败
        }
    }

    // 同步搜索历史
    async syncSearchHistory(history) {
        try {
            return await this.post('/api/history/sync', { history });
        } catch (error) {
            console.error('同步历史失败:', error);
            throw error;
        }
    }

    // 记录用户行为（可选功能）
    async recordAction(action, data) {
        try {
            return await this.post('/api/actions', { 
                action, 
                data, 
                timestamp: Date.now() 
            });
        } catch (error) {
            console.error('记录行为失败:', error);
            // 静默失败，不影响主功能
        }
    }

    // 增强搜索（如果后端支持）
    async searchEnhanced(keyword, sources) {
        try {
            return await this.post('/api/search/enhanced', { keyword, sources });
        } catch (error) {
            console.error('增强搜索失败:', error);
            throw error;
        }
    }

    // 获取用户设置
    async getUserSettings() {
        try {
            return await this.get('/api/settings');
        } catch (error) {
            console.error('获取设置失败:', error);
            return {};
        }
    }

    // 更新用户设置
    async updateUserSettings(settings) {
        try {
            return await this.put('/api/settings', settings);
        } catch (error) {
            console.error('更新设置失败:', error);
            throw error;
        }
    }

    // 获取系统配置
    async getConfig() {
        try {
            return await this.get('/api/config');
        } catch (error) {
            console.error('获取配置失败:', error);
            return {};
        }
    }
}

// 创建全局API实例
window.API = new APIManager();
