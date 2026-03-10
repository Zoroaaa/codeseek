import { Hono } from 'hono';
import { Env, SourceStatusCache, UserAction, SearchSource } from '../types';
import { success, error, generateId } from '../utils';

export const systemRoutes = new Hono<{ Bindings: Env }>();

systemRoutes.get('/public-config', async (c) => {
  try {
    return c.json(success({
      appVersion: c.env.APP_VERSION || '1.0.0',
      allowRegistration: c.env.ALLOW_REGISTRATION === 'true',
      minUsernameLength: parseInt(c.env.MIN_USERNAME_LENGTH || '3', 10),
      maxUsernameLength: parseInt(c.env.MAX_USERNAME_LENGTH || '20', 10),
      minPasswordLength: parseInt(c.env.MIN_PASSWORD_LENGTH || '6', 10),
      maxFavoritesPerUser: parseInt(c.env.MAX_FAVORITES_PER_USER || '1000', 10),
      maxHistoryPerUser: parseInt(c.env.MAX_HISTORY_PER_USER || '1000', 10),
      maxTagsPerUser: parseInt(c.env.MAX_TAGS_PER_USER || '50', 10),
      enableActionLogging: c.env.ENABLE_ACTION_LOGGING === 'true',
    }));
  } catch (err) {
    console.error('Get public config error:', err);
    return c.json(error('SERVER_ERROR', '获取配置失败'), 500);
  }
});

systemRoutes.get('/source-status-check', async (c) => {
  const sourceId = c.req.query('sourceId');
  const keyword = c.req.query('keyword') || 'test';

  if (!sourceId) {
    return c.json(error('VALIDATION_ERROR', '请提供搜索源ID'), 400);
  }

  try {
    const cached = await c.env.DB.prepare(`
      SELECT * FROM source_status_cache 
      WHERE source_id = ? AND keyword = ? AND created_at > ?
    `).bind(sourceId, keyword, Date.now() - 5 * 60 * 1000).first<SourceStatusCache>();

    if (cached) {
      return c.json(success({
        status: cached.status,
        available: cached.available === 1,
        contentMatch: cached.content_match === 1,
        responseTime: cached.response_time,
        qualityScore: cached.quality_score,
        error: cached.check_error,
        cached: true,
      }));
    }

    const source = await c.env.DB.prepare(
      'SELECT * FROM search_sources WHERE id = ?'
    ).bind(sourceId).first<SearchSource>();

    if (!source) {
      return c.json(error('NOT_FOUND', '搜索源不存在'), 404);
    }

    const url = source.url_template.replace('{keyword}', encodeURIComponent(keyword));
    const startTime = Date.now();
    
    let status = 'unknown';
    let available = false;
    let contentMatch = false;
    let responseTime = 0;
    let checkError = null;

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      
      responseTime = Date.now() - startTime;
      available = response.ok;
      status = available ? 'online' : 'error';
      contentMatch = response.ok;
    } catch (fetchError) {
      responseTime = Date.now() - startTime;
      status = 'offline';
      checkError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    }

    const qualityScore = available && contentMatch ? 100 : (available ? 50 : 0);

    const cacheId = generateId();
    await c.env.DB.prepare(`
      INSERT INTO source_status_cache (id, source_id, keyword, status, available, content_match, response_time, quality_score, check_error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      cacheId,
      sourceId,
      keyword,
      status,
      available ? 1 : 0,
      contentMatch ? 1 : 0,
      responseTime,
      qualityScore,
      checkError,
      Date.now()
    ).run();

    return c.json(success({
      status,
      available,
      contentMatch,
      responseTime,
      qualityScore,
      error: checkError,
      cached: false,
    }));
  } catch (err) {
    console.error('Source status check error:', err);
    return c.json(error('SERVER_ERROR', '状态检查失败'), 500);
  }
});

systemRoutes.post('/record-action', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, action, data } = body;

    if (!action) {
      return c.json(error('VALIDATION_ERROR', '请提供行为类型'), 400);
    }

    const actionId = generateId();
    const ip = c.req.header('x-forwarded-for') || 
               c.req.header('x-real-ip') || 
               c.req.header('CF-Connecting-IP') ||
               null;
    const userAgent = c.req.header('User-Agent') || null;

    await c.env.DB.prepare(`
      INSERT INTO user_actions (id, user_id, action, data, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      actionId,
      userId || null,
      action,
      JSON.stringify(data || {}),
      ip,
      userAgent,
      Date.now()
    ).run();

    return c.json(success({ id: actionId }, '行为已记录'));
  } catch (err) {
    console.error('Record action error:', err);
    return c.json(error('SERVER_ERROR', '记录失败'), 500);
  }
});

systemRoutes.get('/stats', async (c) => {
  try {
    const userCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
    ).first<{ count: number }>();

    const sourceCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM search_sources WHERE is_active = 1'
    ).first<{ count: number }>();

    const searchCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history'
    ).first<{ count: number }>();

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

    const thisWeekActiveUsers = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_search_history WHERE created_at >= ?'
    ).bind(oneWeekAgo).first<{ count: number }>();

    const lastWeekActiveUsers = await c.env.DB.prepare(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_search_history WHERE created_at >= ? AND created_at < ?'
    ).bind(twoWeeksAgo, oneWeekAgo).first<{ count: number }>();

    const thisWeekActive = thisWeekActiveUsers?.count || 0;
    const lastWeekActive = lastWeekActiveUsers?.count || 0;
    let activeUsersGrowthPercent = 0;
    if (lastWeekActive > 0) {
      activeUsersGrowthPercent = Math.round(((thisWeekActive - lastWeekActive) / lastWeekActive) * 100);
    } else if (thisWeekActive > 0) {
      activeUsersGrowthPercent = 100;
    }

    return c.json(success({
      users: userCount?.count || 0,
      sources: sourceCount?.count || 0,
      searches: searchCount?.count || 0,
      activeUsers: thisWeekActive,
      activeUsersGrowthPercent,
    }));
  } catch (err) {
    console.error('Get stats error:', err);
    return c.json(error('SERVER_ERROR', '获取统计失败'), 500);
  }
});

systemRoutes.get('/health', async (c) => {
  return c.json(success({
    status: 'ok',
    timestamp: Date.now(),
    version: c.env.APP_VERSION || '1.0.0',
  }));
});

systemRoutes.get('/source-status-history/:sourceId', async (c) => {
  const sourceId = c.req.param('sourceId');
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const hours = parseInt(c.req.query('hours') || '24', 10);

  try {
    const history = await c.env.DB.prepare(`
      SELECT * FROM source_status_cache 
      WHERE source_id = ? AND created_at > ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(sourceId, Date.now() - hours * 60 * 60 * 1000, limit).all<SourceStatusCache>();

    const source = await c.env.DB.prepare(
      'SELECT id, name, url_template FROM search_sources WHERE id = ?'
    ).bind(sourceId).first();

    if (!source) {
      return c.json(error('NOT_FOUND', '搜索源不存在'), 404);
    }

    const results = history.results || [];
    const availableCount = results.filter(r => r.available === 1).length;
    const avgResponseTime = results.length > 0 
      ? Math.round(results.reduce((sum, r) => sum + (r.response_time || 0), 0) / results.length)
      : 0;

    return c.json(success({
      source,
      history: results,
      summary: {
        totalChecks: results.length,
        availableCount,
        unavailableCount: results.length - availableCount,
        availabilityRate: results.length > 0 ? Math.round((availableCount / results.length) * 100) : 0,
        avgResponseTime,
      },
    }));
  } catch (err) {
    console.error('Get source status history error:', err);
    return c.json(error('SERVER_ERROR', '获取状态历史失败'), 500);
  }
});

systemRoutes.get('/source-status-batch', async (c) => {
  const sourceIds = c.req.query('sourceIds');

  if (!sourceIds) {
    return c.json(error('VALIDATION_ERROR', '请提供搜索源ID列表'), 400);
  }

  const ids = sourceIds.split(',').filter(Boolean);

  if (ids.length === 0) {
    return c.json(error('VALIDATION_ERROR', '搜索源ID列表为空'), 400);
  }

  if (ids.length > 50) {
    return c.json(error('VALIDATION_ERROR', '最多同时检查50个搜索源'), 400);
  }

  try {
    const results: Array<{
      sourceId: string;
      status: string;
      available: boolean;
      responseTime: number;
      cached: boolean;
      error?: string;
    }> = [];

    for (const sourceId of ids) {
      const cached = await c.env.DB.prepare(`
        SELECT * FROM source_status_cache 
        WHERE source_id = ? AND created_at > ?
        ORDER BY created_at DESC LIMIT 1
      `).bind(sourceId, Date.now() - 5 * 60 * 1000).first<SourceStatusCache>();

      if (cached) {
        results.push({
          sourceId,
          status: cached.status,
          available: cached.available === 1,
          responseTime: cached.response_time,
          cached: true,
          error: cached.check_error || undefined,
        });
        continue;
      }

      const source = await c.env.DB.prepare(
        'SELECT * FROM search_sources WHERE id = ?'
      ).bind(sourceId).first<SearchSource>();

      if (!source) {
        results.push({
          sourceId,
          status: 'not_found',
          available: false,
          responseTime: 0,
          cached: false,
          error: '搜索源不存在',
        });
        continue;
      }

      const url = source.url_template.replace('{keyword}', 'test');
      const startTime = Date.now();

      let status = 'unknown';
      let available = false;
      let responseTime = 0;
      let checkError = null;

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });

        responseTime = Date.now() - startTime;
        available = response.ok;
        status = available ? 'online' : 'error';
      } catch (fetchError) {
        responseTime = Date.now() - startTime;
        status = 'offline';
        checkError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      }

      const cacheId = generateId();
      await c.env.DB.prepare(`
        INSERT INTO source_status_cache (id, source_id, keyword, status, available, content_match, response_time, quality_score, check_error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        cacheId,
        sourceId,
        'test',
        status,
        available ? 1 : 0,
        available ? 1 : 0,
        responseTime,
        available ? 100 : 0,
        checkError,
        Date.now()
      ).run();

      results.push({
        sourceId,
        status,
        available,
        responseTime,
        cached: false,
        error: checkError || undefined,
      });
    }

    return c.json(success({ results }));
  } catch (err) {
    console.error('Batch status check error:', err);
    return c.json(error('SERVER_ERROR', '批量检查失败'), 500);
  }
});

systemRoutes.delete('/source-status-cache/:sourceId', async (c) => {
  const sourceId = c.req.param('sourceId');

  try {
    await c.env.DB.prepare(
      'DELETE FROM source_status_cache WHERE source_id = ?'
    ).bind(sourceId).run();

    return c.json(success(null, '缓存已清除'));
  } catch (err) {
    console.error('Clear status cache error:', err);
    return c.json(error('SERVER_ERROR', '清除缓存失败'), 500);
  }
});

systemRoutes.get('/user-actions', async (c) => {
  const userId = c.req.query('userId');
  const action = c.req.query('action');
  const limit = parseInt(c.req.query('limit') || '100', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);

  let query = 'SELECT * FROM user_actions WHERE 1=1';
  const params: (string | number)[] = [];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  if (action) {
    query += ' AND action = ?';
    params.push(action);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  try {
    const actions = await c.env.DB.prepare(query).bind(...params).all<UserAction>();

    let countQuery = 'SELECT COUNT(*) as count FROM user_actions WHERE 1=1';
    const countParams: string[] = [];

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }

    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ count: number }>();

    return c.json(success({
      actions: actions.results || [],
      total: countResult?.count || 0,
      limit,
      offset,
    }));
  } catch (err) {
    console.error('Get user actions error:', err);
    return c.json(error('SERVER_ERROR', '获取行为日志失败'), 500);
  }
});
