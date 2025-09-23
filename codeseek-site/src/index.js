// Enhanced Proxy Worker with flexible origin validation
// 版本: v2.1.3 - 修复CORS验证逻辑，支持更灵活的访问方式

/**
 * 验证请求来源是否合法（修复版）
 */
function isValidOrigin(request, allowedOrigins) {
  if (!allowedOrigins) return true; // 如果没有配置限制，允许所有访问
  
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // 调试模式下记录origin信息
  const DEBUG = request.env?.DEBUG === 'true';
  if (DEBUG) {
    console.log('Origin validation:', {
      origin,
      referer,
      userAgent: request.headers.get('user-agent'),
      method: request.method
    });
  }
  
  // 如果没有origin头，检查是否为直接访问
  if (!origin || origin === 'null') {
    // 允许直接浏览器访问
    const userAgent = request.headers.get('user-agent') || '';
    const isDirectBrowserAccess = userAgent.includes('Mozilla');
    
    if (isDirectBrowserAccess) {
      if (DEBUG) console.log('Allowing direct browser access without origin header');
      return true;
    }
    
    // 如果有referer，尝试从referer提取origin
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const refererOrigin = `${refererUrl.protocol}//${refererUrl.hostname}`;
        return checkOriginAgainstAllowed(refererOrigin, allowedOrigins, DEBUG);
      } catch (error) {
        if (DEBUG) console.log('Failed to extract origin from referer:', error.message);
      }
    }
    
    if (DEBUG) console.log('No valid origin found, allowing for compatibility');
    return true; // 为了兼容性，允许访问
  }
  
  return checkOriginAgainstAllowed(origin, allowedOrigins, DEBUG);
}

/**
 * 检查origin是否在允许列表中
 */
function checkOriginAgainstAllowed(origin, allowedOrigins, DEBUG = false) {
  const allowedDomains = allowedOrigins.split(',').map(domain => domain.trim());
  
  // 尝试解析origin URL
  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch (error) {
    if (DEBUG) console.log('Invalid origin URL:', origin, error.message);
    return false;
  }
  
  // 检查是否匹配允许的域名
  const isAllowed = allowedDomains.some(allowed => {
    if (allowed === 'null' || allowed === 'undefined') {
      return origin === 'null' || !origin;
    }
    
    try {
      const allowedUrl = new URL(allowed);
      const hostnameMatch = originUrl.hostname === allowedUrl.hostname;
      const protocolMatch = originUrl.protocol === allowedUrl.protocol;
      
      if (DEBUG) {
        console.log('Checking allowed domain:', {
          allowed,
          origin: origin,
          hostnameMatch,
          protocolMatch,
          result: hostnameMatch && protocolMatch
        });
      }
      
      return hostnameMatch && protocolMatch;
    } catch (error) {
      if (DEBUG) console.log('Invalid allowed domain URL:', allowed, error.message);
      return false;
    }
  });
  
  if (DEBUG) {
    console.log('Origin validation result:', isAllowed);
  }
  
  return isAllowed;
}

/**
 * 获取灵活的CORS头（修复版）
 */
function getFlexibleCorsHeaders(request, env) {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigins = env.ALLOWED_ORIGINS;
  
  // 基础CORS头 - 更宽松的配置
  const baseCorsHeaders = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, User-Agent, Cache-Control, Origin, Referer',
    'Access-Control-Max-Age': '86400',
  };
  
  // 如果有有效的origin且在白名单中
  if (origin && origin !== 'null' && isValidOrigin(request, allowedOrigins)) {
    return {
      ...baseCorsHeaders,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    };
  }
  
  // 如果没有origin但有referer，尝试使用referer
  if (!origin && referer && allowedOrigins) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.hostname}`;
      
      if (checkOriginAgainstAllowed(refererOrigin, allowedOrigins)) {
        return {
          ...baseCorsHeaders,
          'Access-Control-Allow-Origin': refererOrigin,
          'Access-Control-Allow-Credentials': 'true',
          'Vary': 'Origin',
        };
      }
    } catch (error) {
      console.log('Failed to process referer as origin:', error.message);
    }
  }
  
  // 对于直接浏览器访问或origin为null的情况
  const userAgent = request.headers.get('user-agent') || '';
  const isDirectBrowserAccess = userAgent.includes('Mozilla');
  
  if (isDirectBrowserAccess) {
    console.log('Providing CORS headers for direct browser access');
    return {
      ...baseCorsHeaders,
      'Access-Control-Allow-Origin': '*', // 对于直接访问，允许所有origin
      'Cache-Control': 'public, max-age=300'
    };
  }
  
  // 默认返回宽松的CORS头
  return {
    ...baseCorsHeaders,
    'Access-Control-Allow-Origin': '*'
  };
}

/**
 * 验证代理目标域名是否在白名单中
 */
function isValidProxyTarget(hostname, env) {
  // 定义允许代理的目标域名白名单
  const allowedTargets = [
    'www.javbus.com',
    'javbus.com', 
    'javdb.com',
    'www.javdb.com',
    'www.javlibrary.com',
    'javlibrary.com',
    'sukebei.nyaa.si',
    'btsow.com',
    'www.btsow.com',
    'magnetdl.com',
    'www.magnetdl.com',
    'torrentkitty.tv',
    'www.torrentkitty.tv',
    'jable.tv',
    'www.jable.tv',
    'javmost.com',
    'www.javmost.com',
    'jav.guru',
    'www.jav.guru',
    'av01.tv',
    'www.av01.tv',
    'missav.com',
    'www.missav.com',
    'javhd.porn',
    'www.javhd.porn',
    'javgg.net',
    'www.javgg.net',
    'javhihi.com',
    'www.javhihi.com',
    'sehuatang.org',
    'www.sehuatang.org',
    't66y.com',
    'www.t66y.com'
  ];
  
  // 如果环境变量中有额外的允许目标，也加入白名单
  const extraTargets = env.EXTRA_PROXY_TARGETS?.split(',').map(t => t.trim()) || [];
  const allAllowedTargets = [...allowedTargets, ...extraTargets];
  
  return allAllowedTargets.includes(hostname.toLowerCase());
}

function logError(request, message) {
  const clientIp = request.headers.get("cf-connecting-ip");
  const userAgent = request.headers.get("user-agent");
  const origin = request.headers.get("origin") || request.headers.get("referer");
  
  console.error(
    `${message}, clientIp: ${clientIp}, origin: ${origin}, user-agent: ${userAgent}, url: ${request.url}`
  );
}

function logDebug(request, message, env) {
  if (env.DEBUG === 'true') {
    const clientIp = request.headers.get("cf-connecting-ip");
    const origin = request.headers.get("origin") || request.headers.get("referer");
    console.log(`DEBUG: ${message}, clientIp: ${clientIp}, origin: ${origin}, url: ${request.url}`);
  }
}

function createNewRequest(request, url, proxyHostname, originHostname) {
  const newRequestHeaders = new Headers(request.headers);
  
  // 替换请求头中的hostname引用
  for (const [key, value] of newRequestHeaders) {
    if (value && value.includes(originHostname)) {
      newRequestHeaders.set(
        key,
        value.replace(
          new RegExp(`(?<!\\.)\\b${escapeRegex(originHostname)}\\b`, "g"),
          proxyHostname
        )
      );
    }
  }
  
  // 设置正确的Host头
  newRequestHeaders.set('Host', proxyHostname);
  
  // 移除可能导致问题的头
  newRequestHeaders.delete('cf-connecting-ip');
  newRequestHeaders.delete('cf-ray');
  newRequestHeaders.delete('cf-ipcountry');
  
  return new Request(url.toString(), {
    method: request.method,
    headers: newRequestHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'follow'
  });
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function setResponseHeaders(
  originalResponse,
  proxyHostname,
  originHostname,
  DEBUG,
  corsHeaders = {}
) {
  const newResponseHeaders = new Headers(originalResponse.headers);
  
  // 替换响应头中的hostname引用
  for (const [key, value] of newResponseHeaders) {
    if (value && value.includes(proxyHostname)) {
      newResponseHeaders.set(
        key,
        value.replace(
          new RegExp(`(?<!\\.)\\b${escapeRegex(proxyHostname)}\\b`, "g"),
          originHostname
        )
      );
    }
  }
  
  // 添加 CORS头
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newResponseHeaders.set(key, value);
    });
  }
  
  // 移除可能的安全限制头（仅在DEBUG模式下）
  if (DEBUG === 'true') {
    newResponseHeaders.delete("content-security-policy");
    newResponseHeaders.delete("x-frame-options");
  }
  
  // 添加安全头
  newResponseHeaders.set('X-Content-Type-Options', 'nosniff');
  newResponseHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  
  return newResponseHeaders;
}

/**
 * 替换内容中的域名引用
 */
async function replaceResponseText(
  originalResponse,
  proxyHostname,
  pathnameRegex,
  originHostname
) {
  let text = await originalResponse.text();
  
  if (pathnameRegex) {
    const cleanRegex = pathnameRegex.replace(/^\^/, "");
    return text.replace(
      new RegExp(`((?<!\\.)\\b${escapeRegex(proxyHostname)}\\b)(${cleanRegex})`, "g"),
      `${originHostname}$2`
    );
  } else {
    return text.replace(
      new RegExp(`(?<!\\.)\\b${escapeRegex(proxyHostname)}\\b`, "g"),
      originHostname
    );
  }
}

/**
 * 处理代理请求的核心逻辑（修复版）
 */
async function handleProxyRequest(request, env, targetHostname = null) {
  logDebug(request, `Starting proxy request, targetHostname: ${targetHostname}`, env);
  
  // 获取CORS头 - 使用更宽松的验证
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  
  const {
    PROXY_HOSTNAME,
    PROXY_PROTOCOL = "https",
    PATHNAME_REGEX,
    UA_WHITELIST_REGEX,
    UA_BLACKLIST_REGEX,
    URL302,
    IP_WHITELIST_REGEX,
    IP_BLACKLIST_REGEX,
    REGION_WHITELIST_REGEX,
    REGION_BLACKLIST_REGEX,
    DEBUG = "false",
  } = env;
  
  const url = new URL(request.url);
  const originHostname = url.hostname;
  
  // 确定代理目标 - 优先使用传入的targetHostname
  const proxyHostname = targetHostname || PROXY_HOSTNAME;
  
  // 验证代理目标
  if (!proxyHostname) {
    logError(request, "Proxy hostname not configured");
    return new Response(JSON.stringify({
      error: "Proxy not configured"
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  logDebug(request, `Using proxy hostname: ${proxyHostname}`, env);
  
  if (!isValidProxyTarget(proxyHostname, env)) {
    logError(request, `Invalid proxy target: ${proxyHostname}`);
    return new Response(JSON.stringify({
      error: "Invalid proxy target",
      target: proxyHostname,
      allowedTargets: env.DEBUG === 'true' ? 'Check server configuration' : undefined
    }), { 
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  // 验证访问条件
  const userAgent = request.headers.get("user-agent")?.toLowerCase() || "";
  const clientIp = request.headers.get("cf-connecting-ip") || "";
  const country = request.headers.get("cf-ipcountry") || "";
  
  if (
    (PATHNAME_REGEX && !new RegExp(PATHNAME_REGEX).test(url.pathname)) ||
    (UA_WHITELIST_REGEX && !new RegExp(UA_WHITELIST_REGEX).test(userAgent)) ||
    (UA_BLACKLIST_REGEX && new RegExp(UA_BLACKLIST_REGEX).test(userAgent)) ||
    (IP_WHITELIST_REGEX && !new RegExp(IP_WHITELIST_REGEX).test(clientIp)) ||
    (IP_BLACKLIST_REGEX && new RegExp(IP_BLACKLIST_REGEX).test(clientIp)) ||
    (REGION_WHITELIST_REGEX && !new RegExp(REGION_WHITELIST_REGEX).test(country)) ||
    (REGION_BLACKLIST_REGEX && new RegExp(REGION_BLACKLIST_REGEX).test(country))
  ) {
    logError(request, "Access denied - validation failed");
    return URL302
      ? Response.redirect(URL302, 302)
      : new Response(await generateErrorPage(), {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...corsHeaders
          },
        });
  }
  
  // 构建目标URL
  url.host = proxyHostname;
  url.protocol = PROXY_PROTOCOL;
  
  logDebug(request, `Target URL: ${url.toString()}`, env);
  
  const newRequest = createNewRequest(request, url, proxyHostname, originHostname);
  
  try {
    // 发起代理请求
    const originalResponse = await fetch(newRequest, {
      timeout: 30000, // 30秒超时
    });
    
    const newResponseHeaders = setResponseHeaders(
      originalResponse,
      proxyHostname,
      originHostname,
      DEBUG,
      corsHeaders
    );
    
    const contentType = newResponseHeaders.get("content-type") || "";
    let body;
    
    // 处理响应内容
    if (contentType.includes("text/") && originalResponse.body) {
      body = await replaceResponseText(
        originalResponse,
        proxyHostname,
        PATHNAME_REGEX,
        originHostname
      );
    } else {
      body = originalResponse.body;
    }
    
    return new Response(body, {
      status: originalResponse.status,
      statusText: originalResponse.statusText,
      headers: newResponseHeaders,
    });
  } catch (error) {
    logError(request, `Proxy request failed: ${error.message}`);
    return new Response(JSON.stringify({
      error: "Proxy request failed",
      message: DEBUG === 'true' ? error.message : "Service temporarily unavailable",
      target: proxyHostname
    }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

/**
 * 生成错误页面
 */
async function generateErrorPage() {
  return `<!DOCTYPE html>
<html>
<head>
<title>Access Denied</title>
<meta charset="utf-8">
<style>
html { color-scheme: light dark; }
body { 
  width: 35em; 
  margin: 0 auto;
  font-family: system-ui, -apple-system, sans-serif; 
  padding: 2rem;
  text-align: center;
  line-height: 1.6;
}
.status { 
  background: #fef2f2; 
  border: 1px solid #ef4444; 
  border-radius: 8px; 
  padding: 1.5rem; 
  margin: 1rem 0; 
}
h1 { color: #dc2626; margin: 0 0 1rem 0; }
.info { font-size: 0.9em; color: #666; margin-top: 2rem; }
</style>
</head>
<body>
<h1>🚫 Access Denied</h1>
<div class="status">
  <p><strong>访问被拒绝</strong></p>
  <p>您的请求未通过安全验证。</p>
  <p>请确保从授权的来源访问此服务。</p>
</div>
<div class="info">
  <p>如需帮助，请联系管理员。</p>
  <p><small>Error Code: ORIGIN_NOT_ALLOWED</small></p>
</div>
</body>
</html>`;
}

/**
 * 处理健康检查请求（修复版）
 */
async function handleHealthCheck(request, env) {
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.3',
    environment: env.ENVIRONMENT || 'production',
    security: {
      originValidation: 'flexible',
      corsSupport: true,
      directAccess: true,
      domainWhitelist: true
    },
    features: {
      proxy: !!env.PROXY_HOSTNAME,
      dynamicProxy: true,
      cors: true,
      pathRouting: !!env.PATHNAME_REGEX,
      geoBlocking: !!(env.REGION_WHITELIST_REGEX || env.REGION_BLACKLIST_REGEX),
      ipFiltering: !!(env.IP_WHITELIST_REGEX || env.IP_BLACKLIST_REGEX),
      userAgentFiltering: !!(env.UA_WHITELIST_REGEX || env.UA_BLACKLIST_REGEX)
    }
  };
  
  return new Response(JSON.stringify(healthData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * 处理API路由
 */
async function handleApiRoute(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  // 健康检查端点
  if (path === '/api/health' || path === '/_health') {
    return handleHealthCheck(request, env);
  }
  
  // 代理状态端点
  if (path === '/api/status') {
    const corsHeaders = getFlexibleCorsHeaders(request, env);
    
    const status = {
      proxyTarget: env.PROXY_HOSTNAME || 'not configured',
      protocol: env.PROXY_PROTOCOL || 'https',
      allowedOrigins: env.ALLOWED_ORIGINS || 'flexible',
      timestamp: new Date().toISOString(),
      debug: env.DEBUG === 'true',
      security: 'flexible',
      dynamicProxyEnabled: true,
      version: '2.1.3',
      cors: 'enhanced'
    };
    
    return new Response(JSON.stringify(status, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  
  const corsHeaders = getFlexibleCorsHeaders(request, env);
  return new Response('API endpoint not found', { 
    status: 404,
    headers: corsHeaders
  });
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      
      logDebug(request, `Request received for path: ${url.pathname}`, env);
      
      // 预检请求的特殊处理 - 确保所有CORS头都正确返回
      if (request.method === 'OPTIONS') {
        const corsHeaders = getFlexibleCorsHeaders(request, env);
        return new Response(null, { 
          headers: corsHeaders,
          status: 204
        });
      }
      
      // 处理API路由
      if (url.pathname.startsWith('/api/') || url.pathname === '/_health') {
        logDebug(request, `Handling API route: ${url.pathname}`, env);
        return await handleApiRoute(request, env);
      }
      
      // 处理动态代理路由 /proxy/{hostname}/{path}
      if (url.pathname.startsWith('/proxy/')) {
        logDebug(request, `Handling dynamic proxy route: ${url.pathname}`, env);
        
        const pathParts = url.pathname.substring(7).split('/'); // 移除 '/proxy/' 前缀
        const targetHostname = pathParts[0];
        
        if (!targetHostname) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, "Invalid proxy URL: missing hostname");
          return new Response(JSON.stringify({
            error: 'Invalid proxy URL: missing hostname',
            expectedFormat: '/proxy/{hostname}/{path}'
          }), { 
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // 验证hostname格式和白名单
        if (!/^[a-zA-Z0-9.-]+$/.test(targetHostname)) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, `Invalid hostname format: ${targetHostname}`);
          return new Response(JSON.stringify({
            error: 'Invalid hostname format',
            hostname: targetHostname
          }), { 
            status: 400,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        if (!isValidProxyTarget(targetHostname, env)) {
          const corsHeaders = getFlexibleCorsHeaders(request, env);
          logError(request, `Forbidden proxy target: ${targetHostname}`);
          return new Response(JSON.stringify({
            error: 'Forbidden proxy target',
            hostname: targetHostname,
            message: '该域名不在代理白名单中'
          }), { 
            status: 403,
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          });
        }
        
        // 重构路径：正确处理子路径和查询参数
        let targetPath = '/';
        if (pathParts.length > 1) {
          // 移除空的路径段，正确拼接路径
          const pathSegments = pathParts.slice(1).filter(segment => segment);
          if (pathSegments.length > 0) {
            targetPath = '/' + pathSegments.join('/');
          }
        }
        
        // 保留查询参数和fragment
        if (url.search) {
          targetPath += url.search;
        }
        if (url.hash) {
          targetPath += url.hash;
        }
        
        logDebug(request, `Dynamic proxy - target: ${targetHostname}, path: ${targetPath}`, env);
        
        // 重写请求URL
        const newUrl = new URL(request.url);
        newUrl.pathname = targetPath;
        
        const modifiedRequest = new Request(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });
        
        // 调用代理处理函数，传入目标主机名
        return await handleProxyRequest(modifiedRequest, env, targetHostname);
      }
      
      // 处理主代理逻辑（需要配置 PROXY_HOSTNAME）
      logDebug(request, "Handling main proxy logic", env);
      return await handleProxyRequest(request, env);
      
    } catch (error) {
      logError(request, `Worker error: ${error.message}`);
      
      // 返回友好的错误响应
      const errorResponse = {
        error: 'Proxy service error',
        message: env.DEBUG === 'true' ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        code: 'WORKER_ERROR',
        version: '2.1.3'
      };
      
      const corsHeaders = getFlexibleCorsHeaders(request, env);
      
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },
};