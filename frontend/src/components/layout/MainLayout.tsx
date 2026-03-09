import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Search, User, Moon, Sun, Menu, X } from 'lucide-react';
import { useAuthStore, useThemeStore, useUIStore } from '@/stores';
import { Button } from '@/components/ui';

export const MainLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-primary-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <header className="sticky top-0 z-40 glass border-b border-surface-200/50 dark:border-surface-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2 group">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center shadow-glow group-hover:shadow-glow-accent transition-shadow">
                  <Search className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text hidden sm:block">
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

            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
                aria-label="切换主题"
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5" />
                ) : theme === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/main')}
                    leftIcon={<User className="w-4 h-4" />}
                  >
                    {user?.username}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/login')}
                  >
                    登录
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/register')}
                  >
                    注册
                  </Button>
                </div>
              )}

              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 rounded-lg text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 transition-colors"
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
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-surface-200 dark:border-surface-800 bg-white/50 dark:bg-surface-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
                <Search className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-surface-700 dark:text-surface-300">
                磁力快搜
              </span>
            </div>
            <p className="text-sm text-surface-500 dark:text-surface-400">
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
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        'text-surface-600 hover:text-surface-900 hover:bg-surface-100',
        'dark:text-surface-400 dark:hover:text-surface-100 dark:hover:bg-surface-800'
      )}
    >
      {children}
    </Link>
  );
};
