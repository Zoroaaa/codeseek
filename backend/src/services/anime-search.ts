/**
 * 动漫搜索服务
 * 元数据: Bangumi API
 * 磁力资源: Nyaa.si RSS（?page=rss）
 *
 * 改用 RSS 原因：
 *   HTML 接口从 Cloudflare Workers 出站 IP 请求时触发 bot protection，
 *   返回 403 或 JS challenge 页，原 HTML 正则静默失败返回空数组。
 *   RSS 接口对机器客户端宽松，且字段语义明确，无需脆弱的 HTML 解析。
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
  type?: string;
  studio?: string;
  tags?: string[];
  collection?: { wish: number; collect: number; doing: number; dropped: number };
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
  hasSeedData?: boolean;
  detailUrl?: string;
}

export interface MikanItem {
  title: string;
  magnet: string;
  size: string;
  pubDate: string;
  group: string;
}

/** SubsPlease 单条资源 */
export interface SubsPleaseItem {
  title: string;
  magnet: string;
  episode: string;
  resolution: string;
  date: string;
}

/** showRSS 单条资源 */
export interface ShowRssItem {
  title: string;
  magnet: string;
}

export interface AnimeSearchResult {
  keyword: string;
  page: number;
  bgm: BangumiSubject[];
  nyaa: NyaaTorrent[];
  mikan: MikanItem[];
  animetosho: NyaaTorrent[];
  subsplease: SubsPleaseItem[];
  showrss: ShowRssItem[];
  total: number;
  errors: {
    bangumi: string | null;
    nyaa: string | null;
    mikan: string | null;
    animetosho: string | null;
    subsplease: string | null;
    showrss: string | null;
  };
}

// ─── 通用工具：带重试的 fetch ────────────────────────────────────────

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
}

async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts?: RetryOptions
): Promise<Response> {
  const { retries = 2, baseDelay = 1000 } = opts ?? {};
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, init);
      // 429 Too Many Requests → 重试
      if (r.status === 429 && i < retries) {
        const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
        console.warn(`[retry] ${url} → 429, retry #${i + 1} after ${Math.round(delay)}ms`);
        await new Promise(res => setTimeout(res, delay));
        continue;
      }
      return r;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (i < retries) {
        const delay = baseDelay * Math.pow(2, i);
        console.warn(`[retry] ${url} → error, retry #${i + 1} after ${Math.round(delay)}ms`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  throw lastError || new Error('fetchWithRetry exhausted');
}

// ─── Nyaa.si RSS 搜索 ─────────────────────────────────────────────────

const NYAA_TRACKERS = [
  'http://nyaa.tracker.wf:7777/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.torrent.eu.org:451/announce',
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

const NYAA_CAT_MAP: Record<string, string> = {
  '1_1': 'Anime Music Video',
  '1_2': 'Anime Eng',
  '1_3': 'Anime Non-Eng',
  '1_4': 'Anime Raw',
  '1_0': 'Anime',
  '0_0': 'All',
};

/** 提取 XML 单个标签文本，自动处理 CDATA */
function xmlTag(xml: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`,
    'i'
  );
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

/** RFC-2822 pubDate → YYYY-MM-DD */
function parseRssDate(pubDate: string): string {
  if (!pubDate) return '';
  try {
    const d = new Date(pubDate);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  } catch { return ''; }
}

/** 解析 Nyaa RSS XML，返回 NyaaTorrent 列表 */
function parseNyaaRss(xml: string): NyaaTorrent[] {
  // 拿到 HTML 说明被 bot protection 拦截或重定向，抛出而非静默返回 []
  if (/<html[\s>]/i.test(xml)) {
    throw new Error('nyaa_rss_blocked: response is HTML (bot protection or redirect)');
  }
  if (!xml.includes('<item')) {
    return []; // 正常无结果
  }

  const results: NyaaTorrent[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1];

    const title = xmlTag(item, 'title');
    if (!title) continue;

    const infoHash = xmlTag(item, 'nyaa:infoHash').toLowerCase();
    // infoHash 是 40 位 hex，缺失则跳过（非正常 torrent 条目）
    if (!infoHash || !/^[a-f0-9]{40}$/.test(infoHash)) continue;

    // 从 <link> 提取 view ID
    const linkM = item.match(/<link>\s*(https?:\/\/nyaa\.si\/view\/(\d+))\s*<\/link>/i);
    const viewId = linkM?.[2] ?? '';

    const magnet     = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${NYAA_TRACKERS}`;
    const catId      = xmlTag(item, 'nyaa:categoryId');
    const trusted    = xmlTag(item, 'nyaa:trusted').toLowerCase() === 'yes';
    const size       = xmlTag(item, 'nyaa:size');
    const date       = parseRssDate(xmlTag(item, 'pubDate'));
    const seeders    = parseInt(xmlTag(item, 'nyaa:seeders'))   || 0;
    const leechers   = parseInt(xmlTag(item, 'nyaa:leechers'))  || 0;
    const completed  = parseInt(xmlTag(item, 'nyaa:downloads')) || 0;

    results.push({
      id:          viewId,
      title,
      magnet,
      torrentUrl:  viewId ? `https://nyaa.si/download/${viewId}.torrent` : '',
      size,
      date,
      seeders,
      leechers,
      completed,
      trusted,
      category:    NYAA_CAT_MAP[catId] ?? 'Anime',
      source:      'nyaa',
      sourceLabel: 'Nyaa.si',
      hasSeedData: true,
      detailUrl:   viewId ? `https://nyaa.si/view/${viewId}` : '',
    });
  }
  return results;
}

/** Nyaa RSS 主搜索，带 429 重试（指数退避，最多 2 次） */
async function fetchNyaa(keyword: string): Promise<NyaaTorrent[]> {
  const url = `https://nyaa.si/?page=rss&q=${encodeURIComponent(keyword)}&c=1_0&f=0`;
  const r = await fetchWithRetry(url, {
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; FeedFetcher/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  }, { retries: 2, baseDelay: 1500 });

  if (!r.ok) {
    throw new Error(`nyaa_rss_http_${r.status}`);
  }

  const xml = await r.text();
  return parseNyaaRss(xml);
}

// ─── AnimeTosho JSON API ──────────────────────────────────────────────

/**
 * URL: https://feed.animetosho.org/json?q={keyword}
 * 无需 key，无 bot 检测，返回最多 ~30 条
 * 返回格式复用 NyaaTorrent（结构一致）
 */
async function fetchAnimeTosho(keyword: string): Promise<NyaaTorrent[]> {
  const url = `https://feed.animetosho.org/json?q=${encodeURIComponent(keyword)}`;
  const r = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CodeSeek/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!r.ok) {
    throw new Error(`animetosho_http_${r.status}`);
  }

  const data = await r.json() as Array<{
    id: number;
    title: string;
    magnet_uri: string;
    torrent_url?: string;
    seeders?: number;
    leechers?: number;
    torrent_downloaded_count?: number;
    file_size?: number;
    timestamp?: number;
    nyaa_id?: number;
    website_url?: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) return [];

  return data.map(item => ({
    id: String(item.nyaa_id ?? item.id ?? ''),
    title: item.title || '',
    magnet: item.magnet_uri || '',
    torrentUrl: item.torrent_url || '',
    size: item.file_size != null ? formatBytesAT(item.file_size) : '',
    date: item.timestamp ? new Date(item.timestamp * 1000).toISOString().slice(0, 10) : '',
    seeders: item.seeders || 0,
    leechers: item.leechers || 0,
    completed: item.torrent_downloaded_count || 0,
    trusted: false,
    category: 'Anime',
    source: 'animetosho' as const,
    sourceLabel: 'AnimeTosho',
    hasSeedData: !!item.seeders,
    detailUrl: item.nyaa_id
      ? `https://nyaa.si/view/${item.nyaa_id}`
      : (item.website_url || ''),
  }));
}

/** bytes → 可读字符串（AnimeTosho 用，避免与 movie-search 的 formatBytes 冲突命名） */
function formatBytesAT(bytes: number): string {
  if (!bytes) return '';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GiB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
}

// ─── Mikan Project RSS 搜索 ────────────────────────────────────────────

/**
 * Mikan Project RSS 搜索
 * URL: https://mikanani.me/RSS/Search?searchstr={keyword}
 *
 * Mikan RSS 不直接提供 magnet 链接：
 *   <link>       → 番剧页面 URL（非 magnet）
 *   <enclosure>  → .torrent 文件下载地址
 *
 * 策略：下载 .torrent → bencode 解析提取 infoHash → 拼接 magnet
 */

const MIKAN_TRACKERS = [
  'udp://open.stealth.si:80/announce',
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://exodus.desync.com:6969/announce',
  'udp://tracker.openbittorrent.com:6969/announce',
].map(t => `&tr=${encodeURIComponent(t)}`).join('');

// ── 最小 bencode 解码器（仅支持解析 .torrent 提取 info hash ──

function decodeBencodeString(buf: Uint8Array, pos: [number]): Uint8Array {
  let lenStr = '';
  while (buf[pos[0]] !== 0x3a) { // ':'
    lenStr += String.fromCharCode(buf[pos[0]]);
    pos[0]++;
  }
  pos[0]++; // skip ':'
  const len = parseInt(lenStr, 10);
  const str = buf.slice(pos[0], pos[0] + len);
  pos[0] += len;
  return str;
}

/**
 * 从 .torrent 文件二进制数据中提取 infoHash（SHA1 of info dict）
 */
async function extractInfoHashFromTorrent(data: ArrayBuffer): Promise<string | null> {
  const buf = new Uint8Array(data);
  const pos: [number] = [0];

  // 外层必须是 dict (d)
  if (buf[pos[0]] !== 0x64) return null; // 'd'
  pos[0]++;

  // 找到 "info" key 对应的值（跳过其他 key-value）
  while (buf[pos[0]] !== 0x65) { // 直到外层 'e'
    // 读 key
    if (buf[pos[0]] >= 0x30 && buf[pos[0]] <= 0x39) { // digit = string key
      const keyBytes = decodeBencodeString(buf, pos);
      const key = new TextDecoder().decode(keyBytes);
      if (key === 'info') {
        // 找到了！info dict 的起始位置
        const infoStart = pos[0];
        // 跳过整个 info dict value（不解析内部，只定位结束位置）
        skipBencodeValue(buf, pos);
        const infoEnd = pos[0];
        // SHA1 of info dict bytes = infoHash
        const infoBytes = buf.slice(infoStart, infoEnd);
        return arrayBufferToHexSHA1(infoBytes.buffer as ArrayBuffer || infoBytes);
      } else {
        // 跳过 value
        skipBencodeValue(buf, pos);
      }
    } else {
      break; // unexpected char
    }
  }

  return null;
}

function skipBencodeValue(buf: Uint8Array, pos: [number]): void {
  const c = buf[pos[0]];
  if (c === 0x69) { // 'i' -> int
    pos[0]++;
    while (buf[pos[0]] !== 0x65) pos[0]++;
    pos[0]++; // skip 'e'
  } else if (c === 0x6c) { // 'l' -> list
    pos[0]++;
    while (buf[pos[0]] !== 0x65) skipBencodeValue(buf, pos);
    pos[0]++; // skip 'e'
  } else if (c === 0x64) { // 'd' -> dict
    pos[0]++;
    while (buf[pos[0]] !== 0x65) {
      if (buf[pos[0]] >= 0x30 && buf[pos[0]] <= 0x39) {
        decodeBencodeString(buf, pos); // key
        skipBencodeValue(buf, pos);     // value
      } else {
        break;
      }
    }
    pos[0]++; // skip 'e'
  } else if (c >= 0x30 && c <= 0x39) { // digit -> string
    decodeBencodeString(buf, pos);
  } else {
    pos[0]++;
  }
}

async function arrayBufferToHexSHA1(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 从 torrent URL 下载并提取 infoHash，生成 magnet */
async function torrentUrlToMagnet(torrentUrl: string, title: string): Promise<string> {
  try {
    const r = await fetch(torrentUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!r.ok) return '';
    const data = await r.arrayBuffer();
    const infoHash = await extractInfoHashFromTorrent(data);
    if (!infoHash) return '';
    return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(title)}${MIKAN_TRACKERS}`;
  } catch {
    return '';
  }
}

async function fetchMikan(keyword: string): Promise<MikanItem[]> {
  const url = `https://mikanani.me/RSS/Search?searchstr=${encodeURIComponent(keyword)}`;
  const r = await fetchWithRetry(url, {
    headers: {
      'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; FeedFetcher/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  }, { retries: 1, baseDelay: 1000 });

  if (!r.ok) {
    throw new Error(`mikan_http_${r.status}`);
  }

  const xml = await r.text();

  // 检查是否被重定向到 HTML 页面
  if (/<html[\s>]/i.test(xml)) {
    throw new Error('mikan_blocked: response is HTML (bot protection or redirect)');
  }

  if (!xml.includes('<item')) {
    return []; // 正常无结果
  }

  const rawItems: Array<{
    title: string;
    size: string;
    pubDate: string;
    group: string;
    torrentUrl: string;
    pageUrl: string;
  }> = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1];

    const title = xmlTag(item, 'title');
    if (!title) continue;

    // <enclosure> 提取 torrent URL 和 size
    const enclosureM = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*length="(\d+)"[^>]*>/i);
    const torrentUrl = enclosureM?.[1] || '';
    const sizeBytes = enclosureM?.[2] ? parseInt(enclosureM[2]) : 0;

    // <link> 番剧页面 URL
    const pageUrl = xmlTag(item, 'link');

    // 从 <description> 提取字幕组名
    const desc = xmlTag(item, 'description');
    const groupMatch = desc.match(/字幕组[：:]\s*(.+?)(?:<br\s*\/?>|\s*$)/i);
    const group = groupMatch?.[1]?.trim() || '';

    rawItems.push({
      title,
      size: sizeBytes ? formatBytesAT(sizeBytes) : '',
      pubDate: parseRssDate(xmlTag(item, 'pubDate')),
      group,
      torrentUrl,
      pageUrl,
    });
  }

  // 并发从 .torrent 提取 infoHash 生成 magnet（限制并发数避免打爆 Mikan）
  const BATCH_SIZE = 5;
  const results: MikanItem[] = [];

  for (let i = 0; i < rawItems.length; i += BATCH_SIZE) {
    const batch = rawItems.slice(i, i + BATCH_SIZE);
    const magnets = await Promise.allSettled(
      batch.map(item => torrentUrlToMagnet(item.torrentUrl, item.title))
    );

    for (let j = 0; j < batch.length; j++) {
      const item = batch[j];
      const m = magnets[j];
      const magnet = m.status === 'fulfilled' ? m.value : '' as string;
      results.push({
        title: item.title,
        magnet,
        size: item.size,
        pubDate: item.pubDate,
        group: item.group,
      });
    }
  }

  return results.slice(0, 30);
}

// ─── SubsPlease API 搜索 ──────────────────────────────────────────────

/**
 * SubsPlease API 搜索
 * 策略：
 *   1. GET /api/?f=shows 获取番剧列表
 *   2. 用关键词模糊匹配找到 show_id（匹配 title 或 altname）
 *   3. GET /api/?f=show&sid={id} 获取该番剧最新发布
 *   4. 从 downloads[].torrent 提取 magnet
 */

/** SubsPlease show 列表项 */
interface SpShow {
  id: string;
  title: string;
  altnames?: string[];
}

async function fetchSubsPlease(keyword: string): Promise<SubsPleaseItem[]> {
  try {
    // Step 1: 获取番剧列表
    const showsUrl = 'https://subsplease.org/api/?f=shows';
    const showsR = await fetchWithRetry(showsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    }, { retries: 1, baseDelay: 1000 });

    if (!showsR.ok) throw new Error(`subsplease_shows_http_${showsR.status}`);

    const showsData = await showsR.json() as SpShow[];
    if (!Array.isArray(showsData)) return [];

    // 关键词模糊匹配（不区分大小写）
    const kw = keyword.toLowerCase();
    const matched = showsData.filter(s =>
      s.title.toLowerCase().includes(kw) ||
      s.altnames?.some(a => a.toLowerCase().includes(kw))
    ).slice(0, 3); // 最多匹配 3 个番剧

    if (matched.length === 0) return [];

    // Step 2: 并发获取每个匹配番剧的最新发布
    const allResults: SubsPleaseItem[] = [];

    for (const show of matched) {
      try {
        const detailUrl = `https://subsplease.org/api/?f=show&tz=Asia/Tokyo&sid=${show.id}`;
        const detailR = await fetch(detailUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(12000),
        });

        if (!detailR.ok) continue;

        const ep = await detailR.json() as {
          episode?: string;
          title?: string;
          downloads?: Array<{
            res: string;
            torrent: string;
          }>;
        };

        if (!ep.downloads?.length) continue;

        const showTitle = ep.title || show.title;

        for (const dl of ep.downloads) {
          if (!dl.torrent || !dl.torrent.startsWith('magnet:?')) continue;

          allResults.push({
            title: `[${showTitle}] E${ep.episode ?? '?'} [${dl.res}p]`,
            magnet: dl.torrent,
            episode: ep.episode ?? '',
            resolution: dl.res,
            date: new Date().toISOString().slice(0, 10),
          });
        }
      } catch {
        // 单个番剧失败不影响其他
      }
    }

    return allResults.slice(0, 20);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }
}

// ─── showRSS RSS 搜索 ────────────────────────────────────────────────

/**
 * showRSS RSS 搜索
 * URL: https://showrss.info/show/{id}.rss
 * <link> 直接包含 magnet 链接
 *
 * 使用热门动漫频道 ID 列表进行搜索
 */
const SHOWRSS_SHOW_IDS = [
  '249',   // 综合动漫
  '252',   // Mikan 同步
  '256',   // 动漫花园
];

async function fetchShowRss(keyword: string): Promise<ShowRssItem[]> {
  const allResults: ShowRssItem[] = [];
  const seenMagnets = new Set<string>();

  for (const showId of SHOWRSS_SHOW_IDS) {
    try {
      const url = `https://showrss.info/show/${showId}.rss`;
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; FeedFetcher/1.0)',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!r.ok) continue;

      const xml = await r.text();
      if (!xml.includes('<item')) continue;

      const itemRe = /<item>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      const kw = keyword.toLowerCase();

      while ((m = itemRe.exec(xml)) !== null) {
        const item = m[1];
        const title = xmlTag(item, 'title');
        if (!title || !title.toLowerCase().includes(kw)) continue;

        const link = xmlTag(item, 'link');
        let magnet = '';
        if (link.startsWith('magnet:?')) {
          magnet = link;
        }

        if (!magnet || seenMagnets.has(magnet)) continue;
        seenMagnets.add(magnet);

        allResults.push({ title, magnet });
      }
    } catch {
      // 单个频道失败跳过
    }

    if (allResults.length >= 20) break; // 够了就停止
  }

  return allResults.slice(0, 20);
}

// ─── Bangumi 元数据 ───────────────────────────────────────────────────

async function fetchBangumi(keyword: string): Promise<BangumiSubject[]> {
  const url = `https://api.bgm.tv/search/subject/${encodeURIComponent(keyword)}?type=2&responseGroup=large&max_results=6`;
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'codeseek/1.0 (https://github.com/Zoroaaa)',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`bangumi HTTP ${r.status}`);
  const data = await r.json() as { list?: any[] };
  if (!data.list?.length) return [];

  return data.list.map((s: any) => {
    const studio = s.infobox?.find((i: any) => i.key === '动画制作' || i.key === 'Studio')?.value
      || s.staff?.find((st: any) => st.position === '动画制作')?.person?.name
      || '';
    const tagsRaw = s.tags?.sort((a: any, b: any) => (b.count || 0) - (a.count || 0)) || [];
    const tags = tagsRaw.slice(0, 5).map((t: any) => t.name);
    let status = '';
    if (s.eps_count > 0 && s.air_date) {
      const airDate = new Date(s.air_date);
      status = new Date() < airDate ? '未开播' : '已完结';
    }
    if ((s.collection?.doing || 0) > 0 && !status.includes('已完结')) status = '连载中';

    return {
      id:          s.id,
      name:        s.name || '',
      nameCN:      s.name_cn || s.name || '',
      cover:       s.images?.large || s.images?.common || s.images?.medium || '',
      summary:     (s.summary || '').slice(0, 300),
      airDate:     s.air_date || '',
      airWeekday:  s.air_weekday ?? -1,
      rating:      s.rating?.score ?? 0,
      ratingCount: s.rating?.total ?? 0,
      rank:        s.rank ?? 0,
      eps:         s.eps_count ?? s.eps ?? 0,
      url:         `https://bgm.tv/subject/${s.id}`,
      type:        s.type || '',
      studio:      studio || '',
      tags:        tags.length ? tags : undefined,
      collection:  s.collection ? {
        wish:    s.collection.wish    || 0,
        collect: s.collection.collect || 0,
        doing:   s.collection.doing   || 0,
        dropped: s.collection.dropped || 0,
      } : undefined,
      status: status || undefined,
    };
  });
}

// ─── 主入口 ────────────────────────────────────────────────────────────

export async function searchAnime(keyword: string, page = 1): Promise<AnimeSearchResult> {
  const [bgmResult, nyaaResult, mikanResult, atosResult, spResult, srResult] = await Promise.allSettled([
    fetchBangumi(keyword),
    fetchNyaa(keyword),
    fetchMikan(keyword),
    fetchAnimeTosho(keyword),
    fetchSubsPlease(keyword),
    fetchShowRss(keyword),
  ]);

  const bgm   = bgmResult.status  === 'fulfilled' ? bgmResult.value  : [];
  const nyaa  = nyaaResult.status === 'fulfilled' ? nyaaResult.value : [];
  const mikan = mikanResult.status === 'fulfilled' ? mikanResult.value : [];
  const atos  = atosResult.status === 'fulfilled' ? atosResult.value  : [];
  const subsplease = spResult.status === 'fulfilled' ? spResult.value : [];
  const showrss   = srResult.status === 'fulfilled' ? srResult.value : [];

  // 错误信息传递给前端
  const nyaaError  = nyaaResult.status === 'rejected'  ? String(nyaaResult.reason)  : null;
  const mikanError = mikanResult.status === 'rejected' ? String(mikanResult.reason) : null;
  const spError    = spResult.status === 'rejected'   ? String(spResult.reason)     : null;

  if (nyaaError)  console.error('[anime-search] nyaa failed:', nyaaError);
  if (mikanError) console.error('[anime-search] mikan failed:', mikanError);
  if (spError)    console.error('[anime-search] subsplease failed:', spError);

  // 各源独立，不再合并
  const sortedNyaa = [...nyaa].sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));
  const sortedAtos = [...atos].sort((a, b) => (b.seeders ?? 0) - (a.seeders ?? 0));

  return {
    keyword,
    page,
    bgm:   bgm.slice(0, 6),
    nyaa:  sortedNyaa,
    mikan: mikan,
    animetosho: sortedAtos,
    subsplease,
    showrss,
    total: sortedNyaa.length + mikan.length + sortedAtos.length + subsplease.length + showrss.length,
    errors: {
      bangumi: bgmResult.status === 'rejected' ? String(bgmResult.reason) : null,
      nyaa:    nyaaError,
      mikan:   mikanError,
      animetosho: atosResult.status === 'rejected' ? String(atosResult.reason) : null,
      subsplease: spError,
      showrss:   srResult.status === 'rejected' ? String(srResult.reason) : null,
    },
  };
}
