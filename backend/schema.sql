-- 磁力快搜数据库结构 - 优化版本
-- 适用于 Cloudflare D1 数据库

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT DEFAULT '["search","favorite","history","sync"]',
    settings TEXT DEFAULT '{}',
    is_active INTEGER DEFAULT 1,
    last_login INTEGER,
    login_count INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until INTEGER DEFAULT 0
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    device_info TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT NOT NULL,
    icon TEXT,
    keyword TEXT,
    tags TEXT DEFAULT '[]',
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户搜索历史表
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type TEXT DEFAULT 'basic',
    duration INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 搜索缓存表
CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    keyword_hash TEXT NOT NULL,
    results TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER NOT NULL
);

-- 用户行为记录表
CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    data TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    config_type TEXT DEFAULT 'string',
    is_public INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 站点状态监控表
CREATE TABLE IF NOT EXISTS site_monitoring (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    status INTEGER DEFAULT 0,
    response_time INTEGER,
    last_checked INTEGER NOT NULL,
    error_message TEXT,
    check_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    uptime_percentage REAL DEFAULT 0.0
);

-- 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'general', 'complaint')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
    admin_response TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    is_read INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    action_url TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 统计数据表
CREATE TABLE IF NOT EXISTS statistics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value TEXT NOT NULL,
    date TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL
);

-- 创建优化的索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active_login ON users(is_active, last_login);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON user_favorites(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);
CREATE INDEX IF NOT EXISTS idx_favorites_updated ON user_favorites(updated_at);

CREATE INDEX IF NOT EXISTS idx_history_user_created ON user_search_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_keyword ON user_search_history(keyword);
CREATE INDEX IF NOT EXISTS idx_history_type ON user_search_history(search_type);

CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_cache_accessed ON search_cache(last_accessed);

CREATE INDEX IF NOT EXISTS idx_actions_user_created ON user_actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action_created ON user_actions(action, created_at);
CREATE INDEX IF NOT EXISTS idx_actions_resource ON user_actions(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_config_public ON system_config(is_public);
CREATE INDEX IF NOT EXISTS idx_config_type ON system_config(config_type);

CREATE INDEX IF NOT EXISTS idx_monitoring_checked ON site_monitoring(last_checked);
CREATE INDEX IF NOT EXISTS idx_monitoring_status ON site_monitoring(status);

CREATE INDEX IF NOT EXISTS idx_feedback_user_status ON user_feedback(user_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_type_status ON user_feedback(type, status);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON user_feedback(priority);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_statistics_metric_date ON statistics(metric_name, date);
CREATE INDEX IF NOT EXISTS idx_statistics_created ON statistics(created_at);

-- 初始化系统配置
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
('site_name', '磁力快搜', '网站名称', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('site_description', '专业的磁力搜索工具', '网站描述', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('site_keywords', '磁力搜索,BT搜索,资源搜索', 'SEO关键词', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_search_history', '100', '最大搜索历史记录数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '500', '最大收藏数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_ttl', '3600', '搜索缓存TTL（秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('session_ttl', '2592000', '会话TTL（秒，30天）', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('maintenance_mode', '0', '维护模式', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_username_length', '3', '用户名最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_username_length', '20', '用户名最大长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_password_length', '6', '密码最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_login_attempts', '5', '最大登录尝试次数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('lock_duration', '1800', '账号锁定时长（秒）', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('search_result_cache_enabled', '1', '是否启用搜索结果缓存', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('api_rate_limit', '100', 'API请求速率限制（每分钟）', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 初始化默认监控站点
INSERT OR IGNORE INTO site_monitoring (id, url, name, last_checked, created_at) VALUES
('javbus', 'https://www.javbus.com', 'JavBus', 0, strftime('%s', 'now') * 1000),
('javdb', 'https://javdb.com', 'JavDB', 0, strftime('%s', 'now') * 1000),
('javlibrary', 'https://www.javlibrary.com/cn', 'JavLibrary', 0, strftime('%s', 'now') * 1000),
('av01', 'https://av01.tv', 'AV01', 0, strftime('%s', 'now') * 1000),
('missav', 'https://missav.com', 'MissAV', 0, strftime('%s', 'now') * 1000),
('jable', 'https://jable.tv', 'Jable', 0, strftime('%s', 'now') * 1000),
('btsow', 'https://btsow.com', 'BTSOW', 0, strftime('%s', 'now') * 1000);

-- 创建触发器用于自动更新时间戳
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_favorites_timestamp 
    AFTER UPDATE ON user_favorites
    FOR EACH ROW
    BEGIN
        UPDATE user_favorites SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_feedback_timestamp 
    AFTER UPDATE ON user_feedback
    FOR EACH ROW
    BEGIN
        UPDATE user_feedback SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_config_timestamp 
    AFTER UPDATE ON system_config
    FOR EACH ROW
    BEGIN
        UPDATE system_config SET updated_at = strftime('%s', 'now') * 1000 WHERE key = NEW.key;
    END;

-- 自动清理过期数据的触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON user_sessions
    FOR EACH ROW
    BEGIN
        DELETE FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
    AFTER INSERT ON search_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM search_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

-- 数据清理视图（用于定期清理）
CREATE VIEW IF NOT EXISTS expired_sessions AS
SELECT id FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;

CREATE VIEW IF NOT EXISTS expired_cache AS
SELECT id FROM search_cache WHERE expires_at < strftime('%s', 'now') * 1000;

CREATE VIEW IF NOT EXISTS old_actions AS
SELECT id FROM user_actions WHERE created_at < (strftime('%s', 'now') - 2592000) * 1000; -- 30天前

CREATE VIEW IF NOT EXISTS expired_notifications AS
SELECT id FROM notifications WHERE expires_at IS NOT NULL AND expires_at < strftime('%s', 'now') * 1000;

-- 用户统计视图
CREATE VIEW IF NOT EXISTS user_stats AS
SELECT 
    u.id,
    u.username,
    u.created_at,
    u.last_login,
    COUNT(DISTINCT f.id) as favorite_count,
    COUNT(DISTINCT h.id) as search_count,
    COUNT(DISTINCT s.id) as session_count
FROM users u
LEFT JOIN user_favorites f ON u.id = f.user_id
LEFT JOIN user_search_history h ON u.id = h.user_id
LEFT JOIN user_sessions s ON u.id = s.user_id AND s.is_active = 1
GROUP BY u.id, u.username, u.created_at, u.last_login;

-- 热门搜索视图
CREATE VIEW IF NOT EXISTS popular_searches AS
SELECT 
    keyword,
    COUNT(*) as search_count,
    COUNT(DISTINCT user_id) as unique_users,
    MAX(created_at) as last_searched,
    AVG(duration) as avg_duration
FROM user_search_history
WHERE created_at > (strftime('%s', 'now') - 604800) * 1000 -- 最近7天
GROUP BY keyword
ORDER BY search_count DESC, unique_users DESC
LIMIT 100;
