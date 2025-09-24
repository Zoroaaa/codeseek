/**
 * 缓存管理器 - 智能缓存策略和管理
 * 修复版本：解决缓存性能瓶颈
 */

import { CONFIG } from '../config.js';
import { CacheUtils, ContentTypeUtils, URLUtils } from '../utils.js';

class CacheManager {
  constructor() {
    this.cache = caches.default;
    this.statsCache = null;
    this.statsLastUpdated = 0;
    this.statsCacheTTL = 30000; // 30秒缓存统计信息
    this.maxStatsItems = 200; // 限制统计信息检查的最大项目数
  }

  /**
   * 获取缓存内容
   */
  static async get(url, options = {}) {
    try {
      const cacheKey = CacheUtils.generateCacheKey(url, options.method || 'GET');
      const cached = await caches.default.match(cacheKey);
      
      if (cached) {
        // 检查缓存是否过期
        const cacheDate = cached.headers.get('x-cache-date');
        const cacheTTL = parseInt(cached.headers.get('x-cache-ttl')) || 0;
        
        if (CacheUtils.isCacheExpired(cacheDate, cacheTTL)) {
          await caches.default.delete(cacheKey);
          CacheManager.updateStats('miss', 0, true); // 标记为过期
          return null;
        }
        
        // 更新缓存统计
        CacheManager.updateStats('hit');
        
        // 添加缓存命中标记
        const response = new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: {
            ...Object.fromEntries(cached.headers.entries()),
            'X-Cache-Status': 'HIT',
            'X-Cache-Age': Date.now() - new Date(cacheDate).getTime()
          }
        });
        
        return response;
      }
      
      CacheManager.updateStats('miss');
      return null;
      
    } catch (error) {
      CacheManager.updateStats('error');
      if (CONFIG.DEBUG) {
        console.error('Cache get error:', error);
      }
      return null;
    }
  }

  /**
   * 设置缓存内容
   */
  static async set(url, response, ttl, options = {}) {
    try {
      const contentType = response.headers.get('content-type') || '';
      const contentLength = parseInt(response.headers.get('content-length')) || 0;
      
      // 检查是否应该缓存
      if (!CacheManager.shouldCache(response, contentType, contentLength, options)) {
        return false;
      }
      
      // 获取实际的TTL
      const actualTTL = ttl || CONFIG.getCacheTTL(contentType);
      
      // 创建缓存键
      const cacheKey = CacheUtils.generateCacheKey(url, options.method || 'GET');
      
      // 准备缓存响应
      const cacheResponse = await CacheManager.prepareCacheResponse(response, actualTTL);
      
      // 存储到缓存
      await caches.default.put(cacheKey, cacheResponse);
      
      // 更新统计
      CacheManager.updateStats('set', contentLength);
      
      // 异步清理过期缓存（避免阻塞主流程）
      CacheManager.scheduleCleanup();
      
      if (CONFIG.DEBUG) {
        console.log(`Cached ${url} for ${actualTTL}ms`);
      }
      
      return true;
      
    } catch (error) {
      CacheManager.updateStats('error');
      if (CONFIG.DEBUG) {
        console.error('Cache set error:', error);
      }
      return false;
    }
  }

  /**
   * 判断是否应该缓存
   */
  static shouldCache(response, contentType, contentLength, options = {}) {
    // 不缓存错误响应
    if (response.status >= 400) {
      return false;
    }
    
    // 不缓存太大的内容
    if (contentLength > CONFIG.CACHE_SETTINGS.MAX_SIZE) {
      if (CONFIG.DEBUG) {
        console.log(`Content too large to cache: ${contentLength} bytes`);
      }
      return false;
    }
    
    // 检查响应头
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) {
      const lowerCacheControl = cacheControl.toLowerCase();
      
      // 不缓存明确禁止缓存的内容
      if (lowerCacheControl.includes('no-cache') || 
          lowerCacheControl.includes('no-store') ||
          lowerCacheControl.includes('private')) {
        return false;
      }
    }
    
    // 检查内容类型
    if (contentType) {
      const category = ContentTypeUtils.getContentTypeCategory(contentType);
      
      // 不缓存某些动态内容
      if (category === 'API' && contentType.includes('application/json')) {
        const url = options.url || '';
        // API响应只在特定情况下缓存
        if (!url.includes('/api/health') && !url.includes('/api/status')) {
          return false;
        }
      }
    }
    
    // 检查是否包含敏感信息
    if (CacheManager.containsSensitiveData(response)) {
      return false;
    }
    
    return true;
  }

  /**
   * 准备缓存响应
   */
  static async prepareCacheResponse(response, ttl) {
    const headers = new Headers(response.headers);
    
    // 添加缓存元数据
    headers.set('X-Cache-Date', new Date().toISOString());
    headers.set('X-Cache-TTL', ttl.toString());
    headers.set('X-Cache-Status', 'MISS');
    headers.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
    
    // 添加压缩头（如果适用）
    if (!headers.has('Content-Encoding') && response.body) {
      const contentType = headers.get('content-type') || '';
      if (ContentTypeUtils.isTextContent(contentType)) {
        headers.set('Vary', 'Accept-Encoding');
      }
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * 检查是否包含敏感数据
   */
  static containsSensitiveData(response) {
    const headers = response.headers;
    
    // 检查认证相关头部
    if (headers.has('authorization') || 
        headers.has('cookie') || 
        headers.has('set-cookie')) {
      return true;
    }
    
    // 检查内容类型
    const contentType = headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      // 可能包含敏感的JSON数据
      return false; // 暂时允许，但可以添加更多检查
    }
    
    return false;
  }

  /**
   * 删除缓存
   */
  static async delete(url, options = {}) {
    try {
      const cacheKey = CacheUtils.generateCacheKey(url, options.method || 'GET');
      const deleted = await caches.default.delete(cacheKey);
      
      if (CONFIG.DEBUG && deleted) {
        console.log(`Deleted cache for: ${url}`);
      }
      
      return deleted;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Cache delete error:', error);
      }
      return false;
    }
  }

  /**
   * 清理所有缓存
   */
  static async clear() {
    try {
      const cacheNames = await caches.keys();
      const deletePromises = cacheNames.map(name => caches.delete(name));
      await Promise.all(deletePromises);
      
      // 重置统计
      CacheManager.resetStats();
      
      if (CONFIG.DEBUG) {
        console.log('All caches cleared');
      }
      
      return true;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Cache clear error:', error);
      }
      return false;
    }
  }

  /**
   * 获取缓存统计 - 修复版本：解决性能瓶颈
   */
  static async getStats() {
    try {
      const now = Date.now();
      
      // 如果有缓存的统计信息且未过期，直接返回
      if (CacheManager.statsCache && 
          now - CacheManager.statsLastUpdated < CacheManager.statsCacheTTL) {
        return CacheManager.statsCache;
      }
      
      const cache = caches.default;
      const requests = await cache.keys();
      
      // 限制检查的缓存项数量，避免性能问题
      const totalEntries = requests.length;
      const sampleSize = Math.min(totalEntries, CacheManager.maxStatsItems);
      const sampleRequests = CacheManager.selectSampleRequests(requests, sampleSize);
      
      let estimatedTotalSize = 0;
      let expiredEntries = 0;
      const typeStats = {};
      
      // 只处理样本数据
      for (const request of sampleRequests) {
        try {
          const response = await cache.match(request);
          if (response) {
            // 计算大小（估算）
            const contentLength = parseInt(response.headers.get('content-length')) || 1000; // 默认估算1KB
            estimatedTotalSize += contentLength;
            
            // 统计类型
            const contentType = response.headers.get('content-type') || 'unknown';
            const category = ContentTypeUtils.getContentTypeCategory(contentType);
            typeStats[category] = (typeStats[category] || 0) + 1;
            
            // 检查过期
            const cacheDate = response.headers.get('x-cache-date');
            const cacheTTL = parseInt(response.headers.get('x-cache-ttl')) || 0;
            
            if (CacheUtils.isCacheExpired(cacheDate, cacheTTL)) {
              expiredEntries++;
            }
          }
        } catch (itemError) {
          // 单个项目错误不影响整体统计
          if (CONFIG.DEBUG) {
            console.warn('Error processing cache item:', itemError);
          }
        }
      }
      
      // 基于样本估算总大小
      const sizeMultiplier = totalEntries > 0 ? totalEntries / sampleSize : 1;
      const estimatedSize = Math.floor(estimatedTotalSize * sizeMultiplier);
      const estimatedExpired = Math.floor(expiredEntries * sizeMultiplier);
      
      const hitRate = CacheManager.stats.hits + CacheManager.stats.misses > 0 
        ? (CacheManager.stats.hits / (CacheManager.stats.hits + CacheManager.stats.misses) * 100).toFixed(2)
        : 0;
      
      const stats = {
        entries: totalEntries,
        sampledEntries: sampleSize,
        estimatedSize: estimatedSize,
        estimatedExpiredEntries: estimatedExpired,
        typeBreakdown: typeStats,
        performance: {
          hits: CacheManager.stats.hits,
          misses: CacheManager.stats.misses,
          expired: CacheManager.stats.expired || 0,
          hitRate: `${hitRate}%`,
          sets: CacheManager.stats.sets,
          errors: CacheManager.stats.errors
        },
        lastCleared: CacheManager.stats.lastCleared,
        settings: CONFIG.CACHE_SETTINGS,
        metadata: {
          lastUpdated: new Date().toISOString(),
          isSample: sampleSize < totalEntries,
          sampleRatio: totalEntries > 0 ? (sampleSize / totalEntries * 100).toFixed(1) + '%' : '100%'
        }
      };
      
      // 缓存统计信息
      CacheManager.statsCache = stats;
      CacheManager.statsLastUpdated = now;
      
      return stats;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Error getting cache stats:', error);
      }
      return {
        error: 'Failed to get cache statistics',
        performance: CacheManager.stats,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 选择样本请求（智能采样）
   */
  static selectSampleRequests(requests, sampleSize) {
    if (requests.length <= sampleSize) {
      return requests;
    }
    
    // 使用均匀分布采样
    const step = requests.length / sampleSize;
    const sample = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const index = Math.floor(i * step);
      if (index < requests.length) {
        sample.push(requests[index]);
      }
    }
    
    return sample;
  }

  /**
   * 清理过期缓存 - 优化版本
   */
  static async cleanExpired() {
    try {
      const cache = caches.default;
      const requests = await cache.keys();
      let cleanedCount = 0;
      
      // 限制每次清理的项目数量，避免阻塞
      const maxCleanupItems = 100;
      const itemsToCheck = Math.min(requests.length, maxCleanupItems);
      
      for (let i = 0; i < itemsToCheck; i++) {
        const request = requests[i];
        try {
          const response = await cache.match(request);
          if (response) {
            const cacheDate = response.headers.get('x-cache-date');
            const cacheTTL = parseInt(response.headers.get('x-cache-ttl')) || 0;
            
            if (CacheUtils.isCacheExpired(cacheDate, cacheTTL)) {
              await cache.delete(request);
              cleanedCount++;
            }
          }
        } catch (itemError) {
          // 单个项目错误不影响清理过程
          if (CONFIG.DEBUG) {
            console.warn('Error during cache cleanup:', itemError);
          }
        }
      }
      
      if (CONFIG.DEBUG && cleanedCount > 0) {
        console.log(`Cleaned ${cleanedCount} expired cache entries`);
      }
      
      return cleanedCount;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Cache cleanup error:', error);
      }
      return 0;
    }
  }

  /**
   * 调度清理任务
   */
  static scheduleCleanup() {
    // 避免频繁清理，使用随机延迟
    if (Math.random() < 0.1) { // 10%概率触发清理
      setTimeout(() => {
        CacheManager.cleanExpired().catch(error => {
          if (CONFIG.DEBUG) {
            console.error('Scheduled cleanup failed:', error);
          }
        });
      }, Math.random() * 30000); // 0-30秒随机延迟
    }
  }

  /**
   * 更新缓存统计
   */
  static updateStats(type, size = 0, expired = false) {
    switch (type) {
      case 'hit':
        CacheManager.stats.hits++;
        break;
      case 'miss':
        CacheManager.stats.misses++;
        if (expired) {
          CacheManager.stats.expired = (CacheManager.stats.expired || 0) + 1;
        }
        break;
      case 'set':
        CacheManager.stats.sets++;
        CacheManager.stats.totalSize += size;
        break;
      case 'error':
        CacheManager.stats.errors++;
        break;
    }
    
    // 清空统计缓存，强制下次重新计算
    CacheManager.statsCache = null;
  }

  /**
   * 重置统计
   */
  static resetStats() {
    CacheManager.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      errors: 0,
      expired: 0,
      totalSize: 0,
      lastCleared: new Date().toISOString()
    };
    CacheManager.statsCache = null;
    CacheManager.statsLastUpdated = 0;
  }

  /**
   * 预热缓存
   */
  static async warmup(urls = []) {
    if (!Array.isArray(urls) || urls.length === 0) {
      return { warmed: 0, errors: 0 };
    }
    
    let warmed = 0;
    let errors = 0;
    
    try {
      // 限制并发数量
      const batchSize = 5;
      
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const contentType = response.headers.get('content-type');
              const ttl = CONFIG.getCacheTTL(contentType);
              await CacheManager.set(url, response.clone(), ttl);
              warmed++;
            }
          } catch (error) {
            errors++;
            if (CONFIG.DEBUG) {
              console.warn(`Cache warmup failed for ${url}:`, error);
            }
          }
        });
        
        await Promise.allSettled(batchPromises);
        
        // 批次间的小延迟
        if (i + batchSize < urls.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      if (CONFIG.DEBUG) {
        console.log(`Cache warmup complete: ${warmed} warmed, ${errors} errors`);
      }
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Cache warmup error:', error);
      }
    }
    
    return { warmed, errors };
  }

  /**
   * 缓存健康检查
   */
  static async healthCheck() {
    try {
      // 测试基本的缓存操作
      const testUrl = 'http://test.cache.healthcheck';
      const testResponse = new Response('test', {
        headers: { 'content-type': 'text/plain' }
      });
      
      const startTime = Date.now();
      
      // 测试写入
      const setResult = await CacheManager.set(testUrl, testResponse.clone(), 5000);
      const setTime = Date.now() - startTime;
      
      // 测试读取
      const getStart = Date.now();
      const getResult = await CacheManager.get(testUrl);
      const getTime = Date.now() - getStart;
      
      // 测试删除
      const deleteStart = Date.now();
      const deleteResult = await CacheManager.delete(testUrl);
      const deleteTime = Date.now() - deleteStart;
      
      return {
        healthy: setResult && getResult !== null && deleteResult,
        operations: {
          set: { success: setResult, time: setTime + 'ms' },
          get: { success: getResult !== null, time: getTime + 'ms' },
          delete: { success: deleteResult, time: deleteTime + 'ms' }
        },
        performance: {
          totalTime: Date.now() - startTime + 'ms'
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// 初始化统计
CacheManager.stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  errors: 0,
  expired: 0,
  totalSize: 0,
  lastCleared: null
};

// 初始化统计缓存
CacheManager.statsCache = null;
CacheManager.statsLastUpdated = 0;
CacheManager.statsCacheTTL = 30000;
CacheManager.maxStatsItems = 200;

export default CacheManager;