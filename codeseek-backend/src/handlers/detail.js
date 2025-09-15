// src/handlers/detail.js - 重构后的详情提取处理器，集成新架构与配置管理
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { SYSTEM_VALIDATION, DETAIL_EXTRACTION_STATUS } from '../constants.js';

// 🆕 新架构：使用模块化解析器服务
import { detailExtractionService } from '../services/DetailExtractionService.js';
import { ParsedData } from '../interfaces/ParsedData.js';

// 保留原有的配置和缓存管理
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

// ==================== 🆕 新架构：详情提取处理器 ====================

/**
 * 🆕 单个详情提取处理器 - 新架构版本
 * 使用模块化解析器和统一数据结构，同时保留配置管理功能
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
    if (!searchResult || !searchResult.url) {
      return utils.errorResponse('搜索结果数据不完整，缺少URL', 400);
    }
    
    // 验证URL格式
    try {
      new URL(searchResult.url);
    } catch (error) {
      return utils.errorResponse('无效的URL格式', 400);
    }
    
    // 获取用户认证信息（可选）
    user = await authenticate(request, env).catch(() => null);
    
    // 获取用户配置（新旧架构兼容）
    const userConfig = user ? 
      await detailConfigService.getUserConfig(env, user.id) : 
      detailConfigService.getDefaultUserConfig();
    
    // 检查是否启用详情提取
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse('详情提取功能已被禁用', 403);
    }
    
    // 构建提取选项（适配新架构）
    const extractOptions = {
      timeout: options.timeout || userConfig.extractionTimeout,
      enableRetry: options.enableRetry !== false && userConfig.enableRetry,
      enableCache: options.enableCache !== false && userConfig.enableCache,
      sourceType: options.sourceType || null,
      
      // 🆕 新架构特有选项
      strictValidation: userConfig.enableStrictDomainCheck,
      maxDownloadLinks: userConfig.maxDownloadLinks,
      maxMagnetLinks: userConfig.maxMagnetLinks,
      maxScreenshots: userConfig.maxScreenshots
    };
    
    console.log(`🆕 开始详情提取 (新架构): ${searchResult.title} - ${searchResult.url}`);
    console.log('使用选项:', extractOptions);
    
    // 🆕 执行详情提取 - 使用新的模块化服务
    const detailInfo = await detailExtractionService.extractSingleDetail(searchResult, extractOptions);
    
    // 记录用户行为（如果已认证）
    if (user) {
      try {
        await utils.logUserAction(env, user.id, 'detail_extraction_v2', {
          url: searchResult.url,
          title: searchResult.title,
          extractionStatus: detailInfo.extractionStatus,
          extractionTime: detailInfo.extractionTime,
          sourceType: detailInfo.sourceType,
          architecture: 'modular_parsers'
        }, request);
      } catch (logError) {
        console.warn('记录用户行为失败:', logError.message);
      }
    }
    
    // 构建成功响应（适配新架构数据结构）
    const totalTime = Date.now() - startTime;
    
    return utils.successResponse({
      detailInfo: buildFilteredDetailInfo(detailInfo, userConfig),
      
      metadata: {
        totalTime,
        fromCache: detailInfo.extractionStatus === 'cached',
        architecture: 'modular_parsers',
        parser: detailInfo.sourceType,
        dataStructureVersion: '2.0',
        configApplied: !!user
      },
      
      performance: {
        extractionTime: detailInfo.extractionTime,
        totalTime,
        cacheHit: detailInfo.extractionStatus === 'cached'
      },
      
      message: getStatusMessage(detailInfo.extractionStatus)
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('详情提取处理失败:', error);
    
    return utils.errorResponse({
      message: '详情提取失败: ' + error.message,
      error: {
        type: error.name || 'ExtractionError',
        message: error.message,
        totalTime,
        architecture: 'modular_parsers'
      }
    }, 500);
  }
}

/**
 * 🆕 批量详情提取处理器 - 新架构版本
 * 使用模块化解析器进行批量处理，保留配置管理
 */
export async function extractBatchDetailsHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { searchResults, options = {} } = body;
    
    // 验证输入
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return utils.errorResponse('搜索结果列表不能为空', 400);
    }
    
    // 验证批量大小
    const maxBatchSize = 20; // 系统限制
    if (searchResults.length > maxBatchSize) {
      return utils.errorResponse(`批量处理数量不能超过 ${maxBatchSize} 个`, 400);
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
    
    // 构建批量提取选项（适配新架构）
    const extractOptions = {
      timeout: options.timeout || userConfig.extractionTimeout,
      enableRetry: options.enableRetry !== false && userConfig.enableRetry,
      enableCache: options.enableCache !== false && userConfig.enableCache,
      maxConcurrency: Math.min(options.maxConcurrency || userConfig.maxConcurrentExtractions, 5),
      onProgress: createProgressCallbackV2() // 🆕 使用新版进度回调
    };
    
    console.log(`🆕 开始批量详情提取 (新架构): ${searchResults.length} 个结果`);
    console.log('批量提取选项:', extractOptions);
    
    // 🆕 执行批量详情提取 - 使用新的模块化服务
    const detailResults = await detailExtractionService.extractBatchDetails(searchResults, extractOptions);
    
    const totalTime = Date.now() - startTime;
    
    // 生成统计信息（适配新架构数据）
    const stats = generateBatchStatsV2(detailResults, totalTime);
    
    // 记录用户行为（如果已认证）
    if (user) {
      try {
        await utils.logUserAction(env, user.id, 'batch_detail_extraction_v2', {
          totalResults: searchResults.length,
          successfulExtractions: stats.successful,
          failedExtractions: stats.failed,
          totalTime: stats.totalTime,
          architecture: 'modular_parsers'
        }, request);
      } catch (logError) {
        console.warn('记录批量用户行为失败:', logError.message);
      }
    }
    
    // 构建批量成功响应（适配新架构）
    return utils.successResponse({
      results: detailResults.map(result => buildFilteredDetailInfo(result, userConfig)),
      
      stats: {
        ...stats,
        performance: {
          itemsPerSecond: stats.totalTime > 0 ? Math.round((stats.total * 1000) / stats.totalTime) : 0,
          averageTimePerItem: stats.averageTime,
          totalTime: stats.totalTime
        }
      },
      
      metadata: {
        architecture: 'modular_parsers',
        dataStructureVersion: '2.0',
        batchSize: searchResults.length,
        maxConcurrency: extractOptions.maxConcurrency
      },
      
      summary: {
        processed: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        cached: stats.cached,
        message: `批量详情提取完成: ${stats.successful}/${stats.total} 成功 (${stats.successRate}%)`
      }
    });
    
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error('批量详情提取处理失败:', error);
    
    return utils.errorResponse({
      message: '批量详情提取失败: ' + error.message,
      error: {
        type: error.name || 'BatchExtractionError',
        message: error.message,
        totalTime,
        architecture: 'modular_parsers'
      }
    }, 500);
  }
}

// ==================== 🆕 新架构：支持的站点和解析器管理 ====================

/**
 * 🆕 获取支持的站点信息处理器 - 新架构版本
 */
export async function getSupportedSitesHandler(request, env) {
  try {
    const sites = detailExtractionService.getSupportedSites();
    
    return utils.successResponse({
      sites,
      metadata: {
        architecture: 'modular_parsers',
        totalSites: sites.length,
        dataStructureVersion: '2.0'
      }
    });
    
  } catch (error) {
    console.error('获取支持站点失败:', error);
    return utils.errorResponse('获取支持站点失败: ' + error.message, 500);
  }
}

/**
 * 🆕 验证解析器状态处理器 - 新架构版本
 */
export async function validateParserHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const url = new URL(request.url);
    const sourceType = url.searchParams.get('sourceType');
    
    if (!sourceType) {
      return utils.errorResponse('缺少sourceType参数', 400);
    }
    
    const validation = await detailExtractionService.validateParser(sourceType);
    
    return utils.successResponse({
      validation,
      metadata: {
        architecture: 'modular_parsers',
        sourceType,
        timestamp: Date.now()
      }
    });
    
  } catch (error) {
    console.error('验证解析器失败:', error);
    return utils.errorResponse('验证解析器失败: ' + error.message, 500);
  }
}

/**
 * 🆕 获取服务统计信息处理器 - 新架构版本
 */
export async function getServiceStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const stats = detailExtractionService.getServiceStats();
    
    return utils.successResponse({
      stats,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('获取服务统计失败:', error);
    return utils.errorResponse('获取服务统计失败: ' + error.message, 500);
  }
}

/**
 * 🆕 重新加载解析器处理器 - 新架构版本
 */
export async function reloadParserHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await utils.safeJsonParse(request, {});
    const { sourceType } = body;
    
    if (!sourceType) {
      return utils.errorResponse('缺少sourceType参数', 400);
    }
    
    const success = detailExtractionService.reloadParser(sourceType);
    
    // 记录管理员操作
    try {
      await utils.logUserAction(env, user.id, 'parser_reload', {
        sourceType,
        success,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn('记录重载操作失败:', logError.message);
    }
    
    return utils.successResponse({
      success,
      sourceType,
      message: success ? `${sourceType} 解析器重载成功` : `${sourceType} 解析器重载失败`
    });
    
  } catch (error) {
    console.error('重载解析器失败:', error);
    return utils.errorResponse('重载解析器失败: ' + error.message, 500);
  }
}

// ==================== 配置管理相关（保留原有功能） ====================

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

// ==================== 其他处理器保持不变 ====================

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

// ==================== 🆕 新架构适配辅助函数 ====================

/**
 * 获取状态消息
 */
function getStatusMessage(status) {
  const messages = {
    'success': '详情提取完成',
    'cached': '使用缓存数据',
    'partial': '部分数据提取成功',
    'error': '详情提取失败',
    'timeout': '提取超时'
  };
  
  return messages[status] || '提取状态未知';
}

/**
 * 🆕 创建进度回调函数 - 新架构版本
 */
function createProgressCallbackV2() {
  return (progress) => {
    console.log(`批量提取进度 (新架构): ${progress.current}/${progress.total} (${progress.status}) - ${progress.item}`);
    
    // 可以在这里添加实时进度推送逻辑
    // 例如：WebSocket 推送、Server-Sent Events 等
  };
}

/**
 * 🆕 生成批量统计 - 新架构版本
 */
function generateBatchStatsV2(detailResults, totalTime) {
  const stats = {
    total: detailResults.length,
    successful: 0,
    cached: 0,
    failed: 0,
    partial: 0,
    totalTime,
    averageTime: 0,
    successRate: 0,
    cacheHitRate: 0
  };
  
  detailResults.forEach(result => {
    switch (result.extractionStatus) {
      case 'success':
        stats.successful++;
        break;
      case 'cached':
        stats.cached++;
        stats.successful++; // 缓存也算成功
        break;
      case 'partial':
        stats.partial++;
        break;
      case 'error':
      default:
        stats.failed++;
        break;
    }
  });
  
  if (stats.total > 0) {
    stats.averageTime = Math.round(totalTime / stats.total);
    stats.successRate = Math.round((stats.successful / stats.total) * 100);
    stats.cacheHitRate = Math.round((stats.cached / stats.total) * 100);
  }
  
  // 按源类型分组统计
  stats.bySource = {};
  detailResults.forEach(result => {
    const sourceType = result.sourceType || 'unknown';
    if (!stats.bySource[sourceType]) {
      stats.bySource[sourceType] = {
        total: 0,
        successful: 0,
        failed: 0
      };
    }
    
    stats.bySource[sourceType].total++;
    if (result.extractionStatus === 'success' || result.extractionStatus === 'cached') {
      stats.bySource[sourceType].successful++;
    } else {
      stats.bySource[sourceType].failed++;
    }
  });
  
  return stats;
}

/**
 * 🆕 根据用户配置过滤详情信息 - 适配新架构数据结构
 */
function buildFilteredDetailInfo(detailInfo, userConfig) {
  // 如果是ParsedData实例，转换为JSON
  const data = detailInfo.toJSON ? detailInfo.toJSON() : detailInfo;
  
  const filtered = {
    // 基本信息（总是包含）
    title: data.title,
    code: data.code,
    sourceType: data.sourceType,
    detailUrl: data.detailUrl || data.detailPageUrl,
    searchUrl: data.searchUrl || data.originalUrl,
    
    // 提取状态（总是包含）
    extractionStatus: data.extractionStatus,
    extractionTime: data.extractionTime,
    extractedAt: data.extractedAt,
    fromCache: data.extractionStatus === 'cached'
  };
  
  // 根据配置决定是否包含各种内容
  if (userConfig.showScreenshots && data.screenshots) {
    filtered.screenshots = data.screenshots.slice(0, userConfig.maxScreenshots);
  }
  
  if (userConfig.showDownloadLinks && data.downloadLinks) {
    filtered.downloadLinks = data.downloadLinks.slice(0, userConfig.maxDownloadLinks);
  }
  
  if (userConfig.showMagnetLinks && data.magnetLinks) {
    filtered.magnetLinks = data.magnetLinks.slice(0, userConfig.maxMagnetLinks);
  }
  
  if (userConfig.showActressInfo && (data.actors || data.actresses)) {
    filtered.actors = data.actors || data.actresses;
  }
  
  if (userConfig.showExtractedTags && data.tags) {
    filtered.tags = data.tags;
  }
  
  if (userConfig.showRating && data.rating) {
    filtered.rating = data.rating;
  }
  
  if (userConfig.showDescription && data.description) {
    filtered.description = data.description;
  }
  
  // 其他基本信息始终包含
  if (data.cover || data.coverImage) filtered.coverImage = data.cover || data.coverImage;
  if (data.director) filtered.director = data.director;
  if (data.studio) filtered.studio = data.studio;
  if (data.label) filtered.label = data.label;
  if (data.series) filtered.series = data.series;
  if (data.releaseDate) filtered.releaseDate = data.releaseDate;
  if (data.duration) filtered.duration = data.duration;
  if (data.quality) filtered.quality = data.quality;
  if (data.fileSize) filtered.fileSize = data.fileSize;
  if (data.resolution) filtered.resolution = data.resolution;
  
  return filtered;
}

// ==================== 保留的辅助函数（原有功能） ====================

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

// 占位符函数（需要在 detail-helpers.js 中实现）
function getUserDetailStats(env, userId) {
  return getUserUsageStats(env, userId);
}

function getPerformanceStats(env, userId) {
  return getUserUsageStats(env, userId);
}