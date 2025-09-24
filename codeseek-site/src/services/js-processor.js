/**
 * JavaScript内容处理器 - 处理JS中的URL引用和API调用
 */

import { CONFIG } from '../config.js';
import { URLUtils, StringUtils } from '../utils.js';
import URLRewriter from './url-rewriter.js';

class JSProcessor {
  constructor(targetHostname, proxyHostname) {
    this.targetHostname = targetHostname;
    this.proxyHostname = proxyHostname;
    this.proxyPath = `/proxy/${targetHostname}`;
    this.urlRewriter = new URLRewriter(targetHostname, proxyHostname);
  }

  /**
   * 处理JavaScript内容
   */
  async process(js, baseURL) {
    if (!js || typeof js !== 'string') {
      return js;
    }

    try {
      let processedJS = js;

      // 处理字符串中的URL
      if (CONFIG.PROCESSORS.JS.REWRITE_URLS) {
        processedJS = this.rewriteStringURLs(processedJS);
      }
      
      // 处理API端点
      if (CONFIG.PROCESSORS.JS.HANDLE_APIS) {
        processedJS = this.rewriteAPIEndpoints(processedJS);
      }
      
      // 处理模块导入
      if (CONFIG.PROCESSORS.JS.PROCESS_MODULES) {
        processedJS = this.rewriteModuleImports(processedJS);
      }
      
      // 处理动态导入
      processedJS = this.rewriteDynamicImports(processedJS);
      
      // 处理fetch和XMLHttpRequest调用
      processedJS = this.rewriteNetworkCalls(processedJS);
      
      // 处理Location和History API
      processedJS = this.rewriteNavigationAPIs(processedJS);
      
      // 处理WebSocket连接
      processedJS = this.rewriteWebSocketURLs(processedJS);
      
      // 安全过滤
      if (CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS) {
        processedJS = this.sanitizeJavaScript(processedJS);
      }

      return processedJS;

    } catch (error) {
      console.error('JavaScript processing error:', error);
      return js; // 返回原始内容作为后备
    }
  }

  /**
   * 重写字符串中的URL
   */
  rewriteStringURLs(js) {
    const escapedHostname = StringUtils.escapeRegex(this.targetHostname);
    const escapedProxyPath = StringUtils.escapeRegex(this.proxyPath);
    
    // 处理双引号字符串中的完整URL
    js = js.replace(
      new RegExp(`(")https?:\\/\\/${escapedHostname}([^"]*)(")`, 'g'),
      (match, q1, path, q2) => {
        const newURL = `https://${this.proxyHostname}${this.proxyPath}${path || ''}`;
        return `${q1}${newURL}${q2}`;
      }
    );

    // 处理单引号字符串中的完整URL
    js = js.replace(
      new RegExp(`(')https?:\\/\\/${escapedHostname}([^']*)(')`, 'g'),
      (match, q1, path, q2) => {
        const newURL = `https://${this.proxyHostname}${this.proxyPath}${path || ''}`;
        return `${q1}${newURL}${q2}`;
      }
    );

    // 处理模板字符串中的URL
    js = js.replace(
      new RegExp(`(\`)([^\`]*https?:\\/\\/${escapedHostname}[^\`]*)(\`)`, 'g'),
      (match, q1, content, q2) => {
        const rewrittenContent = content.replace(
          new RegExp(`https?:\\/\\/${escapedHostname}`, 'g'),
          `https://${this.proxyHostname}${this.proxyPath}`
        );
        return `${q1}${rewrittenContent}${q2}`;
      }
    );

    // 处理协议相对URL
    js = js.replace(
      new RegExp(`(")\/\/${escapedHostname}([^"]*)(")`, 'g'),
      (match, q1, path, q2) => {
        const newURL = `https://${this.proxyHostname}${this.proxyPath}${path || ''}`;
        return `${q1}${newURL}${q2}`;
      }
    );
    
    js = js.replace(
      new RegExp(`(')\/\/${escapedHostname}([^']*)(')`, 'g'),
      (match, q1, path, q2) => {
        const newURL = `https://${this.proxyHostname}${this.proxyPath}${path || ''}`;
        return `${q1}${newURL}${q2}`;
      }
    );

    // 处理相对路径URL，避免重复处理已经是代理路径的URL
    js = js.replace(
      /(["'])(\/[^"']*)/g,
      (match, quote, path) => {
        // 排除已经是代理路径的URL
        if (path.startsWith(this.proxyPath)) {
          return match;
        }
        const newPath = `${this.proxyPath}${path}`;
        return `${quote}${newPath}`;
      }
    );

    return js;
  }

  /**
   * 重写API端点
   */
  rewriteAPIEndpoints(js) {
    // 常见的API配置模式
    js = js.replace(
      /(\w+(?:Url|URL|url|endpoint|baseUrl|apiUrl)\s*[:=]\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );
    
    // axios配置
    js = js.replace(
      /(baseURL\s*:\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );
    
    // fetch调用
    js = js.replace(
      /(fetch\s*\(\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );
    
    // XMLHttpRequest.open调用
    js = js.replace(
      /(\.open\s*\(\s*["']\w+["']\s*,\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );

    return js;
  }

  /**
   * 重写模块导入
   */
  rewriteModuleImports(js) {
    // ES6 import语句
    js = js.replace(
      /import\s+(?:[^'"]*\s+from\s+)?(["'])([^"']+)\1/g,
      (match, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return match.replace(path, rewrittenPath);
      }
    );

    // ES6 export语句
    js = js.replace(
      /export\s+(?:[^'"]*\s+from\s+)?(["'])([^"']+)\1/g,
      (match, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return match.replace(path, rewrittenPath);
      }
    );

    // CommonJS require
    js = js.replace(
      /require\s*\(\s*(["'])([^"']+)\1\s*\)/g,
      (match, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return `require(${quote}${rewrittenPath}${quote})`;
      }
    );

    return js;
  }

  /**
   * 重写动态导入
   */
  rewriteDynamicImports(js) {
    // import()动态导入
    js = js.replace(
      /import\s*\(\s*(["'])([^"']+)\1\s*\)/g,
      (match, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return `import(${quote}${rewrittenPath}${quote})`;
      }
    );

    // 模板字符串中的动态导入
    js = js.replace(
      /import\s*\(\s*`([^`]+)`\s*\)/g,
      (match, path) => {
        const escapedHostname = StringUtils.escapeRegex(this.targetHostname);
        const rewrittenPath = path.replace(
          new RegExp(`https?:\\/\\/${escapedHostname}`, 'g'),
          `https://${this.proxyHostname}${this.proxyPath}`
        );
        return `import(\`${rewrittenPath}\`)`;
      }
    );

    return js;
  }

  /**
   * 重写网络调用
   */
  rewriteNetworkCalls(js) {
    // fetch调用的更复杂处理
    js = js.replace(
      /fetch\s*\(\s*([^,)]+)(?:\s*,\s*([^)]+))?\s*\)/g,
      (match, urlParam, optionsParam) => {
        // 这里需要更智能的处理，因为URL可能是变量
        return match; // 暂时保持原样，由注入的脚本处理
      }
    );

    return js;
  }

  /**
   * 重写导航API
   */
  rewriteNavigationAPIs(js) {
    // window.location赋值
    js = js.replace(
      /((?:window\.)?location(?:\.[a-zA-Z]+)?\s*=\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );

    // history.pushState和replaceState
    js = js.replace(
      /(history\.(?:pushState|replaceState)\s*\([^,]*,\s*[^,]*,\s*)(["'])([^"']*)\2/g,
      (match, prefix, quote, url) => {
        const rewrittenURL = this.urlRewriter.rewriteURL(url);
        return `${prefix}${quote}${rewrittenURL}${quote}`;
      }
    );

    return js;
  }

  /**
   * 重写WebSocket URL
   */
  rewriteWebSocketURLs(js) {
    // WebSocket构造函数
    js = js.replace(
      /new\s+WebSocket\s*\(\s*(["'])([^"']+)\1/g,
      (match, quote, url) => {
        let rewrittenURL = url;
        
        // 处理WebSocket协议
        if (url.includes(this.targetHostname)) {
          const escapedHostname = StringUtils.escapeRegex(this.targetHostname);
          rewrittenURL = url.replace(
            new RegExp(`wss?:\\/\\/${escapedHostname}`, 'g'),
            `wss://${this.proxyHostname}${this.proxyPath}`
          );
        }
        
        return `new WebSocket(${quote}${rewrittenURL}${quote}`;
      }
    );

    return js;
  }

  /**
   * 安全过滤JavaScript
   */
  sanitizeJavaScript(js) {
    // 移除或替换潜在的恶意代码模式
    const maliciousPatterns = [
      // 危险的eval调用
      {
        pattern: /eval\s*\(\s*["'].*(?:document\.write|innerHTML|outerHTML).*["']\s*\)/gi,
        replacement: '/* Blocked potentially malicious eval */'
      },
      // 危险的Function构造器
      {
        pattern: /new\s+Function\s*\(\s*["'].*(?:document\.write|innerHTML).*["']\s*\)/gi,
        replacement: '/* Blocked potentially malicious Function constructor */'
      },
      // 可疑的document.write调用
      {
        pattern: /document\.write\s*\(\s*["'].*<script.*["']\s*\)/gi,
        replacement: '/* Blocked potentially malicious document.write */'
      }
    ];

    maliciousPatterns.forEach(({ pattern, replacement }) => {
      js = js.replace(pattern, replacement);
    });

    // 过滤广告相关的JavaScript
    if (CONFIG.SECURITY.BLOCK_ADS) {
      const adPatterns = [
        // Google AdSense
        /googletag\.cmd\.push|googletag\.display|adsbygoogle/gi,
        // 其他广告网络
        /doubleclick\.net|googleadservices\.com|googlesyndication\.com/gi
      ];

      adPatterns.forEach(pattern => {
        js = js.replace(pattern, '/* Ad code blocked */');
      });
    }

    return js;
  }

  /**
   * 处理JSON配置
   */
  processJSONConfig(js) {
    // 查找并处理JSON配置对象中的URL
    const jsonConfigPattern = /(\{[^{}]*["'](?:url|endpoint|baseUrl|apiUrl)["'][^{}]*\})/g;
    
    return js.replace(jsonConfigPattern, (match) => {
      try {
        // 尝试解析JSON并重写URL
        const config = JSON.parse(match);
        let modified = false;
        
        Object.keys(config).forEach(key => {
          if (typeof config[key] === 'string' && 
              (key.toLowerCase().includes('url') || key === 'endpoint')) {
            config[key] = this.urlRewriter.rewriteURL(config[key]);
            modified = true;
          }
        });
        
        return modified ? JSON.stringify(config) : match;
      } catch (error) {
        return match;
      }
    });
  }

  /**
   * 处理Service Worker注册
   */
  processServiceWorker(js) {
    // 重写Service Worker注册路径
    js = js.replace(
      /(navigator\.serviceWorker\.register\s*\(\s*)(["'])([^"']+)\2/g,
      (match, prefix, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return `${prefix}${quote}${rewrittenPath}${quote}`;
      }
    );

    return js;
  }

  /**
   * 处理Web Worker
   */
  processWebWorkers(js) {
    // 重写Web Worker脚本路径
    js = js.replace(
      /new\s+Worker\s*\(\s*(["'])([^"']+)\1/g,
      (match, quote, path) => {
        const rewrittenPath = this.urlRewriter.rewriteURL(path);
        return `new Worker(${quote}${rewrittenPath}${quote}`;
      }
    );

    return js;
  }

  /**
   * 优化JavaScript性能
   */
  optimizeJavaScript(js) {
    if (!CONFIG.DEBUG) {
      // 移除单行注释（保留重要注释）
      js = js.replace(/\/\/(?!\s*@|!\s).*$/gm, '');
      
      // 移除多行注释（保留重要注释）
      js = js.replace(/\/\*(?!\s*!)[^*]*\*+(?:[^/*][^*]*\*+)*\//g, '');
      
      // 移除多余的空白字符（保持换行符以避免ASI问题）
      js = js.replace(/[ \t]+/g, ' ');
      js = js.replace(/\n\s+/g, '\n');
      js = js.replace(/\s+\n/g, '\n');
      
      // 移除多余的分号
      js = js.replace(/;;+/g, ';');
    }

    return js;
  }

  /**
   * 添加错误处理包装
   */
  addErrorHandling(js) {
    // 为整个脚本添加try-catch包装（仅在必要时）
    if (js.includes('throw ') || js.includes('new Error(')) {
      return `
        try {
          ${js}
        } catch (proxyError) {
          console.warn('Proxy script error:', proxyError);
        }
      `;
    }
    
    return js;
  }
}

export default JSProcessor;