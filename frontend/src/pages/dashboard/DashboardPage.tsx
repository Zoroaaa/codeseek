import React from 'react';
import { useLocation } from 'react-router-dom';
import { OverviewManager } from './OverviewManager';
import { SourceManager } from './SourceManager';
import { CategoryManager } from './CategoryManager';
import { CommunityManager } from './CommunityManager';
import { FavoritesManager, HistoryManager } from './FavoritesHistoryManager';
import { SettingsManager } from './SettingsManager';
import { StatsManager } from './StatsManager';

export const DashboardPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/dashboard' || path === '/dashboard/') {
    return <OverviewManager />;
  }
  
  if (path.startsWith('/dashboard/stats')) {
    return <StatsManager />;
  }
  
  if (path.startsWith('/dashboard/sources')) {
    return <SourceManager />;
  }
  
  if (path.startsWith('/dashboard/categories')) {
    return <CategoryManager />;
  }
  
  if (path.startsWith('/dashboard/community')) {
    return <CommunityManager />;
  }
  
  if (path.startsWith('/dashboard/favorites')) {
    return <FavoritesManager />;
  }
  
  if (path.startsWith('/dashboard/history')) {
    return <HistoryManager />;
  }
  
  if (path.startsWith('/dashboard/settings')) {
    return <SettingsManager />;
  }

  return <OverviewManager />;
};
