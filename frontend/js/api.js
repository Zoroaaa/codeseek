// API调用模块
class APIService {
    constructor() {
        // 从全局配置获取API URL
        this.baseURL = window.APP_CONFIG.API_BASE_URL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }
    
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const requestId = utils.generateRequestId();
        
        const headers = {
            ...this.defaultHeaders,
            ...(options.headers || {}),
            'X-Request-ID': requestId
        };
        
        if (options.authToken) {
            headers['Authorization'] = `Bearer ${options.authToken}`;
        }
        
        const config = {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                // 处理错误
                const errorMessage = data?.message || `请求失败: ${response.status} ${response.statusText}`;
                throw new Error(errorMessage);
            }
            
            return {
                success: true,
                ...data
            };
        } catch (error) {
            console.error(`API请求错误: ${url}`, error);
            return {
                success: false,
                message: error.message
            };
        }
    }
    
    // 用户认证
    async register(username, email, password) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: { username, email, password }
        });
    }
    
    async login(username, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: { username, password }
        });
    }
    
    async verifyToken(token) {
        return this.request('/api/auth/verify', {
            method: 'GET',
            authToken: token
        });
    }
    
    async refreshToken(token) {
        return this.request('/api/auth/refresh', {
            method: 'POST',
            authToken: token
        });
    }
    
    async logout(token) {
        return this.request('/api/auth/logout', {
            method: 'POST',
            authToken: token
        });
    }
    
    // 用户数据
    async getFavorites(token) {
        return this.request('/api/user/favorites', {
            method: 'GET',
            authToken: token
        });
    }
    
    async syncFavorites(token, favorites) {
        return this.request('/api/user/favorites', {
            method: 'POST',
            authToken: token,
            body: { favorites }
        });
    }
    
    async addFavorite(token, favorite) {
        return this.request('/api/user/favorites/add', {
            method: 'POST',
            authToken: token,
            body: { favorite }
        });
    }
    
    async removeFavorite(token, favoriteId) {
        return this.request('/api/user/favorites/remove', {
            method: 'POST',
            authToken: token,
            body: { favoriteId }
        });
    }
    
    // 搜索功能
    async search(keyword, token = null) {
        const endpoint = `/api/search?q=${encodeURIComponent(keyword)}`;
        return this.request(endpoint, {
            method: 'GET',
            authToken: token
        });
    }
    
    // 获取系统配置
    async getConfig() {
        return this.request('/api/config', {
            method: 'GET'
        });
    }
    
    // 获取监控状态
    async getMonitoring() {
        return this.request('/api/monitoring', {
            method: 'GET'
        });
    }
}

// 创建API服务实例
const API = new APIService();

// 环境检测
if (!window.APP_CONFIG?.API_BASE_URL) {
    console.error('API_BASE_URL未配置');
    // 可以显示错误提示
}