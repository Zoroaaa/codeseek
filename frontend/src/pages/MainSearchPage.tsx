import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Clock,
  Heart,
  ExternalLink,
  Copy,
  Trash2,
  Download,
  Globe,
  Database,
  ChevronDown,
  ChevronRight,
  Grid,
  List,
  X,
  Moon,
  Sun,
  LogOut,
  LayoutDashboard,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useSearchStore, useSourceStore, useAuthStore, useThemeStore, useProxyStore } from '@/stores';
import { searchApi, sourceApi, userApi } from '@/services/api';
import { Button, Input, Card, Badge, Loading, EmptyState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import type { SearchResult, FavoriteItem, SearchHistoryItem } from '@/types';

interface SearchResultItem extends SearchResult {
  title?: string;
  size?: string;
  date?: string;
  seeders?: number;
  leechers?: number;
  magnetLink?: string;
}

export const MainSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { keyword, setKeyword, setResults, isSearching, setSearching } = useSearchStore();
  const { majorCategories, setMajorCategories, sources, setSources, categories, setCategories } = useSourceStore();
  const { isEnabled: isProxyEnabled, status: proxyStatus, isLoading: isProxyLoading, toggleProxy, initializeProxy } = useProxyStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSites, setShowSites] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, sourcesData, allCategoriesData] = await Promise.all([
          sourceApi.getMajorCategories(),
          sourceApi.getActiveSources(),
          sourceApi.getCategories(),
        ]);
        if (categoriesData.success && categoriesData.data) {
          setMajorCategories(categoriesData.data);
          setExpandedCategories(new Set(categoriesData.data.map(c => c.id)));
        }
        if (sourcesData.success && sourcesData.data) {
          setSources(sourcesData.data);
        }
        if (allCategoriesData.success && allCategoriesData.data) {
          setCategories(allCategoriesData.data);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
    initializeProxy();
  }, [setMajorCategories, setSources, setCategories, initializeProxy]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
      loadFavorites();
    }
  }, [isAuthenticated]);

  const loadHistory = async () => {
    if (!isAuthenticated) return;
    setIsLoadingHistory(true);
    try {
      const response = await userApi.getSearchHistory(20);
      if (response.success && response.data) {
        setSearchHistory(response.data.history);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadFavorites = async () => {
    if (!isAuthenticated) return;
    setIsLoadingFavorites(true);
    try {
      const response = await userApi.getFavorites();
      if (response.success && response.data) {
        setFavorites(response.data.favorites);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setIsLoadingFavorites(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) {
      toast.warning('请输入搜索关键词');
      return;
    }

    setSearching(true);
    try {
      const response = await searchApi.search({
        keyword: keyword.trim(),
        majorCategoryId: selectedCategory || undefined,
      });
      if (response.success && response.data) {
        setResults(response.data.results);
        setSearchResults(response.data.results as SearchResultItem[]);
        if (response.data.results.length === 0) {
          toast.info('未找到结果', '尝试更换关键词搜索');
        } else {
          loadHistory();
        }
      }
    } catch (error) {
      toast.error('搜索失败', '请稍后重试');
    } finally {
      setSearching(false);
    }
  }, [keyword, selectedCategory, setResults, setSearching, toast, loadHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleCopyMagnet = (magnetLink: string) => {
    if (magnetLink) {
      navigator.clipboard.writeText(magnetLink);
      toast.success('已复制磁力链接');
    }
  };

  const handleAddFavorite = async (result: SearchResultItem) => {
    if (!isAuthenticated) {
      toast.warning('请先登录');
      navigate('/login');
      return;
    }
    
    try {
      await userApi.addFavorite({
        title: result.title || result.sourceName,
        url: result.url || '',
        subtitle: result.size,
      });
      toast.success('已添加到收藏');
      loadFavorites();
    } catch (error) {
      toast.error('收藏失败', '请稍后重试');
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      await userApi.removeFavorite(id);
      setFavorites(prev => prev.filter(f => f.id !== id));
      toast.success('已移除收藏');
    } catch (error) {
      toast.error('移除失败', '请稍后重试');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定要清空所有搜索历史吗？')) return;
    try {
      await userApi.clearSearchHistory();
      setSearchHistory([]);
      toast.success('历史已清空');
    } catch (error) {
      toast.error('清空失败', '请稍后重试');
    }
  };

  const handleExportFavorites = () => {
    const data = JSON.stringify(favorites, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `favorites-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const getSourcesByMajorCategory = (majorCategoryId: string) => {
    const categoryIds = categories
      .filter(c => c.majorCategoryId === majorCategoryId)
      .map(c => c.id);
    return sources.filter(s => categoryIds.includes(s.categoryId));
  };

  const formatDate = (timestamp: number | string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200/50 dark:border-surface-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/main" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/25 group-hover:shadow-primary-500/40 transition-shadow">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent hidden sm:block">
                磁力快搜
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 bg-surface-100/50 dark:bg-surface-800/50 rounded-full px-2 py-1">
              <Link 
                to="/main" 
                className="px-4 py-2 text-sm font-medium rounded-lg text-primary-600 dark:text-primary-400 bg-white dark:bg-surface-800 shadow-sm"
              >
                主页
              </Link>
              <Link 
                to="/dashboard" 
                className="px-4 py-2 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100 hover:bg-white dark:hover:bg-surface-700"
              >
                控制台
              </Link>
            </nav>

            <div className="flex items-center gap-2 sm:gap-1">
              <button
                onClick={toggleProxy}
                disabled={isProxyLoading}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isProxyEnabled 
                    ? 'text-success-600 hover:text-success-700 hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-900/20' 
                    : proxyStatus === 'error'
                    ? 'text-error-500 hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-900/20'
                    : 'text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
                }`}
                title={isProxyEnabled ? '代理已启用 - 点击关闭' : '代理已关闭 - 点击启用'}
              >
                {isProxyLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isProxyEnabled ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : proxyStatus === 'error' ? (
                  <ShieldAlert className="w-5 h-5" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">退出</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
                欢迎回来，{user?.username}
              </h1>
              <p className="text-surface-600 dark:text-surface-400">
                开始搜索您需要的资源
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-surface-900 rounded-2xl shadow-xl border border-surface-200/50 dark:border-surface-700/50 p-6 mb-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="输入关键词搜索..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<Search className="w-5 h-5" />}
                className="text-lg"
                fullWidth
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSearch}
              isLoading={isSearching}
              leftIcon={<Search className="w-5 h-5" />}
              className="w-full sm:w-auto"
            >
              搜索
            </Button>
          </div>

          {majorCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-surface-200/50 dark:border-surface-700/50">
              <span className="text-sm text-surface-500 dark:text-surface-400 font-medium">分类:</span>
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-1.5 text-sm rounded-full transition-all duration-200 ${
                  selectedCategory === null
                    ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
              >
                全部
              </button>
              {majorCategories.slice(0, 8).map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-1.5 text-sm rounded-full transition-all duration-200 ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-primary-500 to-accent-500 text-white shadow-md'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <Card className="p-6 mb-8 border-surface-200/50 dark:border-surface-700/50 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Search className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                搜索结果
                <Badge variant="primary" className="ml-2">{searchResults.length}</Badge>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <Button variant="ghost" size="sm" onClick={() => setSearchResults([])}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
              {searchResults.map((result, index) => (
                <Card key={index} hover className="p-4 border-surface-200/50 dark:border-surface-700/50 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-surface-900 dark:text-surface-100 truncate">
                        {result.title || result.sourceName}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-surface-500 dark:text-surface-400">
                        {result.size && <span className="px-2 py-0.5 bg-surface-100 dark:bg-surface-800 rounded">{result.size}</span>}
                        {result.date && <span>• {result.date}</span>}
                        {result.seeders !== undefined && (
                          <span className="text-success-600 dark:text-success-400 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {result.seeders}
                          </span>
                        )}
                        {result.leechers !== undefined && (
                          <span className="text-warning-600 dark:text-warning-400">↓{result.leechers}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">{result.sourceName}</Badge>
                      {result.magnetLink && (
                        <Button variant="ghost" size="sm" onClick={() => handleCopyMagnet(result.magnetLink!)} title="复制磁力链接">
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleAddFavorite(result)} title="收藏">
                        <Heart className="w-4 h-4" />
                      </Button>
                      {result.url && (
                        <Button variant="ghost" size="sm" onClick={() => window.open(result.url, '_blank')} title="打开">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-surface-200/50 dark:border-surface-700/50 shadow-lg">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">搜索历史</h2>
                  {searchHistory.length > 0 && (
                    <Badge variant="primary">{searchHistory.length}</Badge>
                  )}
                </div>
                {showHistory ? <ChevronDown className="w-5 h-5 text-surface-400" /> : <ChevronRight className="w-5 h-5 text-surface-400" />}
              </button>
              
              {showHistory && (
                <div className="border-t border-surface-200/50 dark:border-surface-700/50">
                  {isLoadingHistory ? (
                    <div className="p-8 flex justify-center">
                      <Loading />
                    </div>
                  ) : searchHistory.length > 0 ? (
                    <>
                      <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-64 overflow-y-auto">
                        {searchHistory.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer transition-colors"
                            onClick={() => {
                              setKeyword(item.query);
                              handleSearch();
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Search className="w-4 h-4 text-surface-400" />
                              <span className="text-surface-900 dark:text-surface-100">{item.query}</span>
                            </div>
                            <span className="text-xs text-surface-500">{formatDate(new Date(item.createdAt).toISOString())}</span>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 border-t border-surface-100 dark:border-surface-800">
                        <Button variant="ghost" size="sm" onClick={handleClearHistory} className="text-error-500">
                          <Trash2 className="w-4 h-4 mr-1" />
                          清空历史
                        </Button>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={<Clock className="w-8 h-8" />}
                      title="暂无搜索历史"
                      description="开始搜索后，历史记录将显示在这里"
                    />
                  )}
                </div>
              )}
            </Card>

            <Card className="overflow-hidden border-surface-200/50 dark:border-surface-700/50 shadow-lg">
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-error-600 dark:text-error-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">我的收藏</h2>
                  {favorites.length > 0 && (
                    <Badge variant="error">{favorites.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showFavorites && favorites.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleExportFavorites(); }}>
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {showFavorites ? <ChevronDown className="w-5 h-5 text-surface-400" /> : <ChevronRight className="w-5 h-5 text-surface-400" />}
                </div>
              </button>
              
              {showFavorites && (
                <div className="border-t border-surface-200/50 dark:border-surface-700/50">
                  {isLoadingFavorites ? (
                    <div className="p-8 flex justify-center">
                      <Loading />
                    </div>
                  ) : favorites.length > 0 ? (
                    <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-64 overflow-y-auto">
                      {favorites.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-surface-900 dark:text-surface-100 truncate">{item.title}</p>
                            {item.subtitle && (
                              <p className="text-sm text-surface-500 truncate">{item.subtitle}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => window.open(item.url, '_blank')}>
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveFavorite(item.id)} className="text-error-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={<Heart className="w-8 h-8" />}
                      title="暂无收藏"
                      description="搜索时点击收藏按钮即可添加收藏"
                    />
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="overflow-hidden border-surface-200/50 dark:border-surface-700/50 shadow-lg">
              <button
                onClick={() => setShowSites(!showSites)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-accent-600 dark:text-accent-400" />
                  </div>
                  <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">站点导航</h2>
                  <Badge variant="accent">{sources.length}</Badge>
                </div>
                {showSites ? <ChevronDown className="w-5 h-5 text-surface-400" /> : <ChevronRight className="w-5 h-5 text-surface-400" />}
              </button>
              
              {showSites && (
                <div className="border-t border-surface-200/50 dark:border-surface-700/50 max-h-[500px] overflow-y-auto">
                  {majorCategories.map((category) => {
                    const categorySources = getSourcesByMajorCategory(category.id);
                    if (categorySources.length === 0) return null;
                    
                    return (
                      <div key={category.id} className="border-b border-surface-100 dark:border-surface-800 last:border-b-0">
                        <button
                          onClick={() => toggleCategory(category.id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{category.icon || '📁'}</span>
                            <span className="font-medium text-surface-900 dark:text-surface-100">{category.name}</span>
                            <Badge variant="outline" size="sm">{categorySources.length}</Badge>
                          </div>
                          {expandedCategories.has(category.id) ? (
                            <ChevronDown className="w-4 h-4 text-surface-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-surface-400" />
                          )}
                        </button>
                        
                        {expandedCategories.has(category.id) && (
                          <div className="px-3 pb-3 space-y-2">
                            {categorySources.map((source) => (
                              <div
                                key={source.id}
                                className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800/50 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  {source.icon && (source.icon.startsWith('http') || source.icon.startsWith('/') || source.icon.startsWith('data:')) ? (
                                    <img src={source.icon} alt={source.name} className="w-5 h-5 rounded" />
                                  ) : (
                                    <span className="text-base">{source.icon || '🔗'}</span>
                                  )}
                                  <span className="text-sm text-surface-700 dark:text-surface-300">{source.name}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(source.urlTemplate.replace('{keyword}', ''), '_blank')}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="p-4 border-surface-200/50 dark:border-surface-700/50 shadow-lg">
              <h3 className="font-semibold text-surface-900 dark:text-surface-100 mb-4 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                快捷操作
              </h3>
              <div className="space-y-2">
                <Button variant="outline" fullWidth onClick={() => navigate('/dashboard/sources')} className="justify-start">
                  <Database className="w-4 h-4 mr-2" />
                  管理搜索源
                </Button>
                <Button variant="outline" fullWidth onClick={() => navigate('/dashboard/settings')} className="justify-start">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  系统设置
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
