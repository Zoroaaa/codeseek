/**
 * CodeSeek 后端API主入口
 * 功能：路由注册、中间件配置、全局错误处理
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, SearchSource } from './types';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/user';
import { sourceRoutes } from './routes/sources';
import { communityRoutes } from './routes/community';
import { systemRoutes } from './routes/system';
import { searchRoutes } from './routes/search';
import { adminRoutes } from './routes/admin';
import { configRoutes } from './routes/config';
import { CONFIG } from './constants';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (origin) => {
    if (CONFIG.CORS.ALLOWED_ORIGINS.includes(origin)) {
      return origin;
    }
    if (origin.endsWith('.pages.dev') || origin.includes('cloudflare')) {
      return origin;
    }
    return CONFIG.CORS.ALLOWED_ORIGINS[0];
  },
  allowMethods: CONFIG.CORS.ALLOW_METHODS,
  allowHeaders: CONFIG.CORS.ALLOW_HEADERS,
  exposeHeaders: CONFIG.CORS.EXPOSE_HEADERS,
  credentials: true,
  maxAge: CONFIG.CORS.MAX_AGE,
}));

app.get('/', (c) => {
  return c.json({
    name: 'CodeSeek API',
    version: c.env.APP_VERSION || CONFIG.Defaults.APP_VERSION,
    status: 'running',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

app.route('/api/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/search-sources', sourceRoutes);
app.route('/api/community', communityRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/config', configRoutes);
app.route('/api', systemRoutes);

app.get('/api/config', async (c) => {
  return c.json({
    success: true,
    data: {
      appVersion: c.env.APP_VERSION || CONFIG.Defaults.APP_VERSION,
      allowRegistration: c.env.ALLOW_REGISTRATION === 'true',
      minUsernameLength: parseInt(c.env.MIN_USERNAME_LENGTH || String(CONFIG.VALIDATION.USERNAME_MIN_LENGTH), 10),
      maxUsernameLength: parseInt(c.env.MAX_USERNAME_LENGTH || String(CONFIG.VALIDATION.USERNAME_MAX_LENGTH), 10),
      minPasswordLength: parseInt(c.env.MIN_PASSWORD_LENGTH || String(CONFIG.VALIDATION.PASSWORD_MIN_LENGTH), 10),
      maxFavoritesPerUser: parseInt(c.env.MAX_FAVORITES_PER_USER || String(CONFIG.MAX_FAVORITES_PER_USER), 10),
      maxHistoryPerUser: parseInt(c.env.MAX_HISTORY_PER_USER || String(CONFIG.MAX_HISTORY_PER_USER), 10),
      maxTagsPerUser: parseInt(c.env.MAX_TAGS_PER_USER || String(CONFIG.MAX_TAGS_PER_USER), 10),
      enableActionLogging: c.env.ENABLE_ACTION_LOGGING === 'true',
    },
  });
});

app.get('/api/public-config', async (c) => {
  return c.json({
    success: true,
    data: {
      appVersion: c.env.APP_VERSION || CONFIG.Defaults.APP_VERSION,
      allowRegistration: c.env.ALLOW_REGISTRATION === 'true',
      minUsernameLength: parseInt(c.env.MIN_USERNAME_LENGTH || String(CONFIG.VALIDATION.USERNAME_MIN_LENGTH), 10),
      maxUsernameLength: parseInt(c.env.MAX_USERNAME_LENGTH || String(CONFIG.VALIDATION.USERNAME_MAX_LENGTH), 10),
      minPasswordLength: parseInt(c.env.MIN_PASSWORD_LENGTH || String(CONFIG.VALIDATION.PASSWORD_MIN_LENGTH), 10),
      maxFavoritesPerUser: parseInt(c.env.MAX_FAVORITES_PER_USER || String(CONFIG.MAX_FAVORITES_PER_USER), 10),
      maxHistoryPerUser: parseInt(c.env.MAX_HISTORY_PER_USER || String(CONFIG.MAX_HISTORY_PER_USER), 10),
      maxTagsPerUser: parseInt(c.env.MAX_TAGS_PER_USER || String(CONFIG.MAX_TAGS_PER_USER), 10),
      enableActionLogging: c.env.ENABLE_ACTION_LOGGING === 'true',
    },
  });
});

app.get('/api/stats', async (c) => {
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

    return c.json({
      success: true,
      data: {
        users: userCount?.count || 0,
        sources: sourceCount?.count || 0,
        searches: searchCount?.count || 0,
      },
    });
  } catch (err) {
    console.error('Get stats error:', err);
    return c.json({ success: false, error: { code: 'SERVER_ERROR', message: '获取统计失败' } }, 500);
  }
});

app.get('/api/source-status/check', async (c) => {
  const sourceId = c.req.query('sourceId');
  const keyword = c.req.query('keyword') || 'test';

  if (!sourceId) {
    return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请提供搜索源ID' } }, 400);
  }

  try {
    const source = await c.env.DB.prepare(
      'SELECT * FROM search_sources WHERE id = ?'
    ).bind(sourceId).first<SearchSource>();

    if (!source) {
      return c.json({ success: false, error: { code: 'NOT_FOUND', message: '搜索源不存在' } }, 404);
    }

    const url = source.url_template.replace('{keyword}', encodeURIComponent(keyword));
    const startTime = Date.now();
    
    let status = 'unknown';
    let available = false;
    let responseTime = 0;
    let checkError = null;

    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(CONFIG.SourceStatus.CHECK_TIMEOUT_MS),
      });
      
      responseTime = Date.now() - startTime;
      available = response.ok;
      status = available ? 'online' : 'error';
    } catch (fetchError) {
      responseTime = Date.now() - startTime;
      status = 'offline';
      checkError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
    }

    return c.json({
      success: true,
      data: {
        status,
        available,
        responseTime,
        error: checkError,
      },
    });
  } catch (err) {
    console.error('Source status check error:', err);
    return c.json({ success: false, error: { code: 'SERVER_ERROR', message: '状态检查失败' } }, 500);
  }
});

app.post('/api/actions/record', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, action, data } = body;

    if (!action) {
      return c.json({ success: false, error: { code: 'VALIDATION_ERROR', message: '请提供行为类型' } }, 400);
    }

    const actionId = crypto.randomUUID();
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

    return c.json({ success: true, data: { id: actionId }, message: '行为已记录' });
  } catch (err) {
    console.error('Record action error:', err);
    return c.json({ success: false, error: { code: 'SERVER_ERROR', message: '记录失败' } }, 500);
  }
});

app.notFound((c) => {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: '接口不存在' } }, 404);
});

app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ success: false, error: { code: 'SERVER_ERROR', message: '服务器内部错误' } }, 500);
});

export default app;
