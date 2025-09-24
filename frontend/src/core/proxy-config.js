// frontend/src/core/proxy-config.js - 升级版代理配置 v4.0.0
// 对应后端架构 v4.0.0，前端服务 v2.1.0

/**
 * 升级版代理配置管理中心
 * 集成最新的v4.0.0后端架构特性
 */
export const proxyConfig = {
  // 代理服务器地址（v4.0.0更新）
  proxyServer: 'https://all.omnibox.pp.ua',
  
  // 备用代理服务器（故障转移支持）
  backupServers: [
    // 可以添加备用服务器
  ],
  
  // 代理URL格式模板（v4.0.0更新）
  proxyUrlTemplate: '{proxy}/proxy/{hostname}{path}',
  
  // API端点配置（v4.0.0新增）
  apiEndpoints: {
    health: '/api/health',
    status: '/api/status',
    cacheStats: '/api/cache/stats',
    proxyStats: '/api/proxy/stats',
    clearCache: '/api/cache/clear'
  },
  
  // 默认配置
  defaultEnabled: true,
  
  // 支持代理的域名白名单（v4.0.0扩展）
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
    't66y.com', 'www.t66y.com',
    
    // 新增通用BT站点（v4.0.0扩展）
    'thepiratebay.org', 'www.thepiratebay.org',
    '1337x.to', 'www.1337x.to',
    'rarbg.to', 'www.rarbg.to',
    'yts.mx', 'www.yts.mx',
    'eztv.re', 'www.eztv.re',
    'limetor.pro', 'www.limetor.pro',
    'torrentgalaxy.to', 'www.torrentgalaxy.to',
    'zooqle.com', 'www.zooqle.com',
    'torlock.com', 'www.torlock.com',
    'kickasstorrents.to', 'www.kickasstorrents.to'
  ],
  
  // 域名分类（优化处理策略）
  domainCategories: {
    video: ['jable.tv', 'missav.com', 'av01.tv', 'javmost.com'],
    database: ['javbus.com', 'javdb.com', 'javlibrary.com'],
    torrent: ['sukebei.nyaa.si', 'btsow.com', 'magnetdl.com', 'thepiratebay.org', '1337x.to'],
    forum: ['sehuatang.org', 't66y.com']
  },
  
  // 智能模式配置（v4.0.0新增）
  smartMode: {
    enabled: true,
    autoDetect: true,
    testTimeout: 3000,
    fallbackEnabled: true,
    cache: new Map()
  },
  
  // 请求配置（v4.0.0优化）
  requestConfig: {
    headers: {
      // 最小必要请求头，避免CORS预检
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    
    options: {
      credentials: 'omit',
      mode: 'cors',
      cache: 'default',
      redirect: 'follow',
      keepalive: true
    },
    
    // 超时配置（根据资源类型）
    timeouts: {
      default: 30000,      // v4.0.0: 30秒默认超时
      api: 10000,
      html: 15000,
      resource: 30000,
      media: 60000
    },
    
    // 重试策略（v4.0.0增强）
    retry: {
      maxAttempts: 10,     // v4.0.0: 最大10次重定向
      delays: [1000, 2000, 5000],
      retryOn: [408, 429, 500, 502, 503, 504],
      circuitBreaker: true // v4.0.0: 新增熔断器
    }
  },
  
  // 缓存策略配置（v4.0.0智能缓存）
  cacheStrategy: {
    enabled: true,
    maxSize: 50, // MB - v4.0.0: 与后端MAX_CONTENT_SIZE对应
    maxEntries: 200, // v4.0.0: 限制条目数防止内存泄漏
    
    // 资源TTL（与后端CONFIG.CACHE_SETTINGS对应）
    ttl: {
      html: 5 * 60 * 1000,          // 5分钟
      css: 60 * 60 * 1000,          // 1小时
      js: 60 * 60 * 1000,           // 1小时  
      image: 24 * 60 * 60 * 1000,   // 24小时
      font: 7 * 24 * 60 * 60 * 1000, // 7天
      api: 60 * 1000,               // 1分钟
      media: 60 * 60 * 1000,        // 1小时
      other: 30 * 60 * 1000         // 30分钟
    },
    
    // 智能清理策略（v4.0.0新增）
    cleanup: {
      interval: 5 * 60 * 1000,     // 5分钟清理间隔
      maxAge: 30 * 60 * 1000,      // 30分钟最大缓存时间
      strategy: 'LRU'              // LRU淘汰策略
    }
  },
  
  // 性能优化配置（v4.0.0增强）
  performance: {
    maxConcurrent: 6,        // 并发请求限制
    requestQueue: true,      // v4.0.0: 启用请求队列
    
    // 请求优先级（v4.0.0新增）
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
    
    // 预加载和懒加载
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
  
  // 本地存储键名（v4.0.0统一）
  storageKeys: {
    proxyEnabled: 'codeseek_proxy_enabled_v4',
    proxyPreferences: 'codeseek_proxy_preferences_v4',
    proxyStats: 'codeseek_proxy_stats_v4',
    proxyErrors: 'codeseek_proxy_errors_v4',
    proxyCache: 'codeseek_proxy_cache_v4',
    smartModeCache: 'codeseek_smart_mode_cache_v4'
  },
  
  // 代理状态枚举（v4.0.0扩展）
  status: {
    DISABLED: 'disabled',
    ENABLED: 'enabled', 
    ERROR: 'error',
    CHECKING: 'checking',
    DEGRADED: 'degraded',
    SMART: 'smart',
    HEALTHY: 'healthy',      // v4.0.0新增
    UNHEALTHY: 'unhealthy'   // v4.0.0新增
  },
  
  // 超时设置（v4.0.0对应后端）
  timeouts: {
    healthCheck: 10000,
    request: 30000,         // v4.0.0: 对应REQUEST_TIMEOUT
    retry: 10,              // v4.0.0: 对应MAX_REDIRECTS
    retryDelay: 1000,
    failoverTimeout: 5000   // v4.0.0: 对应FAILOVER_TIMEOUT
  },
  
  // 错误处理配置（v4.0.0增强）
  errorHandling: {
    maxRetries: 3,
    retryDelays: [1000, 2000, 5000],
    fallbackToOriginal: true,
    logErrors: true,
    
    // v4.0.0: 新增错误分类处理
    strategies: {
      network: { retry: true, fallback: true, notify: false },
      timeout: { retry: true, fallback: true, notify: true },
      server: { retry: false, fallback: true, notify: true },
      client: { retry: false, fallback: false, notify: false },
      redirect_loop: { retry: false, fallback: true, notify: true }, // v4.0.0新增
      cors: { retry: false, fallback: false, notify: true }          // v4.0.0新增
    }
  },
  
  // 特殊处理配置（v4.0.0新增）
  specialHandling: {
    magnetLinks: true,      // 磁力链接保护
    downloadLinks: true,    // 下载链接支持  
    torrentFiles: true,     // 种子文件支持
    ed2kLinks: true,        // ED2K链接支持
    thunderLinks: true,     // 迅雷链接支持
    websockets: true        // WebSocket支持
  },
  
  // 安全配置（v4.0.0增强）
  security: {
    blockMaliciousScripts: true,
    sanitizeHtml: true,
    blockAds: true,
    maxContentSize: 50 * 1024 * 1024, // v4.0.0: 50MB限制
    allowedProtocols: ['http:', 'https:', 'magnet:', 'thunder:', 'ed2k:'],
    
    // v4.0.0: 新增安全特性
    xssProtection: true,
    sqlInjectionProtection: true,
    pathTraversalProtection: true,
    rateLimiting: true
  },
  
  // UI配置（v4.0.0优化）
  ui: {
    statusIndicator: {
      showInResults: true,
      showInToolbar: true,
      animateTransitions: true,
      showPerformanceMetrics: true,
      showHealthStatus: true        // v4.0.0新增
    },
    
    buttons: {
      toggleText: {
        enabled: '🔒 代理已启用',
        disabled: '🔓 启用代理模式', 
        error: '⚠️ 代理服务异常',
        checking: '🔄 检查中...',
        degraded: '⚡ 降级模式',
        smart: '🧠 智能模式',
        healthy: '✅ 运行正常',      // v4.0.0新增
        unhealthy: '❌ 服务异常'    // v4.0.0新增
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
    }
  },
  
  // 监控和分析（v4.0.0新增）
  monitoring: {
    enabled: true,
    metrics: [
      'responseTime',
      'successRate', 
      'cacheHitRate',
      'errorRate',
      'redirectCount',        // v4.0.0新增
      'healthStatus'          // v4.0.0新增
    ],
    reportInterval: 60000,
    
    // v4.0.0: 性能阈值
    thresholds: {
      responseTime: 2000,     // ms
      successRate: 0.8,       // 80%
      errorRate: 0.2,         // 20%
      redirectLimit: 10       // v4.0.0: 重定向限制
    }
  },
  
  // v4.0.0: 版本信息
  version: {
    backend: '4.0.0',
    frontend: '2.1.0',
    compatibility: '4.0.0'
  }
};

/**
 * v4.0.0增强版配置验证
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
      
      // v4.0.0: 验证服务器可达性
      if (url.hostname === 'all.omnibox.pp.ua') {
        // 默认服务器，检查API端点
        recommendations.push('使用官方代理服务器，建议定期检查健康状态');
      }
    } catch (e) {
      issues.push('代理服务器地址格式不正确');
    }
  }
  
  // v4.0.0: 新增配置验证
  if (!proxyConfig.specialHandling.magnetLinks && proxyConfig.supportedDomains.some(d => d.includes('nyaa'))) {
    warnings.push('支持种子站点但未启用磁力链接处理');
  }
  
  if (proxyConfig.performance.maxConcurrent > 10) {
    warnings.push('并发请求数过高可能影响性能和服务器负载');
  }
  
  if (!proxyConfig.cacheStrategy.enabled) {
    recommendations.push('建议启用缓存以提升性能和减少服务器负载');
  }
  
  // v4.0.0: 安全配置检查
  if (!proxyConfig.security.blockMaliciousScripts) {
    warnings.push('未启用恶意脚本拦截，存在安全风险');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings,  
    recommendations,
    version: proxyConfig.version
  };
}

/**
 * 获取代理健康检查URL（v4.0.0）
 */
export function getProxyHealthCheckUrl() {
  return `${proxyConfig.proxyServer}${proxyConfig.apiEndpoints.health}`;
}

/**
 * 获取代理状态检查URL（v4.0.0）  
 */
export function getProxyStatusUrl() {
  return `${proxyConfig.proxyServer}${proxyConfig.apiEndpoints.status}`;
}

/**
 * 获取缓存统计URL（v4.0.0新增）
 */
export function getProxyCacheStatsUrl() {
  return `${proxyConfig.proxyServer}${proxyConfig.apiEndpoints.cacheStats}`;
}

/**
 * v4.0.0增强版域名支持检查
 */
export function isDomainSupported(hostname) {
  if (!hostname) return false;
  
  const normalizedHostname = hostname.toLowerCase();
  
  // 精确匹配
  if (proxyConfig.supportedDomains.includes(normalizedHostname)) {
    return true;
  }
  
  // 子域名匹配
  return proxyConfig.supportedDomains.some(domain => {
    const normalizedDomain = domain.toLowerCase();
    
    // 通配符支持
    if (normalizedDomain.startsWith('*.')) {
      const baseDomain = normalizedDomain.substring(2);
      return normalizedHostname.endsWith(baseDomain);
    }
    
    // 主域名匹配
    return normalizedHostname === normalizedDomain || 
           normalizedHostname.endsWith('.' + normalizedDomain) ||
           normalizedDomain.endsWith('.' + normalizedHostname);
  });
}

/**
 * 获取域名分类（v4.0.0）
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
 * 创建优化的请求配置（v4.0.0增强）
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
  
  // v4.0.0: 智能请求头管理
  const headers = new Headers();
  
  // 只在必要时添加请求头
  if (options.body && ['POST', 'PUT', 'PATCH'].includes(config.method)) {
    headers.set('Content-Type', 'application/json');
  }
  
  // v4.0.0: 压缩支持
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
  
  // v4.0.0: 用户代理随机化
  headers.set('User-Agent', getRandomUserAgent());
  
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
 * v4.0.0: 获取随机用户代理
 */
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * v4.0.0增强版代理连接测试
 */
export async function testProxyConnectivity() {
  const endpoints = [
    proxyConfig.apiEndpoints.health,
    proxyConfig.apiEndpoints.status,
    proxyConfig.apiEndpoints.proxyStats
  ];
  
  // 并发测试多个端点
  const tests = endpoints.map(async (endpoint) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);
      
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
          responseTime: Math.round(endTime - startTime),
          version: data.version || 'unknown' // v4.0.0: 版本信息
        };
      }
      
      return {
        success: false,
        endpoint,
        error: `HTTP ${response.status}`,
        responseTime: Math.round(endTime - startTime)
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
  
  // 返回详细的错误信息
  const failures = results
    .filter(r => r.status === 'fulfilled')
    .map(r => r.value);
    
  return {
    success: false,
    error: 'All connectivity tests failed',
    details: failures
  };
}

/**
 * v4.0.0增强版错误日志管理
 */
export const errorLogger = {
  maxLogs: 200,
  
  log(error, context = {}) {
    if (!proxyConfig.errorHandling.logErrors) return;
    
    const errorLog = {
      timestamp: new Date().toISOString(),
      message: error.message || error.toString(),
      stack: error.stack,
      context: {
        ...context,
        proxyVersion: proxyConfig.version,      // v4.0.0新增
        userAgent: navigator.userAgent,
        url: window.location.href
      },
      type: this.classifyError(error),
      
      // v4.0.0: 性能信息
      performance: {
        memory: performance.memory ? {
          used: Math.round(performance.memory.usedJSHeapSize / 1048576),
          total: Math.round(performance.memory.totalJSHeapSize / 1048576)
        } : null,
        timing: performance.now()
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
      
      console.error('[ProxyService v4.0.0] Error logged:', errorLog);
    } catch (storageError) {
      console.error('Failed to save error log:', storageError);
    }
  },
  
  classifyError(error) {
    const message = error.message || '';
    
    if (message.includes('redirect') || message.includes('loop')) {
      return 'redirect_loop';  // v4.0.0新增
    }
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
    if (message.includes('magnet') || message.includes('special protocol')) {
      return 'special_protocol'; // v4.0.0新增
    }
    
    return 'unknown';
  },
  
  getLogs() {
    try {
      const logs = localStorage.getItem(proxyConfig.storageKeys.proxyErrors);
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.warn('Cannot read error logs:', error);
      return [];
    }
  },
  
  clearLogs() {
    try {
      localStorage.removeItem(proxyConfig.storageKeys.proxyErrors);
      console.log('[ProxyService v4.0.0] Error logs cleared');
      return true;
    } catch (error) {
      console.warn('Cannot clear error logs:', error);
      return false;
    }
  },
  
  // v4.0.0: 增强版错误统计
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
    
    return {
      total: logs.length,
      last24Hours: recentErrors.length,
      lastHour: hourlyErrors.length,
      errorsByType,
      mostCommonError: Object.entries(errorsByType)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      proxyVersion: proxyConfig.version
    };
  }
};

// v4.0.0: 默认配置
export function getDefaultConfig() {
  return {
    enabled: proxyConfig.defaultEnabled,
    preferences: {
      autoEnable: false,
      smartMode: true,           // v4.0.0: 默认启用智能模式
      cacheEnabled: true,
      performanceMode: 'balanced',
      showStatusInResults: true,
      preferOriginalOnError: true,
      logErrors: true,
      magnetLinksEnabled: true,  // v4.0.0: 新增磁力链接支持
      healthCheckEnabled: true   // v4.0.0: 新增健康检查
    },
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      redirectsHandled: 0,       // v4.0.0新增
      specialLinksProcessed: 0,  // v4.0.0新增
      lastUsed: null,
      averageResponseTime: 0,
      version: proxyConfig.version
    }
  };
}