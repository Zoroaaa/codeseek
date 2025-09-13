// src/handlers/community.js - 社区相关路由处理器
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { updateUserStatsAfterDelete } from '../services/services.js';

// ===================== 标签管理相关 =====================

// 获取标签列表
export async function communityGetTagsHandler(request, env) {
    try {
        const url = new URL(request.url);
        const onlyActive = url.searchParams.get('active') !== 'false';
        
        let whereConditions = [];
        let params = [];
        
        if (onlyActive) {
            whereConditions.push('cst.tag_active = ?');
            params.push(1);
        }
        
        let query = `
            SELECT 
                cst.id,
                cst.tag_name,
                cst.tag_description,
                cst.tag_color,
                cst.usage_count,
                cst.is_official,
                cst.tag_active,
                cst.created_by,
                u.username as creator_name,
                cst.created_at,
                cst.updated_at
            FROM community_source_tags cst
            LEFT JOIN users u ON cst.created_by = u.id
        `;
        
        if (whereConditions.length > 0) {
            query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
        
        query += ` ORDER BY cst.is_official DESC, cst.usage_count DESC, cst.created_at DESC`;
        
        const result = await env.DB.prepare(query).bind(...params).all();
        
        const tags = result.results.map(tag => ({
            id: tag.id,
            name: tag.tag_name,
            description: tag.tag_description,
            color: tag.tag_color,
            usageCount: tag.usage_count || 0,
            isOfficial: Boolean(tag.is_official),
            isActive: Boolean(tag.tag_active),
            creator: {
                id: tag.created_by,
                name: tag.creator_name || 'System'
            },
            createdAt: tag.created_at,
            updatedAt: tag.updated_at
        }));
        
        return utils.successResponse({ 
            tags,
            total: tags.length
        });
        
    } catch (error) {
        console.error('获取标签失败:', error);
        return utils.errorResponse('获取标签失败: ' + error.message, 500);
    }
}

// 创建标签
export async function communityCreateTagHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const body = await request.json().catch(() => ({}));
        const { name, description, color } = body;
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return utils.errorResponse('标签名称不能为空', 400);
        }
        
        const trimmedName = name.trim();
        
        if (trimmedName.length < 2 || trimmedName.length > 20) {
            return utils.errorResponse('标签名称长度必须在2-20个字符之间', 400);
        }
        
        if (!/^[\u4e00-\u9fa5\w\s\-]{2,20}$/.test(trimmedName)) {
            return utils.errorResponse('标签名称只能包含中文、英文、数字、空格和短横线', 400);
        }
        
        const validColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#3b82f6';
        
        // 移除try-catch，直接使用正确的字段名
        const existingTag = await env.DB.prepare(`
            SELECT id FROM community_source_tags WHERE LOWER(tag_name) = LOWER(?)
        `).bind(trimmedName).first();
        
        if (existingTag) {
            return utils.errorResponse('标签名称已存在，请使用其他名称', 400);
        }
        
        const userTagCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM community_source_tags 
            WHERE created_by = ? AND tag_active = 1
        `).bind(user.id).first().catch(() => ({ count: 0 }));
        
        const maxTagsPerUser = parseInt(env.MAX_TAGS_PER_USER || '50');
        if (userTagCount.count >= maxTagsPerUser) {
            return utils.errorResponse(`每个用户最多只能创建${maxTagsPerUser}个标签`, 400);
        }
        
        const tagId = utils.generateId();
        const now = Date.now();
        
        // 移除try-catch，直接使用正确的字段名
        await env.DB.prepare(`
            INSERT INTO community_source_tags (
                id, tag_name, tag_description, tag_color, usage_count, 
                is_official, tag_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            tagId, trimmedName, description?.trim() || '', validColor, 0, 
            0, 1, user.id, now, now
        ).run();
        
        await utils.logUserAction(env, user.id, 'tag_created', {
            tagId,
            tagName: trimmedName
        }, request);
        
        return utils.successResponse({
            message: '标签创建成功',
            tag: {
                id: tagId,
                name: trimmedName,
                description: description?.trim() || '',
                color: validColor,
                usageCount: 0,
                isOfficial: false,
                isActive: true,
                creator: {
                    id: user.id,
                    name: user.username
                },
                createdAt: now
            }
        });
        
    } catch (error) {
        console.error('创建标签失败:', error);
        
        let errorMessage = '创建标签失败';
        if (error.message.includes('UNIQUE constraint')) {
            errorMessage = '标签名称已存在，请使用其他名称';
        } else if (error.message.includes('SQLITE_ERROR')) {
            errorMessage = 'SQLite数据库错误，请检查服务器状态';
        } else {
            errorMessage += ': ' + error.message;
        }
        
        return utils.errorResponse(errorMessage, 500);
    }
}

// 更新标签
export async function communityUpdateTagHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const tagId = request.params?.id;
        
        if (!tagId) {
            return utils.errorResponse('标签ID不能为空', 400);
        }
        
        const existingTag = await env.DB.prepare(`
            SELECT * FROM community_source_tags WHERE id = ?
        `).bind(tagId).first();
        
        if (!existingTag) {
            return utils.errorResponse('标签不存在', 404);
        }
        
        if (existingTag.created_by !== user.id && !existingTag.is_official) {
            const userPermissions = JSON.parse(user.permissions || '[]');
            if (!userPermissions.includes('admin') && !userPermissions.includes('tag_manage')) {
                return utils.errorResponse('无权修改此标签', 403);
            }
        }
        
        const body = await request.json().catch(() => ({}));
        const { name, description, color, isActive } = body;
        
        if (name !== undefined) {
            const trimmedName = name.trim();
            if (trimmedName.length < 2 || trimmedName.length > 20) {
                return utils.errorResponse('标签名称长度必须在2-20个字符之间', 400);
            }
            
            const duplicateTag = await env.DB.prepare(`
                SELECT id FROM community_source_tags 
                WHERE LOWER(tag_name) = LOWER(?) AND id != ?
            `).bind(trimmedName, tagId).first();
            
            if (duplicateTag) {
                return utils.errorResponse('标签名称已存在，请使用其他名称', 400);
            }
        }
        
        let validColor = existingTag.tag_color;
        if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
            validColor = color;
        } else if (color) {
            return utils.errorResponse('颜色格式不正确', 400);
        }
        
        const now = Date.now();
        
        const updates = [];
        const params = [];
        
        if (name !== undefined && name.trim() !== existingTag.tag_name) {
            updates.push('tag_name = ?');
            params.push(name.trim());
        }
        
        if (description !== undefined && description.trim() !== (existingTag.tag_description || '')) {
            updates.push('tag_description = ?');
            params.push(description.trim());
        }
        
        if (color !== undefined && color !== existingTag.tag_color) {
            updates.push('tag_color = ?');
            params.push(validColor);
        }
        
        if (isActive !== undefined && Boolean(isActive) !== Boolean(existingTag.tag_active)) {
            updates.push('tag_active = ?');
            params.push(isActive ? 1 : 0);
        }
        
        if (updates.length === 0) {
            return utils.errorResponse('没有需要更新的内容', 400);
        }
        
        updates.push('updated_at = ?');
        params.push(now);
        params.push(tagId);
        
        const updateQuery = `
            UPDATE community_source_tags 
            SET ${updates.join(', ')}
            WHERE id = ?
        `;
        
        await env.DB.prepare(updateQuery).bind(...params).run();
        
        await utils.logUserAction(env, user.id, 'tag_updated', {
            tagId,
            tagName: name || existingTag.tag_name,
            changes: {
                name: name !== undefined && name.trim() !== existingTag.tag_name,
                description: description !== undefined,
                color: color !== undefined,
                isActive: isActive !== undefined
            }
        }, request);
        
        return utils.successResponse({
            message: '标签更新成功',
            tagId,
            updatedFields: Object.keys(body).filter(key => ['name', 'description', 'color', 'isActive'].includes(key))
        });
        
    } catch (error) {
        console.error('更新标签失败:', error);
        
        let errorMessage = '更新标签失败';
        if (error.message.includes('UNIQUE constraint')) {
            errorMessage = '标签名称已存在，请使用其他名称';
        } else {
            errorMessage += ': ' + error.message;
        }
        
        return utils.errorResponse(errorMessage, 500);
    }
}

// 删除标签
export async function communityDeleteTagHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const tagId = request.params.id;
        
        if (!tagId) {
            return utils.errorResponse('标签ID不能为空', 400);
        }
        
        const existingTag = await env.DB.prepare(`
            SELECT * FROM community_source_tags WHERE id = ?
        `).bind(tagId).first();
        
        if (!existingTag) {
            return utils.errorResponse('标签不存在', 404);
        }
        
        if (existingTag.created_by !== user.id) {
            return utils.errorResponse('无权删除此标签', 403);
        }
        
        if (existingTag.is_official) {
            return utils.errorResponse('不能删除官方标签', 403);
        }
        
        if (existingTag.usage_count > 0) {
            return utils.errorResponse('不能删除正在使用的标签', 400);
        }
        
        await env.DB.prepare(`
            DELETE FROM community_source_tags WHERE id = ?
        `).bind(tagId).run();
        
        await utils.logUserAction(env, user.id, 'tag_deleted', {
            tagId,
            tagName: existingTag.tag_name
        }, request);
        
        return utils.successResponse({
            message: '标签删除成功',
            deletedId: tagId
        });
        
    } catch (error) {
        console.error('删除标签失败:', error);
        return utils.errorResponse('删除标签失败: ' + error.message, 500);
    }
}

// ===================== 社区搜索源相关 =====================

// 获取社区搜索源列表
export async function communityGetSourcesHandler(request, env) {
    try {
        const url = new URL(request.url);
        const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1);
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = (page - 1) * limit;
        
        const category = url.searchParams.get('category') || 'all';
        const sortBy = url.searchParams.get('sort') || 'created_at';
        const order = url.searchParams.get('order') || 'desc';
        const search = url.searchParams.get('search');
        const tags = url.searchParams.get('tags');
        const featured = url.searchParams.get('featured') === 'true';
        const author = url.searchParams.get('author');
        
        console.log('获取社区搜索源列表:', { 
            page, limit, category, sortBy, order, search, author, featured, tags
        });
        
        let whereConditions = ['css.status = ?'];
        let params = ['active'];
        
        if (category !== 'all') {
            whereConditions.push('css.source_category = ?');
            params.push(category);
        }
        
        if (search && search.trim()) {
            whereConditions.push('(css.source_name LIKE ? OR css.description LIKE ?)');
            const searchPattern = `%${search.trim()}%`;
            params.push(searchPattern, searchPattern);
        }
        
        if (author && author.trim()) {
            whereConditions.push('u.username = ?');
            params.push(author.trim());
        }
        
        if (featured) {
            whereConditions.push('css.is_featured = ?');
            params.push(1);
        }
        
        if (tags && tags.trim()) {
            const tagIds = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            
            if (tagIds.length > 0) {
                console.log('按标签过滤，标签IDs:', tagIds);
                
                const tagConditions = tagIds.map(() => 
                    `JSON_EXTRACT(css.tags, '$') LIKE ?`
                ).join(' OR ');
                
                whereConditions.push(`(${tagConditions})`);
                
                tagIds.forEach(tagId => {
                    params.push(`%"${tagId}"%`);
                });
            }
        }
        
        const validSortColumns = ['created_at', 'updated_at', 'rating_score', 'download_count', 'like_count', 'view_count'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
        `;
        const countResult = await env.DB.prepare(countQuery).bind(...params).first();
        const total = countResult.total || 0;
        
        const dataQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY css.${sortColumn} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const result = await env.DB.prepare(dataQuery).bind(...params, limit, offset).all();
        
        const allTagIds = [];
        result.results.forEach(source => {
            try {
                const tagIds = source.tags ? JSON.parse(source.tags) : [];
                allTagIds.push(...tagIds);
            } catch (e) {
                console.warn('解析标签ID失败:', e);
            }
        });
        
        const uniqueTagIds = [...new Set(allTagIds)];
        let tagMap = new Map();
        
    if (uniqueTagIds.length > 0) {
    const tagQuery = `
        SELECT id, tag_name as name, tag_color as color, is_official 
        FROM community_source_tags 
        WHERE id IN (${uniqueTagIds.map(() => '?').join(',')}) AND tag_active = 1
    `;
    const tagResult = await env.DB.prepare(tagQuery).bind(...uniqueTagIds).all();
    
    tagResult.results.forEach(tag => {
        tagMap.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            isOfficial: Boolean(tag.is_official)
        });
    });
}
        
        const sources = result.results.map(source => {
            let sourceTags = [];
            
            try {
                const tagIds = source.tags ? JSON.parse(source.tags) : [];
                sourceTags = tagIds.map(tagId => {
                    const tagInfo = tagMap.get(tagId);
                    return tagInfo || {
                        id: tagId,
                        name: `未知标签-${tagId.slice(0, 8)}`,
                        color: '#6b7280',
                        isOfficial: false
                    };
                }).slice(0, 5);
            } catch (e) {
                console.warn('处理源标签时出错:', e);
                sourceTags = [];
            }
            
            return {
                id: source.id,
                name: source.source_name,
                subtitle: source.source_subtitle,
                icon: source.source_icon,
                urlTemplate: source.source_url_template,
                category: source.source_category,
                description: source.description,
                tags: sourceTags,
                author: {
                    id: source.user_id,
                    name: source.author_name
                },
                stats: {
                    downloads: source.download_count || 0,
                    likes: source.like_count || 0,
                    views: source.view_count || 0,
                    rating: source.rating_score || 0,
                    reviewCount: source.review_count || 0
                },
                isVerified: Boolean(source.is_verified),
                isFeatured: Boolean(source.is_featured),
                createdAt: source.created_at,
                updatedAt: source.updated_at,
                lastTestedAt: source.last_tested_at
            };
        });
        
        const totalPages = Math.ceil(total / limit);
        
        return utils.successResponse({
            sources,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: offset + limit < total,
                hasPrev: page > 1
            },
            filters: {
                category,
                search,
                author,
                featured,
                tags,
                sort: sortBy,
                order
            }
        });
        
    } catch (error) {
        console.error('获取社区搜索源列表失败:', error);
        return utils.errorResponse('获取搜索源列表失败: ' + error.message, 500);
    }
}

// 创建社区搜索源
export async function communityCreateSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const body = await request.json().catch(() => ({}));
        const { name, subtitle, icon, urlTemplate, category, description, tags } = body;
        
        const missingFields = utils.validateRequiredParams(body, ['name', 'urlTemplate', 'category']);
        if (missingFields.length > 0) {
            return utils.errorResponse(`缺少必填字段: ${missingFields.join(', ')}`);
        }
        
        if (!urlTemplate.includes('{keyword}')) {
            return utils.errorResponse('URL模板必须包含{keyword}占位符');
        }
        
        try {
            new URL(urlTemplate.replace('{keyword}', 'test'));
        } catch (error) {
            return utils.errorResponse('URL格式无效');
        }
        
        const userShareCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM community_shared_sources 
            WHERE user_id = ? AND status IN ('active', 'pending')
        `).bind(user.id).first();
        
        const maxShares = parseInt(env.COMMUNITY_MAX_SHARES_PER_USER || '50');
        if (userShareCount.count >= maxShares) {
            return utils.errorResponse(`每个用户最多只能分享${maxShares}个搜索源`);
        }
        
        const existingSource = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE (source_name = ? OR source_url_template = ?) 
            AND status = 'active'
        `).bind(name, urlTemplate).first();
        
        if (existingSource) {
            return utils.errorResponse('相同名称或URL的搜索源已存在');
        }
        
        let processedTagIds = [];
if (Array.isArray(tags) && tags.length > 0) {
    const validTags = tags.slice(0, 10);
    
    if (validTags.length > 0) {
        const tagQuery = `
            SELECT id FROM community_source_tags 
            WHERE id IN (${validTags.map(() => '?').join(',')}) 
            AND tag_active = 1
        `;
        const tagResult = await env.DB.prepare(tagQuery).bind(...validTags).all();
        processedTagIds = tagResult.results.map(tag => tag.id);
    }
}
        
        const sourceId = utils.generateId();
        const now = Date.now();
        
        await env.DB.prepare(`
            INSERT INTO community_shared_sources (
                id, user_id, source_name, source_subtitle, source_icon, 
                source_url_template, source_category, description, tags,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            sourceId, user.id, name.trim(), subtitle?.trim() || null, 
            icon?.trim() || '🔍', urlTemplate.trim(), category, 
            description?.trim() || null, JSON.stringify(processedTagIds),
            env.COMMUNITY_REQUIRE_APPROVAL === 'true' ? 'pending' : 'active',
            now, now
        ).run();
        
        if (processedTagIds.length > 0) {
            for (const tagId of processedTagIds) {
                await env.DB.prepare(`
                    UPDATE community_source_tags 
                    SET usage_count = usage_count + 1, updated_at = ?
                    WHERE id = ?
                `).bind(now, tagId).run();
            }
        }
        
        await utils.logUserAction(env, user.id, 'community_source_shared', {
            sourceId,
            sourceName: name,
            category,
            tagsCount: processedTagIds.length
        }, request);
        
        const status = env.COMMUNITY_REQUIRE_APPROVAL === 'true' ? 'pending' : 'active';
        const message = status === 'pending' ? 
            '搜索源已提交，等待管理员审核' : 
            '搜索源分享成功';
        
        return utils.successResponse({
            message,
            sourceId,
            status
        });
        
    } catch (error) {
        console.error('分享搜索源失败:', error);
        return utils.errorResponse('分享搜索源失败: ' + error.message, 500);
    }
}

// 获取搜索源详情
export async function communityGetSourceDetailHandler(request, env) {
    try {
        const sourceId = request.params.id;
        
        await env.DB.prepare(`
            UPDATE community_shared_sources 
            SET view_count = view_count + 1 
            WHERE id = ?
        `).bind(sourceId).run();
        
        const sourceResult = await env.DB.prepare(`
            SELECT 
                css.*,
                u.username as author_name,
                u.id as author_id,
                cus.reputation_score as author_reputation,
                cus.shared_sources_count as author_total_shares
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            LEFT JOIN community_user_stats cus ON css.user_id = cus.user_id
            WHERE css.id = ? AND css.status = ?
        `).bind(sourceId, 'active').first();
        
        if (!sourceResult) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        const reviewsResult = await env.DB.prepare(`
            SELECT 
                csr.*,
                CASE WHEN csr.is_anonymous = 1 THEN '匿名用户' ELSE u.username END as reviewer_name
            FROM community_source_reviews csr
            LEFT JOIN users u ON csr.user_id = u.id
            WHERE csr.shared_source_id = ?
            ORDER BY csr.created_at DESC
            LIMIT 10
        `).bind(sourceId).all();
        
        const reviews = reviewsResult.results.map(review => ({
            id: review.id,
            rating: review.rating,
            comment: review.comment,
            reviewerName: review.reviewer_name,
            isAnonymous: Boolean(review.is_anonymous),
            createdAt: review.created_at
        }));
        
        let tagDetails = [];
        const tagIds = sourceResult.tags ? JSON.parse(sourceResult.tags) : [];
        
if (tagIds.length > 0) {
    const tagQuery = `
        SELECT id, tag_name as name, tag_description as description, 
               tag_color as color, is_official, usage_count 
        FROM community_source_tags 
        WHERE id IN (${tagIds.map(() => '?').join(',')}) AND tag_active = 1
    `;
    const tagResult = await env.DB.prepare(tagQuery).bind(...tagIds).all();
    
    tagDetails = tagResult.results.map(tag => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        color: tag.color,
        isOfficial: Boolean(tag.is_official),
        usageCount: tag.usage_count || 0
    }));
}
        
        const source = {
            id: sourceResult.id,
            name: sourceResult.source_name,
            subtitle: sourceResult.source_subtitle,
            icon: sourceResult.source_icon,
            urlTemplate: sourceResult.source_url_template,
            category: sourceResult.source_category,
            description: sourceResult.description,
            tags: tagDetails,
            author: {
                id: sourceResult.author_id,
                name: sourceResult.author_name,
                reputation: sourceResult.author_reputation || 0,
                totalShares: sourceResult.author_total_shares || 0
            },
            stats: {
                downloads: sourceResult.download_count,
                likes: sourceResult.like_count,
                views: sourceResult.view_count,
                rating: sourceResult.rating_score,
                reviewCount: sourceResult.rating_count
            },
            reviews,
            isVerified: Boolean(sourceResult.is_verified),
            isFeatured: Boolean(sourceResult.is_featured),
            createdAt: sourceResult.created_at,
            updatedAt: sourceResult.updated_at,
            lastTestedAt: sourceResult.last_tested_at
        };
        
        return utils.successResponse({ source });
        
    } catch (error) {
        console.error('获取搜索源详情失败:', error);
        return utils.errorResponse('获取搜索源详情失败', 500);
    }
}

// 更新搜索源
export async function communityUpdateSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params?.id;
        
        if (!sourceId || sourceId.length < 10) {
            return utils.errorResponse('搜索源ID无效', 400);
        }

        const existingSource = await env.DB.prepare(`
            SELECT * FROM community_shared_sources 
            WHERE id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
        
        if (!existingSource) {
            return utils.errorResponse('搜索源不存在或您无权编辑', 404);
        }

        const body = await request.json().catch(() => ({}));
        const { name, subtitle, icon, description, tags, category } = body;

        if (!name || name.trim().length < 2) {
            return utils.errorResponse('搜索源名称至少需要2个字符', 400);
        }

        if (category && !['jav', 'movie', 'torrent', 'other'].includes(category)) {
            return utils.errorResponse('无效的分类', 400);
        }

        let processedTagIds = [];
if (Array.isArray(tags)) {
    const validTags = tags.slice(0, 10).filter(tagId => tagId && typeof tagId === 'string');
    
    if (validTags.length > 0) {
        const tagQuery = `
            SELECT id FROM community_source_tags 
            WHERE id IN (${validTags.map(() => '?').join(',')}) 
            AND tag_active = 1
        `;
        const tagResult = await env.DB.prepare(tagQuery).bind(...validTags).all();
        processedTagIds = tagResult.results.map(tag => tag.id);
    }
}

        const now = Date.now();
        
        await env.DB.prepare(`
            UPDATE community_shared_sources SET
                source_name = ?,
                source_subtitle = ?,
                source_icon = ?,
                description = ?,
                tags = ?,
                source_category = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
        `).bind(
            name.trim(),
            subtitle?.trim() || existingSource.source_subtitle,
            icon?.trim() || existingSource.source_icon,
            description?.trim() || existingSource.description,
            JSON.stringify(processedTagIds),
            category || existingSource.source_category,
            now,
            sourceId,
            user.id
        ).run();

        await utils.logUserAction(env, user.id, 'community_source_edited', {
            sourceId,
            sourceName: name,
            changes: {
                name: name !== existingSource.source_name,
                subtitle: subtitle !== existingSource.source_subtitle,
                description: description !== existingSource.description,
                tags: JSON.stringify(processedTagIds) !== existingSource.tags,
                category: category !== existingSource.source_category
            }
        }, request);

        return utils.successResponse({
            message: '搜索源更新成功',
            sourceId,
            updatedFields: Object.keys(body).filter(key => ['name', 'subtitle', 'icon', 'description', 'tags', 'category'].includes(key))
        });

    } catch (error) {
        console.error('编辑搜索源失败:', error);
        
        let errorMessage = '编辑搜索源失败';
        if (error.message.includes('UNIQUE constraint')) {
            errorMessage = '搜索源名称已存在，请使用其他名称';
        } else if (error.message.includes('FOREIGN KEY')) {
            errorMessage = '所选标签不存在，请重新选择';
        } else {
            errorMessage += ': ' + error.message;
        }
        
        return utils.errorResponse(errorMessage, 500);
    }
}

// 删除搜索源
export async function communityDeleteSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        let sourceId = request.params?.id;
        
        if (!sourceId) {
            const url = new URL(request.url);
            const pathParts = url.pathname.split('/');
            sourceId = pathParts[pathParts.length - 1];
        }
        
        console.log('删除搜索源ID:', sourceId);
        
        if (!sourceId || sourceId.length < 10) {
            return utils.errorResponse('搜索源ID无效', 400);
        }

        const source = await env.DB.prepare(`
            SELECT id, user_id, source_name FROM community_shared_sources 
            WHERE id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在或您无权删除', 404);
        }
        
        console.log('找到要删除的搜索源:', source.source_name);
        
        const deleteOperations = [];
        
        try {
            const reviewsResult = await env.DB.prepare(`
                DELETE FROM community_source_reviews WHERE shared_source_id = ?
            `).bind(sourceId).run();
            deleteOperations.push(`删除评论记录: ${reviewsResult.changes}`);
            
            const likesResult = await env.DB.prepare(`
                DELETE FROM community_source_likes WHERE shared_source_id = ?
            `).bind(sourceId).run();
            deleteOperations.push(`删除点赞记录: ${likesResult.changes}`);
            
            const downloadsResult = await env.DB.prepare(`
                DELETE FROM community_source_downloads WHERE shared_source_id = ?
            `).bind(sourceId).run();
            deleteOperations.push(`删除下载记录: ${downloadsResult.changes}`);
            
            const reportsResult = await env.DB.prepare(`
                DELETE FROM community_source_reports WHERE shared_source_id = ?
            `).bind(sourceId).run();
            deleteOperations.push(`删除举报记录: ${reportsResult.changes}`);
            
            const sourceResult = await env.DB.prepare(`
                DELETE FROM community_shared_sources WHERE id = ? AND user_id = ?
            `).bind(sourceId, user.id).run();
            deleteOperations.push(`删除搜索源记录: ${sourceResult.changes}`);
            
            if (sourceResult.changes === 0) {
                throw new Error('删除失败：记录不存在或已被删除');
            }
            
            await updateUserStatsAfterDelete(env, user.id);
            
            console.log('删除操作完成:', deleteOperations);
            
            await utils.logUserAction(env, user.id, 'community_source_deleted', {
                sourceId,
                sourceName: source.source_name,
                deleteOperations
            }, request).catch(error => {
                console.warn('记录用户行为失败:', error);
            });
            
            return utils.successResponse({
                message: '搜索源删除成功',
                deletedId: sourceId,
                sourceName: source.source_name,
                operations: deleteOperations
            });
            
        } catch (deleteError) {
            console.error('执行删除操作时发生错误:', deleteError);
            throw deleteError;
        }
        
    } catch (error) {
        console.error('删除搜索源总体失败:', error);
        
        let errorMessage = '删除搜索源失败';
        
        if (error.message.includes('GREATEST')) {
            errorMessage = '数据库函数不兼容，系统正在修复中，请稍后重试';
        } else if (error.message.includes('FOREIGN KEY')) {
            errorMessage = '无法删除：存在关联数据，请先处理相关内容';
        } else if (error.message.includes('SQLITE_CONSTRAINT')) {
            errorMessage = '删除失败：数据约束冲突';
        } else if (error.message.includes('database is locked')) {
            errorMessage = '数据库忙碌，请稍后重试';
        } else if (error.message.includes('no such table')) {
            errorMessage = '数据库表不存在，请联系管理员';
        } else {
            errorMessage += ': ' + error.message;
        }
        
        return utils.errorResponse(errorMessage, 500);
    }
}

// 下载搜索源
export async function communityDownloadSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        
        const source = await env.DB.prepare(`
            SELECT * FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        const downloadId = utils.generateId();
        const ip = utils.getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || '';
        
        await env.DB.prepare(`
            INSERT INTO community_source_downloads (
                id, shared_source_id, user_id, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(downloadId, sourceId, user.id, ip, userAgent, Date.now()).run();
        
        const userSettings = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();
        
        const settings = userSettings ? JSON.parse(userSettings.settings || '{}') : {};
        const customSources = settings.customSearchSources || [];
        
        const newSourceId = `community_${sourceId}_${Date.now()}`;
        
        const newCustomSource = {
            id: newSourceId,
            name: source.source_name,
            subtitle: source.source_subtitle,
            icon: source.source_icon,
            urlTemplate: source.source_url_template,
            category: source.source_category,
            isCustom: true,
            isFromCommunity: true,
            communitySourceId: sourceId,
            createdAt: Date.now()
        };
        
        customSources.push(newCustomSource);
        
        const enabledSources = settings.searchSources || [];
        if (!enabledSources.includes(newSourceId)) {
            enabledSources.push(newSourceId);
        }
        
        const updatedSettings = {
            ...settings,
            customSearchSources: customSources,
            searchSources: enabledSources
        };
        
        await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();
        
        await utils.logUserAction(env, user.id, 'community_source_downloaded', {
            sourceId,
            sourceName: source.source_name,
            newSourceId
        }, request);
        
        return utils.successResponse({
            message: '搜索源已添加到您的自定义搜索源',
            newSourceId,
            source: newCustomSource
        });
        
    } catch (error) {
        console.error('下载搜索源失败:', error);
        return utils.errorResponse('下载搜索源失败: ' + error.message, 500);
    }
}

// 点赞搜索源
export async function communityLikeSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const likeType = body.type || 'like';
        
        if (!['like', 'favorite', 'bookmark'].includes(likeType)) {
            return utils.errorResponse('无效的操作类型');
        }
        
        const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        const existingLike = await env.DB.prepare(`
            SELECT id FROM community_source_likes 
            WHERE shared_source_id = ? AND user_id = ? AND like_type = ?
        `).bind(sourceId, user.id, likeType).first();
        
        if (existingLike) {
            await env.DB.prepare(`
                DELETE FROM community_source_likes 
                WHERE id = ?
            `).bind(existingLike.id).run();
            
            return utils.successResponse({
                message: `已取消${likeType === 'like' ? '点赞' : '收藏'}`,
                action: 'removed'
            });
        } else {
            const likeId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO community_source_likes (
                    id, shared_source_id, user_id, like_type, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `).bind(likeId, sourceId, user.id, likeType, Date.now()).run();
            
            return utils.successResponse({
                message: `${likeType === 'like' ? '点赞' : '收藏'}成功`,
                action: 'added'
            });
        }
        
    } catch (error) {
        console.error('点赞/收藏失败:', error);
        return utils.errorResponse('操作失败: ' + error.message, 500);
    }
}

// 评价搜索源
export async function communityReviewSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const { rating, comment, isAnonymous } = body;
        
        if (!rating || rating < 1 || rating > 5) {
            return utils.errorResponse('评分必须在1-5之间');
        }
        
        const source = await env.DB.prepare(`
            SELECT id, user_id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        if (source.user_id === user.id) {
            return utils.errorResponse('不能评价自己分享的搜索源');
        }
        
        const existingReview = await env.DB.prepare(`
            SELECT id FROM community_source_reviews 
            WHERE shared_source_id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
        
        if (existingReview) {
            await env.DB.prepare(`
                UPDATE community_source_reviews 
                SET rating = ?, comment = ?, is_anonymous = ?, updated_at = ?
                WHERE id = ?
            `).bind(rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), existingReview.id).run();
            
            return utils.successResponse({
                message: '评价更新成功'
            });
        } else {
            const reviewId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO community_source_reviews (
                    id, shared_source_id, user_id, rating, comment, is_anonymous, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(reviewId, sourceId, user.id, rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), Date.now()).run();
            
            return utils.successResponse({
                message: '评价提交成功'
            });
        }
        
    } catch (error) {
        console.error('提交评价失败:', error);
        return utils.errorResponse('提交评价失败: ' + error.message, 500);
    }
}

// 举报搜索源
export async function communityReportSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const sourceId = request.params.id;
        const body = await request.json().catch(() => ({}));
        const { reason, details } = body;
        
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
            return utils.errorResponse('举报原因不能为空');
        }
        
        const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources WHERE id = ?
        `).bind(sourceId).first();
        
        if (!source) {
            return utils.errorResponse('搜索源不存在', 404);
        }
        
        const reportId = utils.generateId();
        await env.DB.prepare(`
            INSERT INTO community_source_reports (
                id, shared_source_id, reporter_user_id, report_reason, 
                report_details, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(reportId, sourceId, user.id, reason.trim(), details?.trim() || null, 'pending', Date.now(), Date.now()).run();
        
        return utils.successResponse({
            message: '举报已提交，我们会尽快处理'
        });
        
    } catch (error) {
        console.error('提交举报失败:', error);
        return utils.errorResponse('提交举报失败: ' + error.message, 500);
    }
}

// 用户社区统计
export async function communityUserStatsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse('认证失败', 401);
    
    try {
        const statsResult = await env.DB.prepare(`
            SELECT * FROM community_user_stats WHERE user_id = ?
        `).bind(user.id).first();
        
        const sharedSourcesResult = await env.DB.prepare(`
            SELECT 
                id, source_name, source_category, download_count, 
                like_count, view_count, rating_score, status, created_at
            FROM community_shared_sources 
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 10
        `).bind(user.id).all();
        
        const realTimeStats = await env.DB.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM community_shared_sources WHERE user_id = ? AND status = 'active') as shared_count,
                (SELECT COUNT(*) FROM community_source_downloads csd 
                 JOIN community_shared_sources css ON csd.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active') as total_downloads,
                (SELECT COUNT(*) FROM community_source_likes csl 
                 JOIN community_shared_sources css ON csl.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active' AND csl.like_type = 'like') as total_likes,
                (SELECT COALESCE(SUM(view_count), 0) FROM community_shared_sources 
                 WHERE user_id = ? AND status = 'active') as total_views,
                (SELECT COUNT(*) FROM community_source_reviews WHERE user_id = ?) as reviews_given,
                (SELECT COUNT(DISTINCT shared_source_id) FROM community_source_downloads WHERE user_id = ?) as sources_downloaded,
                (SELECT COUNT(*) FROM community_source_tags WHERE created_by = ? AND tag_active = 1) as tags_created
        `).bind(user.id, user.id, user.id, user.id, user.id, user.id, user.id).first();
        
        const useRealTime = !statsResult || 
            Math.abs((statsResult.total_downloads || 0) - realTimeStats.total_downloads) > 1 ||
            Math.abs((statsResult.total_likes || 0) - realTimeStats.total_likes) > 1 ||
            Math.abs((statsResult.total_views || 0) - realTimeStats.total_views) > 5;
        
        const stats = {
            general: {
                sharedSources: useRealTime ? realTimeStats.shared_count : (statsResult?.shared_sources_count || 0),
                totalDownloads: useRealTime ? realTimeStats.total_downloads : (statsResult?.total_downloads || 0),
                totalLikes: useRealTime ? realTimeStats.total_likes : (statsResult?.total_likes || 0),
                totalViews: useRealTime ? realTimeStats.total_views : (statsResult?.total_views || 0),
                reviewsGiven: useRealTime ? realTimeStats.reviews_given : (statsResult?.reviews_given || 0),
                sourcesDownloaded: useRealTime ? realTimeStats.sources_downloaded : (statsResult?.sources_downloaded || 0),
                tagsCreated: useRealTime ? realTimeStats.tags_created : (statsResult?.tags_created || 0),
                reputationScore: statsResult?.reputation_score || 0,
                contributionLevel: statsResult?.contribution_level || 'beginner'
            },
            recentShares: sharedSourcesResult.results.map(source => ({
                id: source.id,
                name: source.source_name,
                category: source.source_category,
                downloads: source.download_count,
                likes: source.like_count,
                views: source.view_count,
                rating: source.rating_score,
                status: source.status,
                createdAt: source.created_at
            }))
        };
        
        if (useRealTime && statsResult) {
            console.log('检测到统计数据不一致，触发缓存更新');
            env.DB.prepare(`
                UPDATE community_user_stats 
                SET total_downloads = ?, total_likes = ?, total_views = ?, tags_created = ?, updated_at = ?
                WHERE user_id = ?
            `).bind(
                realTimeStats.total_downloads,
                realTimeStats.total_likes,
                realTimeStats.total_views,
                realTimeStats.tags_created,
                Date.now(),
                user.id
            ).run().catch(error => {
                console.error('更新用户统计缓存失败:', error);
            });
        }
        
        return utils.successResponse({ stats });
        
    } catch (error) {
        console.error('获取用户统计失败:', error);
        return utils.errorResponse('获取用户统计失败', 500);
    }
}

// 社区搜索
export async function communitySearchHandler(request, env) {
    try {
        const url = new URL(request.url);
        const query = url.searchParams.get('q');
        const category = url.searchParams.get('category') || 'all';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 20);
        const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);
        
        if (!query || query.trim().length < 1) {
            return utils.errorResponse('搜索关键词不能为空');
        }
        
        const trimmedQuery = query.trim();
        console.log('搜索社区内容:', { query: trimmedQuery, category, limit });
        
        let whereConditions = ['css.status = ?'];
        let params = ['active'];
        
        whereConditions.push(`(
            css.source_name LIKE ? OR 
            css.description LIKE ? OR 
            css.source_subtitle LIKE ? OR
            EXISTS (
                SELECT 1 FROM community_source_tags cst 
                WHERE cst.tag_name LIKE ? AND 
                JSON_EXTRACT(css.tags, '$[*]') LIKE '%' || cst.id || '%'
            )
        )`);
        
        const searchPattern = `%${trimmedQuery}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        
        if (category && category !== 'all') {
            whereConditions.push('css.source_category = ?');
            params.push(category);
        }
        
        const searchQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count,
                (
                    CASE 
                        WHEN css.source_name LIKE ? THEN 3
                        WHEN css.source_subtitle LIKE ? THEN 2
                        WHEN css.description LIKE ? THEN 1
                        ELSE 0
                    END
                ) as relevance_score
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY 
                relevance_score DESC,
                css.is_featured DESC,
                css.rating_score DESC,
                css.download_count DESC,
                css.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const finalParams = [searchPattern, searchPattern, searchPattern, ...params, limit, offset];
        
        const result = await env.DB.prepare(searchQuery).bind(...finalParams).all();
        
        const countQuery = `
            SELECT COUNT(*) as total
            FROM community_shared_sources css
            WHERE ${whereConditions.join(' AND ')}
        `;
        
        const countResult = await env.DB.prepare(countQuery).bind(...params).first();
        const total = countResult?.total || 0;
        
        const sources = result.results.map(source => ({
            id: source.id,
            name: source.source_name,
            subtitle: source.source_subtitle,
            icon: source.source_icon,
            urlTemplate: source.source_url_template,
            category: source.source_category,
            description: source.description,
            tags: source.tags ? JSON.parse(source.tags) : [],
            author: {
                id: source.user_id,
                name: source.author_name
            },
            stats: {
                downloads: source.download_count,
                likes: source.like_count,
                views: source.view_count,
                rating: source.rating_score,
                reviewCount: source.review_count
            },
            isVerified: Boolean(source.is_verified),
            isFeatured: Boolean(source.is_featured),
            createdAt: source.created_at,
            relevanceScore: source.relevance_score
        }));
        
        console.log(`搜索完成: 找到 ${sources.length} 个结果，总计 ${total} 个`);
        
        return utils.successResponse({ 
            sources, 
            query: trimmedQuery,
            total,
            limit,
            offset,
            hasMore: (offset + limit) < total,
            category
        });
        
    } catch (error) {
        console.error('搜索社区搜索源失败:', error);
        return utils.errorResponse('搜索失败: ' + error.message, 500);
    }
}