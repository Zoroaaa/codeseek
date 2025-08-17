import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 模态框管理器
 */
export class ModalManager {
  constructor() {
    this.activeModals = new Set();
    this.init();
  }

  init() {
    // 绑定全局关闭事件
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAll();
      }
    });

    // 绑定所有模态框的关闭按钮
    this.bindCloseButtons();
  }

  bindCloseButtons() {
    document.querySelectorAll('.modal .close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.close(modal.id);
        }
      });
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.close(modal.id);
        }
      });
    });
  }

  open(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
      console.warn(`模态框 ${modalId} 未找到`);
      return false;
    }

    // 设置显示
    modal.style.display = 'block';
    this.activeModals.add(modalId);

    // 焦点管理
    if (options.focusElement) {
      setTimeout(() => {
        const focusEl = modal.querySelector(options.focusElement);
        if (focusEl) focusEl.focus();
      }, APP_CONSTANTS.UI.MODAL_ANIMATION_DURATION);
    }

    // 防止页面滚动
    if (this.activeModals.size === 1) {
      document.body.style.overflow = 'hidden';
    }

    return true;
  }

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    modal.style.display = 'none';
    this.activeModals.delete(modalId);

    // 恢复页面滚动
    if (this.activeModals.size === 0) {
      document.body.style.overflow = '';
    }

    // 清理表单
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());

    return true;
  }

  closeAll() {
    this.activeModals.forEach(modalId => {
      this.close(modalId);
    });
  }

  isOpen(modalId) {
    return this.activeModals.has(modalId);
  }

  getActiveModals() {
    return Array.from(this.activeModals);
  }

  // 便捷方法
  showLogin() {
    return this.open('loginModal', { focusElement: '#loginUsername' });
  }

  showRegister() {
    return this.open('registerModal', { focusElement: '#regUsername' });
  }

  showPasswordChange() {
    return this.open('passwordModal', { focusElement: '#currentPassword' });
  }
}

// 创建全局实例
export const modal = new ModalManager();