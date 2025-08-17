import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * Toast通知组件
 */
export class ToastManager {
  constructor() {
    this.toastElement = null;
    this.currentTimeout = null;
    this.init();
  }

  init() {
    this.toastElement = document.getElementById('toast');
    if (!this.toastElement) {
      console.warn('Toast元素未找到');
    }
  }

  show(message, type = 'info', duration = APP_CONSTANTS.UI.TOAST_DURATION) {
    if (!this.toastElement) {
      console.warn('Toast元素不可用');
      return;
    }

    // 清除之前的类和超时
    this.toastElement.className = 'toast';
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
    }

    // 设置消息和类型
    this.toastElement.textContent = message;
    this.toastElement.classList.add(type, 'show');

    // 自动隐藏
    this.currentTimeout = setTimeout(() => {
      this.hide();
    }, duration);

    // 点击关闭
    this.toastElement.onclick = () => {
      this.hide();
    };
  }

  hide() {
    if (this.toastElement) {
      this.toastElement.classList.remove('show');
    }
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration);
  }

  warning(message, duration) {
    this.show(message, 'warning', duration);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

// 创建全局实例
export const toast = new ToastManager();

// 向后兼容的全局函数
export function showToast(message, type = 'info', duration = APP_CONSTANTS.UI.TOAST_DURATION) {
  toast.show(message, type, duration);
}