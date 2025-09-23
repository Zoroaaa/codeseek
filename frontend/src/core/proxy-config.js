// frontend/src/core/proxy-config.js - 代理配置（CORS修复版）

/**
 * 代理配置管理
 * 版本: v1.0.2 - 修复CORS和直接访问问题
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
  
  // 请求配置（修复CORS问题）
  requestConfig: {
    // 简化请求头设置 - 避免触发CORS预检请求
    headers: {
      // 只保留必要的头，移除可能导致CORS问题的头
      // 'Content-Type': 'application/json', // 只在POST请求时添加
      // 移除 X-Requested-With，这会触发预检请求
      // 移除 Cache-Control，这会触发预检请求
      // Origin 和 Referer 由浏览器自动设置
    },
    
    // 请求选项（优化版）
    options: {
      credentials: 'omit', // 不发送cookies，避免CORS问题
      mode: 'cors', // 明确指定CORS模式
      cache: 'default', // 使用默认缓存策略
      redirect: 'follow' // 跟随重定向
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
    proxyErrors: 'codeseek_proxy_errors'
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
    healthCheck: 10000,  // 健康检查超时（增加到10秒）
    request: 30000,      // 请求超时
    retry: 3,            // 重试次数
    retryDelay: 1000    // 重试延迟
  },
  
  // 错误处理配置
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
  const warnings = [];
  
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
  
  return {
    isValid: issues.length === 0,
    issues,
    warnings
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
      logErrors: true
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
 * 创建简化的请求配置（修复CORS问题）
 */
export function createRequestConfig(options = {}) {
  const config = {
    method: options.method || 'GET',
    ...proxyConfig.requestConfig.options,
    ...options
  };
  
  // 只在需要时添加请求头，避免不必要的预检请求
  const headers = {};
  
  // 只在POST/PUT等请求时添加Content-Type
  if (options.body && (config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH')) {
    headers['Content-Type'] = 'application/json';
  }
  
  // 合并用户提供的请求头
  if (options.headers) {
    Object.assign(headers, options.headers);
  }
  
  // 只在有请求头时才添加headers属性
  if (Object.keys(headers).length > 0) {
    config.headers = headers;
  }
  
  return config;
}

/**
 * 检测代理可用性（修复版）
 */
export async function testProxyConnectivity() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);
    
    const startTime = performance.now();
    
    // 使用简化的请求配置
    const response = await fetch(getProxyHealthCheckUrl(), {
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
        data,
        responseTime: Math.round(endTime - startTime)
      };
    } else {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }
  } catch (error) {
    let errorMessage = '连接失败';
    if (error.name === 'AbortError') {
      errorMessage = '连接超时';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 错误日志管理（优化版）
 */
export const errorLogger = {
  /**
   * 记录错误
   */
  log(error, context = {}) {
    if (!proxyConfig.errorHandling.logErrors) return;
    
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message || error.toString(),
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    try {
      const existingLogs = this.getLogs();
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
   * 获取最近的错误统计
   */
  getRecentErrorStats() {
    const logs = this.getLogs();
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const recentErrors = logs.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime > oneDayAgo;
    });
    
    const hourlyErrors = recentErrors.filter(log => {
      const logTime = new Date(log.timestamp).getTime();
      return logTime > oneHourAgo;
    });
    
    return {
      total: logs.length,
      last24Hours: recentErrors.length,
      lastHour: hourlyErrors.length,
      errorTypes: this._groupErrorsByType(recentErrors)
    };
  },
  
  /**
   * 按错误类型分组
   */
  _groupErrorsByType(logs) {
    const grouped = {};
    logs.forEach(log => {
      const errorType = this._categorizeError(log.error);
      grouped[errorType] = (grouped[errorType] || 0) + 1;
    });
    return grouped;
  },
  
  /**
   * 错误分类
   */
  _categorizeError(errorMessage) {
    if (errorMessage.includes('CORS')) return 'CORS错误';
    if (errorMessage.includes('timeout') || errorMessage.includes('超时')) return '超时错误';
    if (errorMessage.includes('network') || errorMessage.includes('网络')) return '网络错误';
    if (errorMessage.includes('404')) return '资源未找到';
    if (errorMessage.includes('500')) return '服务器错误';
    return '其他错误';
  }
};