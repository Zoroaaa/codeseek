// 工具函数模块 - 纯云端存储版本

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
 * 轻量存储管理器 - 仅用于主题和系统设置
 * 移除所有业务数据存储功能，只保留必要的系统配置
 */
const StorageManager = {
    // 允许的系统设置键名
    allowedKeys: ['theme', 'app_version', 'auth_token', 'api_config'],

    // 安全的localStorage操作 - 仅限系统设置
    setItem(key, value) {
        if (!this.allowedKeys.includes(key)) {
            console.warn(`StorageManager: 不允许存储业务数据 "${key}"`);
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
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

    // 清理所有业务数据，保留系统设置
    clearBusinessData() {
        const keysToRemove = [
            'search_history', 'favorites', 'user_settings', 
            'search_cache_', 'temp_', 'cache'
        ];
        
        const allKeys = Object.keys(localStorage);
        let removedCount = 0;
        
        allKeys.forEach(key => {
            const shouldRemove = keysToRemove.some(pattern => 
                key.startsWith(pattern) || key.includes(pattern)
            );
            
            if (shouldRemove && !this.allowedKeys.includes(key)) {
                try {
                    localStorage.removeItem(key);
                    removedCount++;
                } catch (error) {
                    console.error(`清理业务数据失败 ${key}:`, error);
                }
            }
        });
        
        console.log(`✅ 已清理${removedCount}个业务数据项，保留系统设置`);
        return removedCount;
    },

    // 获取存储使用情况
    getStorageUsage() {
        let total = 0;
        const itemCount = localStorage.length;
        const items = {};
        
        for (let i = 0; i < itemCount; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                const size = key.length + (value ? value.length : 0);
                total += size;
                items[key] = {
                    size,
                    sizeKB: (size / 1024).toFixed(2),
                    type: this.allowedKeys.includes(key) ? 'system' : 'unknown'
                };
            }
        }
        
        return {
            total,
            totalKB: (total / 1024).toFixed(2),
            totalMB: (total / (1024 * 1024)).toFixed(2),
            itemCount,
            items
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
 * 云端数据同步状态管理
 */
class CloudSyncManager {
    constructor() {
        this.syncQueue = new Map();
        this.isOnline = navigator.onLine;
        this.pendingOperations = new Set();
        this.lastSyncTime = null;
        this.init();
    }

    init() {
        // 监听网络状态
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processPendingSync();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    // 添加同步任务
    addSyncTask(operation, data, priority = 'normal') {
        const taskId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        this.syncQueue.set(taskId, {
            id: taskId,
            operation,
            data,
            priority,
            timestamp: Date.now(),
            retryCount: 0,
            maxRetries: 3
        });

        console.log(`📋 添加同步任务: ${operation} (${taskId})`);
        
        if (this.isOnline) {
            this.processTask(taskId);
        }
        
        return taskId;
    }

    // 处理单个任务
    async processTask(taskId) {
        const task = this.syncQueue.get(taskId);
        if (!task || this.pendingOperations.has(taskId)) return;

        this.pendingOperations.add(taskId);

        try {
            console.log(`🔄 执行同步任务: ${task.operation}`);
            
            // 这里应该调用实际的API方法
            let result;
            switch (task.operation) {
                case 'sync_favorites':
                    result = await API.syncFavorites(task.data);
                    break;
                case 'save_search_history':
                    result = await API.saveSearchHistory(task.data.query, task.data.source);
                    break;
                case 'update_settings':
                    result = await API.updateUserSettings(task.data);
                    break;
                default:
                    throw new Error(`未知的同步操作: ${task.operation}`);
            }

            // 任务成功
            this.syncQueue.delete(taskId);
            this.lastSyncTime = Date.now();
            console.log(`✅ 同步任务完成: ${task.operation}`);
            
        } catch (error) {
            console.error(`❌ 同步任务失败: ${task.operation}`, error);
            
            // 重试逻辑
            task.retryCount++;
            if (task.retryCount < task.maxRetries) {
                console.log(`🔄 任务重试 ${task.retryCount}/${task.maxRetries}: ${task.operation}`);
                setTimeout(() => this.processTask(taskId), Math.pow(2, task.retryCount) * 1000);
            } else {
                console.error(`💀 任务最终失败: ${task.operation}`);
                this.syncQueue.delete(taskId);
            }
        } finally {
            this.pendingOperations.delete(taskId);
        }
    }

    // 处理所有待同步任务
    async processPendingSync() {
        if (!this.isOnline || this.syncQueue.size === 0) return;

        console.log(`🌐 网络恢复，处理 ${this.syncQueue.size} 个待同步任务`);
        
        const taskIds = Array.from(this.syncQueue.keys());
        for (const taskId of taskIds) {
            await this.processTask(taskId);
        }
    }

    // 获取同步状态
    getStatus() {
        return {
            isOnline: this.isOnline,
            queueSize: this.syncQueue.size,
            pendingCount: this.pendingOperations.size,
            lastSyncTime: this.lastSyncTime,
            tasks: Array.from(this.syncQueue.values()).map(task => ({
                operation: task.operation,
                timestamp: task.timestamp,
                retryCount: task.retryCount
            }))
        };
    }

    // 清空队列
    clearQueue() {
        this.syncQueue.clear();
        this.pendingOperations.clear();
        console.log('🗑️ 同步队列已清空');
    }
}

/**
 * 错误处理器 - 增强版
 */
const ErrorHandler = {
    errorLog: [],
    maxLogSize: 50,

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
            
            // 特殊处理认证错误
            if (this.isAuthError(event.reason)) {
                this.handleAuthError(event.reason);
            }
            
            event.preventDefault();
        });
    },

    // 检查是否为认证错误
    isAuthError(error) {
        if (!error) return false;
        
        const message = error.message || String(error);
        return message.includes('认证失败') || 
               message.includes('401') ||
               message.includes('Unauthorized') ||
               message.includes('Token验证失败');
    },

    // 处理认证错误
    handleAuthError(error) {
        console.warn('🔐 检测到认证错误，清理认证状态');
        
        // 清除认证信息
        localStorage.removeItem('auth_token');
        
        // 重定向或显示登录界面
        if (window.location.pathname.includes('dashboard')) {
            window.location.href = './index.html';
        } else if (window.app && typeof window.app.showLoginModal === 'function') {
            window.app.showLoginModal();
        }
        
        showToast('登录已过期，请重新登录', 'warning');
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

        // 添加到内存日志
        this.addToLog(errorInfo);

        // 记录到控制台
        console.error(`🚨 ${type}:`, errorInfo);

        // 发送到服务器（如果API可用）
        if (typeof API !== 'undefined' && navigator.onLine) {
            API.recordAction('error', errorInfo).catch(console.error);
        }
    },

    // 添加到错误日志
    addToLog(errorInfo) {
        this.errorLog.unshift(errorInfo);
        
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }
    },

    // 获取错误日志
    getErrorLog() {
        return [...this.errorLog];
    },

    // 清除错误日志
    clearErrorLog() {
        this.errorLog = [];
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
    callbacks: new Set(),
    connectionInfo: null,

    // 检查网络状态
    isOnline() {
        return navigator.onLine;
    },

    // 监听网络状态变化
    onNetworkChange(callback) {
        this.callbacks.add(callback);
        
        // 添加事件监听器（避免重复添加）
        if (this.callbacks.size === 1) {
            window.addEventListener('online', this.handleOnline.bind(this));
            window.addEventListener('offline', this.handleOffline.bind(this));
        }

        // 返回取消监听的函数
        return () => {
            this.callbacks.delete(callback);
        };
    },

    handleOnline() {
        console.log('🌐 网络已连接');
        showToast('网络连接已恢复', 'success');
        this.callbacks.forEach(callback => {
            try {
                callback(true);
            } catch (error) {
                console.error('网络状态回调执行失败:', error);
            }
        });
    },

    handleOffline() {
        console.log('📵 网络已断开');
        showToast('网络连接已断开', 'warning');
        this.callbacks.forEach(callback => {
            try {
                callback(false);
            } catch (error) {
                console.error('网络状态回调执行失败:', error);
            }
        });
    },

    // 测试网络连接
    async testConnection(url = window.API_CONFIG?.BASE_URL + '/api/health') {
        if (!navigator.onLine) return false;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(url, { 
                method: 'GET',
                signal: controller.signal,
                mode: 'cors',
                cache: 'no-cache'
            });
            
            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            console.warn('网络连接测试失败:', error);
            return false;
        }
    },

    // 获取连接信息（实验性API）
    getConnectionInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.connectionInfo = {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData,
                timestamp: Date.now()
            };
            return this.connectionInfo;
        }
        return null;
    },

    // 测试API连接
    async testAPIConnection(baseURL) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(`${baseURL}/api/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json'
                },
                mode: 'cors'
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json().catch(() => ({}));
                return { connected: true, status: response.status, data };
            } else {
                return { connected: false, status: response.status };
            }
        } catch (error) {
            return { 
                connected: false, 
                error: error.name === 'AbortError' ? 'timeout' : error.message 
            };
        }
    }
};

// 环境检测函数
function isDevEnv() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || 
           hostname === '127.0.0.1' || 
           window.location.port !== '' ||
           window.location.search.includes('dev=1');
}

// 导航错误处理
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

// 页面导航函数 - 支持开发/生产环境
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

            console.log(`🔄 导航到: ${target} (${isDev ? '开发' : '生产'}环境)`);

            // 进行跳转
            if (useReplace) {
                window.location.replace(target);
            } else {
                window.location.href = target;
            }

            // 超时保护
            const timeoutId = setTimeout(() => {
                reject(new Error('导航超时'));
            }, timeout);

            // 页面跳转后这段一般不会执行到 resolve
            // 但为了完整性还是保留
            setTimeout(() => {
                clearTimeout(timeoutId);
                resolve();
            }, 100);

        } catch (error) {
            console.error('页面导航失败:', error);
            
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

// Dashboard导航函数
async function navigateToDashboard() {
    try {
        showLoading(true);

        const authToken = localStorage.getItem('auth_token');
        if (!authToken) {
            throw new Error('用户未登录');
        }

        console.log('🏠 导航到Dashboard');

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

/**
 * 应用初始化管理器
 */
class AppInitializer {
    constructor() {
        this.initialized = false;
        this.initStartTime = null;
    }

    async init() {
        if (this.initialized) return;

        this.initStartTime = performance.now();
        console.log('🚀 应用初始化开始（纯云端模式）');

        try {
            // 清理旧的业务数据
            this.cleanupLegacyData();

            // 检查版本更新
            this.checkVersion();

            // 初始化错误处理
            ErrorHandler.init();

            // 初始化网络监控
            this.initNetworkMonitoring();

            // 初始化云端同步管理器
            window.cloudSyncManager = new CloudSyncManager();

            // 初始化完成
            this.initialized = true;
            const initTime = performance.now() - this.initStartTime;
            console.log(`✅ 应用初始化完成 (${initTime.toFixed(2)}ms)`);

        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            ErrorHandler.handleError('App Initialization Error', error);
            throw error;
        }
    }

    // 清理遗留的业务数据
    cleanupLegacyData() {
        const removedCount = StorageManager.clearBusinessData();
        if (removedCount > 0) {
            console.log(`🧹 清理了 ${removedCount} 个遗留业务数据项`);
        }
    }

    // 版本检查和更新
    checkVersion() {
        const currentVersion = window.API_CONFIG?.APP_VERSION || '1.0.0';
        const storedVersion = StorageManager.getItem('app_version');
        
        if (!storedVersion || storedVersion !== currentVersion) {
            console.log(`📦 应用版本更新: ${storedVersion} -> ${currentVersion}`);
            
            // 再次清理遗留数据
            StorageManager.clearBusinessData();
            
            // 更新版本号
            StorageManager.setItem('app_version', currentVersion);
            
            showToast(`应用已更新到版本 ${currentVersion}`, 'success');
        }
    }

    // 初始化网络监控
    initNetworkMonitoring() {
        NetworkUtils.onNetworkChange((isOnline) => {
            if (isOnline && window.cloudSyncManager) {
                // 网络恢复时处理待同步任务
                window.cloudSyncManager.processPendingSync();
            }
        });

        // 页面可见性变化处理
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // 页面重新可见时，检查认证状态
                const token = localStorage.getItem('auth_token');
                if (token && window.app && typeof window.app.checkAuthStatus === 'function') {
                    window.app.checkAuthStatus().catch(console.error);
                }
            }
        });
    }

    // 获取初始化状态
    getStatus() {
        return {
            initialized: this.initialized,
            initTime: this.initStartTime ? performance.now() - this.initStartTime : null,
            storageUsage: StorageManager.getStorageUsage(),
            networkStatus: NetworkUtils.isOnline(),
            syncStatus: window.cloudSyncManager ? window.cloudSyncManager.getStatus() : null
        };
    }
}

// 创建全局初始化器
window.appInitializer = new AppInitializer();

// DOM加载完成后自动初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await window.appInitializer.init();
        console.log('🎯 应用核心初始化完成，等待具体模块初始化...');
    } catch (error) {
        console.error('💥 应用初始化失败:', error);
        showToast('应用初始化失败，请刷新页面重试', 'error', 5000);
    }
});

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
window.CloudSyncManager = CloudSyncManager;
window.navigateToPage = navigateToPage;
window.navigateToDashboard = navigateToDashboard;
window.handleNavigationError = handleNavigationError;

// 工具函数快捷访问
window.utils = {
    showToast,
    showLoading,
    formatDate,
    formatRelativeTime,
    debounce,
    throttle,
    deepClone,
    generateId,
    isDevEnv
};

console.log('✅ 纯云端模式工具库已加载');