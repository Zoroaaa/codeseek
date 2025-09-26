// frontend/src/services/proxy-service.js - 重构版代理服务
// 版本: v2.1.0 - 适配后端Enhanced Proxy Worker v2.0.0

import { 
  proxyConfig, 
  validateProxyConfig, 
  getProxyHealthCheckUrl, 
  getProxyStatusUrl,
  getCacheClearUrl,
  isDomainSupported,
  getDefaultConfig,
  createRequestConfig,
  testProxyConnectivity,
  errorLogger
} from '../core/proxy-config.js';

/**
 * 资源类型枚举
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
  OTHER: 'other'
};

/**
 * 智能缓存管理器（适配后端KV缓存）
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 100;
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * 生成缓存键
   */
  generateKey(url, options = {}) {
    const { method = 'GET', headers = {} } = options;
    return `${method}:${url}:${JSON.stringify(headers)}`;
  }

  /**
   * 获取缓存
   */
  get(url, options = {}) {
    const key = this.generateKey(url, options);
    const cached = this.cache.get(key);
    
    if (cached && !this.isExpired(cached)) {
      this.cacheStats.hits++;
      this.cache.delete(key);
      this.cache.set(key, cached); // LRU移到末尾
      return cached.data;
    }
    
    this.cacheStats.misses++;
    return null;
  }

  /**
   * 设置缓存
   */
  set(url, data, options = {}) {
    const key = this.generateKey(url, options);
    const ttl = this.getTTL(data.resourceType);
    
    // LRU淘汰策略
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.cacheStats.evictions++;
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      resourceType: data.resourceType
    });
  }

  /**
   * 判断缓存是否过期
   */
  isExpired(cached) {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  /**
   * 获取TTL（基于资源类型）
   */
  getTTL(resourceType) {
    return proxyConfig.cacheStrategy.ttl[resourceType] || 
           proxyConfig.cacheStrategy.ttl.default;
  }

  /**
   * 清除缓存
   */
  clear(pattern = null) {
    if (pattern) {
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    } else {
      this.cache.clear();
    }
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      ...this.cacheStats,
      size: this.cache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
}

/**
 * 请求队列管理器
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
      averageTime: 0
    };
  }

  /**
   * 添加请求到队列
   */
  async add(requestFn, priority = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        fn: requestFn,
        priority,
        resolve,
        reject,
        startTime: null
      });
      
      this.queue.sort((a, b) => b.priority - a.priority);
      this.processNext();
    });
  }

  /**
   * 处理下一个请求
   */
  async processNext() {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    this.active++;
    this.stats.totalRequests++;
    item.startTime = Date.now();

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

  /**
   * 更新平均响应时间
   */
  updateAverageTime(responseTime) {
    const weight = 0.9;
    this.stats.averageTime = this.stats.averageTime * weight + responseTime * (1 - weight);
  }

  /**
   * 获取队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      activeRequests: this.active,
      stats: { ...this.stats }
    };
  }
}

/**
 * 重构版代理服务类（适配后端Enhanced Proxy Worker）
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
    
    // 缓存管理器和请求队列
    this.cacheManager = new CacheManager();
    this.requestQueue = new RequestQueue(proxyConfig.performance.maxConcurrent);
    
    // 性能监控
    this.performanceMetrics = {
      avgResponseTime: 0,
      successRate: 1,
      lastMeasurement: Date.now()
    };
    
    // 后端版本信息
    this.backendInfo = {
      version: null,
      features: null,
      lastUpdated: null
    };
    
    // 验证配置
    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('代理配置验证失败:', validation.issues);
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('代理配置警告:', validation.warnings);
      }
    }
  }

  /**
   * 初始化代理服务
   */
  async init() {
    try {
      const enabled = this.loadProxyState();
      
      if (enabled) {
        this.enableProxyAsync();
      }
      
      this.startPerformanceMonitoring();
      this.isInitialized = true;
      
      console.log('代理服务初始化完成', {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        backend: proxyConfig.backendVersion,
        frontend: proxyConfig.version
      });
      
      return { success: true };
    } catch (error) {
      console.error('代理服务初始化失败:', error);
      this.currentStatus = proxyConfig.status.ERROR;
      errorLogger.log(error, { context: 'initialization' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 异步启用代理
   */
  async enableProxyAsync() {
    try {
      await this.enableProxy();
    } catch (error) {
      console.warn('异步启用代理失败:', error.message);
      errorLogger.log(error, { context: 'enableProxyAsync' });
    }
  }

  // ===================== 核心功能（重构版） =====================

  /**
   * 检查代理是否开启
   */
  isProxyEnabled() {
    return this.currentStatus === proxyConfig.status.ENABLED;
  }

  /**
   * 切换代理开关
   */
  async toggleProxy() {
    try {
      if (this.isProxyEnabled()) {
        return await this.disableProxy();
      } else {
        return await this.enableProxy();
      }
    } catch (error) {
      console.error('切换代理状态失败:', error);
      errorLogger.log(error, { context: 'toggle', currentStatus: this.currentStatus });
      return { success: false, error: error.message };
    }
  }

  /**
   * 智能URL转换（适配后端格式）
   */
  convertToProxyUrl(originalUrl, options = {}) {
    if (!originalUrl || typeof originalUrl !== 'string') {
      throw new Error('Invalid URL provided');
    }

    try {
      const url = new URL(originalUrl);
      const hostname = url.hostname;
      
      // 检查缓存的URL映射
      const cachedMapping = this.cacheManager.get(`url-mapping:${originalUrl}`);
      if (cachedMapping) {
        return cachedMapping;
      }
      
      // 检查域名是否支持代理
      if (!isDomainSupported(hostname)) {
        console.debug(`域名 ${hostname} 不在代理支持列表中`);
        return originalUrl;
      }

      // 根据后端格式构建代理URL：{proxy}/{target_url}
      // 后端期望的格式是：https://all.omnibox.pp.ua/https://target.com/path
      const proxyUrl = `${proxyConfig.proxyServer}/${originalUrl}`;

      // 缓存URL映射
      this.cacheManager.set(`url-mapping:${originalUrl}`, proxyUrl, {
        resourceType: RESOURCE_TYPES.OTHER
      });

      console.debug('URL转换完成:', { 
        original: originalUrl, 
        proxy: proxyUrl,
        hostname
      });
      
      return proxyUrl;
    } catch (error) {
      console.error('URL转换失败:', error, 'Original URL:', originalUrl);
      return originalUrl;
    }
  }

  /**
   * 获取原始URL（从代理URL中提取）
   */
  getOriginalUrl(proxyUrl) {
    if (!proxyUrl || typeof proxyUrl !== 'string') {
      return proxyUrl;
    }

    try {
      // 检查是否是代理URL
      const proxyPrefix = `${proxyConfig.proxyServer}/`;
      if (!proxyUrl.startsWith(proxyPrefix)) {
        return proxyUrl; // 不是代理URL，直接返回
      }

      // 提取原始URL：去掉代理前缀
      const originalUrl = proxyUrl.substring(proxyPrefix.length);
      
      console.debug('代理URL转换为原始URL:', {
        proxy: proxyUrl,
        original: originalUrl
      });
      
      return originalUrl;
    } catch (error) {
      console.error('原始URL提取失败:', error, 'Proxy URL:', proxyUrl);
      return proxyUrl;
    }
  }

  /**
   * 检测资源类型
   */
  detectResourceType(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    
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
      'pdf': RESOURCE_TYPES.DOCUMENT
    };
    
    return typeMap[ext] || RESOURCE_TYPES.OTHER;
  }

  /**
   * 智能代理请求（适配后端API）
   */
  async makeProxyRequest(url, options = {}) {
    if (!this.isProxyEnabled()) {
      throw new Error('代理服务未启用');
    }

    const resourceType = this.detectResourceType(new URL(url).pathname);
    
    // 检查缓存
    const cached = this.cacheManager.get(url, options);
    if (cached) {
      console.debug('使用缓存响应:', url);
      this.updateStats('cacheHit', url);
      return cached;
    }

    const proxyUrl = this.convertToProxyUrl(url);
    if (proxyUrl === url) {
      throw new Error('URL转换为代理URL失败');
    }

    // 使用请求队列
    const priority = this.getRequestPriority(resourceType);
    
    return this.requestQueue.add(async () => {
      const startTime = performance.now();
      
      try {
        const requestConfig = this.optimizeRequestConfig(options, resourceType);
        const response = await fetch(proxyUrl, requestConfig);
        
        const responseTime = performance.now() - startTime;
        this.updatePerformanceMetrics(responseTime, true);
        
        if (!response.ok) {
          throw new Error(`代理请求失败: HTTP ${response.status}`);
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
        
        // 智能降级策略
        if (proxyConfig.errorHandling.fallbackToOriginal) {
          return this.handleFallback(url, options, error);
        }
        
        throw error;
      }
    }, priority);
  }

  /**
   * 优化请求配置
   */
  optimizeRequestConfig(options, resourceType) {
    const config = createRequestConfig({ ...options, resourceType });
    
    // 针对不同资源类型的特殊处理
    if (resourceType === RESOURCE_TYPES.IMAGE || resourceType === RESOURCE_TYPES.MEDIA) {
      config.timeout = proxyConfig.requestConfig.timeouts.media;
    } else if (resourceType === RESOURCE_TYPES.API) {
      config.timeout = proxyConfig.requestConfig.timeouts.api;
    }
    
    return config;
  }

  /**
   * 获取请求优先级
   */
  getRequestPriority(resourceType) {
    return proxyConfig.performance.priority[resourceType] || 1;
  }

  /**
   * 判断资源是否可缓存
   */
  isCacheable(resourceType, response) {
    if (response.status !== 200) return false;
    
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      return false;
    }
    
    return proxyConfig.cacheStrategy.rules.alwaysCache.includes(resourceType);
  }

  /**
   * 处理降级
   */
  async handleFallback(url, options, originalError) {
    console.warn('代理请求失败，尝试直接请求:', originalError.message);
    
    try {
      const fallbackResponse = await fetch(url, createRequestConfig(options));
      this.updateStats('fallbackSuccess', url);
      return fallbackResponse;
    } catch (fallbackError) {
      this.updateStats('fallbackError', url);
      throw new Error(`代理和直接请求均失败: ${originalError.message}, ${fallbackError.message}`);
    }
  }

  // ===================== 状态管理（适配后端API） =====================

  /**
   * 启用代理（适配后端健康检查）
   */
  async enableProxy() {
    try {
      this.currentStatus = proxyConfig.status.CHECKING;
      this.retryCount = 0;
      
      // 并发测试多个端点
      const connectivityTests = await Promise.allSettled([
        testProxyConnectivity(),
        this.testBackendStatus(),
        this.fetchBackendInfo()
      ]);
      
      // 检查是否有成功的连接
      const successfulTest = connectivityTests.find(
        r => r.status === 'fulfilled' && r.value.success
      );
      
      if (!successfulTest) {
        if (this.retryCount < proxyConfig.errorHandling.maxRetries) {
          this.retryCount++;
          console.log(`代理连接失败，尝试重试 ${this.retryCount}/${proxyConfig.errorHandling.maxRetries}`);
          
          await new Promise(resolve => 
            setTimeout(resolve, proxyConfig.errorHandling.retryDelays[this.retryCount - 1] || 1000)
          );
          
          return await this.enableProxy();
        }
        
        this.currentStatus = proxyConfig.status.ERROR;
        const error = '代理服务器连接失败';
        errorLogger.log(new Error(error), { 
          context: 'enableProxy', 
          retryCount: this.retryCount
        });
        return { success: false, error };
      }

      this.currentStatus = proxyConfig.status.ENABLED;
      this.saveProxyState(true);
      this.startHealthCheck();
      this.retryCount = 0;
      
      this.dispatchStatusChange();
      
      console.log('代理已启用', { 
        responseTime: successfulTest.value.responseTime,
        backendVersion: this.backendInfo.version
      });
      
      return { 
        success: true, 
        message: '代理已启用',
        responseTime: successfulTest.value.responseTime,
        backendInfo: this.backendInfo
      };
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('启用代理失败:', error);
      errorLogger.log(error, { context: 'enableProxy', retryCount: this.retryCount });
      return { success: false, error: error.message };
    }
  }

  /**
   * 禁用代理
   */
  async disableProxy() {
    try {
      this.currentStatus = proxyConfig.status.DISABLED;
      this.saveProxyState(false);
      this.stopHealthCheck();
      this.retryCount = 0;
      
      this.dispatchStatusChange();
      
      console.log('代理已禁用');
      return { success: true, message: '代理已禁用' };
    } catch (error) {
      console.error('禁用代理失败:', error);
      errorLogger.log(error, { context: 'disableProxy' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试后端状态
   */
  async testBackendStatus() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(getProxyStatusUrl(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return { success: true, data };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取后端信息
   */
  async fetchBackendInfo() {
    try {
      const response = await fetch(getProxyStatusUrl(), {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (response.ok) {
        const data = await response.json();
        this.backendInfo = {
          version: data.version || 'unknown',
          features: data.features || {},
          lastUpdated: Date.now()
        };
        return { success: true, data };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取代理状态（增强版）
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
      performance: {
        avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime),
        successRate: this.performanceMetrics.successRate,
        cacheStats: this.cacheManager.getStats(),
        queueStatus: this.requestQueue.getStatus()
      },
      backend: this.backendInfo,
      version: proxyConfig.version,
      errorLogs: errorLogger.getLogs().slice(-5)
    };
  }

  // ===================== 健康检查（适配后端API） =====================

  /**
   * 健康检查（适配后端enhanced版本）
   */
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

      // 更新后端信息
      if (healthData.version) {
        this.backendInfo.version = healthData.version;
        this.backendInfo.features = healthData.features;
        this.backendInfo.lastUpdated = Date.now();
      }

      // 根据健康状态动态调整检查频率
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
      
      let errorMessage = '健康检查失败';
      if (error.name === 'AbortError') {
        errorMessage = '健康检查超时';
      } else if (error.message) {
        errorMessage = error.message;
      }

      errorLogger.log(error, { context: 'healthCheck' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 调整健康检查频率
   */
  adjustHealthCheckFrequency(interval) {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      if (this.isProxyEnabled()) {
        this.checkProxyHealth().then(result => {
          if (!result.success) {
            console.warn('代理健康检查失败:', result.error);
            this.dispatchHealthCheckFailed(result.error);
          } else {
            this.retryCount = 0;
          }
        });
      }
    }, interval);
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    this.checkProxyHealth();
    this.adjustHealthCheckFrequency(5 * 60 * 1000);
  }

  /**
   * 停止健康检查
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ===================== 缓存管理（适配后端KV） =====================

  /**
   * 清理代理缓存（支持后端KV清理）
   */
  async clearProxyCache(pattern = null) {
    const results = {
      frontend: false,
      backend: false,
      errors: []
    };

    // 清理前端缓存
    try {
      this.cacheManager.clear(pattern);
      results.frontend = true;
    } catch (error) {
      results.errors.push(`前端缓存清理失败: ${error.message}`);
    }

    // 清理后端KV缓存
    try {
      const response = await fetch(getCacheClearUrl(), {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern || 'enhanced-proxy-cache-v2.0' })
      });

      if (response.ok) {
        results.backend = true;
      } else {
        results.errors.push(`后端缓存清理失败: HTTP ${response.status}`);
      }
    } catch (error) {
      results.errors.push(`后端缓存清理失败: ${error.message}`);
    }

    console.log('缓存清理结果:', results);
    return results;
  }

  // ===================== 性能监控和统计 =====================

  /**
   * 性能监控
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      const queueStatus = this.requestQueue.getStatus();
      const cacheStats = this.cacheManager.getStats();
      
      console.debug('性能指标:', {
        avgResponseTime: Math.round(this.performanceMetrics.avgResponseTime),
        successRate: (this.performanceMetrics.successRate * 100).toFixed(1) + '%',
        queueLength: queueStatus.queueLength,
        activeRequests: queueStatus.activeRequests,
        cacheHitRate: (cacheStats.hitRate * 100).toFixed(1) + '%',
        cacheSize: cacheStats.size,
        backend: this.backendInfo.version
      });
    }, 60000);
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(responseTime, success) {
    const alpha = 0.1;
    this.performanceMetrics.avgResponseTime = 
      (1 - alpha) * this.performanceMetrics.avgResponseTime + alpha * responseTime;
    
    this.performanceMetrics.successRate = 
      (1 - alpha) * this.performanceMetrics.successRate + alpha * (success ? 1 : 0);
    
    this.performanceMetrics.lastMeasurement = Date.now();
  }

  // ===================== 本地存储管理 =====================

  saveProxyState(enabled) {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyEnabled, enabled.toString());
    } catch (error) {
      console.warn('保存代理状态失败:', error);
    }
  }

  loadProxyState() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyEnabled);
      return stored === 'true';
    } catch (error) {
      console.warn('加载代理状态失败:', error);
      return proxyConfig.defaultEnabled;
    }
  }

  saveStats() {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyStats, JSON.stringify(this.stats));
    } catch (error) {
      console.warn('保存代理统计失败:', error);
    }
  }

  loadStats() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyStats);
      return stored ? JSON.parse(stored) : getDefaultConfig().stats;
    } catch (error) {
      console.warn('加载代理统计失败:', error);
      return getDefaultConfig().stats;
    }
  }

  // ===================== 统计和事件 =====================

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
      console.warn('更新统计数据失败:', error);
    }
  }

  dispatchStatusChange() {
    document.dispatchEvent(new CustomEvent('proxyStatusChanged', {
      detail: {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        timestamp: Date.now(),
        stats: this.stats,
        backend: this.backendInfo
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

  // ===================== 诊断和调试 =====================

  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      config: validateProxyConfig(),
      connectivity: null,
      backend: null,
      performance: {
        metrics: this.performanceMetrics,
        cache: this.cacheManager.getStats(),
        queue: this.requestQueue.getStatus()
      },
      status: this.getProxyStatus(),
      errors: errorLogger.getLogs().slice(-10),
      recommendations: []
    };
    
    try {
      results.connectivity = await testProxyConnectivity();
      results.backend = await this.fetchBackendInfo();
    } catch (error) {
      results.connectivity = { success: false, error: error.message };
    }
    
    // 生成建议
    if (results.performance.cache.hitRate < 0.3) {
      results.recommendations.push('缓存命中率较低，考虑调整缓存策略');
    }
    
    if (results.performance.metrics.avgResponseTime > 2000) {
      results.recommendations.push('平均响应时间较高，可能存在网络问题');
    }
    
    if (results.performance.metrics.successRate < 0.8) {
      results.recommendations.push('成功率较低，建议检查代理服务器状态');
    }
    
    return results;
  }

  async resetProxy() {
    try {
      this.stopHealthCheck();
      this.currentStatus = proxyConfig.status.DISABLED;
      this.retryCount = 0;
      this.isHealthy = null;
      this.lastHealthCheck = null;
      
      this.saveProxyState(false);
      this.cacheManager.clear();
      errorLogger.clearLogs();
      
      console.log('代理服务已重置');
      return { success: true, message: '代理服务已重置' };
    } catch (error) {
      console.error('重置代理服务失败:', error);
      return { success: false, error: error.message };
    }
  }

  shouldProxy(url) {
    if (!url) return false;
    
    try {
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
    this.isInitialized = false;
    console.log('代理服务资源已清理');
  }
}

// 创建单例实例
const proxyService = new ProxyService();

// 导出独立的工具函数
export function convertToProxyUrl(originalUrl, proxyServer) {
  const service = new ProxyService();
  service.proxyConfig = { ...proxyConfig, proxyServer: proxyServer || proxyConfig.proxyServer };
  return service.convertToProxyUrl(originalUrl);
}

export function getOriginalUrl(proxyUrl, proxyServer) {
  if (!proxyUrl || typeof proxyUrl !== 'string') {
    return proxyUrl;
  }

  const server = proxyServer || proxyConfig.proxyServer;

  try {
    const proxyPrefix = `${server}/`;
    if (!proxyUrl.startsWith(proxyPrefix)) {
      return proxyUrl;
    }

    const originalUrl = proxyUrl.substring(proxyPrefix.length);
    return originalUrl;
  } catch (error) {
    console.error('原始URL提取失败:', error, 'Proxy URL:', proxyUrl);
    return proxyUrl;
  }
}

export default proxyService;