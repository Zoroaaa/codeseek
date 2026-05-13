-- ===============================================
-- 搜索历史表结构扩展
-- 版本: 1.0
-- 说明: 为搜索历史添加详细字段，支持显示更丰富的信息
-- 执行顺序: 11
-- ===============================================

-- ===============================================
-- 扩展 user_search_history 表
-- 添加可选的详细信息字段（参考收藏表但不包含封面）
-- ===============================================

ALTER TABLE user_search_history ADD COLUMN title TEXT;
ALTER TABLE user_search_history ADD COLUMN subtitle TEXT;
ALTER TABLE user_search_history ADD COLUMN code TEXT;
ALTER TABLE user_search_history ADD COLUMN actors TEXT;
ALTER TABLE user_search_history ADD COLUMN duration TEXT;
ALTER TABLE user_search_history ADD COLUMN tags TEXT;
ALTER TABLE user_search_history ADD COLUMN release_date TEXT;
ALTER TABLE user_search_history ADD COLUMN publisher TEXT;
ALTER TABLE user_search_history ADD COLUMN keyword TEXT;

-- ===============================================
-- 索引优化（可选字段索引）
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_history_code ON user_search_history(code);
CREATE INDEX IF NOT EXISTS idx_history_keyword ON user_search_history(keyword);
