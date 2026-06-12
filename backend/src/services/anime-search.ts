/**
 * 动漫搜索服务
 * 元数据: Bangumi API
 * 磁力资源: Nyaa.si 搜索页 + 详情页提取磁力链接
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

// ─── Nyaa.si 搜索（解析 HTML 搜索页 + 批量抓详情拿 magnet）─────────

const NYAA_ACTIVE_TRACKERS = [
  'udp://tracker.openbittorrent.com:6969/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.stealth.si:80/announce',
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

/** 解析 Nyaa 搜索页 HTML，提取种子列表（含 magnet） */
interface NyaaSearchItem {
  viewId: string;
  title: string;
  size: string;
  date: string;
  seeders: number;
  leechers: number;
  completed: number;
  category: string;
  trusted: boolean;
  magnet: string;           // 从搜索页直接提取
}

function parseNyaaSearchHtml(html: string): NyaaSearchItem[] {
  const results: NyaaSearchItem[] = [];
  // 匹配每个 torrent 行
  const rowRe = /<tr[^>]*class="[^"]*default"[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;

  while ((m = rowRe.exec(html)) !== null) {
    const row = m[1];

    // 提取 view ID 和标题
    const titleLinkM = row.match(/<a[^>]*href="\/view\/(\d+)"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i)
      || row.match(/<a[^>]*href="\/view\/(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleLinkM) continue;

    const viewId = titleLinkM[1];
    let title = titleLinkM[2] || '';
    if (!title) {
      const rawTitle = titleLinkM[3] || '';
      title = rawTitle.replace(/<[^>]+>/g, '').trim();
    }
    title = decodeHtmlEntities(title);
    if (!title) continue;

    // 直接从搜索行提取 magnet（U 形图标链接）
    let magnet = '';
    const magM = row.match(/href="(magnet:\?xt=urn:btih:[^"]+)"/i);
    if (magM) {
      const rawMag = magM[1].replace(/&amp;/g, '&');
      const hashMatch = rawMag.match(/btih:([a-fA-F0-9]{40})/i);
      if (hashMatch) {
        magnet = `magnet:?xt=urn:btih:${hashMatch[1].toLowerCase()}${NYAA_ACTIVE_TRACKERS}`;
      }
    }

    // 大小
    const sizeM = row.match(/<td[^>]*class="[^"]*size"[^>]*>\s*([\d.]+\s*(?:GiB|MiB|KiB|B|TB|GB|MB|KB))\s*<\/td>/i);

    // 日期
    const dateM = row.match(/<td[^>]*class="[^"]*date"[^>]*>\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*<\/td>/i);

    // 做种/下载/完成数
    const statsM = row.match(/<td[^>]*class="[^"]*seeders"[^>]*>\s*(\d+)\s*<\/td>[\s\S]*?<td[^>]*class="[^"]*leechers"[^>]*>\s*(\d+)\s*<\/td>[\s\S]*?<td[^>]*class="[^"]*completed"[^>]*>\s*(\d+)\s*<\/td>/i);

    // 分类图标 → 分类名
    const catMap: Record<string, string> = {
      '1_2': 'Anime Eng', '1_3': 'Anime Non-Eng', '1_4': 'Anime Raw',
      '0_0': 'All', '1_0': 'Anime', '2_0': 'Audio', '3_0': 'Literature', '4_0': 'Live Action',
    };
    const catIdM = row.match(/\/static\/img\/icons\/nyaa\/(\d+_\d+)\.png/i);
    const category = catIdM ? (catMap[catIdM[1]] || 'Other') : 'Anime';

    // 是否为 Trusted/A+ 上传者
    const trusted = /trusted|a-plus|class="[^"]*trusted/i.test(row);

    results.push({
      viewId,
      title,
      size: sizeM ? sizeM[1] : '',
      date: dateM ? dateM[1] : '',
      seeders: statsM ? parseInt(statsM[1]) || 0 : 0,
      leechers: statsM ? parseInt(statsM[2]) || 0 : 0,
      completed: statsM ? parseInt(statsM[3]) || 0 : 0,
      category,
      trusted,
      magnet,
    });
  }
  return results;
}

/** Nyaa 主搜索（一步到位：搜索页直接拿到所有数据 + magnet） */
async function fetchNyaa(keyword: string): Promise<NyaaTorrent[]> {
  try {
    const html = await httpGet(
      `https://nyaa.si/?f=0&c=1_0&q=${encodeURIComponent(keyword)}&s=seeders&o=desc`,
      12000
    );
    const items = parseNyaaSearchHtml(html);

    return items.map(item => ({
      id: item.viewId,
      title: item.title,
      magnet: item.magnet,                          // 搜索页直接提取
      torrentUrl: item.viewId ? `https://nyaa.si/download/${item.viewId}.torrent` : '',
      size: item.size,
      date: item.date ? item.date.split(' ')[0] : '',
      seeders: item.seeders,
      leechers: item.leechers,
      completed: item.completed,
      trusted: item.trusted,
      category: item.category,
      source: 'nyaa',
      sourceLabel: 'Nyaa.si',
      hasSeedData: true,
      detailUrl: `https://nyaa.si/view/${item.viewId}`,
    }));
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
  // 并行：Bangumi 元数据 + Nyaa.si 磁力资源
  const [bgmResult, nyaaResult] = await Promise.allSettled([
    fetchBangumi(keyword),
    fetchNyaa(keyword),
  ]);

  const bgm = bgmResult.status === 'fulfilled' ? bgmResult.value : [];
  const nyaa: NyaaTorrent[] = nyaaResult.status === 'fulfilled' ? nyaaResult.value : [];

  return {
    keyword,
    page,
    bgm: bgm.slice(0, 6),
    nyaa,
    mikan: [],
    total: nyaa.length,
    errors: {
      bangumi: bgmResult.status === 'rejected' ? String(bgmResult.reason) : null,
      nyaa: nyaaResult.status === 'rejected' ? String(nyaaResult.reason) : null,
      mikan: null,
    },
  };
}
