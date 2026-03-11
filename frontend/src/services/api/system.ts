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

  batchUpdateConfig: async (configs: Array<{
    key: string;
    value: string;
    description?: string;
    configType?: string;
    isPublic?: boolean;
  }>): Promise<{ 
    success: boolean; 
    data: { 
      results: Array<{ key: string; success: boolean }>;
      updated: number;
    };
    message: string;
  }> => {
    return apiClient.put('/config/batch', { configs });
  },

  getConfigGroups: async (): Promise<{ 
    success: boolean; 
    data: Record<string, Array<{
      key: string;
      value: string;
      description: string | null;
      config_type: string;
      is_public: number;
      created_at: number;
      updated_at: number;
    }>> 
  }> => {
    return apiClient.get('/config/groups');
  },

  resetConfig: async (key: string): Promise<{ 
    success: boolean; 
    data: { key: string; value: string };
    message: string;
  }> => {
    return apiClient.post(`/config/reset/${encodeURIComponent(key)}`, {});
  },
};
