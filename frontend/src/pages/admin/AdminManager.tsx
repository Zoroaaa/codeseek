import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Users, Shield, Activity, Server, BarChart2, TrendingUp, AlertTriangle, Trash2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { UsersTab } from './UsersTab';
import { SessionsTab } from './SessionsTab';
import { ActionsTab } from './ActionsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { TrendsTab } from './TrendsTab';
import { ReportsTab } from './ReportsTab';
import { RolesTab } from './RolesTab';
import { CleanupTab } from './CleanupTab';

type TabType = 'users' | 'sessions' | 'actions' | 'analytics' | 'trends' | 'reports' | 'roles' | 'cleanup';

export const AdminManager: React.FC = () => {
  const location = useLocation();

  const getTabFromPath = (): TabType => {
    const p = location.pathname;
    if (p.includes('/sessions')) return 'sessions';
    if (p.includes('/actions')) return 'actions';
    if (p.includes('/analytics')) return 'analytics';
    if (p.includes('/trends')) return 'trends';
    if (p.includes('/reports')) return 'reports';
    if (p.includes('/roles')) return 'roles';
    if (p.includes('/config')) return 'cleanup';
    return 'users';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getTabFromPath);
  useEffect(() => { setActiveTab(getTabFromPath()); }, [location.pathname]);

  const tabs = [
    { id: 'users' as TabType, label: '用户管理', icon: <Users className="w-4 h-4" /> },
    { id: 'sessions' as TabType, label: '会话管理', icon: <Server className="w-4 h-4" /> },
    { id: 'actions' as TabType, label: '行为日志', icon: <Activity className="w-4 h-4" /> },
    { id: 'analytics' as TabType, label: '数据分析', icon: <BarChart2 className="w-4 h-4" /> },
    { id: 'trends' as TabType, label: '趋势报表', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'reports' as TabType, label: '举报处理', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'roles' as TabType, label: '角色管理', icon: <Shield className="w-4 h-4" /> },
    { id: 'cleanup' as TabType, label: '数据清理', icon: <Trash2 className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">管理员面板</h2>
      <div className="flex gap-1 flex-wrap border-b border-surface-200 dark:border-surface-700 pb-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={clsx(
            'flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap',
            activeTab === tab.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 border-b-2 border-primary-500' : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
          )}>
            {tab.icon}<span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'sessions' && <SessionsTab />}
      {activeTab === 'actions' && <ActionsTab />}
      {activeTab === 'analytics' && <AnalyticsTab />}
      {activeTab === 'trends' && <TrendsTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'roles' && <RolesTab />}
      {activeTab === 'cleanup' && <CleanupTab />}
    </div>
  );
};
