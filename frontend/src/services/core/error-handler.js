// src/services/core/error-handler.js
// 全局错误处理服务

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.retryQueue = new Map();
    this.errorCallbacks = new Map();
    this.setupGlobalErrorHandling();
  }

  // 设置全局错误处理
  setupGlobalErrorHandling() {
    // 捕获未处理的错误
    window.addEventListener('error', (event) => {
      this.handleGlobalError(event.error, event);
    });

    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handlePromiseRejection(event.reason, event);
    });
  }

  // 处理全局错误
  handleGlobalError(error, event) {
    console.error('全局错误捕获:', error);
    
    const errorInfo = {
      type: 'global_error',
      message: error.message,
      stack: error.stack,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      timestamp: Date.now()
    };

    this.logError(errorInfo);

    // 处理特定类型的错误
    if (error.message && error.message.includes('GREATEST')) {
      this.handleDatabaseCompatibilityError();
    } else if (error.message && error.message.includes('ambiguous column name')) {
      this.handleDatabaseSchemaError();
    }
  }

  // 处理Promise拒绝
  handlePromiseRejection(reason, event) {
    console.error('未处理的Promise拒绝:', reason);

    const errorInfo = {
      type: 'promise_rejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
      timestamp: Date.now()
    };

    this.logError(errorInfo);

    // 处理特定错误
    if (reason && reason.message) {
      if (reason.message.includes('GREATEST') || 
          reason.message.includes('ambiguous column name')) {
        event.preventDefault(); // 防止在控制台显示错误
        this.handleDatabaseError(reason);
      }
    }
  }

  // API错误处理
  handleAPIError(error, context = {}) {
    console.error('API错误:', error, context);

    const errorInfo = {
      type: 'api_error',
      message: error.message,
      status: error.status,
      endpoint: context.endpoint,
      method: context.method,
      timestamp: Date.now()
    };

    this.logError(errorInfo);

    // 根据错误类型进行不同处理
    switch (error.status) {
      case 401:
        this.handleAuthError(error);
        break;
      case 403:
        this.handlePermissionError(error);
        break;
      case 429:
        this.handleRateLimitError(error, context);
        break;
      case 500:
      case 502:
      case 503:
        this.handleServerError(error, context);
        break;
      default:
        this.handleGenericError(error, context);
    }

    return this.formatErrorResponse(error, context);
  }

  // 网络错误处理
  handleNetworkError(error, context = {}) {
    console.error('网络错误:', error, context);

    const errorInfo = {
      type: 'network_error',
      message: error.message,
      isOnline: navigator.onLine,
      endpoint: context.endpoint,
      timestamp: Date.now()
    };

    this.logError(errorInfo);

    if (!navigator.onLine) {
      this.showNotification('网络连接已断开，请检查网络设置', 'error');
      return { success: false, error: '网络连接不可用' };
    }

    // 添加到重试队列
    if (context.endpoint && context.retryable !== false) {
      this.addToRetryQueue(context);
    }

    return this.formatErrorResponse(error, context);
  }

  // 认证错误处理
  handleAuthError(error) {
    this.showNotification('登录已过期，请重新登录', 'error');
    
    // 触发认证回调
    this.triggerCallback('auth_error', error);
    
    // 清除认证信息
    localStorage.removeItem('auth_token');
    
    // 重定向到登录
    setTimeout(() => {
      if (typeof window.app?.showLoginModal === 'function') {
        window.app.showLoginModal();
      }
    }, 1000);
  }

  // 权限错误处理
  handlePermissionError(error) {
    this.showNotification('没有权限执行此操作', 'error');
    this.triggerCallback('permission_error', error);
  }

  // 限流错误处理
  handleRateLimitError(error, context) {
    const retryAfter = error.retryAfter || 60;
    this.showNotification(`请求过于频繁，请${retryAfter}秒后重试`, 'warning');
    
    // 自动重试
    setTimeout(() => {
      this.retryFailedRequest(context);
    }, retryAfter * 1000);
  }

  // 服务器错误处理
  handleServerError(error, context) {
    this.showNotification('服务器暂时不可用，正在重试...', 'warning');
    
    // 添加到重试队列
    this.addToRetryQueue(context);
  }

  // 通用错误处理
  handleGenericError(error, context) {
    const message = error.message || '发生未知错误';
    this.showNotification(message, 'error');
  }

  // 数据库兼容性错误处理
  handleDatabaseCompatibilityError() {
    this.showNotification('检测到数据库兼容性问题，系统正在修复中...', 'warning');
    
    setTimeout(() => {
      if (confirm('数据库兼容性问题已修复，是否刷新页面以应用修复？')) {
        window.location.reload();
      }
    }, 3000);
  }

  // 数据库架构错误处理
  handleDatabaseSchemaError() {
    this.showNotification('数据库结构已更新，建议刷新页面', 'info');
    
    setTimeout(() => {
      if (confirm('检测到数据库结构更新，是否刷新页面以获得最新功能？')) {
        window.location.reload();
      }
    }, 5000);
  }

  // 数据库错误处理
  handleDatabaseError(error) {
    this.showNotification('系统检测到数据库更新，正在应用修复...', 'info');
  }

  // 错误恢复机制
  setupErrorRecovery() {
    // 定期检查重试队列
    setInterval(() => {
      this.processRetryQueue();
    }, 30000); // 每30秒检查一次

    // 网络状态恢复监听
    window.addEventListener('online', () => {
      this.showNotification('网络连接已恢复', 'success');
      this.processRetryQueue();
    });
  }

  // 重试失败的请求
  async retryFailedRequest(requestContext) {
    try {
      console.log('重试失败的请求:', requestContext);
      
      if (typeof requestContext.retryFunction === 'function') {
        await requestContext.retryFunction();
        this.showNotification('请求重试成功', 'success');
      }
    } catch (error) {
      console.error('重试失败:', error);
      this.handleAPIError(error, requestContext);
    }
  }

  // 添加到重试队列
  addToRetryQueue(context) {
    const id = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.retryQueue.set(id, {
      ...context,
      retryCount: 0,
      maxRetries: 3,
      nextRetry: Date.now() + 30000 // 30秒后重试
    });
  }

  // 处理重试队列
  processRetryQueue() {
    const now = Date.now();
    
    for (const [id, item] of this.retryQueue) {
      if (now >= item.nextRetry && item.retryCount < item.maxRetries) {
        this.retryFailedRequest(item);
        
        item.retryCount++;
        item.nextRetry = now + (30000 * Math.pow(2, item.retryCount)); // 指数退避
        
        if (item.retryCount >= item.maxRetries) {
          this.retryQueue.delete(id);
        }
      } else if (item.retryCount >= item.maxRetries) {
        this.retryQueue.delete(id);
      }
    }
  }

  // 记录错误
  logError(errorInfo) {
    this.errorLog.push(errorInfo);
    
    // 限制日志大小
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-50);
    }
  }

  // 格式化错误响应
  formatErrorResponse(error, context) {
    return {
      success: false,
      error: error.message || '请求失败',
      code: error.status || error.code,
      context,
      timestamp: Date.now()
    };
  }

  // 显示通知
  showNotification(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 注册错误回调
  onError(type, callback) {
    if (!this.errorCallbacks.has(type)) {
      this.errorCallbacks.set(type, []);
    }
    this.errorCallbacks.get(type).push(callback);
  }

  // 触发错误回调
  triggerCallback(type, error) {
    const callbacks = this.errorCallbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(error);
      } catch (e) {
        console.error('错误回调执行失败:', e);
      }
    });
  }

  // 获取错误统计
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(error => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }

  // 清除错误日志
  clearErrorLog() {
    this.errorLog = [];
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      errorCount: this.errorLog.length,
      retryQueueSize: this.retryQueue.size,
      lastError: this.errorLog[this.errorLog.length - 1] || null
    };
  }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();

// 初始化错误恢复机制
errorHandler.setupErrorRecovery();

export default errorHandler;