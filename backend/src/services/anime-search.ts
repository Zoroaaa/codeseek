/**
 * 动漫搜索服务
 * 数据源：Bangumi API（元数据）+ Nyaa.si / Mikan Project（磁力）
 * 被 /api/anime/search 和 /api/search（聚合模式）共同使用
 */

// ─── Types ──────────────────────────────────────────────────────────────

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
    .replace(/</g, '<').replace(/>/g, '>')
    .replace(/"/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
}

// ─── Nyaa.si ───────────────────────────────────────────────────────────

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
      '1_0': 'Anime - Sub', '1_1': 'Anime - Raw', '1_2': 'Anime - Non-English',
      '1_3': 'Anime - English Translated', '2_0': 'Audio - Lossless', '2_1': 'Audio - Lossy',
      '3_0': 'Literature - English Translated', '3_1': 'Literature - Non-English',
      '3_2': 'Literature - Raw', '4_0': 'Live Action - English Translated',
      '4_1': 'Live Action - Non-English', '4_2': 'Live Action - Raw', '4_3': 'Live Action - Idol/Promotional Video',
      '4_4': 'Live Action - Other', '5_0': 'Pictures - Graphics', '5_1': 'Pictures - Photos',
      '6_0': 'Software - Applications', '6_1': 'Software - Games',
    };

    results.push({
      id: viewId, title, magnet,
      torrentUrl: viewId ? `https://nyaa.si/download/${viewId}.torrent` : '',
      size: sizeM ? sizeM[1].trim() : '',
      date: pubDateM ? new Date(pubDateM[1]).toISOString().split('T')[0] : '',
      seeders: parseInt(seedersM?.[1] || '0') || 0,
      leechers: parseInt(leechersM?.[1] || '0') || 0,
      completed: parseInt(completedM?.[1] || '0') || 0,
      trusted: trustM?.[1]?.toLowerCase() === 'true' || trustM?.[1] === '1' || block.includes('<nyaa:trusted>true</nyaa:trusted>'),
      category: categoryMap[catIdM?.[1] || ''] || `Cat-${catIdM?.[1]}`,
    });
  }
  return results;
}

function parseNyaaHtml(html: string): NyaaTorrent[] {
  const results: NyaaTorrent[] = [];
  const tbodyM = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!tbodyM) return results;

  const rowRe = /<tr\s+(?:class="([^"]*)")?\s*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(tbodyM[1])) !== null) {
    const tds: string[] = [];
    const tdRe = /<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gi;
    let td: RegExpExecArray | null;
    while ((td = tdRe.exec(row[2]))) tds.push(td[1]);
    if (tds.length < 7) continue;

    const titleM = tds[1].match(/<a\s+href="\/view\/(\d+)"(?:\s[^>]*)?>([^<]*(?:<(?!\/a)[^<]*)*?)<\/a>/i);
    if (!titleM) continue;

    const magnetM = tds[2].match(/href="(magnet:\?xt=[^"]+)"/i);
    if (!magnetM) continue;

    const catM = tds[0].match(/title="([^"]+)"/i) || tds[0].match(/alt="([^"]+)"/i);
    const tsM = tds[4].match(/data-timestamp="(\d+)"/i);

    results.push({
      id: titleM[1],
      title: decodeHtmlEntities(titleM[2].replace(/<[^>]+>/g, '').trim()),
      magnet: magnetM[1],
      torrentUrl: `https://nyaa.si/download/${titleM[1]}.torrent`,
      size: tds[3].replace(/<[^>]+>/g, '').trim(),
      date: tsM ? new Date(parseInt(tsM[1]) * 1000).toISOString().split('T')[0] : tds[4].replace(/<[^>]+>/g, '').trim(),
      seeders: parseInt(tds[5].replace(/<[^>]+>/g, '').trim()) || 0,
      leechers: parseInt(tds[6].replace(/<[^>]+>/g, '').trim()) || 0,
      completed: 0,
      category: catM ? catM[1] : 'Anime',
      trusted: row[1]?.includes('success'),
    });
  }
  return results;
}

async function fetchNyaa(keyword: string, page: number): Promise<NyaaTorrent[]> {
  try {
    const rssXml = await httpGet(`https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(keyword)}&s=seeders&o=desc&p=${page}&rss=1`, 12000);
    const rssResults = parseNyaaRss(rssXml);
    if (rssResults.length > 0) return rssResults;
    const html = await httpGet(`https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(keyword)}&s=seeders&o=desc&p=${page}`, 12000);
    return parseNyaaHtml(html);
  } catch { return []; }
}

// ─── Mikan Project ─────────────────────────────────────────────────────

function parseMikanRss(xml: string): MikanItem[] {
  const items: MikanItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];
    const titleM = block.match(/<title><!\[CDATA\[([^\]]*(?:\][^\]]*]*)*)\]\]><\/title>/is) || block.match(/<title>([^<]+)<\/title>/i);
    const title = titleM ? decodeHtmlEntities(titleM[1].trim()) : '';

    const magnetM = block.match(/href="(magnet:\?xt=urn:btih:{20,})"/i) || block.match(/<enclosure\s+url="(magnet:\?xt=urn:btih:{20,})"/i);
    const magnet = magnetM ? magnetM[1] : '';
    if (!magnet.startsWith('magnet:')) continue;

    const sizeM = block.match(/<size>([^<]+)<\/size>/i) || block.match(/contentLength["\s>:]+(\d+)/i);
    const sizeBytes = sizeM ? parseInt(sizeM[1]) : 0;
    const size = sizeBytes > 1073741824 ? `${(sizeBytes / 1073741824).toFixed(1)} GiB`
      : sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(0)} MiB`
        : sizeBytes > 1024 ? `${(sizeBytes / 1024).toFixed(0)} KiB`
          : `${sizeBytes} B`;

    const dateM = block.match(/<pubDate>([^<]+)<\/pubDate>/i);
    const groupM = block.match(/<author>[^<]*<name>([^<]+)<\/name>/i) || block.match(/torrent:author[^>]*>\s*([^<\s]+)/i) || title.match(/^\[([^\]]+)\]/);

    items.push({ title, magnet, size, pubDate: dateM ? dateM[1].trim() : '', group: groupM ? groupM[1].trim() : '' });
  }
  return items;
}

async function fetchMikan(keyword: string): Promise<MikanItem[]> {
  try {
    const xml = await httpGet(`https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(keyword)}`, 10000);
    return parseMikanRss(xml);
  } catch { return []; }
}

// ─── Bangumi ───────────────────────────────────────────────────────────

async function fetchBangumi(keyword: string): Promise<BangumiSubject[]> {
  try {
    const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword)}?type=2&responseGroup=small&max_results=6`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'codeseek/1.0 (https://codeseek.pp.ua)', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return [];
    const data = await r.json() as { list?: any[] };
    if (!data.list?.length) return [];
    return data.list.map((s: any) => ({
      id: s.id, name: s.name || '', nameCN: s.name_cn || s.name || '',
      cover: s.images?.large || s.images?.common || '',
      summary: (s.summary || '').slice(0, 200), airDate: s.air_date || '',
      rating: s.rating?.score ?? 0, eps: s.eps_count ?? s.eps ?? 0,
      url: `https://bgm.tv/subject/${s.id}`,
    }));
  } catch { return []; }
}

// ─── 主入口 ────────────────────────────────────────────────────────────

/**
 * 执行动漫搜索（供路由层调用）
 */
export async function searchAnime(keyword: string, page = 1): Promise<AnimeSearchResult> {
  const [bgmList, nyaaResult, mikanResult] = await Promise.allSettled([
    fetchBangumi(keyword),
    fetchNyaa(keyword, page),
    fetchMikan(keyword),
  ]);

  const bgm = bgmList.status === 'fulfilled' ? bgmList.value : [];
  const nyaa = nyaaResult.status === 'fulfilled' ? nyaaResult.value : [];
  const mikan = mikanResult.status === 'fulfilled' ? mikanResult.value : [];

  return {
    keyword,
    page,
    bgm: bgm.slice(0, 6),
    nyaa,
    mikan,
    total: nyaa.length + mikan.length,
    errors: {
      bangumi: bgmList.status === 'rejected' ? String(bgmList.reason) : null,
      nyaa: nyaaResult.status === 'rejected' ? String(nyaaResult.reason) : null,
      mikan: mikanResult.status === 'rejected' ? String(mikanResult.reason) : null,
    },
  };
}
