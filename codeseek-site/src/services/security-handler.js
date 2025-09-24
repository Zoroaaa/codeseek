/**
 * 安全处理器 - 全面的安全检查和防护
 */

import { CONFIG } from '../config.js';
import { URLUtils, StringUtils } from '../utils.js';

class SecurityHandler {
  constructor() {
    this.maliciousPatterns = new Map();
    this.suspiciousIPs = new Set();
    this.rateLimiter = new Map();
    this.initializeSecurity();
  }

  /**
   * 初始化安全配置
   */
  initializeSecurity() {
    // 恶意模式库
    this.maliciousPatterns.set('xss', [
      /<script[^>]*>[\s\S]*?<\/script>/gi,
      /javascript\s*:/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /<iframe[^>]*src\s*=\s*["']javascript:/gi,
      /eval\s*\(/gi,
      /document\.write\s*\(/gi,
      /window\.location\s*=\s*["'][^"']*javascript:/gi
    ]);

    this.maliciousPatterns.set('sql_injection', [
      /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bcreate\b)[\s\S]*(\bfrom\b|\binto\b|\btable\b)/gi,
      /['";]\s*(or|and)\s*['"]?\w+['"]?\s*=\s*['"]?\w+/gi,
      /\b(exec|execute)\s*\(/gi
    ]);

    this.maliciousPatterns.set('path_traversal', [
      /\.\.[\/\\]/g,
      /[\/\\]\.\.[\/\\]/g,
      /\.\.%2f/gi,
      /\.\.%5c/gi,
      /%2e%2e%2f/gi,
      /%2e%2e%5c/gi
    ]);

    this.maliciousPatterns.set('command_injection', [
      /[;&|`$()]/g,
      /\bnc\s+-/gi,
      /\bwget\s+/gi,
      /\bcurl\s+/gi,
      /\bpowershell\s+/gi,
      /\bcmd\s+/gi
    ]);

    if (CONFIG.DEBUG) {
      console.log('Security handler initialized with pattern library');
    }
  }

  /**
   * 验证请求安全性
   */
  static async validateRequest(request, targetURL) {
    const handler = new SecurityHandler();
    
    try {
      // URL验证
      const urlValidation = handler.validateURL(targetURL);
      if (!urlValidation.valid) {
        return { blocked: true, reason: urlValidation.reason, category: 'url_validation' };
      }

      // 请求头验证
      const headerValidation = handler.validateHeaders(request.headers);
      if (!headerValidation.valid) {
        return { blocked: true, reason: headerValidation.reason, category: 'header_validation' };
      }

      // 内容长度检查
      const contentLength = parseInt(request.headers.get('content-length')) || 0;
      if (contentLength > CONFIG.SECURITY.MAX_CONTENT_SIZE) {
        return { 
          blocked: true, 
          reason: `Content too large: ${contentLength} > ${CONFIG.SECURITY.MAX_CONTENT_SIZE}`,
          category: 'content_size'
        };
      }

      // IP地址检查
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      const ipValidation = handler.validateIPAddress(clientIP);
      if (!ipValidation.valid) {
        return { blocked: true, reason: ipValidation.reason, category: 'ip_validation' };
      }

      // 速率限制检查
      const rateLimitResult = await handler.checkRateLimit(clientIP, request.url);
      if (rateLimitResult.blocked) {
        return { blocked: true, reason: rateLimitResult.reason, category: 'rate_limit' };
      }

      // User-Agent检查
      const userAgent = request.headers.get('user-agent') || '';
      const uaValidation = handler.validateUserAgent(userAgent);
      if (!uaValidation.valid) {
        return { blocked: true, reason: uaValidation.reason, category: 'user_agent' };
      }

      return { blocked: false, reason: null };

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Security validation error:', error);
      }
      return { blocked: true, reason: 'Security validation failed', category: 'system_error' };
    }
  }

  /**
   * URL安全验证
   */
  validateURL(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, reason: 'Invalid URL format' };
    }

    try {
      const urlObj = new URL(url);

      // 协议检查
      if (!CONFIG.SECURITY.ALLOWED_PROTOCOLS.includes(urlObj.protocol)) {
        return { valid: false, reason: `Forbidden protocol: ${urlObj.protocol}` };
      }

      // 端口检查
      if (urlObj.port && !this.isAllowedPort(urlObj.port)) {
        return { valid: false, reason: `Forbidden port: ${urlObj.port}` };
      }

      // IP地址检查
      if (this.isPrivateIP(urlObj.hostname)) {
        return { valid: false, reason: 'Private IP addresses not allowed' };
      }

      // 恶意域名检查
      if (this.isMaliciousDomain(urlObj.hostname)) {
        return { valid: false, reason: 'Malicious domain detected' };
      }

      // 路径遍历检查
      if (this.containsPathTraversal(urlObj.pathname)) {
        return { valid: false, reason: 'Path traversal attempt detected' };
      }

      // URL长度检查
      if (url.length > 8192) {
        return { valid: false, reason: 'URL too long' };
      }

      return { valid: true, reason: null };

    } catch (error) {
      return { valid: false, reason: 'Malformed URL' };
    }
  }

  /**
   * 请求头验证
   */
  validateHeaders(headers) {
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-rewrite-url',
      'x-original-url',
      'x-override-url'
    ];

    // 检查可疑的请求头
    for (const headerName of suspiciousHeaders) {
      if (headers.has(headerName)) {
        const value = headers.get(headerName);
        if (this.containsMaliciousContent(value)) {
          return { 
            valid: false, 
            reason: `Malicious content in header: ${headerName}` 
          };
        }
      }
    }

    // 检查Host头
    const host = headers.get('host');
    if (host && (host.includes('..') || host.includes('/') || host.includes('\\'))) {
      return { valid: false, reason: 'Malicious host header' };
    }

    // 检查Referer头
    const referer = headers.get('referer');
    if (referer && this.containsMaliciousContent(referer)) {
      return { valid: false, reason: 'Malicious referer header' };
    }

    // 检查User-Agent长度
    const userAgent = headers.get('user-agent') || '';
    if (userAgent.length > 1024) {
      return { valid: false, reason: 'User-Agent too long' };
    }

    return { valid: true, reason: null };
  }

  /**
   * IP地址验证
   */
  validateIPAddress(ip) {
    if (!ip || ip === 'unknown') {
      return { valid: true, reason: null }; // 允许未知IP
    }

    // 检查是否在黑名单中
    if (this.suspiciousIPs.has(ip)) {
      return { valid: false, reason: 'IP address in blocklist' };
    }

    // 检查是否为内网IP
    if (this.isPrivateIP(ip)) {
      return { valid: false, reason: 'Private IP address not allowed' };
    }

    return { valid: true, reason: null };
  }

  /**
   * 速率限制检查
   */
  async checkRateLimit(clientIP, url) {
    const key = `${clientIP}:${new URL(url).pathname}`;
    const now = Date.now();
    const window = 60000; // 1分钟窗口
    const maxRequests = 60; // 每分钟最多60请求

    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, { count: 1, resetTime: now + window });
      return { blocked: false };
    }

    const limiter = this.rateLimiter.get(key);

    if (now > limiter.resetTime) {
      // 重置计数器
      limiter.count = 1;
      limiter.resetTime = now + window;
      return { blocked: false };
    }

    limiter.count++;

    if (limiter.count > maxRequests) {
      return { 
        blocked: true, 
        reason: `Rate limit exceeded: ${limiter.count}/${maxRequests} requests per minute`,
        retryAfter: Math.ceil((limiter.resetTime - now) / 1000)
      };
    }

    return { blocked: false };
  }

  /**
   * User-Agent验证
   */
  validateUserAgent(userAgent) {
    if (!userAgent) {
      return { valid: true, reason: null }; // 允许空UA
    }

    // 检查恶意User-Agent模式
    const maliciousUAPatterns = [
      /sqlmap/i,
      /nmap/i,
      /nikto/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /<script/i,
      /javascript:/i
    ];

    for (const pattern of maliciousUAPatterns) {
      if (pattern.test(userAgent)) {
        return { valid: false, reason: 'Malicious User-Agent detected' };
      }
    }

    return { valid: true, reason: null };
  }

  /**
   * 内容安全过滤
   */
  filterMaliciousContent(content, contentType = '') {
    if (!content || !CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS) {
      return content;
    }

    let filtered = content;

    // 基于内容类型的过滤
    if (contentType.includes('text/html')) {
      filtered = this.filterHTMLContent(filtered);
    } else if (contentType.includes('application/javascript')) {
      filtered = this.filterJavaScriptContent(filtered);
    } else if (contentType.includes('text/css')) {
      filtered = this.filterCSSContent(filtered);
    }

    // 通用恶意内容过滤
    filtered = this.filterGeneralMaliciousContent(filtered);

    return filtered;
  }

  /**
   * 过滤HTML恶意内容
   */
  filterHTMLContent(html) {
    const xssPatterns = this.maliciousPatterns.get('xss') || [];
    
    let filtered = html;

    xssPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '<!-- XSS filtered -->');
    });

    // 过滤危险属性
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur',
      'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'
    ];

    dangerousAttributes.forEach(attr => {
      const pattern = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      filtered = filtered.replace(pattern, '');
    });

    return filtered;
  }

  /**
   * 过滤JavaScript恶意内容
   */
  filterJavaScriptContent(js) {
    // 危险函数调用
    const dangerousFunctions = [
      'eval', 'Function', 'setTimeout', 'setInterval', 'document.write'
    ];

    let filtered = js;

    dangerousFunctions.forEach(func => {
      const pattern = new RegExp(`\\b${func}\\s*\\(`, 'gi');
      filtered = filtered.replace(pattern, `/* ${func} filtered */(`);
    });

    return filtered;
  }

  /**
   * 过滤CSS恶意内容
   */
  filterCSSContent(css) {
    // 危险的CSS属性
    const dangerousPatterns = [
      /javascript\s*:/gi,
      /expression\s*\(/gi,
      /behavior\s*:/gi,
      /@import\s+["']javascript:/gi
    ];

    let filtered = css;

    dangerousPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '/* CSS filtered */');
    });

    return filtered;
  }

  /**
   * 过滤通用恶意内容
   */
  filterGeneralMaliciousContent(content) {
    let filtered = content;

    // SQL注入过滤
    const sqlPatterns = this.maliciousPatterns.get('sql_injection') || [];
    sqlPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '/* SQL filtered */');
    });

    // 命令注入过滤
    const cmdPatterns = this.maliciousPatterns.get('command_injection') || [];
    cmdPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '/* CMD filtered */');
    });

    return filtered;
  }

  /**
   * 检查是否包含恶意内容
   */
  containsMaliciousContent(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    const allPatterns = Array.from(this.maliciousPatterns.values()).flat();
    
    for (const pattern of allPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查是否为允许的端口
   */
  isAllowedPort(port) {
    const allowedPorts = ['80', '443', '8080', '8443'];
    return allowedPorts.includes(port);
  }

  /**
   * 检查是否为私有IP
   */
  isPrivateIP(hostname) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^0\./,
      /^169\.254\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^fd00:/
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * 检查是否为恶意域名
   */
  isMaliciousDomain(hostname) {
    const maliciousDomains = [
      'localhost',
      'example.com',
      'test.com',
      'invalid'
    ];

    const suspiciousPatterns = [
      /\.(tk|ml|ga|cf)$/i, // 免费域名后缀
      /[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}-[0-9]{1,3}/, // IP格式域名
      /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ // 纯IP地址
    ];

    if (maliciousDomains.includes(hostname.toLowerCase())) {
      return true;
    }

    return suspiciousPatterns.some(pattern => pattern.test(hostname));
  }

  /**
   * 检查路径遍历
   */
  containsPathTraversal(path) {
    const pathTraversalPatterns = this.maliciousPatterns.get('path_traversal') || [];
    return pathTraversalPatterns.some(pattern => pattern.test(path));
  }

  /**
   * 清理恶意查询参数
   */
  sanitizeQueryParams(url) {
    try {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;
      
      for (const [key, value] of params.entries()) {
        if (this.containsMaliciousContent(key) || this.containsMaliciousContent(value)) {
          params.delete(key);
        }
      }
      
      return urlObj.href;
    } catch (error) {
      return url;
    }
  }

  /**
   * 生成安全报告
   */
  generateSecurityReport(request, targetURL, validationResults) {
    return {
      timestamp: new Date().toISOString(),
      clientIP: request.headers.get('cf-connecting-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      targetURL: targetURL,
      validationResults: validationResults,
      blocked: validationResults.blocked,
      securityLevel: this.assessSecurityLevel(validationResults),
      recommendations: this.generateSecurityRecommendations(validationResults)
    };
  }

  /**
   * 评估安全级别
   */
  assessSecurityLevel(results) {
    if (results.blocked) {
      switch (results.category) {
        case 'rate_limit':
          return 'MODERATE';
        case 'content_size':
          return 'LOW';
        case 'ip_validation':
        case 'url_validation':
          return 'HIGH';
        default:
          return 'MEDIUM';
      }
    }
    return 'SAFE';
  }

  /**
   * 生成安全建议
   */
  generateSecurityRecommendations(results) {
    const recommendations = [];

    if (results.blocked) {
      switch (results.category) {
        case 'rate_limit':
          recommendations.push('Implement client-side request throttling');
          recommendations.push('Consider using request queuing');
          break;
        case 'content_size':
          recommendations.push('Reduce request payload size');
          recommendations.push('Consider chunked transfers for large content');
          break;
        case 'url_validation':
          recommendations.push('Validate URLs before making requests');
          recommendations.push('Use URL sanitization');
          break;
        case 'header_validation':
          recommendations.push('Review and sanitize request headers');
          break;
      }
    } else {
      recommendations.push('Request passed all security checks');
    }

    return recommendations;
  }

  /**
   * 清理速率限制记录
   */
  cleanupRateLimiters() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, limiter] of this.rateLimiter.entries()) {
      if (now > limiter.resetTime + 300000) { // 5分钟后清理
        this.rateLimiter.delete(key);
        cleaned++;
      }
    }

    if (CONFIG.DEBUG && cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired rate limiters`);
    }

    return cleaned;
  }

  /**
   * 获取安全统计
   */
  getSecurityStats() {
    return {
      patternLibrary: {
        xss: this.maliciousPatterns.get('xss')?.length || 0,
        sql_injection: this.maliciousPatterns.get('sql_injection')?.length || 0,
        path_traversal: this.maliciousPatterns.get('path_traversal')?.length || 0,
        command_injection: this.maliciousPatterns.get('command_injection')?.length || 0
      },
      activeLimiters: this.rateLimiter.size,
      blockedIPs: this.suspiciousIPs.size,
      settings: CONFIG.SECURITY
    };
  }
}

export default SecurityHandler;