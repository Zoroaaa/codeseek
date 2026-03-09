import { Hono } from 'hono';
import { Env, User, EmailVerification, EmailChangeRequest } from '../types';
import { success, error, generateId, hashPassword, verifyPassword, generateToken, verifyToken, validateEmail, validateUsername, validatePassword, logUserAction, getClientIP } from '../utils';

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json();
  const { identifier, password } = body;

  if (!identifier || !password) {
    return c.json(error('VALIDATION_ERROR', '请输入用户名/邮箱和密码'), 400);
  }

  try {
    let queryField = 'username';
    const queryValue = identifier;
    
    if (identifier.includes('@')) {
      queryField = 'email';
    }
    
    const user = await c.env.DB.prepare(
      `SELECT * FROM users WHERE ${queryField} = ?`
    ).bind(queryValue).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户名/邮箱或密码错误'), 401);
    }

    if (!user.is_active) {
      return c.json(error('AUTH_ERROR', '账号已被禁用'), 403);
    }

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return c.json(error('AUTH_ERROR', '用户名/邮箱或密码错误'), 401);
    }

    const now = Date.now();
    await c.env.DB.prepare(
      'UPDATE users SET last_login = ?, login_count = login_count + 1, updated_at = ? WHERE id = ?'
    ).bind(now, now, user.id).run();

    const expiryDays = parseInt(c.env.JWT_EXPIRY_DAYS || '30', 10);
    const token = await generateToken(user.id, user.username, c.env.JWT_SECRET, expiryDays);

    const tokenHash = await hashPassword(token);
    const sessionId = generateId();
    const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;
    
    await c.env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_activity, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      user.id,
      tokenHash,
      expiresAt,
      now,
      now,
      getClientIP(c),
      c.req.header('User-Agent') || ''
    ).run();

    await logUserAction(c.env, user.id, 'login', { method: 'password' }, c);

    return c.json(success({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        permissions: JSON.parse(user.permissions || '[]'),
        settings: JSON.parse(user.settings || '{}'),
        isActive: user.is_active === 1,
        emailVerified: user.email_verified === 1,
        createdAt: user.created_at,
        lastLogin: now,
        loginCount: user.login_count + 1,
      },
      token,
    }, '登录成功'));
  } catch (err) {
    console.error('Login error:', err);
    return c.json(error('SERVER_ERROR', '登录失败，请稍后重试'), 500);
  }
});

authRoutes.post('/register', async (c) => {
  if (c.env.ALLOW_REGISTRATION !== 'true') {
    return c.json(error('FORBIDDEN', '注册功能已关闭'), 403);
  }

  const body = await c.req.json();
  const { username, email, password, verificationCode } = body;

  if (!username || !email || !password) {
    return c.json(error('VALIDATION_ERROR', '请填写所有必填项'), 400);
  }

  if (!validateUsername(username)) {
    return c.json(error('VALIDATION_ERROR', '用户名需要3-20个字符，只能包含字母、数字和下划线'), 400);
  }

  if (!validateEmail(email)) {
    return c.json(error('VALIDATION_ERROR', '请输入有效的邮箱地址'), 400);
  }

  if (!validatePassword(password)) {
    return c.json(error('VALIDATION_ERROR', '密码至少需要6个字符'), 400);
  }

  try {
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();

    if (existingUser) {
      return c.json(error('VALIDATION_ERROR', '用户名或邮箱已被注册'), 400);
    }

    let emailVerified = 0;
    if (verificationCode) {
      const verification = await c.env.DB.prepare(`
        SELECT * FROM email_verifications 
        WHERE email = ? AND verification_code = ? AND verification_type = 'registration' AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).bind(email, verificationCode, Date.now()).first<EmailVerification>();

      if (!verification) {
        return c.json(error('VALIDATION_ERROR', '验证码无效或已过期'), 400);
      }

      emailVerified = 1;
      
      await c.env.DB.prepare(
        'DELETE FROM email_verifications WHERE id = ?'
      ).bind(verification.id).run();
    }

    const userId = generateId();
    const now = Date.now();
    const passwordHash = await hashPassword(password);

    await c.env.DB.prepare(`
      INSERT INTO users (id, username, email, password_hash, created_at, updated_at, permissions, settings, is_active, login_count, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      username,
      email,
      passwordHash,
      now,
      now,
      JSON.stringify(['search', 'favorite', 'history', 'sync']),
      JSON.stringify({}),
      1,
      0,
      emailVerified
    ).run();

    const expiryDays = parseInt(c.env.JWT_EXPIRY_DAYS || '30', 10);
    const token = await generateToken(userId, username, c.env.JWT_SECRET, expiryDays);

    const tokenHash = await hashPassword(token);
    const sessionId = generateId();
    const expiresAt = now + expiryDays * 24 * 60 * 60 * 1000;
    
    await c.env.DB.prepare(`
      INSERT INTO user_sessions (id, user_id, token_hash, expires_at, created_at, last_activity, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      sessionId,
      userId,
      tokenHash,
      expiresAt,
      now,
      now,
      getClientIP(c),
      c.req.header('User-Agent') || ''
    ).run();

    await logUserAction(c.env, userId, 'register', { username, email }, c);

    return c.json(success({
      user: {
        id: userId,
        username,
        email,
        permissions: ['search', 'favorite', 'history', 'sync'],
        settings: {},
        isActive: true,
        emailVerified: emailVerified === 1,
        createdAt: now,
        lastLogin: now,
        loginCount: 1,
      },
      token,
    }, '注册成功'));
  } catch (err) {
    console.error('Register error:', err);
    return c.json(error('SERVER_ERROR', '注册失败，请稍后重试'), 500);
  }
});

authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const tokenHash = await hashPassword(token);
    await c.env.DB.prepare(
      'DELETE FROM user_sessions WHERE user_id = ? AND token_hash = ?'
    ).bind(payload.userId, tokenHash).run();

    await logUserAction(c.env, payload.userId, 'logout', {}, c);

    return c.json(success(null, '登出成功'));
  } catch (err) {
    console.error('Logout error:', err);
    return c.json(error('SERVER_ERROR', '登出失败'), 500);
  }
});

authRoutes.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const tokenHash = await hashPassword(token);
    const session = await c.env.DB.prepare(
      'SELECT * FROM user_sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?'
    ).bind(user.id, tokenHash, Date.now()).first();

    if (!session) {
      return c.json(error('AUTH_ERROR', '会话已过期'), 401);
    }

    await c.env.DB.prepare(
      'UPDATE user_sessions SET last_activity = ? WHERE id = ?'
    ).bind(Date.now(), session.id).run();

    return c.json(success({
      id: user.id,
      username: user.username,
      email: user.email,
      permissions: JSON.parse(user.permissions || '[]'),
      settings: JSON.parse(user.settings || '{}'),
      isActive: user.is_active === 1,
      emailVerified: user.email_verified === 1,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      loginCount: user.login_count,
    }));
  } catch (err) {
    console.error('Get me error:', err);
    return c.json(error('SERVER_ERROR', '获取用户信息失败'), 500);
  }
});

authRoutes.post('/verify-token', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const tokenHash = await hashPassword(token);
    const session = await c.env.DB.prepare(
      'SELECT * FROM user_sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?'
    ).bind(payload.userId, tokenHash, Date.now()).first();

    if (!session) {
      return c.json(error('AUTH_ERROR', '会话已过期'), 401);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, username, email FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    return c.json(success({
      valid: true,
      userId: user.id,
      username: user.username,
    }));
  } catch (err) {
    console.error('Verify token error:', err);
    return c.json(error('SERVER_ERROR', '验证失败'), 500);
  }
});

authRoutes.post('/forgot-password', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email) {
    return c.json(error('VALIDATION_ERROR', '请输入邮箱地址'), 400);
  }

  if (!validateEmail(email)) {
    return c.json(error('VALIDATION_ERROR', '请输入有效的邮箱地址'), 400);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT id, username, email FROM users WHERE email = ?'
    ).bind(email).first<User>();

    const maskedEmail = email.replace(/(.{2}).*(@.*)/, '$1***$2');
    const expiresIn = 900;

    if (!user) {
      return c.json(success({ 
        maskedEmail,
        expiresIn 
      }, '如果该邮箱已注册，您将收到密码重置邮件'));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(verificationId, user.id, user.email, code, 'password_reset', expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: user.email,
            subject: '密码重置验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>密码重置</h2>
                <p>您好，${user.username}！</p>
                <p>您收到这封邮件是因为您请求重置密码。</p>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
                <p>如果您没有请求重置密码，请忽略此邮件。</p>
              </div>
            `,
          }),
        });
        
        if (!resendResponse.ok) {
          console.error('Failed to send email:', await resendResponse.text());
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    await logUserAction(c.env, user.id, 'forgot_password', { email }, c);

    return c.json(success({ 
      maskedEmail,
      expiresIn 
    }, '如果该邮箱已注册，您将收到密码重置邮件'));
  } catch (err) {
    console.error('Forgot password error:', err);
    return c.json(error('SERVER_ERROR', '请求失败，请稍后重试'), 500);
  }
});

authRoutes.post('/reset-password', async (c) => {
  const body = await c.req.json();
  const { email, code, verificationCode, newPassword } = body;
  
  const actualCode = code || verificationCode;

  if (!email || !actualCode || !newPassword) {
    return c.json(error('VALIDATION_ERROR', '请填写所有必填项'), 400);
  }

  if (!validatePassword(newPassword)) {
    return c.json(error('VALIDATION_ERROR', '密码至少需要6个字符'), 400);
  }

  try {
    const verification = await c.env.DB.prepare(`
      SELECT * FROM email_verifications 
      WHERE email = ? AND verification_code = ? AND verification_type = 'password_reset' AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(email, actualCode, Date.now()).first<EmailVerification>();

    if (!verification) {
      return c.json(error('VALIDATION_ERROR', '验证码无效或已过期'), 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE users SET password_hash = ?, last_password_change = ?, updated_at = ? WHERE id = ?
    `).bind(passwordHash, now, now, verification.user_id).run();

    await c.env.DB.prepare(
      'DELETE FROM email_verifications WHERE id = ?'
    ).bind(verification.id).run();

    await c.env.DB.prepare(
      'DELETE FROM user_sessions WHERE user_id = ?'
    ).bind(verification.user_id).run();

    await logUserAction(c.env, verification.user_id, 'reset_password', { email }, c);

    return c.json(success(null, '密码重置成功，请重新登录'));
  } catch (err) {
    console.error('Reset password error:', err);
    return c.json(error('SERVER_ERROR', '重置失败，请稍后重试'), 500);
  }
});

authRoutes.post('/change-password', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const body = await c.req.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return c.json(error('VALIDATION_ERROR', '请填写所有必填项'), 400);
  }

  if (!validatePassword(newPassword)) {
    return c.json(error('VALIDATION_ERROR', '新密码至少需要6个字符'), 400);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return c.json(error('AUTH_ERROR', '当前密码错误'), 400);
    }

    const passwordHash = await hashPassword(newPassword);
    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE users SET password_hash = ?, last_password_change = ?, updated_at = ? WHERE id = ?
    `).bind(passwordHash, now, now, user.id).run();

    await logUserAction(c.env, user.id, 'change_password', {}, c);

    return c.json(success(null, '密码修改成功'));
  } catch (err) {
    console.error('Change password error:', err);
    return c.json(error('SERVER_ERROR', '修改失败，请稍后重试'), 500);
  }
});

authRoutes.delete('/account', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const body = await c.req.json();
  const { password, verificationCode, confirmText } = body;

  if (!verificationCode) {
    return c.json(error('VALIDATION_ERROR', '请输入验证码'), 400);
  }

  if (confirmText !== '删除我的账户') {
    return c.json(error('VALIDATION_ERROR', '请输入正确的确认文字'), 400);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const verification = await c.env.DB.prepare(`
      SELECT * FROM email_verifications 
      WHERE user_id = ? AND email = ? AND verification_code = ? AND verification_type = 'account_delete' AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(user.id, user.email, verificationCode, Date.now()).first<EmailVerification>();

    if (!verification) {
      return c.json(error('VALIDATION_ERROR', '验证码无效或已过期'), 400);
    }

    await c.env.DB.prepare('DELETE FROM email_verifications WHERE id = ?').bind(verification.id).run();

    if (password) {
      const isValid = await verifyPassword(password, user.password_hash);
      if (!isValid) {
        return c.json(error('AUTH_ERROR', '密码错误'), 400);
      }
    }

    await c.env.DB.prepare('DELETE FROM user_sessions WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare('DELETE FROM user_search_history WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare('DELETE FROM user_search_source_configs WHERE user_id = ?').bind(user.id).run();
    await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id).run();

    return c.json(success(null, '账户已删除'));
  } catch (err) {
    console.error('Delete account error:', err);
    return c.json(error('SERVER_ERROR', '删除失败，请稍后重试'), 500);
  }
});

authRoutes.post('/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const oldToken = authHeader.slice(7);
  const payload = await verifyToken(oldToken, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const oldTokenHash = await hashPassword(oldToken);
    const session = await c.env.DB.prepare(
      'SELECT * FROM user_sessions WHERE user_id = ? AND token_hash = ? AND expires_at > ?'
    ).bind(payload.userId, oldTokenHash, Date.now()).first();

    if (!session) {
      return c.json(error('AUTH_ERROR', '会话已过期'), 401);
    }

    const expiryDays = parseInt(c.env.JWT_EXPIRY_DAYS || '30', 10);
    const newToken = await generateToken(payload.userId, payload.username, c.env.JWT_SECRET, expiryDays);
    const newTokenHash = await hashPassword(newToken);
    const expiresAt = Date.now() + expiryDays * 24 * 60 * 60 * 1000;

    await c.env.DB.prepare(`
      UPDATE user_sessions 
      SET token_hash = ?, expires_at = ?, last_activity = ?
      WHERE id = ?
    `).bind(newTokenHash, expiresAt, Date.now(), session.id).run();

    await logUserAction(c.env, payload.userId, 'token_refresh', {}, c);

    return c.json(success({ token: newToken }, 'Token刷新成功'));
  } catch (err) {
    console.error('Token refresh error:', err);
    return c.json(error('SERVER_ERROR', 'Token刷新失败'), 500);
  }
});

authRoutes.post('/send-registration-code', async (c) => {
  const body = await c.req.json();
  const { email } = body;

  if (!email || !validateEmail(email)) {
    return c.json(error('VALIDATION_ERROR', '请输入有效的邮箱地址'), 400);
  }

  try {
    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (existingUser) {
      return c.json(error('VALIDATION_ERROR', '该邮箱已被注册'), 400);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const expiresIn = 900;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(verificationId, email, code, 'registration', expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: email,
            subject: '注册验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>欢迎注册 CodeSeek</h2>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return c.json(success({ 
      maskedEmail: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn 
    }, '验证码已发送'));
  } catch (err) {
    console.error('Send registration code error:', err);
    return c.json(error('SERVER_ERROR', '发送验证码失败'), 500);
  }
});

authRoutes.post('/send-password-reset-code', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const expiresIn = 900;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(verificationId, user.id, user.email, code, 'password_reset', expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: user.email,
            subject: '密码重置验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>密码重置</h2>
                <p>您好，${user.username}！</p>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return c.json(success({ 
      maskedEmail: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn 
    }, '验证码已发送'));
  } catch (err) {
    console.error('Send password reset code error:', err);
    return c.json(error('SERVER_ERROR', '发送验证码失败'), 500);
  }
});

authRoutes.post('/request-email-change', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const body = await c.req.json();
  const { newEmail, currentPassword } = body;

  if (!newEmail || !validateEmail(newEmail)) {
    return c.json(error('VALIDATION_ERROR', '请输入有效的新邮箱地址'), 400);
  }

  if (!currentPassword) {
    return c.json(error('VALIDATION_ERROR', '请输入当前密码'), 400);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      return c.json(error('AUTH_ERROR', '当前密码错误'), 400);
    }

    if (newEmail.toLowerCase() === user.email.toLowerCase()) {
      return c.json(error('VALIDATION_ERROR', '新邮箱不能与当前邮箱相同'), 400);
    }

    const existingUser = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(newEmail, user.id).first();

    if (existingUser) {
      return c.json(error('VALIDATION_ERROR', '该邮箱已被其他用户使用'), 400);
    }

    const activeRequest = await c.env.DB.prepare(`
      SELECT id FROM email_change_requests 
      WHERE user_id = ? AND status = 'pending' AND expires_at > ?
    `).bind(user.id, Date.now()).first();

    if (activeRequest) {
      return c.json(error('VALIDATION_ERROR', '您已有进行中的邮箱更改请求，请先完成或等待过期'), 400);
    }

    const requestId = generateId();
    const expiresAt = Date.now() + 30 * 60 * 1000;
    const expiresIn = 1800;

    await c.env.DB.prepare(`
      INSERT INTO email_change_requests (id, user_id, old_email, new_email, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(requestId, user.id, user.email, newEmail, 'pending', expiresAt, Date.now()).run();

    return c.json(success({
      requestId,
      oldEmail: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      newEmail: newEmail.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn
    }, '邮箱更改请求已创建，请验证新邮箱'));
  } catch (err) {
    console.error('Request email change error:', err);
    return c.json(error('SERVER_ERROR', '请求失败'), 500);
  }
});

authRoutes.post('/send-email-change-code', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const body = await c.req.json();
  const { requestId, emailType } = body;

  if (!requestId || !emailType || !['old', 'new'].includes(emailType)) {
    return c.json(error('VALIDATION_ERROR', '参数错误'), 400);
  }

  try {
    const changeRequest = await c.env.DB.prepare(`
      SELECT * FROM email_change_requests 
      WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
    `).bind(requestId, payload.userId, Date.now()).first<EmailChangeRequest>();

    if (!changeRequest) {
      return c.json(error('NOT_FOUND', '邮箱更改请求不存在或已过期'), 404);
    }

    const targetEmail = emailType === 'old' ? changeRequest.old_email : changeRequest.new_email;
    const verificationType = emailType === 'old' ? 'email_change_old' : 'email_change_new';

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const expiresIn = 900;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(verificationId, payload.userId, targetEmail, code, verificationType, expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: targetEmail,
            subject: '邮箱更改验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>邮箱更改验证</h2>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return c.json(success({ 
      emailType,
      maskedEmail: targetEmail.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn 
    }, '验证码已发送'));
  } catch (err) {
    console.error('Send email change code error:', err);
    return c.json(error('SERVER_ERROR', '发送验证码失败'), 500);
  }
});

authRoutes.post('/verify-email-change-code', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const body = await c.req.json();
  const { requestId, emailType, code } = body;

  if (!requestId || !emailType || !code) {
    return c.json(error('VALIDATION_ERROR', '参数不完整'), 400);
  }

  try {
    const changeRequest = await c.env.DB.prepare(`
      SELECT * FROM email_change_requests 
      WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
    `).bind(requestId, payload.userId, Date.now()).first<EmailChangeRequest>();

    if (!changeRequest) {
      return c.json(error('NOT_FOUND', '邮箱更改请求不存在或已过期'), 404);
    }

    const targetEmail = emailType === 'old' ? changeRequest.old_email : changeRequest.new_email;
    const verificationType = emailType === 'old' ? 'email_change_old' : 'email_change_new';

    const verification = await c.env.DB.prepare(`
      SELECT * FROM email_verifications 
      WHERE email = ? AND verification_code = ? AND verification_type = ? AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(targetEmail, code, verificationType, Date.now()).first();

    if (!verification) {
      return c.json(error('VALIDATION_ERROR', '验证码无效或已过期'), 400);
    }

    const updateField = emailType === 'old' ? 'old_email_verified' : 'new_email_verified';
    await c.env.DB.prepare(`
      UPDATE email_change_requests SET ${updateField} = 1, updated_at = ? WHERE id = ?
    `).bind(Date.now(), requestId).run();

    await c.env.DB.prepare('DELETE FROM email_verifications WHERE id = ?').bind(verification.id).run();

    const updatedRequest = await c.env.DB.prepare(
      'SELECT * FROM email_change_requests WHERE id = ?'
    ).bind(requestId).first();

    if (updatedRequest && updatedRequest.new_email_verified === 1) {
      await c.env.DB.prepare(`
        UPDATE users SET email = ?, updated_at = ? WHERE id = ?
      `).bind(changeRequest.new_email, Date.now(), payload.userId).run();

      await c.env.DB.prepare(`
        UPDATE email_change_requests SET status = 'completed', updated_at = ? WHERE id = ?
      `).bind(Date.now(), requestId).run();

      await logUserAction(c.env, payload.userId, 'email_change', {
        oldEmail: changeRequest.old_email,
        newEmail: changeRequest.new_email
      }, c);

      return c.json(success({ 
        completed: true,
        newEmail: changeRequest.new_email.replace(/(.{2}).*(@.*)/, '$1***$2')
      }, '邮箱更改成功！'));
    }

    return c.json(success({ 
      completed: false,
      message: `${emailType === 'old' ? '原' : '新'}邮箱验证成功`
    }, '验证成功'));
  } catch (err) {
    console.error('Verify email change code error:', err);
    return c.json(error('SERVER_ERROR', '验证失败'), 500);
  }
});

authRoutes.post('/send-account-delete-code', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const expiresIn = 900;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(verificationId, user.id, user.email, code, 'account_delete', expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: user.email,
            subject: '账户删除验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>账户删除确认</h2>
                <p>您好，${user.username}！</p>
                <p>您正在申请删除账户，验证码是：<strong style="font-size: 24px; color: #dc3545;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
                <p>如果这不是您本人的操作，请忽略此邮件。</p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return c.json(success({ 
      maskedEmail: user.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn 
    }, '验证码已发送'));
  } catch (err) {
    console.error('Send account delete code error:', err);
    return c.json(error('SERVER_ERROR', '发送验证码失败'), 500);
  }
});

authRoutes.get('/verification-status', async (c) => {
  const email = c.req.query('email');
  const verificationType = c.req.query('type');

  if (!email || !verificationType) {
    return c.json(error('VALIDATION_ERROR', '缺少必要参数：email 和 type'), 400);
  }

  if (!validateEmail(email)) {
    return c.json(error('VALIDATION_ERROR', '邮箱格式不正确'), 400);
  }

  try {
    const verification = await c.env.DB.prepare(`
      SELECT * FROM email_verifications 
      WHERE email = ? AND verification_type = ? AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(email, verificationType, Date.now()).first<EmailVerification>();

    if (!verification) {
      return c.json(success({
        hasPendingVerification: false,
        canResend: true
      }));
    }

    const remainingTime = verification.expires_at - Date.now();
    const canResend = remainingTime <= 60000;

    return c.json(success({
      hasPendingVerification: true,
      canResend,
      remainingTime,
      expiresAt: verification.expires_at
    }));
  } catch (err) {
    console.error('Check verification status error:', err);
    return c.json(error('SERVER_ERROR', '检查验证状态失败'), 500);
  }
});

authRoutes.get('/user-verification-status', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  try {
    const verifications = await c.env.DB.prepare(`
      SELECT * FROM email_verifications 
      WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at DESC
    `).bind(payload.userId, Date.now()).all();

    const emailChangeRequest = await c.env.DB.prepare(`
      SELECT * FROM email_change_requests 
      WHERE user_id = ? AND status = 'pending' AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).bind(payload.userId, Date.now()).first();

    return c.json(success({
      pendingVerifications: verifications.results || [],
      emailChangeRequest,
      hasAnyPendingVerifications: (verifications.results?.length > 0) || !!emailChangeRequest
    }));
  } catch (err) {
    console.error('Get user verification status error:', err);
    return c.json(error('SERVER_ERROR', '获取用户验证状态失败'), 500);
  }
});

authRoutes.post('/smart-send-code', async (c) => {
  const body = await c.req.json();
  const { email, verificationType, force = false } = body;

  if (!email || !verificationType) {
    return c.json(error('VALIDATION_ERROR', '缺少必要参数'), 400);
  }

  if (!validateEmail(email)) {
    return c.json(error('VALIDATION_ERROR', '邮箱格式不正确'), 400);
  }

  let userId = null;
  const authHeader = c.req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    if (payload) {
      userId = payload.userId;
    }
  }

  if (['password_reset', 'email_change_old', 'email_change_new', 'account_delete'].includes(verificationType) && !userId) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  try {
    if (!force) {
      const existing = await c.env.DB.prepare(`
        SELECT * FROM email_verifications 
        WHERE email = ? AND verification_type = ? AND expires_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).bind(email, verificationType, Date.now()).first<EmailVerification>();

      if (existing) {
        const remainingTime = existing.expires_at - Date.now();
        const timeSinceCreated = Date.now() - existing.created_at;
        const minResendInterval = 60000;

        if (timeSinceCreated < minResendInterval) {
          return c.json(success({
            canResend: false,
            reason: 'too_soon',
            waitTime: minResendInterval - timeSinceCreated,
            remainingTime
          }, '存在有效的验证码'));
        }
      }
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationId = generateId();
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const expiresIn = 900;

    await c.env.DB.prepare(`
      INSERT INTO email_verifications (id, user_id, email, verification_code, verification_type, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(verificationId, userId, email, code, verificationType, expiresAt, Date.now()).run();

    if (c.env.RESEND_API_KEY) {
      const subjects: Record<string, string> = {
        registration: '注册验证码',
        password_reset: '密码重置验证码',
        email_change_old: '邮箱更改验证码',
        email_change_new: '邮箱更改验证码',
        account_delete: '账户删除验证码'
      };

      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'CodeSeek <noreply@codeseek.pp.ua>',
            to: email,
            subject: subjects[verificationType] || '验证码',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${subjects[verificationType] || '验证码'}</h2>
                <p>您的验证码是：<strong style="font-size: 24px; color: #007bff;">${code}</strong></p>
                <p>验证码将在15分钟后过期。</p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    return c.json(success({
      maskedEmail: email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      expiresIn
    }, '验证码已发送'));
  } catch (err) {
    console.error('Smart send code error:', err);
    return c.json(error('SERVER_ERROR', '发送验证码失败'), 500);
  }
});
