// src/services/cache-manager.js - 详情缓存管理服务（Cloudflare Workers 兼容版本）
import { utils } from '../utils.js';
import { CONFIG } from '../constants.js';

export class CacheManagerService {
  constructor() {
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.CACHE_MAX_SIZE; // 从配置引用
    this.defaultTTL = CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION; // 从配置引用
    this.cleanupInterval = CONFIG.DETAIL_EXTRACTION.CACHE_CLEANUP_INTERVAL; // 从配置引用
    this.compressionEnabled = true;
    this.cleanupTimer = null;
    this.initialized = false;
    
    // 内存缓存（用于 Workers 环境）
    this.memoryCache = new Map();
    this.env = null; // 存储 env 对象以访问 KV
  }

  /**
   * 初始化缓存管理器
   * @param {Object} env - Cloudflare Workers 环境对象
   */
  async initialize(env) {
    if (this.initialized) return;
    
    this.env = env;
    this.initialized = true;
    
    // 在 Workers 环境中不启动定时器
    if (this.isWorkersEnvironment()) {
      console.log('Cloudflare Workers 环境：跳过定时器初始化');
    } else {
      this.startCleanupTimer();
    }
  }

  /**
   * 检查是否为 Cloudflare Workers 环境
   */
  isWorkersEnvironment() {
    return typeof caches !== 'undefined' && typeof globalThis.crypto !== 'undefined' && 
           typeof fetch === 'function' && typeof addEventListener === 'function';
  }

  /**
   * 获取详情缓存
   * @param {string} url - 搜索结果URL
   * @returns {Object|null} 缓存的详情信息
   */
  async getDetailCache(url) {
    if (!url) return null;

    try {
      const cacheKey = this.generateCacheKey(url);
      const cached = await this.getCacheItem(cacheKey);
      
      if (!cached) return null;

      // 检查是否过期
      if (Date.now() > cached.expiresAt) {
        await this.deleteCacheItem(cacheKey);
        return null;
      }

      // 解压缩数据（如果需要）
      const data = this.compressionEnabled ? 
        this.decompressData(cached.data) : cached.data;

      console.log(`缓存命中: ${url}`);
      
      // 更新访问时间
      cached.lastAccessed = Date.now();
      cached.accessCount = (cached.accessCount || 0) + 1;
      await this.setCacheItem(cacheKey, cached);

      return data;

    } catch (error) {
      console.error('获取详情缓存失败:', error);
      return null;
    }
  }

  /**
   * 设置详情缓存
   * @param {string} url - 搜索结果URL
   * @param {Object} detailData - 详情数据
   * @param {number} ttl - 生存时间（毫秒）
   * @returns {boolean} 是否设置成功
   */
  async setDetailCache(url, detailData, ttl = this.defaultTTL) {
    if (!url || !detailData) return false;

    try {
      const cacheKey = this.generateCacheKey(url);
      
      // 压缩数据（如果可用）
      const data = this.compressionEnabled ? 
        this.compressData(detailData) : detailData;

      const cacheItem = {
        key: cacheKey,
        data: data,
        url: url,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        lastAccessed: Date.now(),
        accessCount: 0,
        size: this.calculateDataSize(detailData)
      };

      await this.setCacheItem(cacheKey, cacheItem);
      
      // 检查缓存大小限制
      await this.enforceSizeLimit();

      console.log(`详情缓存已保存: ${url} (TTL: ${ttl}ms)`);
      return true;

    } catch (error) {
      console.error('设置详情缓存失败:', error);
      return false;
    }
  }

  /**
   * 删除详情缓存
   * @param {string} url - 搜索结果URL
   * @returns {boolean} 是否删除成功
   */
  async deleteDetailCache(url) {
    if (!url) return false;

    try {
      const cacheKey = this.generateCacheKey(url);
      await this.deleteCacheItem(cacheKey);
      console.log(`详情缓存已删除: ${url}`);
      return true;

    } catch (error) {
      console.error('删除详情缓存失败:', error);
      return false;
    }
  }

  /**
   * 清理过期缓存
   * @returns {number} 清理的条目数
   */
  async cleanupExpiredCache() {
    try {
      const allKeys = await this.getAllCacheKeys();
      let cleanedCount = 0;
      const now = Date.now();

      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item && now > item.expiresAt) {
          await this.deleteCacheItem(key);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`清理了 ${cleanedCount} 个过期缓存条目`);
      }

      return cleanedCount;

    } catch (error) {
      console.error('清理过期缓存失败:', error);
      return 0;
    }
  }

  /**
   * 清空所有缓存
   * @returns {boolean} 是否清空成功
   */
  async clearAllCache() {
    try {
      await this.clearStorage();
      console.log('所有详情缓存已清空');
      return true;

    } catch (error) {
      console.error('清空缓存失败:', error);
      return false;
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  async getCacheStats() {
    try {
      const allKeys = await this.getAllCacheKeys();
      const stats = {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        oldestItem: null,
        newestItem: null,
        mostAccessed: null,
        averageSize: 0,
        hitRate: 0
      };

      const now = Date.now();
      let totalAccessCount = 0;
      let totalHits = 0;

      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (!item) continue;

        stats.totalItems++;
        stats.totalSize += item.size || 0;
        totalAccessCount += item.accessCount || 0;
        
        if (item.accessCount && item.accessCount > 0) {
          totalHits += item.accessCount;
        }

        if (now > item.expiresAt) {
          stats.expiredItems++;
        }

        if (!stats.oldestItem || item.createdAt < stats.oldestItem.createdAt) {
          stats.oldestItem = item;
        }

        if (!stats.newestItem || item.createdAt > stats.newestItem.createdAt) {
          stats.newestItem = item;
        }

        if (!stats.mostAccessed || (item.accessCount || 0) > (stats.mostAccessed.accessCount || 0)) {
          stats.mostAccessed = item;
        }
      }

      stats.averageSize = stats.totalItems > 0 ? stats.totalSize / stats.totalItems : 0;
      stats.hitRate = totalAccessCount > 0 ? (totalHits / totalAccessCount) * 100 : 0;

      return stats;

    } catch (error) {
      console.error('获取缓存统计失败:', error);
      return {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        averageSize: 0,
        hitRate: 0
      };
    }
  }

  /**
   * 生成缓存键
   * @param {string} url - URL
   * @returns {string} 缓存键
   */
  generateCacheKey(url) {
    // 使用URL的哈希作为缓存键，避免特殊字符问题
    return 'detail_' + utils.hashPassword(url).substring(0, 16);
  }

  /**
   * 从存储中获取缓存项
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存项
   */
  async getCacheItem(key) {
    try {
      // 优先使用 KV 存储（Workers 环境）
      if (this.env && this.env.CACHE_KV) {
        const item = await this.env.CACHE_KV.get(key, 'json');
        return item;
      }
      
      // 降级到内存缓存
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key);
      }
      
      // 最后尝试 localStorage（浏览器环境）
      if (typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      
      return null;

    } catch (error) {
      console.warn('获取缓存项失败，尝试删除损坏的数据:', error);
      await this.deleteCacheItem(key);
      return null;
    }
  }

  /**
   * 向存储中设置缓存项
   * @param {string} key - 缓存键
   * @param {Object} item - 缓存项
   */
  async setCacheItem(key, item) {
    try {
      // 优先使用 KV 存储（Workers 环境）
      if (this.env && this.env.CACHE_KV) {
        const ttlSeconds = Math.ceil((item.expiresAt - Date.now()) / 1000);
        if (ttlSeconds > 0) {
          await this.env.CACHE_KV.put(key, JSON.stringify(item), {
            expirationTtl: ttlSeconds
          });
        }
        return;
      }
      
      // 降级到内存缓存
      this.memoryCache.set(key, item);
      
      // 限制内存缓存大小
      if (this.memoryCache.size > this.maxCacheSize) {
        await this.cleanupLeastRecentlyUsed(10);
      }
      
      // 最后尝试 localStorage（浏览器环境）
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(item));
      }

    } catch (error) {
      console.warn('缓存存储失败，尝试清理空间:', error);
      await this.cleanupLeastRecentlyUsed();
      
      // 再次尝试存储到内存
      try {
        this.memoryCache.set(key, item);
      } catch (retryError) {
        console.error('重试缓存存储仍然失败:', retryError);
      }
    }
  }

  /**
   * 从存储中删除缓存项
   * @param {string} key - 缓存键
   */
  async deleteCacheItem(key) {
    try {
      // KV 存储
      if (this.env && this.env.CACHE_KV) {
        await this.env.CACHE_KV.delete(key);
      }
      
      // 内存缓存
      this.memoryCache.delete(key);
      
      // localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('删除缓存项失败:', error);
    }
  }

  /**
   * 获取所有缓存键
   * @returns {Array} 缓存键数组
   */
  async getAllCacheKeys() {
    try {
      const keys = [];
      
      // KV 存储的键列表（如果支持）
      if (this.env && this.env.CACHE_KV && this.env.CACHE_KV.list) {
        try {
          const kvKeys = await this.env.CACHE_KV.list({ prefix: 'detail_' });
          keys.push(...kvKeys.keys.map(k => k.name));
        } catch (kvError) {
          console.warn('获取 KV 键列表失败:', kvError);
        }
      }
      
      // 内存缓存键
      keys.push(...Array.from(this.memoryCache.keys()).filter(k => k.startsWith('detail_')));
      
      // localStorage 键（浏览器环境）
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('detail_') && !keys.includes(key)) {
            keys.push(key);
          }
        }
      }
      
      // 去重
      return [...new Set(keys)];

    } catch (error) {
      console.error('获取缓存键失败:', error);
      return [];
    }
  }

  /**
   * 清空存储
   */
  async clearStorage() {
    try {
      // 清空 KV 存储（批量删除）
      if (this.env && this.env.CACHE_KV) {
        const keys = await this.getAllCacheKeys();
        for (const key of keys) {
          if (key.startsWith('detail_')) {
            await this.env.CACHE_KV.delete(key);
          }
        }
      }
      
      // 清空内存缓存
      this.memoryCache.clear();
      
      // 清空 localStorage（浏览器环境）
      if (typeof localStorage !== 'undefined') {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('detail_')) {
            keys.push(key);
          }
        }
        keys.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error('清空存储失败:', error);
    }
  }

  /**
   * 强制执行缓存大小限制
   */
  async enforceSizeLimit() {
    try {
      const allKeys = await this.getAllCacheKeys();
      
      if (allKeys.length <= this.maxCacheSize) {
        return;
      }

      // 获取所有缓存项并按最后访问时间排序
      const items = [];
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          items.push(item);
        }
      }

      items.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));

      // 删除最久未访问的项目
      const itemsToDelete = items.slice(0, items.length - this.maxCacheSize);
      for (const item of itemsToDelete) {
        await this.deleteCacheItem(item.key);
      }

      console.log(`强制清理了 ${itemsToDelete.length} 个缓存项以满足大小限制`);

    } catch (error) {
      console.error('强制执行大小限制失败:', error);
    }
  }

  /**
   * 清理最近最少使用的缓存项
   * @param {number} count - 要清理的数量
   */
  async cleanupLeastRecentlyUsed(count = 10) {
    try {
      const allKeys = await this.getAllCacheKeys();
      const items = [];

      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          items.push(item);
        }
      }

      // 按最后访问时间排序，清理最久未访问的
      items.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      
      const itemsToDelete = items.slice(0, Math.min(count, items.length));
      for (const item of itemsToDelete) {
        await this.deleteCacheItem(item.key);
      }

      console.log(`清理了 ${itemsToDelete.length} 个最近最少使用的缓存项`);

    } catch (error) {
      console.error('清理LRU缓存失败:', error);
    }
  }

  /**
   * 压缩数据
   * @param {Object} data - 要压缩的数据
   * @returns {string} 压缩后的数据
   */
  compressData(data) {
    try {
      // 简单的JSON字符串压缩（移除不必要的空格）
      return JSON.stringify(data);
    } catch (error) {
      console.error('数据压缩失败:', error);
      return data;
    }
  }

  /**
   * 解压缩数据
   * @param {string} compressedData - 压缩的数据
   * @returns {Object} 解压缩后的数据
   */
  decompressData(compressedData) {
    try {
      if (typeof compressedData === 'string') {
        return JSON.parse(compressedData);
      }
      return compressedData;
    } catch (error) {
      console.error('数据解压缩失败:', error);
      return compressedData;
    }
  }

  /**
   * 计算数据大小
   * @param {Object} data - 数据对象
   * @returns {number} 大小（字节）
   */
  calculateDataSize(data) {
    try {
      return JSON.stringify(data).length * 2; // 粗略估算UTF-16字符大小
    } catch (error) {
      return 0;
    }
  }

  /**
   * 启动清理定时器（仅在支持的环境中）
   */
  startCleanupTimer() {
    if (this.isWorkersEnvironment()) {
      console.log('Cloudflare Workers 环境：跳过定时器启动');
      return;
    }

    if (typeof setInterval === 'undefined') {
      console.log('定时器在当前环境中不可用，跳过自动清理');
      return;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredCache();
    }, this.cleanupInterval);

    console.log('缓存清理定时器已启动');
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log('缓存清理定时器已停止');
    }
  }

  /**
   * 预热缓存（预加载常用内容）
   * @param {Array} urls - 要预热的URL列表
   */
  async warmupCache(urls = []) {
    console.log(`开始预热 ${urls.length} 个URL的缓存`);
    
    for (const url of urls) {
      try {
        const cached = await this.getDetailCache(url);
        if (cached) {
          console.log(`缓存预热命中: ${url}`);
        }
      } catch (error) {
        console.warn(`缓存预热失败 [${url}]:`, error);
      }
    }
  }

  /**
   * 导出缓存数据（用于备份）
   * @returns {Object} 缓存数据
   */
  async exportCacheData() {
    try {
      const allKeys = await this.getAllCacheKeys();
      const exportData = {
        version: '1.0',
        exportTime: Date.now(),
        totalItems: allKeys.length,
        items: []
      };

      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          exportData.items.push({
            key: item.key,
            url: item.url,
            data: item.data,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt
          });
        }
      }

      console.log(`导出了 ${exportData.items.length} 个缓存项`);
      return exportData;

    } catch (error) {
      console.error('导出缓存数据失败:', error);
      return { version: '1.0', exportTime: Date.now(), totalItems: 0, items: [] };
    }
  }

  /**
   * 导入缓存数据（用于恢复）
   * @param {Object} importData - 要导入的缓存数据
   * @returns {boolean} 是否导入成功
   */
  async importCacheData(importData) {
    if (!importData || !Array.isArray(importData.items)) {
      console.error('无效的导入数据格式');
      return false;
    }

    try {
      let importedCount = 0;
      const now = Date.now();

      for (const item of importData.items) {
        // 检查数据完整性
        if (!item.key || !item.url || !item.data) {
          console.warn('跳过无效的缓存项:', item.key);
          continue;
        }

        // 检查是否已过期
        if (item.expiresAt && now > item.expiresAt) {
          console.warn('跳过已过期的缓存项:', item.url);
          continue;
        }

        // 重建缓存项
        const cacheItem = {
          key: item.key,
          data: item.data,
          url: item.url,
          createdAt: item.createdAt || now,
          expiresAt: item.expiresAt || (now + this.defaultTTL),
          lastAccessed: now,
          accessCount: 0,
          size: this.calculateDataSize(item.data)
        };

        await this.setCacheItem(item.key, cacheItem);
        importedCount++;
      }

      console.log(`成功导入了 ${importedCount}/${importData.items.length} 个缓存项`);
      return true;

    } catch (error) {
      console.error('导入缓存数据失败:', error);
      return false;
    }
  }
}

// 创建单例实例（不在构造时初始化）
export const cacheManager = new CacheManagerService();

// 导出初始化函数
export const initializeCacheManager = async (env) => {
  await cacheManager.initialize(env);
  return cacheManager;
};

export default cacheManager;