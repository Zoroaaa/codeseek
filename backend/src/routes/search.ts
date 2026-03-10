/**
 * 搜索模块路由
 * 功能：提供搜索、搜索历史、收藏、搜索建议等功能
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Hono } from 'hono';
import { Env, SearchSource } from '../types';
import { success, error, generateId } from '../utils';
import { authMiddleware, optionalAuthMiddleware } from '../middleware';

export const searchRoutes = new Hono<{ Bindings: Env }>();

/**
 * 执行搜索
 * POST /api/search
 * 支持可选认证，记录搜索历史
 */
searchRoutes.post('/', optionalAuthMiddleware, async (c) => {
  const userPayload = c.get('user');
  const body = await c.req.json();
  const { keyword, page = 1, pageSize = 20, majorCategoryId, categoryId } = body;

  if (!keyword || !keyword.trim()) {
    return c.json(error('VALIDATION_ERROR', '搜索关键词不能为空'), 400);
  }

  const trimmedKeyword = keyword.trim();
  const limitPageSize = Math.min(Math.max(1, pageSize), 100);
  const limitPage = Math.max(1, page);

  try {
    let historyId: string | null = null;
    if (userPayload) {
      historyId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO user_search_history (id, user_id, query, source, results_count, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).bind(historyId, userPayload.userId, trimmedKeyword, categoryId || majorCategoryId || 'all', Date.now()).run();
    }

    let userEnabledSources: Set<string> | null = null;
    if (userPayload) {
      const userConfigs = await c.env.DB.prepare(
        `SELECT source_id FROM user_search_source_configs 
         WHERE user_id = ? AND is_enabled = 1`
      ).bind(userPayload.userId).all<{ source_id: string }>();
      
      if (userConfigs.results && userConfigs.results.length > 0) {
        userEnabledSources = new Set(userConfigs.results.map(c => c.source_id));
      }
    }

    let query: string;
    let params: (string | number)[];

    if (categoryId) {
      query = `
        SELECT s.* FROM search_sources s
        INNER JOIN search_source_categories c ON s.category_id = c.id
        INNER JOIN search_major_categories mc ON c.major_category_id = mc.id
        WHERE s.is_active = 1 AND s.searchable = 1 AND s.category_id = ? AND mc.requires_keyword = 1
        ORDER BY c.search_priority ASC, s.search_priority ASC, s.display_order ASC
      `;
      params = [categoryId];
    } else if (majorCategoryId) {
      query = `
        SELECT s.* FROM search_sources s
        INNER JOIN search_source_categories c ON s.category_id = c.id
        INNER JOIN search_major_categories mc ON c.major_category_id = mc.id
        WHERE s.is_active = 1 AND s.searchable = 1 AND c.major_category_id = ? AND mc.requires_keyword = 1
        ORDER BY c.search_priority ASC, s.search_priority ASC, s.display_order ASC
      `;
      params = [majorCategoryId];
    } else {
      query = `
        SELECT s.* FROM search_sources s
        INNER JOIN search_source_categories c ON s.category_id = c.id
        INNER JOIN search_major_categories mc ON c.major_category_id = mc.id
        WHERE s.is_active = 1 AND s.searchable = 1 AND mc.requires_keyword = 1
        ORDER BY c.search_priority ASC, s.search_priority ASC, s.display_order ASC
      `;
      params = [];
    }

    const sources = params.length > 0
      ? await c.env.DB.prepare(query).bind(...params).all<SearchSource>()
      : await c.env.DB.prepare(query).all<SearchSource>();

    const filteredSources = userEnabledSources
      ? (sources.results || []).filter(s => userEnabledSources.has(s.id))
      : (sources.results || []);

    const searchResults = filteredSources.map(source => ({
      id: source.id,
      name: source.name,
      subtitle: source.subtitle,
      icon: source.icon,
      url: source.url_template.replace('{keyword}', encodeURIComponent(trimmedKeyword)),
      siteType: source.site_type,
      category: source.category_id,
    }));

    if (historyId && userPayload) {
      await c.env.DB.prepare(
        `UPDATE user_search_history SET results_count = ? WHERE id = ? AND user_id = ?`
      ).bind(searchResults.length, historyId, userPayload.userId).run();
    }

    return c.json(success({
      keyword: trimmedKeyword,
      results: searchResults,
      total: searchResults.length,
      page: limitPage,
      pageSize: limitPageSize,
      hasMore: false,
    }, '搜索完成'));
  } catch (err) {
    console.error('Search error:', err);
    return c.json(error('SERVER_ERROR', '搜索失败'), 500);
  }
});

/**
 * 获取搜索历史
 * GET /api/search/history
 * 需要认证
 */
searchRoutes.get('/history', authMiddleware, async (c) => {
  const userPayload = c.get('user');
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '50')), 200);

  try {
    const history = await c.env.DB.prepare(
      `SELECT h.id, h.user_id, h.query, h.source, h.results_count, h.created_at,
              s.name as source_name, s.icon as source_icon
       FROM user_search_history h 
       LEFT JOIN search_sources s ON h.source = s.id 
       WHERE h.user_id = ? 
       ORDER BY h.created_at DESC 
       LIMIT ?`
    ).bind(userPayload.userId, limit).all();

    return c.json(success(history.results || []));
  } catch (err) {
    console.error('Get search history error:', err);
    return c.json(error('SERVER_ERROR', '获取历史失败'), 500);
  }
});

/**
 * 清空搜索历史
 * DELETE /api/search/history
 * 需要认证
 */
searchRoutes.delete('/history', authMiddleware, async (c) => {
  const userPayload = c.get('user');

  try {
    await c.env.DB.prepare(
      'DELETE FROM user_search_history WHERE user_id = ?'
    ).bind(userPayload.userId).run();

    return c.json(success(null, '历史已清空'));
  } catch (err) {
    console.error('Clear search history error:', err);
    return c.json(error('SERVER_ERROR', '操作失败'), 500);
  }
});

/**
 * 删除单条搜索历史
 * DELETE /api/search/history/:id
 * 需要认证
 */
searchRoutes.delete('/history/:id', authMiddleware, async (c) => {
  const userPayload = c.get('user');
  const id = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM user_search_history WHERE id = ? AND user_id = ?'
    ).bind(id, userPayload.userId).run();

    if (!result.success || result.meta.changes === 0) {
      return c.json(error('NOT_FOUND', '记录不存在'), 404);
    }

    return c.json(success(null, '已删除'));
  } catch (err) {
    console.error('Delete search history error:', err);
    return c.json(error('SERVER_ERROR', '操作失败'), 500);
  }
});

/**
 * 获取收藏列表
 * GET /api/search/favorites
 * 需要认证
 */
searchRoutes.get('/favorites', authMiddleware, async (c) => {
  const userPayload = c.get('user');

  try {
    const favorites = await c.env.DB.prepare(
      `SELECT f.id, f.user_id, f.title, f.subtitle, f.url, f.icon, f.keyword, 
              f.created_at, f.updated_at
       FROM user_favorites f 
       WHERE f.user_id = ? 
       ORDER BY f.created_at DESC`
    ).bind(userPayload.userId).all();

    return c.json(success(favorites.results || []));
  } catch (err) {
    console.error('Get favorites error:', err);
    return c.json(error('SERVER_ERROR', '获取收藏失败'), 500);
  }
});

/**
 * 添加收藏
 * POST /api/search/favorites
 * 需要认证
 */
searchRoutes.post('/favorites', authMiddleware, async (c) => {
  const userPayload = c.get('user');
  const body = await c.req.json();
  const { title, subtitle, url, icon, keyword } = body;

  if (!title || !url) {
    return c.json(error('VALIDATION_ERROR', '标题和URL是必填项'), 400);
  }

  try {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM user_favorites WHERE user_id = ? AND url = ?'
    ).bind(userPayload.userId, url).first();

    if (existing) {
      return c.json(error('DUPLICATE_ERROR', '已收藏该链接'), 400);
    }

    const id = generateId();
    const now = Date.now();

    await c.env.DB.prepare(
      `INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userPayload.userId, title, subtitle || null, url, icon || null, keyword || null, now, now).run();

    return c.json(success({
      id,
      userId: userPayload.userId,
      title,
      subtitle: subtitle || null,
      url,
      icon: icon || null,
      keyword: keyword || null,
      createdAt: now,
      updatedAt: now,
    }, '收藏成功'));
  } catch (err) {
    console.error('Add favorite error:', err);
    return c.json(error('SERVER_ERROR', '收藏失败'), 500);
  }
});

/**
 * 删除收藏
 * DELETE /api/search/favorites/:id
 * 需要认证
 */
searchRoutes.delete('/favorites/:id', authMiddleware, async (c) => {
  const userPayload = c.get('user');
  const id = c.req.param('id');

  try {
    const result = await c.env.DB.prepare(
      'DELETE FROM user_favorites WHERE id = ? AND user_id = ?'
    ).bind(id, userPayload.userId).run();

    if (!result.success || result.meta.changes === 0) {
      return c.json(error('NOT_FOUND', '收藏不存在'), 404);
    }

    return c.json(success(null, '已取消收藏'));
  } catch (err) {
    console.error('Remove favorite error:', err);
    return c.json(error('SERVER_ERROR', '操作失败'), 500);
  }
});

/**
 * 获取搜索建议
 * GET /api/search/suggestions
 * 公开接口，基于全局搜索历史
 */
searchRoutes.get('/suggestions', async (c) => {
  const keyword = c.req.query('keyword');
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '10')), 20);

  if (!keyword || keyword.length < 2) {
    return c.json(success([]));
  }

  try {
    const suggestions = await c.env.DB.prepare(
      `SELECT query as keyword, COUNT(*) as count 
       FROM user_search_history 
       WHERE query LIKE ? 
       GROUP BY query 
       ORDER BY count DESC 
       LIMIT ?`
    ).bind(`${keyword}%`, limit).all<{ keyword: string; count: number }>();

    return c.json(success(suggestions.results || []));
  } catch (err) {
    console.error('Get suggestions error:', err);
    return c.json(success([]));
  }
});

/**
 * 获取热门搜索关键词
 * GET /api/search/trending
 * 公开接口
 */
searchRoutes.get('/trending', async (c) => {
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') || '20')), 50);
  const hours = Math.min(Math.max(1, parseInt(c.req.query('hours') || '24')), 168);

  try {
    const since = Date.now() - hours * 60 * 60 * 1000;
    
    const trending = await c.env.DB.prepare(
      `SELECT query as keyword, COUNT(*) as count 
       FROM user_search_history 
       WHERE created_at > ? 
       GROUP BY query 
       ORDER BY count DESC 
       LIMIT ?`
    ).bind(since, limit).all<{ keyword: string; count: number }>();

    return c.json(success(trending.results || []));
  } catch (err) {
    console.error('Get trending error:', err);
    return c.json(success([]));
  }
});
