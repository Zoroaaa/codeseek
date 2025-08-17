// 存储管理工具
import { APP_CONSTANTS } from '../core/constants.js';

class StorageManager {
  constructor() {
    // 允许的系统设置键名
    this.allowedKeys = [
      APP_CONSTANTS.STORAGE_KEYS.THEME,
      APP_CONSTANTS.STORAGE_KEYS.APP_VERSION,
      APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN,
      APP_CONSTANTS.STORAGE_KEYS.API_CONFIG,
      APP_CONSTANTS.STORAGE_KEYS.CURRENT_USER
    ];
  }

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
  }

  getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('读取数据失败:', error);
      return defaultValue;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('删除数据失败:', error);
      return false;
    }
  }

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
  }

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
}

// Cookie工具函数
export const CookieUtils = {
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

// 创建单例实例
export const storageManager = new StorageManager();
export default storageManager;