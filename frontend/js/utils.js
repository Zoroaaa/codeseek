// 工具函数和通用组件 - 完整版本
(function() {
    'use strict';

    // 存储管理器
    const StorageManager = {
        getItem(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('获取存储项失败:', key, error);
                return defaultValue;
            }
        },

        setItem(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('保存存储项失败:', key, error);
                return false;
            }
        },

        removeItem(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('删除存储项失败:', key, error);
                return false;
            }
        },

        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('清空存储失败:', error);
                return false;
            }
        },

        getSize() {
            let size = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    size += localStorage[key].length;
                }
            }
            return size;
        }
    };

    // 用户隔离的存储管理器
    const UserIsolatedStorageManager = {
        // 获取当前用户ID
        getCurrentUserId() {
            const userData = StorageManager.getItem('current_user');
            return userData?.id || 'anonymous';
        },

        // 生成用户专属的键名
        getUserKey(key) {
            const userId = this.getCurrentUserId();
            return `user_${userId}_${key}`;
        },

        // 获取用户隔离的存储项
        getItem(key, defaultValue = null) {
            const userKey = this.getUserKey(key);
            return StorageManager.getItem(userKey, defaultValue);
        },

        // 设置用户隔离的存储项
        setItem(key, value) {
            const userKey = this.getUserKey(key);
            return StorageManager.setItem(userKey, value);
        },

        // 删除用户隔离的存储项
        removeItem(key) {
            const userKey = this.getUserKey(key);
            return StorageManager.removeItem(userKey);
        },

        // 清空当前用户的所有数据
        clearUserData() {
            const userId = this.getCurrentUserId();
            const prefix = `user_${userId}_`;
            
            const keysToDelete = [];
            for (let key in localStorage) {
                if (key.startsWith(prefix)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`清空用户 ${userId} 的数据: ${keysToDelete.length} 个项目`);
            return keysToDelete.length;
        },

        // 清空指定用户的数据
        clearSpecificUserData(userId) {
            const prefix = `user_${userId}_`;
            
            const keysToDelete = [];
            for (let key in localStorage) {
                if (key.startsWith(prefix)) {
                    keysToDelete.push(key);
                }
            }
            
            keysToDelete.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`清空用户 ${userId} 的数据: ${keysToDelete.length} 个项目`);
            return keysToDelete.length > 0;
        },

        // 获取当前用户的存储使用情况
        getUserStorageUsage() {
            const userId = this.getCurrentUserId();
            const prefix = `user_${userId}_`;
            
            let size = 0;
            let keys = 0;
            
            for (let key in localStorage) {
                if (key.startsWith(prefix)) {
                    size += localStorage[key].length;
                    keys++;
                }
            }
            
            return {
                userId,
                size,
                keys,
                sizeKB: (size / 1024).toFixed(2),
                sizeMB: (size / (1024 * 1024)).toFixed(2)
            };
        },

        // 获取所有用户的存储使用情况
        getAllUsersStorageUsage() {
            const userUsage = {};
            
            for (let key in localStorage) {
                const match = key.match(/^user_([^_]+)_/);
                if (match) {
                    const userId = match[1];
                    if (!userUsage[userId]) {
                        userUsage[userId] = {
                            size: 0,
                            keys: []
                        };
                    }
                    userUsage[userId].size += localStorage[key].length;
                    userUsage[userId].keys.push(key);
                }
            }
            
            return userUsage;
        },

        // 迁移旧数据到用户隔离存储
        migrateOldData(userId, oldKeys = ['favorites', 'search_history', 'user_settings']) {
            const migrated = {};
            
            oldKeys.forEach(key => {
                const oldData = StorageManager.getItem(key);
                if (oldData) {
                    this.setItem(key, oldData);
                    migrated[key] = true;
                }
            });
            
            return migrated;
        },

        // 获取用户列表
        getUserList() {
            const users = new Set();
            
            for (let key in localStorage) {
                const match = key.match(/^user_([^_]+)_/);
                if (match) {
                    users.add(match[1]);
                }
            }
            
            return Array.from(users);
        }
    };

    // 时间格式化工具
    function formatRelativeTime(timestamp) {
        if (!timestamp) return '未知时间';
        
        const now = Date.now();
        const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
        const diff = now - time;

        if (diff < 1000) return '刚刚';
        if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        if (diff < 2592000000) return `${Math.floor(diff / 86400000)}天前`;
        if (diff < 31536000000) return `${Math.floor(diff / 2592000000)}个月前`;
        return `${Math.floor(diff / 31536000000)}年前`;
    }

    // 防抖函数
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

    // 节流函数
    function throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // 消息提示
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const style = {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            maxWidth: '300px',
            wordWrap: 'break-word',
            transform: 'translateX(100%)',
            opacity: '0',
            transition: 'all 0.3s ease',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        };

        const colors = {
            info: '#3498db',
            success: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };

        Object.assign(toast.style, style);
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.transform = 'translateX(0)';
            toast.style.opacity = '1';
        });

        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // 加载指示器
    function showLoading(show = true, message = '加载中...') {
        let loader = document.getElementById('global-loader');
        
        if (show) {
            if (!loader) {
                loader = document.createElement('div');
                loader.id = 'global-loader';
                loader.innerHTML = `
                    <div class="loader-backdrop">
                        <div class="loader-content">
                            <div class="loader-spinner"></div>
                            <div class="loader-text">${message}</div>
                        </div>
                    </div>
                `;
                
                const style = document.createElement('style');
                style.textContent = `
                    #global-loader {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        z-index: 9999;
                    }
                    .loader-backdrop {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.7);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .loader-content {
                        background: white;
                        padding: 2rem;
                        border-radius: 12px;
                        text-align: center;
                        min-width: 200px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                    }
                    .loader-spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #3498db;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    }
                    .loader-text {
                        color: #333;
                        font-size: 14px;
                        font-weight: 500;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
                document.body.appendChild(loader);
            }
            
            loader.querySelector('.loader-text').textContent = message;
        } else {
            if (loader && document.body.contains(loader)) {
                document.body.removeChild(loader);
            }
        }
    }

    // 输入验证工具
    const Validator = {
        email(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },

        username(username) {
            const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            return usernameRegex.test(username);
        },

        password(password) {
            return password && password.length >= 6 && password.length <= 50;
        },

        magnetLink(link) {
            return link && link.toLowerCase().startsWith('magnet:?xt=urn:btih:');
        },

        url(url) {
            try {
                new URL(url);
                return true;
            } catch {
                return false;
            }
        }
    };

    // HTML转义
    function escapeHtml(text) {
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

    // 复制到剪贴板
    async function copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // 回退方案
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                return success;
            }
        } catch (error) {
            console.error('复制失败:', error);
            return false;
        }
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        if (!bytes || bytes < 0) return '未知';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 随机ID生成器
    function generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const randomStr = Math.random().toString(36).substr(2, 9);
        return prefix + timestamp + randomStr;
    }

    // 用户数据管理工具
    const UserDataManager = {
        // 获取所有用户的数据统计
        getAllUsersDataStats() {
            const stats = {};
            const storageUsage = UserIsolatedStorageManager.getAllUsersStorageUsage();
            
            Object.keys(storageUsage).forEach(userId => {
                const userData = storageUsage[userId];
                stats[userId] = {
                    storageSize: userData.size,
                    itemCount: userData.keys.length,
                    sizeKB: (userData.size / 1024).toFixed(2),
                    sizeMB: (userData.size / (1024 * 1024)).toFixed(2)
                };
            });
            
            return stats;
        },

        // 数据迁移工具（从旧版本迁移到用户隔离版本）
        async migrateUserData(userId) {
            if (!userId) {
                console.error('用户ID不能为空');
                return false;
            }

            try {
                // 检查是否已有旧数据
                const oldFavorites = StorageManager.getItem('favorites', []);
                const oldHistory = StorageManager.getItem('search_history', []);
                const oldSettings = StorageManager.getItem('user_settings', {});

                if (oldFavorites.length > 0 || oldHistory.length > 0 || Object.keys(oldSettings).length > 0) {
                    console.log(`开始为用户 ${userId} 迁移数据...`);

                    // 迁移到用户隔离存储
                    if (oldFavorites.length > 0) {
                        // 为旧收藏添加用户ID
                        const updatedFavorites = oldFavorites.map(fav => ({
                            ...fav,
                            userId: userId
                        }));
                        UserIsolatedStorageManager.setItem('favorites', updatedFavorites);
                    }

                    if (oldHistory.length > 0) {
                        // 为旧历史记录添加用户ID
                        const updatedHistory = oldHistory.map(item => ({
                            ...item,
                            userId: userId
                        }));
                        UserIsolatedStorageManager.setItem('search_history', updatedHistory);
                    }

                    if (Object.keys(oldSettings).length > 0) {
                        UserIsolatedStorageManager.setItem('user_settings', oldSettings);
                    }

                    // 清除旧数据（可选，建议先备份）
                    const backup = {
                        favorites: oldFavorites,
                        searchHistory: oldHistory,
                        settings: oldSettings,
                        backupTime: new Date().toISOString()
                    };
                    StorageManager.setItem('data_backup_before_migration', backup);

                    console.log(`用户 ${userId} 数据迁移完成`);
                    return true;
                }

                return false; // 没有数据需要迁移
            } catch (error) {
                console.error('数据迁移失败:', error);
                return false;
            }
        },

        // 数据完整性检查
        validateUserData(userId) {
            if (!userId) return { valid: false, errors: ['用户ID不能为空'] };

            const errors = [];
            const warnings = [];

            try {
                // 检查收藏数据
                const favorites = UserIsolatedStorageManager.getItem('favorites', []);
                favorites.forEach((fav, index) => {
                    if (!fav.id) errors.push(`收藏项 ${index} 缺少ID`);
                    if (!fav.title) warnings.push(`收藏项 ${index} 缺少标题`);
                    if (!fav.url) errors.push(`收藏项 ${index} 缺少URL`);
                    if (fav.userId && fav.userId !== userId) {
                        errors.push(`收藏项 ${index} 用户ID不匹配`);
                    }
                });

                // 检查搜索历史数据
                const history = UserIsolatedStorageManager.getItem('search_history', []);
                history.forEach((item, index) => {
                    if (!item.keyword && !item.query) {
                        errors.push(`历史记录 ${index} 缺少关键词`);
                    }
                    if (!item.timestamp) warnings.push(`历史记录 ${index} 缺少时间戳`);
                    if (item.userId && item.userId !== userId) {
                        errors.push(`历史记录 ${index} 用户ID不匹配`);
                    }
                });

                return {
                    valid: errors.length === 0,
                    errors,
                    warnings,
                    stats: {
                        favoritesCount: favorites.length,
                        historyCount: history.length
                    }
                };
            } catch (error) {
                return {
                    valid: false,
                    errors: [`数据验证失败: ${error.message}`],
                    warnings: []
                };
            }
        },

        // 修复数据问题
        async fixUserData(userId) {
            if (!userId) return false;

            try {
                let fixed = 0;

                // 修复收藏数据
                const favorites = UserIsolatedStorageManager.getItem('favorites', []);
                const fixedFavorites = favorites.map(fav => {
                    let changed = false;
                    const fixedFav = { ...fav };

                    // 添加缺失的ID
                    if (!fixedFav.id) {
                        fixedFav.id = generateId('fav_');
                        changed = true;
                    }

                    // 设置用户ID
                    if (!fixedFav.userId) {
                        fixedFav.userId = userId;
                        changed = true;
                    }

                    // 修复时间戳
                    if (!fixedFav.addedAt) {
                        fixedFav.addedAt = new Date().toISOString();
                        changed = true;
                    }

                    if (changed) fixed++;
                    return fixedFav;
                }).filter(fav => fav.userId === userId); // 过滤掉其他用户的数据

                if (fixed > 0) {
                    UserIsolatedStorageManager.setItem('favorites', fixedFavorites);
                }

                // 修复搜索历史数据
                const history = UserIsolatedStorageManager.getItem('search_history', []);
                const fixedHistory = history.map(item => {
                    let changed = false;
                    const fixedItem = { ...item };

                    // 添加缺失的ID
                    if (!fixedItem.id) {
                        fixedItem.id = generateId('history_');
                        changed = true;
                    }

                    // 确保有关键词
                    if (!fixedItem.keyword && fixedItem.query) {
                        fixedItem.keyword = fixedItem.query;
                        changed = true;
                    } else if (!fixedItem.query && fixedItem.keyword) {
                        fixedItem.query = fixedItem.keyword;
                        changed = true;
                    }

                    // 设置用户ID
                    if (!fixedItem.userId) {
                        fixedItem.userId = userId;
                        changed = true;
                    }

                    // 修复时间戳
                    if (!fixedItem.timestamp) {
                        fixedItem.timestamp = Date.now();
                        changed = true;
                    }

                    if (changed) fixed++;
                    return fixedItem;
                }).filter(item => item.userId === userId); // 过滤掉其他用户的数据

                if (fixed > 0) {
                    UserIsolatedStorageManager.setItem('search_history', fixedHistory);
                }

                console.log(`用户 ${userId} 数据修复完成，共修复 ${fixed} 项问题`);
                return fixed > 0;
            } catch (error) {
                console.error('数据修复失败:', error);
                return false;
            }
        },

        // 数据备份功能
        async backupUserData(userId) {
            if (!userId) return null;

            try {
                const backup = {
                    userId,
                    backupTime: new Date().toISOString(),
                    favorites: UserIsolatedStorageManager.getItem('favorites', []),
                    searchHistory: UserIsolatedStorageManager.getItem('search_history', []),
                    settings: UserIsolatedStorageManager.getItem('user_settings', {}),
                    version: window.API_CONFIG?.APP_VERSION || '1.0.0'
                };

                // 保存备份到本地存储
                const backupKey = `backup_${userId}_${Date.now()}`;
                StorageManager.setItem(backupKey, backup);

                console.log(`用户 ${userId} 数据备份完成:`, backupKey);
                return backupKey;
            } catch (error) {
                console.error('数据备份失败:', error);
                return null;
            }
        },

        // 从备份恢复数据
        async restoreFromBackup(backupKey) {
            try {
                const backup = StorageManager.getItem(backupKey);
                if (!backup || !backup.userId) {
                    throw new Error('无效的备份数据');
                }

                const userId = backup.userId;
                
                // 确认当前用户
                const currentUserData = StorageManager.getItem('current_user');
                if (!currentUserData || currentUserData.id !== userId) {
                    throw new Error('备份数据与当前用户不匹配');
                }

                // 恢复数据
                UserIsolatedStorageManager.setItem('favorites', backup.favorites || []);
                UserIsolatedStorageManager.setItem('search_history', backup.searchHistory || []);
                UserIsolatedStorageManager.setItem('user_settings', backup.settings || {});

                console.log(`用户 ${userId} 数据恢复完成`);
                return true;
            } catch (error) {
                console.error('数据恢复失败:', error);
                return false;
            }
        },

        // 获取用户备份列表
        getUserBackups(userId) {
            if (!userId) return [];

            const backups = [];
            const keys = Object.keys(localStorage);
            const backupPrefix = `backup_${userId}_`;

            keys.forEach(key => {
                if (key.startsWith(backupPrefix)) {
                    try {
                        const backup = StorageManager.getItem(key);
                        if (backup && backup.backupTime) {
                            backups.push({
                                key,
                                time: backup.backupTime,
                                size: JSON.stringify(backup).length,
                                version: backup.version
                            });
                        }
                    } catch (error) {
                        console.warn(`无效的备份: ${key}`);
                    }
                }
            });

            return backups.sort((a, b) => new Date(b.time) - new Date(a.time));
        },

        // 清理旧备份
        cleanupOldBackups(userId, keepCount = 5) {
            const backups = this.getUserBackups(userId);
            if (backups.length <= keepCount) return;

            const toDelete = backups.slice(keepCount);
            toDelete.forEach(backup => {
                localStorage.removeItem(backup.key);
            });

            console.log(`清理了 ${toDelete.length} 个旧备份`);
        },

        // 数据压缩和优化
        optimizeUserData(userId) {
            if (!userId) return false;

            try {
                // 优化搜索历史：去重、排序、限制数量
                let history = UserIsolatedStorageManager.getItem('search_history', []);
                const uniqueHistory = new Map();
                
                history.forEach(item => {
                    if (item.keyword && !uniqueHistory.has(item.keyword)) {
                        uniqueHistory.set(item.keyword, item);
                    }
                });

                history = Array.from(uniqueHistory.values())
                    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
                    .slice(0, 1000);

                UserIsolatedStorageManager.setItem('search_history', history);

                // 优化收藏：去重
                let favorites = UserIsolatedStorageManager.getItem('favorites', []);
                const uniqueFavorites = new Map();
                
                favorites.forEach(fav => {
                    if (fav.url && !uniqueFavorites.has(fav.url)) {
                        uniqueFavorites.set(fav.url, fav);
                    }
                });

                favorites = Array.from(uniqueFavorites.values())
                    .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));

                UserIsolatedStorageManager.setItem('favorites', favorites);

                console.log(`用户 ${userId} 数据优化完成`);
                return true;
            } catch (error) {
                console.error('数据优化失败:', error);
                return false;
            }
        }
    };

    // 开发者工具（仅在debug模式下可用）
    const DevTools = {
        // 显示所有用户数据统计
        showAllUsersStats() {
            if (!window.API_CONFIG?.ENABLE_DEBUG) {
                console.warn('开发者工具仅在debug模式下可用');
                return;
            }

            const stats = UserDataManager.getAllUsersDataStats();
            console.table(stats);
            return stats;
        },

        // 切换到指定用户视角（仅用于调试）
        async switchToUser(userId) {
            if (!window.API_CONFIG?.ENABLE_DEBUG) {
                console.warn('此功能仅在debug模式下可用');
                return;
            }

            // 模拟用户切换（仅用于开发测试）
            const mockUser = {
                id: userId,
                username: `测试用户_${userId}`,
                email: `test_${userId}@example.com`
            };

            StorageManager.setItem('current_user', mockUser);
            
            if (window.app && window.app.handleUserSwitch) {
                await window.app.handleUserSwitch(mockUser);
            }
            console.log(`已切换到用户视角: ${userId}`);
        },

        // 清理指定用户数据
        async clearUserData(userId) {
            if (!window.API_CONFIG?.ENABLE_DEBUG) {
                console.warn('此功能仅在debug模式下可用');
                return;
            }

            if (!confirm(`确定要清理用户 ${userId} 的数据吗？`)) return;

            const result = UserIsolatedStorageManager.clearSpecificUserData(userId);
            console.log(`用户 ${userId} 数据清理${result ? '成功' : '失败'}`);
            return result;
        },

        // 验证用户数据完整性
        validateAllUsers() {
            if (!window.API_CONFIG?.ENABLE_DEBUG) {
                console.warn('此功能仅在debug模式下可用');
                return;
            }

            const allUsage = UserIsolatedStorageManager.getAllUsersStorageUsage();
            const results = {};

            Object.keys(allUsage).forEach(userId => {
                results[userId] = UserDataManager.validateUserData(userId);
            });

            console.log('所有用户数据验证结果:');
            console.table(results);
            return results;
        }
    };

    // 导出到全局作用域
    window.StorageManager = StorageManager;
    window.UserIsolatedStorageManager = UserIsolatedStorageManager;
    window.UserDataManager = UserDataManager;
    
    // 导出工具函数到全局作用域
    window.formatRelativeTime = formatRelativeTime;
    window.debounce = debounce;
    window.throttle = throttle;
    window.showToast = showToast;
    window.showLoading = showLoading;
    window.Validator = Validator;
    window.escapeHtml = escapeHtml;
    window.copyToClipboard = copyToClipboard;
    window.formatFileSize = formatFileSize;
    window.generateId = generateId;

    // 仅在debug模式下导出开发者工具
    if (window.API_CONFIG?.ENABLE_DEBUG) {
        window.DevTools = DevTools;
        console.log('🔧 开发者工具已加载，使用 DevTools 访问');
    }

    console.log('✅ 工具函数已加载完成');

})();
