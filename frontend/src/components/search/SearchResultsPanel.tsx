import React from 'react';
import { TrendingUp, List, Grid, X, Heart, ExternalLink, ShieldCheck } from 'lucide-react';
import { SourceIcon } from '@/components/ui';
import { convertToProxyUrl } from '@/services/proxy/ProxyService';
import type { SearchResult, FavoriteItem, Category, MajorCategory } from '@/types';

interface SearchResultItem extends SearchResult {
  subtitle?: string;
  siteType?: string;
  category?: string;
}

interface SearchResultsPanelProps {
  results: SearchResultItem[];
  viewMode: 'grid' | 'list';
  isAuthenticated: boolean;
  isProxyEnabled: boolean;
  favorites: FavoriteItem[];
  categories: Category[];
  majorCategories: MajorCategory[];
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onClose: () => void;
  onToggleFavorite: (result: SearchResultItem) => void;
}

export const SearchResultsPanel: React.FC<SearchResultsPanelProps> = ({
  results,
  viewMode,
  isAuthenticated,
  isProxyEnabled,
  favorites,
  categories,
  majorCategories,
  onViewModeChange,
  onClose,
  onToggleFavorite,
}) => {
  const isFavorite = (url: string) => favorites.some(f => f.url === url);

  const getCategoryBadge = (categoryId?: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (!category) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    const majorCategory = majorCategories.find(mc => mc.id === category.majorCategoryId);
    if (majorCategory?.color) return 'bg-opacity-20 text-opacity-90';
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
    if (majorCategory?.color) return { backgroundColor: `${majorCategory.color}20`, color: majorCategory.color };
    return {};
  };

  if (results.length === 0) return null;

  return (
    <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-xl shadow-surface-900/5 border border-surface-200/60 dark:border-surface-700/60 p-4 sm:p-5 lg:p-6 mb-5 sm:mb-6 lg:mb-8 backdrop-blur-sm animate-fade-in">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-primary-600 dark:text-primary-400" />
          </div>
          <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base lg:text-lg">搜索结果</span>
          <span className="px-2.5 py-1 text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
            {results.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            <List className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
          >
            <Grid className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all ml-1"
          >
            <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4' : 'space-y-2.5 sm:space-y-3'}>
        {results.map((result, index) => (
          <div key={index} className="result-card p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                <SourceIcon icon={result.sourceIcon} name={result.sourceName} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-100 text-xs sm:text-sm lg:text-base truncate">{result.sourceName}</h3>
                    <span
                      className={`text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md font-medium shrink-0 ${getCategoryBadge(result.category)}`}
                      style={getCategoryStyle(result.category)}
                    >
                      {getCategoryLabel(result.category)}
                    </span>
                    {isProxyEnabled && (
                      <span className="hidden sm:flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md font-medium bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400 shrink-0">
                        <ShieldCheck className="w-3 h-3" />代理
                      </span>
                    )}
                  </div>
                  {result.subtitle && (
                    <p className="text-[10px] sm:text-xs text-surface-500 dark:text-surface-400 mt-0.5 sm:mt-1 truncate">{result.subtitle}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {isAuthenticated && (
                  <button
                    onClick={() => onToggleFavorite(result)}
                    className={`p-1.5 sm:p-2 rounded-xl transition-all ${
                      isFavorite(result.url || '')
                        ? 'text-error-500 bg-error-50 dark:bg-error-900/20'
                        : 'text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20'
                    }`}
                    title={isFavorite(result.url || '') ? '取消收藏' : '收藏'}
                  >
                    <Heart className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isFavorite(result.url || '') ? 'fill-current' : ''}`} />
                  </button>
                )}
                {result.url && (
                  <button
                    onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(result.url) : result.url, '_blank')}
                    className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all shadow-md ${
                      isProxyEnabled
                        ? 'bg-gradient-to-r from-success-500 to-teal-500 hover:from-success-600 hover:to-teal-600 shadow-success-500/25'
                        : 'bg-gradient-to-r from-primary-500 to-accent-500 hover:from-primary-600 hover:to-accent-600 shadow-primary-500/25'
                    }`}
                  >
                    <span className="hidden sm:inline">前往</span>
                    <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
