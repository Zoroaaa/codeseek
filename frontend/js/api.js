// API调用模块 - 支持环境变量配置
class APIService {
    constructor() {
        this.baseURL = this.getAPIBaseURL();
        this.token = localStorage.getItem('auth_token');
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    // 从环境变量或配置获取API基础URL
    getAPIBaseURL() {
        // 优先级：window配置 > 环境变量 > 默认值
        if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
            return window.API_CONFIG.BASE_URL;
        }
        
        // 开发环境检测
        const isDev = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
        
        if (isDev) {
            return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
        }
        
        // 生产环境默认值（需要在页面中配置）
        return window.API_CONFIG?.PROD_URL || 'https://codeseek.zadi.workers.dev';
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

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
            credentials: 'omit', // 不发送cookies，避免CORS问题
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

    // API方法
    async register(username, email, password) {
        return await this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
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
        return await this.request('/api/auth/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
    }

    async logout() {
        try {
            await this.request('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('退出登录失败:', error);
        } finally {
            this.setToken(null);
        }
    }

    async syncFavorites(favorites) {
        return await this.request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ favorites })
        });
    }

    async getFavorites() {
        const response = await this.request('/api/user/favorites');
        return response.favorites || [];
    }

    async syncSearchHistory(history) {
        return await this.request('/api/user/search-history', {
            method: 'POST',
            body: JSON.stringify({ history })
        });
    }

    async getSearchHistory() {
        try {
            const response = await this.request('/api/user/search-history');
            return response.history || [];
        } catch (error) {
            console.error('获取搜索历史失败:', error);
            return [];
        }
    }

    async getUserSettings() {
        try {
            const response = await this.request('/api/user/settings');
            return response.settings || {};
        } catch (error) {
            console.error('获取用户设置失败:', error);
            return {};
        }
    }

    async updateUserSettings(settings) {
        return await this.request('/api/user/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings })
        });
    }


    async recordAction(action, data) {
        try {
            return await this.request('/api/analytics/record', {
                method: 'POST',
                body: JSON.stringify({ action, data, timestamp: Date.now() })
            });
        } catch (error) {
            console.error('记录行为失败:', error);
        }
    }

    async getConfig() {
        try {
            return await this.request('/api/config');
        } catch (error) {
            console.error('获取配置失败:', error);
            return {};
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
}

// 创建全局API实例
const API = new APIService();
window.API = API;