// src/components/email-verification-ui.js - 邮箱验证UI组件
import emailVerificationService from '../services/email-verification-service.js';
import { showToast, showModal, hideModal } from '../utils/dom.js';
import authManager from '../services/auth.js';
import apiService from '../services/api.js';

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
    showRegistrationVerificationModal(email = null) {
        // 确保有邮箱地址
        const targetEmail = email || this.verificationData?.email;
        if (!targetEmail) {
            showToast('缺少邮箱地址信息', 'error');
            return;
        }

        // 先清理可能存在的模态框，避免重复ID
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
    }

    // 🆕 新增：清理所有验证模态框的方法
    clearAllVerificationModals() {
        // 清理可能存在的所有验证模态框
        const modalIds = [
            'registrationVerificationModal',
            'passwordResetModal', 
            'emailChangeModal',
            'accountDeleteModal'
        ];
        
        modalIds.forEach(modalId => {
            const existingModal = document.getElementById(modalId);
            if (existingModal) {
                existingModal.remove();
                console.log(`已清理模态框: ${modalId}`);
            }
        });
        
        // 清理可能的重复元素
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            if (modal.classList.contains('verification-modal') || 
                modal.innerHTML.includes('verification-')) {
                modal.remove();
            }
        });
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

            // 通过emailVerificationService发送验证码
            const result = await emailVerificationService.sendRegistrationCode(email);
            
            if (result.success) {
                // 切换到输入验证码步骤
                this.showStep('step-enter-code');
                document.getElementById('maskedEmailDisplay').textContent = result.maskedEmail;
                document.getElementById('registrationTimer').style.display = 'block';
                
                // 聚焦到验证码输入框
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

        // 获取注册表单数据 - 针对你的HTML结构优化
        const registrationData = this.getRegistrationData();
        if (!registrationData) {
            showToast('注册信息不完整，请重新填写表单', 'error');
            this.hideRegistrationModal();
            return;
        }

        // 通过emailVerificationService处理注册验证，而不是直接调用API
        const result = await emailVerificationService.verifyRegistrationCode(
            registrationData,
            code
        );

        if (result.success) {
            this.hideRegistrationModal();
            
            // 自动登录新注册的用户 - 使用你HTML中的app实例
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
        // 错误处理已在service层完成，这里不需要重复显示toast
    }
}

    // 显示密码重置验证模态框
    showPasswordResetModal() {
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

    // 显示邮箱更改模态框
    showEmailChangeModal() {
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

                        <!-- 步骤1：输入新邮箱 -->
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

                        <!-- 步骤2：验证新邮箱 -->
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

                        <!-- 步骤3：完成提示 -->
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
                
                // 切换到步骤2
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
                // 邮箱更改完成，显示成功页面
                this.showEmailChangeStep(3);
                document.getElementById('finalNewEmail').textContent = this.verificationData.newEmail;
                
                // 更新当前用户信息
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
    showAccountDeleteModal() {
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
            
            // 账户删除成功，清除本地数据并跳转
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

        // 显示对应步骤
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
        // 可以在这里更新UI中显示的邮箱地址
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

    // 获取注册数据（需要与注册表单集成）
getRegistrationData() {
    // 优先从存储的数据中获取（你的HTML已经正确存储了数据）
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

    // 备用方案：从你的HTML表单元素获取
    // 根据你的HTML，使用正确的ID
    const usernameEl = document.getElementById('regUsername');
    const emailEl = document.getElementById('regEmail');
    const passwordEl = document.getElementById('regPassword');

    if (usernameEl && emailEl && passwordEl) {
        const data = {
            username: usernameEl.value.trim(),
            email: emailEl.value.trim(),
            password: passwordEl.value
        };
        
        // 验证数据完整性
        if (data.username && data.email && data.password) {
            console.log('从DOM获取到注册数据:', { username: data.username, email: data.email });
            return data;
        }
    }

    console.error('无法获取注册表单数据');
    console.log('verificationData:', this.verificationData);
    console.log('DOM elements found:', {
        username: !!document.getElementById('regUsername'),
        email: !!document.getElementById('regEmail'),
        password: !!document.getElementById('regPassword')
    });
    return null;
}

// 设置注册数据的方法（你的HTML已经在使用）
setRegistrationData(username, email, password) {
    this.verificationData = {
        username: username.trim(),
        email: email.trim(),
        password: password
    };
    console.log('已设置注册数据:', { username, email });
}

// 设置注册数据的方法（供外部调用）
setRegistrationData(username, email, password) {
    this.verificationData = {
        username: username.trim(),
        email: email.trim(),
        password: password
    };
    console.log('已设置注册数据:', { username, email });
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

    goBackToStep1() {
        this.showEmailChangeStep(1);
    }
	
	    // 启动注册验证流程 - 架构优化版本
    async startRegistrationWithVerification(registrationForm) {
        try {
            // 从表单或参数中获取数据
            let registrationData;
            
            if (typeof registrationForm === 'object' && registrationForm.username) {
                // 直接传入的数据对象
                registrationData = registrationForm;
            } else if (typeof registrationForm === 'string' || registrationForm instanceof HTMLFormElement) {
                // 表单元素或选择器
                registrationData = this.extractFormData(registrationForm);
            } else {
                // 从当前页面的表单中自动提取
                registrationData = this.getRegistrationData();
            }

            if (!registrationData) {
                throw new Error('无法获取注册信息，请检查表单数据');
            }

            // 基础验证
            if (!registrationData.username || !registrationData.email || !registrationData.password) {
                throw new Error('请填写完整的注册信息');
            }

            // 存储注册数据供后续验证使用
            this.setRegistrationData(
                registrationData.username,
                registrationData.email,
                registrationData.password
            );

            // 显示邮箱验证模态框
            this.showRegistrationVerificationModal(registrationData.email);

        } catch (error) {
            console.error('启动注册验证流程失败:', error);
            showToast(error.message || '启动注册验证失败', 'error');
        }
    }

    // 从表单中提取数据
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

}

// 创建全局实例
export const emailVerificationUI = new EmailVerificationUI();

// 确保在页面加载完成后可以使用
if (typeof window !== 'undefined') {
    window.emailVerificationUI = emailVerificationUI;
}