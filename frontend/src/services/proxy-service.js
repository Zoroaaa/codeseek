// frontend/src/services/proxy-service.js - 代理服务（URL转换）

import { 
  proxyConfig, 
  validateProxyConfig, 
  getProxyHealthCheckUrl, 
  getProxyStatusUrl,
  isDomainSupported,
  getDefaultConfig 
} from '../core/proxy-config.js';

/**
 * 代理服务类
 * 版本: v1.0.0
 * 作用: 管理代理功能的核心逻辑
 */
class ProxyService {
  constructor() {
    this.isInitialized = false;
    this.currentStatus = proxyConfig.status.DISABLED;
    this.healthCheckTimer = null;
    this.stats = this.loadStats();
    
    // 验证配置
    const validation = validateProxyConfig();
    if (!validation.isValid) {
      console.warn('代理配置验证失败:', validation.issues);
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
        await this.enableProxy();
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
      return { success: false, error: error.message };
    }
  }

  // ===================== 核心功能（第一阶段） =====================

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
      return { success: false, error: error.message };
    }
  }

  /**
   * 转换为代理URL
   */
  convertToProxyUrl(originalUrl) {
    if (!originalUrl || typeof originalUrl !== 'string') {
      throw new Error('Invalid URL provided');
    }

    if (!this.isProxyEnabled()) {
      return originalUrl; // 代理未启用，返回原始URL
    }

    try {
      const url = new URL(originalUrl);
      const hostname = url.hostname;
      
      // 检查域名是否支持代理
      if (!isDomainSupported(hostname)) {
        console.warn(`域名 ${hostname} 不在代理支持列表中`);
        return originalUrl; // 不支持的域名，返回原始URL
      }

      // 构建路径（包含pathname + search + hash）
      let path = url.pathname || '/';
      if (url.search) {
        path += url.search;
      }
      if (url.hash) {
        path += url.hash;
      }

      // 使用模板生成代理URL
      const proxyUrl = proxyConfig.proxyUrlTemplate
        .replace('{proxy}', proxyConfig.proxyServer)
        .replace('{hostname}', hostname)
        .replace('{path}', path);

      // 更新统计
      this.updateStats('urlConverted', originalUrl, proxyUrl);

      return proxyUrl;
    } catch (error) {
      console.error('URL转换失败:', error, 'Original URL:', originalUrl);
      this.updateStats('conversionError', originalUrl);
      return originalUrl; // 转换失败，返回原始URL
    }
  }

  /**
   * 获取原始URL（从代理URL中提取）
   */
  getOriginalUrl(proxyUrl) {
    if (!proxyUrl || typeof proxyUrl !== 'string') {
      return proxyUrl;
    }

    try {
      // 检查是否是代理URL
      if (!proxyUrl.includes(proxyConfig.proxyServer + '/proxy/')) {
        return proxyUrl; // 不是代理URL，直接返回
      }

      // 解析代理URL：https://codeseek-site.workers.dev/proxy/hostname/path
      const proxyPattern = new RegExp(`${proxyConfig.proxyServer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/proxy/([^/]+)(.*)`);
      const match = proxyUrl.match(proxyPattern);

      if (match) {
        const hostname = match[1];
        const path = match[2] || '/';
        
        // 重构原始URL
        const originalUrl = `https://${hostname}${path}`;
        
        console.debug('代理URL转换为原始URL:', proxyUrl, '->', originalUrl);
        return originalUrl;
      }

      return proxyUrl; // 无法解析，返回原URL
    } catch (error) {
      console.error('原始URL提取失败:', error, 'Proxy URL:', proxyUrl);
      return proxyUrl;
    }
  }

  // ===================== 状态管理 =====================

  /**
   * 启用代理
   */
  async enableProxy() {
    try {
      this.currentStatus = proxyConfig.status.CHECKING;
      
      // 检查代理服务器可用性
      const healthCheck = await this.checkProxyHealth();
      if (!healthCheck.success) {
        this.currentStatus = proxyConfig.status.ERROR;
        return { 
          success: false, 
          error: `代理服务器不可用: ${healthCheck.error}` 
        };
      }

      this.currentStatus = proxyConfig.status.ENABLED;
      this.saveProxyState(true);
      this.startHealthCheck();
      
      // 触发状态变更事件
      this.dispatchStatusChange();
      
      console.log('代理已启用');
      return { success: true, message: '代理已启用' };
    } catch (error) {
      this.currentStatus = proxyConfig.status.ERROR;
      console.error('启用代理失败:', error);
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
      
      // 触发状态变更事件
      this.dispatchStatusChange();
      
      console.log('代理已禁用');
      return { success: true, message: '代理已禁用' };
    } catch (error) {
      console.error('禁用代理失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取代理状态
   */
  getProxyStatus() {
    return {
      enabled: this.isProxyEnabled(),
      status: this.currentStatus,
      server: proxyConfig.proxyServer,
      supportedDomains: proxyConfig.supportedDomains.length,
      stats: this.stats,
      lastHealthCheck: this.lastHealthCheck,
      isHealthy: this.isHealthy
    };
  }

  // ===================== 健康检查 =====================

  /**
   * 检查代理健康状态
   */
  async checkProxyHealth() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxyConfig.timeouts.healthCheck);

      const response = await fetch(getProxyHealthCheckUrl(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();
      this.lastHealthCheck = Date.now();
      this.isHealthy = healthData.status === 'healthy';

      return { 
        success: true, 
        data: healthData,
        responseTime: Date.now() - this.lastHealthCheck
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
          // 可以选择自动禁用代理或提醒用户
          this.dispatchHealthCheckFailed(result.error);
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

  // ===================== 统计和事件 =====================

  /**
   * 更新统计数据
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
        case 'healthCheckFailed':
          // 可以添加健康检查失败统计
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
        timestamp: Date.now()
      }
    }));
  }

  /**
   * 触发健康检查失败事件
   */
  dispatchHealthCheckFailed(error) {
    document.dispatchEvent(new CustomEvent('proxyHealthCheckFailed', {
      detail: {
        error,
        timestamp: Date.now(),
        canRetry: true
      }
    }));
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
    console.log('代理服务资源已清理');
  }
}

// 创建单例实例
const proxyService = new ProxyService();

export default proxyService;