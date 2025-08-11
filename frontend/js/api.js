// API调用模块 - 优化版本
// 修复CORS、错误处理、重试机制等问题
class APIService {
    constructor() {
        // 根据环境设置API基础URL
        this.baseURL = this.getAPIBaseURL();
        this.token = localStorage.getItem('auth_token');
        this.requestQueue = [];
        this.isRefreshing = false;
        this.maxRetries = 3;
        this.retryDelay = 1000;
    }

    // 获取API基础URL
    getAPIBaseURL() {
        // 从环境变量或页面配置获取API URL
        if (window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        
        // 本地开发环境检测
        const isLocalDev = location.hostname === 'localhost' || 
                          location.hostname === '127.0.0.1' || 
                          location.hostname.includes('.local');
        
        if (isLocalDev) {
            return 'http://localhost:8787'; // 本地开发
        }
        
        // 生产环境 - 请替换为你的实际Worker URL
        return 'https://your-worker.your-subdomain.workers.dev';
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

    // 通用请求方法 - 增强版
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

        // 重试机制
        let lastError;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const response = await fetch(url, config);
                
                // 处理成功响应
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        return await response.json();
                    } else {
                        return await response.text();
                    }
                }
                
                // 处理特定错误状态码
                if (response.status === 401) {
                    // Token过期，尝试刷新
                    if (this.token && !this.isRefreshing) {
                        const refreshResult = await this.handleTokenRefresh();
                        if (refreshResult) {
                            // 更新headers中的token并重试
                            headers['Authorization'] = `Bearer ${this.token}`;
                            config.headers = headers;
                            continue;
                        }
                    }
                    
                    // 刷新失败，清除token
                    this.setToken(null);
                    throw new Error('认证失败，请重新登录');
                }
                
                if (response.status === 404) {
                    throw new Error('请求的资源不存在');
                }
                
                if (response.status === 500) {
                    throw new Error('服务器内部错误');
                }
                
                // 尝试解析错误信息
                const errorText = await response.text();
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
                
                // 网络错误或超时，可以重试
                if (error.name === 'TypeError' || error.name === 'AbortError') {
                    if (attempt < this.maxRetries - 1) {
                        console.warn(`请求失败，${this.retryDelay}ms后重试 (${attempt + 1}/${this.maxRetries})`, error.message);
                        await this.delay(this.retryDelay * (attempt + 1));
                        continue;
                    }
                }
                
                // 其他错误直接抛出
                break;
            }
        }
        
        console.error(`API请求失败 (${endpoint}):`, lastError);
        throw lastError;
    }

    // 延时函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 处理token刷新
    async handleTokenRefresh() {
        if (this.isRefreshing) {
            // 等待刷新完成
            return new Promise((resolve) => {
                this.requestQueue.push(resolve);
            });
        }
        
        this.isRefreshing = true;
        
        try {
            const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.token) {
                    this.setToken(result.token);
                    
                    // 处理等待队列
                    this.requestQueue.forEach(resolve => resolve(true));
                    this.requestQueue = [];
                    
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('刷新token失败:', error);
            return false;
        } finally {
            this.isRefreshing = false;
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

    // 获取系统配置
    async getConfig() {
        try {
            const response = await this.request('/api/config');
            return response;
        } catch (error) {
            console.error('获取系统配置失败:', error);
            return {};
        }
    }

    // 数据库初始化（仅管理员）
    async initDatabase(adminToken) {
        try {
            const response = await this.request('/api/admin/init-db', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${adminToken}`
                }
            });
            return response;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }
}

// API连接测试器
class APIConnectionTester {
    constructor(apiService) {
        this.api = apiService;
    }

    // 测试API连接
    async testConnection() {
        const results = {
            baseURL: this.api.baseURL,
            timestamp: new Date().toISOString(),
            tests: []
        };

        // 测试健康检查端点
        try {
            const start = performance.now();
            const health = await this.api.healthCheck();
            const duration = performance.now() - start;
            
            results.tests.push({
                name: '健康检查',
                endpoint: '/api/health',
                status: health.status === 'healthy' ? 'success' : 'error',
                duration: Math.round(duration),
                response: health
            });
        } catch (error) {
            results.tests.push({
                name: '健康检查',
                endpoint: '/api/health',
                status: 'error',
                error: error.message
            });
        }

        // 测试配置获取
        try {
            const start = performance.now();
            const config = await this.api.getConfig();
            const duration = performance.now() - start;
            
            results.tests.push({
                name: '系统配置',
                endpoint: '/api/config',
                status: config ? 'success' : 'error',
                duration: Math.round(duration),
                response: config
            });
        } catch (error) {
            results.tests.push({
                name: '系统配置',
                endpoint: '/api/config',
                status: 'error',
                error: error.message
            });
        }

        // 测试CORS
        try {
            const response = await fetch(this.api.baseURL + '/api/health', {
                method: 'OPTIONS'
            });
            
            results.tests.push({
                name: 'CORS预检',
                endpoint: '/api/health',
                status: response.ok ? 'success' : 'error',
                headers: {
                    'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                    'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                    'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
                }
            });
        } catch (error) {
            results.tests.push({
                name: 'CORS预检',
                endpoint: '/api/health',
                status: 'error',
                error: error.message
            });
        }

        return results;
    }

    // 显示测试结果
    displayResults(results) {
        console.group('🔍 API连接测试结果');
        console.log(`🌐 API地址: ${results.baseURL}`);
        console.log(`⏰ 测试时间: ${results.timestamp}`);
        
        results.tests.forEach(test => {
            const icon = test.status === 'success' ? '✅' : '❌';
            console.log(`${icon} ${test.name} (${test.endpoint})`);
            
            if (test.duration) {
                console.log(`   ⏱️ 响应时间: ${test.duration}ms`);
            }
            
            if (test.error) {
                console.error(`   ❗ 错误: ${test.error}`);
            }
            
            if (test.response) {
                console.log(`   📄 响应:`, test.response);
            }
            
            if (test.headers) {
                console.log(`   📋 CORS头:`, test.headers);
            }
        });
        
        const successCount = results.tests.filter(t => t.status === 'success').length;
        const totalCount = results.tests.length;
        
        console.log(`\n📊 测试结果: ${successCount}/${totalCount} 通过`);
        console.groupEnd();
        
        return { success: successCount === totalCount, results };
    }
}

// 创建全局API实例
const API = new APIService();

// 创建连接测试器
const APITester = new APIConnectionTester(API);

// 全局错误处理
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
        console.warn('检测到认证失败，可能需要重新登录');
        // 可以在这里触发重新登录流程
    }
});

// 导出到全局作用域
window.API = API;
window.APITester = APITester;

// 开发环境下自动测试连接
if (window.location.hostname === 'localhost' || window.location.hostname.includes('.local')) {
    // 延迟执行以确保DOM加载完成
    setTimeout(async () => {
        console.log('🔧 开发模式：自动测试API连接...');
        try {
            const results = await APITester.testConnection();
            APITester.displayResults(results);
        } catch (error) {
            console.error('❌ API连接测试失败:', error);
        }
    }, 1000);
}