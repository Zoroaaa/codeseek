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

-- 🆕 标签管理表 - 新增功能
CREATE TABLE IF NOT EXISTS community_source_tags (
    id TEXT PRIMARY KEY,
    tag_name TEXT UNIQUE NOT NULL,
    tag_description TEXT,
    tag_color TEXT DEFAULT '#3b82f6',
    usage_count INTEGER DEFAULT 0,
    is_official INTEGER DEFAULT 0, -- 是否为官方标签
    tag_active INTEGER DEFAULT 1, -- 改名避免冲突：is_active -> tag_active
    created_by TEXT NOT NULL, -- 创建者
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

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
    tags TEXT DEFAULT '[]', -- JSON array of tag IDs
    
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
    total_views INTEGER DEFAULT 0, -- 🆕 添加总浏览量统计
    
    -- 参与统计
    reviews_given INTEGER DEFAULT 0,
    sources_downloaded INTEGER DEFAULT 0,
    tags_created INTEGER DEFAULT 0, -- 🆕 创建的标签数量
    
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
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

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

CREATE INDEX IF NOT EXISTS idx_history_user_keyword ON user_search_history(user_id, query);
CREATE INDEX IF NOT EXISTS idx_favorites_user_url ON user_favorites(user_id, url);

CREATE INDEX IF NOT EXISTS idx_status_cache_source_keyword ON source_status_cache(source_id, keyword_hash);
CREATE INDEX IF NOT EXISTS idx_status_cache_expires ON source_status_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_health_stats_source ON source_health_stats(source_id);
CREATE INDEX IF NOT EXISTS idx_check_jobs_user_status ON status_check_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_check_jobs_expires ON status_check_jobs(expires_at);

CREATE INDEX IF NOT EXISTS idx_shared_sources_user ON community_shared_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_sources_category ON community_shared_sources(source_category);
CREATE INDEX IF NOT EXISTS idx_shared_sources_status ON community_shared_sources(status);
CREATE INDEX IF NOT EXISTS idx_shared_sources_created ON community_shared_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_rating ON community_shared_sources(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_downloads ON community_shared_sources(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_likes ON community_shared_sources(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_view_count ON community_shared_sources(view_count DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_shared_source ON community_source_reviews(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON community_source_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON community_source_reviews(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_likes_shared_source ON community_source_likes(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON community_source_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_type ON community_source_likes(like_type);

CREATE INDEX IF NOT EXISTS idx_downloads_shared_source ON community_source_downloads(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_downloads_created ON community_source_downloads(created_at DESC);

-- 🆕 标签表索引 - 修复列名冲突
CREATE INDEX IF NOT EXISTS idx_tags_name ON community_source_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_creator ON community_source_tags(created_by);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON community_source_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_active ON community_source_tags(tag_active); -- 使用新列名

CREATE INDEX IF NOT EXISTS idx_reports_shared_source ON community_source_reports(shared_source_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON community_source_reports(status);
CREATE INDEX IF NOT EXISTS idx_community_user_stats_total_views ON community_user_stats(total_views);
CREATE INDEX IF NOT EXISTS idx_shared_sources_user_status ON community_shared_sources(user_id, status);

-- 修复评价统计更新触发器
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

-- 修复点赞统计更新触发器
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

-- 修复下载统计更新触发器
CREATE TRIGGER IF NOT EXISTS update_shared_source_stats_after_download
    AFTER INSERT ON community_source_downloads
    FOR EACH ROW
    BEGIN
        UPDATE community_shared_sources SET
            download_count = download_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.shared_source_id;
    END;

-- 修复用户统计更新触发器 - 使用CASE语句替代GREATEST函数
CREATE TRIGGER update_user_stats_after_share
    AFTER INSERT ON community_shared_sources
    FOR EACH ROW
    BEGIN
        INSERT OR REPLACE INTO community_user_stats (
            id, user_id, shared_sources_count, total_downloads, total_likes, total_views,
            reviews_given, sources_downloaded, tags_created, reputation_score, contribution_level,
            created_at, updated_at
        ) VALUES (
            COALESCE(
                (SELECT id FROM community_user_stats WHERE user_id = NEW.user_id),
                NEW.user_id || '_stats'
            ),
            NEW.user_id,
            COALESCE((SELECT shared_sources_count FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 1,
            COALESCE((SELECT total_downloads FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT total_likes FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT total_views FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT reviews_given FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT sources_downloaded FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT tags_created FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT reputation_score FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT contribution_level FROM community_user_stats WHERE user_id = NEW.user_id), 'beginner'),
            -- 使用CASE替代GREATEST
            CASE 
                WHEN (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id) IS NULL 
                THEN strftime('%s', 'now') * 1000
                ELSE (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id)
            END,
            strftime('%s', 'now') * 1000
        );
    END;


-- 修复标签使用统计触发器
CREATE TRIGGER IF NOT EXISTS update_tag_usage_count
    AFTER INSERT ON community_shared_sources
    FOR EACH ROW
    WHEN json_valid(NEW.tags)
    BEGIN
        -- 这个触发器需要通过应用层处理，因为SQLite的JSON处理有限
        -- 在应用层中手动更新标签使用统计
        NULL;
    END;

-- 修复浏览量更新触发器
CREATE TRIGGER IF NOT EXISTS update_user_total_views_after_view
    AFTER UPDATE OF view_count ON community_shared_sources
    FOR EACH ROW
    WHEN NEW.view_count > OLD.view_count
    BEGIN
        -- 更新用户统计中的总浏览量
        UPDATE community_user_stats 
        SET total_views = total_views + (NEW.view_count - OLD.view_count),
            updated_at = strftime('%s', 'now') * 1000
        WHERE user_id = NEW.user_id;
        
        -- 如果用户统计记录不存在，则创建
        INSERT OR IGNORE INTO community_user_stats (
            id, user_id, shared_sources_count, total_downloads, total_likes, total_views,
            reviews_given, sources_downloaded, tags_created, reputation_score, contribution_level,
            created_at, updated_at
        ) VALUES (
            NEW.user_id || '_stats',
            NEW.user_id,
            0, 0, 0, (NEW.view_count - OLD.view_count),
            0, 0, 0, 0, 'beginner',
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000
        );
    END;

-- 其他触发器
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

-- 清理过期缓存的触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
        DELETE FROM status_check_jobs WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

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
('community_min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

('detail_extraction_enabled', '1', '启用详情提取功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_cache_size', '50000', '详情缓存最大条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_default_timeout', '15000', '详情提取默认超时时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_batch_size', '20', '批量详情提取最大数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_cache_duration', '86400000', '详情缓存默认持续时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_concurrent', '3', '详情提取最大并发数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_enable_image_proxy', '0', '启用图片代理服务', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_supported_sources', '["javbus","javdb","javlibrary","jable","javmost","missav","sukebei"]', '支持详情提取的搜索源', 'json', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);


-- 🆕 初始化官方标签
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

-- 详情提取系统数据库结构 - 添加到现有 schema.sql

-- 详情缓存表
CREATE TABLE IF NOT EXISTS detail_cache (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL,
    source_type TEXT NOT NULL,
    
    -- 提取的详情信息 (JSON格式存储)
    detail_data TEXT NOT NULL,
    
    -- 元数据
    extraction_status TEXT DEFAULT 'success', -- success, error, partial
    extraction_time INTEGER DEFAULT 0,
    extraction_error TEXT,
    
    -- 缓存管理
    cache_size INTEGER DEFAULT 0,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 索引字段
    UNIQUE(url_hash)
);

-- 详情提取历史表
CREATE TABLE IF NOT EXISTS detail_extraction_history (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    url TEXT NOT NULL,
    source_type TEXT NOT NULL,
    keyword TEXT,
    
    -- 提取结果
    extraction_status TEXT NOT NULL, -- success, error, timeout, cached
    extraction_time INTEGER DEFAULT 0,
    extraction_error TEXT,
    data_size INTEGER DEFAULT 0,
    
    -- 提取配置
    enable_cache INTEGER DEFAULT 1,
    enable_retry INTEGER DEFAULT 1,
    timeout_ms INTEGER DEFAULT 15000,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 详情提取统计表
CREATE TABLE IF NOT EXISTS detail_extraction_stats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- 统计数据
    total_extractions INTEGER DEFAULT 0,
    successful_extractions INTEGER DEFAULT 0,
    cached_extractions INTEGER DEFAULT 0,
    failed_extractions INTEGER DEFAULT 0,
    
    -- 性能统计
    total_extraction_time INTEGER DEFAULT 0,
    average_extraction_time INTEGER DEFAULT 0,
    cache_hit_rate REAL DEFAULT 0.0,
    
    -- 按源类型统计 (JSON格式)
    source_type_stats TEXT DEFAULT '{}',
    
    -- 时间戳
    date_key TEXT NOT NULL, -- YYYY-MM-DD 格式
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- 确保每个用户每天只有一条记录
    UNIQUE(user_id, date_key)
);

-- 详情提取配置表
CREATE TABLE IF NOT EXISTS detail_extraction_config (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    
    -- 基础配置
    enable_detail_extraction INTEGER DEFAULT 1,
    auto_extract_details INTEGER DEFAULT 0,
    max_auto_extractions INTEGER DEFAULT 5,
    extraction_batch_size INTEGER DEFAULT 3,
    
    -- 超时和重试配置
    extraction_timeout INTEGER DEFAULT 15000,
    enable_retry INTEGER DEFAULT 1,
    max_retry_attempts INTEGER DEFAULT 2,
    
    -- 缓存配置
    enable_cache INTEGER DEFAULT 1,
    cache_duration INTEGER DEFAULT 86400000, -- 24小时
    enable_local_cache INTEGER DEFAULT 1,
    
    -- 显示配置
    show_screenshots INTEGER DEFAULT 1,
    show_download_links INTEGER DEFAULT 1,
    show_magnet_links INTEGER DEFAULT 1,
    show_actress_info INTEGER DEFAULT 1,
    compact_mode INTEGER DEFAULT 0,
    enable_image_preview INTEGER DEFAULT 1,
    show_extraction_progress INTEGER DEFAULT 1,
    
    -- 内容过滤配置
    enable_content_filter INTEGER DEFAULT 0,
    content_filter_keywords TEXT DEFAULT '[]', -- JSON数组
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    
    -- 确保每个用户只有一条配置记录
    UNIQUE(user_id)
);

-- 解析规则缓存表 (可选，用于缓存动态解析规则)
CREATE TABLE IF NOT EXISTS parser_rules_cache (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    rules_data TEXT NOT NULL, -- JSON格式的解析规则
    rules_version TEXT DEFAULT '1.0',
    is_active INTEGER DEFAULT 1,
    
    -- 时间戳
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    
    -- 确保每个源类型只有一条活跃规则
    UNIQUE(source_type, is_active)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_detail_cache_url_hash ON detail_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_detail_cache_expires ON detail_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_detail_cache_source_type ON detail_cache(source_type);
CREATE INDEX IF NOT EXISTS idx_detail_cache_last_accessed ON detail_cache(last_accessed);

CREATE INDEX IF NOT EXISTS idx_detail_history_user_created ON detail_extraction_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detail_history_url ON detail_extraction_history(url);
CREATE INDEX IF NOT EXISTS idx_detail_history_source_type ON detail_extraction_history(source_type);
CREATE INDEX IF NOT EXISTS idx_detail_history_status ON detail_extraction_history(extraction_status);

CREATE INDEX IF NOT EXISTS idx_detail_stats_user_date ON detail_extraction_stats(user_id, date_key);
CREATE INDEX IF NOT EXISTS idx_detail_stats_date ON detail_extraction_stats(date_key);

CREATE INDEX IF NOT EXISTS idx_parser_rules_source_active ON parser_rules_cache(source_type, is_active);

-- 创建触发器

-- 自动更新详情缓存的 updated_at
CREATE TRIGGER IF NOT EXISTS update_detail_cache_timestamp 
    AFTER UPDATE ON detail_cache
    FOR EACH ROW
    BEGIN
        UPDATE detail_cache SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- 自动更新详情提取配置的 updated_at
CREATE TRIGGER IF NOT EXISTS update_detail_config_timestamp 
    AFTER UPDATE ON detail_extraction_config
    FOR EACH ROW
    BEGIN
        UPDATE detail_extraction_config SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- 自动清理过期的详情缓存
CREATE TRIGGER IF NOT EXISTS cleanup_expired_detail_cache
    AFTER INSERT ON detail_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM detail_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

-- 自动更新用户详情提取统计
CREATE TRIGGER IF NOT EXISTS update_detail_stats_after_extraction
    AFTER INSERT ON detail_extraction_history
    FOR EACH ROW
    WHEN NEW.user_id IS NOT NULL
    BEGIN
        INSERT OR REPLACE INTO detail_extraction_stats (
            id, user_id, date_key,
            total_extractions, successful_extractions, cached_extractions, failed_extractions,
            total_extraction_time, average_extraction_time, cache_hit_rate,
            created_at, updated_at
        ) VALUES (
            COALESCE(
                (SELECT id FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')),
                NEW.user_id || '_' || date('now')
            ),
            NEW.user_id,
            date('now'),
            COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1,
            COALESCE((SELECT successful_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 
                CASE WHEN NEW.extraction_status = 'success' THEN 1 ELSE 0 END,
            COALESCE((SELECT cached_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 
                CASE WHEN NEW.extraction_status = 'cached' THEN 1 ELSE 0 END,
            COALESCE((SELECT failed_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 
                CASE WHEN NEW.extraction_status IN ('error', 'timeout') THEN 1 ELSE 0 END,
            COALESCE((SELECT total_extraction_time FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + NEW.extraction_time,
            -- 计算平均提取时间
            CASE 
                WHEN (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1) > 0
                THEN (COALESCE((SELECT total_extraction_time FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + NEW.extraction_time) / 
                     (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1)
                ELSE 0
            END,
            -- 计算缓存命中率
            CASE 
                WHEN (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1) > 0
                THEN CAST((COALESCE((SELECT cached_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 
                          CASE WHEN NEW.extraction_status = 'cached' THEN 1 ELSE 0 END) AS REAL) / 
                     (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1)
                ELSE 0.0
            END,
            CASE 
                WHEN (SELECT created_at FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')) IS NULL 
                THEN strftime('%s', 'now') * 1000
                ELSE (SELECT created_at FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now'))
            END,
            strftime('%s', 'now') * 1000
        );
    END;

