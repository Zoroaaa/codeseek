// src/handlers/detail-refactored.js - 重构后的详情提取处理器，适配新架构

import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { detailExtractionService } from '../services/DetailExtractionService.js';
import { detailConfigService } from '../services/detail-config-service.js';
import { ParsedData } from '../interfaces/ParsedData.js';

/**
 * 单个详情提取处理器 - 新架构版本
 * 使用模块化解析器和统一数据结构
 */
export async function extractSingleDetailHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
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
    
    // 获取用户配置
    const userConfig = user ? 
      await detailConfigService.getUserConfig(env, user.id) : 
      detailConfigService.getDefaultUserConfig();
    
    // 检查是否启用详情提取
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse('详情提取功能已被禁用', 403);
    }
    
    // 构建提取选项
    const extractOptions = {
      timeout: options.timeout || userConfig.extractionTimeout,
      enableRetry: options.enableRetry !== false && userConfig.enableRetry,
      enableCache: options.enableCache !== false && userConfig.enableCache,
      sourceType: options.sourceType || null
    };
    
    console.log(`开始详情提取 (新架构): ${searchResult.title} - ${searchResult.url}`);
    console.log('使用选项:', extractOptions);
    
    // 执行详情提取
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
    
    // 构建成功响应
    const totalTime = Date.now() - startTime;
    
    return utils.successResponse({
      detailInfo: detailInfo.toJSON(),
      
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
 * 批量详情提取处理器 - 新架构版本
 */
export async function extractBatchDetailsHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  
  try {
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
    
    // 构建批量提取选项
    const extractOptions = {
      timeout: options.timeout || userConfig.extractionTimeout,
      enableRetry: options.enableRetry !== false && userConfig.enableRetry,
      enableCache: options.enableCache !== false && userConfig.enableCache,
      maxConcurrency: Math.min(options.maxConcurrency || userConfig.maxConcurrentExtractions, 5),
      onProgress: createProgressCallback()
    };
    
    console.log(`开始批量详情提取 (新架构): ${searchResults.length} 个结果`);
    console.log('批量提取选项:', extractOptions);
    
    // 执行批量详情提取
    const detailResults = await detailExtractionService.extractBatchDetails(searchResults, extractOptions);
    
    const totalTime = Date.now() - startTime;
    
    // 生成统计信息
    const stats = generateBatchStats(detailResults, totalTime);
    
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
    
    // 构建批量成功响应
    return utils.successResponse({
      results: detailResults.map(result => result.toJSON()),
      
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

/**
 * 获取支持的站点信息处理器 - 新架构版本
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
 * 验证解析器状态处理器 - 新架构版本
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
 * 获取服务统计信息处理器 - 新架构版本
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
 * 重新加载解析器处理器 - 新架构版本
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

// ==================== 辅助函数 ====================

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
 * 创建进度回调函数
 */
function createProgressCallback() {
  return (progress) => {
    console.log(`批量提取进度 (新架构): ${progress.current}/${progress.total} (${progress.status}) - ${progress.item}`);
    
    // 可以在这里添加实时进度推送逻辑
    // 例如：WebSocket 推送、Server-Sent Events 等
  };
}

/**
 * 生成批量统计
 */
function generateBatchStats(detailResults, totalTime) {
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

// 保持与旧版本的兼容性
export {
  extractSingleDetailHandler as extractSingleDetailHandlerV2,
  extractBatchDetailsHandler as extractBatchDetailsHandlerV2
};