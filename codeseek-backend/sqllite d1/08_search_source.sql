-- ===============================================
-- 搜索源管理模块数据库结构 + 默认数据 (移除详情提取字段版本)
-- 版本: v2.3.2
-- 说明: 移除详情提取相关字段，简化数据库结构
-- ===============================================

-- ===============================================
-- 1. 搜索源大类管理
-- ===============================================

-- 搜索源大类表
CREATE TABLE IF NOT EXISTS search_major_categories (
    id TEXT PRIMARY KEY,                        -- 大类唯一标识
    name TEXT NOT NULL,                         -- 大类名称
    description TEXT,                           -- 大类描述
    icon TEXT DEFAULT '🌟',                     -- 大类图标
    color TEXT DEFAULT '#6b7280',               -- 大类颜色
    requires_keyword INTEGER DEFAULT 1,         -- 是否需要关键词(1:需要 0:不需要)
    display_order INTEGER DEFAULT 999,          -- 显示顺序
    is_system INTEGER DEFAULT 0,                -- 是否系统大类(1:系统 0:自定义)
    is_active INTEGER DEFAULT 1,                -- 是否激活(1:激活 0:禁用)
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL                 -- 更新时间戳
);

-- ===============================================
-- 2. 搜索源分类管理
-- ===============================================

-- 搜索源分类表
CREATE TABLE IF NOT EXISTS search_source_categories (
    id TEXT PRIMARY KEY,                        -- 分类唯一标识
    major_category_id TEXT NOT NULL,            -- 关联大类ID
    name TEXT NOT NULL,                         -- 分类名称
    description TEXT,                           -- 分类描述
    icon TEXT DEFAULT '📁',                     -- 分类图标
    color TEXT DEFAULT '#3b82f6',               -- 分类颜色
    display_order INTEGER DEFAULT 999,          -- 显示顺序
    is_system INTEGER DEFAULT 0,                -- 是否系统分类(1:系统 0:自定义)
    is_active INTEGER DEFAULT 1,                -- 是否激活(1:激活 0:禁用)
    -- 搜索配置
    default_searchable INTEGER DEFAULT 1,       -- 该分类下的源默认是否可搜索
    default_site_type TEXT DEFAULT 'search',    -- 默认网站类型(search/browse/reference)
    search_priority INTEGER DEFAULT 5,          -- 搜索优先级(1-10)
    -- 时间戳
    created_by TEXT,                            -- 创建者ID
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (major_category_id) REFERENCES search_major_categories (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 3. 搜索源管理
-- ===============================================

-- 搜索源表
CREATE TABLE IF NOT EXISTS search_sources (
    id TEXT PRIMARY KEY,                        -- 搜索源唯一标识
    category_id TEXT NOT NULL,                  -- 关联分类ID
    name TEXT NOT NULL,                         -- 搜索源名称
    subtitle TEXT,                              -- 搜索源副标题
    description TEXT,                           -- 搜索源描述
    icon TEXT DEFAULT '🔍',                     -- 搜索源图标
    url_template TEXT NOT NULL,                 -- URL模板
    homepage_url TEXT,                          -- 主页URL
    -- 网站类型配置
    site_type TEXT DEFAULT 'search',            -- 网站类型(search/browse/reference)
    searchable INTEGER DEFAULT 1,               -- 是否参与搜索(1:参与 0:不参与)
    requires_keyword INTEGER DEFAULT 1,         -- 是否需要关键词(1:需要 0:不需要)
    search_priority INTEGER DEFAULT 5,          -- 搜索优先级(1-10)
    -- 系统属性
    is_system INTEGER DEFAULT 0,                -- 是否系统搜索源(1:系统 0:自定义)
    is_active INTEGER DEFAULT 1,                -- 是否激活(1:激活 0:禁用)
    display_order INTEGER DEFAULT 999,          -- 显示顺序
    -- 统计信息
    usage_count INTEGER DEFAULT 0,              -- 使用次数
    last_used_at INTEGER,                       -- 最后使用时间
    -- 时间戳
    created_by TEXT,                            -- 创建者ID
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (category_id) REFERENCES search_source_categories (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 4. 用户搜索源配置表
-- ===============================================

-- 用户搜索源配置表(用户个性化配置)
CREATE TABLE IF NOT EXISTS user_search_source_configs (
    id TEXT PRIMARY KEY,                        -- 配置唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    source_id TEXT NOT NULL,                    -- 关联搜索源ID
    is_enabled INTEGER DEFAULT 1,               -- 是否启用(1:启用 0:禁用)
    custom_priority INTEGER,                    -- 自定义优先级
    custom_name TEXT,                           -- 自定义名称
    custom_subtitle TEXT,                       -- 自定义副标题
    custom_icon TEXT,                           -- 自定义图标
    notes TEXT,                                 -- 用户备注
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    UNIQUE(user_id, source_id),                 -- 用户+搜索源唯一
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES search_sources (id) ON DELETE CASCADE
);

-- ===============================================
-- 5. 索引定义
-- ===============================================

-- 搜索源管理模块索引
CREATE INDEX IF NOT EXISTS idx_major_categories_order ON search_major_categories(display_order, is_active);
CREATE INDEX IF NOT EXISTS idx_major_categories_system ON search_major_categories(is_system, is_active);

CREATE INDEX IF NOT EXISTS idx_source_categories_major ON search_source_categories(major_category_id, display_order);
CREATE INDEX IF NOT EXISTS idx_source_categories_system ON search_source_categories(is_system, is_active);
CREATE INDEX IF NOT EXISTS idx_source_categories_created_by ON search_source_categories(created_by);

CREATE INDEX IF NOT EXISTS idx_search_sources_category ON search_sources(category_id, display_order);
CREATE INDEX IF NOT EXISTS idx_search_sources_system ON search_sources(is_system, is_active);
CREATE INDEX IF NOT EXISTS idx_search_sources_searchable ON search_sources(searchable, search_priority);
CREATE INDEX IF NOT EXISTS idx_search_sources_site_type ON search_sources(site_type);
CREATE INDEX IF NOT EXISTS idx_search_sources_created_by ON search_sources(created_by);
CREATE INDEX IF NOT EXISTS idx_search_sources_usage ON search_sources(usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_source_configs_user ON user_search_source_configs(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_source_configs_source ON user_search_source_configs(source_id);

-- ===============================================
-- 6. 插入系统默认数据
-- ===============================================

-- 插入默认大类
INSERT OR REPLACE INTO search_major_categories (
    id, name, description, icon, color, requires_keyword, 
    display_order, is_system, is_active, created_at, updated_at
) VALUES 
    ('search_sources', '🔍 搜索源', '支持番号搜索的网站', '🔍', '#3b82f6', 1, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('browse_sites', '🌐 浏览站点', '仅供访问，不参与搜索', '🌐', '#10b981', 0, 2, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认分类
INSERT OR REPLACE INTO search_source_categories (
    id, major_category_id, name, description, icon, color, display_order, 
    is_system, is_active, default_searchable, default_site_type, search_priority,
    created_at, updated_at
) VALUES 
    ('database', 'search_sources', '📚 番号资料站', '提供详细的番号信息、封面和演员资料', '📚', '#3b82f6', 1, 1, 1, 1, 'search', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('streaming', 'search_sources', '🎥 在线播放平台', '提供在线观看和下载服务', '🎥', '#10b981', 2, 1, 1, 1, 'search', 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('torrent', 'browse_sites', '🧲 磁力搜索', '提供磁力链接和种子文件', '🧲', '#f59e0b', 3, 1, 1, 0, 'browse', 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('community', 'browse_sites', '💬 社区论坛', '用户交流讨论和资源分享', '💬', '#8b5cf6', 4, 1, 1, 0, 'browse', 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('others', 'browse_sites', '🌟 其他资源', '其他类型的搜索资源', '🌟', '#6b7280', 99, 1, 1, 0, 'browse', 10, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 番号资料站
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES 
    ('javbus', 'database', 'JavBus', '番号+磁力一体站，信息完善', '提供详细的番号信息、封面、演员资料和磁力链接', '🎬', 'https://www.javbus.com/search/{keyword}', 'https://www.javbus.com', 'search', 1, 1, 1, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javdb', 'database', 'JavDB', '极简风格番号资料站，轻量快速', '提供简洁的番号信息和磁力链接', '📚', 'https://javdb.com/search?q={keyword}&f=all', 'https://javdb.com', 'search', 1, 1, 2, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javlibrary', 'database', 'JavLibrary', '评论活跃，女优搜索详尽', '老牌番号资料站，社区活跃', '📖', 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}', 'https://www.javlibrary.com', 'search', 1, 1, 3, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javfinder', 'database', 'JavFinder', '智能搜索引擎，结果精准', '新兴的番号搜索引擎', '🔍', 'https://javfinder.is/search/{keyword}', 'https://javfinder.is', 'search', 1, 1, 4, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 在线播放平台 (现在参与搜索)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES 
    ('jable', 'streaming', 'Jable', '高清在线观看，支持多种格式', '知名在线播放平台', '📺', 'https://jable.tv/search/{keyword}', 'https://jable.tv', 'search', 1, 1, 5, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javmost', 'streaming', 'JavMost', '免费在线观看，更新及时', '免费在线播放平台', '🎦', 'https://javmost.com/search/{keyword}', 'https://javmost.com', 'search', 1, 1, 6, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javguru', 'streaming', 'JavGuru', '多线路播放，观看流畅', '多线路在线播放', '🎭', 'https://jav.guru/search/{keyword}', 'https://jav.guru', 'search', 1, 1, 7, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('av01', 'streaming', 'AV01', '快速预览站点，封面大图清晰', '封面预览和在线播放', '🎥', 'https://av01.tv/search/{keyword}', 'https://av01.tv', 'search', 1, 1, 8, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('missav', 'streaming', 'MissAV', '中文界面，封面高清，信息丰富', '中文在线播放平台', '💫', 'https://missav.com/search/{keyword}', 'https://missav.com', 'search', 1, 1, 9, 1, 1, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javhdporn', 'streaming', 'JavHD.porn', '高清资源下载，质量优秀', '高清下载和在线播放', '🎬', 'https://javhd.porn/search/{keyword}', 'https://javhd.porn', 'search', 1, 1, 10, 1, 1, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javgg', 'streaming', 'JavGG', '免费观看平台，速度稳定', '免费在线播放', '⚡', 'https://javgg.net/search/{keyword}', 'https://javgg.net', 'search', 1, 1, 11, 1, 1, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javhihi', 'streaming', 'JavHiHi', '在线播放，无需下载', '轻量级在线播放', '🎪', 'https://javhihi.com/search/{keyword}', 'https://javhihi.com', 'search', 1, 1, 12, 1, 1, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 磁力搜索 (现在是浏览站点，不参与搜索)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES 
    ('btsow', 'torrent', 'BTSOW', '中文磁力搜索引擎，番号资源丰富', '知名磁力搜索引擎', '🧲', 'https://btsow.com', 'https://btsow.com', 'browse', 0, 0, 99, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('magnetdl', 'torrent', 'MagnetDL', '磁力链接搜索，资源覆盖全面', '磁力链接搜索引擎', '🔗', 'https://www.magnetdl.com', 'https://www.magnetdl.com', 'browse', 0, 0, 99, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('torrentkitty', 'torrent', 'TorrentKitty', '种子搜索引擎，下载资源丰富', '种子下载搜索', '🐱', 'https://www.torrentkitty.tv', 'https://www.torrentkitty.tv', 'browse', 0, 0, 99, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('sukebei', 'torrent', 'Sukebei', '成人内容种子站，资源全面', '成人内容种子搜索', '🌙', 'https://sukebei.nyaa.si', 'https://sukebei.nyaa.si', 'browse', 0, 0, 99, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 社区论坛
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES 
    ('sehuatang', 'community', '色花堂', '综合论坛社区，资源丰富', '知名成人论坛社区', '🌸', 'https://sehuatang.org', 'https://sehuatang.org', 'browse', 0, 0, 99, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('t66y', 'community', 'T66Y', '老牌论坛，资源更新快', '老牌成人论坛', '📋', 'https://t66y.com', 'https://t66y.com', 'browse', 0, 0, 99, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 7. 触发器定义
-- ===============================================

-- 搜索源管理模块触发器
CREATE TRIGGER IF NOT EXISTS update_major_categories_timestamp 
    AFTER UPDATE ON search_major_categories
    FOR EACH ROW
    BEGIN
        UPDATE search_major_categories SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_source_categories_timestamp 
    AFTER UPDATE ON search_source_categories
    FOR EACH ROW
    BEGIN
        UPDATE search_source_categories SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_search_sources_timestamp 
    AFTER UPDATE ON search_sources
    FOR EACH ROW
    BEGIN
        UPDATE search_sources SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_user_source_configs_timestamp 
    AFTER UPDATE ON user_search_source_configs
    FOR EACH ROW
    BEGIN
        UPDATE user_search_source_configs SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- 级联删除和更新触发器
CREATE TRIGGER IF NOT EXISTS cascade_delete_category_sources
    AFTER DELETE ON search_source_categories
    FOR EACH ROW
    BEGIN
        -- 删除分类时，将该分类下的搜索源移动到默认分类
        UPDATE search_sources 
        SET category_id = 'others', updated_at = strftime('%s', 'now') * 1000
        WHERE category_id = OLD.id;
    END;

-- 使用统计触发器 (假设存在用户搜索历史表)
CREATE TRIGGER IF NOT EXISTS update_source_usage_stats
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    WHEN NEW.source IS NOT NULL
    BEGIN
        UPDATE search_sources 
        SET usage_count = usage_count + 1, 
            last_used_at = strftime('%s', 'now') * 1000,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.source;
    END;

-- ===============================================
-- 8. 优化的用户注册默认配置触发器
-- ===============================================

-- 用户注册时自动为其创建默认搜索源配置
CREATE TRIGGER IF NOT EXISTS create_default_user_source_configs
    AFTER INSERT ON users
    FOR EACH ROW
    BEGIN
        -- 为新用户创建所有系统搜索源的配置
        INSERT INTO user_search_source_configs (
            id, user_id, source_id, is_enabled, created_at, updated_at
        )
        SELECT 
            NEW.id || '_' || ss.id,  -- 配置ID
            NEW.id,                  -- 用户ID
            ss.id,                   -- 搜索源ID
            CASE 
                -- 默认启用策略：核心搜索源默认启用，其他根据类型决定
                WHEN ss.id IN ('javbus', 'javdb', 'javlibrary', 'jable', 'javmost') THEN 1
                WHEN ss.searchable = 1 AND ss.site_type = 'search' THEN 1
                WHEN ss.site_type = 'browse' THEN 0
                ELSE 0
            END,
            strftime('%s', 'now') * 1000,  -- 创建时间
            strftime('%s', 'now') * 1000   -- 更新时间
        FROM search_sources ss
        WHERE ss.is_system = 1 AND ss.is_active = 1;
    END;