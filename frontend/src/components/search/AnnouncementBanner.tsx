import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Info, AlertTriangle, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { announcementApi, type Announcement } from '@/services/api/announcement';

const ICON_MAP: Record<string, React.FC<any>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

const STYLE_MAP: Record<string, { border: string; bg: string; iconColor: string; badge: string }> = {
  info: { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50/80 dark:bg-blue-900/15', iconColor: 'text-blue-500', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  warning: { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50/80 dark:bg-amber-900/15', iconColor: 'text-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  success: { border: 'border-green-200 dark:border-green-800', bg: 'bg-green-50/80 dark:bg-green-900/15', iconColor: 'text-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  error: { border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50/80 dark:bg-red-900/15', iconColor: 'text-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

interface AnnouncementBannerProps {
  className?: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({ className }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    announcementApi.getActive().then(setAnnouncements).catch(() => {});
  }, []);

  const visibleItems = announcements.filter((a) => !dismissed.has(a.id));
  if (!visible || visibleItems.length === 0) return null;

  // 只显示第一条，其余可展开查看
  const first = visibleItems[0];
  const rest = visibleItems.slice(1);
  const style = STYLE_MAP[first.type] || STYLE_MAP.info;
  const Icon = ICON_MAP[first.type] || Info;

  return (
    <div className={clsx('w-full', className)}>
      <div className={clsx(
        'rounded-xl border overflow-hidden transition-all duration-300',
        style.border, style.bg
      )}>
        {/* 首条公告 */}
        <div className="flex items-start gap-3 px-4 py-3">
          <Icon className={clsx('w-5 h-5 mt-0.5 flex-shrink-0', style.iconColor)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase', style.badge)}>
                {first.type === 'info' ? '公告' : first.type === 'warning' ? '注意' : first.type === 'success' ? '好消息' : '重要'}
              </span>
              {first.is_pinned === 1 && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">置顶</span>
              )}
              <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{first.title}</h4>
            </div>
            <p className={clsx(
              'text-sm text-slate-600 dark:text-slate-400 leading-relaxed',
              expanded === 0 ? '' : 'line-clamp-1'
            )}>
              {first.content}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {first.content.length > 60 && (
              <button
                onClick={() => setExpanded(expanded === 0 ? null : 0)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <ChevronRight className={clsx('w-4 h-4 transition-transform', expanded === 0 && 'rotate-90')} />
              </button>
            )}
            <button
              onClick={() => { setDismissed(new Set([...dismissed, first.id])); }}
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="关闭此条"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 展开的其余公告 */}
        {expanded === 0 && rest.length > 0 && (
          <div className="border-t border-slate-200/50 dark:border-slate-700/50 divide-y divide-slate-200/50 dark:divide-slate-700/50">
            {rest.map((item) => {
              const s = STYLE_MAP[item.type] || STYLE_MAP.info;
              const Ic = ICON_MAP[item.type] || Info;
              return (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                  <Ic className={clsx('w-4 h-4 mt-0.5 flex-shrink-0', s.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase', s.badge)}>
                        {item.type === 'info' ? '公告' : item.type === 'warning' ? '注意' : item.type === 'success' ? '好消息' : '重要'}
                      </span>
                      <h4 className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{item.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{item.content}</p>
                  </div>
                  <button
                    onClick={() => setDismissed(new Set([...dismissed, item.id]))}
                    className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        /* 展开按钮 */
        {rest.length > 0 && expanded !== 0 && (
          <button
            onClick={() => setExpanded(0)}
            className="w-full flex items-center justify-center gap-1 px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-t border-slate-200/50 dark:border-slate-700/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition-colors"
          >
            还有 {rest.length} 条公告
            <ChevronRight className="w-3 h-3" />
          </button>
        )}

        {/* 全部关闭后隐藏整个 banner */}
        {visibleItems.length > 1 && (
          <button
            onClick={() => setVisible(false)}
            className="w-full text-center text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 border-t border-slate-200/50 dark:border-slate-700/50 transition-colors"
          >
            全部关闭
          </button>
        )}
      </div>
    </div>
  );
};
