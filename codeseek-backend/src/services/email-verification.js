// src/services/email-verification.js - 增强版本，支持验证状态检查和恢复
import { utils } from '../utils.js';

export class EmailVerificationService {
    constructor(env) {
        this.env = env;
        this.resendApiKey = env.RESEND_API_KEY;
        this.defaultFromEmail = env.DEFAULT_FROM_EMAIL || 'noreply@codeseek.pp.ua';
        this.defaultFromName = env.DEFAULT_FROM_NAME || '磁力快搜';
        this.siteUrl = env.SITE_URL || 'https://codeseek.pp.ua';
    }

    // 🆕 新增：检查用户是否有待验证的验证码
    async getPendingVerification(email, verificationType, userId = null) {
        const emailHash = await utils.hashPassword(email);
        const now = Date.now();

        const verification = await this.env.DB.prepare(`
            SELECT * FROM email_verifications 
            WHERE email_hash = ? AND verification_type = ?
            AND status = 'pending' AND expires_at > ?
            ${userId ? 'AND user_id = ?' : 'AND user_id IS NULL'}
            ORDER BY created_at DESC LIMIT 1
        `).bind(emailHash, verificationType, now, ...(userId ? [userId] : [])).first();

        if (!verification) {
            return null;
        }

        const remainingTime = verification.expires_at - now;
        const canResend = remainingTime <= 60000; // 剩余时间少于1分钟时允许重新发送

        return {
            id: verification.id,
            email: emailVerificationUtils.maskEmail(email),
            verificationType,
            expiresAt: verification.expires_at,
            remainingTime,
            canResend,
            attemptCount: verification.attempt_count,
            maxAttempts: verification.max_attempts,
            createdAt: verification.created_at,
            metadata: JSON.parse(verification.metadata || '{}')
        };
    }

    // 🆕 新增：获取用户所有待验证的验证码状态
    async getUserPendingVerifications(userId) {
        const now = Date.now();

        const verifications = await this.env.DB.prepare(`
            SELECT * FROM email_verifications 
            WHERE user_id = ? AND status = 'pending' AND expires_at > ?
            ORDER BY created_at DESC
        `).bind(userId, now).all();

        return verifications.results.map(verification => ({
            id: verification.id,
            email: emailVerificationUtils.maskEmail(verification.email),
            verificationType: verification.verification_type,
            expiresAt: verification.expires_at,
            remainingTime: verification.expires_at - now,
            canResend: (verification.expires_at - now) <= 60000,
            attemptCount: verification.attempt_count,
            maxAttempts: verification.max_attempts,
            createdAt: verification.created_at,
            metadata: JSON.parse(verification.metadata || '{}')
        }));
    }

    // 🆕 新增：检查邮箱更改请求状态
    async getPendingEmailChangeRequest(userId) {
        const now = Date.now();

        const request = await this.env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE user_id = ? AND status = 'pending' AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
        `).bind(userId, now).first();

        if (!request) {
            return null;
        }

        // 检查相关的验证码状态
        const oldEmailVerification = await this.getPendingVerification(
            request.old_email, 'email_change_old', userId
        );
        const newEmailVerification = await this.getPendingVerification(
            request.new_email, 'email_change_new', userId
        );

        return {
            id: request.id,
            oldEmail: emailVerificationUtils.maskEmail(request.old_email),
            newEmail: emailVerificationUtils.maskEmail(request.new_email),
            oldEmailVerified: Boolean(request.old_email_verified),
            newEmailVerified: Boolean(request.new_email_verified),
            expiresAt: request.expires_at,
            remainingTime: request.expires_at - now,
            createdAt: request.created_at,
            verifications: {
                oldEmail: oldEmailVerification,
                newEmail: newEmailVerification
            }
        };
    }

    // 🆕 新增：智能获取验证状态（根据验证类型自动判断）
    async getVerificationStatus(email, verificationType, userId = null) {
        // 对于邮箱更改，需要特殊处理
        if (verificationType.includes('email_change') && userId) {
            return await this.getPendingEmailChangeRequest(userId);
        }

        // 其他类型的验证直接查询
        return await this.getPendingVerification(email, verificationType, userId);
    }

    // 🆕 新增：检查是否可以重新发送验证码
    async canResendVerification(email, verificationType, userId = null) {
        const pending = await this.getPendingVerification(email, verificationType, userId);
        
        if (!pending) {
            return { canResend: true, reason: 'no_pending_verification' };
        }

        const timeSinceCreated = Date.now() - pending.createdAt;
        const minResendInterval = 60000; // 1分钟最小间隔

        if (timeSinceCreated < minResendInterval) {
            return {
                canResend: false,
                reason: 'too_soon',
                waitTime: minResendInterval - timeSinceCreated,
                remainingTime: pending.remainingTime
            };
        }

        return {
            canResend: true,
            reason: 'can_resend',
            existingVerification: pending
        };
    }

    // 🆕 新增：根据验证状态生成前端状态数据
    async getVerificationStateForFrontend(email, verificationType, userId = null, additionalData = {}) {
        const status = await this.getVerificationStatus(email, verificationType, userId);
        const canResend = await this.canResendVerification(email, verificationType, userId);

        return {
            hasPendingVerification: !!status,
            verificationStatus: status,
            canResend: canResend.canResend,
            resendReason: canResend.reason,
            waitTime: canResend.waitTime,
            ...additionalData
        };
    }

    // 现有方法保持不变，添加一些优化...

    // 生成6位数字验证码
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 检查邮件发送频率限制
    async checkEmailRateLimit(email, ipAddress) {
        const emailHash = await utils.hashPassword(email);
        const now = Date.now();
        const oneHourAgo = now - 3600000; 
        const oneDayAgo = now - 86400000; 

        // 检查每小时限制
        const hourlyCount = await this.env.DB.prepare(`
            SELECT COUNT(*) as count FROM email_send_logs 
            WHERE (recipient_email = ? OR ip_address = ?) 
            AND created_at > ? AND send_status = 'sent'
        `).bind(email, ipAddress, oneHourAgo).first();

        const hourlyLimit = parseInt(this.env.EMAIL_RATE_LIMIT_PER_HOUR || '5');
        if (hourlyCount.count >= hourlyLimit) {
            throw new Error(`发送频率过快，请1小时后再试（每小时限制${hourlyLimit}次）`);
        }

        // 检查每日限制
        const dailyCount = await this.env.DB.prepare(`
            SELECT COUNT(*) as count FROM email_send_logs 
            WHERE (recipient_email = ? OR ip_address = ?) 
            AND created_at > ? AND send_status = 'sent'
        `).bind(email, ipAddress, oneDayAgo).first();

        const dailyLimit = parseInt(this.env.EMAIL_RATE_LIMIT_PER_DAY || '20');
        if (dailyCount.count >= dailyLimit) {
            throw new Error(`今日发送次数已达上限，请明天再试（每日限制${dailyLimit}次）`);
        }

        return true;
    }

    // 创建邮箱验证记录（优化版本，先清理相同类型的待验证记录）
    async createEmailVerification(email, verificationType, userId = null, metadata = {}) {
        // 先清理该邮箱该类型的待验证记录，避免重复
        const emailHash = await utils.hashPassword(email);
        await this.env.DB.prepare(`
            UPDATE email_verifications 
            SET status = 'expired'
            WHERE email_hash = ? AND verification_type = ? AND status = 'pending'
            ${userId ? 'AND user_id = ?' : 'AND user_id IS NULL'}
        `).bind(emailHash, verificationType, ...(userId ? [userId] : [])).run();

        const verificationCode = this.generateVerificationCode();
        const codeHash = await utils.hashPassword(verificationCode);
        const expiryTime = Date.now() + parseInt(this.env.VERIFICATION_CODE_EXPIRY || '900000'); // 15分钟

        const verificationId = utils.generateId();

        await this.env.DB.prepare(`
            INSERT INTO email_verifications (
                id, user_id, email, email_hash, verification_code, code_hash,
                verification_type, status, expires_at, created_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            verificationId, userId, email, emailHash, verificationCode, codeHash,
            verificationType, 'pending', expiryTime, Date.now(), JSON.stringify(metadata)
        ).run();

        return {
            id: verificationId,
            code: verificationCode,
            expiresAt: expiryTime
        };
    }

    // 验证验证码
    async verifyCode(email, inputCode, verificationType, userId = null) {
        const emailHash = await utils.hashPassword(email);
        const codeHash = await utils.hashPassword(inputCode);
        const now = Date.now();

        // 查找有效的验证记录
        const verification = await this.env.DB.prepare(`
            SELECT * FROM email_verifications 
            WHERE email_hash = ? AND code_hash = ? AND verification_type = ?
            AND status = 'pending' AND expires_at > ?
            ${userId ? 'AND user_id = ?' : 'AND user_id IS NULL'}
            ORDER BY created_at DESC LIMIT 1
        `).bind(emailHash, codeHash, verificationType, now, ...(userId ? [userId] : [])).first();

        if (!verification) {
            // 记录失败尝试
            await this.recordFailedAttempt(emailHash, inputCode, verificationType);
            throw new Error('验证码无效或已过期');
        }

        // 检查尝试次数
        if (verification.attempt_count >= verification.max_attempts) {
            throw new Error('验证尝试次数已达上限，请重新申请验证码');
        }

        // 标记验证码为已使用
        await this.env.DB.prepare(`
            UPDATE email_verifications 
            SET status = 'used', used_at = ?
            WHERE id = ?
        `).bind(now, verification.id).run();

        return {
            success: true,
            verificationId: verification.id,
            metadata: JSON.parse(verification.metadata || '{}')
        };
    }

    // 记录失败尝试
    async recordFailedAttempt(emailHash, inputCode, verificationType) {
        await this.env.DB.prepare(`
            UPDATE email_verifications 
            SET attempt_count = attempt_count + 1, last_attempt_at = ?
            WHERE email_hash = ? AND verification_type = ? AND status = 'pending'
        `).bind(Date.now(), emailHash, verificationType).run();
    }

    // 发送验证邮件
    async sendVerificationEmail(email, verificationCode, templateType, templateVars = {}) {
        if (!this.resendApiKey) {
            throw new Error('邮件服务未配置');
        }
        
        // 使用映射后的模板类型
        templateType = this.getTemplateType(templateType);
        const template = await this.getEmailTemplate(templateType);
        
        if (!template) {
            throw new Error(`邮件模板不存在: ${templateType}`);
        }

        // 准备模板变量
        const vars = {
            siteName: '磁力快搜',
            siteUrl: this.siteUrl,
            verificationCode,
            expiryMinutes: Math.floor(parseInt(this.env.VERIFICATION_CODE_EXPIRY || '900000') / 60000),
            ...templateVars
        };

        // 渲染模板
        const subject = this.renderTemplate(template.subject_template, vars);
        const htmlContent = this.renderTemplate(template.html_template, vars);
        const textContent = this.renderTemplate(template.text_template || '', vars);

        try {
            // 调用Resend API
            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.resendApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: `${this.defaultFromName} <${this.defaultFromEmail}>`,
                    to: [email],
                    subject: subject,
                    html: htmlContent,
                    text: textContent,
                    tags: [{
                        name: 'type',
                        value: templateType
                    }, {
                        name: 'source',
                        value: 'email-verification'
                    }]
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || '邮件发送失败');
            }

            // 记录发送日志
            await this.logEmailSend(email, templateType, 'sent', {
                messageId: result.id,
                subject,
                templateName: template.template_name
            });

            return {
                success: true,
                messageId: result.id,
                message: '验证邮件已发送'
            };

        } catch (error) {
            console.error('发送邮件失败:', error);
            
            // 记录发送失败日志
            await this.logEmailSend(email, templateType, 'failed', {
                error: error.message,
                subject,
                templateName: template.template_name
            });

            throw new Error('邮件发送失败: ' + error.message);
        }
    }

    // 获取邮件模板
    async getEmailTemplate(templateType) {
        return await this.env.DB.prepare(`
            SELECT * FROM email_templates 
            WHERE template_type = ? AND is_active = 1
            ORDER BY version DESC LIMIT 1
        `).bind(templateType).first();
    }

    // 渲染模板
    renderTemplate(template, vars) {
        if (!template) return '';
        
        let rendered = template;
        for (const [key, value] of Object.entries(vars)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            rendered = rendered.replace(regex, value || '');
        }
        return rendered;
    }

    // 记录邮件发送日志
    async logEmailSend(email, emailType, status, details = {}) {
        const logId = utils.generateId();
        await this.env.DB.prepare(`
            INSERT INTO email_send_logs (
                id, recipient_email, email_type, send_status, provider,
                provider_message_id, template_name, subject, send_error,
                created_at, sent_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            logId, email, emailType, status, 'resend',
            details.messageId || null, details.templateName || null,
            details.subject || null, details.error || null,
            Date.now(), status === 'sent' ? Date.now() : null
        ).run();
    }

    // 清理过期验证码
    async cleanupExpiredVerifications() {
        const deleted = await this.env.DB.prepare(`
            DELETE FROM email_verifications 
            WHERE expires_at < ? AND status = 'pending'
        `).bind(Date.now()).run();

        return deleted.changes || 0;
    }

    // 获取用户未完成的邮箱更改请求
    async getUserActiveEmailChangeRequest(userId) {
        return await this.env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE user_id = ? AND status = 'pending' AND expires_at > ?
            ORDER BY created_at DESC LIMIT 1
        `).bind(userId, Date.now()).first();
    }

    // 创建邮箱更改请求
    async createEmailChangeRequest(userId, oldEmail, newEmail) {
        const requestId = utils.generateId();
        const newEmailHash = await utils.hashPassword(newEmail);
        const expiryTime = Date.now() + 1800000; // 30分钟

        await this.env.DB.prepare(`
            INSERT INTO email_change_requests (
                id, user_id, old_email, new_email, new_email_hash,
                status, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            requestId, userId, oldEmail, newEmail, newEmailHash,
            'pending', expiryTime, Date.now()
        ).run();

        return {
            id: requestId,
            expiresAt: expiryTime
        };
    }

    // 完成邮箱更改
    async completeEmailChange(requestId, userId) {
        const request = await this.env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE id = ? AND user_id = ? AND status = 'pending'
            AND expires_at > ?
        `).bind(requestId, userId, Date.now()).first();

        if (!request) {
            throw new Error('邮箱更改请求不存在或已过期');
        }

        if (!request.new_email_verified) {
            throw new Error('新邮箱尚未验证');
        }

        // 开始数据库事务
        try {
            // 更新用户邮箱
            await this.env.DB.prepare(`
                UPDATE users SET email = ?, updated_at = ? WHERE id = ?
            `).bind(request.new_email, Date.now(), userId).run();

            // 标记请求为完成
            await this.env.DB.prepare(`
                UPDATE email_change_requests 
                SET status = 'completed', completed_at = ?
                WHERE id = ?
            `).bind(Date.now(), requestId).run();

            return {
                success: true,
                newEmail: request.new_email,
                message: '邮箱更改成功'
            };

        } catch (error) {
            console.error('完成邮箱更改失败:', error);
            throw new Error('邮箱更改失败');
        }
    }

    // 标记邮箱更改请求中的验证为完成
    async markEmailVerificationCompleted(requestId, verificationType) {
        const updateField = verificationType === 'email_change_old' ? 
            'old_email_verified = 1' : 'new_email_verified = 1';

        await this.env.DB.prepare(`
            UPDATE email_change_requests 
            SET ${updateField}, updated_at = ?
            WHERE id = ?
        `).bind(Date.now(), requestId).run();
    }

    // 获取邮箱验证统计
    async getVerificationStats(timeRange = 'day') {
        const timeMap = {
            day: Date.now() - 86400000,
            week: Date.now() - 604800000,
            month: Date.now() - 2592000000
        };

        const since = timeMap[timeRange] || timeMap.day;

        const stats = await this.env.DB.prepare(`
            SELECT 
                verification_type,
                status,
                COUNT(*) as count
            FROM email_verifications 
            WHERE created_at > ?
            GROUP BY verification_type, status
        `).bind(since).all();

        const emailStats = await this.env.DB.prepare(`
            SELECT 
                send_status,
                COUNT(*) as count
            FROM email_send_logs 
            WHERE created_at > ?
            GROUP BY send_status
        `).bind(since).all();

        return {
            verifications: stats.results,
            emails: emailStats.results,
            period: timeRange
        };
    }
    
    // 在 sendVerificationEmail 方法中，添加类型映射函数
    getTemplateType(verificationType) {
        const mapping = {
            'registration': 'registration',
            'password_reset': 'password_reset',
            'forgot_password': 'password_reset',  // 新增：忘记密码映射到密码重置模板
            'email_change_old': 'email_change',
            'email_change_new': 'email_change', 
            'account_delete': 'account_delete'
        };
        return mapping[verificationType] || verificationType;
    }

    // 新增：检查用户是否存在且激活（用于忘记密码功能）
    async getUserByEmail(email) {
        const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
        return await this.env.DB.prepare(`
            SELECT id, username, email, is_active 
            FROM users 
            WHERE email = ?
        `).bind(normalizedEmail).first();
    }

    // 新增：创建忘记密码验证记录的辅助方法
    async createForgotPasswordVerification(email, ipAddress) {
        const user = await this.getUserByEmail(email);
        if (!user || !user.is_active) {
            // 为了安全，不透露用户是否存在
            return null;
        }

        const verification = await this.createEmailVerification(
            email, 'forgot_password', user.id, { 
                ipAddress,
                requestedAt: Date.now()
            }
        );

        return {
            verification,
            user
        };
    }

    // 新增：验证忘记密码验证码并获取用户信息
    async verifyForgotPasswordCode(email, verificationCode) {
        const user = await this.getUserByEmail(email);
        if (!user || !user.is_active) {
            throw new Error('用户不存在或已被禁用');
        }

        const result = await this.verifyCode(email, verificationCode, 'forgot_password', user.id);
        
        return {
            ...result,
            userId: user.id,
            username: user.username
        };
    }

    // 新增：清理旧的验证记录（避免数据库过大）
    async cleanupOldVerifications(daysOld = 7) {
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
        
        const deleted = await this.env.DB.prepare(`
            DELETE FROM email_verifications 
            WHERE created_at < ? AND status IN ('used', 'expired', 'failed')
        `).bind(cutoffTime).run();

        return deleted.changes || 0;
    }
}

// 邮箱验证工具函数
export const emailVerificationUtils = {
    // 验证邮箱格式
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // 检查是否为临时邮箱
    isTempEmail(email) {
        const tempDomains = [
            '10minutemail.com', 'guerrillamail.com', 'tempmail.org',
            'temp-mail.org', 'throwaway.email', 'mailinator.com',
            'yopmail.com', 'maildrop.cc', 'tempail.com', '10min.email',
            'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
            'spam4.me', 'bccto.me', 'chacuo.net', 'dispostable.com',
            'tempinbox.com', 'mohmal.com', 'emailondeck.com'
        ];
        
        const domain = email.split('@')[1]?.toLowerCase();
        return tempDomains.includes(domain);
    },

    // 标准化邮箱地址
    normalizeEmail(email) {
        return email.toLowerCase().trim();
    },

    // 生成邮箱掩码（用于显示）
    maskEmail(email) {
        const [localPart, domain] = email.split('@');
        if (localPart.length <= 2) {
            return `${localPart[0]}***@${domain}`;
        }
        const masked = localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1];
        return `${masked}@${domain}`;
    },

    // 验证验证码格式
    isValidVerificationCode(code) {
        return /^\d{6}$/.test(code);
    },

    // 检查邮箱域名是否可信
    isTrustedEmailDomain(email) {
        const trustedDomains = [
            'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
            'qq.com', '163.com', '126.com', 'sina.com', 'sohu.com',
            'foxmail.com', '139.com', 'yeah.net'
        ];
        
        const domain = email.split('@')[1]?.toLowerCase();
        return trustedDomains.includes(domain);
    },

    // 生成安全的邮箱链接（用于邮件中的链接）
    generateSecureEmailLink(baseUrl, action, token) {
        return `${baseUrl}/email/${action}?token=${encodeURIComponent(token)}`;
    }
};