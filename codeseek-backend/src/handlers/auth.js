// src/handlers/auth.js - 认证相关路由处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';

// 用户注册
export async function authRegisterHandler(request, env) {
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
}

// 用户登录
export async function authLoginHandler(request, env) {
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
}

// Token验证
export async function authVerifyTokenHandler(request, env) {
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
}

// 修改密码
export async function authChangePasswordHandler(request, env) {
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
}

// 用户退出登录
export async function authLogoutHandler(request, env) {
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
}

// 删除账户
export async function authDeleteAccountHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    try {
        await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id).run();
        return utils.successResponse({ message: "账户已删除" });
    } catch (e) {
        console.error('删除账户失败:', e);
        return utils.errorResponse('删除账户失败', 500);
    }
}