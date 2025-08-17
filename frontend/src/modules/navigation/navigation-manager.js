import { isDevEnv } from '../utils/common.js';
import { toast } from '../ui/toast.js';
import { loading } from '../ui/loading.js';
import { APP_CONSTANTS } from '../../shared/constants.js';

/**
 * 导航管理器
 */
export class NavigationManager {
  constructor() {
    this.currentPage = this.getCurrentPage();
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    this.bindNavigationEvents();
    this.handleInitialNavigation();
    this.isInitialized = true;
  }

  bindNavigationEvents() {
    // 监听浏览器前进后退
    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });

    // 绑定导航链接
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (link && this.isInternalLink(link.href)) {
        event.preventDefault();
        this.navigateTo(link.href);
      }
    });
  }

  handleInitialNavigation() {
    // 处理页面重定向问题
    this.handleRedirectIssues();
    
    // 处理URL参数
    this.handleURLParams();
  }

  handleRedirectIssues() {
    const isDev = isDevEnv();
    
    if (!isDev) {
      return; // 生产环境不做任何"修正"，避免与 Clean URLs 冲突
    }

    // 开发环境纠正到 .html，方便本地静态文件访问
    if (!window.location.pathname.endsWith('.html')) {
      if (window.location.pathname.endsWith('/dashboard')) {
        window.location.replace('./dashboard.html' + window.location.search);
        return;
      }
      if (window.location.pathname.endsWith('/index') || window.location.pathname === '/') {
        window.location.replace('./index.html' + window.location.search);
        return;
      }
    }
  }

  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && this.currentPage === 'index') {
      // 延迟执行搜索，等待应用初始化完成
      setTimeout(() => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput && window.searchManager) {
          searchInput.value = searchQuery;
          window.searchManager.performSearch();
        }
      }, 1000);
    }
  }

  handlePopState(event) {
    const newPage = this.getCurrentPage();
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      console.log('页面导航:', newPage);
    }
  }

  getCurrentPage() {
    const pathname = window.location.pathname;
    
    if (pathname.includes('dashboard')) {
      return 'dashboard';
    } else if (pathname.includes('index') || pathname === '/' || pathname === '') {
      return 'index';
    }
    
    return 'unknown';
  }

  isInternalLink(href) {
    try {
      const url = new URL(href, window.location.origin);
      return url.origin === window.location.origin;
    } catch (error) {
      return false;
    }
  }

  async navigateTo(url, options = {}) {
    const { useReplace = false, retryOnError = true, maxRetries = 2, timeout = 5000 } = options;
    const isDev = isDevEnv();

    return new Promise((resolve, reject) => {
      try {
        // 统一前缀
        let target = url.startsWith('./') || url.startsWith('/') ? url : `./${url}`;

        // 开发环境：确保有 .html 后缀；生产环境：确保没有 .html 后缀
        if (isDev) {
          if (!/\.html(\?|$)/i.test(target)) {
            const [path, query = ''] = target.split('?');
            target = path.replace(/\/$/, '') + '.html' + (query ? '?' + query : '');
          }
        } else {
          // 去掉 .html（让 Cloudflare Pages 的 clean URLs 工作）
          target = target.replace(/\.html(\?|$)/i, (_, q) => q || '');
        }

        console.log(`📄 导航到: ${target} (${isDev ? '开发' : '生产'}环境)`);

        // 进行跳转
        if (useReplace) {
          window.location.replace(target);
        } else {
          window.location.href = target;
        }

        // 超时保护
        const timeoutId = setTimeout(() => {
          reject(new Error('导航超时'));
        }, timeout);

        // 页面跳转后这段一般不会执行到 resolve
        // 但为了完整性还是保留
        setTimeout(() => {
          clearTimeout(timeoutId);
          resolve();
        }, 100);

      } catch (error) {
        console.error('页面导航失败:', error);
        
        if (retryOnError && maxRetries > 0) {
          console.warn('导航失败，重试中...', error);
          setTimeout(() => {
            this.navigateTo(url, { ...options, maxRetries: maxRetries - 1 })
              .then(resolve)
              .catch(reject);
          }, 1000);
        } else {
          reject(error);
        }
      }
    });
  }

  async navigateToDashboard() {
    try {
      loading.show();

      const authToken = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      if (!authToken) {
        throw new Error('用户未登录');
      }

      console.log('🏠 导航到Dashboard');

      // 生产环境跳 /dashboard（无 .html），开发环境会在 navigateTo 内自动补 .html
      await this.navigateTo('dashboard', { useReplace: true });

    } catch (error) {
      console.error('跳转到dashboard失败:', error);
      toast.error('跳转失败: ' + error.message);

      if (error.message.includes('认证') || error.message.includes('未登录')) {
        if (window.modal) {
          window.modal.showLogin();
        }
      }
    } finally {
      loading.hide();
    }
  }

  async navigateToIndex() {
    try {
      await this.navigateTo('index');
    } catch (error) {
      console.error('跳转到首页失败:', error);
      toast.error('跳转失败: ' + error.message);
    }
  }

  // 刷新当前页面
  refresh() {
    window.location.reload();
  }

  // 后退
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigateToIndex();
    }
  }

  // 前进
  goForward() {
    window.history.forward();
  }

  // 更新URL参数而不重新加载页面
  updateURL(params, replace = false) {
    const url = new URL(window.location);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  }

  // 获取当前URL参数
  getURLParams() {
    return Object.fromEntries(new URLSearchParams(window.location.search));
  }

  // 检查当前页面
  isCurrentPage(pageName) {
    return this.currentPage === pageName;
  }

  // 获取页面标题
  getPageTitle() {
    const titles = {
      index: '磁力快搜 - 专业版',
      dashboard: '用户面板 - 磁力快搜'
    };
    
    return titles[this.currentPage] || '磁力快搜';
  }

  // 设置页面标题
  setPageTitle(title) {
    document.title = title;
  }

  // 添加面包屑导航
  updateBreadcrumb(items) {
    const breadcrumb = document.querySelector('.breadcrumb');
    if (!breadcrumb) return;

    breadcrumb.innerHTML = items.map((item, index) => {
      const isLast = index === items.length - 1;
      if (isLast) {
        return `<span class="breadcrumb-item active">${item.text}</span>`;
      } else {
        return `<a href="${item.href}" class="breadcrumb-item">${item.text}</a>`;
      }
    }).join('<span class="breadcrumb-separator">/</span>');
  }

  // 检查是否可以访问某个页面
  canAccessPage(pageName) {
    const protectedPages = ['dashboard'];
    
    if (protectedPages.includes(pageName)) {
      const token = localStorage.getItem(APP_CONSTANTS.STORAGE.KEYS.AUTH_TOKEN);
      return !!token;
    }
    
    return true;
  }

  // 重定向到登录页面
  redirectToLogin(returnUrl = null) {
    const currentUrl = returnUrl || window.location.pathname + window.location.search;
    this.updateURL({ return: currentUrl }, true);
    
    if (window.modal) {
      window.modal.showLogin();
    } else {
      this.navigateToIndex();
    }
  }

  // 处理登录后的重定向
  handlePostLoginRedirect() {
    const params = this.getURLParams();
    const returnUrl = params.return;
    
    if (returnUrl) {
      this.navigateTo(returnUrl);
    }
  }
}

// 创建全局实例
export const navigationManager = new NavigationManager();

// 全局导航函数（向后兼容）
export function navigateToDashboard() {
  return navigationManager.navigateToDashboard();
}

export function navigateToPage(url, options = {}) {
  return navigationManager.navigateTo(url, options);
}