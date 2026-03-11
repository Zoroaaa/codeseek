import { Hono } from 'hono';
import { Env, User, UserFavorite, UserSearchHistory } from '../types';
import { success, error, generateId, verifyToken, logUserAction } from '../utils';
import { CONFIG } from '../constants';

export const userRoutes = new Hono<{ Bindings: Env }>();

userRoutes.get('/settings', async (c) => {
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
      'SELECT settings FROM users WHERE id = ?'
    ).bind(payload.userId).first<User>();

    if (!user) {
      return c.json(error('AUTH_ERROR', '用户不存在'), 404);
    }

    return c.json(success({
      settings: JSON.parse(user.settings || '{}'),
    }));
  } catch (err) {
    console.error('Get settings error:', err);
    return c.json(error('SERVER_ERROR', '获取设置失败'), 500);
  }
});

userRoutes.put('/settings', async (c) => {
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
    const body = await c.req.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return c.json(error('VALIDATION_ERROR', '设置数据格式错误'), 400);
    }

    await c.env.DB.prepare(
      'UPDATE users SET settings = ?, updated_at = ? WHERE id = ?'
    ).bind(JSON.stringify(settings), Date.now(), payload.userId).run();

    await logUserAction(c.env, payload.userId, 'update_settings', { settings }, c);

    return c.json(success({ settings }, '设置已保存'));
  } catch (err) {
    console.error('Update settings error:', err);
    return c.json(error('SERVER_ERROR', '保存设置失败'), 500);
  }
});

userRoutes.get('/favorites', async (c) => {
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
    const favorites = await c.env.DB.prepare(
      'SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC'
    ).bind(payload.userId).all<UserFavorite>();

    return c.json(success({
      favorites: favorites.results || [],
    }));
  } catch (err) {
    console.error('Get favorites error:', err);
    return c.json(error('SERVER_ERROR', '获取收藏失败'), 500);
  }
});

userRoutes.post('/favorites', async (c) => {
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
    const body = await c.req.json();
    const { title, subtitle, url, icon, keyword } = body;

    if (!title || !url) {
      return c.json(error('VALIDATION_ERROR', '标题和URL是必填项'), 400);
    }

    const existing = await c.env.DB.prepare(
      'SELECT id, title, subtitle, url, icon, keyword, created_at FROM user_favorites WHERE user_id = ? AND url = ?'
    ).bind(payload.userId, url).first<UserFavorite>();

    if (existing) {
      return c.json(success({
        id: existing.id,
        title: existing.title,
        subtitle: existing.subtitle,
        url: existing.url,
        icon: existing.icon,
        keyword: existing.keyword,
        createdAt: existing.created_at,
      }, '已收藏该链接'));
    }

    const maxFavorites = parseInt(c.env.MAX_FAVORITES_PER_USER || String(CONFIG.MAX_FAVORITES_PER_USER), 10);
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_favorites WHERE user_id = ?'
    ).bind(payload.userId).first<{ count: number }>();

    if (count && count.count >= maxFavorites) {
      return c.json(error('VALIDATION_ERROR', `最多只能收藏${maxFavorites}个搜索源`), 400);
    }

    const favoriteId = generateId();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      favoriteId,
      payload.userId,
      title,
      subtitle || null,
      url,
      icon || null,
      keyword || null,
      now,
      now
    ).run();

    await logUserAction(c.env, payload.userId, 'add_favorite', { title, url }, c);

    return c.json(success({
      id: favoriteId,
      title,
      subtitle: subtitle || null,
      url,
      icon: icon || null,
      keyword: keyword || null,
      createdAt: now,
    }, '收藏成功'));
  } catch (err) {
    console.error('Add favorite error:', err);
    return c.json(error('SERVER_ERROR', '收藏失败'), 500);
  }
});

userRoutes.post('/favorites/sync', async (c) => {
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
    const body = await c.req.json();
    const { favorites } = body;

    if (!Array.isArray(favorites)) {
      return c.json(error('VALIDATION_ERROR', '收藏数据格式错误'), 400);
    }

    const maxFavorites = parseInt(c.env.MAX_FAVORITES_PER_USER || String(CONFIG.MAX_FAVORITES_PER_USER), 10);
    if (favorites.length > maxFavorites) {
      return c.json(error('VALIDATION_ERROR', `最多只能同步${maxFavorites}个收藏`), 400);
    }

    await c.env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(payload.userId).run();

    const now = Date.now();
    for (const fav of favorites) {
      if (!fav.title || !fav.url) continue;

      const favoriteId = fav.id || generateId();
      await c.env.DB.prepare(`
        INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        favoriteId,
        payload.userId,
        fav.title,
        fav.subtitle || null,
        fav.url,
        fav.icon || null,
        fav.keyword || null,
        fav.createdAt || now,
        now
      ).run();
    }

    await logUserAction(c.env, payload.userId, 'sync_favorites', { count: favorites.length }, c);

    return c.json(success({ count: favorites.length }, '同步成功'));
  } catch (err) {
    console.error('Sync favorites error:', err);
    return c.json(error('SERVER_ERROR', '同步失败'), 500);
  }
});

userRoutes.delete('/favorites/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const favoriteId = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM user_favorites WHERE id = ? AND user_id = ?'
    ).bind(favoriteId, payload.userId).run();

    if (!result.success) {
      return c.json(error('NOT_FOUND', '收藏不存在'), 404);
    }

    await logUserAction(c.env, payload.userId, 'remove_favorite', { favoriteId }, c);

    return c.json(success(null, '已取消收藏'));
  } catch (err) {
    console.error('Remove favorite error:', err);
    return c.json(error('SERVER_ERROR', '取消收藏失败'), 500);
  }
});

userRoutes.get('/search-history', async (c) => {
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
    const limit = parseInt(c.req.query('limit') || String(CONFIG.Pagination.DEFAULT_HISTORY_LIMIT), 10);
    const history = await c.env.DB.prepare(
      'SELECT * FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(payload.userId, limit).all<UserSearchHistory>();

    return c.json(success({
      history: history.results || [],
    }));
  } catch (err) {
    console.error('Get search history error:', err);
    return c.json(error('SERVER_ERROR', '获取搜索历史失败'), 500);
  }
});

userRoutes.post('/search-history', async (c) => {
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
    const body = await c.req.json();
    const { query, source, resultsCount } = body;

    if (!query) {
      return c.json(error('VALIDATION_ERROR', '搜索关键词是必填项'), 400);
    }

    const maxHistory = parseInt(c.env.MAX_HISTORY_PER_USER || String(CONFIG.MAX_HISTORY_PER_USER), 10);
    const count = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?'
    ).bind(payload.userId).first<{ count: number }>();

    if (count && count.count >= maxHistory) {
      const oldest = await c.env.DB.prepare(
        'SELECT id FROM user_search_history WHERE user_id = ? ORDER BY created_at ASC LIMIT 1'
      ).bind(payload.userId).first<{ id: string }>();

      if (oldest) {
        await c.env.DB.prepare('DELETE FROM user_search_history WHERE id = ?').bind(oldest.id).run();
      }
    }

    const historyId = generateId();
    const now = Date.now();

    await c.env.DB.prepare(`
      INSERT INTO user_search_history (id, user_id, query, source, results_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      historyId,
      payload.userId,
      query,
      source || '',
      resultsCount || 0,
      now
    ).run();

    return c.json(success({
      id: historyId,
      query,
      source: source || '',
      resultsCount: resultsCount || 0,
      createdAt: now,
    }, '搜索历史已保存'));
  } catch (err) {
    console.error('Save search history error:', err);
    return c.json(error('SERVER_ERROR', '保存搜索历史失败'), 500);
  }
});

userRoutes.delete('/search-history', async (c) => {
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
    await c.env.DB.prepare('DELETE FROM user_search_history WHERE user_id = ?').bind(payload.userId).run();

    await logUserAction(c.env, payload.userId, 'clear_search_history', {}, c);

    return c.json(success(null, '搜索历史已清空'));
  } catch (err) {
    console.error('Clear search history error:', err);
    return c.json(error('SERVER_ERROR', '清空搜索历史失败'), 500);
  }
});

userRoutes.delete('/search-history/:id', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const historyId = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM user_search_history WHERE id = ? AND user_id = ?'
    ).bind(historyId, payload.userId).run();

    if (!result.success || result.meta.changes === 0) {
      return c.json(error('NOT_FOUND', '搜索历史记录不存在'), 404);
    }

    return c.json(success(null, '搜索历史已删除'));
  } catch (err) {
    console.error('Delete search history error:', err);
    return c.json(error('SERVER_ERROR', '删除搜索历史失败'), 500);
  }
});

userRoutes.get('/search-stats', async (c) => {
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
    const totalSearches = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?'
    ).bind(payload.userId).first<{ count: number }>();

    const topSources = await c.env.DB.prepare(`
      SELECT source, COUNT(*) as count 
      FROM user_search_history 
      WHERE user_id = ? AND source != '' 
      GROUP BY source 
      ORDER BY count DESC 
      LIMIT 5
    `).bind(payload.userId).all<{ source: string; count: number }>();

    const recentSearches = await c.env.DB.prepare(
      'SELECT query, created_at FROM user_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
    ).bind(payload.userId).all<{ query: string; created_at: number }>();

    const now = Date.now();
    const oneWeekAgo = now - CONFIG.Stats.WEEK_IN_MS;
    const twoWeeksAgo = now - CONFIG.Stats.TWO_WEEKS_IN_MS;

    const thisWeekSearches = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ? AND created_at >= ?'
    ).bind(payload.userId, oneWeekAgo).first<{ count: number }>();

    const lastWeekSearches = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ? AND created_at >= ? AND created_at < ?'
    ).bind(payload.userId, twoWeeksAgo, oneWeekAgo).first<{ count: number }>();

    const thisWeek = thisWeekSearches?.count || 0;
    const lastWeek = lastWeekSearches?.count || 0;
    let searchGrowthPercent = 0;
    if (lastWeek > 0) {
      searchGrowthPercent = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    } else if (thisWeek > 0) {
      searchGrowthPercent = 100;
    }

    return c.json(success({
      totalSearches: totalSearches?.count || 0,
      topSources: topSources.results || [],
      recentSearches: recentSearches.results || [],
      searchGrowthPercent,
      thisWeekSearches: thisWeek,
      lastWeekSearches: lastWeek,
    }));
  } catch (err) {
    console.error('Get search stats error:', err);
    return c.json(error('SERVER_ERROR', '获取搜索统计失败'), 500);
  }
});

userRoutes.get('/source-configs', async (c) => {
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
    const configs = await c.env.DB.prepare(
      'SELECT * FROM user_search_source_configs WHERE user_id = ?'
    ).bind(payload.userId).all();

    return c.json(success({
      configs: configs.results || [],
    }));
  } catch (err) {
    console.error('Get source configs error:', err);
    return c.json(error('SERVER_ERROR', '获取配置失败'), 500);
  }
});

userRoutes.put('/source-configs/:sourceId', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(error('AUTH_ERROR', '无效的Token'), 401);
  }

  const sourceId = c.req.param('sourceId');

  try {
    const body = await c.req.json();
    const { isEnabled, customPriority, customName, customSubtitle, customIcon, notes } = body;

    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_search_source_configs WHERE user_id = ? AND source_id = ?'
    ).bind(payload.userId, sourceId).first();

    const now = Date.now();

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE user_search_source_configs 
        SET is_enabled = ?, custom_priority = ?, custom_name = ?, custom_subtitle = ?, custom_icon = ?, notes = ?, updated_at = ?
        WHERE user_id = ? AND source_id = ?
      `).bind(
        isEnabled !== undefined ? (isEnabled ? 1 : 0) : 1,
        customPriority || null,
        customName || null,
        customSubtitle || null,
        customIcon || null,
        notes || null,
        now,
        payload.userId,
        sourceId
      ).run();
    } else {
      const configId = generateId();
      await c.env.DB.prepare(`
        INSERT INTO user_search_source_configs (id, user_id, source_id, is_enabled, custom_priority, custom_name, custom_subtitle, custom_icon, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        configId,
        payload.userId,
        sourceId,
        isEnabled !== undefined ? (isEnabled ? 1 : 0) : 1,
        customPriority || null,
        customName || null,
        customSubtitle || null,
        customIcon || null,
        notes || null,
        now,
        now
      ).run();
    }

    return c.json(success(null, '配置已保存'));
  } catch (err) {
    console.error('Update source config error:', err);
    return c.json(error('SERVER_ERROR', '保存配置失败'), 500);
  }
});
