-- ===============================================
-- 系统初始化数据
-- 版本: 2.0
-- 说明: 包含角色、系统配置、配置分组、邮件模板等初始化数据
-- 执行顺序: 05
-- ===============================================

-- ===============================================
-- 1. 角色初始化数据
-- ===============================================

INSERT OR IGNORE INTO roles (id, name, display_name, description, permissions, is_system, priority, created_at, updated_at)
VALUES 
    ('super_admin', 'super_admin', '超级管理员', '拥有系统最高权限，可以管理所有用户和系统配置', '["*"]', 1, 100, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('admin', 'admin', '管理员', '可以管理用户、查看统计数据、处理举报等', '["user:read", "user:write", "stats:read", "report:read", "report:write", "source:read", "source:write", "community:read", "community:write"]', 1, 50, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('user', 'user', '普通用户', '普通注册用户，拥有基本的搜索和收藏功能', '["search", "favorite", "history", "sync", "community:share", "community:review"]', 1, 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('guest', 'guest', '访客用户', '未登录用户，只能使用基础搜索功能', '["search"]', 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 2. 配置分组初始化数据
-- ===============================================

INSERT OR IGNORE INTO config_groups (id, name, display_name, description, icon, display_order, created_at, updated_at) VALUES
    ('basic', 'basic', '基础配置', '网站基础信息配置', 'Settings', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('user_limits', 'user_limits', '用户限制', '用户相关限制配置', 'Users', 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('source_check', 'source_check', '搜索源检查', '搜索源状态检查配置', 'Activity', 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('community', 'community', '社区功能', '社区分享功能配置', 'Globe', 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('email', 'email', '邮箱配置', '邮箱验证相关配置', 'Mail', 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('password', 'password', '密码配置', '密码找回相关配置', 'Key', 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('security', 'security', '安全配置', '安全监控相关配置', 'Shield', 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('features', 'features', '功能开关', '功能模块开关配置', 'ToggleLeft', 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('session', 'session', '会话配置', '用户会话相关配置', 'Clock', 9, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('search', 'search', '搜索配置', '搜索功能相关配置', 'Search', 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('pagination', 'pagination', '分页配置', '分页相关配置', 'List', 11, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cleanup', 'cleanup', '数据清理', '数据清理相关配置', 'Trash2', 12, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 3. 系统配置初始化数据
-- ===============================================

INSERT OR IGNORE INTO system_config (key, value, description, config_type, config_group, is_public, display_order, validation_rules, created_at, updated_at) VALUES
    -- 网站基础配置
    ('site_name', '磁力快搜', '网站名称', 'string', 'basic', 1, 1, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('site_description', '搜索全网资源，一步直达', '网站描述', 'string', 'basic', 1, 2, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_registration', '1', '是否开放注册', 'boolean', 'basic', 1, 3, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 用户限制配置
    ('max_search_history', '1000', '最大搜索历史记录数', 'integer', 'user_limits', 1, 10, '{"min": 100, "max": 5000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_favorites', '1000', '最大收藏数量', 'integer', 'user_limits', 1, 11, '{"min": 100, "max": 5000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('min_username_length', '3', '用户名最小长度', 'integer', 'user_limits', 1, 12, '{"min": 2, "max": 20}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_username_length', '20', '用户名最大长度', 'integer', 'user_limits', 1, 13, '{"min": 5, "max": 50}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('min_password_length', '6', '密码最小长度', 'integer', 'user_limits', 1, 14, '{"min": 4, "max": 32}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_password_length', '100', '密码最大长度', 'integer', 'user_limits', 1, 15, '{"min": 32, "max": 200}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_tags_per_user', '100', '每个用户最大标签数量', 'integer', 'user_limits', 1, 16, '{"min": 10, "max": 200}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_batch_config_update', '100', '批量配置更新最大数量', 'integer', 'user_limits', 1, 17, '{"min": 10, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_sync_favorites', '1000', '同步收藏最大数量', 'integer', 'user_limits', 1, 18, '{"min": 100, "max": 5000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 搜索源检查配置
    ('source_check_enabled', '1', '启用搜索源状态检查', 'boolean', 'source_check', 1, 20, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_concurrent_checks', '3', '最大并发检查数', 'integer', 'source_check', 1, 21, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('default_check_timeout', '10000', '默认检查超时时间（毫秒）', 'integer', 'source_check', 1, 22, '{"min": 1000, "max": 60000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('batch_check_timeout_ms', '5000', '批量检查超时时间（毫秒）', 'integer', 'source_check', 1, 23, '{"min": 1000, "max": 30000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('cache_duration_ms', '300000', '状态缓存时间（毫秒）', 'integer', 'source_check', 1, 24, '{"min": 60000, "max": 86400000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_batch_check', '50', '批量检查最大数量', 'integer', 'source_check', 1, 25, '{"min": 10, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_cache_age_ms', '300000', '缓存最大有效期（毫秒）', 'integer', 'source_check', 1, 26, '{"min": 60000, "max": 86400000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 社区功能配置
    ('community_enabled', '1', '启用搜索源共享社区功能', 'boolean', 'community', 1, 30, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('community_require_approval', '0', '新分享的搜索源需要审核', 'boolean', 'community', 0, 31, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('community_max_shares_per_user', '50', '每个用户最大分享数量', 'integer', 'community', 1, 32, '{"min": 1, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 'community', 1, 33, '{"min": 1.0, "max": 5.0}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_tags_per_source', '10', '每个搜索源最大标签数', 'integer', 'community', 1, 34, '{"min": 1, "max": 30}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_comment_length', '1000', '评论最大长度', 'integer', 'community', 1, 35, '{"min": 100, "max": 5000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_report_reason_length', '100', '举报原因最大长度', 'integer', 'community', 1, 36, '{"min": 50, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_report_details_length', '1000', '举报详情最大长度', 'integer', 'community', 1, 37, '{"min": 100, "max": 5000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('tag_name_min_length', '2', '标签名称最小长度', 'integer', 'community', 1, 38, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('tag_name_max_length', '20', '标签名称最大长度', 'integer', 'community', 1, 39, '{"min": 5, "max": 50}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('source_name_max_length', '100', '搜索源名称最大长度', 'integer', 'community', 1, 40, '{"min": 10, "max": 200}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('source_description_max_length', '2000', '搜索源描述最大长度', 'integer', 'community', 1, 41, '{"min": 100, "max": 10000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 邮箱验证配置
    ('email_verification_enabled', '1', '是否启用邮箱验证功能', 'boolean', 'email', 1, 50, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('email_verification_required', '0', '注册时是否强制邮箱验证', 'boolean', 'email', 1, 51, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('verification_code_expiry', '900000', '验证码过期时间（毫秒，默认15分钟）', 'integer', 'email', 1, 53, '{"min": 60000, "max": 3600000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_verification_attempts', '5', '最大验证尝试次数', 'integer', 'email', 1, 54, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('email_rate_limit_per_hour', '5', '每小时最大发送邮件数', 'integer', 'email', 0, 55, '{"min": 1, "max": 20}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('email_rate_limit_per_day', '20', '每天最大发送邮件数', 'integer', 'email', 0, 56, '{"min": 1, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('resend_interval_ms', '60000', '邮件重发间隔（毫秒，默认1分钟）', 'integer', 'email', 1, 59, '{"min": 30000, "max": 300000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('change_request_expiry_ms', '1800000', '邮箱更改请求过期时间（毫秒，默认30分钟）', 'integer', 'email', 0, 60, '{"min": 600000, "max": 7200000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('change_pending_expiry_minutes', '15', '邮箱更改待确认过期时间（分钟）', 'integer', 'email', 0, 61, '{"min": 5, "max": 60}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 密码重置配置
    ('forgot_password_enabled', '1', '是否启用忘记密码功能', 'boolean', 'password', 1, 60, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('reset_password_code_expiry', '1800000', '重置密码验证码过期时间（毫秒，默认30分钟）', 'integer', 'password', 1, 61, '{"min": 600000, "max": 7200000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('password_reset_max_attempts', '5', '密码重置最大尝试次数', 'integer', 'password', 1, 62, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('password_reset_lockout_duration', '3600000', '密码重置锁定持续时间（毫秒，默认1小时）', 'integer', 'password', 1, 63, '{"min": 300000, "max": 86400000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 安全配置
    ('security_monitoring_enabled', '1', '是否启用安全事件监控', 'boolean', 'security', 1, 70, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('security_event_retention_days', '90', '安全事件保留天数', 'integer', 'security', 1, 71, '{"min": 30, "max": 365}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('high_risk_threshold', '50', '高风险事件阈值', 'integer', 'security', 1, 72, '{"min": 0, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_login_attempts', '5', '最大登录尝试次数', 'integer', 'security', 1, 73, '{"min": 3, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('lockout_duration_ms', '900000', '账户锁定时长（毫秒，默认15分钟）', 'integer', 'security', 1, 74, '{"min": 60000, "max": 3600000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('recent_failed_logins_threshold', '3', '近期登录失败阈值', 'integer', 'security', 1, 75, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('recent_ip_logins_threshold', '3', '近期IP登录变化阈值', 'integer', 'security', 1, 76, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('recent_password_changes_threshold', '2', '近期密码修改阈值', 'integer', 'security', 1, 77, '{"min": 1, "max": 10}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 功能开关
    ('enable_search_history', '1', '启用搜索历史功能', 'boolean', 'features', 1, 80, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_favorites', '1', '启用收藏功能', 'boolean', 'features', 1, 81, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_analytics', '1', '启用统计分析功能', 'boolean', 'features', 1, 82, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_dark_mode', '1', '启用深色模式切换', 'boolean', 'features', 1, 83, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_proxy', '1', '启用代理服务器', 'boolean', 'features', 1, 84, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('enable_search_suggestions', '1', '启用搜索建议', 'boolean', 'features', 1, 85, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 会话配置
    ('session_timeout_minutes', '1440', '会话超时时间（分钟，默认24小时）', 'integer', 'session', 1, 90, '{"min": 30, "max": 10080}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_sessions_per_user', '5', '每用户最大会话数', 'integer', 'session', 1, 91, '{"min": 1, "max": 20}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('remember_me_days', '30', '记住我功能有效天数', 'integer', 'session', 1, 92, '{"min": 1, "max": 365}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 搜索配置
    ('default_search_sources', '20', '默认显示的搜索源数量', 'integer', 'search', 1, 100, '{"min": 5, "max": 50}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('search_debounce_ms', '300', '搜索防抖延迟（毫秒）', 'integer', 'search', 1, 101, '{"min": 100, "max": 2000}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('trending_searches_hours', '24', '热门搜索统计时间范围（小时）', 'integer', 'search', 1, 102, '{"min": 1, "max": 168}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_keyword_length', '200', '搜索关键词最大长度', 'integer', 'search', 1, 103, '{"min": 50, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_sources_per_search', '50', '每次搜索最大搜索源数量', 'integer', 'search', 1, 104, '{"min": 10, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('suggestions_min_keyword_length', '2', '搜索建议最小关键词长度', 'integer', 'search', 1, 105, '{"min": 1, "max": 5}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('suggestions_max_limit', '20', '搜索建议最大数量', 'integer', 'search', 1, 106, '{"min": 5, "max": 50}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('trending_max_hours', '168', '热门搜索最大统计时间（小时）', 'integer', 'search', 1, 107, '{"min": 24, "max": 720}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('trending_default_limit', '20', '热门搜索默认数量', 'integer', 'search', 1, 108, '{"min": 5, "max": 50}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('trending_max_limit', '50', '热门搜索最大数量', 'integer', 'search', 1, 109, '{"min": 10, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 分页配置
    ('default_page_size', '20', '默认分页大小', 'integer', 'pagination', 1, 110, '{"min": 10, "max": 100}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_page_size', '100', '最大分页大小', 'integer', 'pagination', 1, 111, '{"min": 50, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_log_page_size', '200', '日志最大分页大小', 'integer', 'pagination', 1, 112, '{"min": 50, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('default_history_limit', '50', '默认历史记录限制', 'integer', 'pagination', 1, 113, '{"min": 10, "max": 200}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('max_history_limit', '200', '最大历史记录限制', 'integer', 'pagination', 1, 114, '{"min": 50, "max": 500}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 数据清理配置
    ('password_reset_log_retention_days', '30', '密码重置日志保留天数', 'integer', 'cleanup', 1, 120, '{"min": 7, "max": 90}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('user_actions_retention_days', '90', '用户行为日志保留天数', 'integer', 'cleanup', 1, 121, '{"min": 30, "max": 365}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('email_verification_retention_days', '7', '邮箱验证记录保留天数', 'integer', 'cleanup', 1, 122, '{"min": 1, "max": 30}', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 4. 邮件模板初始化数据
-- ===============================================

INSERT OR IGNORE INTO email_templates (
    id, template_name, template_type, subject_template, html_template, text_template,
    required_variables, created_at, updated_at
) VALUES 
    ('tpl_register_verify', 'registration_verification', 'registration',
     '验证您的{{siteName}}账户', 
     '<!DOCTYPE html><html><head><meta charset="utf-8"><title>验证邮箱</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证您的邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">感谢您注册{{siteName}}！请使用以下验证码完成邮箱验证：</p><div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有注册此账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
     '验证您的{{siteName}}账户\n\n您好 {{username}}，\n\n感谢您注册{{siteName}}！您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有注册此账户，请忽略此邮件。\n\n{{siteName}}',
     '["username", "siteName", "verificationCode", "expiryMinutes"]',
     strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

    ('tpl_forgot_password', 'forgot_password_verification', 'forgot_password',
     '重置您的{{siteName}}密码', 
     '<!DOCTYPE html><html><head><meta charset="utf-8"><title>密码重置</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">密码重置</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了您的密码重置请求。如果这是您本人操作，请使用以下验证码重置密码：</p><div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;"><p style="font-size: 14px; color: #856404; margin: 0;"><strong>安全提醒：</strong></p><ul style="font-size: 14px; color: #856404; margin: 10px 0;"><li>如果您没有申请密码重置，请忽略此邮件</li><li>请勿将验证码分享给任何人</li><li>建议使用强密码保护您的账户</li></ul></div><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
     '重置您的{{siteName}}密码\n\n您好 {{username}}，\n\n我们收到了您的密码重置请求。如果这是您本人操作，请使用以下验证码：\n\n验证码：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n安全提醒：\n- 如果您没有申请密码重置，请忽略此邮件\n- 请勿将验证码分享给任何人\n- 建议使用强密码保护您的账户\n\n{{siteName}}',
     '["username", "siteName", "verificationCode", "expiryMinutes"]',
     strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

    ('tpl_email_change', 'email_change', 'email_change',
     '验证您的新邮箱地址',
     '<!DOCTYPE html><html><head><meta charset="utf-8"><title>邮箱验证</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证新邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">您申请将账户邮箱从 <strong>{{oldEmail}}</strong> 更改为 <strong>{{newEmail}}</strong>。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">请使用以下验证码验证您的新邮箱地址：</p><div style="background: #f8f9fa; border: 2px dashed #00b894; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #00b894; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有申请更改邮箱，请立即联系我们。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
     '验证您的新邮箱地址\n\n您好 {{username}}，\n\n您申请将账户邮箱从 {{oldEmail}} 更改为 {{newEmail}}。\n\n您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有申请更改邮箱，请立即联系我们。\n\n{{siteName}}',
     '["username", "siteName", "verificationCode", "expiryMinutes", "oldEmail", "newEmail"]',
     strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

    ('tpl_account_delete', 'account_delete', 'account_delete',  
     '确认删除您的{{siteName}}账户',
     '<!DOCTYPE html><html><head><meta charset="utf-8"><title>账户删除确认</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #e84393 0%, #d63031 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">账户删除确认</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了删除您账户的申请。这将<strong>永久删除</strong>您的所有数据，包括收藏、历史记录等。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您确认要删除账户，请使用以下验证码：</p><div style="background: #f8f9fa; border: 2px dashed #e84393; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #e84393; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;"><p style="font-size: 14px; color: #856404; margin: 0;"><strong>重要提醒：</strong>账户删除后无法恢复，请谨慎操作！</p></div><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您不想删除账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
     '确认删除您的{{siteName}}账户\n\n您好 {{username}}，\n\n我们收到了删除您账户的申请。这将永久删除您的所有数据。\n\n如果您确认要删除账户，验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n重要提醒：账户删除后无法恢复，请谨慎操作！\n\n如果您不想删除账户，请忽略此邮件。\n\n{{siteName}}',
     '["username", "siteName", "verificationCode", "expiryMinutes"]',
     strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
