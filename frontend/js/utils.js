// 工具函数模块
class Utils {
    constructor() {
        // 初始化存储管理器
        this.storage = new StorageManager('magnets_');
    }
    
    // 生成唯一的请求ID
    generateRequestId() {
        return 'req_' + Math.random().toString(36).substring(2, 10);
    }
    
    // 生成随机字符串
    generateRandomString(length = 8) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // 转义HTML特殊字符
    escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // 生成基于关键字的ID
    generateId(keyword = '') {
        const encoder = new TextEncoder();
        const data = encoder.encode(keyword + Date.now());
        return crypto.subtle.digest('SHA-1', data).then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        });
    }
}

// 本地存储管理封装
class StorageManager {
    constructor(namespace = '') {
        this.namespace = namespace;
    }
    
    get(key, defaultValue = null) {
        const namespacedKey = this.getNamespacedKey(key);
        const value = localStorage.getItem(namespacedKey);
        
        if (value === null) {
            return defaultValue;
        }
        
        try {
            return JSON.parse(value);
        } catch (e) {
            return value;
        }
    }
    
    set(key, value) {
        const namespacedKey = this.getNamespacedKey(key);
        localStorage.setItem(namespacedKey, JSON.stringify(value));
    }
    
    remove(key) {
        const namespacedKey = this.getNamespacedKey(key);
        localStorage.removeItem(namespacedKey);
    }
    
    getNamespacedKey(key) {
        return this.namespace + key;
    }
}

// 创建工具实例
const utils = new Utils();