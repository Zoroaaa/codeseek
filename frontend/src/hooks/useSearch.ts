import { useState, useCallback, useEffect } from 'react';
import { useSearchStore, useAuthStore } from '@/stores';
import { searchApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { SEARCH_HISTORY_CONFIG, PAGINATION_CONFIG, VALIDATION_RULES } from '@/constants';
import type { SearchResult, SearchHistoryItem } from '@/types';

interface UseSearchOptions {
  autoSaveHistory?: boolean;
  maxHistoryItems?: number;
}

interface UseSearchReturn {
  keyword: string;
  setKeyword: (keyword: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  error: string | null;
  currentPage: number;
  totalResults: number;
  hasMore: boolean;
  selectedSources: string[];
  searchHistory: SearchHistoryItem[];
  suggestions: Array<{ keyword: string; count: number }>;
  performSearch: (searchKeyword?: string, page?: number) => Promise<void>;
  loadMore: () => Promise<void>;
  clearResults: () => void;
  resetSearch: () => void;
  toggleSource: (sourceId: string) => void;
  selectAllSources: () => void;
  loadHistory: () => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  loadSuggestions: (keyword: string) => Promise<void>;
  loadTrending: () => Promise<void>;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { autoSaveHistory = true, maxHistoryItems = SEARCH_HISTORY_CONFIG.MAX_HISTORY_ITEMS } = options;
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  const {
    keyword,
    setKeyword,
    results,
    setResults,
    appendResults,
    isSearching,
    setSearching,
    currentPage,
    setCurrentPage,
    totalResults,
    setTotalResults,
    hasMore,
    setHasMore,
    searchHistory,
    setSearchHistory,
    addToHistory,
    clearHistory,
    removeFromHistory,
    suggestions,
    setSuggestions,
  } = useSearchStore();

  const [error, setError] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const performSearch = useCallback(async (searchKeyword?: string, page = 1) => {
    const query = searchKeyword || keyword;
    if (!query?.trim()) {
      setError('请输入搜索关键词');
      return;
    }

    setError(null);
    setSearching(true);

    try {
      const response = await searchApi.search({
        keyword: query.trim(),
        sourceIds: selectedSources.length > 0 ? selectedSources : undefined,
        page,
        pageSize: PAGINATION_CONFIG.DEFAULT_PAGE_SIZE,
      });

      if (response.success && response.data) {
        const { results: searchResults, pagination } = response.data;
        
        if (page === 1) {
          setResults(searchResults);
        } else {
          appendResults(searchResults);
        }

        setTotalResults(pagination.total);
        setCurrentPage(pagination.page);
        setHasMore(pagination.hasMore);

        if (autoSaveHistory && isAuthenticated && searchResults.length > 0) {
          const historyItem: SearchHistoryItem = {
            id: crypto.randomUUID(),
            userId: '',
            query: query.trim(),
            source: selectedSources.join(','),
            resultsCount: pagination.total,
            createdAt: Date.now(),
          };
          addToHistory(historyItem);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败，请稍后重试';
      setError(errorMessage);
      toast.error('搜索失败', errorMessage);
    } finally {
      setSearching(false);
    }
  }, [
    keyword,
    selectedSources,
    setSearching,
    setResults,
    appendResults,
    setTotalResults,
    setCurrentPage,
    setHasMore,
    autoSaveHistory,
    isAuthenticated,
    addToHistory,
    toast,
  ]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isSearching) return;
    await performSearch(keyword, currentPage + 1);
  }, [hasMore, isSearching, keyword, currentPage, performSearch]);

  const clearResults = useCallback(() => {
    setResults([]);
    setTotalResults(0);
    setCurrentPage(1);
    setHasMore(false);
    setError(null);
  }, [setResults, setTotalResults, setCurrentPage, setHasMore]);

  const resetSearch = useCallback(() => {
    setKeyword('');
    clearResults();
    setSelectedSources([]);
  }, [setKeyword, clearResults]);

  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  }, []);

  const selectAllSources = useCallback(() => {
    setSelectedSources([]);
  }, []);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const response = await searchApi.getHistory(maxHistoryItems);
      if (response.success && response.data) {
        setSearchHistory(response.data.slice(0, maxHistoryItems));
      }
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  }, [isAuthenticated, maxHistoryItems, setSearchHistory]);

  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      await searchApi.deleteHistoryItem(id);
      removeFromHistory(id);
    } catch (err) {
      toast.error('删除失败', '无法删除搜索历史');
    }
  }, [removeFromHistory, toast]);

  const clearAllHistory = useCallback(async () => {
    try {
      await searchApi.clearHistory();
      clearHistory();
      toast.success('已清空', '搜索历史已清空');
    } catch (err) {
      toast.error('清空失败', '无法清空搜索历史');
    }
  }, [clearHistory, toast]);

  const loadSuggestions = useCallback(async (keyword: string) => {
    if (!keyword || keyword.length < VALIDATION_RULES.SEARCH_KEYWORD_MIN_LENGTH) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await searchApi.getSuggestions(keyword);
      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  }, [setSuggestions]);

  const loadTrending = useCallback(async () => {
    try {
      const response = await searchApi.getTrending();
      if (response.success && response.data) {
        setSuggestions(response.data);
      }
    } catch (err) {
      console.error('Failed to load trending:', err);
    }
  }, [setSuggestions]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistory();
    }
  }, [isAuthenticated, loadHistory]);

  return {
    keyword,
    setKeyword,
    results,
    isSearching,
    error,
    currentPage,
    totalResults,
    hasMore,
    selectedSources,
    searchHistory,
    suggestions,
    performSearch,
    loadMore,
    clearResults,
    resetSearch,
    toggleSource,
    selectAllSources,
    loadHistory,
    deleteHistoryItem,
    clearAllHistory,
    loadSuggestions,
    loadTrending,
  };
}
