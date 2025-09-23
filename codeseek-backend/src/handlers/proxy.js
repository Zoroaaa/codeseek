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
 * 代理服务主处理器 - 修复版本
 */
export async function proxyHandler(request, env) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;

    console.log(`🔄 代理请求开始: ${pathname}`);
    console.log(`🌍 完整URL: ${request.url}`);

    // 修复：更安全的目标URL提取
    const proxyPath = pathname.replace('/api/proxy/', '');
    
    if (!proxyPath) {
      console.error('❌ 缺少目标URL');
      return utils.errorResponse('缺少目标URL', 400);
    }

    console.log(`🔍 原始代理路径: ${proxyPath}`);

    // 修复：改进的URL解码逻辑
    let targetUrl;
    try {
      // 确保只解码一次，避免双重编码问题
      targetUrl = proxyPath;
      
      // 检查是否为编码状态
      if (targetUrl.includes('%')) {
        try {
          const decoded = decodeURIComponent(targetUrl);
          // 验证解码后的URL是否有效
          new URL(decoded);
          targetUrl = decoded;
          console.log(`🔓 URL解码成功: ${targetUrl}`);
        } catch (decodeError) {
          console.warn('⚠️ URL解码失败，使用原始URL:', decodeError);
          // 如果解码失败，可能本身就不是编码的URL
        }
      }
    } catch (error) {
      console.error('❌ URL处理失败:', error);
      return utils.errorResponse('无效的URL格式', 400);
    }

    // 确保URL有协议
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
      console.log(`🔒 添加HTTPS协议: ${targetUrl}`);
    }

    console.log(`🎯 最终目标URL: ${targetUrl}`);

    // 验证目标URL
    const validation = validateTargetUrl(targetUrl);
    if (!validation.valid) {
      console.error(`❌ URL验证失败: ${validation.error}`);
      return utils.errorResponse(validation.error, 403);
    }

    console.log(`✅ URL验证通过`);

    // 记录访问日志（如果用户已登录）
    const user = await authenticate(request, env).catch(() => null);
    if (user && env.ENABLE_ACTION_LOGGING === 'true') {
      await utils.logUserAction(env, user.id, 'proxy_access', {
        targetUrl: targetUrl,
        userAgent: request.headers.get('User-Agent'),
        timestamp: Date.now()
      }, request);
      console.log(`📝 记录用户访问日志: ${user.id}`);
    }

    // 执行代理请求
    console.log(`🚀 开始执行代理请求`);
    const result = await executeProxy(request, targetUrl, url);
    
    console.log(`✅ 代理请求完成: ${result.status}`);
    return result;

  } catch (error) {
    console.error('❌ 代理请求失败:', error);
    return utils.errorResponse('代理服务暂时不可用: ' + error.message, 500);
  }
}

/**
 * 验证目标URL是否允许代理 - 增强版本
 */
function validateTargetUrl(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();

    console.log(`🔍 验证域名: ${hostname}`);

    // 检查是否在黑名单中
    if (SPAM_DOMAINS.some(domain => hostname.includes(domain))) {
      console.log(`🚫 域名在黑名单中: ${hostname}`);
      return { valid: false, error: '该域名已被列入黑名单' };
    }

    // 检查是否在白名单中
    const isAllowed = ALLOWED_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith('.' + domain);
    });

    if (!isAllowed) {
      console.log(`🚫 域名不在白名单中: ${hostname}`);
      console.log(`📋 允许的域名:`, ALLOWED_DOMAINS);
      return { valid: false, error: '该域名不在允许的代理范围内' };
    }

    // 添加协议检查
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      console.log(`🚫 不支持的协议: ${urlObj.protocol}`);
      return { valid: false, error: '不支持的协议类型' };
    }

    // 添加端口检查（可选）
    const allowedPorts = ['80', '443', '8080', '8443'];
    if (urlObj.port && !allowedPorts.includes(urlObj.port)) {
      console.log(`🚫 不允许的端口: ${urlObj.port}`);
      return { valid: false, error: '不允许的端口号' };
    }

    console.log(`✅ 域名验证通过: ${hostname}`);
    return { valid: true };
  } catch (error) {
    console.error('❌ URL验证异常:', error);
    return { valid: false, error: '无效的URL格式' };
  }
}

/**
 * 执行代理请求 - 修复版本
 */
async function executeProxy(originalRequest, targetUrl, originalUrlObj) {
  try {
    // 创建新的请求头，过滤不必要的头部
    const newHeaders = new Headers();
    
    // 复制必要的请求头
    const allowedHeaders = [
      'accept', 'accept-language', 'cache-control', 'content-type',
      'range', 'user-agent', 'accept-encoding'
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
    
    // 根据请求的文件类型设置正确的Accept头
    const urlPath = targetUrlObj.pathname.toLowerCase();
    if (urlPath.endsWith('.css') || urlPath.includes('.css?')) {
      newHeaders.set('Accept', 'text/css,*/*;q=0.1');
      console.log(`📄 CSS文件请求`);
    } else if (urlPath.endsWith('.js') || urlPath.includes('.js?')) {
      newHeaders.set('Accept', 'application/javascript,*/*;q=0.1');
      console.log(`📄 JS文件请求`);
    } else if (urlPath.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)(\?|$)/i)) {
      newHeaders.set('Accept', 'image/*,*/*;q=0.8');
      console.log(`📄 图片文件请求`);
    } else {
      console.log(`📄 HTML/其他内容请求`);
    }

    // 创建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: originalRequest.method,
      headers: newHeaders,
      body: originalRequest.method !== 'GET' ? originalRequest.body : null,
      redirect: 'manual' // 手动处理重定向
    });

    console.log(`📄 代理请求: ${targetUrl}`);
    console.log(`📋 请求头:`, Object.fromEntries(newHeaders.entries()));

    // 发起请求
    const response = await fetch(proxyRequest);
    
    console.log(`📥 响应状态: ${response.status}`);
    console.log(`📋 响应头:`, Object.fromEntries(response.headers.entries()));

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get('location');
      if (locationHeader) {
        console.log(`📄 处理重定向: ${locationHeader}`);
        const redirectUrl = new URL(locationHeader, targetUrl);
        
        // 修复：确保重定向URL也经过编码
        const encodedRedirectUrl = encodeURIComponent(redirectUrl.toString());
        const newProxyPath = `/api/proxy/${encodedRedirectUrl}`;
        
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
    console.log(`📄 原始Content-Type: ${originalContentType}`);
    
    // 更精确的内容类型判断和处理
    const isHtmlContent = originalContentType.toLowerCase().includes('text/html');
    const isCssContent = originalContentType.toLowerCase().includes('text/css') || 
                        targetUrl.toLowerCase().includes('.css');
    const isJsContent = originalContentType.toLowerCase().includes('javascript') || 
                       originalContentType.toLowerCase().includes('application/js') ||
                       targetUrl.toLowerCase().includes('.js');
    const isImageContent = originalContentType.toLowerCase().startsWith('image/');
    const isBinaryContent = !originalContentType.toLowerCase().startsWith('text/') && 
                           !originalContentType.toLowerCase().includes('javascript') &&
                           !originalContentType.toLowerCase().includes('json');
    
    let responseBody = response.body;
    let modifiedContentType = originalContentType;

    // 只对HTML内容进行URL重写，其他内容直接传递
    if (isHtmlContent && response.ok) {
      try {
        console.log('📄 处理HTML内容');
        const htmlContent = await response.text();
        const modifiedHtml = rewriteHtmlContent(htmlContent, targetUrl, originalUrlObj.origin);
        responseBody = modifiedHtml;
        modifiedContentType = 'text/html; charset=utf-8';
        console.log('✅ HTML内容处理完成');
      } catch (error) {
        console.error('❌ 处理HTML内容失败:', error);
        responseBody = response.body; // 回退到原始内容
      }
    }
    // 确保CSS文件正确的Content-Type
    else if (isCssContent && response.ok) {
      console.log('📄 处理CSS文件');
      if (!originalContentType.includes('text/css')) {
        modifiedContentType = 'text/css; charset=utf-8';
        console.log('🔧 修正CSS Content-Type');
      }
      responseBody = response.body; // CSS文件直接传递，不做修改
    }
    // 确保JS文件正确的Content-Type  
    else if (isJsContent && response.ok) {
      console.log('📄 处理JS文件');
      if (!originalContentType.includes('javascript')) {
        modifiedContentType = 'application/javascript; charset=utf-8';
        console.log('🔧 修正JS Content-Type');
      }
      responseBody = response.body; // JS文件直接传递，不做修改
    }
    // 确保图片文件正确传递
    else if (isImageContent || isBinaryContent) {
      console.log('📄 处理二进制文件');
      responseBody = response.body; // 二进制文件直接传递
      modifiedContentType = originalContentType; // 保持原始类型
    }
    // 其他文本内容直接传递
    else {
      console.log('📄 直接传递其他内容');
      responseBody = response.body;
    }

    // 创建响应
    const modifiedResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: createResponseHeaders(response.headers, modifiedContentType)
    });

    console.log(`✅ 代理响应创建完成，Content-Type: ${modifiedContentType}`);
    return modifiedResponse;

  } catch (error) {
    console.error('❌ 代理请求执行失败:', error);
    
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
 * 重写HTML内容中的链接 - 改进版本
 */
function rewriteHtmlContent(htmlContent, originalUrl, proxyOrigin) {
  const originalUrlObj = new URL(originalUrl);
  const baseUrl = `${originalUrlObj.protocol}//${originalUrlObj.hostname}`;

  console.log(`📄 开始重写HTML内容，基础URL: ${baseUrl}`);

  let modifiedHtml = htmlContent;

  // 更精确的URL重写，确保静态资源正确处理
  const replacements = [
    // CSS文件链接重写
    {
      pattern: /href=["'](\/[^"']*?\.css(?:\?[^"']*?)?)["']/gi,
      replacement: (match, path) => {
        const fullUrl = baseUrl + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 CSS链接重写: ${path} -> ${proxyUrl}`);
        return `href="${proxyUrl}"`;
      }
    },
    
    // JS文件链接重写
    {
      pattern: /src=["'](\/[^"']*?\.js(?:\?[^"']*?)?)["']/gi,
      replacement: (match, path) => {
        const fullUrl = baseUrl + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 JS链接重写: ${path} -> ${proxyUrl}`);
        return `src="${proxyUrl}"`;
      }
    },
    
    // 图片文件链接重写
    {
      pattern: /src=["'](\/[^"']*?\.(png|jpg|jpeg|gif|webp|svg|ico)(?:\?[^"']*?)?)["']/gi,
      replacement: (match, path) => {
        const fullUrl = baseUrl + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 图片链接重写: ${path} -> ${proxyUrl}`);
        return `src="${proxyUrl}"`;
      }
    },
    
    // 其他相对路径链接重写 (排除已处理的文件类型)
    {
      pattern: /href=["']\/(?!\/|http|#)([^"']*?)["']/g,
      replacement: (match, path) => {
        // 跳过已经处理的CSS文件
        if (path.match(/\.css(\?|$)/i)) return match;
        const fullUrl = baseUrl + '/' + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 其他href重写: ${path} -> ${proxyUrl}`);
        return `href="${proxyUrl}"`;
      }
    },
    
    // 其他相对路径src重写 (排除已处理的文件类型)
    {
      pattern: /src=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: (match, path) => {
        // 跳过已经处理的JS和图片文件
        if (path.match(/\.(js|png|jpg|jpeg|gif|webp|svg|ico)(\?|$)/i)) return match;
        const fullUrl = baseUrl + '/' + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 其他src重写: ${path} -> ${proxyUrl}`);
        return `src="${proxyUrl}"`;
      }
    },
    
    // 表单action重写
    {
      pattern: /action=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: (match, path) => {
        const fullUrl = baseUrl + '/' + path;
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(fullUrl)}`;
        console.log(`🔗 表单action重写: ${path} -> ${proxyUrl}`);
        return `action="${proxyUrl}"`;
      }
    },
    
    // 绝对URL重写 (仅限同域)
    {
      pattern: new RegExp(`(href|src|action)=["'](${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"']*?)["']`, 'gi'),
      replacement: (match, attr, url) => {
        const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(url)}`;
        console.log(`🔗 绝对URL重写: ${url} -> ${proxyUrl}`);
        return `${attr}="${proxyUrl}"`;
      }
    }
  ];

  // 应用所有替换规则
  replacements.forEach(({ pattern, replacement }) => {
    modifiedHtml = modifiedHtml.replace(pattern, replacement);
  });

  // 添加base标签，但要确保不会干扰相对路径
  const baseTagPattern = /<base[^>]*>/i;
  if (!baseTagPattern.test(modifiedHtml)) {
    const headPattern = /<head[^>]*>/i;
    if (headPattern.test(modifiedHtml)) {
      // 注意：base href设置为代理根路径而不是目标站点，避免相对路径问题
      const baseTag = `\n<!-- Proxy base tag -->\n<base href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl)}/">`;
      modifiedHtml = modifiedHtml.replace(headPattern, `$&${baseTag}`);
      console.log(`🔗 添加base标签`);
    }
  }

  // 添加额外的脚本来处理动态加载的资源
  const bodyEndPattern = /<\/body>/i;
  if (bodyEndPattern.test(modifiedHtml)) {
    const proxyScript = `
    <script>
    (function() {
      console.log('🔧 代理脚本已加载');
      // 拦截动态创建的链接和脚本
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName) {
        const element = originalCreateElement.call(this, tagName);
        
        if (tagName.toLowerCase() === 'link' || tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'img') {
          const originalSetAttribute = element.setAttribute;
          element.setAttribute = function(name, value) {
            if ((name === 'href' || name === 'src') && value.startsWith('/') && !value.startsWith('//')) {
              const newValue = '${proxyOrigin}/api/proxy/' + encodeURIComponent('${baseUrl}' + value);
              console.log('🔧 动态重写链接:', value, '->', newValue);
              value = newValue;
            }
            return originalSetAttribute.call(this, name, value);
          };
        }
        
        return element;
      };
    })();
    </script>`;
    
    modifiedHtml = modifiedHtml.replace(bodyEndPattern, proxyScript + '\n$&');
    console.log(`🔗 添加动态链接处理脚本`);
  }

  console.log(`✅ HTML内容重写完成`);
  return modifiedHtml;
}

/**
 * 创建响应头 - 增强版本
 */
function createResponseHeaders(originalHeaders, contentType) {
  const headers = new Headers();

  // 复制大部分原始头部，但跳过可能导致问题的头部
  const skipHeaders = [
    'content-encoding', 
    'content-security-policy', 
    'x-frame-options',
    'strict-transport-security', 
    'content-length',
    'transfer-encoding',
    'connection',
    'upgrade',
    'host'
  ];

  for (const [key, value] of originalHeaders.entries()) {
    const lowerKey = key.toLowerCase();
    
    if (!skipHeaders.includes(lowerKey)) {
      headers.set(key, value);
    }
  }

  // 确保正确设置Content-Type
  if (contentType) {
    headers.set('Content-Type', contentType);
    console.log(`📋 设置Content-Type: ${contentType}`);
  }

  // 根据Content-Type设置正确的缓存策略
  if (contentType) {
    if (contentType.includes('text/css') || contentType.includes('javascript') || contentType.startsWith('image/')) {
      // 静态资源允许缓存
      headers.set('Cache-Control', 'public, max-age=3600');
      console.log(`📋 设置静态资源缓存策略`);
    } else if (contentType.includes('text/html')) {
      // HTML内容短期缓存
      headers.set('Cache-Control', 'public, max-age=300');
      console.log(`📋 设置HTML缓存策略`);
    } else {
      // 其他内容禁用缓存
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      console.log(`📋 设置禁用缓存策略`);
    }
  } else {
    // 默认禁用缓存
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // 添加CORS头部
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set('Access-Control-Expose-Headers', '*');

  // 移除可能导致问题的安全头部
  headers.delete('X-Frame-Options');
  headers.delete('Content-Security-Policy');
  
  // 添加自定义头部标识这是代理响应
  headers.set('X-Proxy-Service', 'active');
  headers.set('X-Proxy-Target', 'masked'); // 不暴露真实目标URL

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
 * 代理健康检查 - 改进版本
 */
export async function proxyHealthCheckHandler(request, env) {
  try {
    console.log(`💚 代理健康检查开始`);
    
    // 改进：不依赖外部网站，直接返回服务状态
    const healthInfo = {
      healthy: true,
      timestamp: Date.now(),
      allowedDomains: ALLOWED_DOMAINS.length,
      message: '代理服务运行正常',
      version: '1.0.0'
    };

    // 可选：如果需要测试外部连接，使用更可靠的方式
    if (env.ENABLE_EXTERNAL_HEALTH_CHECK === 'true') {
      try {
        console.log(`💚 执行外部连接测试`);
        const testUrl = 'https://www.javbus.com';
        const testRequest = new Request(testUrl, {
          method: 'HEAD',
          headers: { 
            'User-Agent': 'Mozilla/5.0 (compatible; ProxyHealthCheck)',
            'Accept': '*/*'
          }
        });

        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const response = await fetch(testRequest, { 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        const responseTime = Date.now() - startTime;

        healthInfo.externalTest = {
          success: response.ok || response.status === 403, // 403也算正常，可能是反爬限制
          responseTime,
          statusCode: response.status,
          testUrl
        };
        
        console.log(`💚 外部测试完成: ${response.status}`);
      } catch (externalError) {
        console.log(`💚 外部测试失败: ${externalError.message}`);
        healthInfo.externalTest = {
          success: false,
          error: externalError.message
        };
      }
    }

    console.log(`💚 健康检查完成`);
    return utils.successResponse(healthInfo);

  } catch (error) {
    console.error('💚 健康检查失败:', error);
    return utils.successResponse({
      healthy: false,
      error: error.message,
      allowedDomains: ALLOWED_DOMAINS.length,
      timestamp: Date.now(),
      message: '代理服务遇到问题'
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