-- ===============================================
-- 搜索引擎核心模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含搜索缓存、搜索源状态检查、健康度统计等功能
-- ===============================================

-- ===============================================
-- 1. 搜索结果缓存管理
-- ===============================================

-- 搜索结果缓存表
CREATE TABLE IF NOT EXISTS search_cache (       --TODO: 后端服务暂未实现，未来实现
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
CREATE TABLE IF NOT EXISTS status_check_jobs (  --TODO: 后端服务暂未实现，未来实现
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
-- 2. 索引定义
-- ===============================================

-- 搜索引擎核心模块索引
CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_cache_source_keyword ON source_status_cache(source_id, keyword_hash);
CREATE INDEX IF NOT EXISTS idx_status_cache_expires ON source_status_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_health_stats_source ON source_health_stats(source_id);
CREATE INDEX IF NOT EXISTS idx_check_jobs_user_status ON status_check_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_check_jobs_expires ON status_check_jobs(expires_at);

-- ===============================================
-- 3. 触发器定义
-- ===============================================

-- 搜索引擎核心模块触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
        DELETE FROM status_check_jobs WHERE expires_at < strftime('%s', 'now') * 1000;
    END;