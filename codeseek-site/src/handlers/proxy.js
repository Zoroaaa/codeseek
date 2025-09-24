/**
 * 代理处理器 - 核心代理功能实现
 */

import { CONFIG } from '../config.js';
import { URLUtils, ErrorUtils, PerformanceUtils, ContentTypeUtils } from '../utils.js';
import { enhanceResponse } from '../middleware.js';
import HTMLProcessor from '../services/html-processor.js';
import CSSProcessor from '../services/css-processor.js';
import JSProcessor from '../services/js-processor.js';
import URLRewriter from '../services/url-rewriter.js';
import RedirectHandler from '../services/redirect-handler.js';
import CacheManager from '../services/cache-manager.js';
import SecurityHandler from '../services/security-handler.js';

class ProxyHandler {
  /**
   * 处理动态代理请求 /proxy/:hostname/*
   */
  static async handleDynamicProxy(request, env, ctx) {
    const timer = PerformanceUtils.createTimer();
    
    try {
      const url = new URL(request.url);
      const hostname = request.params.hostname;
      const wildcard = request.params.wildcard || '';
      
      if (!hostname) {
        return ErrorUtils.createErrorResponse('Missing hostname', 400);
      }
      
      if (!CONFIG.isValidProxyTarget(hostname)) {
        return ErrorUtils.createErrorResponse(
          `Forbidden proxy target: ${hostname}`, 
          403, 
          { allowedTargets: CONFIG.ALLOWED_TARGETS.length }
        );
      }
      
      // 构建目标URL
      let targetPath = '/';
      if (wildcard) {
        targetPath = '/' + wildcard;
      }
      
      // 保留查询参数
      if (url.search) {
        targetPath += url.search;
      }
      
      const targetURL = `https://${hostname}${targetPath}`;
      
      if (CONFIG.DEBUG) {
        console.log(`Proxying to: ${targetURL}`);
        timer.mark('URL constructed');
      }
      
      return await this.proxyRequest(request, targetURL, hostname, env, ctx, timer);
      
    } catch (error) {
      ErrorUtils.logError(error, 'handleDynamicProxy');
      return ErrorUtils.createErrorResponse(error.message, 500);
    }
  }
  
  /**
   * 处理主代理请求 /*
   */
  static async handleMainProxy(request, env, ctx) {
    const timer = PerformanceUtils.createTimer();
    
    try {
      // 检查是否允许直接访问
      if (!CONFIG.ALLOW_DIRECT_ACCESS) {
        return ErrorUtils.createErrorResponse('Direct access not allowed', 403);
      }
      
      const proxyHostname = env.PROXY_HOSTNAME;
      if (!proxyHostname) {
        return ErrorUtils.createErrorResponse('Proxy not configured', 500);
      }
      
      const targetURL = new URL(request.url);
      targetURL.hostname = proxyHostname;
      targetURL.protocol = env.PROXY_PROTOCOL || 'https:';
      
      if (CONFIG.DEBUG) {
        console.log(`Main proxy to: ${targetURL.href}`);
        timer.mark('Main proxy URL constructed');
      }
      
      return await this.proxyRequest(request, targetURL.href, proxyHostname, env, ctx, timer);
      
    } catch (error) {
      ErrorUtils.logError(error, 'handleMainProxy');
      return ErrorUtils.createErrorResponse(error.message, 500);
    }
  }
  
  /**
   * 核心代理请求处理
   */
  static async proxyRequest(request, targetURL, hostname, env, ctx, timer) {
    try {
      // 安全检查
      const securityResult = await SecurityHandler.validateRequest(request, targetURL);
      if (securityResult.blocked) {
        return ErrorUtils.createErrorResponse(securityResult.reason, 403);
      }
      timer.mark('Security validation complete');
      
      // 检查缓存
      if (request.method === 'GET') {
        const cachedResponse = await CacheManager.get(targetURL);
        if (cachedResponse) {
          if (CONFIG.DEBUG) {
            console.log(`Cache HIT for ${targetURL}`);
            timer.mark('Cache hit returned');
          }
          return enhanceResponse(cachedResponse, request);
        }
      }
      
      // 重定向处理器初始化
      const redirectHandler = new RedirectHandler(hostname, request.parsedUrl.hostname);
      
      // 发送请求
      const response = await this.sendProxyRequest(request, targetURL, hostname, redirectHandler);
      timer.mark('Proxy request sent');
      
      // 处理响应
      const processedResponse = await this.processResponse(
        response, 
        request, 
        targetURL, 
        hostname, 
        redirectHandler,
        timer
      );
      
      // 缓存响应（仅GET请求）
      if (request.method === 'GET' && processedResponse.status < 400) {
        const ttl = CONFIG.getCacheTTL(response.headers.get('content-type'));
        await CacheManager.set(targetURL, processedResponse, ttl);
        timer.mark('Response cached');
      }
      
      if (CONFIG.DEBUG) {
        const totalTime = timer.end();
        console.log(`Total proxy time: ${totalTime}ms`);
      }
      
      return enhanceResponse(processedResponse, request);
      
    } catch (error) {
      ErrorUtils.logError(error, 'proxyRequest');
      
      // 网络错误时尝试故障转移
      if (ErrorUtils.isNetworkError(error) && CONFIG.ENABLE_FAILOVER) {
        return await this.handleFailover(request, targetURL, hostname, env, ctx);
      }
      
      return ErrorUtils.createErrorResponse(error.message, 502);
    }
  }
  
  /**
   * 发送代理请求
   */
  static async sendProxyRequest(request, targetURL, hostname, redirectHandler) {
    let currentURL = targetURL;
    let redirectCount = 0;
    
    while (redirectCount < CONFIG.MAX_REDIRECTS) {
      // 构建请求
      const proxyRequest = await this.buildProxyRequest(request, currentURL, hostname);
      
      // 发送请求
      const response = await PerformanceUtils.fetchWithTimeout(currentURL, {
        method: request.method,
        headers: proxyRequest.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        redirect: 'manual' // 手动处理重定向
      });
      
      // 检查是否需要重定向
      if (response.status >= 301 && response.status <= 308) {
        const location = response.headers.get('location');
        if (location) {
          const redirectURL = await redirectHandler.handleRedirect(currentURL, location);
          if (redirectURL && redirectURL !== currentURL) {
            redirectCount++;
            currentURL = redirectURL;
            
            if (CONFIG.DEBUG) {
              console.log(`Redirect ${redirectCount}: ${currentURL}`);
            }
            
            continue;
          } else {
            // 重定向循环检测
            throw new Error(`Redirect loop detected or invalid redirect from ${currentURL}`);
          }
        }
      }
      
      return response;
    }
    
    throw new Error(`Too many redirects (${CONFIG.MAX_REDIRECTS}) for ${targetURL}`);
  }
  
  /**
   * 构建代理请求
   */
  static async buildProxyRequest(originalRequest, targetURL, hostname) {
    const headers = new Headers();
    
    // 复制原始请求头，但排除一些特殊的头
    const excludeHeaders = new Set([
      'host', 'origin', 'referer', 
      'cf-connecting-ip', 'cf-ray', 'cf-visitor',
      'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip'
    ]);
    
    for (const [key, value] of originalRequest.headers) {
      const lowerKey = key.toLowerCase();
      if (!excludeHeaders.has(lowerKey)) {
        headers.set(key, value);
      }
    }
    
    // 设置必要的头
    headers.set('Host', hostname);
    headers.set('Origin', `https://${hostname}`);
    
    // 处理Referer
    const referer = originalRequest.headers.get('referer');
    if (referer) {
      const rewrittenReferer = URLRewriter.rewriteReferer(referer, hostname);
      headers.set('Referer', rewrittenReferer);
    }
    
    // 设置User-Agent（如果没有的话）
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', CONFIG.getRandomUserAgent());
    }
    
    // 设置Accept-Encoding（支持压缩）
    if (!headers.has('Accept-Encoding')) {
      headers.set('Accept-Encoding', 'gzip, deflate, br');
    }
    
    // 安全头
    headers.set('DNT', '1'); // Do Not Track
    headers.delete('X-Forwarded-For'); // 移除可能泄露原始IP的头
    
    return { headers };
  }
  
  /**
   * 处理响应
   */
  static async processResponse(response, request, targetURL, hostname, redirectHandler, timer) {
    const contentType = response.headers.get('content-type') || '';
    const category = ContentTypeUtils.getContentTypeCategory(contentType);
    
    // 创建新的响应头
    const newHeaders = new Headers(response.headers);
    
    // 处理重定向响应
    if (response.status >= 301 && response.status <= 308) {
      const location = response.headers.get('location');
      if (location) {
        const rewrittenLocation = await redirectHandler.rewriteRedirectLocation(location);
        newHeaders.set('Location', rewrittenLocation);
        
        if (CONFIG.DEBUG) {
          console.log(`Redirect location rewritten: ${location} -> ${rewrittenLocation}`);
        }
      }
    }
    
    // 处理内容
    let processedBody = response.body;
    
    if (ContentTypeUtils.needsURLRewriting(contentType) && response.body) {
      const content = await response.text();
      timer.mark('Content read');
      
      let processedContent = content;
      
      switch (category) {
        case 'HTML':
          const htmlProcessor = new HTMLProcessor(hostname, request.parsedUrl.hostname);
          processedContent = await htmlProcessor.process(content, targetURL);
          timer.mark('HTML processing complete');
          break;
          
        case 'CSS':
          const cssProcessor = new CSSProcessor(hostname, request.parsedUrl.hostname);
          processedContent = await cssProcessor.process(content, targetURL);
          timer.mark('CSS processing complete');
          break;
          
        case 'JS':
          const jsProcessor = new JSProcessor(hostname, request.parsedUrl.hostname);
          processedContent = await jsProcessor.process(content, targetURL);
          timer.mark('JS processing complete');
          break;
      }
      
      processedBody = processedContent;
    }
    
    // 设置缓存控制头
    const ttl = CONFIG.getCacheTTL(contentType);
    newHeaders.set('Cache-Control', `public, max-age=${Math.floor(ttl / 1000)}`);
    
    // 移除可能有问题的安全头
    newHeaders.delete('Content-Security-Policy');
    newHeaders.delete('X-Frame-Options');
    newHeaders.delete('Strict-Transport-Security');
    
    // 设置CORS头
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', '*');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    
    return new Response(processedBody, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
  
  /**
   * 处理故障转移
   */
  static async handleFailover(request, targetURL, hostname, env, ctx) {
    if (!CONFIG.BACKUP_DOMAINS || CONFIG.BACKUP_DOMAINS.length === 0) {
      return ErrorUtils.createErrorResponse('Service temporarily unavailable', 503);
    }
    
    for (const backupDomain of CONFIG.BACKUP_DOMAINS) {
      try {
        const backupURL = targetURL.replace(hostname, backupDomain);
        
        if (CONFIG.DEBUG) {
          console.log(`Trying backup domain: ${backupURL}`);
        }
        
        // 简单的故障转移请求
        const backupResponse = await PerformanceUtils.fetchWithTimeout(backupURL, {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
        }, CONFIG.FAILOVER_TIMEOUT);
        
        if (backupResponse.ok) {
          return enhanceResponse(backupResponse, request);
        }
        
      } catch (error) {
        if (CONFIG.DEBUG) {
          console.warn(`Backup domain ${backupDomain} failed:`, error.message);
        }
        continue;
      }
    }
    
    return ErrorUtils.createErrorResponse('All services unavailable', 503);
  }
}

export default ProxyHandler;