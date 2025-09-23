// frontend/src/core/proxy-config.js - 代理配置（极简版）

/**
 * 代理配置管理
 * 版本: v1.0.0
 * 作用: 统一管理代理服务器配置和相关设置
 */

export const proxyConfig = {
  // 代理服务器地址 (从 wrangler.toml 和 index.js 确认)
  proxyServer: 'https://all.omnibox.pp.ua',
  
  // 是否默认开启（从localStorage读取用户偏好）
  defaultEnabled: false,
  
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
    proxyStats: 'codeseek_proxy_stats'
  },
  
  // 代理状态枚举
  status: {
    DISABLED: 'disabled',
    ENABLED: 'enabled',
    ERROR: 'error',
    CHECKING: 'checking'
  },
  
  // 超时设置
  timeouts: {
    healthCheck: 5000, // 健康检查超时
    request: 30000,    // 请求超时
    retry: 3           // 重试次数
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
        disabled: '🔓 启用代理模式'
      },
      tooltips: {
        enabled: '点击关闭代理模式',
        disabled: '点击启用代理模式，通过代理服务器访问搜索结果',
        unavailable: '代理服务不可用'
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
 * 验证代理配置是否有效
 */
export function validateProxyConfig() {
  const issues = [];
  
  if (!proxyConfig.proxyServer) {
    issues.push('代理服务器地址未配置');
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
    issues
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
      preferOriginalOnError: true
    },
    stats: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastUsed: null
    }
  };
}