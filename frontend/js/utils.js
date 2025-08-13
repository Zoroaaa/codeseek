// 工具函数模块 - 完整优化版

/**
 * 显示Toast通知
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    // 清除之前的类
    toast.className = 'toast';
    toast.textContent = message;
    
    // 添加类型和显示类
    toast.classList.add(type, 'show');

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);

    // 点击关闭
    toast.onclick = () => {
        toast.classList.remove('show');
    };
}

/**
 * 显示/隐藏加载动画
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (!loading) return;

    loading.style.display = show ? 'flex' : 'none';
    
    // 防止页面滚动
    if (show) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
}

/**
 * 格式化日期
 */
function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const options = {
        short: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        time: { hour: '2-digit', minute: '2-digit' },
        datetime: { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit' 
        }
    };

    try {
        return d.toLocaleDateString('zh-CN', options[format] || options.short);
    } catch (error) {
        return d.toLocaleDateString();
    }
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    
    if (isNaN(diff)) return '';
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
    } else if (diff < month) {
        return `${Math.floor(diff / week)}周前`;
    } else if (diff < year) {
        return `${Math.floor(diff / month)}月前`;
    } else {
        return `${Math.floor(diff / year)}年前`;
    }
}

/**
 * 防抖函数
 */
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

/**
 * 节流函数
 */
function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 在utils.js中添加
function handleNavigationError(url, retryCount = 0) {
    if (retryCount < 3) {
        setTimeout(() => {
            try {
                window.location.href = url;
            } catch (error) {
                console.error('导航失败:', error);
                handleNavigationError(url, retryCount + 1);
            }
        }, 1000 * (retryCount + 1));
    } else {
        showToast('页面跳转失败，请手动刷新页面', 'error');
    }
}



/**
 * 深拷贝对象
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
        return obj.map(item => deepClone(item));
    }
    
    if (obj instanceof RegExp) {
        return new RegExp(obj);
    }
    
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
    
    return obj;
}

/**
 * 生成唯一ID
 */
function generateId(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = chars.length;
    
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * charactersLength));
    }
    
    return result;
}

/**
 * 存储管理器
 */
const StorageManager = {
    // 存储配额检查
    getQuotaUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            return navigator.storage.estimate();
        }
        return Promise.resolve({ usage: 0, quota: 0 });
    },

    // 安全的localStorage操作
    setItem(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                console.warn('存储空间不足，尝试清理缓存');
                this.clearCache();
                try {
                    localStorage.setItem(key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    console.error('存储失败:', retryError);
                    return false;
                }
            }
            console.error('存储数据失败:', error);
            return false;
        }
    },

    getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('读取数据失败:', error);
            return defaultValue;
        }
    },

    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('删除数据失败:', error);
            return false;
        }
    },

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空存储失败:', error);
            return false;
        }
    },

    // 清理缓存数据
    clearCache() {
        const cacheKeys = Object.keys(localStorage).filter(key => 
            key.startsWith('search_cache_') || 
            key.startsWith('temp_') ||
            key.includes('cache')
        );
        
        cacheKeys.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.error(`清理缓存失败 ${key}:`, error);
            }
        });
        
        console.log(`已清理${cacheKeys.length}个缓存项`);
    },

    // 获取存储使用情况
    getStorageUsage() {
        let total = 0;
        const itemCount = localStorage.length;
        
        for (let i = 0; i < itemCount; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                total += key.length + (value ? value.length : 0);
            }
        }
        
        return {
            used: total,
            usedKB: (total / 1024).toFixed(2),
            usedMB: (total / (1024 * 1024)).toFixed(2),
            itemCount
        };
    }
};

/**
 * URL工具
 */
const URLUtils = {
    // 检查URL是否有效
    isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    },

    // 提取域名
    extractDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace('www.', '');
        } catch (_) {
            return '';
        }
    },

    // 添加协议
    addProtocol(url) {
        if (!url) return '';
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    },

    // 构建查询字符串
    buildQueryString(params) {
        return Object.keys(params)
            .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '')
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
    },

    // 解析查询字符串
    parseQueryString(queryString) {
        const params = {};
        if (!queryString) return params;
        
        const pairs = (queryString.startsWith('?') ? queryString.slice(1) : queryString).split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
            }
        });
        
        return params;
    },

    // 获取文件扩展名
    getFileExtension(url) {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const lastDot = pathname.lastIndexOf('.');
            
            if (lastDot > 0) {
                return pathname.slice(lastDot + 1).toLowerCase();
            }
        } catch (error) {
            console.error('获取文件扩展名失败:', error);
        }
        
        return '';
    }
};

/**
 * 字符串工具
 */
const StringUtils = {
    // 截断字符串
    truncate(str, length, suffix = '...') {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + suffix;
    },

    // 移除HTML标签
    stripHtml(html) {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },

    // 转义HTML
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
            '/': '&#x2F;'
        };
        return String(text).replace(/[&<>"'/]/g, s => map[s]);
    },

    // 反转义HTML
    unescapeHtml(text) {
        if (!text) return '';
        const map = {
            '&amp;': '&',
            '&lt;': '<',
            '&gt;': '>',
            '&quot;': '"',
            '&#039;': "'",
            '&#x2F;': '/'
        };
        return String(text).replace(/&(amp|lt|gt|quot|#039|#x2F);/g, s => map[s]);
    },

    // 首字母大写
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // 驼峰转短横线
    kebabCase(str) {
        if (!str) return '';
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    },

    // 短横线转驼峰
    camelCase(str) {
        if (!str) return '';
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    },

    // 生成随机字符串
    random(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
};

/**
 * 数组工具
 */
const ArrayUtils = {
    // 移除重复项
    unique(arr, key = null) {
        if (!Array.isArray(arr)) return [];
        
        if (key) {
            const seen = new Set();
            return arr.filter(item => {
                const val = typeof key === 'function' ? key(item) : item[key];
                if (seen.has(val)) {
                    return false;
                }
                seen.add(val);
                return true;
            });
        }
        return [...new Set(arr)];
    },

    // 分组
    groupBy(arr, key) {
        if (!Array.isArray(arr)) return {};
        
        return arr.reduce((groups, item) => {
            const val = typeof key === 'function' ? key(item) : item[key];
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
        }, {});
    },

    // 排序
    sortBy(arr, key, desc = false) {
        if (!Array.isArray(arr)) return [];
        
        return [...arr].sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
        });
    },

    // 分块
    chunk(arr, size) {
        if (!Array.isArray(arr) || size <= 0) return [];
        
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    },

    // 随机排序
    shuffle(arr) {
        if (!Array.isArray(arr)) return [];
        
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    // 查找差异
    difference(arr1, arr2, key = null) {
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
        
        if (key) {
            const set2 = new Set(arr2.map(item => typeof key === 'function' ? key(item) : item[key]));
            return arr1.filter(item => {
                const val = typeof key === 'function' ? key(item) : item[key];
                return !set2.has(val);
            });
        }
        
        const set2 = new Set(arr2);
        return arr1.filter(item => !set2.has(item));
    }
};

/**
 * 设备检测
 */
const DeviceUtils = {
    // 是否为移动设备
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    // 是否为平板
    isTablet() {
        return /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);
    },

    // 是否为桌面设备
    isDesktop() {
        return !this.isMobile() && !this.isTablet();
    },

    // 是否支持触摸
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },

    // 获取屏幕信息
    getScreenInfo() {
        return {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            devicePixelRatio: window.devicePixelRatio || 1,
            colorDepth: window.screen.colorDepth,
            orientation: screen.orientation ? screen.orientation.angle : 0
        };
    },

    // 获取浏览器信息
    getBrowserInfo() {
        const ua = navigator.userAgent;
        const browsers = {
            chrome: /Chrome/i.test(ua) && !/Edge/i.test(ua),
            firefox: /Firefox/i.test(ua),
            safari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
            edge: /Edge/i.test(ua),
            ie: /MSIE|Trident/i.test(ua)
        };
        
        const browserName = Object.keys(browsers).find(key => browsers[key]) || 'unknown';
        
        return {
            name: browserName,
            userAgent: ua,
            language: navigator.language,
            languages: navigator.languages || [navigator.language],
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        };
    }
};

/**
 * 性能监控
 */
const PerformanceUtils = {
    // 测量函数执行时间
    measureTime(func, label = 'function') {
        const start = performance.now();
        const result = func();
        const end = performance.now();
        const duration = end - start;
        
        console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
        
        return { result, duration };
    },

    // 异步函数执行时间
    async measureAsyncTime(asyncFunc, label = 'async function') {
        const start = performance.now();
        const result = await asyncFunc();
        const end = performance.now();
        const duration = end - start;
        
        console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
        
        return { result, duration };
    },

    // 获取内存使用情况
    getMemoryUsage() {
        if (performance.memory) {
            const memory = performance.memory;
            return {
                used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    },

    // 性能标记
    mark(name) {
        if (performance.mark) {
            performance.mark(name);
        }
    },

    // 测量性能
    measure(name, startMark, endMark) {
        if (performance.measure) {
            try {
                performance.measure(name, startMark, endMark);
                const entries = performance.getEntriesByName(name);
                return entries[entries.length - 1]?.duration || 0;
            } catch (error) {
                console.error('性能测量失败:', error);
                return 0;
            }
        }
        return 0;
    }
};

/**
 * Cookie工具
 */
const CookieUtils = {
    // 设置Cookie
    set(name, value, options = {}) {
        let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        
        if (options.expires) {
            if (typeof options.expires === 'number') {
                const date = new Date();
                date.setTime(date.getTime() + (options.expires * 24 * 60 * 60 * 1000));
                cookieString += `; expires=${date.toUTCString()}`;
            } else if (options.expires instanceof Date) {
                cookieString += `; expires=${options.expires.toUTCString()}`;
            }
        }
        
        if (options.path) {
            cookieString += `; path=${options.path}`;
        }
        
        if (options.domain) {
            cookieString += `; domain=${options.domain}`;
        }
        
        if (options.secure) {
            cookieString += '; secure';
        }
        
        if (options.sameSite) {
            cookieString += `; samesite=${options.sameSite}`;
        }
        
        document.cookie = cookieString;
    },

    // 获取Cookie
    get(name) {
        const nameEQ = encodeURIComponent(name) + '=';
        const ca = document.cookie.split(';');
        
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        }
        return null;
    },

    // 删除Cookie
    delete(name, options = {}) {
        this.set(name, '', { 
            ...options, 
            expires: new Date(0) 
        });
    },

    // 检查Cookie是否存在
    exists(name) {
        return this.get(name) !== null;
    }
};

/**
 * 错误处理器
 */
const ErrorHandler = {
    // 初始化全局错误处理
    init() {
        window.addEventListener('error', (event) => {
            this.handleError('JavaScript Error', event.error, {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleError('Unhandled Promise Rejection', event.reason);
            event.preventDefault(); // 防止在控制台显示
        });
    },

    // 处理错误
    handleError(type, error, extra = {}) {
        const errorInfo = {
            type,
            message: error?.message || String(error),
            stack: error?.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            ...extra
        };

        // 记录到控制台
        console.error(`🚨 ${type}:`, errorInfo);

        // 发送到服务器（如果API可用）
        if (typeof API !== 'undefined') {
            API.recordAction('error', errorInfo).catch(console.error);
        }

        // 存储到本地（用于离线分析）
        this.storeError(errorInfo);
    },

    // 存储错误到本地
    storeError(errorInfo) {
        try {
            const errors = StorageManager.getItem('app_errors', []);
            errors.push(errorInfo);
            
            // 只保留最近50个错误
            if (errors.length > 50) {
                errors.splice(0, errors.length - 50);
            }
            
            StorageManager.setItem('app_errors', errors);
        } catch (error) {
            console.error('存储错误信息失败:', error);
        }
    },

    // 获取存储的错误
    getStoredErrors() {
        return StorageManager.getItem('app_errors', []);
    },

    // 清除存储的错误
    clearStoredErrors() {
        StorageManager.removeItem('app_errors');
    },

    // 安全执行函数
    safeExecute(func, fallback = null, context = 'function') {
        try {
            return func();
        } catch (error) {
            this.handleError(`Safe Execute Error (${context})`, error);
            return fallback;
        }
    },

    // 安全异步执行
    async safeAsyncExecute(asyncFunc, fallback = null, context = 'async function') {
        try {
            return await asyncFunc();
        } catch (error) {
            this.handleError(`Safe Async Execute Error (${context})`, error);
            return fallback;
        }
    }
};

/**
 * 网络状态监控
 */
const NetworkUtils = {
    // 检查网络状态
    isOnline() {
        return navigator.onLine;
    },

    // 监听网络状态变化
    onNetworkChange(callback) {
        window.addEventListener('online', () => callback(true));
        window.addEventListener('offline', () => callback(false));
    },

    // 测试网络连接
    async testConnection(url = window.API_CONFIG?.BASE_URL + '/api/health') {
        try {
            const response = await fetch(url, { 
                method: 'HEAD',
                mode: 'no-cors'
            });
            return true;
        } catch (error) {
            return false;
        }
    },

    // 获取连接信息（实验性API）
    getConnectionInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        return null;
    }
};

// 在utils.js中，替换 navigateToPage 和 navigateToDashboard

function isDevEnv() {
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || window.location.port !== '';
}

function navigateToPage(url, options = {}) {
    const { useReplace = false, retryOnError = true, maxRetries = 2, timeout = 5000 } = options;
    const isDev = isDevEnv();

    return new Promise((resolve, reject) => {
        try {
            // 统一前缀
            let target = url.startsWith('./') || url.startsWith('/') ? url : `./${url}`;

            // 开发环境：确保有 .html 后缀；生产环境：确保没有 .html 后缀
            if (isDev) {
                if (!/\.html(\?|$)/i.test(target)) {
                    const [path, query = ''] = target.split('?');
                    target = path.replace(/\/$/, '') + '.html' + (query ? '?' + query : '');
                }
            } else {
                // 去掉 .html（让 Cloudflare Pages 的 clean URLs 工作）
                target = target.replace(/\.html(\?|$)/i, (_, q) => q || '');
            }

            // 进行跳转
            if (useReplace) {
                window.location.replace(target);
            } else {
                window.location.href = target;
            }

            // 超时保护
            const t = setTimeout(() => reject(new Error('导航超时')), timeout);
            // 注意：页面跳转后这段一般不会执行到 resolve
        } catch (error) {
            if (retryOnError && maxRetries > 0) {
                console.warn('导航失败，重试中...', error);
                setTimeout(() => {
                    navigateToPage(url, { ...options, maxRetries: maxRetries - 1 })
                        .then(resolve)
                        .catch(reject);
                }, 1000);
            } else {
                reject(error);
            }
        }
    });
}

async function navigateToDashboard() {
    try {
        showLoading(true);

        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
            throw new Error('未登录');
        }

        // 生产环境跳 /dashboard（无 .html），开发环境会在 navigateToPage 内自动补 .html
        await navigateToPage('dashboard', { useReplace: true });

    } catch (error) {
        console.error('跳转到dashboard失败:', error);
        showToast('跳转失败: ' + error.message, 'error');

        if (error.message.includes('认证') || error.message.includes('未登录')) {
            if (typeof app !== 'undefined' && app.showLoginModal) {
                app.showLoginModal();
            }
        }
    } finally {
        showLoading(false);
    }
}




// 初始化错误处理
ErrorHandler.init();

// 导出到全局作用域
window.StorageManager = StorageManager;
window.URLUtils = URLUtils;
window.StringUtils = StringUtils;
window.ArrayUtils = ArrayUtils;
window.DeviceUtils = DeviceUtils;
window.PerformanceUtils = PerformanceUtils;
window.CookieUtils = CookieUtils;
window.ErrorHandler = ErrorHandler;
window.NetworkUtils = NetworkUtils;
// 导出到全局作用域
window.navigateToPage = navigateToPage;
window.navigateToDashboard = navigateToDashboard;
