// 认证管理模块
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        this.tokenExpiry = 0;
        
        // 从环境变量获取配置
        this.jwtExpiryDays = parseInt(window.APP_CONFIG.JWT_EXPIRY_DAYS || '30');
    }
    
    // 初始化 - 尝试从localStorage恢复会话
    init() {
        const savedToken = utils.storage.get('authToken');
        const savedUser = utils.storage.get('user');
        
        if (savedToken && savedUser) {
            this.token = savedToken;
            this.currentUser = savedUser;
            this.isAuthenticated = true;
            this.scheduleTokenRefresh();
        }
    }
    
    // 登录
    async login(username, password) {
        const response = await API.login(username, password);
        
        if (response.success) {
            const { token, user } = response;
            
            this.token = token;
            this.currentUser = user;
            this.isAuthenticated = true;
            
            // 存储到localStorage
            utils.storage.set('authToken', token);
            utils.storage.set('user', user);
            
            // 设置定时刷新token
            this.scheduleTokenRefresh();
            
            return { success: true };
        }
        
        return response;
    }
    
    // 注册
    async register(username, email, password, confirmPassword) {
        if (password !== confirmPassword) {
            return { success: false, message: '两次输入的密码不一致' };
        }
        
        return await API.register(username, email, password);
    }
    
    // 登出
    async logout() {
        if (this.token) {
            await API.logout(this.token);
        }
        
        // 清除会话
        this.clearSession();
        
        return { success: true };
    }
    
    // 验证token
    async verifyToken() {
        if (!this.token) return false;
        
        const response = await API.verifyToken(this.token);
        
        if (response.success && response.user) {
            // 更新用户信息
            this.currentUser = response.user;
            utils.storage.set('user', response.user);
            return true;
        }
        
        return false;
    }
    
    // 刷新token
    async refreshToken() {
        if (!this.token) return false;
        
        const response = await API.refreshToken(this.token);
        
        if (response.success && response.token) {
            this.token = response.token;
            utils.storage.set('authToken', response.token);
            
            // 重新设置定时刷新
            this.scheduleTokenRefresh();
            return true;
        }
        
        return false;
    }
    
    // 计划定时刷新token
    scheduleTokenRefresh() {
        // 在token过期前10分钟刷新
        const refreshTime = (this.jwtExpiryDays * 24 * 60 * 60 * 1000) - (10 * 60 * 1000);
        
        // 清除之前的定时器
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        
        this.refreshTimer = setTimeout(async () => {
            const success = await this.refreshToken();
            if (success) {
                console.log('Token自动刷新成功');
            } else {
                console.warn('Token自动刷新失败，需重新登录');
                this.clearSession();
            }
        }, refreshTime);
    }
    
    // 清除会话
    clearSession() {
        this.token = null;
        this.currentUser = null;
        this.isAuthenticated = false;
        
        utils.storage.remove('authToken');
        utils.storage.remove('user');
        
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
    }
    
    // 检查是否已登录
    isLoggedIn() {
        return this.isAuthenticated;
    }
    
    // 获取当前用户
    getUser() {
        return this.currentUser;
    }
}

// 创建全局认证管理器
const authManager = new AuthManager();
authManager.init(); // 初始化