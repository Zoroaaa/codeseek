// 应用常量定义
export const APP_CONSTANTS = {
  // 应用信息
  APP: {
    NAME: '磁力快搜',
    VERSION: '1.1.0',
    DESCRIPTION: '专业的磁力搜索工具，支持云端同步，智能搜索'
  },

  // API配置
  API: {
    TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3,
    CACHE_DURATION: 1800000, // 30分钟
    ENDPOINTS: {
      HEALTH: '/api/health',
      CONFIG: '/api/config',
      AUTH: {
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        LOGOUT: '/api/auth/logout',
        VERIFY: '/api/auth/verify-token',
        CHANGE_PASSWORD: '/api/auth/change-password',
        DELETE_ACCOUNT: '/api/auth/delete-account'
      },
      USER: {
        FAVORITES: '/api/user/favorites',
        SEARCH_HISTORY: '/api/user/search-history',
        SETTINGS: '/api/user/settings',
        STATS: '/api/user/search-stats',
        ANALYTICS: '/api/user/analytics'
      },
      ACTIONS: {
        RECORD: '/api/actions/record'
      }
    }
  },

  // 存储配置
  STORAGE: {
    KEYS: {
      AUTH_TOKEN: 'auth_token',
      THEME: 'theme',
      APP_VERSION: 'app_version',
      API_CONFIG: 'api_config'
    },
    ALLOWED_SYSTEM_KEYS: ['theme', 'app_version', 'auth_token', 'api_config']
  },

  // UI配置
  UI: {
    TOAST_DURATION: 3000,
    LOADING_MIN_DURATION: 100,
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 1000,
    MODAL_ANIMATION_DURATION: 300
  },

  // 搜索配置
  SEARCH: {
    MIN_KEYWORD_LENGTH: 2,
    MAX_KEYWORD_LENGTH: 100,
    MAX_SUGGESTIONS: 5,
    SOURCES: {
      JAVBUS: { name: 'JavBus', icon: '🎬', baseUrl: 'https://www.javbus.com' },
      JAVDB: { name: 'JavDB', icon: '📚', baseUrl: 'https://javdb.com' },
      JAVLIBRARY: { name: 'JavLibrary', icon: '📖', baseUrl: 'https://www.javlibrary.com' },
      AV01: { name: 'AV01', icon: '🎥', baseUrl: 'https://av01.tv' },
      MISSAV: { name: 'MissAV', icon: '💫', baseUrl: 'https://missav.com' },
      BTSOW: { name: 'btsow', icon: '🧲', baseUrl: 'https://btsow.com' }
    }
  },

  // 用户限制
  LIMITS: {
    MAX_FAVORITES: 1000,
    MAX_HISTORY: 1000,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 20,
    MIN_PASSWORD_LENGTH: 6,
    MAX_PASSWORD_LENGTH: 50
  },

  // 网络配置
  NETWORK: {
    CONNECTION_CHECK_INTERVAL: 60000, // 1分钟
    OFFLINE_RETRY_DELAY: 5000,
    MAX_SYNC_RETRIES: 3
  },

  // 主题配置
  THEMES: {
    LIGHT: 'light',
    DARK: 'dark',
    AUTO: 'auto'
  }
};

// 权限常量
export const PERMISSIONS = {
  SEARCH: 'search',
  FAVORITE: 'favorite', 
  HISTORY: 'history',
  SYNC: 'sync',
  ADMIN: 'admin',
  PREMIUM: 'premium'
};

// 错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

// 事件名称
export const EVENT_NAMES = {
  AUTH_STATE_CHANGED: 'authStateChanged',
  THEME_CHANGED: 'themeChanged',
  NETWORK_STATE_CHANGED: 'networkStateChanged',
  DATA_SYNCED: 'dataSynced'
};