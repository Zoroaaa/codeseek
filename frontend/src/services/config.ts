import { configApi } from '@/services/api/system';

export interface PublicConfig {
  site_name: string;
  site_description: string;
  enable_registration: boolean;
  max_search_history: number;
  max_favorites: number;
  min_username_length: number;
  max_username_length: number;
  min_password_length: number;
  max_password_length: number;
  max_tags_per_user: number;
  max_batch_config_update: number;
  max_sync_favorites: number;
  source_check_enabled: boolean;
  max_concurrent_checks: number;
  default_check_timeout: number;
  cache_duration_ms: number;
  community_enabled: boolean;
  community_require_approval: boolean;
  community_max_shares_per_user: number;
  max_tags_per_source: number;
  max_comment_length: number;
  max_report_reason_length: number;
  max_report_details_length: number;
  tag_name_min_length: number;
  tag_name_max_length: number;
  source_name_max_length: number;
  source_description_max_length: number;
  email_verification_enabled: boolean;
  email_verification_required: boolean;
  verification_code_length: number;
  verification_code_expiry: number;
  forgot_password_enabled: boolean;
  reset_password_code_expiry: number;
  resend_interval_ms: number;
  security_monitoring_enabled: boolean;
  security_event_retention_days: number;
  max_login_attempts: number;
  lockout_duration_ms: number;
  enable_search_history: boolean;
  enable_favorites: boolean;
  enable_analytics: boolean;
  enable_dark_mode: boolean;
  enable_proxy: boolean;
  enable_search_suggestions: boolean;
  session_timeout_minutes: number;
  max_sessions_per_user: number;
  remember_me_days: number;
  default_search_sources: number;
  search_debounce_ms: number;
  trending_searches_hours: number;
  max_keyword_length: number;
  max_sources_per_search: number;
  suggestions_min_keyword_length: number;
  suggestions_max_limit: number;
  trending_max_hours: number;
  trending_default_limit: number;
  trending_max_limit: number;
  default_page_size: number;
  max_page_size: number;
  max_log_page_size: number;
  default_history_limit: number;
  max_history_limit: number;
  password_reset_log_retention_days: number;
  user_actions_retention_days: number;
  email_verification_retention_days: number;
}

const CONFIG_CACHE_KEY = 'app_config_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

let cachedConfig: PublicConfig | null = null;
let lastFetchTime = 0;

function parseString(value: unknown, defaultValue: string): string {
  if (value === undefined || value === null) return defaultValue;
  return String(value);
}

function parseNumber(value: unknown, defaultValue: number): number {
  if (value === undefined || value === null) return defaultValue;
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null) return defaultValue;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function getDefaultConfig(): PublicConfig {
  return {
    site_name: '磁力快搜',
    site_description: '搜索全网资源，一步直达',
    enable_registration: true,
    max_search_history: 1000,
    max_favorites: 1000,
    min_username_length: 3,
    max_username_length: 20,
    min_password_length: 6,
    max_password_length: 100,
    max_tags_per_user: 50,
    max_batch_config_update: 100,
    max_sync_favorites: 1000,
    source_check_enabled: true,
    max_concurrent_checks: 3,
    default_check_timeout: 10000,
    cache_duration_ms: 300000,
    community_enabled: true,
    community_require_approval: false,
    community_max_shares_per_user: 50,
    max_tags_per_source: 10,
    max_comment_length: 1000,
    max_report_reason_length: 100,
    max_report_details_length: 1000,
    tag_name_min_length: 2,
    tag_name_max_length: 20,
    source_name_max_length: 100,
    source_description_max_length: 2000,
    email_verification_enabled: true,
    email_verification_required: false,
    verification_code_length: 6,
    verification_code_expiry: 900000,
    forgot_password_enabled: true,
    reset_password_code_expiry: 1800000,
    resend_interval_ms: 60000,
    security_monitoring_enabled: true,
    security_event_retention_days: 90,
    max_login_attempts: 5,
    lockout_duration_ms: 900000,
    enable_search_history: true,
    enable_favorites: true,
    enable_analytics: true,
    enable_dark_mode: true,
    enable_proxy: true,
    enable_search_suggestions: true,
    session_timeout_minutes: 1440,
    max_sessions_per_user: 5,
    remember_me_days: 30,
    default_search_sources: 20,
    search_debounce_ms: 300,
    trending_searches_hours: 24,
    max_keyword_length: 200,
    max_sources_per_search: 50,
    suggestions_min_keyword_length: 2,
    suggestions_max_limit: 20,
    trending_max_hours: 168,
    trending_default_limit: 20,
    trending_max_limit: 50,
    default_page_size: 20,
    max_page_size: 100,
    max_log_page_size: 200,
    default_history_limit: 50,
    max_history_limit: 200,
    password_reset_log_retention_days: 30,
    user_actions_retention_days: 90,
    email_verification_retention_days: 7,
  };
}

function parseConfig(data: Record<string, unknown>): PublicConfig {
  const defaults = getDefaultConfig();
  
  return {
    site_name: parseString(data.site_name, defaults.site_name),
    site_description: parseString(data.site_description, defaults.site_description),
    enable_registration: parseBoolean(data.enable_registration, defaults.enable_registration),
    max_search_history: parseNumber(data.max_search_history, defaults.max_search_history),
    max_favorites: parseNumber(data.max_favorites, defaults.max_favorites),
    min_username_length: parseNumber(data.min_username_length, defaults.min_username_length),
    max_username_length: parseNumber(data.max_username_length, defaults.max_username_length),
    min_password_length: parseNumber(data.min_password_length, defaults.min_password_length),
    max_password_length: parseNumber(data.max_password_length, defaults.max_password_length),
    max_tags_per_user: parseNumber(data.max_tags_per_user, defaults.max_tags_per_user),
    max_batch_config_update: parseNumber(data.max_batch_config_update, defaults.max_batch_config_update),
    max_sync_favorites: parseNumber(data.max_sync_favorites, defaults.max_sync_favorites),
    source_check_enabled: parseBoolean(data.source_check_enabled, defaults.source_check_enabled),
    max_concurrent_checks: parseNumber(data.max_concurrent_checks, defaults.max_concurrent_checks),
    default_check_timeout: parseNumber(data.default_check_timeout, defaults.default_check_timeout),
    cache_duration_ms: parseNumber(data.cache_duration_ms, defaults.cache_duration_ms),
    community_enabled: parseBoolean(data.community_enabled, defaults.community_enabled),
    community_require_approval: parseBoolean(data.community_require_approval, defaults.community_require_approval),
    community_max_shares_per_user: parseNumber(data.community_max_shares_per_user, defaults.community_max_shares_per_user),
    max_tags_per_source: parseNumber(data.max_tags_per_source, defaults.max_tags_per_source),
    max_comment_length: parseNumber(data.max_comment_length, defaults.max_comment_length),
    max_report_reason_length: parseNumber(data.max_report_reason_length, defaults.max_report_reason_length),
    max_report_details_length: parseNumber(data.max_report_details_length, defaults.max_report_details_length),
    tag_name_min_length: parseNumber(data.tag_name_min_length, defaults.tag_name_min_length),
    tag_name_max_length: parseNumber(data.tag_name_max_length, defaults.tag_name_max_length),
    source_name_max_length: parseNumber(data.source_name_max_length, defaults.source_name_max_length),
    source_description_max_length: parseNumber(data.source_description_max_length, defaults.source_description_max_length),
    email_verification_enabled: parseBoolean(data.email_verification_enabled, defaults.email_verification_enabled),
    email_verification_required: parseBoolean(data.email_verification_required, defaults.email_verification_required),
    verification_code_length: parseNumber(data.verification_code_length, defaults.verification_code_length),
    verification_code_expiry: parseNumber(data.verification_code_expiry, defaults.verification_code_expiry),
    forgot_password_enabled: parseBoolean(data.forgot_password_enabled, defaults.forgot_password_enabled),
    reset_password_code_expiry: parseNumber(data.reset_password_code_expiry, defaults.reset_password_code_expiry),
    resend_interval_ms: parseNumber(data.resend_interval_ms, defaults.resend_interval_ms),
    security_monitoring_enabled: parseBoolean(data.security_monitoring_enabled, defaults.security_monitoring_enabled),
    security_event_retention_days: parseNumber(data.security_event_retention_days, defaults.security_event_retention_days),
    max_login_attempts: parseNumber(data.max_login_attempts, defaults.max_login_attempts),
    lockout_duration_ms: parseNumber(data.lockout_duration_ms, defaults.lockout_duration_ms),
    enable_search_history: parseBoolean(data.enable_search_history, defaults.enable_search_history),
    enable_favorites: parseBoolean(data.enable_favorites, defaults.enable_favorites),
    enable_analytics: parseBoolean(data.enable_analytics, defaults.enable_analytics),
    enable_dark_mode: parseBoolean(data.enable_dark_mode, defaults.enable_dark_mode),
    enable_proxy: parseBoolean(data.enable_proxy, defaults.enable_proxy),
    enable_search_suggestions: parseBoolean(data.enable_search_suggestions, defaults.enable_search_suggestions),
    session_timeout_minutes: parseNumber(data.session_timeout_minutes, defaults.session_timeout_minutes),
    max_sessions_per_user: parseNumber(data.max_sessions_per_user, defaults.max_sessions_per_user),
    remember_me_days: parseNumber(data.remember_me_days, defaults.remember_me_days),
    default_search_sources: parseNumber(data.default_search_sources, defaults.default_search_sources),
    search_debounce_ms: parseNumber(data.search_debounce_ms, defaults.search_debounce_ms),
    trending_searches_hours: parseNumber(data.trending_searches_hours, defaults.trending_searches_hours),
    max_keyword_length: parseNumber(data.max_keyword_length, defaults.max_keyword_length),
    max_sources_per_search: parseNumber(data.max_sources_per_search, defaults.max_sources_per_search),
    suggestions_min_keyword_length: parseNumber(data.suggestions_min_keyword_length, defaults.suggestions_min_keyword_length),
    suggestions_max_limit: parseNumber(data.suggestions_max_limit, defaults.suggestions_max_limit),
    trending_max_hours: parseNumber(data.trending_max_hours, defaults.trending_max_hours),
    trending_default_limit: parseNumber(data.trending_default_limit, defaults.trending_default_limit),
    trending_max_limit: parseNumber(data.trending_max_limit, defaults.trending_max_limit),
    default_page_size: parseNumber(data.default_page_size, defaults.default_page_size),
    max_page_size: parseNumber(data.max_page_size, defaults.max_page_size),
    max_log_page_size: parseNumber(data.max_log_page_size, defaults.max_log_page_size),
    default_history_limit: parseNumber(data.default_history_limit, defaults.default_history_limit),
    max_history_limit: parseNumber(data.max_history_limit, defaults.max_history_limit),
    password_reset_log_retention_days: parseNumber(data.password_reset_log_retention_days, defaults.password_reset_log_retention_days),
    user_actions_retention_days: parseNumber(data.user_actions_retention_days, defaults.user_actions_retention_days),
    email_verification_retention_days: parseNumber(data.email_verification_retention_days, defaults.email_verification_retention_days),
  };
}

export const configService = {
  async getPublicConfig(): Promise<PublicConfig> {
    const now = Date.now();
    
    if (cachedConfig && (now - lastFetchTime) < CONFIG_CACHE_TTL) {
      return cachedConfig;
    }

    try {
      const response = await configApi.getPublicConfig();
      if (response.success && response.data) {
        cachedConfig = parseConfig(response.data);
        lastFetchTime = now;
        return cachedConfig;
      }
    } catch (error) {
      console.error('Failed to fetch public config:', error);
      if (cachedConfig) {
        return cachedConfig;
      }
    }

    return getDefaultConfig();
  },

  async getConfigValue<K extends keyof PublicConfig>(key: K): Promise<PublicConfig[K]> {
    const config = await this.getPublicConfig();
    return config[key];
  },

  clearCache(): void {
    cachedConfig = null;
    lastFetchTime = 0;
    try {
      localStorage.removeItem(CONFIG_CACHE_KEY);
    } catch (e) {
      // ignore
    }
  },

  getDefaultConfig,
};
