// src/services/detail-config-api.js - 详情提取配置API服务
// 与后端 detail.js 配置管理处理器完全对接

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
  }

  /**
   * 获取用户详情提取配置
   * 对应后端 getDetailExtractionConfigHandler
   */
  async getUserConfig(useCache = true) {
    if (!authManager.isAuthenticated()) {
      console.warn('用户未认证，返回默认配置');
      return {
        config: { ...DEFAULT_USER_CONFIG },
        metadata: this.getDefaultMetadata(),
        presets: CONFIG_PRESETS,
        usage: this.getDefaultUsageStats(),
        isDefault: true
      };
    }

    // 检查本地缓存
    if (useCache && this.isConfigCacheValid()) {
      console.log('使用本地缓存的配置');
      return this.configCache;
    }

    try {
      console.log('从服务器获取用户配置');
      const response = await apiService.request(DETAIL_CONFIG_ENDPOINTS.GET_CONFIG);

      if (!response.success) {
        throw new Error(response.message || '获取配置失败');
      }

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
        systemLimits: response.systemLimits || CONFIG_VALIDATION_RULES
      };

      // 更新本地缓存
      this.updateConfigCache(configData);

      return configData;

    } catch (error) {
      console.error('获取用户配置失败:', error);
      
      // 返回默认配置作为降级方案
      return {
        config: { ...DEFAULT_USER_CONFIG },
        metadata: this.getDefaultMetadata(),
        presets: CONFIG_PRESETS,
        usage: this.getDefaultUsageStats(),
        isDefault: true,
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

      console.log('更新用户配置:', { config, validateOnly, preset });

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
        config: validateOnly ? null : (resultData.config || config)
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
      console.log('重置用户配置为默认值');

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
        config: response.config || { ...DEFAULT_USER_CONFIG }
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
      console.log(`应用配置预设: ${presetName}`);

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
        description: response.description || presetInfo.description
      };

    } catch (error) {
      console.error('应用配置预设失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置数据
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

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 比较两个配置并检测变更
   */
  async getConfigComparison(newConfig) {
    try {
      const currentConfigData = await this.getUserConfig();
      const currentConfig = currentConfigData.config;
      
      return {
        changes: detectConfigChanges(currentConfig, newConfig),
        isSignificant: this.isSignificantChange(currentConfig, newConfig),
        performanceImpact: this.assessPerformanceImpact(currentConfig, newConfig),
        recommendations: this.generateRecommendations(newConfig)
      };
    } catch (error) {
      console.error('配置比较失败:', error);
      return {
        changes: { changed: [], added: [], removed: [] },
        isSignificant: false,
        performanceImpact: 'unknown',
        recommendations: []
      };
    }
  }

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
      version: '1.0.0'
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
   * 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const startTime = Date.now();
      await this.getUserConfig(false); // 强制从服务器获取
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        responseTime,
        lastCheck: Date.now(),
        cacheStatus: this.isConfigCacheValid() ? 'valid' : 'expired'
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: Date.now(),
        cacheStatus: 'unavailable'
      };
    }
  }

  /**
   * 导出当前配置
   */
  async exportConfig(format = 'json') {
    try {
      const configData = await this.getUserConfig();
      const exportData = {
        config: configData.config,
        metadata: {
          exportedAt: Date.now(),
          exportedBy: authManager.getCurrentUser()?.username || 'unknown',
          version: '1.0.0',
          source: 'detail-config-api'
        }
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
    console.log('详情配置API服务已重置');
  }
}

// 创建单例实例
export const detailConfigAPI = new DetailConfigAPI();
export default detailConfigAPI;