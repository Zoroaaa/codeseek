import React, { useState } from 'react';
import { clsx } from 'clsx';
import {
  Compass,
  FileText,
  Heart,
  Tag,
  Bell,
  Plus,
} from 'lucide-react';
import { BrowseTab } from './BrowseTab';
import { MyPostsTab } from './MyPostsTab';
import { FavoritesTab } from './FavoritesTab';
import { TagsTab } from './TagsTab';
import { StatsBanner } from './StatsBanner';
import { ShareToCommunityModal } from './ShareToCommunityModal';
import { NotificationsTab } from './NotificationsTab';

type TabKey = 'browse' | 'my-posts' | 'favorites' | 'tags' | 'notifications';

interface TabConfig {
  key: TabKey;
  label: string;
  icon: React.ElementType;
}

const TABS: TabConfig[] = [
  { key: 'browse', label: '浏览', icon: Compass },
  { key: 'my-posts', label: '我的帖子', icon: FileText },
  { key: 'favorites', label: '我的收藏', icon: Heart },
  { key: 'tags', label: '标签', icon: Tag },
  { key: 'notifications', label: '通知', icon: Bell },
];

export const CommunityManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('browse');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareInitialData, setShareInitialData] = useState<{
    postType: 'jav' | 'anime' | 'movie';
    title: string;
    coverImage: string;
    contentData: any;
  } | null>(null);

  // 分享成功回调
  const handleShareSuccess = (post: any) => {
    console.log('分享成功:', post);
    // 可以切换到"我的帖子"tab
    setActiveTab('my-posts');
  };

  return (
    <div className="space-y-6">
      {/* 统计横幅 - 仅在浏览页显示 */}
      {activeTab === 'browse' && <StatsBanner />}

      {/* Tab 导航栏 */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Icon className={clsx('w-4 h-4', isActive && 'text-primary-500')} />
              {tab.label}
              {/* 通知角标 */}
              {tab.key === 'notifications' && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </button>
          );
        })}

        {/* 分享按钮 - 固定在右侧 */}
        <div className="ml-auto pl-2 border-l border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              // 默认打开分享弹窗，实际使用时应该传入搜索结果数据
              setShareInitialData({
                postType: 'jav',
                title: '',
                coverImage: '',
                contentData: {},
              });
              setShareModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-md hover:shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">分享资源</span>
          </button>
        </div>
      </div>

      {/* Tab 内容区 */}
      <div className="min-h-[400px]">
        {activeTab === 'browse' && <BrowseTab />}
        {activeTab === 'my-posts' && <MyPostsTab />}
        {activeTab === 'favorites' && <FavoritesTab />}
        {activeTab === 'tags' && <TagsTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
      </div>

      {/* 分享到社区弹窗 */}
      {shareInitialData && (
        <ShareToCommunityModal
          open={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          initialData={shareInitialData}
          onSuccess={handleShareSuccess}
        />
      )}
    </div>
  );
};

// 暴露打开分享弹窗的方法供外部使用
export type CommunityManagerHandle = {
  openShareModal: (data: {
    postType: 'jav' | 'anime' | 'movie';
    title: string;
    coverImage: string;
    contentData: any;
  }) => void;
};
