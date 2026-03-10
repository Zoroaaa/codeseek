import React, { useState, useEffect } from 'react';
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
  ChevronRight,
  BarChart2,
  Shield,
  X,
  Home,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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

  const currentPageTitle = filteredNavItems.find((item) => isActive(item.path))?.label || '控制台';

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col fixed inset-y-0 left-0 z-50',
          'bg-white dark:bg-surface-900 border-r border-surface-200/50 dark:border-surface-800/50',
          'transition-all duration-300 ease-snappy',
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200/50 dark:border-surface-800/50">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-md shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold gradient-text tracking-tight">磁力快搜</span>
            </Link>
          )}
          <button
            onClick={toggleSidebar}
            className={clsx(
              'p-2 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100',
              'dark:hover:text-surface-300 dark:hover:bg-surface-800 transition-all duration-200',
              sidebarCollapsed && 'mx-auto'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
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
                  <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.path}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ease-snappy',
                          'group relative',
                          isActive(item.path)
                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                            : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800'
                        )}
                      >
                        <span
                          className={clsx(
                            'flex-shrink-0 transition-colors duration-200',
                            isActive(item.path)
                              ? 'text-primary-600 dark:text-primary-400'
                              : 'text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300'
                          )}
                        >
                          {item.icon}
                        </span>
                        {!sidebarCollapsed && (
                          <>
                            <span className="font-medium text-sm">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {isActive(item.path) && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                        )}
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2 px-2 py-1.5 bg-surface-900 dark:bg-surface-100 text-surface-100 dark:text-surface-900 text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                            {item.label}
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-200/50 dark:border-surface-800/50">
          <div
            className={clsx(
              'flex items-center gap-3',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold shadow-md">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                  {user?.username}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                  {user?.roleDisplayName || user?.email}
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <button
                onClick={handleLogout}
                className="p-2 rounded-xl text-surface-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-all duration-200"
                title="退出登录"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-surface-900/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={clsx(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]',
          'bg-white dark:bg-surface-900 shadow-soft-xl',
          'transform transition-transform duration-300 ease-snappy',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-surface-200/50 dark:border-surface-800/50">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center shadow-md">
              <Search className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold gradient-text">磁力快搜</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 overflow-y-auto scrollbar-thin max-h-[calc(100vh-180px)]">
          {filteredNavGroups.map((group) => {
            const groupItems = filteredNavItems.filter(i => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div key={group} className="mb-4">
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-surface-400 dark:text-surface-500">
                  {group}
                </p>
                <ul className="space-y-1">
                  {groupItems.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200',
                          isActive(item.path)
                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                            : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800'
                        )}
                      >
                        <span className={isActive(item.path) ? 'text-primary-600 dark:text-primary-400' : 'text-surface-400'}>
                          {item.icon}
                        </span>
                        <span className="font-medium">{item.label}</span>
                        {isActive(item.path) && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-surface-200/50 dark:border-surface-800/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400 truncate">
                {user?.roleDisplayName || user?.email}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800 transition-colors"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span className="text-sm">{resolvedTheme === 'dark' ? '浅色' : '深色'}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">退出</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={clsx(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-14 sm:h-16 glass-nav">
          <div className="flex items-center justify-between h-full px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-semibold text-surface-900 dark:text-surface-100 truncate">
                {currentPageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/main"
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                <span>主页</span>
              </Link>
              <button
                onClick={toggleTheme}
                className="hidden sm:flex p-2.5 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
