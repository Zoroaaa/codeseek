/**
 * JAV 榜单路由
 * 数据源：仅 JavBus
 * 维度：近期热门 / 最新发行 / 有码精选 / 无码精选 / 类别榜（动态抓取）
 * 缓存：前端 localStorage 缓存 10 分钟
 */
import { Hono } from 'hono';
import { Env } from '../types';

export const javRoutes = new Hono<{ Bindings: Env }>();

// =====================================================================
// 类型定义
// =====================================================================

interface JavItem {
  code: string;
  title: string;
  cover?: string;
  date?: string;
  actress?: string;
  source: string;
}

interface GenreRanking {
  genre: string;  // 类别中文名，如 "巨乳"
  key: string;    // 类别 slug，如 "rq"（即 javbus genre 路径末段）
  items: JavItem[];
}

interface RankingsResponse {
  popular: JavItem[];      // 近期热门（有码热门第2页，与首页新作区分）
  newRelease: JavItem[];   // 最新发行（有码首页）
  censored: JavItem[];     // 有码精选（有码热度排序）
  uncensored: JavItem[];   // 无码精选（无码首页）
  genres: GenreRanking[];  // 类别榜（动态抓取 /genre 页）
  suggestions: string[];
  fetchedAt: number;
  sources: string[];
}

// =====================================================================
// 请求头
// =====================================================================

const BASE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
};

const JAVBUS_HEADERS = {
  ...BASE_HEADERS,
  'Referer': 'https://www.javbus.com/',
};

const TIMEOUT = 10000;

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// 工具
// =====================================================================

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]+-\d+$/.test(s)) return s;
  const m = s.match(/^([A-Z]+)(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return s;
}

function isValidCode(code: string): boolean {
  return /^[A-Z]{2,8}-\d{2,6}$/.test(code);
}

function dedup(items: JavItem[]): JavItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

// =====================================================================
// JavBus 通用网格解析
// =====================================================================

function parseJavBusGrid(html: string, source: string): JavItem[] {
  const items: JavItem[] = [];
  // 截取 waterfall 区域，提高匹配精度
  const section = (() => {
    const si = html.indexOf('id="waterfall"');
    const ei = html.indexOf('</div>', si + 500);
    return si !== -1 ? html.slice(si, ei + 10000) : html;
  })();

  const movieBoxRe = /<a[^>]+class="movie-box"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = movieBoxRe.exec(section)) !== null && items.length < 24) {
    const block = m[2];

    // 封面
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"/i);
    const cover = imgMatch ? imgMatch[1] : undefined;

    // 番号（多种选择器兼容）
    const codeMatch =
      block.match(/<span[^>]*class="[^"]*id[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      block.match(/<date[^>]*>([A-Za-z0-9]+-\d+)<\/date>/i) ||
      block.match(/>([A-Z]{2,8}-\d{2,6})</);
    if (!codeMatch) continue;
    const code = normalizeCode(codeMatch[1].trim());
    if (!isValidCode(code)) continue;

    // 标题
    const titleMatch = block.match(/title="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : code;

    // 日期
    const dateMatch = block.match(/<date[^>]*>(\d{4}-\d{2}-\d{2})<\/date>/i);
    const date = dateMatch ? stripTags(dateMatch[0]) : undefined;

    items.push({ code, title, cover, date, source });
  }
  return items;
}

// =====================================================================
// 抓取函数
// =====================================================================

// 最新发行（有码首页）
async function fetchCensoredNew(): Promise<JavItem[]> {
  try {
    const r = await fetchWithTimeout('https://www.javbus.com/', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), 'javbus');
  } catch { return []; }
}

// 近期热门（有码第2页，内容不同于首页）
async function fetchCensoredPopular(): Promise<JavItem[]> {
  try {
    const r = await fetchWithTimeout('https://www.javbus.com/page/2', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), 'javbus');
  } catch { return []; }
}

// 有码精选（有码按月排序/第3页，避免与热门重复）
async function fetchCensoredPick(): Promise<JavItem[]> {
  try {
    // 尝试评分类聚合页，fallback 到 page/3
    const r = await fetchWithTimeout('https://www.javbus.com/page/3', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), 'javbus');
  } catch { return []; }
}

// 无码首页（热门）
async function fetchUncensoredPopular(): Promise<JavItem[]> {
  try {
    const r = await fetchWithTimeout('https://www.javbus.com/uncensored/', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), 'javbus-u');
  } catch { return []; }
}

// 无码第2页（补充数量）
async function fetchUncensoredPage2(): Promise<JavItem[]> {
  try {
    const r = await fetchWithTimeout('https://www.javbus.com/uncensored/page/2', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), 'javbus-u');
  } catch { return []; }
}

// =====================================================================
// 类别动态抓取
// 策略：GET /genre 解析所有类别链接 + 中文名，随机选取 8 个并发抓榜单
// =====================================================================

interface GenreEntry { key: string; genre: string; }

async function fetchGenreList(): Promise<GenreEntry[]> {
  try {
    const r = await fetchWithTimeout('https://www.javbus.com/genre', { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    const html = await r.text();

    // /genre 页结构：<a href="https://www.javbus.com/genre/rq">巨乳</a>
    const entries: GenreEntry[] = [];
    const linkRe = /<a[^>]+href="https?:\/\/www\.javbus\.com\/genre\/([a-z0-9]+)"[^>]*>([^<]+)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const key = m[1].trim();
      const genre = m[2].trim();
      // 过滤掉纯数字（分页链接）和太短的（1字符）
      if (/^\d+$/.test(key) || genre.length < 1) continue;
      entries.push({ key, genre });
    }
    return entries;
  } catch { return []; }
}

// 默认兜底类别（/genre 抓失败时使用）
const FALLBACK_GENRES: GenreEntry[] = [
  { key: 'rq', genre: '巨乳' },
  { key: 'we', genre: '护士' },
  { key: 'dp', genre: '女学生' },
  { key: '2e', genre: '角色扮演' },
  { key: 'do', genre: 'OL' },
  { key: 'sm', genre: '近亲' },
  { key: 'e', genre: '中出' },
  { key: 'q', genre: '美少女' },
];

async function fetchGenreItems(key: string): Promise<JavItem[]> {
  try {
    const r = await fetchWithTimeout(`https://www.javbus.com/genre/${key}`, { headers: JAVBUS_HEADERS });
    if (!r.ok) return [];
    return parseJavBusGrid(await r.text(), `javbus-g-${key}`);
  } catch { return []; }
}

async function buildGenreRankings(genreList: GenreEntry[]): Promise<GenreRanking[]> {
  // 取前 10 个类别并发抓（避免超时）
  const targets = genreList.slice(0, 10);
  const results = await Promise.allSettled(targets.map(g => fetchGenreItems(g.key)));

  return targets
    .map((g, i) => ({
      genre: g.genre,
      key: g.key,
      items: (results[i].status === 'fulfilled' ? results[i].value : []).slice(0, 12),
    }))
    .filter(g => g.items.length > 0);
}

// =====================================================================
// 主路由：GET /api/jav/rankings
// =====================================================================

javRoutes.get('/rankings', async (c) => {
  try {
    // 并发：先抓基础4个榜 + genre列表（genre抓取在列表返回后再并发）
    const [
      r_newRelease,
      r_popular,
      r_censoredPick,
      r_uncensored1,
      r_uncensored2,
      r_genreList,
    ] = await Promise.allSettled([
      fetchCensoredNew(),
      fetchCensoredPopular(),
      fetchCensoredPick(),
      fetchUncensoredPopular(),
      fetchUncensoredPage2(),
      fetchGenreList(),
    ]);

    const get = <T>(r: PromiseSettledResult<T>, fb: T): T =>
      r.status === 'fulfilled' ? r.value : fb;

    // 最新发行：首页新作
    const newRelease = dedup(get(r_newRelease, [])).slice(0, 24);

    // 近期热门：第2页（时效上略早于首页，内容不同）
    const popular = dedup(get(r_popular, [])).slice(0, 24);

    // 有码精选：第3页（与前两个不重叠）
    const censoredRaw = dedup([
      ...get(r_censoredPick, []),
      // 补充：从前两个去重后补位
      ...get(r_newRelease, []),
    ]);
    // 去掉已在 popular 里的
    const popularCodes = new Set(popular.map(i => i.code));
    const censored = censoredRaw.filter(i => !popularCodes.has(i.code)).slice(0, 24);

    // 无码精选
    const uncensored = dedup([
      ...get(r_uncensored1, []),
      ...get(r_uncensored2, []),
    ]).slice(0, 24);

    // 类别榜
    const genreListRaw = get(r_genreList, []);
    const genreList = genreListRaw.length > 0 ? genreListRaw : FALLBACK_GENRES;
    const genres = await buildGenreRankings(genreList);

    // 搜索建议
    const suggestions = dedup([...popular, ...uncensored])
      .map(i => i.code)
      .filter(isValidCode)
      .slice(0, 30);

    const sources: string[] = [];
    if (newRelease.length > 0 || popular.length > 0) sources.push('JavBus');
    if (uncensored.length > 0) sources.push('JavBus(无码)');

    const response: RankingsResponse = {
      popular,
      newRelease,
      censored,
      uncensored,
      genres,
      suggestions,
      fetchedAt: Date.now(),
      sources,
    };

    return c.json({ success: true, data: response });
  } catch (err) {
    console.error('JAV rankings error:', err);
    return c.json({ success: false, error: { code: 'FETCH_ERROR', message: '获取榜单失败' } }, 500);
  }
});

// GET /api/jav/suggestions?keyword=xxx
javRoutes.get('/suggestions', async (c) => {
  const keyword = (c.req.query('keyword') || '').toUpperCase().trim();
  if (!keyword) return c.json({ success: true, data: [] });
  try {
    const items = await fetchCensoredNew();
    const matched = items
      .map(i => i.code)
      .filter(code => code.startsWith(keyword) || code.includes(keyword))
      .slice(0, 10);
    return c.json({ success: true, data: matched });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
