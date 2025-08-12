// 认证模块 - 完全优化版本
// 增强安全性、会话管理、权限控制等功能

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.refreshTimer = null;
        this.sessionManager = new SessionManager();
        this.permissionManager = new PermissionManager();
        this.securityPolicy = new SecurityPolicy();
        
        this.init();
    }

    // 初始化认证管理器
    async init() {
        try {
            // 加载存储的认证信息
            await this.loadStoredAuth();
            
            // 设置安全策略
            this.securityPolicy.init();
            
            // 启动自动刷新
            this.setupTokenRefresh();
            
            // 监听网络状态
            this.setupNetworkListener();
            
            console.log('🔐 认证管理器初始化完成');
        } catch (error) {
            console.error('认证管理器初始化失败:', error);
        }
    }

    // 从本地存储加载认证信息
    async loadStoredAuth() {
        const token = localStorage.getItem('auth_token');
        const userJson = localStorage.getItem('current_user');
        const sessionData = localStorage.getItem('session_data');
        
        if (token && userJson) {
            try {
                const user = JSON.parse(userJson);
                
                // 验证token有效性
                if (await this.validateStoredToken(token)) {
                    this.setAuth(user, token, false);
                    
                    // 恢复会话数据
                    if (sessionData) {
                        this.sessionManager.restoreSession(JSON.parse(sessionData));
                    }
                    
                    console.log('✅ 自动登录成功:', user.username);
                } else {
                    this.clearAuth();
                    console.log('🔄 存储的token已失效，已清理');
                }
            } catch (error) {
                console.error('加载存储认证信息失败:', error);
                this.clearAuth();
            }
        }
    }

    // 验证存储的token
    async validateStoredToken(token) {
        try {
            const response = await API.verifyToken(token);
            return response.success && response.user;
        } catch (error) {
            return false;
        }
    }

    // 设置认证信息
    setAuth(user, token, shouldSync = true) {
        this.currentUser = user;
        this.token = token;
        
        // 存储到本地
        localStorage.setItem('auth_token', token);
        localStorage.setItem('current_user', JSON.stringify(user));
        
        // 设置API token
        API.setToken(token);
        
        // 启动会话管理
        this.sessionManager.startSession(user);
        
        // 启动token刷新定时器
        this.startTokenRefresh();
        
        // 同步数据
        if (shouldSync) {
            this.syncUserData().catch(console.error);
        }
        
        // 触发认证状态变化事件
        this.dispatchAuthEvent('login', user);
    }

    // 清除认证信息
    clearAuth(reason = 'manual') {
        const previousUser = this.currentUser;
        
        this.currentUser = null;
        this.token = null;
        
        // 清除本地存储
        localStorage.removeItem('auth_token');
        localStorage.removeItem('current_user');
        localStorage.removeItem('session_data');
        
        // 清除API token
        API.setToken(null);
        
        // 结束会话
        this.sessionManager.endSession(reason);
        
        // 停止token刷新
        this.stopTokenRefresh();
        
        // 触发认证状态变化事件
        this.dispatchAuthEvent('logout', { previousUser, reason });
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
    async login(username, password, rememberMe = false) {
        try {
            // 安全策略检查
            const securityCheck = await this.securityPolicy.checkLoginAttempt(username);
            if (!securityCheck.allowed) {
                throw new Error(securityCheck.reason);
            }
            
            showLoading(true);
            
            const response = await API.login(username, password);
            
            if (response.success && response.user && response.token) {
                this.setAuth(response.user, response.token);
                
                // 记录成功登录
                this.securityPolicy.recordLoginSuccess(username);
                
                // 记住我功能
                if (rememberMe) {
                    localStorage.setItem('remember_user', username);
                } else {
                    localStorage.removeItem('remember_user');
                }
                
                showToast(`欢迎回来，${response.user.username}！`, 'success');
                
                // 记录登录行为
                API.recordAction('login', { 
                    username, 
                    rememberMe,
                    loginTime: Date.now()
                });
                
                return { success: true, user: response.user };
            } else {
                throw new Error(response.message || '登录失败');
            }
        } catch (error) {
            console.error('登录失败:', error);
            
            // 记录失败登录
            this.securityPolicy.recordLoginFailure(username);
            
            showToast(error.message || '登录失败，请稍后重试', 'error');
            return { success: false, message: error.message };
        } finally {
            showLoading(false);
        }
    }

    // 注册
    async register(userData) {
        try {
            showLoading(true);
            
            // 客户端验证
            const validation = this.validateRegistration(userData);
            if (!validation.valid) {
                throw new Error(validation.message);
            }
            
            // 安全策略检查
            const securityCheck = await this.securityPolicy.checkRegistrationAttempt(userData.email);
            if (!securityCheck.allowed) {
                throw new Error(securityCheck.reason);
            }
            
            const response = await API.register(userData.username, userData.email, userData.password);
            
            if (response.success) {
                showToast('注册成功！请登录您的账户', 'success');
                
                // 记录注册行为
                API.recordAction('register', { 
                    username: userData.username,
                    email: userData.email,
                    registerTime: Date.now()
                });
                
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
    async logout(reason = 'manual') {
        try {
            if (this.token) {
                await API.logout();
            }
        } catch (error) {
            console.error('退出登录请求失败:', error);
        } finally {
            this.clearAuth(reason);
            
            if (reason === 'manual') {
                showToast('已退出登录', 'success');
            }
        }
    }

    // 验证token
    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await API.verifyToken(this.token);
            
            if (response.success && response.user) {
                // 更新用户信息
                if (JSON.stringify(this.currentUser) !== JSON.stringify(response.user)) {
                    this.currentUser = response.user;
                    localStorage.setItem('current_user', JSON.stringify(response.user));
                    this.dispatchAuthEvent('userUpdate', response.user);
                }
                return true;
            } else {
                this.clearAuth('token_invalid');
                return false;
            }
        } catch (error) {
            console.error('验证token失败:', error);
            this.clearAuth('token_error');
            return false;
        }
    }

    // 注册数据验证
    validateRegistration(userData) {
        const { username, email, password, confirmPassword } = userData;

        if (!username || username.length < 3) {
            return { valid: false, message: '用户名至少3个字符' };
        }

        if (username.length > 20) {
            return { valid: false, message: '用户名最多20个字符' };
        }

        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            return { valid: false, message: '用户名只能包含字母、数字、下划线或中文' };
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { valid: false, message: '请输入有效的邮箱地址' };
        }

        if (!password || password.length < 6) {
            return { valid: false, message: '密码至少6个字符' };
        }

        if (password !== confirmPassword) {
            return { valid: false, message: '两次输入的密码不一致' };
        }

        // 密码强度检查
        const strength = this.checkPasswordStrength(password);
        if (strength.score < 2) {
            return { valid: false, message: `密码强度不足: ${strength.feedback.join('，')}` };
        }

        return { valid: true };
    }

    // 密码强度检查
    checkPasswordStrength(password) {
        let score = 0;
        const feedback = [];
        
        if (password.length >= 8) score += 1;
        else feedback.push('至少8个字符');
        
        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('包含小写字母');
        
        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('包含大写字母');
        
        if (/\d/.test(password)) score += 1;
        else feedback.push('包含数字');
        
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
        else feedback.push('包含特殊字符');
        
        if (!/(.)\1{2,}/.test(password)) score += 1;
        else feedback.push('避免连续重复字符');
        
        const strength = ['很弱', '弱', '一般', '强', '很强'][Math.min(Math.floor(score / 1.2), 4)];
        
        return { score, strength, feedback, isStrong: score >= 4 };
    }

    // Token刷新机制
    setupTokenRefresh() {
        // 每25分钟检查一次token
        this.refreshTimer = setInterval(async () => {
            if (this.isAuthenticated()) {
                await this.refreshTokenIfNeeded();
            }
        }, 25 * 60 * 1000);
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

    // 智能token刷新
    async refreshTokenIfNeeded() {
        try {
            // 解析token获取过期时间
            const payload = this.parseJWTPayload(this.token);
            if (!payload) return;
            
            const now = Date.now() / 1000;
            const expiryTime = payload.exp;
            const timeUntilExpiry = expiryTime - now;
            
            // 如果5分钟内过期，则刷新
            if (timeUntilExpiry < 5 * 60) {
                console.log('🔄 Token即将过期，正在刷新...');
                await this.refreshToken();
            }
        } catch (error) {
            console.error('检查token过期时间失败:', error);
        }
    }

    // 解析JWT载荷
    parseJWTPayload(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            const payload = parts[1];
            const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
            const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
            
            return JSON.parse(decoded);
        } catch (error) {
            return null;
        }
    }

    // 刷新token
    async refreshToken() {
        try {
            const response = await API.request('/api/auth/refresh', {
                method: 'POST'
            });
            
            if (response.success && response.token) {
                console.log('✅ Token刷新成功');
                this.token = response.token;
                localStorage.setItem('auth_token', response.token);
                API.setToken(response.token);
                
                // 触发token更新事件
                this.dispatchAuthEvent('tokenRefresh', { token: response.token });
                return true;
            } else {
                console.warn('⚠️ Token刷新失败，需要重新登录');
                this.clearAuth('token_refresh_failed');
                return false;
            }
        } catch (error) {
            console.error('刷新token失败:', error);
            this.clearAuth('token_refresh_error');
            return false;
        }
    }

    // 同步用户数据
    async syncUserData() {
        try {
            console.log('🔄 同步用户数据...');
            
            // 并行获取用户数据
            const [favorites, searchHistory, settings, stats] = await Promise.allSettled([
                API.getFavorites(),
                API.getSearchHistory(),
                API.getUserSettings(),
                API.getUserStats()
            ]);
            
            // 更新本地数据
            if (favorites.status === 'fulfilled') {
                StorageManager.setItem('favorites', favorites.value);
            }
            
            if (searchHistory.status === 'fulfilled') {
                StorageManager.setItem('search_history', searchHistory.value);
            }
            
            if (settings.status === 'fulfilled') {
                StorageManager.setItem('user_settings', settings.value);
            }
            
            if (stats.status === 'fulfilled') {
                StorageManager.setItem('user_stats', stats.value);
            }
            
            console.log('✅ 用户数据同步完成');
            
            // 触发数据同步事件
            this.dispatchAuthEvent('dataSync', {
                favorites: favorites.status === 'fulfilled',
                searchHistory: searchHistory.status === 'fulfilled',
                settings: settings.status === 'fulfilled',
                stats: stats.status === 'fulfilled'
            });
            
        } catch (error) {
            console.error('同步用户数据失败:', error);
        }
    }

    // 网络监听器
    setupNetworkListener() {
        window.addEventListener('online', async () => {
            if (this.isAuthenticated()) {
                console.log('🌐 网络恢复，验证认证状态...');
                const isValid = await this.verifyToken();
                if (isValid) {
                    await this.syncUserData();
                }
            }
        });

        window.addEventListener('offline', () => {
            console.log('📴 网络断开，进入离线模式');
            this.dispatchAuthEvent('offline');
        });
    }

    // 事件管理
    dispatchAuthEvent(type, data = null) {
        const event = new CustomEvent('authStateChanged', {
            detail: { type, data, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    onAuthStateChanged(callback) {
        window.addEventListener('authStateChanged', callback);
    }

    offAuthStateChanged(callback) {
        window.removeEventListener('authStateChanged', callback);
    }

    // 权限管理
    hasPermission(permission) {
        return this.permissionManager.hasPermission(this.currentUser, permission);
    }

    getUserPermissions() {
        return this.permissionManager.getUserPermissions(this.currentUser);
    }

    // 要求认证
    requireAuth(message = '此操作需要登录') {
        if (!this.isAuthenticated()) {
            showToast(message, 'error');
            this.dispatchAuthEvent('authRequired', { message });
            return false;
        }
        return true;
    }

    // 获取记住的用户名
    getRememberedUsername() {
        return localStorage.getItem('remember_user') || '';
    }

    // 清除记住的用户名
    clearRememberedUsername() {
        localStorage.removeItem('remember_user');
    }
}

// 会话管理器
class SessionManager {
    constructor() {
        this.sessionKey = 'user_session';
        this.activityTimer = null;
        this.lastActivity = Date.now();
        this.sessionTimeout = 2 * 60 * 60 * 1000; // 2小时
    }

    startSession(user) {
        const session = {
            id: Utils.generateId(),
            userId: user.id,
            username: user.username,
            startTime: Date.now(),
            lastActivity: Date.now(),
            deviceInfo: this.getDeviceInfo(),
            isActive: true
        };
        
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
        this.startActivityTracking();
        
        console.log('📊 会话已启动:', session.id);
        return session;
    }

    endSession(reason = 'manual') {
        const session = this.getSession();
        if (session) {
            const duration = Date.now() - session.startTime;
            
            // 记录会话统计
            this.recordSessionStats({
                ...session,
                endTime: Date.now(),
                duration,
                endReason: reason
            });
            
            console.log(`📊 会话已结束 (${reason}): ${Math.round(duration / 1000)}秒`);
        }
        
        localStorage.removeItem(this.sessionKey);
        this.stopActivityTracking();
    }

    getSession() {
        const sessionData = localStorage.getItem(this.sessionKey);
        return sessionData ? JSON.parse(sessionData) : null;
    }

    updateActivity() {
        const session = this.getSession();
        if (session) {
            session.lastActivity = Date.now();
            localStorage.setItem(this.sessionKey, JSON.stringify(session));
            this.lastActivity = Date.now();
        }
    }

    startActivityTracking() {
        this.stopActivityTracking();
        
        // 监听用户活动
        const events = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart'];
        const updateActivity = debounce(() => this.updateActivity(), 30000);
        
        events.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        // 定期检查会话超时
        this.activityTimer = setInterval(() => {
            this.checkSessionTimeout();
        }, 60000); // 每分钟检查一次
    }

    stopActivityTracking() {
        if (this.activityTimer) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
        }
    }

    checkSessionTimeout() {
        const session = this.getSession();
        if (!session) return;
        
        const now = Date.now();
        const timeSinceActivity = now - session.lastActivity;
        
        if (timeSinceActivity > this.sessionTimeout) {
            console.warn('⏰ 会话超时，自动退出');
            
            // 触发超时事件
            window.dispatchEvent(new CustomEvent('sessionTimeout', {
                detail: { 
                    duration: timeSinceActivity,
                    sessionId: session.id 
                }
            }));
            
            // 自动退出
            if (window.authManager) {
                window.authManager.logout('session_timeout');
            }
        }
    }

    restoreSession(sessionData) {
        localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
        this.startActivityTracking();
    }

    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            screenResolution: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: Date.now()
        };
    }

    recordSessionStats(sessionData) {
        try {
            // 发送会话统计到服务器
            if (typeof API !== 'undefined') {
                API.recordAction('session_end', {
                    sessionId: sessionData.id,
                    duration: sessionData.duration,
                    endReason: sessionData.endReason,
                    deviceInfo: sessionData.deviceInfo
                }).catch(console.error);
            }
            
            // 本地存储会话历史
            const sessionHistory = StorageManager.getItem('session_history', []);
            sessionHistory.push({
                id: sessionData.id,
                duration: sessionData.duration,
                endTime: sessionData.endTime,
                endReason: sessionData.endReason
            });
            
            // 保留最近50个会话记录
            if (sessionHistory.length > 50) {
                sessionHistory.splice(0, sessionHistory.length - 50);
            }
            
            StorageManager.setItem('session_history', sessionHistory);
        } catch (error) {
            console.error('记录会话统计失败:', error);
        }
    }

    getSessionHistory() {
        return StorageManager.getItem('session_history', []);
    }
}

// 权限管理器
class PermissionManager {
    constructor() {
        this.permissions = {
            SEARCH: 'search',
            FAVORITE: 'favorite', 
            HISTORY: 'history',
            SYNC: 'sync',
            ADMIN: 'admin',
            PREMIUM: 'premium',
            EXPORT: 'export',
            IMPORT: 'import',
            FEEDBACK: 'feedback'
        };
    }

    hasPermission(user, permission) {
        if (!user || !user.permissions) return false;
        
        const userPermissions = Array.isArray(user.permissions) ? 
            user.permissions : JSON.parse(user.permissions || '[]');
        
        return userPermissions.includes(permission) || 
               userPermissions.includes(this.permissions.ADMIN);
    }

    getUserPermissions(user) {
        if (!user || !user.permissions) return [];
        
        return Array.isArray(user.permissions) ? 
            user.permissions : JSON.parse(user.permissions || '[]');
    }

    checkCurrentUserPermission(permission) {
        const authManager = window.authManager;
        if (!authManager || !authManager.getCurrentUser()) return false;
        
        return this.hasPermission(authManager.getCurrentUser(), permission);
    }

    isPremiumUser(user) {
        return this.hasPermission(user, this.permissions.PREMIUM);
    }

    isAdmin(user) {
        return this.hasPermission(user, this.permissions.ADMIN);
    }

    getPermissionDescription(permission) {
        const descriptions = {
            [this.permissions.SEARCH]: '搜索功能',
            [this.permissions.FAVORITE]: '收藏管理',
            [this.permissions.HISTORY]: '搜索历史',
            [this.permissions.SYNC]: '云端同步',
            [this.permissions.ADMIN]: '管理员权限',
            [this.permissions.PREMIUM]: '高级功能',
            [this.permissions.EXPORT]: '数据导出',
            [this.permissions.IMPORT]: '数据导入',
            [this.permissions.FEEDBACK]: '反馈功能'
        };
        
        return descriptions[permission] || permission;
    }

    getAllPermissions() {
        return Object.values(this.permissions);
    }
}

// 安全策略管理器
class SecurityPolicy {
    constructor() {
        this.loginAttempts = new Map();
        this.registrationAttempts = new Map();
        this.maxLoginAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15分钟
        this.maxRegistrationAttempts = 3;
        this.registrationCooldown = 60 * 60 * 1000; // 1小时
        this.suspiciousIPs = new Set();
    }

    init() {
        // 清理过期记录
        setInterval(() => {
            this.cleanupExpiredAttempts();
        }, 5 * 60 * 1000); // 每5分钟清理一次
        
        // 加载持久化的安全数据
        this.loadSecurityData();
    }

    // 检查登录尝试
    async checkLoginAttempt(username) {
        const ip = await this.getClientIP();
        const key = `${username}:${ip}`;
        const attempts = this.loginAttempts.get(key);
        
        if (!attempts) {
            return { allowed: true };
        }
        
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.lockoutDuration);
        
        if (recentAttempts.length >= this.maxLoginAttempts) {
            const lastAttempt = Math.max(...recentAttempts);
            const remainingTime = Math.ceil((this.lockoutDuration - (now - lastAttempt)) / 1000 / 60);
            
            return {
                allowed: false,
                reason: `登录尝试过多，请 ${remainingTime} 分钟后重试`
            };
        }
        
        // 检查可疑IP
        if (this.suspiciousIPs.has(ip)) {
            return {
                allowed: false,
                reason: '检测到可疑活动，暂时禁止登录'
            };
        }
        
        return { allowed: true };
    }

    // 记录登录失败
    recordLoginFailure(username) {
        this.getClientIP().then(ip => {
            const key = `${username}:${ip}`;
            const attempts = this.loginAttempts.get(key) || [];
            attempts.push(Date.now());
            
            // 保留最近的尝试记录
            const recent = attempts.filter(time => Date.now() - time < this.lockoutDuration);
            this.loginAttempts.set(key, recent);
            
            // 检查是否为可疑IP
            if (recent.length >= this.maxLoginAttempts) {
                this.suspiciousIPs.add(ip);
                console.warn(`🚨 可疑IP标记: ${ip}`);
            }
            
            this.saveSecurityData();
        });
    }

    // 记录登录成功
    recordLoginSuccess(username) {
        this.getClientIP().then(ip => {
            const key = `${username}:${ip}`;
            this.loginAttempts.delete(key);
            this.suspiciousIPs.delete(ip);
            this.saveSecurityData();
        });
    }

    // 检查注册尝试
    async checkRegistrationAttempt(email) {
        const ip = await this.getClientIP();
        const key = `reg:${ip}`;
        const attempts = this.registrationAttempts.get(key);
        
        if (!attempts) {
            return { allowed: true };
        }
        
        const now = Date.now();
        const recentAttempts = attempts.filter(time => now - time < this.registrationCooldown);
        
        if (recentAttempts.length >= this.maxRegistrationAttempts) {
            const lastAttempt = Math.max(...recentAttempts);
            const remainingTime = Math.ceil((this.registrationCooldown - (now - lastAttempt)) / 1000 / 60);
            
            return {
                allowed: false,
                reason: `注册尝试过多，请 ${remainingTime} 分钟后重试`
            };
        }
        
        return { allowed: true };
    }

    // 记录注册尝试
    recordRegistrationAttempt(email, success) {
        this.getClientIP().then(ip => {
            const key = `reg:${ip}`;
            const attempts = this.registrationAttempts.get(key) || [];
            
            if (!success) {
                attempts.push(Date.now());
                const recent = attempts.filter(time => Date.now() - time < this.registrationCooldown);
                this.registrationAttempts.set(key, recent);
            } else {
                this.registrationAttempts.delete(key);
            }
            
            this.saveSecurityData();
        });
    }

    // 获取客户端IP
    async getClientIP() {
        try {
            // 尝试通过WebRTC获取真实IP
            return await this.getWebRTCIP() || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    // WebRTC IP获取
    getWebRTCIP() {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            const noop = () => {};
            
            pc.createDataChannel('');
            pc.createOffer().then(pc.setLocalDescription.bind(pc));
            
            pc.onicecandidate = (ice) => {
                if (!ice || !ice.candidate || !ice.candidate.candidate) return;
                
                const myIP = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(ice.candidate.candidate);
                if (myIP) {
                    resolve(myIP[1]);
                    pc.close();
                }
            };
            
            setTimeout(() => {
                pc.close();
                resolve('unknown');
            }, 1000);
        });
    }

    // 清理过期尝试记录
    cleanupExpiredAttempts() {
        const now = Date.now();
        
        // 清理登录尝试
        for (const [key, attempts] of this.loginAttempts) {
            const recent = attempts.filter(time => now - time < this.lockoutDuration);
            if (recent.length === 0) {
                this.loginAttempts.delete(key);
            } else {
                this.loginAttempts.set(key, recent);
            }
        }
        
        // 清理注册尝试
        for (const [key, attempts] of this.registrationAttempts) {
            const recent = attempts.filter(time => now - time < this.registrationCooldown);
            if (recent.length === 0) {
                this.registrationAttempts.delete(key);
            } else {
                this.registrationAttempts.set(key, recent);
            }
        }
        
        this.saveSecurityData();
    }

    // 持久化安全数据
    saveSecurityData() {
        try {
            const data = {
                loginAttempts: Array.from(this.loginAttempts.entries()),
                registrationAttempts: Array.from(this.registrationAttempts.entries()),
                suspiciousIPs: Array.from(this.suspiciousIPs),
                timestamp: Date.now()
            };
            
            localStorage.setItem('security_data', JSON.stringify(data));
        } catch (error) {
            console.error('保存安全数据失败:', error);
        }
    }

    // 加载安全数据
    loadSecurityData() {
        try {
            const data = localStorage.getItem('security_data');
            if (!data) return;
            
            const parsed = JSON.parse(data);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24小时
            
            // 检查数据是否过期
            if (now - parsed.timestamp > maxAge) {
                localStorage.removeItem('security_data');
                return;
            }
            
            this.loginAttempts = new Map(parsed.loginAttempts || []);
            this.registrationAttempts = new Map(parsed.registrationAttempts || []);
            this.suspiciousIPs = new Set(parsed.suspiciousIPs || []);
            
        } catch (error) {
            console.error('加载安全数据失败:', error);
            localStorage.removeItem('security_data');
        }
    }

    // 获取安全统计
    getSecurityStats() {
        return {
            loginAttempts: this.loginAttempts.size,
            registrationAttempts: this.registrationAttempts.size,
            suspiciousIPs: this.suspiciousIPs.size,
            maxLoginAttempts: this.maxLoginAttempts,
            lockoutDuration: this.lockoutDuration,
            maxRegistrationAttempts: this.maxRegistrationAttempts,
            registrationCooldown: this.registrationCooldown
        };
    }

    // 重置安全策略（管理员功能）
    resetSecurityPolicy() {
        this.loginAttempts.clear();
        this.registrationAttempts.clear();
        this.suspiciousIPs.clear();
        localStorage.removeItem('security_data');
        console.log('🔧 安全策略已重置');
    }
}

// 密码强度检查器
const PasswordStrengthChecker = {
    checkStrength(password) {
        if (!password) return { score: 0, feedback: [] };
        
        let score = 0;
        const feedback = [];
        const checks = [
            {
                test: () => password.length >= 8,
                score: 2,
                feedback: '至少8个字符'
            },
            {
                test: () => /[a-z]/.test(password),
                score: 1,
                feedback: '包含小写字母'
            },
            {
                test: () => /[A-Z]/.test(password),
                score: 1,
                feedback: '包含大写字母'
            },
            {
                test: () => /\d/.test(password),
                score: 1,
                feedback: '包含数字'
            },
            {
                test: () => /[!@#$%^&*(),.?":{}|<>]/.test(password),
                score: 1,
                feedback: '包含特殊字符'
            },
            {
                test: () => !/(.)\1{2,}/.test(password),
                score: 1,
                feedback: '避免连续重复字符'
            },
            {
                test: () => !this.isCommonPassword(password),
                score: 1,
                feedback: '避免常见密码'
            }
        ];
        
        checks.forEach(check => {
            if (check.test()) {
                score += check.score;
            } else {
                feedback.push(check.feedback);
            }
        });
        
        const maxScore = checks.reduce((sum, check) => sum + check.score, 0);
        const percentage = Math.round((score / maxScore) * 100);
        
        let strength;
        if (percentage < 30) strength = '很弱';
        else if (percentage < 50) strength = '弱';
        else if (percentage < 70) strength = '一般';
        else if (percentage < 90) strength = '强';
        else strength = '很强';
        
        return {
            score,
            percentage,
            strength,
            feedback,
            isStrong: score >= 5
        };
    },

    isCommonPassword(password) {
        const common = [
            '123456', 'password', '123456789', '12345678', '12345',
            '111111', '1234567', 'sunshine', 'qwerty', 'iloveyou',
            'princess', 'admin', 'welcome', '666666', 'abc123',
            'football', '123123', 'monkey', '654321', '!@#$%^&*'
        ];
        
        return common.includes(password.toLowerCase());
    },

    generateSecurePassword(length = 12) {
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        
        const allChars = lowercase + uppercase + numbers + symbols;
        let password = '';
        
        // 确保包含每种类型的字符
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

    getRandomChar(chars) {
        const values = new Uint8Array(1);
        crypto.getRandomValues(values);
        return chars.charAt(values[0] % chars.length);
    }
};

// 表单验证器
const FormValidator = {
    validateUsername(username) {
        if (!username) return { valid: false, message: '用户名不能为空' };
        if (username.length < 3) return { valid: false, message: '用户名至少3个字符' };
        if (username.length > 20) return { valid: false, message: '用户名最多20个字符' };
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            return { valid: false, message: '用户名只能包含字母、数字、下划线或中文' };
        }
        if (/^\d+$/.test(username)) {
            return { valid: false, message: '用户名不能为纯数字' };
        }
        return { valid: true };
    },

    validateEmail(email) {
        if (!email) return { valid: false, message: '邮箱不能为空' };
        
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        
        if (!emailRegex.test(email)) {
            return { valid: false, message: '请输入有效的邮箱地址' };
        }
        
        // 检查邮箱长度
        if (email.length > 254) {
            return { valid: false, message: '邮箱地址过长' };
        }
        
        // 检查本地部分长度
        const [localPart] = email.split('@');
        if (localPart.length > 64) {
            return { valid: false, message: '邮箱用户名部分过长' };
        }
        
        return { valid: true };
    },

    validatePassword(password) {
        if (!password) return { valid: false, message: '密码不能为空' };
        if (password.length < 6) return { valid: false, message: '密码至少6个字符' };
        if (password.length > 128) return { valid: false, message: '密码最多128个字符' };
        
        const strength = PasswordStrengthChecker.checkStrength(password);
        if (strength.score < 3) {
            return { 
                valid: false, 
                message: `密码强度不足 (${strength.strength}): ${strength.feedback.slice(0, 2).join('，')}` 
            };
        }
        
        return { valid: true, strength };
    },

    validateSearchKeyword(keyword) {
        if (!keyword) return { valid: false, message: '搜索关键词不能为空' };
        if (keyword.length > 100) return { valid: false, message: '搜索关键词过长' };
        if (/[<>]/.test(keyword)) return { valid: false, message: '搜索关键词包含非法字符' };
        if (keyword.trim().length === 0) return { valid: false, message: '搜索关键词不能为空白' };
        return { valid: true };
    },

    validateAll(data, rules) {
        const results = {};
        let allValid = true;
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = data[field];
            let result;
            
            switch (rule.type) {
                case 'username':
                    result = this.validateUsername(value);
                    break;
                case 'email':
                    result = this.validateEmail(value);
                    break;
                case 'password':
                    result = this.validatePassword(value);
                    break;
                case 'search':
                    result = this.validateSearchKeyword(value);
                    break;
                default:
                    result = { valid: true };
            }
            
            results[field] = result;
            if (!result.valid) {
                allValid = false;
            }
        }
        
        return { valid: allValid, results };
    }
};

// 创建全局认证管理器实例
const authManager = new AuthManager();

// 导出到全局作用域
window.authManager = authManager;
window.auth = authManager; // 兼容性别名
window.PasswordStrengthChecker = PasswordStrengthChecker;
window.FormValidator = FormValidator;

// 监听页面加载完成
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔐 认证系统已就绪');
});

// 监听页面卸载，保存会话数据
window.addEventListener('beforeunload', () => {
    if (authManager.isAuthenticated()) {
        const session = authManager.sessionManager.getSession();
        if (session) {
            localStorage.setItem('session_data', JSON.stringify(session));
        }
    }
});

// 导出类供其他模块使用
export { 
    AuthManager, 
    SessionManager, 
    PermissionManager, 
    SecurityPolicy,
    PasswordStrengthChecker,
    FormValidator 
};
