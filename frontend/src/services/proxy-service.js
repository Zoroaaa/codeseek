// frontend/src/services/proxy-service.js - 优化版代理服务
// 版本: v2.0.0 - 完善的资源处理和智能缓存

import { 
  proxyConfig, 
  validateProxyConfig, 
  getProxyHealthCheckUrl, 
  getProxyStatusUrl,
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
 * 智能缓存管理器
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 100; // 最大缓存条目数
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
      this.cache.set(key, cached); // LRU: 移到末尾
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
    const ttlMap = {
      [RESOURCE_TYPES.HTML]: 5 * 60 * 1000,        // 5分钟
      [RESOURCE_TYPES.CSS]: 60 * 60 * 1000,        // 1小时
      [RESOURCE_TYPES.JS]: 60 * 60 * 1000,         // 1小时
      [RESOURCE_TYPES.IMAGE]: 24 * 60 * 60 * 1000, // 24小时
      [RESOURCE_TYPES.FONT]: 7 * 24 * 60 * 60 * 1000, // 7天
      [RESOURCE_TYPES.API]: 60 * 1000,             // 1分钟
      [RESOURCE_TYPES.OTHER]: 30 * 60 * 1000       // 30分钟
    };
    
    return ttlMap[resourceType] || ttlMap[RESOURCE_TYPES.OTHER];
  }

  /**
   * 清除缓存
   */
  clear(pattern = null) {
    if (pattern) {
      // 清除匹配模式的缓存
      const keys = Array.from(this.cache.keys());
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    } else {
      // 清除所有缓存
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
      
      // 按优先级排序
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
    const weight = 0.9; // 指数移动平均权重
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
 * 优化版代理服务类
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
    
    // 新增：缓存管理器和请求队列
    this.cacheManager = new CacheManager();
    this.requestQueue = new RequestQueue(6);
    
    // 性能监控
    this.performanceMetrics = {
      avgResponseTime: 0,
      successRate: 1,
      lastMeasurement: Date.now()
    };
    
    // 验证配置
    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('代理配置验证失败:', validation.issues);
    }
  }

  /**
   * 初始化代理服务
   */
  async init() {
    try {
      // 加载用户偏好
      const enabled = this.loadProxyState();
      
      if (enabled) {
        // 异步启用代理，不阻塞初始化
        this.enableProxyAsync();
      }
      
      // 设置性能监控
      this.startPerformanceMonitoring();
      
      this.isInitialized = true;
      console.log('代理服务初始化完成', {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        cacheEnabled: true,
        queueEnabled: true
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
    }
  }

  /**
   * 智能URL转换（优化版）
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

      // 确定资源类型
      const resourceType = this.detectResourceType(url.pathname);
      
      // 构建完整路径
      let path = url.pathname || '/';
      if (url.search) {
        path += url.search;
      }
      if (url.hash) {
        path += url.hash;
      }

      // 确保路径以 / 开头
      if (!path.startsWith('/')) {
        path = '/' + path;
      }

      // 生成代理URL
      const proxyUrl = `${proxyConfig.proxyServer}/proxy/${hostname}${path}`;

      // 缓存URL映射
      this.cacheManager.set(`url-mapping:${originalUrl}`, proxyUrl, {
        resourceType: RESOURCE_TYPES.OTHER
      });

      console.debug('URL转换完成:', { 
        original: originalUrl, 
        proxy: proxyUrl,
        hostname,
        path,
        resourceType
      });
      
      return proxyUrl;
    } catch (error) {
      console.error('URL转换失败:', error, 'Original URL:', originalUrl);
      return originalUrl;
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
      'pdf': RESOURCE_TYPES.DOCUMENT,
      'doc': RESOURCE_TYPES.DOCUMENT,
      'docx': RESOURCE_TYPES.DOCUMENT
    };
    
    return typeMap[ext] || RESOURCE_TYPES.OTHER;
  }

  /**
   * 智能代理请求（优化版）
   */
  async makeProxyRequest(url, options = {}) {
    if (!this.isProxyEnabled()) {
      throw new Error('代理服务未启用');
    }

    // 检测资源类型
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
        
        // 缓存响应（对于可缓存的资源类型）
        if (this.isCacheable(resourceType, response)) {
          this.cacheManager.set(url, response.clone(), {
            resourceType
          });
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
    const config = createRequestConfig(options);
    
    // 根据资源类型优化请求
    if (resourceType === RESOURCE_TYPES.IMAGE || resourceType === RESOURCE_TYPES.MEDIA) {
      // 对图片和媒体资源使用较长的超时
      config.timeout = 30000;
      
      // 添加Accept头以获取最佳格式
      config.headers = config.headers || {};
      if (resourceType === RESOURCE_TYPES.IMAGE) {
        config.headers['Accept'] = 'image/webp,image/apng,image/*,*/*;q=0.8';
      }
    } else if (resourceType === RESOURCE_TYPES.API) {
      // API请求使用较短超时
      config.timeout = 10000;
      config.headers = config.headers || {};
      config.headers['Accept'] = 'application/json';
    }
    
    // 添加压缩支持
    if (!config.headers['Accept-Encoding']) {
      config.headers['Accept-Encoding'] = 'gzip, deflate, br';
    }
    
    return config;
  }

  /**
   * 获取请求优先级
   */
  getRequestPriority(resourceType) {
    const priorityMap = {
      [RESOURCE_TYPES.HTML]: 10,
      [RESOURCE_TYPES.CSS]: 9,
      [RESOURCE_TYPES.JS]: 8,
      [RESOURCE_TYPES.API]: 7,
      [RESOURCE_TYPES.FONT]: 6,
      [RESOURCE_TYPES.IMAGE]: 5,
      [RESOURCE_TYPES.MEDIA]: 4,
      [RESOURCE_TYPES.DOCUMENT]: 3,
      [RESOURCE_TYPES.OTHER]: 1
    };
    
    return priorityMap[resourceType] || 1;
  }

  /**
   * 判断资源是否可缓存
   */
  isCacheable(resourceType, response) {
    // 只缓存成功的GET请求
    if (response.status !== 200) {
      return false;
    }
    
    // 检查Cache-Control头
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      return false;
    }
    
    // 某些资源类型总是可缓存的
    const alwaysCacheable = [
      RESOURCE_TYPES.IMAGE,
      RESOURCE_TYPES.FONT,
      RESOURCE_TYPES.CSS,
      RESOURCE_TYPES.JS
    ];
    
    return alwaysCacheable.includes(resourceType);
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

  /**
   * 启用代理（优化版）
   */
  async enableProxy() {
    try {
      this.currentStatus = proxyConfig.status.CHECKING;
      this.retryCount = 0;
      
      // 并发测试多个端点以提高可靠性
      const connectivityTests = await Promise.allSettled([
        testProxyConnectivity(),
        this.testProxyEndpoint('/api/health'),
        this.testProxyEndpoint('/api/status')
      ]);
      
      // 只要有一个成功就认为代理可用
      const successfulTest = connectivityTests.find(result => 
        result.status === 'fulfilled' && result.value.success
      );
      
      if (!successfulTest) {
        // 重试逻辑
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
      
      // 触发状态变更事件
      this.dispatchStatusChange();
      
      console.log('代理已启用', { 
        responseTime: successfulTest.value.responseTime,
        endpoints: connectivityTests.map(r => r.status)
      });
      
      return { 
        success: true, 
        message: '代理已启用',
        responseTime: successfulTest.value.responseTime 
      };
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('启用代理失败:', error);
      errorLogger.log(error, { context: 'enableProxy', retryCount: this.retryCount });
      return { success: false, error: error.message };
    }
  }

  /**
   * 测试代理端点
   */
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
        return { success: true };
      }
      
      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

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
        cacheSize: cacheStats.size
      });
    }, 60000); // 每分钟记录一次
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(responseTime, success) {
    // 指数移动平均
    const alpha = 0.1;
    this.performanceMetrics.avgResponseTime = 
      (1 - alpha) * this.performanceMetrics.avgResponseTime + alpha * responseTime;
    
    // 成功率
    this.performanceMetrics.successRate = 
      (1 - alpha) * this.performanceMetrics.successRate + alpha * (success ? 1 : 0);
    
    this.performanceMetrics.lastMeasurement = Date.now();
  }

  /**
   * 健康检查（优化版）
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

      // 根据健康状态动态调整检查频率
      if (this.isHealthy) {
        this.adjustHealthCheckFrequency(5 * 60 * 1000); // 健康时5分钟
      } else {
        this.adjustHealthCheckFrequency(1 * 60 * 1000); // 不健康时1分钟
      }

      return { 
        success: true, 
        data: healthData,
        responseTime: Math.round(endTime - startTime)
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      
      // 错误时增加检查频率
      this.adjustHealthCheckFrequency(30 * 1000); // 30秒
      
      errorLogger.log(error, { context: 'healthCheck' });
      return { success: false, error: error.message };
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
        this.checkProxyHealth();
      }
    }, interval);
  }

  /**
   * 启动健康检查
   */
  startHealthCheck() {
    // 立即执行一次健康检查
    this.checkProxyHealth();
    
    // 设置定期检查
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
      version: '2.0.0',
      errorLogs: errorLogger.getLogs().slice(-5)
    };
  }

  /**
   * 运行诊断（增强版）
   */
  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      config: validateProxyConfig(),
      connectivity: null,
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

  /**
   * 清理资源
   */
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
    const proxyPrefix = `${server}/proxy/`;
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
    
    return originalUrl;
  } catch (error) {
    console.error('原始URL提取失败:', error, 'Proxy URL:', proxyUrl);
    return proxyUrl;
  }
}

export default proxyService;