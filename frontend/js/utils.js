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

// 简化的环境检测
function isDevEnv() {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' || 
           window.location.port !== '' ||
           window.location.search.includes('dev=1');
}

// 简化的页面导航函数
function navigateToPage(url, options = {}) {
    const { useReplace = false, timeout = 5000 } = options;
    const isDev = isDevEnv();

    return new Promise((resolve, reject) => {
        try {
            let target = url;
            
            // 确保URL格式正确
            if (!target.startsWith('./') && !target.startsWith('/') && !target.startsWith('http')) {
                target = `./${target}`;
            }

            // 开发环境：确保有.html后缀
            if (isDev && !target.includes('.') && !target.startsWith('http')) {
                const [path, query = ''] = target.split('?');
                target = path.replace(/\/$/, '') + '.html' + (query ? '?' + query : '');
            }

            console.log(`导航到: ${target}`);

            // 执行导航
            if (useReplace) {
                window.location.replace(target);
            } else {
                window.location.href = target;
            }

            // 超时保护
            setTimeout(() => {
                reject(new Error('导航超时'));
            }, timeout);

        } catch (error) {
            console.error('导航失败:', error);
            reject(error);
        }
    });
}

// 简化的Dashboard导航
async function navigateToDashboard() {
    try {
        showLoading(true);

        // 检查认证状态
        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
            throw new Error('未登录');
        }

        // 直接导航，不做复杂的URL处理
        await navigateToPage('dashboard', { useReplace: true });

    } catch (error) {
        console.error('跳转到Dashboard失败:', error);
        showToast('跳转失败: ' + error.message, 'error');

        // 如果认证失败，显示登录模态框
        if (error.message.includes('认证') || error.message.includes('未登录')) {
            if (typeof app !== 'undefined' && app.showLoginModal) {
                app.showLoginModal();
            }
        }
    } finally {
        showLoading(false);
    }
}

// 增强的Toast通知系统
class ToastManager {
    constructor() {
        this.container = this.createContainer();
        this.toasts = [];
    }

    createContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }

    show(message, type = 'info', duration = 3000) {
        const toast = this.createToast(message, type, duration);
        this.container.appendChild(toast);
        this.toasts.push(toast);

        // 触发显示动画
        setTimeout(() => toast.classList.add('show'), 10);

        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => this.hide(toast), duration);
        }

        return toast;
    }

    createToast(message, type, duration) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" onclick="window.toastManager.hide(this.parentElement.parentElement)">×</button>
            </div>
            ${duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms;"></div>` : ''}
        `;

        return toast;
    }

    hide(toast) {
        if (!toast || !toast.parentElement) return;

        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    clear() {
        this.toasts.forEach(toast => this.hide(toast));
    }
}

// 创建全局Toast管理器
window.toastManager = new ToastManager();

// 重新定义showToast函数
function showToast(message, type = 'info', duration = 3000) {
    return window.toastManager.show(message, type, duration);
}

// 添加对应的CSS样式
const toastStyles = `
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
}

.toast {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    box-shadow: var(--shadow-lg);
    min-width: 300px;
    max-width: 500px;
    opacity: 0;
    transform: translateX(100%);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: auto;
    position: relative;
    overflow: hidden;
}

.toast.show {
    opacity: 1;
    transform: translateX(0);
}

.toast.hiding {
    opacity: 0;
    transform: translateX(100%);
}

.toast-success {
    border-left: 4px solid #10b981;
}

.toast-error {
    border-left: 4px solid #ef4444;
}

.toast-warning {
    border-left: 4px solid #f59e0b;
}

.toast-info {
    border-left: 4px solid #3b82f6;
}

.toast-content {
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.toast-icon {
    font-size: 1.25rem;
    flex-shrink: 0;
}

.toast-message {
    flex: 1;
    color: var(--text-primary);
    font-size: 0.95rem;
    line-height: 1.4;
}

.toast-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.toast-close:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
}

.toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-primary), var(--accent-hover));
    animation: toast-progress linear forwards;
}

@keyframes toast-progress {
    from { width: 100%; }
    to { width: 0%; }
}

@media (max-width: 640px) {
    .toast-container {
        left: 1rem;
        right: 1rem;
        top: 20px;
    }
    
    .toast {
        min-width: auto;
        max-width: none;
    }
}
`;

// 注入Toast样式
if (!document.getElementById('toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toast-styles';
    styleSheet.textContent = toastStyles;
    document.head.appendChild(styleSheet);
}

// 性能监控类
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.startTimes = {};
    }

    start(name) {
        this.startTimes[name] = performance.now();
    }

    end(name) {
        if (this.startTimes[name]) {
            const duration = performance.now() - this.startTimes[name];
            this.metrics[name] = this.metrics[name] || [];
            this.metrics[name].push(duration);
            
            // 保持最近50次记录
            if (this.metrics[name].length > 50) {
                this.metrics[name] = this.metrics[name].slice(-50);
            }
            
            delete this.startTimes[name];
            return duration;
        }
        return 0;
    }

    getMetrics(name) {
        if (!this.metrics[name]) return null;
        
        const times = this.metrics[name];
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        return { avg, min, max, count: times.length };
    }

    getAllMetrics() {
        const result = {};
        Object.keys(this.metrics).forEach(name => {
            result[name] = this.getMetrics(name);
        });
        return result;
    }

    logMetrics() {
        console.table(this.getAllMetrics());
    }
}

// 错误边界处理
class ErrorBoundary {
    constructor() {
        this.errorCount = 0;
        this.lastError = null;
        this.setupGlobalErrorHandler();
    }

    setupGlobalErrorHandler() {
        window.addEventListener('error', (event) => {
            this.handleError(event.error, 'Global Error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleError(event.reason, 'Unhandled Promise Rejection');
        });
    }

    handleError(error, context = 'Unknown', metadata = {}) {
        this.errorCount++;
        this.lastError = {
            error,
            context,
            metadata,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        console.error('Error captured by ErrorBoundary:', {
            message: error?.message || error,
            stack: error?.stack,
            context,
            metadata
        });

        // 发送错误报告（如果启用）
        this.reportError();

        // 显示用户友好的错误消息
        this.showUserError(error, context);
    }

    async reportError() {
        if (window.API_CONFIG?.ENABLE_ERROR_REPORTING && this.lastError) {
            try {
                // 可以发送到分析服务
                const errorData = {
                    message: this.lastError.error?.message || String(this.lastError.error),
                    context: this.lastError.context,
                    timestamp: this.lastError.timestamp,
                    userAgent: this.lastError.userAgent,
                    url: this.lastError.url,
                    errorCount: this.errorCount
                };

                // 这里可以调用API发送错误报告
                console.log('Error report:', errorData);
            } catch (reportError) {
                console.warn('Failed to report error:', reportError);
            }
        }
    }

    showUserError(error, context) {
        const message = this.getUserFriendlyMessage(error, context);
        showToast(message, 'error', 5000);
    }

    getUserFriendlyMessage(error, context) {
        const errorMessage = error?.message || String(error);

        // 网络错误
        if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
            return '网络连接出现问题，请检查您的网络连接';
        }

        // API错误
        if (context.includes('API') || errorMessage.includes('401')) {
            return '服务连接失败，请稍后重试';
        }

        // 存储错误
        if (errorMessage.includes('localStorage') || errorMessage.includes('storage')) {
            return '本地存储出现问题，请清理浏览器缓存';
        }

        // 解析错误
        if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
            return '数据解析失败，请刷新页面重试';
        }

        // 权限错误
        if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
            return '权限不足，请重新登录';
        }

        // 通用错误消息
        return '出现了一些问题，我们正在努力解决';
    }

    getErrorStats() {
        return {
            errorCount: this.errorCount,
            lastError: this.lastError,
            isHealthy: this.errorCount < 5
        };
    }

    reset() {
        this.errorCount = 0;
        this.lastError = null;
    }
}

// 创建全局实例
window.performanceMonitor = new PerformanceMonitor();
window.errorBoundary = new ErrorBoundary();

// 导出增强的工具函数
window.measurePerformance = (name, fn) => {
    return async (...args) => {
        window.performanceMonitor.start(name);
        try {
            const result = await fn(...args);
            const duration = window.performanceMonitor.end(name);
            console.log(`${name} completed in ${duration.toFixed(2)}ms`);
            return result;
        } catch (error) {
            window.performanceMonitor.end(name);
            window.errorBoundary.handleError(error, name);
            throw error;
        }
    };
};


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

