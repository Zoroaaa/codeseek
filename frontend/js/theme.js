// theme-manager.js
class ThemeManager {
  constructor() {
    if (ThemeManager.instance) {
      return ThemeManager.instance;
    }
    
    ThemeManager.instance = this;
    this.theme = localStorage.getItem('theme') || 'light';
    
    // 初始化主题
    this.applyTheme();
    
    // 全局事件绑定
    document.body.addEventListener('click', (e) => {
      if (e.target.closest('#themeToggle')) {
        this.toggleTheme();
      }
    });
  }
  
  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.theme);
    localStorage.setItem('theme', this.theme);
    
    // 更新按钮图标
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent = this.theme === 'dark' ? '☀️' : '🌙';
    }
  }
  
  toggleTheme() {
    console.log('全局主题切换');
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    
    // 触发自定义事件
    const event = new CustomEvent('themeChanged', {
      detail: { theme: this.theme }
    });
    document.dispatchEvent(event);
  }
}

// 初始化全局主题管理器
window.themeManager = new ThemeManager();

// 在应用中使用
document.addEventListener('themeChanged', (e) => {
  console.log('主题已更改:', e.detail.theme);
  showToast(`主题已切换至${e.detail.theme === 'dark' ? '深色' : '浅色'}模式`);
});