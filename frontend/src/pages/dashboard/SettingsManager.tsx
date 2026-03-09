import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  Send, 
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { Card, Button, Input, Tabs, Modal } from '@/components/ui';
import { useAuthStore, useThemeStore } from '@/stores';
import { userApi, authApi } from '@/services/api';
import { useToast } from '@/components/ui/Toast';

export const SettingsManager: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateUserSettings, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [isLoading, setIsLoading] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  
  const [notificationSettings, setNotificationSettings] = useState({
    email: user?.settings?.notifications?.email ?? true,
    browser: user?.settings?.notifications?.browser ?? false,
  });

  const [emailChangeModal, setEmailChangeModal] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState<'request' | 'verify'>('request');
  const [emailChangeForm, setEmailChangeForm] = useState({
    newEmail: '',
    currentPassword: '',
    verificationCode: '',
  });
  const [emailChangeCountdown, setEmailChangeCountdown] = useState(0);
  const [emailChangeRequestId, setEmailChangeRequestId] = useState('');
  const [emailChangeMaskedEmail, setEmailChangeMaskedEmail] = useState('');

  const [deleteAccountModal, setDeleteAccountModal] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] = useState<'confirm' | 'verify'>('confirm');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteVerificationCode, setDeleteVerificationCode] = useState('');
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [deleteMaskedEmail, setDeleteMaskedEmail] = useState('');

  useEffect(() => {
    if (emailChangeCountdown > 0) {
      const timer = setTimeout(() => setEmailChangeCountdown(emailChangeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailChangeCountdown]);

  useEffect(() => {
    if (deleteCountdown > 0) {
      const timer = setTimeout(() => setDeleteCountdown(deleteCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [deleteCountdown]);

  const maskEmail = (email: string): string => {
    if (!email) return '';
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    const masked = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${masked}@${domain}`;
  };

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatVerificationCode = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const limited = cleaned.substring(0, 6);
    return limited.replace(/(\d{3})(\d{1,3})?/, '$1 $2').trim();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await userApi.updateSettings({ 
        profile: { 
          username: profileForm.username,
        } 
      });
      toast.success('更新成功', '个人资料已更新');
    } catch (error: any) {
      toast.error('更新失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('密码不匹配', '两次输入的密码不一致');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('密码太短', '密码至少需要6个字符');
      return;
    }
    
    setIsLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('密码已更新', '请重新登录');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      toast.error('修改失败', error.message || '当前密码可能不正确');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await userApi.updateSettings({ notifications: notificationSettings });
      updateUserSettings({ notifications: notificationSettings });
      toast.success('设置已保存');
    } catch (error: any) {
      toast.error('保存失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestEmailChange = async () => {
    if (!emailChangeForm.newEmail) {
      toast.error('请输入新邮箱');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailChangeForm.newEmail)) {
      toast.error('请输入有效的邮箱地址');
      return;
    }
    if (!emailChangeForm.currentPassword) {
      toast.error('请输入当前密码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.requestEmailChange({
        newEmail: emailChangeForm.newEmail,
        currentPassword: emailChangeForm.currentPassword,
      });
      
      if (response.success && response.data) {
        setEmailChangeRequestId(response.data.requestId);
        setEmailChangeMaskedEmail(response.data.maskedEmail);
        setEmailChangeCountdown(response.data.expiresIn || 300);
        setEmailChangeStep('verify');
        toast.success('验证码已发送到新邮箱');
      }
    } catch (error: any) {
      toast.error('请求失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmailChangeCode = async () => {
    if (emailChangeCountdown > 0) return;
    
    setIsLoading(true);
    try {
      const response = await authApi.sendEmailChangeCode({
        requestId: emailChangeRequestId,
        emailType: 'new',
      });
      
      if (response.success && response.data) {
        setEmailChangeCountdown(response.data.expiresIn || 300);
        toast.success('验证码已重新发送');
      }
    } catch (error: any) {
      toast.error('发送失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    const cleanCode = emailChangeForm.verificationCode.replace(/\s/g, '');
    if (cleanCode.length !== 6) {
      toast.error('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.verifyEmailChangeCode({
        requestId: emailChangeRequestId,
        emailType: 'new',
        code: cleanCode,
      });
      
      if (response.success && response.data?.completed) {
        toast.success('邮箱更改成功', '请重新登录');
        setEmailChangeModal(false);
        setEmailChangeStep('request');
        setEmailChangeForm({ newEmail: '', currentPassword: '', verificationCode: '' });
        setTimeout(() => {
          logout();
          navigate('/login');
        }, 2000);
      } else {
        toast.error('验证失败', response.message || '验证码错误');
      }
    } catch (error: any) {
      toast.error('验证失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDeleteCode = async () => {
    setIsLoading(true);
    try {
      const response = await authApi.sendAccountDeleteCode();
      
      if (response.success && response.data) {
        setDeleteMaskedEmail(response.data.maskedEmail);
        setDeleteCountdown(response.data.expiresIn || 300);
        setDeleteAccountStep('verify');
        toast.success('验证码已发送到您的邮箱');
      }
    } catch (error: any) {
      toast.error('发送失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendDeleteCode = async () => {
    if (deleteCountdown > 0) return;
    await handleSendDeleteCode();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== '删除我的账户') {
      toast.error('请输入正确的确认文字');
      return;
    }

    const cleanCode = deleteVerificationCode.replace(/\s/g, '');
    if (cleanCode.length !== 6) {
      toast.error('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.deleteAccount({
        verificationCode: cleanCode,
        confirmText: deleteConfirmText,
      });
      
      if (response.success) {
        toast.success('账户已删除');
        setDeleteAccountModal(false);
        setTimeout(() => {
          logout();
          navigate('/');
        }, 2000);
      } else {
        toast.error('删除失败', response.message || '验证码错误');
      }
    } catch (error: any) {
      toast.error('删除失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const renderEmailChangeModal = () => (
    <Modal
      isOpen={emailChangeModal}
      onClose={() => {
        setEmailChangeModal(false);
        setEmailChangeStep('request');
        setEmailChangeForm({ newEmail: '', currentPassword: '', verificationCode: '' });
      }}
      title="更改邮箱"
      size="md"
    >
      {emailChangeStep === 'request' ? (
        <div className="space-y-4">
          <div className="p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
            <p className="text-sm text-surface-600 dark:text-surface-400">当前邮箱</p>
            <p className="font-medium text-surface-900 dark:text-surface-100">
              {maskEmail(user?.email || '')}
            </p>
          </div>

          <Input
            label="新邮箱地址"
            type="email"
            placeholder="请输入新邮箱"
            value={emailChangeForm.newEmail}
            onChange={(e) => setEmailChangeForm({ ...emailChangeForm, newEmail: e.target.value })}
            leftIcon={<Mail className="w-5 h-5" />}
            fullWidth
          />

          <Input
            label="当前密码"
            type="password"
            placeholder="请输入当前密码验证身份"
            value={emailChangeForm.currentPassword}
            onChange={(e) => setEmailChangeForm({ ...emailChangeForm, currentPassword: e.target.value })}
            leftIcon={<Lock className="w-5 h-5" />}
            fullWidth
          />

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setEmailChangeModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleRequestEmailChange}
              isLoading={isLoading}
              leftIcon={<Send className="w-5 h-5" />}
            >
              发送验证码
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Mail className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              验证码已发送到 <span className="font-medium">{emailChangeMaskedEmail}</span>
            </p>
          </div>

          <Input
            label="验证码"
            type="text"
            placeholder="请输入6位验证码"
            value={emailChangeForm.verificationCode}
            onChange={(e) => setEmailChangeForm({ 
              ...emailChangeForm, 
              verificationCode: formatVerificationCode(e.target.value) 
            })}
            fullWidth
            className="text-center text-xl tracking-widest"
            maxLength={7}
          />

          {emailChangeCountdown > 0 ? (
            <p className="text-center text-sm text-surface-500">
              验证码 {formatCountdown(emailChangeCountdown)} 后过期
            </p>
          ) : (
            <p className="text-center text-sm text-error-500">验证码已过期</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setEmailChangeStep('request')}
            >
              返回
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleVerifyEmailChange}
              isLoading={isLoading}
            >
              验证并更改
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendEmailChangeCode}
              disabled={emailChangeCountdown > 0 || isLoading}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailChangeCountdown > 0 ? `重新发送 (${formatCountdown(emailChangeCountdown)})` : '重新发送验证码'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );

  const renderDeleteAccountModal = () => (
    <Modal
      isOpen={deleteAccountModal}
      onClose={() => {
        setDeleteAccountModal(false);
        setDeleteAccountStep('confirm');
        setDeleteConfirmText('');
        setDeleteVerificationCode('');
      }}
      title="删除账户"
      size="md"
    >
      {deleteAccountStep === 'confirm' ? (
        <div className="space-y-4">
          <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-lg border border-error-200 dark:border-error-800">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-error-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-error-700 dark:text-error-400 mb-1">
                  警告：此操作无法撤销
                </h4>
                <p className="text-sm text-error-600 dark:text-error-400">
                  删除账户将永久移除您的所有数据，包括：
                </p>
                <ul className="text-sm text-error-600 dark:text-error-400 mt-2 list-disc list-inside">
                  <li>个人资料和设置</li>
                  <li>所有收藏夹</li>
                  <li>搜索历史记录</li>
                  <li>社区分享的搜索源</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setDeleteAccountModal(false)}
            >
              取消
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleSendDeleteCode}
              isLoading={isLoading}
            >
              我理解风险，继续
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-error-100 dark:bg-error-900/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-error-600 dark:text-error-400" />
            </div>
            <p className="text-sm text-surface-600 dark:text-surface-400">
              验证码已发送到 <span className="font-medium">{deleteMaskedEmail}</span>
            </p>
          </div>

          <div className="p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-2">
              请输入以下文字确认删除：
            </p>
            <p className="font-mono font-bold text-surface-900 dark:text-surface-100">
              删除我的账户
            </p>
          </div>

          <Input
            type="text"
            placeholder="请输入确认文字"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            fullWidth
          />

          <Input
            label="验证码"
            type="text"
            placeholder="请输入6位验证码"
            value={deleteVerificationCode}
            onChange={(e) => setDeleteVerificationCode(formatVerificationCode(e.target.value))}
            fullWidth
            className="text-center text-xl tracking-widest"
            maxLength={7}
          />

          {deleteCountdown > 0 ? (
            <p className="text-center text-sm text-surface-500">
              验证码 {formatCountdown(deleteCountdown)} 后过期
            </p>
          ) : (
            <p className="text-center text-sm text-error-500">验证码已过期</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setDeleteAccountStep('confirm')}
            >
              返回
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDeleteAccount}
              isLoading={isLoading}
            >
              确认删除账户
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResendDeleteCode}
              disabled={deleteCountdown > 0 || isLoading}
              className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteCountdown > 0 ? `重新发送 (${formatCountdown(deleteCountdown)})` : '重新发送验证码'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
          系统设置
        </h2>
        <p className="text-surface-500 dark:text-surface-400 mt-1">
          管理您的账户和偏好设置
        </p>
      </div>

      <Tabs
        tabs={[
          { id: 'profile', label: '个人资料', icon: <User className="w-4 h-4" /> },
          { id: 'security', label: '安全设置', icon: <Shield className="w-4 h-4" /> },
          { id: 'appearance', label: '外观设置', icon: <Palette className="w-4 h-4" /> },
          { id: 'notifications', label: '通知设置', icon: <Bell className="w-4 h-4" /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'profile' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            个人资料
          </h3>
          <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
            <Input
              label="用户名"
              value={profileForm.username}
              onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
              fullWidth
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">
                邮箱
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                  <span className="text-surface-900 dark:text-surface-100">
                    {maskEmail(user?.email || '')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setEmailChangeModal(true)}
                  leftIcon={<Mail className="w-4 h-4" />}
                >
                  更改
                </Button>
              </div>
            </div>
            <Button type="submit" variant="primary" isLoading={isLoading}>
              保存更改
            </Button>
          </form>
        </Card>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
              修改密码
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <Input
                label="当前密码"
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                leftIcon={<Lock className="w-5 h-5" />}
                fullWidth
              />
              <Input
                label="新密码"
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                leftIcon={<Lock className="w-5 h-5" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-surface-400 hover:text-surface-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
                fullWidth
              />
              <Input
                label="确认新密码"
                type={showPassword ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                leftIcon={<Lock className="w-5 h-5" />}
                fullWidth
              />
              <Button type="submit" variant="primary" isLoading={isLoading}>
                修改密码
              </Button>
            </form>
          </Card>

          <Card className="p-6 border-error-200 dark:border-error-800">
            <h3 className="text-lg font-semibold text-error-600 dark:text-error-400 mb-4">
              危险操作
            </h3>
            <p className="text-sm text-surface-600 dark:text-surface-400 mb-4">
              以下操作不可撤销，请谨慎操作
            </p>
            <Button
              variant="danger"
              onClick={() => setDeleteAccountModal(true)}
              leftIcon={<Trash2 className="w-4 h-4" />}
            >
              删除账户
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'appearance' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            外观设置
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                主题模式
              </label>
              <div className="flex gap-3">
                {[
                  { value: 'light', label: '浅色', icon: '☀️' },
                  { value: 'dark', label: '深色', icon: '🌙' },
                  { value: 'system', label: '跟随系统', icon: '💻' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTheme(option.value as 'light' | 'dark' | 'system')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      theme === option.value
                        ? 'border-primary-500 bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                        : 'border-surface-300 dark:border-surface-600 hover:border-primary-300'
                    }`}
                  >
                    <span>{option.icon}</span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
            通知设置
          </h3>
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div>
                <p className="font-medium text-surface-900 dark:text-surface-100">
                  邮件通知
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  接收重要更新的邮件通知
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.email}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, email: e.target.checked })}
                className="w-5 h-5 rounded border-surface-300 dark:border-surface-600"
              />
            </label>
            <label className="flex items-center justify-between p-4 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
              <div>
                <p className="font-medium text-surface-900 dark:text-surface-100">
                  浏览器通知
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  接收浏览器推送通知
                </p>
              </div>
              <input
                type="checkbox"
                checked={notificationSettings.browser}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, browser: e.target.checked })}
                className="w-5 h-5 rounded border-surface-300 dark:border-surface-600"
              />
            </label>
            <Button variant="primary" onClick={handleSaveSettings} isLoading={isLoading}>
              保存设置
            </Button>
          </div>
        </Card>
      )}

      {renderEmailChangeModal()}
      {renderDeleteAccountModal()}
    </div>
  );
};
