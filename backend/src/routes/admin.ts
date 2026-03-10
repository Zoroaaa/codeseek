/**
 * 管理员功能路由
 * 功能：用户管理、系统配置、举报处理、数据统计、角色管理
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Hono } from 'hono';
import { Env, User, CommunitySourceReport, UserAction, JwtPayload, Role } from '../types';
import { success, error, verifyToken, logUserAction } from '../utils';

export const adminRoutes = new Hono<{ Bindings: Env }>();

const getAdminUser = async (c: any): Promise<JwtPayload | null> => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return null;
  }

  if (payload.role !== 'admin' && payload.role !== 'super_admin') {
    return null;
  }

  return payload;
};

adminRoutes.use('*', async (c, next) => {
  const adminUser = await getAdminUser(c);
  if (!adminUser) {
    return c.json(error('AUTH_ERROR', '需要管理员权限'), 403);
  }
  c.set('user', adminUser);
  await next();
});

/**
 * 获取角色列表
 * GET /api/admin/roles
 */
adminRoutes.get('/roles', async (c) => {
  try {
    const roles = await c.env.DB.prepare(
      'SELECT * FROM roles ORDER BY priority DESC'
    ).all<Role>();

    return c.json(success({
      roles: (roles.results || []).map(r => ({
        id: r.id,
        name: r.name,
        displayName: r.display_name,
        description: r.description,
        permissions: JSON.parse(r.permissions || '[]'),
        isSystem: r.is_system === 1,
        priority: r.priority,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    }));
  } catch (err) {
    console.error('Get roles error:', err);
    return c.json(error('SERVER_ERROR', '获取角色列表失败'), 500);
  }
});

/**
 * 获取用户列表
 * GET /api/admin/users
 */
adminRoutes.get('/users', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
  const search = c.req.query('search');
  const status = c.req.query('status');
  const roleId = c.req.query('roleId');

  try {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (search) {
      whereClause += ' AND (u.username LIKE ? OR u.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status === 'active') {
      whereClause += ' AND u.is_active = 1';
    } else if (status === 'inactive') {
      whereClause += ' AND u.is_active = 0';
    }

    if (roleId) {
      whereClause += ' AND u.role_id = ?';
      params.push(roleId);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const users = await c.env.DB.prepare(
      `SELECT u.id, u.username, u.email, u.is_active, u.email_verified, u.login_count, 
              u.created_at, u.last_login, u.permissions, u.role_id,
              r.name as role_name, r.display_name as role_display_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, pageSize, (page - 1) * pageSize).all<User & { role_name?: string; role_display_name?: string }>();

    return c.json(success({
      users: (users.results || []).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        isActive: u.is_active === 1,
        emailVerified: u.email_verified === 1,
        loginCount: u.login_count,
        createdAt: u.created_at,
        lastLogin: u.last_login,
        permissions: JSON.parse(u.permissions || '[]'),
        role: u.role_name || 'user',
        roleDisplayName: u.role_display_name || '普通用户',
      })),
      total: countResult?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countResult?.total || 0) / pageSize),
    }));
  } catch (err) {
    console.error('Get users error:', err);
    return c.json(error('SERVER_ERROR', '获取用户列表失败'), 500);
  }
});

/**
 * 获取用户详情
 * GET /api/admin/users/:id
 */
adminRoutes.get('/users/:id', async (c) => {
  const userId = c.req.param('id');

  try {
    const user = await c.env.DB.prepare(
      `SELECT u.*, r.name as role_name, r.display_name as role_display_name, r.permissions as role_permissions
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`
    ).bind(userId).first<User & { role_name?: string; role_display_name?: string; role_permissions?: string }>();

    if (!user) {
      return c.json(error('NOT_FOUND', '用户不存在'), 404);
    }

    const sessions = await c.env.DB.prepare(
      'SELECT id, ip_address, user_agent, created_at, last_activity, expires_at FROM user_sessions WHERE user_id = ? ORDER BY last_activity DESC LIMIT 10'
    ).bind(userId).all();

    const favoritesCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?'
    ).bind(userId).first<{ count: number }>();

    const historyCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?'
    ).bind(userId).first<{ count: number }>();

    const recentActions = await c.env.DB.prepare(
      `SELECT action, created_at FROM user_actions 
       WHERE user_id = ? AND action IN ('login', 'login_failed', 'search', 'favorite')
       ORDER BY created_at DESC LIMIT 20`
    ).bind(userId).all();

    const loginCount = recentActions.results?.filter((a: any) => a.action === 'login').length || 0;
    const searchCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?'
    ).bind(userId).first<{ count: number }>();

    return c.json(success({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isActive: user.is_active === 1,
        emailVerified: user.email_verified === 1,
        loginCount: user.login_count,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        permissions: JSON.parse(user.permissions || '[]'),
        settings: JSON.parse(user.settings || '{}'),
        role: user.role_name || 'user',
        roleDisplayName: user.role_display_name || '普通用户',
        rolePermissions: JSON.parse(user.role_permissions || '[]'),
      },
      stats: {
        favoritesCount: favoritesCount?.count || 0,
        historyCount: historyCount?.count || 0,
        activeSessions: (sessions.results || []).length,
        totalLoginCount: loginCount,
        totalSearchCount: searchCount?.count || 0,
      },
      recentSessions: sessions.results || [],
      recentActions: recentActions.results || [],
    }));
  } catch (err) {
    console.error('Get user detail error:', err);
    return c.json(error('SERVER_ERROR', '获取用户详情失败'), 500);
  }
});

/**
 * 更新用户角色
 * PUT /api/admin/users/:id/role
 */
adminRoutes.put('/users/:id/role', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const { roleId } = body;
  const adminUser = c.get('user') as JwtPayload;

  if (!roleId) {
    return c.json(error('VALIDATION_ERROR', '请指定角色'), 400);
  }

  try {
    const role = await c.env.DB.prepare(
      'SELECT * FROM roles WHERE id = ?'
    ).bind(roleId).first<Role>();

    if (!role) {
      return c.json(error('NOT_FOUND', '角色不存在'), 404);
    }

    if (role.is_system !== 1 && adminUser.role !== 'super_admin') {
      return c.json(error('FORBIDDEN', '只有超级管理员可以分配自定义角色'), 403);
    }

    const user = await c.env.DB.prepare(
      'SELECT id, username, role_id FROM users WHERE id = ?'
    ).bind(userId).first<User>();

    if (!user) {
      return c.json(error('NOT_FOUND', '用户不存在'), 404);
    }

    if (user.role_id === 'super_admin' && adminUser.role !== 'super_admin') {
      return c.json(error('FORBIDDEN', '无法修改超级管理员角色'), 403);
    }

    await c.env.DB.prepare(
      'UPDATE users SET role_id = ?, updated_at = ? WHERE id = ?'
    ).bind(roleId, Date.now(), userId).run();

    await logUserAction(c.env, adminUser.userId, 'admin_update_user_role', {
      targetUserId: userId,
      targetUsername: user.username,
      oldRole: user.role_id,
      newRole: roleId,
    }, c);

    return c.json(success({ roleId, roleName: role.display_name }, '角色已更新'));
  } catch (err) {
    console.error('Update user role error:', err);
    return c.json(error('SERVER_ERROR', '更新角色失败'), 500);
  }
});

/**
 * 获取用户登录日志
 * GET /api/admin/users/:id/login-logs
 */
adminRoutes.get('/users/:id/login-logs', async (c) => {
  const userId = c.req.param('id');
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);

  try {
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM user_actions WHERE user_id = ? AND action IN ('login', 'login_failed')"
    ).bind(userId).first<{ total: number }>();

    const logs = await c.env.DB.prepare(
      `SELECT id, action, data, ip_address, user_agent, created_at 
       FROM user_actions 
       WHERE user_id = ? AND action IN ('login', 'login_failed')
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`
    ).bind(userId, pageSize, (page - 1) * pageSize).all();

    return c.json(success({
      logs: (logs.results || []).map(l => {
        const data = l.data ? JSON.parse(l.data) : {};
        return {
          id: l.id,
          loginTime: l.created_at,
          ipAddress: l.ip_address,
          userAgent: l.user_agent,
          loginStatus: l.action === 'login' ? 'success' : 'failed',
          loginMethod: data.method || 'password',
          failureReason: data.reason || null,
        };
      }),
      total: countResult?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countResult?.total || 0) / pageSize),
    }));
  } catch (err) {
    console.error('Get login logs error:', err);
    return c.json(error('SERVER_ERROR', '获取登录日志失败'), 500);
  }
});

/**
 * 获取活跃用户排行
 * GET /api/admin/active-users
 */
adminRoutes.get('/active-users', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const days = parseInt(c.req.query('days') || '7');

  try {
    const startTime = Date.now() - days * 24 * 60 * 60 * 1000;

    const users = await c.env.DB.prepare(`
      SELECT u.id, u.username, u.email, u.role_id, u.login_count,
             r.display_name as role_display_name,
             COUNT(DISTINCT CASE WHEN a.action = 'login' THEN a.id END) as recent_logins,
             COUNT(DISTINCT CASE WHEN a.action = 'search' THEN a.id END) as recent_searches
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_actions a ON u.id = a.user_id AND a.created_at >= ?
       WHERE u.is_active = 1
       GROUP BY u.id
       ORDER BY recent_logins DESC, u.login_count DESC
       LIMIT ?
    `).bind(startTime, limit).all();

    return c.json(success({
      users: (users.results || []).map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        roleDisplayName: u.role_display_name || '普通用户',
        totalLoginCount: u.login_count || 0,
        recentLogins: u.recent_logins || 0,
        recentSearches: u.recent_searches || 0,
      })),
    }));
  } catch (err) {
    console.error('Get active users error:', err);
    return c.json(error('SERVER_ERROR', '获取活跃用户失败'), 500);
  }
});

/**
 * 获取登录日志统计
 * GET /api/admin/login-stats
 */
adminRoutes.get('/login-stats', async (c) => {
  const days = parseInt(c.req.query('days') || '7');

  try {
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    const dailyStats = await c.env.DB.prepare(`
      SELECT 
        date(created_at / 1000, 'unixepoch') as date,
        COUNT(*) as total,
        SUM(CASE WHEN action = 'login' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN action = 'login_failed' THEN 1 ELSE 0 END) as failed,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_actions
      WHERE created_at >= ? AND action IN ('login', 'login_failed')
      GROUP BY date(created_at / 1000, 'unixepoch')
      ORDER BY date DESC
    `).bind(startTime).all();

    const topIPs = await c.env.DB.prepare(`
      SELECT ip_address, COUNT(*) as count
      FROM user_actions
      WHERE created_at >= ? AND action = 'login' AND ip_address IS NOT NULL
      GROUP BY ip_address
      ORDER BY count DESC
      LIMIT 10
    `).bind(startTime).all();

    const failedAttempts = await c.env.DB.prepare(`
      SELECT ip_address, COUNT(*) as count
      FROM user_actions
      WHERE created_at >= ? AND action = 'login_failed' AND ip_address IS NOT NULL
      GROUP BY ip_address
      ORDER BY count DESC
      LIMIT 10
    `).bind(startTime).all();

    return c.json(success({
      dailyStats: dailyStats.results || [],
      topIPs: topIPs.results || [],
      failedAttempts: failedAttempts.results || [],
    }));
  } catch (err) {
    console.error('Get login stats error:', err);
    return c.json(error('SERVER_ERROR', '获取登录统计失败'), 500);
  }
});

/**
 * 更新用户状态
 * PUT /api/admin/users/:id/status
 */
adminRoutes.put('/users/:id/status', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const { isActive, reason } = body;
  const adminUser = c.get('user') as JwtPayload;

  try {
    const user = await c.env.DB.prepare(
      'SELECT id, username, role_id FROM users WHERE id = ?'
    ).bind(userId).first<User>();

    if (!user) {
      return c.json(error('NOT_FOUND', '用户不存在'), 404);
    }

    if (user.role_id === 'super_admin' && adminUser.role !== 'super_admin') {
      return c.json(error('FORBIDDEN', '无法禁用超级管理员'), 403);
    }

    await c.env.DB.prepare(
      'UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?'
    ).bind(isActive ? 1 : 0, Date.now(), userId).run();

    if (!isActive) {
      await c.env.DB.prepare(
        'DELETE FROM user_sessions WHERE user_id = ?'
      ).bind(userId).run();
    }

    await logUserAction(c.env, adminUser.userId, 'admin_update_user_status', {
      targetUserId: userId,
      targetUsername: user.username,
      isActive,
      reason,
    }, c);

    return c.json(success(null, isActive ? '用户已启用' : '用户已禁用'));
  } catch (err) {
    console.error('Update user status error:', err);
    return c.json(error('SERVER_ERROR', '更新用户状态失败'), 500);
  }
});

/**
 * 更新用户权限
 * PUT /api/admin/users/:id/permissions
 */
adminRoutes.put('/users/:id/permissions', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const { permissions } = body;
  const adminUser = c.get('user') as JwtPayload;

  if (!Array.isArray(permissions)) {
    return c.json(error('VALIDATION_ERROR', '权限必须是数组'), 400);
  }

  try {
    const user = await c.env.DB.prepare(
      'SELECT id, username FROM users WHERE id = ?'
    ).bind(userId).first<User>();

    if (!user) {
      return c.json(error('NOT_FOUND', '用户不存在'), 404);
    }

    await c.env.DB.prepare(
      'UPDATE users SET permissions = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(permissions), Date.now(), userId).run();

    await logUserAction(c.env, adminUser.userId, 'admin_update_user_permissions', {
      targetUserId: userId,
      targetUsername: user.username,
      permissions,
    }, c);

    return c.json(success({ permissions }, '权限已更新'));
  } catch (err) {
    console.error('Update user permissions error:', err);
    return c.json(error('SERVER_ERROR', '更新权限失败'), 500);
  }
});

/**
 * 获取举报列表
 * GET /api/admin/reports
 */
adminRoutes.get('/reports', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '20'), 100);
  const status = c.req.query('status') || 'pending';

  try {
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as total FROM community_source_reports WHERE status = ?'
    ).bind(status).first<{ total: number }>();

    const reports = await c.env.DB.prepare(
      `SELECT r.*, 
              s.source_name, s.source_url_template,
              u.username as reporter_username
       FROM community_source_reports r
       LEFT JOIN community_shared_sources s ON r.shared_source_id = s.id
       LEFT JOIN users u ON r.reporter_user_id = u.id
       WHERE r.status = ?
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(status, pageSize, (page - 1) * pageSize).all();

    return c.json(success({
      reports: reports.results || [],
      total: countResult?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countResult?.total || 0) / pageSize),
    }));
  } catch (err) {
    console.error('Get reports error:', err);
    return c.json(error('SERVER_ERROR', '获取举报列表失败'), 500);
  }
});

/**
 * 处理举报
 * PUT /api/admin/reports/:id
 */
adminRoutes.put('/reports/:id', async (c) => {
  const reportId = c.req.param('id');
  const body = await c.req.json();
  const { status, action, notes } = body;
  const adminUser = c.get('user') as JwtPayload;

  if (!['resolved', 'dismissed'].includes(status)) {
    return c.json(error('VALIDATION_ERROR', '无效的状态'), 400);
  }

  try {
    const report = await c.env.DB.prepare(
      'SELECT * FROM community_source_reports WHERE id = ?'
    ).bind(reportId).first<CommunitySourceReport>();

    if (!report) {
      return c.json(error('NOT_FOUND', '举报不存在'), 404);
    }

    const now = Date.now();

    await c.env.DB.prepare(`
      UPDATE community_source_reports 
      SET status = ?, admin_user_id = ?, admin_action = ?, admin_notes = ?, resolved_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(status, adminUser.userId, action || null, notes || null, now, now, reportId).run();

    if (status === 'resolved' && action === 'remove_source') {
      await c.env.DB.prepare(
        "UPDATE community_shared_sources SET status = 'removed', updated_at = ? WHERE id = ?"
      ).bind(now, report.shared_source_id).run();
    }

    await logUserAction(c.env, adminUser.userId, 'admin_handle_report', {
      reportId,
      status,
      action,
      notes,
    }, c);

    return c.json(success(null, '举报已处理'));
  } catch (err) {
    console.error('Handle report error:', err);
    return c.json(error('SERVER_ERROR', '处理举报失败'), 500);
  }
});

/**
 * 获取系统统计
 * GET /api/admin/stats
 */
adminRoutes.get('/stats', async (c) => {
  try {
    const userStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END) as new_this_week
      FROM users
    `).bind(Date.now() - 7 * 24 * 60 * 60 * 1000).first();

    const roleStats = await c.env.DB.prepare(`
      SELECT r.id, r.name, r.display_name, COUNT(u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id
      GROUP BY r.id
      ORDER BY r.priority DESC
    `).all();

    const sourceStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN searchable = 1 THEN 1 ELSE 0 END) as searchable,
        SUM(usage_count) as total_usage
      FROM search_sources
    `).first();

    const searchStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT query) as unique_keywords
      FROM user_search_history
    `).first();

    const communityStats = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM community_shared_sources) as shared_sources,
        (SELECT COUNT(*) FROM community_source_tags) as tags,
        (SELECT COUNT(*) FROM community_source_reviews) as reviews,
        (SELECT COUNT(*) FROM community_source_reports WHERE status = 'pending') as pending_reports
    `).first();

    const dailyActiveUsers = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count
      FROM user_sessions
      WHERE last_activity > ?
    `).bind(Date.now() - 24 * 60 * 60 * 1000).first<{ count: number }>();

    const topSearchKeywords = await c.env.DB.prepare(`
      SELECT query, COUNT(*) as count
      FROM user_search_history
      WHERE created_at > ?
      GROUP BY query
      ORDER BY count DESC
      LIMIT 10
    `).bind(Date.now() - 7 * 24 * 60 * 60 * 1000).all();

    const topUsedSources = await c.env.DB.prepare(`
      SELECT name, usage_count
      FROM search_sources
      WHERE is_active = 1
      ORDER BY usage_count DESC
      LIMIT 10
    `).all();

    return c.json(success({
      users: {
        total: userStats?.total || 0,
        active: userStats?.active || 0,
        verified: userStats?.verified || 0,
        newThisWeek: userStats?.new_this_week || 0,
        dailyActive: dailyActiveUsers?.count || 0,
      },
      roles: (roleStats.results || []).map(r => ({
        id: r.id,
        name: r.name,
        displayName: r.display_name,
        userCount: r.user_count || 0,
      })),
      sources: {
        total: sourceStats?.total || 0,
        active: sourceStats?.active || 0,
        searchable: sourceStats?.searchable || 0,
        totalUsage: sourceStats?.total_usage || 0,
      },
      searches: {
        total: searchStats?.total || 0,
        uniqueUsers: searchStats?.unique_users || 0,
        uniqueKeywords: searchStats?.unique_keywords || 0,
      },
      community: {
        sharedSources: communityStats?.shared_sources || 0,
        tags: communityStats?.tags || 0,
        reviews: communityStats?.reviews || 0,
        pendingReports: communityStats?.pending_reports || 0,
      },
      topSearchKeywords: topSearchKeywords.results || [],
      topUsedSources: topUsedSources.results || [],
    }));
  } catch (err) {
    console.error('Get admin stats error:', err);
    return c.json(error('SERVER_ERROR', '获取统计失败'), 500);
  }
});

/**
 * 获取行为日志
 * GET /api/admin/logs
 */
adminRoutes.get('/logs', async (c) => {
  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 200);
  const userId = c.req.query('userId');
  const action = c.req.query('action');

  try {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM user_actions ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const logs = await c.env.DB.prepare(`
      SELECT a.*, u.username
      FROM user_actions a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, (page - 1) * pageSize).all<UserAction & { username: string | null }>();

    return c.json(success({
      logs: logs.results || [],
      total: countResult?.total || 0,
      page,
      pageSize,
      totalPages: Math.ceil((countResult?.total || 0) / pageSize),
    }));
  } catch (err) {
    console.error('Get logs error:', err);
    return c.json(error('SERVER_ERROR', '获取日志失败'), 500);
  }
});

/**
 * 清理过期数据
 * POST /api/admin/cleanup
 */
adminRoutes.post('/cleanup', async (c) => {
  const adminUser = c.get('user') as JwtPayload;

  try {
    const now = Date.now();
    const results = {
      expiredSessions: 0,
      expiredVerifications: 0,
      oldPasswordResetLogs: 0,
      oldSecurityLockouts: 0,
      oldActions: 0,
    };

    const expiredSessions = await c.env.DB.prepare(
      'DELETE FROM user_sessions WHERE expires_at < ?'
    ).bind(now).run();
    results.expiredSessions = expiredSessions.meta.changes || 0;

    const expiredVerifications = await c.env.DB.prepare(
      "DELETE FROM email_verifications WHERE expires_at < ? AND status NOT IN ('used', 'expired')"
    ).bind(now).run();
    results.expiredVerifications = expiredVerifications.meta.changes || 0;

    const oldPasswordResetLogs = await c.env.DB.prepare(
      'DELETE FROM password_reset_logs WHERE created_at < ?'
    ).bind(now - 30 * 24 * 60 * 60 * 1000).run();
    results.oldPasswordResetLogs = oldPasswordResetLogs.meta.changes || 0;

    const oldSecurityLockouts = await c.env.DB.prepare(
      'DELETE FROM security_lockouts WHERE locked_until < ?'
    ).bind(now).run();
    results.oldSecurityLockouts = oldSecurityLockouts.meta.changes || 0;

    const oldActions = await c.env.DB.prepare(
      'DELETE FROM user_actions WHERE created_at < ?'
    ).bind(now - 90 * 24 * 60 * 60 * 1000).run();
    results.oldActions = oldActions.meta.changes || 0;

    await logUserAction(c.env, adminUser.userId, 'admin_cleanup', results, c);

    return c.json(success(results, '数据清理完成'));
  } catch (err) {
    console.error('Cleanup error:', err);
    return c.json(error('SERVER_ERROR', '清理失败'), 500);
  }
});
