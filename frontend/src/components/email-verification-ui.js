// src/components/email-verification-ui.js - 邮箱验证UI组件
import emailVerificationService from '../services/email-verification-service.js';
import { showToast, showModal, hideModal } from '../utils/dom.js';
import authManager from '../services/auth.js';

export class EmailVerificationUI {
    constructor() {
        this.currentStep = 1;
        this.verificationData = {};
        this.countdownIntervals = new Map();
        
        this.bindEvents();
    }

    // 绑定全局事件
    bindEvents() {
        // 监听验证码倒计时事件
        window.addEventListener('verificationCountdown', (event) => {
            this.updateCountdownDisplay(event.detail.type, event.detail.remaining);
        });

        // 监听验证码过期事件
        window.addEventListener('verificationExpired', (event) => {
            this.handleVerificationExpired(event.detail.type);
        });

        // 监听邮箱更改成功事件
        window.addEventListener('emailChanged', (event) => {
            this.handleEmailChanged(event.detail.newEmail);
        });

        // 监听账户删除事件
        window.addEventListener('accountDeleted', () => {
            this.handleAccountDeleted();
        });
    }

    // 显示注册验证码模态框
    showRegistrationVerificationModal(email) {
        // 🔧 修复：先清理可能存在的模态框，避免重复ID
        this.hideRegistrationModal();
        
        const modalHtml = `
            <div class="modal-overlay" id="registrationVerificationModal">
                <div class="modal-content verification-modal">
                    <div class="modal-header">
                        <h3>验证邮箱地址</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hideRegistrationModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="verification-step active" id="step-send-code">
                            <div class="verification-icon">
                                <i class="icon-mail"></i>
                            </div>
                            <p class="verification-text">
                                我们将向 <strong>${this.maskEmail(email)}</strong> 发送6位验证码
                            </p>
                            <button class="btn btn-primary btn-full" id="sendRegistrationCodeBtn" 
                                    onclick="emailVerificationUI.sendRegistrationCode('${email}')">
                                发送验证码
                            </button>
                        </div>
                        
                        <div class="verification-step" id="step-enter-code" style="display: none;">
                            <div class="verification-icon">
                                <i class="icon-shield-check"></i>
                            </div>
                            <p class="verification-text">
                                请输入发送到 <strong id="maskedEmailDisplay"></strong> 的验证码
                            </p>
                            <div class="verification-code-input">
                                <input type="text" 
                                       id="registrationVerificationCode" 
                                       placeholder="000 000" 
                                       maxlength="7"
                                       autocomplete="off"
                                       oninput="emailVerificationUI.formatCodeInput(this)"
                                       onkeypress="emailVerificationUI.handleCodeKeyPress(event, 'registration')">
                            </div>
                            <div class="verification-timer" id="registrationTimer">
                                <span id="registrationCountdown"></span>
                            </div>
                            <div class="verification-actions">
                                <button class="btn btn-primary btn-full" 
                                        onclick="emailVerificationUI.completeRegistration()">
                                    验证并注册
                                </button>
                                <button class="btn btn-secondary btn-full" 
                                        id="resendRegistrationCodeBtn"
                                        onclick="emailVerificationUI.resendRegistrationCode()" 
                                        disabled>
                                    重新发送验证码
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        this.verificationData.email = email;
    }

    // 发送注册验证码
    async sendRegistrationCode(email) {
        try {
            const btn = document.getElementById('sendRegistrationCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            const result = await emailVerificationService.sendRegistrationCode(email);
            
            if (result.success) {
                // 切换到输入验证码步骤
                this.showStep('step-enter-code');
                document.getElementById('maskedEmailDisplay').textContent = result.maskedEmail;
                
                // 聚焦到验证码输入框
                setTimeout(() => {
                    document.getElementById('registrationVerificationCode').focus();
                }, 100);
            }
        } catch (error) {
            console.error('发送注册验证码失败:', error);
            const btn = document.getElementById('sendRegistrationCodeBtn');
            btn.disabled = false;
            btn.textContent = '发送验证码';
        }
    }

    // 重新发送注册验证码
    async resendRegistrationCode() {
        await this.sendRegistrationCode(this.verificationData.email);
    }

    // 完成注册（带验证码）
    async completeRegistration() {
        try {
            const code = this.getCleanCode('registrationVerificationCode');
            if (!emailVerificationService.validateVerificationCode(code)) {
                showToast('请输入正确的6位验证码', 'error');
                return;
            }

            // 🔧 修复：正确获取注册表单数据
            const registrationData = this.getRegistrationData();
            if (!registrationData) {
                showToast('注册信息不完整，请重新填写表单', 'error');
                this.hideRegistrationModal();
                return;
            }

            // 调用API进行注册
            const result = await apiService.request('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    username: registrationData.username,
                    email: registrationData.email,
                    password: registrationData.password,
                    verificationCode: code
                })
            });

            if (result.success) {
                this.hideRegistrationModal();
                showToast('注册成功！', 'success');
                
                // 可选：自动登录
                setTimeout(() => {
                    if (window.app && window.app.authManager) {
                        window.app.authManager.login(registrationData.username, registrationData.password);
                    }
                }, 1000);
            } else {
                throw new Error(result.message || '注册失败');
            }
        } catch (error) {
            console.error('注册验证失败:', error);
            showToast(error.message || '验证失败', 'error');
        }
    }

    // 显示密码重置验证模态框
    showPasswordResetModal() {
        const user = authManager && authManager.getCurrentUser ? authManager.getCurrentUser() : null;
        if (!user) {
            showToast('请先登录', 'error');
            return;
        }

        // 先清理可能存在的模态框
        this.hidePasswordResetModal();

        const modalHtml = `
            <div class="modal-overlay" id="passwordResetModal">
                <div class="modal-content verification-modal">
                    <div class="modal-header">
                        <h3>修改密码</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hidePasswordResetModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="passwordResetForm" onsubmit="emailVerificationUI.submitPasswordReset(event)">
                            <div class="form-group">
                                <label>当前密码</label>
                                <input type="password" id="currentPassword" required>
                            </div>
                            <div class="form-group">
                                <label>新密码</label>
                                <input type="password" id="newPassword" required minlength="6">
                            </div>
                            <div class="form-group">
                                <label>确认新密码</label>
                                <input type="password" id="confirmNewPassword" required>
                            </div>
                            
                            <div class="verification-section" id="passwordVerificationSection" style="display: none;">
                                <div class="verification-divider">
                                    <span>邮箱验证</span>
                                </div>
                                <p class="verification-info">
                                    为了安全，我们需要验证您的邮箱地址
                                </p>
                                <div class="verification-code-group">
                                    <input type="text" 
                                           id="passwordResetCode" 
                                           placeholder="000 000" 
                                           maxlength="7"
                                           oninput="emailVerificationUI.formatCodeInput(this)">
                                    <button type="button" 
                                            class="btn btn-secondary" 
                                            id="sendPasswordCodeBtn"
                                            onclick="emailVerificationUI.sendPasswordResetCode()">
                                        获取验证码
                                    </button>
                                </div>
                                <div class="verification-timer" id="passwordResetTimer" style="display: none;">
                                    <span id="passwordResetCountdown"></span>
                                </div>
                            </div>
                            
                            <div class="form-actions">
                                <button type="submit" class="btn btn-primary btn-full" id="submitPasswordResetBtn">
                                    修改密码
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 监听密码输入，决定是否显示验证码区域
        document.getElementById('confirmNewPassword').addEventListener('blur', () => {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            
            if (currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
                document.getElementById('passwordVerificationSection').style.display = 'block';
            }
        });
    }

    // 发送密码重置验证码
    async sendPasswordResetCode() {
        try {
            const btn = document.getElementById('sendPasswordCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            await emailVerificationService.sendPasswordResetCode();
            
            document.getElementById('passwordResetTimer').style.display = 'block';
            document.getElementById('passwordResetCode').focus();
        } catch (error) {
            console.error('发送密码重置验证码失败:', error);
            const btn = document.getElementById('sendPasswordCodeBtn');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }

    // 提交密码重置
    async submitPasswordReset(event) {
        event.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        const verificationCode = this.getCleanCode('passwordResetCode');

        if (newPassword !== confirmPassword) {
            showToast('新密码与确认密码不一致', 'error');
            return;
        }

        if (!verificationCode || !emailVerificationService.validateVerificationCode(verificationCode)) {
            showToast('请输入正确的验证码', 'error');
            return;
        }

        try {
            await emailVerificationService.changePasswordWithVerification(
                currentPassword, newPassword, verificationCode
            );
            
            this.hidePasswordResetModal();
            
            // 密码修改成功后会自动登出，提示用户重新登录
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            showToast(error.message || '修改密码失败', 'error');
        }
    }

    // 🔧 修复：正确获取注册数据的方法
    getRegistrationData() {
        // 首先尝试从存储的数据中获取
        if (this.verificationData.username && this.verificationData.email && this.verificationData.password) {
            return this.verificationData;
        }

        // 🔧 修复：使用正确的元素ID
        const usernameEl = document.getElementById('regUsername');
        const emailEl = document.getElementById('regEmail');
        const passwordEl = document.getElementById('regPassword');

        if (usernameEl && emailEl && passwordEl) {
            return {
                username: usernameEl.value.trim(),
                email: emailEl.value.trim(),
                password: passwordEl.value
            };
        }

        // 如果都获取不到，返回null
        return null;
    }

    // 工具方法
    showStep(stepId) {
        document.querySelectorAll('.verification-step').forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });
        
        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.add('active');
            targetStep.style.display = 'block';
        }
    }

    formatCodeInput(input) {
        const formatted = emailVerificationService.formatVerificationCode(input.value);
        input.value = formatted;
    }

    handleCodeKeyPress(event, type) {
        if (event.key === 'Enter') {
            event.preventDefault();
            
            switch (type) {
                case 'registration':
                    this.completeRegistration();
                    break;
                case 'password':
                    this.submitPasswordReset(event);
                    break;
                case 'emailChange':
                    this.verifyNewEmailCode();
                    break;
                case 'delete':
                    this.confirmDeleteAccount();
                    break;
            }
        }
    }

    getCleanCode(inputId) {
        const input = document.getElementById(inputId);
        return input ? input.value.replace(/\s/g, '') : '';
    }

    maskEmail(email) {
        if (!email) return '';
        const [localPart, domain] = email.split('@');
        if (localPart.length <= 2) {
            return `${localPart[0]}***@${domain}`;
        }
        const masked = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
        return `${masked}@${domain}`;
    }

    updateCountdownDisplay(type, remaining) {
        const countdownElements = {
            'registration': 'registrationCountdown',
            'password_reset': 'passwordResetCountdown',
            'email_change_new': 'newEmailCountdown',
            'account_delete': 'deleteCountdown'
        };

        const elementId = countdownElements[type];
        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.textContent = `${emailVerificationService.formatRemainingTime(remaining)} 后过期`;
            }
        }

        // 更新重发按钮状态
        this.updateResendButtonState(type, remaining);
    }

    updateResendButtonState(type, remaining) {
        const buttonMaps = {
            'registration': 'resendRegistrationCodeBtn',
            'password_reset': 'sendPasswordCodeBtn',
            'email_change_new': 'sendNewEmailCodeBtn',
            'account_delete': 'sendDeleteCodeBtn'
        };

        const buttonId = buttonMaps[type];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            if (button) {
                if (remaining <= 60) { // 最后60秒允许重发
                    button.disabled = false;
                    button.textContent = button.textContent.replace('发送中...', '重新发送验证码');
                }
            }
        }
    }

    handleVerificationExpired(type) {
        showToast('验证码已过期，请重新获取', 'warning');
        
        // 重置相关按钮状态
        const buttonMaps = {
            'registration': 'resendRegistrationCodeBtn',
            'password_reset': 'sendPasswordCodeBtn',
            'email_change_new': 'sendNewEmailCodeBtn',
            'account_delete': 'sendDeleteCodeBtn'
        };

        const buttonId = buttonMaps[type];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            if (button) {
                button.disabled = false;
                button.textContent = '获取验证码';
            }
        }
    }

    handleEmailChanged(newEmail) {
        showToast('邮箱更改成功！', 'success');
        this.updateEmailDisplays(newEmail);
    }

    updateEmailDisplays(newEmail) {
        // 更新页面中所有显示邮箱的地方
        document.querySelectorAll('.user-email-display').forEach(element => {
            element.textContent = this.maskEmail(newEmail);
        });
    }

    handleAccountDeleted() {
        showToast('账户已删除', 'info');
        // 清除所有本地数据
        localStorage.clear();
        sessionStorage.clear();
    }

    // 隐藏模态框的方法
    hideRegistrationModal() {
        const modal = document.getElementById('registrationVerificationModal');
        if (modal) {
            modal.remove();
        }
    }

    hidePasswordResetModal() {
        const modal = document.getElementById('passwordResetModal');
        if (modal) {
            modal.remove();
        }
    }

    hideEmailChangeModal() {
        const modal = document.getElementById('emailChangeModal');
        if (modal) {
            modal.remove();
        }
    }

    hideAccountDeleteModal() {
        const modal = document.getElementById('accountDeleteModal');
        if (modal) {
            modal.remove();
        }
    }

    // 其他方法保持不变...
    // (为了简洁，这里省略了其他方法，但实际使用时应该包含完整的方法)
}

// 创建全局实例
export const emailVerificationUI = new EmailVerificationUI();

// 确保在页面加载完成后可以使用
if (typeof window !== 'undefined') {
    window.emailVerificationUI = emailVerificationUI;
}