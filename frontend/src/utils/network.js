// 网络工具函数
import { showToast } from './dom.js';

class NetworkUtils {
  constructor() {
    this.callbacks = new Set();
    this.connectionInfo = null;
  }

  // 检查网络状态
  isOnline() {
    return navigator.onLine;
  }

  // 监听网络状态变化
  onNetworkChange(callback) {
    this.callbacks.add(callback);
    
    // 添加事件监听器（避免重复添加）
    if (this.callbacks.size === 1) {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }

    // 返回取消监听的函数
    return () => {
      this.callbacks.delete(callback);
    };
  }

  handleOnline() {
    console.log('🌐 网络已连接');
    showToast('网络连接已恢复', 'success');
    this.callbacks.forEach(callback => {
      try {
        callback(true);
      } catch (error) {
        console.error('网络状态回调执行失败:', error);
      }
    });
  }

  handleOffline() {
    console.log('🔵 网络已断开');
    showToast('网络连接已断开', 'warning');
    this.callbacks.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('网络状态回调执行失败:', error);
      }
    });
  }

  // 测试网络连接
  async testConnection(url = window.API_CONFIG?.BASE_URL + '/api/health') {
    if (!navigator.onLine) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, { 
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.warn('网络连接测试失败:', error);
      return false;
    }
  }

  // 获取连接信息（实验性API）
  getConnectionInfo() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        timestamp: Date.now()
      };
      return this.connectionInfo;
    }
    return null;
  }

  // 测试API连接
  async testAPIConnection(baseURL) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${baseURL}/api/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json'
        },
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        return { connected: true, status: response.status, data };
      } else {
        return { connected: false, status: response.status };
      }
    } catch (error) {
      return { 
        connected: false, 
        error: error.name === 'AbortError' ? 'timeout' : error.message 
      };
    }
  }
}

// 设备检测工具
export const DeviceUtils = {
  // 是否为移动设备
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },

  // 是否为平板
  isTablet() {
    return /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);
  },

  // 是否为桌面设备
  isDesktop() {
    return !this.isMobile() && !this.isTablet();
  },

  // 是否支持触摸
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  // 获取屏幕信息
  getScreenInfo() {
    return {
      width: window.screen.width,
      height: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      colorDepth: window.screen.colorDepth,
      orientation: screen.orientation ? screen.orientation.angle : 0
    };
  },

  // 获取浏览器信息
  getBrowserInfo() {
    const ua = navigator.userAgent;
    const browsers = {
      chrome: /Chrome/i.test(ua) && !/Edge/i.test(ua),
      firefox: /Firefox/i.test(ua),
      safari: /Safari/i.test(ua) && !/Chrome/i.test(ua),
      edge: /Edge/i.test(ua),
      ie: /MSIE|Trident/i.test(ua)
    };
    
    const browserName = Object.keys(browsers).find(key => browsers[key]) || 'unknown';
    
    return {
      name: browserName,
      userAgent: ua,
      language: navigator.language,
      languages: navigator.languages || [navigator.language],
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };
  }
};

// 性能监控工具
export const PerformanceUtils = {
  // 测量函数执行时间
  measureTime(func, label = 'function') {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  },

  // 异步函数执行时间
  async measureAsyncTime(asyncFunc, label = 'async function') {
    const start = performance.now();
    const result = await asyncFunc();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  },

  // 获取内存使用情况
  getMemoryUsage() {
    if (performance.memory) {
      const memory = performance.memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  },

  // 性能标记
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
  },

  // 测量性能
  measure(name, startMark, endMark) {
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name);
        return entries[entries.length - 1]?.duration || 0;
      } catch (error) {
        console.error('性能测量失败:', error);
        return 0;
      }
    }
    return 0;
  }
};

// URL工具函数
export const URLUtils = {
  // 检查URL是否有效
  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  // 提取域名
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (_) {
      return '';
    }
  },

  // 添加协议
  addProtocol(url) {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  },

  // 构建查询字符串
  buildQueryString(params) {
    return Object.keys(params)
      .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },

  // 解析查询字符串
  parseQueryString(queryString) {
    const params = {};
    if (!queryString) return params;
    
    const pairs = (queryString.startsWith('?') ? queryString.slice(1) : queryString).split('&');
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    
    return params;
  },

  // 获取文件扩展名
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot > 0) {
        return pathname.slice(lastDot + 1).toLowerCase();
      }
    } catch (error) {
      console.error('获取文件扩展名失败:', error);
    }
    
    return '';
  }
};

// 创建单例实例
export const networkUtils = new NetworkUtils();
export default networkUtils;