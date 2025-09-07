// src/services/system/cache-service.js
// 缓存管理服务 - 新增系统服务

export class CacheService {
  constructor() {
    this.caches = new Map(); // 不同类型的缓存存储
    this.policies = new Map(); // 缓存策略
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      evictions: 0
    };
    
    // 默认配置
    this.defaultConfig = {
      maxSize: 1000,
      ttl: 300000, // 5分钟
      enableExpiration: true,
      enableLRU: true,
      enableStats: true,
      compressionThreshold: 1024 // 超过1KB进行压缩
    };
    
    // 清理定时器
    this.cleanupInterval = null;
    this.cleanupIntervalTime = 60000; // 1分钟清理一次
    
    this.isInitialized = false;
  }

  // 初始化
  initialize() {
    // 设置默认缓存类型
    this.setupDefaultCaches();
    
    // 启动清理定时器
    this.startCleanupInterval();
    
    this.isInitialized = true;
    console.log('缓存服务已初始化');
  }

  // 设置默认缓存类型
  setupDefaultCaches() {
    // 搜索结果缓存
    this.createCache('search', {
      maxSize: 500,
      ttl: 300000, // 5分钟
      enableLRU: true
    });
    
    // 用户数据缓存
    this.createCache('user', {
      maxSize: 100,
      ttl: 600000, // 10分钟
      enableLRU: true
    });
    
    // API响应缓存
    this.createCache('api', {
      maxSize: 1000,
      ttl: 180000, // 3分钟
      enableLRU: true
    });
    
    // 搜索源状态缓存
    this.createCache('sourceStatus', {
      maxSize: 200,
      ttl: 300000, // 5分钟
      enableLRU: true
    });
    
    // 社区内容缓存
    this.createCache('community', {
      maxSize: 300,
      ttl: 600000, // 10分钟
      enableLRU: true
    });
    
    // 配置缓存
    this.createCache('config', {
      maxSize: 50,
      ttl: 1800000, // 30分钟
      enableLRU: false
    });
  }

  // 创建缓存实例
  createCache(name, config = {}) {
    const cacheConfig = { ...this.defaultConfig, ...config };
    
    const cache = {
      name,
      config: cacheConfig,
      data: new Map(),
      accessTimes: new Map(), // LRU访问时间
      stats: {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0
      }
    };
    
    this.caches.set(name, cache);
    this.policies.set(name, cacheConfig);
    
    return cache;
  }

  // 获取缓存实例
  getCache(name) {
    return this.caches.get(name);
  }

  // 基础缓存操作 - 设置
  set(key, value, ttl = null, cacheName = 'default') {
    if (!this.isInitialized) {
      this.initialize();
    }

    let cache = this.getCache(cacheName);
    if (!cache) {
      cache = this.createCache(cacheName);
    }

    const now = Date.now();
    const expiration = ttl !== null ? now + ttl : now + cache.config.ttl;
    
    // 压缩大数据
    let compressedValue = value;
    if (this.shouldCompress(value, cache.config.compressionThreshold)) {
      compressedValue = this.compressData(value);
    }

    const cacheItem = {
      value: compressedValue,
      expiration: cache.config.enableExpiration ? expiration : null,
      created: now,
      accessed: now,
      compressed: compressedValue !== value,
      size: this.calculateSize(value)
    };

    // 检查大小限制
    if (cache.config.maxSize && cache.data.size >= cache.config.maxSize) {
      this.evictItems(cache, 1);
    }

    cache.data.set(key, cacheItem);
    
    if (cache.config.enableLRU) {
      cache.accessTimes.set(key, now);
    }

    // 更新统计
    cache.stats.sets++;
    this.stats.sets++;

    return true;
  }

  // 基础缓存操作 - 获取
  get(key, cacheName = 'default') {
    if (!this.isInitialized) {
      this.initialize();
    }

    const cache = this.getCache(cacheName);
    if (!cache) {
      this.stats.misses++;
      return null;
    }

    const item = cache.data.get(key);
    if (!item) {
      cache.stats.misses++;
      this.stats.misses++;
      return null;
    }

    // 检查过期
    if (this.isExpired(item)) {
      this.delete(key, cacheName);
      cache.stats.misses++;
      this.stats.misses++;
      return null;
    }

    // 更新访问时间
    const now = Date.now();
    item.accessed = now;
    
    if (cache.config.enableLRU) {
      cache.accessTimes.set(key, now);
    }

    // 更新统计
    cache.stats.hits++;
    this.stats.hits++;

    // 解压缩数据
    let value = item.value;
    if (item.compressed) {
      value = this.decompressData(value);
    }

    return value;
  }

  // 基础缓存操作 - 删除
  delete(key, cacheName = 'default') {
    const cache = this.getCache(cacheName);
    if (!cache) {
      return false;
    }

    const deleted = cache.data.delete(key);
    
    if (deleted) {
      cache.accessTimes.delete(key);
      cache.stats.deletes++;
      this.stats.deletes++;
    }

    return deleted;
  }

  // 基础缓存操作 - 清空
  clear(cacheName = null) {
    if (cacheName) {
      const cache = this.getCache(cacheName);
      if (cache) {
        cache.data.clear();
        cache.accessTimes.clear();
        cache.stats.deletes += cache.data.size;
      }
    } else {
      // 清空所有缓存
      for (const cache of this.caches.values()) {
        this.stats.deletes += cache.data.size;
        cache.data.clear();
        cache.accessTimes.clear();
      }
    }
    
    this.stats.clears++;
    return true;
  }

  // 检查键是否存在
  has(key, cacheName = 'default') {
    const cache = this.getCache(cacheName);
    if (!cache) {
      return false;
    }

    const item = cache.data.get(key);
    if (!item) {
      return false;
    }

    // 检查过期
    if (this.isExpired(item)) {
      this.delete(key, cacheName);
      return false;
    }

    return true;
  }

  // 获取缓存大小
  size(cacheName = null) {
    if (cacheName) {
      const cache = this.getCache(cacheName);
      return cache ? cache.data.size : 0;
    }

    let totalSize = 0;
    for (const cache of this.caches.values()) {
      totalSize += cache.data.size;
    }
    return totalSize;
  }

  // 获取缓存键列表
  keys(cacheName = 'default') {
    const cache = this.getCache(cacheName);
    return cache ? Array.from(cache.data.keys()) : [];
  }

  // 获取缓存值列表
  values(cacheName = 'default') {
    const cache = this.getCache(cacheName);
    if (!cache) {
      return [];
    }

    const values = [];
    for (const [key, item] of cache.data) {
      if (!this.isExpired(item)) {
        let value = item.value;
        if (item.compressed) {
          value = this.decompressData(value);
        }
        values.push(value);
      }
    }
    return values;
  }

  // 批量操作
  mget(keys, cacheName = 'default') {
    const results = new Map();
    for (const key of keys) {
      const value = this.get(key, cacheName);
      if (value !== null) {
        results.set(key, value);
      }
    }
    return results;
  }

  mset(entries, ttl = null, cacheName = 'default') {
    const results = new Map();
    for (const [key, value] of entries) {
      const success = this.set(key, value, ttl, cacheName);
      results.set(key, success);
    }
    return results;
  }

  // 缓存策略管理
  setupCachePolicy(cacheName, policy) {
    this.policies.set(cacheName, { ...this.defaultConfig, ...policy });
    
    // 如果缓存已存在，更新配置
    const cache = this.getCache(cacheName);
    if (cache) {
      cache.config = this.policies.get(cacheName);
    }
  }

  getCachePolicy(cacheName) {
    return this.policies.get(cacheName) || this.defaultConfig;
  }

  // 过期检查
  isExpired(item) {
    if (!item.expiration) {
      return false;
    }
    return Date.now() > item.expiration;
  }

  // 淘汰算法 - LRU
  evictItems(cache, count = 1) {
    if (!cache.config.enableLRU) {
      // 简单的FIFO淘汰
      const keys = Array.from(cache.data.keys()).slice(0, count);
      for (const key of keys) {
        cache.data.delete(key);
        cache.accessTimes.delete(key);
        cache.stats.evictions++;
        this.stats.evictions++;
      }
      return;
    }

    // LRU淘汰：删除最少使用的项
    const sortedByAccess = Array.from(cache.accessTimes.entries())
      .sort(([,a], [,b]) => a - b)
      .slice(0, count);

    for (const [key] of sortedByAccess) {
      cache.data.delete(key);
      cache.accessTimes.delete(key);
      cache.stats.evictions++;
      this.stats.evictions++;
    }
  }

  // 清理过期项
  cleanupExpiredCache() {
    const now = Date.now();
    let totalCleaned = 0;

    for (const cache of this.caches.values()) {
      const expiredKeys = [];
      
      for (const [key, item] of cache.data) {
        if (this.isExpired(item)) {
          expiredKeys.push(key);
        }
      }

      for (const key of expiredKeys) {
        cache.data.delete(key);
        cache.accessTimes.delete(key);
        totalCleaned++;
      }
    }

    if (totalCleaned > 0) {
      console.log(`缓存清理: 移除了 ${totalCleaned} 个过期项`);
    }

    return totalCleaned;
  }

  // 启动定期清理
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredCache();
    }, this.cleanupIntervalTime);
  }

  // 停止定期清理
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // 数据压缩相关
  shouldCompress(data, threshold) {
    if (!threshold) return false;
    
    const size = this.calculateSize(data);
    return size > threshold;
  }

  compressData(data) {
    try {
      // 简单的JSON字符串压缩（实际项目中可以使用LZ4等算法）
      const jsonString = JSON.stringify(data);
      
      // 模拟压缩：移除多余空白
      return {
        _compressed: true,
        data: jsonString.replace(/\s+/g, ' ').trim()
      };
    } catch (error) {
      console.warn('数据压缩失败:', error);
      return data;
    }
  }

  decompressData(compressedData) {
    try {
      if (compressedData && compressedData._compressed) {
        return JSON.parse(compressedData.data);
      }
      return compressedData;
    } catch (error) {
      console.warn('数据解压失败:', error);
      return compressedData;
    }
  }

  calculateSize(data) {
    try {
      return JSON.stringify(data).length;
    } catch (error) {
      return 0;
    }
  }

  // 缓存预热
  warmup(cacheName, dataLoader) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`开始预热缓存: ${cacheName}`);
        
        const data = await dataLoader();
        
        if (Array.isArray(data)) {
          // 数组数据：每个元素作为单独的缓存项
          for (let i = 0; i < data.length; i++) {
            const key = `warmup_${i}`;
            this.set(key, data[i], null, cacheName);
          }
        } else if (typeof data === 'object' && data !== null) {
          // 对象数据：每个属性作为单独的缓存项
          for (const [key, value] of Object.entries(data)) {
            this.set(key, value, null, cacheName);
          }
        } else {
          // 单个数据项
          this.set('warmup_data', data, null, cacheName);
        }
        
        console.log(`缓存预热完成: ${cacheName}`);
        resolve(true);
      } catch (error) {
        console.error(`缓存预热失败: ${cacheName}`, error);
        reject(error);
      }
    });
  }

  // 缓存同步
  sync(sourceCacheName, targetCacheName, keyMapping = null) {
    const sourceCache = this.getCache(sourceCacheName);
    const targetCache = this.getCache(targetCacheName);
    
    if (!sourceCache || !targetCache) {
      return false;
    }

    let syncCount = 0;
    
    for (const [key, item] of sourceCache.data) {
      if (!this.isExpired(item)) {
        const targetKey = keyMapping ? keyMapping(key) : key;
        
        let value = item.value;
        if (item.compressed) {
          value = this.decompressData(value);
        }
        
        this.set(targetKey, value, null, targetCacheName);
        syncCount++;
      }
    }

    console.log(`缓存同步完成: ${sourceCacheName} -> ${targetCacheName}, ${syncCount} 个项目`);
    return syncCount;
  }

  // 缓存统计信息
  getCacheStats(cacheName = null) {
    if (cacheName) {
      const cache = this.getCache(cacheName);
      if (!cache) {
        return null;
      }

      return {
        name: cache.name,
        size: cache.data.size,
        config: cache.config,
        stats: cache.stats,
        hitRate: cache.stats.hits + cache.stats.misses > 0 
          ? ((cache.stats.hits / (cache.stats.hits + cache.stats.misses)) * 100).toFixed(2) + '%'
          : '0%'
      };
    }

    // 全局统计
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const hitRate = totalHits + totalMisses > 0 
      ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) + '%'
      : '0%';

    return {
      global: {
        ...this.stats,
        hitRate,
        totalCaches: this.caches.size,
        totalItems: this.size()
      },
      caches: Array.from(this.caches.values()).map(cache => ({
        name: cache.name,
        size: cache.data.size,
        stats: cache.stats,
        hitRate: cache.stats.hits + cache.stats.misses > 0 
          ? ((cache.stats.hits / (cache.stats.hits + cache.stats.misses)) * 100).toFixed(2) + '%'
          : '0%'
      }))
    };
  }

  // 缓存健康检查
  healthCheck() {
    const stats = this.getCacheStats();
    const memoryUsage = this.getMemoryUsage();
    
    return {
      status: 'healthy',
      isInitialized: this.isInitialized,
      stats,
      memoryUsage,
      cleanupIntervalActive: !!this.cleanupInterval,
      cacheCount: this.caches.size,
      timestamp: Date.now()
    };
  }

  // 内存使用情况估算
  getMemoryUsage() {
    let totalSize = 0;
    let itemCount = 0;

    for (const cache of this.caches.values()) {
      for (const item of cache.data.values()) {
        totalSize += item.size || 0;
        itemCount++;
      }
    }

    return {
      totalSize,
      itemCount,
      averageItemSize: itemCount > 0 ? Math.round(totalSize / itemCount) : 0,
      formattedSize: this.formatBytes(totalSize)
    };
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  // 导出缓存数据
  exportCache(cacheName) {
    const cache = this.getCache(cacheName);
    if (!cache) {
      return null;
    }

    const exportData = {
      name: cacheName,
      config: cache.config,
      items: [],
      exportTime: Date.now()
    };

    for (const [key, item] of cache.data) {
      if (!this.isExpired(item)) {
        let value = item.value;
        if (item.compressed) {
          value = this.decompressData(value);
        }

        exportData.items.push({
          key,
          value,
          created: item.created,
          accessed: item.accessed,
          expiration: item.expiration
        });
      }
    }

    return exportData;
  }

  // 导入缓存数据
  importCache(exportData) {
    if (!exportData || !exportData.name) {
      return false;
    }

    const cacheName = exportData.name;
    
    // 创建或获取缓存
    let cache = this.getCache(cacheName);
    if (!cache) {
      cache = this.createCache(cacheName, exportData.config || {});
    }

    let importCount = 0;
    
    for (const item of exportData.items || []) {
      // 检查是否过期
      if (item.expiration && Date.now() > item.expiration) {
        continue;
      }

      this.set(item.key, item.value, null, cacheName);
      importCount++;
    }

    console.log(`缓存导入完成: ${cacheName}, ${importCount} 个项目`);
    return importCount;
  }

  // 销毁服务
  destroy() {
    this.stopCleanupInterval();
    this.clear(); // 清空所有缓存
    this.caches.clear();
    this.policies.clear();
    
    // 重置统计
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      clears: 0,
      evictions: 0
    };
    
    this.isInitialized = false;
    console.log('缓存服务已销毁');
  }
}
export { CacheService };
export default CacheService;