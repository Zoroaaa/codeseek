-- ===============================================
-- 磁力快搜数据库完整结构 - 主入口文件
-- 版本: 模块化拆分版本
-- 说明: 按功能模块拆分的数据库结构，便于维护和管理
-- ===============================================

-- ===============================================
-- 模块说明
-- ===============================================
-- 01_user_management.sql      - 用户管理模块（用户注册、登录、会话、收藏、搜索历史）
-- 02_search_engine.sql        - 搜索引擎核心模块（搜索缓存、状态检查、健康度统计）
-- 03_community.sql            - 社区功能模块（标签管理、共享搜索源、评分评论、点赞下载）
-- 04_detail_extraction.sql    - 详情提取功能模块（详情缓存、提取历史、用户配置、统计分析）
-- 05_email_security.sql       - 邮箱验证与安全模块（邮箱验证、密码重置、安全监控）
-- 06_system_analytics.sql     - 系统配置和分析模块（系统配置、用户行为分析）
-- 07_initialization_data.sql  - 初始化数据（系统配置、官方标签、邮件模板等）

-- ===============================================
-- 使用方法
-- ===============================================
-- 1. 完整初始化：
--    按顺序执行所有 .sql 文件即可完成数据库初始化
--
-- 2. 模块化部署：
--    根据需要选择性执行相应模块的 .sql 文件
--    注意：用户管理模块是基础模块，其他模块可能依赖它
--
-- 3. 更新或维护：
--    只需修改对应功能模块的 .sql 文件，无需修改整个结构

-- ===============================================
-- 模块依赖关系
-- ===============================================
-- 01_user_management.sql (基础模块，无依赖)
--   ├── 02_search_engine.sql (依赖 users 表)
--   ├── 03_community.sql (依赖 users 表)
--   ├── 04_detail_extraction.sql (依赖 users 表)
--   ├── 05_email_security.sql (依赖 users 表)
--   ├── 06_system_analytics.sql (依赖 users 表)
--   └── 07_initialization_data.sql (依赖所有模块的表结构)

-- ===============================================
-- 快速执行脚本（如需要一次性导入所有模块）
-- ===============================================

-- 以下命令可以一次性执行所有模块文件：
-- .read 01_user_management.sql
-- .read 02_search_engine.sql  
-- .read 03_community.sql
-- .read 04_detail_extraction.sql
-- .read 05_email_security.sql
-- .read 06_system_analytics.sql
-- .read 07_initialization_data.sql

-- ===============================================
-- 版本信息
-- ===============================================
INSERT OR REPLACE INTO system_config (key, value, description, config_type, is_public, created_at, updated_at) 
SELECT 
    'database_schema_version',
    '2.0.0', 
    '数据库结构版本（模块化拆分版本）',
    'string',
    0,
    strftime('%s', 'now') * 1000,
    strftime('%s', 'now') * 1000
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='system_config');

-- ===============================================
-- 数据库完整性检查
-- ===============================================
-- 运行此查询检查所有表是否正确创建：
-- SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;