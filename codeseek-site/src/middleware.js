/**
 * 中间件集合 - 处理通用功能
 */

import { CONFIG } from './config.js';

/**
 * CORS中间件 - 处理跨域请求
 */
export async function corsMiddleware(request, env, ctx) {
  // 在响应中添加CORS头
  request.corsHeaders = {
    'Access-Control-Allow-Origin': CONFIG.CORS.ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': CONFIG.CORS.ALLOW_METHODS,
    'Access-Control-Allow-Headers': CONFIG.CORS.ALLOW_HEADERS,
    'Access-Control-Allow-Credentials': CONFIG.CORS.ALLOW_CREDENTIALS,
    'Access-Control-Max-Age': CONFIG.CORS.MAX_AGE,
    'Access-Control-Expose-Headers': CONFIG.CORS.EXPOSE_HEADERS
  };
  
  return null; // 继续处理
}

/**
 * 日志中间件 - 记录请求日志
 */
export async function loggingMiddleware(request, env, ctx) {
  const startTime = Date.now();
  const url = new URL(request.url);
  
  if (CONFIG.DEBUG) {
    console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - Start`);
  }
  
  // 在请求对象上添加计时信息
  request.startTime = startTime;
  
  return null; // 继续处理
}

/**
 * 错误处理中间件 - 统一错误处理
 */
export async function errorMiddleware(request, env, ctx) {
  // 这个中间件主要用于设置错误处理上下文
  // 实际的错误处理在Router中进行
  return null; // 继续处理
}

/**
 * 安全中间件 - 基础安全检查
 */
export async function securityMiddleware(request, env, ctx) {
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
        ...request.corsHeaders
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
        ...request.corsHeaders
      }
    });
  }
  
  // 检查恶意路径
  const maliciousPaths = [
    '../', '../', '..\/', '..\\',
    '/etc/', '/proc/', '/sys/',
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
          ...request.corsHeaders
        }
      });
    }
  }
  
  return null; // 继续处理
}

/**
 * 缓存中间件 - 处理缓存相关逻辑
 */
export async function cacheMiddleware(request, env, ctx) {
  const url = new URL(request.url);
  
  // 生成缓存键
  const cacheKey = `proxy_cache_${url.pathname}_${url.search}`;
  request.cacheKey = cacheKey;
  
  // 为GET请求检查缓存
  if (request.method === 'GET') {
    try {
      const cached = await caches.default.match(request);
      if (cached) {
        const cacheStatus = cached.headers.get('x-cache-status') || 'unknown';
        
        if (CONFIG.DEBUG) {
          console.log(`Cache HIT for ${url.pathname} (${cacheStatus})`);
        }
        
        // 添加缓存命中标记
        const response = new Response(cached.body, {
          status: cached.status,
          statusText: cached.statusText,
          headers: {
            ...cached.headers,
            'X-Cache-Status': 'HIT',
            'X-Cache-Date': new Date().toISOString(),
            ...request.corsHeaders
          }
        });
        
        return response;
      }
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Cache check error:', error);
      }
    }
  }
  
  return null; // 继续处理
}

/**
 * 速率限制中间件 - 防止滥用
 */
export async function rateLimitMiddleware(request, env, ctx) {
  const clientIP = request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for') || 
                   'unknown';
  
  const rateLimitKey = `rate_limit_${clientIP}`;
  const timeWindow = 60; // 1分钟
  const maxRequests = 120; // 每分钟最多120个请求
  
  try {
    // 使用KV存储来跟踪速率限制（如果可用）
    if (env && env.RATE_LIMIT_KV) {
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
            ...request.corsHeaders
          }
        });
      }
      
      // 更新计数
      await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), {
        expirationTtl: timeWindow
      });
      
      // 添加速率限制头
      request.rateLimitHeaders = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - count - 1).toString(),
        'X-RateLimit-Reset': (Date.now() + timeWindow * 1000).toString()
      };
    }
  } catch (error) {
    if (CONFIG.DEBUG) {
      console.warn('Rate limit check error:', error);
    }
  }
  
  return null; // 继续处理
}

/**
 * 代理目标验证中间件 - 验证代理目标的有效性
 */
export async function proxyTargetValidationMiddleware(request, env, ctx) {
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
          ...request.corsHeaders
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
          ...request.corsHeaders
        }
      });
    }
    
    // 保存目标主机名到请求对象
    request.proxyTarget = targetHostname;
  }
  
  return null; // 继续处理
}

/**
 * 响应增强中间件 - 为响应添加额外的头信息
 */
export function enhanceResponse(response, request) {
  if (!response) return response;
  
  const headers = new Headers(response.headers);
  
  // 添加CORS头
  if (request.corsHeaders) {
    Object.entries(request.corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }
  
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
  headers.set('X-Proxy-By', 'Enhanced-Proxy-Worker-v4.0.0');
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