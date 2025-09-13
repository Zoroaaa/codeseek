// src/services/email-verification-service.js - 前端邮箱验证服务
import apiService from './api.js';
import { showToast, showLoading } from '../utils/dom.js';
import { validateEmail } from '../utils/validation.js';

class EmailVerificationService {
    constructor() {
        this.pendingVerifications = new Map(); // 存储待验证的请求
        this.timers = new Map(); // 存储倒计时定时器
    }

    // 发送注册验证码
    async sendRegistrationCode(email) {
        try {
            if (!validateEmail(email).valid) {
                throw new Error('请输入有效的邮箱地址');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/send-registration-code', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                // 存储验证状态
                this.pendingVerifications.set('registration', {
                    email,
                    maskedEmail: response.maskedEmail,
                    expiresAt: response.expiresAt,
                    type: 'registration'
                });

                // 启动倒计时
                this.startCountdown('registration', response.expiresAt);

                showToast(`验证码已发送到 ${response.maskedEmail}`, 'success');
                return {
                    success: true,
                    maskedEmail: response.maskedEmail,
                    expiresAt: response.expiresAt
                };
            } else {
                throw new Error(response.message || '发送失败');
            }
        } catch (error) {
            console.error('发送注册验证码失败:', error);
            showToast(error.message || '发送验证码失败，请稍后重试', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 验证注册验证码（在注册时调用）
    async verifyRegistrationCode(email, code) {
        try {
            const response = await apiService.register(email.username || '', email, email.password || '', code);
            
            if (response.success) {
                // 清除待验证状态
                this.clearVerification('registration');
                return response;
            } else {
                throw new Error(response.message || '验证失败');
            }
        } catch (error) {
            console.error('注册验证失败:', error);
            throw error;
        }
    }

    // 发送密码重置验证码
    async sendPasswordResetCode() {
        try {
            showLoading(true);
            const response = await apiService.request('/api/auth/send-password-reset-code', {
                method: 'POST'
            });

            if (response.success) {
                this.pendingVerifications.set('password_reset', {
                    maskedEmail: response.maskedEmail,
                    expiresAt: response.expiresAt,
                    type: 'password_reset'
                });

                this.startCountdown('password_reset', response.expiresAt);
                showToast(`验证码已发送到 ${response.maskedEmail}`, 'success');
                return response;
            } else {
                throw new Error(response.message || '发送失败');
            }
        } catch (error) {
            console.error('发送密码重置验证码失败:', error);
            showToast(error.message || '发送验证码失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 修改密码（带验证码）
    async changePasswordWithVerification(currentPassword, newPassword, verificationCode) {
        try {
            showLoading(true);
            const response = await apiService.request('/api/auth/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                    currentPassword,
                    newPassword,
                    verificationCode
                })
            });

            if (response.success) {
                this.clearVerification('password_reset');
                showToast('密码修改成功，请重新登录', 'success');
                return response;
            } else {
                throw new Error(response.message || '修改失败');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            showToast(error.message || '修改密码失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 申请邮箱更改
    async requestEmailChange(newEmail, currentPassword) {
        try {
            if (!validateEmail(newEmail).valid) {
                throw new Error('请输入有效的新邮箱地址');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/request-email-change', {
                method: 'POST',
                body: JSON.stringify({
                    newEmail,
                    currentPassword
                })
            });

            if (response.success) {
                this.pendingVerifications.set('email_change', {
                    requestId: response.requestId,
                    oldEmail: response.oldEmail,
                    newEmail: response.newEmail,
                    expiresAt: response.expiresAt,
                    type: 'email_change',
                    oldEmailVerified: false,
                    newEmailVerified: false
                });

                showToast('邮箱更改请求已创建，请验证新邮箱地址', 'success');
                return response;
            } else {
                throw new Error(response.message || '请求失败');
            }
        } catch (error) {
            console.error('邮箱更改请求失败:', error);
            showToast(error.message || '邮箱更改请求失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 发送邮箱更改验证码
    async sendEmailChangeCode(requestId, emailType) {
        try {
            if (!requestId || !['old', 'new'].includes(emailType)) {
                throw new Error('参数错误');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/send-email-change-code', {
                method: 'POST',
                body: JSON.stringify({
                    requestId,
                    emailType
                })
            });

            if (response.success) {
                // 更新验证状态
                const verification = this.pendingVerifications.get('email_change');
                if (verification) {
                    verification[`${emailType}EmailCodeSent`] = true;
                    verification[`${emailType}EmailCodeExpiresAt`] = response.expiresAt;
                }

                this.startCountdown(`email_change_${emailType}`, response.expiresAt);
                showToast(`验证码已发送到 ${response.maskedEmail}`, 'success');
                return response;
            } else {
                throw new Error(response.message || '发送失败');
            }
        } catch (error) {
            console.error('发送邮箱更改验证码失败:', error);
            showToast(error.message || '发送验证码失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 验证邮箱更改验证码
    async verifyEmailChangeCode(requestId, emailType, verificationCode) {
        try {
            if (!requestId || !emailType || !verificationCode) {
                throw new Error('参数不完整');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/verify-email-change-code', {
                method: 'POST',
                body: JSON.stringify({
                    requestId,
                    emailType,
                    verificationCode
                })
            });

            if (response.success) {
                // 更新验证状态
                const verification = this.pendingVerifications.get('email_change');
                if (verification) {
                    verification[`${emailType}EmailVerified`] = true;
                }

                if (response.completed) {
                    // 邮箱更改完成
                    this.clearVerification('email_change');
                    showToast('邮箱更改成功！', 'success');
                    
                    // 触发用户信息更新事件
                    window.dispatchEvent(new CustomEvent('emailChanged', {
                        detail: { newEmail: response.newEmail }
                    }));
                } else {
                    showToast(response.message, 'success');
                }

                return response;
            } else {
                throw new Error(response.message || '验证失败');
            }
        } catch (error) {
            console.error('邮箱更改验证失败:', error);
            showToast(error.message || '验证失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 发送账户删除验证码
    async sendAccountDeleteCode() {
        try {
            showLoading(true);
            const response = await apiService.request('/api/auth/send-account-delete-code', {
                method: 'POST'
            });

            if (response.success) {
                this.pendingVerifications.set('account_delete', {
                    maskedEmail: response.maskedEmail,
                    expiresAt: response.expiresAt,
                    type: 'account_delete'
                });

                this.startCountdown('account_delete', response.expiresAt);
                showToast(`验证码已发送到 ${response.maskedEmail}`, 'success');
                return response;
            } else {
                throw new Error(response.message || '发送失败');
            }
        } catch (error) {
            console.error('发送账户删除验证码失败:', error);
            showToast(error.message || '发送验证码失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 删除账户（带验证码）
    async deleteAccountWithVerification(verificationCode, confirmText) {
        try {
            if (!verificationCode) {
                throw new Error('请输入验证码');
            }

            if (confirmText !== '删除我的账户') {
                throw new Error('请输入正确的确认文本');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/delete-account', {
                method: 'POST',
                body: JSON.stringify({
                    verificationCode,
                    confirmText
                })
            });

            if (response.success) {
                this.clearVerification('account_delete');
                showToast('账户已删除', 'success');
                
                // 触发登出事件
                window.dispatchEvent(new CustomEvent('accountDeleted'));
                return response;
            } else {
                throw new Error(response.message || '删除失败');
            }
        } catch (error) {
            console.error('删除账户失败:', error);
            showToast(error.message || '删除账户失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 启动倒计时
    startCountdown(type, expiresAt) {
        // 清除现有定时器
        if (this.timers.has(type)) {
            clearInterval(this.timers.get(type));
        }

        const timer = setInterval(() => {
            const remaining = expiresAt - Date.now();
            
            if (remaining <= 0) {
                // 验证码过期
                clearInterval(timer);
                this.timers.delete(type);
                
                // 触发过期事件
                window.dispatchEvent(new CustomEvent('verificationExpired', {
                    detail: { type }
                }));
            } else {
                // 触发倒计时更新事件
                window.dispatchEvent(new CustomEvent('verificationCountdown', {
                    detail: { 
                        type, 
                        remaining: Math.ceil(remaining / 1000) // 秒数
                    }
                }));
            }
        }, 1000);

        this.timers.set(type, timer);
    }

    // 清除验证状态
    clearVerification(type) {
        this.pendingVerifications.delete(type);
        
        if (this.timers.has(type)) {
            clearInterval(this.timers.get(type));
            this.timers.delete(type);
        }
    }

    // 获取验证状态
    getVerificationStatus(type) {
        return this.pendingVerifications.get(type) || null;
    }

    // 检查是否有待验证的请求
    hasPendingVerification(type) {
        return this.pendingVerifications.has(type);
    }

    // 获取所有待验证的请求
    getAllPendingVerifications() {
        return Array.from(this.pendingVerifications.values());
    }

    // 清除所有验证状态
    clearAllVerifications() {
        this.pendingVerifications.clear();
        
        for (const timer of this.timers.values()) {
            clearInterval(timer);
        }
        this.timers.clear();
    }

    // 格式化剩余时间
    formatRemainingTime(seconds) {
        if (seconds <= 0) return '已过期';
        
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (minutes > 0) {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${secs}秒`;
        }
    }

    // 验证码输入格式化（自动添加空格）
    formatVerificationCode(input) {
        // 移除非数字字符
        const cleaned = input.replace(/\D/g, '');
        
        // 限制长度为6位
        const limited = cleaned.substring(0, 6);
        
        // 每3位添加空格
        return limited.replace(/(\d{3})(\d{1,3})?/, '$1 $2').trim();
    }

    // 验证验证码格式
    validateVerificationCode(code) {
        const cleaned = code.replace(/\s/g, '');
        return /^\d{6}$/.test(cleaned);
    }
}

// 创建全局实例
export const emailVerificationService = new EmailVerificationService();
export default emailVerificationService;