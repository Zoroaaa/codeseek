// src/handlers/detail.js - 详情提取API处理器（Cloudflare Workers 兼容版本）
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { CONFIG, DETAIL_EXTRACTION_STATUS, DETAIL_CONFIG_VALIDATION } from '../constants.js';
import { detailExtractor } from '../services/detail-extractor.js';
import { cacheManager, initializeCacheManager } from '../services/cache-manager.js';

// ===================== 详情提取相关 =====================

/**
 * 提取单个搜索结果的详情信息
 */
export async function extractSingleDetailHandler(request, env) {
  try {
    // 确保缓存管理器已初始化
    await initializeCacheManager(env);
    
    const body = await request.json().catch(() => ({}));
    const { searchResult, options = {} } = body;
    
    if (!searchResult || !searchResult.url) {
      return utils.errorResponse('搜索结果数据不完整', 400);
    }
    
    // 验证URL格式
    try {
      new URL(searchResult.url);
    } catch (error) {
      return utils.errorResponse('无效的URL格式', 400);
    }
    
    // 设置提取选项
    const extractOptions = {
      enableCache: options.enableCache !== false,
      timeout: Math.min(Math.max(options.timeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT, 
                                  CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT), 
                        CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT),
      enableRetry: options.enableRetry !== false
    };
    
    console.log(`开始提取详情: ${searchResult.title} - ${searchResult.url}`);
    
    // 执行详情提取
    const detailInfo = await detailExtractor.extractSingleDetail(searchResult, extractOptions);
    
    // 记录用户行为（如果已认证）
    const user = await authenticate(request, env).catch(() => null);
    if (user) {
      await utils.logUserAction(env, user.id, 'detail_extraction', {
        url: searchResult.url,
        source: searchResult.source,
        extractionStatus: detailInfo.extractionStatus,
        extractionTime: detailInfo.extractionTime
      }, request);
      
      // 保存到详情提取历史
      await saveDetailExtractionHistory(env, user.id, searchResult, detailInfo);
    }
    
    return utils.successResponse({
      searchResult,
      detailInfo,
      extractionTime: detailInfo.extractionTime,
      fromCache: detailInfo.extractionStatus === 'cached',
      message: '详情提取完成'
    });
    
  } catch (error) {
    console.error('详情提取失败:', error);
    return utils.errorResponse('详情提取失败: ' + error.message, 500);
  }
}

/**
 * 批量提取搜索结果的详情信息
 */
export async function extractBatchDetailsHandler(request, env) {
  try {
    // 确保缓存管理器已初始化
    await initializeCacheManager(env);
    
    const body = await request.json().catch(() => ({}));
    const { searchResults, options = {} } = body;
    
    if (!Array.isArray(searchResults) || searchResults.length === 0) {
      return utils.errorResponse('搜索结果列表不能为空', 400);
    }
    
    // 限制批量处理数量
    const maxBatchSize = CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE;
    if (searchResults.length > maxBatchSize) {
      return utils.errorResponse(`批量处理数量不能超过 ${maxBatchSize} 个`, 400);
    }
    
    // 验证搜索结果格式
    const invalidResults = searchResults.filter(result => !result || !result.url);
    if (invalidResults.length > 0) {
      return utils.errorResponse('存在无效的搜索结果数据', 400);
    }
    
    // 设置批量提取选项
    const extractOptions = {
      enableCache: options.enableCache !== false,
      timeout: Math.min(Math.max(options.timeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT, 
                                  CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT), 
                        CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT),
      enableRetry: options.enableRetry !== false,
      onProgress: options.onProgress || null
    };
    
    console.log(`开始批量提取 ${searchResults.length} 个结果的详情`);
    
    const startTime = Date.now();
    
    // 执行批量详情提取
    const detailResults = await detailExtractor.extractBatchDetails(searchResults, extractOptions);
    
    const totalTime = Date.now() - startTime;
    
    // 统计结果
    const stats = {
      total: detailResults.length,
      successful: detailResults.filter(r => r.extractionStatus === 'success').length,
      cached: detailResults.filter(r => r.extractionStatus === 'cached').length,
      failed: detailResults.filter(r => r.extractionStatus === 'error').length,
      totalTime,
      averageTime: detailResults.length > 0 ? Math.round(totalTime / detailResults.length) : 0
    };
    
    // 记录用户行为（如果已认证）
    const user = await authenticate(request, env).catch(() => null);
    if (user) {
      await utils.logUserAction(env, user.id, 'batch_detail_extraction', {
        batchSize: searchResults.length,
        stats,
        totalTime
      }, request);
      
      // 批量保存到详情提取历史
      for (const result of detailResults) {
        const searchResult = searchResults.find(sr => sr.url === result.url);
        if (searchResult) {
          await saveDetailExtractionHistory(env, user.id, searchResult, result);
        }
      }
    }
    
    return utils.successResponse({
      results: detailResults,
      stats,
      message: `批量详情提取完成: ${stats.successful}/${stats.total} 成功`
    });
    
  } catch (error) {
    console.error('批量详情提取失败:', error);
    return utils.errorResponse('批量详情提取失败: ' + error.message, 500);
  }
}

/**
 * 获取详情提取历史
 */
export async function getDetailExtractionHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
    const source = url.searchParams.get('source');
    
    let query = `
      SELECT * FROM detail_extraction_history 
      WHERE user_id = ?
    `;
    const params = [user.id];
    
    if (source) {
      query += ` AND source_type = ?`;
      params.push(source);
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    const history = result.results.map(item => ({
      id: item.id,
      url: item.url,
      sourceType: item.source_type,
      keyword: item.keyword,
      extractionStatus: item.extraction_status,
      extractionTime: item.extraction_time,
      extractionError: item.extraction_error,
      dataSize: item.data_size,
      createdAt: new Date(item.created_at).toISOString()
    }));
    
    return utils.successResponse({
      history,
      total: result.results.length,
      limit,
      offset
    });
    
  } catch (error) {
    console.error('获取详情提取历史失败:', error);
    return utils.errorResponse('获取历史失败', 500);
  }
}

// ===================== 缓存管理相关 =====================

/**
 * 获取详情缓存统计
 */
export async function getDetailCacheStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await initializeCacheManager(env);
    
    // 获取缓存统计（优先使用缓存管理器的统计）
    let stats;
    
    try {
      stats = await cacheManager.getCacheStats();
    } catch (cacheError) {
      console.warn('获取缓存管理器统计失败，使用数据库统计:', cacheError);
      
      // 降级到数据库统计
      const totalResult = await env.DB.prepare(`
        SELECT COUNT(*) as total FROM detail_cache
      `).first();
      
      const expiredResult = await env.DB.prepare(`
        SELECT COUNT(*) as expired FROM detail_cache WHERE expires_at < ?
      `).bind(Date.now()).first();
      
      const sizeResult = await env.DB.prepare(`
        SELECT SUM(cache_size) as total_size FROM detail_cache
      `).first();
      
      const hitRateResult = await env.DB.prepare(`
        SELECT 
          SUM(access_count) as total_access,
          COUNT(*) as cache_items
        FROM detail_cache
      `).first();
      
      stats = {
        totalItems: totalResult.total || 0,
        expiredItems: expiredResult.expired || 0,
        totalSize: sizeResult.total_size || 0,
        averageSize: (totalResult.total > 0) ? Math.round((sizeResult.total_size || 0) / totalResult.total) : 0,
        hitRate: (hitRateResult.total_access > 0) ? 
          Math.round((hitRateResult.total_access / Math.max(hitRateResult.cache_items, 1)) * 100) : 0
      };
    }
    
    return utils.successResponse({
      stats,
      message: '缓存统计获取成功'
    });
    
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return utils.errorResponse('获取缓存统计失败', 500);
  }
}

/**
 * 清理详情缓存
 */
export async function clearDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await initializeCacheManager(env);
    
    const url = new URL(request.url);
    const operation = url.searchParams.get('operation');
    
    let cleanedCount = 0;
    let message = '';
    
    switch (operation) {
      case 'expired':
        try {
          cleanedCount = await cacheManager.cleanupExpiredCache();
          message = `已清理 ${cleanedCount} 个过期缓存项`;
        } catch (cacheError) {
          console.warn('缓存管理器清理失败，使用数据库清理:', cacheError);
          const result = await env.DB.prepare(`
            DELETE FROM detail_cache WHERE expires_at < ?
          `).bind(Date.now()).run();
          cleanedCount = result.changes || 0;
          message = `已清理 ${cleanedCount} 个过期缓存项`;
        }
        break;
        
      case 'all':
        try {
          await cacheManager.clearAllCache();
          const allResult = await env.DB.prepare(`
            DELETE FROM detail_cache
          `).run();
          cleanedCount = allResult.changes || 0;
          message = `已清空所有缓存 (${cleanedCount} 项)`;
        } catch (cacheError) {
          console.warn('缓存管理器清空失败，使用数据库清空:', cacheError);
          const allResult = await env.DB.prepare(`
            DELETE FROM detail_cache
          `).run();
          cleanedCount = allResult.changes || 0;
          message = `已清空所有缓存 (${cleanedCount} 项)`;
        }
        break;
        
      case 'lru':
        const count = parseInt(url.searchParams.get('count') || '10');
        try {
          await cacheManager.cleanupLeastRecentlyUsed(count);
          cleanedCount = count;
          message = `已清理 ${cleanedCount} 个最近最少使用的缓存项`;
        } catch (cacheError) {
          console.warn('缓存管理器LRU清理失败，使用数据库清理:', cacheError);
          const lruResult = await env.DB.prepare(`
            DELETE FROM detail_cache 
            WHERE id IN (
              SELECT id FROM detail_cache 
              ORDER BY last_accessed ASC 
              LIMIT ?
            )
          `).bind(count).run();
          cleanedCount = lruResult.changes || 0;
          message = `已清理 ${cleanedCount} 个最近最少使用的缓存项`;
        }
        break;
        
      default:
        return utils.errorResponse('无效的清理操作类型', 400);
    }
    
    // 记录用户行为
    await utils.logUserAction(env, user.id, 'detail_cache_clear', {
      operation,
      cleanedCount,
      timestamp: Date.now()
    }, request);
    
    return utils.successResponse({
      operation,
      cleanedCount,
      message
    });
    
  } catch (error) {
    console.error('清理缓存失败:', error);
    return utils.errorResponse('清理缓存失败: ' + error.message, 500);
  }
}

/**
 * 删除特定URL的详情缓存
 */
export async function deleteDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 确保缓存管理器已初始化
    await initializeCacheManager(env);
    
    const body = await request.json().catch(() => ({}));
    const { url } = body;
    
    if (!url) {
      return utils.errorResponse('URL参数不能为空', 400);
    }
    
    // 验证URL格式
    try {
      new URL(url);
    } catch (error) {
      return utils.errorResponse('无效的URL格式', 400);
    }
    
    // 使用缓存管理器删除缓存
    let success = false;
    try {
      success = await cacheManager.deleteDetailCache(url);
    } catch (cacheError) {
      console.warn('缓存管理器删除失败，使用数据库删除:', cacheError);
      // 生成URL哈希
      const urlHash = await utils.hashPassword(url);
      
      const result = await env.DB.prepare(`
        DELETE FROM detail_cache WHERE url_hash = ?
      `).bind(urlHash).run();
      
      success = (result.changes || 0) > 0;
    }
    
    if (success) {
      // 记录用户行为
      await utils.logUserAction(env, user.id, 'detail_cache_delete', {
        url,
        timestamp: Date.now()
      }, request);
      
      return utils.successResponse({
        message: '缓存删除成功',
        url
      });
    } else {
      return utils.errorResponse('缓存删除失败或缓存不存在', 404);
    }
    
  } catch (error) {
    console.error('删除缓存失败:', error);
    return utils.errorResponse('删除缓存失败: ' + error.message, 500);
  }
}

// ===================== 配置管理相关 =====================

/**
 * 获取详情提取配置
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
    
    // 如果没有配置记录，返回默认配置
    const config = userConfig ? {
      enableDetailExtraction: Boolean(userConfig.enable_detail_extraction),
      autoExtractDetails: Boolean(userConfig.auto_extract_details),
      maxAutoExtractions: userConfig.max_auto_extractions,
      extractionBatchSize: userConfig.extraction_batch_size,
      extractionTimeout: userConfig.extraction_timeout,
      enableRetry: Boolean(userConfig.enable_retry),
      maxRetryAttempts: userConfig.max_retry_attempts,
      enableCache: Boolean(userConfig.enable_cache),
      cacheDuration: userConfig.cache_duration,
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
    } : {
      // 默认配置
      enableDetailExtraction: true,
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      extractionTimeout: CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT,
      enableRetry: true,
      maxRetryAttempts: CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS,
      enableCache: true,
      cacheDuration: CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION,
      enableLocalCache: true,
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      compactMode: false,
      enableImagePreview: true,
      showExtractionProgress: true,
      enableContentFilter: false,
      contentFilterKeywords: []
    };
    
    // 添加系统限制信息
    config.systemLimits = {
      maxTimeout: CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT,
      minTimeout: CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT,
      maxCacheDuration: CONFIG.DETAIL_EXTRACTION.MAX_CACHE_DURATION,
      minCacheDuration: CONFIG.DETAIL_EXTRACTION.MIN_CACHE_DURATION,
      maxBatchSize: CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE
    };
    
    return utils.successResponse({
      config,
      message: '配置获取成功'
    });
    
  } catch (error) {
    console.error('获取详情提取配置失败:', error);
    return utils.errorResponse('获取配置失败', 500);
  }
}

/**
 * 更新详情提取配置
 */
export async function updateDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    const body = await request.json().catch(() => ({}));
    const { config } = body;
    
    if (!config || typeof config !== 'object') {
      return utils.errorResponse('配置数据格式错误', 400);
    }
    
    // 验证配置参数
    const validationErrors = validateDetailConfig(config);
    if (validationErrors.length > 0) {
      return utils.errorResponse('配置验证失败: ' + validationErrors.join(', '), 400);
    }
    
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
    await utils.logUserAction(env, user.id, 'detail_config_update', {
      changedKeys: Object.keys(config),
      timestamp: now
    }, request);
    
    return utils.successResponse({
      message: '配置更新成功',
      updatedKeys: Object.keys(config)
    });
    
  } catch (error) {
    console.error('更新详情提取配置失败:', error);
    return utils.errorResponse('更新配置失败: ' + error.message, 500);
  }
}

// ===================== 统计信息相关 =====================

/**
 * 获取详情提取统计信息
 */
export async function getDetailExtractionStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }
  
  try {
    // 获取用户今日统计
    const todayStats = await env.DB.prepare(`
      SELECT * FROM detail_extraction_stats 
      WHERE user_id = ? AND date_key = date('now')
    `).bind(user.id).first();
    
    // 获取用户总体统计
    const totalStats = await env.DB.prepare(`
      SELECT 
        SUM(total_extractions) as total_extractions,
        SUM(successful_extractions) as successful_extractions,
        SUM(cached_extractions) as cached_extractions,
        SUM(failed_extractions) as failed_extractions,
        AVG(average_extraction_time) as avg_extraction_time,
        AVG(cache_hit_rate) as avg_cache_hit_rate
      FROM detail_extraction_stats 
      WHERE user_id = ?
    `).bind(user.id).first();
    
    // 获取最近7天统计
    const weekStats = await env.DB.prepare(`
      SELECT 
        SUM(total_extractions) as week_extractions,
        AVG(cache_hit_rate) as week_cache_hit_rate
      FROM detail_extraction_stats 
      WHERE user_id = ? AND date_key >= date('now', '-7 days')
    `).bind(user.id).first();
    
    // 获取热门源类型统计
    const sourceStats = await env.DB.prepare(`
      SELECT 
        source_type,
        COUNT(*) as count,
        AVG(extraction_time) as avg_time
      FROM detail_extraction_history 
      WHERE user_id = ? AND created_at >= strftime('%s', 'now', '-30 days') * 1000
      GROUP BY source_type 
      ORDER BY count DESC 
      LIMIT 10
    `).bind(user.id).all();
    
    const stats = {
      user: {
        totalExtractions: totalStats?.total_extractions || 0,
        successfulExtractions: totalStats?.successful_extractions || 0,
        cachedExtractions: totalStats?.cached_extractions || 0,
        failedExtractions: totalStats?.failed_extractions || 0,
        successRate: totalStats?.total_extractions > 0 ? 
          ((totalStats.successful_extractions || 0) / totalStats.total_extractions * 100).toFixed(1) : 0,
        cacheHitRate: (totalStats?.avg_cache_hit_rate || 0).toFixed(1),
        averageExtractionTime: Math.round(totalStats?.avg_extraction_time || 0),
        todayExtractions: todayStats?.total_extractions || 0,
        weekExtractions: weekStats?.week_extractions || 0
      },
      sources: sourceStats.results.map(item => ({
        sourceType: item.source_type,
        count: item.count,
        averageTime: Math.round(item.avg_time || 0)
      })),
      cache: {
        hitRate: (weekStats?.week_cache_hit_rate || 0).toFixed(1)
      }
    };
    
    return utils.successResponse({
      stats,
      message: '统计信息获取成功'
    });
    
  } catch (error) {
    console.error('获取详情提取统计失败:', error);
    return utils.errorResponse('获取统计失败', 500);
  }
}

// ===================== 辅助函数 =====================

/**
 * 保存详情提取历史
 */
async function saveDetailExtractionHistory(env, userId, searchResult, detailInfo) {
  try {
    const historyId = utils.generateId();
    const now = Date.now();
    
    await env.DB.prepare(`
      INSERT INTO detail_extraction_history (
        id, user_id, url, source_type, keyword,
        extraction_status, extraction_time, extraction_error, data_size,
        enable_cache, enable_retry, timeout_ms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      historyId, userId, searchResult.url, detailInfo.sourceType || 'unknown',
      searchResult.keyword || '', detailInfo.extractionStatus || 'unknown',
      detailInfo.extractionTime || 0, detailInfo.extractionError || '',
      JSON.stringify(detailInfo).length, 1, 1, 15000, now
    ).run();
    
  } catch (error) {
    console.error('保存详情提取历史失败:', error);
  }
}

/**
 * 验证详情配置
 */
function validateDetailConfig(config) {
  const errors = [];
  
  // 验证超时时间
  if (config.hasOwnProperty('extractionTimeout')) {
    const timeout = Number(config.extractionTimeout);
    if (isNaN(timeout) || timeout < DETAIL_CONFIG_VALIDATION.extractionTimeout.min || 
        timeout > DETAIL_CONFIG_VALIDATION.extractionTimeout.max) {
      errors.push(`提取超时时间必须在 ${DETAIL_CONFIG_VALIDATION.extractionTimeout.min}-${DETAIL_CONFIG_VALIDATION.extractionTimeout.max}ms 之间`);
    }
  }
  
  // 验证缓存时间
  if (config.hasOwnProperty('cacheDuration')) {
    const duration = Number(config.cacheDuration);
    if (isNaN(duration) || duration < DETAIL_CONFIG_VALIDATION.cacheDuration.min || 
        duration > DETAIL_CONFIG_VALIDATION.cacheDuration.max) {
      errors.push(`缓存时间必须在 ${DETAIL_CONFIG_VALIDATION.cacheDuration.min}-${DETAIL_CONFIG_VALIDATION.cacheDuration.max}ms 之间`);
    }
  }
  
  // 验证批量大小
  if (config.hasOwnProperty('extractionBatchSize')) {
    const batchSize = Number(config.extractionBatchSize);
    if (isNaN(batchSize) || batchSize < DETAIL_CONFIG_VALIDATION.extractionBatchSize.min || 
        batchSize > DETAIL_CONFIG_VALIDATION.extractionBatchSize.max) {
      errors.push(`批量处理数量必须在 ${DETAIL_CONFIG_VALIDATION.extractionBatchSize.min}-${DETAIL_CONFIG_VALIDATION.extractionBatchSize.max} 之间`);
    }
  }
  
  // 验证自动提取数量
  if (config.hasOwnProperty('maxAutoExtractions')) {
    const maxAuto = Number(config.maxAutoExtractions);
    if (isNaN(maxAuto) || maxAuto < DETAIL_CONFIG_VALIDATION.maxAutoExtractions.min || 
        maxAuto > DETAIL_CONFIG_VALIDATION.maxAutoExtractions.max) {
      errors.push(`自动提取数量必须在 ${DETAIL_CONFIG_VALIDATION.maxAutoExtractions.min}-${DETAIL_CONFIG_VALIDATION.maxAutoExtractions.max} 之间`);
    }
  }
  
  // 验证内容过滤关键词
  if (config.hasOwnProperty('contentFilterKeywords')) {
    if (!Array.isArray(config.contentFilterKeywords)) {
      errors.push('内容过滤关键词必须是数组类型');
    }
  }
  
  return errors;
}