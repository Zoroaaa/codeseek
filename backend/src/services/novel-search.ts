/**
 * 小说搜索服务
 * 数据源: Anna's Archive (https://zh.annas-archive.gl)
 *
 * 抓取搜索结果页 HTML，解析前 10 条结果的详情：
 *   书名 / 作者 / 出版社 / 封面 / 语言 / 格式 / 文件大小 / 年份 / 分类 / 详情下载链接
 *
 * ⚠️ 类型契约：本文件导出的接口（NovelItem, NovelSearchResult）
 *    与 frontend/src/types/search.ts 保持结构同步。
 *    修改任一端时，请同步更新另一端。
 *
 * 设计说明：
 *   - Anna's Archive 无公开 JSON API，仅返回服务端渲染 HTML，故用正则解析
 *   - 每条结果块的容器为 <div class="flex  pt-3 pb-3 border-b ...">
 *   - 详情页 /md5/<md5> 即下载页（页内列出多镜像下载入口），故 detailUrl 即下载入口
 */

import { fetchWithRetry } from '@/utils/fetch';
import { sanitizeError } from '@/utils/error';

// ─── Constants ───────────────────────────────────────────────────────────

const AA_BASE = 'https://zh.annas-archive.gl';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
/** 每次返回的结果数上限（用户需求：前 10 条） */
const PAGE_LIMIT = 10;

// ─── Types ──────────────────────────────────────────────────────────────

export interface NovelItem {
  /** MD5，作为唯一标识 */
  id: string;
  /** 书名 */
  title: string;
  /** 作者 */
  author: string;
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

/** 解码常见 HTML 实体 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** 去除标签，仅保留文本 */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** 取正则第一个捕获组，找不到返回空串 */
function firstMatch(html: string, re: RegExp): string {
  const m = html.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

/**
 * 解析单条结果块 HTML，提取结构化字段
 */
function parseNovelItem(block: string): NovelItem | null {
  // MD5（第一条 /md5/ 链接即封面/标题共用的 md5）
  const md5 = firstMatch(block, /href="\/md5\/([a-f0-9]{32})"/);
  if (!md5) return null;

  // 书名：含 js-vim-focus 的 <a> 标签文本
  const title = firstMatch(block, /<a[^>]*js-vim-focus[^>]*>([\s\S]*?)<\/a>/);
  // 作者：含 icon-[mdi--user-edit] 的 <a> 内 </span> 之后的文本
  const author = firstMatch(block, /<a[^>]*><span[^>]*icon-\[mdi--user-edit\][^>]*><\/span>([\s\S]*?)<\/a>/);
  // 出版社：含 icon-[mdi--company] 的 <a> 内 </span> 之后的文本
  const publisher = firstMatch(block, /<a[^>]*><span[^>]*icon-\[mdi--company\][^>]*><\/span>([\s\S]*?)<\/a>/);
  // 封面：第一条 <img> 的 src
  const cover = firstMatch(block, /<img[^>]*src="([^"]+)"/);

  // 文件信息：text-gray-800 容器内、首个 <a> 或 <script> 之前的文本
  // 形如：中文 [zh] · MOBI · 1.4MB · 2011 · 📕 小说类图书 · 🚀/lgli/upload/zlib
  const infoMatch = block.match(/<div class="text-gray-800[^"]*"[^>]*>([\s\S]*?)(?:<a\s|<script)/);
  const infoRaw = infoMatch ? stripTags(infoMatch[1]).trim() : '';
  const segments = infoRaw.split('·').map(s => s.trim()).filter(Boolean);

  const language = segments[0] || '';
  const format = segments[1] || '';
  const size = segments[2] || '';
  const year = segments[3] || '';
  const category = segments[4] || '';
  const source = segments[5] || '';

  return {
    id: md5,
    title: title || '未知书名',
    author,
    publisher,
    cover,
    language,
    format,
    size,
    year,
    category,
    source,
    detailUrl: `${AA_BASE}/md5/${md5}`,
  };
}

// ─── Anna's Archive Search ─────────────────────────────────────────────

export async function searchNovel(keyword: string, page: number): Promise<NovelSearchResult> {
  const safePage = Math.max(1, page);
  const url = `${AA_BASE}/search?q=${encodeURIComponent(keyword)}${safePage > 1 ? `&page=${safePage}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const r = await fetchWithRetry(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!r.ok) {
      throw new Error(`Anna's Archive HTTP ${r.status}`);
    }

    const html = await r.text();

    // 按结果块容器切分（容器 class 含 "flex  pt-3 pb-3 border-b"，flex 后有两个空格）
    const parts = html.split(/<div class="flex\s+pt-3 pb-3 border-b/);
    // parts[0] 为页头，parts[1..] 为各结果块
    const blocks = parts.slice(1);

    const novels: NovelItem[] = [];
    for (const block of blocks) {
      if (novels.length >= PAGE_LIMIT) break;
      const item = parseNovelItem(block);
      if (item) novels.push(item);
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
