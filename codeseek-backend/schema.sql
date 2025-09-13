-- ===============================================
-- 磁力快搜数据库结构 - 分类整理版
-- 版本: 精简优化版本
-- 说明: 按功能模块分类组织，保持所有原有功能不变
-- ===============================================

-- ===============================================
-- 1. 用户管理模块
-- ===============================================

-- 用户基础信息表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                        -- 用户唯一标识
    username TEXT UNIQUE NOT NULL,              -- 用户名（唯一）
    email TEXT UNIQUE NOT NULL,                 -- 邮箱（唯一）
    password_hash TEXT NOT NULL,                -- 密码哈希值
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    permissions TEXT DEFAULT '["search","favorite","history","sync"]', -- 用户权限（JSON数组）
    settings TEXT DEFAULT '{}',                 -- 用户设置（JSON对象）
    is_active INTEGER DEFAULT 1,                -- 是否激活（1:激活 0:禁用）
    last_login INTEGER,                         -- 最后登录时间
    login_count INTEGER DEFAULT 0               -- 登录次数统计
	email_verified INTEGER DEFAULT 0            -- 0:未验证 1:已验证
	email_verification_token TEXT               -- 当前邮箱验证token
	email_verification_expires INTEGER          -- 验证码过期时间
);

-- 用户会话管理表
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,                        -- 会话唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    token_hash TEXT NOT NULL,                   -- 会话token哈希值
    expires_at INTEGER NOT NULL,                -- 过期时间戳
    created_at INTEGER NOT NULL,                -- 创建时间戳
    last_activity INTEGER NOT NULL,             -- 最后活动时间
    ip_address TEXT,                            -- 登录IP地址
    user_agent TEXT,                            -- 用户代理信息
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户收藏表
CREATE TABLE IF NOT EXISTS user_favorites (
    id TEXT PRIMARY KEY,                        -- 收藏记录唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    title TEXT NOT NULL,                        -- 收藏项标题
    subtitle TEXT,                              -- 收藏项副标题
    url TEXT NOT NULL,                          -- 收藏项URL
    icon TEXT,                                  -- 收藏项图标
    keyword TEXT,                               -- 关联关键词
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户搜索历史表
CREATE TABLE IF NOT EXISTS user_search_history (
    id TEXT PRIMARY KEY,                        -- 搜索记录唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    query TEXT NOT NULL,                        -- 搜索查询词（兼容性字段，与keyword相同）
    source TEXT DEFAULT 'unknown',              -- 搜索来源
    results_count INTEGER DEFAULT 0,            -- 搜索结果数量
    created_at INTEGER NOT NULL,                -- 创建时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户行为记录表
CREATE TABLE IF NOT EXISTS user_actions (
    id TEXT PRIMARY KEY,                        -- 行为记录唯一标识
    user_id TEXT,                               -- 关联用户ID（可为空，记录匿名行为）
    action TEXT NOT NULL,                       -- 行为类型
    data TEXT DEFAULT '{}',                     -- 行为数据（JSON格式）
    ip_address TEXT,                            -- 用户IP地址
    user_agent TEXT,                            -- 用户代理信息
    created_at INTEGER NOT NULL,                -- 创建时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 2. 搜索引擎核心模块
-- ===============================================

-- 搜索结果缓存表
CREATE TABLE IF NOT EXISTS search_cache (
    id TEXT PRIMARY KEY,                        -- 缓存记录唯一标识
    keyword TEXT NOT NULL,                      -- 搜索关键词
    keyword_hash TEXT NOT NULL,                 -- 关键词哈希值（用于快速查找）
    results TEXT NOT NULL,                      -- 搜索结果（JSON格式）
    expires_at INTEGER NOT NULL,                -- 缓存过期时间
    created_at INTEGER NOT NULL,                -- 创建时间戳
    access_count INTEGER DEFAULT 0,             -- 访问次数统计
    last_accessed INTEGER NOT NULL              -- 最后访问时间
);

-- 搜索源状态检查缓存表
CREATE TABLE IF NOT EXISTS source_status_cache (
    id TEXT PRIMARY KEY,                        -- 状态缓存唯一标识
    source_id TEXT NOT NULL,                    -- 搜索源ID
    keyword TEXT NOT NULL,                      -- 检查关键词
    keyword_hash TEXT NOT NULL,                 -- 关键词哈希值
    status TEXT NOT NULL DEFAULT 'unknown',     -- 状态（unknown/available/unavailable）
    available INTEGER DEFAULT 0,                -- 是否可用（1:可用 0:不可用）
    content_match INTEGER DEFAULT 0,            -- 内容匹配度
    response_time INTEGER DEFAULT 0,            -- 响应时间（毫秒）
    quality_score INTEGER DEFAULT 0,            -- 质量评分
    match_details TEXT DEFAULT '{}',            -- 匹配详情（JSON格式）
    page_info TEXT DEFAULT '{}',                -- 页面信息（JSON格式）
    check_error TEXT,                           -- 检查错误信息
    expires_at INTEGER NOT NULL,                -- 缓存过期时间
    created_at INTEGER NOT NULL,                -- 创建时间戳
    last_accessed INTEGER NOT NULL,             -- 最后访问时间
    access_count INTEGER DEFAULT 0              -- 访问次数统计
);

-- 搜索源健康度统计表
CREATE TABLE IF NOT EXISTS source_health_stats (
    id TEXT PRIMARY KEY,                        -- 健康度统计唯一标识
    source_id TEXT NOT NULL,                    -- 搜索源ID
    total_checks INTEGER DEFAULT 0,             -- 总检查次数
    successful_checks INTEGER DEFAULT 0,        -- 成功检查次数
    content_matches INTEGER DEFAULT 0,          -- 内容匹配次数
    average_response_time INTEGER DEFAULT 0,    -- 平均响应时间
    last_success INTEGER,                       -- 最后成功时间
    last_failure INTEGER,                       -- 最后失败时间
    success_rate REAL DEFAULT 0.0,              -- 成功率
    health_score INTEGER DEFAULT 0,             -- 健康度评分
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    UNIQUE(source_id)
);

-- 状态检查任务队列表（异步处理用）
CREATE TABLE IF NOT EXISTS status_check_jobs (
    id TEXT PRIMARY KEY,                        -- 任务唯一标识
    user_id TEXT NOT NULL,                      -- 发起用户ID
    sources TEXT NOT NULL,                      -- 要检查的源列表（JSON数组）
    keyword TEXT NOT NULL,                      -- 检查关键词
    status TEXT DEFAULT 'pending',              -- 任务状态（pending/processing/completed/failed）
    progress INTEGER DEFAULT 0,                 -- 完成进度（0-100）
    results TEXT DEFAULT '{}',                  -- 检查结果（JSON格式）
    error_message TEXT,                         -- 错误信息
    created_at INTEGER NOT NULL,                -- 创建时间戳
    started_at INTEGER,                         -- 开始处理时间
    completed_at INTEGER,                       -- 完成时间
    expires_at INTEGER NOT NULL,                -- 任务过期时间
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ===============================================
-- 3. 社区功能模块
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
-- 4. 详情提取功能模块
-- ===============================================

-- 详情内容缓存表
CREATE TABLE IF NOT EXISTS detail_cache (
    id TEXT PRIMARY KEY,                        -- 缓存记录唯一标识
    url TEXT NOT NULL,                          -- 原始URL地址
    url_hash TEXT NOT NULL,                     -- URL哈希值（用于快速查找）
    source_type TEXT NOT NULL,                  -- 搜索源类型
    detail_data TEXT NOT NULL,                  -- 提取的详情信息（JSON格式存储）
    
    -- 提取元数据
    extraction_status TEXT DEFAULT 'success',   -- 提取状态（success/error/partial）
    extraction_time INTEGER DEFAULT 0,          -- 提取耗时（毫秒）
    extraction_error TEXT,                      -- 提取错误信息
    
    -- 缓存管理
    cache_size INTEGER DEFAULT 0,               -- 缓存大小（字节）
    access_count INTEGER DEFAULT 0,             -- 访问次数统计
    last_accessed INTEGER NOT NULL,             -- 最后访问时间
    expires_at INTEGER NOT NULL,                -- 缓存过期时间
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    UNIQUE(url_hash)
);

-- 详情提取历史记录表
CREATE TABLE IF NOT EXISTS detail_extraction_history (
    id TEXT PRIMARY KEY,                        -- 提取记录唯一标识
    user_id TEXT,                               -- 发起用户ID（可为空）
    url TEXT NOT NULL,                          -- 提取的URL地址
    source_type TEXT NOT NULL,                  -- 搜索源类型
    keyword TEXT,                               -- 关联的搜索关键词
    
    -- 提取结果
    extraction_status TEXT NOT NULL,            -- 提取状态（success/error/timeout/cached）
    extraction_time INTEGER DEFAULT 0,          -- 提取耗时（毫秒）
    extraction_error TEXT,                      -- 错误信息
    data_size INTEGER DEFAULT 0,                -- 提取数据大小（字节）
    
    -- 提取配置
    enable_cache INTEGER DEFAULT 1,             -- 是否启用缓存
    enable_retry INTEGER DEFAULT 1,             -- 是否启用重试
    timeout_ms INTEGER DEFAULT 15000,           -- 超时时间（毫秒）
    
    created_at INTEGER NOT NULL,                -- 提取时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 详情提取统计表
CREATE TABLE IF NOT EXISTS detail_extraction_stats (
    id TEXT PRIMARY KEY,                        -- 统计记录唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    
    -- 统计数据
    total_extractions INTEGER DEFAULT 0,        -- 总提取次数
    successful_extractions INTEGER DEFAULT 0,   -- 成功提取次数
    cached_extractions INTEGER DEFAULT 0,       -- 缓存命中次数
    failed_extractions INTEGER DEFAULT 0,       -- 失败提取次数
    
    -- 性能统计
    total_extraction_time INTEGER DEFAULT 0,    -- 总提取时间（毫秒）
    average_extraction_time INTEGER DEFAULT 0,  -- 平均提取时间（毫秒）
    cache_hit_rate REAL DEFAULT 0.0,            -- 缓存命中率
    
    -- 按源类型统计（JSON格式）
    source_type_stats TEXT DEFAULT '{}',        -- 各源类型的统计数据
    
    date_key TEXT NOT NULL,                     -- 日期键（YYYY-MM-DD格式）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, date_key)                   -- 确保每个用户每天只有一条记录
);

-- 详情提取用户配置表
CREATE TABLE detail_extraction_config (
    id TEXT PRIMARY KEY,                        -- 配置记录唯一标识
    user_id TEXT NOT NULL,                      -- 关联用户ID
    
    -- 基础功能开关
    enable_detail_extraction INTEGER DEFAULT 1, -- 启用详情提取功能
    auto_extract_details INTEGER DEFAULT 0,     -- 自动提取详情
    max_auto_extractions INTEGER DEFAULT 5,     -- 最大自动提取数量
    
    -- 提取数量控制
    extraction_batch_size INTEGER DEFAULT 3,    -- 批量提取大小
    max_download_links INTEGER DEFAULT 10,      -- 最大下载链接数
    max_magnet_links INTEGER DEFAULT 10,        -- 最大磁力链接数
    max_screenshots INTEGER DEFAULT 10,         -- 最大截图数
    
    -- 时间控制
    extraction_timeout INTEGER DEFAULT 15000,   -- 提取超时时间（毫秒）
    cache_duration INTEGER DEFAULT 86400000,    -- 缓存持续时间（毫秒）
    
    -- 重试控制
    enable_retry INTEGER DEFAULT 1,             -- 启用重试机制
    max_retry_attempts INTEGER DEFAULT 2,       -- 最大重试次数
    
    -- 缓存控制
    enable_cache INTEGER DEFAULT 1,             -- 启用缓存
    enable_local_cache INTEGER DEFAULT 1,       -- 启用本地缓存
    
    -- 显示控制
    show_screenshots INTEGER DEFAULT 1,         -- 显示截图
    show_download_links INTEGER DEFAULT 1,      -- 显示下载链接
    show_magnet_links INTEGER DEFAULT 1,        -- 显示磁力链接
    show_actress_info INTEGER DEFAULT 1,        -- 显示演员信息
    show_extracted_tags INTEGER DEFAULT 1,      -- 显示提取的标签
    show_rating INTEGER DEFAULT 1,              -- 显示评分
    show_description INTEGER DEFAULT 1,         -- 显示描述
    
    -- 界面控制
    compact_mode INTEGER DEFAULT 0,             -- 紧凑模式
    enable_image_preview INTEGER DEFAULT 1,     -- 启用图片预览
    show_extraction_progress INTEGER DEFAULT 1, -- 显示提取进度
    enable_progress_notifications INTEGER DEFAULT 1, -- 启用进度通知
    
    -- 内容过滤
    enable_content_filter INTEGER DEFAULT 0,    -- 启用内容过滤
    content_filter_keywords TEXT DEFAULT '[]',  -- 过滤关键词列表（JSON数组）
    
    -- 高级选项
    enable_strict_domain_check INTEGER DEFAULT 1,    -- 启用严格域名检查
    enable_spam_filter INTEGER DEFAULT 1,            -- 启用垃圾内容过滤
    prefer_original_sources INTEGER DEFAULT 1,       -- 优先使用原始源
    enable_auto_code_extraction INTEGER DEFAULT 1,   -- 启用自动代码提取
    
    -- 性能优化
    enable_concurrent_extraction INTEGER DEFAULT 1,  -- 启用并发提取
    max_concurrent_extractions INTEGER DEFAULT 3,    -- 最大并发提取数
    enable_smart_batching INTEGER DEFAULT 1,         -- 启用智能批处理
    
    -- 数据质量
    require_minimum_data INTEGER DEFAULT 1,          -- 要求最少数据量
    skip_low_quality_results INTEGER DEFAULT 0,      -- 跳过低质量结果
    validate_image_urls INTEGER DEFAULT 1,           -- 验证图片URL
    validate_download_links INTEGER DEFAULT 1,       -- 验证下载链接
    
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id)
);

-- 配置预设表
CREATE TABLE IF NOT EXISTS detail_config_presets (
    id TEXT PRIMARY KEY,                        -- 预设唯一标识
    name TEXT NOT NULL,                         -- 预设名称
    description TEXT,                           -- 预设描述
    config_data TEXT NOT NULL,                  -- 配置数据（JSON格式）
    is_system_preset INTEGER DEFAULT 0,         -- 是否为系统预设（1:系统 0:用户）
    is_public INTEGER DEFAULT 0,                -- 是否公开（1:公开 0:私有）
    created_by TEXT,                            -- 创建者用户ID
    usage_count INTEGER DEFAULT 0,              -- 使用次数统计
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- 解析规则缓存表（可选，用于缓存动态解析规则）
CREATE TABLE IF NOT EXISTS parser_rules_cache (
    id TEXT PRIMARY KEY,                        -- 规则缓存唯一标识
    source_type TEXT NOT NULL,                  -- 搜索源类型
    rules_data TEXT NOT NULL,                   -- 解析规则数据（JSON格式）
    rules_version TEXT DEFAULT '1.0',           -- 规则版本
    is_active INTEGER DEFAULT 1,                -- 是否激活（1:激活 0:禁用）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL,                -- 更新时间戳
    UNIQUE(source_type, is_active)              -- 确保每个源类型只有一条活跃规则
);

-- ===============================================
-- 5. 系统配置和分析模块
-- ===============================================

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,                       -- 配置键名
    value TEXT NOT NULL,                        -- 配置值
    description TEXT,                           -- 配置描述
    config_type TEXT DEFAULT 'string',          -- 配置类型（string/integer/boolean/json/float）
    is_public INTEGER DEFAULT 0,                -- 是否公开（1:公开 0:私有）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL                 -- 更新时间戳
);

-- 用户行为分析事件表
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,                        -- 事件唯一标识
    user_id TEXT,                               -- 关联用户ID（可为空，记录匿名事件）
    session_id TEXT,                            -- 会话ID
    event_type TEXT NOT NULL,                   -- 事件类型
    event_data TEXT DEFAULT '{}',               -- 事件数据（JSON格式）
    ip_address TEXT,                            -- 用户IP地址
    user_agent TEXT,                            -- 用户代理信息
    referer TEXT,                               -- 来源页面
    created_at INTEGER NOT NULL,                -- 事件发生时间戳
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- ===============================================
-- 6. 数据库索引定义
-- ===============================================

-- 用户管理模块索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_created ON user_favorites(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_keyword ON user_favorites(keyword);
CREATE INDEX IF NOT EXISTS idx_favorites_user_url ON user_favorites(user_id, url);
CREATE INDEX IF NOT EXISTS idx_history_user_created ON user_search_history(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_history_query ON user_search_history(query);
CREATE INDEX IF NOT EXISTS idx_history_source ON user_search_history(source);
CREATE INDEX IF NOT EXISTS idx_history_user_keyword ON user_search_history(user_id, query);
CREATE INDEX IF NOT EXISTS idx_actions_user_created ON user_actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_actions_action ON user_actions(action);

-- 搜索引擎核心模块索引
CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_cache_source_keyword ON source_status_cache(source_id, keyword_hash);
CREATE INDEX IF NOT EXISTS idx_status_cache_expires ON source_status_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_health_stats_source ON source_health_stats(source_id);
CREATE INDEX IF NOT EXISTS idx_check_jobs_user_status ON status_check_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_check_jobs_expires ON status_check_jobs(expires_at);

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

-- 详情提取功能模块索引
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
CREATE INDEX IF NOT EXISTS idx_detail_config_user ON detail_extraction_config(user_id);
CREATE INDEX IF NOT EXISTS idx_detail_config_updated ON detail_extraction_config(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_config_presets_system ON detail_config_presets(is_system_preset);
CREATE INDEX IF NOT EXISTS idx_config_presets_public ON detail_config_presets(is_public);
CREATE INDEX IF NOT EXISTS idx_config_presets_usage ON detail_config_presets(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_config_presets_created ON detail_config_presets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_parser_rules_source_active ON parser_rules_cache(source_type, is_active);

-- 系统配置和分析模块索引
CREATE INDEX IF NOT EXISTS idx_config_public ON system_config(is_public);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

-- ===============================================
-- 7. 数据库触发器定义
-- ===============================================

-- 用户管理模块触发器
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

-- 搜索引擎核心模块触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
        DELETE FROM status_check_jobs WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

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

CREATE TRIGGER IF NOT EXISTS update_tag_usage_count
    AFTER INSERT ON community_shared_sources
    FOR EACH ROW
    WHEN json_valid(NEW.tags)
    BEGIN
        -- 这个触发器需要通过应用层处理，因为SQLite的JSON处理有限
        -- 在应用层中手动更新标签使用统计
        NULL;
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

-- 详情提取功能模块触发器
CREATE TRIGGER IF NOT EXISTS update_detail_cache_timestamp 
    AFTER UPDATE ON detail_cache
    FOR EACH ROW
    BEGIN
        UPDATE detail_cache SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_detail_config_timestamp 
    AFTER UPDATE ON detail_extraction_config
    FOR EACH ROW
    BEGIN
        UPDATE detail_extraction_config SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS cleanup_expired_detail_cache
    AFTER INSERT ON detail_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM detail_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

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
            CASE 
                WHEN (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1) > 0
                THEN (COALESCE((SELECT total_extraction_time FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + NEW.extraction_time) / 
                     (COALESCE((SELECT total_extractions FROM detail_extraction_stats WHERE user_id = NEW.user_id AND date_key = date('now')), 0) + 1)
                ELSE 0
            END,
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

-- ===============================================
-- 8. 系统初始化数据
-- ===============================================

-- 系统配置初始化
INSERT OR IGNORE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) VALUES
-- 基础配置
('site_name', '磁力快搜', '网站名称', 'string', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('enable_registration', '1', '是否开放注册', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 用户限制配置
('max_search_history', '1000', '最大搜索历史记录数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_favorites', '1000', '最大收藏数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_username_length', '3', '用户名最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_username_length', '20', '用户名最大长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('min_password_length', '6', '密码最小长度', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 搜索源检查配置
('source_check_enabled', '1', '启用搜索源状态检查', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_concurrent_checks', '3', '最大并发检查数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_check_timeout', '10000', '默认检查超时时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('cache_duration_ms', '300000', '状态缓存时间（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_cache_entries', '10000', '最大缓存条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('health_update_interval', '3600000', '健康度统计更新间隔（毫秒）', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 社区功能配置
('community_enabled', '1', '启用搜索源共享社区功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_require_approval', '0', '新分享的搜索源需要审核', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_max_shares_per_user', '50', '每个用户最大分享数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('community_min_rating_to_feature', '4.0', '推荐搜索源的最低评分', 'float', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 详情提取功能配置
('detail_extraction_enabled', '1', '启用详情提取功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_cache_size', '50000', '详情缓存最大条目数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_default_timeout', '15000', '详情提取默认超时时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_batch_size', '20', '批量详情提取最大数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_cache_duration', '86400000', '详情缓存默认持续时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_concurrent', '3', '详情提取最大并发数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_enable_image_proxy', '0', '启用图片代理服务', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_supported_sources', '["javbus","javdb","javlibrary","jable","javmost","missav","sukebei"]', '支持详情提取的搜索源', 'json', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 详情提取限制配置
('detail_max_download_links', '15', '单个详情页最大下载链接数系统限制', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_magnet_links', '15', '单个详情页最大磁力链接数系统限制', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_screenshots', '20', '单个详情页最大截图数系统限制', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_concurrent_extractions', '5', '最大并发提取数系统限制', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_batch_size', '20', '批量提取最大数量系统限制', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 详情提取时间限制
('detail_min_timeout', '5000', '提取超时最小时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_timeout', '30000', '提取超时最大时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_min_cache_duration', '3600000', '缓存最短时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_cache_duration', '604800000', '缓存最长时间(毫秒)', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 详情提取高级配置
('detail_allow_custom_config', '1', '是否允许用户自定义详情提取配置', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_enable_presets', '1', '是否启用配置预设功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_max_filter_keywords', '50', '内容过滤关键词最大数量', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_min_data_quality_score', '30', '最低数据质量分数', 'integer', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('detail_enable_quality_validation', '1', '是否启用数据质量验证', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 内部标记
('detail_config_schema_updated', '1', '详情提取配置表结构已更新', 'boolean', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 添加邮箱验证相关配置
('email_verification_enabled', '1', '是否启用邮箱验证功能', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_verification_required', '0', '注册时是否强制邮箱验证', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('verification_code_length', '6', '验证码长度', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('verification_code_expiry', '900000', '验证码过期时间（毫秒，默认15分钟）', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('max_verification_attempts', '3', '最大验证尝试次数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_rate_limit_per_hour', '5', '每小时最大发送邮件数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('email_rate_limit_per_day', '20', '每天最大发送邮件数', 'integer', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('resend_api_key_set', '0', 'Resend API密钥是否已配置', 'boolean', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_from_email', 'noreply@codeseek.pp.ua', '默认发件人邮箱', 'string', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),
('default_from_name', '磁力快搜', '默认发件人姓名', 'string', 0, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- 官方标签初始化
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

-- 系统配置预设初始化
INSERT OR REPLACE INTO detail_config_presets (
    id, name, description, config_data, is_system_preset, is_public, created_by, 
    created_at, updated_at
) VALUES 
-- 保守模式预设
('preset_conservative', '保守模式', '最小化资源使用，适合低配设备', 
 '{"enableDetailExtraction":true,"autoExtractDetails":false,"maxAutoExtractions":3,"extractionBatchSize":2,"maxDownloadLinks":5,"maxMagnetLinks":5,"maxScreenshots":5,"extractionTimeout":10000,"cacheDuration":86400000,"enableRetry":true,"maxRetryAttempts":1,"enableCache":true,"enableLocalCache":true,"showScreenshots":true,"showDownloadLinks":true,"showMagnetLinks":true,"showActressInfo":true,"showExtractedTags":false,"showRating":false,"showDescription":false,"compactMode":true,"enableImagePreview":false,"showExtractionProgress":true,"enableProgressNotifications":false,"enableContentFilter":false,"contentFilterKeywords":[],"enableStrictDomainCheck":true,"enableSpamFilter":true,"preferOriginalSources":true,"enableAutoCodeExtraction":true,"enableConcurrentExtraction":false,"maxConcurrentExtractions":1,"enableSmartBatching":false,"requireMinimumData":true,"skipLowQualityResults":false,"validateImageUrls":false,"validateDownloadLinks":false}',
 1, 1, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 平衡模式预设
('preset_balanced', '平衡模式', '性能和功能的平衡配置，适合大多数用户', 
 '{"enableDetailExtraction":true,"autoExtractDetails":false,"maxAutoExtractions":5,"extractionBatchSize":3,"maxDownloadLinks":10,"maxMagnetLinks":10,"maxScreenshots":10,"extractionTimeout":15000,"cacheDuration":86400000,"enableRetry":true,"maxRetryAttempts":2,"enableCache":true,"enableLocalCache":true,"showScreenshots":true,"showDownloadLinks":true,"showMagnetLinks":true,"showActressInfo":true,"showExtractedTags":true,"showRating":true,"showDescription":true,"compactMode":false,"enableImagePreview":true,"showExtractionProgress":true,"enableProgressNotifications":true,"enableContentFilter":false,"contentFilterKeywords":[],"enableStrictDomainCheck":true,"enableSpamFilter":true,"preferOriginalSources":true,"enableAutoCodeExtraction":true,"enableConcurrentExtraction":true,"maxConcurrentExtractions":3,"enableSmartBatching":true,"requireMinimumData":true,"skipLowQualityResults":false,"validateImageUrls":true,"validateDownloadLinks":true}',
 1, 1, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 性能模式预设  
('preset_aggressive', '性能模式', '最大化提取速度和内容，适合高配设备', 
 '{"enableDetailExtraction":true,"autoExtractDetails":true,"maxAutoExtractions":10,"extractionBatchSize":5,"maxDownloadLinks":15,"maxMagnetLinks":15,"maxScreenshots":15,"extractionTimeout":25000,"cacheDuration":172800000,"enableRetry":true,"maxRetryAttempts":3,"enableCache":true,"enableLocalCache":true,"showScreenshots":true,"showDownloadLinks":true,"showMagnetLinks":true,"showActressInfo":true,"showExtractedTags":true,"showRating":true,"showDescription":true,"compactMode":false,"enableImagePreview":true,"showExtractionProgress":true,"enableProgressNotifications":true,"enableContentFilter":false,"contentFilterKeywords":[],"enableStrictDomainCheck":false,"enableSpamFilter":true,"preferOriginalSources":false,"enableAutoCodeExtraction":true,"enableConcurrentExtraction":true,"maxConcurrentExtractions":5,"enableSmartBatching":true,"requireMinimumData":false,"skipLowQualityResults":false,"validateImageUrls":true,"validateDownloadLinks":true}',
 1, 1, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 质量优先预设
('preset_quality', '质量优先', '注重数据质量和准确性，速度较慢但结果更可靠', 
 '{"enableDetailExtraction":true,"autoExtractDetails":false,"maxAutoExtractions":3,"extractionBatchSize":2,"maxDownloadLinks":10,"maxMagnetLinks":10,"maxScreenshots":10,"extractionTimeout":20000,"cacheDuration":86400000,"enableRetry":true,"maxRetryAttempts":3,"enableCache":true,"enableLocalCache":true,"showScreenshots":true,"showDownloadLinks":true,"showMagnetLinks":true,"showActressInfo":true,"showExtractedTags":true,"showRating":true,"showDescription":true,"compactMode":false,"enableImagePreview":true,"showExtractionProgress":true,"enableProgressNotifications":true,"enableContentFilter":false,"contentFilterKeywords":[],"enableStrictDomainCheck":true,"enableSpamFilter":true,"preferOriginalSources":true,"enableAutoCodeExtraction":true,"enableConcurrentExtraction":false,"maxConcurrentExtractions":1,"enableSmartBatching":false,"requireMinimumData":true,"skipLowQualityResults":true,"validateImageUrls":true,"validateDownloadLinks":true}',
 1, 1, NULL, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

-- ===============================================
-- 邮箱验证功能数据库扩展
-- ===============================================

-- 2. 邮箱验证码表
CREATE TABLE IF NOT EXISTS email_verifications (
    id TEXT PRIMARY KEY,                        -- 验证记录唯一标识
    user_id TEXT,                               -- 关联用户ID（注册验证时可为空）
    email TEXT NOT NULL,                        -- 要验证的邮箱地址
    email_hash TEXT NOT NULL,                   -- 邮箱哈希值（用于索引）
    verification_code TEXT NOT NULL,            -- 6位数字验证码
    code_hash TEXT NOT NULL,                    -- 验证码哈希值
    
    -- 验证类型和状态
    verification_type TEXT NOT NULL,            -- 验证类型：registration/email_change/password_reset/account_delete
    status TEXT DEFAULT 'pending',              -- 状态：pending/used/expired/failed
    
    -- 安全相关
    ip_address TEXT,                            -- 申请验证的IP地址
    user_agent TEXT,                            -- 用户代理信息
    attempt_count INTEGER DEFAULT 0,            -- 验证尝试次数
    max_attempts INTEGER DEFAULT 3,             -- 最大尝试次数
    
    -- 时间管理
    expires_at INTEGER NOT NULL,                -- 验证码过期时间（通常5-15分钟）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    used_at INTEGER,                            -- 使用时间戳
    last_attempt_at INTEGER,                    -- 最后尝试时间
    
    -- 附加数据
    metadata TEXT DEFAULT '{}',                 -- 附加信息（JSON格式）
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 3. 邮箱更改临时表
CREATE TABLE IF NOT EXISTS email_change_requests (
    id TEXT PRIMARY KEY,                        -- 请求唯一标识
    user_id TEXT NOT NULL,                      -- 用户ID
    old_email TEXT NOT NULL,                    -- 原邮箱地址
    new_email TEXT NOT NULL,                    -- 新邮箱地址
    new_email_hash TEXT NOT NULL,               -- 新邮箱哈希
    
    -- 验证状态
    old_email_verified INTEGER DEFAULT 0,      -- 原邮箱是否已验证
    new_email_verified INTEGER DEFAULT 0,      -- 新邮箱是否已验证
    status TEXT DEFAULT 'pending',              -- pending/completed/expired/cancelled
    
    -- 验证码关联
    old_email_verification_id TEXT,             -- 原邮箱验证记录ID
    new_email_verification_id TEXT,             -- 新邮箱验证记录ID
    
    -- 时间管理
    expires_at INTEGER NOT NULL,                -- 整个请求过期时间（通常30分钟）
    created_at INTEGER NOT NULL,                -- 创建时间
    completed_at INTEGER,                       -- 完成时间
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (old_email_verification_id) REFERENCES email_verifications (id) ON DELETE SET NULL,
    FOREIGN KEY (new_email_verification_id) REFERENCES email_verifications (id) ON DELETE SET NULL
);

-- 4. 邮件发送日志表
CREATE TABLE IF NOT EXISTS email_send_logs (
    id TEXT PRIMARY KEY,                        -- 发送记录唯一标识
    user_id TEXT,                               -- 关联用户ID
    recipient_email TEXT NOT NULL,              -- 收件人邮箱
    email_type TEXT NOT NULL,                   -- 邮件类型：verification/password_reset/email_change/account_delete
    
    -- 发送状态
    send_status TEXT NOT NULL,                  -- 发送状态：pending/sent/failed/delivered/bounced
    provider TEXT DEFAULT 'resend',             -- 邮件服务商
    provider_message_id TEXT,                   -- 服务商消息ID
    
    -- 发送详情
    template_name TEXT,                         -- 使用的模板名称
    subject TEXT,                               -- 邮件主题
    send_error TEXT,                            -- 发送错误信息
    
    -- 限流和安全
    ip_address TEXT,                            -- 发送请求的IP
    rate_limit_key TEXT,                        -- 限流键
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间
    sent_at INTEGER,                            -- 发送时间
    delivered_at INTEGER,                       -- 投递时间
    
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- 5. 邮件模板表（可选）
CREATE TABLE IF NOT EXISTS email_templates (
    id TEXT PRIMARY KEY,                        -- 模板唯一标识
    template_name TEXT UNIQUE NOT NULL,         -- 模板名称
    template_type TEXT NOT NULL,                -- 模板类型
    
    -- 模板内容
    subject_template TEXT NOT NULL,             -- 主题模板
    html_template TEXT NOT NULL,                -- HTML模板
    text_template TEXT,                         -- 纯文本模板
    
    -- 模板变量
    required_variables TEXT DEFAULT '[]',       -- 必需变量（JSON数组）
    optional_variables TEXT DEFAULT '[]',       -- 可选变量（JSON数组）
    
    -- 状态和版本
    is_active INTEGER DEFAULT 1,                -- 是否激活
    version INTEGER DEFAULT 1,                  -- 模板版本
    
    -- 时间戳
    created_at INTEGER NOT NULL,                -- 创建时间
    updated_at INTEGER NOT NULL,                -- 更新时间
    
    -- 使用统计
    usage_count INTEGER DEFAULT 0               -- 使用次数
);

-- ===============================================
-- 索引定义
-- ===============================================

-- 邮箱验证索引
CREATE INDEX IF NOT EXISTS idx_email_verifications_email_hash ON email_verifications(email_hash);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_type ON email_verifications(user_id, verification_type);
CREATE INDEX IF NOT EXISTS idx_email_verifications_status ON email_verifications(status);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verifications_created ON email_verifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_verifications_code_hash ON email_verifications(code_hash);

-- 邮箱更改请求索引
CREATE INDEX IF NOT EXISTS idx_email_change_user_status ON email_change_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_email_change_new_email ON email_change_requests(new_email_hash);
CREATE INDEX IF NOT EXISTS idx_email_change_expires ON email_change_requests(expires_at);

-- 邮件发送日志索引  
CREATE INDEX IF NOT EXISTS idx_email_logs_user_created ON email_send_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_type ON email_send_logs(recipient_email, email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_send_logs(send_status);
CREATE INDEX IF NOT EXISTS idx_email_logs_rate_limit ON email_send_logs(rate_limit_key, created_at);

-- 邮件模板索引
CREATE INDEX IF NOT EXISTS idx_email_templates_name ON email_templates(template_name);
CREATE INDEX IF NOT EXISTS idx_email_templates_type_active ON email_templates(template_type, is_active);

-- ===============================================
-- 触发器定义
-- ===============================================

-- 自动清理过期验证码
CREATE TRIGGER IF NOT EXISTS cleanup_expired_verifications
    AFTER INSERT ON email_verifications
    FOR EACH ROW
    BEGIN
        DELETE FROM email_verifications 
        WHERE expires_at < strftime('%s', 'now') * 1000 
        AND status = 'pending';
    END;

-- 自动清理过期邮箱更改请求
CREATE TRIGGER IF NOT EXISTS cleanup_expired_email_changes
    AFTER INSERT ON email_change_requests
    FOR EACH ROW
    BEGIN
        DELETE FROM email_change_requests 
        WHERE expires_at < strftime('%s', 'now') * 1000 
        AND status = 'pending';
    END;

-- 更新邮件模板时间戳
CREATE TRIGGER IF NOT EXISTS update_email_template_timestamp
    AFTER UPDATE ON email_templates
    FOR EACH ROW
    BEGIN
        UPDATE email_templates SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;

-- ===============================================
-- 初始化数据
-- ===============================================

-- 插入默认邮件模板
INSERT OR IGNORE INTO email_templates (
    id, template_name, template_type, subject_template, html_template, text_template,
    required_variables, created_at, updated_at
) VALUES 
-- 注册验证模板
('tpl_register_verify', 'registration_verification', 'verification',
 '验证您的{{siteName}}账户', 
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>验证邮箱</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证您的邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">感谢您注册{{siteName}}！请使用以下验证码完成邮箱验证：</p><div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有注册此账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '验证您的{{siteName}}账户\n\n您好 {{username}}，\n\n感谢您注册{{siteName}}！您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有注册此账户，请忽略此邮件。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 密码重置模板  
('tpl_password_reset', 'password_reset', 'verification',
 '重置您的{{siteName}}密码',
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>密码重置</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #ff7b7b 0%, #d63031 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">密码重置请求</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了您的密码重置请求。请使用以下验证码继续重置密码：</p><div style="background: #f8f9fa; border: 2px dashed #d63031; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #d63031; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有申请密码重置，请立即联系我们的客服团队。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '重置您的{{siteName}}密码\n\n您好 {{username}}，\n\n我们收到了您的密码重置请求。您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有申请密码重置，请立即联系客服。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 邮箱更改模板
('tpl_email_change', 'email_change', 'verification',
 '验证您的新邮箱地址',
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>邮箱验证</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #00b894 0%, #00a085 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">验证新邮箱</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">您申请将账户邮箱从 <strong>{{oldEmail}}</strong> 更改为 <strong>{{newEmail}}</strong>。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">请使用以下验证码验证您的新邮箱地址：</p><div style="background: #f8f9fa; border: 2px dashed #00b894; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #00b894; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您没有申请更改邮箱，请立即联系我们。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '验证您的新邮箱地址\n\n您好 {{username}}，\n\n您申请将账户邮箱从 {{oldEmail}} 更改为 {{newEmail}}。\n\n您的验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n如果您没有申请更改邮箱，请立即联系我们。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes", "oldEmail", "newEmail"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000),

-- 账户删除模板
('tpl_account_delete', 'account_delete', 'verification',  
 '确认删除您的{{siteName}}账户',
 '<!DOCTYPE html><html><head><meta charset="utf-8"><title>账户删除确认</title></head><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><div style="background: linear-gradient(135deg, #e84393 0%, #d63031 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;"><h1 style="margin: 0; font-size: 28px;">账户删除确认</h1></div><div style="background: white; padding: 40px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;"><p style="font-size: 16px; line-height: 1.6; color: #333;">您好 <strong>{{username}}</strong>，</p><p style="font-size: 16px; line-height: 1.6; color: #333;">我们收到了删除您账户的申请。这将<strong>永久删除</strong>您的所有数据，包括收藏、历史记录等。</p><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您确认要删除账户，请使用以下验证码：</p><div style="background: #f8f9fa; border: 2px dashed #e84393; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;"><span style="font-size: 32px; font-weight: bold; color: #e84393; letter-spacing: 5px; font-family: monospace;">{{verificationCode}}</span></div><p style="font-size: 14px; color: #666; text-align: center;">验证码将在 <strong>{{expiryMinutes}} 分钟</strong> 后过期</p><div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;"><p style="font-size: 14px; color: #856404; margin: 0;"><strong>⚠️ 重要提醒：</strong>账户删除后无法恢复，请谨慎操作！</p></div><p style="font-size: 16px; line-height: 1.6; color: #333;">如果您不想删除账户，请忽略此邮件。</p><hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;"><p style="font-size: 12px; color: #999; text-align: center;">此邮件由系统自动发送，请勿回复。<br>{{siteName}} - 让搜索更简单</p></div></body></html>',
 '确认删除您的{{siteName}}账户\n\n您好 {{username}}，\n\n我们收到了删除您账户的申请。这将永久删除您的所有数据。\n\n如果您确认要删除账户，验证码是：{{verificationCode}}\n\n此验证码将在 {{expiryMinutes}} 分钟后过期。\n\n⚠️ 重要提醒：账户删除后无法恢复，请谨慎操作！\n\n如果您不想删除账户，请忽略此邮件。\n\n{{siteName}}',
 '["username", "siteName", "verificationCode", "expiryMinutes"]',
 strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);
