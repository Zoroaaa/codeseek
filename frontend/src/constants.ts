/**
 * 前端常量统一管理文件
 * 功能：集中管理固定常量值和后备默认值
 * 作者：AI Assistant
 * 日期：2024
 * 
 * 重要说明：
 * - [固定值] 表示该配置为固定值，不需要动态调整
 * - [后备值] 表示该配置作为 API 配置的后备默认值
 * - 动态配置通过 ConfigContext 从后端 API 获取
 */

/* ==================== API 配置 ==================== */

/** API 基础地址配置 - [固定值] */
export const API_BASE_URL = {
  LOCAL: '/api',
  PRODUCTION: 'https://backend.codeseek.pp.ua/api',
} as const;

/** API 请求配置 - [固定值] */
export const API_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  DEFAULT_TIMEOUT: 15000,
} as const;

/* ==================== UI 配置 ==================== */

/** Toast 通知配置 - [固定值] */
export const TOAST_CONFIG = {
  MAX_TOASTS: 5,
  DEFAULT_DURATION: 5000,
} as const;

/** 侧边栏配置 - [固定值] */
export const SIDEBAR_CONFIG = {
  DEFAULT_WIDTH: 280,
  COLLAPSED_WIDTH: 72,
  MOBILE_WIDTH: 288,
} as const;

/* ==================== 代理配置 ==================== */

/** 代理服务器配置 - [固定值] */
export const PROXY_CONFIG = {
  PROXY_SERVER: 'https://omnibox.pp.ua',
  DEFAULT_ENABLED: true,
  VERSION: '2.2.0',
  BACKEND_VERSION: '2.0.0',
} as const;

/** 代理超时配置 - [固定值] */
export const PROXY_TIMEOUTS = {
  HEALTH_CHECK: 10000,
} as const;

/* ==================== 验证规则 ==================== */

/** 
 * 表单验证规则 - [后备值]
 * 注意：正则表达式为固定值
 */
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  EMAIL_MAX_LENGTH: 255,
  SEARCH_KEYWORD_MIN_LENGTH: 2,
  SEARCH_KEYWORD_MAX_LENGTH: 200,
  VERIFICATION_CODE_LENGTH: 6,
  USERNAME_REGEX: /^[a-zA-Z0-9_]+$/,
} as const;

/* ==================== 安全配置 ==================== */

/** 安全配置 - [后备值] */
export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,
  MAX_VERIFICATION_ATTEMPTS: 5,
  MAX_PASSWORD_RESET_ATTEMPTS: 3,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  PASSWORD_RESET_LOCKOUT_MS: 60 * 60 * 1000,
} as const;

/* ==================== 社区配置 ==================== */

/** 社区功能配置 - [后备值] */
export const COMMUNITY_CONFIG = {
  MAX_TAGS_PER_SOURCE: 10,
  MAX_COMMENT_LENGTH: 1000,
  MAX_REPORT_REASON_LENGTH: 100,
  MAX_REPORT_DETAILS_LENGTH: 1000,
  TAG_NAME_MIN_LENGTH: 2,
  TAG_NAME_MAX_LENGTH: 20,
  SOURCE_NAME_MAX_LENGTH: 100,
  SOURCE_DESCRIPTION_MAX_LENGTH: 2000,
} as const;

/* ==================== 搜索配置 ==================== */

/** 搜索功能配置 - [后备值] */
export const SEARCH_CONFIG = {
  MAX_KEYWORD_LENGTH: 200,
  MAX_SOURCES_PER_SEARCH: 50,
  SUGGESTIONS_MIN_KEYWORD_LENGTH: 2,
  SUGGESTIONS_MAX_LIMIT: 20,
  TRENDING_MAX_HOURS: 168,
  TRENDING_DEFAULT_HOURS: 24,
  TRENDING_DEFAULT_LIMIT: 20,
  TRENDING_MAX_LIMIT: 50,
} as const;

/** 搜索历史配置 - [后备值] */
export const SEARCH_HISTORY_CONFIG = {
  MAX_HISTORY_ITEMS: 100,
} as const;

/* ==================== 时间配置 ==================== */

/** 时间常量（毫秒）- [固定值] */
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
} as const;

/** 默认统计天数 - [固定值] */
export const STATS_DEFAULT_DAYS = {
  LOGIN_STATS: 7,
  ANALYTICS: 7,
  TRENDING_HOURS: 24,
} as const;

/* ==================== 响应式断点 ==================== */

/** 响应式断点（像素）- [固定值] */
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
} as const;

/* ==================== 动画配置 ==================== */

/** 动画时长（毫秒）- [固定值] */
export const ANIMATION_DURATION = {
  FAST: 150,
  DEFAULT: 300,
  SLOW: 500,
} as const;

/* ==================== 应用信息 ==================== */

/** 应用版本号 - [固定值] */
export const APP_VERSION = '2.0.0' as const;

/** 应用基本信息 - [后备值] */
export const APP_INFO = {
  NAME: '磁力快搜',
  DESCRIPTION: '搜索全网资源，一步直达',
  WELCOME_MESSAGE: '欢迎加入磁力快搜',
  VERSION: APP_VERSION,
} as const;
