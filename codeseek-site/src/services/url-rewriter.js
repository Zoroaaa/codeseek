/**
 * URL重写服务 - 核心URL转换逻辑
 */

import { CONFIG } from '../config.js';
import { URLUtils, StringUtils } from '../utils.js';

class URLRewriter {
  constructor(targetHostname, proxyHostname) {
    this.targetHostname = targetHostname;
    this.proxyHostname = proxyHostname;
    this.proxyPath = `/proxy/${targetHostname}`;
  }

  /**
   * 重写URL - 主要的重写逻辑
   */
  rewriteURL(url) {
    if (!url || typeof url !== 'string') {
      return url;
    }

    const originalURL = url.trim();

    try {
      // 1. 保护特殊协议链接
      if (this.isSpecialProtocol(originalURL)) {
        return originalURL;
      }

      // 2. 保护数据URL
      if (URLUtils.isDataURL(originalURL)) {
        return originalURL;
      }

      // 3. 处理JavaScript伪协议
      if (originalURL.startsWith('javascript:')) {
        return originalURL;
      }

      // 4. 处理锚点链接
      if (originalURL.startsWith('#')) {
        return originalURL;
      }

      // 5. 处理绝对URL
      if (URLUtils.isAbsoluteURL(originalURL)) {
        return this.rewriteAbsoluteURL(originalURL);
      }

      // 6. 处理协议相对URL
      if (URLUtils.isProtocolRelativeURL(originalURL)) {
        return this.rewriteProtocolRelativeURL(originalURL);
      }

      // 7. 处理相对URL
      if (URLUtils.isRelativeURL(originalURL)) {
        return this.rewriteRelativeURL(originalURL);
      }

      // 8. 默认情况
      return originalURL;

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('URL rewrite failed:', originalURL, error);
      }
      return originalURL;
    }
  }

  /**
   * 重写绝对URL
   */
  rewriteAbsoluteURL(url) {
    try {
      const urlObj = new URL(url);
      
      // 如果是目标主机，则重写
      if (urlObj.hostname === this.targetHostname || 
          urlObj.hostname === `www.${this.targetHostname}` ||
          this.targetHostname === `www.${urlObj.hostname}`) {
        
        const path = urlObj.pathname + urlObj.search + urlObj.hash;
        return `https://${this.proxyHostname}${this.proxyPath}${path}`;
      }
      
      // 如果已经是代理URL，检查是否需要修正
      if (urlObj.hostname === this.proxyHostname) {
        if (urlObj.pathname.startsWith(this.proxyPath)) {
          return url; // 已经是正确的代理URL
        }
      }
      
      // 其他外部URL保持不变
      return url;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to parse absolute URL:', url, error);
      }
      return url;
    }
  }

  /**
   * 重写协议相对URL
   */
  rewriteProtocolRelativeURL(url) {
    // 格式: //example.com/path
    const withoutProtocol = url.substring(2);
    const domain = withoutProtocol.split('/')[0];
    
    if (domain === this.targetHostname || 
        domain === `www.${this.targetHostname}` ||
        this.targetHostname === `www.${domain}`) {
      
      const path = withoutProtocol.substring(domain.length);
      return `https://${this.proxyHostname}${this.proxyPath}${path}`;
    }
    
    return `https:${url}`;
  }

  /**
   * 重写相对URL
   */
  rewriteRelativeURL(url) {
    // 排除已经是代理路径的URL
    if (url.startsWith(this.proxyPath)) {
      return url;
    }
    
    // 以/开头的绝对路径
    if (url.startsWith('/')) {
      return `${this.proxyPath}${url}`;
    }
    
    // 相对路径需要基础URL来解析，这里简单处理
    // 在实际使用中，调用方应该提供基础URL
    return url;
  }

  /**
   * 重写Referer头
   */
  rewriteReferer(referer, targetHostname = null) {
    const target = targetHostname || this.targetHostname;
    
    if (!referer) return '';
    
    try {
      const refererURL = new URL(referer);
      
      // 如果referer是代理URL，转换回目标URL
      if (refererURL.hostname === this.proxyHostname && 
          refererURL.pathname.startsWith(`/proxy/${target}`)) {
        
        const originalPath = refererURL.pathname.substring(`/proxy/${target}`.length);
        return `https://${target}${originalPath}${refererURL.search}${refererURL.hash}`;
      }
      
      return referer;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to rewrite referer:', referer, error);
      }
      return referer;
    }
  }

  /**
   * 检查是否为特殊协议
   */
  isSpecialProtocol(url) {
    return CONFIG.SECURITY.ALLOWED_PROTOCOLS.some(protocol => 
      url.toLowerCase().startsWith(protocol.toLowerCase())
    );
  }

  /**
   * 批量重写URL数组
   */
  rewriteURLs(urls) {
    if (!Array.isArray(urls)) {
      return urls;
    }
    
    return urls.map(url => this.rewriteURL(url));
  }

  /**
   * 重写URL对象中的所有URL字段
   */
  rewriteURLObject(obj, urlFields = ['url', 'href', 'src', 'action']) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const rewritten = { ...obj };
    
    urlFields.forEach(field => {
      if (rewritten[field] && typeof rewritten[field] === 'string') {
        rewritten[field] = this.rewriteURL(rewritten[field]);
      }
    });
    
    return rewritten;
  }

  /**
   * 从代理URL提取原始URL
   */
  extractOriginalURL(proxyURL) {
    try {
      const url = new URL(proxyURL);
      
      if (url.hostname === this.proxyHostname && 
          url.pathname.startsWith(this.proxyPath)) {
        
        const originalPath = url.pathname.substring(this.proxyPath.length);
        return `https://${this.targetHostname}${originalPath}${url.search}${url.hash}`;
      }
      
      return proxyURL;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to extract original URL:', proxyURL, error);
      }
      return proxyURL;
    }
  }

  /**
   * 检查URL是否需要重写
   */
  needsRewriting(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // 特殊协议不需要重写
    if (this.isSpecialProtocol(url)) {
      return false;
    }
    
    // 数据URL不需要重写
    if (URLUtils.isDataURL(url)) {
      return false;
    }
    
    // JavaScript伪协议不需要重写
    if (url.startsWith('javascript:')) {
      return false;
    }
    
    // 锚点链接不需要重写
    if (url.startsWith('#')) {
      return false;
    }
    
    // 已经是代理URL不需要重写
    if (url.includes(this.proxyHostname) && url.includes(this.proxyPath)) {
      return false;
    }
    
    return true;
  }

  /**
   * 规范化URL路径
   */
  normalizePath(path) {
    if (!path) return '/';
    
    // 确保路径以/开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // 解析路径段
    const segments = path.split('/').filter(segment => segment !== '');
    const normalized = [];
    
    for (const segment of segments) {
      if (segment === '..') {
        normalized.pop();
      } else if (segment !== '.') {
        normalized.push(segment);
      }
    }
    
    return '/' + normalized.join('/');
  }

  /**
   * 构建代理URL
   */
  buildProxyURL(originalURL) {
    try {
      const url = new URL(originalURL);
      const path = url.pathname + url.search + url.hash;
      return `https://${this.proxyHostname}${this.proxyPath}${path}`;
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to build proxy URL:', originalURL, error);
      }
      return originalURL;
    }
  }

  /**
   * 处理Base64编码的URL
   */
  handleBase64URLs(content) {
    // 查找可能的Base64编码的URL
    const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
    
    return content.replace(base64Pattern, (match) => {
      try {
        const decoded = StringUtils.base64Decode(match);
        if (URLUtils.isValidHTTPURL(decoded)) {
          const rewritten = this.rewriteURL(decoded);
          return StringUtils.base64Encode(rewritten);
        }
      } catch (error) {
        // 不是有效的Base64或URL，保持原样
      }
      return match;
    });
  }

  /**
   * 处理URL参数中的URL
   */
  rewriteURLParameters(url) {
    try {
      const urlObj = new URL(url);
      let modified = false;
      
      // 检查查询参数中的URL
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (URLUtils.isValidHTTPURL(value)) {
          const rewritten = this.rewriteURL(value);
          if (rewritten !== value) {
            urlObj.searchParams.set(key, rewritten);
            modified = true;
          }
        }
      }
      
      return modified ? urlObj.href : url;
      
    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to rewrite URL parameters:', url, error);
      }
      return url;
    }
  }

  /**
   * 智能URL检测和重写
   */
  smartRewrite(content) {
    if (!content || typeof content !== 'string') {
      return content;
    }
    
    // URL模式匹配
    const urlPattern = /https?:\/\/[^\s<>"'\[\]{}|\\^`]+/gi;
    
    return content.replace(urlPattern, (match) => {
      if (this.needsRewriting(match)) {
        return this.rewriteURL(match);
      }
      return match;
    });
  }

  /**
   * 验证重写结果
   */
  validateRewrite(original, rewritten) {
    // 基本验证
    if (!rewritten || rewritten === original) {
      return { valid: true, warnings: [] };
    }
    
    const warnings = [];
    
    // 检查是否意外破坏了特殊协议
    if (this.isSpecialProtocol(original) && !this.isSpecialProtocol(rewritten)) {
      warnings.push('Special protocol may have been corrupted');
    }
    
    // 检查是否产生了无效URL
    if (URLUtils.isAbsoluteURL(rewritten) && !URLUtils.isValidHTTPURL(rewritten)) {
      warnings.push('Rewritten URL may be invalid');
    }
    
    return {
      valid: warnings.length === 0,
      warnings
    };
  }
}

export default URLRewriter;