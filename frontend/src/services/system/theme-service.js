// src/services/system/theme-service.js
// 主题管理服务 - 从theme.js重构

import { APP_CONSTANTS } from '../../core/constants.js';

export class ThemeService {
  constructor() {
    this.notificationService = null;
    
    this.theme = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.THEME) || APP_CONSTANTS.THEMES.LIGHT;
    this.isInitialized = false;
    this.eventBound = false;
    this.eventListeners = new Set();
    this.systemThemeQuery = null;
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [notificationService] = dependencies;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
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
      this.listenToSystemTheme();
      this.isInitialized = true;
    }
  }

  // 绑定主题切换事件
  bindThemeToggle() {
    // 确保只绑定一次
    if (!this.eventBound) {
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        const handler = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleTheme();
        };
        
        themeToggle.addEventListener('click', handler);
        this.eventListeners.add({ element: themeToggle, event: 'click', handler });
        this.eventBound = true;
      } else {
        console.warn('主题切换按钮未找到 (ID: themeToggle)');
      }
    }
  }

  // 应用主题
  applyTheme() {
    let actualTheme = this.theme;
    
    // 如果是自动主题，检测系统主题
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      actualTheme = this.detectSystemTheme();
    }
    
    document.documentElement.setAttribute('data-theme', actualTheme);
    localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.THEME, this.theme);
    
    // 更新按钮图标
    this.updateThemeToggleIcon(actualTheme);
    
    // 触发主题变更事件
    this.dispatchThemeEvent(actualTheme);
  }

  // 更新主题切换按钮图标
  updateThemeToggleIcon(actualTheme) {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      const icon = actualTheme === APP_CONSTANTS.THEMES.DARK ? '☀️' : '🌙';
      themeToggle.textContent = icon;
      themeToggle.setAttribute('title', `切换到${actualTheme === APP_CONSTANTS.THEMES.DARK ? '浅色' : '深色'}模式`);
    }
  }

  // 切换主题
  toggleTheme() {
    console.log('主题切换: ' + this.theme + ' -> ' + (this.theme === APP_CONSTANTS.THEMES.DARK ? APP_CONSTANTS.THEMES.LIGHT : APP_CONSTANTS.THEMES.DARK));
    
    this.theme = this.theme === APP_CONSTANTS.THEMES.DARK ? APP_CONSTANTS.THEMES.LIGHT : APP_CONSTANTS.THEMES.DARK;
    this.applyTheme();
    
    // 显示通知
    this.showNotification(`主题已切换至${this.theme === APP_CONSTANTS.THEMES.DARK ? '深色' : '浅色'}模式`, 'success');
  }

  // 手动设置主题
  setTheme(theme) {
    if (Object.values(APP_CONSTANTS.THEMES).includes(theme)) {
      console.log('设置主题:', theme);
      this.theme = theme;
      this.applyTheme();
      
      this.showNotification(`主题已设置为${this.getThemeDisplayName(theme)}`, 'success');
    } else {
      console.warn('无效的主题值:', theme);
      throw new Error('无效的主题值');
    }
  }

  // 获取当前主题
  getCurrentTheme() {
    return this.theme;
  }

  // 获取实际应用的主题（考虑自动主题）
  getActualTheme() {
    if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
      return this.detectSystemTheme();
    }
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
      this.updateThemeToggleIcon(systemTheme);
    }
  }

  // 监听系统主题变化
  listenToSystemTheme() {
    if (window.matchMedia) {
      this.systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handler = () => {
        if (this.theme === APP_CONSTANTS.THEMES.AUTO) {
          this.applyAutoTheme();
          this.dispatchThemeEvent(this.getActualTheme());
        }
      };
      
      // 兼容旧版本浏览器
      if (this.systemThemeQuery.addEventListener) {
        this.systemThemeQuery.addEventListener('change', handler);
      } else if (this.systemThemeQuery.addListener) {
        this.systemThemeQuery.addListener(handler);
      }
      
      this.eventListeners.add({ 
        element: this.systemThemeQuery, 
        event: 'change', 
        handler,
        isMediaQuery: true 
      });
    }
  }

  // 获取可用主题列表
  getAvailableThemes() {
    return [
      { 
        value: APP_CONSTANTS.THEMES.LIGHT, 
        name: this.getThemeDisplayName(APP_CONSTANTS.THEMES.LIGHT),
        icon: '☀️' 
      },
      { 
        value: APP_CONSTANTS.THEMES.DARK, 
        name: this.getThemeDisplayName(APP_CONSTANTS.THEMES.DARK),
        icon: '🌙' 
      },
      { 
        value: APP_CONSTANTS.THEMES.AUTO, 
        name: this.getThemeDisplayName(APP_CONSTANTS.THEMES.AUTO),
        icon: '🔄' 
      }
    ];
  }

  // 获取主题显示名称
  getThemeDisplayName(theme) {
    const themeNames = {
      [APP_CONSTANTS.THEMES.LIGHT]: '浅色模式',
      [APP_CONSTANTS.THEMES.DARK]: '深色模式',
      [APP_CONSTANTS.THEMES.AUTO]: '跟随系统'
    };
    
    return themeNames[theme] || theme;
  }

  // 是否为深色主题
  isDarkTheme() {
    return this.getActualTheme() === APP_CONSTANTS.THEMES.DARK;
  }

  // 是否为浅色主题
  isLightTheme() {
    return this.getActualTheme() === APP_CONSTANTS.THEMES.LIGHT;
  }

  // 是否为自动主题
  isAutoTheme() {
    return this.theme === APP_CONSTANTS.THEMES.AUTO;
  }

  // 触发主题事件
  dispatchThemeEvent(actualTheme) {
    const event = new CustomEvent('themeChanged', {
      detail: { 
        theme: this.theme,
        actualTheme: actualTheme,
        isDark: actualTheme === APP_CONSTANTS.THEMES.DARK
      }
    });
    document.dispatchEvent(event);
  }

  // 监听主题变化
  onThemeChanged(callback) {
    if (typeof callback !== 'function') {
      throw new Error('回调函数必须是一个函数');
    }
    
    const handler = (event) => callback(event.detail);
    document.addEventListener('themeChanged', handler);
    this.eventListeners.add({ element: document, event: 'themeChanged', handler });
    
    return handler;
  }

  // 移除主题变化监听
  offThemeChanged(callback) {
    document.removeEventListener('themeChanged', callback);
    
    // 从事件监听器集合中移除
    for (const listener of this.eventListeners) {
      if (listener.handler === callback) {
        this.eventListeners.delete(listener);
        break;
      }
    }
  }

  // 获取主题偏好设置
  getThemePreferences() {
    return {
      currentTheme: this.theme,
      actualTheme: this.getActualTheme(),
      systemTheme: this.detectSystemTheme(),
      supportsSystemTheme: !!(window.matchMedia),
      isDark: this.isDarkTheme(),
      isLight: this.isLightTheme(),
      isAuto: this.isAutoTheme()
    };
  }

  // 重置主题到默认值
  resetTheme() {
    this.setTheme(APP_CONSTANTS.THEMES.LIGHT);
  }

  // 导入主题设置
  importThemeSettings(settings) {
    if (settings && settings.theme) {
      this.setTheme(settings.theme);
      return true;
    }
    return false;
  }

  // 导出主题设置
  exportThemeSettings() {
    return {
      theme: this.theme,
      preferences: this.getThemePreferences(),
      exportTime: new Date().toISOString()
    };
  }

  // 预加载主题资源
  preloadThemeResources() {
    // 预加载深色主题的CSS变量或资源
    if (this.theme === APP_CONSTANTS.THEMES.LIGHT) {
      // 可以在这里预加载深色主题资源
      console.log('预加载深色主题资源');
    }
  }

  // 应用主题动画
  applyThemeTransition() {
    document.documentElement.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // 移除过渡效果以避免干扰其他动画
    setTimeout(() => {
      document.documentElement.style.transition = '';
    }, 300);
  }

  // 工具方法
  showNotification(message, type = 'info') {
    if (this.notificationService) {
      this.notificationService.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 获取主题统计信息
  getThemeStats() {
    const preferences = this.getThemePreferences();
    
    return {
      currentTheme: preferences.currentTheme,
      actualTheme: preferences.actualTheme,
      switchCount: this.getSwitchCount(),
      lastSwitchTime: this.getLastSwitchTime(),
      preferences
    };
  }

  // 获取切换次数（简化版本，实际可以从localStorage读取）
  getSwitchCount() {
    const count = localStorage.getItem('theme_switch_count');
    return count ? parseInt(count) : 0;
  }

  // 更新切换次数
  incrementSwitchCount() {
    const count = this.getSwitchCount() + 1;
    localStorage.setItem('theme_switch_count', count.toString());
    localStorage.setItem('theme_last_switch', Date.now().toString());
  }

  // 获取最后切换时间
  getLastSwitchTime() {
    const time = localStorage.getItem('theme_last_switch');
    return time ? parseInt(time) : null;
  }

  // 验证主题设置
  validateTheme(theme) {
    return Object.values(APP_CONSTANTS.THEMES).includes(theme);
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      currentTheme: this.theme,
      actualTheme: this.getActualTheme(),
      isInitialized: this.isInitialized,
      eventBound: this.eventBound,
      eventListenersCount: this.eventListeners.size,
      supportsSystemTheme: !!(window.matchMedia),
      themeToggleExists: !!document.getElementById('themeToggle'),
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    // 清理所有事件监听器
    for (const listener of this.eventListeners) {
      try {
        if (listener.isMediaQuery) {
          // 媒体查询事件
          if (listener.element.removeEventListener) {
            listener.element.removeEventListener(listener.event, listener.handler);
          } else if (listener.element.removeListener) {
            listener.element.removeListener(listener.handler);
          }
        } else {
          // 普通DOM事件
          listener.element.removeEventListener(listener.event, listener.handler);
        }
      } catch (error) {
        console.warn('清理事件监听器失败:', error);
      }
    }
    
    this.eventListeners.clear();
    this.isInitialized = false;
    this.eventBound = false;
    this.systemThemeQuery = null;
  }

  // 重新初始化
  reinitialize() {
    this.destroy();
    this.initialize();
  }
}

export default ThemeService;