/**
 * JavProvider — JAV 搜索适配器
 *
 * 适配 jav.ts 的搜索逻辑，实现 SearchProvider 接口。
 * 注意：JAV 搜索模式与动漫/影视不同——以番号(code)为精确匹配，
 *       走详情页解析 + 磁力提取路径。
 *
 * 共享工具（normalizeCode/parseMagnets/parseJavDetail 等）提取至 jav-utils.ts
 */
import { SearchProvider, SearchResultBase, SearchOptions } from '@/services/search-provider';
import { normalizeCode, get, extractGidUc, parseMagnets, parseJavDetail, type MagnetItem } from '@/services/jav-utils';

// ─── 类型定义 ────────────────────────────────────────────────────────────

export interface JavDetailResult {
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
  detail?: JavDetailResult;
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

      // 解析基本信息（使用共享的 parseJavDetail）
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
}

/** 导出单例 */
export const javProvider = new JavProvider();
