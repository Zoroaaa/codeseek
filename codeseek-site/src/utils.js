// Utility Functions Module
// Common helper functions used across the proxy worker

import { CONFIG } from './config.js';

/**
 * Get unrestricted CORS headers
 * @returns {Object} CORS headers object
 */
export function getUnrestrictedCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': CONFIG.CORS_MAX_AGE.toString(),
    'Access-Control-Expose-Headers': '*',
    'X-Enhanced-Proxy-Version': CONFIG.VERSION,
    ...CONFIG.HEADERS.ADD_HEADERS
  };
}

/**
 * Extract cookie value from cookie string
 * @param {string} cookieName - Name of the cookie to extract
 * @param {string} cookies - Cookie string from request headers
 * @returns {string} Cookie value or empty string
 */
export function getCookie(cookieName, cookies) {
  if (!cookies || !cookieName) return "";
  
  try {
    const cookieRegex = new RegExp(cookieName + "=([^;]+)");
    const match = cookieRegex.exec(cookies);
    return match ? decodeURIComponent(match[1]) : "";
  } catch (error) {
    console.error('Cookie extraction error:', error);
    return "";
  }
}

/**
 * Create HTML response with proper headers
 * @param {string} html - HTML content
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Response} Response object
 */
export function getHTMLResponse(html, status = 200, additionalHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...getUnrestrictedCorsHeaders(),
      ...additionalHeaders
    }
  });
}

/**
 * Create redirect response
 * @param {string} url - URL to redirect to
 * @param {number} status - Redirect status code (301, 302, etc.)
 * @returns {Response} Redirect response
 */
export function getRedirect(url, status = 302) {
  return Response.redirect(url, status);
}

/**
 * Create JSON response with proper headers
 * @param {Object} data - Data to serialize as JSON
 * @param {number} status - HTTP status code
 * @param {Object} additionalHeaders - Additional headers
 * @returns {Response} JSON response
 */
export function getJSONResponse(data, status = 200, additionalHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...getUnrestrictedCorsHeaders(),
      ...additionalHeaders
    }
  });
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {Object} Validation result with isValid and error properties
 */
export function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return { isValid: false, error: 'URL is required' };
  }

  try {
    // Add protocol if missing
    let testUrl = url.trim();
    if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
      testUrl = 'https://' + testUrl;
    }

    const urlObj = new URL(testUrl);
    
    // Check for valid hostname
    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
      return { isValid: false, error: 'Invalid hostname' };
    }

    // Check for blocked extensions
    const pathname = urlObj.pathname.toLowerCase();
    const hasBlockedExtension = CONFIG.BLOCKED_EXTENSIONS.some(ext => 
      pathname.endsWith(ext)
    );
    
    if (hasBlockedExtension) {
      return { isValid: false, error: 'File type not supported' };
    }

    return { isValid: true, normalizedUrl: urlObj.href };
  } catch (error) {
    return { isValid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if user agent should be blocked
 * @param {string} userAgent - User agent string
 * @returns {boolean} Whether user agent should be blocked
 */
export function shouldBlockUserAgent(userAgent) {
  if (!userAgent) return false;
  
  return CONFIG.BLOCKED_USER_AGENTS.some(blocked => 
    userAgent.includes(blocked)
  );
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} html - HTML content to sanitize
 * @returns {string} Sanitized HTML
 */
export function sanitizeHTML(html) {
  if (!html) return '';
  
  // Basic XSS prevention - remove dangerous script content
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
}

/**
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain or empty string
 */
export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return '';
  }
}

/**
 * Check if URL is absolute
 * @param {string} url - URL to check
 * @returns {boolean} Whether URL is absolute
 */
export function isAbsoluteURL(url) {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate cache-friendly key from string
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum key length
 * @returns {string} Cache-friendly key
 */
export function generateCacheKey(input, maxLength = 200) {
  if (!input) return '';
  
  // Remove or replace invalid characters for KV keys
  let key = input
    .replace(/[^a-zA-Z0-9\-_\.\/]/g, '_')
    .substring(0, maxLength);
    
  // Ensure key doesn't start or end with special characters
  key = key.replace(/^[_\-\.]+|[_\-\.]+$/g, '');
  
  return key || 'default_key';
}

/**
 * Measure string size in bytes
 * @param {string} str - String to measure
 * @returns {number} Size in bytes
 */
export function getStringSize(str) {
  if (!str) return 0;
  return new TextEncoder().encode(str).length;
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Simple rate limiter using Map
 * @param {string} identifier - Unique identifier (IP, etc.)
 * @param {Map} rateLimitMap - Map to store rate limit data
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {boolean} Whether request should be allowed
 */
export function checkRateLimit(identifier, rateLimitMap, maxRequests = 60, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  if (!rateLimitMap.has(identifier)) {
    rateLimitMap.set(identifier, []);
  }
  
  const requests = rateLimitMap.get(identifier);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(timestamp => timestamp > windowStart);
  
  if (validRequests.length >= maxRequests) {
    return false; // Rate limit exceeded
  }
  
  // Add current request
  validRequests.push(now);
  rateLimitMap.set(identifier, validRequests);
  
  return true; // Request allowed
}

/**
 * Get client IP from request headers
 * @param {Request} request - Request object
 * @returns {string} Client IP address
 */
export function getClientIP(request) {
  // Check common headers for client IP
  const headers = request.headers;
  
  return headers.get('CF-Connecting-IP') || 
         headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
         headers.get('X-Real-IP') ||
         headers.get('X-Client-IP') ||
         'unknown';
}

/**
 * Parse content type from header
 * @param {string} contentTypeHeader - Content-Type header value
 * @returns {Object} Parsed content type info
 */
export function parseContentType(contentTypeHeader) {
  if (!contentTypeHeader) {
    return { type: '', subtype: '', charset: 'utf-8' };
  }
  
  const [mediaType, ...params] = contentTypeHeader.split(';');
  const [type, subtype] = mediaType.trim().split('/');
  
  let charset = 'utf-8';
  const charsetParam = params.find(p => p.trim().startsWith('charset='));
  if (charsetParam) {
    charset = charsetParam.split('=')[1].trim();
  }
  
  return {
    type: type || '',
    subtype: subtype || '',
    charset,
    full: mediaType.trim()
  };
}

/**
 * Check if content type is text-based
 * @param {string} contentType - Content type to check
 * @returns {boolean} Whether content type is text-based
 */
export function isTextContentType(contentType) {
  if (!contentType) return false;
  
  const textTypes = [
    'text/', 'application/json', 'application/xml', 
    'application/javascript', 'application/x-javascript'
  ];
  
  return textTypes.some(type => contentType.toLowerCase().includes(type));
}

/**
 * Generate unique request ID
 * @returns {string} Unique request ID
 */
export function generateRequestId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {*} fallback - Fallback value if parsing fails
 * @returns {*} Parsed object or fallback
 */
export function safeJSONParse(jsonString, fallback = null) {
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
}

/**
 * Clean URL for logging (remove sensitive params)
 * @param {string} url - URL to clean
 * @returns {string} Cleaned URL
 */
export function cleanURLForLogging(url) {
  try {
    const urlObj = new URL(url);
    
    // Remove sensitive parameters
    const sensitiveParams = ['token', 'api_key', 'access_token', 'password', 'secret'];
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });
    
    return urlObj.href;
  } catch {
    return url;
  }
}

/**
 * Timer utility for measuring execution time
 * @param {string} label - Timer label
 * @returns {Object} Timer object with stop method
 */
export function createTimer(label) {
  const start = Date.now();
  
  return {
    stop() {
      const duration = Date.now() - start;
      console.log(`[Timer] ${label}: ${duration}ms`);
      return duration;
    },
    
    elapsed() {
      return Date.now() - start;
    }
  };
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Environment-aware logger
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {*} data - Additional data to log
 * @param {Object} env - Environment variables
 */
export function log(level, message, data = null, env = {}) {
  const logLevel = env.LOG_LEVEL || 'warn';
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  
  if (levels[level] <= levels[logLevel]) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };
    
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Find nth index of substring in string
 * @param {string} str - String to search in
 * @param {string} pattern - Pattern to find
 * @param {number} n - Occurrence number (1-based)
 * @returns {number} Index or -1 if not found
 */
export function nthIndex(str, pattern, n) {
  let index = -1;
  for (let i = 0; i < n; i++) {
    index = str.indexOf(pattern, index + 1);
    if (index === -1) break;
  }
  return index;
}

/**
 * Check if position is inside HTML tag
 * @param {string} html - HTML string
 * @param {number} pos - Position to check
 * @returns {boolean} Whether position is inside a tag
 */
export function isPositionInTag(html, pos) {
  if (pos > html.length || pos < 0) return false;
  
  let start = html.lastIndexOf('<', pos);
  if (start === -1) start = 0;
  
  let end = html.indexOf('>', pos);
  if (end === -1) end = html.length;
  
  let content = html.slice(start + 1, end);
  return !content.includes('>') && !content.includes('<');
}

/**
 * Enhanced error with additional context
 */
export class ProxyError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'ProxyError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}