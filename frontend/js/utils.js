// 工具函数库 - 完全优化版本
// 提供应用所需的各种工具函数和帮助类

// 通用工具类
class Utils {
    // 生成唯一ID
    static generateId(prefix = '', length = 16) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const values = new Uint8Array(length);
        crypto.getRandomValues(values);
        
        let result = prefix;
        for (let i = 0; i < length; i++) {
            result += chars[values[i] % chars.length];
        }
        
        return result;
    }

    // 生成UUID v4
    static generateUUID() {
        if ('randomUUID' in crypto) {
            return crypto.randomUUID();
        }
        
        // 降级实现
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 深度克隆对象
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj);
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
    }

    // 合并对象（深度合并）
    static deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }

    // 判断是否为对象
    static isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // 防抖函数
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func(...args);
        };
    }

    // 节流函数
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 延迟执行
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 重试执行
    static async retry(fn, maxAttempts = 3, delayMs = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    console.warn(`重试 ${attempt}/${maxAttempts} 失败:`, error.message);
                    await this.delay(delayMs * attempt); // 指数退避
                } else {
                    console.error(`所有重试都失败了:`, error);
                }
            }
        }
        
        throw lastError;
    }

    // 格式化文件大小
    static formatFileSize(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // 解析文件大小字符串为字节
    static parseFileSize(sizeStr) {
        if (!sizeStr || typeof sizeStr !== 'string') return 0;
        
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 ** 2,
            'GB': 1024 ** 3,
            'TB': 1024 ** 4,
            'PB': 1024 ** 5
        };
        
        const match = sizeStr.trim().match(/^([\d.]+)\s*([A-Z]+)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        return Math.round(value * (units[unit] || 1));
    }

    // 格式化时间
    static formatTime(timestamp, format = 'datetime') {
        if (!timestamp) return '';
        
        const date = new Date(timestamp);
        const now = new Date();
        
        switch (format) {
            case 'relative':
                return this.getRelativeTime(timestamp);
            case 'date':
                return date.toLocaleDateString();
            case 'time':
                return date.toLocaleTimeString();
            case 'datetime':
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            case 'iso':
                return date.toISOString();
            case 'friendly':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                if (date >= today) {
                    return '今天 ' + date.toLocaleTimeString();
                } else if (date >= yesterday) {
                    return '昨天 ' + date.toLocaleTimeString();
                } else {
                    return date.toLocaleDateString();
                }
            default:
                return date.toString();
        }
    }

    // 获取相对时间
    static getRelativeTime(timestamp) {
        if (!timestamp) return '';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const minute = 60 * 1000;
        const hour = 60 * minute;
        const day = 24 * hour;
        const week = 7 * day;
        const month = 30 * day;
        const year = 365 * day;
        
        if (diff < minute) return '刚刚';
        if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
        if (diff < day) return `${Math.floor(diff / hour)}小时前`;
        if (diff < week) return `${Math.floor(diff / day)}天前`;
        if (diff < month) return `${Math.floor(diff / week)}周前`;
        if (diff < year) return `${Math.floor(diff / month)}个月前`;
        
        return `${Math.floor(diff / year)}年前`;
    }

    // 格式化数字
    static formatNumber(num, options = {}) {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        
        const { 
            locale = 'zh-CN',
            minimumFractionDigits = 0,
            maximumFractionDigits = 2,
            notation = 'standard'
        } = options;
        
        // 大数字简化显示
        if (options.compact) {
            if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
            if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
            if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        }
        
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits,
            maximumFractionDigits,
            notation
        }).format(num);
    }

    // 字符串截断
    static truncate(str, length = 100, suffix = '...') {
        if (!str || typeof str !== 'string') return '';
        if (str.length <= length) return str;
        
        return str.substring(0, length - suffix.length) + suffix;
    }

    // 高亮关键词
    static highlightKeywords(text, keywords, className = 'highlight') {
        if (!text || !keywords) return text;
        
        const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
        let result = text;
        
        keywordArray.forEach(keyword => {
            const regex = new RegExp(`(${this.escapeRegExp(keyword)})`, 'gi');
            result = result.replace(regex, `<span class="${className}">$1</span>`);
        });
        
        return result;
    }

    // 转义正则表达式特殊字符
    static escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // 生成随机颜色
    static getRandomColor(type = 'hex') {
        switch (type) {
            case 'hex':
                return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
            case 'rgb':
                const r = Math.floor(Math.random() * 256);
                const g = Math.floor(Math.random() * 256);
                const b = Math.floor(Math.random() * 256);
                return `rgb(${r}, ${g}, ${b})`;
            case 'hsl':
                const h = Math.floor(Math.random() * 360);
                const s = Math.floor(Math.random() * 100);
                const l = Math.floor(Math.random() * 50) + 25; // 确保不会太暗或太亮
                return `hsl(${h}, ${s}%, ${l}%)`;
            default:
                return this.getRandomColor('hex');
        }
    }

    // 计算颜色亮度
    static getLuminance(color) {
        // 移除#符号
        const hex = color.replace('#', '');
        
        // 转换为RGB
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // 计算相对亮度
        const rs = r / 255;
        const gs = g / 255;
        const bs = b / 255;
        
        return 0.299 * rs + 0.587 * gs + 0.114 * bs;
    }

    // 获取对比色（黑色或白色）
    static getContrastColor(backgroundColor) {
        const luminance = this.getLuminance(backgroundColor);
        return luminance > 0.5 ? '#000000' : '#ffffff';
    }

    // URL验证
    static isValidURL(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // 邮箱验证
    static isValidEmail(email) {
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        return emailRegex.test(email);
    }

    // 手机号验证（中国）
    static isValidPhone(phone) {
        const phoneRegex = /^1[3-9]\d{9}$/;
        return phoneRegex.test(phone);
    }

    // 密码强度检查
    static checkPasswordStrength(password) {
        if (!password) return { score: 0, level: 'none', suggestions: [] };
        
        let score = 0;
        const suggestions = [];
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            symbols: /[!@#$%^&*(),.?":{}|<>]/.test(password),
            noRepeat: !/(.)\1{2,}/.test(password)
        };
        
        // 评分
        if (checks.length) score += 2; else suggestions.push('至少8个字符');
        if (checks.lowercase) score += 1; else suggestions.push('包含小写字母');
        if (checks.uppercase) score += 1; else suggestions.push('包含大写字母');
        if (checks.numbers) score += 1; else suggestions.push('包含数字');
        if (checks.symbols) score += 1; else suggestions.push('包含特殊字符');
        if (checks.noRepeat) score += 1; else suggestions.push('避免连续重复字符');
        
        // 额外检查
        if (password.length >= 12) score += 1;
        if (!/^(.)\1*$/.test(password)) score += 1; // 不是单一字符
        
        let level;
        if (score < 2) level = 'weak';
        else if (score < 4) level = 'fair';
        else if (score < 6) level = 'good';
        else level = 'strong';
        
        return { score, level, suggestions };
    }

    // Cookie操作
    static setCookie(name, value, days = 30) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
    }

    static getCookie(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        
        return null;
    }

    static deleteCookie(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:01 GMT;path=/`;
    }

    // 浏览器检测
    static getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        if (ua.includes('Chrome')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari')) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edge')) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
        }
        
        return {
            name: browser,
            version: version,
            userAgent: ua,
            isMobile: /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
            isTouch: 'ontouchstart' in window,
            language: navigator.language,
            platform: navigator.platform
        };
    }

    // 设备检测
    static getDeviceInfo() {
        return {
            screen: {
                width: screen.width,
                height: screen.height,
                availWidth: screen.availWidth,
                availHeight: screen.availHeight,
                pixelRatio: window.devicePixelRatio || 1
            },
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight
            },
            connection: this.getConnectionInfo(),
            memory: navigator.deviceMemory || 'Unknown',
            cores: navigator.hardwareConcurrency || 'Unknown'
        };
    }

    // 网络连接信息
    static getConnectionInfo() {
        if (!navigator.connection && !navigator.mozConnection && !navigator.webkitConnection) {
            return null;
        }
        
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        return {
            effectiveType: connection.effectiveType,
            downlink: connection.downlink,
            rtt: connection.rtt,
            saveData: connection.saveData
        };
    }

    // 性能测量
    static measurePerformance(name, fn) {
        return async (...args) => {
            const start = performance.now();
            
            try {
                const result = await fn(...args);
                const end = performance.now();
                const duration = end - start;
                
                console.log(`⚡ ${name} 执行时间: ${duration.toFixed(2)}ms`);
                
                // 可以发送到分析服务
                if (window.analytics) {
                    window.analytics.timing(name, duration);
                }
                
                return result;
            } catch (error) {
                const end = performance.now();
                const duration = end - start;
                
                console.error(`❌ ${name} 执行失败 (${duration.toFixed(2)}ms):`, error);
                throw error;
            }
        };
    }

    // 内存使用情况
    static getMemoryUsage() {
        if (performance.memory) {
            return {
                used: this.formatFileSize(performance.memory.usedJSHeapSize),
                total: this.formatFileSize(performance.memory.totalJSHeapSize),
                limit: this.formatFileSize(performance.memory.jsHeapSizeLimit),
                percentage: ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(2)
            };
        }
        return null;
    }

    // 检查浏览器特性支持
    static checkFeatureSupport() {
        return {
            localStorage: typeof Storage !== 'undefined',
            sessionStorage: typeof Storage !== 'undefined',
            indexedDB: 'indexedDB' in window,
            webWorkers: typeof Worker !== 'undefined',
            serviceWorkers: 'serviceWorker' in navigator,
            geolocation: 'geolocation' in navigator,
            notifications: 'Notification' in window,
            webRTC: 'RTCPeerConnection' in window,
            webGL: (() => {
                try {
                    const canvas = document.createElement('canvas');
                    return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
                } catch {
                    return false;
                }
            })(),
            webAssembly: typeof WebAssembly === 'object',
            intersectionObserver: 'IntersectionObserver' in window,
            resizeObserver: 'ResizeObserver' in window,
            crypto: 'crypto' in window && 'getRandomValues' in crypto,
            fetch: 'fetch' in window,
            promises: typeof Promise !== 'undefined',
            modules: 'noModule' in HTMLScriptElement.prototype,
            customElements: 'customElements' in window
        };
    }

    // URL参数解析
    static parseURLParams(url = window.location.href) {
        const params = {};
        const urlObj = new URL(url);
        
        urlObj.searchParams.forEach((value, key) => {
            if (params[key]) {
                if (Array.isArray(params[key])) {
                    params[key].push(value);
                } else {
                    params[key] = [params[key], value];
                }
            } else {
                params[key] = value;
            }
        });
        
        return params;
    }

    // 构建URL参数
    static buildURLParams(params) {
        const urlParams = new URLSearchParams();
        
        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                value.forEach(v => urlParams.append(key, v));
            } else if (value !== null && value !== undefined) {
                urlParams.append(key, value);
            }
        }
        
        return urlParams.toString();
    }

    // 下载文件
    static downloadFile(data, filename, type = 'application/octet-stream') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    // 读取文件
    static readFile(file, type = 'text') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            
            switch (type) {
                case 'text':
                    reader.readAsText(file);
                    break;
                case 'dataUrl':
                    reader.readAsDataURL(file);
                    break;
                case 'arrayBuffer':
                    reader.readAsArrayBuffer(file);
                    break;
                case 'binaryString':
                    reader.readAsBinaryString(file);
                    break;
                default:
                    reader.readAsText(file);
            }
        });
    }

    // 图像处理
    static resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // 计算新尺寸
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // 绘制图像
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为blob
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    // 颜色转换
    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // 数组工具
    static shuffle(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    static chunk(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    static unique(array, key = null) {
        if (key) {
            const seen = new Set();
            return array.filter(item => {
                const val = typeof key === 'function' ? key(item) : item[key];
                if (seen.has(val)) return false;
                seen.add(val);
                return true;
            });
        }
        return [...new Set(array)];
    }

    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = typeof key === 'function' ? key(item) : item[key];
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    // 搜索和过滤
    static fuzzySearch(list, query, options = {}) {
        if (!query || !list.length) return list;
        
        const {
            keys = [], // 要搜索的字段
            threshold = 0.6, // 匹配阈值
            caseSensitive = false,
            includeScore = false
        } = options;
        
        const searchQuery = caseSensitive ? query : query.toLowerCase();
        
        const results = list.map(item => {
            let text = '';
            
            if (keys.length > 0) {
                text = keys.map(key => 
                    typeof key === 'function' ? key(item) : item[key]
                ).filter(Boolean).join(' ');
            } else {
                text = typeof item === 'string' ? item : JSON.stringify(item);
            }
            
            if (!caseSensitive) {
                text = text.toLowerCase();
            }
            
            const score = this.calculateFuzzyScore(text, searchQuery);
            
            return { item, score };
        }).filter(result => result.score >= threshold);
        
        // 按分数排序
        results.sort((a, b) => b.score - a.score);
        
        if (includeScore) {
            return results;
        }
        
        return results.map(result => result.item);
    }

    // 计算模糊匹配分数
    static calculateFuzzyScore(text, query) {
        if (text === query) return 1.0;
        if (text.length === 0 || query.length === 0) return 0.0;
        
        // 使用编辑距离算法
        const matrix = [];
        const textLen = text.length;
        const queryLen = query.length;
        
        // 初始化矩阵
        for (let i = 0; i <= textLen; i++) {
            matrix[i] = [];
            matrix[i][0] = i;
        }
        
        for (let j = 0; j <= queryLen; j++) {
            matrix[0][j] = j;
        }
        
        // 填充矩阵
        for (let i = 1; i <= textLen; i++) {
            for (let j = 1; j <= queryLen; j++) {
                const cost = text[i - 1] === query[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,     // 删除
                    matrix[i][j - 1] + 1,     // 插入
                    matrix[i - 1][j - 1] + cost // 替换
                );
            }
        }
        
        const distance = matrix[textLen][queryLen];
        const maxLen = Math.max(textLen, queryLen);
        
        return 1 - (distance / maxLen);
    }

    // 高亮搜索结果
    static highlightMatch(text, query, className = 'highlight') {
        if (!text || !query) return text;
        
        const regex = new RegExp(`(${this.escapeRegExp(query)})`, 'gi');
        return text.replace(regex, `<mark class="${className}">$1</mark>`);
    }
}

// 存储管理器
class StorageManager {
    static prefix = 'magnet_search_';
    
    // 设置项目
    static setItem(key, value, ttl = null) {
        try {
            const data = {
                value: value,
                timestamp: Date.now(),
                ttl: ttl
            };
            
            localStorage.setItem(this.prefix + key, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('存储数据失败:', error);
            return false;
        }
    }
    
    // 获取项目
    static getItem(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return defaultValue;
            
            const data = JSON.parse(item);
            
            // 检查是否过期
            if (data.ttl && Date.now() > data.timestamp + data.ttl) {
                this.removeItem(key);
                return defaultValue;
            }
            
            return data.value;
        } catch (error) {
            console.error('读取存储数据失败:', error);
            return defaultValue;
        }
    }
    
    // 移除项目
    static removeItem(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (error) {
            console.error('删除存储数据失败:', error);
            return false;
        }
    }
    
    // 清空所有项目
    static clear() {
        try {
            const keys = Object.keys(localStorage).filter(key => 
                key.startsWith(this.prefix)
            );
            
            keys.forEach(key => localStorage.removeItem(key));
            return true;
        } catch (error) {
            console.error('清空存储失败:', error);
            return false;
        }
    }
    
    // 获取存储统计
    static getStats() {
        let totalSize = 0;
        let itemCount = 0;
        
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                itemCount++;
                totalSize += localStorage[key].length;
            }
        }
        
        return {
            itemCount,
            totalSize: Utils.formatFileSize(totalSize),
            available: this.getAvailableSpace()
        };
    }
    
    // 获取可用空间
    static getAvailableSpace() {
        try {
            let total = 0;
            for (let key in localStorage) {
                total += localStorage[key].length;
            }
            
            // 大多数浏览器localStorage限制为5MB
            const limit = 5 * 1024 * 1024;
            return Utils.formatFileSize(limit - total);
        } catch (error) {
            return 'Unknown';
        }
    }
    
    // 导出数据
    static exportData() {
        const data = {};
        
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const cleanKey = key.replace(this.prefix, '');
                data[cleanKey] = this.getItem(cleanKey);
            }
        }
        
        return data;
    }
    
    // 导入数据
    static importData(data, overwrite = false) {
        let imported = 0;
        let skipped = 0;
        
        for (const [key, value] of Object.entries(data)) {
            if (!overwrite && this.getItem(key) !== null) {
                skipped++;
                continue;
            }
            
            if (this.setItem(key, value)) {
                imported++;
            }
        }
        
        return { imported, skipped };
    }
}

// 事件管理器
class EventManager {
    constructor() {
        this.listeners = new Map();
    }
    
    // 添加事件监听器
    on(event, callback, options = {}) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        
        const listener = {
            callback,
            once: options.once || false,
            priority: options.priority || 0,
            id: Utils.generateId('listener_')
        };
        
        this.listeners.get(event).push(listener);
        
        // 按优先级排序
        this.listeners.get(event).sort((a, b) => b.priority - a.priority);
        
        return listener.id;
    }
    
    // 移除事件监听器
    off(event, listenerId = null) {
        if (!this.listeners.has(event)) return false;
        
        const eventListeners = this.listeners.get(event);
        
        if (listenerId) {
            const index = eventListeners.findIndex(l => l.id === listenerId);
            if (index > -1) {
                eventListeners.splice(index, 1);
                return true;
            }
        } else {
            this.listeners.delete(event);
            return true;
        }
        
        return false;
    }
    
    // 触发事件
    emit(event, data = null) {
        if (!this.listeners.has(event)) return [];
        
        const eventListeners = [...this.listeners.get(event)];
        const results = [];
        
        for (let i = eventListeners.length - 1; i >= 0; i--) {
            const listener = eventListeners[i];
            
            try {
                const result = listener.callback(data, event);
                results.push(result);
                
                // 如果是一次性监听器，移除它
                if (listener.once) {
                    const index = this.listeners.get(event).findIndex(l => l.id === listener.id);
                    if (index > -1) {
                        this.listeners.get(event).splice(index, 1);
                    }
                }
                
                // 如果返回false，停止传播
                if (result === false) break;
                
            } catch (error) {
                console.error(`事件处理器错误 (${event}):`, error);
            }
        }
        
        return results;
    }
    
    // 清空所有监听器
    clear() {
        this.listeners.clear();
    }
    
    // 获取统计信息
    getStats() {
        const stats = {};
        
        for (const [event, listeners] of this.listeners) {
            stats[event] = listeners.length;
        }
        
        return stats;
    }
}

// 缓存管理器
class CacheManager {
    constructor(maxSize = 100, defaultTTL = 5 * 60 * 1000) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.defaultTTL = defaultTTL;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        // 定期清理过期缓存
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // 每分钟清理一次
    }
    
    // 设置缓存
    set(key, value, ttl = this.defaultTTL) {
        // 检查缓存大小
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evict();
        }
        
        const item = {
            value,
            timestamp: Date.now(),
            ttl,
            accessCount: 0,
            lastAccessed: Date.now()
        };
        
        this.cache.set(key, item);
        this.stats.sets++;
        
        return this;
    }
    
    // 获取缓存
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        // 检查是否过期
        if (Date.now() > item.timestamp + item.ttl) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        // 更新访问统计
        item.accessCount++;
        item.lastAccessed = Date.now();
        
        this.stats.hits++;
        return item.value;
    }
    
    // 检查缓存是否存在
    has(key) {
        return this.get(key) !== null;
    }
    
    // 删除缓存
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }
    
    // 清空缓存
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.stats.deletes += size;
        return this;
    }
    
    // 清理过期缓存
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, item] of this.cache) {
            if (now > item.timestamp + item.ttl) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        this.stats.deletes += cleaned;
        
        if (cleaned > 0) {
            console.log(`🧹 清理了 ${cleaned} 个过期缓存项`);
        }
        
        return cleaned;
    }
    
    // 淘汰策略（LFU - 最少使用）
    evict() {
        if (this.cache.size === 0) return;
        
        let leastUsedKey = null;
        let leastAccessCount = Infinity;
        
        for (const [key, item] of this.cache) {
            if (item.accessCount < leastAccessCount) {
                leastAccessCount = item.accessCount;
                leastUsedKey = key;
            }
        }
        
        if (leastUsedKey) {
            this.cache.delete(leastUsedKey);
            this.stats.deletes++;
        }
    }
    
    // 获取缓存统计
    getStats() {
        return {
            ...this.stats,
            size: this.cache.size,
            maxSize: this.maxSize,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0
        };
    }
    
    // 导出缓存数据
    export() {
        const data = {};
        for (const [key, item] of this.cache) {
            data[key] = {
                value: item.value,
                timestamp: item.timestamp,
                ttl: item.ttl
            };
        }
        return data;
    }
    
    // 导入缓存数据
    import(data) {
        const now = Date.now();
        let imported = 0;
        
        for (const [key, item] of Object.entries(data)) {
            // 检查是否过期
            if (now <= item.timestamp + item.ttl) {
                this.set(key, item.value, item.ttl - (now - item.timestamp));
                imported++;
            }
        }
        
        return imported;
    }
    
    // 销毁缓存管理器
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
    }
}

// 通知管理器
class NotificationManager {
    constructor() {
        this.permission = Notification.permission;
        this.notifications = [];
        this.maxNotifications = 5;
    }
    
    // 请求通知权限
    async requestPermission() {
        if (!('Notification' in window)) {
            throw new Error('浏览器不支持通知功能');
        }
        
        if (this.permission === 'granted') {
            return true;
        }
        
        if (this.permission === 'denied') {
            throw new Error('通知权限被拒绝');
        }
        
        const permission = await Notification.requestPermission();
        this.permission = permission;
        
        return permission === 'granted';
    }
    
    // 显示通知
    async show(title, options = {}) {
        try {
            const hasPermission = await this.requestPermission();
            if (!hasPermission) return null;
            
            const notification = new Notification(title, {
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                lang: 'zh-CN',
                renotify: true,
                requireInteraction: false,
                ...options
            });
            
            // 管理通知数量
            this.notifications.push(notification);
            if (this.notifications.length > this.maxNotifications) {
                const oldNotification = this.notifications.shift();
                oldNotification.close();
            }
            
            // 自动关闭
            const timeout = options.timeout || 5000;
            setTimeout(() => {
                if (this.notifications.includes(notification)) {
                    notification.close();
                    this.removeNotification(notification);
                }
            }, timeout);
            
            // 绑定事件
            notification.onclick = (event) => {
                event.preventDefault();
                window.focus();
                
                if (options.onClick) {
                    options.onClick(event);
                }
                
                notification.close();
                this.removeNotification(notification);
            };
            
            notification.onclose = () => {
                this.removeNotification(notification);
            };
            
            return notification;
            
        } catch (error) {
            console.error('显示通知失败:', error);
            return null;
        }
    }
    
    // 移除通知
    removeNotification(notification) {
        const index = this.notifications.indexOf(notification);
        if (index > -1) {
            this.notifications.splice(index, 1);
        }
    }
    
    // 关闭所有通知
    closeAll() {
        this.notifications.forEach(notification => {
            notification.close();
        });
        this.notifications = [];
    }
    
    // 检查通知支持
    isSupported() {
        return 'Notification' in window;
    }
    
    // 获取通知状态
    getStatus() {
        return {
            supported: this.isSupported(),
            permission: this.permission,
            active: this.notifications.length,
            maxNotifications: this.maxNotifications
        };
    }
}

// Toast通知管理器
class ToastManager {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxToasts = 5;
        this.defaultDuration = 3000;
        
        this.init();
    }
    
    // 初始化Toast容器
    init() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
    }
    
    // 显示Toast
    show(message, type = 'info', duration = this.defaultDuration, options = {}) {
        const toast = this.createToast(message, type, options);
        
        // 添加到容器
        this.container.appendChild(toast);
        this.toasts.push(toast);
        
        // 管理Toast数量
        if (this.toasts.length > this.maxToasts) {
            const oldToast = this.toasts.shift();
            this.removeToast(oldToast);
        }
        
        // 显示动画
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }
        
        return toast;
    }
    
    // 创建Toast元素
    createToast(message, type, options) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: var(--bg-primary, #ffffff);
            color: var(--text-primary, #333333);
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            margin-bottom: 10px;
            transform: translateX(100%);
            transition: all 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
            border-left: 4px solid;
            max-width: 350px;
            word-wrap: break-word;
        `;
        
        // 设置类型样式
        const typeColors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#06b6d4'
        };
        
        toast.style.borderLeftColor = typeColors[type] || typeColors.info;
        
        // 添加图标和内容
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${icons[type] || icons.info}</span>
                <span>${message}</span>
                ${options.closable !== false ? '<span style="margin-left: auto; cursor: pointer; opacity: 0.7;">×</span>' : ''}
            </div>
        `;
        
        // 点击关闭
        toast.addEventListener('click', () => {
            this.removeToast(toast);
        });
        
        return toast;
    }
    
    // 移除Toast
    removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('show');
        toast.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            if (toast.parentNode) {
                this.container.removeChild(toast);
            }
            
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }
    
    // 清除所有Toast
    clearAll() {
        this.toasts.forEach(toast => {
            this.removeToast(toast);
        });
    }
    
    // 快捷方法
    success(message, duration, options) {
        return this.show(message, 'success', duration, options);
    }
    
    error(message, duration, options) {
        return this.show(message, 'error', duration, options);
    }
    
    warning(message, duration, options) {
        return this.show(message, 'warning', duration, options);
    }
    
    info(message, duration, options) {
        return this.show(message, 'info', duration, options);
    }
}

// 加载管理器
class LoadingManager {
    constructor() {
        this.loadingElement = null;
        this.isVisible = false;
        this.stack = [];
    }
    
    // 显示加载
    show(message = '加载中...', blocking = true) {
        const loadingId = Utils.generateId('loading_');
        this.stack.push({ id: loadingId, message, blocking });
        
        if (!this.loadingElement) {
            this.createLoadingElement();
        }
        
        this.updateLoadingElement(message, blocking);
        
        if (!this.isVisible) {
            this.showLoadingElement();
        }
        
        return loadingId;
    }
    
    // 隐藏加载
    hide(loadingId = null) {
        if (loadingId) {
            this.stack = this.stack.filter(item => item.id !== loadingId);
        } else {
            this.stack = [];
        }
        
        if (this.stack.length === 0) {
            this.hideLoadingElement();
        } else {
            const current = this.stack[this.stack.length - 1];
            this.updateLoadingElement(current.message, current.blocking);
        }
    }
    
    // 创建加载元素
    createLoadingElement() {
        this.loadingElement = document.createElement('div');
        this.loadingElement.className = 'loading-overlay';
        this.loadingElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        
        this.loadingElement.innerHTML = `
            <div class="loading-content" style="
                background: var(--bg-primary, #ffffff);
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                text-align: center;
                min-width: 200px;
            ">
                <div class="loading-spinner" style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid var(--accent-primary, #3b82f6);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 20px auto;
                "></div>
                <div class="loading-text" style="
                    color: var(--text-primary, #333333);
                    font-size: 16px;
                    font-weight: 500;
                ">加载中...</div>
            </div>
        `;
        
        // 添加旋转动画
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.loadingElement);
    }
    
    // 更新加载元素
    updateLoadingElement(message, blocking) {
        if (!this.loadingElement) return;
        
        const textElement = this.loadingElement.querySelector('.loading-text');
        if (textElement) {
            textElement.textContent = message;
        }
        
        // 如果不是阻塞式加载，允许点击背景关闭
        if (!blocking) {
            this.loadingElement.style.pointerEvents = 'auto';
            this.loadingElement.addEventListener('click', (e) => {
                if (e.target === this.loadingElement) {
                    this.hide();
                }
            });
        } else {
            this.loadingElement.style.pointerEvents = 'none';
        }
    }
    
    // 显示加载元素
    showLoadingElement() {
        if (!this.loadingElement || this.isVisible) return;
        
        this.isVisible = true;
        this.loadingElement.style.display = 'flex';
        
        requestAnimationFrame(() => {
            this.loadingElement.style.opacity = '1';
        });
    }
    
    // 隐藏加载元素
    hideLoadingElement() {
        if (!this.loadingElement || !this.isVisible) return;
        
        this.isVisible = false;
        this.loadingElement.style.opacity = '0';
        
        setTimeout(() => {
            if (this.loadingElement && !this.isVisible) {
                this.loadingElement.style.display = 'none';
            }
        }, 300);
    }
    
    // 获取加载状态
    getStatus() {
        return {
            visible: this.isVisible,
            stackSize: this.stack.length,
            current: this.stack[this.stack.length - 1] || null
        };
    }
}

// 创建全局实例
const globalEventManager = new EventManager();
const globalCacheManager = new CacheManager();
const notificationManager = new NotificationManager();
const toastManager = new ToastManager();
const loadingManager = new LoadingManager();

// 全局函数封装
function showToast(message, type = 'info', duration = 3000, options = {}) {
    return toastManager.show(message, type, duration, options);
}

function showLoading(show = true, message = '加载中...', blocking = true) {
    if (show) {
        return loadingManager.show(message, blocking);
    } else {
        loadingManager.hide();
    }
}

function showNotification(title, options = {}) {
    return notificationManager.show(title, options);
}

// 导出到全局作用域
window.Utils = Utils;
window.StorageManager = StorageManager;
window.EventManager = EventManager;
window.CacheManager = CacheManager;
window.NotificationManager = NotificationManager;
window.ToastManager = ToastManager;
window.LoadingManager = LoadingManager;

// 全局实例
window.eventManager = globalEventManager;
window.cacheManager = globalCacheManager;
window.notificationManager = notificationManager;
window.toastManager = toastManager;
window.loadingManager = loadingManager;

// 全局函数
window.showToast = showToast;
window.showLoading = showLoading;
window.showNotification = showNotification;

// 性能监控工具
const PerformanceMonitor = {
    marks: new Map(),
    measures: new Map(),
    
    // 标记时间点
    mark(name) {
        const timestamp = performance.now();
        this.marks.set(name, timestamp);
        
        if (performance.mark) {
            performance.mark(name);
        }
        
        return timestamp;
    },
    
    // 测量时间间隔
    measure(name, startMark, endMark = null) {
        const startTime = this.marks.get(startMark);
        const endTime = endMark ? this.marks.get(endMark) : performance.now();
        
        if (!startTime) {
            console.warn(`未找到起始标记: ${startMark}`);
            return null;
        }
        
        const duration = endTime - startTime;
        this.measures.set(name, duration);
        
        if (performance.measure) {
            performance.measure(name, startMark, endMark);
        }
        
        console.log(`📊 ${name}: ${duration.toFixed(2)}ms`);
        return duration;
    },
    
    // 获取所有测量结果
    getAll() {
        return {
            marks: Object.fromEntries(this.marks),
            measures: Object.fromEntries(this.measures)
        };
    },
    
    // 清空记录
    clear() {
        this.marks.clear();
        this.measures.clear();
        
        if (performance.clearMarks) {
            performance.clearMarks();
        }
        
        if (performance.clearMeasures) {
            performance.clearMeasures();
        }
    },
    
    // 生成性能报告
    generateReport() {
        const report = {
            timestamp: Date.now(),
            marks: Object.fromEntries(this.marks),
            measures: Object.fromEntries(this.measures),
            navigation: this.getNavigationTiming(),
            memory: Utils.getMemoryUsage(),
            connection: Utils.getConnectionInfo()
        };
        
        return report;
    },
    
    // 获取导航时序
    getNavigationTiming() {
        if (!performance.timing) return null;
        
        const timing = performance.timing;
        const start = timing.navigationStart;
        
        return {
            domainLookup: timing.domainLookupEnd - timing.domainLookupStart,
            connect: timing.connectEnd - timing.connectStart,
            request: timing.responseStart - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            domLoading: timing.domLoading - start,
            domInteractive: timing.domInteractive - start,
            domContentLoaded: timing.domContentLoadedEventEnd - start,
            loadComplete: timing.loadEventEnd - start
        };
    }
};

// 资源监控器
const ResourceMonitor = {
    observers: [],
    resources: [],
    
    // 开始监控
    start() {
        // 监控现有资源
        this.trackExistingResources();
        
        // 监控新资源
        this.setupPerformanceObserver();
        
        // 监控图片加载
        this.setupImageObserver();
        
        console.log('📈 资源监控已启动');
    },
    
    // 跟踪现有资源
    trackExistingResources() {
        if (!performance.getEntriesByType) return;
        
        const resources = performance.getEntriesByType('resource');
        this.resources.push(...resources.map(this.formatResourceEntry));
    },
    
    // 设置性能观察器
    setupPerformanceObserver() {
        if (!window.PerformanceObserver) return;
        
        try {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach(entry => {
                    this.resources.push(this.formatResourceEntry(entry));
                });
            });
            
            observer.observe({ entryTypes: ['resource'] });
            this.observers.push(observer);
            
        } catch (error) {
            console.warn('无法启动性能观察器:', error);
        }
    },
    
    // 设置图片观察器
    setupImageObserver() {
        if (!window.IntersectionObserver) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.trackImageLoad(img);
                    observer.unobserve(img);
                }
            });
        });
        
        // 观察所有图片
        document.querySelectorAll('img[data-src]').forEach(img => {
            observer.observe(img);
        });
        
        this.observers.push(observer);
    },
    
    // 跟踪图片加载
    trackImageLoad(img) {
        const startTime = performance.now();
        
        img.addEventListener('load', () => {
            const loadTime = performance.now() - startTime;
            this.resources.push({
                name: img.src,
                type: 'image',
                size: img.naturalWidth * img.naturalHeight,
                loadTime: loadTime,
                timestamp: Date.now()
            });
        });
        
        img.addEventListener('error', () => {
            console.warn('图片加载失败:', img.src);
        });
        
        if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
        }
    },
    
    // 格式化资源条目
    formatResourceEntry(entry) {
        return {
            name: entry.name,
            type: this.getResourceType(entry),
            size: entry.transferSize || 0,
            loadTime: entry.duration,
            timestamp: entry.startTime + performance.timeOrigin
        };
    },
    
    // 获取资源类型
    getResourceType(entry) {
        if (entry.initiatorType) return entry.initiatorType;
        
        const url = entry.name;
        if (/\.(js)$/i.test(url)) return 'script';
        if (/\.(css)$/i.test(url)) return 'stylesheet';
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(url)) return 'image';
        if (/\.(woff|woff2|ttf|otf)$/i.test(url)) return 'font';
        
        return 'other';
    },
    
    // 获取资源统计
    getStats() {
        const stats = {
            total: this.resources.length,
            totalSize: 0,
            totalLoadTime: 0,
            byType: {}
        };
        
        this.resources.forEach(resource => {
            stats.totalSize += resource.size;
            stats.totalLoadTime += resource.loadTime;
            
            if (!stats.byType[resource.type]) {
                stats.byType[resource.type] = {
                    count: 0,
                    size: 0,
                    loadTime: 0
                };
            }
            
            stats.byType[resource.type].count++;
            stats.byType[resource.type].size += resource.size;
            stats.byType[resource.type].loadTime += resource.loadTime;
        });
        
        return stats;
    },
    
    // 生成报告
    generateReport() {
        const stats = this.getStats();
        
        console.group('📊 资源加载报告');
        console.log(`总资源数: ${stats.total}`);
        console.log(`总大小: ${Utils.formatFileSize(stats.totalSize)}`);
        console.log(`总加载时间: ${stats.totalLoadTime.toFixed(2)}ms`);
        
        console.log('\n按类型统计:');
        Object.entries(stats.byType).forEach(([type, data]) => {
            console.log(`${type}: ${data.count}个, ${Utils.formatFileSize(data.size)}, ${data.loadTime.toFixed(2)}ms`);
        });
        
        console.groupEnd();
        
        return stats;
    },
    
    // 停止监控
    stop() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
        console.log('📈 资源监控已停止');
    }
};

// 错误监控器
const ErrorMonitor = {
    errors: [],
    maxErrors: 100,
    
    // 开始监控
    start() {
        // JavaScript错误
        window.addEventListener('error', (event) => {
            this.recordError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: Date.now()
            });
        });
        
        // Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.recordError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled Promise Rejection',
                reason: event.reason,
                stack: event.reason?.stack,
                timestamp: Date.now()
            });
        });
        
        // 资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.recordError({
                    type: 'resource',
                    message: `Failed to load ${event.target.tagName}`,
                    source: event.target.src || event.target.href,
                    timestamp: Date.now()
                });
            }
        }, true);
        
        console.log('🚨 错误监控已启动');
    },
    
    // 记录错误
    recordError(error) {
        this.errors.push(error);
        
        // 限制错误数量
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }
        
        // 发送错误报告（如果已登录）
        if (window.authManager?.isAuthenticated()) {
            this.sendErrorReport(error);
        }
        
        console.error('🚨 错误记录:', error);
    },
    
    // 发送错误报告
    async sendErrorReport(error) {
        try {
            if (window.API) {
                await window.API.recordAction('client_error', {
                    ...error,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                });
            }
        } catch (reportError) {
            console.error('发送错误报告失败:', reportError);
        }
    },
    
    // 获取错误统计
    getStats() {
        const stats = {
            total: this.errors.length,
            byType: {},
            recent: this.errors.slice(-10)
        };
        
        this.errors.forEach(error => {
            if (!stats.byType[error.type]) {
                stats.byType[error.type] = 0;
            }
            stats.byType[error.type]++;
        });
        
        return stats;
    },
    
    // 清空错误记录
    clear() {
        this.errors = [];
        console.log('🧹 错误记录已清空');
    }
};

// 网络质量检测器
const NetworkQualityDetector = {
    quality: 'unknown',
    latency: 0,
    bandwidth: 0,
    
    // 开始检测
    async start() {
        try {
            await this.detectLatency();
            await this.detectBandwidth();
            this.determineQuality();
            
            console.log(`🌐 网络质量: ${this.quality} (延迟: ${this.latency}ms, 带宽: ${Utils.formatFileSize(this.bandwidth)}/s)`);
            
        } catch (error) {
            console.error('网络质量检测失败:', error);
        }
    },
    
    // 检测延迟
    async detectLatency() {
        const start = performance.now();
        
        try {
            const response = await fetch('/favicon.ico?' + Date.now(), {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            this.latency = performance.now() - start;
            
        } catch (error) {
            this.latency = 9999; // 表示网络不可达
        }
    },
    
    // 检测带宽
    async detectBandwidth() {
        // 使用Network Information API（如果可用）
        if (navigator.connection) {
            this.bandwidth = (navigator.connection.downlink || 0) * 125000; // Mbps转字节/秒
            return;
        }
        
        // 降级：下载小文件测试带宽
        const testSize = 50000; // 50KB
        const testData = new Uint8Array(testSize);
        const blob = new Blob([testData]);
        const url = URL.createObjectURL(blob);
        
        const start = performance.now();
        
        try {
            const response = await fetch(url);
            await response.arrayBuffer();
            
            const duration = (performance.now() - start) / 1000;
            this.bandwidth = testSize / duration;
            
        } catch (error) {
            this.bandwidth = 0;
        } finally {
            URL.revokeObjectURL(url);
        }
    },
    
    // 判断网络质量
    determineQuality() {
        if (this.latency > 2000 || this.bandwidth < 50000) {
            this.quality = 'poor';
        } else if (this.latency > 500 || this.bandwidth < 500000) {
            this.quality = 'fair';
        } else if (this.latency > 100 || this.bandwidth < 2000000) {
            this.quality = 'good';
        } else {
            this.quality = 'excellent';
        }
    },
    
    // 获取质量信息
    getQuality() {
        return {
            quality: this.quality,
            latency: this.latency,
            bandwidth: this.bandwidth,
            bandwidthFormatted: Utils.formatFileSize(this.bandwidth) + '/s'
        };
    }
};

// A/B测试管理器
const ABTestManager = {
    tests: new Map(),
    userGroup: null,
    
    // 初始化
    init() {
        this.userGroup = this.getUserGroup();
        console.log(`🧪 A/B测试用户组: ${this.userGroup}`);
    },
    
    // 获取用户组
    getUserGroup() {
        let group = StorageManager.getItem('ab_test_group');
        
        if (!group) {
            // 基于用户ID或随机生成
            const userId = window.authManager?.getCurrentUser()?.id;
            const seed = userId || Date.now().toString();
            
            // 简单哈希生成稳定的分组
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                const char = seed.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            
            group = Math.abs(hash) % 2 === 0 ? 'A' : 'B';
            StorageManager.setItem('ab_test_group', group);
        }
        
        return group;
    },
    
    // 注册测试
    registerTest(name, variants) {
        this.tests.set(name, {
            variants,
            active: true,
            startTime: Date.now()
        });
        
        console.log(`🧪 注册A/B测试: ${name}`, variants);
    },
    
    // 获取变体
    getVariant(testName, defaultVariant = null) {
        const test = this.tests.get(testName);
        if (!test || !test.active) {
            return defaultVariant;
        }
        
        const variants = Object.keys(test.variants);
        if (variants.length === 0) return defaultVariant;
        
        // 基于用户组选择变体
        const index = this.userGroup === 'A' ? 0 : 1;
        const variant = variants[index % variants.length];
        
        // 记录测试参与
        this.recordParticipation(testName, variant);
        
        return test.variants[variant] || defaultVariant;
    },
    
    // 记录参与
    recordParticipation(testName, variant) {
        if (window.API && window.authManager?.isAuthenticated()) {
            window.API.recordAction('ab_test_participation', {
                testName,
                variant,
                userGroup: this.userGroup,
                timestamp: Date.now()
            }).catch(console.error);
        }
    },
    
    // 记录转化
    recordConversion(testName, conversionType = 'default') {
        if (window.API && window.authManager?.isAuthenticated()) {
            window.API.recordAction('ab_test_conversion', {
                testName,
                conversionType,
                userGroup: this.userGroup,
                timestamp: Date.now()
            }).catch(console.error);
        }
    }
};

// 用户行为跟踪器
const UserBehaviorTracker = {
    events: [],
    sessionId: null,
    isTracking: false,
    
    // 开始跟踪
    start() {
        if (this.isTracking) return;
        
        this.sessionId = Utils.generateId('session_');
        this.isTracking = true;
        
        this.setupEventListeners();
        console.log('👤 用户行为跟踪已启动');
    },
    
    // 设置事件监听器
    setupEventListeners() {
        // 页面浏览
        this.trackEvent('page_view', {
            url: window.location.href,
            title: document.title,
            referrer: document.referrer
        });
        
        // 点击事件
        document.addEventListener('click', (event) => {
            this.trackClickEvent(event);
        });
        
        // 滚动事件
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.trackScrollEvent();
            }, 1000);
        });
        
        // 页面停留时间
        let startTime = Date.now();
        window.addEventListener('beforeunload', () => {
            this.trackEvent('page_duration', {
                duration: Date.now() - startTime
            });
            this.sendEvents();
        });
        
        // 表单交互
        document.addEventListener('submit', (event) => {
            this.trackFormSubmit(event);
        });
        
        // 搜索行为
        document.addEventListener('search', (event) => {
            this.trackSearchEvent(event);
        });
    },
    
    // 跟踪点击事件
    trackClickEvent(event) {
        const target = event.target;
        const data = {
            tagName: target.tagName,
            className: target.className,
            id: target.id,
            text: target.textContent?.substring(0, 100),
            href: target.href,
            coordinates: {
                x: event.clientX,
                y: event.clientY
            }
        };
        
        this.trackEvent('click', data);
    },
    
    // 跟踪滚动事件
    trackScrollEvent() {
        const data = {
            scrollTop: window.pageYOffset,
            scrollHeight: document.documentElement.scrollHeight,
            clientHeight: window.innerHeight,
            scrollPercentage: Math.round((window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100)
        };
        
        this.trackEvent('scroll', data);
    },
    
    // 跟踪表单提交
    trackFormSubmit(event) {
        const form = event.target;
        const data = {
            formId: form.id,
            formClass: form.className,
            action: form.action,
            method: form.method,
            fieldCount: form.elements.length
        };
        
        this.trackEvent('form_submit', data);
    },
    
    // 跟踪搜索事件
    trackSearchEvent(event) {
        const data = {
            query: event.detail?.query,
            results: event.detail?.results?.length || 0,
            searchTime: event.detail?.searchTime || 0
        };
        
        this.trackEvent('search', data);
    },
    
    // 跟踪事件
    trackEvent(eventType, data = {}) {
        const event = {
            type: eventType,
            data: data,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        this.events.push(event);
        
        // 限制事件数量
        if (this.events.length > 1000) {
            this.sendEvents();
        }
    },
    
    // 发送事件
    async sendEvents() {
        if (this.events.length === 0 || !window.API || !window.authManager?.isAuthenticated()) {
            return;
        }
        
        try {
            await window.API.recordAction('user_behavior_batch', {
                sessionId: this.sessionId,
                events: this.events.splice(0, 100), // 批量发送前100个事件
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('发送用户行为数据失败:', error);
        }
    },
    
    // 停止跟踪
    stop() {
        this.isTracking = false;
        this.sendEvents();
        console.log('👤 用户行为跟踪已停止');
    }
};

// 设备指纹生成器
const DeviceFingerprint = {
    fingerprint: null,
    
    // 生成设备指纹
    async generate() {
        const components = await Promise.all([
            this.getScreenFingerprint(),
            this.getCanvasFingerprint(),
            this.getWebGLFingerprint(),
            this.getAudioFingerprint(),
            this.getFontFingerprint(),
            this.getTimezoneFingerprint(),
            this.getLanguageFingerprint(),
            this.getPluginFingerprint()
        ]);
        
        const fingerprint = this.hashComponents(components);
        this.fingerprint = fingerprint;
        
        return fingerprint;
    },
    
    // 屏幕指纹
    getScreenFingerprint() {
        return {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio
        };
    },
    
    // Canvas指纹
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Device fingerprint test 🔒', 2, 2);
            
            return canvas.toDataURL();
        } catch (error) {
            return 'canvas_not_supported';
        }
    },
    
    // WebGL指纹
    getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) return 'webgl_not_supported';
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            return {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                version: gl.getParameter(gl.VERSION),
                unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'not_available',
                unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'not_available'
            };
        } catch (error) {
            return 'webgl_error';
        }
    },
    
    // 音频指纹
    async getAudioFingerprint() {
        try {
            if (!window.AudioContext && !window.webkitAudioContext) {
                return 'audio_not_supported';
            }
            
            const context = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(10000, context.currentTime);
            
            gainNode.gain.setValueAtTime(0, context.currentTime);
            
            oscillator.connect(analyser);
            analyser.connect(gainNode);
            gainNode.connect(context.destination);
            
            oscillator.start(0);
            
            const frequencyData = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(frequencyData);
            
            oscillator.stop();
            context.close();
            
            return Array.from(frequencyData).slice(0, 30).join(',');
        } catch (error) {
            return 'audio_error';
        }
    },
    
    // 字体指纹
    getFontFingerprint() {
        const baseFonts = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS', 'Arial Black', 'Impact'];
        const testString = 'mmmmmmmmmmlli';
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const fontWidths = baseFonts.map(font => {
            ctx.font = `72px ${font}`;
            return ctx.measureText(testString).width;
        });
        
        return fontWidths.join(',');
    },
    
    // 时区指纹
    getTimezoneFingerprint() {
        return {
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            locale: navigator.language
        };
    },
    
    // 语言指纹
    getLanguageFingerprint() {
        return {
            language: navigator.language,
            languages: navigator.languages ? navigator.languages.join(',') : 'not_available'
        };
    },
    
    // 插件指纹
    getPluginFingerprint() {
        if (!navigator.plugins) return 'plugins_not_available';
        
        const plugins = Array.from(navigator.plugins).map(plugin => ({
            name: plugin.name,
            filename: plugin.filename,
            description: plugin.description
        }));
        
        return plugins.slice(0, 10); // 只取前10个插件
    },
    
    // 哈希组件
    hashComponents(components) {
        const str = JSON.stringify(components);
        let hash = 0;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return Math.abs(hash).toString(16);
    },
    
    // 获取指纹
    getFingerprint() {
        return this.fingerprint;
    }
};

// 导出所有工具到全局作用域
window.PerformanceMonitor = PerformanceMonitor;
window.ResourceMonitor = ResourceMonitor;
window.ErrorMonitor = ErrorMonitor;
window.NetworkQualityDetector = NetworkQualityDetector;
window.ABTestManager = ABTestManager;
window.UserBehaviorTracker = UserBehaviorTracker;
window.DeviceFingerprint = DeviceFingerprint;

// 自动启动某些监控器
document.addEventListener('DOMContentLoaded', () => {
    // 启动错误监控
    ErrorMonitor.start();
    
    // 启动A/B测试管理器
    ABTestManager.init();
    
    // 如果用户同意，启动行为跟踪
    const trackingConsent = StorageManager.getItem('tracking_consent');
    if (trackingConsent === 'accepted') {
        UserBehaviorTracker.start();
    }
    
    // 检测网络质量
    NetworkQualityDetector.start().catch(console.error);
    
    console.log('🛠️ 工具函数库加载完成');
});

// 导出类供其他模块使用
export { 
    Utils, 
    StorageManager, 
    EventManager, 
    CacheManager, 
    NotificationManager, 
    ToastManager, 
    LoadingManager,
    PerformanceMonitor,
    ResourceMonitor,
    ErrorMonitor,
    NetworkQualityDetector,
    ABTestManager,
    UserBehaviorTracker,
    DeviceFingerprint
};
