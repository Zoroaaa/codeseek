// Enhanced Proxy Worker v2.0.0 - Main Entry Point
// 最小修改版本 - 只修复关键问题

import { ProxyHandler } from './proxy.js';
import { CacheManager } from './cache.js';
import { CONFIG } from './config.js';
import { getUnrestrictedCorsHeaders } from './utils.js';

/**
 * Main request handler for Cloudflare Worker
 * Routes requests to appropriate handlers
 */
async function handleRequest(request, env = {}) {
  const url = new URL(request.url);
  
  // 修复：使用 globalThis 替代 global
  globalThis.thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  globalThis.thisProxyServerUrl_hostOnly = url.host;

  // Create cache manager
  const cacheManager = env.KV_CACHE ? new CacheManager(env.KV_CACHE, env) : null;
  
  // Create proxy handler
  const proxyHandler = new ProxyHandler(env, cacheManager);

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { 
      headers: getUnrestrictedCorsHeaders(),
      status: 204
    });
  }

  // API Routes
  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(url, request, env, cacheManager);
  }

  // Check cache for GET requests
  if (request.method === 'GET' && cacheManager) {
    const cacheKey = cacheManager.generateCacheKey(
      request.url,
      request.method,
      Object.fromEntries(request.headers.entries())
    );

    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
          'X-Enhanced-Proxy': CONFIG.VERSION,
          ...getUnrestrictedCorsHeaders()
        }
      });
      return response;
    }
  }

  // Handle proxy request
  const originalResponse = await proxyHandler.handleRequest(request);

  // Add CORS headers to response
  const newHeaders = new Headers(originalResponse.headers);
  Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Create final response
  const finalResponse = new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: newHeaders
  });

  // Async cache for successful GET requests
  if (request.method === 'GET' && cacheManager && 
      originalResponse.status >= 200 && originalResponse.status < 300) {
    const responseForCache = finalResponse.clone();
    const cacheKey = cacheManager.generateCacheKey(
      request.url,
      request.method,
      Object.fromEntries(request.headers.entries())
    );
    
    cacheManager.set(cacheKey, responseForCache).catch(err => {
      console.error('Failed to cache response:', err);
    });
  }

  return finalResponse;
}

/**
 * Handle API requests
 */
async function handleApiRequest(url, request, env, cacheManager) {
  const headers = {
    'Content-Type': 'application/json',
    ...getUnrestrictedCorsHeaders()
  };

  // Health check endpoint
  if (url.pathname === '/api/health' || url.pathname === '/_health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION,
      globals: {
        // 检查全局变量是否设置正确
        https: globalThis.thisProxyServerUrlHttps || 'NOT_SET',
        host: globalThis.thisProxyServerUrl_hostOnly || 'NOT_SET'
      },
      features: {
        enhancedProxyMode: true,
        originalFunctionality: true,
        kvCache: !!env.KV_CACHE,
        corsSupport: true,
        passwordProtection: !!(env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD),
        proxyHint: true
      }
    }), { headers });
  }

  // Status endpoint
  if (url.pathname === '/api/status') {
    return new Response(JSON.stringify({
      status: 'active',
      proxyMode: 'enhanced-original',
      timestamp: Date.now(),
      version: CONFIG.VERSION,
      cors: 'unrestricted',
      caching: !!env.KV_CACHE,
      passwordProtected: !!(env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD),
      hintEnabled: true
    }), { headers });
  }

  // Cache management endpoint
  if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
    if (cacheManager) {
      try {
        const { pattern } = await request.json().catch(() => ({}));
        await cacheManager.clearPattern(pattern || CONFIG.CACHE_PREFIX);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'Cache cleared successfully'
        }), { headers });
      } catch (error) {
        return new Response(JSON.stringify({
          error: 'Cache clear failed',
          message: error.message
        }), {
          status: 500,
          headers
        });
      }
    } else {
      return new Response(JSON.stringify({
        error: 'Cache not configured'
      }), {
        status: 400,
        headers
      });
    }
  }

  // API not found
  return new Response(JSON.stringify({
    error: 'API endpoint not found'
  }), {
    status: 404,
    headers
  });
}

/**
 * Cloudflare Worker fetch event handler
 */
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Enhanced Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Proxy service error',
        message: env && env.DEBUG === 'true' ? error.message : 'Internal server error',
        stack: env && env.DEBUG === 'true' ? error.stack : undefined,
        version: CONFIG.VERSION,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getUnrestrictedCorsHeaders()
        }
      });
    }
  }
};