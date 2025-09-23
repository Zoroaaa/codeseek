// frontend/src/core/proxy-config.js - 代理配置（修复版）

/**
 * 代理配置管理
 * 版本: v1.0.1 - 修复CORS和直接访问问题
 * 作用: 统一管理代理服务器配置和相关设置
 */

export const proxyConfig = {
  // 代理服务器地址 (从 wrangler.toml 和 index.js 确认)
  proxyServer: 'https://all.omnibox.pp.ua',
  
  // 是否默认开启（从localStorage读取用户偏好）
  defaultEnabled: true,
  
  // 代理URL格式模板 (支持动态路由 /proxy/{hostname}/{path})
  proxyUrlTemplate: '{proxy}/proxy/{hostname}{path}',
  
  // 支持代理的域名白名单（与后端index.js中的allowedTargets保持同步）
  supportedDomains: [
    'www.javbus.com',
    'javbus.com', 
    'javdb.com',
    'www.javdb.com',
    'www.javlibrary.com',
    'javlibrary.com',
    'sukebei.nyaa.si',
    'btsow.com',
    'www.btsow.com',
    'magnetdl.com',
    'www.magnetdl.com',
    'torrentkitty.tv',
    'www.torrentkitty.tv',
    'jable.tv',
    'www.jable.tv',
    'javmost.com',
    'www.javmost.com',
    'jav.guru',
    'www.jav.guru',
    'av01.tv',
    'www.av01.tv',
    'missav.com',
    'www.missav.com',
    'javhd.porn',
    'www.javhd.porn',
    'javgg.net',
    'www.javgg.net',
    'javhihi.com',
    'www.javhihi.com',
    'sehuatang.org',
    'www.sehuatang.org',
    't66y.com',
    'www.t66y.com'
  ],
  
  // 请求配置（新增）
  requestConfig: {
    // 请求头设置
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cache-Control': 'no-cache',
      // 确保发送正确的Origin头
      'Origin': window.location.origin,
      // 设置Referer头
      'Referer': window.location.href
    },
    
    // 请求选项
    options: {
      credentials: 'omit', // 不发送cookies，避免CORS问题
      mode: 'cors', // 明确指定CORS模式
      cache: 'no-cache'
    }
  },
  
  // 预留扩展配置
  future: {
    // 后续可添加域名规则
    domainRules: [],
    // 后续可添加智能模式
    smartMode: false,
    // 后续可添加性能监控
    performanceMonitoring: false,
    // 后续可添加代理链
    proxyChain: [],
    // 后续可添加负载均衡
    loadBalancing: false
  },
  
  // 本地存储键名
  storageKeys: {
    proxyEnabled: 'codeseek_proxy_enabled',
    proxyPreferences: 'codeseek_proxy_preferences',
    proxyStats: 'codeseek_proxy_stats',
    proxyErrors: 'codeseek_proxy_errors' // 新增：错误日志
  },
  
  // 代理状态枚举
  status: {
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    ERROR: 'error',
    CHECKING: 'checking'
  },
  
  // 超时设置（优化后）
  timeouts: {
    healthCheck: 8000,  // 健康检查超时（增加到8秒）
    request: 30000,     // 请求超时
    retry: 3,           // 重试次数
    retryDelay: 1000   // 重试延迟
  },
  
  // 错误处理配置（新增）
  errorHandling: {
    maxRetries: 3,
    retryDelays: [1000, 2000, 5000], // 递增延迟
    fallbackToOriginal: true, // 代理失败时回退到原始URL
    logErrors: true
  },
  
  // UI配置
  ui: {
    // 代理状态指示器配置
    statusIndicator: {
      showInResults: true,
      showInToolbar: true,
      animateTransitions: true
    },
    
    // 按钮配置
    buttons: {
      toggleText: {
        enabled: '🔒 代理已启用',
        disabled: '🔓 启用代理模式',
        error: '⚠️ 代理服务异常',
        checking: '🔄 检查中...'
      },
      tooltips: {
        enabled: '点击关闭代理模式',
        disabled: '点击启用代理模式，通过代理服务器访问搜索结果',
        unavailable: '代理服务不可用',
        directAccess: '支持直接浏览器访问'
      }
    },
    
    // 样式类名
    cssClasses: {
      proxyEnabled: 'proxy-enabled',
      proxyDisabled: 'proxy-disabled',
      proxyError: 'proxy-error',
      proxyButton: 'proxy-toggle-btn',
      proxyIndicator: 'proxy-status-indicator'
    }
  }
};

/**
 * 验证代理配置是否有效（增强版）
 */
export function validateProxyConfig() {
  const issues = [];
  
  if (!proxyConfig.proxyServer) {
    issues.push('代理服务器地址未配置');
  } else {
    try {
      new URL(proxyConfig.proxyServer);
    } catch (e) {
      issues.push('代理服务器地址格式不正确');
    }
  }
  
  if (!proxyConfig.proxyUrlTemplate.includes('{proxy}') || 
      !proxyConfig.proxyUrlTemplate.includes('{hostname}')) {
    issues.push('代理URL模板格式不正确');
  }
  
  if (!Array.isArray(proxyConfig.supportedDomains) || 
      proxyConfig.supportedDomains.length === 0) {
    issues.push('支持的域名列表为空');
  }
  
  // 新增：验证请求配置
  if (!proxyConfig.requestConfig.headers.Origin) {
    console.warn('代理配置警告：Origin头未设置，可能导致CORS问题');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings: issues.length === 0 && !proxyConfig.requestConfig.headers.Origin ? ['Origin头未设置'] : []
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
 * 检查域名是否支持代理
 */
export function isDomainSupported(hostname) {
  if (!hostname) return false;
  
  const normalizedHostname = hostname.toLowerCase();
  return proxyConfig.supportedDomains.some(domain => 
    domain.toLowerCase() === normalizedHostname
  );
}

/**
 * 获取默认配置（用于重置）
 */
export function getDefaultConfig() {
  return {
    enabled: proxyConfig.defaultEnabled,
    preferences: {
      autoEnable: false,
      showStatusInResults: true,
      preferOriginalOnError: true,
      logErrors: true // 新增
    },
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastUsed: null
    }
  };
}

/**
 * 创建增强的请求配置（新增函数）
 */
export function createRequestConfig(options = {}) {
  const config = {
    method: options.method || 'GET',
    headers: {
      ...proxyConfig.requestConfig.headers,
      ...options.headers
    },
    ...proxyConfig.requestConfig.options,
    ...options
  };
  
  // 确保Origin头设置正确
  if (!config.headers['Origin']) {
    config.headers['Origin'] = window.location.origin;
  }
  
  // 确保Referer头设置正确
  if (!config.headers['Referer']) {
    config.headers['Referer'] = window.location.href;
  }
  
  return config;
}

/**
 * 检测代理可用性（新增函数）
 */
export async function testProxyConnectivity() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);
    
    const response = await fetch(getProxyHealthCheckUrl(), {
      ...createRequestConfig(),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        data,
        responseTime: Date.now() - performance.now()
      };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.name === 'AbortError' ? '连接超时' : error.message
    };
  }
}

/**
 * 错误日志管理（新增）
 */
export const errorLogger = {
  /**
   * 记录错误
   */
  log(error, context = {}) {
    if (!proxyConfig.errorHandling.logErrors) return;
    
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message || error,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem(proxyConfig.storageKeys.proxyErrors) || '[]');
      existingLogs.push(errorLog);
      
      // 保持最近100条错误记录
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      localStorage.setItem(proxyConfig.storageKeys.proxyErrors, JSON.stringify(existingLogs));
      console.error('代理错误记录:', errorLog);
    } catch (storageError) {
      console.error('无法保存错误日志:', storageError);
    }
  },
  
  /**
   * 获取错误日志
   */
  getLogs() {
    try {
      return JSON.parse(localStorage.getItem(proxyConfig.storageKeys.proxyErrors) || '[]');
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
      return true;
    } catch (error) {
      console.warn('无法清除错误日志:', error);
      return false;
    }
  }
};