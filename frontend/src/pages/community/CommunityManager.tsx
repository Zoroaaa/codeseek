import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useLocation } from 'react-router-dom';
import { communityApi } from '@/services/api';
import type { Tag as TagType, CommunityStats } from '@/types';
import { BrowseTab } from './BrowseTab';
import { MySharesTab } from './MySharesTab';
import { FavoritesTab } from './FavoritesTab';
import { TagsTab } from './TagsTab';
import { TrendingTab } from './TrendingTab';
import { StatsBanner } from './StatsBanner';

export const CommunityManager: React.FC = () => {
  const toast = useToast();
  const location = useLocation();

  const getTabFromPath = () => {
    const p = location.pathname;
    if (p.includes('/my-shares')) return 'my-shares';
    if (p.includes('/my-favorites')) return 'favorites';
    if (p.includes('/tags')) return 'tags';
    if (p.includes('/trending')) return 'trending';
    return 'browse';
  };

  const [activeTab, setActiveTab] = useState(getTabFromPath);
  const [tags, setTags] = useState<TagType[]>([]);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => { setActiveTab(getTabFromPath()); }, [location.pathname]);

  const loadTags = useCallback(async () => {
    try {
      const res = await communityApi.getTags();
      if (res.success) setTags(res.data);
    } catch (_error) {
      console.error('加载标签失败:', _error);
    }
  }, []);

  useEffect(() => {
    loadTags();
    communityApi.getCommunityStats().then(r => { if (r.success) setCommunityStats(r.data); }).catch(() => {}).finally(() => setStatsLoading(false));
  }, [loadTags]);

  const handleImport = async (sourceId: string) => {
    try {
      const res = await communityApi.downloadSharedSource(sourceId);
      if (res.success) toast.success('导入成功！搜索源已添加到你的列表');
      else toast.error('导入失败');
    } catch { toast.error('导入失败，请稍后重试'); }
  };

  return (
    <div className="space-y-6">
      {!statsLoading && <StatsBanner stats={communityStats} />}
      {activeTab === 'browse' && <BrowseTab tags={tags} onImport={handleImport} />}
      {activeTab === 'my-shares' && <MySharesTab tags={tags} onRefreshTags={loadTags} />}
      {activeTab === 'favorites' && <FavoritesTab tags={tags} onImport={handleImport} />}
      {activeTab === 'tags' && <TagsTab tags={tags} onRefresh={loadTags} />}
      {activeTab === 'trending' && <TrendingTab tags={tags} onImport={handleImport} />}
    </div>
  );
};
