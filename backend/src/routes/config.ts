/**
 * 系统配置与分析模块
 * 功能：系统配置管理、分析事件记录、缓存管理、配置变更日志
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Hono } from 'hono';
import { Env, SystemConfig, EmailSendLog, ConfigChangeLog, ConfigGroup } from '../types';
import { success, error, generateId, verifyToken } from '../utils';

export const configRoutes = new Hono<{ Bindings: Env }>();

const DEFAULT_CONFIG_VALUES: Record<string, { value: string; description: string; configType: string; configGroup: string; isPublic: number; isSensitive: number; validationRules?: string }> = {
  'site_name': { value: '磁力快搜', description: '网站名称', configType: 'string', configGroup: 'basic', isPublic: 1, isSensitive: 0 },
  'site_description': { value: '搜索全网资源，一步直达', description: '网站描述', configType: 'string', configGroup: 'basic', isPublic: 1, isSensitive: 0 },
  'enable_registration': { value: '1', description: '是否开放注册', configType: 'boolean', configGroup: 'basic', isPublic: 1, isSensitive: 0 },
  'max_search_history': { value: '1000', description: '最大搜索历史记录数', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 5000}' },
  'max_favorites': { value: '1000', description: '最大收藏数量', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 5000}' },
  'min_username_length': { value: '3', description: '用户名最小长度', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 2, "max": 20}' },
  'max_username_length': { value: '20', description: '用户名最大长度', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 5, "max": 50}' },
  'min_password_length': { value: '6', description: '密码最小长度', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 4, "max": 32}' },
  'max_password_length': { value: '100', description: '密码最大长度', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 32, "max": 200}' },
  'max_tags_per_user': { value: '100', description: '每个用户最大标签数量', configType: 'integer', configGroup: 'user_limits', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 200}' },
  'max_batch_config_update': { value: '100', description: '批量配置更新最大数量', configType: 'integer', configGroup: 'user_limits', isPublic: 0, isSensitive: 0, validationRules: '{"min": 10, "max": 500}' },
  'max_sync_favorites': { value: '1000', description: '同步收藏最大数量', configType: 'integer', configGroup: 'user_limits', isPublic: 0, isSensitive: 0, validationRules: '{"min": 100, "max": 5000}' },
  'verification_code_length': { value: '6', description: '验证码长度', configType: 'integer', configGroup: 'email', isPublic: 1, isSensitive: 0, validationRules: '{"min": 4, "max": 8}' },
  'source_check_enabled': { value: '1', description: '启用搜索源状态检查', configType: 'boolean', configGroup: 'source_check', isPublic: 1, isSensitive: 0 },
  'max_concurrent_checks': { value: '3', description: '最大并发检查数', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'default_check_timeout': { value: '10000', description: '默认检查超时时间（毫秒）', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1000, "max": 60000}' },
  'batch_check_timeout_ms': { value: '5000', description: '批量检查超时时间（毫秒）', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1000, "max": 30000}' },
  'cache_duration_ms': { value: '300000', description: '状态缓存时间（毫秒）', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 60000, "max": 86400000}' },
  'max_batch_check': { value: '50', description: '批量检查最大数量', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 100}' },
  'max_cache_age_ms': { value: '300000', description: '缓存最大有效期（毫秒）', configType: 'integer', configGroup: 'source_check', isPublic: 1, isSensitive: 0, validationRules: '{"min": 60000, "max": 86400000}' },
  'community_enabled': { value: '1', description: '启用搜索源共享社区功能', configType: 'boolean', configGroup: 'community', isPublic: 1, isSensitive: 0 },
  'community_require_approval': { value: '0', description: '新分享的搜索源需要审核', configType: 'boolean', configGroup: 'community', isPublic: 0, isSensitive: 0 },
  'community_max_shares_per_user': { value: '50', description: '每个用户最大分享数量', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 100}' },
  'min_rating_to_feature': { value: '4.0', description: '推荐搜索源的最低评分', configType: 'float', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1.0, "max": 5.0}' },
  'max_tags_per_source': { value: '10', description: '每个搜索源最大标签数', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 30}' },
  'max_comment_length': { value: '1000', description: '评论最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 5000}' },
  'max_report_reason_length': { value: '100', description: '举报原因最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 50, "max": 500}' },
  'max_report_details_length': { value: '1000', description: '举报详情最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 5000}' },
  'tag_name_min_length': { value: '2', description: '标签名称最小长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'tag_name_max_length': { value: '20', description: '标签名称最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 5, "max": 50}' },
  'source_name_max_length': { value: '100', description: '搜索源名称最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 200}' },
  'source_description_max_length': { value: '2000', description: '搜索源描述最大长度', configType: 'integer', configGroup: 'community', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 10000}' },
  'email_verification_enabled': { value: '1', description: '是否启用邮箱验证功能', configType: 'boolean', configGroup: 'email', isPublic: 1, isSensitive: 0 },
  'email_verification_required': { value: '0', description: '注册时是否强制邮箱验证', configType: 'boolean', configGroup: 'email', isPublic: 1, isSensitive: 0 },
  'verification_code_expiry': { value: '900000', description: '验证码过期时间（毫秒，默认15分钟）', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 60000, "max": 3600000}' },
  'max_verification_attempts': { value: '5', description: '最大验证尝试次数', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'email_rate_limit_per_hour': { value: '5', description: '每小时最大发送邮件数', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 20}' },
  'email_rate_limit_per_day': { value: '20', description: '每天最大发送邮件数', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 100}' },
  'resend_interval_ms': { value: '60000', description: '邮件重发间隔（毫秒，默认1分钟）', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 30000, "max": 300000}' },
  'change_request_expiry_ms': { value: '1800000', description: '邮箱更改请求过期时间（毫秒，默认30分钟）', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 600000, "max": 7200000}' },
  'change_pending_expiry_minutes': { value: '15', description: '邮箱更改待确认过期时间（分钟）', configType: 'integer', configGroup: 'email', isPublic: 0, isSensitive: 0, validationRules: '{"min": 5, "max": 60}' },
  'forgot_password_enabled': { value: '1', description: '是否启用忘记密码功能', configType: 'boolean', configGroup: 'password', isPublic: 1, isSensitive: 0 },
  'reset_password_code_expiry': { value: '1800000', description: '重置密码验证码过期时间（毫秒，默认30分钟）', configType: 'integer', configGroup: 'password', isPublic: 1, isSensitive: 0, validationRules: '{"min": 600000, "max": 7200000}' },
  'password_reset_max_attempts': { value: '5', description: '密码重置最大尝试次数', configType: 'integer', configGroup: 'password', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'password_reset_lockout_duration': { value: '3600000', description: '密码重置锁定持续时间（毫秒，默认1小时）', configType: 'integer', configGroup: 'password', isPublic: 1, isSensitive: 0, validationRules: '{"min": 300000, "max": 86400000}' },
  'security_monitoring_enabled': { value: '1', description: '是否启用安全事件监控', configType: 'boolean', configGroup: 'security', isPublic: 0, isSensitive: 0 },
  'security_event_retention_days': { value: '90', description: '安全事件保留天数', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 30, "max": 365}' },
  'high_risk_threshold': { value: '50', description: '高风险事件阈值', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 1, validationRules: '{"min": 0, "max": 100}' },
  'max_login_attempts': { value: '5', description: '最大登录尝试次数', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 3, "max": 10}' },
  'lockout_duration_ms': { value: '900000', description: '账户锁定时长（毫秒，默认15分钟）', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 60000, "max": 3600000}' },
  'recent_failed_logins_threshold': { value: '3', description: '近期登录失败阈值', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'recent_ip_logins_threshold': { value: '3', description: '近期IP登录变化阈值', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'recent_password_changes_threshold': { value: '2', description: '近期密码修改阈值', configType: 'integer', configGroup: 'security', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 10}' },
  'enable_search_history': { value: '1', description: '启用搜索历史功能', configType: 'boolean', configGroup: 'features', isPublic: 1, isSensitive: 0 },
  'enable_favorites': { value: '1', description: '启用收藏功能', configType: 'boolean', configGroup: 'features', isPublic: 1, isSensitive: 0 },
  'enable_analytics': { value: '1', description: '启用统计分析功能', configType: 'boolean', configGroup: 'features', isPublic: 0, isSensitive: 0 },
  'enable_dark_mode': { value: '1', description: '启用深色模式切换', configType: 'boolean', configGroup: 'features', isPublic: 1, isSensitive: 0 },
  'enable_proxy': { value: '1', description: '启用代理服务器', configType: 'boolean', configGroup: 'features', isPublic: 1, isSensitive: 0 },
  'enable_search_suggestions': { value: '1', description: '启用搜索建议', configType: 'boolean', configGroup: 'features', isPublic: 1, isSensitive: 0 },
  'session_timeout_minutes': { value: '1440', description: '会话超时时间（分钟，默认24小时）', configType: 'integer', configGroup: 'session', isPublic: 0, isSensitive: 0, validationRules: '{"min": 30, "max": 10080}' },
  'max_sessions_per_user': { value: '5', description: '每用户最大会话数', configType: 'integer', configGroup: 'session', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 20}' },
  'remember_me_days': { value: '30', description: '记住我功能有效天数', configType: 'integer', configGroup: 'session', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 365}' },
  'default_search_sources': { value: '20', description: '默认显示的搜索源数量', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 5, "max": 50}' },
  'search_debounce_ms': { value: '300', description: '搜索防抖延迟（毫秒）', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 100, "max": 2000}' },
  'trending_searches_hours': { value: '24', description: '热门搜索统计时间范围（小时）', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 168}' },
  'max_keyword_length': { value: '200', description: '搜索关键词最大长度', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 50, "max": 500}' },
  'max_sources_per_search': { value: '50', description: '每次搜索最大搜索源数量', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 100}' },
  'suggestions_min_keyword_length': { value: '2', description: '搜索建议最小关键词长度', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 1, "max": 5}' },
  'suggestions_max_limit': { value: '20', description: '搜索建议最大数量', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 5, "max": 50}' },
  'trending_max_hours': { value: '168', description: '热门搜索最大统计时间（小时）', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 24, "max": 720}' },
  'trending_default_limit': { value: '20', description: '热门搜索默认数量', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 5, "max": 50}' },
  'trending_max_limit': { value: '50', description: '热门搜索最大数量', configType: 'integer', configGroup: 'search', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 100}' },
  'default_page_size': { value: '20', description: '默认分页大小', configType: 'integer', configGroup: 'pagination', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 100}' },
  'max_page_size': { value: '100', description: '最大分页大小', configType: 'integer', configGroup: 'pagination', isPublic: 1, isSensitive: 0, validationRules: '{"min": 50, "max": 500}' },
  'max_log_page_size': { value: '200', description: '日志最大分页大小', configType: 'integer', configGroup: 'pagination', isPublic: 0, isSensitive: 0, validationRules: '{"min": 50, "max": 500}' },
  'default_history_limit': { value: '50', description: '默认历史记录限制', configType: 'integer', configGroup: 'pagination', isPublic: 1, isSensitive: 0, validationRules: '{"min": 10, "max": 200}' },
  'max_history_limit': { value: '200', description: '最大历史记录限制', configType: 'integer', configGroup: 'pagination', isPublic: 1, isSensitive: 0, validationRules: '{"min": 50, "max": 500}' },
  'password_reset_log_retention_days': { value: '30', description: '密码重置日志保留天数', configType: 'integer', configGroup: 'cleanup', isPublic: 0, isSensitive: 0, validationRules: '{"min": 7, "max": 90}' },
  'user_actions_retention_days': { value: '90', description: '用户行为日志保留天数', configType: 'integer', configGroup: 'cleanup', isPublic: 0, isSensitive: 0, validationRules: '{"min": 30, "max": 365}' },
  'email_verification_retention_days': { value: '7', description: '邮箱验证记录保留天数', configType: 'integer', configGroup: 'cleanup', isPublic: 0, isSensitive: 0, validationRules: '{"min": 1, "max": 30}' },
};

async function logConfigChange(
  env: Env,
  configKey: string,
  oldValue: string | null,
  newValue: string,
  changeType: 'create' | 'update' | 'delete' | 'reset',
  userId: string | null,
  username: string | null,
  reason: string | null,
  ipAddress: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    const logId = generateId();
    await env.DB.prepare(`
      INSERT INTO config_change_logs (
        id, config_key, old_value, new_value, change_type, 
        changed_by, changed_by_username, change_reason, 
        ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      logId, configKey, oldValue, newValue, changeType,
      userId, username, reason, ipAddress, userAgent, Date.now()
    ).run();
  } catch (err) {
    console.error('Log config change error:', err);
  }
}

function validateConfigValue(value: string, configType: string, validationRules?: string | null): { valid: boolean; error?: string } {
  if (!validationRules) return { valid: true };

  try {
    const rules = JSON.parse(validationRules);

    switch (configType) {
      case 'integer': {
        const num = parseInt(value, 10);
        if (isNaN(num)) return { valid: false, error: '值必须是整数' };
        if (rules.min !== undefined && num < rules.min) {
          return { valid: false, error: `值不能小于 ${rules.min}` };
        }
        if (rules.max !== undefined && num > rules.max) {
          return { valid: false, error: `值不能大于 ${rules.max}` };
        }
        break;
      }
      case 'float': {
        const num = parseFloat(value);
        if (isNaN(num)) return { valid: false, error: '值必须是数字' };
        if (rules.min !== undefined && num < rules.min) {
          return { valid: false, error: `值不能小于 ${rules.min}` };
        }
        if (rules.max !== undefined && num > rules.max) {
          return { valid: false, error: `值不能大于 ${rules.max}` };
        }
        break;
      }
      case 'boolean': {
        if (!['0', '1', 'true', 'false'].includes(value.toLowerCase())) {
          return { valid: false, error: '值必须是布尔值' };
        }
        break;
      }
      case 'string': {
        if (rules.minLength !== undefined && value.length < rules.minLength) {
          return { valid: false, error: `长度不能少于 ${rules.minLength} 个字符` };
        }
        if (rules.maxLength !== undefined && value.length > rules.maxLength) {
          return { valid: false, error: `长度不能超过 ${rules.maxLength} 个字符` };
        }
        if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
          return { valid: false, error: rules.patternMessage || '格式不正确' };
        }
        break;
      }
    }

    return { valid: true };
  } catch {
    return { valid: true };
  }
}

configRoutes.get('/public', async (c) => {
  try {
    const configs = await c.env.DB.prepare(
      `SELECT key, value, config_type FROM system_config WHERE is_public = 1`
    ).all<SystemConfig>();

    const result: Record<string, unknown> = {};
    for (const config of configs.results || []) {
      let parsedValue: unknown = config.value;
      if (config.config_type === 'boolean') {
        parsedValue = config.value === '1' || config.value === 'true';
      } else if (config.config_type === 'integer') {
        parsedValue = parseInt(config.value, 10);
      } else if (config.config_type === 'float') {
        parsedValue = parseFloat(config.value);
      }
      result[config.key] = parsedValue;
    }

    return c.json(success(result));
  } catch (err) {
    console.error('Get public config error:', err);
    return c.json(success({}));
  }
});

configRoutes.get('/all', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const configs = await c.env.DB.prepare(
      'SELECT * FROM system_config ORDER BY config_group, display_order, key'
    ).all<SystemConfig>();

    return c.json(success(configs.results || []));
  } catch (err) {
    console.error('Get all config error:', err);
    return c.json(error('SERVER_ERROR', '获取配置失败'), 500);
  }
});

configRoutes.get('/groups', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const configs = await c.env.DB.prepare(
      'SELECT * FROM system_config ORDER BY config_group, display_order, key'
    ).all<SystemConfig>();

    const groups = await c.env.DB.prepare(
      'SELECT * FROM config_groups ORDER BY display_order'
    ).all<ConfigGroup>();

    const groupedConfigs: Record<string, { info: ConfigGroup | null; configs: SystemConfig[] }> = {};

    for (const config of configs.results || []) {
      const group = config.config_group || 'other';
      if (!groupedConfigs[group]) {
        groupedConfigs[group] = { info: null, configs: [] };
      }
      groupedConfigs[group].configs.push(config);
    }

    for (const group of groups.results || []) {
      if (groupedConfigs[group.name]) {
        groupedConfigs[group.name].info = group;
      }
    }

    return c.json(success({ groups: groups.results || [], groupedConfigs }));
  } catch (err) {
    console.error('Get config groups error:', err);
    return c.json(error('SERVER_ERROR', '获取配置分组失败'), 500);
  }
});

configRoutes.get('/logs', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 200);
  const configKey = c.req.query('key');
  const changeType = c.req.query('type');

  try {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (configKey) {
      whereClause += ' AND config_key = ?';
      params.push(configKey);
    }

    if (changeType) {
      whereClause += ' AND change_type = ?';
      params.push(changeType);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM config_change_logs ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const logs = await c.env.DB.prepare(`
      SELECT * FROM config_change_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, (page - 1) * pageSize).all<ConfigChangeLog>();

    return c.json(success({
      logs: logs.results || [],
      total: countResult?.total || 0,
      page,
      pageSize,
    }));
  } catch (err) {
    console.error('Get config logs error:', err);
    return c.json(error('SERVER_ERROR', '获取配置日志失败'), 500);
  }
});

configRoutes.get('/export', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const configs = await c.env.DB.prepare(
      'SELECT key, value, description, config_type, config_group, is_public, is_sensitive FROM system_config ORDER BY config_group, key'
    ).all<SystemConfig>();

    const exportData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: payload.username,
      configs: (configs.results || []).map(c => ({
        key: c.key,
        value: c.is_sensitive ? '******' : c.value,
        description: c.description,
        configType: c.config_type,
        configGroup: c.config_group,
        isPublic: c.is_public === 1,
        isSensitive: c.is_sensitive === 1,
      })),
    };

    return c.json(success(exportData));
  } catch (err) {
    console.error('Export config error:', err);
    return c.json(error('SERVER_ERROR', '导出配置失败'), 500);
  }
});

configRoutes.get('/analytics/stats', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const days = parseInt(c.req.query('days') || '7');
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    const totalEvents = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM analytics_events WHERE created_at > ?'
    ).bind(since).first<{ count: number }>();

    const eventsByType = await c.env.DB.prepare(`
      SELECT event_type, COUNT(*) as count 
      FROM analytics_events 
      WHERE created_at > ? 
      GROUP BY event_type 
      ORDER BY count DESC
    `).bind(since).all();

    const dailyEvents = await c.env.DB.prepare(`
      SELECT date(created_at / 1000, 'unixepoch') as date, COUNT(*) as count
      FROM analytics_events
      WHERE created_at > ?
      GROUP BY date
      ORDER BY date
    `).bind(since).all();

    const uniqueUsers = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT user_id) as count 
      FROM analytics_events 
      WHERE created_at > ? AND user_id IS NOT NULL
    `).bind(since).first<{ count: number }>();

    const uniqueSessions = await c.env.DB.prepare(`
      SELECT COUNT(DISTINCT session_id) as count 
      FROM analytics_events 
      WHERE created_at > ? AND session_id IS NOT NULL
    `).bind(since).first<{ count: number }>();

    return c.json(success({
      totalEvents: totalEvents?.count || 0,
      uniqueUsers: uniqueUsers?.count || 0,
      uniqueSessions: uniqueSessions?.count || 0,
      eventsByType: eventsByType.results || [],
      dailyEvents: dailyEvents.results || [],
      period: { days, since },
    }));
  } catch (err) {
    console.error('Get analytics stats error:', err);
    return c.json(error('SERVER_ERROR', '获取统计失败'), 500);
  }
});

configRoutes.get('/email/logs', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const page = parseInt(c.req.query('page') || '1');
  const pageSize = Math.min(parseInt(c.req.query('pageSize') || '50'), 200);
  const emailType = c.req.query('type');
  const status = c.req.query('status');

  try {
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (emailType) {
      whereClause += ' AND email_type = ?';
      params.push(emailType);
    }

    if (status) {
      whereClause += ' AND send_status = ?';
      params.push(status);
    }

    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM email_send_logs ${whereClause}`
    ).bind(...params).first<{ total: number }>();

    const logs = await c.env.DB.prepare(`
      SELECT l.*, u.username
      FROM email_send_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, pageSize, (page - 1) * pageSize).all<EmailSendLog & { username: string | null }>();

    return c.json(success({
      logs: logs.results || [],
      total: countResult?.total || 0,
      page,
      pageSize,
    }));
  } catch (err) {
    console.error('Get email logs error:', err);
    return c.json(error('SERVER_ERROR', '获取日志失败'), 500);
  }
});

configRoutes.post('/import', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'super_admin') {
    return c.json(error('FORBIDDEN', '需要超级管理员权限'), 403);
  }

  try {
    const body = await c.req.json();
    const { configs, overwrite = false } = body;

    if (!Array.isArray(configs)) {
      return c.json(error('VALIDATION_ERROR', '配置数据格式错误'), 400);
    }

    const now = Date.now();
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;
    const results: { key: string; success: boolean; action: string; error?: string }[] = [];

    for (const config of configs) {
      const { key, value, description, configType, configGroup, isPublic, isSensitive } = config;

      if (!key || value === undefined) {
        results.push({ key: key || 'unknown', success: false, action: 'skipped', error: '缺少必要字段' });
        continue;
      }

      if (value === '******') {
        results.push({ key, success: false, action: 'skipped', error: '敏感配置需要手动设置' });
        continue;
      }

      try {
        const existing = await c.env.DB.prepare(
          'SELECT * FROM system_config WHERE key = ?'
        ).bind(key).first<SystemConfig>();

        if (existing && !overwrite) {
          results.push({ key, success: false, action: 'skipped', error: '配置已存在' });
          continue;
        }

        if (existing) {
          await c.env.DB.prepare(`
            UPDATE system_config 
            SET value = ?, description = COALESCE(?, description),
                config_type = COALESCE(?, config_type),
                config_group = COALESCE(?, config_group),
                is_public = COALESCE(?, is_public),
                is_sensitive = COALESCE(?, is_sensitive),
                updated_at = ?
            WHERE key = ?
          `).bind(value, description, configType, configGroup, isPublic ? 1 : 0, isSensitive ? 1 : 0, now, key).run();

          await logConfigChange(
            c.env, key, existing.value, value, 'update',
            payload.userId, payload.username, '导入配置', ipAddress, userAgent
          );

          results.push({ key, success: true, action: 'updated' });
        } else {
          await c.env.DB.prepare(`
            INSERT INTO system_config (key, value, description, config_type, config_group, is_public, is_sensitive, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(key, value, description || null, configType || 'string', configGroup || 'other', isPublic ? 1 : 0, isSensitive ? 1 : 0, now, now).run();

          await logConfigChange(
            c.env, key, null, value, 'create',
            payload.userId, payload.username, '导入配置', ipAddress, userAgent
          );

          results.push({ key, success: true, action: 'created' });
        }
      } catch (err) {
        results.push({ key, success: false, action: 'error', error: String(err) });
      }
    }

    return c.json(success({
      results,
      created: results.filter(r => r.success && r.action === 'created').length,
      updated: results.filter(r => r.success && r.action === 'updated').length,
      skipped: results.filter(r => !r.success).length,
    }, '配置导入完成'));
  } catch (err) {
    console.error('Import config error:', err);
    return c.json(error('SERVER_ERROR', '导入配置失败'), 500);
  }
});

configRoutes.post('/analytics/events', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, sessionId, eventType, eventData, referer } = body;

    const id = generateId();
    await c.env.DB.prepare(`
      INSERT INTO analytics_events (
        id, user_id, session_id, event_type, event_data, ip_address, user_agent, referer, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      userId || null,
      sessionId || null,
      eventType,
      JSON.stringify(eventData || {}),
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
      c.req.header('User-Agent') || null,
      referer || c.req.header('Referer') || null,
      Date.now()
    ).run();

    return c.json(success({ id }, '事件已记录'));
  } catch (err) {
    console.error('Record analytics event error:', err);
    return c.json(error('SERVER_ERROR', '记录事件失败'), 500);
  }
});

configRoutes.put('/batch', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  try {
    const body = await c.req.json();
    const { configs, changeReason } = body;

    if (!Array.isArray(configs)) {
      return c.json(error('VALIDATION_ERROR', '配置数据格式错误'), 400);
    }

    const now = Date.now();
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;
    const results: { key: string; success: boolean; error?: string }[] = [];

    for (const config of configs) {
      const { key, value } = config;

      if (!key) continue;

      try {
        const existing = await c.env.DB.prepare(
          'SELECT * FROM system_config WHERE key = ?'
        ).bind(key).first<SystemConfig>();

        const validation = validateConfigValue(
          value, 
          existing?.config_type || 'string', 
          existing?.validation_rules
        );

        if (!validation.valid) {
          results.push({ key, success: false, error: validation.error });
          continue;
        }

        if (existing) {
          await c.env.DB.prepare(`
            UPDATE system_config 
            SET value = ?, updated_at = ?
            WHERE key = ?
          `).bind(value, now, key).run();

          await logConfigChange(
            c.env, key, existing.value, value, 'update',
            payload.userId, payload.username, changeReason, ipAddress, userAgent
          );
        } else {
          results.push({ key, success: false, error: '配置项不存在' });
          continue;
        }

        results.push({ key, success: true });
      } catch (err) {
        results.push({ key, success: false, error: String(err) });
      }
    }

    return c.json(success({ results, updated: results.filter(r => r.success).length }, '配置批量更新完成'));
  } catch (err) {
    console.error('Batch update config error:', err);
    return c.json(error('SERVER_ERROR', '批量更新配置失败'), 500);
  }
});

configRoutes.post('/reset/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'super_admin') {
    return c.json(error('FORBIDDEN', '需要超级管理员权限'), 403);
  }

  const key = c.req.param('key');
  const defaultValue = DEFAULT_CONFIG_VALUES[key];

  if (!defaultValue) {
    return c.json(error('NOT_FOUND', '未找到该配置的默认值'), 404);
  }

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM system_config WHERE key = ?'
    ).bind(key).first<SystemConfig>();

    const now = Date.now();
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;

    await c.env.DB.prepare(`
      UPDATE system_config 
      SET value = ?, updated_at = ?
      WHERE key = ?
    `).bind(defaultValue.value, now, key).run();

    await logConfigChange(
      c.env, key, existing?.value || null, defaultValue.value, 'reset',
      payload.userId, payload.username, '重置为默认值', ipAddress, userAgent
    );

    return c.json(success({ key, value: defaultValue.value }, '配置已重置为默认值'));
  } catch (err) {
    console.error('Reset config error:', err);
    return c.json(error('SERVER_ERROR', '重置配置失败'), 500);
  }
});

configRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');

  try {
    const config = await c.env.DB.prepare(
      'SELECT * FROM system_config WHERE key = ?'
    ).bind(key).first<SystemConfig>();

    if (!config) {
      return c.json(error('NOT_FOUND', '配置项不存在'), 404);
    }

    return c.json(success(config));
  } catch (err) {
    console.error('Get config error:', err);
    return c.json(error('SERVER_ERROR', '获取配置失败'), 500);
  }
});

configRoutes.put('/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || (payload.role !== 'admin' && payload.role !== 'super_admin')) {
    return c.json(error('FORBIDDEN', '需要管理员权限'), 403);
  }

  const key = c.req.param('key');
  const body = await c.req.json();
  const { value, description, configType, configGroup, isPublic, isSensitive, changeReason } = body;

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM system_config WHERE key = ?'
    ).bind(key).first<SystemConfig>();

    const configTypeToUse = configType || existing?.config_type || 'string';
    const validationRules = existing?.validation_rules || DEFAULT_CONFIG_VALUES[key]?.validationRules || null;

    const validation = validateConfigValue(value, configTypeToUse, validationRules);
    if (!validation.valid) {
      return c.json(error('VALIDATION_ERROR', validation.error || '配置值验证失败'), 400);
    }

    const now = Date.now();
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;

    if (existing) {
      await c.env.DB.prepare(`
        UPDATE system_config 
        SET value = ?, description = COALESCE(?, description), 
            config_type = COALESCE(?, config_type), 
            config_group = COALESCE(?, config_group),
            is_public = COALESCE(?, is_public),
            is_sensitive = COALESCE(?, is_sensitive),
            updated_at = ?
        WHERE key = ?
      `).bind(value, description ?? null, configType ?? null, configGroup ?? null, isPublic === undefined || isPublic === null ? null : (isPublic ? 1 : 0), isSensitive === undefined || isSensitive === null ? null : (isSensitive ? 1 : 0), now, key).run();

      await logConfigChange(
        c.env, key, existing.value, value, 'update',
        payload.userId, payload.username, changeReason, ipAddress, userAgent
      );
    } else {
      await c.env.DB.prepare(`
        INSERT INTO system_config (key, value, description, config_type, config_group, is_public, is_sensitive, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(key, value, description || null, configTypeToUse, configGroup || 'other', isPublic ? 1 : 0, isSensitive ? 1 : 0, now, now).run();

      await logConfigChange(
        c.env, key, null, value, 'create',
        payload.userId, payload.username, changeReason, ipAddress, userAgent
      );
    }

    return c.json(success({ key, value }, '配置已更新'));
  } catch (err) {
    console.error('Update config error:', err);
    return c.json(error('SERVER_ERROR', '更新配置失败'), 500);
  }
});

configRoutes.delete('/:key', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(error('AUTH_ERROR', '未授权'), 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload || payload.role !== 'super_admin') {
    return c.json(error('FORBIDDEN', '需要超级管理员权限'), 403);
  }

  const key = c.req.param('key');

  try {
    const existing = await c.env.DB.prepare(
      'SELECT * FROM system_config WHERE key = ?'
    ).bind(key).first<SystemConfig>();

    if (!existing) {
      return c.json(error('NOT_FOUND', '配置项不存在'), 404);
    }

    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null;
    const userAgent = c.req.header('User-Agent') || null;

    await logConfigChange(
      c.env, key, existing.value, '', 'delete',
      payload.userId, payload.username, '删除配置', ipAddress, userAgent
    );

    await c.env.DB.prepare('DELETE FROM system_config WHERE key = ?').bind(key).run();

    return c.json(success(null, '配置已删除'));
  } catch (err) {
    console.error('Delete config error:', err);
    return c.json(error('SERVER_ERROR', '删除配置失败'), 500);
  }
});
