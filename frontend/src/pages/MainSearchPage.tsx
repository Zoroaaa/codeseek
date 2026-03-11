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
  Tag,
  LayoutDashboard,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { useSearchStore, useSourceStore, useAuthStore, useThemeStore, useProxyStore } from '@/stores';
import { searchApi, sourceApi, userApi, analyticsApi } from '@/services/api';
import { Loading, SourceIcon } from '@/components/ui';
import { convertToProxyUrl } from '@/services/proxy/ProxyService';
import { useToast } from '@/components/ui/Toast';
import { useNavigate, Link } from 'react-router-dom';
import type { SearchResult, FavoriteItem, SearchHistoryItem, MajorCategory, Category, SearchSource, UserSourceConfig } from '@/types';

interface SearchResultItem extends SearchResult {
  subtitle?: string;
  siteType?: string;
  category?: string;
}

interface SourceWithUserConfig extends SearchSource {
  userConfig?: UserSourceConfig | null;
}

interface CategoryWithSources extends Category {
  sources: SourceWithUserConfig[];
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
  const { majorCategories, setMajorCategories, categories, setCategories } = useSourceStore();
  const { isEnabled: isProxyEnabled, status: proxyStatus, isLoading: isProxyLoading, toggleProxy, initializeProxy } = useProxyStore();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [showFavorites, setShowFavorites] = useState(true);
  const [showSources, setShowSources] = useState(true);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768 ? 'grid' : 'list';
    }
    return 'list';
  });
  const [expandedMajorCategories, setExpandedMajorCategories] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [allSources, setAllSources] = useState<SourceWithUserConfig[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isBatchChecking, setIsBatchChecking] = useState(false);
  const [batchCheckResults, setBatchCheckResults] = useState<Record<string, {
    status: string;
    available: boolean;
    responseTime: number;
    error: string | null;
  }>>({});

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setViewMode('list');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [majorCategoriesData, allCategoriesData, allSourcesData] = await Promise.all([
          sourceApi.getMajorCategories(),
          sourceApi.getCategories(),
          sourceApi.getSourcesWithUserConfig(),
        ]);
        if (majorCategoriesData.success && majorCategoriesData.data) {
          setMajorCategories(majorCategoriesData.data);
          setExpandedMajorCategories(new Set(majorCategoriesData.data.map(c => c.id)));
        }
        if (allCategoriesData.success && allCategoriesData.data) {
          setCategories(allCategoriesData.data);
          setExpandedCategories(new Set(allCategoriesData.data.map(c => c.id)));
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
  }, [setMajorCategories, setCategories, initializeProxy, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
      loadFavorites();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (hasSearched && keyword.trim()) {
      handleSearch();
    }
  }, [selectedCategory]);

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

    // 记录搜索分析事件
    const sessionId = sessionStorage.getItem('analytics_session_id') || (() => {
      const id = Math.random().toString(36).slice(2);
      sessionStorage.setItem('analytics_session_id', id);
      return id;
    })();
    analyticsApi.recordEvent({
      userId: user?.id,
      sessionId,
      eventType: 'search',
      eventData: { keyword: keyword.trim() },
    }).catch(() => {});

    setSearching(true);
    setHasSearched(true);
    try {
      const response = await searchApi.search({
        keyword: keyword.trim(),
        categoryId: selectedCategory || undefined,
      }) as unknown as { success: boolean; data: { keyword: string; results: Array<{ id: string; name: string; subtitle?: string; icon?: string; url: string; siteType: string; category: string }> } };
      if (response.success && response.data) {
        const mappedResults: SearchResultItem[] = response.data.results.map(r => ({
          sourceId: r.id,
          sourceName: r.name,
          sourceIcon: r.icon,
          url: r.url,
          subtitle: r.subtitle,
          siteType: r.siteType,
          category: r.category,
        }));
        setResults(mappedResults as unknown as SearchResult[]);
        setSearchResults(mappedResults);
        if (mappedResults.length === 0) {
          toast.info('未找到结果', '尝试更换关键词搜索');
        } else {
          loadHistory();
        }
      }
    } catch (_error) {
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

  const isFavorite = (url: string) => {
    return favorites.some(f => f.url === url);
  };

  const getFavoriteId = (url: string) => {
    return favorites.find(f => f.url === url)?.id;
  };

  const handleToggleFavorite = async (result: SearchResultItem) => {
    if (!isAuthenticated) {
      toast.warning('请先登录');
      navigate('/login');
      return;
    }
    
    const existingFavoriteId = getFavoriteId(result.url || '');
    
    if (existingFavoriteId) {
      try {
        await userApi.removeFavorite(existingFavoriteId);
        setFavorites(prev => prev.filter(f => f.id !== existingFavoriteId));
        toast.success('已取消收藏');
      } catch (_error) {
        toast.error('取消收藏失败', '请稍后重试');
      }
    } else {
      try {
        const response = await userApi.addFavorite({
          title: result.sourceName,
          url: result.url || '',
          subtitle: result.subtitle,
          keyword: keyword.trim() || undefined,
        });
        if (response.success && response.data) {
          setFavorites(prev => [response.data, ...prev]);
        }
        toast.success('已添加到收藏');
      } catch (_error) {
        toast.error('收藏失败', '请稍后重试');
      }
    }
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      await userApi.removeFavorite(id);
      setFavorites(prev => prev.filter(f => f.id !== id));
      toast.success('已移除收藏');
    } catch (_error) {
      toast.error('移除失败', '请稍后重试');
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定要清空所有搜索历史吗？')) return;
    try {
      await userApi.clearSearchHistory();
      setSearchHistory([]);
      toast.success('历史已清空');
    } catch (_error) {
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
        const categorySources = allSources.filter(s => s.categoryId === cat.id);
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

  const handleBatchCheckSources = async () => {
    const searchableSources = allSources.filter(s => s.searchable && s.userConfig?.isEnabled !== false);
    if (searchableSources.length === 0) {
      toast.warning('没有可检查的搜索源');
      return;
    }

    setIsBatchChecking(true);
    setBatchCheckResults({});

    try {
      const sourceIds = searchableSources.map(s => s.id);
      const batchSize = 10;
      
      for (let i = 0; i < sourceIds.length; i += batchSize) {
        const batch = sourceIds.slice(i, i + batchSize);
        const response = await sourceApi.batchCheckSourceStatus(batch);
        
        if (response.success && response.data) {
          const newResults: Record<string, {
            status: string;
            available: boolean;
            responseTime: number;
            error: string | null;
          }> = {};
          
          response.data.results.forEach(result => {
            newResults[result.sourceId] = {
              status: result.status,
              available: result.available,
              responseTime: result.responseTime,
              error: result.error,
            };
          });
          
          setBatchCheckResults(prev => ({ ...prev, ...newResults }));
        }
      }
      
      toast.success(`已完成 ${searchableSources.length} 个搜索源的健康检查`);
    } catch (_error) {
      toast.error('批量检查失败', '请稍后重试');
    } finally {
      setIsBatchChecking(false);
    }
  };

  const handleCheckSingleSource = async (sourceId: string) => {
    try {
      const response = await sourceApi.checkSourceStatus(sourceId);
      if (response.success && response.data) {
        setBatchCheckResults(prev => ({
          ...prev,
          [sourceId]: {
            status: response.data.status,
            available: response.data.available,
            responseTime: response.data.responseTime,
            error: response.data.error,
          }
        }));
        toast.success('检查完成', `响应时间: ${response.data.responseTime}ms`);
      }
    } catch (_error) {
      toast.error('检查失败', '请稍后重试');
    }
  };

  const getCategoryBadge = (categoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    }
    const majorCategory = majorCategories.find(mc => mc.id === category.majorCategoryId);
    if (majorCategory?.color) {
      return `bg-opacity-20 text-opacity-90`;
    }
    return 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300';
  };

  const getCategoryLabel = (categoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return '搜索';
    return category.name;
  };

  const getCategoryStyle = (categoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return {};
    const majorCategory = majorCategories.find(mc => mc.id === category.majorCategoryId);
    if (majorCategory?.color) {
      return { backgroundColor: `${majorCategory.color}20`, color: majorCategory.color };
    }
    return {};
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

  const getProxyButtonClass = () => {
    if (isProxyEnabled) return 'proxy-toggle-btn enabled';
    if (proxyStatus === 'error') return 'proxy-toggle-btn error';
    return 'proxy-toggle-btn disabled';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/20 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/20">
      <header className="mobile-header">
        <div className="max-w-7xl mx-auto">
          <div className="mobile-header-inner">
            <Link to="/main" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-all">
                <Search className="w-4 h-4 sm:w-5 sm:h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent hidden xs:block tracking-tight">
                磁力快搜
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              <Link to="/main" className="px-3.5 py-2 text-sm font-semibold rounded-xl text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 transition-all flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5" />
                搜索
              </Link>
              <Link to="/dashboard" className="px-3.5 py-2 text-sm font-medium rounded-xl text-surface-500 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all flex items-center gap-1.5">
                <LayoutDashboard className="w-3.5 h-3.5" />
                控制台
              </Link>
              <Link to="/community" className="px-3.5 py-2 text-sm font-medium rounded-xl text-surface-500 dark:text-surface-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                社区
              </Link>
              {isAuthenticated && user && (user.role === 'admin' || user.role === 'super_admin') && (
                <Link to="/admin-panel" className="px-3.5 py-2 text-sm font-medium rounded-xl text-surface-500 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  管理
                </Link>
              )}
            </nav>

            <div className="mobile-header-actions">
              {isAuthenticated && (
                <button
                  onClick={toggleProxy}
                  disabled={isProxyLoading}
                  className={getProxyButtonClass()}
                  title={isProxyEnabled ? '代理已启用 - 点击关闭' : '代理已关闭 - 点击启用'}
                >
                  {isProxyLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : isProxyEnabled ? <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" /> : proxyStatus === 'error' ? <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" /> : <Shield className="w-4 h-4 sm:w-5 sm:h-5" />}
                </button>
              )}

              <button onClick={toggleTheme} className="theme-toggle-btn">
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>

              <Link 
                to="/dashboard" 
                className="mobile-header-btn md:hidden"
                title="控制台"
              >
                <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>

              <Link 
                to="/community" 
                className="mobile-header-btn md:hidden"
                title="社区"
              >
                <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>

              {isAuthenticated && user && (user.role === 'admin' || user.role === 'super_admin') && (
                <Link 
                  to="/admin-panel" 
                  className="mobile-header-btn md:hidden text-red-500 hover:text-red-600"
                  title="管理后台"
                >
                  <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
              )}

              {isAuthenticated ? (
                <>
                  <div className="mobile-user-info">
                    <div className="mobile-user-avatar">
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300 max-w-[80px] truncate">{user?.username}</span>
                  </div>
                  <button onClick={handleLogout} className="mobile-logout-btn" title="退出登录">
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </>
              ) : (
                <Link to="/login" className="ml-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:from-primary-600 hover:to-accent-600 shadow-lg shadow-primary-500/25 transition-all">
                  登录
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="mb-4 sm:mb-6 animate-fade-in">
          <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-surface-900 dark:text-surface-100">
            嗨，<span className="bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">{isAuthenticated ? user?.username : '访客'}</span> 👋
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-0.5">搜索全网资源，一步直达</p>
        </div>

        <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-xl shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 p-3 sm:p-5 mb-4 sm:mb-6 backdrop-blur-sm animate-slide-up">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="search-input-wrapper">
              <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none">
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <input
                type="text"
                placeholder="输入番号、关键词搜索资源..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className="search-input"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="search-btn flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" strokeWidth={2.5} />
              )}
              <span className="hidden sm:inline">搜索</span>
              <span className="sm:hidden">搜索</span>
            </button>
          </div>

          {categories.filter(cat => {
            const majorCategory = majorCategories.find(mc => mc.id === cat.majorCategoryId);
            return majorCategory?.requiresKeyword === true;
          }).length > 0 && (
            <div className="category-filter-wrapper">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-xs text-surface-400 font-medium hidden sm:inline">分类</span>
              </div>
              <div className="flex items-center gap-1.5 flex-nowrap">
                <button onClick={() => setSelectedCategory(null)} className={`category-filter-btn ${selectedCategory === null ? 'active' : ''}`}>
                  全部
                </button>
                {categories
                  .filter(cat => {
                    const majorCategory = majorCategories.find(mc => mc.id === cat.majorCategoryId);
                    return majorCategory?.requiresKeyword === true;
                  })
                  .map((category) => (
                    <button key={category.id} onClick={() => setSelectedCategory(category.id)} className={`category-filter-btn ${selectedCategory === category.id ? 'active' : ''}`}>
                      {category.icon && <span className="mr-1">{category.icon}</span>}
                      {category.name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-xl shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 p-3 sm:p-5 mb-4 sm:mb-6 backdrop-blur-sm animate-fade-in">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">搜索结果</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                  {searchResults.length}
                </span>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1">
                <button onClick={() => setViewMode('list')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                  <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button onClick={() => setViewMode('grid')} className={`p-1.5 sm:p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}>
                  <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button onClick={() => setSearchResults([])} className="p-1.5 sm:p-2 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all ml-1">
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            </div>

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3' : 'space-y-2'}>
              {searchResults.map((result, index) => (
                <div key={index} className="result-card p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <SourceIcon
                        icon={result.sourceIcon}
                        name={result.sourceName}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-xs sm:text-sm">{result.sourceName}</h3>
                          <span 
                            className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md font-medium ${getCategoryBadge(result.category)}`}
                            style={getCategoryStyle(result.category)}
                          >
                            {getCategoryLabel(result.category)}
                          </span>
                          {isProxyEnabled && (
                            <span className="hidden sm:flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400">
                              <ShieldCheck className="w-3 h-3" />
                              代理
                            </span>
                          )}
                        </div>
                        {result.subtitle && (
                          <p className="text-[10px] sm:text-xs text-surface-500 dark:text-surface-400 mt-0.5 truncate">{result.subtitle}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {isAuthenticated && (
                        <button 
                          onClick={() => handleToggleFavorite(result)} 
                          className={`p-1.5 sm:p-2 rounded-lg transition-all ${
                            isFavorite(result.url || '') 
                              ? 'text-error-500 bg-error-50 dark:bg-error-900/20' 
                              : 'text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20'
                          }`} 
                          title={isFavorite(result.url || '') ? '取消收藏' : '收藏'}
                        >
                          <Heart className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFavorite(result.url || '') ? 'fill-current' : ''}`} />
                        </button>
                      )}
                      {result.url && (
                        <button
                          onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(result.url) : result.url, '_blank')}
                          className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-semibold text-white transition-all shadow-md ${
                            isProxyEnabled 
                              ? 'bg-gradient-to-r from-success-500 to-teal-500 hover:from-success-600 hover:to-teal-600 shadow-success-500/25' 
                              : 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 shadow-primary-500/25'
                          }`}
                        >
                          <span className="hidden sm:inline">前往</span>
                          <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 sm:space-y-4">
          {isAuthenticated && (
            <>
              <div className="collapsible-section animate-fade-in" style={{ animationDelay: '100ms' }}>
                <button onClick={() => setShowHistory(!showHistory)} className="collapsible-header">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">搜索历史</span>
                    {searchHistory.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">{searchHistory.length}</span>
                    )}
                  </div>
                  {showHistory ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                </button>
                {showHistory && (
                  <div className="collapsible-content">
                    {isLoadingHistory ? (
                      <div className="p-6 sm:p-8 flex justify-center"><Loading /></div>
                    ) : searchHistory.length > 0 ? (
                      <>
                        <div className="p-3 sm:p-4 max-h-48 sm:max-h-60 overflow-y-auto scrollbar-thin">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5 sm:gap-2">
                            {searchHistory.map((item) => (
                              <div 
                                key={item.id} 
                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800/60 cursor-pointer transition-all border border-surface-100 dark:border-surface-800 active:scale-[0.98]"
                                onClick={() => setKeyword(item.query)}
                              >
                                <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-surface-400 shrink-0" />
                                <span className="text-xs sm:text-sm text-surface-800 dark:text-surface-200 truncate">{item.query}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-t border-surface-50 dark:border-surface-800/60">
                          <button onClick={handleClearHistory} className="flex items-center gap-1.5 text-xs sm:text-sm text-error-500 hover:text-error-700 transition-colors">
                            <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />清空历史
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="px-4 sm:px-5 py-6 sm:py-8 text-center">
                        <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm text-surface-400">暂无搜索历史</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="collapsible-section animate-fade-in" style={{ animationDelay: '150ms' }}>
                <button onClick={() => setShowFavorites(!showFavorites)} className="collapsible-header">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
                      <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">我的收藏</span>
                    {favorites.length > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full">{favorites.length}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {showFavorites && favorites.length > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); handleExportFavorites(); }} className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all" title="导出收藏">
                        <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                    {showFavorites ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
                  </div>
                </button>
                {showFavorites && (
                  <div className="collapsible-content">
                    {isLoadingFavorites ? (
                      <div className="p-6 sm:p-8 flex justify-center"><Loading /></div>
                    ) : favorites.length > 0 ? (
                      <div className="p-3 sm:p-4 max-h-52 sm:max-h-64 overflow-y-auto scrollbar-thin">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
                          {favorites.map((item) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-all border border-surface-100 dark:border-surface-800"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{item.title}</p>
                                {item.subtitle && <p className="text-[10px] sm:text-xs text-surface-400 truncate mt-0.5">{item.subtitle}</p>}
                                {item.keyword && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-400 flex-shrink-0" />
                                    <span className="text-[10px] sm:text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded truncate max-w-[100px] sm:max-w-[120px]">
                                      {item.keyword}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 sm:gap-1 ml-2 shrink-0">
                                <button onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(item.url) : item.url, '_blank')} className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                                  <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                                <button onClick={() => handleRemoveFavorite(item.id)} className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all">
                                  <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 sm:px-5 py-6 sm:py-8 text-center">
                        <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
                        <p className="text-xs sm:text-sm text-surface-400">暂无收藏，搜索后点击收藏按钮</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="collapsible-section animate-fade-in" style={{ animationDelay: '200ms' }}>
            <button onClick={() => setShowSources(!showSources)} className="collapsible-header">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">搜索源管理</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full">{allSources.length}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {showSources && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleBatchCheckSources(); }} 
                    disabled={isBatchChecking}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-all disabled:opacity-50"
                  >
                    {isBatchChecking ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        检查中
                      </>
                    ) : (
                      <>
                        <Activity className="w-3 h-3" />
                        批量检查
                      </>
                    )}
                  </button>
                )}
                {showSources ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
              </div>
            </button>
            {showSources && (
              <div className="border-t border-surface-100 dark:border-surface-800 max-h-[400px] sm:max-h-[600px] overflow-y-auto scrollbar-thin">
                {getMajorCategoriesWithCategories().map((majorCategory) => {
                  const isMajorExpanded = expandedMajorCategories.has(majorCategory.id);
                  const totalSources = majorCategory.categories.reduce((sum, c) => sum + c.sources.length, 0);
                  const enabledSources = majorCategory.categories.reduce((sum, c) => 
                    sum + c.sources.filter(s => s.userConfig?.isEnabled !== false).length, 0
                  );
                  
                  return (
                    <div key={majorCategory.id} className="border-b border-surface-50 dark:border-surface-800/60 last:border-b-0">
                      <button 
                        onClick={() => toggleMajorCategory(majorCategory.id)} 
                        className="w-full flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <ChevronRight className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400 transition-transform duration-200 ${isMajorExpanded ? 'rotate-90' : ''}`} />
                          <div 
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-white shadow-md"
                            style={{ backgroundColor: majorCategory.color || '#6366f1' }}
                          >
                            {majorCategory.icon ? (
                              <span className="text-base sm:text-lg">{majorCategory.icon}</span>
                            ) : (
                              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                          </div>
                          <div className="text-left">
                            <span className="text-xs sm:text-sm font-semibold text-surface-800 dark:text-surface-200">{majorCategory.name}</span>
                            <p className="text-[10px] sm:text-xs text-surface-400">{majorCategory.categories.length} 个分类 · {totalSources} 个搜索源</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          {majorCategory.requiresKeyword ? (
                            <span className="text-[10px] sm:text-xs px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded-lg font-medium">
                              {enabledSources}/{totalSources} 启用
                            </span>
                          ) : (
                            <span className="text-[10px] sm:text-xs px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-400 dark:text-surface-500 rounded-lg font-medium">
                              浏览型
                            </span>
                          )}
                        </div>
                      </button>
                      
                      {isMajorExpanded && (
                        <div className="bg-surface-50/30 dark:bg-surface-900/20">
                          {majorCategory.categories.map((category) => {
                            const isCategoryExpanded = expandedCategories.has(category.id);
                            const categoryEnabledCount = category.sources.filter(s => s.userConfig?.isEnabled !== false).length;
                            
                            return (
                              <div key={category.id}>
                                <button
                                  onClick={() => toggleCategory(category.id)}
                                  className="w-full flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 pl-8 sm:pl-12 hover:bg-surface-100/50 dark:hover:bg-surface-800/30 transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                                    <ChevronRight className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-surface-400 transition-transform duration-200 ${isCategoryExpanded ? 'rotate-90' : ''}`} />
                                    <div 
                                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-white shadow-sm"
                                      style={{ backgroundColor: category.color || '#8b5cf6' }}
                                    >
                                      {category.icon ? (
                                        <span className="text-xs sm:text-sm">{category.icon}</span>
                                      ) : (
                                        <FolderOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                      )}
                                    </div>
                                    <span className="text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300">{category.name}</span>
                                    <span className="text-[10px] sm:text-xs text-surface-400">{category.sources.length} 个源</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 sm:gap-2">
                                    {majorCategory.requiresKeyword ? (
                                      <span className="text-[10px] sm:text-xs text-surface-500 dark:text-surface-400">
                                        {categoryEnabledCount}/{category.sources.length} 启用
                                      </span>
                                    ) : (
                                      <span className="text-[10px] sm:text-xs text-surface-400 dark:text-surface-500">
                                        不参与搜索
                                      </span>
                                    )}
                                  </div>
                                </button>
                                
                                {isCategoryExpanded && (
                                  <div className="px-3 sm:px-4 pb-2 sm:pb-3 pl-10 sm:pl-16">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2">
                                      {category.sources.map((source) => {
                                        const isEnabled = source.userConfig?.isEnabled !== false;
                                        const sourceName = source.userConfig?.customName || source.name;
                                        const sourceSubtitle = source.userConfig?.customSubtitle || source.subtitle;
                                        const checkResult = batchCheckResults[source.id];
                                        
                                        return (
                                          <div 
                                            key={source.id} 
                                            className={`source-tree-item ${isEnabled ? 'enabled' : 'disabled'}`}
                                          >
                                            <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                                              <div className="flex items-start gap-1.5 sm:gap-2 min-w-0 flex-1">
                                                <SourceIcon
                                                  icon={source.icon}
                                                  name={sourceName}
                                                  size="sm"
                                                />
                                                <div className="min-w-0 flex-1">
                                                  <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                                    <span className={`text-[10px] sm:text-xs font-semibold ${isEnabled ? 'text-surface-800 dark:text-surface-200' : 'text-surface-500'}`}>
                                                      {sourceName}
                                                    </span>
                                                    <span className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded font-medium ${getSiteTypeBadge(source.siteType)}`}>
                                                      {getSiteTypeLabel(source.siteType)}
                                                    </span>
                                                    {majorCategory.requiresKeyword && (
                                                      <span className={`flex items-center gap-0.5 text-[9px] sm:text-[10px] px-1 py-0.5 rounded font-medium ${
                                                        isEnabled 
                                                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' 
                                                          : 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'
                                                      }`}>
                                                        {isEnabled ? <CheckCircle className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> : <XCircle className="w-2 h-2 sm:w-2.5 sm:h-2.5" />}
                                                        {isEnabled ? '启用' : '禁用'}
                                                      </span>
                                                    )}
                                                    {checkResult && (
                                                      <span className={`flex items-center gap-0.5 text-[9px] sm:text-[10px] px-1 py-0.5 rounded font-medium ${
                                                        checkResult.available 
                                                          ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400' 
                                                          : 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                                                      }`}>
                                                        {checkResult.available ? (
                                                          <>
                                                            <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                                                            {checkResult.responseTime}ms
                                                          </>
                                                        ) : (
                                                          <>
                                                            <XCircle className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                                                            异常
                                                          </>
                                                        )}
                                                      </span>
                                                    )}
                                                  </div>
                                                  {sourceSubtitle && (
                                                    <p className="text-[9px] sm:text-[10px] text-surface-500 dark:text-surface-400 mt-0.5 truncate">{sourceSubtitle}</p>
                                                  )}
                                                </div>
                                              </div>
                                              <div className="flex items-center gap-0.5 shrink-0">
                                                <button 
                                                  onClick={() => handleCheckSingleSource(source.id)}
                                                  className="p-1 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                                                  title="健康检查"
                                                >
                                                  <RefreshCw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                </button>
                                                <button 
                                                  onClick={() => {
                                                    const homepageUrl = source.homepageUrl || source.urlTemplate.replace('{keyword}', '');
                                                    window.open(isProxyEnabled ? convertToProxyUrl(homepageUrl) : homepageUrl, '_blank');
                                                  }} 
                                                  className="p-1 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                                                  title="访问站点"
                                                >
                                                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                                </button>
                                              </div>
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

          <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-lg border border-surface-200/60 dark:border-surface-700/60 p-3 sm:p-4 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '250ms' }}>
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2.5 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">快捷操作</span>
            </div>
            <div className="space-y-1.5 sm:space-y-2">
              <button onClick={() => navigate('/dashboard/sources')} className="w-full flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left active:scale-[0.99]">
                <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400" />管理搜索源
              </button>
              <button onClick={() => navigate('/dashboard/settings')} className="w-full flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left active:scale-[0.99]">
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400" />系统设置
              </button>
              <button onClick={() => navigate("/community")} className="w-full flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all text-left active:scale-[0.99]">
                <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400" />社区分享
              </button>
              {user && (user.role === "admin" || user.role === "super_admin") && (
                <button onClick={() => navigate("/admin-panel")} className="w-full flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 hover:text-red-700 dark:hover:text-red-400 transition-all text-left active:scale-[0.99]">
                  <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-surface-400" />管理后台
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
