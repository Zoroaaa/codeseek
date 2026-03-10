-- ===============================================
-- 系统初始化数据
-- 版本: 精简优化版本
-- 说明: 包含系统配置、官方标签、邮件模板等初始化数据
-- ===============================================

-- ===============================================
-- 1. 系统配置初始化
-- ===============================================

-- 系统配置初始化
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
-- 基础配置
('site_name', '磁力快搜', '网站名称', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 用户限制配置
('max_search_history', '1000', '最大搜索历史记录数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '1000', '最大收藏数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_username_length', '3', '用户名最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_username_length', '20', '用户名最大长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_password_length', '6', '密码最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 搜索源检查配置
('source_check_enabled', '1', '启用搜索源状态检查', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_concurrent_checks', '3', '最大并发检查数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_check_timeout', '10000', '默认检查超时时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_duration_ms', '300000', '状态缓存时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_cache_entries', '10000', '最大缓存条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('health_update_interval', '3600000', '健康度统计更新间隔（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 社区功能配置
('community_enabled', '1', '启用搜索源共享社区功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_require_approval', '0', '新分享的搜索源需要审核', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_max_shares_per_user', '50', '每个用户最大分享数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 邮箱验证相关配置
('email_verification_enabled', '1', '是否启用邮箱验证功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_verification_required', '0', '注册时是否强制邮箱验证', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('verification_code_length', '6', '验证码长度', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('verification_code_expiry', '900000', '验证码过期时间（毫秒，默认15分钟）', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_verification_attempts', '3', '最大验证尝试次数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_rate_limit_per_hour', '5', '每小时最大发送邮件数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_rate_limit_per_day', '20', '每天最大发送邮件数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('resend_api_key_set', '0', 'Resend API密钥是否已配置', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_from_email', 'noreply@codeseek.pp.ua', '默认发件人邮箱', 'string', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_from_name', '磁力快搜', '默认发件人姓名', 'string', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 忘记密码功能配置
('forgot_password_enabled', '1', '是否启用忘记密码功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('forgot_password_rate_limit_per_hour', '3', '忘记密码每小时最大请求次数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('forgot_password_rate_limit_per_day', '10', '忘记密码每天最大请求次数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('reset_password_require_verification', '1', '重置密码是否需要邮箱验证', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('reset_password_code_expiry', '1800000', '重置密码验证码过期时间（毫秒，默认30分钟）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 安全相关配置
('password_reset_max_attempts', '5', '密码重置最大尝试次数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('password_reset_lockout_duration', '3600000', '密码重置锁定持续时间（毫秒，默认1小时）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('force_logout_after_password_reset', '1', '密码重置后是否强制退出所有设备', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 邮件模板配置
('forgot_password_email_subject', '重置您的密码', '忘记密码邮件主题', 'string', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('forgot_password_success_message', '如果该邮箱已注册，我们已发送重置链接', '忘记密码成功提示信息', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 安全监控配置
('security_monitoring_enabled', '1', '是否启用安全事件监控', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('security_event_retention_days', '90', '安全事件保留天数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('high_risk_threshold', '70', '高风险事件阈值', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 异常登录检测
('detect_unusual_login_location', '1', '检测异常登录地点', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detect_unusual_login_time', '1', '检测异常登录时间', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detect_multiple_failed_logins', '1', '检测多次登录失败', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 通知配置
('notify_admin_on_suspicious_activity', '1', '可疑活动时通知管理员', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('notify_user_on_password_reset', '1', '密码重置时通知用户', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 2. 官方标签初始化
-- ===============================================

-- 官方标签初始化
INSERT OR IGNORE INTO community_source_tags (id, tag_name, tag_description, tag_color, is_official, tag_active, created_by, created_at, updated_at) VALUES
('tag_verified', '已验证', '经过验证的可靠搜索源', '#10b981', 1, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_popular', '热门', '下载量较高的热门搜索源', '#f59e0b', 1, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_new', '最新', '新近添加的搜索源', '#3b82f6', 1, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_recommended', '推荐', '官方推荐的优质搜索源', '#8b5cf6', 1, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_high_quality', '高质量', '质量较高的搜索源', '#ef4444', 1, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_jav', 'JAV', 'JAV相关搜索源', '#f97316', 0, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_movie', '电影', '电影相关搜索源', '#06b6d4', 0, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_torrent', '种子', '种子下载相关', '#84cc16', 0, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_magnet', '磁力', '磁力链接搜索', '#22c55e', 0, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_hd', '高清', '高清资源相关', '#a855f7', 0, 1, 'system', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);


-- ===============================================
-- 4. 邮件模板初始化
-- ===============================================

-- 插入默认邮件模板
INSERT OR IGNORE INTO email_templates (
    id, template_name, template_type, subject_template, html_template, text_template,
    required_variables, created_at, updated_at
) VALUES 
-- 注册验证模板
('tpl_register_verify', 'registration_verification', 'registration',
 '验证您的{{siteName}}账户', 
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>验证邮箱</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证您的邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">感谢您注册{{siteName}}！请使用以下验证码完成邮箱验证：</p><div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有注册此账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '验证您的{{siteName}}账户\n\n您好 {{username}}，\n\n感谢您注册{{siteName}}！您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有注册此账户，请忽略此邮件。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 忘记密码模板
('tpl_forgot_password', 'forgot_password_verification', 'forgot_password',
 '重置您的{{siteName}}密码', 
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>密码重置</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">密码重置</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了您的密码重置请求。如果这是您本人操作，请使用以下验证码重置密码：</p><div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;"><p style="font-size: 14px; color: #856404; margin: 0;"><strong>安全提醒：</strong></p><ul style="font-size: 14px; color: #856404; margin: 10px 0;"><li>如果您没有申请密码重置，请忽略此邮件</li><li>请勿将验证码分享给任何人</li><li>建议使用强密码保护您的账户</li></ul></div><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '重置您的{{siteName}}密码\n\n您好 {{username}}，\n\n我们收到了您的密码重置请求。如果这是您本人操作，请使用以下验证码：\n\n验证码：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n安全提醒：\n- 如果您没有申请密码重置，请忽略此邮件\n- 请勿将验证码分享给任何人\n- 建议使用强密码保护您的账户\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 邮箱更改模板
('tpl_email_change', 'email_change', 'email_change',
 '验证您的新邮箱地址',
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>邮箱验证</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证新邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">您申请将账户邮箱从 <strong>{{oldEmail}}</strong> 更改为 <strong>{{newEmail}}</strong>。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">请使用以下验证码验证您的新邮箱地址：</p><div style="background: #f8f9fa; border: 2px dashed #00b894; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #00b894; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有申请更改邮箱，请立即联系我们。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '验证您的新邮箱地址\n\n您好 {{username}}，\n\n您申请将账户邮箱从 {{oldEmail}} 更改为 {{newEmail}}。\n\n您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有申请更改邮箱，请立即联系我们。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes", "oldEmail", "newEmail"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 账户删除模板
('tpl_account_delete', 'account_delete', 'account_delete',  
 '确认删除您的{{siteName}}账户',
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>账户删除确认</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #e84393 0%, #d63031 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">账户删除确认</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了删除您账户的申请。这将<strong>永久删除</strong>您的所有数据，包括收藏、历史记录等。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您确认要删除账户，请使用以下验证码：</p><div style="background: #f8f9fa; border: 2px dashed #e84393; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #e84393; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;"><p style="font-size: 14px; color: #856404; margin: 0;"><strong>重要提醒：</strong>账户删除后无法恢复，请谨慎操作！</p></div><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您不想删除账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '确认删除您的{{siteName}}账户\n\n您好 {{username}}，\n\n我们收到了删除您账户的申请。这将永久删除您的所有数据。\n\n如果您确认要删除账户，验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n重要提醒：账户删除后无法恢复，请谨慎操作！\n\n如果您不想删除账户，请忽略此邮件。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);