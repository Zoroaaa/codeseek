/**
 * JavActressResultsPanel — JAV 女优搜索结果面板
 *
 * 当 javtab 处于 actress 子模式时渲染，展示 minnano-av.com 抓取的女优资料。
 * 数据来源：后端 routes/search.ts 在 javSubMode==='actress' 时短路调用 fetchActresses。
 */
import { useState } from 'react';
import { ExternalLink, Users, ChevronLeft, ChevronRight, Wifi, MapPin, Calendar, Building2, Star, Link2 } from 'lucide-react';
import type { JavEnrichedData, ActressProfile } from '@/types/search';
import { convertToProxyUrl } from '@/services/proxy';

const PAGE_SIZE = 10;

// ─── 女优卡片 ────────────────────────────────────────────────────────────

function ActressCard({ item, isProxyEnabled }: { item: ActressProfile; isProxyEnabled: boolean }) {
  const imgSrc = isProxyEnabled && item.cover ? convertToProxyUrl(item.cover) : item.cover;

  const metrics: string[] = [];
  if (item.height) metrics.push(`T${item.height}`);
  if (item.bust && item.cup) metrics.push(`B${item.bust}(${item.cup})`);
  if (item.waist) metrics.push(`W${item.waist}`);
  if (item.hip) metrics.push(`H${item.hip}`);

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all">
      {/* 封面 */}
      {imgSrc && (
        <img
          src={imgSrc}
          alt={item.name}
          loading="lazy"
          className="shrink-0 w-12 h-16 rounded-md object-cover bg-stone-100 dark:bg-stone-800"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}

      {/* 信息 */}
      <div className="min-w-0 flex-1">
        {/* 名字 + 假名 + 罗马音 */}
        <div className="flex items-baseline gap-1.5 flex-wrap">
          {item.detailUrl ? (
            <a
              href={item.detailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              {item.name}
            </a>
          ) : (
            <span className="text-xs font-medium text-stone-700 dark:text-stone-300">{item.name}</span>
          )}
          {item.ruby && <span className="text-[10px] text-stone-400">{item.ruby}</span>}
          {item.romaji && <span className="text-[10px] text-stone-400 italic">{item.romaji}</span>}
        </div>

        {/* 别名 */}
        {item.alias && (
          <div className="text-[10px] text-stone-500 mt-0.5">
            <span className="text-stone-400">别名：</span>{item.alias}
          </div>
        )}

        {/* 三围 / 身高 */}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {metrics.map((m, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[9px] font-medium bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 rounded">{m}</span>
            ))}
          </div>
        )}

        {/* 基本信息行 */}
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-stone-500">
          {item.birthday && (
            <span className="inline-flex items-center gap-0.5">
              <Calendar className="w-2.5 h-2.5" />{item.birthday}
              {item.zodiac && <span className="text-stone-400">{item.zodiac}</span>}
            </span>
          )}
          {item.prefecture && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />{item.prefecture}
            </span>
          )}
          {item.activePeriod && (
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5" />{item.activePeriod}
            </span>
          )}
          {item.agency && (
            <span className="inline-flex items-center gap-0.5">
              <Building2 className="w-2.5 h-2.5" />{item.agency}
            </span>
          )}
        </div>

        {/* 标签 */}
        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {item.tags.slice(0, 8).map((t, i) => (
              <span key={i} className="px-1 py-0.5 text-[9px] bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 rounded">{t}</span>
            ))}
          </div>
        )}

        {/* 外链 */}
        <div className="flex gap-2 mt-1">
          {item.blogUrl && (
            <a href={item.blogUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[9px] text-stone-400 hover:text-primary-500">
              <Link2 className="w-2.5 h-2.5" />博客
            </a>
          )}
          {item.officialUrl && (
            <a href={item.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[9px] text-stone-400 hover:text-primary-500">
              <Link2 className="w-2.5 h-2.5" />官网
            </a>
          )}
        </div>
      </div>

      {/* 详情外链 */}
      {item.detailUrl && (
        <a
          href={item.detailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] text-pink-500 hover:text-pink-400 transition-colors"
          title="查看完整资料"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── 主面板 ──────────────────────────────────────────────────────────────

export interface JavActressResultsPanelProps {
  data: JavEnrichedData;
  isProxyEnabled: boolean;
}

export function JavActressResultsPanel({ data, isProxyEnabled }: JavActressResultsPanelProps) {
  const [page, setPage] = useState(1);
  const actresses = data.actresses ?? [];
  const errorMsg = data.errors?.search;

  // 错误且无结果
  if (errorMsg && actresses.length === 0) {
    return (
      <div className="bg-white dark:bg-stone-900/90 rounded-2xl shadow-lg shadow-stone-900/5 border border-stone-200/60 dark:border-stone-700/60 p-6">
        <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400">
          <Wifi className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">女优搜索失败：{errorMsg}</span>
        </div>
      </div>
    );
  }

  // 空结果
  if (actresses.length === 0) {
    return null;
  }

  const totalPages = Math.max(1, Math.ceil(actresses.length / PAGE_SIZE));
  const paged = actresses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="bg-white dark:bg-stone-900/90 rounded-2xl shadow-lg shadow-stone-900/5 border border-stone-200/60 dark:border-stone-700/60 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-stone-100 dark:border-stone-800">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-500 dark:text-pink-400" />
          </div>
          <span className="font-semibold text-stone-900 dark:text-stone-100 text-sm sm:text-base">AV女优</span>
          <span className="px-2 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full">{actresses.length} 位</span>
        </div>
        <a
          href={`https://www.minnano-av.com/search_result.php?search_scope=actress&search_word=${encodeURIComponent(data.keyword)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-pink-500 hover:text-pink-400 transition-colors"
        >
          minnano 站内搜索 →
        </a>
      </div>

      {/* 列表 */}
      <div className="p-4 sm:p-5">
        <div className="space-y-1.5">
          {paged.map((item) => (
            <ActressCard key={item.id} item={item} isProxyEnabled={isProxyEnabled} />
          ))}

          {/* 分页 */}
          {actresses.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-500
                           hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all
                           dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-200"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> 上一页
              </button>
              <span className="text-xs text-stone-500 px-2">
                {page} / {totalPages}
                <span className="ml-1 text-stone-400">（共 {actresses.length} 位）</span>
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-500
                           hover:bg-stone-200 hover:text-stone-700 transition-all
                           dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-200"
              >
                下一页 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
