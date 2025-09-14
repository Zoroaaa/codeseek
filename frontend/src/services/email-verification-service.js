// src/services/email-verification-service.js - 前端邮箱验证服务增强版本
import apiService from './api.js';
import { showToast, showLoading } from '../utils/dom.js';
import { validateEmail } from '../utils/validation.js';

class EmailVerificationService {
    constructor() {
        this.pendingVerifications = new Map(); // 存储待验证的请求
        this.timers = new Map(); // 存储倒计时定时器
        this.stateChecked = new Set(); // 记录已检查状态的验证类型
    }

    // 🆕 新增：检查验证状态（智能恢复功能的核心）
    async checkVerificationStatus(email, verificationType, userId = null) {
        try {
            const params = new URLSearchParams({
                email: email,
                type: verificationType
            });
            
            if (userId) {
                params.append('userId', userId);
            }

            const response = await apiService.request(`/api/auth/verification-status?${params.toString()}`, {
                method: 'GET'
            });

            if (response.success && response.hasPendingVerification) {
                const status = response.verificationStatus;
                
                // 存储到本地状态
                this.pendingVerifications.set(verificationType, {
                    email: status.email,
                    maskedEmail: status.email,
                    expiresAt: status.expiresAt,
                    type: verificationType,
                    canResend: status.canResend,
                    remainingTime: status.remainingTime
                });

                // 启动倒计时
                if (status.expiresAt) {
                    this.startCountdown(verificationType, status.expiresAt);
                }

                return {
                    hasPending: true,
                    status: status,
                    shouldShowVerificationInput: true
                };
            }

            return {
                hasPending: false,
                shouldShowVerificationInput: false
            };

        } catch (error) {
            console.error('检查验证状态失败:', error);
            return {
                hasPending: false,
                shouldShowVerificationInput: false,
                error: error.message
            };
        }
    }

    // 🆕 新增：获取已登录用户的所有待验证状态
    async getUserVerificationStatus() {
        try {
            const response = await apiService.request('/api/auth/user-verification-status', {
                method: 'GET'
            });

            if (response.success) {
                // 处理待验证状态
                response.pendingVerifications?.forEach(verification => {
                    this.pendingVerifications.set(verification.verificationType, {
                        email: verification.email,
                        maskedEmail: verification.email,
                        expiresAt: verification.expiresAt,
                        type: verification.verificationType,
                        canResend: verification.canResend,
                        remainingTime: verification.remainingTime
                    });

                    // 启动倒计时
                    if (verification.expiresAt) {
                        this.startCountdown(verification.verificationType, verification.expiresAt);
                    }
                });

                // 处理邮箱更改请求
                if (response.emailChangeRequest) {
                    const request = response.emailChangeRequest;
                    this.pendingVerifications.set('email_change_request', request);
                }

                return response;
            }

            return { hasAnyPendingVerifications: false };

        } catch (error) {
            console.error('获取用户验证状态失败:', error);
            return { hasAnyPendingVerifications: false, error: error.message };
        }
    }

    // 🆕 新增：智能发送验证码（会先检查状态）
    async smartSendVerificationCode(email, verificationType, force = false) {
        try {
            showLoading(true);
            
            const response = await apiService.request('/api/auth/smart-send-code', {
                method: 'POST',
                body: JSON.stringify({
                    email: email,
                    verificationType: verificationType,
                    force: force
                })
            });

            if (response.success) {
                if (!response.canResend && !force) {
                    // 存在有效验证码，更新本地状态
                    const existing = response.existingVerification;
                    if (existing) {
                        this.pendingVerifications.set(verificationType, {
                            email: existing.email,
                            maskedEmail: existing.email,
                            expiresAt: existing.expiresAt,
                            type: verificationType,
                            canResend: existing.canResend,
                            remainingTime: existing.remainingTime
                        });

                        this.startCountdown(verificationType, existing.expiresAt);
                    }
                    
                    return {
                        success: true,
                        hasPendingCode: true,
                        message: response.message || '存在有效的验证码',
                        waitTime: response.waitTime,
                        existingVerification: existing
                    };
                } else {
                    // 发送了新验证码
                    this.pendingVerifications.set(verificationType, {
                        email: response.maskedEmail,
                        maskedEmail: response.maskedEmail,
                        expiresAt: response.expiresAt,
                        type: verificationType,
                        canResend: false,
                        remainingTime: response.expiresAt - Date.now()
                    });

                    this.startCountdown(verificationType, response.expiresAt);
                    showToast(response.message, 'success');
                    
                    return {
                        success: true,
                        hasPendingCode: false,
                        newCodeSent: true,
                        message: response.message,
                        maskedEmail: response.maskedEmail,
                        expiresAt: response.expiresAt
                    };
                }
            } else {
                throw new Error(response.message || '发送验证码失败');
            }
        } catch (error) {
            console.error('智能发送验证码失败:', error);
            showToast(error.message || '发送验证码失败，请稍后重试', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 🆕 新增：自动恢复验证界面状态
    async autoRestoreVerificationState(email, verificationType, userId = null) {
        const cacheKey = `verification_state_${verificationType}_${email}`;
        
        // 先检查本地缓存
        const cachedState = this.getLocalVerificationState(cacheKey);
        if (cachedState && cachedState.expiresAt > Date.now()) {
            return {
                shouldRestore: true,
                state: cachedState,
                source: 'cache'
            };
        }

        // 检查服务器状态
        const serverStatus = await this.checkVerificationStatus(email, verificationType, userId);
        if (serverStatus.hasPending) {
            // 保存到本地缓存
            this.saveLocalVerificationState(cacheKey, serverStatus.status);
            return {
                shouldRestore: true,
                state: serverStatus.status,
                source: 'server'
            };
        }

        return {
            shouldRestore: false
        };
    }

    // 本地状态缓存管理
    saveLocalVerificationState(key, state) {
        try {
            const cacheData = {
                ...state,
                cachedAt: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('保存验证状态到本地缓存失败:', error);
        }
    }

    getLocalVerificationState(key) {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const data = JSON.parse(cached);
                // 检查缓存是否过期（本地缓存保持5分钟）
                if (Date.now() - data.cachedAt < 300000) {
                    return data;
                }
                localStorage.removeItem(key);
            }
        } catch (error) {
            console.warn('获取本地验证状态缓存失败:', error);
        }
        return null;
    }

    clearLocalVerificationState(email, verificationType) {
        const cacheKey = `verification_state_${verificationType}_${email}`;
        try {
            localStorage.removeItem(cacheKey);
        } catch (error) {
            console.warn('清除本地验证状态缓存失败:', error);
        }
    }

    // 原有方法保持不变，但添加一些优化

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
                this.pendingVerifications.set('registration', {
                    email,
                    maskedEmail: response.maskedEmail,
                    expiresAt: response.expiresAt,
                    type: 'registration'
                });

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

    // 发送忘记密码验证码（未登录用户）
    async sendForgotPasswordCode(email) {
        try {
            if (!validateEmail(email).valid) {
                throw new Error('请输入有效的邮箱地址');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/forgot-password', {
                method: 'POST',
                body: JSON.stringify({ email })
            });

            if (response.success) {
                this.pendingVerifications.set('forgot_password', {
                    email,
                    maskedEmail: response.maskedEmail,
                    expiresAt: Date.now() + 900000, // 15分钟有效期
                    type: 'forgot_password'
                });

                this.startCountdown('forgot_password', Date.now() + 900000);
                showToast(`验证码已发送到 ${response.maskedEmail}`, 'success');
                return {
                    success: true,
                    maskedEmail: response.maskedEmail,
                    expiresAt: Date.now() + 900000
                };
            } else {
                throw new Error(response.message || '发送失败');
            }
        } catch (error) {
            console.error('发送忘记密码验证码失败:', error);
            showToast(error.message || '发送验证码失败，请稍后重试', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 重置密码（使用验证码）
    async resetPasswordWithCode(email, verificationCode, newPassword) {
        try {
            if (!validateEmail(email).valid) {
                throw new Error('请输入有效的邮箱地址');
            }

            if (!this.validateVerificationCode(verificationCode)) {
                throw new Error('验证码格式错误');
            }

            if (!newPassword || newPassword.length < 6) {
                throw new Error('新密码长度至少6个字符');
            }

            showLoading(true);
            const response = await apiService.request('/api/auth/reset-password', {
                method: 'POST',
                body: JSON.stringify({
                    email,
                    verificationCode,
                    newPassword
                })
            });

            if (response.success) {
                this.clearVerification('forgot_password');
                this.clearLocalVerificationState(email, 'forgot_password');
                showToast('密码重置成功，请使用新密码登录', 'success');
                return response;
            } else {
                throw new Error(response.message || '重置失败');
            }
        } catch (error) {
            console.error('重置密码失败:', error);
            showToast(error.message || '重置密码失败', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 验证注册验证码（在注册时调用）
    async verifyRegistrationCode(registrationData, code) {
        try {
            if (!registrationData || !registrationData.username || !registrationData.email || !registrationData.password) {
                throw new Error('注册数据不完整');
            }

            if (!this.validateVerificationCode(code)) {
                throw new Error('验证码格式错误');
            }

            showLoading(true);
            
            const response = await apiService.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: registrationData.username,
                    email: registrationData.email,
                    password: registrationData.password,
                    verificationCode: code
                })
            });
            
            if (response.success) {
                this.clearVerification('registration');
                this.clearLocalVerificationState(registrationData.email, 'registration');
                showToast('注册成功！', 'success');
                return { success: true, user: response.user };
            } else {
                throw new Error(response.message || '注册验证失败');
            }
        } catch (error) {
            console.error('注册验证失败:', error);
            showToast(error.message || '注册验证失败，请重试', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    // 发送密码重置验证码（已登录用户）
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
                const verification = this.pendingVerifications.get('email_change');
                if (verification) {
                    verification[`${emailType}EmailVerified`] = true;
                }

                if (response.completed) {
                    this.clearVerification('email_change');
                    showToast('邮箱更改成功！', 'success');
                    
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
        if (this.timers.has(type)) {
            clearInterval(this.timers.get(type));
        }

        const timer = setInterval(() => {
            const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
            
            if (remaining <= 0) {
                clearInterval(timer);
                this.timers.delete(type);
                
                window.dispatchEvent(new CustomEvent('verificationExpired', {
                    detail: { type }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('verificationCountdown', {
                    detail: { 
                        type, 
                        remaining
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
        const cleaned = input.replace(/\D/g, '');
        const limited = cleaned.substring(0, 6);
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