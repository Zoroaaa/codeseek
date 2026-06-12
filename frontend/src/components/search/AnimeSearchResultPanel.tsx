import React, { useState } from 'react';
import {
  Star, Calendar, Tv, Copy, Check, Download, ExternalLink,
  Magnet, Wifi, RefreshCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import type {
  AnimeEnrichedData,
  BangumiSubject,
  NyaaTorrent,
  MikanItem,
} from '@/types/search';

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = {
  seedColor: (n: number) =>
    n >= 10 ? 'text-emerald-400' : n >= 1 ? 'text-yellow-400' : 'text-red-400',
  rating: (n: number) =>
    n >= 8 ? 'text-emerald-400' : n >= 6 ? 'text-yellow-400' : 'text-slate-400',
};

const cardBase = (isDark: boolean) =>
  isDark
    ? 'bg-slate-800/50 border-slate-700/50 hover:border-violet-500/50 hover:bg-slate-800/80'
    : 'bg-white border-slate-200 hover:border-violet-400/50 hover:bg-slate-50';

const textPrimary = (isDark: boolean) => (isDark ? 'text-slate-100' : 'text-slate-800');
const textSecondary = (isDark: boolean) => (isDark ? 'text-slate-300' : 'text-slate-700');
const textMuted = (isDark: boolean) => (isDark ? 'text-slate-500' : 'text-slate-400');
const borderBase = (isDark: boolean) => (isDark ? 'border-slate-800' : 'border-slate-200');
const tableHead = (isDark: boolean) =>
  isDark ? 'bg-slate-800/80 text-slate-400' : 'bg-slate-100 text-slate-500';

// ─── sub-components ─────────────────────────────────────────────────────────

const BangumiCard: React.FC<{ subject: BangumiSubject; isDark: boolean }> = ({ subject, isDark }) => (
  <a
    href={subject.url}
    target="_blank"
    rel="noopener noreferrer"
    className={`group flex gap-3 p-3 rounded-xl border transition-all ${cardBase(isDark)}`}
  >
    {subject.cover && (
      <img
        src={subject.cover}
        alt={subject.nameCN || subject.name}
        className="w-14 h-20 object-cover rounded-lg flex-shrink-0 bg-slate-700"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    )}
    <div className="min-w-0 flex-1">
      <p className={`font-medium text-sm leading-tight truncate group-hover:text-violet-300 transition-colors ${textPrimary(isDark)}`}>
        {subject.nameCN || subject.name}
      </p>
      {subject.nameCN && subject.name !== subject.nameCN && (
        <p className="text-xs text-slate-500 mt-0.5 truncate">{subject.name}</p>
      )}
      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-slate-400">
        {subject.rating > 0 && (
          <span className={`flex items-center gap-0.5 ${fmt.rating(subject.rating)}`}>
            <Star className="w-3 h-3 fill-current" />{subject.rating.toFixed(1)}
          </span>
        )}
        {subject.airDate && (
          <span className="flex items-center gap-0.5">
            <Calendar className="w-3 h-3" />{subject.airDate.slice(0, 7)}
          </span>
        )}
        {subject.eps > 0 && (
          <span className="flex items-center gap-0.5">
            <Tv className="w-3 h-3" />{subject.eps} 集
          </span>
        )}
      </div>
      {subject.summary && (
        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
          {subject.summary}
        </p>
      )}
    </div>
    <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-violet-400 flex-shrink-0 mt-0.5 transition-colors" />
  </a>
);

const CopyMagnetBtn: React.FC<{ magnet: string }> = ({ magnet }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(magnet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      title="复制磁力链接"
      className={`p-1.5 rounded-lg transition-all ${
        copied
          ? 'bg-emerald-500/20 text-emerald-400'
          : 'bg-slate-700/60 text-slate-400 hover:bg-violet-600/30 hover:text-violet-300'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

const NyaaRow: React.FC<{ item: NyaaTorrent; idx: number; isDark: boolean }> = ({ item, idx: _idx, isDark: _isDark }) => (
  <tr className="border-b border-slate-800/40 hover:bg-slate-800/50 transition-colors">
    <td className="py-2.5 px-3 max-w-0 w-full">
      <div className="flex items-start gap-2">
        {item.trusted && (
          <span className="flex-shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" title="可信" />
        )}
        <span className="text-sm text-slate-200 leading-snug break-words">{item.title}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
        <span>{item.category}</span>
        {item.size && <span>{item.size}</span>}
        {item.date && <span>{item.date}</span>}
        {item.source === 'animetosho' && (
          <span className="text-violet-400/70">AnimeTosho</span>
        )}
      </div>
    </td>
    <td className="py-2.5 px-2 text-center whitespace-nowrap">
      {item.hasSeedData === false ? (
        <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-500" title="AnimeTosho RSS 不含做种数，种子仍可通过 DHT 获取">DHT</span>
      ) : (
        <>
          <span className={`text-sm font-medium ${fmt.seedColor(item.seeders)}`}>{item.seeders}</span>
          <span className="text-slate-600 mx-0.5">/</span>
          <span className="text-sm text-red-400">{item.leechers}</span>
        </>
      )}
    </td>
    <td className="py-2.5 px-2 whitespace-nowrap">
      <div className="flex items-center gap-1">
        <CopyMagnetBtn magnet={item.magnet} />
        {item.torrentUrl && (
          <a
            href={item.torrentUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="下载 .torrent"
            className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-blue-600/30 hover:text-blue-300 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        )}
        {item.id && !item.id.startsWith('at-') && (
          <a
            href={`https://nyaa.si/view/${item.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title="在 Nyaa 查看"
            className="p-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-slate-600 hover:text-slate-200 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </td>
  </tr>
);

const MikanRow: React.FC<{ item: MikanItem; idx: number }> = ({ item, idx: _idx }) => (
  <tr className="border-b border-slate-800/40 hover:bg-slate-800/50 transition-colors">
    <td className="py-2.5 px-3 max-w-0 w-full">
      <span className="text-sm text-slate-200 leading-snug break-words">{item.title}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-500">
        {item.group && <span className="text-violet-400/70">[{item.group}]</span>}
        {item.size && <span>{item.size}</span>}
        {item.pubDate && <span>{item.pubDate.slice(0, 16)}</span>}
      </div>
    </td>
    <td className="py-2.5 px-2 text-center">
      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Mikan</span>
    </td>
    <td className="py-2.5 px-2 whitespace-nowrap">
      <CopyMagnetBtn magnet={item.magnet} />
    </td>
  </tr>
);

// ─── main component ──────────────────────────────────────────────────────────

interface AnimeSearchResultPanelProps {
  data: AnimeEnrichedData;
  isDark?: boolean;
  onRefresh?: () => void;
  onPageChange?: (page: number) => void;
}

export const AnimeSearchResultPanel: React.FC<AnimeSearchResultPanelProps> = ({
  data,
  isDark = true,
  onRefresh,
  onPageChange,
}) => {
  const [activeTab, setActiveTab] = useState<'nyaa' | 'mikan'>('nyaa');
  const [localPage, setLocalPage] = useState(1);
  const PAGE_SIZE = 10;

  const bgmList = data.bgm ?? [];
  const torrentList = data.nyaa ?? [];
  const mikanList = data.mikan ?? [];
  const hasResults = torrentList.length > 0 || mikanList.length > 0;

  const activeTorrents = activeTab === 'nyaa' ? torrentList : mikanList;
  const totalPages = Math.max(1, Math.ceil(activeTorrents.length / PAGE_SIZE));
  const pagedTorrents = activeTorrents.slice((localPage - 1) * PAGE_SIZE, localPage * PAGE_SIZE);

  // 切换来源 tab 时重置本地页码
  const handleSubTabChange = (tab: 'nyaa' | 'mikan') => {
    setActiveTab(tab);
    setLocalPage(1);
  };

  // error states
  const hasBgmError = !!data.errors?.bangumi;
  const hasNyaaError = !!data.errors?.nyaa;
  const hasMikanError = !!data.errors?.mikan;

  return (
    <div className="space-y-6">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {torrentList.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              {/* 来源分布 */}
              {(() => {
                const nyaaCount = torrentList.filter(t => !t.source || t.source === 'nyaa').length;
                const toshoCount = torrentList.filter(t => t.source === 'animetosho').length;
                return (
                  <>
                    {nyaaCount > 0 && <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">Nyaa {nyaaCount}</span>}
                    {toshoCount > 0 && <span className="px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">AnimeTosho {toshoCount}</span>}
                  </>
                );
              })()}
              <span className={textMuted(isDark)}>共 {data.total} 条资源</span>
            </div>
          )}
          {torrentList.length === 0 && (
            <span className={`text-xs ${textMuted(isDark)}`}>磁力 {data.total} 条</span>
          )}
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

      {/* errors */}
      {(hasBgmError || hasNyaaError || hasMikanError) && (
        <div className="space-y-2">
          {hasBgmError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 text-sm">
              <Wifi className="w-4 h-4 flex-shrink-0" />
              <span>Bangumi 请求失败：{data.errors.bangumi}</span>
            </div>
          )}
          {hasNyaaError && activeTab === 'nyaa' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm">
              <Wifi className="w-4 h-4 flex-shrink-0" />
              <span>Nyaa 请求失败：{data.errors.nyaa}</span>
            </div>
          )}
          {hasMikanError && activeTab === 'mikan' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
              <Wifi className="w-4 h-4 flex-shrink-0" />
              <span>Mikan 请求失败：{data.errors.mikan}</span>
            </div>
          )}
        </div>
      )}

      {/* completely empty state */}
      {!hasResults && bgmList.length === 0 && !hasBgmError && !hasNyaaError && !hasMikanError && (
        <div className="text-center py-16">
          <Wifi className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">未找到相关结果</p>
          <p className="text-xs text-slate-600 mt-1">尝试更换关键词</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* left: Bangumi metadata */}
        {bgmList.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-violet-500" />
              <h2 className={`text-sm font-semibold ${textSecondary(isDark)}`}>
                Bangumi 条目
              </h2>
              <a
                href={`https://bgm.tv/search/${encodeURIComponent(data.keyword)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                更多 →
              </a>
            </div>
            <div className="space-y-2">
              {bgmList.map((s) => (
                <BangumiCard key={s.id} subject={s} isDark={isDark} />
              ))}
            </div>
          </div>
        ) : hasBgmError ? null : (
          <div className={`rounded-xl border p-6 text-center ${borderBase(isDark)} ${
            isDark ? 'bg-slate-800/20' : 'bg-slate-50'
          }`}>
            <Star className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-500">未找到 Bangumi 条目</p>
          </div>
        )}

        {/* right: torrent results */}
        <div className="min-w-0">
          {/* tab switch */}
          <div className={`flex border-b ${borderBase(isDark)} mb-4`}>
            {[
              { key: 'nyaa', label: 'Nyaa.si', count: torrentList.length },
              { key: 'mikan', label: 'Mikan', count: mikanList.length },
            ].map(({ key, label, count }) => (
              <button
                key={key}
                onClick={() => handleSubTabChange(key as 'nyaa' | 'mikan')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                  activeTab === key
                    ? 'border-violet-500 text-violet-400'
                    : `border-transparent ${textMuted(isDark)} hover:${textSecondary(isDark)}`
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === key ? 'bg-violet-600/30 text-violet-300' : 'bg-slate-700/50 text-slate-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* empty state for torrents */}
          {!hasResults && (
            <div className="text-center py-12">
              <Magnet className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">未找到磁力资源</p>
              <p className="text-xs text-slate-600 mt-1">尝试更换关键词或数据源</p>
            </div>
          )}

          {/* 结果表格（两个 tab 共用 pagedTorrents） */}
          {pagedTorrents.length > 0 && activeTab === 'nyaa' && (
            <div className={`rounded-xl overflow-hidden border ${borderBase(isDark)}`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-xs ${tableHead(isDark)}`}>
                    <th className="py-2.5 px-3 font-medium">标题 / 分类 / 大小</th>
                    <th className="py-2.5 px-2 text-center font-medium whitespace-nowrap">
                      <span title="做种/下载（AnimeTosho 显示 DHT）">S/L</span>
                    </th>
                    <th className="py-2.5 px-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(pagedTorrents as NyaaTorrent[]).map((item, i) => (
                    <NyaaRow key={item.id || i} item={item} idx={i} isDark={isDark} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagedTorrents.length > 0 && activeTab === 'mikan' && (
            <div className={`rounded-xl overflow-hidden border ${borderBase(isDark)}`}>
              <table className="w-full text-left">
                <thead>
                  <tr className={`text-xs ${tableHead(isDark)}`}>
                    <th className="py-2.5 px-3 font-medium">标题 / 字幕组 / 大小 / 时间</th>
                    <th className="py-2.5 px-2 font-medium">来源</th>
                    <th className="py-2.5 px-2 font-medium">磁力</th>
                  </tr>
                </thead>
                <tbody>
                  {(pagedTorrents as MikanItem[]).map((item, i) => (
                    <MikanRow key={(item as MikanItem).magnet || i} item={item as MikanItem} idx={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 客户端分页（10条/页） */}
          {activeTorrents.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                disabled={localPage <= 1}
                onClick={() => setLocalPage(p => p - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 text-slate-400
                           hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> 上一页
              </button>
              <span className="text-xs text-slate-500 px-2">
                {localPage} / {totalPages}
                <span className="ml-1 text-slate-600">（共 {activeTorrents.length} 条）</span>
              </span>
              <button
                disabled={localPage >= totalPages}
                onClick={() => setLocalPage(p => p + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-800/60 text-slate-400
                           hover:bg-slate-700 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                下一页 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 服务端翻页（Nyaa 超过 75 条时请求下一页） */}
          {onPageChange && activeTab === 'nyaa' && torrentList.length >= 60 && localPage >= totalPages && (
            <div className="flex justify-center gap-2 mt-1">
              <button
                disabled={data.page <= 1}
                onClick={() => onPageChange(data.page - 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-violet-800/40 text-violet-300
                           hover:bg-violet-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> 上一批
              </button>
              <span className="flex items-center px-3 text-xs text-slate-500">第 {data.page} 批</span>
              <button
                onClick={() => onPageChange(data.page + 1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-violet-800/40 text-violet-300
                           hover:bg-violet-700/60 transition-all"
              >
                下一批 <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
