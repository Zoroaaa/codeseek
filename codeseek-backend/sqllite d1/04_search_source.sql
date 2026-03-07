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
    ('javlibrary', 'database', 'JavLibrary', '评论活跃，女优搜索详尽', '老牌番号资料站，社区活跃', '📖', 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}', 'https://www.javlibrary.com', 'search', 1, 1, 3, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 在线播放平台 (现在参与搜索)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES 
    ('jable', 'streaming', 'Jable', '高清在线观看，支持多种格式', '知名在线播放平台', '📺', 'https://jable.tv/videos/{keyword}/', 'https://jable.tv', 'search', 1, 1, 5, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javmost', 'streaming', 'JavMost', '免费在线观看，更新及时', '免费在线播放平台', '🎦', 'https://www5.javmost.com/search/{keyword}', 'https://javmost.com', 'search', 1, 1, 6, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javguru', 'streaming', 'JavGuru', '多线路播放，观看流畅', '多线路在线播放', '🎭', 'https://jav.guru/search/{keyword}', 'https://jav.guru', 'search', 1, 1, 7, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('av01', 'streaming', 'AV01', '快速预览站点，封面大图清晰', '封面预览和在线播放', '🎥', 'https://av01.tv/jp/search?q={keyword}', 'https://av01.tv', 'search', 1, 1, 8, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javgg', 'streaming', 'JavGG', '免费观看平台，速度稳定', '免费在线播放', '⚡', 'https://javgg.net/search/{keyword}', 'https://javgg.net', 'search', 1, 1, 11, 1, 1, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

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
-- 新增和更新的搜索源数据
-- 基于网络搜索验证和更新
-- 版本: 2025.01
-- ===============================================

-- 更新已存在的搜索源（去重并更新信息）

-- 插入新的搜索源 - 在线播放平台（已验证存在且活跃的）
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES
    -- MissAV - 主流JAV流媒体平台（已验证活跃，虽有法律纠纷但仍运营）
    ('missav', 'streaming', 'MissAV', '亚洲最大JAV流媒体平台，月访问量超3亿', '提供高清无码JAV内容，拥有庞大的日本成人视频库，支持1080p流媒体播放', '🎥', 'https://missav.ws/search/{keyword}', 'https://missav.ws', 'search', 1, 1, 9, 1, 1, 27, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- SupJAV - 大型JAV平台
    ('supjav', 'streaming', 'SupJAV', '每日更新的高质量JAV平台', '提供数万部完整长度JAV视频，支持高清流媒体播放，更新频率高', '📺', 'https://supjav.com/search?q={keyword}', 'https://supjav.com', 'search', 1, 1, 10, 1, 1, 28, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- BestJavPorn - 综合JAV站点
    ('bestjavporn', 'streaming', 'BestJavPorn', '提供审查和无码JAV内容', '拥有大量审查和未审查JAV的综合性站点，内容分类详细', '🎦', 'https://bestjavporn.com/search?q={keyword}', 'https://bestjavporn.com', 'search', 1, 1, 11, 1, 1, 29, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAV.sb - 未审查内容专门站
    ('javsb', 'streaming', 'JAV.sb', '专注未审查JAV内容', '拥有超过5600部未审查JAV的免费流媒体平台', '🎭', 'https://jav.sb/search/{keyword}', 'https://jav.sb', 'search', 1, 1, 12, 1, 1, 30, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVLeak - 高质量JAV平台
    ('javleak', 'streaming', 'JAVLeak', '流行日本成人视频平台', '提供高质量审查和未审查日本成人内容，界面友好', '🎥', 'https://javleak.com/search?q={keyword}', 'https://javleak.com', 'search', 1, 1, 13, 1, 1, 31, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVSeen - 大规模JAV收藏
    ('javseen', 'streaming', 'JAVSeen', '超10万部完整长度电影', '提供大规模免费流媒体日本成人视频收藏，内容丰富', '🎬', 'https://javseen.tv/search/{keyword}', 'https://javseen.tv', 'search', 1, 1, 14, 1, 1, 32, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVTsunami - 知名明星作品集
    ('javtsunami', 'streaming', 'JAVTsunami', '热门JAV明星专题站', '收录数千部行业热门明星JAV作品，按演员分类清晰', '⚡', 'https://javtsunami.com/search/{keyword}', 'https://javtsunami.com', 'search', 1, 1, 15, 1, 1, 33, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAV Subtitled - 字幕JAV专门站
    ('javsubtitled', 'streaming', 'JAV Subtitled', '提供英文字幕JAV内容', '专门提供带英文字幕的JAV内容，方便非日语用户观看', '🎪', 'https://javsubtitled.com/search?q={keyword}', 'https://javsubtitled.com', 'search', 1, 1, 16, 1, 1, 34, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVOut - HD高清JAV
    ('javout', 'streaming', 'JAVOut', '高清JAV视频源', '提供完整长度HD高清JAV视频，画质优秀', '📺', 'https://javout.co/search/{keyword}', 'https://javout.co', 'search', 1, 1, 17, 1, 1, 35, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVCL - 完整长度AV专门站
    ('javcl', 'streaming', 'JAVCL', '完整长度AV电影专门站', '专注于来自日本的完整长度AV视频和电影', '🎭', 'https://javcl.com/search/{keyword}', 'https://javcl.com', 'search', 1, 1, 19, 1, 1, 37, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JavDoe - JAV网络主站
    ('javdoe', 'streaming', 'JavDoe', 'JAV网络联盟主站', '由多个免费和付费站点组成的JAV网络联盟', '🎥', 'https://javdoe.to/search?q={keyword}', 'https://javdoe.to', 'search', 1, 1, 20, 1, 1, 38, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAV Desu - 未审查JAV
    ('javdesu', 'streaming', 'JAV Desu', '未审查JAV专门站', '提供各种未审查JAV内容，更新频繁', '🎬', 'https://javdesu.tv/search/{keyword}', 'https://javdesu.tv', 'search', 1, 1, 21, 1, 1, 39, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JavyNow - 免费日本成人视频
    ('javynow', 'streaming', 'JavyNow', '100%免费日本成人视频', '提供最佳日本成人内容的免费平台', '⚡', 'https://javynow.com/search/{keyword}', 'https://javynow.com', 'search', 1, 1, 22, 1, 1, 40, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVHDPorn (避免与已存在的重复)
    ('javhdporn2', 'streaming', 'JAVHDPorn.net', '免费HD高清JAV', '提供高清JAV内容的免费流媒体平台', '🎪', 'https://javhdporn.net/search?q={keyword}', 'https://javhdporn.net', 'search', 1, 1, 23, 1, 1, 41, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAV Ass Lover
    ('javasslove', 'streaming', 'JAV Ass Lover', '日本成人特色内容', '专注于特定类型日本成人内容的站点', '📺', 'https://javass.love/search/{keyword}', 'https://javass.love', 'search', 1, 1, 24, 1, 1, 42, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAV Subtitle (另一个字幕站)
    ('javsubtitle', 'streaming', 'JAV Subtitle', '高质量英文字幕JAV', '提供专业英文字幕的高质量JAV内容', '🎦', 'https://javsubtitle.xyz/search?q={keyword}', 'https://javsubtitle.xyz', 'search', 1, 1, 25, 1, 1, 43, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入新的搜索源 - 磁力种子站点（设为浏览站点）
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES
    -- OneJAV - 免费JAV种子站
    ('onejav', 'torrent', 'OneJAV', '免费JAV种子下载站', '提供数千部完整长度JAV电影的种子下载', '🧲', 'https://onejav.com', 'https://onejav.com', 'browse', 0, 0, 99, 1, 1, 25, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- Project JAV - 大规模种子站
    ('projectjav', 'torrent', 'Project Jav', '大型JAV种子库', '收录超过53000部日本成人视频种子', '🔗', 'https://projectjav.com', 'https://projectjav.com', 'browse', 0, 0, 99, 1, 1, 26, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- NextJAV - 完整长度种子
    ('nextjav', 'torrent', 'NextJAV', '完整长度JAV种子', '专注于完整长度日本成人视频的种子站点', '🐱', 'https://nextjav.com', 'https://nextjav.com', 'browse', 0, 0, 99, 1, 1, 27, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JavJunkies - 老牌种子站
    ('javjunkies', 'torrent', 'JavJunkies', '十年档案JAV种子站', '拥有十年历史档案的大型JAV种子站点', '🌙', 'https://javjunkies.org', 'https://javjunkies.org', 'browse', 0, 0, 99, 1, 1, 28, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- JAVBEE - JAV种子跟踪站
    ('javbee', 'torrent', 'JAVBEE', 'JAV种子跟踪站', '每月百万访问的JAV种子跟踪站点', '🧲', 'https://javbee.org', 'https://javbee.org', 'browse', 0, 0, 99, 1, 1, 29, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- iJavTorrent - 专门种子下载
    ('ijavtorrent', 'torrent', 'iJavTorrent', 'JAV种子下载专门站', '专注于JAV种子文件下载的站点', '🔗', 'https://ijavtorrent.com', 'https://ijavtorrent.com', 'browse', 0, 0, 99, 1, 1, 30, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- Empornium - 私人种子站
    ('empornium', 'torrent', 'Empornium', '私人成人种子站', '综合性私人成人内容种子站点，需要邀请', '🐱', 'https://empornium.is', 'https://empornium.is', 'browse', 0, 0, 99, 1, 1, 31, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 141PPV - 未审查种子
    ('141ppv', 'torrent', '141PPV', '未审查JAV种子', '提供高质量未审查JAV内容种子下载', '🧲', 'https://141ppv.com', 'https://141ppv.com', 'browse', 0, 0, 99, 1, 1, 32, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- LoveTorrent - 综合种子站
    ('lovetorrent', 'torrent', 'LoveTorrent', '综合成人种子站', '跟踪超过16万部成人电影种子的综合站点', '🔗', 'https://lovetorrent.net', 'https://lovetorrent.net', 'browse', 0, 0, 99, 1, 1, 33, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- XXXClub - 成人种子站
    ('xxxclub', 'torrent', 'XXXClub', '设计精良的种子站', '界面友好的成人内容种子站点', '🐱', 'https://xxxclub.to', 'https://xxxclub.to', 'browse', 0, 0, 99, 1, 1, 34, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- My JAV Bay - JAV种子专门站
    ('myjavbay', 'torrent', 'My JAV Bay', 'JAV种子专门站', '专注于JAV内容的种子下载站点', '🌙', 'https://myjavbay.com', 'https://myjavbay.com', 'browse', 0, 0, 99, 1, 1, 35, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 更新社区论坛分类（保持原有并新增）
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES
    -- 更新T66Y信息
    ('t66y', 'community', 'T66Y草榴社区', '1024老牌成人论坛', '成立于2006年的知名成人论坛社区，会员超20万，以"1024"文化著称', '🌿', 'https://t66y.com', 'https://t66y.com', 'browse', 0, 0, 99, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 更新色花堂信息
    ('sehuatang', 'community', '色花堂98堂', '综合成人论坛社区', '大型综合性成人论坛社区，资源丰富，分区详细', '🌸', 'https://sehuatang.org', 'https://sehuatang.org', 'browse', 0, 0, 99, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    -- 新增其他中文社区
    ('5278cc', 'community', '5278.cc', '综合讨论区', '综合性大型成人讨论区，内容多元化', '📋', 'https://5278.cc', 'https://5278.cc', 'browse', 0, 0, 99, 1, 1, 23, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('sexinsex', 'community', 'SexInSex', '老牌成人社区', '历史悠久的成人论坛，资源库丰富', '💬', 'https://sexinsex.net', 'https://sexinsex.net', 'browse', 0, 0, 99, 1, 1, 24, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('sis001', 'community', 'SIS001', '综合成人论坛', '全面的成人内容论坛，版块众多', '📖', 'https://sis001.com', 'https://sis001.com', 'browse', 0, 0, 99, 1, 1, 25, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('southplus', 'community', 'South-Plus', '综合娱乐论坛', '综合性娱乐讨论论坛，内容丰富', '🌐', 'https://south-plus.net', 'https://south-plus.net', 'browse', 0, 0, 99, 1, 1, 26, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('52av', 'community', '52AV', '手机A片王', '移动端优化的成人论坛社区', '📱', 'https://52av.one', 'https://52av.one', 'browse', 0, 0, 99, 1, 1, 27, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('jkforum', 'community', 'JKForum', '捷克论坛', '成人娱乐综合论坛', '💭', 'https://jkforum.net', 'https://jkforum.net', 'browse', 0, 0, 99, 1, 1, 28, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('eyny', 'community', 'EYNY', '伊莉讨论区', '大型综合讨论区，涵盖多种主题', '🗨️', 'https://eyny.com', 'https://eyny.com', 'browse', 0, 0, 99, 1, 1, 29, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('hungya', 'community', '夯鸭论坛', '资源分享论坛', '活跃的成人资源分享社区', '🦆', 'https://hung-ya.com', 'https://hung-ya.com', 'browse', 0, 0, 99, 1, 1, 30, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('oursogo', 'community', 'OurSogo', 'Sogo论坛', '休闲娱乐综合论坛', '🎯', 'https://oursogo.com', 'https://oursogo.com', 'browse', 0, 0, 99, 1, 1, 31, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('cool18', 'community', 'Cool18', '十八禁成人站', '成人内容综合站点', '🔞', 'https://cool18.com', 'https://cool18.com', 'browse', 0, 0, 99, 1, 1, 32, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('141hongkong', 'community', '141HongKong', '香港成人论坛', '香港地区成人论坛社区', '🇭🇰', 'https://141hongkong.com', 'https://141hongkong.com', 'browse', 0, 0, 99, 1, 1, 33, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('hjd2048', 'community', 'HJD2048', '2048核基地', '成人资源分享社区', '☢️', 'https://hjd2048.com', 'https://hjd2048.com', 'browse', 0, 0, 99, 1, 1, 34, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('91forum', 'community', '91论坛', '自拍分享论坛', '国内知名自拍分享社区', '🎬', 'https://91porny.com/forum', 'https://91porny.com/forum', 'browse', 0, 0, 99, 1, 1, 35, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    
    ('sex8cc', 'community', 'Sex8.cc', '杏吧论坛', '大型成人社区论坛', '🍑', 'https://sex8.cc', 'https://sex8.cc', 'browse', 0, 0, 99, 1, 1, 36, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 新增番号资料站分类（部分站点可作为资料库）
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, is_system, is_active,
    display_order, created_at, updated_at
) VALUES
    -- r/JAV Reddit社区
    ('rjav', 'database', 'r/JAV', 'Reddit JAV社区', '专注于日本成人视频讨论的Reddit社区', '📖', 'https://reddit.com/r/jav/search?q={keyword}', 'https://reddit.com/r/jav/', 'search', 1, 1, 30, 1, 1, 24, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);


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