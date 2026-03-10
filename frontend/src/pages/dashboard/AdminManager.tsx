import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Users,
  Shield,
  Activity,
  LogIn,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Ban,
  CheckCircle,
  Eye,
  TrendingUp,
  MapPin,
  Monitor,
  Award,
} from 'lucide-react';
import { adminApi } from '@/services/api/admin';
import type { AdminUser, AdminUserDetail, Role } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

type TabType = 'users' | 'activity' | 'logs' | 'roles';

export const AdminManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('users');
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'users' as TabType, label: '用户管理', icon: <Users className="w-4 h-4" /> },
    { id: 'activity' as TabType, label: '活跃度统计', icon: <Activity className="w-4 h-4" /> },
    { id: 'logs' as TabType, label: '登录日志', icon: <LogIn className="w-4 h-4" /> },
    { id: 'roles' as TabType, label: '角色管理', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          管理员面板
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLoading(!loading)}
        >
          <RefreshCw className={clsx('w-4 h-4 mr-2', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'logs' && <LogsTab />}
      {activeTab === 'roles' && <RolesTab />}
    </div>
  );
};

const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getUsers({
        page,
        pageSize: 10,
        search: search || undefined,
        status: statusFilter || undefined,
        roleId: roleFilter || undefined,
      });
      setUsers(result.items);
      setTotalPages(result.totalPages);
    } catch (err) {
      console.error('加载用户列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const result = await adminApi.getRoles();
      setRoles(result);
    } catch (err) {
      console.error('加载角色列表失败:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, [page, statusFilter, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        loadUsers();
      } else {
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleViewDetail = async (userId: string) => {
    try {
      const detail = await adminApi.getUserDetail(userId);
      setSelectedUser(detail);
      setShowDetail(true);
    } catch (err) {
      console.error('获取用户详情失败:', err);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await adminApi.updateUserStatus(userId, !currentStatus);
      loadUsers();
    } catch (err) {
      console.error('更新用户状态失败:', err);
    }
  };

  const handleChangeRole = async (userId: string, roleId: string) => {
    try {
      await adminApi.updateUserRole(userId, roleId);
      loadUsers();
    } catch (err) {
      console.error('更新用户角色失败:', err);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="搜索用户名或邮箱..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        >
          <option value="">全部状态</option>
          <option value="active">已激活</option>
          <option value="inactive">已禁用</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
        >
          <option value="">全部角色</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">用户</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">角色</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">登录次数</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">状态</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">注册时间</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-surface-500">
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-surface-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-surface-900 dark:text-surface-100">
                          {user.username}
                        </div>
                        <div className="text-xs text-surface-500">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleChangeRole(user.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded border border-surface-200 dark:border-surface-600 bg-transparent"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.displayName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-surface-500">
                      {user.loginCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          user.isActive
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                            : 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                        )}
                      >
                        {user.isActive ? '已激活' : '已禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-500">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetail(user.id)}
                          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 hover:text-primary-600"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.isActive)}
                          className={clsx(
                            'p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700',
                            user.isActive
                              ? 'text-surface-500 hover:text-error-600'
                              : 'text-surface-500 hover:text-success-600'
                          )}
                          title={user.isActive ? '禁用用户' : '启用用户'}
                        >
                          {user.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
            <div className="text-sm text-surface-500">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} title="用户详情">
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-surface-500">用户名</label>
                <div className="font-medium">{selectedUser.username}</div>
              </div>
              <div>
                <label className="text-xs text-surface-500">邮箱</label>
                <div className="font-medium">{selectedUser.email}</div>
              </div>
              <div>
                <label className="text-xs text-surface-500">角色</label>
                <div className="font-medium">{selectedUser.roleDisplayName}</div>
              </div>
              <div>
                <label className="text-xs text-surface-500">状态</label>
                <span
                  className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    selectedUser.isActive
                      ? 'bg-success-100 text-success-700'
                      : 'bg-error-100 text-error-700'
                  )}
                >
                  {selectedUser.isActive ? '已激活' : '已禁用'}
                </span>
              </div>
            </div>

            <div className="border-t border-surface-200 dark:border-surface-700 pt-4">
              <h4 className="font-medium mb-3">统计数据</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center">
                  <LogIn className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <div className="text-2xl font-bold">{selectedUser.stats.totalLoginCount}</div>
                  <div className="text-xs text-surface-500">登录次数</div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center">
                  <Search className="w-5 h-5 mx-auto mb-1 text-green-500" />
                  <div className="text-2xl font-bold">{selectedUser.stats.totalSearchCount}</div>
                  <div className="text-xs text-surface-500">搜索次数</div>
                </div>
                <div className="bg-surface-50 dark:bg-surface-900 rounded-lg p-3 text-center">
                  <Award className="w-5 h-5 mx-auto mb-1 text-primary-500" />
                  <div className="text-2xl font-bold">{selectedUser.stats.activeSessions}</div>
                  <div className="text-xs text-surface-500">活跃会话</div>
                </div>
              </div>
            </div>

            <div className="border-t border-surface-200 dark:border-surface-700 pt-4">
              <h4 className="font-medium mb-3">最近会话</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedUser.recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between text-sm p-2 bg-surface-50 dark:bg-surface-900 rounded">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-surface-400" />
                      <span>{session.ip_address || '未知IP'}</span>
                    </div>
                    <div className="text-surface-500">
                      {formatDate(session.last_activity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const ActivityTab: React.FC = () => {
  const [activeUsers, setActiveUsers] = useState<AdminUser[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const result = await adminApi.getActiveUsers({ limit: 20, days });
        setActiveUsers(result);
      } catch (err) {
        console.error('加载活跃用户失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">活跃用户排行</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setDays(7)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              days === 7
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800'
            )}
          >
            近7天
          </button>
          <button
            onClick={() => setDays(30)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              days === 30
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800'
            )}
          >
            近30天
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <div className="text-center py-8 text-surface-500">加载中...</div>
        ) : activeUsers.length === 0 ? (
          <div className="text-center py-8 text-surface-500">暂无数据</div>
        ) : (
          activeUsers.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center gap-4 p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700"
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                  index === 0
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : index === 1
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400'
                    : index === 2
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
                )}
              >
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium text-surface-900 dark:text-surface-100">
                  {user.username}
                </div>
                <div className="text-xs text-surface-500">{user.email}</div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="font-bold text-surface-900 dark:text-surface-100">
                    {user.totalLoginCount}
                  </div>
                  <div className="text-xs text-surface-500">总登录</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-primary-600 dark:text-primary-400">
                    {user.recentLogins || 0}
                  </div>
                  <div className="text-xs text-surface-500">近期登录</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-surface-900 dark:text-surface-100">
                    {user.recentSearches || 0}
                  </div>
                  <div className="text-xs text-surface-500">近期搜索</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const LogsTab: React.FC = () => {
  const [logs, setLogs] = useState<Array<{
    id: string;
    loginTime: number;
    ipAddress: string | null;
    userAgent: string | null;
    loginStatus: string;
    loginMethod: string;
    failureReason: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const result = await adminApi.getLogs({ page, pageSize: 20 });
        setLogs(result.items as unknown as typeof logs);
        setTotalPages(result.totalPages);
      } catch (err) {
        console.error('加载日志失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, [page]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-900">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">时间</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">IP地址</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">状态</th>
                <th className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">设备信息</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-surface-500">
                    加载中...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-surface-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50">
                    <td className="px-4 py-3 text-surface-500">
                      {formatDate(log.loginTime)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-surface-400" />
                        <span>{log.ipAddress || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                          log.loginStatus === 'success'
                            ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400'
                            : 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                        )}
                      >
                        {log.loginStatus === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-500">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-3 h-3 text-surface-400" />
                        <span className="truncate max-w-[200px]">{log.userAgent || '-'}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
            <div className="text-sm text-surface-500">
              第 {page} / {totalPages} 页
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const RolesTab: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoles = async () => {
      setLoading(true);
      try {
        const result = await adminApi.getRoles();
        setRoles(result);
      } catch (err) {
        console.error('加载角色失败:', err);
      } finally {
        setLoading(false);
      }
    };
    loadRoles();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-8 text-surface-500">加载中...</div>
        ) : (
          roles.map((role) => (
            <div
              key={role.id}
              className="p-4 bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary-500" />
                  <span className="font-semibold text-surface-900 dark:text-surface-100">
                    {role.displayName}
                  </span>
                  {role.isSystem && (
                    <span className="px-2 py-0.5 text-xs bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400 rounded">
                      系统内置
                    </span>
                  )}
                </div>
                <span className="text-xs text-surface-500">优先级: {role.priority}</span>
              </div>
              <p className="text-sm text-surface-600 dark:text-surface-400 mb-3">
                {role.description || '暂无描述'}
              </p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((perm, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 rounded"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
