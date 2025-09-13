// src/services/email-verification.js - 邮箱验证核心服务
import { utils } from '../utils.js';

export class EmailVerificationService {
    constructor(env) {
        this.env = env;
        this.resendApiKey = env.RESEND_API_KEY;
        this.defaultFromEmail = env.DEFAULT_FROM_EMAIL || 'noreply@codeseek.pp.ua';
        this.defaultFromName = env.DEFAULT_FROM_NAME || '磁力快搜';
        this.siteUrl = env.SITE_URL || 'https://codeseek.pp.ua';
    }

    // 生成6位数字验证码
    generateVerificationCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // 检查邮箱发送频率限制
    async checkEmailRateLimit(email, ipAddress) {
        const emailHash = await utils.hashPassword(email);
        const now = Date.now();
        const oneHourAgo = now - 3600000; // 1小时前
        const oneDayAgo = now - 86400000; // 1天前

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

    // 创建邮箱验证记录
    async createEmailVerification(email, verificationType, userId = null, metadata = {}) {
        const verificationCode = this.generateVerificationCode();
        const codeHash = await utils.hashPassword(verificationCode);
        const emailHash = await utils.hashPassword(email);
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
			// 获取邮件模板
    templateType = this.getTemplateType(templateType);;
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
        'email_change_old': 'email_change',
        'email_change_new': 'email_change', 
        'account_delete': 'account_delete'
    };
    return mapping[verificationType] || verificationType;
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
            'yopmail.com', 'maildrop.cc'
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
    }
};