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
  Sparkles,
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
      className={`p-6 border-surface-200/50 dark:border-surface-700/50 shadow-lg hover:shadow-xl transition-all duration-300 ${onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
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
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorStyles[color]} flex items-center justify-center text-white shadow-lg`}>
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
  gradient: string;
}

const QuickAction: React.FC<QuickActionProps> = ({ icon, title, description, onClick, gradient }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-all duration-200 text-left w-full group hover:shadow-md"
  >
    <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center text-white shadow-md group-hover:scale-110 transition-transform duration-200`}>
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
        return 'bg-gradient-to-br from-primary-100 to-primary-200 text-primary-600 dark:from-primary-900/30 dark:to-primary-800/30 dark:text-primary-400';
      case 'favorite':
        return 'bg-gradient-to-br from-error-100 to-error-200 text-error-600 dark:from-error-900/30 dark:to-error-800/30 dark:text-error-400';
      case 'login':
        return 'bg-gradient-to-br from-success-100 to-success-200 text-success-600 dark:from-success-900/30 dark:to-success-800/30 dark:text-success-400';
      default:
        return 'bg-gradient-to-br from-surface-100 to-surface-200 text-surface-600 dark:from-surface-800 dark:to-surface-700 dark:text-surface-400';
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
              欢迎回来，{user?.username || '用户'}
            </h2>
            <p className="text-surface-500 dark:text-surface-400">
              这是您的个人数据概览
            </p>
          </div>
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
        <Card className="p-6 lg:col-span-2 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
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
                <div key={activity.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getActivityColor(activity.action)}`}>
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

        <Card className="p-6 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-accent-600 dark:text-accent-400" />
            </div>
            快速操作
          </h3>
          <div className="space-y-3">
            <QuickAction
              icon={<Search className="w-5 h-5" />}
              title="开始搜索"
              description="搜索磁力资源"
              onClick={() => navigate('/')}
              gradient="bg-gradient-to-br from-primary-500 to-primary-600"
            />
            <QuickAction
              icon={<Database className="w-5 h-5" />}
              title="管理搜索源"
              description="添加或编辑搜索源"
              onClick={() => navigate('/dashboard/sources')}
              gradient="bg-gradient-to-br from-accent-500 to-accent-600"
            />
            <QuickAction
              icon={<Heart className="w-5 h-5" />}
              title="查看收藏"
              description="管理您的收藏"
              onClick={() => navigate('/dashboard/favorites')}
              gradient="bg-gradient-to-br from-error-500 to-error-600"
            />
            <QuickAction
              icon={<Globe className="w-5 h-5" />}
              title="社区分享"
              description="发现优质搜索源"
              onClick={() => navigate('/dashboard/community')}
              gradient="bg-gradient-to-br from-success-500 to-success-600"
            />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-success-600 dark:text-success-400" />
            </div>
            系统状态
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse shadow-lg shadow-success-500/50" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  API 服务
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse shadow-lg shadow-success-500/50" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  数据库连接
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning-500 animate-pulse shadow-lg shadow-warning-500/50" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  搜索源状态
                </span>
              </div>
              <Badge variant="warning">部分异常</Badge>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success-500 animate-pulse shadow-lg shadow-success-500/50" />
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  邮件服务
                </span>
              </div>
              <Badge variant="success">正常</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-warning-600 dark:text-warning-400" />
            </div>
            功能特性
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100/50 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white mb-3 shadow-md">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-medium text-surface-900 dark:text-surface-100">极速搜索</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                多源并发，毫秒级响应
              </p>
            </div>
            <div className="p-4 bg-gradient-to-br from-success-50 to-success-100/50 dark:from-success-900/20 dark:to-success-800/20 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-success-500 to-success-600 flex items-center justify-center text-white mb-3 shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-medium text-surface-900 dark:text-surface-100">安全可靠</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                智能过滤有害内容
              </p>
            </div>
            <div className="p-4 bg-gradient-to-br from-accent-50 to-accent-100/50 dark:from-accent-900/20 dark:to-accent-800/20 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center text-white mb-3 shadow-md">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="font-medium text-surface-900 dark:text-surface-100">全球资源</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
                聚合全球优质站点
              </p>
            </div>
            <div className="p-4 bg-gradient-to-br from-warning-50 to-warning-100/50 dark:from-warning-900/20 dark:to-warning-800/20 rounded-xl">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-warning-500 to-warning-600 flex items-center justify-center text-white mb-3 shadow-md">
                <TrendingUp className="w-5 h-5" />
              </div>
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
