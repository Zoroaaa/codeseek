// src/handlers/proxy.js - 修复版代理服务处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';

// 允许代理的域名白名单 - 只允许搜索源域名
const ALLOWED_DOMAINS = [
  'javbus.com',
  'www.javbus.com',
  'javdb.com',
  'www.javdb.com',
  'jable.tv',
  'www.jable.tv',
  'javmost.com',
  'www.javmost.com',
  'javgg.net',
  'www.javgg.net',
  'sukebei.nyaa.si',
  'jav.guru',
  'www.jav.guru',
  'javlibrary.com',
  'www.javlibrary.com',
  'btsow.com',
  'www.btsow.com'
];

// 垃圾域名黑名单
const SPAM_DOMAINS = [
  'seedmm.cyou', 'busfan.cyou', 'dmmsee.ink', 'ph7zhi.vip', '8pla6t.vip',
  'ltrpvkga.com', 'frozaflurkiveltra.com', 'shvaszc.cc', 'fpnylxm.cc',
  'mvqttfwf.com', 'jempoprostoklimor.com', '128zha.cc', 'aciyopg.cc',
  'mnaspm.com', 'asacp.org', 'pr0rze.vip', 'go.mnaspm.com'
];

/**
 * 代理服务主处理器
 */
export async function proxyHandler(request, env) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 提取目标URL - 改进处理方式
    const proxyPath = pathname.replace('/api/proxy/', '');
    
    if (!proxyPath) {
      return utils.errorResponse('缺少目标URL', 400);
    }

    // 解码URL
    let targetUrl;
    try {
      // 处理可能的双重编码问题
      targetUrl = decodeURIComponent(proxyPath);
      // 如果还是编码状态，再次解码
      if (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (error) {
      return utils.errorResponse('无效的URL编码', 400);
    }

    // 确保URL有协议
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // 验证目标URL
    const validation = validateTargetUrl(targetUrl);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 403);
    }

    // 记录访问日志（如果用户已登录）
    const user = await authenticate(request, env).catch(() => null);
    if (user && env.ENABLE_ACTION_LOGGING === 'true') {
      await utils.logUserAction(env, user.id, 'proxy_access', {
        targetUrl: targetUrl,
        userAgent: request.headers.get('User-Agent'),
        timestamp: Date.now()
      }, request);
    }

    // 执行代理请求
    return await executeProxy(request, targetUrl, url);

  } catch (error) {
    console.error('代理请求失败:', error);
    return utils.errorResponse('代理服务暂时不可用: ' + error.message, 500);
  }
}

/**
 * 验证目标URL是否允许代理
 */
function validateTargetUrl(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();

    // 检查是否在黑名单中
    if (SPAM_DOMAINS.some(domain => hostname.includes(domain))) {
      return { valid: false, error: '该域名已被列入黑名单' };
    }

    // 检查是否在白名单中
    const isAllowed = ALLOWED_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });

    if (!isAllowed) {
      return { valid: false, error: '该域名不在允许的代理范围内' };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: '无效的URL格式' };
  }
}

/**
 * 执行代理请求
 */
async function executeProxy(originalRequest, targetUrl, originalUrlObj) {
  try {
    // 创建新的请求头，过滤不必要的头部
    const newHeaders = new Headers();
    
    // 复制必要的请求头
    const allowedHeaders = [
      'accept', 'accept-language', 'cache-control', 'content-type',
      'range', 'user-agent'
    ];

    allowedHeaders.forEach(headerName => {
      const headerValue = originalRequest.headers.get(headerName);
      if (headerValue) {
        newHeaders.set(headerName, headerValue);
      }
    });

    // 设置自定义Referer以绕过某些反爬限制
    const targetUrlObj = new URL(targetUrl);
    newHeaders.set('Referer', `${targetUrlObj.protocol}//${targetUrlObj.hostname}/`);

    // 创建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: originalRequest.method,
      headers: newHeaders,
      body: originalRequest.method !== 'GET' ? originalRequest.body : null,
      redirect: 'manual' // 手动处理重定向
    });

    // 发起请求
    const response = await fetch(proxyRequest);

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        const redirectUrl = new URL(locationHeader, targetUrl);
        const newProxyPath = `/api/proxy/${encodeURIComponent(redirectUrl.toString())}`;
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            'Location': `${originalUrlObj.origin}${newProxyPath}`
          }
        });
      }
    }

    // 获取原始内容类型
    const originalContentType = response.headers.get('content-type') || '';
    
    // 🔧 关键修复：根据内容类型决定是否处理
    const isHtmlContent = originalContentType.toLowerCase().includes('text/html');
    const isTextContent = originalContentType.toLowerCase().includes('text/') && !isHtmlContent;
    
    let responseBody = response.body;
    let modifiedContentType = originalContentType;

    // 只对HTML内容进行URL重写
    if (isHtmlContent) {
      try {
        const htmlContent = await response.text();
        const modifiedHtml = rewriteHtmlContent(htmlContent, targetUrl, originalUrlObj.origin);
        responseBody = modifiedHtml;
        // 确保Content-Type正确
        modifiedContentType = 'text/html; charset=utf-8';
      } catch (error) {
        console.error('处理HTML内容失败:', error);
        responseBody = response.body; // 回退到原始内容
      }
    }
    // 对其他文本内容（如CSS、JS）不进行处理，直接传递
    else {
      // 保持原始内容和Content-Type
      responseBody = response.body;
    }

    // 创建响应
    const modifiedResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: createResponseHeaders(response.headers, modifiedContentType)
    });

    return modifiedResponse;

  } catch (error) {
    console.error('代理请求执行失败:', error);
    
    // 返回友好的错误页面
    return new Response(createErrorPage(targetUrl, error.message), {
      status: 502,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * 重写HTML内容中的链接
 */
function rewriteHtmlContent(htmlContent, originalUrl, proxyOrigin) {
  const originalUrlObj = new URL(originalUrl);
  const baseUrl = `${originalUrlObj.protocol}//${originalUrlObj.hostname}`;

  // 替换相对路径链接
  let modifiedHtml = htmlContent;

  // 🔧 更精确的URL重写，避免影响CSS和JS文件
  const replacements = [
    // href="/path" -> href="/api/proxy/https://domain.com/path" (排除CSS文件)
    {
      pattern: /href=["']\/(?!\/|http|#)([^"']*?)["']/g,
      replacement: (match, path) => {
        // 如果是CSS文件，转换为代理URL
        if (path.endsWith('.css') || path.includes('.css?')) {
          return `href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + '/' + path)}"`;
        }
        // 其他链接也转换为代理URL
        return `href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + '/' + path)}"`;
      }
    },
    // src="/path" -> src="/api/proxy/https://domain.com/path" (排除JS文件)
    {
      pattern: /src=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: (match, path) => {
        // 如果是JS文件，转换为代理URL
        if (path.endsWith('.js') || path.includes('.js?')) {
          return `src="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + '/' + path)}"`;
        }
        // 其他资源也转换为代理URL
        return `src="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + '/' + path)}"`;
      }
    },
    // action="/path" -> action="/api/proxy/https://domain.com/path"
    {
      pattern: /action=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: (match, path) => {
        return `action="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + '/' + path)}"`;
      }
    }
  ];

  replacements.forEach(({ pattern, replacement }) => {
    if (typeof replacement === 'function') {
      modifiedHtml = modifiedHtml.replace(pattern, replacement);
    } else {
      modifiedHtml = modifiedHtml.replace(pattern, replacement);
    }
  });

  // 添加 base标签防止相对路径问题
  const baseTagPattern = /<base[^>]*>/i;
  if (!baseTagPattern.test(modifiedHtml)) {
    const headPattern = /<head[^>]*>/i;
    if (headPattern.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(headPattern, 
        `$&\n<base href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl)}/">`
      );
    }
  }

  return modifiedHtml;
}

/**
 * 创建响应头
 */
function createResponseHeaders(originalHeaders, contentType) {
  const headers = new Headers();

  // 复制大部分原始头部
  for (const [key, value] of originalHeaders.entries()) {
    const lowerKey = key.toLowerCase();
    
    // 跳过可能导致问题的头部
    if (!['content-encoding', 'content-security-policy', 'x-frame-options', 
          'strict-transport-security', 'content-length'].includes(lowerKey)) {
      headers.set(key, value);
    }
  }

  // 🔧 确保正确设置Content-Type
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  // 添加CORS头部
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');

  // 禁用缓存以确保实时性
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('Pragma', 'no-cache');

  return headers;
}

/**
 * 创建错误页面
 */
function createErrorPage(targetUrl, errorMessage) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>代理访问失败</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }
        .error-container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 30px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { margin: 0 0 20px 0; font-size: 2em; }
        .error-message { 
          margin: 20px 0;
          padding: 15px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-family: monospace;
        }
        .target-url {
          word-break: break-all;
          margin: 15px 0;
          opacity: 0.8;
        }
        .retry-btn {
          display: inline-block;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          margin: 20px 10px;
          transition: all 0.3s;
        }
        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>🚫 代理访问失败</h1>
        <div class="error-message">${errorMessage}</div>
        <div class="target-url">目标地址: ${targetUrl}</div>
        <a href="javascript:history.back()" class="retry-btn">返回上页</a>
        <a href="javascript:location.reload()" class="retry-btn">重试</a>
      </div>
    </body>
    </html>
  `;
}

/**
 * 代理健康检查
 */
export async function proxyHealthCheckHandler(request, env) {
  try {
    // 测试代理一个简单的请求
    const testUrl = 'https://www.javbus.com';
    const testRequest = new Request(testUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProxyHealthCheck)' }
    });

    const startTime = Date.now();
    const response = await fetch(testRequest);
    const responseTime = Date.now() - startTime;

    const isHealthy = response.ok || response.status === 403; // 403也算正常，可能是反爬限制

    return utils.successResponse({
      healthy: isHealthy,
      responseTime,
      testUrl,
      statusCode: response.status,
      allowedDomains: ALLOWED_DOMAINS.length,
      timestamp: Date.now()
    });

  } catch (error) {
    return utils.successResponse({
      healthy: false,
      error: error.message,
      allowedDomains: ALLOWED_DOMAINS.length,
      timestamp: Date.now()
    });
  }
}

/**
 * 获取代理统计信息
 */
export async function proxyStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    // 获取用户的代理访问统计
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as totalAccess,
        COUNT(DISTINCT JSON_EXTRACT(data, '$.targetUrl')) as uniqueUrls,
        MAX(created_at) as lastAccess
      FROM user_actions 
      WHERE user_id = ? AND action = 'proxy_access' AND created_at > datetime('now', '-7 days')
    `).bind(user.id).first();

    // 获取最近访问的域名统计
    const domainStats = await env.DB.prepare(`
      SELECT 
        JSON_EXTRACT(data, '$.targetUrl') as url,
        COUNT(*) as count
      FROM user_actions 
      WHERE user_id = ? AND action = 'proxy_access' AND created_at > datetime('now', '-7 days')
      GROUP BY JSON_EXTRACT(data, '$.targetUrl')
      ORDER BY count DESC
      LIMIT 10
    `).bind(user.id).all();

    return utils.successResponse({
      userStats: {
        totalAccess: stats.totalAccess || 0,
        uniqueUrls: stats.uniqueUrls || 0,
        lastAccess: stats.lastAccess
      },
      topDomains: domainStats.results || [],
      allowedDomains: ALLOWED_DOMAINS,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('获取代理统计失败:', error);
    return utils.errorResponse('获取统计信息失败', 500);
  }
}

export default {
  proxyHandler,
  proxyHealthCheckHandler,
  proxyStatsHandler
};