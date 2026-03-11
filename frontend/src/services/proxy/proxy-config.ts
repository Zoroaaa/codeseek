import {
  PROXY_CONFIG,
  PROXY_TIMEOUTS,
  PROXY_CACHE_CONFIG,
  PROXY_PERFORMANCE_CONFIG,
  PROXY_ERROR_HANDLING,
} from '@/constants';

export type ProxyStatus = 'disabled' | 'enabled' | 'error' | 'checking' | 'degraded' | 'smart';

export type ResourceType = 'html' | 'css' | 'javascript' | 'image' | 'font' | 'media' | 'api' | 'document' | 'other';

export interface ProxyConfig {
  proxyServer: string;
  backupServers: string[];
  defaultEnabled: boolean;
  proxyUrlFormat: string;
  supportedDomains: string[];
  version: string;
  backendVersion: string;
}

export interface SmartModeConfig {
  enabled: boolean;
  autoDetect: boolean;
  testTimeout: number;
  cache: Map<string, unknown>;
}

export interface ApiEndpoints {
  health: string;
  status: string;
  cacheClear: string;
}

export interface RequestConfig {
  headers: Record<string, string>;
  options: RequestInit;
  timeouts: {
    default: number;
    api: number;
    html: number;
    resource: number;
    media: number;
    healthCheck: number;
  };
  retry: {
    maxAttempts: number;
    delays: number[];
    retryOn: number[];
  };
}

export interface CacheStrategy {
  enabled: boolean;
  maxSize: number;
  maxEntries: number;
  ttl: Record<ResourceType | 'default', number>;
  rules: {
    alwaysCache: ResourceType[];
    neverCache: string[];
    conditionalCache: Record<string, (response: Response) => boolean>;
  };
}

export interface PerformanceConfig {
  maxConcurrent: number;
  priority: Record<ResourceType | 'other', number>;
  preload: {
    enabled: boolean;
    resources: ResourceType[];
    maxPreloads: number;
  };
  lazyLoad: {
    enabled: boolean;
    resources: ResourceType[];
    threshold: number;
  };
}

export interface StorageKeys {
  proxyEnabled: string;
  proxyPreferences: string;
  proxyStats: string;
  proxyErrors: string;
  proxyCache: string;
  smartModeCache: string;
}

export interface ErrorHandlingConfig {
  maxRetries: number;
  retryDelays: number[];
  fallbackToOriginal: boolean;
  logErrors: boolean;
  strategies: {
    network: { retry: boolean; fallback: boolean; notify: boolean };
    timeout: { retry: boolean; fallback: boolean; notify: boolean };
    server: { retry: boolean; fallback: boolean; notify: boolean };
    client: { retry: boolean; fallback: boolean; notify: boolean };
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics: string[];
  reportInterval: number;
  thresholds: {
    responseTime: number;
    successRate: number;
    errorRate: number;
  };
}

export interface ProxyStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  lastUsed: string | null;
  averageResponseTime: number;
  fallbackSuccesses: number;
  fallbackErrors: number;
  healthCheckFailures: number;
}

export interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  type: string;
  userAgent: string;
  url: string;
  backendVersion: string;
  frontendVersion: string;
  performance: {
    memory: {
      used: number;
      total: number;
    } | null;
  };
}

export const RESOURCE_TYPES: Record<string, ResourceType> = {
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

export const proxyConfig = {
  proxyServer: PROXY_CONFIG.PROXY_SERVER,
  backupServers: [] as string[],
  defaultEnabled: PROXY_CONFIG.DEFAULT_ENABLED,
  proxyUrlFormat: '{proxy}/{target_url}',
  supportedDomains: ['ALL'],

  smartMode: {
    enabled: false,
    autoDetect: true,
    testTimeout: 5000,
    cache: new Map<string, unknown>()
  } as SmartModeConfig,

  api: {
    health: '/api/health',
    status: '/api/status',
    cacheClear: '/api/cache/clear'
  } as ApiEndpoints,

  requestConfig: {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    options: {
      credentials: 'omit',
      mode: 'cors',
      cache: 'default',
      redirect: 'follow'
    } as RequestInit,
    timeouts: {
      default: PROXY_TIMEOUTS.HTML,
      api: PROXY_TIMEOUTS.API,
      html: PROXY_TIMEOUTS.HTML,
      resource: PROXY_TIMEOUTS.STATIC,
      media: PROXY_TIMEOUTS.MEDIA,
      healthCheck: PROXY_TIMEOUTS.HEALTH_CHECK
    },
    retry: {
      maxAttempts: PROXY_ERROR_HANDLING.MAX_RETRIES,
      delays: [...PROXY_ERROR_HANDLING.RETRY_DELAYS],
      retryOn: [408, 429, 500, 502, 503, 504]
    }
  } as RequestConfig,

  cacheStrategy: {
    enabled: PROXY_CACHE_CONFIG.ENABLED,
    maxSize: PROXY_CACHE_CONFIG.MAX_SIZE,
    maxEntries: PROXY_CACHE_CONFIG.MAX_ENTRIES,
    ttl: {
      html: PROXY_CACHE_CONFIG.TTL.HTML,
      css: PROXY_CACHE_CONFIG.TTL.CSS,
      javascript: PROXY_CACHE_CONFIG.TTL.JAVASCRIPT,
      image: PROXY_CACHE_CONFIG.TTL.IMAGE,
      font: PROXY_CACHE_CONFIG.TTL.FONT,
      api: PROXY_CACHE_CONFIG.TTL.API,
      media: PROXY_CACHE_CONFIG.TTL.MEDIA,
      document: PROXY_CACHE_CONFIG.TTL.DEFAULT,
      other: PROXY_CACHE_CONFIG.TTL.DEFAULT,
      default: PROXY_CACHE_CONFIG.TTL.DEFAULT
    },
    rules: {
      alwaysCache: ['image', 'font', 'css', 'javascript'] as ResourceType[],
      neverCache: ['api/auth', 'api/user'],
      conditionalCache: {
        'api': (response: Response) => response.status === 200,
        'html': (response: Response) => !response.headers.get('cache-control')?.includes('no-cache')
      }
    }
  } as CacheStrategy,

  performance: {
    maxConcurrent: PROXY_PERFORMANCE_CONFIG.MAX_CONCURRENT,
    priority: {
      html: 10,
      css: 9,
      javascript: 8,
      api: 7,
      font: 6,
      image: 5,
      media: 4,
      document: 3,
      other: 1
    },
    preload: {
      enabled: PROXY_PERFORMANCE_CONFIG.PRELOAD.ENABLED,
      resources: ['css', 'javascript', 'font'] as ResourceType[],
      maxPreloads: PROXY_PERFORMANCE_CONFIG.PRELOAD.MAX_PRELOADS
    },
    lazyLoad: {
      enabled: PROXY_PERFORMANCE_CONFIG.LAZY_LOAD.ENABLED,
      resources: ['image', 'media'] as ResourceType[],
      threshold: PROXY_PERFORMANCE_CONFIG.LAZY_LOAD.THRESHOLD
    }
  } as PerformanceConfig,

  storageKeys: {
    proxyEnabled: 'codeseek_proxy_enabled',
    proxyPreferences: 'codeseek_proxy_preferences',
    proxyStats: 'codeseek_proxy_stats',
    proxyErrors: 'codeseek_proxy_errors',
    proxyCache: 'codeseek_proxy_cache',
    smartModeCache: 'codeseek_smart_mode_cache'
  } as StorageKeys,

  status: {
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    ERROR: 'error',
    CHECKING: 'checking',
    DEGRADED: 'degraded',
    SMART: 'smart'
  } as Record<string, ProxyStatus>,

  timeouts: {
    healthCheck: PROXY_TIMEOUTS.HEALTH_CHECK,
    request: PROXY_TIMEOUTS.REQUEST,
    retry: PROXY_TIMEOUTS.RETRY,
    retryDelay: PROXY_TIMEOUTS.RETRY_DELAY,
    resourceTimeout: {
      html: PROXY_TIMEOUTS.HTML,
      api: PROXY_TIMEOUTS.API,
      static: PROXY_TIMEOUTS.STATIC,
      media: PROXY_TIMEOUTS.MEDIA
    }
  },

  errorHandling: {
    maxRetries: PROXY_ERROR_HANDLING.MAX_RETRIES,
    retryDelays: [...PROXY_ERROR_HANDLING.RETRY_DELAYS],
    fallbackToOriginal: PROXY_ERROR_HANDLING.FALLBACK_TO_ORIGINAL,
    logErrors: PROXY_ERROR_HANDLING.LOG_ERRORS,
    strategies: {
      network: { retry: true, fallback: true, notify: false },
      timeout: { retry: true, fallback: true, notify: true },
      server: { retry: false, fallback: true, notify: true },
      client: { retry: false, fallback: false, notify: false }
    }
  } as ErrorHandlingConfig,

  monitoring: {
    enabled: true,
    metrics: ['responseTime', 'successRate', 'cacheHitRate', 'errorRate', 'throughput'],
    reportInterval: 60000,
    thresholds: {
      responseTime: 2000,
      successRate: 0.8,
      errorRate: 0.2
    }
  } as MonitoringConfig,

  version: PROXY_CONFIG.VERSION,
  backendVersion: PROXY_CONFIG.BACKEND_VERSION
};

export function validateProxyConfig(): {
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

export function getApiUrl(endpoint: keyof ApiEndpoints): string {
  const endpointPath = proxyConfig.api[endpoint];
  if (!endpointPath) {
    throw new Error(`未知的API端点: ${endpoint}`);
  }
  return `${proxyConfig.proxyServer}${endpointPath}`;
}

export function getProxyHealthCheckUrl(): string {
  return getApiUrl('health');
}

export function getProxyStatusUrl(): string {
  return getApiUrl('status');
}

export function getCacheClearUrl(): string {
  return getApiUrl('cacheClear');
}

export function isDomainSupported(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  try {
    return hostname.includes('.') || hostname === 'localhost';
  } catch {
    return false;
  }
}

export function getDomainCategory(): string {
  return 'all';
}

export function getDefaultConfig(): {
  enabled: boolean;
  preferences: {
    autoEnable: boolean;
    smartMode: boolean;
    cacheEnabled: boolean;
    performanceMode: string;
    showStatusInResults: boolean;
    preferOriginalOnError: boolean;
    logErrors: boolean;
  };
  stats: ProxyStats;
} {
  return {
    enabled: proxyConfig.defaultEnabled,
    preferences: {
      autoEnable: false,
      smartMode: false,
      cacheEnabled: true,
      performanceMode: 'balanced',
      showStatusInResults: true,
      preferOriginalOnError: true,
      logErrors: true
    },
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastUsed: null,
      averageResponseTime: 0,
      fallbackSuccesses: 0,
      fallbackErrors: 0,
      healthCheckFailures: 0
    }
  };
}

export function createRequestConfig(options: {
  resourceType?: ResourceType;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
} = {}): RequestInit & { timeout: number } {
  const resourceType = options.resourceType || 'other';
  const timeoutMap: Record<ResourceType, number> = {
    html: proxyConfig.requestConfig.timeouts.html,
    css: proxyConfig.requestConfig.timeouts.resource,
    javascript: proxyConfig.requestConfig.timeouts.resource,
    image: proxyConfig.requestConfig.timeouts.resource,
    font: proxyConfig.requestConfig.timeouts.resource,
    media: proxyConfig.requestConfig.timeouts.media,
    api: proxyConfig.requestConfig.timeouts.api,
    document: proxyConfig.requestConfig.timeouts.resource,
    other: proxyConfig.requestConfig.timeouts.default,
  };
  const timeout = timeoutMap[resourceType];

  const config: RequestInit & { timeout: number } = {
    method: options.method || 'GET',
    ...proxyConfig.requestConfig.options,
    timeout
  };

  const headers = new Headers();

  Object.entries(proxyConfig.requestConfig.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (options.body && ['POST', 'PUT', 'PATCH'].includes(config.method as string)) {
    headers.set('Content-Type', 'application/json');
  }

  const acceptHeaders: Record<ResourceType, string> = {
    html: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    css: 'text/css,*/*;q=0.1',
    javascript: 'application/javascript,text/javascript,*/*;q=0.1',
    image: 'image/webp,image/apng,image/*,*/*;q=0.8',
    api: 'application/json,text/plain,*/*',
    media: 'video/*,audio/*,*/*;q=0.5',
    font: 'font/*,*/*;q=0.1',
    document: 'application/pdf,*/*;q=0.5',
    other: '*/*'
  };

  if (acceptHeaders[resourceType]) {
    headers.set('Accept', acceptHeaders[resourceType]);
  }

  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  config.headers = headers;
  return config;
}

export async function testProxyConnectivity(): Promise<{
  success: boolean;
  endpoint?: string;
  data?: unknown;
  responseTime?: number;
  error?: string;
}> {
  const endpoints = [
    proxyConfig.api.health,
    proxyConfig.api.status,
    '/_health'
  ];

  const tests = endpoints.map(async (endpoint) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(),
        proxyConfig.timeouts.healthCheck);

      const startTime = performance.now();

      const response = await fetch(`${proxyConfig.proxyServer}${endpoint}`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          endpoint,
          data,
          responseTime: Math.round(endTime - startTime)
        };
      }

      return {
        success: false,
        endpoint,
        error: `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        endpoint,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  const results = await Promise.allSettled(tests);

  const successfulTest = results.find(
    r => r.status === 'fulfilled' && r.value.success
  );

  if (successfulTest && successfulTest.status === 'fulfilled') {
    return successfulTest.value;
  }

  const failedTest = results.find(r => r.status === 'fulfilled');
  return failedTest && failedTest.status === 'fulfilled'
    ? failedTest.value
    : { success: false, error: 'All connectivity tests failed' };
}

class ErrorLogger {
  maxLogs = PROXY_ERROR_HANDLING.MAX_ERROR_LOGS;

  log(error: Error, context: Record<string, unknown> = {}): void {
    if (!proxyConfig.errorHandling.logErrors) return;

    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      message: error.message || error.toString(),
      stack: error.stack,
      context,
      type: this.classifyError(error),
      userAgent: navigator.userAgent,
      url: window.location.href,
      backendVersion: proxyConfig.backendVersion,
      frontendVersion: proxyConfig.version,
      performance: {
        memory: (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory ? {
          used: Math.round((performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1048576),
          total: Math.round((performance as unknown as { memory: { totalJSHeapSize: number } }).memory.totalJSHeapSize / 1048576)
        } : null
      }
    };

    try {
      const existingLogs = this.getLogs();
      existingLogs.push(errorLog);

      if (existingLogs.length > this.maxLogs) {
        existingLogs.splice(0, existingLogs.length - this.maxLogs);
      }

      localStorage.setItem(proxyConfig.storageKeys.proxyErrors,
        JSON.stringify(existingLogs));

      if (proxyConfig.monitoring.enabled) {
        this.sendToMonitoring(errorLog);
      }

      console.error('代理错误记录:', errorLog);
    } catch (storageError) {
      console.error('无法保存错误日志:', storageError);
    }
  }

  classifyError(error: Error): string {
    const message = error.message || '';

    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('timeout') || message.includes('超时')) return 'timeout';
    if (message.includes('CORS')) return 'cors';
    if (message.includes('404') || message.includes('not found')) return 'not_found';
    if (message.includes('500') || message.includes('server')) return 'server';
    if (message.includes('403') || message.includes('forbidden')) return 'forbidden';

    return 'unknown';
  }

  async sendToMonitoring(_errorLog: ErrorLog): Promise<void> {
    // 预留监控接口
  }

  getLogs(): ErrorLog[] {
    try {
      const logs = localStorage.getItem(proxyConfig.storageKeys.proxyErrors);
      return logs ? JSON.parse(logs) : [];
    } catch {
      console.warn('无法读取错误日志');
      return [];
    }
  }

  clearLogs(): boolean {
    try {
      localStorage.removeItem(proxyConfig.storageKeys.proxyErrors);
      console.log('错误日志已清除');
      return true;
    } catch {
      console.warn('无法清除错误日志');
      return false;
    }
  }

  getErrorStats(): {
    total: number;
    last24Hours: number;
    lastHour: number;
    errorsByType: Record<string, number>;
    trend: string;
    mostCommonError: string | null;
  } {
    const logs = this.getLogs();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentErrors = logs.filter(log =>
      new Date(log.timestamp).getTime() > oneDayAgo
    );

    const hourlyErrors = recentErrors.filter(log =>
      new Date(log.timestamp).getTime() > oneHourAgo
    );

    const errorsByType: Record<string, number> = {};
    recentErrors.forEach(log => {
      errorsByType[log.type] = (errorsByType[log.type] || 0) + 1;
    });

    const trend = this.calculateErrorTrend(logs);

    return {
      total: logs.length,
      last24Hours: recentErrors.length,
      lastHour: hourlyErrors.length,
      errorsByType,
      trend,
      mostCommonError: Object.entries(errorsByType)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
    };
  }

  calculateErrorTrend(logs: ErrorLog[]): string {
    if (logs.length < 2) return 'stable';

    const now = Date.now();
    const recentCount = logs.filter(log =>
      now - new Date(log.timestamp).getTime() < 60 * 60 * 1000
    ).length;

    const previousCount = logs.filter(log => {
      const time = new Date(log.timestamp).getTime();
      return time < now - 60 * 60 * 1000 &&
        time > now - 2 * 60 * 60 * 1000;
    }).length;

    if (recentCount > previousCount * 1.5) return 'increasing';
    if (recentCount < previousCount * 0.5) return 'decreasing';
    return 'stable';
  }
}

export const errorLogger = new ErrorLogger();
