-- database/migrations/004_proxy_functionality.sql
-- 代理功能相关数据库表结构

-- 创建代理访问日志表
CREATE TABLE IF NOT EXISTS proxy_access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    target_url TEXT NOT NULL,
    proxy_url TEXT NOT NULL,
    source_domain TEXT NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    response_status INTEGER,
    response_time INTEGER,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_proxy_logs_user_id ON proxy_access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proxy_logs_created_at ON proxy_access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_proxy_logs_source_domain ON proxy_access_logs(source_domain);
CREATE INDEX IF NOT EXISTS idx_proxy_logs_target_url ON proxy_access_logs(target_url);

-- 创建代理统计表（用于快速统计查询）
CREATE TABLE IF NOT EXISTS proxy_statistics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date_key DATE NOT NULL, -- YYYY-MM-DD 格式
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    unique_domains INTEGER DEFAULT 0,
    total_response_time INTEGER DEFAULT 0,
    avg_response_time REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 唯一约束，确保每个用户每天只有一条记录
    UNIQUE(user_id, date_key)
);

-- 创建代理统计表索引
CREATE INDEX IF NOT EXISTS idx_proxy_stats_user_id ON proxy_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_proxy_stats_date ON proxy_statistics(date_key);

-- 创建代理配置表（用于存储用户的代理设置）
CREATE TABLE IF NOT EXISTS user_proxy_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    proxy_enabled BOOLEAN DEFAULT 1,
    show_proxy_indicator BOOLEAN DEFAULT 1,
    fallback_to_original BOOLEAN DEFAULT 1,
    auto_retry_on_failure BOOLEAN DEFAULT 1,
    preferred_proxy_server TEXT,
    custom_headers JSON,
    blocked_domains TEXT, -- 逗号分隔的域名列表
    allowed_domains TEXT, -- 逗号分隔的域名列表
    max_retries INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- 唯一约束，确保每个用户只有一个配置
    UNIQUE(user_id)
);

-- 创建代理健康检查日志表
CREATE TABLE IF NOT EXISTS proxy_health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_server TEXT NOT NULL,
    target_domain TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'unhealthy', 'timeout', 'error'
    response_time INTEGER,
    status_code INTEGER,
    error_message TEXT,
    check_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建健康检查索引
CREATE INDEX IF NOT EXISTS idx_proxy_health_server ON proxy_health_checks(proxy_server);
CREATE INDEX IF NOT EXISTS idx_proxy_health_timestamp ON proxy_health_checks(check_timestamp);
CREATE INDEX IF NOT EXISTS idx_proxy_health_domain ON proxy_health_checks(target_domain);

-- 创建代理域名白名单表
CREATE TABLE IF NOT EXISTS proxy_allowed_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT, -- 'search', 'browse', 'torrent', etc.
    is_active BOOLEAN DEFAULT 1,
    added_by INTEGER, -- 管理员用户ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 外键约束
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建域名白名单索引
CREATE INDEX IF NOT EXISTS idx_proxy_domains_active ON proxy_allowed_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_proxy_domains_category ON proxy_allowed_domains(category);

-- 插入默认允许的域名
INSERT OR IGNORE INTO proxy_allowed_domains (domain, description, category) VALUES
    ('javbus.com', 'JavBus - 番号资料站', 'search'),
    ('www.javbus.com', 'JavBus - 番号资料站 (www)', 'search'),
    ('javdb.com', 'JavDB - 番号数据库', 'search'),
    ('www.javdb.com', 'JavDB - 番号数据库 (www)', 'search'),
    ('jable.tv', 'Jable - 在线播放', 'browse'),
    ('www.jable.tv', 'Jable - 在线播放 (www)', 'browse'),
    ('javmost.com', 'JavMost - 番号搜索', 'search'),
    ('www.javmost.com', 'JavMost - 番号搜索 (www)', 'search'),
    ('javgg.net', 'JavGG - 番号资源', 'search'),
    ('www.javgg.net', 'JavGG - 番号资源 (www)', 'search'),
    ('sukebei.nyaa.si', 'Sukebei - 种子搜索', 'torrent'),
    ('jav.guru', 'JAV Guru - 番号指南', 'search'),
    ('www.jav.guru', 'JAV Guru - 番号指南 (www)', 'search'),
    ('javlibrary.com', 'JAV Library - 番号图书馆', 'search'),
    ('www.javlibrary.com', 'JAV Library - 番号图书馆 (www)', 'search'),
    ('btsow.com', 'BTSOW - 磁力搜索', 'torrent'),
    ('www.btsow.com', 'BTSOW - 磁力搜索 (www)', 'torrent');

-- 创建代理错误日志表（用于调试和监控）
CREATE TABLE IF NOT EXISTS proxy_error_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    target_url TEXT NOT NULL,
    error_type TEXT NOT NULL, -- 'timeout', 'connection_failed', 'blocked', 'invalid_domain'
    error_message TEXT,
    user_agent TEXT,
    ip_address TEXT,
    retry_count INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME,
    
    -- 外键约束
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建错误日志索引
CREATE INDEX IF NOT EXISTS idx_proxy_errors_user_id ON proxy_error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_proxy_errors_type ON proxy_error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_proxy_errors_resolved ON proxy_error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_proxy_errors_created_at ON proxy_error_logs(created_at);

-- 创建视图以便于统计查询
CREATE VIEW IF NOT EXISTS proxy_daily_stats AS
SELECT 
    user_id,
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1 END) as successful_requests,
    COUNT(CASE WHEN response_status >= 400 OR response_status IS NULL THEN 1 END) as failed_requests,
    COUNT(DISTINCT source_domain) as unique_domains,
    AVG(response_time) as avg_response_time,
    MIN(response_time) as min_response_time,
    MAX(response_time) as max_response_time
FROM proxy_access_logs
GROUP BY user_id, DATE(created_at);

-- 创建用于获取用户代理使用统计的视图
CREATE VIEW IF NOT EXISTS user_proxy_usage AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(pal.id) as total_proxy_requests,
    COUNT(DISTINCT pal.source_domain) as unique_domains_accessed,
    AVG(pal.response_time) as avg_response_time,
    MIN(pal.created_at) as first_proxy_use,
    MAX(pal.created_at) as last_proxy_use,
    COUNT(CASE WHEN pal.response_status BETWEEN 200 AND 299 THEN 1 END) as successful_requests,
    ROUND(
        (COUNT(CASE WHEN pal.response_status BETWEEN 200 AND 299 THEN 1 END) * 100.0 / COUNT(pal.id)), 2
    ) as success_rate
FROM users u
LEFT JOIN proxy_access_logs pal ON u.id = pal.user_id
GROUP BY u.id, u.username;

-- 创建触发器以自动更新代理统计
CREATE TRIGGER IF NOT EXISTS update_proxy_statistics
AFTER INSERT ON proxy_access_logs
BEGIN
    INSERT OR REPLACE INTO proxy_statistics (
        user_id, 
        date_key, 
        total_requests, 
        successful_requests, 
        failed_requests,
        updated_at
    )
    SELECT 
        NEW.user_id,
        DATE(NEW.created_at),
        COUNT(*),
        COUNT(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1 END),
        COUNT(CASE WHEN response_status >= 400 OR response_status IS NULL THEN 1 END),
        CURRENT_TIMESTAMP
    FROM proxy_access_logs 
    WHERE user_id = NEW.user_id 
      AND DATE(created_at) = DATE(NEW.created_at);
END;

-- 添加代理相关的用户操作记录类型
INSERT OR IGNORE INTO action_types (action_name, description) VALUES
    ('proxy_access', '代理访问'),
    ('proxy_error', '代理错误'),
    ('proxy_config_change', '代理配置修改'),
    ('proxy_health_check', '代理健康检查');

-- 为现有用户创建默认代理配置
INSERT OR IGNORE INTO user_proxy_configs (user_id)
SELECT id FROM users WHERE id NOT IN (SELECT user_id FROM user_proxy_configs);

-- 创建代理缓存表（可选，用于缓存代理响应）
CREATE TABLE IF NOT EXISTS proxy_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_hash TEXT NOT NULL UNIQUE, -- URL的哈希值
    original_url TEXT NOT NULL,
    cached_content BLOB,
    content_type TEXT,
    cache_headers TEXT, -- JSON格式的响应头
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1
);

-- 创建代理缓存索引
CREATE INDEX IF NOT EXISTS idx_proxy_cache_url_hash ON proxy_cache(url_hash);
CREATE INDEX IF NOT EXISTS idx_proxy_cache_expires_at ON proxy_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_proxy_cache_last_accessed ON proxy_cache(last_accessed);

-- 创建定时清理过期缓存的触发器（可选）
CREATE TRIGGER IF NOT EXISTS cleanup_expired_proxy_cache
AFTER INSERT ON proxy_cache
BEGIN
    DELETE FROM proxy_cache 
    WHERE expires_at < datetime('now', '-1 day')
      AND last_accessed < datetime('now', '-7 days');
END;

-- 添加系统配置表的代理相关配置
INSERT OR REPLACE INTO system_configs (config_key, config_value, description, config_type) VALUES
    ('proxy_enabled', 'true', '是否启用代理功能', 'boolean'),
    ('proxy_max_concurrent', '10', '最大并发代理请求数', 'integer'),
    ('proxy_timeout', '30000', '代理请求超时时间(毫秒)', 'integer'),
    ('proxy_cache_enabled', 'true', '是否启用代理缓存', 'boolean'),
    ('proxy_cache_duration', '300', '代理缓存持续时间(秒)', 'integer'),
    ('proxy_rate_limit', '100', '每用户每小时最大代理请求数', 'integer'),
    ('proxy_health_check_interval', '300', '代理健康检查间隔(秒)', 'integer'),
    ('proxy_allowed_domains_auto_update', 'true', '是否自动更新允许的域名列表', 'boolean');

-- 创建代理性能监控表
CREATE TABLE IF NOT EXISTS proxy_performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT, -- 'ms', 'count', 'percentage', etc.
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    additional_data JSON -- 额外的元数据
);

-- 创建性能监控索引
CREATE INDEX IF NOT EXISTS idx_proxy_metrics_name ON proxy_performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_proxy_metrics_recorded_at ON proxy_performance_metrics(recorded_at);

-- 插入初始性能指标
INSERT OR IGNORE INTO proxy_performance_metrics (metric_name, metric_value, metric_unit) VALUES
    ('average_response_time', 0.0, 'ms'),
    ('success_rate', 100.0, 'percentage'),
    ('total_requests', 0, 'count'),
    ('active_connections', 0, 'count');

PRAGMA foreign_keys = ON;