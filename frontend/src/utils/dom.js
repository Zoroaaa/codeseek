// DOM操作工具函数

// 显示加载动画
export function showLoading(show) {
  const loading = document.getElementById('loading');
  if (!loading) return;

  loading.style.display = show ? 'flex' : 'none';
  
  // 防止页面滚动
  if (show) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
}

// 显示Toast通知
export function showToast(message, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  // 清除之前的类
  toast.className = 'toast';
  toast.textContent = message;
  
  // 添加类型和显示类
  toast.classList.add(type, 'show');

  // 自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
  }, duration);

  // 点击关闭
  toast.onclick = () => {
    toast.classList.remove('show');
  };
}

// 显示模态框
export function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.style.display = 'flex';
  modal.classList.add('show');
  
  // 防止页面滚动
  document.body.style.overflow = 'hidden';
  
  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideModal(modalId);
    }
  });
}

// 隐藏模态框
export function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.style.display = 'none';
  modal.classList.remove('show');
  
  // 恢复页面滚动
  document.body.style.overflow = '';
}

// 切换模态框显示状态
export function toggleModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (modal.style.display === 'flex' || modal.classList.contains('show')) {
    hideModal(modalId);
  } else {
    showModal(modalId);
  }
}

// 元素选择器增强
export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// 创建DOM元素
export function createElement(tag, options = {}) {
  const element = document.createElement(tag);
  
  if (options.className) {
    element.className = options.className;
  }
  
  if (options.id) {
    element.id = options.id;
  }
  
  if (options.text) {
    element.textContent = options.text;
  }
  
  if (options.html) {
    element.innerHTML = options.html;
  }
  
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  }
  
  if (options.events) {
    Object.entries(options.events).forEach(([event, handler]) => {
      element.addEventListener(event, handler);
    });
  }
  
  return element;
}

// 添加事件监听器（支持事件委托）
export function on(element, event, selector, handler) {
  if (typeof selector === 'function') {
    handler = selector;
    selector = null;
  }
  
  element.addEventListener(event, (e) => {
    if (selector) {
      const target = e.target.closest(selector);
      if (target && element.contains(target)) {
        handler.call(target, e);
      }
    } else {
      handler.call(element, e);
    }
  });
}

// 移除元素
export function remove(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

// 添加CSS类
export function addClass(element, className) {
  if (element) {
    element.classList.add(className);
  }
}

// 移除CSS类
export function removeClass(element, className) {
  if (element) {
    element.classList.remove(className);
  }
}

// 切换CSS类
export function toggleClass(element, className) {
  if (element) {
    element.classList.toggle(className);
  }
}

// 检查是否有CSS类
export function hasClass(element, className) {
  return element ? element.classList.contains(className) : false;
}

// 设置元素样式
export function setStyle(element, styles) {
  if (!element) return;
  
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
}

// 获取元素位置和尺寸
export function getRect(element) {
  if (!element) return null;
  return element.getBoundingClientRect();
}

// 检查元素是否在视口中
export function isInViewport(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// 平滑滚动到元素
export function scrollToElement(element, options = {}) {
  if (!element) return;
  
  const defaultOptions = {
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest'
  };
  
  element.scrollIntoView({ ...defaultOptions, ...options });
}

// 复制文本到剪贴板
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // 降级到旧方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      return success;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

// 下载文件
export function downloadFile(content, filename, contentType = 'application/json') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 读取文件
export function readFile(file, type = 'text') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    
    switch (type) {
      case 'text':
        reader.readAsText(file);
        break;
      case 'dataURL':
        reader.readAsDataURL(file);
        break;
      case 'arrayBuffer':
        reader.readAsArrayBuffer(file);
        break;
      default:
        reader.readAsText(file);
    }
  });
}