-- ===============================================
-- 社区 v3.0 触发器修复补丁
-- 问题: update_user_stats_after_post 触发器逻辑过于复杂
--       在 Cloudflare D1 中执行时可能导致 INSERT 失败
-- 解决: 删除该触发器，统计更新改由应用层代码处理
-- 执行方式: wrangler d1 execute <DB_NAME> --file=./database/fix_community_triggers.sql
-- ===============================================

-- 删除有问题的用户统计触发器（统计更新已移至后端应用层）
DROP TRIGGER IF EXISTS update_user_stats_after_post;

-- 同样清理其他可能出问题的统计触发器（应用层已覆盖这些逻辑）
DROP TRIGGER IF EXISTS update_user_stats_after_like;
DROP TRIGGER IF EXISTS update_user_stats_after_favorite;
DROP TRIGGER IF EXISTS update_user_stats_after_comment;

-- 保留 FTS5 同步触发器和帖子计数触发器（这些逻辑简单且必要）
-- - community_posts_fts_insert / _update / _delete (FTS 全文搜索同步)
-- - update_post_comment_count_after_insert / _delete (评论计数)
-- - update_post_like_count_after_insert / _delete (点赞计数)
-- - update_post_favorite_count_after_insert / _delete (收藏计数)

-- 验证：确认触发器已删除
SELECT name, type FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'update_user_stats_%';
