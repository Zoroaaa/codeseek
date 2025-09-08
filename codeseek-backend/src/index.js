// src/index.js - 主入口文件（Cloudflare Workers 兼容版本）
import { Router } from './router.js';
import { utils } from './utils.js';
import { initializeCacheManager } from './services/cache-manager.js';

export default {
    async fetch(request, env, ctx) {
        try {
            // 环境变量检查
            const requiredEnvVars = ['JWT_SECRET', 'DB'];
            const missing = requiredEnvVars.filter(key => !env[key]);
            
            if (missing.length > 0) {
                console.error(`缺少必需的环境变量: ${missing.join(', ')}`);
                return utils.errorResponse(`服务器配置错误: 缺少${missing.join(', ')}`, 500);
            }

            // 初始化缓存管理器（传入 env 对象）
            await initializeCacheManager(env);

            const router = new Router();
            return await router.handle(request, env);
        } catch (error) {
            console.error('Worker错误:', error);
            return utils.errorResponse('服务器内部错误', 500);
        }
    }
};