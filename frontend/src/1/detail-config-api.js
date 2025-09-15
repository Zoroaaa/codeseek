// src/services/detail-config-api.js - 适配后端新架构的详情提取配置API服务
// 与后端 detail.js 配置管理处理器完全对接，支持模块化解析器架构

import apiService from './api.js';
import authManager from './auth.js';
import { 
  DETAIL_CONFIG_ENDPOINTS, 
  DETAIL_CONFIG_PRESETS,
  CONFIG_VALIDATION_RULES,
  DEFAULT_USER_CONFIG,
  CONFIG_PRESETS,
  detectConfigChanges
} from '../core/detail-config.js';

export class DetailConfigAPI {
  constructor() {
    this.configCache = null;
    this.cacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
    this.lastCacheTime = 0;
    this.version = '2.0.0'; // 架构升级版本
  }

  /**
   * 获取用户详情提取配置
   * 对应后端 getDetailExtractionConfigHandler
   */
  async getUserConfig(useCache = true) {
    if (!authManager.isAuthenticated()) {
      console.warn('用户未认证，返回默认配置');
      return this.getDefaultConfigResponse();
    }

    // 检查本地缓存
    if (useCache && this.isConfigCacheValid()) {
      console.log('使用本地缓存的配置');
      return this.configCache;
    }

    try {
      console.log('从服务器获取用户配置 (新架构)');
      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.GET_CONFIG);

      if (!response.success) {
        throw new Error(response.message || '获取配置失败');
      }

      // 适配后端新架构响应格式
      const configData = {
        config: response.config || { ...DEFAULT_USER_CONFIG },
        metadata: response.metadata || this.getDefaultMetadata(),
        presets: response.presets || CONFIG_PRESETS,
        usage: response.usage || this.getDefaultUsageStats(),
        isDefault: response.isDefault !== false,
        validation: response.validation || {
          rules: CONFIG_VALIDATION_RULES,
          supportedSources: []
        },
        systemLimits: response.systemLimits || CONFIG_VALIDATION_RULES,
        // 🆕 新架构特有数据
        supportedSites: response.supportedSites || [],
        parserStats: response.parserStats || {},
        serviceInfo: response.serviceInfo || {
          version: '2.0.0',
          architecture: 'modular_parsers'
        }
      };

      // 更新本地缓存
      this.updateConfigCache(configData);

      return configData;

    } catch (error) {
      console.error('获取用户配置失败:', error);
      
      // 返回默认配置作为降级方案
      return {
        ...this.getDefaultConfigResponse(),
        error: error.message
      };
    }
  }

  /**
   * 更新用户详情提取配置
   * 对应后端 updateDetailExtractionConfigHandler
   */
  async updateUserConfig(config, options = {}) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    if (!config || typeof config !== 'object') {
      throw new Error('配置数据格式错误');
    }

    const {
      validateOnly = false,
      preset = null
    } = options;

    try {
      // 前端预验证
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      console.log('更新用户配置 (新架构):', { config, validateOnly, preset });

      const requestData = {
        config,
        validateOnly,
        preset
      };

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.UPDATE_CONFIG, {
        method: 'PUT',
        body: JSON.stringify(requestData)
      });

      if (!response.success) {
        const errorData = response.data || response;
        if (errorData.errors) {
          throw new Error(`配置验证失败: ${errorData.errors.join(', ')}`);
        }
        throw new Error(response.message || '更新配置失败');
      }

      const resultData = response.data || response;
      
      // 如果不是仅验证，则更新本地缓存
      if (!validateOnly) {
        this.clearConfigCache();
      }

      return {
        valid: resultData.valid !== false,
        changes: Array.isArray(resultData.changes) ? resultData.changes : [],
        warnings: Array.isArray(resultData.warnings) ? resultData.warnings : [],
        optimizations: Array.isArray(resultData.optimizations) ? resultData.optimizations : [],
        message: resultData.message || (validateOnly ? '配置验证通过' : '配置更新成功'),
        config: validateOnly ? null : (resultData.config || config),
        // 🆕 新架构返回的额外信息
        affectedParsers: resultData.affectedParsers || [],
        performanceImpact: resultData.performanceImpact || 'neutral',
        recommendations: resultData.recommendations || []
      };

    } catch (error) {
      console.error('更新详情提取配置失败:', error);
      throw error;
    }
  }

  /**
   * 重置配置为默认值
   * 对应后端 resetDetailExtractionConfigHandler
   */
  async resetConfig() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    try {
      console.log('重置用户配置为默认值 (新架构)');

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.RESET_CONFIG, {
        method: 'POST'
      });

      if (!response.success) {
        throw new Error(response.message || '重置配置失败');
      }

      // 清除本地缓存
      this.clearConfigCache();

      return {
        message: '配置已重置为默认值',
        config: response.config || { ...DEFAULT_USER_CONFIG },
        // 🆕 新架构返回的重置信息
        resetInfo: response.resetInfo || {
          resetAt: Date.now(),
          previousConfig: null,
          resetsCount: 1
        }
      };

    } catch (error) {
      console.error('重置详情提取配置失败:', error);
      throw error;
    }
  }

  /**
   * 应用配置预设
   * 对应后端 applyConfigPresetHandler
   */
  async applyPreset(presetName) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    if (!presetName) {
      throw new Error('预设名称不能为空');
    }

    if (!CONFIG_PRESETS[presetName]) {
      throw new Error(`未知的配置预设: ${presetName}`);
    }

    try {
      console.log(`应用配置预设 (新架构): ${presetName}`);

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.APPLY_PRESET, {
        method: 'POST',
        body: JSON.stringify({ preset: presetName })
      });

      if (!response.success) {
        throw new Error(response.message || '应用预设失败');
      }

      // 清除本地缓存
      this.clearConfigCache();

      const presetInfo = CONFIG_PRESETS[presetName];
      
      return {
        message: `已应用 ${presetInfo.name} 配置预设`,
        preset: presetName,
        config: response.config || presetInfo.config,
        description: response.description || presetInfo.description,
        // 🆕 新架构返回的预设应用信息
        presetInfo: response.presetInfo || {
          appliedAt: Date.now(),
          previousPreset: null,
          optimizations: []
        }
      };

    } catch (error) {
      console.error('应用配置预设失败:', error);
      throw error;
    }
  }

  /**
   * 🆕 获取支持的站点信息 - 新架构端点
   * 对应后端 getSupportedSitesHandler
   */
  async getSupportedSites() {
    try {
      console.log('获取支持的站点信息 (新架构)');

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.GET_SUPPORTED_SITES);

      if (!response.success) {
        throw new Error(response.message || '获取支持站点失败');
      }

      const sitesData = response.data || response;

      return {
        sites: sitesData.sites || [],
        metadata: sitesData.metadata || {
          architecture: 'modular_parsers',
          totalSites: 0,
          dataStructureVersion: '2.0'
        },
        // 站点能力映射
        capabilities: this.buildSiteCapabilitiesMap(sitesData.sites || []),
        // 解析器统计
        parserStats: sitesData.parserStats || {},
        lastUpdated: Date.now()
      };

    } catch (error) {
      console.error('获取支持站点失败:', error);
      // 返回默认数据
      return {
        sites: [],
        metadata: {
          architecture: 'modular_parsers',
          totalSites: 0,
          error: error.message
        },
        capabilities: {},
        parserStats: {},
        lastUpdated: Date.now()
      };
    }
  }

  /**
   * 🆕 验证解析器状态 - 新架构端点
   * 对应后端 validateParserHandler
   */
  async validateParser(sourceType) {
    if (!sourceType) {
      throw new Error('源类型不能为空');
    }

    try {
      console.log(`验证解析器状态 (新架构): ${sourceType}`);

      const params = new URLSearchParams({ sourceType });
      const response = await apiService.request(`${DETAIL_CONFIG_ENDPOINTS.VALIDATE_PARSER}?${params}`);

      if (!response.success) {
        throw new Error(response.message || '验证解析器失败');
      }

      const validationData = response.data || response;

      return {
        sourceType,
        validation: validationData.validation || {
          isValid: false,
          errors: ['验证失败'],
          features: []
        },
        metadata: validationData.metadata || {
          architecture: 'modular_parsers',
          timestamp: Date.now()
        },
        // 解析器详细信息
        parserInfo: validationData.parserInfo || {},
        // 性能指标
        performance: validationData.performance || {},
        // 建议和优化
        suggestions: validationData.suggestions || []
      };

    } catch (error) {
      console.error('验证解析器失败:', error);
      return {
        sourceType,
        validation: {
          isValid: false,
          errors: [error.message],
          features: []
        },
        metadata: {
          architecture: 'modular_parsers',
          timestamp: Date.now(),
          error: error.message
        },
        parserInfo: {},
        performance: {},
        suggestions: []
      };
    }
  }

  /**
   * 🆕 获取服务统计信息 - 新架构端点
   * 对应后端 getServiceStatsHandler
   */
  async getServiceStats() {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    try {
      console.log('获取服务统计信息 (新架构)');

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.SERVICE_STATS);

      if (!response.success) {
        throw new Error(response.message || '获取服务统计失败');
      }

      const statsData = response.data || response;

      return {
        stats: statsData.stats || this.getDefaultServiceStats(),
        timestamp: statsData.timestamp || Date.now(),
        // 🆕 新架构特有统计
        parserFactory: statsData.parserFactory || {},
        supportedSites: statsData.supportedSites || [],
        serviceInfo: statsData.serviceInfo || {
          version: '2.0.0',
          architecture: 'modular_parsers'
        },
        // 性能指标
        performance: statsData.performance || {},
        // 健康状态
        health: statsData.health || { status: 'unknown' }
      };

    } catch (error) {
      console.error('获取服务统计失败:', error);
      return {
        stats: this.getDefaultServiceStats(),
        timestamp: Date.now(),
        error: error.message,
        parserFactory: {},
        supportedSites: [],
        serviceInfo: {
          version: '2.0.0',
          architecture: 'modular_parsers',
          error: error.message
        },
        performance: {},
        health: { status: 'error', error: error.message }
      };
    }
  }

  /**
   * 🆕 重新加载解析器 - 新架构端点（管理员功能）
   * 对应后端 reloadParserHandler
   */
  async reloadParser(sourceType) {
    if (!authManager.isAuthenticated()) {
      throw new Error('用户未认证');
    }

    if (!sourceType) {
      throw new Error('源类型不能为空');
    }

    try {
      console.log(`重新加载解析器 (新架构): ${sourceType}`);

      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.RELOAD_PARSER, {
        method: 'POST',
        body: JSON.stringify({ sourceType })
      });

      if (!response.success) {
        throw new Error(response.message || '重载解析器失败');
      }

      const reloadData = response.data || response;

      return {
        success: reloadData.success !== false,
        sourceType,
        message: reloadData.message || `${sourceType} 解析器重载成功`,
        // 🆕 重载详细信息
        reloadInfo: reloadData.reloadInfo || {
          reloadedAt: Date.now(),
          previousVersion: null,
          newVersion: null
        },
        // 重载后的验证结果
        validation: reloadData.validation || {},
        // 性能对比
        performanceComparison: reloadData.performanceComparison || {}
      };

    } catch (error) {
      console.error('重载解析器失败:', error);
      return {
        success: false,
        sourceType,
        message: `${sourceType} 解析器重载失败: ${error.message}`,
        error: error.message,
        reloadInfo: {
          reloadedAt: Date.now(),
          error: error.message
        },
        validation: {},
        performanceComparison: {}
      };
    }
  }

  /**
   * 验证配置数据 - 增强版本，支持新架构
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    if (!config || typeof config !== 'object') {
      errors.push('配置数据必须是对象格式');
      return { valid: false, errors, warnings };
    }

    // 验证提取超时时间
    if (config.extractionTimeout !== undefined) {
      const timeout = Number(config.extractionTimeout);
      if (isNaN(timeout) || 
          timeout < CONFIG_VALIDATION_RULES.extractionTimeout.min || 
          timeout > CONFIG_VALIDATION_RULES.extractionTimeout.max) {
        errors.push(`提取超时时间必须在 ${CONFIG_VALIDATION_RULES.extractionTimeout.min}-${CONFIG_VALIDATION_RULES.extractionTimeout.max}ms 之间`);
      }
      if (timeout > 20000) {
        warnings.push('超时时间设置过长可能影响用户体验');
      }
    }

    // 验证缓存时长
    if (config.cacheDuration !== undefined) {
      const duration = Number(config.cacheDuration);
      if (isNaN(duration) || 
          duration < CONFIG_VALIDATION_RULES.cacheDuration.min || 
          duration > CONFIG_VALIDATION_RULES.cacheDuration.max) {
        errors.push(`缓存时长必须在 ${CONFIG_VALIDATION_RULES.cacheDuration.min}-${CONFIG_VALIDATION_RULES.cacheDuration.max}ms 之间`);
      }
    }

    // 验证批量大小
    if (config.extractionBatchSize !== undefined) {
      const batchSize = Number(config.extractionBatchSize);
      if (isNaN(batchSize) || 
          batchSize < CONFIG_VALIDATION_RULES.extractionBatchSize.min || 
          batchSize > CONFIG_VALIDATION_RULES.extractionBatchSize.max) {
        errors.push(`批量大小必须在 ${CONFIG_VALIDATION_RULES.extractionBatchSize.min}-${CONFIG_VALIDATION_RULES.extractionBatchSize.max} 之间`);
      }
      if (batchSize > 10) {
        warnings.push('批量大小过大可能导致请求阻塞');
      }
    }

    // 验证下载链接数量
    if (config.maxDownloadLinks !== undefined) {
      const maxLinks = Number(config.maxDownloadLinks);
      if (isNaN(maxLinks) || 
          maxLinks < CONFIG_VALIDATION_RULES.maxDownloadLinks.min || 
          maxLinks > CONFIG_VALIDATION_RULES.maxDownloadLinks.max) {
        errors.push(`最大下载链接数必须在 ${CONFIG_VALIDATION_RULES.maxDownloadLinks.min}-${CONFIG_VALIDATION_RULES.maxDownloadLinks.max} 之间`);
      }
    }

    // 验证磁力链接数量
    if (config.maxMagnetLinks !== undefined) {
      const maxMagnets = Number(config.maxMagnetLinks);
      if (isNaN(maxMagnets) || 
          maxMagnets < CONFIG_VALIDATION_RULES.maxMagnetLinks.min || 
          maxMagnets > CONFIG_VALIDATION_RULES.maxMagnetLinks.max) {
        errors.push(`最大磁力链接数必须在 ${CONFIG_VALIDATION_RULES.maxMagnetLinks.min}-${CONFIG_VALIDATION_RULES.maxMagnetLinks.max} 之间`);
      }
    }

    // 验证截图数量
    if (config.maxScreenshots !== undefined) {
      const maxScreenshots = Number(config.maxScreenshots);
      if (isNaN(maxScreenshots) || 
          maxScreenshots < CONFIG_VALIDATION_RULES.maxScreenshots.min || 
          maxScreenshots > CONFIG_VALIDATION_RULES.maxScreenshots.max) {
        errors.push(`最大截图数必须在 ${CONFIG_VALIDATION_RULES.maxScreenshots.min}-${CONFIG_VALIDATION_RULES.maxScreenshots.max} 之间`);
      }
    }

    // 验证内容过滤关键词
    if (config.contentFilterKeywords !== undefined) {
      if (!Array.isArray(config.contentFilterKeywords)) {
        errors.push('内容过滤关键词必须是数组格式');
      } else if (config.contentFilterKeywords.length > CONFIG_VALIDATION_RULES.maxFilterKeywords.max) {
        errors.push(`内容过滤关键词数量不能超过${CONFIG_VALIDATION_RULES.maxFilterKeywords.max}个`);
      }
    }

    // 验证依赖关系
    if (config.autoExtractDetails && !config.enableDetailExtraction) {
      errors.push('启用自动提取需要先启用详情提取功能');
    }
    
    if (config.maxAutoExtractions && !config.autoExtractDetails) {
      warnings.push('设置了最大自动提取数量但未启用自动提取');
    }
    
    if (config.enableLocalCache && !config.enableCache) {
      errors.push('启用本地缓存需要先启用缓存功能');
    }
    
    if (config.maxRetryAttempts && !config.enableRetry) {
      warnings.push('设置了重试次数但未启用重试功能');
    }

    // 🆕 新架构特有验证
    if (config.enableConcurrentExtraction && config.maxConcurrentExtractions === 1) {
      warnings.push('启用并发提取但并发数为1，建议增加并发数或关闭并发功能');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 比较两个配置并检测变更 - 增强版本
   */
  async getConfigComparison(newConfig) {
    try {
      const currentConfigData = await this.getUserConfig();
      const currentConfig = currentConfigData.config;
      
      return {
        changes: detectConfigChanges(currentConfig, newConfig),
        isSignificant: this.isSignificantChange(currentConfig, newConfig),
        performanceImpact: this.assessPerformanceImpact(currentConfig, newConfig),
        recommendations: this.generateRecommendations(newConfig),
        // 🆕 新架构增强分析
        parserImpact: this.assessParserImpact(currentConfig, newConfig),
        securityImpact: this.assessSecurityImpact(currentConfig, newConfig),
        compatibilityCheck: this.checkCompatibility(newConfig)
      };
    } catch (error) {
      console.error('配置比较失败:', error);
      return {
        changes: { changed: [], added: [], removed: [] },
        isSignificant: false,
        performanceImpact: 'unknown',
        recommendations: [],
        parserImpact: 'unknown',
        securityImpact: 'safe',
        compatibilityCheck: { compatible: true, issues: [] }
      };
    }
  }

  // ===================== 新架构特有方法 =====================

  /**
   * 构建站点能力映射
   */
  buildSiteCapabilitiesMap(sites) {
    const capabilities = {};
    
    sites.forEach(site => {
      if (site.sourceType && site.siteInfo) {
        capabilities[site.sourceType] = {
          features: site.siteInfo.features || [],
          quality: site.siteInfo.quality || 'unknown',
          performance: site.siteInfo.performance || {},
          limitations: site.siteInfo.limitations || [],
          lastValidated: site.siteInfo.lastValidated || null
        };
      }
    });
    
    return capabilities;
  }

  /**
   * 评估解析器影响
   */
  assessParserImpact(oldConfig, newConfig) {
    const significantParserFields = [
      'enableStrictDomainCheck',
      'enableSpamFilter',
      'validateImageUrls',
      'validateDownloadLinks'
    ];
    
    const hasParserChanges = significantParserFields.some(field => 
      oldConfig[field] !== newConfig[field]
    );
    
    if (hasParserChanges) {
      return 'moderate';
    }
    
    return 'minimal';
  }

  /**
   * 评估安全影响
   */
  assessSecurityImpact(oldConfig, newConfig) {
    const securityFields = [
      'enableStrictDomainCheck',
      'enableSpamFilter',
      'validateImageUrls',
      'validateDownloadLinks'
    ];
    
    const securityChanges = securityFields.filter(field => 
      oldConfig[field] !== newConfig[field]
    );
    
    const hasSecurityReduction = securityChanges.some(field => 
      oldConfig[field] === true && newConfig[field] === false
    );
    
    if (hasSecurityReduction) {
      return 'reduced';
    }
    
    const hasSecurityEnhancement = securityChanges.some(field => 
      oldConfig[field] === false && newConfig[field] === true
    );
    
    if (hasSecurityEnhancement) {
      return 'enhanced';
    }
    
    return 'safe';
  }

  /**
   * 检查兼容性
   */
  checkCompatibility(config) {
    const issues = [];
    
    // 检查新架构兼容性
    if (config.enableDetailExtraction && !config.enableCache) {
      issues.push({
        type: 'performance',
        message: '禁用缓存可能导致新架构性能下降',
        severity: 'warning'
      });
    }
    
    if (config.maxConcurrentExtractions > 5) {
      issues.push({
        type: 'resource',
        message: '并发数过高可能导致资源耗尽',
        severity: 'warning'
      });
    }
    
    return {
      compatible: issues.filter(i => i.severity === 'error').length === 0,
      issues
    };
  }

  /**
   * 获取默认服务统计
   */
  getDefaultServiceStats() {
    return {
      parserFactory: {
        supportedSites: 0,
        cachedParsers: 0,
        supportedSitesList: [],
        cachedParsersList: []
      },
      supportedSites: [],
      serviceInfo: {
        version: '2.0.0',
        architecture: 'modular_parsers',
        features: []
      }
    };
  }

  /**
   * 获取默认配置响应
   */
  getDefaultConfigResponse() {
    return {
      config: { ...DEFAULT_USER_CONFIG },
      metadata: this.getDefaultMetadata(),
      presets: CONFIG_PRESETS,
      usage: this.getDefaultUsageStats(),
      isDefault: true,
      supportedSites: [],
      parserStats: {},
      serviceInfo: {
        version: '2.0.0',
        architecture: 'modular_parsers'
      }
    };
  }

  // ===================== 保持向后兼容的方法 =====================

  /**
   * 判断是否为重大配置变更
   */
  isSignificantChange(oldConfig, newConfig) {
    const significantFields = [
      'enableDetailExtraction',
      'autoExtractDetails',
      'extractionTimeout',
      'extractionBatchSize',
      'maxConcurrentExtractions',
      'enableCache'
    ];
    
    return significantFields.some(field => 
      oldConfig[field] !== newConfig[field]
    );
  }

  /**
   * 评估性能影响
   */
  assessPerformanceImpact(oldConfig, newConfig) {
    let impact = 0;
    
    // 超时时间影响
    if (newConfig.extractionTimeout > oldConfig.extractionTimeout) {
      impact -= 1; // 更慢
    } else if (newConfig.extractionTimeout < oldConfig.extractionTimeout) {
      impact += 1; // 更快，但可能更多失败
    }
    
    // 并发数影响
    if (newConfig.maxConcurrentExtractions > oldConfig.maxConcurrentExtractions) {
      impact += 2; // 显著提升性能
    } else if (newConfig.maxConcurrentExtractions < oldConfig.maxConcurrentExtractions) {
      impact -= 2; // 显著降低性能
    }
    
    // 批量大小影响
    if (newConfig.extractionBatchSize > oldConfig.extractionBatchSize) {
      impact += 1; // 轻微提升
    } else if (newConfig.extractionBatchSize < oldConfig.extractionBatchSize) {
      impact -= 1; // 轻微降低
    }
    
    // 缓存影响
    if (newConfig.enableCache && !oldConfig.enableCache) {
      impact += 3; // 缓存带来显著性能提升
    } else if (!newConfig.enableCache && oldConfig.enableCache) {
      impact -= 3; // 禁用缓存显著影响性能
    }
    
    if (impact > 2) return 'positive';
    if (impact < -2) return 'negative';
    return 'neutral';
  }

  /**
   * 生成配置建议
   */
  generateRecommendations(config) {
    const recommendations = [];
    
    if (config.extractionTimeout > 20000) {
      recommendations.push({
        type: 'warning',
        message: '超时时间过长可能影响用户体验',
        suggestion: '建议设置为15秒以下'
      });
    }
    
    if (config.extractionBatchSize > 5) {
      recommendations.push({
        type: 'warning',
        message: '批量大小过大可能导致请求阻塞',
        suggestion: '建议设置为3-5之间'
      });
    }
    
    if (!config.enableCache) {
      recommendations.push({
        type: 'performance',
        message: '禁用缓存会显著影响性能',
        suggestion: '建议启用缓存以提高响应速度'
      });
    }
    
    if (config.maxConcurrentExtractions === 1 && config.enableConcurrentExtraction) {
      recommendations.push({
        type: 'optimization',
        message: '并发数设置为1时建议关闭并发提取',
        suggestion: '要么增加并发数，要么关闭并发功能'
      });
    }
    
    if (config.autoExtractDetails && config.maxAutoExtractions > 8) {
      recommendations.push({
        type: 'warning',
        message: '自动提取数量过多可能影响页面加载',
        suggestion: '建议设置为5个以下'
      });
    }
    
    // 🆕 新架构特有建议
    if (config.enableConcurrentExtraction && config.maxConcurrentExtractions > 3 && config.extractionTimeout < 10000) {
      recommendations.push({
        type: 'optimization',
        message: '高并发配合短超时可能导致频繁失败',
        suggestion: '建议适当增加超时时间或降低并发数'
      });
    }
    
    return recommendations;
  }

  // ===================== 缓存管理方法 =====================

  /**
   * 检查配置缓存是否有效
   */
  isConfigCacheValid() {
    return this.configCache && 
           (Date.now() - this.lastCacheTime) < this.cacheExpiration;
  }

  /**
   * 更新配置缓存
   */
  updateConfigCache(configData) {
    this.configCache = configData;
    this.lastCacheTime = Date.now();
  }

  /**
   * 清除配置缓存
   */
  clearConfigCache() {
    this.configCache = null;
    this.lastCacheTime = 0;
  }

  // ===================== 默认数据方法 =====================

  /**
   * 获取默认元数据
   */
  getDefaultMetadata() {
    return {
      groups: [],
      supportedSources: [],
      systemLimits: CONFIG_VALIDATION_RULES,
      lastUpdated: Date.now(),
      version: '2.0.0',
      architecture: 'modular_parsers'
    };
  }

  /**
   * 获取默认使用统计
   */
  getDefaultUsageStats() {
    return {
      totalExtractions: 0,
      successfulExtractions: 0,
      cachedExtractions: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: 0,
      successRate: 0,
      cacheHitRate: 0
    };
  }

  // ===================== 工具方法 =====================

  /**
   * 格式化配置用于显示
   */
  formatConfigForDisplay(config) {
    return {
      ...config,
      extractionTimeoutSeconds: Math.round(config.extractionTimeout / 1000),
      cacheDurationHours: Math.round(config.cacheDuration / (1000 * 60 * 60)),
      formattedTimeout: this.formatTime(config.extractionTimeout),
      formattedCacheDuration: this.formatDuration(config.cacheDuration)
    };
  }

  /**
   * 格式化时间显示
   */
  formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }

  /**
   * 格式化时长显示
   */
  formatDuration(ms) {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}天`;
    if (hours > 0) return `${hours}小时`;
    return `${Math.round(ms / (1000 * 60))}分钟`;
  }

  /**
   * 检查服务健康状态 - 适配新架构
   */
  async checkServiceHealth() {
    try {
      const startTime = Date.now();
      
      // 🆕 使用新架构的健康检查端点
      const [configHealth, sitesHealth, statsHealth] = await Promise.allSettled([
        this.getUserConfig(false), // 强制从服务器获取
        this.getSupportedSites(),
        this.getServiceStats()
      ]);
      
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: configHealth.status === 'fulfilled',
        responseTime,
        lastCheck: Date.now(),
        cacheStatus: this.isConfigCacheValid() ? 'valid' : 'expired',
        // 🆕 新架构健康状态
        components: {
          config: configHealth.status === 'fulfilled',
          sites: sitesHealth.status === 'fulfilled',
          stats: statsHealth.status === 'fulfilled'
        },
        architecture: '2.0.0',
        features: {
          modularParsers: true,
          dynamicConfiguration: true,
          enhancedValidation: true
        }
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: Date.now(),
        cacheStatus: 'unavailable',
        components: {
          config: false,
          sites: false,
          stats: false
        },
        architecture: '2.0.0'
      };
    }
  }

  /**
   * 导出当前配置 - 增强版本
   */
  async exportConfig(format = 'json') {
    try {
      const [configData, sitesData, statsData] = await Promise.all([
        this.getUserConfig(),
        this.getSupportedSites().catch(() => ({ sites: [] })),
        this.getServiceStats().catch(() => ({ stats: {} }))
      ]);
      
      const exportData = {
        config: configData.config,
        metadata: {
          exportedAt: Date.now(),
          exportedBy: authManager.getCurrentUser()?.username || 'unknown',
          version: '2.0.0',
          architecture: 'modular_parsers',
          source: 'detail-config-api'
        },
        // 🆕 新架构导出数据
        supportedSites: sitesData.sites || [],
        serviceStats: statsData.stats || {},
        validation: configData.validation || {}
      };

      switch (format) {
        case 'json':
          return JSON.stringify(exportData, null, 2);
        case 'compact':
          return JSON.stringify(exportData);
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }
    } catch (error) {
      console.error('导出配置失败:', error);
      throw error;
    }
  }

  /**
   * 重置服务状态
   */
  reset() {
    this.clearConfigCache();
    console.log('详情配置API服务已重置 (新架构 v2.0.0)');
  }

  /**
   * 获取服务信息
   */
  getServiceInfo() {
    return {
      version: this.version,
      architecture: 'modular_parsers',
      features: {
        dynamicConfiguration: true,
        presetManagement: true,
        parserValidation: true,
        serviceStats: true,
        parserReload: true,
        enhancedValidation: true,
        securityAssessment: true,
        compatibilityCheck: true
      },
      endpoints: DETAIL_CONFIG_ENDPOINTS,
      cacheInfo: {
        enabled: true,
        expiration: this.cacheExpiration,
        isValid: this.isConfigCacheValid(),
        lastUpdate: this.lastCacheTime
      }
    };
  }
}

// 创建单例实例
export const detailConfigAPI = new DetailConfigAPI();
export default detailConfigAPI;