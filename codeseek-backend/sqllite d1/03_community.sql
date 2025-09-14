-- ===============================================
-- 社区功能模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含标签管理、共享搜索源、评分评论、点赞下载等功能
-- ===============================================

-- ===============================================
-- 1. 社区标签管理
-- ===============================================

-- 标签管理表
CREATE TABLE IF NOT EXISTS community_source_tags (
    id TEXT PRIMARY KEY,                        -- 标签唯一标识
    tag_name TEXT UNIQUE NOT NULL,              -- 标签名称（唯一）
    tag_description TEXT,                       -- 标签描述
    tag_color TEXT DEFAULT '#3b82f6',           -- 标签颜色
    usage_count INTEGER DEFAULT 0,              -- 使用次数统计
    is_official INTEGER DEFAULT 0,              -- 是否为官方标签（1:官方 0:用户创建）
    tag_active INTEGER DEFAULT 1,               -- 是否激活（1:激活 0:禁用）
    created_by TEXT NOT NULL,                   -- 创建者用户ID
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 2. 共享搜索源管理
-- ===============================================

-- 共享搜索源表
CREATE TABLE IF NOT EXISTS community_shared_sources (
    id TEXT PRIMARY KEY,                        -- 共享源唯一标识
    user_id TEXT NOT NULL,                      -- 分享用户ID
    source_name TEXT NOT NULL,                  -- 搜索源名称
    source_subtitle TEXT,                       -- 搜索源副标题
    source_icon TEXT DEFAULT '🔍',              -- 搜索源图标
    source_url_template TEXT NOT NULL,          -- 搜索源URL模板
    source_category TEXT NOT NULL,              -- 搜索源分类
    description TEXT,                           -- 详细描述
    tags TEXT DEFAULT '[]',                     -- 关联标签ID列表（JSON数组）
    
    -- 统计信息
    download_count INTEGER DEFAULT 0,           -- 下载次数
    like_count INTEGER DEFAULT 0,               -- 点赞次数
    view_count INTEGER DEFAULT 0,               -- 浏览次数
    rating_score REAL DEFAULT 0.0,              -- 平均评分
    rating_count INTEGER DEFAULT 0,             -- 评分人数
    
    -- 状态信息
    is_verified INTEGER DEFAULT 0,              -- 是否经过验证（1:已验证 0:未验证）
    is_featured INTEGER DEFAULT 0,              -- 是否推荐（1:推荐 0:普通）
    status TEXT DEFAULT 'active',               -- 状态（active/pending/rejected/deleted）
    rejection_reason TEXT,                      -- 拒绝原因
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    last_tested_at INTEGER,                     -- 最后测试时间
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ===============================================
-- 3. 社区互动功能
-- ===============================================

-- 搜索源评分和评论表
CREATE TABLE IF NOT EXISTS community_source_reviews (
    id TEXT PRIMARY KEY,                        -- 评论唯一标识
    shared_source_id TEXT NOT NULL,             -- 关联共享源ID
    user_id TEXT NOT NULL,                      -- 评论用户ID
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 评分（1-5星）
    comment TEXT,                               -- 评论内容
    is_anonymous INTEGER DEFAULT 0,             -- 是否匿名评论（1:匿名 0:实名）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(shared_source_id, user_id)           -- 确保用户对同一个搜索源只能评价一次
);

-- 搜索源收藏/点赞表
CREATE TABLE IF NOT EXISTS community_source_likes (
    id TEXT PRIMARY KEY,                        -- 操作记录唯一标识
    shared_source_id TEXT NOT NULL,             -- 关联共享源ID
    user_id TEXT NOT NULL,                      -- 操作用户ID
    like_type TEXT DEFAULT 'like',              -- 操作类型（like/favorite/bookmark）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(shared_source_id, user_id, like_type) -- 确保用户对同一个搜索源的同一种操作只能执行一次
);

-- 搜索源下载记录表
CREATE TABLE IF NOT EXISTS community_source_downloads (
    id TEXT PRIMARY KEY,                        -- 下载记录唯一标识
    shared_source_id TEXT NOT NULL,             -- 关联共享源ID
    user_id TEXT,                               -- 下载用户ID（可为空，记录匿名下载）
    ip_address TEXT,                            -- 下载者IP地址
    user_agent TEXT,                            -- 用户代理信息
    created_at INTEGER NOT NULL,                -- 下载时间戳
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 4. 社区管理功能
-- ===============================================

-- 搜索源举报表
CREATE TABLE IF NOT EXISTS community_source_reports (
    id TEXT PRIMARY KEY,                        -- 举报记录唯一标识
    shared_source_id TEXT NOT NULL,             -- 被举报的共享源ID
    reporter_user_id TEXT NOT NULL,             -- 举报人用户ID
    report_reason TEXT NOT NULL,                -- 举报原因
    report_details TEXT,                        -- 举报详情
    status TEXT DEFAULT 'pending',              -- 处理状态（pending/resolved/dismissed）
    
    -- 处理信息
    admin_user_id TEXT,                         -- 处理管理员ID
    admin_action TEXT,                          -- 管理员操作
    admin_notes TEXT,                           -- 管理员备注
    resolved_at INTEGER,                        -- 处理完成时间
    
    created_at INTEGER NOT NULL,                -- 举报时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (shared_source_id) REFERENCES community_shared_sources (id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 用户社区统计表
CREATE TABLE IF NOT EXISTS community_user_stats (
    id TEXT PRIMARY KEY,                        -- 统计记录唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    
    -- 分享统计
    shared_sources_count INTEGER DEFAULT 0,     -- 分享的搜索源数量
    total_downloads INTEGER DEFAULT 0,          -- 总下载量
    total_likes INTEGER DEFAULT 0,              -- 总点赞数
    total_views INTEGER DEFAULT 0,              -- 总浏览量
    
    -- 参与统计
    reviews_given INTEGER DEFAULT 0,            -- 给出的评价数
    sources_downloaded INTEGER DEFAULT 0,       -- 下载的源数量
    tags_created INTEGER DEFAULT 0,             -- 创建的标签数量
    
    -- 声誉系统
    reputation_score INTEGER DEFAULT 0,         -- 声誉积分
    contribution_level TEXT DEFAULT 'beginner', -- 贡献等级（beginner/contributor/expert/master）
    
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- ===============================================
-- 5. 索引定义
-- ===============================================

-- 社区功能模块索引
CREATE INDEX IF NOT EXISTS idx_tags_name ON community_source_tags(tag_name);
CREATE INDEX IF NOT EXISTS idx_tags_creator ON community_source_tags(created_by);
CREATE INDEX IF NOT EXISTS idx_tags_usage ON community_source_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_active ON community_source_tags(tag_active);
CREATE INDEX IF NOT EXISTS idx_shared_sources_user ON community_shared_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_sources_category ON community_shared_sources(source_category);
CREATE INDEX IF NOT EXISTS idx_shared_sources_status ON community_shared_sources(status);
CREATE INDEX IF NOT EXISTS idx_shared_sources_created ON community_shared_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_rating ON community_shared_sources(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_downloads ON community_shared_sources(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_likes ON community_shared_sources(like_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_view_count ON community_shared_sources(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_shared_sources_user_status ON community_shared_sources(user_id, status);
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
CREATE INDEX IF NOT EXISTS idx_community_user_stats_total_views ON community_user_stats(total_views);

-- ===============================================
-- 6. 触发器定义
-- ===============================================

-- 社区功能模块触发器
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
            CASE 
                WHEN (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id) IS NULL 
                THEN strftime('%s', 'now') * 1000
                ELSE (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id)
            END,
            strftime('%s', 'now') * 1000
        );
    END;

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