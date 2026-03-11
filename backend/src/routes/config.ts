/**
 * 系统配置与分析模块
 * 功能：系统配置管理、分析事件记录、缓存管理
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Hono } from 'hono';
import { Env, SystemConfig, SearchCache, EmailSendLog } from '../types';
import { success, error, generateId } from '../utils';

export const configRoutes = new Hono<{ Bindings: Env }>();

/**
 * 获取公开配置
 * GET /api/config/public
 */
configRoutes.get('/public', async (c) => {
  try {
    const configs = await c.env.DB.prepare(
      `SELECT key, value FROM system_config WHERE is_public = 1`
    ).all<SystemConfig>();

    const result: Record<string, string> = {};
    for (const config of configs.results || []) {
      result[config.key] = config.value;
    }

    return c.json(success(result));
  } catch (err) {
    console.error('Get public config error:', err);
    return c.json(success({}));
  }
});

/**
 * 获取所有配置（管理员）
 * GET /api/config/all
 */
configRoutes.get('/all', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const configs = await c.env.DB.prepare(
      'SELECT * FROM system_config ORDER BY key'
    ).all<SystemConfig>();

    return c.json(success(configs.results || []));
  } catch (err) {
    console.error('Get all config error:', err);
    return c.json(error('SERVER_ERROR', '获取配置失败'), 500);
  }
});

/**
 * 更新配置（管理员）
 * PUT /api/config/:key
 */
configRoutes.put('/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const key = c.req.param('key');
  const body = await c.req.json();
  const { value, description, configType, isPublic } = body;

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM system_config WHERE key = ?'
    ).bind(key).first<SystemConfig>();

    const now = Date.now();

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE system_config 
        SET value = ?, description = COALESCE(?, description), 
            config_type = COALESCE(?, config_type), is_public = COALESCE(?, is_public),
            updated_at = ?
        WHERE key = ?
      `).bind(value, description, configType, isPublic, now, key).run();
    } else {
      await c.env.DB.prepare(`
        INSERT INTO system_config (key, value, description, config_type, is_public, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(key, value, description || null, configType || 'string', isPublic ? 1 : 0, now, now).run();
    }

    return c.json(success({ key, value }, '配置已更新'));
  } catch (err) {
    console.error('Update config error:', err);
    return c.json(error('SERVER_ERROR', '更新配置失败'), 500);
  }
});

/**
 * 删除配置（管理员）
 * DELETE /api/config/:key
 */
configRoutes.delete('/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const key = c.req.param('key');

  try {
    await c.env.DB.prepare('DELETE FROM system_config WHERE key = ?').bind(key).run();
    return c.json(success(null, '配置已删除'));
  } catch (err) {
    console.error('Delete config error:', err);
    return c.json(error('SERVER_ERROR', '删除配置失败'), 500);
  }
});

/**
 * 批量更新配置（管理员）
 * PUT /api/config/batch
 */
configRoutes.put('/batch', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const body = await c.req.json();
    const { configs } = body;

    if (!Array.isArray(configs)) {
      return c.json(error('VALIDATION_ERROR', '配置数据格式错误'), 400);
    }

    const now = Date.now();
    const results: { key: string; success: boolean }[] = [];

    for (const config of configs) {
      const { key, value, description, configType, isPublic } = config;

      if (!key) continue;

      try {
        const existing = await c.env.DB.prepare(
          'SELECT * FROM system_config WHERE key = ?'
        ).bind(key).first<SystemConfig>();

        if (existing) {
          await c.env.DB.prepare(`
            UPDATE system_config 
            SET value = ?, description = COALESCE(?, description), 
                config_type = COALESCE(?, config_type), is_public = COALESCE(?, is_public),
                updated_at = ?
            WHERE key = ?
          `).bind(value, description, configType, isPublic, now, key).run();
        } else {
          await c.env.DB.prepare(`
            INSERT INTO system_config (key, value, description, config_type, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(key, value, description || null, configType || 'string', isPublic ? 1 : 0, now, now).run();
        }

        results.push({ key, success: true });
      } catch (err) {
        results.push({ key, success: false });
      }
    }

    return c.json(success({ results, updated: results.filter(r => r.success).length }, '配置批量更新完成'));
  } catch (err) {
    console.error('Batch update config error:', err);
    return c.json(error('SERVER_ERROR', '批量更新配置失败'), 500);
  }
});

/**
 * 获取配置分组（管理员）
 * GET /api/config/groups
 */
configRoutes.get('/groups', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const configs = await c.env.DB.prepare(
      'SELECT * FROM system_config ORDER BY key'
    ).all<SystemConfig>();

    const groups: Record<string, SystemConfig[]> = {
      '基础配置': [],
      '用户限制': [],
      '搜索源检查': [],
      '社区功能': [],
      '邮箱验证': [],
      '忘记密码': [],
      '安全相关': [],
      '邮件模板': [],
      '安全监控': [],
      '其他': [],
    };

    const groupMapping: Record<string, string> = {
      'site_name': '基础配置',
      'enable_registration': '基础配置',
      'max_search_history': '用户限制',
      'max_favorites': '用户限制',
      'min_username_length': '用户限制',
      'max_username_length': '用户限制',
      'min_password_length': '用户限制',
      'source_check_enabled': '搜索源检查',
      'max_concurrent_checks': '搜索源检查',
      'default_check_timeout': '搜索源检查',
      'cache_duration_ms': '搜索源检查',
      'max_cache_entries': '搜索源检查',
      'health_update_interval': '搜索源检查',
      'community_enabled': '社区功能',
      'community_require_approval': '社区功能',
      'community_max_shares_per_user': '社区功能',
      'community_min_rating_to_feature': '社区功能',
      'email_verification_enabled': '邮箱验证',
      'email_verification_required': '邮箱验证',
      'verification_code_length': '邮箱验证',
      'verification_code_expiry': '邮箱验证',
      'max_verification_attempts': '邮箱验证',
      'email_rate_limit_per_hour': '邮箱验证',
      'email_rate_limit_per_day': '邮箱验证',
      'resend_api_key_set': '邮箱验证',
      'default_from_email': '邮箱验证',
      'default_from_name': '邮箱验证',
      'forgot_password_enabled': '忘记密码',
      'forgot_password_rate_limit_per_hour': '忘记密码',
      'forgot_password_rate_limit_per_day': '忘记密码',
      'reset_password_require_verification': '忘记密码',
      'reset_password_code_expiry': '忘记密码',
      'password_reset_max_attempts': '安全相关',
      'password_reset_lockout_duration': '安全相关',
      'force_logout_after_password_reset': '安全相关',
      'forgot_password_email_subject': '邮件模板',
      'forgot_password_success_message': '邮件模板',
      'security_monitoring_enabled': '安全监控',
      'security_event_retention_days': '安全监控',
      'high_risk_threshold': '安全监控',
      'detect_unusual_login_location': '安全监控',
      'detect_unusual_login_time': '安全监控',
      'detect_multiple_failed_logins': '安全监控',
      'notify_admin_on_suspicious_activity': '安全监控',
      'notify_user_on_password_reset': '安全监控',
    };

    for (const config of configs.results || []) {
      const group = groupMapping[config.key] || '其他';
      if (groups[group]) {
        groups[group].push(config);
      } else {
        groups['其他'].push(config);
      }
    }

    return c.json(success(groups));
  } catch (err) {
    console.error('Get config groups error:', err);
    return c.json(error('SERVER_ERROR', '获取配置分组失败'), 500);
  }
});

/**
 * 重置配置为默认值（管理员）
 * POST /api/config/reset/:key
 */
configRoutes.post('/reset/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'super_admin') {
    return c.json(error('FORBIDDEN', '需要超级管理员权限'), 403);
  }

  const key = c.req.param('key');

  const defaultValues: Record<string, { value: string; description: string; configType: string; isPublic: number }> = {
    'site_name': { value: '磁力快搜', description: '网站名称', configType: 'string', isPublic: 1 },
    'enable_registration': { value: '1', description: '是否开放注册', configType: 'boolean', isPublic: 1 },
    'max_search_history': { value: '1000', description: '最大搜索历史记录数', configType: 'integer', isPublic: 1 },
    'max_favorites': { value: '1000', description: '最大收藏数量', configType: 'integer', isPublic: 1 },
    'min_username_length': { value: '3', description: '用户名最小长度', configType: 'integer', isPublic: 1 },
    'max_username_length': { value: '20', description: '用户名最大长度', configType: 'integer', isPublic: 1 },
    'min_password_length': { value: '6', description: '密码最小长度', configType: 'integer', isPublic: 1 },
    'source_check_enabled': { value: '1', description: '启用搜索源状态检查', configType: 'boolean', isPublic: 1 },
    'max_concurrent_checks': { value: '3', description: '最大并发检查数', configType: 'integer', isPublic: 1 },
    'default_check_timeout': { value: '10000', description: '默认检查超时时间（毫秒）', configType: 'integer', isPublic: 1 },
    'cache_duration_ms': { value: '300000', description: '状态缓存时间（毫秒）', configType: 'integer', isPublic: 1 },
    'max_cache_entries': { value: '10000', description: '最大缓存条目数', configType: 'integer', isPublic: 1 },
    'health_update_interval': { value: '3600000', description: '健康度统计更新间隔（毫秒）', configType: 'integer', isPublic: 1 },
    'community_enabled': { value: '1', description: '启用搜索源共享社区功能', configType: 'boolean', isPublic: 1 },
    'community_require_approval': { value: '0', description: '新分享的搜索源需要审核', configType: 'boolean', isPublic: 0 },
    'community_max_shares_per_user': { value: '50', description: '每个用户最大分享数量', configType: 'integer', isPublic: 1 },
    'community_min_rating_to_feature': { value: '4.0', description: '推荐搜索源的最低评分', configType: 'float', isPublic: 1 },
    'email_verification_enabled': { value: '1', description: '是否启用邮箱验证功能', configType: 'boolean', isPublic: 1 },
    'email_verification_required': { value: '0', description: '注册时是否强制邮箱验证', configType: 'boolean', isPublic: 1 },
    'verification_code_length': { value: '6', description: '验证码长度', configType: 'integer', isPublic: 0 },
    'verification_code_expiry': { value: '900000', description: '验证码过期时间（毫秒，默认15分钟）', configType: 'integer', isPublic: 0 },
    'max_verification_attempts': { value: '3', description: '最大验证尝试次数', configType: 'integer', isPublic: 0 },
    'email_rate_limit_per_hour': { value: '5', description: '每小时最大发送邮件数', configType: 'integer', isPublic: 0 },
    'email_rate_limit_per_day': { value: '20', description: '每天最大发送邮件数', configType: 'integer', isPublic: 0 },
    'forgot_password_enabled': { value: '1', description: '是否启用忘记密码功能', configType: 'boolean', isPublic: 1 },
    'forgot_password_rate_limit_per_hour': { value: '3', description: '忘记密码每小时最大请求次数', configType: 'integer', isPublic: 1 },
    'forgot_password_rate_limit_per_day': { value: '10', description: '忘记密码每天最大请求次数', configType: 'integer', isPublic: 1 },
    'reset_password_require_verification': { value: '1', description: '重置密码是否需要邮箱验证', configType: 'boolean', isPublic: 1 },
    'reset_password_code_expiry': { value: '1800000', description: '重置密码验证码过期时间（毫秒，默认30分钟）', configType: 'integer', isPublic: 1 },
    'password_reset_max_attempts': { value: '5', description: '密码重置最大尝试次数', configType: 'integer', isPublic: 1 },
    'password_reset_lockout_duration': { value: '3600000', description: '密码重置锁定持续时间（毫秒，默认1小时）', configType: 'integer', isPublic: 1 },
    'force_logout_after_password_reset': { value: '1', description: '密码重置后是否强制退出所有设备', configType: 'boolean', isPublic: 1 },
    'security_monitoring_enabled': { value: '1', description: '是否启用安全事件监控', configType: 'boolean', isPublic: 0 },
    'security_event_retention_days': { value: '90', description: '安全事件保留天数', configType: 'integer', isPublic: 0 },
    'high_risk_threshold': { value: '70', description: '高风险事件阈值', configType: 'integer', isPublic: 0 },
    'detect_unusual_login_location': { value: '1', description: '检测异常登录地点', configType: 'boolean', isPublic: 0 },
    'detect_unusual_login_time': { value: '1', description: '检测异常登录时间', configType: 'boolean', isPublic: 0 },
    'detect_multiple_failed_logins': { value: '1', description: '检测多次登录失败', configType: 'boolean', isPublic: 0 },
    'notify_admin_on_suspicious_activity': { value: '1', description: '可疑活动时通知管理员', configType: 'boolean', isPublic: 0 },
    'notify_user_on_password_reset': { value: '1', description: '密码重置时通知用户', configType: 'boolean', isPublic: 0 },
  };

  const defaultValue = defaultValues[key];
  if (!defaultValue) {
    return c.json(error('NOT_FOUND', '未找到该配置的默认值'), 404);
  }

  try {
    const now = Date.now();
    await c.env.DB.prepare(`
      UPDATE system_config 
      SET value = ?, updated_at = ?
      WHERE key = ?
    `).bind(defaultValue.value, now, key).run();

    return c.json(success({ key, value: defaultValue.value }, '配置已重置为默认值'));
  } catch (err) {
    console.error('Reset config error:', err);
    return c.json(error('SERVER_ERROR', '重置配置失败'), 500);
  }
});

/**
 * 记录分析事件
 * POST /api/analytics/events
 */
configRoutes.post('/analytics/events', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, sessionId, eventType, eventData, referer } = body;

    const id = generateId();
    await c.env.DB.prepare(`
      INSERT INTO analytics_events (
        id, user_id, session_id, event_type, event_data, ip_address, user_agent, referer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId || null,
      sessionId || null,
      eventType,
      JSON.stringify(eventData || {}),
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
      c.req.header('User-Agent') || null,
      referer || c.req.header('Referer') || null,
      Date.now()
    ).run();

    return c.json(success({ id }, '事件已记录'));
  } catch (err) {
    console.error('Record analytics event error:', err);
    return c.json(error('SERVER_ERROR', '记录事件失败'), 500);
  }
});

/**
 * 获取分析事件统计
 * GET /api/analytics/stats
 */
configRoutes.get('/analytics/stats', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const days = parseInt(c.req.query('days') || '7');
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    const totalEvents = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics_events WHERE created_at > ?'
    ).bind(since).first<{ count: number }>();

    const eventsByType = await c.env.DB.prepare(`
      SELECT event_type, COUNT(*) as count 
      FROM analytics_events 
      WHERE created_at > ? 
      GROUP BY event_type 
      ORDER BY count DESC
    `).bind(since).all();

    const dailyEvents = await c.env.DB.prepare(`
      SELECT date(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
      FROM analytics_events
      WHERE created_at > ?
      GROUP BY date
      ORDER BY date
    `).bind(since).all();

    const uniqueUsers = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM analytics_events 
      WHERE created_at > ? AND user_id IS NOT NULL
    `).bind(since).first<{ count: number }>();

    const uniqueSessions = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count 
      FROM analytics_events 
      WHERE created_at > ? AND session_id IS NOT NULL
    `).bind(since).first<{ count: number }>();

    return c.json(success({
      totalEvents: totalEvents?.count || 0,
      uniqueUsers: uniqueUsers?.count || 0,
      uniqueSessions: uniqueSessions?.count || 0,
      eventsByType: eventsByType.results || [],
      dailyEvents: dailyEvents.results || [],
      period: { days, since },
    }));
  } catch (err) {
    console.error('Get analytics stats error:', err);
    return c.json(error('SERVER_ERROR', '获取统计失败'), 500);
  }
});

/**
 * 获取搜索缓存
 * GET /api/cache/search
 */
configRoutes.get('/cache/search', async (c) => {
  const keyword = c.req.query('keyword');
  if (!keyword) {
    return c.json(success(null));
  }

  try {
    const cache = await c.env.DB.prepare(
      'SELECT * FROM search_cache WHERE keyword = ? AND expires_at > ?'
    ).bind(keyword.trim(), Date.now()).first<SearchCache>();

    if (cache) {
      await c.env.DB.prepare(
        'UPDATE search_cache SET access_count = access_count + 1, last_accessed = ? WHERE id = ?'
      ).bind(Date.now(), cache.id).run();

      return c.json(success({
        keyword: cache.keyword,
        results: JSON.parse(cache.results),
        cachedAt: cache.created_at,
      }));
    }

    return c.json(success(null));
  } catch (err) {
    console.error('Get search cache error:', err);
    return c.json(success(null));
  }
});

/**
 * 设置搜索缓存
 * POST /api/cache/search
 */
configRoutes.post('/cache/search', async (c) => {
  try {
    const body = await c.req.json();
    const { keyword, results, ttlMinutes = 60 } = body;

    if (!keyword || !results) {
      return c.json(error('VALIDATION_ERROR', '参数不完整'), 400);
    }

    const now = Date.now();
    const expiresAt = now + ttlMinutes * 60 * 1000;

    const existing = await c.env.DB.prepare(
      'SELECT id FROM search_cache WHERE keyword = ?'
    ).bind(keyword.trim()).first();

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE search_cache 
        SET results = ?, expires_at = ?, created_at = ?, access_count = 0, last_accessed = ?
        WHERE keyword = ?
      `).bind(JSON.stringify(results), expiresAt, now, now, keyword.trim()).run();
    } else {
      const id = generateId();
      const keywordHash = await hashKeyword(keyword.trim());

      await c.env.DB.prepare(`
        INSERT INTO search_cache (id, keyword, keyword_hash, results, expires_at, created_at, access_count, last_accessed)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `).bind(id, keyword.trim(), keywordHash, JSON.stringify(results), expiresAt, now, now).run();
    }

    return c.json(success({ cached: true, expiresAt }));
  } catch (err) {
    console.error('Set search cache error:', err);
    return c.json(error('SERVER_ERROR', '缓存失败'), 500);
  }
});

/**
 * 清理过期缓存
 * POST /api/cache/cleanup
 */
configRoutes.post('/cache/cleanup', async (c) => {
  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM search_cache WHERE expires_at < ?'
    ).bind(Date.now()).run();

    return c.json(success({
      deletedCount: result.meta.changes || 0,
    }, '缓存清理完成'));
  } catch (err) {
    console.error('Cleanup cache error:', err);
    return c.json(error('SERVER_ERROR', '清理失败'), 500);
  }
});

/**
 * 获取邮件发送日志
 * GET /api/email/logs
 */
configRoutes.get('/email/logs', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const { verifyToken } = await import('../utils');
  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 200);
  const emailType = c.req.query('type');
  const status = c.req.query('status');

  try {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (emailType) {
      whereClause += ' AND email_type = ?';
      params.push(emailType);
    }

    if (status) {
      whereClause += ' AND send_status = ?';
      params.push(status);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM email_send_logs ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const logs = await c.env.DB.prepare(`
      SELECT l.*, u.username
      FROM email_send_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, (page - 1) * pageSize).all<EmailSendLog & { username: string | null }>();

    return c.json(success({
      logs: logs.results || [],
      total: countResult?.total || 0,
      page,
      pageSize,
    }));
  } catch (err) {
    console.error('Get email logs error:', err);
    return c.json(error('SERVER_ERROR', '获取日志失败'), 500);
  }
});

async function hashKeyword(keyword: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(keyword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}
