import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Search, User, Moon, Sun, Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuthStore, useThemeStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6 lg:gap-8">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-glow group-hover:shadow-glow-accent transition-all duration-300 group-hover:scale-105">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text hidden sm:block tracking-tight">
                  磁力快搜
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {isAuthenticated ? (
                  <>
                    <NavLink to="/main">主页</NavLink>
                    <NavLink to="/dashboard">控制台</NavLink>
                  </>
                ) : (
                  <>
                    <NavLink to="/">首页</NavLink>
                  </>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-all duration-200"
                aria-label="切换主题"
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/main')}
                    leftIcon={<User className="w-4 h-4" />}
                    className="hidden sm:inline-flex"
                  >
                    {user?.username}
                  </Button>
                  <div className="sm:hidden flex items-center gap-1">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white text-sm font-bold">
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/login')}
                    className="hidden sm:inline-flex"
                  >
                    登录
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/register')}
                  >
                    <span className="hidden sm:inline">注册</span>
                    <span className="sm:hidden">登录</span>
                  </Button>
                </div>
              )}

              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2.5 rounded-xl text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-all duration-200"
              >
                {isSidebarOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {isSidebarOpen && (
          <div className="md:hidden border-t border-surface-200/50 dark:border-surface-700/50 bg-white/95 dark:bg-surface-900/95 backdrop-blur-xl animate-slide-down">
            <nav className="px-4 py-3 space-y-1">
              {isAuthenticated ? (
                <>
                  <MobileNavLink to="/main" onClick={() => setSidebarOpen(false)}>
                    <Search className="w-5 h-5" />
                    主页
                  </MobileNavLink>
                  <MobileNavLink to="/dashboard" onClick={() => setSidebarOpen(false)}>
                    <LayoutDashboard className="w-5 h-5" />
                    控制台
                  </MobileNavLink>
                  <div className="pt-2 border-t border-surface-200 dark:border-surface-700 mt-2">
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white font-bold">
                        {user?.username?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-surface-900 dark:text-surface-100">{user?.username}</p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">{user?.email}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <MobileNavLink to="/" onClick={() => setSidebarOpen(false)}>
                    首页
                  </MobileNavLink>
                  <div className="pt-2 border-t border-surface-200 dark:border-surface-700 mt-2 space-y-2">
                    <Button variant="outline" fullWidth onClick={() => { navigate('/login'); setSidebarOpen(false); }}>
                      登录
                    </Button>
                    <Button variant="primary" fullWidth onClick={() => { navigate('/register'); setSidebarOpen(false); }}>
                      免费注册
                    </Button>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-surface-200/50 dark:border-surface-800/50 bg-white/50 dark:bg-surface-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-surface-700 dark:text-surface-300">
                磁力快搜
              </span>
            </div>
            <p className="text-sm text-surface-500 dark:text-surface-400 text-center">
              © {new Date().getFullYear()} 磁力快搜. 保留所有权利.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

const NavLink: React.FC<NavLinkProps> = ({ to, children }) => {
  return (
    <Link
      to={to}
      className={clsx(
        'px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200',
        'text-surface-600 hover:text-surface-900 hover:bg-surface-100',
        'dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800'
      )}
    >
      {children}
    </Link>
  );
};

interface MobileNavLinkProps {
  to: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ to, children, onClick }) => {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="mobile-nav-item"
    >
      {children}
    </Link>
  );
};
