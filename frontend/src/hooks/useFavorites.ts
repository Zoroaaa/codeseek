import { useState, useCallback, useEffect } from 'react';
import { useSearchStore, useAuthStore } from '@/stores';
import { userApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import type { FavoriteItem, AddFavoriteRequest, SyncFavoritesRequest } from '@/types';

interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  isLoading: boolean;
  loadFavorites: () => Promise<void>;
  addFavorite: (data: AddFavoriteRequest) => Promise<boolean>;
  removeFavorite: (id: string) => Promise<boolean>;
  syncFavorites: (favorites: SyncFavoritesRequest) => Promise<boolean>;
  isFavorited: (url: string) => boolean;
  getFavoriteByUrl: (url: string) => FavoriteItem | undefined;
}

export function useFavorites(): UseFavoritesReturn {
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  const { favorites, setFavorites, addToFavorites, removeFromFavorites } = useSearchStore();
  const [isLoading, setIsLoading] = useState(false);

  const loadFavorites = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    try {
      const response = await userApi.getFavorites();
      if (response.success && response.data) {
        setFavorites(response.data.favorites);
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
      toast.error('加载失败', '无法加载收藏列表');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, setFavorites, toast]);

  const addFavorite = useCallback(async (data: AddFavoriteRequest): Promise<boolean> => {
    if (!isAuthenticated) {
      toast.warning('请先登录', '登录后才能收藏');
      return false;
    }

    try {
      const response = await userApi.addFavorite(data);
      if (response.success && response.data) {
        addToFavorites(response.data);
        toast.success('收藏成功');
        return true;
      }
      toast.error('收藏失败', response.message || '无法添加收藏');
      return false;
    } catch (error) {
      console.error('Failed to add favorite:', error);
      toast.error('收藏失败', '无法添加收藏');
      return false;
    }
  }, [isAuthenticated, addToFavorites, toast]);

  const removeFavorite = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await userApi.removeFavorite(id);
      if (response.success) {
        removeFromFavorites(id);
        toast.success('已取消收藏');
        return true;
      }
      toast.error('操作失败', '无法取消收藏');
      return false;
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      toast.error('操作失败', '无法取消收藏');
      return false;
    }
  }, [removeFromFavorites, toast]);

  const syncFavorites = useCallback(async (data: SyncFavoritesRequest): Promise<boolean> => {
    if (!isAuthenticated) {
      toast.warning('请先登录', '登录后才能同步收藏');
      return false;
    }

    try {
      const response = await userApi.syncFavorites(data);
      if (response.success) {
        toast.success('同步成功', `已同步 ${response.data?.count || 0} 个收藏`);
        return true;
      }
      toast.error('同步失败', response.message || '无法同步收藏');
      return false;
    } catch (error) {
      console.error('Failed to sync favorites:', error);
      toast.error('同步失败', '无法同步收藏');
      return false;
    }
  }, [isAuthenticated, toast]);

  const isFavorited = useCallback((url: string): boolean => {
    return favorites.some(f => f.url === url);
  }, [favorites]);

  const getFavoriteByUrl = useCallback((url: string): FavoriteItem | undefined => {
    return favorites.find(f => f.url === url);
  }, [favorites]);

  useEffect(() => {
    if (isAuthenticated) {
      loadFavorites();
    }
  }, [isAuthenticated, loadFavorites]);

  return {
    favorites,
    isLoading,
    loadFavorites,
    addFavorite,
    removeFavorite,
    syncFavorites,
    isFavorited,
    getFavoriteByUrl,
  };
}
