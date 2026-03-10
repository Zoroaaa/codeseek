-- ===============================================
-- 邮箱验证与安全功能模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含邮箱验证、密码重置、安全监控等功能
-- ===============================================

-- ===============================================
-- 1. 邮箱验证功能
-- ===============================================

-- 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,                        -- 验证记录唯一标识
    user_id TEXT,                               -- 关联用户ID（注册验证时可为空）
    email TEXT NOT NULL,                        -- 要验证的邮箱地址
    email_hash TEXT NOT NULL,                   -- 邮箱哈希值（用于索引）
    verification_code TEXT NOT NULL,            -- 6位数字验证码
    code_hash TEXT NOT NULL,                    -- 验证码哈希值
    
    -- 验证类型和状态
    verification_type TEXT NOT NULL,            -- 验证类型：registration/email_change/password_reset/account_delete
    status TEXT DEFAULT 'pending',              -- 状态：pending/used/expired/failed
    
    -- 安全相关
    ip_address TEXT,                            -- 申请验证的IP地址
    user_agent TEXT,                            -- 用户代理信息
    attempt_count INTEGER DEFAULT 0,            -- 验证尝试次数
    max_attempts INTEGER DEFAULT 3,             -- 最大尝试次数
    
    -- 时间管理
    expires_at INTEGER NOT NULL,                -- 验证码过期时间（通常5-15分钟）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    used_at INTEGER,                            -- 使用时间戳
    last_attempt_at INTEGER,                    -- 最后尝试时间
    
    -- 附加数据
    metadata TEXT DEFAULT '{}',                 -- 附加信息（JSON格式）
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 邮箱更改临时表
CREATE TABLE IF NOT EXISTS email_change_requests (
    id TEXT PRIMARY KEY,                        -- 请求唯一标识
    user_id TEXT NOT NULL,                      -- 用户ID
    old_email TEXT NOT NULL,                    -- 原邮箱地址
    new_email TEXT NOT NULL,                    -- 新邮箱地址
    new_email_hash TEXT NOT NULL,               -- 新邮箱哈希
    
    -- 验证状态
    old_email_verified INTEGER DEFAULT 0,      -- 原邮箱是否已验证
    new_email_verified INTEGER DEFAULT 0,      -- 新邮箱是否已验证
    status TEXT DEFAULT 'pending',              -- pending/completed/expired/cancelled
    
    -- 验证码关联
    old_email_verification_id TEXT,             -- 原邮箱验证记录ID
    new_email_verification_id TEXT,             -- 新邮箱验证记录ID
    
    -- 时间管理
    expires_at INTEGER NOT NULL,                -- 整个请求过期时间（通常30分钟）
    created_at INTEGER NOT NULL,                -- 创建时间
    updated_at INTEGER,                         -- 更新时间
    completed_at INTEGER,                       -- 完成时间
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (old_email_verification_id) REFERENCES email_verifications (id) ON DELETE SET NULL,
    FOREIGN KEY (new_email_verification_id) REFERENCES email_verifications (id) ON DELETE SET NULL
);

-- ===============================================
-- 2. 密码重置与安全功能
-- ===============================================

-- 密码重置日志表（用于安全审计和频率限制）
CREATE TABLE IF NOT EXISTS password_reset_logs (
    id TEXT PRIMARY KEY,                        -- 重置记录唯一标识
    user_id TEXT,                               -- 用户ID（可能为空，用于记录未找到用户的情况）
    email TEXT NOT NULL,                        -- 请求重置的邮箱
    email_hash TEXT NOT NULL,                   -- 邮箱哈希（用于索引）
    
    -- 请求信息
    request_type TEXT NOT NULL,                 -- 请求类型：forgot_password/change_password
    request_status TEXT DEFAULT 'initiated',   -- 状态：initiated/code_sent/code_verified/completed/failed
    
    -- 安全信息
    ip_address TEXT,                            -- 请求IP地址
    user_agent TEXT,                            -- 用户代理
    verification_code_sent INTEGER DEFAULT 0,   -- 是否已发送验证码
    verification_attempts INTEGER DEFAULT 0,    -- 验证尝试次数
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    code_sent_at INTEGER,                       -- 验证码发送时间
    verified_at INTEGER,                        -- 验证成功时间
    completed_at INTEGER,                       -- 重置完成时间
    
    -- 关联验证记录
    verification_id TEXT,                       -- 关联的邮箱验证记录ID
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (verification_id) REFERENCES email_verifications (id) ON DELETE SET NULL
);

-- 安全锁定表（防止暴力破解）
CREATE TABLE IF NOT EXISTS security_lockouts (
    id TEXT PRIMARY KEY,                        -- 锁定记录唯一标识
    lockout_type TEXT NOT NULL,                 -- 锁定类型：password_reset/login/verification
    identifier TEXT NOT NULL,                   -- 标识符（邮箱/IP等）
    identifier_hash TEXT NOT NULL,              -- 标识符哈希
    
    -- 锁定信息
    attempt_count INTEGER DEFAULT 1,            -- 尝试次数
    max_attempts INTEGER NOT NULL,              -- 最大允许次数
    lockout_duration INTEGER NOT NULL,          -- 锁定持续时间（毫秒）
    
    -- 时间管理
    first_attempt_at INTEGER NOT NULL,          -- 首次尝试时间
    last_attempt_at INTEGER NOT NULL,           -- 最后尝试时间
    locked_until INTEGER NOT NULL,              -- 锁定到什么时候
    created_at INTEGER NOT NULL,                -- 创建时间戳
    
    -- 额外信息
    ip_address TEXT,                            -- 相关IP地址
    user_agent TEXT,                            -- 用户代理
    notes TEXT,                                 -- 备注信息
    
    UNIQUE(lockout_type, identifier_hash)
);

-- 用户安全事件记录表（用于详细的安全审计）
CREATE TABLE IF NOT EXISTS user_security_events (
    id TEXT PRIMARY KEY,                        -- 事件唯一标识
    user_id TEXT,                               -- 用户ID（可能为空）
    event_type TEXT NOT NULL,                   -- 事件类型
    event_subtype TEXT,                         -- 事件子类型
    
    -- 事件详情
    event_status TEXT DEFAULT 'success',        -- 事件状态：success/failed/blocked
    event_data TEXT DEFAULT '{}',              -- 事件数据（JSON格式）
    
    -- 安全上下文
    ip_address TEXT,                            -- IP地址
    user_agent TEXT,                            -- 用户代理
    session_id TEXT,                            -- 会话ID
    
    -- 风险评估
    risk_score INTEGER DEFAULT 0,               -- 风险评分（0-100）
    risk_factors TEXT DEFAULT '[]',             -- 风险因素（JSON数组）
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 3. 邮件系统功能
-- ===============================================

-- 邮件发送日志表
CREATE TABLE IF NOT EXISTS email_send_logs (
    id TEXT PRIMARY KEY,                        -- 发送记录唯一标识
    user_id TEXT,                               -- 关联用户ID
    recipient_email TEXT NOT NULL,              -- 收件人邮箱
    email_type TEXT NOT NULL,                   -- 邮件类型：verification/password_reset/email_change/account_delete
    
    -- 发送状态
    send_status TEXT NOT NULL,                  -- 发送状态：pending/sent/failed/delivered/bounced
    provider TEXT DEFAULT 'resend',             -- 邮件服务商
    provider_message_id TEXT,                   -- 服务商消息ID
    
    -- 发送详情
    template_name TEXT,                         -- 使用的模板名称
    subject TEXT,                               -- 邮件主题
    send_error TEXT,                            -- 发送错误信息
    
    -- 限流和安全
    ip_address TEXT,                            -- 发送请求的IP
    rate_limit_key TEXT,                        -- 限流键
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间
    sent_at INTEGER,                            -- 发送时间
    delivered_at INTEGER,                       -- 投递时间
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 邮件模板表（可选）
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,                        -- 模板唯一标识
    template_name TEXT UNIQUE NOT NULL,         -- 模板名称
    template_type TEXT NOT NULL,                -- 模板类型
    
    -- 模板内容
    subject_template TEXT NOT NULL,             -- 主题模板
    html_template TEXT NOT NULL,                -- HTML模板
    text_template TEXT,                         -- 纯文本模板
    
    -- 模板变量
    required_variables TEXT DEFAULT '[]',       -- 必需变量（JSON数组）
    optional_variables TEXT DEFAULT '[]',       -- 可选变量（JSON数组）
    
    -- 状态和版本
    is_active INTEGER DEFAULT 1,                -- 是否激活
    version INTEGER DEFAULT 1,                  -- 模板版本
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间
    updated_at INTEGER NOT NULL,                -- 更新时间
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0               -- 使用次数
);

-- ===============================================
-- 4. 索引定义
-- ===============================================

-- 邮箱验证索引
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_hash ON email_verifications(email_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_type ON email_verifications(user_id, verification_type);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON email_verifications(status);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_created ON email_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code_hash ON email_verifications(code_hash);

-- 邮箱更改请求索引
CREATE INDEX IF NOT EXISTS idx_email_change_user_status ON email_change_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_change_new_email ON email_change_requests(new_email_hash);
CREATE INDEX IF NOT EXISTS idx_email_change_expires ON email_change_requests(expires_at);

-- 密码重置日志索引
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_email ON password_reset_logs(email_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_user ON password_reset_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_status ON password_reset_logs(request_status);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_created ON password_reset_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_logs_ip ON password_reset_logs(ip_address);

-- 安全锁定索引
CREATE INDEX IF NOT EXISTS idx_security_lockouts_identifier ON security_lockouts(lockout_type, identifier_hash);
CREATE INDEX IF NOT EXISTS idx_security_lockouts_locked_until ON security_lockouts(locked_until);
CREATE INDEX IF NOT EXISTS idx_security_lockouts_created ON security_lockouts(created_at DESC);

-- 用户安全事件索引
CREATE INDEX IF NOT EXISTS idx_security_events_user ON user_security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON user_security_events(event_type, event_subtype);
CREATE INDEX IF NOT EXISTS idx_security_events_status ON user_security_events(event_status);
CREATE INDEX IF NOT EXISTS idx_security_events_risk ON user_security_events(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON user_security_events(ip_address);

-- 邮件发送日志索引  
CREATE INDEX IF NOT EXISTS idx_email_logs_user_created ON email_send_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_send_logs(recipient_email, email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_send_logs(send_status);
CREATE INDEX IF NOT EXISTS idx_email_logs_rate_limit ON email_send_logs(rate_limit_key, created_at);

-- 邮件模板索引
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(template_name);
CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

-- ===============================================
-- 5. 触发器定义
-- ===============================================

-- 自动清理过期验证码
CREATE TRIGGER IF NOT EXISTS cleanup_expired_verifications
    AFTER INSERT ON email_verifications
    FOR EACH ROW
    BEGIN
        DELETE FROM email_verifications 
        WHERE expires_at < strftime('%s', 'now') * 1000 
        AND status = 'pending';
    END;

-- 自动清理过期邮箱更改请求
CREATE TRIGGER IF NOT EXISTS cleanup_expired_email_changes
    AFTER INSERT ON email_change_requests
    FOR EACH ROW
    BEGIN
        DELETE FROM email_change_requests 
        WHERE expires_at < strftime('%s', 'now') * 1000 
        AND status = 'pending';
    END;

-- 更新邮件模板时间戳
CREATE TRIGGER IF NOT EXISTS update_email_template_timestamp
    AFTER UPDATE ON email_templates
    FOR EACH ROW
    BEGIN
        UPDATE email_templates SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- 清理过期安全锁定和密码重置日志
CREATE TRIGGER IF NOT EXISTS cleanup_expired_password_reset_logs
    AFTER INSERT ON password_reset_logs
    FOR EACH ROW
    BEGIN
        -- 清理30天前的密码重置日志
        DELETE FROM password_reset_logs 
        WHERE created_at < strftime('%s', 'now', '-30 days') * 1000;
        
        -- 清理过期的安全锁定记录
        DELETE FROM security_lockouts 
        WHERE locked_until < strftime('%s', 'now') * 1000;
    END;

-- 更新邮件模板使用次数
CREATE TRIGGER IF NOT EXISTS update_email_template_usage_on_send
    AFTER INSERT ON email_send_logs
    FOR EACH ROW
    WHEN NEW.template_name IS NOT NULL
    BEGIN
        UPDATE email_templates 
        SET usage_count = usage_count + 1
        WHERE template_name = NEW.template_name;
    END;