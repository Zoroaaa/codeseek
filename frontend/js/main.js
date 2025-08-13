// 主应用逻辑 - 完整版本
(function() {
    'use strict';

    class MagnetSearchApp {
        constructor() {
            this.currentUser = null;
            this.searchHistory = [];
            this.favorites = [];
            this.currentSearchResults = [];
            this.isInitialized = false;
            this.config = {};
            this.connectionStatus = 'checking';
            this.searchTimeout = null;
            this.init();
            this.setupAuthStateListener();
        }

        async init() {
            console.log('🚀 磁力搜索应用初始化...');
            
            try {
                // 加载配置
                await this.loadConfig();
                
                // 检查认证状态
                const user = authManager.getCurrentUser();
                if (user) {
                    this.currentUser = user;
                    console.log(`👤 当前用户: ${user.username} (ID: ${user.id})`);
                }
                
                // 初始化UI
                this.initializeUI();
                
                // 加载本地数据
                this.loadLocalData();
                
                // 如果用户已登录，加载云端数据
                if (this.currentUser) {
                    await this.loadCloudData();
                }
                
                // 检查连接状态
                this.checkConnection();
                
                this.isInitialized = true;
                console.log('✅ 应用初始化完成');
                
            } catch (error) {
                console.error('❌ 应用初始化失败:', error);
                showToast('应用初始化失败: ' + error.message, 'error');
            }
        }

        // 加载配置
        async loadConfig() {
            try {
                const config = await API.getConfig();
                this.config = {
                    maxFavoritesPerUser: 1000,
                    maxHistoryPerUser: 1000,
                    allowRegistration: true,
                    showSyncErrors: false,
                    ...config
                };
                console.log('📋 配置已加载:', this.config);
            } catch (error) {
                console.warn('⚠️ 加载配置失败，使用默认配置:', error);
                this.config = {
                    maxFavoritesPerUser: 1000,
                    maxHistoryPerUser: 1000,
                    allowRegistration: true,
                    showSyncErrors: false
                };
            }
        }

        // 设置认证状态监听
        setupAuthStateListener() {
            authManager.onAuthStateChanged((event) => {
                const { type, user } = event.detail;
                
                if (type === 'login') {
                    this.handleUserLogin(user);
                } else if (type === 'logout') {
                    this.handleUserLogout();
                }
            });
        }

        // 处理用户登录
        async handleUserLogin(user) {
            console.log(`👤 用户登录: ${user.username} (ID: ${user.id})`);
            
            // 检查是否需要数据迁移
            const migrationResult = await UserDataManager.migrateUserData(user.id);
            if (migrationResult) {
                showToast('检测到旧版数据，已自动迁移', 'info');
            }

            // 数据完整性检查
            const validation = UserDataManager.validateUserData(user.id);
            if (!validation.valid) {
                console.warn('用户数据存在问题:', validation.errors);
                // 尝试修复
                const fixed = await UserDataManager.fixUserData(user.id);
                if (fixed) {
                    showToast('用户数据已修复', 'success');
                }
            }

            // 切换到新用户的数据
            await this.handleUserSwitch(user);
            
            // 显示主内容
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
            
            // 关闭登录模态框
            this.closeModals();
        }

        // 处理用户退出
        handleUserLogout() {
            console.log('👤 用户退出登录');
            
            // 清空当前数据
            this.currentUser = null;
            this.searchHistory = [];
            this.favorites = [];
            this.currentSearchResults = [];
            
            // 清空显示
            this.renderHistory();
            this.renderFavorites();
            this.clearResults();
            
            // 隐藏主内容，显示登录模态框
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.display = 'none';
            }
            
            setTimeout(() => {
                this.showLoginModal();
            }, 100);
        }

        // 处理用户切换
        async handleUserSwitch(user) {
            this.currentUser = user;
            
            // 加载新用户的本地数据
            this.loadLocalData();
            
            // 加载云端数据
            await this.loadCloudData();
            
            // 更新UI
            this.updateUserUI();
        }

        // 初始化UI
        initializeUI() {
            this.bindEventListeners();
            this.setupSearchInput();
            this.renderHistory();
            this.renderFavorites();
            this.updateConnectionStatus();
        }

        // 绑定事件监听器
        bindEventListeners() {
            // 搜索表单
            const searchForm = document.getElementById('searchForm');
            if (searchForm) {
                searchForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.performSearch();
                });
            }

            // 搜索输入框
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', debounce(() => {
                    this.showSearchSuggestions();
                }, 300));
                
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.performSearch();
                    }
                });
            }

            // 登录/注册模态框
            this.setupModalEventListeners();
            
            // 全局键盘快捷键
            this.setupKeyboardShortcuts();

            // 页面可见性变化
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.currentUser) {
                    // 页面重新可见时，检查认证状态
                    this.checkAuthStatus();
                }
            });
        }

        // 设置搜索输入框
        setupSearchInput() {
            const searchInput = document.getElementById('searchInput');
            if (!searchInput) return;

            // 从URL参数获取搜索词
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('q');
            if (query) {
                searchInput.value = query;
                this.performSearch();
            }
        }

        // 设置模态框事件监听器
        setupModalEventListeners() {
            // 登录模态框
            const loginModal = document.getElementById('loginModal');
            const registerModal = document.getElementById('registerModal');
            
            if (loginModal) {
                loginModal.addEventListener('click', (e) => {
                    if (e.target === loginModal) {
                        this.closeModals();
                    }
                });
            }

            if (registerModal) {
                registerModal.addEventListener('click', (e) => {
                    if (e.target === registerModal) {
                        this.closeModals();
                    }
                });
            }

            // 登录表单
            const loginForm = document.getElementById('loginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.handleLogin();
                });
            }

            // 注册表单
            const registerForm = document.getElementById('registerForm');
            if (registerForm) {
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await this.handleRegister();
                });
            }

            // 切换登录/注册
            const showRegisterLink = document.getElementById('showRegister');
            const showLoginLink = document.getElementById('showLogin');
            
            if (showRegisterLink) {
                showRegisterLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showRegisterModal();
                });
            }

            if (showLoginLink) {
                showLoginLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.showLoginModal();
                });
            }
        }

        // 设置键盘快捷键
        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + K: 聚焦搜索框
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) {
                        searchInput.focus();
                        searchInput.select();
                    }
                }

                // Esc: 关闭模态框
                if (e.key === 'Escape') {
                    this.closeModals();
                }
            });
        }

        // 执行搜索
        async performSearch() {
            const searchInput = document.getElementById('searchInput');
            if (!searchInput) return;

            const query = searchInput.value.trim();
            if (!query) {
                showToast('请输入搜索关键词', 'warning');
                return;
            }

            console.log(`🔍 搜索: ${query}`);

            try {
                showLoading(true, '搜索中...');
                
                // 添加到搜索历史
                this.addToHistory(query);
                
                // 执行搜索
                const response = await API.search(query, {
                    page: 1,
                    size: 20
                });

                if (response.success && response.results) {
                    this.currentSearchResults = response.results.map(result => ({
                        ...result,
                        keyword: query,
                        id: result.id || generateId('result_')
                    }));
                    
                    this.renderSearchResults();
                    console.log(`✅ 找到 ${this.currentSearchResults.length} 个结果`);
                } else {
                    throw new Error(response.message || '搜索失败');
                }

            } catch (error) {
                console.error('搜索失败:', error);
                showToast('搜索失败: ' + error.message, 'error');
                this.clearResults();
            } finally {
                showLoading(false);
            }
        }

        // 添加到搜索历史
        addToHistory(keyword) {
            if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
                console.warn('无效的搜索关键词，跳过添加到历史');
                return;
            }

            if (!this.currentUser || !this.currentUser.id) {
                console.warn('用户未登录，跳过添加搜索历史');
                return;
            }

            const trimmedKeyword = keyword.trim();
            
            // 移除重复项（本地）
            this.searchHistory = this.searchHistory.filter(item => {
                return item && item.keyword && item.keyword !== trimmedKeyword;
            });
            
            // 添加到开头
            const historyItem = {
                id: generateId('history_'),
                keyword: trimmedKeyword,
                query: trimmedKeyword,
                timestamp: Date.now(),
                count: 1,
                source: 'manual'
            };

            this.searchHistory.unshift(historyItem);

            // 限制历史记录数量
            const maxHistory = this.config.maxHistoryPerUser || 1000;
            if (this.searchHistory.length > maxHistory) {
                this.searchHistory = this.searchHistory.slice(0, maxHistory);
            }

            this.saveHistory();
            this.renderHistory();

            // 保存到云端（异步，不阻塞用户操作）
            if (this.currentUser) {
                API.saveSearchHistory(trimmedKeyword, 'manual').catch(error => {
                    console.error('保存搜索历史到云端失败:', error);
                    if (this.config.showSyncErrors) {
                        showToast('搜索历史同步失败，但已保存到本地', 'warning', 2000);
                    }
                });
            }
        }

        // 渲染搜索结果
        renderSearchResults() {
            const resultsContainer = document.getElementById('searchResults');
            if (!resultsContainer) return;

            if (!this.currentSearchResults || this.currentSearchResults.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="no-results">
                        <span style="font-size: 3rem;">🔍</span>
                        <h3>未找到相关结果</h3>
                        <p>尝试使用不同的关键词</p>
                    </div>
                `;
                return;
            }

            resultsContainer.innerHTML = this.currentSearchResults.map(result => `
                <div class="result-item" data-id="${result.id}">
                    <div class="result-header">
                        <span class="result-icon">${result.icon}</span>
                        <h3 class="result-title">${escapeHtml(result.title)}</h3>
                        <div class="result-actions">
                            <button class="action-btn favorite-btn ${this.isFavorited(result.url) ? 'favorited' : ''}" 
                                    onclick="app.toggleFavorite('${result.id}')"
                                    title="${this.isFavorited(result.url) ? '取消收藏' : '添加收藏'}">
                                ${this.isFavorited(result.url) ? '❤️' : '🤍'}
                            </button>
                        </div>
                    </div>
                    <p class="result-subtitle">${escapeHtml(result.subtitle)}</p>
                    <div class="result-meta">
                        <span class="meta-item">📊 ${result.size}</span>
                        <span class="meta-item">🌱 ${result.seeders}</span>
                        <span class="meta-item">📥 ${result.leechers}</span>
                        <span class="meta-item">📅 ${formatRelativeTime(result.date)}</span>
                    </div>
                    <div class="result-actions-bar">
                        <button class="action-btn download-btn" onclick="app.downloadMagnet('${result.url}', '${escapeHtml(result.title)}')">
                            下载
                        </button>
                        <button class="action-btn copy-btn" onclick="app.copyMagnetLink('${result.url}')">
                            复制链接
                        </button>
                        <span class="result-source">来源: ${result.source}</span>
                    </div>
                </div>
            `).join('');

            // 滚动到结果区域
            resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // 清空搜索结果
        clearResults() {
            const resultsContainer = document.getElementById('searchResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
            }
            this.currentSearchResults = [];
        }

        // 收藏切换
        async toggleFavorite(resultId) {
            if (!this.currentUser || !this.currentUser.id) {
                showToast('请先登录再收藏', 'error');
                this.showLoginModal();
                return;
            }

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
                        id: generateId('fav_'),
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

                // 异步同步到云端
                this.syncFavorites().catch(error => {
                    console.error('收藏同步失败:', error);
                    if (this.config.showSyncErrors) {
                        showToast('收藏同步失败，但已保存到本地', 'warning', 2000);
                    }
                });

            } catch (error) {
                console.error('收藏操作失败:', error);
                showToast('收藏操作失败', 'error');
            }
        }

        // 检查是否已收藏
        isFavorited(url) {
            return this.favorites.some(fav => fav.url === url);
        }

        // 更新收藏按钮状态
        updateFavoriteButtons() {
            const buttons = document.querySelectorAll('.favorite-btn');
            buttons.forEach(btn => {
                const resultItem = btn.closest('.result-item');
                if (resultItem) {
                    const resultId = resultItem.dataset.id;
                    const result = this.currentSearchResults.find(r => r.id === resultId);
                    if (result) {
                        const favorited = this.isFavorited(result.url);
                        btn.textContent = favorited ? '❤️' : '🤍';
                        btn.className = `action-btn favorite-btn ${favorited ? 'favorited' : ''}`;
                        btn.title = favorited ? '取消收藏' : '添加收藏';
                    }
                }
            });
        }

        // 下载磁力链接
        async downloadMagnet(magnetUrl, title) {
            try {
                if (!Validator.magnetLink(magnetUrl)) {
                    showToast('无效的磁力链接', 'error');
                    return;
                }

                // 尝试直接打开磁力链接
                const link = document.createElement('a');
                link.href = magnetUrl;
                link.click();

                showToast('已尝试调用下载工具', 'success');
                
                // 记录下载行为
                if (this.currentUser) {
                    API.recordAction('download', {
                        title: title,
                        magnetUrl: magnetUrl
                    }).catch(error => {
                        console.error('记录下载行为失败:', error);
                    });
                }

            } catch (error) {
                console.error('下载失败:', error);
                showToast('下载失败: ' + error.message, 'error');
            }
        }

        // 复制磁力链接
        async copyMagnetLink(magnetUrl) {
            try {
                const success = await copyToClipboard(magnetUrl);
                if (success) {
                    showToast('磁力链接已复制到剪贴板', 'success');
                } else {
                    throw new Error('复制失败');
                }
            } catch (error) {
                console.error('复制链接失败:', error);
                showToast('复制失败: ' + error.message, 'error');
            }
        }

        // 显示搜索建议
        showSearchSuggestions() {
            const searchInput = document.getElementById('searchInput');
            if (!searchInput) return;

            const query = searchInput.value.trim();
            if (!query || query.length < 2) {
                this.hideSuggestions();
                return;
            }

            // 从搜索历史中查找匹配的建议
            const suggestions = this.searchHistory
                .filter(item => item.keyword.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 5)
                .map(item => item.keyword);

            this.renderSuggestions(suggestions, query);
        }

        // 渲染搜索建议
        renderSuggestions(suggestions, query) {
            let suggestionContainer = document.getElementById('searchSuggestions');
            
            if (!suggestionContainer) {
                suggestionContainer = document.createElement('div');
                suggestionContainer.id = 'searchSuggestions';
                suggestionContainer.className = 'search-suggestions';
                
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.parentNode) {
                    searchInput.parentNode.appendChild(suggestionContainer);
                }
            }

            if (suggestions.length === 0) {
                this.hideSuggestions();
                return;
            }

            suggestionContainer.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-item" onclick="app.selectSuggestion('${escapeHtml(suggestion)}')">
                    ${escapeHtml(suggestion)}
                </div>
            `).join('');

            suggestionContainer.style.display = 'block';
        }

        // 选择建议
        selectSuggestion(suggestion) {
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = suggestion;
                this.hideSuggestions();
                this.performSearch();
            }
        }

        // 隐藏建议
        hideSuggestions() {
            const suggestionContainer = document.getElementById('searchSuggestions');
            if (suggestionContainer) {
                suggestionContainer.style.display = 'none';
            }
        }

        // 加载本地数据
        loadLocalData() {
            try {
                this.searchHistory = UserIsolatedStorageManager.getItem('search_history', []);
                this.renderHistory();

                this.favorites = UserIsolatedStorageManager.getItem('favorites', []);
                this.renderFavorites();
                
                const userId = this.currentUser?.id || 'anonymous';
                console.log(`📚 用户 ${userId} 的本地数据已加载: ${this.searchHistory.length}条历史, ${this.favorites.length}个收藏`);
            } catch (error) {
                console.error('加载本地数据失败:', error);
                this.searchHistory = [];
                this.favorites = [];
            }
        }

        // 加载云端数据
        async loadCloudData() {
            if (!this.currentUser) return;

            try {
                // 并行加载收藏和搜索历史
                const [cloudFavorites, cloudHistory] = await Promise.allSettled([
                    API.getFavorites(),
                    API.getSearchHistory()
                ]);

                // 处理收藏数据
                if (cloudFavorites.status === 'fulfilled' && cloudFavorites.value) {
                    const favorites = cloudFavorites.value;
                    if (favorites.length > 0) {
                        this.favorites = favorites;
                        this.saveFavorites();
                        this.renderFavorites();
                        console.log(`☁️ 用户 ${this.currentUser.id} 的云端收藏已加载: ${favorites.length}个`);
                    }
                } else if (cloudFavorites.status === 'rejected') {
                    console.warn('加载云端收藏失败:', cloudFavorites.reason);
                }

                // 处理搜索历史数据
                if (cloudHistory.status === 'fulfilled' && cloudHistory.value) {
                    const history = cloudHistory.value;
                    if (history.length > 0) {
                        // 合并本地和云端历史，去重
                        const mergedHistory = this.mergeSearchHistory(this.searchHistory, history);
                        
                        this.searchHistory = mergedHistory
                            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                            .slice(0, this.config.maxHistoryPerUser || 1000);
                        
                        this.saveHistory();
                        this.renderHistory();
                        console.log(`☁️ 用户 ${this.currentUser.id} 的云端历史已加载: ${history.length}条`);
                    }
                } else if (cloudHistory.status === 'rejected') {
                    console.warn('加载云端搜索历史失败:', cloudHistory.reason);
                }

            } catch (error) {
                console.error('加载云端数据失败:', error);
                showToast('加载云端数据失败，使用本地数据', 'warning');
            }
        }

        // 合并搜索历史
        mergeSearchHistory(localHistory, cloudHistory) {
            const merged = [...cloudHistory];
            const cloudKeywords = new Set(cloudHistory.map(item => item.keyword || item.query));
            
            // 添加本地独有的历史记录
            localHistory.forEach(localItem => {
                if (localItem && localItem.keyword && 
                    !cloudKeywords.has(localItem.keyword)) {
                    merged.push(localItem);
                }
            });
            
            return merged;
        }

        // 保存数据
        saveHistory() {
            UserIsolatedStorageManager.setItem('search_history', this.searchHistory);
        }

        saveFavorites() {
            UserIsolatedStorageManager.setItem('favorites', this.favorites);
        }

        // 同步数据到云端
        async syncFavorites() {
            if (!this.currentUser) return;

            try {
                await API.syncFavorites(this.favorites);
                console.log('收藏夹同步成功');
            } catch (error) {
                console.error('收藏夹同步失败:', error);
                throw error;
            }
        }

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
                throw error;
            }
        }

        // 渲染搜索历史
        renderHistory() {
            const historyContainer = document.getElementById('searchHistory');
            if (!historyContainer) return;

            const recentHistory = this.searchHistory.slice(0, 10);

            if (recentHistory.length === 0) {
                historyContainer.innerHTML = '<p class="empty-message">暂无搜索历史</p>';
                return;
            }

            historyContainer.innerHTML = recentHistory.map(item => `
                <div class="history-item" onclick="app.selectSuggestion('${escapeHtml(item.keyword)}')">
                    <span class="history-keyword">${escapeHtml(item.keyword)}</span>
                    <span class="history-time">${formatRelativeTime(item.timestamp)}</span>
                </div>
            `).join('');
        }

        // 渲染收藏列表
        renderFavorites() {
            const favoritesContainer = document.getElementById('favorites');
            if (!favoritesContainer) return;

            const recentFavorites = this.favorites.slice(0, 5);

            if (recentFavorites.length === 0) {
                favoritesContainer.innerHTML = '<p class="empty-message">暂无收藏</p>';
                return;
            }

            favoritesContainer.innerHTML = recentFavorites.map(fav => `
                <div class="favorite-item">
                    <span class="favorite-icon">${fav.icon}</span>
                    <div class="favorite-content">
                        <div class="favorite-title">${escapeHtml(fav.title)}</div>
                        <div class="favorite-time">${formatRelativeTime(fav.addedAt)}</div>
                    </div>
                    <button class="favorite-action" onclick="window.open('${escapeHtml(fav.url)}', '_blank')" title="下载">
                        📥
                    </button>
                </div>
            `).join('');
        }

        // 用户界面更新
        updateUserUI() {
            const userInfo = document.getElementById('userInfo');
            const loginBtn = document.getElementById('loginBtn');
            const logoutBtn = document.getElementById('logoutBtn');

            if (this.currentUser) {
                if (userInfo) {
                    userInfo.textContent = this.currentUser.username;
                    userInfo.style.display = 'inline';
                }
                if (loginBtn) loginBtn.style.display = 'none';
                if (logoutBtn) logoutBtn.style.display = 'inline';
            } else {
                if (userInfo) userInfo.style.display = 'none';
                if (loginBtn) loginBtn.style.display = 'inline';
                if (logoutBtn) logoutBtn.style.display = 'none';
            }
        }

        // 模态框操作
        showLoginModal() {
            const modal = document.getElementById('loginModal');
            if (modal) {
                modal.style.display = 'flex';
                
                // 聚焦到用户名输入框
                setTimeout(() => {
                    const usernameInput = modal.querySelector('input[name="username"]');
                    if (usernameInput) usernameInput.focus();
                }, 100);
            }
        }

        showRegisterModal() {
            const modal = document.getElementById('registerModal');
            if (modal) {
                modal.style.display = 'flex';
                
                // 聚焦到用户名输入框
                setTimeout(() => {
                    const usernameInput = modal.querySelector('input[name="username"]');
                    if (usernameInput) usernameInput.focus();
                }, 100);
            }
        }

        closeModals() {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                modal.style.display = 'none';
            });
            
            // 清空表单
            const forms = document.querySelectorAll('.modal form');
            forms.forEach(form => form.reset());
        }

        // 处理登录
        async handleLogin() {
            const form = document.getElementById('loginForm');
            if (!form) return;

            const formData = new FormData(form);
            const username = formData.get('username').trim();
            const password = formData.get('password');

            if (!username || !password) {
                showToast('请填写用户名和密码', 'error');
                return;
            }

            const result = await authManager.login(username, password);
            if (result.success) {
                this.closeModals();
            }
        }

        // 处理注册
        async handleRegister() {
            const form = document.getElementById('registerForm');
            if (!form) return;

            const formData = new FormData(form);
            const username = formData.get('username').trim();
            const email = formData.get('email').trim();
            const password = formData.get('password');
            const confirmPassword = formData.get('confirmPassword');

            // 验证输入
            if (!username || !email || !password || !confirmPassword) {
                showToast('请填写所有必填字段', 'error');
                return;
            }

            if (password !== confirmPassword) {
                showToast('两次输入的密码不一致', 'error');
                return;
            }

            if (!Validator.email(email)) {
                showToast('邮箱格式不正确', 'error');
                return;
            }

            const result = await authManager.register(username, email, password);
            if (result.success) {
                this.closeModals();
                this.showLoginModal();
            }
        }

        // 检查连接状态
        async checkConnection() {
            try {
                const result = await API.testConnection();
                if (result.success) {
                    this.connectionStatus = 'connected';
                    console.log(`🌐 API连接正常 (延迟: ${result.latency}ms)`);
                } else {
                    this.connectionStatus = 'error';
                    console.warn('🌐 API连接失败:', result.error);
                }
            } catch (error) {
                this.connectionStatus = 'error';
                console.error('🌐 连接检查失败:', error);
            }
            
            this.updateConnectionStatus();
        }

        // 更新连接状态显示
        updateConnectionStatus() {
            const statusElement = document.getElementById('connectionStatus');
            if (!statusElement) return;

            const statusConfig = {
                connected: { text: '已连接', class: 'connected', icon: '🟢' },
                checking: { text: '检查中', class: 'checking', icon: '🟡' },
                error: { text: '连接失败', class: 'error', icon: '🔴' }
            };

            const config = statusConfig[this.connectionStatus] || statusConfig.error;
            statusElement.textContent = `${config.icon} ${config.text}`;
            statusElement.className = `connection-status ${config.class}`;
        }

        // 检查认证状态
        async checkAuthStatus() {
            if (!authManager.checkAuthStatus()) {
                console.log('认证状态失效，尝试刷新');
                
                try {
                    const user = await authManager.refreshUserInfo();
                    if (user) {
                        this.currentUser = user;
                        this.updateUserUI();
                    } else {
                        this.handleUserLogout();
                    }
                } catch (error) {
                    console.error('刷新认证状态失败:', error);
                    this.handleUserLogout();
                }
            }
        }

        // 清理用户数据
        async clearUserData() {
            if (!this.currentUser) return;

            if (!confirm('确定要清空所有本地数据吗？此操作不可恢复，建议先导出数据备份。')) {
                return;
            }

            try {
                showLoading(true, '清理数据中...');
                
                // 清理本地数据
                this.searchHistory = [];
                this.favorites = [];
                UserIsolatedStorageManager.clearUserData();
                
                // 清理云端数据
                await Promise.allSettled([
                    API.clearSearchHistory(),
                    API.syncFavorites([])
                ]);

                // 重新渲染
                this.renderHistory();
                this.renderFavorites();

                showToast('用户数据已清空', 'success');
            } catch (error) {
                console.error('清空用户数据失败:', error);
                showToast('清空数据失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 导出用户数据
        async exportUserData() {
            if (!this.currentUser) {
                showToast('请先登录', 'error');
                return;
            }

            try {
                const data = {
                    userId: this.currentUser.id,
                    username: this.currentUser.username,
                    favorites: this.favorites,
                    searchHistory: this.searchHistory,
                    exportTime: new Date().toISOString(),
                    version: window.API_CONFIG?.APP_VERSION || '1.0.0'
                };

                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `magnet-search-data-${this.currentUser.id}-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                showToast('数据导出成功', 'success');
            } catch (error) {
                console.error('导出数据失败:', error);
                showToast('导出失败: ' + error.message, 'error');
            }
        }

        // 导入用户数据
        async importUserData(file) {
            if (!this.currentUser) {
                showToast('请先登录', 'error');
                return;
            }

            try {
                const text = await file.text();
                const data = JSON.parse(text);

                // 验证数据格式
                if (!data.userId || !data.favorites || !data.searchHistory) {
                    throw new Error('数据格式不正确');
                }

                if (data.userId !== this.currentUser.id) {
                    if (!confirm('导入的数据属于其他用户，确定要继续吗？')) {
                        return;
                    }
                }

                showLoading(true, '导入数据中...');

                // 合并数据
                const existingUrls = new Set(this.favorites.map(fav => fav.url));
                const existingKeywords = new Set(this.searchHistory.map(item => item.keyword));

                // 导入收藏
                data.favorites.forEach(fav => {
                    if (!existingUrls.has(fav.url)) {
                        this.favorites.push({
                            ...fav,
                            id: generateId('fav_'),
                            addedAt: fav.addedAt || new Date().toISOString()
                        });
                    }
                });

                // 导入搜索历史
                data.searchHistory.forEach(item => {
                    if (!existingKeywords.has(item.keyword)) {
                        this.searchHistory.push({
                            ...item,
                            id: generateId('history_'),
                            timestamp: item.timestamp || Date.now()
                        });
                    }
                });

                // 保存到本地
                this.saveFavorites();
                this.saveHistory();

                // 重新渲染
                this.renderFavorites();
                this.renderHistory();

                // 同步到云端
                await Promise.allSettled([
                    this.syncFavorites(),
                    this.syncSearchHistory()
                ]);

                showToast('数据导入成功', 'success');

            } catch (error) {
                console.error('导入数据失败:', error);
                showToast('导入失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 应用销毁时的清理
        destroy() {
            if (this.searchTimeout) {
                clearTimeout(this.searchTimeout);
            }
            
            // 移除事件监听器
            authManager.removeAuthStateListener(this.handleUserLogin);
            authManager.removeAuthStateListener(this.handleUserLogout);
            
            console.log('🔄 应用已销毁');
        }
    }

    // 创建全局应用实例
    const app = new MagnetSearchApp();
    window.app = app;

    // 页面卸载时清理
    window.addEventListener('beforeunload', () => {
        if (window.app) {
            window.app.destroy();
        }
    });

    console.log('✅ 主应用已加载完成');

})();
