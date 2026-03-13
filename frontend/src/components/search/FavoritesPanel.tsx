import React from 'react';
import { Heart, Download, Trash2, ExternalLink, Tag, ChevronDown, ChevronRight } from 'lucide-react';
import { Loading } from '@/components/ui';
import { convertToProxyUrl } from '@/services/proxy/ProxyService';
import type { FavoriteItem } from '@/types';

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  isLoading: boolean;
  show: boolean;
  isProxyEnabled: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
  onExport: () => void;
}

export const FavoritesPanel: React.FC<FavoritesPanelProps> = ({
  favorites, isLoading, show, isProxyEnabled, onToggle, onRemove, onExport,
}) => (
  <div className="collapsible-section flex-1 flex flex-col animate-fade-in min-h-0" style={{ animationDelay: '150ms' }}>
    <button onClick={onToggle} className="collapsible-header shrink-0">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400" />
        </div>
        <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base">我的收藏</span>
        {favorites.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 rounded-full">
            {favorites.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {show && favorites.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 transition-all"
            title="导出收藏"
          >
            <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
        {show ? <ChevronDown className="w-4 h-4 text-surface-400" /> : <ChevronRight className="w-4 h-4 text-surface-400" />}
      </div>
    </button>
    {show && (
      <div className="collapsible-content flex-1 flex flex-col overflow-hidden min-h-0">
        {isLoading ? (
          <div className="p-6 sm:p-8 flex justify-center"><Loading /></div>
        ) : favorites.length > 0 ? (
          <div className="p-3 sm:p-4 flex-1 overflow-y-auto scrollbar-thin min-h-0">
            <div className="space-y-1.5 sm:space-y-2">
              {favorites.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-all border border-surface-100 dark:border-surface-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{item.title}</p>
                    {item.subtitle && <p className="text-[10px] sm:text-xs text-surface-400 truncate mt-0.5">{item.subtitle}</p>}
                    {item.keyword && (
                      <div className="flex items-center gap-1 mt-1">
                        <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary-400 flex-shrink-0" />
                        <span className="text-[10px] sm:text-xs text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded truncate max-w-[100px] sm:max-w-[120px]">
                          {item.keyword}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 sm:gap-1 ml-2 shrink-0">
                    <button
                      onClick={() => window.open(isProxyEnabled ? convertToProxyUrl(item.url) : item.url, '_blank')}
                      className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all"
                    >
                      <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="p-1 sm:p-1.5 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all"
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="px-4 sm:px-5 py-6 sm:py-8 text-center flex-1 flex flex-col items-center justify-center">
            <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-surface-300 dark:text-surface-600 mx-auto mb-2" />
            <p className="text-xs sm:text-sm text-surface-400">暂无收藏内容</p>
          </div>
        )}
      </div>
    )}
  </div>
);
