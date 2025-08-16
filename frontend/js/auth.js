// 认证模块
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.refreshTimer = null;
        this.init();
    }

    // 初始化认证管理器
    init() {
        this.loadStoredAuth();
        this.setupTokenRefresh();
    }

    // 从本地存储加载认证信息
    loadStoredAuth() {
        const token = localStorage.getItem('auth_token');
        const user = StorageManager.getItem('current_user');
        
        if (token && user) {
            this.setAuth(user, token);
        }
    }

    // 设置认证信息
    setAuth(user, token) {
        this.currentUser = user;
        this.token = token;
        
        // 存储到本地
        localStorage.setItem('auth_token', token);
        StorageManager.setItem('current_user', user);
        
        // 设置API token
        if (typeof API !== 'undefined') {
            API.setToken(token);
        }
        
        // 启动token刷新定时器
        this.startTokenRefresh();
        
        // 触发认证状态变化事件
        this.dispatchAuthEvent('login', user);
    }

    // 清除认证信息
    clearAuth() {
        const previousUser = this.currentUser;
        
        this.currentUser = null;
        this.token = null;
        
        // 清除本地存储
        localStorage.removeItem('auth_token');
        StorageManager.removeItem('current_user');
        
        // 清除API token
        if (typeof API !== 'undefined') {
            API.setToken(null);
        }
        
        // 停止token刷新
        this.stopTokenRefresh();
        
        // 触发认证状态变化事件
        this.dispatchAuthEvent('logout', previousUser);
    }

    // 检查是否已登录
    isAuthenticated() {
        return !!(this.currentUser && this.token);
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 获取token
    getToken() {
        return this.token;
    }

    // 登录
    async login(username, password) {
        try {
            showLoading(true);
            
            const response = await API.login(username, password);
            
            if (response.success && response.user && response.token) {
                this.setAuth(response.user, response.token);
                showToast(`欢迎回来，${response.user.username}！`, 'success');
                return { success: true, user: response.user };
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            showToast(error.message || '登录失败，请稍后重试', 'error');
            return { success: false, message: error.message };
        } finally {
            showLoading(false);
        }
    }

    // 注册
    async register(username, email, password) {
        try {
            showLoading(true);
            
            // 客户端验证
            const validation = this.validateRegistration(username, email, password);
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            const response = await API.register(username, email, password);
            
            if (response.success) {
                showToast('注册成功！请登录您的账户', 'success');
                return { success: true };
            } else {
                throw new Error(response.message || '注册失败');
            }
        } catch (error) {
            console.error('注册失败:', error);
            showToast(error.message || '注册失败，请稍后重试', 'error');
            return { success: false, message: error.message };
        } finally {
            showLoading(false);
        }
    }

    // 退出登录
    async logout() {
        try {
            if (this.token) {
                await API.logout();
            }
        } catch (error) {
            console.error('退出登录请求失败:', error);
        } finally {
            this.clearAuth();
            showToast('已退出登录', 'success');
        }
    }

    // 验证token
    async verifyToken() {
        if (!this.token) {
            return false;
        }

        try {
            const response = await API.verifyToken(this.token);
            
            if (response.success && response.user) {
                this.currentUser = response.user;
                StorageManager.setItem('current_user', response.user);
                return true;
            } else {
                this.clearAuth();
                return false;
            }
        } catch (error) {
            console.error('验证token失败:', error);
            this.clearAuth();
            return false;
        }
    }

    // 注册验证
    validateRegistration(username, email, password) {
        if (!username || username.length < 3) {
            return { valid: false, message: '用户名至少3个字符' };
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return { valid: false, message: '用户名只能包含字母、数字和下划线' };
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { valid: false, message: '请输入有效的邮箱地址' };
        }

        if (!password || password.length < 6) {
            return { valid: false, message: '密码至少6个字符' };
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*\d)/.test(password)) {
            return { valid: false, message: '密码需包含大小写字母或数字' };
        }

        return { valid: true };
    }

    // Token刷新机制
    setupTokenRefresh() {
        // 每30分钟检查一次token有效性
        this.refreshTimer = setInterval(() => {
            if (this.isAuthenticated()) {
                this.refreshToken();
            }
        }, 30 * 60 * 1000);
    }

    startTokenRefresh() {
        this.stopTokenRefresh();
        this.setupTokenRefresh();
    }

    stopTokenRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // 刷新token
    async refreshToken() {
        try {
            const response = await API.request('/api/auth/refresh', {
                method: 'POST'
            });
            
            if (response.success && response.token) {
                this.token = response.token;
                localStorage.setItem('auth_token', response.token);
                API.setToken(response.token);
            } else {
                this.clearAuth();
            }
        } catch (error) {
            console.error('刷新token失败:', error);
            this.clearAuth();
        }
    }

    // 触发认证事件
    dispatchAuthEvent(type, user) {
        const event = new CustomEvent('authStateChanged', {
            detail: { type, user }
        });
        window.dispatchEvent(event);
    }

    // 监听认证状态变化
    onAuthStateChanged(callback) {
        window.addEventListener('authStateChanged', callback);
    }

    // 移除认证状态监听
    offAuthStateChanged(callback) {
        window.removeEventListener('authStateChanged', callback);
    }

    // 获取用户权限
    getUserPermissions() {
        if (!this.currentUser) return [];
        return this.currentUser.permissions || [];
    }

    // 检查权限
    hasPermission(permission) {
        const permissions = this.getUserPermissions();
        return permissions.includes(permission) || permissions.includes('admin');
    }

    // 要求认证
    requireAuth(message = '此操作需要登录') {
        if (!this.isAuthenticated()) {
            showToast(message, 'error');
            if (typeof app !== 'undefined' && app.showLoginModal) {
                app.showLoginModal();
            }
            return false;
        }
        return true;
    }
}

/**
 * 密码强度检查器
 */
const PasswordStrengthChecker = {
    // 检查密码强度
    checkStrength(password) {
        if (!password) return { score: 0, feedback: [] };
        
        let score = 0;
        const feedback = [];
        
        // 长度检查
        if (password.length >= 8) {
            score += 1;
        } else {
            feedback.push('密码至少8个字符');
        }
        
        // 包含小写字母
        if (/[a-z]/.test(password)) {
            score += 1;
        } else {
            feedback.push('需要包含小写字母');
        }
        
        // 包含大写字母
        if (/[A-Z]/.test(password)) {
            score += 1;
        } else {
            feedback.push('需要包含大写字母');
        }
        
        // 包含数字
        if (/\d/.test(password)) {
            score += 1;
        } else {
            feedback.push('需要包含数字');
        }
        
        // 包含特殊字符
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            score += 1;
        } else {
            feedback.push('建议包含特殊字符');
        }
        
        // 避免常见模式
        if (!/(.)\1{2,}/.test(password)) {
            score += 1;
        } else {
            feedback.push('避免重复字符');
        }
        
        const strength = ['很弱', '弱', '一般', '强', '很强'][Math.min(Math.floor(score / 1.2), 4)];
        
        return {
            score,
            strength,
            feedback,
            isStrong: score >= 4
        };
    },

    // 生成安全密码
    generateSecurePassword(length = 12) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const allChars = lowercase + uppercase + numbers + symbols;
        let password = '';
        
        // 确保每种类型至少有一个字符
        password += this.getRandomChar(lowercase);
        password += this.getRandomChar(uppercase);
        password += this.getRandomChar(numbers);
        password += this.getRandomChar(symbols);
        
        // 填充剩余长度
        for (let i = 4; i < length; i++) {
            password += this.getRandomChar(allChars);
        }
        
        // 打乱字符顺序
        return password.split('').sort(() => Math.random() - 0.5).join('');
    },

    // 获取随机字符
    getRandomChar(chars) {
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }
};

/**
 * 表单验证器
 */
const FormValidator = {
    // 验证用户名
    validateUsername(username) {
        if (!username) return { valid: false, message: '用户名不能为空' };
        if (username.length < 3) return { valid: false, message: '用户名至少3个字符' };
        if (username.length > 20) return { valid: false, message: '用户名最多20个字符' };
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            return { valid: false, message: '用户名只能包含字母、数字、下划线或中文' };
        }
        return { valid: true };
    },

    // 验证邮箱
    validateEmail(email) {
        if (!email) return { valid: false, message: '邮箱不能为空' };
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, message: '请输入有效的邮箱地址' };
        }
        return { valid: true };
    },

    // 验证密码
// 在auth.js中改进密码策略
class AuthManager {
  validatePassword(password) {
    // 增强密码策略
    const MIN_LENGTH = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < MIN_LENGTH) {
      return { valid: false, message: `密码至少需要${MIN_LENGTH}个字符` };
    }
    
    const strength = [hasUpperCase, hasLowerCase, hasNumber, hasSpecialChar]
      .filter(Boolean).length;
    
    if (strength < 3) {
      return {
        valid: false,
        message: '密码需包含大小写字母、数字和特殊字符'
      };
    }
    
    return { valid: true };
},

    // 验证搜索关键词
    validateSearchKeyword(keyword) {
        if (!keyword) return { valid: false, message: '搜索关键词不能为空' };
        if (keyword.length > 100) return { valid: false, message: '搜索关键词过长' };
        if (/[<>]/.test(keyword)) return { valid: false, message: '搜索关键词包含非法字符' };
        return { valid: true };
    }
};

/**
 * 会话管理器
 */
const SessionManager = {
    // 会话存储键名
    SESSION_KEY: 'user_session',
    
    // 开始会话
    startSession(user) {
        const session = {
            user,
            startTime: Date.now(),
            lastActivity: Date.now(),
            sessionId: generateId(16)
        };
        
        StorageManager.setItem(this.SESSION_KEY, session);
        this.startActivityTracking();
        return session;
    },

    // 结束会话
    endSession() {
        const session = this.getSession();
        if (session) {
            // 记录会话统计
            this.recordSessionStats(session);
        }
        
        StorageManager.removeItem(this.SESSION_KEY);
        this.stopActivityTracking();
    },

    // 获取当前会话
    getSession() {
        return StorageManager.getItem(this.SESSION_KEY);
    },

    // 更新活动时间
    updateActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            StorageManager.setItem(this.SESSION_KEY, session);
        }
    },

    // 开始活动跟踪
    startActivityTracking() {
        // 监听用户活动
        const events = ['click', 'keypress', 'scroll', 'mousemove'];
        const updateActivity = debounce(() => this.updateActivity(), 30000);
        
        events.forEach(event => {
            document.addEventListener(event, updateActivity);
        });
        
        // 定期检查会话超时
        this.activityTimer = setInterval(() => {
            this.checkSessionTimeout();
        }, 60000);
    },

    // 停止活动跟踪
    stopActivityTracking() {
        if (this.activityTimer) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
        }
    },

    // 检查会话超时
    checkSessionTimeout() {
        const session = this.getSession();
        if (!session) return;
        
        const now = Date.now();
        const timeout = 2 * 60 * 60 * 1000; // 2小时超时
        
        if (now - session.lastActivity > timeout) {
            showToast('会话已超时，请重新登录', 'error');
            if (typeof auth !== 'undefined') {
                auth.clearAuth();
            }
        }
    },

    // 记录会话统计
    recordSessionStats(session) {
        const stats = {
            sessionId: session.sessionId,
            userId: session.user.id,
            duration: Date.now() - session.startTime,
            endTime: Date.now()
        };
        
        // 发送到后端统计
        if (typeof API !== 'undefined') {
            API.recordAction('session_end', stats).catch(console.error);
        }
    }
};

/**
 * 权限管理器
 */
const PermissionManager = {
    // 权限定义
    PERMISSIONS: {
        SEARCH: 'search',
        FAVORITE: 'favorite',
        HISTORY: 'history',
        SYNC: 'sync',
        ADMIN: 'admin',
        PREMIUM: 'premium'
    },

    // 检查用户权限
    hasPermission(user, permission) {
        if (!user || !user.permissions) return false;
        
        return user.permissions.includes(permission) || 
               user.permissions.includes(this.PERMISSIONS.ADMIN);
    },

    // 检查当前用户权限
    checkCurrentUserPermission(permission) {
        const auth = typeof authManager !== 'undefined' ? authManager : null;
        if (!auth || !auth.getCurrentUser()) return false;
        
        return this.hasPermission(auth.getCurrentUser(), permission);
    },

    // 获取权限列表
    getPermissionList(user) {
        if (!user || !user.permissions) return [];
        return user.permissions;
    },

    // 是否为高级用户
    isPremiumUser(user) {
        return this.hasPermission(user, this.PERMISSIONS.PREMIUM);
    },

    // 是否为管理员
    isAdmin(user) {
        return this.hasPermission(user, this.PERMISSIONS.ADMIN);
    }
};

// 创建全局认证管理器实例
const authManager = new AuthManager();

// 导出认证状态到全局作用域
window.auth = authManager;