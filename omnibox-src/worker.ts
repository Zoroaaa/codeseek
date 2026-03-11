// OmniBox 代理 Worker v1.0.0 - 主入口
// 通用网络代理服务

import { ProxyHandler } from './proxy.js';
import { CacheManager } from './cache.js';
import { CONFIG, type EnvVariables } from './config.js';
import { getUnrestrictedCorsHeaders, generateRequestId, Logger, getHTMLResponse, createJsonHeaders, constantTimeEqual } from './utils.js';
import { getErrorPageTemplate } from './templates.js';

declare global {
  var thisProxyServerUrlHttps: string;
  var thisProxyServerUrl_hostOnly: string;
}

interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
  service: string;
  globals: {
    https: string;
    host: string;
  };
  features: {
    enhancedProxyMode: boolean;
    originalFunctionality: boolean;
    kvCache: boolean;
    corsSupport: boolean;
    passwordProtection: boolean;
    proxyHint: boolean;
  };
}

interface StatusResponse {
  status: string;
  proxyMode: string;
  timestamp: number;
  version: string;
  cors: string;
  caching: boolean;
  passwordProtected: boolean;
  hintEnabled: boolean;
}

interface CacheClearResponse {
  success?: boolean;
  message?: string;
  error?: string;
}

async function getCacheKey(cacheManager: CacheManager, request: Request): Promise<string> {
  // 只传入影响内容变体的 header（accept-language），避免 Cookie/Authorization 等敏感头进入 key
  const relevantHeaders: Record<string, string> = {};
  const lang = request.headers.get('accept-language');
  if (lang) relevantHeaders['accept-language'] = lang;

  return cacheManager.generateCacheKey(
    request.url,
    request.method,
    relevantHeaders
  );
}

async function handleRequest(request: Request, env: EnvVariables): Promise<Response> {
  const logger = Logger.create('Worker', env);
  const requestId = generateRequestId();
  logger.setRequestId(requestId);

  const url = new URL(request.url);

  (globalThis as any).thisProxyServerUrlHttps = `${url.protocol}//${url.hostname}/`;
  (globalThis as any).thisProxyServerUrl_hostOnly = url.host;

  const cacheManager = env.KV_CACHE ? new CacheManager(env.KV_CACHE, env) : null;

  const proxyHandler = new ProxyHandler(env, cacheManager);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: getUnrestrictedCorsHeaders(),
      status: 204
    });
  }

  if (url.pathname.startsWith('/api/')) {
    return handleApiRequest(url, request, env, cacheManager);
  }

  if (request.method === 'GET' && cacheManager) {
    const cacheKey = await getCacheKey(cacheManager, request);

    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      const response = new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
          'X-OmniBox-Proxy': CONFIG.VERSION,
          'X-Request-Id': requestId,
          ...getUnrestrictedCorsHeaders()
        }
      });
      logger.debug('Cache hit', { cacheKey });
      return response;
    }

    const originalResponse = await proxyHandler.handleRequest(request);

    const newHeaders = new Headers(originalResponse.headers);
    Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });
    newHeaders.set('X-Request-Id', requestId);

    const finalResponse = new Response(originalResponse.body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: newHeaders
    });

    if (originalResponse.status >= 200 && originalResponse.status < 300) {
      const responseForCache = finalResponse.clone();
      cacheManager.set(cacheKey, responseForCache).catch(err => {
        logger.error('Failed to cache response', { cacheKey, error: String(err) });
      });
    }

    return finalResponse;
  }

  const originalResponse = await proxyHandler.handleRequest(request);

  const newHeaders = new Headers(originalResponse.headers);
  Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  newHeaders.set('X-Request-Id', requestId);

  const finalResponse = new Response(originalResponse.body, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: newHeaders
  });

  return finalResponse;
}

async function handleApiRequest(
  url: URL,
  request: Request,
  env: EnvVariables,
  cacheManager: CacheManager | null
): Promise<Response> {
  const headers = createJsonHeaders();

  // 写操作（POST）需要鉴权：使用 PROXY_PASSWORD 作为 Bearer Token
  // GET 类读接口（health/status/stats）保持公开，便于监控系统访问
  const isMutationEndpoint = request.method === 'POST' &&
    (url.pathname === '/api/cache/clear' || url.pathname === '/api/cache/preload');

  if (isMutationEndpoint) {
    const expectedPassword = env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD;
    if (expectedPassword) {
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      // 使用常量时间比较防止时序攻击
      if (!constantTimeEqual(token, expectedPassword)) {
        return new Response(JSON.stringify({ error: 'Unauthorized', message: '需要有效的 Authorization: Bearer <password> 头' }), {
          status: 401,
          headers
        });
      }
    }
  }

  if (url.pathname === '/api/health') {
    const healthResponse: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION,
      service: 'OmniBox Proxy Worker',
      globals: {
        https: (globalThis as any).thisProxyServerUrlHttps || 'NOT_SET',
        host: (globalThis as any).thisProxyServerUrl_hostOnly || 'NOT_SET'
      },
      features: {
        enhancedProxyMode: true,
        originalFunctionality: true,
        kvCache: !!env.KV_CACHE,
        corsSupport: true,
        passwordProtection: !!(env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD),
        proxyHint: true
      }
    };
    return new Response(JSON.stringify(healthResponse), { headers });
  }

  if (url.pathname === '/api/status') {
    const statusResponse: StatusResponse = {
      status: 'active',
      proxyMode: 'omnibox-enhanced',
      timestamp: Date.now(),
      version: CONFIG.VERSION,
      cors: 'unrestricted',
      caching: !!env.KV_CACHE,
      passwordProtected: !!(env.PROXY_PASSWORD || CONFIG.DEFAULT_PASSWORD),
      hintEnabled: true
    };
    return new Response(JSON.stringify(statusResponse), { headers });
  }

  if (url.pathname === '/api/cache/clear' && request.method === 'POST') {
    if (cacheManager) {
      try {
        const body = await request.json().catch(() => ({})) as { pattern?: string };
        await cacheManager.clearPattern(body.pattern || CONFIG.CACHE_PREFIX);

        const clearResponse: CacheClearResponse = {
          success: true,
          message: 'Cache cleared successfully'
        };
        return new Response(JSON.stringify(clearResponse), { headers });
      } catch (error) {
        const errorResponse: CacheClearResponse = {
          error: 'Cache clear failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        };
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers
        });
      }
    } else {
      const errorResponse: CacheClearResponse = {
        error: 'Cache not configured'
      };
      return new Response(JSON.stringify(errorResponse), {
        status: 400,
        headers
      });
    }
  }

  if (url.pathname === '/api/cache/preload' && request.method === 'POST') {
    return handlePreloadRequest(cacheManager);
  }

  if (url.pathname === '/api/cache/stats' && request.method === 'GET') {
    if (cacheManager) {
      const stats = await cacheManager.getStats();
      return new Response(JSON.stringify(stats), { headers });
    } else {
      return new Response(JSON.stringify({ error: 'Cache not configured' }), { status: 400, headers });
    }
  }

  const notFoundResponse = {
    error: 'API endpoint not found'
  };
  return new Response(JSON.stringify(notFoundResponse), {
    status: 404,
    headers
  });
}

async function handlePreloadRequest(cacheManager: CacheManager | null): Promise<Response> {
  const headers = createJsonHeaders();

  if (!cacheManager) {
    return new Response(JSON.stringify({ error: 'Cache not configured' }), {
      status: 400,
      headers
    });
  }

  const preloadUrls = CONFIG.PERFORMANCE.PRELOAD_URLS;

  if (!preloadUrls || preloadUrls.length === 0) {
    return new Response(JSON.stringify({
      success: true,
      message: 'No preload URLs configured',
      preloaded: 0
    }), { headers });
  }

  try {
    await cacheManager.preloadUrls(preloadUrls);
    return new Response(JSON.stringify({
      success: true,
      message: 'Preload completed',
      preloaded: preloadUrls.length,
      urls: preloadUrls
    }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Preload failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers
    });
  }
}

export default {
  async fetch(request: Request, env: EnvVariables, _ctx: ExecutionContext): Promise<Response> {
    const logger = Logger.create('Worker', env);

    try {
      return await handleRequest(request, env);
    } catch (error) {
      logger.error('OmniBox Worker error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: env.DEBUG === 'true' ? (error instanceof Error ? error.stack : undefined) : undefined
      });

      const errorMessage = env.DEBUG === 'true'
        ? (error instanceof Error ? error.message : 'Unknown error')
        : '服务暂时不可用，请稍后重试';

      return getHTMLResponse(
        getErrorPageTemplate('服务错误', errorMessage, 500),
        500
      );
    }
  }
};
