import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '@/stores';
import { apiClient } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AdminPanelLayout } from '@/components/layout/AdminPanelLayout';
import { CommunityPanelLayout } from '@/components/layout/CommunityPanelLayout';
import { ToastContainer } from '@/components/ui/Toast';
import { HomePage } from '@/pages/HomePage';
import { MainSearchPage } from '@/pages/MainSearchPage';
import { DashboardPage, UserActivitiesPage } from '@/pages/dashboard';
import { AdminManager, AdminPanelOverview } from '@/pages/admin';
import { CommunityManager } from '@/pages/community';
import { LoginPage, RegisterPage, ForgotPasswordPage } from '@/pages/auth';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/main" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  const { setUser, setLoading, logout } = useAuthStore();
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    // 订阅 token 变化，同步到 apiClient
    const unsub = useAuthStore.subscribe((state) => {
      apiClient.setToken(state.token);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const initAuth = async () => {
      // 直接从 localStorage 读取 token，绕过 zustand persist 的异步 hydration 时序问题
      let token: string | null = null;
      try {
        const stored = localStorage.getItem('auth-storage');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.state?.token || null;
        }
      } catch {
        token = null;
      }

      if (token) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ success: boolean; data: import('@/types').User }>('/auth/me');
          if (response.success && response.data) {
            setUser(response.data);
          } else {
            logout();
          }
        } catch {
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<AuthRedirect><HomePage /></AuthRedirect>} />
        </Route>
        <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
        <Route path="/register" element={<AuthRedirect><RegisterPage /></AuthRedirect>} />
        <Route path="/forgot-password" element={<AuthRedirect><ForgotPasswordPage /></AuthRedirect>} />
        <Route path="/main" element={<ProtectedRoute><MainSearchPage /></ProtectedRoute>} />
        
        <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="stats" element={<DashboardPage />} />
          <Route path="sources" element={<DashboardPage />} />
          <Route path="categories" element={<DashboardPage />} />
          <Route path="favorites" element={<DashboardPage />} />
          <Route path="history" element={<DashboardPage />} />
          <Route path="settings" element={<DashboardPage />} />
          <Route path="activities" element={<UserActivitiesPage />} />
        </Route>
        
        <Route path="/community" element={<ProtectedRoute><CommunityPanelLayout /></ProtectedRoute>}>
          <Route index element={<CommunityManager />} />
          <Route path="my-shares" element={<CommunityManager />} />
          <Route path="my-favorites" element={<CommunityManager />} />
          <Route path="tags" element={<CommunityManager />} />
          <Route path="trending" element={<CommunityManager />} />
          <Route path="reports" element={<CommunityManager />} />
        </Route>
        
        <Route path="/admin-panel" element={<AdminRoute><AdminPanelLayout /></AdminRoute>}>
          <Route index element={<AdminPanelOverview />} />
          <Route path="users" element={<AdminManager />} />
          <Route path="sessions" element={<AdminManager />} />
          <Route path="actions" element={<AdminManager />} />
          <Route path="analytics" element={<AdminManager />} />
          <Route path="trends" element={<AdminManager />} />
          <Route path="sources" element={<AdminManager />} />
          <Route path="reports" element={<AdminManager />} />
          <Route path="roles" element={<AdminManager />} />
          <Route path="config" element={<AdminManager />} />
        </Route>
        
        <Route path="/admin" element={<AdminRoute><DashboardLayout /></AdminRoute>}>
          <Route index element={<AdminManager />} />
        </Route>
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
};

export default App;
