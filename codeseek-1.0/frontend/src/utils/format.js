// 格式化工具函数

// 格式化日期
export function formatDate(date, format = 'short') {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const options = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    }
  };

  try {
    return d.toLocaleDateString('zh-CN', options[format] || options.short);
  } catch (error) {
    return d.toLocaleDateString();
  }
}

// 格式化相对时间
export function formatRelativeTime(date) {
  if (!date) return '';
  
  const now = new Date();
  const target = new Date(date);
  const diff = now - target;
  
  if (isNaN(diff)) return '';
  
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < week) {
    return `${Math.floor(diff / day)}天前`;
  } else if (diff < month) {
    return `${Math.floor(diff / week)}周前`;
  } else if (diff < year) {
    return `${Math.floor(diff / month)}月前`;
  } else {
    return `${Math.floor(diff / year)}年前`;
  }
}

// 格式化文件大小
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 截断字符串
export function truncate(str, length, suffix = '...') {
  if (!str || str.length <= length) return str;
  return str.substring(0, length) + suffix;
}

// 截断URL显示
export function truncateUrl(url, maxLength = 50) {
  if (!url || url.length <= maxLength) return url;
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;
    
    if (hostname.length + pathname.length <= maxLength) {
      return hostname + pathname;
    }
    
    const pathLength = maxLength - hostname.length - 3; // 3 for '...'
    if (pathLength > 0) {
      return hostname + pathname.substring(0, pathLength) + '...';
    }
    
    return hostname.substring(0, maxLength - 3) + '...';
  } catch (error) {
    return url.substring(0, maxLength - 3) + '...';
  }
}

// 转义HTML
export function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  return String(text).replace(/[&<>"'/]/g, s => map[s]);
}

// 反转义HTML
export function unescapeHtml(text) {
  if (!text) return '';
  const map = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&#x2F;': '/'
  };
  return String(text).replace(/&(amp|lt|gt|quot|#039|#x2F);/g, s => map[s]);
}

// 移除HTML标签
export function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// 首字母大写
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 驼峰转短横线
export function kebabCase(str) {
  if (!str) return '';
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// 短横线转驼峰
export function camelCase(str) {
  if (!str) return '';
  return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
}