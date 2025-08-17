import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { delay } from '../utils/common.js';

/**
 * 网络工具和状态监控
 */
export class NetworkUtils {
  constructor() {
    this.callbacks = new Set();
    this.connectionInfo = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // 定期检查连接状态
    setInterval(() => {
      this.updateConnectionInfo();
    }, APP_CONSTANTS.NETWORK.CONNECTION_CHECK_INTERVAL);

    this.isInitialized = true;
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
      this.init();
    }

    // 返回取消监听的函数
    return () => {
      this.callbacks.delete(callback);
    };
  }

  handleOnline() {
    console.log('🌐 网络已连接');
    
    const event = new CustomEvent(EVENT_NAMES.NETWORK_STATE_CHANGED, {
      detail: { online: true }
    });
    window.dispatchEvent(event);

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

    const event = new CustomEvent(EVENT_NAMES.NETWORK_STATE_CHANGED, {
      detail: { online: false }
    });
    window.dispatchEvent(event);

    this.callbacks.forEach(callback => {
      try {
        callback(false);
      } catch (error) {
        console.error('网络状态回调执行失败:', error);
      }
    });
  }

  // 测试网络连接
  async testConnection(url, timeout = 5000) {
    if (!navigator.onLine) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, { 
        method: 'HEAD',
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
  updateConnectionInfo() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      this.connectionInfo = {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
        timestamp: Date.now()
      };
    }
    return this.connectionInfo;
  }

  getConnectionInfo() {
    return this.connectionInfo;
  }

  // 测试API连接
  async testAPIConnection(baseURL, timeout = 8000) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
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

  // 等待网络连接
  async waitForConnection(maxWait = 30000) {
    if (this.isOnline()) return true;

    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkConnection = () => {
        if (this.isOnline()) {
          resolve(true);
        } else if (Date.now() - startTime >= maxWait) {
          resolve(false);
        } else {
          setTimeout(checkConnection, 1000);
        }
      };

      checkConnection();
    });
  }

  // 网络重试包装器
  async withRetry(fn, maxRetries = APP_CONSTANTS.NETWORK.MAX_SYNC_RETRIES) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (!this.isOnline()) {
          await this.waitForConnection();
        }
        
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) break;
        
        await delay(APP_CONSTANTS.NETWORK.OFFLINE_RETRY_DELAY * attempt);
      }
    }
    
    throw lastError;
  }
}

// 创建全局实例
export const networkUtils = new NetworkUtils();