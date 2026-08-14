/**
 * 小说搜索服务
 * 数据源:
 *   1. 知轩藏书 (https://zxcs.zip) — 精校版全本，明文搜索 + 直链下载，置顶展示
 *   2. 奇书网 (http://www.xqishuta.org) — 搜索第一本书，抓取详情页 txt 下载链接
 *   3. Anna's Archive (https://zh.annas-archive.gl) — 第一页全部电子书结果（上限 50 条）
 *
 * ⚠️ 类型契约：本文件导出的接口（NovelItem, NovelSearchResult）
 *    与 frontend/src/types/search.ts 保持结构同步。
 *
 * 设计说明：
 *   - 三个数据源并行抓取，互不阻塞：任一源失败不影响其他源返回
 *   - 置顶顺序：zxcs（精校版）→ 奇书网 → Anna's Archive（仅 page=1 时抓取前两源，避免翻页重复）
 *   - zxcs / 奇书网为单域名直连；Anna's Archive 多域名故障转移
 */

import { fetchWithRetry } from '@/utils/fetch';
import { sanitizeError } from '@/utils/error';

// ─── Constants ───────────────────────────────────────────────────────────

/** Anna's Archive 域名列表（按优先级，失败后自动切换） */
const AA_DOMAINS = [
  'zh.annas-archive.gl',
  'zh.annas-archive.pk',
  'zh.annas-archive.gd',
  'annas-archive.gl',
  'annas-archive.pk',
  'annas-archive.gd',
];

/** 知轩藏书域名 */
const ZXCS_DOMAIN = 'zxcs.zip';

/** 奇书网域名 */
const XQS_DOMAIN = 'www.xqishuta.org';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const FETCH_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
} as Record<string, string>;

/** 奇书网请求头（加 Referer 防盗链） */
const XQS_HEADERS = {
  ...FETCH_HEADERS,
  'Referer': `http://${XQS_DOMAIN}/`,
} as Record<string, string>;

/** 知轩藏书请求头（加 Referer 防盗链） */
const ZXCS_HEADERS = {
  ...FETCH_HEADERS,
  'Referer': `https://${ZXCS_DOMAIN}/`,
} as Record<string, string>;

/** 每次返回的结果数上限（取 Anna's Archive 第一页前 10 条） */
const PAGE_LIMIT = 10;
/** 详情页描述抓取并发上限 */
const DESC_CONCURRENCY = 5;
/** 单次请求超时（ms） */
const FETCH_TIMEOUT = 15000;

// ─── Types ──────────────────────────────────────────────────────────────

export interface NovelItem {
  /** MD5，作为唯一标识 */
  id: string;
  /** 书名 */
  title: string;
  /** 作者 */
  author: string;
  /** 图书描述 / 简介（从详情页抓取） */
  description: string;
  /** 出版社 / 来源机构（含年份，如 "shu.im, 2011"） */
  publisher: string;
  /** 封面图 URL */
  cover: string;
  /** 语言（如 "中文 [zh]"） */
  language: string;
  /** 文件格式（如 "PDF" / "EPUB" / "MOBI"） */
  format: string;
  /** 文件大小（如 "1.4MB"） */
  size: string;
  /** 出版年份 */
  year: string;
  /** 分类标签（如 "小说类图书"） */
  category: string;
  /** 来源标识（如 "lgli/upload/zlib"） */
  source: string;
  /** 详情页/下载页 URL（https://zh.annas-archive.gl/md5/<md5>） */
  detailUrl: string;
}

export interface NovelSearchResult {
  resultType: 'novel';
  keyword: string;
  page: number;
  total: number;
  errors: Record<string, string | null>;
  novels: NovelItem[];
}

// ─── HTML 解析工具 ──────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

// ─── 多域名故障转移 fetch ───────────────────────────────────────────────

async function fetchWithFailover(
  pathBuilder: (domain: string) => string,
  timeoutMs: number = FETCH_TIMEOUT,
): Promise<{ html: string; domain: string }> {
  let lastErr = '';
  for (const domain of AA_DOMAINS) {
    const url = pathBuilder(domain);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const r = await fetchWithRetry(url, {
        headers: FETCH_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (r.ok) {
        const html = await r.text();
        if (html.length > 1000) return { html, domain };
      }
      lastErr = `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'unknown';
    }
  }
  throw new Error(lastErr);
}

// ─── Anna's Archive ────────────────────────────────────────────────────

/** 从详情页 HTML 提取描述 */
function extractDescription(html: string): string {
  // 描述在 js-md5-top-box-description 容器内，"描述" 标签后的 <div class="mb-1">
  const re = /描述<\/div><div class="mb-1">([\s\S]*?)<\/div>/;
  const raw = firstMatch(html, re);
  if (!raw) return '';
  // 描述可能含 <br>，转为换行后去标签
  return stripTags(raw.replace(/<br\s*\/?>/g, '\n')).trim();
}

/** 并发抓取多条结果的描述（限制并发，失败时 description 留空） */
async function fetchDescriptions(items: NovelItem[]): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  const processOne = async (item: NovelItem): Promise<void> => {
    try {
      const { html } = await fetchWithFailover(
        (d) => `https://${d}/md5/${item.id}`,
        10000,
      );
      item.description = extractDescription(html);
    } catch {
      // 描述抓取失败不影响主结果
    }
  };

  for (let i = 0; i < DESC_CONCURRENCY; i++) {
    workers.push((async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) await processOne(item);
      }
    })());
  }
  await Promise.all(workers);
}

/** 解析单条结果块 HTML */
function parseNovelItem(block: string, domain: string): NovelItem | null {
  const md5 = firstMatch(block, /href="\/md5\/([a-f0-9]{32})"/);
  if (!md5) return null;

  const title = firstMatch(block, /<a[^>]*js-vim-focus[^>]*>([\s\S]*?)<\/a>/);
  const author = firstMatch(block, /<a[^>]*><span[^>]*icon-\[mdi--user-edit\][^>]*><\/span>([\s\S]*?)<\/a>/);
  const publisher = firstMatch(block, /<a[^>]*><span[^>]*icon-\[mdi--company\][^>]*><\/span>([\s\S]*?)<\/a>/);
  const cover = firstMatch(block, /<img[^>]*src="([^"]+)"/);

  const infoMatch = block.match(/<div class="text-gray-800[^"]*"[^>]*>([\s\S]*?)(?:<a\s|<script)/);
  const infoRaw = infoMatch ? stripTags(infoMatch[1]).trim() : '';
  const segments = infoRaw.split('·').map(s => s.trim()).filter(Boolean);

  return {
    id: md5,
    title: title || '未知书名',
    author,
    description: '',
    publisher,
    cover,
    language: segments[0] || '',
    format: segments[1] || '',
    size: segments[2] || '',
    year: segments[3] || '',
    category: segments[4] || '',
    source: segments[5] || '',
    detailUrl: `https://${domain}/md5/${md5}`,
  };
}

// ─── 知轩藏书 (zxcs.zip) ───────────────────────────────────────────────

/**
 * 知轩藏书搜索流程：
 *   1. 搜索页 `https://zxcs.zip/search?q={keyword}` — Angular SSR 渲染，正则提取首个 `/book/{id}.html`
 *   2. 详情页 `https://zxcs.zip/book/{id}.html` — 提取作者/简介/字数/状态/大小/分类/标签
 *   3. 下载直链 `https://download.zxcs.zip/{书名}.txt` — 无加密无混淆，明文 txt
 *
 * 与可乐小说不同：zxcs 是明文 HTML + 直链下载，无 AES 加密、无字体反混淆。
 */

/** 从搜索页 HTML 提取第一本书 */
function parseZxcsSearchResult(html: string): { title: string; bookUrl: string } | null {
  // Angular SSR 结构：<a href="/book/675.html" target="_self" ...><div class="tile-wrapper">...
  //   <span _ngcontent-wfr-c36="" class="link ng-tns-c36-0">《仙逆》...</span>
  // 注意：Angular 会给标签追加 _ngcontent 属性和 class 组件 ID 后缀，需用 `[^>]*` 和 `[^"]*` 兼容
  const match = html.match(
    /href="(\/book\/\d+\.html)"\s+target="_self"[^>]*>[\s\S]*?<span[^>]*class="link[^"]*">([\s\S]*?)<\/span>/,
  );
  if (!match) return null;
  return {
    bookUrl: match[1],
    title: decodeEntities(match[2].trim()),
  };
}

/** 从详情页 HTML 提取书籍详情和 txt 下载直链 */
function parseZxcsDetailPage(
  html: string,
  searchResult: { title: string; bookUrl: string },
): NovelItem | null {
  // 书籍 ID
  const idMatch = searchResult.bookUrl.match(/\/book\/(\d+)\.html/);
  const bookId = idMatch ? idMatch[1] : '';

  // txt 下载直链：<a href="https://download.zxcs.zip/..." download id="downloadtxt">
  const downloadMatch = html.match(/<a href="([^"]+)"\s+download\s+id="downloadtxt"/);
  const downloadUrl = downloadMatch ? downloadMatch[1] : '';
  if (!downloadUrl) return null;

  // 作者
  const author = firstMatch(html, /【作者】：([^<]+)<\/p>/);

  // 简介（<br /> 后到 </p>，压缩空白）
  const introRaw = firstMatch(html, /【内容简介】：<br\s*\/?>([\s\S]*?)<\/p>/);
  const description = introRaw ? decodeEntities(stripTags(introRaw.replace(/\s+/g, ' '))).trim() : '';

  // 字数（并入 size 后缀，便于卡片展示）
  const wordCount = firstMatch(html, /【字数】：([^<]+)<\/p>/).trim();

  // 状态（完本 / 连载）
  const status = firstMatch(html, /【状态】：([^<]+)<\/p>/);

  // TXT 大小（追加字数信息）
  const txtSize = firstMatch(html, /【TXT大小】：([^<]+)<\/p>/).trim();
  const size = wordCount ? `${txtSize} · ${wordCount}字` : txtSize;

  // 分类
  const category = firstMatch(html, /【分类】：<a[^>]*>([^<]+)<\/a>/);

  // 标签（多个 a，拼接）
  const tagBlock = html.match(/【标签】：([\s\S]*?)<\/p>/);
  const tags = tagBlock
    ? (tagBlock[1].match(/<a[^>]*>([^<]+)<\/a>/g) || [])
        .map(t => t.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
        .join(',')
    : '';

  // 校对版本（如 "校对版全本"）
  const proofread = firstMatch(html, /【校对】：([^<]+)<\/p>/);

  return {
    id: bookId,
    title: searchResult.title,
    author,
    description,
    publisher: '知轩藏书',
    cover: '',
    language: '中文',
    format: 'TXT',
    size,
    year: '',
    category: [category, status, proofread].filter(Boolean).join(' / ') || tags,
    source: '知轩藏书',
    detailUrl: downloadUrl,
  };
}

/** 知轩藏书搜索：抓取第一本书 + 详情页 txt 下载直链 */
async function searchZxcsNovel(keyword: string): Promise<{ item: NovelItem | null; error: string | null }> {
  try {
    // 1. 抓取搜索页
    const searchUrl = `https://${ZXCS_DOMAIN}/search?q=${encodeURIComponent(keyword)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const r = await fetchWithRetry(searchUrl, { headers: ZXCS_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!r.ok) return { item: null, error: `HTTP ${r.status}` };
    const searchHtml = await r.text();

    // 2. 解析第一本书
    const firstResult = parseZxcsSearchResult(searchHtml);
    if (!firstResult) return { item: null, error: null }; // 无搜索结果不算错误

    // 3. 抓取详情页
    const detailUrl = `https://${ZXCS_DOMAIN}${firstResult.bookUrl}`;
    const detailController = new AbortController();
    const detailTimeoutId = setTimeout(() => detailController.abort(), FETCH_TIMEOUT);
    const dr = await fetchWithRetry(detailUrl, { headers: ZXCS_HEADERS, signal: detailController.signal });
    clearTimeout(detailTimeoutId);
    if (!dr.ok) return { item: null, error: `详情页 HTTP ${dr.status}` };
    const detailHtml = await dr.text();

    // 4. 解析详情页
    const item = parseZxcsDetailPage(detailHtml, firstResult);
    return { item, error: item ? null : '未找到 txt 下载链接' };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'unknown';
    console.error('[novel-search] zxcs error:', sanitizeError(errorMessage));
    return { item: null, error: errorMessage };
  }
}

// ─── 奇书网 (xqishuta.org) ─────────────────────────────────────────────

/**
 * 奇书网搜索流程：
 *   1. 抓取搜索页 → 解析第一本书的书名/作者/详情页URL
 *   2. 抓取详情页 → 提取 txt 下载链接、封面、简介、文件大小等
 *
 * 详情页 txt 下载链接在 script 标签内：
 *   get_down_url('/ShtmlXXXX.html','http://dzs.xqishuta.org/XX/XXXX/书名.txt','书名')
 */

/** 从搜索页 HTML 提取第一本书 */
function parseXqishutaSearchResult(html: string): { title: string; author: string; bookUrl: string } | null {
  const match = html.match(
    /<td class="even"><a href="(\/Shtml\d+\.html)">([\s\S]*?)<\/a><\/td>\s*<td class="odd">([\s\S]*?)<\/td>/,
  );
  if (!match) return null;
  return {
    bookUrl: match[1],
    title: decodeEntities(stripTags(match[2]).trim()),
    author: decodeEntities(stripTags(match[3]).trim()),
  };
}

/** 从详情页 HTML 提取书籍详情和 txt 下载链接 */
function parseXqishutaDetailPage(
  html: string,
  searchResult: { title: string; author: string; bookUrl: string },
): NovelItem | null {
  // 书籍 ID
  const idMatch = searchResult.bookUrl.match(/\/Shtml(\d+)\.html/);
  const bookId = idMatch ? idMatch[1] : '';

  // txt 下载链接（script 内 get_down_url 第二个参数）
  const downloadMatch = html.match(/get_down_url\([^,]+,'([^']+)'/);
  const downloadUrl = downloadMatch ? downloadMatch[1] : '';
  if (!downloadUrl) return null;

  // 封面
  const coverMatch = html.match(/<div class="detail_pic"><img src="([^"]+)"/);
  const cover = coverMatch ? `http://${XQS_DOMAIN}${coverMatch[1]}` : '';

  // 文件大小
  const sizeMatch = html.match(/文件大小：([\s\S]*?)<\/li>/);
  const size = sizeMatch ? stripTags(sizeMatch[1]).trim() : '';

  // 书籍类型（格式）
  const typeMatch = html.match(/书籍类型：([\s\S]*?)<\/li>/);
  const format = typeMatch ? stripTags(typeMatch[1]).trim() : 'TXT';

  // 更新年份
  const dateMatch = html.match(/更新日期：(\d{4})-/);
  const year = dateMatch ? dateMatch[1] : '';

  // 连载状态
  const statusMatch = html.match(/连载状态：([\s\S]*?)<\/li>/);
  const category = statusMatch ? stripTags(statusMatch[1]).trim() : '';

  // 简介（showInfo 内第一个 <p>）
  const descMatch = html.match(/<div class="showInfo">\s*<p>([\s\S]*?)<\/p>/);
  const description = descMatch
    ? decodeEntities(stripTags(descMatch[1].replace(/&mdash;/g, '—'))).trim()
    : '';

  return {
    id: bookId,
    title: searchResult.title,
    author: searchResult.author,
    description,
    publisher: '奇书网',
    cover,
    language: '中文',
    format,
    size,
    year,
    category,
    source: '奇书网',
    detailUrl: downloadUrl,
  };
}

/** 奇书网搜索：抓取第一本书 + 详情页 txt 下载链接 */
async function searchXqishutaNovel(keyword: string): Promise<{ item: NovelItem | null; error: string | null }> {
  try {
    // 1. 抓取搜索页
    const searchUrl = `http://${XQS_DOMAIN}/search.html?searchkey=${encodeURIComponent(keyword)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const r = await fetchWithRetry(searchUrl, { headers: XQS_HEADERS, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!r.ok) return { item: null, error: `HTTP ${r.status}` };
    const searchHtml = await r.text();

    // 2. 解析第一本书
    const firstResult = parseXqishutaSearchResult(searchHtml);
    if (!firstResult) return { item: null, error: null }; // 无搜索结果不算错误

    // 3. 抓取详情页
    const detailUrl = `http://${XQS_DOMAIN}${firstResult.bookUrl}`;
    const detailController = new AbortController();
    const detailTimeoutId = setTimeout(() => detailController.abort(), FETCH_TIMEOUT);
    const dr = await fetchWithRetry(detailUrl, { headers: XQS_HEADERS, signal: detailController.signal });
    clearTimeout(detailTimeoutId);
    if (!dr.ok) return { item: null, error: `详情页 HTTP ${dr.status}` };
    const detailHtml = await dr.text();

    // 4. 解析详情页
    const item = parseXqishutaDetailPage(detailHtml, firstResult);
    return { item, error: item ? null : '未找到 txt 下载链接' };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'unknown';
    console.error('[novel-search] xqishuta error:', sanitizeError(errorMessage));
    return { item: null, error: errorMessage };
  }
}

// ─── Anna's Archive 搜索（提取为独立函数） ─────────────────────────────

async function searchAnnasArchive(keyword: string, page: number): Promise<{ novels: NovelItem[]; error: string | null }> {
  try {
    const { html, domain } = await fetchWithFailover(
      (d) => `https://${d}/search?q=${encodeURIComponent(keyword)}${page > 1 ? `&page=${page}` : ''}`,
    );

    const parts = html.split(/<div class="flex\s+pt-3 pb-3 border-b/);
    const blocks = parts.slice(1);

    const novels: NovelItem[] = [];
    for (const block of blocks) {
      if (novels.length >= PAGE_LIMIT) break;
      const item = parseNovelItem(block, domain);
      if (item) novels.push(item);
    }

    if (novels.length > 0) {
      await fetchDescriptions(novels);
    }

    return { novels, error: null };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'unknown';
    console.error('[novel-search] Anna\'s Archive error:', sanitizeError(errorMessage));
    return { novels: [], error: errorMessage };
  }
}

// ─── 搜索入口（三源并行，zxcs → 奇书网 → Anna 置顶） ─────────────────

export async function searchNovel(keyword: string, page: number): Promise<NovelSearchResult> {
  const safePage = Math.max(1, page);

  // zxcs / 奇书网仅 page=1 时抓取（翻页不重复置顶）
  const [aaResult, xqsResult, zxcsResult] = await Promise.all([
    searchAnnasArchive(keyword, safePage),
    safePage === 1 ? searchXqishutaNovel(keyword) : Promise.resolve({ item: null, error: null }),
    safePage === 1 ? searchZxcsNovel(keyword) : Promise.resolve({ item: null, error: null }),
  ]);

  const novels: NovelItem[] = [];
  const errors: Record<string, string | null> = {};

  // 1. 知轩藏书结果置顶
  if (zxcsResult.item) {
    novels.push(zxcsResult.item);
  }
  if (zxcsResult.error) {
    errors.zxcs = zxcsResult.error;
  }

  // 2. 奇书网结果次之
  if (xqsResult.item) {
    novels.push(xqsResult.item);
  }
  if (xqsResult.error) {
    errors.xqishuta = xqsResult.error;
  }

  // 3. Anna's Archive 结果
  novels.push(...aaResult.novels);
  if (aaResult.error) {
    errors.annas_archive = aaResult.error;
  }

  return {
    resultType: 'novel',
    keyword,
    page: safePage,
    total: novels.length,
    errors,
    novels,
  };
}
