/**
 * JAV 榜单路由 — 仅 JavBus
 * 4 个维度：有码精选 / 无码精选 / 随机类别(10) / 随机女优(10)
 */
import { Hono } from 'hono';
import { Env } from '../types';

export const javRoutes = new Hono<{ Bindings: Env }>();

// ─────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────

interface JavItem {
  code: string;
  title: string;
  cover?: string;
  date?: string;
  actress?: string;
  source: string;
}

interface GroupRanking {
  name: string;   // 类别名 或 女优名
  key: string;    // slug（genre/xx 或 star/xx 的末段）
  items: JavItem[];
}

interface RankingsResponse {
  censored: JavItem[];          // 有码精选（前3页随机20）
  uncensored: JavItem[];        // 无码精选（前3页随机20）
  hd: JavItem[];                // 高清（/genre/hd 前3页随机20）
  subtitle: JavItem[];          // 字幕（/genre/sub 前3页随机20）
  genres: GroupRanking[];       // 随机10类别
  actresses: GroupRanking[];    // 随机10女优
  suggestions: string[];
  fetchedAt: number;
  sources: string[];
}

// ─────────────────────────────────────────────
// 请求工具
// ─────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Referer': 'https://www.javbus.com/',
};

async function get(url: string, timeoutMs = 10000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    if (!r.ok) return '';
    return await r.text();
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────

function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]+-\d+$/.test(s)) return s;
  const m = s.match(/^([A-Z]+)(\d+)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

function isValidCode(code: string): boolean {
  return /^[A-Z]{2,8}-\d{2,6}$/.test(code);
}

function dedup(items: JavItem[]): JavItem[] {
  const seen = new Set<string>();
  return items.filter(i => { if (seen.has(i.code)) return false; seen.add(i.code); return true; });
}

/** Fisher-Yates 随机洗牌 */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 从数组随机取 n 个 */
function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ─────────────────────────────────────────────
// JavBus 网格解析（通用）
// ─────────────────────────────────────────────

function parseGrid(html: string, source: string): JavItem[] {
  if (!html) return [];
  const items: JavItem[] = [];
  // 截取 waterfall 区域
  const wi = html.indexOf('id="waterfall"');
  const section = wi !== -1 ? html.slice(wi, wi + 60000) : html;

  const re = /<a[^>]+class="movie-box"[^>]*href="[^"]+"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null && items.length < 30) {
    const block = m[1];
    const imgM = block.match(/<img[^>]+src="([^"]+)"/i);
    const cover = imgM ? imgM[1] : undefined;

    const codeM =
      block.match(/<span[^>]*class="[^"]*id[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      block.match(/<date[^>]*>([A-Za-z0-9]+-\d+)<\/date>/i) ||
      block.match(/>([A-Z]{2,8}-\d{2,6})</);
    if (!codeM) continue;
    const code = normalizeCode(codeM[1].trim());
    if (!isValidCode(code)) continue;

    const titleM = block.match(/title="([^"]+)"/i);
    const title = titleM ? titleM[1].trim() : code;

    const dateM = block.match(/<date[^>]*>(\d{4}-\d{2}-\d{2})<\/date>/i);
    const date = dateM ? dateM[1] : undefined;

    items.push({ code, title, cover, date, source });
  }
  return items;
}

// ─────────────────────────────────────────────
// 有码精选：前3页合并 → dedup → shuffle → 取20
// ─────────────────────────────────────────────

async function fetchCensored(): Promise<JavItem[]> {
  const pages = ['https://www.javbus.com/', 'https://www.javbus.com/page/2', 'https://www.javbus.com/page/3'];
  const results = await Promise.allSettled(pages.map(u => get(u)));
  const all = results.flatMap((r, i) =>
    r.status === 'fulfilled' ? parseGrid(r.value, `javbus-p${i + 1}`) : []
  );
  return sample(dedup(all), 20);
}

// ─────────────────────────────────────────────
// 无码精选：前3页合并 → dedup → shuffle → 取20
// ─────────────────────────────────────────────

async function fetchUncensored(): Promise<JavItem[]> {
  const pages = [
    'https://www.javbus.com/uncensored/',
    'https://www.javbus.com/uncensored/page/2',
    'https://www.javbus.com/uncensored/page/3',
  ];
  const results = await Promise.allSettled(pages.map(u => get(u)));
  const all = results.flatMap((r, i) =>
    r.status === 'fulfilled' ? parseGrid(r.value, `javbus-u${i + 1}`) : []
  );
  return sample(dedup(all), 20);
}

// ─────────────────────────────────────────────
// 高清：/genre/hd 前3页合并 → dedup → shuffle → 取20
// ─────────────────────────────────────────────

async function fetchHD(): Promise<JavItem[]> {
  const pages = [
    'https://www.javbus.com/genre/hd',
    'https://www.javbus.com/genre/hd/2',
    'https://www.javbus.com/genre/hd/3',
  ];
  const results = await Promise.allSettled(pages.map(u => get(u)));
  const all = results.flatMap((r, i) =>
    r.status === 'fulfilled' ? parseGrid(r.value, `javbus-hd${i + 1}`) : []
  );
  return sample(dedup(all), 20);
}

// ─────────────────────────────────────────────
// 字幕：/genre/sub 前3页合并 → dedup → shuffle → 取20
// ─────────────────────────────────────────────

async function fetchSubtitle(): Promise<JavItem[]> {
  const pages = [
    'https://www.javbus.com/genre/sub',
    'https://www.javbus.com/genre/sub/2',
    'https://www.javbus.com/genre/sub/3',
  ];
  const results = await Promise.allSettled(pages.map(u => get(u)));
  const all = results.flatMap((r, i) =>
    r.status === 'fulfilled' ? parseGrid(r.value, `javbus-sub${i + 1}`) : []
  );
  return sample(dedup(all), 20);
}

// ─────────────────────────────────────────────
// 随机类别：抓 /genre 页 → 解析所有类别 → 随机取10 → 各抓首页
// ─────────────────────────────────────────────

interface Entry { key: string; name: string; }

async function fetchGenreList(): Promise<Entry[]> {
  const html = await get('https://www.javbus.com/genre');
  if (!html) return [];
  const entries: Entry[] = [];
  const re = /href="https?:\/\/www\.javbus\.com\/genre\/([a-z0-9]+)"[^>]*>([^<]+)</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = m[1].trim();
    const name = m[2].trim();
    if (/^\d+$/.test(key) || name.length < 1) continue;
    entries.push({ key, name });
  }
  return entries;
}

// 兜底类别列表（/genre 页无法访问时使用）
const FALLBACK_GENRES: Entry[] = [
  { key: 'rq', name: '巨乳' }, { key: 'we', name: '护士' }, { key: 'dp', name: '女学生' },
  { key: '2e', name: '角色扮演' }, { key: 'do', name: 'OL' }, { key: 'sm', name: '近亲' },
  { key: 'e',  name: '中出' },   { key: 'q',  name: '美少女' }, { key: '28', name: '高清' },
  { key: '2f', name: '4K' },     { key: 'zs', name: '女同' },   { key: 'zr', name: '素人' },
];

async function fetchRandomGenres(): Promise<GroupRanking[]> {
  const list = await fetchGenreList();
  const pool = list.length >= 10 ? list : FALLBACK_GENRES;
  const picked = sample(pool, 10);

  const results = await Promise.allSettled(
    picked.map(g => get(`https://www.javbus.com/genre/${g.key}`))
  );

  return picked
    .map((g, i) => ({
      name: g.name,
      key: g.key,
      items: results[i].status === 'fulfilled'
        ? sample(parseGrid(results[i].value, `javbus-g-${g.key}`), 12)
        : [],
    }))
    .filter(g => g.items.length > 0);
}

// ─────────────────────────────────────────────
// 随机女优：抓 /actresses → 解析女优列表 → 随机取10 → 各抓 /star/xx 首页
// ─────────────────────────────────────────────

async function fetchActressList(): Promise<Entry[]> {
  const html = await get('https://www.javbus.com/actresses');
  if (!html) return [];
  const entries: Entry[] = [];
  // <a href="https://www.javbus.com/star/okq">苍井空</a> 或带 avatar 的结构
  const re = /href="https?:\/\/www\.javbus\.com\/star\/([a-z0-9]+)"[^>]*>\s*(?:<img[^>]*>)?\s*<span[^>]*>([^<]+)<\/span>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const key = m[1].trim();
    const name = m[2].trim();
    if (!key || name.length < 1) continue;
    entries.push({ key, name });
  }

  // fallback: 更宽松的匹配（纯文本链接）
  if (entries.length < 5) {
    const re2 = /href="https?:\/\/www\.javbus\.com\/star\/([a-z0-9]+)"[^>]*>([^<]{1,20})<\/a>/gi;
    while ((m = re2.exec(html)) !== null) {
      const key = m[1].trim();
      const name = m[2].trim();
      if (!key || name.length < 1 || entries.find(e => e.key === key)) continue;
      entries.push({ key, name });
    }
  }

  return entries;
}

// 兜底女优列表
const FALLBACK_ACTRESSES: Entry[] = [
  { key: '2xi', name: '三上悠亜' }, { key: 'okq', name: '苍井空' },
  { key: '2pv', name: '深田咏美' }, { key: 'jmd', name: '明日花绮罗' },
  { key: 'pix', name: '波多野结衣' }, { key: 'lhm', name: '天使もえ' },
  { key: 'qhd', name: '桃乃木香奈' }, { key: 'zld', name: '椎名空' },
  { key: 'nns', name: '上原亚衣' }, { key: 'rki', name: '水野朝阳' },
  { key: 'sqt', name: '小仓由菜' }, { key: 'hgp', name: '铃村あいり' },
];

async function fetchRandomActresses(): Promise<GroupRanking[]> {
  const list = await fetchActressList();
  const pool = list.length >= 10 ? list : FALLBACK_ACTRESSES;
  const picked = sample(pool, 10);

  const results = await Promise.allSettled(
    picked.map(a => get(`https://www.javbus.com/star/${a.key}`))
  );

  return picked
    .map((a, i) => ({
      name: a.name,
      key: a.key,
      items: results[i].status === 'fulfilled'
        ? sample(parseGrid(results[i].value, `javbus-star-${a.key}`), 12)
        : [],
    }))
    .filter(a => a.items.length > 0);
}

// ─────────────────────────────────────────────
// 主路由
// ─────────────────────────────────────────────

javRoutes.get('/rankings', async (c) => {
  try {
    // 六路并发：有码、无码、高清、字幕、类别列表+抓取、女优列表+抓取
    const [r_censored, r_uncensored, r_hd, r_subtitle, r_genres, r_actresses] = await Promise.allSettled([
      fetchCensored(),
      fetchUncensored(),
      fetchHD(),
      fetchSubtitle(),
      fetchRandomGenres(),
      fetchRandomActresses(),
    ]);

    const g = <T>(r: PromiseSettledResult<T>, fb: T): T =>
      r.status === 'fulfilled' ? r.value : fb;

    const censored   = g(r_censored, []);
    const uncensored = g(r_uncensored, []);
    const hd         = g(r_hd, []);
    const subtitle   = g(r_subtitle, []);
    const genres     = g(r_genres, []);
    const actresses  = g(r_actresses, []);

    const suggestions = dedup([...censored, ...uncensored, ...hd])
      .map(i => i.code).filter(isValidCode).slice(0, 30);

    const sources: string[] = [];
    if (censored.length > 0)   sources.push('JavBus');
    if (uncensored.length > 0) sources.push('JavBus(无码)');
    if (hd.length > 0)         sources.push('JavBus(高清)');

    const response: RankingsResponse = {
      censored, uncensored, hd, subtitle, genres, actresses, suggestions,
      fetchedAt: Date.now(), sources,
    };

    return c.json({ success: true, data: response });
  } catch (err) {
    console.error('JAV rankings error:', err);
    return c.json({ success: false, error: { code: 'FETCH_ERROR', message: '获取榜单失败' } }, 500);
  }
});

// suggestions 接口（轻量）
javRoutes.get('/suggestions', async (c) => {
  const keyword = (c.req.query('keyword') || '').toUpperCase().trim();
  if (!keyword) return c.json({ success: true, data: [] });
  try {
    const html = await get('https://www.javbus.com/');
    const matched = parseGrid(html, 'javbus')
      .map(i => i.code)
      .filter(code => code.startsWith(keyword) || code.includes(keyword))
      .slice(0, 10);
    return c.json({ success: true, data: matched });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
