// src/services/system/notification-service.js
// 通知服务 - 修复版，添加show方法别名

export class NotificationService {
  constructor() {
    this.notifications = new Map();
    this.notificationQueue = [];
    this.maxNotifications = 5;
    this.defaultDuration = 3000;
    this.notificationId = 0;
    this.isInitialized = false;
    this.container = null;
    
    // 通知配置
    this.config = {
      position: 'top-right', // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
      maxStack: 5,
      showProgressBar: true,
      pauseOnHover: true,
      dismissOnClick: true,
      autoClose: true,
      fadeAnimation: true,
      soundEnabled: false
    };
    
    // 通知统计
    this.stats = {
      totalShown: 0,
      byType: {
        success: 0,
        error: 0,
        warning: 0,
        info: 0
      },
      dismissed: 0,
      autoExpired: 0
    };
  }

  // 初始化
  initialize() {
    this.createNotificationContainer();
    this.bindGlobalEvents();
    this.isInitialized = true;
    console.log('通知服务已初始化');
  }

  // 🔧 新增：show方法 - auth-service的兼容接口
  show(message, type = 'info', duration = null) {
    console.log(`📢 NotificationService.show 被调用: ${message} (${type})`);
    return this.showToast(message, type, duration);
  }

  // 创建通知容器
  createNotificationContainer() {
    if (this.container) {
      return this.container;
    }

    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = `notification-container notification-${this.config.position}`;
    
    // 添加样式
    this.container.style.cssText = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
      ${this.getPositionStyles()}
    `;

    document.body.appendChild(this.container);
    return this.container;
  }

  // 获取位置样式
  getPositionStyles() {
    const styles = {
      'top-right': 'top: 20px; right: 20px;',
      'top-left': 'top: 20px; left: 20px;',
      'bottom-right': 'bottom: 20px; right: 20px;',
      'bottom-left': 'bottom: 20px; left: 20px;',
      'top-center': 'top: 20px; left: 50%; transform: translateX(-50%);',
      'bottom-center': 'bottom: 20px; left: 50%; transform: translateX(-50%);'
    };
    
    return styles[this.config.position] || styles['top-right'];
  }

  // 显示Toast通知
  showToast(message, type = 'info', duration = null, options = {}) {
    console.log(`📱 showToast: ${message} (${type})`);
    
    if (!this.isInitialized) {
      console.log('📱 通知服务未初始化，正在初始化...');
      this.initialize();
    }

    const notificationData = {
      id: ++this.notificationId,
      message: String(message),
      type: this.validateType(type),
      duration: duration !== null ? duration : this.defaultDuration,
      timestamp: Date.now(),
      options: {
        ...this.config,
        ...options
      }
    };

    // 更新统计
    this.stats.totalShown++;
    this.stats.byType[notificationData.type]++;

    // 检查队列限制
    if (this.notifications.size >= this.config.maxStack) {
      this.removeOldestNotification();
    }

    // 创建通知元素
    const notificationElement = this.createNotificationElement(notificationData);
    
    // 添加到容器和管理器
    this.container.appendChild(notificationElement);
    this.notifications.set(notificationData.id, {
      data: notificationData,
      element: notificationElement,
      timer: null
    });

    // 设置自动关闭
    if (notificationData.options.autoClose && notificationData.duration > 0) {
      this.setAutoClose(notificationData.id, notificationData.duration);
    }

    // 播放声音（如果启用）
    if (this.config.soundEnabled) {
      this.playNotificationSound(notificationData.type);
    }

    console.log(`✅ 通知显示成功: ID ${notificationData.id}`);
    return notificationData.id;
  }

  // 显示模态框
  showModal(title, content, options = {}) {
    return new Promise((resolve) => {
      const modalData = {
        id: ++this.notificationId,
        title: String(title),
        content: String(content),
        type: 'modal',
        timestamp: Date.now(),
        options: {
          closable: true,
          backdrop: true,
          keyboard: true,
          size: 'medium', // small, medium, large
          confirmText: '确定',
          cancelText: '取消',
          showCancel: false,
          ...options
        },
        resolve
      };

      const modalElement = this.createModalElement(modalData);
      document.body.appendChild(modalElement);
      
      this.notifications.set(modalData.id, {
        data: modalData,
        element: modalElement,
        timer: null
      });

      // 聚焦到模态框
      setTimeout(() => {
        const focusElement = modalElement.querySelector('.modal-confirm') || modalElement.querySelector('.modal-close');
        if (focusElement) {
          focusElement.focus();
        }
      }, 100);
    });
  }

  // 确认对话框
  confirm(message, title = '确认', options = {}) {
    return this.showModal(title, message, {
      showCancel: true,
      ...options
    });
  }

  // 警告对话框
  alert(message, title = '提示', options = {}) {
    return this.showModal(title, message, {
      showCancel: false,
      ...options
    });
  }

  // 创建通知元素
  createNotificationElement(notificationData) {
    const element = document.createElement('div');
    element.className = `notification notification-${notificationData.type}`;
    element.style.cssText = `
      pointer-events: auto;
      margin-bottom: 10px;
      padding: 12px 16px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      background: white;
      border-left: 4px solid ${this.getTypeColor(notificationData.type)};
      position: relative;
      opacity: 0;
      transform: translateX(${this.config.position.includes('right') ? '100%' : '-100%'});
      transition: all 0.3s ease;
      cursor: pointer;
      max-width: 400px;
      word-wrap: break-word;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    `;

    // 创建内容
    const content = document.createElement('div');
    content.className = 'notification-content';
    content.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 14px;
      line-height: 1.4;
    `;

    // 图标
    const icon = document.createElement('span');
    icon.className = 'notification-icon';
    icon.style.cssText = `
      margin-right: 8px;
      font-size: 16px;
    `;
    icon.textContent = this.getTypeIcon(notificationData.type);

    // 消息
    const message = document.createElement('span');
    message.className = 'notification-message';
    message.style.cssText = `
      flex: 1;
      color: #333;
    `;
    message.textContent = notificationData.message;

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'notification-close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      margin-left: 8px;
      color: #999;
      line-height: 1;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.innerHTML = '×';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.removeNotification(notificationData.id);
    };

    content.appendChild(icon);
    content.appendChild(message);
    content.appendChild(closeBtn);
    element.appendChild(content);

    // 进度条
    if (notificationData.options.showProgressBar && notificationData.duration > 0) {
      const progressBar = this.createProgressBar(notificationData.duration);
      element.appendChild(progressBar);
    }

    // 绑定事件
    this.bindNotificationEvents(element, notificationData);

    // 触发入场动画
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateX(0)';
    }, 10);

    return element;
  }

  // 创建模态框元素
  createModalElement(modalData) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 11000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    const modal = document.createElement('div');
    modal.className = `modal modal-${modalData.options.size}`;
    modal.style.cssText = `
      background: white;
      border-radius: 8px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      max-width: ${this.getModalWidth(modalData.options.size)};
      width: 90%;
      max-height: 80vh;
      overflow: hidden;
      transform: scale(0.9);
      transition: transform 0.3s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
    `;

    // 标题
    if (modalData.title) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      header.style.cssText = `
        padding: 20px 24px 16px;
        border-bottom: 1px solid #e5e5e5;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      `;
      header.textContent = modalData.title;
      modal.appendChild(header);
    }

    // 内容
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = `
      padding: 20px 24px;
      font-size: 14px;
      line-height: 1.6;
      color: #666;
      max-height: 60vh;
      overflow-y: auto;
    `;
    body.innerHTML = modalData.content;
    modal.appendChild(body);

    // 按钮
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.style.cssText = `
      padding: 16px 24px 20px;
      border-top: 1px solid #e5e5e5;
      text-align: right;
    `;

    if (modalData.options.showCancel) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'modal-cancel';
      cancelBtn.style.cssText = this.getButtonStyles('secondary');
      cancelBtn.textContent = modalData.options.cancelText;
      cancelBtn.onclick = () => {
        modalData.resolve(false);
        this.removeNotification(modalData.id);
      };
      footer.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'modal-confirm';
    confirmBtn.style.cssText = this.getButtonStyles('primary');
    confirmBtn.textContent = modalData.options.confirmText;
    confirmBtn.onclick = () => {
      modalData.resolve(true);
      this.removeNotification(modalData.id);
    };
    footer.appendChild(confirmBtn);

    modal.appendChild(footer);
    overlay.appendChild(modal);

    // 绑定关闭事件
    if (modalData.options.backdrop) {
      overlay.onclick = (e) => {
        if (e.target === overlay) {
          modalData.resolve(false);
          this.removeNotification(modalData.id);
        }
      };
    }

    if (modalData.options.keyboard) {
      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          modalData.resolve(false);
          this.removeNotification(modalData.id);
        }
      };
      document.addEventListener('keydown', keyHandler);
      // 存储处理器以便清理
      overlay._keyHandler = keyHandler;
    }

    // 触发入场动画
    setTimeout(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'scale(1)';
    }, 10);

    return overlay;
  }

  // 绑定通知事件
  bindNotificationEvents(element, notificationData) {
    // 点击关闭
    if (notificationData.options.dismissOnClick) {
      element.onclick = () => {
        this.removeNotification(notificationData.id);
      };
    }

    // 悬停暂停
    if (notificationData.options.pauseOnHover) {
      element.onmouseenter = () => {
        this.pauseAutoClose(notificationData.id);
      };
      
      element.onmouseleave = () => {
        this.resumeAutoClose(notificationData.id);
      };
    }
  }

  // 创建进度条
  createProgressBar(duration) {
    const progressContainer = document.createElement('div');
    progressContainer.className = 'notification-progress';
    progressContainer.style.cssText = `
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: rgba(0,0,0,0.1);
    `;

    const progressBar = document.createElement('div');
    progressBar.className = 'notification-progress-bar';
    progressBar.style.cssText = `
      height: 100%;
      background: #007bff;
      width: 100%;
      transition: width ${duration}ms linear;
    `;

    progressContainer.appendChild(progressBar);

    // 启动进度动画
    setTimeout(() => {
      progressBar.style.width = '0%';
    }, 10);

    return progressContainer;
  }

  // 设置自动关闭
  setAutoClose(notificationId, duration) {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    notification.timer = setTimeout(() => {
      this.removeNotification(notificationId);
      this.stats.autoExpired++;
    }, duration);
  }

  // 暂停自动关闭
  pauseAutoClose(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (notification && notification.timer) {
      clearTimeout(notification.timer);
      notification.timer = null;
    }
  }

  // 恢复自动关闭
  resumeAutoClose(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (notification && !notification.timer) {
      const remainingTime = notification.data.duration - (Date.now() - notification.data.timestamp);
      if (remainingTime > 0) {
        this.setAutoClose(notificationId, remainingTime);
      }
    }
  }

  // 移除通知
  removeNotification(notificationId) {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    // 清除定时器
    if (notification.timer) {
      clearTimeout(notification.timer);
    }

    // 移除键盘事件监听器（模态框）
    if (notification.element._keyHandler) {
      document.removeEventListener('keydown', notification.element._keyHandler);
    }

    // 退场动画
    notification.element.style.transition = 'all 0.3s ease';
    notification.element.style.opacity = '0';
    notification.element.style.transform = 'translateX(100%)';

    // 移除元素
    setTimeout(() => {
      if (notification.element.parentNode) {
        notification.element.parentNode.removeChild(notification.element);
      }
    }, 300);

    // 从管理器移除
    this.notifications.delete(notificationId);
    this.stats.dismissed++;
  }

  // 移除最旧的通知
  removeOldestNotification() {
    const oldestId = Array.from(this.notifications.keys())[0];
    if (oldestId) {
      this.removeNotification(oldestId);
    }
  }

  // 清除所有通知
  clearAllNotifications() {
    const notificationIds = Array.from(this.notifications.keys());
    notificationIds.forEach(id => this.removeNotification(id));
  }

  // 添加通知到管理器
  addNotification(notification) {
    if (!notification.id) {
      notification.id = ++this.notificationId;
    }

    this.notifications.set(notification.id, {
      data: notification,
      element: null,
      timer: null,
      timestamp: Date.now()
    });

    return notification.id;
  }

  // 绑定全局事件
  bindGlobalEvents() {
    // 页面可见性变化
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // 页面隐藏时暂停所有自动关闭
        this.notifications.forEach((notification, id) => {
          this.pauseAutoClose(id);
        });
      } else {
        // 页面显示时恢复自动关闭
        this.notifications.forEach((notification, id) => {
          this.resumeAutoClose(id);
        });
      }
    });
  }

  // 工具方法
  validateType(type) {
    const validTypes = ['success', 'error', 'warning', 'info'];
    return validTypes.includes(type) ? type : 'info';
  }

  getTypeColor(type) {
    const colors = {
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    };
    return colors[type] || colors.info;
  }

  getTypeIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || icons.info;
  }

  getModalWidth(size) {
    const widths = {
      small: '400px',
      medium: '600px',
      large: '800px'
    };
    return widths[size] || widths.medium;
  }

  getButtonStyles(type) {
    const baseStyles = `
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      margin-left: 8px;
      transition: all 0.2s ease;
    `;

    const typeStyles = {
      primary: `
        background: #007bff;
        color: white;
      `,
      secondary: `
        background: #6c757d;
        color: white;
      `
    };

    return baseStyles + (typeStyles[type] || typeStyles.primary);
  }

  // 播放通知声音
  playNotificationSound(type) {
    if (!this.config.soundEnabled) return;

    try {
      // 简单的音频反馈
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const frequencies = {
        success: 800,
        error: 300,
        warning: 600,
        info: 500
      };

      oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
      console.warn('播放通知声音失败:', error);
    }
  }

  // 配置管理
  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // 更新容器位置
    if (this.container && newConfig.position) {
      this.container.className = `notification-container notification-${this.config.position}`;
      this.container.style.cssText = `
        position: fixed;
        z-index: 10000;
        pointer-events: none;
        ${this.getPositionStyles()}
      `;
    }
  }

  getConfig() {
    return { ...this.config };
  }

  // 获取通知统计
  getNotificationStats() {
    return {
      ...this.stats,
      activeCount: this.notifications.size,
      config: this.config
    };
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      isInitialized: this.isInitialized,
      containerExists: !!this.container,
      activeNotifications: this.notifications.size,
      stats: this.stats,
      config: this.config,
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    // 清除所有通知
    this.clearAllNotifications();
    
    // 移除容器
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // 重置状态
    this.container = null;
    this.isInitialized = false;
    this.notifications.clear();
    this.notificationQueue = [];
  }
}

export default NotificationService;