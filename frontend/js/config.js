/** Optimized config.js — generated 2025-08-16 14:58:31 UTC. Behavior preserved; style normalized. */
'use strict';

// 环境配置脚本 - 修复版本
(function() {
    'use strict';
\1    // 从Cloudflare Pages环境变量或其他环境获取配置
    const config = {
        // API基础URL配置
        BASE_URL: getConfigValue('CF_API_BASE_URL', null),
\1        // 开发环境API URL
        DEV_URL: getConfigValue('CF_DEV_API_URL', 'http://localhost:8787'),
\1        // 生产环境API URL - 使用相对路径避免HTTPS/HTTP混合问题
        PROD_URL: getConfigValue('CF_PROD_API_URL', getDefaultProdURL()),
\1        // 应用配置
        APP_NAME: getConfigValue('CF_APP_NAME', '磁力快搜'),
        APP_VERSION: getConfigValue('CF_APP_VERSION', '1.1.0'),
\1        // 功能开关
        ENABLE_ANALYTICS: getBooleanConfig('CF_ENABLE_ANALYTICS', false),
        ENABLE_DEBUG: getBooleanConfig('CF_ENABLE_DEBUG', isDevelopment()),
        ENABLE_OFFLINE_MODE: getBooleanConfig('CF_ENABLE_OFFLINE_MODE', true),
\1        // 性能配置
        API_TIMEOUT: getConfigValue('CF_API_TIMEOUT', 10000),
        RETRY_ATTEMPTS: getConfigValue('CF_RETRY_ATTEMPTS', 3),
        CACHE_DURATION: getConfigValue('CF_CACHE_DURATION', 1800000), // 30分钟
    };
\1    // 自动检测并设置最佳API URL
    if (!config.BASE_URL) {
        config.BASE_URL = autoDetectApiURL(config);
    }
\1    // 验证URL格式
    config.BASE_URL = validateAndFixURL(config.BASE_URL);
\1    // 设置全局配置
    window.API_CONFIG = config;
\1    // 开发模式日志
    if (config.ENABLE_DEBUG) {
        console.group('🔧 应用配置信息');

        console.groupEnd();
    }
\1    // 显示配置信息（调试模式）
    if (window.location.search.includes('debug=1') || window.location.search.includes('config=1')) {
        showDebugInfo(config);
    }
\1    // 连接状态监控
    setupConnectionMonitoring(config);
\1    /**
     * 获取配置值
     */
    function getConfigValue(key, defaultValue) {
        // 尝试从全局变量获取
        if (typeof window[key] !== 'undefined') {
            return window[key];
        }
\1        // 尝试从环境变量获取（Node.js环境）
        if (typeof process !== 'undefined' && process.env && process.env[key]) {
            return process.env[key];
        }
\1        // 尝试从URL参数获取
        const urlParams = new URLSearchParams(window.location.search);
        const paramKey = key.toLowerCase().replace(/^cf_/, '');
        if (urlParams.has(paramKey)) {
            return urlParams.get(paramKey);
        }
\1        return defaultValue;
    }
\1    /**
     * 获取布尔配置值
     */
    function getBooleanConfig(key, defaultValue) {
        const value = getConfigValue(key, defaultValue);
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true';
        }
        return Boolean(value);
    }
\1    /**
     * 检测是否为开发环境
     */
    function isDevelopment() {
        return window.location.hostname === 'localhost' ||\1               window.location.hostname === '127.0.0.1' ||
               window.location.hostname.includes('.local') ||
               window.location.port !== '' ||
               window.location.search.includes('dev=1');
    }
\1    /**
     * 获取默认生产环境URL
     */
    function getDefaultProdURL() {
        // 使用相对协议，避免HTTPS/HTTP混合内容问题
        if (window.location.protocol === 'https:') {
            return 'https://codeseek.zadi.workers.dev'; // 替换为实际的HTTPS API地址
        } else {
            return '/api'; // 使用相对路径
        }
    }
\1    /**
     * 自动检测最佳API URL
     */
    function autoDetectApiURL(config) {
        const isDev = isDevelopment();
\1        if (isDev) {

            return config.DEV_URL;
        } else {

            return config.PROD_URL;
        }
    }
\1    /**
     * 验证和修复URL
     */
    function validateAndFixURL(url) {
        if (!url) return '/api';
\1        try {
            // 如果是完整URL，进行验证
            if (url.startsWith('http://') || url.startsWith('https://')) {
                const urlObj = new URL(url);
\1                // 检查HTTPS/HTTP混合内容问题
                if (window.location.protocol === 'https:' && urlObj.protocol === 'http:') {
                    console.warn('⚠️ 检测到混合内容问题，尝试使用HTTPS');
                    urlObj.protocol = 'https:';
                    return urlObj.toString().replace(/\/$/, '');
                }
\1                return url.replace(/\/$/, '');
            }
\1            // 如果是相对路径，直接返回
            return url.replace(/\/$/, '');
\1        } catch (error) {
            console.warn('⚠️ URL格式错误，使用默认配置:', error.message);
            return '/api';
        }
    }
\1function handleRedirectIssues() {
    // 仅开发环境尝试纠正 .html
    const isDev = (window.location.hostname === 'localhost' ||
                   window.location.hostname === '127.0.0.1' ||
                   window.location.port !== '' ||
                   window.location.search.includes('dev=1'));

    if (!isDev) {
        return; // 生产环境不做任何“修正”，避免与 Clean URLs 冲突
    }

    // 开发环境纠正到 .html，方便本地静态文件访问
    if (!window.location.pathname.endsWith('.html')) {
        if (window.location.pathname.endsWith('/dashboard')) {
            window.location.replace('./dashboard.html' + window.location.search);
            return;
        }
        if (window.location.pathname.endsWith('/index')) {
            window.location.replace('./index.html' + window.location.search);
            return;
        }
    }
}

// 只在必要时调用，并添加防护
document.addEventListener('DOMContentLoaded', () => {
    // 添加延迟以避免与服务器重定向冲突
    setTimeout(handleRedirectIssues, 100);
});

\1    /**
     * 显示调试信息
     */
    function showDebugInfo(config) {
        const info = document.createElement('div');
        info.id = 'debug-config-info';
        info.style.cssText = `
            position: fixed;\1            top: 10px;\1            right: 10px;\1            z-index: 10000;
            background: rgba(0, 0, 0, 0.9);\1            color: #00ff00;\1            padding: 15px;\1            font-family: 'Courier New', monospace;
            border-radius: 8px;\1            font-size: 12px;\1            max-width: 400px;
            max-height: 300px;
            overflow-y: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            border: 1px solid #333;
        `;
\1        const configInfo = Object.entries(config)
            .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
            .join('');
\1        info.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <strong>🔧 配置信息</strong>
                <button onclick="this.parentElement.parentElement.remove()"\1                        style="background: #ff4444; border: none; color: white; padding: 2px 8px; border-radius: 3px; cursor: pointer;">
                    ✕
                </button>
            </div>
            ${configInfo}
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #333;">
                <div><strong>Environment:</strong> ${isDevelopment() ? 'Development' : 'Production'}</div>
                <div><strong>Hostname:</strong> ${window.location.hostname}</div>
                <div><strong>Protocol:</strong> ${window.location.protocol}</div>
                <div><strong>UserAgent:</strong> ${navigator.userAgent.slice(0, 50)}...</div>
            </div>
        `;
\1        // 等待DOM加载后添加
        if (document.body) {
            document.body.appendChild(info);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(info);
            });
        }
    }
\1    /**
     * 设置连接监控
     */
    function setupConnectionMonitoring(config) {
        // 监听在线/离线状态
        window.addEventListener('online', () => {

            if (config.ENABLE_DEBUG) {
                showToast && showToast('网络连接已恢复', 'success');
            }
        });
\1        window.addEventListener('offline', () => {
            console.warn('🔌 网络连接已断开');
            if (config.ENABLE_DEBUG) {
                showToast && showToast('网络连接已断开', 'warning');
            }
        });
\1        // 定期检查API连接状态（生产环境）
        if (!isDevelopment() && config.ENABLE_ANALYTICS) {
            setInterval(async () => {
                try {
                    const response = await fetch(config.BASE_URL + '/health', {\1                        method: 'HEAD',
                        timeout: 5000
                    });
\1                    if (!response.ok) {
                        console.warn('⚠️ API服务状态异常:', response.status);
                    }
                } catch (error) {
                    console.warn('⚠️ API连接检查失败:', error.message);
                }
            }, 60000); // 每分钟检查一次
        }
    }
\1    // 导出配置验证函数
    window.validateConfig = function() {
        const issues = [];
\1        if (!config.BASE_URL) {
            issues.push('BASE_URL 未设置');
        }
\1        if (window.location.protocol === 'https:' && config.BASE_URL.startsWith('http:')) {
            issues.push('HTTPS页面使用HTTP API可能存在混合内容问题');
        }
\1        return {
            valid: issues.length === 0,
            issues: issues,
            config: config
        };
    };
\1    // 配置热重载（开发模式）
    if (isDevelopment() && config.ENABLE_DEBUG) {
        window.reloadConfig = function() {
            window.location.reload();
        };
\1        // 添加配置重载快捷键 Ctrl+Alt+R
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.altKey && e.key === 'r') {
                e.preventDefault();

                window.reloadConfig();
            }
        });
    }
\1})();
