import { APP_CONSTANTS } from '../../shared/constants.js';
import { safeJsonParse, safeJsonStringify } from '../utils/common.js';

/**
 * 存储管理器 - 仅用于系统设置
 */
export class StorageManager {
  constructor() {
    this.allowedKeys = APP_CONSTANTS.STORAGE.ALLOWED_SYSTEM_KEYS;
  }

  // 安全的localStorage操作 - 仅限系统设置
  setItem(key, value) {
    if (!this.allowedKeys.includes(key)) {
      console.warn(`StorageManager: 不允许存储业务数据 "${key}"`);
      return false;
    }

    try {
      const serialized = safeJsonStringify(value);
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
      return item ? safeJsonParse(item, defaultValue) : defaultValue;
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

  // 检查存储容量
  checkStorageQuota() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate().then(estimate => {
        return {
          usage: estimate.usage,
          quota: estimate.quota,
          usagePercentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
      });
    }
    return Promise.resolve(null);
  }
}

// 创建全局实例
export const storage = new StorageManager();