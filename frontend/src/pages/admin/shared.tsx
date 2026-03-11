import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';

export const formatDate = (timestamp: number | null | undefined) => {
  if (!timestamp) return '-';
  return new Date(timestamp).toLocaleString('zh-CN');
};

export const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}分钟前`;
  if (h < 24) return `${h}小时前`;
  return `${d}天前`;
};

export const actionLabels: Record<string, string> = {
  login: '登录成功', login_failed: '登录失败', logout: '登出',
  search: '搜索', add_favorite: '添加收藏', remove_favorite: '取消收藏',
  sync_favorites: '同步收藏', update_settings: '更新设置', change_password: '修改密码',
  change_email: '修改邮箱', delete_account: '删除账户', clear_search_history: '清空历史',
  share_source: '分享搜索源', review_source: '评价搜索源', report_source: '举报搜索源',
  admin_update_user_status: '更新用户状态', admin_update_user_role: '更新用户角色',
  admin_update_user_permissions: '更新用户权限', admin_terminate_session: '终止会话',
  admin_cleanup: '清理数据', admin_handle_report: '处理举报',
};

export const actionColors: Record<string, string> = {
  login: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  login_failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  logout: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  search: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  add_favorite: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  share_source: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  admin_update_user_status: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  admin_update_user_role: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export const Pagination: React.FC<{ page: number; totalPages: number; onPageChange: (p: number) => void }> = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-200 dark:border-surface-700">
      <div className="text-sm text-surface-500">第 {page} / {totalPages} 页</div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

export const TableWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
    <div className="overflow-x-auto">{children}</div>
  </div>
);
