// src/components/search/DetailExtractionManager.js - 详情提取管理子组件
// 版本 2.0.0 - 适配后端架构升级：支持模块化解析器和动态配置管理

import { APP_CONSTANTS } from '../../core/constants.js';
import { 
  DETAIL_EXTRACTION_STATUS, 
  ARCHITECTURE_FEATURES, 
  SERVICE_STATUS,
  DEFAULT_USER_CONFIG 
} from '../../core/detail-config.js';
import { showToast, showLoading } from '../../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../../utils/format.js';
import detailAPIService from '../../services/detail-api.js';
import detailConfigAPI from '../../services/detail-config-api.js';
import detailCardManager from '../detail-card.js';
import authManager from '../../services/auth.js';
import apiService from '../../services/api.js';

export class DetailExtractionManager {
  constructor() {
    // 基础状态
    this.extractionInProgress = false;
    this.extractionQueue = [];
    this.config = {}; // 用户配置
    this.version = '2.0.0'; // 新架构版本
    
    // 🆕 新架构特性支持
    this.architectureFeatures = Object.values(ARCHITECTURE_FEATURES);
    this.serviceHealth = {
      status: SERVICE_STATUS.HEALTHY,
      lastCheck: 0,
      configService: false,
      extractionService: false
    };
    
    // 🆕 配置管理
    this.configManager = null;
    this.configCache = null;
    this.configLastUpdate = 0;
    this.configCacheExpiration = 5 * 60 * 1000; // 5分钟配置缓存
    
    // 统计信息 - 增强版本
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      partialExtractions: 0,
      cacheHits: 0,
      averageTime: 0,
      totalTime: 0,
      // 🆕 新架构统计
      modularParserExtractions: 0,
      unifiedDataExtractions: 0,
      configAwareExtractions: 0,
      retrySuccessCount: 0
    };
    
    // 进度回调和洞察
    this.progressCallbacks = new Map();
    this.extractionInsights = [];
    
    // 🆕 性能监控
    this.performanceMetrics = {
      extractionTimes: [],
      parserPerformance: new Map(),
      configFetchTimes: [],
      errorPatterns: new Map()
    };
  }

  /**
   * 初始化详情提取管理器 - 适配新架构v2.0.0
   */
  async init() {
    try {
      console.log(`初始化详情提取管理器 (新架构 v${this.version})`);
      
      // 🆕 初始化配置服务连接
      await this.initConfigService();
      
      // 初始化详情卡片管理器
      await detailCardManager.init();
      
      // 🆕 检查新架构服务健康状态
      await this.checkArchitectureHealth();
      
      // 🆕 设置配置监听器
      this.setupConfigListeners();
      
      // 暴露全局方法 - 增强版本
      this.exposeGlobalMethods();
      
      console.log(`详情提取管理器初始化完成 (新架构 v${this.version})`);
      console.log('支持的新架构特性:', this.architectureFeatures);
      
    } catch (error) {
      console.error('详情提取管理器初始化失败:', error);
      // 启动降级模式
      await this.initFallbackMode();
    }
  }

  /**
   * 🆕 初始化配置服务连接
   */
  async initConfigService() {
    try {
      this.configManager = detailConfigAPI;
      
      // 获取初始配置
      const configData = await this.configManager.getUserConfig();
      this.updateConfigCache(configData);
      
      this.serviceHealth.configService = true;
      console.log('配置服务连接成功 (新架构)', {
        version: configData.serviceInfo?.version,
        architecture: configData.serviceInfo?.architecture,
        supportedSites: configData.supportedSites?.length || 0
      });
      
    } catch (error) {
      console.warn('配置服务连接失败，使用默认配置:', error);
      this.configCache = {
        config: { ...DEFAULT_USER_CONFIG },
        metadata: {
          architecture: 'modular_parsers',
          version: '2.0.0',
          isDefault: true,
          fallbackMode: true
        }
      };
      this.serviceHealth.configService = false;
    }
  }

  /**
   * 🆕 检查新架构服务健康状态
   */
  async checkArchitectureHealth() {
    try {
      const startTime = performance.now();
      
      // 检查详情API服务健康状态
      const extractionHealth = await detailAPIService.checkServiceHealth();
      
      // 检查配置API服务健康状态
      const configHealth = await this.configManager?.checkServiceHealth();
      
      const healthCheckTime = performance.now() - startTime;
      
      this.serviceHealth = {
        status: (extractionHealth.healthy && configHealth?.healthy) ? 
                 SERVICE_STATUS.HEALTHY : SERVICE_STATUS.DEGRADED,
        lastCheck: Date.now(),
        extractionService: extractionHealth.healthy,
        configService: configHealth?.healthy || false,
        responseTime: healthCheckTime,
        version: this.version,
        architecture: 'modular_parsers',
        features: {
          extractionAPI: extractionHealth.healthy,
          configAPI: configHealth?.healthy || false,
          localCache: extractionHealth.localCache?.size >= 0,
          modularParsers: extractionHealth.features?.modularParsers || false
        }
      };
      
      console.log('新架构服务健康检查完成:', this.serviceHealth);
      
      // 更新UI状态指示器
      this.updateServiceStatusIndicators();
      
      // 触发服务状态变更事件
      document.dispatchEvent(new CustomEvent('detailServiceStatusChanged', {
        detail: this.serviceHealth
      }));
      
    } catch (error) {
      console.error('架构服务健康检查失败:', error);
      this.serviceHealth.status = SERVICE_STATUS.ERROR;
      this.serviceHealth.error = error.message;
      this.updateServiceStatusIndicators();
    }
  }

  /**
   * 🆕 设置配置监听器
   */
  setupConfigListeners() {
    // 监听配置变更事件
    document.addEventListener('detailConfigChanged', async (event) => {
      const { config } = event.detail;
      console.log('检测到详情配置变更，更新本地配置 (新架构)', config);
      await this.handleConfigUpdate(config);
    });
    
    // 监听配置保存事件
    document.addEventListener('detailConfigSaved', async (event) => {
      console.log('检测到详情配置保存事件，刷新配置缓存');
      await this.refreshConfig();
    });
    
    // 监听架构升级事件
    document.addEventListener('architectureUpgraded', async (event) => {
      const { version, features } = event.detail;
      console.log(`检测到架构升级: ${this.version} -> ${version}`, features);
      await this.handleArchitectureUpgrade(version, features);
    });
  }

  /**
   * 获取有效配置 - 适配新架构动态配置
   */
  async getEffectiveConfig(overrides = {}) {
    try {
      // 检查配置缓存有效性
      if (this.isConfigCacheExpired()) {
        await this.refreshConfig();
      }
      
      const baseConfig = this.configCache?.config || { ...DEFAULT_USER_CONFIG };
      const effectiveConfig = {
        ...baseConfig,
        ...this.config, // 合并实例配置
        ...overrides    // 合并覆盖配置
      };
      
      // 🆕 添加新架构标识
      effectiveConfig._architecture = 'modular_parsers';
      effectiveConfig._version = '2.0.0';
      effectiveConfig._configSource = this.configCache?.metadata?.isDefault ? 'default' : 'user';
      effectiveConfig._timestamp = Date.now();
      
      return effectiveConfig;
      
    } catch (error) {
      console.error('获取有效配置失败，使用默认配置:', error);
      return {
        ...DEFAULT_USER_CONFIG,
        ...overrides,
        _architecture: 'modular_parsers',
        _version: '2.0.0',
        _configSource: 'fallback'
      };
    }
  }

  /**
   * 更新配置 - 增强版本
   */
  async updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('DetailExtractionManager: 无效的配置对象');
      return;
    }

    const oldConfig = { ...this.config };
    
    // 合并配置
    this.config = { ...this.config, ...config };
    
    console.log('DetailExtractionManager: 配置已更新 (新架构)', {
      oldConfig: Object.keys(oldConfig).length,
      newConfig: Object.keys(this.config).length,
      architecture: this.config._architecture || 'modular_parsers'
    });
    
    // 处理配置更新
    await this.handleConfigUpdate(this.config, oldConfig);
  }

  /**
   * 🆕 处理配置更新
   */
  async handleConfigUpdate(newConfig, oldConfig = {}) {
    try {
      // 检查详情提取功能状态变化
      const wasEnabled = this.isExtractionEnabled;
      
      // 更新本地配置
      if (newConfig !== this.config) {
        this.config = { ...this.config, ...newConfig };
      }
      
      const isNowEnabled = this.isExtractionEnabled;
      
      if (wasEnabled !== isNowEnabled) {
        console.log(`详情提取功能${isNowEnabled ? '已启用' : '已禁用'} (新架构)`);
        
        // 触发状态变更事件
        document.dispatchEvent(new CustomEvent('detailExtractionStateChanged', {
          detail: { 
            enabled: isNowEnabled, 
            architecture: 'modular_parsers',
            configSource: this.config._configSource || 'unknown'
          }
        }));
      }
      
      // 🆕 检查关键配置变更
      const criticalChanges = this.detectCriticalConfigChanges(oldConfig, newConfig);
      if (criticalChanges.length > 0) {
        console.log('检测到关键配置变更:', criticalChanges);
        await this.handleCriticalConfigChanges(criticalChanges);
      }
      
      // 🆕 更新性能监控配置
      this.updatePerformanceMonitoring(newConfig);
      
    } catch (error) {
      console.error('处理配置更新失败:', error);
    }
  }

  /**
   * 🆕 检测关键配置变更
   */
  detectCriticalConfigChanges(oldConfig, newConfig) {
    const criticalFields = [
      'enableDetailExtraction',
      'extractionTimeout', 
      'extractionBatchSize',
      'maxConcurrentExtractions',
      'enableCache',
      'enableRetry'
    ];
    
    const changes = [];
    criticalFields.forEach(field => {
      if (oldConfig[field] !== newConfig[field]) {
        changes.push({
          field,
          oldValue: oldConfig[field],
          newValue: newConfig[field]
        });
      }
    });
    
    return changes;
  }

  /**
   * 🆕 处理关键配置变更
   */
  async handleCriticalConfigChanges(changes) {
    for (const change of changes) {
      switch (change.field) {
        case 'enableDetailExtraction':
          await this.toggleExtractionFeature(change.newValue);
          break;
        case 'extractionTimeout':
          this.updateTimeoutSettings(change.newValue);
          break;
        case 'extractionBatchSize':
          this.updateBatchSettings(change.newValue);
          break;
        case 'enableCache':
          await this.toggleCacheFeature(change.newValue);
          break;
      }
    }
  }

  /**
   * 检查详情提取是否可用 - 新架构版本
   */
  get isExtractionEnabled() {
    return this.config.enableDetailExtraction && 
           authManager.isAuthenticated() && 
           this.serviceHealth.extractionService;
  }

  /**
   * 判断是否应该使用详情提取 - 增强版本
   */
  shouldUseDetailExtraction(config) {
    const effectiveConfig = config || this.config;
    return effectiveConfig.enableDetailExtraction && 
           authManager.isAuthenticated() && 
           this.serviceHealth.status !== SERVICE_STATUS.ERROR;
  }

  /**
   * 判断是否应该提取详情 - 适配新架构
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    
    // 🆕 检查新架构支持的源类型
    const supportedSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || 
                            this.configCache?.supportedSites?.map(s => s.sourceType) || [];
    
    return supportedSources.includes(result.source);
  }

  /**
   * 处理详情提取 - 主入口 (新架构适配版本)
   */
  async handleDetailExtraction(searchResults, keyword, config) {
    if (this.extractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.extractionInProgress = true;
      const startTime = performance.now();
      
      console.log(`=== 开始详情提取流程 (新架构 v${this.version}) ===`);
      console.log(`搜索结果数量: ${searchResults.length}`);
      console.log(`关键词: ${keyword}`);
      
      // 🆕 获取配置感知的有效配置
      const effectiveConfig = await this.getEffectiveConfig(config);
      console.log(`使用配置 (${effectiveConfig._configSource}):`, effectiveConfig);
      
      // 确定要提取详情的结果
      const resultsToExtract = this.selectResultsForExtraction(searchResults, effectiveConfig);
      
      if (resultsToExtract.length === 0) {
        console.log('没有需要提取详情的结果');
        this.showExtractionInsight('no_results', { 
          total: searchResults.length,
          keyword,
          architecture: 'modular_parsers'
        });
        return;
      }

      console.log(`筛选出 ${resultsToExtract.length} 个结果进行详情提取`);

      // 显示提取进度
      if (effectiveConfig.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length, keyword);
      }

      // 🆕 执行新架构详情提取
      const extractionResult = await this.executeNewArchitectureExtraction(
        resultsToExtract, 
        keyword, 
        effectiveConfig
      );
      
      // 处理提取结果
      await this.processExtractionResults(extractionResult, resultsToExtract, effectiveConfig);
      
      // 更新统计信息
      this.updateExtractionStats(extractionResult);
      
      // 🆕 记录新架构性能指标
      const totalTime = performance.now() - startTime;
      this.recordArchitecturePerformance(extractionResult, totalTime);
      
      // 显示提取洞察
      this.showExtractionInsights(extractionResult, keyword);

    } catch (error) {
      console.error('详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
      this.showExtractionInsight('error', { 
        error: error.message,
        keyword,
        architecture: 'modular_parsers'
      });
      
      // 🆕 记录错误模式
      this.recordErrorPattern(error);
      
    } finally {
      this.extractionInProgress = false;
      this.hideExtractionProgress();
    }
  }

  /**
   * 🆕 执行新架构详情提取
   */
  async executeNewArchitectureExtraction(results, keyword, config) {
    const startTime = Date.now();
    
    try {
      // 生成批次ID用于进度跟踪
      const batchId = this.generateBatchId();
      
      console.log(`=== 执行新架构详情提取 ===`);
      console.log(`搜索结果数量: ${results.length}`);
      console.log(`关键词: ${keyword}`);
      console.log(`批次ID: ${batchId}`);
      console.log(`架构版本: ${config._architecture || 'modular_parsers'}`);
      
      // 🆕 构建ID映射表，确保结果能正确对应
      const resultMappings = this.buildResultMappings(results);
      console.log(`构建了 ${resultMappings.size} 个结果映射`);
      
      // 🆕 设置新架构进度回调
      const progressCallback = (progress) => {
        this.handleNewArchitectureProgress(progress, config);
      };

      // 🆕 使用新架构API执行批量详情提取
      const extractionOptions = this.buildNewArchitectureOptions(config, {
        batchId,
        onProgress: progressCallback,
        architecture: 'modular_parsers',
        dataStructureVersion: '2.0'
      });

      const extractionResult = await detailAPIService.extractBatchDetails(
        results, 
        extractionOptions
      );

      // 🆕 处理新架构返回结果，确保ID正确映射
      if (extractionResult.results) {
        console.log(`=== 处理新架构返回结果 ===`);
        
        extractionResult.results.forEach((result, index) => {
          // 确保每个结果都有正确的ID和架构信息
          result = this.enhanceResultWithArchitectureInfo(result, index, results, resultMappings);
        });
      }

      const totalTime = Date.now() - startTime;
      
      console.log(`=== 新架构批量详情提取完成 ===`);
      console.log(`总用时: ${totalTime}ms`);
      console.log(`处理结果: ${extractionResult.results?.length || 0} 个`);
      console.log(`架构统计:`, extractionResult.metadata);
      
      return {
        ...extractionResult,
        totalTime,
        keyword,
        batchId,
        architecture: 'modular_parsers',
        configApplied: config
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('新架构批量详情提取失败:', error);
      
      // 🆕 构建新架构错误响应
      const errorResults = results.map(result => ({
        ...result,
        extractionStatus: DETAIL_EXTRACTION_STATUS.ERROR,
        extractionError: error.message,
        extractionTime: 0,
        extractedAt: Date.now(),
        architecture: 'modular_parsers',
        dataStructureVersion: '2.0',
        errorType: error.name || 'UnknownError'
      }));
      
      return {
        results: errorResults,
        stats: {
          total: results.length,
          successful: 0,
          failed: results.length,
          cached: 0,
          partial: 0,
          totalTime,
          averageTime: 0,
          successRate: 0,
          cacheHitRate: 0
        },
        summary: {
          processed: results.length,
          successful: 0,
          failed: results.length,
          message: `新架构批量详情提取失败: ${error.message}`
        },
        totalTime,
        keyword,
        error: error.message,
        architecture: 'modular_parsers'
      };
    }
  }

  /**
   * 🆕 构建结果映射表
   */
  buildResultMappings(results) {
    const mappings = new Map();
    
    results.forEach((result, index) => {
      // 多种映射方式确保能找到正确的结果
      if (result.id) {
        mappings.set(result.id, { result, index });
        mappings.set(result.url, { result, index, byUrl: true });
      }
    });
    
    return mappings;
  }

  /**
   * 🆕 增强结果与架构信息
   */
  enhanceResultWithArchitectureInfo(result, index, originalResults, mappings) {
    // 确保结果有正确的ID
    let finalId = result.id;
    
    if (!finalId) {
      // 通过多种方式找回原始ID
      if (result.searchUrl || result.originalUrl) {
        const mapping = mappings.get(result.searchUrl) || mappings.get(result.originalUrl);
        if (mapping) {
          finalId = mapping.result.id;
        }
      }
      
      // 通过索引对应原始结果
      if (!finalId && index < originalResults.length) {
        finalId = originalResults[index].id;
      }
      
      // 生成临时ID
      if (!finalId) {
        finalId = `temp_v2_${Date.now()}_${index}`;
        console.warn(`无法找回原始ID，生成临时ID: ${finalId}`);
      }
      
      result.id = finalId;
    }
    
    // 🆕 添加新架构信息
    result.architecture = result.architecture || 'modular_parsers';
    result.dataStructureVersion = result.dataStructureVersion || '2.0';
    result.configApplied = result.configApplied || true;
    
    // 确保原始搜索结果信息被保留
    const originalResult = mappings.get(finalId)?.result || originalResults[index];
    if (originalResult) {
      result.originalId = originalResult.id;
      result.originalTitle = originalResult.title || result.title;
      result.originalSource = originalResult.source;
      result.originalUrl = originalResult.url;
      
      if (!result.title || result.title === '未知标题') {
        result.title = originalResult.title || result.title;
      }
    }
    
    console.log(`结果架构信息增强完成: ${finalId} -> ${result.title} (${result.extractionStatus})`);
    return result;
  }

  /**
   * 🆕 构建新架构选项
   */
  buildNewArchitectureOptions(config, additionalOptions = {}) {
    return {
      // 基础选项
      enableCache: config.enableCache,
      timeout: config.extractionTimeout,
      enableRetry: config.enableRetry,
      maxRetries: config.maxRetryAttempts,
      
      // 🆕 新架构选项
      architecture: 'modular_parsers',
      dataStructureVersion: '2.0',
      useModularParsers: true,
      enableUnifiedDataStructure: true,
      enableConfigAwareExtraction: true,
      
      // 内容控制
      maxDownloadLinks: config.maxDownloadLinks,
      maxMagnetLinks: config.maxMagnetLinks,
      maxScreenshots: config.maxScreenshots,
      
      // 质量控制
      strictValidation: config.enableStrictDomainCheck,
      requireMinimumData: config.requireMinimumData,
      validateImageUrls: config.validateImageUrls,
      validateDownloadLinks: config.validateDownloadLinks,
      
      // 过滤选项
      enableContentFilter: config.enableContentFilter,
      contentFilterKeywords: config.contentFilterKeywords,
      enableSpamFilter: config.enableSpamFilter,
      
      // 性能选项
      maxConcurrency: config.maxConcurrentExtractions,
      enableSmartBatching: config.enableSmartBatching,
      
      // 其他选项
      sourceType: config.sourceType || null,
      preferOriginalSources: config.preferOriginalSources,
      enableAutoCodeExtraction: config.enableAutoCodeExtraction,
      
      ...additionalOptions
    };
  }

  /**
   * 🆕 处理新架构进度
   */
  handleNewArchitectureProgress(progress, config) {
    if (config.showExtractionProgress) {
      this.updateExtractionProgress(
        progress.current, 
        progress.total, 
        progress.item,
        progress.architecture || 'modular_parsers'
      );
    }
    
    // 记录详细进度信息
    console.log(`新架构详情提取进度 [${progress.current}/${progress.total}]: ${progress.item} - ${progress.status}`);
    
    if (progress.error) {
      console.warn(`提取错误 [${progress.item}]:`, progress.error);
    }
    
    // 🆕 记录解析器性能
    if (progress.parser && progress.extractionTime) {
      this.recordParserPerformance(progress.parser, progress.extractionTime, progress.status === 'success');
    }
  }

  /**
   * 处理提取结果 - 增强新架构支持
   */
  async processExtractionResults(extractionResult, originalResults, config) {
    const { results, stats, metadata } = extractionResult;
    
    console.log(`=== 处理新架构详情提取结果 ===`);
    console.log(`结果数量: ${results?.length || 0}`);
    console.log(`成功: ${stats?.successful || 0}`);
    console.log(`失败: ${stats?.failed || 0}`);
    console.log(`缓存命中: ${stats?.cached || 0}`);
    console.log(`部分成功: ${stats?.partial || 0}`);
    console.log(`架构信息:`, metadata);
    
    if (!results || results.length === 0) {
      console.warn('没有详情提取结果需要处理');
      return;
    }

    // 逐个处理提取结果
    for (const result of results) {
      try {
        await this.handleSingleExtractionResult(result, config);
      } catch (error) {
        console.error(`处理单个提取结果失败 [${result.id}]:`, error);
      }
    }

    // 🆕 处理新架构特有的结果
    await this.processArchitectureSpecificResults(extractionResult, config);

    // 显示批量处理完成提示
    const successCount = stats?.successful || 0;
    const cachedCount = stats?.cached || 0;
    const partialCount = stats?.partial || 0;
    const totalProcessed = successCount + cachedCount + partialCount;
    
    if (totalProcessed > 0) {
      const architectureInfo = metadata?.architecture ? ` (${metadata.architecture})` : '';
      showToast(
        `详情提取完成${architectureInfo}: ${totalProcessed} 个成功 (${successCount} 新提取, ${cachedCount} 缓存, ${partialCount} 部分)`,
        'success',
        6000
      );
    } else {
      showToast('详情提取完成，但没有成功获取到详细信息', 'warning');
    }

    // 🆕 触发新架构提取完成事件
    document.dispatchEvent(new CustomEvent('detailExtractionCompleted', {
      detail: { 
        results, 
        stats, 
        metadata,
        keyword: extractionResult.keyword,
        architecture: 'modular_parsers',
        version: this.version
      }
    }));
  }

  /**
   * 🆕 处理架构特有的结果
   */
  async processArchitectureSpecificResults(extractionResult, config) {
    const { metadata, stats } = extractionResult;
    
    // 更新架构统计
    if (metadata) {
      this.extractionStats.modularParserExtractions += metadata.modularParserResults || 0;
      this.extractionStats.unifiedDataExtractions += metadata.unifiedDataResults || 0;
      this.extractionStats.configAwareExtractions += metadata.configAwareResults || 0;
    }
    
    // 处理解析器统计信息
    if (metadata?.parserStats) {
      for (const [parser, parserStats] of Object.entries(metadata.parserStats)) {
        this.recordParserPerformance(parser, parserStats.averageTime, parserStats.successRate > 0.8);
      }
    }
    
    // 🆕 检查是否需要重新加载解析器
    if (stats?.failed > stats?.successful && stats?.total > 5) {
      console.warn('检测到大量提取失败，可能需要检查解析器状态');
      await this.checkParserStatus();
    }
  }

  /**
   * 处理单个提取结果 - 适配新架构
   */
  async handleSingleExtractionResult(result, config) {
    try {
      console.log(`=== 处理单个新架构提取结果 ===`);
      console.log(`结果ID: ${result.id}`);
      console.log(`标题: ${result.title}`);
      console.log(`源类型: ${result.sourceType}`);
      console.log(`提取状态: ${result.extractionStatus}`);
      console.log(`架构: ${result.architecture || 'unknown'}`);
      console.log(`数据版本: ${result.dataStructureVersion || 'unknown'}`);
      
      // 🆕 多种方式查找对应的DOM容器
      const resultContainer = this.findResultContainer(result);
      
      if (!resultContainer) {
        console.error('完全找不到结果容器，详细信息:', {
          searchId: result.id,
          originalId: result.originalId,
          title: result.title,
          url: result.originalUrl || result.searchUrl,
          extractionStatus: result.extractionStatus,
          architecture: result.architecture
        });
        return;
      }

      // 处理提取结果
      if (result.extractionStatus === DETAIL_EXTRACTION_STATUS.SUCCESS || 
          result.extractionStatus === DETAIL_EXTRACTION_STATUS.CACHED ||
          result.extractionStatus === DETAIL_EXTRACTION_STATUS.PARTIAL) {
        await this.processSuccessfulExtraction(resultContainer, result, config);
      } else {
        await this.processFailedExtraction(resultContainer, result);
      }

    } catch (error) {
      console.error('处理提取结果失败:', error, {
        resultId: result.id,
        title: result.title,
        extractionStatus: result.extractionStatus,
        architecture: result.architecture
      });
    }
  }

  /**
   * 🆕 查找结果容器 - 增强版本
   */
  findResultContainer(result) {
    // 方式1：使用data-result-id属性
    if (result.id) {
      let container = document.querySelector(`[data-result-id="${result.id}"]`);
      if (container) {
        console.log(`通过data-result-id找到容器: ${result.id}`);
        return container;
      }
    }
    
    // 方式2：使用data-id属性（备选）
    if (result.id) {
      let container = document.querySelector(`[data-id="${result.id}"]`);
      if (container) {
        console.log(`通过data-id找到容器: ${result.id}`);
        return container;
      }
    }
    
    // 方式3：使用originalId（如果存在）
    if (result.originalId) {
      let container = document.querySelector(`[data-result-id="${result.originalId}"]`) ||
                    document.querySelector(`[data-id="${result.originalId}"]`);
      if (container) {
        console.log(`通过originalId找到容器: ${result.originalId}`);
        return container;
      }
    }
    
    // 方式4：通过URL匹配
    if (result.originalUrl || result.searchUrl) {
      const url = result.originalUrl || result.searchUrl;
      let container = document.querySelector(`[data-url="${url}"]`);
      if (container) {
        console.log(`通过URL找到容器: ${url}`);
        return container;
      }
    }
    
    return null;
  }

  /**
   * 处理成功的提取结果 - 适配新架构
   */
  async processSuccessfulExtraction(resultContainer, result, config) {
    try {
      // 🆕 使用新架构详情卡片管理器创建卡片
      const detailCardOptions = {
        compactMode: config.compactMode,
        showScreenshots: config.showScreenshots,
        showDownloadLinks: config.showDownloadLinks,
        showMagnetLinks: config.showMagnetLinks,
        showActressInfo: config.showActressInfo,
        enableImagePreview: config.enableImagePreview,
        enableContentFilter: config.enableContentFilter,
        contentFilterKeywords: config.contentFilterKeywords,
        // 🆕 新架构选项
        architecture: result.architecture || 'modular_parsers',
        dataStructureVersion: result.dataStructureVersion || '2.0',
        parserInfo: result.parser || result.sourceType
      };

      // 使用新架构API创建详情卡片
      await detailCardManager.renderDetailCard(
        { 
          url: result.originalUrl || result.searchUrl || result.url,
          title: result.originalTitle || result.title,
          source: result.originalSource || result.sourceType,
          id: result.originalId || result.id
        },
        result,
        this.getOrCreateDetailContainer(resultContainer),
        detailCardOptions
      );

      // 添加展开/收起功能
      this.addDetailToggleButton(resultContainer, result);
      
      // 🆕 添加新架构特有的控件
      this.addArchitectureControls(resultContainer, result);

      console.log(`新架构详情卡片创建成功: ${result.title} (${result.extractionStatus}, ${result.architecture})`);
      
    } catch (error) {
      console.error('处理成功提取结果失败:', error);
      await this.processFailedExtraction(resultContainer, result);
    }
  }

  /**
   * 🆕 添加架构控件
   */
  addArchitectureControls(resultContainer, result) {
    if (result.architecture !== 'modular_parsers') return;
    
    const actionsContainer = resultContainer.querySelector('.result-actions');
    if (!actionsContainer) return;

    // 解析器信息按钮
    if (result.parser && result.parser !== 'generic') {
      const parserBtn = document.createElement('button');
      parserBtn.className = 'action-btn parser-info-btn';
      parserBtn.innerHTML = `
        <span class="btn-icon">🔧</span>
        <span class="btn-text">${result.parser.toUpperCase()}</span>
      `;
      parserBtn.title = `解析器: ${result.parser}`;
      parserBtn.addEventListener('click', () => {
        this.showParserInfo(result.parser, result);
      });
      
      actionsContainer.appendChild(parserBtn);
    }

    // 架构信息指示器
    if (result.dataStructureVersion === '2.0') {
      const archIndicator = document.createElement('span');
      archIndicator.className = 'architecture-indicator';
      archIndicator.innerHTML = '🏗️ v2.0';
      archIndicator.title = '新架构数据结构';
      
      actionsContainer.appendChild(archIndicator);
    }
  }

  /**
   * 🆕 显示解析器信息
   */
  async showParserInfo(parser, result) {
    try {
      showToast('正在获取解析器信息...', 'info');
      
      const parserValidation = await this.configManager?.validateParser(parser);
      
      const infoModal = document.createElement('div');
      infoModal.className = 'parser-info-modal';
      infoModal.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.remove()">
          <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3>解析器信息: ${escapeHtml(parser.toUpperCase())}</h3>
              <button class="modal-close" onclick="this.closest('.parser-info-modal').remove()">×</button>
            </div>
            <div class="modal-body">
              <div class="parser-details">
                <div class="detail-row">
                  <strong>架构版本:</strong> ${result.architecture || 'unknown'}
                </div>
                <div class="detail-row">
                  <strong>数据结构:</strong> v${result.dataStructureVersion || 'unknown'}
                </div>
                <div class="detail-row">
                  <strong>提取状态:</strong> ${this.getStatusText(result.extractionStatus)}
                </div>
                <div class="detail-row">
                  <strong>提取时间:</strong> ${result.extractionTime || 0}ms
                </div>
                ${parserValidation ? `
                  <div class="detail-row">
                    <strong>解析器状态:</strong> ${parserValidation.validation.isValid ? '✅ 正常' : '❌ 异常'}
                  </div>
                  ${parserValidation.validation.features?.length > 0 ? `
                    <div class="detail-row">
                      <strong>支持特性:</strong> ${parserValidation.validation.features.join(', ')}
                    </div>
                  ` : ''}
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(infoModal);
      
    } catch (error) {
      console.error('获取解析器信息失败:', error);
      showToast('获取解析器信息失败', 'error');
    }
  }

  /**
   * 提取单个详情 - 适配新架构
   */
  async extractSingleDetail(resultId, currentResults, config) {
    const result = currentResults.find(r => r.id === resultId);
    if (!result) {
      showToast('未找到对应的搜索结果', 'error');
      return;
    }

    if (!this.shouldExtractDetail(result)) {
      showToast('该搜索源不支持详情提取', 'warning');
      return;
    }

    try {
      showLoading(true);
      showToast('正在提取详情...', 'info');
      
      // 🆕 使用新架构API提取单个详情
      const effectiveConfig = await this.getEffectiveConfig(config);
      const extractionOptions = this.buildNewArchitectureOptions(effectiveConfig, {
        singleExtraction: true,
        sourceType: result.source
      });
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, extractionOptions);

      // 🆕 增强结果与架构信息
      const enhancedResult = {
        ...result,
        ...extractedDetail,
        architecture: extractedDetail.architecture || 'modular_parsers',
        dataStructureVersion: extractedDetail.dataStructureVersion || '2.0'
      };

      await this.handleSingleExtractionResult(enhancedResult, effectiveConfig);

      // 更新统计
      this.updateExtractionStats({
        stats: {
          total: 1,
          successful: extractedDetail.extractionStatus === DETAIL_EXTRACTION_STATUS.SUCCESS ? 1 : 0,
          failed: extractedDetail.extractionStatus === DETAIL_EXTRACTION_STATUS.ERROR ? 1 : 0,
          cached: extractedDetail.extractionStatus === DETAIL_EXTRACTION_STATUS.CACHED ? 1 : 0,
          partial: extractedDetail.extractionStatus === DETAIL_EXTRACTION_STATUS.PARTIAL ? 1 : 0,
          averageTime: extractedDetail.extractionTime || 0
        },
        metadata: {
          architecture: 'modular_parsers',
          singleExtraction: true
        }
      });

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('单独详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 重试详情提取 - 增强新架构支持
   */
  async retryExtraction(resultId, currentResults, config) {
    const result = currentResults.find(r => r.id === resultId);
    if (!result) {
      showToast('未找到对应的搜索结果', 'error');
      return;
    }

    try {
      showToast('正在重试详情提取...', 'info');
      
      // 🆕 使用新架构API重试提取
      const effectiveConfig = await this.getEffectiveConfig(config);
      const retryOptions = this.buildNewArchitectureOptions(effectiveConfig, {
        enableCache: false,
        useLocalCache: false,
        enableRetry: true,
        retryAttempt: true,
        maxRetries: effectiveConfig.maxRetryAttempts
      });
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, retryOptions);

      const enhancedResult = {
        ...result,
        ...extractedDetail,
        architecture: extractedDetail.architecture || 'modular_parsers',
        dataStructureVersion: extractedDetail.dataStructureVersion || '2.0',
        isRetry: true
      };

      await this.handleSingleExtractionResult(enhancedResult, effectiveConfig);

      // 🆕 更新重试统计
      if (extractedDetail.extractionStatus === DETAIL_EXTRACTION_STATUS.SUCCESS) {
        this.extractionStats.retrySuccessCount++;
      }

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('重试详情提取失败:', error);
      showToast('重试失败: ' + error.message, 'error');
    }
  }

  // ===================== 🆕 新架构特有方法 =====================

  /**
   * 🆕 检查解析器状态
   */
  async checkParserStatus() {
    try {
      if (!this.configManager) return;
      
      const supportedSites = await this.configManager.getSupportedSites();
      
      let healthyParsers = 0;
      let totalParsers = 0;
      
      for (const site of supportedSites.sites || []) {
        totalParsers++;
        if (site.isActive && !site.error) {
          healthyParsers++;
        }
      }
      
      const healthRate = totalParsers > 0 ? (healthyParsers / totalParsers) : 0;
      
      if (healthRate < 0.5) {
        console.warn(`解析器健康率较低: ${(healthRate * 100).toFixed(1)}% (${healthyParsers}/${totalParsers})`);
        showToast(`部分解析器可能存在问题，建议检查服务状态`, 'warning', 8000);
      }
      
    } catch (error) {
      console.error('检查解析器状态失败:', error);
    }
  }

  /**
   * 🆕 记录架构性能
   */
  recordArchitecturePerformance(extractionResult, totalTime) {
    const { stats, metadata } = extractionResult;
    
    // 记录提取时间
    this.performanceMetrics.extractionTimes.push(totalTime);
    if (this.performanceMetrics.extractionTimes.length > 100) {
      this.performanceMetrics.extractionTimes.shift();
    }
    
    // 记录解析器性能
    if (metadata?.parserStats) {
      for (const [parser, parserStats] of Object.entries(metadata.parserStats)) {
        this.recordParserPerformance(parser, parserStats.averageTime, parserStats.successRate > 0.8);
      }
    }
    
    // 记录配置获取时间
    const configFetchTime = performance.now();
    this.getEffectiveConfig().then(() => {
      const fetchTime = performance.now() - configFetchTime;
      this.performanceMetrics.configFetchTimes.push(fetchTime);
      if (this.performanceMetrics.configFetchTimes.length > 50) {
        this.performanceMetrics.configFetchTimes.shift();
      }
    });
  }

  /**
   * 🆕 记录解析器性能
   */
  recordParserPerformance(parser, extractionTime, success) {
    if (!this.performanceMetrics.parserPerformance.has(parser)) {
      this.performanceMetrics.parserPerformance.set(parser, {
        totalCalls: 0,
        totalTime: 0,
        successCount: 0,
        averageTime: 0,
        successRate: 0
      });
    }
    
    const stats = this.performanceMetrics.parserPerformance.get(parser);
    stats.totalCalls++;
    stats.totalTime += extractionTime;
    stats.averageTime = stats.totalTime / stats.totalCalls;
    
    if (success) {
      stats.successCount++;
    }
    
    stats.successRate = stats.successCount / stats.totalCalls;
  }

  /**
   * 🆕 记录错误模式
   */
  recordErrorPattern(error) {
    const errorType = error.name || 'UnknownError';
    const errorPattern = this.performanceMetrics.errorPatterns.get(errorType) || {
      count: 0,
      messages: [],
      lastOccurrence: 0
    };
    
    errorPattern.count++;
    errorPattern.lastOccurrence = Date.now();
    
    if (errorPattern.messages.length < 5) {
      errorPattern.messages.push(error.message);
    }
    
    this.performanceMetrics.errorPatterns.set(errorType, errorPattern);
  }

  /**
   * 🆕 刷新配置
   */
  async refreshConfig() {
    try {
      console.log('刷新详情提取配置 (新架构)');
      const configData = await this.configManager.getUserConfig(false); // 强制从服务器获取
      this.updateConfigCache(configData);
      
      // 合并到本地配置
      this.config = { ...this.config, ...configData.config };
      
      console.log('配置刷新完成 (新架构)', this.config);
      
    } catch (error) {
      console.error('刷新配置失败:', error);
      throw error;
    }
  }

  /**
   * 🆕 处理架构升级
   */
  async handleArchitectureUpgrade(version, features) {
    if (version !== this.version) {
      console.log(`升级到新架构版本: ${this.version} -> ${version}`);
      this.version = version;
      this.architectureFeatures = [...this.architectureFeatures, ...features];
      
      // 重新初始化以适配新架构
      await this.reinitializeForNewArchitecture();
      
      showToast(`已升级到新架构 v${version}`, 'success');
    }
  }

  /**
   * 🆕 为新架构重新初始化
   */
  async reinitializeForNewArchitecture() {
    try {
      // 刷新配置以适配新架构
      await this.refreshConfig();
      
      // 重新检查服务健康状态
      await this.checkArchitectureHealth();
      
      // 更新UI指示器
      this.updateArchitectureIndicators();
      
    } catch (error) {
      console.error('新架构初始化失败:', error);
    }
  }

  /**
   * 🆕 更新架构指示器
   */
  updateArchitectureIndicators() {
    const indicators = document.querySelectorAll('.architecture-indicator');
    indicators.forEach(indicator => {
      indicator.innerHTML = `🏗️ v${this.version}`;
      indicator.title = `新架构版本: ${this.version}`;
    });
  }

  /**
   * 🆕 启动降级模式
   */
  async initFallbackMode() {
    console.warn('启动详情提取降级模式');
    this.config = { ...DEFAULT_USER_CONFIG };
    this.serviceHealth.status = SERVICE_STATUS.DEGRADED;
    this.serviceHealth.extractionService = false;
    this.serviceHealth.configService = false;
    
    showToast('详情提取服务启动降级模式，部分功能可能不可用', 'warning', 8000);
  }

  // ===================== 配置缓存管理 =====================

  /**
   * 🆕 检查配置缓存是否过期
   */
  isConfigCacheExpired() {
    return !this.configCache || (Date.now() - this.configLastUpdate) > this.configCacheExpiration;
  }

  /**
   * 🆕 更新配置缓存
   */
  updateConfigCache(configData) {
    this.configCache = configData;
    this.configLastUpdate = Date.now();
  }

  // ===================== 进度管理 - 增强新架构支持 =====================

  /**
   * 显示提取进度 - 增强新架构支持
   */
  showExtractionProgress(total, keyword) {
    let progressContainer = document.getElementById('extraction-progress');
    
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'extraction-progress';
      progressContainer.className = 'extraction-progress-container';
      
      const searchResults = document.getElementById('resultsSection');
      if (searchResults) {
        searchResults.insertBefore(progressContainer, searchResults.firstChild);
      }
    }

    progressContainer.innerHTML = `
      <div class="progress-header">
        <span class="progress-title">正在提取详情信息 (新架构 v${this.version})</span>
        <span class="progress-stats">0 / ${total}</span>
        <button class="progress-close" onclick="this.closest('.extraction-progress-container').style.display='none'">×</button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="progress-message">正在处理搜索结果: ${escapeHtml(keyword)}</div>
      <div class="progress-details">
        <small>
          架构: <span class="arch-info">模块化解析器</span> | 
          平均用时: <span class="avg-time">计算中...</span> | 
          成功率: <span class="success-rate">计算中...</span>
        </small>
      </div>
      <div class="progress-architecture">
        <span class="architecture-badge">🏗️ v${this.version}</span>
      </div>
    `;

    progressContainer.style.display = 'block';
  }

  /**
   * 更新提取进度 - 增强新架构支持
   */
  updateExtractionProgress(processed, total, currentItem, architecture) {
    const progressContainer = document.getElementById('extraction-progress');
    if (!progressContainer) return;

    const progressStats = progressContainer.querySelector('.progress-stats');
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressMessage = progressContainer.querySelector('.progress-message');

    if (progressStats) {
      progressStats.textContent = `${processed} / ${total}`;
    }

    if (progressFill) {
      const percentage = (processed / total) * 100;
      progressFill.style.width = `${percentage}%`;
    }

    if (progressMessage) {
      if (processed === total) {
        progressMessage.textContent = `详情提取完成 (${architecture || 'modular_parsers'})!`;
      } else {
        progressMessage.textContent = `正在处理: ${currentItem || '搜索结果'}`;
      }
    }

    // 🆕 更新架构信息
    const archInfo = progressContainer.querySelector('.arch-info');
    if (archInfo && architecture) {
      archInfo.textContent = architecture === 'modular_parsers' ? '模块化解析器' : architecture;
    }

    // 更新详细信息
    this.updateProgressDetails(processed, total);
  }

  // ===================== 统计和洞察 - 增强新架构支持 =====================

  /**
   * 更新提取统计信息 - 增强新架构支持
   */
  updateExtractionStats(extractionResult) {
    const { stats, metadata } = extractionResult;
    
    if (stats) {
      this.extractionStats.totalExtractions += stats.total || 0;
      this.extractionStats.successfulExtractions += stats.successful || 0;
      this.extractionStats.failedExtractions += stats.failed || 0;
      this.extractionStats.partialExtractions += stats.partial || 0;
      this.extractionStats.cacheHits += stats.cached || 0;
      this.extractionStats.totalTime += stats.totalTime || 0;
      
      // 更新平均时间
      if (stats.averageTime) {
        this.extractionStats.averageTime = 
          (this.extractionStats.averageTime + stats.averageTime) / 2;
      }
    }
    
    // 🆕 更新新架构统计
    if (metadata) {
      this.extractionStats.modularParserExtractions += metadata.modularParserResults || 0;
      this.extractionStats.unifiedDataExtractions += metadata.unifiedDataResults || 0;
      this.extractionStats.configAwareExtractions += metadata.configAwareResults || 0;
    }
  }

  /**
   * 显示提取洞察 - 增强新架构支持
   */
  showExtractionInsights(extractionResult, keyword) {
    const { stats, results, metadata } = extractionResult;
    
    const insights = [];
    
    // 🆕 架构性能洞察
    if (metadata?.architecture === 'modular_parsers') {
      insights.push({
        type: 'architecture',
        icon: '🏗️',
        message: `使用新架构模块化解析器处理`,
        level: 'info'
      });
    }
    
    // 性能洞察
    if (stats && stats.averageTime) {
      if (stats.averageTime < 5000) {
        insights.push({
          type: 'performance',
          icon: '⚡',
          message: `详情提取速度良好 (平均 ${Math.round(stats.averageTime)}ms)`,
          level: 'success'
        });
      } else if (stats.averageTime > 15000) {
        insights.push({
          type: 'performance',
          icon: '⏰',
          message: `详情提取较慢，建议检查网络或降低批次大小`,
          level: 'warning'
        });
      }
    }
    
    // 缓存洞察
    if (stats && stats.cacheHitRate > 50) {
      insights.push({
        type: 'cache',
        icon: '💾',
        message: `缓存命中率 ${stats.cacheHitRate.toFixed(1)}%，显著提升了提取速度`,
        level: 'info'
      });
    }
    
    // 🆕 解析器性能洞察
    if (metadata?.parserStats) {
      const topParser = Object.entries(metadata.parserStats)
        .sort(([,a], [,b]) => b.successRate - a.successRate)[0];
      
      if (topParser && topParser[1].successRate > 0.9) {
        insights.push({
          type: 'parser',
          icon: '🔧',
          message: `${topParser[0]} 解析器表现优秀 (成功率 ${(topParser[1].successRate * 100).toFixed(1)}%)`,
          level: 'success'
        });
      }
    }
    
    // 内容洞察
    if (results && results.length > 0) {
      const withScreenshots = results.filter(r => r.screenshots && r.screenshots.length > 0).length;
      const withDownloads = results.filter(r => r.downloadLinks && r.downloadLinks.length > 0).length;
      const withUnifiedData = results.filter(r => r.dataStructureVersion === '2.0').length;
      
      if (withScreenshots > 0) {
        insights.push({
          type: 'content',
          icon: '🖼️',
          message: `${withScreenshots} 个结果包含截图预览`,
          level: 'info'
        });
      }
      
      if (withDownloads > 0) {
        insights.push({
          type: 'content',
          icon: '⬇️',
          message: `${withDownloads} 个结果包含下载链接`,
          level: 'info'
        });
      }
      
      // 🆕 数据结构洞察
      if (withUnifiedData > 0) {
        insights.push({
          type: 'data',
          icon: '📊',
          message: `${withUnifiedData} 个结果使用统一数据结构 v2.0`,
          level: 'info'
        });
      }
    }
    
    // 显示洞察
    this.displayInsights(insights);
  }

  // ===================== 工具方法 - 保持兼容和增强 =====================

  /**
   * 获取状态文本 - 适配新架构状态
   */
  getStatusText(status) {
    const statusTexts = {
      [DETAIL_EXTRACTION_STATUS.SUCCESS]: '提取成功',
      [DETAIL_EXTRACTION_STATUS.CACHED]: '缓存数据',
      [DETAIL_EXTRACTION_STATUS.ERROR]: '提取失败',
      [DETAIL_EXTRACTION_STATUS.PARTIAL]: '部分成功',
      [DETAIL_EXTRACTION_STATUS.TIMEOUT]: '提取超时',
      'unknown': '未知状态'
    };
    return statusTexts[status] || '未知状态';
  }

  /**
   * 🆕 更新服务状态指示器
   */
  updateServiceStatusIndicators() {
    const statusIndicator = document.getElementById('detailServiceStatus');
    if (statusIndicator) {
      const isHealthy = this.serviceHealth.status === SERVICE_STATUS.HEALTHY;
      statusIndicator.className = `service-status ${isHealthy ? 'healthy' : 'unhealthy'}`;
      statusIndicator.innerHTML = `
        <span class="status-icon">${isHealthy ? '✅' : '⚠️'}</span>
        <span class="status-text">详情提取: ${isHealthy ? '正常' : '异常'}</span>
        <small class="architecture-info">v${this.version}</small>
        ${this.serviceHealth.responseTime ? `<small>${Math.round(this.serviceHealth.responseTime)}ms</small>` : ''}
      `;
      statusIndicator.title = isHealthy ? 
        `详情提取服务运行正常\n架构版本: ${this.version}\n响应时间: ${this.serviceHealth.responseTime}ms\n配置服务: ${this.serviceHealth.configService ? '正常' : '异常'}` :
        `详情提取服务异常: ${this.serviceHealth.error || '未知错误'}\n架构版本: ${this.version}`;
    }
  }

  /**
   * 🆕 暴露全局方法 - 增强新架构支持
   */
  exposeGlobalMethods() {
    window.detailExtractionManager = {
      // 现有方法保持不变
      extractSingleDetail: (resultId, currentResults, config) => 
        this.extractSingleDetail(resultId, currentResults, config),
      retryExtraction: (resultId, currentResults, config) => 
        this.retryExtraction(resultId, currentResults, config),
      toggleDetailDisplay: (resultId) => this.toggleDetailDisplay(resultId),
      getExtractionStats: () => this.getExtractionStats(),
      resetExtractionStats: () => this.resetExtractionStats(),
      getExtractionCapabilities: (config) => this.getExtractionCapabilities(config),
      
      // 🆕 新架构方法
      getArchitectureInfo: () => ({
        version: this.version,
        features: this.architectureFeatures,
        serviceHealth: this.serviceHealth
      }),
      refreshConfig: () => this.refreshConfig(),
      checkArchitectureHealth: () => this.checkArchitectureHealth(),
      getPerformanceMetrics: () => ({
        ...this.performanceMetrics,
        extractionStats: this.extractionStats
      }),
      validateParser: (parser) => this.configManager?.validateParser(parser),
      checkParserStatus: () => this.checkParserStatus(),
      
      // 配置管理
      getEffectiveConfig: (overrides) => this.getEffectiveConfig(overrides),
      updateConfig: (config) => this.updateConfig(config),
      
      // 服务状态
      isExtractionEnabled: () => this.isExtractionEnabled,
      getServiceHealth: () => this.serviceHealth
    };
  }

  /**
   * 获取提取统计 - 增强新架构信息
   */
  getExtractionStats() {
    return {
      ...this.extractionStats,
      architecture: {
        version: this.version,
        features: this.architectureFeatures,
        serviceHealth: this.serviceHealth
      },
      performance: {
        averageExtractionTime: this.performanceMetrics.extractionTimes.length > 0 ?
          this.performanceMetrics.extractionTimes.reduce((a, b) => a + b, 0) / this.performanceMetrics.extractionTimes.length : 0,
        parserPerformance: Object.fromEntries(this.performanceMetrics.parserPerformance),
        errorPatterns: Object.fromEntries(this.performanceMetrics.errorPatterns)
      }
    };
  }

  /**
   * 获取提取能力信息 - 增强新架构信息
   */
  getExtractionCapabilities(config) {
    const effectiveConfig = config || this.config;
    
    return {
      enabled: effectiveConfig.enableDetailExtraction,
      authenticated: authManager.isAuthenticated(),
      serviceHealthy: this.serviceHealth.status === SERVICE_STATUS.HEALTHY,
      supportedSources: APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [],
      
      // 基础配置
      maxAutoExtractions: effectiveConfig.maxAutoExtractions,
      batchSize: effectiveConfig.extractionBatchSize,
      timeout: effectiveConfig.extractionTimeout,
      caching: effectiveConfig.enableCache,
      retry: effectiveConfig.enableRetry,
      
      // 🆕 新架构能力
      architecture: this.version,
      features: this.architectureFeatures,
      modularParsers: this.serviceHealth.features?.modularParsers || false,
      unifiedDataStructure: true,
      configService: this.serviceHealth.configService,
      
      // 运行时状态
      currentQueue: this.extractionQueue.length,
      inProgress: this.extractionInProgress,
      
      // 性能信息
      averageTime: this.extractionStats.averageTime,
      successRate: this.extractionStats.totalExtractions > 0 ? 
        (this.extractionStats.successfulExtractions / this.extractionStats.totalExtractions * 100).toFixed(1) : 0
    };
  }

  /**
   * 清理资源 - 增强新架构支持
   */
  cleanup() {
    this.extractionQueue = [];
    this.progressCallbacks.clear();
    this.extractionInsights = [];
    this.extractionInProgress = false;
    
    // 🆕 清理新架构资源
    this.configCache = null;
    this.configLastUpdate = 0;
    this.performanceMetrics.parserPerformance.clear();
    this.performanceMetrics.errorPatterns.clear();
    
    // 清理DOM元素
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      progressContainer.remove();
    }

    const insightsContainer = document.getElementById('extractionInsights');
    if (insightsContainer) {
      insightsContainer.remove();
    }
    
    // 清理全局方法
    if (window.detailExtractionManager) {
      delete window.detailExtractionManager;
    }
    
    console.log(`详情提取管理器资源已清理 (新架构 v${this.version})`);
  }

  // ===================== 其他辅助方法保持不变 =====================
  // [保留原有的辅助方法如 selectResultsForExtraction, getOrCreateDetailContainer, 
  //  addDetailToggleButton, toggleDetailDisplay, generateBatchId, 等等...]

  selectResultsForExtraction(searchResults, config) {
    const supportedResults = searchResults.filter(result => 
      this.shouldExtractDetail(result)
    );
    
    console.log(`支持详情提取的结果: ${supportedResults.length}/${searchResults.length}`);
    
    if (config.autoExtractDetails) {
      const selected = supportedResults.slice(0, config.maxAutoExtractions);
      console.log(`自动提取模式，选择前 ${selected.length} 个结果`);
      return selected;
    } else {
      console.log(`手动提取模式，返回所有 ${supportedResults.length} 个支持的结果`);
      return supportedResults;
    }
  }

  getOrCreateDetailContainer(resultContainer) {
    let detailContainer = resultContainer.querySelector('.result-detail-container');
    
    if (!detailContainer) {
      detailContainer = document.createElement('div');
      detailContainer.className = 'result-detail-container';
      detailContainer.style.display = 'none';
      resultContainer.appendChild(detailContainer);
    }
    
    return detailContainer;
  }

  addDetailToggleButton(resultContainer, result) {
    const actionsContainer = resultContainer.querySelector('.result-actions');
    if (!actionsContainer) return;

    if (actionsContainer.querySelector('.detail-toggle-btn')) return;

    const toggleButton = document.createElement('button');
    toggleButton.className = 'action-btn detail-toggle-btn';
    toggleButton.innerHTML = `
      <span class="btn-icon">📋</span>
      <span class="btn-text">查看详情</span>
    `;
    
    toggleButton.addEventListener('click', () => {
      const resultId = resultContainer.dataset.resultId || resultContainer.dataset.id;
      this.toggleDetailDisplay(resultId);
    });

    actionsContainer.appendChild(toggleButton);
  }

  toggleDetailDisplay(resultId) {
    const resultContainer = document.querySelector(`[data-result-id="${resultId}"], [data-id="${resultId}"]`);
    if (!resultContainer) return;

    const detailContainer = resultContainer.querySelector('.result-detail-container');
    const toggleBtn = resultContainer.querySelector('.detail-toggle-btn');
    
    if (!detailContainer || !toggleBtn) return;

    const isVisible = detailContainer.style.display !== 'none';
    
    detailContainer.style.display = isVisible ? 'none' : 'block';
    
    const btnText = toggleBtn.querySelector('.btn-text');
    const btnIcon = toggleBtn.querySelector('.btn-icon');
    
    if (btnText) {
      btnText.textContent = isVisible ? '查看详情' : '隐藏详情';
    }
    
    if (btnIcon) {
      btnIcon.textContent = isVisible ? '📋' : '📄';
    }

    if (!isVisible) {
      detailContainer.style.opacity = '0';
      detailContainer.style.transform = 'translateY(-10px)';
      
      requestAnimationFrame(() => {
        detailContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        detailContainer.style.opacity = '1';
        detailContainer.style.transform = 'translateY(0)';
      });
    }
  }

  generateBatchId() {
    return 'batch_v2_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  processFailedExtraction(resultContainer, result) {
    this.showExtractionError(resultContainer, result.extractionError || '未知错误', result);
  }

  showExtractionError(resultContainer, error, result) {
    const detailContainer = this.getOrCreateDetailContainer(resultContainer);

    const suggestions = this.generateErrorSuggestions(error, result);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">⚠️</div>
        <div class="error-content">
          <div class="error-message">
            <strong>详情提取失败</strong>
            <small>${escapeHtml(error || '未知错误')}</small>
          </div>
          ${suggestions.length > 0 ? `
            <div class="error-suggestions">
              <strong>建议:</strong>
              <ul>
                ${suggestions.map(suggestion => `<li>${escapeHtml(suggestion)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="error-actions">
          <button class="retry-btn" onclick="window.detailExtractionManager?.retryExtraction('${result.id}')">
            重试
          </button>
        </div>
      </div>
    `;
    
    detailContainer.style.display = 'block';
    this.addDetailToggleButton(resultContainer, result);
  }

  generateErrorSuggestions(error, result) {
    const suggestions = [];
    const errorLower = (error || '').toLowerCase();
    
    if (errorLower.includes('timeout') || errorLower.includes('超时')) {
      suggestions.push('网络连接较慢，建议稍后重试');
      suggestions.push('可以在设置中增加提取超时时间');
    } else if (errorLower.includes('network') || errorLower.includes('网络')) {
      suggestions.push('检查网络连接状态');
      suggestions.push('目标网站可能暂时无法访问');
    } else if (errorLower.includes('parse') || errorLower.includes('解析')) {
      suggestions.push('目标页面结构可能已变更');
      suggestions.push('尝试直接访问页面查看内容');
    } else if (errorLower.includes('validation') || errorLower.includes('验证')) {
      suggestions.push('URL格式可能有问题');
      suggestions.push('确保搜索结果来源有效');
    } else {
      suggestions.push('请稍后重试');
      suggestions.push('如问题持续存在，请联系支持');
    }
    
    return suggestions;
  }

  hideExtractionProgress() {
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 3000);
    }
  }

  updateProgressDetails(processed, total) {
    const progressContainer = document.getElementById('extraction-progress');
    if (!progressContainer || this.extractionStats.totalExtractions === 0) return;

    const avgTimeElement = progressContainer.querySelector('.avg-time');
    const successRateElement = progressContainer.querySelector('.success-rate');

    if (avgTimeElement && this.extractionStats.averageTime > 0) {
      avgTimeElement.textContent = `${Math.round(this.extractionStats.averageTime)}ms`;
    }

    if (successRateElement && this.extractionStats.totalExtractions > 0) {
      const rate = (this.extractionStats.successfulExtractions / this.extractionStats.totalExtractions * 100).toFixed(1);
      successRateElement.textContent = `${rate}%`;
    }
  }

  showExtractionInsight(type, data) {
    const insights = [];
    
    switch (type) {
      case 'no_results':
        insights.push({
          type: 'info',
          icon: 'ℹ️',
          message: `搜索到 ${data.total} 个结果，但没有支持详情提取的源 (${data.architecture})`,
          level: 'info'
        });
        break;
        
      case 'error':
        insights.push({
          type: 'error',
          icon: '❌',
          message: `详情提取失败: ${data.error} (${data.architecture})`,
          level: 'error'
        });
        break;
        
      case 'partial':
        insights.push({
          type: 'warning',
          icon: '⚠️',
          message: `部分详情提取失败，已获取 ${data.successful}/${data.total} 个结果`,
          level: 'warning'
        });
        break;
    }
    
    this.displayInsights(insights);
  }

  displayInsights(insights) {
    if (insights.length === 0) return;
    
    const insightsContainer = document.getElementById('extractionInsights');
    if (!insightsContainer) return;
    
    insightsContainer.innerHTML = insights.map(insight => `
      <div class="insight-item insight-${insight.level}">
        <span class="insight-icon">${insight.icon}</span>
        <span class="insight-message">${escapeHtml(insight.message)}</span>
      </div>
    `).join('');
    
    insightsContainer.style.display = 'block';
    
    if (insights.every(i => i.level === 'info')) {
      setTimeout(() => {
        insightsContainer.style.display = 'none';
      }, 8000);
    }
  }

  resetExtractionStats() {
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      partialExtractions: 0,
      cacheHits: 0,
      averageTime: 0,
      totalTime: 0,
      modularParserExtractions: 0,
      unifiedDataExtractions: 0,
      configAwareExtractions: 0,
      retrySuccessCount: 0
    };
  }
}

export default DetailExtractionManager;