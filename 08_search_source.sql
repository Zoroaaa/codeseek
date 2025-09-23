-- ===============================================
-- 搜索源管理模块数据库结构 + 默认数据 (集成代理功能版本)
-- 版本: v2.4.0
-- 说明: 修复前后端匹配问题，优化用户注册默认配置，添加代理功能支持
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
    supports_detail_extraction INTEGER DEFAULT 0, -- 是否支持详情提取
    extraction_priority TEXT DEFAULT 'medium',  -- 提取优先级(high/medium/low)
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
    -- 详情提取配置
    supports_detail_extraction INTEGER DEFAULT 0, -- 是否支持详情提取
    extraction_quality TEXT DEFAULT 'none',     -- 提取质量(excellent/good/fair/poor/none)
    average_extraction_time INTEGER DEFAULT 0,  -- 平均提取时间(毫秒)
    supported_features TEXT DEFAULT '[]',       -- 支持的功能(JSON数组)
    -- 代理配置 (新增)
    needs_proxy INTEGER DEFAULT 0,              -- 是否需要代理访问(1:需要 0:不需要)
    proxy_config TEXT DEFAULT NULL,             -- 代理配置(JSON格式)
    proxy_regions TEXT DEFAULT NULL,            -- 需要代理的地区列表(JSON数组)
    proxy_priority INTEGER DEFAULT 5,           -- 代理优先级(1-10)
    supports_direct_access INTEGER DEFAULT 1,   -- 是否支持直接访问(1:支持 0:不支持)
    -- 系统属性
    is_system INTEGER DEFAULT 0,                -- 是否系统搜索源(1:系统 0:自定义)
    is_active INTEGER DEFAULT 1,                -- 是否激活(1:激活 0:禁用)
    display_order INTEGER DEFAULT 999,          -- 显示顺序
    -- 统计信息
    usage_count INTEGER DEFAULT 0,              -- 使用次数
    last_used_at INTEGER,                       -- 最后使用时间
    proxy_usage_count INTEGER DEFAULT 0,        -- 代理使用次数 (新增)
    direct_usage_count INTEGER DEFAULT 0,       -- 直接访问次数 (新增)
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
    -- 代理配置 (新增)
    use_proxy INTEGER DEFAULT 0,                -- 是否使用代理(1:使用 0:不使用)
    custom_proxy_url TEXT DEFAULT NULL,         -- 自定义代理URL
    proxy_preference TEXT DEFAULT 'auto',       -- 代理偏好(auto/always/never/manual)
    allow_fallback_direct INTEGER DEFAULT 1,    -- 代理失败时是否允许直连(1:允许 0:不允许)
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    UNIQUE(user_id, source_id),                 -- 用户+搜索源唯一
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES search_sources (id) ON DELETE CASCADE
);

-- ===============================================
-- 5. 代理服务器管理表 (新增)
-- ===============================================

-- 代理服务器配置表
CREATE TABLE IF NOT EXISTS proxy_servers (
    id TEXT PRIMARY KEY,                        -- 代理服务器唯一标识
    name TEXT NOT NULL,                         -- 代理服务器名称
    description TEXT,                           -- 描述信息
    base_url TEXT NOT NULL,                     -- 代理服务器基础URL
    server_region TEXT DEFAULT 'US',            -- 服务器所在地区
    supported_regions TEXT DEFAULT '[]',        -- 支持的用户地区(JSON数组)
    server_type TEXT DEFAULT 'general',         -- 服务器类型(general/specialized/backup)
    max_concurrent_requests INTEGER DEFAULT 100, -- 最大并发请求数
    request_timeout INTEGER DEFAULT 30000,      -- 请求超时时间(毫秒)
    -- 状态和性能
    is_active INTEGER DEFAULT 1,                -- 是否激活(1:激活 0:禁用)
    health_status TEXT DEFAULT 'unknown',       -- 健康状态(healthy/degraded/unhealthy/unknown)
    last_health_check INTEGER,                  -- 最后健康检查时间
    average_response_time INTEGER DEFAULT 0,    -- 平均响应时间(毫秒)
    success_rate REAL DEFAULT 0.0,              -- 成功率(0.0-1.0)
    uptime_percentage REAL DEFAULT 0.0,         -- 可用性百分比(0.0-1.0)
    -- 使用统计
    total_requests INTEGER DEFAULT 0,           -- 总请求数
    successful_requests INTEGER DEFAULT 0,      -- 成功请求数
    failed_requests INTEGER DEFAULT 0,          -- 失败请求数
    -- 配置选项
    auth_required INTEGER DEFAULT 0,            -- 是否需要认证(1:需要 0:不需要)
    auth_config TEXT DEFAULT NULL,              -- 认证配置(JSON格式)
    rate_limit_config TEXT DEFAULT NULL,        -- 速率限制配置(JSON格式)
    custom_headers TEXT DEFAULT NULL,           -- 自定义请求头(JSON格式)
    -- 优先级和权重
    priority INTEGER DEFAULT 5,                 -- 服务器优先级(1-10)
    weight INTEGER DEFAULT 1,                   -- 负载均衡权重
    -- 系统属性
    is_system INTEGER DEFAULT 0,                -- 是否系统代理服务器(1:系统 0:自定义)
    created_by TEXT,                            -- 创建者ID
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 6. 用户代理配置表 (新增)
-- ===============================================

-- 用户全局代理配置表
CREATE TABLE IF NOT EXISTS user_proxy_configs (
    id TEXT PRIMARY KEY,                        -- 配置唯一标识
    user_id TEXT NOT NULL UNIQUE,               -- 关联用户ID(唯一)
    -- 全局代理设置
    proxy_enabled INTEGER DEFAULT 0,            -- 是否启用代理(1:启用 0:禁用)
    intelligent_routing INTEGER DEFAULT 1,      -- 是否启用智能路由(1:启用 0:禁用)
    user_region TEXT DEFAULT 'CN',              -- 用户所在地区
    preferred_proxy_server TEXT,                -- 首选代理服务器ID
    fallback_proxy_servers TEXT DEFAULT '[]',   -- 备用代理服务器列表(JSON数组)
    -- 自动切换设置
    auto_switch_on_failure INTEGER DEFAULT 1,   -- 代理失败时自动切换(1:启用 0:禁用)
    auto_fallback_direct INTEGER DEFAULT 1,     -- 所有代理失败时自动直连(1:启用 0:禁用)
    health_check_interval INTEGER DEFAULT 300,  -- 健康检查间隔(秒)
    -- 性能和超时设置
    request_timeout INTEGER DEFAULT 30000,      -- 请求超时时间(毫秒)
    max_retries INTEGER DEFAULT 2,              -- 最大重试次数
    retry_delay INTEGER DEFAULT 1000,           -- 重试延迟(毫秒)
    -- 高级设置
    custom_proxy_rules TEXT DEFAULT NULL,       -- 自定义代理规则(JSON格式)
    whitelist_sources TEXT DEFAULT '[]',        -- 强制使用代理的源列表(JSON数组)
    blacklist_sources TEXT DEFAULT '[]',        -- 禁用代理的源列表(JSON数组)
    proxy_headers TEXT DEFAULT NULL,            -- 自定义代理请求头(JSON格式)
    -- 统计信息
    total_proxy_requests INTEGER DEFAULT 0,     -- 总代理请求数
    successful_proxy_requests INTEGER DEFAULT 0, -- 成功代理请求数
    failed_proxy_requests INTEGER DEFAULT 0,    -- 失败代理请求数
    data_transferred INTEGER DEFAULT 0,         -- 传输数据量(字节)
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (preferred_proxy_server) REFERENCES proxy_servers (id) ON DELETE SET NULL
);

-- ===============================================
-- 7. 索引定义
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
-- 代理相关索引 (新增)
CREATE INDEX IF NOT EXISTS idx_search_sources_proxy ON search_sources(needs_proxy, proxy_priority);
CREATE INDEX IF NOT EXISTS idx_search_sources_proxy_regions ON search_sources(proxy_regions);

CREATE INDEX IF NOT EXISTS idx_user_source_configs_user ON user_search_source_configs(user_id, is_enabled);
CREATE INDEX IF NOT EXISTS idx_user_source_configs_source ON user_search_source_configs(source_id);
-- 用户代理配置索引 (新增)
CREATE INDEX IF NOT EXISTS idx_user_source_configs_proxy ON user_search_source_configs(user_id, use_proxy);

-- 代理服务器索引 (新增)
CREATE INDEX IF NOT EXISTS idx_proxy_servers_active ON proxy_servers(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_region ON proxy_servers(server_region, is_active);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_health ON proxy_servers(health_status, is_active);
CREATE INDEX IF NOT EXISTS idx_proxy_servers_performance ON proxy_servers(success_rate DESC, average_response_time ASC);

-- 用户代理配置索引 (新增)
CREATE INDEX IF NOT EXISTS idx_user_proxy_configs_enabled ON user_proxy_configs(proxy_enabled, user_region);

-- ===============================================
-- 8. 插入系统默认数据
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
    supports_detail_extraction, extraction_priority, created_at, updated_at
) VALUES 
    ('database', 'search_sources', '📚 番号资料站', '提供详细的番号信息、封面和演员资料', '📚', '#3b82f6', 1, 1, 1, 1, 'search', 1, 1, 'high', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('streaming', 'browse_sites', '🎥 在线播放平台', '提供在线观看和下载服务', '🎥', '#10b981', 2, 1, 1, 0, 'browse', 5, 1, 'medium', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('torrent', 'search_sources', '🧲 磁力搜索', '提供磁力链接和种子文件', '🧲', '#f59e0b', 3, 1, 1, 1, 'search', 3, 1, 'low', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('community', 'browse_sites', '💬 社区论坛', '用户交流讨论和资源分享', '💬', '#8b5cf6', 4, 1, 1, 0, 'browse', 10, 0, 'none', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('others', 'browse_sites', '🌟 其他资源', '其他类型的搜索资源', '🌟', '#6b7280', 99, 1, 1, 0, 'browse', 10, 0, 'none', strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 番号资料站 (添加代理配置)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, supports_detail_extraction,
    extraction_quality, average_extraction_time, supported_features, 
    needs_proxy, proxy_config, proxy_regions, proxy_priority, supports_direct_access,
    is_system, is_active, display_order, created_at, updated_at
) VALUES 
    ('javbus', 'database', 'JavBus', '番号+磁力一体站，信息完善', '提供详细的番号信息、封面、演员资料和磁力链接', '🎬', 'https://www.javbus.com/search/{keyword}', 'https://www.javbus.com', 'search', 1, 1, 1, 1, 'excellent', 3000, '["screenshots", "downloadLinks", "magnetLinks", "actresses", "metadata", "description", "rating", "tags"]', 1, '{"autoDetect": true, "preferredServers": ["ASIA", "US"]}', '["CN", "RU", "IR", "KR"]', 1, 1, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javdb', 'database', 'JavDB', '极简风格番号资料站，轻量快速', '提供简洁的番号信息和磁力链接', '📚', 'https://javdb.com/search?q={keyword}&f=all', 'https://javdb.com', 'search', 1, 1, 2, 1, 'good', 2500, '["screenshots", "magnetLinks", "actresses", "metadata", "description", "rating", "tags"]', 1, '{"autoDetect": true, "preferredServers": ["ASIA", "EU"]}', '["CN", "RU", "IR"]', 2, 1, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javlibrary', 'database', 'JavLibrary', '评论活跃，女优搜索详尽', '老牌番号资料站，社区活跃', '📖', 'https://www.javlibrary.com/cn/vl_searchbyid.php?keyword={keyword}', 'https://www.javlibrary.com', 'search', 1, 1, 3, 0, 'none', 0, '[]', 1, '{"autoDetect": true, "preferredServers": ["US", "EU"]}', '["CN"]', 3, 1, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javfinder', 'database', 'JavFinder', '智能搜索引擎，结果精准', '新兴的番号搜索引擎', '🔍', 'https://javfinder.is/search/{keyword}', 'https://javfinder.is', 'search', 1, 1, 4, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 在线播放平台
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, supports_detail_extraction,
    extraction_quality, average_extraction_time, supported_features, 
    needs_proxy, proxy_config, proxy_regions, proxy_priority, supports_direct_access,
    is_system, is_active, display_order, created_at, updated_at
) VALUES 
    ('jable', 'streaming', 'Jable', '高清在线观看，支持多种格式', '知名在线播放平台', '📺', 'https://jable.tv', 'https://jable.tv', 'browse', 0, 0, 5, 1, 'good', 3500, '["screenshots", "downloadLinks", "actresses", "metadata", "description", "tags"]', 0, NULL, NULL, 5, 1, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javmost', 'streaming', 'JavMost', '免费在线观看，更新及时', '免费在线播放平台', '🎦', 'https://javmost.com', 'https://javmost.com', 'browse', 0, 0, 6, 1, 'fair', 4500, '["screenshots", "downloadLinks", "magnetLinks", "actresses", "metadata", "description"]', 0, NULL, NULL, 5, 1, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javguru', 'streaming', 'JavGuru', '多线路播放，观看流畅', '多线路在线播放', '🎭', 'https://jav.guru', 'https://jav.guru', 'browse', 0, 0, 7, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('av01', 'streaming', 'AV01', '快速预览站点，封面大图清晰', '封面预览和在线播放', '🎥', 'https://av01.tv', 'https://av01.tv', 'browse', 0, 0, 8, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('missav', 'streaming', 'MissAV', '中文界面，封面高清，信息丰富', '中文在线播放平台', '💫', 'https://missav.com', 'https://missav.com', 'browse', 0, 0, 9, 0, 'none', 0, '[]', 1, '{"autoDetect": true, "preferredServers": ["ASIA"]}', '["CN", "SG"]', 4, 1, 1, 1, 5, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javhdporn', 'streaming', 'JavHD.porn', '高清资源下载，质量优秀', '高清下载和在线播放', '🎬', 'https://javhd.porn', 'https://javhd.porn', 'browse', 0, 0, 10, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 6, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javgg', 'streaming', 'JavGG', '免费观看平台，速度稳定', '免费在线播放', '⚡', 'https://javgg.net', 'https://javgg.net', 'browse', 0, 0, 11, 1, 'fair', 4500, '["screenshots", "actresses", "metadata"]', 0, NULL, NULL, 5, 1, 1, 1, 7, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('javhihi', 'streaming', 'JavHiHi', '在线播放，无需下载', '轻量级在线播放', '🎪', 'https://javhihi.com', 'https://javhihi.com', 'browse', 0, 0, 12, 1, 'fair', 5000, '["screenshots", "actresses"]', 0, NULL, NULL, 5, 1, 1, 1, 8, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 磁力搜索 (需要代理访问)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, supports_detail_extraction,
    extraction_quality, average_extraction_time, supported_features, 
    needs_proxy, proxy_config, proxy_regions, proxy_priority, supports_direct_access,
    is_system, is_active, display_order, created_at, updated_at
) VALUES 
    ('btsow', 'torrent', 'BTSOW', '中文磁力搜索引擎，番号资源丰富', '知名磁力搜索引擎', '🧲', 'https://btsow.com/search/{keyword}', 'https://btsow.com', 'search', 1, 1, 2, 0, 'none', 0, '[]', 1, '{"autoDetect": true, "preferredServers": ["ASIA", "US"]}', '["CN", "KR"]', 2, 1, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('magnetdl', 'torrent', 'MagnetDL', '磁力链接搜索，资源覆盖全面', '磁力链接搜索引擎', '🔗', 'https://www.magnetdl.com/search/?q={keyword}', 'https://www.magnetdl.com', 'search', 1, 1, 3, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('torrentkitty', 'torrent', 'TorrentKitty', '种子搜索引擎，下载资源丰富', '种子下载搜索', '🐱', 'https://www.torrentkitty.tv/search/{keyword}', 'https://www.torrentkitty.tv', 'search', 1, 1, 4, 0, 'none', 0, '[]', 0, NULL, NULL, 5, 1, 1, 1, 3, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('sukebei', 'torrent', 'Sukebei', '成人内容种子站，资源全面', '成人内容种子搜索', '🌙', 'https://sukebei.nyaa.si/?q={keyword}', 'https://sukebei.nyaa.si', 'search', 1, 1, 5, 1, 'fair', 6000, '["downloadLinks", "magnetLinks", "metadata", "description", "tags"]', 1, '{"autoDetect": true, "preferredServers": ["US", "EU"]}', '["CN", "KR", "SG"]', 3, 1, 1, 1, 4, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认搜索源 - 社区论坛 (需要代理访问)
INSERT OR REPLACE INTO search_sources (
    id, category_id, name, subtitle, description, icon, url_template, homepage_url,
    site_type, searchable, requires_keyword, search_priority, supports_detail_extraction,
    extraction_quality, average_extraction_time, supported_features, 
    needs_proxy, proxy_config, proxy_regions, proxy_priority, supports_direct_access,
    is_system, is_active, display_order, created_at, updated_at
) VALUES 
    ('sehuatang', 'community', '色花堂', '综合论坛社区，资源丰富', '知名成人论坛社区', '🌸', 'https://sehuatang.org', 'https://sehuatang.org', 'browse', 0, 0, 99, 0, 'none', 0, '[]', 1, '{"autoDetect": true, "preferredServers": ["ASIA"]}', '["CN"]', 1, 0, 1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('t66y', 'community', 'T66Y', '老牌论坛，资源更新快', '老牌成人论坛', '📋', 'https://t66y.com', 'https://t66y.com', 'browse', 0, 0, 99, 0, 'none', 0, '[]', 1, '{"autoDetect": true, "preferredServers": ["ASIA"]}', '["CN"]', 2, 0, 1, 1, 2, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 插入默认代理服务器配置
INSERT OR REPLACE INTO proxy_servers (
    id, name, description, base_url, server_region, supported_regions, server_type,
    max_concurrent_requests, request_timeout, is_active, health_status, 
    priority, weight, is_system, created_at, updated_at
) VALUES 
    ('proxy_us_main', 'US Main Proxy', '美国主代理服务器', 'https://us-proxy.workers.dev', 'US', '["US", "CA", "MX"]', 'general', 200, 30000, 1, 'unknown', 1, 10, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('proxy_eu_main', 'EU Main Proxy', '欧洲主代理服务器', 'https://eu-proxy.workers.dev', 'EU', '["DE", "FR", "UK", "IT", "ES", "NL", "CH"]', 'general', 150, 30000, 1, 'unknown', 2, 8, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('proxy_asia_main', 'Asia Main Proxy', '亚洲主代理服务器', 'https://asia-proxy.workers.dev', 'ASIA', '["CN", "JP", "KR", "SG", "TW", "HK", "MO"]', 'general', 300, 30000, 1, 'unknown', 1, 12, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
    ('proxy_backup', 'Backup Proxy', '备用代理服务器', 'https://backup-proxy.workers.dev', 'US', '["*"]', 'backup', 100, 45000, 1, 'unknown', 9, 3, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 9. 触发器定义
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

-- 代理服务器触发器 (新增)
CREATE TRIGGER IF NOT EXISTS update_proxy_servers_timestamp 
    AFTER UPDATE ON proxy_servers
    FOR EACH ROW
    BEGIN
        UPDATE proxy_servers SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_user_proxy_configs_timestamp 
    AFTER UPDATE ON user_proxy_configs
    FOR EACH ROW
    BEGIN
        UPDATE user_proxy_configs SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
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

-- 代理使用统计触发器 (新增)
CREATE TRIGGER IF NOT EXISTS update_proxy_usage_stats
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    WHEN NEW.source IS NOT NULL AND NEW.used_proxy = 1
    BEGIN
        UPDATE search_sources 
        SET proxy_usage_count = proxy_usage_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.source;
    END;

CREATE TRIGGER IF NOT EXISTS update_direct_usage_stats
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    WHEN NEW.source IS NOT NULL AND (NEW.used_proxy = 0 OR NEW.used_proxy IS NULL)
    BEGIN
        UPDATE search_sources 
        SET direct_usage_count = direct_usage_count + 1,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.source;
    END;

-- 代理服务器使用统计触发器 (新增)
CREATE TRIGGER IF NOT EXISTS update_proxy_server_stats_success
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    WHEN NEW.proxy_server_id IS NOT NULL AND NEW.status = 'success'
    BEGIN
        UPDATE proxy_servers 
        SET total_requests = total_requests + 1,
            successful_requests = successful_requests + 1,
            success_rate = CAST(successful_requests AS REAL) / total_requests,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.proxy_server_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_proxy_server_stats_failure
    AFTER INSERT ON user_search_history
    FOR EACH ROW
    WHEN NEW.proxy_server_id IS NOT NULL AND NEW.status != 'success'
    BEGIN
        UPDATE proxy_servers 
        SET total_requests = total_requests + 1,
            failed_requests = failed_requests + 1,
            success_rate = CAST(successful_requests AS REAL) / total_requests,
            updated_at = strftime('%s', 'now') * 1000
        WHERE id = NEW.proxy_server_id;
    END;

-- ===============================================
-- 10. 优化的用户注册默认配置触发器
-- ===============================================

-- 用户注册时自动为其创建默认搜索源配置
CREATE TRIGGER IF NOT EXISTS create_default_user_source_configs
    AFTER INSERT ON users
    FOR EACH ROW
    BEGIN
        -- 为新用户创建所有系统搜索源的配置
        INSERT INTO user_search_source_configs (
            id, user_id, source_id, is_enabled, use_proxy, proxy_preference, created_at, updated_at
        )
        SELECT 
            NEW.id || '_' || ss.id,  -- 配置ID
            NEW.id,                  -- 用户ID
            ss.id,                   -- 搜索源ID
            CASE 
                -- 默认启用策略：核心搜索源默认启用，其他根据类型决定
                WHEN ss.id IN ('javbus', 'javdb', 'javlibrary', 'btsow') THEN 1
                WHEN ss.searchable = 1 AND ss.site_type = 'search' THEN 1
                WHEN ss.site_type = 'browse' THEN 0
                ELSE 0
            END,
            CASE 
                -- 代理使用策略：根据源的代理需求设置
                WHEN ss.needs_proxy = 1 THEN 1
                ELSE 0
            END,
            CASE 
                -- 代理偏好：根据源的代理需求设置
                WHEN ss.needs_proxy = 1 THEN 'auto'
                ELSE 'never'
            END,
            strftime('%s', 'now') * 1000,  -- 创建时间
            strftime('%s', 'now') * 1000   -- 更新时间
        FROM search_sources ss
        WHERE ss.is_system = 1 AND ss.is_active = 1;
        
        -- 为新用户创建默认的全局代理配置
        INSERT INTO user_proxy_configs (
            id, user_id, proxy_enabled, intelligent_routing, user_region,
            preferred_proxy_server, auto_switch_on_failure, auto_fallback_direct,
            created_at, updated_at
        ) VALUES (
            NEW.id || '_proxy_config',  -- 配置ID
            NEW.id,                     -- 用户ID
            0,                          -- 默认禁用代理，让用户手动开启
            1,                          -- 启用智能路由
            'CN',                       -- 默认地区为中国
            'proxy_asia_main',          -- 默认使用亚洲代理
            1,                          -- 启用自动切换
            1,                          -- 启用直连回退
            strftime('%s', 'now') * 1000,  -- 创建时间
            strftime('%s', 'now') * 1000   -- 更新时间
        );
    END;

-- ===============================================
-- 11. 视图定义 (新增，方便查询代理配置)
-- ===============================================

-- 搜索源代理配置视图
CREATE VIEW IF NOT EXISTS v_source_proxy_config AS
SELECT 
    ss.id,
    ss.name,
    ss.needs_proxy,
    ss.proxy_config,
    ss.proxy_regions,
    ss.proxy_priority,
    ss.supports_direct_access,
    ss.proxy_usage_count,
    ss.direct_usage_count,
    CASE 
        WHEN ss.proxy_usage_count + ss.direct_usage_count > 0 
        THEN ROUND(CAST(ss.proxy_usage_count AS REAL) / (ss.proxy_usage_count + ss.direct_usage_count) * 100, 2)
        ELSE 0 
    END as proxy_usage_percentage
FROM search_sources ss
WHERE ss.is_active = 1;

-- 用户代理使用统计视图
CREATE VIEW IF NOT EXISTS v_user_proxy_stats AS
SELECT 
    upc.user_id,
    upc.proxy_enabled,
    upc.user_region,
    upc.total_proxy_requests,
    upc.successful_proxy_requests,
    upc.failed_proxy_requests,
    CASE 
        WHEN upc.total_proxy_requests > 0 
        THEN ROUND(CAST(upc.successful_proxy_requests AS REAL) / upc.total_proxy_requests * 100, 2)
        ELSE 0 
    END as proxy_success_rate,
    ps.name as preferred_proxy_name,
    ps.server_region as preferred_proxy_region
FROM user_proxy_configs upc
LEFT JOIN proxy_servers ps ON upc.preferred_proxy_server = ps.id;

-- 代理服务器性能视图
CREATE VIEW IF NOT EXISTS v_proxy_server_performance AS
SELECT 
    ps.id,
    ps.name,
    ps.server_region,
    ps.health_status,
    ps.total_requests,
    ps.success_rate,
    ps.average_response_time,
    ps.uptime_percentage,
    ps.priority,
    ps.weight,
    CASE 
        WHEN ps.success_rate >= 0.95 AND ps.average_response_time < 5000 THEN 'excellent'
        WHEN ps.success_rate >= 0.85 AND ps.average_response_time < 10000 THEN 'good'
        WHEN ps.success_rate >= 0.70 AND ps.average_response_time < 15000 THEN 'fair'
        ELSE 'poor'
    END as performance_grade
FROM proxy_servers ps
WHERE ps.is_active = 1
ORDER BY ps.success_rate DESC, ps.average_response_time ASC;