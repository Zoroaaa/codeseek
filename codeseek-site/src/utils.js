/**
 * 工具函数集合 - 通用工具函数
 */

import { CONFIG } from './config.js';

/**
 * URL工具类
 */
export class URLUtils {
  /**
   * 检查URL是否为绝对URL
   */
  static isAbsoluteURL(url) {
    return /^https?:\/\//.test(url);
  }
  
  /**
   * 检查URL是否为协议相对URL
   */
  static isProtocolRelativeURL(url) {
    return /^\/\//.test(url);
  }
  
  /**
   * 检查URL是否为相对URL
   */
  static isRelativeURL(url) {
    return !this.isAbsoluteURL(url) && !this.isProtocolRelativeURL(url);
  }
  
  /**
   * 检查URL是否为数据URL
   */
  static isDataURL(url) {
    return /^data:/.test(url);
  }
  
  /**
   * 检查URL是否为特殊协议（magnet, thunder等）
   */
  static isSpecialProtocol(url) {
    const specialProtocols = ['magnet:', 'thunder:', 'ed2k:', 'ftp:', 'ftps:'];
    return specialProtocols.some(protocol => url.startsWith(protocol));
  }
  
  /**
   * 规范化URL
   */
  static normalizeURL(url, baseURL) {
    try {
      if (this.isSpecialProtocol(url)) {
        return url; // 特殊协议直接返回
      }
      
      if (this.isDataURL(url)) {
        return url; // 数据URL直接返回
      }
      
      if (this.isAbsoluteURL(url)) {
        return url;
      }
      
      if (this.isProtocolRelativeURL(url)) {
        return `https:${url}`;
      }
      
      if (baseURL) {
        return new URL(url, baseURL).href;
      }
      
      return url;
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('URL normalization failed:', url, error);
      }
      return url;
    }
  }
  
  /**
   * 提取域名
   */
  static extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * 检查是否为有效的HTTP URL
   */
  static isValidHTTPURL(url) {
    try {
      const parsedURL = new URL(url);
      return parsedURL.protocol === 'http:' || parsedURL.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 清理URL参数
   */
  static cleanURL(url) {
    try {
      const urlObj = new URL(url);
      // 移除一些跟踪参数
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'fbclid', '_ga', '_gid', 'ref', 'referrer'
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      return urlObj.href;
    } catch (error) {
      return url;
    }
  }
}

/**
 * 字符串工具类
 */
export class StringUtils {
  /**
   * 转义正则表达式特殊字符
   */
  static escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 生成随机字符串
   */
  static generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
  
  /**
   * 截断字符串
   */
  static truncate(str, maxLength, suffix = '...') {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }
  
  /**
   * 清理HTML标签
   */
  static stripHTML(html) {
    return html.replace(/<[^>]*>/g, '');
  }
  
  /**
   * Base64编码
   */
  static base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  
  /**
   * Base64解码
   */
  static base64Decode(str) {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch (error) {
      return str;
    }
  }
  
  /**
   * 检查字符串是否为JSON
   */
  static isJSON(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * 内容类型工具类
 */
export class ContentTypeUtils {
  /**
   * 获取内容类型分类
   */
  static getContentTypeCategory(contentType) {
    if (!contentType) return 'OTHER';
    
    const type = contentType.toLowerCase();
    
    if (type.includes('text/html')) return 'HTML';
    if (type.includes('text/css') || type.includes('stylesheet')) return 'CSS';
    if (type.includes('javascript') || type.includes('application/javascript')) return 'JS';
    if (type.includes('image/')) return 'IMAGE';
    if (type.includes('font/') || type.includes('woff') || type.includes('ttf')) return 'FONT';
    if (type.includes('application/json')) return 'API';
    if (type.includes('video/')) return 'VIDEO';
    if (type.includes('audio/')) return 'AUDIO';
    if (type.includes('application/octet-stream') || type.includes('torrent')) return 'BINARY';
    
    return 'OTHER';
  }
  
  /**
   * 检查是否为文本内容
   */
  static isTextContent(contentType) {
    if (!contentType) return false;
    
    const textTypes = ['text/', 'application/json', 'application/javascript', 'application/xml'];
    return textTypes.some(type => contentType.toLowerCase().includes(type));
  }
  
  /**
   * 检查是否需要URL重写
   */
  static needsURLRewriting(contentType) {
    return this.isTextContent(contentType) && !contentType.includes('application/json');
  }
  
  /**
   * 获取MIME类型
   */
  static getMimeType(extension) {
    const mimeTypes = {
      'html': 'text/html',
      'htm': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'json': 'application/json',
      'xml': 'application/xml',
      'txt': 'text/plain',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'woff': 'font/woff',
      'woff2': 'font/woff2',
      'ttf': 'font/ttf',
      'eot': 'application/vnd.ms-fontobject',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'pdf': 'application/pdf',
      'zip': 'application/zip',
      'torrent': 'application/x-bittorrent'
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }
}

/**
 * 缓存工具类
 */
export class CacheUtils {
  /**
   * 生成缓存键
   */
  static generateCacheKey(url, method = 'GET', additionalData = '') {
    const normalizedURL = URLUtils.cleanURL(url);
    const key = `proxy_v4_${method}_${normalizedURL}_${additionalData}`;
    return key.length > 512 ? StringUtils.base64Encode(key) : key;
  }
  
  /**
   * 检查缓存是否过期
   */
  static isCacheExpired(cacheDate, ttl) {
    if (!cacheDate || !ttl) return true;
    
    const cacheTime = new Date(cacheDate).getTime();
    const currentTime = Date.now();
    
    return (currentTime - cacheTime) > ttl;
  }
  
  /**
   * 创建缓存响应
   */
  static createCachedResponse(response, ttl) {
    const headers = new Headers(response.headers);
    headers.set('X-Cache-Status', 'MISS');
    headers.set('X-Cache-Date', new Date().toISOString());
    headers.set('X-Cache-TTL', ttl.toString());
    headers.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
}

/**
 * 错误处理工具类
 */
export class ErrorUtils {
  /**
   * 创建错误响应
   */
  static createErrorResponse(message, status = 500, details = null) {
    const errorData = {
      error: message,
      status,
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION
    };
    
    if (details && CONFIG.DEBUG) {
      errorData.details = details;
    }
    
    return new Response(JSON.stringify(errorData), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
  
  /**
   * 记录错误
   */
  static logError(error, context = '') {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    console.error('Proxy Error:', errorInfo);
    
    // 这里可以添加更多的错误上报逻辑
    return errorInfo;
  }
  
  /**
   * 判断是否为网络错误
   */
  static isNetworkError(error) {
    const networkErrorMessages = [
      'fetch failed',
      'network error',
      'connection refused',
      'timeout',
      'dns resolution failed'
    ];
    
    return networkErrorMessages.some(msg => 
      error.message.toLowerCase().includes(msg.toLowerCase())
    );
  }
}

/**
 * 性能工具类
 */
export class PerformanceUtils {
  /**
   * 创建计时器
   */
  static createTimer() {
    const startTime = Date.now();
    
    return {
      start: startTime,
      end: () => Date.now() - startTime,
      mark: (label) => {
        const elapsed = Date.now() - startTime;
        if (CONFIG.DEBUG) {
          console.log(`[Timer] ${label}: ${elapsed}ms`);
        }
        return elapsed;
      }
    };
  }
  
  /**
   * 延迟执行
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 带超时的fetch
   */
  static async fetchWithTimeout(url, options = {}, timeout = CONFIG.REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }
  
  /**
   * 批处理执行
   */
  static async batchProcess(items, processor, batchSize = 10, delay = 0) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      
      results.push(...batchResults);
      
      if (delay > 0 && i + batchSize < items.length) {
        await this.delay(delay);
      }
    }
    
    return results;
  }
}

/**
 * 验证工具类
 */
export class ValidationUtils {
  /**
   * 验证URL格式
   */
  static isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 验证代理目标
   */
  static isValidProxyTarget(hostname) {
    return CONFIG.isValidProxyTarget(hostname);
  }
  
  /**
   * 验证内容长度
   */
  static isValidContentLength(length) {
    return length <= CONFIG.SECURITY.MAX_CONTENT_SIZE;
  }
  
  /**
   * 检查是否为安全的协议
   */
  static isSafeProtocol(protocol) {
    return CONFIG.SECURITY.ALLOWED_PROTOCOLS.includes(protocol.toLowerCase());
  }
}