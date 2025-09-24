// src/handlers/api.js - API处理器
import { CONFIG } from '../config.js';
import CacheManager from '../services/cache-manager.js';

class ApiHandler {
  /**
   * 健康检查
   */
  static async health(request, env, ctx) {
    return new Response(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION,
      environment: CONFIG.ENVIRONMENT,
      features: {
        htmlProcessing: CONFIG.PROCESSORS.HTML.REWRITE_URLS,
        cssProcessing: CONFIG.PROCESSORS.CSS.REWRITE_URLS,
        jsProcessing: CONFIG.PROCESSORS.JS.REWRITE_URLS,
        smartCaching: true,
        resourceOptimization: true,
        unrestrictedCors: true,
        redirectHandling: true,
        securityFiltering: CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS,
        magnetLinks: CONFIG.SPECIAL_HANDLING.MAGNET_LINKS,
        downloadLinks: CONFIG.SPECIAL_HANDLING.DOWNLOAD_LINKS
      },
      limits: {
        maxRedirects: CONFIG.MAX_REDIRECTS,
        requestTimeout: CONFIG.REQUEST_TIMEOUT,
        maxContentSize: CONFIG.SECURITY.MAX_CONTENT_SIZE
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
        ...request.corsHeaders
      }
    });
  }

  /**
   * 状态检查
   */
  static async status(request, env, ctx) {
    return new Response(JSON.stringify({
      status: 'enabled',
      endpoints: CONFIG.ALLOWED_TARGETS.length,
      timestamp: Date.now(),
      version: CONFIG.VERSION,
      cors: 'unrestricted',
      proxy: {
        targets: CONFIG.ALLOWED_TARGETS.length,
        failover: CONFIG.ENABLE_FAILOVER,
        backupDomains: CONFIG.BACKUP_DOMAINS.length,
        maxRedirects: CONFIG.MAX_REDIRECTS
      },
      security: {
        maliciousBlocking: CONFIG.SECURITY.BLOCK_MALICIOUS_SCRIPTS,
        htmlSanitization: CONFIG.SECURITY.SANITIZE_HTML,
        adBlocking: CONFIG.SECURITY.BLOCK_ADS
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...request.corsHeaders
      }
    });
  }

  /**
   * 缓存统计
   */
  static async cacheStats(request, env, ctx) {
    try {
      const stats = await CacheManager.getStats();
      
      return new Response(JSON.stringify({
        cache: stats,
        settings: CONFIG.CACHE_SETTINGS,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          ...request.corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to get cache stats',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...request.corsHeaders
        }
      });
    }
  }

  /**
   * 代理统计
   */
  static async proxyStats(request, env, ctx) {
    return new Response(JSON.stringify({
      proxy: {
        version: CONFIG.VERSION,
        allowedTargets: CONFIG.ALLOWED_TARGETS.length,
        specialHandling: CONFIG.SPECIAL_HANDLING,
        processors: CONFIG.PROCESSORS,
        uptime: Date.now(), // 简化的运行时间
        features: [
          'URL Rewriting',
          'Content Processing',
          'Redirect Handling',
          'Cache Management',
          'Security Filtering',
          'Magnet Link Support',
          'Download Link Support',
          'WebSocket Support'
        ]
      },
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        ...request.corsHeaders
      }
    });
  }

  /**
   * 清理缓存
   */
  static async clearCache(request, env, ctx) {
    try {
      await CacheManager.clear();
      
      return new Response(JSON.stringify({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...request.corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to clear cache',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...request.corsHeaders
        }
      });
    }
  }
}

export default ApiHandler;