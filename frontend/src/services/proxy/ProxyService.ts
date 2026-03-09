import {
  proxyConfig,
  createRequestConfig,
  getProxyHealthCheckUrl,
  getProxyStatusUrl,
  getCacheClearUrl,
  getDefaultConfig,
  testProxyConnectivity,
  errorLogger,
  type ProxyStatus,
  type ResourceType,
  type ProxyStats,
  type ErrorLog,
  RESOURCE_TYPES
} from './proxy-config';

interface CacheEntry {
  data: Response;
  timestamp: number;
  ttl: number;
  resourceType: ResourceType;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

interface QueueItem {
  fn: () => Promise<Response>;
  priority: number;
  resolve: (value: Response) => void;
  reject: (reason: Error) => void;
  startTime: number | null;
}

interface QueueStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageTime: number;
}

interface QueueStatus {
  queueLength: number;
  activeRequests: number;
  stats: QueueStats;
}

interface PerformanceMetrics {
  avgResponseTime: number;
  successRate: number;
  lastMeasurement: number;
}

interface BackendInfo {
  version: string | null;
  features: Record<string, unknown> | null;
  lastUpdated: number | null;
}

interface ProxyStatusInfo {
  enabled: boolean;
  status: ProxyStatus;
  server: string;
  supportedDomains: string;
  stats: ProxyStats;
  lastHealthCheck: number | null;
  isHealthy: boolean | null;
  retryCount: number;
  performance: {
    avgResponseTime: number;
    successRate: number;
    cacheStats: CacheStats;
    queueStatus: QueueStatus;
  };
  backend: BackendInfo;
  version: string;
  errorLogs: ErrorLog[];
}

interface HealthCheckResult {
  success: boolean;
  data?: {
    status?: string;
    version?: string;
    features?: Record<string, unknown>;
  };
  responseTime?: number;
  error?: string;
}

class CacheManager {
  private cache = new Map<string, CacheEntry>();
  private maxCacheSize: number;
  private cacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  constructor(maxSize = 100) {
    this.maxCacheSize = maxSize;
  }

  generateKey(url: string, options: { method?: string; headers?: Headers } = {}): string {
    const { method = 'GET' } = options;
    const headersStr = options.headers ? JSON.stringify(Object.fromEntries(options.headers)) : '';
    return `${method}:${url}:${headersStr}`;
  }

  get(url: string, options: { method?: string; headers?: Headers } = {}): Response | null {
    const key = this.generateKey(url, options);
    const cached = this.cache.get(key);

    if (cached && !this.isExpired(cached)) {
      this.cacheStats.hits++;
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached.data.clone();
    }

    this.cacheStats.misses++;
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  set(url: string, data: Response, options: { method?: string; headers?: Headers; resourceType?: ResourceType } = {}): void {
    const key = this.generateKey(url, options);
    const resourceType = options.resourceType || 'other';
    const ttl = this.getTTL(resourceType);

    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.cacheStats.evictions++;
      }
    }

    this.cache.set(key, {
      data: data.clone(),
      timestamp: Date.now(),
      ttl,
      resourceType
    });
  }

  isExpired(cached: CacheEntry): boolean {
    return Date.now() - cached.timestamp > cached.ttl;
  }

  getTTL(resourceType: ResourceType): number {
    return proxyConfig.cacheStrategy.ttl[resourceType] ||
      proxyConfig.cacheStrategy.ttl.default;
  }

  clear(pattern: string | null = null): void {
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

  getStats(): CacheStats {
    return {
      ...this.cacheStats,
      size: this.cache.size,
      hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
    };
  }
}

class RequestQueue {
  private queue: QueueItem[] = [];
  private active = 0;
  private maxConcurrent: number;
  private stats: QueueStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    averageTime: 0
  };

  constructor(maxConcurrent = 6) {
    this.maxConcurrent = maxConcurrent;
  }

  async add(requestFn: () => Promise<Response>, priority = 0): Promise<Response> {
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

  private async processNext(): Promise<void> {
    if (this.active >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

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
      item.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.active--;
      this.processNext();
    }
  }

  private updateAverageTime(responseTime: number): void {
    const weight = 0.9;
    this.stats.averageTime = this.stats.averageTime * weight + responseTime * (1 - weight);
  }

  getStatus(): QueueStatus {
    return {
      queueLength: this.queue.length,
      activeRequests: this.active,
      stats: { ...this.stats }
    };
  }
}

class ProxyService {
  private currentStatus: ProxyStatus = proxyConfig.status.DISABLED;
  private healthCheckTimer: number | null = null;
  private stats: ProxyStats;
  private lastHealthCheck: number | null = null;
  private isHealthy: boolean | null = null;
  private retryCount = 0;

  private cacheManager: CacheManager;
  private requestQueue: RequestQueue;

  private performanceMetrics: PerformanceMetrics = {
    avgResponseTime: 0,
    successRate: 1,
    lastMeasurement: Date.now()
  };

  private backendInfo: BackendInfo = {
    version: null,
    features: null,
    lastUpdated: null
  };

  private performanceMonitorTimer: number | null = null;

  constructor() {
    this.cacheManager = new CacheManager(proxyConfig.cacheStrategy.maxSize);
    this.requestQueue = new RequestQueue(proxyConfig.performance.maxConcurrent);
    this.stats = this.loadStats();

    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('代理配置验证失败:', validation.issues);
    }
  }

  async init(): Promise<{ success: boolean; error?: string }> {
    try {
      const enabled = this.loadProxyState();

      if (enabled) {
        this.enableProxyAsync();
      }

      this.startPerformanceMonitoring();

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
      errorLogger.log(error instanceof Error ? error : new Error(String(error)), { context: 'initialization' });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async enableProxyAsync(): Promise<void> {
    try {
      await this.enableProxy();
    } catch (error) {
      console.warn('异步启用代理失败:', error instanceof Error ? error.message : error);
      errorLogger.log(error instanceof Error ? error : new Error(String(error)), { context: 'enableProxyAsync' });
    }
  }

  isProxyEnabled(): boolean {
    return this.currentStatus === proxyConfig.status.ENABLED;
  }

  async toggleProxy(): Promise<{ success: boolean; error?: string }> {
    try {
      if (this.isProxyEnabled()) {
        return await this.disableProxy();
      } else {
        return await this.enableProxy();
      }
    } catch (error) {
      console.error('切换代理状态失败:', error);
      errorLogger.log(error instanceof Error ? error : new Error(String(error)), {
        context: 'toggle',
        currentStatus: this.currentStatus
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  convertToProxyUrl(originalUrl: string): string {
    if (!originalUrl || typeof originalUrl !== 'string') {
      return originalUrl;
    }

    try {
      const url = new URL(originalUrl);

      const cachedMapping = this.cacheManager.get(`url-mapping:${originalUrl}`, { method: 'GET' });
      if (cachedMapping) {
        return cachedMapping.url || originalUrl;
      }

      const proxyUrl = `${proxyConfig.proxyServer}/${originalUrl}`;

      console.debug('URL转换完成:', {
        original: originalUrl,
        proxy: proxyUrl,
        hostname: url.hostname
      });

      return proxyUrl;
    } catch (error) {
      console.error('URL转换失败:', error, 'Original URL:', originalUrl);
      return originalUrl;
    }
  }

  getOriginalUrl(proxyUrl: string): string {
    if (!proxyUrl || typeof proxyUrl !== 'string') {
      return proxyUrl;
    }

    try {
      const proxyPrefix = `${proxyConfig.proxyServer}/`;
      if (!proxyUrl.startsWith(proxyPrefix)) {
        return proxyUrl;
      }

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

  detectResourceType(pathname: string): ResourceType {
    const ext = pathname.split('.').pop()?.toLowerCase() || '';

    const typeMap: Record<string, ResourceType> = {
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

  async makeProxyRequest(url: string, options: RequestInit & { resourceType?: ResourceType } = {}): Promise<Response> {
    if (!this.isProxyEnabled()) {
      throw new Error('代理服务未启用');
    }

    const resourceType = options.resourceType || this.detectResourceType(new URL(url).pathname);

    const cached = this.cacheManager.get(url, { method: options.method, headers: options.headers as Headers });
    if (cached) {
      console.debug('使用缓存响应:', url);
      this.updateStats('cacheHit', url);
      return cached;
    }

    const proxyUrl = this.convertToProxyUrl(url);
    if (proxyUrl === url) {
      throw new Error('URL转换为代理URL失败');
    }

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

        if (this.isCacheable(resourceType, response)) {
          this.cacheManager.set(url, response, { method: options.method, resourceType });
        }

        this.updateStats('requestSuccess', url);
        return response;
      } catch (error) {
        const responseTime = performance.now() - startTime;
        this.updatePerformanceMetrics(responseTime, false);

        this.updateStats('requestError', url);
        errorLogger.log(error instanceof Error ? error : new Error(String(error)), {
          context: 'proxyRequest',
          url,
          proxyUrl
        });

        if (proxyConfig.errorHandling.fallbackToOriginal) {
          return this.handleFallback(url, options, error instanceof Error ? error : new Error(String(error)));
        }

        throw error;
      }
    }, priority);
  }

  private optimizeRequestConfig(options: RequestInit & { resourceType?: ResourceType }, resourceType: ResourceType): RequestInit {
    const headers: Record<string, string> = {};
    if (options.headers) {
      const headersObj = new Headers(options.headers);
      headersObj.forEach((value, key) => {
        headers[key] = value;
      });
    }
    const config = createRequestConfig({ ...options, headers, resourceType });

    if (resourceType === RESOURCE_TYPES.IMAGE || resourceType === RESOURCE_TYPES.MEDIA) {
      (config as RequestInit & { timeout: number }).timeout = proxyConfig.requestConfig.timeouts.media;
    } else if (resourceType === RESOURCE_TYPES.API) {
      (config as RequestInit & { timeout: number }).timeout = proxyConfig.requestConfig.timeouts.api;
    }

    return config;
  }

  private getRequestPriority(resourceType: ResourceType): number {
    return proxyConfig.performance.priority[resourceType] || 1;
  }

  private isCacheable(resourceType: ResourceType, response: Response): boolean {
    if (response.status !== 200) return false;

    const cacheControl = response.headers.get('cache-control');
    if (cacheControl && (cacheControl.includes('no-cache') || cacheControl.includes('no-store'))) {
      return false;
    }

    return proxyConfig.cacheStrategy.rules.alwaysCache.includes(resourceType);
  }

  private async handleFallback(url: string, options: RequestInit, originalError: Error): Promise<Response> {
    console.warn('代理请求失败，尝试直接请求:', originalError.message);

    try {
      const headers: Record<string, string> = {};
      if (options.headers) {
        const headersObj = new Headers(options.headers);
        headersObj.forEach((value, key) => {
          headers[key] = value;
        });
      }
      const fallbackResponse = await fetch(url, createRequestConfig({ ...options, headers }));
      this.updateStats('fallbackSuccess', url);
      return fallbackResponse;
    } catch (fallbackError) {
      this.updateStats('fallbackError', url);
      throw new Error(`代理和直接请求均失败: ${originalError.message}, ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`);
    }
  }

  async enableProxy(): Promise<{ success: boolean; message?: string; responseTime?: number; backendInfo?: BackendInfo; error?: string }> {
    try {
      this.currentStatus = proxyConfig.status.CHECKING;
      this.retryCount = 0;

      const connectivityTests = await Promise.allSettled([
        testProxyConnectivity(),
        this.testBackendStatus(),
        this.fetchBackendInfo()
      ]);

      const proxyTestResult = connectivityTests[0];
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

      const testResult = proxyTestResult.status === 'fulfilled' ? proxyTestResult.value : null;

      console.log('代理已启用', {
        responseTime: testResult?.responseTime,
        backendVersion: this.backendInfo.version
      });

      return {
        success: true,
        message: '代理已启用',
        responseTime: testResult?.responseTime,
        backendInfo: this.backendInfo
      };
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('启用代理失败:', error);
      errorLogger.log(error instanceof Error ? error : new Error(String(error)), { context: 'enableProxy', retryCount: this.retryCount });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async disableProxy(): Promise<{ success: boolean; message?: string; error?: string }> {
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
      errorLogger.log(error instanceof Error ? error : new Error(String(error)), { context: 'disableProxy' });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async testBackendStatus(): Promise<{ success: boolean; data?: unknown; error?: string }> {
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
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async fetchBackendInfo(): Promise<{ success: boolean; data?: unknown; error?: string }> {
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
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getProxyStatus(): ProxyStatusInfo {
    return {
      enabled: this.isProxyEnabled(),
      status: this.currentStatus,
      server: proxyConfig.proxyServer,
      supportedDomains: 'ALL',
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

  async checkProxyHealth(): Promise<HealthCheckResult> {
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

      if (healthData.version) {
        this.backendInfo.version = healthData.version;
        this.backendInfo.features = healthData.features;
        this.backendInfo.lastUpdated = Date.now();
      }

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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '健康检查超时';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }

      errorLogger.log(error instanceof Error ? error : new Error(errorMessage), { context: 'healthCheck' });
      return { success: false, error: errorMessage };
    }
  }

  private adjustHealthCheckFrequency(interval: number): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = window.setInterval(() => {
      if (this.isProxyEnabled()) {
        this.checkProxyHealth().then(result => {
          if (!result.success) {
            console.warn('代理健康检查失败:', result.error);
            this.dispatchHealthCheckFailed(result.error || 'Unknown error');
          } else {
            this.retryCount = 0;
          }
        });
      }
    }, interval);
  }

  private startHealthCheck(): void {
    this.checkProxyHealth();
    this.adjustHealthCheckFrequency(5 * 60 * 1000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async clearProxyCache(pattern: string | null = null): Promise<{
    frontend: boolean;
    backend: boolean;
    errors: string[];
  }> {
    const results = {
      frontend: false,
      backend: false,
      errors: [] as string[]
    };

    try {
      this.cacheManager.clear(pattern);
      results.frontend = true;
    } catch (error) {
      results.errors.push(`前端缓存清理失败: ${error instanceof Error ? error.message : error}`);
    }

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
      results.errors.push(`后端缓存清理失败: ${error instanceof Error ? error.message : error}`);
    }

    console.log('缓存清理结果:', results);
    return results;
  }

  private startPerformanceMonitoring(): void {
    this.performanceMonitorTimer = window.setInterval(() => {
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

  private updatePerformanceMetrics(responseTime: number, success: boolean): void {
    const alpha = 0.1;
    this.performanceMetrics.avgResponseTime =
      (1 - alpha) * this.performanceMetrics.avgResponseTime + alpha * responseTime;

    this.performanceMetrics.successRate =
      (1 - alpha) * this.performanceMetrics.successRate + alpha * (success ? 1 : 0);

    this.performanceMetrics.lastMeasurement = Date.now();
  }

  private saveProxyState(enabled: boolean): void {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyEnabled, enabled.toString());
    } catch {
      console.warn('保存代理状态失败');
    }
  }

  private loadProxyState(): boolean {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyEnabled);
      return stored === 'true';
    } catch {
      console.warn('加载代理状态失败');
      return proxyConfig.defaultEnabled;
    }
  }

  private saveStats(): void {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyStats, JSON.stringify(this.stats));
    } catch {
      console.warn('保存代理统计失败');
    }
  }

  private loadStats(): ProxyStats {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyStats);
      return stored ? JSON.parse(stored) : getDefaultConfig().stats;
    } catch {
      console.warn('加载代理统计失败');
      return getDefaultConfig().stats;
    }
  }

  private updateStats(action: string, _url?: string): void {
    try {
      switch (action) {
        case 'urlConverted':
          this.stats.totalRequests++;
          this.stats.successfulRequests++;
          this.stats.lastUsed = new Date().toISOString();
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
    } catch {
      console.warn('更新统计数据失败');
    }
  }

  private dispatchStatusChange(): void {
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

  private dispatchHealthCheckFailed(error: string): void {
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

  async runDiagnostics(): Promise<{
    timestamp: string;
    config: ReturnType<typeof validateProxyConfig>;
    connectivity: { success: boolean; data?: unknown; error?: string } | null;
    backend: { success: boolean; data?: unknown; error?: string } | null;
    performance: {
      metrics: PerformanceMetrics;
      cache: CacheStats;
      queue: QueueStatus;
    };
    status: ProxyStatusInfo;
    errors: ErrorLog[];
    recommendations: string[];
  }> {
    const results = {
      timestamp: new Date().toISOString(),
      config: validateProxyConfig(),
      connectivity: null as { success: boolean; data?: unknown; error?: string } | null,
      backend: null as { success: boolean; data?: unknown; error?: string } | null,
      performance: {
        metrics: this.performanceMetrics,
        cache: this.cacheManager.getStats(),
        queue: this.requestQueue.getStatus()
      },
      status: this.getProxyStatus(),
      errors: errorLogger.getLogs().slice(-10),
      recommendations: [] as string[]
    };

    try {
      results.connectivity = await testProxyConnectivity();
      results.backend = await this.fetchBackendInfo();
    } catch (error) {
      results.connectivity = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }

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

  async resetProxy(): Promise<{ success: boolean; message?: string; error?: string }> {
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
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  shouldProxy(url: string): boolean {
    if (!url) return false;

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  cleanup(): void {
    this.stopHealthCheck();
    if (this.performanceMonitorTimer) {
      clearInterval(this.performanceMonitorTimer);
      this.performanceMonitorTimer = null;
    }
    this.saveStats();
    this.cacheManager.clear();
    console.log('代理服务资源已清理');
  }
}

function validateProxyConfig(): {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (!proxyConfig.proxyServer) {
    issues.push('代理服务器地址未配置');
  } else {
    try {
      const url = new URL(proxyConfig.proxyServer);
      if (url.protocol !== 'https:') {
        warnings.push('建议使用HTTPS协议的代理服务器');
      }
    } catch {
      issues.push('代理服务器地址格式不正确');
    }
  }

  const requiredEndpoints = ['health', 'status', 'cacheClear'] as const;
  requiredEndpoints.forEach(endpoint => {
    if (!proxyConfig.api[endpoint]) {
      issues.push(`缺少必要的API端点配置: ${endpoint}`);
    }
  });

  if (proxyConfig.performance.maxConcurrent > 10) {
    warnings.push('并发请求数过高可能影响性能');
  }

  if (!proxyConfig.cacheStrategy.enabled) {
    recommendations.push('建议启用缓存以提升性能');
  }

  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    recommendations
  };
}

export const proxyService = new ProxyService();

export function convertToProxyUrl(originalUrl: string, proxyServer?: string): string {
  const server = proxyServer || proxyConfig.proxyServer;
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  try {
    new URL(originalUrl);
    return `${server}/${originalUrl}`;
  } catch {
    return originalUrl;
  }
}

export function getOriginalUrl(proxyUrl: string, proxyServer?: string): string {
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
  } catch {
    console.error('原始URL提取失败:', proxyUrl);
    return proxyUrl;
  }
}

export type {
  ProxyStatus,
  ResourceType,
  ProxyStats,
  CacheStats,
  QueueStatus,
  PerformanceMetrics,
  BackendInfo,
  ProxyStatusInfo
};

export default proxyService;
