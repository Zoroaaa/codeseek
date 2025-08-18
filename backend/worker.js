// Cloudflare Worker 后端主文件 - 简化版路由修复

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
        version: env.APP_VERSION || '1.0.0'
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

// 用户设置路由 - 修复版本，支持搜索源设置
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
                // 🔧 新增：搜索源相关设置
                searchSources: settings.searchSources || ['javbus', 'javdb', 'javlibrary'],
                customSearchSources: settings.customSearchSources || [],
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

        // 🔧 修复：扩展允许的设置字段，添加搜索源支持
        const allowedSettings = [
            'theme', 
            'autoSync', 
            'cacheResults', 
            'maxHistoryPerUser', 
            'maxFavoritesPerUser',
            'allowAnalytics',
            'searchSuggestions',
            'searchSources',        // 🔧 新增：启用的搜索源列表
            'customSearchSources'   // 🔧 新增：自定义搜索源列表
        ];
        
        const filteredSettings = {};
        
        Object.keys(settings).forEach(key => {
            if (allowedSettings.includes(key)) {
                filteredSettings[key] = settings[key];
            }
        });

        // 🔧 新增：验证搜索源数据格式
        if (filteredSettings.searchSources) {
            if (!Array.isArray(filteredSettings.searchSources)) {
                return utils.errorResponse('搜索源格式错误：必须是数组');
            }
            
            // 验证至少选择了一个搜索源
            if (filteredSettings.searchSources.length === 0) {
                return utils.errorResponse('至少需要选择一个搜索源');
            }
            
            // 验证搜索源ID格式
            const invalidSources = filteredSettings.searchSources.filter(sourceId => 
                !sourceId || typeof sourceId !== 'string' || sourceId.trim().length === 0
            );
            
            if (invalidSources.length > 0) {
                return utils.errorResponse('搜索源ID格式错误');
            }
        }

        // 🔧 新增：验证自定义搜索源格式
        if (filteredSettings.customSearchSources) {
            if (!Array.isArray(filteredSettings.customSearchSources)) {
                return utils.errorResponse('自定义搜索源格式错误：必须是数组');
            }
            
            const invalidCustomSources = filteredSettings.customSearchSources.filter(source => 
                !source || 
                !source.id || 
                !source.name || 
                !source.urlTemplate ||
                typeof source.id !== 'string' || 
                typeof source.name !== 'string' || 
                typeof source.urlTemplate !== 'string' ||
                source.id.trim().length === 0 ||
                source.name.trim().length === 0 ||
                source.urlTemplate.trim().length === 0
            );
            
            if (invalidCustomSources.length > 0) {
                return utils.errorResponse('自定义搜索源格式错误：缺少必需字段或格式不正确');
            }
            
            // 验证URL模板格式（必须包含{keyword}占位符）
            const invalidUrlSources = filteredSettings.customSearchSources.filter(source => 
                !source.urlTemplate.includes('{keyword}')
            );
            
            if (invalidUrlSources.length > 0) {
                return utils.errorResponse('自定义搜索源URL模板必须包含{keyword}占位符');
            }
            
            // 检查自定义搜索源ID是否重复
            const sourceIds = filteredSettings.customSearchSources.map(s => s.id);
            const duplicateIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
            
            if (duplicateIds.length > 0) {
                return utils.errorResponse(`自定义搜索源ID重复: ${duplicateIds.join(', ')}`);
            }
            
            // 检查自定义搜索源名称是否重复
            const sourceNames = filteredSettings.customSearchSources.map(s => s.name);
            const duplicateNames = sourceNames.filter((name, index) => sourceNames.indexOf(name) !== index);
            
            if (duplicateNames.length > 0) {
                return utils.errorResponse(`自定义搜索源名称重复: ${duplicateNames.join(', ')}`);
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

        // 🔧 新增：记录设置更改行为
        await utils.logUserAction(env, user.id, 'settings_update', {
            changedFields: Object.keys(filteredSettings),
            hasCustomSources: !!(filteredSettings.customSearchSources && filteredSettings.customSearchSources.length > 0)
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

// 🔧 新增：获取所有可用搜索源（包括内置和自定义）
router.get('/api/search-sources', async (request, env) => {
    try {
        // 内置搜索源
        const builtinSources = [
            {
                id: 'javbus',
                name: 'JavBus',
                subtitle: '番号+磁力一体站，信息完善',
                icon: '🎬',
                urlTemplate: 'https://www.javbus.com/search/{keyword}',
                isBuiltin: true
            },
            {
                id: 'javdb',
                name: 'JavDB',
                subtitle: '极简风格番号资料站，轻量快速',
                icon: '📚',
                urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
                isBuiltin: true
            },
            {
                id: 'javlibrary',
                name: 'JavLibrary',
                subtitle: '评论活跃，女优搜索详尽',
                icon: '📖',
                urlTemplate: 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}',
                isBuiltin: true
            },
            {
                id: 'av01',
                name: 'AV01',
                subtitle: '快速预览站点，封面大图清晰',
                icon: '🎥',
                urlTemplate: 'https://av01.tv/search?keyword={keyword}',
                isBuiltin: true
            },
            {
                id: 'missav',
                name: 'MissAV',
                subtitle: '中文界面，封面高清，信息丰富',
                icon: '💫',
                urlTemplate: 'https://missav.com/search/{keyword}',
                isBuiltin: true
            },
            {
                id: 'btsow',
                name: 'btsow',
                subtitle: '中文磁力搜索引擎，番号资源丰富',
                icon: '🧲',
                urlTemplate: 'https://btsow.com/search/{keyword}',
                isBuiltin: true
            },
            {
                id: 'jable',
                name: 'Jable',
                subtitle: '在线观看平台，支持多种格式',
                icon: '📺',
                urlTemplate: 'https://jable.tv/search/{keyword}/',
                isBuiltin: true
            },
            {
                id: 'javmost',
                name: 'JavMost',
                subtitle: '免费在线观看，更新及时',
                icon: '🎦',
                urlTemplate: 'https://javmost.com/search/{keyword}/',
                isBuiltin: true
            },
            {
                id: 'javguru',
                name: 'JavGuru',
                subtitle: '多线路播放，观看流畅',
                icon: '🎭',
                urlTemplate: 'https://jav.guru/?s={keyword}',
                isBuiltin: true
            },
            {
                id: 'sehuatang',
                name: '色花堂',
                subtitle: '综合论坛社区，资源丰富',
                icon: '🌸',
                urlTemplate: 'https://sehuatang.org/search.php?keyword={keyword}',
                isBuiltin: true
            },
            {
                id: 't66y',
                name: 'T66Y',
                subtitle: '老牌论坛，资源更新快',
                icon: '📋',
                urlTemplate: 'https://t66y.com/search.php?keyword={keyword}',
                isBuiltin: true
            }
        ];

        // 如果用户已登录，获取其自定义搜索源
        let customSources = [];
        const user = await authenticate(request, env);
        if (user) {
            try {
                const userRecord = await env.DB.prepare(`
                    SELECT settings FROM users WHERE id = ?
                `).bind(user.id).first();

                if (userRecord) {
                    const settings = JSON.parse(userRecord.settings || '{}');
                    customSources = settings.customSearchSources || [];
                }
            } catch (error) {
                console.warn('获取用户自定义搜索源失败:', error);
            }
        }

        return utils.successResponse({
            builtinSources,
            customSources,
            allSources: [...builtinSources, ...customSources]
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

// 🔧 关键修复：删除单条搜索历史（参数路由）
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

// 🔧 清空所有搜索历史（精确路由）
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
            'sync_data', 'page_view', 'session_start', 'session_end'
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