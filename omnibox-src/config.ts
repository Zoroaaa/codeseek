// 配置与常量模块
// OmniBox 代理 Worker 的集中化配置

export interface CacheTTLConfig {
  HTML: number;
  CSS: number;
  JS: number;
  IMAGE: number;
  FONT: number;
  JSON: number;
  DEFAULT: number;
}

export interface PerformanceConfig {
  MAX_REDIRECT_DEPTH: number;
  REQUEST_TIMEOUT: number;
  STREAM_READ_TIMEOUT: number;
  MAX_RESPONSE_SIZE: number;
  MAX_TEXT_PROCESS_SIZE: number;
  CONCURRENT_REQUESTS_LIMIT: number;
  PRELOAD_URLS: string[];
}

export interface HeadersConfig {
  REMOVE_HEADERS: string[];
  ADD_HEADERS: Record<string, string>;
  CORS_HEADERS: Record<string, string>;
}

export interface AppConfig {
  VERSION: string;
  NAME: string;
  URL_SEPARATOR: string;
  DEFAULT_PASSWORD: string;
  PASSWORD_COOKIE_NAME: string;
  LAST_VISIT_COOKIE_NAME: string;
  PROXY_HINT_COOKIE_NAME: string;
  CACHE_PREFIX: string;
  MAX_CACHE_SIZE: number;
  CACHE_TTL: CacheTTLConfig;
  REPLACE_URL_OBJ: string;
  HTML_INJECT_FUNC_NAME: string;
  PROXY_HINT_DELAY: number;
  DEBUG_MODE: string;
  CORS_MAX_AGE: number;
  ROBOTS_TXT: string;
  CRAWLER_BLOCK_MESSAGE: string;
  PERFORMANCE: PerformanceConfig;
  HEADERS: HeadersConfig;
}

export interface EnvVariables {
  ENVIRONMENT?: string;
  PROXY_PASSWORD?: string;
  MAX_CACHE_SIZE?: string;
  KV_CACHE?: KVNamespace;
  DEBUG?: string;
  LOG_LEVEL?: string;
  SHOW_PASSWORD_PAGE?: string;
  BLOCKED_UA_PATTERNS?: string;
  CACHE_HTML_TTL?: string;
  CACHE_CSS_TTL?: string;
  CACHE_JS_TTL?: string;
  CACHE_IMAGE_TTL?: string;
  CACHE_FONT_TTL?: string;
  CACHE_JSON_TTL?: string;
  CACHE_DEFAULT_TTL?: string;
}

export const CONFIG: AppConfig = {
  VERSION: '1.0.0',
  NAME: 'OmniBox Proxy Worker',

  URL_SEPARATOR: '/',
  DEFAULT_PASSWORD: '',

  PASSWORD_COOKIE_NAME: '__OMNIBOX_PWD__',
  LAST_VISIT_COOKIE_NAME: '__OMNIBOX_VISITEDSITE__',
  PROXY_HINT_COOKIE_NAME: '__OMNIBOX_HINT__',

  CACHE_PREFIX: 'omnibox-proxy-cache-v1.0',
  MAX_CACHE_SIZE: 1024 * 1024,

  CACHE_TTL: {
    HTML: 3600,
    CSS: 86400,
    JS: 86400,
    IMAGE: 2592000,
    FONT: 2592000,
    JSON: 1800,
    DEFAULT: 3600
  },

  REPLACE_URL_OBJ: '__location__omnibox__',
  HTML_INJECT_FUNC_NAME: 'parseAndInsertDoc',
  PROXY_HINT_DELAY: 5000,
  DEBUG_MODE: 'DEBUG_OMNIBOX_MODE',

  CORS_MAX_AGE: 86400,

  ROBOTS_TXT: `User-Agent: *
Disallow: /
Crawl-delay: 10

# OmniBox Proxy Worker - Not for crawling
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

  PERFORMANCE: {
    MAX_REDIRECT_DEPTH: 5,
    REQUEST_TIMEOUT: 15000,  // 请求超时（毫秒）
    STREAM_READ_TIMEOUT: 10000,  // 流式读取超时（毫秒）
    MAX_RESPONSE_SIZE: 50 * 1024 * 1024,  // 最大响应体大小（50MB）
    MAX_TEXT_PROCESS_SIZE: 5 * 1024 * 1024,  // 文本处理最大大小（5MB）
    CONCURRENT_REQUESTS_LIMIT: 10,
    PRELOAD_URLS: []
  },

  HEADERS: {
    REMOVE_HEADERS: [
      'Content-Security-Policy',
      'Content-Security-Policy-Report-Only',
      'Permissions-Policy',
      'Cross-Origin-Embedder-Policy',
      'Cross-Origin-Resource-Policy',
      'X-Frame-Options',
      'Strict-Transport-Security'
    ],

    ADD_HEADERS: {
      'X-OmniBox-Proxy': '1.0.0',
      'X-Proxy-Service': 'OmniBox Proxy Worker',
      'X-Content-Type-Options': 'nosniff'
    },

    CORS_HEADERS: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Expose-Headers': '*'
    }
  }
};
