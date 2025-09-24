/**
 * Enhanced Proxy Worker v4.0.1 - 基于可工作版本的改造
 * 简化架构，移除复杂的Proxy包装和中间件链，提高稳定性
 */

import { Router } from './router.js';
import { CONFIG } from './config.js';
import { runMiddlewares, enhanceResponse } from './middleware.js';

/**
 * 主Worker类 - 简化版本
 */
class ProxyWorker {
    constructor() {
        this.router = new Router();
        this.initialized = false;
    }

    /**
     * 初始化Worker
     */
    async initialize(env) {
        if (this.initialized) return;
        
        try {
            // 初始化配置
            CONFIG.init(env);
            
            if (CONFIG.DEBUG) {
                console.log('ProxyWorker initialized:', {
                    version: CONFIG.VERSION,
                    environment: CONFIG.ENVIRONMENT,
                    allowedTargets: CONFIG.ALLOWED_TARGETS.length,
                    debug: CONFIG.DEBUG
                });
            }
            
            this.initialized = true;
        } catch (error) {
            console.error('Worker初始化失败:', error);
            // 即使初始化失败也继续运行，使用默认配置
            this.initialized = true;
        }
    }

    /**
     * 处理请求 - 简化版本
     */
    async fetch(request, env, ctx) {
        try {
            // 初始化Worker（如果还没有初始化）
            await this.initialize(env);

            // 快速处理OPTIONS预检请求
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

            // 运行中间件
            const middlewareResult = await runMiddlewares(request, env);
            if (middlewareResult instanceof Response) {
                return enhanceResponse(middlewareResult, request);
            }

            // 路由处理
            const response = await this.router.handle(request, env);
            
            // 增强响应
            return enhanceResponse(response, request);

        } catch (error) {
            return this.handleError(error, request);
        }
    }

    /**
     * 错误处理 - 统一的错误处理逻辑
     */
    handleError(error, request) {
        console.error('Worker处理错误:', error);
        console.error('错误堆栈:', error.stack);
        
        const url = new URL(request.url);
        
        // 构建错误响应
        const errorData = {
            error: 'Proxy service error',
            message: CONFIG.DEBUG ? error.message : 'Internal server error',
            path: url.pathname,
            method: request.method,
            timestamp: new Date().toISOString(),
            version: CONFIG.VERSION
        };
        
        // 在DEBUG模式下添加更多信息
        if (CONFIG.DEBUG) {
            errorData.stack = error.stack;
            errorData.details = {
                url: request.url,
                userAgent: request.headers.get('user-agent'),
                origin: request.headers.get('origin'),
                referer: request.headers.get('referer')
            };
        }
        
        const response = new Response(JSON.stringify(errorData), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': '*',
                'Access-Control-Allow-Headers': '*',
                'X-Error-Time': new Date().toISOString(),
                'X-Proxy-Version': CONFIG.VERSION
            }
        });
        
        return enhanceResponse(response, request);
    }

    /**
     * 获取Worker状态
     */
    getStatus() {
        return {
            initialized: this.initialized,
            version: CONFIG.VERSION,
            environment: CONFIG.ENVIRONMENT,
            debug: CONFIG.DEBUG,
            routeCount: this.router.routes.size,
            timestamp: new Date().toISOString()
        };
    }
}

// 创建Worker实例
const worker = new ProxyWorker();

// 主处理函数
async function handleRequest(request, env, ctx) {
    // 添加请求上下文信息用于调试
    const startTime = Date.now();
    
    try {
        return await worker.fetch(request, env, ctx);
    } finally {
        // 记录处理时间
        if (CONFIG.DEBUG) {
            const processingTime = Date.now() - startTime;
            const url = new URL(request.url);
            console.log(`[${new Date().toISOString()}] ${request.method} ${url.pathname} - ${processingTime}ms`);
        }
    }
}

// 导出默认处理器
export default {
    fetch: handleRequest,
    
    // 可选：导出一些调试方法
    getWorkerStatus: () => worker.getStatus(),
    getConfig: () => ({
        version: CONFIG.VERSION,
        environment: CONFIG.ENVIRONMENT,
        allowedTargets: CONFIG.ALLOWED_TARGETS.length,
        debug: CONFIG.DEBUG
    })
};

// 用于测试的导出（可选）
export { ProxyWorker, CONFIG };