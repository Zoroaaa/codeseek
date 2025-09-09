// src/handlers/detail-helpers.js - detail.js 的辅助函数集合
import { utils } from '../utils.js';
import { CONFIG } from '../constants.js';

// ===================== 输入验证相关辅助函数 =====================

/**
 * 验证批量输入
 */
export function validateBatchInput(searchResults, options) {
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    return {
      valid: false,
      message: '搜索结果列表不能为空',
      details: { type: 'empty_array' }
    };
  }
  
  // 限制批量处理数量
  const maxBatchSize = CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE;
  if (searchResults.length > maxBatchSize) {
    return {
      valid: false,
      message: `批量处理数量不能超过 ${maxBatchSize} 个`,
      details: { 
        current: searchResults.length, 
        max: maxBatchSize 
      }
    };
  }
  
  // 验证每个搜索结果格式
  const invalidResults = [];
  searchResults.forEach((result, index) => {
    if (!result || !result.url) {
      invalidResults.push({ index, issue: 'missing_url' });
    } else {
      try {
        new URL(result.url);
      } catch {
        invalidResults.push({ index, issue: 'invalid_url', url: result.url });
      }
    }
  });
  
  if (invalidResults.length > 0) {
    return {
      valid: false,
      message: '存在无效的搜索结果数据',
      details: { invalidResults }
    };
  }
  
  return { valid: true };
}

/**
 * 构建批量提取选项
 */
export function buildBatchExtractionOptions(options) {
  return {
    enableCache: options.enableCache !== false,
    timeout: Math.min(Math.max(options.timeout || CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT, 
                                CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT), 
                      CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT),
    enableRetry: options.enableRetry !== false,
    maxConcurrency: Math.min(options.maxConcurrency || CONFIG.DETAIL_EXTRACTION.MAX_CONCURRENT_EXTRACTIONS, 10),
    progressInterval: options.progressInterval || 1000,
    stopOnError: options.stopOnError || false,
    strictValidation: options.strictValidation !== false
  };
}

// ===================== 进度回调相关 =====================

/**
 * 创建进度回调函数
 */
export function createProgressCallback() {
  return (progress) => {
    console.log(`批量提取进度: ${progress.current}/${progress.total} (${progress.status}) - ${progress.item}`);
    
    // 可以在这里添加实时进度推送逻辑
    // 例如：WebSocket 推送、Server-Sent Events 等
  };
}

// ===================== 统计生成相关 =====================

/**
 * 生成批量统计
 */
export function generateBatchStats(detailResults, totalTime) {
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
        failed: 0,
        avgTime: 0
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
 * 构建批量成功响应
 */
export function buildBatchSuccessResponse(detailResults, stats, originalCount) {
  return utils.successResponse({
    results: detailResults.map(result => ({
      // 基本信息
      title: result.title || 'unknown',
      code: result.code || '',
      url: result.url || result.detailUrl || result.searchUrl,
      sourceType: result.sourceType || 'unknown',
      
      // 提取状态
      extractionStatus: result.extractionStatus || 'unknown',
      extractionTime: result.extractionTime || 0,
      extractionError: result.extractionError || null,
      
      // 详情数据（只在成功时包含完整数据）
      ...(result.extractionStatus === 'success' || result.extractionStatus === 'cached' ? {
        coverImage: result.coverImage,
        screenshots: result.screenshots,
        actresses: result.actresses,
        downloadLinks: result.downloadLinks,
        magnetLinks: result.magnetLinks,
        description: result.description,
        tags: result.tags,
        rating: result.rating
      } : {})
    })),
    
    stats: {
      ...stats,
      performance: {
        itemsPerSecond: stats.totalTime > 0 ? Math.round((stats.total * 1000) / stats.totalTime) : 0,
        averageTimePerItem: stats.averageTime,
        totalTime: stats.totalTime
      }
    },
    
    summary: {
      processed: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      cached: stats.cached,
      message: `批量详情提取完成: ${stats.successful}/${stats.total} 成功 (${stats.successRate}%)`
    }
  });
}

/**
 * 构建批量错误响应
 */
export function buildBatchErrorResponse(error, totalTime) {
  return utils.errorResponse({
    message: '批量详情提取失败: ' + error.message,
    error: {
      type: error.name || 'BatchExtractionError',
      message: error.message,
      totalTime
    },
    stats: {
      total: 0,
      successful: 0,
      cached: 0,
      failed: 0,
      totalTime,
      averageTime: 0
    }
  }, 500);
}

// ===================== 历史记录处理相关 =====================

/**
 * 解析历史查询参数
 */
export function parseHistoryParams(searchParams) {
  return {
    limit: Math.min(parseInt(searchParams.get('limit') || '20'), 100),
    offset: Math.max(parseInt(searchParams.get('offset') || '0'), 0),
    source: searchParams.get('source') || null,
    status: searchParams.get('status') || null,
    dateRange: searchParams.get('dateRange') || null,
    keyword: searchParams.get('keyword') || null,
    sortBy: searchParams.get('sortBy') || 'created_at',
    sortOrder: searchParams.get('sortOrder') || 'DESC'
  };
}

/**
 * 构建历史查询
 */
export function buildHistoryQuery(userId, params) {
  let query = `
    SELECT * FROM detail_extraction_history 
    WHERE user_id = ?
  `;
  const queryParams = [userId];
  
  // 添加过滤条件
  if (params.source) {
    query += ` AND source_type = ?`;
    queryParams.push(params.source);
  }
  
  if (params.status) {
    query += ` AND extraction_status = ?`;
    queryParams.push(params.status);
  }
  
  if (params.keyword) {
    query += ` AND (url LIKE ? OR keyword LIKE ?)`;
    const keywordPattern = `%${params.keyword}%`;
    queryParams.push(keywordPattern, keywordPattern);
  }
  
  if (params.dateRange) {
    const dateRanges = {
      'today': Date.now() - 24 * 60 * 60 * 1000,
      'week': Date.now() - 7 * 24 * 60 * 60 * 1000,
      'month': Date.now() - 30 * 24 * 60 * 60 * 1000,
      'quarter': Date.now() - 90 * 24 * 60 * 60 * 1000
    };
    
    if (dateRanges[params.dateRange]) {
      query += ` AND created_at >= ?`;
      queryParams.push(dateRanges[params.dateRange]);
    }
  }
  
  // 排序
  const validSortColumns = ['created_at', 'extraction_time', 'extraction_status'];
  const sortBy = validSortColumns.includes(params.sortBy) ? params.sortBy : 'created_at';
  const sortOrder = ['ASC', 'DESC'].includes(params.sortOrder) ? params.sortOrder : 'DESC';
  
  query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
  queryParams.push(params.limit, params.offset);
  
  return { query, queryParams };
}

/**
 * 构建历史计数查询
 */
export function buildHistoryCountQuery(userId, params) {
  let query = `SELECT COUNT(*) as total FROM detail_extraction_history WHERE user_id = ?`;
  const queryParams = [userId];
  
  // 应用相同的过滤条件
  if (params.source) {
    query += ` AND source_type = ?`;
    queryParams.push(params.source);
  }
  
  if (params.status) {
    query += ` AND extraction_status = ?`;
    queryParams.push(params.status);
  }
  
  if (params.keyword) {
    query += ` AND (url LIKE ? OR keyword LIKE ?)`;
    const keywordPattern = `%${params.keyword}%`;
    queryParams.push(keywordPattern, keywordPattern);
  }
  
  return { query, params: queryParams };
}

/**
 * 增强历史记录项
 */
export function enhanceHistoryItem(item) {
  return {
    id: item.id,
    url: item.url,
    sourceType: item.source_type,
    keyword: item.keyword,
    extractionStatus: item.extraction_status,
    extractionTime: item.extraction_time,
    extractionError: item.extraction_error,
    dataSize: item.data_size,
    createdAt: new Date(item.created_at).toISOString(),
    
    // 增强字段
    relativeTime: getRelativeTime(item.created_at),
    statusBadge: getStatusBadge(item.extraction_status),
    performanceRating: getPerformanceRating(item.extraction_time),
    estimatedQuality: getEstimatedQuality(item)
  };
}

// ===================== 缓存统计相关 =====================

/**
 * 获取用户特定的缓存统计
 */
export async function getUserSpecificCacheStats(env, userId) {
  try {
    const userCacheQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as userCacheItems,
        AVG(cache_size) as avgUserCacheSize,
        SUM(access_count) as totalUserAccess
      FROM detail_cache dc
      JOIN detail_extraction_history deh ON dc.url_hash = deh.url
      WHERE deh.user_id = ?
    `).bind(userId).first();
    
    return {
      cacheItems: userCacheQuery?.userCacheItems || 0,
      averageSize: Math.round(userCacheQuery?.avgUserCacheSize || 0),
      totalAccess: userCacheQuery?.totalUserAccess || 0,
      hitRate: userCacheQuery?.totalUserAccess > 0 ? 
        Math.round((userCacheQuery.totalUserAccess / Math.max(userCacheQuery.userCacheItems, 1)) * 100) : 0
    };
  } catch (error) {
    console.warn('获取用户缓存统计失败:', error);
    return { cacheItems: 0, averageSize: 0, totalAccess: 0, hitRate: 0 };
  }
}

/**
 * 获取源类型统计
 */
export async function getSourceTypeStats(env, userId = null) {
  try {
    let query = `
      SELECT 
        source_type,
        COUNT(*) as count,
        AVG(extraction_time) as avg_time,
        COUNT(CASE WHEN extraction_status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cached_count
      FROM detail_extraction_history
    `;
    
    const params = [];
    if (userId) {
      query += ` WHERE user_id = ?`;
      params.push(userId);
    }
    
    query += ` GROUP BY source_type ORDER BY count DESC LIMIT 10`;
    
    const result = await env.DB.prepare(query).bind(...params).all();
    
    return result.results.map(item => ({
      sourceType: item.source_type,
      count: item.count,
      averageTime: Math.round(item.avg_time || 0),
      successRate: item.count > 0 ? Math.round((item.success_count / item.count) * 100) : 0,
      cacheHitRate: item.count > 0 ? Math.round((item.cached_count / item.count) * 100) : 0
    }));
  } catch (error) {
    console.warn('获取源类型统计失败:', error);
    return [];
  }
}

/**
 * 获取缓存效率统计
 */
export async function getCacheEfficiencyStats(env, userId) {
  try {
    const efficiencyQuery = await env.DB.prepare(`
      SELECT 
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cached_count,
        COUNT(*) as total_count,
        AVG(CASE WHEN extraction_status != 'cached' THEN extraction_time END) as avg_extraction_time,
        AVG(CASE WHEN extraction_status = 'cached' THEN extraction_time END) as avg_cache_time
      FROM detail_extraction_history
      WHERE user_id = ? AND created_at >= ?
    `).bind(userId, Date.now() - 30 * 24 * 60 * 60 * 1000).first();
    
    const cacheHitRate = efficiencyQuery?.total_count > 0 ? 
      Math.round((efficiencyQuery.cached_count / efficiencyQuery.total_count) * 100) : 0;
    
    const timeSaved = (efficiencyQuery?.avg_extraction_time || 0) - (efficiencyQuery?.avg_cache_time || 0);
    
    return {
      hitRate: cacheHitRate,
      timeSavedPerRequest: Math.max(0, Math.round(timeSaved)),
      totalTimeSaved: Math.max(0, Math.round(timeSaved * (efficiencyQuery?.cached_count || 0))),
      efficiency: cacheHitRate > 70 ? 'excellent' : cacheHitRate > 50 ? 'good' : cacheHitRate > 30 ? 'fair' : 'poor'
    };
  } catch (error) {
    console.warn('获取缓存效率统计失败:', error);
    return { hitRate: 0, timeSavedPerRequest: 0, totalTimeSaved: 0, efficiency: 'unknown' };
  }
}

// ===================== 缓存清理相关 =====================

/**
 * 解析清理参数
 */
export function parseClearParams(searchParams) {
  return {
    count: Math.min(parseInt(searchParams.get('count') || '10'), 100),
    olderThan: searchParams.get('olderThan') || null,
    sourceType: searchParams.get('sourceType') || null,
    minSize: parseInt(searchParams.get('minSize') || '0'),
    maxSize: parseInt(searchParams.get('maxSize') || '0') || null
  };
}

/**
 * 处理过期缓存清理
 */
export async function handleExpiredCacheCleanup(env, params) {
  try {
    const count = await cacheManager.cleanupExpiredCache();
    return count;
  } catch (error) {
    console.warn('缓存管理器清理失败，使用数据库清理:', error.message);
    
    const result = await env.DB.prepare(`
      DELETE FROM detail_cache WHERE expires_at < ?
    `).bind(Date.now()).run();
    
    return result.changes || 0;
  }
}

/**
 * 处理全部缓存清理
 */
export async function handleAllCacheCleanup(env, params) {
  try {
    await cacheManager.clearAllCache();
    
    const result = await env.DB.prepare(`DELETE FROM detail_cache`).run();
    
    return {
      count: result.changes || 0,
      details: { operation: 'clear_all', timestamp: Date.now() }
    };
  } catch (error) {
    console.warn('全部缓存清理失败:', error);
    return { count: 0, details: { error: error.message } };
  }
}

/**
 * 处理LRU缓存清理
 */
export async function handleLRUCacheCleanup(env, params) {
  try {
    await cacheManager.cleanupLeastRecentlyUsed(params.count);
    
    return {
      count: params.count,
      details: { 
        operation: 'lru_cleanup', 
        targetCount: params.count,
        timestamp: Date.now() 
      }
    };
  } catch (error) {
    console.warn('LRU缓存清理失败，使用数据库清理:', error.message);
    
    const result = await env.DB.prepare(`
      DELETE FROM detail_cache 
      WHERE id IN (
        SELECT id FROM detail_cache 
        ORDER BY last_accessed ASC 
        LIMIT ?
      )
    `).bind(params.count).run();
    
    return {
      count: result.changes || 0,
      details: { operation: 'lru_fallback', error: error.message }
    };
  }
}

/**
 * 处理选择性缓存清理
 */
export async function handleSelectiveCacheCleanup(env, params) {
  let query = `DELETE FROM detail_cache WHERE 1=1`;
  const queryParams = [];
  
  if (params.olderThan) {
    const olderThanTime = Date.now() - (parseInt(params.olderThan) * 24 * 60 * 60 * 1000);
    query += ` AND created_at < ?`;
    queryParams.push(olderThanTime);
  }
  
  if (params.sourceType) {
    query += ` AND url LIKE ?`;
    queryParams.push(`%${params.sourceType}%`);
  }
  
  if (params.minSize > 0) {
    query += ` AND cache_size >= ?`;
    queryParams.push(params.minSize);
  }
  
  if (params.maxSize) {
    query += ` AND cache_size <= ?`;
    queryParams.push(params.maxSize);
  }
  
  try {
    const result = await env.DB.prepare(query).bind(...queryParams).run();
    
    return {
      count: result.changes || 0,
      details: {
        operation: 'selective_cleanup',
        criteria: params,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.warn('选择性缓存清理失败:', error);
    return {
      count: 0,
      details: { error: error.message }
    };
  }
}

// ===================== 配置相关辅助函数 =====================

/**
 * 获取系统限制
 */
export function getSystemLimits() {
  return {
    maxTimeout: CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT,
    minTimeout: CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT,
    maxCacheDuration: CONFIG.DETAIL_EXTRACTION.MAX_CACHE_DURATION,
    minCacheDuration: CONFIG.DETAIL_EXTRACTION.MIN_CACHE_DURATION,
    maxBatchSize: CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE,
    maxDownloadLinks: CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS,
    maxMagnetLinks: CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS,
    maxScreenshots: CONFIG.DETAIL_EXTRACTION.MAX_SCREENSHOTS,
    maxConcurrentExtractions: CONFIG.DETAIL_EXTRACTION.MAX_CONCURRENT_EXTRACTIONS
  };
}

/**
 * 获取默认配置
 */
export function getDefaultConfig() {
  return {
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
}

// ===================== 实用工具函数 =====================

/**
 * 获取相对时间
 */
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return `${Math.floor(diff / 604800000)}周前`;
}

/**
 * 获取状态徽章
 */
function getStatusBadge(status) {
  const badges = {
    'success': { text: '成功', color: 'green', icon: '✓' },
    'cached': { text: '缓存', color: 'blue', icon: '⚡' },
    'partial': { text: '部分', color: 'yellow', icon: '⚠' },
    'error': { text: '失败', color: 'red', icon: '✗' },
    'timeout': { text: '超时', color: 'orange', icon: '⏱' }
  };
  
  return badges[status] || { text: '未知', color: 'gray', icon: '?' };
}

/**
 * 获取性能评级
 */
function getPerformanceRating(extractionTime) {
  if (extractionTime < 3000) return 'excellent';
  if (extractionTime < 8000) return 'good';
  if (extractionTime < 15000) return 'fair';
  return 'poor';
}

/**
 * 估算质量
 */
function getEstimatedQuality(item) {
  let score = 0;
  
  // 基于提取时间
  if (item.extraction_time < 5000) score += 2;
  else if (item.extraction_time < 10000) score += 1;
  
  // 基于数据大小
  if (item.data_size > 5000) score += 2;
  else if (item.data_size > 2000) score += 1;
  
  // 基于状态
  if (item.extraction_status === 'success') score += 3;
  else if (item.extraction_status === 'cached') score += 2;
  
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  if (score >= 2) return 'low';
  return 'unknown';
}