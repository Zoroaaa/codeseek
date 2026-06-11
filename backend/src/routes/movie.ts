/**
 * 影视搜索路由
 * 数据源：
 *   - 元数据：TMDB API（主，需配置 TMDB_API_KEY secret）
 *   - 元数据：豆瓣（fallback，无需配置）
 *   - 磁力资源：LightBT（HTML 爬取，降级失败不影响主结果）
 *   - 磁力资源：音范丝（HTML 爬取，降级失败不影响主结果）
 */
import { Hono } from 'hono';
import { Env } from '@/types';
import { authMiddleware } from '@/middleware';

export const movieRoutes = new Hono<{ Bindings: Env }>();
movieRoutes.use('*', authMiddleware);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function httpGet(url: string, timeout = 10000): Promise<string> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.google.com/',
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.text();
}

// =====================================================================
// TMDB API（元数据）
// =====================================================================

export interface TMDBResult {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  releaseDate: string;
  year: string;
  rating: number;
  voteCount: number;
  mediaType: 'movie' | 'tv';
  genres?: string[];
  /** 数据来源标识 */
  source: 'tmdb' | 'douban';
}

async function searchTMDB(keyword: string, apiKey: string, page = 1): Promise<TMDBResult[]> {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(keyword)}&language=zh-CN&page=${page}&include_adult=false`;
  const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`TMDB error: ${r.status}`);
  const data = await r.json() as { results?: any[] };
  if (!data.results) return [];

  return data.results
    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
    .slice(0, 20)
    .map((item: any) => {
      const releaseDate: string = item.release_date || item.first_air_date || '';
      return {
        id: item.id,
        title: item.title || item.name || '',
        originalTitle: item.original_title || item.original_name || '',
        overview: (item.overview || '').slice(0, 300),
        poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : null,
        releaseDate,
        year: releaseDate ? releaseDate.slice(0, 4) : '',
        rating: Math.round((item.vote_average || 0) * 10) / 10,
        voteCount: item.vote_count || 0,
        mediaType: item.media_type as 'movie' | 'tv',
        source: 'tmdb' as const,
      };
    });
}

// =====================================================================
// 豆瓣 API（元数据 fallback，无需配置 key）
// =====================================================================

interface DoubanRawItem {
  id: string;
  title: string;
  rate: string;
  cover?: string;
  cover_x?: number;
  cover_y?: number;
  url: string;
  is_tv: boolean;
}

async function searchDouban(keyword: string): Promise<TMDBResult[]> {
  // 豆瓣搜索接口，返回电影+剧集混合结果
  const url = `https://movie.douban.com/j/search_subjects?type=movie&tag=&sort=recommend&page_limit=20&page_start=0&search_text=${encodeURIComponent(keyword)}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'application/json',
      'Referer': 'https://movie.douban.com/',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Douban error: ${r.status}`);
  const data = await r.json() as { subjects?: DoubanRawItem[] };
  if (!data.subjects?.length) return [];

  return data.subjects.slice(0, 15).map((item: DoubanRawItem) => ({
    // 用负数 id 区分豆瓣来源（TMDB id 为正整数）
    id: -Math.abs(parseInt(item.id) || 0),
    title: item.title || '',
    originalTitle: item.title || '',
    overview: '',
    poster: item.cover || null,
    backdrop: null,
    releaseDate: '',
    year: '', // 豆瓣搜索接口不直接返回年份
    rating: parseFloat(item.rate) || 0,
    voteCount: 0,
    mediaType: (item.is_tv ? 'tv' : 'movie') as 'movie' | 'tv',
    source: 'douban' as const,
  }));
}

// =====================================================================
// 磁力资源站爬虫（通用 magnet 提取）
// =====================================================================

export interface ResourceItem {
  title: string;
  magnet: string;
  size: string;
  date: string;
  source: string;
  sourceLabel: string;
}

/**
 * 通用 magnet 链接提取器
 * 从 HTML 中找到所有 magnet 链接，取最近的标题文本作为标题
 */
function extractMagnets(html: string, source: string, sourceLabel: string): ResourceItem[] {
  const items: ResourceItem[] = [];

  // 扫描全 HTML，找 magnet href，然后向前找最近标题
  const magnetRe = /href="(magnet:[^"]{20,})"/gi;
  let m: RegExpExecArray | null;

  // 收集所有 magnet 的位置
  const magnets: { magnet: string; pos: number }[] = [];
  while ((m = magnetRe.exec(html)) !== null) {
    magnets.push({ magnet: m[1], pos: m.index });
  }

  // 对每个 magnet，向前 800 字符内找最近标题文本
  for (const { magnet, pos } of magnets.slice(0, 30)) {
    const before = html.slice(Math.max(0, pos - 800), pos);

    // 尝试抓 <h1/h2/h3/td/a class="*title*"> 等
    const titlePatterns = [
      /<(?:h[1-4]|td)[^>]*>([^<]{4,80})<\/(?:h[1-4]|td)>/gi,
      /<a[^>]+class="[^"]*(?:title|name|subject)[^"]*"[^>]*>([^<]{4,80})<\/a>/gi,
      /title="([^"]{4,80})"/gi,
    ];

    let title = '';
    for (const pat of titlePatterns) {
      const hits: string[] = [];
      let t: RegExpExecArray | null;
      pat.lastIndex = 0;
      while ((t = pat.exec(before)) !== null) hits.push(t[1].trim());
      if (hits.length) {
        title = hits[hits.length - 1]; // 最近的
        break;
      }
    }

    if (!title) continue;
    title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

    // 去重
    if (items.some(i => i.magnet === magnet)) continue;

    items.push({ title, magnet, size: '', date: '', source, sourceLabel });
  }

  return items;
}

/** LightBT 爬虫 */
async function scrapeLightBT(keyword: string): Promise<ResourceItem[]> {
  const html = await httpGet(
    `https://www.lightbt.top/search?q=${encodeURIComponent(keyword)}`,
    10000
  );
  return extractMagnets(html, 'lightbt', 'LightBT');
}

/** 音范丝爬虫 */
async function scrapeYinfans(keyword: string): Promise<ResourceItem[]> {
  const html = await httpGet(
    `https://www.yinfans.me/?s=${encodeURIComponent(keyword)}`,
    10000
  );

  // 音范丝是 WordPress，搜索结果是文章列表，每篇文章有单独详情页
  // 先从列表拿详情页链接，再爬详情页里的 magnet
  const postLinks: string[] = [];
  const linkRe = /<a\s+href="(https:\/\/www\.yinfans\.me\/[^"]+)"[^>]*class="[^"]*entry-title[^"]*"/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) !== null) {
    postLinks.push(lm[1]);
  }

  if (!postLinks.length) {
    // fallback: 直接从搜索页提取 magnet
    return extractMagnets(html, 'yinfans', '音范丝');
  }

  // 最多抓前 3 篇详情
  const details = await Promise.allSettled(
    postLinks.slice(0, 3).map(url => httpGet(url, 10000))
  );

  const results: ResourceItem[] = [];
  for (const d of details) {
    if (d.status === 'fulfilled') {
      results.push(...extractMagnets(d.value, 'yinfans', '音范丝'));
    }
  }
  return results;
}

// =====================================================================
// 路由
// =====================================================================

/**
 * GET /api/movie/search?q=关键词&page=1
 */
movieRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));

  if (!q) {
    return c.json({ success: false, error: { code: 'MISSING_QUERY', message: '请输入搜索关键词' } }, 400);
  }

  // Cache
  const CACHE_TTL = 300;
  const cacheKey = new Request(`https://internal/movie-search/${encodeURIComponent(q)}-p${page}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: { ...Object.fromEntries(cached.headers), 'X-Cache': 'HIT' },
    });
  }

  const tmdbKey = c.env.TMDB_API_KEY;

  // 并行请求：TMDB（如有 key）+ 豆瓣（始终）+ 资源站
  const metaTasks: Promise<TMDBResult[]>[] = [];
  if (tmdbKey) {
    metaTasks.push(searchTMDB(q, tmdbKey, page));
  }
  metaTasks.push(searchDouban(q).catch(() => [] as TMDBResult[]));

  const [metaResults, lightbtRes, yinfansRes] = await Promise.allSettled([
    Promise.all(metaTasks).then(arr => arr.flat()),
    scrapeLightBT(q).catch(() => [] as ResourceItem[]),
    scrapeYinfans(q).catch(() => [] as ResourceItem[]),
  ]);

  let results: TMDBResult[];
  let tmdbError: string | null = null;
  const doubanError: string | null = null;

  if (metaResults.status === 'fulfilled') {
    results = metaResults.value;
  } else {
    results = [];
    tmdbError = (metaResults.reason as Error).message;
  }

  // 去重：按 title+year 去重，优先保留 TMDB 结果
  const seen = new Set<string>();
  results = results.filter(item => {
    const key = `${item.title}-${item.year}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const resources: ResourceItem[] = [
    ...(lightbtRes.status === 'fulfilled' ? lightbtRes.value : []),
    ...(yinfansRes.status === 'fulfilled' ? yinfansRes.value : []),
  ];

  const body = JSON.stringify({
    success: true,
    data: {
      keyword: q,
      page,
      results,
      resources,
      total: results.length,
      resourceTotal: resources.length,
      tmdbError,
      doubanError,
    },
  });

  const resp = new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      'X-Cache': 'MISS',
    },
  });
  c.executionCtx.waitUntil(cache.put(cacheKey, resp.clone()));
  return resp;
});
