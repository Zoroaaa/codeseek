// Cloudflare Worker 后端主文件 - 优化版本
// 修复CORS、路由匹配、安全性等关键问题

// 简化路由器实现
class Router {
    constructor() {
        this.routes = new Map();
    }

    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    options(path, handler) { this.addRoute('OPTIONS', path, handler); }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // 处理CORS预检请求
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: utils.getCorsHeaders(request.headers.get('Origin') || '*')
            });
        }

        // 查找精确匹配的路由
        const exactKey = `${method}:${pathname}`;
        if (this.routes.has(exactKey)) {
            return await this.executeHandler(this.routes.get(exactKey), request, env);
        }

        // 查找模式匹配的路由
        for (const [routeKey, handler] of this.routes) {
            const [routeMethod, routePath] = routeKey.split(':');
            if ((routeMethod === method || routeMethod === '*') && this.matchPath(routePath, pathname)) {
                return await this.executeHandler(handler, request, env);
            }
        }

        return utils.errorResponse('API路径未找到', 404);
    }

    async executeHandler(handler, request, env) {
        try {
            const result = await handler(request, env);
            // 确保所有响应都有CORS头
            if (result instanceof Response) {
                const corsHeaders = utils.getCorsHeaders(request.headers.get('Origin') || '*');
                Object.entries(corsHeaders).forEach(([key, value]) => {
                    result.headers.set(key, value);
                });
            }
            return result;
        } catch (error) {
            console.error('路由处理器错误:', error);
            return utils.errorResponse('内部服务器错误', 500);
        }
    }

    matchPath(routePath, requestPath) {
        if (routePath === requestPath) return true;
        if (routePath.endsWith('/*')) {
            const basePath = routePath.slice(0, -2);
            return requestPath.startsWith(basePath);
        }
        return false;
    }
}

// 工具函数
const utils = {
    generateId() {
        return crypto.randomUUID();
    },

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    async generateJWT(payload, secret) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const encodedHeader = btoa(JSON.stringify(header)).replace(/[=]/g, '');
        const encodedPayload = btoa(JSON.stringify(payload)).replace(/[=]/g, '');
        
        const data = `${encodedHeader}.${encodedPayload}`;
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
        const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[=]/g, '');
        
        return `${data}.${encodedSignature}`;
    },

    async verifyJWT(token, secret) {
        try {
            const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
            if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

            const data = `${encodedHeader}.${encodedPayload}`;
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );
            
            const padding = '='.repeat((4 - encodedSignature.length % 4) % 4);
            const signature = Uint8Array.from(atob(encodedSignature + padding), c => c.charCodeAt(0));
            const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
            
            if (!isValid) return null;
            
            const payloadPadding = '='.repeat((4 - encodedPayload.length % 4) % 4);
            const payload = JSON.parse(atob(encodedPayload + payloadPadding));
            
            if (payload.exp && Date.now() > payload.exp * 1000) {
                return null;
            }
            
            return payload;
        } catch (error) {
            console.error('JWT验证失败:', error);
            return null;
        }
    },

    getCorsHeaders(origin = '*') {
        // 更严格的CORS配置
        const allowedOrigins = ['http://localhost:3000', 'https://*.pages.dev'];
        const isAllowedOrigin = origin === '*' || allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = allowed.replace('*', '.*');
                return new RegExp(pattern).test(origin);
            }
            return allowed === origin;
        });

        return {
            'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Credentials': 'true',
            'Vary': 'Origin'
        };
    },

    jsonResponse(data, status = 200, origin = '*') {
        const response = new Response(JSON.stringify(data), {
            status,
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...this.getCorsHeaders(origin)
            }
        });
        return response;
    },

    errorResponse(message, status = 400, origin = '*') {
        return this.jsonResponse({ success: false, message, error: true }, status, origin);
    },

    successResponse(data = {}, origin = '*') {
        return this.jsonResponse({ success: true, ...data }, 200, origin);
    },

    getClientIP(request) {
        return request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
               request.headers.get('X-Real-IP') ||
               'unknown';
    },

    async logUserAction(env, userId, action, data, request) {
        try {
            if (env.ENABLE_ACTION_LOGGING !== 'true') return;

            const actionId = this.generateId();
            const ip = this.getClientIP(request);
            const userAgent = request.headers.get('User-Agent') || '';
            
            await env.DB.prepare(`
                INSERT INTO user_actions (id, user_id, action, data, ip_address, user_agent, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                actionId,
                userId,
                action,
                JSON.stringify(data),
                ip,
                userAgent,
                Date.now()
            ).run();
        } catch (error) {
            console.error('记录用户行为失败:', error);
        }
    },

    validateInput(data, rules) {
        const errors = [];
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (!value || value.toString().trim() === '')) {
                errors.push(`${field}是必需的`);
                continue;
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors.push(`${field}至少需要${rule.minLength}个字符`);
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${field}最多${rule.maxLength}个字符`);
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push(rule.message || `${field}格式不正确`);
            }
        }
        return errors;
    }
};

// 认证中间件
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET 环境变量未设置');
        return null;
    }

    const payload = await utils.verifyJWT(token, jwtSecret);
    if (!payload) return null;

    try {
        const tokenHash = await utils.hashPassword(token);
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, Date.now()).first();

        if (!session) return null;

        // 更新活动时间
        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();

        return {
            id: session.id,
            username: session.username,
            email: session.email,
            permissions: JSON.parse(session.permissions || '[]'),
            settings: JSON.parse(session.settings || '{}')
        };
    } catch (error) {
        console.error('认证查询失败:', error);
        return null;
    }
}

// 创建路由实例
const router = new Router();

// API路由定义
router.get('/api/health', async (request, env) => {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.0.0'
    });
});

router.post('/api/auth/register', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, email, password } = body;

        // 输入验证
        const errors = utils.validateInput({ username, email, password }, {
            username: { 
                required: true, 
                minLength: 3, 
                maxLength: 20,
                pattern: /^[a-zA-Z0-9_]+$/,
                message: '用户名只能包含字母、数字和下划线'
            },
            email: { 
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: '邮箱格式不正确'
            },
            password: { 
                required: true, 
                minLength: 6,
                maxLength: 50
            }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0]);
        }

        // 检查用户是否已存在
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return utils.errorResponse('用户名或邮箱已存在');
        }

        // 创建用户
        const userId = utils.generateId();
        const passwordHash = await utils.hashPassword(password);
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, username, email, passwordHash, now, now).run();

        return utils.successResponse({ 
            message: '注册成功',
            user: { id: userId, username, email }
        });

    } catch (error) {
        console.error('注册失败:', error);
        return utils.errorResponse('注册失败，请稍后重试', 500);
    }
});

router.post('/api/auth/login', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, password } = body;

        const errors = utils.validateInput({ username, password }, {
            username: { required: true },
            password: { required: true }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0]);
        }

        // 查找用户
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? OR email = ?
        `).bind(username, username).first();

        if (!user) {
            return utils.errorResponse('用户名或密码错误');
        }

        // 验证密码
        const passwordHash = await utils.hashPassword(password);
        if (passwordHash !== user.password_hash) {
            return utils.errorResponse('用户名或密码错误');
        }

        // 生成JWT
        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            return utils.errorResponse('服务器配置错误', 500);
        }

        const expiryDays = parseInt(env.JWT_EXPIRY_DAYS || '30');
        const expirySeconds = expiryDays * 24 * 60 * 60;

        const payload = {
            userId: user.id,
            username: user.username,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirySeconds
        };

        const token = await utils.generateJWT(payload, jwtSecret);
        const tokenHash = await utils.hashPassword(token);

        // 清理过期会话
        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, Date.now()).run();

        // 创建新会话
        const sessionId = utils.generateId();
        const expiresAt = Date.now() + (expirySeconds * 1000);

        await env.DB.prepare(`
            INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_activity)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(sessionId, user.id, tokenHash, expiresAt, Date.now(), Date.now()).run();

        return utils.successResponse({
            message: '登录成功',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                permissions: JSON.parse(user.permissions || '[]'),
                settings: JSON.parse(user.settings || '{}')
            }
        });

    } catch (error) {
        console.error('登录失败:', error);
        return utils.errorResponse('登录失败，请稍后重试', 500);
    }
});

router.get('/api/auth/verify', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }
    return utils.successResponse({ user });
});

router.post('/api/auth/logout', async (request, env) => {
    const user = await authenticate(request, env);
    if (user) {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader.substring(7);
        const tokenHash = await utils.hashPassword(token);

        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE token_hash = ?
        `).bind(tokenHash).run();
    }
    return utils.successResponse({ message: '退出成功' });
});

router.post('/api/user/favorites', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { favorites } = body;

        if (!Array.isArray(favorites)) {
            return utils.errorResponse('收藏夹数据格式错误');
        }

        const maxFavorites = parseInt(env.MAX_FAVORITES_PER_USER || '1000');
        if (favorites.length > maxFavorites) {
            return utils.errorResponse(`收藏夹数量不能超过 ${maxFavorites} 个`);
        }

        // 事务处理
        await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ?`).bind(user.id).run();

        for (const favorite of favorites) {
            const favoriteId = favorite.id || utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                favoriteId, user.id, favorite.title || '', favorite.subtitle || '', 
                favorite.url || '', favorite.icon || '', favorite.keyword || '',
                Date.now(), Date.now()
            ).run();
        }

        return utils.successResponse({ message: '收藏夹同步成功' });

    } catch (error) {
        console.error('同步收藏夹失败:', error);
        return utils.errorResponse('同步收藏夹失败', 500);
    }
});

router.get('/api/user/favorites', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC
        `).bind(user.id).all();

        const favorites = result.results.map(fav => ({
            id: fav.id,
            title: fav.title,
            subtitle: fav.subtitle,
            url: fav.url,
            icon: fav.icon,
            keyword: fav.keyword,
            addedAt: new Date(fav.created_at).toISOString()
        }));

        return utils.successResponse({ favorites });

    } catch (error) {
        console.error('获取收藏夹失败:', error);
        return utils.errorResponse('获取收藏夹失败', 500);
    }
});

router.get('/api/config', async (request, env) => {
    return utils.successResponse({
        allowRegistration: (env.ALLOW_REGISTRATION || 'true') === 'true',
        minUsernameLength: parseInt(env.MIN_USERNAME_LENGTH || '3'),
        maxUsernameLength: parseInt(env.MAX_USERNAME_LENGTH || '20'),
        minPasswordLength: parseInt(env.MIN_PASSWORD_LENGTH || '6'),
        maxFavoritesPerUser: parseInt(env.MAX_FAVORITES_PER_USER || '1000'),
        maxHistoryPerUser: parseInt(env.MAX_HISTORY_PER_USER || '1000'),
        version: env.APP_VERSION || '1.0.0'
    });
});

// 默认处理器
router.get('/*', (request) => {
    const url = new URL(request.url);
    return utils.errorResponse(`API路径不存在: ${url.pathname}`, 404);
});

// Worker主函数
export default {
    async fetch(request, env, ctx) {
        try {
            // 环境变量验证
            const requiredEnvVars = ['JWT_SECRET', 'DB'];
            const missing = requiredEnvVars.filter(key => !env[key]);
            
            if (missing.length > 0) {
                console.error(`缺少必需的环境变量: ${missing.join(', ')}`);
                return utils.errorResponse(`服务器配置错误: 缺少${missing.join(', ')}`, 500);
            }

            return await router.handle(request, env);
        } catch (error) {
            console.error('Worker错误:', error);
            return utils.errorResponse('服务器内部错误', 500);
        }
    }
};
