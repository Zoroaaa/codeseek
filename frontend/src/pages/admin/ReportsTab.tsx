import React, { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import { RefreshCw, Bell, Heart, MessageSquare, Download, AlertTriangle, Inbox } from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Pagination, TableWrapper } from './shared';

interface Notification {
  id: string;
  type: 'like' | 'review' | 'download' | 'report_resolved';
  sourceId: string;
  sourceName: string;
  actorName: string;
  content: string;
  rating?: number;
  createdAt: number;
}

const TYPE_CONFIG = {
  like: { icon: Heart, label: '点赞', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  review: { icon: MessageSquare, label: '评价', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  download: { icon: Download, label: '导入', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  report_resolved: { icon: AlertTriangle, label: '举报处理', color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20' },
};

export const ReportsTab: React.FC = () => {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const formatDate = (timestamp: number | null | undefined) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<any>(`/community/notifications?page=${page}&pageSize=20`);
      if (response.data) {
        let items: Notification[] = response.data.items || [];
        if (typeFilter) {
          items = items.filter((n: Notification) => n.type === typeFilter);
        }
        setNotifications(items);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch {
      toast.error('加载通知失败');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const filteredNotifications = typeFilter
    ? notifications.filter(n => n.type === typeFilter)
    : notifications;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-surface-900 dark:text-surface-100">消息通知</h3>
          <span className="text-sm text-surface-500">（接收你分享搜索源的互动消息）</span>
        </div>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-sm"
          >
            <option value="">全部消息</option>
            <option value="like">点赞</option>
            <option value="review">评价</option>
            <option value="download">导入</option>
            <option value="report_resolved">举报处理</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadNotifications}>
            <RefreshCw className="w-4 h-4 mr-2" />刷新
          </Button>
        </div>
      </div>

      <TableWrapper>
        <table className="w-full text-sm">
          <thead className="bg-surface-50 dark:bg-surface-900">
            <tr>
              {['类型', '来源', '消息内容', '时间'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium text-surface-600 dark:text-surface-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-surface-500">加载中...</td></tr>
            ) : filteredNotifications.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <Inbox className="w-12 h-12 text-surface-300" />
                    <p className="text-surface-500">暂无消息通知</p>
                    <p className="text-xs text-surface-400">当有人点赞、评价、导入你分享的搜索源时，会在这里显示</p>
                  </div>
                </td>
              </tr>
            ) : filteredNotifications.map((n: Notification) => {
              const config = TYPE_CONFIG[n.type];
              const Icon = config.icon;
              return (
                <tr key={n.id} className="hover:bg-surface-50 dark:hover:bg-surface-700/50">
                  <td className="px-4 py-3">
                    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', config.color)}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-surface-900 dark:text-surface-100 text-sm">{n.actorName}</div>
                    <div className="text-xs text-surface-400 mt-0.5">来源：{n.sourceName}</div>
                  </td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400 text-sm max-w-xs">
                    <span className="font-medium text-surface-800 dark:text-surface-200">{n.actorName}</span>
                    {' '}{n.content}
                  </td>
                  <td className="px-4 py-3 text-surface-500 text-xs whitespace-nowrap">{formatDate(n.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </TableWrapper>
    </div>
  );
};
