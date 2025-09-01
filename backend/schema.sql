-- 磁力快搜数据库结构 - 精简优化版本

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
    login_count INTEGER DEFAULT 0
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
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户搜索历史表（增加source和query字段）
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    query TEXT NOT NULL, -- 兼容性字段，与keyword相同
    source TEXT DEFAULT 'unknown', -- 搜索来源
    results_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 搜索缓存表
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

-- 用户行为记录表
CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    data TEXT DEFAULT '{}',
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

-- 添加分析事件表
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

-- 创建相关索引
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);


-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON user_favorites(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);

CREATE INDEX IF NOT EXISTS idx_history_user_created ON user_search_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_query ON user_search_history(query);
CREATE INDEX IF NOT EXISTS idx_history_source ON user_search_history(source);

CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_actions_user_created ON user_actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action ON user_actions(action);

CREATE INDEX IF NOT EXISTS idx_config_public ON system_config(is_public);

-- 在文档1中增加索引
CREATE INDEX IF NOT EXISTS idx_history_user_keyword ON user_search_history(user_id, query);
CREATE INDEX IF NOT EXISTS idx_favorites_user_url ON user_favorites(user_id, url);

-- 初始化系统配置
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
('site_name', '磁力快搜', '网站名称', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_search_history', '1000', '最大搜索历史记录数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '1000', '最大收藏数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_username_length', '3', '用户名最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_username_length', '20', '用户名最大长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_password_length', '6', '密码最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('source_check_enabled', '1', '启用搜索源状态检查', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_concurrent_checks', '3', '最大并发检查数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_check_timeout', '10000', '默认检查超时时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_duration_ms', '300000', '状态缓存时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_cache_entries', '10000', '最大缓存条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('health_update_interval', '3600000', '健康度统计更新间隔（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_enabled', '1', '启用搜索源共享社区功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_require_approval', '0', '新分享的搜索源需要审核', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_max_shares_per_user', '50', '每个用户最大分享数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 初始化官方标签
INSERT OR IGNORE INTO community_source_tags (id, tag_name, tag_color, is_official, created_at, updated_at) VALUES
('tag_verified', '已验证', '#10b981', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_popular', '热门', '#f59e0b', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_new', '最新', '#3b82f6', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_recommended', '推荐', '#8b5cf6', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_high_quality', '高质量', '#ef4444', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);


/*  初始化系统配置（添加到现有配置中）
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
('source_check_enabled', '1', '启用搜索源状态检查', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_concurrent_checks', '3', '最大并发检查数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_check_timeout', '10000', '默认检查超时时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_duration_ms', '300000', '状态缓存时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_cache_entries', '10000', '最大缓存条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('health_update_interval', '3600000', '健康度统计更新间隔（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000); */


-- 触发器
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

CREATE TRIGGER IF NOT EXISTS cleanup_expired_sessions
    AFTER INSERT ON user_sessions
    FOR EACH ROW
    BEGIN
        DELETE FROM user_sessions WHERE expires_at < strftime('%s', 'now') * 1000;
    END;
	
	
	-- 搜索源状态检查缓存表
CREATE TABLE IF NOT EXISTS source_status_cache (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    keyword_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unknown',
    available INTEGER DEFAULT 0,
    content_match INTEGER DEFAULT 0,
    response_time INTEGER DEFAULT 0,
    quality_score INTEGER DEFAULT 0,
    match_details TEXT DEFAULT '{}',
    page_info TEXT DEFAULT '{}',
    check_error TEXT,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0
);

-- 搜索源健康度统计表
CREATE TABLE IF NOT EXISTS source_health_stats (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    content_matches INTEGER DEFAULT 0,
    average_response_time INTEGER DEFAULT 0,
    last_success INTEGER,
    last_failure INTEGER,
    success_rate REAL DEFAULT 0.0,
    health_score INTEGER DEFAULT 0,
    updated_at INTEGER NOT NULL,
    UNIQUE(source_id)
);

-- 状态检查任务队列表（如需异步处理）
CREATE TABLE IF NOT EXISTS status_check_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sources TEXT NOT NULL, -- JSON array
    keyword TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    results TEXT DEFAULT '{}',
    error_message TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    completed_at INTEGER,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_status_cache_source_keyword ON source_status_cache(source_id, keyword_hash);
CREATE INDEX IF NOT EXISTS idx_status_cache_expires ON source_status_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_health_stats_source ON source_health_stats(source_id);
CREATE INDEX IF NOT EXISTS idx_check_jobs_user_status ON status_check_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_check_jobs_expires ON status_check_jobs(expires_at);

-- 清理过期缓存的触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
        DELETE FROM status_check_jobs WHERE expires_at < strftime('%s', 'now') * 1000;
    END;
	
	-- 搜索源共享社区数据库扩展

-- 共享搜索源表
CREATE TABLE IF NOT EXISTS community_shared_sources (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    source_name TEXT NOT NULL,
    source_subtitle TEXT,
    source_icon TEXT DEFAULT '🔍',
    source_url_template TEXT NOT NULL,
    source_category TEXT NOT NULL,
    description TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    
    -- 统计信息
    download_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    rating_score REAL DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    
    -- 状态信息
    is_verified INTEGER DEFAULT 0, -- 是否经过验证
    is_featured INTEGER DEFAULT 0, -- 是否推荐
    status TEXT DEFAULT 'active', -- active, pending, rejected, deleted
    rejection_reason TEXT,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_tested_at INTEGER,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 搜索源评分和评论表
CREATE TABLE IF NOT EXISTS community_source_reviews (
    id TEXT PRIMARY KEY,
    shared_source_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_anonymous INTEGER DEFAULT 0,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- 确保用户对同一个搜索源只能评价一次
    UNIQUE(shared_source_id, user_id)
);

-- 搜索源收藏/点赞表
CREATE TABLE IF NOT EXISTS community_source_likes (
    id TEXT PRIMARY KEY,
    shared_source_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    like_type TEXT DEFAULT 'like', -- like, favorite, bookmark
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- 确保用户对同一个搜索源的同一种操作只能执行一次
    UNIQUE(shared_source_id, user_id, like_type)
);

-- 搜索源下载记录表
CREATE TABLE IF NOT EXISTS community_source_downloads (
    id TEXT PRIMARY KEY,
    shared_source_id TEXT NOT NULL,
    user_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 搜索源标签表
CREATE TABLE IF NOT EXISTS community_source_tags (
    id TEXT PRIMARY KEY,
    tag_name TEXT UNIQUE NOT NULL,
    tag_color TEXT DEFAULT '#3b82f6',
    usage_count INTEGER DEFAULT 0,
    is_official INTEGER DEFAULT 0, -- 是否为官方标签
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 搜索源举报表
CREATE TABLE IF NOT EXISTS community_source_reports (
    id TEXT PRIMARY KEY,
    shared_source_id TEXT NOT NULL,
    reporter_user_id TEXT NOT NULL,
    report_reason TEXT NOT NULL,
    report_details TEXT,
    status TEXT DEFAULT 'pending', -- pending, resolved, dismissed
    
    -- 处理信息
    admin_user_id TEXT,
    admin_action TEXT,
    admin_notes TEXT,
    resolved_at INTEGER,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 用户社区统计表
CREATE TABLE IF NOT EXISTS community_user_stats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- 分享统计
    shared_sources_count INTEGER DEFAULT 0,
    total_downloads INTEGER DEFAULT 0,
    total_likes INTEGER DEFAULT 0,
    
    -- 参与统计
    reviews_given INTEGER DEFAULT 0,
    sources_downloaded INTEGER DEFAULT 0,
    
    -- 声誉系统
    reputation_score INTEGER DEFAULT 0,
    contribution_level TEXT DEFAULT 'beginner', -- beginner, contributor, expert, master
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_shared_sources_user ON community_shared_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_sources_category ON community_shared_sources(source_category);
CREATE INDEX IF NOT EXISTS idx_shared_sources_status ON community_shared_sources(status);
CREATE INDEX IF NOT EXISTS idx_shared_sources_created ON community_shared_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_rating ON community_shared_sources(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_downloads ON community_shared_sources(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_likes ON community_shared_sources(like_count DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_shared_source ON community_source_reviews(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON community_source_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON community_source_reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_likes_shared_source ON community_source_likes(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON community_source_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_type ON community_source_likes(like_type);

CREATE INDEX IF NOT EXISTS idx_downloads_shared_source ON community_source_downloads(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON community_source_downloads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_shared_source ON community_source_reports(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON community_source_reports(status);

-- 触发器：更新共享搜索源的统计信息
CREATE TRIGGER IF NOT EXISTS update_shared_source_stats_after_review
    AFTER INSERT ON community_source_reviews
    FOR EACH ROW
    BEGIN
        UPDATE community_shared_sources SET
            rating_count = rating_count + 1,
            rating_score = (
                SELECT AVG(rating) FROM community_source_reviews 
                WHERE shared_source_id = NEW.shared_source_id
            ),
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.shared_source_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_shared_source_stats_after_like
    AFTER INSERT ON community_source_likes
    FOR EACH ROW
    WHEN NEW.like_type = 'like'
    BEGIN
        UPDATE community_shared_sources SET
            like_count = like_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.shared_source_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_shared_source_stats_after_download
    AFTER INSERT ON community_source_downloads
    FOR EACH ROW
    BEGIN
        UPDATE community_shared_sources SET
            download_count = download_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.shared_source_id;
    END;

-- 触发器：更新用户社区统计
CREATE TRIGGER IF NOT EXISTS update_user_stats_after_share
    AFTER INSERT ON community_shared_sources
    FOR EACH ROW
    BEGIN
        INSERT OR REPLACE INTO community_user_stats (
            id, user_id, shared_sources_count, created_at, updated_at
        ) VALUES (
            COALESCE(
                (SELECT id FROM community_user_stats WHERE user_id = NEW.user_id),
                NEW.user_id || '_stats'
            ),
            NEW.user_id,
            COALESCE(
                (SELECT shared_sources_count FROM community_user_stats WHERE user_id = NEW.user_id), 0
            ) + 1,
            COALESCE(
                (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id),
                strftime('%s', 'now') * 1000
            ),
            strftime('%s', 'now') * 1000
        );
    END;

/* -- 初始化系统配置
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
('community_enabled', '1', '启用搜索源共享社区功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_require_approval', '0', '新分享的搜索源需要审核', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_max_shares_per_user', '50', '每个用户最大分享数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 初始化官方标签
INSERT OR IGNORE INTO community_source_tags (id, tag_name, tag_color, is_official, created_at, updated_at) VALUES
('tag_verified', '已验证', '#10b981', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_popular', '热门', '#f59e0b', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_new', '最新', '#3b82f6', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_recommended', '推荐', '#8b5cf6', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('tag_high_quality', '高质量', '#ef4444', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000); */
