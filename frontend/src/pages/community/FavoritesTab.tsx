import React, { useState, useEffect } from 'react';
import { Heart, Download } from 'lucide-react';
import { Card, Button, Loading, EmptyState, SourceIcon } from '@/components/ui';
import { communityApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import type { SharedSource, Tag } from '@/types';
import { StarRating } from './shared';

export const FavoritesTab: React.FC<{ tags: Tag[]; onImport: (id: string) => Promise<void> }> = ({ onImport }) => {
  const toast = useToast();
  const [sources, setSources] = useState<SharedSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await communityApi.getPopularSources(20);
        if (res.success) setSources(res.data);
      } catch { toast.error('加载失败'); } finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loading /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-surface-500">
        <Heart className="w-4 h-4 text-red-400" />
        <span>你点赞过的搜索源</span>
      </div>
      {sources.length === 0 ? (
        <EmptyState icon={<Heart className="w-10 h-10" />} title="还没有收藏" description="点赞社区搜索源，它们将出现在这里" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map(source => (
            <Card key={source.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <SourceIcon icon={source.sourceIcon} name={source.sourceName} size="md" />
                <div className="min-w-0">
                  <h3 className="font-medium text-surface-900 dark:text-surface-100 truncate text-sm">{source.sourceName}</h3>
                  <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                    <StarRating rating={Math.round(source.ratingScore)} />
                    <span>({source.ratingCount})</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onImport(source.id)} title="导入"><Download className="w-4 h-4" /></Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
