// frontend/src/services/proxy-service.js - 代理服务（修复版）

import { 
  proxyConfig, 
  validateProxyConfig, 
  getProxyHealthCheckUrl, 
  getProxyStatusUrl,
  isDomainSupported,
  getDefaultConfig,
  createRequestConfig,
  testProxyConnectivity,
  errorLogger
} from '../core/proxy-config.js';

/**
 * 代理服务类
 * 版本: v1.0.1 - 修复CORS问题和增强错误处理
 * 作用: 管理代理功能的核心逻辑
 */
class ProxyService {
  constructor() {
    this.isInitialized = false;
    this.currentStatus = proxyConfig.status.DISABLED;
    this.healthCheckTimer = null;
    this.stats = this.loadStats();
    this.lastHealthCheck = null;
    this.isHealthy = null;
    this.retryCount = 0;
    
    // 验证配置
    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('代理配置验证失败:', validation.issues);
      if (validation.warnings && validation.warnings.length > 0) {
        console.warn('代理配置警告:', validation.warnings);
      }
    }
  }

  /**
   * 初始化代理服务
   */
  async init() {
    try {
      // 加载用户偏好
      const enabled = this.loadProxyState();
      
      if (enabled) {
        // 尝试启用代理，但不因为初始化失败而阻塞
        try {
          await this.enableProxy();
        } catch (error) {
          console.warn('初始化时启用代理失败，将继续以禁用状态运行:', error.message);
          this.currentStatus = proxyConfig.status.DISABLED;
          errorLogger.log(error, { context: 'initialization', action: 'enableProxy' });
        }
      }
      
      // 启动健康检查（如果启用了代理）
      if (this.isProxyEnabled()) {
        this.startHealthCheck();
      }
      
      this.isInitialized = true;
      console.log('代理服务初始化完成', {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        stats: this.stats
      });
      
      return { success: true };
    } catch (error) {
      console.error('代理服务初始化失败:', error);
      this.currentStatus = proxyConfig.status.ERROR;
      errorLogger.log(error, { context: 'initialization' });
      return { success: false, error: error.message };
    }
  }

  // ===================== 核心功能（增强版） =====================

  /**
   * 检查代理是否开启
   */
  isProxyEnabled() {
    return this.currentStatus === proxyConfig.status.ENABLED;
  }

  /**
   * 切换代理开关
   */
  async toggleProxy() {
    try {
      if (this.isProxyEnabled()) {
        return await this.disableProxy();
      } else {
        return await this.enableProxy();
      }
    } catch (error) {
      console.error('切换代理状态失败:', error);
      errorLogger.log(error, { context: 'toggle', currentStatus: this.currentStatus });
      return { success: false, error: error.message };
    }
  }

  /**
   * 转换为代理URL（增强版）
   */
export function convertToProxyUrl(originalUrl, proxyServer) {
  if (!originalUrl || typeof originalUrl !== 'string') {
    throw new Error('Invalid URL provided');
  }

  try {
    const url = new URL(originalUrl);
    const hostname = url.hostname;
    
    // 检查域名是否支持代理
    if (!isDomainSupported(hostname)) {
      console.warn(`域名 ${hostname} 不在代理支持列表中`);
      return originalUrl;
    }

    // 构建完整路径（包含pathname + search + hash）
    let path = url.pathname || '/';
    if (url.search) {
      path += url.search;
    }
    if (url.hash) {
      path += url.hash;
    }

    // 确保路径以 / 开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // 生成代理URL - 注意这里的格式
    const proxyUrl = `${proxyServer}/proxy/${hostname}${path}`;

    console.debug('URL转换完成:', { 
      original: originalUrl, 
      proxy: proxyUrl,
      hostname,
      path
    });
    
    return proxyUrl;
  } catch (error) {
    console.error('URL转换失败:', error, 'Original URL:', originalUrl);
    return originalUrl;
  }
}

  /**
   * 获取原始URL（从代理URL中提取）
   */
export function getOriginalUrl(proxyUrl, proxyServer) {
  if (!proxyUrl || typeof proxyUrl !== 'string') {
    return proxyUrl;
  }

  try {
    // 检查是否是代理URL
    const proxyPrefix = `${proxyServer}/proxy/`;
    if (!proxyUrl.includes(proxyPrefix)) {
      return proxyUrl; // 不是代理URL，直接返回
    }

    // 解析代理URL：https://all.omnibox.pp.ua/proxy/hostname/path
    const proxyPrefixIndex = proxyUrl.indexOf('/proxy/') + 7; // '/proxy/'.length = 7
    const remainingUrl = proxyUrl.substring(proxyPrefixIndex);
    
    // 找到第一个 / 来分离hostname和path
    const firstSlashIndex = remainingUrl.indexOf('/');
    
    let hostname, path;
    if (firstSlashIndex === -1) {
      // 没有路径部分，只有hostname
      hostname = remainingUrl;
      path = '/';
    } else {
      hostname = remainingUrl.substring(0, firstSlashIndex);
      path = remainingUrl.substring(firstSlashIndex);
    }
    
    // 重构原始URL
    const originalUrl = `https://${hostname}${path}`;
    
    console.debug('代理URL转换为原始URL:', {
      proxy: proxyUrl,
      original: originalUrl,
      hostname,
      path
    });
    
    return originalUrl;
  } catch (error) {
    console.error('原始URL提取失败:', error, 'Proxy URL:', proxyUrl);
    return proxyUrl;
  }
}

  // ===================== 状态管理（增强版） =====================

  /**
   * 启用代理（增强版）
   */
  async enableProxy() {
    try {
      this.currentStatus = proxyConfig.status.CHECKING;
      this.retryCount = 0;
      
      // 使用增强的连接测试
      const connectivityTest = await testProxyConnectivity();
      if (!connectivityTest.success) {
        // 尝试重试
        if (this.retryCount < proxyConfig.errorHandling.maxRetries) {
          this.retryCount++;
          console.log(`代理连接失败，尝试重试 ${this.retryCount}/${proxyConfig.errorHandling.maxRetries}`);
          
          await new Promise(resolve => 
            setTimeout(resolve, proxyConfig.errorHandling.retryDelays[this.retryCount - 1] || 1000)
          );
          
          return await this.enableProxy(); // 递归重试
        }
        
        this.currentStatus = proxyConfig.status.ERROR;
        const error = `代理服务器连接失败: ${connectivityTest.error}`;
        errorLogger.log(new Error(error), { 
          context: 'enableProxy', 
          retryCount: this.retryCount,
          lastError: connectivityTest.error 
        });
        return { success: false, error };
      }

      this.currentStatus = proxyConfig.status.ENABLED;
      this.saveProxyState(true);
      this.startHealthCheck();
      this.retryCount = 0; // 重置重试计数
      
      // 触发状态变更事件
      this.dispatchStatusChange();
      
      console.log('代理已启用', { responseTime: connectivityTest.responseTime });
      return { 
        success: true, 
        message: '代理已启用',
        responseTime: connectivityTest.responseTime 
      };
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('启用代理失败:', error);
      errorLogger.log(error, { context: 'enableProxy', retryCount: this.retryCount });
      return { success: false, error: error.message };
    }
  }

  /**
   * 禁用代理
   */
  async disableProxy() {
    try {
      this.currentStatus = proxyConfig.status.DISABLED;
      this.saveProxyState(false);
      this.stopHealthCheck();
      this.retryCount = 0;
      
      // 触发状态变更事件
      this.dispatchStatusChange();
      
      console.log('代理已禁用');
      return { success: true, message: '代理已禁用' };
    } catch (error) {
      console.error('禁用代理失败:', error);
      errorLogger.log(error, { context: 'disableProxy' });
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取代理状态（增强版）
   */
  getProxyStatus() {
    return {
      enabled: this.isProxyEnabled(),
      status: this.currentStatus,
      server: proxyConfig.proxyServer,
      supportedDomains: proxyConfig.supportedDomains.length,
      stats: this.stats,
      lastHealthCheck: this.lastHealthCheck,
      isHealthy: this.isHealthy,
      retryCount: this.retryCount,
      version: '1.0.1',
      errorLogs: errorLogger.getLogs().slice(-5) // 最近5条错误
    };
  }

  // ===================== 健康检查（增强版） =====================

  /**
   * 检查代理健康状态（增强版）
   */
  async checkProxyHealth() {
    try {
      const startTime = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);

      const response = await fetch(getProxyHealthCheckUrl(), {
        ...createRequestConfig({ signal: controller.signal }),
        method: 'GET'
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();
      this.lastHealthCheck = Date.now();
      this.isHealthy = healthData.status === 'healthy';

      return { 
        success: true, 
        data: healthData,
        responseTime: Math.round(endTime - startTime)
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = Date.now();
      
      let errorMessage = '健康检查失败';
      if (error.name === 'AbortError') {
        errorMessage = '健康检查超时';
      } else if (error.message) {
        errorMessage = error.message;
      }

      errorLogger.log(error, { context: 'healthCheck' });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * 启动健康检查定时器
   */
  startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 每5分钟检查一次
    this.healthCheckTimer = setInterval(async () => {
      if (this.isProxyEnabled()) {
        const result = await this.checkProxyHealth();
        if (!result.success) {
          console.warn('代理健康检查失败:', result.error);
          this.dispatchHealthCheckFailed(result.error);
        } else {
          // 健康检查成功，重置重试计数
          this.retryCount = 0;
        }
      }
    }, 5 * 60 * 1000); // 5分钟
  }

  /**
   * 停止健康检查定时器
   */
  stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  // ===================== 请求处理（新增） =====================

  /**
   * 发送代理请求（新增方法）
   */
  async makeProxyRequest(url, options = {}) {
    if (!this.isProxyEnabled()) {
      throw new Error('代理服务未启用');
    }

    const proxyUrl = this.convertToProxyUrl(url);
    if (proxyUrl === url) {
      throw new Error('URL转换为代理URL失败');
    }

    try {
      const requestConfig = createRequestConfig(options);
      const response = await fetch(proxyUrl, requestConfig);
      
      if (!response.ok) {
        throw new Error(`代理请求失败: HTTP ${response.status}`);
      }
      
      this.updateStats('requestSuccess', url);
      return response;
    } catch (error) {
      this.updateStats('requestError', url);
      errorLogger.log(error, { context: 'proxyRequest', url, proxyUrl });
      
      if (proxyConfig.errorHandling.fallbackToOriginal) {
        console.warn('代理请求失败，尝试直接请求:', error.message);
        try {
          const fallbackResponse = await fetch(url, createRequestConfig(options));
          this.updateStats('fallbackSuccess', url);
          return fallbackResponse;
        } catch (fallbackError) {
          this.updateStats('fallbackError', url);
          throw new Error(`代理和直接请求均失败: ${error.message}, ${fallbackError.message}`);
        }
      }
      
      throw error;
    }
  }

  // ===================== 本地存储管理 =====================

  /**
   * 保存代理状态
   */
  saveProxyState(enabled) {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyEnabled, enabled.toString());
    } catch (error) {
      console.warn('保存代理状态失败:', error);
    }
  }

  /**
   * 加载代理状态
   */
  loadProxyState() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyEnabled);
      return stored === 'true';
    } catch (error) {
      console.warn('加载代理状态失败:', error);
      return proxyConfig.defaultEnabled;
    }
  }

  /**
   * 保存统计数据
   */
  saveStats() {
    try {
      localStorage.setItem(proxyConfig.storageKeys.proxyStats, JSON.stringify(this.stats));
    } catch (error) {
      console.warn('保存代理统计失败:', error);
    }
  }

  /**
   * 加载统计数据
   */
  loadStats() {
    try {
      const stored = localStorage.getItem(proxyConfig.storageKeys.proxyStats);
      return stored ? JSON.parse(stored) : getDefaultConfig().stats;
    } catch (error) {
      console.warn('加载代理统计失败:', error);
      return getDefaultConfig().stats;
    }
  }

  // ===================== 统计和事件（增强版） =====================

  /**
   * 更新统计数据（增强版）
   */
  updateStats(action, ...args) {
    try {
      switch (action) {
        case 'urlConverted':
          this.stats.totalRequests++;
          this.stats.successfulRequests++;
          this.stats.lastUsed = Date.now();
          break;
        case 'conversionError':
          this.stats.totalRequests++;
          this.stats.failedRequests++;
          break;
        case 'requestSuccess':
          this.stats.successfulRequests++;
          break;
        case 'requestError':
          this.stats.failedRequests++;
          break;
        case 'fallbackSuccess':
          this.stats.fallbackSuccesses = (this.stats.fallbackSuccesses || 0) + 1;
          break;
        case 'fallbackError':
          this.stats.fallbackErrors = (this.stats.fallbackErrors || 0) + 1;
          break;
        case 'healthCheckFailed':
          this.stats.healthCheckFailures = (this.stats.healthCheckFailures || 0) + 1;
          break;
      }
      
      // 异步保存，避免阻塞
      setTimeout(() => this.saveStats(), 0);
    } catch (error) {
      console.warn('更新统计数据失败:', error);
    }
  }

  /**
   * 触发状态变更事件
   */
  dispatchStatusChange() {
    document.dispatchEvent(new CustomEvent('proxyStatusChanged', {
      detail: {
        enabled: this.isProxyEnabled(),
        status: this.currentStatus,
        timestamp: Date.now(),
        stats: this.stats
      }
    }));
  }

  /**
   * 触发健康检查失败事件
   */
  dispatchHealthCheckFailed(error) {
    this.updateStats('healthCheckFailed');
    
    document.dispatchEvent(new CustomEvent('proxyHealthCheckFailed', {
      detail: {
        error,
        timestamp: Date.now(),
        canRetry: this.retryCount < proxyConfig.errorHandling.maxRetries,
        retryCount: this.retryCount
      }
    }));
  }

  // ===================== 诊断和调试（新增） =====================

  /**
   * 运行代理诊断（新增方法）
   */
  async runDiagnostics() {
    const results = {
      timestamp: new Date().toISOString(),
      config: validateProxyConfig(),
      connectivity: null,
      status: this.getProxyStatus(),
      errors: errorLogger.getLogs().slice(-10)
    };
    
    try {
      results.connectivity = await testProxyConnectivity();
    } catch (error) {
      results.connectivity = { success: false, error: error.message };
    }
    
    return results;
  }

  /**
   * 重置代理服务（新增方法）
   */
  async resetProxy() {
    try {
      // 停止所有活动
      this.stopHealthCheck();
      
      // 重置状态
      this.currentStatus = proxyConfig.status.DISABLED;
      this.retryCount = 0;
      this.isHealthy = null;
      this.lastHealthCheck = null;
      
      // 清除存储的状态
      this.saveProxyState(false);
      
      // 清除错误日志
      errorLogger.clearLogs();
      
      console.log('代理服务已重置');
      return { success: true, message: '代理服务已重置' };
    } catch (error) {
      console.error('重置代理服务失败:', error);
      return { success: false, error: error.message };
    }
  }

  // ===================== 预留扩展接口（未来阶段） =====================

  /**
   * 未来：智能判断是否需要代理
   */
  shouldProxy(url) {
    // 预留接口，未来可以根据规则智能判断
    if (!url) return false;
    
    try {
      const hostname = new URL(url).hostname;
      return isDomainSupported(hostname);
    } catch {
      return false;
    }
  }

  /**
   * 未来：设置代理规则
   */
  setProxyRules(rules) {
    // 预留接口，未来可以设置自定义代理规则
    console.warn('setProxyRules is not implemented yet');
    return { success: false, error: 'Not implemented' };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.stopHealthCheck();
    this.saveStats();
    this.isInitialized = false;
    console.log('代理服务资源已清理');
  }
}

// 创建单例实例
const proxyService = new ProxyService();

export default proxyService;