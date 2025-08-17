import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 加载动画管理器 - 增强版
 */
export class LoadingManager {
  constructor() {
    this.loadingElement = null;
    this.appElement = null;
    this.isVisible = false;
    this.minDurationTimeout = null;
    this.hideCallbacks = [];
    this.init();
  }

  init() {
    this.loadingElement = document.getElementById('loading');
    this.appElement = document.getElementById('app');
    
    if (!this.loadingElement) {
      console.warn('❌ Loading元素未找到');
      return;
    }
    
    if (!this.appElement) {
      console.warn('❌ App容器元素未找到');
      return;
    }
    
    // 检查初始状态
    this.isVisible = this.loadingElement.style.display !== 'none';
    console.log('🔄 Loading管理器初始化完成', {
      loadingVisible: this.isVisible,
      appVisible: this.appElement.style.display
    });
  }

  show(message = '应用初始化中...', minDuration = APP_CONSTANTS.UI.LOADING_MIN_DURATION) {
    if (!this.loadingElement) {
      console.warn('❌ 无法显示Loading: Loading元素不存在');
      return;
    }

    console.log('🔄 显示Loading状态:', message);
    
    this.isVisible = true;
    
    // 显示loading元素
    this.loadingElement.style.display = 'flex';
    
    // 隐藏app容器
    if (this.appElement) {
      this.appElement.style.display = 'none';
    }
    
    // 更新加载文本
    this.updateMessage(message);
    
    // 防止页面滚动
    document.body.style.overflow = 'hidden';

    // 确保最小显示时间，避免闪烁
    if (this.minDurationTimeout) {
      clearTimeout(this.minDurationTimeout);
    }
    
    this.minDurationTimeout = setTimeout(() => {
      this.minDurationTimeout = null;
      console.log('⏰ Loading最小显示时间已结束');
    }, minDuration);
  }

  hide() {
    if (!this.loadingElement) {
      console.warn('❌ 无法隐藏Loading: Loading元素不存在');
      return;
    }

    console.log('🔄 准备隐藏Loading...');

    const doHide = () => {
      console.log('🔄 执行Loading隐藏操作...');
      
      // 隐藏loading元素
      this.loadingElement.style.display = 'none';
      
      // 显示app容器 - 这是关键修复
      if (this.appElement) {
        this.appElement.style.display = 'block';
        console.log('✅ App容器已显示');
      } else {
        console.warn('❌ App容器元素不存在，无法显示');
      }
      
      // 恢复页面滚动
      document.body.style.overflow = '';
      
      // 更新状态
      this.isVisible = false;
      
      // 执行隐藏回调
      this.hideCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('❌ Loading隐藏回调执行失败:', error);
        }
      });
      
      console.log('✅ Loading已完全隐藏，App已显示');
    };

    // 如果还在最小显示时间内，等待完成后隐藏
    if (this.minDurationTimeout) {
      console.log('⏰ 等待最小显示时间结束...');
      setTimeout(doHide, APP_CONSTANTS.UI.LOADING_MIN_DURATION);
    } else {
      doHide();
    }
  }

  /**
   * 更新加载消息
   */
  updateMessage(message) {
    if (!this.loadingElement) return;
    
    const loadingText = this.loadingElement.querySelector('.loading-text');
    if (loadingText) {
      loadingText.textContent = message;
      console.log('📝 Loading消息已更新:', message);
    }
  }

  /**
   * 切换显示状态
   */
  toggle(show, message) {
    if (show) {
      this.show(message);
    } else {
      this.hide();
    }
  }

  /**
   * 获取当前状态
   */
  getState() {
    return {
      isVisible: this.isVisible,
      loadingElement: !!this.loadingElement,
      appElement: !!this.appElement,
      loadingDisplay: this.loadingElement?.style.display || 'unknown',
      appDisplay: this.appElement?.style.display || 'unknown'
    };
  }

  /**
   * 添加隐藏完成回调
   */
  onHidden(callback) {
    if (typeof callback === 'function') {
      this.hideCallbacks.push(callback);
    }
  }

  /**
   * 移除隐藏完成回调
   */
  offHidden(callback) {
    const index = this.hideCallbacks.indexOf(callback);
    if (index > -1) {
      this.hideCallbacks.splice(index, 1);
    }
  }

  /**
   * 强制显示App容器（紧急修复方法）
   */
  forceShowApp() {
    console.log('🚨 执行强制显示App容器...');
    
    if (this.loadingElement) {
      this.loadingElement.style.display = 'none';
    }
    
    if (this.appElement) {
      this.appElement.style.display = 'block';
      console.log('✅ 强制显示App容器成功');
    } else {
      console.error('❌ 强制显示失败: App容器不存在');
    }
    
    document.body.style.overflow = '';
    this.isVisible = false;
  }

  /**
   * 诊断方法 - 用于调试
   */
  diagnose() {
    const state = this.getState();
    console.log('🔍 Loading管理器诊断信息:');
    console.table(state);
    
    // 检查DOM元素
    console.log('📋 DOM元素检查:');
    console.log('- Loading元素:', this.loadingElement);
    console.log('- App容器:', this.appElement);
    
    return state;
  }
}

// 创建全局实例
export const loading = new LoadingManager();

// 向后兼容的全局函数
export function showLoading(show, message) {
  loading.toggle(show, message);
}

// 挂载到window对象供全局访问
window.loading = loading;

// 添加调试方法到window
window.diagnoseLoading = () => loading.diagnose();

console.log('✅ 增强版Loading管理器已加载');