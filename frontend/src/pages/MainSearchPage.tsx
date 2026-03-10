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
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Zap,
  TrendingUp,
  Filter,
  Settings,
  CheckCircle,
  XCircle,
  FolderOpen,
} from 'lucide-react';
import { useSearchStore, useSourceStore, useAuthStore, useThemeStore, useProxyStore } from '@/stores';
import { searchApi, sourceApi, userApi } from '@/services/api';
import { Button, Input, Loading, SourceIcon } from '@/components/ui';
import { convertToProxyUrl } from '@/services/proxy/ProxyService';
import { useToast } from '@/components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import type { SearchResult, FavoriteItem, SearchHistoryItem, MajorCategory, Category, SearchSource } from '@/types';

interface SearchResultItem extends SearchResult {
  subtitle?: string;
  siteType?: string;
}

interface CategoryWithSources extends Category {
  sources: SearchSource[];
}

interface MajorCategoryWithCategories extends MajorCategory {
  categories: CategoryWithSources[];
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
  const [showHistory, setShowHistory] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [showAllSources, setShowAllSources] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [expandedMajorCategories, setExpandedMajorCategories] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sourceConfigs, setSourceConfigs] = useState<Map<string, boolean>>(new Map());
  const [allSources, setAllSources] = useState<Array<SearchSource & { userConfig?: { isEnabled: boolean } | null }>>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [majorCategoriesData, sourcesData, allCategoriesData, userConfigsData, allSourcesData] = await Promise.all([
          sourceApi.getMajorCategories(),
          sourceApi.getActiveSources(),
          sourceApi.getCategories(),
          isAuthenticated ? sourceApi.getUserSourceConfigs() : Promise.resolve({ success: false, data: [] }),
          sourceApi.getSourcesWithUserConfig(),
        ]);
        if (majorCategoriesData.success && majorCategoriesData.data) {
          setMajorCategories(majorCategoriesData.data);
          setExpandedMajorCategories(new Set(majorCategoriesData.data.map(c => c.id)));
        }
        if (sourcesData.success && sourcesData.data) {
          setSources(sourcesData.data);
        }
        if (allCategoriesData.success && allCategoriesData.data) {
          setCategories(allCategoriesData.data);
          setExpandedCategories(new Set(allCategoriesData.data.map(c => c.id)));
        }
        if (userConfigsData.success && userConfigsData.data) {
          const configMap = new Map<string, boolean>();
          userConfigsData.data.forEach(config => {
            configMap.set(config.sourceId, config.isEnabled);
          });
          setSourceConfigs(configMap);
        }
        if (allSourcesData.success && allSourcesData.data) {
          setAllSources(allSourcesData.data);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    loadData();
    initializeProxy();
  }, [setMajorCategories, setSources, setCategories, initializeProxy, isAuthenticated]);

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

  const toggleMajorCategory = (id: string) => {
    const newExpanded = new Set(expandedMajorCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMajorCategories(newExpanded);
  };

  const toggleCategory = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  const getMajorCategoriesWithCategories = (): MajorCategoryWithCategories[] => {
    return majorCategories.map(mc => {
      const majorCategories = categories.filter(c => c.majorCategoryId === mc.id);
      
      const categoriesWithSources: CategoryWithSources[] = majorCategories.map(cat => {
        const categorySources = sources.filter(s => s.categoryId === cat.id);
        return {
          ...cat,
          sources: categorySources,
        };
      }).filter(c => c.sources.length > 0);
      
      return {
        ...mc,
        categories: categoriesWithSources,
      };
    }).filter(mc => mc.categories.length > 0);
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

  const isSourceEnabled = (sourceId: string): boolean => {
    const source = allSources.find(s => s.id === sourceId);
    if (source?.userConfig !== undefined && source?.userConfig !== null) {
      return source.userConfig.isEnabled !== false;
    }
    const config = sourceConfigs.get(sourceId);
    return config !== false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/20 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/20">
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
              {isAuthenticated && (
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
              )}

              <button onClick={toggleTheme} className="p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors">
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {isAuthenticated ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 ml-1 pl-2 border-l border-surface-200 dark:border-surface-700">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center text-white text-xs font-bold">
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300 max-w-[80px] truncate">{user?.username}</span>
                  </div>
                  <button onClick={handleLogout} className="p-2 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors ml-1" title="退出登录">
                    <LogOut className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <Link to="/login" className="ml-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors">
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            👋 嗨，<span className="text-primary-600 dark:text-primary-400">{isAuthenticated ? user?.username : '访客'}</span>
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">搜索全网资源，一步直达</p>
        </div>

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
                      <SourceIcon
                        icon={result.sourceIcon}
                        name={result.sourceName}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-sm">{result.sourceName}</h3>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${getSiteTypeBadge(result.siteType)}`}>
                            {getSiteTypeLabel(result.siteType)}
                          </span>
                          {isProxyEnabled && (
                            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400">
                              <ShieldCheck className="w-3 h-3" />
                              代理
                            </span>
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">{result.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAuthenticated && (
                        <button onClick={() => handleAddFavorite(result)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors" title="收藏">
                          <Heart className="w-4 h-4" />
                        </button>
                      )}
                      {result.url && (
                        <button
                          onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(result.url) : result.url, '_blank')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-sm ${
                            isProxyEnabled 
                              ? 'bg-gradient-to-r from-success-500 to-teal-500 hover:from-success-600 hover:to-teal-600 shadow-success-500/25' 
                              : 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 shadow-primary-500/25'
                          }`}
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

        <div className="space-y-4">
          {isAuthenticated && (
            <>
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
                        <div className="p-4 max-h-60 overflow-y-auto scrollbar-thin">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            {searchHistory.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800/60 cursor-pointer transition-colors border border-surface-100 dark:border-surface-800"
                                onClick={() => setKeyword(item.query)}
                              >
                                <Search className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                                <span className="text-sm text-surface-800 dark:text-surface-200 truncate">{item.query}</span>
                              </div>
                            ))}
                          </div>
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
                      <div className="p-4 max-h-64 overflow-y-auto scrollbar-thin">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {favorites.map((item) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors border border-surface-100 dark:border-surface-800"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{item.title}</p>
                                {item.subtitle && <p className="text-xs text-surface-400 truncate mt-0.5">{item.subtitle}</p>}
                              </div>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <button onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(item.url) : item.url, '_blank')} className="p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleRemoveFavorite(item.id)} className="p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
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
            </>
          )}

          <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 overflow-hidden backdrop-blur-sm">
            <button onClick={() => setShowSources(!showSources)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100">搜索源管理</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">{sources.length}</span>
              </div>
              {showSources ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
            </button>
            {showSources && (
              <div className="border-t border-surface-100 dark:border-surface-800 max-h-[600px] overflow-y-auto scrollbar-thin">
                {getMajorCategoriesWithCategories().map((majorCategory) => {
                  const isMajorExpanded = expandedMajorCategories.has(majorCategory.id);
                  const totalSources = majorCategory.categories.reduce((sum, c) => sum + c.sources.length, 0);
                  const enabledSources = majorCategory.categories.reduce((sum, c) => 
                    sum + c.sources.filter(s => isSourceEnabled(s.id)).length, 0
                  );
                  
                  return (
                    <div key={majorCategory.id} className="border-b border-surface-50 dark:border-surface-800/60 last:border-b-0">
                      <button 
                        onClick={() => toggleMajorCategory(majorCategory.id)} 
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <ChevronRight className={`w-4 h-4 text-surface-400 transition-transform duration-200 ${isMajorExpanded ? 'rotate-90' : ''}`} />
                          <div 
                            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: majorCategory.color || '#6366f1' }}
                          >
                            {majorCategory.icon ? (
                              <span className="text-lg">{majorCategory.icon}</span>
                            ) : (
                              <Database className="w-5 h-5" />
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{majorCategory.name}</span>
                            <p className="text-xs text-surface-400">{majorCategory.categories.length} 个分类 · {totalSources} 个搜索源</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {majorCategory.requiresKeyword ? (
                            <span className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded-lg font-medium">
                              {enabledSources}/{totalSources} 启用
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 rounded-lg font-medium">
                              浏览型 · 不参与搜索
                            </span>
                          )}
                        </div>
                      </button>
                      
                      {isMajorExpanded && (
                        <div className="bg-surface-50/30 dark:bg-surface-900/20">
                          {majorCategory.categories.map((category) => {
                            const isCategoryExpanded = expandedCategories.has(category.id);
                            const categoryEnabledCount = category.sources.filter(s => isSourceEnabled(s.id)).length;
                            
                            return (
                              <div key={category.id}>
                                <button
                                  onClick={() => toggleCategory(category.id)}
                                  className="w-full flex items-center justify-between px-5 py-2.5 pl-12 hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <ChevronRight className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                    <div 
                                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-sm"
                                      style={{ backgroundColor: category.color || '#8b5cf6' }}
                                    >
                                      {category.icon ? (
                                        <span className="text-sm">{category.icon}</span>
                                      ) : (
                                        <FolderOpen className="w-3.5 h-3.5" />
                                      )}
                                    </div>
                                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{category.name}</span>
                                    <span className="text-xs text-surface-400">{category.sources.length} 个源</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {majorCategory.requiresKeyword ? (
                                      <span className="text-xs text-surface-500 dark:text-surface-400">
                                        {categoryEnabledCount}/{category.sources.length} 启用
                                      </span>
                                    ) : (
                                      <span className="text-xs text-surface-400 dark:text-surface-500">
                                        不参与搜索
                                      </span>
                                    )}
                                  </div>
                                </button>
                                
                                {isCategoryExpanded && (
                                  <div className="px-4 pb-3 pl-16">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                      {category.sources.map((source) => {
                                        const isEnabled = isSourceEnabled(source.id);
                                        return (
                                          <div 
                                            key={source.id} 
                                            className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                                              isEnabled 
                                                ? 'bg-white/60 dark:bg-surface-800/40 hover:bg-white dark:hover:bg-surface-800' 
                                                : 'bg-surface-100/40 dark:bg-surface-900/40 opacity-60'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                              <SourceIcon
                                                icon={source.icon}
                                                name={source.name}
                                                size="sm"
                                              />
                                              <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1">
                                                  <span className={`text-sm font-medium truncate ${isEnabled ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400'}`}>
                                                    {source.name}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                              {majorCategory.requiresKeyword ? (
                                                <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                                                  isEnabled 
                                                    ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' 
                                                    : 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'
                                                }`}>
                                                  {isEnabled ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                </div>
                                              ) : (
                                                <span className="text-xs text-surface-400 dark:text-surface-500">
                                                  不参与
                                                </span>
                                              )}
                                              <button 
                                                onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(source.urlTemplate.replace('{keyword}', '')) : source.urlTemplate.replace('{keyword}', ''), '_blank')} 
                                                className="p-1 rounded text-surface-400 hover:text-primary-500 hover:bg-white dark:hover:bg-surface-700 transition-colors"
                                                title="访问站点"
                                              >
                                                <ExternalLink className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-sm border border-surface-200/60 dark:border-surface-700/60 overflow-hidden backdrop-blur-sm">
            <button onClick={() => setShowAllSources(!showAllSources)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100">所有源</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-full">{allSources.length}</span>
              </div>
              {showAllSources ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
            </button>
            {showAllSources && (
              <div className="border-t border-surface-100 dark:border-surface-800 max-h-[500px] overflow-y-auto scrollbar-thin">
                {majorCategories.map((majorCategory) => {
                  const majorCategorySources = allSources.filter(s => {
                    const cat = categories.find(c => c.id === s.categoryId);
                    return cat?.majorCategoryId === majorCategory.id;
                  });
                  
                  if (majorCategorySources.length === 0) return null;
                  
                  const isSearchCategory = majorCategory.requiresKeyword;
                  const enabledCount = majorCategorySources.filter(s => s.userConfig?.isEnabled !== false).length;
                  
                  return (
                    <div key={majorCategory.id} className="border-b border-surface-50 dark:border-surface-800/60 last:border-b-0 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-sm"
                            style={{ backgroundColor: majorCategory.color || '#6366f1' }}
                          >
                            {majorCategory.icon ? (
                              <span className="text-sm">{majorCategory.icon}</span>
                            ) : (
                              <Database className="w-4 h-4" />
                            )}
                          </div>
                          <span className="text-sm font-semibold text-surface-800 dark:text-surface-200">{majorCategory.name}</span>
                          <span className="text-xs text-surface-400">{majorCategorySources.length} 个源</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isSearchCategory ? (
                            <span className="text-xs px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded-lg font-medium">
                              {enabledCount}/{majorCategorySources.length} 启用
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg font-medium">
                              不参与搜索
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                        {majorCategorySources.map((source) => {
                          const isEnabled = source.userConfig?.isEnabled !== false;
                          return (
                            <div 
                              key={source.id} 
                              className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                                isEnabled 
                                  ? 'bg-surface-50 dark:bg-surface-800/40' 
                                  : 'bg-surface-100/40 dark:bg-surface-900/40 opacity-50'
                              }`}
                            >
                              <SourceIcon
                                icon={source.icon}
                                name={source.name}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <span className={`text-xs font-medium truncate block ${isEnabled ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400'}`}>
                                  {source.name}
                                </span>
                              </div>
                              {!isSearchCategory && (
                                <span className="text-xs text-amber-500 dark:text-amber-400 shrink-0">不参与</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
                <Settings className="w-4 h-4 text-surface-400" />系统设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
