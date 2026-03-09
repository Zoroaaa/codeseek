import React, { useEffect, useState, useCallback } from 'react';
import {
  Database,
  Users,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  TrendingUp,
  Activity,
  Zap,
  Globe,
  Shield,
  RefreshCw,
} from 'lucide-react';
import { Card, Badge, Loading, Button } from '@/components/ui';
import { systemApi, userApi, sourceApi } from '@/services/api';
import { useAuthStore } from '@/stores';
import { useNavigate } from 'react-router-dom';
import type { SystemStats, FavoriteItem, SearchHistoryItem, SearchSource, UserSourceConfig } from '@/types';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'accent' | 'error';
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color, onClick }) => {
  const colorStyles = {
    primary: 'from-primary-500 to-primary-600',
    success: 'from-success-500 to-success-600',
    warning: 'from-warning-500 to-warning-600',
    accent: 'from-accent-500 to-accent-600',
    error: 'from-error-500 to-error-600',
  };

  return (
    <Card 
      className={`p-6 ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-surface-900 dark:text-surface-100">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-success-600' : 'text-error-600'}`}>
              {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{Math.abs(change)}%</span>
              <span className="text-surface-400">vs 上周</span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorStyles[color]} flex items-center justify-center text-white`}>
          {icon}
        </div>
      </div>
    </Card>
  );
};

interface QuickActionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  color: string;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, title, description, onClick, color }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors text-left w-full"
  >
    <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center text-white`}>
      {icon}
    </div>
    <div>
      <p className="font-medium text-surface-900 dark:text-surface-100">{title}</p>
      <p className="text-sm text-surface-500 dark:text-surface-400">{description}</p>
    </div>
  </button>
);

export const OverviewManager: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [sources, setSources] = useState<Array<SearchSource & { userConfig?: UserSourceConfig | null }>>([]);
  const [userSearchStats, setUserSearchStats] = useState<{
    totalSearches: number;
    topSources: Array<{ source: string; count: number }>;
    recentSearches: Array<{ query: string; createdAt: number }>;
  } | null>(null);
  const [recentActivities, setRecentActivities] = useState<Array<{
    id: string;
    action: string;
    target: string;
    createdAt: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAllData = useCallback(async () => {
    try {
      const [
        statsResponse,
        favoritesResponse,
        historyResponse,
        sourcesResponse,
        searchStatsResponse,
        activitiesResponse
      ] = await Promise.all([
        systemApi.getStats(),
        userApi.getFavorites(),
        userApi.getSearchHistory(50),
        sourceApi.getSourcesWithUserConfig(),
        userApi.getSearchStats(),
        systemApi.getUserActions({ limit: 10 })
      ]);
      
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
      
      if (favoritesResponse.success && favoritesResponse.data) {
        setFavorites(favoritesResponse.data.favorites || []);
      }
      
      if (historyResponse.success && historyResponse.data) {
        setSearchHistory(historyResponse.data.history || []);
      }
      
      if (sourcesResponse.success && sourcesResponse.data) {
        setSources(sourcesResponse.data);
      }
      
      if (searchStatsResponse.success && searchStatsResponse.data) {
        setUserSearchStats(searchStatsResponse.data);
      }
      
      if (activitiesResponse.success && activitiesResponse.data) {
        setRecentActivities(activitiesResponse.data.logs.map(log => ({
          id: log.id,
          action: log.action,
          target: log.target,
          createdAt: log.createdAt,
        })));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadAllData();
      setIsLoading(false);
    };
    init();
  }, [loadAllData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    setIsRefreshing(false);
  };

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'search':
        return <Search className="w-4 h-4" />;
      case 'favorite':
        return <Heart className="w-4 h-4" />;
      case 'login':
        return <Users className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getActivityColor = (action: string) => {
    switch (action) {
      case 'search':
        return 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400';
      case 'favorite':
        return 'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400';
      case 'login':
        return 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400';
      default:
        return 'bg-surface-100 text-surface-600 dark:bg-surface-800 dark:text-surface-400';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="lg" text="加载中..." />
      </div>
    );
  }

  const userStats = {
    searchCount: userSearchStats?.totalSearches || searchHistory.length,
    favoriteCount: favorites.length,
    sourceCount: sources.filter(s => s.userConfig?.isEnabled !== false).length,
    totalSourceCount: sources.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            欢迎回来，{user?.username || '用户'}
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            这是您的个人数据概览
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          isLoading={isRefreshing}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          刷新
        </Button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="我的搜索次数"
          value={userStats.searchCount}
          change={8}
          icon={<Search className="w-6 h-6" />}
          color="primary"
          onClick={() => navigate('/dashboard/history')}
        />
        <StatCard
          title="我的收藏"
          value={userStats.favoriteCount}
          icon={<Heart className="w-6 h-6" />}
          color="error"
          onClick={() => navigate('/dashboard/favorites')}
        />
        <StatCard
          title="可用搜索源"
          value={stats?.activeSources ?? sources.length}
          icon={<Database className="w-6 h-6" />}
          color="accent"
          onClick={() => navigate('/dashboard/sources')}
        />
        <StatCard
          title="活跃用户"
          value={stats?.activeUsers ?? 0}
          change={23}
          icon={<Users className="w-6 h-6" />}
          color="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              最近活动
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/history')}
            >
              查看全部
            </Button>
          </div>
          
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getActivityColor(activity.action)}`}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {activity.action === 'search' && `搜索了 "${activity.target}"`}
                      {activity.action === 'favorite' && `收藏了 ${activity.target}`}
                      {activity.action === 'login' && '登录了账户'}
                      {!['search', 'favorite', 'login'].includes(activity.action) && activity.action}
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                  <Badge variant={
                    activity.action === 'search' ? 'primary' :
                    activity.action === 'favorite' ? 'error' :
                    'default'
                  }>
                    {activity.action === 'search' && '搜索'}
                    {activity.action === 'favorite' && '收藏'}
                    {activity.action === 'login' && '登录'}
                    {!['search', 'favorite', 'login'].includes(activity.action) && activity.action}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-surface-500 dark:text-surface-400">暂无活动记录</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            快速操作
          </h3>
          <div className="space-y-3">
            <QuickAction
              icon={<Search className="w-5 h-5" />}
              title="开始搜索"
              description="搜索磁力资源"
              onClick={() => navigate('/')}
              color="bg-primary-500"
            />
            <QuickAction
              icon={<Database className="w-5 h-5" />}
              title="管理搜索源"
              description="添加或编辑搜索源"
              onClick={() => navigate('/dashboard/sources')}
              color="bg-accent-500"
            />
            <QuickAction
              icon={<Heart className="w-5 h-5" />}
              title="查看收藏"
              description="管理您的收藏"
              onClick={() => navigate('/dashboard/favorites')}
              color="bg-error-500"
            />
            <QuickAction
              icon={<Globe className="w-5 h-5" />}
              title="社区分享"
              description="发现优质搜索源"
              onClick={() => navigate('/dashboard/community')}
              color="bg-success-500"
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            系统状态
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  API 服务
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  数据库连接
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning-500 animate-pulse" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  搜索源状态
                </span>
              </div>
              <Badge variant="warning">部分异常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  邮件服务
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            功能特性
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <Zap className="w-8 h-8 text-primary-500 mb-2" />
              <h4 className="font-medium text-surface-900 dark:text-surface-100">极速搜索</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                多源并发，毫秒级响应
              </p>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <Shield className="w-8 h-8 text-success-500 mb-2" />
              <h4 className="font-medium text-surface-900 dark:text-surface-100">安全可靠</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                智能过滤有害内容
              </p>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <Globe className="w-8 h-8 text-accent-500 mb-2" />
              <h4 className="font-medium text-surface-900 dark:text-surface-100">全球资源</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                聚合全球优质站点
              </p>
            </div>
            <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <TrendingUp className="w-8 h-8 text-warning-500 mb-2" />
              <h4 className="font-medium text-surface-900 dark:text-surface-100">数据分析</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                搜索趋势可视化
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
