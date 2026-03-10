// src/components/email-verification-ui.js - 完整增强版本，新增智能状态恢复功能
import emailVerificationService from '../services/email-verification-service.js';
import { showToast, showModal, hideModal } from '../utils/dom.js';
import authManager from '../services/auth.js';
import apiService from '../services/api.js';

export class EmailVerificationUI {
    constructor() {
        this.currentStep = 1;
        this.verificationData = {};
        this.countdownIntervals = new Map();
        this.stateRestorationEnabled = true; // 🆕 新增：启用状态恢复功能
        
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

    // 🆕 新增：智能状态检查和恢复方法
    async autoRestoreVerificationState(email, verificationType, userId = null) {
        if (!this.stateRestorationEnabled) return { shouldRestore: false };
        
        try {
            const restoration = await emailVerificationService.autoRestoreVerificationState(
                email, verificationType, userId
            );
            return restoration;
        } catch (error) {
            console.warn('自动恢复验证状态失败:', error);
            return { shouldRestore: false };
        }
    }

    // 🆕 新增：检查用户所有待验证状态
    async checkUserPendingVerifications() {
        try {
            const userStatus = await emailVerificationService.getUserVerificationStatus();
            return userStatus;
        } catch (error) {
            console.warn('检查用户验证状态失败:', error);
            return { hasAnyPendingVerifications: false };
        }
    }

    // 显示忘记密码模态框
    async showForgotPasswordModal(email = null) {
        // 清理可能存在的模态框，避免重复ID
        this.hideForgotPasswordModal();
        
        const modalHtml = `
            <div class="modal-overlay" id="forgotPasswordModal">
                <div class="modal-content verification-modal">
                    <div class="modal-header">
                        <h3>找回密码</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hideForgotPasswordModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- 步骤1：输入邮箱 -->
                        <div class="verification-step active" id="forgotPasswordStep1">
                            <div class="verification-icon">
                                <i class="icon-mail"></i>
                            </div>
                            <p class="verification-text">
                                请输入您的注册邮箱地址，我们将发送验证码到该邮箱
                            </p>
                            <form onsubmit="emailVerificationUI.submitForgotPasswordEmail(event)">
                                <div class="form-group">
                                    <input type="email" 
                                           id="forgotPasswordEmail" 
                                           placeholder="请输入注册邮箱" 
                                           required 
                                           autocomplete="email"
                                           value="${email || ''}">
                                </div>
                                <button type="submit" class="btn btn-primary btn-full" id="sendForgotCodeBtn">
                                    发送验证码
                                </button>
                            </form>
                        </div>
                        
                        <!-- 步骤2：输入验证码和新密码 -->
                        <div class="verification-step" id="forgotPasswordStep2" style="display: none;">
                            <div class="verification-icon">
                                <i class="icon-shield-check"></i>
                            </div>
                            <p class="verification-text">
                                请输入发送到 <strong id="forgotPasswordMaskedEmail"></strong> 的验证码，并设置新密码
                            </p>
                            <form onsubmit="emailVerificationUI.submitPasswordReset(event)">
                                <div class="form-group">
                                    <label>邮箱验证码</label>
                                    <div class="verification-code-input">
                                        <input type="text" 
                                               id="forgotPasswordCode" 
                                               placeholder="000 000" 
                                               maxlength="7"
                                               autocomplete="off"
                                               oninput="emailVerificationUI.formatCodeInput(this)"
                                               onkeypress="emailVerificationUI.handleCodeKeyPress(event, 'forgot_password')">
                                    </div>
                                    <div class="verification-timer" id="forgotPasswordTimer" style="display: none;">
                                        <span id="forgotPasswordCountdown"></span>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label>新密码</label>
                                    <input type="password" 
                                           id="forgotPasswordNewPassword" 
                                           placeholder="请输入新密码（至少6位）" 
                                           required 
                                           minlength="6"
                                           autocomplete="new-password">
                                </div>
                                
                                <div class="form-group">
                                    <label>确认新密码</label>
                                    <input type="password" 
                                           id="forgotPasswordConfirmPassword" 
                                           placeholder="请再次输入新密码" 
                                           required 
                                           minlength="6"
                                           autocomplete="new-password">
                                </div>
                                
                                <div class="verification-actions">
                                    <button type="submit" class="btn btn-primary btn-full">
                                        重置密码
                                    </button>
                                    <button type="button" 
                                            class="btn btn-secondary btn-full" 
                                            id="resendForgotCodeBtn"
                                            onclick="emailVerificationUI.resendForgotPasswordCode()" 
                                            disabled>
                                        重新发送验证码
                                    </button>
                                    <button type="button" 
                                            class="btn btn-outline btn-full" 
                                            onclick="emailVerificationUI.goBackToEmailInput()">
                                        返回上一步
                                    </button>
                                </div>
                            </form>
                        </div>
                        
                        <!-- 步骤3：成功提示 -->
                        <div class="verification-step" id="forgotPasswordStep3" style="display: none;">
                            <div class="verification-success">
                                <div class="success-icon">
                                    <i class="icon-check-circle"></i>
                                </div>
                                <h4>密码重置成功！</h4>
                                <p>您的密码已成功重置，请使用新密码登录</p>
                                <div class="success-actions">
                                    <button class="btn btn-primary btn-full" 
                                            onclick="emailVerificationUI.redirectToLogin()">
                                        去登录
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 🆕 尝试恢复验证状态
        if (email && this.stateRestorationEnabled) {
            try {
                const restoration = await this.autoRestoreVerificationState(
                    email, 'forgot_password'
                );
                
                if (restoration.shouldRestore) {
                    console.log('恢复忘记密码验证状态:', restoration.state);
                    this.restoreForgotPasswordState(restoration.state, email);
                }
            } catch (error) {
                console.warn('恢复忘记密码状态失败:', error);
            }
        }
    }

    // 🆕 新增：恢复忘记密码验证状态
    restoreForgotPasswordState(state, email) {
        this.verificationData.forgotPasswordEmail = email;
        
        // 切换到验证码输入步骤
        this.showForgotPasswordStep(2);
        
        // 设置邮箱掩码显示
        document.getElementById('forgotPasswordMaskedEmail').textContent = state.email;
        
        // 启动倒计时显示
        document.getElementById('forgotPasswordTimer').style.display = 'block';
        
        // 设置重新发送按钮状态
        const resendBtn = document.getElementById('resendForgotCodeBtn');
        if (resendBtn) {
            resendBtn.disabled = !state.canResend;
            if (state.canResend) {
                resendBtn.textContent = '重新发送验证码';
            } else {
                resendBtn.textContent = '发送中...';
            }
        }

        // 聚焦到验证码输入框
        setTimeout(() => {
            const codeInput = document.getElementById('forgotPasswordCode');
            if (codeInput) {
                codeInput.focus();
            }
        }, 100);

        // 显示状态恢复提示
        showToast('已恢复验证状态，请输入验证码', 'info');
    }

    // 提交忘记密码邮箱
    async submitForgotPasswordEmail(event) {
        event.preventDefault();
        
        const email = document.getElementById('forgotPasswordEmail').value.trim();
        
        if (!email) {
            showToast('请输入邮箱地址', 'error');
            return;
        }

        try {
            const btn = document.getElementById('sendForgotCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            // 存储邮箱地址供后续使用
            this.verificationData.forgotPasswordEmail = email;

            // 🆕 使用智能发送验证码（会先检查状态）
            const result = await emailVerificationService.smartSendVerificationCode
                ? await emailVerificationService.smartSendVerificationCode(email, 'forgot_password')
                : await emailVerificationService.sendForgotPasswordCode(email);
            
            if (result.success) {
                if (result.hasPendingCode) {
                    // 存在有效验证码，直接切换到步骤2
                    this.showForgotPasswordStep(2);
                    document.getElementById('forgotPasswordMaskedEmail').textContent = result.existingVerification?.email || email;
                    document.getElementById('forgotPasswordTimer').style.display = 'block';
                    
                    showToast('检测到有效验证码，请直接输入', 'info');
                } else {
                    // 发送了新验证码或使用传统方法
                    this.showForgotPasswordStep(2);
                    document.getElementById('forgotPasswordMaskedEmail').textContent = result.maskedEmail;
                    document.getElementById('forgotPasswordTimer').style.display = 'block';
                }
                
                // 聚焦到验证码输入框
                setTimeout(() => {
                    document.getElementById('forgotPasswordCode').focus();
                }, 100);
            }
        } catch (error) {
            console.error('发送忘记密码验证码失败:', error);
            const btn = document.getElementById('sendForgotCodeBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '发送验证码';
            }
        }
    }

    // 重新发送忘记密码验证码
    async resendForgotPasswordCode() {
        const email = this.verificationData.forgotPasswordEmail;
        if (!email) {
            showToast('邮箱地址丢失，请返回重新输入', 'error');
            this.goBackToEmailInput();
            return;
        }

        try {
            const btn = document.getElementById('resendForgotCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            // 🆕 强制发送新验证码
            if (emailVerificationService.smartSendVerificationCode) {
                await emailVerificationService.smartSendVerificationCode(email, 'forgot_password', true);
            } else {
                await emailVerificationService.sendForgotPasswordCode(email);
            }
            
            // 重新启动倒计时
            document.getElementById('forgotPasswordTimer').style.display = 'block';
            
        } catch (error) {
            console.error('重新发送验证码失败:', error);
            const btn = document.getElementById('resendForgotCodeBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '重新发送验证码';
            }
        }
    }

    // 提交密码重置
    async submitPasswordReset(event) {
        event.preventDefault();
        
        const email = this.verificationData.forgotPasswordEmail;
        const code = this.getCleanCode('forgotPasswordCode');
        const newPassword = document.getElementById('forgotPasswordNewPassword').value;
        const confirmPassword = document.getElementById('forgotPasswordConfirmPassword').value;

        // 验证输入
        if (!email) {
            showToast('邮箱地址丢失，请返回重新输入', 'error');
            this.goBackToEmailInput();
            return;
        }

        if (!emailVerificationService.validateVerificationCode(code)) {
            showToast('请输入正确的6位验证码', 'error');
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            showToast('新密码长度至少6个字符', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }

        try {
            const result = await emailVerificationService.resetPasswordWithCode(
                email, code, newPassword
            );

            if (result.success) {
                // 切换到成功步骤
                this.showForgotPasswordStep(3);
                
                // 清理验证数据
                this.verificationData.forgotPasswordEmail = null;
            }
        } catch (error) {
            console.error('密码重置失败:', error);
            // 错误处理已在service层完成，这里不需要重复显示toast
        }
    }

    // 返回邮箱输入步骤
    goBackToEmailInput() {
        this.showForgotPasswordStep(1);
        
        // 清空之前输入的内容
        const emailInput = document.getElementById('forgotPasswordEmail');
        if (emailInput) {
            emailInput.value = '';
            emailInput.focus();
        }
        
        // 清理验证数据
        this.verificationData.forgotPasswordEmail = null;
        emailVerificationService.clearVerification('forgot_password');
    }

    // 重定向到登录
    redirectToLogin() {
        this.hideForgotPasswordModal();
        
        // 显示登录模态框
        const loginModal = document.getElementById('loginModal');
        if (loginModal) {
            loginModal.style.display = 'block';
            
            // 如果有保存的邮箱地址，自动填入登录表单
            const savedEmail = this.verificationData.forgotPasswordEmail;
            if (savedEmail) {
                const loginUsernameInput = document.getElementById('loginUsername');
                if (loginUsernameInput) {
                    loginUsernameInput.value = savedEmail;
                    
                    // 聚焦到密码输入框
                    const loginPasswordInput = document.getElementById('loginPassword');
                    if (loginPasswordInput) {
                        loginPasswordInput.focus();
                    }
                }
            }
        }
        
        showToast('请使用新密码登录', 'info');
    }

    // 显示忘记密码的指定步骤
    showForgotPasswordStep(stepNumber) {
        // 隐藏所有步骤
        document.querySelectorAll('#forgotPasswordModal .verification-step').forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });
        
        // 显示指定步骤
        const targetStep = document.getElementById(`forgotPasswordStep${stepNumber}`);
        if (targetStep) {
            targetStep.classList.add('active');
            targetStep.style.display = 'block';
        }
    }

    // 隐藏忘记密码模态框
    hideForgotPasswordModal() {
        const modal = document.getElementById('forgotPasswordModal');
        if (modal) {
            modal.remove();
        }
        
        // 清理相关数据和定时器
        this.verificationData.forgotPasswordEmail = null;
        emailVerificationService.clearVerification('forgot_password');
    }

    // 显示注册验证码模态框
    async showRegistrationVerificationModal(email = null) {
        const targetEmail = email || this.verificationData?.email;
        if (!targetEmail) {
            showToast('缺少邮箱地址信息', 'error');
            return;
        }

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
                                我们将向 <strong>${this.maskEmail(targetEmail)}</strong> 发送6位验证码
                            </p>
                            <button class="btn btn-primary btn-full" id="sendRegistrationCodeBtn" 
                                    onclick="emailVerificationUI.sendRegistrationCode()">
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
                            <div class="verification-timer" id="registrationTimer" style="display: none;">
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

        // 🆕 尝试恢复验证状态
        if (this.stateRestorationEnabled) {
            try {
                const restoration = await this.autoRestoreVerificationState(
                    targetEmail, 'registration'
                );
                
                if (restoration.shouldRestore) {
                    console.log('恢复注册验证状态:', restoration.state);
                    this.restoreRegistrationState(restoration.state);
                }
            } catch (error) {
                console.warn('恢复注册状态失败:', error);
            }
        }
    }

    // 🆕 新增：恢复注册验证状态
    restoreRegistrationState(state) {
        // 切换到验证码输入步骤
        this.showStep('step-enter-code');
        
        // 设置邮箱掩码显示
        document.getElementById('maskedEmailDisplay').textContent = state.email;
        
        // 启动倒计时显示
        document.getElementById('registrationTimer').style.display = 'block';
        
        // 设置重新发送按钮状态
        const resendBtn = document.getElementById('resendRegistrationCodeBtn');
        if (resendBtn) {
            resendBtn.disabled = !state.canResend;
        }

        // 聚焦到验证码输入框
        setTimeout(() => {
            document.getElementById('registrationVerificationCode').focus();
        }, 100);

        // 显示状态恢复提示
        showToast('已恢复验证状态，请输入验证码', 'info');
    }

    // 发送注册验证码
    async sendRegistrationCode() {
        try {
            const email = this.verificationData?.email;
            if (!email) {
                throw new Error('缺少邮箱地址信息');
            }

            const btn = document.getElementById('sendRegistrationCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            // 🆕 使用智能发送验证码（如果可用）
            let result;
            if (emailVerificationService.smartSendVerificationCode) {
                result = await emailVerificationService.smartSendVerificationCode(email, 'registration');
            } else {
                result = await emailVerificationService.sendRegistrationCode(email);
            }
            
            if (result.success) {
                this.showStep('step-enter-code');
                
                if (result.hasPendingCode) {
                    document.getElementById('maskedEmailDisplay').textContent = result.existingVerification?.email || email;
                    showToast('检测到有效验证码，请直接输入', 'info');
                } else {
                    document.getElementById('maskedEmailDisplay').textContent = result.maskedEmail;
                }
                
                document.getElementById('registrationTimer').style.display = 'block';
                
                setTimeout(() => {
                    document.getElementById('registrationVerificationCode').focus();
                }, 100);
            }
        } catch (error) {
            console.error('发送注册验证码失败:', error);
            const btn = document.getElementById('sendRegistrationCodeBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '发送验证码';
            }
        }
    }

    // 重新发送注册验证码
    async resendRegistrationCode() {
        const email = this.verificationData?.email;
        if (!email) {
            showToast('邮箱地址信息丢失', 'error');
            return;
        }

        try {
            const btn = document.getElementById('resendRegistrationCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            // 🆕 强制发送新验证码
            if (emailVerificationService.smartSendVerificationCode) {
                await emailVerificationService.smartSendVerificationCode(email, 'registration', true);
            } else {
                await emailVerificationService.sendRegistrationCode(email);
            }
            
        } catch (error) {
            console.error('重新发送验证码失败:', error);
            const btn = document.getElementById('resendRegistrationCodeBtn');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '重新发送验证码';
            }
        }
    }

    // 完成注册（带验证码）
    async completeRegistration() {
        try {
            const code = this.getCleanCode('registrationVerificationCode');
            if (!emailVerificationService.validateVerificationCode(code)) {
                showToast('请输入正确的6位验证码', 'error');
                return;
            }

            const registrationData = this.getRegistrationData();
            if (!registrationData) {
                showToast('注册信息不完整，请重新填写表单', 'error');
                this.hideRegistrationModal();
                return;
            }

            const result = await emailVerificationService.verifyRegistrationCode(
                registrationData,
                code
            );

            if (result.success) {
                this.hideRegistrationModal();
                
                setTimeout(async () => {
                    if (window.app && window.app.authManager) {
                        try {
                            await window.app.authManager.login(registrationData.username, registrationData.password);
                            showToast('注册成功，已自动登录！', 'success');
                        } catch (loginError) {
                            console.error('自动登录失败:', loginError);
                            showToast('注册成功，请手动登录', 'info');
                        }
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('注册验证失败:', error);
        }
    }

    // 显示密码重置验证模态框（已登录用户）
    async showPasswordResetModal() {
        const user = authManager.getCurrentUser();
        if (!user) {
            showToast('请先登录', 'error');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="passwordResetModal">
                <div class="modal-content verification-modal">
                    <div class="modal-header">
                        <h3>修改密码</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hidePasswordResetModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="passwordResetForm" onsubmit="emailVerificationUI.submitPasswordResetForLoggedUser(event)">
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
        
        document.getElementById('confirmNewPassword').addEventListener('blur', () => {
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmNewPassword').value;
            
            if (currentPassword && newPassword && confirmPassword && newPassword === confirmPassword) {
                document.getElementById('passwordVerificationSection').style.display = 'block';
            }
        });

        // 🆕 尝试恢复验证状态
        if (this.stateRestorationEnabled) {
            try {
                const userStatus = await this.checkUserPendingVerifications();
                const passwordResetVerification = userStatus.pendingVerifications?.find(
                    v => v.verificationType === 'password_reset'
                );
                
                if (passwordResetVerification) {
                    console.log('恢复密码重置验证状态:', passwordResetVerification);
                    this.restorePasswordResetState(passwordResetVerification);
                }
            } catch (error) {
                console.warn('恢复密码重置状态失败:', error);
            }
        }
    }

    // 🆕 新增：恢复密码重置验证状态
    restorePasswordResetState(state) {
        // 显示验证部分
        document.getElementById('passwordVerificationSection').style.display = 'block';
        
        // 启动倒计时显示
        document.getElementById('passwordResetTimer').style.display = 'block';
        
        // 设置获取验证码按钮状态
        const sendBtn = document.getElementById('sendPasswordCodeBtn');
        if (sendBtn) {
            sendBtn.disabled = !state.canResend;
            if (state.canResend) {
                sendBtn.textContent = '获取验证码';
            } else {
                sendBtn.textContent = '发送中...';
            }
        }

        // 聚焦到验证码输入框
        setTimeout(() => {
            document.getElementById('passwordResetCode').focus();
        }, 100);

        // 显示状态恢复提示
        showToast('检测到验证码发送记录，请输入验证码', 'info');
    }

    // 发送密码重置验证码（已登录用户）
    async sendPasswordResetCode() {
        try {
            const btn = document.getElementById('sendPasswordCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            await emailVerificationService.sendPasswordResetCode();
            
            document.getElementById('passwordResetTimer').style.display = 'block';
            document.getElementById('passwordResetCode').focus();
        } catch (error) {
            const btn = document.getElementById('sendPasswordCodeBtn');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }

    // 提交密码重置（已登录用户）
    async submitPasswordResetForLoggedUser(event) {
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
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (error) {
            showToast(error.message || '修改密码失败', 'error');
        }
    }

    // 显示邮箱更改模态框
    async showEmailChangeModal() {
        const user = authManager.getCurrentUser();
        if (!user) {
            showToast('请先登录', 'error');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="emailChangeModal">
                <div class="modal-content verification-modal">
                    <div class="modal-header">
                        <h3>更改绑定邮箱</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hideEmailChangeModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="email-change-steps">
                            <div class="step-indicator">
                                <div class="step active" id="stepIndicator1">1</div>
                                <div class="step-line"></div>
                                <div class="step" id="stepIndicator2">2</div>
                                <div class="step-line"></div>
                                <div class="step" id="stepIndicator3">3</div>
                            </div>
                            <div class="step-labels">
                                <span>输入新邮箱</span>
                                <span>验证新邮箱</span>
                                <span>完成更改</span>
                            </div>
                        </div>

                        <div class="email-change-step active" id="emailChangeStep1">
                            <form onsubmit="emailVerificationUI.submitEmailChangeRequest(event)">
                                <div class="form-group">
                                    <label>当前邮箱</label>
                                    <input type="email" value="${this.maskEmail(user.email)}" disabled>
                                </div>
                                <div class="form-group">
                                    <label>新邮箱地址</label>
                                    <input type="email" id="newEmailAddress" required placeholder="输入新的邮箱地址">
                                </div>
                                <div class="form-group">
                                    <label>当前密码</label>
                                    <input type="password" id="emailChangePassword" required placeholder="输入当前密码进行验证">
                                </div>
                                <button type="submit" class="btn btn-primary btn-full">下一步</button>
                            </form>
                        </div>

                        <div class="email-change-step" id="emailChangeStep2" style="display: none;">
                            <div class="verification-info">
                                <p>我们需要验证您的新邮箱地址：<strong id="newEmailDisplay"></strong></p>
                            </div>
                            
                            <div class="verification-code-group">
                                <input type="text" 
                                       id="newEmailVerificationCode" 
                                       placeholder="000 000" 
                                       maxlength="7"
                                       oninput="emailVerificationUI.formatCodeInput(this)">
                                <button type="button" 
                                        class="btn btn-secondary" 
                                        id="sendNewEmailCodeBtn"
                                        onclick="emailVerificationUI.sendNewEmailCode()">
                                    获取验证码
                                </button>
                            </div>
                            
                            <div class="verification-timer" id="newEmailTimer" style="display: none;">
                                <span id="newEmailCountdown"></span>
                            </div>
                            
                            <div class="form-actions">
                                <button class="btn btn-primary btn-full" 
                                        onclick="emailVerificationUI.verifyNewEmailCode()">
                                    验证新邮箱
                                </button>
                                <button class="btn btn-secondary btn-full" 
                                        onclick="emailVerificationUI.goBackToStep1()">
                                    返回上一步
                                </button>
                            </div>
                        </div>

                        <div class="email-change-step" id="emailChangeStep3" style="display: none;">
                            <div class="verification-success">
                                <div class="success-icon">
                                    <i class="icon-check-circle"></i>
                                </div>
                                <h4>邮箱更改成功！</h4>
                                <p>您的账户邮箱已成功更改为：<br><strong id="finalNewEmail"></strong></p>
                                <button class="btn btn-primary btn-full" 
                                        onclick="emailVerificationUI.hideEmailChangeModal()">
                                    完成
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 🆕 尝试恢复邮箱更改状态
        if (this.stateRestorationEnabled) {
            try {
                const userStatus = await this.checkUserPendingVerifications();
                if (userStatus.emailChangeRequest) {
                    console.log('恢复邮箱更改状态:', userStatus.emailChangeRequest);
                    this.restoreEmailChangeState(userStatus.emailChangeRequest);
                }
            } catch (error) {
                console.warn('恢复邮箱更改状态失败:', error);
            }
        }
    }

    // 🆕 新增：恢复邮箱更改状态
    restoreEmailChangeState(emailChangeRequest) {
        // 保存请求信息
        this.verificationData.emailChangeRequestId = emailChangeRequest.id;
        this.verificationData.newEmail = emailChangeRequest.newEmail.replace(/\*/g, ''); // 尝试从掩码中获取

        if (emailChangeRequest.newEmailVerified) {
            // 如果新邮箱已验证，直接到成功页面
            this.showEmailChangeStep(3);
            document.getElementById('finalNewEmail').textContent = emailChangeRequest.newEmail;
        } else {
            // 切换到验证步骤
            this.showEmailChangeStep(2);
            document.getElementById('newEmailDisplay').textContent = emailChangeRequest.newEmail;
            
            // 如果有新邮箱验证码，显示计时器
            if (emailChangeRequest.verifications && emailChangeRequest.verifications.newEmail) {
                document.getElementById('newEmailTimer').style.display = 'block';
                
                // 设置发送按钮状态
                const sendBtn = document.getElementById('sendNewEmailCodeBtn');
                if (sendBtn) {
                    sendBtn.disabled = !emailChangeRequest.verifications.newEmail.canResend;
                }
            }
        }

        showToast('已恢复邮箱更改状态', 'info');
    }

    // 提交邮箱更改请求
    async submitEmailChangeRequest(event) {
        event.preventDefault();
        
        const newEmail = document.getElementById('newEmailAddress').value;
        const password = document.getElementById('emailChangePassword').value;

        try {
            const result = await emailVerificationService.requestEmailChange(newEmail, password);
            
            if (result.success) {
                this.verificationData.emailChangeRequestId = result.requestId;
                this.verificationData.newEmail = newEmail;
                
                this.showEmailChangeStep(2);
                document.getElementById('newEmailDisplay').textContent = this.maskEmail(newEmail);
            }
        } catch (error) {
            showToast(error.message || '请求失败', 'error');
        }
    }

    // 发送新邮箱验证码
    async sendNewEmailCode() {
        try {
            const btn = document.getElementById('sendNewEmailCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            await emailVerificationService.sendEmailChangeCode(
                this.verificationData.emailChangeRequestId, 'new'
            );
            
            document.getElementById('newEmailTimer').style.display = 'block';
            document.getElementById('newEmailVerificationCode').focus();
        } catch (error) {
            const btn = document.getElementById('sendNewEmailCodeBtn');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }

    // 验证新邮箱验证码
    async verifyNewEmailCode() {
        const code = this.getCleanCode('newEmailVerificationCode');
        
        if (!emailVerificationService.validateVerificationCode(code)) {
            showToast('请输入正确的验证码', 'error');
            return;
        }

        try {
            const result = await emailVerificationService.verifyEmailChangeCode(
                this.verificationData.emailChangeRequestId, 'new', code
            );
            
            if (result.completed) {
                this.showEmailChangeStep(3);
                document.getElementById('finalNewEmail').textContent = this.verificationData.newEmail;
                
                const currentUser = authManager.getCurrentUser();
                if (currentUser) {
                    currentUser.email = this.verificationData.newEmail;
                    authManager.updateCurrentUser(currentUser);
                }
            }
        } catch (error) {
            showToast(error.message || '验证失败', 'error');
        }
    }

    // 显示账户删除确认模态框
    async showAccountDeleteModal() {
        const user = authManager.getCurrentUser();
        if (!user) {
            showToast('请先登录', 'error');
            return;
        }

        const modalHtml = `
            <div class="modal-overlay" id="accountDeleteModal">
                <div class="modal-content verification-modal danger-modal">
                    <div class="modal-header">
                        <h3>删除账户</h3>
                        <button class="modal-close" onclick="emailVerificationUI.hideAccountDeleteModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="danger-warning">
                            <div class="warning-icon">
                                <i class="icon-alert-triangle"></i>
                            </div>
                            <h4>警告：此操作无法撤销</h4>
                            <p>删除账户将永久移除以下数据：</p>
                            <ul>
                                <li>个人资料和设置</li>
                                <li>所有收藏夹</li>
                                <li>搜索历史记录</li>
                                <li>社区分享的搜索源</li>
                                <li>评论和评分</li>
                            </ul>
                        </div>

                        <div class="delete-confirmation" id="deleteConfirmationSection" style="display: none;">
                            <div class="form-group">
                                <label>请输入以下文字以确认删除：</label>
                                <div class="confirmation-text">删除我的账户</div>
                                <input type="text" id="deleteConfirmText" placeholder="请输入确认文字">
                            </div>
                            
                            <div class="verification-section">
                                <p class="verification-info">
                                    为了安全，请输入发送到您邮箱的验证码
                                </p>
                                <div class="verification-code-group">
                                    <input type="text" 
                                           id="deleteVerificationCode" 
                                           placeholder="000 000" 
                                           maxlength="7"
                                           oninput="emailVerificationUI.formatCodeInput(this)">
                                    <button type="button" 
                                            class="btn btn-secondary" 
                                            id="sendDeleteCodeBtn"
                                            onclick="emailVerificationUI.sendDeleteCode()">
                                        获取验证码
                                    </button>
                                </div>
                                <div class="verification-timer" id="deleteTimer" style="display: none;">
                                    <span id="deleteCountdown"></span>
                                </div>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button class="btn btn-danger btn-full" 
                                    id="proceedDeleteBtn"
                                    onclick="emailVerificationUI.proceedToDelete()">
                                我理解风险，继续删除
                            </button>
                            <button class="btn btn-secondary btn-full" 
                                    id="confirmDeleteBtn"
                                    onclick="emailVerificationUI.confirmDeleteAccount()" 
                                    style="display: none;">
                                确认删除账户
                            </button>
                            <button class="btn btn-secondary btn-full" 
                                    onclick="emailVerificationUI.hideAccountDeleteModal()">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // 🆕 尝试恢复账户删除状态
        if (this.stateRestorationEnabled) {
            try {
                const userStatus = await this.checkUserPendingVerifications();
                const deleteVerification = userStatus.pendingVerifications?.find(
                    v => v.verificationType === 'account_delete'
                );
                
                if (deleteVerification) {
                    console.log('恢复账户删除验证状态:', deleteVerification);
                    this.restoreAccountDeleteState(deleteVerification);
                }
            } catch (error) {
                console.warn('恢复账户删除状态失败:', error);
            }
        }
    }

    // 🆕 新增：恢复账户删除验证状态
    restoreAccountDeleteState(state) {
        // 直接进入确认删除流程
        this.proceedToDelete();
        
        // 启动倒计时显示
        document.getElementById('deleteTimer').style.display = 'block';
        
        // 设置获取验证码按钮状态
        const sendBtn = document.getElementById('sendDeleteCodeBtn');
        if (sendBtn) {
            sendBtn.disabled = !state.canResend;
            if (state.canResend) {
                sendBtn.textContent = '获取验证码';
            } else {
                sendBtn.textContent = '发送中...';
            }
        }

        // 聚焦到验证码输入框
        setTimeout(() => {
            document.getElementById('deleteVerificationCode').focus();
        }, 100);

        showToast('检测到账户删除验证码发送记录', 'info');
    }

    // 继续删除流程
    proceedToDelete() {
        document.getElementById('deleteConfirmationSection').style.display = 'block';
        document.getElementById('proceedDeleteBtn').style.display = 'none';
        document.getElementById('confirmDeleteBtn').style.display = 'block';
        document.getElementById('deleteConfirmText').focus();
    }

    // 发送删除验证码
    async sendDeleteCode() {
        try {
            const btn = document.getElementById('sendDeleteCodeBtn');
            btn.disabled = true;
            btn.textContent = '发送中...';

            await emailVerificationService.sendAccountDeleteCode();
            
            document.getElementById('deleteTimer').style.display = 'block';
            document.getElementById('deleteVerificationCode').focus();
        } catch (error) {
            const btn = document.getElementById('sendDeleteCodeBtn');
            btn.disabled = false;
            btn.textContent = '获取验证码';
        }
    }

    // 确认删除账户
    async confirmDeleteAccount() {
        const confirmText = document.getElementById('deleteConfirmText').value;
        const verificationCode = this.getCleanCode('deleteVerificationCode');

        if (confirmText !== '删除我的账户') {
            showToast('请输入正确的确认文字', 'error');
            return;
        }

        if (!emailVerificationService.validateVerificationCode(verificationCode)) {
            showToast('请输入正确的验证码', 'error');
            return;
        }

        try {
            await emailVerificationService.deleteAccountWithVerification(verificationCode, confirmText);
            
            this.hideAccountDeleteModal();
            
            setTimeout(() => {
                authManager.clearAuth();
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            showToast(error.message || '删除账户失败', 'error');
        }
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

    showEmailChangeStep(stepNumber) {
        // 更新步骤指示器
        document.querySelectorAll('.step').forEach((step, index) => {
            if (index + 1 <= stepNumber) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });

        // 切换步骤内容
        document.querySelectorAll('.email-change-step').forEach(step => {
            step.classList.remove('active');
            step.style.display = 'none';
        });
        
        const targetStep = document.getElementById(`emailChangeStep${stepNumber}`);
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
                    this.submitPasswordResetForLoggedUser(event);
                    break;
                case 'forgot_password':
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
            'forgot_password': 'forgotPasswordCountdown',
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

        this.updateResendButtonState(type, remaining);
    }

    updateResendButtonState(type, remaining) {
        const buttonMaps = {
            'registration': 'resendRegistrationCodeBtn',
            'password_reset': 'sendPasswordCodeBtn',
            'forgot_password': 'resendForgotCodeBtn',
            'email_change_new': 'sendNewEmailCodeBtn',
            'account_delete': 'sendDeleteCodeBtn'
        };

        const buttonId = buttonMaps[type];
        if (buttonId) {
            const button = document.getElementById(buttonId);
            if (button) {
                if (remaining <= 60) {
                    button.disabled = false;
                    button.textContent = button.textContent.replace('发送中...', '重新发送验证码');
                }
            }
        }
    }

    handleVerificationExpired(type) {
        showToast('验证码已过期，请重新获取', 'warning');
        
        const buttonMaps = {
            'registration': 'resendRegistrationCodeBtn',
            'password_reset': 'sendPasswordCodeBtn',
            'forgot_password': 'resendForgotCodeBtn',
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
        document.querySelectorAll('.user-email-display').forEach(element => {
            element.textContent = this.maskEmail(newEmail);
        });
    }

    handleAccountDeleted() {
        showToast('账户已删除', 'info');
        localStorage.clear();
        sessionStorage.clear();
    }

    getRegistrationData() {
        if (this.verificationData && 
            this.verificationData.username && 
            this.verificationData.email && 
            this.verificationData.password) {
            console.log('从verificationData获取注册数据:', {
                username: this.verificationData.username,
                email: this.verificationData.email
            });
            return this.verificationData;
        }

        const usernameEl = document.getElementById('regUsername');
        const emailEl = document.getElementById('regEmail');
        const passwordEl = document.getElementById('regPassword');

        if (usernameEl && emailEl && passwordEl) {
            const data = {
                username: usernameEl.value.trim(),
                email: emailEl.value.trim(),
                password: passwordEl.value
            };
            
            if (data.username && data.email && data.password) {
                console.log('从DOM获取到注册数据:', { username: data.username, email: data.email });
                return data;
            }
        }

        console.error('无法获取注册表单数据');
        return null;
    }

    setRegistrationData(username, email, password) {
        this.verificationData = {
            username: username.trim(),
            email: email.trim(),
            password: password
        };
        console.log('已设置注册数据:', { username, email });
    }

    // 🆕 新增：智能启动注册验证流程
    async startRegistrationWithVerification(registrationForm) {
        try {
            let registrationData;
            
            if (typeof registrationForm === 'object' && registrationForm.username) {
                registrationData = registrationForm;
            } else if (typeof registrationForm === 'string' || registrationForm instanceof HTMLFormElement) {
                registrationData = this.extractFormData(registrationForm);
            } else {
                registrationData = this.getRegistrationData();
            }

            if (!registrationData) {
                throw new Error('无法获取注册信息，请检查表单数据');
            }

            if (!registrationData.username || !registrationData.email || !registrationData.password) {
                throw new Error('请填写完整的注册信息');
            }

            this.setRegistrationData(
                registrationData.username,
                registrationData.email,
                registrationData.password
            );

            await this.showRegistrationVerificationModal(registrationData.email);

        } catch (error) {
            console.error('启动注册验证流程失败:', error);
            showToast(error.message || '启动注册验证失败', 'error');
        }
    }

    extractFormData(formSelector) {
        const form = typeof formSelector === 'string' 
            ? document.querySelector(formSelector)
            : formSelector;

        if (!form) return null;

        const formData = new FormData(form);
        return {
            username: formData.get('username') || '',
            email: formData.get('email') || '',
            password: formData.get('password') || ''
        };
    }

    goBackToStep1() {
        this.showEmailChangeStep(1);
    }

    // 隐藏模态框的方法
    hideRegistrationModal() {
        const modal = document.getElementById('registrationVerificationModal');
        if (modal) modal.remove();
    }

    hidePasswordResetModal() {
        const modal = document.getElementById('passwordResetModal');
        if (modal) modal.remove();
    }

    hideEmailChangeModal() {
        const modal = document.getElementById('emailChangeModal');
        if (modal) modal.remove();
    }

    hideAccountDeleteModal() {
        const modal = document.getElementById('accountDeleteModal');
        if (modal) modal.remove();
    }
}

// 创建全局实例
export const emailVerificationUI = new EmailVerificationUI();

// 确保在页面加载完成后可以使用
if (typeof window !== 'undefined') {
    window.emailVerificationUI = emailVerificationUI;
}