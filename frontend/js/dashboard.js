// Dashboard应用逻辑 - 完整版本
(function() {
    'use strict';

    class DashboardApp {
        constructor() {
            this.currentUser = null;
            this.favorites = [];
            this.searchHistory = [];
            this.currentTab = 'overview';
            this.isInitialized = false;
            this.init();
        }

        async init() {
            console.log('📊 Dashboard 初始化...');
            
            try {
                // 检查用户认证
                this.currentUser = authManager.getCurrentUser();
                if (!this.currentUser) {
                    this.redirectToLogin();
                    return;
                }

                console.log(`👤 Dashboard 用户: ${this.currentUser.username}`);

                // 初始化UI
                this.initializeUI();
                
                // 加载数据
                await this.loadData();
                
                this.isInitialized = true;
                console.log('✅ Dashboard 初始化完成');

            } catch (error) {
                console.error('❌ Dashboard 初始化失败:', error);
                showToast('Dashboard 初始化失败: ' + error.message, 'error');
            }
        }

        // 重定向到登录页
        redirectToLogin() {
            showToast('请先登录', 'warning');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }

        // 初始化UI
        initializeUI() {
            this.bindEventListeners();
            this.updateUserInfo();
            this.switchTab('overview'); // 默认显示概览标签
        }

        // 绑定事件监听器
        bindEventListeners() {
            // 标签切换
            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const tabName = e.target.dataset.tab;
                    if (tabName) {
                        this.switchTab(tabName);
                    }
                });
            });

            // 退出登录按钮
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', async () => {
                    await authManager.logout();
                });
            }

            // 数据导出按钮
            const exportBtn = document.getElementById('exportData');
            if (exportBtn) {
                exportBtn.addEventListener('click', () => this.exportData());
            }

            // 数据导入按钮
            const importBtn = document.getElementById('importData');
            const importFile = document.getElementById('importFile');
            if (importBtn && importFile) {
                importBtn.addEventListener('click', () => importFile.click());
                importFile.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        this.importData(file);
                    }
                });
            }

            // 同步数据按钮
            const syncBtn = document.getElementById('syncData');
            if (syncBtn) {
                syncBtn.addEventListener('click', () => this.syncAllData());
            }

            // 清空数据按钮
            const clearBtn = document.getElementById('clearAllData');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearAllData());
            }

            // 删除账户按钮
            const deleteAccountBtn = document.getElementById('deleteAccount');
            if (deleteAccountBtn) {
                deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
            }

            // 保存设置按钮
            const saveSettingsBtn = document.getElementById('saveSettings');
            if (saveSettingsBtn) {
                saveSettingsBtn.addEventListener('click', () => this.saveSettings());
            }

            // 搜索收藏
            const favoritesSearch = document.getElementById('favoritesSearch');
            if (favoritesSearch) {
                favoritesSearch.addEventListener('input', debounce(() => {
                    this.searchFavorites();
                }, 300));
            }

            // 收藏排序
            const favoritesSort = document.getElementById('favoritesSort');
            if (favoritesSort) {
                favoritesSort.addEventListener('change', () => {
                    this.searchFavorites();
                });
            }

            // 主题切换按钮
            const themeToggle = document.getElementById('themeToggle');
            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    if (window.ConfigManager && window.ConfigManager.ThemeManager) {
                        const newTheme = window.ConfigManager.ThemeManager.toggleTheme();
                        showToast(`主题已切换为: ${newTheme}`, 'info');
                    }
                });
            }

            // 监听认证状态变化
            authManager.onAuthStateChanged((event) => {
                if (event.detail.type === 'logout') {
                    this.redirectToLogin();
                }
            });
        }

        // 切换标签
        switchTab(tabName) {
            this.currentTab = tabName;
            
            // 更新标签按钮状态
            const tabButtons = document.querySelectorAll('.tab-btn');
            tabButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            // 显示对应的标签内容
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}Tab`);
            });

            // 加载对应标签的数据
            this.loadTabData(tabName);
        }

        // 加载标签数据
        async loadTabData(tabName) {
            switch (tabName) {
                case 'overview':
                    await this.loadOverviewData();
                    break;
                case 'favorites':
                    await this.loadFavoritesData();
                    break;
                case 'history':
                    await this.loadHistoryData();
                    break;
                case 'stats':
                    await this.loadStatsData();
                    break;
                case 'settings':
                    await this.loadSettingsData();
                    break;
            }
        }

        // 加载所有数据
        async loadData() {
            try {
                showLoading(true, '加载数据中...');
                
                // 并行加载本地和云端数据
                await Promise.allSettled([
                    this.loadLocalData(),
                    this.loadCloudData()
                ]);

            } catch (error) {
                console.error('加载数据失败:', error);
                showToast('加载数据失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 加载本地数据
        loadLocalData() {
            try {
                this.favorites = UserIsolatedStorageManager.getItem('favorites', []);
                this.searchHistory = UserIsolatedStorageManager.getItem('search_history', []);
                console.log(`📚 本地数据已加载: ${this.favorites.length}个收藏, ${this.searchHistory.length}条历史`);
            } catch (error) {
                console.error('加载本地数据失败:', error);
                this.favorites = [];
                this.searchHistory = [];
            }
        }

        // 加载云端数据
        async loadCloudData() {
            if (!this.currentUser) return;

            try {
                const [cloudFavorites, cloudHistory] = await Promise.allSettled([
                    API.getFavorites(),
                    API.getSearchHistory()
                ]);

                // 处理收藏数据
                if (cloudFavorites.status === 'fulfilled' && cloudFavorites.value) {
                    const favorites = cloudFavorites.value;
                    if (favorites.length > 0) {
                        this.favorites = favorites;
                        UserIsolatedStorageManager.setItem('favorites', favorites);
                        console.log(`☁️ 云端收藏已加载: ${favorites.length}个`);
                    }
                }

                // 处理搜索历史数据
                if (cloudHistory.status === 'fulfilled' && cloudHistory.value) {
                    const history = cloudHistory.value;
                    if (history.length > 0) {
                        this.searchHistory = history;
                        UserIsolatedStorageManager.setItem('search_history', history);
                        console.log(`☁️ 云端历史已加载: ${history.length}条`);
                    }
                }

            } catch (error) {
                console.error('加载云端数据失败:', error);
                showToast('加载云端数据失败，使用本地数据', 'warning');
            }
        }

        // 加载概览数据
        async loadOverviewData() {
            try {
                // 基本统计
                const favoritesCount = document.getElementById('favoritesCount');
                const historyCount = document.getElementById('historyCount');
                const totalItems = document.getElementById('totalItems');

                if (favoritesCount) favoritesCount.textContent = this.favorites.length;
                if (historyCount) historyCount.textContent = this.searchHistory.length;
                if (totalItems) totalItems.textContent = this.favorites.length + this.searchHistory.length;

                // 用户等级计算
                const userLevel = document.getElementById('userLevel');
                if (userLevel) {
                    const totalActivity = this.favorites.length + this.searchHistory.length;
                    let level = '新手';
                    if (totalActivity >= 500) level = '大师';
                    else if (totalActivity >= 200) level = '专家';
                    else if (totalActivity >= 50) level = '专业';
                    else if (totalActivity >= 10) level = '熟练';
                    userLevel.textContent = level;
                }

                // 注册天数
                const memberDays = document.getElementById('memberDays');
                if (memberDays && this.currentUser) {
                    // 这里需要从用户信息中获取注册时间，暂时使用模拟数据
                    const joinDate = new Date('2024-01-01'); // 模拟注册时间
                    const days = Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
                    memberDays.textContent = days;
                }

                // 最近活动
                await this.loadRecentActivity();

                // 获取用户概览统计
                try {
                    const overview = await API.getUserOverview();
                    
                    // 更新统计数据
                    if (favoritesCount) favoritesCount.textContent = overview.favorites || this.favorites.length;
                    if (historyCount) historyCount.textContent = overview.searchHistory || this.searchHistory.length;
                    
                    if (userLevel) userLevel.textContent = overview.userLevel || '新手';
                    if (memberDays) memberDays.textContent = overview.daysSinceRegistration || 0;
                    
                } catch (error) {
                    console.warn('获取用户概览失败，使用本地数据:', error);
                }

            } catch (error) {
                console.error('加载概览数据失败:', error);
            }
        }

        // 加载最近活动
        async loadRecentActivity() {
            const recentActivityList = document.getElementById('recentActivity');
            if (!recentActivityList) return;

            try {
                const activities = [];

                // 最近的收藏
                this.favorites.slice(0, 3).forEach(fav => {
                    activities.push({
                        type: 'favorite',
                        time: new Date(fav.addedAt).getTime(),
                        description: `收藏了 "${fav.title}"`
                    });
                });

                // 最近的搜索
                this.searchHistory.slice(0, 3).forEach(search => {
                    activities.push({
                        type: 'search',
                        time: search.timestamp,
                        description: `搜索了 "${search.keyword}"`
                    });
                });

                // 按时间排序
                activities.sort((a, b) => b.time - a.time);

                if (activities.length === 0) {
                    recentActivityList.innerHTML = '<p class="empty-message">暂无最近活动</p>';
                    return;
                }

                recentActivityList.innerHTML = activities.slice(0, 5).map(activity => `
                    <div class="activity-item">
                        <span class="activity-icon">${activity.type === 'favorite' ? '⭐' : '🔍'}</span>
                        <div class="activity-content">
                            <div class="activity-description">${escapeHtml(activity.description)}</div>
                            <div class="activity-time">${formatRelativeTime(activity.time)}</div>
                        </div>
                    </div>
                `).join('');

            } catch (error) {
                console.error('加载最近活动失败:', error);
                if (recentActivityList) {
                    recentActivityList.innerHTML = '<p class="error-message">加载活动失败</p>';
                }
            }
        }

        // 加载收藏数据
        async loadFavoritesData() {
            const favoritesList = document.getElementById('favoritesList');
            if (!favoritesList) return;

            if (this.favorites.length === 0) {
                favoritesList.innerHTML = `
                    <div class="empty-state">
                        <span style="font-size: 3rem;">📌</span>
                        <p>暂无收藏</p>
                        <a href="index.html" class="btn-primary">去搜索</a>
                    </div>
                `;
                return;
            }

            favoritesList.innerHTML = this.favorites.map(fav => `
                <div class="favorite-item" data-id="${fav.id}">
                    <div class="favorite-content">
                        <div class="favorite-title">
                            <span class="favorite-icon">${fav.icon || '🎬'}</span>
                            <span class="favorite-name">${escapeHtml(fav.title)}</span>
                        </div>
                        <div class="favorite-subtitle">${escapeHtml(fav.subtitle || '')}</div>
                        <div class="favorite-url">${escapeHtml(fav.url)}</div>
                        <div class="favorite-meta">
                            <span>关键词: ${escapeHtml(fav.keyword || '')}</span>
                            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
                        </div>
                    </div>
                    <div class="favorite-actions">
                        <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')" title="访问">
                            访问
                        </button>
                        <button class="action-btn copy-btn" onclick="app.copyFavoriteUrl('${fav.id}')" title="复制链接">
                            复制
                        </button>
                        <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')" title="删除">
                            删除
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // 加载搜索历史数据
        async loadHistoryData() {
            const historyList = document.getElementById('historyList');
            const historyCountElement = document.getElementById('historyCount');
            const uniqueKeywords = document.getElementById('uniqueKeywords');
            const avgPerDay = document.getElementById('avgPerDay');

            try {
                // 获取搜索统计
                const stats = await API.getSearchStats();
                
                if (historyCountElement) historyCountElement.textContent = stats.total || 0;
                if (uniqueKeywords) uniqueKeywords.textContent = stats.topQueries?.length || 0;
                
                const daysActive = this.calculateActiveDays() || 1;
                if (avgPerDay) avgPerDay.textContent = Math.round((stats.total || 0) / daysActive);

                // 获取搜索历史列表
                const history = await API.getSearchHistory();
                this.searchHistory = history;

                if (!historyList) return;

                if (history.length === 0) {
                    historyList.innerHTML = `
                        <div class="empty-state">
                            <span style="font-size: 3rem;">🕐</span>
                            <p>暂无搜索历史</p>
                        </div>
                    `;
                    return;
                }

                historyList.innerHTML = history.slice(0, 50).map(item => `
                    <div class="history-item" data-id="${item.id}">
                        <div class="history-content">
                            <div class="history-keyword">${escapeHtml(item.keyword || item.query)}</div>
                            <div class="history-time">${formatRelativeTime(item.timestamp || item.created_at)}</div>
                            <div class="history-source">${item.source || 'unknown'}</div>
                        </div>
                        <div class="history-actions">
                            <button class="action-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword || item.query)}'">
                                重新搜索
                            </button>
                            <button class="action-btn remove-btn" onclick="app.removeHistoryItem('${item.id}')">
                                删除
                            </button>
                        </div>
                    </div>
                `).join('');

            } catch (error) {
                console.error('加载搜索历史失败:', error);
                if (historyList) {
                    historyList.innerHTML = `
                        <div class="error-state">
                            <span style="font-size: 3rem;">⚠️</span>
                            <p>加载搜索历史失败</p>
                            <button onclick="app.loadHistoryData()">重试</button>
                        </div>
                    `;
                }
            }
        }

        // 删除单条搜索历史
        async removeHistoryItem(historyId) {
            if (!confirm('确定要删除这条搜索记录吗？')) return;

            try {
                await API.deleteSearchHistory(historyId);
                showToast('搜索记录已删除', 'success');
                await this.loadHistoryData(); // 重新加载数据
            } catch (error) {
                console.error('删除搜索历史失败:', error);
                showToast('删除失败: ' + error.message, 'error');
            }
        }

        // 加载统计数据
        async loadStatsData() {
            try {
                const statsData = await API.getAnalyticsStats(30);
                
                // 更新统计图表区域
                const searchTrendChart = document.getElementById('searchTrendChart');
                const topKeywordsList = document.getElementById('topKeywordsList');
                const detailedStatsTable = document.getElementById('detailedStatsTable');

                if (searchTrendChart && statsData.dailyStats) {
                    this.renderSearchTrendChart(statsData.dailyStats, searchTrendChart);
                }

                if (topKeywordsList) {
                    this.renderTopKeywords(this.searchHistory, topKeywordsList);
                }

                if (detailedStatsTable) {
                    this.renderDetailedStats(statsData, detailedStatsTable);
                }

            } catch (error) {
                console.error('加载统计数据失败:', error);
                const chartElements = ['searchTrendChart', 'topKeywordsList', 'detailedStatsTable'];
                chartElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.innerHTML = `
                            <div class="error-state">
                                <p>统计数据加载失败</p>
                                <button onclick="app.loadStatsData()">重试</button>
                            </div>
                        `;
                    }
                });
            }
        }

        // 渲染搜索趋势图表
        renderSearchTrendChart(dailyStats, container) {
            if (!dailyStats || dailyStats.length === 0) {
                container.innerHTML = '<p>暂无搜索趋势数据</p>';
                return;
            }

            // 简单的文字统计显示（可以后续用图表库替换）
            const recentDays = dailyStats.slice(0, 7).reverse();
            const maxEvents = Math.max(...recentDays.map(d => d.events), 1);
            
            const chartHTML = `
                <div class="simple-chart">
                    <h4>最近7天搜索活动</h4>
                    ${recentDays.map(day => `
                        <div class="chart-bar">
                            <span class="bar-label">${day.date}</span>
                            <div class="bar-container">
                                <div class="bar-fill" style="width: ${(day.events / maxEvents) * 100}%"></div>
                                <span class="bar-value">${day.events}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            container.innerHTML = chartHTML;
        }

        // 渲染热门关键词
        renderTopKeywords(searchHistory, container) {
            if (!searchHistory || searchHistory.length === 0) {
                container.innerHTML = '<p>暂无关键词统计</p>';
                return;
            }

            // 统计关键词频率
            const keywordCounts = {};
            searchHistory.forEach(item => {
                const keyword = item.keyword || item.query;
                if (keyword) {
                    keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                }
            });

            // 转换为数组并排序
            const sortedKeywords = Object.entries(keywordCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);

            if (sortedKeywords.length === 0) {
                container.innerHTML = '<p>暂无搜索关键词统计</p>';
                return;
            }

            const keywordsHTML = sortedKeywords.map(([keyword, count], index) => `
                <div class="keyword-item">
                    <span class="keyword-rank">${index + 1}</span>
                    <span class="keyword-text">${escapeHtml(keyword)}</span>
                    <span class="keyword-count">${count}</span>
                </div>
            `).join('');

            container.innerHTML = keywordsHTML;
        }

        // 渲染详细统计表格
        renderDetailedStats(statsData, container) {
            const stats = [
                { metric: '总搜索次数', value: this.searchHistory.length, trend: '🔍' },
                { metric: '收藏数量', value: this.favorites.length, trend: '⭐' },
                { metric: '平均每天搜索', value: Math.round(this.searchHistory.length / Math.max(this.calculateActiveDays(), 1)), trend: '📊' },
                { metric: '最常搜索类型', value: '电影', trend: '🎬' }
            ];

            const tableHTML = stats.map(stat => `
                <tr>
                    <td>${stat.metric}</td>
                    <td>${stat.value}</td>
                    <td>${stat.trend}</td>
                </tr>
            `).join('');

            container.innerHTML = `
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>指标</th>
                            <th>数值</th>
                            <th>趋势</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableHTML}
                    </tbody>
                </table>
            `;
        }

        // 加载设置数据
        async loadSettingsData() {
            try {
                const settings = await API.getUserSettings();
                
                // 加载设置到表单
                Object.entries(settings).forEach(([key, value]) => {
                    const element = document.getElementById(key);
                    if (element) {
                        if (element.type === 'checkbox') {
                            element.checked = Boolean(value);
                        } else {
                            element.value = value;
                        }
                    }
                });
            } catch (error) {
                console.error('加载设置失败:', error);
                showToast('加载设置失败，使用默认设置', 'warning');
            }
        }

        // 保存设置
        async saveSettings() {
            try {
                showLoading(true, '保存设置中...');
                const settings = this.collectSettings();
                
                await API.updateUserSettings(settings);
                showToast('设置保存成功', 'success');
                this.markSettingsSaved();
            } catch (error) {
                console.error('保存设置失败:', error);
                showToast('保存设置失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 收集设置数据
        collectSettings() {
            const settings = {};
            const settingElements = document.querySelectorAll('#settingsTab input, #settingsTab select');
            
            settingElements.forEach(element => {
                if (element.type === 'checkbox') {
                    settings[element.id] = element.checked;
                } else {
                    settings[element.id] = element.value;
                }
            });
            
            return settings;
        }

        // 标记设置已保存
        markSettingsSaved() {
            const saveBtn = document.getElementById('saveSettings');
            if (saveBtn) {
                const originalText = saveBtn.textContent;
                saveBtn.textContent = '✓ 已保存';
                saveBtn.disabled = true;
                
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.disabled = false;
                }, 2000);
            }
        }

        // 搜索收藏
        searchFavorites() {
            const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
            const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';
            
            let filteredFavorites = [...this.favorites];

            // 搜索过滤
            if (searchTerm) {
                filteredFavorites = filteredFavorites.filter(fav => 
                    fav.title.toLowerCase().includes(searchTerm) ||
                    fav.subtitle?.toLowerCase().includes(searchTerm) ||
                    fav.keyword?.toLowerCase().includes(searchTerm)
                );
            }

            // 排序
            switch (sortBy) {
                case 'date-desc':
                    filteredFavorites.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
                    break;
                case 'date-asc':
                    filteredFavorites.sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
                    break;
                case 'name-asc':
                    filteredFavorites.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'name-desc':
                    filteredFavorites.sort((a, b) => b.title.localeCompare(a.title));
                    break;
            }

            // 更新显示
            this.renderFilteredFavorites(filteredFavorites);
        }

        // 渲染过滤后的收藏
        renderFilteredFavorites(favorites) {
            const favoritesList = document.getElementById('favoritesList');
            if (!favoritesList) return;

            if (favorites.length === 0) {
                favoritesList.innerHTML = `
                    <div class="empty-state">
                        <span style="font-size: 3rem;">🔍</span>
                        <p>未找到匹配的收藏</p>
                    </div>
                `;
                return;
            }

            favoritesList.innerHTML = favorites.map(fav => `
                <div class="favorite-item" data-id="${fav.id}">
                    <div class="favorite-content">
                        <div class="favorite-title">
                            <span class="favorite-icon">${fav.icon || '🎬'}</span>
                            <span class="favorite-name">${escapeHtml(fav.title)}</span>
                        </div>
                        <div class="favorite-subtitle">${escapeHtml(fav.subtitle || '')}</div>
                        <div class="favorite-url">${escapeHtml(fav.url)}</div>
                        <div class="favorite-meta">
                            <span>关键词: ${escapeHtml(fav.keyword || '')}</span>
                            <span>添加时间: ${formatRelativeTime(fav.addedAt)}</span>
                        </div>
                    </div>
                    <div class="favorite-actions">
                        <button class="action-btn visit-btn" onclick="window.open('${escapeHtml(fav.url)}', '_blank')">
                            访问
                        </button>
                        <button class="action-btn copy-btn" onclick="app.copyFavoriteUrl('${fav.id}')">
                            复制
                        </button>
                        <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
                            删除
                        </button>
                    </div>
                </div>
            `).join('');
        }

        // 更新用户信息显示
        updateUserInfo() {
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            const userAvatarElement = document.getElementById('userAvatar');

            if (this.currentUser) {
                if (userNameElement) userNameElement.textContent = this.currentUser.username;
                if (userEmailElement) userEmailElement.textContent = this.currentUser.email;
                if (userAvatarElement) {
                    userAvatarElement.src = authManager.getUserAvatar();
                }
            }
        }

        
        // 复制收藏URL
        async copyFavoriteUrl(favoriteId) {
            const favorite = this.favorites.find(fav => fav.id === favoriteId);
            if (!favorite) {
                showToast('收藏项不存在', 'error');
                return;
            }

            try {
                const success = await copyToClipboard(favorite.url);
                if (success) {
                    showToast('链接已复制到剪贴板', 'success');
                } else {
                    throw new Error('复制失败');
                }
            } catch (error) {
                console.error('复制收藏链接失败:', error);
                showToast('复制失败: ' + error.message, 'error');
            }
        }

        // 删除收藏
        async removeFavorite(favoriteId) {
            if (!confirm('确定要删除这个收藏吗？')) return;

            try {
                const index = this.favorites.findIndex(fav => fav.id === favoriteId);
                if (index === -1) {
                    showToast('收藏项不存在', 'error');
                    return;
                }

                this.favorites.splice(index, 1);
                UserIsolatedStorageManager.setItem('favorites', this.favorites);

                // 同步到云端
                await API.syncFavorites(this.favorites);

                showToast('收藏已删除', 'success');
                
                // 重新渲染收藏列表
                if (this.currentTab === 'favorites') {
                    this.searchFavorites(); // 重新应用过滤和排序
                } else {
                    await this.loadFavoritesData();
                }

            } catch (error) {
                console.error('删除收藏失败:', error);
                showToast('删除失败: ' + error.message, 'error');
            }
        }

        // 清空所有搜索历史
        async clearAllHistory() {
            if (!confirm('确定要清空所有搜索历史吗？此操作不可恢复。')) return;

            try {
                showLoading(true, '清空历史中...');
                await API.clearSearchHistory();
                this.searchHistory = [];
                UserIsolatedStorageManager.setItem('search_history', []);
                await this.loadHistoryData();
                showToast('搜索历史已清空', 'success');
            } catch (error) {
                console.error('清空搜索历史失败:', error);
                showToast('清空失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 数据同步
        async syncAllData() {
            try {
                showLoading(true, '正在同步数据...');
                showToast('正在同步数据...', 'info');
                
                // 确保有最新的本地数据
                const localFavorites = UserIsolatedStorageManager.getItem('favorites', []);
                const localHistory = UserIsolatedStorageManager.getItem('search_history', []);

                await Promise.all([
                    API.syncFavorites(localFavorites),
                    API.syncSearchHistory(localHistory)
                ]);
                
                // 重新加载显示
                await this.loadData();
                showToast('数据同步成功', 'success');
            } catch (error) {
                console.error('数据同步失败:', error);
                showToast('同步失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 清空所有数据
        async clearAllData() {
            if (!confirm('确定要清空所有本地数据吗？此操作不可恢复，建议先导出数据备份。')) return;
            if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

            try {
                showLoading(true, '清空数据中...');
                
                // 清空内存中的数据
                this.favorites = [];
                this.searchHistory = [];
                
                // 使用用户隔离的存储清理
                UserIsolatedStorageManager.clearUserData();
                
                // 清空云端数据
                await Promise.allSettled([
                    API.clearSearchHistory(),
                    API.syncFavorites([])
                ]);
                
                // 重新加载数据
                await this.loadData();
                
                showToast('您的数据已清空', 'success');
            } catch (error) {
                console.error('清空数据失败:', error);
                showToast('清空失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 删除账户
        async deleteAccount() {
            const confirmText = '我确定要删除账户';
            const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
            
            if (userInput !== confirmText) {
                showToast('确认文本不匹配，取消删除', 'info');
                return;
            }

            try {
                showLoading(true, '删除账户中...');
                
                // 先清空用户数据
                await Promise.allSettled([
                    API.clearSearchHistory(),
                    API.syncFavorites([])
                ]);
                
                // 清空本地数据
                UserIsolatedStorageManager.clearUserData();
                
                // 删除账户
                const response = await API.request('/api/auth/delete-account', {
                    method: 'POST'
                });
                
                if (response.success) {
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('current_user');
                    
                    showToast('账户已删除', 'success');
                    
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 2000);
                } else {
                    throw new Error(response.message || '删除账户失败');
                }
            } catch (error) {
                console.error('删除账户失败:', error);
                showToast('删除失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 导出数据
        async exportData() {
            try {
                const userId = this.currentUser?.id;
                if (!userId) {
                    throw new Error('用户未登录');
                }

                const data = {
                    userId: userId,
                    username: this.currentUser.username,
                    favorites: this.favorites,
                    searchHistory: this.searchHistory,
                    settings: this.collectSettings(),
                    exportTime: new Date().toISOString(),
                    version: window.API_CONFIG?.APP_VERSION || '1.0.0'
                };

                const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json'
                });

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `magnet-search-data-${userId}-${new Date().toISOString().split('T')[0]}.json`;
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

        // 导入数据
        async importData(file) {
            try {
                showLoading(true, '导入数据中...');
                
                const text = await file.text();
                const data = JSON.parse(text);

                // 验证数据格式
                if (!data.userId || !data.favorites || !data.searchHistory) {
                    throw new Error('数据格式不正确');
                }

                if (data.userId !== this.currentUser?.id) {
                    const confirmed = confirm(`导入的数据属于用户 "${data.username || data.userId}"，与当前用户不匹配。确定要继续导入吗？`);
                    if (!confirmed) return;
                }

                // 合并数据
                const existingUrls = new Set(this.favorites.map(fav => fav.url));
                const existingKeywords = new Set(this.searchHistory.map(item => item.keyword));

                let importedFavorites = 0;
                let importedHistory = 0;

                // 导入收藏（去重）
                if (Array.isArray(data.favorites)) {
                    data.favorites.forEach(fav => {
                        if (fav.url && !existingUrls.has(fav.url)) {
                            this.favorites.push({
                                ...fav,
                                id: generateId('fav_'),
                                addedAt: fav.addedAt || new Date().toISOString()
                            });
                            importedFavorites++;
                        }
                    });
                }

                // 导入搜索历史（去重）
                if (Array.isArray(data.searchHistory)) {
                    data.searchHistory.forEach(item => {
                        const keyword = item.keyword || item.query;
                        if (keyword && !existingKeywords.has(keyword)) {
                            this.searchHistory.push({
                                ...item,
                                id: generateId('history_'),
                                keyword: keyword,
                                timestamp: item.timestamp || Date.now()
                            });
                            importedHistory++;
                        }
                    });
                }

                // 保存到本地
                UserIsolatedStorageManager.setItem('favorites', this.favorites);
                UserIsolatedStorageManager.setItem('search_history', this.searchHistory);

                // 同步到云端
                await Promise.allSettled([
                    API.syncFavorites(this.favorites),
                    API.syncSearchHistory(this.searchHistory)
                ]);

                // 重新加载当前标签
                await this.loadTabData(this.currentTab);

                showToast(`数据导入成功！导入 ${importedFavorites} 个收藏，${importedHistory} 条搜索历史`, 'success');

            } catch (error) {
                console.error('导入数据失败:', error);
                showToast('导入失败: ' + error.message, 'error');
            } finally {
                showLoading(false);
            }
        }

        // 计算活跃天数
        calculateActiveDays() {
            if (this.searchHistory.length === 0) return 0;

            const timestamps = this.searchHistory.map(item => item.timestamp || 0);
            const firstSearch = Math.min(...timestamps);
            const lastSearch = Math.max(...timestamps);

            if (firstSearch === 0 || lastSearch === 0) return 0;

            return Math.max(1, Math.ceil((lastSearch - firstSearch) / (1000 * 60 * 60 * 24)));
        }

        // HTML转义工具函数
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

        // 应用销毁时的清理
        destroy() {
            console.log('🔄 Dashboard 已销毁');
        }
    }

    // 页面加载完成后初始化Dashboard
    document.addEventListener('DOMContentLoaded', () => {
        // 创建全局Dashboard实例
        window.app = new DashboardApp();
        
        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            if (window.app) {
                window.app.destroy();
            }
        });
    });

    console.log('✅ Dashboard应用已加载完成');

})();
