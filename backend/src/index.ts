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

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: (origin) => {
    const allowedOrigins = [
      'https://codeseek.pp.ua',
      'https://www.codeseek.pp.ua',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    if (origin.endsWith('.pages.dev') || origin.includes('cloudflare')) {
      return origin;
    }
    return allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400,
}));

app.get('/', (c) => {
  return c.json({
    name: 'CodeSeek API',
    version: c.env.APP_VERSION || '2.0.0',
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
app.route('/api', configRoutes);
app.route('/api', systemRoutes);

app.get('/api/config', async (c) => {
  return c.json({
    success: true,
    data: {
      appVersion: c.env.APP_VERSION || '1.0.0',
      allowRegistration: c.env.ALLOW_REGISTRATION === 'true',
      minUsernameLength: parseInt(c.env.MIN_USERNAME_LENGTH || '3', 10),
      maxUsernameLength: parseInt(c.env.MAX_USERNAME_LENGTH || '20', 10),
      minPasswordLength: parseInt(c.env.MIN_PASSWORD_LENGTH || '6', 10),
      maxFavoritesPerUser: parseInt(c.env.MAX_FAVORITES_PER_USER || '1000', 10),
      maxHistoryPerUser: parseInt(c.env.MAX_HISTORY_PER_USER || '1000', 10),
      maxTagsPerUser: parseInt(c.env.MAX_TAGS_PER_USER || '50', 10),
      enableActionLogging: c.env.ENABLE_ACTION_LOGGING === 'true',
    },
  });
});

app.get('/api/public-config', async (c) => {
  return c.json({
    success: true,
    data: {
      appVersion: c.env.APP_VERSION || '1.0.0',
      allowRegistration: c.env.ALLOW_REGISTRATION === 'true',
      minUsernameLength: parseInt(c.env.MIN_USERNAME_LENGTH || '3', 10),
      maxUsernameLength: parseInt(c.env.MAX_USERNAME_LENGTH || '20', 10),
      minPasswordLength: parseInt(c.env.MIN_PASSWORD_LENGTH || '6', 10),
      maxFavoritesPerUser: parseInt(c.env.MAX_FAVORITES_PER_USER || '1000', 10),
      maxHistoryPerUser: parseInt(c.env.MAX_HISTORY_PER_USER || '1000', 10),
      maxTagsPerUser: parseInt(c.env.MAX_TAGS_PER_USER || '50', 10),
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
        signal: AbortSignal.timeout(10000),
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
