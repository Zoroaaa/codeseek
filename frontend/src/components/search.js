// src/components/search.js - 重构后的统一搜索组件（主组件集成子组件）
// 适配新架构v2.0.0 - 专注于搜索流程编排、搜索请求回调、子组件通信、搜索状态管理
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
    this.version = '2.0.0'; // 新架构版本
    
    // 🆕 新架构特性支持
    this.architectureFeatures = {
      modularParsers: true,
      unifiedDataStructure: true,
      dynamicConfiguration: true,
      enhancedErrorHandling: true,
      serviceHealthMonitoring: true
    };
  }

  /**
   * 初始化统一搜索管理器 - 适配新架构v2.0.0
   */
  async init() {
    if (this.isInitialized) return;

    try {
      console.log(`开始初始化统一搜索管理器 (v${this.version})...`);
      
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
      
      // 🆕 检查新架构服务健康状态
      await this.checkArchitectureHealth();
      
      this.isInitialized = true;
      console.log(`统一搜索管理器初始化完成 (v${this.version})，所有子组件已就绪`);
      console.log('支持的新架构特性:', this.architectureFeatures);
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
      showToast('搜索功能初始化失败，部分功能可能不可用', 'warning');
    }
  }

  /**
   * 🆕 检查新架构服务健康状态
   */
  async checkArchitectureHealth() {
    try {
      // 检查详情提取服务健康状态
      const extractionHealth = await this.extractionManager.checkDetailServiceHealth();
      
      // 检查配置服务健康状态
      const configHealth = await this.configManager.checkServiceHealth();
      
      console.log('新架构服务健康检查完成:', {
        extraction: extractionHealth,
        config: configHealth,
        architecture: 'modular_parsers',
        version: this.version
      });
      
    } catch (error) {
      console.warn('架构服务健康检查失败:', error);
    }
  }

  /**
   * 设置子组件间的通信 - 增强新架构支持
   */
  setupComponentCommunication() {
    // 配置变更 -> 通知相关组件
    document.addEventListener('searchConfigChanged', (event) => {
      const config = event.detail.config;
      console.log(`配置已更新 (v${this.version})，通知相关组件`);
      
      // 更新建议管理器的历史数据
      this.suggestionManager.setSearchHistory(this.historyManager.getHistory());
      
      // 通知详情提取管理器配置更新
      this.extractionManager.updateConfig(config);
      
      // 通知结果渲染器配置更新
      this.resultsRenderer.updateConfig(config);
    });

    // 🆕 新架构配置变更事件
    document.addEventListener('detailConfigSaved', (event) => {
      console.log('检测到详情配置保存事件，同步更新搜索组件配置');
      const detailConfig = event.detail.config;
      this.configManager.updateConfigFromDetailConfig(detailConfig);
    });

    // 🆕 详情提取状态变更事件
    document.addEventListener('detailExtractionStateChanged', (event) => {
      const { enabled } = event.detail;
      console.log(`详情提取功能${enabled ? '已启用' : '已禁用'} (新架构)`);
      this.updateExtractionFeatureState(enabled);
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
      console.log('详情提取完成 (新架构):', event.detail);
      this.handleExtractionCompleted(event.detail);
    });

    // 搜索结果渲染完成 -> 通知其他组件
    document.addEventListener('searchResultsRendered', (event) => {
      console.log('搜索结果渲染完成:', event.detail);
      this.handleResultsRendered(event.detail);
    });

    // 搜索结果清空 -> 重置状态
    document.addEventListener('searchResultsCleared', () => {
      this.resetSearchState();
    });

    // 🆕 服务状态变更事件
    document.addEventListener('detailServiceStatusChanged', (event) => {
      this.handleServiceStatusChange(event.detail);
    });
  }

  /**
   * 🆕 更新详情提取功能状态
   */
  updateExtractionFeatureState(enabled) {
    // 更新UI指示器
    const extractionIndicator = document.getElementById('detailExtractionIndicator');
    if (extractionIndicator) {
      extractionIndicator.className = `extraction-indicator ${enabled ? 'enabled' : 'disabled'}`;
      extractionIndicator.innerHTML = `
        <span class="indicator-icon">${enabled ? '✅' : '❌'}</span>
        <span class="indicator-text">详情提取: ${enabled ? '已启用' : '已禁用'}</span>
      `;
    }
    
    // 更新搜索结果中的详情提取按钮状态
    this.resultsRenderer.updateDetailExtractionButtonStates(enabled);
  }

  /**
   * 🆕 处理详情提取完成事件
   */
  handleExtractionCompleted(detail) {
    const { results, stats, keyword } = detail;
    
    // 更新搜索统计
    this.updateSearchStatistics(stats);
    
    // 显示提取洞察
    this.showExtractionInsights(stats, keyword);
    
    // 触发统计更新事件
    document.dispatchEvent(new CustomEvent('searchStatisticsUpdated', {
      detail: { type: 'extraction', stats, keyword }
    }));
  }

  /**
   * 🆕 处理搜索结果渲染完成事件
   */
  handleResultsRendered(detail) {
    const { keyword, results, resultCount, statusStats } = detail;
    
    // 更新搜索历史（如果启用）
    if (this.configManager.config.saveToHistory && authManager.isAuthenticated()) {
      this.historyManager.updateSearchResultCount(keyword, resultCount);
    }
    
    // 更新建议系统
    this.suggestionManager.updateFromSearchResults(results);
    
    // 🆕 检查是否需要自动详情提取
    if (this.shouldAutoExtractDetails()) {
      setTimeout(() => {
        this.performAutoDetailExtraction(results, keyword);
      }, 1000);
    }
  }

  /**
   * 🆕 处理服务状态变更
   */
  handleServiceStatusChange(statusDetail) {
    console.log('服务状态变更:', statusDetail);
    
    // 更新UI状态指示器
    this.updateServiceStatusIndicators(statusDetail);
    
    // 如果服务状态恶化，提示用户
    if (statusDetail.status === 'error' || statusDetail.status === 'degraded') {
      showToast(`服务状态: ${statusDetail.message}`, 'warning', 5000);
    }
  }

  /**
   * 执行搜索 - 增强新架构支持
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

      // 🆕 记录搜索开始时间（性能监控）
      const searchStartTime = performance.now();

      // 显示搜索状态检查进度（如果启用）
      await this.showSearchStatusIfEnabled(keyword);

      // 🆕 使用新架构配置执行基础搜索
      const effectiveConfig = this.configManager.getEffectiveConfig();
      const searchResults = await searchService.performSearch(keyword, {
        useCache: effectiveConfig.useCache,
        saveToHistory: effectiveConfig.saveToHistory && authManager.isAuthenticated(),
        // 🆕 新架构选项
        architectureVersion: this.version,
        enableHealthCheck: effectiveConfig.enableServiceHealthCheck
      });
      
      if (!searchResults || searchResults.length === 0) {
        showToast('未找到搜索结果', 'warning');
        this.resultsRenderer.displaySearchResults(keyword, [], effectiveConfig);
        return;
      }

      // 🆕 增强搜索结果（添加新架构元数据）
      const enhancedResults = this.enhanceSearchResults(searchResults, keyword);

      // 显示基础搜索结果
      this.resultsRenderer.displaySearchResults(keyword, enhancedResults, effectiveConfig);
      
      // 更新搜索历史
      if (authManager.isAuthenticated()) {
        await this.historyManager.addToHistory(keyword, enhancedResults.length);
        // 通知建议管理器更新历史
        this.suggestionManager.setSearchHistory(this.historyManager.getHistory());
      }

      // 🆕 检查是否使用新架构详情提取
      if (this.shouldUseDetailExtraction()) {
        console.log(`开始新架构详情提取流程 (v${this.version})...`);
        await this.extractionManager.handleDetailExtraction(
          enhancedResults, 
          keyword, 
          effectiveConfig
        );
      } else if (!authManager.isAuthenticated() && effectiveConfig.enableDetailExtraction) {
        showToast('登录后可使用新架构详情提取功能', 'info', 3000);
      }

      // 🆕 记录搜索性能
      const searchTime = performance.now() - searchStartTime;
      this.recordSearchPerformance(keyword, enhancedResults.length, searchTime);

    } catch (error) {
      console.error('搜索失败:', error);
      showToast(`搜索失败: ${error.message}`, 'error');
      
      // 🆕 错误上报（如果启用）
      this.reportSearchError(keyword, error);
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
    }
  }

  /**
   * 🆕 增强搜索结果（添加新架构元数据）
   */
  enhanceSearchResults(results, keyword) {
    return results.map(result => ({
      ...result,
      // 新架构元数据
      architectureVersion: this.version,
      searchTimestamp: Date.now(),
      searchKeyword: keyword,
      supportsDetailExtraction: this.shouldExtractDetailForResult(result),
      enhancedMetadata: {
        parserSupport: this.getParserSupportInfo(result.source),
        qualityIndicators: this.calculateResultQuality(result),
        extractionPriority: this.calculateExtractionPriority(result)
      }
    }));
  }

  /**
   * 🆕 计算结果质量指标
   */
  calculateResultQuality(result) {
    let qualityScore = 0;
    const indicators = [];
    
    // 基础信息完整性
    if (result.title && result.title.length > 5) {
      qualityScore += 20;
      indicators.push('title');
    }
    if (result.subtitle && result.subtitle.length > 10) {
      qualityScore += 15;
      indicators.push('subtitle');
    }
    if (result.url && result.url.startsWith('https://')) {
      qualityScore += 10;
      indicators.push('secure_url');
    }
    
    // 源站信誉
    if (APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source)) {
      qualityScore += 30;
      indicators.push('supported_source');
    }
    
    // 时效性
    if (result.timestamp && (Date.now() - result.timestamp) < 86400000) {
      qualityScore += 25;
      indicators.push('recent');
    }
    
    return {
      score: Math.min(qualityScore, 100),
      indicators,
      level: qualityScore >= 80 ? 'high' : qualityScore >= 50 ? 'medium' : 'low'
    };
  }

  /**
   * 🆕 计算提取优先级
   */
  calculateExtractionPriority(result) {
    const quality = this.calculateResultQuality(result);
    const sourceSupport = this.getParserSupportInfo(result.source);
    
    let priority = 0;
    
    // 质量权重
    if (quality.level === 'high') priority += 3;
    else if (quality.level === 'medium') priority += 2;
    else priority += 1;
    
    // 解析器支持权重
    if (sourceSupport.level === 'excellent') priority += 3;
    else if (sourceSupport.level === 'good') priority += 2;
    else priority += 1;
    
    // 源站优先级权重
    if (result.source === 'javbus' || result.source === 'javdb') priority += 2;
    else if (result.source === 'jable' || result.source === 'javmost') priority += 1;
    
    return {
      score: priority,
      level: priority >= 7 ? 'high' : priority >= 5 ? 'medium' : 'low'
    };
  }

  /**
   * 🆕 获取解析器支持信息
   */
  getParserSupportInfo(sourceType) {
    const supportedSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [];
    
    if (!supportedSources.includes(sourceType)) {
      return { supported: false, level: 'none', features: [] };
    }
    
    // 基于源类型返回支持信息
    const supportInfo = {
      javbus: { level: 'excellent', features: ['screenshots', 'downloads', 'magnets', 'metadata'] },
      javdb: { level: 'excellent', features: ['screenshots', 'metadata', 'actors'] },
      jable: { level: 'good', features: ['screenshots', 'metadata'] },
      javmost: { level: 'good', features: ['screenshots', 'downloads'] },
      javgg: { level: 'good', features: ['metadata', 'downloads'] },
      sukebei: { level: 'fair', features: ['magnets', 'metadata'] },
      javguru: { level: 'fair', features: ['metadata'] },
      generic: { level: 'basic', features: ['basic_metadata'] }
    };
    
    return {
      supported: true,
      ...supportInfo[sourceType] || supportInfo.generic
    };
  }

  /**
   * 判断是否应该为特定结果提取详情
   */
  shouldExtractDetailForResult(result) {
    return this.shouldUseDetailExtraction() && 
           APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source);
  }

  /**
   * 🆕 检查是否应该自动详情提取
   */
  shouldAutoExtractDetails() {
    const config = this.configManager.config;
    return config.enableDetailExtraction && 
           config.autoExtractDetails && 
           authManager.isAuthenticated();
  }

  /**
   * 🆕 执行自动详情提取
   */
  async performAutoDetailExtraction(results, keyword) {
    const config = this.configManager.config;
    
    // 筛选支持详情提取的结果
    const supportedResults = results.filter(result => 
      this.shouldExtractDetailForResult(result)
    );
    
    if (supportedResults.length === 0) {
      console.log('没有支持自动详情提取的结果');
      return;
    }
    
    // 按优先级排序并限制数量
    const prioritizedResults = supportedResults
      .sort((a, b) => b.enhancedMetadata.extractionPriority.score - a.enhancedMetadata.extractionPriority.score)
      .slice(0, config.maxAutoExtractions);
    
    console.log(`自动详情提取: 选择了 ${prioritizedResults.length} 个高优先级结果`);
    
    // 延迟执行以避免阻塞UI
    setTimeout(async () => {
      await this.extractionManager.handleDetailExtraction(
        prioritizedResults, 
        keyword, 
        { ...config, autoExtraction: true }
      );
    }, 2000);
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
        apiService.recordAction('visit_site', { url, source, architecture: this.version }).catch(console.error);
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
        apiService.recordAction('copy_url', { url: text, architecture: this.version }).catch(console.error);
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

    // 🆕 新架构信息
    if (result.architectureVersion) {
      details.push(`架构版本: ${result.architectureVersion}`);
    }

    if (result.enhancedMetadata) {
      const metadata = result.enhancedMetadata;
      details.push(`质量等级: ${metadata.qualityIndicators?.level || '未知'}`);
      details.push(`提取优先级: ${metadata.extractionPriority?.level || '未知'}`);
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
   * 导出搜索结果 - 增强新架构支持
   */
  async exportResults() {
    const extractionStats = this.extractionManager.getExtractionStats();
    const searchStats = this.getSearchStatistics();
    
    const result = await this.resultsRenderer.exportResults({
      ...extractionStats,
      searchStatistics: searchStats,
      architectureVersion: this.version,
      exportTimestamp: Date.now()
    });
    
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

  // ===================== 🆕 新架构特有方法 =====================

  /**
   * 🆕 更新搜索统计
   */
  updateSearchStatistics(stats) {
    // 实现搜索统计更新逻辑
    if (!this.searchStats) {
      this.searchStats = {
        totalSearches: 0,
        totalResults: 0,
        totalExtractions: 0,
        averageResultsPerSearch: 0,
        averageSearchTime: 0
      };
    }
    
    // 更新统计数据
    this.searchStats.totalSearches++;
    this.searchStats.totalExtractions += stats.total || 0;
    this.searchStats.totalResults += stats.successful || 0;
  }

  /**
   * 🆕 显示提取洞察
   */
  showExtractionInsights(stats, keyword) {
    if (!stats || stats.total === 0) return;
    
    const insights = [];
    
    if (stats.successRate > 80) {
      insights.push(`提取成功率优秀 (${stats.successRate}%)`);
    }
    
    if (stats.cacheHitRate > 50) {
      insights.push(`缓存命中率良好 (${stats.cacheHitRate}%)`);
    }
    
    if (stats.averageTime < 5000) {
      insights.push(`提取速度优秀 (平均 ${stats.averageTime}ms)`);
    }
    
    if (insights.length > 0) {
      showToast(`提取洞察: ${insights.join(', ')}`, 'info', 8000);
    }
  }

  /**
   * 🆕 记录搜索性能
   */
  recordSearchPerformance(keyword, resultCount, searchTime) {
    if (!this.performanceMetrics) {
      this.performanceMetrics = [];
    }
    
    this.performanceMetrics.push({
      keyword,
      resultCount,
      searchTime,
      timestamp: Date.now(),
      architecture: this.version
    });
    
    // 保持最近100条记录
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }
    
    console.log(`搜索性能记录: ${keyword} -> ${resultCount}个结果, 用时${searchTime.toFixed(2)}ms`);
  }

  /**
   * 🆕 错误上报
   */
  reportSearchError(keyword, error) {
    if (authManager.isAuthenticated()) {
      apiService.recordAction('search_error', {
        keyword,
        errorMessage: error.message,
        errorType: error.name,
        architecture: this.version,
        timestamp: Date.now()
      }).catch(console.error);
    }
  }

  /**
   * 🆕 更新服务状态指示器
   */
  updateServiceStatusIndicators(statusDetail) {
    const indicators = document.querySelectorAll('.service-status-indicator');
    indicators.forEach(indicator => {
      indicator.className = `service-status-indicator ${statusDetail.status}`;
      indicator.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-text">${statusDetail.message}</span>
      `;
    });
  }

  /**
   * 🆕 获取搜索统计
   */
  getSearchStatistics() {
    return {
      ...this.searchStats,
      performanceMetrics: this.performanceMetrics?.slice(-20) || [], // 最近20条性能记录
      architecture: this.version,
      lastUpdated: Date.now()
    };
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

    // 🆕 监听架构升级事件
    document.addEventListener('architectureUpgraded', (event) => {
      const { version, features } = event.detail;
      console.log(`检测到架构升级: ${version}`, features);
      this.handleArchitectureUpgrade(version, features);
    });
  }

  /**
   * 🆕 处理架构升级
   */
  async handleArchitectureUpgrade(version, features) {
    if (version !== this.version) {
      console.log(`升级到新架构版本: ${this.version} -> ${version}`);
      this.version = version;
      this.architectureFeatures = { ...this.architectureFeatures, ...features };
      
      // 重新初始化组件以适配新架构
      await this.reinitializeForNewArchitecture();
      
      showToast(`已升级到新架构 v${version}`, 'success');
    }
  }

  /**
   * 🆕 为新架构重新初始化
   */
  async reinitializeForNewArchitecture() {
    try {
      // 刷新配置以适配新架构
      await this.configManager.refreshDetailConfig();
      
      // 重新检查服务健康状态
      await this.checkArchitectureHealth();
      
      // 更新UI指示器
      this.updateArchitectureIndicators();
      
    } catch (error) {
      console.error('新架构初始化失败:', error);
    }
  }

  /**
   * 🆕 更新架构指示器
   */
  updateArchitectureIndicators() {
    const indicators = document.querySelectorAll('.architecture-indicator');
    indicators.forEach(indicator => {
      indicator.innerHTML = `
        <span class="arch-version">v${this.version}</span>
        <span class="arch-features">${Object.keys(this.architectureFeatures).length} 特性</span>
      `;
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
   * 暴露全局方法 - 增强新架构支持
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
      getSearchStatistics: () => this.getSearchStatistics(),
      
      // 🆕 新架构特有方法
      getArchitectureVersion: () => this.version,
      getArchitectureFeatures: () => this.architectureFeatures,
      checkArchitectureHealth: () => this.checkArchitectureHealth(),
      getPerformanceMetrics: () => this.performanceMetrics || [],
      
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
   * 获取服务状态 - 增强新架构信息
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      extractionInProgress: this.extractionManager.extractionInProgress,
      currentResults: this.resultsRenderer.getCurrentResults().length,
      searchHistory: this.historyManager.getHistory().length,
      extractionStats: this.extractionManager.getExtractionStats(),
      searchStats: this.getSearchStatistics(),
      config: this.configManager.getConfig(),
      configCacheValid: this.configManager.isConfigCacheValid(),
      
      // 🆕 新架构信息
      architectureVersion: this.version,
      architectureFeatures: this.architectureFeatures,
      performanceMetrics: this.performanceMetrics?.length || 0,
      
      features: {
        detailExtraction: this.configManager.config.enableDetailExtraction,
        autoExtraction: this.configManager.config.autoExtractDetails,
        caching: this.configManager.config.enableCache,
        retry: this.configManager.config.enableRetry,
        configUI: true,
        // 🆕 新架构特性
        modularParsers: this.architectureFeatures.modularParsers,
        unifiedDataStructure: this.architectureFeatures.unifiedDataStructure,
        dynamicConfiguration: this.architectureFeatures.dynamicConfiguration,
        serviceHealthMonitoring: this.architectureFeatures.serviceHealthMonitoring
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
   * 清理资源 - 增强新架构清理
   */
  cleanup() {
    // 清理所有子组件
    this.configManager.cleanup();
    this.historyManager.cleanup();
    this.extractionManager.cleanup();
    this.resultsRenderer.cleanup();
    this.suggestionManager.cleanup();
    
    // 🆕 清理新架构特有资源
    this.performanceMetrics = [];
    this.searchStats = null;
    this.architectureFeatures = {};
    
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
    
    console.log(`统一搜索管理器资源已清理 (v${this.version})`);
  }
}

// 创建全局实例
export const unifiedSearchManager = new UnifiedSearchManager();
export default unifiedSearchManager;

// 向后兼容导出
export const searchManager = unifiedSearchManager;
export const enhancedSearchManager = unifiedSearchManager;