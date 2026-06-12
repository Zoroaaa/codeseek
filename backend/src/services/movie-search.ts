/**
 * 影视搜索服务
 * 元数据: TMDB（主）+ 豆瓣（fallback）
 * 磁力资源: TPB API（关键词搜索）+ Torrentio（TMDB ID 聚合多源）
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

// ─── 工具函数 ─────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
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

// ─── The Pirate Bay API（apibay.org JSON，最全，CF Workers 可达）──────

async function searchTPB(keyword: string): Promise<ResourceItem[]> {
  try {
    const url = `https://apibay.org/q.php?q=${encodeURIComponent(keyword)}&cat=0`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return [];
    const items = await r.json() as Array<{
      id: string; name: string; info_hash: string;
      leechers: string; seeders: string; size: string; added: string;
    }>;
    if (!items?.length || items[0]?.name === 'No results returned') return [];

    const trackers = [
      'udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce',
      'udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce',
      'udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce',
      'udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce',
    ].map(t => `&tr=${t}`).join('');

    return items.slice(0, 20).map(item => ({
      title: item.name,
      magnet: `magnet:?xt=urn:btih:${item.info_hash.toLowerCase()}&dn=${encodeURIComponent(item.name)}${trackers}`,
      size: formatBytes(parseInt(item.size) || 0),
      date: item.added ? new Date(parseInt(item.added) * 1000).toISOString().split('T')[0] : '',
      source: 'tpb',
      sourceLabel: 'TPB',
      resourceType: 'magnet' as const,
    }));
  } catch { return []; }
}

// ─── Torrentio API（聚合 YTS/1337x/TPB/RARBG/TorrentGalaxy 等多源）───

const TORRENTIO_BASE = 'https://torrentio.strem.fun';
const TORRENTIO_TRACKERS = [
  'udp%3A%2F%2Ftracker.openbittorrent.com%3A6969%2Fannounce',
  'udp%3A%2F%2Fopen.demonii.com%3A1337%2Fannounce',
  'udp%3A%2F%2Fexodus.desync.com%3A6969%2Fannounce',
  'udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce',
].map(t => `&tr=${t}`).join('');

/** 从 infoHash 构造磁力链接 */
function buildMagnetFromHash(infoHash: string, title: string): string {
  return `magnet:?xt=urn:btih:${infoHash.toLowerCase()}&dn=${encodeURIComponent(title)}${TORRENTIO_TRACKERS}`;
}

/** 从 Torrentio 标题中提取大小信息 */
function extractSizeFromTitle(title: string): string {
  const m = title.match(/\u{1F4BC}\s*([\d.]+\s*(?:GB|MB|TB|KB))/iu);
  return m ? m[1] : '';
}

/**
 * 通过 TMDB ID 查询 Torrentio
 * 聚合了 YTS、1337x、TPB、RARBG、TorrentGalaxy 等多源结果
 * 支持 movie / series 两种类型
 */
async function searchTorrentio(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<ResourceItem[]> {
  try {
    const type = mediaType === 'movie' ? 'movie' : 'series';
    const url = `${TORRENTIO_BASE}/stream/${type}/${tmdbId}.json`;
    const r = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return [];
    const data = await r.json() as { streams?: Array<{
      name: string;
      title: string;
      infoHash: string;
      sources?: string[];
    }> };
    if (!data.streams?.length) return [];

    // 去重（按 infoHash）
    const seen = new Set<string>();
    return data.streams
      .filter(s => {
        if (seen.has(s.infoHash)) return false;
        seen.add(s.infoHash); return true;
      })
      .slice(0, 20)
      .map(s => {
        // 清理标题：移除 emoji 和尾部元信息
        const cleanTitle = s.title
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
          .replace(/\s*[\u{1F464}\u2699].*$/su, '')
          .replace(/\n/g, ' ')
          .trim();
        // 提取来源站点标记
        const sourceMatch = s.title.match(/\s*\u2699\s*(\w[\w\s]*?)(?:\n|$)/);
        const srcLabel = sourceMatch?.[1]?.trim() || 'Torrentio';

        return {
          title: cleanTitle || s.name.replace(/\n/g, ' ').trim(),
          magnet: buildMagnetFromHash(s.infoHash, cleanTitle),
          size: extractSizeFromTitle(s.title),
          date: '',
          source: 'torrentio',
          sourceLabel: srcLabel,
          resourceType: 'magnet' as const,
        };
      });
  } catch { return []; }
}

// ─── 主入口 ────────────────────────────────────────────────────────────

export async function searchMovie(keyword: string, page = 1, tmdbKey?: string): Promise<MovieSearchResult> {
  // Phase 1: 元数据 + TPB 关键词搜索 并行
  const [metaRes, tpbRes] = await Promise.allSettled([
    // 元数据
    (async (): Promise<TMDBResult[]> => {
      const all: TMDBResult[][] = [];
      if (tmdbKey) {
        try { all.push(await searchTMDB(keyword, tmdbKey, page)); } catch { /* TMDB failed */ }
      }
      try { all.push(await searchDouban(keyword)); } catch { /* Douban failed */ }
      return all.flat();
    })(),
    // 资源：TPB API（关键词搜索，覆盖广）
    searchTPB(keyword),
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

  // Phase 2: 用 TMDB 结果的 ID 查询 Torrentio（聚合多源）
  const tmdbIds = results
    .filter(r => r.id > 0 && r.source === 'tmdb')
    .map(r => ({ id: r.id, type: r.mediaType }))
    .slice(0, 5);

  const torrentioPromises = tmdbIds.map(item =>
    searchTorrentio(item.id, item.type).catch(() => [] as ResourceItem[])
  );
  const torrentioResults = await Promise.allSettled(torrentioPromises);

  // 合并所有资源
  const resourceSources: string[] = [];
  const resources: ResourceItem[] = [];

  // TPB 结果
  if (tpbRes.status === 'fulfilled' && tpbRes.value.length > 0) {
    resources.push(...tpbRes.value);
    resourceSources.push('TPB');
  }

  // Torrentio 结果（去重合并）
  const torrentioAll: ResourceItem[] = [];
  for (const res of torrentioResults) {
    if (res.status === 'fulfilled') torrentioAll.push(...res.value);
  }
  if (torrentioAll.length > 0) {
    resources.push(...torrentioAll);
    resourceSources.push('Torrentio');
  }

  // 全局磁力去重（按 btih hash）
  const seenMagnets = new Set<string>();
  const dedupedResources = resources.filter(r => {
    if (!r.magnet) return true;
    const key = r.magnet.slice(20, 60);
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
