// src/middleware.js - 简化版中间件，参照可工作版本结构
import { CONFIG } from './config.js';

/**
 * CORS中间件 - 处理跨域请求
 */
export async function corsMiddleware(request) {
    // 直接在请求时添加CORS头，不修改请求对象
    return null; // 继续处理
}

/**
 * 安全检查中间件
 */
export async function securityMiddleware(request) {
    const url = new URL(request.url);
    
    // 检查请求大小
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > CONFIG.SECURITY.MAX_CONTENT_SIZE) {
        return new Response(JSON.stringify({
            error: 'Request too large',
            maxSize: CONFIG.SECURITY.MAX_CONTENT_SIZE
        }), {
            status: 413,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 检查URL长度
    if (url.href.length > 8192) { // 8KB URL limit
        return new Response(JSON.stringify({
            error: 'URL too long',
            maxLength: 8192
        }), {
            status: 414,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 检查恶意路径
    const maliciousPaths = [
        '../', '..\\', '/etc/', '/proc/', '/sys/',
        'javascript:', 'vbscript:', 'data:text/html',
        '<script', '</script>', 'eval(', 'alert('
    ];
    
    const decodedPath = decodeURIComponent(url.pathname + url.search);
    for (const maliciousPath of maliciousPaths) {
        if (decodedPath.toLowerCase().includes(maliciousPath)) {
            return new Response(JSON.stringify({
                error: 'Malicious request detected',
                path: 'blocked'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
    
    return null; // 继续处理
}

/**
 * 代理目标验证中间件
 */
export async function validateProxyTarget(request) {
    const url = new URL(request.url);
    
    // 只对代理路径进行验证
    if (url.pathname.startsWith('/proxy/')) {
        const pathParts = url.pathname.substring(7).split('/');
        const targetHostname = pathParts[0];
        
        if (!targetHostname) {
            return new Response(JSON.stringify({
                error: 'Invalid proxy URL: missing hostname'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        if (!CONFIG.isValidProxyTarget(targetHostname)) {
            return new Response(JSON.stringify({
                error: 'Forbidden proxy target',
                hostname: targetHostname,
                allowedTargets: CONFIG.ALLOWED_TARGETS.length
            }), {
                status: 403,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        // 简单地添加目标主机名到请求对象（不使用Proxy包装）
        request.proxyTarget = targetHostname;
    }
    
    return null; // 继续处理
}

/**
 * 日志中间件 - 记录请求日志
 */
export async function loggingMiddleware(request) {
    const startTime = Date.now();
    const url = new URL(request.url);
    
    if (CONFIG.DEBUG) {
        console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - Start`);
    }
    
    // 简单地添加计时信息到请求对象
    request.startTime = startTime;
    
    return null; // 继续处理
}

/**
 * 速率限制中间件 - 防止滥用（简化版本）
 */
export async function rateLimitMiddleware(request, env) {
    // 如果没有KV存储，跳过速率限制
    if (!env || !env.RATE_LIMIT_KV) {
        return null;
    }
    
    const clientIP = request.headers.get('cf-connecting-ip') || 
                     request.headers.get('x-forwarded-for') || 
                     'unknown';
    
    const rateLimitKey = `rate_limit_${clientIP}`;
    const timeWindow = 60; // 1分钟
    const maxRequests = 120; // 每分钟最多120个请求
    
    try {
        const current = await env.RATE_LIMIT_KV.get(rateLimitKey);
        const count = current ? parseInt(current) : 0;
        
        if (count >= maxRequests) {
            return new Response(JSON.stringify({
                error: 'Rate limit exceeded',
                limit: maxRequests,
                window: timeWindow,
                retryAfter: 60
            }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'Retry-After': '60',
                    'X-RateLimit-Limit': maxRequests.toString(),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset': (Date.now() + timeWindow * 1000).toString(),
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        
        // 更新计数
        await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), {
            expirationTtl: timeWindow
        });
        
        // 简单地添加速率限制头信息到请求对象
        request.rateLimitHeaders = {
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': (maxRequests - count - 1).toString(),
            'X-RateLimit-Reset': (Date.now() + timeWindow * 1000).toString()
        };
        
    } catch (error) {
        if (CONFIG.DEBUG) {
            console.warn('Rate limit check error:', error);
        }
    }
    
    return null; // 继续处理
}

/**
 * 执行所有中间件
 */
export async function runMiddlewares(request, env) {
    const middlewares = [
        corsMiddleware,
        loggingMiddleware,
        securityMiddleware,
        validateProxyTarget,
        rateLimitMiddleware
    ];
    
    for (const middleware of middlewares) {
        try {
            const result = await middleware(request, env);
            if (result instanceof Response) {
                return result; // 中间件返回响应，终止处理
            }
        } catch (error) {
            console.error('中间件执行错误:', error);
            return new Response(JSON.stringify({
                error: 'Middleware processing error',
                message: CONFIG.DEBUG ? error.message : 'Internal server error'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
    
    return null; // 所有中间件都通过
}

/**
 * 为响应添加通用头信息
 */
export function enhanceResponse(response, request) {
    if (!response || !(response instanceof Response)) {
        return response;
    }
    
    const headers = new Headers(response.headers);
    
    // 添加CORS头
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', '*');
    headers.set('Access-Control-Allow-Headers', '*');
    headers.set('Access-Control-Max-Age', '86400');
    
    // 添加速率限制头
    if (request.rateLimitHeaders) {
        Object.entries(request.rateLimitHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });
    }
    
    // 添加安全头
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // 添加代理标识头
    headers.set('X-Proxy-By', `Enhanced-Proxy-Worker-v${CONFIG.VERSION}`);
    headers.set('X-Proxy-Time', new Date().toISOString());
    
    // 计算处理时间
    if (request.startTime) {
        const processingTime = Date.now() - request.startTime;
        headers.set('X-Processing-Time', `${processingTime}ms`);
        
        if (CONFIG.DEBUG) {
            console.log(`Request processed in ${processingTime}ms`);
        }
    }
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}