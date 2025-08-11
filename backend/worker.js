// Cloudflare Worker 后端主文件 - 直接部署版本
// 支持直接上传到 Cloudflare Workers 控制台部署

// 简单的路由器实现（替代 itty-router）
class SimpleRouter {
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
        return utils.errorResponse('数据库初始化失败', 500);
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

        const { username, email, password } = await request.json();

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
        const { favorites } = await request.json();

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

// 同步搜索历史
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

        // 检查搜索历史数量限制
        const maxHistoryItems = parseInt(utils.getEnvVar(env, 'MAX_HISTORY_PER_USER', '1000'));
        if (history.length > maxHistoryItems) {
            return utils.errorResponse(`搜索历史数量不能超过 ${maxHistoryItems} 个`);
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
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);

        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?
        `).bind(user.id, limit).all();

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
        const cacheEnabled = utils.getEnvVar(env, 'ENABLE_SEARCH_CACHE', 'true') === 'true';
        if (cacheEnabled) {
            const cached = await env.DB.prepare(`
                SELECT results FROM search_cache WHERE keyword = ? AND expires_at > ?
            `).bind(keyword, Date.now()).first();

            if (cached) {
                return utils.successResponse({ 
                    results: JSON.parse(cached.results),
                    cached: true
                });
            }
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
        if (cacheEnabled) {
            const cacheTTL = parseInt(utils.getEnvVar(env, 'SEARCH_CACHE_TTL', '1800')); // 默认30分钟
            const cacheId = utils.generateId();
            await env.DB.prepare(`
                INSERT OR REPLACE INTO search_cache (id, keyword, results, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?)
            `).bind(
                cacheId,
                keyword,
                JSON.stringify(enhancedResults),
                Date.now() + (cacheTTL * 1000),
                Date.now()
            ).run();
        }

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
        const timeoutMs = parseInt(utils.getEnvVar(env, 'SITE_CHECK_TIMEOUT', '5000'));

        for (const url of urls) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
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
        const { keyword, results, ttl } = await request.json();
        const cacheTTL = ttl || parseInt(utils.getEnvVar(env, 'SEARCH_CACHE_TTL', '1800'));

        const cacheId = utils.generateId();
        await env.DB.prepare(`
            INSERT OR REPLACE INTO search_cache (id, keyword, results, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?)
        `).bind(
            cacheId,
            keyword,
            JSON.stringify(results),
            Date.now() + (cacheTTL * 1000),
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
        // 检查是否允许查看统计（可以根据需要调整权限）
        const allowPublicStats = utils.getEnvVar(env, 'ALLOW_PUBLIC_STATS', 'false') === 'true';
        
        if (!allowPublicStats) {
            // 验证管理员权限
            if (!await utils.verifyAdminAccess(request, env)) {
                return utils.errorResponse('权限不足', 403);
            }
        }

        // 获取总体统计
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
        const feedback = await request.json();
        
        // 获取用户信息（可选）
        let userId = null;
        try {
            const user = await authenticate(request, env);
            userId = user?.id;
        } catch (error) {
            // 允许匿名反馈
        }

        await utils.logUserAction(env, userId, 'feedback', feedback, request);

        return utils.successResponse({ message: '反馈已提交，感谢您的建议！' });

    } catch (error) {
        console.error('提交反馈失败:', error);
        return utils.errorResponse('提交反馈失败', 500);
    }
});

// 清理过期数据的定时任务端点
router.post('/api/admin/cleanup', async (request, env) => {
    // 验证管理员权限
    if (!await utils.verifyAdminAccess(request, env)) {
        return utils.errorResponse('管理员权限验证失败', 403);
    }

    try {
        const now = Date.now();
        
        // 清理过期会话
        const expiredSessions = await env.DB.prepare(`
            DELETE FROM user_sessions WHERE expires_at < ? RETURNING COUNT(*) as count
        `).bind(now).all();

        // 清理过期缓存
        const expiredCache = await env.DB.prepare(`
            DELETE FROM search_cache WHERE expires_at < ? RETURNING COUNT(*) as count
        `).bind(now).all();

        // 清理旧的用户行为记录（保留指定天数）
        const retentionDays = parseInt(utils.getEnvVar(env, 'ACTION_LOG_RETENTION_DAYS', '30'));
        const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
        const cutoffTime = now - retentionMs;
        
        const oldActions = await env.DB.prepare(`
            DELETE FROM user_actions WHERE created_at < ? RETURNING COUNT(*) as count
        `).bind(cutoffTime).all();

        return utils.successResponse({ 
            message: '数据清理完成',
            cleaned: {
                sessions: expiredSessions.results?.[0]?.count || 0,
                cache: expiredCache.results?.[0]?.count || 0,
                actions: oldActions.results?.[0]?.count || 0
            }
        });

    } catch (error) {
        console.error('数据清理失败:', error);
        return utils.errorResponse('数据清理失败', 500);
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
router.all('*', () => utils.errorResponse('API路径不存在', 404));

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