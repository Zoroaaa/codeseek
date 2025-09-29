// frontend/src/core/proxy-config.js - 移除域名限制版
// 版本: v2.2.0 - 支持所有域名代理

/**
 * 代理配置管理中心 - 移除域名限制
 */
export const proxyConfig = {
  // 代理服务器地址
  proxyServer: 'https://omnibox.pp.ua',
  
  // 备用代理服务器
  backupServers: [],
  
  // 默认开启状态
  defaultEnabled: true,
  
  // 智能模式配置
  smartMode: {
    enabled: false,
    autoDetect: true,
    testTimeout: 5000,
    cache: new Map()
  },
  
  // 代理URL格式（适配后端格式：{proxy}/{target_url}）
  proxyUrlFormat: '{proxy}/{target_url}',
  
  // 🔴 关键修改：移除域名白名单，支持所有域名
  // 保留此字段用于统计和显示，但不再用于过滤
  supportedDomains: ['ALL'],
  
  // 域名分类（仅用于UI显示）
  domainCategories: {
    all: ['*'] // 通配符表示支持所有域名
  },
  
  // 后端API端点配置
  api: {
    health: '/api/health',
    status: '/api/status',
    cacheClear: '/api/cache/clear'
  },
  
  // 请求配置
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
    },
    
    timeouts: {
      default: 15000,
      api: 10000,
      html: 15000,
      resource: 30000,
      media: 60000,
      healthCheck: 10000
    },
    
    retry: {
      maxAttempts: 3,
      delays: [1000, 2000, 5000],
      retryOn: [408, 429, 500, 502, 503, 504]
    }
  },
  
  // 缓存策略
  cacheStrategy: {
    enabled: true,
    maxSize: 100,
    maxEntries: 500,
    
    ttl: {
      html: 3600 * 1000,
      css: 86400 * 1000,
      js: 86400 * 1000,
      image: 2592000 * 1000,
      font: 2592000 * 1000,
      api: 1800 * 1000,
      media: 3600 * 1000,
      default: 3600 * 1000
    },
    
    rules: {
      alwaysCache: ['image', 'font', 'css', 'js'],
      neverCache: ['api/auth', 'api/user'],
      conditionalCache: {
        'api': (response) => response.status === 200,
        'html': (response) => !response.headers.get('cache-control')?.includes('no-cache')
      }
    }
  },
  
  // 性能优化配置
  performance: {
    maxConcurrent: 6,
    
    priority: {
      html: 10,
      css: 9,
      js: 8,
      api: 7,
      font: 6,
      image: 5,
      media: 4,
      other: 1
    },
    
    preload: {
      enabled: true,
      resources: ['css', 'js', 'font'],
      maxPreloads: 10
    },
    
    lazyLoad: {
      enabled: true,
      resources: ['image', 'media'],
      threshold: 100
    }
  },
  
  // 本地存储键名
  storageKeys: {
    proxyEnabled: 'codeseek_proxy_enabled',
    proxyPreferences: 'codeseek_proxy_preferences',
    proxyStats: 'codeseek_proxy_stats',
    proxyErrors: 'codeseek_proxy_errors',
    proxyCache: 'codeseek_proxy_cache',
    smartModeCache: 'codeseek_smart_mode_cache'
  },
  
  // 代理状态枚举
  status: {
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    ERROR: 'error',
    CHECKING: 'checking',
    DEGRADED: 'degraded',
    SMART: 'smart'
  },
  
  // 超时设置
  timeouts: {
    healthCheck: 10000,
    request: 30000,
    retry: 3,
    retryDelay: 1000,
    resourceTimeout: {
      html: 15000,
      api: 10000,
      static: 30000,
      media: 60000
    }
  },
  
  // 错误处理配置
  errorHandling: {
    maxRetries: 3,
    retryDelays: [1000, 2000, 5000],
    fallbackToOriginal: true,
    logErrors: true,
    
    strategies: {
      network: { retry: true, fallback: true, notify: false },
      timeout: { retry: true, fallback: true, notify: true },
      server: { retry: false, fallback: true, notify: true },
      client: { retry: false, fallback: false, notify: false }
    }
  },
  
  // UI配置
  ui: {
    statusIndicator: {
      showInResults: true,
      showInToolbar: true,
      animateTransitions: true,
      showPerformanceMetrics: true
    },
    
    buttons: {
      toggleText: {
        enabled: '🔒 代理已启用 (支持所有网站)',
        disabled: '🔓 启用代理模式',
        error: '⚠️ 代理服务异常',
        checking: '🔄 检查中...',
        degraded: '⚡ 降级模式',
        smart: '🧠 智能模式'
      },
      tooltips: {
        enabled: '点击关闭代理模式\n当前支持: 所有网站\n成功率: {successRate}%\n响应时间: {avgTime}ms',
        disabled: '点击启用代理模式，通过代理服务器访问所有网站',
        unavailable: '代理服务不可用',
        degraded: '代理服务部分可用，已启用降级模式',
        smart: '智能模式：自动检测并使用代理'
      }
    },
    
    notifications: {
      enabled: true,
      position: 'top-right',
      duration: 3000,
      types: {
        success: { icon: '✅', color: '#4CAF50' },
        error: { icon: '❌', color: '#F44336' },
        warning: { icon: '⚠️', color: '#FF9800' },
        info: { icon: 'ℹ️', color: '#2196F3' }
      }
    },
    
    cssClasses: {
      proxyEnabled: 'proxy-enabled',
      proxyDisabled: 'proxy-disabled',
      proxyError: 'proxy-error',
      proxyDegraded: 'proxy-degraded',
      proxySmart: 'proxy-smart',
      proxyButton: 'proxy-toggle-btn',
      proxyIndicator: 'proxy-status-indicator',
      proxyMetrics: 'proxy-metrics-panel'
    }
  },
  
  // 监控和分析配置
  monitoring: {
    enabled: true,
    metrics: ['responseTime', 'successRate', 'cacheHitRate', 'errorRate', 'throughput'],
    reportInterval: 60000,
    thresholds: {
      responseTime: 2000,
      successRate: 0.8,
      errorRate: 0.2
    }
  },
  
  // 安全配置
  security: {
    csp: { enabled: false },
    signing: { enabled: false },
    domainValidation: { enabled: false, strict: false } // 🔴 关闭域名验证
  },
  
  // 版本信息
  version: '2.2.0',
  backendVersion: '2.0.0'
};

/**
 * 验证代理配置
 */
export function validateProxyConfig() {
  const issues = [];
  const warnings = [];
  const recommendations = [];
  
  if (!proxyConfig.proxyServer) {
    issues.push('代理服务器地址未配置');
  } else {
    try {
      const url = new URL(proxyConfig.proxyServer);
      if (url.protocol !== 'https:') {
        warnings.push('建议使用HTTPS协议的代理服务器');
      }
    } catch (e) {
      issues.push('代理服务器地址格式不正确');
    }
  }
  
  const requiredEndpoints = ['health', 'status', 'cacheClear'];
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

/**
 * 获取后端API完整URL
 */
export function getApiUrl(endpoint) {
  const endpointPath = proxyConfig.api[endpoint];
  if (!endpointPath) {
    throw new Error(`未知的API端点: ${endpoint}`);
  }
  return `${proxyConfig.proxyServer}${endpointPath}`;
}

export function getProxyHealthCheckUrl() {
  return getApiUrl('health');
}

export function getProxyStatusUrl() {
  return getApiUrl('status');
}

export function getCacheClearUrl() {
  return getApiUrl('cacheClear');
}

/**
 * 🔴 关键修改：支持所有域名
 */
export function isDomainSupported(hostname) {
  if (!hostname) return false;
  
  // 所有有效的域名都支持代理
  try {
    // 简单验证域名格式
    return hostname.includes('.') || hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * 获取域名分类（始终返回'all'）
 */
export function getDomainCategory(hostname) {
  return 'all'; // 所有域名归为同一类
}

/**
 * 获取默认配置
 */
export function getDefaultConfig() {
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
      averageResponseTime: 0
    }
  };
}

/**
 * 创建优化的请求配置
 */
export function createRequestConfig(options = {}) {
  const resourceType = options.resourceType || 'other';
  const timeout = proxyConfig.requestConfig.timeouts[resourceType] || 
                  proxyConfig.requestConfig.timeouts.default;
  
  const config = {
    method: options.method || 'GET',
    ...proxyConfig.requestConfig.options,
    ...options,
    timeout
  };
  
  const headers = new Headers();
  
  Object.entries(proxyConfig.requestConfig.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  if (options.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
    headers.set('Content-Type', 'application/json');
  }
  
  const acceptHeaders = {
    html: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    css: 'text/css,*/*;q=0.1',
    js: 'application/javascript,text/javascript,*/*;q=0.1',
    image: 'image/webp,image/apng,image/*,*/*;q=0.8',
    api: 'application/json,text/plain,*/*',
    media: 'video/*,audio/*,*/*;q=0.5'
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

/**
 * 智能代理连接测试
 */
export async function testProxyConnectivity() {
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
        error: error.message
      };
    }
  });
  
  const results = await Promise.allSettled(tests);
  
  const successfulTest = results.find(
    r => r.status === 'fulfilled' && r.value.success
  );
  
  if (successfulTest) {
    return successfulTest.value;
  }
  
  const failedTest = results.find(r => r.status === 'fulfilled');
  return failedTest ? failedTest.value : {
    success: false,
    error: 'All connectivity tests failed'
  };
}

/**
 * 错误日志管理
 */
export const errorLogger = {
  maxLogs: 200,
  
  log(error, context = {}) {
    if (!proxyConfig.errorHandling.logErrors) return;
    
    const errorLog = {
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
        memory: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576),
          total: Math.round(performance.memory.totalJSHeapSize / 1048576)
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
  },
  
  classifyError(error) {
    const message = error.message || '';
    
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('timeout') || message.includes('超时')) return 'timeout';
    if (message.includes('CORS')) return 'cors';
    if (message.includes('404') || message.includes('not found')) return 'not_found';
    if (message.includes('500') || message.includes('server')) return 'server';
    if (message.includes('403') || message.includes('forbidden')) return 'forbidden';
    
    return 'unknown';
  },
  
  async sendToMonitoring(errorLog) {
    // 预留接口
  },
  
  getLogs() {
    try {
      const logs = localStorage.getItem(proxyConfig.storageKeys.proxyErrors);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.warn('无法读取错误日志:', error);
      return [];
    }
  },
  
  clearLogs() {
    try {
      localStorage.removeItem(proxyConfig.storageKeys.proxyErrors);
      console.log('错误日志已清除');
      return true;
    } catch (error) {
      console.warn('无法清除错误日志:', error);
      return false;
    }
  },
  
  getErrorStats() {
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
    
    const errorsByType = {};
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
  },
  
  calculateErrorTrend(logs) {
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
};