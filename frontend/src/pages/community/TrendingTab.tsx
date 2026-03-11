import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Award, Clock, Download } from 'lucide-react';
import { Card, Button, Loading, SourceIcon } from '@/components/ui';
import { communityApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import type { SharedSource, Tag } from '@/types';
import { StarRating } from './shared';

export const TrendingTab: React.FC<{ tags: Tag[]; onImport: (id: string) => Promise<void> }> = ({ onImport }) => {
  const toast = useToast();
  const [popular, setPopular] = useState<SharedSource[]>([]);
  const [recent, setRecent] = useState<SharedSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [p, r] = await Promise.all([communityApi.getPopularSources(6), communityApi.getRecentSources(6)]);
        if (p.success) setPopular(p.data);
        if (r.success) setRecent(r.data);
      } catch { toast.error('加载失败'); } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loading /></div>;

  const SourceRow: React.FC<{ source: SharedSource; rank: number }> = ({ source, rank }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-all">
      <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0', rank <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400')}>{rank}</div>
      <SourceIcon icon={source.sourceIcon} name={source.sourceName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-surface-900 dark:text-surface-100 truncate">{source.sourceName}</p>
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <StarRating rating={Math.round(source.ratingScore)} />
          <span className="flex items-center gap-1"><Download className="w-3 h-3" />{source.downloadCount}</span>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onImport(source.id)}><Download className="w-4 h-4" /></Button>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-yellow-500" />最受欢迎</h3>
          <div className="space-y-1">{popular.map((s, i) => <SourceRow key={s.id} source={s} rank={i + 1} />)}</div>
          {popular.length === 0 && <p className="text-sm text-surface-400 text-center py-4">暂无数据</p>}
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" />最新分享</h3>
          <div className="space-y-1">{recent.map((s, i) => <SourceRow key={s.id} source={s} rank={i + 1} />)}</div>
          {recent.length === 0 && <p className="text-sm text-surface-400 text-center py-4">暂无数据</p>}
        </Card>
      </div>
    </div>
  );
};
