// Enhanced Proxy Worker with Advanced URL Rewriting and Resource Optimization
// 版本: v3.1.0 - 移除CORS限制，只验证代理目标域名

/**
 * HTML内容处理器 - 智能重写所有URL引用
 */
class HTMLProcessor {
  constructor(proxyHostname, originHostname, proxyPath) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
  }

  /**
   * 处理HTML内容，重写所有URL引用
   */
  processHTML(html) {
    // 处理各种URL模式
    html = this.rewriteAbsoluteUrls(html);
    html = this.rewriteRelativeUrls(html);
    html = this.rewriteSrcsets(html);
    html = this.rewriteInlineStyles(html);
    html = this.rewriteMetaTags(html);
    html = this.injectProxyScript(html);
    
    return html;
  }

  /**
   * 重写绝对URL
   */
  rewriteAbsoluteUrls(html) {
    // 匹配 href, src, action 等属性中的URL
    const patterns = [
      // https://domain.com 格式
      new RegExp(`(href|src|action|poster|data-src|data-href)=(["']?)https?://${this.escapeRegex(this.proxyHostname)}([^"'\s>]*)`, 'gi'),
      // //domain.com 格式
      new RegExp(`(href|src|action|poster|data-src|data-href)=(["']?)//${this.escapeRegex(this.proxyHostname)}([^"'\s>]*)`, 'gi'),
    ];

    patterns.forEach(pattern => {
      html = html.replace(pattern, (match, attr, quote, path) => {
        const newUrl = `https://${this.originHostname}${this.proxyPath}${path || ''}`;
        return `${attr}=${quote}${newUrl}`;
      });
    });

    return html;
  }

  /**
   * 重写相对URL - 这是关键优化点
   */
  rewriteRelativeUrls(html) {
    // 处理以 / 开头的绝对路径
    html = html.replace(
      /(href|src|action|poster|data-src|data-href)=(["']?)(\/[^"'\s>]*)/gi,
      (match, attr, quote, path) => {
        // 排除已经是代理路径的URL
        if (path.startsWith(this.proxyPath)) {
          return match;
        }
        // 排除协议相对URL
        if (path.startsWith('//')) {
          return match;
        }
        // 转换为代理URL
        const newUrl = `${this.proxyPath}${path}`;
        return `${attr}=${quote}${newUrl}`;
      }
    );

    return html;
  }

  /**
   * 处理 srcset 属性（响应式图片）
   */
  rewriteSrcsets(html) {
    return html.replace(/srcset=(["']?)([^"'>]*)/gi, (match, quote, srcset) => {
      const rewrittenSrcset = srcset.split(',').map(src => {
        const parts = src.trim().split(/\s+/);
        if (parts[0]) {
          // 处理URL部分
          if (parts[0].startsWith('/')) {
            parts[0] = `${this.proxyPath}${parts[0]}`;
          } else if (parts[0].includes(this.proxyHostname)) {
            parts[0] = parts[0].replace(
              new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
              `https://${this.originHostname}${this.proxyPath}`
            );
          }
        }
        return parts.join(' ');
      }).join(', ');
      
      return `srcset=${quote}${rewrittenSrcset}`;
    });
  }

  /**
   * 处理内联样式中的URL
   */
  rewriteInlineStyles(html) {
    return html.replace(/style=(["']?)([^"'>]*)/gi, (match, quote, style) => {
      const rewrittenStyle = this.rewriteCSSUrls(style);
      return `style=${quote}${rewrittenStyle}`;
    });
  }

  /**
   * 处理CSS中的URL引用
   */
  rewriteCSSUrls(css) {
    // 处理 url() 函数
    return css.replace(/url\(([^)]+)\)/gi, (match, url) => {
      // 移除引号
      url = url.replace(/^["']|["']$/g, '').trim();
      
      if (url.startsWith('/')) {
        // 绝对路径
        url = `${this.proxyPath}${url}`;
      } else if (url.includes(this.proxyHostname)) {
        // 包含目标域名的完整URL
        url = url.replace(
          new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
          `https://${this.originHostname}${this.proxyPath}`
        );
      }
      
      return `url(${url})`;
    });
  }

  /**
   * 处理meta标签
   */
  rewriteMetaTags(html) {
    // 处理 refresh meta标签
    html = html.replace(
      /<meta\s+http-equiv=(["']?)refresh\1\s+content=(["']?)([^"'>]+)/gi,
      (match, q1, q2, content) => {
        const rewrittenContent = content.replace(
          /url=([^;\s]+)/i,
          (urlMatch, url) => {
            if (url.includes(this.proxyHostname)) {
              url = url.replace(
                new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
                `https://${this.originHostname}${this.proxyPath}`
              );
            } else if (url.startsWith('/')) {
              url = `${this.proxyPath}${url}`;
            }
            return `url=${url}`;
          }
        );
        return `<meta http-equiv=${q1}refresh${q1} content=${q2}${rewrittenContent}`;
      }
    );

    // 处理 og:url 等meta标签
    html = html.replace(
      /<meta\s+(?:property|name)=(["']?)og:(?:url|image)\1\s+content=(["']?)([^"'>]+)/gi,
      (match, q1, q2, content) => {
        if (content.includes(this.proxyHostname)) {
          content = content.replace(
            new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
            `https://${this.originHostname}${this.proxyPath}`
          );
        }
        return match.replace(/content=(["']?)[^"'>]+/, `content=${q2}${content}`);
      }
    );

    return html;
  }

  /**
   * 注入代理辅助脚本
   */
  injectProxyScript(html) {
    const proxyScript = `
    <script>
    (function() {
      // 拦截动态创建的请求
      const originalFetch = window.fetch;
      window.fetch = function(url, options) {
        const processedUrl = processProxyUrl(url);
        return originalFetch.call(this, processedUrl, options);
      };
      
      // 拦截 XMLHttpRequest
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url, ...args) {
        const processedUrl = processProxyUrl(url);
        return originalOpen.call(this, method, processedUrl, ...args);
      };
      
      // 处理URL的辅助函数
      function processProxyUrl(url) {
        if (typeof url === 'string') {
          // 处理相对URL
          if (url.startsWith('/') && !url.startsWith('${this.proxyPath}')) {
            return '${this.proxyPath}' + url;
          }
          // 处理包含目标域名的URL
          if (url.includes('${this.proxyHostname}')) {
            return url.replace(
              /https?:\\/\\/${this.escapeRegex(this.proxyHostname)}/g,
              'https://${this.originHostname}${this.proxyPath}'
            );
          }
        }
        return url;
      }
      
      // 修复 history API
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      
      history.pushState = function(state, title, url) {
        if (url && url.startsWith('/') && !url.startsWith('${this.proxyPath}')) {
          url = '${this.proxyPath}' + url;
        }
        return originalPushState.call(this, state, title, url);
      };
      
      history.replaceState = function(state, title, url) {
        if (url && url.startsWith('/') && !url.startsWith('${this.proxyPath}')) {
          url = '${this.proxyPath}' + url;
        }
        return originalReplaceState.call(this, state, title, url);
      };
    })();
    </script>
    `;

    // 在 </head> 前注入脚本
    if (html.includes('</head>')) {
      html = html.replace('</head>', proxyScript + '</head>');
    } else if (html.includes('<body')) {
      // 如果没有 head 标签，在 body 开始处注入
      html = html.replace(/(<body[^>]*>)/i, '$1' + proxyScript);
    }

    return html;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * CSS内容处理器
 */
class CSSProcessor {
  constructor(proxyHostname, originHostname, proxyPath, baseUrl) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
    this.baseUrl = baseUrl;
  }

  /**
   * 处理CSS内容
   */
  processCSS(css) {
    // 处理 @import 规则
    css = this.rewriteImports(css);
    
    // 处理 url() 函数
    css = this.rewriteUrls(css);
    
    // 处理字体引用
    css = this.rewriteFontFaces(css);
    
    return css;
  }

  /**
   * 重写 @import 规则
   */
  rewriteImports(css) {
    return css.replace(/@import\s+(?:url\()?([^);]+)(?:\))?/gi, (match, url) => {
      url = url.replace(/^["']|["']$/g, '').trim();
      const rewrittenUrl = this.processUrl(url);
      return `@import url("${rewrittenUrl}")`;
    });
  }

  /**
   * 重写 url() 函数
   */
  rewriteUrls(css) {
    return css.replace(/url\(([^)]+)\)/gi, (match, url) => {
      url = url.replace(/^["']|["']$/g, '').trim();
      const rewrittenUrl = this.processUrl(url);
      return `url("${rewrittenUrl}")`;
    });
  }

  /**
   * 重写 @font-face 规则中的URL
   */
  rewriteFontFaces(css) {
    return css.replace(/@font-face\s*{[^}]+}/gi, (match) => {
      return match.replace(/url\(([^)]+)\)/gi, (urlMatch, url) => {
        url = url.replace(/^["']|["']$/g, '').trim();
        const rewrittenUrl = this.processUrl(url);
        return `url("${rewrittenUrl}")`;
      });
    });
  }

  /**
   * 处理单个URL
   */
  processUrl(url) {
    // 处理data URL
    if (url.startsWith('data:')) {
      return url;
    }
    
    // 处理绝对URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (url.includes(this.proxyHostname)) {
        return url.replace(
          new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
          `https://${this.originHostname}${this.proxyPath}`
        );
      }
      return url;
    }
    
    // 处理协议相对URL
    if (url.startsWith('//')) {
      if (url.includes(this.proxyHostname)) {
        return url.replace(
          new RegExp(`//${this.escapeRegex(this.proxyHostname)}`, 'g'),
          `//${this.originHostname}${this.proxyPath}`
        );
      }
      return url;
    }
    
    // 处理绝对路径
    if (url.startsWith('/')) {
      return `${this.proxyPath}${url}`;
    }
    
    // 处理相对路径
    // 需要基于CSS文件的位置来解析
    if (this.baseUrl) {
      try {
        const base = new URL(this.baseUrl);
        const resolved = new URL(url, base);
        if (resolved.hostname === this.proxyHostname) {
          return `${this.proxyPath}${resolved.pathname}${resolved.search}${resolved.hash}`;
        }
        return resolved.href;
      } catch (e) {
        // URL解析失败，返回原URL
        return url;
      }
    }
    
    return url;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * JavaScript内容处理器
 */
class JSProcessor {
  constructor(proxyHostname, originHostname, proxyPath) {
    this.proxyHostname = proxyHostname;
    this.originHostname = originHostname;
    this.proxyPath = proxyPath || `/proxy/${proxyHostname}`;
  }

  /**
   * 处理JavaScript内容
   */
  processJS(js) {
    // 处理字符串中的URL
    js = this.rewriteStringUrls(js);
    
    // 处理API端点
    js = this.rewriteApiEndpoints(js);
    
    return js;
  }

  /**
   * 重写字符串中的URL
   */
  rewriteStringUrls(js) {
    // 匹配字符串中的URL
    const patterns = [
      // 完整URL
      new RegExp(`(["'\`])https?://${this.escapeRegex(this.proxyHostname)}([^"'\`]*)(["'\`])`, 'g'),
      // 协议相对URL
      new RegExp(`(["'\`])//${this.escapeRegex(this.proxyHostname)}([^"'\`]*)(["'\`])`, 'g'),
    ];

    patterns.forEach(pattern => {
      js = js.replace(pattern, (match, q1, path, q2) => {
        return `${q1}https://${this.originHostname}${this.proxyPath}${path}${q2}`;
      });
    });

    return js;
  }

  /**
   * 重写API端点
   */
  rewriteApiEndpoints(js) {
    // 匹配常见的API端点模式
    const apiPatterns = [
      /apiUrl\s*[:=]\s*(["'])([^"']+)(["'])/g,
      /baseUrl\s*[:=]\s*(["'])([^"']+)(["'])/g,
      /endpoint\s*[:=]\s*(["'])([^"']+)(["'])/g,
    ];

    apiPatterns.forEach(pattern => {
      js = js.replace(pattern, (match, q1, url, q2) => {
        if (url.startsWith('/') && !url.startsWith(this.proxyPath)) {
          url = `${this.proxyPath}${url}`;
        } else if (url.includes(this.proxyHostname)) {
          url = url.replace(
            new RegExp(`https?://${this.escapeRegex(this.proxyHostname)}`, 'g'),
            `https://${this.originHostname}${this.proxyPath}`
          );
        }
        return match.replace(/[:=]\s*(["'])[^"']+(["'])/, `:${q1}${url}${q2}`);
      });
    });

    return js;
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

/**
 * 主要的代理请求处理函数
 */
async function handleProxyRequest(request, env, targetHostname = null) {
  const url = new URL(request.url);
  const originHostname = url.hostname;
  const proxyHostname = targetHostname || env.PROXY_HOSTNAME;

  if (!proxyHostname) {
    return new Response(JSON.stringify({ error: "Proxy not configured" }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...getUnrestrictedCorsHeaders()
      }
    });
  }

  // 构建目标URL
  const targetUrl = new URL(request.url);
  targetUrl.host = proxyHostname;
  targetUrl.protocol = env.PROXY_PROTOCOL || 'https';

  // 创建新请求
  const newHeaders = new Headers(request.headers);
  newHeaders.set('Host', proxyHostname);
  newHeaders.set('Origin', `https://${proxyHostname}`);
  newHeaders.delete('cf-connecting-ip');
  newHeaders.delete('cf-ray');

  // 处理Referer
  const referer = newHeaders.get('referer');
  if (referer && referer.includes(originHostname)) {
    const newReferer = referer.replace(
      new RegExp(`https://${originHostname}/proxy/${proxyHostname}`, 'g'),
      `https://${proxyHostname}`
    );
    newHeaders.set('referer', newReferer);
  }

  // 发送请求
  const newRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: newHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    redirect: 'manual' // 手动处理重定向
  });

  let response = await fetch(newRequest);

  // 处理重定向
  if (response.status >= 301 && response.status <= 308) {
    const location = response.headers.get('location');
    if (location) {
      let newLocation = location;
      
      // 处理绝对URL重定向
      if (location.startsWith('http://') || location.startsWith('https://')) {
        const locationUrl = new URL(location);
        if (locationUrl.hostname === proxyHostname) {
          newLocation = `https://${originHostname}/proxy/${proxyHostname}${locationUrl.pathname}${locationUrl.search}${locationUrl.hash}`;
        }
      }
      // 处理相对URL重定向
      else if (location.startsWith('/')) {
        newLocation = `https://${originHostname}/proxy/${proxyHostname}${location}`;
      }
      
      const newHeaders = new Headers(response.headers);
      newHeaders.set('location', newLocation);
      
      // 添加无限制的CORS头
      Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }
  }

  // 获取内容类型
  const contentType = response.headers.get('content-type') || '';
  
  // 创建新的响应头
  const newResponseHeaders = new Headers(response.headers);
  
  // 添加无限制的CORS头
  Object.entries(getUnrestrictedCorsHeaders()).forEach(([key, value]) => {
    newResponseHeaders.set(key, value);
  });

  // 根据内容类型处理响应
  let processedBody = response.body;
  
  if (contentType.includes('text/html')) {
    // 处理HTML
    const html = await response.text();
    const processor = new HTMLProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
    const processedHtml = processor.processHTML(html);
    processedBody = processedHtml;
  } else if (contentType.includes('text/css') || contentType.includes('stylesheet')) {
    // 处理CSS
    const css = await response.text();
    const processor = new CSSProcessor(
      proxyHostname, 
      originHostname, 
      `/proxy/${proxyHostname}`,
      targetUrl.href
    );
    const processedCss = processor.processCSS(css);
    processedBody = processedCss;
  } else if (contentType.includes('javascript') || contentType.includes('application/json')) {
    // 处理JavaScript
    const js = await response.text();
    const processor = new JSProcessor(proxyHostname, originHostname, `/proxy/${proxyHostname}`);
    const processedJs = processor.processJS(js);
    processedBody = processedJs;
  }
  
  // 添加缓存控制
  if (contentType.includes('image/') || contentType.includes('font/')) {
    newResponseHeaders.set('Cache-Control', 'public, max-age=31536000'); // 1年缓存
  } else if (contentType.includes('text/css') || contentType.includes('javascript')) {
    newResponseHeaders.set('Cache-Control', 'public, max-age=86400'); // 1天缓存
  } else {
    newResponseHeaders.set('Cache-Control', 'public, max-age=3600'); // 1小时缓存
  }

  return new Response(processedBody, {
    status: response.status,
    statusText: response.statusText,
    headers: newResponseHeaders
  });
}

/**
 * 获取无限制的CORS头（移除所有CORS限制）
 */
function getUnrestrictedCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': '*'
  };
}

/**
 * 验证代理目标（只验证域名，不验证来源）
 */
function isValidProxyTarget(hostname, env) {
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

  const extraTargets = env.EXTRA_PROXY_TARGETS?.split(',').map(t => t.trim()) || [];
  const allAllowedTargets = [...allowedTargets, ...extraTargets];
  
  return allAllowedTargets.includes(hostname.toLowerCase());
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // OPTIONS请求快速响应（无限制CORS）
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          headers: getUnrestrictedCorsHeaders(),
          status: 204
        });
      }

      // API路由
      if (url.pathname === '/api/health' || url.pathname === '/_health') {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '3.1.0',
          features: {
            htmlProcessing: true,
            cssProcessing: true,
            jsProcessing: true,
            smartCaching: true,
            resourceOptimization: true,
            unrestrictedCors: true
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...getUnrestrictedCorsHeaders()
          }
        });
      }

      if (url.pathname === '/api/status') {
        return new Response(JSON.stringify({
          status: 'enabled',
          endpoints: 373,
          timestamp: Date.now(),
          version: '3.1.0',
          cors: 'unrestricted'
        }), {
          headers: {
            'Content-Type': 'application/json',
            ...getUnrestrictedCorsHeaders()
          }
        });
      }

      // 动态代理路由
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
              ...getUnrestrictedCorsHeaders()
            }
          });
        }

        if (!isValidProxyTarget(targetHostname, env)) {
          return new Response(JSON.stringify({
            error: 'Forbidden proxy target',
            hostname: targetHostname
          }), { 
            status: 403,
            headers: { 
              'Content-Type': 'application/json',
              ...getUnrestrictedCorsHeaders()
            }
          });
        }

        // 重构路径
        let targetPath = '/';
        if (pathParts.length > 1) {
          const pathSegments = pathParts.slice(1).filter(segment => segment);
          if (pathSegments.length > 0) {
            targetPath = '/' + pathSegments.join('/');
          }
        }

        // 保留查询参数
        if (url.search) {
          targetPath += url.search;
        }
        if (url.hash) {
          targetPath += url.hash;
        }

        // 重写请求URL
        const newUrl = new URL(request.url);
        newUrl.pathname = targetPath;

        const modifiedRequest = new Request(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body
        });

        return await handleProxyRequest(modifiedRequest, env, targetHostname);
      }

      // 主代理逻辑
      return await handleProxyRequest(request, env);

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Proxy service error',
        message: env.DEBUG === 'true' ? error.message : 'Internal server error',
        version: '3.1.0'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getUnrestrictedCorsHeaders()
        }
      });
    }
  },
};