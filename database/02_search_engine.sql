-- ===============================================
-- 搜索引擎核心模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含搜索缓存、搜索源状态检查等功能
-- ===============================================

-- ===============================================
-- 1. 搜索结果缓存管理
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

-- ===============================================
-- 2. 索引定义
-- ===============================================

-- 搜索引擎核心模块索引
CREATE INDEX IF NOT EXISTS idx_cache_keyword_hash ON search_cache(keyword_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_status_cache_source_keyword ON source_status_cache(source_id, keyword_hash);
CREATE INDEX IF NOT EXISTS idx_status_cache_expires ON source_status_cache(expires_at);

-- ===============================================
-- 3. 触发器定义
-- ===============================================

-- 搜索引擎核心模块触发器
CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;