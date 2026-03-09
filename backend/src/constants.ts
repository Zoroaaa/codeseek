export const CONFIG = {
  MAX_TAGS_PER_USER: 50,
  MAX_SHARES_PER_USER: 50,
  MAX_FAVORITES_PER_USER: 1000,
  MAX_HISTORY_PER_USER: 1000,

  ALLOWED_ACTIONS: [
    'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
    'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
    'sync_data', 'page_view', 'session_start', 'session_end',
    'custom_source_add', 'custom_source_edit', 'custom_source_delete',
    'tag_created', 'tag_updated', 'tag_deleted',
    'major_category_create', 'major_category_update', 'major_category_delete',
    'source_category_create', 'source_category_update', 'source_category_delete',
    'search_source_create', 'search_source_update', 'search_source_delete',
    'user_source_config_update', 'search_sources_export'
  ] as const,
};

export type AllowedAction = typeof CONFIG.ALLOWED_ACTIONS[number];
