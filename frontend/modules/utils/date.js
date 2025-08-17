/**
 * 日期时间工具函数
 */
export const DateUtils = {
  // 格式化日期
  formatDate(date, format = 'short') {
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
  },

  // 格式化相对时间
  formatRelativeTime(date) {
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
  },

  // 获取时间戳
  getTimestamp() {
    return Date.now();
  },

  // 检查是否为今天
  isToday(date) {
    const today = new Date();
    const target = new Date(date);
    
    return today.getDate() === target.getDate() &&
           today.getMonth() === target.getMonth() &&
           today.getFullYear() === target.getFullYear();
  },

  // 检查是否为本周
  isThisWeek(date) {
    const now = new Date();
    const target = new Date(date);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    return target >= weekStart;
  },

  // 检查是否为本月
  isThisMonth(date) {
    const now = new Date();
    const target = new Date(date);
    
    return now.getMonth() === target.getMonth() &&
           now.getFullYear() === target.getFullYear();
  }
};

export default DateUtils;