// 配置管理模块 - 完整版本
(function() {
    'use strict';

    // 配置工具函数
    function getConfigValue(key, defaultValue) {
        // 优先级：环境变量 > meta标签 > 默认值
        if (typeof window !== 'undefined' && window.ENV && window.ENV[key]) {
            return window.ENV[key];
        }
        
        const metaTag = document.querySelector(`meta[name="${key}"]`);
        if (metaTag) {
            return metaTag.getAttribute('content');
        }
        
        return defaultValue;
    }

    function getBooleanConfig(key, defaultValue) {
        const value = getConfigValue(key, defaultValue);
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
    }

    function getNumberConfig(key, defaultValue) {
        const value = getConfigValue(key, defaultValue);
        const num = Number(value);
        return isNaN(num) ? defaultValue : num;
    }

    // 检测环境
    function detectEnvironment() {
        const hostname = window.location.hostname;
        const isDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('127.0.0');
        const isProd = hostname.includes('.pages.dev') || hostname.includes('.workers.dev') || 
                      (!isDev && hostname !== '' && !hostname.includes('192.168'));
        
        return {
            isDevelopment: isDev,
            isProduction: isProd,
            isLocal: isDev,
            hostname: hostname
        };
    }

    const environment = detectEnvironment();

    // 主配置对象
    const config = {
        // 环境信息
        ENVIRONMENT: environment,
        IS_DEVELOPMENT: environment.isDevelopment,
        IS_PRODUCTION: environment.isProduction,
        
        // 应用基础配置
        APP_NAME: getConfigValue('CF_APP_NAME', '磁力快搜'),
        APP_VERSION: getConfigValue('CF_APP_VERSION', '2.0.0'),
        APP_DESCRIPTION: getConfigValue('CF_APP_DESCRIPTION', '快速搜索磁力链接资源'),
        
        // API配置
        BASE_URL: getConfigValue('CF_API_BASE_URL', environment.isDevelopment ? 
            'http://localhost:8787' : 'https://codeseek.zadi.workers.dev'),
        DEV_URL: getConfigValue('CF_DEV_API_URL', 'http://localhost:8787'),
        PROD_URL: getConfigValue('CF_PROD_API_URL', 'https://codeseek.zadi.workers.dev'),
        API_TIMEOUT: getNumberConfig('CF_API_TIMEOUT', 15000),
        API_RETRY_ATTEMPTS: getNumberConfig('CF_API_RETRY_ATTEMPTS', 3),
        
        // 功能开关
        ENABLE_REGISTRATION: getBooleanConfig('CF_ENABLE_REGISTRATION', true),
        ENABLE_GUEST_SEARCH: getBooleanConfig('CF_ENABLE_GUEST_SEARCH', false),
        ENABLE_ANALYTICS: getBooleanConfig('CF_ENABLE_ANALYTICS', false),
        ENABLE_CACHE: getBooleanConfig('CF_ENABLE_CACHE', true),
        ENABLE_OFFLINE_MODE: getBooleanConfig('CF_ENABLE_OFFLINE_MODE', true),
        
        // 用户隔离相关配置
        ENABLE_USER_ISOLATION: getBooleanConfig('CF_ENABLE_USER_ISOLATION', true),
        AUTO_BACKUP_INTERVAL: getNumberConfig('CF_AUTO_BACKUP_INTERVAL', 24), // 小时
        MAX_BACKUPS_PER_USER: getNumberConfig('CF_MAX_BACKUPS_PER_USER', 5),
        SHOW_SYNC_ERRORS: getBooleanConfig('CF_SHOW_SYNC_ERRORS', false),
        
        // 数据限制
        MAX_FAVORITES_PER_USER: getNumberConfig('CF_MAX_FAVORITES_PER_USER', 1000),
        MAX_HISTORY_PER_USER: getNumberConfig('CF_MAX_HISTORY_PER_USER', 1000),
        MAX_SEARCH_RESULTS: getNumberConfig('CF_MAX_SEARCH_RESULTS', 100),
        SEARCH_DEBOUNCE_DELAY: getNumberConfig('CF_SEARCH_DEBOUNCE_DELAY', 300),
        
        // 数据同步配置
        SYNC_TIMEOUT: getNumberConfig('CF_SYNC_TIMEOUT', 10000), // 毫秒
        ENABLE_AUTO_SYNC: getBooleanConfig('CF_ENABLE_AUTO_SYNC', true),
        SYNC_RETRY_ATTEMPTS: getNumberConfig('CF_SYNC_RETRY_ATTEMPTS', 3),
        SYNC_INTERVAL: getNumberConfig('CF_SYNC_INTERVAL', 300000), // 5分钟
        
        // 隐私和安全配置
        CLEAR_DATA_ON_LOGOUT: getBooleanConfig('CF_CLEAR_DATA_ON_LOGOUT', false),
        ENCRYPT_LOCAL_DATA: getBooleanConfig('CF_ENCRYPT_LOCAL_DATA', false),
        AUTO_LOGOUT_TIMEOUT: getNumberConfig('CF_AUTO_LOGOUT_TIMEOUT', 0), // 0为禁用自动登出
        
        // UI配置
        THEME_MODE: getConfigValue('CF_THEME_MODE', 'auto'), // auto, light, dark
        ANIMATION_DURATION: getNumberConfig('CF_ANIMATION_DURATION', 300),
        TOAST_DURATION: getNumberConfig('CF_TOAST_DURATION', 3000),
        ENABLE_KEYBOARD_SHORTCUTS: getBooleanConfig('CF_ENABLE_KEYBOARD_SHORTCUTS', true),
        
        // 搜索配置
        DEFAULT_SEARCH_CATEGORY: getConfigValue('CF_DEFAULT_SEARCH_CATEGORY', 'all'),
        DEFAULT_SORT_ORDER: getConfigValue('CF_DEFAULT_SORT_ORDER', 'seeders'),
        ENABLE_SEARCH_SUGGESTIONS: getBooleanConfig('CF_ENABLE_SEARCH_SUGGESTIONS', true),
        MIN_SEARCH_LENGTH: getNumberConfig('CF_MIN_SEARCH_LENGTH', 2),
        
        // 调试配置
        ENABLE_DEBUG: getBooleanConfig('CF_ENABLE_DEBUG', environment.isDevelopment),
        ENABLE_CONSOLE_LOGS: getBooleanConfig('CF_ENABLE_CONSOLE_LOGS', environment.isDevelopment),
        LOG_LEVEL: getConfigValue('CF_LOG_LEVEL', environment.isDevelopment ? 'debug' : 'error'),
        
        // 性能配置
        ENABLE_SERVICE_WORKER: getBooleanConfig('CF_ENABLE_SERVICE_WORKER', true),
        CACHE_EXPIRY_HOURS: getNumberConfig('CF_CACHE_EXPIRY_HOURS', 24),
        PRELOAD_RESOURCES: getBooleanConfig('CF_PRELOAD_RESOURCES', true),
        
        // 第三方服务配置（如果需要）
        GOOGLE_ANALYTICS_ID: getConfigValue('CF_GA_ID', ''),
        SENTRY_DSN: getConfigValue('CF_SENTRY_DSN', ''),
        
        // 实验性功能
        ENABLE_PWA: getBooleanConfig('CF_ENABLE_PWA', true),
        ENABLE_DARK_MODE: getBooleanConfig('CF_ENABLE_DARK_MODE', true),
        ENABLE_NOTIFICATIONS: getBooleanConfig('CF_ENABLE_NOTIFICATIONS', false)
    };

    // 配置验证
    function validateConfig() {
        const errors = [];
        const warnings = [];

        // 检查必需的配置
        if (!config.BASE_URL) {
            errors.push('BASE_URL 配置缺失');
        }

        // 检查数值配置的合理性
        if (config.MAX_FAVORITES_PER_USER < 1) {
            warnings.push('MAX_FAVORITES_PER_USER 设置过小');
        }

        if (config.MAX_HISTORY_PER_USER < 1) {
            warnings.push('MAX_HISTORY_PER_USER 设置过小');
        }

        if (config.API_TIMEOUT < 1000) {
            warnings.push('API_TIMEOUT 设置过小，可能导致请求超时');
        }

        // 输出验证结果
        if (errors.length > 0) {
            console.error('❌ 配置错误:', errors);
        }

        if (warnings.length > 0) {
            console.warn('⚠️ 配置警告:', warnings);
        }

        return { errors, warnings };
    }

    // 动态配置更新
    function updateConfig(newConfig) {
        Object.assign(config, newConfig);
        console.log('🔧 配置已更新');
        return config;
    }

    // 获取配置值
    function getConfig(key, defaultValue) {
        return config[key] !== undefined ? config[key] : defaultValue;
    }

    // 设置配置值
    function setConfig(key, value) {
        config[key] = value;
        localStorage.setItem(`config_${key}`, JSON.stringify(value));
    }

    // 从本地存储恢复配置
    function restoreConfigFromStorage() {
        const keys = Object.keys(config);
        keys.forEach(key => {
            const storedValue = localStorage.getItem(`config_${key}`);
            if (storedValue !== null) {
                try {
                    config[key] = JSON.parse(storedValue);
                } catch (error) {
                    console.warn(`恢复配置 ${key} 失败:`, error);
                }
            }
        });
    }

    // 主题管理
    const ThemeManager = {
        init() {
            this.applyTheme(config.THEME_MODE);
            this.setupThemeToggle();
        },

        applyTheme(theme) {
            const body = document.body;
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            body.classList.remove('theme-light', 'theme-dark');

            if (theme === 'auto') {
                body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
            } else {
                body.classList.add(`theme-${theme}`);
            }

            // 更新meta主题色
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
                metaThemeColor.setAttribute('content', isDark ? '#1a1a1a' : '#ffffff');
            }
        },

        setupThemeToggle() {
            // 监听系统主题变化
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (config.THEME_MODE === 'auto') {
                    this.applyTheme('auto');
                }
            });
        },

        toggleTheme() {
            const currentTheme = config.THEME_MODE;
            const themes = ['light', 'dark', 'auto'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            
            config.THEME_MODE = nextTheme;
            setConfig('THEME_MODE', nextTheme);
            this.applyTheme(nextTheme);
            
            return nextTheme;
        }
    };

    // 初始化配置
    function initializeConfig() {
        // 验证配置
        const validation = validateConfig();
        
        // 从本地存储恢复用户配置
        restoreConfigFromStorage();
        
        // 初始化主题
        if (config.ENABLE_DARK_MODE) {
            ThemeManager.init();
        }
        
        // 设置全局错误处理
        if (config.ENABLE_DEBUG) {
            window.addEventListener('error', (event) => {
                console.error('🐛 全局错误:', event.error);
            });
            
            window.addEventListener('unhandledrejection', (event) => {
                console.error('🐛 未处理的Promise拒绝:', event.reason);
            });
        }
        
        console.log('⚙️ 配置初始化完成');
        console.log('🌍 环境:', environment);
        
        if (config.ENABLE_DEBUG) {
            console.log('🔧 完整配置:', config);
        }
        
        return config;
    }

    // 用户隔离功能初始化
    function initUserIsolation() {
        if (!config.ENABLE_USER_ISOLATION) return;
        
        console.log('🔒 用户隔离功能已启用');
        
        // 设置自动备份
        if (config.AUTO_BACKUP_INTERVAL > 0) {
            setInterval(() => {
                const user = authManager?.getCurrentUser();
                if (user && window.UserDataManager) {
                    window.UserDataManager.backupUserData(user.id).then(backupKey => {
                        if (backupKey) {
                            window.UserDataManager.cleanupOldBackups(user.id, config.MAX_BACKUPS_PER_USER);
                        }
                    });
                }
            }, config.AUTO_BACKUP_INTERVAL * 60 * 60 * 1000);
        }
        
        // 监听用户登出事件
        if (config.CLEAR_DATA_ON_LOGOUT) {
            document.addEventListener('authStateChanged', (event) => {
                if (event.detail.type === 'logout' && window.UserIsolatedStorageManager) {
                    const userId = event.detail.user?.id;
                    if (userId) {
                        window.UserIsolatedStorageManager.clearUserData();
                        console.log(`用户 ${userId} 登出时已清理本地数据`);
                    }
                }
            });
        }
        
        // 设置自动同步
        if (config.ENABLE_AUTO_SYNC && config.SYNC_INTERVAL > 0) {
            setInterval(async () => {
                const user = authManager?.getCurrentUser();
                if (user && window.app && window.app.syncFavorites && window.app.syncSearchHistory) {
                    try {
                        await Promise.allSettled([
                            window.app.syncFavorites(),
                            window.app.syncSearchHistory()
                        ]);
                        console.log('🔄 自动同步完成');
                    } catch (error) {
                        console.error('🔄 自动同步失败:', error);
                    }
                }
            }, config.SYNC_INTERVAL);
        }
    }

    // PWA支持
    function initPWASupport() {
        if (!config.ENABLE_PWA) return;
        
        // 注册Service Worker
        if ('serviceWorker' in navigator && config.ENABLE_SERVICE_WORKER) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('📱 PWA: Service Worker 注册成功');
                    })
                    .catch(error => {
                        console.error('📱 PWA: Service Worker 注册失败:', error);
                    });
            });
        }
        
        // 处理安装提示
        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // 显示安装按钮（如果有的话）
            const installButton = document.getElementById('installButton');
            if (installButton) {
                installButton.style.display = 'block';
                installButton.onclick = () => {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('📱 PWA: 用户接受安装');
                        }
                        deferredPrompt = null;
                        installButton.style.display = 'none';
                    });
                };
            }
        });
    }

    // 导出配置和工具函数
    window.API_CONFIG = config;
    window.ConfigManager = {
        config,
        getConfig,
        setConfig,
        updateConfig,
        ThemeManager,
        validateConfig,
        initializeConfig,
        initUserIsolation,
        initPWASupport
    };

    // DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeConfig();
            initUserIsolation();
            initPWASupport();
        });
    } else {
        initializeConfig();
        initUserIsolation();
        initPWASupport();
    }

    console.log('✅ 配置管理器已加载完成');

})();
