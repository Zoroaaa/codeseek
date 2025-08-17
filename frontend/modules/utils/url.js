/**
 * URL工具函数
 */
export const URLUtils = {
  // 检查URL是否有效
  isValidURL(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  // 提取域名
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch (_) {
      return '';
    }
  },

  // 添加协议
  addProtocol(url) {
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) {
      return `https://${url}`;
    }
    return url;
  },

  // 构建查询字符串
  buildQueryString(params) {
    return Object.keys(params)
      .filter(key => params[key] !== null && params[key] !== undefined && params[key] !== '')
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
  },

  // 解析查询字符串
  parseQueryString(queryString) {
    const params = {};
    if (!queryString) return params;
    
    const pairs = (queryString.startsWith('?') ? queryString.slice(1) : queryString).split('&');
    
    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
      }
    });
    
    return params;
  },

  // 获取文件扩展名
  getFileExtension(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const lastDot = pathname.lastIndexOf('.');
      
      if (lastDot > 0) {
        return pathname.slice(lastDot + 1).toLowerCase();
      }
    } catch (error) {
      console.error('获取文件扩展名失败:', error);
    }
    
    return '';
  },

  // 截断URL显示
  truncateUrl(url, maxLength = 50) {
    if (!url || url.length <= maxLength) return url;
    
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      
      if (domain.length + path.length <= maxLength) {
        return `${domain}${path}`;
      }
      
      const availableLength = maxLength - domain.length - 3; // 3 for '...'
      if (availableLength > 0) {
        return `${domain}${path.substring(0, availableLength)}...`;
      }
      
      return domain.length <= maxLength ? domain : domain.substring(0, maxLength - 3) + '...';
    } catch (error) {
      return url.length <= maxLength ? url : url.substring(0, maxLength - 3) + '...';
    }
  },

  // 获取当前页面的查询参数
  getCurrentParams() {
    return this.parseQueryString(window.location.search);
  },

  // 更新当前页面的查询参数
  updateCurrentParams(newParams, replace = false) {
    const currentParams = this.getCurrentParams();
    const updatedParams = { ...currentParams, ...newParams };
    
    // 移除值为null或undefined的参数
    Object.keys(updatedParams).forEach(key => {
      if (updatedParams[key] === null || updatedParams[key] === undefined) {
        delete updatedParams[key];
      }
    });
    
    const queryString = this.buildQueryString(updatedParams);
    const newUrl = window.location.pathname + (queryString ? '?' + queryString : '');
    
    if (replace) {
      window.history.replaceState({}, '', newUrl);
    } else {
      window.history.pushState({}, '', newUrl);
    }
  }
};

export default URLUtils;