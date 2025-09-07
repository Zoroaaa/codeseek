// 主题管理服务
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast } from '../utils/dom.js';

class ThemeManager {
  constructor() {
    if (ThemeManager.instance) {
      return ThemeManager.instance;
    }
    
    ThemeManager.instance = this;
    this.theme = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.THEME) || APP_CONSTANTS.THEMES.LIGHT;
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
    localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.THEME, this.theme);
    
    // 更新按钮图标
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent = this.theme === APP_CONSTANTS.THEMES.DARK ? '☀️' : '🌙';
    }
  }

  toggleTheme() {
    console.log('主题切换: ' + this.theme + ' -> ' + (this.theme === APP_CONSTANTS.THEMES.DARK ? APP_CONSTANTS.THEMES.LIGHT : APP_CONSTANTS.THEMES.DARK));
    this.theme = this.theme === APP_CONSTANTS.THEMES.DARK ? APP_CONSTANTS.THEMES.LIGHT : APP_CONSTANTS.THEMES.DARK;
    this.applyTheme();
    
    // 触发自定义事件
    const event = new CustomEvent('themeChanged', {
      detail: { theme: this.theme }
    });
    document.dispatchEvent(event);
  }

  // 手动设置主题
  setTheme(theme) {
    if (Object.values(APP_CONSTANTS.THEMES).includes(theme)) {
      this.theme = theme;
      this.applyTheme();
    }
  }

  // 获取当前主题
  getCurrentTheme() {
    return this.theme;
  }

  // 检测系统主题偏好
  detectSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return APP_CONSTANTS.THEMES.DARK;
    }
    return APP_CONSTANTS.THEMES.LIGHT;
  }

  // 应用自动主题
  applyAutoTheme() {
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      const systemTheme = this.detectSystemTheme();
      document.documentElement.setAttribute('data-theme', systemTheme);
    }
  }

  // 监听系统主题变化
  listenToSystemTheme() {
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addListener(() => {
        if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
          this.applyAutoTheme();
        }
      });
    }
  }
}

// 创建单例实例
export const themeManager = new ThemeManager();

// 监听主题变化事件
document.addEventListener('themeChanged', (e) => {
  console.log('主题已更改:', e.detail.theme);
  if (typeof showToast === 'function') {
    showToast(`主题已切换至${e.detail.theme === APP_CONSTANTS.THEMES.DARK ? '深色' : '浅色'}模式`, 'success');
  }
});

export default themeManager;