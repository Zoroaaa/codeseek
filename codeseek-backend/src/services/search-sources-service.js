// src/services/search-sources-service.js - 优化版本：修复前后端字段匹配问题，确保所有分类字段正确返回
import { utils } from '../utils.js';
import { CONFIG } from '../constants.js';

class SearchSourcesService {
    
    // ===================== 搜索源大类管理 =====================

    // 获取所有大类
    async getAllMajorCategories(env) {
        try {
            const result = await env.DB.prepare(`
                SELECT * FROM search_major_categories 
                WHERE is_active = 1 
                ORDER BY display_order ASC, created_at ASC
            `).all();

            return {
                majorCategories: (result.results || []).map(cat => this.formatMajorCategory(cat))
            };
        } catch (error) {
            console.error('获取搜索源大类失败:', error);
            throw new Error('获取搜索源大类失败');
        }
    }

    // 创建大类
    async createMajorCategory(env, majorCategoryData, creatorId) {
        try {
            // 检查名称是否已存在
            const existing = await env.DB.prepare(`
                SELECT id FROM search_major_categories 
                WHERE name = ? AND is_active = 1
            `).bind(majorCategoryData.name).first();

            if (existing) {
                throw new Error('大类名称已存在');
            }

            const majorCategoryId = utils.generateId();
            const now = Date.now();

            await env.DB.prepare(`
                INSERT INTO search_major_categories (
                    id, name, description, icon, color, requires_keyword,
                    display_order, is_system, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                majorCategoryId,
                majorCategoryData.name,
                majorCategoryData.description || '',
                majorCategoryData.icon || '🌟',
                majorCategoryData.color || '#6b7280',
                majorCategoryData.requiresKeyword ? 1 : 0,
                999, // 新创建的排在最后
                0, // 用户创建的非系统大类
                1, // 激活状态
                now,
                now
            ).run();

            return this.formatMajorCategory({
                id: majorCategoryId,
                name: majorCategoryData.name,
                description: majorCategoryData.description || '',
                icon: majorCategoryData.icon || '🌟',
                color: majorCategoryData.color || '#6b7280',
                requires_keyword: majorCategoryData.requiresKeyword ? 1 : 0,
                display_order: 999,
                is_system: 0,
                is_active: 1,
                created_at: now,
                updated_at: now
            });
        } catch (error) {
            console.error('创建搜索源大类失败:', error);
            throw error;
        }
    }

    // ===================== 搜索源分类管理 =====================

    // 获取用户的搜索源分类
    async getUserSourceCategories(env, userId, options = {}) {
        try {
            const { majorCategoryId, includeSystem = true } = options;
            
            let query = `
                SELECT sc.*, mc.name as major_category_name, mc.icon as major_category_icon
                FROM search_source_categories sc
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE sc.is_active = 1
            `;
            const params = [];

            if (majorCategoryId) {
                query += ` AND sc.major_category_id = ?`;
                params.push(majorCategoryId);
            }

            if (!includeSystem) {
                query += ` AND (sc.is_system = 0 OR sc.created_by = ?)`;
                params.push(userId);
            }

            query += ` ORDER BY sc.display_order ASC, sc.created_at ASC`;

            const result = await env.DB.prepare(query).bind(...params).all();

            return {
                categories: (result.results || []).map(cat => this.formatSourceCategory(cat))
            };
        } catch (error) {
            console.error('获取搜索源分类失败:', error);
            throw new Error('获取搜索源分类失败');
        }
    }

    // 创建搜索源分类
    async createSourceCategory(env, categoryData, creatorId) {
        try {
            // 验证大类是否存在
            const majorCategory = await env.DB.prepare(`
                SELECT id FROM search_major_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryData.majorCategoryId).first();

            if (!majorCategory) {
                throw new Error('指定的大类不存在');
            }

            // 检查分类名称是否已存在（在同一大类下）
            const existing = await env.DB.prepare(`
                SELECT id FROM search_source_categories 
                WHERE major_category_id = ? AND name = ? AND is_active = 1
            `).bind(categoryData.majorCategoryId, categoryData.name).first();

            if (existing) {
                throw new Error('在该大类下分类名称已存在');
            }

            const categoryId = utils.generateId();
            const now = Date.now();

            await env.DB.prepare(`
                INSERT INTO search_source_categories (
                    id, major_category_id, name, description, icon, color,
                    display_order, is_system, is_active, default_searchable,
                    default_site_type, search_priority, supports_detail_extraction,
                    extraction_priority, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                categoryId,
                categoryData.majorCategoryId,
                categoryData.name,
                categoryData.description || '',
                categoryData.icon || '📁',
                categoryData.color || '#3b82f6',
                999, // 新创建的排在最后
                0, // 用户创建的非系统分类
                1, // 激活状态
                categoryData.defaultSearchable ? 1 : 0,
                categoryData.defaultSiteType || 'search',
                categoryData.searchPriority || 5,
                categoryData.supportsDetailExtraction ? 1 : 0,
                categoryData.extractionPriority || 'medium',
                creatorId,
                now,
                now
            ).run();

            return this.formatSourceCategory({
                id: categoryId,
                major_category_id: categoryData.majorCategoryId,
                name: categoryData.name,
                description: categoryData.description || '',
                icon: categoryData.icon || '📁',
                color: categoryData.color || '#3b82f6',
                display_order: 999,
                is_system: 0,
                is_active: 1,
                default_searchable: categoryData.defaultSearchable ? 1 : 0,
                default_site_type: categoryData.defaultSiteType || 'search',
                search_priority: categoryData.searchPriority || 5,
                supports_detail_extraction: categoryData.supportsDetailExtraction ? 1 : 0,
                extraction_priority: categoryData.extractionPriority || 'medium',
                created_by: creatorId,
                created_at: now,
                updated_at: now
            });
        } catch (error) {
            console.error('创建搜索源分类失败:', error);
            throw error;
        }
    }

    // 更新搜索源分类
    async updateSourceCategory(env, categoryId, updateData, userId) {
        try {
            // 验证分类是否存在且用户有权限修改
            const category = await env.DB.prepare(`
                SELECT * FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryId).first();

            if (!category) {
                throw new Error('搜索源分类不存在');
            }

            // 系统分类只能由管理员修改
            if (category.is_system && category.created_by !== userId) {
                // 简单的权限检查，实际项目中应该有更完善的权限系统
                throw new Error('无权限修改系统分类');
            }

            // 自定义分类只能由创建者修改
            if (!category.is_system && category.created_by !== userId) {
                throw new Error('无权限修改此分类');
            }

            // 如果要修改名称，检查是否重复
            if (updateData.name && updateData.name !== category.name) {
                const existing = await env.DB.prepare(`
                    SELECT id FROM search_source_categories 
                    WHERE major_category_id = ? AND name = ? AND id != ? AND is_active = 1
                `).bind(category.major_category_id, updateData.name, categoryId).first();

                if (existing) {
                    throw new Error('分类名称已存在');
                }
            }

            // 构建更新语句
            const updateFields = [];
            const updateValues = [];

            Object.keys(updateData).forEach(field => {
                const dbField = this.convertCategoryFieldToDb(field);
                if (dbField) {
                    updateFields.push(`${dbField} = ?`);
                    updateValues.push(updateData[field]);
                }
            });

            updateFields.push('updated_at = ?');
            updateValues.push(Date.now());
            updateValues.push(categoryId);

            await env.DB.prepare(`
                UPDATE search_source_categories 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `).bind(...updateValues).run();

            // 返回更新后的分类
            const updatedCategory = await env.DB.prepare(`
                SELECT sc.*, mc.name as major_category_name, mc.icon as major_category_icon
                FROM search_source_categories sc
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE sc.id = ?
            `).bind(categoryId).first();

            return {
                category: this.formatSourceCategory(updatedCategory)
            };
        } catch (error) {
            console.error('更新搜索源分类失败:', error);
            throw error;
        }
    }

    // 删除搜索源分类
    async deleteSourceCategory(env, categoryId, userId) {
        try {
            // 验证分类是否存在且用户有权限删除
            const category = await env.DB.prepare(`
                SELECT * FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryId).first();

            if (!category) {
                throw new Error('搜索源分类不存在');
            }

            // 系统分类不能删除
            if (category.is_system) {
                throw new Error('系统分类不能删除');
            }

            // 自定义分类只能由创建者删除
            if (category.created_by !== userId) {
                throw new Error('无权限删除此分类');
            }

            // 检查是否有搜索源使用此分类
            const sourcesUsingCategory = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM search_sources 
                WHERE category_id = ? AND is_active = 1
            `).bind(categoryId).first();

            if (sourcesUsingCategory.count > 0) {
                throw new Error(`无法删除分类，还有 ${sourcesUsingCategory.count} 个搜索源正在使用此分类`);
            }

            // 软删除分类
            await env.DB.prepare(`
                UPDATE search_source_categories 
                SET is_active = 0, updated_at = ?
                WHERE id = ?
            `).bind(Date.now(), categoryId).run();

            return {
                message: '搜索源分类删除成功',
                deletedCategory: {
                    id: category.id,
                    name: category.name
                }
            };
        } catch (error) {
            console.error('删除搜索源分类失败:', error);
            throw error;
        }
    }

    // ===================== 搜索源管理 =====================

    // 获取用户的搜索源
    async getUserSearchSources(env, userId, filters = {}) {
        try {
            const { categoryId, majorCategoryId, searchable, includeSystem = true, enabledOnly = false } = filters;
            
            let query = `
                SELECT 
                    ss.*,
                    sc.name as category_name,
                    sc.icon as category_icon,
                    sc.major_category_id,
                    mc.name as major_category_name,
                    mc.icon as major_category_icon,
                    usc.is_enabled as user_enabled,
                    usc.custom_priority,
                    usc.custom_name,
                    usc.custom_subtitle,
                    usc.custom_icon,
                    usc.notes as user_notes
                FROM search_sources ss
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                LEFT JOIN user_search_source_configs usc ON ss.id = usc.source_id AND usc.user_id = ?
                WHERE ss.is_active = 1
            `;
            const params = [userId];

            if (categoryId) {
                query += ` AND ss.category_id = ?`;
                params.push(categoryId);
            }

            if (majorCategoryId) {
                query += ` AND sc.major_category_id = ?`;
                params.push(majorCategoryId);
            }

            if (searchable !== null && searchable !== undefined) {
                query += ` AND ss.searchable = ?`;
                params.push(searchable ? 1 : 0);
            }

            if (!includeSystem) {
                query += ` AND (ss.is_system = 0 OR ss.created_by = ?)`;
                params.push(userId);
            }

            if (enabledOnly) {
                query += ` AND (usc.is_enabled = 1 OR (usc.is_enabled IS NULL AND ss.is_system = 1 AND ss.searchable = 1))`;
            }

            query += ` ORDER BY 
                COALESCE(usc.custom_priority, ss.search_priority) ASC, 
                ss.display_order ASC, 
                ss.created_at ASC`;

            const result = await env.DB.prepare(query).bind(...params).all();

            return {
                sources: (result.results || []).map(source => this.formatSearchSource(source))
            };
        } catch (error) {
            console.error('获取搜索源失败:', error);
            throw new Error('获取搜索源失败');
        }
    }

    // 创建搜索源
    async createSearchSource(env, sourceData, creatorId) {
        try {
            // 验证分类是否存在
            const category = await env.DB.prepare(`
                SELECT id FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(sourceData.categoryId).first();

            if (!category) {
                throw new Error('指定的分类不存在');
            }

            // 验证URL模板格式
            if (sourceData.searchable && !sourceData.urlTemplate.includes('{keyword}')) {
                throw new Error('搜索源的URL模板必须包含{keyword}占位符');
            }

            // 检查搜索源名称是否已存在
            const existing = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE name = ? AND is_active = 1
            `).bind(sourceData.name).first();

            if (existing) {
                throw new Error('搜索源名称已存在');
            }

            const sourceId = utils.generateId();
            const now = Date.now();

            await env.DB.prepare(`
                INSERT INTO search_sources (
                    id, category_id, name, subtitle, description, icon, url_template,
                    homepage_url, site_type, searchable, requires_keyword, search_priority,
                    supports_detail_extraction, extraction_quality, average_extraction_time,
                    supported_features, is_system, is_active, display_order, usage_count,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                sourceId,
                sourceData.categoryId,
                sourceData.name,
                sourceData.subtitle || '',
                sourceData.description || '',
                sourceData.icon || '🔍',
                sourceData.urlTemplate,
                sourceData.homepageUrl || '',
                sourceData.siteType || 'search',
                sourceData.searchable ? 1 : 0,
                sourceData.requiresKeyword ? 1 : 0,
                sourceData.searchPriority || 5,
                sourceData.supportsDetailExtraction ? 1 : 0,
                sourceData.extractionQuality || 'none',
                0, // 初始提取时间
                JSON.stringify(sourceData.supportedFeatures || []),
                0, // 用户创建的非系统源
                1, // 激活状态
                999, // 新创建的排在最后
                0, // 初始使用次数
                creatorId,
                now,
                now
            ).run();

            // 自动为用户创建配置（默认启用）
            await this.createUserSourceConfig(env, creatorId, sourceId, { isEnabled: true });

            return this.formatSearchSource({
                id: sourceId,
                category_id: sourceData.categoryId,
                name: sourceData.name,
                subtitle: sourceData.subtitle || '',
                description: sourceData.description || '',
                icon: sourceData.icon || '🔍',
                url_template: sourceData.urlTemplate,
                homepage_url: sourceData.homepageUrl || '',
                site_type: sourceData.siteType || 'search',
                searchable: sourceData.searchable ? 1 : 0,
                requires_keyword: sourceData.requiresKeyword ? 1 : 0,
                search_priority: sourceData.searchPriority || 5,
                supports_detail_extraction: sourceData.supportsDetailExtraction ? 1 : 0,
                extraction_quality: sourceData.extractionQuality || 'none',
                average_extraction_time: 0,
                supported_features: JSON.stringify(sourceData.supportedFeatures || []),
                is_system: 0,
                is_active: 1,
                display_order: 999,
                usage_count: 0,
                created_by: creatorId,
                created_at: now,
                updated_at: now,
                user_enabled: 1 // 默认启用
            });
        } catch (error) {
            console.error('创建搜索源失败:', error);
            throw error;
        }
    }

    // 更新搜索源
    async updateSearchSource(env, sourceId, updateData, userId) {
        try {
            // 验证搜索源是否存在且用户有权限修改
            const source = await env.DB.prepare(`
                SELECT * FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(sourceId).first();

            if (!source) {
                throw new Error('搜索源不存在');
            }

            // 系统搜索源只能由管理员修改
            if (source.is_system && source.created_by !== userId) {
                throw new Error('无权限修改系统搜索源');
            }

            // 自定义搜索源只能由创建者修改
            if (!source.is_system && source.created_by !== userId) {
                throw new Error('无权限修改此搜索源');
            }

            // 验证更新数据
            if (updateData.urlTemplate && updateData.searchable && !updateData.urlTemplate.includes('{keyword}')) {
                throw new Error('搜索源的URL模板必须包含{keyword}占位符');
            }

            // 如果要修改名称，检查是否重复
            if (updateData.name && updateData.name !== source.name) {
                const existing = await env.DB.prepare(`
                    SELECT id FROM search_sources 
                    WHERE name = ? AND id != ? AND is_active = 1
                `).bind(updateData.name, sourceId).first();

                if (existing) {
                    throw new Error('搜索源名称已存在');
                }
            }

            // 构建更新语句
            const updateFields = [];
            const updateValues = [];

            Object.keys(updateData).forEach(field => {
                const dbField = this.convertSourceFieldToDb(field);
                if (dbField) {
                    let value = updateData[field];
                    if (field === 'supportedFeatures') {
                        value = JSON.stringify(value);
                    } else if (typeof value === 'boolean') {
                        value = value ? 1 : 0;
                    }
                    updateFields.push(`${dbField} = ?`);
                    updateValues.push(value);
                }
            });

            updateFields.push('updated_at = ?');
            updateValues.push(Date.now());
            updateValues.push(sourceId);

            await env.DB.prepare(`
                UPDATE search_sources 
                SET ${updateFields.join(', ')}
                WHERE id = ?
            `).bind(...updateValues).run();

            // 返回更新后的搜索源
            const updatedSource = await env.DB.prepare(`
                SELECT 
                    ss.*,
                    sc.name as category_name,
                    sc.icon as category_icon,
                    sc.major_category_id,
                    mc.name as major_category_name,
                    mc.icon as major_category_icon
                FROM search_sources ss
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE ss.id = ?
            `).bind(sourceId).first();

            return {
                source: this.formatSearchSource(updatedSource)
            };
        } catch (error) {
            console.error('更新搜索源失败:', error);
            throw error;
        }
    }

    // 删除搜索源
    async deleteSearchSource(env, sourceId, userId) {
        try {
            // 验证搜索源是否存在且用户有权限删除
            const source = await env.DB.prepare(`
                SELECT * FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(sourceId).first();

            if (!source) {
                throw new Error('搜索源不存在');
            }

            // 系统搜索源不能删除
            if (source.is_system) {
                throw new Error('系统搜索源不能删除');
            }

            // 自定义搜索源只能由创建者删除
            if (source.created_by !== userId) {
                throw new Error('无权限删除此搜索源');
            }

            // 软删除搜索源
            await env.DB.prepare(`
                UPDATE search_sources 
                SET is_active = 0, updated_at = ?
                WHERE id = ?
            `).bind(Date.now(), sourceId).run();

            // 同时删除用户配置
            await env.DB.prepare(`
                DELETE FROM user_search_source_configs 
                WHERE source_id = ?
            `).bind(sourceId).run();

            return {
                message: '搜索源删除成功',
                deletedSource: {
                    id: source.id,
                    name: source.name
                }
            };
        } catch (error) {
            console.error('删除搜索源失败:', error);
            throw error;
        }
    }

    // ===================== 用户搜索源配置管理 =====================

    // 获取用户搜索源配置
    async getUserSourceConfigs(env, userId) {
        try {
            const result = await env.DB.prepare(`
                SELECT 
                    usc.*,
                    ss.name as source_name,
                    ss.icon as source_icon,
                    ss.is_system,
                    sc.name as category_name,
                    mc.name as major_category_name
                FROM user_search_source_configs usc
                LEFT JOIN search_sources ss ON usc.source_id = ss.id
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE usc.user_id = ? AND ss.is_active = 1
                ORDER BY usc.custom_priority ASC, ss.search_priority ASC, ss.display_order ASC
            `).bind(userId).all();

            return {
                configs: (result.results || []).map(config => this.formatUserSourceConfig(config))
            };
        } catch (error) {
            console.error('获取用户搜索源配置失败:', error);
            throw new Error('获取用户搜索源配置失败');
        }
    }

    // 创建或更新用户搜索源配置
    async updateUserSourceConfig(env, userId, configData) {
        try {
            // 验证搜索源是否存在
            const source = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(configData.sourceId).first();

            if (!source) {
                throw new Error('搜索源不存在');
            }

            const configId = utils.generateId();
            const now = Date.now();

            // 使用 INSERT OR REPLACE 语法
            await env.DB.prepare(`
                INSERT OR REPLACE INTO user_search_source_configs (
                    id, user_id, source_id, is_enabled, custom_priority,
                    custom_name, custom_subtitle, custom_icon, notes,
                    created_at, updated_at
                ) VALUES (
                    COALESCE((SELECT id FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?
                )
            `).bind(
                userId, configData.sourceId, configId, // for COALESCE id
                userId, configData.sourceId,
                configData.isEnabled ? 1 : 0,
                configData.customPriority,
                configData.customName,
                configData.customSubtitle,
                configData.customIcon,
                configData.notes,
                userId, configData.sourceId, now, // for COALESCE created_at
                now // updated_at
            ).run();

            return {
                message: '用户搜索源配置更新成功',
                config: {
                    userId,
                    sourceId: configData.sourceId,
                    isEnabled: configData.isEnabled,
                    customPriority: configData.customPriority,
                    customName: configData.customName,
                    customSubtitle: configData.customSubtitle,
                    customIcon: configData.customIcon,
                    notes: configData.notes
                }
            };
        } catch (error) {
            console.error('更新用户搜索源配置失败:', error);
            throw error;
        }
    }

    // 创建用户搜索源配置（内部方法）
    async createUserSourceConfig(env, userId, sourceId, configData) {
        const configId = utils.generateId();
        const now = Date.now();

        await env.DB.prepare(`
            INSERT OR IGNORE INTO user_search_source_configs (
                id, user_id, source_id, is_enabled, custom_priority,
                custom_name, custom_subtitle, custom_icon, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            configId, userId, sourceId,
            configData.isEnabled ? 1 : 0,
            configData.customPriority || null,
            configData.customName || null,
            configData.customSubtitle || null,
            configData.customIcon || null,
            configData.notes || null,
            now, now
        ).run();
    }

    // 批量更新用户搜索源配置
    async batchUpdateUserSourceConfigs(env, userId, configs) {
        try {
            // 验证所有搜索源是否存在
            const sourceIds = configs.map(c => c.sourceId);
            const validSources = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE id IN (${sourceIds.map(() => '?').join(',')}) AND is_active = 1
            `).bind(...sourceIds).all();

            if (validSources.results.length !== sourceIds.length) {
                throw new Error('部分搜索源不存在');
            }

            // 开始事务处理
            const stmt = env.DB.prepare(`
                INSERT OR REPLACE INTO user_search_source_configs (
                    id, user_id, source_id, is_enabled, custom_priority,
                    custom_name, custom_subtitle, custom_icon, notes,
                    created_at, updated_at
                ) VALUES (
                    COALESCE((SELECT id FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?
                )
            `);

            const now = Date.now();
            const promises = configs.map(config => {
                const configId = utils.generateId();
                return stmt.bind(
                    userId, config.sourceId, configId, // for COALESCE id
                    userId, config.sourceId,
                    config.isEnabled ? 1 : 0,
                    config.customPriority || null,
                    config.customName || null,
                    config.customSubtitle || null,
                    config.customIcon || null,
                    config.notes || null,
                    userId, config.sourceId, now, // for COALESCE created_at
                    now // updated_at
                ).run();
            });

            await Promise.all(promises);

            return {
                message: '批量更新用户搜索源配置成功',
                updatedCount: configs.length
            };
        } catch (error) {
            console.error('批量更新用户搜索源配置失败:', error);
            throw error;
        }
    }

    // ===================== 统计和导出功能 =====================

    // 获取搜索源统计信息
    async getSearchSourceStats(env, userId) {
        try {
            // 获取各类统计数据
            const [majorCategoriesCount, categoriesCount, sourcesCount, userConfigsCount] = await Promise.all([
                env.DB.prepare(`SELECT COUNT(*) as count FROM search_major_categories WHERE is_active = 1`).first(),
                env.DB.prepare(`SELECT COUNT(*) as count FROM search_source_categories WHERE is_active = 1`).first(),
                env.DB.prepare(`SELECT COUNT(*) as count FROM search_sources WHERE is_active = 1`).first(),
                env.DB.prepare(`SELECT COUNT(*) as count FROM user_search_source_configs WHERE user_id = ? AND is_enabled = 1`).bind(userId).first()
            ]);

            // 获取按大类的分布统计
            const majorCategoryStats = await env.DB.prepare(`
                SELECT 
                    mc.id,
                    mc.name,
                    mc.icon,
                    COUNT(DISTINCT sc.id) as categories_count,
                    COUNT(DISTINCT ss.id) as sources_count,
                    COUNT(DISTINCT CASE WHEN usc.is_enabled = 1 THEN usc.id END) as enabled_sources_count
                FROM search_major_categories mc
                LEFT JOIN search_source_categories sc ON mc.id = sc.major_category_id AND sc.is_active = 1
                LEFT JOIN search_sources ss ON sc.id = ss.category_id AND ss.is_active = 1
                LEFT JOIN user_search_source_configs usc ON ss.id = usc.source_id AND usc.user_id = ?
                WHERE mc.is_active = 1
                GROUP BY mc.id
                ORDER BY mc.display_order ASC
            `).bind(userId).all();

            return {
                overview: {
                    majorCategories: majorCategoriesCount.count,
                    categories: categoriesCount.count,
                    totalSources: sourcesCount.count,
                    enabledSources: userConfigsCount.count
                },
                majorCategoryStats: majorCategoryStats.results || []
            };
        } catch (error) {
            console.error('获取搜索源统计信息失败:', error);
            throw new Error('获取搜索源统计信息失败');
        }
    }

    // 导出用户搜索源配置
    async exportUserSearchSources(env, userId) {
        try {
            // 获取用户的所有配置和搜索源信息
            const sources = await this.getUserSearchSources(env, userId, { includeSystem: true });
            const configs = await this.getUserSourceConfigs(env, userId);
            const categories = await this.getUserSourceCategories(env, userId, { includeSystem: true });
            const majorCategories = await this.getAllMajorCategories(env);

            return {
                exportTime: new Date().toISOString(),
                userId,
                majorCategories: majorCategories.majorCategories,
                categories: categories.categories,
                sources: sources.sources,
                userConfigs: configs.configs,
                version: '2.3.1'
            };
        } catch (error) {
            console.error('导出用户搜索源配置失败:', error);
            throw new Error('导出用户搜索源配置失败');
        }
    }

    // ===================== 辅助方法 =====================

    // 格式化大类数据
    formatMajorCategory(data) {
        return {
            id: data.id,
            name: data.name,
            description: data.description || '',
            icon: data.icon || '🌟',
            color: data.color || '#6b7280',
            requiresKeyword: Boolean(data.requires_keyword),
            displayOrder: data.display_order || 999,
            isSystem: Boolean(data.is_system),
            isActive: Boolean(data.is_active),
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    // 格式化分类数据 - 🔴 确保返回所有必要字段
    formatSourceCategory(data) {
        return {
            id: data.id,
            majorCategoryId: data.major_category_id,
            majorCategoryName: data.major_category_name || '',
            majorCategoryIcon: data.major_category_icon || '🌟',
            name: data.name,
            description: data.description || '',
            icon: data.icon || '📁',
            color: data.color || '#3b82f6',
            displayOrder: data.display_order || 999,
            isSystem: Boolean(data.is_system),
            isActive: Boolean(data.is_active),
            // 🔴 确保搜索配置字段正确返回
            defaultSearchable: Boolean(data.default_searchable),
            defaultSiteType: data.default_site_type || 'search',
            searchPriority: data.search_priority || 5,
            supportsDetailExtraction: Boolean(data.supports_detail_extraction),
            extractionPriority: data.extraction_priority || 'medium',
            createdBy: data.created_by,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    // 格式化搜索源数据
    formatSearchSource(data) {
        return {
            id: data.id,
            categoryId: data.category_id,
            categoryName: data.category_name || '',
            categoryIcon: data.category_icon || '📁',
            majorCategoryId: data.major_category_id,
            majorCategoryName: data.major_category_name || '',
            majorCategoryIcon: data.major_category_icon || '🌟',
            name: data.custom_name || data.name,
            originalName: data.name,
            subtitle: data.custom_subtitle || data.subtitle || '',
            originalSubtitle: data.subtitle || '',
            description: data.description || '',
            icon: data.custom_icon || data.icon || '🔍',
            originalIcon: data.icon || '🔍',
            urlTemplate: data.url_template,
            homepageUrl: data.homepage_url || '',
            siteType: data.site_type || 'search',
            searchable: Boolean(data.searchable),
            requiresKeyword: Boolean(data.requires_keyword),
            searchPriority: data.custom_priority || data.search_priority || 5,
            originalPriority: data.search_priority || 5,
            supportsDetailExtraction: Boolean(data.supports_detail_extraction),
            extractionQuality: data.extraction_quality || 'none',
            averageExtractionTime: data.average_extraction_time || 0,
            supportedFeatures: this.parseJsonSafely(data.supported_features, []),
            isSystem: Boolean(data.is_system),
            isActive: Boolean(data.is_active),
            displayOrder: data.display_order || 999,
            usageCount: data.usage_count || 0,
            lastUsedAt: data.last_used_at,
            // 用户配置
            userEnabled: data.user_enabled !== null ? Boolean(data.user_enabled) : (data.is_system && data.searchable ? true : false),
            userNotes: data.user_notes || '',
            createdBy: data.created_by,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    // 格式化用户配置数据
    formatUserSourceConfig(data) {
        return {
            id: data.id,
            userId: data.user_id,
            sourceId: data.source_id,
            sourceName: data.source_name,
            sourceIcon: data.source_icon,
            isSystem: Boolean(data.is_system),
            categoryName: data.category_name,
            majorCategoryName: data.major_category_name,
            isEnabled: Boolean(data.is_enabled),
            customPriority: data.custom_priority,
            customName: data.custom_name,
            customSubtitle: data.custom_subtitle,
            customIcon: data.custom_icon,
            notes: data.notes || '',
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    }

    // 字段转换 - 分类
    convertCategoryFieldToDb(field) {
        const fieldMap = {
            'name': 'name',
            'description': 'description',
            'icon': 'icon',
            'color': 'color',
            'defaultSearchable': 'default_searchable',
            'defaultSiteType': 'default_site_type',
            'searchPriority': 'search_priority',
            'supportsDetailExtraction': 'supports_detail_extraction',
            'extractionPriority': 'extraction_priority'
        };
        return fieldMap[field];
    }

    // 字段转换 - 搜索源
    convertSourceFieldToDb(field) {
        const fieldMap = {
            'categoryId': 'category_id',
            'name': 'name',
            'subtitle': 'subtitle',
            'description': 'description',
            'icon': 'icon',
            'urlTemplate': 'url_template',
            'homepageUrl': 'homepage_url',
            'siteType': 'site_type',
            'searchable': 'searchable',
            'requiresKeyword': 'requires_keyword',
            'searchPriority': 'search_priority',
            'supportsDetailExtraction': 'supports_detail_extraction',
            'extractionQuality': 'extraction_quality',
            'supportedFeatures': 'supported_features'
        };
        return fieldMap[field];
    }

    // 安全解析JSON
    parseJsonSafely(jsonString, defaultValue = null) {
        try {
            return jsonString ? JSON.parse(jsonString) : defaultValue;
        } catch (error) {
            console.warn('JSON解析失败:', jsonString);
            return defaultValue;
        }
    }
}

// 导出服务实例
export const searchSourcesService = new SearchSourcesService();
export default searchSourcesService;