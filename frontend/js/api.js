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
	
	    // 添加请求签名
    const timestamp = Date.now();
    const signature = await this.generateRequestSignature(endpoint, options, timestamp);
    
    const headers = {
      'X-Request-Timestamp': timestamp,
      'X-Request-Signature': signature,
      ...options.headers
    };
	
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
            // 网络状态检查
            if (!navigator.onLine) {
                throw new Error('网络连接不可用');
            }
            
            const response = await fetch(url, config);
            
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }
                return await response.text();
            }
            
            // 401错误特殊处理
            if (response.status === 401) {
                this.setToken(null);
                throw new Error('认证失败，请重新登录');
            }
            
            // 5xx错误可以重试
            if (response.status >= 500 && attempt < this.maxRetries - 1) {
                await this.delay(this.retryDelay * (attempt + 1));
                continue;
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
            
            // 网络错误可以重试
            if ((error.name === 'TypeError' || error.message.includes('fetch')) && 
                attempt < this.maxRetries - 1) {
                await this.delay(this.retryDelay * (attempt + 1));
                continue;
            }
            break;
        }
    }
    
    console.error(`API请求失败 (${endpoint}):`, lastError);
    throw lastError;
}

  async generateRequestSignature(endpoint, options, timestamp) {
    // 简化的签名生成逻辑
    const payload = JSON.stringify(options.body || {});
    const stringToSign = `${endpoint}|${options.method}|${timestamp}|${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(this.token),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC', key, encoder.encode(stringToSign)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
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
	

// 修正为POST调用，匹配后端接口
async verifyToken(token) {
    if (!token) {
        throw new Error('Token不能为空');
    }
    
    try {
        return await this.request('/api/auth/verify-token', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
    } catch (error) {
        console.error('Token验证失败:', error);
        throw error;
    }
}

// 删除账户方法
async deleteAccount() {
    if (!this.token) {
        throw new Error('用户未登录');
    }
    
    try {
        const response = await this.request('/api/auth/delete-account', {
            method: 'POST'
        });
        
        if (response.success) {
            this.setToken(null); // 清除本地token
        }
        
        return response;
    } catch (error) {
        console.error('删除账户失败:', error);
        throw error;
    }
}

// 清空搜索历史方法
async clearAllSearchHistory() {
    if (!this.token) {
        throw new Error('用户未登录');
    }
    
    try {
        // 方案1: 通过请求体传递参数
/*         return await this.request('/api/user/search-history', {
            method: 'DELETE',
            body: JSON.stringify({ operation: 'clear' })
        }); */
        
        // 方案2: 如果后端期望查询参数，使用下面这种方式
         return await this.request('/api/user/search-history?operation=clear', {
             method: 'DELETE'
         });
        
    } catch (error) {
        console.error('清空搜索历史失败:', error);
        throw error;
    }
}

// 删除单条搜索历史方法
async deleteSearchHistory(historyId) {
    if (!this.token) {
        throw new Error('用户未登录');
    }
    
    if (!historyId) {
        throw new Error('历史记录ID不能为空');
    }
    
    try {
        return await this.request(`/api/user/search-history/${historyId}`, {
            method: 'DELETE'
        });
    } catch (error) {
        console.error('删除搜索历史失败:', error);
        throw error;
    }
}

// 获取搜索统计方法
async getSearchStats() {
    if (!this.token) {
        return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
    
    try {
        return await this.request('/api/user/search-stats');
    } catch (error) {
        console.error('获取搜索统计失败:', error);
        return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
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

// 修复 syncFavorites 方法
async syncFavorites(favorites) {
    if (!this.token) {
        throw new Error('用户未登录');
    }
    
    if (!Array.isArray(favorites)) {
        throw new Error('收藏数据格式错误');
    }
    
    // 验证收藏数据结构
    const validFavorites = favorites.filter(fav => {
        return fav && fav.title && fav.url && 
               typeof fav.title === 'string' && 
               typeof fav.url === 'string';
    });
    
    if (validFavorites.length !== favorites.length) {
        console.warn('过滤了无效的收藏数据');
    }
    
    // 添加重试机制
    const MAX_RETRIES = 3;
    let retries = 0;
    
    while (retries < MAX_RETRIES) {
      try {
        return await this.request('/api/user/favorites', {
          method: 'POST',
          body: JSON.stringify({ favorites })
        });
      } catch (error) {
        if (error.status === 429 || error.message.includes('timeout')) {
          retries++;
          await this.delay(1000 * retries); // 指数退避
        } else {
          throw error;
        }
      }
    }
    throw new Error('同步失败，请检查网络连接');
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
        // 确保数据格式正确
        const validHistory = history.filter(item => {
            return item && (item.query || item.keyword) && 
                   typeof (item.query || item.keyword) === 'string' && 
                   (item.query || item.keyword).trim().length > 0;
        }).map(item => ({
            id: item.id || generateId(),
            query: item.query || item.keyword,
            keyword: item.query || item.keyword, // 兼容性
            source: item.source || 'unknown',
            timestamp: item.timestamp || Date.now()
        }));

        return await this.request('/api/user/sync/search-history', {
            method: 'POST',
            body: JSON.stringify({ 
                searchHistory: validHistory,
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
        
        // 确保返回的数据格式正确
        return history.filter(item => {
            return item && (item.query || item.keyword) && 
                   typeof (item.query || item.keyword) === 'string';
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

// 修复 updateUserSettings 方法
async updateUserSettings(settings) {
    if (!this.token) {
        throw new Error('用户未登录');
    }
    
    if (!settings || typeof settings !== 'object') {
        throw new Error('设置数据格式错误');
    }
    
    // 验证设置字段
    const allowedSettings = [
        'theme', 'autoSync', 'cacheResults', 
        'maxHistoryPerUser', 'maxFavoritesPerUser'
    ];
    
    const validSettings = {};
    Object.keys(settings).forEach(key => {
        if (allowedSettings.includes(key)) {
            validSettings[key] = settings[key];
        }
    });
    
    try {
        return await this.request('/api/user/settings', {
            method: 'PUT',
            body: JSON.stringify({ settings: validSettings })
        });
    } catch (error) {
        console.error('更新用户设置失败:', error);
        throw error;
    }
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

// 在api.js中添加请求批处理
class APIBatch {
  constructor() {
    this.queue = [];
    this.batchTimer = null;
  }
  
  addRequest(request) {
    this.queue.push(request);
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), 50);
    }
  }
  
  async processBatch() {
    const batchRequests = [...this.queue];
    this.queue = [];
    this.batchTimer = null;
    
    try {
      const responses = await Promise.all(batchRequests.map(req => 
        API.request(req.endpoint, req.options)
      ));
      
      batchRequests.forEach((req, index) => {
        req.resolve(responses[index]);
      });
    } catch (error) {
      batchRequests.forEach(req => {
        req.reject(error);
      });
    }
  }
}

// 创建全局API实例
const API = new APIService();
window.API = API;