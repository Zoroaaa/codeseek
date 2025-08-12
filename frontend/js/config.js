// 环境配置脚本
// 在页面加载前设置API配置

(function() {
    'use strict';
    
    // 从Cloudflare Pages环境变量获取配置
    // 这些值需要在Cloudflare Pages的环境变量中设置
    const config = {
        // API基础URL - 在生产环境中设置为您的Worker URL
        BASE_URL: typeof CF_API_BASE_URL !== 'undefined' ? CF_API_BASE_URL : null,
        
        // 开发环境API URL
        DEV_URL: typeof CF_DEV_API_URL !== 'undefined' ? CF_DEV_API_URL : 'http://localhost:8787',
        
        // 生产环境API URL - 默认值
        PROD_URL: typeof CF_PROD_API_URL !== 'undefined' ? CF_PROD_API_URL : 'http://codeseek.zadi.workers.dev',
        
        // 应用配置
        APP_NAME: typeof CF_APP_NAME !== 'undefined' ? CF_APP_NAME : '磁力快搜',
        APP_VERSION: typeof CF_APP_VERSION !== 'undefined' ? CF_APP_VERSION : '1.0.0',
        
        // 功能开关
        ENABLE_ANALYTICS: typeof CF_ENABLE_ANALYTICS !== 'undefined' ? CF_ENABLE_ANALYTICS === 'true' : false,
        ENABLE_DEBUG: typeof CF_ENABLE_DEBUG !== 'undefined' ? CF_ENABLE_DEBUG === 'true' : false,
    };
    
    // 自动检测环境并设置API URL
    if (!config.BASE_URL) {
        const isDev = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname.includes('.local');
        
        config.BASE_URL = isDev ? config.DEV_URL : config.PROD_URL;
    }
    
    // 设置全局配置
    window.API_CONFIG = config;
    
    // 开发模式日志
    if (config.ENABLE_DEBUG) {
        console.log('🔧 应用配置:', config);
        console.log('🌐 API地址:', config.BASE_URL);
        console.log('🏠 当前域名:', window.location.hostname);
    }
    
    // 显示配置信息（可选）
    if (window.location.search.includes('debug=1')) {
        const info = document.createElement('div');
        info.style.cssText = `
            position: fixed; top: 10px; right: 10px; z-index: 9999;
            background: #000; color: #0f0; padding: 10px; font-family: monospace;
            border-radius: 5px; font-size: 12px; max-width: 300px;
        `;
        info.innerHTML = `
            <strong>Debug Info</strong><br>
            API: ${config.BASE_URL}<br>
            Version: ${config.APP_VERSION}<br>
            Environment: ${window.location.hostname.includes('localhost') ? 'DEV' : 'PROD'}
        `;
        document.body.appendChild(info);
    }
})();
