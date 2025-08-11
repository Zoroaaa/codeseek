// 主要应用逻辑
class MagnetSearchApp {
    constructor() {
        this.currentUser = null;
        this.searchHistory = [];
        this.favorites = [];
        this.currentSearchResults = [];
        this.init();
    }

    // 初始化应用
    init() {
        this.bindEvents();
        this.loadLocalData();
        this.initTheme();
        this.checkAuthStatus();
    }

    // 绑定事件监听器
    bindEvents() {
        // 搜索相关
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) searchBtn.addEventListener('click', () => this.performSearch());
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            searchInput.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
        }

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 清除按钮
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const clearResultsBtn = document.getElementById('clearResultsBtn');
        const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');

        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        if (clearResultsBtn) clearResultsBtn.addEventListener('click', () => this.clearResults());
        if (syncFavoritesBtn) syncFavoritesBtn.addEventListener('click', () => this.syncFavorites());

        // 模态框相关
        this.bindModalEvents();
    }

    // 绑定模态框事件
    bindModalEvents() {
        const loginBtn = document.getElementById('loginBtn');
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        const closeBtns = document.querySelectorAll('.close');
        const showRegister = document.getElementById('showRegister');
        const showLogin = document.getElementById('showLogin');

        if (loginBtn) loginBtn.addEventListener('click', () => this.showLoginModal());
        if (showRegister) showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterModal();
        });
        if (showLogin) showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });

        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        // 点击模态框外部关闭
        if (loginModal) {
            loginModal.addEventListener('click', (e) => {
                if (e.target === loginModal) this.closeModals();
            });
        }
        if (registerModal) {
            registerModal.addEventListener('click', (e) => {
                if (e.target === registerModal) this.closeModals();
            });
        }

        // 表单提交
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // 执行搜索
    async performSearch() {
        const searchInput = document.getElementById('searchInput');
        const keyword = searchInput?.value.trim();
        
        if (!keyword) {
            showToast('请输入搜索关键词', 'error');
            return;
        }

        showLoading(true);

        try {
            // 添加到搜索历史
            this.addToHistory(keyword);

            // 执行搜索
            const results = await this.searchKeyword(keyword);
            
            // 显示搜索结果
            this.displaySearchResults(keyword, results);

            // 如果用户已登录且开启自动同步，同步到云端
            if (this.currentUser && document.getElementById('autoSync')?.checked) {
                await this.syncSearchHistory();
            }

        } catch (error) {
            console.error('搜索失败:', error);
            showToast('搜索失败，请稍后重试', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 搜索关键词
    async searchKeyword(keyword) {
        const cacheResults = document.getElementById('cacheResults')?.checked;
        
        // 检查缓存
        if (cacheResults) {
            const cached = this.getCachedResults(keyword);
            if (cached) {
                showToast('使用缓存结果', 'success');
                return cached;
            }
        }

        // 构建搜索源
        const sources = [
            {
                name: 'JavBus',
                url: `https://www.javbus.com/search/${encodeURIComponent(keyword)}`,
                icon: '🎬',
                description: '番号+磁力一体站，信息完善'
            },
            {
                name: 'JavDB',
                url: `https://javdb.com/search?q=${encodeURIComponent(keyword)}&f=all`,
                icon: '📚',
                description: '极简风格番号资料站，轻量快速'
            },
            {
                name: 'JavLibrary',
                url: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodeURIComponent(keyword)}`,
                icon: '📖',
                description: '评论活跃，女优搜索详尽'
            },
            {
                name: 'AV01',
                url: `https://av01.tv/search?keyword=${encodeURIComponent(keyword)}`,
                icon: '🎥',
                description: '快速预览站点，封面大图清晰'
            },
            {
                name: 'MissAV',
                url: `https://missav.com/search/${encodeURIComponent(keyword)}`,
                icon: '💫',
                description: '中文界面，封面高清，信息丰富'
            },
            {
                name: 'btsow',
                url: `https://btsow.com/search/${encodeURIComponent(keyword)}`,
                icon: '🧲',
                description: '中文磁力搜索引擎，番号资源丰富'
            }
        ];

        const results = sources.map((source, index) => ({
            id: `result_${keyword}_${index}`,
            title: source.name,
            subtitle: source.description,
            url: source.url,
            icon: source.icon,
            keyword: keyword,
            timestamp: Date.now()
        }));

        // 缓存结果
        if (cacheResults) {
            this.cacheResults(keyword, results);
        }

        // 如果用户已登录，发送到后端进行高级处理
        if (this.currentUser) {
            try {
                const enhancedResults = await API.searchEnhanced(keyword, results);
                return enhancedResults || results;
            } catch (error) {
                console.error('增强搜索失败:', error);
                return results;
            }
        }

        return results;
    }

    // 显示搜索结果
    displaySearchResults(keyword, results) {
        const resultsSection = document.getElementById('resultsSection');
        const searchInfo = document.getElementById('searchInfo');
        const resultsContainer = document.getElementById('results');
        const clearResultsBtn = document.getElementById('clearResultsBtn');

        if (resultsSection) resultsSection.style.display = 'block';
        if (searchInfo) searchInfo.textContent = `搜索关键词: ${keyword} (${results.length}个结果)`;
        if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';

        if (resultsContainer) {
            resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
            
            // 绑定结果按钮事件
            this.bindResultEvents();
        }

        this.currentSearchResults = results;
    }

    // 创建搜索结果HTML
    createResultHTML(result) {
        const isFavorited = this.favorites.some(fav => fav.url === result.url);
        
        return `
            <div class="result-item" data-id="${result.id}">
                <div class="result-image">
                    <span style="font-size: 2rem;">${result.icon}</span>
                </div>
                <div class="result-title">${result.title}</div>
                <div class="result-subtitle">${result.subtitle}</div>
                <div class="result-actions">
                    <button class="action-btn visit-btn" onclick="app.openResult('${result.url}')">
                        访问
                    </button>
                    <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                            onclick="app.toggleFavorite('${result.id}')">
                        ${isFavorited ? '已收藏' : '收藏'}
                    </button>
                </div>
            </div>
        `;
    }

    // 绑定结果事件
    bindResultEvents() {
        // 已在HTML中使用onclick处理
    }

    // 打开搜索结果
    openResult(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    // 切换收藏状态
    toggleFavorite(resultId) {
        const result = this.currentSearchResults.find(r => r.id === resultId);
        if (!result) return;

        const existingIndex = this.favorites.findIndex(fav => fav.url === result.url);
        
        if (existingIndex >= 0) {
            // 移除收藏
            this.favorites.splice(existingIndex, 1);
            showToast('已移除收藏', 'success');
        } else {
            // 添加收藏
            const favorite = {
                id: `fav_${Date.now()}`,
                title: result.title,
                subtitle: result.subtitle,
                url: result.url,
                icon: result.icon,
                keyword: result.keyword,
                addedAt: new Date().toISOString()
            };
            this.favorites.unshift(favorite);
            showToast('已添加收藏', 'success');
        }

        this.saveFavorites();
        this.renderFavorites();
        this.updateFavoriteButtons();

        // 如果用户已登录，同步到云端
        if (this.currentUser) {
            this.syncFavorites();
        }
    }

    // 更新收藏按钮状态
    updateFavoriteButtons() {
        const favoriteButtons = document.querySelectorAll('.favorite-btn');
        favoriteButtons.forEach(btn => {
            const resultItem = btn.closest('.result-item');
            const resultId = resultItem?.dataset.id;
            const result = this.currentSearchResults.find(r => r.id === resultId);
            
            if (result) {
                const isFavorited = this.favorites.some(fav => fav.url === result.url);
                btn.textContent = isFavorited ? '已收藏' : '收藏';
                btn.classList.toggle('favorited', isFavorited);
            }
        });
    }

    // 添加到搜索历史
    addToHistory(keyword) {
        // 移除重复项
        this.searchHistory = this.searchHistory.filter(item => item.keyword !== keyword);
        
        // 添加到开头
        this.searchHistory.unshift({
            keyword,
            timestamp: Date.now(),
            count: 1
        });

        // 限制历史记录数量
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }

        this.saveHistory();
        this.renderHistory();
    }

    // 渲染搜索历史
    renderHistory() {
        const historySection = document.getElementById('historySection');
        const historyList = document.getElementById('historyList');

        if (this.searchHistory.length === 0) {
            if (historySection) historySection.style.display = 'none';
            return;
        }

        if (historySection) historySection.style.display = 'block';
        
        if (historyList) {
            historyList.innerHTML = this.searchHistory.map(item => 
                `<span class="history-item" onclick="app.searchFromHistory('${item.keyword.replace(/'/g, "\\'")}')">
                    ${item.keyword}
                </span>`
            ).join('');
        }
    }

    // 从历史记录搜索
    searchFromHistory(keyword) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = keyword;
            this.performSearch();
        }
    }

    // 渲染收藏夹
    renderFavorites() {
        const favoritesContainer = document.getElementById('favorites');
        
        if (!favoritesContainer) return;

        if (this.favorites.length === 0) {
            favoritesContainer.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                    <span style="font-size: 3rem;">📌</span>
                    <p>暂无收藏，搜索后添加收藏吧！</p>
                </div>
            `;
            return;
        }

        favoritesContainer.innerHTML = this.favorites.map(fav => `
            <div class="favorite-item" data-id="${fav.id}">
                <div class="favorite-title">
                    <span style="margin-right: 0.5rem;">${fav.icon}</span>
                    ${fav.title}
                </div>
                <div class="favorite-url">${fav.url}</div>
                <div class="favorite-actions">
                    <button class="action-btn visit-btn" onclick="app.openResult('${fav.url}')">
                        访问
                    </button>
                    <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 移除收藏
    removeFavorite(favoriteId) {
        const index = this.favorites.findIndex(fav => fav.id === favoriteId);
        if (index >= 0) {
            this.favorites.splice(index, 1);
            this.saveFavorites();
            this.renderFavorites();
            this.updateFavoriteButtons();
            showToast('已移除收藏', 'success');

            // 同步到云端
            if (this.currentUser) {
                this.syncFavorites();
            }
        }
    }

    // 清除搜索历史
    clearHistory() {
        if (confirm('确定要清除所有搜索历史吗？')) {
            this.searchHistory = [];
            this.saveHistory();
            this.renderHistory();
            showToast('搜索历史已清除', 'success');
        }
    }

    // 清除搜索结果
    clearResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContainer = document.getElementById('results');
        const searchInfo = document.getElementById('searchInfo');
        const clearResultsBtn = document.getElementById('clearResultsBtn');

        if (resultsSection) resultsSection.style.display = 'none';
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (searchInfo) searchInfo.textContent = '';
        if (clearResultsBtn) clearResultsBtn.style.display = 'none';

        this.currentSearchResults = [];
    }

    // 缓存管理
    getCachedResults(keyword) {
        const cacheKey = `search_cache_${keyword}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
            const data = JSON.parse(cached);
            const now = Date.now();
            const cacheTimeout = 30 * 60 * 1000; // 30分钟
            
            if (now - data.timestamp < cacheTimeout) {
                return data.results;
            } else {
                localStorage.removeItem(cacheKey);
            }
        }
        
        return null;
    }

    cacheResults(keyword, results) {
        const cacheKey = `search_cache_${keyword}`;
        const data = {
            keyword,
            results,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (error) {
            console.error('缓存失败:', error);
        }
    }

    // 本地数据管理
    loadLocalData() {
        // 加载搜索历史
        const savedHistory = localStorage.getItem('search_history');
        if (savedHistory) {
            try {
                this.searchHistory = JSON.parse(savedHistory);
                this.renderHistory();
            } catch (error) {
                console.error('加载搜索历史失败:', error);
                this.searchHistory = [];
            }
        }

        // 加载收藏夹
        const savedFavorites = localStorage.getItem('favorites');
        if (savedFavorites) {
            try {
                this.favorites = JSON.parse(savedFavorites);
                this.renderFavorites();
            } catch (error) {
                console.error('加载收藏夹失败:', error);
                this.favorites = [];
            }
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('search_history', JSON.stringify(this.searchHistory));
        } catch (error) {
            console.error('保存搜索历史失败:', error);
        }
    }

    saveFavorites() {
        try {
            localStorage.setItem('favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('保存收藏夹失败:', error);
        }
    }

    // 主题管理
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        const themeToggle = document.getElementById('themeToggle');
        
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeToggle) themeToggle.textContent = '☀️';
        } else {
            if (themeToggle) themeToggle.textContent = '🌙';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const themeToggle = document.getElementById('themeToggle');
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
        
        showToast(`已切换到${newTheme === 'dark' ? '深色' : '浅色'}主题`, 'success');
    }

    // 云端同步
    async syncFavorites() {
        if (!this.currentUser) {
            showToast('请先登录', 'error');
            return;
        }

        try {
            showLoading(true);
            await API.syncFavorites(this.favorites);
            showToast('收藏夹同步成功', 'success');
        } catch (error) {
            console.error('收藏夹同步失败:', error);
            showToast('收藏夹同步失败', 'error');
        } finally {
            showLoading(false);
        }
    }

    async syncSearchHistory() {
        if (!this.currentUser) return;

        try {
            await API.syncSearchHistory(this.searchHistory);
        } catch (error) {
            console.error('搜索历史同步失败:', error);
        }
    }

    // 模态框管理
    showLoginModal() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (registerModal) registerModal.style.display = 'none';
        if (loginModal) loginModal.style.display = 'block';
    }

    showRegisterModal() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (loginModal) loginModal.style.display = 'none';
        if (registerModal) registerModal.style.display = 'block';
    }

    closeModals() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (loginModal) loginModal.style.display = 'none';
        if (registerModal) registerModal.style.display = 'none';
    }

    // 认证处理
    async handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('loginUsername')?.value;
        const password = document.getElementById('loginPassword')?.value;

        if (!username || !password) {
            showToast('请填写用户名和密码', 'error');
            return;
        }

        try {
            showLoading(true);
            const result = await API.login(username, password);
            
            if (result.success) {
                this.currentUser = result.user;
                this.updateUserUI();
                this.closeModals();
                showToast(`欢迎回来，${result.user.username}！`, 'success');
                
                // 登录后同步云端数据
                await this.loadCloudData();
            } else {
                showToast(result.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            showToast('登录失败，请稍后重试', 'error');
        } finally {
            showLoading(false);
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const username = document.getElementById('regUsername')?.value;
        const email = document.getElementById('regEmail')?.value;
        const password = document.getElementById('regPassword')?.value;
        const confirmPassword = document.getElementById('regConfirmPassword')?.value;

        if (!username || !email || !password || !confirmPassword) {
            showToast('请填写所有字段', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('密码长度至少6位', 'error');
            return;
        }

        try {
            showLoading(true);
            const result = await API.register(username, email, password);
            
            if (result.success) {
                showToast('注册成功，请登录', 'success');
                this.showLoginModal();
            } else {
                showToast(result.message || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册失败:', error);
            showToast('注册失败，请稍后重试', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 检查认证状态
    async checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        if (token) {
            try {
                const result = await API.verifyToken(token);
                if (result.success) {
                    this.currentUser = result.user;
                    this.updateUserUI();
                    await this.loadCloudData();
                } else {
                    localStorage.removeItem('auth_token');
                }
            } catch (error) {
                console.error('验证token失败:', error);
                localStorage.removeItem('auth_token');
            }
        }
    }

    // 更新用户界面
    updateUserUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const username = document.getElementById('username');

        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (username) username.textContent = this.currentUser.username;
            
            // 绑定退出登录事件
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'none';
        }
    }

    // 退出登录
    logout() {
        this.currentUser = null;
        localStorage.removeItem('auth_token');
        this.updateUserUI();
        showToast('已退出登录', 'success');
    }

    // 加载云端数据
    async loadCloudData() {
        if (!this.currentUser) return;

        try {
            // 加载云端收藏夹
            const cloudFavorites = await API.getFavorites();
            if (cloudFavorites && cloudFavorites.length > 0) {
                this.favorites = cloudFavorites;
                this.saveFavorites();
                this.renderFavorites();
            }

            // 加载云端搜索历史
            const cloudHistory = await API.getSearchHistory();
            if (cloudHistory && cloudHistory.length > 0) {
                this.searchHistory = cloudHistory;
                this.saveHistory();
                this.renderHistory();
            }
        } catch (error) {
            console.error('加载云端数据失败:', error);
        }
    }

    // 搜索输入处理
    handleSearchInput(value) {
        // 可以在这里添加搜索建议功能
        if (value.length > 0) {
            // 显示相关的历史搜索
            this.showSearchSuggestions(value);
        }
    }

    // 显示搜索建议
    showSearchSuggestions(query) {
        const suggestions = this.searchHistory
            .filter(item => item.keyword.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
        
        // 这里可以实现搜索建议下拉框
        // 暂时省略UI实现
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MagnetSearchApp();
});