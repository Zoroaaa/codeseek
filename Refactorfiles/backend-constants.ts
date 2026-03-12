/**
 * CodeSeek 后端常量 — Layer 2: 代码固定值
 *
 * 职责：存放真正的"代码级固定值"——改了需要修改代码重新部署的内容。
 *
 * 三层架构职责边界：
 *   Layer 1 wrangler.toml  → 部署级基础设施参数（域名、邮件发件人、JWT策略）
 *   Layer 2 constants.ts   → 本文件：代码枚举/正则/固定业务逻辑
 *   Layer 3 DB system_config → 运行期业务参数，管理后台可热改
 *
 * 判断标准：
 *   放这里  → 改了需要改代码逻辑（正则、枚举、黑白名单、架构默认值）
 *   放 DB   → 管理员在后台调一下数字就能生效（限制数、超时、开关）
 */

export const CONFIG = {

  // ==================================================================
  // 固定枚举值 — 代码逻辑依赖，不可热改
  // ==================================================================

  /** 允许的用户行为类型白名单 */
  ALLOWED_ACTIONS: [
    'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
    'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
    'sync_data', 'page_view', 'session_start', 'session_end',
    'custom_source_add', 'custom_source_edit', 'custom_source_delete',
    'tag_created', 'tag_updated', 'tag_deleted',
    'major_category_create', 'major_category_update', 'major_category_delete',
    'source_category_create', 'source_category_update', 'source_category_delete',
    'search_source_create', 'search_source_update', 'search_source_delete',
    'user_source_config_update', 'search_sources_export',
  ] as const,

  // ==================================================================
  // 正则表达式 — 格式规则，改了需改验证逻辑
  // ==================================================================

  VALIDATION: {
    USERNAME_REGEX: /^[a-zA-Z0-9_]{3,20}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    VERIFICATION_CODE_REGEX: /^\d{6}$/,
  },

  // ==================================================================
  // 邮箱域名黑白名单 — 安全规则，不允许管理员在后台修改
  // ==================================================================

  TempEmail: {
    DOMAINS: [
      '10minutemail.com', 'guerrillamail.com', 'tempmail.org', 'temp-mail.org',
      'throwaway.email', 'mailinator.com', 'yopmail.com', 'maildrop.cc',
      'tempail.com', '10min.email', 'sharklasers.com', 'guerrillamailblock.com',
      'pokemail.net', 'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
      'tempinbox.com', 'mohmal.com', 'emailondeck.com',
    ] as const,
  },

  TrustedEmail: {
    DOMAINS: [
      'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'qq.com',
      '163.com', '126.com', 'sina.com', 'sohu.com', 'foxmail.com',
      '139.com', 'yeah.net',
    ] as const,
  },

  // ==================================================================
  // CORS — 与部署域名强绑定，改了需要重新部署
  // ==================================================================

  CORS: {
    MAX_AGE: 86400,
    ALLOW_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    ALLOW_HEADERS: ['Content-Type', 'Authorization', 'X-Requested-With'],
    EXPOSE_HEADERS: ['Content-Length', 'X-Request-Id'],
    ALLOWED_ORIGINS: [
      'https://codeseek.pp.ua',
      'https://www.codeseek.pp.ua',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
  },

  // ==================================================================
  // 纯计算用时间常量 — 不是业务参数，是代码里的数学常量
  // ==================================================================

  Stats: {
    HOUR_IN_MS:       60 * 60 * 1000,
    DAY_IN_MS:    24 * 60 * 60 * 1000,
    WEEK_IN_MS:    7 * 24 * 60 * 60 * 1000,
    TWO_WEEKS_IN_MS: 14 * 24 * 60 * 60 * 1000,
    MONTH_IN_MS:  30 * 24 * 60 * 60 * 1000,
  },

  // ==================================================================
  // UI/展示默认值 — 代码渲染逻辑依赖，无业务含义
  // ==================================================================

  Defaults: {
    APP_VERSION: '2.0.0',
    SEARCH_PRIORITY: 5,
    DISPLAY_ORDER: 999,
    DEFAULT_ICON: '🔍',
    DEFAULT_CATEGORY_ICON: '📁',
    DEFAULT_MAJOR_CATEGORY_ICON: '🌟',
    DEFAULT_COLOR: '#3b82f6',
    DEFAULT_MAJOR_CATEGORY_COLOR: '#6b7280',
    DEFAULT_SITE_TYPE: 'search',
  },

  // ==================================================================
  // 角色枚举 — 代码逻辑硬编码，改了需改权限体系
  // ==================================================================

  Roles: {
    DEFAULT_ROLE_ID: 'user',
    DEFAULT_ROLE_NAME: 'user',
    DEFAULT_ROLE_DISPLAY_NAME: '普通用户',
    DEFAULT_ROLE_PRIORITY: 10,
    DEFAULT_PERMISSIONS: ['search', 'favorite', 'history', 'sync'] as const,
  },
};

// ==================================================================
// DB Key 常量 — 防止字符串拼写错误，集中管理所有 system_config key
// 使用方式：configService.getInt(DB_CONFIG_KEYS.MAX_FAVORITES, 1000)
// ==================================================================

export const DB_CONFIG_KEYS = {
  // basic
  SITE_NAME:                     'site_name',
  SITE_DESCRIPTION:              'site_description',
  ENABLE_REGISTRATION:           'enable_registration',

  // user_limits
  MAX_FAVORITES:                 'max_favorites',
  MAX_SEARCH_HISTORY:            'max_search_history',
  MIN_USERNAME_LENGTH:           'min_username_length',
  MAX_USERNAME_LENGTH:           'max_username_length',
  MIN_PASSWORD_LENGTH:           'min_password_length',
  MAX_PASSWORD_LENGTH:           'max_password_length',
  MAX_TAGS_PER_USER:             'max_tags_per_user',
  MAX_BATCH_CONFIG_UPDATE:       'max_batch_config_update',
  MAX_SYNC_FAVORITES:            'max_sync_favorites',

  // source_check
  SOURCE_CHECK_ENABLED:          'source_check_enabled',
  MAX_CONCURRENT_CHECKS:         'max_concurrent_checks',
  DEFAULT_CHECK_TIMEOUT:         'default_check_timeout',
  BATCH_CHECK_TIMEOUT_MS:        'batch_check_timeout_ms',
  CACHE_DURATION_MS:             'cache_duration_ms',
  MAX_BATCH_CHECK:               'max_batch_check',
  MAX_CACHE_AGE_MS:              'max_cache_age_ms',

  // community
  COMMUNITY_ENABLED:             'community_enabled',
  COMMUNITY_REQUIRE_APPROVAL:    'community_require_approval',
  COMMUNITY_MAX_SHARES_PER_USER: 'community_max_shares_per_user',
  MIN_RATING_TO_FEATURE:         'min_rating_to_feature',
  MAX_TAGS_PER_SOURCE:           'max_tags_per_source',
  MAX_COMMENT_LENGTH:            'max_comment_length',
  MAX_REPORT_REASON_LENGTH:      'max_report_reason_length',
  MAX_REPORT_DETAILS_LENGTH:     'max_report_details_length',
  TAG_NAME_MIN_LENGTH:           'tag_name_min_length',
  TAG_NAME_MAX_LENGTH:           'tag_name_max_length',
  SOURCE_NAME_MAX_LENGTH:        'source_name_max_length',
  SOURCE_DESCRIPTION_MAX_LENGTH: 'source_description_max_length',

  // email
  EMAIL_VERIFICATION_ENABLED:    'email_verification_enabled',
  EMAIL_VERIFICATION_REQUIRED:   'email_verification_required',
  VERIFICATION_CODE_LENGTH:      'verification_code_length',
  VERIFICATION_CODE_EXPIRY:      'verification_code_expiry',
  MAX_VERIFICATION_ATTEMPTS:     'max_verification_attempts',
  EMAIL_RATE_LIMIT_PER_HOUR:     'email_rate_limit_per_hour',
  EMAIL_RATE_LIMIT_PER_DAY:      'email_rate_limit_per_day',
  RESEND_INTERVAL_MS:            'resend_interval_ms',
  CHANGE_REQUEST_EXPIRY_MS:      'change_request_expiry_ms',
  CHANGE_PENDING_EXPIRY_MINUTES: 'change_pending_expiry_minutes',

  // password
  FORGOT_PASSWORD_ENABLED:            'forgot_password_enabled',
  RESET_PASSWORD_CODE_EXPIRY:         'reset_password_code_expiry',
  PASSWORD_RESET_MAX_ATTEMPTS:        'password_reset_max_attempts',
  PASSWORD_RESET_LOCKOUT_DURATION:    'password_reset_lockout_duration',

  // security
  SECURITY_MONITORING_ENABLED:        'security_monitoring_enabled',
  SECURITY_EVENT_RETENTION_DAYS:      'security_event_retention_days',
  HIGH_RISK_THRESHOLD:                'high_risk_threshold',
  MAX_LOGIN_ATTEMPTS:                 'max_login_attempts',
  LOCKOUT_DURATION_MS:                'lockout_duration_ms',
  RECENT_FAILED_LOGINS_THRESHOLD:     'recent_failed_logins_threshold',
  RECENT_IP_LOGINS_THRESHOLD:         'recent_ip_logins_threshold',
  RECENT_PASSWORD_CHANGES_THRESHOLD:  'recent_password_changes_threshold',

  // features
  ENABLE_SEARCH_HISTORY:    'enable_search_history',
  ENABLE_FAVORITES:         'enable_favorites',
  ENABLE_ANALYTICS:         'enable_analytics',
  ENABLE_DARK_MODE:         'enable_dark_mode',
  ENABLE_PROXY:             'enable_proxy',
  ENABLE_SEARCH_SUGGESTIONS:'enable_search_suggestions',

  // session
  SESSION_TIMEOUT_MINUTES:  'session_timeout_minutes',
  MAX_SESSIONS_PER_USER:    'max_sessions_per_user',
  REMEMBER_ME_DAYS:         'remember_me_days',

  // search
  DEFAULT_SEARCH_SOURCES:         'default_search_sources',
  SEARCH_DEBOUNCE_MS:             'search_debounce_ms',
  TRENDING_SEARCHES_HOURS:        'trending_searches_hours',
  MAX_KEYWORD_LENGTH:             'max_keyword_length',
  MAX_SOURCES_PER_SEARCH:         'max_sources_per_search',
  SUGGESTIONS_MIN_KEYWORD_LENGTH: 'suggestions_min_keyword_length',
  SUGGESTIONS_MAX_LIMIT:          'suggestions_max_limit',
  TRENDING_MAX_HOURS:             'trending_max_hours',
  TRENDING_DEFAULT_LIMIT:         'trending_default_limit',
  TRENDING_MAX_LIMIT:             'trending_max_limit',

  // pagination
  DEFAULT_PAGE_SIZE:       'default_page_size',
  MAX_PAGE_SIZE:           'max_page_size',
  MAX_LOG_PAGE_SIZE:       'max_log_page_size',
  DEFAULT_HISTORY_LIMIT:   'default_history_limit',
  MAX_HISTORY_LIMIT:       'max_history_limit',

  // cleanup
  PASSWORD_RESET_LOG_RETENTION_DAYS:    'password_reset_log_retention_days',
  USER_ACTIONS_RETENTION_DAYS:          'user_actions_retention_days',
  EMAIL_VERIFICATION_RETENTION_DAYS:    'email_verification_retention_days',
} as const;
