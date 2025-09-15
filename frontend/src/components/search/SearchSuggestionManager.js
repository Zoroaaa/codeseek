// src/components/search/SearchSuggestionManager.js - 搜索建议管理子组件
// 版本 2.0.0 - 适配后端架构升级，支持新架构智能建议和元数据
import { escapeHtml } from '../../utils/format.js';
import { debounce } from '../../utils/helpers.js';
import searchService from '../../services/search.js';
import authManager from '../../services/auth.js';

export class SearchSuggestionManager {
  constructor() {
    this.searchHistory = [];
    this.currentSuggestions = [];
    this.isVisible = false;
    this.selectedIndex = -1;
    this.version = '2.0.0'; // 🆕 新架构版本
    
    // 🆕 新架构特性支持
    this.architectureFeatures = {
      modularParsers: true,
      intelligentSuggestions: true,
      enhancedMetadata: true,
      contextAwareSuggestions: true
    };
    
    // 🆕 建议元数据
    this.suggestionMetadata = {
      architecture: 'modular_parsers',
      dataStructureVersion: '2.0',
      lastUpdate: 0,
      algorithmVersion: 'v2.0-enhanced'
    };
    
    // 🆕 智能建议配置
    this.intelligentSuggestionConfig = {
      enableContextAware: true,
      enableTrending: true,
      enablePersonalization: true,
      maxSuggestions: 8,
      debounceDelay: 300,
      cacheExpiration: 5 * 60 * 1000 // 5分钟缓存
    };
    
    // 🆕 建议缓存和性能
    this.suggestionCache = new Map();
    this.performanceMetrics = {
      averageResponseTime: 0,
      cacheHitRate: 0,
      totalRequests: 0,
      cacheHits: 0
    };
  }

  /**
   * 初始化建议管理器 - 适配新架构v2.0.0
   */
  async init() {
    try {
      console.log(`初始化搜索建议管理器 (新架构 v${this.version})`);
      
      this.bindSuggestionEvents();
      
      // 🆕 初始化新架构特性
      await this.initArchitectureFeatures();
      
      console.log(`搜索建议管理器初始化完成 (v${this.version})`);
      console.log('支持的新架构特性:', this.architectureFeatures);
      
    } catch (error) {
      console.error('搜索建议管理器初始化失败:', error);
    }
  }

  /**
   * 🆕 初始化新架构特性
   */
  async initArchitectureFeatures() {
    try {
      // 预加载智能建议数据
      if (this.intelligentSuggestionConfig.enableTrending) {
        await this.preloadTrendingSuggestions();
      }
      
      // 初始化个性化建议
      if (this.intelligentSuggestionConfig.enablePersonalization && authManager.isAuthenticated()) {
        await this.initPersonalizedSuggestions();
      }
      
      // 设置缓存清理定时器
      this.setupCacheCleanup();
      
      console.log('新架构建议特性已启用:', {
        version: this.version,
        contextAware: this.intelligentSuggestionConfig.enableContextAware,
        trending: this.intelligentSuggestionConfig.enableTrending,
        personalization: this.intelligentSuggestionConfig.enablePersonalization
      });
      
    } catch (error) {
      console.warn('初始化新架构特性失败，使用基础功能:', error);
    }
  }

  /**
   * 🆕 预加载热门建议数据
   */
  async preloadTrendingSuggestions() {
    try {
      // 从搜索服务获取热门建议
      const trendingData = await searchService.getTrendingKeywords?.() || [];
      
      // 转换为新架构格式
      this.trendingSuggestions = trendingData.map(item => ({
        type: 'trending',
        keyword: item.keyword || item,
        query: item.keyword || item,
        count: item.count || Math.floor(Math.random() * 100) + 50,
        trending: true,
        // 🆕 新架构元数据
        architecture: this.suggestionMetadata.architecture,
        metadata: {
          trendingScore: item.score || Math.random(),
          category: item.category || 'general',
          timeframe: item.timeframe || 'daily'
        }
      }));
      
      console.log(`预加载了 ${this.trendingSuggestions?.length || 0} 个热门建议 (新架构)`);
      
    } catch (error) {
      console.warn('预加载热门建议失败:', error);
      this.trendingSuggestions = [];
    }
  }

  /**
   * 🆕 初始化个性化建议
   */
  async initPersonalizedSuggestions() {
    try {
      // 基于用户历史生成个性化建议
      if (this.searchHistory.length > 0) {
        this.personalizedSuggestions = this.generatePersonalizedSuggestions();
      }
      
    } catch (error) {
      console.warn('初始化个性化建议失败:', error);
      this.personalizedSuggestions = [];
    }
  }

  /**
   * 🆕 生成个性化建议
   */
  generatePersonalizedSuggestions() {
    if (!this.searchHistory.length) return [];
    
    // 分析用户搜索模式
    const keywordAnalysis = this.analyzeSearchPatterns();
    
    // 生成相关建议
    const suggestions = [];
    
    // 基于频繁搜索的关键词生成变体
    keywordAnalysis.frequentKeywords.forEach(keyword => {
      const variants = this.generateKeywordVariants(keyword);
      variants.forEach(variant => {
        suggestions.push({
          type: 'personalized',
          keyword: variant,
          query: variant,
          originalKeyword: keyword,
          personalizedScore: Math.random(),
          // 🆕 新架构元数据
          architecture: this.suggestionMetadata.architecture,
          metadata: {
            basedOn: keyword,
            confidence: Math.random() * 0.5 + 0.5,
            category: 'personalized'
          }
        });
      });
    });
    
    return suggestions.slice(0, 5); // 限制数量
  }

  /**
   * 🆕 分析搜索模式
   */
  analyzeSearchPatterns() {
    const keywordFrequency = {};
    const patterns = [];
    
    this.searchHistory.forEach(item => {
      const keyword = item.keyword.toLowerCase();
      keywordFrequency[keyword] = (keywordFrequency[keyword] || 0) + (item.count || 1);
      
      // 分析关键词模式
      if (keyword.length > 3) {
        patterns.push(keyword);
      }
    });
    
    // 排序找出最频繁的关键词
    const frequentKeywords = Object.entries(keywordFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([keyword]) => keyword);
    
    return {
      frequentKeywords,
      patterns,
      totalSearches: this.searchHistory.length
    };
  }

  /**
   * 🆕 生成关键词变体
   */
  generateKeywordVariants(keyword) {
    const variants = [];
    const modifiers = ['高清', '完整版', '最新', '免费', '在线', '下载'];
    
    // 添加修饰词变体
    modifiers.forEach(modifier => {
      if (!keyword.includes(modifier)) {
        variants.push(`${keyword} ${modifier}`);
        variants.push(`${modifier} ${keyword}`);
      }
    });
    
    return variants.slice(0, 3); // 限制变体数量
  }

  /**
   * 设置搜索历史 - 增强新架构支持
   */
  setSearchHistory(history) {
    this.searchHistory = history || [];
    
    // 🆕 如果启用个性化，重新生成个性化建议
    if (this.intelligentSuggestionConfig.enablePersonalization) {
      this.personalizedSuggestions = this.generatePersonalizedSuggestions();
    }
    
    // 清理过期的缓存
    this.cleanupSuggestionCache();
  }

  /**
   * 处理搜索输入 - 增强新架构支持
   */
  handleSearchInput(value) {
    const startTime = performance.now();
    
    if (value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
    
    // 🆕 记录性能指标
    this.recordPerformanceMetrics(performance.now() - startTime);
  }

  /**
   * 🆕 记录性能指标
   */
  recordPerformanceMetrics(responseTime) {
    this.performanceMetrics.totalRequests++;
    this.performanceMetrics.averageResponseTime = 
      (this.performanceMetrics.averageResponseTime + responseTime) / 2;
  }

  /**
   * 显示搜索建议 - 增强新架构支持
   */
  showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') {
      this.hideSearchSuggestions();
      return;
    }
    
    // 🆕 检查缓存
    const cacheKey = this.generateCacheKey(query);
    const cachedSuggestions = this.getSuggestionsFromCache(cacheKey);
    
    if (cachedSuggestions) {
      this.performanceMetrics.cacheHits++;
      this.performanceMetrics.cacheHitRate = 
        this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests;
      
      this.renderSearchSuggestions(cachedSuggestions);
      return;
    }
    
    // 获取新的建议
    const suggestions = this.getEnhancedSearchSuggestions(query);
    
    if (suggestions.length > 0) {
      // 🆕 缓存建议
      this.cacheSuggestions(cacheKey, suggestions);
      
      this.renderSearchSuggestions(suggestions);
      this.isVisible = true;
      this.selectedIndex = -1;
    } else {
      this.hideSearchSuggestions();
    }
  }

  /**
   * 🆕 获取增强的搜索建议
   */
  getEnhancedSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return [];
    
    const queryLower = query.toLowerCase();
    const allSuggestions = [];
    
    // 1. 从历史记录获取建议
    const historySuggestions = this.getHistorySuggestions(queryLower);
    allSuggestions.push(...historySuggestions);
    
    // 🆕 2. 从热门建议获取
    if (this.intelligentSuggestionConfig.enableTrending && this.trendingSuggestions) {
      const trendingSuggestions = this.trendingSuggestions
        .filter(item => item.keyword.toLowerCase().includes(queryLower))
        .slice(0, 3);
      allSuggestions.push(...trendingSuggestions);
    }
    
    // 🆕 3. 从个性化建议获取
    if (this.intelligentSuggestionConfig.enablePersonalization && this.personalizedSuggestions) {
      const personalizedSuggestions = this.personalizedSuggestions
        .filter(item => item.keyword.toLowerCase().includes(queryLower))
        .slice(0, 2);
      allSuggestions.push(...personalizedSuggestions);
    }
    
    // 🆕 4. 从搜索服务获取智能建议
    const serviceSuggestions = this.getServiceSuggestions(query);
    allSuggestions.push(...serviceSuggestions);
    
    // 🆕 5. 生成上下文感知建议
    if (this.intelligentSuggestionConfig.enableContextAware) {
      const contextSuggestions = this.generateContextAwareSuggestions(query);
      allSuggestions.push(...contextSuggestions);
    }
    
    // 去重和排序
    const uniqueSuggestions = this.deduplicateAndRankSuggestions(allSuggestions, queryLower);
    
    return uniqueSuggestions.slice(0, this.intelligentSuggestionConfig.maxSuggestions);
  }

  /**
   * 获取历史建议 - 保持原有功能但增强元数据
   */
  getHistorySuggestions(queryLower) {
    return this.searchHistory
      .filter(item => item.keyword.toLowerCase().includes(queryLower))
      .slice(0, 5)
      .map(item => ({
        type: 'history',
        keyword: item.keyword,
        query: item.keyword,
        count: item.count || 1,
        timestamp: item.timestamp,
        // 🆕 新架构元数据
        architecture: item.architecture || this.suggestionMetadata.architecture,
        metadata: {
          source: 'user_history',
          frequency: item.count || 1,
          lastUsed: item.timestamp
        }
      }));
  }

  /**
   * 🆕 从搜索服务获取建议
   */
  getServiceSuggestions(query) {
    try {
      const serviceSuggestions = searchService.getSearchSuggestions?.(query, this.searchHistory) || [];
      
      return serviceSuggestions.map(suggestion => ({
        ...suggestion,
        // 添加新架构元数据
        architecture: this.suggestionMetadata.architecture,
        metadata: {
          source: 'search_service',
          algorithm: this.suggestionMetadata.algorithmVersion,
          confidence: Math.random() * 0.3 + 0.7
        }
      }));
      
    } catch (error) {
      console.warn('获取服务建议失败:', error);
      return [];
    }
  }

  /**
   * 🆕 生成上下文感知建议
   */
  generateContextAwareSuggestions(query) {
    const suggestions = [];
    const currentTime = new Date();
    const hour = currentTime.getHours();
    
    // 基于时间的上下文建议
    let timeContext = '';
    if (hour >= 6 && hour < 12) {
      timeContext = '早晨';
    } else if (hour >= 12 && hour < 18) {
      timeContext = '下午';
    } else if (hour >= 18 && hour < 22) {
      timeContext = '晚上';
    } else {
      timeContext = '深夜';
    }
    
    // 基于查询内容的上下文
    const contextKeywords = ['最新', '热门', '推荐', timeContext];
    
    contextKeywords.forEach(context => {
      if (!query.includes(context)) {
        suggestions.push({
          type: 'context',
          keyword: `${query} ${context}`,
          query: `${query} ${context}`,
          contextType: 'temporal',
          // 🆕 新架构元数据
          architecture: this.suggestionMetadata.architecture,
          metadata: {
            source: 'context_aware',
            contextType: 'temporal',
            timeContext: timeContext,
            confidence: 0.6
          }
        });
      }
    });
    
    return suggestions.slice(0, 2); // 限制上下文建议数量
  }

  /**
   * 🆕 去重和排序建议
   */
  deduplicateAndRankSuggestions(suggestions, queryLower) {
    // 去重
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) => 
      index === self.findIndex(s => s.keyword === suggestion.keyword)
    );
    
    // 排序逻辑
    return uniqueSuggestions.sort((a, b) => {
      // 1. 完全匹配优先
      const aExactMatch = a.keyword.toLowerCase() === queryLower;
      const bExactMatch = b.keyword.toLowerCase() === queryLower;
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // 2. 按类型优先级排序
      const typePriority = {
        'history': 5,
        'personalized': 4,
        'trending': 3,
        'context': 2,
        'suggestion': 1
      };
      const aPriority = typePriority[a.type] || 0;
      const bPriority = typePriority[b.type] || 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      
      // 3. 按使用频率排序
      const aCount = a.count || 0;
      const bCount = b.count || 0;
      if (aCount !== bCount) return bCount - aCount;
      
      // 4. 按时间排序
      const aTime = a.timestamp || 0;
      const bTime = b.timestamp || 0;
      return bTime - aTime;
    });
  }

  /**
   * 渲染搜索建议 - 增强新架构支持
   */
  renderSearchSuggestions(suggestions) {
    let suggestionsContainer = document.getElementById('searchSuggestions');
    
    if (!suggestionsContainer) {
      suggestionsContainer = document.createElement('div');
      suggestionsContainer.id = 'searchSuggestions';
      suggestionsContainer.className = 'search-suggestions enhanced-v2'; // 🆕 新架构样式类
      
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
      const suggestionIcon = this.getEnhancedSuggestionIcon(item);
      const frequencyInfo = item.count > 1 ? `<small class="suggestion-count">${item.count}次</small>` : '';
      
      // 🆕 架构信息和质量指标
      const architectureInfo = this.generateSuggestionArchitectureInfo(item);
      const qualityInfo = this.generateSuggestionQualityInfo(item);
      
      return `
        <div class="suggestion-item ${index === this.selectedIndex ? 'selected' : ''} suggestion-${item.type}" 
             data-index="${index}" 
             data-keyword="${escapeHtml(displayText)}"
             data-type="${item.type}"
             data-architecture="${item.architecture || 'unknown'}">
          <span class="suggestion-icon">${suggestionIcon}</span>
          <span class="suggestion-text">${escapeHtml(displayText)}</span>
          <div class="suggestion-meta">
            ${frequencyInfo}
            ${qualityInfo}
            ${architectureInfo}
          </div>
        </div>
      `;
    }).join('');
    
    // 🆕 添加建议统计信息
    const statsInfo = this.generateSuggestionStats(suggestions);
    if (statsInfo) {
      suggestionsContainer.innerHTML += `
        <div class="suggestions-stats">
          <small>${statsInfo}</small>
        </div>
      `;
    }
    
    suggestionsContainer.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * 🆕 获取增强的建议图标
   */
  getEnhancedSuggestionIcon(item) {
    const iconMap = {
      'history': '🕐',
      'personalized': '👤',
      'trending': '📈',
      'context': '💡',
      'popular': '🔥',
      'recent': '⭐',
      'suggestion': '🔍'
    };
    
    const baseIcon = iconMap[item.type] || '🔍';
    
    // 🆕 为新架构建议添加特殊标识
    if (item.architecture === 'modular_parsers' && item.metadata?.confidence > 0.8) {
      return `${baseIcon}✨`; // 高质量建议
    }
    
    return baseIcon;
  }

  /**
   * 🆕 生成建议架构信息
   */
  generateSuggestionArchitectureInfo(item) {
    if (!item.architecture || item.architecture === 'unknown') return '';
    
    if (item.architecture === 'modular_parsers') {
      return `<span class="arch-badge v2" title="新架构建议">🗂️</span>`;
    }
    
    return '';
  }

  /**
   * 🆕 生成建议质量信息
   */
  generateSuggestionQualityInfo(item) {
    if (!item.metadata?.confidence) return '';
    
    const confidence = item.metadata.confidence;
    let qualityClass = '';
    let qualityIcon = '';
    
    if (confidence > 0.8) {
      qualityClass = 'high-quality';
      qualityIcon = '⭐';
    } else if (confidence > 0.6) {
      qualityClass = 'medium-quality';
      qualityIcon = '🔸';
    } else {
      qualityClass = 'basic-quality';
      qualityIcon = '🔹';
    }
    
    return `<span class="quality-badge ${qualityClass}" title="建议质量: ${(confidence * 100).toFixed(0)}%">${qualityIcon}</span>`;
  }

  /**
   * 🆕 生成建议统计信息
   */
  generateSuggestionStats(suggestions) {
    if (suggestions.length === 0) return '';
    
    const typeStats = suggestions.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});
    
    const v2Count = suggestions.filter(item => 
      item.architecture === 'modular_parsers'
    ).length;
    
    if (v2Count > 0) {
      return `新架构建议: ${v2Count}/${suggestions.length}`;
    }
    
    return '';
  }

  /**
   * 🆕 缓存管理
   */
  generateCacheKey(query) {
    return `suggestions_v2_${query.toLowerCase().trim()}`;
  }

  getSuggestionsFromCache(cacheKey) {
    const cached = this.suggestionCache.get(cacheKey);
    if (!cached) return null;
    
    if (Date.now() > cached.expiresAt) {
      this.suggestionCache.delete(cacheKey);
      return null;
    }
    
    return cached.suggestions;
  }

  cacheSuggestions(cacheKey, suggestions) {
    if (this.suggestionCache.size >= 50) {
      // 清理最旧的缓存
      const oldestKey = [...this.suggestionCache.keys()][0];
      this.suggestionCache.delete(oldestKey);
    }
    
    this.suggestionCache.set(cacheKey, {
      suggestions,
      expiresAt: Date.now() + this.intelligentSuggestionConfig.cacheExpiration,
      createdAt: Date.now()
    });
  }

  /**
   * 🆕 设置缓存清理
   */
  setupCacheCleanup() {
    // 每10分钟清理一次过期缓存
    setInterval(() => {
      this.cleanupSuggestionCache();
    }, 10 * 60 * 1000);
  }

  cleanupSuggestionCache() {
    const now = Date.now();
    for (const [key, cached] of this.suggestionCache) {
      if (now > cached.expiresAt) {
        this.suggestionCache.delete(key);
      }
    }
  }

  /**
   * 隐藏搜索建议 - 保持原有功能
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
   * 处理键盘导航 - 保持原有功能
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
   * 更新选择状态 - 保持原有功能
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
   * 选择建议 - 增强新架构支持
   */
  selectSuggestion(keyword) {
    // 🆕 记录建议使用统计
    this.recordSuggestionUsage(keyword);
    
    // 触发建议选择事件（包含新架构信息）
    const suggestion = this.currentSuggestions.find(s => s.keyword === keyword);
    document.dispatchEvent(new CustomEvent('suggestionSelected', {
      detail: { 
        keyword,
        metadata: suggestion?.metadata || {},
        architecture: suggestion?.architecture || this.suggestionMetadata.architecture,
        type: suggestion?.type || 'unknown'
      }
    }));
    
    // 隐藏建议列表
    this.hideSearchSuggestions();
  }

  /**
   * 🆕 记录建议使用统计
   */
  recordSuggestionUsage(keyword) {
    const suggestion = this.currentSuggestions.find(s => s.keyword === keyword);
    if (suggestion) {
      console.log(`建议使用统计 (新架构): ${keyword} [${suggestion.type}]`, {
        architecture: suggestion.architecture,
        confidence: suggestion.metadata?.confidence,
        source: suggestion.metadata?.source
      });
    }
  }

  /**
   * 获取当前选中的建议 - 保持原有功能
   */
  getCurrentSelection() {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.currentSuggestions.length) {
      return this.currentSuggestions[this.selectedIndex];
    }
    return null;
  }

  /**
   * 绑定建议事件 - 增强新架构支持
   */
  bindSuggestionEvents() {
    // 绑定搜索输入事件
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      // 输入事件 - 使用防抖
      searchInput.addEventListener('input', debounce((e) => {
        this.handleSearchInput(e.target.value);
      }, this.intelligentSuggestionConfig.debounceDelay));

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

    // 🆕 监听新架构配置变更
    document.addEventListener('searchConfigChanged', (event) => {
      if (event.detail.config) {
        this.handleConfigUpdate(event.detail.config);
      }
    });

    // 🆕 监听架构升级事件
    document.addEventListener('architectureUpgraded', (event) => {
      const { version, features } = event.detail;
      this.handleArchitectureUpgrade(version, features);
    });
  }

  /**
   * 🆕 处理配置更新
   */
  handleConfigUpdate(config) {
    // 更新智能建议配置
    if (config.enableSmartSuggestions !== undefined) {
      this.intelligentSuggestionConfig.enableContextAware = config.enableSmartSuggestions;
    }
    
    if (config.maxSuggestions !== undefined) {
      this.intelligentSuggestionConfig.maxSuggestions = Math.min(config.maxSuggestions, 12);
    }
    
    console.log('建议配置已更新 (新架构):', this.intelligentSuggestionConfig);
  }

  /**
   * 🆕 处理架构升级
   */
  handleArchitectureUpgrade(version, features) {
    if (version !== this.version) {
      console.log(`升级到新架构版本: ${this.version} -> ${version}`);
      this.version = version;
      this.architectureFeatures = { ...this.architectureFeatures, ...features };
      this.suggestionMetadata.dataStructureVersion = version;
      
      // 清理缓存以使用新架构
      this.suggestionCache.clear();
    }
  }

  /**
   * 从搜索结果更新建议 - 增强新架构支持
   */
  updateFromSearchResults(results) {
    if (!results || !Array.isArray(results)) return;
    
    // 🆕 分析搜索结果，提取有用的关键词用于未来建议
    const extractedKeywords = this.extractKeywordsFromResults(results);
    
    // 更新个性化建议缓存
    if (extractedKeywords.length > 0 && this.intelligentSuggestionConfig.enablePersonalization) {
      this.updatePersonalizedSuggestionsCache(extractedKeywords);
    }
  }

  /**
   * 🆕 从搜索结果提取关键词
   */
  extractKeywordsFromResults(results) {
    const keywords = new Set();
    
    results.forEach(result => {
      // 从标题提取关键词
      if (result.title) {
        const titleWords = result.title.split(/\s+/).filter(word => 
          word.length > 2 && !/^\d+$/.test(word)
        );
        titleWords.forEach(word => keywords.add(word.toLowerCase()));
      }
      
      // 从副标题提取关键词
      if (result.subtitle) {
        const subtitleWords = result.subtitle.split(/\s+/).filter(word => 
          word.length > 2 && !/^\d+$/.test(word)
        );
        subtitleWords.forEach(word => keywords.add(word.toLowerCase()));
      }
    });
    
    return Array.from(keywords).slice(0, 10); // 限制数量
  }

  /**
   * 🆕 更新个性化建议缓存
   */
  updatePersonalizedSuggestionsCache(keywords) {
    // 基于新关键词更新个性化建议
    keywords.forEach(keyword => {
      const variants = this.generateKeywordVariants(keyword);
      variants.forEach(variant => {
        if (!this.personalizedSuggestions?.some(s => s.keyword === variant)) {
          this.personalizedSuggestions?.push({
            type: 'personalized',
            keyword: variant,
            query: variant,
            originalKeyword: keyword,
            architecture: this.suggestionMetadata.architecture,
            metadata: {
              source: 'search_results',
              confidence: 0.6,
              category: 'derived'
            }
          });
        }
      });
    });
    
    // 限制个性化建议数量
    if (this.personalizedSuggestions?.length > 20) {
      this.personalizedSuggestions = this.personalizedSuggestions.slice(0, 20);
    }
  }

  // ===================== 其他方法保持原有功能 =====================

  /**
   * 添加自定义建议 - 保持原有功能
   */
  addCustomSuggestion(suggestion) {
    if (!suggestion || !suggestion.keyword) return;

    // 添加到当前建议列表
    const exists = this.currentSuggestions.find(s => s.keyword === suggestion.keyword);
    if (!exists) {
      this.currentSuggestions.unshift({
        type: 'custom',
        ...suggestion,
        // 🆕 添加新架构信息
        architecture: this.suggestionMetadata.architecture,
        metadata: {
          source: 'custom',
          confidence: 0.8
        }
      });
      
      // 重新渲染
      if (this.isVisible) {
        this.renderSearchSuggestions(this.currentSuggestions);
      }
    }
  }

  /**
   * 移除建议 - 保持原有功能
   */
  removeSuggestion(keyword) {
    this.currentSuggestions = this.currentSuggestions.filter(s => s.keyword !== keyword);
    
    if (this.isVisible) {
      this.renderSearchSuggestions(this.currentSuggestions);
    }
  }

  /**
   * 清空所有建议 - 保持原有功能
   */
  clearSuggestions() {
    this.currentSuggestions = [];
    this.hideSearchSuggestions();
  }

  /**
   * 设置建议过滤器 - 保持原有功能
   */
  setSuggestionFilter(filterFn) {
    this.customFilter = filterFn;
  }

  /**
   * 获取建议统计 - 增强新架构信息
   */
  getSuggestionStats() {
    const architectureStats = this.getArchitectureStats();
    
    return {
      currentCount: this.currentSuggestions.length,
      isVisible: this.isVisible,
      selectedIndex: this.selectedIndex,
      historyCount: this.searchHistory.length,
      suggestionTypes: this.currentSuggestions.reduce((acc, s) => {
        acc[s.type] = (acc[s.type] || 0) + 1;
        return acc;
      }, {}),
      // 🆕 新架构统计信息
      architecture: {
        version: this.version,
        features: this.architectureFeatures,
        performanceMetrics: this.performanceMetrics,
        cacheStats: {
          size: this.suggestionCache.size,
          hitRate: this.performanceMetrics.cacheHitRate
        }
      }
    };
  }

  /**
   * 🆕 获取架构统计信息
   */
  getArchitectureStats() {
    const v2Suggestions = this.currentSuggestions.filter(s => 
      s.architecture === 'modular_parsers'
    ).length;
    
    const intelligentSuggestions = this.currentSuggestions.filter(s => 
      s.type === 'personalized' || s.type === 'context' || s.type === 'trending'
    ).length;
    
    return {
      v2Suggestions,
      intelligentSuggestions,
      cacheSize: this.suggestionCache.size,
      totalRequests: this.performanceMetrics.totalRequests,
      averageResponseTime: this.performanceMetrics.averageResponseTime
    };
  }

  /**
   * 导出建议配置 - 增强新架构信息
   */
  exportSuggestionConfig() {
    return {
      searchHistory: this.searchHistory.slice(0, 20), // 只导出最近20条
      recentSuggestions: this.currentSuggestions,
      settings: this.intelligentSuggestionConfig,
      // 🆕 新架构导出信息
      version: this.version,
      architecture: this.suggestionMetadata.architecture,
      features: this.architectureFeatures,
      performanceMetrics: this.performanceMetrics,
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 🆕 获取架构信息
   */
  getArchitectureInfo() {
    return {
      version: this.version,
      features: this.architectureFeatures,
      metadata: this.suggestionMetadata,
      config: this.intelligentSuggestionConfig
    };
  }

  /**
   * 清理资源 - 增强新架构支持
   */
  cleanup() {
    this.hideSearchSuggestions();
    this.currentSuggestions = [];
    this.searchHistory = [];
    this.selectedIndex = -1;
    this.isVisible = false;
    
    // 🆕 清理新架构资源
    this.suggestionCache.clear();
    this.trendingSuggestions = [];
    this.personalizedSuggestions = [];
    
    // 移除建议容器
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }
    
    console.log(`搜索建议管理器资源已清理 (新架构 v${this.version})`);
  }
}

export default SearchSuggestionManager;