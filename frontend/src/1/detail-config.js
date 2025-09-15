// src/core/detail-config.js - 与后端 DetailConfigService 完全同步的详情提取配置
// 版本 2.0.0 - 适配模块化解析器架构

// 详情提取配置API端点 - 与后端router.js完全匹配
export const DETAIL_CONFIG_ENDPOINTS = {
  GET_CONFIG: '/api/detail/config',
  UPDATE_CONFIG: '/api/detail/config', 
  RESET_CONFIG: '/api/detail/config/reset',
  APPLY_PRESET: '/api/detail/config/preset',
  VALIDATE_CONFIG: '/api/detail/config/validate', // 可选验证端点
  // 🆕 新架构端点
  SUPPORTED_SITES: '/api/detail/supported-sites',
  VALIDATE_PARSER: '/api/detail/validate-parser',
  SERVICE_STATS: '/api/detail/service-stats',
  RELOAD_PARSER: '/api/detail/reload-parser'
};

// 配置预设类型 - 与后端同步
export const DETAIL_CONFIG_PRESETS = {
  CONSERVATIVE: 'conservative',
  BALANCED: 'balanced', 
  AGGRESSIVE: 'aggressive',
  QUALITY: 'quality'
};

// 详情提取状态 - 与后端 constants.js DETAIL_EXTRACTION_STATUS 同步
export const DETAIL_EXTRACTION_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  TIMEOUT: 'timeout', 
  CACHED: 'cached',
  PARTIAL: 'partial'
};

// 配置验证规则 - 与后端 constants.js SYSTEM_VALIDATION 完全同步
export const CONFIG_VALIDATION_RULES = {
  extractionTimeout: {
    min: 5000,   // 5秒
    max: 30000   // 30秒
  },
  cacheDuration: {
    min: 3600000,    // 1小时
    max: 604800000   // 7天
  },
  extractionBatchSize: {
    min: 1,
    max: 20
  },
  maxDownloadLinks: {
    min: 1,
    max: 15
  },
  maxMagnetLinks: {
    min: 1,
    max: 15
  },
  maxScreenshots: {
    min: 1,
    max: 20
  },
  maxAutoExtractions: {
    min: 1,
    max: 10
  },
  maxConcurrentExtractions: {
    min: 1,
    max: 5
  },
  maxFilterKeywords: {
    min: 0,
    max: 50
  }
};

// 默认用户配置 - 与后端 DetailConfigService.getDefaultUserConfig() 完全同步
export const DEFAULT_USER_CONFIG = {
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

// 配置字段组定义 - 与后端 DetailConfigService.getConfigMetadata() 同步
export const CONFIG_FIELD_GROUPS = [
  {
    id: 'basic',
    name: '基础设置',
    description: '控制详情提取的基本功能',
    icon: '⚙️',
    fields: [
      {
        key: 'enableDetailExtraction',
        name: '启用详情提取',
        type: 'boolean',
        description: '开启或关闭详情提取功能',
        default: true,
        required: true
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
        min: CONFIG_VALIDATION_RULES.maxAutoExtractions.min,
        max: CONFIG_VALIDATION_RULES.maxAutoExtractions.max,
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
    icon: '⚡',
    fields: [
      {
        key: 'extractionTimeout',
        name: '提取超时时间 (毫秒)',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.extractionTimeout.min,
        max: CONFIG_VALIDATION_RULES.extractionTimeout.max,
        step: 1000,
        description: '单个详情提取的最大等待时间',
        default: 15000
      },
      {
        key: 'extractionBatchSize',
        name: '批量处理大小',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.extractionBatchSize.min,
        max: CONFIG_VALIDATION_RULES.extractionBatchSize.max,
        description: '批量提取时的每批数量',
        default: 3
      },
      {
        key: 'maxConcurrentExtractions',
        name: '最大并发提取数',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.maxConcurrentExtractions.min,
        max: CONFIG_VALIDATION_RULES.maxConcurrentExtractions.max,
        description: '同时进行的提取任务数量',
        default: 3,
        dependency: 'enableConcurrentExtraction'
      }
    ]
  },
  {
    id: 'content',
    name: '内容设置',
    description: '控制提取的内容类型和数量',
    icon: '📄',
    fields: [
      {
        key: 'maxDownloadLinks',
        name: '最大下载链接数',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.maxDownloadLinks.min,
        max: CONFIG_VALIDATION_RULES.maxDownloadLinks.max,
        description: '单个详情页最大下载链接数',
        default: 10
      },
      {
        key: 'maxMagnetLinks',
        name: '最大磁力链接数',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.maxMagnetLinks.min,
        max: CONFIG_VALIDATION_RULES.maxMagnetLinks.max,
        description: '单个详情页最大磁力链接数',
        default: 10
      },
      {
        key: 'maxScreenshots',
        name: '最大截图数',
        type: 'number',
        min: CONFIG_VALIDATION_RULES.maxScreenshots.min,
        max: CONFIG_VALIDATION_RULES.maxScreenshots.max,
        description: '单个详情页最大截图数',
        default: 10
      }
    ]
  },
  {
    id: 'display',
    name: '显示设置',
    description: '控制详情信息的显示方式',
    icon: '👁️',
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
    icon: '💾',
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
        min: CONFIG_VALIDATION_RULES.cacheDuration.min,
        max: CONFIG_VALIDATION_RULES.cacheDuration.max,
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
    icon: '🔧',
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
    icon: '🔍',
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
];

// 配置预设定义 - 与后端 DetailConfigService.getConfigPresets() 完全同步
export const CONFIG_PRESETS = {
  conservative: {
    name: '保守模式',
    description: '最小化资源使用，适合低配设备',
    icon: '🐌',
    config: {
      ...DEFAULT_USER_CONFIG,
      autoExtractDetails: false,
      maxAutoExtractions: 3,
      extractionBatchSize: 2,
      maxDownloadLinks: 5,
      maxMagnetLinks: 5,
      maxScreenshots: 5,
      extractionTimeout: 10000,
      maxConcurrentExtractions: 1,
      enableImagePreview: false,
      compactMode: true,
      enableConcurrentExtraction: false,
      enableSmartBatching: false
    }
  },
  balanced: {
    name: '平衡模式',
    description: '性能和功能的平衡配置',
    icon: '⚖️',
    config: { ...DEFAULT_USER_CONFIG }
  },
  aggressive: {
    name: '性能模式',
    description: '最大化提取速度和内容，适合高配设备',
    icon: '🚀',
    config: {
      ...DEFAULT_USER_CONFIG,
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
      cacheDuration: 172800000, // 48小时
      enableStrictDomainCheck: false,
      preferOriginalSources: false
    }
  },
  quality: {
    name: '质量优先',
    description: '注重数据质量和准确性',
    icon: '💎',
    config: {
      ...DEFAULT_USER_CONFIG,
      extractionTimeout: 20000,
      maxRetryAttempts: 3,
      requireMinimumData: true,
      enableStrictDomainCheck: true,
      validateImageUrls: true,
      validateDownloadLinks: true,
      skipLowQualityResults: true,
      enableConcurrentExtraction: false,
      maxConcurrentExtractions: 1,
      enableSmartBatching: false
    }
  }
};

// 🆕 新架构支持的站点类型 - 与后端 SUPPORTED_SOURCE_TYPES 同步
export const SUPPORTED_SOURCE_TYPES = {
  javbus: 'javbus',
  javdb: 'javdb', 
  jable: 'jable',
  javmost: 'javmost',
  javgg: 'javgg',
  sukebei: 'sukebei',
  javguru: 'javguru',
  generic: 'generic'
};

// 🆕 新架构功能特性
export const ARCHITECTURE_FEATURES = {
  MODULAR_PARSERS: 'modular_parsers',
  UNIFIED_DATA_STRUCTURE: 'unified_data_structure', 
  INTELLIGENT_CACHING: 'intelligent_caching',
  DYNAMIC_CONFIGURATION: 'dynamic_configuration',
  PARSER_VALIDATION: 'parser_validation',
  SERVICE_MONITORING: 'service_monitoring'
};

// 🆕 服务状态枚举
export const SERVICE_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  ERROR: 'error',
  MAINTENANCE: 'maintenance'
};

// 配置变更检测辅助函数
export function detectConfigChanges(oldConfig, newConfig) {
  const changes = {
    changed: [],
    added: [],
    removed: []
  };
  
  const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
  
  for (const key of allKeys) {
    if (!(key in oldConfig)) {
      changes.added.push(key);
    } else if (!(key in newConfig)) {
      changes.removed.push(key);
    } else if (JSON.stringify(oldConfig[key]) !== JSON.stringify(newConfig[key])) {
      changes.changed.push({
        key,
        from: oldConfig[key],
        to: newConfig[key]
      });
    }
  }
  
  return changes;
}

// 配置合并辅助函数
export function mergeConfigs(baseConfig, overrideConfig) {
  return {
    ...baseConfig,
    ...overrideConfig
  };
}

// 配置重置辅助函数
export function resetToPreset(presetName) {
  if (!CONFIG_PRESETS[presetName]) {
    throw new Error(`未知的配置预设: ${presetName}`);
  }
  return { ...CONFIG_PRESETS[presetName].config };
}

// 🆕 配置验证辅助函数 - 与后端 DetailConfigService.validateConfig 匹配
export function validateConfigLocally(config) {
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

  // 验证依赖关系
  if (config.autoExtractDetails && !config.enableDetailExtraction) {
    errors.push('启用自动提取需要先启用详情提取功能');
  }
  
  if (config.enableLocalCache && !config.enableCache) {
    errors.push('启用本地缓存需要先启用缓存功能');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// 🆕 配置性能影响评估
export function assessConfigPerformanceImpact(oldConfig, newConfig) {
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

// 🆕 配置建议生成器
export function generateConfigRecommendations(config) {
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

// 🆕 配置格式化工具
export function formatConfigForDisplay(config) {
  return {
    ...config,
    extractionTimeoutDisplay: `${Math.round(config.extractionTimeout / 1000)}秒`,
    cacheDurationDisplay: `${Math.round(config.cacheDuration / (1000 * 60 * 60))}小时`,
    extractionTimeoutSeconds: Math.round(config.extractionTimeout / 1000),
    cacheDurationHours: Math.round(config.cacheDuration / (1000 * 60 * 60))
  };
}

// 🆕 配置兼容性检查
export function checkConfigCompatibility(config) {
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
  
  // 检查解析器兼容性
  if (config.enableStrictDomainCheck === false && config.enableSpamFilter === false) {
    issues.push({
      type: 'security',
      message: '同时禁用域名检查和垃圾过滤可能存在安全风险',
      severity: 'error'
    });
  }
  
  return {
    compatible: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

// 🆕 架构信息
export const ARCHITECTURE_INFO = {
  version: '2.0.0',
  codename: 'modular_parsers',
  releaseDate: '2024-12-15',
  features: Object.values(ARCHITECTURE_FEATURES),
  compatibility: {
    backwardCompatible: true,
    apiVersion: '2.0',
    minBackendVersion: '2.0.0'
  },
  improvements: [
    '模块化解析器架构',
    '统一数据结构(ParsedData)',
    '智能缓存策略',
    '动态配置管理',
    '解析器验证机制',
    '服务状态监控',
    '增强的错误处理',
    '性能优化算法'
  ]
};

// 导出所有常量和函数
export default {
  DETAIL_CONFIG_ENDPOINTS,
  DETAIL_CONFIG_PRESETS,
  DETAIL_EXTRACTION_STATUS,
  CONFIG_VALIDATION_RULES,
  DEFAULT_USER_CONFIG,
  CONFIG_FIELD_GROUPS,
  CONFIG_PRESETS,
  SUPPORTED_SOURCE_TYPES,
  ARCHITECTURE_FEATURES,
  SERVICE_STATUS,
  ARCHITECTURE_INFO,
  detectConfigChanges,
  mergeConfigs,
  resetToPreset,
  validateConfigLocally,
  assessConfigPerformanceImpact,
  generateConfigRecommendations,
  formatConfigForDisplay,
  checkConfigCompatibility
};