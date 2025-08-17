// 临时替换main.js内容进行测试
// 逐步添加import来找出问题模块

console.log('开始最小化测试...');

// 第一步：测试基本功能
class MinimalApp {
    constructor() {
        this.initialized = false;
    }
    
    async init() {
        console.log('最小化应用初始化...');
        
        try {
            // 基本DOM操作测试
            const title = document.getElementById('page-title');
            if (title) {
                console.log('✅ DOM访问正常');
            }
            
            // 检查登录状态
            this.checkAuth();
            
            this.initialized = true;
            console.log('✅ 最小化初始化完成');
            
        } catch (error) {
            console.error('❌ 最小化初始化失败:', error);
        }
    }
    
    checkAuth() {
        const authToken = localStorage.getItem('auth_token');
        const loginModal = document.getElementById('loginModal');
        const mainContent = document.querySelector('.main-content');
        
        if (!authToken) {
            if (loginModal) loginModal.style.display = 'block';
            if (mainContent) mainContent.style.display = 'none';
            console.log('显示登录界面');
        } else {
            if (loginModal) loginModal.style.display = 'none';
            if (mainContent) mainContent.style.display = 'block';
            console.log('显示主界面');
        }
    }
}

// 创建应用实例
const minimalApp = new MinimalApp();
window.app = minimalApp;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await minimalApp.init();
        console.log('🎯 最小化应用启动成功');
    } catch (error) {
        console.error('💥 最小化应用启动失败:', error);
    }
});

// 导出（为了测试ES6模块语法）
export default minimalApp;