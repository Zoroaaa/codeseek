// src/services/detail-config-service.js - 详情提取配置管理服务
import { SYSTEM_VALIDATION } from '../constants.js';

export class DetailConfigService {
  constructor() {
    this.defaultConfig = this.getDefaultUserConfig();
  }

  /**
   * 获取用户默认配置
   */
  getDefaultUserConfig() {
    return {
      // 基础功能开关
      enableDetailExtraction: true,
      autoExtractDetails: false,
      
      // 提取数量控制
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      maxDownloadLinks: 10,
      maxMagnetLinks: 10,
      maxScreenshots: 10,
      
      // 时间控制
      extractionTimeout: 15000, // 15秒
      cacheDuration: 86400000, // 24小时
      
      // 重试控制
      enableRetry: true,
      maxRetryAttempts: 2,
      
      // 缓存控制
      enableCache: true,
      enableLocalCache: true,
      
      // 显示控制
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      showExtractedTags: true,
      showRating: true,
      showDescription: true,
      
      // 界面控制
      compactMode: false,
      enableImagePreview: true,
      showExtractionProgress: true,
      enableProgressNotifications: true,
      
      // 内容过滤
      enableContentFilter: false,
      contentFilterKeywords: [],
      
      // 高级选项
      enableStrictDomainCheck: true,
      enableSpamFilter: true,
      preferOriginalSources: true,
      enableAutoCodeExtraction: true,
      
      // 性能优化
      enableConcurrentExtraction: true,
      maxConcurrentExtractions: 3,
      enableSmartBatching: true,
      
      // 数据质量
      requireMinimumData: true,
      skipLowQualityResults: false,
      validateImageUrls: true,
      validateDownloadLinks: true
    };
  }

  /**
   * 从数据库获取用户配置
   */
  async getUserConfig(env, userId) {
    try {
      const userConfig = await env.DB.prepare(`
        SELECT * FROM detail_extraction_config WHERE user_id = ?
      `).bind(userId).first();

      if (!userConfig) {
        return this.defaultConfig;
      }

      return {
        // 基础功能开关
        enableDetailExtraction: Boolean(userConfig.enable_detail_extraction),
        autoExtractDetails: Boolean(userConfig.auto_extract_details),
        
        // 提取数量控制
        maxAutoExtractions: userConfig.max_auto_extractions || this.defaultConfig.maxAutoExtractions,
        extractionBatchSize: userConfig.extraction_batch_size || this.defaultConfig.extractionBatchSize,
        maxDownloadLinks: userConfig.max_download_links || this.defaultConfig.maxDownloadLinks,
        maxMagnetLinks: userConfig.max_magnet_links || this.defaultConfig.maxMagnetLinks,
        maxScreenshots: userConfig.max_screenshots || this.defaultConfig.maxScreenshots,
        
        // 时间控制
        extractionTimeout: userConfig.extraction_timeout || this.defaultConfig.extractionTimeout,
        cacheDuration: userConfig.cache_duration || this.defaultConfig.cacheDuration,
        
        // 重试控制
        enableRetry: Boolean(userConfig.enable_retry),
        maxRetryAttempts: userConfig.max_retry_attempts || this.defaultConfig.maxRetryAttempts,
        
        // 缓存控制
        enableCache: Boolean(userConfig.enable_cache),
        enableLocalCache: Boolean(userConfig.enable_local_cache),
        
        // 显示控制
        showScreenshots: Boolean(userConfig.show_screenshots),
        showDownloadLinks: Boolean(userConfig.show_download_links),
        showMagnetLinks: Boolean(userConfig.show_magnet_links),
        showActressInfo: Boolean(userConfig.show_actress_info),
        showExtractedTags: Boolean(userConfig.show_extracted_tags),
        showRating: Boolean(userConfig.show_rating),
        showDescription: Boolean(userConfig.show_description),
        
        // 界面控制
        compactMode: Boolean(userConfig.compact_mode),
        enableImagePreview: Boolean(userConfig.enable_image_preview),
        showExtractionProgress: Boolean(userConfig.show_extraction_progress),
        enableProgressNotifications: Boolean(userConfig.enable_progress_notifications),
        
        // 内容过滤
        enableContentFilter: Boolean(userConfig.enable_content_filter),
        contentFilterKeywords: JSON.parse(userConfig.content_filter_keywords || '[]'),
        
        // 高级选项
        enableStrictDomainCheck: Boolean(userConfig.enable_strict_domain_check),
        enableSpamFilter: Boolean(userConfig.enable_spam_filter),
        preferOriginalSources: Boolean(userConfig.prefer_original_sources),
        enableAutoCodeExtraction: Boolean(userConfig.enable_auto_code_extraction),
        
        // 性能优化
        enableConcurrentExtraction: Boolean(userConfig.enable_concurrent_extraction),
        maxConcurrentExtractions: userConfig.max_concurrent_extractions || this.defaultConfig.maxConcurrentExtractions,
        enableSmartBatching: Boolean(userConfig.enable_smart_batching),
        
        // 数据质量
        requireMinimumData: Boolean(userConfig.require_minimum_data),
        skipLowQualityResults: Boolean(userConfig.skip_low_quality_results),
        validateImageUrls: Boolean(userConfig.validate_image_urls),
        validateDownloadLinks: Boolean(userConfig.validate_download_links)
      };
    } catch (error) {
      console.error('获取用户配置失败:', error);
      return this.defaultConfig;
    }
  }

  /**
   * 保存用户配置
   */
  async saveUserConfig(env, userId, config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`配置验证失败: ${validation.errors.join(', ')}`);
      }

      const configId = `${userId}_detail_config`;
      const now = Date.now();

      await env.DB.prepare(`
        INSERT OR REPLACE INTO detail_extraction_config (
          id, user_id,
          enable_detail_extraction, auto_extract_details, max_auto_extractions,
          extraction_batch_size, max_download_links, max_magnet_links, max_screenshots,
          extraction_timeout, cache_duration,
          enable_retry, max_retry_attempts,
          enable_cache, enable_local_cache,
          show_screenshots, show_download_links, show_magnet_links, show_actress_info,
          show_extracted_tags, show_rating, show_description,
          compact_mode, enable_image_preview, show_extraction_progress, enable_progress_notifications,
          enable_content_filter, content_filter_keywords,
          enable_strict_domain_check, enable_spam_filter, prefer_original_sources, enable_auto_code_extraction,
          enable_concurrent_extraction, max_concurrent_extractions, enable_smart_batching,
          require_minimum_data, skip_low_quality_results, validate_image_urls, validate_download_links,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        configId, userId,
        config.enableDetailExtraction ? 1 : 0,
        config.autoExtractDetails ? 1 : 0,
        config.maxAutoExtractions,
        config.extractionBatchSize,
        config.maxDownloadLinks,
        config.maxMagnetLinks,
        config.maxScreenshots,
        config.extractionTimeout,
        config.cacheDuration,
        config.enableRetry ? 1 : 0,
        config.maxRetryAttempts,
        config.enableCache ? 1 : 0,
        config.enableLocalCache ? 1 : 0,
        config.showScreenshots ? 1 : 0,
        config.showDownloadLinks ? 1 : 0,
        config.showMagnetLinks ? 1 : 0,
        config.showActressInfo ? 1 : 0,
        config.showExtractedTags ? 1 : 0,
        config.showRating ? 1 : 0,
        config.showDescription ? 1 : 0,
        config.compactMode ? 1 : 0,
        config.enableImagePreview ? 1 : 0,
        config.showExtractionProgress ? 1 : 0,
        config.enableProgressNotifications ? 1 : 0,
        config.enableContentFilter ? 1 : 0,
        JSON.stringify(config.contentFilterKeywords || []),
        config.enableStrictDomainCheck ? 1 : 0,
        config.enableSpamFilter ? 1 : 0,
        config.preferOriginalSources ? 1 : 0,
        config.enableAutoCodeExtraction ? 1 : 0,
        config.enableConcurrentExtraction ? 1 : 0,
        config.maxConcurrentExtractions,
        config.enableSmartBatching ? 1 : 0,
        config.requireMinimumData ? 1 : 0,
        config.skipLowQualityResults ? 1 : 0,
        config.validateImageUrls ? 1 : 0,
        config.validateDownloadLinks ? 1 : 0,
        now, now
      ).run();

      return { success: true, warnings: validation.warnings };
    } catch (error) {
      console.error('保存用户配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];

    // 验证提取超时时间
    if (config.extractionTimeout !== undefined) {
      const timeout = Number(config.extractionTimeout);
      if (isNaN(timeout) || timeout < SYSTEM_VALIDATION.extractionTimeout.min || 
          timeout > SYSTEM_VALIDATION.extractionTimeout.max) {
        errors.push(`提取超时时间必须在 ${SYSTEM_VALIDATION.extractionTimeout.min}-${SYSTEM_VALIDATION.extractionTimeout.max}ms 之间`);
      }
      if (timeout > 20000) {
        warnings.push('超时时间设置过长可能影响用户体验');
      }
    }

    // 验证缓存时长
    if (config.cacheDuration !== undefined) {
      const duration = Number(config.cacheDuration);
      if (isNaN(duration) || duration < SYSTEM_VALIDATION.cacheDuration.min || 
          duration > SYSTEM_VALIDATION.cacheDuration.max) {
        errors.push(`缓存时长必须在 ${SYSTEM_VALIDATION.cacheDuration.min}-${SYSTEM_VALIDATION.cacheDuration.max}ms 之间`);
      }
    }

    // 验证批量大小
    if (config.extractionBatchSize !== undefined) {
      const batchSize = Number(config.extractionBatchSize);
      if (isNaN(batchSize) || batchSize < SYSTEM_VALIDATION.extractionBatchSize.min || 
          batchSize > SYSTEM_VALIDATION.extractionBatchSize.max) {
        errors.push(`批量大小必须在 ${SYSTEM_VALIDATION.extractionBatchSize.min}-${SYSTEM_VALIDATION.extractionBatchSize.max} 之间`);
      }
      if (batchSize > 10) {
        warnings.push('批量大小过大可能导致请求阻塞');
      }
    }

    // 验证下载链接数量
    if (config.maxDownloadLinks !== undefined) {
      const maxLinks = Number(config.maxDownloadLinks);
      if (isNaN(maxLinks) || maxLinks < SYSTEM_VALIDATION.maxDownloadLinks.min || 
          maxLinks > SYSTEM_VALIDATION.maxDownloadLinks.max) {
        errors.push(`最大下载链接数必须在 ${SYSTEM_VALIDATION.maxDownloadLinks.min}-${SYSTEM_VALIDATION.maxDownloadLinks.max} 之间`);
      }
    }

    // 验证磁力链接数量
    if (config.maxMagnetLinks !== undefined) {
      const maxMagnets = Number(config.maxMagnetLinks);
      if (isNaN(maxMagnets) || maxMagnets < SYSTEM_VALIDATION.maxMagnetLinks.min || 
          maxMagnets > SYSTEM_VALIDATION.maxMagnetLinks.max) {
        errors.push(`最大磁力链接数必须在 ${SYSTEM_VALIDATION.maxMagnetLinks.min}-${SYSTEM_VALIDATION.maxMagnetLinks.max} 之间`);
      }
    }

    // 验证截图数量
    if (config.maxScreenshots !== undefined) {
      const maxScreenshots = Number(config.maxScreenshots);
      if (isNaN(maxScreenshots) || maxScreenshots < SYSTEM_VALIDATION.maxScreenshots.min || 
          maxScreenshots > SYSTEM_VALIDATION.maxScreenshots.max) {
        errors.push(`最大截图数必须在 ${SYSTEM_VALIDATION.maxScreenshots.min}-${SYSTEM_VALIDATION.maxScreenshots.max} 之间`);
      }
    }

    // 验证内容过滤关键词
    if (config.contentFilterKeywords !== undefined) {
      if (!Array.isArray(config.contentFilterKeywords)) {
        errors.push('内容过滤关键词必须是数组格式');
      } else if (config.contentFilterKeywords.length > 50) {
        errors.push('内容过滤关键词数量不能超过50个');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 获取配置字段元数据
   */
  getConfigMetadata() {
    return {
      groups: [
        {
          id: 'basic',
          name: '基础设置',
          description: '控制详情提取的基本功能',
          fields: [
            {
              key: 'enableDetailExtraction',
              name: '启用详情提取',
              type: 'boolean',
              description: '开启或关闭详情提取功能',
              default: true
            },
            {
              key: 'autoExtractDetails',
              name: '自动提取详情',
              type: 'boolean',
              description: '在搜索结果中自动提取详情信息',
              default: false,
              dependency: 'enableDetailExtraction'
            },
            {
              key: 'maxAutoExtractions',
              name: '最大自动提取数量',
              type: 'number',
              min: 1,
              max: 10,
              description: '自动提取时的最大数量',
              default: 5,
              dependency: 'autoExtractDetails'
            }
          ]
        },
        {
          id: 'performance',
          name: '性能设置',
          description: '控制提取性能和资源使用',
          fields: [
            {
              key: 'extractionTimeout',
              name: '提取超时时间 (毫秒)',
              type: 'number',
              min: SYSTEM_VALIDATION.extractionTimeout.min,
              max: SYSTEM_VALIDATION.extractionTimeout.max,
              step: 1000,
              description: '单个详情提取的最大等待时间',
              default: 15000
            },
            {
              key: 'extractionBatchSize',
              name: '批量处理大小',
              type: 'number',
              min: SYSTEM_VALIDATION.extractionBatchSize.min,
              max: SYSTEM_VALIDATION.extractionBatchSize.max,
              description: '批量提取时的每批数量',
              default: 3
            },
            {
              key: 'maxConcurrentExtractions',
              name: '最大并发提取数',
              type: 'number',
              min: 1,
              max: 5,
              description: '同时进行的提取任务数量',
              default: 3
            }
          ]
        },
        {
          id: 'content',
          name: '内容设置',
          description: '控制提取的内容类型和数量',
          fields: [
            {
              key: 'maxDownloadLinks',
              name: '最大下载链接数',
              type: 'number',
              min: SYSTEM_VALIDATION.maxDownloadLinks.min,
              max: SYSTEM_VALIDATION.maxDownloadLinks.max,
              description: '单个详情页最大下载链接数',
              default: 10
            },
            {
              key: 'maxMagnetLinks',
              name: '最大磁力链接数',
              type: 'number',
              min: SYSTEM_VALIDATION.maxMagnetLinks.min,
              max: SYSTEM_VALIDATION.maxMagnetLinks.max,
              description: '单个详情页最大磁力链接数',
              default: 10
            },
            {
              key: 'maxScreenshots',
              name: '最大截图数',
              type: 'number',
              min: SYSTEM_VALIDATION.maxScreenshots.min,
              max: SYSTEM_VALIDATION.maxScreenshots.max,
              description: '单个详情页最大截图数',
              default: 10
            }
          ]
        },
        {
          id: 'display',
          name: '显示设置',
          description: '控制详情信息的显示方式',
          fields: [
            {
              key: 'showScreenshots',
              name: '显示截图',
              type: 'boolean',
              description: '在详情中显示截图图片',
              default: true
            },
            {
              key: 'showDownloadLinks',
              name: '显示下载链接',
              type: 'boolean',
              description: '在详情中显示下载链接',
              default: true
            },
            {
              key: 'showMagnetLinks',
              name: '显示磁力链接',
              type: 'boolean',
              description: '在详情中显示磁力链接',
              default: true
            },
            {
              key: 'showActressInfo',
              name: '显示演员信息',
              type: 'boolean',
              description: '在详情中显示演员相关信息',
              default: true
            },
            {
              key: 'compactMode',
              name: '紧凑模式',
              type: 'boolean',
              description: '使用更紧凑的显示布局',
              default: false
            },
            {
              key: 'enableImagePreview',
              name: '启用图片预览',
              type: 'boolean',
              description: '点击图片时显示预览',
              default: true
            }
          ]
        },
        {
          id: 'cache',
          name: '缓存设置',
          description: '控制缓存策略和存储',
          fields: [
            {
              key: 'enableCache',
              name: '启用缓存',
              type: 'boolean',
              description: '缓存提取结果以提高性能',
              default: true
            },
            {
              key: 'cacheDuration',
              name: '缓存时长 (毫秒)',
              type: 'number',
              min: SYSTEM_VALIDATION.cacheDuration.min,
              max: SYSTEM_VALIDATION.cacheDuration.max,
              step: 3600000,
              description: '缓存数据的保存时间',
              default: 86400000,
              dependency: 'enableCache'
            },
            {
              key: 'enableLocalCache',
              name: '启用本地缓存',
              type: 'boolean',
              description: '在浏览器本地存储缓存数据',
              default: true,
              dependency: 'enableCache'
            }
          ]
        },
        {
          id: 'advanced',
          name: '高级设置',
          description: '高级功能和质量控制',
          fields: [
            {
              key: 'enableRetry',
              name: '启用重试',
              type: 'boolean',
              description: '提取失败时自动重试',
              default: true
            },
            {
              key: 'maxRetryAttempts',
              name: '最大重试次数',
              type: 'number',
              min: 1,
              max: 5,
              description: '失败后的最大重试次数',
              default: 2,
              dependency: 'enableRetry'
            },
            {
              key: 'enableStrictDomainCheck',
              name: '启用严格域名检查',
              type: 'boolean',
              description: '严格验证链接域名一致性',
              default: true
            },
            {
              key: 'enableSpamFilter',
              name: '启用垃圾过滤',
              type: 'boolean',
              description: '过滤已知的垃圾域名和链接',
              default: true
            },
            {
              key: 'requireMinimumData',
              name: '要求最少数据',
              type: 'boolean',
              description: '只保留包含足够信息的结果',
              default: true
            }
          ]
        },
        {
          id: 'filter',
          name: '内容过滤',
          description: '过滤和筛选提取的内容',
          fields: [
            {
              key: 'enableContentFilter',
              name: '启用内容过滤',
              type: 'boolean',
              description: '根据关键词过滤内容',
              default: false
            },
            {
              key: 'contentFilterKeywords',
              name: '过滤关键词',
              type: 'array',
              itemType: 'string',
              description: '用于过滤的关键词列表',
              default: [],
              dependency: 'enableContentFilter'
            }
          ]
        }
      ],
      systemLimits: SYSTEM_VALIDATION
    };
  }

  /**
   * 重置配置为默认值
   */
  async resetUserConfig(env, userId) {
    try {
      await env.DB.prepare(`
        DELETE FROM detail_extraction_config WHERE user_id = ?
      `).bind(userId).run();
      
      return { success: true, config: this.defaultConfig };
    } catch (error) {
      console.error('重置用户配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取配置预设
   */
  getConfigPresets() {
    return {
      conservative: {
        name: '保守模式',
        description: '最小化资源使用，适合低配设备',
        config: {
          ...this.defaultConfig,
          autoExtractDetails: false,
          maxAutoExtractions: 3,
          extractionBatchSize: 2,
          maxDownloadLinks: 5,
          maxMagnetLinks: 5,
          maxScreenshots: 5,
          extractionTimeout: 10000,
          maxConcurrentExtractions: 1,
          enableImagePreview: false,
          compactMode: true
        }
      },
      balanced: {
        name: '平衡模式',
        description: '性能和功能的平衡配置',
        config: this.defaultConfig
      },
      aggressive: {
        name: '性能模式',
        description: '最大化提取速度和内容，适合高配设备',
        config: {
          ...this.defaultConfig,
          autoExtractDetails: true,
          maxAutoExtractions: 10,
          extractionBatchSize: 5,
          maxDownloadLinks: 15,
          maxMagnetLinks: 15,
          maxScreenshots: 15,
          extractionTimeout: 25000,
          maxConcurrentExtractions: 5,
          enableConcurrentExtraction: true,
          enableSmartBatching: true,
          cacheDuration: 172800000 // 48小时
        }
      },
      quality: {
        name: '质量优先',
        description: '注重数据质量和准确性',
        config: {
          ...this.defaultConfig,
          extractionTimeout: 20000,
          maxRetryAttempts: 3,
          requireMinimumData: true,
          enableStrictDomainCheck: true,
          validateImageUrls: true,
          validateDownloadLinks: true,
          skipLowQualityResults: true
        }
      }
    };
  }
}

// 创建单例实例
export const detailConfigService = new DetailConfigService();
export default detailConfigService;