-- ===============================================
-- 详情提取功能模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含详情内容缓存、提取历史、用户配置、性能统计等功能
-- ===============================================

-- ===============================================
-- 1. 详情内容缓存
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

-- ===============================================
-- 2. 用户配置管理
-- ===============================================

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

-- ===============================================
-- 3. 统计分析功能
-- ===============================================

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
-- 4. 索引定义
-- ===============================================

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

-- ===============================================
-- 5. 触发器定义
-- ===============================================

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