// src/handlers/system.js - 系统相关路由处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { 
    checkSingleSourceStatus, 
    saveStatusCheckResults,
    analyzePageContent
} from '../services/services.js';
import { CONFIG } from '../constants.js';

// ===================== 健康检查相关 =====================

// 健康检查
export async function healthCheckHandler(request, env) {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.3.0'
    });
}

// ===================== 搜索源状态检查相关 =====================

// 搜索源状态检查
export async function sourceStatusCheckHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { sources, keyword, options = {} } = body;
        
        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            return utils.errorResponse('搜索源列表不能为空', 400);
        }
        
        if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空', 400);
        }
        
        const trimmedKeyword = keyword.trim();
        const keywordHash = await utils.hashPassword(`${trimmedKeyword}${Date.now()}`);
        const timeout = Math.min(Math.max(options.timeout || 10000, 3000), 30000);
        const checkContentMatch = options.checkContentMatch !== false;
        
        console.log(`开始检查 ${sources.length} 个搜索源，关键词: ${trimmedKeyword}`);
        
        const results = [];
        const concurrency = Math.min(sources.length, 3);
        
        for (let i = 0; i < sources.length; i += concurrency) {
            const batch = sources.slice(i, i + concurrency);
            const batchPromises = batch.map(source => 
                checkSingleSourceStatus(source, trimmedKeyword, keywordHash, {
                    timeout,
                    checkContentMatch,
                    env
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            if (i + concurrency < sources.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        saveStatusCheckResults(env, results, trimmedKeyword).catch(console.error);
        
        const summary = {
            total: results.length,
            available: results.filter(r => r.status === 'available').length,
            unavailable: results.filter(r => r.status === 'unavailable').length,
            timeout: results.filter(r => r.status === 'timeout').length,
            error: results.filter(r => r.status === 'error').length,
            averageResponseTime: Math.round(
                results.filter(r => r.responseTime > 0)
                    .reduce((sum, r) => sum + r.responseTime, 0) / 
                Math.max(results.filter(r => r.responseTime > 0).length, 1)
            ),
            keyword: trimmedKeyword,
            timestamp: Date.now()
        };
        
        return utils.successResponse({
            summary,
            results,
            message: `搜索源状态检查完成: ${summary.available}/${summary.total} 可用`
        });
        
    } catch (error) {
        console.error('搜索源状态检查失败:', error);
        return utils.errorResponse('搜索源状态检查失败: ' + error.message, 500);
    }
}

// 获取状态检查历史
export async function sourceStatusHistoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }
    
    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
        const keyword = url.searchParams.get('keyword');
        
        let query = `
            SELECT * FROM source_status_cache 
            WHERE 1=1
        `;
        const params = [];
        
        if (keyword) {
            query += ` AND keyword LIKE ?`;
            params.push(`%${keyword}%`);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        const history = result.results.map(item => ({
            id: item.id,
            sourceId: item.source_id,
            keyword: item.keyword,
            status: item.status,
            available: Boolean(item.available),
            contentMatch: Boolean(item.content_match),
            responseTime: item.response_time,
            qualityScore: item.quality_score,
            lastChecked: item.created_at,
            checkError: item.check_error
        }));
        
        return utils.successResponse({
            history,
            total: result.results.length,
            limit,
            offset
        });
        
    } catch (error) {
        console.error('获取状态检查历史失败:', error);
        return utils.errorResponse('获取历史失败', 500);
    }
}

// ===================== 搜索源管理相关 =====================

// 获取搜索源
export async function getSearchSourcesHandler(request, env) {
    try {
        let customSources = [];
        let customCategories = [];
        
        const user = await authenticate(request, env);
        if (user) {
            try {
                const userRecord = await env.DB.prepare(`
                    SELECT settings FROM users WHERE id = ?
                `).bind(user.id).first();

                if (userRecord) {
                    const settings = JSON.parse(userRecord.settings || '{}');
                    customSources = settings.customSearchSources || [];
                    customCategories = settings.customSourceCategories || [];
                }
            } catch (error) {
                console.warn('获取用户自定义搜索源失败:', error);
            }
        }

        return utils.successResponse({
            customSources,
            customCategories,
            message: 'Built-in sources should be loaded from frontend constants'
        });

    } catch (error) {
        console.error('获取搜索源失败:', error);
        return utils.errorResponse('获取搜索源失败', 500);
    }
}

// ===================== 系统配置相关 =====================

// 获取配置
export async function getConfigHandler(request, env) {
    return utils.successResponse({
        allowRegistration: (env.ALLOW_REGISTRATION || 'true') === 'true',
        minUsernameLength: parseInt(env.MIN_USERNAME_LENGTH || '3'),
        maxUsernameLength: parseInt(env.MAX_USERNAME_LENGTH || '20'),
        minPasswordLength: parseInt(env.MIN_PASSWORD_LENGTH || '6'),
        maxFavoritesPerUser: parseInt(env.MAX_FAVORITES_PER_USER || '1000'),
        maxHistoryPerUser: parseInt(env.MAX_HISTORY_PER_USER || '1000'),
        maxTagsPerUser: parseInt(env.MAX_TAGS_PER_USER || '50'),
        version: env.APP_VERSION || '1.3.0'
    });
}

// ===================== 行为记录相关 =====================

// 记录行为
export async function recordActionHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, data, timestamp, sessionId } = body;

        let actionType = 'unknown';
        if (action && typeof action === 'string' && action.trim()) {
            actionType = action.trim();
        }

        const allowedActions = CONFIG.ALLOWED_ACTIONS;

        if (!allowedActions.includes(actionType)) {
            actionType = 'custom';
        }

        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        if (userId && env.ENABLE_ACTION_LOGGING === 'true') {
            await utils.logUserAction(env, userId, actionType, data || {}, request);
        }

        return utils.successResponse({ 
            recorded: true,
            actionType,
            userId: userId || null,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('记录行为失败:', error);
        return utils.successResponse({ 
            recorded: false, 
            error: 'silent_failure',
            message: '行为记录失败但不影响功能'
        });
    }
}

// ===================== 默认处理器 =====================

// 默认处理器
export function defaultHandler(request) {
    const url = new URL(request.url);
    return utils.errorResponse(`API路径不存在: ${url.pathname}`, 404);
}