import { configApi } from '@/services/api/system';

export interface PublicConfig {
  appVersion: string;
  allowRegistration: boolean;
}

const CONFIG_CACHE_KEY = 'app_config_cache';
const CONFIG_CACHE_TTL = 5 * 60 * 1000;

let cachedConfig: PublicConfig | null = null;
let lastFetchTime = 0;

function getDefaultConfig(): PublicConfig {
  return {
    appVersion: '2.0.0',
    allowRegistration: true,
  };
}

function parseConfig(data: Record<string, unknown>): PublicConfig {
  const defaults = getDefaultConfig();
  
  return {
    appVersion: String(data.appVersion ?? defaults.appVersion),
    allowRegistration: data.allowRegistration === true || data.allowRegistration === 1 || data.allowRegistration === '1' || data.allowRegistration === 'true',
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
