import React from 'react';
import { Zap, Database, Settings, Globe, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsPanelProps {
  isAdmin: boolean;
  communityEnabled: boolean;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ isAdmin, communityEnabled }) => {
  const navigate = useNavigate();
  return (
    <div className="bg-white dark:bg-surface-900/80 rounded-2xl shadow-lg border border-surface-200/60 dark:border-surface-700/60 p-4 sm:p-5 backdrop-blur-sm animate-fade-in" style={{ animationDelay: '250ms' }}>
      <div className="flex items-center gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Zap className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="font-semibold text-surface-900 dark:text-surface-100 text-sm sm:text-base lg:text-lg">快捷操作</span>
      </div>
      <div className="space-y-2 sm:space-y-2.5">
        <button
          onClick={() => navigate('/dashboard/sources')}
          className="w-full flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left active:scale-[0.99]"
        >
          <Database className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-surface-400" />管理搜索源
        </button>
        <button
          onClick={() => navigate('/dashboard/settings')}
          className="w-full flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-surface-50 dark:hover:bg-surface-800/60 hover:border-primary-200 dark:hover:border-primary-800/60 transition-all text-left active:scale-[0.99]"
        >
          <Settings className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-surface-400" />系统设置
        </button>
        {communityEnabled && (
          <button
            onClick={() => navigate('/community')}
            className="w-full flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all text-left active:scale-[0.99]"
          >
            <Globe className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-surface-400" />社区分享
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin-panel')}
            className="w-full flex items-center gap-2.5 sm:gap-3 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-medium text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700/60 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 hover:text-red-700 dark:hover:text-red-400 transition-all text-left active:scale-[0.99]"
          >
            <ShieldAlert className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-surface-400" />管理后台
          </button>
        )}
      </div>
    </div>
  );
};
