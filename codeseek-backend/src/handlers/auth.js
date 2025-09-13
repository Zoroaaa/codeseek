// src/handlers/auth.js - 集成邮箱验证的认证处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { EmailVerificationService, emailVerificationUtils } from '../services/email-verification.js';

// 用户注册（集成邮箱验证）
export async function authRegisterHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, email, password, verificationCode } = body;

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

        // 标准化邮箱
        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);

        // 检查临时邮箱
        if (emailVerificationUtils.isTempEmail(normalizedEmail)) {
            return utils.errorResponse('不支持临时邮箱，请使用常用邮箱注册');
        }

        // 检查用户名和邮箱是否已存在
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, normalizedEmail).first();

        if (existingUser) {
            return utils.errorResponse('用户名或邮箱已存在');
        }

        const emailService = new EmailVerificationService(env);
        const isEmailVerificationRequired = env.EMAIL_VERIFICATION_REQUIRED === 'true';

        // 如果启用了邮箱验证且需要验证码
        if (isEmailVerificationRequired && verificationCode) {
            try {
                await emailService.verifyCode(normalizedEmail, verificationCode, 'registration');
            } catch (error) {
                return utils.errorResponse(error.message);
            }
        }

        const userId = utils.generateId();
        const passwordHash = await utils.hashPassword(password);
        const now = Date.now();

        // 创建用户账户
        await env.DB.prepare(`
            INSERT INTO users (
                id, username, email, password_hash, email_verified,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
            userId, username, normalizedEmail, passwordHash,
            isEmailVerificationRequired && verificationCode ? 1 : 0,
            now, now
        ).run();

        await utils.logUserAction(env, userId, 'register', { 
            emailVerified: isEmailVerificationRequired && verificationCode 
        }, request);

        return utils.successResponse({ 
            message: '注册成功',
            user: { 
                id: userId, 
                username, 
                email: normalizedEmail,
                emailVerified: isEmailVerificationRequired && verificationCode
            },
            requiresEmailVerification: isEmailVerificationRequired && !verificationCode
        });

    } catch (error) {
        console.error('注册失败:', error);
        return utils.errorResponse('注册失败，请稍后重试', 500);
    }
}

// 发送注册验证码
export async function authSendRegistrationCodeHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email } = body;

        if (!email || !emailVerificationUtils.isValidEmail(email)) {
            return utils.errorResponse('请输入有效的邮箱地址');
        }

        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);

        // 检查邮箱是否已注册
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE email = ?
        `).bind(normalizedEmail).first();

        if (existingUser) {
            return utils.errorResponse('该邮箱已被注册');
        }

        // 检查临时邮箱
        if (emailVerificationUtils.isTempEmail(normalizedEmail)) {
            return utils.errorResponse('不支持临时邮箱，请使用常用邮箱');
        }

        const emailService = new EmailVerificationService(env);
        const ipAddress = utils.getClientIP(request);

        // 检查发送频率限制
        await emailService.checkEmailRateLimit(normalizedEmail, ipAddress);

        // 创建验证记录
        const verification = await emailService.createEmailVerification(
            normalizedEmail, 'registration', null, { ipAddress }
        );

        // 发送验证邮件
        await emailService.sendVerificationEmail(
            normalizedEmail, 
            verification.code, 
            'verification',
            { username: '新用户' }
        );

        return utils.successResponse({
            message: `验证码已发送到 ${emailVerificationUtils.maskEmail(normalizedEmail)}`,
            maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail),
            expiresAt: verification.expiresAt
        });

    } catch (error) {
        console.error('发送验证码失败:', error);
        return utils.errorResponse(error.message || '验证码发送失败');
    }
}

// 修改密码（集成邮箱验证）
export async function authChangePasswordHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);
        
        const body = await request.json();
        const { currentPassword, newPassword, verificationCode } = body;
        
        if (!currentPassword || !newPassword) {
            return utils.errorResponse('当前密码和新密码不能为空');
        }
        
        if (!verificationCode) {
            return utils.errorResponse('请先获取邮箱验证码');
        }

        const userRecord = await env.DB.prepare(
            `SELECT * FROM users WHERE id = ?`
        ).bind(user.id).first();
        
        if (!userRecord) return utils.errorResponse('用户不存在', 404);
        
        // 验证当前密码
        const currentHash = await utils.hashPassword(currentPassword);
        if (currentHash !== userRecord.password_hash) {
            return utils.errorResponse('当前密码错误');
        }

        // 验证邮箱验证码
        const emailService = new EmailVerificationService(env);
        try {
            await emailService.verifyCode(userRecord.email, verificationCode, 'password_reset', user.id);
        } catch (error) {
            return utils.errorResponse(error.message);
        }
        
        // 更新密码
        const newHash = await utils.hashPassword(newPassword);
        await env.DB.prepare(
            `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
        ).bind(newHash, Date.now(), user.id).run();
        
        // 清除所有会话（强制重新登录）
        await env.DB.prepare(
            `DELETE FROM user_sessions WHERE user_id = ?`
        ).bind(user.id).run();

        await utils.logUserAction(env, user.id, 'password_change', { 
            method: 'email_verification' 
        }, request);

        return utils.successResponse({ message: '密码修改成功，请重新登录' });
        
    } catch (error) {
        console.error('密码修改失败:', error);
        return utils.errorResponse('密码修改失败', 500);
    }
}

// 发送密码重置验证码
export async function authSendPasswordResetCodeHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();

        if (!userRecord) {
            return utils.errorResponse('用户不存在', 404);
        }

        const emailService = new EmailVerificationService(env);
        const ipAddress = utils.getClientIP(request);

        // 检查发送频率限制
        await emailService.checkEmailRateLimit(userRecord.email, ipAddress);

        // 创建验证记录
        const verification = await emailService.createEmailVerification(
            userRecord.email, 'password_reset', user.id, { ipAddress }
        );

        // 发送验证邮件
        await emailService.sendVerificationEmail(
            userRecord.email, 
            verification.code, 
            'password_reset',
            { username: userRecord.username }
        );

        return utils.successResponse({
            message: `验证码已发送到 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
            maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
            expiresAt: verification.expiresAt
        });

    } catch (error) {
        console.error('发送密码重置验证码失败:', error);
        return utils.errorResponse(error.message || '验证码发送失败');
    }
}

// 发起邮箱更改请求
export async function authRequestEmailChangeHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const body = await request.json().catch(() => ({}));
        const { newEmail, currentPassword } = body;

        if (!newEmail || !emailVerificationUtils.isValidEmail(newEmail)) {
            return utils.errorResponse('请输入有效的新邮箱地址');
        }

        if (!currentPassword) {
            return utils.errorResponse('请输入当前密码');
        }

        const normalizedNewEmail = emailVerificationUtils.normalizeEmail(newEmail);

        // 检查临时邮箱
        if (emailVerificationUtils.isTempEmail(normalizedNewEmail)) {
            return utils.errorResponse('不支持临时邮箱');
        }

        const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();

        if (!userRecord) {
            return utils.errorResponse('用户不存在', 404);
        }

        // 验证当前密码
        const currentHash = await utils.hashPassword(currentPassword);
        if (currentHash !== userRecord.password_hash) {
            return utils.errorResponse('当前密码错误');
        }

        // 检查新邮箱是否与当前邮箱相同
        if (normalizedNewEmail === userRecord.email) {
            return utils.errorResponse('新邮箱不能与当前邮箱相同');
        }

        // 检查新邮箱是否已被其他用户使用
        const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE email = ? AND id != ?
        `).bind(normalizedNewEmail, user.id).first();

        if (existingUser) {
            return utils.errorResponse('该邮箱已被其他用户使用');
        }

        const emailService = new EmailVerificationService(env);

        // 检查是否有进行中的邮箱更改请求
        const activeRequest = await emailService.getUserActiveEmailChangeRequest(user.id);
        if (activeRequest) {
            return utils.errorResponse('您已有进行中的邮箱更改请求，请先完成或等待过期');
        }

        // 创建邮箱更改请求
        const changeRequest = await emailService.createEmailChangeRequest(
            user.id, userRecord.email, normalizedNewEmail
        );

        return utils.successResponse({
            message: '邮箱更改请求已创建，接下来需要验证新邮箱',
            requestId: changeRequest.id,
            oldEmail: emailVerificationUtils.maskEmail(userRecord.email),
            newEmail: emailVerificationUtils.maskEmail(normalizedNewEmail),
            expiresAt: changeRequest.expiresAt
        });

    } catch (error) {
        console.error('邮箱更改请求失败:', error);
        return utils.errorResponse(error.message || '邮箱更改请求失败');
    }
}

// 发送邮箱更改验证码
export async function authSendEmailChangeCodeHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const body = await request.json().catch(() => ({}));
        const { requestId, emailType } = body; // emailType: 'old' or 'new'

        if (!requestId || !emailType || !['old', 'new'].includes(emailType)) {
            return utils.errorResponse('参数错误');
        }

        const emailService = new EmailVerificationService(env);
        
        // 获取邮箱更改请求
        const changeRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
        `).bind(requestId, user.id, Date.now()).first();

        if (!changeRequest) {
            return utils.errorResponse('邮箱更改请求不存在或已过期');
        }

        const targetEmail = emailType === 'old' ? changeRequest.old_email : changeRequest.new_email;
        const verificationType = `email_change_${emailType}`;
        const ipAddress = utils.getClientIP(request);

        // 检查发送频率限制
        await emailService.checkEmailRateLimit(targetEmail, ipAddress);

        // 创建验证记录
        const verification = await emailService.createEmailVerification(
            targetEmail, verificationType, user.id, { 
                requestId, 
                emailType,
                ipAddress 
            }
        );

        // 获取用户信息
        const userRecord = await env.DB.prepare(`
            SELECT username FROM users WHERE id = ?
        `).bind(user.id).first();

        // 发送验证邮件
        await emailService.sendVerificationEmail(
            targetEmail, 
            verification.code, 
            'email_change',
            { 
                username: userRecord.username,
                oldEmail: changeRequest.old_email,
                newEmail: changeRequest.new_email
            }
        );

        return utils.successResponse({
            message: `验证码已发送到 ${emailVerificationUtils.maskEmail(targetEmail)}`,
            maskedEmail: emailVerificationUtils.maskEmail(targetEmail),
            emailType,
            expiresAt: verification.expiresAt
        });

    } catch (error) {
        console.error('发送邮箱更改验证码失败:', error);
        return utils.errorResponse(error.message || '验证码发送失败');
    }
}

// 验证邮箱更改验证码
export async function authVerifyEmailChangeCodeHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const body = await request.json().catch(() => ({}));
        const { requestId, emailType, verificationCode } = body;

        if (!requestId || !emailType || !verificationCode) {
            return utils.errorResponse('参数不完整');
        }

        const emailService = new EmailVerificationService(env);
        
        // 获取邮箱更改请求
        const changeRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
        `).bind(requestId, user.id, Date.now()).first();

        if (!changeRequest) {
            return utils.errorResponse('邮箱更改请求不存在或已过期');
        }

        const targetEmail = emailType === 'old' ? changeRequest.old_email : changeRequest.new_email;
        const verificationType = `email_change_${emailType}`;

        // 验证验证码
        try {
            await emailService.verifyCode(targetEmail, verificationCode, verificationType, user.id);
        } catch (error) {
            return utils.errorResponse(error.message);
        }

        // 标记相应邮箱为已验证
        await emailService.markEmailVerificationCompleted(requestId, verificationType);

        // 获取更新后的请求状态
        const updatedRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests WHERE id = ?
        `).bind(requestId).first();

        // 检查是否可以完成邮箱更改（新邮箱已验证）
        if (updatedRequest.new_email_verified) {
            const result = await emailService.completeEmailChange(requestId, user.id);
            
            await utils.logUserAction(env, user.id, 'email_change', {
                oldEmail: changeRequest.old_email,
                newEmail: changeRequest.new_email
            }, request);

            return utils.successResponse({
                message: '邮箱更改成功！',
                completed: true,
                newEmail: emailVerificationUtils.maskEmail(result.newEmail)
            });
        }

        return utils.successResponse({
            message: `${emailType === 'old' ? '原' : '新'}邮箱验证成功`,
            completed: false,
            nextStep: emailType === 'old' ? '请验证新邮箱' : '邮箱更改即将完成'
        });

    } catch (error) {
        console.error('邮箱更改验证失败:', error);
        return utils.errorResponse(error.message || '验证失败');
    }
}

// 删除账号（集成邮箱验证）
export async function authDeleteAccountHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const body = await request.json().catch(() => ({}));
        const { verificationCode, confirmText } = body;

        if (!verificationCode) {
            return utils.errorResponse('请先获取邮箱验证码');
        }

        if (confirmText !== '删除我的账户') {
            return utils.errorResponse('请输入确认文本："删除我的账户"');
        }

        const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();

        if (!userRecord) {
            return utils.errorResponse('用户不存在', 404);
        }

        // 验证邮箱验证码
        const emailService = new EmailVerificationService(env);
        try {
            await emailService.verifyCode(userRecord.email, verificationCode, 'account_delete', user.id);
        } catch (error) {
            return utils.errorResponse(error.message);
        }

        await utils.logUserAction(env, user.id, 'account_delete', {
            email: emailVerificationUtils.maskEmail(userRecord.email)
        }, request);

        // 删除用户账户（会级联删除相关数据）
        await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id).run();
        
        return utils.successResponse({ message: "账户已删除" });

    } catch (error) {
        console.error('删除账户失败:', error);
        return utils.errorResponse('删除账户失败', 500);
    }
}

// 发送账户删除验证码
export async function authSendAccountDeleteCodeHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();

        if (!userRecord) {
            return utils.errorResponse('用户不存在', 404);
        }

        const emailService = new EmailVerificationService(env);
        const ipAddress = utils.getClientIP(request);

        // 检查发送频率限制
        await emailService.checkEmailRateLimit(userRecord.email, ipAddress);

        // 创建验证记录
        const verification = await emailService.createEmailVerification(
            userRecord.email, 'account_delete', user.id, { ipAddress }
        );

        // 发送验证邮件
        await emailService.sendVerificationEmail(
            userRecord.email, 
            verification.code, 
            'account_delete',
            { username: userRecord.username }
        );

        return utils.successResponse({
            message: `验证码已发送到 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
            maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
            expiresAt: verification.expiresAt
        });

    } catch (error) {
        console.error('发送账户删除验证码失败:', error);
        return utils.errorResponse(error.message || '验证码发送失败');
    }
}

// 原有的处理器保持不变
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
                emailVerified: Boolean(user.email_verified),
                permissions: JSON.parse(user.permissions || '[]'),
                settings: JSON.parse(user.settings || '{}')
            }
        });

    } catch (error) {
        console.error('登录失败:', error);
        return utils.errorResponse('登录失败，请稍后重试', 500);
    }
}

// 其他原有处理器保持不变...
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
            emailVerified: Boolean(session.email_verified),
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

export async function authRefreshTokenHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

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

        const newToken = await utils.generateJWT(payload, jwtSecret);
        const newTokenHash = await utils.hashPassword(newToken);

        const authHeader = request.headers.get('Authorization');
        const oldToken = authHeader.substring(7);
        const oldTokenHash = await utils.hashPassword(oldToken);

        const expiresAt = Date.now() + (expirySeconds * 1000);
        await env.DB.prepare(`
            UPDATE user_sessions 
            SET token_hash = ?, expires_at = ?, last_activity = ?
            WHERE token_hash = ? AND user_id = ?
        `).bind(newTokenHash, expiresAt, Date.now(), oldTokenHash, user.id).run();

        await utils.logUserAction(env, user.id, 'token_refresh', {}, request);

        return utils.successResponse({
            message: 'Token刷新成功',
            token: newToken
        });

    } catch (error) {
        console.error('Token刷新失败:', error);
        return utils.errorResponse('Token刷新失败', 401);
    }
}

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