import { apiClient } from './client';
import type { Role, AdminUser, AdminUserDetail, UserLoginLog } from '@/types/auth';

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AdminStats {
  users: {
    total: number;
    active: number;
    verified: number;
    newThisWeek: number;
    dailyActive: number;
  };
  roles: Array<{
    id: string;
    name: string;
    displayName: string;
    userCount: number;
  }>;
  sources: {
    total: number;
    active: number;
    searchable: number;
    totalUsage: number;
  };
  searches: {
    total: number;
    uniqueUsers: number;
    uniqueKeywords: number;
  };
  community: {
    sharedSources: number;
    tags: number;
    reviews: number;
    pendingReports: number;
  };
  topSearchKeywords: Array<{ query: string; count: number }>;
  topUsedSources: Array<{ name: string; usage_count: number }>;
}

interface LoginStats {
  dailyStats: Array<{
    date: string;
    total: number;
    success: number;
    failed: number;
    unique_users: number;
  }>;
  topIPs: Array<{ ip_address: string; count: number }>;
  failedAttempts: Array<{ ip_address: string; count: number }>;
}

export const adminApi = {
  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get<{ success: boolean; data: { roles: Role[] } }>('/admin/roles');
    return response.data.roles;
  },

  getUsers: async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    roleId?: string;
  } = {}): Promise<PaginatedResponse<AdminUser>> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.search) queryParams.set('search', params.search);
    if (params.status) queryParams.set('status', params.status);
    if (params.roleId) queryParams.set('roleId', params.roleId);

    const response = await apiClient.get<{
      success: boolean;
      data: {
        users: AdminUser[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }>(`/admin/users?${queryParams.toString()}`);

    return {
      items: response.data.users,
      total: response.data.total,
      page: response.data.page,
      pageSize: response.data.pageSize,
      totalPages: response.data.totalPages,
    };
  },

  getUserDetail: async (userId: string): Promise<AdminUserDetail> => {
    const response = await apiClient.get<{ success: boolean; data: { user: AdminUserDetail } }>(`/admin/users/${userId}`);
    return response.data.user;
  },

  updateUserStatus: async (userId: string, isActive: boolean, reason?: string): Promise<void> => {
    await apiClient.put(`/admin/users/${userId}/status`, { isActive, reason });
  },

  updateUserRole: async (userId: string, roleId: string): Promise<{ roleId: string; roleName: string }> => {
    const response = await apiClient.put<{ success: boolean; data: { roleId: string; roleName: string } }>(`/admin/users/${userId}/role`, { roleId });
    return response.data;
  },

  updateUserPermissions: async (userId: string, permissions: string[]): Promise<void> => {
    await apiClient.put(`/admin/users/${userId}/permissions`, { permissions });
  },

  getUserLoginLogs: async (userId: string, params: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<UserLoginLog>> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());

    const response = await apiClient.get<{
      success: boolean;
      data: {
        logs: UserLoginLog[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }>(`/admin/users/${userId}/login-logs?${queryParams.toString()}`);

    return {
      items: response.data.logs,
      total: response.data.total,
      page: response.data.page,
      pageSize: response.data.pageSize,
      totalPages: response.data.totalPages,
    };
  },

  getActiveUsers: async (params: {
    limit?: number;
    days?: number;
  } = {}): Promise<AdminUser[]> => {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.days) queryParams.set('days', params.days.toString());

    const response = await apiClient.get<{ success: boolean; data: { users: AdminUser[] } }>(`/admin/active-users?${queryParams.toString()}`);
    return response.data.users;
  },

  getLoginStats: async (days: number = 7): Promise<LoginStats> => {
    const response = await apiClient.get<{ success: boolean; data: LoginStats }>(`/admin/login-stats?days=${days}`);
    return response.data;
  },

  getStats: async (): Promise<AdminStats> => {
    const response = await apiClient.get<{ success: boolean; data: AdminStats }>('/admin/stats');
    return response.data;
  },

  getLogs: async (params: {
    page?: number;
    pageSize?: number;
    userId?: string;
    action?: string;
  } = {}): Promise<PaginatedResponse<{
    id: string;
    user_id: string | null;
    action: string;
    data: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: number;
    username: string | null;
  }>> => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page.toString());
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params.userId) queryParams.set('userId', params.userId);
    if (params.action) queryParams.set('action', params.action);

    const response = await apiClient.get<{
      success: boolean;
      data: {
        logs: Array<{
          id: string;
          user_id: string | null;
          action: string;
          data: string;
          ip_address: string | null;
          user_agent: string | null;
          created_at: number;
          username: string | null;
        }>;
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      };
    }>(`/admin/logs?${queryParams.toString()}`);

    return {
      items: response.data.logs,
      total: response.data.total,
      page: response.data.page,
      pageSize: response.data.pageSize,
      totalPages: response.data.totalPages,
    };
  },

  cleanup: async (): Promise<{
    expiredSessions: number;
    expiredVerifications: number;
    oldPasswordResetLogs: number;
    oldSecurityLockouts: number;
    oldLoginLogs: number;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      data: {
        expiredSessions: number;
        expiredVerifications: number;
        oldPasswordResetLogs: number;
        oldSecurityLockouts: number;
        oldLoginLogs: number;
      };
    }>('/admin/cleanup', {});
    return response.data;
  },
};
