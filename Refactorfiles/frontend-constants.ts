/**
 * CodeSeek 前端常量 — Layer 2: 代码固定值
 *
 * 职责边界：
 *   Layer 1 wrangler.toml  → 部署级（后端管理，前端无感知）
 *   Layer 2 constants.ts   → 本文件：纯 UI/架构固定值，改了需要改代码
 *   Layer 3 DB → API      → 通过 ConfigContext 下发的运行期业务配置
 *
 * 判断标准：
 *   放这里  → 改了需要改代码（UI尺寸、动画时长、API地址、正则格式）
 *   放 ConfigContext → 从后端 /api/system/public-config 拉取的业务参数
 *
 * 注意：原来硬编码在这里的业务数字（用户名长度、最大收藏数、社区限制等）
 *       已全部移至 DB → ConfigContext，请勿在此处重复定义。
 */

/* ==================== API 配置 ==================== */

/** API 基础地址 — 与部署环境强绑定，改了需重新构建 */
export const API_BASE_URL = {
  LOCAL: '/api',
  PRODUCTION: 'https://backend.codeseek.pp.ua/api',
} as const;

/** API 请求行为配置 — 纯客户端重试策略 */
export const API_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  DEFAULT_TIMEOUT: 15000,
} as const;

/* ==================== UI 配置 ==================== */

/** Toast 通知 — UI 行为，不是业务规则 */
export const TOAST_CONFIG = {
  MAX_TOASTS: 5,
  DEFAULT_DURATION: 5000,
} as const;

/** 侧边栏尺寸 — 纯布局常量 */
export const SIDEBAR_CONFIG = {
  DEFAULT_WIDTH: 280,
  COLLAPSED_WIDTH: 72,
  MOBILE_WIDTH: 288,
} as const;

/* ==================== 代理配置 ==================== */

/** 代理服务器 — 与基础设施绑定，改了需重新部署 */
export const PROXY_CONFIG = {
  PROXY_SERVER: 'https://omnibox.pp.ua',
  DEFAULT_ENABLED: true,
  VERSION: '2.2.0',
  BACKEND_VERSION: '2.0.0',
} as const;

export const PROXY_TIMEOUTS = {
  HEALTH_CHECK: 10000,
} as const;

/* ==================== 格式校验（纯正则，不是业务数字）==================== */

/**
 * 表单格式正则 — 代码逻辑依赖，不可热改
 * 注意：长度限制（min/maxLength）来自 ConfigContext，不在此处定义
 */
export const VALIDATION_REGEX = {
  USERNAME: /^[a-zA-Z0-9_]+$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;

/** 验证码固定位数（格式规则，非业务参数）*/
export const VERIFICATION_CODE_LENGTH = 6;

/* ==================== 时间常量 ==================== */

/** 纯数学常量，供其他地方计算用 */
export const TIME_CONSTANTS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR:   60 * 60 * 1000,
  DAY:    24 * 60 * 60 * 1000,
} as const;

/* ==================== 统计默认天数 ==================== */

/** 图表默认时间范围 — UI 展示默认值，不是业务限制 */
export const STATS_DEFAULT_DAYS = {
  LOGIN_STATS: 7,
  ANALYTICS:   7,
  TRENDING_HOURS: 24,
} as const;

/* ==================== 响应式断点 ==================== */

/** CSS 断点（像素）— 布局固定值 */
export const BREAKPOINTS = {
  MOBILE:  768,
  TABLET:  1024,
  DESKTOP: 1280,
} as const;

/* ==================== 动画 ==================== */

/** 动画时长（毫秒）— 纯 UI 常量 */
export const ANIMATION_DURATION = {
  FAST:    150,
  DEFAULT: 300,
  SLOW:    500,
} as const;

/* ==================== 应用信息 ==================== */

/** 构建时版本号，来自打包配置 */
export const APP_VERSION = '2.0.0' as const;

/**
 * 应用展示信息后备值
 * 真实值通过 ConfigContext 从后端 DB 获取（site_name / site_description）
 * 仅在 ConfigContext 尚未加载时作为骨架屏占位使用
 */
export const APP_INFO_FALLBACK = {
  NAME: '磁力快搜',
  DESCRIPTION: '搜索全网资源，一步直达',
  VERSION: APP_VERSION,
} as const;

// ======================================================================
// ❌ 以下配置已迁移至 DB → ConfigContext，请勿在此处重复定义：
//
//   VALIDATION_RULES.PASSWORD_MIN/MAX_LENGTH     → config.minPasswordLength
//   VALIDATION_RULES.USERNAME_MIN/MAX_LENGTH     → config.minUsernameLength
//   VALIDATION_RULES.SEARCH_KEYWORD_MIN/MAX      → config.search.maxKeywordLength
//   SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS           → 后端 DB 控制，前端无需感知
//   COMMUNITY_CONFIG.*                           → 后端校验，前端从 config 取
//   SEARCH_CONFIG.MAX_KEYWORD_LENGTH             → config.search.maxKeywordLength
//   SEARCH_HISTORY_CONFIG.MAX_HISTORY_ITEMS      → config.maxHistoryPerUser
//   APP_INFO.NAME / DESCRIPTION                  → config.siteName / siteDescription
// ======================================================================
