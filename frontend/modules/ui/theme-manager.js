import { APP_CONSTANTS, EVENT_NAMES } from '../../shared/constants.js';
import { storage } from '../storage/storage-manager.js';
import { toast } from './toast.js';

/**
 * 主题管理器
 */
export class ThemeManager {
  constructor() {
    if (ThemeManager.instance) {
      return ThemeManager.instance;
    }
    
    ThemeManager.instance = this;
    this.theme = storage.getItem(APP_CONSTANTS.STORAGE.KEYS.THEME) || APP_CONSTANTS.THEMES.LIGHT;
    this.isInitialized = false;
    this.eventBound = false;
  }

  init() {
    if (this.isInitialized) return;

    this.applyTheme();
    this.bindThemeToggle();
    this.bindSystemThemeChange();
    this.isInitialized = true;
  }

  bindThemeToggle() {
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

  bindSystemThemeChange() {
    // 监听系统主题变化
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', () => {
        if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
          this.applyTheme();
        }
      });
    }
  }

  applyTheme() {
    let effectiveTheme = this.theme;
    
    // 如果是自动模式，根据系统主题决定
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        effectiveTheme = APP_CONSTANTS.THEMES.DARK;
      } else {
        effectiveTheme = APP_CONSTANTS.THEMES.LIGHT;
      }
    }

    document.documentElement.setAttribute('data-theme', effectiveTheme);
    storage.setItem(APP_CONSTANTS.STORAGE.KEYS.THEME, this.theme);
    
    // 更新按钮图标
    this.updateToggleButton(effectiveTheme);
  }

  updateToggleButton(effectiveTheme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icons = {
        [APP_CONSTANTS.THEMES.LIGHT]: '🌙',
        [APP_CONSTANTS.THEMES.DARK]: '☀️',
        [APP_CONSTANTS.THEMES.AUTO]: '🌓'
      };
      
      themeToggle.textContent = icons[effectiveTheme] || '🌙';
      themeToggle.setAttribute('title', `当前: ${this.getThemeDisplayName(effectiveTheme)}`);
    }
  }

  getThemeDisplayName(theme) {
    const names = {
      [APP_CONSTANTS.THEMES.LIGHT]: '浅色模式',
      [APP_CONSTANTS.THEMES.DARK]: '深色模式',
      [APP_CONSTANTS.THEMES.AUTO]: '跟随系统'
    };
    return names[theme] || '未知';
  }

  toggleTheme() {
    console.log('主题切换: ' + this.theme + ' -> ' + this.getNextTheme());
    
    this.theme = this.getNextTheme();
    this.applyTheme();
    
    // 触发自定义事件
    const event = new CustomEvent(EVENT_NAMES.THEME_CHANGED, {
      detail: { theme: this.theme }
    });
    document.dispatchEvent(event);

    // 显示提示
    toast.success(`主题已切换至${this.getThemeDisplayName(this.theme)}`);
  }

  getNextTheme() {
    const themes = [APP_CONSTANTS.THEMES.LIGHT, APP_CONSTANTS.THEMES.DARK, APP_CONSTANTS.THEMES.AUTO];
    const currentIndex = themes.indexOf(this.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    return themes[nextIndex];
  }

  setTheme(theme) {
    if (Object.values(APP_CONSTANTS.THEMES).includes(theme)) {
      this.theme = theme;
      this.applyTheme();
      
      const event = new CustomEvent(EVENT_NAMES.THEME_CHANGED, {
        detail: { theme: this.theme }
      });
      document.dispatchEvent(event);
    }
  }

  getTheme() {
    return this.theme;
  }

  getCurrentEffectiveTheme() {
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
        ? APP_CONSTANTS.THEMES.DARK 
        : APP_CONSTANTS.THEMES.LIGHT;
    }
    return this.theme;
  }
}

// 创建全局实例
export const themeManager = new ThemeManager();

// 监听主题变化事件
document.addEventListener(EVENT_NAMES.THEME_CHANGED, (e) => {
  console.log('主题已更改:', e.detail.theme);
});