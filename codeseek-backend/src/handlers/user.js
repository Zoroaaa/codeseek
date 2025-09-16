// src/handlers/user.js - 用户相关路由处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';

// ===================== 用户设置相关 =====================

// 获取用户设置
export async function userGetSettingsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();

        const settings = userRecord ? JSON.parse(userRecord.settings || '{}') : {};

        return utils.successResponse({ 
            settings: {
                theme: settings.theme || 'auto',
                autoSync: settings.autoSync !== false,
                cacheResults: settings.cacheResults !== false,
                maxHistoryPerUser: settings.maxHistoryPerUser || 1000,
                maxFavoritesPerUser: settings.maxFavoritesPerUser || 1000,
                allowAnalytics: settings.allowAnalytics !== false,
                searchSuggestions: settings.searchSuggestions !== false,
                searchSources: settings.searchSources || ['javbus', 'javdb', 'javlibrary'],
                customSearchSources: settings.customSearchSources || [],
                customSourceCategories: settings.customSourceCategories || [],
                checkSourceStatus: settings.checkSourceStatus,
                sourceStatusCheckTimeout: settings.sourceStatusCheckTimeout,
                sourceStatusCacheDuration: settings.sourceStatusCacheDuration, 
                skipUnavailableSources: settings.skipUnavailableSources,
                showSourceStatus: settings.showSourceStatus,
                retryFailedSources: settings.retryFailedSources,
                ...settings
            }
        });

    } catch (error) {
        console.error('获取用户设置失败:', error);
        return utils.errorResponse('获取用户设置失败', 500);
    }
}

// 更新用户设置
export async function userUpdateSettingsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { settings } = body;

        if (!settings || typeof settings !== 'object') {
            return utils.errorResponse('设置数据格式错误');
        }

        const allowedSettings = [
            'theme', 
            'autoSync', 
            'cacheResults', 
            'maxHistoryPerUser', 
            'maxFavoritesPerUser',
            'allowAnalytics',
            'searchSuggestions',
            'searchSources',
            'customSearchSources',
            'customSourceCategories',
            'checkSourceStatus',
            'sourceStatusCheckTimeout',
            'sourceStatusCacheDuration', 
            'skipUnavailableSources',
            'showSourceStatus',
            'retryFailedSources'
        ];
        
        const filteredSettings = {};
        
        Object.keys(settings).forEach(key => {
            if (allowedSettings.includes(key)) {
                filteredSettings[key] = settings[key];
            }
        });

        if (filteredSettings.hasOwnProperty('sourceStatusCheckTimeout')) {
            const timeout = Number(filteredSettings.sourceStatusCheckTimeout);
            if (timeout < 1000 || timeout > 30000) {
                return utils.errorResponse('状态检查超时时间必须在 1-30 秒之间');
            }
            filteredSettings.sourceStatusCheckTimeout = timeout;
        }
        
        if (filteredSettings.hasOwnProperty('sourceStatusCacheDuration')) {
            const cacheDuration = Number(filteredSettings.sourceStatusCacheDuration);
            if (cacheDuration < 60000 || cacheDuration > 3600000) {
                return utils.errorResponse('状态缓存时间必须在 60-3600 秒之间');
            }
            filteredSettings.sourceStatusCacheDuration = cacheDuration;
        }
        
        ['checkSourceStatus', 'skipUnavailableSources', 'showSourceStatus', 'retryFailedSources'].forEach(key => {
            if (filteredSettings.hasOwnProperty(key)) {
                filteredSettings[key] = Boolean(filteredSettings[key]);
            }
        });

        if (filteredSettings.searchSources) {
            if (!Array.isArray(filteredSettings.searchSources)) {
                return utils.errorResponse('搜索源格式错误：必须是数组');
            }
            
            if (filteredSettings.searchSources.length === 0) {
                return utils.errorResponse('至少需要选择一个搜索源');
            }
        }

        if (filteredSettings.customSearchSources) {
            if (!Array.isArray(filteredSettings.customSearchSources)) {
                return utils.errorResponse('自定义搜索源格式错误：必须是数组');
            }
            
            const invalidCustomSources = filteredSettings.customSearchSources.filter(source => 
                !source || 
                !source.id || 
                !source.name || 
                !source.urlTemplate ||
                !source.category ||
                typeof source.id !== 'string' || 
                typeof source.name !== 'string' || 
                typeof source.urlTemplate !== 'string' ||
                typeof source.category !== 'string'
            );
            
            if (invalidCustomSources.length > 0) {
                return utils.errorResponse('自定义搜索源格式错误：缺少必需字段或格式不正确');
            }
        }

        if (filteredSettings.customSourceCategories) {
            if (!Array.isArray(filteredSettings.customSourceCategories)) {
                return utils.errorResponse('自定义分类格式错误：必须是数组');
            }
            
            const invalidCategories = filteredSettings.customSourceCategories.filter(category => 
                !category || 
                !category.id || 
                !category.name || 
                !category.icon ||
                typeof category.id !== 'string' || 
                typeof category.name !== 'string' || 
                typeof category.icon !== 'string'
            );
            
            if (invalidCategories.length > 0) {
                return utils.errorResponse('自定义分类格式错误：缺少必需字段或格式不正确');
            }
            
            const categoryIds = filteredSettings.customSourceCategories.map(c => c.id);
            const duplicateIds = categoryIds.filter((id, index) => categoryIds.indexOf(id) !== index);
            
            if (duplicateIds.length > 0) {
                return utils.errorResponse(`自定义分类ID重复: ${duplicateIds.join(', ')}`);
            }
            
            const categoryNames = filteredSettings.customSourceCategories.map(c => c.name);
            const duplicateNames = categoryNames.filter((name, index) => categoryNames.indexOf(name) !== index);
            
            if (duplicateNames.length > 0) {
                return utils.errorResponse(`自定义分类名称重复: ${duplicateNames.join(', ')}`);
            }
        }

        const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();

        const currentSettings = userRecord ? JSON.parse(userRecord.settings || '{}') : {};
        const updatedSettings = { ...currentSettings, ...filteredSettings };

        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();

        await utils.logUserAction(env, user.id, 'settings_update', {
            changedFields: Object.keys(filteredSettings),
            hasCustomSources: !!(filteredSettings.customSearchSources && filteredSettings.customSearchSources.length > 0),
            hasCustomCategories: !!(filteredSettings.customSourceCategories && filteredSettings.customSourceCategories.length > 0),
            checkSourceStatusChanged: filteredSettings.hasOwnProperty('checkSourceStatus')
        }, request);

        return utils.successResponse({ 
            message: '设置更新成功',
            settings: updatedSettings
        });

    } catch (error) {
        console.error('更新用户设置失败:', error);
        return utils.errorResponse('更新用户设置失败: ' + error.message, 500);
    }
}

// ===================== 收藏夹相关 =====================

// 同步收藏夹
export async function userSyncFavoritesHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { favorites } = body;

        if (!Array.isArray(favorites)) {
            return utils.errorResponse('收藏夹数据格式错误');
        }

        const maxFavorites = parseInt(env.MAX_FAVORITES_PER_USER || '1000');
        if (favorites.length > maxFavorites) {
            return utils.errorResponse(`收藏夹数量不能超过 ${maxFavorites} 个`);
        }

        await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ?`).bind(user.id).run();

        for (const favorite of favorites) {
            const favoriteId = favorite.id || utils.generateId();
            await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                favoriteId, user.id, favorite.title || '', favorite.subtitle || '', 
                favorite.url || '', favorite.icon || '', favorite.keyword || '',
                Date.now(), Date.now()
            ).run();
        }

        return utils.successResponse({ message: '收藏夹同步成功' });

    } catch (error) {
        console.error('同步收藏夹失败:', error);
        return utils.errorResponse('同步收藏夹失败', 500);
    }
}

// 获取收藏夹
export async function userGetFavoritesHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await env.DB.prepare(`
            SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC
        `).bind(user.id).all();

        const favorites = result.results.map(fav => ({
            id: fav.id,
            title: fav.title,
            subtitle: fav.subtitle,
            url: fav.url,
            icon: fav.icon,
            keyword: fav.keyword,
            addedAt: new Date(fav.created_at).toISOString()
        }));

        return utils.successResponse({ favorites });

    } catch (error) {
        console.error('获取收藏夹失败:', error);
        return utils.errorResponse('获取收藏夹失败', 500);
    }
}

// ===================== 搜索历史相关 =====================

// 保存搜索历史
export async function userSaveSearchHistoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { query, timestamp, source, resultCount } = body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return utils.errorResponse('搜索关键词不能为空');
        }

        const trimmedQuery = query.trim();
        
        if (trimmedQuery.length > 200) {
            return utils.errorResponse('搜索关键词过长');
        }

        const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || '1000');
        
        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        if (countResult.count >= maxHistory) {
            const deleteCount = countResult.count - maxHistory + 1;
            await env.DB.prepare(`
                DELETE FROM user_search_history 
                WHERE user_id = ? AND id IN (
                    SELECT id FROM user_search_history 
                    WHERE user_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT ?
                )
            `).bind(user.id, user.id, deleteCount).run();
        }

        const historyId = utils.generateId();
        const now = timestamp || Date.now();

		await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, query, source, results_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(historyId, user.id, trimmedQuery, source || 'unknown', resultCount || 0, now).run();
		
        await utils.logUserAction(env, user.id, 'search', { query: trimmedQuery, source }, request);

        return utils.successResponse({ 
            message: '搜索历史保存成功',
            historyId 
        });

    } catch (error) {
        console.error('保存搜索历史失败:', error);
        return utils.errorResponse('保存搜索历史失败: ' + error.message, 500);
    }
}

// 获取搜索历史
export async function userGetSearchHistoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

        const result = await env.DB.prepare(`
            SELECT * FROM user_search_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();

        const history = result.results.map(item => ({
            id: item.id,
            keyword: item.query,
            query: item.query,
            source: item.source,
            timestamp: item.created_at,
            createdAt: new Date(item.created_at).toISOString()
        }));

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        return utils.successResponse({ 
            history,
            searchHistory: history,
            total: countResult.total,
            limit,
            offset,
            hasMore: (offset + limit) < countResult.total
        });

    } catch (error) {
        console.error('获取搜索历史失败:', error);
        return utils.errorResponse('获取搜索历史失败', 500);
    }
}

// 删除单条搜索历史
export async function userDeleteSearchHistoryHandler(request, env) {
    console.log('🔧 删除单条历史路由被调用');
    
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const historyId = request.params?.id;
        console.log('🔧 获取到的历史ID:', historyId);

        if (!historyId || historyId.length < 10) {
            return utils.errorResponse('历史记录ID格式无效', 400);
        }

        const result = await env.DB.prepare(`
            DELETE FROM user_search_history 
            WHERE id = ? AND user_id = ?
        `).bind(historyId, user.id).run();

        console.log('🔧 删除结果:', result);

        if (result.changes === 0) {
            return utils.errorResponse('历史记录不存在或无权删除', 404);
        }

        await utils.logUserAction(env, user.id, 'history_delete', { 
            historyId,
            deletedCount: 1 
        }, request);

        return utils.successResponse({ 
            message: '删除成功',
            deletedId: historyId
        });

    } catch (error) {
        console.error('删除搜索历史失败:', error);
        return utils.errorResponse('删除搜索历史失败', 500);
    }
}

// 清空搜索历史
export async function userClearSearchHistoryHandler(request, env) {
    console.log('🔧 清空历史路由被调用');
    
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const operation = url.searchParams.get('operation');
        
        if (operation !== 'clear') {
            return utils.errorResponse('请指定operation=clear参数以确认清空操作', 400);
        }

        const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        const deletedCount = countResult.count || 0;

        await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();

        await utils.logUserAction(env, user.id, 'history_clear', { 
            deletedCount 
        }, request);

        return utils.successResponse({ 
            message: '搜索历史已清空',
            deletedCount
        });

    } catch (error) {
        console.error('清空搜索历史失败:', error);
        return utils.errorResponse('清空搜索历史失败', 500);
    }
}

// ===================== 搜索统计相关 =====================

// 获取搜索统计
export async function userGetSearchStatsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const totalResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        const todayResult = await env.DB.prepare(`
            SELECT COUNT(*) as today FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, todayTimestamp).first();

        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const weekResult = await env.DB.prepare(`
            SELECT COUNT(*) as week FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, weekAgo).first();

        const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const topQueriesResult = await env.DB.prepare(`
            SELECT query, COUNT(*) as count 
            FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY query 
            ORDER BY count DESC 
            LIMIT 10
        `).bind(user.id, monthAgo).all();

        const topQueries = topQueriesResult.results.map(item => ({
            query: item.query,
            count: item.count
        }));

        return utils.successResponse({
            total: totalResult.total,
            today: todayResult.today,
            thisWeek: weekResult.week,
            topQueries
        });

    } catch (error) {
        console.error('获取搜索统计失败:', error);
        return utils.errorResponse('获取搜索统计失败', 500);
    }
}