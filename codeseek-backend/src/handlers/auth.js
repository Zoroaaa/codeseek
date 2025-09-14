// src/handlers/auth.js - 扩展版本，添加验证状态检查API
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { EmailVerificationService, emailVerificationUtils } from '../services/email-verification.js';

// 🆕 新增：检查用户验证状态
export async function authCheckVerificationStatusHandler(request, env) {
    try {
        const url = new URL(request.url);
        const email = url.searchParams.get('email');
        const verificationType = url.searchParams.get('type');
        const userId = url.searchParams.get('userId'); // 可选，用于已登录用户

        if (!email || !verificationType) {
            return utils.errorResponse('缺少必要参数：email 和 type');
        }

        if (!emailVerificationUtils.isValidEmail(email)) {
            return utils.errorResponse('邮箱格式不正确');
        }

        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
        const emailService = new EmailVerificationService(env);

        // 检查验证状态
        const verificationState = await emailService.getVerificationStateForFrontend(
            normalizedEmail, verificationType, userId
        );

        return utils.successResponse({
            message: '验证状态查询成功',
            ...verificationState
        });

    } catch (error) {
        console.error('检查验证状态失败:', error);
        return utils.errorResponse('检查验证状态失败', 500);
    }
}

// 🆕 新增：获取已登录用户的所有待验证状态
export async function authGetUserVerificationStatusHandler(request, env) {
    try {
        const user = await authenticate(request, env);
        if (!user) return utils.errorResponse('认证失败', 401);

        const emailService = new EmailVerificationService(env);
        
        // 获取用户所有待验证状态
        const pendingVerifications = await emailService.getUserPendingVerifications(user.id);
        const emailChangeRequest = await emailService.getPendingEmailChangeRequest(user.id);

        return utils.successResponse({
            message: '用户验证状态查询成功',
            pendingVerifications,
            emailChangeRequest,
            hasAnyPendingVerifications: pendingVerifications.length > 0 || !!emailChangeRequest
        });

    } catch (error) {
        console.error('获取用户验证状态失败:', error);
        return utils.errorResponse('获取用户验证状态失败', 500);
    }
}

// 🆕 新增：智能发送验证码（检查是否已有待验证码）
export async function authSmartSendVerificationCodeHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email, verificationType, force = false } = body;
        
        // 根据验证类型，可能需要用户认证
        let user = null;
        if (['password_reset', 'email_change', 'account_delete'].includes(verificationType)) {
            user = await authenticate(request, env);
            if (!user) return utils.errorResponse('认证失败', 401);
        }

        if (!email || !verificationType) {
            return utils.errorResponse('缺少必要参数');
        }

        if (!emailVerificationUtils.isValidEmail(email)) {
            return utils.errorResponse('邮箱格式不正确');
        }

        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
        const emailService = new EmailVerificationService(env);

        // 如果不是强制发送，先检查是否已有待验证码
        if (!force) {
            const canResend = await emailService.canResendVerification(
                normalizedEmail, verificationType, user?.id
            );

            if (!canResend.canResend) {
                return utils.successResponse({
                    message: '存在有效的验证码',
                    canResend: false,
                    reason: canResend.reason,
                    waitTime: canResend.waitTime,
                    existingVerification: canResend.existingVerification
                });
            }
        }

        // 根据验证类型调用相应的发送方法
        let result;
        switch (verificationType) {
            case 'registration':
                result = await sendRegistrationCodeInternal(normalizedEmail, env);
                break;
            case 'forgot_password':
                result = await sendForgotPasswordCodeInternal(normalizedEmail, env, request);
                break;
            case 'password_reset':
                result = await sendPasswordResetCodeInternal(user, env, request);
                break;
            case 'email_change_new':
            case 'email_change_old':
                // 邮箱更改需要特殊处理
                const changeRequest = await emailService.getPendingEmailChangeRequest(user.id);
                if (!changeRequest) {
                    return utils.errorResponse('没有进行中的邮箱更改请求');
                }
                const targetEmail = verificationType === 'email_change_old' ? 
                    changeRequest.oldEmail : changeRequest.newEmail;
                result = await sendEmailChangeCodeInternal(
                    changeRequest.id, verificationType, targetEmail, user, env, request
                );
                break;
            case 'account_delete':
                result = await sendAccountDeleteCodeInternal(user, env, request);
                break;
            default:
                return utils.errorResponse('不支持的验证类型');
        }

        return result;

    } catch (error) {
        console.error('智能发送验证码失败:', error);
        return utils.errorResponse(error.message || '验证码发送失败');
    }
}

// 内部方法：发送注册验证码
async function sendRegistrationCodeInternal(email, env) {
    // 检查邮箱是否已注册
    const existingUser = await env.DB.prepare(`
        SELECT id FROM users WHERE email = ?
    `).bind(email).first();

    if (existingUser) {
        throw new Error('该邮箱已被注册');
    }

    // 检查临时邮箱
    if (emailVerificationUtils.isTempEmail(email)) {
        throw new Error('不支持临时邮箱，请使用常用邮箱');
    }

    const emailService = new EmailVerificationService(env);
    const ipAddress = '127.0.0.1'; // 这里应该从请求中获取真实IP

    // 检查发送频率限制
    await emailService.checkEmailRateLimit(email, ipAddress);

    // 创建验证记录
    const verification = await emailService.createEmailVerification(
        email, 'registration', null, { ipAddress }
    );

    // 发送验证邮件
    await emailService.sendVerificationEmail(
        email, 
        verification.code, 
        'registration',
        { username: '新用户' }
    );

    return utils.successResponse({
        message: `验证码已发送到 ${emailVerificationUtils.maskEmail(email)}`,
        maskedEmail: emailVerificationUtils.maskEmail(email),
        expiresAt: verification.expiresAt
    });
}

// 内部方法：发送忘记密码验证码
async function sendForgotPasswordCodeInternal(email, env, request) {
    const user = await env.DB.prepare(`
        SELECT id, username, email FROM users WHERE email = ? AND is_active = 1
    `).bind(email).first();

    if (!user) {
        // 为了安全，不透露用户是否存在，总是返回成功
        return utils.successResponse({
            message: `如果该邮箱已注册，我们已向 ${emailVerificationUtils.maskEmail(email)} 发送密码重置验证码`,
            maskedEmail: emailVerificationUtils.maskEmail(email)
        });
    }

    const emailService = new EmailVerificationService(env);
    const ipAddress = utils.getClientIP(request);

    try {
        // 检查发送频率限制
        await emailService.checkEmailRateLimit(email, ipAddress);

        // 创建验证记录
        const verification = await emailService.createEmailVerification(
            email, 'forgot_password', user.id, { 
                ipAddress,
                requestedAt: Date.now()
            }
        );

        // 发送验证邮件
        await emailService.sendVerificationEmail(
            email, 
            verification.code, 
            'password_reset',
            { username: user.username }
        );

        await utils.logUserAction(env, user.id, 'password_reset_request', {
            method: 'email_verification',
            ipAddress
        }, request);

    } catch (error) {
        console.error('发送密码重置验证码失败:', error);
        // 即使发送失败，也不透露错误详情
    }

    return utils.successResponse({
        message: `如果该邮箱已注册，我们已向 ${emailVerificationUtils.maskEmail(email)} 发送密码重置验证码`,
        maskedEmail: emailVerificationUtils.maskEmail(email)
    });
}

// 内部方法：发送密码重置验证码（已登录用户）
async function sendPasswordResetCodeInternal(user, env, request) {
    const userRecord = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
    `).bind(user.id).first();

    if (!userRecord) {
        throw new Error('用户不存在');
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
}

// 内部方法：发送邮箱更改验证码
async function sendEmailChangeCodeInternal(requestId, emailType, targetEmail, user, env, request) {
    const emailService = new EmailVerificationService(env);
    const verificationType = emailType === 'email_change_old' ? 'email_change_old' : 'email_change_new';
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

    // 获取邮箱更改请求详情
    const changeRequest = await env.DB.prepare(`
        SELECT * FROM email_change_requests WHERE id = ?
    `).bind(requestId).first();

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
}

// 内部方法：发送账户删除验证码
async function sendAccountDeleteCodeInternal(user, env, request) {
    const userRecord = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
    `).bind(user.id).first();

    if (!userRecord) {
        throw new Error('用户不存在');
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
}

// 以下是原有的处理器（保持不变）...

// 用户注册（集成邮箱验证）
export async function authRegisterHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { username, email, password, verificationCode } = body;

        // 初始化邮箱验证状态
        let emailVerified = 0;

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

        // 如果启用了邮箱验证且提供了验证码
        if (isEmailVerificationRequired && verificationCode) {
            try {
                await emailService.verifyCode(normalizedEmail, verificationCode, 'registration');
                // 创建用户时直接设置为已验证
                emailVerified = 1;
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
            userId, username, normalizedEmail, passwordHash, emailVerified,
            now, now
        ).run();

        await utils.logUserAction(env, userId, 'register', { 
            emailVerified: Boolean(emailVerified)
        }, request);

        return utils.successResponse({ 
            message: '注册成功',
            user: { 
                id: userId, 
                username, 
                email: normalizedEmail,
                emailVerified: Boolean(emailVerified)
            },
            requiresEmailVerification: isEmailVerificationRequired && !verificationCode
        });

    } catch (error) {
        console.error('注册失败:', error);
        return utils.errorResponse('注册失败，请稍后重试', 500);
    }
}

// 用户登录（支持用户名或邮箱登录）
export async function authLoginHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { identifier, password } = body; // 改用identifier支持用户名或邮箱

        const errors = utils.validateInput({ identifier, password }, {
            identifier: { required: true, maxLength: 50 },
            password: { required: true, maxLength: 50 }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0], 400);
        }

        // 判断是邮箱还是用户名登录
        const isEmail = emailVerificationUtils.isValidEmail(identifier);
        const normalizedIdentifier = isEmail ? 
            emailVerificationUtils.normalizeEmail(identifier) : identifier;

        // 根据标识符类型查询用户
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE ${isEmail ? 'email' : 'username'} = ?
        `).bind(normalizedIdentifier).first();

        if (!user) {
            return utils.errorResponse('用户名/邮箱或密码错误', 401);
        }

        const passwordHash = await utils.hashPassword(password);
        if (passwordHash !== user.password_hash) {
            return utils.errorResponse('用户名/邮箱或密码错误', 401);
        }

        // 检查用户是否被禁用
        if (!user.is_active) {
            return utils.errorResponse('账户已被禁用，请联系管理员', 403);
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

        // 清理过期会话
        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, Date.now()).run();

        const sessionId = utils.generateId();
        const expiresAt = Date.now() + (expirySeconds * 1000);

        await env.DB.prepare(`
            INSERT INTO user_sessions (
                id, user_id, token_hash, expires_at, created_at, 
                last_activity, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            sessionId, user.id, tokenHash, expiresAt, Date.now(), 
            Date.now(), utils.getClientIP(request), 
            request.headers.get('User-Agent') || ''
        ).run();

        // 更新登录统计
        await env.DB.prepare(`
            UPDATE users SET 
                last_login = ?, 
                login_count = login_count + 1 
            WHERE id = ?
        `).bind(Date.now(), user.id).run();

        await utils.logUserAction(env, user.id, 'login', { 
            loginMethod: isEmail ? 'email' : 'username',
            sessionId,
            identifier: normalizedIdentifier
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

// 忘记密码 - 发送重置验证码
export async function authForgotPasswordHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email } = body;

        if (!email || !emailVerificationUtils.isValidEmail(email)) {
            return utils.errorResponse('请输入有效的邮箱地址');
        }

        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);

        // 检查邮箱是否存在
        const user = await env.DB.prepare(`
            SELECT id, username, email FROM users WHERE email = ? AND is_active = 1
        `).bind(normalizedEmail).first();

        if (!user) {
            // 为了安全，不透露用户是否存在，总是返回成功
            return utils.successResponse({
                message: `如果该邮箱已注册，我们已向 ${emailVerificationUtils.maskEmail(normalizedEmail)} 发送密码重置验证码`,
                maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail)
            });
        }

        const emailService = new EmailVerificationService(env);
        const ipAddress = utils.getClientIP(request);

        try {
            // 检查发送频率限制
            await emailService.checkEmailRateLimit(normalizedEmail, ipAddress);

            // 创建验证记录
            const verification = await emailService.createEmailVerification(
                normalizedEmail, 'forgot_password', user.id, { 
                    ipAddress,
                    requestedAt: Date.now()
                }
            );

            // 发送验证邮件
            await emailService.sendVerificationEmail(
                normalizedEmail, 
                verification.code, 
                'password_reset',
                { username: user.username }
            );

            await utils.logUserAction(env, user.id, 'password_reset_request', {
                method: 'email_verification',
                ipAddress
            }, request);

        } catch (error) {
            console.error('发送密码重置验证码失败:', error);
            // 即使发送失败，也不透露错误详情
        }

        return utils.successResponse({
            message: `如果该邮箱已注册，我们已向 ${emailVerificationUtils.maskEmail(normalizedEmail)} 发送密码重置验证码`,
            maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail)
        });

    } catch (error) {
        console.error('忘记密码处理失败:', error);
        return utils.errorResponse('服务暂时不可用，请稍后重试', 500);
    }
}

// 重置密码（使用验证码）
export async function authResetPasswordHandler(request, env) {
    try {
        const body = await request.json().catch(() => ({}));
        const { email, verificationCode, newPassword } = body;

        const errors = utils.validateInput({ email, verificationCode, newPassword }, {
            email: { 
                required: true,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: '邮箱格式不正确'
            },
            verificationCode: { 
                required: true,
                pattern: /^\d{6}$/,
                message: '验证码必须是6位数字'
            },
            newPassword: { 
                required: true, 
                minLength: 6,
                maxLength: 50
            }
        });

        if (errors.length > 0) {
            return utils.errorResponse(errors[0]);
        }

        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);

        // 检查用户是否存在且激活
        const user = await env.DB.prepare(`
            SELECT * FROM users WHERE email = ? AND is_active = 1
        `).bind(normalizedEmail).first();

        if (!user) {
            return utils.errorResponse('用户不存在或已被禁用');
        }

        const emailService = new EmailVerificationService(env);

        // 验证邮箱验证码
        try {
            const verifyResult = await emailService.verifyCode(
                normalizedEmail, verificationCode, 'forgot_password', user.id
            );

            if (!verifyResult.success) {
                return utils.errorResponse('验证码无效或已过期');
            }
        } catch (error) {
            return utils.errorResponse(error.message);
        }

        // 更新密码
        const newPasswordHash = await utils.hashPassword(newPassword);
        await env.DB.prepare(`
            UPDATE users SET 
                password_hash = ?, 
                updated_at = ? 
            WHERE id = ?
        `).bind(newPasswordHash, Date.now(), user.id).run();

        // 清除所有会话（强制重新登录）
        await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ?
        `).bind(user.id).run();

        await utils.logUserAction(env, user.id, 'password_reset', { 
            method: 'email_verification',
            forced_relogin: true
        }, request);

        return utils.successResponse({ 
            message: '密码重置成功，请使用新密码登录',
            requiresLogin: true
        });

    } catch (error) {
        console.error('密码重置失败:', error);
        return utils.errorResponse('密码重置失败，请稍后重试', 500);
    }
}

// 其他原有处理器保持不变...
// （这里包含其他所有原有的处理器函数，如修改密码、邮箱更改、账户删除等）

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

// 其他处理器... （这里省略其他处理器的完整代码，实际使用时需要包含所有原有处理器）
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

        await utils.logUserAction(env, user.id, 'logout', {}, request);
    }
    return utils.successResponse({ message: '退出成功' });
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
            'registration',
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

// 发送密码重置验证码（已登录用户）
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
        const verificationType = emailType === 'old' ? 'email_change_old' : 'email_change_new';
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
        const verificationType = emailType === 'old' ? 'email_change_old' : 'email_change_new';

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