class ThemeManager {
  constructor() {
    if (ThemeManager.instance) {
      return ThemeManager.instance;
    }
    
    ThemeManager.instance = this;
    this.theme = localStorage.getItem('theme') || 'light';
    this.isInitialized = false;
    this.eventBound = false;

    // 等待 DOM 加载完成后再初始化
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
      });
    } else {
      this.init();
    }
  }

  init() {
    // 初始化主题
    this.applyTheme();
    
    // 绑定事件
    if (!this.isInitialized) {
      this.bindThemeToggle();
      this.isInitialized = true;
    }
  }

  bindThemeToggle() {
    // 确保只绑定一次
    if (!this.eventBound) {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        themeToggle.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTheme();
        });
        this.eventBound = true;
      } else {
        console.warn('主题切换按钮未找到 (ID: themeToggle)');
      }
    }
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
    console.log('主题切换: ' + this.theme + ' -> ' + (this.theme === 'dark' ? 'light' : 'dark'));
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    
    // 触发自定义事件
    const event = new CustomEvent('themeChanged', {
      detail: { theme: this.theme }
    });
    document.dispatchEvent(event);
  }

  // 手动设置主题
  setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      this.theme = theme;
      this.applyTheme();
    }
  }
}

// 初始化全局主题管理器
window.themeManager = new ThemeManager();

// 监听主题变化事件
document.addEventListener('themeChanged', (e) => {
  console.log('主题已更改:', e.detail.theme);
  if (typeof showToast === 'function') {
    showToast(`主题已切换至${e.detail.theme === 'dark' ? '深色' : '浅色'}模式`, 'success');
  }
});