/** Optimized api.js — generated 2025-08-16 14:58:31 UTC. Behavior preserved; style normalized. */
'use strict';

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
\1        // 开发环境检测
        const isDev = window.location.hostname === 'localhost' ||\1                     window.location.hostname === '127.0.0.1';
\1        if (isDev) {
            return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
        }
\1        // 生产环境默认值（需要在页面中配置）
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
\1                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return await response.json();
                    }
                    return await response.text();
                }
\1                if (response.status === 401) {
                    this.setToken(null);
                    throw new Error('认证失败，请重新登录');
                }
\1                const errorText = await response.text().catch(() => '');
                let errorMessage = `HTTP ${response.status}`;
\1                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    if (errorText) errorMessage += `: ${errorText}`;
                }
\1                throw new Error(errorMessage);
\1            } catch (error) {
                lastError = error;
\1                if (error.name === 'TypeError' && attempt < this.maxRetries - 1) {
                    await this.delay(this.retryDelay * (attempt + 1));
                    continue;
                }
                break;
            }
        }
\1        console.error(`API请求失败 (${endpoint}):`, lastError);
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
\1        if (response.success && response.token) {
            this.setToken(response.token);
        }
\1        return response;
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
\1	async changePassword(currentPassword, newPassword) {
    return await this.request('/api/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify({\1            currentPassword,\1            newPassword\1        })
    });
}

    async getFavorites() {
        const response = await this.request('/api/user/favorites');
        return response.favorites || [];
    }

// 修复搜索历史同步方法
async syncSearchHistory(history) {
    try {
        // 确保数据格式正确
        const validHistory = history.filter(item => {
            return item && (item.query || item.keyword) &&\1                   typeof (item.query || item.keyword) === 'string' &&\1                   (item.query || item.keyword).trim().length > 0;
        }).map(item => ({
            id: item.id || generateId(),
            query: item.query || item.keyword,
            keyword: item.query || item.keyword, // 兼容性
            source: item.source || 'unknown',
            timestamp: item.timestamp || Date.now()
        }));

        return await this.request('/api/user/sync/search-history', {
            method: 'POST',
            body: JSON.stringify({\1                searchHistory: validHistory,
                history: validHistory // 兼容性
            })
        });
    } catch (error) {
        console.error('同步搜索历史失败:', error);
        throw error;
    }
}

// 修复保存单条搜索历史
async saveSearchHistory(query, source = 'unknown') {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        throw new Error('搜索关键词不能为空');
    }

    return await this.request('/api/user/search-history', {
        method: 'POST',
        body: JSON.stringify({\1            query: query.trim(),\1            source: source,
            timestamp: Date.now()\1        })
    });
}

// 修复获取搜索历史方法
async getSearchHistory() {
    try {
        const response = await this.request('/api/user/search-history');
        const history = response.history || response.searchHistory || [];
\1        // 确保返回的数据格式正确
        return history.filter(item => {
            return item && (item.query || item.keyword) &&\1                   typeof (item.query || item.keyword) === 'string';
        }).map(item => ({
            ...item,
            keyword: item.keyword || item.query,
            query: item.query || item.keyword
        }));
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
       return await this.request('/api/actions/record', {
       method: 'POST',
       body: JSON.stringify({ action, data })
       });
    } catch (e) { console.error('记录行为失败:', e); }
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
