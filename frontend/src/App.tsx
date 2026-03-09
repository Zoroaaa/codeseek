import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '@/stores';
import { apiClient } from '@/services/api';
import { MainLayout } from '@/components/layout/MainLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { HomePage } from '@/pages/HomePage';
import { MainSearchPage } from '@/pages/MainSearchPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';

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
      // 等待 zustand persist rehydrate 完成
      const currentToken = useAuthStore.getState().token;
      if (currentToken) {
        try {
          apiClient.setToken(currentToken);
          const user = await apiClient.get('/auth/me');
          setUser(user as import('@/types').User);
        } catch {
          logout();
        }
      } else {
        setLoading(false);
      }
    };

    // 订阅 store，等待 token rehydrate 后再执行
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      initAuth();
    });

    // 如果已经 hydrated（比如同步存储），直接执行
    if (useAuthStore.persist.hasHydrated()) {
      initAuth();
      unsub();
    }

    return () => {
      unsub();
    };
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
          <Route path="sources" element={<DashboardPage />} />
          <Route path="categories" element={<DashboardPage />} />
          <Route path="community" element={<DashboardPage />} />
          <Route path="favorites" element={<DashboardPage />} />
          <Route path="history" element={<DashboardPage />} />
          <Route path="settings" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
