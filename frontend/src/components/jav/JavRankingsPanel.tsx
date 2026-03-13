import React, { useState } from 'react';
import {
  TrendingUp, Sparkles, Star, RefreshCw, Loader2, AlertCircle,
  Clock, ChevronDown, ChevronRight, Search, Award, Eye, Tag,
} from 'lucide-react';
import { useJavRankings } from '@/hooks/useJavRankings';
import type { JavItem, GenreRanking } from '@/types/jav';

interface JavRankingsPanelProps {
  onCodeClick: (code: string) => void;
}

function formatAge(ms: number | null): string {
  if (ms === null) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}分钟前`;
  return `${Math.floor(min / 60)}小时前`;
}

function getCodeColor(index: number): string {
  const colors = [
    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  ];
  return colors[index % colors.length];
}

interface TabListProps {
  items: JavItem[];
  onCodeClick: (code: string) => void;
  emptyText: string;
  cols?: 3 | 4;
}

const TabList: React.FC<TabListProps> = ({ items, onCodeClick, emptyText, cols = 4 }) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-surface-400">
        <Search className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">{emptyText}</p>
      </div>
    );
  }
  const gridClass = cols === 3
    ? 'grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2'
    : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2';
  return (
    <div className={gridClass}>
      {items.slice(0, 24).map((item, i) => (
        <button
          key={`${item.code}-${i}`}
          onClick={() => onCodeClick(item.code)}
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-all active:scale-[0.97] hover:shadow-sm ${getCodeColor(i)}`}
          title={item.title}
        >
          <span className="text-[10px] font-bold opacity-50 shrink-0 w-4 text-right">{i + 1}</span>
          <span className="text-xs font-semibold truncate">{item.code}</span>
        </button>
      ))}
    </div>
  );
};

interface GenreTabsProps {
  genres: GenreRanking[];
  onCodeClick: (code: string) => void;
}

const GenreTabs: React.FC<GenreTabsProps> = ({ genres, onCodeClick }) => {
  const [activeGenre, setActiveGenre] = useState<string>(genres[0]?.key ?? '');

  if (genres.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-surface-400">
        <Tag className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs">类别数据加载中...</p>
      </div>
    );
  }

  const current = genres.find(g => g.key === activeGenre) ?? genres[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {genres.map(g => (
          <button
            key={g.key}
            onClick={() => setActiveGenre(g.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeGenre === g.key
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            {g.genre}
            <span className="ml-1 opacity-60 text-[10px]">{g.items.length}</span>
          </button>
        ))}
      </div>
      <TabList items={current.items} onCodeClick={onCodeClick} emptyText="该类别暂无数据" cols={3} />
    </div>
  );
};

type MainTabId = 'popular' | 'newRelease' | 'mostWanted' | 'topRated' | 'uncensored' | 'genres';

interface MainTab {
  id: MainTabId;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const MAIN_TABS: MainTab[] = [
  { id: 'popular',    label: '近期热门', shortLabel: '热门', icon: TrendingUp, color: 'text-rose-600 dark:text-rose-400',    bgColor: 'bg-rose-100 dark:bg-rose-900/30' },
  { id: 'newRelease', label: '最新发行', shortLabel: '新作', icon: Sparkles,   color: 'text-blue-600 dark:text-blue-400',    bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  { id: 'mostWanted', label: '最多收藏', shortLabel: '收藏', icon: Star,        color: 'text-amber-600 dark:text-amber-400',  bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  { id: 'topRated',   label: '高分佳作', shortLabel: '高分', icon: Award,       color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  { id: 'uncensored', label: '无码精选', shortLabel: '无码', icon: Eye,         color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  { id: 'genres',     label: '按类别',   shortLabel: '类别', icon: Tag,         color: 'text-violet-600 dark:text-violet-400', bgColor: 'bg-violet-100 dark:bg-violet-900/30' },
];

export const JavRankingsPanel: React.FC<JavRankingsPanelProps> = ({ onCodeClick }) => {
  const { data, isLoading, error, fromCache, cacheAge, refresh } = useJavRankings();
  const [activeTab, setActiveTab] = useState<MainTabId>('popular');
  const [expanded, setExpanded] = useState(true);

  const activeTabConfig = MAIN_TABS.find(t => t.id === activeTab)!;

  const activeCount = (() => {
    if (!data) return 0;
    if (activeTab === 'genres') return data.genres.reduce((s, g) => s + g.items.length, 0);
    return (data[activeTab] as JavItem[])?.length ?? 0;
  })();

  return (
    <div className="collapsible-section animate-fade-in" style={{ animationDelay: '80ms' }}>
      <button onClick={() => setExpanded(!expanded)} className="collapsible-header">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${activeTabConfig.bgColor} flex items-center justify-center`}>
            <TrendingUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${activeTabConfig.color}`} />
          </div>
          <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">JAV 榜单</span>
          {data && activeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full">
              {activeCount}
            </span>
          )}
          {data?.sources && data.sources.length > 0 && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-surface-400 dark:text-surface-500">
              {data.sources.join(' · ')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {fromCache && cacheAge !== null && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-surface-400 dark:text-surface-500 shrink-0">
              <Clock className="w-3 h-3" />
              {formatAge(cacheAge)}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); refresh(); }}
            disabled={isLoading}
            className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all disabled:opacity-40"
            title="刷新榜单"
          >
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {expanded
            ? <ChevronDown className="w-4 h-4 text-surface-400" />
            : <ChevronRight className="w-4 h-4 text-surface-400" />}
        </div>
      </button>

      {expanded && (
        <div className="collapsible-content">
          {/* 主 Tab 切换 */}
          <div className="px-3 sm:px-4 pt-3 pb-2 border-b border-surface-100 dark:border-surface-800">
            <div className="flex gap-1 flex-wrap">
              {MAIN_TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? `${tab.bgColor} ${tab.color}`
                        : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 内容区 */}
          <div className="p-3 sm:p-4 min-h-[120px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-surface-400">
                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                <p className="text-xs">正在获取榜单数据...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-surface-400">
                <AlertCircle className="w-6 h-6 text-error-400" />
                <p className="text-xs text-error-500">{error}</p>
                <button onClick={refresh} className="text-xs text-primary-500 hover:text-primary-600 underline">
                  点击重试
                </button>
              </div>
            ) : activeTab === 'genres' ? (
              <GenreTabs genres={data?.genres ?? []} onCodeClick={onCodeClick} />
            ) : (
              <TabList
                items={(data?.[activeTab] as JavItem[]) ?? []}
                onCodeClick={onCodeClick}
                emptyText="暂无数据，点击右上角刷新按钮重试"
              />
            )}
          </div>

          {/* 底部提示 */}
          {data && !isLoading && !error && (
            <div className="px-3 sm:px-4 py-2.5 border-t border-surface-50 dark:border-surface-800/60">
              <p className="text-[10px] text-surface-400 dark:text-surface-500">
                💡 点击番号可快速填入搜索框
                {fromCache && cacheAge !== null && (
                  <span className="ml-2 sm:hidden">· 缓存 {formatAge(cacheAge)}</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
