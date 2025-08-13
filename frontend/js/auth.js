// 用户认证管理模块 - 完整版本
(function() {
    'use strict';

    class AuthenticationManager {
        constructor() {
            this.currentUser = null;
            this.token = localStorage.getItem('auth_token');
            this.listeners = [];
            this.init();
        }

        async init() {
            // 如果有token，尝试验证
            if (this.token) {
                try {
                    await this.verifyToken();
                } catch (error) {
                    console.error('Token验证失败:', error);
                    this.clearAuth();
                }
            }
        }

        // 注册用户
        async register(username, email, password) {
            try {
                // 输入验证
                if (!Validator.username(username)) {
                    throw new Error('用户名格式不正确，只能包含3-20位字母、数字和下划线');
                }
                if (!Validator.email(email)) {
                    throw new Error('邮箱格式不正确');
                }
                if (!Validator.password(password)) {
                    throw new Error('密码长度必须在6-50位之间');
                }

                showLoading(true, '注册中...');

                const response = await API.register(username, email, password);
                
                if (response.success) {
                    showToast('注册成功，请登录', 'success');
                    return { success: true, message: response.message };
                } else {
                    throw new Error(response.message || '注册失败');
                }
            } catch (error) {
                console.error('注册失败:', error);
                showToast(error.message, 'error');
                return { success: false, message: error.message };
            } finally {
                showLoading(false);
            }
        }

        // 用户登录
        async login(username, password) {
            try {
                if (!username || !password) {
                    throw new Error('用户名和密码不能为空');
                }

                showLoading(true, '登录中...');

                const response = await API.login(username, password);
                
                if (response.success && response.token && response.user) {
                    this.setAuth(response.token, response.user);
                    showToast(`欢迎回来，${response.user.username}!`, 'success');
                    
                    // 触发登录事件
                    this.notifyListeners('login', response.user);
                    
                    return { success: true, user: response.user };
                } else {
                    throw new Error(response.message || '登录失败');
                }
            } catch (error) {
                console.error('登录失败:', error);
                showToast(error.message, 'error');
                return { success: false, message: error.message };
            } finally {
                showLoading(false);
            }
        }

        // 验证Token
        async verifyToken() {
            if (!this.token) {
                throw new Error('没有有效的token');
            }

            try {
                const response = await API.verifyToken(this.token);
                
                if (response.success && response.user) {
                    this.currentUser = response.user;
                    this.updateStoredUser(response.user);
                    return response.user;
                } else {
                    throw new Error('Token验证失败');
                }
            } catch (error) {
                console.error('Token验证失败:', error);
                this.clearAuth();
                throw error;
            }
        }

        // 退出登录
        async logout() {
            try {
                showLoading(true, '退出中...');
                
                // 调用API退出
                await API.logout();
                
                showToast('已退出登录', 'success');
            } catch (error) {
                console.error('退出登录失败:', error);
                showToast('退出失败，但已清除本地认证信息', 'warning');
            } finally {
                showLoading(false);
                
                const oldUser = this.currentUser;
                this.clearAuth();
                
                // 触发退出事件
                this.notifyListeners('logout', oldUser);
            }
        }

        // 设置认证信息
        setAuth(token, user) {
            this.token = token;
            this.currentUser = user;
            
            localStorage.setItem('auth_token', token);
            this.updateStoredUser(user);
            
            // 设置API的token
            if (window.API) {
                window.API.setToken(token);
            }
        }

        // 清除认证信息
        clearAuth() {
            this.token = null;
            this.currentUser = null;
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('current_user');
            
            // 清除API的token
            if (window.API) {
                window.API.setToken(null);
            }
        }

        // 更新存储的用户信息
        updateStoredUser(user) {
            localStorage.setItem('current_user', JSON.stringify(user));
        }

        // 获取当前用户
        getCurrentUser() {
            if (this.currentUser) {
                return this.currentUser;
            }
            
            // 尝试从本地存储获取
            try {
                const userData = localStorage.getItem('current_user');
                if (userData) {
                    this.currentUser = JSON.parse(userData);
                    return this.currentUser;
                }
            } catch (error) {
                console.error('解析用户数据失败:', error);
                localStorage.removeItem('current_user');
            }
            
            return null;
        }

        // 检查是否已登录
        isLoggedIn() {
            return !!(this.token && this.currentUser);
        }

        // 检查用户权限
        hasPermission(permission) {
            if (!this.currentUser || !this.currentUser.permissions) {
                return false;
            }
            return this.currentUser.permissions.includes(permission);
        }

        // 添加认证状态监听器
        onAuthStateChanged(callback) {
            if (typeof callback === 'function') {
                this.listeners.push(callback);
            }
        }

        // 移除认证状态监听器
        removeAuthStateListener(callback) {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        }

        // 通知监听器
        notifyListeners(type, user) {
            const event = new CustomEvent('authStateChanged', {
                detail: { type, user }
            });
            
            // 触发DOM事件
            document.dispatchEvent(event);
            
            // 调用注册的回调函数
            this.listeners.forEach(callback => {
                try {
                    callback(event);
                } catch (error) {
                    console.error('认证状态监听器错误:', error);
                }
            });
        }

        // 刷新用户信息
        async refreshUserInfo() {
            if (!this.token) {
                return null;
            }

            try {
                const user = await this.verifyToken();
                this.notifyListeners('refresh', user);
                return user;
            } catch (error) {
                console.error('刷新用户信息失败:', error);
                return null;
            }
        }

        // 修改密码
        async changePassword(currentPassword, newPassword) {
            if (!this.isLoggedIn()) {
                throw new Error('请先登录');
            }

            try {
                if (!Validator.password(newPassword)) {
                    throw new Error('新密码长度必须在6-50位之间');
                }

                showLoading(true, '修改密码中...');

                const response = await API.request('/api/auth/change-password', {
                    method: 'POST',
                    body: JSON.stringify({
                        currentPassword,
                        newPassword
                    })
                });

                if (response.success) {
                    showToast('密码修改成功，请重新登录', 'success');
                    // 强制退出，让用户重新登录
                    await this.logout();
                    return { success: true };
                } else {
                    throw new Error(response.message || '修改密码失败');
                }
            } catch (error) {
                console.error('修改密码失败:', error);
                showToast(error.message, 'error');
                return { success: false, message: error.message };
            } finally {
                showLoading(false);
            }
        }

        // 检查认证状态
        checkAuthStatus() {
            const isValid = this.isLoggedIn();
            if (!isValid) {
                this.clearAuth();
            }
            return isValid;
        }

        // 自动刷新token（如果需要）
        async autoRefreshToken() {
            if (!this.token) return false;

            try {
                // 这里可以实现token自动刷新逻辑
                // 目前后端没有实现refresh token，所以直接验证现有token
                await this.verifyToken();
                return true;
            } catch (error) {
                console.error('Token自动刷新失败:', error);
                return false;
            }
        }

        // 获取用户头像URL（如果有的话）
        getUserAvatar() {
            const user = this.getCurrentUser();
            if (user && user.avatar) {
                return user.avatar;
            }
            
            // 生成默认头像
            const username = user?.username || 'Anonymous';
            const firstChar = username.charAt(0).toUpperCase();
            
            // 使用字符生成颜色
            let hash = 0;
            for (let i = 0; i < username.length; i++) {
                hash = username.charCodeAt(i) + ((hash << 5) - hash);
            }
            const color = `hsl(${Math.abs(hash) % 360}, 60%, 50%)`;
            
            // 生成data URL头像
            const canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 40, 40);
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(firstChar, 20, 20);
            
            return canvas.toDataURL();
        }

        // 获取用户显示名称
        getUserDisplayName() {
            const user = this.getCurrentUser();
            return user?.username || user?.email || '未知用户';
        }

        // 获取用户角色
        getUserRole() {
            const user = this.getCurrentUser();
            return user?.role || 'user';
        }

        // 是否为管理员
        isAdmin() {
            return this.getUserRole() === 'admin';
        }
    }

    // 创建全局认证管理器实例
    const authManager = new AuthenticationManager();

    // 导出到全局作用域
    window.authManager = authManager;

    console.log('✅ 认证管理器已加载完成');

})();
