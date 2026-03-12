/**
 * CodeSeek 后端常量统一管理
 * 功能：集中管理固定常量值和后备默认值
 * 作者：CodeSeek Team
 * 日期：2024
 * 
 * 重要说明：
 * - [固定值] 表示该配置为固定值，不需要动态调整
 * - [后备值] 表示该配置作为数据库配置的后备默认值
 * - 动态配置通过 ConfigService 从数据库 system_config 表读取
 */

export const CONFIG = {
  /** 允许的用户行为类型 - [固定值] */
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

  /** 验证相关配置 - [后备值] */
  VALIDATION: {
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 20,
    PASSWORD_MIN_LENGTH: 6,
    PASSWORD_MAX_LENGTH: 100,
    USERNAME_REGEX: /^[a-zA-Z0-9_]{3,20}$/,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    VERIFICATION_CODE_REGEX: /^\d{6}$/,
    MAX_BATCH_CONFIG_UPDATE: 100,
    MAX_SYNC_FAVORITES: 1000,
  },

  /** 安全相关配置 - [后备值] */
  SECURITY: {
    MAX_LOGIN_ATTEMPTS: 5,
    MAX_VERIFICATION_ATTEMPTS: 5,
    MAX_PASSWORD_RESET_ATTEMPTS: 5,
    LOCKOUT_DURATION_MS: 15 * 60 * 1000,
    PASSWORD_RESET_LOCKOUT_MS: 60 * 60 * 1000,
    SUSPICIOUS_ACTIVITY_THRESHOLD: 50,
    RECENT_FAILED_LOGINS_THRESHOLD: 3,
    RECENT_IP_LOGINS_THRESHOLD: 3,
    RECENT_PASSWORD_CHANGES_THRESHOLD: 2,
  },

  /** 邮件相关配置 - [后备值] */
  Email: {
    VERIFICATION_CODE_EXPIRY_MS: 900000,
    VERIFICATION_CODE_LENGTH: 6,
    HOURLY_LIMIT: 5,
    DAILY_LIMIT: 20,
    RESEND_INTERVAL_MS: 60000,
    CHANGE_REQUEST_EXPIRY_MS: 1800000,
    CHANGE_PENDING_EXPIRY_MINUTES: 15,
    DEFAULT_FROM_EMAIL: 'noreply@codeseek.pp.ua',
    DEFAULT_FROM_NAME: '磁力快搜',
  },

  /** CORS跨域配置 - [固定值] */
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

  /** 临时邮箱域名黑名单 - [固定值] */
  TempEmail: {
    DOMAINS: [
      '10minutemail.com',
      'guerrillamail.com',
      'tempmail.org',
      'temp-mail.org',
      'throwaway.email',
      'mailinator.com',
      'yopmail.com',
      'maildrop.cc',
      'tempail.com',
      '10min.email',
      'sharklasers.com',
      'guerrillamailblock.com',
      'pokemail.net',
      'spam4.me',
      'bccto.me',
      'chacuo.net',
      'dispostable.com',
      'tempinbox.com',
      'mohmal.com',
      'emailondeck.com',
    ] as const,
  },

  /** 可信邮箱域名白名单 - [固定值] */
  TrustedEmail: {
    DOMAINS: [
      'gmail.com',
      'outlook.com',
      'hotmail.com',
      'yahoo.com',
      'qq.com',
      '163.com',
      '126.com',
      'sina.com',
      'sohu.com',
      'foxmail.com',
      '139.com',
      'yeah.net',
    ] as const,
  },

  /** 搜索源状态检查配置 - [后备值] */
  SourceStatus: {
    CHECK_TIMEOUT_MS: 10000,
    BATCH_CHECK_TIMEOUT_MS: 5000,
    CACHE_DURATION_MS: 300000,
    MAX_BATCH_CHECK: 50,
    MAX_CACHE_AGE_MS: 300000,
  },

  /** 缓存配置 - [固定值] */
  Cache: {
    SEARCH_DEFAULT_TTL_MINUTES: 60,
    STATUS_CACHE_DURATION_MS: 300000,
  },

  /** 分页配置 - [后备值] */
  Pagination: {
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
    MAX_LOG_PAGE_SIZE: 200,
    DEFAULT_HISTORY_LIMIT: 50,
    MAX_HISTORY_LIMIT: 200,
    MAX_BATCH_CONFIG_UPDATE: 100,
    MAX_SOURCES_CHECK: 50,
  },

  /** 时间常量 - [固定值] */
  Stats: {
    WEEK_IN_MS: 7 * 24 * 60 * 60 * 1000,
    TWO_WEEKS_IN_MS: 14 * 24 * 60 * 60 * 1000,
    DAY_IN_MS: 24 * 60 * 60 * 1000,
    HOUR_IN_MS: 60 * 60 * 1000,
    MONTH_IN_MS: 30 * 24 * 60 * 60 * 1000,
  },

  /** 默认值配置 - [固定值] */
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
    SITE_URL: 'https://codeseek.pp.ua',
  },

  /** 角色配置 - [固定值] */
  Roles: {
    DEFAULT_ROLE_ID: 'user',
    DEFAULT_ROLE_NAME: 'user',
    DEFAULT_ROLE_DISPLAY_NAME: '普通用户',
    DEFAULT_ROLE_PRIORITY: 10,
    DEFAULT_PERMISSIONS: ['search', 'favorite', 'history', 'sync'] as const,
  },

  /** 数据清理配置 - [后备值] */
  Cleanup: {
    PASSWORD_RESET_LOG_RETENTION_DAYS: 30,
    USER_ACTIONS_RETENTION_DAYS: 90,
    EMAIL_VERIFICATION_RETENTION_DAYS: 7,
  },

  /** 社区功能配置 - [后备值] */
  Community: {
    MAX_TAGS_PER_SOURCE: 10,
    MAX_COMMENT_LENGTH: 1000,
    MAX_REPORT_REASON_LENGTH: 100,
    MAX_REPORT_DETAILS_LENGTH: 1000,
    TAG_NAME_MIN_LENGTH: 2,
    TAG_NAME_MAX_LENGTH: 20,
    SOURCE_NAME_MAX_LENGTH: 100,
    SOURCE_DESCRIPTION_MAX_LENGTH: 2000,
  },

  /** 搜索功能配置 - [后备值] */
  Search: {
    MAX_KEYWORD_LENGTH: 200,
    MAX_SOURCES_PER_SEARCH: 50,
    SUGGESTIONS_MIN_KEYWORD_LENGTH: 2,
    SUGGESTIONS_MAX_LIMIT: 20,
    TRENDING_MAX_HOURS: 168,
    TRENDING_DEFAULT_HOURS: 24,
    TRENDING_DEFAULT_LIMIT: 20,
    TRENDING_MAX_LIMIT: 50,
  },

  /** 用户数据限制配置 - [后备值] */
  MAX_FAVORITES_PER_USER: 1000,
  MAX_HISTORY_PER_USER: 500,
  MAX_TAGS_PER_USER: 100,
};
