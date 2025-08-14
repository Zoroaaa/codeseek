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
		this.searchEngine = new SearchSuggestionEngine(this);
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
        
        // 加载本地数据
        this.loadLocalData();
        
        // 初始化主题
        this.initTheme();
        
        // 检查认证状态
        await this.checkAuthStatus();
        
        // 若未认证，显示登录模态框
        if (!this.currentUser) {
            document.getElementById('loginModal').style.display = 'block';
        } else {
            // 显示主内容
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
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
    console.log('🔗 绑定事件监听器...');

    // 搜索相关事件
    this.bindSearchEvents();
    
    // 主题切换事件
    this.bindThemeEvents();
    
    // 功能按钮事件
    this.bindFunctionButtons();
    
    // 模态框事件
    this.bindModalEvents();
    
    // 用户菜单事件
    this.bindUserMenuEvents();
    
    // 全局键盘快捷键
    this.bindKeyboardShortcuts();
    
    // 收藏夹控件事件
    this.bindFavoritesControls();
    
    // 搜索建议容器初始化
    this.initializeSearchSuggestions();
    
    // 连接状态监听
    this.bindConnectionStatusEvents();

    console.log('✅ 事件绑定完成');
}

// 搜索相关事件绑定
bindSearchEvents() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn) {
        // 移除旧监听器
        searchBtn.removeEventListener('click', this._searchBtnHandler);
        
        // 创建新的处理器并保存引用
        this._searchBtnHandler = (e) => {
            e.preventDefault();
            this.performSearch();
        };
        
        searchBtn.addEventListener('click', this._searchBtnHandler);
    }
    
    if (searchInput) {
        // 搜索输入事件
        searchInput.removeEventListener('keypress', this._searchInputHandler);
        
        this._searchInputHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch();
            }
        };
        
        searchInput.addEventListener('keypress', this._searchInputHandler);
        
        // 搜索建议 - 防抖处理
        searchInput.addEventListener('input', debounce((e) => {
            this.handleSearchInput(e.target.value);
        }, 300));
        
        // 焦点事件
        searchInput.addEventListener('focus', (e) => {
            if (e.target.value.trim().length >= 2) {
                this.showSearchSuggestions(e.target.value);
            }
        });
        
        searchInput.addEventListener('blur', (e) => {
            // 延迟隐藏以允许点击建议
            setTimeout(() => {
                if (!this.isInteractingWithSuggestions) {
                    this.hideSearchSuggestions();
                }
            }, 200);
        });
    }
}

// 主题切换事件
bindThemeEvents() {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            this.toggleTheme();
        });
    }
}

// 功能按钮事件绑定
bindFunctionButtons() {
    const buttonConfigs = {
        // 历史记录相关
        clearHistoryBtn: {
            handler: () => this.clearHistory(),
            confirm: '确定要清空所有搜索历史吗？'
        },
        
        // 搜索结果相关
        clearResultsBtn: {
            handler: () => this.clearResults(),
            confirm: '确定要清空当前搜索结果吗？'
        },
        exportResultsBtn: {
            handler: () => this.exportResults(),
            condition: () => this.searchResults && this.searchResults.length > 0
        },
        
        // 收藏夹相关
        syncFavoritesBtn: {
            handler: () => this.syncFavorites(),
            condition: () => this.currentUser !== null
        },
        importFavoritesBtn: {
            handler: () => this.importFavorites(),
            condition: () => this.currentUser !== null
        },
        exportFavoritesBtn: {
            handler: () => this.exportFavorites(),
            condition: () => this.favorites && this.favorites.length > 0
        }
    };

    Object.entries(buttonConfigs).forEach(([id, config]) => {
        const btn = document.getElementById(id);
        if (btn) {
            // 移除现有监听器防止重复绑定
            btn.removeEventListener('click', btn._boundHandler);
            
            // 创建新的处理器
            const handler = async (e) => {
                e.preventDefault();
                
                // 检查条件
                if (config.condition && !config.condition()) {
                    return;
                }
                
                // 确认对话框
                if (config.confirm && !confirm(config.confirm)) {
                    return;
                }
                
                try {
                    await config.handler();
                } catch (error) {
                    console.error(`按钮处理失败 (${id}):`, error);
                    showToast('操作失败: ' + error.message, 'error');
                }
            };
            
            // 保存引用并绑定
            btn._boundHandler = handler;
            btn.addEventListener('click', handler);
            
            // 更新按钮可见性
            this.updateButtonVisibility(btn, config);
        }
    });
}

// 更新按钮可见性
updateButtonVisibility(button, config) {
    if (config.condition) {
        const shouldShow = config.condition();
        button.style.display = shouldShow ? 'block' : 'none';
    }
}

// 模态框事件绑定
bindModalEvents() {
    // 登录模态框
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const loginBtn = document.getElementById('loginBtn');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginModal();
        });
    }
    
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
    
    // 关闭按钮事件
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.closeAllModals();
        });
    });
    
    // 点击模态框外部关闭
    [loginModal, registerModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        }
    });
    
    // 表单提交事件 - 关键修复
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        // 移除旧的事件监听器
        loginForm.removeEventListener('submit', this.handleLogin);
        // 绑定新的事件监听器，确保正确的 this 上下文
        loginForm.addEventListener('submit', (e) => {
            this.handleLogin(e);
        });
    }
    
    if (registerForm) {
        // 移除旧的事件监听器
        registerForm.removeEventListener('submit', this.handleRegister);
        // 绑定新的事件监听器，确保正确的 this 上下文
        registerForm.addEventListener('submit', (e) => {
            this.handleRegister(e);
        });
    }
}

// 用户菜单事件
bindUserMenuEvents() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleLogout();
        });
    }
}

// 键盘快捷键事件
bindKeyboardShortcuts() {
    let selectedSuggestionIndex = -1;
    
    document.addEventListener('keydown', (e) => {
        const suggestionsContainer = document.getElementById('searchSuggestions');
        const searchInput = document.getElementById('searchInput');
        
        // 处理搜索建议的键盘导航
        if (suggestionsContainer && suggestionsContainer.style.display === 'block') {
            const suggestions = suggestionsContainer.querySelectorAll('.suggestion-item');
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                    this.updateSuggestionSelection(suggestions, selectedSuggestionIndex);
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                    this.updateSuggestionSelection(suggestions, selectedSuggestionIndex);
                    break;
                    
                case 'Enter':
                    if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
                        e.preventDefault();
                        suggestions[selectedSuggestionIndex].click();
                        return;
                    }
                    break;
                    
                case 'Escape':
                    this.hideSearchSuggestions();
                    selectedSuggestionIndex = -1;
                    if (searchInput) searchInput.focus();
                    return;
            }
        }

        // 全局快捷键
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }

        // ESC 关闭模态框和建议
        if (e.key === 'Escape') {
            this.hideSearchSuggestions();
            this.closeAllModals();
            selectedSuggestionIndex = -1;
        }
    });

    // 重置选择索引当建议隐藏时
    const originalHideSearchSuggestions = this.hideSearchSuggestions.bind(this);
    this.hideSearchSuggestions = () => {
        selectedSuggestionIndex = -1;
        originalHideSearchSuggestions();
    };
}

// 收藏夹控件事件
bindFavoritesControls() {
    // 这里可以添加收藏夹相关的特殊控件事件
    // 例如：收藏夹排序、过滤等
}

// 初始化搜索建议容器
initializeSearchSuggestions() {
    const searchContainer = document.querySelector('.search-container .search-box-wrapper');
    if (searchContainer) {
        const existingSuggestions = document.getElementById('searchSuggestions');
        if (!existingSuggestions) {
            const suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'searchSuggestions';
            suggestionsContainer.className = 'search-suggestions';
            suggestionsContainer.style.display = 'none';
            
            // 添加鼠标事件防止搜索框失焦时立即隐藏
            suggestionsContainer.addEventListener('mouseenter', () => {
                this.isInteractingWithSuggestions = true;
            });
            
            suggestionsContainer.addEventListener('mouseleave', () => {
                this.isInteractingWithSuggestions = false;
            });
            
            searchContainer.appendChild(suggestionsContainer);
        }
    }
}

// 连接状态事件监听
bindConnectionStatusEvents() {
    // 监听连接状态变化
    window.addEventListener('connectionStatusChanged', (event) => {
        this.updateConnectionIndicator(event.detail);
    });
    
    // 监听网络状态变化
    window.addEventListener('online', () => {
        this.connectionStatus = 'connected';
        this.updateConnectionStatus('已连接');
        showToast('网络连接已恢复', 'success');
    });
    
    window.addEventListener('offline', () => {
        this.connectionStatus = 'offline';
        this.updateConnectionStatus('网络断开');
        showToast('网络连接已断开', 'warning');
    });
}



// 更新建议选择状态
updateSuggestionSelection(suggestions, selectedIndex) {
    suggestions.forEach((suggestion, index) => {
        suggestion.classList.remove('keyboard-selected');
        if (index === selectedIndex) {
            suggestion.classList.add('keyboard-selected');
            suggestion.scrollIntoView({ block: 'nearest' });
        }
    });
}

// 增强搜索历史初始化
initializeSearchEngine() {
    if (this.searchEngine) {
        this.searchEngine.initializePopularKeywords();
    }
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
                btn.querySelector('span').textContent = isFavorited ? '已收藏' : '收藏';
                btn.classList.toggle('favorited', isFavorited);
            }
        });
    }

// 修复添加搜索历史方法
addToHistory(keyword) {
    // 严格的输入验证
    if (!keyword || typeof keyword !== 'string') {
        console.warn('无效的搜索关键词类型:', typeof keyword);
        return;
    }
    
    let trimmedKeyword = keyword.trim();
    if (trimmedKeyword.length === 0) {
        console.warn('搜索关键词为空，跳过添加');
        return;
    }
    
    // 修复：使用let声明，允许重新赋值
    if (trimmedKeyword.length > 100) {
        console.warn('搜索关键词过长，截断处理');
        trimmedKeyword = trimmedKeyword.substring(0, 100);
    }
    
    try {
        // 安全的数组过滤：确保每个item都有有效的query属性
        this.searchHistory = this.searchHistory.filter(item => {
            return item && 
                   typeof item === 'object' && 
                   item.query && 
                   typeof item.query === 'string' && 
                   item.query !== trimmedKeyword;
        });
        
        // 创建新的历史记录项（统一使用query字段）
        const historyItem = {
            id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            query: trimmedKeyword,       // 主字段
            keyword: trimmedKeyword,     // 兼容字段
            timestamp: Date.now(),
            count: 1,
            source: 'manual'
        };
        
        // 添加到开头
        this.searchHistory.unshift(historyItem);

        // 限制历史记录数量
        const maxHistory = this.config.maxHistoryPerUser || 1000;
        if (this.searchHistory.length > maxHistory) {
            this.searchHistory = this.searchHistory.slice(0, maxHistory);
        }

        // 保存到本地存储
        this.saveHistory();
        
        // 更新UI显示
        this.renderHistory();

        // 如果用户已登录，保存到云端（异步，不阻塞UI）
        if (this.currentUser) {
            API.saveSearchHistory(trimmedKeyword, 'manual').catch(error => {
                console.error('保存搜索历史到云端失败:', error);
                // 不显示错误提示，避免干扰用户体验
            });
        }
        
    } catch (error) {
        console.error('添加搜索历史失败:', error);
        // 确保不影响搜索功能
    }
}


// 修复渲染搜索历史
renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    // 过滤有效的搜索历史
    const validHistory = this.searchHistory.filter(item => {
        return item && item.query && 
               typeof item.query === 'string' && 
               item.query.trim().length > 0;
    });

    if (validHistory.length === 0) {
        if (historySection) historySection.style.display = 'none';
        return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
        historyList.innerHTML = validHistory.slice(0, 10).map(item => 
            `<span class="history-item" onclick="app.searchFromHistory('${this.escapeHtml(item.query)}')">
                ${this.escapeHtml(item.query)}
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

// 导出结果
async exportResults() {
    try {
        if (!this.currentSearchResults || this.currentSearchResults.length === 0) {
            showToast('没有搜索结果可以导出', 'warning');
            return;
        }

        const exportData = {
            query: this.lastSearchQuery || '',
            results: this.currentSearchResults,
            exportTime: new Date().toISOString(),
            totalResults: this.currentSearchResults.length,
            version: window.API_CONFIG?.APP_VERSION || '1.0.0'
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-results-${this.lastSearchQuery || 'query'}-${new Date().toISOString().split('T')[0]}.json`;
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

// 更新所有功能按钮状态
updateFunctionButtons() {
    // 更新导出结果按钮
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    if (exportResultsBtn) {
        const hasResults = this.searchResults && this.searchResults.length > 0;
        exportResultsBtn.style.display = hasResults ? 'inline-block' : 'none';
    }
    
    // 更新同步相关按钮
    const syncButtons = ['syncFavoritesBtn', 'importFavoritesBtn'];
    syncButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.style.display = this.currentUser ? 'inline-block' : 'none';
        }
    });
    
    // 更新导出收藏按钮
    const exportFavoritesBtn = document.getElementById('exportFavoritesBtn');
    if (exportFavoritesBtn) {
        const hasFavorites = this.favorites && this.favorites.length > 0;
        exportFavoritesBtn.style.display = hasFavorites ? 'inline-block' : 'none';
    }
}

// 在相关数据更新时调用按钮状态更新
// 例如在 performSearch 方法最后调用
// 在 loadFavorites 方法最后调用
// 在 updateUserStatus 方法中调用


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
                        this.saveFavorites();
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

async loadLocalData() {
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
    
    // 初始化搜索引擎
    this.initializeSearchEngine();
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

// 更新连接指示器
updateConnectionIndicator(detail) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        const statusIndicator = indicator.querySelector('.status-indicator');
        const statusText = indicator.querySelector('.status-text');
        
        if (statusIndicator && statusText) {
            statusIndicator.className = `status-indicator ${detail.status}`;
            
            const statusTexts = {
                connected: '已连接',
                warning: `连接不稳定 (${detail.failures} 次失败)`,
                error: '连接失败',
                checking: '检查连接...'
            };
            
            statusText.textContent = statusTexts[detail.status] || '未知状态';
        }
    }
}



// 显示登录模态框
showLoginModal() {
    this.closeAllModals();
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.style.display = 'block';
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
    }
}

// 显示注册模态框
showRegisterModal() {
    this.closeAllModals();
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.style.display = 'block';
        const usernameInput = document.getElementById('regUsername');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
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
    // 关键修复：添加事件参数检查
    if (event) {
        event.preventDefault();
    }
    
    // 防止重复提交
    const submitBtn = event?.target?.querySelector('button[type="submit"]') || 
                     document.querySelector('#loginForm button[type="submit"]');
    if (submitBtn && submitBtn.disabled) return;
    
    const username = document.getElementById('loginUsername')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;

    if (!username || !password) {
        showToast('请填写用户名和密码', 'error');
        return;
    }

    try {
        // 禁用提交按钮
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '登录中...';
        }
        
        showLoading(true);
        const result = await API.login(username, password);
        
        if (result.success) {
            this.currentUser = result.user;
            
            // 立即更新UI状态
            this.updateUserUI();
            
            // 显示主内容区域
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.style.display = 'block';
            }
            
            // 关闭模态框
            this.closeAllModals();
            
            // 显示欢迎消息
            showToast(`欢迎回来，${result.user.username}！`, 'success');
            
            // 异步加载云端数据（不阻塞UI）
            this.loadCloudData().catch(error => {
                console.error('加载云端数据失败:', error);
                showToast('云端数据加载失败，使用本地数据', 'warning', 3000);
            });
            
            // 处理URL参数（如搜索查询）
            this.handleURLParams();
            
            // 清空登录表单
            const loginForm = document.getElementById('loginForm');
            if (loginForm) loginForm.reset();
            
        } else {
            throw new Error(result.message || '登录失败');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showToast(`登录失败: ${error.message}`, 'error');
    } finally {
        showLoading(false);
        
        // 恢复提交按钮状态
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '登录';
        }
    }
}

async handleRegister(event) {
    // 关键修复：添加事件参数检查
    if (event) {
        event.preventDefault();
    }
    
    // 添加防止重复提交机制
    const submitBtn = event?.target?.querySelector('button[type="submit"]') || 
                     document.querySelector('#registerForm button[type="submit"]');
    if (submitBtn && submitBtn.classList.contains('submitting')) return;
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('submitting');
        submitBtn.textContent = '注册中...';
    }
        
    const username = document.getElementById('regUsername')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;

    // 客户端验证
    if (!username || !email || !password || !confirmPassword) {
        showToast('请填写所有字段', 'error');
        this.resetRegisterButton(submitBtn);
        return;
    }

    if (password !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        this.resetRegisterButton(submitBtn);
        return;
    }

    // 使用配置中的验证规则
    if (username.length < this.config.minUsernameLength || username.length > this.config.maxUsernameLength) {
        showToast(`用户名长度应在${this.config.minUsernameLength}-${this.config.maxUsernameLength}个字符之间`, 'error');
        this.resetRegisterButton(submitBtn);
        return;
    }

    if (password.length < this.config.minPasswordLength) {
        showToast(`密码长度至少${this.config.minPasswordLength}个字符`, 'error');
        this.resetRegisterButton(submitBtn);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('请输入有效的邮箱地址', 'error');
        this.resetRegisterButton(submitBtn);
        return;
    }

    try {
        showLoading(true);
        const result = await API.register(username, email, password);
        
        if (result.success) {
            showToast('注册成功，请登录', 'success');
            this.showLoginModal();
            
            // 清空注册表单
            const registerForm = document.getElementById('registerForm');
            if (registerForm) registerForm.reset();
            
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
        this.resetRegisterButton(submitBtn);
    }
}

// 新增：重置注册按钮状态的辅助方法
resetRegisterButton(submitBtn) {
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('submitting');
        submitBtn.textContent = '注册';
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
        
        // 关键修复：显示登录模态框
        this.showLoginModal();
        
        // 重置主界面状态
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
            this.saveFavorites();
            this.renderFavorites();
            console.log(`☁️ 云端收藏已加载: ${cloudFavorites.length}个`);
        }

        // 加载云端搜索历史
        const cloudHistory = await API.getSearchHistory();
        if (cloudHistory && cloudHistory.length > 0) {
            // 过滤有效的历史记录，统一使用query字段
            const validCloudHistory = cloudHistory.filter(item => {
                const query = item.query || item.keyword;
                return item && query && 
                       typeof query === 'string' &&
                       query.trim().length > 0;
            }).map(item => ({
                id: item.id,
                query: item.query || item.keyword,      // 统一使用query
                keyword: item.query || item.keyword,    // 保持兼容
                timestamp: item.timestamp,
                source: item.source || 'unknown'
            }));

            // 合并本地和云端历史，去重
            const mergedHistory = [...validCloudHistory];
            
            // 添加本地独有的历史记录
            this.searchHistory.forEach(localItem => {
                if (localItem && localItem.query && 
                    !mergedHistory.some(cloudItem => cloudItem.query === localItem.query)) {
                    mergedHistory.push({
                        id: localItem.id,
                        query: localItem.query,
                        keyword: localItem.query,
                        timestamp: localItem.timestamp,
                        source: localItem.source || 'local'
                    });
                }
            });
            
            // 排序并限制数量
            this.searchHistory = mergedHistory
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                .slice(0, this.config.maxHistoryPerUser || 1000);
            
            this.saveHistory();
            this.renderHistory();
            console.log(`☁️ 云端历史已加载: ${validCloudHistory.length}条`);
        }
    } catch (error) {
        console.error('加载云端数据失败:', error);
        showToast('加载云端数据失败，使用本地数据', 'warning');
    }
}


// 处理搜索输入
handleSearchInput(value) {
    if (!value || value.length < 2) {
        this.hideSearchSuggestions();
        return;
    }
    this.showSearchSuggestions(value);
}

// 关闭所有模态框
closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
}

// 修复搜索建议显示方法
showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return;
    
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) return;
    
    const suggestions = this.searchEngine.generateSuggestions(query);
    
    if (suggestions.length > 0) {
        const typeIcons = {
            history: '🕐',
            popular: '🔥',
            code: '🎯'
        };

        suggestionsContainer.innerHTML = suggestions.map(suggestion => 
            `<div class="suggestion-item suggestion-${suggestion.type}" 
                  onclick="app.searchFromHistory('${this.escapeHtml(suggestion.text)}')">
                <span class="suggestion-icon">${typeIcons[suggestion.type] || '🔍'}</span>
                <span class="suggestion-text">${this.escapeHtml(suggestion.text)}</span>
                <span class="suggestion-type">${this.getSuggestionTypeText(suggestion.type)}</span>
            </div>`
        ).join('');
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

getSuggestionTypeText(type) {
    const typeTexts = {
        history: '历史',
        popular: '热门',
        code: '番号'
    };
    return typeTexts[type] || '';
}


    // 隐藏搜索建议
	hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.style.display = 'none';
    }
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

// 智能搜索建议类
class SearchSuggestionEngine {
    constructor(app) {
        this.app = app;
        this.cache = new Map();
        this.popularKeywords = [];
        this.userPreferences = new Set();
    }

    // 初始化热门关键词
    initializePopularKeywords() {
        // 从历史记录中提取热门关键词
        const keywordCount = {};
        (this.app.searchHistory || []).forEach(item => {
            const keyword = item.query || item.keyword;
            if (keyword) {
                keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
            }
        });

        this.popularKeywords = Object.entries(keywordCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50)
            .map(([keyword]) => keyword);
    }

    // 生成搜索建议
    generateSuggestions(query) {
        if (!query || query.length < 2) return [];

        const cacheKey = query.toLowerCase();
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const suggestions = new Set();
        const queryLower = query.toLowerCase();

        // 1. 历史记录匹配
        (this.app.searchHistory || []).forEach(item => {
            const keyword = item.query || item.keyword;
            if (keyword && keyword.toLowerCase().includes(queryLower) && keyword !== query) {
                suggestions.add({
                    text: keyword,
                    type: 'history',
                    score: 10 + (item.count || 1)
                });
            }
        });

        // 2. 热门关键词匹配
        this.popularKeywords.forEach(keyword => {
            if (keyword.toLowerCase().includes(queryLower) && keyword !== query) {
                suggestions.add({
                    text: keyword,
                    type: 'popular',
                    score: 5
                });
            }
        });

        // 3. 番号模式匹配
        const codePatterns = this.generateCodeSuggestions(query);
        codePatterns.forEach(pattern => {
            suggestions.add({
                text: pattern,
                type: 'code',
                score: 8
            });
        });

        // 排序并限制数量
        const sortedSuggestions = Array.from(suggestions)
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);

        // 缓存结果
        this.cache.set(cacheKey, sortedSuggestions);
        
        // 限制缓存大小
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        return sortedSuggestions;
    }

    // 生成番号建议
    generateCodeSuggestions(query) {
        const suggestions = [];
        const upperQuery = query.toUpperCase();

        // 常见番号前缀
        const commonPrefixes = [
            'SSIS', 'SSNI', 'CAWD', 'MIDV', 'MIAE', 'MIAA', 'MIRD',
            'IPX', 'IPZ', 'ABP', 'ABAV', 'SHKD', 'ADN', 'JUL', 'JUY',
            'PRED', 'PPPD', 'EBOD', 'MEYD', 'GVG', 'VAGU', 'HBAD',
            'SW', 'HUNT', 'SCPX', 'CLUB', 'DVDES', 'SDDE', 'FSET'
        ];

        // 如果输入看起来像番号前缀
        if (/^[A-Z]{2,5}$/i.test(query)) {
            commonPrefixes.forEach(prefix => {
                if (prefix.startsWith(upperQuery)) {
                    for (let i = 1; i <= 5; i++) {
                        const num = String(i).padStart(3, '0');
                        suggestions.push(`${prefix}-${num}`);
                    }
                }
            });
        }

        // 如果输入包含数字，尝试补全
        if (/^[A-Z]+\d+$/i.test(query)) {
            const match = upperQuery.match(/^([A-Z]+)(\d+)$/);
            if (match) {
                const [, prefix, num] = match;
                const paddedNum = num.padStart(3, '0');
                suggestions.push(`${prefix}-${paddedNum}`);
            }
        }

        return suggestions.slice(0, 3);
    }

    // 清理缓存
    clearCache() {
        this.cache.clear();
    }

    // 更新用户偏好
    updateUserPreferences(keyword) {
        this.userPreferences.add(keyword.toLowerCase());
        
        // 限制偏好数量
        if (this.userPreferences.size > 200) {
            const array = Array.from(this.userPreferences);
            this.userPreferences = new Set(array.slice(-150));
        }
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
