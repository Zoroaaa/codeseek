import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Send, Lock, ShieldCheck, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { authApi } from '@/services/api';
import { Button, Input, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';

type Step = 'email' | 'verify' | 'success';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [currentStep, setCurrentStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
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

  const validateEmail = () => {
    if (!email.trim()) {
      setError('请输入邮箱');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return false;
    }
    setError('');
    return true;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.sendPasswordResetCode(email);
      if (response.success && response.data) {
        setMaskedEmail(response.data.maskedEmail || maskEmail(email));
        setCountdown(response.data.expiresIn || 300);
        setCurrentStep('verify');
        toast.success('验证码已发送', '请检查您的邮箱');
      } else {
        toast.error('发送失败', '请稍后重试');
      }
    } catch (error: any) {
      toast.error('发送失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.sendPasswordResetCode(email);
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

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanCode = verificationCode.replace(/\s/g, '');
    
    if (cleanCode.length !== 6) {
      toast.error('验证码错误', '请输入6位验证码');
      return;
    }

    if (!newPassword) {
      toast.error('密码错误', '请输入新密码');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('密码错误', '密码至少6个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('密码错误', '两次输入的密码不一致');
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await authApi.resetPassword({
        email,
        verificationCode: cleanCode,
        newPassword,
      });
      
      if (response.success) {
        setCurrentStep('success');
        toast.success('密码重置成功', '请使用新密码登录');
      } else {
        toast.error('重置失败', response.message || '验证码错误或已过期');
      }
    } catch (error: any) {
      toast.error('重置失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderEmailStep = () => (
    <form onSubmit={handleSendCode} className="space-y-5">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <p className="text-surface-600 dark:text-surface-400">
          输入您的邮箱，我们将发送验证码
        </p>
      </div>

      <Input
        label="邮箱"
        type="email"
        placeholder="请输入注册邮箱"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        leftIcon={<Mail className="w-5 h-5" />}
        fullWidth
      />

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
    <form onSubmit={handleResetPassword} className="space-y-5">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <p className="text-sm text-surface-600 dark:text-surface-400">
          验证码已发送到 <span className="font-medium text-surface-900 dark:text-surface-100">{maskedEmail}</span>
        </p>
      </div>

      <Input
        label="验证码"
        type="text"
        placeholder="请输入6位验证码"
        value={verificationCode}
        onChange={handleCodeChange}
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

      <Input
        label="新密码"
        type={showPassword ? 'text' : 'password'}
        placeholder="请输入新密码（至少6位）"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
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
        label="确认新密码"
        type={showPassword ? 'text' : 'password'}
        placeholder="请再次输入新密码"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        leftIcon={<Lock className="w-5 h-5" />}
        fullWidth
      />

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          fullWidth
          onClick={() => setCurrentStep('email')}
        >
          返回
        </Button>
        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={isLoading}
        >
          重置密码
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
    </form>
  );

  const renderSuccessStep = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success-100 dark:bg-success-900/30 flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-success-600 dark:text-success-400" />
      </div>
      <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-100 mb-2">
        密码重置成功！
      </h3>
      <p className="text-surface-600 dark:text-surface-400 mb-6">
        请使用新密码登录您的账户
      </p>
      <Button
        variant="primary"
        size="lg"
        onClick={() => navigate('/login')}
        fullWidth
      >
        前往登录
      </Button>
    </div>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case 'email':
        return '找回密码';
      case 'verify':
        return '验证并重置';
      case 'success':
        return '重置成功';
    }
  };

  const getStepDescription = () => {
    switch (currentStep) {
      case 'email':
        return '输入您的注册邮箱';
      case 'verify':
        return '输入验证码并设置新密码';
      case 'success':
        return '';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-surface-50 via-white to-primary-50/30 dark:from-surface-950 dark:via-surface-900 dark:to-primary-950/30">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回登录
        </Link>

        <Card className="p-8">
          {currentStep !== 'success' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              {(['email', 'verify'] as const).map((step, index) => (
                <React.Fragment key={step}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      currentStep === step
                        ? 'bg-primary-600 text-white'
                        : index < ['email', 'verify'].indexOf(currentStep)
                        ? 'bg-success-500 text-white'
                        : 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                    }`}
                  >
                    {index + 1}
                  </div>
                  {index < 1 && (
                    <div className={`w-12 h-0.5 ${
                      ['email', 'verify'].indexOf(currentStep) > index
                        ? 'bg-success-500'
                        : 'bg-surface-200 dark:bg-surface-700'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-2">
              {getStepTitle()}
            </h1>
            <p className="text-surface-600 dark:text-surface-400">
              {getStepDescription()}
            </p>
          </div>

          {currentStep === 'email' && renderEmailStep()}
          {currentStep === 'verify' && renderVerifyStep()}
          {currentStep === 'success' && renderSuccessStep()}
        </Card>
      </div>
    </div>
  );
};
