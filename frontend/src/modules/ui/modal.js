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
    // 使用更通用的选择器
    document.querySelectorAll('.modal .modal-close, .modal .close').forEach(btn => {
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

    console.log(`🔓 打开模态框: ${modalId}`);

    // 关键修复：设置显示并添加show类
    modal.style.display = 'block';
    modal.classList.add('show');
    
    // 移除可能的隐藏属性
    modal.hidden = false;
    modal.removeAttribute('aria-hidden');
    
    this.activeModals.add(modalId);

    // 焦点管理
    if (options.focusElement) {
      setTimeout(() => {
        const focusEl = modal.querySelector(options.focusElement);
        if (focusEl) {
          focusEl.focus();
          console.log(`🎯 聚焦到: ${options.focusElement}`);
        }
      }, APP_CONSTANTS.UI.MODAL_ANIMATION_DURATION || 150);
    }

    // 防止页面滚动
    if (this.activeModals.size === 1) {
      document.body.style.overflow = 'hidden';
    }

    console.log(`✅ 模态框 ${modalId} 已打开`);
    return true;
  }

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return false;

    console.log(`🔒 关闭模态框: ${modalId}`);

    // 关键修复：隐藏并移除show类
    modal.style.display = 'none';
    modal.classList.remove('show');
    
    this.activeModals.delete(modalId);

    // 恢复页面滚动
    if (this.activeModals.size === 0) {
      document.body.style.overflow = '';
    }

    // 清理表单
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());

    console.log(`✅ 模态框 ${modalId} 已关闭`);
    return true;
  }

  closeAll() {
    console.log('🔒 关闭所有模态框');
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

  // 便捷方法 - 修复版本
  showLogin() {
    // 先关闭注册框
    this.close('registerModal');
    
    const success = this.open('loginModal', { focusElement: '#loginUsername' });
    if (success) {
      console.log('🔑 显示登录框');
    }
    return success;
  }

  showRegister() {
    // 先关闭登录框
    this.close('loginModal');
    
    const success = this.open('registerModal', { focusElement: '#regUsername' });
    if (success) {
      console.log('📝 显示注册框');
    }
    return success;
  }

  showPasswordChange() {
    return this.open('passwordModal', { focusElement: '#currentPassword' });
  }

  // 调试方法
  diagnose() {
    console.group('🔍 模态框管理器诊断');
    console.log('活跃模态框:', Array.from(this.activeModals));
    
    document.querySelectorAll('.modal').forEach(modal => {
      const computedStyle = window.getComputedStyle(modal);
      console.log(`模态框 ${modal.id}:`, {
        display: modal.style.display,
        computedDisplay: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        hasShowClass: modal.classList.contains('show'),
        isActive: this.activeModals.has(modal.id)
      });
    });
    console.groupEnd();
  }
}

// 创建全局实例
export const modal = new ModalManager();

// 添加调试方法到全局
window.modalDiagnose = () => modal.diagnose();