import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { proxyService } from '@/services/proxy/ProxyService';
import { NotificationTemplates } from '@/utils/notificationTemplates';
import { useUIStore } from './uiStore';

interface ProxyState {
  isEnabled: boolean;
  status: 'disabled' | 'enabled' | 'error' | 'checking' | 'degraded' | 'smart';
  isLoading: boolean;
  lastHealthCheck: number | null;
  isHealthy: boolean | null;
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    cacheHits: number;
  };
  
  setEnabled: (enabled: boolean) => void;
  setStatus: (status: 'disabled' | 'enabled' | 'error' | 'checking' | 'degraded' | 'smart') => void;
  setLoading: (loading: boolean) => void;
  toggleProxy: () => Promise<void>;
  initializeProxy: () => Promise<void>;
  refreshStatus: () => void;
}

export const useProxyStore = create<ProxyState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      status: 'disabled',
      isLoading: false,
      lastHealthCheck: null,
      isHealthy: null,
      stats: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        cacheHits: 0,
      },
      
      setEnabled: (isEnabled) => set({ isEnabled }),
      setStatus: (status) => set({ status }),
      setLoading: (isLoading) => set({ isLoading }),
      
      toggleProxy: async () => {
        const { isLoading } = get();
        if (isLoading) return;
        
        set({ isLoading: true, status: 'checking' });
        
        try {
          const result = await proxyService.toggleProxy();
          
          if (result.success) {
            const proxyStatus = proxyService.getProxyStatus();
            set({
              isEnabled: proxyStatus.enabled,
              status: proxyStatus.status,
              lastHealthCheck: proxyStatus.lastHealthCheck,
              isHealthy: proxyStatus.isHealthy,
              stats: {
                totalRequests: proxyStatus.stats.totalRequests,
                successfulRequests: proxyStatus.stats.successfulRequests,
                failedRequests: proxyStatus.stats.failedRequests,
                cacheHits: proxyStatus.stats.cacheHits,
              },
            });
            
            const template = proxyStatus.enabled 
              ? NotificationTemplates.proxy.enabled()
              : NotificationTemplates.proxy.disabled();
            useUIStore.getState().addToast({
              type: template.type,
              title: template.title,
              message: template.message,
            });
          } else {
            set({ status: 'error' });
            const template = NotificationTemplates.proxy.toggleFailed();
            useUIStore.getState().addToast({
              type: template.type,
              title: template.title,
              message: template.message,
            });
          }
        } catch (error) {
          console.error('Toggle proxy failed:', error);
          set({ status: 'error' });
          const template = NotificationTemplates.proxy.toggleFailed();
          useUIStore.getState().addToast({
            type: template.type,
            title: template.title,
            message: template.message,
          });
        } finally {
          set({ isLoading: false });
        }
      },
      
      initializeProxy: async () => {
        try {
          await proxyService.init();
          const proxyStatus = proxyService.getProxyStatus();
          set({
            isEnabled: proxyStatus.enabled,
            status: proxyStatus.status,
            lastHealthCheck: proxyStatus.lastHealthCheck,
            isHealthy: proxyStatus.isHealthy,
            stats: {
              totalRequests: proxyStatus.stats.totalRequests,
              successfulRequests: proxyStatus.stats.successfulRequests,
              failedRequests: proxyStatus.stats.failedRequests,
              cacheHits: proxyStatus.stats.cacheHits,
            },
          });
        } catch (error) {
          console.error('Initialize proxy failed:', error);
        }
      },
      
      refreshStatus: () => {
        const proxyStatus = proxyService.getProxyStatus();
        set({
          isEnabled: proxyStatus.enabled,
          status: proxyStatus.status,
          lastHealthCheck: proxyStatus.lastHealthCheck,
          isHealthy: proxyStatus.isHealthy,
          stats: {
            totalRequests: proxyStatus.stats.totalRequests,
            successfulRequests: proxyStatus.stats.successfulRequests,
            failedRequests: proxyStatus.stats.failedRequests,
            cacheHits: proxyStatus.stats.cacheHits,
          },
        });
      },
    }),
    {
      name: 'proxy-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isEnabled: state.isEnabled,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  document.addEventListener('proxyStatusChanged', () => {
    useProxyStore.getState().refreshStatus();
  });
}
