import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Shield, CheckCircle } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { authApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/main');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    const newErrors: typeof errors = {};
    
    if (!username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (username.length < 2) {
      newErrors.username = '用户名至少需要2个字符';
    } else if (username.length > 20) {
      newErrors.username = '用户名不能超过20个字符';
    }
    
    if (!email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    if (!password) {
      newErrors.password = '请输入密码';
    } else if (password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.register({ username, email, password });
      if (response.success) {
        toast.success('注册成功', '请登录您的账户');
        navigate('/login');
      } else {
        toast.error('注册失败', response.message || '请检查您的输入');
      }
    } catch (error) {
      toast.error('注册失败', '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!password) return { level: 0, text: '', color: '' };
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 2) return { level: strength, text: '弱', color: 'bg-error-500' };
    if (strength <= 3) return { level: strength, text: '中', color: 'bg-warning-500' };
    return { level: strength, text: '强', color: 'bg-success-500' };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent-500 via-primary-500 to-primary-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRoLTJWMTZoMnYxOHptLTQtMGgtMlYxNmgydjE4em0tNCAwaC0yVjE2aDJ2MTh6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-20" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12 text-white">
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4 text-center">加入我们</h1>
          <p className="text-xl text-white/80 text-center max-w-md">
            创建账户，开启您的磁力搜索之旅
          </p>
          
          <div className="mt-12 space-y-4 w-full max-w-sm">
            {[
              { icon: <CheckCircle className="w-5 h-5" />, text: '100+ 优质搜索源' },
              { icon: <CheckCircle className="w-5 h-5" />, text: '云端同步收藏与历史' },
              { icon: <CheckCircle className="w-5 h-5" />, text: '个性化搜索源配置' },
            ].map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-white/90">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  {item.icon}
                </div>
                <span className="text-lg">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-surface-50 dark:bg-surface-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 mb-4 shadow-lg shadow-primary-500/25">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">磁力快搜</h1>
          </div>

          <div className="bg-white dark:bg-surface-900 rounded-3xl shadow-elevated-lg p-6 sm:p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
                创建账户
              </h2>
              <p className="text-surface-500 dark:text-surface-400">
                填写以下信息完成注册
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="text"
                label="用户名"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={errors.username}
                leftIcon={<User className="w-5 h-5" />}
                fullWidth
              />

              <Input
                type="email"
                label="邮箱地址"
                placeholder="请输入邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leftIcon={<Mail className="w-5 h-5" />}
                fullWidth
              />

              <div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="密码"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                  fullWidth
                />
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= strength.level ? strength.color : 'bg-surface-200 dark:bg-surface-700'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-surface-500 mt-1">
                      密码强度：<span className={`font-medium ${strength.color.replace('bg-', 'text-')}`}>{strength.text}</span>
                    </p>
                  </div>
                )}
              </div>

              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                label="确认密码"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                leftIcon={<Lock className="w-5 h-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                fullWidth
              />

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 mt-0.5 rounded border-surface-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-surface-600 dark:text-surface-400">
                  我已阅读并同意 <a href="#" className="text-primary-500 hover:underline">服务条款</a> 和 <a href="#" className="text-primary-500 hover:underline">隐私政策</a>
                </span>
              </label>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<ArrowRight className="w-5 h-5" />}
              >
                注册
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-surface-500 dark:text-surface-400">
                已有账户？{' '}
                <Link
                  to="/login"
                  className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-semibold transition-colors"
                >
                  立即登录
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-surface-400 dark:text-surface-500">
            注册即表示您同意我们的服务条款和隐私政策
          </p>
        </div>
      </div>
    </div>
  );
};
