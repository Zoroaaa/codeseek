// Cloudflare Worker 后端主文件 - 优化版本，移除内置搜索源定义

// 🔧 简化的路由器实现 - 专门修复参数路由问题
class Router {
    constructor() {
        this.routes = new Map();
        this.paramRoutes = []; // 专门存储参数路由
    }

    addRoute(method, path, handler) {
        const key = `${method}:${path}`;
        this.routes.set(key, handler);
        
        // 如果是参数路由，单独存储
        if (path.includes(':')) {
            this.paramRoutes.push({
                method,
                path,
                handler,
                pattern: this.createPattern(path)
            });
        }
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    options(path, handler) { this.addRoute('OPTIONS', path, handler); }

    // 创建路由匹配模式
    createPattern(path) {
        const parts = path.split('/');
        return {
            parts,
            paramNames: parts.filter(part => part.startsWith(':')).map(part => part.substring(1))
        };
    }

    // 🔧 简化的路由处理逻辑
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

        // 1. 优先尝试精确匹配
        const exactKey = `${method}:${pathname}`;
        if (this.routes.has(exactKey)) {
            console.log(`精确匹配路由: ${exactKey}`);
            return await this.executeHandler(this.routes.get(exactKey), request, env);
        }

        // 2. 尝试参数路由匹配
        for (const route of this.paramRoutes) {
            if (route.method === method) {
                const match = this.matchRoute(route.pattern, pathname);
                if (match.success) {
                    console.log(`参数路由匹配: ${route.path}, 参数:`, match.params);
                    // 将参数添加到request对象
                    request.params = match.params;
                    return await this.executeHandler(route.handler, request, env);
                }
            }
        }

        // 3. 尝试通配符路由
        const wildcardKey = `${method}:/*`;
        if (this.routes.has(wildcardKey)) {
            return await this.executeHandler(this.routes.get(wildcardKey), request, env);
        }

        console.error(`未找到匹配的路由: ${method} ${pathname}`);
        console.log('可用的参数路由:', this.paramRoutes.map(r => `${r.method}:${r.path}`));
        
        return utils.errorResponse(`API路径不存在: ${pathname}`, 404);
    }

    // 🔧 简化的路由匹配算法
    matchRoute(pattern, pathname) {
        const requestParts = pathname.split('/');
        const routeParts = pattern.parts;

        // 路径段数量必须相等
        if (requestParts.length !== routeParts.length) {
            return { success: false, params: {} };
        }

        const params = {};
        
        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];
            const requestPart = requestParts[i];

            if (routePart.startsWith(':')) {
                // 参数部分
                const paramName = routePart.substring(1);
                params[paramName] = requestPart;
            } else if (routePart !== requestPart) {
                // 静态部分必须完全匹配
                return { success: false, params: {} };
            }
        }

        return { success: true, params };
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
        const allowedOrigins = ['http://localhost:3000', 'https://*.pages.dev', 'https://*.tvhub.pp.ua'];
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
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                ...this.getCorsHeaders(origin)
            }
        });
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

    successResponse(data = {}, origin = '*') {
        return this.jsonResponse({
            success: true,
            timestamp: Date.now(),
            ...data
        }, 200, origin);
    },

    errorResponse(message, status = 400, origin = '*', errorCode = null) {
        return this.jsonResponse({
            success: false,
            error: true,
            message,
            code: errorCode,
            timestamp: Date.now()
        }, status, origin);
    },

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

// 健康检查
router.get('/api/health', async (request, env) => {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.3.0'
    });
});

// 认证相关路由
router.post('/api/auth/register', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, email, password } = body;

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

        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return utils.errorResponse('用户名或邮箱已存在');
        }

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
            username: { required: true, maxLength: 50 },
            password: { required: true, maxLength: 50 }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0], 400);
        }

        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE username = ? OR email = ?
        `).bind(username, username).first();

        if (!user) {
            return utils.errorResponse('用户名或密码错误', 401);
        }

        const passwordHash = await utils.hashPassword(password);
        if (passwordHash !== user.password_hash) {
            return utils.errorResponse('用户名或密码错误', 401);
        }

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

        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, Date.now()).run();

        const sessionId = utils.generateId();
        const expiresAt = Date.now() + (expirySeconds * 1000);

        await env.DB.prepare(`
            INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_activity)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(sessionId, user.id, tokenHash, expiresAt, Date.now(), Date.now()).run();

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

router.post('/api/auth/verify-token', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { token } = body;

        if (!token || typeof token !== 'string') {
            return utils.errorResponse('Token参数无效', 400);
        }

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            console.error('JWT_SECRET 环境变量未设置');
            return utils.errorResponse('服务器配置错误', 500);
        }

        const payload = await utils.verifyJWT(token, jwtSecret);
        if (!payload) {
            return utils.errorResponse('Token无效或已过期', 401);
        }

        const tokenHash = await utils.hashPassword(token);
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, Date.now()).first();

        if (!session) {
            return utils.errorResponse('会话已过期或不存在', 401);
        }

        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();

        const user = {
            id: session.id,
            username: session.username,
            email: session.email,
            permissions: JSON.parse(session.permissions || '[]'),
            settings: JSON.parse(session.settings || '{}')
        };

        return utils.successResponse({ 
            valid: true,
            user,
            message: 'Token验证成功'
        });

    } catch (error) {
        console.error('Token验证失败:', error);
        return utils.errorResponse('Token验证失败', 401);
    }
});

router.put('/api/auth/change-password', async (request, env) => {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);
        
        const body = await request.json();
        const { currentPassword, newPassword } = body;
        
        if (!currentPassword || !newPassword) {
            return utils.errorResponse('当前密码和新密码不能为空');
        }
        
        const userRecord = await env.DB.prepare(
            `SELECT password_hash FROM users WHERE id = ?`
        ).bind(user.id).first();
        
        if (!userRecord) return utils.errorResponse('用户不存在', 404);
        
        const currentHash = await utils.hashPassword(currentPassword);
        if (currentHash !== userRecord.password_hash) {
            return utils.errorResponse('当前密码错误');
        }
        
        const newHash = await utils.hashPassword(newPassword);
        await env.DB.prepare(
            `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
        ).bind(newHash, Date.now(), user.id).run();
        
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

// 在现有 worker.js 文件末尾，删除账户API之前添加以下搜索源状态检查API

// 🆕 搜索源状态检查相关API
router.post('/api/source-status/check', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { sources, keyword, options = {} } = body;
        
        if (!sources || !Array.isArray(sources) || sources.length === 0) {
            return utils.errorResponse('搜索源列表不能为空', 400);
        }
        
        if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空', 400);
        }
        
        const trimmedKeyword = keyword.trim();
        const keywordHash = await utils.hashPassword(`${trimmedKeyword}${Date.now()}`);
        const timeout = Math.min(Math.max(options.timeout || 10000, 3000), 30000);
        const checkContentMatch = options.checkContentMatch !== false;
        
        console.log(`开始检查 ${sources.length} 个搜索源，关键词: ${trimmedKeyword}`);
        
        const results = [];
        const concurrency = Math.min(sources.length, 3); // 限制并发数
        
        // 分批并发处理
        for (let i = 0; i < sources.length; i += concurrency) {
            const batch = sources.slice(i, i + concurrency);
            const batchPromises = batch.map(source => 
                checkSingleSourceStatus(source, trimmedKeyword, keywordHash, {
                    timeout,
                    checkContentMatch,
                    env
                })
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 添加批次间延迟
            if (i + concurrency < sources.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        // 保存检查结果到数据库（异步）
        saveStatusCheckResults(env, results, trimmedKeyword).catch(console.error);
        
        // 统计结果
        const summary = {
            total: results.length,
            available: results.filter(r => r.status === 'available').length,
            unavailable: results.filter(r => r.status === 'unavailable').length,
            timeout: results.filter(r => r.status === 'timeout').length,
            error: results.filter(r => r.status === 'error').length,
            averageResponseTime: Math.round(
                results.filter(r => r.responseTime > 0)
                    .reduce((sum, r) => sum + r.responseTime, 0) / 
                Math.max(results.filter(r => r.responseTime > 0).length, 1)
            ),
            keyword: trimmedKeyword,
            timestamp: Date.now()
        };
        
        return utils.successResponse({
            summary,
            results,
            message: `搜索源状态检查完成: ${summary.available}/${summary.total} 可用`
        });
        
    } catch (error) {
        console.error('搜索源状态检查失败:', error);
        return utils.errorResponse('搜索源状态检查失败: ' + error.message, 500);
    }
});

// 获取搜索源状态检查历史
router.get('/api/source-status/history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }
    
    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
        const keyword = url.searchParams.get('keyword');
        
        let query = `
            SELECT * FROM source_status_cache 
            WHERE 1=1
        `;
        const params = [];
        
        if (keyword) {
            query += ` AND keyword LIKE ?`;
            params.push(`%${keyword}%`);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        const history = result.results.map(item => ({
            id: item.id,
            sourceId: item.source_id,
            keyword: item.keyword,
            status: item.status,
            available: Boolean(item.available),
            contentMatch: Boolean(item.content_match),
            responseTime: item.response_time,
            qualityScore: item.quality_score,
            lastChecked: item.created_at,
            checkError: item.check_error
        }));
        
        return utils.successResponse({
            history,
            total: result.results.length,
            limit,
            offset
        });
        
    } catch (error) {
        console.error('获取状态检查历史失败:', error);
        return utils.errorResponse('获取历史失败', 500);
    }
});

// 单个搜索源状态检查函数
async function checkSingleSourceStatus(source, keyword, keywordHash, options = {}) {
    const { timeout, checkContentMatch, env } = options;
    const sourceId = source.id || source.name;
    const startTime = Date.now();
    
    try {
        // 检查缓存
        const cached = await getCachedSourceStatus(env, sourceId, keywordHash);
        if (cached && isCacheValid(cached)) {
            console.log(`使用缓存结果: ${sourceId}`);
            return {
                sourceId,
                sourceName: source.name,
                status: cached.status,
                available: cached.available,
                contentMatch: cached.content_match,
                responseTime: cached.response_time,
                lastChecked: cached.created_at,
                fromCache: true
            };
        }
        
        // 构建检查URL
        const checkUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(keyword));
        console.log(`检查URL: ${checkUrl}`);
        
        // 执行HTTP检查
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(checkUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'MagnetSearch-StatusChecker/1.3.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
                'Cache-Control': 'no-cache'
            },
            // 在Cloudflare Workers中不需要设置CORS相关选项
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        // 基础可用性检查
        const isAvailable = response.ok && response.status < 400;
        let contentMatch = false;
        let qualityScore = 0;
        let matchDetails = {};
        
        // 内容匹配检查
        if (isAvailable && checkContentMatch) {
            try {
                const content = await response.text();
                const matchResult = analyzePageContent(content, keyword, source);
                contentMatch = matchResult.hasMatch;
                qualityScore = matchResult.qualityScore;
                matchDetails = matchResult.details;
                
                console.log(`内容匹配检查 ${sourceId}: ${contentMatch ? '匹配' : '不匹配'}, 质量分数: ${qualityScore}`);
            } catch (contentError) {
                console.warn(`内容检查失败 ${sourceId}:`, contentError.message);
            }
        }
        
        // 确定最终状态
        let finalStatus = 'error';
        if (isAvailable) {
            if (checkContentMatch) {
                finalStatus = contentMatch ? 'available' : 'unavailable';
            } else {
                finalStatus = 'available';
            }
        } else if (response.status === 404) {
            finalStatus = 'unavailable';
        } else if (responseTime >= timeout * 0.9) {
            finalStatus = 'timeout';
        } else {
            finalStatus = 'unavailable';
        }
        
        const result = {
            sourceId,
            sourceName: source.name,
            status: finalStatus,
            available: finalStatus === 'available',
            contentMatch,
            responseTime,
            qualityScore,
            httpStatus: response.status,
            lastChecked: Date.now(),
            matchDetails,
            fromCache: false
        };
        
        // 异步保存到缓存
        saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
        
        return result;
        
    } catch (error) {
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        console.error(`检查源失败 ${sourceId}:`, error.message);
        
        let status = 'error';
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            status = 'timeout';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            status = 'unavailable';
        }
        
        const result = {
            sourceId,
            sourceName: source.name,
            status,
            available: false,
            contentMatch: false,
            responseTime,
            qualityScore: 0,
            lastChecked: Date.now(),
            error: error.message,
            fromCache: false
        };
        
        // 异步保存错误结果到缓存
        saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
        
        return result;
    }
}

// 分析页面内容
function analyzePageContent(content, keyword, source) {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let qualityScore = 0;
    const details = {
        titleMatch: false,
        bodyMatch: false,
        exactMatch: false,
        partialMatch: false,
        resultCount: 0,
        keywordPositions: []
    };
    
    // 检查精确匹配
    if (lowerContent.includes(lowerKeyword)) {
        details.exactMatch = true;
        qualityScore += 50;
        
        // 找到所有关键词位置
        let position = 0;
        while ((position = lowerContent.indexOf(lowerKeyword, position)) !== -1) {
            details.keywordPositions.push(position);
            position += lowerKeyword.length;
        }
    }
    
    // 检查标题匹配
    const titleMatch = content.match(/<title[^>]*>([^<]*)</i);
    if (titleMatch && titleMatch[1].toLowerCase().includes(lowerKeyword)) {
        details.titleMatch = true;
        qualityScore += 30;
    }
    
    // 检查番号格式（如果是番号搜索）
    if (/^[A-Za-z]+-?\d+$/i.test(keyword)) {
        const numberPattern = keyword.replace('-', '-?');
        const regex = new RegExp(numberPattern, 'gi');
        const matches = content.match(regex);
        if (matches) {
            details.exactMatch = true;
            qualityScore += 40;
            details.resultCount = matches.length;
        }
    }
    
    // 检查部分匹配（关键词的各部分）
    if (!details.exactMatch && keyword.length > 3) {
        const parts = keyword.split(/[-_\s]+/);
        let partialMatches = 0;
        
        parts.forEach(part => {
            if (part.length > 2 && lowerContent.includes(part.toLowerCase())) {
                partialMatches++;
            }
        });
        
        if (partialMatches > 0) {
            details.partialMatch = true;
            qualityScore += Math.min(partialMatches * 10, 30);
        }
    }
    
    // 检查是否有搜索结果列表
    const resultIndicators = [
        /result/gi,
        /search.*result/gi,
        /找到.*结果/gi,
        /共.*条/gi,
        /<div[^>]*class[^>]*result/gi
    ];
    
    let resultCount = 0;
    resultIndicators.forEach(indicator => {
        const matches = content.match(indicator);
        if (matches) resultCount += matches.length;
    });
    
    if (resultCount > 0) {
        details.resultCount = resultCount;
        qualityScore += Math.min(resultCount * 5, 20);
    }
    
    // 检查是否是"无结果"页面
    const noResultIndicators = [
        /no.*result/gi,
        /not.*found/gi,
        /没有.*结果/gi,
        /未找到/gi,
        /暂无.*内容/gi
    ];
    
    const hasNoResultIndicator = noResultIndicators.some(indicator => 
        content.match(indicator)
    );
    
    if (hasNoResultIndicator) {
        qualityScore = Math.max(0, qualityScore - 30);
    }
    
    // 最终质量评分
    qualityScore = Math.min(100, Math.max(0, qualityScore));
    
    const hasMatch = details.exactMatch || (details.partialMatch && qualityScore > 20);
    
    return {
        hasMatch,
        qualityScore,
        details
    };
}

// 缓存相关函数
async function getCachedSourceStatus(env, sourceId, keywordHash) {
    try {
        return await env.DB.prepare(`
            SELECT * FROM source_status_cache 
            WHERE source_id = ? AND keyword_hash = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `).bind(sourceId, keywordHash).first();
    } catch (error) {
        console.error('获取缓存状态失败:', error);
        return null;
    }
}

function isCacheValid(cached, maxAge = 300000) { // 5分钟默认缓存
    if (!cached) return false;
    return Date.now() - cached.created_at < maxAge;
}

async function saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result) {
    try {
        const cacheId = utils.generateId();
        await env.DB.prepare(`
            INSERT INTO source_status_cache (
                id, source_id, keyword, keyword_hash, status, available, content_match,
                response_time, quality_score, match_details, page_info, check_error,
                expires_at, created_at, last_accessed, access_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            cacheId, sourceId, keyword, keywordHash, result.status,
            result.available ? 1 : 0, result.contentMatch ? 1 : 0,
            result.responseTime, result.qualityScore || 0,
            JSON.stringify(result.matchDetails || {}),
            JSON.stringify({ httpStatus: result.httpStatus }),
            result.error || null,
            Date.now() + 300000, // 5分钟后过期
            Date.now(), Date.now(), 1
        ).run();
    } catch (error) {
        console.error('保存缓存状态失败:', error);
    }
}

async function saveStatusCheckResults(env, results, keyword) {
    try {
        // 更新健康度统计
        for (const result of results) {
            await updateSourceHealthStats(env, result);
        }
        
        console.log(`已保存 ${results.length} 个搜索源的状态检查结果`);
    } catch (error) {
        console.error('保存状态检查结果失败:', error);
    }
}

async function updateSourceHealthStats(env, result) {
    try {
        const sourceId = result.sourceId;
        
        // 获取当前统计
        const currentStats = await env.DB.prepare(`
            SELECT * FROM source_health_stats WHERE source_id = ?
        `).bind(sourceId).first();
        
        if (currentStats) {
            // 更新现有统计
            const newTotalChecks = currentStats.total_checks + 1;
            const newSuccessfulChecks = currentStats.successful_checks + (result.available ? 1 : 0);
            const newContentMatches = currentStats.content_matches + (result.contentMatch ? 1 : 0);
            const newSuccessRate = newSuccessfulChecks / newTotalChecks;
            
            // 更新平均响应时间
            const newAvgResponseTime = Math.round(
                (currentStats.average_response_time * currentStats.total_checks + result.responseTime) / newTotalChecks
            );
            
            // 计算健康度分数
            const healthScore = Math.round(newSuccessRate * 100);
            
            await env.DB.prepare(`
                UPDATE source_health_stats SET
                    total_checks = ?, successful_checks = ?, content_matches = ?,
                    average_response_time = ?, success_rate = ?, health_score = ?,
                    last_success = ?, last_failure = ?, updated_at = ?
                WHERE source_id = ?
            `).bind(
                newTotalChecks, newSuccessfulChecks, newContentMatches,
                newAvgResponseTime, newSuccessRate, healthScore,
                result.available ? Date.now() : currentStats.last_success,
                result.available ? currentStats.last_failure : Date.now(),
                Date.now(), sourceId
            ).run();
        } else {
            // 创建新统计
            const statsId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO source_health_stats (
                    id, source_id, total_checks, successful_checks, content_matches,
                    average_response_time, last_success, last_failure, success_rate,
                    health_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                statsId, sourceId, 1, result.available ? 1 : 0, result.contentMatch ? 1 : 0,
                result.responseTime,
                result.available ? Date.now() : null,
                result.available ? null : Date.now(),
                result.available ? 1.0 : 0.0,
                result.available ? 100 : 0,
                Date.now()
            ).run();
        }
    } catch (error) {
        console.error('更新源健康度统计失败:', error);
    }
}

// 社区功能后端API扩展 - 添加到现有 worker.js 文件中

// ==================== 社区搜索源管理API ====================

// 获取社区搜索源列表
router.get('/api/community/sources', async (request, env) => {
    try {
        const url = new URL(request.url);
        const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = (page - 1) * limit;
        
        const category = url.searchParams.get('category') || 'all';
        const sortBy = url.searchParams.get('sort') || 'created_at';
        const order = url.searchParams.get('order') || 'desc';
        const search = url.searchParams.get('search');
        const tags = url.searchParams.get('tags');
        const featured = url.searchParams.get('featured') === 'true';
        
        // 构建查询条件
        let whereConditions = ['status = ?'];
        let params = ['active'];
        
        if (category !== 'all') {
            whereConditions.push('source_category = ?');
            params.push(category);
        }
        
        if (search) {
            whereConditions.push('(source_name LIKE ? OR description LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (featured) {
            whereConditions.push('is_featured = ?');
            params.push(1);
        }
        
        // 构建排序条件
        const validSortColumns = ['created_at', 'updated_at', 'rating_score', 'download_count', 'like_count', 'view_count'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        // 查询总数
        const countQuery = `
            SELECT COUNT(*) as total FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
        `;
        const countResult = await env.DB.prepare(countQuery).bind(...params).first();
        const total = countResult.total;
        
        // 查询数据
        const dataQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count,
                (SELECT GROUP_CONCAT(tag_name) FROM community_source_tags cst 
                 WHERE cst.id IN (
                     SELECT value FROM json_each(css.tags) WHERE json_valid(css.tags)
                 )) as tag_names
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const result = await env.DB.prepare(dataQuery).bind(...params, limit, offset).all();
        
        const sources = result.results.map(source => ({
            id: source.id,
            name: source.source_name,
            subtitle: source.source_subtitle,
            icon: source.source_icon,
            urlTemplate: source.source_url_template,
            category: source.source_category,
            description: source.description,
            tags: source.tag_names ? source.tag_names.split(',') : [],
            author: {
                id: source.user_id,
                name: source.author_name
            },
            stats: {
                downloads: source.download_count,
                likes: source.like_count,
                views: source.view_count,
                rating: source.rating_score,
                reviewCount: source.review_count
            },
            isVerified: Boolean(source.is_verified),
            isFeatured: Boolean(source.is_featured),
            createdAt: source.created_at,
            updatedAt: source.updated_at,
            lastTestedAt: source.last_tested_at
        }));
        
        return utils.successResponse({
            sources,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: offset + limit < total,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('获取社区搜索源列表失败:', error);
        return utils.errorResponse('获取搜索源列表失败', 500);
    }
});

// 获取单个搜索源详情
router.get('/api/community/sources/:id', async (request, env) => {
    try {
        const sourceId = request.params.id;
        
        // 增加浏览量
        await env.DB.prepare(`
            UPDATE community_shared_sources 
            SET view_count = view_count + 1 
            WHERE id = ?
        `).bind(sourceId).run();
        
        // 获取搜索源详情
        const sourceResult = await env.DB.prepare(`
            SELECT 
                css.*,
                u.username as author_name,
                u.id as author_id,
                cus.reputation_score as author_reputation,
                cus.shared_sources_count as author_total_shares
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            LEFT JOIN community_user_stats cus ON css.user_id = cus.user_id
            WHERE css.id = ? AND css.status = ?
        `).bind(sourceId, 'active').first();
        
        if (!sourceResult) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        // 获取评论和评分
        const reviewsResult = await env.DB.prepare(`
            SELECT 
                csr.*,
                CASE WHEN csr.is_anonymous = 1 THEN '匿名用户' ELSE u.username END as reviewer_name
            FROM community_source_reviews csr
            LEFT JOIN users u ON csr.user_id = u.id
            WHERE csr.shared_source_id = ?
            ORDER BY csr.created_at DESC
            LIMIT 10
        `).bind(sourceId).all();
        
        const reviews = reviewsResult.results.map(review => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            reviewerName: review.reviewer_name,
            isAnonymous: Boolean(review.is_anonymous),
            createdAt: review.created_at
        }));
        
        // 获取标签信息
        const tags = sourceResult.tags ? JSON.parse(sourceResult.tags) : [];
        const tagDetails = [];
        
        if (tags.length > 0) {
            const tagQuery = `SELECT * FROM community_source_tags WHERE id IN (${tags.map(() => '?').join(',')})`;
            const tagResult = await env.DB.prepare(tagQuery).bind(...tags).all();
            tagDetails.push(...tagResult.results.map(tag => ({
                id: tag.id,
                name: tag.tag_name,
                color: tag.tag_color,
                isOfficial: Boolean(tag.is_official)
            })));
        }
        
        const source = {
            id: sourceResult.id,
            name: sourceResult.source_name,
            subtitle: sourceResult.source_subtitle,
            icon: sourceResult.source_icon,
            urlTemplate: sourceResult.source_url_template,
            category: sourceResult.source_category,
            description: sourceResult.description,
            tags: tagDetails,
            author: {
                id: sourceResult.author_id,
                name: sourceResult.author_name,
                reputation: sourceResult.author_reputation || 0,
                totalShares: sourceResult.author_total_shares || 0
            },
            stats: {
                downloads: sourceResult.download_count,
                likes: sourceResult.like_count,
                views: sourceResult.view_count,
                rating: sourceResult.rating_score,
                reviewCount: sourceResult.rating_count
            },
            reviews,
            isVerified: Boolean(sourceResult.is_verified),
            isFeatured: Boolean(sourceResult.is_featured),
            createdAt: sourceResult.created_at,
            updatedAt: sourceResult.updated_at,
            lastTestedAt: sourceResult.last_tested_at
        };
        
        return utils.successResponse({ source });
        
    } catch (error) {
        console.error('获取搜索源详情失败:', error);
        return utils.errorResponse('获取搜索源详情失败', 500);
    }
});

// 分享搜索源到社区
router.post('/api/community/sources', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const body = await request.json().catch(() => ({}));
        const { name, subtitle, icon, urlTemplate, category, description, tags } = body;
        
        // 验证必填字段
        const missingFields = utils.validateRequiredParams(body, ['name', 'urlTemplate', 'category']);
        if (missingFields.length > 0) {
            return utils.errorResponse(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        
        // 验证URL模板
        if (!urlTemplate.includes('{keyword}')) {
            return utils.errorResponse('URL模板必须包含{keyword}占位符');
        }
        
        // 验证URL格式
        try {
            new URL(urlTemplate.replace('{keyword}', 'test'));
        } catch (error) {
            return utils.errorResponse('URL格式无效');
        }
        
        // 检查用户分享限制
        const userShareCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM community_shared_sources 
            WHERE user_id = ? AND status IN ('active', 'pending')
        `).bind(user.id).first();
        
        const maxShares = parseInt(env.COMMUNITY_MAX_SHARES_PER_USER || '50');
        if (userShareCount.count >= maxShares) {
            return utils.errorResponse(`每个用户最多只能分享${maxShares}个搜索源`);
        }
        
        // 检查是否已存在相同的搜索源
        const existingSource = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE (source_name = ? OR source_url_template = ?) 
            AND status = 'active'
        `).bind(name, urlTemplate).first();
        
        if (existingSource) {
            return utils.errorResponse('相同名称或URL的搜索源已存在');
        }
        
        // 创建新的分享搜索源
        const sourceId = utils.generateId();
        const now = Date.now();
        
        // 处理标签
        const processedTags = Array.isArray(tags) ? tags.slice(0, 10) : [];
        
        await env.DB.prepare(`
            INSERT INTO community_shared_sources (
                id, user_id, source_name, source_subtitle, source_icon, 
                source_url_template, source_category, description, tags,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            sourceId, user.id, name.trim(), subtitle?.trim() || null, 
            icon?.trim() || '🔍', urlTemplate.trim(), category, 
            description?.trim() || null, JSON.stringify(processedTags),
            env.COMMUNITY_REQUIRE_APPROVAL === 'true' ? 'pending' : 'active',
            now, now
        ).run();
        
        // 记录用户行为
        await utils.logUserAction(env, user.id, 'community_source_shared', {
            sourceId,
            sourceName: name,
            category
        }, request);
        
        const status = env.COMMUNITY_REQUIRE_APPROVAL === 'true' ? 'pending' : 'active';
        const message = status === 'pending' ? 
            '搜索源已提交，等待管理员审核' : 
            '搜索源分享成功';
        
        return utils.successResponse({
            message,
            sourceId,
            status
        });
        
    } catch (error) {
        console.error('分享搜索源失败:', error);
        return utils.errorResponse('分享搜索源失败: ' + error.message, 500);
    }
});

// 下载/采用搜索源
router.post('/api/community/sources/:id/download', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        
        // 获取搜索源信息
        const source = await env.DB.prepare(`
            SELECT * FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        // 记录下载
        const downloadId = utils.generateId();
        const ip = utils.getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || '';
        
        await env.DB.prepare(`
            INSERT INTO community_source_downloads (
                id, shared_source_id, user_id, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(downloadId, sourceId, user.id, ip, userAgent, Date.now()).run();
        
        // 获取用户当前的自定义搜索源设置
        const userSettings = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();
        
        const settings = userSettings ? JSON.parse(userSettings.settings || '{}') : {};
        const customSources = settings.customSearchSources || [];
        
        // 生成新的搜索源ID
        const newSourceId = `community_${sourceId}_${Date.now()}`;
        
        // 添加到用户的自定义搜索源
        const newCustomSource = {
            id: newSourceId,
            name: source.source_name,
            subtitle: source.source_subtitle,
            icon: source.source_icon,
            urlTemplate: source.source_url_template,
            category: source.source_category,
            isCustom: true,
            isFromCommunity: true,
            communitySourceId: sourceId,
            createdAt: Date.now()
        };
        
        customSources.push(newCustomSource);
        
        // 添加到启用的搜索源列表
        const enabledSources = settings.searchSources || [];
        if (!enabledSources.includes(newSourceId)) {
            enabledSources.push(newSourceId);
        }
        
        // 更新用户设置
        const updatedSettings = {
            ...settings,
            customSearchSources: customSources,
            searchSources: enabledSources
        };
        
        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();
        
        // 记录用户行为
        await utils.logUserAction(env, user.id, 'community_source_downloaded', {
            sourceId,
            sourceName: source.source_name,
            newSourceId
        }, request);
        
        return utils.successResponse({
            message: '搜索源已添加到您的自定义搜索源',
            newSourceId,
            source: newCustomSource
        });
        
    } catch (error) {
        console.error('下载搜索源失败:', error);
        return utils.errorResponse('下载搜索源失败: ' + error.message, 500);
    }
});

// 点赞/收藏搜索源
router.post('/api/community/sources/:id/like', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const likeType = body.type || 'like'; // like, favorite, bookmark
        
        // 验证点赞类型
        if (!['like', 'favorite', 'bookmark'].includes(likeType)) {
            return utils.errorResponse('无效的操作类型');
        }
        
        // 检查搜索源是否存在
        const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        // 检查是否已经点赞/收藏
        const existingLike = await env.DB.prepare(`
            SELECT id FROM community_source_likes 
            WHERE shared_source_id = ? AND user_id = ? AND like_type = ?
        `).bind(sourceId, user.id, likeType).first();
        
        if (existingLike) {
            // 取消点赞/收藏
            await env.DB.prepare(`
                DELETE FROM community_source_likes 
                WHERE id = ?
            `).bind(existingLike.id).run();
            
            // 更新统计（通过触发器自动处理）
            
            return utils.successResponse({
                message: `已取消${likeType === 'like' ? '点赞' : '收藏'}`,
                action: 'removed'
            });
        } else {
            // 添加点赞/收藏
            const likeId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO community_source_likes (
                    id, shared_source_id, user_id, like_type, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `).bind(likeId, sourceId, user.id, likeType, Date.now()).run();
            
            return utils.successResponse({
                message: `${likeType === 'like' ? '点赞' : '收藏'}成功`,
                action: 'added'
            });
        }
        
    } catch (error) {
        console.error('点赞/收藏失败:', error);
        return utils.errorResponse('操作失败: ' + error.message, 500);
    }
});

// 评价搜索源
router.post('/api/community/sources/:id/review', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const { rating, comment, isAnonymous } = body;
        
        // 验证评分
        if (!rating || rating < 1 || rating > 5) {
            return utils.errorResponse('评分必须在1-5之间');
        }
        
        // 检查搜索源是否存在
        const source = await env.DB.prepare(`
            SELECT id, user_id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        // 不能评价自己的搜索源
        if (source.user_id === user.id) {
            return utils.errorResponse('不能评价自己分享的搜索源');
        }
        
        // 检查是否已经评价过
        const existingReview = await env.DB.prepare(`
            SELECT id FROM community_source_reviews 
            WHERE shared_source_id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
        
        if (existingReview) {
            // 更新现有评价
            await env.DB.prepare(`
                UPDATE community_source_reviews 
                SET rating = ?, comment = ?, is_anonymous = ?, updated_at = ?
                WHERE id = ?
            `).bind(rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), existingReview.id).run();
            
            return utils.successResponse({
                message: '评价更新成功'
            });
        } else {
            // 添加新评价
            const reviewId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO community_source_reviews (
                    id, shared_source_id, user_id, rating, comment, is_anonymous, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(reviewId, sourceId, user.id, rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), Date.now()).run();
            
            return utils.successResponse({
                message: '评价提交成功'
            });
        }
        
    } catch (error) {
        console.error('提交评价失败:', error);
        return utils.errorResponse('提交评价失败: ' + error.message, 500);
    }
});

// 举报搜索源
router.post('/api/community/sources/:id/report', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const { reason, details } = body;
        
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return utils.errorResponse('举报原因不能为空');
        }
        
        // 检查搜索源是否存在
        const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources WHERE id = ?
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        // 创建举报记录
        const reportId = utils.generateId();
        await env.DB.prepare(`
            INSERT INTO community_source_reports (
                id, shared_source_id, reporter_user_id, report_reason, 
                report_details, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(reportId, sourceId, user.id, reason.trim(), details?.trim() || null, 'pending', Date.now(), Date.now()).run();
        
        return utils.successResponse({
            message: '举报已提交，我们会尽快处理'
        });
        
    } catch (error) {
        console.error('提交举报失败:', error);
        return utils.errorResponse('提交举报失败: ' + error.message, 500);
    }
});

// 获取用户在社区的统计信息
// 改进的用户统计API - 添加到worker.js中替换现有实现
router.get('/api/community/user/stats', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        // 获取缓存的统计数据
        const statsResult = await env.DB.prepare(`
            SELECT * FROM community_user_stats WHERE user_id = ?
        `).bind(user.id).first();
        
        // 获取用户分享的搜索源
        const sharedSourcesResult = await env.DB.prepare(`
            SELECT 
                id, source_name, source_category, download_count, 
                like_count, rating_score, status, created_at
            FROM community_shared_sources 
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 10
        `).bind(user.id).all();
        
        // 实时计算统计数据作为备选验证
        const realTimeStats = await env.DB.prepare(`
            SELECT 
                -- 分享的搜索源数量
                (SELECT COUNT(*) FROM community_shared_sources WHERE user_id = ? AND status = 'active') as shared_count,
                
                -- 分享的搜索源被下载的总次数
                (SELECT COUNT(*) FROM community_source_downloads csd 
                 JOIN community_shared_sources css ON csd.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active') as total_downloads,
                
                -- 分享的搜索源获得的总点赞数
                (SELECT COUNT(*) FROM community_source_likes csl 
                 JOIN community_shared_sources css ON csl.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active' AND csl.like_type = 'like') as total_likes,
                
                -- 用户给出的评价数量
                (SELECT COUNT(*) FROM community_source_reviews WHERE user_id = ?) as reviews_given,
                
                -- 用户下载的搜索源数量
                (SELECT COUNT(DISTINCT shared_source_id) FROM community_source_downloads WHERE user_id = ?) as sources_downloaded
        `).bind(user.id, user.id, user.id, user.id, user.id).first();
        
        // 使用实时计算的数据，如果缓存数据存在且差异不大则使用缓存数据
        const useRealTime = !statsResult || 
            Math.abs((statsResult.total_downloads || 0) - realTimeStats.total_downloads) > 1 ||
            Math.abs((statsResult.total_likes || 0) - realTimeStats.total_likes) > 1;
        
        const stats = {
            general: {
                sharedSources: useRealTime ? realTimeStats.shared_count : (statsResult?.shared_sources_count || 0),
                totalDownloads: useRealTime ? realTimeStats.total_downloads : (statsResult?.total_downloads || 0),
                totalLikes: useRealTime ? realTimeStats.total_likes : (statsResult?.total_likes || 0),
                reviewsGiven: useRealTime ? realTimeStats.reviews_given : (statsResult?.reviews_given || 0),
                sourcesDownloaded: useRealTime ? realTimeStats.sources_downloaded : (statsResult?.sources_downloaded || 0),
                reputationScore: statsResult?.reputation_score || 0,
                contributionLevel: statsResult?.contribution_level || 'beginner'
            },
            recentShares: sharedSourcesResult.results.map(source => ({
                id: source.id,
                name: source.source_name,
                category: source.source_category,
                downloads: source.download_count,
                likes: source.like_count,
                rating: source.rating_score,
                status: source.status,
                createdAt: source.created_at
            })),
            // 调试信息（生产环境可删除）
            debug: {
                useRealTime,
                cachedStats: statsResult ? {
                    downloads: statsResult.total_downloads,
                    likes: statsResult.total_likes
                } : null,
                realTimeStats: {
                    downloads: realTimeStats.total_downloads,
                    likes: realTimeStats.total_likes
                }
            }
        };
        
        // 如果使用了实时计算，异步更新缓存
        if (useRealTime && statsResult) {
            console.log('检测到统计数据不一致，触发缓存更新');
            // 异步更新，不阻塞响应
            env.DB.prepare(`
                UPDATE community_user_stats 
                SET total_downloads = ?, total_likes = ?, updated_at = ?
                WHERE user_id = ?
            `).bind(
                realTimeStats.total_downloads,
                realTimeStats.total_likes,
                Date.now(),
                user.id
            ).run().catch(error => {
                console.error('更新用户统计缓存失败:', error);
            });
        }
        
        return utils.successResponse({ stats });
        
    } catch (error) {
        console.error('获取用户统计失败:', error);
        return utils.errorResponse('获取用户统计失败', 500);
    }
});

// 获取热门标签
router.get('/api/community/tags', async (request, env) => {
    try {
        const result = await env.DB.prepare(`
            SELECT * FROM community_source_tags 
            ORDER BY usage_count DESC, is_official DESC, tag_name ASC
            LIMIT 50
        `).all();
        
        const tags = result.results.map(tag => ({
            id: tag.id,
            name: tag.tag_name,
            color: tag.tag_color,
            usageCount: tag.usage_count,
            isOfficial: Boolean(tag.is_official)
        }));
        
        return utils.successResponse({ tags });
        
    } catch (error) {
        console.error('获取标签失败:', error);
        return utils.errorResponse('获取标签失败', 500);
    }
});

// 搜索社区搜索源
router.get('/api/community/search', async (request, env) => {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');
        const category = url.searchParams.get('category');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);
        
        if (!query || query.trim().length < 2) {
            return utils.errorResponse('搜索关键词至少需要2个字符');
        }
        
        let whereConditions = ['status = ?', '(source_name LIKE ? OR description LIKE ?)'];
        let params = ['active', `%${query}%`, `%${query}%`];
        
        if (category && category !== 'all') {
            whereConditions.push('source_category = ?');
            params.push(category);
        }
        
        const searchQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY 
                CASE WHEN source_name LIKE ? THEN 1 ELSE 2 END,
                rating_score DESC,
                download_count DESC
            LIMIT ?
        `;
        
        params.push(`%${query}%`, limit);
        const result = await env.DB.prepare(searchQuery).bind(...params).all();
        
        const sources = result.results.map(source => ({
            id: source.id,
            name: source.source_name,
            subtitle: source.source_subtitle,
            icon: source.source_icon,
            category: source.source_category,
            description: source.description,
            author: {
                id: source.user_id,
                name: source.author_name
            },
            stats: {
                downloads: source.download_count,
                likes: source.like_count,
                rating: source.rating_score,
                reviewCount: source.review_count
            },
            isVerified: Boolean(source.is_verified),
            isFeatured: Boolean(source.is_featured),
            createdAt: source.created_at
        }));
        
        return utils.successResponse({ sources, query });
        
    } catch (error) {
        console.error('搜索社区搜索源失败:', error);
        return utils.errorResponse('搜索失败', 500);
    }
});

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

// 🔧 优化：用户设置路由 - 支持搜索源和分类管理
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
                theme: settings.theme || 'auto',
                autoSync: settings.autoSync !== false,
                cacheResults: settings.cacheResults !== false,
                maxHistoryPerUser: settings.maxHistoryPerUser || 1000,
                maxFavoritesPerUser: settings.maxFavoritesPerUser || 1000,
                allowAnalytics: settings.allowAnalytics !== false,
                searchSuggestions: settings.searchSuggestions !== false,
                // 🔧 搜索源相关设置
                searchSources: settings.searchSources || ['javbus', 'javdb', 'javlibrary'],
                customSearchSources: settings.customSearchSources || [],
                customSourceCategories: settings.customSourceCategories || [], // 🔧 新增：自定义分类
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

        // 🔧 扩展允许的设置字段，添加分类管理支持
        const allowedSettings = [
            'theme', 
            'autoSync', 
            'cacheResults', 
            'maxHistoryPerUser', 
            'maxFavoritesPerUser',
            'allowAnalytics',
            'searchSuggestions',
            'searchSources',            // 启用的搜索源列表
            'customSearchSources',      // 自定义搜索源列表
            'customSourceCategories',    // 🔧 新增：自定义分类列表
			// 🆕 添加搜索源状态检查相关设置
            'checkSourceStatus',
            'sourceStatusCheckTimeout',
            'sourceStatusCacheDuration', 
            'skipUnavailableSources',
            'showSourceStatus',
            'retryFailedSources'
        ];
        
        const filteredSettings = {};
        
        Object.keys(settings).forEach(key => {
            if (allowedSettings.includes(key)) {
                filteredSettings[key] = settings[key];
            }
        });
		
		        // 🔧 添加状态检查设置的验证
        if (filteredSettings.hasOwnProperty('sourceStatusCheckTimeout')) {
            const timeout = Number(filteredSettings.sourceStatusCheckTimeout);
            if (timeout < 1000 || timeout > 30000) {
                return utils.errorResponse('状态检查超时时间必须在 1-30 秒之间');
            }
            filteredSettings.sourceStatusCheckTimeout = timeout;
        }
        
        if (filteredSettings.hasOwnProperty('sourceStatusCacheDuration')) {
            const cacheDuration = Number(filteredSettings.sourceStatusCacheDuration);
            if (cacheDuration < 60000 || cacheDuration > 3600000) {
                return utils.errorResponse('状态缓存时间必须在 60-3600 秒之间');
            }
            filteredSettings.sourceStatusCacheDuration = cacheDuration;
        }
        
        // 确保布尔类型设置的正确转换
        ['checkSourceStatus', 'skipUnavailableSources', 'showSourceStatus', 'retryFailedSources'].forEach(key => {
            if (filteredSettings.hasOwnProperty(key)) {
                filteredSettings[key] = Boolean(filteredSettings[key]);
            }
        });

        // 🔧 验证搜索源数据格式
        if (filteredSettings.searchSources) {
            if (!Array.isArray(filteredSettings.searchSources)) {
                return utils.errorResponse('搜索源格式错误：必须是数组');
            }
            
            if (filteredSettings.searchSources.length === 0) {
                return utils.errorResponse('至少需要选择一个搜索源');
            }
        }

        // 🔧 验证自定义搜索源格式
        if (filteredSettings.customSearchSources) {
            if (!Array.isArray(filteredSettings.customSearchSources)) {
                return utils.errorResponse('自定义搜索源格式错误：必须是数组');
            }
            
            const invalidCustomSources = filteredSettings.customSearchSources.filter(source => 
                !source || 
                !source.id || 
                !source.name || 
                !source.urlTemplate ||
                !source.category ||
                typeof source.id !== 'string' || 
                typeof source.name !== 'string' || 
                typeof source.urlTemplate !== 'string' ||
                typeof source.category !== 'string'
            );
            
            if (invalidCustomSources.length > 0) {
                return utils.errorResponse('自定义搜索源格式错误：缺少必需字段或格式不正确');
            }
        }

        // 🔧 新增：验证自定义分类格式
        if (filteredSettings.customSourceCategories) {
            if (!Array.isArray(filteredSettings.customSourceCategories)) {
                return utils.errorResponse('自定义分类格式错误：必须是数组');
            }
            
            const invalidCategories = filteredSettings.customSourceCategories.filter(category => 
                !category || 
                !category.id || 
                !category.name || 
                !category.icon ||
                typeof category.id !== 'string' || 
                typeof category.name !== 'string' || 
                typeof category.icon !== 'string'
            );
            
            if (invalidCategories.length > 0) {
                return utils.errorResponse('自定义分类格式错误：缺少必需字段或格式不正确');
            }
            
            // 检查分类ID重复
            const categoryIds = filteredSettings.customSourceCategories.map(c => c.id);
            const duplicateIds = categoryIds.filter((id, index) => categoryIds.indexOf(id) !== index);
            
            if (duplicateIds.length > 0) {
                return utils.errorResponse(`自定义分类ID重复: ${duplicateIds.join(', ')}`);
            }
            
            // 检查分类名称重复
            const categoryNames = filteredSettings.customSourceCategories.map(c => c.name);
            const duplicateNames = categoryNames.filter((name, index) => categoryNames.indexOf(name) !== index);
            
            if (duplicateNames.length > 0) {
                return utils.errorResponse(`自定义分类名称重复: ${duplicateNames.join(', ')}`);
            }
        }

        // 获取当前设置
        const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();

        const currentSettings = userRecord ? JSON.parse(userRecord.settings || '{}') : {};
        const updatedSettings = { ...currentSettings, ...filteredSettings };

        // 更新数据库
        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();

        // 记录设置更改行为
        await utils.logUserAction(env, user.id, 'settings_update', {
            changedFields: Object.keys(filteredSettings),
            hasCustomSources: !!(filteredSettings.customSearchSources && filteredSettings.customSearchSources.length > 0),
            hasCustomCategories: !!(filteredSettings.customSourceCategories && filteredSettings.customSourceCategories.length > 0),
            // 🆕 记录状态检查设置变更
            checkSourceStatusChanged: filteredSettings.hasOwnProperty('checkSourceStatus')
        }, request);

        return utils.successResponse({ 
            message: '设置更新成功',
            settings: updatedSettings
        });

    } catch (error) {
        console.error('更新用户设置失败:', error);
        return utils.errorResponse('更新用户设置失败: ' + error.message, 500);
    }
});

// 🔧 优化：搜索源API - 移除内置定义，从前端获取
router.get('/api/search-sources', async (request, env) => {
    try {
        // 不再在后端定义内置搜索源，而是返回用户的自定义搜索源
        let customSources = [];
        let customCategories = [];
        
        const user = await authenticate(request, env);
        if (user) {
            try {
                const userRecord = await env.DB.prepare(`
                    SELECT settings FROM users WHERE id = ?
                `).bind(user.id).first();

                if (userRecord) {
                    const settings = JSON.parse(userRecord.settings || '{}');
                    customSources = settings.customSearchSources || [];
                    customCategories = settings.customSourceCategories || [];
                }
            } catch (error) {
                console.warn('获取用户自定义搜索源失败:', error);
            }
        }

        return utils.successResponse({
            customSources,
            customCategories,
            // 🔧 提示前端从constants.js获取内置搜索源
            message: 'Built-in sources should be loaded from frontend constants'
        });

    } catch (error) {
        console.error('获取搜索源失败:', error);
        return utils.errorResponse('获取搜索源失败', 500);
    }
});

// 收藏相关
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

// 搜索历史 - 保存新记录
router.post('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { query, timestamp, source } = body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空');
        }

        const trimmedQuery = query.trim();
        
        if (trimmedQuery.length > 200) {
            return utils.errorResponse('搜索关键词过长');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

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

        const historyId = utils.generateId();
        const now = timestamp || Date.now();

        await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, query, source, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(historyId, user.id, trimmedQuery, source || 'unknown', now).run();

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

// 搜索历史 - 获取列表
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
            keyword: item.query,
            query: item.query,
            source: item.source,
            timestamp: item.created_at,
            createdAt: new Date(item.created_at).toISOString()
        }));

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        return utils.successResponse({ 
            history,
            searchHistory: history,
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

// 删除单条搜索历史记录（参数路由）
router.delete('/api/user/search-history/:id', async (request, env) => {
    console.log('🔧 删除单条历史路由被调用');
    
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 从request.params中获取ID
        const historyId = request.params?.id;
        console.log('🔧 获取到的历史ID:', historyId);

        if (!historyId || historyId.length < 10) {
            return utils.errorResponse('历史记录ID格式无效', 400);
        }

        const result = await env.DB.prepare(`
            DELETE FROM user_search_history 
            WHERE id = ? AND user_id = ?
        `).bind(historyId, user.id).run();

        console.log('🔧 删除结果:', result);

        if (result.changes === 0) {
            return utils.errorResponse('历史记录不存在或无权删除', 404);
        }

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

// 清空所有搜索历史（精确路由）
router.delete('/api/user/search-history', async (request, env) => {
    console.log('🔧 清空历史路由被调用');
    
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const operation = url.searchParams.get('operation');
        
        if (operation !== 'clear') {
            return utils.errorResponse('请指定operation=clear参数以确认清空操作', 400);
        }

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        const deletedCount = countResult.count || 0;

        await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();

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

// 搜索统计
router.get('/api/user/search-stats', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const totalResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        const todayResult = await env.DB.prepare(`
            SELECT COUNT(*) as today FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, todayTimestamp).first();

        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekResult = await env.DB.prepare(`
            SELECT COUNT(*) as week FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, weekAgo).first();

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

// 其他API
router.post('/api/actions/record', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, data, timestamp, sessionId } = body;

        let actionType = 'unknown';
        if (action && typeof action === 'string' && action.trim()) {
            actionType = action.trim();
        }

        const allowedActions = [
            'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
            'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
            'sync_data', 'page_view', 'session_start', 'session_end',
            'custom_source_add', 'custom_source_edit', 'custom_source_delete',
            'custom_category_add', 'custom_category_edit', 'custom_category_delete'
        ];

        if (!allowedActions.includes(actionType)) {
            actionType = 'custom';
        }

        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        if (userId && env.ENABLE_ACTION_LOGGING === 'true') {
            await utils.logUserAction(env, userId, actionType, data || {}, request);
        }

        return utils.successResponse({ 
            recorded: true,
            actionType,
            userId: userId || null,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('记录行为失败:', error);
        return utils.successResponse({ 
            recorded: false, 
            error: 'silent_failure',
            message: '行为记录失败但不影响功能'
        });
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
        version: env.APP_VERSION || '1.3.0'
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