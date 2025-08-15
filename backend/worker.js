// Cloudflare Worker 后端主文件 - 优化版本
// 修复CORS、路由匹配、安全性等关键问题

// 简化路由器实现
class Router {
    constructor() {
        this.routes = new Map();
		this.middleware = [];
    }
	
	    // 添加中间件支持
    use(middleware) {
        this.middleware.push(middleware);
        return this;
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

// 同时更新 handle 方法以支持参数路由优先匹配
// 在 Router 类中优化 handle 方法
    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        try {
            // 处理CORS预检请求
            if (method === 'OPTIONS') {
                return new Response(null, {
                    status: 204,
                    headers: utils.getCorsHeaders(request.headers.get('Origin') || '*')
                });
            }

            // 执行中间件
            for (const middleware of this.middleware) {
                const result = await middleware(request, env);
                if (result instanceof Response) {
                    return result;
                }
            }

            // 路由匹配 - 改进算法
            const matchResult = this.findBestMatch(method, pathname);
            
            if (matchResult) {
                // 注入路由参数到request对象
                request.params = matchResult.params;
                request.query = this.parseQueryString(url.searchParams);
                
                return await this.executeHandler(matchResult.handler, request, env);
            }

            return utils.standardErrorResponse(
                `API路径不存在: ${pathname}`, 
                404, 
                'ROUTE_NOT_FOUND'
            );

        } catch (error) {
            console.error('路由处理错误:', error);
            return utils.standardErrorResponse(
                '服务器内部错误', 
                500, 
                'INTERNAL_ERROR'
            );
        }
    }
	
	    // 改进的路由匹配算法
    findBestMatch(method, pathname) {
        const routes = Array.from(this.routes.entries())
            .filter(([key]) => {
                const [routeMethod] = key.split(':');
                return routeMethod === method || routeMethod === '*';
            })
            .map(([key, handler]) => {
                const [, routePath] = key.split(':');
                const match = this.matchPathWithParams(routePath, pathname);
                return match ? { ...match, handler, routePath } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score); // 按匹配度排序

        return routes[0] || null;
    }
	
	    // 带参数的路径匹配
    matchPathWithParams(routePath, requestPath) {
        // 精确匹配
        if (routePath === requestPath) {
            return { params: {}, score: 1000 };
        }

        // 通配符匹配
        if (routePath.endsWith('/*')) {
            const basePath = routePath.slice(0, -2);
            if (requestPath.startsWith(basePath)) {
                return { 
                    params: { wildcard: requestPath.slice(basePath.length) }, 
                    score: 100 
                };
            }
        }

        // 参数匹配
        if (routePath.includes(':')) {
            const routeParts = routePath.split('/');
            const requestParts = requestPath.split('/');

            if (routeParts.length !== requestParts.length) {
                return null;
            }

            const params = {};
            let score = 500;

            for (let i = 0; i < routeParts.length; i++) {
                const routePart = routeParts[i];
                const requestPart = requestParts[i];

                if (routePart.startsWith(':')) {
                    // 参数部分
                    const paramName = routePart.slice(1);
                    params[paramName] = decodeURIComponent(requestPart);
                    score -= 10; // 参数匹配降低分数
                } else if (routePart !== requestPart) {
                    return null; // 静态部分不匹配
                } else {
                    score += 10; // 静态部分匹配增加分数
                }
            }

            return { params, score };
        }

        return null;
    }
	
	    // 解析查询字符串
    parseQueryString(searchParams) {
        const query = {};
        for (const [key, value] of searchParams.entries()) {
            query[key] = value;
        }
        return query;
    }
	
	


// 计算路由特异性（越具体的路由分数越高）
calculateSpecificity(routePath) {
    const parts = routePath.split('/');
    let score = 0;
    
    for (const part of parts) {
        if (part === '') continue;
        if (part.startsWith(':')) {
            score += 1; // 参数部分得分较低
        } else {
            score += 10; // 静态部分得分较高
        }
    }
    
    return score;
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

// 替换您的 Router 类中的 matchPath 方法
matchPath(routePath, requestPath) {
    // 精确匹配
    if (routePath === requestPath) return true;
    
    // 通配符匹配
    if (routePath.endsWith('/*')) {
        const basePath = routePath.slice(0, -2);
        return requestPath.startsWith(basePath);
    }
    
    // 参数匹配 (例如: /api/user/search-history/:id)
    if (routePath.includes(':')) {
        const routeParts = routePath.split('/');
        const requestParts = requestPath.split('/');
        
        if (routeParts.length !== requestParts.length) return false;
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];
            
            // 如果是参数（以:开头），跳过检查
            if (routePart.startsWith(':')) continue;
            
            // 否则必须完全匹配
            if (routePart !== requestPart) return false;
        }
        
        return true;
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
    },
	
    // 标准化成功响应
    standardSuccessResponse(data = {}, message = '操作成功', meta = {}) {
        const response = {
            success: true,
            code: 'SUCCESS',
            message,
            data,
            meta: {
                timestamp: Date.now(),
                version: process.env.APP_VERSION || '1.0.0',
                ...meta
            }
        };
        
        return this.jsonResponse(response, 200);
    },

    // 标准化错误响应
    standardErrorResponse(message, status = 400, errorCode = null, details = null) {
        const response = {
            success: false,
            error: true,
            code: errorCode || this.getErrorCode(status),
            message,
            details,
            meta: {
                timestamp: Date.now(),
                version: process.env.APP_VERSION || '1.0.0'
            }
        };
        
        return this.jsonResponse(response, status);
    },
	
	    // 获取错误代码
    getErrorCode(status) {
        const errorCodes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'VALIDATION_ERROR',
            429: 'RATE_LIMIT_EXCEEDED',
            500: 'INTERNAL_ERROR',
            502: 'BAD_GATEWAY',
            503: 'SERVICE_UNAVAILABLE'
        };
        
        return errorCodes[status] || 'UNKNOWN_ERROR';
    },

    // 分页响应标准化
    standardPaginatedResponse(data, pagination, message = '获取成功') {
        return this.standardSuccessResponse(data, message, {
            pagination: {
                total: pagination.total || 0,
                limit: pagination.limit || 50,
                offset: pagination.offset || 0,
                hasMore: pagination.hasMore || false,
                page: Math.floor((pagination.offset || 0) / (pagination.limit || 50)) + 1,
                totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 50))
            }
        });
    },

    // 验证必需参数
    validateRequiredParams(body, requiredFields) {
        const missing = [];
        for (const field of requiredFields) {
            if (!body[field] || 
                (typeof body[field] === 'string' && body[field].trim() === '')) {
                missing.push(field);
            }
        }
        return missing;
    },

    // 安全的JSON解析
    async safeJsonParse(request, fallback = {}) {
        try {
            return await request.json();
        } catch (error) {
            console.warn('JSON解析失败:', error);
            return fallback;
        }
    }
};




// 认证中间件
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    
    // 验证token格式
    if (!token || token.length < 10) {
        console.warn('Invalid token format');
        return null;
    }

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
        console.error('JWT_SECRET 环境变量未设置');
        return null;
    }

    try {
        // 验证JWT
        const payload = await utils.verifyJWT(token, jwtSecret);
        if (!payload) {
            console.warn('JWT验证失败');
            return null;
        }

        // 检查token过期
        if (payload.exp && Date.now() > payload.exp * 1000) {
            console.warn('Token已过期');
            return null;
        }

        // 查询数据库验证会话
        const tokenHash = await utils.hashPassword(token);
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, Date.now()).first();

        if (!session) {
            console.warn('会话不存在或已过期');
            return null;
        }

        // 检查用户状态
        if (!session.is_active) {
            console.warn('用户账户已禁用');
            return null;
        }

        // 更新活动时间
        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();

        return {
            id: session.id,
            username: session.username,
            email: session.email,
            permissions: JSON.parse(session.permissions || '[]'),
            settings: JSON.parse(session.settings || '{}'),
            isActive: session.is_active
        };
        
    } catch (error) {
        console.error('认证查询失败:', error);
        return null;
    }
}

// 错误处理装饰器函数
function withErrorHandling(handler) {
    return async (request, env) => {
        try {
            return await handler(request, env);
        } catch (error) {
            console.error('接口处理错误:', error);
            
            if (error.message.includes('认证')) {
                return utils.errorResponse('认证失败', 401);
            } else if (error.message.includes('权限')) {
                return utils.errorResponse('权限不足', 403);
            } else if (error.message.includes('不存在')) {
                return utils.errorResponse('资源不存在', 404);
            } else if (error.message.includes('格式') || error.message.includes('验证')) {
                return utils.errorResponse(error.message, 400);
            } else {
                return utils.errorResponse('服务器内部错误', 500);
            }
        }
    };
}

// 创建路由实例
const router = new Router();

// API路由定义
router.get('/api/health', async (request, env) => {
    const healthData = {
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.0.0',
        environment: env.ENVIRONMENT || 'production'
    };
    
    return utils.standardSuccessResponse(healthData, '服务健康检查正常');
});

router.post('/api/auth/register', async (request, env) => {
    try {
        const body = await utils.safeJsonParse(request, {});
        const { username, email, password } = body;

        // 输入验证
        const validation = validateRegistrationInput({ username, email, password }, env);
        if (!validation.valid) {
            return utils.standardErrorResponse(
                validation.message, 
                400, 
                'VALIDATION_ERROR',
                validation.details
            );
        }

        // 检查用户是否已存在
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return utils.standardErrorResponse(
                '用户名或邮箱已存在', 
                409, 
                'USER_EXISTS'
            );
        }

        // 创建用户
        const userId = utils.generateId();
        const passwordHash = await utils.hashPassword(password);
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, username, email, passwordHash, now, now).run();

        return utils.standardSuccessResponse(
            { 
                user: { 
                    id: userId, 
                    username, 
                    email,
                    createdAt: new Date(now).toISOString()
                }
            }, 
            '注册成功'
        );

    } catch (error) {
        console.error('注册失败:', error);
        return utils.standardErrorResponse(
            '注册失败，请稍后重试', 
            500, 
            'REGISTRATION_ERROR'
        );
    }
});

// 输入验证函数
function validateRegistrationInput({ username, email, password }, env) {
    const errors = [];
    
    // 用户名验证
    if (!username || typeof username !== 'string') {
        errors.push('用户名不能为空');
    } else {
        const minLength = parseInt(env.MIN_USERNAME_LENGTH || '3');
        const maxLength = parseInt(env.MAX_USERNAME_LENGTH || '20');
        
        if (username.length < minLength) {
            errors.push(`用户名至少${minLength}个字符`);
        }
        if (username.length > maxLength) {
            errors.push(`用户名最多${maxLength}个字符`);
        }
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            errors.push('用户名只能包含字母、数字、下划线或中文');
        }
    }
    
    // 邮箱验证
    if (!email || typeof email !== 'string') {
        errors.push('邮箱不能为空');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('邮箱格式不正确');
    }
    
    // 密码验证
    if (!password || typeof password !== 'string') {
        errors.push('密码不能为空');
    } else {
        const minLength = parseInt(env.MIN_PASSWORD_LENGTH || '6');
        if (password.length < minLength) {
            errors.push(`密码至少${minLength}个字符`);
        }
        if (password.length > 50) {
            errors.push('密码最多50个字符');
        }
    }
    
    return {
        valid: errors.length === 0,
        message: errors[0] || '',
        details: errors
    };
}

// 优化登录接口响应
router.post('/api/auth/login', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, password } = body;

        // 输入验证
        const errors = utils.validateInput({ username, password }, {
            username: { required: true, maxLength: 50 },
            password: { required: true, maxLength: 50 }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0], 400);
        }

        // 查找用户（支持用户名或邮箱）
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? OR email = ?
        `).bind(username, username).first();

        if (!user) {
            return utils.errorResponse('用户名或密码错误', 401);
        }

        // 验证密码
        const passwordHash = await utils.hashPassword(password);
        if (passwordHash !== user.password_hash) {
            return utils.errorResponse('用户名或密码错误', 401);
        }

        // 生成JWT
        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET 环境变量未设置');
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

        // 记录登录行为
        await utils.logUserAction(env, user.id, 'login', { 
            loginMethod: 'password',
            sessionId 
        }, request);

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


// 在文档2中增加密码修改路由
router.put('/api/auth/change-password', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);
        
        const body = await request.json();
        const { currentPassword, newPassword } = body;
        
        if (!currentPassword || !newPassword) {
            return utils.errorResponse('当前密码和新密码不能为空');
        }
        
        // 验证当前密码
        const userRecord = await env.DB.prepare(
            `SELECT password_hash FROM users WHERE id = ?`
        ).bind(user.id).first();
        
        if (!userRecord) return utils.errorResponse('用户不存在', 404);
        
        const currentHash = await utils.hashPassword(currentPassword);
        if (currentHash !== userRecord.password_hash) {
            return utils.errorResponse('当前密码错误');
        }
        
        // 更新密码
        const newHash = await utils.hashPassword(newPassword);
        await env.DB.prepare(
            `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
        ).bind(newHash, Date.now(), user.id).run();
        
        // 使所有会话失效
        await env.DB.prepare(
            `DELETE FROM user_sessions WHERE user_id = ?`
        ).bind(user.id).run();

        return utils.successResponse({ message: '密码修改成功' });
        
    } catch (error) {
        console.error('密码修改失败:', error);
        return utils.errorResponse('密码修改失败', 500);
    }
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

// 【新增】用户设置相关接口
router.get('/api/user/settings', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();

        const settings = userRecord ? JSON.parse(userRecord.settings || '{}') : {};

        return utils.successResponse({ 
            settings: {
                theme: settings.theme || 'light',
                autoSync: settings.autoSync !== false,
                cacheResults: settings.cacheResults !== false,
                maxHistoryPerUser: settings.maxHistoryPerUser || 1000,
                maxFavoritesPerUser: settings.maxFavoritesPerUser || 1000,
                ...settings
            }
        });

    } catch (error) {
        console.error('获取用户设置失败:', error);
        return utils.errorResponse('获取用户设置失败', 500);
    }
});

router.put('/api/user/settings', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { settings } = body;

        if (!settings || typeof settings !== 'object') {
            return utils.errorResponse('设置数据格式错误');
        }

        // 验证设置字段
        const allowedSettings = ['theme', 'autoSync', 'cacheResults', 'maxHistoryPerUser', 'maxFavoritesPerUser'];
        const filteredSettings = {};
        
        Object.keys(settings).forEach(key => {
            if (allowedSettings.includes(key)) {
                filteredSettings[key] = settings[key];
            }
        });

        // 获取现有设置
        const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();

        const currentSettings = userRecord ? JSON.parse(userRecord.settings || '{}') : {};
        const updatedSettings = { ...currentSettings, ...filteredSettings };

        // 更新用户设置
        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();

        return utils.successResponse({ 
            message: '设置更新成功',
            settings: updatedSettings
        });

    } catch (error) {
        console.error('更新用户设置失败:', error);
        return utils.errorResponse('更新用户设置失败', 500);
    }
});

// 增强Token验证接口
router.post('/api/auth/verify-token', async (request, env) => {
    try {
        const body = await utils.safeJsonParse(request, {});
        const { token } = body;

        // 参数验证
        if (!token || typeof token !== 'string' || token.trim().length === 0) {
            return utils.errorResponse('Token参数无效', 400, request.headers.get('Origin'), 'INVALID_TOKEN');
        }

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET 环境变量未设置');
            return utils.errorResponse('服务器配置错误', 500, request.headers.get('Origin'), 'SERVER_CONFIG_ERROR');
        }

        // 验证JWT格式和有效性
        const payload = await utils.verifyJWT(token, jwtSecret);
        if (!payload) {
            return utils.errorResponse('Token无效或已过期', 401, request.headers.get('Origin'), 'TOKEN_INVALID');
        }

        // 查询数据库验证会话
        const tokenHash = await utils.hashPassword(token);
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1
        `).bind(tokenHash, Date.now()).first();

        if (!session) {
            return utils.errorResponse('会话已过期或用户已禁用', 401, request.headers.get('Origin'), 'SESSION_EXPIRED');
        }

        // 更新最后活动时间
        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();

        // 构建用户信息
        const user = {
            id: session.id,
            username: session.username,
            email: session.email,
            permissions: JSON.parse(session.permissions || '[]'),
            settings: JSON.parse(session.settings || '{}'),
            lastLogin: session.last_login,
            loginCount: session.login_count
        };

        return utils.successResponse({ 
            valid: true,
            user,
            message: 'Token验证成功',
            expiresAt: payload.exp * 1000
        }, request.headers.get('Origin'));

    } catch (error) {
        console.error('Token验证失败:', error);
        return utils.errorResponse('Token验证失败', 401, request.headers.get('Origin'), 'VERIFICATION_ERROR');
    }
});



// 添加记录行为接口
router.post('/api/actions/record', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, data, timestamp, sessionId } = body;

        // 参数验证和清理
        let actionType = 'unknown';
        if (action && typeof action === 'string' && action.trim()) {
            actionType = action.trim();
        } else if (action && typeof action === 'object' && action.type) {
            actionType = String(action.type).trim();
        }

        // 验证action类型
        const allowedActions = [
            'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
            'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
            'sync_data', 'page_view', 'session_start', 'session_end'
        ];

        if (!allowedActions.includes(actionType)) {
            actionType = 'custom'; // 允许自定义行为类型
        }

        // 获取用户信息（可选）
        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        // 获取客户端信息
        const clientIP = utils.getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || '';
        const referer = request.headers.get('Referer') || '';

        // 记录到用户行为表
        if (userId && env.ENABLE_ACTION_LOGGING === 'true') {
            await utils.logUserAction(env, userId, actionType, data || {}, request);
        }

        // 如果启用分析功能，也记录到分析表
        if (env.ENABLE_ANALYTICS === 'true') {
            const recordId = utils.generateId();
            const recordTimestamp = timestamp || Date.now();

            await env.DB.prepare(`
                INSERT INTO analytics_events (
                    id, user_id, session_id, event_type, event_data, 
                    ip_address, user_agent, referer, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                recordId,
                userId,
                sessionId || utils.generateId(),
                actionType,
                JSON.stringify(data || {}),
                clientIP,
                userAgent,
                referer,
                recordTimestamp
            ).run();
        }

        return utils.successResponse({ 
            recorded: true,
            actionType,
            userId: userId || null,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('记录行为失败:', error);
        // 行为记录失败不应该影响用户体验
        return utils.successResponse({ 
            recorded: false, 
            error: 'silent_failure',
            message: '行为记录失败但不影响功能'
        });
    }
});

// 用户行为统计查询接口
router.get('/api/user/analytics', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 90);
        const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

        // 查询用户行为统计
        const actionStats = await env.DB.prepare(`
            SELECT action, COUNT(*) as count
            FROM user_actions 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY action
            ORDER BY count DESC
        `).bind(user.id, startTime).all();

        // 查询每日活动统计
        const dailyStats = await env.DB.prepare(`
            SELECT 
                DATE(created_at / 1000, 'unixepoch') as date,
                COUNT(*) as actions
            FROM user_actions 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY DATE(created_at / 1000, 'unixepoch')
            ORDER BY date DESC
        `).bind(user.id, startTime).all();

        // 获取搜索统计
        const searchStats = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        // 获取收藏统计
        const favoriteStats = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_favorites WHERE user_id = ?
        `).bind(user.id).first();

        return utils.successResponse({
            period: `${days}天`,
            actions: {
                total: actionStats.results.reduce((sum, item) => sum + item.count, 0),
                byType: actionStats.results
            },
            daily: dailyStats.results,
            searches: searchStats.total || 0,
            favorites: favoriteStats.total || 0
        });

    } catch (error) {
        console.error('获取用户统计失败:', error);
        return utils.errorResponse('获取统计数据失败', 500);
    }
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

// 保存搜索历史 - 修复版本
router.post('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { query, timestamp, source } = body;

        // 修复：确保query字段存在且有效
        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空');
        }

        const trimmedQuery = query.trim();
        
        // 输入验证
        if (trimmedQuery.length > 200) {
            return utils.errorResponse('搜索关键词过长');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        
        // 检查当前历史记录数量
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        // 如果超过限制，删除最旧的记录
        if (countResult.count >= maxHistory) {
            const deleteCount = countResult.count - maxHistory + 1;
            await env.DB.prepare(`
                DELETE FROM user_search_history 
                WHERE user_id = ? AND id IN (
                    SELECT id FROM user_search_history 
                    WHERE user_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT ?
                )
            `).bind(user.id, user.id, deleteCount).run();
        }

        // 添加新的搜索历史
        const historyId = utils.generateId();
        const now = timestamp || Date.now();

        await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, query, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(historyId, user.id, trimmedQuery, source || 'unknown', now).run();

        // 记录用户行为
        await utils.logUserAction(env, user.id, 'search', { query: trimmedQuery, source }, request);

        return utils.successResponse({ 
            message: '搜索历史保存成功',
            historyId 
        });

    } catch (error) {
        console.error('保存搜索历史失败:', error);
        return utils.errorResponse('保存搜索历史失败: ' + error.message, 500);
    }
});

// 修复同步搜索历史接口
router.post('/api/user/sync/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { searchHistory, history } = body;
        
        // 兼容两种格式
        const historyData = searchHistory || history || [];

        if (!Array.isArray(historyData)) {
            return utils.errorResponse('搜索历史数据格式错误');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        if (historyData.length > maxHistory) {
            return utils.errorResponse(`搜索历史数量不能超过 ${maxHistory} 条`);
        }

        // 清除现有搜索历史
        await env.DB.prepare(`DELETE FROM user_search_history WHERE user_id = ?`).bind(user.id).run();

        // 批量插入新的搜索历史
        for (const item of historyData) {
            // 确保每个item都有有效的查询字段，优先使用query
            const query = item.query || item.keyword;
            if (!query || typeof query !== 'string' || query.trim().length === 0) {
                continue; // 跳过无效记录
            }
            
            const historyId = item.id || utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_search_history (id, user_id, query, source, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                historyId,
                user.id,
                query.trim(),
                item.source || 'unknown',
                item.timestamp || Date.now()
            ).run();
        }

        return utils.successResponse({ message: '搜索历史同步成功' });

    } catch (error) {
        console.error('同步搜索历史失败:', error);
        return utils.errorResponse('同步搜索历史失败: ' + error.message, 500);
    }
});


// 获取搜索历史
router.get('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();

        const history = result.results.map(item => ({
            id: item.id,
            query: item.query,              // 主字段
            keyword: item.query,            // 兼容性字段
            source: item.source,
            timestamp: item.created_at,
            createdAt: new Date(item.created_at).toISOString()
        }));

        // 获取总数
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        return utils.successResponse({ 
            history,
            searchHistory: history, // 兼容性字段
            total: countResult.total,
            limit,
            offset,
            hasMore: (offset + limit) < countResult.total
        });

    } catch (error) {
        console.error('获取搜索历史失败:', error);
        return utils.errorResponse('获取搜索历史失败', 500);
    }
});


// 删除搜索历史记录
// 删除单条搜索历史（参数路由，优先级高）
router.delete('/api/user/search-history/:id', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const historyId = pathParts[pathParts.length - 1];

        // 验证ID格式
        if (!historyId || historyId === 'search-history' || historyId.length < 10) {
            return utils.errorResponse('历史记录ID格式无效', 400);
        }

        const result = await env.DB.prepare(`
            DELETE FROM user_search_history 
            WHERE id = ? AND user_id = ?
        `).bind(historyId, user.id).run();

        if (result.changes === 0) {
            return utils.errorResponse('历史记录不存在或无权删除', 404);
        }

        // 记录删除行为
        await utils.logUserAction(env, user.id, 'history_delete', { 
            historyId,
            deletedCount: 1 
        }, request);

        return utils.successResponse({ 
            message: '删除成功',
            deletedId: historyId
        });

    } catch (error) {
        console.error('删除搜索历史失败:', error);
        return utils.errorResponse('删除搜索历史失败', 500);
    }
});

// 清空搜索历史
// 清空所有搜索历史（精确路由）
router.delete('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 检查是否是清空操作（通过query参数区分）
        const url = new URL(request.url);
        const operation = url.searchParams.get('operation');
        
        if (operation !== 'clear') {
            return utils.errorResponse('请指定operation=clear参数以确认清空操作', 400);
        }

        // 获取删除前的数量统计
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        const deletedCount = countResult.count || 0;

        // 执行清空操作
        await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();

        // 记录清空行为
        await utils.logUserAction(env, user.id, 'history_clear', { 
            deletedCount 
        }, request);

        return utils.successResponse({ 
            message: '搜索历史已清空',
            deletedCount
        });

    } catch (error) {
        console.error('清空搜索历史失败:', error);
        return utils.errorResponse('清空搜索历史失败', 500);
    }
});

// 搜索历史统计
router.get('/api/user/search-stats', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 获取总搜索次数
        const totalResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        // 获取今天的搜索次数
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        const todayResult = await env.DB.prepare(`
            SELECT COUNT(*) as today FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, todayTimestamp).first();

        // 获取最近7天的搜索统计
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekResult = await env.DB.prepare(`
            SELECT COUNT(*) as week FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, weekAgo).first();

        // 获取热门搜索词（最近30天）
        const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const topQueriesResult = await env.DB.prepare(`
            SELECT query, COUNT(*) as count 
            FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY query 
            ORDER BY count DESC 
            LIMIT 10
        `).bind(user.id, monthAgo).all();

        const topQueries = topQueriesResult.results.map(item => ({
            query: item.query,
            count: item.count
        }));

        return utils.successResponse({
            total: totalResult.total,
            today: todayResult.today,
            thisWeek: weekResult.week,
            topQueries
        });

    } catch (error) {
        console.error('获取搜索统计失败:', error);
        return utils.errorResponse('获取搜索统计失败', 500);
    }
});

//删除账户
router.post('/api/auth/delete-account', async (request, env) => {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse('认证失败', 401);
  try {
    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id).run();
    return utils.successResponse({ message: "账户已删除" });
  } catch (e) {
    console.error('删除账户失败:', e);
    return utils.errorResponse('删除账户失败', 500);
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


// 健康检查接口增强
router.get('/api/system/status', async (request, env) => {
    try {
        // 检查数据库连接
        const dbCheck = await env.DB.prepare('SELECT 1 as test').first();
        
        // 检查关键环境变量
        const envCheck = {
            hasJwtSecret: !!env.JWT_SECRET,
            hasDatabase: !!env.DB,
            analyticsEnabled: env.ENABLE_ANALYTICS === 'true',
            actionLoggingEnabled: env.ENABLE_ACTION_LOGGING === 'true'
        };
        
        // 检查数据库表是否存在（可选）
        let tablesCheck = 'unknown';
        try {
            await env.DB.prepare('SELECT COUNT(*) FROM users LIMIT 1').first();
            tablesCheck = 'ok';
        } catch (e) {
            tablesCheck = 'missing_tables';
        }
        
        return utils.successResponse({
            status: 'healthy',
            version: env.APP_VERSION || '1.0.0',
            database: {
                connected: !!dbCheck,
                tables: tablesCheck
            },
            environment: envCheck,
            features: {
                registration: (env.ALLOW_REGISTRATION || 'true') === 'true',
                analytics: env.ENABLE_ANALYTICS === 'true',
                actionLogging: env.ENABLE_ACTION_LOGGING === 'true'
            },
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('系统状态检查失败:', error);
        return utils.errorResponse('系统状态检查失败', 500);
    }
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

