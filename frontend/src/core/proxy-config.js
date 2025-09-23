// frontend/src/core/proxy-config.js - 优化版代理配置
// 版本: v2.0.0 - 完善的配置管理和智能策略

/**
 * 代理配置管理中心
 * 提供统一的配置管理、验证和优化策略
 */
export const proxyConfig = {
  // 代理服务器地址
  proxyServer: 'https://all.omnibox.pp.ua',
  
  // 备用代理服务器（用于故障转移）
  backupServers: [
    // 'https://backup1.proxy.example.com',
    // 'https://backup2.proxy.example.com'
  ],
  
  // 是否默认开启
  defaultEnabled: true,
  
  // 智能模式：根据网站可访问性自动启用代理
  smartMode: {
    enabled: false,
    autoDetect: true,
    testTimeout: 3000,
    cache: new Map() // 缓存测试结果
  },
  
  // 代理URL格式模板
  proxyUrlTemplate: '{proxy}/proxy/{hostname}{path}',
  
  // 支持代理的域名白名单（优化后的列表）
  supportedDomains: [
    // JAV相关站点
    'www.javbus.com', 'javbus.com',
    'javdb.com', 'www.javdb.com',
    'www.javlibrary.com', 'javlibrary.com',
    'jable.tv', 'www.jable.tv',
    'javmost.com', 'www.javmost.com',
    'jav.guru', 'www.jav.guru',
    'av01.tv', 'www.av01.tv',
    'missav.com', 'www.missav.com',
    'javhd.porn', 'www.javhd.porn',
    'javgg.net', 'www.javgg.net',
    'javhihi.com', 'www.javhihi.com',
    
    // 种子/磁力站点
    'sukebei.nyaa.si',
    'btsow.com', 'www.btsow.com',
    'magnetdl.com', 'www.magnetdl.com',
    'torrentkitty.tv', 'www.torrentkitty.tv',
    
    // 论坛站点
    'sehuatang.org', 'www.sehuatang.org',
    't66y.com', 'www.t66y.com'
  ],
  
  // 域名分类（用于优化处理）
  domainCategories: {
    video: ['jable.tv', 'missav.com', 'av01.tv', 'javmost.com'],
    database: ['javbus.com', 'javdb.com', 'javlibrary.com'],
    torrent: ['sukebei.nyaa.si', 'btsow.com', 'magnetdl.com'],
    forum: ['sehuatang.org', 't66y.com']
  },
  
  // 请求配置（优化版）
  requestConfig: {
    // 基础请求头
    headers: {
      // 使用最小必要的请求头，避免CORS预检
    },
    
    // 请求选项
    options: {
      credentials: 'omit',
      mode: 'cors',
      cache: 'default',
      redirect: 'follow',
      keepalive: true // 保持连接
    },
    
    // 超时配置（根据资源类型动态调整）
    timeouts: {
      default: 15000,
      api: 10000,
      html: 15000,
      resource: 30000,
      media: 60000
    },
    
    // 重试策略
    retry: {
      maxAttempts: 3,
      delays: [1000, 2000, 5000],
      retryOn: [408, 429, 500, 502, 503, 504]
    }
  },
  
  // 缓存策略配置
  cacheStrategy: {
    enabled: true,
    maxSize: 100, // MB
    maxEntries: 500,
    
    // 资源TTL（毫秒）
    ttl: {
      html: 5 * 60 * 1000,          // 5分钟
      css: 60 * 60 * 1000,          // 1小时
      js: 60 * 60 * 1000,           // 1小时
      image: 24 * 60 * 60 * 1000,   // 24小时
      font: 7 * 24 * 60 * 60 * 1000, // 7天
      api: 60 * 1000,               // 1分钟
      media: 60 * 60 * 1000,        // 1小时
      default: 30 * 60 * 1000       // 30分钟
    },
    
    // 缓存规则
    rules: {
      // 总是缓存的资源类型
      alwaysCache: ['image', 'font', 'css', 'js'],
      // 从不缓存的资源类型
      neverCache: ['api/auth', 'api/user'],
      // 条件缓存
      conditionalCache: {
        'api': (response) => response.status === 200,
        'html': (response) => !response.headers.get('cache-control')?.includes('no-cache')
      }
    }
  },
  
  // 性能优化配置
  performance: {
    // 并发请求限制
    maxConcurrent: 6,
    
    // 请求优先级
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
    
    // 预加载策略
    preload: {
      enabled: true,
      resources: ['css', 'js', 'font'],
      maxPreloads: 10
    },
    
    // 懒加载策略
    lazyLoad: {
      enabled: true,
      resources: ['image', 'media'],
      threshold: 100 // 视口距离（像素）
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
    DEGRADED: 'degraded', // 新增：降级状态
    SMART: 'smart' // 新增：智能模式
  },
  
  // 超时设置（优化版）
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
  
  // 错误处理配置（增强版）
  errorHandling: {
    maxRetries: 3,
    retryDelays: [1000, 2000, 5000],
    fallbackToOriginal: true,
    logErrors: true,
    
    // 错误分类和处理策略
    strategies: {
      network: {
        retry: true,
        fallback: true,
        notify: false
      },
      timeout: {
        retry: true,
        fallback: true,
        notify: true
      },
      server: {
        retry: false,
        fallback: true,
        notify: true
      },
      client: {
        retry: false,
        fallback: false,
        notify: false
      }
    }
  },
  
  // UI配置（优化版）
  ui: {
    // 代理状态指示器配置
    statusIndicator: {
      showInResults: true,
      showInToolbar: true,
      animateTransitions: true,
      showPerformanceMetrics: true
    },
    
    // 按钮配置
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
        disabled: '点击启用代理模式，通过代理服务器访问搜索结果',
        unavailable: '代理服务不可用',
        degraded: '代理服务部分可用，已启用降级模式',
        smart: '智能模式：自动检测并使用代理'
      }
    },
    
    // 通知配置
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
    
    // 样式类名
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
    
    // 收集的指标
    metrics: [
      'responseTime',
      'successRate',
      'cacheHitRate',
      'errorRate',
      'throughput'
    ],
    
    // 报告频率（毫秒）
    reportInterval: 60000,
    
    // 性能阈值警告
    thresholds: {
      responseTime: 2000, // ms
      successRate: 0.8,   // 80%
      errorRate: 0.2      // 20%
    }
  },
  
  // 安全配置
  security: {
    // 内容安全策略
    csp: {
      enabled: false,
      policy: "default-src 'self'; script-src 'self' 'unsafe-inline'"
    },
    
    // 请求签名
    signing: {
      enabled: false,
      algorithm: 'SHA-256'
    },
    
    // 域名验证
    domainValidation: {
      enabled: true,
      strict: false
    }
  }
};

/**
 * 高级验证代理配置
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
  
  // URL模板验证
  if (!proxyConfig.proxyUrlTemplate.includes('{proxy}') || 
      !proxyConfig.proxyUrlTemplate.includes('{hostname}')) {
    issues.push('代理URL模板格式不正确');
  }
  
  // 域名列表验证
  if (!Array.isArray(proxyConfig.supportedDomains) || 
      proxyConfig.supportedDomains.length === 0) {
    issues.push('支持的域名列表为空');
  }
  
  // 性能建议
  if (proxyConfig.performance.maxConcurrent > 10) {
    warnings.push('并发请求数过高可能影响性能');
  }
  
  if (!proxyConfig.cacheStrategy.enabled) {
    recommendations.push('建议启用缓存以提升性能');
  }
  
  if (!proxyConfig.smartMode.enabled && proxyConfig.supportedDomains.length > 20) {
    recommendations.push('域名较多时建议启用智能模式');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings,
    recommendations
  };
}

/**
 * 获取代理健康检查URL
 */
export function getProxyHealthCheckUrl() {
  return `${proxyConfig.proxyServer}/api/health`;
}

/**
 * 获取代理状态检查URL
 */
export function getProxyStatusUrl() {
  return `${proxyConfig.proxyServer}/api/status`;
}

/**
 * 智能域名检查（支持通配符和正则）
 */
export function isDomainSupported(hostname) {
  if (!hostname) return false;
  
  const normalizedHostname = hostname.toLowerCase();
  
  // 精确匹配
  if (proxyConfig.supportedDomains.includes(normalizedHostname)) {
    return true;
  }
  
  // 检查是否是子域名
  return proxyConfig.supportedDomains.some(domain => {
    const normalizedDomain = domain.toLowerCase();
    
    // 处理通配符（如 *.example.com）
    if (normalizedDomain.startsWith('*.')) {
      const baseDomain = normalizedDomain.substring(2);
      return normalizedHostname.endsWith(baseDomain);
    }
    
    // 处理主域名匹配子域名
    return normalizedHostname === normalizedDomain || 
           normalizedHostname.endsWith('.' + normalizedDomain);
  });
}

/**
 * 获取域名分类
 */
export function getDomainCategory(hostname) {
  for (const [category, domains] of Object.entries(proxyConfig.domainCategories)) {
    if (domains.some(domain => hostname.includes(domain))) {
      return category;
    }
  }
  return 'other';
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
  
  // 智能请求头管理
  const headers = new Headers();
  
  // 只在必要时添加请求头
  if (options.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // 添加压缩支持
  headers.set('Accept-Encoding', 'gzip, deflate, br');
  
  // 根据资源类型设置Accept头
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
  
  // 合并用户提供的请求头
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
    '/api/health',
    '/api/status',
    '/_health'
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
 * 增强版错误日志管理
 */
export const errorLogger = {
  maxLogs: 200,
  
  /**
   * 记录错误（带分类）
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
    
    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('timeout') || message.includes('超时')) {
      return 'timeout';
    }
    if (message.includes('CORS')) {
      return 'cors';
    }
    if (message.includes('404') || message.includes('not found')) {
      return 'not_found';
    }
    if (message.includes('500') || message.includes('server')) {
      return 'server';
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'forbidden';
    }
    
    return 'unknown';
  },
  
  /**
   * 发送到监控系统
   */
  async sendToMonitoring(errorLog) {
    // 实现监控上报逻辑（如果需要）
    // 例如：发送到 Sentry、LogRocket 等
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
   * 获取错误统计（增强版）
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