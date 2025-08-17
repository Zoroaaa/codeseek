import { APP_CONSTANTS } from '../../shared/constants.js';
import { apiClient } from '../api/api-client.js';

/**
 * 性能监控模块
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.observers = new Map();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.setupPerformanceObservers();
    this.startMemoryMonitoring();
    this.bindPageVisibilityEvents();
    this.isInitialized = true;

    console.log('📊 性能监控已启动');
  }

  setupPerformanceObservers() {
    // 监听导航性能
    if ('PerformanceObserver' in window) {
      try {
        const navigationObserver = new PerformanceObserver((list) => {
          this.handleNavigationEntries(list.getEntries());
        });
        navigationObserver.observe({ type: 'navigation', buffered: true });
        this.observers.set('navigation', navigationObserver);

        // 监听资源加载
        const resourceObserver = new PerformanceObserver((list) => {
          this.handleResourceEntries(list.getEntries());
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
        this.observers.set('resource', resourceObserver);

        // 监听用户交互
        const eventObserver = new PerformanceObserver((list) => {
          this.handleEventEntries(list.getEntries());
        });
        eventObserver.observe({ type: 'event', buffered: true });
        this.observers.set('event', eventObserver);

      } catch (error) {
        console.warn('性能观察器设置失败:', error);
      }
    }
  }

  handleNavigationEntries(entries) {
    entries.forEach(entry => {
      const metrics = {
        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
        loadComplete: entry.loadEventEnd - entry.loadEventStart,
        domInteractive: entry.domInteractive - entry.fetchStart,
        firstPaint: this.getFirstPaint(),
        firstContentfulPaint: this.getFirstContentfulPaint(),
        largestContentfulPaint: this.getLargestContentfulPaint()
      };

      this.metrics.set('navigation', metrics);
      console.log('📈 页面性能指标:', metrics);

      // 发送到服务器（如果启用分析）
      if (APP_CONSTANTS.ENABLE_ANALYTICS) {
        this.reportMetrics('navigation', metrics);
      }
    });
  }

  handleResourceEntries(entries) {
    const resources = entries.map(entry => ({
      name: entry.name,
      type: this.getResourceType(entry),
      duration: entry.duration,
      size: entry.transferSize || 0,
      cached: entry.transferSize === 0 && entry.decodedBodySize > 0
    }));

    this.metrics.set('resources', resources);

    // 分析慢加载资源
    const slowResources = resources.filter(r => r.duration > 1000);
    if (slowResources.length > 0) {
      console.warn('🐌 慢加载资源:', slowResources);
    }
  }

  handleEventEntries(entries) {
    entries.forEach(entry => {
      if (entry.duration > 100) {
        console.warn('⚠️ 长时间交互事件:', {
          name: entry.name,
          duration: entry.duration,
          startTime: entry.startTime
        });
      }
    });
  }

  startMemoryMonitoring() {
    if (!performance.memory) return;

    const checkMemory = () => {
      const memory = {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };

      this.metrics.set('memory', memory);

      // 内存使用警告
      const usagePercent = (memory.used / memory.limit) * 100;
      if (usagePercent > 80) {
        console.warn('🚨 内存使用率过高:', `${usagePercent.toFixed(1)}%`);
      }
    };

    // 每30秒检查一次内存
    setInterval(checkMemory, 30000);
    checkMemory(); // 立即执行一次
  }

  bindPageVisibilityEvents() {
    let startTime = Date.now();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏
        const sessionDuration = Date.now() - startTime;
        this.metrics.set('sessionDuration', sessionDuration);
      } else {
        // 页面重新可见
        startTime = Date.now();
      }
    });

    // 页面卸载时记录会话时间
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Date.now() - startTime;
      this.reportMetrics('session', { duration: sessionDuration });
    });
  }

  // 测量函数执行时间
  measureTime(func, label = 'function') {
    const start = performance.now();
    const result = func();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }

  // 异步函数执行时间
  async measureAsyncTime(asyncFunc, label = 'async function') {
    const start = performance.now();
    const result = await asyncFunc();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`⏱️ ${label} 执行时间: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
  }

  // 标记性能点
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
  }

  // 测量性能
  measure(name, startMark, endMark) {
    if (performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const entries = performance.getEntriesByName(name);
        return entries[entries.length - 1]?.duration || 0;
      } catch (error) {
        console.error('性能测量失败:', error);
        return 0;
      }
    }
    return 0;
  }

  // 获取First Paint
  getFirstPaint() {
    const entries = performance.getEntriesByType('paint');
    const fpEntry = entries.find(entry => entry.name === 'first-paint');
    return fpEntry ? fpEntry.startTime : null;
  }

  // 获取First Contentful Paint
  getFirstContentfulPaint() {
    const entries = performance.getEntriesByType('paint');
    const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
    return fcpEntry ? fcpEntry.startTime : null;
  }

  // 获取Largest Contentful Paint
  getLargestContentfulPaint() {
    return new Promise((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry ? lastEntry.startTime : null);
          observer.disconnect();
        });

        try {
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (error) {
          resolve(null);
        }

        // 超时处理
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 5000);
      } else {
        resolve(null);
      }
    });
  }

  // 获取资源类型
  getResourceType(entry) {
    if (entry.initiatorType) {
      return entry.initiatorType;
    }
    
    const url = entry.name;
    if (url.includes('.js')) return 'script';
    if (url.includes('.css')) return 'stylesheet';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    if (url.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
    
    return 'other';
  }

  // 获取所有性能指标
  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  // 获取性能摘要
  getPerformanceSummary() {
    const navigation = this.metrics.get('navigation') || {};
    const memory = this.metrics.get('memory') || {};
    const resources = this.metrics.get('resources') || [];

    return {
      pageLoad: {
        domReady: navigation.domInteractive,
        loadComplete: navigation.loadComplete,
        firstPaint: navigation.firstPaint,
        firstContentfulPaint: navigation.firstContentfulPaint
      },
      resources: {
        total: resources.length,
        cached: resources.filter(r => r.cached).length,
        slow: resources.filter(r => r.duration > 1000).length,
        totalSize: resources.reduce((sum, r) => sum + r.size, 0)
      },
      memory: {
        used: memory.used,
        total: memory.total,
        usage: memory.used && memory.limit ? (memory.used / memory.limit * 100).toFixed(1) + '%' : 'N/A'
      }
    };
  }

  // 报告性能指标
  async reportMetrics(type, metrics) {
    if (!navigator.onLine) return;

    try {
      await apiClient.recordAction('performance', {
        type,
        metrics,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href
      });
    } catch (error) {
      console.error('性能指标上报失败:', error);
    }
  }

  // 检查性能问题
  checkPerformanceIssues() {
    const issues = [];
    const navigation = this.metrics.get('navigation') || {};
    const memory = this.metrics.get('memory') || {};
    const resources = this.metrics.get('resources') || [];

    // 检查页面加载时间
    if (navigation.loadComplete > 3000) {
      issues.push({
        type: 'slow_load',
        message: '页面加载时间过长',
        value: navigation.loadComplete,
        suggestion: '优化资源加载和代码'
      });
    }

    // 检查首次内容绘制
    if (navigation.firstContentfulPaint > 2500) {
      issues.push({
        type: 'slow_fcp',
        message: '首次内容绘制时间过长',
        value: navigation.firstContentfulPaint,
        suggestion: '优化关键路径渲染'
      });
    }

    // 检查内存使用
    if (memory.used && memory.limit) {
      const usagePercent = (memory.used / memory.limit) * 100;
      if (usagePercent > 75) {
        issues.push({
          type: 'high_memory',
          message: '内存使用率过高',
          value: usagePercent + '%',
          suggestion: '检查内存泄漏和优化代码'
        });
      }
    }

    // 检查慢资源
    const slowResources = resources.filter(r => r.duration > 2000);
    if (slowResources.length > 0) {
      issues.push({
        type: 'slow_resources',
        message: `发现${slowResources.length}个慢加载资源`,
        value: slowResources.map(r => r.name),
        suggestion: '优化资源大小和加载策略'
      });
    }

    return issues;
  }

  // 生成性能报告
  generateReport() {
    const summary = this.getPerformanceSummary();
    const issues = this.checkPerformanceIssues();
    
    return {
      summary,
      issues,
      recommendations: this.getRecommendations(issues),
      timestamp: new Date().toISOString()
    };
  }

  // 获取性能建议
  getRecommendations(issues) {
    const recommendations = [];

    if (issues.some(i => i.type === 'slow_load')) {
      recommendations.push('启用资源压缩和缓存');
      recommendations.push('使用CDN加速静态资源');
    }

    if (issues.some(i => i.type === 'slow_fcp')) {
      recommendations.push('内联关键CSS');
      recommendations.push('延迟加载非关键资源');
    }

    if (issues.some(i => i.type === 'high_memory')) {
      recommendations.push('检查和修复内存泄漏');
      recommendations.push('优化大对象的使用');
    }

    return recommendations;
  }

  // 清理监控器
  cleanup() {
    this.observers.forEach(observer => {
      observer.disconnect();
    });
    this.observers.clear();
    this.metrics.clear();
    console.log('🧹 性能监控已清理');
  }
}

// 创建全局实例
export const performanceMonitor = new PerformanceMonitor();