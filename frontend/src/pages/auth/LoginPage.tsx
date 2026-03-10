import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { authApi } from '@/services/api';
import { Button, Input, Card } from '@/components/ui';
import { useNotification } from '@/hooks';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const notification = useNotification();
  
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.identifier.trim()) {
      newErrors.identifier = '请输入用户名或邮箱';
    }
    
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.login({
        identifier: formData.identifier,
        password: formData.password,
      });
      
      if (response.success && response.data) {
        setUser(response.data.user);
        setToken(response.data.token);
        notification.auth.loginSuccess(response.data.user.username);
        navigate('/dashboard');
      } else {
        notification.auth.loginFailed(response.message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '网络错误，请稍后重试';
      notification.auth.loginFailed(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-surface-50 via-white to-primary-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回首页
        </Link>

        <Card className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
              欢迎回来
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              登录您的账号继续使用
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="用户名或邮箱"
              type="text"
              placeholder="请输入用户名或邮箱"
              value={formData.identifier}
              onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
              error={errors.identifier}
              leftIcon={<User className="w-5 h-5" />}
              fullWidth
            />

            <Input
              label="密码"
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入密码"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              error={errors.password}
              leftIcon={<Lock className="w-5 h-5" />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
              fullWidth
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                <input type="checkbox" className="rounded border-surface-300 dark:border-surface-600" />
                记住我
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                忘记密码？
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
            >
              登录
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-surface-600 dark:text-surface-400">
              还没有账号？{' '}
              <Link
                to="/register"
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
              >
                立即注册
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};
