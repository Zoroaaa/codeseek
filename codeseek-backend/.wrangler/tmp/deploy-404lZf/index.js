var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/utils.js
var utils = {
  generateId() {
    return crypto.randomUUID();
  },
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  },
  async generateJWT(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = btoa(JSON.stringify(header)).replace(/[=]/g, "");
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/[=]/g, "");
    const data = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[=]/g, "");
    return `${data}.${encodedSignature}`;
  },
  async verifyJWT(token, secret) {
    try {
      const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
      if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
      const data = `${encodedHeader}.${encodedPayload}`;
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const padding = "=".repeat((4 - encodedSignature.length % 4) % 4);
      const signature = Uint8Array.from(atob(encodedSignature + padding), (c) => c.charCodeAt(0));
      const isValid = await crypto.subtle.verify("HMAC", key, signature, encoder.encode(data));
      if (!isValid) return null;
      const payloadPadding = "=".repeat((4 - encodedPayload.length % 4) % 4);
      const payload = JSON.parse(atob(encodedPayload + payloadPadding));
      if (payload.exp && Date.now() > payload.exp * 1e3) {
        return null;
      }
      return payload;
    } catch (error) {
      console.error("JWT\u9A8C\u8BC1\u5931\u8D25:", error);
      return null;
    }
  },
  getCorsHeaders(origin = "*") {
    const allowedOrigins = ["http://localhost:3000", "https://codeseek.pp.ua"];
    const isAllowedOrigin = origin === "*" || allowedOrigins.some((allowed) => {
      if (allowed.includes("*")) {
        const pattern = allowed.replace("*", ".*");
        return new RegExp(pattern).test(origin);
      }
      return allowed === origin;
    });
    return {
      "Access-Control-Allow-Origin": isAllowedOrigin ? origin : "null",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Credentials": "true",
      "Vary": "Origin"
    };
  },
  jsonResponse(data, status = 200, origin = "*") {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        ...this.getCorsHeaders(origin)
      }
    });
  },
  getClientIP(request) {
    return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || request.headers.get("X-Real-IP") || "unknown";
  },
  async logUserAction(env, userId, action, data, request) {
    try {
      if (env.ENABLE_ACTION_LOGGING !== "true") return;
      const actionId = this.generateId();
      const ip = this.getClientIP(request);
      const userAgent = request.headers.get("User-Agent") || "";
      await env.DB.prepare(`
                INSERT INTO user_actions (id, user_id, action, data, ip_address, user_agent, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(
        actionId,
        userId,
        action,
        JSON.stringify(data),
        ip,
        userAgent,
        Date.now()
      ).run();
    } catch (error) {
      console.error("\u8BB0\u5F55\u7528\u6237\u884C\u4E3A\u5931\u8D25:", error);
    }
  },
  validateInput(data, rules) {
    const errors = [];
    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      if (rule.required && (!value || value.toString().trim() === "")) {
        errors.push(`${field}\u662F\u5FC5\u9700\u7684`);
        continue;
      }
      if (value && rule.minLength && value.length < rule.minLength) {
        errors.push(`${field}\u81F3\u5C11\u9700\u8981${rule.minLength}\u4E2A\u5B57\u7B26`);
      }
      if (value && rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field}\u6700\u591A${rule.maxLength}\u4E2A\u5B57\u7B26`);
      }
      if (value && rule.pattern && !rule.pattern.test(value)) {
        errors.push(rule.message || `${field}\u683C\u5F0F\u4E0D\u6B63\u786E`);
      }
    }
    return errors;
  },
  successResponse(data = {}, origin = "*") {
    return this.jsonResponse({
      success: true,
      timestamp: Date.now(),
      ...data
    }, 200, origin);
  },
  errorResponse(message, status = 400, origin = "*", errorCode = null) {
    return this.jsonResponse({
      success: false,
      error: true,
      message,
      code: errorCode,
      timestamp: Date.now()
    }, status, origin);
  },
  validateRequiredParams(body, requiredFields) {
    const missing = [];
    for (const field of requiredFields) {
      if (!body[field] || typeof body[field] === "string" && body[field].trim() === "") {
        missing.push(field);
      }
    }
    return missing;
  },
  async safeJsonParse(request, fallback = {}) {
    try {
      return await request.json();
    } catch (error) {
      console.warn("JSON\u89E3\u6790\u5931\u8D25:", error);
      return fallback;
    }
  },
  // 添加延迟工具函数（如果还没有的话）
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  // 添加深度克隆函数（如果需要的话）
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map((item) => this.deepClone(item));
    if (typeof obj === "object") {
      const cloned = {};
      Object.keys(obj).forEach((key) => {
        cloned[key] = this.deepClone(obj[key]);
      });
      return cloned;
    }
  },
  // 添加安全的数据库操作包装器
  async safeDbOperation(operation, errorMessage = "\u6570\u636E\u5E93\u64CD\u4F5C\u5931\u8D25") {
    try {
      return await operation();
    } catch (error) {
      console.error(errorMessage + ":", error);
      throw new Error(errorMessage + ": " + error.message);
    }
  }
};

// src/middleware.js
async function authenticate(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    console.error("JWT_SECRET \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
    return null;
  }
  const payload = await utils.verifyJWT(token, jwtSecret);
  if (!payload) return null;
  try {
    const tokenHash = await utils.hashPassword(token);
    const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, Date.now()).first();
    if (!session) return null;
    await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();
    return {
      id: session.id,
      username: session.username,
      email: session.email,
      permissions: JSON.parse(session.permissions || "[]"),
      settings: JSON.parse(session.settings || "{}")
    };
  } catch (error) {
    console.error("\u8BA4\u8BC1\u67E5\u8BE2\u5931\u8D25:", error);
    return null;
  }
}
__name(authenticate, "authenticate");

// src/services/email-verification.js
var EmailVerificationService = class {
  static {
    __name(this, "EmailVerificationService");
  }
  constructor(env) {
    this.env = env;
    this.resendApiKey = env.RESEND_API_KEY;
    this.defaultFromEmail = env.DEFAULT_FROM_EMAIL || "noreply@codeseek.pp.ua";
    this.defaultFromName = env.DEFAULT_FROM_NAME || "\u78C1\u529B\u5FEB\u641C";
    this.siteUrl = env.SITE_URL || "https://codeseek.pp.ua";
  }
  // 🆕 新增：检查用户是否有待验证的验证码
  async getPendingVerification(email, verificationType, userId = null) {
    const emailHash = await utils.hashPassword(email);
    const now = Date.now();
    const verification = await this.env.DB.prepare(`
            SELECT * FROM email_verifications 
            WHERE email_hash = ? AND verification_type = ?
            AND status = 'pending' AND expires_at > ?
            ${userId ? "AND user_id = ?" : "AND user_id IS NULL"}
            ORDER BY created_at DESC LIMIT 1
        `).bind(emailHash, verificationType, now, ...userId ? [userId] : []).first();
    if (!verification) {
      return null;
    }
    const remainingTime = verification.expires_at - now;
    const canResend = remainingTime <= 6e4;
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
      metadata: JSON.parse(verification.metadata || "{}")
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
    return verifications.results.map((verification) => ({
      id: verification.id,
      email: emailVerificationUtils.maskEmail(verification.email),
      verificationType: verification.verification_type,
      expiresAt: verification.expires_at,
      remainingTime: verification.expires_at - now,
      canResend: verification.expires_at - now <= 6e4,
      attemptCount: verification.attempt_count,
      maxAttempts: verification.max_attempts,
      createdAt: verification.created_at,
      metadata: JSON.parse(verification.metadata || "{}")
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
    const oldEmailVerification = await this.getPendingVerification(
      request.old_email,
      "email_change_old",
      userId
    );
    const newEmailVerification = await this.getPendingVerification(
      request.new_email,
      "email_change_new",
      userId
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
    if (verificationType.includes("email_change") && userId) {
      return await this.getPendingEmailChangeRequest(userId);
    }
    return await this.getPendingVerification(email, verificationType, userId);
  }
  // 🆕 新增：检查是否可以重新发送验证码
  async canResendVerification(email, verificationType, userId = null) {
    const pending = await this.getPendingVerification(email, verificationType, userId);
    if (!pending) {
      return { canResend: true, reason: "no_pending_verification" };
    }
    const timeSinceCreated = Date.now() - pending.createdAt;
    const minResendInterval = 6e4;
    if (timeSinceCreated < minResendInterval) {
      return {
        canResend: false,
        reason: "too_soon",
        waitTime: minResendInterval - timeSinceCreated,
        remainingTime: pending.remainingTime
      };
    }
    return {
      canResend: true,
      reason: "can_resend",
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
    return Math.floor(1e5 + Math.random() * 9e5).toString();
  }
  // 检查邮件发送频率限制
  async checkEmailRateLimit(email, ipAddress) {
    const emailHash = await utils.hashPassword(email);
    const now = Date.now();
    const oneHourAgo = now - 36e5;
    const oneDayAgo = now - 864e5;
    const hourlyCount = await this.env.DB.prepare(`
            SELECT COUNT(*) as count FROM email_send_logs 
            WHERE (recipient_email = ? OR ip_address = ?) 
            AND created_at > ? AND send_status = 'sent'
        `).bind(email, ipAddress, oneHourAgo).first();
    const hourlyLimit = parseInt(this.env.EMAIL_RATE_LIMIT_PER_HOUR || "5");
    if (hourlyCount.count >= hourlyLimit) {
      throw new Error(`\u53D1\u9001\u9891\u7387\u8FC7\u5FEB\uFF0C\u8BF71\u5C0F\u65F6\u540E\u518D\u8BD5\uFF08\u6BCF\u5C0F\u65F6\u9650\u5236${hourlyLimit}\u6B21\uFF09`);
    }
    const dailyCount = await this.env.DB.prepare(`
            SELECT COUNT(*) as count FROM email_send_logs 
            WHERE (recipient_email = ? OR ip_address = ?) 
            AND created_at > ? AND send_status = 'sent'
        `).bind(email, ipAddress, oneDayAgo).first();
    const dailyLimit = parseInt(this.env.EMAIL_RATE_LIMIT_PER_DAY || "20");
    if (dailyCount.count >= dailyLimit) {
      throw new Error(`\u4ECA\u65E5\u53D1\u9001\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650\uFF0C\u8BF7\u660E\u5929\u518D\u8BD5\uFF08\u6BCF\u65E5\u9650\u5236${dailyLimit}\u6B21\uFF09`);
    }
    return true;
  }
  // 创建邮箱验证记录（优化版本，先清理相同类型的待验证记录）
  async createEmailVerification(email, verificationType, userId = null, metadata = {}) {
    const emailHash = await utils.hashPassword(email);
    await this.env.DB.prepare(`
            UPDATE email_verifications 
            SET status = 'expired'
            WHERE email_hash = ? AND verification_type = ? AND status = 'pending'
            ${userId ? "AND user_id = ?" : "AND user_id IS NULL"}
        `).bind(emailHash, verificationType, ...userId ? [userId] : []).run();
    const verificationCode = this.generateVerificationCode();
    const codeHash = await utils.hashPassword(verificationCode);
    const expiryTime = Date.now() + parseInt(this.env.VERIFICATION_CODE_EXPIRY || "900000");
    const verificationId = utils.generateId();
    await this.env.DB.prepare(`
            INSERT INTO email_verifications (
                id, user_id, email, email_hash, verification_code, code_hash,
                verification_type, status, expires_at, created_at, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      verificationId,
      userId,
      email,
      emailHash,
      verificationCode,
      codeHash,
      verificationType,
      "pending",
      expiryTime,
      Date.now(),
      JSON.stringify(metadata)
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
    const verification = await this.env.DB.prepare(`
            SELECT * FROM email_verifications 
            WHERE email_hash = ? AND code_hash = ? AND verification_type = ?
            AND status = 'pending' AND expires_at > ?
            ${userId ? "AND user_id = ?" : "AND user_id IS NULL"}
            ORDER BY created_at DESC LIMIT 1
        `).bind(emailHash, codeHash, verificationType, now, ...userId ? [userId] : []).first();
    if (!verification) {
      await this.recordFailedAttempt(emailHash, inputCode, verificationType);
      throw new Error("\u9A8C\u8BC1\u7801\u65E0\u6548\u6216\u5DF2\u8FC7\u671F");
    }
    if (verification.attempt_count >= verification.max_attempts) {
      throw new Error("\u9A8C\u8BC1\u5C1D\u8BD5\u6B21\u6570\u5DF2\u8FBE\u4E0A\u9650\uFF0C\u8BF7\u91CD\u65B0\u7533\u8BF7\u9A8C\u8BC1\u7801");
    }
    await this.env.DB.prepare(`
            UPDATE email_verifications 
            SET status = 'used', used_at = ?
            WHERE id = ?
        `).bind(now, verification.id).run();
    return {
      success: true,
      verificationId: verification.id,
      metadata: JSON.parse(verification.metadata || "{}")
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
      throw new Error("\u90AE\u4EF6\u670D\u52A1\u672A\u914D\u7F6E");
    }
    templateType = this.getTemplateType(templateType);
    const template = await this.getEmailTemplate(templateType);
    if (!template) {
      throw new Error(`\u90AE\u4EF6\u6A21\u677F\u4E0D\u5B58\u5728: ${templateType}`);
    }
    const vars = {
      siteName: "\u78C1\u529B\u5FEB\u641C",
      siteUrl: this.siteUrl,
      verificationCode,
      expiryMinutes: Math.floor(parseInt(this.env.VERIFICATION_CODE_EXPIRY || "900000") / 6e4),
      ...templateVars
    };
    const subject = this.renderTemplate(template.subject_template, vars);
    const htmlContent = this.renderTemplate(template.html_template, vars);
    const textContent = this.renderTemplate(template.text_template || "", vars);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: `${this.defaultFromName} <${this.defaultFromEmail}>`,
          to: [email],
          subject,
          html: htmlContent,
          text: textContent,
          tags: [{
            name: "type",
            value: templateType
          }, {
            name: "source",
            value: "email-verification"
          }]
        })
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "\u90AE\u4EF6\u53D1\u9001\u5931\u8D25");
      }
      await this.logEmailSend(email, templateType, "sent", {
        messageId: result.id,
        subject,
        templateName: template.template_name
      });
      return {
        success: true,
        messageId: result.id,
        message: "\u9A8C\u8BC1\u90AE\u4EF6\u5DF2\u53D1\u9001"
      };
    } catch (error) {
      console.error("\u53D1\u9001\u90AE\u4EF6\u5931\u8D25:", error);
      await this.logEmailSend(email, templateType, "failed", {
        error: error.message,
        subject,
        templateName: template.template_name
      });
      throw new Error("\u90AE\u4EF6\u53D1\u9001\u5931\u8D25: " + error.message);
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
    if (!template) return "";
    let rendered = template;
    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      rendered = rendered.replace(regex, value || "");
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
      logId,
      email,
      emailType,
      status,
      "resend",
      details.messageId || null,
      details.templateName || null,
      details.subject || null,
      details.error || null,
      Date.now(),
      status === "sent" ? Date.now() : null
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
    const expiryTime = Date.now() + 18e5;
    await this.env.DB.prepare(`
            INSERT INTO email_change_requests (
                id, user_id, old_email, new_email, new_email_hash,
                status, expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      requestId,
      userId,
      oldEmail,
      newEmail,
      newEmailHash,
      "pending",
      expiryTime,
      Date.now()
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
      throw new Error("\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F");
    }
    if (!request.new_email_verified) {
      throw new Error("\u65B0\u90AE\u7BB1\u5C1A\u672A\u9A8C\u8BC1");
    }
    try {
      await this.env.DB.prepare(`
                UPDATE users SET email = ?, updated_at = ? WHERE id = ?
            `).bind(request.new_email, Date.now(), userId).run();
      await this.env.DB.prepare(`
                UPDATE email_change_requests 
                SET status = 'completed', completed_at = ?
                WHERE id = ?
            `).bind(Date.now(), requestId).run();
      return {
        success: true,
        newEmail: request.new_email,
        message: "\u90AE\u7BB1\u66F4\u6539\u6210\u529F"
      };
    } catch (error) {
      console.error("\u5B8C\u6210\u90AE\u7BB1\u66F4\u6539\u5931\u8D25:", error);
      throw new Error("\u90AE\u7BB1\u66F4\u6539\u5931\u8D25");
    }
  }
  // 标记邮箱更改请求中的验证为完成
  async markEmailVerificationCompleted(requestId, verificationType) {
    const updateField = verificationType === "email_change_old" ? "old_email_verified = 1" : "new_email_verified = 1";
    await this.env.DB.prepare(`
            UPDATE email_change_requests 
            SET ${updateField}, updated_at = ?
            WHERE id = ?
        `).bind(Date.now(), requestId).run();
  }
  // 获取邮箱验证统计
  async getVerificationStats(timeRange = "day") {
    const timeMap = {
      day: Date.now() - 864e5,
      week: Date.now() - 6048e5,
      month: Date.now() - 2592e6
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
      "registration": "registration",
      "password_reset": "password_reset",
      "forgot_password": "password_reset",
      // 新增：忘记密码映射到密码重置模板
      "email_change_old": "email_change",
      "email_change_new": "email_change",
      "account_delete": "account_delete"
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
      return null;
    }
    const verification = await this.createEmailVerification(
      email,
      "forgot_password",
      user.id,
      {
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
      throw new Error("\u7528\u6237\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u7981\u7528");
    }
    const result = await this.verifyCode(email, verificationCode, "forgot_password", user.id);
    return {
      ...result,
      userId: user.id,
      username: user.username
    };
  }
  // 新增：清理旧的验证记录（避免数据库过大）
  async cleanupOldVerifications(daysOld = 7) {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1e3;
    const deleted = await this.env.DB.prepare(`
            DELETE FROM email_verifications 
            WHERE created_at < ? AND status IN ('used', 'expired', 'failed')
        `).bind(cutoffTime).run();
    return deleted.changes || 0;
  }
};
var emailVerificationUtils = {
  // 验证邮箱格式
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  // 检查是否为临时邮箱
  isTempEmail(email) {
    const tempDomains = [
      "10minutemail.com",
      "guerrillamail.com",
      "tempmail.org",
      "temp-mail.org",
      "throwaway.email",
      "mailinator.com",
      "yopmail.com",
      "maildrop.cc",
      "tempail.com",
      "10min.email",
      "sharklasers.com",
      "guerrillamailblock.com",
      "pokemail.net",
      "spam4.me",
      "bccto.me",
      "chacuo.net",
      "dispostable.com",
      "tempinbox.com",
      "mohmal.com",
      "emailondeck.com"
    ];
    const domain = email.split("@")[1]?.toLowerCase();
    return tempDomains.includes(domain);
  },
  // 标准化邮箱地址
  normalizeEmail(email) {
    return email.toLowerCase().trim();
  },
  // 生成邮箱掩码（用于显示）
  maskEmail(email) {
    const [localPart, domain] = email.split("@");
    if (localPart.length <= 2) {
      return `${localPart[0]}***@${domain}`;
    }
    const masked = localPart[0] + "*".repeat(localPart.length - 2) + localPart[localPart.length - 1];
    return `${masked}@${domain}`;
  },
  // 验证验证码格式
  isValidVerificationCode(code) {
    return /^\d{6}$/.test(code);
  },
  // 检查邮箱域名是否可信
  isTrustedEmailDomain(email) {
    const trustedDomains = [
      "gmail.com",
      "outlook.com",
      "hotmail.com",
      "yahoo.com",
      "qq.com",
      "163.com",
      "126.com",
      "sina.com",
      "sohu.com",
      "foxmail.com",
      "139.com",
      "yeah.net"
    ];
    const domain = email.split("@")[1]?.toLowerCase();
    return trustedDomains.includes(domain);
  },
  // 生成安全的邮箱链接（用于邮件中的链接）
  generateSecureEmailLink(baseUrl, action, token) {
    return `${baseUrl}/email/${action}?token=${encodeURIComponent(token)}`;
  }
};

// src/handlers/auth.js
async function authCheckVerificationStatusHandler(request, env) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    const verificationType = url.searchParams.get("type");
    const userId = url.searchParams.get("userId");
    if (!email || !verificationType) {
      return utils.errorResponse("\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570\uFF1Aemail \u548C type");
    }
    if (!emailVerificationUtils.isValidEmail(email)) {
      return utils.errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    const emailService = new EmailVerificationService(env);
    const verificationState = await emailService.getVerificationStateForFrontend(
      normalizedEmail,
      verificationType,
      userId
    );
    return utils.successResponse({
      message: "\u9A8C\u8BC1\u72B6\u6001\u67E5\u8BE2\u6210\u529F",
      ...verificationState
    });
  } catch (error) {
    console.error("\u68C0\u67E5\u9A8C\u8BC1\u72B6\u6001\u5931\u8D25:", error);
    return utils.errorResponse("\u68C0\u67E5\u9A8C\u8BC1\u72B6\u6001\u5931\u8D25", 500);
  }
}
__name(authCheckVerificationStatusHandler, "authCheckVerificationStatusHandler");
async function authGetUserVerificationStatusHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const emailService = new EmailVerificationService(env);
    const pendingVerifications = await emailService.getUserPendingVerifications(user.id);
    const emailChangeRequest = await emailService.getPendingEmailChangeRequest(user.id);
    return utils.successResponse({
      message: "\u7528\u6237\u9A8C\u8BC1\u72B6\u6001\u67E5\u8BE2\u6210\u529F",
      pendingVerifications,
      emailChangeRequest,
      hasAnyPendingVerifications: pendingVerifications.length > 0 || !!emailChangeRequest
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u9A8C\u8BC1\u72B6\u6001\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7528\u6237\u9A8C\u8BC1\u72B6\u6001\u5931\u8D25", 500);
  }
}
__name(authGetUserVerificationStatusHandler, "authGetUserVerificationStatusHandler");
async function authSmartSendVerificationCodeHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, verificationType, force = false } = body;
    let user = null;
    if (["password_reset", "email_change", "account_delete"].includes(verificationType)) {
      user = await authenticate(request, env);
      if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    }
    if (!email || !verificationType) {
      return utils.errorResponse("\u7F3A\u5C11\u5FC5\u8981\u53C2\u6570");
    }
    if (!emailVerificationUtils.isValidEmail(email)) {
      return utils.errorResponse("\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E");
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    const emailService = new EmailVerificationService(env);
    if (!force) {
      const canResend = await emailService.canResendVerification(
        normalizedEmail,
        verificationType,
        user?.id
      );
      if (!canResend.canResend) {
        return utils.successResponse({
          message: "\u5B58\u5728\u6709\u6548\u7684\u9A8C\u8BC1\u7801",
          canResend: false,
          reason: canResend.reason,
          waitTime: canResend.waitTime,
          existingVerification: canResend.existingVerification
        });
      }
    }
    let result;
    switch (verificationType) {
      case "registration":
        result = await sendRegistrationCodeInternal(normalizedEmail, env);
        break;
      case "forgot_password":
        result = await sendForgotPasswordCodeInternal(normalizedEmail, env, request);
        break;
      case "password_reset":
        result = await sendPasswordResetCodeInternal(user, env, request);
        break;
      case "email_change_new":
      case "email_change_old":
        const changeRequest = await emailService.getPendingEmailChangeRequest(user.id);
        if (!changeRequest) {
          return utils.errorResponse("\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42");
        }
        const targetEmail = verificationType === "email_change_old" ? changeRequest.oldEmail : changeRequest.newEmail;
        result = await sendEmailChangeCodeInternal(
          changeRequest.id,
          verificationType,
          targetEmail,
          user,
          env,
          request
        );
        break;
      case "account_delete":
        result = await sendAccountDeleteCodeInternal(user, env, request);
        break;
      default:
        return utils.errorResponse("\u4E0D\u652F\u6301\u7684\u9A8C\u8BC1\u7C7B\u578B");
    }
    return result;
  } catch (error) {
    console.error("\u667A\u80FD\u53D1\u9001\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25");
  }
}
__name(authSmartSendVerificationCodeHandler, "authSmartSendVerificationCodeHandler");
async function sendRegistrationCodeInternal(email, env) {
  const existingUser = await env.DB.prepare(`
        SELECT id FROM users WHERE email = ?
    `).bind(email).first();
  if (existingUser) {
    throw new Error("\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C");
  }
  if (emailVerificationUtils.isTempEmail(email)) {
    throw new Error("\u4E0D\u652F\u6301\u4E34\u65F6\u90AE\u7BB1\uFF0C\u8BF7\u4F7F\u7528\u5E38\u7528\u90AE\u7BB1");
  }
  const emailService = new EmailVerificationService(env);
  const ipAddress = "127.0.0.1";
  await emailService.checkEmailRateLimit(email, ipAddress);
  const verification = await emailService.createEmailVerification(
    email,
    "registration",
    null,
    { ipAddress }
  );
  await emailService.sendVerificationEmail(
    email,
    verification.code,
    "registration",
    { username: "\u65B0\u7528\u6237" }
  );
  return utils.successResponse({
    message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(email)}`,
    maskedEmail: emailVerificationUtils.maskEmail(email),
    expiresAt: verification.expiresAt
  });
}
__name(sendRegistrationCodeInternal, "sendRegistrationCodeInternal");
async function sendForgotPasswordCodeInternal(email, env, request) {
  const user = await env.DB.prepare(`
        SELECT id, username, email FROM users WHERE email = ? AND is_active = 1
    `).bind(email).first();
  if (!user) {
    return utils.successResponse({
      message: `\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u6211\u4EEC\u5DF2\u5411 ${emailVerificationUtils.maskEmail(email)} \u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801`,
      maskedEmail: emailVerificationUtils.maskEmail(email)
    });
  }
  const emailService = new EmailVerificationService(env);
  const ipAddress = utils.getClientIP(request);
  try {
    await emailService.checkEmailRateLimit(email, ipAddress);
    const verification = await emailService.createEmailVerification(
      email,
      "forgot_password",
      user.id,
      {
        ipAddress,
        requestedAt: Date.now()
      }
    );
    await emailService.sendVerificationEmail(
      email,
      verification.code,
      "password_reset",
      { username: user.username }
    );
    await utils.logUserAction(env, user.id, "password_reset_request", {
      method: "email_verification",
      ipAddress
    }, request);
  } catch (error) {
    console.error("\u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
  }
  return utils.successResponse({
    message: `\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u6211\u4EEC\u5DF2\u5411 ${emailVerificationUtils.maskEmail(email)} \u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801`,
    maskedEmail: emailVerificationUtils.maskEmail(email)
  });
}
__name(sendForgotPasswordCodeInternal, "sendForgotPasswordCodeInternal");
async function sendPasswordResetCodeInternal(user, env, request) {
  const userRecord = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
    `).bind(user.id).first();
  if (!userRecord) {
    throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  }
  const emailService = new EmailVerificationService(env);
  const ipAddress = utils.getClientIP(request);
  await emailService.checkEmailRateLimit(userRecord.email, ipAddress);
  const verification = await emailService.createEmailVerification(
    userRecord.email,
    "password_reset",
    user.id,
    { ipAddress }
  );
  await emailService.sendVerificationEmail(
    userRecord.email,
    verification.code,
    "password_reset",
    { username: userRecord.username }
  );
  return utils.successResponse({
    message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
    maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
    expiresAt: verification.expiresAt
  });
}
__name(sendPasswordResetCodeInternal, "sendPasswordResetCodeInternal");
async function sendEmailChangeCodeInternal(requestId, emailType, targetEmail, user, env, request) {
  const emailService = new EmailVerificationService(env);
  const verificationType = emailType === "email_change_old" ? "email_change_old" : "email_change_new";
  const ipAddress = utils.getClientIP(request);
  await emailService.checkEmailRateLimit(targetEmail, ipAddress);
  const verification = await emailService.createEmailVerification(
    targetEmail,
    verificationType,
    user.id,
    {
      requestId,
      emailType,
      ipAddress
    }
  );
  const userRecord = await env.DB.prepare(`
        SELECT username FROM users WHERE id = ?
    `).bind(user.id).first();
  const changeRequest = await env.DB.prepare(`
        SELECT * FROM email_change_requests WHERE id = ?
    `).bind(requestId).first();
  await emailService.sendVerificationEmail(
    targetEmail,
    verification.code,
    "email_change",
    {
      username: userRecord.username,
      oldEmail: changeRequest.old_email,
      newEmail: changeRequest.new_email
    }
  );
  return utils.successResponse({
    message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(targetEmail)}`,
    maskedEmail: emailVerificationUtils.maskEmail(targetEmail),
    emailType,
    expiresAt: verification.expiresAt
  });
}
__name(sendEmailChangeCodeInternal, "sendEmailChangeCodeInternal");
async function sendAccountDeleteCodeInternal(user, env, request) {
  const userRecord = await env.DB.prepare(`
        SELECT * FROM users WHERE id = ?
    `).bind(user.id).first();
  if (!userRecord) {
    throw new Error("\u7528\u6237\u4E0D\u5B58\u5728");
  }
  const emailService = new EmailVerificationService(env);
  const ipAddress = utils.getClientIP(request);
  await emailService.checkEmailRateLimit(userRecord.email, ipAddress);
  const verification = await emailService.createEmailVerification(
    userRecord.email,
    "account_delete",
    user.id,
    { ipAddress }
  );
  await emailService.sendVerificationEmail(
    userRecord.email,
    verification.code,
    "account_delete",
    { username: userRecord.username }
  );
  return utils.successResponse({
    message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
    maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
    expiresAt: verification.expiresAt
  });
}
__name(sendAccountDeleteCodeInternal, "sendAccountDeleteCodeInternal");
async function authRegisterHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { username, email, password, verificationCode } = body;
    let emailVerified = 0;
    const errors = utils.validateInput({ username, email, password }, {
      username: {
        required: true,
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
        message: "\u7528\u6237\u540D\u53EA\u80FD\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u548C\u4E0B\u5212\u7EBF"
      },
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E"
      },
      password: {
        required: true,
        minLength: 6,
        maxLength: 50
      }
    });
    if (errors.length > 0) {
      return utils.errorResponse(errors[0]);
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    if (emailVerificationUtils.isTempEmail(normalizedEmail)) {
      return utils.errorResponse("\u4E0D\u652F\u6301\u4E34\u65F6\u90AE\u7BB1\uFF0C\u8BF7\u4F7F\u7528\u5E38\u7528\u90AE\u7BB1\u6CE8\u518C");
    }
    const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE username = ? OR email = ?
        `).bind(username, normalizedEmail).first();
    if (existingUser) {
      return utils.errorResponse("\u7528\u6237\u540D\u6216\u90AE\u7BB1\u5DF2\u5B58\u5728");
    }
    const emailService = new EmailVerificationService(env);
    const isEmailVerificationRequired = env.EMAIL_VERIFICATION_REQUIRED === "true";
    if (isEmailVerificationRequired && verificationCode) {
      try {
        await emailService.verifyCode(normalizedEmail, verificationCode, "registration");
        emailVerified = 1;
      } catch (error) {
        return utils.errorResponse(error.message);
      }
    }
    const userId = utils.generateId();
    const passwordHash = await utils.hashPassword(password);
    const now = Date.now();
    await env.DB.prepare(`
            INSERT INTO users (
                id, username, email, password_hash, email_verified,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
      userId,
      username,
      normalizedEmail,
      passwordHash,
      emailVerified,
      now,
      now
    ).run();
    await utils.logUserAction(env, userId, "register", {
      emailVerified: Boolean(emailVerified)
    }, request);
    return utils.successResponse({
      message: "\u6CE8\u518C\u6210\u529F",
      user: {
        id: userId,
        username,
        email: normalizedEmail,
        emailVerified: Boolean(emailVerified)
      },
      requiresEmailVerification: isEmailVerificationRequired && !verificationCode
    });
  } catch (error) {
    console.error("\u6CE8\u518C\u5931\u8D25:", error);
    return utils.errorResponse("\u6CE8\u518C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500);
  }
}
__name(authRegisterHandler, "authRegisterHandler");
async function authLoginHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { identifier, password } = body;
    const errors = utils.validateInput({ identifier, password }, {
      identifier: { required: true, maxLength: 50 },
      password: { required: true, maxLength: 50 }
    });
    if (errors.length > 0) {
      return utils.errorResponse(errors[0], 400);
    }
    const isEmail = emailVerificationUtils.isValidEmail(identifier);
    const normalizedIdentifier = isEmail ? emailVerificationUtils.normalizeEmail(identifier) : identifier;
    const user = await env.DB.prepare(`
            SELECT * FROM users WHERE ${isEmail ? "email" : "username"} = ?
        `).bind(normalizedIdentifier).first();
    if (!user) {
      return utils.errorResponse("\u7528\u6237\u540D/\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF", 401);
    }
    const passwordHash = await utils.hashPassword(password);
    if (passwordHash !== user.password_hash) {
      return utils.errorResponse("\u7528\u6237\u540D/\u90AE\u7BB1\u6216\u5BC6\u7801\u9519\u8BEF", 401);
    }
    if (!user.is_active) {
      return utils.errorResponse("\u8D26\u6237\u5DF2\u88AB\u7981\u7528\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458", 403);
    }
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
      return utils.errorResponse("\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF", 500);
    }
    const expiryDays = parseInt(env.JWT_EXPIRY_DAYS || "30");
    const expirySeconds = expiryDays * 24 * 60 * 60;
    const payload = {
      userId: user.id,
      username: user.username,
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + expirySeconds
    };
    const token = await utils.generateJWT(payload, jwtSecret);
    const tokenHash = await utils.hashPassword(token);
    await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ? AND expires_at < ?
        `).bind(user.id, Date.now()).run();
    const sessionId = utils.generateId();
    const expiresAt = Date.now() + expirySeconds * 1e3;
    await env.DB.prepare(`
            INSERT INTO user_sessions (
                id, user_id, token_hash, expires_at, created_at, 
                last_activity, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      sessionId,
      user.id,
      tokenHash,
      expiresAt,
      Date.now(),
      Date.now(),
      utils.getClientIP(request),
      request.headers.get("User-Agent") || ""
    ).run();
    await env.DB.prepare(`
            UPDATE users SET 
                last_login = ?, 
                login_count = login_count + 1 
            WHERE id = ?
        `).bind(Date.now(), user.id).run();
    await utils.logUserAction(env, user.id, "login", {
      loginMethod: isEmail ? "email" : "username",
      sessionId,
      identifier: normalizedIdentifier
    }, request);
    return utils.successResponse({
      message: "\u767B\u5F55\u6210\u529F",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        emailVerified: Boolean(user.email_verified),
        permissions: JSON.parse(user.permissions || "[]"),
        settings: JSON.parse(user.settings || "{}")
      }
    });
  } catch (error) {
    console.error("\u767B\u5F55\u5931\u8D25:", error);
    return utils.errorResponse("\u767B\u5F55\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500);
  }
}
__name(authLoginHandler, "authLoginHandler");
async function authForgotPasswordHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;
    if (!email || !emailVerificationUtils.isValidEmail(email)) {
      return utils.errorResponse("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u90AE\u7BB1\u5730\u5740");
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    const user = await env.DB.prepare(`
            SELECT id, username, email FROM users WHERE email = ? AND is_active = 1
        `).bind(normalizedEmail).first();
    if (!user) {
      return utils.successResponse({
        message: `\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u6211\u4EEC\u5DF2\u5411 ${emailVerificationUtils.maskEmail(normalizedEmail)} \u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801`,
        maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail)
      });
    }
    const emailService = new EmailVerificationService(env);
    const ipAddress = utils.getClientIP(request);
    try {
      await emailService.checkEmailRateLimit(normalizedEmail, ipAddress);
      const verification = await emailService.createEmailVerification(
        normalizedEmail,
        "forgot_password",
        user.id,
        {
          ipAddress,
          requestedAt: Date.now()
        }
      );
      await emailService.sendVerificationEmail(
        normalizedEmail,
        verification.code,
        "password_reset",
        { username: user.username }
      );
      await utils.logUserAction(env, user.id, "password_reset_request", {
        method: "email_verification",
        ipAddress
      }, request);
    } catch (error) {
      console.error("\u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    }
    return utils.successResponse({
      message: `\u5982\u679C\u8BE5\u90AE\u7BB1\u5DF2\u6CE8\u518C\uFF0C\u6211\u4EEC\u5DF2\u5411 ${emailVerificationUtils.maskEmail(normalizedEmail)} \u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801`,
      maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail)
    });
  } catch (error) {
    console.error("\u5FD8\u8BB0\u5BC6\u7801\u5904\u7406\u5931\u8D25:", error);
    return utils.errorResponse("\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500);
  }
}
__name(authForgotPasswordHandler, "authForgotPasswordHandler");
async function authResetPasswordHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email, verificationCode, newPassword } = body;
    const errors = utils.validateInput({ email, verificationCode, newPassword }, {
      email: {
        required: true,
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        message: "\u90AE\u7BB1\u683C\u5F0F\u4E0D\u6B63\u786E"
      },
      verificationCode: {
        required: true,
        pattern: /^\d{6}$/,
        message: "\u9A8C\u8BC1\u7801\u5FC5\u987B\u662F6\u4F4D\u6570\u5B57"
      },
      newPassword: {
        required: true,
        minLength: 6,
        maxLength: 50
      }
    });
    if (errors.length > 0) {
      return utils.errorResponse(errors[0]);
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    const user = await env.DB.prepare(`
            SELECT * FROM users WHERE email = ? AND is_active = 1
        `).bind(normalizedEmail).first();
    if (!user) {
      return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u7981\u7528");
    }
    const emailService = new EmailVerificationService(env);
    try {
      const verifyResult = await emailService.verifyCode(
        normalizedEmail,
        verificationCode,
        "forgot_password",
        user.id
      );
      if (!verifyResult.success) {
        return utils.errorResponse("\u9A8C\u8BC1\u7801\u65E0\u6548\u6216\u5DF2\u8FC7\u671F");
      }
    } catch (error) {
      return utils.errorResponse(error.message);
    }
    const newPasswordHash = await utils.hashPassword(newPassword);
    await env.DB.prepare(`
            UPDATE users SET 
                password_hash = ?, 
                updated_at = ? 
            WHERE id = ?
        `).bind(newPasswordHash, Date.now(), user.id).run();
    await env.DB.prepare(`
            DELETE FROM user_sessions WHERE user_id = ?
        `).bind(user.id).run();
    await utils.logUserAction(env, user.id, "password_reset", {
      method: "email_verification",
      forced_relogin: true
    }, request);
    return utils.successResponse({
      message: "\u5BC6\u7801\u91CD\u7F6E\u6210\u529F\uFF0C\u8BF7\u4F7F\u7528\u65B0\u5BC6\u7801\u767B\u5F55",
      requiresLogin: true
    });
  } catch (error) {
    console.error("\u5BC6\u7801\u91CD\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u5BC6\u7801\u91CD\u7F6E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5", 500);
  }
}
__name(authResetPasswordHandler, "authResetPasswordHandler");
async function authChangePasswordHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const body = await request.json();
    const { currentPassword, newPassword, verificationCode } = body;
    if (!currentPassword || !newPassword) {
      return utils.errorResponse("\u5F53\u524D\u5BC6\u7801\u548C\u65B0\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (!verificationCode) {
      return utils.errorResponse("\u8BF7\u5148\u83B7\u53D6\u90AE\u7BB1\u9A8C\u8BC1\u7801");
    }
    const userRecord = await env.DB.prepare(
      `SELECT * FROM users WHERE id = ?`
    ).bind(user.id).first();
    if (!userRecord) return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
    const currentHash = await utils.hashPassword(currentPassword);
    if (currentHash !== userRecord.password_hash) {
      return utils.errorResponse("\u5F53\u524D\u5BC6\u7801\u9519\u8BEF");
    }
    const emailService = new EmailVerificationService(env);
    try {
      await emailService.verifyCode(userRecord.email, verificationCode, "password_reset", user.id);
    } catch (error) {
      return utils.errorResponse(error.message);
    }
    const newHash = await utils.hashPassword(newPassword);
    await env.DB.prepare(
      `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`
    ).bind(newHash, Date.now(), user.id).run();
    await env.DB.prepare(
      `DELETE FROM user_sessions WHERE user_id = ?`
    ).bind(user.id).run();
    await utils.logUserAction(env, user.id, "password_change", {
      method: "email_verification"
    }, request);
    return utils.successResponse({ message: "\u5BC6\u7801\u4FEE\u6539\u6210\u529F\uFF0C\u8BF7\u91CD\u65B0\u767B\u5F55" });
  } catch (error) {
    console.error("\u5BC6\u7801\u4FEE\u6539\u5931\u8D25:", error);
    return utils.errorResponse("\u5BC6\u7801\u4FEE\u6539\u5931\u8D25", 500);
  }
}
__name(authChangePasswordHandler, "authChangePasswordHandler");
async function authVerifyTokenHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token } = body;
    if (!token || typeof token !== "string") {
      return utils.errorResponse("Token\u53C2\u6570\u65E0\u6548", 400);
    }
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
      return utils.errorResponse("\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF", 500);
    }
    const payload = await utils.verifyJWT(token, jwtSecret);
    if (!payload) {
      return utils.errorResponse("Token\u65E0\u6548\u6216\u5DF2\u8FC7\u671F", 401);
    }
    const tokenHash = await utils.hashPassword(token);
    const session = await env.DB.prepare(`
            SELECT u.* FROM users u
            JOIN user_sessions s ON u.id = s.user_id
            WHERE s.token_hash = ? AND s.expires_at > ?
        `).bind(tokenHash, Date.now()).first();
    if (!session) {
      return utils.errorResponse("\u4F1A\u8BDD\u5DF2\u8FC7\u671F\u6216\u4E0D\u5B58\u5728", 401);
    }
    await env.DB.prepare(`
            UPDATE user_sessions SET last_activity = ? WHERE token_hash = ?
        `).bind(Date.now(), tokenHash).run();
    const user = {
      id: session.id,
      username: session.username,
      email: session.email,
      emailVerified: Boolean(session.email_verified),
      permissions: JSON.parse(session.permissions || "[]"),
      settings: JSON.parse(session.settings || "{}")
    };
    return utils.successResponse({
      valid: true,
      user,
      message: "Token\u9A8C\u8BC1\u6210\u529F"
    });
  } catch (error) {
    console.error("Token\u9A8C\u8BC1\u5931\u8D25:", error);
    return utils.errorResponse("Token\u9A8C\u8BC1\u5931\u8D25", 401);
  }
}
__name(authVerifyTokenHandler, "authVerifyTokenHandler");
async function authRefreshTokenHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const jwtSecret = env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("JWT_SECRET \u73AF\u5883\u53D8\u91CF\u672A\u8BBE\u7F6E");
      return utils.errorResponse("\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF", 500);
    }
    const expiryDays = parseInt(env.JWT_EXPIRY_DAYS || "30");
    const expirySeconds = expiryDays * 24 * 60 * 60;
    const payload = {
      userId: user.id,
      username: user.username,
      iat: Math.floor(Date.now() / 1e3),
      exp: Math.floor(Date.now() / 1e3) + expirySeconds
    };
    const newToken = await utils.generateJWT(payload, jwtSecret);
    const newTokenHash = await utils.hashPassword(newToken);
    const authHeader = request.headers.get("Authorization");
    const oldToken = authHeader.substring(7);
    const oldTokenHash = await utils.hashPassword(oldToken);
    const expiresAt = Date.now() + expirySeconds * 1e3;
    await env.DB.prepare(`
            UPDATE user_sessions 
            SET token_hash = ?, expires_at = ?, last_activity = ?
            WHERE token_hash = ? AND user_id = ?
        `).bind(newTokenHash, expiresAt, Date.now(), oldTokenHash, user.id).run();
    await utils.logUserAction(env, user.id, "token_refresh", {}, request);
    return utils.successResponse({
      message: "Token\u5237\u65B0\u6210\u529F",
      token: newToken
    });
  } catch (error) {
    console.error("Token\u5237\u65B0\u5931\u8D25:", error);
    return utils.errorResponse("Token\u5237\u65B0\u5931\u8D25", 401);
  }
}
__name(authRefreshTokenHandler, "authRefreshTokenHandler");
async function authLogoutHandler(request, env) {
  const user = await authenticate(request, env);
  if (user) {
    const authHeader = request.headers.get("Authorization");
    const token = authHeader.substring(7);
    const tokenHash = await utils.hashPassword(token);
    await env.DB.prepare(`
            DELETE FROM user_sessions WHERE token_hash = ?
        `).bind(tokenHash).run();
    await utils.logUserAction(env, user.id, "logout", {}, request);
  }
  return utils.successResponse({ message: "\u9000\u51FA\u6210\u529F" });
}
__name(authLogoutHandler, "authLogoutHandler");
async function authSendRegistrationCodeHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { email } = body;
    if (!email || !emailVerificationUtils.isValidEmail(email)) {
      return utils.errorResponse("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u90AE\u7BB1\u5730\u5740");
    }
    const normalizedEmail = emailVerificationUtils.normalizeEmail(email);
    const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE email = ?
        `).bind(normalizedEmail).first();
    if (existingUser) {
      return utils.errorResponse("\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u6CE8\u518C");
    }
    if (emailVerificationUtils.isTempEmail(normalizedEmail)) {
      return utils.errorResponse("\u4E0D\u652F\u6301\u4E34\u65F6\u90AE\u7BB1\uFF0C\u8BF7\u4F7F\u7528\u5E38\u7528\u90AE\u7BB1");
    }
    const emailService = new EmailVerificationService(env);
    const ipAddress = utils.getClientIP(request);
    await emailService.checkEmailRateLimit(normalizedEmail, ipAddress);
    const verification = await emailService.createEmailVerification(
      normalizedEmail,
      "registration",
      null,
      { ipAddress }
    );
    await emailService.sendVerificationEmail(
      normalizedEmail,
      verification.code,
      "registration",
      { username: "\u65B0\u7528\u6237" }
    );
    return utils.successResponse({
      message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(normalizedEmail)}`,
      maskedEmail: emailVerificationUtils.maskEmail(normalizedEmail),
      expiresAt: verification.expiresAt
    });
  } catch (error) {
    console.error("\u53D1\u9001\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25");
  }
}
__name(authSendRegistrationCodeHandler, "authSendRegistrationCodeHandler");
async function authSendPasswordResetCodeHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();
    if (!userRecord) {
      return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
    }
    const emailService = new EmailVerificationService(env);
    const ipAddress = utils.getClientIP(request);
    await emailService.checkEmailRateLimit(userRecord.email, ipAddress);
    const verification = await emailService.createEmailVerification(
      userRecord.email,
      "password_reset",
      user.id,
      { ipAddress }
    );
    await emailService.sendVerificationEmail(
      userRecord.email,
      verification.code,
      "password_reset",
      { username: userRecord.username }
    );
    return utils.successResponse({
      message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
      maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
      expiresAt: verification.expiresAt
    });
  } catch (error) {
    console.error("\u53D1\u9001\u5BC6\u7801\u91CD\u7F6E\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25");
  }
}
__name(authSendPasswordResetCodeHandler, "authSendPasswordResetCodeHandler");
async function authRequestEmailChangeHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const body = await request.json().catch(() => ({}));
    const { newEmail, currentPassword } = body;
    if (!newEmail || !emailVerificationUtils.isValidEmail(newEmail)) {
      return utils.errorResponse("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u65B0\u90AE\u7BB1\u5730\u5740");
    }
    if (!currentPassword) {
      return utils.errorResponse("\u8BF7\u8F93\u5165\u5F53\u524D\u5BC6\u7801");
    }
    const normalizedNewEmail = emailVerificationUtils.normalizeEmail(newEmail);
    if (emailVerificationUtils.isTempEmail(normalizedNewEmail)) {
      return utils.errorResponse("\u4E0D\u652F\u6301\u4E34\u65F6\u90AE\u7BB1");
    }
    const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();
    if (!userRecord) {
      return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
    }
    const currentHash = await utils.hashPassword(currentPassword);
    if (currentHash !== userRecord.password_hash) {
      return utils.errorResponse("\u5F53\u524D\u5BC6\u7801\u9519\u8BEF");
    }
    if (normalizedNewEmail === userRecord.email) {
      return utils.errorResponse("\u65B0\u90AE\u7BB1\u4E0D\u80FD\u4E0E\u5F53\u524D\u90AE\u7BB1\u76F8\u540C");
    }
    const existingUser = await env.DB.prepare(`
            SELECT id FROM users WHERE email = ? AND id != ?
        `).bind(normalizedNewEmail, user.id).first();
    if (existingUser) {
      return utils.errorResponse("\u8BE5\u90AE\u7BB1\u5DF2\u88AB\u5176\u4ED6\u7528\u6237\u4F7F\u7528");
    }
    const emailService = new EmailVerificationService(env);
    const activeRequest = await emailService.getUserActiveEmailChangeRequest(user.id);
    if (activeRequest) {
      return utils.errorResponse("\u60A8\u5DF2\u6709\u8FDB\u884C\u4E2D\u7684\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\uFF0C\u8BF7\u5148\u5B8C\u6210\u6216\u7B49\u5F85\u8FC7\u671F");
    }
    const changeRequest = await emailService.createEmailChangeRequest(
      user.id,
      userRecord.email,
      normalizedNewEmail
    );
    return utils.successResponse({
      message: "\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u5DF2\u521B\u5EFA\uFF0C\u63A5\u4E0B\u6765\u9700\u8981\u9A8C\u8BC1\u65B0\u90AE\u7BB1",
      requestId: changeRequest.id,
      oldEmail: emailVerificationUtils.maskEmail(userRecord.email),
      newEmail: emailVerificationUtils.maskEmail(normalizedNewEmail),
      expiresAt: changeRequest.expiresAt
    });
  } catch (error) {
    console.error("\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u5931\u8D25");
  }
}
__name(authRequestEmailChangeHandler, "authRequestEmailChangeHandler");
async function authSendEmailChangeCodeHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const body = await request.json().catch(() => ({}));
    const { requestId, emailType } = body;
    if (!requestId || !emailType || !["old", "new"].includes(emailType)) {
      return utils.errorResponse("\u53C2\u6570\u9519\u8BEF");
    }
    const emailService = new EmailVerificationService(env);
    const changeRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
        `).bind(requestId, user.id, Date.now()).first();
    if (!changeRequest) {
      return utils.errorResponse("\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F");
    }
    const targetEmail = emailType === "old" ? changeRequest.old_email : changeRequest.new_email;
    const verificationType = emailType === "old" ? "email_change_old" : "email_change_new";
    const ipAddress = utils.getClientIP(request);
    await emailService.checkEmailRateLimit(targetEmail, ipAddress);
    const verification = await emailService.createEmailVerification(
      targetEmail,
      verificationType,
      user.id,
      {
        requestId,
        emailType,
        ipAddress
      }
    );
    const userRecord = await env.DB.prepare(`
            SELECT username FROM users WHERE id = ?
        `).bind(user.id).first();
    await emailService.sendVerificationEmail(
      targetEmail,
      verification.code,
      "email_change",
      {
        username: userRecord.username,
        oldEmail: changeRequest.old_email,
        newEmail: changeRequest.new_email
      }
    );
    return utils.successResponse({
      message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(targetEmail)}`,
      maskedEmail: emailVerificationUtils.maskEmail(targetEmail),
      emailType,
      expiresAt: verification.expiresAt
    });
  } catch (error) {
    console.error("\u53D1\u9001\u90AE\u7BB1\u66F4\u6539\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25");
  }
}
__name(authSendEmailChangeCodeHandler, "authSendEmailChangeCodeHandler");
async function authVerifyEmailChangeCodeHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const body = await request.json().catch(() => ({}));
    const { requestId, emailType, verificationCode } = body;
    if (!requestId || !emailType || !verificationCode) {
      return utils.errorResponse("\u53C2\u6570\u4E0D\u5B8C\u6574");
    }
    const emailService = new EmailVerificationService(env);
    const changeRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests 
            WHERE id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?
        `).bind(requestId, user.id, Date.now()).first();
    if (!changeRequest) {
      return utils.errorResponse("\u90AE\u7BB1\u66F4\u6539\u8BF7\u6C42\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F");
    }
    const targetEmail = emailType === "old" ? changeRequest.old_email : changeRequest.new_email;
    const verificationType = emailType === "old" ? "email_change_old" : "email_change_new";
    try {
      await emailService.verifyCode(targetEmail, verificationCode, verificationType, user.id);
    } catch (error) {
      return utils.errorResponse(error.message);
    }
    await emailService.markEmailVerificationCompleted(requestId, verificationType);
    const updatedRequest = await env.DB.prepare(`
            SELECT * FROM email_change_requests WHERE id = ?
        `).bind(requestId).first();
    if (updatedRequest.new_email_verified) {
      const result = await emailService.completeEmailChange(requestId, user.id);
      await utils.logUserAction(env, user.id, "email_change", {
        oldEmail: changeRequest.old_email,
        newEmail: changeRequest.new_email
      }, request);
      return utils.successResponse({
        message: "\u90AE\u7BB1\u66F4\u6539\u6210\u529F\uFF01",
        completed: true,
        newEmail: emailVerificationUtils.maskEmail(result.newEmail)
      });
    }
    return utils.successResponse({
      message: `${emailType === "old" ? "\u539F" : "\u65B0"}\u90AE\u7BB1\u9A8C\u8BC1\u6210\u529F`,
      completed: false,
      nextStep: emailType === "old" ? "\u8BF7\u9A8C\u8BC1\u65B0\u90AE\u7BB1" : "\u90AE\u7BB1\u66F4\u6539\u5373\u5C06\u5B8C\u6210"
    });
  } catch (error) {
    console.error("\u90AE\u7BB1\u66F4\u6539\u9A8C\u8BC1\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u5931\u8D25");
  }
}
__name(authVerifyEmailChangeCodeHandler, "authVerifyEmailChangeCodeHandler");
async function authDeleteAccountHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const body = await request.json().catch(() => ({}));
    const { verificationCode, confirmText } = body;
    if (!verificationCode) {
      return utils.errorResponse("\u8BF7\u5148\u83B7\u53D6\u90AE\u7BB1\u9A8C\u8BC1\u7801");
    }
    if (confirmText !== "\u5220\u9664\u6211\u7684\u8D26\u6237") {
      return utils.errorResponse('\u8BF7\u8F93\u5165\u786E\u8BA4\u6587\u672C\uFF1A"\u5220\u9664\u6211\u7684\u8D26\u6237"');
    }
    const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();
    if (!userRecord) {
      return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
    }
    const emailService = new EmailVerificationService(env);
    try {
      await emailService.verifyCode(userRecord.email, verificationCode, "account_delete", user.id);
    } catch (error) {
      return utils.errorResponse(error.message);
    }
    await utils.logUserAction(env, user.id, "account_delete", {
      email: emailVerificationUtils.maskEmail(userRecord.email)
    }, request);
    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id).run();
    return utils.successResponse({ message: "\u8D26\u6237\u5DF2\u5220\u9664" });
  } catch (error) {
    console.error("\u5220\u9664\u8D26\u6237\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u8D26\u6237\u5931\u8D25", 500);
  }
}
__name(authDeleteAccountHandler, "authDeleteAccountHandler");
async function authSendAccountDeleteCodeHandler(request, env) {
  try {
    const user = await authenticate(request, env);
    if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
    const userRecord = await env.DB.prepare(`
            SELECT * FROM users WHERE id = ?
        `).bind(user.id).first();
    if (!userRecord) {
      return utils.errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
    }
    const emailService = new EmailVerificationService(env);
    const ipAddress = utils.getClientIP(request);
    await emailService.checkEmailRateLimit(userRecord.email, ipAddress);
    const verification = await emailService.createEmailVerification(
      userRecord.email,
      "account_delete",
      user.id,
      { ipAddress }
    );
    await emailService.sendVerificationEmail(
      userRecord.email,
      verification.code,
      "account_delete",
      { username: userRecord.username }
    );
    return utils.successResponse({
      message: `\u9A8C\u8BC1\u7801\u5DF2\u53D1\u9001\u5230 ${emailVerificationUtils.maskEmail(userRecord.email)}`,
      maskedEmail: emailVerificationUtils.maskEmail(userRecord.email),
      expiresAt: verification.expiresAt
    });
  } catch (error) {
    console.error("\u53D1\u9001\u8D26\u6237\u5220\u9664\u9A8C\u8BC1\u7801\u5931\u8D25:", error);
    return utils.errorResponse(error.message || "\u9A8C\u8BC1\u7801\u53D1\u9001\u5931\u8D25");
  }
}
__name(authSendAccountDeleteCodeHandler, "authSendAccountDeleteCodeHandler");

// src/services/services.js
async function checkSingleSourceStatus(source, keyword, keywordHash, options = {}) {
  const { timeout, checkContentMatch, env } = options;
  const sourceId = source.id || source.name;
  const startTime = Date.now();
  try {
    const cached = await getCachedSourceStatus(env, sourceId, keywordHash);
    if (cached && isCacheValid(cached)) {
      console.log(`\u4F7F\u7528\u7F13\u5B58\u7ED3\u679C: ${sourceId}`);
      return {
        sourceId,
        sourceName: source.name,
        status: cached.status,
        available: cached.available,
        contentMatch: cached.content_match,
        responseTime: cached.response_time,
        lastChecked: cached.created_at,
        fromCache: true
      };
    }
    const checkUrl = source.urlTemplate.replace("{keyword}", encodeURIComponent(keyword));
    console.log(`\u68C0\u67E5URL: ${checkUrl}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(checkUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "MagnetSearch-StatusChecker/1.3.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.8,en;q=0.6",
        "Cache-Control": "no-cache"
      }
    });
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const isAvailable = response.ok && response.status < 400;
    let contentMatch = false;
    let qualityScore = 0;
    let matchDetails = {};
    if (isAvailable && checkContentMatch) {
      try {
        const content = await response.text();
        const matchResult = analyzePageContent(content, keyword, source);
        contentMatch = matchResult.hasMatch;
        qualityScore = matchResult.qualityScore;
        matchDetails = matchResult.details;
        console.log(`\u5185\u5BB9\u5339\u914D\u68C0\u67E5 ${sourceId}: ${contentMatch ? "\u5339\u914D" : "\u4E0D\u5339\u914D"}, \u8D28\u91CF\u5206\u6570: ${qualityScore}`);
      } catch (contentError) {
        console.warn(`\u5185\u5BB9\u68C0\u67E5\u5931\u8D25 ${sourceId}:`, contentError.message);
      }
    }
    let finalStatus = "error";
    if (isAvailable) {
      if (checkContentMatch) {
        finalStatus = contentMatch ? "available" : "unavailable";
      } else {
        finalStatus = "available";
      }
    } else if (response.status === 404) {
      finalStatus = "unavailable";
    } else if (responseTime >= timeout * 0.9) {
      finalStatus = "timeout";
    } else {
      finalStatus = "unavailable";
    }
    const result = {
      sourceId,
      sourceName: source.name,
      status: finalStatus,
      available: finalStatus === "available",
      contentMatch,
      responseTime,
      qualityScore,
      httpStatus: response.status,
      lastChecked: Date.now(),
      matchDetails,
      fromCache: false
    };
    saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error(`\u68C0\u67E5\u6E90\u5931\u8D25 ${sourceId}:`, error.message);
    let status = "error";
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      status = "timeout";
    } else if (error.message.includes("network") || error.message.includes("fetch")) {
      status = "unavailable";
    }
    const result = {
      sourceId,
      sourceName: source.name,
      status,
      available: false,
      contentMatch: false,
      responseTime,
      qualityScore: 0,
      lastChecked: Date.now(),
      error: error.message,
      fromCache: false
    };
    saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result).catch(console.error);
    return result;
  }
}
__name(checkSingleSourceStatus, "checkSingleSourceStatus");
function analyzePageContent(content, keyword, source) {
  const lowerContent = content.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  let qualityScore = 0;
  const details = {
    titleMatch: false,
    bodyMatch: false,
    exactMatch: false,
    partialMatch: false,
    resultCount: 0,
    keywordPositions: []
  };
  if (lowerContent.includes(lowerKeyword)) {
    details.exactMatch = true;
    qualityScore += 50;
    let position = 0;
    while ((position = lowerContent.indexOf(lowerKeyword, position)) !== -1) {
      details.keywordPositions.push(position);
      position += lowerKeyword.length;
    }
  }
  const titleMatch = content.match(/<title[^>]*>([^<]*)</i);
  if (titleMatch && titleMatch[1].toLowerCase().includes(lowerKeyword)) {
    details.titleMatch = true;
    qualityScore += 30;
  }
  if (/^[A-Za-z]+-?\d+$/i.test(keyword)) {
    const numberPattern = keyword.replace("-", "-?");
    const regex = new RegExp(numberPattern, "gi");
    const matches = content.match(regex);
    if (matches) {
      details.exactMatch = true;
      qualityScore += 40;
      details.resultCount = matches.length;
    }
  }
  if (!details.exactMatch && keyword.length > 3) {
    const parts = keyword.split(/[-_\s]+/);
    let partialMatches = 0;
    parts.forEach((part) => {
      if (part.length > 2 && lowerContent.includes(part.toLowerCase())) {
        partialMatches++;
      }
    });
    if (partialMatches > 0) {
      details.partialMatch = true;
      qualityScore += Math.min(partialMatches * 10, 30);
    }
  }
  const resultIndicators = [
    /result/gi,
    /search.*result/gi,
    /找到.*结果/gi,
    /共.*条/gi,
    /<div[^>]*class[^>]*result/gi
  ];
  let resultCount = 0;
  resultIndicators.forEach((indicator) => {
    const matches = content.match(indicator);
    if (matches) resultCount += matches.length;
  });
  if (resultCount > 0) {
    details.resultCount = resultCount;
    qualityScore += Math.min(resultCount * 5, 20);
  }
  const noResultIndicators = [
    /no.*result/gi,
    /not.*found/gi,
    /没有.*结果/gi,
    /未找到/gi,
    /暂无.*内容/gi
  ];
  const hasNoResultIndicator = noResultIndicators.some(
    (indicator) => content.match(indicator)
  );
  if (hasNoResultIndicator) {
    qualityScore = Math.max(0, qualityScore - 30);
  }
  qualityScore = Math.min(100, Math.max(0, qualityScore));
  const hasMatch = details.exactMatch || details.partialMatch && qualityScore > 20;
  return {
    hasMatch,
    qualityScore,
    details
  };
}
__name(analyzePageContent, "analyzePageContent");
async function getCachedSourceStatus(env, sourceId, keywordHash) {
  try {
    return await env.DB.prepare(`
            SELECT * FROM source_status_cache 
            WHERE source_id = ? AND keyword_hash = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `).bind(sourceId, keywordHash).first();
  } catch (error) {
    console.error("\u83B7\u53D6\u7F13\u5B58\u72B6\u6001\u5931\u8D25:", error);
    return null;
  }
}
__name(getCachedSourceStatus, "getCachedSourceStatus");
function isCacheValid(cached, maxAge = 3e5) {
  if (!cached) return false;
  return Date.now() - cached.created_at < maxAge;
}
__name(isCacheValid, "isCacheValid");
async function saveSingleStatusToCache(env, sourceId, keyword, keywordHash, result) {
  try {
    const cacheId = utils.generateId();
    await env.DB.prepare(`
            INSERT INTO source_status_cache (
                id, source_id, keyword, keyword_hash, status, available, content_match,
                response_time, quality_score, match_details, page_info, check_error,
                expires_at, created_at, last_accessed, access_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      cacheId,
      sourceId,
      keyword,
      keywordHash,
      result.status,
      result.available ? 1 : 0,
      result.contentMatch ? 1 : 0,
      result.responseTime,
      result.qualityScore || 0,
      JSON.stringify(result.matchDetails || {}),
      JSON.stringify({ httpStatus: result.httpStatus }),
      result.error || null,
      Date.now() + 3e5,
      // 5分钟后过期
      Date.now(),
      Date.now(),
      1
    ).run();
  } catch (error) {
    console.error("\u4FDD\u5B58\u7F13\u5B58\u72B6\u6001\u5931\u8D25:", error);
  }
}
__name(saveSingleStatusToCache, "saveSingleStatusToCache");
async function saveStatusCheckResults(env, results, keyword) {
  try {
    for (const result of results) {
      await updateSourceHealthStats(env, result);
    }
    console.log(`\u5DF2\u4FDD\u5B58 ${results.length} \u4E2A\u641C\u7D22\u6E90\u7684\u72B6\u6001\u68C0\u67E5\u7ED3\u679C`);
  } catch (error) {
    console.error("\u4FDD\u5B58\u72B6\u6001\u68C0\u67E5\u7ED3\u679C\u5931\u8D25:", error);
  }
}
__name(saveStatusCheckResults, "saveStatusCheckResults");
async function updateSourceHealthStats(env, result) {
  try {
    const sourceId = result.sourceId;
    const currentStats = await env.DB.prepare(`
            SELECT * FROM source_health_stats WHERE source_id = ?
        `).bind(sourceId).first();
    if (currentStats) {
      const newTotalChecks = currentStats.total_checks + 1;
      const newSuccessfulChecks = currentStats.successful_checks + (result.available ? 1 : 0);
      const newContentMatches = currentStats.content_matches + (result.contentMatch ? 1 : 0);
      const newSuccessRate = newSuccessfulChecks / newTotalChecks;
      const newAvgResponseTime = Math.round(
        (currentStats.average_response_time * currentStats.total_checks + result.responseTime) / newTotalChecks
      );
      const healthScore = Math.round(newSuccessRate * 100);
      await env.DB.prepare(`
                UPDATE source_health_stats SET
                    total_checks = ?, successful_checks = ?, content_matches = ?,
                    average_response_time = ?, success_rate = ?, health_score = ?,
                    last_success = ?, last_failure = ?, updated_at = ?
                WHERE source_id = ?
            `).bind(
        newTotalChecks,
        newSuccessfulChecks,
        newContentMatches,
        newAvgResponseTime,
        newSuccessRate,
        healthScore,
        result.available ? Date.now() : currentStats.last_success,
        result.available ? currentStats.last_failure : Date.now(),
        Date.now(),
        sourceId
      ).run();
    } else {
      const statsId = utils.generateId();
      await env.DB.prepare(`
                INSERT INTO source_health_stats (
                    id, source_id, total_checks, successful_checks, content_matches,
                    average_response_time, last_success, last_failure, success_rate,
                    health_score, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
        statsId,
        sourceId,
        1,
        result.available ? 1 : 0,
        result.contentMatch ? 1 : 0,
        result.responseTime,
        result.available ? Date.now() : null,
        result.available ? null : Date.now(),
        result.available ? 1 : 0,
        result.available ? 100 : 0,
        Date.now()
      ).run();
    }
  } catch (error) {
    console.error("\u66F4\u65B0\u6E90\u5065\u5EB7\u5EA6\u7EDF\u8BA1\u5931\u8D25:", error);
  }
}
__name(updateSourceHealthStats, "updateSourceHealthStats");
async function updateUserStatsAfterDelete(env, userId) {
  try {
    const realStats = await env.DB.prepare(`
            SELECT COUNT(*) as shared_count FROM community_shared_sources 
            WHERE user_id = ? AND status = 'active'
        `).bind(userId).first();
    await env.DB.prepare(`
            INSERT OR REPLACE INTO community_user_stats (
                id, user_id, shared_sources_count, updated_at,
                total_downloads, total_likes, total_views, reviews_given,
                sources_downloaded, tags_created, reputation_score, contribution_level,
                created_at
            ) VALUES (
                COALESCE((SELECT id FROM community_user_stats WHERE user_id = ?), ? || '_stats'),
                ?,
                ?,
                ?,
                COALESCE((SELECT total_downloads FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT total_likes FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT total_views FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT reviews_given FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT sources_downloaded FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT tags_created FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT reputation_score FROM community_user_stats WHERE user_id = ?), 0),
                COALESCE((SELECT contribution_level FROM community_user_stats WHERE user_id = ?), 'beginner'),
                COALESCE((SELECT created_at FROM community_user_stats WHERE user_id = ?), strftime('%s', 'now') * 1000)
            )
        `).bind(
      userId,
      userId,
      // for id generation
      userId,
      // user_id
      realStats.shared_count || 0,
      // shared_sources_count
      Date.now(),
      // updated_at
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId,
      userId
      // for COALESCE selects
    ).run();
    console.log("\u7528\u6237\u7EDF\u8BA1\u66F4\u65B0\u6210\u529F\uFF0C\u65B0\u7684\u5206\u4EAB\u6570:", realStats.shared_count);
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u7EDF\u8BA1\u5931\u8D25:", error);
  }
}
__name(updateUserStatsAfterDelete, "updateUserStatsAfterDelete");

// src/handlers/community.js
async function communityGetTagsHandler(request, env) {
  try {
    const url = new URL(request.url);
    const onlyActive = url.searchParams.get("active") !== "false";
    let whereConditions = [];
    let params = [];
    if (onlyActive) {
      whereConditions.push("cst.tag_active = ?");
      params.push(1);
    }
    let query = `
            SELECT 
                cst.id,
                cst.tag_name,
                cst.tag_description,
                cst.tag_color,
                cst.usage_count,
                cst.is_official,
                cst.tag_active,
                cst.created_by,
                u.username as creator_name,
                cst.created_at,
                cst.updated_at
            FROM community_source_tags cst
            LEFT JOIN users u ON cst.created_by = u.id
        `;
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(" AND ")}`;
    }
    query += ` ORDER BY cst.is_official DESC, cst.usage_count DESC, cst.created_at DESC`;
    const result = await env.DB.prepare(query).bind(...params).all();
    const tags = result.results.map((tag) => ({
      id: tag.id,
      name: tag.tag_name,
      description: tag.tag_description,
      color: tag.tag_color,
      usageCount: tag.usage_count || 0,
      isOfficial: Boolean(tag.is_official),
      isActive: Boolean(tag.tag_active),
      creator: {
        id: tag.created_by,
        name: tag.creator_name || "System"
      },
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    }));
    return utils.successResponse({
      tags,
      total: tags.length
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u6807\u7B7E\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u6807\u7B7E\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityGetTagsHandler, "communityGetTagsHandler");
async function communityCreateTagHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const body = await request.json().catch(() => ({}));
    const { name, description, color } = body;
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 20) {
      return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u957F\u5EA6\u5FC5\u987B\u57282-20\u4E2A\u5B57\u7B26\u4E4B\u95F4", 400);
    }
    if (!/^[\u4e00-\u9fa5\w\s\-]{2,20}$/.test(trimmedName)) {
      return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u53EA\u80FD\u5305\u542B\u4E2D\u6587\u3001\u82F1\u6587\u3001\u6570\u5B57\u3001\u7A7A\u683C\u548C\u77ED\u6A2A\u7EBF", 400);
    }
    const validColor = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#3b82f6";
    const existingTag = await env.DB.prepare(`
            SELECT id FROM community_source_tags WHERE LOWER(tag_name) = LOWER(?)
        `).bind(trimmedName).first();
    if (existingTag) {
      return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u540D\u79F0", 400);
    }
    const userTagCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM community_source_tags 
            WHERE created_by = ? AND tag_active = 1
        `).bind(user.id).first().catch(() => ({ count: 0 }));
    const maxTagsPerUser = parseInt(env.MAX_TAGS_PER_USER || "50");
    if (userTagCount.count >= maxTagsPerUser) {
      return utils.errorResponse(`\u6BCF\u4E2A\u7528\u6237\u6700\u591A\u53EA\u80FD\u521B\u5EFA${maxTagsPerUser}\u4E2A\u6807\u7B7E`, 400);
    }
    const tagId = utils.generateId();
    const now = Date.now();
    await env.DB.prepare(`
            INSERT INTO community_source_tags (
                id, tag_name, tag_description, tag_color, usage_count, 
                is_official, tag_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      tagId,
      trimmedName,
      description?.trim() || "",
      validColor,
      0,
      0,
      1,
      user.id,
      now,
      now
    ).run();
    await utils.logUserAction(env, user.id, "tag_created", {
      tagId,
      tagName: trimmedName
    }, request);
    return utils.successResponse({
      message: "\u6807\u7B7E\u521B\u5EFA\u6210\u529F",
      tag: {
        id: tagId,
        name: trimmedName,
        description: description?.trim() || "",
        color: validColor,
        usageCount: 0,
        isOfficial: false,
        isActive: true,
        creator: {
          id: user.id,
          name: user.username
        },
        createdAt: now
      }
    });
  } catch (error) {
    console.error("\u521B\u5EFA\u6807\u7B7E\u5931\u8D25:", error);
    let errorMessage = "\u521B\u5EFA\u6807\u7B7E\u5931\u8D25";
    if (error.message.includes("UNIQUE constraint")) {
      errorMessage = "\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u540D\u79F0";
    } else if (error.message.includes("SQLITE_ERROR")) {
      errorMessage = "SQLite\u6570\u636E\u5E93\u9519\u8BEF\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u72B6\u6001";
    } else {
      errorMessage += ": " + error.message;
    }
    return utils.errorResponse(errorMessage, 500);
  }
}
__name(communityCreateTagHandler, "communityCreateTagHandler");
async function communityUpdateTagHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const tagId = request.params?.id;
    if (!tagId) {
      return utils.errorResponse("\u6807\u7B7EID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const existingTag = await env.DB.prepare(`
            SELECT * FROM community_source_tags WHERE id = ?
        `).bind(tagId).first();
    if (!existingTag) {
      return utils.errorResponse("\u6807\u7B7E\u4E0D\u5B58\u5728", 404);
    }
    if (existingTag.created_by !== user.id && !existingTag.is_official) {
      const userPermissions = JSON.parse(user.permissions || "[]");
      if (!userPermissions.includes("admin") && !userPermissions.includes("tag_manage")) {
        return utils.errorResponse("\u65E0\u6743\u4FEE\u6539\u6B64\u6807\u7B7E", 403);
      }
    }
    const body = await request.json().catch(() => ({}));
    const { name, description, color, isActive } = body;
    if (name !== void 0) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 20) {
        return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u957F\u5EA6\u5FC5\u987B\u57282-20\u4E2A\u5B57\u7B26\u4E4B\u95F4", 400);
      }
      const duplicateTag = await env.DB.prepare(`
                SELECT id FROM community_source_tags 
                WHERE LOWER(tag_name) = LOWER(?) AND id != ?
            `).bind(trimmedName, tagId).first();
      if (duplicateTag) {
        return utils.errorResponse("\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u540D\u79F0", 400);
      }
    }
    let validColor = existingTag.tag_color;
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
      validColor = color;
    } else if (color) {
      return utils.errorResponse("\u989C\u8272\u683C\u5F0F\u4E0D\u6B63\u786E", 400);
    }
    const now = Date.now();
    const updates = [];
    const params = [];
    if (name !== void 0 && name.trim() !== existingTag.tag_name) {
      updates.push("tag_name = ?");
      params.push(name.trim());
    }
    if (description !== void 0 && description.trim() !== (existingTag.tag_description || "")) {
      updates.push("tag_description = ?");
      params.push(description.trim());
    }
    if (color !== void 0 && color !== existingTag.tag_color) {
      updates.push("tag_color = ?");
      params.push(validColor);
    }
    if (isActive !== void 0 && Boolean(isActive) !== Boolean(existingTag.tag_active)) {
      updates.push("tag_active = ?");
      params.push(isActive ? 1 : 0);
    }
    if (updates.length === 0) {
      return utils.errorResponse("\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5185\u5BB9", 400);
    }
    updates.push("updated_at = ?");
    params.push(now);
    params.push(tagId);
    const updateQuery = `
            UPDATE community_source_tags 
            SET ${updates.join(", ")}
            WHERE id = ?
        `;
    await env.DB.prepare(updateQuery).bind(...params).run();
    await utils.logUserAction(env, user.id, "tag_updated", {
      tagId,
      tagName: name || existingTag.tag_name,
      changes: {
        name: name !== void 0 && name.trim() !== existingTag.tag_name,
        description: description !== void 0,
        color: color !== void 0,
        isActive: isActive !== void 0
      }
    }, request);
    return utils.successResponse({
      message: "\u6807\u7B7E\u66F4\u65B0\u6210\u529F",
      tagId,
      updatedFields: Object.keys(body).filter((key) => ["name", "description", "color", "isActive"].includes(key))
    });
  } catch (error) {
    console.error("\u66F4\u65B0\u6807\u7B7E\u5931\u8D25:", error);
    let errorMessage = "\u66F4\u65B0\u6807\u7B7E\u5931\u8D25";
    if (error.message.includes("UNIQUE constraint")) {
      errorMessage = "\u6807\u7B7E\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u540D\u79F0";
    } else {
      errorMessage += ": " + error.message;
    }
    return utils.errorResponse(errorMessage, 500);
  }
}
__name(communityUpdateTagHandler, "communityUpdateTagHandler");
async function communityDeleteTagHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const tagId = request.params.id;
    if (!tagId) {
      return utils.errorResponse("\u6807\u7B7EID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const existingTag = await env.DB.prepare(`
            SELECT * FROM community_source_tags WHERE id = ?
        `).bind(tagId).first();
    if (!existingTag) {
      return utils.errorResponse("\u6807\u7B7E\u4E0D\u5B58\u5728", 404);
    }
    if (existingTag.created_by !== user.id) {
      return utils.errorResponse("\u65E0\u6743\u5220\u9664\u6B64\u6807\u7B7E", 403);
    }
    if (existingTag.is_official) {
      return utils.errorResponse("\u4E0D\u80FD\u5220\u9664\u5B98\u65B9\u6807\u7B7E", 403);
    }
    if (existingTag.usage_count > 0) {
      return utils.errorResponse("\u4E0D\u80FD\u5220\u9664\u6B63\u5728\u4F7F\u7528\u7684\u6807\u7B7E", 400);
    }
    await env.DB.prepare(`
            DELETE FROM community_source_tags WHERE id = ?
        `).bind(tagId).run();
    await utils.logUserAction(env, user.id, "tag_deleted", {
      tagId,
      tagName: existingTag.tag_name
    }, request);
    return utils.successResponse({
      message: "\u6807\u7B7E\u5220\u9664\u6210\u529F",
      deletedId: tagId
    });
  } catch (error) {
    console.error("\u5220\u9664\u6807\u7B7E\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u6807\u7B7E\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityDeleteTagHandler, "communityDeleteTagHandler");
async function communityGetSourcesHandler(request, env) {
  try {
    const url = new URL(request.url);
    const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;
    const category = url.searchParams.get("category") || "all";
    const sortBy = url.searchParams.get("sort") || "created_at";
    const order = url.searchParams.get("order") || "desc";
    const search = url.searchParams.get("search");
    const tags = url.searchParams.get("tags");
    const featured = url.searchParams.get("featured") === "true";
    const author = url.searchParams.get("author");
    console.log("\u83B7\u53D6\u793E\u533A\u641C\u7D22\u6E90\u5217\u8868:", {
      page,
      limit,
      category,
      sortBy,
      order,
      search,
      author,
      featured,
      tags
    });
    let whereConditions = ["css.status = ?"];
    let params = ["active"];
    if (category !== "all") {
      whereConditions.push("css.source_category = ?");
      params.push(category);
    }
    if (search && search.trim()) {
      whereConditions.push("(css.source_name LIKE ? OR css.description LIKE ?)");
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }
    if (author && author.trim()) {
      whereConditions.push("u.username = ?");
      params.push(author.trim());
    }
    if (featured) {
      whereConditions.push("css.is_featured = ?");
      params.push(1);
    }
    if (tags && tags.trim()) {
      const tagIds = tags.split(",").map((t) => t.trim()).filter((t) => t.length > 0);
      if (tagIds.length > 0) {
        console.log("\u6309\u6807\u7B7E\u8FC7\u6EE4\uFF0C\u6807\u7B7EIDs:", tagIds);
        const tagConditions = tagIds.map(
          () => `JSON_EXTRACT(css.tags, '$') LIKE ?`
        ).join(" OR ");
        whereConditions.push(`(${tagConditions})`);
        tagIds.forEach((tagId) => {
          params.push(`%"${tagId}"%`);
        });
      }
    }
    const validSortColumns = ["created_at", "updated_at", "rating_score", "download_count", "like_count", "view_count"];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "created_at";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";
    const countQuery = `
            SELECT COUNT(*) as total 
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(" AND ")}
        `;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult.total || 0;
    const dataQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(" AND ")}
            ORDER BY css.${sortColumn} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
    const result = await env.DB.prepare(dataQuery).bind(...params, limit, offset).all();
    const allTagIds = [];
    result.results.forEach((source) => {
      try {
        const tagIds = source.tags ? JSON.parse(source.tags) : [];
        allTagIds.push(...tagIds);
      } catch (e) {
        console.warn("\u89E3\u6790\u6807\u7B7EID\u5931\u8D25:", e);
      }
    });
    const uniqueTagIds = [...new Set(allTagIds)];
    let tagMap = /* @__PURE__ */ new Map();
    if (uniqueTagIds.length > 0) {
      const tagQuery = `
        SELECT id, tag_name as name, tag_color as color, is_official 
        FROM community_source_tags 
        WHERE id IN (${uniqueTagIds.map(() => "?").join(",")}) AND tag_active = 1
    `;
      const tagResult = await env.DB.prepare(tagQuery).bind(...uniqueTagIds).all();
      tagResult.results.forEach((tag) => {
        tagMap.set(tag.id, {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          isOfficial: Boolean(tag.is_official)
        });
      });
    }
    const sources = result.results.map((source) => {
      let sourceTags = [];
      try {
        const tagIds = source.tags ? JSON.parse(source.tags) : [];
        sourceTags = tagIds.map((tagId) => {
          const tagInfo = tagMap.get(tagId);
          return tagInfo || {
            id: tagId,
            name: `\u672A\u77E5\u6807\u7B7E-${tagId.slice(0, 8)}`,
            color: "#6b7280",
            isOfficial: false
          };
        }).slice(0, 5);
      } catch (e) {
        console.warn("\u5904\u7406\u6E90\u6807\u7B7E\u65F6\u51FA\u9519:", e);
        sourceTags = [];
      }
      return {
        id: source.id,
        name: source.source_name,
        subtitle: source.source_subtitle,
        icon: source.source_icon,
        urlTemplate: source.source_url_template,
        category: source.source_category,
        description: source.description,
        tags: sourceTags,
        author: {
          id: source.user_id,
          name: source.author_name
        },
        stats: {
          downloads: source.download_count || 0,
          likes: source.like_count || 0,
          views: source.view_count || 0,
          rating: source.rating_score || 0,
          reviewCount: source.review_count || 0
        },
        isVerified: Boolean(source.is_verified),
        isFeatured: Boolean(source.is_featured),
        createdAt: source.created_at,
        updatedAt: source.updated_at,
        lastTestedAt: source.last_tested_at
      };
    });
    const totalPages = Math.ceil(total / limit);
    return utils.successResponse({
      sources,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: offset + limit < total,
        hasPrev: page > 1
      },
      filters: {
        category,
        search,
        author,
        featured,
        tags,
        sort: sortBy,
        order
      }
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u793E\u533A\u641C\u7D22\u6E90\u5217\u8868\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u5217\u8868\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityGetSourcesHandler, "communityGetSourcesHandler");
async function communityCreateSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const body = await request.json().catch(() => ({}));
    const { name, subtitle, icon, urlTemplate, category, description, tags } = body;
    const missingFields = utils.validateRequiredParams(body, ["name", "urlTemplate", "category"]);
    if (missingFields.length > 0) {
      return utils.errorResponse(`\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: ${missingFields.join(", ")}`);
    }
    if (!urlTemplate.includes("{keyword}")) {
      return utils.errorResponse("URL\u6A21\u677F\u5FC5\u987B\u5305\u542B{keyword}\u5360\u4F4D\u7B26");
    }
    try {
      new URL(urlTemplate.replace("{keyword}", "test"));
    } catch (error) {
      return utils.errorResponse("URL\u683C\u5F0F\u65E0\u6548");
    }
    const userShareCount = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM community_shared_sources 
            WHERE user_id = ? AND status IN ('active', 'pending')
        `).bind(user.id).first();
    const maxShares = parseInt(env.COMMUNITY_MAX_SHARES_PER_USER || "50");
    if (userShareCount.count >= maxShares) {
      return utils.errorResponse(`\u6BCF\u4E2A\u7528\u6237\u6700\u591A\u53EA\u80FD\u5206\u4EAB${maxShares}\u4E2A\u641C\u7D22\u6E90`);
    }
    const existingSource = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE (source_name = ? OR source_url_template = ?) 
            AND status = 'active'
        `).bind(name, urlTemplate).first();
    if (existingSource) {
      return utils.errorResponse("\u76F8\u540C\u540D\u79F0\u6216URL\u7684\u641C\u7D22\u6E90\u5DF2\u5B58\u5728");
    }
    let processedTagIds = [];
    if (Array.isArray(tags) && tags.length > 0) {
      const validTags = tags.slice(0, 10);
      if (validTags.length > 0) {
        const tagQuery = `
            SELECT id FROM community_source_tags 
            WHERE id IN (${validTags.map(() => "?").join(",")}) 
            AND tag_active = 1
        `;
        const tagResult = await env.DB.prepare(tagQuery).bind(...validTags).all();
        processedTagIds = tagResult.results.map((tag) => tag.id);
      }
    }
    const sourceId = utils.generateId();
    const now = Date.now();
    await env.DB.prepare(`
            INSERT INTO community_shared_sources (
                id, user_id, source_name, source_subtitle, source_icon, 
                source_url_template, source_category, description, tags,
                status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      sourceId,
      user.id,
      name.trim(),
      subtitle?.trim() || null,
      icon?.trim() || "\u{1F50D}",
      urlTemplate.trim(),
      category,
      description?.trim() || null,
      JSON.stringify(processedTagIds),
      env.COMMUNITY_REQUIRE_APPROVAL === "true" ? "pending" : "active",
      now,
      now
    ).run();
    if (processedTagIds.length > 0) {
      for (const tagId of processedTagIds) {
        await env.DB.prepare(`
                    UPDATE community_source_tags 
                    SET usage_count = usage_count + 1, updated_at = ?
                    WHERE id = ?
                `).bind(now, tagId).run();
      }
    }
    await utils.logUserAction(env, user.id, "community_source_shared", {
      sourceId,
      sourceName: name,
      category,
      tagsCount: processedTagIds.length
    }, request);
    const status = env.COMMUNITY_REQUIRE_APPROVAL === "true" ? "pending" : "active";
    const message = status === "pending" ? "\u641C\u7D22\u6E90\u5DF2\u63D0\u4EA4\uFF0C\u7B49\u5F85\u7BA1\u7406\u5458\u5BA1\u6838" : "\u641C\u7D22\u6E90\u5206\u4EAB\u6210\u529F";
    return utils.successResponse({
      message,
      sourceId,
      status
    });
  } catch (error) {
    console.error("\u5206\u4EAB\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u5206\u4EAB\u641C\u7D22\u6E90\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityCreateSourceHandler, "communityCreateSourceHandler");
async function communityGetSourceDetailHandler(request, env) {
  try {
    const sourceId = request.params.id;
    await env.DB.prepare(`
            UPDATE community_shared_sources 
            SET view_count = view_count + 1 
            WHERE id = ?
        `).bind(sourceId).run();
    const sourceResult = await env.DB.prepare(`
            SELECT 
                css.*,
                u.username as author_name,
                u.id as author_id,
                cus.reputation_score as author_reputation,
                cus.shared_sources_count as author_total_shares
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            LEFT JOIN community_user_stats cus ON css.user_id = cus.user_id
            WHERE css.id = ? AND css.status = ?
        `).bind(sourceId, "active").first();
    if (!sourceResult) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728", 404);
    }
    const reviewsResult = await env.DB.prepare(`
            SELECT 
                csr.*,
                CASE WHEN csr.is_anonymous = 1 THEN '\u533F\u540D\u7528\u6237' ELSE u.username END as reviewer_name
            FROM community_source_reviews csr
            LEFT JOIN users u ON csr.user_id = u.id
            WHERE csr.shared_source_id = ?
            ORDER BY csr.created_at DESC
            LIMIT 10
        `).bind(sourceId).all();
    const reviews = reviewsResult.results.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reviewerName: review.reviewer_name,
      isAnonymous: Boolean(review.is_anonymous),
      createdAt: review.created_at
    }));
    let tagDetails = [];
    const tagIds = sourceResult.tags ? JSON.parse(sourceResult.tags) : [];
    if (tagIds.length > 0) {
      const tagQuery = `
        SELECT id, tag_name as name, tag_description as description, 
               tag_color as color, is_official, usage_count 
        FROM community_source_tags 
        WHERE id IN (${tagIds.map(() => "?").join(",")}) AND tag_active = 1
    `;
      const tagResult = await env.DB.prepare(tagQuery).bind(...tagIds).all();
      tagDetails = tagResult.results.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        color: tag.color,
        isOfficial: Boolean(tag.is_official),
        usageCount: tag.usage_count || 0
      }));
    }
    const source = {
      id: sourceResult.id,
      name: sourceResult.source_name,
      subtitle: sourceResult.source_subtitle,
      icon: sourceResult.source_icon,
      urlTemplate: sourceResult.source_url_template,
      category: sourceResult.source_category,
      description: sourceResult.description,
      tags: tagDetails,
      author: {
        id: sourceResult.author_id,
        name: sourceResult.author_name,
        reputation: sourceResult.author_reputation || 0,
        totalShares: sourceResult.author_total_shares || 0
      },
      stats: {
        downloads: sourceResult.download_count,
        likes: sourceResult.like_count,
        views: sourceResult.view_count,
        rating: sourceResult.rating_score,
        reviewCount: sourceResult.rating_count
      },
      reviews,
      isVerified: Boolean(sourceResult.is_verified),
      isFeatured: Boolean(sourceResult.is_featured),
      createdAt: sourceResult.created_at,
      updatedAt: sourceResult.updated_at,
      lastTestedAt: sourceResult.last_tested_at
    };
    return utils.successResponse({ source });
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u8BE6\u60C5\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u8BE6\u60C5\u5931\u8D25", 500);
  }
}
__name(communityGetSourceDetailHandler, "communityGetSourceDetailHandler");
async function communityUpdateSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const sourceId = request.params?.id;
    if (!sourceId || sourceId.length < 10) {
      return utils.errorResponse("\u641C\u7D22\u6E90ID\u65E0\u6548", 400);
    }
    const existingSource = await env.DB.prepare(`
            SELECT * FROM community_shared_sources 
            WHERE id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
    if (!existingSource) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728\u6216\u60A8\u65E0\u6743\u7F16\u8F91", 404);
    }
    const body = await request.json().catch(() => ({}));
    const { name, subtitle, icon, description, tags, category } = body;
    if (!name || name.trim().length < 2) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u540D\u79F0\u81F3\u5C11\u9700\u89812\u4E2A\u5B57\u7B26", 400);
    }
    if (category && !["jav", "movie", "torrent", "other"].includes(category)) {
      return utils.errorResponse("\u65E0\u6548\u7684\u5206\u7C7B", 400);
    }
    let processedTagIds = [];
    if (Array.isArray(tags)) {
      const validTags = tags.slice(0, 10).filter((tagId) => tagId && typeof tagId === "string");
      if (validTags.length > 0) {
        const tagQuery = `
            SELECT id FROM community_source_tags 
            WHERE id IN (${validTags.map(() => "?").join(",")}) 
            AND tag_active = 1
        `;
        const tagResult = await env.DB.prepare(tagQuery).bind(...validTags).all();
        processedTagIds = tagResult.results.map((tag) => tag.id);
      }
    }
    const now = Date.now();
    await env.DB.prepare(`
            UPDATE community_shared_sources SET
                source_name = ?,
                source_subtitle = ?,
                source_icon = ?,
                description = ?,
                tags = ?,
                source_category = ?,
                updated_at = ?
            WHERE id = ? AND user_id = ?
        `).bind(
      name.trim(),
      subtitle?.trim() || existingSource.source_subtitle,
      icon?.trim() || existingSource.source_icon,
      description?.trim() || existingSource.description,
      JSON.stringify(processedTagIds),
      category || existingSource.source_category,
      now,
      sourceId,
      user.id
    ).run();
    await utils.logUserAction(env, user.id, "community_source_edited", {
      sourceId,
      sourceName: name,
      changes: {
        name: name !== existingSource.source_name,
        subtitle: subtitle !== existingSource.source_subtitle,
        description: description !== existingSource.description,
        tags: JSON.stringify(processedTagIds) !== existingSource.tags,
        category: category !== existingSource.source_category
      }
    }, request);
    return utils.successResponse({
      message: "\u641C\u7D22\u6E90\u66F4\u65B0\u6210\u529F",
      sourceId,
      updatedFields: Object.keys(body).filter((key) => ["name", "subtitle", "icon", "description", "tags", "category"].includes(key))
    });
  } catch (error) {
    console.error("\u7F16\u8F91\u641C\u7D22\u6E90\u5931\u8D25:", error);
    let errorMessage = "\u7F16\u8F91\u641C\u7D22\u6E90\u5931\u8D25";
    if (error.message.includes("UNIQUE constraint")) {
      errorMessage = "\u641C\u7D22\u6E90\u540D\u79F0\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u5176\u4ED6\u540D\u79F0";
    } else if (error.message.includes("FOREIGN KEY")) {
      errorMessage = "\u6240\u9009\u6807\u7B7E\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9";
    } else {
      errorMessage += ": " + error.message;
    }
    return utils.errorResponse(errorMessage, 500);
  }
}
__name(communityUpdateSourceHandler, "communityUpdateSourceHandler");
async function communityDeleteSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    let sourceId = request.params?.id;
    if (!sourceId) {
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/");
      sourceId = pathParts[pathParts.length - 1];
    }
    console.log("\u5220\u9664\u641C\u7D22\u6E90ID:", sourceId);
    if (!sourceId || sourceId.length < 10) {
      return utils.errorResponse("\u641C\u7D22\u6E90ID\u65E0\u6548", 400);
    }
    const source = await env.DB.prepare(`
            SELECT id, user_id, source_name FROM community_shared_sources 
            WHERE id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
    if (!source) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728\u6216\u60A8\u65E0\u6743\u5220\u9664", 404);
    }
    console.log("\u627E\u5230\u8981\u5220\u9664\u7684\u641C\u7D22\u6E90:", source.source_name);
    const deleteOperations = [];
    try {
      const reviewsResult = await env.DB.prepare(`
                DELETE FROM community_source_reviews WHERE shared_source_id = ?
            `).bind(sourceId).run();
      deleteOperations.push(`\u5220\u9664\u8BC4\u8BBA\u8BB0\u5F55: ${reviewsResult.changes}`);
      const likesResult = await env.DB.prepare(`
                DELETE FROM community_source_likes WHERE shared_source_id = ?
            `).bind(sourceId).run();
      deleteOperations.push(`\u5220\u9664\u70B9\u8D5E\u8BB0\u5F55: ${likesResult.changes}`);
      const downloadsResult = await env.DB.prepare(`
                DELETE FROM community_source_downloads WHERE shared_source_id = ?
            `).bind(sourceId).run();
      deleteOperations.push(`\u5220\u9664\u4E0B\u8F7D\u8BB0\u5F55: ${downloadsResult.changes}`);
      const reportsResult = await env.DB.prepare(`
                DELETE FROM community_source_reports WHERE shared_source_id = ?
            `).bind(sourceId).run();
      deleteOperations.push(`\u5220\u9664\u4E3E\u62A5\u8BB0\u5F55: ${reportsResult.changes}`);
      const sourceResult = await env.DB.prepare(`
                DELETE FROM community_shared_sources WHERE id = ? AND user_id = ?
            `).bind(sourceId, user.id).run();
      deleteOperations.push(`\u5220\u9664\u641C\u7D22\u6E90\u8BB0\u5F55: ${sourceResult.changes}`);
      if (sourceResult.changes === 0) {
        throw new Error("\u5220\u9664\u5931\u8D25\uFF1A\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664");
      }
      await updateUserStatsAfterDelete(env, user.id);
      console.log("\u5220\u9664\u64CD\u4F5C\u5B8C\u6210:", deleteOperations);
      await utils.logUserAction(env, user.id, "community_source_deleted", {
        sourceId,
        sourceName: source.source_name,
        deleteOperations
      }, request).catch((error) => {
        console.warn("\u8BB0\u5F55\u7528\u6237\u884C\u4E3A\u5931\u8D25:", error);
      });
      return utils.successResponse({
        message: "\u641C\u7D22\u6E90\u5220\u9664\u6210\u529F",
        deletedId: sourceId,
        sourceName: source.source_name,
        operations: deleteOperations
      });
    } catch (deleteError) {
      console.error("\u6267\u884C\u5220\u9664\u64CD\u4F5C\u65F6\u53D1\u751F\u9519\u8BEF:", deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error("\u5220\u9664\u641C\u7D22\u6E90\u603B\u4F53\u5931\u8D25:", error);
    let errorMessage = "\u5220\u9664\u641C\u7D22\u6E90\u5931\u8D25";
    if (error.message.includes("GREATEST")) {
      errorMessage = "\u6570\u636E\u5E93\u51FD\u6570\u4E0D\u517C\u5BB9\uFF0C\u7CFB\u7EDF\u6B63\u5728\u4FEE\u590D\u4E2D\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
    } else if (error.message.includes("FOREIGN KEY")) {
      errorMessage = "\u65E0\u6CD5\u5220\u9664\uFF1A\u5B58\u5728\u5173\u8054\u6570\u636E\uFF0C\u8BF7\u5148\u5904\u7406\u76F8\u5173\u5185\u5BB9";
    } else if (error.message.includes("SQLITE_CONSTRAINT")) {
      errorMessage = "\u5220\u9664\u5931\u8D25\uFF1A\u6570\u636E\u7EA6\u675F\u51B2\u7A81";
    } else if (error.message.includes("database is locked")) {
      errorMessage = "\u6570\u636E\u5E93\u5FD9\u788C\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5";
    } else if (error.message.includes("no such table")) {
      errorMessage = "\u6570\u636E\u5E93\u8868\u4E0D\u5B58\u5728\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458";
    } else {
      errorMessage += ": " + error.message;
    }
    return utils.errorResponse(errorMessage, 500);
  }
}
__name(communityDeleteSourceHandler, "communityDeleteSourceHandler");
async function communityDownloadSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const sourceId = request.params.id;
    const source = await env.DB.prepare(`
            SELECT * FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
    if (!source) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728", 404);
    }
    const existingByNameOrUrl = await env.DB.prepare(`
            SELECT id FROM search_sources 
            WHERE created_by = ? AND is_active = 1 AND (name = ? OR url_template = ?)
        `).bind(user.id, source.source_name, source.source_url_template).first();
    if (existingByNameOrUrl) {
      return utils.errorResponse("\u60A8\u5DF2\u7ECF\u6DFB\u52A0\u8FC7\u6B64\u641C\u7D22\u6E90\u6216\u76F8\u4F3C\u7684\u641C\u7D22\u6E90", 400);
    }
    const userSources = await env.DB.prepare(`
            SELECT id, supported_features FROM search_sources 
            WHERE created_by = ? AND is_active = 1
        `).bind(user.id).all();
    const alreadyAdded = userSources.results.some((userSource) => {
      try {
        const features = userSource.supported_features ? JSON.parse(userSource.supported_features) : [];
        return features.some(
          (feature) => typeof feature === "string" && feature.includes("community_source_id") && feature.includes(sourceId)
        );
      } catch (e) {
        return false;
      }
    });
    if (alreadyAdded) {
      return utils.errorResponse("\u60A8\u5DF2\u7ECF\u4ECE\u793E\u533A\u6DFB\u52A0\u8FC7\u6B64\u641C\u7D22\u6E90", 400);
    }
    const categoryMapping = {
      "jav": "database",
      "movie": "streaming",
      "torrent": "torrent",
      "other": "others"
    };
    const categoryId = categoryMapping[source.source_category] || "others";
    const categoryExists = await env.DB.prepare(`
            SELECT id FROM search_source_categories 
            WHERE id = ? AND is_active = 1
        `).bind(categoryId).first();
    if (!categoryExists) {
      throw new Error(`\u76EE\u6807\u5206\u7C7B ${categoryId} \u4E0D\u5B58\u5728`);
    }
    const newSourceId = utils.generateId();
    const now = Date.now();
    let homepageUrl = null;
    try {
      const urlObj = new URL(source.source_url_template.replace("{keyword}", ""));
      homepageUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch (e) {
      homepageUrl = null;
    }
    const supportedFeatures = [
      "community_source",
      "custom_source"
    ];
    supportedFeatures.push(`community_source_id:${sourceId}`);
    if (source.description && source.description.trim()) {
      supportedFeatures.push("description");
    }
    await env.DB.prepare(`
            INSERT INTO search_sources (
                id, category_id, name, subtitle, description, icon, url_template,
                homepage_url, site_type, searchable, requires_keyword, search_priority,
                supports_detail_extraction, extraction_quality, average_extraction_time,
                supported_features, is_system, is_active, display_order, usage_count,
                last_used_at, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      newSourceId,
      categoryId,
      source.source_name,
      source.source_subtitle || null,
      source.description || null,
      source.source_icon || "\u{1F50D}",
      source.source_url_template,
      homepageUrl,
      "browse",
      0,
      // searchable: 默认不参与搜索
      0,
      // requires_keyword: 默认不需要关键词
      5,
      // search_priority: 默认中等优先级
      0,
      // supports_detail_extraction: 默认不支持详情提取
      "none",
      // extraction_quality
      0,
      // average_extraction_time
      JSON.stringify(supportedFeatures),
      0,
      // is_system: 用户自定义源
      1,
      // is_active: 默认激活
      999,
      // display_order
      0,
      // usage_count
      null,
      // last_used_at
      user.id,
      now,
      now
    ).run();
    const configId = utils.generateId();
    await env.DB.prepare(`
            INSERT INTO user_search_source_configs (
                id, user_id, source_id, is_enabled, custom_priority,
                custom_name, custom_subtitle, custom_icon, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      configId,
      user.id,
      newSourceId,
      1,
      // is_enabled: 默认可用
      null,
      null,
      null,
      null,
      `\u4ECE\u793E\u533A\u6DFB\u52A0\uFF1A${source.source_name}`,
      now,
      now
    ).run();
    const downloadId = utils.generateId();
    const ip = utils.getClientIP(request);
    const userAgent = request.headers.get("User-Agent") || "";
    await env.DB.prepare(`
            INSERT INTO community_source_downloads (
                id, shared_source_id, user_id, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(downloadId, sourceId, user.id, ip, userAgent, now).run();
    await env.DB.prepare(`
            UPDATE community_shared_sources 
            SET download_count = download_count + 1 
            WHERE id = ?
        `).bind(sourceId).run();
    await utils.logUserAction(env, user.id, "community_source_downloaded_v3", {
      communitySourceId: sourceId,
      newSourceId,
      sourceName: source.source_name,
      category: source.source_category,
      mappedCategoryId: categoryId
    }, request);
    const createdSource = await env.DB.prepare(`
            SELECT 
                ss.*,
                sc.name as category_name,
                sc.icon as category_icon,
                mc.name as major_category_name
            FROM search_sources ss
            LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
            LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
            WHERE ss.id = ?
        `).bind(newSourceId).first();
    return utils.successResponse({
      message: "\u641C\u7D22\u6E90\u5DF2\u6210\u529F\u6DFB\u52A0\u5230\u60A8\u7684\u641C\u7D22\u6E90\u7BA1\u7406",
      sourceId: newSourceId,
      communitySourceId: sourceId,
      source: {
        id: createdSource.id,
        name: createdSource.name,
        subtitle: createdSource.subtitle,
        icon: createdSource.icon,
        urlTemplate: createdSource.url_template,
        category: {
          id: createdSource.category_id,
          name: createdSource.category_name,
          icon: createdSource.category_icon
        },
        majorCategory: {
          name: createdSource.major_category_name
        },
        description: createdSource.description,
        isFromCommunity: true,
        createdAt: createdSource.created_at
      }
    });
  } catch (error) {
    console.error("\u4E0B\u8F7D\u641C\u7D22\u6E90\u5931\u8D25:", error);
    let errorMessage = "\u6DFB\u52A0\u641C\u7D22\u6E90\u5931\u8D25";
    if (error.message.includes("UNIQUE constraint")) {
      errorMessage = "\u641C\u7D22\u6E90\u5DF2\u5B58\u5728\uFF0C\u8BF7\u52FF\u91CD\u590D\u6DFB\u52A0";
    } else if (error.message.includes("FOREIGN KEY")) {
      errorMessage = "\u76EE\u6807\u5206\u7C7B\u4E0D\u5B58\u5728\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458";
    } else if (error.message.includes("\u76EE\u6807\u5206\u7C7B")) {
      errorMessage = error.message;
    } else {
      errorMessage += ": " + error.message;
    }
    return utils.errorResponse(errorMessage, 500);
  }
}
__name(communityDownloadSourceHandler, "communityDownloadSourceHandler");
async function communityLikeSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const sourceId = request.params.id;
    const body = await request.json().catch(() => ({}));
    const likeType = body.type || "like";
    if (!["like", "favorite", "bookmark"].includes(likeType)) {
      return utils.errorResponse("\u65E0\u6548\u7684\u64CD\u4F5C\u7C7B\u578B");
    }
    const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
    if (!source) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728", 404);
    }
    const existingLike = await env.DB.prepare(`
            SELECT id FROM community_source_likes 
            WHERE shared_source_id = ? AND user_id = ? AND like_type = ?
        `).bind(sourceId, user.id, likeType).first();
    if (existingLike) {
      await env.DB.prepare(`
                DELETE FROM community_source_likes 
                WHERE id = ?
            `).bind(existingLike.id).run();
      return utils.successResponse({
        message: `\u5DF2\u53D6\u6D88${likeType === "like" ? "\u70B9\u8D5E" : "\u6536\u85CF"}`,
        action: "removed"
      });
    } else {
      const likeId = utils.generateId();
      await env.DB.prepare(`
                INSERT INTO community_source_likes (
                    id, shared_source_id, user_id, like_type, created_at
                ) VALUES (?, ?, ?, ?, ?)
            `).bind(likeId, sourceId, user.id, likeType, Date.now()).run();
      return utils.successResponse({
        message: `${likeType === "like" ? "\u70B9\u8D5E" : "\u6536\u85CF"}\u6210\u529F`,
        action: "added"
      });
    }
  } catch (error) {
    console.error("\u70B9\u8D5E/\u6536\u85CF\u5931\u8D25:", error);
    return utils.errorResponse("\u64CD\u4F5C\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityLikeSourceHandler, "communityLikeSourceHandler");
async function communityReviewSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const sourceId = request.params.id;
    const body = await request.json().catch(() => ({}));
    const { rating, comment, isAnonymous } = body;
    if (!rating || rating < 1 || rating > 5) {
      return utils.errorResponse("\u8BC4\u5206\u5FC5\u987B\u57281-5\u4E4B\u95F4");
    }
    const source = await env.DB.prepare(`
            SELECT id, user_id FROM community_shared_sources 
            WHERE id = ? AND status = 'active'
        `).bind(sourceId).first();
    if (!source) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728", 404);
    }
    if (source.user_id === user.id) {
      return utils.errorResponse("\u4E0D\u80FD\u8BC4\u4EF7\u81EA\u5DF1\u5206\u4EAB\u7684\u641C\u7D22\u6E90");
    }
    const existingReview = await env.DB.prepare(`
            SELECT id FROM community_source_reviews 
            WHERE shared_source_id = ? AND user_id = ?
        `).bind(sourceId, user.id).first();
    if (existingReview) {
      await env.DB.prepare(`
                UPDATE community_source_reviews 
                SET rating = ?, comment = ?, is_anonymous = ?, updated_at = ?
                WHERE id = ?
            `).bind(rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), existingReview.id).run();
      return utils.successResponse({
        message: "\u8BC4\u4EF7\u66F4\u65B0\u6210\u529F"
      });
    } else {
      const reviewId = utils.generateId();
      await env.DB.prepare(`
                INSERT INTO community_source_reviews (
                    id, shared_source_id, user_id, rating, comment, is_anonymous, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(reviewId, sourceId, user.id, rating, comment?.trim() || null, Boolean(isAnonymous), Date.now(), Date.now()).run();
      return utils.successResponse({
        message: "\u8BC4\u4EF7\u63D0\u4EA4\u6210\u529F"
      });
    }
  } catch (error) {
    console.error("\u63D0\u4EA4\u8BC4\u4EF7\u5931\u8D25:", error);
    return utils.errorResponse("\u63D0\u4EA4\u8BC4\u4EF7\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityReviewSourceHandler, "communityReviewSourceHandler");
async function communityReportSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const sourceId = request.params.id;
    const body = await request.json().catch(() => ({}));
    const { reason, details } = body;
    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return utils.errorResponse("\u4E3E\u62A5\u539F\u56E0\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const source = await env.DB.prepare(`
            SELECT id FROM community_shared_sources WHERE id = ?
        `).bind(sourceId).first();
    if (!source) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728", 404);
    }
    const reportId = utils.generateId();
    await env.DB.prepare(`
            INSERT INTO community_source_reports (
                id, shared_source_id, reporter_user_id, report_reason, 
                report_details, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(reportId, sourceId, user.id, reason.trim(), details?.trim() || null, "pending", Date.now(), Date.now()).run();
    return utils.successResponse({
      message: "\u4E3E\u62A5\u5DF2\u63D0\u4EA4\uFF0C\u6211\u4EEC\u4F1A\u5C3D\u5FEB\u5904\u7406"
    });
  } catch (error) {
    console.error("\u63D0\u4EA4\u4E3E\u62A5\u5931\u8D25:", error);
    return utils.errorResponse("\u63D0\u4EA4\u4E3E\u62A5\u5931\u8D25: " + error.message, 500);
  }
}
__name(communityReportSourceHandler, "communityReportSourceHandler");
async function communityUserStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  try {
    const statsResult = await env.DB.prepare(`
            SELECT * FROM community_user_stats WHERE user_id = ?
        `).bind(user.id).first();
    const sharedSourcesResult = await env.DB.prepare(`
            SELECT 
                id, source_name, source_category, download_count, 
                like_count, view_count, rating_score, status, created_at
            FROM community_shared_sources 
            WHERE user_id = ? AND status = 'active'
            ORDER BY created_at DESC
            LIMIT 10
        `).bind(user.id).all();
    const realTimeStats = await env.DB.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM community_shared_sources WHERE user_id = ? AND status = 'active') as shared_count,
                (SELECT COUNT(*) FROM community_source_downloads csd 
                 JOIN community_shared_sources css ON csd.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active') as total_downloads,
                (SELECT COUNT(*) FROM community_source_likes csl 
                 JOIN community_shared_sources css ON csl.shared_source_id = css.id 
                 WHERE css.user_id = ? AND css.status = 'active' AND csl.like_type = 'like') as total_likes,
                (SELECT COALESCE(SUM(view_count), 0) FROM community_shared_sources 
                 WHERE user_id = ? AND status = 'active') as total_views,
                (SELECT COUNT(*) FROM community_source_reviews WHERE user_id = ?) as reviews_given,
                (SELECT COUNT(DISTINCT shared_source_id) FROM community_source_downloads WHERE user_id = ?) as sources_downloaded,
                (SELECT COUNT(*) FROM community_source_tags WHERE created_by = ? AND tag_active = 1) as tags_created
        `).bind(user.id, user.id, user.id, user.id, user.id, user.id, user.id).first();
    const useRealTime = !statsResult || Math.abs((statsResult.total_downloads || 0) - realTimeStats.total_downloads) > 1 || Math.abs((statsResult.total_likes || 0) - realTimeStats.total_likes) > 1 || Math.abs((statsResult.total_views || 0) - realTimeStats.total_views) > 5;
    const stats = {
      general: {
        sharedSources: useRealTime ? realTimeStats.shared_count : statsResult?.shared_sources_count || 0,
        totalDownloads: useRealTime ? realTimeStats.total_downloads : statsResult?.total_downloads || 0,
        totalLikes: useRealTime ? realTimeStats.total_likes : statsResult?.total_likes || 0,
        totalViews: useRealTime ? realTimeStats.total_views : statsResult?.total_views || 0,
        reviewsGiven: useRealTime ? realTimeStats.reviews_given : statsResult?.reviews_given || 0,
        sourcesDownloaded: useRealTime ? realTimeStats.sources_downloaded : statsResult?.sources_downloaded || 0,
        tagsCreated: useRealTime ? realTimeStats.tags_created : statsResult?.tags_created || 0,
        reputationScore: statsResult?.reputation_score || 0,
        contributionLevel: statsResult?.contribution_level || "beginner"
      },
      recentShares: sharedSourcesResult.results.map((source) => ({
        id: source.id,
        name: source.source_name,
        category: source.source_category,
        downloads: source.download_count,
        likes: source.like_count,
        views: source.view_count,
        rating: source.rating_score,
        status: source.status,
        createdAt: source.created_at
      }))
    };
    if (useRealTime && statsResult) {
      console.log("\u68C0\u6D4B\u5230\u7EDF\u8BA1\u6570\u636E\u4E0D\u4E00\u81F4\uFF0C\u89E6\u53D1\u7F13\u5B58\u66F4\u65B0");
      env.DB.prepare(`
                UPDATE community_user_stats 
                SET total_downloads = ?, total_likes = ?, total_views = ?, tags_created = ?, updated_at = ?
                WHERE user_id = ?
            `).bind(
        realTimeStats.total_downloads,
        realTimeStats.total_likes,
        realTimeStats.total_views,
        realTimeStats.tags_created,
        Date.now(),
        user.id
      ).run().catch((error) => {
        console.error("\u66F4\u65B0\u7528\u6237\u7EDF\u8BA1\u7F13\u5B58\u5931\u8D25:", error);
      });
    }
    return utils.successResponse({ stats });
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u7EDF\u8BA1\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7528\u6237\u7EDF\u8BA1\u5931\u8D25", 500);
  }
}
__name(communityUserStatsHandler, "communityUserStatsHandler");
async function communitySearchHandler(request, env) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const category = url.searchParams.get("category") || "all";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "10"), 20);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    if (!query || query.trim().length < 1) {
      return utils.errorResponse("\u641C\u7D22\u5173\u952E\u8BCD\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const trimmedQuery = query.trim();
    console.log("\u641C\u7D22\u793E\u533A\u5185\u5BB9:", { query: trimmedQuery, category, limit });
    let whereConditions = ["css.status = ?"];
    let params = ["active"];
    whereConditions.push(`(
            css.source_name LIKE ? OR 
            css.description LIKE ? OR 
            css.source_subtitle LIKE ? OR
            EXISTS (
                SELECT 1 FROM community_source_tags cst 
                WHERE cst.tag_name LIKE ? AND 
                JSON_EXTRACT(css.tags, '$[*]') LIKE '%' || cst.id || '%'
            )
        )`);
    const searchPattern = `%${trimmedQuery}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    if (category && category !== "all") {
      whereConditions.push("css.source_category = ?");
      params.push(category);
    }
    const searchQuery = `
            SELECT 
                css.*,
                u.username as author_name,
                (SELECT COUNT(*) FROM community_source_reviews WHERE shared_source_id = css.id) as review_count,
                (
                    CASE 
                        WHEN css.source_name LIKE ? THEN 3
                        WHEN css.source_subtitle LIKE ? THEN 2
                        WHEN css.description LIKE ? THEN 1
                        ELSE 0
                    END
                ) as relevance_score
            FROM community_shared_sources css
            LEFT JOIN users u ON css.user_id = u.id
            WHERE ${whereConditions.join(" AND ")}
            ORDER BY 
                relevance_score DESC,
                css.is_featured DESC,
                css.rating_score DESC,
                css.download_count DESC,
                css.created_at DESC
            LIMIT ? OFFSET ?
        `;
    const finalParams = [searchPattern, searchPattern, searchPattern, ...params, limit, offset];
    const result = await env.DB.prepare(searchQuery).bind(...finalParams).all();
    const countQuery = `
            SELECT COUNT(*) as total
            FROM community_shared_sources css
            WHERE ${whereConditions.join(" AND ")}
        `;
    const countResult = await env.DB.prepare(countQuery).bind(...params).first();
    const total = countResult?.total || 0;
    const sources = result.results.map((source) => ({
      id: source.id,
      name: source.source_name,
      subtitle: source.source_subtitle,
      icon: source.source_icon,
      urlTemplate: source.source_url_template,
      category: source.source_category,
      description: source.description,
      tags: source.tags ? JSON.parse(source.tags) : [],
      author: {
        id: source.user_id,
        name: source.author_name
      },
      stats: {
        downloads: source.download_count,
        likes: source.like_count,
        views: source.view_count,
        rating: source.rating_score,
        reviewCount: source.review_count
      },
      isVerified: Boolean(source.is_verified),
      isFeatured: Boolean(source.is_featured),
      createdAt: source.created_at,
      relevanceScore: source.relevance_score
    }));
    console.log(`\u641C\u7D22\u5B8C\u6210: \u627E\u5230 ${sources.length} \u4E2A\u7ED3\u679C\uFF0C\u603B\u8BA1 ${total} \u4E2A`);
    return utils.successResponse({
      sources,
      query: trimmedQuery,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      category
    });
  } catch (error) {
    console.error("\u641C\u7D22\u793E\u533A\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u641C\u7D22\u5931\u8D25: " + error.message, 500);
  }
}
__name(communitySearchHandler, "communitySearchHandler");

// src/handlers/user.js
async function userGetSettingsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();
    const settings = userRecord ? JSON.parse(userRecord.settings || "{}") : {};
    return utils.successResponse({
      settings: {
        theme: settings.theme || "auto",
        autoSync: settings.autoSync !== false,
        cacheResults: settings.cacheResults !== false,
        maxHistoryPerUser: settings.maxHistoryPerUser || 1e3,
        maxFavoritesPerUser: settings.maxFavoritesPerUser || 1e3,
        allowAnalytics: settings.allowAnalytics !== false,
        searchSuggestions: settings.searchSuggestions !== false,
        // 移除了 searchSources, customSearchSources, customSourceCategories 相关设置
        // 这些现在通过独立的搜索源管理API处理
        checkSourceStatus: settings.checkSourceStatus,
        sourceStatusCheckTimeout: settings.sourceStatusCheckTimeout,
        sourceStatusCacheDuration: settings.sourceStatusCacheDuration,
        skipUnavailableSources: settings.skipUnavailableSources,
        showSourceStatus: settings.showSourceStatus,
        retryFailedSources: settings.retryFailedSources,
        // 保留其他用户个人设置
        ...settings
      }
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u8BBE\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7528\u6237\u8BBE\u7F6E\u5931\u8D25", 500);
  }
}
__name(userGetSettingsHandler, "userGetSettingsHandler");
async function userUpdateSettingsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { settings } = body;
    if (!settings || typeof settings !== "object") {
      return utils.errorResponse("\u8BBE\u7F6E\u6570\u636E\u683C\u5F0F\u9519\u8BEF");
    }
    const allowedSettings = [
      "theme",
      "autoSync",
      "cacheResults",
      "maxHistoryPerUser",
      "maxFavoritesPerUser",
      "allowAnalytics",
      "searchSuggestions",
      // 移除了: 'searchSources', 'customSearchSources', 'customSourceCategories'
      "checkSourceStatus",
      "sourceStatusCheckTimeout",
      "sourceStatusCacheDuration",
      "skipUnavailableSources",
      "showSourceStatus",
      "retryFailedSources"
    ];
    const filteredSettings = {};
    Object.keys(settings).forEach((key) => {
      if (allowedSettings.includes(key)) {
        filteredSettings[key] = settings[key];
      }
    });
    if (filteredSettings.hasOwnProperty("sourceStatusCheckTimeout")) {
      const timeout = Number(filteredSettings.sourceStatusCheckTimeout);
      if (timeout < 1e3 || timeout > 3e4) {
        return utils.errorResponse("\u72B6\u6001\u68C0\u67E5\u8D85\u65F6\u65F6\u95F4\u5FC5\u987B\u5728 1-30 \u79D2\u4E4B\u95F4");
      }
      filteredSettings.sourceStatusCheckTimeout = timeout;
    }
    if (filteredSettings.hasOwnProperty("sourceStatusCacheDuration")) {
      const cacheDuration = Number(filteredSettings.sourceStatusCacheDuration);
      if (cacheDuration < 6e4 || cacheDuration > 36e5) {
        return utils.errorResponse("\u72B6\u6001\u7F13\u5B58\u65F6\u95F4\u5FC5\u987B\u5728 60-3600 \u79D2\u4E4B\u95F4");
      }
      filteredSettings.sourceStatusCacheDuration = cacheDuration;
    }
    ["checkSourceStatus", "skipUnavailableSources", "showSourceStatus", "retryFailedSources"].forEach((key) => {
      if (filteredSettings.hasOwnProperty(key)) {
        filteredSettings[key] = Boolean(filteredSettings[key]);
      }
    });
    const userRecord = await env.DB.prepare(`
            SELECT settings FROM users WHERE id = ?
        `).bind(user.id).first();
    const currentSettings = userRecord ? JSON.parse(userRecord.settings || "{}") : {};
    const updatedSettings = { ...currentSettings, ...filteredSettings };
    await env.DB.prepare(`
            UPDATE users SET settings = ?, updated_at = ? WHERE id = ?
        `).bind(JSON.stringify(updatedSettings), Date.now(), user.id).run();
    await utils.logUserAction(env, user.id, "settings_update", {
      changedFields: Object.keys(filteredSettings),
      // 移除了搜索源相关的行为记录
      checkSourceStatusChanged: filteredSettings.hasOwnProperty("checkSourceStatus")
    }, request);
    return utils.successResponse({
      message: "\u8BBE\u7F6E\u66F4\u65B0\u6210\u529F",
      settings: updatedSettings
    });
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u8BBE\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u66F4\u65B0\u7528\u6237\u8BBE\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(userUpdateSettingsHandler, "userUpdateSettingsHandler");
async function userSyncFavoritesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { favorites } = body;
    if (!Array.isArray(favorites)) {
      return utils.errorResponse("\u6536\u85CF\u5939\u6570\u636E\u683C\u5F0F\u9519\u8BEF");
    }
    const maxFavorites = parseInt(env.MAX_FAVORITES_PER_USER || "1000");
    if (favorites.length > maxFavorites) {
      return utils.errorResponse(`\u6536\u85CF\u5939\u6570\u91CF\u4E0D\u80FD\u8D85\u8FC7 ${maxFavorites} \u4E2A`);
    }
    await env.DB.prepare(`DELETE FROM user_favorites WHERE user_id = ?`).bind(user.id).run();
    for (const favorite of favorites) {
      const favoriteId = favorite.id || utils.generateId();
      let createdAt = Date.now();
      if (favorite.addedAt) {
        const clientTimestamp = new Date(favorite.addedAt).getTime();
        if (!isNaN(clientTimestamp)) {
          createdAt = clientTimestamp;
        }
      } else if (favorite.created_at) {
        const clientTimestamp = new Date(favorite.created_at).getTime();
        if (!isNaN(clientTimestamp)) {
          createdAt = clientTimestamp;
        }
      }
      await env.DB.prepare(`
                INSERT INTO user_favorites (id, user_id, title, subtitle, url, icon, keyword, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
        favoriteId,
        user.id,
        favorite.title || "",
        favorite.subtitle || "",
        favorite.url || "",
        favorite.icon || "",
        favorite.keyword || "",
        createdAt,
        // 🔧 使用原始时间戳而不是 Date.now()
        Date.now()
        // updated_at 可以使用当前时间
      ).run();
    }
    return utils.successResponse({
      message: "\u6536\u85CF\u5939\u540C\u6B65\u6210\u529F",
      syncedCount: favorites.length
    });
  } catch (error) {
    console.error("\u540C\u6B65\u6536\u85CF\u5939\u5931\u8D25:", error);
    return utils.errorResponse("\u540C\u6B65\u6536\u85CF\u5939\u5931\u8D25", 500);
  }
}
__name(userSyncFavoritesHandler, "userSyncFavoritesHandler");
async function userGetFavoritesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const result = await env.DB.prepare(`
            SELECT * FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC
        `).bind(user.id).all();
    const favorites = result.results.map((fav) => ({
      id: fav.id,
      title: fav.title,
      subtitle: fav.subtitle,
      url: fav.url,
      icon: fav.icon,
      keyword: fav.keyword,
      addedAt: new Date(fav.created_at).toISOString(),
      // 确保时间格式正确
      created_at: fav.created_at,
      // 保留原始时间戳用于调试
      updated_at: fav.updated_at
    }));
    return utils.successResponse({ favorites });
  } catch (error) {
    console.error("\u83B7\u53D6\u6536\u85CF\u5939\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u6536\u85CF\u5939\u5931\u8D25", 500);
  }
}
__name(userGetFavoritesHandler, "userGetFavoritesHandler");
async function userSaveSearchHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { query, timestamp, source, resultCount } = body;
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return utils.errorResponse("\u641C\u7D22\u5173\u952E\u8BCD\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 200) {
      return utils.errorResponse("\u641C\u7D22\u5173\u952E\u8BCD\u8FC7\u957F");
    }
    const maxHistory = parseInt(env.MAX_HISTORY_PER_USER || "1000");
    const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();
    if (countResult.count >= maxHistory) {
      const deleteCount = countResult.count - maxHistory + 1;
      await env.DB.prepare(`
                DELETE FROM user_search_history 
                WHERE user_id = ? AND id IN (
                    SELECT id FROM user_search_history 
                    WHERE user_id = ? 
                    ORDER BY created_at ASC 
                    LIMIT ?
                )
            `).bind(user.id, user.id, deleteCount).run();
    }
    const historyId = utils.generateId();
    const now = timestamp || Date.now();
    await env.DB.prepare(`
            INSERT INTO user_search_history (id, user_id, query, source, results_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(historyId, user.id, trimmedQuery, source || "unknown", resultCount || 0, now).run();
    await utils.logUserAction(env, user.id, "search", { query: trimmedQuery, source }, request);
    return utils.successResponse({
      message: "\u641C\u7D22\u5386\u53F2\u4FDD\u5B58\u6210\u529F",
      historyId
    });
  } catch (error) {
    console.error("\u4FDD\u5B58\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u4FDD\u5B58\u641C\u7D22\u5386\u53F2\u5931\u8D25: " + error.message, 500);
  }
}
__name(userSaveSearchHistoryHandler, "userSaveSearchHistoryHandler");
async function userGetSearchHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const result = await env.DB.prepare(`
            SELECT * FROM user_search_history 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).bind(user.id, limit, offset).all();
    const history = result.results.map((item) => ({
      id: item.id,
      keyword: item.query,
      query: item.query,
      source: item.source,
      timestamp: item.created_at,
      createdAt: new Date(item.created_at).toISOString()
    }));
    const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();
    return utils.successResponse({
      history,
      searchHistory: history,
      total: countResult.total,
      limit,
      offset,
      hasMore: offset + limit < countResult.total
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u5386\u53F2\u5931\u8D25", 500);
  }
}
__name(userGetSearchHistoryHandler, "userGetSearchHistoryHandler");
async function userDeleteSearchHistoryHandler(request, env) {
  console.log("\u{1F527} \u5220\u9664\u5355\u6761\u5386\u53F2\u8DEF\u7531\u88AB\u8C03\u7528");
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const historyId = request.params?.id;
    console.log("\u{1F527} \u83B7\u53D6\u5230\u7684\u5386\u53F2ID:", historyId);
    if (!historyId || historyId.length < 10) {
      return utils.errorResponse("\u5386\u53F2\u8BB0\u5F55ID\u683C\u5F0F\u65E0\u6548", 400);
    }
    const result = await env.DB.prepare(`
            DELETE FROM user_search_history 
            WHERE id = ? AND user_id = ?
        `).bind(historyId, user.id).run();
    console.log("\u{1F527} \u5220\u9664\u7ED3\u679C:", result);
    if (result.changes === 0) {
      return utils.errorResponse("\u5386\u53F2\u8BB0\u5F55\u4E0D\u5B58\u5728\u6216\u65E0\u6743\u5220\u9664", 404);
    }
    await utils.logUserAction(env, user.id, "history_delete", {
      historyId,
      deletedCount: 1
    }, request);
    return utils.successResponse({
      message: "\u5220\u9664\u6210\u529F",
      deletedId: historyId
    });
  } catch (error) {
    console.error("\u5220\u9664\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u641C\u7D22\u5386\u53F2\u5931\u8D25", 500);
  }
}
__name(userDeleteSearchHistoryHandler, "userDeleteSearchHistoryHandler");
async function userClearSearchHistoryHandler(request, env) {
  console.log("\u{1F527} \u6E05\u7A7A\u5386\u53F2\u8DEF\u7531\u88AB\u8C03\u7528");
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const operation = url.searchParams.get("operation");
    if (operation !== "clear") {
      return utils.errorResponse("\u8BF7\u6307\u5B9Aoperation=clear\u53C2\u6570\u4EE5\u786E\u8BA4\u6E05\u7A7A\u64CD\u4F5C", 400);
    }
    const countResult = await env.DB.prepare(`
            SELECT COUNT(*) as count FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();
    const deletedCount = countResult.count || 0;
    await env.DB.prepare(`
            DELETE FROM user_search_history WHERE user_id = ?
        `).bind(user.id).run();
    await utils.logUserAction(env, user.id, "history_clear", {
      deletedCount
    }, request);
    return utils.successResponse({
      message: "\u641C\u7D22\u5386\u53F2\u5DF2\u6E05\u7A7A",
      deletedCount
    });
  } catch (error) {
    console.error("\u6E05\u7A7A\u641C\u7D22\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u6E05\u7A7A\u641C\u7D22\u5386\u53F2\u5931\u8D25", 500);
  }
}
__name(userClearSearchHistoryHandler, "userClearSearchHistoryHandler");
async function userGetSearchStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const totalResult = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM user_search_history WHERE user_id = ?
        `).bind(user.id).first();
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    const todayResult = await env.DB.prepare(`
            SELECT COUNT(*) as today FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, todayTimestamp).first();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1e3;
    const weekResult = await env.DB.prepare(`
            SELECT COUNT(*) as week FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
        `).bind(user.id, weekAgo).first();
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1e3;
    const topQueriesResult = await env.DB.prepare(`
            SELECT query, COUNT(*) as count 
            FROM user_search_history 
            WHERE user_id = ? AND created_at >= ?
            GROUP BY query 
            ORDER BY count DESC 
            LIMIT 10
        `).bind(user.id, monthAgo).all();
    const topQueries = topQueriesResult.results.map((item) => ({
      query: item.query,
      count: item.count
    }));
    return utils.successResponse({
      total: totalResult.total,
      today: todayResult.today,
      thisWeek: weekResult.week,
      topQueries
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u7EDF\u8BA1\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u7EDF\u8BA1\u5931\u8D25", 500);
  }
}
__name(userGetSearchStatsHandler, "userGetSearchStatsHandler");

// src/constants.js
var CONFIG = {
  // 系统级别的最大限制（安全相关，不可修改）
  MAX_TAGS_PER_USER: 50,
  MAX_SHARES_PER_USER: 50,
  MAX_FAVORITES_PER_USER: 1e3,
  MAX_HISTORY_PER_USER: 1e3,
  // 详情提取系统级别配置（技术限制，不可修改）
  DETAIL_EXTRACTION: {
    // 系统技术限制
    MAX_BATCH_SIZE: 20,
    MIN_BATCH_SIZE: 1,
    MAX_TIMEOUT: 3e4,
    MIN_TIMEOUT: 5e3,
    MAX_CACHE_DURATION: 6048e5,
    // 7天
    MIN_CACHE_DURATION: 36e5,
    // 1小时
    MAX_CONCURRENT_EXTRACTIONS: 4,
    // 性能和安全限制
    PARSE_TIMEOUT: 1e4,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1e3,
    // 缓存系统限制
    CACHE_MAX_SIZE: 1e3,
    CACHE_CLEANUP_INTERVAL: 36e5,
    // 1小时
    HTML_PARSER_CACHE_SIZE: 100,
    // 内容数量限制（防止过载）
    MAX_GENERIC_LINKS_PER_PAGE: 150,
    MAX_DOWNLOAD_LINKS: 15,
    MAX_MAGNET_LINKS: 15,
    MAX_SCREENSHOTS: 20
  },
  // 系统行为枚举（不可变）
  ALLOWED_ACTIONS: [
    "search",
    "login",
    "logout",
    "register",
    "visit_site",
    "copy_url",
    "favorite_add",
    "favorite_remove",
    "settings_update",
    "export_data",
    "sync_data",
    "page_view",
    "session_start",
    "session_end",
    "custom_source_add",
    "custom_source_edit",
    "custom_source_delete",
    "tag_created",
    "tag_updated",
    "tag_deleted",
    "detail_extraction",
    "batch_detail_extraction",
    "detail_cache_access",
    "detail_config_update",
    "detail_cache_clear",
    "detail_retry",
    "download_click",
    "magnet_click",
    "copy_magnet",
    "image_preview",
    // 新增：搜索源管理相关行为
    "major_category_create",
    "major_category_update",
    "major_category_delete",
    "source_category_create",
    "source_category_update",
    "source_category_delete",
    "search_source_create",
    "search_source_update",
    "search_source_delete",
    "user_source_config_update",
    "search_sources_export"
  ]
};
var SYSTEM_VALIDATION = {
  extractionTimeout: {
    min: CONFIG.DETAIL_EXTRACTION.MIN_TIMEOUT,
    max: CONFIG.DETAIL_EXTRACTION.MAX_TIMEOUT
  },
  cacheDuration: {
    min: CONFIG.DETAIL_EXTRACTION.MIN_CACHE_DURATION,
    max: CONFIG.DETAIL_EXTRACTION.MAX_CACHE_DURATION
  },
  extractionBatchSize: {
    min: CONFIG.DETAIL_EXTRACTION.MIN_BATCH_SIZE,
    max: CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE
  },
  maxDownloadLinks: {
    min: 1,
    max: CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS
  },
  maxMagnetLinks: {
    min: 1,
    max: CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS
  },
  maxScreenshots: {
    min: 1,
    max: CONFIG.DETAIL_EXTRACTION.MAX_SCREENSHOTS
  }
};
var DETAIL_URL_PATTERNS = {
  javbus: [/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i],
  javdb: [/\/v\/[a-zA-Z0-9]+/],
  jable: [/\/videos\/[^\/\?]+/],
  javmost: [/\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i],
  javgg: [/\/jav\/[a-z0-9\-]+/i],
  sukebei: [/\/view\/\d+/],
  javguru: [/\/\d+\/[a-z0-9\-]+/i]
};
var SEARCH_EXCLUDE_PATTERNS = [
  "/search/",
  "/search?",
  "?q=",
  "?s=",
  "?query=",
  "?keyword=",
  "/page/",
  "/list/",
  "/category/",
  "/genre/",
  "/actresses/",
  "/studio/",
  "/label/",
  "/uncensored/",
  "/forum/",
  "/doc/",
  "/terms",
  "/privacy",
  "/login",
  "/register",
  "/user/",
  "/profile/",
  "/settings/",
  "/en/",
  "/ja/",
  "/ko/",
  "/#",
  ".css",
  ".js",
  ".png",
  ".jpg",
  ".gif",
  ".ico",
  "javascript:",
  "/rss",
  "/sitemap",
  "/api/",
  "/ajax/",
  "/admin/"
];
var SPAM_DOMAINS = [
  "seedmm.cyou",
  "busfan.cyou",
  "dmmsee.ink",
  "ph7zhi.vip",
  "8pla6t.vip",
  "ltrpvkga.com",
  "frozaflurkiveltra.com",
  "shvaszc.cc",
  "fpnylxm.cc",
  "mvqttfwf.com",
  "jempoprostoklimor.com",
  "128zha.cc",
  "aciyopg.cc",
  "mnaspm.com",
  "asacp.org",
  "pr0rze.vip",
  "go.mnaspm.com"
];
var NAVIGATION_TEXTS = [
  "english",
  "\u4E2D\u6587",
  "\u65E5\u672C\u8A9E",
  "\uD55C\uAD6D\uC5B4",
  "\u6709\u78BC",
  "\u7121\u78BC",
  "\u5973\u512A",
  "\u985E\u5225",
  "\u8AD6\u58C7",
  "\u4E0B\u4E00\u9875",
  "\u4E0A\u4E00\u9875",
  "\u9996\u9875",
  "terms",
  "privacy",
  "\u767B\u5165",
  "\u9AD8\u6E05",
  "\u5B57\u5E55",
  "\u6B27\u7F8E",
  "rta",
  "2257",
  "next",
  "prev",
  "page",
  "home",
  "forum",
  "contact",
  "about",
  "help",
  "faq",
  "support",
  "\u5E2E\u52A9",
  "\u8054\u7CFB",
  "\u5173\u4E8E",
  "login",
  "register",
  "\u6CE8\u518C",
  "\u767B\u5F55",
  "agent_code"
];
var CODE_PATTERNS = {
  standard: /([A-Z]{2,6}-\d{3,6})/i,
  noDash: /([A-Z]{2,6}\d{3,6})/i,
  reverse: /(\d{3,6}[A-Z]{2,6})/i,
  combined: /([A-Z]{2,6}-?\d{3,6})/i
};
var SOURCE_SPECIFIC_CONFIG = {
  javbus: {
    baseUrls: ["https://www.javbus.com", "https://javbus.com"],
    searchPath: "/search/",
    detailPattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
    requiresCode: true,
    supportSubdomains: true
  },
  javdb: {
    baseUrls: ["https://javdb.com"],
    searchPath: "/search",
    detailPattern: /\/v\/[a-zA-Z0-9]+/,
    requiresCode: false,
    supportSubdomains: false
  },
  jable: {
    baseUrls: ["https://jable.tv"],
    searchPath: "/search/",
    detailPattern: /\/videos\/[^\/\?]+/,
    requiresCode: false,
    supportSubdomains: false,
    strictDomain: true
  },
  javmost: {
    baseUrls: ["https://javmost.com", "https://www5.javmost.com"],
    searchPath: "/search/",
    detailPattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
    requiresCode: true,
    supportSubdomains: true
  },
  javgg: {
    baseUrls: ["https://javgg.net"],
    searchPath: "/search/",
    detailPattern: /\/jav\/[a-z0-9\-]+/i,
    requiresCode: true,
    supportSubdomains: true
  },
  sukebei: {
    baseUrls: ["https://sukebei.nyaa.si"],
    searchPath: "/",
    detailPattern: /\/view\/\d+/,
    requiresCode: false,
    supportSubdomains: false
  },
  javguru: {
    baseUrls: ["https://jav.guru"],
    searchPath: "/",
    detailPattern: /\/\d+\/[a-z0-9\-]+/i,
    requiresCode: false,
    supportSubdomains: true
  }
};

// src/services/search-sources-service.js
var SearchSourcesService = class {
  static {
    __name(this, "SearchSourcesService");
  }
  // ===================== 搜索源大类管理 =====================
  // 获取所有大类
  async getAllMajorCategories(env) {
    try {
      const result = await env.DB.prepare(`
                SELECT * FROM search_major_categories 
                WHERE is_active = 1 
                ORDER BY display_order ASC, created_at ASC
            `).all();
      return {
        majorCategories: (result.results || []).map((cat) => this.formatMajorCategory(cat))
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25:", error);
      throw new Error("\u83B7\u53D6\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25");
    }
  }
  // 创建大类
  async createMajorCategory(env, majorCategoryData, creatorId) {
    try {
      const existing = await env.DB.prepare(`
                SELECT id FROM search_major_categories 
                WHERE name = ? AND is_active = 1
            `).bind(majorCategoryData.name).first();
      if (existing) {
        throw new Error("\u5927\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
      }
      const majorCategoryId = utils.generateId();
      const now = Date.now();
      await env.DB.prepare(`
                INSERT INTO search_major_categories (
                    id, name, description, icon, color, requires_keyword,
                    display_order, is_system, is_active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
        majorCategoryId,
        majorCategoryData.name,
        majorCategoryData.description || "",
        majorCategoryData.icon || "\u{1F31F}",
        majorCategoryData.color || "#6b7280",
        majorCategoryData.requiresKeyword ? 1 : 0,
        999,
        // 新创建的排在最后
        0,
        // 用户创建的非系统大类
        1,
        // 激活状态
        now,
        now
      ).run();
      return this.formatMajorCategory({
        id: majorCategoryId,
        name: majorCategoryData.name,
        description: majorCategoryData.description || "",
        icon: majorCategoryData.icon || "\u{1F31F}",
        color: majorCategoryData.color || "#6b7280",
        requires_keyword: majorCategoryData.requiresKeyword ? 1 : 0,
        display_order: 999,
        is_system: 0,
        is_active: 1,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25:", error);
      throw error;
    }
  }
  // ===================== 搜索源分类管理 =====================
  // 获取用户的搜索源分类
  async getUserSourceCategories(env, userId, options = {}) {
    try {
      const { majorCategoryId, includeSystem = true } = options;
      let query = `
                SELECT sc.*, mc.name as major_category_name, mc.icon as major_category_icon
                FROM search_source_categories sc
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE sc.is_active = 1
            `;
      const params = [];
      if (majorCategoryId) {
        query += ` AND sc.major_category_id = ?`;
        params.push(majorCategoryId);
      }
      if (!includeSystem) {
        query += ` AND (sc.is_system = 0 OR sc.created_by = ?)`;
        params.push(userId);
      }
      query += ` ORDER BY sc.display_order ASC, sc.created_at ASC`;
      const result = await env.DB.prepare(query).bind(...params).all();
      return {
        categories: (result.results || []).map((cat) => this.formatSourceCategory(cat))
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
      throw new Error("\u83B7\u53D6\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25");
    }
  }
  // 创建搜索源分类
  async createSourceCategory(env, categoryData, creatorId) {
    try {
      const majorCategory = await env.DB.prepare(`
                SELECT id FROM search_major_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryData.majorCategoryId).first();
      if (!majorCategory) {
        throw new Error("\u6307\u5B9A\u7684\u5927\u7C7B\u4E0D\u5B58\u5728");
      }
      const existing = await env.DB.prepare(`
                SELECT id FROM search_source_categories 
                WHERE major_category_id = ? AND name = ? AND is_active = 1
            `).bind(categoryData.majorCategoryId, categoryData.name).first();
      if (existing) {
        throw new Error("\u5728\u8BE5\u5927\u7C7B\u4E0B\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
      }
      const categoryId = utils.generateId();
      const now = Date.now();
      await env.DB.prepare(`
                INSERT INTO search_source_categories (
                    id, major_category_id, name, description, icon, color,
                    display_order, is_system, is_active, default_searchable,
                    default_site_type, search_priority, supports_detail_extraction,
                    extraction_priority, created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
        categoryId,
        categoryData.majorCategoryId,
        categoryData.name,
        categoryData.description || "",
        categoryData.icon || "\u{1F4C1}",
        categoryData.color || "#3b82f6",
        999,
        // 新创建的排在最后
        0,
        // 用户创建的非系统分类
        1,
        // 激活状态
        categoryData.defaultSearchable ? 1 : 0,
        categoryData.defaultSiteType || "search",
        categoryData.searchPriority || 5,
        categoryData.supportsDetailExtraction ? 1 : 0,
        categoryData.extractionPriority || "medium",
        creatorId,
        now,
        now
      ).run();
      return this.formatSourceCategory({
        id: categoryId,
        major_category_id: categoryData.majorCategoryId,
        name: categoryData.name,
        description: categoryData.description || "",
        icon: categoryData.icon || "\u{1F4C1}",
        color: categoryData.color || "#3b82f6",
        display_order: 999,
        is_system: 0,
        is_active: 1,
        default_searchable: categoryData.defaultSearchable ? 1 : 0,
        default_site_type: categoryData.defaultSiteType || "search",
        search_priority: categoryData.searchPriority || 5,
        supports_detail_extraction: categoryData.supportsDetailExtraction ? 1 : 0,
        extraction_priority: categoryData.extractionPriority || "medium",
        created_by: creatorId,
        created_at: now,
        updated_at: now
      });
    } catch (error) {
      console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
      throw error;
    }
  }
  // 更新搜索源分类
  async updateSourceCategory(env, categoryId, updateData, userId) {
    try {
      const category = await env.DB.prepare(`
                SELECT * FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryId).first();
      if (!category) {
        throw new Error("\u641C\u7D22\u6E90\u5206\u7C7B\u4E0D\u5B58\u5728");
      }
      if (category.is_system && category.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u4FEE\u6539\u7CFB\u7EDF\u5206\u7C7B");
      }
      if (!category.is_system && category.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u4FEE\u6539\u6B64\u5206\u7C7B");
      }
      if (updateData.name && updateData.name !== category.name) {
        const existing = await env.DB.prepare(`
                    SELECT id FROM search_source_categories 
                    WHERE major_category_id = ? AND name = ? AND id != ? AND is_active = 1
                `).bind(category.major_category_id, updateData.name, categoryId).first();
        if (existing) {
          throw new Error("\u5206\u7C7B\u540D\u79F0\u5DF2\u5B58\u5728");
        }
      }
      const updateFields = [];
      const updateValues = [];
      Object.keys(updateData).forEach((field) => {
        const dbField = this.convertCategoryFieldToDb(field);
        if (dbField) {
          updateFields.push(`${dbField} = ?`);
          updateValues.push(updateData[field]);
        }
      });
      updateFields.push("updated_at = ?");
      updateValues.push(Date.now());
      updateValues.push(categoryId);
      await env.DB.prepare(`
                UPDATE search_source_categories 
                SET ${updateFields.join(", ")}
                WHERE id = ?
            `).bind(...updateValues).run();
      const updatedCategory = await env.DB.prepare(`
                SELECT sc.*, mc.name as major_category_name, mc.icon as major_category_icon
                FROM search_source_categories sc
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE sc.id = ?
            `).bind(categoryId).first();
      return {
        category: this.formatSourceCategory(updatedCategory)
      };
    } catch (error) {
      console.error("\u66F4\u65B0\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
      throw error;
    }
  }
  // 删除搜索源分类
  async deleteSourceCategory(env, categoryId, userId) {
    try {
      const category = await env.DB.prepare(`
                SELECT * FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(categoryId).first();
      if (!category) {
        throw new Error("\u641C\u7D22\u6E90\u5206\u7C7B\u4E0D\u5B58\u5728");
      }
      if (category.is_system) {
        throw new Error("\u7CFB\u7EDF\u5206\u7C7B\u4E0D\u80FD\u5220\u9664");
      }
      if (category.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u5220\u9664\u6B64\u5206\u7C7B");
      }
      const sourcesUsingCategory = await env.DB.prepare(`
                SELECT COUNT(*) as count FROM search_sources 
                WHERE category_id = ? AND is_active = 1
            `).bind(categoryId).first();
      if (sourcesUsingCategory.count > 0) {
        throw new Error(`\u65E0\u6CD5\u5220\u9664\u5206\u7C7B\uFF0C\u8FD8\u6709 ${sourcesUsingCategory.count} \u4E2A\u641C\u7D22\u6E90\u6B63\u5728\u4F7F\u7528\u6B64\u5206\u7C7B`);
      }
      await env.DB.prepare(`
                UPDATE search_source_categories 
                SET is_active = 0, updated_at = ?
                WHERE id = ?
            `).bind(Date.now(), categoryId).run();
      return {
        message: "\u641C\u7D22\u6E90\u5206\u7C7B\u5220\u9664\u6210\u529F",
        deletedCategory: {
          id: category.id,
          name: category.name
        }
      };
    } catch (error) {
      console.error("\u5220\u9664\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
      throw error;
    }
  }
  // ===================== 搜索源管理 =====================
  // 获取用户的搜索源
  async getUserSearchSources(env, userId, filters = {}) {
    try {
      const { categoryId, majorCategoryId, searchable, includeSystem = true, enabledOnly = false } = filters;
      let query = `
                SELECT 
                    ss.*,
                    sc.name as category_name,
                    sc.icon as category_icon,
                    sc.major_category_id,
                    mc.name as major_category_name,
                    mc.icon as major_category_icon,
                    usc.is_enabled as user_enabled,
                    usc.custom_priority,
                    usc.custom_name,
                    usc.custom_subtitle,
                    usc.custom_icon,
                    usc.notes as user_notes
                FROM search_sources ss
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                LEFT JOIN user_search_source_configs usc ON ss.id = usc.source_id AND usc.user_id = ?
                WHERE ss.is_active = 1
            `;
      const params = [userId];
      if (categoryId) {
        query += ` AND ss.category_id = ?`;
        params.push(categoryId);
      }
      if (majorCategoryId) {
        query += ` AND sc.major_category_id = ?`;
        params.push(majorCategoryId);
      }
      if (searchable !== null && searchable !== void 0) {
        query += ` AND ss.searchable = ?`;
        params.push(searchable ? 1 : 0);
      }
      if (!includeSystem) {
        query += ` AND (ss.is_system = 0 OR ss.created_by = ?)`;
        params.push(userId);
      }
      if (enabledOnly) {
        query += ` AND (usc.is_enabled = 1 OR (usc.is_enabled IS NULL AND ss.is_system = 1 AND ss.searchable = 1))`;
      }
      query += ` ORDER BY 
                COALESCE(usc.custom_priority, ss.search_priority) ASC, 
                ss.display_order ASC, 
                ss.created_at ASC`;
      const result = await env.DB.prepare(query).bind(...params).all();
      return {
        sources: (result.results || []).map((source) => this.formatSearchSource(source))
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5931\u8D25:", error);
      throw new Error("\u83B7\u53D6\u641C\u7D22\u6E90\u5931\u8D25");
    }
  }
  // 创建搜索源
  async createSearchSource(env, sourceData, creatorId) {
    try {
      const category = await env.DB.prepare(`
                SELECT id FROM search_source_categories 
                WHERE id = ? AND is_active = 1
            `).bind(sourceData.categoryId).first();
      if (!category) {
        throw new Error("\u6307\u5B9A\u7684\u5206\u7C7B\u4E0D\u5B58\u5728");
      }
      if (sourceData.searchable && !sourceData.urlTemplate.includes("{keyword}")) {
        throw new Error("\u641C\u7D22\u6E90\u7684URL\u6A21\u677F\u5FC5\u987B\u5305\u542B{keyword}\u5360\u4F4D\u7B26");
      }
      const existing = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE name = ? AND is_active = 1
            `).bind(sourceData.name).first();
      if (existing) {
        throw new Error("\u641C\u7D22\u6E90\u540D\u79F0\u5DF2\u5B58\u5728");
      }
      const sourceId = utils.generateId();
      const now = Date.now();
      await env.DB.prepare(`
                INSERT INTO search_sources (
                    id, category_id, name, subtitle, description, icon, url_template,
                    homepage_url, site_type, searchable, requires_keyword, search_priority,
                    supports_detail_extraction, extraction_quality, average_extraction_time,
                    supported_features, is_system, is_active, display_order, usage_count,
                    created_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
        sourceId,
        sourceData.categoryId,
        sourceData.name,
        sourceData.subtitle || "",
        sourceData.description || "",
        sourceData.icon || "\u{1F50D}",
        sourceData.urlTemplate,
        sourceData.homepageUrl || "",
        sourceData.siteType || "search",
        sourceData.searchable ? 1 : 0,
        sourceData.requiresKeyword ? 1 : 0,
        sourceData.searchPriority || 5,
        sourceData.supportsDetailExtraction ? 1 : 0,
        sourceData.extractionQuality || "none",
        0,
        // 初始提取时间
        JSON.stringify(sourceData.supportedFeatures || []),
        0,
        // 用户创建的非系统源
        1,
        // 激活状态
        999,
        // 新创建的排在最后
        0,
        // 初始使用次数
        creatorId,
        now,
        now
      ).run();
      await this.createUserSourceConfig(env, creatorId, sourceId, { isEnabled: true });
      return this.formatSearchSource({
        id: sourceId,
        category_id: sourceData.categoryId,
        name: sourceData.name,
        subtitle: sourceData.subtitle || "",
        description: sourceData.description || "",
        icon: sourceData.icon || "\u{1F50D}",
        url_template: sourceData.urlTemplate,
        homepage_url: sourceData.homepageUrl || "",
        site_type: sourceData.siteType || "search",
        searchable: sourceData.searchable ? 1 : 0,
        requires_keyword: sourceData.requiresKeyword ? 1 : 0,
        search_priority: sourceData.searchPriority || 5,
        supports_detail_extraction: sourceData.supportsDetailExtraction ? 1 : 0,
        extraction_quality: sourceData.extractionQuality || "none",
        average_extraction_time: 0,
        supported_features: JSON.stringify(sourceData.supportedFeatures || []),
        is_system: 0,
        is_active: 1,
        display_order: 999,
        usage_count: 0,
        created_by: creatorId,
        created_at: now,
        updated_at: now,
        user_enabled: 1
        // 默认启用
      });
    } catch (error) {
      console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5931\u8D25:", error);
      throw error;
    }
  }
  // 更新搜索源
  async updateSearchSource(env, sourceId, updateData, userId) {
    try {
      const source = await env.DB.prepare(`
                SELECT * FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(sourceId).first();
      if (!source) {
        throw new Error("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728");
      }
      if (source.is_system && source.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u4FEE\u6539\u7CFB\u7EDF\u641C\u7D22\u6E90");
      }
      if (!source.is_system && source.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u4FEE\u6539\u6B64\u641C\u7D22\u6E90");
      }
      if (updateData.urlTemplate && updateData.searchable && !updateData.urlTemplate.includes("{keyword}")) {
        throw new Error("\u641C\u7D22\u6E90\u7684URL\u6A21\u677F\u5FC5\u987B\u5305\u542B{keyword}\u5360\u4F4D\u7B26");
      }
      if (updateData.name && updateData.name !== source.name) {
        const existing = await env.DB.prepare(`
                    SELECT id FROM search_sources 
                    WHERE name = ? AND id != ? AND is_active = 1
                `).bind(updateData.name, sourceId).first();
        if (existing) {
          throw new Error("\u641C\u7D22\u6E90\u540D\u79F0\u5DF2\u5B58\u5728");
        }
      }
      const updateFields = [];
      const updateValues = [];
      Object.keys(updateData).forEach((field) => {
        const dbField = this.convertSourceFieldToDb(field);
        if (dbField) {
          let value = updateData[field];
          if (field === "supportedFeatures") {
            value = JSON.stringify(value);
          } else if (typeof value === "boolean") {
            value = value ? 1 : 0;
          }
          updateFields.push(`${dbField} = ?`);
          updateValues.push(value);
        }
      });
      updateFields.push("updated_at = ?");
      updateValues.push(Date.now());
      updateValues.push(sourceId);
      await env.DB.prepare(`
                UPDATE search_sources 
                SET ${updateFields.join(", ")}
                WHERE id = ?
            `).bind(...updateValues).run();
      const updatedSource = await env.DB.prepare(`
                SELECT 
                    ss.*,
                    sc.name as category_name,
                    sc.icon as category_icon,
                    sc.major_category_id,
                    mc.name as major_category_name,
                    mc.icon as major_category_icon
                FROM search_sources ss
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE ss.id = ?
            `).bind(sourceId).first();
      return {
        source: this.formatSearchSource(updatedSource)
      };
    } catch (error) {
      console.error("\u66F4\u65B0\u641C\u7D22\u6E90\u5931\u8D25:", error);
      throw error;
    }
  }
  // 删除搜索源
  async deleteSearchSource(env, sourceId, userId) {
    try {
      const source = await env.DB.prepare(`
                SELECT * FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(sourceId).first();
      if (!source) {
        throw new Error("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728");
      }
      if (source.is_system) {
        throw new Error("\u7CFB\u7EDF\u641C\u7D22\u6E90\u4E0D\u80FD\u5220\u9664");
      }
      if (source.created_by !== userId) {
        throw new Error("\u65E0\u6743\u9650\u5220\u9664\u6B64\u641C\u7D22\u6E90");
      }
      await env.DB.prepare(`
                UPDATE search_sources 
                SET is_active = 0, updated_at = ?
                WHERE id = ?
            `).bind(Date.now(), sourceId).run();
      await env.DB.prepare(`
                DELETE FROM user_search_source_configs 
                WHERE source_id = ?
            `).bind(sourceId).run();
      return {
        message: "\u641C\u7D22\u6E90\u5220\u9664\u6210\u529F",
        deletedSource: {
          id: source.id,
          name: source.name
        }
      };
    } catch (error) {
      console.error("\u5220\u9664\u641C\u7D22\u6E90\u5931\u8D25:", error);
      throw error;
    }
  }
  // ===================== 用户搜索源配置管理 =====================
  // 获取用户搜索源配置
  async getUserSourceConfigs(env, userId) {
    try {
      const result = await env.DB.prepare(`
                SELECT 
                    usc.*,
                    ss.name as source_name,
                    ss.icon as source_icon,
                    ss.is_system,
                    sc.name as category_name,
                    mc.name as major_category_name
                FROM user_search_source_configs usc
                LEFT JOIN search_sources ss ON usc.source_id = ss.id
                LEFT JOIN search_source_categories sc ON ss.category_id = sc.id
                LEFT JOIN search_major_categories mc ON sc.major_category_id = mc.id
                WHERE usc.user_id = ? AND ss.is_active = 1
                ORDER BY usc.custom_priority ASC, ss.search_priority ASC, ss.display_order ASC
            `).bind(userId).all();
      return {
        configs: (result.results || []).map((config) => this.formatUserSourceConfig(config))
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
      throw new Error("\u83B7\u53D6\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25");
    }
  }
  // 创建或更新用户搜索源配置
  async updateUserSourceConfig(env, userId, configData) {
    try {
      const source = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE id = ? AND is_active = 1
            `).bind(configData.sourceId).first();
      if (!source) {
        throw new Error("\u641C\u7D22\u6E90\u4E0D\u5B58\u5728");
      }
      const configId = utils.generateId();
      const now = Date.now();
      await env.DB.prepare(`
                INSERT OR REPLACE INTO user_search_source_configs (
                    id, user_id, source_id, is_enabled, custom_priority,
                    custom_name, custom_subtitle, custom_icon, notes,
                    created_at, updated_at
                ) VALUES (
                    COALESCE((SELECT id FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?
                )
            `).bind(
        userId,
        configData.sourceId,
        configId,
        // for COALESCE id
        userId,
        configData.sourceId,
        configData.isEnabled ? 1 : 0,
        configData.customPriority,
        configData.customName,
        configData.customSubtitle,
        configData.customIcon,
        configData.notes,
        userId,
        configData.sourceId,
        now,
        // for COALESCE created_at
        now
        // updated_at
      ).run();
      return {
        message: "\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u66F4\u65B0\u6210\u529F",
        config: {
          userId,
          sourceId: configData.sourceId,
          isEnabled: configData.isEnabled,
          customPriority: configData.customPriority,
          customName: configData.customName,
          customSubtitle: configData.customSubtitle,
          customIcon: configData.customIcon,
          notes: configData.notes
        }
      };
    } catch (error) {
      console.error("\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
      throw error;
    }
  }
  // 创建用户搜索源配置（内部方法）
  async createUserSourceConfig(env, userId, sourceId, configData) {
    const configId = utils.generateId();
    const now = Date.now();
    await env.DB.prepare(`
            INSERT OR IGNORE INTO user_search_source_configs (
                id, user_id, source_id, is_enabled, custom_priority,
                custom_name, custom_subtitle, custom_icon, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
      configId,
      userId,
      sourceId,
      configData.isEnabled ? 1 : 0,
      configData.customPriority || null,
      configData.customName || null,
      configData.customSubtitle || null,
      configData.customIcon || null,
      configData.notes || null,
      now,
      now
    ).run();
  }
  // 批量更新用户搜索源配置
  async batchUpdateUserSourceConfigs(env, userId, configs) {
    try {
      const sourceIds = configs.map((c) => c.sourceId);
      const validSources = await env.DB.prepare(`
                SELECT id FROM search_sources 
                WHERE id IN (${sourceIds.map(() => "?").join(",")}) AND is_active = 1
            `).bind(...sourceIds).all();
      if (validSources.results.length !== sourceIds.length) {
        throw new Error("\u90E8\u5206\u641C\u7D22\u6E90\u4E0D\u5B58\u5728");
      }
      const stmt = env.DB.prepare(`
                INSERT OR REPLACE INTO user_search_source_configs (
                    id, user_id, source_id, is_enabled, custom_priority,
                    custom_name, custom_subtitle, custom_icon, notes,
                    created_at, updated_at
                ) VALUES (
                    COALESCE((SELECT id FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, ?,
                    COALESCE((SELECT created_at FROM user_search_source_configs WHERE user_id = ? AND source_id = ?), ?),
                    ?
                )
            `);
      const now = Date.now();
      const promises = configs.map((config) => {
        const configId = utils.generateId();
        return stmt.bind(
          userId,
          config.sourceId,
          configId,
          // for COALESCE id
          userId,
          config.sourceId,
          config.isEnabled ? 1 : 0,
          config.customPriority || null,
          config.customName || null,
          config.customSubtitle || null,
          config.customIcon || null,
          config.notes || null,
          userId,
          config.sourceId,
          now,
          // for COALESCE created_at
          now
          // updated_at
        ).run();
      });
      await Promise.all(promises);
      return {
        message: "\u6279\u91CF\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u6210\u529F",
        updatedCount: configs.length
      };
    } catch (error) {
      console.error("\u6279\u91CF\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
      throw error;
    }
  }
  // ===================== 统计和导出功能 =====================
  // 获取搜索源统计信息
  async getSearchSourceStats(env, userId) {
    try {
      const [majorCategoriesCount, categoriesCount, sourcesCount, userConfigsCount] = await Promise.all([
        env.DB.prepare(`SELECT COUNT(*) as count FROM search_major_categories WHERE is_active = 1`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM search_source_categories WHERE is_active = 1`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM search_sources WHERE is_active = 1`).first(),
        env.DB.prepare(`SELECT COUNT(*) as count FROM user_search_source_configs WHERE user_id = ? AND is_enabled = 1`).bind(userId).first()
      ]);
      const majorCategoryStats = await env.DB.prepare(`
                SELECT 
                    mc.id,
                    mc.name,
                    mc.icon,
                    COUNT(DISTINCT sc.id) as categories_count,
                    COUNT(DISTINCT ss.id) as sources_count,
                    COUNT(DISTINCT CASE WHEN usc.is_enabled = 1 THEN usc.id END) as enabled_sources_count
                FROM search_major_categories mc
                LEFT JOIN search_source_categories sc ON mc.id = sc.major_category_id AND sc.is_active = 1
                LEFT JOIN search_sources ss ON sc.id = ss.category_id AND ss.is_active = 1
                LEFT JOIN user_search_source_configs usc ON ss.id = usc.source_id AND usc.user_id = ?
                WHERE mc.is_active = 1
                GROUP BY mc.id
                ORDER BY mc.display_order ASC
            `).bind(userId).all();
      return {
        overview: {
          majorCategories: majorCategoriesCount.count,
          categories: categoriesCount.count,
          totalSources: sourcesCount.count,
          enabledSources: userConfigsCount.count
        },
        majorCategoryStats: majorCategoryStats.results || []
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25:", error);
      throw new Error("\u83B7\u53D6\u641C\u7D22\u6E90\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25");
    }
  }
  // 导出用户搜索源配置
  async exportUserSearchSources(env, userId) {
    try {
      const sources = await this.getUserSearchSources(env, userId, { includeSystem: true });
      const configs = await this.getUserSourceConfigs(env, userId);
      const categories = await this.getUserSourceCategories(env, userId, { includeSystem: true });
      const majorCategories = await this.getAllMajorCategories(env);
      return {
        exportTime: (/* @__PURE__ */ new Date()).toISOString(),
        userId,
        majorCategories: majorCategories.majorCategories,
        categories: categories.categories,
        sources: sources.sources,
        userConfigs: configs.configs,
        version: "2.3.1"
      };
    } catch (error) {
      console.error("\u5BFC\u51FA\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
      throw new Error("\u5BFC\u51FA\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25");
    }
  }
  // ===================== 辅助方法 =====================
  // 格式化大类数据
  formatMajorCategory(data) {
    return {
      id: data.id,
      name: data.name,
      description: data.description || "",
      icon: data.icon || "\u{1F31F}",
      color: data.color || "#6b7280",
      requiresKeyword: Boolean(data.requires_keyword),
      displayOrder: data.display_order || 999,
      isSystem: Boolean(data.is_system),
      isActive: Boolean(data.is_active),
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
  // 格式化分类数据 - 🔴 确保返回所有必要字段
  formatSourceCategory(data) {
    return {
      id: data.id,
      majorCategoryId: data.major_category_id,
      majorCategoryName: data.major_category_name || "",
      majorCategoryIcon: data.major_category_icon || "\u{1F31F}",
      name: data.name,
      description: data.description || "",
      icon: data.icon || "\u{1F4C1}",
      color: data.color || "#3b82f6",
      displayOrder: data.display_order || 999,
      isSystem: Boolean(data.is_system),
      isActive: Boolean(data.is_active),
      // 🔴 确保搜索配置字段正确返回
      defaultSearchable: Boolean(data.default_searchable),
      defaultSiteType: data.default_site_type || "search",
      searchPriority: data.search_priority || 5,
      supportsDetailExtraction: Boolean(data.supports_detail_extraction),
      extractionPriority: data.extraction_priority || "medium",
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
  // 格式化搜索源数据
  formatSearchSource(data) {
    return {
      id: data.id,
      categoryId: data.category_id,
      categoryName: data.category_name || "",
      categoryIcon: data.category_icon || "\u{1F4C1}",
      majorCategoryId: data.major_category_id,
      majorCategoryName: data.major_category_name || "",
      majorCategoryIcon: data.major_category_icon || "\u{1F31F}",
      name: data.custom_name || data.name,
      originalName: data.name,
      subtitle: data.custom_subtitle || data.subtitle || "",
      originalSubtitle: data.subtitle || "",
      description: data.description || "",
      icon: data.custom_icon || data.icon || "\u{1F50D}",
      originalIcon: data.icon || "\u{1F50D}",
      urlTemplate: data.url_template,
      homepageUrl: data.homepage_url || "",
      siteType: data.site_type || "search",
      searchable: Boolean(data.searchable),
      requiresKeyword: Boolean(data.requires_keyword),
      searchPriority: data.custom_priority || data.search_priority || 5,
      originalPriority: data.search_priority || 5,
      supportsDetailExtraction: Boolean(data.supports_detail_extraction),
      extractionQuality: data.extraction_quality || "none",
      averageExtractionTime: data.average_extraction_time || 0,
      supportedFeatures: this.parseJsonSafely(data.supported_features, []),
      isSystem: Boolean(data.is_system),
      isActive: Boolean(data.is_active),
      displayOrder: data.display_order || 999,
      usageCount: data.usage_count || 0,
      lastUsedAt: data.last_used_at,
      // 用户配置
      userEnabled: data.user_enabled !== null ? Boolean(data.user_enabled) : data.is_system && data.searchable ? true : false,
      userNotes: data.user_notes || "",
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
  // 格式化用户配置数据
  formatUserSourceConfig(data) {
    return {
      id: data.id,
      userId: data.user_id,
      sourceId: data.source_id,
      sourceName: data.source_name,
      sourceIcon: data.source_icon,
      isSystem: Boolean(data.is_system),
      categoryName: data.category_name,
      majorCategoryName: data.major_category_name,
      isEnabled: Boolean(data.is_enabled),
      customPriority: data.custom_priority,
      customName: data.custom_name,
      customSubtitle: data.custom_subtitle,
      customIcon: data.custom_icon,
      notes: data.notes || "",
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
  // 字段转换 - 分类
  convertCategoryFieldToDb(field) {
    const fieldMap = {
      "name": "name",
      "description": "description",
      "icon": "icon",
      "color": "color",
      "defaultSearchable": "default_searchable",
      "defaultSiteType": "default_site_type",
      "searchPriority": "search_priority",
      "supportsDetailExtraction": "supports_detail_extraction",
      "extractionPriority": "extraction_priority"
    };
    return fieldMap[field];
  }
  // 字段转换 - 搜索源
  convertSourceFieldToDb(field) {
    const fieldMap = {
      "categoryId": "category_id",
      "name": "name",
      "subtitle": "subtitle",
      "description": "description",
      "icon": "icon",
      "urlTemplate": "url_template",
      "homepageUrl": "homepage_url",
      "siteType": "site_type",
      "searchable": "searchable",
      "requiresKeyword": "requires_keyword",
      "searchPriority": "search_priority",
      "supportsDetailExtraction": "supports_detail_extraction",
      "extractionQuality": "extraction_quality",
      "supportedFeatures": "supported_features"
    };
    return fieldMap[field];
  }
  // 安全解析JSON
  parseJsonSafely(jsonString, defaultValue = null) {
    try {
      return jsonString ? JSON.parse(jsonString) : defaultValue;
    } catch (error) {
      console.warn("JSON\u89E3\u6790\u5931\u8D25:", jsonString);
      return defaultValue;
    }
  }
};
var searchSourcesService = new SearchSourcesService();

// src/handlers/search-sources.js
async function getMajorCategoriesHandler(request, env) {
  try {
    const result = await searchSourcesService.getAllMajorCategories(env);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25", 500);
  }
}
__name(getMajorCategoriesHandler, "getMajorCategoriesHandler");
async function createMajorCategoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  if (!user.permissions.includes("admin") && !user.permissions.includes("search_source_management")) {
    return utils.errorResponse("\u6743\u9650\u4E0D\u8DB3", 403);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { name, description, icon, color, requiresKeyword } = body;
    const validation = validateMajorCategoryInput({ name, description, icon, color, requiresKeyword });
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const majorCategoryData = {
      name: name.trim(),
      description: description?.trim() || "",
      icon: icon?.trim() || "\u{1F31F}",
      color: color?.trim() || "#6b7280",
      requiresKeyword: requiresKeyword !== false
    };
    const result = await searchSourcesService.createMajorCategory(env, majorCategoryData, user.id);
    await utils.logUserAction(env, user.id, "major_category_create", {
      majorCategoryId: result.id,
      majorCategoryName: result.name
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u521B\u5EFA\u641C\u7D22\u6E90\u5927\u7C7B\u5931\u8D25: " + error.message, 500);
  }
}
__name(createMajorCategoryHandler, "createMajorCategoryHandler");
async function getSourceCategoriesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const majorCategoryId = url.searchParams.get("majorCategory");
    const includeSystem = url.searchParams.get("includeSystem") !== "false";
    const result = await searchSourcesService.getUserSourceCategories(
      env,
      user.id,
      { majorCategoryId, includeSystem }
    );
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25", 500);
  }
}
__name(getSourceCategoriesHandler, "getSourceCategoriesHandler");
async function createSourceCategoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const {
      majorCategoryId,
      name,
      description,
      icon,
      color,
      defaultSearchable,
      defaultSiteType,
      searchPriority,
      supportsDetailExtraction,
      extractionPriority
    } = body;
    const validation = validateCategoryInput(body);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const categoryData = {
      majorCategoryId: majorCategoryId.trim(),
      name: name.trim(),
      description: description?.trim() || "",
      icon: icon?.trim() || "\u{1F4C1}",
      color: color?.trim() || "#3b82f6",
      defaultSearchable: defaultSearchable !== false,
      defaultSiteType: defaultSiteType || "search",
      searchPriority: Math.min(Math.max(parseInt(searchPriority) || 5, 1), 10),
      supportsDetailExtraction: supportsDetailExtraction === true,
      extractionPriority: extractionPriority || "medium"
    };
    const result = await searchSourcesService.createSourceCategory(env, categoryData, user.id);
    await utils.logUserAction(env, user.id, "source_category_create", {
      categoryId: result.id,
      categoryName: result.name,
      majorCategoryId: result.majorCategoryId
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u521B\u5EFA\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25: " + error.message, 500);
  }
}
__name(createSourceCategoryHandler, "createSourceCategoryHandler");
async function updateSourceCategoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const categoryId = request.params?.id;
    if (!categoryId) {
      return utils.errorResponse("\u5206\u7C7BID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const body = await request.json().catch(() => ({}));
    const validation = validateCategoryUpdateInput(body);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const updateData = {};
    const allowedFields = [
      "name",
      "description",
      "icon",
      "color",
      "defaultSearchable",
      "defaultSiteType",
      "searchPriority",
      "supportsDetailExtraction",
      "extractionPriority"
    ];
    allowedFields.forEach((field) => {
      if (body.hasOwnProperty(field)) {
        if (field === "searchPriority") {
          updateData[field] = Math.min(Math.max(parseInt(body[field]) || 5, 1), 10);
        } else if (typeof body[field] === "string") {
          updateData[field] = body[field].trim();
        } else {
          updateData[field] = body[field];
        }
      }
    });
    if (Object.keys(updateData).length === 0) {
      return utils.errorResponse("\u6CA1\u6709\u63D0\u4F9B\u8981\u66F4\u65B0\u7684\u6570\u636E", 400);
    }
    const result = await searchSourcesService.updateSourceCategory(env, categoryId, updateData, user.id);
    await utils.logUserAction(env, user.id, "source_category_update", {
      categoryId,
      updatedFields: Object.keys(updateData)
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u66F4\u65B0\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u66F4\u65B0\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25: " + error.message, 500);
  }
}
__name(updateSourceCategoryHandler, "updateSourceCategoryHandler");
async function deleteSourceCategoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const categoryId = request.params?.id;
    if (!categoryId) {
      return utils.errorResponse("\u5206\u7C7BID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const result = await searchSourcesService.deleteSourceCategory(env, categoryId, user.id);
    await utils.logUserAction(env, user.id, "source_category_delete", {
      categoryId,
      categoryName: result.deletedCategory.name
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u5220\u9664\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u641C\u7D22\u6E90\u5206\u7C7B\u5931\u8D25: " + error.message, 500);
  }
}
__name(deleteSourceCategoryHandler, "deleteSourceCategoryHandler");
async function getSearchSourcesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const categoryId = url.searchParams.get("category");
    const majorCategoryId = url.searchParams.get("majorCategory");
    const searchable = url.searchParams.get("searchable");
    const includeSystem = url.searchParams.get("includeSystem") !== "false";
    const enabledOnly = url.searchParams.get("enabledOnly") === "true";
    const filters = {
      categoryId,
      majorCategoryId,
      searchable: searchable === "true" ? true : searchable === "false" ? false : null,
      includeSystem,
      enabledOnly
    };
    const result = await searchSourcesService.getUserSearchSources(env, user.id, filters);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u5931\u8D25", 500);
  }
}
__name(getSearchSourcesHandler, "getSearchSourcesHandler");
async function createSearchSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateSourceInput(body);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const {
      categoryId,
      name,
      subtitle,
      description,
      icon,
      urlTemplate,
      homepageUrl,
      siteType,
      searchable,
      requiresKeyword,
      searchPriority,
      supportsDetailExtraction,
      extractionQuality,
      supportedFeatures
    } = body;
    const sourceData = {
      categoryId: categoryId.trim(),
      name: name.trim(),
      subtitle: subtitle?.trim() || "",
      description: description?.trim() || "",
      icon: icon?.trim() || "\u{1F50D}",
      urlTemplate: urlTemplate.trim(),
      homepageUrl: homepageUrl?.trim() || "",
      siteType: siteType || "search",
      searchable: searchable !== false,
      requiresKeyword: requiresKeyword !== false,
      searchPriority: Math.min(Math.max(parseInt(searchPriority) || 5, 1), 10),
      supportsDetailExtraction: supportsDetailExtraction === true,
      extractionQuality: extractionQuality || "none",
      supportedFeatures: Array.isArray(supportedFeatures) ? supportedFeatures : []
    };
    const result = await searchSourcesService.createSearchSource(env, sourceData, user.id);
    await utils.logUserAction(env, user.id, "search_source_create", {
      sourceId: result.id,
      sourceName: result.name,
      categoryId: result.categoryId
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u521B\u5EFA\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u521B\u5EFA\u641C\u7D22\u6E90\u5931\u8D25: " + error.message, 500);
  }
}
__name(createSearchSourceHandler, "createSearchSourceHandler");
async function updateSearchSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const sourceId = request.params?.id;
    if (!sourceId) {
      return utils.errorResponse("\u641C\u7D22\u6E90ID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const body = await request.json().catch(() => ({}));
    const validation = validateSourceUpdateInput(body);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const updateData = {};
    const allowedFields = [
      "categoryId",
      "name",
      "subtitle",
      "description",
      "icon",
      "urlTemplate",
      "homepageUrl",
      "siteType",
      "searchable",
      "requiresKeyword",
      "searchPriority",
      "supportsDetailExtraction",
      "extractionQuality",
      "supportedFeatures"
    ];
    allowedFields.forEach((field) => {
      if (body.hasOwnProperty(field)) {
        if (field === "searchPriority") {
          updateData[field] = Math.min(Math.max(parseInt(body[field]) || 5, 1), 10);
        } else if (field === "supportedFeatures") {
          updateData[field] = Array.isArray(body[field]) ? body[field] : [];
        } else if (typeof body[field] === "string") {
          updateData[field] = body[field].trim();
        } else {
          updateData[field] = body[field];
        }
      }
    });
    if (Object.keys(updateData).length === 0) {
      return utils.errorResponse("\u6CA1\u6709\u63D0\u4F9B\u8981\u66F4\u65B0\u7684\u6570\u636E", 400);
    }
    const result = await searchSourcesService.updateSearchSource(env, sourceId, updateData, user.id);
    await utils.logUserAction(env, user.id, "search_source_update", {
      sourceId,
      updatedFields: Object.keys(updateData)
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u66F4\u65B0\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u66F4\u65B0\u641C\u7D22\u6E90\u5931\u8D25: " + error.message, 500);
  }
}
__name(updateSearchSourceHandler, "updateSearchSourceHandler");
async function deleteSearchSourceHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const sourceId = request.params?.id;
    if (!sourceId) {
      return utils.errorResponse("\u641C\u7D22\u6E90ID\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const result = await searchSourcesService.deleteSearchSource(env, sourceId, user.id);
    await utils.logUserAction(env, user.id, "search_source_delete", {
      sourceId,
      sourceName: result.deletedSource.name
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u5220\u9664\u641C\u7D22\u6E90\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u641C\u7D22\u6E90\u5931\u8D25: " + error.message, 500);
  }
}
__name(deleteSearchSourceHandler, "deleteSearchSourceHandler");
async function getUserSourceConfigsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const result = await searchSourcesService.getUserSourceConfigs(env, user.id);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25", 500);
  }
}
__name(getUserSourceConfigsHandler, "getUserSourceConfigsHandler");
async function updateUserSourceConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const validation = validateUserConfigInput(body);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const { sourceId, isEnabled, customPriority, customName, customSubtitle, customIcon, notes } = body;
    const configData = {
      sourceId: sourceId.trim(),
      isEnabled: isEnabled !== false,
      customPriority: customPriority ? Math.min(Math.max(parseInt(customPriority), 1), 10) : null,
      customName: customName?.trim() || null,
      customSubtitle: customSubtitle?.trim() || null,
      customIcon: customIcon?.trim() || null,
      notes: notes?.trim() || null
    };
    const result = await searchSourcesService.updateUserSourceConfig(env, user.id, configData);
    await utils.logUserAction(env, user.id, "user_source_config_update", {
      sourceId,
      isEnabled: configData.isEnabled
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(updateUserSourceConfigHandler, "updateUserSourceConfigHandler");
async function batchUpdateUserSourceConfigsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { configs } = body;
    const validation = validateBatchConfigInput(configs);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 400);
    }
    const result = await searchSourcesService.batchUpdateUserSourceConfigs(env, user.id, configs);
    await utils.logUserAction(env, user.id, "user_source_configs_batch_update", {
      configCount: configs.length,
      enabledCount: configs.filter((c) => c.isEnabled !== false).length
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u6279\u91CF\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u6279\u91CF\u66F4\u65B0\u7528\u6237\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(batchUpdateUserSourceConfigsHandler, "batchUpdateUserSourceConfigsHandler");
async function getSearchSourceStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const result = await searchSourcesService.getSearchSourceStats(env, user.id);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u83B7\u53D6\u641C\u7D22\u6E90\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u641C\u7D22\u6E90\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25", 500);
  }
}
__name(getSearchSourceStatsHandler, "getSearchSourceStatsHandler");
async function exportUserSearchSourcesHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const result = await searchSourcesService.exportUserSearchSources(env, user.id);
    await utils.logUserAction(env, user.id, "search_sources_export", {
      exportedCount: result.sources?.length || 0
    }, request);
    return utils.successResponse(result);
  } catch (error) {
    console.error("\u5BFC\u51FA\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u5BFC\u51FA\u641C\u7D22\u6E90\u914D\u7F6E\u5931\u8D25", 500);
  }
}
__name(exportUserSearchSourcesHandler, "exportUserSearchSourcesHandler");
function validateMajorCategoryInput(data) {
  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    return { valid: false, error: "\u5927\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.name.length > 30) {
    return { valid: false, error: "\u5927\u7C7B\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC730\u4E2A\u5B57\u7B26" };
  }
  if (data.description && data.description.length > 100) {
    return { valid: false, error: "\u5927\u7C7B\u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u5B57\u7B26" };
  }
  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    return { valid: false, error: "\u989C\u8272\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return { valid: true };
}
__name(validateMajorCategoryInput, "validateMajorCategoryInput");
function validateCategoryInput(data) {
  if (!data.majorCategoryId || typeof data.majorCategoryId !== "string") {
    return { valid: false, error: "\u5927\u7C7BID\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    return { valid: false, error: "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.name.length > 30) {
    return { valid: false, error: "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC730\u4E2A\u5B57\u7B26" };
  }
  if (data.description && data.description.length > 100) {
    return { valid: false, error: "\u5206\u7C7B\u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u5B57\u7B26" };
  }
  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    return { valid: false, error: "\u989C\u8272\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  if (data.searchPriority && (data.searchPriority < 1 || data.searchPriority > 10)) {
    return { valid: false, error: "\u641C\u7D22\u4F18\u5148\u7EA7\u5FC5\u987B\u57281-10\u4E4B\u95F4" };
  }
  const validSiteTypes = ["search", "browse", "reference"];
  if (data.defaultSiteType && !validSiteTypes.includes(data.defaultSiteType)) {
    return { valid: false, error: "\u7F51\u7AD9\u7C7B\u578B\u5FC5\u987B\u662Fsearch\u3001browse\u6216reference" };
  }
  const validExtractionPriorities = ["high", "medium", "low", "none"];
  if (data.extractionPriority && !validExtractionPriorities.includes(data.extractionPriority)) {
    return { valid: false, error: "\u63D0\u53D6\u4F18\u5148\u7EA7\u5FC5\u987B\u662Fhigh\u3001medium\u3001low\u6216none" };
  }
  return { valid: true };
}
__name(validateCategoryInput, "validateCategoryInput");
function validateCategoryUpdateInput(data) {
  if (data.name !== void 0 && (!data.name || data.name.trim().length === 0)) {
    return { valid: false, error: "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.name && data.name.length > 30) {
    return { valid: false, error: "\u5206\u7C7B\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC730\u4E2A\u5B57\u7B26" };
  }
  if (data.description && data.description.length > 100) {
    return { valid: false, error: "\u5206\u7C7B\u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u5B57\u7B26" };
  }
  if (data.color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(data.color)) {
    return { valid: false, error: "\u989C\u8272\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return { valid: true };
}
__name(validateCategoryUpdateInput, "validateCategoryUpdateInput");
function validateSourceInput(data) {
  if (!data.categoryId || typeof data.categoryId !== "string") {
    return { valid: false, error: "\u5206\u7C7BID\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.name.length > 50) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC750\u4E2A\u5B57\u7B26" };
  }
  if (!data.urlTemplate || typeof data.urlTemplate !== "string" || data.urlTemplate.trim().length === 0) {
    return { valid: false, error: "URL\u6A21\u677F\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (!/^https?:\/\/.+/.test(data.urlTemplate)) {
    return { valid: false, error: "URL\u6A21\u677F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  if (data.searchable !== false && !data.urlTemplate.includes("{keyword}")) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u7684URL\u6A21\u677F\u5FC5\u987B\u5305\u542B{keyword}\u5360\u4F4D\u7B26" };
  }
  if (data.subtitle && data.subtitle.length > 100) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u526F\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u5B57\u7B26" };
  }
  if (data.description && data.description.length > 200) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u63CF\u8FF0\u4E0D\u80FD\u8D85\u8FC7200\u4E2A\u5B57\u7B26" };
  }
  const validSiteTypes = ["search", "browse", "reference"];
  if (data.siteType && !validSiteTypes.includes(data.siteType)) {
    return { valid: false, error: "\u7F51\u7AD9\u7C7B\u578B\u5FC5\u987B\u662Fsearch\u3001browse\u6216reference" };
  }
  const validExtractionQualities = ["excellent", "good", "fair", "poor", "none"];
  if (data.extractionQuality && !validExtractionQualities.includes(data.extractionQuality)) {
    return { valid: false, error: "\u63D0\u53D6\u8D28\u91CF\u5FC5\u987B\u662Fexcellent\u3001good\u3001fair\u3001poor\u6216none" };
  }
  return { valid: true };
}
__name(validateSourceInput, "validateSourceInput");
function validateSourceUpdateInput(data) {
  if (data.name !== void 0 && (!data.name || data.name.trim().length === 0)) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.name && data.name.length > 50) {
    return { valid: false, error: "\u641C\u7D22\u6E90\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC750\u4E2A\u5B57\u7B26" };
  }
  if (data.urlTemplate && !/^https?:\/\/.+/.test(data.urlTemplate)) {
    return { valid: false, error: "URL\u6A21\u677F\u683C\u5F0F\u4E0D\u6B63\u786E" };
  }
  return { valid: true };
}
__name(validateSourceUpdateInput, "validateSourceUpdateInput");
function validateUserConfigInput(data) {
  if (!data.sourceId || typeof data.sourceId !== "string") {
    return { valid: false, error: "\u641C\u7D22\u6E90ID\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (data.customPriority && (data.customPriority < 1 || data.customPriority > 10)) {
    return { valid: false, error: "\u81EA\u5B9A\u4E49\u4F18\u5148\u7EA7\u5FC5\u987B\u57281-10\u4E4B\u95F4" };
  }
  if (data.customName && data.customName.length > 50) {
    return { valid: false, error: "\u81EA\u5B9A\u4E49\u540D\u79F0\u4E0D\u80FD\u8D85\u8FC750\u4E2A\u5B57\u7B26" };
  }
  if (data.customSubtitle && data.customSubtitle.length > 100) {
    return { valid: false, error: "\u81EA\u5B9A\u4E49\u526F\u6807\u9898\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u5B57\u7B26" };
  }
  if (data.notes && data.notes.length > 500) {
    return { valid: false, error: "\u5907\u6CE8\u4E0D\u80FD\u8D85\u8FC7500\u4E2A\u5B57\u7B26" };
  }
  return { valid: true };
}
__name(validateUserConfigInput, "validateUserConfigInput");
function validateBatchConfigInput(configs) {
  if (!Array.isArray(configs) || configs.length === 0) {
    return { valid: false, error: "\u914D\u7F6E\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A" };
  }
  if (configs.length > 100) {
    return { valid: false, error: "\u6279\u91CF\u66F4\u65B0\u4E0D\u80FD\u8D85\u8FC7100\u4E2A\u914D\u7F6E" };
  }
  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    const validation = validateUserConfigInput(config);
    if (!validation.valid) {
      return { valid: false, error: `\u7B2C${i + 1}\u4E2A\u914D\u7F6E: ${validation.error}` };
    }
  }
  return { valid: true };
}
__name(validateBatchConfigInput, "validateBatchConfigInput");

// src/handlers/system.js
async function healthCheckHandler(request, env) {
  return utils.successResponse({
    status: "healthy",
    timestamp: Date.now(),
    version: env.APP_VERSION || "1.3.0"
  });
}
__name(healthCheckHandler, "healthCheckHandler");
async function sourceStatusCheckHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sources, keyword, options = {} } = body;
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return utils.errorResponse("\u641C\u7D22\u6E90\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
      return utils.errorResponse("\u641C\u7D22\u5173\u952E\u8BCD\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const trimmedKeyword = keyword.trim();
    const keywordHash = await utils.hashPassword(`${trimmedKeyword}${Date.now()}`);
    const timeout = Math.min(Math.max(options.timeout || 1e4, 3e3), 3e4);
    const checkContentMatch = options.checkContentMatch !== false;
    console.log(`\u5F00\u59CB\u68C0\u67E5 ${sources.length} \u4E2A\u641C\u7D22\u6E90\uFF0C\u5173\u952E\u8BCD: ${trimmedKeyword}`);
    const results = [];
    const concurrency = Math.min(sources.length, 3);
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(
        (source) => checkSingleSourceStatus(source, trimmedKeyword, keywordHash, {
          timeout,
          checkContentMatch,
          env
        })
      );
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      if (i + concurrency < sources.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    saveStatusCheckResults(env, results, trimmedKeyword).catch(console.error);
    const summary = {
      total: results.length,
      available: results.filter((r) => r.status === "available").length,
      unavailable: results.filter((r) => r.status === "unavailable").length,
      timeout: results.filter((r) => r.status === "timeout").length,
      error: results.filter((r) => r.status === "error").length,
      averageResponseTime: Math.round(
        results.filter((r) => r.responseTime > 0).reduce((sum, r) => sum + r.responseTime, 0) / Math.max(results.filter((r) => r.responseTime > 0).length, 1)
      ),
      keyword: trimmedKeyword,
      timestamp: Date.now()
    };
    return utils.successResponse({
      summary,
      results,
      message: `\u641C\u7D22\u6E90\u72B6\u6001\u68C0\u67E5\u5B8C\u6210: ${summary.available}/${summary.total} \u53EF\u7528`
    });
  } catch (error) {
    console.error("\u641C\u7D22\u6E90\u72B6\u6001\u68C0\u67E5\u5931\u8D25:", error);
    return utils.errorResponse("\u641C\u7D22\u6E90\u72B6\u6001\u68C0\u67E5\u5931\u8D25: " + error.message, 500);
  }
}
__name(sourceStatusCheckHandler, "sourceStatusCheckHandler");
async function sourceStatusHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);
    const keyword = url.searchParams.get("keyword");
    let query = `
            SELECT * FROM source_status_cache 
            WHERE 1=1
        `;
    const params = [];
    if (keyword) {
      query += ` AND keyword LIKE ?`;
      params.push(`%${keyword}%`);
    }
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    const result = await env.DB.prepare(query).bind(...params).all();
    const history = result.results.map((item) => ({
      id: item.id,
      sourceId: item.source_id,
      keyword: item.keyword,
      status: item.status,
      available: Boolean(item.available),
      contentMatch: Boolean(item.content_match),
      responseTime: item.response_time,
      qualityScore: item.quality_score,
      lastChecked: item.created_at,
      checkError: item.check_error
    }));
    return utils.successResponse({
      history,
      total: result.results.length,
      limit,
      offset
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u72B6\u6001\u68C0\u67E5\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u5386\u53F2\u5931\u8D25", 500);
  }
}
__name(sourceStatusHistoryHandler, "sourceStatusHistoryHandler");
async function getConfigHandler(request, env) {
  return utils.successResponse({
    allowRegistration: (env.ALLOW_REGISTRATION || "true") === "true",
    minUsernameLength: parseInt(env.MIN_USERNAME_LENGTH || "3"),
    maxUsernameLength: parseInt(env.MAX_USERNAME_LENGTH || "20"),
    minPasswordLength: parseInt(env.MIN_PASSWORD_LENGTH || "6"),
    maxFavoritesPerUser: parseInt(env.MAX_FAVORITES_PER_USER || "1000"),
    maxHistoryPerUser: parseInt(env.MAX_HISTORY_PER_USER || "1000"),
    maxTagsPerUser: parseInt(env.MAX_TAGS_PER_USER || "50"),
    version: env.APP_VERSION || "1.3.0"
  });
}
__name(getConfigHandler, "getConfigHandler");
async function recordActionHandler(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, data, timestamp, sessionId } = body;
    let actionType = "unknown";
    if (action && typeof action === "string" && action.trim()) {
      actionType = action.trim();
    }
    const allowedActions = CONFIG.ALLOWED_ACTIONS;
    if (!allowedActions.includes(actionType)) {
      actionType = "custom";
    }
    const user = await authenticate(request, env);
    const userId = user ? user.id : null;
    if (userId && env.ENABLE_ACTION_LOGGING === "true") {
      await utils.logUserAction(env, userId, actionType, data || {}, request);
    }
    return utils.successResponse({
      recorded: true,
      actionType,
      userId: userId || null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("\u8BB0\u5F55\u884C\u4E3A\u5931\u8D25:", error);
    return utils.successResponse({
      recorded: false,
      error: "silent_failure",
      message: "\u884C\u4E3A\u8BB0\u5F55\u5931\u8D25\u4F46\u4E0D\u5F71\u54CD\u529F\u80FD"
    });
  }
}
__name(recordActionHandler, "recordActionHandler");
function defaultHandler(request) {
  const url = new URL(request.url);
  return utils.errorResponse(`API\u8DEF\u5F84\u4E0D\u5B58\u5728: ${url.pathname}`, 404);
}
__name(defaultHandler, "defaultHandler");

// src/config/parser-rules.js
var ParserRulesConfig = class {
  static {
    __name(this, "ParserRulesConfig");
  }
  constructor() {
    this.rules = {
      // JavBus 解析规则 - 实际验证版本
      javbus: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavBus的详情页直接是番号格式: /IPX-156
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"]):not([href*="/genre"]):not([href*="/actress"])',
              titleSelector: "img[title], img[alt]",
              titleAttribute: "title",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                "/search/",
                "/category/",
                "/star/",
                "/studio/",
                "/label/",
                "/genre/",
                "/actresses/",
                "/uncensored/",
                "/forum/",
                "/doc/",
                "/page/",
                "/en",
                "/ja",
                "/ko",
                "/#",
                ".css",
                ".js",
                "javascript:",
                "/terms",
                "/privacy"
              ],
              // 实际验证：JavBus详情页就是 /番号 格式
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
            },
            {
              // 备用：movie-box内的链接
              selector: ".movie-box a[href]",
              titleSelector: "img",
              titleAttribute: "title",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/category/", "/genre/", "/actresses/"],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h3, .title, title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: ".header .title span, h3 span, .info span:first-child",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: ".screencap img, .bigImage img, .poster img",
            attribute: "src",
            fallback: "data-src"
          },
          screenshots: {
            selector: ".sample-box img, .screenshot img, .preview img",
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: '.star-name a, .actress a, .info .genre:contains("\u6F14\u5458") a',
            extractProfile: true
          },
          director: {
            selector: '.info .genre:contains("\u5C0E\u6F14") a, .director a',
            transform: [{ type: "trim" }]
          },
          studio: {
            selector: '.info .genre:contains("\u88FD\u4F5C\u5546") a, .studio a',
            transform: [{ type: "trim" }]
          },
          label: {
            selector: '.info .genre:contains("\u767C\u884C\u5546") a, .label a',
            transform: [{ type: "trim" }]
          },
          series: {
            selector: '.info .genre:contains("\u7CFB\u5217") a, .series a',
            transform: [{ type: "trim" }]
          },
          releaseDate: {
            selector: '.info .genre:contains("\u767C\u884C\u65E5\u671F"), .release-date',
            transform: [
              { type: "extract", pattern: "(\\d{4}-\\d{2}-\\d{2})", group: 1 }
            ]
          },
          duration: {
            selector: '.info .genre:contains("\u9577\u5EA6"), .duration',
            transform: [
              { type: "extract", pattern: "(\\d+)\\s*\u5206", group: 1 }
            ]
          },
          description: {
            selector: ".description, .summary, .intro",
            transform: [{ type: "trim" }]
          },
          tags: {
            selector: ".genre a, .tag a, .category a",
            excludeTexts: ["\u6F14\u5458", "\u5C0E\u6F14", "\u88FD\u4F5C\u5546", "\u767C\u884C\u5546", "\u7CFB\u5217", "\u767C\u884C\u65E5\u671F", "\u9577\u5EA6"]
          },
          magnetLinks: {
            selector: 'a[href^="magnet:"], .magnet-link',
            extractSize: ".size, .filesize",
            extractSeeders: ".seeders, .seeds"
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download-link',
            extractSize: ".size",
            extractQuality: ".quality",
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javbus\.com$/, /^javbus\.com$/]
          },
          rating: {
            selector: ".rating, .score, .rate",
            transform: [
              { type: "extract", pattern: "(\\d+(?:\\.\\d+)?)", group: 1 }
            ]
          }
        }
      },
      // JavDB 解析规则 - 实际验证版本
      javdb: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavDB详情页格式: /v/KkZ97
              selector: 'a[href*="/v/"]:not([href*="/search"])',
              titleSelector: ".video-title, .title, h4",
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/actors/", "/makers/", "/publishers/"],
              requirePattern: /\/v\/[a-zA-Z0-9]+/,
              allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/]
            },
            {
              // 备用：grid-item或movie-list中的链接
              selector: ".movie-list .item a, .grid-item a, .video-node a",
              titleSelector: ".video-title, .title, h4",
              codeSelector: ".video-number, .uid, .meta strong",
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/actors/", "/makers/", "/publishers/"],
              allowedDomainPatterns: [/^.*\.javdb\.com$/, /^javdb\.com$/]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h2.title, .video-title, title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: ".first-block .value, .video-meta strong",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: ".video-cover img, .cover img",
            attribute: "src",
            fallback: "data-src"
          },
          screenshots: {
            selector: ".tile-images img, .preview-images img",
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: '.panel-block:contains("\u6F14\u5458") .value a, .actress-tag a',
            extractProfile: true
          },
          director: {
            selector: '.panel-block:contains("\u5C0E\u6F14") .value, .director',
            transform: [{ type: "trim" }]
          },
          studio: {
            selector: '.panel-block:contains("\u7247\u5546") .value, .studio',
            transform: [{ type: "trim" }]
          },
          label: {
            selector: '.panel-block:contains("\u5EE0\u724C") .value, .label',
            transform: [{ type: "trim" }]
          },
          series: {
            selector: '.panel-block:contains("\u7CFB\u5217") .value, .series',
            transform: [{ type: "trim" }]
          },
          releaseDate: {
            selector: '.panel-block:contains("\u6642\u9593") .value, .release-date',
            transform: [
              { type: "extract", pattern: "(\\d{4}-\\d{2}-\\d{2})", group: 1 }
            ]
          },
          duration: {
            selector: '.panel-block:contains("\u6642\u9577") .value, .duration',
            transform: [
              { type: "extract", pattern: "(\\d+)", group: 1 }
            ]
          },
          description: {
            selector: ".description, .content",
            transform: [{ type: "trim" }]
          },
          tags: {
            selector: '.panel-block:contains("\u985E\u5225") .tag a, .genre-tag a',
            excludeTexts: ["\u6F14\u5458", "\u5C0E\u6F14", "\u7247\u5546", "\u5EE0\u724C", "\u7CFB\u5217", "\u6642\u9593", "\u6642\u9577"]
          },
          magnetLinks: {
            selector: 'a[href^="magnet:"], .magnet-link',
            extractSize: ".size",
            extractSeeders: ".seeds"
          },
          rating: {
            selector: ".score, .rating",
            transform: [
              { type: "extract", pattern: "(\\d+(?:\\.\\d+)?)", group: 1 }
            ]
          }
        }
      },
      // Jable 解析规则 - 实际验证版本
      jable: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Jable详情页格式: /videos/ipx-156/
              selector: 'a[href*="/videos/"]:not([href*="/search"])',
              titleSelector: ".title, .video-title",
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/categories/", "/models/"],
              requirePattern: /\/videos\/[^\/]+/,
              allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/]
            },
            {
              // 备用：video-item中的链接
              selector: ".video-item a, .list-videos a",
              titleSelector: ".title, h4, .video-title",
              mustContainCode: false,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/],
              excludeHrefs: ["/search/", "/categories/", "/models/"]
            }
          ]
        },
        detailPage: {
          title: {
            selector: ".title-video, h1, .video-title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: ".models a, .video-detail strong",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: ".video-cover img, video[poster]",
            attribute: "src",
            fallback: "poster"
          },
          screenshots: {
            selector: ".video-screenshots img, .preview img",
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: ".models a, .actress a",
            extractProfile: true
          },
          releaseDate: {
            selector: ".video-detail .date, .publish-time",
            transform: [
              { type: "extract", pattern: "(\\d{4}-\\d{2}-\\d{2})", group: 1 }
            ]
          },
          duration: {
            selector: ".video-detail .duration, .length",
            transform: [
              { type: "extract", pattern: "(\\d+)", group: 1 }
            ]
          },
          tags: {
            selector: ".tag a, .category a",
            excludeTexts: []
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download-btn',
            extractQuality: ".quality, .resolution",
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.jable\.tv$/, /^jable\.tv$/]
          }
        }
      },
      // JavGG 解析规则 - 实际验证版本
      javgg: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGG详情页格式: /jav/ipx-156-reduce-mosaic/
              selector: 'a[href*="/jav/"]:not([href*="/search"])',
              titleSelector: ".title, .video-title, h3",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/category/", "/tag/", "/page/"],
              requirePattern: /\/jav\/[a-z0-9\-]+/i,
              allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/]
            },
            {
              // 备用：通用容器中的链接
              selector: ".video-item a, .movie-item a, .item a",
              titleSelector: ".title, h3, .video-title",
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/],
              excludeHrefs: ["/search/", "/category/", "/tag/"]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h1, .video-title, .title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: "h1, .video-title, .code, .video-meta",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: ".video-cover img, .poster img, .cover img",
            attribute: "src",
            fallback: "data-src"
          },
          screenshots: {
            selector: ".screenshots img, .preview img, .gallery img",
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: ".actress a, .performer a, .stars a",
            extractProfile: true
          },
          description: {
            selector: ".description, .summary, .content",
            transform: [{ type: "trim" }]
          },
          tags: {
            selector: ".tag a, .genre a, .category a",
            excludeTexts: []
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download-link',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javgg\.net$/, /^javgg\.net$/]
          }
        }
      },
      // Sukebei (磁力站) 解析规则 - 实际验证版本
      sukebei: {
        searchPage: {
          detailLinkSelectors: [
            {
              // Sukebei详情页格式: /view/3403743
              selector: 'a[href*="/view/"]:not([href*="/?"])',
              titleSelector: null,
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ["/user/", "/?"],
              requirePattern: /\/view\/\d+/,
              allowedDomainPatterns: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/]
            },
            {
              // 备用：表格中的torrent名称链接
              selector: "tr td:first-child a, .torrent-name a",
              titleSelector: null,
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.sukebei\.nyaa\.si$/, /^sukebei\.nyaa\.si$/],
              excludeHrefs: ["/user/", "/?"]
            }
          ]
        },
        detailPage: {
          title: {
            selector: ".torrent-title, h3, .title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: ".torrent-title, .title",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          magnetLinks: {
            selector: 'a[href^="magnet:"], .magnet',
            extractSize: ".size, .torrent-size",
            extractSeeders: ".seeders, .seeds",
            extractLeechers: ".leechers, .peers"
          },
          downloadLinks: {
            selector: 'a[href$=".torrent"], .torrent-download',
            extractSize: ".size"
          },
          releaseDate: {
            selector: ".date, .upload-time",
            transform: [
              { type: "extract", pattern: "(\\d{4}-\\d{2}-\\d{2})", group: 1 }
            ]
          },
          fileSize: {
            selector: ".size, .file-size",
            transform: [{ type: "trim" }]
          }
        }
      },
      // JavMost 解析规则 - 实际验证版本（支持子域名）
      javmost: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavMost详情页格式: /IPX-156/ （注意支持www5等子域名）
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/tag"])',
              titleSelector: ".title, h3, .video-title",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/tag/", "/category/", "/page/"],
              requirePattern: /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i,
              allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/]
            },
            {
              // 备用：video-item中的链接
              selector: ".video-item a, .movie-item a",
              titleSelector: ".title, h3",
              mustContainCode: true,
              strictDomainCheck: false,
              allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/],
              excludeHrefs: ["/search/", "/tag/", "/category/"]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h1, .video-title, .title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: "h1, .video-code, .title",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: ".video-cover img, .poster img",
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: ".actress a, .performer a",
            extractProfile: true
          },
          description: {
            selector: ".description, .summary",
            transform: [{ type: "trim" }]
          },
          downloadLinks: {
            selector: 'a[href*="/"][title], .download-link',
            strictValidation: true,
            allowedDomainPatterns: [/^.*\.javmost\.com$/, /^javmost\.com$/]
          }
        }
      },
      // JavGuru 解析规则 - 实际验证版本
      javguru: {
        searchPage: {
          detailLinkSelectors: [
            {
              // JavGuru详情页格式: /268681/ipx-156-sana-matsunaga-has-been-celibate-for-30-days-she-is-given-a-large-dose-of-a-powerful-aphrodisiac/
              selector: 'a[href]:not([href*="?s="]):not([href*="/search"])',
              titleSelector: ".title, h3",
              mustContainCode: false,
              strictDomainCheck: false,
              excludeHrefs: ["?s=", "/search/", "/category/"],
              requirePattern: /\/\d+\/[a-z0-9\-]+/i,
              allowedDomainPatterns: [/^.*\.jav\.guru$/, /^jav\.guru$/]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h1, .video-title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: "h1, .video-title",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          }
        }
      },
      // 通用解析规则（作为后备）- 严格修复版
      generic: {
        searchPage: {
          detailLinkSelectors: [
            {
              // 最严格：必须包含番号的链接
              selector: 'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"]):not([href*="/category"])',
              titleSelector: ".title, h1, h2, h3, h4, img[alt]",
              titleAttribute: "title",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                "/search/",
                "/category/",
                "/tag/",
                "/list/",
                "/page/",
                "/genre/",
                "/actresses/",
                "/studio/",
                "/label/",
                "/forum/",
                "/doc/",
                "/terms",
                "/privacy",
                "/#",
                ".css",
                ".js",
                "javascript:",
                "/rss",
                "/sitemap"
              ],
              requirePattern: /[A-Z]{2,6}-?\d{3,6}/i
            },
            {
              // 中等严格：容器内的链接
              selector: ".item a, .movie a, .video a, .result a",
              titleSelector: ".title, h1, h2, h3, h4, img[alt]",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: ["/search/", "/category/", "/tag/", "/list/", "/page/"]
            },
            {
              // 最宽松：所有链接（最严格过滤）
              selector: 'a[href]:not([href*="/search"]):not([href*="/page"])',
              titleSelector: ".title, h1, h2, h3, h4, img[alt]",
              mustContainCode: true,
              strictDomainCheck: false,
              excludeHrefs: [
                "/search/",
                "/category/",
                "/tag/",
                "/list/",
                "/page/",
                "?page",
                "/genre/",
                "/actresses/",
                "/studio/",
                "/label/",
                "/forum/",
                "/doc/",
                "/terms",
                "/privacy",
                "/#",
                ".css",
                ".js",
                "javascript:",
                "/en",
                "/ja",
                "/ko",
                "/rss",
                "/sitemap",
                "/api/",
                "/ajax/"
              ]
            }
          ]
        },
        detailPage: {
          title: {
            selector: "h1, h2, h3, .title, title",
            transform: [
              { type: "replace", pattern: "\\s+", replacement: " " },
              { type: "trim" }
            ]
          },
          code: {
            selector: "h1, h2, h3, .title, .code",
            transform: [
              { type: "extract", pattern: "([A-Z]{2,6}-?\\d{3,6})", group: 1 },
              { type: "uppercase" }
            ]
          },
          coverImage: {
            selector: 'img[class*="cover"], img[class*="poster"], img[class*="thumb"]',
            attribute: "src",
            fallback: "data-src"
          },
          screenshots: {
            selector: 'img[class*="screenshot"], img[class*="preview"], img[class*="sample"]',
            attribute: "src",
            fallback: "data-src"
          },
          actresses: {
            selector: 'a[class*="actress"], a[class*="performer"], a[class*="star"]',
            extractProfile: true
          },
          description: {
            selector: ".description, .summary, .content, .intro",
            transform: [{ type: "trim" }]
          },
          tags: {
            selector: ".tag a, .genre a, .category a",
            excludeTexts: []
          },
          magnetLinks: {
            selector: 'a[href^="magnet:"]',
            extractSize: ".size",
            extractSeeders: ".seeds, .seeders"
          },
          downloadLinks: {
            selector: 'a[href*="download"], .download',
            extractSize: ".size",
            strictValidation: true
          },
          rating: {
            selector: ".rating, .score, .rate",
            transform: [
              { type: "extract", pattern: "(\\d+(?:\\.\\d+)?)", group: 1 }
            ]
          }
        }
      }
    };
  }
  /**
   * 根据源类型获取搜索页面规则
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 搜索页面规则对象
   */
  getSearchPageRules(sourceType) {
    if (!sourceType || typeof sourceType !== "string") {
      return this.rules.generic.searchPage;
    }
    const normalizedType = sourceType.toLowerCase();
    const rules = this.rules[normalizedType];
    return rules ? rules.searchPage : this.rules.generic.searchPage;
  }
  /**
   * 根据源类型获取详情页面规则
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 详情页面规则对象
   */
  getDetailPageRules(sourceType) {
    if (!sourceType || typeof sourceType !== "string") {
      return this.rules.generic.detailPage;
    }
    const normalizedType = sourceType.toLowerCase();
    const rules = this.rules[normalizedType];
    return rules ? rules.detailPage : this.rules.generic.detailPage;
  }
  /**
   * 根据源类型获取解析规则（兼容旧接口）
   * @param {string} sourceType - 源类型
   * @returns {Object|null} 解析规则对象
   */
  getParserRules(sourceType) {
    return this.getDetailPageRules(sourceType);
  }
  /**
   * 获取详情链接选择器配置
   * @param {string} sourceType - 源类型
   * @returns {Array} 选择器配置数组
   */
  getDetailLinkSelectors(sourceType) {
    const searchPageRules = this.getSearchPageRules(sourceType);
    return searchPageRules ? searchPageRules.detailLinkSelectors : [];
  }
  /**
   * 验证链接是否为有效的详情链接 - 增强版，包含严格域名检查
   * @param {string} href - 链接地址
   * @param {string} content - 链接内容
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为有效详情链接
   */
  isValidDetailLink(href, content, sourceType, expectedDomain) {
    if (!href || typeof href !== "string") return false;
    const searchPageRules = this.getSearchPageRules(sourceType);
    if (!searchPageRules || !searchPageRules.detailLinkSelectors) return true;
    const hrefLower = href.toLowerCase();
    const contentLower = (content || "").toLowerCase();
    for (const selectorConfig of searchPageRules.detailLinkSelectors) {
      if (selectorConfig.strictDomainCheck !== false && expectedDomain) {
        const linkDomain = this.extractDomainFromUrl(href);
        if (selectorConfig.allowedDomainPatterns && selectorConfig.allowedDomainPatterns.length > 0) {
          const domainMatches = selectorConfig.allowedDomainPatterns.some(
            (pattern) => pattern.test && pattern.test(linkDomain)
          );
          if (!domainMatches) {
            console.log(`\u2310 \u57DF\u540D\u4E0D\u5339\u914D\u6A21\u5F0F: ${linkDomain} (\u6A21\u5F0F: ${selectorConfig.allowedDomainPatterns.map((p) => p.source).join(", ")})`);
            return false;
          }
        } else {
          if (!this.isDomainOrSubdomain(linkDomain, expectedDomain)) {
            console.log(`\u2310 \u57DF\u540D\u4E0D\u5339\u914D: ${linkDomain} != ${expectedDomain}`);
            return false;
          }
        }
        if (selectorConfig.excludeDomains && selectorConfig.excludeDomains.length > 0) {
          if (selectorConfig.excludeDomains.some((domain) => linkDomain.includes(domain))) {
            console.log(`\u2310 \u57DF\u540D\u5728\u9ED1\u540D\u5355: ${linkDomain}`);
            return false;
          }
        }
      }
      if (selectorConfig.excludeHrefs) {
        const isExcluded = selectorConfig.excludeHrefs.some(
          (excludePattern) => hrefLower.includes(excludePattern.toLowerCase())
        );
        if (isExcluded) {
          console.log(`\u2310 URL\u5305\u542B\u6392\u9664\u6A21\u5F0F: ${href}`);
          return false;
        }
      }
      if (selectorConfig.requirePattern) {
        if (!selectorConfig.requirePattern.test(href)) {
          console.log(`\u2310 URL\u4E0D\u5339\u914D\u5FC5\u9700\u6A21\u5F0F: ${href}`);
          return false;
        }
      }
      if (selectorConfig.mustContainCode) {
        if (!this.containsCode(href) && !this.containsCode(content)) {
          console.log(`\u2310 \u94FE\u63A5\u548C\u5185\u5BB9\u90FD\u4E0D\u5305\u542B\u756A\u53F7: ${href}`);
          return false;
        }
      }
    }
    return true;
  }
  /**
   * 检查是否为域名或子域名 - 新增方法
   * @param {string} linkDomain - 链接域名
   * @param {string} expectedDomain - 期望域名
   * @returns {boolean} 是否匹配
   */
  isDomainOrSubdomain(linkDomain, expectedDomain) {
    if (!linkDomain || !expectedDomain) return false;
    const linkDomainLower = linkDomain.toLowerCase();
    const expectedDomainLower = expectedDomain.toLowerCase();
    if (linkDomainLower === expectedDomainLower) return true;
    if (linkDomainLower.endsWith("." + expectedDomainLower)) return true;
    return false;
  }
  /**
   * 检查链接是否包含番号
   * @param {string} text - 文本内容
   * @returns {boolean} 是否包含番号
   */
  containsCode(text) {
    if (!text) return false;
    return /[A-Z]{2,6}-?\d{3,6}/i.test(text);
  }
  /**
   * 从URL提取域名
   * @param {string} url - URL
   * @returns {string} 域名
   */
  extractDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  /**
   * 从URL推断可能的源类型
   * @param {string} url - URL
   * @returns {string} 推断的源类型
   */
  inferSourceTypeFromUrl(url) {
    if (!url || typeof url !== "string") {
      return "generic";
    }
    const urlLower = url.toLowerCase();
    const patterns = {
      "javbus": /javbus\.com/,
      "javdb": /javdb\.com/,
      "jable": /jable\.tv/,
      "javgg": /javgg\.net/,
      "javmost": /javmost\.com/,
      "sukebei": /sukebei\.nyaa\.si/,
      "javguru": /jav\.guru/
    };
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }
    return "generic";
  }
  /**
   * 导出解析规则配置
   * @returns {Object} 配置数据
   */
  exportRules() {
    return {
      version: "3.0",
      exportTime: Date.now(),
      rules: { ...this.rules }
    };
  }
  /**
   * 导入解析规则配置
   * @param {Object} configData - 配置数据
   * @returns {boolean} 是否导入成功
   */
  importRules(configData) {
    if (!configData || !configData.rules) {
      console.error("\u65E0\u6548\u7684\u914D\u7F6E\u6570\u636E");
      return false;
    }
    try {
      const backup2 = { ...this.rules };
      this.rules = {
        ...this.rules,
        ...configData.rules
      };
      console.log("\u89E3\u6790\u89C4\u5219\u5BFC\u5165\u6210\u529F");
      return true;
    } catch (error) {
      console.error("\u5BFC\u5165\u89E3\u6790\u89C4\u5219\u5931\u8D25:", error);
      if (backup) {
        this.rules = backup;
      }
      return false;
    }
  }
  /**
   * 获取所有支持的源类型
   * @returns {Array} 源类型数组
   */
  getSupportedSourceTypes() {
    return Object.keys(this.rules).filter((type) => type !== "generic");
  }
};
var parserRules = new ParserRulesConfig();

// src/utils/html-parser.js
var CloudflareHTMLParser = class {
  static {
    __name(this, "CloudflareHTMLParser");
  }
  constructor() {
    this.elementCache = /* @__PURE__ */ new Map();
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.HTML_PARSER_CACHE_SIZE;
    this.debugMode = false;
  }
  parseFromString(htmlContent) {
    return new CloudflareDocument(htmlContent);
  }
  setDebugMode(enabled) {
    this.debugMode = enabled;
  }
  log(message) {
    if (this.debugMode) {
      console.log(message);
    }
  }
};
var CloudflareDocument = class {
  static {
    __name(this, "CloudflareDocument");
  }
  constructor(html) {
    this.html = html || "";
    this.elementCache = /* @__PURE__ */ new Map();
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.HTML_PARSER_CACHE_SIZE;
  }
  querySelector(selector) {
    const elements = this.querySelectorAll(selector);
    return elements.length > 0 ? elements[0] : null;
  }
  querySelectorAll(selector) {
    const cacheKey = `all:${selector}`;
    if (this.elementCache.has(cacheKey)) {
      return this.elementCache.get(cacheKey);
    }
    const elements = this._parseSelector(selector);
    if (this.elementCache.size >= this.maxCacheSize) {
      this.elementCache.clear();
    }
    this.elementCache.set(cacheKey, elements);
    return elements;
  }
  _parseSelector(selector) {
    const elements = [];
    console.log(`=== \u5F00\u59CB\u89E3\u6790\u9009\u62E9\u5668: ${selector} ===`);
    if (selector.includes(".movie-box")) {
      this._parseJavBusMovieBox(elements);
    } else if (selector.includes(".movie-list") || selector.includes(".grid-item") || selector.includes(".video-node")) {
      this._parseJavDBContainers(elements);
    } else if (selector.includes(".video-item") || selector.includes(".list-videos")) {
      this._parseJableContainers(elements);
    } else if (selector.includes("tr td:first-child") || selector.includes(".torrent-name")) {
      this._parseSukebeiTorrents(elements);
    } else if (selector.startsWith("a[href") || selector.includes("a") && selector.includes("[href")) {
      this._parseGenericLinks(elements, selector);
    } else if (selector === "title") {
      this._parseTitleTag(elements);
    } else {
      this._parseGenericSelector(elements, selector);
    }
    console.log(`=== \u9009\u62E9\u5668\u89E3\u6790\u5B8C\u6210: ${selector}\uFF0C\u627E\u5230 ${elements.length} \u4E2A\u5143\u7D20 ===`);
    return elements;
  }
  /**
   * JavBus movie-box 解析 - 根据实际数据优化
   */
  _parseJavBusMovieBox(elements) {
    console.log("\u5F00\u59CB\u89E3\u6790JavBus movie-box\u94FE\u63A5...");
    const movieBoxPatterns = [
      // 主要模式：<a class="movie-box" href="/IPX-156">
      /<a[^>]*class="[^"]*movie-box[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      // 备用模式：href在class之前
      /<a[^>]*href="([^"]+)"[^>]*class="[^"]*movie-box[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
    ];
    let foundAny = false;
    for (const pattern of movieBoxPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        foundAny = true;
        const href = match[1];
        const content = match[2];
        console.log(`\u68C0\u67E5movie-box\u94FE\u63A5: ${href}`);
        if (this._isValidJavBusLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`\u2713 \u6DFB\u52A0JavBus movie-box\u94FE\u63A5: ${href}`);
        } else {
          console.log(`\u2717 \u8DF3\u8FC7JavBus\u94FE\u63A5: ${href}`);
        }
      }
      if (foundAny) break;
    }
    if (!foundAny) {
      console.log("\u5C1D\u8BD5\u5BBD\u677E\u5339\u914D...");
      this._parseJavBusLinksLoose(elements);
    }
    console.log(`JavBus\u89E3\u6790\u627E\u5230 ${elements.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
  }
  /**
   * JavBus 宽松匹配（后备方案）
   */
  _parseJavBusLinksLoose(elements) {
    const loosePattern = /<a[^>]*href="([^"]*\/[A-Z]{2,6}-?\d{3,6}[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = loosePattern.exec(this.html)) !== null) {
      const href = match[1];
      const content = match[2];
      if (!href.includes("/search") && !href.includes("/page")) {
        const element = this._createMovieElement(href, content, match[0]);
        elements.push(element);
        console.log(`\u2713 \u5BBD\u677E\u5339\u914D\u6DFB\u52A0: ${href}`);
      }
    }
  }
  /**
   * JavDB 容器解析 - 根据实际数据优化
   */
  _parseJavDBContainers(elements) {
    console.log("\u5F00\u59CB\u89E3\u6790JavDB\u5BB9\u5668\u94FE\u63A5...");
    const containerPatterns = [
      // movie-list容器
      /<div[^>]*class="[^"]*movie-list[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // grid-item容器
      /<div[^>]*class="[^"]*grid-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // video-node容器
      /<div[^>]*class="[^"]*video-node[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];
    for (const pattern of containerPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        this._extractLinksFromContainer(containerContent, elements, "javdb");
      }
    }
    if (elements.length === 0) {
      this._parseJavDBDirectLinks(elements);
    }
    console.log(`JavDB\u89E3\u6790\u627E\u5230 ${elements.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
  }
  /**
   * JavDB 直接链接匹配
   */
  _parseJavDBDirectLinks(elements) {
    const directPatterns = [
      // /v/ 格式的链接 - JavDB的实际格式
      /<a[^>]*href="([^"]*\/v\/[a-zA-Z0-9]+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    ];
    for (const pattern of directPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const href = match[1];
        const content = match[2];
        if (this._isValidJavDBLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`\u2713 JavDB\u76F4\u63A5\u5339\u914D: ${href}`);
        }
      }
    }
  }
  /**
   * Jable 容器解析 - 根据实际数据优化
   */
  _parseJableContainers(elements) {
    console.log("\u5F00\u59CB\u89E3\u6790Jable\u5BB9\u5668\u94FE\u63A5...");
    const containerPatterns = [
      /<div[^>]*class="[^"]*video-item[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*list-videos[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    ];
    for (const pattern of containerPatterns) {
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        const containerContent = match[1];
        this._extractLinksFromContainer(containerContent, elements, "jable");
      }
    }
    if (elements.length === 0) {
      const directPattern = /<a[^>]*href="([^"]*\/videos\/[^\/\?"]+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = directPattern.exec(this.html)) !== null) {
        const href = match[1];
        const content = match[2];
        if (this._isValidJableLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          elements.push(element);
          console.log(`\u2713 Jable\u76F4\u63A5\u5339\u914D: ${href}`);
        }
      }
    }
    console.log(`Jable\u89E3\u6790\u627E\u5230 ${elements.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
  }
  /**
   * Sukebei 种子解析 - 根据实际数据优化
   */
  _parseSukebeiTorrents(elements) {
    console.log("\u5F00\u59CB\u89E3\u6790Sukebei\u79CD\u5B50\u94FE\u63A5...");
    const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;
    while ((match = rowPattern.exec(this.html)) !== null) {
      const rowContent = match[1];
      const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/i;
      const tdMatch = tdPattern.exec(rowContent);
      if (tdMatch) {
        this._extractLinksFromContainer(tdMatch[1], elements, "sukebei");
      }
    }
    if (elements.length === 0) {
      const directPattern = /<a[^>]*href="([^"]*\/view\/\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let directMatch;
      while ((directMatch = directPattern.exec(this.html)) !== null) {
        const href = directMatch[1];
        const content = directMatch[2];
        if (this._isValidSukebeiLink(href, content)) {
          const element = this._createMovieElement(href, content, directMatch[0]);
          elements.push(element);
          console.log(`\u2713 Sukebei\u76F4\u63A5\u5339\u914D: ${href}`);
        }
      }
    }
    console.log(`Sukebei\u89E3\u6790\u627E\u5230 ${elements.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
  }
  /**
   * 通用链接解析 - 根据实际数据平衡版本
   */
  _parseGenericLinks(elements, selector) {
    console.log(`\u5F00\u59CB\u89E3\u6790\u901A\u7528\u94FE\u63A5\uFF0C\u9009\u62E9\u5668: ${selector}`);
    const patterns = [];
    if (selector.includes('[href*="/"]')) {
      patterns.push(/<a[^>]*href="([^"]*\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    if (selector.includes("[title]")) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    if (patterns.length === 0) {
      patterns.push(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);
    }
    for (const pattern of patterns) {
      let match;
      let count = 0;
      const maxLinks = CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE;
      while ((match = pattern.exec(this.html)) !== null && count < maxLinks) {
        count++;
        const href = match[1];
        const content = match[3] || match[2];
        const titleAttr = pattern.source.includes("title") ? match[2] : null;
        if (this._isValidGenericLink(href, content)) {
          const element = this._createMovieElement(href, content, match[0]);
          if (titleAttr) {
            element.titleAttribute = titleAttr;
          }
          elements.push(element);
          console.log(`\u2713 \u901A\u7528\u94FE\u63A5\u5339\u914D: ${href}`);
        }
      }
      if (count >= maxLinks) {
        console.log(`\u5DF2\u8FBE\u5230\u901A\u7528\u94FE\u63A5\u5904\u7406\u9650\u5236 (${maxLinks})\uFF0C\u505C\u6B62\u5904\u7406`);
      }
    }
    console.log(`\u901A\u7528\u94FE\u63A5\u89E3\u6790\u627E\u5230 ${elements.length} \u4E2A\u6709\u6548\u94FE\u63A5 (\u9650\u5236: ${CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE})`);
  }
  /**
   * 从容器中提取链接
   */
  _extractLinksFromContainer(containerContent, elements, sourceType) {
    const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(containerContent)) !== null) {
      const href = linkMatch[1];
      const content = linkMatch[2];
      if (this._isValidMovieLink(href, content, sourceType)) {
        const element = this._createMovieElement(href, content, linkMatch[0]);
        elements.push(element);
        console.log(`\u2713 ${sourceType}\u5BB9\u5668\u94FE\u63A5: ${href}`);
      }
    }
  }
  /**
   * 创建电影元素对象
   */
  _createMovieElement(href, content, elementHtml) {
    const element = new CloudflareElement(href, content, this.html, elementHtml);
    element.extractedTitle = this._extractTitleFromContent(content);
    element.extractedCode = this._extractCodeFromContent(content, href);
    element.extractedDate = this._extractDateFromContent(content);
    return element;
  }
  /**
   * 从内容中提取标题
   */
  _extractTitleFromContent(content) {
    const titlePatterns = [
      /title="([^"]+)"/i,
      /alt="([^"]+)"/i,
      /<span[^>]*>(.*?)<\/span>/i,
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i,
      /<div[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/div>/i
    ];
    for (const pattern of titlePatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        let title = match[1].replace(/<[^>]*>/g, "").trim();
        if (title.length > 5 && title.length < 500 && !this._isNavigationText(title)) {
          return title;
        }
      }
    }
    return "";
  }
  /**
   * 从内容中提取番号
   */
  _extractCodeFromContent(content, href) {
    const sources = [content, href];
    const codePattern = /([A-Z]{2,6}-?\d{3,6})/i;
    for (const source of sources) {
      if (source) {
        const match = source.match(codePattern);
        if (match) {
          return match[1].toUpperCase();
        }
      }
    }
    return "";
  }
  /**
   * 从内容中提取日期
   */
  _extractDateFromContent(content) {
    const datePattern = /<date>(\d{4}-\d{2}-\d{2})<\/date>/i;
    const match = content.match(datePattern);
    return match ? match[1] : "";
  }
  /**
   * 验证是否为导航文本
   */
  _isNavigationText(text) {
    const navTexts = [
      "english",
      "\u4E2D\u6587",
      "\u65E5\u672C\u8A9E",
      "\uD55C\uAD6D\uC5B4",
      "\u6709\u78BC",
      "\u7121\u78BC",
      "\u5973\u512A",
      "\u985E\u5225",
      "\u8AD6\u58C7",
      "\u4E0B\u4E00\u9875",
      "\u4E0A\u4E00\u9875",
      "\u9996\u9875",
      "next",
      "prev",
      "page",
      "home",
      "login",
      "register",
      "terms",
      "privacy",
      "contact",
      "about",
      "help"
    ];
    const textLower = text.toLowerCase();
    return navTexts.some((navText) => textLower.includes(navText.toLowerCase())) || /^\s*\d+\s*$/.test(text);
  }
  /**
   * 验证电影链接 - 根据实际数据平衡版本
   */
  _isValidMovieLink(href, content, sourceType) {
    if (!href || typeof href !== "string") return false;
    const hrefLower = href.toLowerCase();
    const excludePatterns = [
      "/search/",
      "/page/",
      "?page=",
      "/category/",
      "/genre/",
      "/tag/",
      "/forum/",
      "/login",
      "/register",
      "/terms",
      "/privacy",
      "/help",
      "/contact",
      "/about",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".gif",
      ".ico",
      "javascript:",
      "/#"
    ];
    if (excludePatterns.some((pattern) => hrefLower.includes(pattern))) {
      return false;
    }
    switch (sourceType) {
      case "javbus":
        return this._isValidJavBusLink(href, content);
      case "javdb":
        return this._isValidJavDBLink(href, content);
      case "jable":
        return this._isValidJableLink(href, content);
      case "sukebei":
        return this._isValidSukebeiLink(href, content);
      case "javgg":
        return this._isValidJavGGLink(href, content);
      case "javmost":
        return this._isValidJavMostLink(href, content);
      case "javguru":
        return this._isValidJavGuruLink(href, content);
      default:
        return this._isValidGenericLink(href, content);
    }
  }
  /**
   * JavBus链接验证 - 根据实际数据 /IPX-156
   */
  _isValidJavBusLink(href, content) {
    const hasCode = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("javbus");
    return hasCode && isDomainOk;
  }
  /**
   * JavDB链接验证 - 根据实际数据 /v/KkZ97
   */
  _isValidJavDBLink(href, content) {
    const isDetailFormat = /\/v\/[a-zA-Z0-9]+/.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("javdb");
    const notSearchPage = !href.includes("/search") && !href.includes("/actors");
    return isDetailFormat && isDomainOk && notSearchPage;
  }
  /**
   * Jable链接验证 - 根据实际数据 /videos/ipx-156/
   */
  _isValidJableLink(href, content) {
    const isVideoFormat = /\/videos\/[^\/\?]+/.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("jable.tv");
    const notSearchPage = !href.includes("/search");
    return isVideoFormat && isDomainOk && notSearchPage;
  }
  /**
   * Sukebei链接验证 - 根据实际数据 /view/3403743
   */
  _isValidSukebeiLink(href, content) {
    const isDetailFormat = /\/view\/\d+/.test(href) || /[A-Z]{2,6}-?\d{3,6}/i.test(content);
    const isDomainOk = !href.startsWith("http") || href.includes("sukebei.nyaa.si");
    return isDetailFormat && isDomainOk;
  }
  /**
   * JavGG链接验证 - 根据实际数据 /jav/ipx-156-reduce-mosaic/
   */
  _isValidJavGGLink(href, content) {
    const isJavFormat = /\/jav\/[a-z0-9\-]+/i.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("javgg.net");
    const notSearchPage = !href.includes("/search");
    return isJavFormat && isDomainOk && notSearchPage;
  }
  /**
   * JavMost链接验证 - 根据实际数据 /IPX-156/ （支持子域名）
   */
  _isValidJavMostLink(href, content) {
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("javmost.com");
    const notSearchPage = !href.includes("/search");
    return hasCodePattern && isDomainOk && notSearchPage;
  }
  /**
   * JavGuru链接验证 - 根据实际数据 /268681/ipx-156-sana-matsunaga...
   */
  _isValidJavGuruLink(href, content) {
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(href);
    const isDomainOk = !href.startsWith("http") || href.includes("jav.guru");
    const notSearchPage = !href.includes("?s=");
    return hasDetailPattern && isDomainOk && notSearchPage;
  }
  /**
   * 通用链接验证 - 平衡版本
   */
  _isValidGenericLink(href, content) {
    if (!this._isValidUrl(href)) return false;
    const contentText = content ? content.replace(/<[^>]*>/g, "").trim() : "";
    if (contentText && this._isNavigationText(contentText)) return false;
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(href) || /[A-Z]{2,6}-?\d{3,6}/i.test(contentText)) {
      return true;
    }
    const detailPatterns = [
      /\/v\/[a-zA-Z0-9]+/,
      /\?v=[a-zA-Z0-9]+/,
      /\/videos\/[^\/]+/,
      /\/view\/\d+/,
      /\/watch\/[^\/]+/,
      /\/play\/[^\/]+/,
      /\/movie\/[^\/]+/,
      /\/jav\/[^\/]+/,
      /\/\d+\/[a-z0-9\-]+/i
    ];
    return detailPatterns.some((pattern) => pattern.test(href));
  }
  /**
   * URL格式验证
   */
  _isValidUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      if (url.startsWith("http")) {
        new URL(url);
        return true;
      } else if (url.startsWith("/")) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
  /**
   * 解析title标签
   */
  _parseTitleTag(elements) {
    const titleMatch = this.html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) {
      elements.push(new CloudflareElement("", titleMatch[1], this.html, titleMatch[0]));
    }
  }
  /**
   * 解析通用选择器
   */
  _parseGenericSelector(elements, selector) {
    console.log(`\u5904\u7406\u901A\u7528\u9009\u62E9\u5668: ${selector}`);
    if (selector.startsWith(".") && !selector.includes(" ")) {
      const className = selector.substring(1);
      const pattern = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)</[^>]*>`, "gi");
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        elements.push(new CloudflareElement("", match[1], this.html, match[0]));
      }
    } else if (/^[a-zA-Z]+$/.test(selector)) {
      const pattern = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, "gi");
      let match;
      while ((match = pattern.exec(this.html)) !== null) {
        elements.push(new CloudflareElement("", match[1], this.html, match[0]));
      }
    }
  }
  /**
   * 从URL提取域名
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
};
var CloudflareElement = class _CloudflareElement {
  static {
    __name(this, "CloudflareElement");
  }
  constructor(href, innerHTML, fullHtml, elementHtml) {
    this.href = href || "";
    this.innerHTML = innerHTML || "";
    this.fullHtml = fullHtml || "";
    this.elementHtml = elementHtml || "";
    this.titleAttribute = null;
    this._textContent = null;
    this.extractedTitle = "";
    this.extractedCode = "";
    this.extractedDate = "";
  }
  getAttribute(attr) {
    if (attr === "href") {
      return this.href;
    }
    if (attr === "title") {
      if (this.extractedTitle) return this.extractedTitle;
      if (this.titleAttribute) return this.titleAttribute;
      const titleMatch = this.elementHtml.match(/title="([^"]+)"/i);
      if (titleMatch) return titleMatch[1];
      const imgTitleMatch = this.innerHTML.match(/<img[^>]*title="([^"]+)"/i);
      if (imgTitleMatch) return imgTitleMatch[1];
      const altMatch = this.innerHTML.match(/<img[^>]*alt="([^"]+)"/i);
      if (altMatch) return altMatch[1];
      return null;
    }
    if (attr === "onclick") {
      const onclickMatch = this.elementHtml.match(/onclick="([^"]+)"/i);
      return onclickMatch ? onclickMatch[1] : null;
    }
    if (attr === "class") {
      const classMatch = this.elementHtml.match(/class="([^"]+)"/i);
      return classMatch ? classMatch[1] : null;
    }
    const attrRegex = new RegExp(`${attr}="([^"]+)"`, "i");
    const match = this.elementHtml.match(attrRegex);
    return match ? match[1] : null;
  }
  get textContent() {
    if (this._textContent !== null) {
      return this._textContent;
    }
    this._textContent = this.innerHTML.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
    return this._textContent;
  }
  querySelector(selector) {
    const elements = this.querySelectorAll(selector);
    return elements.length > 0 ? elements[0] : null;
  }
  querySelectorAll(selector) {
    const elements = [];
    if (selector.includes(".title")) {
      this._findTitleElements(elements);
    } else if (selector.includes(".video-number") || selector.includes(".uid")) {
      this._findCodeElements(elements);
    } else if (selector === "img") {
      this._findImageElements(elements);
    } else if (selector.startsWith(".")) {
      this._findElementsByClass(elements, selector.substring(1));
    } else if (/^[a-zA-Z]+$/.test(selector)) {
      this._findElementsByTag(elements, selector);
    }
    return elements;
  }
  _findTitleElements(elements) {
    const patterns = [
      /<[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi,
      /<[^>]*class="[^"]*video-title[^"]*"[^>]*>(.*?)<\/[^>]*>/gi
    ];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(this.innerHTML)) !== null) {
        elements.push(new _CloudflareElement("", match[1], this.fullHtml, match[0]));
      }
    });
  }
  _findCodeElements(elements) {
    const patterns = [
      /<[^>]*class="[^"]*video-number[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<[^>]*class="[^"]*uid[^"]*"[^>]*>(.*?)<\/[^>]*>/gi,
      /<span[^>]*>(.*?)<\/span>/gi,
      /<strong[^>]*>(.*?)<\/strong>/gi
    ];
    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(this.innerHTML)) !== null) {
        const content = match[1].trim();
        if (/[A-Z]{2,6}-?\d{3,6}/i.test(content)) {
          elements.push(new _CloudflareElement("", content, this.fullHtml, match[0]));
        }
      }
    });
  }
  _findImageElements(elements) {
    const regex = /<img[^>]*>/gi;
    let match;
    while ((match = regex.exec(this.innerHTML)) !== null) {
      const imgElement = new _CloudflareElement("", "", this.fullHtml, match[0]);
      elements.push(imgElement);
    }
  }
  _findElementsByClass(elements, className) {
    const pattern = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)</[^>]*>`, "gi");
    let match;
    while ((match = pattern.exec(this.innerHTML)) !== null) {
      elements.push(new _CloudflareElement("", match[1], this.fullHtml, match[0]));
    }
  }
  _findElementsByTag(elements, tagName) {
    const pattern = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, "gi");
    let match;
    while ((match = pattern.exec(this.innerHTML)) !== null) {
      elements.push(new _CloudflareElement("", match[1], this.fullHtml, match[0]));
    }
  }
  closest(selector) {
    return null;
  }
};
var cloudflareHTMLParser = new CloudflareHTMLParser();

// src/services/extraction-validator.js
var ExtractionValidatorService = class {
  static {
    __name(this, "ExtractionValidatorService");
  }
  constructor() {
    this.sourcePatterns = {
      "javbus": /javbus\.com/,
      "javdb": /javdb\.com/,
      "jable": /jable\.tv/,
      "javgg": /javgg\.net/,
      "javmost": /javmost\.com/,
      "sukebei": /sukebei\.nyaa\.si/,
      "javguru": /jav\.guru/
    };
  }
  // ==================== 源检测方法 ====================
  /**
   * 检测源类型 - 根据实际搜索数据优化
   * @param {string} url - URL
   * @param {string} sourceId - 源ID
   * @returns {string} 源类型
   */
  detectSourceType(url, sourceId) {
    const urlLower = url.toLowerCase();
    for (const [type, pattern] of Object.entries(this.sourcePatterns)) {
      if (pattern.test(urlLower)) {
        return type;
      }
    }
    if (sourceId) return sourceId;
    return "generic";
  }
  /**
   * 从URL推断可能的源类型
   * @param {string} url - URL
   * @returns {string} 推断的源类型
   */
  inferSourceTypeFromUrl(url) {
    return this.detectSourceType(url);
  }
  // ==================== URL验证方法 ====================
  /**
   * 检查URL是否为详情页面 - 根据实际数据增强版本
   * @param {string} url - URL
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为详情页
   */
  isDetailPageUrl(url, sourceType, expectedDomain) {
    if (!url || typeof url !== "string") return false;
    const urlLower = url.toLowerCase();
    const urlDomain = this.extractDomain(url);
    if (url.startsWith("http") && expectedDomain && !this.isDomainOrSubdomainMatch(urlDomain, expectedDomain)) {
      return false;
    }
    if (this.containsSearchIndicators(url)) {
      return false;
    }
    switch (sourceType) {
      case "javbus":
        return this.isJavBusDetailPage(url);
      case "javdb":
        return this.isJavDBDetailPage(url);
      case "jable":
        return this.isJableDetailPage(url);
      case "javgg":
        return this.isJavGGDetailPage(url);
      case "javmost":
        return this.isJavMostDetailPage(url);
      case "sukebei":
        return this.isSukebeiDetailPage(url);
      case "javguru":
        return this.isJavGuruDetailPage(url);
      default:
        return this.isGenericDetailPage(url);
    }
  }
  /**
   * 验证详情页面URL - 新增方法
   * @param {string} detailUrl - 详情页面URL
   * @param {string} searchUrl - 搜索URL
   * @param {string} sourceType - 源类型
   * @returns {boolean} 是否为有效的详情页面URL
   */
  validateDetailPageUrl(detailUrl, searchUrl, sourceType) {
    console.log(`=== \u9A8C\u8BC1\u8BE6\u60C5\u9875\u9762URL ===`);
    console.log(`\u8BE6\u60C5URL: ${detailUrl}`);
    console.log(`\u641C\u7D22URL: ${searchUrl}`);
    if (!detailUrl || typeof detailUrl !== "string") {
      console.log(`\u2310 \u8BE6\u60C5URL\u65E0\u6548`);
      return false;
    }
    if (this.normalizeUrl(detailUrl) === this.normalizeUrl(searchUrl)) {
      console.log(`\u2310 \u8BE6\u60C5URL\u4E0E\u641C\u7D22URL\u76F8\u540C`);
      return false;
    }
    const detailDomain = this.extractDomain(detailUrl);
    const searchDomain = this.extractDomain(searchUrl);
    if (!this.isDomainOrSubdomainMatch(detailDomain, searchDomain)) {
      console.log(`\u2310 \u57DF\u540D\u4E0D\u4E00\u81F4: ${detailDomain} != ${searchDomain}`);
      return false;
    }
    if (!this.isDetailPageUrl(detailUrl, sourceType, searchDomain)) {
      console.log(`\u2310 \u4E0D\u662F\u6709\u6548\u7684\u8BE6\u60C5\u9875\u9762\u683C\u5F0F`);
      return false;
    }
    console.log(`\u2705 \u8BE6\u60C5\u9875\u9762URL\u9A8C\u8BC1\u901A\u8FC7`);
    return true;
  }
  /**
   * 检查URL是否包含搜索指示器 - 新增方法
   * @param {string} url - URL
   * @returns {boolean} 是否包含搜索指示器
   */
  containsSearchIndicators(url) {
    const urlLower = url.toLowerCase();
    return SEARCH_EXCLUDE_PATTERNS.some((indicator) => urlLower.includes(indicator));
  }
  // ==================== 源特定的详情页验证方法 ====================
  /**
   * JavBus详情页面验证 - 根据实际数据 /IPX-156
   */
  isJavBusDetailPage(url) {
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes("/search");
    const notGenrePage = !url.toLowerCase().includes("/genre/");
    const notActressPage = !url.toLowerCase().includes("/actresses/");
    return hasCodePattern && notSearchPage && notGenrePage && notActressPage;
  }
  /**
   * JavDB详情页面验证 - 根据实际数据 /v/KkZ97
   */
  isJavDBDetailPage(url) {
    const hasVideoPattern = /\/v\/[a-zA-Z0-9]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes("/search");
    return hasVideoPattern && notSearchPage;
  }
  /**
   * Jable详情页面验证 - 根据实际数据 /videos/ipx-156/
   */
  isJableDetailPage(url) {
    const hasVideoPath = /\/videos\/[^\/\?]+/.test(url);
    const notSearchPage = !url.toLowerCase().includes("/search");
    return hasVideoPath && notSearchPage;
  }
  /**
   * JavGG详情页面验证 - 根据实际数据 /jav/ipx-156-reduce-mosaic/
   */
  isJavGGDetailPage(url) {
    const hasJavPath = /\/jav\/[a-z0-9\-]+/i.test(url);
    const notSearchPage = !url.toLowerCase().includes("/search");
    return hasJavPath && notSearchPage;
  }
  /**
   * JavMost详情页面验证 - 根据实际数据 /IPX-156/ （注意子域名）
   */
  isJavMostDetailPage(url) {
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(url);
    const notSearchPage = !url.toLowerCase().includes("/search");
    return hasCodePattern && notSearchPage;
  }
  /**
   * Sukebei详情页面验证 - 根据实际数据 /view/3403743
   */
  isSukebeiDetailPage(url) {
    const hasViewPattern = /\/view\/\d+/.test(url);
    return hasViewPattern;
  }
  /**
   * JavGuru详情页面验证 - 根据实际数据 /268681/ipx-156-sana-matsunaga...
   */
  isJavGuruDetailPage(url) {
    const notSearchPage = !url.toLowerCase().includes("?s=");
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(url);
    return notSearchPage && hasDetailPattern;
  }
  /**
   * 通用详情页面验证
   */
  isGenericDetailPage(url) {
    const urlLower = url.toLowerCase();
    const detailIndicators = [
      "/video/",
      "/watch/",
      "/play/",
      "/view/",
      "/detail/",
      "/movie/",
      "/film/",
      "/content/",
      "/jav/"
    ];
    const hasDetailIndicator = detailIndicators.some(
      (indicator) => urlLower.includes(indicator)
    );
    const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(url);
    return hasDetailIndicator || hasCodePattern;
  }
  // ==================== 域名处理方法 ====================
  /**
   * 提取域名 - 工具方法
   * @param {string} url - URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  /**
   * 检查域名是否匹配 - 简单版本
   * @param {string} url - 要检查的URL
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 域名是否匹配
   */
  isDomainMatch(url, expectedDomain) {
    if (!url || !expectedDomain) return false;
    try {
      const urlDomain = new URL(url).hostname.toLowerCase();
      return urlDomain === expectedDomain.toLowerCase();
    } catch {
      return false;
    }
  }
  /**
   * 检查域名或子域名是否匹配 - 增强版本，支持子域名
   * @param {string} linkDomain - 链接域名
   * @param {string} expectedDomain - 期望域名
   * @returns {boolean} 是否匹配
   */
  isDomainOrSubdomainMatch(linkDomain, expectedDomain) {
    if (!linkDomain || !expectedDomain) return false;
    const linkDomainLower = linkDomain.toLowerCase();
    const expectedDomainLower = expectedDomain.toLowerCase();
    if (linkDomainLower === expectedDomainLower) return true;
    if (linkDomainLower.endsWith("." + expectedDomainLower)) return true;
    return false;
  }
  /**
   * 检查是否为子域名 - 工具方法
   * @param {string} linkDomain - 链接域名
   * @param {string} baseDomain - 基础域名
   * @returns {boolean} 是否为子域名
   */
  isDomainOrSubdomain(linkDomain, baseDomain) {
    if (!linkDomain || !baseDomain) return false;
    const linkDomainLower = linkDomain.toLowerCase();
    const baseDomainLower = baseDomain.toLowerCase();
    if (linkDomainLower === baseDomainLower) return true;
    if (linkDomainLower.endsWith("." + baseDomainLower)) return true;
    return false;
  }
  /**
   * 标准化URL - 工具方法
   * @param {string} url - URL
   * @returns {string} 标准化的URL
   */
  normalizeUrl(url) {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      let normalized = urlObj.origin + urlObj.pathname;
      if (normalized.endsWith("/") && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
  // ==================== URL处理工具方法 ====================
  /**
   * 解析相对URL为绝对URL
   * @param {string} relativeUrl - 相对URL
   * @param {string} baseUrl - 基础URL
   * @returns {string} 绝对URL
   */
  resolveRelativeUrl(relativeUrl, baseUrl) {
    if (!relativeUrl) return "";
    if (relativeUrl.startsWith("http")) return relativeUrl;
    try {
      const base = new URL(baseUrl);
      const resolved = new URL(relativeUrl, base);
      return resolved.href;
    } catch (error) {
      console.warn("URL\u89E3\u6790\u5931\u8D25:", error.message);
      return relativeUrl;
    }
  }
  /**
   * 验证URL格式
   * @param {string} url - URL
   * @returns {boolean} 是否为有效URL
   */
  validateImageUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }
  // ==================== 文本处理工具方法 ====================
  /**
   * 从文本中提取番号 - 使用优化的正则表达式
   * @param {string} text - 文本
   * @returns {string} 番号
   */
  extractCodeFromText(text) {
    if (!text) return "";
    const match = text.match(CODE_PATTERNS.combined);
    if (match) {
      return match[1].toUpperCase();
    }
    return "";
  }
  /**
   * 从标题中提取番号
   * @param {string} title - 标题
   * @returns {string} 番号
   */
  extractCodeFromTitle(title) {
    return this.extractCodeFromText(title);
  }
  /**
   * 从URL中提取番号
   * @param {string} url - URL
   * @returns {string} 番号
   */
  extractCodeFromUrl(url) {
    if (!url) return "";
    const patterns = [
      /\/([A-Z]{2,6}-?\d{3,6})(?:\/|$|-)/i,
      // 路径中的番号
      /[?&].*?([A-Z]{2,6}-?\d{3,6})/i
      // 查询参数中的番号
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1].toUpperCase();
      }
    }
    return "";
  }
  /**
   * 计算文本相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度 (0-1)
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const normalize = /* @__PURE__ */ __name((str) => str.toLowerCase().replace(/[^\w\d]/g, ""), "normalize");
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    if (norm1 === norm2) return 1;
    const words1 = norm1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = norm2.split(/\s+/).filter((w) => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;
    const intersection = words1.filter((word) => words2.includes(word));
    const union = [.../* @__PURE__ */ new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }
  // ==================== 数据验证工具方法 ====================
  /**
   * 验证日期格式
   * @param {string} dateStr - 日期字符串
   * @returns {string} 验证后的日期字符串
   */
  validateDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  }
  /**
   * 验证磁力链接
   * @param {Array} magnetLinks - 磁力链接数组
   * @returns {Array} 验证后的磁力链接数组
   */
  validateMagnetLinks(magnetLinks) {
    if (!Array.isArray(magnetLinks)) return [];
    return magnetLinks.filter((link) => {
      if (!link || typeof link !== "object") return false;
      return link.magnet && link.magnet.startsWith("magnet:?xt=urn:btih:");
    }).map((link) => ({
      name: link.name || "\u78C1\u529B\u94FE\u63A5",
      magnet: link.magnet,
      size: link.size || "",
      seeders: link.seeders || 0,
      leechers: link.leechers || 0,
      quality: link.quality || "",
      addedDate: link.addedDate || ""
    }));
  }
  /**
   * 验证评分
   * @param {any} rating - 评分
   * @returns {number} 验证后的评分
   */
  validateRating(rating) {
    if (rating === null || rating === void 0) return 0;
    const numRating = parseFloat(rating);
    if (isNaN(numRating)) return 0;
    return Math.max(0, Math.min(10, numRating));
  }
  // ==================== 高级验证方法 ====================
  /**
   * 验证和过滤下载链接 - 根据实际垃圾链接增强版本
   * @param {Array} links - 下载链接数组
   * @param {string} expectedDomain - 期望的域名
   * @returns {Array} 过滤后的链接数组
   */
  validateAndFilterDownloadLinks(links, expectedDomain) {
    if (!Array.isArray(links)) return [];
    return links.filter((link) => {
      if (!link || typeof link !== "object") return false;
      if (!link.url || !this.validateImageUrl(link.url)) return false;
      if (link.url.startsWith("http")) {
        const linkDomain = this.extractDomain(link.url);
        if (!this.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
          console.log(`\u2310 \u8FC7\u6EE4\u4E0D\u540C\u57DF\u540D\u7684\u4E0B\u8F7D\u94FE\u63A5: ${link.url} (${linkDomain} != ${expectedDomain})`);
          return false;
        }
      }
      const urlLower = link.url.toLowerCase();
      if (SPAM_DOMAINS.some((domain) => urlLower.includes(domain))) {
        console.log(`\u2310 \u8FC7\u6EE4\u5783\u573E\u57DF\u540D\u94FE\u63A5: ${link.url}`);
        return false;
      }
      const nameLower = (link.name || "").toLowerCase();
      if (NAVIGATION_TEXTS.some((text) => nameLower.includes(text.toLowerCase()))) {
        console.log(`\u2310 \u8FC7\u6EE4\u5BFC\u822A\u6587\u672C\u94FE\u63A5: ${link.name}`);
        return false;
      }
      return true;
    }).map((link) => ({
      name: link.name || "\u4E0B\u8F7D\u94FE\u63A5",
      url: link.url,
      type: link.type || "unknown",
      size: link.size || "",
      quality: link.quality || ""
    }));
  }
  /**
   * 检查链接是否为高质量详情URL
   * @param {string} url - URL
   * @param {string} source - 源
   * @returns {boolean} 是否为高质量URL
   */
  isHighQualityDetailUrl(url, source) {
    const urlLower = url.toLowerCase();
    if (/[A-Z]{2,6}-?\d{3,6}/i.test(url)) return true;
    const sourceType = this.detectSourceType(url, source);
    const patterns = DETAIL_URL_PATTERNS[sourceType];
    if (patterns) {
      return patterns.some((pattern) => pattern.test(url));
    }
    return false;
  }
  /**
   * 增强版匹配分数计算
   * @param {Object} link - 链接对象
   * @param {Object} searchResult - 搜索结果
   * @param {string} searchKeyword - 搜索关键词
   * @returns {number} 增强后的匹配分数
   */
  calculateEnhancedMatchScore(link, searchResult2, searchKeyword) {
    let score = link.score || 0;
    if (searchKeyword && link.code) {
      if (searchKeyword.toLowerCase() === link.code.toLowerCase()) {
        score += 40;
      } else if (link.code.toLowerCase().includes(searchKeyword.toLowerCase()) || searchKeyword.toLowerCase().includes(link.code.toLowerCase())) {
        score += 25;
      }
    }
    if (searchResult2.title && link.title) {
      const titleSimilarity = this.calculateTextSimilarity(
        searchResult2.title.toLowerCase(),
        link.title.toLowerCase()
      );
      score += titleSimilarity * 15;
    }
    if (this.isHighQualityDetailUrl(link.url, searchResult2.source)) {
      score += 10;
    }
    if (link.extractedFrom === "javbus_moviebox" || link.extractedFrom === "javdb_video" || link.extractedFrom === "javgg_video" || link.extractedFrom === "jable_video" || link.extractedFrom === "javmost_video" || link.extractedFrom === "sukebei_torrent" || link.extractedFrom === "javguru_video") {
      score += 15;
    }
    return Math.min(100, Math.max(0, score));
  }
  // ==================== 搜索结果验证 ====================
  /**
   * 验证搜索结果链接有效性 - 严格版本
   * @param {string} href - 链接地址
   * @param {string} content - 链接内容
   * @param {string} sourceType - 源类型
   * @param {string} expectedDomain - 期望的域名
   * @returns {boolean} 是否为有效搜索结果链接
   */
  isValidSearchResultLink(href, content, sourceType, expectedDomain) {
    if (!href || typeof href !== "string") return false;
    const hrefLower = href.toLowerCase();
    const contentLower = (content || "").toLowerCase();
    if (SEARCH_EXCLUDE_PATTERNS.some((pattern) => hrefLower.includes(pattern))) {
      return false;
    }
    if (NAVIGATION_TEXTS.some((text) => contentLower.includes(text.toLowerCase()))) {
      return false;
    }
    if (/^\s*\d+\s*$/.test(content)) {
      return false;
    }
    if (expectedDomain) {
      const linkDomain = this.extractDomain(href);
      if (!this.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
        if (SPAM_DOMAINS.some((domain) => linkDomain.includes(domain))) {
          console.log(`\u2310 \u68C0\u6D4B\u5230\u5783\u573E\u57DF\u540D: ${linkDomain}`);
          return false;
        }
        console.log(`\u2310 \u57DF\u540D\u4E0D\u5339\u914D: ${linkDomain} != ${expectedDomain}`);
        return false;
      }
    }
    switch (sourceType?.toLowerCase()) {
      case "javbus":
        return this.isValidJavBusSearchLink(href, content);
      case "javdb":
        return this.isValidJavDBSearchLink(href, content);
      case "jable":
        return this.isValidJableSearchLink(href, content);
      case "javgg":
        return this.isValidJavGGSearchLink(href, content);
      case "javmost":
        return this.isValidJavMostSearchLink(href, content);
      case "sukebei":
        return this.isValidSukebeiSearchLink(href, content);
      case "javguru":
        return this.isValidJavGuruSearchLink(href, content);
      default:
        return this.isValidGenericSearchLink(href, content);
    }
  }
  /**
   * JavBus搜索链接验证 - 根据实际数据
   */
  isValidJavBusSearchLink(href, content) {
    if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(href)) return false;
    if (href.toLowerCase().includes("/search")) return false;
    return true;
  }
  /**
   * JavDB搜索链接验证 - 根据实际数据
   */
  isValidJavDBSearchLink(href, content) {
    if (/\/v\/[a-zA-Z0-9]+/.test(href)) return true;
    if (href.toLowerCase().includes("/search")) return false;
    return false;
  }
  /**
   * Jable搜索链接验证 - 根据实际数据，严格版本
   */
  isValidJableSearchLink(href, content) {
    if (!/\/videos\/[^\/]+/.test(href)) return false;
    const domain = this.extractDomain(href);
    if (domain !== "jable.tv") {
      console.log(`\u2310 Jable\u94FE\u63A5\u57DF\u540D\u9519\u8BEF: ${domain}`);
      return false;
    }
    return true;
  }
  /**
   * JavGG搜索链接验证 - 根据实际数据
   */
  isValidJavGGSearchLink(href, content) {
    if (!/\/jav\/[a-z0-9\-]+/i.test(href)) return false;
    const domain = this.extractDomain(href);
    const allowedDomains = ["javgg.net"];
    return allowedDomains.some((allowed) => domain === allowed || domain.endsWith("." + allowed));
  }
  /**
   * JavMost搜索链接验证 - 支持子域名
   */
  isValidJavMostSearchLink(href, content) {
    if (!/\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(href)) return false;
    const domain = this.extractDomain(href);
    return this.isDomainOrSubdomain(domain, "javmost.com");
  }
  /**
   * Sukebei搜索链接验证 - 根据实际数据
   */
  isValidSukebeiSearchLink(href, content) {
    if (/\/view\/\d+/.test(href)) return true;
    return /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }
  /**
   * JavGuru搜索链接验证 - 根据实际数据
   */
  isValidJavGuruSearchLink(href, content) {
    const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(href);
    const notSearchPage = !href.toLowerCase().includes("?s=");
    return hasDetailPattern && notSearchPage;
  }
  /**
   * 通用搜索链接验证
   */
  isValidGenericSearchLink(href, content) {
    const detailPatterns = DETAIL_URL_PATTERNS;
    const allPatterns = Object.values(detailPatterns).flat();
    return allPatterns.some((pattern) => pattern.test(href)) || /[A-Z]{2,6}-?\d{3,6}/i.test(content);
  }
};
var extractionValidator = new ExtractionValidatorService();

// src/services/search-link-extractor.js
var SearchLinkExtractorService = class {
  static {
    __name(this, "SearchLinkExtractorService");
  }
  constructor() {
    this.parseTimeout = CONFIG.DETAIL_EXTRACTION.PARSE_TIMEOUT;
    this.maxRetries = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS;
  }
  /**
   * 从搜索页面中提取详情页链接 - 根据实际数据优化版本
   * @param {string} htmlContent - 搜索页面HTML内容
   * @param {Object} options - 解析选项
   * @returns {Array} 详情页链接数组
   */
  async extractDetailLinksFromSearchPage(htmlContent, options = {}) {
    const { sourceType, baseUrl, searchKeyword } = options;
    console.log(`=== \u5F00\u59CB\u63D0\u53D6\u8BE6\u60C5\u94FE\u63A5 (\u6839\u636E\u5B9E\u9645\u6570\u636E\u4F18\u5316) ===`);
    try {
      const doc = cloudflareHTMLParser.parseFromString(htmlContent);
      const baseDomain = extractionValidator.extractDomain(baseUrl);
      console.log(`\u57FA\u7840\u57DF\u540D: ${baseDomain}`);
      switch (sourceType) {
        case "javbus":
          return this.extractJavBusDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "javdb":
          return this.extractJavDBDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "jable":
          return this.extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "javgg":
          return this.extractJavGGDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "javmost":
          return this.extractJavMostDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "sukebei":
          return this.extractSukebeiDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        case "javguru":
          return this.extractJavGuruDetailLinks(doc, baseUrl, searchKeyword, baseDomain);
        default:
          return this.extractWithGenericRules(doc, baseUrl, searchKeyword, baseDomain, sourceType);
      }
    } catch (error) {
      console.error("=== \u8BE6\u60C5\u94FE\u63A5\u63D0\u53D6\u5931\u8D25 ===");
      console.error("\u9519\u8BEF\u4FE1\u606F:", error.message);
      console.error("\u9519\u8BEF\u5806\u6808:", error.stack);
      return [];
    }
  }
  /**
   * JavBus专用详情链接提取 - 根据实际数据 /IPX-156
   */
  extractJavBusDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const movieBoxes = doc.querySelectorAll(".movie-box");
      movieBoxes.forEach((box, index) => {
        const link = box.querySelector("a[href]") || box;
        if (!link) return;
        const href = link.getAttribute("href");
        if (!href || href === "#" || href.startsWith("javascript")) return;
        const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
        if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) {
          return;
        }
        if (!/\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl)) {
          return;
        }
        if (extractionValidator.containsSearchIndicators(fullUrl)) {
          return;
        }
        if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
          return;
        }
        const img = box.querySelector("img");
        const title = img ? img.getAttribute("title") || img.getAttribute("alt") || "" : "";
        const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
        const score = this.calculateMatchScore(title, code, searchKeyword);
        console.log(`\u627E\u5230JavBus\u8BE6\u60C5: ${fullUrl}`);
        detailLinks.push({
          url: fullUrl,
          title: title || "\u672A\u77E5\u6807\u9898",
          code: code || "",
          score,
          extractedFrom: "javbus_moviebox"
        });
      });
      if (detailLinks.length === 0) {
        console.log("movie-box\u65B9\u5F0F\u672A\u627E\u5230\uFF0C\u5C1D\u8BD5\u76F4\u63A5\u94FE\u63A5\u65B9\u5F0F");
        const directLinks = doc.querySelectorAll('a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])');
        directLinks.forEach((link) => {
          const href = link.getAttribute("href");
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          if (extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain) && /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i.test(fullUrl) && !extractionValidator.containsSearchIndicators(fullUrl) && extractionValidator.normalizeUrl(fullUrl) !== extractionValidator.normalizeUrl(baseUrl)) {
            const title = link.textContent?.trim() || link.getAttribute("title") || "";
            const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
            const score = this.calculateMatchScore(title, code, searchKeyword);
            detailLinks.push({
              url: fullUrl,
              title: title || "\u672A\u77E5\u6807\u9898",
              code: code || "",
              score,
              extractedFrom: "javbus_direct"
            });
          }
        });
      }
    } catch (error) {
      console.error("JavBus\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`JavBus\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * JavDB专用详情链接提取 - 根据实际数据 /v/KkZ97
   */
  extractJavDBDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const videoSelectors = [
        ".movie-list .item a",
        ".grid-item a",
        ".video-node a",
        'a[href*="/v/"]'
      ];
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) {
            return;
          }
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            return;
          }
          if (!/\/v\/[a-zA-Z0-9]+/.test(href)) {
            return;
          }
          if (extractionValidator.containsSearchIndicators(fullUrl)) {
            return;
          }
          const titleElement = link.querySelector(".video-title, .title, h4") || link;
          const title = titleElement.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "javdb_video"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("JavDB\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`JavDB\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * Jable专用详情链接提取 - 根据实际数据 /videos/ipx-156/
   */
  extractJableDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const videoSelectors = [
        '.video-item a[href*="/videos/"]',
        '.list-videos a[href*="/videos/"]',
        'a[href*="/videos/"]:not([href*="/search"])'
      ];
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          const linkDomain = extractionValidator.extractDomain(fullUrl);
          if (linkDomain !== "jable.tv") {
            return;
          }
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (!/\/videos\/[^\/\?]+/.test(fullUrl)) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          const titleElement = link.querySelector(".title, h4, .video-title") || link;
          const title = titleElement.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "jable_video"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("Jable\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`Jable\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * JavGG专用详情链接提取 - 根据实际数据 /jav/ipx-156-reduce-mosaic/
   */
  extractJavGGDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const videoSelectors = [
        '.video-item a[href*="/jav/"]',
        '.movie-item a[href*="/jav/"]',
        'a[href*="/jav/"]:not([href*="/search"])'
      ];
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) {
            return;
          }
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
            return;
          }
          if (!/\/jav\/[a-z0-9\-]+/i.test(fullUrl)) {
            return;
          }
          if (extractionValidator.containsSearchIndicators(fullUrl)) {
            return;
          }
          const titleElement = link.querySelector(".title, h3, .video-title") || link;
          const title = titleElement.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          console.log(`\u627E\u5230JavGG\u8BE6\u60C5: ${fullUrl}`);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "javgg_video"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("JavGG\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`JavGG\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * JavMost专用详情链接提取 - 根据实际数据 /IPX-156/ （支持子域名）
   */
  extractJavMostDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const videoSelectors = [
        ".video-item a",
        ".movie-item a",
        'a[href*="/"][href]:not([href*="/search"])'
      ];
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          const linkDomain = extractionValidator.extractDomain(fullUrl);
          if (!extractionValidator.isDomainOrSubdomain(linkDomain, "javmost.com")) {
            return;
          }
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          const hasCodePattern = /\/[A-Z]{2,6}-?\d{3,6}[^\/]*(?:\/|$)/i.test(fullUrl);
          if (!hasCodePattern) return;
          const title = link.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "javmost_video"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("JavMost\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`JavMost\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * Sukebei专用详情链接提取 - 根据实际数据 /view/3403743
   */
  extractSukebeiDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const torrentSelectors = [
        "tr td:first-child a",
        ".torrent-name a",
        'a[href*="/view/"]'
      ];
      for (const selector of torrentSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) return;
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (!/\/view\/\d+/.test(fullUrl)) return;
          const title = link.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "sukebei_torrent"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("Sukebei\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`Sukebei\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * JavGuru专用详情链接提取 - 根据实际数据 /268681/ipx-156-sana-matsunaga...
   */
  extractJavGuruDetailLinks(doc, baseUrl, searchKeyword, baseDomain) {
    const detailLinks = [];
    try {
      const videoSelectors = [
        ".video-item a",
        ".movie-item a",
        'a[href]:not([href*="?s="])',
        'a[href*="/"][href]:not([href*="/search"])'
      ];
      for (const selector of videoSelectors) {
        const links = doc.querySelectorAll(selector);
        console.log(`\u9009\u62E9\u5668 ${selector} \u627E\u5230 ${links.length} \u4E2A\u94FE\u63A5`);
        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (!href) return;
          const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
          if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) return;
          if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) return;
          if (extractionValidator.containsSearchIndicators(fullUrl)) return;
          const hasDetailPattern = /\/\d+\/[a-z0-9\-]+/i.test(fullUrl);
          if (!hasDetailPattern) return;
          const title = link.textContent?.trim() || link.getAttribute("title") || "";
          const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
          const score = this.calculateMatchScore(title, code, searchKeyword);
          detailLinks.push({
            url: fullUrl,
            title: title || "\u672A\u77E5\u6807\u9898",
            code: code || "",
            score,
            extractedFrom: "javguru_video"
          });
        });
        if (detailLinks.length > 0) break;
      }
    } catch (error) {
      console.error("JavGuru\u4E13\u7528\u63D0\u53D6\u5931\u8D25:", error);
    }
    const uniqueLinks = this.removeDuplicateLinks(detailLinks);
    uniqueLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`JavGuru\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${uniqueLinks.length} \u4E2A\u6709\u6548\u94FE\u63A5`);
    return uniqueLinks;
  }
  /**
   * 使用通用规则提取详情链接 - 优化版本
   */
  extractWithGenericRules(doc, baseUrl, searchKeyword, baseDomain, sourceType) {
    console.log("=== \u4F7F\u7528\u901A\u7528\u89C4\u5219\u63D0\u53D6\u8BE6\u60C5\u94FE\u63A5 ===");
    const detailLinks = [];
    const maxGenericLinks = CONFIG.DETAIL_EXTRACTION.MAX_GENERIC_LINKS_PER_PAGE;
    try {
      const searchPageRules = parserRules.getSearchPageRules(sourceType);
      if (searchPageRules && searchPageRules.detailLinkSelectors) {
        console.log("\u4F7F\u7528\u914D\u7F6E\u7684\u89E3\u6790\u89C4\u5219");
        for (const selectorConfig of searchPageRules.detailLinkSelectors) {
          const links = doc.querySelectorAll(selectorConfig.selector);
          for (const linkElement of links) {
            let href = linkElement.getAttribute("href");
            if (!href || href === "javascript:;" || href.startsWith("javascript")) {
              const onclick = linkElement.getAttribute("onclick");
              if (onclick) {
                let match = onclick.match(/window\.open\(['"]([^'"]+)['"]/);
                if (!match) {
                  match = onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
                }
                if (match && match[1]) {
                  href = match[1];
                }
              }
            }
            if (!href) continue;
            const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
            const isValid = this.isValidDetailLink(fullUrl, selectorConfig, sourceType, baseDomain, baseUrl);
            if (!isValid) continue;
            const linkInfo = this.extractLinkInfo(linkElement, selectorConfig, searchKeyword);
            if (linkInfo) {
              const detailLink = {
                url: fullUrl,
                ...linkInfo
              };
              detailLinks.push(detailLink);
              console.log(`\u2705 \u6210\u529F\u6DFB\u52A0\u8BE6\u60C5\u94FE\u63A5: ${fullUrl}`);
            }
          }
          if (detailLinks.length > 0) {
            console.log(`\u4F7F\u7528\u9009\u62E9\u5668 ${selectorConfig.selector} \u627E\u5230 ${detailLinks.length} \u4E2A\u8BE6\u60C5\u94FE\u63A5`);
            break;
          }
        }
      }
      if (detailLinks.length === 0) {
        console.log("\u4F7F\u7528\u901A\u7528\u9009\u62E9\u5668\u63D0\u53D6\u8BE6\u60C5\u94FE\u63A5");
        const genericSelectors = [
          // 优先查找包含番号的链接
          'a[href*="/"][href]:not([href*="/search"]):not([href*="/page"])',
          // 然后查找带标题的链接
          'a[href*="/"][title]:not([href*="/search"])',
          // 最后查找容器内的链接
          ".item a, .movie a, .video a, .result a"
        ];
        for (const selector of genericSelectors) {
          console.log(`\u5C1D\u8BD5\u901A\u7528\u9009\u62E9\u5668: ${selector}`);
          const links = doc.querySelectorAll(selector);
          console.log(`\u627E\u5230 ${links.length} \u4E2A\u5019\u9009\u94FE\u63A5`);
          let processedCount = 0;
          for (const link of links) {
            if (processedCount >= maxGenericLinks) {
              console.log(`\u5DF2\u8FBE\u5230\u901A\u7528\u94FE\u63A5\u5904\u7406\u9650\u5236 (${maxGenericLinks})\uFF0C\u505C\u6B62\u5904\u7406`);
              break;
            }
            const href = link.getAttribute("href");
            if (!href) continue;
            const fullUrl = extractionValidator.resolveRelativeUrl(href, baseUrl);
            if (!extractionValidator.isDomainOrSubdomainMatch(extractionValidator.extractDomain(fullUrl), baseDomain)) {
              continue;
            }
            if (extractionValidator.normalizeUrl(fullUrl) === extractionValidator.normalizeUrl(baseUrl)) {
              continue;
            }
            if (!this.isGenericDetailLink(fullUrl)) {
              continue;
            }
            const title = link.getAttribute("title") || link.textContent?.trim() || "";
            const code = extractionValidator.extractCodeFromText(title) || extractionValidator.extractCodeFromText(fullUrl);
            if (searchKeyword) {
              const score = this.calculateMatchScore(title, code, searchKeyword);
              if (score < 20) {
                continue;
              }
            }
            detailLinks.push({
              url: fullUrl,
              title: title || "\u672A\u77E5\u6807\u9898",
              code: code || "",
              score: searchKeyword ? this.calculateMatchScore(title, code, searchKeyword) : 50,
              extractedFrom: "generic"
            });
            processedCount++;
          }
          if (detailLinks.length > 0) break;
        }
        detailLinks.sort((a, b) => (b.score || 0) - (a.score || 0));
      }
    } catch (error) {
      console.error("\u901A\u7528\u89C4\u5219\u63D0\u53D6\u8BE6\u60C5\u94FE\u63A5\u5931\u8D25:", error);
    }
    console.log(`\u901A\u7528\u89C4\u5219\u63D0\u53D6\u5B8C\u6210\uFF0C\u627E\u5230 ${detailLinks.length} \u4E2A\u94FE\u63A5 (\u9650\u5236: ${maxGenericLinks})`);
    return detailLinks;
  }
  /**
   * 检查是否为通用详情链接
   */
  isGenericDetailLink(url) {
    if (!url) return false;
    const urlLower = url.toLowerCase();
    const excludePatterns = [
      "/search",
      "/category",
      "/tag",
      "/list",
      "/page",
      "?page",
      "/login",
      "/register",
      "/user",
      "/profile",
      "/settings",
      "/en",
      "/ja",
      "/ko",
      "/forum",
      "/doc",
      "/terms",
      "/privacy",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".gif",
      ".ico",
      "/#"
    ];
    if (excludePatterns.some((pattern) => urlLower.includes(pattern))) {
      return false;
    }
    const detailPatterns = [
      /\/[A-Z]{2,6}-?\d{3,6}(?:\/|$)/i,
      // 直接番号路径
      /\/v\/[a-zA-Z0-9]+/,
      // JavDB格式
      /\/videos\/[^\/]+/,
      // Jable格式
      /\/jav\/[^\/]+/,
      // JavGG格式
      /\/view\/\d+/,
      // Sukebei格式
      /\/\d+\/[a-z0-9\-]+/i,
      // JavGuru格式
      /\/(watch|play|video|movie)\//
      // 通用视频页面
    ];
    return detailPatterns.some((pattern) => pattern.test(url));
  }
  /**
   * 增强版链接有效性验证
   */
  isValidDetailLink(url, selectorConfig, sourceType, expectedDomain, baseUrl) {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("http")) {
      const urlDomain = extractionValidator.extractDomain(url);
      if (selectorConfig.allowedDomainPatterns && selectorConfig.allowedDomainPatterns.length > 0) {
        const domainMatches = selectorConfig.allowedDomainPatterns.some(
          (pattern) => pattern.test && pattern.test(urlDomain)
        );
        if (!domainMatches) {
          return false;
        }
      } else if (selectorConfig.strictDomainCheck !== false) {
        if (!extractionValidator.isDomainOrSubdomain(urlDomain, expectedDomain)) {
          console.log(`\u2310 \u57DF\u540D\u4E0D\u5339\u914D: ${urlDomain} != ${expectedDomain}`);
          return false;
        }
      }
    }
    if (extractionValidator.normalizeUrl(url) === extractionValidator.normalizeUrl(baseUrl)) {
      return false;
    }
    if (extractionValidator.containsSearchIndicators(url)) {
      return false;
    }
    return extractionValidator.isDetailPageUrl(url, sourceType, expectedDomain);
  }
  /**
   * 提取链接相关信息
   */
  extractLinkInfo(linkElement, selectorConfig, searchKeyword) {
    try {
      let title = "";
      let code = "";
      let score = 0;
      if (selectorConfig.titleAttribute) {
        title = linkElement.getAttribute(selectorConfig.titleAttribute) || "";
      } else if (selectorConfig.titleSelector) {
        const titleElement = linkElement.querySelector(selectorConfig.titleSelector) || linkElement.closest(".item, .movie, .video, .result")?.querySelector(selectorConfig.titleSelector);
        title = titleElement?.textContent?.trim() || "";
      } else {
        title = linkElement.textContent?.trim() || "";
      }
      if (selectorConfig.codeSelector) {
        const codeElement = linkElement.querySelector(selectorConfig.codeSelector) || linkElement.closest(".item, .movie, .video, .result")?.querySelector(selectorConfig.codeSelector);
        code = codeElement?.textContent?.trim() || "";
      }
      if (!code) {
        code = extractionValidator.extractCodeFromText(title);
      }
      if (searchKeyword) {
        score = this.calculateMatchScore(title, code, searchKeyword);
      }
      if (selectorConfig.mustContainCode && !code) {
        return null;
      }
      return {
        title: title || "\u672A\u77E5\u6807\u9898",
        code: code || "",
        score,
        extractedFrom: "searchPage"
      };
    } catch (error) {
      console.warn("\u63D0\u53D6\u94FE\u63A5\u4FE1\u606F\u5931\u8D25:", error);
      return null;
    }
  }
  /**
   * 计算匹配分数
   */
  calculateMatchScore(title, code, searchKeyword) {
    if (!searchKeyword) return 50;
    let score = 0;
    const keyword = searchKeyword.toLowerCase();
    const titleLower = title.toLowerCase();
    const codeLower = code.toLowerCase();
    if (code && keyword === codeLower) {
      score += 40;
    } else if (code && (codeLower.includes(keyword) || keyword.includes(codeLower))) {
      score += 30;
    }
    if (keyword === titleLower) {
      score += 30;
    } else if (titleLower.includes(keyword)) {
      score += 20;
    }
    const similarity = this.calculateTextSimilarity(titleLower, keyword);
    score += Math.round(similarity * 30);
    return Math.min(100, score);
  }
  /**
   * 计算文本相似度
   */
  calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    const normalize = /* @__PURE__ */ __name((str) => str.toLowerCase().replace(/[^\w\d]/g, ""), "normalize");
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    if (norm1 === norm2) return 1;
    const words1 = norm1.split(/\s+/).filter((w) => w.length > 2);
    const words2 = norm2.split(/\s+/).filter((w) => w.length > 2);
    if (words1.length === 0 || words2.length === 0) return 0;
    const intersection = words1.filter((word) => words2.includes(word));
    const union = [.../* @__PURE__ */ new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }
  /**
   * 去重链接
   */
  removeDuplicateLinks(links) {
    const seen = /* @__PURE__ */ new Set();
    return links.filter((link) => {
      const normalizedUrl = extractionValidator.normalizeUrl(link.url);
      if (seen.has(normalizedUrl)) {
        return false;
      }
      seen.add(normalizedUrl);
      return true;
    });
  }
};
var searchLinkExtractor = new SearchLinkExtractorService();

// src/services/detail-content-parser.js
var DetailContentParserService = class {
  static {
    __name(this, "DetailContentParserService");
  }
  constructor() {
    this.parseTimeout = CONFIG.DETAIL_EXTRACTION.PARSE_TIMEOUT;
    this.maxRetries = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS;
  }
  /**
   * 解析详情页面内容 - 根据7个搜索源优化版本
   * @param {string} htmlContent - HTML内容
   * @param {Object} options - 解析选项
   * @returns {Object} 解析后的详情信息
   */
  async parseDetailPage(htmlContent, options = {}) {
    const { sourceType, originalUrl, originalTitle } = options;
    console.log(`\u5F00\u59CB\u89E3\u6790\u8BE6\u60C5\u9875\u9762\u5185\u5BB9\uFF0C\u6E90\u7C7B\u578B: ${sourceType}`);
    try {
      const doc = cloudflareHTMLParser.parseFromString(htmlContent);
      const detailPageRules = parserRules.getDetailPageRules(sourceType);
      if (!detailPageRules) {
        console.warn(`\u672A\u627E\u5230 ${sourceType} \u7684\u8BE6\u60C5\u9875\u9762\u89E3\u6790\u89C4\u5219\uFF0C\u4F7F\u7528\u901A\u7528\u89C4\u5219`);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      }
      console.log(`\u4F7F\u7528 ${sourceType} \u4E13\u7528\u8BE6\u60C5\u9875\u89E3\u6790\u89C4\u5219`);
      const detailInfo = {
        sourceType,
        originalUrl,
        // 基本信息
        title: this.extractByRule(doc, detailPageRules.title),
        originalTitle: this.extractByRule(doc, detailPageRules.originalTitle),
        code: this.extractByRule(doc, detailPageRules.code),
        // 媒体信息
        coverImage: this.extractImageByRule(doc, detailPageRules.coverImage, originalUrl),
        screenshots: this.extractMultipleImagesByRule(doc, detailPageRules.screenshots, originalUrl),
        // 演员信息
        actresses: this.extractActressesByRule(doc, detailPageRules.actresses),
        director: this.extractByRule(doc, detailPageRules.director),
        studio: this.extractByRule(doc, detailPageRules.studio),
        label: this.extractByRule(doc, detailPageRules.label),
        series: this.extractByRule(doc, detailPageRules.series),
        // 发布信息
        releaseDate: this.extractByRule(doc, detailPageRules.releaseDate),
        duration: this.extractByRule(doc, detailPageRules.duration),
        // 技术信息
        quality: this.extractByRule(doc, detailPageRules.quality),
        fileSize: this.extractByRule(doc, detailPageRules.fileSize),
        resolution: this.extractByRule(doc, detailPageRules.resolution),
        // 下载信息
        downloadLinks: this.extractDownloadLinksByRule(doc, detailPageRules.downloadLinks, originalUrl),
        magnetLinks: this.extractMagnetLinksByRule(doc, detailPageRules.magnetLinks),
        // 其他信息
        description: this.extractByRule(doc, detailPageRules.description),
        tags: this.extractTagsByRule(doc, detailPageRules.tags),
        rating: this.extractRatingByRule(doc, detailPageRules.rating)
      };
      const cleanedInfo = this.cleanAndValidateData(detailInfo);
      console.log(`\u8BE6\u60C5\u9875\u9762\u89E3\u6790\u5B8C\u6210\uFF0C\u63D0\u53D6\u5230 ${Object.keys(cleanedInfo).length} \u4E2A\u5B57\u6BB5`);
      return cleanedInfo;
    } catch (error) {
      console.error("\u8BE6\u60C5\u9875\u9762\u89E3\u6790\u5931\u8D25:", error);
      try {
        const doc = cloudflareHTMLParser.parseFromString(htmlContent);
        return this.parseWithGenericRules(doc, originalUrl, originalTitle);
      } catch (fallbackError) {
        console.error("\u901A\u7528\u89E3\u6790\u4E5F\u5931\u8D25:", fallbackError);
        throw new Error(`\u9875\u9762\u89E3\u6790\u5931\u8D25: ${error.message}`);
      }
    }
  }
  /**
   * 根据规则提取内容
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {string} 提取的内容
   */
  extractByRule(doc, rule) {
    if (!rule || !rule.selector) return "";
    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return "";
      let text = "";
      if (rule.attribute) {
        text = element.getAttribute(rule.attribute) || "";
      } else {
        text = element.textContent || element.innerText || "";
      }
      if (rule.transform) {
        text = this.applyTextTransform(text, rule.transform);
      }
      return text.trim();
    } catch (error) {
      console.warn(`\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return "";
    }
  }
  /**
   * 提取图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {string} 图片URL
   */
  extractImageByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return "";
    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return "";
      let imageUrl = "";
      if (rule.attribute) {
        imageUrl = element.getAttribute(rule.attribute) || "";
      } else {
        imageUrl = element.getAttribute("src") || element.getAttribute("data-src") || "";
      }
      if (imageUrl && !imageUrl.startsWith("http")) {
        imageUrl = extractionValidator.resolveRelativeUrl(imageUrl, baseUrl);
      }
      return imageUrl;
    } catch (error) {
      console.warn(`\u56FE\u7247\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return "";
    }
  }
  /**
   * 提取多个图片URL
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 图片URL数组
   */
  extractMultipleImagesByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];
    try {
      const elements = doc.querySelectorAll(rule.selector);
      const imageUrls = [];
      elements.forEach((element) => {
        let imageUrl = "";
        if (rule.attribute) {
          imageUrl = element.getAttribute(rule.attribute) || "";
        } else {
          imageUrl = element.getAttribute("src") || element.getAttribute("data-src") || "";
        }
        if (imageUrl) {
          if (!imageUrl.startsWith("http")) {
            imageUrl = extractionValidator.resolveRelativeUrl(imageUrl, baseUrl);
          }
          imageUrls.push(imageUrl);
        }
      });
      const maxScreenshots = CONFIG.DETAIL_EXTRACTION.MAX_SCREENSHOTS;
      if (imageUrls.length > maxScreenshots) {
        console.log(`\u622A\u56FE\u6570\u91CF (${imageUrls.length}) \u8D85\u8FC7\u9650\u5236 (${maxScreenshots})\uFF0C\u622A\u53D6\u524D ${maxScreenshots} \u4E2A`);
        return imageUrls.slice(0, maxScreenshots);
      }
      return imageUrls;
    } catch (error) {
      console.warn(`\u591A\u56FE\u7247\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return [];
    }
  }
  /**
   * 提取演员信息
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 演员信息数组
   */
  extractActressesByRule(doc, rule) {
    if (!rule || !rule.selector) return [];
    try {
      const elements = doc.querySelectorAll(rule.selector);
      const actresses = [];
      elements.forEach((element) => {
        const name = element.textContent?.trim() || "";
        if (name) {
          const actress = { name };
          const link = element.getAttribute("href") || element.querySelector("a")?.getAttribute("href") || "";
          if (link) {
            actress.profileUrl = link;
          }
          const avatar = element.querySelector("img")?.getAttribute("src") || "";
          if (avatar) {
            actress.avatar = avatar;
          }
          actresses.push(actress);
        }
      });
      return actresses;
    } catch (error) {
      console.warn(`\u6F14\u5458\u4FE1\u606F\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return [];
    }
  }
  /**
   * 提取下载链接 - 根据实际数据优化版本
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @param {string} baseUrl - 基础URL
   * @returns {Array} 下载链接数组
   */
  extractDownloadLinksByRule(doc, rule, baseUrl) {
    if (!rule || !rule.selector) return [];
    try {
      const elements = doc.querySelectorAll(rule.selector);
      const downloadLinks = [];
      const maxDownloadLinks = CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS;
      for (const element of elements) {
        if (downloadLinks.length >= maxDownloadLinks) {
          console.log(`\u4E0B\u8F7D\u94FE\u63A5\u6570\u91CF\u5DF2\u8FBE\u5230\u6700\u5927\u9650\u5236 (${maxDownloadLinks})\uFF0C\u505C\u6B62\u63D0\u53D6`);
          break;
        }
        const url = element.getAttribute("href") || "";
        const name = element.textContent?.trim() || "\u4E0B\u8F7D\u94FE\u63A5";
        if (url) {
          const link = {
            name,
            url: extractionValidator.resolveRelativeUrl(url, baseUrl),
            type: this.detectLinkType(url, name)
          };
          const sizeText = element.querySelector(".size, .filesize")?.textContent || "";
          if (sizeText) {
            link.size = sizeText.trim();
          }
          const qualityText = element.querySelector(".quality, .resolution")?.textContent || "";
          if (qualityText) {
            link.quality = qualityText.trim();
          }
          const expectedDomain = extractionValidator.extractDomain(baseUrl);
          if (this.isValidDownloadLink(link, expectedDomain, rule)) {
            downloadLinks.push(link);
          }
        }
      }
      console.log(`\u63D0\u53D6\u5230 ${downloadLinks.length} \u4E2A\u6709\u6548\u4E0B\u8F7D\u94FE\u63A5 (\u9650\u5236: ${maxDownloadLinks})`);
      return downloadLinks;
    } catch (error) {
      console.warn(`\u4E0B\u8F7D\u94FE\u63A5\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return [];
    }
  }
  /**
   * 提取磁力链接
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 磁力链接数组
   */
  extractMagnetLinksByRule(doc, rule) {
    if (!rule || !rule.selector) return [];
    try {
      const elements = doc.querySelectorAll(rule.selector);
      const magnetLinks = [];
      const maxMagnetLinks = CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS;
      for (const element of elements) {
        if (magnetLinks.length >= maxMagnetLinks) {
          console.log(`\u78C1\u529B\u94FE\u63A5\u6570\u91CF\u5DF2\u8FBE\u5230\u6700\u5927\u9650\u5236 (${maxMagnetLinks})\uFF0C\u505C\u6B62\u63D0\u53D6`);
          break;
        }
        const magnet = element.getAttribute("href") || element.textContent || "";
        if (magnet.startsWith("magnet:?xt=urn:btih:")) {
          const name = element.getAttribute("title") || element.querySelector(".name, .title")?.textContent?.trim() || "\u78C1\u529B\u94FE\u63A5";
          const link = { name, magnet };
          const sizeElement = element.querySelector(".size, .filesize") || element.parentElement?.querySelector(".size, .filesize");
          if (sizeElement) {
            link.size = sizeElement.textContent?.trim() || "";
          }
          const seedersElement = element.querySelector(".seeders, .seeds") || element.parentElement?.querySelector(".seeders, .seeds");
          if (seedersElement) {
            link.seeders = parseInt(seedersElement.textContent) || 0;
          }
          const leechersElement = element.querySelector(".leechers, .peers") || element.parentElement?.querySelector(".leechers, .peers");
          if (leechersElement) {
            link.leechers = parseInt(leechersElement.textContent) || 0;
          }
          magnetLinks.push(link);
        }
      }
      console.log(`\u63D0\u53D6\u5230 ${magnetLinks.length} \u4E2A\u6709\u6548\u78C1\u529B\u94FE\u63A5 (\u9650\u5236: ${maxMagnetLinks})`);
      return magnetLinks;
    } catch (error) {
      console.warn(`\u78C1\u529B\u94FE\u63A5\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return [];
    }
  }
  /**
   * 提取标签
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {Array} 标签数组
   */
  extractTagsByRule(doc, rule) {
    if (!rule || !rule.selector) return [];
    try {
      const elements = doc.querySelectorAll(rule.selector);
      const tags = [];
      elements.forEach((element) => {
        const tag = element.textContent?.trim() || "";
        if (tag && !tags.includes(tag)) {
          if (rule.excludeTexts && rule.excludeTexts.includes(tag)) {
            return;
          }
          tags.push(tag);
        }
      });
      return tags;
    } catch (error) {
      console.warn(`\u6807\u7B7E\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return [];
    }
  }
  /**
   * 提取评分
   * @param {Document} doc - DOM文档
   * @param {Object} rule - 提取规则
   * @returns {number} 评分
   */
  extractRatingByRule(doc, rule) {
    if (!rule || !rule.selector) return 0;
    try {
      const element = doc.querySelector(rule.selector);
      if (!element) return 0;
      let ratingText = element.textContent?.trim() || "";
      if (rule.attribute) {
        ratingText = element.getAttribute(rule.attribute) || "";
      }
      const ratingMatch = ratingText.match(/(\d+(?:\.\d+)?)/);
      if (ratingMatch) {
        return parseFloat(ratingMatch[1]);
      }
      return 0;
    } catch (error) {
      console.warn(`\u8BC4\u5206\u63D0\u53D6\u5931\u8D25 [${rule.selector}]:`, error.message);
      return 0;
    }
  }
  /**
   * 应用文本转换
   * @param {string} text - 原始文本
   * @param {Array} transforms - 转换规则
   * @returns {string} 转换后的文本
   */
  applyTextTransform(text, transforms) {
    if (!Array.isArray(transforms)) return text;
    let result = text;
    transforms.forEach((transform) => {
      switch (transform.type) {
        case "replace":
          if (transform.pattern && transform.replacement !== void 0) {
            const regex = new RegExp(transform.pattern, transform.flags || "g");
            result = result.replace(regex, transform.replacement);
          }
          break;
        case "trim":
          result = result.trim();
          break;
        case "uppercase":
          result = result.toUpperCase();
          break;
        case "lowercase":
          result = result.toLowerCase();
          break;
        case "extract":
          if (transform.pattern) {
            const regex = new RegExp(transform.pattern, transform.flags || "");
            const match = result.match(regex);
            if (match && match[transform.group || 1]) {
              result = match[transform.group || 1];
            }
          }
          break;
      }
    });
    return result;
  }
  /**
   * 检测链接类型
   * @param {string} url - 链接URL
   * @param {string} name - 链接名称
   * @returns {string} 链接类型
   */
  detectLinkType(url, name) {
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();
    if (urlLower.includes("magnet:") || nameLower.includes("\u78C1\u529B")) {
      return "magnet";
    }
    if (urlLower.includes(".torrent") || nameLower.includes("\u79CD\u5B50")) {
      return "torrent";
    }
    if (urlLower.includes("ed2k:") || nameLower.includes("\u7535\u9A74")) {
      return "ed2k";
    }
    if (urlLower.includes("ftp://") || nameLower.includes("ftp")) {
      return "ftp";
    }
    if (urlLower.includes("pan.baidu.com") || nameLower.includes("\u767E\u5EA6\u7F51\u76D8")) {
      return "baidu_pan";
    }
    if (urlLower.includes("drive.google.com") || nameLower.includes("google drive")) {
      return "google_drive";
    }
    return "http";
  }
  /**
   * 验证下载链接的有效性 - 根据实际搜索源严格过滤
   * @param {Object} link - 下载链接对象
   * @param {string} expectedDomain - 期望的域名
   * @param {Object} rule - 验证规则
   * @returns {boolean} 是否有效
   */
  isValidDownloadLink(link, expectedDomain, rule) {
    if (!link || !link.url) return false;
    const url = link.url;
    const name = link.name || "";
    const urlLower = url.toLowerCase();
    const nameLower = name.toLowerCase();
    if (rule.strictValidation && expectedDomain) {
      const linkDomain = extractionValidator.extractDomain(url);
      if (rule.allowedDomainPatterns && rule.allowedDomainPatterns.length > 0) {
        const domainMatches = rule.allowedDomainPatterns.some(
          (pattern) => pattern.test && pattern.test(linkDomain)
        );
        if (!domainMatches) {
          console.log(`\u2310 \u4E0B\u8F7D\u94FE\u63A5\u57DF\u540D\u4E0D\u5728\u767D\u540D\u5355: ${linkDomain}`);
          return false;
        }
      } else {
        if (!extractionValidator.isDomainOrSubdomain(linkDomain, expectedDomain)) {
          console.log(`\u2310 \u4E0B\u8F7D\u94FE\u63A5\u57DF\u540D\u4E0D\u5339\u914D: ${linkDomain} != ${expectedDomain}`);
          return false;
        }
      }
      const excludeDomains = [
        "seedmm.cyou",
        "busfan.cyou",
        "dmmsee.ink",
        "ph7zhi.vip",
        "8pla6t.vip",
        "ltrpvkga.com",
        "frozaflurkiveltra.com",
        "shvaszc.cc",
        "fpnylxm.cc",
        "mvqttfwf.com",
        "jempoprostoklimor.com",
        "128zha.cc",
        "aciyopg.cc",
        "mnaspm.com",
        "asacp.org",
        "pr0rze.vip",
        "go.mnaspm.com"
      ];
      if (excludeDomains.some((domain) => urlLower.includes(domain))) {
        console.log(`\u2310 \u4E0B\u8F7D\u94FE\u63A5\u57DF\u540D\u5728\u9ED1\u540D\u5355: ${linkDomain}`);
        return false;
      }
    }
    const excludeTexts = [
      "english",
      "\u4E2D\u6587",
      "\u65E5\u672C\u8A9E",
      "\uD55C\uAD6D\uC5B4",
      "\u6709\u78BC",
      "\u7121\u78BC",
      "\u5973\u512A",
      "\u985E\u5225",
      "\u8AD6\u58C7",
      "\u4E0B\u4E00\u9875",
      "\u4E0A\u4E00\u9875",
      "\u9996\u9875",
      "terms",
      "privacy",
      "\u767B\u5165",
      "agent_code",
      "rta",
      "2257",
      "contact",
      "about",
      "help",
      "support"
    ];
    if (excludeTexts.some((text) => nameLower.includes(text.toLowerCase()))) {
      console.log(`\u2310 \u6392\u9664\u5BFC\u822A\u6587\u672C\u94FE\u63A5: ${name}`);
      return false;
    }
    return true;
  }
  /**
   * 通用解析规则（作为后备方案）
   * @param {Document} doc - DOM文档
   * @param {string} originalUrl - 原始URL
   * @param {string} originalTitle - 原始标题
   * @returns {Object} 解析结果
   */
  parseWithGenericRules(doc, originalUrl, originalTitle) {
    console.log("\u4F7F\u7528\u901A\u7528\u89E3\u6790\u89C4\u5219");
    try {
      const result = {
        title: originalTitle,
        originalUrl,
        sourceType: "generic"
      };
      const pageTitle = doc.querySelector("title")?.textContent?.trim() || "";
      if (pageTitle && pageTitle !== originalTitle) {
        result.title = pageTitle;
      }
      const codeMatch = (pageTitle || originalTitle).match(/([A-Z]{2,6}-?\d{3,6})/i);
      if (codeMatch) {
        result.code = codeMatch[1].toUpperCase();
      }
      const possibleCoverSelectors = [
        'img[class*="cover"]',
        'img[class*="poster"]',
        'img[class*="thumb"]',
        ".cover img",
        ".poster img",
        ".thumbnail img",
        'img[src*="cover"]',
        'img[src*="poster"]'
      ];
      for (const selector of possibleCoverSelectors) {
        const img = doc.querySelector(selector);
        if (img) {
          const src = img.getAttribute("src") || img.getAttribute("data-src");
          if (src) {
            result.coverImage = extractionValidator.resolveRelativeUrl(src, originalUrl);
            break;
          }
        }
      }
      const possibleDescSelectors = [
        ".description",
        ".summary",
        ".synopsis",
        '[class*="desc"]',
        '[class*="summary"]'
      ];
      for (const selector of possibleDescSelectors) {
        const desc = doc.querySelector(selector);
        if (desc) {
          result.description = desc.textContent?.trim() || "";
          if (result.description.length > 50) break;
        }
      }
      const magnetLinks = [];
      const magnetElements = doc.querySelectorAll('a[href^="magnet:"]');
      const maxMagnetLinks = CONFIG.DETAIL_EXTRACTION.MAX_MAGNET_LINKS;
      for (let i = 0; i < Math.min(magnetElements.length, maxMagnetLinks); i++) {
        const element = magnetElements[i];
        const magnet = element.getAttribute("href");
        const name = element.textContent?.trim() || "\u78C1\u529B\u94FE\u63A5";
        if (magnet) {
          magnetLinks.push({ name, magnet });
        }
      }
      result.magnetLinks = magnetLinks;
      const downloadLinks = [];
      const downloadElements = doc.querySelectorAll('a[href*="download"], a[class*="download"], .download a');
      const maxDownloadLinks = CONFIG.DETAIL_EXTRACTION.MAX_DOWNLOAD_LINKS;
      for (let i = 0; i < Math.min(downloadElements.length, maxDownloadLinks); i++) {
        const element = downloadElements[i];
        const url = element.getAttribute("href");
        const name = element.textContent?.trim() || "\u4E0B\u8F7D\u94FE\u63A5";
        if (url && !url.startsWith("magnet:")) {
          downloadLinks.push({
            name,
            url: extractionValidator.resolveRelativeUrl(url, originalUrl),
            type: this.detectLinkType(url, name)
          });
        }
      }
      result.downloadLinks = downloadLinks;
      console.log("\u901A\u7528\u89E3\u6790\u5B8C\u6210");
      return result;
    } catch (error) {
      console.error("\u901A\u7528\u89E3\u6790\u5931\u8D25:", error);
      return {
        title: originalTitle,
        originalUrl,
        sourceType: "generic",
        extractionError: error.message
      };
    }
  }
  /**
   * 清理和验证数据
   * @param {Object} data - 原始数据
   * @returns {Object} 清理后的数据
   */
  cleanAndValidateData(data) {
    const cleaned = {};
    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (value === null || value === void 0) {
        return;
      }
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          cleaned[key] = trimmed;
        }
      } else if (Array.isArray(value)) {
        const filtered = value.filter(
          (item) => item !== null && item !== void 0 && (typeof item !== "string" || item.trim())
        );
        if (filtered.length > 0) {
          cleaned[key] = filtered;
        }
      } else {
        cleaned[key] = value;
      }
    });
    return cleaned;
  }
};
var detailContentParser = new DetailContentParserService();

// src/services/cache-manager.js
var CacheManagerService = class {
  static {
    __name(this, "CacheManagerService");
  }
  constructor() {
    this.maxCacheSize = CONFIG.DETAIL_EXTRACTION.CACHE_MAX_SIZE;
    this.defaultTTL = CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION;
    this.cleanupInterval = CONFIG.DETAIL_EXTRACTION.CACHE_CLEANUP_INTERVAL;
    this.compressionEnabled = true;
    this.cleanupTimer = null;
    this.initialized = false;
    this.memoryCache = /* @__PURE__ */ new Map();
    this.env = null;
  }
  /**
   * 初始化缓存管理器
   * @param {Object} env - Cloudflare Workers 环境对象
   */
  async initialize(env) {
    if (this.initialized) return;
    this.env = env;
    this.initialized = true;
    if (this.isWorkersEnvironment()) {
      console.log("Cloudflare Workers \u73AF\u5883\uFF1A\u8DF3\u8FC7\u5B9A\u65F6\u5668\u521D\u59CB\u5316");
    } else {
      this.startCleanupTimer();
    }
  }
  /**
   * 检查是否为 Cloudflare Workers 环境
   */
  isWorkersEnvironment() {
    return typeof caches !== "undefined" && typeof globalThis.crypto !== "undefined" && typeof fetch === "function" && typeof addEventListener === "function";
  }
  /**
   * 获取详情缓存
   * @param {string} url - 搜索结果URL
   * @returns {Object|null} 缓存的详情信息
   */
  async getDetailCache(url) {
    if (!url) return null;
    try {
      const cacheKey = this.generateCacheKey(url);
      const cached = await this.getCacheItem(cacheKey);
      if (!cached) return null;
      if (Date.now() > cached.expiresAt) {
        await this.deleteCacheItem(cacheKey);
        return null;
      }
      const data = this.compressionEnabled ? this.decompressData(cached.data) : cached.data;
      console.log(`\u7F13\u5B58\u547D\u4E2D: ${url}`);
      cached.lastAccessed = Date.now();
      cached.accessCount = (cached.accessCount || 0) + 1;
      await this.setCacheItem(cacheKey, cached);
      return data;
    } catch (error) {
      console.error("\u83B7\u53D6\u8BE6\u60C5\u7F13\u5B58\u5931\u8D25:", error);
      return null;
    }
  }
  /**
   * 设置详情缓存
   * @param {string} url - 搜索结果URL
   * @param {Object} detailData - 详情数据
   * @param {number} ttl - 生存时间（毫秒）
   * @returns {boolean} 是否设置成功
   */
  async setDetailCache(url, detailData, ttl = this.defaultTTL) {
    if (!url || !detailData) return false;
    try {
      const cacheKey = this.generateCacheKey(url);
      const data = this.compressionEnabled ? this.compressData(detailData) : detailData;
      const cacheItem = {
        key: cacheKey,
        data,
        url,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        lastAccessed: Date.now(),
        accessCount: 0,
        size: this.calculateDataSize(detailData)
      };
      await this.setCacheItem(cacheKey, cacheItem);
      await this.enforceSizeLimit();
      console.log(`\u8BE6\u60C5\u7F13\u5B58\u5DF2\u4FDD\u5B58: ${url} (TTL: ${ttl}ms)`);
      return true;
    } catch (error) {
      console.error("\u8BBE\u7F6E\u8BE6\u60C5\u7F13\u5B58\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 删除详情缓存
   * @param {string} url - 搜索结果URL
   * @returns {boolean} 是否删除成功
   */
  async deleteDetailCache(url) {
    if (!url) return false;
    try {
      const cacheKey = this.generateCacheKey(url);
      await this.deleteCacheItem(cacheKey);
      console.log(`\u8BE6\u60C5\u7F13\u5B58\u5DF2\u5220\u9664: ${url}`);
      return true;
    } catch (error) {
      console.error("\u5220\u9664\u8BE6\u60C5\u7F13\u5B58\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 清理过期缓存
   * @returns {number} 清理的条目数
   */
  async cleanupExpiredCache() {
    try {
      const allKeys = await this.getAllCacheKeys();
      let cleanedCount = 0;
      const now = Date.now();
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item && now > item.expiresAt) {
          await this.deleteCacheItem(key);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`\u6E05\u7406\u4E86 ${cleanedCount} \u4E2A\u8FC7\u671F\u7F13\u5B58\u6761\u76EE`);
      }
      return cleanedCount;
    } catch (error) {
      console.error("\u6E05\u7406\u8FC7\u671F\u7F13\u5B58\u5931\u8D25:", error);
      return 0;
    }
  }
  /**
   * 清空所有缓存
   * @returns {boolean} 是否清空成功
   */
  async clearAllCache() {
    try {
      await this.clearStorage();
      console.log("\u6240\u6709\u8BE6\u60C5\u7F13\u5B58\u5DF2\u6E05\u7A7A");
      return true;
    } catch (error) {
      console.error("\u6E05\u7A7A\u7F13\u5B58\u5931\u8D25:", error);
      return false;
    }
  }
  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  async getCacheStats() {
    try {
      const allKeys = await this.getAllCacheKeys();
      const stats = {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        oldestItem: null,
        newestItem: null,
        mostAccessed: null,
        averageSize: 0,
        hitRate: 0
      };
      const now = Date.now();
      let totalAccessCount = 0;
      let totalHits = 0;
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (!item) continue;
        stats.totalItems++;
        stats.totalSize += item.size || 0;
        totalAccessCount += item.accessCount || 0;
        if (item.accessCount && item.accessCount > 0) {
          totalHits += item.accessCount;
        }
        if (now > item.expiresAt) {
          stats.expiredItems++;
        }
        if (!stats.oldestItem || item.createdAt < stats.oldestItem.createdAt) {
          stats.oldestItem = item;
        }
        if (!stats.newestItem || item.createdAt > stats.newestItem.createdAt) {
          stats.newestItem = item;
        }
        if (!stats.mostAccessed || (item.accessCount || 0) > (stats.mostAccessed.accessCount || 0)) {
          stats.mostAccessed = item;
        }
      }
      stats.averageSize = stats.totalItems > 0 ? stats.totalSize / stats.totalItems : 0;
      stats.hitRate = totalAccessCount > 0 ? totalHits / totalAccessCount * 100 : 0;
      return stats;
    } catch (error) {
      console.error("\u83B7\u53D6\u7F13\u5B58\u7EDF\u8BA1\u5931\u8D25:", error);
      return {
        totalItems: 0,
        totalSize: 0,
        expiredItems: 0,
        averageSize: 0,
        hitRate: 0
      };
    }
  }
  /**
   * 生成缓存键
   * @param {string} url - URL
   * @returns {string} 缓存键
   */
  generateCacheKey(url) {
    return "detail_" + utils.hashPassword(url).substring(0, 16);
  }
  /**
   * 从存储中获取缓存项
   * @param {string} key - 缓存键
   * @returns {Object|null} 缓存项
   */
  async getCacheItem(key) {
    try {
      if (this.env && this.env.CACHE_KV) {
        const item = await this.env.CACHE_KV.get(key, "json");
        return item;
      }
      if (this.memoryCache.has(key)) {
        return this.memoryCache.get(key);
      }
      if (typeof localStorage !== "undefined") {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      return null;
    } catch (error) {
      console.warn("\u83B7\u53D6\u7F13\u5B58\u9879\u5931\u8D25\uFF0C\u5C1D\u8BD5\u5220\u9664\u635F\u574F\u7684\u6570\u636E:", error);
      await this.deleteCacheItem(key);
      return null;
    }
  }
  /**
   * 向存储中设置缓存项
   * @param {string} key - 缓存键
   * @param {Object} item - 缓存项
   */
  async setCacheItem(key, item) {
    try {
      if (this.env && this.env.CACHE_KV) {
        const ttlSeconds = Math.ceil((item.expiresAt - Date.now()) / 1e3);
        if (ttlSeconds > 0) {
          await this.env.CACHE_KV.put(key, JSON.stringify(item), {
            expirationTtl: ttlSeconds
          });
        }
        return;
      }
      this.memoryCache.set(key, item);
      if (this.memoryCache.size > this.maxCacheSize) {
        await this.cleanupLeastRecentlyUsed(10);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(key, JSON.stringify(item));
      }
    } catch (error) {
      console.warn("\u7F13\u5B58\u5B58\u50A8\u5931\u8D25\uFF0C\u5C1D\u8BD5\u6E05\u7406\u7A7A\u95F4:", error);
      await this.cleanupLeastRecentlyUsed();
      try {
        this.memoryCache.set(key, item);
      } catch (retryError) {
        console.error("\u91CD\u8BD5\u7F13\u5B58\u5B58\u50A8\u4ECD\u7136\u5931\u8D25:", retryError);
      }
    }
  }
  /**
   * 从存储中删除缓存项
   * @param {string} key - 缓存键
   */
  async deleteCacheItem(key) {
    try {
      if (this.env && this.env.CACHE_KV) {
        await this.env.CACHE_KV.delete(key);
      }
      this.memoryCache.delete(key);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error("\u5220\u9664\u7F13\u5B58\u9879\u5931\u8D25:", error);
    }
  }
  /**
   * 获取所有缓存键
   * @returns {Array} 缓存键数组
   */
  async getAllCacheKeys() {
    try {
      const keys = [];
      if (this.env && this.env.CACHE_KV && this.env.CACHE_KV.list) {
        try {
          const kvKeys = await this.env.CACHE_KV.list({ prefix: "detail_" });
          keys.push(...kvKeys.keys.map((k) => k.name));
        } catch (kvError) {
          console.warn("\u83B7\u53D6 KV \u952E\u5217\u8868\u5931\u8D25:", kvError);
        }
      }
      keys.push(...Array.from(this.memoryCache.keys()).filter((k) => k.startsWith("detail_")));
      if (typeof localStorage !== "undefined") {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("detail_") && !keys.includes(key)) {
            keys.push(key);
          }
        }
      }
      return [...new Set(keys)];
    } catch (error) {
      console.error("\u83B7\u53D6\u7F13\u5B58\u952E\u5931\u8D25:", error);
      return [];
    }
  }
  /**
   * 清空存储
   */
  async clearStorage() {
    try {
      if (this.env && this.env.CACHE_KV) {
        const keys = await this.getAllCacheKeys();
        for (const key of keys) {
          if (key.startsWith("detail_")) {
            await this.env.CACHE_KV.delete(key);
          }
        }
      }
      this.memoryCache.clear();
      if (typeof localStorage !== "undefined") {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("detail_")) {
            keys.push(key);
          }
        }
        keys.forEach((key) => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error("\u6E05\u7A7A\u5B58\u50A8\u5931\u8D25:", error);
    }
  }
  /**
   * 强制执行缓存大小限制
   */
  async enforceSizeLimit() {
    try {
      const allKeys = await this.getAllCacheKeys();
      if (allKeys.length <= this.maxCacheSize) {
        return;
      }
      const items = [];
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          items.push(item);
        }
      }
      items.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      const itemsToDelete = items.slice(0, items.length - this.maxCacheSize);
      for (const item of itemsToDelete) {
        await this.deleteCacheItem(item.key);
      }
      console.log(`\u5F3A\u5236\u6E05\u7406\u4E86 ${itemsToDelete.length} \u4E2A\u7F13\u5B58\u9879\u4EE5\u6EE1\u8DB3\u5927\u5C0F\u9650\u5236`);
    } catch (error) {
      console.error("\u5F3A\u5236\u6267\u884C\u5927\u5C0F\u9650\u5236\u5931\u8D25:", error);
    }
  }
  /**
   * 清理最近最少使用的缓存项
   * @param {number} count - 要清理的数量
   */
  async cleanupLeastRecentlyUsed(count = 10) {
    try {
      const allKeys = await this.getAllCacheKeys();
      const items = [];
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          items.push(item);
        }
      }
      items.sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));
      const itemsToDelete = items.slice(0, Math.min(count, items.length));
      for (const item of itemsToDelete) {
        await this.deleteCacheItem(item.key);
      }
      console.log(`\u6E05\u7406\u4E86 ${itemsToDelete.length} \u4E2A\u6700\u8FD1\u6700\u5C11\u4F7F\u7528\u7684\u7F13\u5B58\u9879`);
    } catch (error) {
      console.error("\u6E05\u7406LRU\u7F13\u5B58\u5931\u8D25:", error);
    }
  }
  /**
   * 压缩数据
   * @param {Object} data - 要压缩的数据
   * @returns {string} 压缩后的数据
   */
  compressData(data) {
    try {
      return JSON.stringify(data);
    } catch (error) {
      console.error("\u6570\u636E\u538B\u7F29\u5931\u8D25:", error);
      return data;
    }
  }
  /**
   * 解压缩数据
   * @param {string} compressedData - 压缩的数据
   * @returns {Object} 解压缩后的数据
   */
  decompressData(compressedData) {
    try {
      if (typeof compressedData === "string") {
        return JSON.parse(compressedData);
      }
      return compressedData;
    } catch (error) {
      console.error("\u6570\u636E\u89E3\u538B\u7F29\u5931\u8D25:", error);
      return compressedData;
    }
  }
  /**
   * 计算数据大小
   * @param {Object} data - 数据对象
   * @returns {number} 大小（字节）
   */
  calculateDataSize(data) {
    try {
      return JSON.stringify(data).length * 2;
    } catch (error) {
      return 0;
    }
  }
  /**
   * 启动清理定时器（仅在支持的环境中）
   */
  startCleanupTimer() {
    if (this.isWorkersEnvironment()) {
      console.log("Cloudflare Workers \u73AF\u5883\uFF1A\u8DF3\u8FC7\u5B9A\u65F6\u5668\u542F\u52A8");
      return;
    }
    if (typeof setInterval === "undefined") {
      console.log("\u5B9A\u65F6\u5668\u5728\u5F53\u524D\u73AF\u5883\u4E2D\u4E0D\u53EF\u7528\uFF0C\u8DF3\u8FC7\u81EA\u52A8\u6E05\u7406");
      return;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.cleanupTimer = setInterval(async () => {
      await this.cleanupExpiredCache();
    }, this.cleanupInterval);
    console.log("\u7F13\u5B58\u6E05\u7406\u5B9A\u65F6\u5668\u5DF2\u542F\u52A8");
  }
  /**
   * 停止清理定时器
   */
  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      console.log("\u7F13\u5B58\u6E05\u7406\u5B9A\u65F6\u5668\u5DF2\u505C\u6B62");
    }
  }
  /**
   * 预热缓存（预加载常用内容）
   * @param {Array} urls - 要预热的URL列表
   */
  async warmupCache(urls = []) {
    console.log(`\u5F00\u59CB\u9884\u70ED ${urls.length} \u4E2AURL\u7684\u7F13\u5B58`);
    for (const url of urls) {
      try {
        const cached = await this.getDetailCache(url);
        if (cached) {
          console.log(`\u7F13\u5B58\u9884\u70ED\u547D\u4E2D: ${url}`);
        }
      } catch (error) {
        console.warn(`\u7F13\u5B58\u9884\u70ED\u5931\u8D25 [${url}]:`, error);
      }
    }
  }
  /**
   * 导出缓存数据（用于备份）
   * @returns {Object} 缓存数据
   */
  async exportCacheData() {
    try {
      const allKeys = await this.getAllCacheKeys();
      const exportData = {
        version: "1.0",
        exportTime: Date.now(),
        totalItems: allKeys.length,
        items: []
      };
      for (const key of allKeys) {
        const item = await this.getCacheItem(key);
        if (item) {
          exportData.items.push({
            key: item.key,
            url: item.url,
            data: item.data,
            createdAt: item.createdAt,
            expiresAt: item.expiresAt
          });
        }
      }
      console.log(`\u5BFC\u51FA\u4E86 ${exportData.items.length} \u4E2A\u7F13\u5B58\u9879`);
      return exportData;
    } catch (error) {
      console.error("\u5BFC\u51FA\u7F13\u5B58\u6570\u636E\u5931\u8D25:", error);
      return { version: "1.0", exportTime: Date.now(), totalItems: 0, items: [] };
    }
  }
  /**
   * 导入缓存数据（用于恢复）
   * @param {Object} importData - 要导入的缓存数据
   * @returns {boolean} 是否导入成功
   */
  async importCacheData(importData) {
    if (!importData || !Array.isArray(importData.items)) {
      console.error("\u65E0\u6548\u7684\u5BFC\u5165\u6570\u636E\u683C\u5F0F");
      return false;
    }
    try {
      let importedCount = 0;
      const now = Date.now();
      for (const item of importData.items) {
        if (!item.key || !item.url || !item.data) {
          console.warn("\u8DF3\u8FC7\u65E0\u6548\u7684\u7F13\u5B58\u9879:", item.key);
          continue;
        }
        if (item.expiresAt && now > item.expiresAt) {
          console.warn("\u8DF3\u8FC7\u5DF2\u8FC7\u671F\u7684\u7F13\u5B58\u9879:", item.url);
          continue;
        }
        const cacheItem = {
          key: item.key,
          data: item.data,
          url: item.url,
          createdAt: item.createdAt || now,
          expiresAt: item.expiresAt || now + this.defaultTTL,
          lastAccessed: now,
          accessCount: 0,
          size: this.calculateDataSize(item.data)
        };
        await this.setCacheItem(item.key, cacheItem);
        importedCount++;
      }
      console.log(`\u6210\u529F\u5BFC\u5165\u4E86 ${importedCount}/${importData.items.length} \u4E2A\u7F13\u5B58\u9879`);
      return true;
    } catch (error) {
      console.error("\u5BFC\u5165\u7F13\u5B58\u6570\u636E\u5931\u8D25:", error);
      return false;
    }
  }
};
var cacheManager2 = new CacheManagerService();
var initializeCacheManager = /* @__PURE__ */ __name(async (env) => {
  await cacheManager2.initialize(env);
  return cacheManager2;
}, "initializeCacheManager");

// src/services/detail-extractor.js
var DetailExtractorService = class {
  static {
    __name(this, "DetailExtractorService");
  }
  constructor() {
    this.maxConcurrentExtractions = CONFIG.DETAIL_EXTRACTION.MAX_CONCURRENT_EXTRACTIONS;
    this.defaultTimeout = CONFIG.DETAIL_EXTRACTION.DEFAULT_TIMEOUT;
    this.retryAttempts = CONFIG.DETAIL_EXTRACTION.MAX_RETRY_ATTEMPTS;
    this.retryDelay = CONFIG.DETAIL_EXTRACTION.RETRY_DELAY;
    this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  }
  /**
   * 提取单个搜索结果的详情信息 - 根据实际搜索数据优化版本
   * @param {Object} searchResult - 搜索结果对象
   * @param {Object} options - 提取选项
   * @returns {Object} 详情信息对象
   */
  async extractSingleDetail(searchResult2, options = {}) {
    const { timeout = this.defaultTimeout, enableRetry = true } = options;
    const startTime = Date.now();
    try {
      console.log(`=== \u5F00\u59CB\u63D0\u53D6\u8BE6\u60C5 (\u6839\u636E\u5B9E\u9645\u6570\u636E\u4F18\u5316) ===`);
      console.log(`\u6807\u9898: ${searchResult2.title}`);
      console.log(`\u641C\u7D22URL: ${searchResult2.url}`);
      console.log(`\u539F\u59CBID: ${searchResult2.id}`);
      const sourceType = extractionValidator.detectSourceType(searchResult2.url, searchResult2.source);
      const searchDomain = extractionValidator.extractDomain(searchResult2.url);
      console.log(`\u68C0\u6D4B\u5230\u641C\u7D22\u6E90\u7C7B\u578B: ${sourceType}`);
      console.log(`\u641C\u7D22\u57DF\u540D: ${searchDomain}`);
      console.log(`\u6E90\u914D\u7F6E\u5B58\u5728: ${!!SOURCE_SPECIFIC_CONFIG[sourceType]}`);
      const detailPageUrl = await this.findActualDetailPageUrl(searchResult2, sourceType, searchDomain, timeout);
      console.log(`\u786E\u5B9A\u7684\u8BE6\u60C5\u9875\u9762URL: ${detailPageUrl}`);
      if (!extractionValidator.validateDetailPageUrl(detailPageUrl, searchResult2.url, sourceType)) {
        throw new Error("\u672A\u627E\u5230\u6709\u6548\u7684\u8BE6\u60C5\u9875\u9762URL");
      }
      const pageContent = await this.fetchPageContent(detailPageUrl, timeout);
      if (!pageContent || pageContent.trim().length < 100) {
        throw new Error("\u8BE6\u60C5\u9875\u9762\u5185\u5BB9\u4E3A\u7A7A\u6216\u8FC7\u77ED");
      }
      console.log(`\u8BE6\u60C5\u9875\u9762\u5185\u5BB9\u957F\u5EA6: ${pageContent.length}`);
      const detailInfo = await detailContentParser.parseDetailPage(pageContent, {
        sourceType,
        originalUrl: detailPageUrl,
        originalTitle: searchResult2.title
      });
      const extractionTime = Date.now() - startTime;
      const validatedDetails = this.validateAndEnhanceDetails(
        detailInfo,
        searchResult2,
        detailPageUrl,
        searchDomain,
        sourceType
      );
      console.log(`\u8BE6\u60C5\u63D0\u53D6\u6210\u529F: ${searchResult2.title} (${extractionTime}ms)`);
      return {
        // 保留原始搜索结果的关键标识信息
        id: searchResult2.id,
        originalId: searchResult2.id,
        originalUrl: searchResult2.url,
        originalTitle: searchResult2.title,
        originalSource: searchResult2.source,
        // 验证后的详情数据
        ...validatedDetails,
        // 提取状态和元数据
        extractionStatus: "success",
        extractionTime,
        sourceType,
        extractedAt: Date.now(),
        detailPageUrl,
        searchUrl: searchResult2.url
      };
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      console.error(`\u8BE6\u60C5\u63D0\u53D6\u5931\u8D25 [${searchResult2.title}]:`, error);
      if (enableRetry && this.retryAttempts > 0) {
        console.log(`\u5C1D\u8BD5\u91CD\u8BD5\u63D0\u53D6: ${searchResult2.title}`);
        await utils.delay(this.retryDelay);
        return await this.extractSingleDetail(searchResult2, {
          ...options,
          enableRetry: false
        });
      }
      return {
        // 保留原始标识信息
        id: searchResult2.id,
        originalId: searchResult2.id,
        originalUrl: searchResult2.url,
        originalTitle: searchResult2.title,
        originalSource: searchResult2.source,
        // 错误状态
        extractionStatus: "error",
        extractionError: error.message,
        extractionTime,
        extractedAt: Date.now(),
        detailPageUrl: searchResult2.url,
        searchUrl: searchResult2.url
      };
    }
  }
  /**
   * 查找真正的详情页面URL - 根据实际数据优化版本
   * @param {Object} searchResult - 搜索结果
   * @param {string} sourceType - 源类型
   * @param {string} searchDomain - 搜索域名
   * @param {number} timeout - 超时时间
   * @returns {string} 详情页面URL
   */
  async findActualDetailPageUrl(searchResult2, sourceType, searchDomain, timeout) {
    try {
      console.log(`=== \u67E5\u627E\u771F\u5B9E\u8BE6\u60C5\u9875\u9762URL (\u6839\u636E\u5B9E\u9645\u6570\u636E\u4F18\u5316) ===`);
      console.log(`\u641C\u7D22\u7ED3\u679CURL: ${searchResult2.url}`);
      console.log(`\u6E90\u7C7B\u578B: ${sourceType}`);
      console.log(`\u641C\u7D22\u57DF\u540D: ${searchDomain}`);
      const isAlreadyDetail = extractionValidator.isDetailPageUrl(searchResult2.url, sourceType, searchDomain);
      console.log(`\u662F\u5426\u5DF2\u7ECF\u662F\u8BE6\u60C5\u9875: ${isAlreadyDetail}`);
      if (isAlreadyDetail) {
        console.log(`\u76F4\u63A5\u4F7F\u7528\u641C\u7D22URL\u4F5C\u4E3A\u8BE6\u60C5\u9875: ${searchResult2.url}`);
        return searchResult2.url;
      }
      console.log(`\u5F00\u59CB\u83B7\u53D6\u641C\u7D22\u9875\u9762\u5185\u5BB9\u4EE5\u67E5\u627E\u8BE6\u60C5\u94FE\u63A5...`);
      const searchPageContent = await this.fetchPageContent(searchResult2.url, timeout);
      console.log(`\u641C\u7D22\u9875\u9762\u5185\u5BB9\u957F\u5EA6: ${searchPageContent?.length || 0}`);
      if (!searchPageContent) {
        throw new Error("\u65E0\u6CD5\u83B7\u53D6\u641C\u7D22\u9875\u9762\u5185\u5BB9");
      }
      console.log(`\u5F00\u59CB\u4ECE\u641C\u7D22\u9875\u9762\u63D0\u53D6\u8BE6\u60C5\u94FE\u63A5...`);
      const detailLinks = await searchLinkExtractor.extractDetailLinksFromSearchPage(searchPageContent, {
        sourceType,
        baseUrl: searchResult2.url,
        searchKeyword: this.extractSearchKeyword(searchResult2)
      });
      console.log(`\u63D0\u53D6\u5230\u7684\u8BE6\u60C5\u94FE\u63A5\u6570\u91CF: ${detailLinks?.length || 0}`);
      if (detailLinks && detailLinks.length > 0) {
        const validLinks = this.filterValidDetailLinks(detailLinks, searchDomain, searchResult2.url, sourceType);
        if (validLinks.length > 0) {
          const bestMatch = this.selectBestDetailLink(validLinks, searchResult2, sourceType);
          console.log(`\u9009\u62E9\u6700\u4F73\u5339\u914D: ${bestMatch.url}`);
          console.log(`\u5339\u914D\u5206\u6570: ${bestMatch.score || bestMatch.enhancedScore}`);
          console.log(`\u5339\u914D\u6807\u9898: ${bestMatch.title}`);
          return bestMatch.url;
        }
      }
      console.warn("\u672A\u627E\u5230\u6709\u6548\u7684\u8BE6\u60C5\u94FE\u63A5\uFF0C\u4F7F\u7528\u539F\u59CBURL");
      return searchResult2.url;
    } catch (error) {
      console.error(`\u67E5\u627E\u8BE6\u60C5\u9875URL\u5931\u8D25: ${error.message}`);
      return searchResult2.url;
    }
  }
  /**
   * 过滤有效的详情链接 - 根据实际数据严格过滤
   */
  filterValidDetailLinks(detailLinks, searchDomain, searchUrl, sourceType) {
    console.log(`=== \u8FC7\u6EE4\u6709\u6548\u8BE6\u60C5\u94FE\u63A5 ===`);
    console.log(`\u539F\u59CB\u94FE\u63A5\u6570\u91CF: ${detailLinks.length}`);
    console.log(`\u641C\u7D22\u57DF\u540D: ${searchDomain}`);
    console.log(`\u641C\u7D22URL: ${searchUrl}`);
    const validLinks = detailLinks.filter((link) => {
      if (!link || !link.url || typeof link.url !== "string") {
        console.log(`\u2310 \u8DF3\u8FC7\u65E0\u6548\u94FE\u63A5: ${link?.url || "undefined"}`);
        return false;
      }
      if (link.url.startsWith("http")) {
        const linkDomain2 = extractionValidator.extractDomain(link.url);
        if (!extractionValidator.isDomainOrSubdomainMatch(linkDomain2, searchDomain)) {
          console.log(`\u2310 \u8DF3\u8FC7\u4E0D\u540C\u57DF\u540D\u94FE\u63A5: ${link.url} (${linkDomain2} != ${searchDomain})`);
          return false;
        }
      }
      if (extractionValidator.normalizeUrl(link.url) === extractionValidator.normalizeUrl(searchUrl)) {
        console.log(`\u2310 \u8DF3\u8FC7\u76F8\u540C\u7684\u641C\u7D22URL: ${link.url}`);
        return false;
      }
      if (!extractionValidator.isDetailPageUrl(link.url, sourceType, searchDomain)) {
        console.log(`\u2310 \u8DF3\u8FC7\u975E\u8BE6\u60C5\u9875\u9762: ${link.url}`);
        return false;
      }
      if (extractionValidator.containsSearchIndicators(link.url)) {
        console.log(`\u2310 \u8DF3\u8FC7\u5305\u542B\u641C\u7D22\u6307\u793A\u5668\u7684\u94FE\u63A5: ${link.url}`);
        return false;
      }
      const linkDomain = extractionValidator.extractDomain(link.url);
      if (SPAM_DOMAINS.some((spamDomain) => linkDomain.includes(spamDomain))) {
        console.log(`\u2310 \u8DF3\u8FC7\u5783\u573E\u57DF\u540D: ${linkDomain}`);
        return false;
      }
      console.log(`\u2705 \u901A\u8FC7\u9A8C\u8BC1\u7684\u8BE6\u60C5\u94FE\u63A5: ${link.url}`);
      return true;
    });
    console.log(`\u8FC7\u6EE4\u540E\u6709\u6548\u94FE\u63A5\u6570\u91CF: ${validLinks.length}`);
    return validLinks;
  }
  /**
   * 选择最佳详情链接 - 根据实际数据优化版本
   */
  selectBestDetailLink(detailLinks, searchResult2, sourceType) {
    console.log(`=== \u9009\u62E9\u6700\u4F73\u8BE6\u60C5\u94FE\u63A5 ===`);
    const searchKeyword = this.extractSearchKeyword(searchResult2);
    console.log(`\u641C\u7D22\u5173\u952E\u8BCD: ${searchKeyword}`);
    const scoredLinks = detailLinks.map((link) => {
      const enhancedScore = extractionValidator.calculateEnhancedMatchScore(link, searchResult2, searchKeyword);
      console.log(`\u94FE\u63A5\u8BC4\u5206: ${link.url} - ${enhancedScore}\u5206`);
      console.log(`  \u6807\u9898: ${link.title}`);
      console.log(`  \u756A\u53F7: ${link.code}`);
      console.log(`  \u63D0\u53D6\u6E90: ${link.extractedFrom}`);
      return {
        ...link,
        enhancedScore
      };
    });
    scoredLinks.sort((a, b) => (b.enhancedScore || 0) - (a.enhancedScore || 0));
    const bestLink = scoredLinks[0];
    console.log(`\u6700\u4F73\u5339\u914D\u9009\u62E9: ${bestLink.url} (${bestLink.enhancedScore}\u5206)`);
    return bestLink;
  }
  /**
   * 验证和增强详情数据 - 根据实际数据优化版本
   */
  validateAndEnhanceDetails(detailInfo, searchResult2, detailPageUrl, searchDomain, sourceType) {
    console.log(`=== \u9A8C\u8BC1\u548C\u589E\u5F3A\u8BE6\u60C5\u6570\u636E ===`);
    console.log(`\u6E90\u7C7B\u578B: ${sourceType}`);
    console.log(`\u8BE6\u60C5\u9875URL: ${detailPageUrl}`);
    console.log(`\u641C\u7D22\u57DF\u540D: ${searchDomain}`);
    const validated = {
      // 基本信息
      title: detailInfo.title || searchResult2.title || "\u672A\u77E5\u6807\u9898",
      originalTitle: detailInfo.originalTitle || "",
      code: detailInfo.code || extractionValidator.extractCodeFromUrl(detailPageUrl) || extractionValidator.extractCodeFromTitle(searchResult2.title) || "",
      // 媒体信息
      coverImage: extractionValidator.validateImageUrl(detailInfo.coverImage) ? detailInfo.coverImage : "",
      screenshots: (detailInfo.screenshots || []).filter((url) => extractionValidator.validateImageUrl(url)),
      // 演员信息
      actresses: detailInfo.actresses || [],
      director: detailInfo.director || "",
      studio: detailInfo.studio || "",
      label: detailInfo.label || "",
      series: detailInfo.series || "",
      // 发布信息
      releaseDate: extractionValidator.validateDate(detailInfo.releaseDate) || "",
      duration: detailInfo.duration || "",
      // 技术信息
      quality: detailInfo.quality || "",
      fileSize: detailInfo.fileSize || "",
      resolution: detailInfo.resolution || "",
      // 下载信息 - 严格过滤，确保域名一致
      downloadLinks: this.validateDownloadLinks(detailInfo.downloadLinks || [], searchDomain, sourceType),
      magnetLinks: extractionValidator.validateMagnetLinks(detailInfo.magnetLinks || []),
      // 其他信息
      description: detailInfo.description || "",
      tags: detailInfo.tags || [],
      rating: extractionValidator.validateRating(detailInfo.rating),
      // 元数据
      detailUrl: detailPageUrl,
      searchUrl: searchResult2.url,
      sourceType: detailInfo.sourceType || sourceType
    };
    console.log(`\u9A8C\u8BC1\u5B8C\u6210\uFF0C\u4FDD\u7559\u5B57\u6BB5\u6570\u91CF: ${Object.keys(validated).filter((k) => validated[k] && (typeof validated[k] !== "object" || validated[k].length > 0)).length}`);
    return validated;
  }
  /**
   * 验证下载链接 - 根据实际搜索源严格过滤
   */
  validateDownloadLinks(downloadLinks, expectedDomain, sourceType) {
    if (!Array.isArray(downloadLinks)) return [];
    console.log(`=== \u9A8C\u8BC1\u4E0B\u8F7D\u94FE\u63A5 ===`);
    console.log(`\u539F\u59CB\u4E0B\u8F7D\u94FE\u63A5\u6570\u91CF: ${downloadLinks.length}`);
    console.log(`\u671F\u671B\u57DF\u540D: ${expectedDomain}`);
    console.log(`\u6E90\u7C7B\u578B: ${sourceType}`);
    const validLinks = downloadLinks.filter((link) => {
      if (!link || !link.url) return false;
      const linkDomain = extractionValidator.extractDomain(link.url);
      if (!extractionValidator.isDomainOrSubdomainMatch(linkDomain, expectedDomain)) {
        console.log(`\u2310 \u8FC7\u6EE4\u4E0D\u540C\u57DF\u540D\u7684\u4E0B\u8F7D\u94FE\u63A5: ${link.url} (${linkDomain} != ${expectedDomain})`);
        return false;
      }
      if (SPAM_DOMAINS.some((domain) => linkDomain.includes(domain))) {
        console.log(`\u2310 \u8FC7\u6EE4\u5783\u573E\u57DF\u540D\u4E0B\u8F7D\u94FE\u63A5: ${linkDomain}`);
        return false;
      }
      const sourceConfig = SOURCE_SPECIFIC_CONFIG[sourceType];
      if (sourceConfig && sourceConfig.strictDomain) {
        if (linkDomain !== expectedDomain) {
          console.log(`\u2310 ${sourceType}\u4E25\u683C\u57DF\u540D\u68C0\u67E5\u5931\u8D25: ${linkDomain} != ${expectedDomain}`);
          return false;
        }
      }
      console.log(`\u2705 \u6709\u6548\u4E0B\u8F7D\u94FE\u63A5: ${link.url}`);
      return true;
    });
    console.log(`\u9A8C\u8BC1\u540E\u6709\u6548\u4E0B\u8F7D\u94FE\u63A5\u6570\u91CF: ${validLinks.length}`);
    return validLinks;
  }
  /**
   * 提取搜索关键词 - 优化版本
   */
  extractSearchKeyword(searchResult2) {
    const sources = [
      searchResult2.keyword,
      searchResult2.query,
      searchResult2.title,
      searchResult2.code
    ];
    for (const source of sources) {
      if (source && typeof source === "string" && source.trim()) {
        return source.trim();
      }
    }
    const urlCode = extractionValidator.extractCodeFromUrl(searchResult2.url);
    if (urlCode) return urlCode;
    return "";
  }
  /**
   * 获取页面内容 - 优化版本，根据源类型调整策略
   */
  async fetchPageContent(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      console.log(`=== \u5F00\u59CB\u83B7\u53D6\u9875\u9762\u5185\u5BB9 ===`);
      console.log(`URL: ${url}`);
      console.log(`\u8D85\u65F6\u65F6\u95F4: ${timeout}ms`);
      const sourceType = extractionValidator.detectSourceType(url);
      const headers = this.getSourceSpecificHeaders(sourceType);
      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        headers
      });
      clearTimeout(timeoutId);
      console.log(`\u54CD\u5E94\u72B6\u6001: ${response.status} ${response.statusText}`);
      console.log(`\u5185\u5BB9\u7C7B\u578B: ${response.headers.get("content-type")}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const content = await response.text();
      console.log(`=== \u9875\u9762\u5185\u5BB9\u5206\u6790 ===`);
      console.log(`\u5185\u5BB9\u957F\u5EA6: ${content.length}`);
      const pageAnalysis = this.analyzePageContent(content, url, sourceType);
      console.log(`\u9875\u9762\u5206\u6790:`, pageAnalysis);
      if (pageAnalysis.hasIssues) {
        console.warn(`\u26A0\uFE0F \u9875\u9762\u53EF\u80FD\u6709\u95EE\u9898:`, pageAnalysis.issues);
      }
      console.log(`=== \u9875\u9762\u5185\u5BB9\u83B7\u53D6\u5B8C\u6210 ===`);
      return content;
    } catch (error) {
      clearTimeout(timeoutId);
      console.error(`=== \u9875\u9762\u5185\u5BB9\u83B7\u53D6\u5931\u8D25 ===`);
      console.error(`\u9519\u8BEF\u7C7B\u578B: ${error.name}`);
      console.error(`\u9519\u8BEF\u4FE1\u606F: ${error.message}`);
      if (error.name === "AbortError") {
        throw new Error(`\u8BF7\u6C42\u8D85\u65F6 (${timeout}ms)`);
      }
      throw error;
    }
  }
  /**
   * 获取源特定的请求头
   */
  getSourceSpecificHeaders(sourceType) {
    const baseHeaders = {
      "User-Agent": this.userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.8,en;q=0.6,ja;q=0.4",
      "Accept-Encoding": "gzip, deflate",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };
    switch (sourceType) {
      case "jable":
        return {
          ...baseHeaders,
          "Referer": "https://jable.tv/"
        };
      case "javdb":
        return {
          ...baseHeaders,
          "Referer": "https://javdb.com/"
        };
      default:
        return baseHeaders;
    }
  }
  /**
   * 分析页面内容 - 根据源类型优化版本
   */
  analyzePageContent(content, url, sourceType) {
    const analysis = {
      hasTitle: false,
      hasBody: false,
      isLoginPage: false,
      is404Page: false,
      isCloudflareBlocked: false,
      hasVideoContent: false,
      hasDetailContent: false,
      hasIssues: false,
      issues: []
    };
    if (!content || content.length < 100) {
      analysis.hasIssues = true;
      analysis.issues.push("\u5185\u5BB9\u8FC7\u77ED\u6216\u4E3A\u7A7A");
      return analysis;
    }
    analysis.hasTitle = content.includes("<title>");
    analysis.hasBody = content.includes("<body>");
    const contentLower = content.toLowerCase();
    if (contentLower.includes("\u767B\u5F55") || contentLower.includes("login") || contentLower.includes("\u9A8C\u8BC1\u7801") || contentLower.includes("captcha")) {
      analysis.isLoginPage = true;
      analysis.hasIssues = true;
      analysis.issues.push("\u53EF\u80FD\u662F\u767B\u5F55\u9875\u9762");
    }
    if (contentLower.includes("404") || contentLower.includes("not found") || contentLower.includes("page not found")) {
      analysis.is404Page = true;
      analysis.hasIssues = true;
      analysis.issues.push("\u53EF\u80FD\u662F404\u9875\u9762");
    }
    if (contentLower.includes("cloudflare") || contentLower.includes("checking your browser") || contentLower.includes("ddos protection")) {
      analysis.isCloudflareBlocked = true;
      analysis.hasIssues = true;
      analysis.issues.push("\u53EF\u80FD\u88ABCloudflare\u62E6\u622A");
    }
    const sourceIndicators = this.getSourceSpecificIndicators(sourceType);
    analysis.hasDetailContent = sourceIndicators.some(
      (indicator) => contentLower.includes(indicator)
    );
    const videoIndicators = ["<video", "player", ".mp4", ".avi", "stream"];
    analysis.hasVideoContent = videoIndicators.some(
      (indicator) => contentLower.includes(indicator)
    );
    return analysis;
  }
  /**
   * 获取源特定的内容指示器
   */
  getSourceSpecificIndicators(sourceType) {
    const commonIndicators = [
      "video",
      "movie",
      "download",
      "magnet",
      "actress",
      "genre",
      "\u6F14\u5458",
      "\u5BFC\u6F14",
      "\u53D1\u884C",
      "\u756A\u53F7",
      "\u78C1\u529B",
      "\u4E0B\u8F7D"
    ];
    switch (sourceType) {
      case "javbus":
        return [...commonIndicators, "movie-box", "screencap", "star-name"];
      case "javdb":
        return [...commonIndicators, "video-cover", "panel-block", "tile-images"];
      case "jable":
        return [...commonIndicators, "video-item", "models", "video-title"];
      case "javgg":
        return [...commonIndicators, "video-cover", "screenshots"];
      case "javmost":
        return [...commonIndicators, "video-item", "actress"];
      case "sukebei":
        return [...commonIndicators, "torrent", "magnet", "seeders"];
      case "javguru":
        return [...commonIndicators, "video-title", "description"];
      default:
        return commonIndicators;
    }
  }
  // ==================== 批量提取方法 ====================
  /**
   * 批量提取详情信息 - 保持原有接口
   */
  async extractBatchDetails(searchResults, options = {}) {
    const {
      enableCache = true,
      timeout = this.defaultTimeout,
      onProgress = null,
      enableRetry = true
    } = options;
    console.log(`\u5F00\u59CB\u6279\u91CF\u63D0\u53D6 ${searchResults.length} \u4E2A\u7ED3\u679C\u7684\u8BE6\u60C5\u4FE1\u606F`);
    const results = [];
    const concurrency = Math.min(this.maxConcurrentExtractions, searchResults.length);
    for (let i = 0; i < searchResults.length; i += concurrency) {
      const batch = searchResults.slice(i, i + concurrency);
      const batchPromises = batch.map(async (result, index) => {
        try {
          const globalIndex = i + index;
          if (enableCache) {
            const cached = await cacheManager2.getDetailCache(result.url);
            if (cached) {
              console.log(`\u4F7F\u7528\u7F13\u5B58\u8BE6\u60C5: ${result.title}`);
              onProgress && onProgress({
                current: globalIndex + 1,
                total: searchResults.length,
                status: "cached",
                item: result.title
              });
              return {
                ...result,
                ...cached,
                extractionStatus: "cached",
                extractionTime: 0
              };
            }
          }
          const extractedDetails = await this.extractSingleDetail(result, {
            timeout,
            enableRetry
          });
          if (enableCache && extractedDetails.extractionStatus === "success") {
            await cacheManager2.setDetailCache(result.url, extractedDetails, CONFIG.DETAIL_EXTRACTION.DEFAULT_CACHE_DURATION);
          }
          onProgress && onProgress({
            current: globalIndex + 1,
            total: searchResults.length,
            status: extractedDetails.extractionStatus,
            item: result.title
          });
          return {
            ...result,
            ...extractedDetails
          };
        } catch (error) {
          console.error(`\u6279\u91CF\u63D0\u53D6\u8BE6\u60C5\u5931\u8D25 [${result.title}]:`, error);
          onProgress && onProgress({
            current: i + index + 1,
            total: searchResults.length,
            status: "error",
            item: result.title,
            error: error.message
          });
          return {
            ...result,
            extractionStatus: "error",
            extractionError: error.message,
            extractionTime: 0
          };
        }
      });
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      if (i + concurrency < searchResults.length) {
        await utils.delay(500);
      }
    }
    console.log(`\u6279\u91CF\u63D0\u53D6\u5B8C\u6210: ${results.length}/${searchResults.length}`);
    return results;
  }
  /**
   * 获取提取统计信息
   */
  getExtractionStats() {
    return {
      totalExtractions: this.totalExtractions || 0,
      successfulExtractions: this.successfulExtractions || 0,
      failedExtractions: this.failedExtractions || 0,
      averageExtractionTime: this.averageExtractionTime || 0,
      cacheHitRate: this.cacheHitRate || 0
    };
  }
};
var detailExtractor = new DetailExtractorService();

// src/services/detail-config-service.js
var DetailConfigService = class {
  static {
    __name(this, "DetailConfigService");
  }
  constructor() {
    this.defaultConfig = this.getDefaultUserConfig();
  }
  /**
   * 获取用户默认配置
   */
  getDefaultUserConfig() {
    return {
      // 基础功能开关
      enableDetailExtraction: true,
      autoExtractDetails: false,
      // 提取数量控制
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      maxDownloadLinks: 10,
      maxMagnetLinks: 10,
      maxScreenshots: 10,
      // 时间控制
      extractionTimeout: 15e3,
      // 15秒
      cacheDuration: 864e5,
      // 24小时
      // 重试控制
      enableRetry: true,
      maxRetryAttempts: 2,
      // 缓存控制
      enableCache: true,
      enableLocalCache: true,
      // 显示控制
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      showExtractedTags: true,
      showRating: true,
      showDescription: true,
      // 界面控制
      compactMode: false,
      enableImagePreview: true,
      showExtractionProgress: true,
      enableProgressNotifications: true,
      // 内容过滤
      enableContentFilter: false,
      contentFilterKeywords: [],
      // 高级选项
      enableStrictDomainCheck: true,
      enableSpamFilter: true,
      preferOriginalSources: true,
      enableAutoCodeExtraction: true,
      // 性能优化
      enableConcurrentExtraction: true,
      maxConcurrentExtractions: 3,
      enableSmartBatching: true,
      // 数据质量
      requireMinimumData: true,
      skipLowQualityResults: false,
      validateImageUrls: true,
      validateDownloadLinks: true
    };
  }
  /**
   * 从数据库获取用户配置
   */
  async getUserConfig(env, userId) {
    try {
      const userConfig = await env.DB.prepare(`
        SELECT * FROM detail_extraction_config WHERE user_id = ?
      `).bind(userId).first();
      if (!userConfig) {
        return this.defaultConfig;
      }
      return {
        // 基础功能开关
        enableDetailExtraction: Boolean(userConfig.enable_detail_extraction),
        autoExtractDetails: Boolean(userConfig.auto_extract_details),
        // 提取数量控制
        maxAutoExtractions: userConfig.max_auto_extractions || this.defaultConfig.maxAutoExtractions,
        extractionBatchSize: userConfig.extraction_batch_size || this.defaultConfig.extractionBatchSize,
        maxDownloadLinks: userConfig.max_download_links || this.defaultConfig.maxDownloadLinks,
        maxMagnetLinks: userConfig.max_magnet_links || this.defaultConfig.maxMagnetLinks,
        maxScreenshots: userConfig.max_screenshots || this.defaultConfig.maxScreenshots,
        // 时间控制
        extractionTimeout: userConfig.extraction_timeout || this.defaultConfig.extractionTimeout,
        cacheDuration: userConfig.cache_duration || this.defaultConfig.cacheDuration,
        // 重试控制
        enableRetry: Boolean(userConfig.enable_retry),
        maxRetryAttempts: userConfig.max_retry_attempts || this.defaultConfig.maxRetryAttempts,
        // 缓存控制
        enableCache: Boolean(userConfig.enable_cache),
        enableLocalCache: Boolean(userConfig.enable_local_cache),
        // 显示控制
        showScreenshots: Boolean(userConfig.show_screenshots),
        showDownloadLinks: Boolean(userConfig.show_download_links),
        showMagnetLinks: Boolean(userConfig.show_magnet_links),
        showActressInfo: Boolean(userConfig.show_actress_info),
        showExtractedTags: Boolean(userConfig.show_extracted_tags),
        showRating: Boolean(userConfig.show_rating),
        showDescription: Boolean(userConfig.show_description),
        // 界面控制
        compactMode: Boolean(userConfig.compact_mode),
        enableImagePreview: Boolean(userConfig.enable_image_preview),
        showExtractionProgress: Boolean(userConfig.show_extraction_progress),
        enableProgressNotifications: Boolean(userConfig.enable_progress_notifications),
        // 内容过滤
        enableContentFilter: Boolean(userConfig.enable_content_filter),
        contentFilterKeywords: JSON.parse(userConfig.content_filter_keywords || "[]"),
        // 高级选项
        enableStrictDomainCheck: Boolean(userConfig.enable_strict_domain_check),
        enableSpamFilter: Boolean(userConfig.enable_spam_filter),
        preferOriginalSources: Boolean(userConfig.prefer_original_sources),
        enableAutoCodeExtraction: Boolean(userConfig.enable_auto_code_extraction),
        // 性能优化
        enableConcurrentExtraction: Boolean(userConfig.enable_concurrent_extraction),
        maxConcurrentExtractions: userConfig.max_concurrent_extractions || this.defaultConfig.maxConcurrentExtractions,
        enableSmartBatching: Boolean(userConfig.enable_smart_batching),
        // 数据质量
        requireMinimumData: Boolean(userConfig.require_minimum_data),
        skipLowQualityResults: Boolean(userConfig.skip_low_quality_results),
        validateImageUrls: Boolean(userConfig.validate_image_urls),
        validateDownloadLinks: Boolean(userConfig.validate_download_links)
      };
    } catch (error) {
      console.error("\u83B7\u53D6\u7528\u6237\u914D\u7F6E\u5931\u8D25:", error);
      return this.defaultConfig;
    }
  }
  /**
   * 保存用户配置
   */
  async saveUserConfig(env, userId, config) {
    try {
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        throw new Error(`\u914D\u7F6E\u9A8C\u8BC1\u5931\u8D25: ${validation.errors.join(", ")}`);
      }
      const configId = `${userId}_detail_config`;
      const now = Date.now();
      await env.DB.prepare(`
        INSERT OR REPLACE INTO detail_extraction_config (
          id, user_id,
          enable_detail_extraction, auto_extract_details, max_auto_extractions,
          extraction_batch_size, max_download_links, max_magnet_links, max_screenshots,
          extraction_timeout, cache_duration,
          enable_retry, max_retry_attempts,
          enable_cache, enable_local_cache,
          show_screenshots, show_download_links, show_magnet_links, show_actress_info,
          show_extracted_tags, show_rating, show_description,
          compact_mode, enable_image_preview, show_extraction_progress, enable_progress_notifications,
          enable_content_filter, content_filter_keywords,
          enable_strict_domain_check, enable_spam_filter, prefer_original_sources, enable_auto_code_extraction,
          enable_concurrent_extraction, max_concurrent_extractions, enable_smart_batching,
          require_minimum_data, skip_low_quality_results, validate_image_urls, validate_download_links,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).bind(
        configId,
        userId,
        config.enableDetailExtraction ? 1 : 0,
        config.autoExtractDetails ? 1 : 0,
        config.maxAutoExtractions,
        config.extractionBatchSize,
        config.maxDownloadLinks,
        config.maxMagnetLinks,
        config.maxScreenshots,
        config.extractionTimeout,
        config.cacheDuration,
        config.enableRetry ? 1 : 0,
        config.maxRetryAttempts,
        config.enableCache ? 1 : 0,
        config.enableLocalCache ? 1 : 0,
        config.showScreenshots ? 1 : 0,
        config.showDownloadLinks ? 1 : 0,
        config.showMagnetLinks ? 1 : 0,
        config.showActressInfo ? 1 : 0,
        config.showExtractedTags ? 1 : 0,
        config.showRating ? 1 : 0,
        config.showDescription ? 1 : 0,
        config.compactMode ? 1 : 0,
        config.enableImagePreview ? 1 : 0,
        config.showExtractionProgress ? 1 : 0,
        config.enableProgressNotifications ? 1 : 0,
        config.enableContentFilter ? 1 : 0,
        JSON.stringify(config.contentFilterKeywords || []),
        config.enableStrictDomainCheck ? 1 : 0,
        config.enableSpamFilter ? 1 : 0,
        config.preferOriginalSources ? 1 : 0,
        config.enableAutoCodeExtraction ? 1 : 0,
        config.enableConcurrentExtraction ? 1 : 0,
        config.maxConcurrentExtractions,
        config.enableSmartBatching ? 1 : 0,
        config.requireMinimumData ? 1 : 0,
        config.skipLowQualityResults ? 1 : 0,
        config.validateImageUrls ? 1 : 0,
        config.validateDownloadLinks ? 1 : 0,
        now,
        now
      ).run();
      return { success: true, warnings: validation.warnings };
    } catch (error) {
      console.error("\u4FDD\u5B58\u7528\u6237\u914D\u7F6E\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 验证配置
   */
  validateConfig(config) {
    const errors = [];
    const warnings = [];
    if (config.extractionTimeout !== void 0) {
      const timeout = Number(config.extractionTimeout);
      if (isNaN(timeout) || timeout < SYSTEM_VALIDATION.extractionTimeout.min || timeout > SYSTEM_VALIDATION.extractionTimeout.max) {
        errors.push(`\u63D0\u53D6\u8D85\u65F6\u65F6\u95F4\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.extractionTimeout.min}-${SYSTEM_VALIDATION.extractionTimeout.max}ms \u4E4B\u95F4`);
      }
      if (timeout > 2e4) {
        warnings.push("\u8D85\u65F6\u65F6\u95F4\u8BBE\u7F6E\u8FC7\u957F\u53EF\u80FD\u5F71\u54CD\u7528\u6237\u4F53\u9A8C");
      }
    }
    if (config.cacheDuration !== void 0) {
      const duration = Number(config.cacheDuration);
      if (isNaN(duration) || duration < SYSTEM_VALIDATION.cacheDuration.min || duration > SYSTEM_VALIDATION.cacheDuration.max) {
        errors.push(`\u7F13\u5B58\u65F6\u957F\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.cacheDuration.min}-${SYSTEM_VALIDATION.cacheDuration.max}ms \u4E4B\u95F4`);
      }
    }
    if (config.extractionBatchSize !== void 0) {
      const batchSize = Number(config.extractionBatchSize);
      if (isNaN(batchSize) || batchSize < SYSTEM_VALIDATION.extractionBatchSize.min || batchSize > SYSTEM_VALIDATION.extractionBatchSize.max) {
        errors.push(`\u6279\u91CF\u5927\u5C0F\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.extractionBatchSize.min}-${SYSTEM_VALIDATION.extractionBatchSize.max} \u4E4B\u95F4`);
      }
      if (batchSize > 10) {
        warnings.push("\u6279\u91CF\u5927\u5C0F\u8FC7\u5927\u53EF\u80FD\u5BFC\u81F4\u8BF7\u6C42\u963B\u585E");
      }
    }
    if (config.maxDownloadLinks !== void 0) {
      const maxLinks = Number(config.maxDownloadLinks);
      if (isNaN(maxLinks) || maxLinks < SYSTEM_VALIDATION.maxDownloadLinks.min || maxLinks > SYSTEM_VALIDATION.maxDownloadLinks.max) {
        errors.push(`\u6700\u5927\u4E0B\u8F7D\u94FE\u63A5\u6570\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.maxDownloadLinks.min}-${SYSTEM_VALIDATION.maxDownloadLinks.max} \u4E4B\u95F4`);
      }
    }
    if (config.maxMagnetLinks !== void 0) {
      const maxMagnets = Number(config.maxMagnetLinks);
      if (isNaN(maxMagnets) || maxMagnets < SYSTEM_VALIDATION.maxMagnetLinks.min || maxMagnets > SYSTEM_VALIDATION.maxMagnetLinks.max) {
        errors.push(`\u6700\u5927\u78C1\u529B\u94FE\u63A5\u6570\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.maxMagnetLinks.min}-${SYSTEM_VALIDATION.maxMagnetLinks.max} \u4E4B\u95F4`);
      }
    }
    if (config.maxScreenshots !== void 0) {
      const maxScreenshots = Number(config.maxScreenshots);
      if (isNaN(maxScreenshots) || maxScreenshots < SYSTEM_VALIDATION.maxScreenshots.min || maxScreenshots > SYSTEM_VALIDATION.maxScreenshots.max) {
        errors.push(`\u6700\u5927\u622A\u56FE\u6570\u5FC5\u987B\u5728 ${SYSTEM_VALIDATION.maxScreenshots.min}-${SYSTEM_VALIDATION.maxScreenshots.max} \u4E4B\u95F4`);
      }
    }
    if (config.contentFilterKeywords !== void 0) {
      if (!Array.isArray(config.contentFilterKeywords)) {
        errors.push("\u5185\u5BB9\u8FC7\u6EE4\u5173\u952E\u8BCD\u5FC5\u987B\u662F\u6570\u7EC4\u683C\u5F0F");
      } else if (config.contentFilterKeywords.length > 50) {
        errors.push("\u5185\u5BB9\u8FC7\u6EE4\u5173\u952E\u8BCD\u6570\u91CF\u4E0D\u80FD\u8D85\u8FC750\u4E2A");
      }
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  /**
   * 获取配置字段元数据
   */
  getConfigMetadata() {
    return {
      groups: [
        {
          id: "basic",
          name: "\u57FA\u7840\u8BBE\u7F6E",
          description: "\u63A7\u5236\u8BE6\u60C5\u63D0\u53D6\u7684\u57FA\u672C\u529F\u80FD",
          fields: [
            {
              key: "enableDetailExtraction",
              name: "\u542F\u7528\u8BE6\u60C5\u63D0\u53D6",
              type: "boolean",
              description: "\u5F00\u542F\u6216\u5173\u95ED\u8BE6\u60C5\u63D0\u53D6\u529F\u80FD",
              default: true
            },
            {
              key: "autoExtractDetails",
              name: "\u81EA\u52A8\u63D0\u53D6\u8BE6\u60C5",
              type: "boolean",
              description: "\u5728\u641C\u7D22\u7ED3\u679C\u4E2D\u81EA\u52A8\u63D0\u53D6\u8BE6\u60C5\u4FE1\u606F",
              default: false,
              dependency: "enableDetailExtraction"
            },
            {
              key: "maxAutoExtractions",
              name: "\u6700\u5927\u81EA\u52A8\u63D0\u53D6\u6570\u91CF",
              type: "number",
              min: 1,
              max: 10,
              description: "\u81EA\u52A8\u63D0\u53D6\u65F6\u7684\u6700\u5927\u6570\u91CF",
              default: 5,
              dependency: "autoExtractDetails"
            }
          ]
        },
        {
          id: "performance",
          name: "\u6027\u80FD\u8BBE\u7F6E",
          description: "\u63A7\u5236\u63D0\u53D6\u6027\u80FD\u548C\u8D44\u6E90\u4F7F\u7528",
          fields: [
            {
              key: "extractionTimeout",
              name: "\u63D0\u53D6\u8D85\u65F6\u65F6\u95F4 (\u6BEB\u79D2)",
              type: "number",
              min: SYSTEM_VALIDATION.extractionTimeout.min,
              max: SYSTEM_VALIDATION.extractionTimeout.max,
              step: 1e3,
              description: "\u5355\u4E2A\u8BE6\u60C5\u63D0\u53D6\u7684\u6700\u5927\u7B49\u5F85\u65F6\u95F4",
              default: 15e3
            },
            {
              key: "extractionBatchSize",
              name: "\u6279\u91CF\u5904\u7406\u5927\u5C0F",
              type: "number",
              min: SYSTEM_VALIDATION.extractionBatchSize.min,
              max: SYSTEM_VALIDATION.extractionBatchSize.max,
              description: "\u6279\u91CF\u63D0\u53D6\u65F6\u7684\u6BCF\u6279\u6570\u91CF",
              default: 3
            },
            {
              key: "maxConcurrentExtractions",
              name: "\u6700\u5927\u5E76\u53D1\u63D0\u53D6\u6570",
              type: "number",
              min: 1,
              max: 5,
              description: "\u540C\u65F6\u8FDB\u884C\u7684\u63D0\u53D6\u4EFB\u52A1\u6570\u91CF",
              default: 3
            }
          ]
        },
        {
          id: "content",
          name: "\u5185\u5BB9\u8BBE\u7F6E",
          description: "\u63A7\u5236\u63D0\u53D6\u7684\u5185\u5BB9\u7C7B\u578B\u548C\u6570\u91CF",
          fields: [
            {
              key: "maxDownloadLinks",
              name: "\u6700\u5927\u4E0B\u8F7D\u94FE\u63A5\u6570",
              type: "number",
              min: SYSTEM_VALIDATION.maxDownloadLinks.min,
              max: SYSTEM_VALIDATION.maxDownloadLinks.max,
              description: "\u5355\u4E2A\u8BE6\u60C5\u9875\u6700\u5927\u4E0B\u8F7D\u94FE\u63A5\u6570",
              default: 10
            },
            {
              key: "maxMagnetLinks",
              name: "\u6700\u5927\u78C1\u529B\u94FE\u63A5\u6570",
              type: "number",
              min: SYSTEM_VALIDATION.maxMagnetLinks.min,
              max: SYSTEM_VALIDATION.maxMagnetLinks.max,
              description: "\u5355\u4E2A\u8BE6\u60C5\u9875\u6700\u5927\u78C1\u529B\u94FE\u63A5\u6570",
              default: 10
            },
            {
              key: "maxScreenshots",
              name: "\u6700\u5927\u622A\u56FE\u6570",
              type: "number",
              min: SYSTEM_VALIDATION.maxScreenshots.min,
              max: SYSTEM_VALIDATION.maxScreenshots.max,
              description: "\u5355\u4E2A\u8BE6\u60C5\u9875\u6700\u5927\u622A\u56FE\u6570",
              default: 10
            }
          ]
        },
        {
          id: "display",
          name: "\u663E\u793A\u8BBE\u7F6E",
          description: "\u63A7\u5236\u8BE6\u60C5\u4FE1\u606F\u7684\u663E\u793A\u65B9\u5F0F",
          fields: [
            {
              key: "showScreenshots",
              name: "\u663E\u793A\u622A\u56FE",
              type: "boolean",
              description: "\u5728\u8BE6\u60C5\u4E2D\u663E\u793A\u622A\u56FE\u56FE\u7247",
              default: true
            },
            {
              key: "showDownloadLinks",
              name: "\u663E\u793A\u4E0B\u8F7D\u94FE\u63A5",
              type: "boolean",
              description: "\u5728\u8BE6\u60C5\u4E2D\u663E\u793A\u4E0B\u8F7D\u94FE\u63A5",
              default: true
            },
            {
              key: "showMagnetLinks",
              name: "\u663E\u793A\u78C1\u529B\u94FE\u63A5",
              type: "boolean",
              description: "\u5728\u8BE6\u60C5\u4E2D\u663E\u793A\u78C1\u529B\u94FE\u63A5",
              default: true
            },
            {
              key: "showActressInfo",
              name: "\u663E\u793A\u6F14\u5458\u4FE1\u606F",
              type: "boolean",
              description: "\u5728\u8BE6\u60C5\u4E2D\u663E\u793A\u6F14\u5458\u76F8\u5173\u4FE1\u606F",
              default: true
            },
            {
              key: "compactMode",
              name: "\u7D27\u51D1\u6A21\u5F0F",
              type: "boolean",
              description: "\u4F7F\u7528\u66F4\u7D27\u51D1\u7684\u663E\u793A\u5E03\u5C40",
              default: false
            },
            {
              key: "enableImagePreview",
              name: "\u542F\u7528\u56FE\u7247\u9884\u89C8",
              type: "boolean",
              description: "\u70B9\u51FB\u56FE\u7247\u65F6\u663E\u793A\u9884\u89C8",
              default: true
            }
          ]
        },
        {
          id: "cache",
          name: "\u7F13\u5B58\u8BBE\u7F6E",
          description: "\u63A7\u5236\u7F13\u5B58\u7B56\u7565\u548C\u5B58\u50A8",
          fields: [
            {
              key: "enableCache",
              name: "\u542F\u7528\u7F13\u5B58",
              type: "boolean",
              description: "\u7F13\u5B58\u63D0\u53D6\u7ED3\u679C\u4EE5\u63D0\u9AD8\u6027\u80FD",
              default: true
            },
            {
              key: "cacheDuration",
              name: "\u7F13\u5B58\u65F6\u957F (\u6BEB\u79D2)",
              type: "number",
              min: SYSTEM_VALIDATION.cacheDuration.min,
              max: SYSTEM_VALIDATION.cacheDuration.max,
              step: 36e5,
              description: "\u7F13\u5B58\u6570\u636E\u7684\u4FDD\u5B58\u65F6\u95F4",
              default: 864e5,
              dependency: "enableCache"
            },
            {
              key: "enableLocalCache",
              name: "\u542F\u7528\u672C\u5730\u7F13\u5B58",
              type: "boolean",
              description: "\u5728\u6D4F\u89C8\u5668\u672C\u5730\u5B58\u50A8\u7F13\u5B58\u6570\u636E",
              default: true,
              dependency: "enableCache"
            }
          ]
        },
        {
          id: "advanced",
          name: "\u9AD8\u7EA7\u8BBE\u7F6E",
          description: "\u9AD8\u7EA7\u529F\u80FD\u548C\u8D28\u91CF\u63A7\u5236",
          fields: [
            {
              key: "enableRetry",
              name: "\u542F\u7528\u91CD\u8BD5",
              type: "boolean",
              description: "\u63D0\u53D6\u5931\u8D25\u65F6\u81EA\u52A8\u91CD\u8BD5",
              default: true
            },
            {
              key: "maxRetryAttempts",
              name: "\u6700\u5927\u91CD\u8BD5\u6B21\u6570",
              type: "number",
              min: 1,
              max: 5,
              description: "\u5931\u8D25\u540E\u7684\u6700\u5927\u91CD\u8BD5\u6B21\u6570",
              default: 2,
              dependency: "enableRetry"
            },
            {
              key: "enableStrictDomainCheck",
              name: "\u542F\u7528\u4E25\u683C\u57DF\u540D\u68C0\u67E5",
              type: "boolean",
              description: "\u4E25\u683C\u9A8C\u8BC1\u94FE\u63A5\u57DF\u540D\u4E00\u81F4\u6027",
              default: true
            },
            {
              key: "enableSpamFilter",
              name: "\u542F\u7528\u5783\u573E\u8FC7\u6EE4",
              type: "boolean",
              description: "\u8FC7\u6EE4\u5DF2\u77E5\u7684\u5783\u573E\u57DF\u540D\u548C\u94FE\u63A5",
              default: true
            },
            {
              key: "requireMinimumData",
              name: "\u8981\u6C42\u6700\u5C11\u6570\u636E",
              type: "boolean",
              description: "\u53EA\u4FDD\u7559\u5305\u542B\u8DB3\u591F\u4FE1\u606F\u7684\u7ED3\u679C",
              default: true
            }
          ]
        },
        {
          id: "filter",
          name: "\u5185\u5BB9\u8FC7\u6EE4",
          description: "\u8FC7\u6EE4\u548C\u7B5B\u9009\u63D0\u53D6\u7684\u5185\u5BB9",
          fields: [
            {
              key: "enableContentFilter",
              name: "\u542F\u7528\u5185\u5BB9\u8FC7\u6EE4",
              type: "boolean",
              description: "\u6839\u636E\u5173\u952E\u8BCD\u8FC7\u6EE4\u5185\u5BB9",
              default: false
            },
            {
              key: "contentFilterKeywords",
              name: "\u8FC7\u6EE4\u5173\u952E\u8BCD",
              type: "array",
              itemType: "string",
              description: "\u7528\u4E8E\u8FC7\u6EE4\u7684\u5173\u952E\u8BCD\u5217\u8868",
              default: [],
              dependency: "enableContentFilter"
            }
          ]
        }
      ],
      systemLimits: SYSTEM_VALIDATION
    };
  }
  /**
   * 重置配置为默认值
   */
  async resetUserConfig(env, userId) {
    try {
      await env.DB.prepare(`
        DELETE FROM detail_extraction_config WHERE user_id = ?
      `).bind(userId).run();
      return { success: true, config: this.defaultConfig };
    } catch (error) {
      console.error("\u91CD\u7F6E\u7528\u6237\u914D\u7F6E\u5931\u8D25:", error);
      throw error;
    }
  }
  /**
   * 获取配置预设
   */
  getConfigPresets() {
    return {
      conservative: {
        name: "\u4FDD\u5B88\u6A21\u5F0F",
        description: "\u6700\u5C0F\u5316\u8D44\u6E90\u4F7F\u7528\uFF0C\u9002\u5408\u4F4E\u914D\u8BBE\u5907",
        config: {
          ...this.defaultConfig,
          autoExtractDetails: false,
          maxAutoExtractions: 3,
          extractionBatchSize: 2,
          maxDownloadLinks: 5,
          maxMagnetLinks: 5,
          maxScreenshots: 5,
          extractionTimeout: 1e4,
          maxConcurrentExtractions: 1,
          enableImagePreview: false,
          compactMode: true
        }
      },
      balanced: {
        name: "\u5E73\u8861\u6A21\u5F0F",
        description: "\u6027\u80FD\u548C\u529F\u80FD\u7684\u5E73\u8861\u914D\u7F6E",
        config: this.defaultConfig
      },
      aggressive: {
        name: "\u6027\u80FD\u6A21\u5F0F",
        description: "\u6700\u5927\u5316\u63D0\u53D6\u901F\u5EA6\u548C\u5185\u5BB9\uFF0C\u9002\u5408\u9AD8\u914D\u8BBE\u5907",
        config: {
          ...this.defaultConfig,
          autoExtractDetails: true,
          maxAutoExtractions: 10,
          extractionBatchSize: 5,
          maxDownloadLinks: 15,
          maxMagnetLinks: 15,
          maxScreenshots: 15,
          extractionTimeout: 25e3,
          maxConcurrentExtractions: 5,
          enableConcurrentExtraction: true,
          enableSmartBatching: true,
          cacheDuration: 1728e5
          // 48小时
        }
      },
      quality: {
        name: "\u8D28\u91CF\u4F18\u5148",
        description: "\u6CE8\u91CD\u6570\u636E\u8D28\u91CF\u548C\u51C6\u786E\u6027",
        config: {
          ...this.defaultConfig,
          extractionTimeout: 2e4,
          maxRetryAttempts: 3,
          requireMinimumData: true,
          enableStrictDomainCheck: true,
          validateImageUrls: true,
          validateDownloadLinks: true,
          skipLowQualityResults: true
        }
      }
    };
  }
};
var detailConfigService = new DetailConfigService();

// src/handlers/detail-helpers.js
function validateBatchInput(searchResults, options) {
  if (!Array.isArray(searchResults) || searchResults.length === 0) {
    return {
      valid: false,
      message: "\u641C\u7D22\u7ED3\u679C\u5217\u8868\u4E0D\u80FD\u4E3A\u7A7A",
      details: { type: "empty_array" }
    };
  }
  const maxBatchSize = CONFIG.DETAIL_EXTRACTION.MAX_BATCH_SIZE;
  if (searchResults.length > maxBatchSize) {
    return {
      valid: false,
      message: `\u6279\u91CF\u5904\u7406\u6570\u91CF\u4E0D\u80FD\u8D85\u8FC7 ${maxBatchSize} \u4E2A`,
      details: {
        current: searchResults.length,
        max: maxBatchSize
      }
    };
  }
  const invalidResults = [];
  searchResults.forEach((result, index) => {
    if (!result || !result.url) {
      invalidResults.push({ index, issue: "missing_url" });
    } else {
      try {
        new URL(result.url);
      } catch {
        invalidResults.push({ index, issue: "invalid_url", url: result.url });
      }
    }
  });
  if (invalidResults.length > 0) {
    return {
      valid: false,
      message: "\u5B58\u5728\u65E0\u6548\u7684\u641C\u7D22\u7ED3\u679C\u6570\u636E",
      details: { invalidResults }
    };
  }
  return { valid: true };
}
__name(validateBatchInput, "validateBatchInput");
function createProgressCallback() {
  return (progress) => {
    console.log(`\u6279\u91CF\u63D0\u53D6\u8FDB\u5EA6: ${progress.current}/${progress.total} (${progress.status}) - ${progress.item}`);
  };
}
__name(createProgressCallback, "createProgressCallback");
function generateBatchStats(detailResults, totalTime) {
  const stats = {
    total: detailResults.length,
    successful: 0,
    cached: 0,
    failed: 0,
    partial: 0,
    totalTime,
    averageTime: 0,
    successRate: 0,
    cacheHitRate: 0
  };
  detailResults.forEach((result) => {
    switch (result.extractionStatus) {
      case "success":
        stats.successful++;
        break;
      case "cached":
        stats.cached++;
        stats.successful++;
        break;
      case "partial":
        stats.partial++;
        break;
      case "error":
      default:
        stats.failed++;
        break;
    }
  });
  if (stats.total > 0) {
    stats.averageTime = Math.round(totalTime / stats.total);
    stats.successRate = Math.round(stats.successful / stats.total * 100);
    stats.cacheHitRate = Math.round(stats.cached / stats.total * 100);
  }
  stats.bySource = {};
  detailResults.forEach((result) => {
    const sourceType = result.sourceType || "unknown";
    if (!stats.bySource[sourceType]) {
      stats.bySource[sourceType] = {
        total: 0,
        successful: 0,
        failed: 0,
        avgTime: 0
      };
    }
    stats.bySource[sourceType].total++;
    if (result.extractionStatus === "success" || result.extractionStatus === "cached") {
      stats.bySource[sourceType].successful++;
    } else {
      stats.bySource[sourceType].failed++;
    }
  });
  return stats;
}
__name(generateBatchStats, "generateBatchStats");
function buildBatchSuccessResponse(detailResults, stats, originalCount) {
  return utils.successResponse({
    results: detailResults.map((result) => ({
      // 基本信息
      title: result.title || "unknown",
      code: result.code || "",
      url: result.url || result.detailUrl || result.searchUrl,
      sourceType: result.sourceType || "unknown",
      // 提取状态
      extractionStatus: result.extractionStatus || "unknown",
      extractionTime: result.extractionTime || 0,
      extractionError: result.extractionError || null,
      // 详情数据（只在成功时包含完整数据）
      ...result.extractionStatus === "success" || result.extractionStatus === "cached" ? {
        coverImage: result.coverImage,
        screenshots: result.screenshots,
        actresses: result.actresses,
        downloadLinks: result.downloadLinks,
        magnetLinks: result.magnetLinks,
        description: result.description,
        tags: result.tags,
        rating: result.rating
      } : {}
    })),
    stats: {
      ...stats,
      performance: {
        itemsPerSecond: stats.totalTime > 0 ? Math.round(stats.total * 1e3 / stats.totalTime) : 0,
        averageTimePerItem: stats.averageTime,
        totalTime: stats.totalTime
      }
    },
    summary: {
      processed: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      cached: stats.cached,
      message: `\u6279\u91CF\u8BE6\u60C5\u63D0\u53D6\u5B8C\u6210: ${stats.successful}/${stats.total} \u6210\u529F (${stats.successRate}%)`
    }
  });
}
__name(buildBatchSuccessResponse, "buildBatchSuccessResponse");
function buildBatchErrorResponse(error, totalTime) {
  return utils.errorResponse({
    message: "\u6279\u91CF\u8BE6\u60C5\u63D0\u53D6\u5931\u8D25: " + error.message,
    error: {
      type: error.name || "BatchExtractionError",
      message: error.message,
      totalTime
    },
    stats: {
      total: 0,
      successful: 0,
      cached: 0,
      failed: 0,
      totalTime,
      averageTime: 0
    }
  }, 500);
}
__name(buildBatchErrorResponse, "buildBatchErrorResponse");
function parseHistoryParams(searchParams) {
  return {
    limit: Math.min(parseInt(searchParams.get("limit") || "20"), 100),
    offset: Math.max(parseInt(searchParams.get("offset") || "0"), 0),
    source: searchParams.get("source") || null,
    status: searchParams.get("status") || null,
    dateRange: searchParams.get("dateRange") || null,
    keyword: searchParams.get("keyword") || null,
    sortBy: searchParams.get("sortBy") || "created_at",
    sortOrder: searchParams.get("sortOrder") || "DESC"
  };
}
__name(parseHistoryParams, "parseHistoryParams");
function buildHistoryQuery(userId, params) {
  let query = `
    SELECT * FROM detail_extraction_history 
    WHERE user_id = ?
  `;
  const queryParams = [userId];
  if (params.source) {
    query += ` AND source_type = ?`;
    queryParams.push(params.source);
  }
  if (params.status) {
    query += ` AND extraction_status = ?`;
    queryParams.push(params.status);
  }
  if (params.keyword) {
    query += ` AND (url LIKE ? OR keyword LIKE ?)`;
    const keywordPattern = `%${params.keyword}%`;
    queryParams.push(keywordPattern, keywordPattern);
  }
  if (params.dateRange) {
    const dateRanges = {
      "today": Date.now() - 24 * 60 * 60 * 1e3,
      "week": Date.now() - 7 * 24 * 60 * 60 * 1e3,
      "month": Date.now() - 30 * 24 * 60 * 60 * 1e3,
      "quarter": Date.now() - 90 * 24 * 60 * 60 * 1e3
    };
    if (dateRanges[params.dateRange]) {
      query += ` AND created_at >= ?`;
      queryParams.push(dateRanges[params.dateRange]);
    }
  }
  const validSortColumns = ["created_at", "extraction_time", "extraction_status"];
  const sortBy = validSortColumns.includes(params.sortBy) ? params.sortBy : "created_at";
  const sortOrder = ["ASC", "DESC"].includes(params.sortOrder) ? params.sortOrder : "DESC";
  query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
  queryParams.push(params.limit, params.offset);
  return { query, queryParams };
}
__name(buildHistoryQuery, "buildHistoryQuery");
function buildHistoryCountQuery(userId, params) {
  let query = `SELECT COUNT(*) as total FROM detail_extraction_history WHERE user_id = ?`;
  const queryParams = [userId];
  if (params.source) {
    query += ` AND source_type = ?`;
    queryParams.push(params.source);
  }
  if (params.status) {
    query += ` AND extraction_status = ?`;
    queryParams.push(params.status);
  }
  if (params.keyword) {
    query += ` AND (url LIKE ? OR keyword LIKE ?)`;
    const keywordPattern = `%${params.keyword}%`;
    queryParams.push(keywordPattern, keywordPattern);
  }
  return { query, params: queryParams };
}
__name(buildHistoryCountQuery, "buildHistoryCountQuery");
function enhanceHistoryItem(item) {
  return {
    id: item.id,
    url: item.url,
    sourceType: item.source_type,
    keyword: item.keyword,
    extractionStatus: item.extraction_status,
    extractionTime: item.extraction_time,
    extractionError: item.extraction_error,
    dataSize: item.data_size,
    createdAt: new Date(item.created_at).toISOString(),
    // 增强字段
    relativeTime: getRelativeTime(item.created_at),
    statusBadge: getStatusBadge(item.extraction_status),
    performanceRating: getPerformanceRating(item.extraction_time),
    estimatedQuality: getEstimatedQuality(item)
  };
}
__name(enhanceHistoryItem, "enhanceHistoryItem");
async function getUserSpecificCacheStats(env, userId) {
  try {
    const userCacheQuery = await env.DB.prepare(`
      SELECT 
        COUNT(*) as userCacheItems,
        AVG(cache_size) as avgUserCacheSize,
        SUM(access_count) as totalUserAccess
      FROM detail_cache dc
      JOIN detail_extraction_history deh ON dc.url_hash = deh.url
      WHERE deh.user_id = ?
    `).bind(userId).first();
    return {
      cacheItems: userCacheQuery?.userCacheItems || 0,
      averageSize: Math.round(userCacheQuery?.avgUserCacheSize || 0),
      totalAccess: userCacheQuery?.totalUserAccess || 0,
      hitRate: userCacheQuery?.totalUserAccess > 0 ? Math.round(userCacheQuery.totalUserAccess / Math.max(userCacheQuery.userCacheItems, 1) * 100) : 0
    };
  } catch (error) {
    console.warn("\u83B7\u53D6\u7528\u6237\u7F13\u5B58\u7EDF\u8BA1\u5931\u8D25:", error);
    return { cacheItems: 0, averageSize: 0, totalAccess: 0, hitRate: 0 };
  }
}
__name(getUserSpecificCacheStats, "getUserSpecificCacheStats");
async function getSourceTypeStats(env, userId = null) {
  try {
    let query = `
      SELECT 
        source_type,
        COUNT(*) as count,
        AVG(extraction_time) as avg_time,
        COUNT(CASE WHEN extraction_status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cached_count
      FROM detail_extraction_history
    `;
    const params = [];
    if (userId) {
      query += ` WHERE user_id = ?`;
      params.push(userId);
    }
    query += ` GROUP BY source_type ORDER BY count DESC LIMIT 10`;
    const result = await env.DB.prepare(query).bind(...params).all();
    return result.results.map((item) => ({
      sourceType: item.source_type,
      count: item.count,
      averageTime: Math.round(item.avg_time || 0),
      successRate: item.count > 0 ? Math.round(item.success_count / item.count * 100) : 0,
      cacheHitRate: item.count > 0 ? Math.round(item.cached_count / item.count * 100) : 0
    }));
  } catch (error) {
    console.warn("\u83B7\u53D6\u6E90\u7C7B\u578B\u7EDF\u8BA1\u5931\u8D25:", error);
    return [];
  }
}
__name(getSourceTypeStats, "getSourceTypeStats");
async function getCacheEfficiencyStats(env, userId) {
  try {
    const efficiencyQuery = await env.DB.prepare(`
      SELECT 
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cached_count,
        COUNT(*) as total_count,
        AVG(CASE WHEN extraction_status != 'cached' THEN extraction_time END) as avg_extraction_time,
        AVG(CASE WHEN extraction_status = 'cached' THEN extraction_time END) as avg_cache_time
      FROM detail_extraction_history
      WHERE user_id = ? AND created_at >= ?
    `).bind(userId, Date.now() - 30 * 24 * 60 * 60 * 1e3).first();
    const cacheHitRate = efficiencyQuery?.total_count > 0 ? Math.round(efficiencyQuery.cached_count / efficiencyQuery.total_count * 100) : 0;
    const timeSaved = (efficiencyQuery?.avg_extraction_time || 0) - (efficiencyQuery?.avg_cache_time || 0);
    return {
      hitRate: cacheHitRate,
      timeSavedPerRequest: Math.max(0, Math.round(timeSaved)),
      totalTimeSaved: Math.max(0, Math.round(timeSaved * (efficiencyQuery?.cached_count || 0))),
      efficiency: cacheHitRate > 70 ? "excellent" : cacheHitRate > 50 ? "good" : cacheHitRate > 30 ? "fair" : "poor"
    };
  } catch (error) {
    console.warn("\u83B7\u53D6\u7F13\u5B58\u6548\u7387\u7EDF\u8BA1\u5931\u8D25:", error);
    return { hitRate: 0, timeSavedPerRequest: 0, totalTimeSaved: 0, efficiency: "unknown" };
  }
}
__name(getCacheEfficiencyStats, "getCacheEfficiencyStats");
function parseClearParams(searchParams) {
  return {
    count: Math.min(parseInt(searchParams.get("count") || "10"), 100),
    olderThan: searchParams.get("olderThan") || null,
    sourceType: searchParams.get("sourceType") || null,
    minSize: parseInt(searchParams.get("minSize") || "0"),
    maxSize: parseInt(searchParams.get("maxSize") || "0") || null
  };
}
__name(parseClearParams, "parseClearParams");
async function handleExpiredCacheCleanup(env, params) {
  try {
    const count = await cacheManager.cleanupExpiredCache();
    return count;
  } catch (error) {
    console.warn("\u7F13\u5B58\u7BA1\u7406\u5668\u6E05\u7406\u5931\u8D25\uFF0C\u4F7F\u7528\u6570\u636E\u5E93\u6E05\u7406:", error.message);
    const result = await env.DB.prepare(`
      DELETE FROM detail_cache WHERE expires_at < ?
    `).bind(Date.now()).run();
    return result.changes || 0;
  }
}
__name(handleExpiredCacheCleanup, "handleExpiredCacheCleanup");
async function handleAllCacheCleanup(env, params) {
  try {
    await cacheManager.clearAllCache();
    const result = await env.DB.prepare(`DELETE FROM detail_cache`).run();
    return {
      count: result.changes || 0,
      details: { operation: "clear_all", timestamp: Date.now() }
    };
  } catch (error) {
    console.warn("\u5168\u90E8\u7F13\u5B58\u6E05\u7406\u5931\u8D25:", error);
    return { count: 0, details: { error: error.message } };
  }
}
__name(handleAllCacheCleanup, "handleAllCacheCleanup");
async function handleLRUCacheCleanup(env, params) {
  try {
    await cacheManager.cleanupLeastRecentlyUsed(params.count);
    return {
      count: params.count,
      details: {
        operation: "lru_cleanup",
        targetCount: params.count,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.warn("LRU\u7F13\u5B58\u6E05\u7406\u5931\u8D25\uFF0C\u4F7F\u7528\u6570\u636E\u5E93\u6E05\u7406:", error.message);
    const result = await env.DB.prepare(`
      DELETE FROM detail_cache 
      WHERE id IN (
        SELECT id FROM detail_cache 
        ORDER BY last_accessed ASC 
        LIMIT ?
      )
    `).bind(params.count).run();
    return {
      count: result.changes || 0,
      details: { operation: "lru_fallback", error: error.message }
    };
  }
}
__name(handleLRUCacheCleanup, "handleLRUCacheCleanup");
async function handleSelectiveCacheCleanup(env, params) {
  let query = `DELETE FROM detail_cache WHERE 1=1`;
  const queryParams = [];
  if (params.olderThan) {
    const olderThanTime = Date.now() - parseInt(params.olderThan) * 24 * 60 * 60 * 1e3;
    query += ` AND created_at < ?`;
    queryParams.push(olderThanTime);
  }
  if (params.sourceType) {
    query += ` AND url LIKE ?`;
    queryParams.push(`%${params.sourceType}%`);
  }
  if (params.minSize > 0) {
    query += ` AND cache_size >= ?`;
    queryParams.push(params.minSize);
  }
  if (params.maxSize) {
    query += ` AND cache_size <= ?`;
    queryParams.push(params.maxSize);
  }
  try {
    const result = await env.DB.prepare(query).bind(...queryParams).run();
    return {
      count: result.changes || 0,
      details: {
        operation: "selective_cleanup",
        criteria: params,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.warn("\u9009\u62E9\u6027\u7F13\u5B58\u6E05\u7406\u5931\u8D25:", error);
    return {
      count: 0,
      details: { error: error.message }
    };
  }
}
__name(handleSelectiveCacheCleanup, "handleSelectiveCacheCleanup");
function getRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 6e4) return "\u521A\u521A";
  if (diff < 36e5) return `${Math.floor(diff / 6e4)}\u5206\u949F\u524D`;
  if (diff < 864e5) return `${Math.floor(diff / 36e5)}\u5C0F\u65F6\u524D`;
  if (diff < 6048e5) return `${Math.floor(diff / 864e5)}\u5929\u524D`;
  return `${Math.floor(diff / 6048e5)}\u5468\u524D`;
}
__name(getRelativeTime, "getRelativeTime");
function getStatusBadge(status) {
  const badges = {
    "success": { text: "\u6210\u529F", color: "green", icon: "\u2713" },
    "cached": { text: "\u7F13\u5B58", color: "blue", icon: "\u26A1" },
    "partial": { text: "\u90E8\u5206", color: "yellow", icon: "\u26A0" },
    "error": { text: "\u5931\u8D25", color: "red", icon: "\u2717" },
    "timeout": { text: "\u8D85\u65F6", color: "orange", icon: "\u23F1" }
  };
  return badges[status] || { text: "\u672A\u77E5", color: "gray", icon: "?" };
}
__name(getStatusBadge, "getStatusBadge");
function getPerformanceRating(extractionTime) {
  if (extractionTime < 3e3) return "excellent";
  if (extractionTime < 8e3) return "good";
  if (extractionTime < 15e3) return "fair";
  return "poor";
}
__name(getPerformanceRating, "getPerformanceRating");
function getEstimatedQuality(item) {
  let score = 0;
  if (item.extraction_time < 5e3) score += 2;
  else if (item.extraction_time < 1e4) score += 1;
  if (item.data_size > 5e3) score += 2;
  else if (item.data_size > 2e3) score += 1;
  if (item.extraction_status === "success") score += 3;
  else if (item.extraction_status === "cached") score += 2;
  if (score >= 6) return "high";
  if (score >= 4) return "medium";
  if (score >= 2) return "low";
  return "unknown";
}
__name(getEstimatedQuality, "getEstimatedQuality");

// src/handlers/detail.js
var cacheManagerInitialized = false;
async function ensureCacheManagerInitialized(env) {
  if (!cacheManagerInitialized) {
    try {
      await initializeCacheManager(env);
      cacheManagerInitialized = true;
      console.log("\u7F13\u5B58\u7BA1\u7406\u5668\u521D\u59CB\u5316\u6210\u529F");
    } catch (error) {
      console.warn("\u7F13\u5B58\u7BA1\u7406\u5668\u521D\u59CB\u5316\u5931\u8D25\uFF0C\u5C06\u4F7F\u7528\u964D\u7EA7\u6A21\u5F0F:", error.message);
    }
  }
}
__name(ensureCacheManagerInitialized, "ensureCacheManagerInitialized");
async function applyConfigPresetHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await utils.safeJsonParse(request, {});
    const { preset } = body;
    if (!preset) {
      return utils.errorResponse("\u9884\u8BBE\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const presets = detailConfigService.getConfigPresets();
    if (!presets[preset]) {
      return utils.errorResponse(`\u672A\u77E5\u7684\u914D\u7F6E\u9884\u8BBE: ${preset}`, 400);
    }
    const presetConfig = presets[preset].config;
    await detailConfigService.saveUserConfig(env, user.id, presetConfig);
    try {
      await utils.logUserAction(env, user.id, "detail_config_preset_apply", {
        preset,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn("\u8BB0\u5F55\u9884\u8BBE\u5E94\u7528\u5931\u8D25:", logError.message);
    }
    return utils.successResponse({
      message: `\u5DF2\u5E94\u7528 ${presets[preset].name} \u914D\u7F6E\u9884\u8BBE`,
      preset,
      config: presetConfig,
      description: presets[preset].description
    });
  } catch (error) {
    console.error("\u5E94\u7528\u914D\u7F6E\u9884\u8BBE\u5931\u8D25:", error);
    return utils.errorResponse("\u5E94\u7528\u9884\u8BBE\u5931\u8D25: " + error.message, 500);
  }
}
__name(applyConfigPresetHandler, "applyConfigPresetHandler");
function validateExtractionInput(searchResult2) {
  if (!searchResult2 || !searchResult2.url) {
    return {
      valid: false,
      message: "\u641C\u7D22\u7ED3\u679C\u6570\u636E\u4E0D\u5B8C\u6574",
      details: { missing: ["url"] }
    };
  }
  try {
    new URL(searchResult2.url);
  } catch (error) {
    return {
      valid: false,
      message: "\u65E0\u6548\u7684URL\u683C\u5F0F",
      details: { invalidUrl: searchResult2.url }
    };
  }
  return { valid: true };
}
__name(validateExtractionInput, "validateExtractionInput");
function buildExtractionOptionsFromConfig(userConfig, overrideOptions = {}) {
  return {
    // 基础选项
    enableCache: userConfig.enableCache && overrideOptions.enableCache !== false,
    timeout: overrideOptions.timeout || userConfig.extractionTimeout,
    enableRetry: userConfig.enableRetry && overrideOptions.enableRetry !== false,
    maxRetries: overrideOptions.maxRetries || userConfig.maxRetryAttempts,
    // 内容控制
    maxDownloadLinks: userConfig.maxDownloadLinks,
    maxMagnetLinks: userConfig.maxMagnetLinks,
    maxScreenshots: userConfig.maxScreenshots,
    // 质量控制
    strictValidation: userConfig.enableStrictDomainCheck,
    requireMinimumData: userConfig.requireMinimumData,
    validateImageUrls: userConfig.validateImageUrls,
    validateDownloadLinks: userConfig.validateDownloadLinks,
    // 过滤选项
    enableContentFilter: userConfig.enableContentFilter,
    contentFilterKeywords: userConfig.contentFilterKeywords,
    enableSpamFilter: userConfig.enableSpamFilter,
    // 其他选项
    sourceType: overrideOptions.sourceType || null,
    preferOriginalSources: userConfig.preferOriginalSources,
    enableAutoCodeExtraction: userConfig.enableAutoCodeExtraction
  };
}
__name(buildExtractionOptionsFromConfig, "buildExtractionOptionsFromConfig");
function buildBatchExtractionOptionsFromConfig(userConfig, overrideOptions = {}) {
  const baseOptions = buildExtractionOptionsFromConfig(userConfig, overrideOptions);
  return {
    ...baseOptions,
    // 批量特定选项
    batchSize: overrideOptions.batchSize || userConfig.extractionBatchSize,
    maxConcurrency: userConfig.enableConcurrentExtraction ? overrideOptions.maxConcurrency || userConfig.maxConcurrentExtractions : 1,
    enableSmartBatching: userConfig.enableSmartBatching,
    progressInterval: overrideOptions.progressInterval || 1e3,
    stopOnError: overrideOptions.stopOnError || false
  };
}
__name(buildBatchExtractionOptionsFromConfig, "buildBatchExtractionOptionsFromConfig");
function buildSuccessResponse(detailInfo, searchResult2, startTime, userConfig) {
  const extractionTime = Date.now() - startTime;
  const filteredDetailInfo = filterDetailInfoByConfig(detailInfo, userConfig);
  return utils.successResponse({
    detailInfo: {
      // 基本信息
      title: filteredDetailInfo.title || searchResult2.title || "\u672A\u77E5\u6807\u9898",
      code: filteredDetailInfo.code || "",
      sourceType: filteredDetailInfo.sourceType || "unknown",
      // URL信息
      detailUrl: filteredDetailInfo.detailPageUrl || filteredDetailInfo.detailUrl || searchResult2.url,
      searchUrl: filteredDetailInfo.searchUrl || searchResult2.url,
      originalUrl: searchResult2.url,
      // 根据配置显示的内容
      ...filteredDetailInfo,
      // 提取元数据
      extractionStatus: detailInfo.extractionStatus || "unknown",
      extractionTime: detailInfo.extractionTime || extractionTime,
      extractedAt: detailInfo.extractedAt || Date.now(),
      fromCache: detailInfo.extractionStatus === "cached"
    },
    metadata: {
      totalTime: extractionTime,
      fromCache: detailInfo.extractionStatus === "cached",
      retryCount: detailInfo.retryCount || 0,
      cacheKey: detailInfo.cacheKey || null,
      configApplied: true,
      userConfigured: true
    },
    message: detailInfo.extractionStatus === "success" ? "\u8BE6\u60C5\u63D0\u53D6\u5B8C\u6210" : detailInfo.extractionStatus === "cached" ? "\u4F7F\u7528\u7F13\u5B58\u6570\u636E" : "\u8BE6\u60C5\u63D0\u53D6\u5931\u8D25"
  });
}
__name(buildSuccessResponse, "buildSuccessResponse");
function filterDetailInfoByConfig(detailInfo, userConfig) {
  const filtered = {
    title: detailInfo.title,
    code: detailInfo.code,
    sourceType: detailInfo.sourceType,
    detailPageUrl: detailInfo.detailPageUrl,
    searchUrl: detailInfo.searchUrl
  };
  if (userConfig.showScreenshots && detailInfo.screenshots) {
    filtered.screenshots = detailInfo.screenshots.slice(0, userConfig.maxScreenshots);
  }
  if (userConfig.showDownloadLinks && detailInfo.downloadLinks) {
    filtered.downloadLinks = detailInfo.downloadLinks.slice(0, userConfig.maxDownloadLinks);
  }
  if (userConfig.showMagnetLinks && detailInfo.magnetLinks) {
    filtered.magnetLinks = detailInfo.magnetLinks.slice(0, userConfig.maxMagnetLinks);
  }
  if (userConfig.showActressInfo && detailInfo.actresses) {
    filtered.actresses = detailInfo.actresses;
  }
  if (userConfig.showExtractedTags && detailInfo.tags) {
    filtered.tags = detailInfo.tags;
  }
  if (userConfig.showRating && detailInfo.rating) {
    filtered.rating = detailInfo.rating;
  }
  if (userConfig.showDescription && detailInfo.description) {
    filtered.description = detailInfo.description;
  }
  if (detailInfo.coverImage) filtered.coverImage = detailInfo.coverImage;
  if (detailInfo.director) filtered.director = detailInfo.director;
  if (detailInfo.studio) filtered.studio = detailInfo.studio;
  if (detailInfo.label) filtered.label = detailInfo.label;
  if (detailInfo.series) filtered.series = detailInfo.series;
  if (detailInfo.releaseDate) filtered.releaseDate = detailInfo.releaseDate;
  if (detailInfo.duration) filtered.duration = detailInfo.duration;
  if (detailInfo.quality) filtered.quality = detailInfo.quality;
  if (detailInfo.fileSize) filtered.fileSize = detailInfo.fileSize;
  if (detailInfo.resolution) filtered.resolution = detailInfo.resolution;
  return filtered;
}
__name(filterDetailInfoByConfig, "filterDetailInfoByConfig");
function buildErrorResponse(error, extractionTime, searchResult2) {
  const errorType = error.name || "UnknownError";
  let statusCode = 500;
  let errorCategory = "internal";
  switch (errorType) {
    case "ValidationError":
      statusCode = 400;
      errorCategory = "validation";
      break;
    case "TimeoutError":
      statusCode = 408;
      errorCategory = "timeout";
      break;
    case "NetworkError":
      statusCode = 502;
      errorCategory = "network";
      break;
    case "ParseError":
      statusCode = 422;
      errorCategory = "parsing";
      break;
  }
  const errorDetail = {
    extractionStatus: "error",
    extractionError: error.message,
    errorType,
    errorCategory,
    extractionTime,
    extractedAt: Date.now(),
    searchUrl: searchResult2?.url || "unknown",
    retryable: ["TimeoutError", "NetworkError"].includes(errorType)
  };
  return utils.errorResponse({
    message: "\u8BE6\u60C5\u63D0\u53D6\u5931\u8D25: " + error.message,
    detailInfo: errorDetail,
    error: {
      type: errorType,
      category: errorCategory,
      retryable: errorDetail.retryable,
      suggestions: generateErrorSuggestions(errorType, error.message)
    }
  }, statusCode);
}
__name(buildErrorResponse, "buildErrorResponse");
function generateErrorSuggestions(errorType, errorMessage) {
  const suggestions = [];
  switch (errorType) {
    case "TimeoutError":
      suggestions.push("\u5C1D\u8BD5\u589E\u52A0\u8D85\u65F6\u65F6\u95F4");
      suggestions.push("\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5");
      suggestions.push("\u7A0D\u540E\u91CD\u8BD5");
      break;
    case "ValidationError":
      suggestions.push("\u68C0\u67E5\u8F93\u5165\u6570\u636E\u683C\u5F0F");
      suggestions.push("\u786E\u4FDDURL\u6709\u6548");
      break;
    case "NetworkError":
      suggestions.push("\u68C0\u67E5\u7F51\u7EDC\u8FDE\u63A5");
      suggestions.push("\u76EE\u6807\u7F51\u7AD9\u53EF\u80FD\u6682\u65F6\u4E0D\u53EF\u7528");
      break;
    case "ParseError":
      suggestions.push("\u76EE\u6807\u9875\u9762\u7ED3\u6784\u53EF\u80FD\u5DF2\u53D8\u66F4");
      suggestions.push("\u5C1D\u8BD5\u4F7F\u7528\u901A\u7528\u89E3\u6790\u6A21\u5F0F");
      break;
  }
  return suggestions;
}
__name(generateErrorSuggestions, "generateErrorSuggestions");
function detectConfigChanges(currentConfig, newConfig) {
  const changes = {
    changed: [],
    added: [],
    removed: []
  };
  const allKeys = /* @__PURE__ */ new Set([...Object.keys(currentConfig), ...Object.keys(newConfig)]);
  for (const key of allKeys) {
    if (!(key in currentConfig)) {
      changes.added.push(key);
    } else if (!(key in newConfig)) {
      changes.removed.push(key);
    } else if (JSON.stringify(currentConfig[key]) !== JSON.stringify(newConfig[key])) {
      changes.changed.push({
        key,
        from: currentConfig[key],
        to: newConfig[key]
      });
    }
  }
  return changes;
}
__name(detectConfigChanges, "detectConfigChanges");
async function isUsingDefaultConfig(env, userId) {
  try {
    const userConfig = await env.DB.prepare(`
      SELECT id FROM detail_extraction_config WHERE user_id = ?
    `).bind(userId).first();
    return !userConfig;
  } catch (error) {
    console.error("\u68C0\u67E5\u9ED8\u8BA4\u914D\u7F6E\u72B6\u6001\u5931\u8D25:", error);
    return true;
  }
}
__name(isUsingDefaultConfig, "isUsingDefaultConfig");
async function getUserUsageStats(env, userId) {
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as totalExtractions,
        COUNT(CASE WHEN extraction_status = 'success' THEN 1 END) as successfulExtractions,
        COUNT(CASE WHEN extraction_status = 'cached' THEN 1 END) as cachedExtractions,
        AVG(extraction_time) as averageTime,
        MAX(extraction_time) as maxTime,
        MIN(extraction_time) as minTime
      FROM detail_extraction_history 
      WHERE user_id = ? AND created_at >= ?
    `).bind(userId, Date.now() - 30 * 24 * 60 * 60 * 1e3).first();
    return {
      totalExtractions: stats?.totalExtractions || 0,
      successfulExtractions: stats?.successfulExtractions || 0,
      cachedExtractions: stats?.cachedExtractions || 0,
      averageTime: Math.round(stats?.averageTime || 0),
      maxTime: stats?.maxTime || 0,
      minTime: stats?.minTime || 0,
      successRate: stats?.totalExtractions > 0 ? Math.round(stats.successfulExtractions / stats.totalExtractions * 100) : 0,
      cacheHitRate: stats?.totalExtractions > 0 ? Math.round(stats.cachedExtractions / stats.totalExtractions * 100) : 0
    };
  } catch (error) {
    console.error("\u83B7\u53D6\u7528\u6237\u4F7F\u7528\u7EDF\u8BA1\u5931\u8D25:", error);
    return {
      totalExtractions: 0,
      successfulExtractions: 0,
      cachedExtractions: 0,
      averageTime: 0,
      maxTime: 0,
      minTime: 0,
      successRate: 0,
      cacheHitRate: 0
    };
  }
}
__name(getUserUsageStats, "getUserUsageStats");
function getUserDetailStats(env, userId) {
  return getUserUsageStats(env, userId);
}
__name(getUserDetailStats, "getUserDetailStats");
function getPerformanceStats(env, userId) {
  return getUserUsageStats(env, userId);
}
__name(getPerformanceStats, "getPerformanceStats");
function logUserExtractionAction(env, userId, searchResult2, detailInfo, request) {
  return utils.logUserAction(env, userId, "detail_extraction", {
    url: searchResult2.url,
    title: searchResult2.title,
    extractionStatus: detailInfo.extractionStatus,
    extractionTime: detailInfo.extractionTime,
    sourceType: detailInfo.sourceType
  }, request);
}
__name(logUserExtractionAction, "logUserExtractionAction");
function logBatchExtractionAction(env, userId, searchResults, detailResults, stats, request) {
  return utils.logUserAction(env, userId, "batch_detail_extraction", {
    totalResults: searchResults.length,
    successfulExtractions: stats.successful,
    failedExtractions: stats.failed,
    totalTime: stats.totalTime
  }, request);
}
__name(logBatchExtractionAction, "logBatchExtractionAction");
async function extractSingleDetailHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  try {
    await ensureCacheManagerInitialized(env);
    const body = await utils.safeJsonParse(request, {});
    const { searchResult: searchResult2, options = {} } = body;
    const validationResult = validateExtractionInput(searchResult2);
    if (!validationResult.valid) {
      return utils.errorResponse(validationResult.message, 400);
    }
    user = await authenticate(request, env).catch(() => null);
    const userConfig = user ? await detailConfigService.getUserConfig(env, user.id) : detailConfigService.getDefaultUserConfig();
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse("\u8BE6\u60C5\u63D0\u53D6\u529F\u80FD\u5DF2\u88AB\u7981\u7528", 403);
    }
    const extractOptions = buildExtractionOptionsFromConfig(userConfig, options);
    console.log(`\u5F00\u59CB\u63D0\u53D6\u8BE6\u60C5: ${searchResult2.title} - ${searchResult2.url}`);
    console.log("\u4F7F\u7528\u914D\u7F6E:", extractOptions);
    const detailInfo = await detailExtractor.extractSingleDetail(searchResult2, extractOptions);
    if (user) {
      try {
        await logUserExtractionAction(env, user.id, searchResult2, detailInfo, request);
      } catch (logError) {
        console.warn("\u8BB0\u5F55\u7528\u6237\u884C\u4E3A\u5931\u8D25:", logError.message);
      }
    }
    return buildSuccessResponse(detailInfo, searchResult2, startTime, userConfig);
  } catch (error) {
    const extractionTime = Date.now() - startTime;
    console.error("\u8BE6\u60C5\u63D0\u53D6\u5904\u7406\u5931\u8D25:", error);
    return buildErrorResponse(error, extractionTime, searchResult);
  }
}
__name(extractSingleDetailHandler, "extractSingleDetailHandler");
async function extractBatchDetailsHandler(request, env) {
  const startTime = Date.now();
  let user = null;
  try {
    await ensureCacheManagerInitialized(env);
    const body = await utils.safeJsonParse(request, {});
    const { searchResults, options = {} } = body;
    const batchValidation = validateBatchInput(searchResults, options);
    if (!batchValidation.valid) {
      return utils.errorResponse(batchValidation.message, 400);
    }
    user = await authenticate(request, env).catch(() => null);
    const userConfig = user ? await detailConfigService.getUserConfig(env, user.id) : detailConfigService.getDefaultUserConfig();
    if (!userConfig.enableDetailExtraction) {
      return utils.errorResponse("\u8BE6\u60C5\u63D0\u53D6\u529F\u80FD\u5DF2\u88AB\u7981\u7528", 403);
    }
    const extractOptions = buildBatchExtractionOptionsFromConfig(userConfig, options);
    console.log(`\u5F00\u59CB\u6279\u91CF\u63D0\u53D6 ${searchResults.length} \u4E2A\u7ED3\u679C\u7684\u8BE6\u60C5`);
    console.log("\u6279\u91CF\u63D0\u53D6\u914D\u7F6E:", extractOptions);
    const progressCallback = createProgressCallback();
    const detailResults = await detailExtractor.extractBatchDetails(searchResults, {
      ...extractOptions,
      onProgress: progressCallback
    });
    const totalTime = Date.now() - startTime;
    const stats = generateBatchStats(detailResults, totalTime);
    if (user) {
      try {
        await logBatchExtractionAction(env, user.id, searchResults, detailResults, stats, request);
      } catch (logError) {
        console.warn("\u8BB0\u5F55\u6279\u91CF\u7528\u6237\u884C\u4E3A\u5931\u8D25:", logError.message);
      }
    }
    return buildBatchSuccessResponse(detailResults, stats, searchResults.length);
  } catch (error) {
    console.error("\u6279\u91CF\u8BE6\u60C5\u63D0\u53D6\u5931\u8D25:", error);
    const totalTime = Date.now() - startTime;
    return buildBatchErrorResponse(error, totalTime);
  }
}
__name(extractBatchDetailsHandler, "extractBatchDetailsHandler");
async function getDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const userConfig = await detailConfigService.getUserConfig(env, user.id);
    const metadata = detailConfigService.getConfigMetadata();
    const presets = detailConfigService.getConfigPresets();
    const usageStats = await getUserUsageStats(env, user.id);
    return utils.successResponse({
      config: userConfig,
      metadata,
      presets,
      usage: usageStats,
      isDefault: await isUsingDefaultConfig(env, user.id)
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u8BE6\u60C5\u63D0\u53D6\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u914D\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(getDetailExtractionConfigHandler, "getDetailExtractionConfigHandler");
async function updateDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const body = await utils.safeJsonParse(request, {});
    const { config, validateOnly = false, preset = null } = body;
    let configToSave;
    if (preset) {
      const presets = detailConfigService.getConfigPresets();
      if (!presets[preset]) {
        return utils.errorResponse(`\u672A\u77E5\u7684\u914D\u7F6E\u9884\u8BBE: ${preset}`, 400);
      }
      configToSave = presets[preset].config;
    } else {
      configToSave = config;
    }
    if (!configToSave || typeof configToSave !== "object") {
      return utils.errorResponse("\u914D\u7F6E\u6570\u636E\u683C\u5F0F\u9519\u8BEF", 400);
    }
    const validation = detailConfigService.validateConfig(configToSave);
    if (!validation.valid) {
      return utils.errorResponse({
        message: "\u914D\u7F6E\u9A8C\u8BC1\u5931\u8D25",
        errors: validation.errors,
        warnings: validation.warnings
      }, 400);
    }
    if (validateOnly) {
      return utils.successResponse({
        valid: true,
        warnings: validation.warnings
      });
    }
    const currentConfig = await detailConfigService.getUserConfig(env, user.id);
    const changes = detectConfigChanges(currentConfig, configToSave);
    const saveResult = await detailConfigService.saveUserConfig(env, user.id, configToSave);
    try {
      await utils.logUserAction(env, user.id, "detail_config_update", {
        preset,
        changes,
        validation: validation.warnings,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn("\u8BB0\u5F55\u914D\u7F6E\u66F4\u65B0\u5931\u8D25:", logError.message);
    }
    return utils.successResponse({
      message: "\u914D\u7F6E\u66F4\u65B0\u6210\u529F",
      config: configToSave,
      changes,
      warnings: saveResult.warnings,
      preset: preset || null
    });
  } catch (error) {
    console.error("\u66F4\u65B0\u8BE6\u60C5\u63D0\u53D6\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u66F4\u65B0\u914D\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(updateDetailExtractionConfigHandler, "updateDetailExtractionConfigHandler");
async function resetDetailExtractionConfigHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const result = await detailConfigService.resetUserConfig(env, user.id);
    try {
      await utils.logUserAction(env, user.id, "detail_config_reset", {
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn("\u8BB0\u5F55\u914D\u7F6E\u91CD\u7F6E\u5931\u8D25:", logError.message);
    }
    return utils.successResponse({
      message: "\u914D\u7F6E\u5DF2\u91CD\u7F6E\u4E3A\u9ED8\u8BA4\u503C",
      config: result.config
    });
  } catch (error) {
    console.error("\u91CD\u7F6E\u8BE6\u60C5\u63D0\u53D6\u914D\u7F6E\u5931\u8D25:", error);
    return utils.errorResponse("\u91CD\u7F6E\u914D\u7F6E\u5931\u8D25: " + error.message, 500);
  }
}
__name(resetDetailExtractionConfigHandler, "resetDetailExtractionConfigHandler");
async function getDetailExtractionHistoryHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const url = new URL(request.url);
    const params = parseHistoryParams(url.searchParams);
    const { query, queryParams } = buildHistoryQuery(user.id, params);
    const result = await env.DB.prepare(query).bind(...queryParams).all();
    const history = result.results.map((item) => enhanceHistoryItem(item));
    const countQuery = buildHistoryCountQuery(user.id, params);
    const countResult = await env.DB.prepare(countQuery.query).bind(...countQuery.params).first();
    const totalCount = countResult?.total || 0;
    return utils.successResponse({
      history,
      pagination: {
        total: totalCount,
        limit: params.limit,
        offset: params.offset,
        hasMore: result.results.length === params.limit,
        currentPage: Math.floor(params.offset / params.limit) + 1,
        totalPages: Math.ceil(totalCount / params.limit)
      },
      filters: {
        source: params.source,
        status: params.status,
        dateRange: params.dateRange
      }
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u8BE6\u60C5\u63D0\u53D6\u5386\u53F2\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u5386\u53F2\u5931\u8D25: " + error.message, 500);
  }
}
__name(getDetailExtractionHistoryHandler, "getDetailExtractionHistoryHandler");
async function getDetailCacheStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    await ensureCacheManagerInitialized(env);
    const stats = await cacheManager2.getCacheStats();
    const userStats = await getUserSpecificCacheStats(env, user.id);
    const sourceTypeStats = await getSourceTypeStats(env);
    const efficiencyStats = await getCacheEfficiencyStats(env, user.id);
    return utils.successResponse({
      global: {
        totalItems: stats.totalItems || 0,
        expiredItems: stats.expiredItems || 0,
        totalSize: stats.totalSize || 0,
        averageSize: Math.round(stats.averageSize || 0),
        hitRate: parseFloat((stats.hitRate || 0).toFixed(1))
      },
      user: userStats,
      sourceTypes: sourceTypeStats,
      efficiency: efficiencyStats
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u7F13\u5B58\u7EDF\u8BA1\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7F13\u5B58\u7EDF\u8BA1\u5931\u8D25: " + error.message, 500);
  }
}
__name(getDetailCacheStatsHandler, "getDetailCacheStatsHandler");
async function clearDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    await ensureCacheManagerInitialized(env);
    const url = new URL(request.url);
    const operation = url.searchParams.get("operation") || "expired";
    const params = parseClearParams(url.searchParams);
    let cleanedCount = 0;
    let message = "";
    let details = {};
    const beforeStats = await cacheManager2.getCacheStats();
    switch (operation) {
      case "expired":
        cleanedCount = await handleExpiredCacheCleanup(env, params);
        message = `\u5DF2\u6E05\u7406 ${cleanedCount} \u4E2A\u8FC7\u671F\u7F13\u5B58\u9879`;
        break;
      case "all":
        const result = await handleAllCacheCleanup(env, params);
        cleanedCount = result.count;
        details = result.details;
        message = `\u5DF2\u6E05\u7A7A\u6240\u6709\u7F13\u5B58 (${cleanedCount} \u9879)`;
        break;
      case "lru":
        const lruResult = await handleLRUCacheCleanup(env, params);
        cleanedCount = lruResult.count;
        details = lruResult.details;
        message = `\u5DF2\u6E05\u7406 ${cleanedCount} \u4E2A\u6700\u8FD1\u6700\u5C11\u4F7F\u7528\u7684\u7F13\u5B58\u9879`;
        break;
      case "selective":
        const selectiveResult = await handleSelectiveCacheCleanup(env, params);
        cleanedCount = selectiveResult.count;
        details = selectiveResult.details;
        message = `\u5DF2\u9009\u62E9\u6027\u6E05\u7406 ${cleanedCount} \u4E2A\u7F13\u5B58\u9879`;
        break;
      default:
        return utils.errorResponse("\u65E0\u6548\u7684\u6E05\u7406\u64CD\u4F5C\u7C7B\u578B", 400);
    }
    const afterStats = await cacheManager2.getCacheStats();
    try {
      await utils.logUserAction(env, user.id, "detail_cache_clear", {
        operation,
        params,
        cleanedCount,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn("\u8BB0\u5F55\u6E05\u7406\u64CD\u4F5C\u5931\u8D25:", logError.message);
    }
    return utils.successResponse({
      operation,
      cleanedCount,
      message,
      details,
      stats: {
        before: {
          totalItems: beforeStats.totalItems || 0,
          totalSize: beforeStats.totalSize || 0
        },
        after: {
          totalItems: afterStats.totalItems || 0,
          totalSize: afterStats.totalSize || 0
        }
      }
    });
  } catch (error) {
    console.error("\u6E05\u7406\u7F13\u5B58\u5931\u8D25:", error);
    return utils.errorResponse("\u6E05\u7406\u7F13\u5B58\u5931\u8D25: " + error.message, 500);
  }
}
__name(clearDetailCacheHandler, "clearDetailCacheHandler");
async function deleteDetailCacheHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    await ensureCacheManagerInitialized(env);
    const body = await utils.safeJsonParse(request, {});
    const { url, urls } = body;
    const urlsToDelete = urls && Array.isArray(urls) ? urls : url ? [url] : [];
    if (urlsToDelete.length === 0) {
      return utils.errorResponse("URL\u53C2\u6570\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const deleteResults = await Promise.allSettled(
      urlsToDelete.map(async (targetUrl) => {
        const success = await cacheManager2.deleteDetailCache(targetUrl);
        return { url: targetUrl, success };
      })
    );
    const successful = deleteResults.filter((result) => result.status === "fulfilled" && result.value.success).map((result) => result.value.url);
    const failed = deleteResults.filter((result) => result.status === "rejected" || !result.value.success).map((result) => result.status === "fulfilled" ? result.value.url : "Unknown");
    try {
      await utils.logUserAction(env, user.id, "detail_cache_delete", {
        urls: urlsToDelete,
        successful: successful.length,
        failed: failed.length,
        timestamp: Date.now()
      }, request);
    } catch (logError) {
      console.warn("\u8BB0\u5F55\u5220\u9664\u64CD\u4F5C\u5931\u8D25:", logError.message);
    }
    return utils.successResponse({
      message: `\u7F13\u5B58\u5220\u9664\u5B8C\u6210: ${successful.length} \u6210\u529F, ${failed.length} \u5931\u8D25`,
      results: {
        successful,
        failed,
        total: urlsToDelete.length
      }
    });
  } catch (error) {
    console.error("\u5220\u9664\u7F13\u5B58\u5931\u8D25:", error);
    return utils.errorResponse("\u5220\u9664\u7F13\u5B58\u5931\u8D25: " + error.message, 500);
  }
}
__name(deleteDetailCacheHandler, "deleteDetailCacheHandler");
async function getDetailExtractionStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const [userStats, sourceStats, performanceStats, cacheStats] = await Promise.all([
      getUserDetailStats(env, user.id),
      getSourceTypeStats(env, user.id),
      getPerformanceStats(env, user.id),
      getCacheEfficiencyStats(env, user.id)
    ]);
    return utils.successResponse({
      user: userStats,
      sources: sourceStats,
      performance: performanceStats,
      cache: cacheStats
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u8BE6\u60C5\u63D0\u53D6\u7EDF\u8BA1\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7EDF\u8BA1\u5931\u8D25: " + error.message, 500);
  }
}
__name(getDetailExtractionStatsHandler, "getDetailExtractionStatsHandler");

// src/handlers/proxy.js
var ALLOWED_DOMAINS = [
  "javbus.com",
  "www.javbus.com",
  "javdb.com",
  "www.javdb.com",
  "jable.tv",
  "www.jable.tv",
  "javmost.com",
  "www.javmost.com",
  "javgg.net",
  "www.javgg.net",
  "sukebei.nyaa.si",
  "jav.guru",
  "www.jav.guru",
  "javlibrary.com",
  "www.javlibrary.com",
  "btsow.com",
  "www.btsow.com"
];
var SPAM_DOMAINS2 = [
  "seedmm.cyou",
  "busfan.cyou",
  "dmmsee.ink",
  "ph7zhi.vip",
  "8pla6t.vip",
  "ltrpvkga.com",
  "frozaflurkiveltra.com",
  "shvaszc.cc",
  "fpnylxm.cc",
  "mvqttfwf.com",
  "jempoprostoklimor.com",
  "128zha.cc",
  "aciyopg.cc",
  "mnaspm.com",
  "asacp.org",
  "pr0rze.vip",
  "go.mnaspm.com"
];
async function proxyHandler(request, env) {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const proxyPath = pathname.replace("/api/proxy/", "");
    if (!proxyPath) {
      return utils.errorResponse("\u7F3A\u5C11\u76EE\u6807URL", 400);
    }
    let targetUrl;
    try {
      targetUrl = decodeURIComponent(proxyPath);
      if (targetUrl.includes("%")) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (error) {
      return utils.errorResponse("\u65E0\u6548\u7684URL\u7F16\u7801", 400);
    }
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }
    const validation = validateTargetUrl(targetUrl);
    if (!validation.valid) {
      return utils.errorResponse(validation.error, 403);
    }
    const user = await authenticate(request, env).catch(() => null);
    if (user && env.ENABLE_ACTION_LOGGING === "true") {
      await utils.logUserAction(env, user.id, "proxy_access", {
        targetUrl,
        userAgent: request.headers.get("User-Agent"),
        timestamp: Date.now()
      }, request);
    }
    return await executeProxy(request, targetUrl, url);
  } catch (error) {
    console.error("\u4EE3\u7406\u8BF7\u6C42\u5931\u8D25:", error);
    return utils.errorResponse("\u4EE3\u7406\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528: " + error.message, 500);
  }
}
__name(proxyHandler, "proxyHandler");
function validateTargetUrl(targetUrl) {
  try {
    const urlObj = new URL(targetUrl);
    const hostname = urlObj.hostname.toLowerCase();
    if (SPAM_DOMAINS2.some((domain) => hostname.includes(domain))) {
      return { valid: false, error: "\u8BE5\u57DF\u540D\u5DF2\u88AB\u5217\u5165\u9ED1\u540D\u5355" };
    }
    const isAllowed = ALLOWED_DOMAINS.some((domain) => {
      return hostname === domain || hostname.endsWith("." + domain);
    });
    if (!isAllowed) {
      return { valid: false, error: "\u8BE5\u57DF\u540D\u4E0D\u5728\u5141\u8BB8\u7684\u4EE3\u7406\u8303\u56F4\u5185" };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "\u65E0\u6548\u7684URL\u683C\u5F0F" };
  }
}
__name(validateTargetUrl, "validateTargetUrl");
async function executeProxy(originalRequest, targetUrl, originalUrlObj) {
  try {
    const newHeaders = new Headers();
    const allowedHeaders = [
      "accept",
      "accept-language",
      "cache-control",
      "content-type",
      "range",
      "user-agent"
    ];
    allowedHeaders.forEach((headerName) => {
      const headerValue = originalRequest.headers.get(headerName);
      if (headerValue) {
        newHeaders.set(headerName, headerValue);
      }
    });
    const targetUrlObj = new URL(targetUrl);
    newHeaders.set("Referer", `${targetUrlObj.protocol}//${targetUrlObj.hostname}/`);
    const proxyRequest = new Request(targetUrl, {
      method: originalRequest.method,
      headers: newHeaders,
      body: originalRequest.method !== "GET" ? originalRequest.body : null,
      redirect: "manual"
      // 手动处理重定向
    });
    const response = await fetch(proxyRequest);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const locationHeader = response.headers.get("location");
      if (locationHeader) {
        const redirectUrl = new URL(locationHeader, targetUrl);
        const newProxyPath = `/api/proxy/${encodeURIComponent(redirectUrl.toString())}`;
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: {
            ...Object.fromEntries(response.headers.entries()),
            "Location": `${originalUrlObj.origin}${newProxyPath}`
          }
        });
      }
    }
    const originalContentType = response.headers.get("content-type") || "";
    const isHtmlContent = originalContentType.toLowerCase().includes("text/html");
    const isTextContent = originalContentType.toLowerCase().includes("text/") && !isHtmlContent;
    let responseBody = response.body;
    let modifiedContentType = originalContentType;
    if (isHtmlContent) {
      try {
        const htmlContent = await response.text();
        const modifiedHtml = rewriteHtmlContent(htmlContent, targetUrl, originalUrlObj.origin);
        responseBody = modifiedHtml;
        modifiedContentType = "text/html; charset=utf-8";
      } catch (error) {
        console.error("\u5904\u7406HTML\u5185\u5BB9\u5931\u8D25:", error);
        responseBody = response.body;
      }
    } else {
      responseBody = response.body;
    }
    const modifiedResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: createResponseHeaders(response.headers, modifiedContentType)
    });
    return modifiedResponse;
  } catch (error) {
    console.error("\u4EE3\u7406\u8BF7\u6C42\u6267\u884C\u5931\u8D25:", error);
    return new Response(createErrorPage(targetUrl, error.message), {
      status: 502,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
__name(executeProxy, "executeProxy");
function rewriteHtmlContent(htmlContent, originalUrl, proxyOrigin) {
  const originalUrlObj = new URL(originalUrl);
  const baseUrl = `${originalUrlObj.protocol}//${originalUrlObj.hostname}`;
  let modifiedHtml = htmlContent;
  const replacements = [
    // href="/path" -> href="/api/proxy/https://domain.com/path" (排除CSS文件)
    {
      pattern: /href=["']\/(?!\/|http|#)([^"']*?)["']/g,
      replacement: /* @__PURE__ */ __name((match, path) => {
        if (path.endsWith(".css") || path.includes(".css?")) {
          return `href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + "/" + path)}"`;
        }
        return `href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + "/" + path)}"`;
      }, "replacement")
    },
    // src="/path" -> src="/api/proxy/https://domain.com/path" (排除JS文件)
    {
      pattern: /src=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: /* @__PURE__ */ __name((match, path) => {
        if (path.endsWith(".js") || path.includes(".js?")) {
          return `src="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + "/" + path)}"`;
        }
        return `src="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + "/" + path)}"`;
      }, "replacement")
    },
    // action="/path" -> action="/api/proxy/https://domain.com/path"
    {
      pattern: /action=["']\/(?!\/|http)([^"']*?)["']/g,
      replacement: /* @__PURE__ */ __name((match, path) => {
        return `action="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl + "/" + path)}"`;
      }, "replacement")
    }
  ];
  replacements.forEach(({ pattern, replacement }) => {
    if (typeof replacement === "function") {
      modifiedHtml = modifiedHtml.replace(pattern, replacement);
    } else {
      modifiedHtml = modifiedHtml.replace(pattern, replacement);
    }
  });
  const baseTagPattern = /<base[^>]*>/i;
  if (!baseTagPattern.test(modifiedHtml)) {
    const headPattern = /<head[^>]*>/i;
    if (headPattern.test(modifiedHtml)) {
      modifiedHtml = modifiedHtml.replace(
        headPattern,
        `$&
<base href="${proxyOrigin}/api/proxy/${encodeURIComponent(baseUrl)}/">`
      );
    }
  }
  return modifiedHtml;
}
__name(rewriteHtmlContent, "rewriteHtmlContent");
function createResponseHeaders(originalHeaders, contentType) {
  const headers = new Headers();
  for (const [key, value] of originalHeaders.entries()) {
    const lowerKey = key.toLowerCase();
    if (![
      "content-encoding",
      "content-security-policy",
      "x-frame-options",
      "strict-transport-security",
      "content-length"
    ].includes(lowerKey)) {
      headers.set(key, value);
    }
  }
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  headers.set("Pragma", "no-cache");
  return headers;
}
__name(createResponseHeaders, "createResponseHeaders");
function createErrorPage(targetUrl, errorMessage) {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>\u4EE3\u7406\u8BBF\u95EE\u5931\u8D25</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }
        .error-container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          padding: 30px;
          border-radius: 15px;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        h1 { margin: 0 0 20px 0; font-size: 2em; }
        .error-message { 
          margin: 20px 0;
          padding: 15px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          font-family: monospace;
        }
        .target-url {
          word-break: break-all;
          margin: 15px 0;
          opacity: 0.8;
        }
        .retry-btn {
          display: inline-block;
          padding: 12px 24px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          text-decoration: none;
          border-radius: 25px;
          margin: 20px 10px;
          transition: all 0.3s;
        }
        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>\u{1F6AB} \u4EE3\u7406\u8BBF\u95EE\u5931\u8D25</h1>
        <div class="error-message">${errorMessage}</div>
        <div class="target-url">\u76EE\u6807\u5730\u5740: ${targetUrl}</div>
        <a href="javascript:history.back()" class="retry-btn">\u8FD4\u56DE\u4E0A\u9875</a>
        <a href="javascript:location.reload()" class="retry-btn">\u91CD\u8BD5</a>
      </div>
    </body>
    </html>
  `;
}
__name(createErrorPage, "createErrorPage");
async function proxyHealthCheckHandler(request, env) {
  try {
    const testUrl = "https://www.javbus.com";
    const testRequest = new Request(testUrl, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ProxyHealthCheck)" }
    });
    const startTime = Date.now();
    const response = await fetch(testRequest);
    const responseTime = Date.now() - startTime;
    const isHealthy = response.ok || response.status === 403;
    return utils.successResponse({
      healthy: isHealthy,
      responseTime,
      testUrl,
      statusCode: response.status,
      allowedDomains: ALLOWED_DOMAINS.length,
      timestamp: Date.now()
    });
  } catch (error) {
    return utils.successResponse({
      healthy: false,
      error: error.message,
      allowedDomains: ALLOWED_DOMAINS.length,
      timestamp: Date.now()
    });
  }
}
__name(proxyHealthCheckHandler, "proxyHealthCheckHandler");
async function proxyStatsHandler(request, env) {
  const user = await authenticate(request, env);
  if (!user) {
    return utils.errorResponse("\u8BA4\u8BC1\u5931\u8D25", 401);
  }
  try {
    const stats = await env.DB.prepare(`
      SELECT 
        COUNT(*) as totalAccess,
        COUNT(DISTINCT JSON_EXTRACT(data, '$.targetUrl')) as uniqueUrls,
        MAX(created_at) as lastAccess
      FROM user_actions 
      WHERE user_id = ? AND action = 'proxy_access' AND created_at > datetime('now', '-7 days')
    `).bind(user.id).first();
    const domainStats = await env.DB.prepare(`
      SELECT 
        JSON_EXTRACT(data, '$.targetUrl') as url,
        COUNT(*) as count
      FROM user_actions 
      WHERE user_id = ? AND action = 'proxy_access' AND created_at > datetime('now', '-7 days')
      GROUP BY JSON_EXTRACT(data, '$.targetUrl')
      ORDER BY count DESC
      LIMIT 10
    `).bind(user.id).all();
    return utils.successResponse({
      userStats: {
        totalAccess: stats.totalAccess || 0,
        uniqueUrls: stats.uniqueUrls || 0,
        lastAccess: stats.lastAccess
      },
      topDomains: domainStats.results || [],
      allowedDomains: ALLOWED_DOMAINS,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("\u83B7\u53D6\u4EE3\u7406\u7EDF\u8BA1\u5931\u8D25:", error);
    return utils.errorResponse("\u83B7\u53D6\u7EDF\u8BA1\u4FE1\u606F\u5931\u8D25", 500);
  }
}
__name(proxyStatsHandler, "proxyStatsHandler");

// src/router.js
var Router = class {
  static {
    __name(this, "Router");
  }
  constructor() {
    this.routes = /* @__PURE__ */ new Map();
    this.paramRoutes = [];
    this.setupRoutes();
  }
  addRoute(method, path, handler) {
    const key = `${method}:${path}`;
    this.routes.set(key, handler);
    if (path.includes(":")) {
      this.paramRoutes.push({
        method,
        path,
        handler,
        pattern: this.createPattern(path)
      });
    }
  }
  get(path, handler) {
    this.addRoute("GET", path, handler);
  }
  post(path, handler) {
    this.addRoute("POST", path, handler);
  }
  put(path, handler) {
    this.addRoute("PUT", path, handler);
  }
  delete(path, handler) {
    this.addRoute("DELETE", path, handler);
  }
  options(path, handler) {
    this.addRoute("OPTIONS", path, handler);
  }
  createPattern(path) {
    const parts = path.split("/");
    return {
      parts,
      paramNames: parts.filter((part) => part.startsWith(":")).map((part) => part.substring(1))
    };
  }
  async handle(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: utils.getCorsHeaders(request.headers.get("Origin") || "*")
      });
    }
    if (pathname.startsWith("/api/proxy/")) {
      console.log(`\u4EE3\u7406\u8BF7\u6C42: ${pathname}`);
      return await this.executeHandler(proxyHandler, request, env);
    }
    const exactKey = `${method}:${pathname}`;
    if (this.routes.has(exactKey)) {
      console.log(`\u7CBE\u786E\u5339\u914D\u8DEF\u7531: ${exactKey}`);
      return await this.executeHandler(this.routes.get(exactKey), request, env);
    }
    for (const route of this.paramRoutes) {
      if (route.method === method) {
        const match = this.matchRoute(route.pattern, pathname);
        if (match.success) {
          console.log(`\u53C2\u6570\u8DEF\u7531\u5339\u914D: ${route.path}, \u53C2\u6570:`, match.params);
          request.params = match.params;
          return await this.executeHandler(route.handler, request, env);
        }
      }
    }
    const wildcardKey = `${method}:/*`;
    if (this.routes.has(wildcardKey)) {
      return await this.executeHandler(this.routes.get(wildcardKey), request, env);
    }
    console.error(`\u672A\u627E\u5230\u5339\u914D\u7684\u8DEF\u7531: ${method} ${pathname}`);
    return utils.errorResponse(`API\u8DEF\u5F84\u4E0D\u5B58\u5728: ${pathname}`, 404);
  }
  matchRoute(pattern, pathname) {
    const requestParts = pathname.split("/");
    const routeParts = pattern.parts;
    if (requestParts.length !== routeParts.length) {
      return { success: false, params: {} };
    }
    const params = {};
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];
      if (routePart.startsWith(":")) {
        const paramName = routePart.substring(1);
        params[paramName] = requestPart;
      } else if (routePart !== requestPart) {
        return { success: false, params: {} };
      }
    }
    return { success: true, params };
  }
  async executeHandler(handler, request, env) {
    try {
      const result = await handler(request, env);
      if (result instanceof Response) {
        const corsHeaders = utils.getCorsHeaders(request.headers.get("Origin") || "*");
        Object.entries(corsHeaders).forEach(([key, value]) => {
          result.headers.set(key, value);
        });
      }
      return result;
    } catch (error) {
      console.error("\u8DEF\u7531\u5904\u7406\u5668\u9519\u8BEF:", error);
      return utils.errorResponse("\u5185\u90E8\u670D\u52A1\u5668\u9519\u8BEF", 500);
    }
  }
  setupRoutes() {
    this.get("/api/health", healthCheckHandler);
    this.get("/api/proxy/health", proxyHealthCheckHandler);
    this.get("/api/proxy/stats", proxyStatsHandler);
    this.post("/api/auth/register", authRegisterHandler);
    this.post("/api/auth/login", authLoginHandler);
    this.post("/api/auth/verify-token", authVerifyTokenHandler);
    this.post("/api/auth/refresh", authRefreshTokenHandler);
    this.post("/api/auth/logout", authLogoutHandler);
    this.put("/api/auth/change-password", authChangePasswordHandler);
    this.post("/api/auth/send-password-reset-code", authSendPasswordResetCodeHandler);
    this.post("/api/auth/forgot-password", authForgotPasswordHandler);
    this.post("/api/auth/reset-password", authResetPasswordHandler);
    this.post("/api/auth/delete-account", authDeleteAccountHandler);
    this.post("/api/auth/send-account-delete-code", authSendAccountDeleteCodeHandler);
    this.get("/api/auth/verification-status", authCheckVerificationStatusHandler);
    this.get("/api/auth/user-verification-status", authGetUserVerificationStatusHandler);
    this.post("/api/auth/smart-send-code", authSmartSendVerificationCodeHandler);
    this.post("/api/auth/send-registration-code", authSendRegistrationCodeHandler);
    this.post("/api/auth/request-email-change", authRequestEmailChangeHandler);
    this.post("/api/auth/send-email-change-code", authSendEmailChangeCodeHandler);
    this.post("/api/auth/verify-email-change-code", authVerifyEmailChangeCodeHandler);
    this.get("/api/search-sources/major-categories", getMajorCategoriesHandler);
    this.post("/api/search-sources/major-categories", createMajorCategoryHandler);
    this.get("/api/search-sources/categories", getSourceCategoriesHandler);
    this.post("/api/search-sources/categories", createSourceCategoryHandler);
    this.put("/api/search-sources/categories/:id", updateSourceCategoryHandler);
    this.delete("/api/search-sources/categories/:id", deleteSourceCategoryHandler);
    this.get("/api/search-sources/sources", getSearchSourcesHandler);
    this.post("/api/search-sources/sources", createSearchSourceHandler);
    this.put("/api/search-sources/sources/:id", updateSearchSourceHandler);
    this.delete("/api/search-sources/sources/:id", deleteSearchSourceHandler);
    this.get("/api/search-sources/user-configs", getUserSourceConfigsHandler);
    this.post("/api/search-sources/user-configs", updateUserSourceConfigHandler);
    this.post("/api/search-sources/user-configs/batch", batchUpdateUserSourceConfigsHandler);
    this.get("/api/search-sources/stats", getSearchSourceStatsHandler);
    this.get("/api/search-sources/export", exportUserSearchSourcesHandler);
    this.get("/api/community/tags", communityGetTagsHandler);
    this.post("/api/community/tags", communityCreateTagHandler);
    this.put("/api/community/tags/:id", communityUpdateTagHandler);
    this.delete("/api/community/tags/:id", communityDeleteTagHandler);
    this.post("/api/source-status/check", sourceStatusCheckHandler);
    this.get("/api/source-status/history", sourceStatusHistoryHandler);
    this.get("/api/community/sources", communityGetSourcesHandler);
    this.post("/api/community/sources", communityCreateSourceHandler);
    this.get("/api/community/sources/:id", communityGetSourceDetailHandler);
    this.put("/api/community/sources/:id", communityUpdateSourceHandler);
    this.delete("/api/community/sources/:id", communityDeleteSourceHandler);
    this.post("/api/community/sources/:id/download", communityDownloadSourceHandler);
    this.post("/api/community/sources/:id/like", communityLikeSourceHandler);
    this.post("/api/community/sources/:id/review", communityReviewSourceHandler);
    this.post("/api/community/sources/:id/report", communityReportSourceHandler);
    this.get("/api/community/user/stats", communityUserStatsHandler);
    this.get("/api/community/search", communitySearchHandler);
    this.post("/api/detail/extract-single", extractSingleDetailHandler);
    this.post("/api/detail/extract-batch", extractBatchDetailsHandler);
    this.get("/api/detail/history", getDetailExtractionHistoryHandler);
    this.get("/api/detail/stats", getDetailExtractionStatsHandler);
    this.get("/api/detail/cache/stats", getDetailCacheStatsHandler);
    this.delete("/api/detail/cache/clear", clearDetailCacheHandler);
    this.delete("/api/detail/cache/delete", deleteDetailCacheHandler);
    this.get("/api/detail/config", getDetailExtractionConfigHandler);
    this.put("/api/detail/config", updateDetailExtractionConfigHandler);
    this.post("/api/detail/config/reset", resetDetailExtractionConfigHandler);
    this.post("/api/detail/config/preset", applyConfigPresetHandler);
    this.get("/api/user/settings", userGetSettingsHandler);
    this.put("/api/user/settings", userUpdateSettingsHandler);
    this.post("/api/user/favorites", userSyncFavoritesHandler);
    this.get("/api/user/favorites", userGetFavoritesHandler);
    this.post("/api/user/search-history", userSaveSearchHistoryHandler);
    this.get("/api/user/search-history", userGetSearchHistoryHandler);
    this.delete("/api/user/search-history/:id", userDeleteSearchHistoryHandler);
    this.delete("/api/user/search-history", userClearSearchHistoryHandler);
    this.get("/api/user/search-stats", userGetSearchStatsHandler);
    this.post("/api/actions/record", recordActionHandler);
    this.get("/api/config", getConfigHandler);
    this.get("/*", defaultHandler);
  }
};

// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    try {
      const requiredEnvVars = ["JWT_SECRET", "DB"];
      const missing = requiredEnvVars.filter((key) => !env[key]);
      if (missing.length > 0) {
        console.error(`\u7F3A\u5C11\u5FC5\u9700\u7684\u73AF\u5883\u53D8\u91CF: ${missing.join(", ")}`);
        return utils.errorResponse(`\u670D\u52A1\u5668\u914D\u7F6E\u9519\u8BEF: \u7F3A\u5C11${missing.join(", ")}`, 500);
      }
      await initializeCacheManager(env);
      const router = new Router();
      return await router.handle(request, env);
    } catch (error) {
      console.error("Worker\u9519\u8BEF:", error);
      return utils.errorResponse("\u670D\u52A1\u5668\u5185\u90E8\u9519\u8BEF", 500);
    }
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
