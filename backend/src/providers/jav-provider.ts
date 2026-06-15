/**
 * JavProvider — JAV 搜索适配器
 *
 * 适配 jav.ts 的搜索逻辑，实现 SearchProvider 接口。
 * 注意：JAV 搜索模式与动漫/影视不同——以番号(code)为精确匹配，
 *       走详情页解析 + 磁力提取路径。
 */
import { SearchProvider, SearchResultBase, SearchOptions, SuggestionItem, TrendingItem } from '@/services/search-provider';

// ─── 类型（复用自 jav.ts 的逻辑）─────────────────────────────────────────

interface MagnetItem {
  name: string;
  size: string;
  date: string;
  magnet: string;
  isHD: boolean;
}

interface JavDetailResult {
  code: string;
  title: string;
  cover?: string;
  releaseDate?: string;
  duration?: string;
  publisher?: string;
  tags: string[];
  actresses: string[];
  magnets: MagnetItem[];
  detailUrl: string;
}

export interface JavSearchResult extends SearchResultBase {
  resultType: 'jav';
  keyword: string;
  page: number;
  total: number;
  errors: Record<string, string | null>;
  /** 详情数据（精确匹配时返回） */
  detail?: JavDetailResult;
}

// ─── 工具函数（从 jav.ts 提取核心搜索逻辑）──────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,ja;q=0.8,en;q=0.7',
  'Referer': 'https://www.javbus.com/',
};

function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]+-\d+$/.test(s)) return s;
  const m = s.match(/^([A-Z]+)(\d+)$/);
  return m ? `${m[1]}-${m[2]}` : s;
}

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

/** 从详情页 HTML 提取 gid / uc */
function extractGidUc(html: string): { gid: string; uc: string } | null {
  const gidM = html.match(/var\s+gid\s*=\s*(\d+)/);
  const ucM = html.match(/var\s+uc\s*=\s*(\d+)/);
  if (gidM && ucM) return { gid: gidM[1], uc: ucM[1] };
  return null;
}

/** 解析磁力 Ajax 响应 HTML */
function parseMagnets(html: string): MagnetItem[] {
  if (!html) return [];
  const items: MagnetItem[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const rowHtml = row[1];
    const magnetM = rowHtml.match(/href="(magnet:\?xt=[^"]+)"/i);
    if (!magnetM) continue;
    const magnet = magnetM[1];
    const nameM = rowHtml.match(/<td[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i);
    const name = nameM ? nameM[1].trim() : '';
    const cells: string[] = [];
    const cellRe = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellRe.exec(rowHtml))) {
      cells.push(cell[1].replace(/<[^>]+>/g, '').trim());
    }
    const size = cells[1] ?? '';
    const date = cells[2] ?? '';
    const isHD = /hd|1080|720/i.test(name) || rowHtml.includes('btn-primary');
    items.push({ name: name || '未知', size, date, magnet, isHD });
  }
  return items;
}

/** 解析详情页主体信息 */
function parseJavDetail(html: string, code: string, detailUrl: string): Omit<JavDetailResult, 'magnets'> {
  const titleM = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) || html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle = titleM ? titleM[1].replace(/<[^>]+>/g, '').trim() : code;
  const title = rawTitle.replace(/\s*-\s*JavBus\s*$/i, '').trim();

  const coverM = html.match(/bigImage[^>]*href="([^"]+)"/i) || html.match(/<img[^>]+class="[^"]*cover[^"]*"[^>]+src="([^"]+)"/i);
  const cover = coverM ? coverM[1] : undefined;

  const infoField = (label: string): string | undefined => {
    const re = new RegExp(label + '[^:：]*[:：]\\s*<[^>]+>([^<]+)<', 'i');
    const m = html.match(re);
    if (m) return m[1].trim();
    const re2 = new RegExp(label + '[^:：]*[:：]([^<\\n]+)', 'i');
    const m2 = html.match(re2);
    return m2 ? m2[1].trim() : undefined;
  };

  const releaseDate = infoField('發行日期') ?? infoField('发行日期') ?? infoField('Release Date');
  const duration = infoField('長度') ?? infoField('长度') ?? infoField('Length');
  const publisher = infoField('發行商') ?? infoField('发行商') ?? infoField('Label');

  const tags: string[] = [];
  const tagSection = html.match(/class="genre"[\s\S]{0,5000}/i)?.[0] ?? '';
  const tagRe = /<a[^>]+href="[^"]*\/genre\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let tagM: RegExpExecArray | null;
  while ((tagM = tagRe.exec(tagSection))) {
    const t = tagM[1].trim();
    if (t) tags.push(t);
  }

  const actressSet = new Set<string>();
  const actresses: string[] = [];
  const starRe = /<a[^>]+href="[^"]*\/star\/[^"]*"[^>]*>([^<]+)<\/a>/gi;
  let starM: RegExpExecArray | null;
  while ((starM = starRe.exec(html))) {
    const name = starM[1].trim();
    if (name && name.length < 30 && !actressSet.has(name)) {
      actressSet.add(name);
      actresses.push(name);
    }
  }

  return { code, title, cover, releaseDate, duration, publisher, tags, actresses, detailUrl };
}

// ─── Provider 实现 ──────────────────────────────────────────────────────

export class JavProvider implements SearchProvider {
  readonly id = 'jav';
  readonly name = 'JAV搜索';
  /** JAV 不依赖 majorCategoryId 进行路由分发，由前端按 tab 判断。
   *  此处保留一个虚拟 category ID 用于 Registry 匹配。 */
  readonly supportedCategories = ['jav_sources'];

  async search(keyword: string, _page: number, _opts?: SearchOptions): Promise<JavSearchResult> {
    const code = normalizeCode(keyword);

    // 非标准番号格式 → 返回空结果（不抛错）
    if (!/^[A-Z]{2,8}-\d{2,6}$/.test(code)) {
      return {
        resultType: 'jav',
        keyword,
        page: 1,
        total: 0,
        errors: { search: '请输入有效的番号格式（如 ABP-123）' },
      };
    }

    try {
      const detailUrl = `https://www.javbus.com/${code}`;
      const html = await get(detailUrl, 15000);

      if (!html || html.length < 500) {
        return {
          resultType: 'jav',
          keyword,
          page: 1,
          total: 0,
          errors: { search: `未找到番号 ${code}` },
        };
      }

      // 解析基本信息
      const baseInfo = parseJavDetail(html, code, detailUrl);

      // 提取磁力链接
      let magnets: MagnetItem[] = [];
      const gidUc = extractGidUc(html);
      if (gidUc) {
        const magnetUrl = `https://www.javbus.com/ajax/uncledatoolsbyajax.php?lang=zh&gid=${gidUc.gid}&uc=${gidUc.uc}&floor=${Date.now()}`;
        const magnetHtml = await get(magnetUrl, 12000);
        magnets = parseMagnets(magnetHtml);
      }

      return {
        resultType: 'jav',
        keyword,
        page: 1,
        total: magnets.length,
        errors: { search: null },
        detail: { ...baseInfo, magnets },
      };
    } catch (err) {
      return {
        resultType: 'jav',
        keyword,
        page: 1,
        total: 0,
        errors: { search: err instanceof Error ? err.message : String(err) },
      };
    }
  }

  async suggestions(keyword: string): Promise<SuggestionItem[]> {
    try {
      const upperKeyword = keyword.toUpperCase().trim();
      if (!upperKeyword) return [];

      // 从 JavBus 首页提取匹配的番号
      const html = await get('https://www.javbus.com/', 10000);
      if (!html) return [];

      // 复用 parseGrid 的简化版来提取番号
      const codes: string[] = [];
      const re = /<span[^>]*class="[^"]*id[^"]*"[^>]*>([A-Za-z0-9]+-\d+)<\/span>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) !== null) {
        const c = normalizeCode(m[1]);
        if (c.startsWith(upperKeyword) || c.includes(upperKeyword)) {
          if (codes.length < 10 && !codes.includes(c)) codes.push(c);
        }
      }
      return codes.map(c => ({ text: c }));
    } catch {
      return [];
    }
  }

  async trending(): Promise<TrendingItem[]> {
    try {
      // 返回 JavBus 首页热门番号作为 trending
      const html = await get('https://www.javbus.com/', 10000);
      if (!html) return [];

      const items: TrendingItem[] = [];
      const re = /<a[^>]+class="movie-box"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;

      while ((m = re.exec(html)) !== null && items.length < 10) {
        const block = m[1];
        const codeM = block.match(/<span[^>]*class="[^"]*id[^"]*"[^>]*>([A-Za-z0-9]+-\d+)<\/span>/i);
        if (!codeM) continue;

        const code = normalizeCode(codeM[1]);
        const titleM = block.match(/title="([^"]+)"/i);
        const coverM = block.match(/<img[^>]+src="([^"]+)"/i);

        items.push({
          keyword: code,
          count: 0,
          subtitle: titleM ? titleM[1].slice(0, 30) : undefined,
          cover: coverM ? coverM[1] : undefined,
        });
      }
      return items;
    } catch {
      return [];
    }
  }
}

/** 导出单例 */
export const javProvider = new JavProvider();
