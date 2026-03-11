/**
 * 前端常量统一管理文件
 * 功能：集中管理可能需要修改的配置常量
 * 作者：AI Assistant
 * 日期：2024
 */

/* ==================== API 配置 ==================== */

/** API 基础地址配置 */
export const API_BASE_URL = {
  /** 本地开发环境 API 地址 */
  LOCAL: '/api',
  /** 生产环境 API 地址 */
  PRODUCTION: 'https://backend.codeseek.pp.ua/api',
} as const;

/** API 请求配置 */
export const API_CONFIG = {
  /** 最大重试次数 */
  MAX_RETRIES: 3,
  /** 重试延迟（毫秒） */
  RETRY_DELAY: 1000,
  /** 默认超时时间（毫秒） */
  DEFAULT_TIMEOUT: 15000,
} as const;

/* ==================== UI 配置 ==================== */

/** Toast 通知配置 */
export const TOAST_CONFIG = {
  /** 最大显示数量 */
  MAX_TOASTS: 5,
  /** 默认显示时长（毫秒） */
  DEFAULT_DURATION: 5000,
} as const;

/** 侧边栏配置 */
export const SIDEBAR_CONFIG = {
  /** 默认宽度 */
  DEFAULT_WIDTH: 280,
  /** 折叠后宽度 */
  COLLAPSED_WIDTH: 72,
  /** 移动端宽度 */
  MOBILE_WIDTH: 288,
} as const;

/** 分页配置 */
export const PAGINATION_CONFIG = {
  /** 默认每页数量 */
  DEFAULT_PAGE_SIZE: 20,
  /** 搜索历史默认限制 */
  HISTORY_LIMIT: 50,
  /** 搜索建议默认限制 */
  SUGGESTIONS_LIMIT: 10,
  /** 热门搜索默认限制 */
  TRENDING_LIMIT: 20,
} as const;

/** 搜索历史配置 */
export const SEARCH_HISTORY_CONFIG = {
  /** 最大历史记录数 */
  MAX_HISTORY_ITEMS: 100,
  /** 默认加载历史数 */
  DEFAULT_LOAD_LIMIT: 20,
} as const;

/* ==================== 代理配置 ==================== */

/** 代理服务器配置 */
export const PROXY_CONFIG = {
  /** 主代理服务器地址 */
  PROXY_SERVER: 'https://omnibox.pp.ua',
  /** 默认启用状态 */
  DEFAULT_ENABLED: true,
  /** 代理版本号 */
  VERSION: '2.2.0',
  /** 后端版本号 */
  BACKEND_VERSION: '2.0.0',
} as const;

/** 代理超时配置 */
export const PROXY_TIMEOUTS = {
  /** 健康检查超时（毫秒） */
  HEALTH_CHECK: 10000,
} as const;

/* ==================== 验证规则 ==================== */

/** 表单验证规则（与后端 CONFIG.VALIDATION 保持一致） */
export const VALIDATION_RULES = {
  /** 密码最小长度 */
  PASSWORD_MIN_LENGTH: 6,
  /** 密码最大长度 */
  PASSWORD_MAX_LENGTH: 100,
  /** 用户名最小长度 */
  USERNAME_MIN_LENGTH: 3,
  /** 用户名最大长度 */
  USERNAME_MAX_LENGTH: 20,
  /** 邮箱最大长度 */
  EMAIL_MAX_LENGTH: 255,
  /** 搜索关键词最小长度 */
  SEARCH_KEYWORD_MIN_LENGTH: 2,
  /** 搜索关键词最大长度 */
  SEARCH_KEYWORD_MAX_LENGTH: 200,
  /** 验证码长度 */
  VERIFICATION_CODE_LENGTH: 6,
  /** 用户名正则：仅允许字母、数字、下划线 */
  USERNAME_REGEX: /^[a-zA-Z0-9_]+$/,
} as const;

/* ==================== 用户限制配置（与后端 CONFIG 同步） ==================== */

/** 用户限制配置 */
export const USER_LIMITS = {
  /** 每个用户最大标签数量 */
  MAX_TAGS_PER_USER: 50,
  /** 每个用户最大分享数量 */
  MAX_SHARES_PER_USER: 50,
  /** 每个用户最大收藏数量 */
  MAX_FAVORITES_PER_USER: 1000,
  /** 每个用户最大历史记录数量 */
  MAX_HISTORY_PER_USER: 1000,
} as const;

/* ==================== 安全配置（与后端 CONFIG.SECURITY 同步） ==================== */

/** 安全配置 */
export const SECURITY_CONFIG = {
  /** 最大登录尝试次数 */
  MAX_LOGIN_ATTEMPTS: 5,
  /** 最大验证尝试次数 */
  MAX_VERIFICATION_ATTEMPTS: 5,
  /** 最大密码重置尝试次数 */
  MAX_PASSWORD_RESET_ATTEMPTS: 3,
  /** 锁定时长（毫秒）- 15分钟 */
  LOCKOUT_DURATION_MS: 15 * 60 * 1000,
  /** 密码重置锁定时长（毫秒）- 1小时 */
  PASSWORD_RESET_LOCKOUT_MS: 60 * 60 * 1000,
} as const;

/* ==================== 社区配置（与后端 CONFIG.Community 同步） ==================== */

/** 社区功能配置 */
export const COMMUNITY_CONFIG = {
  /** 每个搜索源最大标签数 */
  MAX_TAGS_PER_SOURCE: 10,
  /** 评论最大长度 */
  MAX_COMMENT_LENGTH: 1000,
  /** 举报原因最大长度 */
  MAX_REPORT_REASON_LENGTH: 100,
  /** 举报详情最大长度 */
  MAX_REPORT_DETAILS_LENGTH: 1000,
  /** 标签名称最小长度 */
  TAG_NAME_MIN_LENGTH: 2,
  /** 标签名称最大长度 */
  TAG_NAME_MAX_LENGTH: 20,
  /** 搜索源名称最大长度 */
  SOURCE_NAME_MAX_LENGTH: 100,
  /** 搜索源描述最大长度 */
  SOURCE_DESCRIPTION_MAX_LENGTH: 2000,
} as const;

/* ==================== 搜索配置（与后端 CONFIG.Search 同步） ==================== */

/** 搜索功能配置 */
export const SEARCH_CONFIG = {
  /** 搜索关键词最大长度 */
  MAX_KEYWORD_LENGTH: 200,
  /** 每次搜索最大搜索源数量 */
  MAX_SOURCES_PER_SEARCH: 50,
  /** 搜索建议最小关键词长度 */
  SUGGESTIONS_MIN_KEYWORD_LENGTH: 2,
  /** 搜索建议最大数量 */
  SUGGESTIONS_MAX_LIMIT: 20,
  /** 热门搜索最大小时数 */
  TRENDING_MAX_HOURS: 168,
  /** 热门搜索默认小时数 */
  TRENDING_DEFAULT_HOURS: 24,
  /** 热门搜索默认数量 */
  TRENDING_DEFAULT_LIMIT: 20,
  /** 热门搜索最大数量 */
  TRENDING_MAX_LIMIT: 50,
} as const;

/* ==================== 时间配置 ==================== */

/** 时间常量（毫秒） */
export const TIME_CONSTANTS = {
  /** 一秒 */
  SECOND: 1000,
  /** 一分钟 */
  MINUTE: 60 * 1000,
  /** 一小时 */
  HOUR: 60 * 60 * 1000,
  /** 一天 */
  DAY: 24 * 60 * 60 * 1000,
} as const;

/** 默认统计天数 */
export const STATS_DEFAULT_DAYS = {
  /** 登录统计默认天数 */
  LOGIN_STATS: 7,
  /** 分析统计默认天数 */
  ANALYTICS: 7,
  /** 热门搜索默认小时数 */
  TRENDING_HOURS: 24,
} as const;

/* ==================== 响应式断点 ==================== */

/** 响应式断点（像素） */
export const BREAKPOINTS = {
  /** 移动端断点 */
  MOBILE: 768,
  /** 平板断点 */
  TABLET: 1024,
  /** 桌面断点 */
  DESKTOP: 1280,
} as const;

/* ==================== 动画配置 ==================== */

/** 动画时长（毫秒） */
export const ANIMATION_DURATION = {
  /** 快速动画 */
  FAST: 150,
  /** 默认动画 */
  DEFAULT: 300,
  /** 慢速动画 */
  SLOW: 500,
} as const;

/* ==================== 应用信息 ==================== */

/** 应用版本号（与后端保持同步） */
export const APP_VERSION = '2.0.0' as const;

/** 应用基本信息 */
export const APP_INFO = {
  /** 应用名称 */
  NAME: '磁力快搜',
  /** 应用描述 */
  DESCRIPTION: '搜索全网资源，一步直达',
  /** 默认欢迎语 */
  WELCOME_MESSAGE: '欢迎加入磁力快搜',
  /** 应用版本 */
  VERSION: APP_VERSION,
} as const;
