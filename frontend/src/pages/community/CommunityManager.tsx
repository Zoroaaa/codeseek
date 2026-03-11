import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { Globe, Share2, Heart, Tag, TrendingUp } from 'lucide-react';
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
    try { const res = await communityApi.getTags(); if (res.success) setTags(res.data); } catch {}
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

  const tabs = [
    { id: 'browse', label: '浏览社区', icon: <Globe className="w-4 h-4" /> },
    { id: 'my-shares', label: '我的分享', icon: <Share2 className="w-4 h-4" /> },
    { id: 'favorites', label: '我的收藏', icon: <Heart className="w-4 h-4" /> },
    { id: 'tags', label: '标签管理', icon: <Tag className="w-4 h-4" /> },
    { id: 'trending', label: '热门推荐', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-success-500 to-teal-500 flex items-center justify-center shadow-lg">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">社区中心</h2>
            <p className="text-sm text-surface-500">发现和分享优质搜索源</p>
          </div>
        </div>
      </div>

      {!statsLoading && <StatsBanner stats={communityStats} />}

      <div className="flex gap-1 flex-wrap border-b border-surface-200 dark:border-surface-700 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === tab.id ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 border-b-2 border-success-500' : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
          )}>
            {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'browse' && <BrowseTab tags={tags} onImport={handleImport} />}
      {activeTab === 'my-shares' && <MySharesTab tags={tags} onRefreshTags={loadTags} />}
      {activeTab === 'favorites' && <FavoritesTab tags={tags} onImport={handleImport} />}
      {activeTab === 'tags' && <TagsTab tags={tags} onRefresh={loadTags} />}
      {activeTab === 'trending' && <TrendingTab tags={tags} onImport={handleImport} />}
    </div>
  );
};
