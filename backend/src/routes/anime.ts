/**
 * 动漫搜索路由
 * 数据源：
 *   - 元数据：Bangumi API（bgm.tv）
 *   - 磁力资源：nyaa.si（HTML 爬取）
 *   - 磁力资源：Mikan Project RSS
 */
import { Hono } from 'hono';
import { Env } from '@/types';
import { authMiddleware } from '@/middleware';

export const animeRoutes = new Hono<{ Bindings: Env }>();
animeRoutes.use('*', authMiddleware);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function httpGet(url: string, timeout = 12000): Promise<string> {
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.text();
}

// =====================================================================
// nyaa.si 爬虫
// =====================================================================

export interface NyaaTorrent {
  id: string;
  title: string;
  magnet: string;
  torrentUrl: string;
  size: string;
  date: string;
  seeders: number;
  leechers: number;
  completed: number;
  trusted: boolean;
  category: string;
}

function parseNyaaHtml(html: string): NyaaTorrent[] {
  const results: NyaaTorrent[] = [];

  // Extract tbody content
  const tbodyM = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyM) return results;

  // Split rows
  const rowRe = /<tr\s+class="([^"]*)">([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;

  while ((row = rowRe.exec(tbodyM[1])) !== null) {
    const rowClass = row[1]; // default | success | warning | danger
    const html = row[2];

    // Extract all td blocks
    const tds: string[] = [];
    const tdRe = /<td(?:[^>]*)>([\s\S]*?)<\/td>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(html)) !== null) tds.push(td[1]);
    if (tds.length < 7) continue;

    // td[1]: name column — pick the /view/ link
    const titleM = tds[1].match(/<a\s+href="\/view\/(\d+)"(?:[^>]*)>([^<]+)<\/a>/i);
    if (!titleM) continue;
    const id = titleM[1];
    const title = titleM[2].trim();

    // td[0]: category title
    const catM = tds[0].match(/title="([^"]+)"/i);
    const category = catM ? catM[1] : 'Anime';

    // td[2]: links — magnet + torrent
    const magnetM = tds[2].match(/href="(magnet:[^"]+)"/i);
    if (!magnetM) continue;
    const magnet = magnetM[1];
    const torrentUrl = `https://nyaa.si/download/${id}.torrent`;

    // td[3]: size
    const size = tds[3].replace(/<[^>]+>/g, '').trim();

    // td[4]: date — prefer data-timestamp
    const tsM = tds[4].match(/data-timestamp="(\d+)"/i);
    const date = tsM
      ? new Date(parseInt(tsM[1]) * 1000).toISOString().split('T')[0]
      : tds[4].replace(/<[^>]+>/g, '').trim();

    // td[5]: seeders; td[6]: leechers; td[7]: completed
    const seeders = parseInt(tds[5].replace(/<[^>]+>/g, '').trim()) || 0;
    const leechers = parseInt(tds[6].replace(/<[^>]+>/g, '').trim()) || 0;
    const completed = parseInt((tds[7] || '').replace(/<[^>]+>/g, '').trim()) || 0;

    results.push({
      id,
      title,
      magnet,
      torrentUrl,
      size,
      date,
      seeders,
      leechers,
      completed,
      category,
      trusted: rowClass.includes('success'),
    });
  }

  return results;
}

// =====================================================================
// Mikan Project RSS 爬虫
// =====================================================================

export interface MikanItem {
  title: string;
  magnet: string;
  size: string;
  pubDate: string;
  group: string; // 字幕组
}

function parseMikanRss(xml: string): MikanItem[] {
  const items: MikanItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const titleM = block.match(/<title><!\[CDATA\[([^\]]+)\]\]><\/title>/i) ||
                   block.match(/<title>([^<]+)<\/title>/i);
    const title = titleM ? titleM[1].trim() : '';

    const magnetM = block.match(/href="(magnet:[^"]+)"/i) ||
                    block.match(/<enclosure[^>]+url="([^"]+)"/i);
    const magnet = magnetM ? magnetM[1] : '';
    if (!magnet.startsWith('magnet:')) continue;

    const sizeM = block.match(/contentLength">(\d+)<\//i) ||
                  block.match(/torrent:contentLength[^>]*>(\d+)/i);
    const sizeBytes = sizeM ? parseInt(sizeM[1]) : 0;
    const size = sizeBytes > 0
      ? sizeBytes > 1073741824
        ? `${(sizeBytes / 1073741824).toFixed(1)} GiB`
        : `${(sizeBytes / 1048576).toFixed(0)} MiB`
      : '';

    const dateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
    const pubDate = dateM ? dateM[1].trim() : '';

    // 字幕组通常在 torrent:author 或标题中 [...] 括号
    const groupM = block.match(/torrent:author[^>]*>([^<]+)</i) ||
                   title.match(/\[([^\]]+)\]/);
    const group = groupM ? groupM[1].trim() : '';

    items.push({ title, magnet, size, pubDate, group });
  }
  return items;
}

// =====================================================================
// Bangumi API（元数据）
// =====================================================================

export interface BangumiSubject {
  id: number;
  name: string;
  nameCN: string;
  cover: string;
  summary: string;
  airDate: string;
  rating: number;
  eps: number;
  url: string;
}

async function searchBangumi(keyword: string): Promise<BangumiSubject[]> {
  const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword)}?type=2&responseGroup=small&max_results=6`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'codeseek/1.0 (https://codeseek.pp.ua)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) return [];
  const data = await r.json() as { list?: any[] };
  if (!data.list?.length) return [];

  return data.list.map((s: any) => ({
    id: s.id,
    name: s.name || '',
    nameCN: s.name_cn || s.name || '',
    cover: s.images?.large || s.images?.common || '',
    summary: s.summary || '',
    airDate: s.air_date || '',
    rating: s.rating?.score ?? 0,
    eps: s.eps_count ?? s.eps ?? 0,
    url: `https://bgm.tv/subject/${s.id}`,
  }));
}

// =====================================================================
// 路由
// =====================================================================

/**
 * GET /api/anime/search?q=关键词&page=1&source=all|nyaa|mikan
 */
animeRoutes.get('/search', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1'));
  const source = c.req.query('source') ?? 'all'; // all | nyaa | mikan

  if (!q) {
    return c.json({ success: false, error: { code: 'MISSING_QUERY', message: '请输入搜索关键词' } }, 400);
  }

  // Cache
  const CACHE_TTL = 300;
  const cacheKey = new Request(`https://internal/anime-search/${encodeURIComponent(q)}-p${page}-${source}`);
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: { ...Object.fromEntries(cached.headers), 'X-Cache': 'HIT' },
    });
  }

  // 并行抓取
  const tasks: Promise<any>[] = [
    searchBangumi(q).catch(() => []),
  ];

  if (source === 'all' || source === 'nyaa') {
    tasks.push(
      httpGet(`https://nyaa.si/?f=0&c=1_0&q=${encodeURIComponent(q)}&s=seeders&o=desc&p=${page}`)
        .then(parseNyaaHtml)
        .catch(() => [])
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  if (source === 'all' || source === 'mikan') {
    tasks.push(
      httpGet(`https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(q)}`)
        .then(parseMikanRss)
        .catch(() => [])
    );
  } else {
    tasks.push(Promise.resolve([]));
  }

  const [bgmList, nyaaTorrents, mikanItems] = await Promise.all(tasks);

  const body = JSON.stringify({
    success: true,
    data: {
      keyword: q,
      page,
      bgm: (bgmList as BangumiSubject[]).slice(0, 6),
      nyaa: nyaaTorrents as NyaaTorrent[],
      mikan: mikanItems as MikanItem[],
      total: (nyaaTorrents as NyaaTorrent[]).length + (mikanItems as MikanItem[]).length,
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
