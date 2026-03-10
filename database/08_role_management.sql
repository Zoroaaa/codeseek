-- ===============================================
-- 角色与权限管理迁移
-- 版本: 1.1
-- 说明: 添加用户角色、角色定义表，复用现有表结构
-- ===============================================

-- ===============================================
-- 1. 角色定义表
-- ===============================================

CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,                        -- 角色唯一标识
    name TEXT UNIQUE NOT NULL,                  -- 角色名称（如 admin, super_admin, user）
    display_name TEXT NOT NULL,                 -- 显示名称（如 管理员, 超级管理员, 普通用户）
    description TEXT,                           -- 角色描述
    permissions TEXT DEFAULT '[]',              -- 角色权限列表（JSON数组）
    is_system INTEGER DEFAULT 0,                -- 是否系统内置角色（不可删除）
    priority INTEGER DEFAULT 0,                 -- 角色优先级（数字越大权限越高）
    created_at INTEGER NOT NULL,                -- 创建时间戳
    updated_at INTEGER NOT NULL                 -- 更新时间戳
);

-- ===============================================
-- 2. 用户表添加角色字段
-- ===============================================

ALTER TABLE users ADD COLUMN role_id TEXT DEFAULT 'user';

-- ===============================================
-- 3. 索引定义
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_priority ON roles(priority);

-- 为 user_actions 添加登录相关索引（用于登录日志查询）
CREATE INDEX IF NOT EXISTS idx_actions_login ON user_actions(action, created_at);

-- ===============================================
-- 4. 初始化角色数据
-- ===============================================

-- 超级管理员
INSERT OR IGNORE INTO roles (id, name, display_name, description, permissions, is_system, priority, created_at, updated_at)
VALUES (
    'super_admin',
    'super_admin',
    '超级管理员',
    '拥有系统最高权限，可以管理所有用户和系统配置',
    '["*"]',
    1,
    100,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- 管理员
INSERT OR IGNORE INTO roles (id, name, display_name, description, permissions, is_system, priority, created_at, updated_at)
VALUES (
    'admin',
    'admin',
    '管理员',
    '可以管理用户、查看统计数据、处理举报等',
    '["user:read", "user:write", "stats:read", "report:read", "report:write", "source:read", "source:write", "community:read", "community:write"]',
    1,
    50,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- 普通用户
INSERT OR IGNORE INTO roles (id, name, display_name, description, permissions, is_system, priority, created_at, updated_at)
VALUES (
    'user',
    'user',
    '普通用户',
    '普通注册用户，拥有基本的搜索和收藏功能',
    '["search", "favorite", "history", "sync", "community:share", "community:review"]',
    1,
    10,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- 访客用户
INSERT OR IGNORE INTO roles (id, name, display_name, description, permissions, is_system, priority, created_at, updated_at)
VALUES (
    'guest',
    'guest',
    '访客用户',
    '未登录用户，只能使用基础搜索功能',
    '["search"]',
    1,
    1,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
);

-- ===============================================
-- 5. 触发器定义
-- ===============================================

CREATE TRIGGER IF NOT EXISTS update_roles_timestamp 
    AFTER UPDATE ON roles
    FOR EACH ROW
    BEGIN
        UPDATE roles SET updated_at = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
    END;
