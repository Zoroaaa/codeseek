// src/handlers/proxy.js
import { utils } from '../utils.js';

// 允许代理的域名白名单
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

export async function proxyHandler(request, env) {
  try {
    const url = new URL(request.url);
    
    // 从路径中提取编码的目标URL
    // 路径格式: /api/proxy/{encoded_url}
    const pathParts = url.pathname.split('/api/proxy/');
    if (pathParts.length < 2 || !pathParts[1]) {
      return utils.errorResponse('缺少目标URL', 400);
    }
    
    // 解码目标URL
    let targetUrl;
    try {
      targetUrl = decodeURIComponent(pathParts[1]);
    } catch (error) {
      return utils.errorResponse('无效的URL编码', 400);
    }

    // 确保有协议
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // 验证域名是否在白名单
    try {
      const targetUrlObj = new URL(targetUrl);
      const hostname = targetUrlObj.hostname.toLowerCase();
      
      const isAllowed = ALLOWED_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith('.' + domain)
      );
      
      if (!isAllowed) {
        return utils.errorResponse(`域名 ${hostname} 不在允许的代理范围内`, 403);
      }
    } catch (error) {
      return utils.errorResponse('无效的目标URL格式', 400);
    }

    console.log(`代理请求: ${targetUrl}`);

    // 创建新的请求头，过滤掉 cf- 开头的头部
    const newHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!key.startsWith('cf-') && 
          !['host', 'content-length'].includes(key.toLowerCase())) {
        newHeaders.set(key, value);
      }
    }

    // 设置必要的请求头
    const targetUrlObj = new URL(targetUrl);
    newHeaders.set('Host', targetUrlObj.host);
    newHeaders.set('Referer', targetUrlObj.origin);
    newHeaders.set('Origin', targetUrlObj.origin);

    // 创建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? request.body 
        : null,
      redirect: 'manual'
    });

    // 发起请求
    const response = await fetch(proxyRequest);

    // 处理重定向
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        // 将重定向URL也转换为代理URL
        const absoluteLocation = new URL(location, targetUrl).toString();
        const proxiedLocation = `/api/proxy/${encodeURIComponent(absoluteLocation)}`;
        
        const modifiedHeaders = new Headers(response.headers);
        modifiedHeaders.set('Location', proxiedLocation);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: modifiedHeaders
        });
      }
    }

    // 处理HTML内容，替换其中的链接
    let responseBody = response.body;
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      const modifiedHtml = rewriteHtmlContent(text, targetUrl, url.origin);
      responseBody = modifiedHtml;
    }

    // 创建响应
    const modifiedHeaders = new Headers();
    
    // 复制安全的响应头
    for (const [key, value] of response.headers.entries()) {
      const lowerKey = key.toLowerCase();
      if (!['content-encoding', 'content-length', 'connection'].includes(lowerKey)) {
        modifiedHeaders.set(key, value);
      }
    }

    // 添加CORS头部
    modifiedHeaders.set('Access-Control-Allow-Origin', '*');
    modifiedHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    modifiedHeaders.set('Access-Control-Allow-Headers', '*');
    modifiedHeaders.set('Cache-Control', 'no-cache');

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: modifiedHeaders
    });

  } catch (error) {
    console.error('代理执行失败:', error);
    return utils.errorResponse(`代理服务错误: ${error.message}`, 500);
  }
}

// 重写HTML内容中的URL
function rewriteHtmlContent(html, originalUrl, proxyOrigin) {
  const originalUrlObj = new URL(originalUrl);
  const baseUrl = originalUrlObj.origin;

  // 替换各种URL模式
  let modifiedHtml = html;

  // 替换绝对路径
  modifiedHtml = modifiedHtml.replace(
    /(?:href|src|action)=["']\/([^"']*?)["']/g,
    (match, path) => {
      const absoluteUrl = `${baseUrl}/${path}`;
      const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(absoluteUrl)}`;
      return match.replace(`/${path}`, proxyUrl);
    }
  );

  // 替换完整URL
  modifiedHtml = modifiedHtml.replace(
    /(?:href|src|action)=["'](https?:\/\/[^"']+)["']/g,
    (match, url) => {
      // 只代理白名单中的域名
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const shouldProxy = ALLOWED_DOMAINS.some(domain =>
          hostname === domain || hostname.endsWith('.' + domain)
        );
        
        if (shouldProxy) {
          const proxyUrl = `${proxyOrigin}/api/proxy/${encodeURIComponent(url)}`;
          return match.replace(url, proxyUrl);
        }
      } catch (e) {
        // 忽略无效URL
      }
      return match;
    }
  );

  return modifiedHtml;
}

// 健康检查
export async function proxyHealthCheckHandler(request, env) {
  try {
    const testUrl = 'https://www.javbus.com/robots.txt';
    const response = await fetch(testUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });

    return utils.successResponse({
      healthy: response.ok || response.status === 404,
      statusCode: response.status,
      allowedDomains: ALLOWED_DOMAINS,
      timestamp: Date.now()
    });
  } catch (error) {
    return utils.successResponse({
      healthy: false,
      error: error.message,
      allowedDomains: ALLOWED_DOMAINS,
      timestamp: Date.now()
    });
  }
}

// 统计信息
export async function proxyStatsHandler(request, env) {
  // 简化的统计信息
  return utils.successResponse({
    allowedDomains: ALLOWED_DOMAINS,
    totalDomains: ALLOWED_DOMAINS.length,
    service: 'active',
    timestamp: Date.now()
  });
}

export default {
  proxyHandler,
  proxyHealthCheckHandler,
  proxyStatsHandler
};