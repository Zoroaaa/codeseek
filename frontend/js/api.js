// API调用模块 - 支持环境变量配置
class APIService {
    constructor() {
        this.baseURL = this.getAPIBaseURL();
        this.token = localStorage.getItem('auth_token');
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.consecutiveFailures = 0;
        this.connectionStatus = 'checking';
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

    // 关键修复：添加缺失的 getFullUrl 方法
    getFullUrl(path) {
        if (!path) return this.baseURL;
        
        // 如果已经是完整URL，直接返回
        if (path.startsWith('http://') || path.startsWith('https://')) {
            return path;
        }
        
        // 确保路径以 / 开头
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        
        // 移除baseURL末尾的斜杠（如果有）并拼接路径
        const baseUrl = this.baseURL.replace(/\/+$/, '');
        return `${baseUrl}${normalizedPath}`;
    }

    // 关键修复：添加缺失的 getHeaders 方法
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    // 修改request方法添加重试逻辑
    async request(url, options = {}) {
        const maxRetries = options.maxRetries || 3;
        const retryDelay = options.retryDelay || 1000;
        let lastError;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 安全检查 performanceMonitor
                if (window.performanceMonitor && window.performanceMonitor.start) {
                    window.performanceMonitor.start(`api-${url}`);
                }
                
                const response = await fetch(this.getFullUrl(url), {
                    headers: this.getHeaders(),
                    ...options
                });

                // 安全检查 performanceMonitor
                if (window.performanceMonitor && window.performanceMonitor.end) {
                    window.performanceMonitor.end(`api-${url}`);
                }

                // 检查响应状态
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    let errorMessage;
                    
                    try {
                        const errorData = JSON.parse(errorText);
                        errorMessage = errorData.error || errorData.message || 'Request failed';
                    } catch {
                        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    }

                    // 某些错误不应该重试
                    if (response.status === 401 || response.status === 403 || response.status === 404) {
                        throw new Error(errorMessage);
                    }

                    // 服务器错误可以重试
                    if (response.status >= 500 && attempt < maxRetries) {
                        console.warn(`API请求失败 (尝试 ${attempt}/${maxRetries}):`, errorMessage);
                        await this.delay(retryDelay * attempt);
                        continue;
                    }

                    throw new Error(errorMessage);
                }

                const data = await response.json();
                
                // 重置连接状态
                this.consecutiveFailures = 0;
                
                return data;

            } catch (error) {
                lastError = error;
                
                // 安全检查 performanceMonitor
                if (window.performanceMonitor && window.performanceMonitor.end) {
                    window.performanceMonitor.end(`api-${url}`);
                }
                
                this.consecutiveFailures = (this.consecutiveFailures || 0) + 1;

                if (attempt < maxRetries) {
                    console.warn(`API请求失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
                    await this.delay(retryDelay * attempt);
                } else {
                    // 更新连接状态
                    this.updateConnectionStatus('error');
                    
                    // 安全检查 errorBoundary
                    if (window.errorBoundary && window.errorBoundary.handleError) {
                        window.errorBoundary.handleError(error, `API Request: ${url}`);
                    } else {
                        console.error('API请求最终失败:', error);
                    }
                    throw error;
                }
            }
        }

        throw lastError;
    }

    // 延迟函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 连接状态管理
    updateConnectionStatus(status) {
        this.connectionStatus = status;
        
        // 触发状态更新事件
        if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('connectionStatusChanged', {
                detail: { status, failures: this.consecutiveFailures }
            }));
        }
    }

    // 智能重试配置
    getRetryConfig(operation) {
        const configs = {
            search: { maxRetries: 2, retryDelay: 500 },
            sync: { maxRetries: 3, retryDelay: 1000 },
            auth: { maxRetries: 1, retryDelay: 0 },
            upload: { maxRetries: 2, retryDelay: 2000 }
        };
        
        return configs[operation] || { maxRetries: 3, retryDelay: 1000 };
    }

    // 使用智能重试的包装方法
    async searchWithRetry(query, options = {}) {
        const retryConfig = this.getRetryConfig('search');
        return await this.request('/api/search', {
            method: 'POST',
            body: JSON.stringify({ query, ...options }),
            ...retryConfig
        });
    }

    async syncWithRetry(data) {
        const retryConfig = this.getRetryConfig('sync');
        return await this.request('/api/user/sync', {
            method: 'POST',
            body: JSON.stringify(data),
            ...retryConfig
        });
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

    // 统一的token验证方法
    async verifyToken(token) {
        if (!token) {
            // 如果没有传入token，使用当前实例的token
            token = this.token;
        }
        
        if (!token) {
            throw new Error('Token不能为空');
        }

        // 优先使用POST方式验证（支持body传token）
        try {
            return await this.request('/api/auth/verify', {
                method: 'POST',
                body: JSON.stringify({ token })
            });
        } catch (error) {
            // 如果POST失败，尝试GET方式（使用Authorization头）
            return await this.request('/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
        }
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
    
    async changePassword(currentPassword, newPassword) {
        return await this.request('/api/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ 
                currentPassword, 
                newPassword 
            })
        });
    }

    async getFavorites() {
        const response = await this.request('/api/user/favorites');
        return response.favorites || [];
    }

    // 修复搜索历史同步方法
    async syncSearchHistory(history) {
        try {
            // 统一数据格式，只使用query字段
            const validHistory = history.filter(item => {
                const query = item.query || item.keyword;
                return item && query && 
                       typeof query === 'string' && 
                       query.trim().length > 0;
            }).map(item => {
                const query = item.query || item.keyword;
                return {
                    id: item.id || this.generateId(),
                    query: query.trim(),                    // 统一使用query字段
                    source: item.source || 'unknown',
                    timestamp: item.timestamp || Date.now()
                };
            });

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

    // 修复保存单条搜索历史
    async saveSearchHistory(query, source = 'manual') {
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

    // 修复获取搜索历史方法
    async getSearchHistory() {
        try {
            const response = await this.request('/api/user/search-history');
            const history = response.history || response.searchHistory || [];
            
            // 确保返回的数据格式正确，统一使用query字段
            return history.filter(item => {
                const query = item.query || item.keyword;
                return item && query && typeof query === 'string';
            }).map(item => ({
                id: item.id,
                query: item.query || item.keyword,      // 统一字段
                keyword: item.query || item.keyword,    // 保持兼容性
                source: item.source,
                timestamp: item.timestamp,
                createdAt: item.createdAt
            }));
        } catch (error) {
            console.error('获取搜索历史失败:', error);
            return [];
        }
    }

    // 添加工具方法
    generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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