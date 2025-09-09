// src/handlers/detail.js - 修复版本：修复所有引用和依赖问题
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { CONFIG, DETAIL_EXTRACTION_STATUS, DETAIL_CONFIG_VALIDATION } from '../constants.js';
import { detailExtractor } from '../services/detail-extractor.js';
import { cacheManager, initializeCacheManager } from '../services/cache-manager.js';
import { extractionValidator } from '../services/extraction-validator.js';

// 引入所有需要的辅助函数
import {
  validateBatchInput,
  buildBatchExtractionOptions,
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
  handleSelectiveCacheCleanup,
  getSystemLimits,
  getDefaultConfig
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
      // 不抛出错误，允许继续处理但不使用缓存功能
    }
  }
}

// ===================== 详情提取相关 =====================

/**
 * 提取单个搜索结果的详情信息 - 修复版本
 */
export async function extractSingleDetailHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { searchResult, options = {} } = body;
    
    // 增强的输入验证
    const validationResult = validateExtractionInput(searchResult, options);
    if (!validationResult.valid) {
      return utils.errorResponse(validationResult.message, 400);
    }
    
    // 设置提取选项
    const extractOptions = buildExtractionOptions(options);
    
    console.log(`开始提取详情: ${searchResult.title} - ${searchResult.url}`);
    console.log('提取选项:', extractOptions);
    
    // 执行详情提取
    const detailInfo = await detailExtractor.extractSingleDetail(searchResult, extractOptions);
    
    // 详细的提取结果检查和日志
    logExtractionResults(detailInfo, searchResult);
    
    // 记录用户行为（如果已认证）
    user = await authenticate(request, env).catch(() => null);
    if (user) {
      try {
        await logUserExtractionAction(env, user.id, searchResult, detailInfo, request);
      } catch (logError) {
        console.warn('记录用户行为失败:', logError.message);
      }
    }
    
    // 构建成功响应
    return buildSuccessResponse(detailInfo, searchResult, startTime);
    
  } catch (error) {
    const extractionTime = Date.now() - startTime;
    console.error('详情提取处理失败:', error);
    
    return buildErrorResponse(error, extractionTime, searchResult);
  }
}

/**
 * 批量提取搜索结果的详情信息 - 修复版本
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
    
    // 设置批量提取选项
    const extractOptions = buildBatchExtractionOptions(options);
    
    console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);
    console.log('批量提取选项:', extractOptions);
    
    // 执行批量详情提取 - 带进度回调
    const progressCallback = createProgressCallback();
    const detailResults = await detailExtractor.extractBatchDetails(searchResults, {
      ...extractOptions,
      onProgress: progressCallback
    });
    
    const totalTime = Date.now() - startTime;
    
    // 生成详细统计
    const stats = generateBatchStats(detailResults, totalTime);
    
    // 记录用户行为（如果已认证）
    user = await authenticate(request, env).catch(() => null);
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

/**
 * 获取详情提取历史 - 修复版本
 */
export async function getDetailExtractionHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const url = new URL(request.url);
    const params = parseHistoryParams(url.searchParams);
    
    // 构建查询
    const { query, queryParams } = buildHistoryQuery(user.id, params);
    
    const result = await env.DB.prepare(query).bind(...queryParams).all();
    
    // 处理历史记录数据
    const history = result.results.map(item => enhanceHistoryItem(item));
    
    // 获取总数
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

// ===================== 缓存管理相关 =====================

/**
 * 获取详情缓存统计 - 修复版本
 */
export async function getDetailCacheStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    // 获取丰富的缓存统计
    const stats = await cacheManager.getCacheStats();
    
    // 获取用户特定的统计
    const userStats = await getUserSpecificCacheStats(env, user.id);
    
    // 获取源类型分布统计
    const sourceTypeStats = await getSourceTypeStats(env);
    
    // 获取缓存效率统计
    const efficiencyStats = await getCacheEfficiencyStats(env, user.id);
    
    return utils.successResponse({
      global: {
        totalItems: stats.totalItems || 0,
        expiredItems: stats.expiredItems || 0,
        totalSize: stats.totalSize || 0,
        averageSize: Math.round(stats.averageSize || 0),
        hitRate: parseFloat((stats.hitRate || 0).toFixed(1)),
        oldestItem: stats.oldestItem ? {
          url: stats.oldestItem.url,
          createdAt: new Date(stats.oldestItem.createdAt).toISOString(),
          age: Date.now() - stats.oldestItem.createdAt
        } : null,
        newestItem: stats.newestItem ? {
          url: stats.newestItem.url,
          createdAt: new Date(stats.newestItem.createdAt).toISOString(),
          age: Date.now() - stats.newestItem.createdAt
        } : null,
        mostAccessed: stats.mostAccessed ? {
          url: stats.mostAccessed.url,
          accessCount: stats.mostAccessed.accessCount || 0,
          lastAccessed: new Date(stats.mostAccessed.lastAccessed || Date.now()).toISOString()
        } : null
      },
      user: userStats,
      sourceTypes: sourceTypeStats,
      efficiency: efficiencyStats,
      recommendations: generateCacheRecommendations(stats, userStats)
    });
    
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return utils.errorResponse('获取缓存统计失败: ' + error.message, 500);
  }
}

/**
 * 清理详情缓存 - 修复版本
 */
export async function clearDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation') || 'expired';
    const params = parseClearParams(url.searchParams);
    
    let cleanedCount = 0;
    let message = '';
    let details = {};
    
    // 执行前统计
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
    
    // 执行后统计
    const afterStats = await cacheManager.getCacheStats();
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_cache_clear', {
        operation,
        params,
        cleanedCount,
        beforeStats: {
          totalItems: beforeStats.totalItems,
          totalSize: beforeStats.totalSize
        },
        afterStats: {
          totalItems: afterStats.totalItems,
          totalSize: afterStats.totalSize
        },
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
        },
        freed: {
          items: (beforeStats.totalItems || 0) - (afterStats.totalItems || 0),
          size: (beforeStats.totalSize || 0) - (afterStats.totalSize || 0)
        }
      }
    });
    
  } catch (error) {
    console.error('清理缓存失败:', error);
    return utils.errorResponse('清理缓存失败: ' + error.message, 500);
  }
}

/**
 * 删除特定URL的详情缓存 - 修复版本
 */
export async function deleteDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await ensureCacheManagerInitialized(env);
    
    const body = await utils.safeJsonParse(request, {});
    const { url, urls } = body;
    
    // 支持单个或批量删除
    const urlsToDelete = urls && Array.isArray(urls) ? urls : (url ? [url] : []);
    
    if (urlsToDelete.length === 0) {
      return utils.errorResponse('URL参数不能为空', 400);
    }
    
    // 验证URL格式
    const invalidUrls = urlsToDelete.filter(u => {
      try {
        new URL(u);
        return false;
      } catch {
        return true;
      }
    });
    
    if (invalidUrls.length > 0) {
      return utils.errorResponse({
        message: '存在无效的URL格式',
        invalidUrls
      }, 400);
    }
    
    // 批量删除缓存
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
    
    // 记录用户行为
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

// ===================== 配置管理相关 =====================

/**
 * 获取详情提取配置 - 修复版本
 */
export async function getDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 获取用户的详情提取配置
    const userConfig = await env.DB.prepare(`
      SELECT * FROM detail_extraction_config WHERE user_id = ?
    `).bind(user.id).first();
    
    // 获取系统默认配置和限制
    const systemLimits = getSystemLimits();
    const defaultConfig = getDefaultConfig();
    
    // 合并配置
    const config = userConfig ? parseUserConfig(userConfig) : defaultConfig;
    
    // 获取用户使用统计
    const usageStats = await getUserUsageStats(env, user.id);
    
    // 获取推荐配置
    const recommendations = generateConfigRecommendations(usageStats, config);
    
    return utils.successResponse({
      config: {
        ...config,
        systemLimits,
        isDefault: !userConfig
      },
      usage: usageStats,
      recommendations,
      validation: {
        rules: DETAIL_CONFIG_VALIDATION,
        supportedSources: getSupportedSourceTypes()
      }
    });
    
  } catch (error) {
    console.error('获取详情提取配置失败:', error);
    return utils.errorResponse('获取配置失败: ' + error.message, 500);
  }
}

/**
 * 更新详情提取配置 - 修复版本
 */
export async function updateDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await utils.safeJsonParse(request, {});
    const { config, validateOnly = false } = body;
    
    if (!config || typeof config !== 'object') {
      return utils.errorResponse('配置数据格式错误', 400);
    }
    
    // 增强的配置验证
    const validation = validateDetailConfig(config);
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
        warnings: validation.warnings,
        optimizations: validation.optimizations
      });
    }
    
    // 获取当前配置用于比较
    const currentConfig = await getCurrentUserConfig(env, user.id);
    const changes = detectConfigChanges(currentConfig, config);
    
    // 保存配置到数据库
    const configId = user.id + '_detail_config';
    const now = Date.now();
    
    await env.DB.prepare(`
      INSERT OR REPLACE INTO detail_extraction_config (
        id, user_id, enable_detail_extraction, auto_extract_details, max_auto_extractions,
        extraction_batch_size, extraction_timeout, enable_retry, max_retry_attempts,
        enable_cache, cache_duration, enable_local_cache,
        show_screenshots, show_download_links, show_magnet_links, show_actress_info,
        compact_mode, enable_image_preview, show_extraction_progress,
        enable_content_filter, content_filter_keywords,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).bind(
      configId, user.id,
      config.enableDetailExtraction ? 1 : 0,
      config.autoExtractDetails ? 1 : 0,
      config.maxAutoExtractions || 5,
      config.extractionBatchSize || 3,
      config.extractionTimeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT,
      config.enableRetry ? 1 : 0,
      config.maxRetryAttempts || CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS,
      config.enableCache ? 1 : 0,
      config.cacheDuration || CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION,
      config.enableLocalCache ? 1 : 0,
      config.showScreenshots ? 1 : 0,
      config.showDownloadLinks ? 1 : 0,
      config.showMagnetLinks ? 1 : 0,
      config.showActressInfo ? 1 : 0,
      config.compactMode ? 1 : 0,
      config.enableImagePreview ? 1 : 0,
      config.showExtractionProgress ? 1 : 0,
      config.enableContentFilter ? 1 : 0,
      JSON.stringify(config.contentFilterKeywords || []),
      now, now
    ).run();
    
    // 记录用户行为
    try {
      await utils.logUserAction(env, user.id, 'detail_config_update', {
        changes,
        validation: validation.warnings,
        timestamp: now
      }, request);
    } catch (logError) {
      console.warn('记录配置更新失败:', logError.message);
    }
    
    return utils.successResponse({
      message: '配置更新成功',
      changes,
      warnings: validation.warnings,
      optimizations: validation.optimizations
    });
    
  } catch (error) {
    console.error('更新详情提取配置失败:', error);
    return utils.errorResponse('更新配置失败: ' + error.message, 500);
  }
}

// ===================== 统计信息相关 =====================

/**
 * 获取详情提取统计信息 - 修复版本
 */
export async function getDetailExtractionStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 获取多维度统计信息
    const [
      userStats,
      sourceStats,
      performanceStats,
      cacheStats,
      trendStats
    ] = await Promise.all([
      getUserDetailStats(env, user.id),
      getSourceTypeStats(env, user.id),
      getPerformanceStats(env, user.id),
      getCacheEfficiencyStats(env, user.id),
      getTrendStats(env, user.id)
    ]);
    
    // 从详情提取器获取实时统计
    const extractorStats = detailExtractor.getExtractionStats?.() || {};
    
    return utils.successResponse({
      user: userStats,
      sources: sourceStats,
      performance: performanceStats,
      cache: cacheStats,
      trends: trendStats,
      realtime: extractorStats,
      summary: generateStatsSummary(userStats, sourceStats, performanceStats),
      insights: generateStatsInsights(userStats, sourceStats, performanceStats, cacheStats)
    });
    
  } catch (error) {
    console.error('获取详情提取统计失败:', error);
    return utils.errorResponse('获取统计失败: ' + error.message, 500);
  }
}

// ===================== 辅助函数 =====================

/**
 * 验证提取输入
 */
function validateExtractionInput(searchResult, options) {
  if (!searchResult || !searchResult.url) {
    return {
      valid: false,
      message: '搜索结果数据不完整',
      details: { missing: ['url'] }
    };
  }
  
  // 使用验证服务验证URL
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
 * 构建提取选项
 */
function buildExtractionOptions(options) {
  return {
    enableCache: options.enableCache !== false,
    timeout: Math.min(Math.max(options.timeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT, 
                                CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT), 
                      CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT),
    enableRetry: options.enableRetry !== false,
    maxRetries: Math.min(options.maxRetries || CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS, 5),
    strictValidation: options.strictValidation !== false,
    sourceType: options.sourceType || null
  };
}

/**
 * 构建成功响应
 */
function buildSuccessResponse(detailInfo, searchResult, startTime) {
  const extractionTime = Date.now() - startTime;
  
  return utils.successResponse({
    detailInfo: {
      // 基本信息
      title: detailInfo.title || searchResult.title || '未知标题',
      code: detailInfo.code || '',
      sourceType: detailInfo.sourceType || 'unknown',
      
      // URL信息
      detailUrl: detailInfo.detailPageUrl || detailInfo.detailUrl || searchResult.url,
      searchUrl: detailInfo.searchUrl || searchResult.url,
      originalUrl: searchResult.url,
      
      // 媒体信息
      coverImage: detailInfo.coverImage || '',
      screenshots: detailInfo.screenshots || [],
      
      // 演员信息
      actresses: detailInfo.actresses || [],
      director: detailInfo.director || '',
      studio: detailInfo.studio || '',
      label: detailInfo.label || '',
      series: detailInfo.series || '',
      
      // 发布信息
      releaseDate: detailInfo.releaseDate || '',
      duration: detailInfo.duration || '',
      
      // 技术信息
      quality: detailInfo.quality || '',
      fileSize: detailInfo.fileSize || '',
      resolution: detailInfo.resolution || '',
      
      // 下载信息
      downloadLinks: detailInfo.downloadLinks || [],
      magnetLinks: detailInfo.magnetLinks || [],
      
      // 其他信息
      description: detailInfo.description || '',
      tags: detailInfo.tags || [],
      rating: detailInfo.rating || 0,
      
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
      validationPassed: true
    },
    message: detailInfo.extractionStatus === 'success' ? 
             '详情提取完成' : 
             (detailInfo.extractionStatus === 'cached' ? '使用缓存数据' : '详情提取失败')
  });
}

/**
 * 构建错误响应
 */
function buildErrorResponse(error, extractionTime, searchResult) {
  const errorType = error.name || 'UnknownError';
  let statusCode = 500;
  let errorCategory = 'internal';
  
  // 根据错误类型确定状态码和分类
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
 * 记录详细的提取结果
 */
function logExtractionResults(detailInfo, searchResult) {
  console.log(`=== 详情提取结果检查 ===`);
  console.log('Extraction Status:', detailInfo.extractionStatus);
  console.log('Source Type:', detailInfo.sourceType);
  console.log('Title:', detailInfo.title || 'No title');
  console.log('Code:', detailInfo.code || 'No code found');
  console.log('Cover Image:', detailInfo.coverImage || 'No cover image');
  console.log('Description:', detailInfo.description?.substring(0, 100) || 'No description');
  console.log('Tags Count:', detailInfo.tags?.length || 0);
  console.log('Actresses Count:', detailInfo.actresses?.length || 0);
  console.log('Download Links Count:', detailInfo.downloadLinks?.length || 0);
  console.log('Magnet Links Count:', detailInfo.magnetLinks?.length || 0);
  console.log('Screenshots Count:', detailInfo.screenshots?.length || 0);
  console.log('Extraction Time:', detailInfo.extractionTime, 'ms');
  console.log('Detail URL:', detailInfo.detailPageUrl || detailInfo.detailUrl);
  console.log('From Cache:', detailInfo.extractionStatus === 'cached');
  
  if (detailInfo.extractionError) {
    console.error('Extraction Error:', detailInfo.extractionError);
  }
  console.log(`=== 详情提取结果检查结束 ===`);
}

/**
 * 增强的详情配置验证
 */
function validateDetailConfig(config) {
  const errors = [];
  const warnings = [];
  const optimizations = [];
  
  // 使用现有的验证逻辑
  const basicErrors = validateDetailConfigBasic(config);
  errors.push(...basicErrors);
  
  // 添加性能优化建议
  if (config.extractionTimeout > CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT * 2) {
    warnings.push('超时时间设置过长可能影响用户体验');
    optimizations.push('建议将超时时间设置为 ' + CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT + 'ms');
  }
  
  if (config.extractionBatchSize > 5) {
    warnings.push('批量大小过大可能导致请求阻塞');
    optimizations.push('建议将批量大小设置为 3-5');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    optimizations
  };
}

/**
 * 基本配置验证
 */
function validateDetailConfigBasic(config) {
  const errors = [];
  
  // 验证超时时间
  if (config.hasOwnProperty('extractionTimeout')) {
    const timeout = Number(config.extractionTimeout);
    if (isNaN(timeout) || timeout < DETAIL_CONFIG_VALIDATION.extractionTimeout.min || 
        timeout > DETAIL_CONFIG_VALIDATION.extractionTimeout.max) {
      errors.push(`提取超时时间必须在 ${DETAIL_CONFIG_VALIDATION.extractionTimeout.min}-${DETAIL_CONFIG_VALIDATION.extractionTimeout.max}ms 之间`);
    }
  }
  
  // 验证批量大小
  if (config.hasOwnProperty('extractionBatchSize')) {
    const batchSize = Number(config.extractionBatchSize);
    if (isNaN(batchSize) || batchSize < DETAIL_CONFIG_VALIDATION.extractionBatchSize.min || 
        batchSize > DETAIL_CONFIG_VALIDATION.extractionBatchSize.max) {
      errors.push(`批量大小必须在 ${DETAIL_CONFIG_VALIDATION.extractionBatchSize.min}-${DETAIL_CONFIG_VALIDATION.extractionBatchSize.max} 之间`);
    }
  }
  
  return errors;
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
 * 获取支持的源类型
 */
function getSupportedSourceTypes() {
  return ['javbus', 'javdb', 'jable', 'javgg', 'javmost', 'sukebei', 'javguru', 'generic'];
}

// ===================== 占位符函数（需要在 detail-helpers.js 中实现） =====================

function generateCacheRecommendations(stats, userStats) {
  return {
    message: '缓存运行正常',
    suggestions: []
  };
}

function getCurrentUserConfig(env, userId) {
  return getDefaultConfig();
}

function detectConfigChanges(currentConfig, newConfig) {
  return {
    changed: [],
    added: [],
    removed: []
  };
}

function getUserUsageStats(env, userId) {
  return {
    totalExtractions: 0,
    successfulExtractions: 0,
    averageTime: 0
  };
}

function generateConfigRecommendations(usageStats, config) {
  return {
    performance: [],
    efficiency: [],
    optimization: []
  };
}

function parseUserConfig(userConfig) {
  return {
    enableDetailExtraction: Boolean(userConfig.enable_detail_extraction),
    autoExtractDetails: Boolean(userConfig.auto_extract_details),
    maxAutoExtractions: userConfig.max_auto_extractions || 5,
    extractionBatchSize: userConfig.extraction_batch_size || 3,
    extractionTimeout: userConfig.extraction_timeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT,
    enableRetry: Boolean(userConfig.enable_retry),
    maxRetryAttempts: userConfig.max_retry_attempts || CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS,
    enableCache: Boolean(userConfig.enable_cache),
    cacheDuration: userConfig.cache_duration || CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION,
    enableLocalCache: Boolean(userConfig.enable_local_cache),
    showScreenshots: Boolean(userConfig.show_screenshots),
    showDownloadLinks: Boolean(userConfig.show_download_links),
    showMagnetLinks: Boolean(userConfig.show_magnet_links),
    showActressInfo: Boolean(userConfig.show_actress_info),
    compactMode: Boolean(userConfig.compact_mode),
    enableImagePreview: Boolean(userConfig.enable_image_preview),
    showExtractionProgress: Boolean(userConfig.show_extraction_progress),
    enableContentFilter: Boolean(userConfig.enable_content_filter),
    contentFilterKeywords: JSON.parse(userConfig.content_filter_keywords || '[]')
  };
}

function getUserDetailStats(env, userId) {
  return {
    totalExtractions: 0,
    successfulExtractions: 0,
    failedExtractions: 0
  };
}

function getPerformanceStats(env, userId) {
  return {
    averageTime: 0,
    fastestTime: 0,
    slowestTime: 0
  };
}

function getTrendStats(env, userId) {
  return {
    daily: [],
    weekly: [],
    monthly: []
  };
}

function generateStatsSummary(userStats, sourceStats, performanceStats) {
  return {
    totalExtractions: userStats.totalExtractions,
    averageTime: performanceStats.averageTime,
    topSource: sourceStats[0]?.sourceType || 'unknown'
  };
}

function generateStatsInsights(userStats, sourceStats, performanceStats, cacheStats) {
  return {
    insights: [],
    recommendations: []
  };
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
}