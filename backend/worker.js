// Cloudflare Worker 后端主文件 - 优化版本
// 修复CORS、路由匹配等关键问题

// 简单的路由器实现
class SimpleRouter {
    constructor() {
        this.routes = [];
    }

    addRoute(method, path, handler) {
        this.routes.push({ method, path, handler });
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    options(path, handler) { this.addRoute('OPTIONS', path, handler); }
    all(path, handler) { this.addRoute('*', path, handler); }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // 查找匹配的路由
        for (const route of this.routes) {
            if (route.method === method || route.method === '*') {
                if (this.matchPath(route.path, pathname)) {
                    try {
                        return await route.handler(request, env);
                    } catch (error) {
                        console.error('Route handler error:', error);
                        return utils.errorResponse('Internal server error', 500);
                    }
                }
            }
        }

        return utils.errorResponse('路由未找到', 404);
    }

    matchPath(routePath, requestPath) {
        if (routePath === '*') return true;
        if (routePath === requestPath) return true;
        
        // 支持通配符路径
        if (routePath.endsWith('*')) {
            const basePath = routePath.slice(0, -1);
            return requestPath.startsWith(basePath);
        }
        
        return false;
    }
}

// 创建路由器实例
const router = new SimpleRouter();

// 数据库初始化SQL
const DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT DEFAULT '["search","favorite","history","sync"]',
    settings TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT NOT NULL,
    icon TEXT,
    keyword TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    results TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_cache_keyword ON search_cache(keyword);
CREATE INDEX IF NOT EXISTS idx_actions_user ON user_actions(user_id);
`;

// 工具函数
const utils = {
    // 生成UUID
    generateId() {
        return crypto.randomUUID();
    },

    // 生成随机字符串
    generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // 哈希密码
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // 生成JWT Token
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

    // 验证JWT Token
    async verifyJWT(token, secret) {
        try {
            const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
            const data = `${encodedHeader}.${encodedPayload}`;
            
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['verify']
            );
            
            // 修复base64解码问题
            const padding = '='.repeat((4 - encodedSignature.length % 4) % 4);
            const signature = Uint8Array.from(atob(encodedSignature + padding), c => c.charCodeAt(0));
            const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
            
            if (!isValid) return null;
            
            // 修复base64解码问题
            const payloadPadding = '='.repeat((4 - encodedPayload.length % 4) % 4);
            const payload = JSON.parse(atob(encodedPayload + payloadPadding));
            
            // 检查过期时间
            if (payload.exp && Date.now() > payload.exp * 1000) {
                return null;
            }
            
            return payload;
        } catch (error) {
            console.error('JWT验证失败:', error);
            return null;
        }
    },

    // 创建CORS响应头
    getCorsHeaders(origin = '*') {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            'Access-Control-Max-Age': '86400',
            'Access-Control-Allow-Credentials': 'true'
        };
    },

    // 响应工具
    jsonResponse(data, status = 200, corsOrigin = '*') {
        const headers = {
            'Content-Type': 'application/json; charset=UTF-8',
            ...this.getCorsHeaders(corsOrigin)
        };

        return new Response(JSON.stringify(data), {
            status,
            headers
        });
    },

    errorResponse(message, status = 400, corsOrigin = '*') {
        return this.jsonResponse({ success: false, message, error: true }, status, corsOrigin);
    },

    successResponse(data = {}, corsOrigin = '*') {
        return this.jsonResponse({ success: true, ...data }, 200, corsOrigin);
    },

    // 获取客户端IP
    getClientIP(request) {
        return request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
               request.headers.get('X-Real-IP') ||
               'unknown';
    },

    // 记录用户行为
    async logUserAction(env, userId, action, data, request) {
        try {
            // 检查是否启用了行为记录
            if (env.ENABLE_ACTION_LOGGING !== 'true') {
                return;
            }

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

    // 获取环境变量，如果不存在则返回默认值
    getEnvVar(env, key, defaultValue = null) {
        return env[key] !== undefined ? env[key] : defaultValue;
    },

    // 验证管理员权限
    async verifyAdminAccess(request, env) {
        const adminPassword = env.ADMIN_PASSWORD;
        if (!adminPassword) {
            return false;
        }

        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return false;
        }

        const token = authHeader.substring(7);
        return token === adminPassword;
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
    
    if (!payload) {
        return null;
    }

    // 验证会话是否存在且未过期
    try {
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(
            await utils.hashPassword(token),
            Date.now()
        ).first();

        if (!session) {
            return null;
        }

        // 更新最后活动时间
        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), await utils.hashPassword(token)).run();

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

// CORS预检请求处理 - 修复所有路径
router.options('*', (request, env) => {
    const origin = request.headers.get('Origin') || '*';
    return new Response(null, {
        status: 204,
        headers: utils.getCorsHeaders(origin)
    });
});

// 健康检查
router.get('/api/health', async (request, env) => {
    const version = utils.getEnvVar(env, 'APP_VERSION', '1.0.0');
    const environment = utils.getEnvVar(env, 'ENVIRONMENT', 'production');
    
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version,
        environment
    });
});

// 初始化数据库
router.post('/api/admin/init-db', async (request, env) => {
    // 验证管理员权限
    if (!await utils.verifyAdminAccess(request, env)) {
        return utils.errorResponse('管理员权限验证失败', 403);
    }

    try {
        // 执行数据库初始化
        const statements = DB_SCHEMA.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await env.DB.exec(statement);
            }
        }
        return utils.successResponse({ message: '数据库初始化成功' });
    } catch (error) {
        console.error('数据库初始化失败:', error);
        return utils.errorResponse(`数据库初始化失败: ${error.message}`, 500);
    }
});

// 用户注册
router.post('/api/auth/register', async (request, env) => {
    try {
        // 检查是否允许注册
        const allowRegistration = utils.getEnvVar(env, 'ALLOW_REGISTRATION', 'true') === 'true';
        if (!allowRegistration) {
            return utils.errorResponse('注册功能已关闭');
        }

        const body = await request.json().catch(() => ({}));
        const { username, email, password } = body;

        // 输入验证
        if (!username || !email || !password) {
            return utils.errorResponse('用户名、邮箱和密码都是必需的');
        }

        const minUsernameLength = parseInt(utils.getEnvVar(env, 'MIN_USERNAME_LENGTH', '3'));
        const maxUsernameLength = parseInt(utils.getEnvVar(env, 'MAX_USERNAME_LENGTH', '20'));
        const minPasswordLength = parseInt(utils.getEnvVar(env, 'MIN_PASSWORD_LENGTH', '6'));

        if (username.length < minUsernameLength || username.length > maxUsernameLength) {
            return utils.errorResponse(`用户名长度应在${minUsernameLength}-${maxUsernameLength}个字符之间`);
        }

        if (password.length < minPasswordLength) {
            return utils.errorResponse(`密码至少需要${minPasswordLength}个字符`);
        }

        // 检查用户名和邮箱是否已存在
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return utils.errorResponse('用户名或邮箱已存在');
        }

        // 创建新用户
        const userId = utils.generateId();
        const passwordHash = await utils.hashPassword(password);
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, username, email, passwordHash, now, now).run();

        // 记录注册行为
        await utils.logUserAction(env, userId, 'register', { username, email }, request);

        return utils.successResponse({ 
            message: '注册成功',
            user: { id: userId, username, email }
        });

    } catch (error) {
        console.error('注册失败:', error);
        return utils.errorResponse('注册失败，请稍后重试', 500);
    }
});

// 用户登录
router.post('/api/auth/login', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, password } = body;

        if (!username || !password) {
            return utils.errorResponse('用户名和密码都是必需的');
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

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            return utils.errorResponse('服务器配置错误', 500);
        }

        // 获取 token 过期时间（默认30天）
        const tokenExpiryDays = parseInt(utils.getEnvVar(env, 'JWT_EXPIRY_DAYS', '30'));
        const expirySeconds = tokenExpiryDays * 24 * 60 * 60;

        // 生成JWT token
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
        await utils.logUserAction(env, user.id, 'login', { username }, request);

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

// 验证token
router.get('/api/auth/verify', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    return utils.successResponse({ user });
});

// 刷新token
router.post('/api/auth/refresh', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
        return utils.errorResponse('服务器配置错误', 500);
    }

    // 获取 token 过期时间
    const tokenExpiryDays = parseInt(utils.getEnvVar(env, 'JWT_EXPIRY_DAYS', '30'));
    const expirySeconds = tokenExpiryDays * 24 * 60 * 60;

    // 生成新token
    const payload = {
        userId: user.id,
        username: user.username,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expirySeconds
    };

    const newToken = await utils.generateJWT(payload, jwtSecret);
    const tokenHash = await utils.hashPassword(newToken);

    // 更新会话
    const authHeader = request.headers.get('Authorization');
    const oldToken = authHeader.substring(7);
    const oldTokenHash = await utils.hashPassword(oldToken);

    await env.DB.prepare(`
        UPDATE user_sessions SET token_hash = ?, expires_at = ?, last_activity = ?
        WHERE token_hash = ?
    `).bind(
        tokenHash,
        Date.now() + (expirySeconds * 1000),
        Date.now(),
        oldTokenHash
    ).run();

    return utils.successResponse({ token: newToken });
});

// 退出登录
router.post('/api/auth/logout', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (user) {
        // 删除会话
        const authHeader = request.headers.get('Authorization');
        const token = authHeader.substring(7);
        const tokenHash = await utils.hashPassword(token);

        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE token_hash = ?
        `).bind(tokenHash).run();

        // 记录退出行为
        await utils.logUserAction(env, user.id, 'logout', {}, request);
    }

    return utils.successResponse({ message: '退出成功' });
});

// 同步收藏夹
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

        // 检查收藏夹数量限制
        const maxFavorites = parseInt(utils.getEnvVar(env, 'MAX_FAVORITES_PER_USER', '1000'));
        if (favorites.length > maxFavorites) {
            return utils.errorResponse(`收藏夹数量不能超过 ${maxFavorites} 个`);
        }

        // 清空现有收藏夹
        await env.DB.prepare(`
            DELETE FROM user_favorites WHERE user_id = ?
        `).bind(user.id).run();

        // 插入新收藏
        for (const favorite of favorites) {
            const favoriteId = favorite.id || utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                favoriteId,
                user.id,
                favorite.title || '',
                favorite.subtitle || '',
                favorite.url || '',
                favorite.icon || '',
                favorite.keyword || '',
                Date.now(),
                Date.now()
            ).run();
        }

        // 记录同步行为
        await utils.logUserAction(env, user.id, 'sync_favorites', { count: favorites.length }, request);

        return utils.successResponse({ message: '收藏夹同步成功' });

    } catch (error) {
        console.error('同步收藏夹失败:', error);
        return utils.errorResponse('同步收藏夹失败', 500);
    }
});

// 获取收藏夹
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

// 系统配置信息（不包含敏感信息）
router.get('/api/config', async (request, env) => {
    return utils.successResponse({
        allowRegistration: utils.getEnvVar(env, 'ALLOW_REGISTRATION', 'true') === 'true',
        minUsernameLength: parseInt(utils.getEnvVar(env, 'MIN_USERNAME_LENGTH', '3')),
        maxUsernameLength: parseInt(utils.getEnvVar(env, 'MAX_USERNAME_LENGTH', '20')),
        minPasswordLength: parseInt(utils.getEnvVar(env, 'MIN_PASSWORD_LENGTH', '6')),
        maxFavoritesPerUser: parseInt(utils.getEnvVar(env, 'MAX_FAVORITES_PER_USER', '1000')),
        maxHistoryPerUser: parseInt(utils.getEnvVar(env, 'MAX_HISTORY_PER_USER', '1000')),
        searchCacheEnabled: utils.getEnvVar(env, 'ENABLE_SEARCH_CACHE', 'true') === 'true',
        version: utils.getEnvVar(env, 'APP_VERSION', '1.0.0'),
        environment: utils.getEnvVar(env, 'ENVIRONMENT', 'production')
    });
});

// 默认路由 - 处理未匹配的路径
router.all('*', (request) => {
    const url = new URL(request.url);
    return utils.errorResponse(`API路径不存在: ${url.pathname}`, 404);
});

// Worker主函数
export default {
    async fetch(request, env, ctx) {
        try {
            // 验证必需的环境变量
            if (!env.JWT_SECRET) {
                console.error('JWT_SECRET 环境变量未设置');
                return utils.errorResponse('服务器配置错误：缺少JWT密钥', 500);
            }

            if (!env.DB) {
                console.error('DB 环境变量未设置');
                return utils.errorResponse('服务器配置错误：数据库未配置', 500);
            }

            return await router.handle(request, env);
        } catch (error) {
            console.error('Worker错误:', error);
            return utils.errorResponse('服务器内部错误', 500);
        }
    }
};