import { apiClient } from './client';
import type {
  SearchHistoryItem,
  FavoriteItem,
  SearchSuggestion,
  TrendingSearch,
  SearchRequest,
  SearchResponse,
  AddFavoriteRequest,
  SyncFavoritesRequest,
  SaveSearchHistoryRequest,
} from '@/types';

export const searchApi = {
  search: async (data: SearchRequest): Promise<SearchResponse> => {
    return apiClient.post<SearchResponse>('/search', data);
  },

  getHistory: async (limit = 50): Promise<{ 
    success: boolean; 
    data: SearchHistoryItem[] 
  }> => {
    return apiClient.get(`/search/history?limit=${limit}`);
  },

  clearHistory: async (): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete('/search/history');
  },

  deleteHistoryItem: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/search/history/${id}`);
  },

  getFavorites: async (): Promise<{ 
    success: boolean; 
    data: FavoriteItem[] 
  }> => {
    return apiClient.get('/search/favorites');
  },

  addFavorite: async (data: AddFavoriteRequest): Promise<{ 
    success: boolean; 
    data: FavoriteItem; 
    message: string 
  }> => {
    return apiClient.post('/search/favorites', data);
  },

  removeFavorite: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/search/favorites/${id}`);
  },

  getSuggestions: async (keyword: string, limit = 10): Promise<{ 
    success: boolean; 
    data: SearchSuggestion[] 
  }> => {
    return apiClient.get(`/search/suggestions?keyword=${encodeURIComponent(keyword)}&limit=${limit}`);
  },

  getTrending: async (limit = 20, hours = 24): Promise<{ 
    success: boolean; 
    data: TrendingSearch[] 
  }> => {
    return apiClient.get(`/search/trending?limit=${limit}&hours=${hours}`);
  },
};

export const userApi = {
  getSettings: async (): Promise<{ 
    success: boolean; 
    data: { settings: Record<string, unknown> } 
  }> => {
    return apiClient.get('/user/settings');
  },

  updateSettings: async (settings: Record<string, unknown>): Promise<{ 
    success: boolean; 
    data: { settings: Record<string, unknown> }; 
    message: string 
  }> => {
    return apiClient.put('/user/settings', { settings });
  },

  getFavorites: async (): Promise<{ 
    success: boolean; 
    data: { favorites: FavoriteItem[] } 
  }> => {
    const response = await apiClient.get<{ success: boolean; data: { favorites: Array<{
      id: string;
      user_id: string;
      title: string;
      subtitle: string | null;
      url: string;
      icon: string | null;
      keyword: string | null;
      created_at: number;
      updated_at: number;
    }> } }>('/user/favorites');
    
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          favorites: response.data.favorites.map(f => ({
            id: f.id,
            userId: f.user_id,
            title: f.title,
            subtitle: f.subtitle || undefined,
            url: f.url,
            icon: f.icon || undefined,
            keyword: f.keyword || undefined,
            createdAt: f.created_at,
          }))
        }
      };
    }
    return { success: false, data: { favorites: [] } };
  },

  addFavorite: async (data: AddFavoriteRequest): Promise<{ 
    success: boolean; 
    data: FavoriteItem; 
    message: string 
  }> => {
    return apiClient.post('/user/favorites', data);
  },

  removeFavorite: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/user/favorites/${id}`);
  },

  syncFavorites: async (data: SyncFavoritesRequest): Promise<{ 
    success: boolean; 
    data: { count: number }; 
    message: string 
  }> => {
    return apiClient.post('/user/favorites/sync', data);
  },

  getSearchHistory: async (limit = 50): Promise<{ 
    success: boolean; 
    data: { history: SearchHistoryItem[] } 
  }> => {
    const response = await apiClient.get<{ success: boolean; data: { history: Array<{
      id: string;
      user_id: string;
      query: string;
      source: string;
      results_count: number;
      created_at: number;
    }> } }>(`/user/search-history?limit=${limit}`);
    
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          history: response.data.history.map(h => ({
            id: h.id,
            user_id: h.user_id,
            query: h.query,
            source: h.source,
            results_count: h.results_count,
            created_at: h.created_at,
          }))
        }
      };
    }
    return { success: false, data: { history: [] } };
  },

  saveSearchHistory: async (data: SaveSearchHistoryRequest): Promise<{ 
    success: boolean; 
    data: SearchHistoryItem; 
    message: string 
  }> => {
    return apiClient.post('/user/search-history', data);
  },

  clearSearchHistory: async (): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete('/user/search-history');
  },

  deleteSearchHistoryItem: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/user/search-history/${id}`);
  },

  getSearchStats: async (): Promise<{ 
    success: boolean; 
    data: {
      totalSearches: number;
      topSources: Array<{ source: string; count: number }>;
      recentSearches: Array<{ query: string; createdAt: number }>;
    } 
  }> => {
    return apiClient.get('/user/search-stats');
  },

  getSourceConfigs: async (): Promise<{ 
    success: boolean; 
    data: { configs: Array<{
      id: string;
      userId: string;
      sourceId: string;
      isEnabled: boolean;
      customPriority: number | null;
      customName: string | null;
      customSubtitle: string | null;
      customIcon: string | null;
      notes: string | null;
    }> } 
  }> => {
    return apiClient.get('/user/source-configs');
  },

  updateSourceConfig: async (sourceId: string, config: {
    isEnabled?: boolean;
    customPriority?: number;
    customName?: string;
    customSubtitle?: string;
    customIcon?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> => {
    return apiClient.put(`/user/source-configs/${sourceId}`, config);
  },
};
