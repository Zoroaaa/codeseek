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
