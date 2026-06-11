-- =============================================
-- 迁移脚本: 清除 requires_keyword + 合并大类
-- 版本: 2026-06-11 (v2 兼容所有SQLite版本)
-- 用法: 在已有数据库上执行，不丢数据
-- 兼容: 所有SQLite版本（不依赖 DROP COLUMN）
-- =============================================

BEGIN TRANSACTION;

-- =============================================
-- 第1步: 删除触发器（改表结构前必须先删）
-- =============================================

DROP TRIGGER IF EXISTS update_major_categories_timestamp;
DROP TRIGGER IF EXISTS update_source_categories_timestamp;
DROP TRIGGER IF EXISTS update_search_sources_timestamp;
DROP TRIGGER IF EXISTS update_user_source_configs_timestamp;
DROP TRIGGER IF EXISTS cleanup_expired_status_cache;
DROP TRIGGER IF EXISTS cascade_delete_category_sources;
DROP TRIGGER IF EXISTS update_source_usage_stats;
DROP TRIGGER IF EXISTS create_default_user_source_configs;

-- =============================================
-- 第2步: 大类表 - 删除 requires_keyword 列（重建表法）
-- =============================================

-- 2a. 创建新表(无 requires_keyword 列)
CREATE TABLE IF NOT EXISTS search_major_categories_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '🌟',
    color TEXT DEFAULT '#6b7280',
    display_order INTEGER DEFAULT 999,
    is_system INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2b. 迁移数据(跳过 requires_keyword 列)
INSERT INTO search_major_categories_new
    SELECT id, name, description, icon, color, display_order, is_system, is_active, created_at, updated_at
    FROM search_major_categories;

-- 2c. 替换旧表
DROP TABLE search_major_categories;
ALTER TABLE search_major_categories_new RENAME TO search_major_categories;

-- =============================================
-- 第3步: 源表 - 删除 requires_keyword 列（重建表法）
-- =============================================

-- 3a. 创建新表(无 requires_keyword 列)
CREATE TABLE IF NOT EXISTS search_sources_new (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    icon TEXT DEFAULT '🔍',
    url_template TEXT NOT NULL,
    homepage_url TEXT,
    site_type TEXT DEFAULT 'search',
    searchable INTEGER DEFAULT 1,
    search_priority INTEGER DEFAULT 5,
    is_system INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    display_order INTEGER DEFAULT 999,
    usage_count INTEGER DEFAULT 0,
    last_used_at INTEGER,
    created_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (category_id) REFERENCES search_source_categories (id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);

-- 3b. 迁移数据(跳过 requires_keyword 列)
INSERT INTO search_sources_new
    SELECT id, category_id, name, subtitle, description, icon, url_template, homepage_url,
           site_type, searchable, search_priority, is_system, is_active, display_order,
           usage_count, last_used_at, created_by, created_at, updated_at
    FROM search_sources;

-- 3c. 替换旧表
DROP TABLE search_sources;
ALTER TABLE search_sources_new RENAME TO search_sources;

-- =============================================
-- 第4步: 数据迁移 - 合并 search_sources + browse_sites → jav_sources
-- =============================================

-- 4a. 将 browse_sites/search_sites 下所有分类归入 jav_sources
UPDATE search_source_categories
SET major_category_id = 'jav_sources',
    updated_at = strftime('%s', 'now') * 1000
WHERE major_category_id IN ('browse_sites', 'search_sources');

-- 4b. 删除旧大类记录
DELETE FROM search_major_categories WHERE id = 'browse_sites';
DELETE FROM search_major_categories WHERE id = 'search_sources';

-- 4c. 确保 jav_sources 大类存在
INSERT OR IGNORE INTO search_major_categories (
    id, name, description, icon, color,
    display_order, is_system, is_active, created_at, updated_at
) VALUES (
    'jav_sources', '🔍 JAV搜索', 'JAV番号、在线播放、磁力资源等', '🔍', '#3b82f6',
    1, 1, 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000
);

-- =============================================
-- 第5步: 重建索引（重建表后索引丢失，需重新创建）
-- =============================================

CREATE INDEX IF NOT EXISTS idx_search_sources_category ON search_sources(category_id);
CREATE INDEX IF NOT EXISTS idx_search_sources_active ON search_sources(is_active);
CREATE INDEX IF NOT EXISTS idx_search_sources_searchable ON search_sources(searchable);
CREATE INDEX IF NOT EXISTS idx_search_sources_site_type ON search_sources(site_type);
CREATE INDEX IF NOT EXISTS idx_search_sources_priority ON search_sources(search_priority);
CREATE INDEX IF NOT EXISTS idx_search_sources_usage ON search_sources(usage_count);
CREATE INDEX IF NOT EXISTS idx_search_sources_order ON search_sources(display_order);

-- =============================================
-- 第6步: 重新创建触发器
-- =============================================

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

CREATE TRIGGER IF NOT EXISTS cleanup_expired_status_cache
    AFTER INSERT ON source_status_cache
    FOR EACH ROW
    BEGIN
        DELETE FROM source_status_cache WHERE expires_at < strftime('%s', 'now') * 1000;
    END;

-- 分类删除时将其下源移到 others 分类（保护数据不丢失）
CREATE TRIGGER IF NOT EXISTS cascade_delete_category_sources
    AFTER DELETE ON search_source_categories
    FOR EACH ROW
    BEGIN
        UPDATE search_sources
        SET category_id = 'others', updated_at = strftime('%s', 'now') * 1000
        WHERE category_id = OLD.id;
    END;

-- 搜索时更新源使用统计
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

-- 新用户注册时自动创建默认源配置
CREATE TRIGGER IF NOT EXISTS create_default_user_source_configs
    AFTER INSERT ON users
    FOR EACH ROW
    BEGIN
        INSERT INTO user_search_source_configs (
            id, user_id, source_id, is_enabled, created_at, updated_at
        )
        SELECT
            NEW.id || '_' || ss.id,
            NEW.id,
            ss.id,
            CASE
                WHEN ss.id IN ('javbus', 'javdb', 'javlibrary', 'btsow') THEN 1
                WHEN ss.searchable = 1 AND ss.site_type = 'search' THEN 1
                ELSE 0
            END,
            strftime('%s', 'now') * 1000,
            strftime('%s', 'now') * 1000
        FROM search_sources ss
        WHERE ss.is_active = 1
        ORDER BY ss.display_order, ss.search_priority;
    END;

COMMIT;

-- =============================================
-- 验证（逐条取消注释执行）
-- =============================================
-- SELECT requires_keyword FROM search_major_categories LIMIT 1;  -- 应报错: no such column ✅
-- SELECT requires_keyword FROM search_sources LIMIT 1;          -- 应报错: no such column ✅
-- SELECT id, name FROM search_major_categories ORDER BY display_order;  -- 预期: anime/jav/movie
-- SELECT id, name, major_category_id FROM search_source_categories ORDER BY major_category_id;  -- 预期: 全部归属 jav/anime/movie
