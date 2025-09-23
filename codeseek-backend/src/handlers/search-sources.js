// src/handlers/search-sources.js - 集成代理功能的搜索源处理器
import { authenticate } from '../utils/auth.js';
import * as utils from '../utils/response.js';
import { generateId } from '../utils/helpers.js';

// ===============================================
// 搜索源基础处理器 (保持原有功能)
// ===============================================

/**
 * 获取搜索源列表
 */
export async function getSearchSourcesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const url = new URL(request.url);
    const includeSystem = url.searchParams.get('includeSystem') !== 'false';
    const enabledOnly = url.searchParams.get('enabledOnly') === 'true';
    const searchable = url.searchParams.get('searchable');
    const categoryId = url.searchParams.get('categoryId');

    let query = `
      SELECT 
        ss.*,
        usc.is_enabled as user_enabled,
        usc.custom_priority,
        usc.custom_name,
        usc.custom_subtitle,
        usc.custom_icon,
        usc.notes,
        usc.use_proxy,
        usc.custom_proxy_url,
        usc.proxy_preference,
        usc.allow_fallback_direct
      FROM search_sources ss
      LEFT JOIN user_search_source_configs usc 
        ON ss.id = usc.source_id AND usc.user_id = ?
      WHERE ss.is_active = 1
    `;
    
    const params = [user.id];

    if (!includeSystem) {
      query += ` AND ss.is_system = 0`;
    }
    
    if (enabledOnly) {
      query += ` AND (usc.is_enabled = 1 OR (usc.is_enabled IS NULL AND ss.is_system = 1))`;
    }
    
    if (searchable !== null) {
      const searchableValue = searchable === 'true' ? 1 : 0;
      query += ` AND ss.searchable = ${searchableValue}`;
    }
    
    if (categoryId) {
      query += ` AND ss.category_id = ?`;
      params.push(categoryId);
    }

    query += ` ORDER BY ss.search_priority ASC, ss.display_order ASC, ss.name ASC`;

    const result = await env.DB.prepare(query).bind(...params).all();
    
    const sources = result.results.map(source => ({
      id: source.id,
      categoryId: source.category_id,
      name: source.custom_name || source.name,
      subtitle: source.custom_subtitle || source.subtitle,
      description: source.description,
      icon: source.custom_icon || source.icon,
      urlTemplate: source.url_template,
      homepageUrl: source.homepage_url,
      siteType: source.site_type,
      searchable: source.searchable === 1,
      requiresKeyword: source.requires_keyword === 1,
      searchPriority: source.custom_priority || source.search_priority,
      supportsDetailExtraction: source.supports_detail_extraction === 1,
      extractionQuality: source.extraction_quality,
      averageExtractionTime: source.average_extraction_time,
      supportedFeatures: JSON.parse(source.supported_features || '[]'),
      isSystem: source.is_system === 1,
      displayOrder: source.display_order,
      usageCount: source.usage_count,
      lastUsedAt: source.last_used_at,
      userEnabled: source.user_enabled !== 0, // null视为启用
      notes: source.notes,
      // 代理相关字段
      needsProxy: source.needs_proxy === 1,
      proxyConfig: source.proxy_config ? JSON.parse(source.proxy_config) : null,
      proxyRegions: source.proxy_regions ? JSON.parse(source.proxy_regions) : null,
      proxyPriority: source.proxy_priority,
      supportsDirectAccess: source.supports_direct_access === 1,
      proxyUsageCount: source.proxy_usage_count || 0,
      directUsageCount: source.direct_usage_count || 0,
      userUseProxy: source.use_proxy === 1,
      customProxyUrl: source.custom_proxy_url,
      proxyPreference: source.proxy_preference || 'auto',
      allowFallbackDirect: source.allow_fallback_direct !== 0,
      createdAt: source.created_at,
      updatedAt: source.updated_at
    }));

    return utils.successResponse(sources);
  } catch (error) {
    console.error('获取搜索源列表失败:', error);
    return utils.errorResponse('获取搜索源列表失败', 500);
  }
}

/**
 * 更新用户搜索源配置
 */
export async function updateUserSourceConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const { 
      sourceId, 
      isEnabled, 
      customPriority, 
      customName, 
      customSubtitle, 
      customIcon, 
      notes,
      useProxy,
      customProxyUrl,
      proxyPreference,
      allowFallbackDirect
    } = await request.json();

    if (!sourceId) {
      return utils.errorResponse('缺少必需的sourceId参数', 400);
    }

    // 检查搜索源是否存在
    const sourceExists = await env.DB.prepare(
      'SELECT id FROM search_sources WHERE id = ? AND is_active = 1'
    ).bind(sourceId).first();

    if (!sourceExists) {
      return utils.errorResponse('搜索源不存在', 404);
    }

    const configId = `${user.id}_${sourceId}`;
    const now = Date.now();

    // 尝试更新现有配置
    const updateResult = await env.DB.prepare(`
      UPDATE user_search_source_configs 
      SET 
        is_enabled = ?,
        custom_priority = ?,
        custom_name = ?,
        custom_subtitle = ?,
        custom_icon = ?,
        notes = ?,
        use_proxy = ?,
        custom_proxy_url = ?,
        proxy_preference = ?,
        allow_fallback_direct = ?,
        updated_at = ?
      WHERE user_id = ? AND source_id = ?
    `).bind(
      isEnabled ? 1 : 0,
      customPriority || null,
      customName || null,
      customSubtitle || null,
      customIcon || null,
      notes || null,
      useProxy ? 1 : 0,
      customProxyUrl || null,
      proxyPreference || 'auto',
      allowFallbackDirect ? 1 : 0,
      now,
      user.id,
      sourceId
    ).run();

    // 如果没有更新任何行，则插入新配置
    if (updateResult.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO user_search_source_configs (
          id, user_id, source_id, is_enabled, custom_priority,
          custom_name, custom_subtitle, custom_icon, notes,
          use_proxy, custom_proxy_url, proxy_preference, allow_fallback_direct,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        configId,
        user.id,
        sourceId,
        isEnabled ? 1 : 0,
        customPriority || null,
        customName || null,
        customSubtitle || null,
        customIcon || null,
        notes || null,
        useProxy ? 1 : 0,
        customProxyUrl || null,
        proxyPreference || 'auto',
        allowFallbackDirect ? 1 : 0,
        now,
        now
      ).run();
    }

    return utils.successResponse({ message: '搜索源配置已更新' });
  } catch (error) {
    console.error('更新搜索源配置失败:', error);
    return utils.errorResponse('更新搜索源配置失败', 500);
  }
}

// ===============================================
// 代理配置处理器 (新增)
// ===============================================

/**
 * 获取代理配置
 */
export async function getProxyConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    // 获取用户的代理配置
    const userProxyConfig = await env.DB.prepare(`
      SELECT * FROM user_proxy_configs WHERE user_id = ?
    `).bind(user.id).first();

    // 获取可用的代理服务器
    const proxyServers = await env.DB.prepare(`
      SELECT 
        id, name, description, base_url, server_region, 
        supported_regions, server_type, health_status,
        average_response_time, success_rate, priority, weight,
        is_active
      FROM proxy_servers 
      WHERE is_active = 1
      ORDER BY priority ASC, success_rate DESC
    `).all();

    // 获取需要代理的搜索源
    const proxySources = await env.DB.prepare(`
      SELECT 
        ss.id,
        ss.name,
        ss.needs_proxy,
        ss.proxy_config,
        ss.proxy_regions,
        ss.proxy_priority,
        usc.use_proxy as user_proxy_enabled,
        usc.custom_proxy_url,
        usc.proxy_preference
      FROM search_sources ss
      LEFT JOIN user_search_source_configs usc 
        ON ss.id = usc.source_id AND usc.user_id = ?
      WHERE ss.is_active = 1 AND (ss.needs_proxy = 1 OR usc.use_proxy = 1)
      ORDER BY ss.proxy_priority ASC, ss.name ASC
    `).bind(user.id).all();

    // 获取全局代理设置
    const globalProxy = {
      enabled: env.PROXY_ENABLED === 'true',
      baseUrl: env.PROXY_BASE_URL || '',
      defaultSources: env.PROXY_DEFAULT_SOURCES?.split(',') || [],
      intelligentRouting: env.PROXY_INTELLIGENT_ROUTING !== 'false'
    };

    const response = {
      global: globalProxy,
      userConfig: userProxyConfig ? {
        proxyEnabled: userProxyConfig.proxy_enabled === 1,
        intelligentRouting: userProxyConfig.intelligent_routing === 1,
        userRegion: userProxyConfig.user_region,
        preferredProxyServer: userProxyConfig.preferred_proxy_server,
        fallbackProxyServers: userProxyConfig.fallback_proxy_servers ? 
          JSON.parse(userProxyConfig.fallback_proxy_servers) : [],
        autoSwitchOnFailure: userProxyConfig.auto_switch_on_failure === 1,
        autoFallbackDirect: userProxyConfig.auto_fallback_direct === 1,
        healthCheckInterval: userProxyConfig.health_check_interval,
        requestTimeout: userProxyConfig.request_timeout,
        maxRetries: userProxyConfig.max_retries,
        retryDelay: userProxyConfig.retry_delay,
        customProxyRules: userProxyConfig.custom_proxy_rules ? 
          JSON.parse(userProxyConfig.custom_proxy_rules) : null,
        whitelistSources: userProxyConfig.whitelist_sources ? 
          JSON.parse(userProxyConfig.whitelist_sources) : [],
        blacklistSources: userProxyConfig.blacklist_sources ? 
          JSON.parse(userProxyConfig.blacklist_sources) : [],
        totalProxyRequests: userProxyConfig.total_proxy_requests,
        successfulProxyRequests: userProxyConfig.successful_proxy_requests,
        failedProxyRequests: userProxyConfig.failed_proxy_requests,
        dataTransferred: userProxyConfig.data_transferred
      } : null,
      proxyServers: proxyServers.results.map(server => ({
        id: server.id,
        name: server.name,
        description: server.description,
        baseUrl: server.base_url,
        serverRegion: server.server_region,
        supportedRegions: server.supported_regions ? JSON.parse(server.supported_regions) : [],
        serverType: server.server_type,
        healthStatus: server.health_status,
        averageResponseTime: server.average_response_time,
        successRate: server.success_rate,
        priority: server.priority,
        weight: server.weight,
        isActive: server.is_active === 1
      })),
      sources: proxySources.results.map(source => ({
        id: source.id,
        name: source.name,
        needsProxy: source.needs_proxy === 1,
        proxyConfig: source.proxy_config ? JSON.parse(source.proxy_config) : null,
        proxyRegions: source.proxy_regions ? JSON.parse(source.proxy_regions) : null,
        proxyPriority: source.proxy_priority,
        userProxyEnabled: source.user_proxy_enabled === 1,
        customProxyUrl: source.custom_proxy_url,
        proxyPreference: source.proxy_preference || 'auto'
      }))
    };

    return utils.successResponse(response);
  } catch (error) {
    console.error('获取代理配置失败:', error);
    return utils.errorResponse('获取代理配置失败', 500);
  }
}

/**
 * 更新用户代理设置
 */
export async function updateProxySettingsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const {
      proxyEnabled,
      intelligentRouting,
      userRegion,
      preferredProxyServer,
      fallbackProxyServers,
      autoSwitchOnFailure,
      autoFallbackDirect,
      healthCheckInterval,
      requestTimeout,
      maxRetries,
      retryDelay,
      customProxyRules,
      whitelistSources,
      blacklistSources
    } = await request.json();

    const now = Date.now();
    const configId = `${user.id}_proxy_config`;

    // 尝试更新现有配置
    const updateResult = await env.DB.prepare(`
      UPDATE user_proxy_configs 
      SET 
        proxy_enabled = ?,
        intelligent_routing = ?,
        user_region = ?,
        preferred_proxy_server = ?,
        fallback_proxy_servers = ?,
        auto_switch_on_failure = ?,
        auto_fallback_direct = ?,
        health_check_interval = ?,
        request_timeout = ?,
        max_retries = ?,
        retry_delay = ?,
        custom_proxy_rules = ?,
        whitelist_sources = ?,
        blacklist_sources = ?,
        updated_at = ?
      WHERE user_id = ?
    `).bind(
      proxyEnabled ? 1 : 0,
      intelligentRouting !== false ? 1 : 0,
      userRegion || 'CN',
      preferredProxyServer || null,
      fallbackProxyServers ? JSON.stringify(fallbackProxyServers) : '[]',
      autoSwitchOnFailure !== false ? 1 : 0,
      autoFallbackDirect !== false ? 1 : 0,
      healthCheckInterval || 300,
      requestTimeout || 30000,
      maxRetries || 2,
      retryDelay || 1000,
      customProxyRules ? JSON.stringify(customProxyRules) : null,
      whitelistSources ? JSON.stringify(whitelistSources) : '[]',
      blacklistSources ? JSON.stringify(blacklistSources) : '[]',
      now,
      user.id
    ).run();

    // 如果没有更新任何行，则插入新配置
    if (updateResult.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO user_proxy_configs (
          id, user_id, proxy_enabled, intelligent_routing, user_region,
          preferred_proxy_server, fallback_proxy_servers, auto_switch_on_failure,
          auto_fallback_direct, health_check_interval, request_timeout,
          max_retries, retry_delay, custom_proxy_rules, whitelist_sources,
          blacklist_sources, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        configId,
        user.id,
        proxyEnabled ? 1 : 0,
        intelligentRouting !== false ? 1 : 0,
        userRegion || 'CN',
        preferredProxyServer || null,
        fallbackProxyServers ? JSON.stringify(fallbackProxyServers) : '[]',
        autoSwitchOnFailure !== false ? 1 : 0,
        autoFallbackDirect !== false ? 1 : 0,
        healthCheckInterval || 300,
        requestTimeout || 30000,
        maxRetries || 2,
        retryDelay || 1000,
        customProxyRules ? JSON.stringify(customProxyRules) : null,
        whitelistSources ? JSON.stringify(whitelistSources) : '[]',
        blacklistSources ? JSON.stringify(blacklistSources) : '[]',
        now,
        now
      ).run();
    }

    return utils.successResponse({ message: '代理设置已更新' });
  } catch (error) {
    console.error('更新代理设置失败:', error);
    return utils.errorResponse('更新代理设置失败', 500);
  }
}

/**
 * 更新单个搜索源的代理设置
 */
export async function updateSourceProxyHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const { 
      sourceId, 
      useProxy, 
      customProxyUrl, 
      proxyPreference, 
      allowFallbackDirect 
    } = await request.json();

    if (!sourceId) {
      return utils.errorResponse('缺少必需的sourceId参数', 400);
    }

    const now = Date.now();
    const configId = `${user.id}_${sourceId}`;

    // 尝试更新现有配置
    const updateResult = await env.DB.prepare(`
      UPDATE user_search_source_configs 
      SET 
        use_proxy = ?,
        custom_proxy_url = ?,
        proxy_preference = ?,
        allow_fallback_direct = ?,
        updated_at = ?
      WHERE user_id = ? AND source_id = ?
    `).bind(
      useProxy ? 1 : 0,
      customProxyUrl || null,
      proxyPreference || 'auto',
      allowFallbackDirect !== false ? 1 : 0,
      now,
      user.id,
      sourceId
    ).run();

    // 如果没有更新任何行，则插入新配置
    if (updateResult.changes === 0) {
      await env.DB.prepare(`
        INSERT INTO user_search_source_configs (
          id, user_id, source_id, is_enabled, use_proxy, custom_proxy_url,
          proxy_preference, allow_fallback_direct, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        configId,
        user.id,
        sourceId,
        1, // 默认启用
        useProxy ? 1 : 0,
        customProxyUrl || null,
        proxyPreference || 'auto',
        allowFallbackDirect !== false ? 1 : 0,
        now,
        now
      ).run();
    }

    return utils.successResponse({ message: '搜索源代理设置已更新' });
  } catch (error) {
    console.error('更新搜索源代理设置失败:', error);
    return utils.errorResponse('更新搜索源代理设置失败', 500);
  }
}

/**
 * 获取代理服务器列表
 */
export async function getProxyServersHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const url = new URL(request.url);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';
    const serverRegion = url.searchParams.get('serverRegion');
    const serverType = url.searchParams.get('serverType');

    let query = `
      SELECT * FROM proxy_servers
      WHERE 1=1
    `;
    const params = [];

    if (!includeInactive) {
      query += ` AND is_active = 1`;
    }

    if (serverRegion) {
      query += ` AND server_region = ?`;
      params.push(serverRegion);
    }

    if (serverType) {
      query += ` AND server_type = ?`;
      params.push(serverType);
    }

    query += ` ORDER BY priority ASC, success_rate DESC, average_response_time ASC`;

    const result = await env.DB.prepare(query).bind(...params).all();

    const servers = result.results.map(server => ({
      id: server.id,
      name: server.name,
      description: server.description,
      baseUrl: server.base_url,
      serverRegion: server.server_region,
      supportedRegions: server.supported_regions ? JSON.parse(server.supported_regions) : [],
      serverType: server.server_type,
      maxConcurrentRequests: server.max_concurrent_requests,
      requestTimeout: server.request_timeout,
      isActive: server.is_active === 1,
      healthStatus: server.health_status,
      lastHealthCheck: server.last_health_check,
      averageResponseTime: server.average_response_time,
      successRate: server.success_rate,
      uptimePercentage: server.uptime_percentage,
      totalRequests: server.total_requests,
      successfulRequests: server.successful_requests,
      failedRequests: server.failed_requests,
      authRequired: server.auth_required === 1,
      authConfig: server.auth_config ? JSON.parse(server.auth_config) : null,
      rateLimitConfig: server.rate_limit_config ? JSON.parse(server.rate_limit_config) : null,
      customHeaders: server.custom_headers ? JSON.parse(server.custom_headers) : null,
      priority: server.priority,
      weight: server.weight,
      isSystem: server.is_system === 1,
      createdAt: server.created_at,
      updatedAt: server.updated_at
    }));

    return utils.successResponse(servers);
  } catch (error) {
    console.error('获取代理服务器列表失败:', error);
    return utils.errorResponse('获取代理服务器列表失败', 500);
  }
}

/**
 * 检查代理服务器健康状态
 */
export async function checkProxyHealthHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
      return utils.errorResponse('缺少服务器ID', 400);
    }

    // 获取代理服务器信息
    const server = await env.DB.prepare(
      'SELECT * FROM proxy_servers WHERE id = ? AND is_active = 1'
    ).bind(serverId).first();

    if (!server) {
      return utils.errorResponse('代理服务器不存在', 404);
    }

    const startTime = Date.now();
    let healthStatus = 'unknown';
    let responseTime = 0;
    let error = null;

    try {
      // 发送健康检查请求到代理服务器
      const healthCheckUrl = `${server.base_url}/api/health`;
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        timeout: server.request_timeout || 30000,
        headers: {
          'User-Agent': 'MagnetSearch-HealthCheck/1.0',
          'Accept': 'application/json'
        }
      });

      responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const healthData = await response.json();
        healthStatus = healthData.status === 'healthy' ? 'healthy' : 'degraded';
      } else {
        healthStatus = 'degraded';
        error = `HTTP ${response.status}`;
      }
    } catch (err) {
      responseTime = Date.now() - startTime;
      healthStatus = 'unhealthy';
      error = err.message;
    }

    // 更新服务器健康状态
    await env.DB.prepare(`
      UPDATE proxy_servers 
      SET 
        health_status = ?,
        last_health_check = ?,
        average_response_time = CASE 
          WHEN average_response_time = 0 THEN ?
          ELSE (average_response_time + ?) / 2
        END,
        updated_at = ?
      WHERE id = ?
    `).bind(
      healthStatus,
      Date.now(),
      responseTime,
      responseTime,
      Date.now(),
      serverId
    ).run();

    return utils.successResponse({
      serverId,
      healthStatus,
      responseTime,
      error,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('检查代理服务器健康状态失败:', error);
    return utils.errorResponse('检查代理服务器健康状态失败', 500);
  }
}

/**
 * 获取代理使用统计
 */
export async function getProxyStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    // 获取用户代理统计
    const userStats = await env.DB.prepare(`
      SELECT 
        total_proxy_requests,
        successful_proxy_requests,
        failed_proxy_requests,
        data_transferred,
        user_region,
        preferred_proxy_server
      FROM user_proxy_configs 
      WHERE user_id = ?
    `).bind(user.id).first();

    // 获取搜索源代理使用统计
    const sourceStats = await env.DB.prepare(`
      SELECT 
        ss.id,
        ss.name,
        ss.proxy_usage_count,
        ss.direct_usage_count,
        CASE 
          WHEN ss.proxy_usage_count + ss.direct_usage_count > 0 
          THEN ROUND(CAST(ss.proxy_usage_count AS REAL) / (ss.proxy_usage_count + ss.direct_usage_count) * 100, 2)
          ELSE 0 
        END as proxy_usage_percentage
      FROM search_sources ss
      WHERE ss.is_active = 1 AND (ss.proxy_usage_count > 0 OR ss.direct_usage_count > 0)
      ORDER BY ss.proxy_usage_count DESC
    `).all();

    // 获取代理服务器性能统计
    const serverStats = await env.DB.prepare(`
      SELECT 
        id, name, server_region, health_status,
        total_requests, success_rate, average_response_time,
        uptime_percentage, priority, weight
      FROM proxy_servers 
      WHERE is_active = 1
      ORDER BY success_rate DESC, average_response_time ASC
    `).all();

    const stats = {
      user: userStats ? {
        totalProxyRequests: userStats.total_proxy_requests || 0,
        successfulProxyRequests: userStats.successful_proxy_requests || 0,
        failedProxyRequests: userStats.failed_proxy_requests || 0,
        successRate: userStats.total_proxy_requests > 0 ? 
          ((userStats.successful_proxy_requests || 0) / userStats.total_proxy_requests * 100).toFixed(2) : 0,
        dataTransferred: userStats.data_transferred || 0,
        userRegion: userStats.user_region,
        preferredProxyServer: userStats.preferred_proxy_server
      } : null,
      sources: sourceStats.results,
      servers: serverStats.results.map(server => ({
        id: server.id,
        name: server.name,
        serverRegion: server.server_region,
        healthStatus: server.health_status,
        totalRequests: server.total_requests,
        successRate: server.success_rate,
        averageResponseTime: server.average_response_time,
        uptimePercentage: server.uptime_percentage,
        priority: server.priority,
        weight: server.weight
      }))
    };

    return utils.successResponse(stats);
  } catch (error) {
    console.error('获取代理统计失败:', error);
    return utils.errorResponse('获取代理统计失败', 500);
  }
}

/**
 * 智能代理路由推荐
 */
export async function getProxyRecommendationHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const { sourceId, userRegion } = await request.json();

    if (!sourceId) {
      return utils.errorResponse('缺少搜索源ID', 400);
    }

    // 获取搜索源信息
    const source = await env.DB.prepare(
      'SELECT * FROM search_sources WHERE id = ? AND is_active = 1'
    ).bind(sourceId).first();

    if (!source) {
      return utils.errorResponse('搜索源不存在', 404);
    }

    // 获取用户代理配置
    const userConfig = await env.DB.prepare(
      'SELECT * FROM user_proxy_configs WHERE user_id = ?'
    ).bind(user.id).first();

    const region = userRegion || userConfig?.user_region || 'CN';

    // 判断是否需要代理
    let needsProxy = source.needs_proxy === 1;
    
    if (source.proxy_regions) {
      const proxyRegions = JSON.parse(source.proxy_regions);
      needsProxy = needsProxy || proxyRegions.includes(region);
    }

    let recommendation = {
      sourceId,
      sourceName: source.name,
      needsProxy,
      userRegion: region,
      recommendedServers: [],
      reasoning: []
    };

    if (needsProxy) {
      // 获取适合的代理服务器
      const suitableServers = await env.DB.prepare(`
        SELECT 
          ps.*,
          CASE 
            WHEN ps.server_region = ? THEN 10
            WHEN ps.supported_regions LIKE '%"' || ? || '"%' THEN 8
            WHEN ps.supported_regions LIKE '%"*"%' THEN 5
            ELSE 1
          END as region_score
        FROM proxy_servers ps
        WHERE ps.is_active = 1 
          AND ps.health_status IN ('healthy', 'unknown')
        ORDER BY 
          region_score DESC,
          ps.success_rate DESC,
          ps.average_response_time ASC,
          ps.priority ASC
        LIMIT 3
      `).bind(region, region).all();

      recommendation.recommendedServers = suitableServers.results.map(server => ({
        id: server.id,
        name: server.name,
        baseUrl: server.base_url,
        serverRegion: server.server_region,
        healthStatus: server.health_status,
        successRate: server.success_rate,
        averageResponseTime: server.average_response_time,
        regionScore: server.region_score
      }));

      // 生成推荐理由
      if (source.needs_proxy === 1) {
        recommendation.reasoning.push('该搜索源需要代理访问');
      }
      
      if (source.proxy_regions) {
        const proxyRegions = JSON.parse(source.proxy_regions);
        if (proxyRegions.includes(region)) {
          recommendation.reasoning.push(`您所在的地区(${region})需要代理访问该搜索源`);
        }
      }

      if (recommendation.recommendedServers.length > 0) {
        const bestServer = recommendation.recommendedServers[0];
        recommendation.reasoning.push(`推荐使用${bestServer.name}代理服务器，成功率${(bestServer.successRate * 100).toFixed(1)}%`);
      }
    } else {
      recommendation.reasoning.push('该搜索源支持直接访问，无需使用代理');
    }

    return utils.successResponse(recommendation);
  } catch (error) {
    console.error('获取代理推荐失败:', error);
    return utils.errorResponse('获取代理推荐失败', 500);
  }
}

// ===============================================
// 其他现有处理器 (保持不变)
// ===============================================

/**
 * 获取搜索源分类
 */
export async function getSourceCategoriesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const url = new URL(request.url);
    const includeSystem = url.searchParams.get('includeSystem') !== 'false';
    const includeCustom = url.searchParams.get('includeCustom') !== 'false';

    let query = `
      SELECT * FROM search_source_categories 
      WHERE is_active = 1
    `;
    const params = [];

    if (!includeSystem) {
      query += ` AND is_system = 0`;
    }

    if (!includeCustom) {
      query += ` AND is_system = 1`;
    }

    query += ` ORDER BY display_order ASC, name ASC`;

    const result = await env.DB.prepare(query).bind(...params).all();
    
    const categories = result.results.map(category => ({
      id: category.id,
      majorCategoryId: category.major_category_id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      displayOrder: category.display_order,
      isSystem: category.is_system === 1,
      isActive: category.is_active === 1,
      defaultSearchable: category.default_searchable === 1,
      defaultSiteType: category.default_site_type,
      searchPriority: category.search_priority,
      supportsDetailExtraction: category.supports_detail_extraction === 1,
      extractionPriority: category.extraction_priority,
      createdBy: category.created_by,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));

    return utils.successResponse(categories);
  } catch (error) {
    console.error('获取搜索源分类失败:', error);
    return utils.errorResponse('获取搜索源分类失败', 500);
  }
}

/**
 * 获取主要分类
 */
export async function getMajorCategoriesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const result = await env.DB.prepare(`
      SELECT * FROM search_major_categories 
      WHERE is_active = 1
      ORDER BY display_order ASC, name ASC
    `).all();
    
    const categories = result.results.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      requiresKeyword: category.requires_keyword === 1,
      displayOrder: category.display_order,
      isSystem: category.is_system === 1,
      isActive: category.is_active === 1,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));

    return utils.successResponse(categories);
  } catch (error) {
    console.error('获取主要分类失败:', error);
    return utils.errorResponse('获取主要分类失败', 500);
  }
}

/**
 * 批量启用所有搜索源
 */
export async function enableAllSourcesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const now = Date.now();
    
    // 获取所有系统搜索源
    const sources = await env.DB.prepare(
      'SELECT id FROM search_sources WHERE is_system = 1 AND is_active = 1'
    ).all();

    // 为每个源创建或更新配置
    for (const source of sources.results) {
      const configId = `${user.id}_${source.id}`;
      
      await env.DB.prepare(`
        INSERT OR REPLACE INTO user_search_source_configs (
          id, user_id, source_id, is_enabled, created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?)
      `).bind(configId, user.id, source.id, now, now).run();
    }

    return utils.successResponse({ 
      message: '已启用所有搜索源',
      count: sources.results.length 
    });
  } catch (error) {
    console.error('批量启用搜索源失败:', error);
    return utils.errorResponse('批量启用搜索源失败', 500);
  }
}

/**
 * 批量禁用所有搜索源
 */
export async function disableAllSourcesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const now = Date.now();
    
    await env.DB.prepare(`
      UPDATE user_search_source_configs 
      SET is_enabled = 0, updated_at = ?
      WHERE user_id = ?
    `).bind(now, user.id).run();

    return utils.successResponse({ message: '已禁用所有搜索源' });
  } catch (error) {
    console.error('批量禁用搜索源失败:', error);
    return utils.errorResponse('批量禁用搜索源失败', 500);
  }
}

/**
 * 重置为默认配置
 */
export async function resetToDefaultsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse('认证失败', 401);
  }

  try {
    const now = Date.now();
    
    // 删除所有用户配置
    await env.DB.prepare(
      'DELETE FROM user_search_source_configs WHERE user_id = ?'
    ).bind(user.id).run();

    // 重新创建默认配置
    const defaultSources = ['javbus', 'javdb', 'javlibrary', 'btsow'];
    const sources = await env.DB.prepare(`
      SELECT id, needs_proxy FROM search_sources 
      WHERE id IN (${defaultSources.map(() => '?').join(',')}) AND is_active = 1
    `).bind(...defaultSources).all();

    for (const source of sources.results) {
      const configId = `${user.id}_${source.id}`;
      
      await env.DB.prepare(`
        INSERT INTO user_search_source_configs (
          id, user_id, source_id, is_enabled, use_proxy, proxy_preference,
          created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, 'auto', ?, ?)
      `).bind(
        configId, 
        user.id, 
        source.id, 
        source.needs_proxy === 1 ? 1 : 0,
        now, 
        now
      ).run();
    }

    return utils.successResponse({ 
      message: '已重置为默认配置',
      enabledSources: defaultSources 
    });
  } catch (error) {
    console.error('重置默认配置失败:', error);
    return utils.errorResponse('重置默认配置失败', 500);
  }
}