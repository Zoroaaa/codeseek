// 高级搜索源可用性检查器 - 完整版本
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';
import { showToast } from '../utils/dom.js';

export default class AdvancedSourceChecker {
  constructor() {
    this.statusCache = new Map();
    this.contentCache = new Map();
    this.reliabilityMatrix = new Map();
    this.performanceMetrics = new Map();
    
    // 检测层级定义
    this.checkLevels = {
      BASIC: 'basic',
      FUNCTIONAL: 'functional',
      CONTENT: 'content',
      DEEP: 'deep'
    };
    
    // 可用性等级定义
    this.availabilityLevels = {
      EXCELLENT: { level: 5, name: '优秀', color: '#10b981', threshold: 0.9 },
      GOOD: { level: 4, name: '良好', color: '#3b82f6', threshold: 0.75 },
      MODERATE: { level: 3, name: '一般', color: '#f59e0b', threshold: 0.5 },
      POOR: { level: 2, name: '较差', color: '#f97316', threshold: 0.25 },
      FAILING: { level: 1, name: '故障', color: '#ef4444', threshold: 0 }
    };
    
    // 测试关键词池
    this.testKeywords = {
      primary: ['MIMK-138', 'SSIS-123', 'IPX-789'],
      secondary: ['julia', 'yua mikami', 'ai sayama'],
      fallback: ['test', '001', 'av']
    };
    
    // 智能缓存配置
    this.cacheConfig = {
      basic: 300000,
      functional: 600000,
      content: 900000,
      deep: 1800000
    };
  }

  /**
   * 主检测入口 - 多层次检测
   */
  async checkSourcesWithLevels(sources, options = {}) {
    const {
      level = this.checkLevels.FUNCTIONAL,
      keyword = null,
      timeout = 15000,
      useCache = true,
      showProgress = true,
      parallel = true
    } = options;

    if (showProgress) {
      showToast(`开始${this.getLevelName(level)}检测...`, 'info');
    }

    const results = parallel ? 
      await this.parallelCheck(sources, { level, keyword, timeout, useCache }) :
      await this.sequentialCheck(sources, { level, keyword, timeout, useCache });

    const enhancedResults = results.map(result => 
      this.calculateAvailabilityLevel(result)
    );

    if (showProgress) {
      this.showEnhancedSummary(enhancedResults);
    }

    return enhancedResults;
  }

  /**
   * 单个搜索源的多层次检测
   */
  async checkSingleSourceAdvanced(source, options = {}) {
    const { level, keyword, timeout, useCache } = options;
    
    if (useCache) {
      const cached = this.getAdvancedCache(source.id, level);
      if (cached) return cached;
    }

    const checkId = generateId();
    const startTime = Date.now();
    
    try {
      let result = { ...source, checkId, checkLevel: level };
      
      // 基础连通性检测
      const basicResult = await this.performBasicCheck(source, timeout / 4);
      result = { ...result, ...basicResult };
      
      if (!basicResult.basicConnectivity && level === this.checkLevels.BASIC) {
        return this.finalizeResult(result, startTime, checkId);
      }

      // 功能性检测
      if (level === this.checkLevels.FUNCTIONAL || level === this.checkLevels.CONTENT || level === this.checkLevels.DEEP) {
        const functionalResult = await this.performFunctionalCheck(source, timeout / 4);
        result = { ...result, ...functionalResult };
        
        if (!functionalResult.functionalAvailable && level === this.checkLevels.FUNCTIONAL) {
          return this.finalizeResult(result, startTime, checkId);
        }
      }

      // 内容匹配检测
      if (level === this.checkLevels.CONTENT || level === this.checkLevels.DEEP) {
        const contentResult = await this.performContentCheck(source, keyword, timeout / 2);
        result = { ...result, ...contentResult };
        
        if (level === this.checkLevels.CONTENT) {
          return this.finalizeResult(result, startTime, checkId);
        }
      }

      // 深度验证检测
      if (level === this.checkLevels.DEEP) {
        const deepResult = await this.performDeepCheck(source, keyword, timeout / 2);
        result = { ...result, ...deepResult };
      }

      return this.finalizeResult(result, startTime, checkId);

    } catch (error) {
      return this.handleCheckError(source, error, startTime, checkId);
    }
  }

  /**
   * 基础连通性检测
   */
  async performBasicCheck(source, timeout) {
    const checks = await Promise.allSettled([
      this.checkDomainResolution(source),
      this.checkHttpResponse(source, 'HEAD', timeout),
      this.checkStaticResources(source, timeout)
    ]);

    const successCount = checks.filter(c => c.status === 'fulfilled' && c.value.success).length;
    const basicScore = successCount / checks.length;
    
    return {
      basicConnectivity: basicScore > 0.3,
      basicScore,
      domainResolved: checks[0].status === 'fulfilled' ? checks[0].value.success : false,
      httpResponsive: checks[1].status === 'fulfilled' ? checks[1].value.success : false,
      staticResourcesOk: checks[2].status === 'fulfilled' ? checks[2].value.success : false,
      basicDetails: {
        domainCheck: checks[0].status === 'fulfilled' ? checks[0].value : { success: false },
        httpCheck: checks[1].status === 'fulfilled' ? checks[1].value : { success: false },
        staticCheck: checks[2].status === 'fulfilled' ? checks[2].value : { success: false }
      }
    };
  }

  /**
   * 功能性检测 - 测试搜索功能
   */
  async performFunctionalCheck(source, timeout) {
    const testResults = [];
    
    for (const keyword of this.testKeywords.fallback) {
      try {
        const searchUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(keyword));
        const result = await this.testSearchFunction(searchUrl, timeout / this.testKeywords.fallback.length);
        testResults.push({ keyword, ...result });
        
        if (result.searchFunctional) break;
        
      } catch (error) {
        testResults.push({ keyword, success: false, error: error.message });
      }
    }

    const functionalTests = testResults.filter(r => r.searchFunctional).length;
    const functionalScore = functionalTests / Math.min(testResults.length, 3);

    return {
      functionalAvailable: functionalScore > 0,
      functionalScore,
      searchTests: testResults,
      searchCapability: functionalTests > 0
    };
  }

  /**
   * 内容匹配检测 - 验证特定关键词搜索结果
   */
  async performContentCheck(source, targetKeyword, timeout) {
    if (!targetKeyword) {
      targetKeyword = this.testKeywords.primary[0];
    }

    const searchUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(targetKeyword));
    
    try {
      const contentResult = await this.analyzeSearchContent(searchUrl, targetKeyword, timeout);
      
      return {
        contentMatched: contentResult.hasTargetContent,
        contentScore: contentResult.matchScore,
        contentQuality: contentResult.contentQuality,
        keywordPresence: contentResult.keywordFound,
        estimatedResults: contentResult.estimatedResults,
        contentDetails: contentResult.details,
        targetKeyword
      };
      
    } catch (error) {
      return {
        contentMatched: false,
        contentScore: 0,
        contentError: error.message,
        targetKeyword
      };
    }
  }

  /**
   * 深度验证检测 - 多关键词验证和质量评估
   */
  async performDeepCheck(source, targetKeyword, timeout) {
    const deepTests = [];
    const allKeywords = [
      ...(targetKeyword ? [targetKeyword] : []),
      ...this.testKeywords.primary.slice(0, 2),
      ...this.testKeywords.secondary.slice(0, 1)
    ];

    for (const keyword of allKeywords) {
      try {
        const searchUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(keyword));
        const analysis = await this.deepContentAnalysis(searchUrl, keyword, timeout / allKeywords.length);
        deepTests.push({ keyword, ...analysis });
      } catch (error) {
        deepTests.push({ keyword, success: false, error: error.message });
      }
    }

    const successfulTests = deepTests.filter(t => t.contentRelevant).length;
    const deepScore = successfulTests / allKeywords.length;
    const qualityMetrics = this.calculateQualityMetrics(deepTests);

    return {
      deepVerified: deepScore > 0.5,
      deepScore,
      qualityMetrics,
      multiKeywordTests: deepTests,
      overallQuality: this.assessOverallQuality(deepTests)
    };
  }

  /**
   * 分析搜索内容 - 核心内容匹配逻辑
   */
  async analyzeSearchContent(url, keyword, timeout) {
    try {
      const response = await this.fetchWithProxy(url, {
        method: 'GET',
        timeout,
        followRedirects: true
      });

      if (!response.ok) {
        return { hasTargetContent: false, matchScore: 0, error: 'HTTP_ERROR' };
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return { hasTargetContent: false, matchScore: 0, error: 'NOT_HTML' };
      }

      const htmlContent = await response.text();
      return this.analyzeHtmlContent(htmlContent, keyword, url);

    } catch (error) {
      if (error.name === 'AbortError') {
        return { hasTargetContent: false, matchScore: 0, error: 'TIMEOUT' };
      }
      return { hasTargetContent: false, matchScore: 0, error: error.message };
    }
  }

  /**
   * HTML内容分析
   */
  analyzeHtmlContent(html, keyword, url) {
    const analysis = {
      hasTargetContent: false,
      matchScore: 0,
      keywordFound: false,
      estimatedResults: 0,
      contentQuality: 'unknown',
      details: {}
    };

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const textContent = doc.body ? doc.body.textContent.toLowerCase() : html.toLowerCase();
      const keywordLower = keyword.toLowerCase();
      
      // 1. 直接关键词匹配
      const directMatches = (textContent.match(new RegExp(keywordLower, 'g')) || []).length;
      analysis.keywordFound = directMatches > 0;
      analysis.details.directMatches = directMatches;

      // 2. 标题中的关键词
      const title = doc.title.toLowerCase();
      const titleMatch = title.includes(keywordLower);
      analysis.details.titleMatch = titleMatch;

      // 3. 搜索结果数量估算
      analysis.estimatedResults = this.estimateResultCount(html, doc);
      analysis.details.estimatedResults = analysis.estimatedResults;

      // 4. 页面结构分析
      const pageStructure = this.analyzePageStructure(doc);
      analysis.details.pageStructure = pageStructure;

      // 5. 计算匹配分数
      let score = 0;
      if (analysis.keywordFound) score += 0.4;
      if (titleMatch) score += 0.3;
      if (analysis.estimatedResults > 0) score += 0.2;
      if (pageStructure.hasSearchResults) score += 0.1;

      analysis.matchScore = Math.min(score, 1.0);
      analysis.hasTargetContent = analysis.matchScore > 0.3;

      // 6. 内容质量评估
      analysis.contentQuality = this.assessContentQuality(analysis);

      return analysis;

    } catch (error) {
      console.error('HTML内容分析失败:', error);
      return { ...analysis, error: error.message };
    }
  }

  /**
   * 估算搜索结果数量
   */
  estimateResultCount(html, doc) {
    const resultSelectors = [
      '.result', '.search-result', '.item', '.video-item',
      '.movie-item', '.content-item', '[data-id]'
    ];

    let maxCount = 0;
    for (const selector of resultSelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        maxCount = Math.max(maxCount, elements.length);
      } catch (e) {
        // 忽略选择器错误
      }
    }

    // 备用方法：通过文本模式匹配
    if (maxCount === 0) {
      const patterns = [
        /找到\s*(\d+)\s*个结果/i,
        /共\s*(\d+)\s*条/i,
        /(\d+)\s*results?/i,
        /total[:\s]*(\d+)/i
      ];

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          maxCount = Math.max(maxCount, parseInt(match[1]));
        }
      }
    }

    return maxCount;
  }

  /**
   * 页面结构分析
   */
  analyzePageStructure(doc) {
    const structure = {
      hasSearchResults: false,
      hasNavigation: false,
      hasPagination: false,
      hasImages: false,
      hasVideos: false
    };

    // 检测搜索结果结构
    const resultIndicators = [
      '.result', '.search-result', '.video-item', '.movie-item'
    ];
    structure.hasSearchResults = resultIndicators.some(selector => {
      try {
        return doc.querySelectorAll(selector).length > 0;
      } catch (e) {
        return false;
      }
    });

    // 检测导航结构
    const navSelectors = ['.nav', '.navigation', '.menu', 'nav'];
    structure.hasNavigation = navSelectors.some(selector => {
      try {
        return doc.querySelectorAll(selector).length > 0;
      } catch (e) {
        return false;
      }
    });

    // 检测分页结构
    const pageSelectors = ['.pagination', '.pager', '.page-nav'];
    structure.hasPagination = pageSelectors.some(selector => {
      try {
        return doc.querySelectorAll(selector).length > 0;
      } catch (e) {
        return false;
      }
    });

    // 检测媒体内容
    try {
      structure.hasImages = doc.querySelectorAll('img').length > 5;
      structure.hasVideos = doc.querySelectorAll('video').length > 0;
    } catch (e) {
      // 忽略错误
    }

    return structure;
  }

  /**
   * 内容质量评估
   */
  assessContentQuality(analysis) {
    let qualityScore = 0;
    
    if (analysis.matchScore > 0.7) qualityScore += 3;
    else if (analysis.matchScore > 0.4) qualityScore += 2;
    else if (analysis.matchScore > 0.1) qualityScore += 1;

    if (analysis.estimatedResults > 10) qualityScore += 2;
    else if (analysis.estimatedResults > 0) qualityScore += 1;

    if (analysis.details.pageStructure?.hasSearchResults) qualityScore += 1;
    if (analysis.details.titleMatch) qualityScore += 1;

    if (qualityScore >= 6) return 'excellent';
    if (qualityScore >= 4) return 'good';
    if (qualityScore >= 2) return 'moderate';
    return 'poor';
  }

  /**
   * 深度内容分析
   */
  async deepContentAnalysis(url, keyword, timeout) {
    try {
      const contentResult = await this.analyzeSearchContent(url, keyword, timeout);
      
      return {
        contentRelevant: contentResult.hasTargetContent,
        relevanceScore: contentResult.matchScore,
        qualityLevel: contentResult.contentQuality,
        details: contentResult.details
      };
    } catch (error) {
      return {
        contentRelevant: false,
        relevanceScore: 0,
        error: error.message
      };
    }
  }

  /**
   * 计算质量指标
   */
  calculateQualityMetrics(tests) {
    const successful = tests.filter(t => t.contentRelevant).length;
    const total = tests.length;
    
    const avgScore = tests.reduce((sum, t) => sum + (t.relevanceScore || 0), 0) / total;
    
    return {
      successRate: successful / total,
      avgRelevanceScore: avgScore,
      totalTests: total,
      successfulTests: successful
    };
  }

  /**
   * 评估整体质量
   */
  assessOverallQuality(tests) {
    const metrics = this.calculateQualityMetrics(tests);
    
    if (metrics.successRate >= 0.8 && metrics.avgRelevanceScore >= 0.7) {
      return { level: 'excellent', message: '搜索源工作完美，内容匹配度极高' };
    }
    
    if (metrics.successRate >= 0.6 && metrics.avgRelevanceScore >= 0.5) {
      return { level: 'good', message: '搜索源运行良好，内容相关性高' };
    }
    
    if (metrics.successRate >= 0.3 || metrics.avgRelevanceScore >= 0.3) {
      return { level: 'moderate', message: '搜索源基本可用，但内容质量一般' };
    }
    
    return { level: 'poor', message: '搜索源质量较差，建议谨慎使用' };
  }

  /**
   * 测试搜索功能
   */
  async testSearchFunction(url, timeout) {
    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'HEAD',
        timeout
      });

      return {
        success: true,
        searchFunctional: response.ok,
        responseCode: response.status,
        redirected: response.redirected,
        finalUrl: response.url
      };
    } catch (error) {
      return {
        success: false,
        searchFunctional: false,
        error: error.message
      };
    }
  }

  /**
   * 带代理的fetch（用于绕过CORS）
   */
  async fetchWithProxy(url, options = {}) {
    const { timeout = 10000 } = options;
    
    try {
      return await this.fetchWithTimeout(url, {
        ...options,
        mode: 'cors',
        timeout
      });
    } catch (error) {
      if (error.message.includes('cors')) {
        return await this.fallbackImageCheck(url, timeout);
      }
      throw error;
    }
  }

  /**
   * 图片方式备用检测
   */
  async fallbackImageCheck(url, timeout) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        reject(new Error('TIMEOUT'));
      }, timeout);

      img.onload = () => {
        clearTimeout(timer);
        resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve(''),
          headers: new Map()
        });
      };

      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('IMAGE_LOAD_ERROR'));
      };

      img.src = url;
    });
  }

  /**
   * 计算可用性等级
   */
  calculateAvailabilityLevel(result) {
    let totalScore = 0;
    let weights = 0;

    if (result.basicScore !== undefined) {
      totalScore += result.basicScore * 0.2;
      weights += 0.2;
    }

    if (result.functionalScore !== undefined) {
      totalScore += result.functionalScore * 0.3;
      weights += 0.3;
    }

    if (result.contentScore !== undefined) {
      totalScore += result.contentScore * 0.4;
      weights += 0.4;
    }

    if (result.deepScore !== undefined) {
      totalScore += result.deepScore * 0.1;
      weights += 0.1;
    }

    const finalScore = weights > 0 ? totalScore / weights : 0;

    let availabilityLevel = this.availabilityLevels.FAILING;
    for (const [key, level] of Object.entries(this.availabilityLevels)) {
      if (finalScore >= level.threshold) {
        availabilityLevel = level;
        break;
      }
    }

    return {
      ...result,
      finalScore,
      availabilityLevel: availabilityLevel.name,
      availabilityColor: availabilityLevel.color,
      availabilityRank: availabilityLevel.level,
      available: finalScore > 0.25,
      qualityAssessment: this.getQualityAssessment(finalScore)
    };
  }

  /**
   * 获取质量评估
   */
  getQualityAssessment(score) {
    if (score >= 0.9) return { level: 'excellent', message: '搜索源工作完美，内容匹配度极高' };
    if (score >= 0.75) return { level: 'good', message: '搜索源运行良好，内容相关性高' };
    if (score >= 0.5) return { level: 'moderate', message: '搜索源基本可用，但内容质量一般' };
    if (score >= 0.25) return { level: 'poor', message: '搜索源勉强可用，建议谨慎使用' };
    return { level: 'failing', message: '搜索源无法正常工作' };
  }

  /**
   * 显示增强摘要
   */
  showEnhancedSummary(results) {
    const levels = {};
    results.forEach(result => {
      const level = result.availabilityLevel;
      levels[level] = (levels[level] || 0) + 1;
    });

    const excellent = levels['优秀'] || 0;
    const good = levels['良好'] || 0;
    const total = results.length;

    if (excellent + good >= total * 0.7) {
      showToast(`检测完成：${excellent + good}/${total} 个优质源可用`, 'success');
    } else if (excellent + good >= total * 0.4) {
      showToast(`检测完成：${excellent + good}/${total} 个优质源，建议优化`, 'warning');
    } else {
      showToast(`检测完成：仅 ${excellent + good}/${total} 个优质源，需要关注`, 'error');
    }
  }

  /**
   * 并行检测
   */
  async parallelCheck(sources, options) {
    const { level, keyword, timeout, useCache } = options;
    const batchSize = 3;
    const results = [];

    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      const batchPromises = batch.map(source => 
        this.checkSingleSourceAdvanced(source, { level, keyword, timeout, useCache })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      if (i + batchSize < sources.length) {
        await this.delay(300);
      }
    }

    return results;
  }

  /**
   * 串行检测
   */
  async sequentialCheck(sources, options) {
    const results = [];
    for (const source of sources) {
      const result = await this.checkSingleSourceAdvanced(source, options);
      results.push(result);
      await this.delay(100);
    }
    return results;
  }

  /**
   * 获取层级名称
   */
  getLevelName(level) {
    const names = {
      [this.checkLevels.BASIC]: '基础',
      [this.checkLevels.FUNCTIONAL]: '功能',
      [this.checkLevels.CONTENT]: '内容匹配',
      [this.checkLevels.DEEP]: '深度'
    };
    return names[level] || '未知';
  }

  /**
   * 工具方法
   */
  async fetchWithTimeout(url, options = {}) {
    const { timeout = 10000 } = options;
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

  async checkDomainResolution(source) {
    try {
      const hostname = new URL(source.urlTemplate.replace('{keyword}', 'test')).hostname;
      const testUrl = `https://${hostname}/favicon.ico?_t=${Date.now()}`;
      
      const response = await this.fetchWithTimeout(testUrl, { 
        method: 'HEAD', 
        timeout: 3000 
      });
      
      return { success: true, hostname };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkHttpResponse(source, method = 'HEAD', timeout = 5000) {
    try {
      const baseUrl = source.urlTemplate.replace('{keyword}', 'test');
      const response = await this.fetchWithTimeout(baseUrl, { method, timeout });
      
      return {
        success: response.ok,
        status: response.status,
        redirected: response.redirected
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkStaticResources(source, timeout = 5000) {
    try {
      const baseUrl = new URL(source.urlTemplate.replace('{keyword}', 'test')).origin;
      const resources = [`${baseUrl}/favicon.ico`, `${baseUrl}/robots.txt`];
      
      const checks = await Promise.allSettled(
        resources.map(url => this.fetchWithTimeout(url, { method: 'HEAD', timeout: timeout / 2 }))
      );
      
      const successCount = checks.filter(c => 
        c.status === 'fulfilled' && c.value.ok
      ).length;
      
      return { success: successCount > 0, checkedCount: resources.length, successCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  finalizeResult(result, startTime, checkId) {
    return {
      ...result,
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      checkId
    };
  }

  handleCheckError(source, error, startTime, checkId) {
    return {
      ...source,
      available: false,
      error: error.message,
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
      checkId,
      availabilityLevel: '故障',
      availabilityColor: '#ef4444',
      availabilityRank: 1
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 缓存相关方法
  getAdvancedCache(sourceId, level) {
    const cacheKey = `${sourceId}_${level}`;
    const cached = this.statusCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheConfig[level]) {
      return cached.result;
    }
    
    return null;
  }

  setAdvancedCache(sourceId, level, result) {
    const cacheKey = `${sourceId}_${level}`;
    this.statusCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.statusCache.clear();
    this.contentCache.clear();
    this.reliabilityMatrix.clear();
    this.performanceMetrics.clear();
    console.log('高级检查器缓存已清理');
  }

  getStatistics() {
    const cacheStats = Array.from(this.statusCache.values());
    const reliabilityStats = Array.from(this.reliabilityMatrix.entries());

    return {
      cacheSize: this.statusCache.size,
      avgReliability: reliabilityStats.length > 0 ? 
        reliabilityStats.reduce((sum, [_, data]) => 
          sum + (data.successfulChecks / data.totalChecks), 0
        ) / reliabilityStats.length : 0,
      reliabilityData: Object.fromEntries(reliabilityStats),
      performanceMetrics: Object.fromEntries(this.performanceMetrics.entries())
    };
  }

  /**
   * 公共接口方法
   */
  async performAdvancedCheck(sources, keyword, options = {}) {
    return this.checkSourcesWithLevels(sources, {
      level: this.checkLevels.CONTENT,
      keyword,
      ...options
    });
  }

  async performDeepVerification(sources, keyword, options = {}) {
    return this.checkSourcesWithLevels(sources, {
      level: this.checkLevels.DEEP,
      keyword,
      timeout: 20000,
      ...options
    });
  }

  async performBasicConnectivityCheck(sources, options = {}) {
    return this.checkSourcesWithLevels(sources, {
      level: this.checkLevels.BASIC,
      timeout: 5000,
      ...options
    });
  }

  async performFunctionalCheck(sources, options = {}) {
    return this.checkSourcesWithLevels(sources, {
      level: this.checkLevels.FUNCTIONAL,
      timeout: 10000,
      ...options
    });
  }

  /**
   * 计算可靠性评分
   */
  calculateReliability(sourceId, result) {
    const history = this.reliabilityMatrix.get(sourceId) || {
      totalChecks: 0,
      successfulChecks: 0,
      recentChecks: []
    };

    history.totalChecks++;
    if (result.available) {
      history.successfulChecks++;
    }

    history.recentChecks.push({
      timestamp: Date.now(),
      available: result.available,
      responseTime: result.responseTime
    });

    if (history.recentChecks.length > 10) {
      history.recentChecks = history.recentChecks.slice(-10);
    }

    const overallReliability = history.successfulChecks / history.totalChecks;
    const recentReliability = history.recentChecks.filter(c => c.available).length / 
                             Math.min(history.recentChecks.length, 10);

    const reliability = (overallReliability * 0.3) + (recentReliability * 0.7);

    this.reliabilityMatrix.set(sourceId, history);
    
    return Math.round(reliability * 100) / 100;
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(sourceId, responseTime, success) {
    const metrics = this.performanceMetrics.get(sourceId) || {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0
    };

    metrics.totalRequests++;
    metrics.totalResponseTime += responseTime;
    
    if (success) {
      metrics.successfulRequests++;
    }

    metrics.avgResponseTime = metrics.totalResponseTime / metrics.totalRequests;
    metrics.minResponseTime = Math.min(metrics.minResponseTime, responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, responseTime);

    this.performanceMetrics.set(sourceId, metrics);
  }

  /**
   * 检查单个源的可靠性
   */
  async checkSingleSource(source, options = {}) {
    const {
      timeout = 10000,
      useCache = true,
      strategy = 'comprehensive'
    } = options;

    return this.checkSingleSourceAdvanced(source, {
      level: this.checkLevels[strategy.toUpperCase()] || this.checkLevels.FUNCTIONAL,
      timeout,
      useCache,
      keyword: options.keyword
    });
  }

  /**
   * 批量检查源状态
   */
  async checkSourcesAvailability(sources, options = {}) {
    return this.checkSourcesWithLevels(sources, options);
  }

  /**
   * 获取源的历史可靠性数据
   */
  getSourceReliability(sourceId) {
    return this.reliabilityMatrix.get(sourceId) || null;
  }

  /**
   * 获取源的性能指标
   */
  getSourcePerformanceMetrics(sourceId) {
    return this.performanceMetrics.get(sourceId) || null;
  }

  /**
   * 重置源的统计数据
   */
  resetSourceStats(sourceId) {
    this.reliabilityMatrix.delete(sourceId);
    this.performanceMetrics.delete(sourceId);
    
    // 清除相关缓存
    for (const level of Object.values(this.checkLevels)) {
      const cacheKey = `${sourceId}_${level}`;
      this.statusCache.delete(cacheKey);
    }
  }

  /**
   * 导出统计数据
   */
  exportStats() {
    return {
      timestamp: Date.now(),
      cacheSize: this.statusCache.size,
      reliabilityMatrix: Object.fromEntries(this.reliabilityMatrix.entries()),
      performanceMetrics: Object.fromEntries(this.performanceMetrics.entries()),
      version: '1.0.0'
    };
  }

  /**
   * 导入统计数据
   */
  importStats(data) {
    if (data.reliabilityMatrix) {
      this.reliabilityMatrix = new Map(Object.entries(data.reliabilityMatrix));
    }
    
    if (data.performanceMetrics) {
      this.performanceMetrics = new Map(Object.entries(data.performanceMetrics));
    }
  }
}