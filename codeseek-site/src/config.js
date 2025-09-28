// Configuration and Constants Module
// Centralized configuration for Enhanced Proxy Worker

export const CONFIG = {
  // Version and branding
  VERSION: "2.0.0",
  NAME: "Enhanced Proxy Worker",
  
  // Basic proxy settings
  URL_SEPARATOR: "/",
  DEFAULT_PASSWORD: "zoro666", // Read from env PROXY_PASSWORD in production
  
  // Cookie names
  PASSWORD_COOKIE_NAME: "__PROXY_PWD__",
  LAST_VISIT_COOKIE_NAME: "__PROXY_VISITEDSITE__",
  PROXY_HINT_COOKIE_NAME: "__PROXY_HINT__",
  
  // Cache settings
  CACHE_PREFIX: "enhanced-proxy-cache-v2.0",
  MAX_CACHE_SIZE: 1024 * 1024, // 1MB max cache size per item
  
  // Cache TTL settings (in seconds)
  CACHE_TTL: {
    HTML: 3600,        // 1 hour
    CSS: 86400,        // 1 day
    JS: 86400,         // 1 day
    IMAGE: 2592000,    // 30 days
    FONT: 2592000,     // 30 days
    JSON: 1800,        // 30 minutes
    DEFAULT: 3600      // 1 hour
  },
  
  // Content modification settings
  REPLACE_URL_OBJ: "__location__yproxy__",
  HTML_INJECT_FUNC_NAME: "parseAndInsertDoc",
  PROXY_HINT_DELAY: 5000, // 5 seconds
  DEBUG_MODE: "DEBUG_PROXY_MODE",
  
  // Security settings
  CORS_MAX_AGE: 86400, // 24 hours
  
  // Content filtering
  BLOCKED_EXTENSIONS: [
    '.exe', '.bat', '.cmd', '.scr', '.pif', '.com',
    '.msi', '.msp', '.gadget', '.jar', '.app', '.deb', '.rpm'
  ],
  
  // User agent blocking
  BLOCKED_USER_AGENTS: [
    'Bytespider',
    'bingbot',
    'Googlebot',
    'facebookexternalhit'
  ],
  
  // Rate limiting (requests per minute)
  RATE_LIMIT: {
    REQUESTS_PER_MINUTE: 60,
    WINDOW_SIZE: 60000 // 1 minute in milliseconds
  },
  
  // Content types for proper handling
  CONTENT_TYPES: {
    HTML: ['text/html', 'application/xhtml+xml'],
    CSS: ['text/css'],
    JS: ['application/javascript', 'application/x-javascript', 'text/javascript'],
    JSON: ['application/json', 'text/json'],
    XML: ['application/xml', 'text/xml'],
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    FONTS: ['font/woff', 'font/woff2', 'font/ttf', 'font/otf', 'application/font-woff']
  },
  
  // URL patterns to handle specially
  URL_PATTERNS: {
    // Domains that require special handling
    SPECIAL_DOMAINS: [
      'google.com',
      'youtube.com',
      'facebook.com',
      'twitter.com'
    ],
    
    // URLs that should not be proxied
    BYPASS_URLS: [
      '/favicon.ico',
      '/robots.txt',
      '/sitemap.xml',
      '/.well-known/'
    ]
  },
  
  // Error messages
  ERROR_MESSAGES: {
    INVALID_URL: "Invalid URL format. Please enter a valid website address.",
    ACCESS_DENIED: "Access denied. Please check your credentials.",
    RATE_LIMITED: "Too many requests. Please wait before trying again.",
    PROXY_ERROR: "Proxy service error. Please try again later.",
    CACHE_ERROR: "Cache service error.",
    NETWORK_ERROR: "Network connection error. Please check your internet connection."
  },
  
  // Default responses
  ROBOTS_TXT: `User-Agent: *
Disallow: /
Crawl-delay: 10

# Enhanced Proxy Worker - Not for crawling
# This is a proxy service, not content to be indexed`,

  CRAWLER_BLOCK_MESSAGE: `
<html>
<head><title>Access Restricted</title></head>
<body>
  <h1>Access Restricted</h1>
  <p>This proxy service is not available for automated crawling.</p>
  <p>Please use standard browsing methods to access content.</p>
</body>
</html>`,

  // Feature flags
  FEATURES: {
    ENABLE_CACHE: true,
    ENABLE_COMPRESSION: true,
    ENABLE_RATE_LIMITING: true,
    ENABLE_USER_AGENT_BLOCKING: true,
    ENABLE_CONTENT_FILTERING: true,
    ENABLE_ANALYTICS: false,
    ENABLE_DEBUG_LOGGING: false
  },
  
  // Performance settings
  PERFORMANCE: {
    MAX_REDIRECT_DEPTH: 5,
    REQUEST_TIMEOUT: 30000, // 30 seconds
    MAX_RESPONSE_SIZE: 50 * 1024 * 1024, // 50MB
    CONCURRENT_REQUESTS_LIMIT: 10
  },
  
  // Header modifications
  HEADERS: {
    // Headers to remove from proxied responses
    REMOVE_HEADERS: [
      'Content-Security-Policy',
      'Content-Security-Policy-Report-Only',
      'Permissions-Policy',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Resource-Policy',
      'X-Frame-Options',
      'Strict-Transport-Security'
    ],
    
    // Headers to add to all responses
    ADD_HEADERS: {
      'X-Enhanced-Proxy': '2.0.0',
      'X-Proxy-Service': 'Cloudflare Worker Enhanced Proxy',
      'X-Content-Type-Options': 'nosniff'
    },
    
    // CORS headers
    CORS_HEADERS: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Expose-Headers': '*'
    }
  },
  
  // API endpoints
  API: {
    HEALTH_CHECK: ['/api/health', '/_health'],
    STATUS: '/api/status',
    CACHE_CLEAR: '/api/cache/clear',
    STATS: '/api/stats',
    CONFIG: '/api/config'
  },
  
  // Logging configuration
  LOGGING: {
    LEVELS: {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    },
    DEFAULT_LEVEL: 1 // WARN
  },
  
  // Environment-specific overrides
  ENV_OVERRIDES: {
    development: {
      FEATURES: {
        ENABLE_DEBUG_LOGGING: true,
        ENABLE_ANALYTICS: false
      },
      CACHE_TTL: {
        HTML: 60,     // 1 minute for development
        CSS: 300,     // 5 minutes
        JS: 300       // 5 minutes
      },
      LOGGING: {
        DEFAULT_LEVEL: 3 // DEBUG
      }
    },
    
    staging: {
      FEATURES: {
        ENABLE_DEBUG_LOGGING: true,
        ENABLE_ANALYTICS: true
      },
      LOGGING: {
        DEFAULT_LEVEL: 2 // INFO
      }
    },
    
    production: {
      FEATURES: {
        ENABLE_DEBUG_LOGGING: false,
        ENABLE_ANALYTICS: true
      },
      LOGGING: {
        DEFAULT_LEVEL: 1 // WARN
      }
    }
  }
};

/**
 * Get environment-specific configuration
 * @param {Object} env - Environment variables
 * @returns {Object} Merged configuration
 */
export function getConfig(env = {}) {
  const environment = env.ENVIRONMENT || 'production';
  const envOverrides = CONFIG.ENV_OVERRIDES[environment] || {};
  
  // Deep merge configuration with environment overrides
  const mergedConfig = JSON.parse(JSON.stringify(CONFIG));
  
  if (envOverrides.FEATURES) {
    Object.assign(mergedConfig.FEATURES, envOverrides.FEATURES);
  }
  
  if (envOverrides.CACHE_TTL) {
    Object.assign(mergedConfig.CACHE_TTL, envOverrides.CACHE_TTL);
  }
  
  if (envOverrides.LOGGING) {
    Object.assign(mergedConfig.LOGGING, envOverrides.LOGGING);
  }
  
  // Override with environment variables
  if (env.PROXY_PASSWORD) {
    mergedConfig.DEFAULT_PASSWORD = env.PROXY_PASSWORD;
  }
  
  if (env.MAX_CACHE_SIZE) {
    mergedConfig.MAX_CACHE_SIZE = parseInt(env.MAX_CACHE_SIZE);
  }
  
  if (env.ENABLE_DEBUG === 'true') {
    mergedConfig.FEATURES.ENABLE_DEBUG_LOGGING = true;
    mergedConfig.LOGGING.DEFAULT_LEVEL = 3;
  }
  
  return mergedConfig;
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateConfig(config) {
  const errors = [];
  
  if (!config.VERSION) {
    errors.push('VERSION is required');
  }
  
  if (!config.CACHE_PREFIX) {
    errors.push('CACHE_PREFIX is required');
  }
  
  if (typeof config.MAX_CACHE_SIZE !== 'number' || config.MAX_CACHE_SIZE <= 0) {
    errors.push('MAX_CACHE_SIZE must be a positive number');
  }
  
  if (!config.CACHE_TTL || typeof config.CACHE_TTL !== 'object') {
    errors.push('CACHE_TTL must be an object');
  }
  
  return errors;
}

/**
 * Get feature flag value
 * @param {string} feature - Feature flag name
 * @param {Object} config - Configuration object
 * @returns {boolean} Feature flag value
 */
export function getFeatureFlag(feature, config = CONFIG) {
  return config.FEATURES[feature] || false;
}

/**
 * Check if URL should be bypassed (not proxied)
 * @param {string} pathname - URL pathname
 * @returns {boolean} Whether URL should be bypassed
 */
export function shouldBypassUrl(pathname) {
  return CONFIG.URL_PATTERNS.BYPASS_URLS.some(pattern => 
    pathname.startsWith(pattern)
  );
}

/**
 * Check if domain requires special handling
 * @param {string} hostname - Domain hostname
 * @returns {boolean} Whether domain requires special handling
 */
export function requiresSpecialHandling(hostname) {
  return CONFIG.URL_PATTERNS.SPECIAL_DOMAINS.some(domain => 
    hostname.includes(domain)
  );
}

/**
 * Get cache TTL for content type
 * @param {string} contentType - Content type
 * @param {Object} config - Configuration object
 * @returns {number} TTL in seconds
 */
export function getCacheTTL(contentType, config = CONFIG) {
  if (!contentType) return config.CACHE_TTL.DEFAULT;
  
  const type = contentType.toLowerCase();
  
  if (config.CONTENT_TYPES.HTML.some(t => type.includes(t))) {
    return config.CACHE_TTL.HTML;
  }
  if (config.CONTENT_TYPES.CSS.some(t => type.includes(t))) {
    return config.CACHE_TTL.CSS;
  }
  if (config.CONTENT_TYPES.JS.some(t => type.includes(t))) {
    return config.CACHE_TTL.JS;
  }
  if (config.CONTENT_TYPES.JSON.some(t => type.includes(t))) {
    return config.CACHE_TTL.JSON;
  }
  if (config.CONTENT_TYPES.IMAGES.some(t => type.includes(t))) {
    return config.CACHE_TTL.IMAGE;
  }
  if (config.CONTENT_TYPES.FONTS.some(t => type.includes(t))) {
    return config.CACHE_TTL.FONT;
  }
  
  return config.CACHE_TTL.DEFAULT;
}