// src/services.js - 复杂的业务逻辑服务
import { utils } from './utils.js';

// 搜索源状态检查相关
export async function checkSingleSourceStatus(source, keyword, keywordHash, options = {}) {
    const { timeout, checkContentMatch, env } = options;
    const sourceId = source.id || source.name;
    const startTime = Date.now();
    
    try {
        // 检查缓存
        const cached = await getCachedSourceStatus(env, sourceId, keywordHash);
        if (cached && isCacheValid(cached)) {
            console.log(`使用缓存结果: ${sourceId}`);
            return {
                sourceId,
                sourceName: source.name,
                status: cached.status,
                available: cached.available,
                contentMatch: cached.content_match,
                responseTime: cached.response_time,
                lastChecked: cached.created_at,
                fromCache: true
            };
        }
        
        // 构建检查URL
        const checkUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(keyword));
        console.log(`检查URL: ${checkUrl}`);
        
        // 执行HTTP检查
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(checkUrl, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'User-Agent': 'MagnetSearch-StatusChecker/1.3.0',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
                'Cache-Control': 'no-cache'
            }
        });
        
        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;
        
        // 基础可用性检查
        const isAvailable = response.ok && response.status < 400;
        let contentMatch = false;
        let qualityScore = 0;
        let matchDetails = {};
        
        // 内容匹配检查
        if (isAvailable && checkContentMatch) {
            try {
                const content = await response.text();
                const matchResult = analyzePageContent(content, keyword, source);
                contentMatch = matchResult.hasMatch;
                qualityScore = matchResult.qualityScore;
                matchDetails = matchResult.details;
                
                console.log(`内容匹配检查 ${sourceId}: ${contentMatch ? '匹配' : '不匹配'}, 质量分数: ${qualityScore}`);
            } catch (contentError) {
                console.warn(`内容检查失败 ${sourceId}:`, contentError.message);
            }
        }
        
        // 确定最终状态
        let finalStatus = 'error';
        if (isAvailable) {
            if (checkContentMatch) {
                finalStatus = contentMatch ? 'available' : 'unavailable';
            } else {
                finalStatus = 'available';
            }
        } else if (response.status === 404) {
            finalStatus = 'unavailable';
        } else if (responseTime >= timeout * 0.9) {
            finalStatus = 'timeout';
        } else {
            finalStatus = 'unavailable';
        }
        
        const result = {
            sourceId,
            sourceName: source.name,
            status: finalStatus,
            available: finalStatus === 'available',
            contentMatch,
            responseTime,
            qualityScore,
            httpStatus: response.status,
            lastChecked: Date.now(),
            matchDetails,
            fromCache: false
        };
        
        // 异步保存到缓存
        saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
        
        return result;
        
    } catch (error) {
        const responseTime = Date.now() - startTime;
        
        console.error(`检查源失败 ${sourceId}:`, error.message);
        
        let status = 'error';
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            status = 'timeout';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            status = 'unavailable';
        }
        
        const result = {
            sourceId,
            sourceName: source.name,
            status,
            available: false,
            contentMatch: false,
            responseTime,
            qualityScore: 0,
            lastChecked: Date.now(),
            error: error.message,
            fromCache: false
        };
        
        // 异步保存错误结果到缓存
        saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
        
        return result;
    }
}

export function analyzePageContent(content, keyword, source) {
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    let qualityScore = 0;
    const details = {
        titleMatch: false,
        bodyMatch: false,
        exactMatch: false,
        partialMatch: false,
        resultCount: 0,
        keywordPositions: []
    };
    
    // 检查精确匹配
    if (lowerContent.includes(lowerKeyword)) {
        details.exactMatch = true;
        qualityScore += 50;
        
        // 找到所有关键词位置
        let position = 0;
        while ((position = lowerContent.indexOf(lowerKeyword, position)) !== -1) {
            details.keywordPositions.push(position);
            position += lowerKeyword.length;
        }
    }
    
    // 检查标题匹配
    const titleMatch = content.match(/<title[^>]*>([^<]*)</i);
    if (titleMatch && titleMatch[1].toLowerCase().includes(lowerKeyword)) {
        details.titleMatch = true;
        qualityScore += 30;
    }
    
    // 检查番号格式（如果是番号搜索）
    if (/^[A-Za-z]+-?\d+$/i.test(keyword)) {
        const numberPattern = keyword.replace('-', '-?');
        const regex = new RegExp(numberPattern, 'gi');
        const matches = content.match(regex);
        if (matches) {
            details.exactMatch = true;
            qualityScore += 40;
            details.resultCount = matches.length;
        }
    }
    
    // 检查部分匹配（关键词的各部分）
    if (!details.exactMatch && keyword.length > 3) {
        const parts = keyword.split(/[-_\s]+/);
        let partialMatches = 0;
        
        parts.forEach(part => {
            if (part.length > 2 && lowerContent.includes(part.toLowerCase())) {
                partialMatches++;
            }
        });
        
        if (partialMatches > 0) {
            details.partialMatch = true;
            qualityScore += Math.min(partialMatches * 10, 30);
        }
    }
    
    // 检查是否有搜索结果列表
    const resultIndicators = [
        /result/gi,
        /search.*result/gi,
        /找到.*结果/gi,
        /共.*条/gi,
        /<div[^>]*class[^>]*result/gi
    ];
    
    let resultCount = 0;
    resultIndicators.forEach(indicator => {
        const matches = content.match(indicator);
        if (matches) resultCount += matches.length;
    });
    
    if (resultCount > 0) {
        details.resultCount = resultCount;
        qualityScore += Math.min(resultCount * 5, 20);
    }
    
    // 检查是否是"无结果"页面
    const noResultIndicators = [
        /no.*result/gi,
        /not.*found/gi,
        /没有.*结果/gi,
        /未找到/gi,
        /暂无.*内容/gi
    ];
    
    const hasNoResultIndicator = noResultIndicators.some(indicator => 
        content.match(indicator)
    );
    
    if (hasNoResultIndicator) {
        qualityScore = Math.max(0, qualityScore - 30);
    }
    
    // 最终质量评分
    qualityScore = Math.min(100, Math.max(0, qualityScore));
    
    const hasMatch = details.exactMatch || (details.partialMatch && qualityScore > 20);
    
    return {
        hasMatch,
        qualityScore,
        details
    };
}

export async function updateTagUsageCount(env, tagIds, increment = 1) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
        return;
    }
    
    try {
        for (const tagId of tagIds) {
            if (tagId && typeof tagId === 'string') {
                await env.DB.prepare(`
                    UPDATE community_source_tags 
                    SET usage_count = usage_count + ?, updated_at = ?
                    WHERE id = ? AND tag_active = 1
                `).bind(increment, Date.now(), tagId).run();
            }
        }
    } catch (error) {
        console.error('更新标签使用统计失败:', error);
    }
}

// 缓存相关服务
export async function getCachedSourceStatus(env, sourceId, keywordHash) {
    try {
        return await env.DB.prepare(`
            SELECT * FROM source_status_cache 
            WHERE source_id = ? AND keyword_hash = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `).bind(sourceId, keywordHash).first();
    } catch (error) {
        console.error('获取缓存状态失败:', error);
        return null;
    }
}

export function isCacheValid(cached, maxAge = 300000) { // 5分钟默认缓存
    if (!cached) return false;
    return Date.now() - cached.created_at < maxAge;
}

export async function saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result) {
    try {
        const cacheId = utils.generateId();
        await env.DB.prepare(`
            INSERT INTO source_status_cache (
                id, source_id, keyword, keyword_hash, status, available, content_match,
                response_time, quality_score, match_details, page_info, check_error,
                expires_at, created_at, last_accessed, access_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            cacheId, sourceId, keyword, keywordHash, result.status,
            result.available ? 1 : 0, result.contentMatch ? 1 : 0,
            result.responseTime, result.qualityScore || 0,
            JSON.stringify(result.matchDetails || {}),
            JSON.stringify({ httpStatus: result.httpStatus }),
            result.error || null,
            Date.now() + 300000, // 5分钟后过期
            Date.now(), Date.now(), 1
        ).run();
    } catch (error) {
        console.error('保存缓存状态失败:', error);
    }
}

export async function saveStatusCheckResults(env, results, keyword) {
    try {
        // 更新健康度统计
        for (const result of results) {
            await updateSourceHealthStats(env, result);
        }
        
        console.log(`已保存 ${results.length} 个搜索源的状态检查结果`);
    } catch (error) {
        console.error('保存状态检查结果失败:', error);
    }
}

export async function updateSourceHealthStats(env, result) {
    try {
        const sourceId = result.sourceId;
        
        // 获取当前统计
        const currentStats = await env.DB.prepare(`
            SELECT * FROM source_health_stats WHERE source_id = ?
        `).bind(sourceId).first();
        
        if (currentStats) {
            // 更新现有统计
            const newTotalChecks = currentStats.total_checks + 1;
            const newSuccessfulChecks = currentStats.successful_checks + (result.available ? 1 : 0);
            const newContentMatches = currentStats.content_matches + (result.contentMatch ? 1 : 0);
            const newSuccessRate = newSuccessfulChecks / newTotalChecks;
            
            // 更新平均响应时间
            const newAvgResponseTime = Math.round(
                (currentStats.average_response_time * currentStats.total_checks + result.responseTime) / newTotalChecks
            );
            
            // 计算健康度分数
            const healthScore = Math.round(newSuccessRate * 100);
            
            await env.DB.prepare(`
                UPDATE source_health_stats SET
                    total_checks = ?, successful_checks = ?, content_matches = ?,
                    average_response_time = ?, success_rate = ?, health_score = ?,
                    last_success = ?, last_failure = ?, updated_at = ?
                WHERE source_id = ?
            `).bind(
                newTotalChecks, newSuccessfulChecks, newContentMatches,
                newAvgResponseTime, newSuccessRate, healthScore,
                result.available ? Date.now() : currentStats.last_success,
                result.available ? currentStats.last_failure : Date.now(),
                Date.now(), sourceId
            ).run();
        } else {
            // 创建新统计
            const statsId = utils.generateId();
            await env.DB.prepare(`
                INSERT INTO source_health_stats (
                    id, source_id, total_checks, successful_checks, content_matches,
                    average_response_time, last_success, last_failure, success_rate,
                    health_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                statsId, sourceId, 1, result.available ? 1 : 0, result.contentMatch ? 1 : 0,
                result.responseTime,
                result.available ? Date.now() : null,
                result.available ? null : Date.now(),
                result.available ? 1.0 : 0.0,
                result.available ? 100 : 0,
                Date.now()
            ).run();
        }
    } catch (error) {
        console.error('更新源健康度统计失败:', error);
    }
}

// 数据库操作服务
export async function updateUserStatsAfterDelete(env, userId) {
    try {
        // 重新计算用户的分享统计，避免使用触发器
        const realStats = await env.DB.prepare(`
            SELECT COUNT(*) as shared_count FROM community_shared_sources 
            WHERE user_id = ? AND status = 'active'
        `).bind(userId).first();
        
        // 更新或插入统计记录
        await env.DB.prepare(`
            INSERT OR REPLACE INTO community_user_stats (
                id, user_id, shared_sources_count, updated_at,
                total_downloads, total_likes, total_views, reviews_given,
                sources_downloaded, tags_created, reputation_score, contribution_level,
                created_at
            ) VALUES (
                COALESCE((SELECT id FROM community_user_stats WHERE user_id = ?), ? || '_stats'),
                ?,
                ?,
                ?,
                COALESCE((SELECT total_downloads FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT total_likes FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT total_views FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT reviews_given FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT sources_downloaded FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT tags_created FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT reputation_score FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT contribution_level FROM community_user_stats WHERE user_id = ?), 'beginner'),
                COALESCE((SELECT created_at FROM community_user_stats WHERE user_id = ?), strftime('%s', 'now') * 1000)
            )
        `).bind(
            userId, userId, // for id generation
            userId, // user_id
            realStats.shared_count || 0, // shared_sources_count
            Date.now(), // updated_at
            userId, userId, userId, userId, userId, userId, userId, userId, userId // for COALESCE selects
        ).run();
        
        console.log('用户统计更新成功，新的分享数:', realStats.shared_count);
        
    } catch (error) {
        console.error('更新用户统计失败:', error);
        // 不要抛出错误，避免影响主删除操作
    }
}