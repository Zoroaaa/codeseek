/**
 * HTML内容处理器 - 智能URL重写和内容优化
 */

import { CONFIG } from '../config.js';
import { URLUtils, StringUtils } from '../utils.js';
import URLRewriter from './url-rewriter.js';

class HTMLProcessor {
  constructor(targetHostname, proxyHostname) {
    this.targetHostname = targetHostname;
    this.proxyHostname = proxyHostname;
    this.proxyPath = `/proxy/${targetHostname}`;
    this.urlRewriter = new URLRewriter(targetHostname, proxyHostname);
  }

  /**
   * 处理HTML内容
   */
  async process(html, baseURL) {
    if (!html || typeof html !== 'string') {
      return html;
    }

    try {
      let processedHTML = html;

      // 基础URL重写
      processedHTML = this.rewriteAbsoluteURLs(processedHTML);
      processedHTML = this.rewriteRelativeURLs(processedHTML);
      processedHTML = this.rewriteProtocolRelativeURLs(processedHTML);
      
      // 特殊属性处理
      processedHTML = this.rewriteSrcsets(processedHTML);
      processedHTML = this.rewriteInlineStyles(processedHTML);
      processedHTML = this.rewriteMetaTags(processedHTML);
      
      // 表单处理
      processedHTML = this.processFormActions(processedHTML);
      
      // 特殊链接保护
      processedHTML = this.protectSpecialLinks(processedHTML);
      
      // 页面变形防护
      processedHTML = this.preventPageDeformation(processedHTML);
      
      // 安全过滤
      if (CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS) {
        processedHTML = this.sanitizeContent(processedHTML);
      }
      
      // 注入代理脚本
      if (CONFIG.PROCESSORS.HTML.INJECT_PROXY_SCRIPT) {
        processedHTML = this.injectProxyScript(processedHTML);
      }

      return processedHTML;

    } catch (error) {
      console.error('HTML processing error:', error);
      return html; // 返回原始内容作为后备
    }
  }

  /**
   * 重写绝对URL
   */
  rewriteAbsoluteURLs(html) {
    const urlAttributes = ['href', 'src', 'action', 'poster', 'data-src', 'data-href', 'data-original', 'data-lazy'];
    const escapedHostname = StringUtils.escapeRegex(this.targetHostname);
    
    urlAttributes.forEach(attr => {
      const pattern = new RegExp(
        '(' + attr + '\\s*=\\s*)(["\']?)https?:\\/\\/' + escapedHostname + '([^"\'\\s>]*)',
        'gi'
      );
      
      html = html.replace(pattern, (match, attrPart, quote, path) => {
        const newURL = 'https://' + this.proxyHostname + this.proxyPath + (path || '');
        return attrPart + quote + newURL;
      });
    });

    return html;
  }

  /**
   * 重写相对URL
   */
  rewriteRelativeURLs(html) {
    const urlAttributes = ['href', 'src', 'action', 'poster', 'data-src', 'data-href', 'data-original', 'data-lazy'];
    
    urlAttributes.forEach(attr => {
      const pattern = new RegExp(
        '(' + attr + '\\s*=\\s*)(["\']?)(\\/[^"\'\\s>]*)',
        'gi'
      );
      
      html = html.replace(pattern, (match, attrPart, quote, path) => {
        // 排除已经是代理路径的URL和协议相对URL
        if (path.startsWith(this.proxyPath) || path.startsWith('//')) {
          return match;
        }
        
        const newURL = this.proxyPath + path;
        return attrPart + quote + newURL;
      });
    });

    return html;
  }

  /**
   * 重写协议相对URL
   */
  rewriteProtocolRelativeURLs(html) {
    const urlAttributes = ['href', 'src', 'action', 'poster', 'data-src', 'data-href'];
    const escapedHostname = StringUtils.escapeRegex(this.targetHostname);
    
    urlAttributes.forEach(attr => {
      const pattern = new RegExp(
        '(' + attr + '\\s*=\\s*)(["\']?)\\/\\/' + escapedHostname + '([^"\'\\s>]*)',
        'gi'
      );
      
      html = html.replace(pattern, (match, attrPart, quote, path) => {
        const newURL = 'https://' + this.proxyHostname + this.proxyPath + (path || '');
        return attrPart + quote + newURL;
      });
    });

    return html;
  }

  /**
   * 处理响应式图片的srcset属性
   */
  rewriteSrcsets(html) {
    return html.replace(/srcset\s*=\s*(["'])([^"'>]*)/gi, (match, quote, srcset) => {
      const rewrittenSrcset = srcset.split(',').map(src => {
        const parts = src.trim().split(/\s+/);
        if (parts[0]) {
          parts[0] = this.urlRewriter.rewriteURL(parts[0]);
        }
        return parts.join(' ');
      }).join(', ');
      
      return 'srcset=' + quote + rewrittenSrcset;
    });
  }

  /**
   * 处理内联样式中的URL
   */
  rewriteInlineStyles(html) {
    return html.replace(/style\s*=\s*(["'])([^"'>]*)/gi, (match, quote, style) => {
      const rewrittenStyle = this.rewriteCSSURLs(style);
      return 'style=' + quote + rewrittenStyle;
    });
  }

  /**
   * 处理CSS中的URL引用
   */
  rewriteCSSURLs(css) {
    return css.replace(/url\s*\(\s*([^)]+)\s*\)/gi, (match, url) => {
      // 移除引号并清理
      const cleanURL = url.replace(/^["']|["']$/g, '').trim();
      const rewrittenURL = this.urlRewriter.rewriteURL(cleanURL);
      return 'url(' + rewrittenURL + ')';
    });
  }

  /**
   * 重写meta标签
   */
  rewriteMetaTags(html) {
    // 处理refresh meta标签
    html = html.replace(
      /<meta\s+http-equiv\s*=\s*(["']?)refresh\1[^>]+content\s*=\s*(["']?)([^"'>]+)/gi,
      (match, q1, q2, content) => {
        const rewrittenContent = content.replace(
          /url\s*=\s*([^;\s]+)/i,
          (urlMatch, url) => {
            const rewrittenURL = this.urlRewriter.rewriteURL(url);
            return 'url=' + rewrittenURL;
          }
        );
        return match.replace(/content\s*=\s*(["']?)[^"'>]+/, 'content=' + q2 + rewrittenContent);
      }
    );

    // 处理og:url
    html = html.replace(
      /(<meta\s+property\s*=\s*["']?og:url["']?[^>]+content\s*=\s*)(["']?)([^"'>]+)/gi,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return prefix + quote + rewrittenURL;
      }
    );
    
    // 处理og:image
    html = html.replace(
      /(<meta\s+property\s*=\s*["']?og:image["']?[^>]+content\s*=\s*)(["']?)([^"'>]+)/gi,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return prefix + quote + rewrittenURL;
      }
    );
    
    // 处理twitter:image
    html = html.replace(
      /(<meta\s+name\s*=\s*["']?twitter:image["']?[^>]+content\s*=\s*)(["']?)([^"'>]+)/gi,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return prefix + quote + rewrittenURL;
      }
    );
    
    // 处理canonical链接
    html = html.replace(
      /(<link\s+rel\s*=\s*["']?canonical["']?[^>]+href\s*=\s*)(["']?)([^"'>]+)/gi,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return prefix + quote + rewrittenURL;
      }
    );

    return html;
  }

  /**
   * 处理表单action
   */
  processFormActions(html) {
    return html.replace(
      /<form([^>]+action\s*=\s*(["']?)([^"'>]+))/gi,
      (match, formAttrs, quote, action) => {
        const rewrittenAction = this.urlRewriter.rewriteURL(action);
        return '<form' + formAttrs.replace(
          /action\s*=\s*(["']?)[^"'>]+/,
          'action=' + quote + rewrittenAction
        );
      }
    );
  }

  /**
   * 保护特殊链接（磁力链接、thunder链接等）
   */
  protectSpecialLinks(html) {
    if (!CONFIG.SPECIAL_HANDLING.MAGNET_LINKS) {
      return html;
    }

    // 处理magnet链接
    html = html.replace(
      /(href\s*=\s*)(["']?)https:\/\/[^"'\s>]*\/proxy\/[^"'\s>]*(magnet:[^"'\s>]*)/gi,
      (match, attrPart, quote, specialURL) => {
        return attrPart + quote + decodeURIComponent(specialURL);
      }
    );
    
    // 处理thunder链接
    html = html.replace(
      /(href\s*=\s*)(["']?)https:\/\/[^"'\s>]*\/proxy\/[^"'\s>]*(thunder:[^"'\s>]*)/gi,
      (match, attrPart, quote, specialURL) => {
        return attrPart + quote + decodeURIComponent(specialURL);
      }
    );
    
    // 处理ed2k链接
    html = html.replace(
      /(href\s*=\s*)(["']?)https:\/\/[^"'\s>]*\/proxy\/[^"'\s>]*(ed2k:[^"'\s>]*)/gi,
      (match, attrPart, quote, specialURL) => {
        return attrPart + quote + decodeURIComponent(specialURL);
      }
    );
    
    // 处理ftp链接
    html = html.replace(
      /(href\s*=\s*)(["']?)https:\/\/[^"'\s>]*\/proxy\/[^"'\s>]*(ftp:[^"'\s>]*)/gi,
      (match, attrPart, quote, specialURL) => {
        return attrPart + quote + decodeURIComponent(specialURL);
      }
    );

    return html;
  }

  /**
   * 防止页面变形
   */
  preventPageDeformation(html) {
    // 保护viewport meta标签
    if (!html.includes('<meta name="viewport"') && !html.includes('<meta name=viewport')) {
      html = html.replace(
        /<head[^>]*>/i,
        '$&\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">'
      );
    }

    // 添加基础样式保护
    const protectionCSS = 
    '<style>\n' +
    '/* Proxy Protection Styles */\n' +
    'html, body { \n' +
    '  max-width: 100% !important; \n' +
    '  overflow-x: auto !important; \n' +
    '}\n' +
    'img, video, iframe { \n' +
    '  max-width: 100% !important; \n' +
    '  height: auto !important; \n' +
    '}\n' +
    'table { \n' +
    '  word-wrap: break-word !important; \n' +
    '  table-layout: fixed !important; \n' +
    '}\n' +
    '.proxy-protection { \n' +
    '  box-sizing: border-box !important; \n' +
    '}\n' +
    '</style>';

    // 在head标签内注入保护样式
    html = html.replace(/<\/head>/i, protectionCSS + '\n</head>');

    return html;
  }

  /**
   * 安全内容过滤
   */
  sanitizeContent(html) {
    // 移除潜在的恶意脚本
    const maliciousPatterns = [
      // 危险的JavaScript模式
      /javascript\s*:\s*[^"'>\s]+/gi,
      /on\w+\s*=\s*["'][^"']*(?:eval|alert|confirm|prompt|document\.write)[^"']*["']/gi,
      // 危险的iframe
      /<iframe[^>]*src\s*=\s*["'](?:javascript|data:text\/html)[^"']*["'][^>]*>/gi,
      // 潜在的XSS
      /<script[^>]*>[\s\S]*?(?:eval|alert|confirm|prompt)[\s\S]*?<\/script>/gi
    ];

    maliciousPatterns.forEach(pattern => {
      html = html.replace(pattern, '<!-- Blocked potentially malicious content -->');
    });

    // 过滤广告相关内容
    if (CONFIG.SECURITY.BLOCK_ADS) {
      const adPatterns = [
        /<!--\s*google_ad_client[\s\S]*?-->/gi,
        /<script[^>]*(?:googlesyndication|doubleclick|googletagservices)[\s\S]*?<\/script>/gi,
        /<ins[^>]*adsbygoogle[^>]*>[\s\S]*?<\/ins>/gi
      ];

      adPatterns.forEach(pattern => {
        html = html.replace(pattern, '<!-- Ad blocked -->');
      });
    }

    return html;
  }

  /**
   * 注入代理辅助脚本
   */
  injectProxyScript(html) {
    const proxyScript = 
    '<script>\n' +
    '(function() {\n' +
    '  "use strict";\n' +
    '  \n' +
    '  // 配置\n' +
    '  const PROXY_CONFIG = {\n' +
    '    targetHostname: "' + this.targetHostname + '",\n' +
    '    proxyHostname: "' + this.proxyHostname + '",\n' +
    '    proxyPath: "' + this.proxyPath + '",\n' +
    '    specialProtocols: ["magnet:", "thunder:", "ed2k:", "ftp:", "ftps:"]\n' +
    '  };\n' +
    '  \n' +
    '  // URL处理函数\n' +
    '  function processURL(url) {\n' +
    '    if (!url || typeof url !== "string") return url;\n' +
    '    \n' +
    '    // 保护特殊协议\n' +
    '    for (const protocol of PROXY_CONFIG.specialProtocols) {\n' +
    '      if (url.startsWith(protocol)) {\n' +
    '        return url;\n' +
    '      }\n' +
    '    }\n' +
    '    \n' +
    '    // 处理绝对URL\n' +
    '    if (url.includes(PROXY_CONFIG.targetHostname)) {\n' +
    '      const escapedHostname = PROXY_CONFIG.targetHostname.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");\n' +
    '      const regex = new RegExp("https?://" + escapedHostname, "g");\n' +
    '      return url.replace(regex, "https://" + PROXY_CONFIG.proxyHostname + PROXY_CONFIG.proxyPath);\n' +
    '    }\n' +
    '    \n' +
    '    // 处理相对URL\n' +
    '    if (url.startsWith("/") && !url.startsWith(PROXY_CONFIG.proxyPath)) {\n' +
    '      return PROXY_CONFIG.proxyPath + url;\n' +
    '    }\n' +
    '    \n' +
    '    return url;\n' +
    '  }\n' +
    '  \n' +
    '  // 拦截fetch请求\n' +
    '  const originalFetch = window.fetch;\n' +
    '  window.fetch = function(url, options) {\n' +
    '    const processedURL = processURL(url);\n' +
    '    return originalFetch.call(this, processedURL, options);\n' +
    '  };\n' +
    '  \n' +
    '  // 拦截XMLHttpRequest\n' +
    '  const originalOpen = XMLHttpRequest.prototype.open;\n' +
    '  XMLHttpRequest.prototype.open = function(method, url) {\n' +
    '    const processedURL = processURL(url);\n' +
    '    const args = Array.prototype.slice.call(arguments);\n' +
    '    args[1] = processedURL;\n' +
    '    return originalOpen.apply(this, args);\n' +
    '  };\n' +
    '  \n' +
    '  // 处理动态创建的元素\n' +
    '  const observer = new MutationObserver(function(mutations) {\n' +
    '    mutations.forEach(function(mutation) {\n' +
    '      mutation.addedNodes.forEach(function(node) {\n' +
    '        if (node.nodeType === Node.ELEMENT_NODE) {\n' +
    '          processElement(node);\n' +
    '        }\n' +
    '      });\n' +
    '    });\n' +
    '  });\n' +
    '  \n' +
    '  function processElement(element) {\n' +
    '    // 处理链接\n' +
    '    const links = element.querySelectorAll ? element.querySelectorAll("a[href], link[href]") : [];\n' +
    '    links.forEach(function(link) {\n' +
    '      const href = link.getAttribute("href");\n' +
    '      if (href) {\n' +
    '        link.setAttribute("href", processURL(href));\n' +
    '      }\n' +
    '    });\n' +
    '    \n' +
    '    // 处理图片和媒体\n' +
    '    const media = element.querySelectorAll ? element.querySelectorAll("img[src], video[src], audio[src], source[src]") : [];\n' +
    '    media.forEach(function(item) {\n' +
    '      const src = item.getAttribute("src");\n' +
    '      if (src) {\n' +
    '        item.setAttribute("src", processURL(src));\n' +
    '      }\n' +
    '    });\n' +
    '    \n' +
    '    // 处理表单\n' +
    '    const forms = element.querySelectorAll ? element.querySelectorAll("form[action]") : [];\n' +
    '    forms.forEach(function(form) {\n' +
    '      const action = form.getAttribute("action");\n' +
    '      if (action) {\n' +
    '        form.setAttribute("action", processURL(action));\n' +
    '      }\n' +
    '    });\n' +
    '  }\n' +
    '  \n' +
    '  // 启动观察器\n' +
    '  if (document.body) {\n' +
    '    observer.observe(document.body, { childList: true, subtree: true });\n' +
    '  }\n' +
    '  \n' +
    '  // 处理已有元素\n' +
    '  if (document.readyState === "loading") {\n' +
    '    document.addEventListener("DOMContentLoaded", function() {\n' +
    '      processElement(document);\n' +
    '    });\n' +
    '  } else {\n' +
    '    processElement(document);\n' +
    '  }\n' +
    '  \n' +
    '  console.log("Proxy helper script loaded for", PROXY_CONFIG.targetHostname);\n' +
    '  \n' +
    '})();\n' +
    '</script>\n';

    // 在</head>前注入脚本
    if (html.includes('</head>')) {
      html = html.replace('</head>', proxyScript + '</head>');
    } else if (html.includes('<body')) {
      // 如果没有head标签，在body开始处注入
      html = html.replace(/(<body[^>]*>)/i, '$1' + proxyScript);
    } else {
      // 最后的后备方案
      html = proxyScript + html;
    }

    return html;
  }
}

export default HTMLProcessor;