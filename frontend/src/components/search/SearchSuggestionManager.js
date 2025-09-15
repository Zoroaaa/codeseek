// src/components/search/SearchSuggestionManager.js - 搜索建议管理子组件
import { escapeHtml } from '../../utils/format.js';
import { debounce } from '../../utils/helpers.js';
import searchService from '../../services/search.js';

export class SearchSuggestionManager {
  constructor() {
    this.searchHistory = [];
    this.currentSuggestions = [];
    this.isVisible = false;
    this.selectedIndex = -1;
  }

  /**
   * 初始化建议管理器
   */
  async init() {
    try {
      this.bindSuggestionEvents();
      console.log('搜索建议管理器初始化完成');
    } catch (error) {
      console.error('搜索建议管理器初始化失败:', error);
    }
  }

  /**
   * 设置搜索历史
   */
  setSearchHistory(history) {
    this.searchHistory = history || [];
  }

  /**
   * 处理搜索输入
   */
  handleSearchInput(value) {
    if (value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
  }

  /**
   * 显示搜索建议
   */
  showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') {
      this.hideSearchSuggestions();
      return;
    }
    
    const suggestions = this.getSearchSuggestions(query);
    if (suggestions.length > 0) {
      this.renderSearchSuggestions(suggestions);
      this.isVisible = true;
      this.selectedIndex = -1;
    } else {
      this.hideSearchSuggestions();
    }
  }

  /**
   * 获取搜索建议
   */
  getSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return [];
    
    // 使用搜索服务获取建议
    const serviceSuggestions = searchService.getSearchSuggestions(query, this.searchHistory);
    
    // 从历史记录中获取匹配的建议
    const queryLower = query.toLowerCase();
    const historySuggestions = this.searchHistory
      .filter(item => item.keyword.toLowerCase().includes(queryLower))
      .slice(0, 5)
      .map(item => ({
        type: 'history',
        keyword: item.keyword,
        query: item.keyword,
        count: item.count || 1,
        timestamp: item.timestamp
      }));

    // 合并并去重建议
    const allSuggestions = [...serviceSuggestions, ...historySuggestions];
    const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.keyword === suggestion.keyword)
    );

    // 按相关性和使用频率排序
    return uniqueSuggestions
      .sort((a, b) => {
        // 优先显示完全匹配的
        const aExactMatch = a.keyword.toLowerCase() === queryLower;
        const bExactMatch = b.keyword.toLowerCase() === queryLower;
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;

        // 其次按使用频率排序
        const aCount = a.count || 0;
        const bCount = b.count || 0;
        if (aCount !== bCount) return bCount - aCount;

        // 最后按时间排序
        const aTime = a.timestamp || 0;
        const bTime = b.timestamp || 0;
        return bTime - aTime;
      })
      .slice(0, 8); // 最多显示8个建议
  }

  /**
   * 渲染搜索建议
   */
  renderSearchSuggestions(suggestions) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'searchSuggestions';
      suggestionsContainer.className = 'search-suggestions';
      
      const searchInput = document.getElementById('searchInput');
      if (searchInput && searchInput.parentNode) {
        searchInput.parentNode.appendChild(suggestionsContainer);
      }
    }
    
    if (suggestions.length === 0) {
      suggestionsContainer.style.display = 'none';
      this.isVisible = false;
      return;
    }
    
    this.currentSuggestions = suggestions;
    
    suggestionsContainer.innerHTML = suggestions.map((item, index) => {
      const displayText = item.keyword || item.query;
      const suggestionIcon = this.getSuggestionIcon(item.type);
      const frequencyInfo = item.count > 1 ? `<small class="suggestion-count">${item.count}次</small>` : '';
      
      return `
        <div class="suggestion-item ${index === this.selectedIndex ? 'selected' : ''}" 
             data-index="${index}" 
             data-keyword="${escapeHtml(displayText)}">
          <span class="suggestion-icon">${suggestionIcon}</span>
          <span class="suggestion-text">${escapeHtml(displayText)}</span>
          ${frequencyInfo}
        </div>
      `;
    }).join('');
    
    suggestionsContainer.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * 获取建议图标
   */
  getSuggestionIcon(type) {
    const icons = {
      'history': '🕐',
      'popular': '🔥',
      'recent': '⭐',
      'trending': '📈',
      'suggestion': '💡'
    };
    return icons[type] || '🔍';
  }

  /**
   * 隐藏搜索建议
   */
  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
    this.isVisible = false;
    this.selectedIndex = -1;
    this.currentSuggestions = [];
  }

  /**
   * 处理键盘导航
   */
  handleKeyNavigation(event) {
    if (!this.isVisible || this.currentSuggestions.length === 0) return false;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.currentSuggestions.length - 1);
        this.updateSelection();
        return true;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        return true;

      case 'Enter':
        if (this.selectedIndex >= 0 && this.selectedIndex < this.currentSuggestions.length) {
          event.preventDefault();
          const selectedSuggestion = this.currentSuggestions[this.selectedIndex];
          this.selectSuggestion(selectedSuggestion.keyword);
          return true;
        }
        break;

      case 'Escape':
        this.hideSearchSuggestions();
        return true;

      case 'Tab':
        // Tab键自动完成第一个建议
        if (this.currentSuggestions.length > 0) {
          event.preventDefault();
          const firstSuggestion = this.currentSuggestions[0];
          this.selectSuggestion(firstSuggestion.keyword);
          return true;
        }
        break;
    }

    return false;
  }

  /**
   * 更新选择状态
   */
  updateSelection() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) return;

    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });

    // 滚动到选中项
    if (this.selectedIndex >= 0) {
      const selectedItem = items[this.selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }

  /**
   * 选择建议
   */
  selectSuggestion(keyword) {
    // 触发建议选择事件
    document.dispatchEvent(new CustomEvent('suggestionSelected', {
      detail: { keyword }
    }));
    
    // 隐藏建议列表
    this.hideSearchSuggestions();
  }

  /**
   * 获取当前选中的建议
   */
  getCurrentSelection() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.currentSuggestions.length) {
      return this.currentSuggestions[this.selectedIndex];
    }
    return null;
  }

  /**
   * 绑定建议事件
   */
  bindSuggestionEvents() {
    // 绑定搜索输入事件
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      // 输入事件 - 使用防抖
      searchInput.addEventListener('input', debounce((e) => {
        this.handleSearchInput(e.target.value);
      }, 300));

      // 焦点事件
      searchInput.addEventListener('focus', () => {
        const value = searchInput.value.trim();
        if (value) {
          this.showSearchSuggestions(value);
        }
      });

      // 失焦事件 - 延迟隐藏，让点击事件有时间处理
      searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });

      // 键盘事件
      searchInput.addEventListener('keydown', (e) => {
        this.handleKeyNavigation(e);
      });
    }

    // 绑定建议点击事件
    document.addEventListener('click', (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      if (suggestionItem) {
        const keyword = suggestionItem.dataset.keyword;
        const index = parseInt(suggestionItem.dataset.index);
        
        // 更新选中状态
        this.selectedIndex = index;
        this.updateSelection();
        
        // 选择建议
        this.selectSuggestion(keyword);
      }
    });

    // 绑定鼠标悬停事件
    document.addEventListener('mouseover', (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      if (suggestionItem && this.isVisible) {
        const index = parseInt(suggestionItem.dataset.index);
        this.selectedIndex = index;
        this.updateSelection();
      }
    });

    // 监听历史变更事件
    document.addEventListener('historyUpdated', (e) => {
      this.setSearchHistory(e.detail.history);
    });
  }

  /**
   * 添加自定义建议
   */
  addCustomSuggestion(suggestion) {
    if (!suggestion || !suggestion.keyword) return;

    // 添加到当前建议列表
    const exists = this.currentSuggestions.find(s => s.keyword === suggestion.keyword);
    if (!exists) {
      this.currentSuggestions.unshift({
        type: 'custom',
        ...suggestion
      });
      
      // 重新渲染
      if (this.isVisible) {
        this.renderSearchSuggestions(this.currentSuggestions);
      }
    }
  }

  /**
   * 移除建议
   */
  removeSuggestion(keyword) {
    this.currentSuggestions = this.currentSuggestions.filter(s => s.keyword !== keyword);
    
    if (this.isVisible) {
      this.renderSearchSuggestions(this.currentSuggestions);
    }
  }

  /**
   * 清空所有建议
   */
  clearSuggestions() {
    this.currentSuggestions = [];
    this.hideSearchSuggestions();
  }

  /**
   * 设置建议过滤器
   */
  setSuggestionFilter(filterFn) {
    this.customFilter = filterFn;
  }

  /**
   * 获取建议统计
   */
  getSuggestionStats() {
    return {
      currentCount: this.currentSuggestions.length,
      isVisible: this.isVisible,
      selectedIndex: this.selectedIndex,
      historyCount: this.searchHistory.length,
      suggestionTypes: this.currentSuggestions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * 导出建议配置
   */
  exportSuggestionConfig() {
    return {
      searchHistory: this.searchHistory.slice(0, 20), // 只导出最近20条
      recentSuggestions: this.currentSuggestions,
      settings: {
        maxSuggestions: 8,
        enableKeyboardNav: true,
        enableMouseHover: true,
        debounceDelay: 300
      },
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 预加载热门建议
   */
  async preloadPopularSuggestions() {
    try {
      // 这里可以从API获取热门搜索词
      const popularKeywords = [
        '最新', '高清', '完整版', '免费', '在线'
      ];

      const popularSuggestions = popularKeywords.map(keyword => ({
        type: 'popular',
        keyword,
        query: keyword,
        count: Math.floor(Math.random() * 100) + 50 // 模拟使用次数
      }));

      // 可以将这些建议缓存起来，在用户输入时优先显示
      this.popularSuggestions = popularSuggestions;
      
    } catch (error) {
      console.warn('预加载热门建议失败:', error);
    }
  }

  /**
   * 获取相关建议
   */
  getRelatedSuggestions(keyword) {
    if (!keyword) return [];

    // 基于关键词生成相关建议
    const relatedTerms = [];
    
    // 添加常见的修饰词
    const modifiers = ['高清', '完整版', '最新', '免费', '在线'];
    modifiers.forEach(modifier => {
      if (!keyword.includes(modifier)) {
        relatedTerms.push(`${keyword} ${modifier}`);
      }
    });

    // 从历史记录中查找相关项
    const historyRelated = this.searchHistory
      .filter(item => {
        const itemWords = item.keyword.toLowerCase().split(/\s+/);
        const keywordWords = keyword.toLowerCase().split(/\s+/);
        return itemWords.some(word => keywordWords.includes(word));
      })
      .slice(0, 3);

    return [...relatedTerms.slice(0, 3), ...historyRelated.map(h => h.keyword)]
      .filter(term => term !== keyword)
      .slice(0, 5);
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.hideSearchSuggestions();
    this.currentSuggestions = [];
    this.searchHistory = [];
    this.selectedIndex = -1;
    this.isVisible = false;
    
    // 移除建议容器
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }
    
    console.log('搜索建议管理器资源已清理');
  }
}

export default SearchSuggestionManager;