-- 磁力快搜数据库结构 - 精简优化版本（支持用户隔离）

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    permissions TEXT DEFAULT '["search","favorite","history","sync"]',
    settings TEXT DEFAULT '{}', -- 【新增】用户个人设置存储
    is_active INTEGER DEFAULT 1,
    last_login INTEGER,
    login_count INTEGER DEFAULT 0
);

-- 用户会话表
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL, -- 【新增】最后活跃时间
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- 【关键】用户隔离字段
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT NOT NULL,
    icon TEXT,
    keyword TEXT, -- 【新增】关联搜索关键词
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 【重要修改】用户搜索历史表（增强字段兼容性）
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL, -- 【关键】用户隔离字段
    query TEXT NOT NULL, -- 【修改】统一使用query字段，兼容前端的keyword字段
    source TEXT DEFAULT 'unknown', -- 【新增】搜索来源标识
    results_count INTEGER DEFAULT 0, -- 【新增】搜索结果数量
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 搜索缓存表（全局缓存，提升性能）
CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    keyword_hash TEXT NOT NULL,
    results TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER NOT NULL
);

-- 用户行为记录表（用于分析和统计）
CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT, -- 【修改】可为空，支持匿名用户行为记录
    action TEXT NOT NULL,
    data TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 【新增】分析事件表（支持用户行为分析）
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT,
    event_type TEXT NOT NULL,
    event_data TEXT DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    referer TEXT,
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

-- 【优化】创建索引（提升查询性能）
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active); -- 【新增】

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id, expires_at); -- 【修改】复合索引
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON user_favorites(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);
CREATE INDEX IF NOT EXISTS idx_favorites_url ON user_favorites(url); -- 【新增】去重查询优化

-- 【重要】搜索历史索引优化
CREATE INDEX IF NOT EXISTS idx_history_user_created ON user_search_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_query ON user_search_history(query);
CREATE INDEX IF NOT EXISTS idx_history_source ON user_search_history(source);
CREATE INDEX IF NOT EXISTS idx_history_user_query ON user_search_history(user_id, query); -- 【新增】去重查询

CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_actions_user_created ON user_actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action ON user_actions(action);
CREATE INDEX IF NOT EXISTS idx_actions_created ON user_actions(created_at); -- 【新增】时间范围查询

-- 【新增】分析事件索引
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

CREATE INDEX IF NOT EXISTS idx_config_public ON system_config(is_public);

-- 【修改】初始化系统配置（增加用户隔离相关配置）
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
('site_name', '磁力快搜', '网站名称', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_search_history', '1000', '最大搜索历史记录数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '1000', '最大收藏数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_username_length', '3', '用户名最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_username_length', '20', '用户名最大长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_password_length', '6', '密码最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
-- 【新增】用户隔离相关配置
('enable_user_isolation', '1', '启用用户数据隔离', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_analytics', '1', '启用用户行为分析', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('session_timeout_days', '30', '会话过期天数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 触发器（自动维护时间戳）
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

-- 【新增】自动清理过期会话的触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON user_sessions
    FOR EACH ROW
    BEGIN
        DELETE FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

-- 【新增】自动清理过期缓存的触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
    AFTER INSERT ON search_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM search_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

-- 【新增】用户删除时的级联清理触发器
CREATE TRIGGER IF NOT EXISTS cleanup_user_analytics
    AFTER DELETE ON users
    FOR EACH ROW
    BEGIN
        DELETE FROM analytics_events WHERE user_id = OLD.id;
    END;
