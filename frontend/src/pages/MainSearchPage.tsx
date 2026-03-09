import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Clock,
  Heart,
  ExternalLink,
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
  Zap,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { useSearchStore, useSourceStore, useAuthStore, useThemeStore, useProxyStore } from '@/stores';
import { searchApi, sourceApi, userApi } from '@/services/api';
import { Button, Input, Loading } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import type { SearchResult, FavoriteItem, SearchHistoryItem } from '@/types';

interface SearchResultItem extends SearchResult {
  subtitle?: string;
  siteType?: string;
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
      }) as unknown as { success: boolean; data: { keyword: string; results: Array<{ id: string; name: string; subtitle?: string; icon?: string; url: string; siteType: string; category: string }> } };
      if (response.success && response.data) {
        const mappedResults: SearchResultItem[] = response.data.results.map(r => ({
          sourceId: r.id,
          sourceName: r.name,
          sourceIcon: r.icon,
          url: r.url,
          subtitle: r.subtitle,
          siteType: r.siteType,
        }));
        setResults(mappedResults as unknown as SearchResult[]);
        setSearchResults(mappedResults);
        if (mappedResults.length === 0) {
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

  const handleAddFavorite = async (result: SearchResultItem) => {
    if (!isAuthenticated) {
      toast.warning('请先登录');
      navigate('/login');
      return;
    }
    try {
      await userApi.addFavorite({
        title: result.sourceName,
        url: result.url || '',
        subtitle: result.subtitle,
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

  const getSiteTypeBadge = (siteType?: string) => {
    const map: Record<string, string> = {
      search: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      browse: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      reference: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
    return map[siteType || 'search'] || map.search;
  };

  const getSiteTypeLabel = (siteType?: string) => {
    const map: Record<string, string> = { search: '搜索', browse: '浏览', reference: '参考' };
    return map[siteType || 'search'] || '搜索';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/20 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/20">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-surface-900/85 backdrop-blur-2xl border-b border-surface-200/40 dark:border-surface-700/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link to="/main" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-md shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-all">
                <Search className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent hidden sm:block tracking-tight">
                磁力快搜
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link to="/main" className="px-3.5 py-1.5 text-sm font-semibold rounded-lg text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20">
                搜索
              </Link>
              <Link to="/dashboard" className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                控制台
              </Link>
            </nav>

            <div className="flex items-center gap-1">
              <button
                onClick={toggleProxy}
                disabled={isProxyLoading}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isProxyEnabled
                    ? 'text-success-600 hover:bg-success-50 dark:text-success-400 dark:hover:bg-success-900/20'
                    : proxyStatus === 'error'
                    ? 'text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20'
                    : 'text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:text-surface-200 dark:hover:bg-surface-800'
                }`}
                title={isProxyEnabled ? '代理已启用 - 点击关闭' : '代理已关闭 - 点击启用'}
              >
                {isProxyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isProxyEnabled ? <ShieldCheck className="w-4 h-4" /> : proxyStatus === 'error' ? <ShieldAlert className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>

              <button onClick={toggleTheme} className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors">
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <div className="hidden sm:flex items-center gap-2 ml-1 pl-2 border-l border-surface-200 dark:border-surface-700">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300 max-w-[80px] truncate">{user?.username}</span>
              </div>

              <button onClick={handleLogout} className="p-2 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors ml-1" title="退出登录">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* 欢迎语 */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            👋 嗨，<span className="text-primary-600 dark:text-primary-400">{user?.username}</span>
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">搜索全网资源，一步直达</p>
        </div>

        {/* 搜索区域 */}
        <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-lg shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 p-5 mb-6 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="输入番号、关键词搜索资源..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                leftIcon={<Search className="w-5 h-5 text-surface-400" />}
                className="text-base"
                fullWidth
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleSearch}
              isLoading={isSearching}
              className="w-full sm:w-auto shrink-0"
            >
              <Search className="w-4 h-4 mr-1.5" strokeWidth={2.5} />
              搜索
            </Button>
          </div>

          {majorCategories.length > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-100 dark:border-surface-800 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-xs text-surface-400 font-medium">筛选</span>
              </div>
              <div className="flex items-center gap-1.5 flex-nowrap">
                <button onClick={() => setSelectedCategory(null)} className={`nav-pill shrink-0 ${selectedCategory === null ? 'active' : ''}`}>
                  全部
                </button>
                {majorCategories.map((category) => (
                  <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`nav-pill shrink-0 ${selectedCategory === category.id ? 'active' : ''}`}>
                    {category.icon && <span className="mr-1">{category.icon}</span>}
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-lg shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 p-5 mb-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100">搜索结果</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  {searchResults.length}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                  <Grid className="w-4 h-4" />
                </button>
                <button onClick={() => setSearchResults([])} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors ml-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-3' : 'space-y-2'}>
              {searchResults.map((result, index) => (
                <div key={index} className="result-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-700 dark:to-surface-800 flex items-center justify-center text-lg border border-surface-200/60 dark:border-surface-700/60">
                        {result.sourceIcon && (result.sourceIcon.startsWith('http') || result.sourceIcon.startsWith('/') || result.sourceIcon.startsWith('data:')) ? (
                          <img src={result.sourceIcon} alt={result.sourceName} className="w-6 h-6 rounded" />
                        ) : (
                          <span>{result.sourceIcon || '🔍'}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">{result.sourceName}</h3>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${getSiteTypeBadge(result.siteType)}`}>
                            {getSiteTypeLabel(result.siteType)}
                          </span>
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">{result.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => handleAddFavorite(result)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors" title="收藏">
                        <Heart className="w-4 h-4" />
                      </button>
                      {result.url && (
                        <button
                          onClick={() => window.open(result.url, '_blank')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 transition-all shadow-sm shadow-primary-500/25"
                        >
                          <span className="hidden sm:inline">前往</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 历史/收藏 + 站点导航 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            {/* 搜索历史 */}
            <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 overflow-hidden backdrop-blur-sm">
              <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-semibold text-surface-900 dark:text-surface-100">搜索历史</span>
                  {searchHistory.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{searchHistory.length}</span>
                  )}
                </div>
                {showHistory ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
              </button>
              {showHistory && (
                <div className="border-t border-surface-100 dark:border-surface-800">
                  {isLoadingHistory ? (
                    <div className="p-8 flex justify-center"><Loading /></div>
                  ) : searchHistory.length > 0 ? (
                    <>
                      <div className="divide-y divide-surface-50 dark:divide-surface-800/60 max-h-60 overflow-y-auto scrollbar-thin">
                        {searchHistory.map((item) => (
                          <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer transition-colors" onClick={() => setKeyword(item.query)}>
                            <div className="flex items-center gap-3">
                              <Search className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                              <span className="text-sm text-surface-800 dark:text-surface-200">{item.query}</span>
                            </div>
                            <span className="text-xs text-surface-400 shrink-0 ml-3">{formatDate(new Date(item.createdAt).toISOString())}</span>
                          </div>
                        ))}
                      </div>
                      <div className="px-5 py-3 border-t border-surface-50 dark:border-surface-800/60">
                        <button onClick={handleClearHistory} className="flex items-center gap-1.5 text-sm text-error-500 hover:text-error-700 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />清空历史
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <Clock className="w-8 h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-400">暂无搜索历史</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 我的收藏 */}
            <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 overflow-hidden backdrop-blur-sm">
              <button onClick={() => setShowFavorites(!showFavorites)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                    <Heart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                  <span className="font-semibold text-surface-900 dark:text-surface-100">我的收藏</span>
                  {favorites.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full">{favorites.length}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {showFavorites && favorites.length > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); handleExportFavorites(); }} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors" title="导出收藏">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {showFavorites ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                </div>
              </button>
              {showFavorites && (
                <div className="border-t border-surface-100 dark:border-surface-800">
                  {isLoadingFavorites ? (
                    <div className="p-8 flex justify-center"><Loading /></div>
                  ) : favorites.length > 0 ? (
                    <div className="divide-y divide-surface-50 dark:divide-surface-800/60 max-h-64 overflow-y-auto scrollbar-thin">
                      {favorites.map((item) => (
                        <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{item.title}</p>
                            {item.subtitle && <p className="text-xs text-surface-400 truncate mt-0.5">{item.subtitle}</p>}
                          </div>
                          <div className="flex items-center gap-1 ml-3 shrink-0">
                            <button onClick={() => window.open(item.url, '_blank')} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleRemoveFavorite(item.id)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <Heart className="w-8 h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
                      <p className="text-sm text-surface-400">暂无收藏，搜索后点击收藏按钮</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右侧 */}
          <div className="lg:col-span-1 space-y-4">
            {/* 站点导航 */}
            <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 overflow-hidden backdrop-blur-sm">
              <button onClick={() => setShowSites(!showSites)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <span className="font-semibold text-surface-900 dark:text-surface-100">站点导航</span>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">{sources.length}</span>
                </div>
                {showSites ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
              </button>
              {showSites && (
                <div className="border-t border-surface-100 dark:border-surface-800 max-h-[420px] overflow-y-auto scrollbar-thin">
                  {majorCategories.map((category) => {
                    const categorySources = getSourcesByMajorCategory(category.id);
                    if (categorySources.length === 0) return null;
                    return (
                      <div key={category.id} className="border-b border-surface-50 dark:border-surface-800/60 last:border-b-0">
                        <button onClick={() => toggleCategory(category.id)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{category.icon || '📁'}</span>
                            <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{category.name}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded-md">{categorySources.length}</span>
                          </div>
                          {expandedCategories.has(category.id) ? <ChevronDown className="w-3.5 h-3.5 text-surface-400" /> : <ChevronRight className="w-3.5 h-3.5 text-surface-400" />}
                        </button>
                        {expandedCategories.has(category.id) && (
                          <div className="px-4 pb-3 space-y-1.5">
                            {categorySources.map((source) => (
                              <div key={source.id} className="flex items-center justify-between p-2.5 bg-surface-50/60 dark:bg-surface-800/40 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-white dark:bg-surface-700 border border-surface-200/60 dark:border-surface-600/60 flex items-center justify-center shrink-0">
                                    {source.icon && (source.icon.startsWith('http') || source.icon.startsWith('/') || source.icon.startsWith('data:')) ? (
                                      <img src={source.icon} alt={source.name} className="w-4 h-4 rounded" />
                                    ) : (
                                      <span className="text-sm">{source.icon || '🔗'}</span>
                                    )}
                                  </div>
                                  <span className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate">{source.name}</span>
                                </div>
                                <button onClick={() => window.open(source.urlTemplate.replace('{keyword}', ''), '_blank')} className="p-1 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-white dark:hover:bg-surface-700 transition-colors shrink-0 ml-1">
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 快捷操作 */}
            <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100">快捷操作</span>
              </div>
              <div className="space-y-2">
                <button onClick={() => navigate('/dashboard/sources')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left">
                  <Database className="w-4 h-4 text-surface-400" />管理搜索源
                </button>
                <button onClick={() => navigate('/dashboard/settings')} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left">
                  <LayoutDashboard className="w-4 h-4 text-surface-400" />系统设置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
