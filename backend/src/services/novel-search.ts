/**
 * 小说搜索服务
 * 数据源: Anna's Archive (https://zh.annas-archive.gl)
 *
 * 抓取搜索结果页 HTML，解析前 10 条结果的详情：
 *   书名 / 作者 / 出版社 / 封面 / 语言 / 格式 / 文件大小 / 年份 / 分类 / 详情下载链接 / 描述
 *
 * ⚠️ 类型契约：本文件导出的接口（NovelItem, NovelSearchResult）
 *    与 frontend/src/types/search.ts 保持结构同步。
 *
 * 设计说明：
 *   - Anna's Archive 无公开 JSON API，仅返回服务端渲染 HTML，故用正则解析
 *   - 多域名故障转移：主域名失败自动切换备用域名
 *   - 搜索结果列表页无描述，需额外请求详情页 /md5/<md5> 提取描述（并发限制 5）
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

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const FETCH_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
} as Record<string, string>;

/** 每次返回的结果数上限（用户需求：前 10 条） */
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

// ─── 搜索入口 ───────────────────────────────────────────────────────────

export async function searchNovel(keyword: string, page: number): Promise<NovelSearchResult> {
  const safePage = Math.max(1, page);

  try {
    const { html, domain } = await fetchWithFailover(
      (d) => `https://${d}/search?q=${encodeURIComponent(keyword)}${safePage > 1 ? `&page=${safePage}` : ''}`,
    );

    const parts = html.split(/<div class="flex\s+pt-3 pb-3 border-b/);
    const blocks = parts.slice(1);

    const novels: NovelItem[] = [];
    for (const block of blocks) {
      if (novels.length >= PAGE_LIMIT) break;
      const item = parseNovelItem(block, domain);
      if (item) novels.push(item);
    }

    // 并行抓取描述（不阻塞主流程：失败时 description 留空）
    if (novels.length > 0) {
      await fetchDescriptions(novels);
    }

    return {
      resultType: 'novel',
      keyword,
      page: safePage,
      total: novels.length,
      errors: {},
      novels,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'unknown';
    console.error('[novel-search] Anna\'s Archive error:', sanitizeError(errorMessage));

    return {
      resultType: 'novel',
      keyword,
      page: safePage,
      total: 0,
      errors: { annas_archive: errorMessage },
      novels: [],
    };
  }
}
