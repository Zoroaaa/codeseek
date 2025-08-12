// API调用模块 - 完全优化版本
// 增强错误处理、重试机制、缓存管理等功能

class APIService {
    constructor() {
        this.baseURL = this.getAPIBaseURL();
        this.token = localStorage.getItem('auth_token');
        this.requestQueue = new Map();
        this.isRefreshing = false;
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            backoffMultiplier: 2
        };
        this.cache = new Map();
        this.cacheConfig = {
            defaultTTL: 5 * 60 * 1000, // 5分钟
            maxSize: 100
        };
        
        // 初始化
        this.setupInterceptors();
        this.startCacheCleanup();
    }

    // 获取API基础URL - 支持环境变量配置
    getAPIBaseURL() {
        // 优先级：环境变量 > 页面配置 > 自动检测
        if (window.CLOUDFLARE_API_URL) {
            return window.CLOUDFLARE_API_URL;
        }
        
        if (window.API_BASE_URL) {
            return window.API_BASE_URL;
        }
        
        // 根据当前域名自动推断
        const hostname = window.location.hostname;
        
        // 本地开发环境
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.local')) {
            return 'http://localhost:8787';
        }
        
        // 生产环境 - 需要在Cloudflare Pages中设置环境变量
        return `https://${window.WORKER_SUBDOMAIN || 'your-worker'}.${window.WORKER_DOMAIN || 'your-subdomain.workers.dev'}`;
    }

    // 设置请求拦截器
    setupInterceptors() {
        // 定期清理过期的队列请求
        setInterval(() => {
            const now = Date.now();
            for (const [key, request] of this.requestQueue) {
                if (now - request.timestamp > 30000) { // 30秒超时
                    request.reject(new Error('请求超时'));
                    this.requestQueue.delete(key);
                }
            }
        }, 10000);
    }

    // 启动缓存清理
    startCacheCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, item] of this.cache) {
                if (now > item.expiry) {
                    this.cache.delete(key);
                }
            }
            
            // 限制缓存大小
            if (this.cache.size > this.cacheConfig.maxSize) {
                const entries = Array.from(this.cache.entries());
                const sorted = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
                const toRemove = sorted.slice(0, this.cache.size - this.cacheConfig.maxSize);
                toRemove.forEach(([key]) => this.cache.delete(key));
            }
        }, 60000); // 每分钟清理一次
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

    // 缓存管理
    getCacheKey(url, options) {
        const method = options.method || 'GET';
        const body = options.body || '';
        return `${method}:${url}:${this.hashString(body)}`;
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    setCache(key, data, ttl = this.cacheConfig.defaultTTL) {
        this.cache.set(key, {
            data,
            expiry: Date.now() + ttl,
            lastAccessed: Date.now()
        });
    }

    getCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        item.lastAccessed = Date.now();
        return item.data;
    }

    // 通用请求方法 - 完全增强版
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
                ...options.headers
            },
            ...options
        };

        // 添加认证头
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        // 检查缓存（仅GET请求）
        if (config.method === 'GET' && !options.skipCache) {
            const cacheKey = this.getCacheKey(url, config);
            const cached = this.getCache(cacheKey);
            if (cached) {
                return cached;
            }
        }

        // 请求去重
        const requestKey = `${config.method}:${url}:${config.body || ''}`;
        if (this.requestQueue.has(requestKey)) {
            return this.requestQueue.get(requestKey).promise;
        }

        // 创建请求Promise
        const requestPromise = this.executeRequest(url, config, requestKey);
        
        // 添加到队列
        let resolveQueue, rejectQueue;
        const queuePromise = new Promise((resolve, reject) => {
            resolveQueue = resolve;
            rejectQueue = reject;
        });
        
        this.requestQueue.set(requestKey, {
            promise: queuePromise,
            resolve: resolveQueue,
            reject: rejectQueue,
            timestamp: Date.now()
        });

        try {
            const result = await requestPromise;
            
            // 缓存GET请求结果
            if (config.method === 'GET' && !options.skipCache) {
                const cacheKey = this.getCacheKey(url, config);
                this.setCache(cacheKey, result, options.cacheTTL);
            }
            
            resolveQueue(result);
            return result;
        } catch (error) {
            rejectQueue(error);
            throw error;
        } finally {
            this.requestQueue.delete(requestKey);
        }
    }

    // 执行实际请求
    async executeRequest(url, config, requestKey) {
        let lastError;
        
        for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
            try {
                // 添加超时控制
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                config.signal = controller.signal;
                
                const response = await fetch(url, config);
                clearTimeout(timeoutId);
                
                // 处理响应
                if (response.ok) {
                    const contentType = response.headers.get('content-type');
                    
                    if (contentType?.includes('application/json')) {
                        const data = await response.json();
                        
                        // 统一响应格式处理
                        if (data.success !== undefined) {
                            if (!data.success && data.message) {
                                throw new Error(data.message);
                            }
                            return data;
                        }
                        
                        return { success: true, ...data };
                    } else {
                        const text = await response.text();
                        return { success: true, data: text };
                    }
                }
                
                // 处理错误状态码
                if (response.status === 401) {
                    return await this.handleUnauthorized();
                }
                
                if (response.status === 429) {
                    // 速率限制，等待后重试
                    const retryAfter = response.headers.get('retry-after') || '60';
                    await this.delay(parseInt(retryAfter) * 1000);
                    continue;
                }
                
                // 解析错误响应
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch {
                    errorMessage = await response.text() || errorMessage;
                }
                
                throw new Error(errorMessage);
                
            } catch (error) {
                lastError = error;
                
                // 不重试的错误类型
                if (error.name === 'AbortError') {
                    throw new Error('请求超时');
                }
                
                if (error.message.includes('401') || error.message.includes('认证失败')) {
                    throw error;
                }
                
                // 计算重试延迟
                if (attempt < this.retryConfig.maxRetries - 1) {
                    const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
                    console.warn(`请求失败，${delay}ms后重试 (${attempt + 1}/${this.retryConfig.maxRetries})`, error.message);
                    await this.delay(delay);
                    continue;
                }
            }
        }
        
        console.error(`API请求失败 (${url}):`, lastError);
        throw lastError;
    }

    // 处理401未授权
    async handleUnauthorized() {
        if (!this.token) {
            throw new Error('请先登录');
        }
        
        if (this.isRefreshing) {
            // 等待刷新完成
            return new Promise((resolve, reject) => {
                const checkRefresh = () => {
                    if (!this.isRefreshing) {
                        if (this.token) {
                            resolve({ success: false, message: '请重新请求' });
                        } else {
                            reject(new Error('认证失败，请重新登录'));
                        }
                    } else {
                        setTimeout(checkRefresh, 100);
                    }
                };
                checkRefresh();
            });
        }
        
        // 尝试刷新token
        const refreshResult = await this.refreshToken();
        if (refreshResult) {
            throw new Error('请重新请求'); // 让调用者重试
        } else {
            this.setToken(null);
            throw new Error('认证失败，请重新登录');
        }
    }

    // 刷新token
    async refreshToken() {
        if (this.isRefreshing) return false;
        
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

    // 延时函数
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== API方法 ==========

    // 用户认证相关
    async register(username, email, password) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password }),
            skipCache: true
        });
    }

    async login(username, password) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
            skipCache: true
        });
        
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }

    async verifyToken(token = this.token) {
        return this.request('/api/auth/verify', {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            cacheTTL: 60000 // 1分钟缓存
        });
    }

    async logout() {
        try {
            await this.request('/api/auth/logout', {
                method: 'POST',
                skipCache: true
            });
        } catch (error) {
            console.error('退出登录失败:', error);
        } finally {
            this.setToken(null);
            this.cache.clear(); // 清空缓存
        }
    }

    // 用户数据管理
    async syncFavorites(favorites) {
        return this.request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify({ favorites }),
            skipCache: true
        });
    }

    async getFavorites() {
        const response = await this.request('/api/user/favorites', {
            cacheTTL: 30000 // 30秒缓存
        });
        return response.favorites || [];
    }

    async addFavorite(favorite) {
        return this.request('/api/user/favorites', {
            method: 'POST',
            body: JSON.stringify(favorite),
            skipCache: true
        });
    }

    async removeFavorite(favoriteId) {
        return this.request(`/api/user/favorites/${favoriteId}`, {
            method: 'DELETE',
            skipCache: true
        });
    }

    async updateFavorite(favoriteId, updates) {
        return this.request(`/api/user/favorites/${favoriteId}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
            skipCache: true
        });
    }

    // 搜索历史
    async getSearchHistory() {
        const response = await this.request('/api/user/search-history', {
            cacheTTL: 60000 // 1分钟缓存
        });
        return response.history || [];
    }

    async addSearchRecord(keyword, results = []) {
        return this.request('/api/search/record', {
            method: 'POST',
            body: JSON.stringify({ 
                keyword, 
                results: Array.isArray(results) ? results : [],
                timestamp: Date.now() 
            }),
            skipCache: true
        });
    }

    async clearSearchHistory() {
        return this.request('/api/user/search-history', {
            method: 'DELETE',
            skipCache: true
        });
    }

    // 用户设置
    async getUserSettings() {
        const response = await this.request('/api/user/settings', {
            cacheTTL: 300000 // 5分钟缓存
        });
        return response.settings || {};
    }

    async updateUserSettings(settings) {
        return this.request('/api/user/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
            skipCache: true
        });
    }

    // 用户统计
    async getUserStats() {
        return this.request('/api/user/stats', {
            cacheTTL: 60000 // 1分钟缓存
        });
    }

    async getDetailedStats(timeRange = '30') {
        return this.request(`/api/user/stats/detailed?range=${timeRange}`, {
            cacheTTL: 120000 // 2分钟缓存
        });
    }

    // 系统相关
    async getConfig() {
        return this.request('/api/config', {
            cacheTTL: 600000 // 10分钟缓存
        });
    }

    async healthCheck() {
        return this.request('/api/health', {
            cacheTTL: 30000 // 30秒缓存
        });
    }

    // 搜索增强
    async searchEnhanced(keyword, basicResults = []) {
        try {
            const response = await this.request('/api/search/enhanced', {
                method: 'POST',
                body: JSON.stringify({ keyword, basicResults }),
                cacheTTL: 300000 // 5分钟缓存
            });
            return response.results || basicResults;
        } catch (error) {
            console.error('增强搜索失败:', error);
            return basicResults;
        }
    }

    // 缓存管理
    async getCachedSearch(keyword) {
        try {
            const response = await this.request(`/api/cache/search?keyword=${encodeURIComponent(keyword)}`, {
                cacheTTL: 0 // 不缓存缓存查询
            });
            return response.results || null;
        } catch {
            return null;
        }
    }

    async setCachedSearch(keyword, results, ttl = 1800) {
        try {
            await this.request('/api/cache/search', {
                method: 'POST',
                body: JSON.stringify({ keyword, results, ttl }),
                skipCache: true
            });
        } catch (error) {
            console.error('缓存搜索结果失败:', error);
        }
    }

    // 行为记录
    async recordAction(action, data = {}) {
        try {
            return this.request('/api/stats/action', {
                method: 'POST',
                body: JSON.stringify({ 
                    action, 
                    data, 
                    timestamp: Date.now(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                }),
                skipCache: true
            });
        } catch (error) {
            console.error('记录用户行为失败:', error);
        }
    }

    // 反馈系统
    async submitFeedback(feedback) {
        return this.request('/api/feedback', {
            method: 'POST',
            body: JSON.stringify({
                ...feedback,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                url: window.location.href
            }),
            skipCache: true
        });
    }

    async getFeedbackList() {
        return this.request('/api/feedback', {
            cacheTTL: 120000 // 2分钟缓存
        });
    }

    // 管理员功能
    async initDatabase(adminToken) {
        return this.request('/api/admin/init-db', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            skipCache: true
        });
    }

    async getSystemStats(adminToken) {
        return this.request('/api/admin/stats', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            },
            cacheTTL: 60000 // 1分钟缓存
        });
    }

    // 工具方法
    clearCache() {
        this.cache.clear();
    }

    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheConfig.maxSize,
            entries: Array.from(this.cache.keys())
        };
    }

    getConnectionStatus() {
        return {
            baseURL: this.baseURL,
            hasToken: !!this.token,
            isRefreshing: this.isRefreshing,
            queueSize: this.requestQueue.size,
            cacheSize: this.cache.size
        };
    }
}

// API连接测试器 - 增强版
class APIConnectionTester {
    constructor(apiService) {
        this.api = apiService;
        this.testResults = new Map();
    }

    async testConnection() {
        const results = {
            baseURL: this.api.baseURL,
            timestamp: new Date().toISOString(),
            tests: [],
            summary: {}
        };

        const tests = [
            { name: '健康检查', method: this.testHealth.bind(this) },
            { name: '系统配置', method: this.testConfig.bind(this) },
            { name: 'CORS支持', method: this.testCORS.bind(this) },
            { name: '响应时间', method: this.testLatency.bind(this) },
            { name: '错误处理', method: this.testErrorHandling.bind(this) }
        ];

        for (const test of tests) {
            try {
                const result = await test.method();
                results.tests.push({ name: test.name, ...result });
            } catch (error) {
                results.tests.push({
                    name: test.name,
                    status: 'error',
                    error: error.message
                });
            }
        }

        // 生成摘要
        const successCount = results.tests.filter(t => t.status === 'success').length;
        const totalCount = results.tests.length;
        
        results.summary = {
            success: successCount === totalCount,
            successRate: (successCount / totalCount * 100).toFixed(1),
            totalTests: totalCount,
            passedTests: successCount,
            failedTests: totalCount - successCount
        };

        this.testResults.set('latest', results);
        return results;
    }

    async testHealth() {
        const start = performance.now();
        const response = await this.api.healthCheck();
        const duration = Math.round(performance.now() - start);
        
        if (response && (response.status === 'healthy' || response.success)) {
            return {
                status: 'success',
                duration,
                response: response
            };
        } else {
            return {
                status: 'error',
                duration,
                error: '健康检查失败'
            };
        }
    }
    async testConfig() {
        const start = performance.now();
        const response = await this.api.getConfig();
        const duration = Math.round(performance.now() - start);
        
        if (response && typeof response === 'object') {
            return {
                status: 'success',
                duration,
                response: response
            };
        } else {
            return {
                status: 'error',
                duration,
                error: '配置获取失败'
            };
        }
    }

    async testCORS() {
        try {
            const response = await fetch(this.api.baseURL + '/api/health', {
                method: 'OPTIONS'
            });
            
            const corsHeaders = {
                'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
            };
            
            const hasValidCORS = corsHeaders['Access-Control-Allow-Origin'] && 
                                corsHeaders['Access-Control-Allow-Methods'];
            
            return {
                status: hasValidCORS ? 'success' : 'error',
                headers: corsHeaders,
                error: hasValidCORS ? null : 'CORS头缺失'
            };
        } catch (error) {
            return {
                status: 'error',
                error: `CORS测试失败: ${error.message}`
            };
        }
    }

    async testLatency() {
        const tests = [];
        
        for (let i = 0; i < 3; i++) {
            const start = performance.now();
            try {
                await this.api.healthCheck();
                tests.push(performance.now() - start);
            } catch (error) {
                tests.push(-1);
            }
        }
        
        const validTests = tests.filter(t => t > 0);
        if (validTests.length === 0) {
            return {
                status: 'error',
                error: '所有延迟测试都失败了'
            };
        }
        
        const avgLatency = Math.round(validTests.reduce((a, b) => a + b, 0) / validTests.length);
        const minLatency = Math.round(Math.min(...validTests));
        const maxLatency = Math.round(Math.max(...validTests));
        
        return {
            status: avgLatency < 5000 ? 'success' : 'warning',
            duration: avgLatency,
            details: {
                average: avgLatency,
                min: minLatency,
                max: maxLatency,
                tests: validTests.length
            }
        };
    }

    async testErrorHandling() {
        try {
            // 测试404错误
            await fetch(this.api.baseURL + '/api/nonexistent', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            return {
                status: 'error',
                error: '错误处理测试失败 - 应该返回404'
            };
        } catch (error) {
            // 期望的错误
            return {
                status: 'success',
                message: '错误处理正常'
            };
        }
    }

    displayResults(results) {
        console.group('🔍 API连接测试结果');
        console.log(`🌐 API地址: ${results.baseURL}`);
        console.log(`⏰ 测试时间: ${results.timestamp}`);
        
        // 显示摘要
        const { summary } = results;
        const summaryIcon = summary.success ? '✅' : '⚠️';
        console.log(`${summaryIcon} 测试摘要: ${summary.passedTests}/${summary.totalTests} 通过 (${summary.successRate}%)`);
        
        // 显示各项测试结果
        results.tests.forEach(test => {
            const icon = test.status === 'success' ? '✅' : 
                        test.status === 'warning' ? '⚠️' : '❌';
            console.log(`${icon} ${test.name}`);
            
            if (test.duration) {
                console.log(`   ⏱️ 响应时间: ${test.duration}ms`);
            }
            
            if (test.error) {
                console.error(`   ❗ 错误: ${test.error}`);
            }
            
            if (test.details) {
                console.log(`   📊 详情:`, test.details);
            }
            
            if (test.response && typeof test.response === 'object') {
                console.log(`   📄 响应:`, test.response);
            }
            
            if (test.headers) {
                console.log(`   📋 头信息:`, test.headers);
            }
        });
        
        console.groupEnd();
        return { success: summary.success, results };
    }

    getHistory() {
        return Array.from(this.testResults.entries());
    }

    getLatestResults() {
        return this.testResults.get('latest');
    }
}

// 创建全局API实例
const API = new APIService();

// 创建连接测试器
const APITester = new APIConnectionTester(API);

// 全局错误处理
window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && event.reason.message) {
        if (event.reason.message.includes('认证失败') || event.reason.message.includes('请重新登录')) {
            console.warn('检测到认证失败，清除本地凭证');
            API.setToken(null);
            
            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('authError', {
                detail: { message: event.reason.message }
            }));
        }
    }
});

// 网络状态监控
function setupNetworkMonitoring() {
    let isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
        if (!isOnline) {
            isOnline = true;
            console.log('🌐 网络已恢复');
            
            // 清除缓存以获取最新数据
            API.clearCache();
            
            // 触发网络恢复事件
            window.dispatchEvent(new CustomEvent('networkRestore'));
        }
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        console.warn('🚫 网络连接中断');
        
        // 触发网络中断事件
        window.dispatchEvent(new CustomEvent('networkLost'));
    });
}

// API性能监控
class APIPerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.isMonitoring = false;
    }

    startMonitoring() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        
        // 拦截API请求进行监控
        const originalRequest = API.request.bind(API);
        
        API.request = async (endpoint, options = {}) => {
            const startTime = performance.now();
            const method = options.method || 'GET';
            const key = `${method} ${endpoint}`;
            
            try {
                const result = await originalRequest(endpoint, options);
                const duration = performance.now() - startTime;
                
                this.recordMetric(key, {
                    success: true,
                    duration,
                    timestamp: Date.now(),
                    size: JSON.stringify(result).length
                });
                
                return result;
            } catch (error) {
                const duration = performance.now() - startTime;
                
                this.recordMetric(key, {
                    success: false,
                    duration,
                    timestamp: Date.now(),
                    error: error.message
                });
                
                throw error;
            }
        };
    }

    recordMetric(key, metric) {
        if (!this.metrics.has(key)) {
            this.metrics.set(key, []);
        }
        
        const metrics = this.metrics.get(key);
        metrics.push(metric);
        
        // 保留最近100次记录
        if (metrics.length > 100) {
            metrics.shift();
        }
    }

    getMetrics(endpoint = null) {
        if (endpoint) {
            return this.metrics.get(endpoint) || [];
        }
        
        const summary = {};
        for (const [key, metrics] of this.metrics) {
            const successful = metrics.filter(m => m.success);
            const failed = metrics.filter(m => !m.success);
            const durations = successful.map(m => m.duration);
            
            summary[key] = {
                total: metrics.length,
                successful: successful.length,
                failed: failed.length,
                successRate: (successful.length / metrics.length * 100).toFixed(1),
                avgDuration: durations.length > 0 ? 
                    Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
                minDuration: durations.length > 0 ? Math.round(Math.min(...durations)) : 0,
                maxDuration: durations.length > 0 ? Math.round(Math.max(...durations)) : 0
            };
        }
        
        return summary;
    }

    clearMetrics() {
        this.metrics.clear();
    }
}

// 初始化监控
setupNetworkMonitoring();
const performanceMonitor = new APIPerformanceMonitor();

// 导出到全局作用域
window.API = API;
window.APITester = APITester;
window.APIPerformanceMonitor = performanceMonitor;

// 开发环境自动测试
if (process.env.NODE_ENV === 'development' || window.location.hostname.includes('localhost')) {
    setTimeout(async () => {
        console.log('🔧 开发模式：自动测试API连接...');
        try {
            const results = await APITester.testConnection();
            APITester.displayResults(results);
            
            if (!results.summary.success) {
                console.warn('⚠️ API连接存在问题，请检查配置');
            }
        } catch (error) {
            console.error('❌ API连接测试失败:', error);
        }
    }, 1000);
    
    // 启用性能监控
    performanceMonitor.startMonitoring();
}

// 导出类供其他模块使用
export { APIService, APIConnectionTester, APIPerformanceMonitor };
