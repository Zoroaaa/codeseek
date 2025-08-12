// 主要应用逻辑 - 完全优化版本
// 集成所有功能模块，提供完整的用户体验

class MagnetSearchApp {
    constructor() {
        this.currentUser = null;
        this.searchHistory = [];
        this.favorites = [];
        this.currentSearchResults = [];
        this.isInitialized = false;
        this.config = {};
        this.searchCache = new Map();
        this.uiState = {
            isSearching: false,
            currentView: 'main',
            selectedResults: new Set()
        };
        
        // 绑定事件处理器
        this.bindMethods();
    }

    // 绑定方法到实例
    bindMethods() {
        this.performSearch = this.performSearch.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.toggleFavorite = this.toggleFavorite.bind(this);
        this.openResult = this.openResult.bind(this);
        this.copyToClipboard = this.copyToClipboard.bind(this);
    }

    // 初始化应用
    async init() {
        try {
            showLoading(true, '正在初始化应用...');
            
            console.log('🚀 开始初始化磁力快搜应用...');
            
            // 检查浏览器兼容性
            if (!this.checkBrowserCompatibility()) {
                throw new Error('浏览器版本过低，请升级后使用');
            }
            
            // 加载系统配置
            await this.loadConfig();
            
            // 设置API基础URL（从环境变量或配置获取）
            this.setupAPIConfiguration();
            
            // 绑定全局事件
            this.bindGlobalEvents();
            
            // 绑定UI事件
            this.bindUIEvents();
            
            // 加载本地数据
            this.loadLocalData();
            
            // 初始化主题
            this.initTheme();
            
            // 检查认证状态
            await this.checkAuthStatus();
            
            // 测试API连接
            await this.testAPIConnection();
            
            // 初始化搜索建议
            this.initSearchSuggestions();
            
            // 预加载资源
            this.preloadResources();
            
            this.isInitialized = true;
            console.log('✅ 应用初始化完成');
            
            // 触发初始化完成事件
            this.dispatchEvent('appInitialized');
            
        } catch (error) {
            console.error('❌ 应用初始化失败:', error);
            showToast(`应用初始化失败: ${error.message}`, 'error', 5000);
            
            // 降级处理
            this.initFallbackMode();
        } finally {
            showLoading(false);
        }
    }

    // 检查浏览器兼容性
    checkBrowserCompatibility() {
        const required = {
            localStorage: typeof Storage !== 'undefined',
            fetch: typeof fetch !== 'undefined',
            Promise: typeof Promise !== 'undefined',
            customElements: typeof customElements !== 'undefined',
            es6: (() => {
                try {
                    return eval('(async () => {})') instanceof Function;
                } catch {
                    return false;
                }
            })()
        };
        
        const unsupported = Object.keys(required).filter(key => !required[key]);
        
        if (unsupported.length > 0) {
            console.error('不支持的浏览器功能:', unsupported);
            showToast('浏览器版本过低，建议升级到最新版本', 'warning', 10000);
            return false;
        }
        
        return true;
    }

    // 设置API配置
    setupAPIConfiguration() {
        // 从环境变量或页面配置获取API地址
        if (!window.API_BASE_URL) {
            // 尝试从页面的meta标签获取
            const metaApiUrl = document.querySelector('meta[name="api-base-url"]');
            if (metaApiUrl) {
                window.API_BASE_URL = metaApiUrl.content;
            }
        }
        
        console.log('🌐 API配置完成:', API.baseURL);
    }

    // 加载系统配置
    async loadConfig() {
        try {
            this.config = await API.getConfig();
            console.log('📋 系统配置已加载:', this.config);
            
            // 应用配置到UI
            this.applyConfig();
            
        } catch (error) {
            console.error('配置加载失败:', error);
            // 使用默认配置
            this.config = this.getDefaultConfig();
            showToast('使用默认配置，部分功能可能受限', 'warning');
        }
    }

    // 获取默认配置
    getDefaultConfig() {
        return {
            site_name: '磁力快搜',
            site_description: '专业的磁力搜索工具',
            enable_registration: true,
            min_username_length: 3,
            max_username_length: 20,
            min_password_length: 6,
            max_favorites: 1000,
            max_search_history: 1000,
            search_result_cache_enabled: true,
            cache_ttl: 3600
        };
    }

    // 应用配置到UI
    applyConfig() {
        // 设置页面标题
        if (this.config.site_name) {
            document.title = this.config.site_name;
            
            const brandElements = document.querySelectorAll('.brand-text');
            brandElements.forEach(el => {
                el.textContent = this.config.site_name;
            });
        }
        
        // 设置描述
        if (this.config.site_description) {
            const descElement = document.querySelector('.hero-subtitle');
            if (descElement) {
                descElement.textContent = this.config.site_description;
            }
            
            // 更新meta描述
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.name = 'description';
                document.head.appendChild(metaDesc);
            }
            metaDesc.content = this.config.site_description;
        }
        
        // 配置注册功能
        const registerElements = document.querySelectorAll('.register-related');
        registerElements.forEach(el => {
            el.style.display = this.config.enable_registration ? 'block' : 'none';
        });
    }

    // 绑定全局事件
    bindGlobalEvents() {
        // 认证状态变化
        window.addEventListener('authStateChanged', (event) => {
            this.handleAuthStateChange(event.detail);
        });
        
        // 网络状态变化
        window.addEventListener('online', () => {
            showToast('网络已恢复', 'success');
            this.handleNetworkRestore();
        });
        
        window.addEventListener('offline', () => {
            showToast('网络连接中断，进入离线模式', 'warning');
            this.handleNetworkLoss();
        });
        
        // 会话超时
        window.addEventListener('sessionTimeout', () => {
            showToast('会话已超时，请重新登录', 'warning');
            this.showLoginModal();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (event) => {
            this.handleKeyboardShortcuts(event);
        });
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
    }

    // 绑定UI事件
    bindUIEvents() {
        // 搜索相关
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchBtn');
        
        if (searchInput) {
            searchInput.addEventListener('input', debounce(this.handleSearchInput.bind(this), 300));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
            searchInput.addEventListener('focus', this.showSearchSuggestions.bind(this));
            searchInput.addEventListener('blur', debounce(this.hideSearchSuggestions.bind(this), 200));
        }
        
        if (searchButton) {
            searchButton.addEventListener('click', this.performSearch);
        }
        
        // 登录注册相关
        this.bindAuthEvents();
        
        // 主题切换
        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', this.toggleTheme.bind(this));
        }
        
        // 收藏夹和历史记录
        this.bindDataManagementEvents();
        
        // 导航相关
        this.bindNavigationEvents();
        
        // 批量操作
        this.bindBatchOperationEvents();
    }

    // 绑定认证相关事件
    bindAuthEvents() {
        // 登录表单
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin);
        }
        
        // 注册表单
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', this.handleRegister);
        }
        
        // 登录/注册按钮
        const loginBtn = document.getElementById('loginBtn');
        const registerBtn = document.getElementById('registerBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }
        
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.showRegisterModal());
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // 密码强度检查
        const passwordInput = document.getElementById('registerPassword');
        if (passwordInput) {
            passwordInput.addEventListener('input', this.updatePasswordStrength.bind(this));
        }
        
        // 自动完成用户名
        const usernameInput = document.getElementById('loginUsername');
        if (usernameInput && authManager.getRememberedUsername()) {
            usernameInput.value = authManager.getRememberedUsername();
            
            // 记住我复选框
            const rememberCheckbox = document.getElementById('rememberMe');
            if (rememberCheckbox) {
                rememberCheckbox.checked = true;
            }
        }
    }

    // 绑定数据管理事件
    bindDataManagementEvents() {
        // 清除历史记录
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', this.clearSearchHistory.bind(this));
        }
        
        // 同步收藏夹
        const syncFavoritesBtn = document.getElementById('syncFavoritesBtn');
        if (syncFavoritesBtn) {
            syncFavoritesBtn.addEventListener('click', this.syncFavorites.bind(this));
        }
        
        // 导入导出
        const importBtn = document.getElementById('importBtn');
        const exportBtn = document.getElementById('exportBtn');
        
        if (importBtn) {
            importBtn.addEventListener('click', this.importData.bind(this));
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', this.exportData.bind(this));
        }
    }

    // 绑定导航事件
    bindNavigationEvents() {
        // 导航菜单项
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                if (target) {
                    this.showSection(target);
                }
            });
        });
        
        // 面包屑导航
        const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
        breadcrumbItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const target = item.dataset.target;
                if (target) {
                    this.showSection(target);
                }
            });
        });
    }

    // 绑定批量操作事件
    bindBatchOperationEvents() {
        // 全选
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', this.selectAllResults.bind(this));
        }
        
        // 批量收藏
        const batchFavoriteBtn = document.getElementById('batchFavoriteBtn');
        if (batchFavoriteBtn) {
            batchFavoriteBtn.addEventListener('click', this.batchAddToFavorites.bind(this));
        }
        
        // 批量复制
        const batchCopyBtn = document.getElementById('batchCopyBtn');
        if (batchCopyBtn) {
            batchCopyBtn.addEventListener('click', this.batchCopyLinks.bind(this));
        }
    }

    // 加载本地数据
    loadLocalData() {
        try {
            // 加载搜索历史
            this.searchHistory = StorageManager.getItem('search_history', []);
            
            // 加载收藏夹
            this.favorites = StorageManager.getItem('favorites', []);
            
            // 加载用户设置
            const settings = StorageManager.getItem('user_settings', {});
            this.applyUserSettings(settings);
            
            console.log('📂 本地数据加载完成');
            
            // 更新UI
            this.updateHistoryDisplay();
            this.updateFavoritesDisplay();
            
        } catch (error) {
            console.error('加载本地数据失败:', error);
            showToast('本地数据加载失败，使用默认设置', 'warning');
        }
    }

    // 应用用户设置
    applyUserSettings(settings) {
        // 搜索选项
        if (settings.searchOptions) {
            const { enableSort, enableFilter, defaultSortBy } = settings.searchOptions;
            
            const sortCheckbox = document.getElementById('enableSort');
            const filterCheckbox = document.getElementById('enableFilter');
            
            if (sortCheckbox) sortCheckbox.checked = enableSort;
            if (filterCheckbox) filterCheckbox.checked = enableFilter;
        }
        
        // 显示设置
        if (settings.displayOptions) {
            const { resultsPerPage, showThumbnails, compactView } = settings.displayOptions;
            
            // 应用显示设置
            document.documentElement.style.setProperty('--results-per-page', resultsPerPage || 20);
            
            if (showThumbnails === false) {
                document.body.classList.add('hide-thumbnails');
            }
            
            if (compactView) {
                document.body.classList.add('compact-view');
            }
        }
    }

    // 初始化主题
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'auto';
        this.setTheme(savedTheme);
    }

    // 设置主题
    setTheme(theme) {
        const root = document.documentElement;
        const themeBtn = document.getElementById('themeBtn');
        
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            root.setAttribute('data-theme', theme);
        }
        
        localStorage.setItem('theme', theme);
        
        // 更新主题按钮图标
        if (themeBtn) {
            const currentTheme = root.getAttribute('data-theme');
            themeBtn.innerHTML = currentTheme === 'dark' ? '🌞' : '🌙';
        }
        
        console.log(`🎨 主题已设置为: ${theme}`);
    }

    // 切换主题
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    // 检查认证状态
    async checkAuthStatus() {
        if (authManager.isAuthenticated()) {
            this.currentUser = authManager.getCurrentUser();
            this.updateAuthUI(true);
            
            // 同步用户数据
            await this.syncUserData();
        } else {
            this.updateAuthUI(false);
        }
    }

    // 测试API连接
    async testAPIConnection() {
        try {
            console.log('🔌 测试API连接...');
            
            const results = await APITester.testConnection();
            
            if (results.summary.success) {
                console.log('✅ API连接正常');
            } else {
                console.warn('⚠️ API连接存在问题:', results);
                showToast('API连接不稳定，部分功能可能受限', 'warning');
            }
            
            return results.summary.success;
        } catch (error) {
            console.error('❌ API连接测试失败:', error);
            showToast('无法连接到服务器，请检查网络连接', 'error');
            return false;
        }
    }

    // 初始化搜索建议
    initSearchSuggestions() {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        
        // 创建建议容器
        const suggestionContainer = document.createElement('div');
        suggestionContainer.className = 'search-suggestions';
        suggestionContainer.id = 'searchSuggestions';
        searchInput.parentNode.appendChild(suggestionContainer);
        
        // 隐藏建议容器
        suggestionContainer.style.display = 'none';
    }

    // 预加载资源
    preloadResources() {
        // 预加载常用图标
        const icons = ['⭐', '📋', '🔍', '❤️', '📁', '🔗'];
        icons.forEach(icon => {
            const span = document.createElement('span');
            span.textContent = icon;
            span.style.opacity = '0';
            span.style.position = 'absolute';
            span.style.pointerEvents = 'none';
            document.body.appendChild(span);
            setTimeout(() => document.body.removeChild(span), 100);
        });
        
        // 预加载样式
        requestIdleCallback(() => {
            this.preloadCriticalCSS();
        });
    }

    // 预加载关键CSS
    preloadCriticalCSS() {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = 'style.css';
        document.head.appendChild(link);
    }

    // 降级模式初始化
    initFallbackMode() {
        console.warn('🛠️ 进入降级模式');
        
        // 禁用需要服务器的功能
        const serverDependentElements = document.querySelectorAll('.server-required');
        serverDependentElements.forEach(el => {
            el.style.display = 'none';
        });
        
        // 显示离线提示
        const offlineBanner = document.createElement('div');
        offlineBanner.className = 'offline-banner';
        offlineBanner.innerHTML = '⚠️ 离线模式：部分功能不可用';
        document.body.insertBefore(offlineBanner, document.body.firstChild);
        
        this.isInitialized = true;
    }

    // 执行搜索
    async performSearch(keyword = null, options = {}) {
        try {
            const searchInput = document.getElementById('searchInput');
            const searchKeyword = keyword || searchInput?.value?.trim() || '';
            
            if (!searchKeyword) {
                showToast('请输入搜索关键词', 'warning');
                searchInput?.focus();
                return;
            }
            
            // 验证搜索关键词
            const validation = FormValidator.validateSearchKeyword(searchKeyword);
            if (!validation.valid) {
                showToast(validation.message, 'error');
                return;
            }
            
            this.uiState.isSearching = true;
            this.updateSearchUI(true);
            
            console.log('🔍 开始搜索:', searchKeyword);
            
            // 检查缓存
            const cacheKey = `search_${searchKeyword}_${JSON.stringify(options)}`;
            let results = this.searchCache.get(cacheKey);
            
            if (!results && this.config.search_result_cache_enabled) {
                results = await API.getCachedSearch(searchKeyword);
            }
            
            if (!results) {
                // 执行实际搜索
                results = await this.executeSearch(searchKeyword, options);
                
                // 缓存结果
                if (results && results.length > 0) {
                    this.searchCache.set(cacheKey, results);
                    
                    // 异步缓存到服务器
                    if (this.config.search_result_cache_enabled) {
                        API.setCachedSearch(searchKeyword, results, this.config.cache_ttl).catch(console.error);
                    }
                }
            } else {
                console.log('📋 使用缓存结果');
            }
            
            this.currentSearchResults = results || [];
            
            // 显示结果
            this.displaySearchResults(this.currentSearchResults, searchKeyword);
            
            // 添加到搜索历史
            this.addToSearchHistory(searchKeyword, this.currentSearchResults.length);
            
            // 记录搜索行为
            if (authManager.isAuthenticated()) {
                API.addSearchRecord(searchKeyword, this.currentSearchResults).catch(console.error);
                API.recordAction('search', { 
                    keyword: searchKeyword, 
                    resultCount: this.currentSearchResults.length,
                    cached: !!results
                }).catch(console.error);
            }
            
            // 显示搜索结果区域
            this.showSection('results');
            
        } catch (error) {
            console.error('搜索失败:', error);
            showToast(`搜索失败: ${error.message}`, 'error');
            this.displaySearchError(error);
        } finally {
            this.uiState.isSearching = false;
            this.updateSearchUI(false);
        }
    }

    // 执行实际搜索
    async executeSearch(keyword, options = {}) {
        // 基础搜索（模拟多个磁力站点搜索）
        const searchPromises = [
            this.searchSite1(keyword, options),
            this.searchSite2(keyword, options),
            this.searchSite3(keyword, options)
        ];
        
        // 等待所有搜索完成（部分失败不影响整体结果）
        const results = await Promise.allSettled(searchPromises);
        
        // 合并结果
        let allResults = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                allResults.push(...result.value);
            } else {
                console.warn(`搜索站点 ${index + 1} 失败:`, result.reason);
            }
        });
        
        // 去重和排序
        allResults = this.deduplicateResults(allResults);
        allResults = this.sortResults(allResults, options.sortBy || 'relevance');
        
        // 应用过滤器
        if (options.filters) {
            allResults = this.filterResults(allResults, options.filters);
        }
        
        return allResults;
    }

    // 模拟搜索站点1
    async searchSite1(keyword, options) {
        // 这里应该是实际的搜索API调用
        // 为了演示，我们生成模拟数据
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const results = this.generateMockResults(keyword, 'site1', 15);
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            }, Math.random() * 1000 + 500);
        });
    }

    // 模拟搜索站点2
    async searchSite2(keyword, options) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const results = this.generateMockResults(keyword, 'site2', 12);
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            }, Math.random() * 1200 + 300);
        });
    }

    // 模拟搜索站点3
    async searchSite3(keyword, options) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    const results = this.generateMockResults(keyword, 'site3', 18);
                    resolve(results);
                } catch (error) {
                    reject(error);
                }
            }, Math.random() * 800 + 400);
        });
    }

    // 生成模拟搜索结果
    generateMockResults(keyword, source, count) {
        const results = [];
        const categories = ['电影', '电视剧', '动漫', '纪录片', '软件', '游戏', '音乐', '图书'];
        const extensions = ['mkv', 'mp4', 'avi', 'exe', 'zip', 'rar', 'mp3', 'pdf'];
        
        for (let i = 0; i < count; i++) {
            const category = categories[Math.floor(Math.random() * categories.length)];
            const ext = extensions[Math.floor(Math.random() * extensions.length)];
            const size = (Math.random() * 10 + 0.1).toFixed(1) + 'GB';
            
            results.push({
                id: `${source}_${i}_${Date.now()}`,
                title: `${keyword} ${category} ${i + 1}`,
                subtitle: `高清版本 - ${size}`,
                magnetUrl: `magnet:?xt=urn:btih:${this.generateMockHash()}&dn=${encodeURIComponent(keyword)}`,
                size: size,
                fileCount: Math.floor(Math.random() * 50) + 1,
                seeders: Math.floor(Math.random() * 1000),
                leechers: Math.floor(Math.random() * 200),
                category: category,
                extension: ext,
                uploadDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
                source: source,
                quality: this.getRandomQuality(),
                verified: Math.random() > 0.3
            });
        }
        
        return results;
    }

    // 生成模拟哈希值
    generateMockHash() {
        const chars = '0123456789abcdef';
        let hash = '';
        for (let i = 0; i < 40; i++) {
            hash += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return hash;
    }

    // 获取随机质量
    getRandomQuality() {
        const qualities = ['720p', '1080p', '4K', 'HDRip', 'WEB-DL', 'BluRay'];
        return qualities[Math.floor(Math.random() * qualities.length)];
    }

    // 去重结果
    deduplicateResults(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.magnetUrl || result.title;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    // 排序结果
    sortResults(results, sortBy) {
        switch (sortBy) {
            case 'size':
                return results.sort((a, b) => this.parseSize(b.size) - this.parseSize(a.size));
            case 'date':
                return results.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
            case 'seeders':
                return results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
            case 'name':
                return results.sort((a, b) => a.title.localeCompare(b.title));
            default: // relevance
                return results.sort((a, b) => (b.seeders || 0) - (a.seeders || 0));
        }
    }

    // 解析文件大小
    parseSize(sizeStr) {
        if (!sizeStr) return 0;
        const units = { 'B': 1, 'KB': 1024, 'MB': 1024**2, 'GB': 1024**3, 'TB': 1024**4 };
        const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/);
        if (!match) return 0;
        return parseFloat(match[1]) * (units[match[2]] || 1);
    }

    // 过滤结果
    filterResults(results, filters) {
        return results.filter(result => {
            // 大小过滤
            if (filters.minSize && this.parseSize(result.size) < this.parseSize(filters.minSize)) {
                return false;
            }
            if (filters.maxSize && this.parseSize(result.size) > this.parseSize(filters.maxSize)) {
                return false;
            }
            
            // 分类过滤
            if (filters.category && result.category !== filters.category) {
                return false;
            }
            
            // 质量过滤
            if (filters.quality && !result.title.toLowerCase().includes(filters.quality.toLowerCase())) {
                return false;
            }
            
            // 只显示已验证
            if (filters.verifiedOnly && !result.verified) {
                return false;
            }
            
            return true;
        });
    }

    // 显示搜索结果
    displaySearchResults(results, keyword) {
        const resultsContainer = document.getElementById('searchResults');
        const searchInfo = document.getElementById('searchInfo');
        
        if (!resultsContainer) return;
        
        // 更新搜索信息
        if (searchInfo) {
            const resultCount = results.length;
            const searchTime = performance.now();
            searchInfo.innerHTML = `
                搜索 "${keyword}" 找到 <strong>${resultCount}</strong> 个结果
                ${resultCount > 0 ? `<span class="search-time">(${(searchTime % 1000).toFixed(0)}ms)</span>` : ''}
            `;
        }
        
        // 清空容器
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            this.displayEmptyResults(resultsContainer, keyword);
            return;
        }
        
        // 创建结果网格
        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'results-grid';
        
        results.forEach((result, index) => {
            const resultElement = this.createResultElement(result, index);
            resultsGrid.appendChild(resultElement);
        });
        
        resultsContainer.appendChild(resultsGrid);
        
        // 延迟显示动画
        requestAnimationFrame(() => {
            resultsGrid.classList.add('results-loaded');
        });
        
        // 懒加载更多结果
        this.setupInfiniteScroll(resultsContainer, results);
    }

    // 创建结果元素
    createResultElement(result, index) {
        const resultDiv = document.createElement('div');
        resultDiv.className = 'result-item';
        resultDiv.dataset.resultId = result.id;
        
        const isFavorited = this.isInFavorites(result.magnetUrl);
        
        resultDiv.innerHTML = `
            <div class="result-header">
                <input type="checkbox" class="result-checkbox" data-result-index="${index}">
                ${result.verified ? '<span class="verified-badge" title="已验证">✓</span>' : ''}
                ${result.quality ? `<span class="quality-badge">${result.quality}</span>` : ''}
            </div>
            
            <div class="result-image">
                📁
            </div>
            
            <div class="result-content">
                <h3 class="result-title" title="${result.title}">${result.title}</h3>
                <p class="result-subtitle">${result.subtitle || ''}</p>
                
                <div class="result-meta">
                    <span class="meta-item">
                        <span class="meta-icon">📦</span>
                        ${result.size || '未知'}
                    </span>
                    
                    <span class="meta-item">
                        <span class="meta-icon">📁</span>
                        ${result.fileCount || 1} 文件
                    </span>
                    
                    ${result.seeders !== undefined ? `
                        <span class="meta-item">
                            <span class="meta-icon">⬆️</span>
                            ${result.seeders} 种子
                        </span>
                    ` : ''}
                    
                    ${result.leechers !== undefined ? `
                        <span class="meta-item">
                            <span class="meta-icon">⬇️</span>
                            ${result.leechers} 下载
                        </span>
                    ` : ''}
                </div>
                
                ${result.uploadDate ? `
                    <div class="result-date">
                        上传时间: ${formatDate(result.uploadDate)}
                    </div>
                ` : ''}
                
                <div class="result-url">${this.truncateUrl(result.magnetUrl)}</div>
            </div>
            
            <div class="result-actions">
                <button class="action-btn visit-btn" onclick="app.openResult('${result.magnetUrl}')" title="打开磁力链接">
                    <span>🔗</span> 打开
                </button>
                
                <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                        onclick="app.toggleFavorite(this, ${index})" title="${isFavorited ? '取消收藏' : '添加收藏'}">
                    <span>${isFavorited ? '⭐' : '☆'}</span>
                </button>
                
                <button class="action-btn copy-btn" onclick="app.copyToClipboard('${result.magnetUrl}')" title="复制链接">
                    <span>📋</span>
                </button>
            </div>
        `;
        
        // 添加动画延迟
        resultDiv.style.animationDelay = `${index * 50}ms`;
        
        return resultDiv;
    }

    // 显示空结果
    displayEmptyResults(container, keyword) {
        container.innerHTML = `
            <div class="empty-state">
                <span>🔍</span>
                <h3>未找到相关结果</h3>
                <p>关键词 "${keyword}" 没有找到任何磁力链接</p>
                <div class="empty-suggestions">
                    <p>搜索建议：</p>
                    <ul>
                        <li>尝试使用更简洁的关键词</li>
                        <li>检查拼写是否正确</li>
                        <li>尝试使用英文关键词</li>
                        <li>使用更通用的搜索词</li>
                    </ul>
                </div>
                
                ${this.searchHistory.length > 0 ? `
                    <div class="recent-searches">
                        <p>最近搜索：</p>
                        <div class="history-tags">
                            ${this.searchHistory.slice(0, 5).map(item => 
                                `<button class="history-tag" onclick="app.searchFromHistory('${item.keyword}')">${item.keyword}</button>`
                            ).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 显示搜索错误
    displaySearchError(error) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="error-state">
                <span>⚠️</span>
                <h3>搜索出错</h3>
                <p>${error.message || '搜索过程中发生错误'}</p>
                <button class="btn btn-primary" onclick="location.reload()">重试</button>
            </div>
        `;
    }

    // 截断URL显示
    truncateUrl(url, maxLength = 80) {
        if (!url || url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    }

    // 设置无限滚动
    setupInfiniteScroll(container, results) {
        if (results.length < 20) return; // 结果太少不需要分页
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadMoreResults();
                }
            });
        });
        
        // 创建加载更多触发器
        const loadTrigger = document.createElement('div');
        loadTrigger.className = 'load-more-trigger';
        loadTrigger.innerHTML = '<div class="loading-indicator">正在加载更多...</div>';
        container.appendChild(loadTrigger);
        
        observer.observe(loadTrigger);
    }

    // 加载更多结果（分页）
    loadMoreResults() {
        // 实现分页加载逻辑
        console.log('加载更多结果...');
    }

    // 更新搜索UI状态
    updateSearchUI(isSearching) {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        
        if (searchBtn) {
            searchBtn.disabled = isSearching;
            searchBtn.innerHTML = isSearching ? 
                '<span class="spinner"></span> 搜索中...' : 
                '🔍 搜索';
        }
        
        if (searchInput) {
            searchInput.disabled = isSearching;
        }
    }

    // 处理搜索输入
    handleSearchInput(event) {
        const keyword = event.target.value.trim();
        
        if (keyword.length >= 2) {
            this.showSearchSuggestions(keyword);
        } else {
            this.hideSearchSuggestions();
        }
        
        // 实时搜索（防抖）
        if (keyword.length >= 3) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performInstantSearch(keyword);
            }, 1000);
        }
    }

    // 显示搜索建议
    showSearchSuggestions(keyword = '') {
        const suggestions = this.generateSearchSuggestions(keyword);
        const container = document.getElementById('searchSuggestions');
        
        if (!container || suggestions.length === 0) return;
        
        container.innerHTML = suggestions.map(suggestion => 
            `<div class="suggestion-item" onclick="app.selectSuggestion('${suggestion}')">${suggestion}</div>`
        ).join('');
        
        container.style.display = 'block';
    }

    // 隐藏搜索建议
    hideSearchSuggestions() {
        const container = document.getElementById('searchSuggestions');
        if (container) {
            container.style.display = 'none';
        }
    }

    // 生成搜索建议
    generateSearchSuggestions(keyword) {
        const suggestions = [];
        
        // 基于搜索历史的建议
        const historyMatches = this.searchHistory
            .filter(item => item.keyword.toLowerCase().includes(keyword.toLowerCase()))
            .slice(0, 5)
            .map(item => item.keyword);
        
        suggestions.push(...historyMatches);
        
        // 热门搜索建议
        const hotKeywords = ['电影', '电视剧', '动漫', '纪录片', '音乐', '软件', '游戏'];
        const hotMatches = hotKeywords
            .filter(item => item.includes(keyword))
            .slice(0, 3);
        
        suggestions.push(...hotMatches);
        
        // 去重
        return [...new Set(suggestions)].slice(0, 8);
    }

    // 选择搜索建议
    selectSuggestion(keyword) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = keyword;
            this.hideSearchSuggestions();
            this.performSearch(keyword);
        }
    }

    // 从历史记录搜索
    searchFromHistory(keyword) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.value = keyword;
            this.performSearch(keyword);
        }
    }

    // 即时搜索（预览）
    async performInstantSearch(keyword) {
        if (this.uiState.isSearching) return;
        
        try {
            // 检查缓存
            const cacheKey = `instant_${keyword}`;
            let results = this.searchCache.get(cacheKey);
            
            if (!results) {
                // 执行快速搜索（只搜索一个源）
                results = await this.searchSite1(keyword, { limit: 5 });
                this.searchCache.set(cacheKey, results);
            }
            
            // 显示预览结果
            this.showInstantResults(results, keyword);
            
        } catch (error) {
            console.error('即时搜索失败:', error);
        }
    }

    // 显示即时结果
    showInstantResults(results, keyword) {
        if (results.length === 0) return;
        
        const container = document.getElementById('instantResults');
        if (!container) return;
        
        container.innerHTML = `
            <div class="instant-header">
                <span>💡 即时预览 (${results.length} 个结果)</span>
                <button onclick="app.performSearch('${keyword}')">查看全部</button>
            </div>
            <div class="instant-list">
                ${results.map(result => `
                    <div class="instant-item" onclick="app.openResult('${result.magnetUrl}')">
                        <span class="instant-title">${result.title}</span>
                        <span class="instant-size">${result.size}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.style.display = 'block';
    }

    // 打开搜索结果
    openResult(magnetUrl) {
        if (!magnetUrl) return;
        
        try {
            // 记录点击行为
            if (authManager.isAuthenticated()) {
                API.recordAction('click_result', { 
                    magnetUrl: magnetUrl.substring(0, 100) + '...',
                    timestamp: Date.now()
                }).catch(console.error);
            }
            
            // 检查浏览器是否支持磁力链接
            if (this.isMagnetSupported()) {
                window.open(magnetUrl, '_blank');
            } else {
                // 显示磁力链接操作面板
                this.showMagnetPanel(magnetUrl);
            }
            
            showToast('正在打开磁力链接...', 'info');
            
        } catch (error) {
            console.error('打开链接失败:', error);
            showToast('打开链接失败', 'error');
        }
    }

    // 检查磁力链接支持
    isMagnetSupported() {
        return navigator.registerProtocolHandler !== undefined;
    }

    // 显示磁力链接面板
    showMagnetPanel(magnetUrl) {
        const modal = document.createElement('div');
        modal.className = 'modal magnet-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="this.closest('.modal').remove()">&times;</span>
                <h2>磁力链接</h2>
                <div class="magnet-info">
                    <p>请复制下面的磁力链接，然后在您的下载软件中添加：</p>
                    <div class="magnet-url-container">
                        <input type="text" class="magnet-url-input" value="${magnetUrl}" readonly>
                        <button class="copy-magnet-btn" onclick="app.copyToClipboard('${magnetUrl}'); this.textContent='已复制';">复制</button>
                    </div>
                    <div class="magnet-suggestions">
                        <h4>推荐下载工具：</h4>
                        <ul>
                            <li>qBittorrent (开源免费)</li>
                            <li>BitTorrent</li>
                            <li>Transmission</li>
                            <li>Deluge</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.add('show');
        
        // 自动选中链接文本
        const input = modal.querySelector('.magnet-url-input');
        input.select();
    }

    // 切换收藏状态
    toggleFavorite(button, resultIndex) {
        if (!authManager.isAuthenticated()) {
            showToast('请先登录以使用收藏功能', 'warning');
            this.showLoginModal();
            return;
        }
        
        const result = this.currentSearchResults[resultIndex];
        if (!result) return;
        
        const isFavorited = this.isInFavorites(result.magnetUrl);
        
        if (isFavorited) {
            this.removeFromFavorites(result.magnetUrl);
            button.classList.remove('favorited');
            button.querySelector('span').textContent = '☆';
            button.title = '添加收藏';
            showToast('已取消收藏', 'info');
        } else {
            this.addToFavorites(result);
            button.classList.add('favorited');
            button.querySelector('span').textContent = '⭐';
            button.title = '取消收藏';
            showToast('已添加到收藏夹', 'success');
        }
        
        // 同步到服务器
        this.syncFavorites();
    }

    // 检查是否在收藏夹中
    isInFavorites(magnetUrl) {
        return this.favorites.some(fav => fav.url === magnetUrl);
    }

    // 添加到收藏夹
    addToFavorites(result) {
        if (this.favorites.length >= (this.config.max_favorites || 1000)) {
            showToast(`收藏夹已满，最多支持 ${this.config.max_favorites} 个收藏`, 'warning');
            return;
        }
        
        const favorite = {
            id: Utils.generateId(),
            title: result.title,
            subtitle: result.subtitle || '',
            url: result.magnetUrl,
            icon: '🧲',
            keyword: document.getElementById('searchInput')?.value || '',
            size: result.size,
            category: result.category,
            addedAt: Date.now()
        };
        
        this.favorites.unshift(favorite);
        StorageManager.setItem('favorites', this.favorites);
        
        this.updateFavoritesDisplay();
        
        // 记录行为
        if (authManager.isAuthenticated()) {
            API.recordAction('add_favorite', {
                title: result.title,
                category: result.category
            }).catch(console.error);
        }
    }

    // 从收藏夹移除
    removeFromFavorites(magnetUrl) {
        this.favorites = this.favorites.filter(fav => fav.url !== magnetUrl);
        StorageManager.setItem('favorites', this.favorites);
        
        this.updateFavoritesDisplay();
    }

    // 复制到剪贴板
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // 降级方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'absolute';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
            
            showToast('已复制到剪贴板', 'success');
            
            // 记录行为
            if (authManager.isAuthenticated()) {
                API.recordAction('copy_link', {
                    linkType: text.startsWith('magnet:') ? 'magnet' : 'other'
                }).catch(console.error);
            }
            
        } catch (error) {
            console.error('复制失败:', error);
            showToast('复制失败，请手动复制', 'error');
        }
    }

    // 添加到搜索历史
    addToSearchHistory(keyword, resultCount) {
        // 移除重复项
        this.searchHistory = this.searchHistory.filter(item => item.keyword !== keyword);
        
        // 添加新记录到开头
        this.searchHistory.unshift({
            keyword: keyword,
            resultCount: resultCount,
            timestamp: Date.now()
        });
        
        // 限制历史记录数量
        const maxHistory = this.config.max_search_history || 1000;
        if (this.searchHistory.length > maxHistory) {
            this.searchHistory = this.searchHistory.slice(0, maxHistory);
        }
        
        StorageManager.setItem('search_history', this.searchHistory);
        this.updateHistoryDisplay();
    }

    // 更新历史记录显示
    updateHistoryDisplay() {
        const container = document.getElementById('searchHistory');
        if (!container) return;
        
        if (this.searchHistory.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span>📚</span>
                    <p>暂无搜索历史</p>
                    <small>开始搜索以建立历史记录</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="history-list">
                ${this.searchHistory.slice(0, 20).map(item => `
                    <div class="history-item" onclick="app.searchFromHistory('${item.keyword}')">
                        <span class="history-keyword">${item.keyword}</span>
                        <span class="history-meta">
                            ${item.resultCount} 个结果 • ${formatRelativeTime(item.timestamp)}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 更新收藏夹显示
    updateFavoritesDisplay() {
        const container = document.getElementById('favoritesContainer');
        if (!container) return;
        
        if (this.favorites.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span>⭐</span>
                    <p>收藏夹空空如也</p>
                    <small>搜索并收藏您感兴趣的内容</small>
                </div>
            `;
            return;
        }
        
        const favoritesGrid = document.createElement('div');
        favoritesGrid.className = 'favorites-grid';
        
        this.favorites.forEach(favorite => {
            const favoriteElement = this.createFavoriteElement(favorite);
            favoritesGrid.appendChild(favoriteElement);
        });
        
        container.innerHTML = '';
        container.appendChild(favoritesGrid);
    }

    // 创建收藏项元素
    createFavoriteElement(favorite) {
        const favoriteDiv = document.createElement('div');
        favoriteDiv.className = 'favorite-item';
        favoriteDiv.dataset.favoriteId = favorite.id;
        
        favoriteDiv.innerHTML = `
            <div class="favorite-content">
                <div class="favorite-title">
                    <span class="favorite-icon">${favorite.icon}</span>
                    <span class="favorite-name">${favorite.title}</span>
                </div>
                
                ${favorite.subtitle ? `<div class="favorite-subtitle">${favorite.subtitle}</div>` : ''}
                
                <div class="favorite-url">${this.truncateUrl(favorite.url)}</div>
                
                <div class="favorite-meta">
                    ${favorite.size ? `<div>大小: ${favorite.size}</div>` : ''}
                    ${favorite.category ? `<div>分类: ${favorite.category}</div>` : ''}
                    <div>添加时间: ${formatDate(favorite.addedAt)}</div>
                    ${favorite.keyword ? `<div>关键词: ${favorite.keyword}</div>` : ''}
                </div>
            </div>
            
            <div class="favorite-actions">
                <button class="action-btn visit-btn" onclick="app.openResult('${favorite.url}')" title="打开链接">
                    <span>🔗</span> 打开
                </button>
                <button class="action-btn copy-btn" onclick="app.copyToClipboard('${favorite.url}')" title="复制链接">
                    <span>📋</span> 复制
                </button>
                <button class="remove-btn" onclick="app.removeFavoriteById('${favorite.id}')" title="删除收藏">
                    <span>🗑️</span>
                </button>
            </div>
        `;
        
        return favoriteDiv;
    }

    // 通过ID删除收藏
    removeFavoriteById(favoriteId) {
        if (!confirm('确定要删除这个收藏吗？')) return;
        
        this.favorites = this.favorites.filter(fav => fav.id !== favoriteId);
        StorageManager.setItem('favorites', this.favorites);
        
        this.updateFavoritesDisplay();
        showToast('收藏已删除', 'info');
        
        // 同步到服务器
        this.syncFavorites();
    }

    // 清除搜索历史
    clearSearchHistory() {
        if (!confirm('确定要清除所有搜索历史吗？')) return;
        
        this.searchHistory = [];
        StorageManager.setItem('search_history', []);
        
        this.updateHistoryDisplay();
        showToast('搜索历史已清除', 'info');
        
        // 同步到服务器
        if (authManager.isAuthenticated()) {
            API.clearSearchHistory().catch(console.error);
        }
    }

    // 同步收藏夹
    async syncFavorites() {
        if (!authManager.isAuthenticated()) return;
        
        try {
            await API.syncFavorites(this.favorites);
            console.log('✅ 收藏夹同步成功');
        } catch (error) {
            console.error('收藏夹同步失败:', error);
        }
    }

    // 同步用户数据
    async syncUserData() {
        if (!authManager.isAuthenticated()) return;
        
        try {
            console.log('🔄 同步用户数据...');
            
            // 获取云端数据
            const [cloudFavorites, cloudHistory, userStats] = await Promise.allSettled([
                API.getFavorites(),
                API.getSearchHistory(),
                API.getUserStats()
            ]);
            
            // 合并收藏夹
            if (cloudFavorites.status === 'fulfilled') {
                this.mergeFavorites(cloudFavorites.value);
            }
            
            // 合并搜索历史
            if (cloudHistory.status === 'fulfilled') {
                this.mergeSearchHistory(cloudHistory.value);
            }
            
            // 更新用户统计
            if (userStats.status === 'fulfilled') {
                this.updateUserStats(userStats.value);
            }
            
            console.log('✅ 用户数据同步完成');
            
        } catch (error) {
            console.error('用户数据同步失败:', error);
        }
    }

    // 合并收藏夹
    mergeFavorites(cloudFavorites) {
        const mergedFavorites = [...this.favorites];
        
        cloudFavorites.forEach(cloudFav => {
            const exists = mergedFavorites.some(localFav => localFav.url === cloudFav.url);
            if (!exists) {
                mergedFavorites.push({
                    id: cloudFav.id,
                    title: cloudFav.title,
                    subtitle: cloudFav.subtitle,
                    url: cloudFav.url,
                    icon: cloudFav.icon || '🧲',
                    keyword: cloudFav.keyword,
                    addedAt: new Date(cloudFav.addedAt).getTime()
                });
            }
        });
        
        // 按添加时间排序
        mergedFavorites.sort((a, b) => b.addedAt - a.addedAt);
        
        this.favorites = mergedFavorites;
        StorageManager.setItem('favorites', this.favorites);
        this.updateFavoritesDisplay();
    }

    // 合并搜索历史
    mergeSearchHistory(cloudHistory) {
        const mergedHistory = [...this.searchHistory];
        
        cloudHistory.forEach(cloudItem => {
            const exists = mergedHistory.some(localItem => 
                localItem.keyword === cloudItem.keyword && 
                Math.abs(localItem.timestamp - cloudItem.timestamp) < 60000 // 1分钟内认为是同一次搜索
            );
            
            if (!exists) {
                mergedHistory.push({
                    keyword: cloudItem.keyword,
                    resultCount: cloudItem.resultsCount || 0,
                    timestamp: cloudItem.timestamp
                });
            }
        });
        
        // 按时间排序并限制数量
        mergedHistory.sort((a, b) => b.timestamp - a.timestamp);
        const maxHistory = this.config.max_search_history || 1000;
        
        this.searchHistory = mergedHistory.slice(0, maxHistory);
        StorageManager.setItem('search_history', this.searchHistory);
        this.updateHistoryDisplay();
    }

    // 更新用户统计
    updateUserStats(stats) {
        const statsElements = {
            totalFavorites: document.getElementById('statFavorites'),
            totalSearches: document.getElementById('statSearches'),
            totalLogins: document.getElementById('statLogins'),
            activeDays: document.getElementById('statActiveDays')
        };
        
        Object.keys(statsElements).forEach(key => {
            const element = statsElements[key];
            if (element && stats[key] !== undefined) {
                element.textContent = this.formatStatNumber(stats[key]);
            }
        });
    }

    // 格式化统计数字
    formatStatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    // 批量操作
    selectAllResults() {
        const checkboxes = document.querySelectorAll('.result-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            this.updateResultSelection(cb);
        });
        
        this.updateBatchActionButtons();
    }

    // 更新结果选择状态
    updateResultSelection(checkbox) {
        const resultIndex = parseInt(checkbox.dataset.resultIndex);
        const resultItem = checkbox.closest('.result-item');
        
        if (checkbox.checked) {
            resultItem.classList.add('selected');
            this.uiState.selectedResults.add(resultIndex);
        } else {
            resultItem.classList.remove('selected');
            this.uiState.selectedResults.delete(resultIndex);
        }
    }

    // 更新批量操作按钮
    updateBatchActionButtons() {
        const selectedCount = this.uiState.selectedResults.size;
        const batchActions = document.getElementById('batchActions');
        
        if (batchActions) {
            batchActions.style.display = selectedCount > 0 ? 'flex' : 'none';
            
            const countElement = batchActions.querySelector('.selected-count');
            if (countElement) {
                countElement.textContent = `已选择 ${selectedCount} 项`;
            }
        }
    }

    // 批量添加到收藏夹
    batchAddToFavorites() {
        if (!authManager.isAuthenticated()) {
            showToast('请先登录以使用收藏功能', 'warning');
            this.showLoginModal();
            return;
        }
        
        const selectedIndexes = Array.from(this.uiState.selectedResults);
        const selectedResults = selectedIndexes.map(index => this.currentSearchResults[index]);
        
        let addedCount = 0;
        selectedResults.forEach(result => {
            if (!this.isInFavorites(result.magnetUrl)) {
                this.addToFavorites(result);
                addedCount++;
            }
        });
        
        if (addedCount > 0) {
            showToast(`已添加 ${addedCount} 个收藏`, 'success');
            this.syncFavorites();
        } else {
            showToast('所选结果都已在收藏夹中', 'info');
        }
        
        // 清空选择
        this.clearSelection();
    }

    // 批量复制链接
    async batchCopyLinks() {
        const selectedIndexes = Array.from(this.uiState.selectedResults);
        const selectedResults = selectedIndexes.map(index => this.currentSearchResults[index]);
        
        const links = selectedResults.map(result => result.magnetUrl).join('\n');
        
        try {
            await this.copyToClipboard(links);
            showToast(`已复制 ${selectedResults.length} 个链接`, 'success');
        } catch (error) {
            showToast('批量复制失败', 'error');
        }
        
        // 清空选择
        this.clearSelection();
    }

    // 清空选择
    clearSelection() {
        this.uiState.selectedResults.clear();
        const checkboxes = document.querySelectorAll('.result-checkbox');
        const resultItems = document.querySelectorAll('.result-item');
        
        checkboxes.forEach(cb => cb.checked = false);
        resultItems.forEach(item => item.classList.remove('selected'));
        
        this.updateBatchActionButtons();
    }

    // 处理认证状态变化
    handleAuthStateChange(detail) {
        const { type, data } = detail;
        
        switch (type) {
            case 'login':
                this.currentUser = data;
                this.updateAuthUI(true);
                this.syncUserData();
                break;
                
            case 'logout':
                this.currentUser = null;
                this.updateAuthUI(false);
                this.clearUserData();
                break;
                
            case 'userUpdate':
                this.currentUser = data;
                this.updateUserInfo();
                break;
                
            case 'authRequired':
                this.showLoginModal();
                break;
                
            default:
                console.log('未处理的认证事件:', type);
        }
    }

    // 更新认证UI
    updateAuthUI(isAuthenticated) {
        const loginElements = document.querySelectorAll('.login-required');
        const logoutElements = document.querySelectorAll('.logout-required');
        const userElements = document.querySelectorAll('.user-only');
        const guestElements = document.querySelectorAll('.guest-only');
        
        loginElements.forEach(el => el.style.display = isAuthenticated ? 'none' : 'block');
        logoutElements.forEach(el => el.style.display = isAuthenticated ? 'block' : 'none');
        userElements.forEach(el => el.style.display = isAuthenticated ? 'block' : 'none');
        guestElements.forEach(el => el.style.display = isAuthenticated ? 'none' : 'block');
        
        // 更新用户信息显示
        this.updateUserInfo();
    }

    // 更新用户信息显示
    updateUserInfo() {
        const usernameElements = document.querySelectorAll('.username-display');
        const emailElements = document.querySelectorAll('.email-display');
        
        if (this.currentUser) {
            usernameElements.forEach(el => el.textContent = this.currentUser.username);
            emailElements.forEach(el => el.textContent = this.currentUser.email);
        } else {
            usernameElements.forEach(el => el.textContent = '');
            emailElements.forEach(el => el.textContent = '');
        }
    }

    // 清除用户数据
    clearUserData() {
        this.favorites = [];
        this.searchHistory = [];
        
        StorageManager.removeItem('favorites');
        StorageManager.removeItem('search_history');
        StorageManager.removeItem('user_settings');
        StorageManager.removeItem('user_stats');
        
        this.updateFavoritesDisplay();
        this.updateHistoryDisplay();
        
        console.log('🧹 用户数据已清除');
    }

    // 处理登录
    async handleLogin(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const username = formData.get('username')?.trim();
        const password = formData.get('password');
        const rememberMe = formData.has('rememberMe');
        
        if (!username || !password) {
            showToast('请填写用户名和密码', 'warning');
            return;
        }
        
        const result = await authManager.login(username, password, rememberMe);
        
        if (result.success) {
            this.hideModal('loginModal');
            
            // 如果有待处理的操作，执行它
            if (this.pendingAction) {
                this.pendingAction();
                this.pendingAction = null;
            }
        }
    }

    // 处理注册
    async handleRegister(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = {
            username: formData.get('username')?.trim(),
            email: formData.get('email')?.trim(),
            password: formData.get('password'),
            confirmPassword: formData.get('confirmPassword')
        };
        
        // 客户端验证
        const validation = FormValidator.validateAll(userData, {
            username: { type: 'username' },
            email: { type: 'email' },
            password: { type: 'password' }
        });
        
        if (!validation.valid) {
            const firstError = Object.values(validation.results).find(r => !r.valid);
            showToast(firstError.message, 'error');
            return;
        }
        
        if (userData.password !== userData.confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        const result = await authManager.register(userData);
        
        if (result.success) {
            this.hideModal('registerModal');
            this.showLoginModal();
            
            // 自动填充用户名
            const usernameInput = document.getElementById('loginUsername');
            if (usernameInput) {
                usernameInput.value = userData.username;
            }
        }
    }

    // 处理退出登录
    async handleLogout() {
        if (!confirm('确定要退出登录吗？')) return;
        
        await authManager.logout();
    }

    // 更新密码强度显示
    updatePasswordStrength(event) {
        const password = event.target.value;
        const strengthMeter = document.getElementById('passwordStrength');
        const strengthText = document.getElementById('passwordStrengthText');
        
        if (!strengthMeter || !strengthText) return;
        
        if (!password) {
            strengthMeter.style.display = 'none';
            return;
        }
        
        const strength = PasswordStrengthChecker.checkStrength(password);
        
        strengthMeter.style.display = 'block';
        strengthMeter.className = `password-strength strength-${strength.strength.replace(/\s/g, '').toLowerCase()}`;
        
        const progressBar = strengthMeter.querySelector('.strength-progress');
        if (progressBar) {
            progressBar.style.width = `${strength.percentage}%`;
        }
        
        strengthText.textContent = `密码强度: ${strength.strength}`;
        
        // 显示建议
        const suggestionsElement = document.getElementById('passwordSuggestions');
        if (suggestionsElement && strength.feedback.length > 0) {
            suggestionsElement.innerHTML = `
                <ul>
                    ${strength.feedback.slice(0, 3).map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            `;
            suggestionsElement.style.display = 'block';
        } else if (suggestionsElement) {
            suggestionsElement.style.display = 'none';
        }
    }

    // 显示登录模态框
    showLoginModal() {
        this.showModal('loginModal');
        
        // 自动填充记住的用户名
        const usernameInput = document.getElementById('loginUsername');
        const rememberedUsername = authManager.getRememberedUsername();
        
        if (usernameInput && rememberedUsername) {
            usernameInput.value = rememberedUsername;
            
            // 聚焦到密码输入框
            const passwordInput = document.getElementById('loginPassword');
            if (passwordInput) {
                setTimeout(() => passwordInput.focus(), 100);
            }
        } else if (usernameInput) {
            usernameInput.focus();
        }
    }

    // 显示注册模态框
    showRegisterModal() {
        this.showModal('registerModal');
        
        const usernameInput = document.getElementById('registerUsername');
        if (usernameInput) {
            setTimeout(() => usernameInput.focus(), 100);
        }
    }

    // 显示模态框
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
            
            // 点击外部关闭
            const modalContent = modal.querySelector('.modal-content');
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideModal(modalId);
                }
            });
            
            // ESC键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    this.hideModal(modalId);
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
        }
    }

    // 隐藏模态框
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            
            // 清空表单
            const form = modal.querySelector('form');
            if (form) {
                form.reset();
            }
            
            // 清空密码强度显示
            const strengthMeter = modal.querySelector('.password-strength');
            if (strengthMeter) {
                strengthMeter.style.display = 'none';
            }
        }
    }

    // 显示/隐藏区域
    showSection(sectionId) {
        const sections = document.querySelectorAll('.main-section');
        sections.forEach(section => {
            section.style.display = section.id === sectionId ? 'block' : 'none';
        });
        
        // 更新导航状态
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.target === sectionId);
        });
        
        this.uiState.currentView = sectionId;
        
        // 特殊处理
        switch (sectionId) {
            case 'favorites':
                this.updateFavoritesDisplay();
                break;
            case 'history':
                this.updateHistoryDisplay();
                break;
            case 'stats':
                this.loadUserStats();
                break;
        }
    }

    // 加载用户统计
    async loadUserStats() {
        if (!authManager.isAuthenticated()) return;
        
        try {
            const stats = await API.getUserStats();
            this.updateUserStats(stats);
            
            // 加载详细统计
            const detailedStats = await API.getDetailedStats();
            this.updateDetailedStats(detailedStats);
            
        } catch (error) {
            console.error('加载用户统计失败:', error);
        }
    }

    // 更新详细统计
    updateDetailedStats(stats) {
        // 更新图表数据（如果有图表库的话）
        console.log('详细统计数据:', stats);
        
        // 这里可以集成 Chart.js 或其他图表库来显示统计图表
        this.renderStatsCharts(stats);
    }

    // 渲染统计图表
    renderStatsCharts(stats) {
        // 搜索趋势图
        this.renderSearchTrendChart(stats.searchTrend);
        
        // 收藏分类饼图
        this.renderCategoryChart(stats.favoritesByCategory);
        
        // 热门关键词
        this.renderPopularKeywords(stats.popularKeywords);
    }

    // 渲染搜索趋势图
    renderSearchTrendChart(trendData) {
        const container = document.getElementById('searchTrendChart');
        if (!container || !trendData) return;
        
        // 简单的文本展示（可以用Chart.js替换）
        container.innerHTML = `
            <div class="simple-chart">
                <h4>最近7天搜索趋势</h4>
                <div class="chart-bars">
                    ${trendData.map(item => `
                        <div class="chart-bar" style="height: ${item.count / 10}%">
                            <div class="bar-value">${item.count}</div>
                            <div class="bar-label">${new Date(item.date).toLocaleDateString()}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 渲染分类图表
    renderCategoryChart(categoryData) {
        const container = document.getElementById('categoryChart');
        if (!container || !categoryData) return;
        
        container.innerHTML = `
            <div class="category-stats">
                <h4>收藏分类统计</h4>
                <div class="category-list">
                    ${Object.entries(categoryData).map(([category, count]) => `
                        <div class="category-item">
                            <span class="category-name">${category}</span>
                            <span class="category-count">${count}</span>
                            <div class="category-bar">
                                <div class="category-fill" style="width: ${count / Math.max(...Object.values(categoryData)) * 100}%"></div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 渲染热门关键词
    renderPopularKeywords(keywords) {
        const container = document.getElementById('popularKeywords');
        if (!container || !keywords) return;
        
        container.innerHTML = `
            <div class="popular-keywords">
                <h4>热门搜索关键词</h4>
                <div class="keyword-cloud">
                    ${keywords.map(item => `
                        <span class="keyword-tag size-${Math.min(5, Math.max(1, Math.round(item.count / 10)))}" 
                              onclick="app.performSearch('${item.keyword}')"
                              title="搜索 ${item.count} 次">
                            ${item.keyword}
                        </span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 导入数据
    importData() {
        if (!authManager.isAuthenticated()) {
            showToast('请先登录以使用数据导入功能', 'warning');
            this.showLoginModal();
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            try {
                showLoading(true, '正在导入数据...');
                
                const text = await file.text();
                const data = JSON.parse(text);
                
                if (!this.validateImportData(data)) {
                    throw new Error('导入数据格式不正确');
                }
                
                // 导入收藏夹
                if (data.favorites && Array.isArray(data.favorites)) {
                    const importedCount = this.importFavorites(data.favorites);
                    showToast(`成功导入 ${importedCount} 个收藏`, 'success');
                }
                
                // 导入搜索历史
                if (data.searchHistory && Array.isArray(data.searchHistory)) {
                    const importedCount = this.importSearchHistory(data.searchHistory);
                    showToast(`成功导入 ${importedCount} 条搜索历史`, 'success');
                }
                
                // 同步到服务器
                await this.syncFavorites();
                
                console.log('✅ 数据导入完成');
                
            } catch (error) {
                console.error('数据导入失败:', error);
                showToast(`数据导入失败: ${error.message}`, 'error');
            } finally {
                showLoading(false);
            }
        };
        
        input.click();
    }

    // 验证导入数据
    validateImportData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // 检查收藏夹数据格式
        if (data.favorites && !Array.isArray(data.favorites)) return false;
        
        if (data.favorites) {
            for (const fav of data.favorites) {
                if (!fav.title || !fav.url) return false;
            }
        }
        
        // 检查搜索历史数据格式
        if (data.searchHistory && !Array.isArray(data.searchHistory)) return false;
        
        if (data.searchHistory) {
            for (const item of data.searchHistory) {
                if (!item.keyword || !item.timestamp) return false;
            }
        }
        
        return true;
    }

    // 导入收藏夹
    importFavorites(importedFavorites) {
        let importedCount = 0;
        
        importedFavorites.forEach(imported => {
            // 检查是否已存在
            const exists = this.favorites.some(existing => existing.url === imported.url);
            
            if (!exists) {
                const favorite = {
                    id: imported.id || Utils.generateId(),
                    title: imported.title,
                    subtitle: imported.subtitle || '',
                    url: imported.url,
                    icon: imported.icon || '🧲',
                    keyword: imported.keyword || '',
                    size: imported.size || '',
                    category: imported.category || '',
                    addedAt: imported.addedAt || Date.now()
                };
                
                this.favorites.unshift(favorite);
                importedCount++;
            }
        });
        
        StorageManager.setItem('favorites', this.favorites);
        this.updateFavoritesDisplay();
        
        return importedCount;
    }

    // 导入搜索历史
    importSearchHistory(importedHistory) {
        let importedCount = 0;
        
        importedHistory.forEach(imported => {
            // 检查是否已存在
            const exists = this.searchHistory.some(existing => 
                existing.keyword === imported.keyword && 
                Math.abs(existing.timestamp - imported.timestamp) < 60000
            );
            
            if (!exists) {
                const historyItem = {
                    keyword: imported.keyword,
                    resultCount: imported.resultCount || 0,
                    timestamp: imported.timestamp
                };
                
                this.searchHistory.push(historyItem);
                importedCount++;
            }
        });
        
        // 排序并限制数量
        this.searchHistory.sort((a, b) => b.timestamp - a.timestamp);
        const maxHistory = this.config.max_search_history || 1000;
        this.searchHistory = this.searchHistory.slice(0, maxHistory);
        
        StorageManager.setItem('search_history', this.searchHistory);
        this.updateHistoryDisplay();
        
        return importedCount;
    }

    // 导出数据
    exportData() {
        if (!authManager.isAuthenticated()) {
            showToast('请先登录以使用数据导出功能', 'warning');
            this.showLoginModal();
            return;
        }
        
        try {
            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                user: {
                    username: this.currentUser?.username,
                    id: this.currentUser?.id
                },
                favorites: this.favorites,
                searchHistory: this.searchHistory,
                settings: StorageManager.getItem('user_settings', {}),
                stats: {
                    totalFavorites: this.favorites.length,
                    totalSearches: this.searchHistory.length,
                    exportTimestamp: Date.now()
                }
            };
            
            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `magnet_search_data_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            showToast('数据导出完成', 'success');
            
            // 记录导出行为
            API.recordAction('export_data', {
                favoritesCount: this.favorites.length,
                historyCount: this.searchHistory.length
            }).catch(console.error);
            
        } catch (error) {
            console.error('数据导出失败:', error);
            showToast('数据导出失败', 'error');
        }
    }

    // 处理网络恢复
    handleNetworkRestore() {
        // 重新测试API连接
        this.testAPIConnection();
        
        // 如果已登录，同步数据
        if (authManager.isAuthenticated()) {
            this.syncUserData();
        }
        
        // 清除离线标记
        document.body.classList.remove('offline');
    }

    // 处理网络断开
    handleNetworkLoss() {
        // 添加离线标记
        document.body.classList.add('offline');
        
        // 禁用需要网络的功能
        const networkRequiredElements = document.querySelectorAll('.network-required');
        networkRequiredElements.forEach(el => {
            el.disabled = true;
            el.title = '网络连接中断，该功能暂不可用';
        });
    }

    // 处理键盘快捷键
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + K: 聚焦搜索框
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Ctrl/Cmd + F: 切换到收藏夹
        if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !event.shiftKey) {
            event.preventDefault();
            this.showSection('favorites');
        }
        
        // Ctrl/Cmd + H: 切换到历史记录
        if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
            event.preventDefault();
            this.showSection('history');
        }
        
        // Ctrl/Cmd + Enter: 执行搜索
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.performSearch();
        }
        
        // ESC: 清空搜索框或关闭模态框
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                this.hideModal(openModal.id);
            } else {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value) {
                    searchInput.value = '';
                    searchInput.focus();
                }
            }
        }
    }

    // 处理页面可见性变化
    handleVisibilityChange() {
        if (document.hidden) {
            // 页面隐藏时，暂停某些活动
            this.pauseActivities();
        } else {
            // 页面显示时，恢复活动
            this.resumeActivities();
            
            // 检查认证状态
            if (authManager.isAuthenticated()) {
                authManager.verifyToken();
            }
        }
    }

    // 暂停活动
    pauseActivities() {
        // 暂停搜索建议更新
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        
        // 暂停统计更新
        if (this.statsUpdateTimer) {
            clearInterval(this.statsUpdateTimer);
        }
    }

    // 恢复活动
    resumeActivities() {
        // 恢复统计更新
        this.startStatsUpdate();
    }

    // 启动统计更新
    startStatsUpdate() {
        if (this.statsUpdateTimer) return;
        
        this.statsUpdateTimer = setInterval(async () => {
            if (authManager.isAuthenticated() && this.uiState.currentView === 'stats') {
                try {
                    const stats = await API.getUserStats();
                    this.updateUserStats(stats);
                } catch (error) {
                    console.error('更新统计失败:', error);
                }
            }
        }, 60000); // 每分钟更新一次
    }

    // 调试功能
    enableDebugMode() {
        window.app = this;
        window.authManager = authManager;
        window.API = API;
        window.StorageManager = StorageManager;
        
        console.log('🐛 调试模式已启用');
        console.log('可用对象: app, authManager, API, StorageManager');
        
        // 添加调试信息到页面
        const debugInfo = document.createElement('div');
        debugInfo.id = 'debugInfo';
        debugInfo.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
        `;
        
        this.updateDebugInfo(debugInfo);
        document.body.appendChild(debugInfo);
        
        // 定期更新调试信息
        setInterval(() => this.updateDebugInfo(debugInfo), 5000);
    }

    // 更新调试信息
    updateDebugInfo(element) {
        const info = {
            authenticated: authManager.isAuthenticated(),
            user: this.currentUser?.username || 'Guest',
            favorites: this.favorites.length,
            history: this.searchHistory.length,
            cacheSize: this.searchCache.size,
            currentView: this.uiState.currentView,
            selectedResults: this.uiState.selectedResults.size
        };
        
        element.innerHTML = Object.entries(info)
            .map(([key, value]) => `${key}: ${value}`)
            .join('<br>');
    }

    // 触发自定义事件
    dispatchEvent(type, data = null) {
        const event = new CustomEvent(`app_${type}`, {
            detail: { type, data, timestamp: Date.now() }
        });
        window.dispatchEvent(event);
    }

    // 获取应用状态
    getAppState() {
        return {
            initialized: this.isInitialized,
            user: this.currentUser,
            favorites: this.favorites.length,
            searchHistory: this.searchHistory.length,
            currentResults: this.currentSearchResults.length,
            uiState: { ...this.uiState },
            config: this.config,
            version: window.APP_VERSION || '1.0.0'
        };
    }

    // 重置应用状态
    resetApp() {
        if (!confirm('确定要重置所有数据吗？此操作不可撤销！')) return;
        
        try {
            // 清除所有本地数据
            StorageManager.clear();
            
            // 重置应用状态
            this.favorites = [];
            this.searchHistory = [];
            this.currentSearchResults = [];
            this.searchCache.clear();
            this.uiState.selectedResults.clear();
            
            // 退出登录
            if (authManager.isAuthenticated()) {
                authManager.logout('reset');
            }
            
            // 重新初始化
            setTimeout(() => {
                location.reload();
            }, 1000);
            
            showToast('应用已重置，即将刷新页面...', 'info');
            
        } catch (error) {
            console.error('重置应用失败:', error);
            showToast('重置失败，请手动刷新页面', 'error');
        }
    }
}

// 工具函数
function formatDate(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    if (diff < day) return `${Math.floor(diff / hour)}小时前`;
    if (diff < week) return `${Math.floor(diff / day)}天前`;
    
    return formatDate(timestamp);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 创建全局应用实例
const app = new MagnetSearchApp();

// 导出到全局作用域
window.app = app;

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📱 页面加载完成，开始初始化应用...');
    
    try {
        await app.init();
        
        // 开发环境启用调试模式
        if (window.location.hostname === 'localhost' || window.location.hostname.includes('.local')) {
            app.enableDebugMode();
        }
        
        console.log('🎉 磁力快搜应用初始化完成！');
        
    } catch (error) {
        console.error('💥 应用初始化失败:', error);
        showToast('应用初始化失败，请刷新页面重试', 'error');
    }
});

// 页面卸载前保存状态
window.addEventListener('beforeunload', () => {
    if (app.isInitialized) {
        // 保存当前搜索状态
        StorageManager.setItem('last_search', {
            keyword: document.getElementById('searchInput')?.value || '',
            results: app.currentSearchResults.slice(0, 10), // 只保存前10个结果
            timestamp: Date.now()
        });
        
        // 保存UI状态
        StorageManager.setItem('ui_state', {
            currentView: app.uiState.currentView,
            theme: document.documentElement.getAttribute('data-theme')
        });
    }
});

// 监听应用事件
window.addEventListener('app_initialized', () => {
    console.log('✅ 应用初始化事件触发');
    
    // 恢复上次的搜索状态
    const lastSearch = StorageManager.getItem('last_search');
    if (lastSearch && Date.now() - lastSearch.timestamp < 30 * 60 * 1000) { // 30分钟内
        const searchInput = document.getElementById('searchInput');
        if (searchInput && lastSearch.keyword) {
            searchInput.value = lastSearch.keyword;
            
            if (lastSearch.results && lastSearch.results.length > 0) {
                app.currentSearchResults = lastSearch.results;
                app.displaySearchResults(lastSearch.results, lastSearch.keyword);
                app.showSection('results');
            }
        }
    }
    
    // 恢复UI状态
    const uiState = StorageManager.getItem('ui_state');
    if (uiState) {
        if (uiState.currentView && uiState.currentView !== 'main') {
            app.showSection(uiState.currentView);
        }
        
        if (uiState.theme) {
            app.setTheme(uiState.theme);
        }
    }
});

// 错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    
    // 记录错误（如果已登录）
    if (authManager?.isAuthenticated()) {
        API.recordAction('client_error', {
            message: event.error.message,
            stack: event.error.stack?.substring(0, 500),
            url: window.location.href,
            userAgent: navigator.userAgent
        }).catch(console.error);
    }
});

// Promise错误处理
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
    
    // 如果是网络错误，显示友好提示
    if (event.reason?.message?.includes('fetch')) {
        showToast('网络连接出现问题，请检查网络后重试', 'warning');
    }
});

// 性能监控
if ('performance' in window && 'measure' in performance) {
    window.addEventListener('load', () => {
        setTimeout(() => {
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            
            console.log(`📊 页面加载时间: ${loadTime}ms`);
            
            // 记录性能数据
            if (authManager?.isAuthenticated()) {
                API.recordAction('performance', {
                    loadTime,
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0
                }).catch(console.error);
            }
        }, 1000);
    });
}

// PWA支持
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            console.log('🔧 Service Worker注册成功:', registration.scope);
        }).catch((error) => {
            console.log('Service Worker注册失败:', error);
        });
    });
}

// 导出类供其他模块使用
export { MagnetSearchApp };

