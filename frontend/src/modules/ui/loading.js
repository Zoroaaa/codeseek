import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 加载动画管理器
 */
export class LoadingManager {
  constructor() {
    this.loadingElement = null;
    this.isVisible = false;
    this.minDurationTimeout = null;
    this.init();
  }

  init() {
    this.loadingElement = document.getElementById('loading');
    if (!this.loadingElement) {
      console.warn('Loading元素未找到');
    }
  }

  show(minDuration = APP_CONSTANTS.UI.LOADING_MIN_DURATION) {
    if (!this.loadingElement) return;

    this.isVisible = true;
    this.loadingElement.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // 确保最小显示时间，避免闪烁
    if (this.minDurationTimeout) {
      clearTimeout(this.minDurationTimeout);
    }
    
    this.minDurationTimeout = setTimeout(() => {
      this.minDurationTimeout = null;
    }, minDuration);
  }

  hide() {
    if (!this.loadingElement) return;

    const doHide = () => {
      this.isVisible = false;
      this.loadingElement.style.display = 'none';
      document.body.style.overflow = '';
    };

    // 如果还在最小显示时间内，等待完成后隐藏
    if (this.minDurationTimeout) {
      setTimeout(doHide, APP_CONSTANTS.UI.LOADING_MIN_DURATION);
    } else {
      doHide();
    }
  }

  toggle(show) {
    if (show) {
      this.show();
    } else {
      this.hide();
    }
  }

  getState() {
    return this.isVisible;
  }
}

// 创建全局实例
export const loading = new LoadingManager();

// 向后兼容的全局函数
export function showLoading(show) {
  loading.toggle(show);
}