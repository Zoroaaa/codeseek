// frontend/src/core/proxy-config.js - 重构版代理配置（无域名限制版）
// 版本: v2.1.0 - 适配后端Enhanced Proxy Worker v2.0.0

/**
 * 代理配置管理中心 - 重构版（无域名限制）
 * 完全适配后端Enhanced Proxy Worker v2.0.0功能
 */
export const proxyConfig = {
  // 代理服务器地址（从后端wrangler.toml配置得知）
  proxyServer: 'https://omnibox.pp.ua',
  
  // 备用代理服务器
  backupServers: [
    // 可根据需要添加备用服务器
  ],
  
  // 默认开启状态
  defaultEnabled: true,
  
  // 智能模式配置
  smartMode: {
    enabled: false,
    autoDetect: true,
    testTimeout: 5000, // 增加超时时间以适配后端
    cache: new Map()
  },
  
  // 代理URL格式（适配后端格式：{proxy}/{target_url}）
  proxyUrlFormat: '{proxy}/{target_url}',
  
  
  // 后端API端点配置
  api: {
    health: '/api/health',
    status: '/api/status',
    cacheClear: '/api/cache/clear'
  },
  
  // 请求配置（适配后端CORS设置）
  requestConfig: {
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    },
    
    options: {
      credentials: 'omit', // 后端设置了无限制CORS
      mode: 'cors',
      cache: 'default',
      redirect: 'follow'
    },
    
    // 超时配置（根据后端缓存TTL调整）
    timeouts: {
      default: 15000,
      api: 10000,
      html: 15000,
      resource: 30000,
      media: 60000,
      healthCheck: 10000 // 适配后端健康检查
    },
    
    // 重试策略
    retry: {
      maxAttempts: 3,
      delays: [1000, 2000, 5000],
      retryOn: [408, 429, 500, 502, 503, 504]
    }
  },
  
  // 缓存策略（适配后端KV缓存）
  cacheStrategy: {
    enabled: true,
    maxSize: 100,
    maxEntries: 500,
    
    // TTL配置（与后端wrangler.toml保持一致）
    ttl: {
      html: 3600 * 1000,           // 1小时（后端CACHE_HTML_TTL=3600）
      css: 86400 * 1000,           // 1天（后端CACHE_CSS_TTL=86400）
      js: 86400 * 1000,            // 1天（后端CACHE_JS_TTL=86400）
      image: 2592000 * 1000,       // 30天（后端CACHE_IMAGE_TTL=2592000）
      font: 2592000 * 1000,        // 30天（后端CACHE_FONT_TTL=2592000）
      api: 1800 * 1000,            // 30分钟（后端CACHE_JSON_TTL=1800）
      media: 3600 * 1000,          // 1小时
      default: 3600 * 1000         // 1小时（后端CACHE_DEFAULT_TTL=3600）
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
  
  // 错误处理配置（适配后端Enhanced Error Handling）
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
        enabled: '🔒 代理已启用',
        disabled: '🔓 启用代理模式',
        error: '⚠️ 代理服务异常',
        checking: '🔄 检查中...',
        degraded: '⚡ 降级模式',
        smart: '🧠 智能模式'
      },
      tooltips: {
        enabled: '点击关闭代理模式\n成功率: {successRate}%\n响应时间: {avgTime}ms',
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
  
  // 安全配置 - 已关闭域名验证
  security: {
    csp: { enabled: false },
    signing: { enabled: false },
    domainValidation: { 
      enabled: false,  // 关闭域名验证
      strict: false 
    }
  },
  
  // 版本信息
  version: '2.1.0',
  backendVersion: '2.0.0'
};

/**
 * 验证代理配置
 */
export function validateProxyConfig() {
  const issues = [];
  const warnings = [];
  const recommendations = [];
  
  // 基础验证
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
  
  // API端点验证
  const requiredEndpoints = ['health', 'status', 'cacheClear'];
  requiredEndpoints.forEach(endpoint => {
    if (!proxyConfig.api[endpoint]) {
      issues.push(`缺少必要的API端点配置: ${endpoint}`);
    }
  });
  
  // 性能建议
  if (proxyConfig.performance.maxConcurrent > 10) {
    warnings.push('并发请求数过高可能影响性能');
  }
  
  if (!proxyConfig.cacheStrategy.enabled) {
    recommendations.push('建议启用缓存以提升性能');
  }
  
  // 移除域名相关的验证，因为已不做域名限制
  recommendations.push('当前配置支持所有域名的代理访问');
  
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

/**
 * 获取代理健康检查URL
 */
export function getProxyHealthCheckUrl() {
  return getApiUrl('health');
}

/**
 * 获取代理状态检查URL
 */
export function getProxyStatusUrl() {
  return getApiUrl('status');
}

/**
 * 获取缓存清理URL
 */
export function getCacheClearUrl() {
  return getApiUrl('cacheClear');
}

/**
 * 域名支持检查 - 现在支持所有域名
 */
export function isDomainSupported(hostname) {
  // 移除域名限制，所有域名都支持代理
  if (!hostname) return false;
  
  // 基本的域名格式验证
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?)*$/;
  
  try {
    const normalizedHostname = hostname.toLowerCase().trim();
    
    // 排除明显无效的域名
    if (normalizedHostname.length === 0 || 
        normalizedHostname.includes('..') ||
        normalizedHostname.startsWith('.') || 
        normalizedHostname.endsWith('.') ||
        normalizedHostname.includes(' ')) {
      return false;
    }
    
    // 排除本地地址和内网地址
    if (normalizedHostname === 'localhost' ||
        normalizedHostname.startsWith('127.') ||
        normalizedHostname.startsWith('192.168.') ||
        normalizedHostname.startsWith('10.') ||
        normalizedHostname.endsWith('.local')) {
      return false;
    }
    
    // 基本格式检查
    return domainRegex.test(normalizedHostname);
    
  } catch (error) {
    console.warn('域名验证出错:', error);
    return false;
  }
}

/**
 * 获取域名分类 - 支持动态分类
 */
export function getDomainCategory(hostname) {
  if (!hostname) return 'unknown';
  
  const normalizedHostname = hostname.toLowerCase();
  
  // 检查预定义分类
  for (const [category, domains] of Object.entries(proxyConfig.domainCategories)) {
    if (domains.some(domain => normalizedHostname.includes(domain.toLowerCase()))) {
      return category;
    }
  }
  
  // 基于域名特征的智能分类
  if (normalizedHostname.includes('video') || 
      normalizedHostname.includes('tube') || 
      normalizedHostname.includes('av') ||
      normalizedHostname.includes('porn')) {
    return 'video';
  }
  
  if (normalizedHostname.includes('torrent') || 
      normalizedHostname.includes('magnet') || 
      normalizedHostname.includes('bt')) {
    return 'torrent';
  }
  
  if (normalizedHostname.includes('forum') || 
      normalizedHostname.includes('bbs') || 
      normalizedHostname.includes('community')) {
    return 'forum';
  }
  
  if (normalizedHostname.includes('db') || 
      normalizedHostname.includes('library') || 
      normalizedHostname.includes('data')) {
    return 'database';
  }
  
  return 'general';
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
      logErrors: true,
      domainWhitelist: [], // 用户自定义白名单（可选）
      domainBlacklist: []  // 用户自定义黑名单（可选）
    },
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastUsed: null,
      averageResponseTime: 0,
      uniqueDomainsAccessed: new Set() // 记录访问过的唯一域名
    }
  };
}

/**
 * 用户自定义域名过滤（可选功能）
 */
export function isUserAllowedDomain(hostname, userPreferences = {}) {
  if (!hostname) return false;
  
  const { domainWhitelist = [], domainBlacklist = [] } = userPreferences;
  
  // 如果有黑名单，检查是否被禁止
  if (domainBlacklist.length > 0) {
    const isBlacklisted = domainBlacklist.some(domain => 
      hostname.toLowerCase().includes(domain.toLowerCase())
    );
    if (isBlacklisted) return false;
  }
  
  // 如果有白名单，检查是否在白名单中
  if (domainWhitelist.length > 0) {
    const isWhitelisted = domainWhitelist.some(domain => 
      hostname.toLowerCase().includes(domain.toLowerCase())
    );
    return isWhitelisted;
  }
  
  // 没有特殊配置时，允许所有通过基本验证的域名
  return isDomainSupported(hostname);
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
  
  // 智能请求头管理
  const headers = new Headers();
  
  // 基础请求头
  Object.entries(proxyConfig.requestConfig.headers).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  // POST请求特殊处理
  if (options.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // 资源类型特定的Accept头
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
  
  // 合并用户请求头
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  
  config.headers = headers;
  return config;
}

/**
 * 智能代理连接测试（适配后端多端点）
 */
export async function testProxyConnectivity() {
  const endpoints = [
    proxyConfig.api.health,
    proxyConfig.api.status,
    '/_health' // 后端支持的备用端点
  ];
  
  // 并发测试多个端点
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
  
  // 找到第一个成功的测试
  const successfulTest = results.find(
    r => r.status === 'fulfilled' && r.value.success
  );
  
  if (successfulTest) {
    return successfulTest.value;
  }
  
  // 返回第一个失败的详细信息
  const failedTest = results.find(r => r.status === 'fulfilled');
  return failedTest ? failedTest.value : {
    success: false,
    error: 'All connectivity tests failed'
  };
}

/**
 * 增强版错误日志管理（适配后端Enhanced Error Handling）
 */
export const errorLogger = {
  maxLogs: 200,
  
  /**
   * 记录错误
   */
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
      
      // 保持日志数量限制
      if (existingLogs.length > this.maxLogs) {
        existingLogs.splice(0, existingLogs.length - this.maxLogs);
      }
      
      localStorage.setItem(proxyConfig.storageKeys.proxyErrors, 
        JSON.stringify(existingLogs));
      
      // 发送到监控系统（如果配置）
      if (proxyConfig.monitoring.enabled) {
        this.sendToMonitoring(errorLog);
      }
      
      console.error('代理错误记录:', errorLog);
    } catch (storageError) {
      console.error('无法保存错误日志:', storageError);
    }
  },
  
  /**
   * 错误分类
   */
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
  
  /**
   * 发送到监控系统
   */
  async sendToMonitoring(errorLog) {
    // 预留接口，可接入监控服务
  },
  
  /**
   * 获取错误日志
   */
  getLogs() {
    try {
      const logs = localStorage.getItem(proxyConfig.storageKeys.proxyErrors);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.warn('无法读取错误日志:', error);
      return [];
    }
  },
  
  /**
   * 清除错误日志
   */
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
  
  /**
   * 获取错误统计
   */
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
    
    // 按错误类型分组
    const errorsByType = {};
    recentErrors.forEach(log => {
      errorsByType[log.type] = (errorsByType[log.type] || 0) + 1;
    });
    
    // 计算错误趋势
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
  
  /**
   * 计算错误趋势
   */
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