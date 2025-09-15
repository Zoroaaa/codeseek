// src/router.js - 增强版本，添加新架构API路由和验证状态检查
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
    // 🆕 新增：验证状态检查处理器
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
    healthCheckHandler,
    sourceStatusCheckHandler,
    sourceStatusHistoryHandler,
    getSearchSourcesHandler,
    getConfigHandler,
    recordActionHandler,
    defaultHandler
} from './handlers/system.js';

// 🆕 新架构：详情提取处理器 - 集成新旧架构
import {
    // 核心详情提取API（已适配新架构）
    extractSingleDetailHandler,           // 🔄 已升级：使用模块化解析器
    extractBatchDetailsHandler,           // 🔄 已升级：使用模块化解析器
    
    // 🆕 新架构专用API
    getSupportedSitesHandler,             // 🆕 获取支持的站点信息
    validateParserHandler,                // 🆕 验证解析器状态
    getServiceStatsHandler,               // 🆕 获取服务统计信息
    reloadParserHandler,                  // 🆕 重新加载解析器
    
    // 历史记录和统计（保持兼容）
    getDetailExtractionHistoryHandler,
    getDetailExtractionStatsHandler,
    
    // 缓存管理（保持兼容）
    getDetailCacheStatsHandler,
    clearDetailCacheHandler,
    deleteDetailCacheHandler,
    
    // 配置管理（保持兼容，集成新预设功能）
    getDetailExtractionConfigHandler,
    updateDetailExtractionConfigHandler,
    resetDetailExtractionConfigHandler,
    applyConfigPresetHandler              // 🔄 已升级：支持预设配置
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

        // ===============================================
        // 🆕 新增：邮箱验证状态检查和智能发送
        // ===============================================
        
        // 检查验证状态
        this.get('/api/auth/verification-status', authCheckVerificationStatusHandler);
        this.get('/api/auth/user-verification-status', authGetUserVerificationStatusHandler);
        
        // 智能验证码发送（会先检查是否已有待验证码）
        this.post('/api/auth/smart-send-code', authSmartSendVerificationCodeHandler);

        // ===============================================
        // 邮箱验证相关路由
        // ===============================================
        
        // 注册邮箱验证
        this.post('/api/auth/send-registration-code', authSendRegistrationCodeHandler);
        
        // 邮箱更改流程
        this.post('/api/auth/request-email-change', authRequestEmailChangeHandler);
        this.post('/api/auth/send-email-change-code', authSendEmailChangeCodeHandler);
        this.post('/api/auth/verify-email-change-code', authVerifyEmailChangeCodeHandler);

        // ===============================================
        // 标签管理API
        // ===============================================
        this.get('/api/community/tags', communityGetTagsHandler);
        this.post('/api/community/tags', communityCreateTagHandler);
        this.put('/api/community/tags/:id', communityUpdateTagHandler);
        this.delete('/api/community/tags/:id', communityDeleteTagHandler);

        // ===============================================
        // 搜索源状态检查
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
        // 🔄🆕 详情提取相关API路由 - 新架构版本
        // ===============================================
        
        // 📌 核心功能API（已升级到新架构，保持向后兼容）
        this.post('/api/detail/extract-single', extractSingleDetailHandler);      // 🔄 已升级：使用模块化解析器
        this.post('/api/detail/extract-batch', extractBatchDetailsHandler);       // 🔄 已升级：使用模块化解析器
        
        // 📌 历史记录和统计（保持兼容）
        this.get('/api/detail/history', getDetailExtractionHistoryHandler);
        this.get('/api/detail/stats', getDetailExtractionStatsHandler);
        
        // 📌 缓存管理（保持兼容）
        this.get('/api/detail/cache/stats', getDetailCacheStatsHandler);
        this.delete('/api/detail/cache/clear', clearDetailCacheHandler);
        this.delete('/api/detail/cache/delete', deleteDetailCacheHandler);
        
        // 📌 配置管理（已升级，新增预设功能）
        this.get('/api/detail/config', getDetailExtractionConfigHandler);
        this.put('/api/detail/config', updateDetailExtractionConfigHandler);
        this.post('/api/detail/config/reset', resetDetailExtractionConfigHandler);
        this.post('/api/detail/config/preset', applyConfigPresetHandler);         // 🔄 已升级：支持预设配置
        
        // ===============================================
        // 🆕 新架构专用API路由 - 模块化解析器管理
        // ===============================================
        
        // 🆕 获取支持的站点信息
        // GET /api/detail/supported-sites
        // 返回所有支持的站点解析器信息，包括功能特性和状态
        this.get('/api/detail/supported-sites', getSupportedSitesHandler);
        
        // 🆕 验证解析器状态
        // GET /api/detail/validate-parser?sourceType=javbus
        // 验证指定解析器的工作状态和功能完整性
        this.get('/api/detail/validate-parser', validateParserHandler);
        
        // 🆕 获取服务统计信息
        // GET /api/detail/service-stats
        // 获取详情提取服务的运行统计和性能指标
        this.get('/api/detail/service-stats', getServiceStatsHandler);
        
        // 🆕 重新加载解析器
        // POST /api/detail/reload-parser
        // 热重载指定的解析器，用于动态更新解析规则
        this.post('/api/detail/reload-parser', reloadParserHandler);

        // ===============================================
        // 用户设置
        // ===============================================
        this.get('/api/user/settings', userGetSettingsHandler);
        this.put('/api/user/settings', userUpdateSettingsHandler);

        // ===============================================
        // 搜索源管理
        // ===============================================
        this.get('/api/search-sources', getSearchSourcesHandler);

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

/*
🔄 API 更新说明：

📌 核心API升级（保持向后兼容）：
   - extractSingleDetailHandler: 已升级使用模块化解析器，支持统一数据结构
   - extractBatchDetailsHandler: 已升级使用模块化解析器，支持并发优化
   - applyConfigPresetHandler: 新增预设配置功能

🆕 新增API端点：
   - GET /api/detail/supported-sites: 获取所有支持站点的解析器信息
   - GET /api/detail/validate-parser: 验证指定解析器的状态和功能
   - GET /api/detail/service-stats: 获取详情提取服务的统计信息
   - POST /api/detail/reload-parser: 动态重载解析器（管理员功能）

🏗️ 架构特性：
   - 模块化解析器：每个站点都有独立的解析器类
   - 统一数据结构：所有解析器返回标准化的ParsedData格式
   - 智能缓存：改进的缓存策略和管理
   - 配置预设：预定义的配置模板，便于快速设置

🔧 技术改进：
   - 更好的错误处理和重试机制
   - 改进的性能监控和统计
   - 支持动态解析器管理
   - 增强的用户配置系统

📊 监控和管理：
   - 实时解析器状态检查
   - 详细的性能指标收集
   - 缓存效率分析
   - 用户行为统计

🔒 向后兼容：
   - 所有现有API端点保持不变
   - 客户端无需修改即可使用
   - 渐进式升级支持
*/