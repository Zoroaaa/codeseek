/**
 * 配置服务
 * 功能：从数据库加载配置，提供缓存机制，替代硬编码常量
 * 作者：CodeSeek Team
 * 日期：2024
 */
import { Env } from '../types';

interface ConfigCache {
  data: Record<string, string>;
  loadedAt: number;
}

let configCache: ConfigCache | null = null;
const CACHE_TTL = 60000;

export class ConfigService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private async loadConfig(): Promise<Record<string, string>> {
    const now = Date.now();
    
    if (configCache && (now - configCache.loadedAt) < CACHE_TTL) {
      return configCache.data;
    }

    try {
      const results = await this.env.DB.prepare(
        'SELECT key, value FROM system_config'
      ).all<{ key: string; value: string }>();

      const data: Record<string, string> = {};
      for (const row of results.results || []) {
        data[row.key] = row.value;
      }

      configCache = { data, loadedAt: now };
      return data;
    } catch (error) {
      console.error('Load config error:', error);
      return configCache?.data || {};
    }
  }

  async get(key: string, defaultValue: string): Promise<string> {
    const config = await this.loadConfig();
    return config[key] ?? defaultValue;
  }

  async getInt(key: string, defaultValue: number): Promise<number> {
    const value = await this.get(key, String(defaultValue));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async getFloat(key: string, defaultValue: number): Promise<number> {
    const value = await this.get(key, String(defaultValue));
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async getBoolean(key: string, defaultValue: boolean): Promise<boolean> {
    const value = await this.get(key, defaultValue ? '1' : '0');
    return value === '1' || value === 'true';
  }

  async getJson<T>(key: string, defaultValue: T): Promise<T> {
    const value = await this.get(key, '');
    if (!value) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  static clearCache(): void {
    configCache = null;
  }

  async getAll(): Promise<Record<string, string>> {
    return this.loadConfig();
  }

  async getGroup(groupName: string): Promise<Record<string, string>> {
    try {
      const results = await this.env.DB.prepare(
        'SELECT key, value FROM system_config WHERE config_group = ?'
      ).bind(groupName).all<{ key: string; value: string }>();

      const data: Record<string, string> = {};
      for (const row of results.results || []) {
        data[row.key] = row.value;
      }
      return data;
    } catch (error) {
      console.error('Get config group error:', error);
      return {};
    }
  }
}

export async function getConfigService(env: Env): Promise<ConfigService> {
  return new ConfigService(env);
}

export const CONFIG_DEFAULTS = {
  get VALIDATION() {
    return {
      USERNAME_MIN_LENGTH: 3,
      USERNAME_MAX_LENGTH: 20,
      PASSWORD_MIN_LENGTH: 6,
      PASSWORD_MAX_LENGTH: 100,
      VERIFICATION_CODE_LENGTH: 6,
      MAX_BATCH_CONFIG_UPDATE: 100,
      MAX_SYNC_FAVORITES: 1000,
    };
  },
  get SECURITY() {
    return {
      MAX_LOGIN_ATTEMPTS: 5,
      MAX_VERIFICATION_ATTEMPTS: 3,
      MAX_PASSWORD_RESET_ATTEMPTS: 5,
      LOCKOUT_DURATION_MS: 15 * 60 * 1000,
      PASSWORD_RESET_LOCKOUT_MS: 60 * 60 * 1000,
      SUSPICIOUS_ACTIVITY_THRESHOLD: 50,
      RECENT_FAILED_LOGINS_THRESHOLD: 3,
      RECENT_IP_LOGINS_THRESHOLD: 3,
      RECENT_PASSWORD_CHANGES_THRESHOLD: 2,
    };
  },
  get EMAIL() {
    return {
      VERIFICATION_CODE_EXPIRY_MS: 900000,
      VERIFICATION_CODE_LENGTH: 6,
      HOURLY_LIMIT: 5,
      DAILY_LIMIT: 20,
      RESEND_INTERVAL_MS: 60000,
      CHANGE_REQUEST_EXPIRY_MS: 1800000,
      CHANGE_PENDING_EXPIRY_MINUTES: 15,
    };
  },
  get SOURCE_STATUS() {
    return {
      CHECK_TIMEOUT_MS: 10000,
      BATCH_CHECK_TIMEOUT_MS: 5000,
      CACHE_DURATION_MS: 300000,
      MAX_BATCH_CHECK: 50,
      MAX_CACHE_AGE_MS: 300000,
    };
  },
  get USER_LIMITS() {
    return {
      MAX_TAGS_PER_USER: 50,
      MAX_SHARES_PER_USER: 50,
      MAX_FAVORITES: 1000,
      MAX_SEARCH_HISTORY: 1000,
      MAX_BATCH_CONFIG_UPDATE: 100,
      MAX_SYNC_FAVORITES: 1000,
    };
  },
  get SESSION() {
    return {
      TIMEOUT_MINUTES: 1440,
      MAX_SESSIONS_PER_USER: 5,
      REMEMBER_ME_DAYS: 30,
    };
  },
  get FEATURES() {
    return {
      ENABLE_REGISTRATION: true,
      ENABLE_SEARCH_HISTORY: true,
      ENABLE_FAVORITES: true,
      ENABLE_ANALYTICS: true,
      ENABLE_DARK_MODE: true,
      ENABLE_PROXY: true,
      ENABLE_SEARCH_SUGGESTIONS: true,
    };
  },
  get SEARCH() {
    return {
      DEFAULT_SEARCH_SOURCES: 20,
      SEARCH_DEBOUNCE_MS: 300,
      ENABLE_SEARCH_SUGGESTIONS: true,
      TRENDING_SEARCHES_HOURS: 24,
      MAX_KEYWORD_LENGTH: 200,
      MAX_SOURCES_PER_SEARCH: 50,
      SUGGESTIONS_MIN_KEYWORD_LENGTH: 2,
      SUGGESTIONS_MAX_LIMIT: 20,
      TRENDING_MAX_HOURS: 168,
      TRENDING_DEFAULT_LIMIT: 20,
      TRENDING_MAX_LIMIT: 50,
    };
  },
  get COMMUNITY() {
    return {
      ENABLED: true,
      REQUIRE_APPROVAL: false,
      MAX_SHARES_PER_USER: 50,
      MIN_RATING_TO_FEATURE: 4.0,
      MAX_TAGS_PER_SOURCE: 10,
      MAX_COMMENT_LENGTH: 1000,
      MAX_REPORT_REASON_LENGTH: 100,
      MAX_REPORT_DETAILS_LENGTH: 1000,
      TAG_NAME_MIN_LENGTH: 2,
      TAG_NAME_MAX_LENGTH: 20,
      SOURCE_NAME_MAX_LENGTH: 100,
      SOURCE_DESCRIPTION_MAX_LENGTH: 2000,
    };
  },
  get PAGINATION() {
    return {
      DEFAULT_PAGE_SIZE: 20,
      MAX_PAGE_SIZE: 100,
      MAX_LOG_PAGE_SIZE: 200,
      DEFAULT_HISTORY_LIMIT: 50,
      MAX_HISTORY_LIMIT: 200,
    };
  },
  get CLEANUP() {
    return {
      PASSWORD_RESET_LOG_RETENTION_DAYS: 30,
      USER_ACTIONS_RETENTION_DAYS: 90,
      EMAIL_VERIFICATION_RETENTION_DAYS: 7,
    };
  },
  get BASIC() {
    return {
      SITE_NAME: '磁力快搜',
      SITE_DESCRIPTION: '搜索全网资源，一步直达',
    };
  },
};
