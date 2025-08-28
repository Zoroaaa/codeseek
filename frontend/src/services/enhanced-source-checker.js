// 修复版增强搜索源可用性检查服务
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';

class EnhancedSearchSourceChecker {
  constructor() {
    this.statusCache = new Map();
    this.historicalReliability = new Map(); // 历史可靠性数据
    this.concurrentChecks = 0;
    this.maxConcurrentChecks = 5;
    
    // 检查策略配置 - 修复：确保所有方法都已定义
    this.checkStrategies = {
      favicon: this.checkFaviconAvailability.bind(this),
      actualSearch: this.checkActualSearchCapability.bind(this),
      multipleEndpoints: this.checkMultipleEndpoints.bind(this),
      domainResolution: this.checkDomainResolution.bind(this),
      comprehensive: this.comprehensiveCheck.bind(this)
    };
    
    // 智能缓存配置
    this.cacheConfig = {
      success: 300000,    // 成功: 5分钟
      partialFail: 120000, // 部分失败: 2分钟
      failure: 60000,     // 完全失败: 1分钟
      error: 30000        // 错误: 30秒
    };
  }

  /**
   * 增强版搜索源可用性检查
   */
  async checkSourcesAvailability(sources, options = {}) {
    const { 
      timeout = 10000,
      showProgress = true,
      useCache = true,
      strategy = 'comprehensive',
      parallel = true
    } = options;
    
    if (showProgress) {
      showToast('正在进行深度检查搜索源可用性...', 'info', 3000);
    }

    // 限制并发数量
    const processInBatches = async (sources, batchSize = this.maxConcurrentChecks) => {
      const results = [];
      for (let i = 0; i < sources.length; i += batchSize) {
        const batch = sources.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(source => this.checkSingleSource(source, { 
            timeout, 
            useCache, 
            strategy 
          }))
        );
        results.push(...batchResults);
        
        // 批次间短暂延迟，避免过于频繁的请求
        if (i + batchSize < sources.length) {
          await this.delay(200);
        }
      }
      return results;
    };

    const results = parallel 
      ? await processInBatches(sources)
      : await this.sequentialCheck(sources, { timeout, useCache, strategy });

    // 分析检查结果
    const analysis = this.analyzeCheckResults(results);
    
    if (showProgress) {
      this.showCheckResultSummary(analysis);
    }

    // 更新历史可靠性数据
    this.updateHistoricalReliability(results);

    return results;
  }

  /**
   * 单个搜索源的综合检查
   */
  async checkSingleSource(source, options = {}) {
    const { timeout, useCache, strategy } = options;
    
    // 检查缓存
    if (useCache) {
      const cached = this.getFromCache(source.id);
      if (cached) return { ...source, ...cached };
    }

    const startTime = Date.now();
    const checkStrategy = this.checkStrategies[strategy] || this.checkStrategies.comprehensive;
    
    try {
      const result = await Promise.race([
        checkStrategy(source, timeout),
        this.timeoutPromise(timeout)
      ]);

      const responseTime = Date.now() - startTime;
      const enhancedResult = {
        ...source,
        ...result,
        responseTime,
        lastChecked: Date.now(),
        reliability: this.calculateReliability(source.id, result)
      };

      // 智能缓存
      this.updateCache(source.id, enhancedResult);
      
      return enhancedResult;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorResult = {
        ...source,
        available: false,
        status: 'error',
        error: error.message,
        responseTime,
        lastChecked: Date.now(),
        reliability: this.calculateReliability(source.id, { available: false })
      };

      this.updateCache(source.id, errorResult, this.cacheConfig.error);
      return errorResult;
    }
  }

  /**
   * favicon 可用性检查
   */
  async checkFaviconAvailability(source, timeout) {
    const baseUrl = this.extractBaseUrl(source.urlTemplate);
    const result = await this.checkEndpoint(`${baseUrl}/favicon.ico`, timeout);
    
    return {
      available: result.success || false,
      status: result.success ? 'online' : 'offline',
      method: 'favicon'
    };
  }

  /**
   * 综合检查策略 - 多种方法组合使用
   */
  async comprehensiveCheck(source, timeout) {
    const checks = [];
    const singleTimeout = Math.floor(timeout / 3);

    // 1. 基础连接检查
    checks.push(this.checkBasicConnectivity(source, singleTimeout));
    
    // 2. 搜索功能检查
    checks.push(this.checkActualSearchCapability(source, singleTimeout));
    
    // 3. 多端点检查
    checks.push(this.checkMultipleEndpoints(source, singleTimeout));

    const results = await Promise.allSettled(checks);
    return this.aggregateCheckResults(results, source);
  }

  /**
   * 基础连接检查 - 更可靠的方法
   */
  async checkBasicConnectivity(source, timeout) {
    const baseUrl = this.extractBaseUrl(source.urlTemplate);
    const checks = [
      // 方法1: 检查robots.txt
      this.checkEndpoint(`${baseUrl}/robots.txt`, timeout),
      // 方法2: 检查favicon
      this.checkEndpoint(`${baseUrl}/favicon.ico`, timeout),
      // 方法3: HEAD请求主页
      this.checkEndpoint(baseUrl, timeout, 'HEAD')
    ];

    const results = await Promise.allSettled(checks);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value && r.value.success).length;
    
    return {
      available: successCount > 0,
      status: successCount > 0 ? 'online' : 'offline',
      connectivityScore: successCount / checks.length
    };
  }

  /**
   * 实际搜索功能检查 - 核心功能
   */
  async checkActualSearchCapability(source, timeout) {
    try {
      // 使用测试关键词进行实际搜索
      const testKeywords = ['test', '001', 'sample'];
      const searchResults = [];

      for (const keyword of testKeywords) {
        try {
          const searchUrl = source.urlTemplate.replace('{keyword}', keyword);
          const result = await this.performLightweightSearch(searchUrl, timeout / testKeywords.length);
          searchResults.push(result);
          
          // 如果有一次成功就足够了
          if (result.success) break;
        } catch (error) {
          searchResults.push({ success: false, error: error.message });
        }
      }

      const hasSuccessfulSearch = searchResults.some(r => r.success);
      
      return {
        available: hasSuccessfulSearch,
        status: hasSuccessfulSearch ? 'online' : 'search_failed',
        searchCapability: hasSuccessfulSearch,
        searchResults: searchResults.filter(r => r.success).length
      };

    } catch (error) {
      return {
        available: false,
        status: 'search_error',
        error: error.message
      };
    }
  }

  /**
   * 轻量级搜索检测
   */
  async performLightweightSearch(searchUrl, timeout) {
    try {
      const response = await this.fetchWithTimeout(searchUrl, {
        method: 'HEAD', // 只检查响应头
        mode: 'no-cors',
        cache: 'no-cache'
      }, timeout);

      return {
        success: true,
        statusCode: response.status || 200,
        redirected: response.redirected,
        finalUrl: response.url
      };
    } catch (error) {
      // 尝试使用图片方式检测
      try {
        const imageCheckResult = await this.imageBasedCheck(searchUrl, timeout);
        return { success: imageCheckResult, method: 'image' };
      } catch (imgError) {
        return { success: false, error: error.message };
      }
    }
  }

  /**
   * 多端点检查 - 检查不同的网站端点
   */
  async checkMultipleEndpoints(source, timeout) {
    const baseUrl = this.extractBaseUrl(source.urlTemplate);
    const endpoints = [
      `${baseUrl}`,
      `${baseUrl}/search`,
      `${baseUrl}/index.html`,
      source.statusCheckUrl // 如果有自定义检查URL
    ].filter(Boolean);

    const endpointChecks = endpoints.map(url => 
      this.checkEndpoint(url, timeout / endpoints.length)
    );

    const results = await Promise.allSettled(endpointChecks);
    const successfulEndpoints = results.filter(r => 
      r.status === 'fulfilled' && r.value && r.value.success
    ).length;

    return {
      available: successfulEndpoints > 0,
      status: successfulEndpoints > 0 ? 'online' : 'offline',
      endpointsChecked: endpoints.length,
      successfulEndpoints,
      endpointScore: successfulEndpoints / endpoints.length
    };
  }

  /**
   * 域名解析检查
   */
  async checkDomainResolution(source, timeout) {
    try {
      const hostname = this.extractHostname(source.urlTemplate);
      
      // 通过创建请求来间接检查域名解析
      const testUrl = `https://${hostname}/favicon.ico?_dns_test=${Date.now()}`;
      
      const result = await this.fetchWithTimeout(testUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      }, timeout);

      return {
        available: true,
        status: 'online',
        dnsResolved: true
      };
    } catch (error) {
      const isDnsError = error.message.includes('DNS') || 
                        error.message.includes('network') ||
                        error.message.includes('NAME_NOT_RESOLVED');
      
      return {
        available: false,
        status: isDnsError ? 'dns_failed' : 'offline',
        dnsResolved: !isDnsError,
        error: error.message
      };
    }
  }

  /**
   * 检查单个端点
   */
  async checkEndpoint(url, timeout, method = 'HEAD') {
    try {
      const response = await this.fetchWithTimeout(url, {
        method,
        mode: 'no-cors',
        cache: 'no-cache'
      }, timeout);

      return {
        success: true,
        status: response.status,
        url: response.url,
        redirected: response.redirected
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 图片方式检测（备用方法）
   */
  async imageBasedCheck(url, timeout) {
    return new Promise((resolve) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        resolve(false);
      }, timeout);

      img.onload = () => {
        clearTimeout(timer);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };

      // 使用1x1像素的透明图片作为测试
      img.src = url.includes('?') ? 
        `${url}&_img_test=${Date.now()}` : 
        `${url}?_img_test=${Date.now()}`;
    });
  }

  /**
   * 带超时的fetch
   */
  async fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 聚合检查结果
   */
  aggregateCheckResults(results, source) {
    const successfulChecks = results.filter(r => 
      r.status === 'fulfilled' && r.value && r.value.available
    ).length;
    
    const totalChecks = results.length;
    const availabilityScore = successfulChecks / totalChecks;

    // 综合评估可用性
    let status = 'offline';
    let available = false;

    if (availabilityScore >= 0.7) {
      status = 'online';
      available = true;
    } else if (availabilityScore >= 0.3) {
      status = 'partial';
      available = true; // 部分可用也算可用
    } else {
      status = 'offline';
      available = false;
    }

    // 收集详细信息
    const details = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        Object.assign(details, result.value);
      }
    });

    return {
      available,
      status,
      availabilityScore,
      successfulChecks,
      totalChecks,
      details
    };
  }

  /**
   * 计算可靠性评分
   */
  calculateReliability(sourceId, result) {
    const history = this.historicalReliability.get(sourceId) || {
      totalChecks: 0,
      successfulChecks: 0,
      recentChecks: []
    };

    // 更新历史记录
    history.totalChecks++;
    if (result.available) {
      history.successfulChecks++;
    }

    // 保留最近10次检查记录
    history.recentChecks.push({
      timestamp: Date.now(),
      available: result.available,
      responseTime: result.responseTime
    });

    if (history.recentChecks.length > 10) {
      history.recentChecks = history.recentChecks.slice(-10);
    }

    // 计算可靠性评分 (0-1)
    const overallReliability = history.successfulChecks / history.totalChecks;
    const recentReliability = history.recentChecks.filter(c => c.available).length / 
                             Math.min(history.recentChecks.length, 10);

    // 综合评分 (最近表现权重更高)
    const reliability = (overallReliability * 0.3) + (recentReliability * 0.7);

    this.historicalReliability.set(sourceId, history);
    
    return Math.round(reliability * 100) / 100;
  }

  /**
   * 智能缓存更新
   */
  updateCache(sourceId, result, customTtl = null) {
    let ttl;
    
    if (customTtl) {
      ttl = customTtl;
    } else if (result.available) {
      ttl = result.status === 'partial' ? 
        this.cacheConfig.partialFail : 
        this.cacheConfig.success;
    } else {
      ttl = this.cacheConfig.failure;
    }

    this.statusCache.set(sourceId, {
      ...result,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * 从缓存获取结果
   */
  getFromCache(sourceId) {
    const cached = this.statusCache.get(sourceId);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      const { timestamp, ttl, ...result } = cached;
      return result;
    }

    if (cached) {
      this.statusCache.delete(sourceId);
    }

    return null;
  }

  /**
   * 分析检查结果
   */
  analyzeCheckResults(results) {
    const total = results.length;
    const available = results.filter(r => r.available).length;
    const partial = results.filter(r => r.status === 'partial').length;
    const offline = results.filter(r => !r.available).length;
    
    const avgResponseTime = results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + r.responseTime, 0) / 
      Math.max(results.filter(r => r.responseTime).length, 1);

    return {
      total,
      available,
      partial,
      offline,
      availabilityRate: available / total,
      avgResponseTime: Math.round(avgResponseTime)
    };
  }

  /**
   * 显示检查结果摘要
   */
  showCheckResultSummary(analysis) {
    const { total, available, partial, offline, availabilityRate } = analysis;
    
    if (availabilityRate >= 0.8) {
      showToast(`检查完成: ${available}/${total} 个源可用 (优秀)`, 'success');
    } else if (availabilityRate >= 0.6) {
      showToast(`检查完成: ${available}/${total} 个源可用 (良好)`, 'warning');
    } else {
      showToast(`检查完成: ${available}/${total} 个源可用 (需要关注)`, 'error');
    }

    if (partial > 0) {
      console.log(`其中 ${partial} 个源部分可用`);
    }
  }

  /**
   * 更新历史可靠性数据
   */
  updateHistoricalReliability(results) {
    results.forEach(result => {
      if (result.reliability !== undefined) {
        // 可靠性数据已在calculateReliability中更新
        console.log(`${result.name}: 可靠性 ${(result.reliability * 100).toFixed(1)}%`);
      }
    });
  }

  /**
   * 工具方法
   */
  extractBaseUrl(urlTemplate) {
    try {
      const url = new URL(urlTemplate.replace('{keyword}', 'test'));
      return `${url.protocol}//${url.hostname}`;
    } catch (error) {
      console.error('提取基础URL失败:', error);
      return '';
    }
  }

  extractHostname(urlTemplate) {
    try {
      const url = new URL(urlTemplate.replace('{keyword}', 'test'));
      return url.hostname;
    } catch (error) {
      console.error('提取主机名失败:', error);
      return '';
    }
  }

  timeoutPromise(timeout) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('检查超时')), timeout);
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sequentialCheck(sources, options) {
    const results = [];
    for (const source of sources) {
      const result = await this.checkSingleSource(source, options);
      results.push(result);
      
      // 序列检查时添加小延迟
      await this.delay(100);
    }
    return results;
  }

  /**
   * 清理缓存和历史数据
   */
  clearCache() {
    this.statusCache.clear();
    this.historicalReliability.clear();
    console.log('搜索源检查缓存已清理');
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    const cacheStats = Array.from(this.statusCache.values());
    const reliabilityStats = Array.from(this.historicalReliability.entries());

    return {
      cacheSize: this.statusCache.size,
      avgReliability: reliabilityStats.length > 0 ? 
        reliabilityStats.reduce((sum, [_, data]) => 
          sum + (data.successfulChecks / data.totalChecks), 0
        ) / reliabilityStats.length : 0,
      reliabilityData: Object.fromEntries(reliabilityStats)
    };
  }
}

export default EnhancedSearchSourceChecker;