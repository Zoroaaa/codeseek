// Enhanced Cache Manager for Cloudflare KV Storage
// Handles intelligent caching with TTL based on content types

import { CONFIG } from './config.js';

export class CacheManager {
  constructor(kv, env) {
    this.kv = kv;
    this.env = env;
    this.defaultTTL = {
      html: parseInt(env.CACHE_HTML_TTL || CONFIG.CACHE_TTL.HTML),
      css: parseInt(env.CACHE_CSS_TTL || CONFIG.CACHE_TTL.CSS),
      js: parseInt(env.CACHE_JS_TTL || CONFIG.CACHE_TTL.JS),
      image: parseInt(env.CACHE_IMAGE_TTL || CONFIG.CACHE_TTL.IMAGE),
      font: parseInt(env.CACHE_FONT_TTL || CONFIG.CACHE_TTL.FONT),
      json: parseInt(env.CACHE_JSON_TTL || CONFIG.CACHE_TTL.JSON),
      default: parseInt(env.CACHE_DEFAULT_TTL || CONFIG.CACHE_TTL.DEFAULT)
    };
  }

  /**
   * Generate cache key for request
   * @param {string} url - Request URL
   * @param {string} method - HTTP method
   * @param {Object} headers - Request headers
   * @returns {string} Cache key
   */
  generateCacheKey(url, method = 'GET', headers = {}) {
    try {
      const normalizedUrl = new URL(url);
      
      // Remove cache-busting parameters
      const cacheButstingParams = ['_t', 'timestamp', 'cachebuster', '_', 'nocache'];
      cacheButstingParams.forEach(param => {
        normalizedUrl.searchParams.delete(param);
      });
      
      const keyComponents = [
        CONFIG.CACHE_PREFIX,
        method.toUpperCase(),
        normalizedUrl.href.substring(0, 200) // Limit length for KV key constraints
      ];
      
      // Include relevant headers in cache key
      const relevantHeaders = ['accept', 'accept-encoding', 'user-agent'];
      relevantHeaders.forEach(headerName => {
        if (headers[headerName]) {
          keyComponents.push(`${headerName}:${headers[headerName].substring(0, 50)}`);
        }
      });
      
      return keyComponents.join('|');
    } catch (error) {
      console.error('Cache key generation error:', error);
      return `${CONFIG.CACHE_PREFIX}|${method}|${url.substring(0, 200)}`;
    }
  }

  /**
   * Get TTL based on content type
   * @param {string} contentType - Response content type
   * @returns {number} TTL in seconds
   */
  getTTLForContentType(contentType) {
    if (!contentType) return this.defaultTTL.default;
    
    const type = contentType.toLowerCase();
    
    if (type.includes('html')) return this.defaultTTL.html;
    if (type.includes('css') || type.includes('stylesheet')) return this.defaultTTL.css;
    if (type.includes('javascript') || type.includes('ecmascript')) return this.defaultTTL.js;
    if (type.includes('image/')) return this.defaultTTL.image;
    if (type.includes('font/') || type.includes('woff') || type.includes('ttf')) return this.defaultTTL.font;
    if (type.includes('json') || type.includes('application/json')) return this.defaultTTL.json;
    if (type.includes('video/') || type.includes('audio/')) return this.defaultTTL.image; // Use image TTL for media
    
    return this.defaultTTL.default;
  }

  /**
   * Get cached response
   * @param {string} cacheKey - Cache key
   * @returns {Object|null} Cached response data
   */
  async get(cacheKey) {
    if (!this.kv) {
      console.warn('KV storage not available');
      return null;
    }
    
    try {
      const cached = await this.kv.get(cacheKey, 'json');
      if (!cached) return null;
      
      // Check if cache has expired (redundant with KV TTL but safer)
      if (cached.expires && Date.now() > cached.expires) {
        // Async delete expired cache
        this.kv.delete(cacheKey).catch(err => {
          console.error('Failed to delete expired cache:', err);
        });
        return null;
      }
      
      // Validate cache structure
      if (!cached.body || !cached.headers) {
        console.warn('Invalid cache structure, deleting:', cacheKey);
        this.kv.delete(cacheKey).catch(() => {});
        return null;
      }
      
      return {
        body: cached.body,
        headers: cached.headers,
        status: cached.status || 200,
        statusText: cached.statusText || 'OK',
        cachedAt: cached.cachedAt
      };
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache for response
   * @param {string} cacheKey - Cache key
   * @param {Response} response - Response to cache
   * @param {number|null} customTTL - Custom TTL override
   */
  async set(cacheKey, response, customTTL = null) {
    if (!this.kv) {
      console.warn('KV storage not available');
      return;
    }
    
    try {
      const contentType = response.headers.get('content-type') || '';
      const ttl = customTTL || this.getTTLForContentType(contentType);
      
      // Only cache successful responses
      if (response.status < 200 || response.status >= 300) {
        return;
      }
      
      // Check response size limits
      const contentLength = response.headers.get('content-length');
      const maxSize = parseInt(this.env.MAX_CACHE_SIZE) || CONFIG.MAX_CACHE_SIZE;
      
      if (contentLength && parseInt(contentLength) > maxSize) {
        console.warn('Response too large to cache:', contentLength);
        return;
      }
      
      // Don't cache responses with private cache control
      const cacheControl = response.headers.get('cache-control') || '';
      if (cacheControl.includes('private') || cacheControl.includes('no-store')) {
        return;
      }
      
      // Clone response for reading
      const responseClone = response.clone();
      const body = await responseClone.text();
      
      // Check body size after reading
      const bodySize = new TextEncoder().encode(body).length;
      if (bodySize > maxSize) {
        console.warn('Response body too large to cache:', bodySize);
        return;
      }
      
      // Prepare cache data
      const cacheData = {
        body: body,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
        expires: Date.now() + (ttl * 1000),
        cachedAt: Date.now(),
        contentType: contentType,
        size: bodySize
      };
      
      // Store in KV with TTL
      await this.kv.put(cacheKey, JSON.stringify(cacheData), {
        expirationTtl: ttl
      });
      
      console.log(`Cached response: ${cacheKey} (TTL: ${ttl}s, Size: ${bodySize}b)`);
      
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Clear cache by pattern
   * @param {string} pattern - Cache key pattern to clear
   */
  async clearPattern(pattern) {
    if (!this.kv) {
      console.warn('KV storage not available');
      return;
    }
    
    try {
      console.log(`Clearing cache pattern: ${pattern}`);
      
      const list = await this.kv.list({ prefix: pattern });
      const deletePromises = list.keys.map(key => 
        this.kv.delete(key.name).catch(err => {
          console.error(`Failed to delete cache key ${key.name}:`, err);
        })
      );
      
      await Promise.allSettled(deletePromises);
      console.log(`Cleared ${list.keys.length} cache entries`);
      
    } catch (error) {
      console.error('Cache clear error:', error);
      throw error;
    }
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    return this.clearPattern(CONFIG.CACHE_PREFIX);
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    if (!this.kv) {
      return { error: 'KV storage not available' };
    }
    
    try {
      const list = await this.kv.list({ prefix: CONFIG.CACHE_PREFIX });
      
      const stats = {
        totalKeys: list.keys.length,
        cachePrefix: CONFIG.CACHE_PREFIX,
        ttlConfig: this.defaultTTL,
        timestamp: new Date().toISOString()
      };
      
      return stats;
      
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { error: error.message };
    }
  }

  /**
   * Preload cache for common URLs
   * @param {Array} urls - URLs to preload
   */
  async preloadUrls(urls) {
    if (!Array.isArray(urls) || !this.kv) {
      return;
    }
    
    console.log(`Preloading ${urls.length} URLs into cache`);
    
    const preloadPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const cacheKey = this.generateCacheKey(url, 'GET');
          await this.set(cacheKey, response);
        }
      } catch (error) {
        console.error(`Failed to preload ${url}:`, error);
      }
    });
    
    await Promise.allSettled(preloadPromises);
    console.log('Cache preloading completed');
  }

  /**
   * Check if URL should be cached
   * @param {string} url - URL to check
   * @param {string} method - HTTP method
   * @returns {boolean} Whether to cache
   */
  shouldCache(url, method = 'GET') {
    // Only cache GET requests
    if (method !== 'GET') return false;
    
    try {
      const urlObj = new URL(url);
      
      // Don't cache API endpoints
      if (urlObj.pathname.startsWith('/api/')) return false;
      
      // Don't cache URLs with auth parameters
      const authParams = ['token', 'api_key', 'access_token', 'auth'];
      for (const param of authParams) {
        if (urlObj.searchParams.has(param)) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
}