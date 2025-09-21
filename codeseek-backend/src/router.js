// src/router.js - 重构版本：搜索源管理功能已独立，移除旧的冗余路由
import { utils } from './utils.js';

// 导入所有处理器
import {
    authRegisterHandler,
    authLoginHandler,
    authVerifyTokenHandler,
    authRefreshTokenHandler,
    authChangePasswordHandler,
    authLogoutHandler,
    authDeleteAccountHandler,
    // 邮箱验证处理器
    authSendRegistrationCodeHandler,
    authSendPasswordResetCodeHandler,
    authRequestEmailChangeHandler,
    authSendEmailChangeCodeHandler,
    authVerifyEmailChangeCodeHandler,
    authSendAccountDeleteCodeHandler,
    // 忘记密码处理器
    authForgotPasswordHandler,
    authResetPasswordHandler,
    // 验证状态检查处理器
    authCheckVerificationStatusHandler,
    authGetUserVerificationStatusHandler,
    authSmartSendVerificationCodeHandler
} from './handlers/auth.js';

import {
    communityGetTagsHandler,
    communityCreateTagHandler,
    communityUpdateTagHandler,
    communityDeleteTagHandler,
    communityGetSourcesHandler,
    communityCreateSourceHandler,
    communityGetSourceDetailHandler,
    communityUpdateSourceHandler,
    communityDeleteSourceHandler,
    communityDownloadSourceHandler,
    communityLikeSourceHandler,
    communityReviewSourceHandler,
    communityReportSourceHandler,
    communityUserStatsHandler,
    communitySearchHandler
} from './handlers/community.js';

// 用户相关处理器（已移除搜索源管理相关功能）
import {
    userGetSettingsHandler,
    userUpdateSettingsHandler,
    userSyncFavoritesHandler,
    userGetFavoritesHandler,
    userSaveSearchHistoryHandler,
    userGetSearchHistoryHandler,
    userDeleteSearchHistoryHandler,
    userClearSearchHistoryHandler,
    userGetSearchStatsHandler
} from './handlers/user.js';

// 独立的搜索源管理处理器
import {
    getMajorCategoriesHandler,
    createMajorCategoryHandler,
    getSourceCategoriesHandler,
    createSourceCategoryHandler,
    updateSourceCategoryHandler,
    deleteSourceCategoryHandler,
    getSearchSourcesHandler,
    createSearchSourceHandler,
    updateSearchSourceHandler,
    deleteSearchSourceHandler,
    getUserSourceConfigsHandler,
    updateUserSourceConfigHandler,
    batchUpdateUserSourceConfigsHandler,
    getSearchSourceStatsHandler,
    exportUserSearchSourcesHandler
} from './handlers/search-sources.js';

// 系统相关处理器（已移除搜索源管理相关功能）
import {
    healthCheckHandler,
    sourceStatusCheckHandler,
    sourceStatusHistoryHandler,
    getConfigHandler,
    recordActionHandler,
    defaultHandler
} from './handlers/system.js';

import {
    extractSingleDetailHandler,
    extractBatchDetailsHandler,
    getDetailExtractionHistoryHandler,
    getDetailCacheStatsHandler,
    clearDetailCacheHandler,
    deleteDetailCacheHandler,
    getDetailExtractionConfigHandler,
    updateDetailExtractionConfigHandler,
    resetDetailExtractionConfigHandler,
    applyConfigPresetHandler,
    getDetailExtractionStatsHandler
} from './handlers/detail.js';

export class Router {
    constructor() {
        this.routes = new Map();
        this.paramRoutes = [];
        this.setupRoutes();
    }

    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
        
        if (path.includes(':')) {
            this.paramRoutes.push({
                method,
                path,
                handler,
                pattern: this.createPattern(path)
            });
        }
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    options(path, handler) { this.addRoute('OPTIONS', path, handler); }

    createPattern(path) {
        const parts = path.split('/');
        return {
            parts,
            paramNames: parts.filter(part => part.startsWith(':')).map(part => part.substring(1))
        };
    }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // 处理CORS预检请求
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: utils.getCorsHeaders(request.headers.get('Origin') || '*')
            });
        }

        // 1. 优先尝试精确匹配
        const exactKey = `${method}:${pathname}`;
        if (this.routes.has(exactKey)) {
            console.log(`精确匹配路由: ${exactKey}`);
            return await this.executeHandler(this.routes.get(exactKey), request, env);
        }

        // 2. 尝试参数路由匹配
        for (const route of this.paramRoutes) {
            if (route.method === method) {
                const match = this.matchRoute(route.pattern, pathname);
                if (match.success) {
                    console.log(`参数路由匹配: ${route.path}, 参数:`, match.params);
                    request.params = match.params;
                    return await this.executeHandler(route.handler, request, env);
                }
            }
        }

        // 3. 尝试通配符路由
        const wildcardKey = `${method}:/*`;
        if (this.routes.has(wildcardKey)) {
            return await this.executeHandler(this.routes.get(wildcardKey), request, env);
        }

        console.error(`未找到匹配的路由: ${method} ${pathname}`);
        return utils.errorResponse(`API路径不存在: ${pathname}`, 404);
    }

    matchRoute(pattern, pathname) {
        const requestParts = pathname.split('/');
        const routeParts = pattern.parts;

        if (requestParts.length !== routeParts.length) {
            return { success: false, params: {} };
        }

        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];

            if (routePart.startsWith(':')) {
                const paramName = routePart.substring(1);
                params[paramName] = requestPart;
            } else if (routePart !== requestPart) {
                return { success: false, params: {} };
            }
        }

        return { success: true, params };
    }

    async executeHandler(handler, request, env) {
        try {
            const result = await handler(request, env);
            if (result instanceof Response) {
                const corsHeaders = utils.getCorsHeaders(request.headers.get('Origin') || '*');
                Object.entries(corsHeaders).forEach(([key, value]) => {
                    result.headers.set(key, value);
                });
            }
            return result;
        } catch (error) {
            console.error('路由处理器错误:', error);
            return utils.errorResponse('内部服务器错误', 500);
        }
    }

    setupRoutes() {
        // 健康检查
        this.get('/api/health', healthCheckHandler);

        // ===============================================
        // 认证相关路由（增强版本，包含邮箱验证和忘记密码）
        // ===============================================
        
        // 基础认证
        this.post('/api/auth/register', authRegisterHandler);
        this.post('/api/auth/login', authLoginHandler);
        this.post('/api/auth/verify-token', authVerifyTokenHandler);
        this.post('/api/auth/refresh', authRefreshTokenHandler);
        this.post('/api/auth/logout', authLogoutHandler);
        
        // 密码管理（集成邮箱验证）
        this.put('/api/auth/change-password', authChangePasswordHandler);
        this.post('/api/auth/send-password-reset-code', authSendPasswordResetCodeHandler);
        
        // 忘记密码功能
        this.post('/api/auth/forgot-password', authForgotPasswordHandler);
        this.post('/api/auth/reset-password', authResetPasswordHandler);
        
        // 账户删除（集成邮箱验证）
        this.post('/api/auth/delete-account', authDeleteAccountHandler);
        this.post('/api/auth/send-account-delete-code', authSendAccountDeleteCodeHandler);

        // 邮箱验证状态检查和智能发送
        this.get('/api/auth/verification-status', authCheckVerificationStatusHandler);
        this.get('/api/auth/user-verification-status', authGetUserVerificationStatusHandler);
        this.post('/api/auth/smart-send-code', authSmartSendVerificationCodeHandler);

        // 邮箱验证相关路由
        this.post('/api/auth/send-registration-code', authSendRegistrationCodeHandler);
        this.post('/api/auth/request-email-change', authRequestEmailChangeHandler);
        this.post('/api/auth/send-email-change-code', authSendEmailChangeCodeHandler);
        this.post('/api/auth/verify-email-change-code', authVerifyEmailChangeCodeHandler);

        // ===============================================
        // 独立的搜索源管理API路由
        // ===============================================
        
        // 搜索源大类管理
        this.get('/api/search-sources/major-categories', getMajorCategoriesHandler);
        this.post('/api/search-sources/major-categories', createMajorCategoryHandler);
        
        // 搜索源分类管理
        this.get('/api/search-sources/categories', getSourceCategoriesHandler);
        this.post('/api/search-sources/categories', createSourceCategoryHandler);
        this.put('/api/search-sources/categories/:id', updateSourceCategoryHandler);
        this.delete('/api/search-sources/categories/:id', deleteSourceCategoryHandler);
        
        // 搜索源管理
        this.get('/api/search-sources/sources', getSearchSourcesHandler);
        this.post('/api/search-sources/sources', createSearchSourceHandler);
        this.put('/api/search-sources/sources/:id', updateSearchSourceHandler);
        this.delete('/api/search-sources/sources/:id', deleteSearchSourceHandler);
        
        // 用户搜索源配置管理
        this.get('/api/search-sources/user-configs', getUserSourceConfigsHandler);
        this.post('/api/search-sources/user-configs', updateUserSourceConfigHandler);
        this.post('/api/search-sources/user-configs/batch', batchUpdateUserSourceConfigsHandler);
        
        // 搜索源统计和导出
        this.get('/api/search-sources/stats', getSearchSourceStatsHandler);
        this.get('/api/search-sources/export', exportUserSearchSourcesHandler);

        // ===============================================
        // 标签管理API
        // ===============================================
        this.get('/api/community/tags', communityGetTagsHandler);
        this.post('/api/community/tags', communityCreateTagHandler);
        this.put('/api/community/tags/:id', communityUpdateTagHandler);
        this.delete('/api/community/tags/:id', communityDeleteTagHandler);

        // ===============================================
        // 搜索源状态检查（系统级别服务）
        // ===============================================
        this.post('/api/source-status/check', sourceStatusCheckHandler);
        this.get('/api/source-status/history', sourceStatusHistoryHandler);

        // ===============================================
        // 社区搜索源相关API
        // ===============================================
        this.get('/api/community/sources', communityGetSourcesHandler);
        this.post('/api/community/sources', communityCreateSourceHandler);
        this.get('/api/community/sources/:id', communityGetSourceDetailHandler);
        this.put('/api/community/sources/:id', communityUpdateSourceHandler);
        this.delete('/api/community/sources/:id', communityDeleteSourceHandler);
        this.post('/api/community/sources/:id/download', communityDownloadSourceHandler);
        this.post('/api/community/sources/:id/like', communityLikeSourceHandler);
        this.post('/api/community/sources/:id/review', communityReviewSourceHandler);
        this.post('/api/community/sources/:id/report', communityReportSourceHandler);

        // 用户社区统计
        this.get('/api/community/user/stats', communityUserStatsHandler);
        this.get('/api/community/search', communitySearchHandler);

        // ===============================================
        // 详情提取相关API路由
        // ===============================================
        
        // 基础详情提取功能
        this.post('/api/detail/extract-single', extractSingleDetailHandler);
        this.post('/api/detail/extract-batch', extractBatchDetailsHandler);
        this.get('/api/detail/history', getDetailExtractionHistoryHandler);
        this.get('/api/detail/stats', getDetailExtractionStatsHandler);
        
        // 缓存管理
        this.get('/api/detail/cache/stats', getDetailCacheStatsHandler);
        this.delete('/api/detail/cache/clear', clearDetailCacheHandler);
        this.delete('/api/detail/cache/delete', deleteDetailCacheHandler);
        
        // 配置管理相关API路由
        this.get('/api/detail/config', getDetailExtractionConfigHandler);
        this.put('/api/detail/config', updateDetailExtractionConfigHandler);
        this.post('/api/detail/config/reset', resetDetailExtractionConfigHandler);
        this.post('/api/detail/config/preset', applyConfigPresetHandler);

        // ===============================================
        // 用户设置（已移除搜索源管理功能，现在通过独立API处理）
        // ===============================================
        this.get('/api/user/settings', userGetSettingsHandler);
        this.put('/api/user/settings', userUpdateSettingsHandler);

        // ===============================================
        // 收藏相关
        // ===============================================
        this.post('/api/user/favorites', userSyncFavoritesHandler);
        this.get('/api/user/favorites', userGetFavoritesHandler);

        // ===============================================
        // 搜索历史
        // ===============================================
        this.post('/api/user/search-history', userSaveSearchHistoryHandler);
        this.get('/api/user/search-history', userGetSearchHistoryHandler);
        this.delete('/api/user/search-history/:id', userDeleteSearchHistoryHandler);
        this.delete('/api/user/search-history', userClearSearchHistoryHandler);

        // ===============================================
        // 搜索统计
        // ===============================================
        this.get('/api/user/search-stats', userGetSearchStatsHandler);

        // ===============================================
        // 其他API
        // ===============================================
        this.post('/api/actions/record', recordActionHandler);
        this.get('/api/config', getConfigHandler);

        // ===============================================
        // 默认处理器
        // ===============================================
        this.get('/*', defaultHandler);
    }
}

// ===============================================
// 重构说明
// ===============================================
// 
// 本次重构已完成：
// 
// 1. 移除了旧的搜索源管理冗余功能：
//    - user.js 中的 customSearchSources、customSourceCategories 相关设置处理
//    - system.js 中的 getSearchSourcesHandler 函数
//    - constants.js 中的硬编码搜索源定义
// 
// 2. 新的搜索源管理架构：
//    - 独立的数据库表：search_major_categories、search_source_categories、search_sources、user_search_source_configs
//    - 独立的服务文件：search-sources-service.js
//    - 独立的处理器文件：search-sources.js
//    - 完整的RESTful API路由
// 
// 3. 功能分离清晰：
//    - 用户设置只处理个人偏好设置
//    - 搜索源管理通过专门的API处理
//    - 系统级别的状态检查保持独立
//    - 详情提取功能保持独立
// 
// 4. 向后兼容性：
//    - 保留了所有现有的非搜索源管理功能
//    - API路径清晰，便于前端调用
//    - 数据库设计支持用户个性化配置