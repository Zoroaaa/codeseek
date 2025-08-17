/**
 * 字符串工具函数
 */
export const StringUtils = {
  // 截断字符串
  truncate(str, length, suffix = '...') {
    if (!str || str.length <= length) return str;
    return str.substring(0, length) + suffix;
  },

  // 移除HTML标签
  stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },

  // 转义HTML
  escapeHtml(text) {
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
  },

  // 反转义HTML
  unescapeHtml(text) {
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
  },

  // 首字母大写
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // 驼峰转短横线
  kebabCase(str) {
    if (!str) return '';
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  },

  // 短横线转驼峰
  camelCase(str) {
    if (!str) return '';
    return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
  },

  // 生成随机字符串
  random(length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // 格式化文件大小
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
};

export default StringUtils;