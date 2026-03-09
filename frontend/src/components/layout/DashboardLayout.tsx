import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Database,
  FolderTree,
  Users,
  Heart,
  History,
  Settings,
  Moon,
  Sun,
  Menu,
  LogOut,
  Search,
  ChevronLeft,
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '@/stores';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
}

const navItems: NavItem[] = [
  { id: 'overview', label: '概览', icon: <LayoutDashboard className="w-5 h-5" />, path: '/dashboard' },
  { id: 'sources', label: '搜索源管理', icon: <Database className="w-5 h-5" />, path: '/dashboard/sources' },
  { id: 'categories', label: '分类管理', icon: <FolderTree className="w-5 h-5" />, path: '/dashboard/categories' },
  { id: 'community', label: '社区管理', icon: <Users className="w-5 h-5" />, path: '/dashboard/community' },
  { id: 'favorites', label: '我的收藏', icon: <Heart className="w-5 h-5" />, path: '/dashboard/favorites' },
  { id: 'history', label: '搜索历史', icon: <History className="w-5 h-5" />, path: '/dashboard/history' },
  { id: 'settings', label: '系统设置', icon: <Settings className="w-5 h-5" />, path: '/dashboard/settings' },
];

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme, sidebarCollapsed, toggleSidebar } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex flex-col',
          'bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800',
          'transition-all duration-300 ease-in-out',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200 dark:border-surface-800">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold gradient-text">磁力快搜</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className={clsx(
              'p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100',
              'dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-colors',
              sidebarCollapsed && 'mx-auto'
            )}
          >
            {sidebarCollapsed ? (
              <Menu className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                    'group relative',
                    isActive(item.path)
                      ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
                  )}
                >
                  <span
                    className={clsx(
                      'flex-shrink-0',
                      isActive(item.path)
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300'
                    )}
                  >
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <>
                      <span className="font-medium">{item.label}</span>
                      {item.badge && (
                        <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isActive(item.path) && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-surface-200 dark:border-surface-800">
          <div
            className={clsx(
              'flex items-center gap-3',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-semibold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                  {user?.email}
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                title="退出登录"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      <div
        className={clsx(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        )}
      >
        <header className="sticky top-0 z-30 h-16 bg-white/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-800">
          <div className="flex items-center justify-between h-full px-6">
            <h1 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
              {navItems.find((item) => isActive(item.path))?.label || '控制台'}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
