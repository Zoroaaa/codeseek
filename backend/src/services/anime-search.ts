/**
 * 动漫搜索服务
 * 元数据: Bangumi API
 * 磁力资源: AnimeTosho RSS（主源，聚合多站）+ Nyaa.si（备用，可能被CF拦截）+ Torrentio（TMDB ID 聚合）
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface BangumiSubject {
  id: number;
  name: string;
  nameCN: string;
  cover: string;
  summary: string;
  airDate: string;
  airWeekday?: number;
  rating: number;
  ratingCount?: number;
  rank?: number;
  eps: number;
  url: string;
  /** 作品类型：TV/OVA/Movie/Web/Music/Other */
  type?: string;
  /** 制作公司/工作室 */
  studio?: string;
  /** 标签（最多5个热门标签） */
  tags?: string[];
  /** 收藏数据 */
  collection?: { wish: number; collect: number; doing: number; dropped: number };
  /** 放送状态 */
  status?: string;
}

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
  source?: string;
  sourceLabel?: string;
  /** false = 该来源不提供做种数据（如 AnimeTosho RSS），显示 DHT 而非 0/0 */
  hasSeedData?: boolean;
  /** 原站详情页链接 */
  detailUrl?: string;
}

export interface MikanItem {
  title: string;
  magnet: string;
  size: string;
  pubDate: string;
  group: string;
}

export interface AnimeSearchResult {
  keyword: string;
  page: number;
  bgm: BangumiSubject[];
  nyaa: NyaaTorrent[];
  mikan: MikanItem[];
  total: number;
  errors: { bangumi: string | null; nyaa: string | null; mikan: string | null };
}

// ─── Constants ───────────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function httpGet(url: string, timeout = 15000): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.text();
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

// ─── AnimeTosho（主源：聚合 Nyaa/多站的 RSS，最稳定可靠）────────────

function parseAnimeToshoRss(xml: string): NyaaTorrent[] {
  const results: NyaaTorrent[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleM = block.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/i) || block.match(/<title>([^<]+)<\/title>/i);
    if (!titleM) continue;
    const title = decodeHtmlEntities(titleM[1].trim());

    // AnimeTosho 提供磁力链接在 <link> 或 <enclosure> 中
    const magnetM = block.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/i)
      || block.match(/<atm:magnetURI><!\[CDATA\[(magnet:\?xt=urn:btih:[^\]]+)\]\]>/i)
      || block.match(/<enclosure[^>]+url="(magnet:\?xt=urn:btih:[^"]+)"/i);
    const magnet = magnetM ? magnetM[1] : '';
    if (!magnet) continue;

    // 大小
    const sizeM = block.match(/<atm:contentLength>(\d+)<\/atm:contentLength>/i)
      || block.match(/<length>(\d+)<\/length>/i);
    const sizeBytes = sizeM ? parseInt(sizeM[1]) : 0;
    const size = sizeBytes > 1073741824 ? `${(sizeBytes / 1073741824).toFixed(1)} GiB`
      : sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(0)} MiB`
        : sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(0)} KiB` : '';

    // 发布日期
    const pubDateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);

    // 来源站点标记（从 description 中提取）
    const descM = block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i);
    let srcLabel = 'AnimeTosho';
    if (descM) {
      const srcMatch = descM[1].match(/<a[^>]+href="https?:\/\/nyaa\.si[^"]*"[^>]*>\s*(?:<span[^>]*>)?([^<]+)/i);
      if (srcMatch) srcLabel = `Nyaa · ${srcMatch[1].trim()}`;
    }

    results.push({
      id: `at-${Math.random().toString(36).slice(2, 8)}`,
      title,
      magnet,
      torrentUrl: '',
      size,
      date: pubDateM ? new Date(pubDateM[1]).toISOString().split('T')[0] : '',
      seeders: 0,
      leechers: 0,
      completed: 0,
      trusted: false,
      category: 'Anime',
      source: 'animetosho',
      sourceLabel: srcLabel,
      hasSeedData: false,
      // 从 description 中提取 Nyaa 原站链接作为详情页
      detailUrl: (() => {
        if (!descM) return undefined;
        const linkMatch = descM[1].match(/<a[^>]+href="(https?:\/\/nyaa\.si\/view\/\d+)"[^>]*/i);
        return linkMatch ? linkMatch[1] : undefined;
      })(),
    });
  }
  return results;
}

/** AnimeTosho 主搜索 */
async function fetchAnimeTosho(keyword: string): Promise<NyaaTorrent[]> {
  try {
    const xml = await httpGet(
      `https://feed.animetosho.org/rss2?q=${encodeURIComponent(keyword)}&orderby=seeds`,
      15000
    );
    return parseAnimeToshoRss(xml);
  } catch { return []; }
}

// ─── Nyaa.si（备用：可能被 Cloudflare 拦截）───────────────────────────

function parseNyaaRss(xml: string): NyaaTorrent[] {
  const results: NyaaTorrent[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleM = block.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/i) || block.match(/<title>([^<]+)<\/title>/i);
    if (!titleM) continue;
    const title = decodeHtmlEntities(titleM[1].trim());

    const magnetM = block.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/i) || block.match(/<enclosure[^>]+url="(magnet:\?xt=urn:btih:[^"]+)"[^>]*\/?>/i);
    const magnet = magnetM ? magnetM[1] : '';
    if (!magnet) continue;

    const linkM = block.match(/<link>([^<]+)<\/link>/i);
    const viewId = linkM ? (linkM[1].match(/view\/(\d+)/)?.[1] || '') : '';

    const sizeM = block.match(/<nyaa:size>([^<]+)<\/nyaa:size>/i) || block.match(/<length>([^<]+)<\/length>/i);
    const seedersM = block.match(/<nyaa:seeders>([^<]+)<\/nyaa:seeders>/i);
    const leechersM = block.match(/<nyaa:leechers>([^<]+)<\/nyaa:leechers>/i);
    const completedM = block.match(/<nyaa:completed>([^<]+)<\/nyaa:completed>/i);
    const catIdM = block.match(/<nyaa:categoryId>([^<]+)<\/nyaa:categoryId>/i);
    const trustM = block.match(/<nyaa:trusted>([^<]+)<\/nyaa:trusted>/i);
    const pubDateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);

    const categoryMap: Record<string, string> = {
      '1_0': 'Anime', '1_1': 'Anime Raw', '1_2': 'Anime Non-Eng',
      '1_3': 'Anime Eng', '2_0': 'Audio Lossless', '2_1': 'Audio Lossy',
      '3_0': 'Literature Eng', '3_1': 'Literature Non-Eng',
      '3_2': 'Literature Raw', '4_0': 'Live Action Eng',
      '4_1': 'Live Action Non-Eng', '4_2': 'Live Action Raw',
    };

    results.push({
      id: viewId, title, magnet,
      torrentUrl: viewId ? `https://nyaa.si/download/${viewId}.torrent` : '',
      size: sizeM ? sizeM[1].trim() : '',
      date: pubDateM ? new Date(pubDateM[1]).toISOString().split('T')[0] : '',
      seeders: parseInt(seedersM?.[1] || '0') || 0,
      leechers: parseInt(leechersM?.[1] || '0') || 0,
      completed: parseInt(completedM?.[1] || '0') || 0,
      trusted: trustM?.[1]?.toLowerCase() === 'true' || block.includes('<nyaa:trusted>true</nyaa:trusted>'),
      category: categoryMap[catIdM?.[1] || ''] || `Cat-${catIdM?.[1]}`,
      source: 'nyaa',
      sourceLabel: 'Nyaa.si',
      hasSeedData: true,
      detailUrl: viewId ? `https://nyaa.si/view/${viewId}` : undefined,
    });
  }
  return results;
}

/** Nyaa.si 搜索（带超时保护，避免 CF 拖慢整体响应） */
async function fetchNyaa(keyword: string, page: number): Promise<NyaaTorrent[]> {
  try {
    const rssXml = await httpGet(
      `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(keyword)}&s=seeders&o=desc&p=${page}&rss=1`,
      8000  // 短超时，快速失败
    );
    return parseNyaaRss(rssXml);
  } catch { return []; }
}

// ─── Mikan Project（保留但降低优先级，经常超时）──────────────────────

function parseMikanRss(xml: string): MikanItem[] {
  const items: MikanItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleM = block.match(/<title><!\[CDATA\[([^\]]*(?:\][^\]]*]*)*)\]\]><\/title>/is) || block.match(/<title>([^<]+)<\/title>/i);
    const title = titleM ? decodeHtmlEntities(titleM[1].trim()) : '';

    const magnetM = block.match(/href="(magnet:\?xt=urn:btih:.{20,})"/i) || block.match(/<enclosure\s+url="(magnet:\?xt=urn:btih:.{20,})"/i);
    const magnet = magnetM ? magnetM[1] : '';
    if (!magnet.startsWith('magnet:')) continue;

    const sizeM = block.match(/<size>([^<]+)<\/size>/i) || block.match(/contentLength[":\s>]+(\d+)/i);
    const sizeBytes = sizeM ? parseInt(sizeM[1]) : 0;
    const size = sizeBytes > 1073741824 ? `${(sizeBytes / 1073741824).toFixed(1)} GiB`
      : sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(0)} MiB`
        : sizeBytes > 1024 ? `${(sizeBytes / 1024).toFixed(0)} KiB`
          : `${sizeBytes} B`;

    const dateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
    const groupM = block.match(/<author>[^<]*<name>([^<]+)<\/name>/i) || title.match(/^\[([^\]]+)\]/);

    items.push({ title, magnet, size, pubDate: dateM ? dateM[1].trim() : '', group: groupM ? groupM[1].trim() : '' });
  }
  return items;
}

/** Mikan 搜索（短超时保护） */
async function fetchMikan(keyword: string): Promise<MikanItem[]> {
  try {
    const xml = await httpGet(
      `https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(keyword)}`,
      8000  // 短超时，Mikan 经常超时
    );
    return parseMikanRss(xml);
  } catch { return []; }
}

// ─── Bangumi 元数据 ───────────────────────────────────────────────────

async function fetchBangumi(keyword: string): Promise<BangumiSubject[]> {
  try {
    const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword)}?type=2&responseGroup=large&max_results=6`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'codeseek/1.0 (https://github.com/Zoroaaa)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const data = await r.json() as { list?: any[] };
    if (!data.list?.length) return [];
    return data.list.map((s: any) => {
      // 提取制作公司（从 staff 或 infobox 中）
      const studio = s.infobox?.find((i: any) => i.key === '动画制作' || i.key === 'Studio')?.value
        || s.staff?.find((st: any) => st.position === '动画制作')?.person?.name
        || '';
      // 提取标签（按热度排序，取前5）
      const tagsRaw = s.tags?.sort((a: any, b: any) => (b.count || 0) - (a.count || 0)) || [];
      const tags = tagsRaw.slice(0, 5).map((t: any) => t.name);
      // 放送状态推断
      let status = '';
      if (s.eps_count > 0 && s.air_date) {
        const airDate = new Date(s.air_date);
        const now = new Date();
        if (now < airDate) status = '未开播';
        else status = '已完结';
      }
      if ((s.collection?.doing || 0) > 0 && !status.includes('已完结')) status = '连载中';

      return {
        id: s.id,
        name: s.name || '',
        nameCN: s.name_cn || s.name || '',
        cover: s.images?.large || s.images?.common || s.images?.medium || '',
        summary: (s.summary || '').slice(0, 300),
        airDate: s.air_date || '',
        airWeekday: s.air_weekday ?? -1,
        rating: s.rating?.score ?? 0,
        ratingCount: s.rating?.total ?? 0,
        rank: s.rank ?? 0,
        eps: s.eps_count ?? s.eps ?? 0,
        url: `https://bgm.tv/subject/${s.id}`,
        type: s.type || '',           // TV / OVA / Movie / Web / Music
        studio: studio || '',          // 制作公司
        tags: tags.length ? tags : undefined,
        collection: s.collection ? {
          wish: s.collection.wish || 0,
          collect: s.collection.collect || 0,
          doing: s.collection.doing || 0,
          dropped: s.collection.dropped || 0,
        } : undefined,
        status: status || undefined,
      };
    });
  } catch { return []; }
}

// ─── 主入口 ────────────────────────────────────────────────────────────

export async function searchAnime(keyword: string, page = 1): Promise<AnimeSearchResult> {
  // 并行请求所有数据源
  const [bgmResult, animetoshoResult, nyaaResult, mikanResult] = await Promise.allSettled([
    fetchBangumi(keyword),
    fetchAnimeTosho(keyword),   // 主源
    fetchNyaa(keyword, page),   // 备用
    fetchMikan(keyword),        // 低优先级
  ]);

  const bgm = bgmResult.status === 'fulfilled' ? bgmResult.value : [];

  // AnimeTosho（主源）+ Nyaa（补充）合并去重
  const toshoRaw = animetoshoResult.status === 'fulfilled' ? animetoshoResult.value : [];
  const nyaaRaw = nyaaResult.status === 'fulfilled' ? nyaaResult.value : [];

  // 按 btih hash 去重
  const seenHashes = new Set<string>();
  const addTorrent = (t: NyaaTorrent) => {
    const key = t.magnet.slice(20, 60);
    if (seenHashes.has(key)) return false;
    seenHashes.add(key); return true;
  };

  // AnimeTosho 结果在前（主源），Nyaa 补充在后
  const nyaa: NyaaTorrent[] = [
    ...toshoRaw.filter(addTorrent),
    ...nyaaRaw.filter(addTorrent),
  ];

  const mikan = mikanResult.status === 'fulfilled' ? mikanResult.value : [];

  // 错误信息：只有当所有磁力源都失败时才报错
  const nyaaError = (animetoshoResult.status === 'rejected' && nyaaResult.status === 'rejected')
    ? `AnimeTosho: ${String(animetoshoResult.reason)}; Nyaa: ${String(nyaaResult.reason)}`
    : null;

  return {
    keyword,
    page,
    bgm: bgm.slice(0, 6),
    nyaa,
    mikan,
    total: nyaa.length + mikan.length,
    errors: {
      bangumi: bgmResult.status === 'rejected' ? String(bgmResult.reason) : null,
      nyaa: nyaaError,
      mikan: mikanResult.status === 'rejected' ? String(mikanResult.reason) : null,
    },
  };
}
