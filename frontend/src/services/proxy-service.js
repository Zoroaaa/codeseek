// frontend/src/services/proxy-service.js - 升级版代理服务 v4.0.0
// 对应后端架构 v4.0.0，集成所有新特性

import { 
  proxyConfig, 
  validateProxyConfig, 
  getProxyHealthCheckUrl, 
  getProxyStatusUrl,
  getProxyCacheStatsUrl,
  isDomainSupported,
  getDomainCategory,
  getDefaultConfig,
  createRequestConfig,
  testProxyConnectivity,
  errorLogger
} from '../core/proxy-config.js';

/**
 * v4.0.0 资源类型枚举（对应后端处理器）
 */
const RESOURCE_TYPES = {
  HTML: 'html',
  CSS: 'css', 
  JS: 'javascript',
  IMAGE: 'image',
  FONT: 'font',
  MEDIA: 'media',
  API: 'api',
  DOCUMENT: 'document',
  MAGNET: 'magnet',      // v4.0.0新增：磁力链接
  TORRENT: 'torrent',    // v4.0.0新增：种子文件
  OTHER: 'other'
};

/**
 * v4.0.0 智能缓存管理器（对应后端CacheManager）
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = proxyConfig.cacheStrategy.maxEntries;
    this.maxMemorySize = proxyConfig.cacheStrategy.maxSize * 1024 * 1024; // 转换为字节
    this.currentMemoryUsage = 0;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      errors: 0,
      expired: 0
    };
    
    // v4.0.0: 启动定期清理
    this.startPeriodicCleanup();
  }

  generateKey(url, options = {}) {
    const { method = 'GET', headers = {} } = options;
    const headersString = JSON.stringify(Object.fromEntries(
      Object.entries(headers).filter(([k]) => ['authorization', 'cookie'].includes(k.toLowerCase()))
    ));
    return `${method}:${url}:${headersString}`;
  }

  get(url, options = {}) {
    const key = this.generateKey(url, options);
    const cached = this.cache.get(key);
    
    if (cached && !this.isExpired(cached)) {
      this.cacheStats.hits++;
      // v4.0.0: LRU更新
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.data;
    }
    
    if (cached && this.isExpired(cached)) {
      this.cache.delete(key);
      this.cacheStats.expired++;
      this.updateMemoryUsage(-cached.size);
    }
    
    this.cacheStats.misses++;
    return null;
  }

  set(url, data, options = {}) {
    const key = this.generateKey(url, options);
    const resourceType = this.detectResourceType(url, data);
    const ttl = this.getTTL(resourceType);
    
    // v4.0.0: 估算内存使用
    const estimatedSize = this.estimateDataSize(data);
    
    // v4.0.0: 内存限制检查
    if (estimatedSize > this.maxMemorySize * 0.1) { // 单个条目不超过总内存的10%
      console.warn(`Cache item too large: ${estimatedSize} bytes`);
      return false;
    }
    
    // v4.0.0: LRU淘汰策略
    while (this.cache.size >= this.maxCacheSize || 
           this.currentMemoryUsage + estimatedSize > this.maxMemorySize) {
      const firstKey = this.cache.keys().next().value;
      if (!firstKey) break;
      
      const firstItem = this.cache.get(firstKey);
      this.cache.delete(firstKey);
      this.cacheStats.evictions++;
      this.updateMemoryUsage(-firstItem.size);
    }
    
    const cacheItem = {
      data: {
        ...data,
        resourceType,
        cached: true,
        cacheTime: Date.now()
      },
      timestamp: Date.now(),
      ttl,
      resourceType,
      size: estimatedSize,
      accessCount: 0,
      lastAccess: Date.now()
    };
    
    this.cache.set(key, cacheItem);
    this.cacheStats.sets++;
    this.updateMemoryUsage(estimatedSize);
    
    return true;
  }

  isExpired(cached) {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  getTTL(resourceType) {
    return proxyConfig.cacheStrategy.ttl[resourceType] || 
           proxyConfig.cacheStrategy.ttl.other;
  }

  // v4.0.0: 检测资源类型
  detectResourceType(url, data) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      const ext = pathname.split('.').pop();
      
      // v4.0.0: 特殊协议检测
      if (url.startsWith('magnet:')) return RESOURCE_TYPES.MAGNET;
      if (url.startsWith('thunder:') || url.startsWith('ed2k:')) return RESOURCE_TYPES.TORRENT;
      
      // 扩展名检测
      const typeMap = {
        'html': RESOURCE_TYPES.HTML,
        'htm': RESOURCE_TYPES.HTML,
        'css': RESOURCE_TYPES.CSS,
        'js': RESOURCE_TYPES.JS,
        'mjs': RESOURCE_TYPES.JS,
        'json': RESOURCE_TYPES.API,
        'jpg': RESOURCE_TYPES.IMAGE,
        'jpeg': RESOURCE_TYPES.IMAGE,
        'png': RESOURCE_TYPES.IMAGE,
        'gif': RESOURCE_TYPES.IMAGE,
        'svg': RESOURCE_TYPES.IMAGE,
        'webp': RESOURCE_TYPES.IMAGE,
        'woff': RESOURCE_TYPES.FONT,
        'woff2': RESOURCE_TYPES.FONT,
        'ttf': RESOURCE_TYPES.FONT,
        'eot': RESOURCE_TYPES.FONT,
        'mp4': RESOURCE_TYPES.MEDIA,
        'webm': RESOURCE_TYPES.MEDIA,
        'mp3': RESOURCE_TYPES.MEDIA,
        'torrent': RESOURCE_TYPES.TORRENT
      };
      
      if (typeMap[ext]) return typeMap[ext];
      
      // Content-Type检测
      if (data && data.headers) {
        const contentType = data.headers.get('content-type') || '';
        if (contentType.includes('text/html')) return RESOURCE_TYPES.HTML;
        if (contentType.includes('text/css')) return RESOURCE_TYPES.CSS;
        if (contentType.includes('javascript')) return RESOURCE_TYPES.JS;
        if (contentType.includes('image/')) return RESOURCE_TYPES.IMAGE;
        if (contentType.includes('font/')) return RESOURCE_TYPES.FONT;
        if (contentType.includes('video/') || contentType.includes('audio/')) return RESOURCE_TYPES.MEDIA;
        if (contentType.includes('application/json')) return RESOURCE_TYPES.API;
        if (contentType.includes('torrent')) return RESOURCE_TYPES.TORRENT;
      }
      
      return RESOURCE_TYPES.OTHER;
    } catch (error) {
      return RESOURCE_TYPES.OTHER;
    }
  }

  // v4.0.0: 估算数据大小
  estimateDataSize(data) {
    try {
      if (data instanceof Response) {
        return parseInt(data.headers.get('content-length')) || 1024;
      }
      return JSON.stringify(data).length * 2; // Unicode字符估算
    } catch (error) {
      return 1024; // 默认1KB
    }
  }

  updateMemoryUsage(delta) {
    this.currentMemoryUsage = Math.max(0, this.currentMemoryUsage + delta);
  }

  clear(pattern = null) {
    if (pattern) {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          const item = this.cache.get(key);
          this.cache.delete(key);
          this.updateMemoryUsage(-item.size);
        }
      });
    } else {
      this.cache.clear();
      this.currentMemoryUsage = 0;
    }
  }

  // v4.0.0: 定期清理过期缓存
  startPeriodicCleanup() {
    const cleanupInterval = proxyConfig.cacheStrategy.cleanup.interval;
    
    setInterval(() => {
      let cleanedCount = 0;
      const now = Date.now();
      
      for (const [key, item] of this.cache.entries()) {
        if (this.isExpired(item)) {
          this.cache.delete(key);
          this.updateMemoryUsage(-item.size);
          this.cacheStats.expired++;
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.debug(`[CacheManager] Cleaned ${cleanedCount} expired items`);
      }
    }, cleanupInterval);
  }

  getStats() {
    return {
      ...this.cacheStats,
      size: this.cache.size,
      memoryUsage: {
        current: Math.round(this.currentMemoryUsage / 1024),  // KB
        max: Math.round(this.maxMemorySize / 1024),           // KB
        utilization: (this.currentMemoryUsage / this.maxMemorySize * 100).toFixed(1) + '%'
      },
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
}

/**
 * v4.0.0 智能请求队列管理器
 */
class RequestQueue {
  constructor(maxConcurrent = 6) {
    this.queue = [];
    this.active = 0;
    this.maxConcurrent = maxConcurrent;
    this.stats = {
      totalRequests: 0,
      completedRequests: 0,
      failedRequests: 0,
      averageTime: 0,
      queueTime: 0
    };
    
    // v4.0.0: 优先级队列
    this.priorityQueues = {
      high: [],    // 10-8分
      medium: [],  // 7-5分  
      low: []      // 4-1分
    };
  }

  async add(requestFn, priority = 0, metadata = {}) {
    const requestItem = {
      fn: requestFn,
      priority,
      metadata,
      resolve: null,
      reject: null,
      startTime: null,
      queueTime: Date.now()
    };

    return new Promise((resolve, reject) => {
      requestItem.resolve = resolve;
      requestItem.reject = reject;
      
      // v4.0.0: 优先级分配
      if (priority >= 8) {
        this.priorityQueues.high.push(requestItem);
      } else if (priority >= 5) {
        this.priorityQueues.medium.push(requestItem);
      } else {
        this.priorityQueues.low.push(requestItem);
      }
      
      this.processNext();
    });
  }

  async processNext() {
    if (this.active >= this.maxConcurrent) return;

    // v4.0.0: 按优先级处理
    let item = this.priorityQueues.high.shift() || 
               this.priorityQueues.medium.shift() || 
               this.priorityQueues.low.shift();
               
    if (!item) return;

    this.active++;
    this.stats.totalRequests++;
    item.startTime = Date.now();
    
    // 计算队列等待时间
    this.stats.queueTime = (this.stats.queueTime + (item.startTime - item.queueTime)) / 2;

    try {
      const result = await item.fn();
      this.stats.completedRequests++;
      this.updateAverageTime(Date.now() - item.startTime);
      item.resolve(result);
    } catch (error) {
      this.stats.failedRequests++;
      item.reject(error);
    } finally {
      this.active--;
      this.processNext();
    }
  }

  updateAverageTime(responseTime) {
    const weight = 0.9;
    this.stats.averageTime = this.stats.averageTime * weight + responseTime * (1 - weight);
  }

  getStatus() {
    return {
      queueLength: this.priorityQueues.high.length + 
                   this.priorityQueues.medium.length + 
                   this.priorityQueues.low.length,
      activeRequests: this.active,
      stats: { ...this.stats },
      priorityDistribution: {
        high: this.priorityQueues.high.length,
        medium: this.priorityQueues.medium.length,
        low: this.priorityQueues.low.length
      }
    };
  }
}

/**
 * v4.0.0 升级版代理服务类
 */
class ProxyService {
  constructor() {
    this.isInitialized = false;
    this.currentStatus = proxyConfig.status.DISABLED;
    this.healthCheckTimer = null;
    this.stats = this.loadStats();
    this.lastHealthCheck = null;
    this.isHealthy = null;
    this.retryCount = 0;
    
    // v4.0.0: 新增组件
    this.cacheManager = new CacheManager();
    this.requestQueue = new RequestQueue(proxyConfig.performance.maxConcurrent);
    
    // v4.0.0: 性能监控
    this.performanceMetrics = {
      avgResponseTime: 0,
      successRate: 1,
      redirectCount: 0,        // 重定向计数
      specialLinksProcessed: 0,// 特殊链接处理计数
      lastMeasurement: Date.now()
    };
    
    // v4.0.0: 智能特性
    this.smartMode = {
      enabled: proxyConfig.smartMode.enabled,
      autoDetect: proxyConfig.smartMode.autoDetect,
      domainCache: new Map() // 域名可访问性缓存
    };
    
    // 验证配置
    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('[ProxyService v4.0.0] Config validation failed:', validation.issues);
    }
    if (validation.warnings?.length > 0) {
      console.warn('[ProxyService v4.0.0] Config warnings:', validation.warnings);
    }
  }

  /**
   * v4.0.0 初始化代理服务
   */
  async init() {
    try {
      console.log('[ProxyService v4.0.0] Initializing...');
      
      const enabled = this.loadProxyState();
      
      if (enabled) {
        this.enableProxyAsync();
      }
      
      // v4.0.0: 启动监控
      this.startPerformanceMonitoring();
      this.startSmartModeMonitoring();
      
      this.isInitialized = true;
      
      console.log('[ProxyService v4.0.0] Initialized successfully', {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        cacheEnabled: true,
        queueEnabled: true,
        smartMode: this.smartMode.enabled,
        version: proxyConfig.version
      });
      
      return { success: true };
    } catch (error) {
      console.error('[ProxyService v4.0.0] Initialization failed:', error);
      this.currentStatus = proxyConfig.status.ERROR;
      errorLogger.log(error, { context: 'initialization' });
      return { success: false, error: error.message };
    }
  }

  async enableProxyAsync() {
    try {
      await this.enableProxy();
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Async enable failed:', error.message);
      errorLogger.log(error, { context: 'enableProxyAsync' });
    }
  }

  // ===================== v4.0.0 核心功能增强 =====================

  isProxyEnabled() {
    return this.currentStatus === proxyConfig.status.ENABLED ||
           this.currentStatus === proxyConfig.status.SMART;
  }

  async toggleProxy() {
    try {
      if (this.isProxyEnabled()) {
        return await this.disableProxy();
      } else {
        return await this.enableProxy();
      }
    } catch (error) {
      console.error('[ProxyService v4.0.0] Toggle failed:', error);
      errorLogger.log(error, { context: 'toggle', currentStatus: this.currentStatus });
      return { success: false, error: error.message };
    }
  }

  /**
   * v4.0.0 智能URL转换（支持特殊协议）
   */
  convertToProxyUrl(originalUrl, options = {}) {
    if (!originalUrl || typeof originalUrl !== 'string') {
      throw new Error('Invalid URL provided');
    }

    try {
      // v4.0.0: 特殊协议保护
      if (this.isSpecialProtocol(originalUrl)) {
        console.debug(`[ProxyService v4.0.0] Special protocol preserved: ${originalUrl.substring(0, 20)}...`);
        this.stats.specialLinksProcessed = (this.stats.specialLinksProcessed || 0) + 1;
        return originalUrl;
      }

      // 缓存检查
      const cachedMapping = this.cacheManager.get(`url-mapping:${originalUrl}`);
      if (cachedMapping) {
        return cachedMapping;
      }

      const url = new URL(originalUrl);
      const hostname = url.hostname;
      
      // v4.0.0: 智能域名检查
      if (!isDomainSupported(hostname)) {
        // 智能模式下尝试自动检测
        if (this.smartMode.enabled && this.smartMode.autoDetect) {
          return this.handleSmartModeUrl(originalUrl, hostname);
        }
        
        console.debug(`[ProxyService v4.0.0] Domain not supported: ${hostname}`);
        return originalUrl;
      }

      // 资源类型检测
      const resourceType = this.cacheManager.detectResourceType(originalUrl);
      const domainCategory = getDomainCategory(hostname);
      
      // 构建完整路径
      let path = url.pathname || '/';
      if (url.search) path += url.search;
      if (url.hash) path += url.hash;
      
      if (!path.startsWith('/')) path = '/' + path;

      // v4.0.0: 使用新的URL格式
      const proxyUrl = `${proxyConfig.proxyServer}/proxy/${hostname}${path}`;

      // 缓存URL映射
      this.cacheManager.set(`url-mapping:${originalUrl}`, proxyUrl, {
        resourceType: RESOURCE_TYPES.OTHER
      });

      console.debug(`[ProxyService v4.0.0] URL converted:`, { 
        original: originalUrl, 
        proxy: proxyUrl,
        hostname,
        resourceType,
        domainCategory
      });
      
      this.updateStats('urlConverted');
      return proxyUrl;
      
    } catch (error) {
      console.error('[ProxyService v4.0.0] URL conversion failed:', error, 'URL:', originalUrl);
      this.updateStats('conversionError');
      errorLogger.log(error, { context: 'convertToProxyUrl', url: originalUrl });
      return originalUrl;
    }
  }

  /**
   * v4.0.0 智能模式URL处理
   */
  async handleSmartModeUrl(originalUrl, hostname) {
    // 检查域名缓存
    const cachedResult = this.smartMode.domainCache.get(hostname);
    if (cachedResult) {
      if (cachedResult.accessible) {
        return originalUrl; // 直接可访问
      } else {
        return this.convertToProxyUrl(originalUrl); // 需要代理
      }
    }

    // 异步测试域名可访问性
    this.testDomainAccessibility(hostname, originalUrl);
    
    // 默认返回代理URL，避免阻塞
    return this.convertToProxyUrl(originalUrl);
  }

  /**
   * v4.0.0 测试域名可访问性
   */
  async testDomainAccessibility(hostname, originalUrl) {
    try {
      const testUrl = `https://${hostname}/`;
      const controller = new AbortController();
      
      setTimeout(() => controller.abort(), proxyConfig.smartMode.testTimeout);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      
      // 缓存结果
      this.smartMode.domainCache.set(hostname, {
        accessible: true,
        lastTest: Date.now()
      });
      
    } catch (error) {
      this.smartMode.domainCache.set(hostname, {
        accessible: false,
        lastTest: Date.now()
      });
    }
  }

  /**
   * v4.0.0 检查特殊协议
   */
  isSpecialProtocol(url) {
    const specialProtocols = ['magnet:', 'thunder:', 'ed2k:', 'ftp:', 'ftps:'];
    return specialProtocols.some(protocol => url.toLowerCase().startsWith(protocol));
  }

  /**
   * v4.0.0 获取原始URL（从代理URL中提取）
   */
  getOriginalUrl(proxyUrl) {
    if (!proxyUrl || typeof proxyUrl !== 'string') {
      return proxyUrl;
    }

    try {
      const proxyPrefix = `${proxyConfig.proxyServer}/proxy/`;
      if (!proxyUrl.includes(proxyPrefix)) {
        return proxyUrl;
      }

      const proxyPrefixIndex = proxyUrl.indexOf('/proxy/') + 7;
      const remainingUrl = proxyUrl.substring(proxyPrefixIndex);
      
      const firstSlashIndex = remainingUrl.indexOf('/');
      
      let hostname, path;
      if (firstSlashIndex === -1) {
        hostname = remainingUrl;
        path = '/';
      } else {
        hostname = remainingUrl.substring(0, firstSlashIndex);
        path = remainingUrl.substring(firstSlashIndex);
      }
      
      const originalUrl = `https://${hostname}${path}`;
      
      console.debug('[ProxyService v4.0.0] Proxy URL converted to original:', {
        proxy: proxyUrl,
        original: originalUrl,
        hostname,
        path
      });
      
      return originalUrl;
      
    } catch (error) {
      console.error('[ProxyService v4.0.0] Original URL extraction failed:', error, 'Proxy URL:', proxyUrl);
      return proxyUrl;
    }
  }

  /**
   * v4.0.0 智能代理请求（新增方法）
   */
  async makeProxyRequest(url, options = {}) {
    if (!this.isProxyEnabled()) {
      throw new Error('Proxy service not enabled');
    }

    const resourceType = this.cacheManager.detectResourceType(url);
    
    // 检查缓存
    const cached = this.cacheManager.get(url, options);
    if (cached) {
      console.debug('[ProxyService v4.0.0] Using cached response:', url);
      this.updateStats('cacheHit', url);
      return cached;
    }

    const proxyUrl = this.convertToProxyUrl(url);
    if (proxyUrl === url && !this.isSpecialProtocol(url)) {
      throw new Error('URL conversion to proxy failed');
    }

    // v4.0.0: 使用优先级请求队列
    const priority = this.getRequestPriority(resourceType);
    
    return this.requestQueue.add(async () => {
      const startTime = performance.now();
      
      try {
        const requestConfig = this.optimizeRequestConfig(options, resourceType);
        
        // v4.0.0: 重定向处理
        const response = await this.fetchWithRedirectHandling(proxyUrl, requestConfig);
        
        const responseTime = performance.now() - startTime;
        this.updatePerformanceMetrics(responseTime, true);
        
        if (!response.ok) {
          throw new Error(`Proxy request failed: HTTP ${response.status}`);
        }
        
        // 缓存响应
        if (this.isCacheable(resourceType, response)) {
          this.cacheManager.set(url, response.clone(), { resourceType });
        }
        
        this.updateStats('requestSuccess', url);
        return response;
        
      } catch (error) {
        const responseTime = performance.now() - startTime;
        this.updatePerformanceMetrics(responseTime, false);
        
        this.updateStats('requestError', url);
        errorLogger.log(error, { context: 'proxyRequest', url, proxyUrl });
        
        // v4.0.0: 智能降级策略
        if (proxyConfig.errorHandling.fallbackToOriginal && !this.isSpecialProtocol(url)) {
          return this.handleFallback(url, options, error);
        }
        
        throw error;
      }
    }, priority);
  }

  /**
   * v4.0.0 重定向处理（防循环）
   */
  async fetchWithRedirectHandling(url, options, redirectCount = 0) {
    const maxRedirects = proxyConfig.requestConfig.retry.maxAttempts;
    
    if (redirectCount >= maxRedirects) {
      throw new Error(`Too many redirects (${maxRedirects}) for ${url}`);
    }

    const response = await fetch(url, {
      ...options,
      redirect: 'manual' // 手动处理重定向
    });

    // 检查重定向
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        this.stats.redirectCount = (this.stats.redirectCount || 0) + 1;
        
        // v4.0.0: 重定向URL处理
        let redirectUrl;
        try {
          redirectUrl = new URL(location, url).href;
        } catch (error) {
          throw new Error(`Invalid redirect location: ${location}`);
        }
        
        // 防止重定向循环
        if (redirectUrl === url) {
          throw new Error(`Redirect loop detected: ${url}`);
        }
        
        console.debug(`[ProxyService v4.0.0] Following redirect (${redirectCount + 1}): ${redirectUrl}`);
        return this.fetchWithRedirectHandling(redirectUrl, options, redirectCount + 1);
      }
    }

    return response;
  }

  optimizeRequestConfig(options, resourceType) {
    const config = createRequestConfig({ ...options, resourceType });
    
    // v4.0.0: 根据资源类型优化
    if (resourceType === RESOURCE_TYPES.IMAGE || resourceType === RESOURCE_TYPES.MEDIA) {
      config.timeout = 60000; // 媒体文件更长超时
      if (!config.headers.get('Accept')) {
        config.headers.set('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');
      }
    } else if (resourceType === RESOURCE_TYPES.API) {
      config.timeout = 10000; // API请求短超时
      config.headers.set('Accept', 'application/json');
    } else if (resourceType === RESOURCE_TYPES.TORRENT || resourceType === RESOURCE_TYPES.MAGNET) {
      // v4.0.0: 种子和磁力链接特殊处理
      config.timeout = 30000;
      config.headers.set('Accept', 'application/x-bittorrent,*/*');
    }
    
    return config;
  }

  getRequestPriority(resourceType) {
    return proxyConfig.performance.priority[resourceType] || 1;
  }

  isCacheable(resourceType, response) {
    if (response.status !== 200) return false;
    
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      return false;
    }
    
    // v4.0.0: 更多资源类型可缓存
    const alwaysCacheable = [
      RESOURCE_TYPES.IMAGE,
      RESOURCE_TYPES.FONT,
      RESOURCE_TYPES.CSS,
      RESOURCE_TYPES.JS,
      RESOURCE_TYPES.MEDIA
    ];
    
    return alwaysCacheable.includes(resourceType);
  }

  async handleFallback(url, options, originalError) {
    console.warn('[ProxyService v4.0.0] Proxy failed, trying direct access:', originalError.message);
    
    try {
      const fallbackResponse = await fetch(url, createRequestConfig(options));
      this.updateStats('fallbackSuccess', url);
      return fallbackResponse;
    } catch (fallbackError) {
      this.updateStats('fallbackError', url);
      throw new Error(`Both proxy and direct access failed: ${originalError.message}, ${fallbackError.message}`);
    }
  }

  // ===================== v4.0.0 状态管理增强 =====================

  async enableProxy() {
    try {
      console.log('[ProxyService v4.0.0] Enabling proxy...');
      this.currentStatus = proxyConfig.status.CHECKING;
      this.retryCount = 0;
      
      // v4.0.0: 并发测试多个端点
      const connectivityTests = await Promise.allSettled([
        testProxyConnectivity(),
        this.testProxyEndpoint(proxyConfig.apiEndpoints.health),
        this.testProxyEndpoint(proxyConfig.apiEndpoints.status),
        this.testProxyEndpoint(proxyConfig.apiEndpoints.proxyStats)
      ]);
      
      const successfulTest = connectivityTests.find(result => 
        result.status === 'fulfilled' && result.value.success
      );
      
      if (!successfulTest) {
        if (this.retryCount < proxyConfig.errorHandling.maxRetries) {
          this.retryCount++;
          console.log(`[ProxyService v4.0.0] Connection failed, retrying ${this.retryCount}/${proxyConfig.errorHandling.maxRetries}`);
          
          await new Promise(resolve => 
            setTimeout(resolve, proxyConfig.errorHandling.retryDelays[this.retryCount - 1] || 1000)
          );
          
          return await this.enableProxy();
        }
        
        this.currentStatus = proxyConfig.status.ERROR;
        const error = 'Proxy server connection failed';
        errorLogger.log(new Error(error), { 
          context: 'enableProxy', 
          retryCount: this.retryCount,
          tests: connectivityTests.map(r => r.status === 'fulfilled' ? r.value : r.reason?.message)
        });
        return { success: false, error };
      }

      // v4.0.0: 根据健康状态设置状态
      const healthData = successfulTest.value.data;
      if (healthData?.status === 'healthy') {
        this.currentStatus = proxyConfig.status.ENABLED;
        this.isHealthy = true;
      } else {
        this.currentStatus = proxyConfig.status.DEGRADED;
        this.isHealthy = false;
      }
      
      this.saveProxyState(true);
      this.startHealthCheck();
      this.retryCount = 0;
      
      this.dispatchStatusChange();
      
      console.log('[ProxyService v4.0.0] Proxy enabled successfully', { 
        status: this.currentStatus,
        healthy: this.isHealthy,
        responseTime: successfulTest.value.responseTime,
        version: healthData?.version || 'unknown'
      });
      
      return { 
        success: true, 
        message: 'Proxy enabled successfully',
        status: this.currentStatus,
        responseTime: successfulTest.value.responseTime,
        version: healthData?.version
      };
      
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('[ProxyService v4.0.0] Enable proxy failed:', error);
      errorLogger.log(error, { context: 'enableProxy', retryCount: this.retryCount });
      return { success: false, error: error.message };
    }
  }

  async disableProxy() {
    try {
      this.currentStatus = proxyConfig.status.DISABLED;
      this.saveProxyState(false);
      this.stopHealthCheck();
      this.retryCount = 0;
      this.isHealthy = null;
      
      this.dispatchStatusChange();
      
      console.log('[ProxyService v4.0.0] Proxy disabled');
      return { success: true, message: 'Proxy disabled' };
    } catch (error) {
      console.error('[ProxyService v4.0.0] Disable proxy failed:', error);
      errorLogger.log(error, { context: 'disableProxy' });
      return { success: false, error: error.message };
    }
  }

  async testProxyEndpoint(endpoint) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${proxyConfig.proxyServer}${endpoint}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          data,
          endpoint: endpoint
        };
      }
      
      return { success: false, error: `HTTP ${response.status}`, endpoint };
    } catch (error) {
      return { success: false, error: error.message, endpoint };
    }
  }

  /**
   * v4.0.0 增强版状态获取
   */
  getProxyStatus() {
    return {
      enabled: this.isProxyEnabled(),
      status: this.currentStatus,
      server: proxyConfig.proxyServer,
      supportedDomains: proxyConfig.supportedDomains.length,
      stats: this.stats,
      lastHealthCheck: this.lastHealthCheck,
      isHealthy: this.isHealthy,
      retryCount: this.retryCount,
      
      // v4.0.0: 新增性能指标
      performance: {
        avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime),
        successRate: (this.performanceMetrics.successRate * 100).toFixed(1) + '%',
        redirectCount: this.performanceMetrics.redirectCount,
        specialLinksProcessed: this.performanceMetrics.specialLinksProcessed,
        cacheStats: this.cacheManager.getStats(),
        queueStatus: this.requestQueue.getStatus()
      },
      
      // v4.0.0: 智能模式状态
      smartMode: {
        ...this.smartMode,
        domainCacheSize: this.smartMode.domainCache.size
      },
      
      // v4.0.0: 版本和特性信息
      version: proxyConfig.version,
      features: {
        magnetLinks: proxyConfig.specialHandling.magnetLinks,
        smartCaching: proxyConfig.cacheStrategy.enabled,
        redirectHandling: true,
        healthMonitoring: true,
        requestQueue: true,
        specialProtocolSupport: true
      },
      
      errorLogs: errorLogger.getLogs().slice(-5),
      config: validateProxyConfig()
    };
  }

  // ===================== v4.0.0 性能和监控增强 =====================

  startPerformanceMonitoring() {
    setInterval(() => {
      const queueStatus = this.requestQueue.getStatus();
      const cacheStats = this.cacheManager.getStats();
      
      console.debug('[ProxyService v4.0.0] Performance metrics:', {
        avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime) + 'ms',
        successRate: (this.performanceMetrics.successRate * 100).toFixed(1) + '%',
        redirectCount: this.performanceMetrics.redirectCount,
        specialLinks: this.performanceMetrics.specialLinksProcessed,
        queueLength: queueStatus.queueLength,
        activeRequests: queueStatus.activeRequests,
        cacheHitRate: (cacheStats.hitRate * 100).toFixed(1) + '%',
        cacheSize: cacheStats.size,
        memoryUsage: cacheStats.memoryUsage?.current + 'KB'
      });
    }, 60000);
  }

  startSmartModeMonitoring() {
    if (!this.smartMode.enabled) return;
    
    // 定期清理域名缓存
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      
      for (const [domain, data] of this.smartMode.domainCache.entries()) {
        if (now - data.lastTest > maxAge) {
          this.smartMode.domainCache.delete(domain);
        }
      }
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  updatePerformanceMetrics(responseTime, success) {
    const alpha = 0.1;
    this.performanceMetrics.avgResponseTime = 
      (1 - alpha) * this.performanceMetrics.avgResponseTime + alpha * responseTime;
    
    this.performanceMetrics.successRate = 
      (1 - alpha) * this.performanceMetrics.successRate + alpha * (success ? 1 : 0);
    
    this.performanceMetrics.lastMeasurement = Date.now();
  }

  // ===================== v4.0.0 健康检查增强 =====================

  async checkProxyHealth() {
    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);

      const response = await fetch(getProxyHealthCheckUrl(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();
      this.lastHealthCheck = Date.now();
      this.isHealthy = healthData.status === 'healthy';

      // v4.0.0: 根据健康状态调整检查频率
      if (this.isHealthy) {
        this.adjustHealthCheckFrequency(5 * 60 * 1000);
      } else {
        this.adjustHealthCheckFrequency(1 * 60 * 1000);
      }

      return { 
        success: true, 
        data: healthData,
        responseTime: Math.round(endTime - startTime)
      };
      
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      
      this.adjustHealthCheckFrequency(30 * 1000);
      
      let errorMessage = 'Health check failed';
      if (error.name === 'AbortError') {
        errorMessage = 'Health check timeout';
      } else if (error.message) {
        errorMessage = error.message;
      }

      errorLogger.log(error, { context: 'healthCheck' });
      return { success: false, error: errorMessage };
    }
  }

  adjustHealthCheckFrequency(interval) {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      if (this.isProxyEnabled()) {
        this.checkProxyHealth().then(result => {
          if (!result.success) {
            console.warn('[ProxyService v4.0.0] Health check failed:', result.error);
            this.dispatchHealthCheckFailed(result.error);
          } else {
            this.retryCount = 0;
          }
        });
      }
    }, interval);
  }

  startHealthCheck() {
    this.checkProxyHealth();
    this.adjustHealthCheckFrequency(5 * 60 * 1000);
  }

  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ===================== 存储和统计管理 =====================

  saveProxyState(enabled) {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyEnabled, enabled.toString());
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Failed to save proxy state:', error);
    }
  }

  loadProxyState() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyEnabled);
      return stored === 'true';
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Failed to load proxy state:', error);
      return proxyConfig.defaultEnabled;
    }
  }

  saveStats() {
    try {
      const statsWithVersion = {
        ...this.stats,
        version: proxyConfig.version,
        lastSaved: Date.now()
      };
      localStorage.setItem(proxyConfig.storageKeys.proxyStats, JSON.stringify(statsWithVersion));
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Failed to save stats:', error);
    }
  }

  loadStats() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyStats);
      if (stored) {
        const parsed = JSON.parse(stored);
        // v4.0.0: 版本兼容性检查
        if (parsed.version?.backend !== proxyConfig.version.backend) {
          console.log('[ProxyService v4.0.0] Stats version mismatch, resetting...');
          return getDefaultConfig().stats;
        }
        return parsed;
      }
      return getDefaultConfig().stats;
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Failed to load stats:', error);
      return getDefaultConfig().stats;
    }
  }

  updateStats(action, ...args) {
    try {
      switch (action) {
        case 'urlConverted':
          this.stats.totalRequests++;
          this.stats.successfulRequests++;
          this.stats.lastUsed = Date.now();
          break;
        case 'conversionError':
          this.stats.totalRequests++;
          this.stats.failedRequests++;
          break;
        case 'requestSuccess':
          this.stats.successfulRequests++;
          break;
        case 'requestError':
          this.stats.failedRequests++;
          break;
        case 'fallbackSuccess':
          this.stats.fallbackSuccesses = (this.stats.fallbackSuccesses || 0) + 1;
          break;
        case 'fallbackError':
          this.stats.fallbackErrors = (this.stats.fallbackErrors || 0) + 1;
          break;
        case 'healthCheckFailed':
          this.stats.healthCheckFailures = (this.stats.healthCheckFailures || 0) + 1;
          break;
        case 'cacheHit':
          this.stats.cacheHits = (this.stats.cacheHits || 0) + 1;
          break;
      }
      
      setTimeout(() => this.saveStats(), 0);
    } catch (error) {
      console.warn('[ProxyService v4.0.0] Failed to update stats:', error);
    }
  }

  dispatchStatusChange() {
    document.dispatchEvent(new CustomEvent('proxyStatusChanged', {
      detail: {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        healthy: this.isHealthy,
        timestamp: Date.now(),
        stats: this.stats,
        version: proxyConfig.version
      }
    }));
  }

  dispatchHealthCheckFailed(error) {
    this.updateStats('healthCheckFailed');
    
    document.dispatchEvent(new CustomEvent('proxyHealthCheckFailed', {
      detail: {
        error,
        timestamp: Date.now(),
        canRetry: this.retryCount < proxyConfig.errorHandling.maxRetries,
        retryCount: this.retryCount
      }
    }));
  }

  // ===================== v4.0.0 诊断和管理 =====================

  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      version: proxyConfig.version,
      config: validateProxyConfig(),
      connectivity: null,
      performance: {
        metrics: this.performanceMetrics,
        cache: this.cacheManager.getStats(),
        queue: this.requestQueue.getStatus()
      },
      status: this.getProxyStatus(),
      smartMode: {
        enabled: this.smartMode.enabled,
        domainCacheSize: this.smartMode.domainCache.size,
        domains: Array.from(this.smartMode.domainCache.keys())
      },
      errors: errorLogger.getLogs().slice(-10),
      recommendations: []
    };
    
    try {
      results.connectivity = await testProxyConnectivity();
    } catch (error) {
      results.connectivity = { success: false, error: error.message };
    }
    
    // v4.0.0: 智能建议生成
    if (results.performance.cache.hitRate < 0.3) {
      results.recommendations.push('Cache hit rate is low, consider adjusting cache strategy');
    }
    
    if (results.performance.metrics.avgResponseTime > 2000) {
      results.recommendations.push('Average response time is high, check network conditions');
    }
    
    if (results.performance.metrics.redirectCount > 50) {
      results.recommendations.push('High redirect count detected, monitor for redirect loops');
    }
    
    if (!this.smartMode.enabled && proxyConfig.supportedDomains.length > 20) {
      results.recommendations.push('Consider enabling smart mode for better performance');
    }
    
    return results;
  }

  async resetProxy() {
    try {
      console.log('[ProxyService v4.0.0] Resetting proxy service...');
      
      this.stopHealthCheck();
      
      this.currentStatus = proxyConfig.status.DISABLED;
      this.retryCount = 0;
      this.isHealthy = null;
      this.lastHealthCheck = null;
      
      this.saveProxyState(false);
      
      this.cacheManager.clear();
      this.smartMode.domainCache.clear();
      
      errorLogger.clearLogs();
      
      // 重置性能指标
      this.performanceMetrics = {
        avgResponseTime: 0,
        successRate: 1,
        redirectCount: 0,
        specialLinksProcessed: 0,
        lastMeasurement: Date.now()
      };
      
      console.log('[ProxyService v4.0.0] Proxy service reset complete');
      return { success: true, message: 'Proxy service reset successfully' };
    } catch (error) {
      console.error('[ProxyService v4.0.0] Reset failed:', error);
      return { success: false, error: error.message };
    }
  }

  shouldProxy(url) {
    if (!url) return false;
    
    try {
      if (this.isSpecialProtocol(url)) return true; // 特殊协议总是代理
      
      const hostname = new URL(url).hostname;
      return isDomainSupported(hostname);
    } catch {
      return false;
    }
  }

  cleanup() {
    this.stopHealthCheck();
    this.saveStats();
    this.cacheManager.clear();
    this.smartMode.domainCache.clear();
    this.isInitialized = false;
    console.log('[ProxyService v4.0.0] Resources cleaned up');
  }
}

// 创建单例实例
const proxyService = new ProxyService();

// 导出独立工具函数（向后兼容）
export function convertToProxyUrl(originalUrl, proxyServer) {
  const tempConfig = { ...proxyConfig };
  if (proxyServer) {
    tempConfig.proxyServer = proxyServer;
  }
  
  const tempService = Object.create(proxyService);
  tempService.proxyConfig = tempConfig;
  return tempService.convertToProxyUrl(originalUrl);
}

export function getOriginalUrl(proxyUrl, proxyServer) {
  const tempService = Object.create(proxyService);
  if (proxyServer) {
    tempService.proxyConfig = { ...proxyConfig, proxyServer };
  }
  return tempService.getOriginalUrl(proxyUrl);
}

export default proxyService;