// src/router.js - 基于可工作版本的代理项目改造
import { CONFIG } from './config.js';

// 简化的工具类
const utils = {
    getCorsHeaders(origin = '*') {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
        };
    },

    successResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                'Content-Type': 'application/json',
                ...this.getCorsHeaders()
            }
        });
    },

    errorResponse(message, status = 500) {
        return new Response(JSON.stringify({
            error: message,
            timestamp: new Date().toISOString()
        }), {
            status,
            headers: {
                'Content-Type': 'application/json',
                ...this.getCorsHeaders()
            }
        });
    }
};

export class Router {
    constructor() {
        this.routes = new Map();
        this.paramRoutes = [];
        this.setupRoutes();
    }

    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
        
        if (path.includes(':') || path.includes('*')) {
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
    all(path, handler) { 
        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].forEach(method => {
            this.addRoute(method, path, handler);
        });
    }

    createPattern(path) {
        const parts = path.split('/');
        return {
            parts,
            paramNames: parts.filter(part => part.startsWith(':')).map(part => part.substring(1)),
            hasWildcard: path.includes('*')
        };
    }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        console.log(`[${new Date().toISOString()}] ${method} ${pathname}`);

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
            if (route.method === method || route.method === '*') {
                const match = this.matchRoute(route.pattern, pathname);
                if (match.success) {
                    console.log(`参数路由匹配: ${route.path}, 参数:`, match.params);
                    // 简单地添加 params 属性，不使用 Proxy
                    request.params = match.params;
                    request.parsedUrl = url;
                    return await this.executeHandler(route.handler, request, env);
                }
            }
        }

        console.error(`未找到匹配的路由: ${method} ${pathname}`);
        return utils.errorResponse(`API路径不存在: ${pathname}`, 404);
    }

    matchRoute(pattern, pathname) {
        const requestParts = pathname.split('/');
        const routeParts = pattern.parts;

        // 处理通配符路由
        if (pattern.hasWildcard) {
            const nonWildcardParts = routeParts.filter(part => part !== '*');
            const minLength = nonWildcardParts.length;
            
            if (requestParts.length < minLength) {
                return { success: false, params: {} };
            }

            const params = {};
            let routeIndex = 0;
            let requestIndex = 0;

            while (routeIndex < routeParts.length && requestIndex < requestParts.length) {
                const routePart = routeParts[routeIndex];
                
                if (routePart === '*') {
                    // 通配符匹配剩余路径
                    params.wildcard = requestParts.slice(requestIndex).join('/');
                    return { success: true, params };
                } else if (routePart.startsWith(':')) {
                    // 参数匹配
                    const paramName = routePart.substring(1);
                    params[paramName] = decodeURIComponent(requestParts[requestIndex]);
                    requestIndex++;
                } else if (routePart === requestParts[requestIndex]) {
                    // 精确匹配
                    requestIndex++;
                } else {
                    return { success: false, params: {} };
                }
                routeIndex++;
            }

            return { success: routeIndex === routeParts.length, params };
        }

        // 常规路由匹配
        if (requestParts.length !== routeParts.length) {
            return { success: false, params: {} };
        }

        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];

            if (routePart.startsWith(':')) {
                const paramName = routePart.substring(1);
                params[paramName] = decodeURIComponent(requestPart);
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
                    if (!result.headers.has(key)) {
                        result.headers.set(key, value);
                    }
                });
                
                // 添加处理时间头
                if (request.startTime) {
                    const processingTime = Date.now() - request.startTime;
                    result.headers.set('X-Processing-Time', `${processingTime}ms`);
                }
            }
            return result;
        } catch (error) {
            console.error('路由处理器错误:', error);
            console.error('错误堆栈:', error.stack);
            return utils.errorResponse(
                CONFIG.DEBUG ? error.message : '内部服务器错误', 
                500
            );
        }
    }

    setupRoutes() {
        // API 路由 - 健康检查
        this.get('/api/health', this.healthCheckHandler);
        this.get('/api/status', this.statusCheckHandler);
        this.get('/api/proxy/stats', this.proxyStatsHandler);
        this.get('/api/cache/stats', this.cacheStatsHandler);
        this.post('/api/cache/clear', this.clearCacheHandler);

        // 静态资源
        this.get('/favicon.ico', this.faviconHandler);
        this.get('/robots.txt', this.robotsHandler);
        this.get('/sitemap.xml', this.sitemapHandler);

        // 代理路由
        this.all('/proxy/:hostname/*', this.proxyHandler);
        this.all('/proxy/:hostname', this.proxyHandler);
        
        // 默认首页和通配符路由
        this.get('/', this.indexHandler);
        this.all('/*', this.legacyProxyHandler);
    }

    // ========== 处理器方法 ==========

    async healthCheckHandler(request, env) {
        return utils.successResponse({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: CONFIG.VERSION,
            environment: CONFIG.ENVIRONMENT,
            features: {
                htmlProcessing: true,
                cssProcessing: true,
                jsProcessing: true,
                smartCaching: true,
                resourceOptimization: true,
                unrestrictedCors: true,
                redirectHandling: true,
                securityFiltering: true,
                magnetLinks: true,
                downloadLinks: true
            },
            limits: {
                maxRedirects: CONFIG.MAX_REDIRECTS,
                requestTimeout: CONFIG.REQUEST_TIMEOUT,
                maxContentSize: CONFIG.SECURITY.MAX_CONTENT_SIZE
            }
        });
    }

    async statusCheckHandler(request, env) {
        return utils.successResponse({
            status: 'enabled',
            endpoints: CONFIG.ALLOWED_TARGETS.length,
            timestamp: Date.now(),
            version: CONFIG.VERSION,
            cors: 'unrestricted',
            proxy: {
                targets: CONFIG.ALLOWED_TARGETS.length,
                failover: CONFIG.ENABLE_FAILOVER,
                backupDomains: CONFIG.BACKUP_DOMAINS.length,
                maxRedirects: CONFIG.MAX_REDIRECTS
            },
            security: {
                maliciousBlocking: CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS,
                htmlSanitization: CONFIG.SECURITY.SANITIZE_HTML,
                adBlocking: CONFIG.SECURITY.BLOCK_ADS
            }
        });
    }

    async proxyStatsHandler(request, env) {
        return utils.successResponse({
            proxy: {
                version: CONFIG.VERSION,
                allowedTargets: CONFIG.ALLOWED_TARGETS.length,
                specialHandling: CONFIG.SPECIAL_HANDLING,
                uptime: Date.now(),
                features: [
                    'URL Rewriting',
                    'Content Processing',
                    'Redirect Handling',
                    'Cache Management',
                    'Security Filtering',
                    'Magnet Link Support',
                    'Download Link Support',
                    'WebSocket Support'
                ]
            },
            timestamp: new Date().toISOString()
        });
    }

    async cacheStatsHandler(request, env) {
        return utils.successResponse({
            cache: {
                status: 'simplified',
                note: 'Cache operations simplified for stability'
            },
            settings: CONFIG.CACHE_SETTINGS,
            timestamp: new Date().toISOString()
        });
    }

    async clearCacheHandler(request, env) {
        try {
            const cacheNames = await caches.keys();
            let cleared = 0;
            
            for (const cacheName of cacheNames) {
                try {
                    await caches.delete(cacheName);
                    cleared++;
                } catch (cacheError) {
                    console.warn('Failed to delete cache:', cacheName, cacheError);
                }
            }
            
            return utils.successResponse({
                message: 'Cache cleared successfully',
                clearedCaches: cleared,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            return utils.errorResponse('Failed to clear cache: ' + error.message);
        }
    }

    async faviconHandler(request, env) {
        const faviconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="#4CAF50" stroke="#2E7D32" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">P</text>
        </svg>`;
        
        return new Response(faviconSVG, {
            headers: {
                'Content-Type': 'image/svg+xml',
                'Cache-Control': 'public, max-age=86400',
                ...utils.getCorsHeaders()
            }
        });
    }

    async robotsHandler(request, env) {
        const robotsTxt = `User-agent: *
Allow: /

# Proxy service for educational purposes
# Version: ${CONFIG.VERSION}

Sitemap: ${new URL(request.url).origin}/sitemap.xml`;

        return new Response(robotsTxt, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'public, max-age=3600',
                ...utils.getCorsHeaders()
            }
        });
    }

    async sitemapHandler(request, env) {
        const baseURL = new URL(request.url).origin;
        
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
        <loc>${baseURL}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
    </url>
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600',
                ...utils.getCorsHeaders()
            }
        });
    }

    async indexHandler(request, env) {
        const baseURL = new URL(request.url).origin;
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Proxy Service v${CONFIG.VERSION}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto; margin: 0; padding: 2rem; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 0.5rem; }
        .status { background: #e8f5e8; border: 1px solid #4CAF50; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
        .endpoint { font-family: monospace; background: #333; color: #fff; padding: 0.5rem; border-radius: 4px; display: inline-block; margin: 0.5rem 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0; }
        .card { background: #f9f9f9; padding: 1rem; border-radius: 4px; border: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Enhanced Proxy Service v${CONFIG.VERSION}</h1>
        
        <div class="status">
            <strong>✅ Service Active</strong> - Proxy service is running and ready to handle requests.
        </div>
        
        <h2>Usage</h2>
        <p>Use the proxy by accessing:</p>
        <code class="endpoint">${baseURL}/proxy/HOSTNAME/PATH</code>
        <p><strong>Example:</strong></p>
        <code class="endpoint">${baseURL}/proxy/example.com/page.html</code>
        
        <h2>API Endpoints</h2>
        <div class="grid">
            <div class="card">
                <h3><a href="/api/health">/api/health</a></h3>
                <p>Health check and feature list</p>
            </div>
            <div class="card">
                <h3><a href="/api/status">/api/status</a></h3>
                <p>Service status and statistics</p>
            </div>
            <div class="card">
                <h3><a href="/api/proxy/stats">/api/proxy/stats</a></h3>
                <p>Proxy statistics</p>
            </div>
            <div class="card">
                <h3><a href="/api/cache/stats">/api/cache/stats</a></h3>
                <p>Cache performance metrics</p>
            </div>
        </div>
        
        <footer style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; color: #666; text-align: center;">
            <p>Enhanced Proxy Service v${CONFIG.VERSION} | Built for better web access</p>
        </footer>
    </div>
</body>
</html>`;

        return new Response(html, {
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=300',
                ...utils.getCorsHeaders()
            }
        });
    }

    async proxyHandler(request, env) {
        // 这里需要实现实际的代理逻辑
        const hostname = request.params.hostname;
        const path = request.params.wildcard || '';

        if (!hostname) {
            return utils.errorResponse('Missing hostname parameter', 400);
        }

        if (!CONFIG.isValidProxyTarget(hostname)) {
            return utils.errorResponse(`Forbidden proxy target: ${hostname}`, 403);
        }

        // 临时返回，实际代理逻辑需要另外实现
        return utils.successResponse({
            message: 'Proxy handler called',
            hostname: hostname,
            path: path,
            method: request.method,
            note: 'Proxy logic to be implemented'
        });
    }

    async legacyProxyHandler(request, env) {
        // 兼容旧版本的直接路径代理
        const url = new URL(request.url);
        const path = url.pathname.substring(1); // 移除开头的 /

        if (path && path.includes('.')) {
            // 可能是传统的直接代理格式
            return utils.successResponse({
                message: 'Legacy proxy format detected',
                path: path,
                note: 'Please use /proxy/hostname/path format'
            });
        }

        return utils.errorResponse('Invalid proxy request format', 400);
    }
}