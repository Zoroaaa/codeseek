// 主要应用逻辑
class MagnetSearchApp {
    constructor() {
        this.authManager = authManager;
        this.utils = utils;
        
        // DOM元素
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.searchResults = document.getElementById('searchResults');
        this.historyList = document.getElementById('historyList');
        this.clearHistory = document.getElementById('clearHistory');
        this.favoritesList = document.getElementById('favoritesList');
        this.userPanel = document.getElementById('userPanel');
        this.authButtons = document.getElementById('authButtons');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.authModal = document.getElementById('authModal');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        this.loginBtn = document.getElementById('loginBtn');
        this.registerBtn = document.getElementById('registerBtn');
        this.loginSubmit = document.getElementById('loginSubmit');
        this.registerSubmit = document.getElementById('registerSubmit');
        this.themeToggle = document.getElementById('themeToggle');
        this.loginUsername = document.getElementById('loginUsername');
        this.loginPassword = document.getElementById('loginPassword');
        this.registerUsername = document.getElementById('registerUsername');
        this.registerEmail = document.getElementById('registerEmail');
        this.registerPassword = document.getElementById('registerPassword');
        this.registerConfirmPassword = document.getElementById('registerConfirmPassword');
        this.toastContainer = document.getElementById('toastContainer');
        
        // 从环境变量获取配置
        this.config = {
            allowRegistration: window.APP_CONFIG.ALLOW_REGISTRATION,
            maxFavorites: window.APP_CONFIG.MAX_FAVORITES || 500,
            maxHistory: window.APP_CONFIG.MAX_HISTORY || 100,
            defaultTheme: window.APP_CONFIG.DEFAULT_THEME || 'light',
            searchDebounce: window.APP_CONFIG.SEARCH_DEBOUNCE || 300
        };
        
        // 状态
        this.history = [];
        this.favorites = [];
        this.searchTimeout = null;
    }
    
    async init() {
        // 初始化UI
        this.setupTheme();
        this.setupEventListeners();
        
        // 尝试恢复会话
        if (this.authManager.isLoggedIn()) {
            this.showUserPanel();
            this.loadFavorites();
        }
        
        // 加载历史记录
        this.loadHistory();
    }
    
    setupEventListeners() {
        // 搜索按钮点击事件
        this.searchBtn.addEventListener('click', () => this.startSearch());
        
        // 输入框回车事件
        this.searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.startSearch();
            } else if (this.searchInput.value.length > 0) {
                this.suggestKeywords(this.searchInput.value);
            }
        });
        
        // 清空历史记录
        this.clearHistory.addEventListener('click', () => this.clearSearchHistory());
        
        // 登录按钮
        this.loginBtn.addEventListener('click', () => this.showAuthModal('login'));
        
        // 注册按钮
        this.registerBtn.addEventListener('click', () => this.showAuthModal('register'));
        
        // 模态框关闭按钮
        this.authModal.querySelector('.close-btn').addEventListener('click', () => {
            this.authModal.style.display = 'none';
        });
        
        // 登录提交
        this.loginSubmit.addEventListener('click', () => this.handleLogin());
        
        // 注册提交
        this.registerSubmit.addEventListener('click', () => this.handleRegister());
        
        // 登出按钮
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
        
        // 主题切换
        this.themeToggle.addEventListener('change', () => {
            const isDark = this.themeToggle.checked;
            document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
            this.utils.storage.set('theme', isDark ? 'dark' : 'light');
        });
        
        // 点击外部关闭模态框
        window.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.authModal.style.display = 'none';
            }
        });
    }
    
    showUserPanel() {
        this.userPanel.classList.remove('hidden');
        this.authButtons.classList.add('hidden');
        
        // 设置用户头像和名称
        const user = this.authManager.getUser();
        if (user && user.username) {
            this.userPanel.querySelector('.avatar').alt = user.username;
        }
    }
    
    showAuthButtons() {
        this.userPanel.classList.add('hidden');
        this.authButtons.classList.remove('hidden');
    }
    
    showAuthModal(formType) {
        if (formType === 'login') {
            this.loginForm.classList.remove('hidden');
            this.registerForm.classList.add('hidden');
        } else {
            this.loginForm.classList.add('hidden');
            this.registerForm.classList.remove('hidden');
        }
        
        this.authModal.style.display = 'block';
    }
    
    setupTheme() {
        const savedTheme = this.utils.storage.get('theme') || this.config.defaultTheme;
        const isDark = savedTheme === 'dark';
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.themeToggle.checked = isDark;
    }
    
    async handleLogin() {
        const username = this.loginUsername.value.trim();
        const password = this.loginPassword.value;
        
        if (!username || !password) {
            this.showToast('用户名和密码不能为空', 'error');
            return;
        }
        
        const response = await this.authManager.login(username, password);
        
        if (response.success) {
            this.showToast('登录成功', 'success');
            this.showUserPanel();
            this.loadFavorites();
            this.authModal.style.display = 'none';
            
            // 清空表单
            this.loginUsername.value = '';
            this.loginPassword.value = '';
        } else {
            this.showToast(response.message || '登录失败', 'error');
        }
    }
    
    async handleRegister() {
        const username = this.registerUsername.value.trim();
        const email = this.registerEmail.value.trim();
        const password = this.registerPassword.value;
        const confirmPassword = this.registerConfirmPassword.value;
        
        // 验证表单
        if (!username || !email || !password || !confirmPassword) {
            this.showToast('请填写所有字段', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            this.showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        if (!this.config.allowRegistration) {
            this.showToast('注册功能当前已关闭', 'error');
            return;
        }
        
        const response = await this.authManager.register(username, email, password);
        
        if (response.success) {
            this.showToast('注册成功！请登录', 'success');
            this.registerForm.classList.add('hidden');
            this.loginForm.classList.remove('hidden');
            
            // 清空注册表单
            this.registerUsername.value = '';
            this.registerEmail.value = '';
            this.registerPassword.value = '';
            this.registerConfirmPassword.value = '';
        } else {
            this.showToast(response.message || '注册失败', 'error');
        }
    }
    
    async handleLogout() {
        await this.authManager.logout();
        this.showAuthButtons();
        this.favoritesList.innerHTML = '';
        this.favoritesList.parentElement.classList.add('hidden');
        this.showToast('已退出登录', 'info');
    }
    
    addSearchHistory(keyword) {
        // 最大历史记录数
        const maxHistory = this.config.maxHistory;
        
        // 去重并添加到最后
        this.history = [
            ...this.history.filter(item => item !== keyword),
            keyword
        ].slice(-maxHistory);
        
        // 保存到storage
        this.utils.storage.set('searchHistory', this.history);
        
        // 更新UI
        this.renderHistory();
    }
    
    renderHistory() {
        this.historyList.innerHTML = '';
        
        this.history.forEach(keyword => {
            const item = document.createElement('li');
            item.className = 'history-item';
            item.innerHTML = `
                <span>${this.utils.escapeHtml(keyword)}</span>
                <button class="remove-history" data-keyword="${this.utils.escapeHtml(keyword)}">×</button>
            `;
            
            item.addEventListener('click', () => {
                this.searchInput.value = keyword;
                this.startSearch();
            });
            
            this.historyList.appendChild(item);
        });
    }
    
    loadHistory() {
        this.history = this.utils.storage.get('searchHistory') || [];
        this.renderHistory();
    }
    
    clearSearchHistory() {
        this.history = [];
        this.utils.storage.remove('searchHistory');
        this.renderHistory();
    }
    
    loadFavorites() {
        if (!this.authManager.isLoggedIn()) {
            return;
        }
        
        API.getFavorites(this.authManager.token).then(response => {
            if (response.success) {
                this.favorites = response.favorites || [];
                this.renderFavorites();
                
                if (this.favorites.length > 0) {
                    this.favoritesList.parentElement.classList.remove('hidden');
                }
            }
        });
    }
    
    renderFavorites() {
        this.favoritesList.innerHTML = '';
        
        this.favorites.forEach(fav => {
            const item = document.createElement('div');
            item.className = 'favorite-item';
            item.innerHTML = `
                <div class="fav-icon">
                    <img src="${fav.icon || '/images/default-fav.png'}" alt="图标">
                </div>
                <div class="fav-content">
                    <div class="fav-title">${this.utils.escapeHtml(fav.title)}</div>
                    <div class="fav-subtitle">${this.utils.escapeHtml(fav.subtitle || '')}</div>
                </div>
                <button class="fav-remove" data-id="${fav.id}">×</button>
            `;
            
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('fav-remove')) {
                    e.stopPropagation();
                    this.removeFavorite(fav.id);
                    return;
                }
                
                // 打开收藏的链接
                window.open(fav.url, '_blank');
            });
            
            this.favoritesList.appendChild(item);
        });
    }
    
    addFavorite(favorite) {
        if (!this.authManager.isLoggedIn()) {
            this.showToast('请先登录后再收藏', 'error');
            return;
        }
        
        if (this.favorites.length >= this.config.maxFavorites) {
            this.showToast(`最多只能收藏 ${this.config.maxFavorites} 个项目`, 'error');
            return;
        }
        
        API.addFavorite(this.authManager.token, favorite).then(response => {
            if (response.success) {
                this.favorites.push(response.favorite);
                this.renderFavorites();
                this.favoritesList.parentElement.classList.remove('hidden');
                this.showToast('收藏成功', 'success');
            }
        });
    }
    
    removeFavorite(favoriteId) {
        API.removeFavorite(this.authManager.token, favoriteId).then(response => {
            if (response.success) {
                this.favorites = this.favorites.filter(fav => fav.id !== favoriteId);
                this.renderFavorites();
                this.showToast('已移除收藏', 'info');
            }
        });
    }
    
    suggestKeywords(keyword) {
        // 此处可以根据历史记录或远程服务提供关键词建议
    }
    
    startSearch() {
        const keyword = this.searchInput.value.trim();
        
        if (!keyword) {
            this.showToast('请输入搜索内容', 'warning');
            return;
        }
        
        // 添加到历史记录
        this.addSearchHistory(keyword);
        
        // 显示加载中
        this.searchResults.innerHTML = '<div class="loading-spinner">搜索中...</div>';
        
        // 使用用户的token（如果已登录）
        const token = this.authManager.token;
        
        API.search(keyword, token).then(response => {
            if (response.success) {
                if (response.results.length === 0) {
                    this.showToast('没有找到任何结果', 'info');
                }
                this.renderSearchResults(response);
            } else {
                this.showToast(response.message || '搜索失败', 'error');
            }
        });
    }
    
    renderSearchResults(response) {
        if (response.results.length === 0) {
            this.searchResults.innerHTML = '<div class="no-results">没有找到任何结果</div>';
            return;
        }
        
        this.searchResults.innerHTML = '';
        
        if (response.cached) {
            this.searchResults.innerHTML = '<div class="cache-notice">缓存搜索结果</div>';
        }
        
        response.results.forEach(item => {
            const resultElement = document.createElement('div');
            resultElement.className = 'result-item';
            resultElement.innerHTML = `
                <h3 class="result-title">${item.title}</h3>
                <div class="result-meta">
                    <span>文件大小: ${item.size}</span>
                    <span>资源数: ${item.seeds}种子/${item.peers}用户</span>
                    <span>来源: ${item.source}</span>
                </div>
                <div class="result-actions">
                    <button class="btn btn-icon favorite-btn" data-id="${item.id}">
                        <svg width="16" height="16" fill="currentColor">
                            <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/>
                        </svg>
                    </button>
                    <a href="${item.magnetLink}" class="btn btn-primary">下载磁力链接</a>
                </div>
            `;
            
            resultElement.querySelector('.favorite-btn').addEventListener('click', () => {
                this.addFavorite({
                    title: item.title,
                    url: item.magnetLink
                });
            });
            
            this.searchResults.appendChild(resultElement);
        });
    }
    
    showToast(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✕' : '!'}
            </div>
            <div class="toast-message">${message}</div>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}