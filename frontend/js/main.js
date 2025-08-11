// 主要应用逻辑 - 优化版本
// 修复认证集成、错误处理、UI交互等问题
class MagnetSearchApp {
    constructor() {
        this.currentUser = null;
        this.searchHistory = [];
        this.favorites = [];
        this.currentSearchResults = [];
        this.isInitialized = false;
        this.config = {};
        this.init();
    }

    // 初始化应用
    async init() {
        try {
            showLoading(true);
            
            // 加载系统配置
            await this.loadConfig();
            
            // 绑定事件
            this.bindEvents();
            
            // 加载本地数据
            this.loadLocalData();
            
            // 初始化主题
            this.initTheme();
            
            // 检查认证状态
            await this.checkAuthStatus();
            
            // 测试API连接
            await this.testAPIConnection();
            
            this.isInitialized = true;
            console.log('✅ 应用初始化完成');
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            showToast('应用初始化失败，请刷新页面重试', 'error', 5000);
        } finally {
            showLoading(false);
        }
    }

    // 加载系统配置
    async loadConfig() {
        try {
            this.config = await API.getConfig();
            console.log('📋 系统配置已加载:', this.config);
        } catch (error) {
            console.error('配置加载失败:', error);
            // 使用默认配置
            this.config = {
                allowRegistration: true,
                minUsernameLength: 3,
                maxUsernameLength: 20,
                minPasswordLength: 6,
                maxFavoritesPerUser: 1000,
                maxHistoryPerUser: 1000
            };
        }
    }

    // 测试API连接
    async testAPIConnection() {
        try {
            const testResult = await APITester.testConnection();
            if (!testResult.tests.every(t => t.status === 'success')) {
                console.warn('⚠️ API连接测试存在问题');
                showToast('API连接不稳定，部分功能可能受影响', 'warning', 5000);
            }
        } catch (error) {
            console.error('API连接测试失败:', error);
            showToast('无法连接到服务器，请检查网络连接', 'error', 5000);
        }
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
            searchInput.addEventListener('input', debounce((e) => {
                this.handleSearchInput(e.target.value);
            }, 300));
        }

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 功能按钮
        this.bindFunctionButtons();
        
        // 模态框相关
        this.bindModalEvents();

        // 全局键盘快捷键
        this.bindKeyboardShortcuts();
    }

    // 绑定功能按钮
    bindFunctionButtons() {
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        const clearResultsBtn = document.getElementById('clearResultsBtn');
        const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');
        const refreshBtn = document.getElementById('refreshBtn');

        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        if (clearResultsBtn) clearResultsBtn.addEventListener('click', () => this.clearResults());
        if (syncFavoritesBtn) syncFavoritesBtn.addEventListener('click', () => this.syncFavorites());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshData());
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
        [loginModal, registerModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) this.closeModals();
                });
            }
        });

        // 表单提交
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    // 绑定键盘快捷键
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K 聚焦搜索框
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('searchInput');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }

            // Escape 关闭模态框
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    // 执行搜索
    async performSearch() {
        const searchInput = document.getElementById('searchInput');
        const keyword = searchInput?.value.trim();
        
        if (!keyword) {
            showToast('请输入搜索关键词', 'error');
            searchInput?.focus();
            return;
        }

        // 验证搜索关键词
        if (keyword.length > 100) {
            showToast('搜索关键词过长', 'error');
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

            // 记录搜索行为
            if (typeof API !== 'undefined') {
                API.recordAction('search', { keyword, resultCount: results.length }).catch(console.error);
            }

            // 如果用户已登录，记录搜索
            if (this.currentUser) {
                API.addSearchRecord(keyword, results).catch(console.error);
                
                // 自动同步（如果开启）
                if (document.getElementById('autoSync')?.checked) {
                    await this.syncSearchHistory();
                }
            }

        } catch (error) {
            console.error('搜索失败:', error);
            showToast(`搜索失败: ${error.message}`, 'error');
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
                showToast('使用缓存结果', 'info');
                return cached;
            }
        }

        // 构建搜索源
        const sources = this.buildSearchSources(keyword);

        // 如果用户已登录，尝试使用增强搜索
        if (this.currentUser) {
            try {
                const enhancedResults = await API.searchEnhanced(keyword, sources);
                if (enhancedResults) {
                    // 缓存结果
                    if (cacheResults) {
                        this.cacheResults(keyword, enhancedResults);
                    }
                    return enhancedResults;
                }
            } catch (error) {
                console.warn('增强搜索失败，使用基础搜索:', error);
            }
        }

        // 缓存基础搜索结果
        if (cacheResults) {
            this.cacheResults(keyword, sources);
        }

        return sources;
    }

    // 构建搜索源
    buildSearchSources(keyword) {
        const encodedKeyword = encodeURIComponent(keyword);
        
        return [
            {
                id: `result_${keyword}_javbus`,
                title: 'JavBus',
                subtitle: '番号+磁力一体站，信息完善',
                url: `https://www.javbus.com/search/${encodedKeyword}`,
                icon: '🎬',
                keyword: keyword,
                timestamp: Date.now()
            },
            {
                id: `result_${keyword}_javdb`,
                title: 'JavDB',
                subtitle: '极简风格番号资料站，轻量快速',
                url: `https://javdb.com/search?q=${encodedKeyword}&f=all`,
                icon: '📚',
                keyword: keyword,
                timestamp: Date.now()
            },
            {
                id: `result_${keyword}_javlibrary`,
                title: 'JavLibrary',
                subtitle: '评论活跃，女优搜索详尽',
                url: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodedKeyword}`,
                icon: '📖',
                keyword: keyword,
                timestamp: Date.now()
            },
            {
                id: `result_${keyword}_av01`,
                title: 'AV01',
                subtitle: '快速预览站点，封面大图清晰',
                url: `https://av01.tv/search?keyword=${encodedKeyword}`,
                icon: '🎥',
                keyword: keyword,
                timestamp: Date.now()
            },
            {
                id: `result_${keyword}_missav`,
                title: 'MissAV',
                subtitle: '中文界面，封面高清，信息丰富',
                url: `https://missav.com/search/${encodedKeyword}`,
                icon: '💫',
                keyword: keyword,
                timestamp: Date.now()
            },
            {
                id: `result_${keyword}_btsow`,
                title: 'btsow',
                subtitle: '中文磁力搜索引擎，番号资源丰富',
                url: `https://btsow.com/search/${encodedKeyword}`,
                icon: '🧲',
                keyword: keyword,
                timestamp: Date.now()
            }
        ];
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
        
        // 滚动到结果区域
        setTimeout(() => {
            resultsSection?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }

    // 创建搜索结果HTML
    createResultHTML(result) {
        const isFavorited = this.favorites.some(fav => fav.url === result.url);
        
        return `
            <div class="result-item" data-id="${result.id}">
                <div class="result-image">
                    <span style="font-size: 2rem;">${result.icon}</span>
                </div>
                <div class="result-content">
                    <div class="result-title">${this.escapeHtml(result.title)}</div>
                    <div class="result-subtitle">${this.escapeHtml(result.subtitle)}</div>
                    <div class="result-url">${this.escapeHtml(result.url)}</div>
                </div>
                <div class="result-actions">
                    <button class="action-btn visit-btn" onclick="app.openResult('${this.escapeHtml(result.url)}')">
                        访问
                    </button>
                    <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                            onclick="app.toggleFavorite('${result.id}')">
                        ${isFavorited ? '已收藏' : '收藏'}
                    </button>
                    <button class="action-btn copy-btn" onclick="app.copyToClipboard('${this.escapeHtml(result.url)}')">
                        复制
                    </button>
                </div>
            </div>
        `;
    }

    // HTML转义
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // 绑定结果事件
    bindResultEvents() {
        // 已在HTML中使用onclick处理，无需额外绑定
    }

    // 打开搜索结果
    openResult(url) {
        try {
            // 记录访问行为
            if (typeof API !== 'undefined') {
                API.recordAction('visit_site', { url }).catch(console.error);
            }
            
            window.open(url, '_blank', 'noopener,noreferrer');
            showToast('已在新标签页打开', 'success');
        } catch (error) {
            console.error('打开链接失败:', error);
            showToast('无法打开链接', 'error');
        }
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('已复制到剪贴板', 'success');
            
            // 记录复制行为
            if (typeof API !== 'undefined') {
                API.recordAction('copy_url', { url: text }).catch(console.error);
            }
        } catch (error) {
            // 降级到旧方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('已复制到剪贴板', 'success');
            } catch (err) {
                showToast('复制失败', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    // 切换收藏状态
    async toggleFavorite(resultId) {
        const result = this.currentSearchResults.find(r => r.id === resultId);
        if (!result) return;

        const existingIndex = this.favorites.findIndex(fav => fav.url === result.url);
        
        try {
            if (existingIndex >= 0) {
                // 移除收藏
                this.favorites.splice(existingIndex, 1);
                showToast('已移除收藏', 'success');
            } else {
                // 检查收藏数量限制
                const maxFavorites = this.config.maxFavoritesPerUser || 1000;
                if (this.favorites.length >= maxFavorites) {
                    showToast(`收藏数量已达上限 (${maxFavorites})`, 'error');
                    return;
                }
                
                // 添加收藏
                const favorite = {
                    id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
                await this.syncFavorites();
            }
        } catch (error) {
            console.error('收藏操作失败:', error);
            showToast('收藏操作失败', 'error');
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
        const maxHistory = this.config.maxHistoryPerUser || 1000;
        if (this.searchHistory.length > maxHistory) {
            this.searchHistory = this.searchHistory.slice(0, maxHistory);
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
            historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => 
                `<span class="history-item" onclick="app.searchFromHistory('${this.escapeHtml(item.keyword)}')">
                    ${this.escapeHtml(item.keyword)}
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
                <div class="empty-state">
                    <span style="font-size: 3rem;">📌</span>
                    <p>暂无收藏，搜索后添加收藏吧！</p>
                    ${this.currentUser ? '' : '<p><small>登录后可以同步收藏到云端</small></p>'}
                </div>
            `;
            return;
        }

        favoritesContainer.innerHTML = this.favorites.map(fav => `
            <div class="favorite-item" data-id="${fav.id}">
                <div class="favorite-content">
                    <div class="favorite-title">
                        <span class="favorite-icon">${fav.icon}</span>
                        <span class="favorite-name">${this.escapeHtml(fav.title)}</span>
                    </div>
                    <div class="favorite-subtitle">${this.escapeHtml(fav.subtitle)}</div>
                    <div class="favorite-url">${this.escapeHtml(fav.url)}</div>
                    <div class="favorite-meta">
                        <span>关键词: ${this.escapeHtml(fav.keyword)}</span>
                        <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
                    </div>
                </div>
                <div class="favorite-actions">
                    <button class="action-btn visit-btn" onclick="app.openResult('${this.escapeHtml(fav.url)}')">
                        访问
                    </button>
                    <button class="action-btn copy-btn" onclick="app.copyToClipboard('${this.escapeHtml(fav.url)}')">
                        复制
                    </button>
                    <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 移除收藏
    async removeFavorite(favoriteId) {
        if (!confirm('确定要移除这个收藏吗？')) return;
        
        const index = this.favorites.findIndex(fav => fav.id === favoriteId);
        if (index >= 0) {
            this.favorites.splice(index, 1);
            this.saveFavorites();
            this.renderFavorites();
            this.updateFavoriteButtons();
            showToast('已移除收藏', 'success');

            // 同步到云端
            if (this.currentUser) {
                await this.syncFavorites();
            }
        }
    }

    // 清除搜索历史
    clearHistory() {
        if (!confirm('确定要清除所有搜索历史吗？')) return;
        
        this.searchHistory = [];
        this.saveHistory();
        this.renderHistory();
        showToast('搜索历史已清除', 'success');
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
        showToast('搜索结果已清除', 'success');
    }

    // 刷新数据
    async refreshData() {
        if (!this.currentUser) {
            showToast('请先登录', 'error');
            return;
        }

        try {
            showLoading(true);
            showToast('正在刷新数据...', 'info');
            
            await this.loadCloudData();
            showToast('数据刷新成功', 'success');
        } catch (error) {
            console.error('刷新数据失败:', error);
            showToast('数据刷新失败', 'error');
        } finally {
            showLoading(false);
        }
    }

    // 缓存管理
    getCachedResults(keyword) {
        const cacheKey = `search_cache_${keyword}`;
        const cached = StorageManager.getItem(cacheKey);
        
        if (cached) {
            const now = Date.now();
            const cacheTimeout = 30 * 60 * 1000; // 30分钟
            
            if (now - cached.timestamp < cacheTimeout) {
                return cached.results;
            } else {
                StorageManager.removeItem(cacheKey);
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
        
        StorageManager.setItem(cacheKey, data);
    }

    // 本地数据管理
    loadLocalData() {
        try {
            // 加载搜索历史
            this.searchHistory = StorageManager.getItem('search_history', []);
            this.renderHistory();

            // 加载收藏夹
            this.favorites = StorageManager.getItem('favorites', []);
            this.renderFavorites();
            
            console.log(`📚 本地数据已加载: ${this.searchHistory.length}条历史, ${this.favorites.length}个收藏`);
        } catch (error) {
            console.error('加载本地数据失败:', error);
            this.searchHistory = [];
            this.favorites = [];
        }
    }

    saveHistory() {
        StorageManager.setItem('search_history', this.searchHistory);
    }

    saveFavorites() {
        StorageManager.setItem('favorites', this.favorites);
    }

    // 主题管理
    initTheme() {
        const savedTheme = StorageManager.getItem('theme', 'light');
        const themeToggle = document.getElementById('themeToggle');
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        if (themeToggle) {
            themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        const themeToggle = document.getElementById('themeToggle');
        
        document.documentElement.setAttribute('data-theme', newTheme);
        StorageManager.setItem('theme', newTheme);
        
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
            showToast(`收藏夹同步失败: ${error.message}`, 'error');
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
        if (loginModal) {
            loginModal.style.display = 'block';
            // 聚焦用户名输入框
            setTimeout(() => {
                const usernameInput = document.getElementById('loginUsername');
                if (usernameInput) usernameInput.focus();
            }, 100);
        }
    }

    showRegisterModal() {
        const loginModal = document.getElementById('loginModal');
        const registerModal = document.getElementById('registerModal');
        
        if (loginModal) loginModal.style.display = 'none';
        if (registerModal) {
            registerModal.style.display = 'block';
            // 聚焦用户名输入框
            setTimeout(() => {
                const usernameInput = document.getElementById('regUsername');
                if (usernameInput) usernameInput.focus();
            }, 100);
        }
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
        
        const username = document.getElementById('loginUsername')?.value.trim();
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
                
                // 清空登录表单
                document.getElementById('loginForm').reset();
            } else {
                showToast(result.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录失败:', error);
            showToast(`登录失败: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const username = document.getElementById('regUsername')?.value.trim();
        const email = document.getElementById('regEmail')?.value.trim();
        const password = document.getElementById('regPassword')?.value;
        const confirmPassword = document.getElementById('regConfirmPassword')?.value;

        // 客户端验证
        if (!username || !email || !password || !confirmPassword) {
            showToast('请填写所有字段', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }

        // 使用配置中的验证规则
        if (username.length < this.config.minUsernameLength || username.length > this.config.maxUsernameLength) {
            showToast(`用户名长度应在${this.config.minUsernameLength}-${this.config.maxUsernameLength}个字符之间`, 'error');
            return;
        }

        if (password.length < this.config.minPasswordLength) {
            showToast(`密码长度至少${this.config.minPasswordLength}个字符`, 'error');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast('请输入有效的邮箱地址', 'error');
            return;
        }

        try {
            showLoading(true);
            const result = await API.register(username, email, password);
            
            if (result.success) {
                showToast('注册成功，请登录', 'success');
                this.showLoginModal();
                
                // 清空注册表单
                document.getElementById('registerForm').reset();
                
                // 预填用户名到登录表单
                const loginUsername = document.getElementById('loginUsername');
                if (loginUsername) loginUsername.value = username;
            } else {
                showToast(result.message || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册失败:', error);
            showToast(`注册失败: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    // 检查认证状态
    async checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        try {
            const result = await API.verifyToken(token);
            if (result.success && result.user) {
                this.currentUser = result.user;
                this.updateUserUI();
                await this.loadCloudData();
                console.log('✅ 用户认证成功:', this.currentUser.username);
            } else {
                localStorage.removeItem('auth_token');
                console.log('❌ Token验证失败，已清除');
            }
        } catch (error) {
            console.error('验证token失败:', error);
            localStorage.removeItem('auth_token');
        }
    }

    // 更新用户界面
    updateUserUI() {
        const loginBtn = document.getElementById('loginBtn');
        const userInfo = document.getElementById('userInfo');
        const username = document.getElementById('username');
        const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');

        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            if (username) username.textContent = this.currentUser.username;
            if (syncFavoritesBtn) syncFavoritesBtn.style.display = 'inline-block';
            
            // 绑定退出登录事件
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.onclick = () => this.logout();
            }
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'none';
            if (syncFavoritesBtn) syncFavoritesBtn.style.display = 'none';
        }
    }

    // 退出登录
    async logout() {
        try {
            await API.logout();
        } catch (error) {
            console.error('退出登录请求失败:', error);
        } finally {
            this.currentUser = null;
            localStorage.removeItem('auth_token');
            this.updateUserUI();
            showToast('已退出登录', 'success');
        }
    }

    // 加载云端数据
    async loadCloudData() {
        if (!this.currentUser) return;

        try {
            // 加载云端收藏夹
            const cloudFavorites = await API.getFavorites();
            if (cloudFavorites && cloudFavorites.length > 0) {
                // 合并本地和云端收藏，以云端为准
                this.favorites = cloudFavorites;
                this.saveFavorites();
                this.renderFavorites();
                console.log(`☁️ 云端收藏已加载: ${cloudFavorites.length}个`);
            }

            // 加载云端搜索历史
            const cloudHistory = await API.getSearchHistory();
            if (cloudHistory && cloudHistory.length > 0) {
                // 合并本地和云端历史
                const mergedHistory = [...cloudHistory];
                
                // 添加本地独有的历史记录
                this.searchHistory.forEach(localItem => {
                    if (!mergedHistory.some(cloudItem => cloudItem.keyword === localItem.keyword)) {
                        mergedHistory.push(localItem);
                    }
                });
                
                // 排序并限制数量
                this.searchHistory = mergedHistory
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .slice(0, this.config.maxHistoryPerUser || 1000);
                
                this.saveHistory();
                this.renderHistory();
                console.log(`☁️ 云端历史已加载: ${cloudHistory.length}条`);
            }
        } catch (error) {
            console.error('加载云端数据失败:', error);
            showToast('加载云端数据失败，使用本地数据', 'warning');
        }
    }

    // 搜索输入处理
    handleSearchInput(value) {
        if (value.length > 0) {
            this.showSearchSuggestions(value);
        } else {
            this.hideSearchSuggestions();
        }
    }

    // 显示搜索建议
    showSearchSuggestions(query) {
        const suggestions = this.searchHistory
            .filter(item => item.keyword.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
        
        // 这里可以实现搜索建议下拉框
        // 暂时省略UI实现，可以在后续版本中添加
    }

    // 隐藏搜索建议
    hideSearchSuggestions() {
        // 隐藏搜索建议下拉框
    }
}

// 全局工具函数
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

function formatRelativeTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    
    const minute = 60 * 1000;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return `${Math.floor(diff / minute)}分钟前`;
    } else if (diff < day) {
        return `${Math.floor(diff / hour)}小时前`;
    } else if (diff < week) {
        return `${Math.floor(diff / day)}天前`;
    } else {
        return target.toLocaleDateString('zh-CN');
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 初始化Magnet Search应用...');
    app = new MagnetSearchApp();
});

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    showToast('应用出现错误，请刷新页面重试', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
        // 自动处理认证失败
        if (app && app.currentUser) {
            app.logout();
        }
    }
});