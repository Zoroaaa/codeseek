// src/components/search.js - 重构后的统一搜索组件（主组件集成子组件）
// 专注于搜索流程编排、搜索请求协调、子组件通信、搜索状态管理
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { debounce } from '../utils/helpers.js';
import searchService from '../services/search.js';
import authManager from '../services/auth.js';
import apiService from '../services/api.js';

// 导入子组件 - 使用统一的SearchConfigManager
import SearchConfigManager from './search/SearchConfigManager.js';
import SearchHistoryManager from './search/SearchHistoryManager.js';
import DetailExtractionManager from './search/DetailExtractionManager.js';
import SearchResultsRenderer from './search/SearchResultsRenderer.js';
import SearchSuggestionManager from './search/SearchSuggestionManager.js';

export class UnifiedSearchManager {
  constructor() {
    // 初始化子组件 - SearchConfigManager现在是统一配置管理器
    this.configManager = new SearchConfigManager();
    this.historyManager = new SearchHistoryManager();
    this.extractionManager = new DetailExtractionManager();
    this.resultsRenderer = new SearchResultsRenderer();
    this.suggestionManager = new SearchSuggestionManager();
    
    // 主组件状态
    this.isInitialized = false;
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
  }

  /**
   * 初始化统一搜索管理器
   */
  async init() {
    if (this.isInitialized) return;

    try {
      console.log('开始初始化统一搜索管理器...');
      
      // 按顺序初始化所有子组件
      await this.configManager.init();
      await this.historyManager.init();
      await this.extractionManager.init();
      await this.resultsRenderer.init();
      await this.suggestionManager.init();
      
      // 设置子组件间的通信
      this.setupComponentCommunication();
      
      // 绑定主组件事件
      this.bindEvents();
      
      // 处理URL参数
      this.handleURLParams();
      
      // 暴露全局方法
      this.exposeGlobalMethods();
      
      this.isInitialized = true;
      console.log('统一搜索管理器初始化完成，所有子组件已就绪');
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
      showToast('搜索功能初始化失败，部分功能可能不可用', 'warning');
    }
  }

  /**
   * 设置子组件间的通信
   */
  setupComponentCommunication() {
    // 配置变更 -> 通知相关组件
    document.addEventListener('searchConfigChanged', (event) => {
      const config = event.detail.config;
      console.log('配置已更新，通知相关组件');
      
      // 更新建议管理器的历史数据
      this.suggestionManager.setSearchHistory(this.historyManager.getHistory());
      
      // 通知详情提取管理器配置更新
      this.extractionManager.updateConfig(config);
      
      // 通知结果渲染器配置更新
      this.resultsRenderer.updateConfig(config);
    });

    // 历史搜索请求 -> 执行搜索
    document.addEventListener('historySearchRequested', (event) => {
      const { keyword } = event.detail;
      this.performSearchFromHistory(keyword);
    });

    // 建议选择 -> 执行搜索
    document.addEventListener('suggestionSelected', (event) => {
      const { keyword } = event.detail;
      this.performSearchFromSuggestion(keyword);
    });

    // 结果操作请求 -> 处理操作
    document.addEventListener('resultActionRequested', (event) => {
      this.handleResultAction(event.detail);
    });

    // 演员搜索请求 -> 执行搜索
    document.addEventListener('actressSearchRequested', (event) => {
      const { name } = event.detail;
      this.searchByActress(name);
    });

    // 详情提取完成 -> 更新UI
    document.addEventListener('detailExtractionCompleted', (event) => {
      console.log('详情提取完成:', event.detail);
    });

    // 搜索结果渲染完成 -> 通知其他组件
    document.addEventListener('searchResultsRendered', (event) => {
      console.log('搜索结果渲染完成:', event.detail);
    });

    // 搜索结果清空 -> 重置状态
    document.addEventListener('searchResultsCleared', () => {
      this.resetSearchState();
    });
  }

  /**
   * 执行搜索 - 主要搜索方法
   */
  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      showToast('请输入搜索关键词', 'error');
      searchInput?.focus();
      return;
    }

    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      showToast(validation.errors[0], 'error');
      return;
    }

    try {
      showLoading(true);
      
      // 隐藏提示区域和建议
      this.hideQuickTips();
      this.suggestionManager.hideSearchSuggestions();

      // 显示搜索状态检查进度（如果可用）
      await this.showSearchStatusIfEnabled(keyword);

      // 执行基础搜索
      const searchResults = await searchService.performSearch(keyword, {
        useCache: this.configManager.config.useCache,
        saveToHistory: this.configManager.config.saveToHistory && authManager.isAuthenticated()
      });
      
      if (!searchResults || searchResults.length === 0) {
        showToast('未找到搜索结果', 'warning');
        this.resultsRenderer.displaySearchResults(keyword, [], this.configManager.config);
        return;
      }

      // 显示基础搜索结果
      this.resultsRenderer.displaySearchResults(keyword, searchResults, this.configManager.config);
      
      // 更新搜索历史
      if (authManager.isAuthenticated()) {
        await this.historyManager.addToHistory(keyword);
        // 通知建议管理器更新历史
        this.suggestionManager.setSearchHistory(this.historyManager.getHistory());
      }

      // 检查是否启用详情提取
      if (this.shouldUseDetailExtraction()) {
        console.log('开始详情提取流程...');
        await this.extractionManager.handleDetailExtraction(
          searchResults, 
          keyword, 
          this.configManager.config
        );
      } else if (!authManager.isAuthenticated() && this.configManager.config.enableDetailExtraction) {
        showToast('登录后可使用详情提取功能', 'info', 3000);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
    }
  }

  /**
   * 从历史记录执行搜索
   */
  performSearchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  /**
   * 从建议执行搜索
   */
  performSearchFromSuggestion(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  /**
   * 按演员搜索
   */
  searchByActress(actressName) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = actressName;
      this.performSearch();
    }
  }

  /**
   * 判断是否应该使用详情提取
   */
  shouldUseDetailExtraction() {
    return this.extractionManager.shouldUseDetailExtraction(this.configManager.config);
  }

  /**
   * 显示搜索状态检查进度
   */
  async showSearchStatusIfEnabled(keyword) {
    try {
      if (!authManager.isAuthenticated()) return;

      const userSettings = await apiService.getUserSettings();
      const checkTimeout = userSettings.sourceStatusCheckTimeout || 8000;
      
      if (!userSettings.checkSourceStatus) return;

      this.statusCheckInProgress = true;
      this.lastStatusCheckKeyword = keyword;

      // 显示状态检查提示
      showToast('正在检查搜索源状态并进行内容匹配...', 'info', checkTimeout);
      
      // 显示状态指示器
      this.resultsRenderer.showSearchStatus(keyword);

    } catch (error) {
      console.warn('显示状态检查进度失败:', error);
    }
  }

  /**
   * 处理结果操作
   */
  async handleResultAction(actionDetail) {
    const { action, url, resultId, source } = actionDetail;

    switch (action) {
      case 'visit':
        this.openResult(url, source);
        break;
      case 'favorite':
        await this.toggleFavorite(resultId);
        break;
      case 'copy':
        await this.copyToClipboard(url);
        break;
      case 'extractDetail':
        await this.extractionManager.extractSingleDetail(
          resultId, 
          this.resultsRenderer.getCurrentResults(),
          this.configManager.config
        );
        break;
      case 'checkStatus':
        await this.checkSingleSourceStatus(source, resultId);
        break;
      case 'viewDetails':
        await this.viewSourceStatusDetails(resultId);
        break;
    }
  }

  /**
   * 打开搜索结果
   */
  openResult(url, source) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast('已在新标签页打开', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('visit_site', { url, source }).catch(console.error);
      }
    } catch (error) {
      console.error('打开链接失败:', error);
      showToast('无法打开链接', 'error');
    }
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('copy_url', { url: text }).catch(console.error);
      }
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板', 'success');
      } catch (err) {
        showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  /**
   * 切换收藏状态
   */
  async toggleFavorite(resultId) {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
      return;
    }

    const result = this.resultsRenderer.findResult(resultId);
    if (!result) return;

    const isFavorited = favoritesManager.isFavorited(result.url);
    
    if (isFavorited) {
      const favorite = favoritesManager.favorites.find(fav => fav.url === result.url);
      if (favorite) {
        await favoritesManager.removeFavorite(favorite.id);
      }
    } else {
      await favoritesManager.addFavorite(result);
    }

    this.resultsRenderer.updateFavoriteButtons();
  }

  /**
   * 检查单个搜索源状态
   */
  async checkSingleSourceStatus(sourceId, resultId) {
    try {
      showLoading(true);
      showToast(`正在检查 ${sourceId} 状态...`, 'info');

      const statusResult = await searchService.checkSingleSourceStatus(sourceId);

      if (statusResult) {
        // 更新结果渲染器中的状态
        const updated = this.resultsRenderer.updateResultStatus(resultId, {
          status: statusResult.status,
          statusText: statusResult.statusText,
          unavailableReason: statusResult.unavailableReason,
          lastChecked: statusResult.lastChecked,
          responseTime: statusResult.responseTime,
          availabilityScore: statusResult.availabilityScore,
          verified: statusResult.verified,
          contentMatch: statusResult.contentMatch,
          fromCache: statusResult.fromCache
        });

        if (updated) {
          const statusEmoji = statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? '✅' : '⚠️';
          const contentInfo = statusResult.contentMatch ? '，内容匹配' : '';
          let reasonInfo = '';
          
          if (statusResult.unavailableReason && statusResult.status !== APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
            reasonInfo = `，原因：${statusResult.unavailableReason}`;
          }
          
          showToast(`${sourceId} ${statusEmoji} ${statusResult.statusText}${contentInfo}${reasonInfo}`, 
            statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 'success' : 'warning',
            5000);
        }
      }
    } catch (error) {
      console.error('检查搜索源状态失败:', error);
      showToast('状态检查失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 查看搜索源状态详情
   */
  async viewSourceStatusDetails(resultId) {
    const result = this.resultsRenderer.findResult(resultId);
    if (!result || !result.status) {
      showToast('无状态详情可查看', 'warning');
      return;
    }

    // 构建详情信息
    const details = [
      `搜索源: ${result.title}`,
      `状态: ${result.statusText || this.getStatusText(result.status)}`,
      `最后检查: ${result.lastChecked ? new Date(result.lastChecked).toLocaleString() : '未知'}`,
    ];

    // 显示不可用原因
    if (result.unavailableReason && this.isResultUnavailable(result)) {
      details.push(`不可用原因: ${result.unavailableReason}`);
    }

    if (result.responseTime > 0) {
      details.push(`响应时间: ${result.responseTime}ms`);
    }

    if (result.availabilityScore > 0) {
      details.push(`可用性评分: ${result.availabilityScore}/100`);
    }

    if (result.qualityScore > 0) {
      details.push(`内容质量: ${result.qualityScore}/100`);
    }

    if (result.contentMatch !== undefined) {
      details.push(`内容匹配: ${result.contentMatch ? '是' : '否'}`);
    }

    if (result.fromCache) {
      details.push(`数据来源: 缓存`);
    }

    // 显示详情（这里简单用alert，实际项目中可以用模态框）
    alert(details.join('\n'));
  }

  /**
   * 刷新所有搜索源状态
   */
  async refreshAllSourcesStatus() {
    const currentResults = this.resultsRenderer.getCurrentResults();
    if (!currentResults || currentResults.length === 0) {
      showToast('没有搜索结果需要刷新状态', 'warning');
      return;
    }

    try {
      showLoading(true);
      showToast('正在刷新所有搜索源状态...', 'info');

      const statusSummary = await searchService.checkAllSourcesStatus();
      
      // 更新所有结果的状态
      const updatedResults = currentResults.map(result => {
        const sourceStatus = statusSummary.sources.find(s => s.id === result.source);
        if (sourceStatus) {
          return {
            ...result,
            status: sourceStatus.status,
            statusText: sourceStatus.statusText,
            unavailableReason: sourceStatus.unavailableReason,
            lastChecked: sourceStatus.lastChecked,
            responseTime: sourceStatus.responseTime,
            availabilityScore: sourceStatus.availabilityScore,
            verified: sourceStatus.verified,
            contentMatch: sourceStatus.contentMatch,
            fromCache: sourceStatus.fromCache
          };
        }
        return result;
      });

      // 重新渲染结果列表
      const keyword = document.getElementById('searchInput')?.value || '';
      this.resultsRenderer.displaySearchResults(keyword, updatedResults, this.configManager.config);

      const contentMatches = statusSummary.sources.filter(s => s.contentMatch).length;
      const unavailableCount = statusSummary.unavailable + statusSummary.timeout + statusSummary.error;
      const contentInfo = contentMatches > 0 ? `，${contentMatches} 个内容匹配` : '';
      const unavailableInfo = unavailableCount > 0 ? `，${unavailableCount} 个不可用` : '';
      
      showToast(`状态刷新完成: ${statusSummary.available}/${statusSummary.total} 可用${contentInfo}${unavailableInfo}`, 'success');
    } catch (error) {
      console.error('刷新搜索源状态失败:', error);
      showToast('刷新状态失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 清空搜索结果
   */
  clearResults() {
    this.resultsRenderer.clearResults();
    showToast('搜索结果已清除', 'success');
  }

  /**
   * 导出搜索结果
   */
  async exportResults() {
    const extractionStats = this.extractionManager.getExtractionStats();
    const result = await this.resultsRenderer.exportResults(extractionStats);
    
    if (result.success) {
      showToast('搜索结果导出成功', 'success');
    } else {
      showToast(result.error, 'error');
    }
  }

  /**
   * 清空搜索历史
   */
  async clearAllHistory() {
    await this.historyManager.clearAllHistory();
  }

  // ===================== UI控制方法 =====================

  /**
   * 隐藏快速提示
   */
  hideQuickTips() {
    const quickTips = document.getElementById('quickTips');
    if (quickTips) {
      quickTips.style.display = 'none';
    }
  }

  /**
   * 重置搜索状态
   */
  resetSearchState() {
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
    
    // 重置结果渲染器状态
    this.resultsRenderer.hideSearchStatus();
    
    console.log('搜索状态已重置');
  }

  // ===================== 事件绑定 =====================

  /**
   * 绑定事件
   */
  bindEvents() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.performSearch());
    }

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.performSearch();
      });

      // 搜索输入事件由建议管理器处理
      searchInput.addEventListener('input', debounce((e) => {
        this.suggestionManager.handleSearchInput(e.target.value);
      }, 300));
    }

    if (clearResultsBtn) {
      clearResultsBtn.addEventListener('click', () => this.clearResults());
    }

    if (exportResultsBtn) {
      exportResultsBtn.addEventListener('click', () => this.exportResults());
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    }

    this.bindKeyboardShortcuts();
    this.bindGlobalEvents();
  }

  /**
   * 绑定键盘快捷键
   */
  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      if (e.key === 'Escape') {
        this.suggestionManager.hideSearchSuggestions();
      }
    });
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.resultsRenderer.updateFavoriteButtons();
    });

    // 监听认证状态变更
    document.addEventListener('authStateChanged', () => {
      this.historyManager.loadSearchHistory();
      this.extractionManager.checkDetailServiceHealth();
    });
  }

  /**
   * 处理URL参数
   */
  handleURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.value = searchQuery;
        setTimeout(() => {
          this.performSearch();
        }, 500);
      }
    }
  }

  /**
   * 暴露全局方法
   */
  exposeGlobalMethods() {
    window.unifiedSearchManager = {
      // 搜索相关
      performSearch: () => this.performSearch(),
      clearResults: () => this.clearResults(),
      exportResults: () => this.exportResults(),
      
      // 历史相关
      clearAllHistory: () => this.clearAllHistory(),
      searchFromHistory: (keyword) => this.performSearchFromHistory(keyword),
      deleteHistoryItem: (historyId) => this.historyManager.deleteHistoryItem(historyId),
      
      // 结果操作
      openResult: (url, source) => this.openResult(url, source),
      toggleFavorite: (resultId) => this.toggleFavorite(resultId),
      copyToClipboard: (text) => this.copyToClipboard(text),
      
      // 状态检查
      checkSourceStatus: (sourceId, resultId) => this.checkSingleSourceStatus(sourceId, resultId),
      refreshSourceStatus: () => this.refreshAllSourcesStatus(),
      
      // 详情提取
      extractSingleDetail: (resultId) => this.extractionManager.extractSingleDetail(
        resultId, 
        this.resultsRenderer.getCurrentResults(),
        this.configManager.config
      ),
      retryExtraction: (resultId) => this.extractionManager.retryExtraction(
        resultId,
        this.resultsRenderer.getCurrentResults(),
        this.configManager.config
      ),
      toggleDetailDisplay: (resultId) => this.extractionManager.toggleDetailDisplay(resultId),
      
      // 配置相关 - 通过统一配置管理器
      refreshConfig: () => this.configManager.refreshDetailConfig(),
      clearConfigCache: () => this.configManager.clearConfigCache(),
      getCurrentConfig: () => this.configManager.getConfig(),
      getEffectiveConfig: (overrides) => this.configManager.getEffectiveConfig(overrides),
      isDetailExtractionEnabled: () => this.configManager.config.enableDetailExtraction,
      updateDisplayConfig: (displayConfig) => this.configManager.updateDisplayConfig(displayConfig),
      validateSearchConfig: () => this.configManager.validateSearchConfig(),
      exportSearchConfig: () => this.configManager.exportSearchConfig(),
      
      // 配置UI相关
      initConfigUI: (containerId) => this.configManager.initConfigUI(containerId),
      showConfigHelp: () => this.configManager.showConfigHelp(),
      exportConfig: () => this.configManager.exportConfig(),
      importConfig: () => this.configManager.importConfig(),
      
      // 统计相关
      getExtractionStats: () => this.extractionManager.getExtractionStats(),
      resetExtractionStats: () => this.extractionManager.resetExtractionStats(),
      getResultsStats: () => this.resultsRenderer.getResultsStats(),
      
      // 服务状态
      getServiceStatus: () => this.getServiceStatus(),
      getExtractionCapabilities: () => this.extractionManager.getExtractionCapabilities(this.configManager.config),
      
      // 组件访问（用于高级用法）
      configManager: this.configManager,
      historyManager: this.historyManager,
      extractionManager: this.extractionManager,
      resultsRenderer: this.resultsRenderer,
      suggestionManager: this.suggestionManager
    };

    // 保持向后兼容
    window.searchManager = window.unifiedSearchManager;
    window.enhancedSearchManager = window.unifiedSearchManager;
    
    // 暴露配置管理器的引用，方便其他组件使用
    window.searchConfigManager = this.configManager;
  }

  // ===================== 辅助方法 =====================

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      extractionInProgress: this.extractionManager.extractionInProgress,
      currentResults: this.resultsRenderer.getCurrentResults().length,
      searchHistory: this.historyManager.getHistory().length,
      extractionStats: this.extractionManager.getExtractionStats(),
      config: this.configManager.getConfig(),
      configCacheValid: this.configManager.isConfigCacheValid(),
      features: {
        detailExtraction: this.configManager.config.enableDetailExtraction,
        autoExtraction: this.configManager.config.autoExtractDetails,
        caching: this.configManager.config.enableCache,
        retry: this.configManager.config.enableRetry,
        configUI: true // 现在支持配置UI
      },
      components: {
        configManager: 'ready',
        historyManager: 'ready',
        extractionManager: 'ready',
        resultsRenderer: 'ready',
        suggestionManager: 'ready'
      }
    };
  }

  /**
   * 判断结果是否不可用
   */
  isResultUnavailable(result) {
    return this.resultsRenderer.isResultUnavailable(result);
  }

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    return this.resultsRenderer.getStatusText(status);
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理所有子组件
    this.configManager.cleanup();
    this.historyManager.cleanup();
    this.extractionManager.cleanup();
    this.resultsRenderer.cleanup();
    this.suggestionManager.cleanup();
    
    // 清理全局方法
    if (window.unifiedSearchManager) {
      delete window.unifiedSearchManager;
    }
    if (window.searchManager) {
      delete window.searchManager;
    }
    if (window.enhancedSearchManager) {
      delete window.enhancedSearchManager;
    }
    if (window.searchConfigManager) {
      delete window.searchConfigManager;
    }
    
    // 重置状态
    this.isInitialized = false;
    this.statusCheckInProgress = false;
    
    console.log('统一搜索管理器资源已清理');
  }
}

// 创建全局实例
export const unifiedSearchManager = new UnifiedSearchManager();
export default unifiedSearchManager;

// 向后兼容导出
export const searchManager = unifiedSearchManager;
export const enhancedSearchManager = unifiedSearchManager;