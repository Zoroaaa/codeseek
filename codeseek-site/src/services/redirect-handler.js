/**
 * 重定向处理器 - 智能处理HTTP重定向和循环检测
 * 修复版本：解决内存泄漏风险
 */

import { CONFIG } from '../config.js';
import { URLUtils, ErrorUtils } from '../utils.js';
import URLRewriter from './url-rewriter.js';

class RedirectHandler {
  constructor(targetHostname, proxyHostname) {
    this.targetHostname = targetHostname;
    this.proxyHostname = proxyHostname;
    this.proxyPath = `/proxy/${targetHostname}`;
    this.urlRewriter = new URLRewriter(targetHostname, proxyHostname);
    
    // 修复版本：添加更好的内存管理
    this.redirectChain = new Map(); // 用于跟踪重定向链
    this.visitedURLs = new Map(); // 改为Map以存储访问时间
    this.lastCleanup = Date.now();
    this.cleanupInterval = 5 * 60 * 1000; // 5分钟清理一次
    this.maxEntries = 500; // 降低最大条目数
    this.entryTTL = 10 * 60 * 1000; // 10分钟过期时间
    this.maxChainLength = CONFIG.MAX_REDIRECTS || 10;
    
    // 启动定期清理
    this.schedulePeriodicCleanup();
  }

  /**
   * 处理重定向
   */
  async handleRedirect(currentURL, location) {
    try {
      // 验证重定向目标
      if (!this.isValidRedirectTarget(location)) {
        if (CONFIG.DEBUG) {
          console.warn('Invalid redirect target:', location);
        }
        return null;
      }

      // 解析重定向URL
      const redirectURL = this.resolveRedirectURL(currentURL, location);
      
      // 循环检测
      if (this.detectRedirectLoop(currentURL, redirectURL)) {
        throw new Error(`Redirect loop detected: ${currentURL} -> ${redirectURL}`);
      }
      
      // 记录重定向
      this.recordRedirect(currentURL, redirectURL);
      
      // 检查是否需要清理
      this.maybeCleanup();
      
      return redirectURL;

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Redirect handling error:', error);
      }
      throw error;
    }
  }

  /**
   * 重写重定向Location头
   */
  async rewriteRedirectLocation(location) {
    try {
      if (!location) return location;

      // 处理相对重定向
      if (location.startsWith('/')) {
        return `https://${this.proxyHostname}${this.proxyPath}${location}`;
      }

      // 处理协议相对重定向
      if (location.startsWith('//')) {
        const domain = location.substring(2).split('/')[0];
        if (domain === this.targetHostname || this.isRelatedDomain(domain)) {
          const path = location.substring(2 + domain.length);
          return `https://${this.proxyHostname}${this.proxyPath}${path}`;
        }
        return `https:${location}`;
      }

      // 处理绝对URL重定向
      if (URLUtils.isAbsoluteURL(location)) {
        const url = new URL(location);
        if (url.hostname === this.targetHostname || this.isRelatedDomain(url.hostname)) {
          const path = url.pathname + url.search + url.hash;
          return `https://${this.proxyHostname}${this.proxyPath}${path}`;
        }
        
        // 外部重定向 - 需要特殊处理
        return this.handleExternalRedirect(location);
      }

      return location;

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Error rewriting redirect location:', error);
      }
      return location;
    }
  }

  /**
   * 解析重定向URL
   */
  resolveRedirectURL(baseURL, location) {
    try {
      if (URLUtils.isAbsoluteURL(location)) {
        return location;
      }

      if (location.startsWith('//')) {
        return `https:${location}`;
      }

      if (location.startsWith('/')) {
        const base = new URL(baseURL);
        return `${base.protocol}//${base.hostname}${location}`;
      }

      // 相对路径
      return new URL(location, baseURL).href;

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Failed to resolve redirect URL:', baseURL, location, error);
      }
      return location;
    }
  }

  /**
   * 检测重定向循环 - 修复版本
   */
  detectRedirectLoop(currentURL, redirectURL) {
    const normalizedCurrent = this.normalizeURL(currentURL);
    const normalizedRedirect = this.normalizeURL(redirectURL);
    const now = Date.now();

    // 简单的直接循环检测
    if (normalizedCurrent === normalizedRedirect) {
      return true;
    }

    // 检查是否最近访问过这个URL
    const lastVisit = this.visitedURLs.get(normalizedRedirect);
    if (lastVisit && (now - lastVisit) < 60000) { // 1分钟内重复访问
      return true;
    }

    // 检查重定向链长度
    const chainLength = this.getRedirectChainLength(normalizedCurrent);
    if (chainLength >= this.maxChainLength) {
      return true;
    }

    // 检查是否存在间接循环
    return this.detectIndirectLoop(normalizedRedirect);
  }

  /**
   * 检测间接循环
   */
  detectIndirectLoop(url) {
    const visited = new Set();
    let current = url;
    let depth = 0;

    while (this.redirectChain.has(current) && depth < this.maxChainLength) {
      if (visited.has(current)) {
        return true; // 发现循环
      }
      visited.add(current);
      
      const redirectInfo = this.redirectChain.get(current);
      current = redirectInfo ? redirectInfo.target : null;
      
      if (!current) break;
      depth++;
    }

    return false;
  }

  /**
   * 记录重定向 - 修复版本：添加时间戳和更好的内存管理
   */
  recordRedirect(fromURL, toURL) {
    const normalizedFrom = this.normalizeURL(fromURL);
    const normalizedTo = this.normalizeURL(toURL);
    const now = Date.now();

    // 记录重定向链，包含时间戳
    this.redirectChain.set(normalizedFrom, {
      target: normalizedTo,
      timestamp: now,
      count: (this.redirectChain.get(normalizedFrom)?.count || 0) + 1
    });
    
    // 记录访问时间
    this.visitedURLs.set(normalizedFrom, now);
    this.visitedURLs.set(normalizedTo, now);

    // 如果超过最大条目数，立即清理
    if (this.redirectChain.size > this.maxEntries) {
      this.forceCleanup();
    }

    if (CONFIG.DEBUG) {
      console.log(`Redirect recorded: ${normalizedFrom} -> ${normalizedTo}`);
    }
  }

  /**
   * 可能执行清理
   */
  maybeCleanup() {
    const now = Date.now();
    
    // 检查是否需要定期清理
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.performCleanup();
    }
    
    // 如果条目太多，强制清理
    if (this.redirectChain.size > this.maxEntries * 1.5) {
      this.forceCleanup();
    }
  }

  /**
   * 执行清理 - 修复版本：基于时间和LRU策略
   */
  performCleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    try {
      // 清理过期的重定向记录
      for (const [url, redirectInfo] of this.redirectChain.entries()) {
        if (now - redirectInfo.timestamp > this.entryTTL) {
          this.redirectChain.delete(url);
          cleanedCount++;
        }
      }

      // 清理过期的访问记录
      for (const [url, timestamp] of this.visitedURLs.entries()) {
        if (now - timestamp > this.entryTTL) {
          this.visitedURLs.delete(url);
          cleanedCount++;
        }
      }

      // 如果仍然太多，使用LRU策略
      if (this.redirectChain.size > this.maxEntries) {
        this.performLRUCleanup();
      }

      this.lastCleanup = now;

      if (CONFIG.DEBUG && cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired redirect records`);
      }

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Error during redirect cleanup:', error);
      }
    }
  }

  /**
   * LRU清理策略
   */
  performLRUCleanup() {
    const targetSize = Math.floor(this.maxEntries * 0.75); // 清理到75%
    
    try {
      // 按时间戳排序，删除最老的条目
      const sortedEntries = Array.from(this.redirectChain.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = sortedEntries.slice(0, sortedEntries.length - targetSize);
      
      for (const [url] of toDelete) {
        this.redirectChain.delete(url);
        this.visitedURLs.delete(url);
      }

      if (CONFIG.DEBUG && toDelete.length > 0) {
        console.log(`LRU cleanup removed ${toDelete.length} old redirect records`);
      }

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Error during LRU cleanup:', error);
      }
    }
  }

  /**
   * 强制清理
   */
  forceCleanup() {
    try {
      const targetSize = Math.floor(this.maxEntries * 0.5); // 清理到50%
      
      if (this.redirectChain.size <= targetSize) {
        return; // 不需要清理
      }

      // 先尝试清理过期条目
      this.performCleanup();
      
      // 如果仍然太多，执行LRU清理
      if (this.redirectChain.size > targetSize) {
        this.performLRUCleanup();
      }

      if (CONFIG.DEBUG) {
        console.log(`Force cleanup completed. Current size: ${this.redirectChain.size}`);
      }

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.error('Error during force cleanup:', error);
      }
    }
  }

  /**
   * 定期清理调度
   */
  schedulePeriodicCleanup() {
    // 使用随机间隔避免所有实例同时清理
    const interval = this.cleanupInterval + Math.random() * 60000; // 添加0-1分钟随机性
    
    setTimeout(() => {
      this.performCleanup();
      this.schedulePeriodicCleanup(); // 重新调度
    }, interval);
  }

  /**
   * 获取重定向链长度
   */
  getRedirectChainLength(url) {
    let current = url;
    let length = 0;

    while (this.redirectChain.has(current) && length < this.maxChainLength + 1) {
      const redirectInfo = this.redirectChain.get(current);
      current = redirectInfo ? redirectInfo.target : null;
      length++;
      
      if (!current) break;
    }

    return length;
  }

  /**
   * 规范化URL（用于比较）
   */
  normalizeURL(url) {
    try {
      const urlObj = new URL(url);
      
      // 移除fragment
      urlObj.hash = '';
      
      // 规范化路径
      let path = urlObj.pathname;
      if (path.endsWith('/') && path.length > 1) {
        path = path.slice(0, -1);
      }
      urlObj.pathname = path;
      
      // 排序查询参数
      const params = Array.from(urlObj.searchParams.entries()).sort();
      urlObj.search = new URLSearchParams(params).toString();
      
      return urlObj.href.toLowerCase();

    } catch (error) {
      return url.toLowerCase();
    }
  }

  /**
   * 验证重定向目标是否有效
   */
  isValidRedirectTarget(location) {
    if (!location || typeof location !== 'string') {
      return false;
    }

    // 检查恶意重定向
    const maliciousPatterns = [
      'javascript:',
      'data:',
      'vbscript:',
      'file:',
      'ftp:'
    ];

    const lowerLocation = location.toLowerCase();
    if (maliciousPatterns.some(pattern => lowerLocation.startsWith(pattern))) {
      return false;
    }

    // 检查URL长度
    if (location.length > 2048) {
      return false;
    }

    // 检查是否包含空字符
    if (location.includes('\0') || location.includes('\r') || location.includes('\n')) {
      return false;
    }

    return true;
  }

  /**
   * 检查是否为相关域名
   */
  isRelatedDomain(hostname) {
    if (!hostname) return false;

    const targetBase = this.targetHostname.replace(/^www\./, '');
    const checkBase = hostname.replace(/^www\./, '');

    // 完全匹配
    if (checkBase === targetBase) {
      return true;
    }

    // 子域名匹配
    if (checkBase.endsWith('.' + targetBase) || targetBase.endsWith('.' + checkBase)) {
      return true;
    }

    return false;
  }

  /**
   * 处理外部重定向
   */
  handleExternalRedirect(location) {
    try {
      const url = new URL(location);
      
      // 检查是否为允许的外部域名
      if (CONFIG.isValidProxyTarget(url.hostname)) {
        // 如果是允许的代理目标，重写为代理URL
        const path = url.pathname + url.search + url.hash;
        return `https://${this.proxyHostname}/proxy/${url.hostname}${path}`;
      }

      // 对于不允许的外部重定向，可以选择阻止或警告
      if (CONFIG.SECURITY.BLOCK_EXTERNAL_REDIRECTS) {
        if (CONFIG.DEBUG) {
          console.warn('Blocked external redirect to:', location);
        }
        return null;
      }

      return location;

    } catch (error) {
      if (CONFIG.DEBUG) {
        console.warn('Error handling external redirect:', location, error);
      }
      return location;
    }
  }

  /**
   * 获取重定向统计信息 - 修复版本：包含内存使用信息
   */
  getRedirectStats() {
    const now = Date.now();
    
    // 计算内存使用估算
    const avgUrlLength = 100; // 平均URL长度估算
    const estimatedMemoryUsage = (this.redirectChain.size + this.visitedURLs.size) * avgUrlLength;
    
    return {
      redirectChain: {
        size: this.redirectChain.size,
        maxSize: this.maxEntries
      },
      visitedURLs: {
        size: this.visitedURLs.size
      },
      maxChainLength: Math.max(...Array.from(this.redirectChain.keys()).map(url => 
        this.getRedirectChainLength(url)
      ), 0),
      memoryManagement: {
        estimatedMemoryUsage: `${Math.round(estimatedMemoryUsage / 1024)}KB`,
        lastCleanup: new Date(this.lastCleanup).toISOString(),
        nextCleanup: new Date(this.lastCleanup + this.cleanupInterval).toISOString(),
        entryTTL: `${this.entryTTL / 1000}s`,
        cleanupInterval: `${this.cleanupInterval / 1000}s`
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 重置重定向状态
   */
  reset() {
    this.redirectChain.clear();
    this.visitedURLs.clear();
    this.lastCleanup = Date.now();
    
    if (CONFIG.DEBUG) {
      console.log('Redirect handler reset');
    }
  }

  /**
   * 分析重定向链
   */
  analyzeRedirectChain(startURL) {
    const chain = [];
    let current = this.normalizeURL(startURL);
    let depth = 0;

    while (this.redirectChain.has(current) && depth < this.maxChainLength) {
      const redirectInfo = this.redirectChain.get(current);
      if (!redirectInfo) break;
      
      chain.push({
        from: current,
        to: redirectInfo.target,
        depth: depth++,
        timestamp: new Date(redirectInfo.timestamp).toISOString(),
        count: redirectInfo.count
      });
      
      current = redirectInfo.target;
    }

    return {
      chain,
      length: chain.length,
      hasLoop: this.detectIndirectLoop(this.normalizeURL(startURL)),
      finalURL: current
    };
  }

  /**
   * 预检重定向目标
   */
  async precheckRedirectTarget(location) {
    if (!location || !URLUtils.isAbsoluteURL(location)) {
      return { valid: true, reason: null };
    }

    try {
      const url = new URL(location);

      // 检查协议
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { valid: false, reason: 'Unsupported protocol' };
      }

      // 检查端口
      if (url.port && !this.isAllowedPort(url.port)) {
        return { valid: false, reason: 'Forbidden port' };
      }

      // 检查IP地址
      if (this.isIPAddress(url.hostname)) {
        return { valid: false, reason: 'IP addresses not allowed' };
      }

      return { valid: true, reason: null };

    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  /**
   * 检查是否为允许的端口
   */
  isAllowedPort(port) {
    const allowedPorts = ['80', '443', '8080', '8443'];
    return allowedPorts.includes(port);
  }

  /**
   * 检查是否为IP地址
   */
  isIPAddress(hostname) {
    // IPv4
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(hostname)) {
      return true;
    }

    // IPv6
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv6Pattern.test(hostname)) {
      return true;
    }

    return false;
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage() {
    const avgUrlLength = 100; // 平均URL长度估算
    const avgObjectSize = 200; // 平均对象大小估算
    
    const redirectChainMemory = this.redirectChain.size * (avgUrlLength * 2 + avgObjectSize);
    const visitedUrlsMemory = this.visitedURLs.size * (avgUrlLength + 8); // URL + timestamp
    
    return {
      redirectChain: `${Math.round(redirectChainMemory / 1024)}KB`,
      visitedURLs: `${Math.round(visitedUrlsMemory / 1024)}KB`,
      total: `${Math.round((redirectChainMemory + visitedUrlsMemory) / 1024)}KB`,
      entries: {
        redirectChain: this.redirectChain.size,
        visitedURLs: this.visitedURLs.size,
        maxEntries: this.maxEntries
      }
    };
  }

  /**
   * 执行内存优化
   */
  optimizeMemory() {
    const before = this.getMemoryUsage();
    
    // 执行清理
    this.forceCleanup();
    
    const after = this.getMemoryUsage();
    
    if (CONFIG.DEBUG) {
      console.log('Memory optimization:', {
        before: before.total,
        after: after.total,
        saved: `${Math.round((parseInt(before.total) - parseInt(after.total)))}KB`
      });
    }
    
    return {
      before,
      after,
      optimized: true
    };
  }
}

export default RedirectHandler;