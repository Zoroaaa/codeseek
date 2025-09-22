// src/router.js - 集成代理功能的路由器更新
import { utils } from './utils.js';

// 导入所有处理器（包括新的代理处理器）
import {
    authRegisterHandler,
    authLoginHandler,
    authVerifyTokenHandler,
    authRefreshTokenHandler,
    authChangePasswordHandler,
    authLogoutHandler,
    authDeleteAccountHandler,
    authSendRegistrationCodeHandler,
    authSendPasswordResetCodeHandler,
    authRequestEmailChangeHandler,
    authSendEmailChangeCodeHandler,
    authVerifyEmailChangeCodeHandler,
    authSendAccountDeleteCodeHandler,
    authForgotPasswordHandler,
    authResetPasswordHandler,
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

// 🆕 导入代理处理器
import {
    proxyHandler,
    proxyHealthCheckHandler,
    proxyStatsHandler
} from './handlers/proxy.js';

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

        // 🆕 特殊处理代理请求 - 必须在其他路由之前处理
        if (pathname.startsWith('/api/proxy/')) {
            console.log(`代理请求: ${pathname}`);
            return await this.executeHandler(proxyHandler, request, env);
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
        // 🆕 代理服务相关路由 - 必须在最前面定义
        // ===============================================
        
        // 代理健康检查
        this.get('/api/proxy/health', proxyHealthCheckHandler);
        
        // 代理统计信息
        this.get('/api/proxy/stats', proxyStatsHandler);
        
        // 通用代理路由 - 匹配 /api/proxy/* 的所有请求
        // 注意：这里不使用 this.get() 因为需要处理所有HTTP方法
        this.routes.set('GET:/api/proxy/*', proxyHandler);
        this.routes.set('POST:/api/proxy/*', proxyHandler);
        this.routes.set('PUT:/api/proxy/*', proxyHandler);
        this.routes.set('DELETE:/api/proxy/*', proxyHandler);

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
// 🆕 代理功能集成说明
// ===============================================
// 
// 本次更新添加了完整的代理功能：
// 
// 1. 代理路由：
//    - GET/POST/PUT/DELETE /api/proxy/* - 通用代理服务
//    - GET /api/proxy/health - 代理健康检查
//    - GET /api/proxy/stats - 代理使用统计
//
// 2. 安全特性：
//    - 域名白名单限制
//    - 垃圾域名黑名单过滤
//    - 用户访问日志记录
//    - CORS头部处理
//
// 3. 功能特性：
//    - 自动处理重定向
//    - HTML内容中链接重写
//    - 错误页面友好显示
//    - 响应头优化
//
// 4. 使用方式：
//    - 原始URL: https://javbus.com/search/MIMK-186
//    - 代理URL: https://your-domain.com/api/proxy/https%3A//javbus.com/search/MIMK-186
//
// 5. 与搜索功能集成：
//    - 搜索服务会自动将结果URL包装为代理URL
//    - 用户点击搜索结果时通过代理访问
//    - 解决区域限制和访问问题