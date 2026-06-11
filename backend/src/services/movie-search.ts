/**
 * 影视搜索服务
 * 数据源：TMDB API（元数据，主）+ 豆瓣（fallback）+ LightBT / 音范丝（磁力）
 * 被 /api/movie/search 和 /api/search（聚合模式）共同使用
 */

// ─── Types ──────────────────────────────────────────────────────────────

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
  source: 'tmdb' | 'douban';
}

export interface ResourceItem {
  title: string;
  magnet: string;
  size: string;
  date: string;
  source: string;
  sourceLabel: string;
}

export interface MovieSearchResult {
  keyword: string;
  page: number;
  results: TMDBResult[];
  resources: ResourceItem[];
  total: number;
  resourceTotal: number;
  tmdbError: string | null;
  doubanError: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function httpGet(url: string, headers?: Record<string, string>, timeout = 12000): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', ...headers },
    signal: AbortSignal.timeout(timeout),
    redirect: 'follow',
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.text();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/</g, '<').replace(/>/g, '>')
    .replace(/"/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

// ─── TMDB API ──────────────────────────────────────────────────────────

async function searchTMDB(keyword: string, apiKey: string, page = 1): Promise<TMDBResult[]> {
  const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(keyword)}&language=zh-CN&page=${page}&include_adult=false`;
  const r = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });
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

// ─── 豆瓣搜索 ─────────────────────────────────────────────────────────

interface DoubanRawItem { id: string; title: string; rate: string; cover?: string; url: string; is_tv: boolean; }

async function searchDoubanAjax(keyword: string): Promise<TMDBResult[]> {
  const url = `https://movie.douban.com/j/search_subjects?type=movie&tag=&sort=recommend&page_limit=20&page_start=0&search_text=${encodeURIComponent(keyword)}`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA, 'Accept': 'application/json, text/javascript, */*',
      'Referer': 'https://movie.douban.com/explore', 'X-Requested-With': 'XMLHttpRequest',
      'Cookie': 'bid=""; __yadk_uid=dummy',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Douban AJAX error: ${r.status}`);
  const data = await r.json() as { subjects?: DoubanRawItem[] };
  if (!data.subjects?.length) return [];
  return data.subjects.slice(0, 15).map((item) => ({
    id: -Math.abs(parseInt(item.id) || 0), title: item.title || '', originalTitle: item.title || '',
    overview: '', poster: item.cover?.startsWith('http') ? item.cover : (item.cover ? `https:${item.cover}` : null),
    backdrop: null, releaseDate: '', year: '',
    rating: parseFloat(item.rate) || 0, voteCount: 0,
    mediaType: (item.is_tv ? 'tv' : 'movie') as 'movie' | 'tv', source: 'douban' as const,
  }));
}

async function searchDoubanNew(keyword: string): Promise<TMDBResult[]> {
  const url = `https://www.douban.com/search?q=${encodeURIComponent(keyword)}&cat=1002`;
  const html = await httpGet(url, { 'Referer': 'https://www.douban.com/' }, 8000);
  const results: TMDBResult[] = [];
  const itemRe = /<div\s+class="[^"]*subject-cast[^"]*"[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/(?:movie|www)\.douban\.com\/subject\/(\d+)\/)"[^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(html)) !== null && results.length < 15) {
    const id = m[2];
    const title = decodeHtmlEntities(m[3].trim());
    const blockEnd = html.indexOf('</div>', m.index);
    const block = html.slice(m.index, Math.min(m.index + 500, blockEnd > m.index ? blockEnd : m.index + 500));
    const rateM = block.match(/<span[^>]*class="[^"]*rating_nums[^"]*"[^>]*>([\d.]+)<\/span>/);
    results.push({
      id: parseInt(id), title, originalTitle: title, overview: '', poster: null, backdrop: null,
      releaseDate: '', year: '', rating: parseFloat(rateM?.[1] || '0') || 0, voteCount: 0,
      mediaType: 'movie' as const, source: 'douban' as const,
    });
  }
  return results;
}

async function searchDouban(keyword: string): Promise<TMDBResult[]> {
  try { const r = await searchDoubanAjax(keyword); if (r.length > 0) return r; } catch { /* continue */ }
  try { const r = await searchDoubanNew(keyword); if (r.length > 0) return r; } catch { /* ignore */ }
  return [];
}

// ─── 磁力资源站 ───────────────────────────────────────────────────────

function extractMagnets(html: string, source: string, sourceLabel: string): ResourceItem[] {
  const items: ResourceItem[] = [];
  const seenMagnets = new Set<string>();
  const magnetRe = /href="(magnet:\?xt=urn:btih:[^"]{10,})"/gi;
  let m: RegExpExecArray | null;

  while ((m = magnetRe.exec(html)) !== null && items.length < 30) {
    const magnet = m[1];
    if (seenMagnets.has(magnet)) continue;
    seenMagnets.add(magnet);
    const before = html.slice(Math.max(0, m.index - 1500), m.index);

    let title = '';
    const patterns = [
      /<a[^>]+href="[^"]*"[^>]*class="[^"]*(?:title|post-title|entry-title|subject|name)[^"]*"[^>]*>\s*([^<]{3,100})\s*<\/a>/i,
      /<(?:h[1-4])[^>]*>([^<]{3,100})<\/\1>/i,
      /title="([^"]{3,100})"/i,
      /<(?:strong|b)[^>]*>([^<]{3,100})<\/(?:strong|b)>/i,
      /<a[^>]+class="[^"]*"[^>]*>([^<]{5,80})<\/a>/i,
    ];
    for (const pat of patterns) {
      const hits: string[] = []; pat.lastIndex = 0; let t: RegExpExecArray | null;
      while ((t = pat.exec(before))) hits.push(t[1].trim());
      if (hits.length) { title = hits[hits.length - 1]; break; }
    }
    if (!title) continue;
    title = decodeHtmlEntities(title).trim();
    if (/^(复制|下载|magnet|分享|收藏|举报|点击|查看|详情)$/.test(title)) continue;
    items.push({ title, magnet, size: '', date: '', source, sourceLabel });
  }
  return items;
}

async function scrapeLightBT(keyword: string): Promise<ResourceItem[]> {
  try {
    const html = await httpGet(`https://www.lightbt.top/search?q=${encodeURIComponent(keyword)}`, undefined, 12000);
    return extractMagnets(html, 'lightbt', 'LightBT');
  } catch { return []; }
}

async function scrapeYinfans(keyword: string): Promise<ResourceItem[]> {
  try {
    const html = await httpGet(`https://www.yinfans.me/?s=${encodeURIComponent(keyword)}`, { Referer: 'https://www.yinfans.me/' }, 12000);
    const directResults = extractMagnets(html, 'yinfans', '音范丝');
    if (directResults.length > 0) return directResults;

    const postLinks: string[] = [];
    const linkRe = /<a\s+href="(https:\/\/www\.yinfans\.me\/\d+\.html)"[^>]*>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html))) postLinks.push(lm[1]);
    if (postLinks.length === 0) return [];

    const details = await Promise.allSettled(
      postLinks.slice(0, 3).map(url => httpGet(url, { Referer: 'https://www.yinfans.me/' }, 10000))
    );
    const results: ResourceItem[] = [];
    for (const d of details) {
      if (d.status === 'fulfilled') results.push(...extractMagnets(d.value, 'yinfans', '音范丝'));
    }
    return results;
  } catch { return []; }
}

// ─── 主入口 ────────────────────────────────────────────────────────────

/**
 * 执行影视搜索（供路由层调用）
 * @param tmdbKey TMDB API Key，可为空（将仅用豆瓣）
 */
export async function searchMovie(keyword: string, page = 1, tmdbKey?: string): Promise<MovieSearchResult> {
  const [metaRes, lightbtRes, yinfansRes] = await Promise.allSettled([
    (async (): Promise<TMDBResult[]> => {
      const all: TMDBResult[][] = [];
      if (tmdbKey) { try { all.push(await searchTMDB(keyword, tmdbKey, page)); } catch { /* TMDB failed */ } }
      try { all.push(await searchDouban(keyword)); } catch { /* Douban failed */ }
      return all.flat();
    })(),
    scrapeLightBT(keyword),
    scrapeYinfans(keyword),
  ]);

  let results: TMDBResult[] = metaRes.status === 'fulfilled' ? metaRes.value : [];
  const tmdbError = metaRes.status === 'rejected' ? String(metaRes.reason) : null;

  // 去重：按 title 前30字符
  const seen = new Set<string>();
  results = results.filter(item => {
    const key = item.title.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const resources: ResourceItem[] = [
    ...(lightbtRes.status === 'fulfilled' ? lightbtRes.value : []),
    ...(yinfansRes.status === 'fulfilled' ? yinfansRes.value : []),
  ];

  return {
    keyword,
    page,
    results,
    resources,
    total: results.length,
    resourceTotal: resources.length,
    tmdbError,
    doubanError: null,
  };
}
