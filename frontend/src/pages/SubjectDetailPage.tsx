import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, Star, Calendar, Tv, Film, ExternalLink, Heart,
  Users, Trophy, Tag, Magnet, Loader2,
  ChevronLeft, ChevronRight, MessageSquare,
} from 'lucide-react';
import type {
  BangumiSubject,
  TMDBResult,
  AnimeUnifiedResource,
  ResourceItem,
  AnimeEnrichedData,
  MovieEnrichedData,
} from '@/types/search';
import { useAuthStore } from '@/stores';
import { searchApi } from '@/services/api';
import { CopyButton } from '@/components/ui/CopyButton';
import { getProxyImageUrl } from '@/utils/imageProxy';

// ─── 类型 ──────────────────────────────────────────────────────────

interface LocationState {
  subject?: BangumiSubject | TMDBResult;
  resources?: AnimeUnifiedResource[] | ResourceItem[];
  keyword?: string;
  type?: 'anime' | 'movie';
  // 相关推荐（同搜索结果中的其他作品）
  related?: Array<BangumiSubject | TMDBResult>;
}

// ─── 工具函数 ──────────────────────────────────────────────────────

const ratingColor = (n: number) =>
  n >= 8 ? 'text-emerald-400' : n >= 6 ? 'text-yellow-400' : 'text-stone-400';

const typeColor = (t?: string | number) => {
  const m: Record<string | number, string> = {
    2: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    6: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    4: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    3: 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400',
  };
  return t != null ? (m[t] ?? 'bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-400') : 'bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-400';
};

const typeLabel = (t?: string | number) => {
  const m: Record<string | number, string> = { 2: 'TV', 6: '剧场版', 4: 'Web', 3: '音乐' };
  return t != null ? (m[t] ?? String(t)) : '';
};

const statusColor = (s?: string) => {
  switch (s) {
    case '连载中': return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case '已完结': return 'bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-400';
    case '未开播': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
    default: return '';
  }
};

function extractQuality(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('2160') || t.includes('4k')) return '4K';
  if (t.includes('1080')) return '1080p';
  if (t.includes('720')) return '720p';
  return '';
}

const sourceBadge = (s: string) => {
  const m: Record<string, string> = {
    nyaa: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300',
    mikan: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300',
    animetosho: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
    showrss: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
    yts: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    eztv: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    tpb: 'bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-400',
  };
  return m[s] ?? 'bg-stone-100 text-stone-500 dark:bg-stone-700/40 dark:text-stone-400';
};

// ─── Anime 资源卡片 ────────────────────────────────────────────────

function AnimeResourceRow({ item }: { item: AnimeUnifiedResource }) {
  const quality = extractQuality(item.title);
  return (
    <div className="grid grid-cols-[1fr_120px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded ${sourceBadge(item.source)}`}>
            {item.sourceLabel}
          </span>
          {item.trusted && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" title="可信上传者" />
          )}
          {quality && (
            <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded ${
              quality === '4K' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'
            }`}>{quality}</span>
          )}
          {item.group && (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400 rounded truncate max-w-[80px]" title={`字幕组：${item.group}`}>
              {item.group}
            </span>
          )}
          <a href={item.magnet} className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate" title={item.title}>
            {item.title}
          </a>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-stone-500">
          {item.size && <span>{item.size}</span>}
          {item.date && <span>{item.date}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.source !== 'showrss' && item.source !== 'mikan' ? (
          <span className={`text-xs font-medium tabular-nums ${
            item.seeders >= 10 ? 'text-emerald-400' : item.seeders >= 1 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {item.seeders}<span className="text-stone-400 mx-0.5">/</span><span className="text-red-400">{item.leechers}</span>
          </span>
        ) : (
          <span className="text-[10px] text-stone-400">—</span>
        )}
        <CopyButton text={item.magnet} label="复制磁力链接" />
      </div>
    </div>
  );
}

// ─── Movie 资源卡片 ────────────────────────────────────────────────

function MovieResourceRow({ item }: { item: ResourceItem }) {
  const quality = extractQuality(item.title);
  return (
    <div className="grid grid-cols-[1fr_120px] gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-all">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {item.source && (
            <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded ${sourceBadge(item.source)}`}>
              {item.sourceLabel || item.source}
            </span>
          )}
          {quality && (
            <span className={`shrink-0 px-1.5 py-0.5 text-[9px] font-bold rounded ${
              quality === '4K' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-300'
            }`}>{quality}</span>
          )}
          {item.resourceType === 'drive' && (
            <span className="shrink-0 px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded">网盘</span>
          )}
          {item.resourceType === 'drive' && item.driveUrl ? (
            <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-amber-600 dark:text-amber-400 hover:underline truncate" title={item.title}>
              {item.title}
            </a>
          ) : item.magnet ? (
            <a href={item.magnet} className="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate" title={item.title}>
              {item.title}
            </a>
          ) : (
            <span className="text-xs text-stone-600 dark:text-stone-300 truncate">{item.title}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 mt-1 text-[10px] text-stone-500">
          {item.size && <span>{item.size}</span>}
          {item.date && <span>{item.date}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 justify-end">
        {item.resourceType === 'drive' && item.driveUrl ? (
          <>
            <a href={item.driveUrl} target="_blank" rel="noopener noreferrer" title="打开网盘" className="p-1 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            {item.driveCode && <CopyButton text={item.driveCode} label={`提取码: ${item.driveCode}`} />}
          </>
        ) : item.magnet ? (
          <>
            <CopyButton text={item.magnet} label="复制磁力链接" />
            <a href={item.magnet} title="打开磁力链接" className="p-1 rounded text-stone-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all">
              <Magnet className="w-3.5 h-3.5" />
            </a>
          </>
        ) : null}
      </div>
    </div>
  );
}

// ─── 筛选芯片 ──────────────────────────────────────────────────────

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full transition-all ${
        active
          ? 'bg-amber-500 text-white font-medium'
          : 'bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-700'
      }`}
    >
      {children}
    </button>
  );
}

// ─── 资源面板(带筛选排序,支持两种资源类型) ────────────────────────

function ResourcePanel<T extends AnimeUnifiedResource | ResourceItem>({
  resources,
  renderRow,
}: {
  resources: T[];
  renderRow: (item: T) => React.ReactNode;
}) {
  const [sortBy, setSortBy] = useState<'seeders' | 'date' | 'size'>('date');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [filterQuality, setFilterQuality] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // 统计
  const sourceCounts = useMemo(() => {
    const c: Record<string, number> = {};
    resources.forEach(r => {
      const s = (r as AnimeUnifiedResource).source || (r as ResourceItem).source;
      if (s) c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [resources]);

  const qualityCounts = useMemo(() => {
    const c: Record<string, number> = {};
    resources.forEach(r => {
      const q = extractQuality(r.title);
      if (q) c[q] = (c[q] || 0) + 1;
    });
    return c;
  }, [resources]);

  // 筛选排序
  const processed = useMemo(() => {
    let r = resources;
    if (filterSource !== 'all') {
      r = r.filter(x => {
        const s = (x as AnimeUnifiedResource).source || (x as ResourceItem).source;
        return s === filterSource;
      });
    }
    if (filterQuality !== 'all') {
      r = r.filter(x => extractQuality(x.title) === filterQuality);
    }
    const sorted = [...r];
    switch (sortBy) {
      case 'seeders':
        sorted.sort((a, b) => ((b as AnimeUnifiedResource).seeders || 0) - ((a as AnimeUnifiedResource).seeders || 0));
        break;
      case 'date':
        sorted.sort((a, b) => {
          const da = (a as AnimeUnifiedResource).date || (a as ResourceItem).date || '';
          const db = (b as AnimeUnifiedResource).date || (b as ResourceItem).date || '';
          return db.localeCompare(da);
        });
        break;
      case 'size':
        sorted.sort((a, b) => parseFloat((b as AnimeUnifiedResource).size || (b as ResourceItem).size || '0') - parseFloat((a as AnimeUnifiedResource).size || (a as ResourceItem).size || '0'));
        break;
    }
    return sorted;
  }, [resources, sortBy, filterSource, filterQuality]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paged = processed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const changeFilter = (fn: () => void) => { fn(); setPage(1); };

  if (resources.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl border border-stone-200 dark:border-stone-700/50">
        <Magnet className="w-8 h-8 text-stone-400 mx-auto mb-2" />
        <p className="text-sm text-stone-500">暂无可用资源</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 筛选排序栏 */}
      <div className="flex flex-wrap items-center gap-2">
        {Object.keys(sourceCounts).length > 1 && (
          <div className="flex items-center gap-1">
            <FilterChip active={filterSource === 'all'} onClick={() => changeFilter(() => setFilterSource('all'))}>全部源</FilterChip>
            {Object.entries(sourceCounts).map(([src, count]) => (
              <FilterChip key={src} active={filterSource === src} onClick={() => changeFilter(() => setFilterSource(src))}>
                {src} ({count})
              </FilterChip>
            ))}
          </div>
        )}
        {Object.keys(qualityCounts).length > 0 && (
          <div className="flex items-center gap-1">
            <FilterChip active={filterQuality === 'all'} onClick={() => changeFilter(() => setFilterQuality('all'))}>全部清晰度</FilterChip>
            {Object.entries(qualityCounts).map(([q, count]) => (
              <FilterChip key={q} active={filterQuality === q} onClick={() => changeFilter(() => setFilterQuality(q))}>
                {q} ({count})
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-[10px] text-stone-400 mr-1">排序</span>
          <FilterChip active={sortBy === 'date'} onClick={() => changeFilter(() => setSortBy('date'))}>日期</FilterChip>
          <FilterChip active={sortBy === 'size'} onClick={() => changeFilter(() => setSortBy('size'))}>大小</FilterChip>
          <FilterChip active={sortBy === 'seeders'} onClick={() => changeFilter(() => setSortBy('seeders'))}>做种</FilterChip>
        </div>
      </div>

      {/* 资源列表 */}
      <div className="space-y-1.5 rounded-2xl border border-stone-200 dark:border-stone-700/50 bg-white dark:bg-stone-800/40 p-3">
        <div className="grid grid-cols-[1fr_120px] gap-2 px-2 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wide border-b border-stone-100 dark:border-stone-800">
          <span>资源名称 / 大小 / 日期</span>
          <span className="text-right">状态 · 操作</span>
        </div>
        {paged.map((item, i) => (
          <React.Fragment key={i}>{renderRow(item)}</React.Fragment>
        ))}
      </div>

      {/* 分页 */}
      {processed.length > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-700"
          >
            <ChevronLeft className="w-3.5 h-3.5" />上一页
          </button>
          <span className="text-xs text-stone-500 px-2">{page} / {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all dark:bg-stone-800/60 dark:text-stone-400 dark:hover:bg-stone-700"
          >
            下一页<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 相关推荐卡片 ──────────────────────────────────────────────────

function RelatedCard({ item, type, keyword }: { item: BangumiSubject | TMDBResult; type: 'anime' | 'movie'; keyword: string }) {
  const isAnime = type === 'anime';
  const s = item as BangumiSubject;
  const m = item as TMDBResult;
  const id = isAnime ? s.id : m.id;
  const title = isAnime ? (s.nameCN || s.name) : m.title;
  const cover = isAnime ? s.cover : (m.poster || '');
  const rating = isAnime ? s.rating : m.rating;

  return (
    <Link
      to={`/detail/${type}/${id}`}
      state={{ subject: item, keyword, type }}
      className="flex gap-2 p-2 rounded-xl border border-stone-200 dark:border-stone-700/50 hover:border-amber-500/30 hover:bg-stone-50 dark:hover:bg-stone-800/70 transition-all group"
    >
      {cover && (
        <img
          src={isAnime ? getProxyImageUrl(cover) : cover}
          alt={title}
          className="w-10 h-14 object-cover rounded-lg bg-stone-200 dark:bg-stone-700 shrink-0"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-stone-800 dark:text-stone-100 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {title}
        </p>
        {rating > 0 && (
          <p className={`text-[10px] mt-1 ${ratingColor(rating)}`}>
            <Star className="w-2.5 h-2.5 inline fill-current" /> {rating.toFixed(1)}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── 主组件 ────────────────────────────────────────────────────────

export const SubjectDetailPage: React.FC = () => {
  const { type = '', id = '' } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  const state = location.state as LocationState | null;
  const [loading, setLoading] = useState(!state?.subject);
  const [error, setError] = useState<string | null>(null);
  const [fallbackSubject, setFallbackSubject] = useState<BangumiSubject | TMDBResult | null>(null);
  const [fallbackResources, setFallbackResources] = useState<AnimeUnifiedResource[] | ResourceItem[]>([]);

  // 兜底：无 state 时通过关键词重新搜索定位
  useEffect(() => {
    if (state?.subject) return;
    if (!state?.keyword) {
      setError('缺少作品数据，请从搜索结果进入');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await searchApi.search({
          keyword: state.keyword!,
          majorCategoryId: type === 'anime' ? 'anime' : 'movie',
        });
        if (cancelled) return;
        if (!res.success) { setError('搜索失败，请返回重试'); setLoading(false); return; }

        if (type === 'anime') {
          const data = res.data as unknown as AnimeEnrichedData;
          const subject = data.bgm?.find(s => String(s.id) === id) || data.bgm?.[0] || null;
          if (!subject) { setError('未找到该作品'); setLoading(false); return; }
          setFallbackSubject(subject);
          // 从 grouped 中找到该作品的资源
          const group = data.grouped?.groups.find(g => g.subject.id === subject.id);
          setFallbackResources(group?.resources || []);
        } else {
          const data = res.data as unknown as MovieEnrichedData;
          const subject = data.results?.find(r => String(r.id) === id) || data.results?.[0] || null;
          if (!subject) { setError('未找到该作品'); setLoading(false); return; }
          setFallbackSubject(subject);
          const group = data.grouped?.groups.find(g => g.subject.id === subject.id);
          setFallbackResources(group?.resources || []);
        }
      } catch {
        if (!cancelled) setError('加载失败，请返回重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [state, type, id]);

  // ── 聚合数据 ──
  const subject = (state?.subject || fallbackSubject) as BangumiSubject | TMDBResult | null;
  const resources = (state?.resources || fallbackResources) as Array<AnimeUnifiedResource | ResourceItem>;
  const related = state?.related || [];
  const keyword = state?.keyword || '';

  // 收藏状态（基于 favorites 列表，这里简化为本地判断）
  const [isFavorited, setIsFavorited] = useState(false);
  useEffect(() => {
    // 收藏状态由父组件传入更合理，这里仅做 UI 占位
    setIsFavorited(false);
  }, [id]);

  // ── 渲染分支 ──
  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-stone-500">{error || '作品不存在'}</p>
        <button
          onClick={() => navigate('/main')}
          className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-all"
        >
          返回搜索
        </button>
      </div>
    );
  }

  // ── 按类型提取字段 ──
  const isAnime = type === 'anime';
  const s = subject as BangumiSubject;
  const m = subject as TMDBResult;
  const title = isAnime ? (s.nameCN || s.name) : m.title;
  const subtitle = isAnime ? (s.nameCN ? s.name : '') : (m.originalTitle !== m.title ? m.originalTitle : '');
  const cover = isAnime ? s.cover : (m.poster || '');
  const rating = isAnime ? s.rating : m.rating;
  const ratingCount = isAnime ? s.ratingCount : m.voteCount;
  const externalUrl = isAnime
    ? s.url
    : (m.source === 'douban'
      ? `https://movie.douban.com/subject/${Math.abs(m.id)}/`
      : `https://www.themoviedb.org/${m.mediaType}/${m.id}`);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />返回搜索结果
        </button>

        {/* Hero 区 */}
        <div className="flex flex-col sm:flex-row gap-6 mb-8">
          {/* 封面 */}
          <div className="shrink-0 mx-auto sm:mx-0">
            {cover && (
              <img
                src={isAnime ? getProxyImageUrl(cover) : cover}
                alt={title}
                className="w-32 sm:w-40 h-48 sm:h-60 object-cover rounded-2xl shadow-xl bg-stone-200 dark:bg-stone-700"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
          </div>

          {/* 标题 + 元信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {/* 类型徽章 */}
              {isAnime ? (
                <>
                  {s.type && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${typeColor(s.type)}`}>
                      {typeLabel(s.type)}
                    </span>
                  )}
                  {s.status && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  )}
                  {s.rank && s.rank > 0 && s.rank <= 1000 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
                      <Trophy className="w-3 h-3" />#{s.rank}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    m.source === 'douban' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
                  }`}>
                    {m.source === 'douban' ? '豆瓣' : 'TMDB'}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    m.mediaType === 'movie' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {m.mediaType === 'movie' ? '电影' : '剧集'}
                  </span>
                </>
              )}
              {/* 资源数量 */}
              {resources.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  {resources.length} 个资源
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 leading-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base text-stone-500 mt-1">{subtitle}</p>
            )}

            {/* 评分 + 元信息 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4">
              {rating > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className={`w-5 h-5 ${ratingColor(rating)} fill-current`} />
                  <span className={`text-xl font-bold ${ratingColor(rating)}`}>{rating.toFixed(1)}</span>
                  {ratingCount ? <span className="text-xs text-stone-400">{ratingCount} 人评分</span> : null}
                </div>
              )}
              {isAnime && s.collection?.doing && s.collection.doing > 0 && (
                <span className="flex items-center gap-1 text-xs text-stone-500" title="在看人数">
                  <Users className="w-3.5 h-3.5 text-amber-400" />{s.collection.doing} 人在看
                </span>
              )}
              {isAnime && s.eps > 0 && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Tv className="w-3.5 h-3.5" />{s.eps} 集
                </span>
              )}
              {isAnime && s.airDate && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Calendar className="w-3.5 h-3.5" />{s.airDate}
                </span>
              )}
              {!isAnime && m.year && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Calendar className="w-3.5 h-3.5" />{m.year}
                </span>
              )}
              {isAnime && s.studio && (
                <span className="flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
                  <Film className="w-3.5 h-3.5" />{s.studio}
                </span>
              )}
            </div>

            {/* 标签 */}
            {isAnime && s.tags && s.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {s.tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] rounded-full bg-stone-100 text-stone-600 dark:bg-stone-800/60 dark:text-stone-400">
                    <Tag className="w-2.5 h-2.5" />{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 mt-5">
              {isAuthenticated && (
                <button
                  onClick={() => setIsFavorited(!isFavorited)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    isFavorited
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:hover:bg-stone-700'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                  {isFavorited ? '已收藏' : '收藏'}
                </button>
              )}
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:hover:bg-stone-700 transition-all"
              >
                <ExternalLink className="w-4 h-4" />查看原站
              </a>
              {isAuthenticated && (
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800/60 dark:text-stone-300 dark:hover:bg-stone-700 transition-all"
                  title="分享到社区"
                >
                  <MessageSquare className="w-4 h-4" />分享
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 简介 */}
        {(isAnime ? s.summary : m.overview) && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">简介</h2>
            <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-line">
              {isAnime ? s.summary : m.overview}
            </p>
          </div>
        )}

        {/* 资源区 */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Magnet className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-200">可用资源</h2>
            <span className="text-xs text-stone-400">({resources.length})</span>
          </div>
          {isAnime ? (
            <ResourcePanel
              resources={resources as AnimeUnifiedResource[]}
              renderRow={(item) => <AnimeResourceRow item={item} />}
            />
          ) : (
            <ResourcePanel
              resources={resources as ResourceItem[]}
              renderRow={(item) => <MovieResourceRow item={item} />}
            />
          )}
        </div>

        {/* 相关推荐 */}
        {related.length > 0 && (
          <div className="mb-8">
            <h2 className="text-base font-semibold text-stone-800 dark:text-stone-200 mb-4">相关作品</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {related.map((item, i) => (
                <RelatedCard key={i} item={item} type={type as 'anime' | 'movie'} keyword={keyword} />
              ))}
            </div>
          </div>
        )}

        {/* 底部返回 */}
        <div className="pt-6 border-t border-stone-200 dark:border-stone-800">
          <button
            onClick={() => navigate('/main')}
            className="text-sm text-stone-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            ← 返回搜索
          </button>
        </div>
      </div>
    </div>
  );
};
