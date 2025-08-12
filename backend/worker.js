// Cloudflare Worker 后端主文件 - 完全优化版本
// 修复CORS、路由匹配、认证、安全性等关键问题

// 简单但强大的路由器实现
class Router {
    constructor() {
        this.routes = [];
        this.middlewares = [];
    }

    // 添加中间件
    use(middleware) {
        this.middlewares.push(middleware);
    }

    // 添加路由
    addRoute(method, path, handler) {
        this.routes.push({ method, path, handler });
    }

    get(path, handler) { this.addRoute('GET', path, handler); }
    post(path, handler) { this.addRoute('POST', path, handler); }
    put(path, handler) { this.addRoute('PUT', path, handler); }
    delete(path, handler) { this.addRoute('DELETE', path, handler); }
    options(path, handler) { this.addRoute('OPTIONS', path, handler); }
    patch(path, handler) { this.addRoute('PATCH', path, handler); }
    all(path, handler) { this.addRoute('*', path, handler); }

    // 处理请求
    async handle(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        try {
            // 执行中间件
            for (const middleware of this.middlewares) {
                const result = await middleware(request, env, ctx);
                if (result) return result;
            }

            // 查找匹配的路由
            for (const route of this.routes) {
                if (route.method === method || route.method === '*') {
                    const match = this.matchPath(route.path, pathname);
                    if (match) {
                        // 将路径参数添加到请求对象
                        request.params = match.params;
                        return await route.handler(request, env, ctx);
                    }
                }
            }

            return Utils.errorResponse('路由未找到', 404);
        } catch (error) {
            console.error('路由处理错误:', error);
            return Utils.errorResponse('服务器内部错误', 500);
        }
    }

    // 路径匹配（支持参数）
    matchPath(routePath, requestPath) {
        if (routePath === '*') return { params: {} };
        
        // 简单路径匹配
        if (routePath === requestPath) return { params: {} };
        
        // 通配符匹配
        if (routePath.endsWith('*')) {
            const basePath = routePath.slice(0, -1);
            if (requestPath.startsWith(basePath)) {
                return { params: {} };
            }
        }
        
        // 参数匹配
        const routeParts = routePath.split('/');
        const requestParts = requestPath.split('/');
        
        if (routeParts.length !== requestParts.length) return null;
        
        const params = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                const paramName = routeParts[i].slice(1);
                params[paramName] = requestParts[i];
            } else if (routeParts[i] !== requestParts[i]) {
                return null;
            }
        }
        
        return { params };
    }
}

// 工具函数集合
const Utils = {
    // 生成唯一ID
    generateId() {
        return crypto.randomUUID();
    },

    // 生成随机字符串
    generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const values = crypto.getRandomValues(new Uint8Array(length));
        for (let i = 0; i < length; i++) {
            result += chars[values[i] % chars.length];
        }
        return result;
    },

    // 哈希密码
    async hashPassword(password, salt = null) {
        if (!salt) {
            salt = this.generateRandomString(16);
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(password + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hashHex}:${salt}`;
    },

    // 验证密码
    async verifyPassword(password, hashedPassword) {
        try {
            const [hash, salt] = hashedPassword.split(':');
            if (!salt) {
                // 旧格式，直接哈希比较
                const simpleHash = await this.simpleHash(password);
                return simpleHash === hashedPassword;
            }
            const newHash = await this.hashPassword(password, salt);
            return newHash === hashedPassword;
        } catch (error) {
            console.error('密码验证失败:', error);
            return false;
        }
    },

    // 简单哈希（向后兼容）
    async simpleHash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    },

    // JWT Token处理
    async generateJWT(payload, secret, expirySeconds = 2592000) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const now = Math.floor(Date.now() / 1000);
        
        const jwtPayload = {
            ...payload,
            iat: now,
            exp: now + expirySeconds,
            jti: this.generateId()
        };

        const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
        const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload));
        
        const data = `${encodedHeader}.${encodedPayload}`;
        const signature = await this.signJWT(data, secret);
        
        return `${data}.${signature}`;
    },

    async verifyJWT(token, secret) {
        try {
            const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
            if (!encodedHeader || !encodedPayload || !encodedSignature) {
                return null;
            }

            // 验证签名
            const data = `${encodedHeader}.${encodedPayload}`;
            const expectedSignature = await this.signJWT(data, secret);
            
            if (expectedSignature !== encodedSignature) {
                return null;
            }

            // 解析载荷
            const payload = JSON.parse(this.base64UrlDecode(encodedPayload));
            
            // 检查过期时间
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp && now > payload.exp) {
                return null;
            }

            return payload;
        } catch (error) {
            console.error('JWT验证失败:', error);
            return null;
        }
    },

    async signJWT(data, secret) {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
        return this.base64UrlEncode(new Uint8Array(signature));
    },

    base64UrlEncode(data) {
        let str = typeof data === 'string' ? data : String.fromCharCode(...data);
        return btoa(str).replace(/[+]/g, '-').replace(/[/]/g, '_').replace(/[=]/g, '');
    },

    base64UrlDecode(str) {
        str = str.replace(/[-]/g, '+').replace(/[_]/g, '/');
        while (str.length % 4) str += '=';
        return atob(str);
    },

    // CORS处理
    getCorsHeaders(origin = '*') {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
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

        return new Response(JSON.stringify(data), { status, headers });
    },

    errorResponse(message, status = 400, corsOrigin = '*') {
        return this.jsonResponse({ 
            success: false, 
            error: true, 
            message,
            timestamp: Date.now()
        }, status, corsOrigin);
    },

    successResponse(data = {}, corsOrigin = '*') {
        return this.jsonResponse({ 
            success: true, 
            timestamp: Date.now(),
            ...data 
        }, 200, corsOrigin);
    },

    // 获取客户端信息
    getClientInfo(request) {
        return {
            ip: request.headers.get('CF-Connecting-IP') || 
                request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 
                request.headers.get('X-Real-IP') || 'unknown',
            userAgent: request.headers.get('User-Agent') || '',
            country: request.cf?.country || 'unknown',
            city: request.cf?.city || 'unknown'
        };
    },

    // 速率限制
    async checkRateLimit(env, identifier, limit = 100, window = 60) {
        const key = `rate_limit:${identifier}`;
        const now = Math.floor(Date.now() / 1000);
        const windowStart = now - window;
        
        try {
            // 使用KV存储进行速率限制
            const data = await env.KV?.get(key);
            let requests = data ? JSON.parse(data) : [];
            
            // 清理过期请求
            requests = requests.filter(timestamp => timestamp > windowStart);
            
            if (requests.length >= limit) {
                return false;
            }
            
            // 添加当前请求
            requests.push(now);
            await env.KV?.put(key, JSON.stringify(requests), { expirationTtl: window * 2 });
            
            return true;
        } catch (error) {
            console.error('速率限制检查失败:', error);
            return true; // 出错时允许请求
        }
    },

    // 记录用户行为
    async logUserAction(env, userId, action, data = {}, request = null) {
        try {
            if (!env.ENABLE_ACTION_LOGGING || env.ENABLE_ACTION_LOGGING !== 'true') {
                return;
            }

            const clientInfo = request ? this.getClientInfo(request) : {};
            const actionId = this.generateId();
            
            await env.DB.prepare(`
                INSERT INTO user_actions (id, user_id, action, data, ip_address, user_agent, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
                actionId,
                userId,
                action,
                JSON.stringify({ ...data, ...clientInfo }),
                clientInfo.ip,
                clientInfo.userAgent,
                Date.now()
            ).run();
        } catch (error) {
            console.error('记录用户行为失败:', error);
        }
    },

    // 获取环境变量
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
    },

    // 验证请求数据
    validateInput(data, rules) {
        const errors = [];
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            
            if (rule.required && (!value || (typeof value === 'string' && !value.trim()))) {
                errors.push(`${field}是必填字段`);
                continue;
            }
            
            if (value && rule.minLength && value.length < rule.minLength) {
                errors.push(`${field}最少需要${rule.minLength}个字符`);
            }
            
            if (value && rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${field}最多允许${rule.maxLength}个字符`);
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${field}格式不正确`);
            }
            
            if (value && rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                errors.push(`${field}邮箱格式不正确`);
            }
        }
        
        return { isValid: errors.length === 0, errors };
    }
};

// 认证中间件
async function authMiddleware(request, env, ctx) {
    // 跳过不需要认证的路径
    const url = new URL(request.url);
    const publicPaths = [
        '/api/health',
        '/api/config',
        '/api/auth/register',
        '/api/auth/login',
        '/api/admin/init-db'
    ];
    
    if (publicPaths.some(path => url.pathname.startsWith(path))) {
        return null;
    }

    // OPTIONS请求不需要认证
    if (request.method === 'OPTIONS') {
        return null;
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Utils.errorResponse('需要认证令牌', 401);
    }

    const token = authHeader.substring(7);
    const jwtSecret = env.JWT_SECRET;
    
    if (!jwtSecret) {
        console.error('JWT_SECRET环境变量未设置');
        return Utils.errorResponse('服务器配置错误', 500);
    }

    try {
        const payload = await Utils.verifyJWT(token, jwtSecret);
        if (!payload) {
            return Utils.errorResponse('无效的认证令牌', 401);
        }

        // 验证会话
        const tokenHash = await Utils.simpleHash(token);
        const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ? AND s.is_active = 1
        `).bind(tokenHash, Date.now()).first();

        if (!session) {
            return Utils.errorResponse('会话已过期', 401);
        }

        // 更新会话活动时间
        await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();

        // 将用户信息附加到请求
        request.user = {
            id: session.id,
            username: session.username,
            email: session.email,
            permissions: JSON.parse(session.permissions || '[]'),
            settings: JSON.parse(session.settings || '{}')
        };

        return null; // 继续处理请求
    } catch (error) {
        console.error('认证中间件错误:', error);
        return Utils.errorResponse('认证失败', 401);
    }
}

// 速率限制中间件
async function rateLimitMiddleware(request, env, ctx) {
    const clientInfo = Utils.getClientInfo(request);
    const limit = parseInt(Utils.getEnvVar(env, 'API_RATE_LIMIT', '100'));
    
    const allowed = await Utils.checkRateLimit(env, clientInfo.ip, limit, 60);
    if (!allowed) {
        return Utils.errorResponse('请求过于频繁，请稍后再试', 429);
    }
    
    return null;
}

// 创建路由器实例
const router = new Router();

// 添加中间件
router.use(rateLimitMiddleware);
router.use(authMiddleware);

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
    settings TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    last_login INTEGER,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    is_active INTEGER DEFAULT 1,
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
    tags TEXT DEFAULT '[]',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type TEXT DEFAULT 'basic',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    keyword_hash TEXT NOT NULL,
    results TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0
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
CREATE INDEX IF NOT EXISTS idx_cache_keyword ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_actions_user ON user_actions(user_id);
`;

// CORS预检请求处理
router.options('*', (request, env) => {
    const origin = request.headers.get('Origin') || '*';
    return new Response(null, {
        status: 204,
        headers: Utils.getCorsHeaders(origin)
    });
});

// 健康检查
router.get('/api/health', async (request, env) => {
    const dbStatus = await env.DB.prepare('SELECT 1').first().then(() => 'ok').catch(() => 'error');
    
    return Utils.successResponse({
        status: 'healthy',
        version: Utils.getEnvVar(env, 'APP_VERSION', '1.0.0'),
        environment: Utils.getEnvVar(env, 'ENVIRONMENT', 'production'),
        database: dbStatus,
        timestamp: Date.now()
    });
});

// 获取系统配置
router.get('/api/config', async (request, env) => {
    try {
        const configs = await env.DB.prepare(`
            SELECT key, value, config_type FROM system_config WHERE is_public = 1
        `).all();

        const config = {};
        configs.results.forEach(item => {
            let value = item.value;
            if (item.config_type === 'integer') {
                value = parseInt(value);
            } else if (item.config_type === 'boolean') {
                value = value === '1' || value === 'true';
            }
            config[item.key] = value;
        });

        return Utils.successResponse(config);
    } catch (error) {
        console.error('获取配置失败:', error);
        // 返回默认配置
        return Utils.successResponse({
            site_name: '磁力快搜',
            site_description: '专业的磁力搜索工具',
            enable_registration: true,
            min_username_length: 3,
            max_username_length: 20,
            min_password_length: 6,
            max_favorites: 500,
            max_search_history: 100
        });
    }
});

// 初始化数据库
router.post('/api/admin/init-db', async (request, env) => {
    if (!await Utils.verifyAdminAccess(request, env)) {
        return Utils.errorResponse('管理员权限验证失败', 403);
    }

    try {
        const statements = DB_SCHEMA.split(';').filter(s => s.trim());
        for (const statement of statements) {
            if (statement.trim()) {
                await env.DB.exec(statement);
            }
        }
        
        console.log('数据库初始化成功');
        return Utils.successResponse({ message: '数据库初始化成功' });
    } catch (error) {
        console.error('数据库初始化失败:', error);
        return Utils.errorResponse(`数据库初始化失败: ${error.message}`, 500);
    }
});

// 用户注册
router.post('/api/auth/register', async (request, env) => {
    try {
        const allowRegistration = Utils.getEnvVar(env, 'ALLOW_REGISTRATION', 'true') === 'true';
        if (!allowRegistration) {
            return Utils.errorResponse('注册功能已关闭');
        }

        const body = await request.json().catch(() => ({}));
        
        // 验证输入
        const validation = Utils.validateInput(body, {
            username: { required: true, minLength: 3, maxLength: 20, pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/ },
            email: { required: true, type: 'email' },
            password: { required: true, minLength: 6, maxLength: 50 }
        });

        if (!validation.isValid) {
            return Utils.errorResponse(validation.errors.join(', '));
        }

        const { username, email, password } = body;

        // 检查用户是否已存在
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, email).first();

        if (existingUser) {
            return Utils.errorResponse('用户名或邮箱已存在');
        }

        // 创建用户
        const userId = Utils.generateId();
        const passwordHash = await Utils.hashPassword(password);
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(userId, username, email, passwordHash, now, now).run();

        await Utils.logUserAction(env, userId, 'register', { username, email }, request);

        return Utils.successResponse({ 
            message: '注册成功',
            user: { id: userId, username, email }
        });

    } catch (error) {
        console.error('注册失败:', error);
        return Utils.errorResponse('注册失败，请稍后重试', 500);
    }
});

// 用户登录
router.post('/api/auth/login', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        
        const validation = Utils.validateInput(body, {
            username: { required: true },
            password: { required: true }
        });

        if (!validation.isValid) {
            return Utils.errorResponse(validation.errors.join(', '));
        }

        const { username, password } = body;

        // 查找用户
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE (username = ? OR email = ?) AND is_active = 1
        `).bind(username, username).first();

        if (!user) {
            return Utils.errorResponse('用户名或密码错误');
        }

        // 检查账号是否被锁定
        const now = Date.now();
        if (user.locked_until && now < user.locked_until) {
            const remainingMinutes = Math.ceil((user.locked_until - now) / 60000);
            return Utils.errorResponse(`账号已锁定，${remainingMinutes}分钟后重试`);
        }

        // 验证密码
        const isValidPassword = await Utils.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            // 增加失败尝试次数
            const failedAttempts = (user.failed_login_attempts || 0) + 1;
            const maxAttempts = parseInt(Utils.getEnvVar(env, 'MAX_LOGIN_ATTEMPTS', '5'));
            
            let lockUntil = null;
            if (failedAttempts >= maxAttempts) {
                const lockDuration = parseInt(Utils.getEnvVar(env, 'LOCK_DURATION', '1800')) * 1000;
                lockUntil = now + lockDuration;
            }

            await env.DB.prepare(`
                UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?
            `).bind(failedAttempts, lockUntil, user.id).run();

            return Utils.errorResponse('用户名或密码错误');
        }

        const jwtSecret = env.JWT_SECRET;
        if (!jwtSecret) {
            return Utils.errorResponse('服务器配置错误', 500);
        }

        // 生成JWT令牌
        const tokenExpiryDays = parseInt(Utils.getEnvVar(env, 'JWT_EXPIRY_DAYS', '30'));
        const expirySeconds = tokenExpiryDays * 24 * 60 * 60;

        const payload = {
            userId: user.id,
            username: user.username
        };

        const token = await Utils.generateJWT(payload, jwtSecret, expirySeconds);
        const tokenHash = await Utils.simpleHash(token);

        // 清理过期会话
        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, now).run();

        // 创建会话
        const sessionId = Utils.generateId();
        const expiresAt = now + (expirySeconds * 1000);
        const clientInfo = Utils.getClientInfo(request);

        await env.DB.prepare(`
            INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_activity, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(sessionId, user.id, tokenHash, expiresAt, now, now, clientInfo.ip, clientInfo.userAgent).run();

        // 重置失败尝试次数并更新最后登录时间
        await env.DB.prepare(`
            UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = ?, login_count = login_count + 1 WHERE id = ?
        `).bind(now, user.id).run();

        await Utils.logUserAction(env, user.id, 'login', { username }, request);

        return Utils.successResponse({
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
        return Utils.errorResponse('登录失败，请稍后重试', 500);
    }
});

// 验证令牌
router.get('/api/auth/verify', async (request, env) => {
    return Utils.successResponse({ user: request.user });
});

// 刷新令牌
router.post('/api/auth/refresh', async (request, env) => {
    try {
        const jwtSecret = env.JWT_SECRET;
        const tokenExpiryDays = parseInt(Utils.getEnvVar(env, 'JWT_EXPIRY_DAYS', '30'));
        const expirySeconds = tokenExpiryDays * 24 * 60 * 60;

        const payload = {
            userId: request.user.id,
            username: request.user.username
        };

        const newToken = await Utils.generateJWT(payload, jwtSecret, expirySeconds);
        const newTokenHash = await Utils.simpleHash(newToken);

        // 获取当前令牌
        const authHeader = request.headers.get('Authorization');
        const oldToken = authHeader.substring(7);
        const oldTokenHash = await Utils.simpleHash(oldToken);

        // 更新会话
        const now = Date.now();
        await env.DB.prepare(`
            UPDATE user_sessions SET token_hash = ?, expires_at = ?, last_activity = ?
            WHERE token_hash = ?
        `).bind(newTokenHash, now + (expirySeconds * 1000), now, oldTokenHash).run();

        return Utils.successResponse({ token: newToken });
    } catch (error) {
        console.error('刷新令牌失败:', error);
        return Utils.errorResponse('刷新令牌失败', 500);
    }
});

// 退出登录
router.post('/api/auth/logout', async (request, env) => {
    try {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader.substring(7);
        const tokenHash = await Utils.simpleHash(token);

        await env.DB.prepare(`
            UPDATE user_sessions SET is_active = 0 WHERE token_hash = ?
        `).bind(tokenHash).run();

        await Utils.logUserAction(env, request.user.id, 'logout', {}, request);

        return Utils.successResponse({ message: '退出成功' });
    } catch (error) {
        console.error('退出登录失败:', error);
        return Utils.errorResponse('退出登录失败', 500);
    }
});

// 同步收藏夹
router.post('/api/user/favorites', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { favorites } = body;

        if (!Array.isArray(favorites)) {
            return Utils.errorResponse('收藏夹数据格式错误');
        }

        const maxFavorites = parseInt(Utils.getEnvVar(env, 'MAX_FAVORITES_PER_USER', '1000'));
        if (favorites.length > maxFavorites) {
            return Utils.errorResponse(`收藏夹数量不能超过 ${maxFavorites} 个`);
        }

        // 清空现有收藏夹
        await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ?`).bind(request.user.id).run();

        // 批量插入新收藏
        for (const favorite of favorites) {
            const favoriteId = favorite.id || Utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                favoriteId,
                request.user.id,
                favorite.title || '',
                favorite.subtitle || '',
                favorite.url || '',
                favorite.icon || '',
                favorite.keyword || '',
                Date.now(),
                Date.now()
            ).run();
        }

        await Utils.logUserAction(env, request.user.id, 'sync_favorites', { count: favorites.length }, request);

        return Utils.successResponse({ message: '收藏夹同步成功' });

    } catch (error) {
        console.error('同步收藏夹失败:', error);
        return Utils.errorResponse('同步收藏夹失败', 500);
    }
});

// 获取收藏夹
router.get('/api/user/favorites', async (request, env) => {
    try {
        const result = await env.DB.prepare(`
            SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC
        `).bind(request.user.id).all();

        const favorites = result.results.map(fav => ({
            id: fav.id,
            title: fav.title,
            subtitle: fav.subtitle,
            url: fav.url,
            icon: fav.icon,
            keyword: fav.keyword,
            addedAt: new Date(fav.created_at).toISOString()
        }));

        return Utils.successResponse({ favorites });

    } catch (error) {
        console.error('获取收藏夹失败:', error);
        return Utils.errorResponse('获取收藏夹失败', 500);
    }
});

// 添加搜索记录
router.post('/api/search/record', async (request, env) => {
    try {
        const body = await request.json().catch(() => ({}));
        const { keyword, results, timestamp } = body;

        if (!keyword) {
            return Utils.errorResponse('关键词不能为空');
        }

        const recordId = Utils.generateId();
        await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, keyword, results_count, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(recordId, request.user.id, keyword, results.length || 0, timestamp || Date.now()).run();

        return Utils.successResponse({ message: '搜索记录已保存' });

    } catch (error) {
        console.error('保存搜索记录失败:', error);
        return Utils.errorResponse('保存搜索记录失败', 500);
    }
});

// 获取搜索历史
router.get('/api/user/search-history', async (request, env) => {
    try {
        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 100
        `).bind(request.user.id).all();

        const history = result.results.map(item => ({
            keyword: item.keyword,
            resultsCount: item.results_count,
            timestamp: item.created_at
        }));

        return Utils.successResponse({ history });

    } catch (error) {
        console.error('获取搜索历史失败:', error);
        return Utils.errorResponse('获取搜索历史失败', 500);
    }
});

// 用户统计
router.get('/api/user/stats', async (request, env) => {
    try {
        const [favCount, historyCount, loginCount] = await Promise.all([
            env.DB.prepare(`SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?`).bind(request.user.id).first(),
            env.DB.prepare(`SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?`).bind(request.user.id).first(),
            env.DB.prepare(`SELECT login_count, created_at FROM users WHERE id = ?`).bind(request.user.id).first()
        ]);

        const activeDays = Math.floor((Date.now() - loginCount.created_at) / (24 * 60 * 60 * 1000)) + 1;

        return Utils.successResponse({
            totalFavorites: favCount.count,
            totalSearches: historyCount.count,
            totalLogins: loginCount.login_count,
            activeDays
        });

    } catch (error) {
        console.error('获取用户统计失败:', error);
        return Utils.errorResponse('获取用户统计失败', 500);
    }
});

// 默认路由处理
router.all('*', (request) => {
    const url = new URL(request.url);
    return Utils.errorResponse(`API路径不存在: ${url.pathname}`, 404);
});

// Worker主函数
export default {
    async fetch(request, env, ctx) {
        try {
            // 验证必需的环境变量
            const requiredVars = ['JWT_SECRET', 'DB'];
            const missingVars = requiredVars.filter(varName => !env[varName]);
            
            if (missingVars.length > 0) {
                console.error('缺少必需的环境变量:', missingVars);
                return Utils.errorResponse(`服务器配置错误：缺少环境变量 ${missingVars.join(', ')}`, 500);
            }

            return await router.handle(request, env, ctx);
        } catch (error) {
            console.error('Worker错误:', error);
            return Utils.errorResponse('服务器内部错误', 500);
        }
    }
};
