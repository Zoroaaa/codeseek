// src/router.js - 修复代理路由问题的完整版本
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

// 导入代理处理器
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

  async handle(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    console.log(`🔍 路由请求: ${method} ${pathname}`);
    console.log(`🌍 完整URL: ${request.url}`);

    // 处理CORS预检请求
    if (method === 'OPTIONS') {
      console.log('📋 处理CORS预检请求');
      return new Response(null, {
        status: 204,
        headers: utils.getCorsHeaders(request.headers.get('Origin') || '*')
      });
    }

    // 修复：代理请求必须在所有其他路由之前处理，使用更精确的匹配
    if (pathname.startsWith('/api/proxy/')) {
      console.log(`📄 检测到代理请求路径: ${pathname}`);
      
      // 修复：特殊处理具体的代理路由（这些需要在通用代理之前）
      if (pathname === '/api/proxy/health') {
        console.log('💚 处理代理健康检查');
        return await this.executeHandler(proxyHealthCheckHandler, request, env);
      }
      
      if (pathname === '/api/proxy/stats') {
        console.log('📊 处理代理统计');
        return await this.executeHandler(proxyStatsHandler, request, env);
      }
      
      // 修复：检查是否有有效的代理目标
      const proxyPath = pathname.replace('/api/proxy/', '');
      if (proxyPath.length > 0) {
        console.log(`🌍 处理通用代理请求，目标路径: ${proxyPath}`);
        
        // 修复：验证代理路径格式
        if (this.isValidProxyPath(proxyPath)) {
          // 直接调用代理处理器，不经过路由系统
          return await this.executeHandler(proxyHandler, request, env);
        } else {
          console.error('❌ 无效的代理路径格式');
          return utils.errorResponse('无效的代理路径格式', 400);
        }
      } else {
        console.error('❌ 代理路径为空');
        return utils.errorResponse('代理目标URL不能为空', 400);
      }
    }

    // 1. 优先尝试精确匹配
    const exactKey = `${method}:${pathname}`;
    if (this.routes.has(exactKey)) {
      console.log(`✅ 精确匹配路由: ${exactKey}`);
      return await this.executeHandler(this.routes.get(exactKey), request, env);
    }

    // 2. 尝试参数路由匹配
    for (const route of this.paramRoutes) {
      if (route.method === method) {
        const match = this.matchRoute(route.pattern, pathname);
        if (match.success) {
          console.log(`🎯 参数路由匹配: ${route.path}, 参数:`, match.params);
          request.params = match.params;
          return await this.executeHandler(route.handler, request, env);
        }
      }
    }

    // 3. 最后才处理通配符路由（避免拦截API请求）
    const wildcardKey = `${method}:/*`;
    if (this.routes.has(wildcardKey)) {
      // 确保不是API路径才使用通配符路由
      if (!pathname.startsWith('/api/')) {
        console.log(`🌟 通配符路由匹配（非API路径）: ${wildcardKey}`);
        return await this.executeHandler(this.routes.get(wildcardKey), request, env);
      }
    }

    console.error(`❌ 未找到匹配的路由: ${method} ${pathname}`);
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
	
	  /**
   * 修复：验证代理路径是否有效
   */
  isValidProxyPath(proxyPath) {
    try {
      // 检查路径不为空
      if (!proxyPath || proxyPath.trim().length === 0) {
        return false;
      }

      // 尝试解码并验证URL
      let decodedPath = proxyPath;
      
      // 如果包含编码字符，尝试解码
      if (proxyPath.includes('%')) {
        try {
          decodedPath = decodeURIComponent(proxyPath);
        } catch (decodeError) {
          console.warn('代理路径解码失败，使用原始路径');
          decodedPath = proxyPath;
        }
      }

      // 确保有协议
      if (!decodedPath.startsWith('http://') && !decodedPath.startsWith('https://')) {
        decodedPath = 'https://' + decodedPath;
      }

      // 验证URL格式
      new URL(decodedPath);
      
      // 检查域名是否在允许列表中
      const urlObj = new URL(decodedPath);
      const hostname = urlObj.hostname.toLowerCase();
      
      const allowedDomains = [
        'javbus.com', 'www.javbus.com', 'javdb.com', 'www.javdb.com',
        'jable.tv', 'www.jable.tv', 'javmost.com', 'www.javmost.com',
        'javgg.net', 'www.javgg.net', 'sukebei.nyaa.si', 'jav.guru',
        'www.jav.guru', 'javlibrary.com', 'www.javlibrary.com',
        'btsow.com', 'www.btsow.com'
      ];
      
      const isDomainAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );

      if (!isDomainAllowed) {
        console.warn(`域名 ${hostname} 不在代理白名单中`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('验证代理路径失败:', error);
      return false;
    }
  }

    setupRoutes() {
        console.log('🔧 初始化路由...');
        
        // 系统健康检查
        this.get('/api/health', healthCheckHandler);
        console.log('✅ 注册路由: GET /api/health');

        // ===============================================
        // 🚨 关键：代理路由只注册具体的路径，通用代理在handle方法中直接处理
        // ===============================================
        
        // 代理服务健康检查 - 具体路径优先
        this.get('/api/proxy/health', proxyHealthCheckHandler);
        console.log('✅ 注册路由: GET /api/proxy/health');
        
        // 代理服务统计
        this.get('/api/proxy/stats', proxyStatsHandler);
        console.log('✅ 注册路由: GET /api/proxy/stats');
        
        // 注意：不再注册 /api/proxy/* 通配符路由，在 handle 方法中直接处理

        // ===============================================
        // 认证相关路由
        // ===============================================
        this.post('/api/auth/register', authRegisterHandler);
        this.post('/api/auth/login', authLoginHandler);
        this.post('/api/auth/verify-token', authVerifyTokenHandler);
        this.post('/api/auth/refresh', authRefreshTokenHandler);
        this.post('/api/auth/logout', authLogoutHandler);
        
        // 密码管理
        this.put('/api/auth/change-password', authChangePasswordHandler);
        this.post('/api/auth/send-password-reset-code', authSendPasswordResetCodeHandler);
        this.post('/api/auth/forgot-password', authForgotPasswordHandler);
        this.post('/api/auth/reset-password', authResetPasswordHandler);
        
        // 账户删除
        this.post('/api/auth/delete-account', authDeleteAccountHandler);
        this.post('/api/auth/send-account-delete-code', authSendAccountDeleteCodeHandler);

        // 邮箱验证
        this.get('/api/auth/verification-status', authCheckVerificationStatusHandler);
        this.get('/api/auth/user-verification-status', authGetUserVerificationStatusHandler);
        this.post('/api/auth/smart-send-code', authSmartSendVerificationCodeHandler);
        this.post('/api/auth/send-registration-code', authSendRegistrationCodeHandler);
        this.post('/api/auth/request-email-change', authRequestEmailChangeHandler);
        this.post('/api/auth/send-email-change-code', authSendEmailChangeCodeHandler);
        this.post('/api/auth/verify-email-change-code', authVerifyEmailChangeCodeHandler);

        // ===============================================
        // 搜索源管理API
        // ===============================================
        this.get('/api/search-sources/major-categories', getMajorCategoriesHandler);
        this.post('/api/search-sources/major-categories', createMajorCategoryHandler);
        this.get('/api/search-sources/categories', getSourceCategoriesHandler);
        this.post('/api/search-sources/categories', createSourceCategoryHandler);
        this.put('/api/search-sources/categories/:id', updateSourceCategoryHandler);
        this.delete('/api/search-sources/categories/:id', deleteSourceCategoryHandler);
        this.get('/api/search-sources/sources', getSearchSourcesHandler);
        this.post('/api/search-sources/sources', createSearchSourceHandler);
        this.put('/api/search-sources/sources/:id', updateSearchSourceHandler);
        this.delete('/api/search-sources/sources/:id', deleteSearchSourceHandler);
        this.get('/api/search-sources/user-configs', getUserSourceConfigsHandler);
        this.post('/api/search-sources/user-configs', updateUserSourceConfigHandler);
        this.post('/api/search-sources/user-configs/batch', batchUpdateUserSourceConfigsHandler);
        this.get('/api/search-sources/stats', getSearchSourceStatsHandler);
        this.get('/api/search-sources/export', exportUserSearchSourcesHandler);

        // ===============================================
        // 社区相关API
        // ===============================================
        this.get('/api/community/tags', communityGetTagsHandler);
        this.post('/api/community/tags', communityCreateTagHandler);
        this.put('/api/community/tags/:id', communityUpdateTagHandler);
        this.delete('/api/community/tags/:id', communityDeleteTagHandler);
        this.post('/api/source-status/check', sourceStatusCheckHandler);
        this.get('/api/source-status/history', sourceStatusHistoryHandler);
        this.get('/api/community/sources', communityGetSourcesHandler);
        this.post('/api/community/sources', communityCreateSourceHandler);
        this.get('/api/community/sources/:id', communityGetSourceDetailHandler);
        this.put('/api/community/sources/:id', communityUpdateSourceHandler);
        this.delete('/api/community/sources/:id', communityDeleteSourceHandler);
        this.post('/api/community/sources/:id/download', communityDownloadSourceHandler);
        this.post('/api/community/sources/:id/like', communityLikeSourceHandler);
        this.post('/api/community/sources/:id/review', communityReviewSourceHandler);
        this.post('/api/community/sources/:id/report', communityReportSourceHandler);
        this.get('/api/community/user/stats', communityUserStatsHandler);
        this.get('/api/community/search', communitySearchHandler);

        // ===============================================
        // 详情提取相关API
        // ===============================================
        this.post('/api/detail/extract-single', extractSingleDetailHandler);
        this.post('/api/detail/extract-batch', extractBatchDetailsHandler);
        this.get('/api/detail/history', getDetailExtractionHistoryHandler);
        this.get('/api/detail/stats', getDetailExtractionStatsHandler);
        this.get('/api/detail/cache/stats', getDetailCacheStatsHandler);
        this.delete('/api/detail/cache/clear', clearDetailCacheHandler);
        this.delete('/api/detail/cache/delete', deleteDetailCacheHandler);
        this.get('/api/detail/config', getDetailExtractionConfigHandler);
        this.put('/api/detail/config', updateDetailExtractionConfigHandler);
        this.post('/api/detail/config/reset', resetDetailExtractionConfigHandler);
        this.post('/api/detail/config/preset', applyConfigPresetHandler);

        // ===============================================
        // 用户相关API
        // ===============================================
        this.get('/api/user/settings', userGetSettingsHandler);
        this.put('/api/user/settings', userUpdateSettingsHandler);
        this.post('/api/user/favorites', userSyncFavoritesHandler);
        this.get('/api/user/favorites', userGetFavoritesHandler);
        this.post('/api/user/search-history', userSaveSearchHistoryHandler);
        this.get('/api/user/search-history', userGetSearchHistoryHandler);
        this.delete('/api/user/search-history/:id', userDeleteSearchHistoryHandler);
        this.delete('/api/user/search-history', userClearSearchHistoryHandler);
        this.get('/api/user/search-stats', userGetSearchStatsHandler);

        // ===============================================
        // 其他API
        // ===============================================
        this.post('/api/actions/record', recordActionHandler);
        this.get('/api/config', getConfigHandler);

        // ===============================================
        // 🚨 默认处理器放在最后，只处理非API路径
        // ===============================================
        this.get('/*', defaultHandler);
        console.log('✅ 注册默认路由: GET /* (仅限非API路径)');
        
        console.log(`🎯 路由注册完成，共注册 ${this.routes.size} 个精确路由，${this.paramRoutes.length} 个参数路由`);
    }
}