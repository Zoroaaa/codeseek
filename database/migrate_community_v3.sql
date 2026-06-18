-- ===============================================
-- 社区功能迁移脚本：v2.0 (搜索源分享) → v3.0 (资源分享)
-- 策略: 全部删除重建，不保留历史数据
-- 执行方式: wrangler d1 execute <DB_NAME> --file=./database/migrate_community_v3.sql
-- 或在 D1 Dashboard 中直接执行
-- ===============================================

BEGIN TRANSACTION;

-- ===============================================
-- 第一步：删除旧版所有表和相关对象
-- ===============================================

-- 删除旧触发器（按依赖顺序，子表先删）
DROP TRIGGER IF EXISTS update_user_total_views_after_view;
DROP TRIGGER IF EXISTS update_user_stats_after_share;
DROP TRIGGER IF EXISTS update_shared_source_stats_after_download;
DROP TRIGGER IF EXISTS update_shared_source_stats_after_like;
DROP TRIGGER IF EXISTS update_shared_source_stats_after_review;

-- 删除旧 FTS 触发器
DROP TRIGGER IF EXISTS community_sources_fts_insert;
DROP TRIGGER IF EXISTS community_sources_fts_update;
DROP TRIGGER IF EXISTS community_sources_fts_delete;

-- 删除旧 FTS 表
DROP TABLE IF EXISTS community_sources_fts;

-- 删除旧表（按外键依赖顺序）
DROP TABLE IF EXISTS community_source_downloads;      -- 下载记录
DROP TABLE IF EXISTS community_source_likes;           -- 点赞/收藏
DROP TABLE IF EXISTS community_source_reviews;         -- 评论/评分
DROP TABLE IF EXISTS community_source_reports;         -- 举报
DROP TABLE IF EXISTS community_user_stats;             -- 用户统计
DROP TABLE IF EXISTS community_shared_sources;         -- 搜索源（核心旧表）
DROP TABLE IF EXISTS community_source_tags;            -- 标签

-- ===============================================
-- 第二步：创建新版表结构
-- ===============================================

-- 1. 社区标签管理（简化版）
CREATE TABLE community_tags (
    id TEXT PRIMARY KEY,
    tag_name TEXT UNIQUE NOT NULL,
    tag_description TEXT,
    tag_color TEXT DEFAULT '#3b82f6',
    tag_active INTEGER DEFAULT 1,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. 资源帖子主表（核心表）
CREATE TABLE community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    post_type TEXT NOT NULL CHECK (post_type IN ('jav', 'anime', 'movie')),
    title TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    content_data TEXT NOT NULL,
    caption TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    favorite_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_featured INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. 评论管理（纯文本评论）
CREATE TABLE community_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 4. 点赞与收藏
CREATE TABLE community_likes (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    like_type TEXT NOT NULL CHECK (like_type IN ('like', 'favorite')),
    created_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(post_id, user_id, like_type)
);

-- 5. 举报管理
CREATE TABLE community_reports (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    reporter_user_id TEXT NOT NULL,
    report_reason TEXT NOT NULL,
    report_details TEXT,
    status TEXT DEFAULT 'pending',
    admin_user_id TEXT,
    admin_action TEXT,
    admin_notes TEXT,
    resolved_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts (id) ON DELETE CASCADE,
    FOREIGN KEY (reporter_user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 6. 用户统计
CREATE TABLE community_user_stats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    posts_count INTEGER DEFAULT 0,
    likes_received INTEGER DEFAULT 0,
    favorites_received INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    contribution_level TEXT DEFAULT 'beginner',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- ===============================================
-- 第三步：创建索引
-- ===============================================

-- 帖子表索引
CREATE INDEX idx_posts_user ON community_posts(user_id);
CREATE INDEX idx_posts_type ON community_posts(post_type);
CREATE INDEX idx_posts_status ON community_posts(status);
CREATE INDEX idx_posts_created ON community_posts(created_at DESC);
CREATE INDEX idx_posts_like_count ON community_posts(like_count DESC);
CREATE INDEX idx_posts_view_count ON community_posts(view_count DESC);
CREATE INDEX idx_posts_user_status ON community_posts(user_id, status);
CREATE INDEX idx_posts_featured ON community_posts(is_featured, created_at DESC);

-- 标签表索引
CREATE INDEX idx_tags_name ON community_tags(tag_name);
CREATE INDEX idx_tags_creator ON community_tags(created_by);
CREATE INDEX idx_tags_active ON community_tags(tag_active);

-- 评论表索引
CREATE INDEX idx_comments_post ON community_comments(post_id);
CREATE INDEX idx_comments_user ON community_comments(user_id);
CREATE INDEX idx_comments_created ON community_comments(created_at DESC);

-- 点赞表索引
CREATE INDEX idx_likes_post ON community_likes(post_id);
CREATE INDEX idx_likes_user ON community_likes(user_id);
CREATE INDEX idx_likes_type ON community_likes(like_type);

-- 举报表索引
CREATE INDEX idx_reports_post ON community_reports(post_id);
CREATE INDEX idx_reports_status ON community_reports(status);

-- ===============================================
-- 第四步：创建 FTS 全文搜索索引
-- ===============================================

CREATE VIRTUAL TABLE community_posts_fts USING fts5(
    title,
    caption,
    content='community_posts',
    content_rowid='id'
);

-- FTS 同步触发器
CREATE TRIGGER community_posts_fts_insert
    AFTER INSERT ON community_posts FOR EACH ROW BEGIN
      INSERT INTO community_posts_fts(rowid, title, caption)
      VALUES (NEW.id, NEW.title, NEW.caption);
    END;

CREATE TRIGGER community_posts_fts_update
    AFTER UPDATE ON community_posts FOR EACH ROW BEGIN
      INSERT INTO community_posts_fts(community_posts_fts, rowid, title, caption)
      VALUES ('delete', OLD.id, OLD.title, OLD.caption);
      INSERT INTO community_posts_fts(rowid, title, caption)
      VALUES (NEW.id, NEW.title, NEW.caption);
    END;

CREATE TRIGGER community_posts_fts_delete
    AFTER DELETE ON community_posts FOR EACH ROW BEGIN
      INSERT INTO community_posts_fts(community_posts_fts, rowid, title, caption)
      VALUES ('delete', OLD.id, OLD.title, OLD.caption);
    END;

-- ===============================================
-- 第五步：创建计数自动维护触发器
-- ===============================================

-- 评论计数
CREATE TRIGGER update_post_comment_count_after_insert
    AFTER INSERT ON community_comments FOR EACH ROW
    BEGIN
        UPDATE community_posts SET
            comment_count = comment_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.post_id;
    END;

CREATE TRIGGER update_post_comment_count_after_delete
    AFTER DELETE ON community_comments FOR EACH ROW
    BEGIN
        UPDATE community_posts SET
            comment_count = MAX(comment_count - 1, 0),
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = OLD.post_id;
    END;

-- 点赞计数
CREATE TRIGGER update_post_like_count_after_insert
    AFTER INSERT ON community_likes FOR EACH ROW
    WHEN NEW.like_type = 'like'
    BEGIN
        UPDATE community_posts SET
            like_count = like_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.post_id;
    END;

-- 收藏计数
CREATE TRIGGER update_post_favorite_count_after_insert
    AFTER INSERT ON community_likes FOR EACH ROW
    WHEN NEW.like_type = 'favorite'
    BEGIN
        UPDATE community_posts SET
            favorite_count = favorite_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.post_id;
    END;

-- 取消点赞
CREATE TRIGGER update_post_like_count_after_delete
    AFTER DELETE ON community_likes FOR EACH ROW
    WHEN OLD.like_type = 'like'
    BEGIN
        UPDATE community_posts SET
            like_count = MAX(like_count - 1, 0),
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = OLD.post_id;
    END;

-- 取消收藏
CREATE TRIGGER update_post_favorite_count_after_delete
    AFTER DELETE ON community_likes FOR EACH ROW
    WHEN OLD.like_type = 'favorite'
    BEGIN
        UPDATE community_posts SET
            favorite_count = MAX(favorite_count - 1, 0),
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = OLD.post_id;
    END;

-- ===============================================
-- 第六步：创建用户统计自动维护触发器
-- ===============================================

-- 发布帖子后更新用户统计
CREATE TRIGGER update_user_stats_after_post
    AFTER INSERT ON community_posts FOR EACH ROW
    WHEN NEW.status = 'active'
    BEGIN
        INSERT OR REPLACE INTO community_user_stats (
            id, user_id, posts_count, likes_received, favorites_received, comments_count,
            reputation_score, contribution_level, created_at, updated_at
        ) VALUES (
            COALESCE(
                (SELECT id FROM community_user_stats WHERE user_id = NEW.user_id),
                NEW.user_id || '_stats'
            ),
            NEW.user_id,
            COALESCE((SELECT posts_count FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 1,
            COALESCE((SELECT likes_received FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT favorites_received FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT comments_count FROM community_user_stats WHERE user_id = NEW.user_id), 0),
            COALESCE((SELECT reputation_score FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 5,
            CASE 
                WHEN COALESCE((SELECT posts_count FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 1 >= 50 THEN 'master'
                WHEN COALESCE((SELECT posts_count FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 1 >= 20 THEN 'expert'
                WHEN COALESCE((SELECT posts_count FROM community_user_stats WHERE user_id = NEW.user_id), 0) + 1 >= 5 THEN 'contributor'
                ELSE 'beginner'
            END,
            CASE 
                WHEN (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id) IS NULL 
                THEN strftime('%s', 'now') * 1000
                ELSE (SELECT created_at FROM community_user_stats WHERE user_id = NEW.user_id)
            END,
            strftime('%s', 'now') * 1000
        );
    END;

-- 收到点赞后更新用户统计
CREATE TRIGGER update_user_stats_after_like
    AFTER INSERT ON community_likes FOR EACH ROW
    WHEN NEW.like_type = 'like'
    BEGIN
        UPDATE community_user_stats 
        SET likes_received = likes_received + 1,
            reputation_score = reputation_score + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE user_id = (SELECT user_id FROM community_posts WHERE id = NEW.post_id);
        
        INSERT OR IGNORE INTO community_user_stats (
            id, user_id, posts_count, likes_received, favorites_received, comments_count,
            reputation_score, contribution_level, created_at, updated_at
        ) VALUES (
            (SELECT user_id || '_stats' FROM community_posts WHERE id = NEW.post_id),
            (SELECT user_id FROM community_posts WHERE id = NEW.post_id),
            0, 1, 0, 0, 1, 'beginner',
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000
        );
    END;

-- 收到收藏后更新用户统计
CREATE TRIGGER update_user_stats_after_favorite
    AFTER INSERT ON community_likes FOR EACH ROW
    WHEN NEW.like_type = 'favorite'
    BEGIN
        UPDATE community_user_stats 
        SET favorites_received = favorites_received + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE user_id = (SELECT user_id FROM community_posts WHERE id = NEW.post_id);
        
        INSERT OR IGNORE INTO community_user_stats (
            id, user_id, posts_count, likes_received, favorites_received, comments_count,
            reputation_score, contribution_level, created_at, updated_at
        ) VALUES (
            (SELECT user_id || '_stats' FROM community_posts WHERE id = NEW.post_id),
            (SELECT user_id FROM community_posts WHERE id = NEW.post_id),
            0, 0, 1, 0, 0, 'beginner',
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000
        );
    END;

-- 发表评论后更新用户统计
CREATE TRIGGER update_user_stats_after_comment
    AFTER INSERT ON community_comments FOR EACH ROW
    BEGIN
        UPDATE community_user_stats 
        SET comments_count = comments_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE user_id = NEW.user_id;
        
        INSERT OR IGNORE INTO community_user_stats (
            id, user_id, posts_count, likes_received, favorites_received, comments_count,
            reputation_score, contribution_level, created_at, updated_at
        ) VALUES (
            NEW.user_id || '_stats',
            NEW.user_id,
            0, 0, 0, 1, 0, 'beginner',
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000
        );
    END;

-- ===============================================
-- 第七步：插入默认标签数据
-- ===============================================

INSERT INTO community_tags (id, tag_name, tag_description, tag_color, tag_active, created_by, created_at, updated_at) VALUES
    ('tag_jav', '番号', 'JAV / 番号相关内容', '#ef4444', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_anime', '动漫', '动画 / 动漫相关内容', '#8b5cf6', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_movie', '电影', '电影相关内容', '#f59e0b', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_tv', '剧集', '电视剧 / 剧集相关内容', '#06b6d4', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_recommend', '推荐', '优质推荐内容', '#10b981', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_treasure', '宝藏', '宝藏级发现', '#ec4899', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_classic', '经典', '经典必看', '#6366f1', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000)),
    ('tag_new', '新番', '最新发布', '#14b8a6', 1, 'system', (strftime('%s','now')*1000), (strftime('%s','now')*1000));

COMMIT;

-- ===============================================
-- 验证语句（执行完后可单独运行检查结果）
-- ===============================================

-- -- 检查所有新表是否创建成功
-- SELECT name, type FROM sqlite_master 
--   WHERE name LIKE 'community_%' AND type IN ('table', 'view')
--   ORDER BY name;

-- -- 检查旧表是否已清理干净
-- SELECT name FROM sqlite_master 
--   WHERE name LIKE 'community_source%' AND type = 'table';

-- -- 检查标签数据
-- SELECT * FROM community_tags;

-- -- 检查触发器数量
-- SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'update_%';
