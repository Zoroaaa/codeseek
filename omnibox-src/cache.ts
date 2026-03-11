// 增强型缓存管理器 - Cloudflare KV 存储
// 基于内容类型的智能 TTL 缓存处理

import { CONFIG, type EnvVariables, type CacheTTLConfig } from './config.js';
import { Logger, sha256Hex } from './utils.js';

export interface CacheData {
  body: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  expires: number;
  cachedAt: number;
  contentType: string;
  size: number;
}

export interface CacheStats {
  totalKeys: number;
  cachePrefix: string;
  ttlConfig: CacheTTLConfig;
  timestamp: string;
  hitCount: number;
  missCount: number;
  hitRate: string;
  error?: string;
}

export class CacheManager {
  private kv: KVNamespace | null;
  private env: EnvVariables;
  private defaultTTL: CacheTTLConfig;
  private logger: Logger;
  // hitCount/missCount 为请求级统计（CacheManager 每次请求重新实例化），
  // 不跨请求累积，仅供本次请求内部参考。真实命中率需通过 Cloudflare Analytics 查看。
  private hitCount: number = 0;
  private missCount: number = 0;

  constructor(kv: KVNamespace | null, env: EnvVariables) {
    this.kv = kv;
    this.env = env;
    this.logger = Logger.create('CacheManager', env);
    this.defaultTTL = {
      HTML: parseInt(env.CACHE_HTML_TTL || String(CONFIG.CACHE_TTL.HTML), 10),
      CSS: parseInt(env.CACHE_CSS_TTL || String(CONFIG.CACHE_TTL.CSS), 10),
      JS: parseInt(env.CACHE_JS_TTL || String(CONFIG.CACHE_TTL.JS), 10),
      IMAGE: parseInt(env.CACHE_IMAGE_TTL || String(CONFIG.CACHE_TTL.IMAGE), 10),
      FONT: parseInt(env.CACHE_FONT_TTL || String(CONFIG.CACHE_TTL.FONT), 10),
      JSON: parseInt(env.CACHE_JSON_TTL || String(CONFIG.CACHE_TTL.JSON), 10),
      DEFAULT: parseInt(env.CACHE_DEFAULT_TTL || String(CONFIG.CACHE_TTL.DEFAULT), 10)
    };
  }

  private ensureKv(): KVNamespace | null {
    if (!this.kv) {
      this.logger.warn('KV storage not available');
    }
    return this.kv;
  }

  async generateCacheKey(url: string, method: string = 'GET', headers: Record<string, string> = {}): Promise<string> {
    try {
      const normalizedUrl = new URL(url);

      const cacheBustingParams = ['_t', 'timestamp', 'cachebuster', '_', 'nocache'];
      cacheBustingParams.forEach(param => {
        normalizedUrl.searchParams.delete(param);
      });

      const keyComponents = [
        CONFIG.CACHE_PREFIX,
        method.toUpperCase(),
        normalizedUrl.href
      ];

      // 仅用 accept-language 区分内容变体，排除 user-agent 避免命中率崩溃
      const relevantHeaders = ['accept-language'];
      relevantHeaders.forEach(headerName => {
        const headerValue = headers[headerName];
        if (headerValue) {
          keyComponents.push(`${headerName}:${headerValue.substring(0, 30)}`);
        }
      });

      // 对完整 Key 做 SHA-256 哈希，避免超出 KV 512 字节键名上限
      const raw = keyComponents.join('|');
      const hash = await sha256Hex(raw, 48);
      return `${CONFIG.CACHE_PREFIX}:${hash}`;
    } catch (error) {
      this.logger.error('Cache key generation error', { error: String(error), url: url.substring(0, 100) });
      // 降级：对原始字符串哈希
      const fallbackRaw = `${CONFIG.CACHE_PREFIX}|${method}|${url}`;
      const hash = await sha256Hex(fallbackRaw, 48);
      return `${CONFIG.CACHE_PREFIX}:${hash}`;
    }
  }

  getTTLForContentType(contentType: string | null): number {
    if (!contentType) return this.defaultTTL.DEFAULT;

    const type = contentType.toLowerCase();

    if (type.includes('html')) return this.defaultTTL.HTML;
    if (type.includes('css') || type.includes('stylesheet')) return this.defaultTTL.CSS;
    if (type.includes('javascript') || type.includes('ecmascript')) return this.defaultTTL.JS;
    if (type.includes('image/')) return this.defaultTTL.IMAGE;
    if (type.includes('font/') || type.includes('woff') || type.includes('ttf')) return this.defaultTTL.FONT;
    if (type.includes('json') || type.includes('application/json')) return this.defaultTTL.JSON;
    if (type.includes('video/') || type.includes('audio/')) return this.defaultTTL.IMAGE;

    return this.defaultTTL.DEFAULT;
  }

  async get(cacheKey: string): Promise<CacheData | null> {
    const kv = this.ensureKv();
    if (!kv) return null;

    try {
      const cached = await kv.get(cacheKey, 'json') as CacheData | null;
      if (!cached) {
        this.missCount++;
        return null;
      }

      if (cached.expires && Date.now() > cached.expires) {
        kv.delete(cacheKey).catch(err => {
          this.logger.error('Failed to delete expired cache', { cacheKey, error: String(err) });
        });
        this.missCount++;
        return null;
      }

      if (!cached.body || !cached.headers) {
        this.logger.warn('Invalid cache structure, deleting', { cacheKey });
        kv.delete(cacheKey).catch(() => {});
        this.missCount++;
        return null;
      }

      this.hitCount++;
      // 修复：缓存存储的 body 是已解码的文本（response.text()），
      // 恢复时必须去掉 Content-Encoding（如 gzip）和 Content-Length，
      // 否则浏览器会尝试再次解码明文，导致乱码或解析失败。
      const restoredHeaders = { ...cached.headers };
      delete restoredHeaders['content-encoding'];
      delete restoredHeaders['Content-Encoding'];
      delete restoredHeaders['content-length'];
      delete restoredHeaders['Content-Length'];
      return {
        body: cached.body,
        headers: restoredHeaders,
        status: cached.status || 200,
        statusText: cached.statusText || 'OK',
        cachedAt: cached.cachedAt,
        expires: cached.expires,
        contentType: cached.contentType,
        size: cached.size
      };
    } catch (error) {
      this.logger.error('Cache get error', { cacheKey, error: String(error) });
      this.missCount++;
      return null;
    }
  }

  async set(cacheKey: string, response: Response, customTTL: number | null = null): Promise<void> {
    const kv = this.ensureKv();
    if (!kv) return;

    try {
      if (response.status < 200 || response.status >= 300) {
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      const cacheControl = response.headers.get('cache-control') || '';

      if (cacheControl.includes('private') || cacheControl.includes('no-store')) {
        return;
      }

      // 跳过二进制内容：图片/字体/音视频用 .text() 读取会损坏数据
      const isBinary = /^(image|audio|video|font)\//i.test(contentType) ||
                       contentType.includes('application/octet-stream') ||
                       contentType.includes('application/wasm') ||
                       contentType.includes('application/pdf') ||
                       contentType.includes('woff') ||
                       contentType.includes('ttf') ||
                       contentType.includes('otf') ||
                       contentType.includes('eot');
      if (isBinary) {
        this.logger.debug('Skipping cache for binary content', { contentType });
        return;
      }

      const maxSize = parseInt(this.env.MAX_CACHE_SIZE || String(CONFIG.MAX_CACHE_SIZE), 10);

      const responseClone = response.clone();
      const body = await responseClone.text();
      const bodySize = new TextEncoder().encode(body).length;

      if (bodySize > maxSize) {
        this.logger.warn('Response body too large to cache', { bodySize, maxSize });
        return;
      }

      const ttl = customTTL || this.getTTLForContentType(contentType);

      // 存储前去掉不应缓存的响应头：
      // - Content-Encoding/Content-Length: body 已用 .text() 解码为明文，恢复时不应再带编码信息
      // - Set-Cookie: 会话Cookie绝不能缓存，否则会导致会话劫持（用户A的Cookie泄露给用户B）
      const headersToStore = Object.fromEntries(response.headers.entries());
      delete headersToStore['content-encoding'];
      delete headersToStore['Content-Encoding'];
      delete headersToStore['content-length'];
      delete headersToStore['Content-Length'];
      delete headersToStore['set-cookie'];
      delete headersToStore['Set-Cookie'];

      const cacheData: CacheData = {
        body: body,
        headers: headersToStore,
        status: response.status,
        statusText: response.statusText,
        expires: Date.now() + (ttl * 1000),
        cachedAt: Date.now(),
        contentType: contentType,
        size: bodySize
      };

      await kv.put(cacheKey, JSON.stringify(cacheData), {
        expirationTtl: ttl
      });

      this.logger.info('Cached response', { cacheKey, ttl, bodySize });

    } catch (error) {
      this.logger.error('Cache set error', { cacheKey, error: String(error) });
    }
  }

  async clearPattern(pattern: string): Promise<void> {
    const kv = this.ensureKv();
    if (!kv) return;

    try {
      this.logger.info('Clearing cache pattern', { pattern });

      // 支持 KV 分页游标，避免超过 1000 条时清除不完整
      let cursor: string | undefined;
      let totalDeleted = 0;

      do {
        const listResult = await kv.list({ prefix: pattern, cursor });
        const deletePromises = listResult.keys.map(key =>
          kv.delete(key.name).catch(err => {
            this.logger.error('Failed to delete cache key', { key: key.name, error: String(err) });
          })
        );
        await Promise.allSettled(deletePromises);
        totalDeleted += listResult.keys.length;
        cursor = listResult.list_complete ? undefined : (listResult as any).cursor;
      } while (cursor);

      this.logger.info('Cleared cache entries', { count: totalDeleted });

    } catch (error) {
      this.logger.error('Cache clear error', { pattern, error: String(error) });
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    return this.clearPattern(CONFIG.CACHE_PREFIX);
  }

  async getStats(): Promise<CacheStats> {
    const kv = this.ensureKv();

    if (!kv) {
      return {
        error: 'KV storage not available',
        totalKeys: 0,
        cachePrefix: CONFIG.CACHE_PREFIX,
        ttlConfig: this.defaultTTL,
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: this.hitCount + this.missCount > 0
          ? ((this.hitCount / (this.hitCount + this.missCount)) * 100).toFixed(1) + '%'
          : 'N/A',
        timestamp: new Date().toISOString()
      };
    }

    try {
      // 支持 KV 分页，正确统计所有缓存条目数量
      let cursor: string | undefined;
      let totalKeys = 0;

      do {
        const listResult = await kv.list({ prefix: CONFIG.CACHE_PREFIX, cursor });
        totalKeys += listResult.keys.length;
        cursor = listResult.list_complete ? undefined : (listResult as any).cursor;
      } while (cursor);

      const total = this.hitCount + this.missCount;
      const stats: CacheStats = {
        totalKeys,
        cachePrefix: CONFIG.CACHE_PREFIX,
        ttlConfig: this.defaultTTL,
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: total > 0 ? ((this.hitCount / total) * 100).toFixed(1) + '%' : 'N/A',
        timestamp: new Date().toISOString()
      };

      return stats;

    } catch (error) {
      this.logger.error('Failed to get cache stats', { error: String(error) });
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        totalKeys: 0,
        cachePrefix: CONFIG.CACHE_PREFIX,
        ttlConfig: this.defaultTTL,
        hitCount: this.hitCount,
        missCount: this.missCount,
        hitRate: 'N/A',
        timestamp: new Date().toISOString()
      };
    }
  }

  async preloadUrls(urls: string[]): Promise<void> {
    if (!Array.isArray(urls)) return;

    const kv = this.ensureKv();
    if (!kv) return;

    this.logger.info('Preloading URLs into cache', { count: urls.length });

    const preloadPromises = urls.map(async (url) => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const cacheKey = await this.generateCacheKey(url, 'GET');
          await this.set(cacheKey, response);
        }
      } catch (error) {
        this.logger.error('Failed to preload URL', { url, error: String(error) });
      }
    });

    await Promise.allSettled(preloadPromises);
    this.logger.info('Cache preloading completed');
  }
}
