-- 磁力快搜数据库结构
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
    last_login INTEGER
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户搜索历史表
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    search_type TEXT DEFAULT 'basic',
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
    access_count INTEGER DEFAULT 0
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
    created_at INTEGER NOT NULL
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
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
    success_count INTEGER DEFAULT 0
);

-- 用户反馈表
CREATE TABLE IF NOT EXISTS user_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT NOT NULL, -- 'bug', 'feature', 'general'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- 'open', 'closed', 'resolved'
    priority INTEGER DEFAULT 0, -- 0-low, 1-medium, 2-high
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created ON user_favorites(created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);

CREATE INDEX IF NOT EXISTS idx_history_user ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_keyword ON user_search_history(keyword);
CREATE INDEX IF NOT EXISTS idx_history_created ON user_search_history(created_at);

CREATE INDEX IF NOT EXISTS idx_cache_keyword ON search_cache(keyword);
CREATE INDEX IF NOT EXISTS idx_cache_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_actions_user ON user_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_actions_created ON user_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action ON user_actions(action);

CREATE INDEX IF NOT EXISTS idx_monitoring_url ON site_monitoring(url);
CREATE INDEX IF NOT EXISTS idx_monitoring_checked ON site_monitoring(last_checked);

CREATE INDEX IF NOT EXISTS idx_feedback_user ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON user_feedback(type);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);

-- 初始化系统配置
INSERT OR IGNORE INTO system_config (key, value, description, created_at, updated_at) VALUES
('site_name', '磁力快搜', '网站名称', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('site_description', '专业的磁力搜索工具', '网站描述', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_search_history', '100', '最大搜索历史记录数', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '500', '最大收藏数量', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_ttl', '3600', '搜索缓存TTL（秒）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('session_ttl', '2592000', '会话TTL（秒，30天）', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('maintenance_mode', '0', '维护模式', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 初始化默认监控站点
INSERT OR IGNORE INTO site_monitoring (id, url, name, last_checked, created_at) VALUES
('javbus', 'https://www.javbus.com', 'JavBus', 0, strftime('%s', 'now') * 1000),
('javdb', 'https://javdb.com', 'JavDB', 0, strftime('%s', 'now') * 1000),
('javlibrary', 'https://www.javlibrary.com', 'JavLibrary', 0, strftime('%s', 'now') * 1000),
('av01', 'https://av01.tv', 'AV01', 0, strftime('%s', 'now') * 1000),
('missav', 'https://missav.com', 'MissAV', 0, strftime('%s', 'now') * 1000),
('jable', 'https://jable.tv', 'Jable', 0, strftime('%s', 'now') * 1000);

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

-- 数据清理视图（用于定期清理）
CREATE VIEW IF NOT EXISTS expired_sessions AS
SELECT id FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;

CREATE VIEW IF NOT EXISTS expired_cache AS
SELECT id FROM search_cache WHERE expires_at < strftime('%s', 'now') * 1000;

CREATE VIEW IF NOT EXISTS old_actions AS
SELECT id FROM user_actions WHERE created_at < (strftime('%s', 'now') - 2592000) * 1000; -- 30天前

CREATE VIEW IF NOT EXISTS expired_notifications AS
SELECT id FROM notifications WHERE expires_at IS NOT NULL AND expires_at < strftime('%s', 'now') * 1000;