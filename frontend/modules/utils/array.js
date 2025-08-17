/**
 * 数组工具函数
 */
export const ArrayUtils = {
  // 移除重复项
  unique(arr, key = null) {
    if (!Array.isArray(arr)) return [];
    
    if (key) {
      const seen = new Set();
      return arr.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        if (seen.has(val)) {
          return false;
        }
        seen.add(val);
        return true;
      });
    }
    return [...new Set(arr)];
  },

  // 分组
  groupBy(arr, key) {
    if (!Array.isArray(arr)) return {};
    
    return arr.reduce((groups, item) => {
      const val = typeof key === 'function' ? key(item) : item[key];
      groups[val] = groups[val] || [];
      groups[val].push(item);
      return groups;
    }, {});
  },

  // 排序
  sortBy(arr, key, desc = false) {
    if (!Array.isArray(arr)) return [];
    
    return [...arr].sort((a, b) => {
      const aVal = typeof key === 'function' ? key(a) : a[key];
      const bVal = typeof key === 'function' ? key(b) : b[key];
      
      if (aVal < bVal) return desc ? 1 : -1;
      if (aVal > bVal) return desc ? -1 : 1;
      return 0;
    });
  },

  // 分块
  chunk(arr, size) {
    if (!Array.isArray(arr) || size <= 0) return [];
    
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  },

  // 随机排序
  shuffle(arr) {
    if (!Array.isArray(arr)) return [];
    
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  // 查找差异
  difference(arr1, arr2, key = null) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
    
    if (key) {
      const set2 = new Set(arr2.map(item => typeof key === 'function' ? key(item) : item[key]));
      return arr1.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        return !set2.has(val);
      });
    }
    
    const set2 = new Set(arr2);
    return arr1.filter(item => !set2.has(item));
  },

  // 交集
  intersection(arr1, arr2, key = null) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
    
    if (key) {
      const set2 = new Set(arr2.map(item => typeof key === 'function' ? key(item) : item[key]));
      return arr1.filter(item => {
        const val = typeof key === 'function' ? key(item) : item[key];
        return set2.has(val);
      });
    }
    
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
  },

  // 合并去重
  union(arr1, arr2, key = null) {
    if (!Array.isArray(arr1)) arr1 = [];
    if (!Array.isArray(arr2)) arr2 = [];
    
    return this.unique([...arr1, ...arr2], key);
  },

  // 分页
  paginate(arr, page = 1, pageSize = 10) {
    if (!Array.isArray(arr)) return { items: [], total: 0, page: 1, pageSize, totalPages: 0 };
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const items = arr.slice(startIndex, endIndex);
    const total = arr.length;
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }
};

export default ArrayUtils;