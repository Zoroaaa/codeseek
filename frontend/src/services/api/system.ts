import { apiClient } from './client';
import type { SystemStats, SystemConfig, RecordActionRequest, AnalyticsEvent, AnalyticsStats } from '@/types';

export const systemApi = {
  getApiInfo: async (): Promise<{ 
    success: boolean; 
    data: {
      name: string;
      version: string;
      status: string;
    } 
  }> => {
    return apiClient.get('/');
  },

  healthCheck: async (): Promise<{ status: string; timestamp: number }> => {
    return apiClient.get('/health');
  },

  getStats: async (): Promise<{ success: boolean; data: SystemStats }> => {
    const response = await apiClient.get<{ success: boolean; data: {
      users: number;
      sources: number;
      searches: number;
      activeUsers: number;
      activeUsersGrowthPercent: number;
    } }>('/stats');
    
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          activeUsers: response.data.activeUsers || response.data.users || 0,
          activeSources: response.data.sources || 0,
          totalSearches: response.data.searches || 0,
          activeUsersGrowthPercent: response.data.activeUsersGrowthPercent || 0,
        }
      };
    }
    return { 
      success: false, 
      data: {
        activeUsers: 0,
        activeSources: 0,
        totalSearches: 0,
        activeUsersGrowthPercent: 0,
      }
    };
  },

  getConfig: async (): Promise<{ success: boolean; data: SystemConfig }> => {
    return apiClient.get('/config');
  },

  getPublicConfig: async (): Promise<{ success: boolean; data: SystemConfig }> => {
    return apiClient.get('/config/public');
  },

  checkSourceStatus: async (sourceId: string, keyword = 'test'): Promise<{ 
    success: boolean; 
    data: {
      status: string;
      available: boolean;
      responseTime: number;
      error: string | null;
    } 
  }> => {
    return apiClient.get(`/source-status-check?sourceId=${sourceId}&keyword=${encodeURIComponent(keyword)}`);
  },

  getSourceStatusHistory: async (sourceId: string, limit = 50, hours = 24): Promise<{ 
    success: boolean; 
    data: {
      source: {
        id: string;
        name: string;
        urlTemplate: string;
      };
      history: Array<{
        status: string;
        available: boolean;
        responseTime: number;
        checkedAt: string;
        error: string | null;
      }>;
      summary: {
        uptime: number;
        avgResponseTime: number;
        lastChecked: string;
      };
    } 
  }> => {
    return apiClient.get(`/source-status-history/${sourceId}?limit=${limit}&hours=${hours}`);
  },

  batchCheckSourceStatus: async (sourceIds: string[]): Promise<{ 
    success: boolean; 
    data: Array<{
      sourceId: string;
      status: string;
      available: boolean;
      responseTime: number;
    }> 
  }> => {
    return apiClient.post('/source-status-batch', { sourceIds });
  },

  clearSourceStatusCache: async (sourceId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/source-status-cache/${sourceId}`);
  },

  recordAction: async (data: RecordActionRequest): Promise<{ 
    success: boolean; 
    data: { id: string }; 
    message: string 
  }> => {
    return apiClient.post('/record-action', data);
  },

  getUserActions: async (params?: { 
    userId?: string; 
    action?: string; 
    limit?: number; 
    offset?: number 
  }): Promise<{ 
    success: boolean; 
    data: {
      logs: Array<{
        id: string;
        userId: string;
        userName: string;
        action: string;
        target: string;
        details: string;
        ip: string;
        createdAt: string;
      }>;
      total: number;
    } 
  }> => {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId);
    if (params?.action) searchParams.append('action', params.action);
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.offset) searchParams.append('offset', String(params.offset));
    const queryString = searchParams.toString();
    
    const response = await apiClient.get<{ 
      success: boolean; 
      data: { 
        actions: Array<{
          id: string;
          user_id: string | null;
          action: string;
          data: string;
          ip_address: string | null;
          created_at: number;
        }>;
        total: number;
      } 
    }>(`/user-actions${queryString ? `?${queryString}` : ''}`);
    
    if (response.success && response.data) {
      return {
        success: true,
        data: {
          logs: response.data.actions.map(a => {
            let dataObj: Record<string, unknown> = {};
            try {
              dataObj = JSON.parse(a.data || '{}');
            } catch {
              dataObj = {};
            }
            return {
              id: a.id,
              userId: a.user_id || '',
              userName: '',
              action: a.action,
              target: (dataObj.target as string) || (dataObj.query as string) || (dataObj.keyword as string) || '',
              details: a.data,
              ip: a.ip_address || '',
              createdAt: new Date(a.created_at).toISOString(),
            };
          }),
          total: response.data.total,
        }
      };
    }
    return { success: false, data: { logs: [], total: 0 } };
  },
};

export const analyticsApi = {
  recordEvent: async (data: AnalyticsEvent): Promise<{ 
    success: boolean; 
    data: { eventId: string } 
  }> => {
    return apiClient.post('/analytics/events', data);
  },

  getStats: async (days = 7): Promise<{ 
    success: boolean; 
    data: AnalyticsStats 
  }> => {
    return apiClient.get(`/analytics/stats?days=${days}`);
  },

  getDailyStats: async (startDate?: string, endDate?: string): Promise<{ 
    success: boolean; 
    data: Array<{
      date: string;
      events: number;
      users: number;
      sessions: number;
    }> 
  }> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    return apiClient.get(`/analytics/daily${queryString ? `?${queryString}` : ''}`);
  },

  getTopEvents: async (limit = 20): Promise<{ 
    success: boolean; 
    data: Array<{
      eventType: string;
      count: number;
      percentage: number;
    }> 
  }> => {
    return apiClient.get(`/analytics/top-events?limit=${limit}`);
  },
};

export const configApi = {
  getPublicConfig: async (): Promise<{ success: boolean; data: Record<string, unknown> }> => {
    return apiClient.get('/config/public');
  },

  getAllConfigs: async (): Promise<{ 
    success: boolean; 
    data: Array<{
      key: string;
      value: string;
      description?: string;
      configType: string;
      isPublic: boolean;
    }> 
  }> => {
    return apiClient.get('/config/all');
  },

  getConfigByKey: async (key: string): Promise<{ 
    success: boolean; 
    data: {
      key: string;
      value: string;
      description?: string;
      configType: string;
      isPublic: boolean;
    } 
  }> => {
    return apiClient.get(`/config/${encodeURIComponent(key)}`);
  },

  updateConfig: async (key: string, data: { 
    value: string; 
    description?: string; 
    configType?: string; 
    isPublic?: boolean 
  }): Promise<{ success: boolean; message: string }> => {
    return apiClient.put(`/config/${encodeURIComponent(key)}`, data);
  },

  deleteConfig: async (key: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/config/${encodeURIComponent(key)}`);
  },
};

export const cacheApi = {
  getSearchCache: async (keyword: string): Promise<{ 
    success: boolean; 
    data: {
      keyword: string;
      results: unknown[];
      cachedAt: string;
      expiresAt: string;
    } | null 
  }> => {
    return apiClient.get(`/cache/search?keyword=${encodeURIComponent(keyword)}`);
  },

  setSearchCache: async (data: { 
    keyword: string; 
    results: unknown[]; 
    ttlMinutes?: number 
  }): Promise<{ success: boolean; message: string }> => {
    return apiClient.post('/cache/search', data);
  },

  cleanupCache: async (): Promise<{ success: boolean; data: { deletedCount: number } }> => {
    return apiClient.post('/cache/cleanup', {});
  },

  clearAllCache: async (): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete('/cache/all');
  },
};
