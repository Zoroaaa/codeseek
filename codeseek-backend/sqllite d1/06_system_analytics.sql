-- ===============================================
-- 系统配置和分析模块数据库结构
-- 版本: 精简优化版本
-- 说明: 包含系统配置管理、用户行为分析等功能
-- ===============================================

-- ===============================================
-- 1. 系统配置管理
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

-- ===============================================
-- 2. 用户行为分析
-- ===============================================

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
-- 3. 索引定义
-- ===============================================

-- 系统配置和分析模块索引
CREATE INDEX IF NOT EXISTS idx_config_public ON system_config(is_public);
CREATE INDEX IF NOT EXISTS idx_analytics_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);