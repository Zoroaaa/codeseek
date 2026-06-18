import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Megaphone, ChevronDown, Info, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { announcementApi, type Announcement } from '@/services/api/announcement';
import { JAV_PANEL_HEIGHT, JAV_HEADER_HEIGHT } from '@/components/jav/JavRankingsPanel';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: AlertCircle,
};

const TYPE_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  info:    { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: '信息' },
  warning: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: '注意' },
  success: { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: '好消息' },
  error:   { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: '重要' },
};

// 与 JAV榜单等高
export const PANEL_HEADER_HEIGHT = JAV_HEADER_HEIGHT; // 64

interface AnnouncementPanelProps {
  className?: string;
}

export const AnnouncementPanel: React.FC<AnnouncementPanelProps> = ({ className }) => {
  const [items, setItems] = useState<Announcement[]>([]);
  const [show, setShow] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    announcementApi.getActive().then((data) => {
      setItems(data);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  if (!loaded) return null;
  if (items.length === 0) return null;

  // 固定总高 = JAV榜单高度（与 JavRankingsPanel 并排等高）
  const totalHeight = show ? JAV_PANEL_HEIGHT : PANEL_HEADER_HEIGHT;
  const contentH = totalHeight - PANEL_HEADER_HEIGHT;

  return (
    <div
      className={clsx(
        'collapsible-section animate-fade-in transition-all duration-300 overflow-hidden shrink-0',
        className
      )}
      style={{ animationDelay: '0ms', height: totalHeight }}
    >
      {/* Header */}
      <button
        onClick={() => setShow(!show)}
        className="collapsible-header"
        style={{ height: PANEL_HEADER_HEIGHT }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">网站公告</span>
          <span className="text-[11px] text-surface-400 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
        </div>
        <ChevronDown className={clsx('w-4 h-4 text-surface-400 transition-transform duration-200', show && 'rotate-180')} />
      </button>

      {/* Content */}
      {show && (
        <div className="p-3 space-y-2 overflow-y-auto" style={{ height: contentH }}>
          {items.map((item) => {
            const style = TYPE_STYLE[item.type] || TYPE_STYLE.info;
            const Icon = ICON_MAP[item.type] || Info;
            return (
              <div
                key={item.id}
                className={clsx(
                  'rounded-xl p-3 border transition-colors',
                  style.badge,
                  item.is_pinned === 1 && 'ring-1 ring-inset ring-violet-200 dark:ring-violet-800'
                )}
              >
                <div className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-70" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', style.dot)} />
                      <h4 className="font-medium text-sm truncate">{item.title}</h4>
                      {item.is_pinned === 1 && (
                        <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400">置顶</span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">{item.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
