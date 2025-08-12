class DashboardApp {
    constructor() {
        // 获取全局单例
        this.authManager = authManager;
        this.utils = utils;
        this.API = API;
        
        // 当前用户信息
        this.currentUser = this.authManager.getCurrentUser();
        
        // 初始化
        this.initUserInfo();
        this.bindEvents();
        this.loadDashboardData();
        this.loadSettings();
    }
    
    // 初始化用户信息
    initUserInfo() {
        if (this.currentUser) {
            const usernameEl = document.getElementById('username');
            if (usernameEl) {
                usernameEl.textContent = this.currentUser.username;
            }
        }
    }
    
    // 绑定事件
    bindEvents() {
        // 侧边栏菜单点击
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = item.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // 登出按钮
        const logoutBtn = document.getElementById('logoutBtn');
        if (logout极速搜索-磁力快搜) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.logout();
            });
        }
        
        // 主题切换按钮
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        // 修改密码表单提交
        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }
        
        // 关闭模态框按钮
        const closeModal = document.querySelector('.modal .close');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal('passwordModal');
            });
        }
        
        // 同步按钮
        const syncButtons = [
            { id: 'syncFavorites', method: this.syncFavorites },
            { id: 'syncHistory', method: this.syncHistory }
        ];
        
        syncButtons.forEach(btn => {
            const element = document.getElementById(btn.id);
            if (element) {
                element.addEventListener('click', btn.method.bind(this));
            }
        });
        
        // 清空历史按钮
        const clearHistoryBtn = document.getElementById('clearAllHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.clearAllHistory();
            });
        }
    }
    
    // 切换标签页
    switchTab(tabName) {
        // 隐藏所有标签页
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // 移除所有菜单项激活状态
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 显示目标标签页
        const targetTab = document.getElementById(tabName);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // 激活对应菜单项
        const menuItem = document.querySelector(`.menu-item[data-tab="${tabName}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }
        
        // 按需加载数据
        switch(tabName) {
            case 'favorites':
                this.loadFavorites();
                break;
            case 'history':
                this.loadHistory();
                break;
            case 'stats':
                this.loadStats();
                break;
        }
    }
    
    // 加载仪表盘数据
    async loadDashboardData() {
        if (!this.currentUser) return;
        
        this.showLoading(true);
        
        try {
            // 获取用户统计信息
            const response = await this.API.getUserStats();
            
            if (response.success) {
                // 更新统计卡片
                this.updateStatCard('totalSearches', response.data.totalSearches);
                this.updateStatCard('totalFavorites', response.data.totalFavorites);
                this.updateStatCard('activeDays', response.data.activeDays);
                this.updateStatCard('userLevel', response.data.userLevel);
                
                // 渲染最近活动
                this.renderRecentActivities(response.data.recentActivities);
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('加载仪表盘数据失败:', error);
            this.utils.showToast('加载数据失败，请重试', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 更新统计卡片
    updateStatCard(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }
    
    // 渲染最近活动
    renderRecentActivities(activities) {
        const container = document.getElementById('activityList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!activities || activities.length === 0) {
            container.innerHTML = '<p class="empty-activity">暂无最近活动</p>';
            return;
        }
        
        activities.forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = 'activity-item';
            
            const iconMap = {
                'search': '🔍🔍',
                'favorite': '⭐',
                'login': '🔑🔑',
                'logout': '🚪🚪'
            };
            
            activityElement.innerHTML = `
                <div class="activity-icon">${iconMap[activity.action] || '⚡⚡'}</div>
                <div class="activity-content">
                    <div class="activity-title">${activity.title}</div>
                    <div class="activity-desc">${activity.description}</div>
                </div>
                <div class="activity-time">${this.utils.formatRelativeTime(activity.timestamp)}</div>
            `;
            
            container.appendChild(activityElement);
        });
    }
    
    // 加载收藏夹
    async loadFavorites() {
        if (!this.currentUser) return;
        
        this.showLoading(true);
        
        try {
            const response = await this.API.getFavorites();
            
            if (response.success) {
                this.renderFavorites(response.favorites);
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('加载收藏夹失败:', error);
            this.utils.showToast('加载收藏夹失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 渲染收藏夹
    renderFavorites(favorites) {
        const container = document.getElementById('favoritesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!favorites || favorites.length === 0) {
            container.innerHTML = '<p class="empty-favorites">暂无收藏项目</p>';
            return;
        }
        
        favorites.forEach(fav => {
            const favoriteItem = document.createElement('div');
            favoriteItem.className = 'favorite-item';
            favoriteItem.innerHTML = `
                <div class="favorite-header">
                    <div class="favorite-icon">${fav.icon || '⭐'}</div>
                    <div class="favorite-title">${this.utils.escapeHtml(fav.title)}</div>
                    <div class="favorite-actions">
                        <button class="btn-icon" onclick="app.removeFavorite('${fav.id}')">🗑️</button>
                    </div>
                </div>
                <div class="favorite-body">
                    <div class="favorite-keyword">${this.utils.escapeHtml(fav.keyword || '无关键词')}</div>
                    <div class="favorite-url">${this.utils.escapeHtml(fav.url)}</div>
                    <div class="favorite-notes">${this.utils.escapeHtml(fav.notes || '无备注信息')}</div>
                </div>
                <div class="favorite-footer">
                    <span>添加于: ${this.utils.formatDate(fav.createdAt)}</span>
                    <span>更新: ${this.utils.formatRelativeTime(fav.updatedAt)}</span>
                </div>
            `;
            
            // 点击打开链接
            favoriteItem.addEventListener('click', (e) => {
                if (!e.target.closest('.favorite-actions')) {
                    window.open(fav.url, '_blank');
                }
            });
            
            container.appendChild(favoriteItem);
        });
    }
    
    // 移除收藏
    async removeFavorite(favoriteId) {
        if (!confirm('确定要移除这个收藏吗？')) return;
        
        try {
            const response = await this.API.removeFavorite(favoriteId);
            
            if (response.success) {
                this.utils.showToast('收藏已移除', 'success');
                this.loadFavorites(); // 刷新列表
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('移除收藏失败:', error);
            this.utils.showToast('移除收藏失败', 'error');
        }
    }
    
    // 同步收藏
    async syncFavorites() {
        this.utils.showToast('开始同步收藏...', 'info');
        
        try {
            const response = await this.API.syncFavorites();
            
            if (response.success) {
                this.utils.showToast('收藏同步完成', 'success');
                this.loadFavorites(); // 刷新列表
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('同步收藏失败:', error);
            this.utils.showToast('同步收藏失败', 'error');
        }
    }
    
    // 加载历史记录
    async loadHistory() {
        if (!this.currentUser) return;
        
        this.showLoading(true);
        
        try {
            const response = await this.API.getSearchHistory();
            
            if (response.success) {
                this.renderHistory(response.history);
                this.updateHistoryStats(response.stats);
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.utils.showToast('加载历史记录失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 渲染历史记录
    renderHistory(historyList) {
        const container = document.getElementById('historyList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!historyList || historyList.length === 0) {
            container.innerHTML = '<p class="empty-history">暂无搜索历史</p>';
            return;
        }
        
        historyList.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-keyword">${this.utils.escapeHtml(item.keyword)}</div>
                <div class="history-results">结果: ${item.resultsCount}</div>
                <div class="history-time">${this.utils.formatDate(item.createdAt)}</div>
            `;
            
            // 点击重新搜索
            historyItem.addEventListener('click', () => {
                window.location.href = `index.html?q=${encodeURIComponent(item.keyword)}`;
            });
            
            container.appendChild(historyItem);
        });
    }
    
    // 更新历史统计
    updateHistoryStats(stats) {
        if (!stats) return;
        
        const updateElement = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        };
        
        updateElement('historyCount', stats.totalSearches);
        updateElement('uniqueKeywords', stats.uniqueKeywords);
        updateElement('avgPerDay', stats.avgPerDay.toFixed(1));
    }
    
    // 清空历史
    async clearAllHistory() {
        if (!confirm('确定要清空所有历史记录吗？此操作不可恢复！')) return;
        
        try {
            const response = await this.API.clearSearchHistory();
            
            if (response.success) {
                this.utils.showToast('历史记录已清空', 'success');
                this.loadHistory(); // 刷新列表
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('清空历史失败:', error);
            this.utils.showToast('清空历史失败', 'error');
        }
    }
    
    // 同步历史
    async syncHistory() {
        this.utils.showToast('开始同步历史记录...', 'info');
        
        try {
            const response = await this.API.syncSearchHistory();
            
            if (response.success) {
                this.utils.showToast('历史记录同步完成', 'success');
                this.loadHistory(); // 刷新列表
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('同步历史失败:', error);
            this.utils.showToast('同步历史失败', 'error');
        }
    }
    
    // 加载设置
    loadSettings() {
        try {
            // 从本地存储加载设置
            const settings = this.utils.storage.get('userSettings') || {};
            
            // 应用设置到UI
            if (settings.autoSync !== undefined) {
                document.getElementById('autoSync').checked = settings.autoSync;
            }
            
            if (settings.enableCache !== undefined) {
                document.getElementById('enableCache').checked = settings.enableCache;
            }
            
            if (settings.themeMode) {
                document.getElementById('theme极速搜索-磁力快搜').value = settings.themeMode;
            }
            
            if (settings.maxFavorites) {
                document.getElementById('maxFavorites').value = settings.maxFavorites;
            }
            
            if (settings.historyRetention) {
                document.getElementById('historyRetention').value = settings.historyRetention;
            }
            
            if (settings.allowAnalytics !== undefined) {
                document.getElementById('allowAnalytics').checked = settings.allowAnalytics;
            }
            
            if (settings.searchSuggestions !== undefined) {
                document.getElementById('searchSuggestions').checked = settings.searchSuggestions;
            }
            
            // 应用搜索源设置
            if (settings.searchSources) {
                settings.searchSources.forEach(source => {
                    const checkbox = document.querySelector(`input[value="${source}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                    }
                });
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }
    
    // 保存设置
    async saveSettings() {
        try {
            const settings = {
                autoSync: document.getElementById('autoSync').checked,
                enableCache: document.getElementById('enableCache').checked,
                themeMode: document.getElementById('themeMode').value,
                maxFavorites: parseInt(document.getElementById('maxFavorites').value),
                historyRetention: document.getElementById('historyRetention').value,
                allowAnalytics: document.getElementById('allowAnalytics').checked,
                searchSuggestions: document.getElementById('searchSuggestions').checked,
                searchSources: Array.from(document.querySelectorAll('.checkbox-group input:checked'))
                    .map(input => input.value)
            };
            
            // 保存到本地存储
            this.utils.storage.set('userSettings', settings);
            
            // 保存到服务器
            if (this.currentUser) {
                const response = await this.API.updateUserSettings(settings);
                if (response.success) {
                    this.utils.showToast('设置已保存', 'success');
                } else {
                    this.utils.showToast(response.message, 'error');
                }
            } else {
                this.utils.showToast('设置已保存到本地，登录后将同步到云端', 'info');
            }
        } catch (error) {
            console.error('保存设置失败:', error);
            this.utils.showToast('保存设置失败', 'error');
        }
    }
    
    // 修改密码
    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmNewPassword').value;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.utils.showToast('请填写所有字段', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            this.utils.showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        try {
            const response = await this.API.changePassword(currentPassword, newPassword);
            
            if (response.success) {
                this.utils.showToast('密码修改成功', 'success');
                this.closeModal('passwordModal');
                // 清空表单
                document.getElementById('passwordForm').reset();
            } else {
                this.utils.showToast(response.message || '密码修改失败', 'error');
            }
        } catch (error) {
            console.error('修改密码失败:', error);
            this.utils.showToast('修改密码失败', 'error');
        }
    }
    
    // 加载统计数据
    async loadStats() {
        if (!this.currentUser) return;
        
        this.showLoading(true);
        
        try {
            const response = await this.API.getUserStats();
            
            if (response.success) {
                this.renderStats(response.stats);
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
            this.utils.showToast('加载统计数据失败', 'error');
        } finally {
            this.showLoading(false);
        }
    }
    
    // 渲染统计数据
    renderStats(stats) {
        // 更新时间范围选择器
        const timeBtns = document.querySelectorAll('.time-btn');
        timeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                timeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateStatsWithRange(parseInt(btn.dataset.range));
            });
        });
        
        // 渲染热门关键词
        this.renderTopKeywords(stats.topKeywords);
        
        // 渲染详细统计表格
        this.renderDetailedStats(stats.detailedStats);
    }
    
    // 根据时间范围更新统计
    async updateStatsWithRange(rangeDays) {
        this.showLoading(true);
        
        try {
            const response = await this.API.getUserStats(rangeDays);
            
            if (response.success) {
                this.renderTopKeywords(response.stats.topKeywords);
                this.renderDetailedStats(response.stats.detailedStats);
            }
        } catch (error) {
            console.error('更新统计数据失败:', error);
        } finally {
            this.showLoading(false);
        }
    }
    
    // 渲染热门关键词
    renderTopKeywords(keywords) {
        const container = document.getElementById('topKeywordsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!keywords || keywords.length === 0) {
            container.innerHTML = '<p>暂无热门关键词数据</p>';
            return;
        }
        
        keywords.forEach((keyword, index) => {
            const keywordItem = document.createElement('div');
            keywordItem.className = 'keyword-item';
            keywordItem.innerHTML = `
                <span class="keyword-rank">${index + 1}</span>
                <span class="keyword-text">${this.utils.escapeHtml(keyword.keyword)}</span>
                <span class="keyword-count">${keyword.count}次</span>
            `;
            
            // 点击搜索该关键词
            keywordItem.addEventListener('click', () => {
                window.location.href = `index.html?q=${encodeURIComponent(keyword.keyword)}`;
            });
            
            container.appendChild(keywordItem);
        });
    }
    
    // 渲染详细统计数据
    renderDetailedStats(stats) {
        const container = document.getElementById('detailedStatsTable');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!stats || Object.keys(stats).length === 0) {
            container.innerHTML = '<tr><td colspan="3">暂无统计数据</td></tr>';
            return;
        }
        
        Object.keys(stats).forEach(key => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.getStatLabel(key)}</td>
                <td>${stats[key].value}</td>
                <td>${this.getTrendIcon(stats[key].trend)} ${stats[key].trend}%</td>
            `;
            container.appendChild(row);
        });
    }
    
    // 获取统计指标标签
    getStatLabel(key) {
        const labels = {
            'avgSearchPerDay': '日均搜索量',
            'favoritesAdded': '新增收藏',
            'activeDays': '活跃天数',
            'uniqueSources': '不同资源来源',
            'mostActiveDay': '最活跃日期',
            'favoriteRatio': '收藏率',
            'avgResults': '平均结果数'
        };
        
        return labels[key] || key;
    }
    
    // 获取趋势图标
    getTrendIcon(trend) {
        if (trend > 0) return '↑';
        if (trend < 0) return '↓';
        return '→';
    }
    
    // 清空所有数据
    async clearAllData() {
        if (!confirm('确定要清空所有数据吗？包括收藏夹和搜索历史？此操作不可撤销！')) return;
        
        try {
            const response = await this.API.clearAllData();
            
            if (response.success) {
                this.utils.showToast('所有数据已清空', 'success');
                // 刷新数据
                this.loadFavorites();
                this.loadHistory();
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('清空数据失败:', error);
            this.utils.showToast('清空数据失败', 'error');
        }
    }
    
    // 删除账户
    async deleteAccount() {
        if (!confirm('确定要永久删除您的账户吗？此操作将删除所有数据且不可恢复！')) return;
        
        try {
            const response = await this.API.deleteAccount();
            
            if (response.success) {
                this.utils.showToast('账户已成功删除', 'success');
                // 登出并跳转首页
                this.authManager.logout();
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            } else {
                this.utils.showToast(response.message, 'error');
            }
        } catch (error) {
            console.error('删除账户失败:', error);
            this.utils.showToast('删除账户失败', 'error');
        }
    }
    
    // 导出数据
    exportData() {
        // 实现数据导出逻辑
        this.utils.showToast('数据导出功能正在开发中', 'info');
    }
    
    // 导出收藏
    exportFavorites() {
        // 实现收藏导出逻辑
        this.utils.showToast('收藏导出功能正在开发中', 'info');
    }
    
    // 显示加载状态
    showLoading(show) {
        const loader = document.getElementById('loading');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    }
    
    // 显示Toast通知
    showToast(message, type) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast toast-${type} show`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    
    // 切换主题
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        this.utils.storage.set('theme', newTheme);
        
        // 更新按钮文本
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
    }
    
    // 打开模态框
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }
    
    // 关闭模态框
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // 登出
    async logout() {
        try {
            await this.authManager.logout();
            this.utils.showToast('已退出登录', 'success');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } catch (error) {
            console.error('退出登录失败:', error);
            this.utils.showToast('退出登录失败', 'error');
        }
    }
}

// 初始化应用
if (typeof authManager !== 'undefined' && typeof utils !== 'undefined' && typeof API !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new DashboardApp();
        
        // 初始化标签页
        app.switchTab('overview');
    });
}