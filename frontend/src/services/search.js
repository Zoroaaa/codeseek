// src/services/search.js - 优化版本：完全集成新的搜索源管理API，修复前后端匹配问题，并添加代理功能
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { showToast } from '../utils/dom.js';
import apiService from './api.js';
import authManager from './auth.js';
import backendSourceChecker from './enhanced-source-checker.js';
import searchSourcesAPI from './search-sources-api.js';

class SearchService {
  constructor() {
    this.searchCache = new Map();
    this.cacheExpiration = APP_CONSTANTS.API.CACHE_DURATION;
    this.userSettings = null;
    
    // 搜索源缓存
    this.sourcesCache = null;
    this.sourcesCacheTimestamp = 0;
    this.sourcesCacheExpiry = 300000; // 5分钟缓存
    
    // 状态检查统计
    this.checkStats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      backendCalls: 0
    };
    
    // 改进的代理配置
    this.proxyConfig = {
      enabled: false,
      baseUrl: '',
      needsProxy: new Set(),
      intelligentRouting: true,
      userRegion: 'CN', // 默认地区
      // 添加安全验证
      allowedTargets: [
        'www.javbus.com', 'javbus.com', 
        'javdb.com', 'www.javdb.com',
        'www.javlibrary.com', 'javlibrary.com',
        'sukebei.nyaa.si', 'btsow.com', 'www.btsow.com'
        // ... 其他允许的目标
      ]
    };
  }

  /**
   * 初始化代理配置 - 添加安全验证
   */
  async initProxyConfig() {
    try {
      const userSettings = await this.getUserSettings();
      
      // 从配置获取代理基础URL，确保是受信任的域名
      const proxyBaseUrl = this.validateProxyBaseUrl(
        userSettings.customProxyUrl || 
        window.API_CONFIG?.PROXY_BASE_URL || 
        'https://all.omnibox.pp.ua'
      );
      
      this.proxyConfig = {
        enabled: userSettings.enableProxy || true,
        baseUrl: proxyBaseUrl,
        intelligentRouting: userSettings.intelligentProxyRouting !== false,
        userRegion: userSettings.userRegion || 'CN',
        needsProxy: new Set(userSettings.proxiedSources || [
          'javbus', 'javdb', 'javlibrary', 'btsow', 'sukebei'
        ])
      };
      
      console.log('代理配置已初始化:', {
        enabled: this.proxyConfig.enabled,
        baseUrl: this.proxyConfig.baseUrl,
        sourcesCount: this.proxyConfig.needsProxy.size
      });
    } catch (error) {
      console.error('初始化代理配置失败:', error);
      this.proxyConfig.enabled = false;
    }
  }
  
    /**
   * 验证代理基础URL是否安全
   */
  validateProxyBaseUrl(url) {
    if (!url) return null;
    
    try {
      const urlObj = new URL(url);
      
      // 只允许HTTPS协议
      if (urlObj.protocol !== 'https:') {
        console.warn('代理URL必须使用HTTPS协议');
        return null;
      }
      
      // 验证域名是否为可信的Worker域名
      const trustedDomains = [
        '.zadi.workers.dev',
        '.omnibox.pp.ua',
        // 可以添加其他受信任的域名
      ];
      
      const hostname = urlObj.hostname;
      const isTrusted = trustedDomains.some(domain => 
        hostname.endsWith(domain)
      );
      
      if (!isTrusted) {
        console.warn('代理URL域名不在可信列表中:', hostname);
        return null;
      }
      
      return url;
    } catch (error) {
      console.error('代理URL格式无效:', error);
      return null;
    }
  }

  /**
   * 验证目标域名是否允许代理
   */
  isAllowedProxyTarget(hostname) {
    return this.proxyConfig.allowedTargets.some(allowed => 
      hostname === allowed || hostname === allowed.replace('www.', '')
    );
  }



  /**
   * 智能判断是否需要使用代理
   */
  shouldUseProxy(sourceId, userRegion = null) {
    if (!this.proxyConfig.enabled) return false;
    
    const region = userRegion || this.proxyConfig.userRegion;
    
    // 如果启用了智能路由，根据源和地区自动判断
    if (this.proxyConfig.intelligentRouting) {
      const proxyRules = {
        'javbus': ['CN', 'RU', 'IR', 'KR'], // 这些地区需要代理
        'javdb': ['CN', 'RU', 'IR'],
        'javlibrary': ['CN'],
        'sukebei': ['CN', 'KR', 'SG'],
        'btsow': ['CN', 'KR'],
        'sehuatang': ['CN'],
        't66y': ['CN']
      };
      
      return proxyRules[sourceId]?.includes(region) || false;
    }
    
    // 否则使用手动配置的代理源列表
    return this.proxyConfig.needsProxy.has(sourceId);
  }

  /**
   * 选择最佳代理服务器
   */
selectBestProxy(sourceId, userRegion = null) {
  const region = userRegion || this.proxyConfig.userRegion;
  
  // 使用你的代理域名
  const proxies = {
    'US': 'https://us.omnibox.pp.ua',
    'EU': 'https://eu.omnibox.pp.ua', 
    'ASIA': 'https://all.omnibox.pp.ua', // 主代理服务器
  };

  // 根据用户地区选择最近的代理
  if (['CN', 'TW', 'HK', 'MO', 'JP', 'KR', 'SG'].includes(region)) {
    return proxies.ASIA;
  }
  if (['DE', 'FR', 'UK', 'IT', 'ES', 'NL', 'CH'].includes(region)) {
    return proxies.EU;
  }
  
  return proxies.US;
}
  
    /**
   * 测试代理连接
   */
  async testProxyConnection(proxyUrl, targetHost) {
    try {
      const testUrl = `${proxyUrl}/api/health`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000 // 10秒超时
      });
      
      if (response.ok) {
        const healthData = await response.json();
        return {
          success: true,
          latency: Date.now() - startTime,
          data: healthData
        };
      }
      
      return {
        success: false,
        error: `HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false, 
        error: error.message
      };
    }
  }

  /**
   * 改进的代理URL包装方法
   */
  wrapWithProxy(url, sourceId, options = {}) {
    if (!this.shouldUseProxy(sourceId, options.userRegion)) {
      return url;
    }

    try {
      const targetUrl = new URL(url);
      const proxyBaseUrl = options.customProxy || 
                          this.selectBestProxy(sourceId, options.userRegion) || 
                          this.proxyConfig.baseUrl;
      
      if (!proxyBaseUrl) {
        console.warn('没有可用的代理服务器，使用原始URL');
        return url;
      }
      
      // 验证目标域名是否被允许
      if (!this.isAllowedProxyTarget(targetUrl.hostname)) {
        console.warn('目标域名不在代理白名单中:', targetUrl.hostname);
        return url;
      }
      
      const proxyUrl = new URL(proxyBaseUrl);
      
      // 修复：确保路径正确处理，避免双斜杠问题
      const targetPath = targetUrl.pathname === '/' ? '' : targetUrl.pathname;
      proxyUrl.pathname = `/proxy/${targetUrl.hostname}${targetPath}`;
      proxyUrl.search = targetUrl.search;
      proxyUrl.hash = targetUrl.hash;
      
      return proxyUrl.toString();
      
    } catch (error) {
      console.error('包装代理URL失败:', error);
      return url;
    }
  }

  // 执行搜索 - 集成后端状态检查
  async performSearch(keyword, options = {}) {
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    // 初始化代理配置
    await this.initProxyConfig();

    // 获取用户设置
    let useCache = options.useCache;
    if (useCache === undefined) {
      try {
        if (authManager.isAuthenticated()) {
          const userSettings = await this.getUserSettings();
          useCache = userSettings.cacheResults !== false;
        } else {
          useCache = true;
        }
      } catch (error) {
        console.warn('获取缓存设置失败，使用默认值:', error);
        useCache = true;
      }
    }

    const { saveToHistory = true } = options;

    // 检查搜索结果缓存
    if (useCache) {
      const cached = this.getCachedResults(keyword);
      if (cached) {
        showToast('使用缓存结果', 'info', 2000);
        return cached;
      }
    }

    // 获取用户的搜索源状态检查设置
    let shouldCheckStatus = false;
    let userSettings = null;
    
    try {
      if (authManager.isAuthenticated()) {
        userSettings = await this.getUserSettings();
        shouldCheckStatus = userSettings.checkSourceStatus === true;
      }
    } catch (error) {
      console.warn('获取状态检查设置失败:', error);
    }

    // 构建搜索结果
    const results = await this.buildSearchResults(keyword, {
      checkStatus: shouldCheckStatus,
      userSettings
    });

    // 缓存结果
    if (useCache) {
      this.cacheResults(keyword, results);
    }

    // 保存到搜索历史
    if (saveToHistory && authManager.isAuthenticated()) {
      this.saveToHistory(keyword).catch(console.error);
    }

    return results;
  }
  
  // 统一的用户设置获取方法
  async getUserSettings() {
    if (!this.userSettings || Date.now() - this.userSettings.timestamp > 60000) {
      try {
        const settings = await apiService.getUserSettings();
        this.userSettings = {
          data: settings,
          timestamp: Date.now()
        };
      } catch (error) {
        console.error('获取用户设置失败:', error);
        throw error;
      }
    }
    return this.userSettings.data;
  }
  
  // 清除用户设置缓存
  clearUserSettingsCache() {
    this.userSettings = null;
    console.log('用户设置缓存已清除');
  }
  
  // 获取可用的搜索源（通过API动态获取）
  async getEnabledSearchSources(options = {}) {
    const { 
      includeNonSearchable = false,  // 是否包含非搜索源
      keyword = ''                   // 搜索关键词（用于智能判断）
    } = options;

    try {
      // 检查缓存
      if (this.sourcesCache && 
          Date.now() - this.sourcesCacheTimestamp < this.sourcesCacheExpiry) {
        console.log('使用搜索源缓存');
        return this.filterAndSortSources(this.sourcesCache, includeNonSearchable, keyword);
      }

      // 如果用户未登录，使用系统默认配置
      if (!authManager.isAuthenticated()) {
        console.log('用户未登录，使用系统默认搜索源');
        const defaultSources = await this.getSystemDefaultSources();
        return this.filterAndSortSources(defaultSources, includeNonSearchable, keyword);
      }

      // 获取用户的搜索源配置
      let sources;
      try {
        sources = await searchSourcesAPI.getSearchSources({
          includeSystem: true,
          enabledOnly: true
        });
        console.log(`从API获取到 ${sources.length} 个已启用的搜索源`);
      } catch (error) {
        console.error('获取用户搜索源失败，使用系统默认:', error);
        const defaultSources = await this.getSystemDefaultSources();
        return this.filterAndSortSources(defaultSources, includeNonSearchable, keyword);
      }

      // 缓存搜索源
      this.sourcesCache = sources;
      this.sourcesCacheTimestamp = Date.now();
      
      return this.filterAndSortSources(sources, includeNonSearchable, keyword);
      
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      // 最终回退：使用硬编码的默认源
      const fallbackSources = await this.getFallbackSources();
      return this.filterAndSortSources(fallbackSources, includeNonSearchable, keyword);
    }
  }

  // 获取系统默认搜索源
  async getSystemDefaultSources() {
    try {
      // 从搜索源API获取系统默认配置
      const allSources = await searchSourcesAPI.getSearchSources({
        includeSystem: true,
        searchable: true
      });
      
      // 返回默认推荐的搜索源
      const defaultSourceIds = ['javbus', 'javdb', 'javlibrary', 'btsow'];
      return allSources.filter(source => defaultSourceIds.includes(source.id));
    } catch (error) {
      console.error('获取系统默认搜索源失败:', error);
      return this.getFallbackSources();
    }
  }

  // 获取回退搜索源（硬编码最小集合）
  async getFallbackSources() {
    // 最小可用搜索源集合，仅用于紧急情况
    return [
      {
        id: 'javbus',
        name: 'JavBus',
        subtitle: '番号+磁力一体站,信息完善',
        icon: '🎬',
        urlTemplate: 'https://www.javbus.com/search/{keyword}',
        searchable: true,
        siteType: 'search',
        searchPriority: 1,
        requiresKeyword: true,
        isSystem: true,
        userEnabled: true
      },
      {
        id: 'javdb',
        name: 'JavDB',
        subtitle: '极简风格番号资料站,轻量快速',
        icon: '📚',
        urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
        searchable: true,
        siteType: 'search',
        searchPriority: 2,
        requiresKeyword: true,
        isSystem: true,
        userEnabled: true
      }
    ];
  }

  // 过滤和排序搜索源
  filterAndSortSources(sources, includeNonSearchable, keyword) {
    let filteredSources = [...sources];
    
    // 如果不包含非搜索源，过滤掉 searchable: false 的源
    if (!includeNonSearchable) {
      filteredSources = filteredSources.filter(source => source.searchable !== false);
    }
    
    // 只保留可用的搜索源
    filteredSources = filteredSources.filter(source => source.userEnabled !== false);
    
    // 根据搜索优先级排序
    filteredSources.sort((a, b) => {
      const priorityA = a.searchPriority || a.priority || 99;
      const priorityB = b.searchPriority || b.priority || 99;
      return priorityA - priorityB;
    });
    
    // 智能模式：如果关键词不像番号，调整源的优先级
    if (keyword && !this.looksLikeProductCode(keyword)) {
      // 对于普通关键词，优先使用通用搜索引擎
      filteredSources = filteredSources.sort((a, b) => {
        // 如果源支持通用搜索，提升优先级
        if (a.supportsGeneralSearch && !b.supportsGeneralSearch) return -1;
        if (!a.supportsGeneralSearch && b.supportsGeneralSearch) return 1;
        return 0;
      });
    }
    
    return filteredSources;
  }

  // 判断是否像番号的辅助方法
  looksLikeProductCode(keyword) {
    // 番号通常格式: ABC-123, MIMK-186 等
    const productCodePattern = /^[A-Z]{2,6}-?\d{3,6}$/i;
    return productCodePattern.test(keyword.trim());
  }

  // 构建搜索结果 - 使用新的搜索源API
  async buildSearchResults(keyword, options = {}) {
    const encodedKeyword = encodeURIComponent(keyword);
    const timestamp = Date.now();
    const { checkStatus = false, userSettings = null } = options;
    
    try {
      // 获取搜索源时，根据关键词类型决定
      const enabledSources = await this.getEnabledSearchSources({
        includeNonSearchable: false,  // 搜索时不包含浏览站
        keyword: keyword
      });
      
      console.log(`使用 ${enabledSources.length} 个搜索源进行搜索:`, enabledSources.map(s => s.name));
      
      // 如果启用了状态检查，使用后端检查器
      let sourcesWithStatus = enabledSources;
      if (checkStatus && userSettings) {
        console.log('开始后端状态检查...');
        this.updateCheckStats('started');
        
        try {
          // 使用后端检查器，传入实际的搜索关键词以进行内容匹配检查
          const checkResults = await backendSourceChecker.checkMultipleSources(
            enabledSources, 
            userSettings,
            keyword // 传入实际关键词进行精确内容匹配
          );
          
          // 处理检查结果
          sourcesWithStatus = this.processStatusCheckResults(enabledSources, checkResults, userSettings);
          
          this.updateCheckStats('completed', checkResults);
          
          console.log(`后端状态检查完成: ${sourcesWithStatus.length}/${enabledSources.length} 个源可用`);
          
        } catch (error) {
          console.error('后端状态检查失败:', error);
          this.updateCheckStats('failed');
          showToast('搜索源状态检查失败，使用默认配置', 'warning', 3000);
        }
      }
      
      return this.buildResultsFromSources(sourcesWithStatus, keyword, encodedKeyword, timestamp);
      
    } catch (error) {
      console.error('构建搜索结果失败:', error);
      // 增强错误处理：如果获取搜索源失败，使用回退源
      const fallbackSources = await this.getFallbackSources();
      
      return this.buildResultsFromSources(fallbackSources, keyword, encodedKeyword, timestamp);
    }
  }

  // 处理状态检查结果方法 - 不再过滤不可用源，而是保留所有源
  processStatusCheckResults(originalSources, checkResults, userSettings) {
    const sourcesMap = new Map(originalSources.map(s => [s.id, s]));
    const processedSources = [];
    
    checkResults.forEach(({ source, result }) => {
      const originalSource = sourcesMap.get(source.id);
      if (!originalSource) {
        console.warn(`未找到原始搜索源: ${source.id}`);
        return;
      }
      
      const processedSource = {
        ...originalSource,
        status: result.status,
        statusText: this.getStatusText(result.status),
        errorMessage: result.error || null,
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore || 0,
        verified: result.verified || result.contentMatch || false,
        contentMatch: result.contentMatch || false,
        qualityScore: result.qualityScore || 0,
        fromCache: result.fromCache || false,
        unavailableReason: this.getUnavailableReason(result)
      };
      
      // 修改：不再根据skipUnavailableSources过滤，保留所有源
      processedSources.push(processedSource);
    });
    
    const availableCount = processedSources.filter(s => 
      s.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
    ).length;
    
    console.log(`状态检查完成: ${availableCount}/${checkResults.length} 个搜索源可用`);
    
    // 按状态排序 - 可用的源在前，不可用的在后
    return this.sortSourcesByAvailability(processedSources);
  }

  // 根据可用性排序搜索源
  sortSourcesByAvailability(sources) {
    return sources.sort((a, b) => {
      // 优先级：可用 > 未知 > 超时 > 不可用 > 错误
      const statusPriority = {
        [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 0,
        [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: 1,
        [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 2,
        [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 3,
        [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 4,
        [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: 5
      };

      const priorityA = statusPriority[a.status] ?? 99;
      const priorityB = statusPriority[b.status] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // 同等状态下，按响应时间排序（响应快的在前）
      if (a.responseTime && b.responseTime) {
        return a.responseTime - b.responseTime;
      }

      // 最后按内容匹配度排序
      if (a.contentMatch && !b.contentMatch) return -1;
      if (!a.contentMatch && b.contentMatch) return 1;

      return 0;
    });
  }

  // 获取不可用原因的详细描述
  getUnavailableReason(result) {
    if (result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
      return null;
    }

    const reasons = [];
    
    switch (result.status) {
      case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
        reasons.push('连接超时');
        if (result.responseTime > 10000) {
          reasons.push(`响应时间过长 (${Math.round(result.responseTime/1000)}秒)`);
        }
        break;
      
      case APP_CONSTANTS.SOURCE_STATUS.ERROR:
        if (result.httpStatus) {
          reasons.push(`HTTP错误 ${result.httpStatus}`);
        }
        if (result.error) {
          reasons.push(result.error);
        } else {
          reasons.push('服务器错误');
        }
        break;
      
      case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
        reasons.push('服务不可用');
        if (result.httpStatus === 404) {
          reasons.push('页面不存在');
        } else if (result.httpStatus >= 500) {
          reasons.push('服务器内部错误');
        }
        break;
      
      default:
        if (result.error) {
          reasons.push(result.error);
        } else {
          reasons.push('未知原因');
        }
    }

    return reasons.length > 0 ? reasons.join('，') : '检查失败';
  }

  // 从搜索源构建结果 - 添加代理URL包装
  buildResultsFromSources(sources, keyword, encodedKeyword, timestamp) {
    return sources.map(source => {
      const originalUrl = source.urlTemplate.replace('{keyword}', encodedKeyword);
      
      // 应用代理包装
      const proxyUrl = this.wrapWithProxy(originalUrl, source.id);
      
      const result = {
        id: `result_${keyword}_${source.id}_${timestamp}`,
        title: source.name,
        subtitle: source.subtitle,
        url: proxyUrl, // 使用代理URL
        originalUrl: originalUrl, // 保留原始URL供直连选项使用
        icon: source.icon,
        keyword: keyword,
        timestamp: timestamp,
        source: source.id,
        needsProxy: this.shouldUseProxy(source.id), // 标记是否需要代理
        proxyUsed: proxyUrl !== originalUrl // 标记是否实际使用了代理
      };
      
      // 如果进行了状态检查，添加状态信息
      if (source.status) {
        result.status = source.status;
        result.statusText = source.statusText;
        result.errorMessage = source.errorMessage;
        result.unavailableReason = source.unavailableReason;
        result.lastChecked = source.lastChecked;
        result.responseTime = source.responseTime;
        result.availabilityScore = source.availabilityScore;
        result.verified = source.verified;
        result.contentMatch = source.contentMatch;
        result.qualityScore = source.qualityScore;
        result.fromCache = source.fromCache;
      }
      
      return result;
    });
  }

  // 更新检查统计
  updateCheckStats(action, checkResults = null) {
    switch (action) {
      case 'started':
        this.checkStats.totalChecks++;
        this.checkStats.backendCalls++;
        break;
      case 'completed':
        if (checkResults) {
          const successful = checkResults.filter(cr => 
            cr.result && cr.result.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE
          ).length;
          this.checkStats.successfulChecks += successful;
          
          // 计算平均响应时间
          const responseTimes = checkResults
            .map(cr => cr.result?.responseTime)
            .filter(time => time && time > 0);
          
          if (responseTimes.length > 0) {
            const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            this.checkStats.averageResponseTime = Math.round(
              (this.checkStats.averageResponseTime + avgTime) / 2
            );
          }
        }
        break;
      case 'failed':
        this.checkStats.failedChecks++;
        break;
    }
  }

  // 获取状态文本描述
  getStatusText(status) {
    const statusTexts = {
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '未知',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '检查中',
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '可用',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '不可用',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '超时',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '错误'
    };
    
    return statusTexts[status] || '未知';
  }

  // 使用后端API手动检查所有搜索源状态
  async checkAllSourcesStatus() {
    try {
      const userSettings = await this.getUserSettings();
      const enabledSources = await this.getEnabledSearchSources();
      
      console.log('手动检查所有搜索源状态...');
      
      // 使用后端检查器
      const checkResults = await backendSourceChecker.checkMultipleSources(
        enabledSources, 
        userSettings
      );
      
      // 处理结果并返回状态摘要
      const statusSummary = {
        total: checkResults.length,
        available: 0,
        unavailable: 0,
        timeout: 0,
        error: 0,
        averageResponseTime: 0,
        sources: []
      };
      
      let totalResponseTime = 0;
      let validResponseCount = 0;
      
      checkResults.forEach(({ source, result }) => {
        const sourceResult = {
          id: source.id,
          name: source.name,
          status: result.status,
          statusText: this.getStatusText(result.status),
          unavailableReason: this.getUnavailableReason(result),
          lastChecked: result.lastChecked,
          responseTime: result.responseTime || 0,
          availabilityScore: result.availabilityScore || 0,
          verified: result.verified || false,
          contentMatch: result.contentMatch || false,
          fromCache: result.fromCache || false
        };
        
        statusSummary.sources.push(sourceResult);
        
        // 统计各状态数量
        switch (result.status) {
          case APP_CONSTANTS.SOURCE_STATUS.AVAILABLE:
            statusSummary.available++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
            statusSummary.unavailable++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
            statusSummary.timeout++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.ERROR:
            statusSummary.error++;
            break;
        }
        
        // 计算平均响应时间
        if (result.responseTime && result.responseTime > 0) {
          totalResponseTime += result.responseTime;
          validResponseCount++;
        }
      });
      
      if (validResponseCount > 0) {
        statusSummary.averageResponseTime = Math.round(totalResponseTime / validResponseCount);
      }
      
      console.log('所有搜索源状态检查完成:', statusSummary);
      
      // 更新统计信息
      this.updateCheckStats('completed', checkResults);
      
      return statusSummary;
    } catch (error) {
      console.error('检查所有搜索源状态失败:', error);
      this.updateCheckStats('failed');
      throw error;
    }
  }

  // 检查单个搜索源状态
  async checkSingleSourceStatus(sourceId) {
    try {
      const enabledSources = await this.getEnabledSearchSources();
      const source = enabledSources.find(s => s.id === sourceId);
      
      if (!source) {
        throw new Error(`未找到搜索源: ${sourceId}`);
      }
      
      const userSettings = await this.getUserSettings();
      
      // 使用后端检查器
      const result = await backendSourceChecker.checkSourceStatus(source, userSettings);
      
      return {
        id: source.id,
        name: source.name,
        status: result.status,
        statusText: this.getStatusText(result.status),
        unavailableReason: this.getUnavailableReason(result),
        lastChecked: result.lastChecked,
        responseTime: result.responseTime || 0,
        availabilityScore: result.availabilityScore || 0,
        verified: result.verified || false,
        contentMatch: result.contentMatch || false,
        checkDetails: result.checkDetails || {},
        fromCache: result.fromCache || false
      };
    } catch (error) {
      console.error(`检查搜索源 ${sourceId} 状态失败:`, error);
      throw error;
    }
  }

  // 代理相关的新方法

  /**
   * 更新代理配置
   */
  async updateProxyConfig(config) {
    this.proxyConfig = { ...this.proxyConfig, ...config };
    
    // 如果用户已登录，保存代理设置到用户配置
    if (authManager.isAuthenticated()) {
      try {
        await apiService.updateUserSettings({
          enableProxy: this.proxyConfig.enabled,
          proxiedSources: Array.from(this.proxyConfig.needsProxy),
          intelligentProxyRouting: this.proxyConfig.intelligentRouting,
          userRegion: this.proxyConfig.userRegion
        });
        console.log('代理配置已保存到用户设置');
      } catch (error) {
        console.error('保存代理配置失败:', error);
      }
    }
  }

  /**
   * 获取代理配置
   */
  getProxyConfig() {
    return { ...this.proxyConfig };
  }

  /**
   * 切换源的代理使用
   */
  async toggleSourceProxy(sourceId, useProxy) {
    if (useProxy) {
      this.proxyConfig.needsProxy.add(sourceId);
    } else {
      this.proxyConfig.needsProxy.delete(sourceId);
    }
    
    await this.updateProxyConfig({});
    console.log(`源 ${sourceId} 代理设置已${useProxy ? '启用' : '禁用'}`);
  }

  /**
   * 获取代理统计信息
   */
  getProxyStats() {
    return {
      enabled: this.proxyConfig.enabled,
      proxiedSourcesCount: this.proxyConfig.needsProxy.size,
      proxiedSources: Array.from(this.proxyConfig.needsProxy),
      intelligentRouting: this.proxyConfig.intelligentRouting,
      userRegion: this.proxyConfig.userRegion,
      baseUrl: this.proxyConfig.baseUrl,
      allowedTargetsCount: this.proxyConfig.allowedTargets.length
    };
  }

  // 清除搜索源缓存
  clearSourcesCache() {
    this.sourcesCache = null;
    this.sourcesCacheTimestamp = 0;
    // 同时清除搜索源API的缓存
    searchSourcesAPI.clearCache();
    console.log('搜索源缓存已清除');
  }

  // 清除搜索源状态缓存
  clearSourceStatusCache() {
    backendSourceChecker.clearCache();
    console.log('搜索源状态缓存已清除');
  }

  // 获取搜索源状态检查统计
  getStatusCheckStats() {
    return {
      ...this.checkStats,
      checkerStats: backendSourceChecker.getCheckingStats()
    };
  }

  // 获取缓存结果
  getCachedResults(keyword) {
    const cached = this.searchCache.get(keyword);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiration) {
      return cached.results;
    }
    
    // 清理过期缓存
    if (cached) {
      this.searchCache.delete(keyword);
    }
    
    return null;
  }

  // 缓存搜索结果
  cacheResults(keyword, results) {
    // 限制缓存大小
    if (this.searchCache.size >= 100) {
      // 删除最旧的缓存项
      const firstKey = this.searchCache.keys().next().value;
      this.searchCache.delete(firstKey);
    }
    
    this.searchCache.set(keyword, {
      results,
      timestamp: Date.now()
    });
  }

  // 保存到搜索历史
  async saveToHistory(keyword) {
    try {
      await apiService.saveSearchHistory(keyword, 'manual');
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }

  // 获取搜索建议
  getSearchSuggestions(query, history = []) {
    if (!query || typeof query !== 'string') return [];
    
    return history
      .filter(item => {
        if (!item) return false;
        
        const searchTerm = item.keyword || item.query;
        if (!searchTerm || typeof searchTerm !== 'string') {
          return false;
        }
        
        return searchTerm.toLowerCase().includes(query.toLowerCase());
      })
      .slice(0, 5);
  }

  // 清理搜索缓存
  clearCache() {
    this.searchCache.clear();
    console.log('搜索缓存已清理');
  }

  // 清理所有缓存
  clearAllCache() {
    this.searchCache.clear();
    this.clearSourcesCache();
    this.clearSourceStatusCache();
    console.log('所有缓存已清理');
  }

  // 获取缓存统计
  getCacheStats() {
    const stats = {
      searchCache: {
        size: this.searchCache.size,
        items: []
      },
      sourcesCache: {
        size: this.sourcesCache ? this.sourcesCache.length : 0,
        timestamp: this.sourcesCacheTimestamp,
        expired: Date.now() - this.sourcesCacheTimestamp > this.sourcesCacheExpiry
      }
    };
    
    // 搜索结果缓存统计
    for (const [keyword, data] of this.searchCache) {
      stats.searchCache.items.push({
        keyword,
        timestamp: data.timestamp,
        age: Date.now() - data.timestamp,
        expired: Date.now() - data.timestamp > this.cacheExpiration
      });
    }
    
    return stats;
  }

  // 预热缓存（预加载常用搜索）
  async warmupCache(keywords = []) {
    for (const keyword of keywords) {
      try {
        const results = await this.buildSearchResults(keyword);
        this.cacheResults(keyword, results);
        console.log(`缓存预热: ${keyword}`);
      } catch (error) {
        console.error(`缓存预热失败 ${keyword}:`, error);
      }
    }
  }

  // 预热搜索源缓存
  async warmupSourcesCache() {
    try {
      console.log('开始预热搜索源缓存...');
      await this.getEnabledSearchSources();
      console.log('搜索源缓存预热完成');
    } catch (error) {
      console.error('搜索源缓存预热失败:', error);
    }
  }

  // 导出搜索服务状态
  exportServiceStatus() {
    return {
      type: 'enhanced-search-service-with-proxy',
      cacheStats: this.getCacheStats(),
      checkStats: this.getStatusCheckStats(),
      proxyStats: this.getProxyStats(),
      userSettings: this.userSettings,
      sourcesCache: {
        size: this.sourcesCache ? this.sourcesCache.length : 0,
        timestamp: this.sourcesCacheTimestamp,
        expired: Date.now() - this.sourcesCacheTimestamp > this.sourcesCacheExpiry
      },
      timestamp: Date.now(),
      version: '2.4.0' // 更新版本号包含代理功能
    };
  }

  // 获取搜索源管理器实例（用于UI组件）
  getSearchSourcesAPI() {
    return searchSourcesAPI;
  }

  // 刷新搜索源配置
  async refreshSearchSources() {
    this.clearSourcesCache();
    this.clearUserSettingsCache();
    console.log('搜索源配置已刷新');
  }
}

// 搜索历史管理器（保持不变）
export class SearchHistoryManager {
  constructor() {
    this.maxHistorySize = APP_CONSTANTS.LIMITS.MAX_HISTORY;
  }

  // 添加到历史记录
  async addToHistory(keyword, source = 'manual') {
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      console.warn('无效的搜索关键词，跳过添加到历史');
      return;
    }

    try {
      await apiService.saveSearchHistory(keyword.trim(), source);
      return true;
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      return false;
    }
  }

  // 获取搜索历史
  async getHistory() {
    try {
      return await apiService.getSearchHistory();
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      return [];
    }
  }

  // 删除历史记录项
  async deleteHistoryItem(historyId) {
    try {
      await apiService.deleteSearchHistory(historyId);
      return true;
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      return false;
    }
  }

  // 清空所有历史记录
  async clearAllHistory() {
    try {
      await apiService.clearAllSearchHistory();
      return true;
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      return false;
    }
  }

  // 获取搜索统计
  async getSearchStats() {
    try {
      return await apiService.getSearchStats();
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return { total: 0, today: 0, thisWeek: 0, topQueries: [] };
    }
  }

  // 搜索历史去重
  deduplicateHistory(history) {
    const seen = new Set();
    return history.filter(item => {
      const key = item.keyword || item.query;
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  // 按时间排序历史记录
  sortHistoryByTime(history, descending = true) {
    return history.sort((a, b) => {
      const timeA = a.timestamp || a.createdAt || 0;
      const timeB = b.timestamp || b.createdAt || 0;
      return descending ? timeB - timeA : timeA - timeB;
    });
  }

  // 按频率排序历史记录
  sortHistoryByFrequency(history, descending = true) {
    return history.sort((a, b) => {
      const countA = a.count || 1;
      const countB = b.count || 1;
      return descending ? countB - countA : countA - countB;
    });
  }
}

// 创建服务实例
export const searchService = new SearchService();
export const searchHistoryManager = new SearchHistoryManager();
export default searchService;