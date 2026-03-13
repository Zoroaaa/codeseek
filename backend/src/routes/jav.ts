/**
 * JAV 榜单路由
 * 功能：实时抓取 JavBus / JavLibrary / DMM 热门榜单，供前端展示
 * 策略：多源并发抓取，任意一源成功即可，前端 localStorage 缓存 10 分钟
 */
import { Hono } from 'hono';
import { Env } from '../types';

export const javRoutes = new Hono<{ Bindings: Env }>();

// =====================================================================
// 类型定义
// =====================================================================

interface JavItem {
  code: string;       // 番号，如 SONE-155
  title: string;      // 标题
  cover?: string;     // 封面图 URL（可选）
  date?: string;      // 发行日期
  actress?: string;   // 女优名
  source: string;     // 来源标识
}

interface RankingsResponse {
  popular: JavItem[];      // 近期热门（有码热门）
  newRelease: JavItem[];   // 最新发行
  mostWanted: JavItem[];   // 最受期待 / 最多收藏（评分榜）
  uncensored: JavItem[];   // 无码精选
  topRated: JavItem[];     // 高分佳作（JavLibrary 评分榜）
  genres: GenreRanking[];  // 类别榜
  suggestions: string[];   // 搜索建议词（番号列表）
  fetchedAt: number;
  sources: string[];       // 实际成功的来源
}

interface GenreRanking {
  genre: string;   // 类别名称，如 "巨乳"
  key: string;     // 类别 key，如 "busty"
  items: JavItem[];
}

// =====================================================================
// 请求头 — 模拟浏览器，绕过基础反爬
// =====================================================================

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

const FETCH_TIMEOUT = 8000; // 8s 超时

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// 工具函数：从 HTML 文本中提取内容
// =====================================================================

function extractBetween(html: string, start: string, end: string): string {
  const si = html.indexOf(start);
  if (si === -1) return '';
  const ei = html.indexOf(end, si + start.length);
  if (ei === -1) return '';
  return html.slice(si + start.length, ei);
}



function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// 标准化番号格式：ipx00535 -> IPX-535, sone155 -> SONE-155
function normalizeCode(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, '');
  // 已经带连字符
  if (/^[A-Z]+\d+-\d+$/.test(cleaned) || /^[A-Z]+-\d+$/.test(cleaned)) return cleaned;
  // 字母 + 数字，无连字符
  const m = cleaned.match(/^([A-Z]+)(\d+)$/);
  if (m) return `${m[1]}-${m[2]}`;
  return cleaned;
}

// 验证是否是有效番号
function isValidCode(code: string): boolean {
  return /^[A-Z]{2,8}-\d{2,6}$/.test(code);
}

// =====================================================================
// Source 1: JavBus — 新作 + 热门
// URL: https://www.javbus.com  分页结构，不需要 CF cookie
// =====================================================================

async function fetchJavBusNew(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout('https://www.javbus.com/', {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.javbus.com/' },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseJavBusGrid(html, 'javbus');
  } catch {
    return [];
  }
}

async function fetchJavBusTrending(): Promise<JavItem[]> {
  try {
    // JavBus censored 评分榜
    const resp = await fetchWithTimeout('https://www.javbus.com/star/2xi', {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.javbus.com/' },
    });
    if (!resp.ok) {
      // fallback: 直接用第2页当热门
      const resp2 = await fetchWithTimeout('https://www.javbus.com/page/2', {
        headers: { ...BROWSER_HEADERS },
      });
      if (!resp2.ok) return [];
      return parseJavBusGrid(await resp2.text(), 'javbus');
    }
    return parseJavBusGrid(await resp.text(), 'javbus');
  } catch {
    return [];
  }
}

function parseJavBusGrid(html: string, source: string): JavItem[] {
  const items: JavItem[] = [];
  // JavBus 的影片列表：<div class="item">...</div>
  const gridSection = extractBetween(html, 'id="waterfall"', '</div>\n</div>') || html;

  // 匹配每个 movie-box
  const movieBoxRe = /<a[^>]+class="movie-box"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;

  while ((m = movieBoxRe.exec(gridSection)) !== null && items.length < 20) {
    const block = m[2];
    // 封面
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const cover = imgMatch ? imgMatch[1] : undefined;
    // 番号
    const codeMatch = block.match(/<span[^>]*class="[^"]*id[^"]*"[^>]*>([^<]+)<\/span>/i)
      || block.match(/<date[^>]*>([A-Za-z]+-\d+)<\/date>/i)
      || block.match(/>([A-Z]+-\d+)</);
    const rawCode = codeMatch ? codeMatch[1].trim() : '';
    const code = normalizeCode(rawCode);
    if (!isValidCode(code)) continue;

    // 标题
    const titleMatch = block.match(/title="([^"]+)"/i) || block.match(/<date[^>]*>([^<]+)<\/date>/i);
    const title = titleMatch ? titleMatch[1].trim() : code;

    // 日期
    const dateMatch = block.match(/<date[^>]*>\d{4}-\d{2}-\d{2}<\/date>/i);
    const date = dateMatch ? stripTags(dateMatch[0]) : undefined;

    items.push({ code, title, cover, date, source });
  }
  return items;
}

// =====================================================================
// Source 2: JavLibrary — 最多收藏(mostwanted) + 最新发行(newrelease)
// 注意：JavLibrary 有 CF 防护，Worker 边缘节点命中率约50%
// =====================================================================

async function fetchJavLibrary(path: string): Promise<JavItem[]> {
  const base = 'https://www.javlibrary.com/cn';
  try {
    const resp = await fetchWithTimeout(`${base}${path}`, {
      headers: {
        ...BROWSER_HEADERS,
        'Referer': 'https://www.javlibrary.com/cn/',
        'Cookie': 'over18=18; userlang=cn',
      },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    // JavLibrary 被 CF 拦截时返回的是 challenge 页面
    if (html.includes('cf-browser-verification') || html.includes('Just a moment')) return [];
    return parseJavLibraryGrid(html, 'javlibrary');
  } catch {
    return [];
  }
}

function parseJavLibraryGrid(html: string, source: string): JavItem[] {
  const items: JavItem[] = [];
  // JavLibrary 影片列表：<div class="video">
  const videoRe = /<div[^>]+class="[^"]*video[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m: RegExpExecArray | null;

  while ((m = videoRe.exec(html)) !== null && items.length < 20) {
    const block = m[1];
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const cover = imgMatch ? (imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1]) : undefined;
    const codeMatch = block.match(/<div[^>]+class="[^"]*id[^"]*"[^>]*>([^<]+)<\/div>/i);
    const rawCode = codeMatch ? codeMatch[1].trim() : '';
    const code = normalizeCode(rawCode);
    if (!isValidCode(code)) continue;
    const titleMatch = block.match(/<div[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)<\/div>/i)
      || block.match(/title="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : code;
    items.push({ code, title, cover, source });
  }
  return items;
}

// =====================================================================
// Source 3: DMM/FANZA — 官方新作排行，反爬最弱，需日本IP（Worker可达）
// =====================================================================

async function fetchDMMNew(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout(
      'https://www.dmm.co.jp/digital/videoa/-/list/=/sort=date/view=text/',
      {
        headers: {
          ...BROWSER_HEADERS,
          'Referer': 'https://www.dmm.co.jp/',
          'Cookie': 'age_check_done=1',
        },
      }
    );
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseDMMList(html, 'dmm');
  } catch {
    return [];
  }
}

async function fetchDMMRanking(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout(
      'https://www.dmm.co.jp/digital/videoa/-/ranking/=/type=sale/',
      {
        headers: {
          ...BROWSER_HEADERS,
          'Referer': 'https://www.dmm.co.jp/',
          'Cookie': 'age_check_done=1',
        },
      }
    );
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseDMMList(html, 'dmm');
  } catch {
    return [];
  }
}

function parseDMMList(html: string, source: string): JavItem[] {
  const items: JavItem[] = [];
  // DMM 文本列表模式：<li class="tileListVideo__item">
  const liRe = /<li[^>]+class="[^"]*tileListVideo__item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  // 也支持旧版 list-item 结构
  const altRe = /<li[^>]+class="[^"]*list-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  
  const re = html.includes('tileListVideo') ? liRe : altRe;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html)) !== null && items.length < 20) {
    const block = m[1];
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const cover = imgMatch ? imgMatch[1] : undefined;

    // DMM 番号从 URL 中提取，格式如 /digital/videoa/-/detail/=/cid=ipx00535/
    const cidMatch = block.match(/cid=([a-z0-9]+)/i) || block.match(/id=([a-z]{2,8}\d{3,6})/i);
    if (!cidMatch) continue;

    // 将 DMM cid 转换为标准番号格式
    const cid = cidMatch[1];
    const cidFormatted = cid.replace(/^([a-z]+)0*(\d+)$/i, '$1-$2').toUpperCase();
    const code = normalizeCode(cidFormatted);
    if (!isValidCode(code)) continue;

    const titleMatch = block.match(/<p[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)<\/p>/i)
      || block.match(/title="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : code;

    const dateMatch = block.match(/(\d{4}\/\d{2}\/\d{2})/);
    const date = dateMatch ? dateMatch[1].replace(/\//g, '-') : undefined;

    items.push({ code, title, cover, date, source });
  }
  return items;
}

// =====================================================================
// Source 4: MGS (mgstage.com) — 日本成人平台，反爬较弱
// =====================================================================

async function fetchMGSRanking(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout(
      'https://www.mgstage.com/product/ranking.php',
      {
        headers: {
          ...BROWSER_HEADERS,
          'Referer': 'https://www.mgstage.com/',
          'Cookie': 'adc=1',
        },
      }
    );
    if (!resp.ok) return [];
    const html = await resp.text();
    return parseMGSList(html, 'mgs');
  } catch {
    return [];
  }
}

function parseMGSList(html: string, source: string): JavItem[] {
  const items: JavItem[] = [];
  const prodRe = /<div[^>]+class="[^"]*rank_box[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  let m: RegExpExecArray | null;

  while ((m = prodRe.exec(html)) !== null && items.length < 20) {
    const block = m[1];
    const imgMatch = block.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const cover = imgMatch ? imgMatch[1] : undefined;
    // MGS 番号如 100GANA-3391
    const codeMatch = block.match(/\b([A-Z0-9]{2,8}-\d{2,6})\b/i);
    if (!codeMatch) continue;
    const code = normalizeCode(codeMatch[1]);
    if (!isValidCode(code)) continue;
    const titleMatch = block.match(/<p[^>]+class="[^"]*title[^"]*"[^>]*>([^<]+)<\/p>/i)
      || block.match(/alt="([^"]+)"/i);
    const title = titleMatch ? titleMatch[1].trim() : code;
    items.push({ code, title, cover, source });
  }
  return items;
}

// =====================================================================
// 去重 + 合并
// =====================================================================

function dedup(items: JavItem[]): JavItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

// =====================================================================
// Source 5: JavBus 无码 (uncensored) — /uncensored/
// =====================================================================

async function fetchJavBusUncensored(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout('https://www.javbus.com/uncensored/star/2xi', {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.javbus.com/uncensored/' },
    });
    if (!resp.ok) {
      // fallback: 无码首页
      const r2 = await fetchWithTimeout('https://www.javbus.com/uncensored/', {
        headers: { ...BROWSER_HEADERS },
      });
      if (!r2.ok) return [];
      return parseJavBusGrid(await r2.text(), 'javbus-u');
    }
    return parseJavBusGrid(await resp.text(), 'javbus-u');
  } catch {
    return [];
  }
}

async function fetchJavBusUncensoredNew(): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout('https://www.javbus.com/uncensored/', {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.javbus.com/' },
    });
    if (!resp.ok) return [];
    return parseJavBusGrid(await resp.text(), 'javbus-u');
  } catch {
    return [];
  }
}

// =====================================================================
// Source 6: JavLibrary 评分榜 /vl_bestrated.php
// =====================================================================

async function fetchJavLibraryTopRated(): Promise<JavItem[]> {
  return fetchJavLibrary('/vl_bestrated.php?&mode=&page=&v=&venus=');
}

// =====================================================================
// Source 7: JavBus 类别榜
// 抓取指定类别标签页，每类取前 12 条
// =====================================================================

// JavBus 类别 genre 对应路径
const GENRE_PATHS: Array<{ key: string; genre: string; path: string }> = [
  { key: 'busty',     genre: '巨乳',   path: '/genre/rq' },
  { key: 'nurse',     genre: '护士',   path: '/genre/we' },
  { key: 'student',   genre: '女学生', path: '/genre/dp' },
  { key: 'incest',    genre: '近亲',   path: '/genre/sm' },
  { key: 'cosplay',   genre: '角色扮演', path: '/genre/2e' },
  { key: 'office',    genre: 'OL',     path: '/genre/do' },
];

async function fetchJavBusGenre(path: string, source: string): Promise<JavItem[]> {
  try {
    const resp = await fetchWithTimeout(`https://www.javbus.com${path}`, {
      headers: { ...BROWSER_HEADERS, 'Referer': 'https://www.javbus.com/' },
    });
    if (!resp.ok) return [];
    return parseJavBusGrid(await resp.text(), source);
  } catch {
    return [];
  }
}

async function fetchAllGenres(): Promise<Array<{ genre: string; key: string; items: JavItem[] }>> {
  // 并发但限制 6 个，避免超时
  const results = await Promise.allSettled(
    GENRE_PATHS.map(g => fetchJavBusGenre(g.path, `javbus-${g.key}`))
  );
  return GENRE_PATHS.map((g, i) => ({
    genre: g.genre,
    key: g.key,
    items: (results[i].status === 'fulfilled' ? results[i].value : []).slice(0, 12),
  })).filter(g => g.items.length > 0);
}

// =====================================================================
// 主路由：GET /api/jav/rankings
// =====================================================================

javRoutes.get('/rankings', async (c) => {
  const force = c.req.query('force') === 'true';
  void force; // 缓存由前端 localStorage 控制，Worker 不做服务端缓存

  try {
    // 并发抓取所有源（含新增维度）
    const [
      javbusNew, javbusTrend,
      javlibWanted, javlibNew, javlibTopRated,
      dmmNew, dmmRanking,
      mgsRanking,
      javbusUncensored, javbusUncensoredNew,
      genreResults,
    ] = await Promise.allSettled([
      fetchJavBusNew(),
      fetchJavBusTrending(),
      fetchJavLibrary('/vl_mostwanted.php'),
      fetchJavLibrary('/vl_newrelease.php'),
      fetchJavLibraryTopRated(),
      fetchDMMNew(),
      fetchDMMRanking(),
      fetchMGSRanking(),
      fetchJavBusUncensored(),
      fetchJavBusUncensoredNew(),
      fetchAllGenres(),
    ]);

    const get = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
      r.status === 'fulfilled' ? r.value : fallback;

    // 近期热门：有码热门（JavBus 热门 + JavLibrary 最多收藏 + DMM 销售榜 + MGS）
    const popular = dedup([
      ...get(javbusTrend, []),
      ...get(javlibWanted, []),
      ...get(dmmRanking, []),
      ...get(mgsRanking, []),
    ]).slice(0, 24);

    // 最新发行：按时间维度，来源互补去重
    const newRelease = dedup([
      ...get(javbusNew, []),
      ...get(javlibNew, []),
      ...get(dmmNew, []),
    ]).slice(0, 24);

    // 最受期待：专用 JavLibrary mostwanted + DMM 热卖，与 popular 来源不同权重
    const mostWanted = dedup([
      ...get(javlibWanted, []),
      ...get(dmmRanking, []),
    ]).slice(0, 24);

    // 高分佳作：JavLibrary 评分榜为主，补充 DMM 榜
    const topRated = dedup([
      ...get(javlibTopRated, []),
      ...get(dmmRanking, []),
    ]).slice(0, 24);

    // 无码精选：无码热门 + 无码新作
    const uncensored = dedup([
      ...get(javbusUncensored, []),
      ...get(javbusUncensoredNew, []),
    ]).slice(0, 24);

    // 类别榜
    const genres = get(genreResults, []);

    // 搜索建议：从热门 + 高分 + 无码中提取番号
    const suggestions = dedup([...popular, ...topRated, ...uncensored])
      .map(i => i.code)
      .filter(isValidCode)
      .slice(0, 30);

    // 记录实际成功的来源
    const sources: string[] = [];
    if (get(javbusNew, []).length > 0 || get(javbusTrend, []).length > 0) sources.push('JavBus');
    if (get(javlibWanted, []).length > 0 || get(javlibNew, []).length > 0) sources.push('JavLibrary');
    if (get(dmmNew, []).length > 0 || get(dmmRanking, []).length > 0) sources.push('DMM');
    if (get(mgsRanking, []).length > 0) sources.push('MGStage');
    if (get(javbusUncensored, []).length > 0) sources.push('JavBus(无码)');

    const response: RankingsResponse = {
      popular,
      newRelease,
      mostWanted,
      topRated,
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

// GET /api/jav/suggestions?keyword=xxx — 基于榜单数据的实时搜索建议
// （轻量版：只抓 JavBus 首页番号做建议词）
javRoutes.get('/suggestions', async (c) => {
  const keyword = (c.req.query('keyword') || '').toUpperCase().trim();
  if (!keyword || keyword.length < 1) {
    return c.json({ success: true, data: [] });
  }

  try {
    const items = await fetchJavBusNew();
    const matched = items
      .map(i => i.code)
      .filter(code => code.startsWith(keyword) || code.includes(keyword))
      .slice(0, 10);
    return c.json({ success: true, data: matched });
  } catch {
    return c.json({ success: true, data: [] });
  }
});
