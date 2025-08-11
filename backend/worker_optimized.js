// Cloudflare Worker 后端主文件 - 优化版本
// 适用于直接在 Cloudflare Worker 控制台上传配置

// 配置常量
const CONFIG = {
    JWT_SECRET: 'your-jwt-secret-change-this-in-production', // 生产环境需要在环境变量中设置
    DB_CACHE_TTL: 3600, // 数据库缓存TTL（秒）
    SESSION_TTL: 30 * 24 * 60 * 60, // 会话TTL（30天）
    SEARCH_CACHE_TTL: 1800, // 搜索缓存TTL（30分钟）
    MAX_FAVORITES: 500,
    MAX_SEARCH_HISTORY: 100
};

// 数据库初始化SQL（完整版本）
const DB_SCHEMA = `
-- 用户表
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
    last_login INTEGER
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户收藏表
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户搜索历史表
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type TEXT DEFAULT 'basic',
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 搜索缓存表
CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    keyword_hash TEXT NOT NULL,
    results TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0
);

-- 用户行为记录表
CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 站点状态监控表
CREATE TABLE IF NOT EXISTS site_monitoring (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    response_time INTEGER,
    last_checked INTEGER NOT NULL,
    error_message TEXT,
    check_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0
);

-- 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created ON user_favorites(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);

CREATE INDEX IF NOT EXISTS idx_history_user ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_keyword ON user_search_history(keyword);
CREATE INDEX IF NOT EXISTS idx_history_created ON user_search_history(created_at);

CREATE INDEX IF NOT EXISTS idx_cache_keyword ON search_cache(keyword);
CREATE INDEX IF NOT EXISTS idx_cache_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_actions_user ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON user_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action ON user_actions(action);

CREATE INDEX IF NOT EXISTS idx_monitoring_url ON site_monitoring(url);
CREATE INDEX IF NOT EXISTS idx_monitoring_checked ON site_monitoring(last_checked);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(type);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);
`;

// 初始化数据
const INITIAL_DATA = `
-- 初始化系统配置
INSERT OR IGNORE INTO system_config (key, value, description, created_at, updated_at) VALUES
('site_name', '磁力快搜', '网站名称', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('site_description', '专业的磁力搜索工具', '网站描述', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_search_history', '100', '最大搜索历史记录数', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '500', '最大收藏数量', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_ttl', '3600', '搜索缓存TTL（秒）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('session_ttl', '2592000', '会话TTL（秒，30天）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('maintenance_mode', '0', '维护模式', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 初始化默认监控站点
INSERT OR IGNORE INTO site_monitoring (id, url, name, last_checked) VALUES
('javbus', 'https://www.javbus.com', 'JavBus', 0),
('javdb', 'https://javdb.com', 'JavDB', 0),
('javlibrary', 'https://www.javlibrary.com', 'JavLibrary', 0),
('av01', 'https://av01.tv', 'AV01', 0),
('missav', 'https://missav.com', 'MissAV', 0),
('jable', 'https://jable.tv', 'Jable', 0);
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
        const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
        const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
        
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
        const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '');
        
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
            
            const signature = Uint8Array.from(atob(encodedSignature), c => c.charCodeAt(0));
            const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
            
            if (!isValid) return null;
            
            const payload = JSON.parse(atob(encodedPayload));
            
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

    // 响应工具
    jsonResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    },

    errorResponse(message, status = 400) {
        return this.jsonResponse({ success: false, message }, status);
    },

    successResponse(data = {}) {
        return this.jsonResponse({ success: true, ...data });
    },

    // 获取客户端IP
    getClientIP(request) {
        return request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               'unknown';
    },

    // 记录用户行为
    async logUserAction(env, userId, action, data, request) {
        try {
            if (!env.DB) return; // 如果数据库不可用，跳过记录
            
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

    // 数据库初始化
    async initDatabase(env) {
        try {
            if (!env.DB) {
                throw new Error('数据库未配置');
            }

            // 执行数据库结构创建
            const statements = DB_SCHEMA.split(';').filter(s => s.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    await env.DB.exec(statement);
                }
            }

            // 执行初始化数据插入
            const dataStatements = INITIAL_DATA.split(';').filter(s => s.trim());
            for (const statement of dataStatements) {
                if (statement.trim()) {
                    await env.DB.exec(statement);
                }
            }

            console.log('数据库初始化完成');
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    },

    // 获取配置值
    getConfig(env, key, defaultValue = null) {
        // 优先从环境变量获取，然后从CONFIG对象获取
        return env[key] || CONFIG[key] || defaultValue;
    }
};

// 路由处理器
class Router {
    constructor() {
        this.routes = [];
    }

    addRoute(method, path, handler) {
        this.routes.push({ method, path, handler });
    }

    get(path, handler) {
        this.addRoute('GET', path, handler);
    }

    post(path, handler) {
        this.addRoute('POST', path, handler);
    }

    put(path, handler) {
        this.addRoute('PUT', path, handler);
    }

    delete(path, handler) {
        this.addRoute('DELETE', path, handler);
    }

    options(path, handler) {
        this.addRoute('OPTIONS', path, handler);
    }

    all(path, handler) {
        this.addRoute('*', path, handler);
    }

    async handle(request, env) {
        const url = new URL(request.url);
        const method = request.method;
        
        // 查找匹配的路由
        for (const route of this.routes) {
            if ((route.method === '*' || route.method === method) && this.matchPath(route.path, url.pathname)) {
                try {
                    return await route.handler(request, env);
                } catch (error) {
                    console.error('路由处理错误:', error);
                    return utils.errorResponse('服务器内部错误', 500);
                }
            }
        }

        return utils.errorResponse('API路径不存在', 404);
    }

    matchPath(routePath, requestPath) {
        // 简单的路径匹配
        if (routePath === '*') return true;
        if (routePath === requestPath) return true;
        
        // 支持通配符匹配
        const routeParts = routePath.split('/');
        const requestParts = requestPath.split('/');
        
        if (routeParts.length !== requestParts.length) {
            // 检查是否以 /* 结尾
            if (routePath.endsWith('/*') && requestPath.startsWith(routePath.slice(0, -2))) {
                return true;
            }
            return false;
        }
        
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i] !== requestParts[i] && routeParts[i] !== '*') {
                return false;
            }
        }
        
        return true;
    }
}

// 创建路由器
const router = new Router();

// 认证中间件
async function authenticate(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const jwtSecret = utils.getConfig(env, 'JWT_SECRET');
    const payload = await utils.verifyJWT(token, jwtSecret);
    
    if (!payload) {
        return null;
    }

    // 验证会话是否存在且未过期
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
}

// CORS预检请求处理
router.options('*', () => {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
});

// 健康检查
router.get('/api/health', async (request, env) => {
    return utils.successResponse({
        status: 'healthy',
        timestamp: Date.now(),
        version: '1.0.0'
    });
});

// 数据库初始化（管理员接口）
router.post('/api/admin/init-db', async (request, env) => {
    try {
        await utils.initDatabase(env);
        return utils.successResponse({ message: '数据库初始化成功' });
    } catch (error) {
        console.error('数据库初始化失败:', error);
        return utils.errorResponse('数据库初始化失败: ' + error.message, 500);
    }
});

// 用户注册
router.post('/api/auth/register', async (request, env) => {
    try {
        const { username, email, password } = await request.json();

        // 输入验证
        if (!username || !email || !password) {
            return utils.errorResponse('用户名、邮箱和密码都是必需的');
        }

        if (username.length < 3 || username.length > 20) {
            return utils.errorResponse('用户名长度应在3-20个字符之间');
        }

        if (password.length < 6) {
            return utils.errorResponse('密码至少需要6个字符');
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
        const { username, password } = await request.json();

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

        // 生成JWT token
        const jwtSecret = utils.getConfig(env, 'JWT_SECRET');
        const payload = {
            userId: user.id,
            username: user.username,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + CONFIG.SESSION_TTL
        };

        const token = await utils.generateJWT(payload, jwtSecret);
        const tokenHash = await utils.hashPassword(token);

        // 清理过期会话
        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, Date.now()).run();

        // 创建新会话
        const sessionId = utils.generateId();
        const expiresAt = Date.now() + (CONFIG.SESSION_TTL * 1000);

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
        const { favorites } = await request.json();

        if (!Array.isArray(favorites)) {
            return utils.errorResponse('收藏夹数据格式错误');
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
            tags: JSON.parse(fav.tags || '[]'),
            notes: fav.notes,
            addedAt: new Date(fav.created_at).toISOString()
        }));

        return utils.successResponse({ favorites });

    } catch (error) {
        console.error('获取收藏夹失败:', error);
        return utils.errorResponse('获取收藏夹失败', 500);
    }
});

// 搜索历史相关API
router.post('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const { history } = await request.json();

        if (!Array.isArray(history)) {
            return utils.errorResponse('搜索历史数据格式错误');
        }

        // 清空现有搜索历史
        await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();

        // 插入新历史记录
        for (const item of history) {
            const historyId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_search_history (id, user_id, keyword, results_count, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                historyId,
                user.id,
                item.keyword || '',
                item.count || 0,
                item.timestamp || Date.now()
            ).run();
        }

        // 记录同步行为
        await utils.logUserAction(env, user.id, 'sync_search_history', { count: history.length }, request);

        return utils.successResponse({ message: '搜索历史同步成功' });

    } catch (error) {
        console.error('同步搜索历史失败:', error);
        return utils.errorResponse('同步搜索历史失败', 500);
    }
});

// 获取搜索历史
router.get('/api/user/search-history', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
        `).bind(user.id).all();

        const history = result.results.map(item => ({
            keyword: item.keyword,
            count: item.results_count,
            timestamp: item.created_at
        }));

        return utils.successResponse({ history });

    } catch (error) {
        console.error('获取搜索历史失败:', error);
        return utils.errorResponse('获取搜索历史失败', 500);
    }
});

// 增强搜索API
router.post('/api/search/enhanced', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const { keyword, basicResults } = await request.json();

        // 检查缓存
        const cached = await env.DB.prepare(`
            SELECT results FROM search_cache WHERE keyword = ? AND expires_at > ?
        `).bind(keyword, Date.now()).first();

        if (cached) {
            return utils.successResponse({ results: JSON.parse(cached.results) });
        }

        // TODO: 这里可以添加实际的搜索增强逻辑
        // 比如调用第三方API、爬虫等
        let enhancedResults = basicResults || [];

        // 简单的结果增强示例：添加可用性检查
        for (let result of enhancedResults) {
            result.enhanced = true;
            result.lastChecked = Date.now();
            // 这里可以添加实际的网站可用性检查
        }

        // 缓存结果
        const cacheId = utils.generateId();
        const keywordHash = await utils.hashPassword(keyword);
        await env.DB.prepare(`
            INSERT INTO search_cache (id, keyword, keyword_hash, results, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            cacheId,
            keyword,
            keywordHash,
            JSON.stringify(enhancedResults),
            Date.now() + (CONFIG.SEARCH_CACHE_TTL * 1000),
            Date.now()
        ).run();

        // 记录搜索行为
        await utils.logUserAction(env, user.id, 'search_enhanced', { keyword, resultsCount: enhancedResults.length }, request);

        return utils.successResponse({ results: enhancedResults });

    } catch (error) {
        console.error('增强搜索失败:', error);
        return utils.errorResponse('增强搜索失败', 500);
    }
});

// 获取搜索统计
router.get('/api/search/stats', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        // 获取用户搜索统计
        const userStats = await env.DB.prepare(`
            SELECT COUNT(*) as total_searches,
                   COUNT(DISTINCT keyword) as unique_keywords
            FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        // 获取热门搜索关键词（用户相关）
        const popularKeywords = await env.DB.prepare(`
            SELECT keyword, COUNT(*) as count
            FROM user_search_history WHERE user_id = ?
            GROUP BY keyword ORDER BY count DESC LIMIT 10
        `).bind(user.id).all();

        return utils.successResponse({
            totalSearches: userStats.total_searches || 0,
            uniqueKeywords: userStats.unique_keywords || 0,
            popularKeywords: popularKeywords.results
        });

    } catch (error) {
        console.error('获取搜索统计失败:', error);
        return utils.errorResponse('获取搜索统计失败', 500);
    }
});

// 记录搜索行为
router.post('/api/search/record', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const { keyword, results, timestamp } = await request.json();

        // 记录到搜索历史
        const historyId = utils.generateId();
        await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, keyword, results_count, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            historyId,
            user.id,
            keyword,
            results ? results.length : 0,
            timestamp || Date.now()
        ).run();

        return utils.successResponse({ message: '搜索记录已保存' });

    } catch (error) {
        console.error('记录搜索失败:', error);
        return utils.errorResponse('记录搜索失败', 500);
    }
});

// 用户设置
router.get('/api/user/settings', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    return utils.successResponse({ settings: user.settings });
});

router.put('/api/user/settings', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const settings = await request.json();

        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(settings), Date.now(), user.id).run();

        return utils.successResponse({ message: '设置已更新' });

    } catch (error) {
        console.error('更新设置失败:', error);
        return utils.errorResponse('更新设置失败', 500);
    }
});

// 站点状态检查
router.post('/api/sites/status', async (request, env) => {
    try {
        const { urls } = await request.json();
        const results = [];

        for (const url of urls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(url, { 
                    method: 'HEAD', 
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                results.push({
                    url,
                    status: response.status,
                    accessible: response.ok,
                    responseTime: Date.now()
                });
            } catch (error) {
                results.push({
                    url,
                    status: 0,
                    accessible: false,
                    error: error.message
                });
            }
        }

        return utils.successResponse({ results });

    } catch (error) {
        console.error('检查站点状态失败:', error);
        return utils.errorResponse('检查站点状态失败', 500);
    }
});

// 缓存管理
router.get('/api/cache/search', async (request, env) => {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');

    if (!keyword) {
        return utils.errorResponse('缺少关键词参数');
    }

    try {
        const cached = await env.DB.prepare(`
            SELECT results FROM search_cache WHERE keyword = ? AND expires_at > ?
        `).bind(keyword, Date.now()).first();

        if (cached) {
            return utils.successResponse({ 
                results: JSON.parse(cached.results),
                cached: true 
            });
        } else {
            return utils.successResponse({ 
                results: null,
                cached: false 
            });
        }

    } catch (error) {
        console.error('获取缓存失败:', error);
        return utils.errorResponse('获取缓存失败', 500);
    }
});

router.post('/api/cache/search', async (request, env) => {
    try {
        const { keyword, results, ttl = CONFIG.SEARCH_CACHE_TTL } = await request.json();

        const cacheId = utils.generateId();
        const keywordHash = await utils.hashPassword(keyword);
        await env.DB.prepare(`
            INSERT OR REPLACE INTO search_cache (id, keyword, keyword_hash, results, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            cacheId,
            keyword,
            keywordHash,
            JSON.stringify(results),
            Date.now() + (ttl * 1000),
            Date.now()
        ).run();

        return utils.successResponse({ message: '缓存已保存' });

    } catch (error) {
        console.error('保存缓存失败:', error);
        return utils.errorResponse('保存缓存失败', 500);
    }
});

// 统计API
router.get('/api/stats', async (request, env) => {
    try {
        // 获取总体统计（可以根据需要调整权限）
        const userCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM users
        `).first();

        const searchCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history
        `).first();

        const favoriteCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_favorites
        `).first();

        return utils.successResponse({
            totalUsers: userCount.count || 0,
            totalSearches: searchCount.count || 0,
            totalFavorites: favoriteCount.count || 0,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('获取统计数据失败:', error);
        return utils.errorResponse('获取统计数据失败', 500);
    }
});

// 记录用户行为
router.post('/api/stats/action', async (request, env) => {
    try {
        const { action, data, timestamp } = await request.json();
        
        // 尝试获取用户信息（可选）
        let userId = null;
        try {
            const user = await authenticate(request, env);
            userId = user?.id;
        } catch (error) {
            // 忽略认证错误，允许匿名记录
        }

        await utils.logUserAction(env, userId, action, data, request);

        return utils.successResponse({ message: '行为已记录' });

    } catch (error) {
        console.error('记录行为失败:', error);
        return utils.errorResponse('记录行为失败', 500);
    }
});

// 反馈API
router.post('/api/feedback', async (request, env) => {
    try {
        const { type, title, content, priority = 0 } = await request.json();
        
        if (!type || !title || !content) {
            return utils.errorResponse('反馈类型、标题和内容都是必需的');
        }

        // 获取用户信息（可选）
        let userId = null;
        try {
            const user = await authenticate(request, env);
            userId = user?.id;
        } catch (error) {
            // 允许匿名反馈
        }

        const feedbackId = utils.generateId();
        const now = Date.now();

        await env.DB.prepare(`
            INSERT INTO user_feedback (id, user_id, type, title, content, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(feedbackId, userId, type, title, content, priority, now, now).run();

        await utils.logUserAction(env, userId, 'feedback', { type, title }, request);

        return utils.successResponse({ message: '反馈已提交，感谢您的建议！' });

    } catch (error) {
        console.error('提交反馈失败:', error);
        return utils.errorResponse('提交反馈失败', 500);
    }
});

// 获取系统配置
router.get('/api/config', async (request, env) => {
    try {
        const result = await env.DB.prepare(`
            SELECT key, value FROM system_config
        `).all();

        const config = {};
        result.results.forEach(item => {
            config[item.key] = item.value;
        });

        return utils.successResponse({ config });

    } catch (error) {
        console.error('获取系统配置失败:', error);
        return utils.errorResponse('获取系统配置失败', 500);
    }
});

// 清理过期数据的定时任务端点
router.post('/api/admin/cleanup', async (request, env) => {
    try {
        const now = Date.now();
        
        // 清理过期会话
        const expiredSessions = await env.DB.prepare(`
            DELETE FROM user_sessions WHERE expires_at < ?
        `).bind(now).run();

        // 清理过期缓存
        const expiredCache = await env.DB.prepare(`
            DELETE FROM search_cache WHERE expires_at < ?
        `).bind(now).run();

        // 清理旧的用户行为记录（保留30天）
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const oldActions = await env.DB.prepare(`
            DELETE FROM user_actions WHERE created_at < ?
        `).bind(thirtyDaysAgo).run();

        // 清理过期通知
        const expiredNotifications = await env.DB.prepare(`
            DELETE FROM notifications WHERE expires_at IS NOT NULL AND expires_at < ?
        `).bind(now).run();

        return utils.successResponse({ 
            message: '数据清理完成',
            cleaned: {
                sessions: expiredSessions.changes || 0,
                cache: expiredCache.changes || 0,
                actions: oldActions.changes || 0,
                notifications: expiredNotifications.changes || 0
            }
        });

    } catch (error) {
        console.error('数据清理失败:', error);
        return utils.errorResponse('数据清理失败', 500);
    }
});

// 获取用户通知
router.get('/api/user/notifications', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT * FROM notifications 
            WHERE user_id = ? AND (expires_at IS NULL OR expires_at > ?)
            ORDER BY created_at DESC
        `).bind(user.id, Date.now()).all();

        const notifications = result.results.map(notif => ({
            id: notif.id,
            type: notif.type,
            title: notif.title,
            content: notif.content,
            data: JSON.parse(notif.data || '{}'),
            isRead: Boolean(notif.is_read),
            createdAt: new Date(notif.created_at).toISOString(),
            expiresAt: notif.expires_at ? new Date(notif.expires_at).toISOString() : null
        }));

        return utils.successResponse({ notifications });

    } catch (error) {
        console.error('获取通知失败:', error);
        return utils.errorResponse('获取通知失败', 500);
    }
});

// 标记通知为已读
router.put('/api/user/notifications/:id/read', async (request, env) => {
    const user = await authenticate(request, env);
    
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/');
        const notificationId = pathParts[pathParts.length - 2]; // 获取通知ID

        await env.DB.prepare(`
            UPDATE notifications SET is_read = 1 
            WHERE id = ? AND user_id = ?
        `).bind(notificationId, user.id).run();

        return utils.successResponse({ message: '通知已标记为已读' });

    } catch (error) {
        console.error('标记通知失败:', error);
        return utils.errorResponse('标记通知失败', 500);
    }
});

// 默认路由 - 处理未匹配的路径
router.all('*', () => utils.errorResponse('API路径不存在', 404));

// Worker主函数
export default {
    async fetch(request, env, ctx) {
        try {
            // 确保数据库已初始化（首次运行时）
            if (env.DB && request.url.includes('/api/') && !request.url.includes('/init-db')) {
                try {
                    // 简单检查数据库是否已初始化
                    await env.DB.prepare(`SELECT 1 FROM users LIMIT 1`).first();
                } catch (error) {
                    // 数据库未初始化，自动初始化
                    console.log('数据库未初始化，开始自动初始化...');
                    try {
                        await utils.initDatabase(env);
                    } catch (initError) {
                        console.error('自动初始化数据库失败:', initError);
                    }
                }
            }

            return await router.handle(request, env);
        } catch (error) {
            console.error('Worker错误:', error);
            return utils.errorResponse('服务器内部错误', 500);
        }
    }
};

        