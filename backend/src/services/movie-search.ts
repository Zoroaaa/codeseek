/**
 * 影视搜索服务
 * 元数据: TMDB（主）+ 豆瓣（fallback）
 * 磁力资源: YTS（英文电影 JSON API）+ 1337x（国际大站）+ LightBT + 音范丝（中文 fallback）
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
  /** 资源类型：magnet=磁力 drive=网盘 direct=直链 */
  resourceType?: 'magnet' | 'drive' | 'direct';
  /** 网盘链接（当 resourceType === 'drive' 时） */
  driveUrl?: string;
  /** 提取码 */
  driveCode?: string;
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
  resourceSources: string[];
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
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

async function searchDouban(keyword: string): Promise<TMDBResult[]> {
  try { const r = await searchDoubanAjax(keyword); if (r.length > 0) return r; } catch { /* ignore */ }
  return [];
}

// ─── YTS.mx API（英文电影，JSON API，最可靠）─────────────────────────

async function searchYTS(keyword: string): Promise<ResourceItem[]> {
  try {
    const url = `https://yts.mx/api/v2/list_movies.json?query_term=${encodeURIComponent(keyword)}&limit=15&sort_by=seeds&with_rt_ratings=false`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const data = await r.json() as {
      data?: {
        movie_count?: number;
        movies?: Array<{
          title: string;
          year: number;
          rating: number;
          torrents?: Array<{ hash: string; quality: string; type: string; size: string; seeds: number; peers: number }>;
        }>;
      };
    };
    const movies = data.data?.movies ?? [];
    const items: ResourceItem[] = [];
    for (const movie of movies) {
      for (const t of movie.torrents ?? []) {
        if (!t.hash) continue;
        const dn = encodeURIComponent(`${movie.title} ${movie.year} ${t.quality}`);
        const trackers = [
          'udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce',
          'udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce',
          'udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce',
          'udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce',
        ].map(tr => `&tr=${tr}`).join('');
        const magnet = `magnet:?xt=urn:btih:${t.hash}&dn=${dn}${trackers}`;
        items.push({
          title: `${movie.title} (${movie.year}) [${t.quality}][${t.type}]`,
          magnet,
          size: t.size,
          date: String(movie.year),
          source: 'yts',
          sourceLabel: 'YTS',
          resourceType: 'magnet',
        });
      }
    }
    return items;
  } catch { return []; }
}

// ─── 1337x（国际主流种子站）──────────────────────────────────────────

async function search1337x(keyword: string): Promise<ResourceItem[]> {
  try {
    // 获取搜索结果页
    const searchHtml = await httpGet(
      `https://1337x.to/search/${encodeURIComponent(keyword.replace(/\s+/g, '+'))}/1/`,
      { 'Referer': 'https://1337x.to/' },
      12000
    );

    // 提取详情页链接（取前5条）
    const linkSet = new Set<string>();
    const linkRe = /href="(\/torrent\/\d+\/[^"]+)"/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(searchHtml)) !== null && linkSet.size < 5) {
      linkSet.add('https://1337x.to' + lm[1]);
    }
    if (linkSet.size === 0) return [];

    // 并发获取详情页
    const details = await Promise.allSettled(
      [...linkSet].map(url => httpGet(url, { 'Referer': 'https://1337x.to/' }, 10000))
    );

    const items: ResourceItem[] = [];
    for (const detail of details) {
      if (detail.status !== 'fulfilled') continue;
      const html = detail.value;

      const magnetM = html.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/i);
      if (!magnetM) continue;

      const titleM = html.match(/<h1[^>]*>\s*([^<]+)\s*<\/h1>/i);
      const sizeM = html.match(/(?:Total size|File size)[^\n]*\n[^<]*<span[^>]*>\s*([^<]+)\s*<\/span>/i)
        || html.match(/<dt>Size<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i)
        || html.match(/class="file-size"[^>]*>([^<]+)</i);
      const dateM = html.match(/<dt>Date uploaded<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/i)
        || html.match(/class="date"[^>]*>([^<]+)</i);

      items.push({
        title: titleM ? decodeHtmlEntities(titleM[1].trim()) : keyword,
        magnet: magnetM[1],
        size: sizeM ? sizeM[1].trim() : '',
        date: dateM ? dateM[1].trim() : '',
        source: '1337x',
        sourceLabel: '1337x',
        resourceType: 'magnet',
      });
    }
    return items;
  } catch { return []; }
}

// ─── 磁力通用抓取（LightBT / 音范丝 fallback）────────────────────────

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
      /<(?:h[1-4])[^>]*>([^<]{3,100})<\/(?:h[1-4])>/i,
      /title="([^"]{3,100})"/i,
      /<(?:strong|b)[^>]*>([^<]{3,100})<\/(?:strong|b)>/i,
      /<a[^>]+class="[^"]*"[^>]*>([^<]{5,80})<\/a>/i,
    ];
    for (const pat of patterns) {
      const hits: string[] = [];
      let t: RegExpExecArray | null;
      const re = new RegExp(pat.source, pat.flags);
      while ((t = re.exec(before))) hits.push(t[1].trim());
      if (hits.length) { title = hits[hits.length - 1]; break; }
    }
    if (!title) continue;
    title = decodeHtmlEntities(title).trim();
    if (/^(复制|下载|magnet|分享|收藏|举报|点击|查看|详情)$/.test(title)) continue;

    items.push({ title, magnet, size: '', date: '', source, sourceLabel, resourceType: 'magnet' });
  }
  return items;
}

async function scrapeLightBT(keyword: string): Promise<ResourceItem[]> {
  try {
    const html = await httpGet(`https://www.lightbt.top/search?q=${encodeURIComponent(keyword)}`, undefined, 10000);
    return extractMagnets(html, 'lightbt', 'LightBT');
  } catch { return []; }
}

async function scrapeYinfans(keyword: string): Promise<ResourceItem[]> {
  try {
    const html = await httpGet(`https://www.yinfans.me/?s=${encodeURIComponent(keyword)}`, { Referer: 'https://www.yinfans.me/' }, 10000);
    const directResults = extractMagnets(html, 'yinfans', '音范丝');
    if (directResults.length > 0) return directResults;

    const postLinks: string[] = [];
    const linkRe = /<a\s+href="(https:\/\/www\.yinfans\.me\/\d+\.html)"[^>]*>/gi;
    let lm: RegExpExecArray | null;
    while ((lm = linkRe.exec(html))) postLinks.push(lm[1]);
    if (postLinks.length === 0) return [];

    const details = await Promise.allSettled(
      postLinks.slice(0, 3).map(url => httpGet(url, { Referer: 'https://www.yinfans.me/' }, 8000))
    );
    const results: ResourceItem[] = [];
    for (const d of details) {
      if (d.status === 'fulfilled') results.push(...extractMagnets(d.value, 'yinfans', '音范丝'));
    }
    return results;
  } catch { return []; }
}

// ─── 主入口 ────────────────────────────────────────────────────────────

export async function searchMovie(keyword: string, page = 1, tmdbKey?: string): Promise<MovieSearchResult> {
  // 元数据 + 磁力资源并发获取
  const [metaRes, ytsRes, x337Res, lightbtRes, yinfansRes] = await Promise.allSettled([
    // 元数据
    (async (): Promise<TMDBResult[]> => {
      const all: TMDBResult[][] = [];
      if (tmdbKey) {
        try { all.push(await searchTMDB(keyword, tmdbKey, page)); } catch { /* TMDB failed */ }
      }
      try { all.push(await searchDouban(keyword)); } catch { /* Douban failed */ }
      return all.flat();
    })(),
    // 资源：YTS（英文电影 JSON API，最可靠）
    searchYTS(keyword),
    // 资源：1337x（国际大站，支持中英文）
    search1337x(keyword),
    // 资源：LightBT（中文 fallback）
    scrapeLightBT(keyword),
    // 资源：音范丝（中文 fallback）
    scrapeYinfans(keyword),
  ]);

  let results: TMDBResult[] = metaRes.status === 'fulfilled' ? metaRes.value : [];
  const tmdbError = metaRes.status === 'rejected' ? String(metaRes.reason) : null;

  // 元数据去重（按 title 前30字符）
  const seen = new Set<string>();
  results = results.filter(item => {
    const key = item.title.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  // 合并资源，按来源标记可用性
  const resourceSources: string[] = [];
  const resources: ResourceItem[] = [];

  const addResources = (settled: PromiseSettledResult<ResourceItem[]>, label: string) => {
    if (settled.status === 'fulfilled' && settled.value.length > 0) {
      resources.push(...settled.value);
      resourceSources.push(label);
    }
  };

  addResources(ytsRes, 'YTS');
  addResources(x337Res, '1337x');
  addResources(lightbtRes, 'LightBT');
  addResources(yinfansRes, '音范丝');

  // 磁力去重
  const seenMagnets = new Set<string>();
  const dedupedResources = resources.filter(r => {
    if (!r.magnet) return true;
    const key = r.magnet.slice(0, 60);
    if (seenMagnets.has(key)) return false;
    seenMagnets.add(key); return true;
  });

  return {
    keyword,
    page,
    results,
    resources: dedupedResources,
    total: results.length,
    resourceTotal: dedupedResources.length,
    tmdbError,
    doubanError: null,
    resourceSources,
  };
}
