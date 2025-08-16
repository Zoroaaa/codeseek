// 主要应用逻辑 - 优化版本
class MagnetSearchApp {
    constructor() {
        this.currentUser = null;
        this.searchHistory = [];
        this.favorites = [];
        this.currentSearchResults = [];
        this.isInitialized = false;
        this.config = {};
        this.connectionStatus = 'checking';
        this.init();
    }

    async init() {
        try {
            showLoading(true);
            console.log('🚀 初始化磁力快搜应用...');
            
            // 显示连接状态
            this.showConnectionStatus();
            
            // 加载系统配置
            await this.loadConfig();
            
            // 绑定事件
            this.bindEvents();
            
            // 初始化主题（仅从localStorage读取主题设置）
            this.initTheme();
            
            // 检查认证状态
            await this.checkAuthStatus();
            
            // 若未认证，打开登录模态
            if (!this.currentUser) {
                document.getElementById('loginModal').style.display = 'block';
                document.querySelector('.main-content').style.display = 'none';
            } else {
                document.querySelector('.main-content').style.display = 'block';
                // 已登录用户直接加载云端数据
                await this.loadCloudData();
            }

            // 测试API连接
            await this.testConnection();
            
            // 处理URL参数（如搜索关键词）
            this.handleURLParams();
            
            this.isInitialized = true;
            this.hideConnectionStatus();
            console.log('✅ 应用初始化完成');
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            this.connectionStatus = 'error';
            this.updateConnectionStatus('连接失败');
            showToast('应用初始化失败，请刷新页面重试', 'error', 5000);
        } finally {
            showLoading(false);
        }
    }


    showConnectionStatus() {
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.style.display = 'flex';
            this.updateConnectionStatus('正在连接...');
        }
    }

    hideConnectionStatus() {
        const status = document.getElementById('connectionStatus');
        if (status && this.connectionStatus === 'connected') {
            setTimeout(() => {
                status.style.display = 'none';
            }, 2000);
        }
    }

    updateConnectionStatus(text) {
        const statusText = document.querySelector('#connectionStatus .status-text');
        const indicator = document.querySelector('#connectionStatus .status-indicator');
        
        if (statusText) statusText.textContent = text;
        
        if (indicator) {
            indicator.className = `status-indicator ${this.connectionStatus}`;
        }
    }

    async loadConfig() {
        try {
            this.config = await API.getConfig();
            console.log('📋 系统配置已加载:', this.config);
        } catch (error) {
            console.error('配置加载失败:', error);
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

    async testConnection() {
        try {
            this.updateConnectionStatus('检查连接...');
            const health = await API.healthCheck();
            
            if (health.status === 'healthy') {
                this.connectionStatus = 'connected';
                this.updateConnectionStatus('连接正常');
                console.log('✅ API连接正常');
            } else {
                this.connectionStatus = 'warning';
                this.updateConnectionStatus('连接不稳定');
                console.warn('⚠️ API连接不稳定');
            }
        } catch (error) {
            this.connectionStatus = 'error';
            this.updateConnectionStatus('连接失败');
            console.error('❌ API连接失败:', error);
        }
    }

    handleURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q');
        
        if (searchQuery) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = searchQuery;
                // 自动执行搜索
                setTimeout(() => {
                    this.performSearch();
                }, 500);
            }
        }
    }

    bindEvents() {
        // 搜索相关
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) searchBtn.addEventListener('click', () => this.performSearch());
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.performSearch();
            });
            
            // 搜索建议
            searchInput.addEventListener('input', debounce((e) => {
                this.handleSearchInput(e.target.value);
            }, 300));
            
            // 焦点处理
            searchInput.addEventListener('focus', () => {
                this.showSearchSuggestions();
            });
            
            searchInput.addEventListener('blur', () => {
                // 延迟隐藏以允许点击建议
                setTimeout(() => this.hideSearchSuggestions(), 200);
            });
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

        // 收藏夹搜索和排序
        this.bindFavoritesControls();
    }

    bindFunctionButtons() {
        const buttons = {
            clearHistoryBtn: () => this.clearHistory(),
            clearResultsBtn: () => this.clearResults(),
            syncFavoritesBtn: () => this.syncFavorites(),
            exportResultsBtn: () => this.exportResults(),
            importFavoritesBtn: () => this.importFavorites()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        });
    }

    bindModalEvents() {
        const loginBtn = document.getElementById('loginBtn');
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
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModals();
            });
        });
		
		// 在bindModalEvents方法中添加
const dashboardLink = document.querySelector('a[href="./dashboard.html"]');
if (dashboardLink) {
    dashboardLink.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToDashboard();
    });
}

        // 表单提交
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (loginForm) loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        if (registerForm) registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

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
                this.hideSearchSuggestions();
            }
        });
    }

    bindFavoritesControls() {
        // 这里可以添加收藏夹的搜索和排序控件绑定
        // 目前在首页主要是显示，详细控制在dashboard页面
    }

    async performSearch() {
        const searchInput = document.getElementById('searchInput');
        const keyword = searchInput?.value.trim();
        
        if (!keyword) {
            showToast('请输入搜索关键词', 'error');
            searchInput?.focus();
            return;
        }

        // 验证关键词
        if (keyword.length > 100) {
            showToast('搜索关键词过长', 'error');
            return;
        }

        if (keyword.length < 2) {
            showToast('搜索关键词至少2个字符', 'error');
            return;
        }

        try {
            showLoading(true);
            
            // 隐藏提示区域
            this.hideQuickTips();

            // 添加到搜索历史
            this.addToHistory(keyword);

            // 执行搜索
            const results = await this.searchKeyword(keyword);
            
            // 显示搜索结果
            this.displaySearchResults(keyword, results);

            // 记录搜索行为
            this.recordSearchAction(keyword, results);

            // 自动同步（如果用户已登录且开启）
            if (this.currentUser && document.getElementById('autoSync')?.checked) {
                this.syncSearchHistory().catch(console.error);
            }

        } catch (error) {
            console.error('搜索失败:', error);
            showToast(`搜索失败: ${error.message}`, 'error');
        } finally {
            showLoading(false);
        }
    }

    hideQuickTips() {
        const quickTips = document.getElementById('quickTips');
        if (quickTips) {
            quickTips.style.display = 'none';
        }
    }

async searchKeyword(keyword) {
    const cacheResults = document.getElementById('cacheResults')?.checked;
    
    // 检查缓存
    if (cacheResults) {
        const cached = this.getCachedResults(keyword);
        if (cached) {
            showToast('使用缓存结果', 'info', 2000);
            return cached;
        }
    }

    // 构建搜索源
    const sources = this.buildSearchSources(keyword);

    // 直接使用基础搜索，移除增强搜索逻辑
    if (cacheResults) {
        this.cacheResults(keyword, sources);
    }

    return sources;
}


    buildSearchSources(keyword) {
        const encodedKeyword = encodeURIComponent(keyword);
        const timestamp = Date.now();
        
        return [
            {
                id: `result_${keyword}_javbus_${timestamp}`,
                title: 'JavBus',
                subtitle: '番号+磁力一体站，信息完善',
                url: `https://www.javbus.com/search/${encodedKeyword}`,
                icon: '🎬',
                keyword: keyword,
                timestamp: timestamp,
                source: 'javbus'
            },
            {
                id: `result_${keyword}_javdb_${timestamp}`,
                title: 'JavDB',
                subtitle: '极简风格番号资料站，轻量快速',
                url: `https://javdb.com/search?q=${encodedKeyword}&f=all`,
                icon: '📚',
                keyword: keyword,
                timestamp: timestamp,
                source: 'javdb'
            },
            {
                id: `result_${keyword}_javlibrary_${timestamp}`,
                title: 'JavLibrary',
                subtitle: '评论活跃，女优搜索详尽',
                url: `https://www.javlibrary.com/cn/vl_searchbyid.php?keyword=${encodedKeyword}`,
                icon: '📖',
                keyword: keyword,
                timestamp: timestamp,
                source: 'javlibrary'
            },
            {
                id: `result_${keyword}_av01_${timestamp}`,
                title: 'AV01',
                subtitle: '快速预览站点，封面大图清晰',
                url: `https://av01.tv/search?keyword=${encodedKeyword}`,
                icon: '🎥',
                keyword: keyword,
                timestamp: timestamp,
                source: 'av01'
            },
            {
                id: `result_${keyword}_missav_${timestamp}`,
                title: 'MissAV',
                subtitle: '中文界面，封面高清，信息丰富',
                url: `https://missav.com/search/${encodedKeyword}`,
                icon: '💫',
                keyword: keyword,
                timestamp: timestamp,
                source: 'missav'
            },
            {
                id: `result_${keyword}_btsow_${timestamp}`,
                title: 'btsow',
                subtitle: '中文磁力搜索引擎，番号资源丰富',
                url: `https://btsow.com/search/${encodedKeyword}`,
                icon: '🧲',
                keyword: keyword,
                timestamp: timestamp,
                source: 'btsow'
            }
        ];
    }

    displaySearchResults(keyword, results) {
        const resultsSection = document.getElementById('resultsSection');
        const searchInfo = document.getElementById('searchInfo');
        const resultsContainer = document.getElementById('results');
        const clearResultsBtn = document.getElementById('clearResultsBtn');
        const exportResultsBtn = document.getElementById('exportResultsBtn');

        if (resultsSection) resultsSection.style.display = 'block';
        if (searchInfo) {
            searchInfo.innerHTML = `
                搜索关键词: <strong>${this.escapeHtml(keyword)}</strong> 
                (${results.length}个结果) 
                <small>${new Date().toLocaleString()}</small>
            `;
        }
        if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
        if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

        if (resultsContainer) {
            resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
        }

        this.currentSearchResults = results;
        this.updateFavoriteButtons();
        
        // 滚动到结果区域
        setTimeout(() => {
            resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

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
                    <div class="result-url" title="${this.escapeHtml(result.url)}">
                        ${this.truncateUrl(result.url)}
                    </div>
                    <div class="result-meta">
                        <span class="result-source">${result.source}</span>
                        <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button class="action-btn visit-btn" onclick="app.openResult('${this.escapeHtml(result.url)}', '${result.source}')" title="访问网站">
                        <span>访问</span>
                    </button>
                    <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                            onclick="app.toggleFavorite('${result.id}')" 
                            title="${isFavorited ? '取消收藏' : '添加收藏'}">
                        <span>${isFavorited ? '已收藏' : '收藏'}</span>
                    </button>
                    <button class="action-btn copy-btn" onclick="app.copyToClipboard('${this.escapeHtml(result.url)}')" title="复制链接">
                        <span>复制</span>
                    </button>
                </div>
            </div>
        `;
    }

    truncateUrl(url) {
        if (url.length <= 50) return url;
        const urlObj = new URL(url);
        return `${urlObj.hostname}${urlObj.pathname.length > 20 ? urlObj.pathname.substr(0, 20) + '...' : urlObj.pathname}`;
    }

    // 打开搜索结果
    openResult(url, source) {
        try {
            // 记录访问行为
            if (typeof API !== 'undefined') {
                API.recordAction('visit_site', { url, source }).catch(console.error);
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
    // 修改收藏操作 - 直接与API交互
    async toggleFavorite(resultId) {
        if (!this.currentUser) {
            showToast('请先登录后再收藏', 'error');
            return;
        }

        const result = this.currentSearchResults.find(r => r.id === resultId);
        if (!result) return;

        const existingIndex = this.favorites.findIndex(fav => fav.url === result.url);
        
        try {
            showLoading(true);

            if (existingIndex >= 0) {
                // 移除收藏 - 从云端删除
                const favoriteToRemove = this.favorites[existingIndex];
                
                // 先从本地移除以立即更新UI
                this.favorites.splice(existingIndex, 1);
                this.renderFavorites();
                this.updateFavoriteButtons();
                
                // 重新同步到云端
                await API.syncFavorites(this.favorites);
                showToast('已移除收藏', 'success');
                
            } else {
                // 添加收藏
                const maxFavorites = this.config.maxFavoritesPerUser || 1000;
                if (this.favorites.length >= maxFavorites) {
                    showToast(`收藏数量已达上限 (${maxFavorites})`, 'error');
                    return;
                }
                
                const favorite = {
                    id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    title: result.title,
                    subtitle: result.subtitle,
                    url: result.url,
                    icon: result.icon,
                    keyword: result.keyword,
                    addedAt: new Date().toISOString()
                };
                
                // 先添加到本地以立即更新UI
                this.favorites.unshift(favorite);
                this.renderFavorites();
                this.updateFavoriteButtons();
                
                // 同步到云端
                await API.syncFavorites(this.favorites);
                showToast('已添加收藏', 'success');
            }

        } catch (error) {
            console.error('收藏操作失败:', error);
            showToast('收藏操作失败: ' + error.message, 'error');
            
            // 操作失败，重新从云端加载数据以恢复状态
            await this.loadCloudData();
        } finally {
            showLoading(false);
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
                btn.querySelector('span').textContent = isFavorited ? '已收藏' : '收藏';
                btn.classList.toggle('favorited', isFavorited);
            }
        });
    }

// 修复添加搜索历史方法
    // 修改添加搜索历史 - 直接调用API
    async addToHistory(keyword) {
        if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
            console.warn('无效的搜索关键词，跳过添加到历史');
            return;
        }

        if (!this.currentUser) {
            console.log('用户未登录，无法保存搜索历史');
            return;
        }

        const trimmedKeyword = keyword.trim();
        
        try {
            // 直接调用API保存
            await API.saveSearchHistory(trimmedKeyword, 'manual');
            
            // 本地添加以立即更新UI（避免重复查询）
            this.searchHistory = this.searchHistory.filter(item => 
                item && item.keyword && item.keyword !== trimmedKeyword
            );
            
            this.searchHistory.unshift({
                id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                keyword: trimmedKeyword,
                query: trimmedKeyword,
                timestamp: Date.now(),
                count: 1,
                source: 'manual'
            });

            // 限制数量
            const maxHistory = this.config.maxHistoryPerUser || 1000;
            if (this.searchHistory.length > maxHistory) {
                this.searchHistory = this.searchHistory.slice(0, maxHistory);
            }

            this.renderHistory();
            
        } catch (error) {
            console.error('保存搜索历史失败:', error);
            // 云端保存失败，仍然可以在当前会话中显示
            showToast('保存搜索历史失败', 'warning');
        }
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
    // 修改移除收藏 - 直接与API交互
    async removeFavorite(favoriteId) {
        if (!this.currentUser) {
            showToast('用户未登录', 'error');
            return;
        }

        if (!confirm('确定要移除这个收藏吗？')) return;
        
        const index = this.favorites.findIndex(fav => fav.id === favoriteId);
        if (index >= 0) {
            try {
                showLoading(true);
                
                // 先从本地移除
                this.favorites.splice(index, 1);
                this.renderFavorites();
                this.updateFavoriteButtons();
                
                // 同步到云端
                await API.syncFavorites(this.favorites);
                showToast('已移除收藏', 'success');
                
            } catch (error) {
                console.error('移除收藏失败:', error);
                showToast('移除收藏失败: ' + error.message, 'error');
                
                // 重新加载云端数据以恢复状态
                await this.loadCloudData();
            } finally {
                showLoading(false);
            }
        }
    }

    // 清除搜索历史
    // 修改清除历史 - 直接调用API
    async clearHistory() {
        if (!this.currentUser) {
            showToast('用户未登录', 'error');
            return;
        }

        if (!confirm('确定要清除所有搜索历史吗？')) return;
        
        try {
            showLoading(true);
            
            // 调用API清除
            await API.clearAllSearchHistory();
            
            // 清空本地数据并更新UI
            this.searchHistory = [];
            this.renderHistory();
            
            showToast('搜索历史已清除', 'success');
            
        } catch (error) {
            console.error('清除搜索历史失败:', error);
            showToast('清除失败: ' + error.message, 'error');
        } finally {
            showLoading(false);
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
        showToast('搜索结果已清除', 'success');
    }

    // 导出搜索结果
    async exportResults() {
        if (this.currentSearchResults.length === 0) {
            showToast('没有搜索结果可以导出', 'error');
            return;
        }

        try {
            const data = {
                results: this.currentSearchResults,
                exportTime: new Date().toISOString(),
                version: window.API_CONFIG?.APP_VERSION || '1.0.0'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `search-results-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('搜索结果导出成功', 'success');
        } catch (error) {
            console.error('导出搜索结果失败:', error);
            showToast('导出失败: ' + error.message, 'error');
        }
    }

    // 导入收藏夹
    async importFavorites() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (data.favorites && Array.isArray(data.favorites)) {
                    // 合并收藏，避免重复
                    const existingUrls = new Set(this.favorites.map(fav => fav.url));
                    const newFavorites = data.favorites.filter(fav => !existingUrls.has(fav.url));
                    
                    if (newFavorites.length > 0) {
                        this.favorites.push(...newFavorites);
                        this.renderFavorites();
                        showToast(`成功导入${newFavorites.length}个收藏`, 'success');
                        
                        // 同步到云端
                        if (this.currentUser) {
                            await this.syncFavorites();
                        }
                    } else {
                        showToast('没有新的收藏需要导入', 'info');
                    }
                } else {
                    throw new Error('文件格式不正确');
                }
            } catch (error) {
                console.error('导入收藏失败:', error);
                showToast('导入失败: ' + error.message, 'error');
            }
        };
        
        input.click();
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
        // 禁用本地缓存，始终进行新搜索
        return null;
    }

    cacheResults(keyword, results) {
        // 禁用本地缓存
        return;
    }

    // 移除 loadLocalData 方法，替换为纯云端加载
    async loadCloudData() {
        if (!this.currentUser) {
            console.log('用户未登录，无法加载云端数据');
            this.searchHistory = [];
            this.favorites = [];
            this.renderHistory();
            this.renderFavorites();
            return;
        }

        try {
            showLoading(true);
            console.log('📡 加载云端数据...');
            
            // 并行加载收藏夹和搜索历史
            const [favoritesResult, historyResult] = await Promise.allSettled([
                API.getFavorites(),
                API.getSearchHistory()
            ]);

            // 处理收藏夹数据
            if (favoritesResult.status === 'fulfilled') {
                this.favorites = favoritesResult.value || [];
            } else {
                console.error('加载收藏夹失败:', favoritesResult.reason);
                this.favorites = [];
            }

            // 处理搜索历史数据
            if (historyResult.status === 'fulfilled') {
                const cloudHistory = historyResult.value || [];
                this.searchHistory = cloudHistory.map(item => ({
                    id: item.id || `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    keyword: item.keyword || item.query,
                    query: item.query || item.keyword,
                    source: item.source || 'unknown',
                    timestamp: item.timestamp || item.createdAt || Date.now(),
                    count: item.count || 1
                })).filter(item => {
                    return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
                });
            } else {
                console.error('加载搜索历史失败:', historyResult.reason);
                this.searchHistory = [];
            }
            
            // 渲染界面
            this.renderHistory();
            this.renderFavorites();
            
            console.log(`✅ 云端数据加载完成: ${this.searchHistory.length}条历史, ${this.favorites.length}个收藏`);
            
        } catch (error) {
            console.error('加载云端数据失败:', error);
            showToast('加载数据失败，请重试', 'error');
            this.searchHistory = [];
            this.favorites = [];
            this.renderHistory();
            this.renderFavorites();
        } finally {
            showLoading(false);
        }
    }



    // 主题管理
    // 移除本地存储相关方法，保留主题设置
    initTheme() {
		window.themeManager.applyTheme();

    }

    toggleTheme() {
		window.themeManager.toggleTheme();

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

// 修复搜索历史同步方法
async syncSearchHistory() {
    if (!this.currentUser) return;

    try {
        // 过滤有效的搜索历史
        const validHistory = this.searchHistory.filter(item => {
            return item && item.keyword && 
                   typeof item.keyword === 'string' && 
                   item.keyword.trim().length > 0;
        });

        await API.syncSearchHistory(validHistory);
        console.log('搜索历史同步成功');
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
   // 修改登录成功后的处理
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
                
                // 显示主内容区域
                document.querySelector('.main-content').style.display = 'block';
                
                // 关闭模态框
                this.closeModals();
                
                showToast(`欢迎回来，${result.user.username}！`, 'success');
                
                // 登录后立即加载云端数据
                await this.loadCloudData();
                
                // 处理URL参数（如搜索查询）
                this.handleURLParams();
                
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
		
		    // 添加防止重复提交机制
    const submitBtn = event.target.querySelector('button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
        submitBtn.disabled = true;
// 正确代码
submitBtn.classList.add('submitting');
const span = document.createElement('span');
span.textContent = '注册中...';
submitBtn.innerHTML = '';
submitBtn.appendChild(span);
    }
        
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
        // 重置按钮状态
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('submitting');
            submitBtn.textContent = '注册';
        }
    }
    }

    // 检查认证状态
    async checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.log('未找到认证token');
            return;
        }

        try {
            const result = await API.verifyToken(token);
            if (result.success && result.user) {
                this.currentUser = result.user;
                this.updateUserUI();
                await this.loadCloudData();
                console.log('✅ 用户认证成功:', this.currentUser.username);
            } else {
                localStorage.removeItem('auth_token');
                console.log('Token验证失败，已清除');
            }
        } catch (error) {
            console.error('验证token失败:', error);
            localStorage.removeItem('auth_token');
        }
    }

    checkConnectionStatus() {
        if (this.isInitialized) {
            this.testConnection();
        }
    }

    recordSearchAction(keyword, results) {
        // 记录到API（如果连接正常且用户已登录）
        if (this.currentUser && this.connectionStatus === 'connected') {
            API.recordAction('search', { 
                keyword, 
                resultCount: results.length,
                timestamp: Date.now() 
            }).catch(console.error);
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

    // 修改退出登录处理
    async logout() {
        try {
            await API.logout();
        } catch (error) {
            console.error('退出登录请求失败:', error);
        } finally {
            this.currentUser = null;
            localStorage.removeItem('auth_token');
            
            // 清空所有数据
            this.searchHistory = [];
            this.favorites = [];
            this.currentSearchResults = [];
            
            // 更新UI
            this.updateUserUI();
            this.renderHistory();
            this.renderFavorites();
            this.clearResults();
            
            showToast('已退出登录', 'success');
            
            // 显示登录模态框
            this.showLoginModal();
            
            // 隐藏主界面
            document.querySelector('.main-content').style.display = 'none';
            this.hideSearchSuggestions();
        }
    }

// 修复加载云端数据方法中的搜索历史部分
async loadCloudData() {
    if (!this.currentUser) return;

    try {
        // 加载云端收藏夹
        const cloudFavorites = await API.getFavorites();
        if (cloudFavorites && cloudFavorites.length > 0) {
            this.favorites = cloudFavorites;
            this.renderFavorites();
        }

        // 加载云端搜索历史 - 统一数据格式
        const cloudHistory = await API.getSearchHistory();
        if (cloudHistory && cloudHistory.length > 0) {
            // 统一字段名处理
            const normalizedHistory = cloudHistory.map(item => ({
                id: item.id || `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                keyword: item.keyword || item.query, // 统一使用 keyword
                query: item.query || item.keyword,   // 保持 query 兼容性
                source: item.source || 'unknown',
                timestamp: item.timestamp || item.createdAt || Date.now(),
                count: item.count || 1
            })).filter(item => {
                // 过滤无效数据
                return item.keyword && typeof item.keyword === 'string' && item.keyword.trim().length > 0;
            });

            // 合并本地和云端历史，去重
            const mergedHistory = [...normalizedHistory];
            this.searchHistory.forEach(localItem => {
                if (localItem && localItem.keyword && 
                    !mergedHistory.some(cloudItem => cloudItem.keyword === localItem.keyword)) {
                    mergedHistory.push({
                        ...localItem,
                        keyword: localItem.keyword || localItem.query,
                        query: localItem.query || localItem.keyword
                    });
                }
            });
            
            // 排序并限制数量
            this.searchHistory = mergedHistory
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, this.config.maxHistoryPerUser || 1000);
            
            this.renderHistory();
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

// 修复搜索建议显示方法
    // 修改搜索建议显示 - 基于云端数据
    showSearchSuggestions(query) {
        if (!query || typeof query !== 'string') return;
        
        const suggestions = this.searchHistory
            .filter(item => {
                if (!item) return false;
                
                const searchTerm = item.keyword || item.query;
                if (!searchTerm || typeof searchTerm !== 'string') {
                    return false;
                }
                
                return searchTerm.toLowerCase().includes(query.toLowerCase());
            })
            .slice(0, 5);
        
        this.renderSearchSuggestions(suggestions);
    }

// 新增搜索建议渲染方法
renderSearchSuggestions(suggestions) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    // 如果容器不存在，创建一个
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.id = 'searchSuggestions';
        suggestionsContainer.className = 'search-suggestions';
        
        const searchInput = document.getElementById('searchInput');
        if (searchInput && searchInput.parentNode) {
            searchInput.parentNode.appendChild(suggestionsContainer);
        }
    }
    
    if (suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    suggestionsContainer.innerHTML = suggestions.map(item => {
        const displayText = item.keyword || item.query;
        return `
            <div class="suggestion-item" onclick="app.searchFromHistory('${this.escapeHtml(displayText)}')">
                <span class="suggestion-icon">🕐</span>
                <span class="suggestion-text">${this.escapeHtml(displayText)}</span>
            </div>
        `;
    }).join('');
    
    suggestionsContainer.style.display = 'block';
}

    // 隐藏搜索建议
    hideSearchSuggestions() {
        // 隐藏搜索建议下拉框
    }

    // 工具方法
    escapeHtml(text) {
        if (!text) return '';
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// 修改工具函数和初始化代码保持不变
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
    console.log('🚀 初始化Magnet Search应用（纯云端模式）...');
    app = new MagnetSearchApp();
});


// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    if (window.app && window.app.connectionStatus !== 'error') {
        showToast('应用出现错误，请刷新页面重试', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    if (event.reason && event.reason.message && event.reason.message.includes('认证失败')) {
        if (window.app && window.app.currentUser) {
            window.app.logout();
        }
    }
});

// 导出到全局作用域
window.MagnetSearchApp = MagnetSearchApp;
