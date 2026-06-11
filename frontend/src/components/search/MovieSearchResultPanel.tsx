import React, { useState } from 'react';
import {
  Star, Film, Tv2, Calendar, Copy, Check, Magnet,
  ExternalLink, AlertCircle, Wifi, RefreshCw,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type {
  MovieEnrichedData,
  TMDBResult,
  ResourceItem,
} from '@/types/search';

// ─── helpers ────────────────────────────────────────────────────────────────

const ratingColor = (n: number) =>
  n >= 8 ? 'text-emerald-400' : n >= 6 ? 'text-yellow-400' : 'text-slate-400';

const mediaTypeLabel = (t: 'movie' | 'tv') =>
  t === 'movie' ? '电影' : '剧集';

const textPrimary = (isDark: boolean) => (isDark ? 'text-slate-100' : 'text-slate-800');
const textSecondary = (isDark: boolean) => (isDark ? 'text-slate-300' : 'text-slate-700');
const textMuted = (isDark: boolean) => (isDark ? 'text-slate-500' : 'text-slate-400');
const borderBase = (isDark: boolean) => (isDark ? 'border-slate-800' : 'border-slate-200');
const tableHead = (isDark: boolean) =>
  isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500';
const cardBg = (isDark: boolean) =>
  isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-200 bg-white';

// ─── sub-components ─────────────────────────────────────────────────────────

const CopyBtn: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-slate-700/60 text-slate-400 hover:bg-blue-600/30 hover:text-blue-300'
      }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {label ?? (copied ? '已复制' : '复制')}
    </button>
  );
};

const MovieCard: React.FC<{
  item: TMDBResult;
  onSelect: (item: TMDBResult) => void;
  active: boolean;
  isDark: boolean;
}> = ({ item, onSelect, active, isDark }) => (
  <button
    onClick={() => onSelect(item)}
    className={`group text-left w-full flex gap-3 p-3 rounded-xl border transition-all ${
      active
        ? 'border-blue-500/60 bg-blue-500/10'
        : `${isDark ? 'border-slate-700/50 bg-slate-800/40' : 'border-slate-200 bg-white'} hover:border-blue-500/30 ${isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'}`
    }`}
  >
    <div className="flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-slate-700">
      {item.poster ? (
        <img
          src={item.poster}
          alt={item.title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {item.mediaType === 'movie' ? (
            <Film className="w-5 h-5 text-slate-600" />
          ) : (
            <Tv2 className="w-5 h-5 text-slate-600" />
          )}
        </div>
      )}
    </div>

    <div className="min-w-0 flex-1">
      <p className={`font-medium text-sm leading-tight truncate transition-colors ${
        active ? 'text-blue-300' : `${textPrimary(isDark)} group-hover:text-blue-300`
      }`}>
        {item.title}
      </p>
      {item.originalTitle && item.originalTitle !== item.title && (
        <p className="text-xs text-slate-500 truncate mt-0.5">{item.originalTitle}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400">
        {item.source === 'douban' ? (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400">豆瓣</span>
        ) : (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/20 text-cyan-400">TMDB</span>
        )}
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
          item.mediaType === 'movie'
            ? 'bg-blue-500/20 text-blue-400'
            : 'bg-purple-500/20 text-purple-400'
        }`}>
          {mediaTypeLabel(item.mediaType)}
        </span>
        {item.year && (
          <span className="flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />{item.year}
          </span>
        )}
        {item.rating > 0 && (
          <span className={`flex items-center gap-0.5 ${ratingColor(item.rating)}`}>
            <Star className="w-3 h-3 fill-current" />{item.rating.toFixed(1)}
          </span>
        )}
      </div>
      {item.overview && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{item.overview}</p>
      )}
    </div>
  </button>
);

const ResourceRow: React.FC<{ item: ResourceItem; idx: number }> = ({ item, idx }) => (
  <tr className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
    idx % 2 === 0 ? '' : 'bg-slate-900/20'
  }`}>
    <td className="py-2.5 px-3 max-w-0 w-full">
      <p className="text-sm text-slate-200 break-words leading-snug">{item.title}</p>
      <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-slate-500">
        {item.size && <span>{item.size}</span>}
        {item.date && <span>{item.date}</span>}
      </div>
    </td>
    <td className="py-2.5 px-2 whitespace-nowrap">
      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
        {item.sourceLabel}
      </span>
    </td>
    <td className="py-2.5 px-2 whitespace-nowrap">
      <div className="flex items-center gap-1">
        <CopyBtn text={item.magnet} />
        <a
          href={item.magnet}
          title="打开磁力链接"
          className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all"
        >
          <Magnet className="w-3.5 h-3.5" />
        </a>
      </div>
    </td>
  </tr>
);

// ─── main component ──────────────────────────────────────────────────────────

interface MovieSearchResultPanelProps {
  data: MovieEnrichedData;
  isDark?: boolean;
  onRefresh?: () => void;
  onPageChange?: (page: number) => void;
}

export const MovieSearchResultPanel: React.FC<MovieSearchResultPanelProps> = ({
  data,
  isDark = true,
  onRefresh,
  onPageChange,
}) => {
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(
    data.results.length > 0 ? data.results[0] : null
  );

  const results = data.results ?? [];
  const resources = data.resources ?? [];

  // Filter resources by selected item title (fuzzy)
  const filteredResources = selectedItem
    ? resources.filter((r) =>
        r.title.toLowerCase().includes(selectedItem.title.toLowerCase()) ||
        r.title.toLowerCase().includes(selectedItem.originalTitle.toLowerCase()) ||
        resources.length <= 5
      )
    : resources;

  const displayResources = filteredResources.length > 0 ? filteredResources : resources;

  return (
    <div className="space-y-5">
      {/* stats bar */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-3 text-xs ${textMuted(isDark)}`}>
          <span>TMDB {data.total} 条</span>
          <span>·</span>
          <span>磁力资源 {data.resourceTotal} 条</span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> 刷新
          </button>
        )}
      </div>

      {/* error warnings */}
      {data.tmdbError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>TMDB 请求失败：{data.tmdbError}</span>
        </div>
      )}
      {data.doubanError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>豆瓣请求失败：{data.doubanError}</span>
        </div>
      )}

      {/* completely empty state */}
      {results.length === 0 && resources.length === 0 && !data.tmdbError && !data.doubanError && (
        <div className="text-center py-16">
          <Wifi className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">未找到相关结果</p>
          <p className="text-xs text-slate-600 mt-1">尝试更换关键词</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* left: TMDB results list */}
        {results.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500" />
              <h2 className={`text-sm font-semibold ${textSecondary(isDark)}`}>
                影视匹配
              </h2>
              <span className="ml-auto text-xs text-slate-600">{results.length} 条</span>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {results.map((item) => (
                <MovieCard
                  key={`${item.mediaType}-${item.id}`}
                  item={item}
                  onSelect={setSelectedItem}
                  active={
                    selectedItem?.id === item.id &&
                    selectedItem?.mediaType === item.mediaType
                  }
                  isDark={isDark}
                />
              ))}
            </div>

            {/* pagination */}
            {onPageChange && results.length >= 18 && (
              <div className="flex justify-center gap-2 pt-2">
                <button
                  disabled={data.page <= 1}
                  onClick={() => onPageChange(data.page - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 text-slate-400
                             hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> 上页
                </button>
                <span className="flex items-center px-3 text-xs text-slate-500">
                  第 {data.page} 页
                </span>
                <button
                  onClick={() => onPageChange(data.page + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 text-slate-400
                             hover:bg-slate-700 hover:text-slate-200 transition-all"
                >
                  下页 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ) : !data.tmdbError && !data.doubanError ? (
          <div className={`rounded-xl border p-6 text-center ${cardBg(isDark)}`}>
            <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">未找到影视匹配结果</p>
          </div>
        ) : null}

        {/* right: detail + resources */}
        <div className="min-w-0 space-y-5">
          {/* selected item detail */}
          {selectedItem && (
            <div className={`rounded-xl border p-4 ${cardBg(isDark)}`}>
              <div className="flex gap-4">
                {selectedItem.backdrop || selectedItem.poster ? (
                  <img
                    src={selectedItem.backdrop ?? selectedItem.poster!}
                    alt={selectedItem.title}
                    className="hidden sm:block w-48 h-28 object-cover rounded-lg flex-shrink-0 bg-slate-700"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className={`font-bold text-lg leading-tight ${textPrimary(isDark)}`}>
                        {selectedItem.title}
                      </h3>
                      {selectedItem.originalTitle !== selectedItem.title && (
                        <p className="text-sm text-slate-500 mt-0.5">
                          {selectedItem.originalTitle}
                        </p>
                      )}
                    </div>
                    <a
                      href={
                        selectedItem.source === 'douban'
                          ? `https://movie.douban.com/subject/${Math.abs(selectedItem.id)}/`
                          : `https://www.themoviedb.org/${selectedItem.mediaType}/${selectedItem.id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-blue-400 transition-colors"
                      title={
                        selectedItem.source === 'douban'
                          ? '在豆瓣查看'
                          : '在 TMDB 查看'
                      }
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-400">
                    {selectedItem.source === 'douban' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                        豆瓣
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400">
                        TMDB
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedItem.mediaType === 'movie'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {mediaTypeLabel(selectedItem.mediaType)}
                    </span>
                    {selectedItem.year && <span>{selectedItem.year}</span>}
                    {selectedItem.rating > 0 && (
                      <span
                        className={`flex items-center gap-1 ${ratingColor(
                          selectedItem.rating
                        )}`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {selectedItem.rating.toFixed(1)}
                        <span className="text-slate-600 text-xs">
                          ({selectedItem.voteCount})
                        </span>
                      </span>
                    )}
                  </div>
                  {selectedItem.overview && (
                    <p className="text-sm text-slate-500 mt-2 leading-relaxed line-clamp-3">
                      {selectedItem.overview}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* resource links */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 rounded-full bg-orange-500" />
              <h2 className={`text-sm font-semibold ${textSecondary(isDark)}`}>
                磁力资源
              </h2>
              <span className="text-xs text-slate-600">
                {displayResources.length} 条
              </span>
            </div>

            {displayResources.length === 0 ? (
              <div
                className={`rounded-xl border p-6 text-center ${
                  isDark ? 'border-slate-800 bg-slate-800/20' : 'border-slate-200 bg-slate-50'
                }`}
              >
                <Magnet className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">未抓取到磁力资源</p>
                <p className="text-xs text-slate-600 mt-1">
                  资源站可能暂不可访问，可直接前往
                  <a
                    href={`https://www.lightbt.top/search?q=${encodeURIComponent(
                      data.keyword
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline mx-1"
                  >
                    LightBT
                  </a>
                  或
                  <a
                    href={`https://www.yinfans.me/?s=${encodeURIComponent(
                      data.keyword
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline mx-1"
                  >
                    音范丝
                  </a>
                  搜索
                </p>
              </div>
            ) : (
              <div className={`rounded-xl overflow-hidden border ${borderBase(isDark)}`}>
                <table className="w-full text-left">
                  <thead>
                    <tr className={`text-xs ${tableHead(isDark)}`}>
                      <th className="py-2.5 px-3 font-medium">标题 / 大小 / 日期</th>
                      <th className="py-2.5 px-2 font-medium">来源</th>
                      <th className="py-2.5 px-2 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayResources.map((item, i) => (
                      <ResourceRow key={item.magnet + i} item={item} idx={i} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
