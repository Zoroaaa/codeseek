/**
 * Enhanced Proxy Worker v4.0.0 - 深度优化版
 * 模块化架构，解决重定向、同源、磁力链接等问题
 */

import { Router } from './router.js';
import { corsMiddleware, errorMiddleware, loggingMiddleware } from './middleware.js';
import { CONFIG } from './config.js';
import ProxyHandler from './handlers/proxy.js';
import ApiHandler from './handlers/api.js';
import StaticHandler from './handlers/static.js';

/**
 * 主Worker类
 */
class ProxyWorker {
  constructor() {
    this.router = new Router();
    this.setupRoutes();
    this.setupMiddleware();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    this.router.use(corsMiddleware);
    this.router.use(loggingMiddleware);
    this.router.use(errorMiddleware);
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // API 路由
    this.router.get('/api/health', ApiHandler.health);
    this.router.get('/api/status', ApiHandler.status);
    this.router.get('/api/cache/stats', ApiHandler.cacheStats);
    this.router.get('/api/proxy/stats', ApiHandler.proxyStats);
    this.router.post('/api/cache/clear', ApiHandler.clearCache);

    // 静态资源路由
    this.router.get('/favicon.ico', StaticHandler.favicon);
    this.router.get('/robots.txt', StaticHandler.robots);

    // 代理路由 - 支持多种格式
    this.router.all('/proxy/:hostname/*', ProxyHandler.handleDynamicProxy);
    this.router.all('/proxy/:hostname', ProxyHandler.handleDynamicProxy);
    
    // 默认代理路由（兼容旧版本）
    this.router.all('/*', ProxyHandler.handleMainProxy);
  }

  /**
   * 处理请求
   */
  async fetch(request, env, ctx) {
    try {
      // 初始化环境
      if (env) {
        CONFIG.init(env);
      }

      // 预检请求快速处理
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': '*',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400'
          }
        });
      }

      // 路由处理
      return await this.router.handle(request, env, ctx);

    } catch (error) {
      console.error('Worker Error:', error);
      
      return new Response(JSON.stringify({
        error: 'Proxy service error',
        message: CONFIG.DEBUG ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
        version: CONFIG.VERSION
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
}

// 创建Worker实例
const worker = new ProxyWorker();

// 导出默认处理器
export default {
  fetch: (request, env, ctx) => worker.fetch(request, env, ctx)
};