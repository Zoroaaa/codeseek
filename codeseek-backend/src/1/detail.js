// src/handlers/detail.js - 优化版本：使用配置服务而非硬编码配置
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { SYSTEM_VALIDATION, DETAIL_EXTRACTION_STATUS } from '../constants.js';
import { detailExtractor } from '../services/detail-extractor.js';
import { cacheManager, initializeCacheManager } from '../services/cache-manager.js';
import { extractionValidator } from '../services/extraction-validator.js';
import { detailConfigService } from '../services/detail-config-service.js';

// 引入所有需要的辅助函数
import {
  validateBatchInput,
  createProgressCallback,
  generateBatchStats,
  buildBatchSuccessResponse,
  buildBatchErrorResponse,
  parseHistoryParams,
  buildHistoryQuery,
  buildHistoryCountQuery,
  enhanceHistoryItem,
  getUserSpecificCacheStats,
  getSourceTypeStats,
  getCacheEfficiencyStats,
  parseClearParams,
  handleExpiredCacheCleanup,
  handleAllCacheCleanup,
  handleLRUCacheCleanup,
  handleSelectiveCacheCleanup
} from './detail-helpers.js';

// 全局缓存管理器初始化标志
let cacheManagerInitialized = false;

// 确保缓存管理器只初始化一次
async function ensureCacheManagerInitialized(env) {
  if (!cacheManagerInitialized) {
    try {
      await initializeCacheManager(env);
      cacheManagerInitialized = true;
      console.log('缓存管理器初始化成功');
    } catch (error) {
      console.warn('缓存管理器初始化失败，将使用降级模式:', error.message);
    }
  }
}

/**
 * 应用配置预设 - 新增
 */
export async function applyConfigPresetHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await utils.safeJsonParse(request, {});
    const { preset } = body;
    
    if (!preset) {
      return utils.errorResponse('预设名称不能为空', 400);
    }
    
    const presets = detailConfigService.getConfigPresets();
    if (!presets[preset]) {
      return utils.errorResponse(`未知的配置预设: ${preset}`, 400);
    }
    
    const presetConfig = presets[preset].config;
    
    // 保存预设配置
    await detailConfigService.saveUserConfig(env, user.id, presetConfig);
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_preset_apply', {
        preset,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录预设应用失败:', logError.message);
    }
    
    return utils.successResponse({
      message: `已应用 ${presets[preset].name} 配置预设`,
      preset,
      config: presetConfig,
      description: presets[preset].description
    });
    
  } catch (error) {
    console.error('应用配置预设失败:', error);
    return utils.errorResponse('应用预设失败: ' + error.message, 500);
  }
}

// ===================== 辅助函数 =====================

/**
 * 验证提取输入
 */
function validateExtractionInput(searchResult) {
  if (!searchResult || !searchResult.url) {
    return {
      valid: false,
      message: '搜索结果数据不完整',
      details: { missing: ['url'] }
    };
  }
  
  try {
    new URL(searchResult.url);
  } catch (error) {
    return {
      valid: false,
      message: '无效的URL格式',
      details: { invalidUrl: searchResult.url }
    };
  }
  
  return { valid: true };
}

/**
 * 从用户配置构建提取选项
 */
function buildExtractionOptionsFromConfig(userConfig, overrideOptions = {}) {
  return {
    // 基础选项
    enableCache: userConfig.enableCache && (overrideOptions.enableCache !== false),
    timeout: overrideOptions.timeout || userConfig.extractionTimeout,
    enableRetry: userConfig.enableRetry && (overrideOptions.enableRetry !== false),
    maxRetries: overrideOptions.maxRetries || userConfig.maxRetryAttempts,
    
    // 内容控制
    maxDownloadLinks: userConfig.maxDownloadLinks,
    maxMagnetLinks: userConfig.maxMagnetLinks,
    maxScreenshots: userConfig.maxScreenshots,
    
    // 质量控制
    strictValidation: userConfig.enableStrictDomainCheck,
    requireMinimumData: userConfig.requireMinimumData,
    validateImageUrls: userConfig.validateImageUrls,
    validateDownloadLinks: userConfig.validateDownloadLinks,
    
    // 过滤选项
    enableContentFilter: userConfig.enableContentFilter,
    contentFilterKeywords: userConfig.contentFilterKeywords,
    enableSpamFilter: userConfig.enableSpamFilter,
    
    // 其他选项
    sourceType: overrideOptions.sourceType || null,
    preferOriginalSources: userConfig.preferOriginalSources,
    enableAutoCodeExtraction: userConfig.enableAutoCodeExtraction
  };
}

/**
 * 从用户配置构建批量提取选项
 */
function buildBatchExtractionOptionsFromConfig(userConfig, overrideOptions = {}) {
  const baseOptions = buildExtractionOptionsFromConfig(userConfig, overrideOptions);
  
  return {
    ...baseOptions,
    // 批量特定选项
    batchSize: overrideOptions.batchSize || userConfig.extractionBatchSize,
    maxConcurrency: userConfig.enableConcurrentExtraction ? 
      (overrideOptions.maxConcurrency || userConfig.maxConcurrentExtractions) : 1,
    enableSmartBatching: userConfig.enableSmartBatching,
    progressInterval: overrideOptions.progressInterval || 1000,
    stopOnError: overrideOptions.stopOnError || false
  };
}

/**
 * 构建成功响应
 */
function buildSuccessResponse(detailInfo, searchResult, startTime, userConfig) {
  const extractionTime = Date.now() - startTime;
  
  // 根据用户配置过滤响应数据
  const filteredDetailInfo = filterDetailInfoByConfig(detailInfo, userConfig);
  
  return utils.successResponse({
    detailInfo: {
      // 基本信息
      title: filteredDetailInfo.title || searchResult.title || '未知标题',
      code: filteredDetailInfo.code || '',
      sourceType: filteredDetailInfo.sourceType || 'unknown',
      
      // URL信息
      detailUrl: filteredDetailInfo.detailPageUrl || filteredDetailInfo.detailUrl || searchResult.url,
      searchUrl: filteredDetailInfo.searchUrl || searchResult.url,
      originalUrl: searchResult.url,
      
      // 根据配置显示的内容
      ...filteredDetailInfo,
      
      // 提取元数据
      extractionStatus: detailInfo.extractionStatus || 'unknown',
      extractionTime: detailInfo.extractionTime || extractionTime,
      extractedAt: detailInfo.extractedAt || Date.now(),
      fromCache: detailInfo.extractionStatus === 'cached'
    },
    metadata: {
      totalTime: extractionTime,
      fromCache: detailInfo.extractionStatus === 'cached',
      retryCount: detailInfo.retryCount || 0,
      cacheKey: detailInfo.cacheKey || null,
      configApplied: true,
      userConfigured: true
    },
    message: detailInfo.extractionStatus === 'success' ? 
             '详情提取完成' : 
             (detailInfo.extractionStatus === 'cached' ? '使用缓存数据' : '详情提取失败')
  });
}

/**
 * 根据用户配置过滤详情信息
 */
function filterDetailInfoByConfig(detailInfo, userConfig) {
  const filtered = {
    title: detailInfo.title,
    code: detailInfo.code,
    sourceType: detailInfo.sourceType,
    detailPageUrl: detailInfo.detailPageUrl,
    searchUrl: detailInfo.searchUrl
  };
  
  // 根据配置决定是否包含各种内容
  if (userConfig.showScreenshots && detailInfo.screenshots) {
    filtered.screenshots = detailInfo.screenshots.slice(0, userConfig.maxScreenshots);
  }
  
  if (userConfig.showDownloadLinks && detailInfo.downloadLinks) {
    filtered.downloadLinks = detailInfo.downloadLinks.slice(0, userConfig.maxDownloadLinks);
  }
  
  if (userConfig.showMagnetLinks && detailInfo.magnetLinks) {
    filtered.magnetLinks = detailInfo.magnetLinks.slice(0, userConfig.maxMagnetLinks);
  }
  
  if (userConfig.showActressInfo && detailInfo.actresses) {
    filtered.actresses = detailInfo.actresses;
  }
  
  if (userConfig.showExtractedTags && detailInfo.tags) {
    filtered.tags = detailInfo.tags;
  }
  
  if (userConfig.showRating && detailInfo.rating) {
    filtered.rating = detailInfo.rating;
  }
  
  if (userConfig.showDescription && detailInfo.description) {
    filtered.description = detailInfo.description;
  }
  
  // 其他基本信息始终包含
  if (detailInfo.coverImage) filtered.coverImage = detailInfo.coverImage;
  if (detailInfo.director) filtered.director = detailInfo.director;
  if (detailInfo.studio) filtered.studio = detailInfo.studio;
  if (detailInfo.label) filtered.label = detailInfo.label;
  if (detailInfo.series) filtered.series = detailInfo.series;
  if (detailInfo.releaseDate) filtered.releaseDate = detailInfo.releaseDate;
  if (detailInfo.duration) filtered.duration = detailInfo.duration;
  if (detailInfo.quality) filtered.quality = detailInfo.quality;
  if (detailInfo.fileSize) filtered.fileSize = detailInfo.fileSize;
  if (detailInfo.resolution) filtered.resolution = detailInfo.resolution;
  
  return filtered;
}

/**
 * 构建错误响应
 */
function buildErrorResponse(error, extractionTime, searchResult) {
  const errorType = error.name || 'UnknownError';
  let statusCode = 500;
  let errorCategory = 'internal';
  
  switch (errorType) {
    case 'ValidationError':
      statusCode = 400;
      errorCategory = 'validation';
      break;
    case 'TimeoutError':
      statusCode = 408;
      errorCategory = 'timeout';
      break;
    case 'NetworkError':
      statusCode = 502;
      errorCategory = 'network';
      break;
    case 'ParseError':
      statusCode = 422;
      errorCategory = 'parsing';
      break;
  }
  
  const errorDetail = {
    extractionStatus: 'error',
    extractionError: error.message,
    errorType,
    errorCategory,
    extractionTime,
    extractedAt: Date.now(),
    searchUrl: searchResult?.url || 'unknown',
    retryable: ['TimeoutError', 'NetworkError'].includes(errorType)
  };
  
  return utils.errorResponse({
    message: '详情提取失败: ' + error.message,
    detailInfo: errorDetail,
    error: {
      type: errorType,
      category: errorCategory,
      retryable: errorDetail.retryable,
      suggestions: generateErrorSuggestions(errorType, error.message)
    }
  }, statusCode);
}

/**
 * 生成错误建议
 */
function generateErrorSuggestions(errorType, errorMessage) {
  const suggestions = [];
  
  switch (errorType) {
    case 'TimeoutError':
      suggestions.push('尝试增加超时时间');
      suggestions.push('检查网络连接');
      suggestions.push('稍后重试');
      break;
    case 'ValidationError':
      suggestions.push('检查输入数据格式');
      suggestions.push('确保URL有效');
      break;
    case 'NetworkError':
      suggestions.push('检查网络连接');
      suggestions.push('目标网站可能暂时不可用');
      break;
    case 'ParseError':
      suggestions.push('目标页面结构可能已变更');
      suggestions.push('尝试使用通用解析模式');
      break;
  }
  
  return suggestions;
}

/**
 * 检测配置变更
 */
function detectConfigChanges(currentConfig, newConfig) {
  const changes = {
    changed: [],
    added: [],
    removed: []
  };
  
  const allKeys = new Set([...Object.keys(currentConfig), ...Object.keys(newConfig)]);
  
  for (const key of allKeys) {
    if (!(key in currentConfig)) {
      changes.added.push(key);
    } else if (!(key in newConfig)) {
      changes.removed.push(key);
    } else if (JSON.stringify(currentConfig[key]) !== JSON.stringify(newConfig[key])) {
      changes.changed.push({
        key,
        from: currentConfig[key],
        to: newConfig[key]
      });
    }
  }
  
  return changes;
}

/**
 * 检查是否使用默认配置
 */
async function isUsingDefaultConfig(env, userId) {
  try {
    const userConfig = await env.DB.prepare(`
      SELECT id FROM detail_extraction_config WHERE user_id = ?
    `).bind(userId).first();
    
    return !userConfig;
  } catch (error) {
    console.error('检查默认配置状态失败:', error);
    return true;
  }
}

/**
 * 获取用户使用统计
 */
async function getUserUsageStats(env, userId) {
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as totalExtractions,
        COUNT(CASE WHEN extraction_status = 'success' THEN 1 END) as successfulExtractions,
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cachedExtractions,
        AVG(extraction_time) as averageTime,
        MAX(extraction_time) as maxTime,
        MIN(extraction_time) as minTime
      FROM detail_extraction_history 
      WHERE user_id = ? AND created_at >= ?
    `).bind(userId, Date.now() - 30 * 24 * 60 * 60 * 1000).first();
    
    return {
      totalExtractions: stats?.totalExtractions || 0,
      successfulExtractions: stats?.successfulExtractions || 0,
      cachedExtractions: stats?.cachedExtractions || 0,
      averageTime: Math.round(stats?.averageTime || 0),
      maxTime: stats?.maxTime || 0,
      minTime: stats?.minTime || 0,
      successRate: stats?.totalExtractions > 0 ? 
        Math.round((stats.successfulExtractions / stats.totalExtractions) * 100) : 0,
      cacheHitRate: stats?.totalExtractions > 0 ? 
        Math.round((stats.cachedExtractions / stats.totalExtractions) * 100) : 0
    };
  } catch (error) {
    console.error('获取用户使用统计失败:', error);
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
}

// 占位符函数（需要在 detail-helpers.js 中实现）
function getUserDetailStats(env, userId) {
  return getUserUsageStats(env, userId);
}

function getPerformanceStats(env, userId) {
  return getUserUsageStats(env, userId);
}

function logUserExtractionAction(env, userId, searchResult, detailInfo, request) {
  return utils.logUserAction(env, userId, 'detail_extraction', {
    url: searchResult.url,
    title: searchResult.title,
    extractionStatus: detailInfo.extractionStatus,
    extractionTime: detailInfo.extractionTime,
    sourceType: detailInfo.sourceType
  }, request);
}

function logBatchExtractionAction(env, userId, searchResults, detailResults, stats, request) {
  return utils.logUserAction(env, userId, 'batch_detail_extraction', {
    totalResults: searchResults.length,
    successfulExtractions: stats.successful,
    failedExtractions: stats.failed,
    totalTime: stats.totalTime
  }, request);
}详情提取相关 =====================

/**
 * 提取单个搜索结果的详情信息 - 使用配置服务版本
 */
export async function extractSingleDetailHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { searchResult, options = {} } = body;
    
    // 验证输入
    const validationResult = validateExtractionInput(searchResult);
    if (!validationResult.valid) {
      return utils.errorResponse(validationResult.message, 400);
    }
    
    // 获取用户认证信息
    user = await authenticate(request, env).catch(() => null);
    
    // 获取用户配置（如果已认证）
    const userConfig = user ? 
      await detailConfigService.getUserConfig(env, user.id) : 
      detailConfigService.getDefaultUserConfig();
    
    // 检查是否启用详情提取
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse('详情提取功能已被禁用', 403);
    }
    
    // 合并配置和选项
    const extractOptions = buildExtractionOptionsFromConfig(userConfig, options);
    
    console.log(`开始提取详情: ${searchResult.title} - ${searchResult.url}`);
    console.log('使用配置:', extractOptions);
    
    // 执行详情提取
    const detailInfo = await detailExtractor.extractSingleDetail(searchResult, extractOptions);
    
    // 记录用户行为（如果已认证）
    if (user) {
      try {
        await logUserExtractionAction(env, user.id, searchResult, detailInfo, request);
      } catch (logError) {
        console.warn('记录用户行为失败:', logError.message);
      }
    }
    
    // 构建成功响应
    return buildSuccessResponse(detailInfo, searchResult, startTime, userConfig);
    
  } catch (error) {
    const extractionTime = Date.now() - startTime;
    console.error('详情提取处理失败:', error);
    
    return buildErrorResponse(error, extractionTime, searchResult);
  }
}

/**
 * 批量提取搜索结果的详情信息 - 使用配置服务版本
 */
export async function extractBatchDetailsHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { searchResults, options = {} } = body;
    
    // 批量输入验证
    const batchValidation = validateBatchInput(searchResults, options);
    if (!batchValidation.valid) {
      return utils.errorResponse(batchValidation.message, 400);
    }
    
    // 获取用户认证信息
    user = await authenticate(request, env).catch(() => null);
    
    // 获取用户配置
    const userConfig = user ? 
      await detailConfigService.getUserConfig(env, user.id) : 
      detailConfigService.getDefaultUserConfig();
    
    // 检查是否启用详情提取
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse('详情提取功能已被禁用', 403);
    }
    
    // 构建批量提取选项
    const extractOptions = buildBatchExtractionOptionsFromConfig(userConfig, options);
    
    console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);
    console.log('批量提取配置:', extractOptions);
    
    // 执行批量详情提取
    const progressCallback = createProgressCallback();
    const detailResults = await detailExtractor.extractBatchDetails(searchResults, {
      ...extractOptions,
      onProgress: progressCallback
    });
    
    const totalTime = Date.now() - startTime;
    
    // 生成详细统计
    const stats = generateBatchStats(detailResults, totalTime);
    
    // 记录用户行为（如果已认证）
    if (user) {
      try {
        await logBatchExtractionAction(env, user.id, searchResults, detailResults, stats, request);
      } catch (logError) {
        console.warn('记录批量用户行为失败:', logError.message);
      }
    }
    
    // 构建批量响应
    return buildBatchSuccessResponse(detailResults, stats, searchResults.length);
    
  } catch (error) {
    console.error('批量详情提取失败:', error);
    const totalTime = Date.now() - startTime;
    
    return buildBatchErrorResponse(error, totalTime);
  }
}

// ===================== 配置管理相关 =====================

/**
 * 获取详情提取配置 - 新版本
 */
export async function getDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 获取用户配置
    const userConfig = await detailConfigService.getUserConfig(env, user.id);
    
    // 获取配置元数据
    const metadata = detailConfigService.getConfigMetadata();
    
    // 获取配置预设
    const presets = detailConfigService.getConfigPresets();
    
    // 获取用户使用统计
    const usageStats = await getUserUsageStats(env, user.id);
    
    return utils.successResponse({
      config: userConfig,
      metadata,
      presets,
      usage: usageStats,
      isDefault: await isUsingDefaultConfig(env, user.id)
    });
    
  } catch (error) {
    console.error('获取详情提取配置失败:', error);
    return utils.errorResponse('获取配置失败: ' + error.message, 500);
  }
}

/**
 * 更新详情提取配置 - 新版本
 */
export async function updateDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await utils.safeJsonParse(request, {});
    const { config, validateOnly = false, preset = null } = body;
    
    let configToSave;
    
    // 如果使用预设
    if (preset) {
      const presets = detailConfigService.getConfigPresets();
      if (!presets[preset]) {
        return utils.errorResponse(`未知的配置预设: ${preset}`, 400);
      }
      configToSave = presets[preset].config;
    } else {
      configToSave = config;
    }
    
    if (!configToSave || typeof configToSave !== 'object') {
      return utils.errorResponse('配置数据格式错误', 400);
    }
    
    // 验证配置
    const validation = detailConfigService.validateConfig(configToSave);
    if (!validation.valid) {
      return utils.errorResponse({
        message: '配置验证失败',
        errors: validation.errors,
        warnings: validation.warnings
      }, 400);
    }
    
    // 如果只是验证，返回验证结果
    if (validateOnly) {
      return utils.successResponse({
        valid: true,
        warnings: validation.warnings
      });
    }
    
    // 获取当前配置用于比较
    const currentConfig = await detailConfigService.getUserConfig(env, user.id);
    const changes = detectConfigChanges(currentConfig, configToSave);
    
    // 保存配置
    const saveResult = await detailConfigService.saveUserConfig(env, user.id, configToSave);
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_update', {
        preset,
        changes,
        validation: validation.warnings,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录配置更新失败:', logError.message);
    }
    
    return utils.successResponse({
      message: '配置更新成功',
      config: configToSave,
      changes,
      warnings: saveResult.warnings,
      preset: preset || null
    });
    
  } catch (error) {
    console.error('更新详情提取配置失败:', error);
    return utils.errorResponse('更新配置失败: ' + error.message, 500);
  }
}

/**
 * 重置详情提取配置 - 新增
 */
export async function resetDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const result = await detailConfigService.resetUserConfig(env, user.id);
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_reset', {
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录配置重置失败:', logError.message);
    }
    
    return utils.successResponse({
      message: '配置已重置为默认值',
      config: result.config
    });
    
  } catch (error) {
    console.error('重置详情提取配置失败:', error);
    return utils.errorResponse('重置配置失败: ' + error.message, 500);
  }
}

/**
 * 应用配置预设 - 新增
 */
export async function applyConfigPresetHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await utils.safeJsonParse(request, {});
    const { preset } = body;
    
    if (!preset) {
      return utils.errorResponse('预设名称不能为空', 400);
    }
    
    const presets = detailConfigService.getConfigPresets();
    if (!presets[preset]) {
      return utils.errorResponse(`未知的配置预设: ${preset}`, 400);
    }
    
    const presetConfig = presets[preset].config;
    
    // 保存预设配置
    await detailConfigService.saveUserConfig(env, user.id, presetConfig);
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_preset_apply', {
        preset,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录预设应用失败:', logError.message);
    }
    
    return utils.successResponse({
      message: `已应用 ${presets[preset].name} 配置预设`,
      preset,
      config: presetConfig,
      description: presets[preset].description
    });
    
  } catch (error) {
    console.error('应用配置预设失败:', error);
    return utils.errorResponse('应用预设失败: ' + error.message, 500);
  }
}

// ===================== 其他处理器保持不变 =====================

export async function getDetailExtractionHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const url = new URL(request.url);
    const params = parseHistoryParams(url.searchParams);
    
    const { query, queryParams } = buildHistoryQuery(user.id, params);
    const result = await env.DB.prepare(query).bind(...queryParams).all();
    
    const history = result.results.map(item => enhanceHistoryItem(item));
    
    const countQuery = buildHistoryCountQuery(user.id, params);
    const countResult = await env.DB.prepare(countQuery.query).bind(...countQuery.params).first();
    const totalCount = countResult?.total || 0;
    
    return utils.successResponse({
      history,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore: result.results.length === params.limit,
        currentPage: Math.floor(params.offset / params.limit) + 1,
        totalPages: Math.ceil(totalCount / params.limit)
      },
      filters: {
        source: params.source,
        status: params.status,
        dateRange: params.dateRange
      }
    });
    
  } catch (error) {
    console.error('获取详情提取历史失败:', error);
    return utils.errorResponse('获取历史失败: ' + error.message, 500);
  }
}

export async function getDetailCacheStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    await ensureCacheManagerInitialized(env);
    
    const stats = await cacheManager.getCacheStats();
    const userStats = await getUserSpecificCacheStats(env, user.id);
    const sourceTypeStats = await getSourceTypeStats(env);
    const efficiencyStats = await getCacheEfficiencyStats(env, user.id);
    
    return utils.successResponse({
      global: {
        totalItems: stats.totalItems || 0,
        expiredItems: stats.expiredItems || 0,
        totalSize: stats.totalSize || 0,
        averageSize: Math.round(stats.averageSize || 0),
        hitRate: parseFloat((stats.hitRate || 0).toFixed(1))
      },
      user: userStats,
      sourceTypes: sourceTypeStats,
      efficiency: efficiencyStats
    });
    
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return utils.errorResponse('获取缓存统计失败: ' + error.message, 500);
  }
}

export async function clearDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    await ensureCacheManagerInitialized(env);
    
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation') || 'expired';
    const params = parseClearParams(url.searchParams);
    
    let cleanedCount = 0;
    let message = '';
    let details = {};
    
    const beforeStats = await cacheManager.getCacheStats();
    
    switch (operation) {
      case 'expired':
        cleanedCount = await handleExpiredCacheCleanup(env, params);
        message = `已清理 ${cleanedCount} 个过期缓存项`;
        break;
      case 'all':
        const result = await handleAllCacheCleanup(env, params);
        cleanedCount = result.count;
        details = result.details;
        message = `已清空所有缓存 (${cleanedCount} 项)`;
        break;
      case 'lru':
        const lruResult = await handleLRUCacheCleanup(env, params);
        cleanedCount = lruResult.count;
        details = lruResult.details;
        message = `已清理 ${cleanedCount} 个最近最少使用的缓存项`;
        break;
      case 'selective':
        const selectiveResult = await handleSelectiveCacheCleanup(env, params);
        cleanedCount = selectiveResult.count;
        details = selectiveResult.details;
        message = `已选择性清理 ${cleanedCount} 个缓存项`;
        break;
      default:
        return utils.errorResponse('无效的清理操作类型', 400);
    }
    
    const afterStats = await cacheManager.getCacheStats();
    
    try {
      await utils.logUserAction(env, user.id, 'detail_cache_clear', {
        operation,
        params,
        cleanedCount,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录清理操作失败:', logError.message);
    }
    
    return utils.successResponse({
      operation,
      cleanedCount,
      message,
      details,
      stats: {
        before: {
          totalItems: beforeStats.totalItems || 0,
          totalSize: beforeStats.totalSize || 0
        },
        after: {
          totalItems: afterStats.totalItems || 0,
          totalSize: afterStats.totalSize || 0
        }
      }
    });
    
  } catch (error) {
    console.error('清理缓存失败:', error);
    return utils.errorResponse('清理缓存失败: ' + error.message, 500);
  }
}

export async function deleteDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { url, urls } = body;
    
    const urlsToDelete = urls && Array.isArray(urls) ? urls : (url ? [url] : []);
    
    if (urlsToDelete.length === 0) {
      return utils.errorResponse('URL参数不能为空', 400);
    }
    
    const deleteResults = await Promise.allSettled(
      urlsToDelete.map(async (targetUrl) => {
        const success = await cacheManager.deleteDetailCache(targetUrl);
        return { url: targetUrl, success };
      })
    );
    
    const successful = deleteResults
      .filter(result => result.status === 'fulfilled' && result.value.success)
      .map(result => result.value.url);
    
    const failed = deleteResults
      .filter(result => result.status === 'rejected' || !result.value.success)
      .map(result => result.status === 'fulfilled' ? result.value.url : 'Unknown');
    
    try {
      await utils.logUserAction(env, user.id, 'detail_cache_delete', {
        urls: urlsToDelete,
        successful: successful.length,
        failed: failed.length,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录删除操作失败:', logError.message);
    }
    
    return utils.successResponse({
      message: `缓存删除完成: ${successful.length} 成功, ${failed.length} 失败`,
      results: {
        successful,
        failed,
        total: urlsToDelete.length
      }
    });
    
  } catch (error) {
    console.error('删除缓存失败:', error);
    return utils.errorResponse('删除缓存失败: ' + error.message, 500);
  }
}

export async function getDetailExtractionStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const [userStats, sourceStats, performanceStats, cacheStats] = await Promise.all([
      getUserDetailStats(env, user.id),
      getSourceTypeStats(env, user.id),
      getPerformanceStats(env, user.id),
      getCacheEfficiencyStats(env, user.id)
    ]);
    
    return utils.successResponse({
      user: userStats,
      sources: sourceStats,
      performance: performanceStats,
      cache: cacheStats
    });
    
  } catch (error) {
    console.error('获取详情提取统计失败:', error);
    return utils.errorResponse('获取统计失败: ' + error.message, 500);
  }
}

// ===================== 新增的配置管理处理器 =====================

/**
 * 重置详情提取配置 - 新增
 */
export async function resetDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const result = await detailConfigService.resetUserConfig(env, user.id);
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_reset', {
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录配置重置失败:', logError.message);
    }
    
    return utils.successResponse({
      message: '配置已重置为默认值',
      config: result.config
    });
    
  } catch (error) {
    console.error('重置详情提取配置失败:', error);
    return utils.errorResponse('重置配置失败: ' + error.message, 500);

// =====================