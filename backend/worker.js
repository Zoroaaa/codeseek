// Cloudflare Worker 后端主文件 - 用户隔离优化版本
// 【重要修改】支持完整的用户数据隔离、增强认证、修复字段兼容性

// 【优化】简化路由器实现，支持参数路由
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

    // 【重要修改】增强路由匹配，支持参数路由优先匹配
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

        // 【新增】查找模式匹配的路由（包括参数路由）
        const matchedRoutes = [];
        for (const [routeKey, handler] of this.routes) {
            const [routeMethod, routePath] = routeKey.split(':');
            if ((routeMethod === method || routeMethod === '*') && this.matchPath(routePath, pathname)) {
                // 优先级：参数路由 > 通配符路由
                const priority = routePath.includes(':') ? 1 : (routePath.includes('*') ? 0 : 2);
                matchedRoutes.push({ handler, priority, routePath });
            }
        }

        // 按优先级排序并执行第一个匹配的处理器
        if (matchedRoutes.length > 0) {
            matchedRoutes.sort((a, b) => b.priority - a.priority);
            return await this.executeHandler(matchedRoutes[0].handler, request, env);
        }

        return utils.errorResponse(`API路径不存在: ${pathname}`, 404);
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

    // 【重要新增】路径匹配方法，支持参数路由
    matchPath(routePath, requestPath) {
        // 精确匹配
        if (routePath === requestPath) return true;
        
        // 通配符匹配
        if (routePath.endsWith('/*')) {
            const basePath = routePath.slice(0, -2);
            return requestPath.startsWith(basePath);
        }
        
        // 【新增】参数匹配 (例如: /api/user/search-history/:id)
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

// 【增强】工具函数
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

    // 【修改】更严格的CORS配置
    getCorsHeaders(origin = '*') {
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

    // 【新增】用户行为记录工具
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

// 【重要修改】认证中间件 - 确保用户数据隔离
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

        // 【新增】更新活动时间
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

// 基础API路由
router.get('/api/health', async (request, env) => {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.0.0'
    });
});

// 用户注册接口
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

// 用户登录接口
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

        // 【修改】清理过期会话
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

// Token验证接口
router.get('/api/auth/verify', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }
    return utils.successResponse({ user });
});

// 退出登录接口
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

// 【新增】修改密码接口
router.post('/api/auth/change-password', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { currentPassword, newPassword } = body;

        const errors = utils.validateInput({ currentPassword, newPassword }, {
            currentPassword: { required: true },
            newPassword: { required: true, minLength: 6, maxLength: 50 }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0]);
        }

        // 验证当前密码
        const userRecord = await env.DB.prepare(
            'SELECT password_hash FROM users WHERE id = ?'
        ).bind(user.id).first();

        if (!userRecord) {
            return utils.errorResponse('用户不存在', 404);
        }

        const currentPasswordHash = await utils.hashPassword(currentPassword);
        if (currentPasswordHash !== userRecord.password_hash) {
            return utils.errorResponse('当前密码错误');
        }

        // 更新密码
        const newPasswordHash = await utils.hashPassword(newPassword);
        await env.DB.prepare(
            'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
        ).bind(newPasswordHash, Date.now(), user.id).run();

        // 删除所有现有会话（强制重新登录）
        await env.DB.prepare(
            'DELETE FROM user_sessions WHERE user_id = ?'
        ).bind(user.id).run();

        // 记录行为
        await utils.logUserAction(env, user.id, 'password_changed', {}, request);

        return utils.successResponse({ message: '密码修改成功，请重新登录' });

    } catch (error) {
        console.error('修改密码失败:', error);
        return utils.errorResponse('修改密码失败', 500);
    }
});

// 【新增】删除账户接口
router.post('/api/auth/delete-account', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 开始事务删除用户相关数据（确保用户数据完全隔离删除）
        await env.DB.batch([
            env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM user_search_history WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM user_actions WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM analytics_events WHERE user_id = ?').bind(user.id),
            env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id)
        ]);

        return utils.successResponse({ message: '账户删除成功' });

    } catch (error) {
        console.error('删除账户失败:', error);
        return utils.errorResponse('删除账户失败', 500);
    }
});

// 【修改】收藏夹同步接口 - 确保用户数据隔离
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

        // 【重要】事务处理 - 清除当前用户的收藏，避免跨用户污染
        await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ?`).bind(user.id).run();

        for (const favorite of favorites) {
            const favoriteId = favorite.id || utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                favoriteId, 
                user.id,  // 【关键】确保用户隔离
                favorite.title || '', 
                favorite.subtitle || '', 
                favorite.url || '', 
                favorite.icon || '', 
                favorite.keyword || '',
                Date.now(), 
                Date.now()
            ).run();
        }

        // 记录用户行为
        await utils.logUserAction(env, user.id, 'sync_favorites', { count: favorites.length }, request);

        return utils.successResponse({ message: '收藏夹同步成功' });

    } catch (error) {
        console.error('同步收藏夹失败:', error);
        return utils.errorResponse('同步收藏夹失败', 500);
    }
});

// 获取收藏夹接口 - 用户隔离查询
router.get('/api/user/favorites', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 【重要】只查询当前用户的收藏
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

// 【重要修改】保存搜索历史 - 字段兼容性修复
router.post('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { query, keyword, timestamp, source } = body;

        // 【修复】兼容前端的keyword字段和后端的query字段
        const searchQuery = query || keyword;
        if (!searchQuery || typeof searchQuery !== 'string' || searchQuery.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空');
        }

        const trimmedQuery = searchQuery.trim();
        
        // 输入验证
        if (trimmedQuery.length > 200) {
            return utils.errorResponse('搜索关键词过长');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        
        // 【重要】检查当前用户的历史记录数量
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

// 【重要修改】同步搜索历史接口 - 支持多种数据格式
router.post('/api/user/sync/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { searchHistory, history } = body;
        
        // 【修复】兼容两种格式：searchHistory 和 history
        const historyData = searchHistory || history || [];

        if (!Array.isArray(historyData)) {
            return utils.errorResponse('搜索历史数据格式错误');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        if (historyData.length > maxHistory) {
            return utils.errorResponse(`搜索历史数量不能超过 ${maxHistory} 条`);
        }

        // 【重要】清除当前用户的现有搜索历史
        await env.DB.prepare(`DELETE FROM user_search_history WHERE user_id = ?`).bind(user.id).run();

        // 批量插入新的搜索历史
        for (const item of historyData) {
            // 【修复】确保每个item都有有效的查询字段，兼容keyword和query
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
                user.id, // 【关键】确保用户隔离
                query.trim(),
                item.source || 'unknown',
                item.timestamp || Date.now()
            ).run();
        }

        // 记录用户行为
        await utils.logUserAction(env, user.id, 'sync_history', { count: historyData.length }, request);

        return utils.successResponse({ message: '搜索历史同步成功' });

    } catch (error) {
        console.error('同步搜索历史失败:', error);
        return utils.errorResponse('同步搜索历史失败: ' + error.message, 500);
    }
});

// 【重要修改】获取搜索历史 - 字段映射修复
router.get('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

        // 【重要】只查询当前用户的搜索历史
        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();

        // 【修复】确保字段映射正确，兼容前端的keyword字段
        const history = result.results.map(item => ({
            id: item.id,
            keyword: item.query, // 前端主要使用keyword字段
            query: item.query,   // 后端标准字段
            source: item.source,
            timestamp: item.created_at,
            created_at: item.created_at, // 兼容字段
            createdAt: new Date(item.created_at).toISOString()
        }));

        // 获取总数
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        return utils.successResponse({ 
            history,
            searchHistory: history, // 【新增】兼容字段，前端可能使用这个
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

// 【新增】删除单条搜索历史记录
router.delete('/api/user/search-history/:id', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const historyId = url.pathname.split('/').pop();

        if (!historyId || historyId === 'search-history') {
            return utils.errorResponse('历史记录ID无效');
        }

        // 【重要】确保只能删除当前用户的记录
        const result = await env.DB.prepare(`
            DELETE FROM user_search_history 
            WHERE id = ? AND user_id = ?
        `).bind(historyId, user.id).run();

        if (result.changes === 0) {
            return utils.errorResponse('历史记录不存在或无权删除', 404);
        }

        return utils.successResponse({ message: '删除成功' });

    } catch (error) {
        console.error('删除搜索历史失败:', error);
        return utils.errorResponse('删除搜索历史失败', 500);
    }
});

// 清空搜索历史
router.delete('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 【重要】只清空当前用户的搜索历史
        await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();

        // 记录用户行为
        await utils.logUserAction(env, user.id, 'clear_history', {}, request);

        return utils.successResponse({ message: '搜索历史已清空' });

    } catch (error) {
        console.error('清空搜索历史失败:', error);
        return utils.errorResponse('清空搜索历史失败', 500);
    }
});

// 【新增】搜索历史统计
router.get('/api/user/search-stats', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 【重要】所有统计都基于当前用户的数据
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
            keyword: item.query, // 兼容字段
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

// 【新增】用户设置接口
router.get('/api/user/settings', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 返回用户设置（已在authenticate中解析）
        return utils.successResponse({ 
            settings: user.settings || {
                // 默认设置
                autoSync: true,
                enableCache: true,
                themeMode: 'auto',
                historyRetention: '90',
                maxFavorites: '500',
                allowAnalytics: true,
                searchSuggestions: true
            }
        });
    } catch (error) {
        console.error('获取用户设置失败:', error);
        return utils.errorResponse('获取设置失败', 500);
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

        // 更新用户设置
        await env.DB.prepare(
            'UPDATE users SET settings = ?, updated_at = ? WHERE id = ?'
        ).bind(JSON.stringify(settings), Date.now(), user.id).run();

        // 记录用户行为
        await utils.logUserAction(env, user.id, 'update_settings', settings, request);

        return utils.successResponse({ message: '设置更新成功' });

    } catch (error) {
        console.error('更新用户设置失败:', error);
        return utils.errorResponse('更新设置失败', 500);
    }
});

// 【新增】用户概览统计
router.get('/api/user/overview', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 【重要】获取当前用户的各种统计数据
        const [favoritesCount, historyCount, totalActions] = await Promise.all([
            env.DB.prepare('SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?').bind(user.id).first(),
            env.DB.prepare('SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?').bind(user.id).first(),
            env.DB.prepare('SELECT COUNT(*) as count FROM user_actions WHERE user_id = ?').bind(user.id).first()
        ]);

        // 计算注册天数
        const userRecord = await env.DB.prepare('SELECT created_at FROM users WHERE id = ?').bind(user.id).first();
        const daysSinceRegistration = Math.floor((Date.now() - userRecord.created_at) / (1000 * 60 * 60 * 24));

        // 计算用户等级
        const totalActivity = favoritesCount.count + historyCount.count;
        let userLevel = '新手';
        if (totalActivity >= 500) userLevel = '大师';
        else if (totalActivity >= 200) userLevel = '专家';
        else if (totalActivity >= 50) userLevel = '专业';
        else if (totalActivity >= 10) userLevel = '熟练';

        return utils.successResponse({
            favorites: favoritesCount.count,
            searchHistory: historyCount.count,
            totalActions: totalActions.count,
            daysSinceRegistration,
            userLevel,
            joinDate: new Date(userRecord.created_at).toISOString()
        });

    } catch (error) {
        console.error('获取用户概览失败:', error);
        return utils.errorResponse('获取概览数据失败', 500);
    }
});

// 系统配置接口
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

// 【新增】记录用户行为分析
router.post('/api/analytics/record', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { event, data, timestamp, sessionId } = body;

        // 【修复】更宽松的验证 - 允许各种格式的事件类型
        let eventType = 'unknown';
        if (event) {
            if (typeof event === 'string' && event.trim()) {
                eventType = event.trim();
            } else if (typeof event === 'object' && event.type) {
                eventType = String(event.type);
            } else {
                eventType = String(event);
            }
        }

        // 如果事件类型仍然无效，使用默认值而不是返回错误
        if (!eventType || eventType === 'undefined' || eventType === 'null') {
            eventType = 'page_interaction';
        }

        // 获取客户端信息
        const clientIP = utils.getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || '';
        const referer = request.headers.get('Referer') || '';
        
        // 【重要】尝试获取用户信息（可选，未登录用户也能记录）
        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        // 创建分析记录
        const recordId = utils.generateId();
        const recordTimestamp = timestamp || Date.now();

        // 如果启用了分析功能才记录
        if (env.ENABLE_ANALYTICS === 'true') {
            await env.DB.prepare(`
                INSERT INTO analytics_events (
                    id, user_id, session_id, event_type, event_data, 
                    ip_address, user_agent, referer, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                recordId,
                userId,
                sessionId || utils.generateId(),
                eventType,
                JSON.stringify(data || {}),
                clientIP,
                userAgent,
                referer,
                recordTimestamp
            ).run();
        }

        return utils.successResponse({ 
            recorded: true,
            recordId: env.ENABLE_ANALYTICS === 'true' ? recordId : null
        });

    } catch (error) {
        console.error('记录分析数据失败:', error);
        // 分析记录失败不应该影响用户体验，返回成功
        return utils.successResponse({ recorded: false, error: 'silent' });
    }
});

// 【新增】获取用户分析统计（需要认证）
router.get('/api/analytics/stats', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        if (env.ENABLE_ANALYTICS !== 'true') {
            return utils.successResponse({ 
                message: '分析功能未启用',
                eventStats: [],
                dailyStats: [],
                totalEvents: 0
            });
        }

        const url = new URL(request.url);
        const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 90);
        const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

        // 【重要】只获取当前用户的事件统计
        const eventStats = await env.DB.prepare(`
            SELECT event_type, COUNT(*) as count
            FROM analytics_events 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY event_type
            ORDER BY count DESC
        `).bind(user.id, startTime).all();

        // 获取每日活动统计
        const dailyStats = await env.DB.prepare(`
            SELECT 
                DATE(created_at / 1000, 'unixepoch') as date,
                COUNT(*) as events
            FROM analytics_events 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY DATE(created_at / 1000, 'unixepoch')
            ORDER BY date DESC
        `).bind(user.id, startTime).all();

        return utils.successResponse({
            eventStats: eventStats.results || [],
            dailyStats: dailyStats.results || [],
            period: `${days}天`,
            totalEvents: (eventStats.results || []).reduce((sum, item) => sum + item.count, 0)
        });

    } catch (error) {
        console.error('获取分析统计失败:', error);
        return utils.errorResponse('获取统计数据失败', 500);
    }
});

// 【新增】系统状态检查接口
router.get('/api/system/status', async (request, env) => {
    try {
        // 检查数据库连接
        const dbCheck = await env.DB.prepare('SELECT 1').first();
        
        return utils.successResponse({
            status: 'healthy',
            timestamp: Date.now(),
            version: env.APP_VERSION || '1.0.0',
            database: dbCheck ? 'connected' : 'disconnected',
            features: {
                registration: (env.ALLOW_REGISTRATION || 'true') === 'true',
                analytics: (env.ENABLE_ANALYTICS || 'false') === 'true',
                actionLogging: (env.ENABLE_ACTION_LOGGING || 'false') === 'true',
                userIsolation: true // 始终启用
            }
        });
    } catch (error) {
        return utils.errorResponse('系统状态检查失败', 500);
    }
});

// 【修复】Token验证接口（适配前端调用）
router.post('/api/auth/verify-token', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { token } = body;

        if (!token) {
            return utils.errorResponse('Token不能为空', 401);
        }

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            return utils.errorResponse('服务器配置错误', 500);
        }

        const payload = await utils.verifyJWT(token, jwtSecret);
        if (!payload) {
            return utils.errorResponse('Token无效或已过期', 401);
        }

        try {
            const tokenHash = await utils.hashPassword(token);
            const session = await env.DB.prepare(`
                SELECT u.* FROM users u
                JOIN user_sessions s ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ?
            `).bind(tokenHash, Date.now()).first();

            if (!session) {
                return utils.errorResponse('会话已过期', 401);
            }

            // 更新活动时间
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
                user,
                valid: true,
                message: 'Token验证成功'
            });

        } catch (error) {
            console.error('Token验证数据库查询失败:', error);
            return utils.errorResponse('Token验证失败', 401);
        }

    } catch (error) {
        console.error('Token验证失败:', error);
        return utils.errorResponse('Token验证失败', 401);
    }
});

// 【新增】兼容性接口别名
router.get('/api/health-check', async (request, env) => {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: env.APP_VERSION || '1.0.0'
    });
});

// 同步收藏夹接口（别名）
router.post('/api/user/sync/favorites', async (request, env) => {
    // 重用现有的收藏夹同步逻辑
    return await router.routes.get('POST:/api/user/favorites')(request, env);
});

// 获取搜索历史接口（别名，适配前端调用）
router.get('/api/user/search-history/list', async (request, env) => {
    // 重用现有的搜索历史获取逻辑
    return await router.routes.get('GET:/api/user/search-history')(request, env);
});

// 【新增】调试接口 - 帮助查看前端发送的数据格式
router.post('/api/debug/analytics', async (request, env) => {
    if (env.ENABLE_DEBUG !== 'true') {
        return utils.errorResponse('调试模式未启用', 403);
    }
    
    try {
        const body = await request.json().catch(() => null);
        const textBody = await request.clone().text().catch(() => '');
        
        return utils.successResponse({
            headers: Object.fromEntries(request.headers.entries()),
            jsonBody: body,
            textBody: textBody,
            url: request.url,
            method: request.method,
            timestamp: Date.now()
        });
    } catch (error) {
        return utils.errorResponse('调试失败: ' + error.message);
    }
});

// 【新增】简化的分析记录接口 - 接受任何格式
router.post('/api/track', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        
        // 获取客户端信息
        const clientIP = utils.getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || '';
        
        // 尝试获取用户信息（可选）
        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        // 简单记录到日志（如果不想存储到数据库）
        console.log('Analytics Track:', {
            user: userId,
            ip: clientIP,
            data: body,
            timestamp: Date.now()
        });

        return utils.successResponse({ tracked: true });
    } catch (error) {
        console.error('Track error:', error);
        return utils.successResponse({ tracked: false });
    }
});

// 【新增】记录用户行为接口
router.post('/api/actions/record', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { action, data } = body;

        if (!action) {
            return utils.errorResponse('行为类型不能为空');
        }

        // 【重要】尝试获取用户信息（可选）
        const user = await authenticate(request, env);
        const userId = user ? user.id : null;

        // 记录行为
        await utils.logUserAction(env, userId, action, data || {}, request);

        return utils.successResponse({ message: '行为记录成功' });

    } catch (error) {
        console.error('记录行为失败:', error);
        // 行为记录失败不应该影响用户体验
        return utils.successResponse({ message: '记录行为成功（静默失败）' });
    }
});

// 【新增】获取用户行为统计
router.get('/api/user/actions', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
        const days = Math.min(parseInt(url.searchParams.get('days') || '7'), 30);
        
        const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);

        // 【重要】只查询当前用户的行为记录
        const actions = await env.DB.prepare(`
            SELECT action, data, created_at, ip_address
            FROM user_actions 
            WHERE user_id = ? AND created_at >= ?
            ORDER BY created_at DESC 
            LIMIT ?
        `).bind(user.id, startTime, limit).all();

        const actionStats = await env.DB.prepare(`
            SELECT action, COUNT(*) as count
            FROM user_actions 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY action
            ORDER BY count DESC
        `).bind(user.id, startTime).all();

        return utils.successResponse({
            actions: actions.results || [],
            stats: actionStats.results || [],
            period: `${days}天`
        });

    } catch (error) {
        console.error('获取用户行为失败:', error);
        return utils.errorResponse('获取行为数据失败', 500);
    }
});

// 【新增】数据导出接口
router.get('/api/user/export', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 【重要】获取当前用户的所有数据
        const [favorites, searchHistory, userSettings] = await Promise.all([
            env.DB.prepare('SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all(),
            env.DB.prepare('SELECT * FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC').bind(user.id).all(),
            env.DB.prepare('SELECT settings FROM users WHERE id = ?').bind(user.id).first()
        ]);

        const exportData = {
            userId: user.id,
            username: user.username,
            email: user.email,
            exportTime: new Date().toISOString(),
            version: env.APP_VERSION || '1.0.0',
            data: {
                favorites: (favorites.results || []).map(fav => ({
                    id: fav.id,
                    title: fav.title,
                    subtitle: fav.subtitle,
                    url: fav.url,
                    icon: fav.icon,
                    keyword: fav.keyword,
                    addedAt: new Date(fav.created_at).toISOString()
                })),
                searchHistory: (searchHistory.results || []).map(item => ({
                    id: item.id,
                    keyword: item.query,
                    query: item.query,
                    source: item.source,
                    timestamp: item.created_at,
                    createdAt: new Date(item.created_at).toISOString()
                })),
                settings: JSON.parse(userSettings?.settings || '{}')
            }
        };

        // 记录导出行为
        await utils.logUserAction(env, user.id, 'export_data', {
            favoritesCount: exportData.data.favorites.length,
            historyCount: exportData.data.searchHistory.length
        }, request);

        return utils.successResponse({
            message: '数据导出成功',
            exportData
        });

    } catch (error) {
        console.error('数据导出失败:', error);
        return utils.errorResponse('数据导出失败', 500);
    }
});

// 【新增】数据导入接口
router.post('/api/user/import', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { importData } = body;

        if (!importData || !importData.data) {
            return utils.errorResponse('导入数据格式错误');
        }

        const { favorites, searchHistory, settings } = importData.data;

        let importedFavorites = 0;
        let importedHistory = 0;

        // 导入收藏夹
        if (Array.isArray(favorites)) {
            for (const fav of favorites) {
                if (!fav.url) continue;
                
                // 检查是否已存在
                const existing = await env.DB.prepare(
                    'SELECT id FROM user_favorites WHERE user_id = ? AND url = ?'
                ).bind(user.id, fav.url).first();

                if (!existing) {
                    await env.DB.prepare(`
                        INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).bind(
                        fav.id || utils.generateId(),
                        user.id,
                        fav.title || '',
                        fav.subtitle || '',
                        fav.url,
                        fav.icon || '',
                        fav.keyword || '',
                        Date.now(),
                        Date.now()
                    ).run();
                    importedFavorites++;
                }
            }
        }

        // 导入搜索历史
        if (Array.isArray(searchHistory)) {
            for (const item of searchHistory) {
                const query = item.query || item.keyword;
                if (!query) continue;
                
                // 检查是否已存在
                const existing = await env.DB.prepare(
                    'SELECT id FROM user_search_history WHERE user_id = ? AND query = ?'
                ).bind(user.id, query).first();

                if (!existing) {
                    await env.DB.prepare(`
                        INSERT INTO user_search_history (id, user_id, query, source, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        item.id || utils.generateId(),
                        user.id,
                        query,
                        item.source || 'imported',
                        item.timestamp || Date.now()
                    ).run();
                    importedHistory++;
                }
            }
        }

        // 导入设置
        if (settings && typeof settings === 'object') {
            await env.DB.prepare(
                'UPDATE users SET settings = ?, updated_at = ? WHERE id = ?'
            ).bind(JSON.stringify(settings), Date.now(), user.id).run();
        }

        // 记录导入行为
        await utils.logUserAction(env, user.id, 'import_data', {
            importedFavorites,
            importedHistory,
            hasSettings: !!settings
        }, request);

        return utils.successResponse({
            message: '数据导入成功',
            imported: {
                favorites: importedFavorites,
                searchHistory: importedHistory,
                settings: !!settings
            }
        });

    } catch (error) {
        console.error('数据导入失败:', error);
        return utils.errorResponse('数据导入失败: ' + error.message, 500);
    }
});

// 【新增】清理用户数据接口
router.post('/api/user/cleanup', async (request, env) => {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { type } = body; // 'favorites', 'history', 'all'

        let deletedItems = 0;

        switch (type) {
            case 'favorites':
                const favResult = await env.DB.prepare(
                    'DELETE FROM user_favorites WHERE user_id = ?'
                ).bind(user.id).run();
                deletedItems = favResult.changes;
                break;

            case 'history':
                const histResult = await env.DB.prepare(
                    'DELETE FROM user_search_history WHERE user_id = ?'
                ).bind(user.id).run();
                deletedItems = histResult.changes;
                break;

            case 'all':
                const [favDel, histDel, actionDel] = await Promise.all([
                    env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(user.id).run(),
                    env.DB.prepare('DELETE FROM user_search_history WHERE user_id = ?').bind(user.id).run(),
                    env.DB.prepare('DELETE FROM user_actions WHERE user_id = ?').bind(user.id).run()
                ]);
                deletedItems = favDel.changes + histDel.changes + actionDel.changes;
                break;

            default:
                return utils.errorResponse('清理类型无效');
        }

        // 记录清理行为
        await utils.logUserAction(env, user.id, 'cleanup_data', {
            type,
            deletedItems
        }, request);

        return utils.successResponse({
            message: '数据清理成功',
            deletedItems,
            type
        });

    } catch (error) {
        console.error('数据清理失败:', error);
        return utils.errorResponse('数据清理失败', 500);
    }
});

// 默认处理器
router.get('/*', (request) => {
    const url = new URL(request.url);
    return utils.errorResponse(`API路径不存在: ${url.pathname}`, 404);
});

// 【重要】Worker主函数
export default {
    async fetch(request, env, ctx) {
        try {
            // 【新增】环境变量验证
            const requiredEnvVars = ['JWT_SECRET', 'DB'];
            const missing = requiredEnvVars.filter(key => !env[key]);
            
            if (missing.length > 0) {
                console.error(`❌ 缺少必需的环境变量: ${missing.join(', ')}`);
                return utils.errorResponse(`服务器配置错误: 缺少${missing.join(', ')}`, 500);
            }

            // 【新增】请求日志（仅在调试模式）
            if (env.ENABLE_DEBUG === 'true') {
                const url = new URL(request.url);
                console.log(`📝 ${request.method} ${url.pathname}`);
            }

            return await router.handle(request, env);
        } catch (error) {
            console.error('❌ Worker全局错误:', error);
            return utils.errorResponse('服务器内部错误', 500);
        }
    }
};

// 【新增】导出工具函数供测试使用
export { utils, authenticate };

