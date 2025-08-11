// 工具函数模块

/**
 * 显示Toast通知
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 (success, error, info)
 * @param {number} duration - 显示时长(ms)
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

/**
 * 显示/隐藏加载动画
 * @param {boolean} show - 是否显示
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (!loading) return;

    loading.style.display = show ? 'flex' : 'none';
}

/**
 * 格式化日期
 * @param {Date|string|number} date - 日期
 * @param {string} format - 格式 (short, long, time)
 */
function formatDate(date, format = 'short') {
    if (!date) return '';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const options = {
        short: { year: 'numeric', month: 'short', day: 'numeric' },
        long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
        time: { hour: '2-digit', minute: '2-digit' }
    };

    return d.toLocaleDateString('zh-CN', options[format] || options.short);
}

/**
 * 格式化相对时间
 * @param {Date|string|number} date - 日期
 */
function formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    
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
    } else {
        return formatDate(date, 'short');
    }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间
 * @param {boolean} immediate - 是否立即执行
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
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制
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
 * @param {*} obj - 要拷贝的对象
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
    
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach(key => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
}

/**
 * 生成唯一ID
 * @param {number} length - ID长度
 */
function generateId(length = 10) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 存储管理器
 */
const StorageManager = {
    // 安全的localStorage操作
    setItem(key, value) {
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

    clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('清空存储失败:', error);
            return false;
        }
    },

    // 获取存储使用情况
    getStorageUsage() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return {
            used: total,
            usedMB: (total / (1024 * 1024)).toFixed(2)
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
            return urlObj.hostname;
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
            .filter(key => params[key] !== null && params[key] !== undefined)
            .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
            .join('&');
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
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    },

    // 转义HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    },

    // 首字母大写
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // 驼峰转短横线
    kebabCase(str) {
        return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    },

    // 短横线转驼峰
    camelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
};

/**
 * 数组工具
 */
const ArrayUtils = {
    // 移除重复项
    unique(arr, key = null) {
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
        return arr.reduce((groups, item) => {
            const val = typeof key === 'function' ? key(item) : item[key];
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
        }, {});
    },

    // 排序
    sortBy(arr, key, desc = false) {
        return arr.sort((a, b) => {
            const aVal = typeof key === 'function' ? key(a) : a[key];
            const bVal = typeof key === 'function' ? key(b) : b[key];
            
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
        });
    },

    // 分块
    chunk(arr, size) {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
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
        return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
    },

    // 是否为桌面设备
    isDesktop() {
        return !this.isMobile() && !this.isTablet();
    },

    // 获取屏幕信息
    getScreenInfo() {
        return {
            width: window.screen.width,
            height: window.screen.height,
            devicePixelRatio: window.devicePixelRatio || 1,
            colorDepth: window.screen.colorDepth
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
        console.log(`${label} 执行时间: ${end - start} milliseconds`);
        return result;
    },

    // 异步函数执行时间
    async measureAsyncTime(asyncFunc, label = 'async function') {
        const start = performance.now();
        const result = await asyncFunc();
        const end = performance.now();
        console.log(`${label} 执行时间: ${end - start} milliseconds`);
        return result;
    },

    // 获取内存使用情况
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }
};

/**
 * Cookie工具
 */
const CookieUtils = {
    // 设置Cookie
    set(name, value, days = 7) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    },

    // 获取Cookie
    get(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },

    // 删除Cookie
    delete(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    }
};

/**
 * 错误处理
 */
const ErrorHandler = {
    // 全局错误处理
    init() {
        window.addEventListener('error', (event) => {
            console.error('全局错误:', event.error);
            this.logError('JavaScript Error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('未处理的Promise拒绝:', event.reason);
            this.logError('Unhandled Promise Rejection', event.reason);
        });
    },

    // 记录错误
    logError(type, error) {
        const errorInfo = {
            type,
            message: error.message || error,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        // 发送错误到服务器
        if (typeof API !== 'undefined') {
            API.recordAction('error', errorInfo).catch(console.error);
        }
    },

    // 安全执行函数
    safeExecute(func, fallback = null) {
        try {
            return func();
        } catch (error) {
            console.error('安全执行失败:', error);
            this.logError('Safe Execute Error', error);
            return fallback;
        }
    },

    // 安全异步执行
    async safeAsyncExecute(asyncFunc, fallback = null) {
        try {
            return await asyncFunc();
        } catch (error) {
            console.error('安全异步执行失败:', error);
            this.logError('Safe Async Execute Error', error);
            return fallback;
        }
    }
};

// 初始化错误处理
ErrorHandler.init();