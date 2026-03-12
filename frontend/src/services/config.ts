import { configApi } from '@/services/api/system';

export interface PublicConfig {
  appVersion: string;
  allowRegistration: boolean;
  minUsernameLength: number;
  maxUsernameLength: number;
  minPasswordLength: number;
  maxFavoritesPerUser: number;
  maxHistoryPerUser: number;
  maxTagsPerUser: number;
  features: {
    searchHistory: boolean;
    favorites: boolean;
    analytics: boolean;
    darkMode: boolean;
    proxy: boolean;
    searchSuggestions: boolean;
  };
  search: {
    debounceMs: number;
    maxKeywordLength: number;
    suggestionsMinKeywordLength: number;
  };
}

const CONFIG_CACHE_KEY = 'app_config_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

let cachedConfig: PublicConfig | null = null;
let lastFetchTime = 0;

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
    appVersion: '2.0.0',
    allowRegistration: true,
    minUsernameLength: 3,
    maxUsernameLength: 20,
    minPasswordLength: 6,
    maxFavoritesPerUser: 1000,
    maxHistoryPerUser: 1000,
    maxTagsPerUser: 10,
    features: {
      searchHistory: true,
      favorites: true,
      analytics: true,
      darkMode: true,
      proxy: true,
      searchSuggestions: true,
    },
    search: {
      debounceMs: 300,
      maxKeywordLength: 200,
      suggestionsMinKeywordLength: 2,
    },
  };
}

function parseConfig(data: Record<string, unknown>): PublicConfig {
  const defaults = getDefaultConfig();
  
  return {
    appVersion: String(data.appVersion ?? defaults.appVersion),
    allowRegistration: parseBoolean(data.allowRegistration, defaults.allowRegistration),
    minUsernameLength: parseNumber(data.minUsernameLength, defaults.minUsernameLength),
    maxUsernameLength: parseNumber(data.maxUsernameLength, defaults.maxUsernameLength),
    minPasswordLength: parseNumber(data.minPasswordLength, defaults.minPasswordLength),
    maxFavoritesPerUser: parseNumber(data.maxFavoritesPerUser, defaults.maxFavoritesPerUser),
    maxHistoryPerUser: parseNumber(data.maxHistoryPerUser, defaults.maxHistoryPerUser),
    maxTagsPerUser: parseNumber(data.maxTagsPerUser, defaults.maxTagsPerUser),
    features: {
      searchHistory: parseBoolean((data.features as Record<string, unknown>)?.searchHistory, defaults.features.searchHistory),
      favorites: parseBoolean((data.features as Record<string, unknown>)?.favorites, defaults.features.favorites),
      analytics: parseBoolean((data.features as Record<string, unknown>)?.analytics, defaults.features.analytics),
      darkMode: parseBoolean((data.features as Record<string, unknown>)?.darkMode, defaults.features.darkMode),
      proxy: parseBoolean((data.features as Record<string, unknown>)?.proxy, defaults.features.proxy),
      searchSuggestions: parseBoolean((data.features as Record<string, unknown>)?.searchSuggestions, defaults.features.searchSuggestions),
    },
    search: {
      debounceMs: parseNumber((data.search as Record<string, unknown>)?.debounceMs, defaults.search.debounceMs),
      maxKeywordLength: parseNumber((data.search as Record<string, unknown>)?.maxKeywordLength, defaults.search.maxKeywordLength),
      suggestionsMinKeywordLength: parseNumber((data.search as Record<string, unknown>)?.suggestionsMinKeywordLength, defaults.search.suggestionsMinKeywordLength),
    },
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
    } catch (_e) {
      // ignore
    }
  },

  getDefaultConfig,
};
