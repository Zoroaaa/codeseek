import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { configService, PublicConfig } from '@/services/config';
import { VALIDATION_REGEX, VERIFICATION_CODE_LENGTH } from '@/constants';

interface ConfigContextType {
  config: PublicConfig | null;
  isLoading: boolean;
  error: Error | null;
  refreshConfig: () => Promise<void>;
  getConfigValue: <K extends keyof PublicConfig>(key: K) => PublicConfig[K] | undefined;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

interface ConfigProviderProps {
  children: ReactNode;
}

export function ConfigProvider({ children }: ConfigProviderProps) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedConfig = await configService.getPublicConfig();
      setConfig(fetchedConfig);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load config'));
      setConfig(configService.getDefaultConfig());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const refreshConfig = useCallback(async () => {
    configService.clearCache();
    await loadConfig();
  }, [loadConfig]);

  const getConfigValue = useCallback(<K extends keyof PublicConfig>(key: K): PublicConfig[K] | undefined => {
    if (config) {
      return config[key];
    }
    const defaults = configService.getDefaultConfig();
    return defaults[key];
  }, [config]);

  const value: ConfigContextType = {
    config,
    isLoading,
    error,
    refreshConfig,
    getConfigValue,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig(): ConfigContextType {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
}

export function useConfigValue<K extends keyof PublicConfig>(key: K): PublicConfig[K] | undefined {
  const { config } = useConfig();
  if (config) {
    return config[key];
  }
  return configService.getDefaultConfig()[key];
}

export function useValidationRules() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    PASSWORD_MIN_LENGTH: config?.min_password_length ?? defaults.min_password_length,
    PASSWORD_MAX_LENGTH: config?.max_password_length ?? defaults.max_password_length,
    USERNAME_MIN_LENGTH: config?.min_username_length ?? defaults.min_username_length,
    USERNAME_MAX_LENGTH: config?.max_username_length ?? defaults.max_username_length,
    EMAIL_MAX_LENGTH: 255,
    SEARCH_KEYWORD_MIN_LENGTH: 2,
    SEARCH_KEYWORD_MAX_LENGTH: config?.max_keyword_length ?? defaults.max_keyword_length,
    VERIFICATION_CODE_LENGTH: VERIFICATION_CODE_LENGTH,
    USERNAME_REGEX: VALIDATION_REGEX.USERNAME,
    EMAIL_REGEX: VALIDATION_REGEX.EMAIL,
    MAX_TAGS_PER_USER: config?.max_tags_per_user ?? defaults.max_tags_per_user,
    MAX_BATCH_CONFIG_UPDATE: config?.max_batch_config_update ?? defaults.max_batch_config_update,
    MAX_SYNC_FAVORITES: config?.max_sync_favorites ?? defaults.max_sync_favorites,
    MAX_COMMENT_LENGTH: config?.max_comment_length ?? defaults.max_comment_length,
    MAX_REPORT_REASON_LENGTH: config?.max_report_reason_length ?? defaults.max_report_reason_length,
    MAX_REPORT_DETAILS_LENGTH: config?.max_report_details_length ?? defaults.max_report_details_length,
    TAG_NAME_MIN_LENGTH: config?.tag_name_min_length ?? defaults.tag_name_min_length,
    TAG_NAME_MAX_LENGTH: config?.tag_name_max_length ?? defaults.tag_name_max_length,
    SOURCE_NAME_MAX_LENGTH: config?.source_name_max_length ?? defaults.source_name_max_length,
    SOURCE_DESCRIPTION_MAX_LENGTH: config?.source_description_max_length ?? defaults.source_description_max_length,
  };
}

export function useAppInfo() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    NAME: config?.site_name ?? defaults.site_name,
    DESCRIPTION: config?.site_description ?? defaults.site_description,
    WELCOME_MESSAGE: `欢迎加入${config?.site_name ?? defaults.site_name}`,
    VERSION: '2.0.0',
  };
}

export function useFeatureFlags() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    enableRegistration: config?.enable_registration ?? defaults.enable_registration,
    enableSearchHistory: config?.enable_search_history ?? defaults.enable_search_history,
    enableFavorites: config?.enable_favorites ?? defaults.enable_favorites,
    enableAnalytics: config?.enable_analytics ?? defaults.enable_analytics,
    enableDarkMode: config?.enable_dark_mode ?? defaults.enable_dark_mode,
    enableProxy: config?.enable_proxy ?? defaults.enable_proxy,
    enableSearchSuggestions: config?.enable_search_suggestions ?? defaults.enable_search_suggestions,
    communityEnabled: config?.community_enabled ?? defaults.community_enabled,
    emailVerificationEnabled: config?.email_verification_enabled ?? defaults.email_verification_enabled,
    forgotPasswordEnabled: config?.forgot_password_enabled ?? defaults.forgot_password_enabled,
    sourceCheckEnabled: config?.source_check_enabled ?? defaults.source_check_enabled,
  };
}

export function useUserLimits() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    maxSearchHistory: config?.max_search_history ?? defaults.max_search_history,
    maxFavorites: config?.max_favorites ?? defaults.max_favorites,
    maxSharesPerUser: config?.community_max_shares_per_user ?? defaults.community_max_shares_per_user,
    maxTagsPerUser: config?.max_tags_per_user ?? defaults.max_tags_per_user,
    maxTagsPerSource: config?.max_tags_per_source ?? defaults.max_tags_per_source,
    maxSessionsPerUser: config?.max_sessions_per_user ?? defaults.max_sessions_per_user,
  };
}

export function useSearchConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    defaultSearchSources: config?.default_search_sources ?? defaults.default_search_sources,
    searchDebounceMs: config?.search_debounce_ms ?? defaults.search_debounce_ms,
    enableSearchSuggestions: config?.enable_search_suggestions ?? defaults.enable_search_suggestions,
    trendingSearchesHours: config?.trending_searches_hours ?? defaults.trending_searches_hours,
    maxKeywordLength: config?.max_keyword_length ?? defaults.max_keyword_length,
    maxSourcesPerSearch: config?.max_sources_per_search ?? defaults.max_sources_per_search,
    suggestionsMinKeywordLength: config?.suggestions_min_keyword_length ?? defaults.suggestions_min_keyword_length,
    suggestionsMaxLimit: config?.suggestions_max_limit ?? defaults.suggestions_max_limit,
    trendingMaxHours: config?.trending_max_hours ?? defaults.trending_max_hours,
    trendingDefaultLimit: config?.trending_default_limit ?? defaults.trending_default_limit,
    trendingMaxLimit: config?.trending_max_limit ?? defaults.trending_max_limit,
  };
}

export function useSecurityConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    maxLoginAttempts: config?.max_login_attempts ?? defaults.max_login_attempts,
    lockoutDurationMs: config?.lockout_duration_ms ?? defaults.lockout_duration_ms,
    sessionTimeoutMinutes: config?.session_timeout_minutes ?? defaults.session_timeout_minutes,
    rememberMeDays: config?.remember_me_days ?? defaults.remember_me_days,
    securityMonitoringEnabled: config?.security_monitoring_enabled ?? defaults.security_monitoring_enabled,
    securityEventRetentionDays: config?.security_event_retention_days ?? defaults.security_event_retention_days,
  };
}

export function useEmailConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    verificationCodeLength: VERIFICATION_CODE_LENGTH,
    verificationCodeExpiry: config?.verification_code_expiry ?? defaults.verification_code_expiry,
    resendIntervalMs: config?.resend_interval_ms ?? defaults.resend_interval_ms,
    emailVerificationEnabled: config?.email_verification_enabled ?? defaults.email_verification_enabled,
    emailVerificationRequired: config?.email_verification_required ?? defaults.email_verification_required,
    forgotPasswordEnabled: config?.forgot_password_enabled ?? defaults.forgot_password_enabled,
    resetPasswordCodeExpiry: config?.reset_password_code_expiry ?? defaults.reset_password_code_expiry,
  };
}

export function usePaginationConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    defaultPageSize: config?.default_page_size ?? defaults.default_page_size,
    maxPageSize: config?.max_page_size ?? defaults.max_page_size,
    maxLogPageSize: config?.max_log_page_size ?? defaults.max_log_page_size,
    defaultHistoryLimit: config?.default_history_limit ?? defaults.default_history_limit,
    maxHistoryLimit: config?.max_history_limit ?? defaults.max_history_limit,
  };
}

export function useCleanupConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    passwordResetLogRetentionDays: config?.password_reset_log_retention_days ?? defaults.password_reset_log_retention_days,
    userActionsRetentionDays: config?.user_actions_retention_days ?? defaults.user_actions_retention_days,
    emailVerificationRetentionDays: config?.email_verification_retention_days ?? defaults.email_verification_retention_days,
  };
}

export function useSourceCheckConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    sourceCheckEnabled: config?.source_check_enabled ?? defaults.source_check_enabled,
    maxConcurrentChecks: config?.max_concurrent_checks ?? defaults.max_concurrent_checks,
    defaultCheckTimeout: config?.default_check_timeout ?? defaults.default_check_timeout,
    cacheDurationMs: config?.cache_duration_ms ?? defaults.cache_duration_ms,
  };
}

export function useCommunityConfig() {
  const { config } = useConfig();
  const defaults = configService.getDefaultConfig();
  
  return {
    communityEnabled: config?.community_enabled ?? defaults.community_enabled,
    requireApproval: config?.community_require_approval ?? defaults.community_require_approval,
    maxSharesPerUser: config?.community_max_shares_per_user ?? defaults.community_max_shares_per_user,
    maxTagsPerSource: config?.max_tags_per_source ?? defaults.max_tags_per_source,
    maxCommentLength: config?.max_comment_length ?? defaults.max_comment_length,
    maxReportReasonLength: config?.max_report_reason_length ?? defaults.max_report_reason_length,
    maxReportDetailsLength: config?.max_report_details_length ?? defaults.max_report_details_length,
    tagNameMinLength: config?.tag_name_min_length ?? defaults.tag_name_min_length,
    tagNameMaxLength: config?.tag_name_max_length ?? defaults.tag_name_max_length,
    sourceNameMaxLength: config?.source_name_max_length ?? defaults.source_name_max_length,
    sourceDescriptionMaxLength: config?.source_description_max_length ?? defaults.source_description_max_length,
  };
}
