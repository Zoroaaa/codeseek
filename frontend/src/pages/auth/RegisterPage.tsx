import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Send, ShieldCheck, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores';
import { authApi } from '@/services/api';
import { Button, Input, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

type Step = 'form' | 'verify' | 'success';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setToken } = useAuthStore();
  const toast = useToast();
  
  const [currentStep, setCurrentStep] = useState<Step>('form');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [maskedEmail, setMaskedEmail] = useState('');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const maskEmail = (email: string): string => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    const masked = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${masked}@${domain}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.username.trim()) {
      newErrors.username = '请输入用户名';
    } else if (formData.username.length < 3) {
      newErrors.username = '用户名至少3个字符';
    } else if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(formData.username)) {
      newErrors.username = '用户名只能包含字母、数字、下划线和中文';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少6个字符';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '两次密码输入不一致';
    }
    
    if (!agreed) {
      toast.warning('请阅读并同意服务条款');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && agreed;
  };

  const handleSendCode = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.sendRegistrationCode(formData.email);
      if (response.success && response.data) {
        setMaskedEmail(response.data.maskedEmail || maskEmail(formData.email));
        setCountdown(response.data.expiresIn || 300);
        setCurrentStep('verify');
        toast.success('验证码已发送', '请检查您的邮箱');
      } else {
        toast.error('发送失败', '验证码发送失败，请稍后重试');
      }
    } catch (error: any) {
      toast.error('发送失败', error.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.sendRegistrationCode(formData.email);
      if (response.success && response.data) {
        setCountdown(response.data.expiresIn || 300);
        toast.success('验证码已重新发送');
      }
    } catch (error: any) {
      toast.error('发送失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const formatVerificationCode = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.substring(0, 6);
    return limited.replace(/(\d{3})(\d{1,3})?/, '$1 $2').trim();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatVerificationCode(e.target.value);
    setVerificationCode(formatted);
  };

  const handleVerifyAndRegister = async () => {
    const cleanCode = verificationCode.replace(/\s/g, '');
    if (cleanCode.length !== 6) {
      toast.error('验证码错误', '请输入6位验证码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        verificationCode: cleanCode,
      });
      
      if (response.success && response.data) {
        setUser(response.data.user);
        setToken(response.data.token);
        setCurrentStep('success');
        toast.success('注册成功', '欢迎加入磁力快搜');
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        toast.error('注册失败', response.message || '验证码错误或已过期');
      }
    } catch (error: any) {
      toast.error('注册失败', error.message || '网络错误，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (currentStep === 'form') {
        handleSendCode();
      } else if (currentStep === 'verify') {
        handleVerifyAndRegister();
      }
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderFormStep = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="space-y-4">
      <Input
        label="用户名"
        type="text"
        placeholder="请输入用户名"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
        error={errors.username}
        leftIcon={<User className="w-5 h-5" />}
        fullWidth
      />

      <Input
        label="邮箱"
        type="email"
        placeholder="请输入邮箱"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        error={errors.email}
        leftIcon={<Mail className="w-5 h-5" />}
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

      <Input
        label="确认密码"
        type={showPassword ? 'text' : 'password'}
        placeholder="请再次输入密码"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
        error={errors.confirmPassword}
        leftIcon={<Lock className="w-5 h-5" />}
        fullWidth
      />

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 rounded border-surface-300 dark:border-surface-600"
        />
        <span className="text-sm text-surface-600 dark:text-surface-400">
          我已阅读并同意{' '}
          <a href="#" className="text-primary-600 hover:underline">
            服务条款
          </a>{' '}
          和{' '}
          <a href="#" className="text-primary-600 hover:underline">
            隐私政策
          </a>
        </span>
      </label>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={isLoading}
        leftIcon={<Send className="w-5 h-5" />}
      >
        发送验证码
      </Button>
    </form>
  );

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
          验证邮箱地址
        </h3>
        <p className="text-sm text-surface-600 dark:text-surface-400">
          验证码已发送到 <span className="font-medium text-surface-900 dark:text-surface-100">{maskedEmail}</span>
        </p>
      </div>

      <div className="space-y-4">
        <Input
          label="验证码"
          type="text"
          placeholder="请输入6位验证码"
          value={verificationCode}
          onChange={handleCodeChange}
          onKeyDown={handleKeyDown}
          fullWidth
          className="text-center text-2xl tracking-widest"
          maxLength={7}
        />

        {countdown > 0 ? (
          <p className="text-center text-sm text-surface-500 dark:text-surface-400">
            验证码 {formatCountdown(countdown)} 后过期
          </p>
        ) : (
          <p className="text-center text-sm text-error-500">
            验证码已过期
          </p>
        )}

        <div className="flex gap-3">
          <Button
            variant="outline"
            fullWidth
            onClick={() => setCurrentStep('form')}
          >
            返回修改
          </Button>
          <Button
            variant="primary"
            fullWidth
            onClick={handleVerifyAndRegister}
            isLoading={isLoading}
          >
            验证并注册
          </Button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={countdown > 0 || isLoading}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {countdown > 0 ? `重新发送 (${formatCountdown(countdown)})` : '重新发送验证码'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-success-600 dark:text-success-400" />
      </div>
      <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
        注册成功！
      </h3>
      <p className="text-surface-600 dark:text-surface-400 mb-6">
        欢迎加入磁力快搜，即将跳转到控制台...
      </p>
      <div className="flex items-center justify-center gap-2 text-surface-500 dark:text-surface-400">
        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 'form':
        return '创建账号';
      case 'verify':
        return '验证邮箱';
      case 'success':
        return '注册成功';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'form':
        return '注册即可享受更多功能';
      case 'verify':
        return '请输入邮箱验证码';
      case 'success':
        return '';
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
          {currentStep !== 'success' && (
            <>
              <div className="flex items-center justify-center gap-2 mb-6">
                {(['form', 'verify'] as const).map((step, index) => (
                  <React.Fragment key={step}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        currentStep === step
                          ? 'bg-primary-600 text-white'
                          : index < ['form', 'verify'].indexOf(currentStep)
                          ? 'bg-success-500 text-white'
                          : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < 1 && (
                      <div className={`w-12 h-0.5 ${
                        ['form', 'verify'].indexOf(currentStep) > index
                          ? 'bg-success-500'
                          : 'bg-surface-200 dark:bg-surface-700'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
              {getStepTitle()}
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              {getStepDescription()}
            </p>
          </div>

          {currentStep === 'form' && renderFormStep()}
          {currentStep === 'verify' && renderVerifyStep()}
          {currentStep === 'success' && renderSuccessStep()}

          {currentStep === 'form' && (
            <div className="mt-6 text-center">
              <p className="text-surface-600 dark:text-surface-400">
                已有账号？{' '}
                <Link
                  to="/login"
                  className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                >
                  立即登录
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
