// Dashboard 应用逻辑
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
        try {
			
// 仅开发环境进行 .html 纠正，生产环境不处理
const isDev = (window.location.hostname === 'localhost' ||
               window.location.hostname === '127.0.0.1' ||
               window.location.port !== '' ||
               window.location.search.includes('dev=1'));

if (isDev && !window.location.pathname.endsWith('.html')) {
    console.log('开发环境修正URL到 .html 以便文件直开');
    window.location.replace('./dashboard.html' + window.location.search);
    return;
}
			
            showLoading(true);
            
            // 检查认证状态
            await this.checkAuth();
            
            // 绑定事件
            this.bindEvents();
            
            // 加载数据
            await this.loadData();
            
            // 初始化主题
            this.initTheme();
            
            this.isInitialized = true;
            console.log('✅ Dashboard初始化完成');
            
        } catch (error) {
        console.error('❌ Dashboard初始化失败:', error);
        showToast('初始化失败，请重新登录', 'error');
        
        // 使用replace避免重定向循环
        setTimeout(() => {
            window.location.replace('./index.html');
        }, 2000);
    } finally {
        showLoading(false);
    }
    }

    async checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            throw new Error('未找到认证token');
        }

        try {
            const result = await API.verifyToken(token);
            if (!result.success || !result.user) {
                throw new Error('Token验证失败');
            }
            
            this.currentUser = result.user;
            this.updateUserUI();
        } catch (error) {
            localStorage.removeItem('auth_token');
            throw new Error('认证失败');
        }
    }

    bindEvents() {
        // 标签切换
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 退出登录
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // 模态框事件
        this.bindModalEvents();

        // 设置表单事件
        this.bindSettingsEvents();
        
        // 密码修改按钮
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => this.changePassword());
        }

        // 数据操作按钮
        const syncAllDataBtn = document.getElementById('syncAllDataBtn');
        const exportDataBtn = document.getElementById('exportDataBtn');
        const exportFavoritesBtn = document.getElementById('exportFavoritesBtn');
        const clearHistoryBtn = document.getElementById('clearAllHistoryBtn');
        const clearAllDataBtn = document.getElementById('clearAllDataBtn');
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        const resetSettingsBtn = document.getElementById('resetSettingsBtn');
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');

        if (syncAllDataBtn) syncAllDataBtn.addEventListener('click', () => this.syncAllData());
        if (exportDataBtn) exportDataBtn.addEventListener('click', () => this.exportData());
        if (exportFavoritesBtn) exportFavoritesBtn.addEventListener('click', () => this.exportFavorites());
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
        if (clearAllDataBtn) clearAllDataBtn.addEventListener('click', () => this.clearAllData());
        if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => this.deleteAccount());
        if (resetSettingsBtn) resetSettingsBtn.addEventListener('click', () => this.resetSettings());
        if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => this.saveSettings());

        // 收藏夹搜索和排序
        const favoritesSearchBtn = document.getElementById('favoritesSearchBtn');
        const favoritesSearch = document.getElementById('favoritesSearch');
        const favoritesSort = document.getElementById('favoritesSort');
        
        if (favoritesSearchBtn) favoritesSearchBtn.addEventListener('click', () => this.searchFavorites());
        if (favoritesSearch) {
            favoritesSearch.addEventListener('input', debounce(() => this.searchFavorites(), 300));
            favoritesSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.searchFavorites();
            });
        }
        if (favoritesSort) favoritesSort.addEventListener('change', () => this.searchFavorites());
    }

    bindModalEvents() {
        const passwordModal = document.getElementById('passwordModal');
        const closeBtns = document.querySelectorAll('.close');
        const passwordForm = document.getElementById('passwordForm');

        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeModals());
        });

        if (passwordModal) {
            passwordModal.addEventListener('click', (e) => {
                if (e.target === passwordModal) this.closeModals();
            });
        }

        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }
    }

    bindSettingsEvents() {
        // 设置表单绑定
        const settingInputs = document.querySelectorAll('#settings input, #settings select');
        settingInputs.forEach(input => {
            input.addEventListener('change', () => {
                this.markSettingsChanged();
            });
        });
    }

    switchTab(tabName) {
        // 更新菜单状态
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.tab === tabName);
        });

        // 更新标签页内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        this.currentTab = tabName;
        this.loadTabData(tabName);
    }

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
            case 'settings':
                await this.loadSettingsData();
                break;
            case 'stats':
                await this.loadStatsData();
                break;
        }
    }

async loadData() {
    try {
        showLoading(true);
        const [favorites, history, settings] = await Promise.all([
            API.getFavorites(),
            API.getSearchHistory(),
            this.getUserSettings()
        ]);

        this.favorites = favorites;
        this.searchHistory = history;
        await this.loadTabData(this.currentTab);
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('无法加载数据，请检查网络连接', 'error');
    } finally {
        showLoading(false);
    }
}

// 修复后代码
async loadOverviewData() {
    try {
        showLoading(true);
        const searchStats = await API.getSearchStats();
        
        const totalSearchesEl = document.getElementById('totalSearches');
        const totalFavoritesEl = document.getElementById('totalFavorites');
        const activeDaysEl = document.getElementById('activeDays');
        const userLevelEl = document.getElementById('userLevel');

        if (totalSearchesEl) totalSearchesEl.textContent = searchStats.total || 0;
        if (totalFavoritesEl) totalFavoritesEl.textContent = this.favorites.length;
        
        const activeDays = this.calculateActiveDays();
        if (activeDaysEl) activeDaysEl.textContent = activeDays;
        
        const level = this.calculateUserLevel();
        if (userLevelEl) userLevelEl.textContent = level;

        await this.loadRecentActivity();
    } catch (error) {
        console.error('加载概览数据失败:', error);
        showToast('无法加载概览数据，请检查网络连接', 'error');
    } finally {
        showLoading(false);
    }
}



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
                    <button class="action-btn visit-btn" onclick="window.open('${this.escapeHtml(fav.url)}', '_blank')">
                        访问
                    </button>
                    <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }

    async loadHistoryData() {
        const historyList = document.getElementById('historyList');
        const historyCount = document.getElementById('historyCount');
        const uniqueKeywords = document.getElementById('uniqueKeywords');
        const avgPerDay = document.getElementById('avgPerDay');

        if (historyCount) historyCount.textContent = this.searchHistory.length;
        
        const unique = new Set(this.searchHistory.map(h => h.keyword)).size;
        if (uniqueKeywords) uniqueKeywords.textContent = unique;

        const daysActive = this.calculateActiveDays() || 1;
        if (avgPerDay) avgPerDay.textContent = Math.round(this.searchHistory.length / daysActive);

        if (!historyList) return;

        if (this.searchHistory.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <span style="font-size: 3rem;">🕐</span>
                    <p>暂无搜索历史</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = this.searchHistory.slice(0, 50).map(item => `
            <div class="history-item">
                <div class="history-content">
                    <div class="history-keyword">${this.escapeHtml(item.keyword)}</div>
                    <div class="history-time">${formatRelativeTime(item.timestamp)}</div>
                </div>
                <div class="history-actions">
                    <button class="action-btn" onclick="window.location.href='./index.html?q=${encodeURIComponent(item.keyword)}'">
                        重新搜索
                    </button>
                </div>
            </div>
        `).join('');
    }

//设置项映射（示例）
async loadSettingsData() {
try {
const s = await this.getUserSettings();
byId('autoSync').checked = s.autoSync !== false;
byId('enableCache').checked = s.cacheResults !== false;
byId('themeMode').value = s.theme || 'auto';
byId('maxFavorites').value = s.maxFavoritesPerUser ?? 500;
// historyRetention 与 maxHistoryPerUser 的映射策略根据你的产品规则设定
} catch (e) { console.error(e); }
}

    async loadStatsData() {
        // 这里可以实现更详细的统计图表
        console.log('加载统计数据');
    }

    async syncFavorites() {
        try {
            showLoading(true);
            await API.syncFavorites(this.favorites);
            showToast('收藏夹同步成功', 'success');
        } catch (error) {
            console.error('同步收藏失败:', error);
            showToast('同步失败: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async removeFavorite(favoriteId) {
        if (!confirm('确定要删除这个收藏吗？')) return;

        const index = this.favorites.findIndex(f => f.id === favoriteId);
        if (index >= 0) {
            this.favorites.splice(index, 1);
            await this.syncFavorites();
            await this.loadFavoritesData();
            showToast('收藏已删除', 'success');
        }
    }

    changePassword() {
        const modal = document.getElementById('passwordModal');
        if (modal) {
            modal.style.display = 'block';
            setTimeout(() => {
                const currentPassword = document.getElementById('currentPassword');
                if (currentPassword) currentPassword.focus();
            }, 100);
        }
    }

    async handlePasswordChange(event) {
        event.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            showToast('请填写所有字段', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast('新密码确认不一致', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showToast('新密码至少6个字符', 'error');
            return;
        }

    try {
        showLoading(true);
        
        // 调用正确的API方法
        const response = await API.changePassword(currentPassword, newPassword);
        
        if (response.success) {
            showToast('密码修改成功', 'success');
            this.closeModals();
            document.getElementById('passwordForm').reset();
        } else {
            throw new Error(response.message || '密码修改失败');
        }
    } catch (error) {
        showToast('密码修改失败: ' + error.message, 'error');
    } finally {
            showLoading(false);
        }
    }

async saveSettings() {
try {
const ui = this.collectSettings();
const payload = {
theme: ui.themeMode,
autoSync: !!ui.autoSync,
cacheResults: !!ui.enableCache,
maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10)
};
await this.updateUserSettings(payload);
showToast('设置保存成功', 'success');
this.markSettingsSaved();
} catch (e) {
showToast('保存设置失败: ' + e.message, 'error');
}
}

    collectSettings() {
        const settings = {};
        const settingInputs = document.querySelectorAll('#settings input, #settings select');
        
        settingInputs.forEach(input => {
            if (input.type === 'checkbox') {
                settings[input.id] = input.checked;
            } else {
                settings[input.id] = input.value;
            }
        });
        
        return settings;
    }

    markSettingsChanged() {
        const saveBtn = document.querySelector('#settings .btn-primary');
        if (saveBtn) {
            saveBtn.textContent = '保存设置*';
            saveBtn.classList.add('changed');
        }
    }

    markSettingsSaved() {
        const saveBtn = document.querySelector('#settings .btn-primary');
        if (saveBtn) {
            saveBtn.textContent = '保存设置';
            saveBtn.classList.remove('changed');
        }
    }

    calculateActiveDays() {
        if (this.searchHistory.length === 0) return 0;
        
        const dates = new Set(
            this.searchHistory.map(h => new Date(h.timestamp).toDateString())
        );
        return dates.size;
    }

    calculateUserLevel() {
        const totalActions = this.searchHistory.length + this.favorites.length;
        
        if (totalActions < 10) return '新手';
        if (totalActions < 50) return '熟练';
        if (totalActions < 200) return '专业';
        if (totalActions < 500) return '专家';
        return '大师';
    }

    async loadRecentActivity() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;

        // 合并最近的搜索和收藏活动
        const activities = [
            ...this.searchHistory.slice(0, 5).map(h => ({
                type: 'search',
                content: `搜索了 "${h.keyword}"`,
                time: h.timestamp,
                icon: '🔍'
            })),
            ...this.favorites.slice(0, 5).map(f => ({
                type: 'favorite',
                content: `收藏了 "${f.title}"`,
                time: new Date(f.addedAt).getTime(),
                icon: '⭐'
            }))
        ].sort((a, b) => b.time - a.time).slice(0, 10);

        if (activities.length === 0) {
            activityList.innerHTML = '<p class="empty-state">暂无活动记录</p>';
            return;
        }

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item">
                <span class="activity-icon">${activity.icon}</span>
                <div class="activity-content">
                    <div class="activity-text">${this.escapeHtml(activity.content)}</div>
                    <div class="activity-time">${formatRelativeTime(activity.time)}</div>
                </div>
            </div>
        `).join('');
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

    updateUserUI() {
        const username = document.getElementById('username');
        if (username && this.currentUser) {
            username.textContent = this.currentUser.username;
        }
    }

initTheme() {
    const defaultTheme = 'light'; // 直接使用默认主题
    const themeToggle = document.getElementById('themeToggle');
    document.documentElement.setAttribute('data-theme', defaultTheme);
    if (themeToggle) {
        themeToggle.textContent = defaultTheme === 'dark' ? '☀️' : '🌙';
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
    }

    closeModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    async logout() {
        if (confirm('确定要退出登录吗？')) {
            try {
                await API.logout();
                localStorage.removeItem('auth_token');
                showToast('已退出登录', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } catch (error) {
                console.error('退出登录失败:', error);
                // 即使API调用失败也清除本地token
                localStorage.removeItem('auth_token');
                window.location.href = 'index.html';
            }
        }
    }

    // API辅助方法
async getSearchHistory() {
    return await API.getSearchHistory();
}

    async getUserSettings() {
        try {
            return await API.getUserSettings();
        } catch (error) {
            // 返回默认设置
            return {
                autoSync: true,
                enableCache: true,
                themeMode: 'auto',
                historyRetention: '90',
                maxFavorites: '500',
                allowAnalytics: true,
                searchSuggestions: true
            };
        }
    }

    async updateUserSettings(settings) {
        try {
            return await API.updateUserSettings(settings);
        } catch (error) {
            // 本地保存设置
            StorageManager.setItem('user_settings', settings);
            throw error;
        }
    }

    // 数据操作方法
    async syncAllData() {
        try {
            showLoading(true);
            showToast('正在同步数据...', 'info');
            
            await Promise.all([
                this.syncFavorites(),
                this.syncHistory()
            ]);
            
            showToast('数据同步成功', 'success');
        } catch (error) {
            showToast('同步失败: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

    async syncHistory() {
        try {
            await API.syncSearchHistory(this.searchHistory);
        } catch (error) {
            console.error('同步历史失败:', error);
            throw error;
        }
    }

    async exportData() {
        try {
            const data = {
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
            a.download = `magnet-search-data-${new Date().toISOString().split('T')[0]}.json`;
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

    async exportFavorites() {
        try {
            const data = {
                favorites: this.favorites,
                exportTime: new Date().toISOString(),
                version: window.API_CONFIG?.APP_VERSION || '1.0.0'
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `favorites-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showToast('收藏导出成功', 'success');
        } catch (error) {
            console.error('导出收藏失败:', error);
            showToast('导出失败: ' + error.message, 'error');
        }
    }

// 修复后代码
async clearAllHistory() {
    if (!confirm('确定要清空所有搜索历史吗？此操作不可恢复。')) return;
    try {
        showLoading(true);
        await API.clearAllSearchHistory();
        this.searchHistory = [];
        await this.loadHistoryData();
        showToast('搜索历史已清空', 'success');
    } catch (error) {
        console.error('清空搜索历史失败:', error);
        showToast('清空失败: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

    async clearAllData() {
        if (!confirm('确定要清空所有本地数据吗？此操作不可恢复，建议先导出数据备份。')) return;
        if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

        try {
            showLoading(true);
            
            // 清空本地数据
            this.favorites = [];
            this.searchHistory = [];
            
            // 清空本地存储
            StorageManager.clear();
            
            // 重新加载数据
            await this.loadData();
            
            showToast('所有数据已清空', 'success');
        } catch (error) {
            showToast('清空失败: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    }

// 修复后代码
async deleteAccount() {
    const confirmText = '我确定要删除账户';
    const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
    
    if (userInput !== confirmText) {
        showToast('确认文本不匹配，取消删除', 'info');
        return;
    }

    try {
        showLoading(true);
        
        // 使用API类的封装方法
        const response = await API.deleteAccount();
        
        if (response.success) {
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

    resetSettings() {
        if (!confirm('确定要重置所有设置为默认值吗？')) return;

        // 重置为默认设置
        const defaultSettings = {
            autoSync: true,
            enableCache: true,
            themeMode: 'auto',
            historyRetention: '90',
            maxFavorites: '500',
            allowAnalytics: true,
            searchSuggestions: true
        };

        Object.entries(defaultSettings).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });

        this.markSettingsChanged();
        showToast('设置已重置为默认值', 'success');
    }

    searchFavorites() {
        const searchTerm = document.getElementById('favoritesSearch')?.value.toLowerCase() || '';
        const sortBy = document.getElementById('favoritesSort')?.value || 'date-desc';
        
        let filteredFavorites = this.favorites;

        // 搜索过滤
        if (searchTerm) {
            filteredFavorites = this.favorites.filter(fav => 
                fav.title.toLowerCase().includes(searchTerm) ||
                fav.subtitle.toLowerCase().includes(searchTerm) ||
                fav.keyword.toLowerCase().includes(searchTerm)
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

    renderFilteredFavorites(favorites) {
        const favoritesList = document.getElementById('favoritesList');
        if (!favoritesList) return;

        if (favorites.length === 0) {
            favoritesList.innerHTML = `
                <div class="empty-state">
                    <span style="font-size: 3rem;">🔍</span>
                    <p>没有找到匹配的收藏</p>
                </div>
            `;
            return;
        }

        favoritesList.innerHTML = favorites.map(fav => `
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
                    <button class="action-btn visit-btn" onclick="window.open('${this.escapeHtml(fav.url)}', '_blank')">
                        访问
                    </button>
                    <button class="action-btn remove-btn" onclick="app.removeFavorite('${fav.id}')">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }
}

// 导出到全局作用域
window.DashboardApp = DashboardApp;