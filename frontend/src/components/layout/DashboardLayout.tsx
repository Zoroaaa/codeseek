import React, { useState } from 'react';
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
  BarChart2,
  Shield,
  X,
} from 'lucide-react';
import { useAuthStore, useThemeStore } from '@/stores';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  group?: string;
  adminOnly?: boolean;
}

const navGroups = ['个人中心', '资源管理', '社区', '设置', '管理员'];

const navItems: NavItem[] = [
  { id: 'overview',    label: '概览',       icon: <LayoutDashboard className="w-5 h-5" />, path: '/dashboard',            group: '个人中心' },
  { id: 'stats',       label: '数据统计',   icon: <BarChart2 className="w-5 h-5" />,       path: '/dashboard/stats',      group: '个人中心' },
  { id: 'favorites',   label: '我的收藏',   icon: <Heart className="w-5 h-5" />,           path: '/dashboard/favorites',  group: '个人中心' },
  { id: 'history',     label: '搜索历史',   icon: <History className="w-5 h-5" />,         path: '/dashboard/history',    group: '个人中心' },
  { id: 'sources',     label: '搜索源管理', icon: <Database className="w-5 h-5" />,        path: '/dashboard/sources',    group: '资源管理' },
  { id: 'community',   label: '社区管理',   icon: <Users className="w-5 h-5" />,           path: '/dashboard/community',  group: '社区' },
  { id: 'settings',    label: '系统设置',   icon: <Settings className="w-5 h-5" />,        path: '/dashboard/settings',   group: '设置' },
  { id: 'categories',  label: '分类管理',   icon: <FolderTree className="w-5 h-5" />,      path: '/dashboard/categories', group: '管理员', adminOnly: true },
  { id: 'admin',       label: '管理员面板', icon: <Shield className="w-5 h-5" />,          path: '/admin',                group: '管理员', adminOnly: true },
];

export const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme, sidebarCollapsed, toggleSidebar } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/admin') {
      return location.pathname.startsWith('/admin');
    }
    return location.pathname.startsWith(path);
  };

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);
  const filteredNavGroups = navGroups.filter(group => {
    const groupItems = filteredNavItems.filter(i => i.group === group);
    return groupItems.length > 0;
  });

  const currentPageLabel = filteredNavItems.find((item) => isActive(item.path))?.label || '控制台';

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const renderNavItem = (item: NavItem, isMobile: boolean = false) => {
    const active = isActive(item.path);

    if (isMobile) {
      return (
        <li key={item.id}>
          <button
            onClick={() => handleNavClick(item.path)}
            className={clsx(
              'sidebar-nav-item w-full',
              active && 'active'
            )}
          >
            <span
              className={clsx(
                'flex-shrink-0',
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300'
              )}
            >
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
            {item.badge && (
              <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        </li>
      );
    }

    return (
      <li key={item.id}>
        <Link
          to={item.path}
          className={clsx(
            'sidebar-nav-item',
            active && 'active'
          )}
        >
          <span
            className={clsx(
              'flex-shrink-0',
              active
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
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
          )}
          {sidebarCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-surface-900 dark:bg-surface-100 text-surface-100 dark:text-surface-900 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
              {item.label}
            </div>
          )}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'dashboard-sidebar hidden lg:flex',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200 dark:border-surface-800">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-all">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">磁力快搜</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className={clsx(
              'p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100',
              'dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-all',
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
          {filteredNavGroups.map((group) => {
            const groupItems = filteredNavItems.filter(i => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-4">
                {!sidebarCollapsed && (
                  <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                    {group}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {groupItems.map((item) => renderNavItem(item))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-200 dark:border-surface-800">
          <div
            className={clsx(
              'flex items-center gap-3',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {user?.username}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                    {user?.roleDisplayName || user?.email}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all"
                  title="退出登录"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-surface-950/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 lg:hidden',
          'bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800',
          'transform transition-transform duration-300 ease-out',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200 dark:border-surface-800">
          <Link to="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">磁力快搜</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin max-h-[calc(100vh-8rem)]">
          {filteredNavGroups.map((group) => {
            const groupItems = filteredNavItems.filter(i => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-4">
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {groupItems.map((item) => renderNavItem(item, true))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
          <div className="flex items-center gap-3">
            <div className="user-avatar">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                {user?.roleDisplayName || user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all"
              title="退出登录"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={clsx(
          'flex-1 flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <header className="dashboard-header">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-all"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-surface-100">
                {currentPageLabel}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                to="/main" 
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white hover:from-primary-600 hover:to-accent-600 shadow-md shadow-primary-500/20 transition-all"
              >
                <Search className="w-4 h-4" />
                搜索
              </Link>
              <button
                onClick={toggleTheme}
                className="theme-toggle-btn"
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

        <main className="dashboard-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
