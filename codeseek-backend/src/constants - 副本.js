// src/constants.js - 应用常量和配置
export const CONFIG = {
    MAX_TAGS_PER_USER: 50,
    MAX_SHARES_PER_USER: 50,
    MAX_FAVORITES_PER_USER: 1000,
    MAX_HISTORY_PER_USER: 1000,
    DEFAULT_CACHE_DURATION: 300000, // 5分钟
    ALLOWED_ACTIONS: [
        'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
        'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
        'sync_data', 'page_view', 'session_start', 'session_end',
        'custom_source_add', 'custom_source_edit', 'custom_source_delete',
        'tag_created', 'tag_updated', 'tag_deleted'
    ]
};

export const VALID_CATEGORIES = ['jav', 'movie', 'torrent', 'other'];

export const VALID_SORT_COLUMNS = ['created_at', 'updated_at', 'rating_score', 'download_count', 'like_count', 'view_count'];