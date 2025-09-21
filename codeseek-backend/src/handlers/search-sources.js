// src/handlers/search-sources.js - 优化版本：增强验证和错误处理
import { utils } from '../utils.js';
import { authenticate } from '../middleware.js';
import { searchSourcesService } from '../services/search-sources-service.js';

// ===================== 搜索源大类管理 =====================

// 获取所有搜索源大类
export async function getMajorCategoriesHandler(request, env) {
    try {
        const result = await searchSourcesService.getAllMajorCategories(env);
        return utils.successResponse(result);
    } catch (error) {
        console.error('获取搜索源大类失败:', error);
        return utils.errorResponse('获取搜索源大类失败', 500);
    }
}

// 创建搜索源大类 (需要管理员权限)
export async function createMajorCategoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    // 简单的管理员检查 - 实际项目中应该有更完善的权限系统
    if (!user.permissions.includes('admin') && !user.permissions.includes('search_source_management')) {
        return utils.errorResponse('权限不足', 403);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { name, description, icon, color, requiresKeyword } = body;

        // 增强输入验证
        const validation = validateMajorCategoryInput({ name, description, icon, color, requiresKeyword });
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const majorCategoryData = {
            name: name.trim(),
            description: description?.trim() || '',
            icon: icon?.trim() || '🌟',
            color: color?.trim() || '#6b7280',
            requiresKeyword: requiresKeyword !== false
        };

        const result = await searchSourcesService.createMajorCategory(env, majorCategoryData, user.id);
        
        await utils.logUserAction(env, user.id, 'major_category_create', {
            majorCategoryId: result.id,
            majorCategoryName: result.name
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('创建搜索源大类失败:', error);
        return utils.errorResponse('创建搜索源大类失败: ' + error.message, 500);
    }
}

// ===================== 搜索源分类管理 =====================

// 获取用户的搜索源分类
export async function getSourceCategoriesHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const majorCategoryId = url.searchParams.get('majorCategory');
        const includeSystem = url.searchParams.get('includeSystem') !== 'false';

        const result = await searchSourcesService.getUserSourceCategories(
            env, 
            user.id, 
            { majorCategoryId, includeSystem }
        );
        
        return utils.successResponse(result);
    } catch (error) {
        console.error('获取搜索源分类失败:', error);
        return utils.errorResponse('获取搜索源分类失败', 500);
    }
}

// 创建搜索源分类
export async function createSourceCategoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const {
            majorCategoryId,
            name,
            description,
            icon,
            color,
            defaultSearchable,
            defaultSiteType,
            searchPriority,
            supportsDetailExtraction,
            extractionPriority
        } = body;

        // 增强输入验证
        const validation = validateCategoryInput(body);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const categoryData = {
            majorCategoryId: majorCategoryId.trim(),
            name: name.trim(),
            description: description?.trim() || '',
            icon: icon?.trim() || '📁',
            color: color?.trim() || '#3b82f6',
            defaultSearchable: defaultSearchable !== false,
            defaultSiteType: defaultSiteType || 'search',
            searchPriority: Math.min(Math.max(parseInt(searchPriority) || 5, 1), 10),
            supportsDetailExtraction: supportsDetailExtraction === true,
            extractionPriority: extractionPriority || 'medium'
        };

        const result = await searchSourcesService.createSourceCategory(env, categoryData, user.id);
        
        await utils.logUserAction(env, user.id, 'source_category_create', {
            categoryId: result.id,
            categoryName: result.name,
            majorCategoryId: result.majorCategoryId
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('创建搜索源分类失败:', error);
        return utils.errorResponse('创建搜索源分类失败: ' + error.message, 500);
    }
}

// 更新搜索源分类
export async function updateSourceCategoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const categoryId = request.params?.id;
        if (!categoryId) {
            return utils.errorResponse('分类ID不能为空', 400);
        }

        const body = await request.json().catch(() => ({}));
        
        // 增强输入验证
        const validation = validateCategoryUpdateInput(body);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const updateData = {};

        // 允许更新的字段
        const allowedFields = [
            'name', 'description', 'icon', 'color', 
            'defaultSearchable', 'defaultSiteType', 'searchPriority',
            'supportsDetailExtraction', 'extractionPriority'
        ];

        allowedFields.forEach(field => {
            if (body.hasOwnProperty(field)) {
                if (field === 'searchPriority') {
                    updateData[field] = Math.min(Math.max(parseInt(body[field]) || 5, 1), 10);
                } else if (typeof body[field] === 'string') {
                    updateData[field] = body[field].trim();
                } else {
                    updateData[field] = body[field];
                }
            }
        });

        if (Object.keys(updateData).length === 0) {
            return utils.errorResponse('没有提供要更新的数据', 400);
        }

        const result = await searchSourcesService.updateSourceCategory(env, categoryId, updateData, user.id);
        
        await utils.logUserAction(env, user.id, 'source_category_update', {
            categoryId,
            updatedFields: Object.keys(updateData)
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('更新搜索源分类失败:', error);
        return utils.errorResponse('更新搜索源分类失败: ' + error.message, 500);
    }
}

// 删除搜索源分类
export async function deleteSourceCategoryHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const categoryId = request.params?.id;
        if (!categoryId) {
            return utils.errorResponse('分类ID不能为空', 400);
        }

        const result = await searchSourcesService.deleteSourceCategory(env, categoryId, user.id);
        
        await utils.logUserAction(env, user.id, 'source_category_delete', {
            categoryId,
            categoryName: result.deletedCategory.name
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('删除搜索源分类失败:', error);
        return utils.errorResponse('删除搜索源分类失败: ' + error.message, 500);
    }
}

// ===================== 搜索源管理 =====================

// 获取用户的搜索源
export async function getSearchSourcesHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const url = new URL(request.url);
        const categoryId = url.searchParams.get('category');
        const majorCategoryId = url.searchParams.get('majorCategory');
        const searchable = url.searchParams.get('searchable');
        const includeSystem = url.searchParams.get('includeSystem') !== 'false';
        const enabledOnly = url.searchParams.get('enabledOnly') === 'true';

        const filters = {
            categoryId,
            majorCategoryId,
            searchable: searchable === 'true' ? true : searchable === 'false' ? false : null,
            includeSystem,
            enabledOnly
        };

        const result = await searchSourcesService.getUserSearchSources(env, user.id, filters);
        
        return utils.successResponse(result);
    } catch (error) {
        console.error('获取搜索源失败:', error);
        return utils.errorResponse('获取搜索源失败', 500);
    }
}

// 创建搜索源
export async function createSearchSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        
        // 增强输入验证
        const validation = validateSourceInput(body);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const {
            categoryId,
            name,
            subtitle,
            description,
            icon,
            urlTemplate,
            homepageUrl,
            siteType,
            searchable,
            requiresKeyword,
            searchPriority,
            supportsDetailExtraction,
            extractionQuality,
            supportedFeatures
        } = body;

        const sourceData = {
            categoryId: categoryId.trim(),
            name: name.trim(),
            subtitle: subtitle?.trim() || '',
            description: description?.trim() || '',
            icon: icon?.trim() || '🔍',
            urlTemplate: urlTemplate.trim(),
            homepageUrl: homepageUrl?.trim() || '',
            siteType: siteType || 'search',
            searchable: searchable !== false,
            requiresKeyword: requiresKeyword !== false,
            searchPriority: Math.min(Math.max(parseInt(searchPriority) || 5, 1), 10),
            supportsDetailExtraction: supportsDetailExtraction === true,
            extractionQuality: extractionQuality || 'none',
            supportedFeatures: Array.isArray(supportedFeatures) ? supportedFeatures : []
        };

        const result = await searchSourcesService.createSearchSource(env, sourceData, user.id);
        
        await utils.logUserAction(env, user.id, 'search_source_create', {
            sourceId: result.id,
            sourceName: result.name,
            categoryId: result.categoryId
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('创建搜索源失败:', error);
        return utils.errorResponse('创建搜索源失败: ' + error.message, 500);
    }
}

// 更新搜索源
export async function updateSearchSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const sourceId = request.params?.id;
        if (!sourceId) {
            return utils.errorResponse('搜索源ID不能为空', 400);
        }

        const body = await request.json().catch(() => ({}));
        
        // 增强输入验证
        const validation = validateSourceUpdateInput(body);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const updateData = {};

        // 允许更新的字段
        const allowedFields = [
            'categoryId', 'name', 'subtitle', 'description', 'icon', 
            'urlTemplate', 'homepageUrl', 'siteType', 'searchable', 
            'requiresKeyword', 'searchPriority', 'supportsDetailExtraction',
            'extractionQuality', 'supportedFeatures'
        ];

        allowedFields.forEach(field => {
            if (body.hasOwnProperty(field)) {
                if (field === 'searchPriority') {
                    updateData[field] = Math.min(Math.max(parseInt(body[field]) || 5, 1), 10);
                } else if (field === 'supportedFeatures') {
                    updateData[field] = Array.isArray(body[field]) ? body[field] : [];
                } else if (typeof body[field] === 'string') {
                    updateData[field] = body[field].trim();
                } else {
                    updateData[field] = body[field];
                }
            }
        });

        if (Object.keys(updateData).length === 0) {
            return utils.errorResponse('没有提供要更新的数据', 400);
        }

        const result = await searchSourcesService.updateSearchSource(env, sourceId, updateData, user.id);
        
        await utils.logUserAction(env, user.id, 'search_source_update', {
            sourceId,
            updatedFields: Object.keys(updateData)
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('更新搜索源失败:', error);
        return utils.errorResponse('更新搜索源失败: ' + error.message, 500);
    }
}

// 删除搜索源
export async function deleteSearchSourceHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const sourceId = request.params?.id;
        if (!sourceId) {
            return utils.errorResponse('搜索源ID不能为空', 400);
        }

        const result = await searchSourcesService.deleteSearchSource(env, sourceId, user.id);
        
        await utils.logUserAction(env, user.id, 'search_source_delete', {
            sourceId,
            sourceName: result.deletedSource.name
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('删除搜索源失败:', error);
        return utils.errorResponse('删除搜索源失败: ' + error.message, 500);
    }
}

// ===================== 用户搜索源配置管理 =====================

// 获取用户搜索源配置
export async function getUserSourceConfigsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await searchSourcesService.getUserSourceConfigs(env, user.id);
        return utils.successResponse(result);
    } catch (error) {
        console.error('获取用户搜索源配置失败:', error);
        return utils.errorResponse('获取用户搜索源配置失败', 500);
    }
}

// 更新用户搜索源配置
export async function updateUserSourceConfigHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        
        // 增强输入验证
        const validation = validateUserConfigInput(body);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const { sourceId, isEnabled, customPriority, customName, customSubtitle, customIcon, notes } = body;

        const configData = {
            sourceId: sourceId.trim(),
            isEnabled: isEnabled !== false,
            customPriority: customPriority ? Math.min(Math.max(parseInt(customPriority), 1), 10) : null,
            customName: customName?.trim() || null,
            customSubtitle: customSubtitle?.trim() || null,
            customIcon: customIcon?.trim() || null,
            notes: notes?.trim() || null
        };

        const result = await searchSourcesService.updateUserSourceConfig(env, user.id, configData);
        
        await utils.logUserAction(env, user.id, 'user_source_config_update', {
            sourceId,
            isEnabled: configData.isEnabled
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('更新用户搜索源配置失败:', error);
        return utils.errorResponse('更新用户搜索源配置失败: ' + error.message, 500);
    }
}

// 批量更新用户搜索源配置
export async function batchUpdateUserSourceConfigsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const body = await request.json().catch(() => ({}));
        const { configs } = body;

        // 增强输入验证
        const validation = validateBatchConfigInput(configs);
        if (!validation.valid) {
            return utils.errorResponse(validation.error, 400);
        }

        const result = await searchSourcesService.batchUpdateUserSourceConfigs(env, user.id, configs);
        
        await utils.logUserAction(env, user.id, 'user_source_configs_batch_update', {
            configCount: configs.length,
            enabledCount: configs.filter(c => c.isEnabled !== false).length
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('批量更新用户搜索源配置失败:', error);
        return utils.errorResponse('批量更新用户搜索源配置失败: ' + error.message, 500);
    }
}

// ===================== 搜索源统计和导入导出 =====================

// 获取搜索源统计信息
export async function getSearchSourceStatsHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await searchSourcesService.getSearchSourceStats(env, user.id);
        return utils.successResponse(result);
    } catch (error) {
        console.error('获取搜索源统计信息失败:', error);
        return utils.errorResponse('获取搜索源统计信息失败', 500);
    }
}

// 导出用户搜索源配置
export async function exportUserSearchSourcesHandler(request, env) {
    const user = await authenticate(request, env);
    if (!user) {
        return utils.errorResponse('认证失败', 401);
    }

    try {
        const result = await searchSourcesService.exportUserSearchSources(env, user.id);
        
        await utils.logUserAction(env, user.id, 'search_sources_export', {
            exportedCount: result.sources?.length || 0
        }, request);

        return utils.successResponse(result);
    } catch (error) {
        console.error('导出搜索源配置失败:', error);
        return utils.errorResponse('导出搜索源配置失败', 500);
    }
}

// ===================== 验证函数 =====================

// 验证大类输入
function validateMajorCategoryInput(data) {
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        return { valid: false, error: '大类名称不能为空' };
    }

    if (data.name.length > 30) {
        return { valid: false, error: '大类名称不能超过30个字符' };
    }

    if (data.description && data.description.length > 100) {
        return { valid: false, error: '大类描述不能超过100个字符' };
    }

    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
        return { valid: false, error: '颜色格式不正确' };
    }

    return { valid: true };
}

// 验证分类输入
function validateCategoryInput(data) {
    if (!data.majorCategoryId || typeof data.majorCategoryId !== 'string') {
        return { valid: false, error: '大类ID不能为空' };
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        return { valid: false, error: '分类名称不能为空' };
    }

    if (data.name.length > 30) {
        return { valid: false, error: '分类名称不能超过30个字符' };
    }

    if (data.description && data.description.length > 100) {
        return { valid: false, error: '分类描述不能超过100个字符' };
    }

    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
        return { valid: false, error: '颜色格式不正确' };
    }

    if (data.searchPriority && (data.searchPriority < 1 || data.searchPriority > 10)) {
        return { valid: false, error: '搜索优先级必须在1-10之间' };
    }

    const validSiteTypes = ['search', 'browse', 'reference'];
    if (data.defaultSiteType && !validSiteTypes.includes(data.defaultSiteType)) {
        return { valid: false, error: '网站类型必须是search、browse或reference' };
    }

    const validExtractionPriorities = ['high', 'medium', 'low', 'none'];
    if (data.extractionPriority && !validExtractionPriorities.includes(data.extractionPriority)) {
        return { valid: false, error: '提取优先级必须是high、medium、low或none' };
    }

    return { valid: true };
}

// 验证分类更新输入
function validateCategoryUpdateInput(data) {
    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
        return { valid: false, error: '分类名称不能为空' };
    }

    if (data.name && data.name.length > 30) {
        return { valid: false, error: '分类名称不能超过30个字符' };
    }

    if (data.description && data.description.length > 100) {
        return { valid: false, error: '分类描述不能超过100个字符' };
    }

    if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
        return { valid: false, error: '颜色格式不正确' };
    }

    return { valid: true };
}

// 验证搜索源输入
function validateSourceInput(data) {
    if (!data.categoryId || typeof data.categoryId !== 'string') {
        return { valid: false, error: '分类ID不能为空' };
    }

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        return { valid: false, error: '搜索源名称不能为空' };
    }

    if (data.name.length > 50) {
        return { valid: false, error: '搜索源名称不能超过50个字符' };
    }

    if (!data.urlTemplate || typeof data.urlTemplate !== 'string' || data.urlTemplate.trim().length === 0) {
        return { valid: false, error: 'URL模板不能为空' };
    }

    // 验证URL格式
    if (!/^https?:\/\/.+/.test(data.urlTemplate)) {
        return { valid: false, error: 'URL模板格式不正确' };
    }

    // 如果是搜索源，必须包含{keyword}
    if (data.searchable !== false && !data.urlTemplate.includes('{keyword}')) {
        return { valid: false, error: '搜索源的URL模板必须包含{keyword}占位符' };
    }

    if (data.subtitle && data.subtitle.length > 100) {
        return { valid: false, error: '搜索源副标题不能超过100个字符' };
    }

    if (data.description && data.description.length > 200) {
        return { valid: false, error: '搜索源描述不能超过200个字符' };
    }

    const validSiteTypes = ['search', 'browse', 'reference'];
    if (data.siteType && !validSiteTypes.includes(data.siteType)) {
        return { valid: false, error: '网站类型必须是search、browse或reference' };
    }

    const validExtractionQualities = ['excellent', 'good', 'fair', 'poor', 'none'];
    if (data.extractionQuality && !validExtractionQualities.includes(data.extractionQuality)) {
        return { valid: false, error: '提取质量必须是excellent、good、fair、poor或none' };
    }

    return { valid: true };
}

// 验证搜索源更新输入
function validateSourceUpdateInput(data) {
    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
        return { valid: false, error: '搜索源名称不能为空' };
    }

    if (data.name && data.name.length > 50) {
        return { valid: false, error: '搜索源名称不能超过50个字符' };
    }

    if (data.urlTemplate && !/^https?:\/\/.+/.test(data.urlTemplate)) {
        return { valid: false, error: 'URL模板格式不正确' };
    }

    return { valid: true };
}

// 验证用户配置输入
function validateUserConfigInput(data) {
    if (!data.sourceId || typeof data.sourceId !== 'string') {
        return { valid: false, error: '搜索源ID不能为空' };
    }

    if (data.customPriority && (data.customPriority < 1 || data.customPriority > 10)) {
        return { valid: false, error: '自定义优先级必须在1-10之间' };
    }

    if (data.customName && data.customName.length > 50) {
        return { valid: false, error: '自定义名称不能超过50个字符' };
    }

    if (data.customSubtitle && data.customSubtitle.length > 100) {
        return { valid: false, error: '自定义副标题不能超过100个字符' };
    }

    if (data.notes && data.notes.length > 500) {
        return { valid: false, error: '备注不能超过500个字符' };
    }

    return { valid: true };
}

// 验证批量配置输入
function validateBatchConfigInput(configs) {
    if (!Array.isArray(configs) || configs.length === 0) {
        return { valid: false, error: '配置列表不能为空' };
    }

    if (configs.length > 100) {
        return { valid: false, error: '批量更新不能超过100个配置' };
    }

    for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        const validation = validateUserConfigInput(config);
        if (!validation.valid) {
            return { valid: false, error: `第${i + 1}个配置: ${validation.error}` };
        }
    }

    return { valid: true };
}