import { ERROR_CODES, EVENT_NAMES } from './constants.js';

/**
 * 全局错误处理器
 */
export class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 50;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    window.addEventListener('error', (event) => {
      this.handleError('JavaScript Error', event.error, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.handleError('Unhandled Promise Rejection', event.reason);
      
      if (this.isAuthError(event.reason)) {
        this.handleAuthError(event.reason);
      }
      
      event.preventDefault();
    });

    this.initialized = true;
  }

  isAuthError(error) {
    if (!error) return false;
    
    const message = error.message || String(error);
    return message.includes('认证失败') || 
           message.includes('401') ||
           message.includes('Unauthorized') ||
           message.includes('Token验证失败');
  }

  handleAuthError(error) {
    console.warn('🔐 检测到认证错误，清理认证状态');
    
    localStorage.removeItem('auth_token');
    
    const event = new CustomEvent(EVENT_NAMES.AUTH_STATE_CHANGED, {
      detail: { type: 'logout', reason: 'auth_error' }
    });
    window.dispatchEvent(event);
    
    if (window.location.pathname.includes('dashboard')) {
      window.location.href = './index.html';
    }
  }

  handleError(type, error, extra = {}) {
    const errorInfo = {
      type,
      message: error?.message || String(error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...extra
    };

    this.addToLog(errorInfo);
    console.error(`🚨 ${type}:`, errorInfo);

    // 发送到服务器（如果API可用）
    if (navigator.onLine && window.apiClient) {
      window.apiClient.recordAction('error', errorInfo).catch(console.error);
    }
  }

  addToLog(errorInfo) {
    this.errorLog.unshift(errorInfo);
    
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  getErrorLog() {
    return [...this.errorLog];
  }

  clearErrorLog() {
    this.errorLog = [];
  }

  safeExecute(func, fallback = null, context = 'function') {
    try {
      return func();
    } catch (error) {
      this.handleError(`Safe Execute Error (${context})`, error);
      return fallback;
    }
  }

  async safeAsyncExecute(asyncFunc, fallback = null, context = 'async function') {
    try {
      return await asyncFunc();
    } catch (error) {
      this.handleError(`Safe Async Execute Error (${context})`, error);
      return fallback;
    }
  }
}

// 创建全局实例
export const errorHandler = new ErrorHandler();