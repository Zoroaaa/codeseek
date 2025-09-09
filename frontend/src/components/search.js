// src/components/search.js - 统一搜索组件（完善版详情提取功能集成）
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { debounce } from '../utils/helpers.js';
import searchService, { searchHistoryManager } from '../services/search.js';
import detailAPIService from '../services/detail-api.js';
import detailCardManager from './detail-card.js';
import authManager from '../services/auth.js';
import favoritesManager from './favorites.js';
import apiService from '../services/api.js';

export class UnifiedSearchManager {
  constructor() {
    this.currentResults = [];
    this.searchHistory = [];
    this.isInitialized = false;
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
    
    // 详情提取相关状态
    this.extractionInProgress = false;
    this.extractionQueue = [];
    this.extractionProgress = new Map();
    this.extractionErrors = new Map();
    this.extractionRetries = new Map();
    this.extractionCancelledIds = new Set();
    
    // 配置管理
    this.config = {
      // 基础搜索配置
      useCache: true,
      saveToHistory: true,
      
      // 详情提取配置
      enableDetailExtraction: false,
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      maxConcurrentExtractions: 4,
      enableExtractionRetry: true,
      maxExtractionRetries: 2,
      extractionRetryDelay: 1000,
      showExtractionProgress: true,
      enableCache: true,
      
      // 显示选项
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      showMetadata: true,
      showTags: true,
      compactMode: false,
      enableImagePreview: true,
      
      // 高级选项
      cacheStrategy: 'normal',
      preferredExtractionSources: [],
      enableContentFilter: false,
      contentFilterKeywords: []
    };
    
    // 性能统计
    this.performanceStats = {
      searchCount: 0,
      extractionCount: 0,
      cacheHitCount: 0,
      averageSearchTime: 0,
      averageExtractionTime: 0,
      errorCount: 0
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 初始化详情卡片管理器
      await detailCardManager.init();
      
      // 加载用户配置
      await this.loadUserConfig();
      
      // 加载搜索历史
      await this.loadSearchHistory();
      
      // 绑定事件
      this.bindEvents();
      
      // 处理URL参数
      this.handleURLParams();
      
      // 暴露全局方法
      this.exposeGlobalMethods();
      
      // 初始化详情提取进度管理
      this.initExtractionProgressManager();
      
      this.isInitialized = true;
      console.log('统一搜索管理器初始化完成');
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
    }
  }

  /**
   * 初始化详情提取进度管理
   */
  initExtractionProgressManager() {
    // 创建提取进度管理器
    this.extractionProgressManager = {
      activeExtractions: new Map(),
      completedExtractions: new Set(),
      failedExtractions: new Set(),
      
      // 添加提取任务
      addTask: (taskId, resultData) => {
        this.extractionProgressManager.activeExtractions.set(taskId, {
          id: taskId,
          result: resultData,
          startTime: Date.now(),
          status: 'pending',
          progress: 0,
          error: null,
          retryCount: 0
        });
      },
      
      // 更新任务状态
      updateTask: (taskId, updates) => {
        const task = this.extractionProgressManager.activeExtractions.get(taskId);
        if (task) {
          Object.assign(task, updates);
        }
      },
      
      // 完成任务
      completeTask: (taskId, success = true) => {
        const task = this.extractionProgressManager.activeExtractions.get(taskId);
        if (task) {
          task.endTime = Date.now();
          task.duration = task.endTime - task.startTime;
          
          if (success) {
            this.extractionProgressManager.completedExtractions.add(taskId);
          } else {
            this.extractionProgressManager.failedExtractions.add(taskId);
          }
          
          // 延迟清理任务数据
          setTimeout(() => {
            this.extractionProgressManager.activeExtractions.delete(taskId);
          }, 5000);
        }
      },
      
      // 获取统计信息
      getStats: () => {
        const active = this.extractionProgressManager.activeExtractions.size;
        const completed = this.extractionProgressManager.completedExtractions.size;
        const failed = this.extractionProgressManager.failedExtractions.size;
        const total = active + completed + failed;
        
        return {
          active,
          completed,
          failed,
          total,
          successRate: total > 0 ? (completed / total) * 100 : 0
        };
      }
    };
  }

  /**
   * 执行搜索 - 智能选择基础搜索或增强搜索
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
      const startTime = Date.now();
      
      // 隐藏提示区域
      this.hideQuickTips();

      // 显示搜索状态检查进度（如果启用）
      await this.showSearchStatusIfEnabled(keyword);

      // 执行基础搜索
      const searchResults = await searchService.performSearch(keyword, {
        useCache: this.config.useCache,
        saveToHistory: this.config.saveToHistory && authManager.isAuthenticated()
      });
      
      // 记录搜索性能
      this.performanceStats.searchCount++;
      this.performanceStats.averageSearchTime = this.updateAverage(
        this.performanceStats.averageSearchTime,
        Date.now() - startTime,
        this.performanceStats.searchCount
      );
      
      if (!searchResults || searchResults.length === 0) {
        showToast('未找到搜索结果', 'warning');
        this.displaySearchResults(keyword, []);
        return;
      }

      // 显示基础搜索结果
      this.displaySearchResults(keyword, searchResults);
      
      // 更新搜索历史
      if (authManager.isAuthenticated()) {
        await this.addToHistory(keyword);
      }

      // 检查是否启用详情提取
      if (this.shouldUseDetailExtraction() && authManager.isAuthenticated()) {
        await this.handleDetailExtraction(searchResults);
      } else if (!authManager.isAuthenticated() && this.config.enableDetailExtraction) {
        this.showDetailExtractionLoginPrompt();
      }

      // 更新性能统计
      this.updatePerformanceStatsUI();

    } catch (error) {
      console.error('搜索失败:', error);
      this.performanceStats.errorCount++;
      showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
      this.extractionInProgress = false;
    }
  }

  /**
   * 显示详情提取登录提示
   */
  showDetailExtractionLoginPrompt() {
    const loginPrompt = document.createElement('div');
    loginPrompt.className = 'detail-extraction-login-prompt';
    loginPrompt.innerHTML = `
      <div class="prompt-content">
        <span class="prompt-icon">🔋</span>
        <span class="prompt-text">登录后可使用详情提取功能</span>
        <button class="prompt-login-btn" onclick="document.getElementById('loginModal').style.display='block'">
          立即登录
        </button>
        <button class="prompt-close-btn" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) {
      resultsSection.insertBefore(loginPrompt, resultsSection.firstChild);
      
      // 3秒后自动隐藏
      setTimeout(() => {
        if (loginPrompt.parentElement) {
          loginPrompt.remove();
        }
      }, 3000);
    }
  }

  /**
   * 判断是否应该使用详情提取
   */
  shouldUseDetailExtraction() {
    return this.config.enableDetailExtraction && 
           authManager.isAuthenticated();
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

      // 如果页面有状态指示器，显示它
      const statusIndicator = document.getElementById('searchStatusIndicator');
      if (statusIndicator) {
        statusIndicator.style.display = 'block';
        statusIndicator.innerHTML = `
          <div class="status-check-progress">
            <div class="progress-spinner"></div>
            <span>检查搜索源状态中...</span>
            <small>正在验证 "${escapeHtml(keyword)}" 的内容匹配</small>
          </div>
        `;
      }
    } catch (error) {
      console.warn('显示状态检查进度失败:', error);
    }
  }

  /**
   * 处理详情提取
   */
  async handleDetailExtraction(searchResults) {
    if (this.extractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.extractionInProgress = true;
      
      // 确定要提取详情的结果
      const resultsToExtract = this.selectResultsForExtraction(searchResults);

      if (resultsToExtract.length === 0) {
        console.log('没有需要提取详情的结果');
        return;
      }

      // 显示提取进度
      if (this.config.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length);
      }

      // 智能批量提取详情
      await this.smartBatchExtraction(resultsToExtract);

    } catch (error) {
      console.error('详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      this.extractionInProgress = false;
      this.hideExtractionProgress();
    }
  }

  /**
   * 选择需要提取详情的结果
   */
  selectResultsForExtraction(searchResults) {
    // 过滤支持详情提取的结果
    const supportedResults = searchResults.filter(result => 
      this.shouldExtractDetail(result)
    );

    if (this.config.autoExtractDetails) {
      // 自动提取模式：选择前N个结果
      return supportedResults.slice(0, this.config.maxAutoExtractions);
    } else {
      // 手动模式：返回所有支持的结果（用户可选择性提取）
      return supportedResults;
    }
  }

  /**
   * 智能批量详情提取
   */
  async smartBatchExtraction(results) {
    const batchSize = this.config.extractionBatchSize;
    const maxConcurrent = this.config.maxConcurrentExtractions;
    let processedCount = 0;
    
    // 按优先级排序结果
    const prioritizedResults = this.prioritizeExtractionResults(results);
    
    // 并发处理批次
    const batches = [];
    for (let i = 0; i < prioritizedResults.length; i += batchSize) {
      batches.push(prioritizedResults.slice(i, i + batchSize));
    }

    // 控制并发批次数量
    for (let i = 0; i < batches.length; i += maxConcurrent) {
      const concurrentBatches = batches.slice(i, i + maxConcurrent);
      
      // 并发执行多个批次
      const batchPromises = concurrentBatches.map(async (batch, batchIndex) => {
        try {
          await this.processBatch(batch, i + batchIndex);
          processedCount += batch.length;
          
          // 更新全局进度
          if (this.config.showExtractionProgress) {
            this.updateExtractionProgress(processedCount, results.length);
          }
          
        } catch (error) {
          console.error(`批次 ${i + batchIndex + 1} 处理失败:`, error);
          
          // 处理失败的批次中的每个结果
          batch.forEach(result => {
            this.handleExtractionError(result.id, error);
            processedCount++;
          });
        }
      });

      // 等待当前并发批次完成
      await Promise.allSettled(batchPromises);
      
      // 批次间延迟
      if (i + maxConcurrent < batches.length) {
        await this.delay(this.config.extractionRetryDelay);
      }
    }

    console.log(`智能批量详情提取完成: ${processedCount}/${results.length}`);
    
    // 更新统计信息
    this.performanceStats.extractionCount += processedCount;
    this.updateExtractionStatsEvent();
  }

  /**
   * 按优先级排序提取结果
   */
  prioritizeExtractionResults(results) {
    return results.sort((a, b) => {
      // 优先级源排序
      const aPriority = APP_CONSTANTS.DETAIL_EXTRACTION_PRIORITY_SOURCES?.indexOf(a.source) ?? -1;
      const bPriority = APP_CONSTANTS.DETAIL_EXTRACTION_PRIORITY_SOURCES?.indexOf(b.source) ?? -1;
      
      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      // 用户偏好源排序
      const aPreferred = this.config.preferredExtractionSources.indexOf(a.source);
      const bPreferred = this.config.preferredExtractionSources.indexOf(b.source);
      
      if (aPreferred !== -1 && bPreferred !== -1) {
        return aPreferred - bPreferred;
      }
      if (aPreferred !== -1) return -1;
      if (bPreferred !== -1) return 1;
      
      // 默认按原始顺序
      return 0;
    });
  }

  /**
   * 处理单个批次
   */
  async processBatch(batch, batchIndex) {
    try {
      console.log(`开始处理批次 ${batchIndex + 1}: ${batch.length} 个结果`);
      
      // 为批次中的每个结果添加进度追踪
      batch.forEach(result => {
        this.extractionProgressManager.addTask(result.id, result);
      });
      
      // 使用详情API服务进行批量提取
      const extractionResult = await detailAPIService.extractBatchDetails(batch, {
        enableCache: this.config.enableCache,
        timeout: 15000,
        onProgress: (progress) => {
          // 更新单个结果的进度
          if (progress.resultId) {
            this.extractionProgressManager.updateTask(progress.resultId, {
              progress: progress.percentage,
              status: progress.status
            });
          }
        }
      });

      // 处理批次提取结果
      for (const result of extractionResult.results) {
        if (this.extractionCancelledIds.has(result.id)) {
          console.log(`提取已取消: ${result.id}`);
          continue;
        }
        
        await this.handleSingleExtractionResult(result);
        
        // 更新任务状态
        const isSuccess = result.extractionStatus === 'success' || result.extractionStatus === 'cached';
        this.extractionProgressManager.completeTask(result.id, isSuccess);
      }

    } catch (error) {
      console.error(`批次 ${batchIndex + 1} 处理失败:`, error);
      
      // 处理批次失败
      batch.forEach(result => {
        this.extractionProgressManager.completeTask(result.id, false);
        this.handleExtractionError(result.id, error);
      });
      
      throw error;
    }
  }

  /**
   * 处理提取错误
   */
  handleExtractionError(resultId, error) {
    const errorInfo = {
      resultId,
      error: error.message || 'Unknown error',
      timestamp: Date.now(),
      canRetry: this.canRetryExtraction(error)
    };
    
    this.extractionErrors.set(resultId, errorInfo);
    
    // 显示错误状态
    const resultContainer = document.querySelector(`[data-result-id="${resultId}"]`);
    if (resultContainer) {
      this.showExtractionError(resultContainer, error.message, errorInfo.canRetry);
    }
  }

  /**
   * 判断是否可以重试提取
   */
  canRetryExtraction(error) {
    const retryableErrors = [
      'TimeoutError',
      'NetworkError',
      'TemporaryError',
      'RateLimitError'
    ];
    
    return retryableErrors.some(errorType => 
      error.name === errorType || error.message.includes(errorType)
    );
  }

  /**
   * 处理单个提取结果
   */
  async handleSingleExtractionResult(result) {
    try {
      const resultContainer = document.querySelector(`[data-result-id="${result.id}"]`);
      if (!resultContainer) {
        console.warn('未找到对应的结果容器:', result.id);
        return;
      }

      if (result.extractionStatus === 'success' || result.extractionStatus === 'cached') {
        // 创建详情卡片
        const detailCardHTML = detailCardManager.createDetailCardHTML(result, result, {
          compactMode: this.config.compactMode,
          showScreenshots: this.config.showScreenshots,
          showDownloadLinks: this.config.showDownloadLinks,
          showMagnetLinks: this.config.showMagnetLinks,
          showActressInfo: this.config.showActressInfo,
          showMetadata: this.config.showMetadata,
          showTags: this.config.showTags,
          enableImagePreview: this.config.enableImagePreview
        });

        // 插入详情卡片
        const detailContainer = this.getOrCreateDetailContainer(resultContainer);
        detailContainer.innerHTML = detailCardHTML;
        detailContainer.style.display = 'block';

        // 添加展开/收起功能
        this.addDetailToggleButton(resultContainer);
        
        // 应用内容过滤
        if (this.config.enableContentFilter) {
          this.applyContentFilter(detailContainer);
        }
        
        // 记录成功提取
        if (result.extractionStatus === 'cached') {
          this.performanceStats.cacheHitCount++;
        }

      } else {
        // 显示提取失败状态
        this.showExtractionError(resultContainer, result.extractionError, 
          this.canRetryExtraction({ message: result.extractionError }));
      }

    } catch (error) {
      console.error('处理提取结果失败:', error);
    }
  }

  /**
   * 应用内容过滤
   */
  applyContentFilter(detailContainer) {
    if (!this.config.contentFilterKeywords.length) return;
    
    const filterKeywords = this.config.contentFilterKeywords.map(k => k.toLowerCase());
    const textElements = detailContainer.querySelectorAll('.detail-title, .detail-description, .tag-item');
    
    let shouldHide = false;
    
    textElements.forEach(element => {
      const text = element.textContent.toLowerCase();
      if (filterKeywords.some(keyword => text.includes(keyword))) {
        shouldHide = true;
      }
    });
    
    if (shouldHide) {
      detailContainer.style.display = 'none';
      const notice = document.createElement('div');
      notice.className = 'content-filtered-notice';
      notice.innerHTML = `
        <div class="filtered-content">
          <span class="filter-icon">🔒</span>
          <span>内容已被过滤</span>
          <button class="show-filtered-btn" onclick="this.parentElement.parentElement.nextElementSibling.style.display='block'; this.parentElement.parentElement.remove();">
            显示内容
          </button>
        </div>
      `;
      detailContainer.parentElement.insertBefore(notice, detailContainer);
    }
  }

  /**
   * 显示搜索结果
   */
  displaySearchResults(keyword, results) {
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 计算状态统计
    const statusStats = this.calculateStatusStats(results);
    
    // 计算详情提取统计
    const extractionStats = this.calculateExtractionStats(results);
    
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        const availableCount = statusStats.available;
        const unavailableCount = statusStats.unavailable + statusStats.timeout + statusStats.error;
        const totalCount = results.length;
        const contentMatches = statusStats.contentMatches || 0;
        
        statusInfo = ` | 可用: ${availableCount}/${totalCount}`;
        
        if (unavailableCount > 0) {
          statusInfo += ` | 不可用: ${unavailableCount}`;
        }
        
        if (contentMatches > 0) {
          statusInfo += ` | 内容匹配: ${contentMatches}`;
        }
      }
      
      // 添加详情提取信息
      let detailExtractionInfo = '';
      if (this.shouldUseDetailExtraction()) {
        detailExtractionInfo = ` | 支持详情提取: ${extractionStats.supported}`;
        if (extractionStats.extracted > 0) {
          detailExtractionInfo += ` | 已提取: ${extractionStats.extracted}`;
        }
      }
      
      searchInfo.innerHTML = `
        搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
        (${results.length}个结果${statusInfo}${detailExtractionInfo}) 
        <small>${new Date().toLocaleString()}</small>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
      
      // 绑定事件委托
      this.bindResultsEvents(resultsContainer);
    }
    
    // 隐藏状态指示器
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
    
    // 显示详情提取统计
    this.updateDetailExtractionStatsUI(extractionStats);
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  /**
   * 计算详情提取统计
   */
  calculateExtractionStats(results) {
    const supported = results.filter(result => this.shouldExtractDetail(result)).length;
    const extracted = results.filter(result => 
      result.extractionStatus === 'success' || result.extractionStatus === 'cached'
    ).length;
    
    return {
      total: results.length,
      supported,
      extracted,
      pending: supported - extracted,
      extractionRate: supported > 0 ? (extracted / supported) * 100 : 0
    };
  }

  /**
   * 更新详情提取统计UI
   */
  updateDetailExtractionStatsUI(stats = null) {
    const statsSection = document.getElementById('detailExtractionStats');
    const supportedCount = document.getElementById('supportedCount');
    const extractedCount = document.getElementById('extractedCount');
    const successRate = document.getElementById('successRate');
    
    if (statsSection && this.shouldUseDetailExtraction()) {
      statsSection.style.display = 'block';
      
      if (stats) {
        if (supportedCount) supportedCount.textContent = stats.supported;
        if (extractedCount) extractedCount.textContent = stats.extracted;
        if (successRate) successRate.textContent = `${Math.round(stats.extractionRate)}%`;
      }
    } else if (statsSection) {
      statsSection.style.display = 'none';
    }
  }

  /**
   * 创建搜索结果HTML
   */
  createResultHTML(result) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    
    // 状态指示器HTML
    let statusIndicator = '';
    if (result.status) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status);
      const statusTime = result.lastChecked ? 
        `检查时间: ${formatRelativeTime(result.lastChecked)}` : '';
      
      let statusDetails = [];
      if (result.responseTime > 0) {
        statusDetails.push(`响应: ${result.responseTime}ms`);
      }
      if (result.qualityScore > 0) {
        statusDetails.push(`质量: ${result.qualityScore}/100`);
      }
      if (result.contentMatch) {
        statusDetails.push('内容匹配');
      }
      if (result.fromCache) {
        statusDetails.push('缓存');
      }
      
      const detailsText = statusDetails.length > 0 ? ` (${statusDetails.join(', ')})` : '';
      
      let unavailableReasonHTML = '';
      if (isUnavailable && result.unavailableReason) {
        unavailableReasonHTML = `<div class="unavailable-reason">原因: ${escapeHtml(result.unavailableReason)}</div>`;
      }
      
      statusIndicator = `
        <div class="result-status ${statusClass}" title="${statusText}${detailsText} ${statusTime}">
          <span class="status-icon">${this.getStatusIcon(result.status)}</span>
          <span class="status-text">${statusText}</span>
          ${result.contentMatch ? '<span class="content-match-badge">✓</span>' : ''}
          ${result.fromCache ? '<span class="cache-badge">💾</span>' : ''}
        </div>
        ${unavailableReasonHTML}
      `;
    }
    
    // 访问按钮状态
    const visitButtonHTML = isUnavailable ? `
      <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
        <span>不可用</span>
      </button>
    ` : `
      <button class="action-btn visit-btn" data-action="visit" data-url="${escapeHtml(result.url)}" data-source="${result.source}">
        <span>访问</span>
      </button>
    `;

    // 详情提取按钮
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable && this.shouldUseDetailExtraction() ? `
      <button class="action-btn detail-btn" data-action="extractDetail" data-result-id="${result.id}" title="提取详情信息">
        <span class="btn-icon">🔋</span>
        <span class="btn-text">详情</span>
      </button>
    ` : '';
    
    // 详情提取状态指示器
    let extractionStatusHTML = '';
    if (supportsDetailExtraction && this.shouldUseDetailExtraction()) {
      const extractionStatus = result.extractionStatus || 'pending';
      const statusIcons = {
        'pending': '⏳',
        'in_progress': '🔄',
        'success': '✅',
        'cached': '💾',
        'error': '❌',
        'timeout': '⏰'
      };
      
      extractionStatusHTML = `
        <div class="extraction-status extraction-status-${extractionStatus}">
          <span class="extraction-icon">${statusIcons[extractionStatus] || '❓'}</span>
          <span class="extraction-text">${this.getExtractionStatusText(extractionStatus)}</span>
        </div>
      `;
    }
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''}" 
           data-id="${result.id}" 
           data-result-id="${result.id}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          <div class="result-url" title="${escapeHtml(result.url)}">
            ${truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${statusIndicator}
            ${extractionStatusHTML}
          </div>
        </div>
        <div class="result-actions">
          ${visitButtonHTML}
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.url)}">
            <span>复制</span>
          </button>
          ${detailExtractionButtonHTML}
          ${result.status ? `
            <button class="action-btn status-btn" data-action="checkStatus" data-source="${result.source}" data-result-id="${result.id}" title="重新检查状态">
              <span>🔄</span>
            </button>
          ` : ''}
        </div>
        
        <!-- 详情显示容器 -->
        <div class="result-detail-container" style="display: none;">
          <!-- 详情内容将在这里动态插入 -->
        </div>
      </div>
    `;
  }

  /**
   * 获取提取状态文本
   */
  getExtractionStatusText(status) {
    const statusTexts = {
      'pending': '待提取',
      'in_progress': '提取中',
      'success': '已提取',
      'cached': '缓存',
      'error': '失败',
      'timeout': '超时'
    };
    return statusTexts[status] || '未知';
  }

  /**
   * 提取单个详情
   */
  async extractSingleDetail(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) {
      showToast('未找到对应的搜索结果', 'error');
      return;
    }

    if (!this.shouldExtractDetail(result)) {
      showToast('该搜索源不支持详情提取', 'warning');
      return;
    }

    try {
      showLoading(true);
      showToast('正在提取详情...', 'info');
      
      // 添加到进度管理器
      this.extractionProgressManager.addTask(resultId, result);
      
      // 更新UI状态
      this.updateExtractionStatusInResult(resultId, 'in_progress');
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, {
        enableCache: this.config.enableCache,
        timeout: 15000
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      });
      
      // 完成任务
      this.extractionProgressManager.completeTask(resultId, true);
      
      // 更新UI状态
      this.updateExtractionStatusInResult(resultId, extractedDetail.extractionStatus);

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('单独详情提取失败:', error);
      
      // 处理错误
      this.handleExtractionError(resultId, error);
      this.extractionProgressManager.completeTask(resultId, false);
      
      // 更新UI状态
      this.updateExtractionStatusInResult(resultId, 'error');
      
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 更新结果中的提取状态
   */
  updateExtractionStatusInResult(resultId, status) {
    const resultElement = document.querySelector(`[data-result-id="${resultId}"]`);
    if (!resultElement) return;
    
    const statusElement = resultElement.querySelector('.extraction-status');
    if (statusElement) {
      statusElement.className = `extraction-status extraction-status-${status}`;
      
      const iconElement = statusElement.querySelector('.extraction-icon');
      const textElement = statusElement.querySelector('.extraction-text');
      
      const statusIcons = {
        'pending': '⏳',
        'in_progress': '🔄',
        'success': '✅',
        'cached': '💾',
        'error': '❌',
        'timeout': '⏰'
      };
      
      if (iconElement) iconElement.textContent = statusIcons[status] || '❓';
      if (textElement) textElement.textContent = this.getExtractionStatusText(status);
    }
  }

  /**
   * 绑定结果事件
   */
  bindResultsEvents(container) {
    container.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const resultId = button.dataset.resultId;
      const source = button.dataset.source;

      switch (action) {
        case 'visit':
          this.openResult(url, source);
          break;
        case 'favorite':
          this.toggleFavorite(resultId);
          break;
        case 'copy':
          this.copyToClipboard(url);
          break;
        case 'extractDetail':
          this.extractSingleDetail(resultId);
          break;
        case 'checkStatus':
          this.checkSingleSourceStatus(source, resultId);
          break;
        case 'viewDetails':
          this.viewSourceStatusDetails(resultId);
          break;
      }
    });
  }

  // ===================== 详情提取辅助方法 =====================

  /**
   * 判断是否应该提取详情
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    return APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source) || false;
  }

  /**
   * 获取或创建详情容器
   */
  getOrCreateDetailContainer(resultContainer) {
    let detailContainer = resultContainer.querySelector('.result-detail-container');
    
    if (!detailContainer) {
      detailContainer = document.createElement('div');
      detailContainer.className = 'result-detail-container';
      detailContainer.style.display = 'none';
      resultContainer.appendChild(detailContainer);
    }
    
    return detailContainer;
  }

  /**
   * 添加详情展开/收起按钮
   */
  addDetailToggleButton(resultContainer) {
    const actionsContainer = resultContainer.querySelector('.result-actions');
    if (!actionsContainer) return;

    // 检查是否已存在按钮
    if (actionsContainer.querySelector('.detail-toggle-btn')) return;

    const toggleButton = document.createElement('button');
    toggleButton.className = 'action-btn detail-toggle-btn';
    toggleButton.innerHTML = `
      <span class="btn-icon">🔋</span>
      <span class="btn-text">查看详情</span>
    `;
    
    toggleButton.addEventListener('click', () => {
      this.toggleDetailDisplay(resultContainer.dataset.resultId || resultContainer.dataset.id);
    });

    actionsContainer.appendChild(toggleButton);
  }

  /**
   * 切换详情显示状态
   */
  toggleDetailDisplay(resultId) {
    const resultContainer = document.querySelector(`[data-result-id="${resultId}"], [data-id="${resultId}"]`);
    if (!resultContainer) return;

    const detailContainer = resultContainer.querySelector('.result-detail-container');
    const toggleBtn = resultContainer.querySelector('.detail-toggle-btn');
    
    if (!detailContainer || !toggleBtn) return;

    const isVisible = detailContainer.style.display !== 'none';
    
    detailContainer.style.display = isVisible ? 'none' : 'block';
    
    const btnText = toggleBtn.querySelector('.btn-text');
    const btnIcon = toggleBtn.querySelector('.btn-icon');
    
    if (btnText) {
      btnText.textContent = isVisible ? '查看详情' : '隐藏详情';
    }
    
    if (btnIcon) {
      btnIcon.textContent = isVisible ? '🔋' : '🔄';
    }

    // 添加动画效果
    if (!isVisible) {
      detailContainer.style.opacity = '0';
      detailContainer.style.transform = 'translateY(-10px)';
      
      requestAnimationFrame(() => {
        detailContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        detailContainer.style.opacity = '1';
        detailContainer.style.transform = 'translateY(0)';
      });
    }
  }

  /**
   * 显示提取错误
   */
  showExtractionError(resultContainer, error, canRetry = false) {
    const detailContainer = this.getOrCreateDetailContainer(resultContainer);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">❌</div>
        <div class="error-message">
          <strong>详情提取失败</strong>
          <small>${escapeHtml(error || '未知错误')}</small>
        </div>
        ${canRetry ? `
          <button class="retry-btn" onclick="window.unifiedSearchManager.retryExtraction('${resultContainer.dataset.resultId}')">
            重试
          </button>
        ` : ''}
      </div>
    `;
    
    detailContainer.style.display = 'block';
  }

  /**
   * 重试详情提取
   */
  async retryExtraction(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) {
      showToast('未找到对应的搜索结果', 'error');
      return;
    }

    try {
      showToast('正在重试详情提取...', 'info');
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, {
        enableCache: false,
        useLocalCache: false
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      });

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('重试详情提取失败:', error);
      showToast('重试失败: ' + error.message, 'error');
    }
  }

  /**
   * 显示提取进度
   */
  showExtractionProgress(total) {
    let progressContainer = document.getElementById('extraction-progress');
    
    if (!progressContainer) {
      progressContainer = document.createElement('div');
      progressContainer.id = 'extraction-progress';
      progressContainer.className = 'extraction-progress-container';
      
      const searchResults = document.getElementById('resultsSection');
      if (searchResults) {
        searchResults.insertBefore(progressContainer, searchResults.firstChild);
      }
    }

    progressContainer.innerHTML = `
      <div class="progress-header">
        <span class="progress-title">正在提取详情信息</span>
        <span class="progress-stats">0 / ${total}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="progress-message">正在处理搜索结果...</div>
    `;

    progressContainer.style.display = 'block';
  }

  /**
   * 更新提取进度
   */
  updateExtractionProgress(processed, total) {
    const progressContainer = document.getElementById('extraction-progress');
    if (!progressContainer) return;

    const progressStats = progressContainer.querySelector('.progress-stats');
    const progressFill = progressContainer.querySelector('.progress-fill');
    const progressMessage = progressContainer.querySelector('.progress-message');

    if (progressStats) {
      progressStats.textContent = `${processed} / ${total}`;
    }

    if (progressFill) {
      const percentage = (processed / total) * 100;
      progressFill.style.width = `${percentage}%`;
    }

    if (progressMessage) {
      if (processed === total) {
        progressMessage.textContent = '详情提取完成！';
      } else {
        progressMessage.textContent = `正在处理第 ${processed + 1} 个结果...`;
      }
    }
  }

  /**
   * 隐藏提取进度
   */
  hideExtractionProgress() {
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 2000);
    }
  }

  // ===================== 基础搜索功能方法 =====================

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

    const result = this.currentResults.find(r => r.id === resultId);
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

    this.updateFavoriteButtons();
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
        // 更新结果中的状态
        const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
        if (resultIndex !== -1) {
          this.currentResults[resultIndex] = {
            ...this.currentResults[resultIndex],
            status: statusResult.status,
            statusText: statusResult.statusText,
            unavailableReason: statusResult.unavailableReason,
            lastChecked: statusResult.lastChecked,
            responseTime: statusResult.responseTime,
            availabilityScore: statusResult.availabilityScore,
            verified: statusResult.verified,
            contentMatch: statusResult.contentMatch,
            fromCache: statusResult.fromCache
          };
          
          // 重新渲染该结果项
          const resultElement = document.querySelector(`[data-id="${resultId}"]`);
          if (resultElement) {
            resultElement.outerHTML = this.createResultHTML(this.currentResults[resultIndex]);
          }
        }

        const statusEmoji = statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? '✅' : '❌';
        const contentInfo = statusResult.contentMatch ? '，内容匹配' : '';
        let reasonInfo = '';
        
        if (statusResult.unavailableReason && statusResult.status !== APP_CONSTANTS.SOURCE_STATUS.AVAILABLE) {
          reasonInfo = `，原因：${statusResult.unavailableReason}`;
        }
        
        showToast(`${sourceId} ${statusEmoji} ${statusResult.statusText}${contentInfo}${reasonInfo}`, 
          statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 'success' : 'warning',
          5000);
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
    const result = this.currentResults.find(r => r.id === resultId);
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

  // ===================== 搜索历史管理 =====================

  /**
   * 加载搜索历史
   */
  async loadSearchHistory() {
    if (!authManager.isAuthenticated()) {
      this.searchHistory = [];
      this.renderHistory();
      return;
    }

    try {
      this.searchHistory = await searchHistoryManager.getHistory();
      this.renderHistory();
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.renderHistory();
    }
  }

  /**
   * 添加到历史记录
   */
  async addToHistory(keyword) {
    if (!authManager.isAuthenticated()) return;

    try {
      const settings = await apiService.getUserSettings();
      const maxHistory = settings.maxHistoryPerUser || 100;
      
      // 如果超出限制，删除最旧的记录
      if (this.searchHistory.length >= maxHistory) {
        const oldestId = this.searchHistory[this.searchHistory.length - 1].id;
        await apiService.deleteSearchHistory(oldestId);
        this.searchHistory.pop();
      }

      await searchHistoryManager.addToHistory(keyword, 'manual');
      
      this.searchHistory = this.searchHistory.filter(item => 
        item.keyword !== keyword
      );
      
      this.searchHistory.unshift({
        id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        keyword: keyword,
        query: keyword,
        timestamp: Date.now(),
        count: 1,
        source: 'manual'
      });

      const maxHistoryLimit = APP_CONSTANTS.LIMITS?.MAX_HISTORY || 50;
      if (this.searchHistory.length > maxHistoryLimit) {
        this.searchHistory = this.searchHistory.slice(0, maxHistoryLimit);
      }

      this.renderHistory();
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      showToast('保存搜索历史失败', 'warning');
    }
  }

  /**
   * 渲染搜索历史
   */
  renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    if (this.searchHistory.length === 0) {
      if (historySection) historySection.style.display = 'none';
      return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
      historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => 
        `<div class="history-item-container">
          <span class="history-item" data-keyword="${escapeHtml(item.keyword)}">
            ${escapeHtml(item.keyword)}
          </span>
          <button class="history-delete-btn" data-history-id="${item.id}" title="删除这条记录">
            ×
          </button>
        </div>`
      ).join('');

      // 绑定历史项点击事件
      historyList.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        const deleteBtn = e.target.closest('.history-delete-btn');
        
        if (deleteBtn) {
          e.stopPropagation();
          const historyId = deleteBtn.dataset.historyId;
          this.deleteHistoryItem(historyId);
        } else if (historyItem) {
          const keyword = historyItem.dataset.keyword;
          this.searchFromHistory(keyword);
        }
      });
    }
  }

  /**
   * 从历史记录搜索
   */
  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  /**
   * 删除单条历史记录
   */
  async deleteHistoryItem(historyId) {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      // 调用API删除
      await apiService.deleteSearchHistory(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      // 重新渲染历史列表
      this.renderHistory();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 清空搜索历史
   */
  async clearAllHistory() {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？')) return;
    
    try {
      showLoading(true);
      
      await searchHistoryManager.clearAllHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // ===================== UI控制方法 =====================

  /**
   * 清空搜索结果
   */
  clearResults() {
    const resultsSection = document.getElementById('resultsSection');
    const resultsContainer = document.getElementById('results');
    const searchInfo = document.getElementById('searchInfo');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';
    if (exportResultsBtn) exportResultsBtn.style.display = 'none';

    this.currentResults = [];
    showToast('搜索结果已清除', 'success');
  }

  /**
   * 导出搜索结果
   */
  async exportResults() {
    if (this.currentResults.length === 0) {
      showToast('没有搜索结果可以导出', 'error');
      return;
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.0.0',
        statusCheckEnabled: this.statusCheckInProgress,
        lastCheckKeyword: this.lastStatusCheckKeyword,
        detailExtractionEnabled: this.config.enableDetailExtraction
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('搜索结果导出成功', 'success');
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  /**
   * 更新收藏按钮状态
   */
  updateFavoriteButtons() {
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(btn => {
      const resultItem = btn.closest('.result-item');
      const resultId = resultItem?.dataset.id;
      const result = this.currentResults.find(r => r.id === resultId);
      
      if (result) {
        const isFavorited = favoritesManager.isFavorited(result.url);
        btn.querySelector('span').textContent = isFavorited ? '已收藏' : '收藏';
        btn.classList.toggle('favorited', isFavorited);
      }
    });
  }

  // ===================== 搜索建议功能 =====================

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
    if (!query || typeof query !== 'string') return;
    
    const suggestions = searchService.getSearchSuggestions(query, this.searchHistory);
    this.renderSearchSuggestions(suggestions);
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
      return;
    }
    
    suggestionsContainer.innerHTML = suggestions.map(item => {
      const displayText = item.keyword || item.query;
      return `
        <div class="suggestion-item" data-keyword="${escapeHtml(displayText)}">
          <span class="suggestion-icon">🕒</span>
          <span class="suggestion-text">${escapeHtml(displayText)}</span>
        </div>
      `;
    }).join('');
    
    // 绑定建议点击事件
    suggestionsContainer.addEventListener('click', (e) => {
      const suggestionItem = e.target.closest('.suggestion-item');
      if (suggestionItem) {
        const keyword = suggestionItem.dataset.keyword;
        this.searchFromHistory(keyword);
      }
    });
    
    suggestionsContainer.style.display = 'block';
  }

  /**
   * 隐藏搜索建议
   */
  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  // ===================== 辅助方法 =====================

  /**
   * 计算状态统计
   */
  calculateStatusStats(results) {
    const stats = {
      hasStatus: false,
      available: 0,
      unavailable: 0,
      timeout: 0,
      error: 0,
      unknown: 0,
      contentMatches: 0,
      fromCache: 0
    };

    results.forEach(result => {
      if (result.status) {
        stats.hasStatus = true;
        switch (result.status) {
          case APP_CONSTANTS.SOURCE_STATUS.AVAILABLE:
            stats.available++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE:
            stats.unavailable++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.TIMEOUT:
            stats.timeout++;
            break;
          case APP_CONSTANTS.SOURCE_STATUS.ERROR:
            stats.error++;
            break;
          default:
            stats.unknown++;
        }
        
        if (result.contentMatch) {
          stats.contentMatches++;
        }
        if (result.fromCache) {
          stats.fromCache++;
        }
      }
    });

    return stats;
  }

  /**
   * 判断结果是否不可用
   */
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  /**
   * 获取状态样式类
   */
  getStatusClass(status) {
    const statusClasses = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: 'status-available',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: 'status-unavailable',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 'status-timeout',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: 'status-error',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: 'status-checking',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: 'status-unknown'
    };
    return statusClasses[status] || 'status-unknown';
  }

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusTexts = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '可用',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '不可用',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '超时',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '错误',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '检查中',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '未知'
    };
    return statusTexts[status] || '未知';
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const statusIcons = {
      [APP_CONSTANTS.SOURCE_STATUS.AVAILABLE]: '✅',
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '❌',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 更新平均值
   */
  updateAverage(currentAvg, newValue, count) {
    return ((currentAvg * (count - 1)) + newValue) / count;
  }

  /**
   * 更新性能统计UI
   */
  updatePerformanceStatsUI() {
    // 可以在这里添加性能统计的UI更新逻辑
    console.log('Performance Stats:', this.performanceStats);
  }

  /**
   * 触发提取统计更新事件
   */
  updateExtractionStatsEvent() {
    window.dispatchEvent(new CustomEvent('detailExtractionStatsUpdated', {
      detail: this.performanceStats
    }));
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      if (authManager.isAuthenticated()) {
        const userSettings = await apiService.getUserSettings();
        
        this.config = {
          // 基础搜索配置
          useCache: userSettings.cacheResults !== false,
          saveToHistory: userSettings.allowHistory !== false,
          
          // 详情提取配置
          enableDetailExtraction: userSettings.enableDetailExtraction === true,
          autoExtractDetails: userSettings.autoExtractDetails === true,
          maxAutoExtractions: userSettings.maxAutoExtractions || 5,
          extractionBatchSize: Math.min(userSettings.extractionBatchSize || 3, 5),
          maxConcurrentExtractions: userSettings.maxConcurrentExtractions || 4,
          enableExtractionRetry: userSettings.enableExtractionRetry !== false,
          maxExtractionRetries: userSettings.maxExtractionRetries || 2,
          extractionRetryDelay: userSettings.extractionRetryDelay || 1000,
          showExtractionProgress: userSettings.showExtractionProgress !== false,
          enableCache: userSettings.enableCache !== false,
          
          // 显示选项
          showScreenshots: userSettings.showScreenshots !== false,
          showDownloadLinks: userSettings.showDownloadLinks !== false,
          showMagnetLinks: userSettings.showMagnetLinks !== false,
          showActressInfo: userSettings.showActressInfo !== false,
          showMetadata: userSettings.showMetadata !== false,
          showTags: userSettings.showTags !== false,
          compactMode: userSettings.compactMode === true,
          enableImagePreview: userSettings.enableImagePreview !== false,
          
          // 高级选项
          cacheStrategy: userSettings.cacheStrategy || 'normal',
          preferredExtractionSources: userSettings.preferredExtractionSources || [],
          enableContentFilter: userSettings.enableContentFilter === true,
          contentFilterKeywords: userSettings.contentFilterKeywords || []
        };
        
        console.log('用户搜索配置已加载:', this.config);
      } else {
        // 未登录用户使用默认配置
        this.config = {
          ...this.config,
          enableDetailExtraction: false,
          autoExtractDetails: false,
          saveToHistory: false
        };
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
      this.config.enableDetailExtraction = false;
    }
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

      searchInput.addEventListener('input', debounce((e) => {
        this.handleSearchInput(e.target.value);
      }, 300));

      searchInput.addEventListener('focus', () => {
        this.showSearchSuggestions();
      });

      searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchSuggestions(), 200);
      });
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
        this.hideSearchSuggestions();
      }
    });
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    // 监听认证状态变化
    document.addEventListener('authStateChanged', () => {
      this.loadUserConfig();
      this.loadSearchHistory();
    });

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateFavoriteButtons();
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
      openResult: (url, source) => this.openResult(url, source),
      toggleFavorite: (resultId) => this.toggleFavorite(resultId),
      copyToClipboard: (text) => this.copyToClipboard(text),
      searchFromHistory: (keyword) => this.searchFromHistory(keyword),
      deleteHistoryItem: (historyId) => this.deleteHistoryItem(historyId),
      checkSourceStatus: (sourceId) => this.checkSingleSourceStatus(sourceId),
      extractSingleDetail: (resultId) => this.extractSingleDetail(resultId),
      retryExtraction: (resultId) => this.retryExtraction(resultId),
      toggleDetailDisplay: (resultId) => this.toggleDetailDisplay(resultId),
      refreshConfig: () => this.loadUserConfig()
    };

    // 保持向后兼容
    window.searchManager = window.unifiedSearchManager;
    window.enhancedSearchManager = window.unifiedSearchManager;
  }

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
   * 清理资源
   */
  cleanup() {
    this.currentResults = [];
    this.searchHistory = [];
    this.extractionQueue = [];
    this.extractionProgress.clear();
    this.extractionErrors.clear();
    this.extractionRetries.clear();
    this.extractionCancelledIds.clear();
    
    // 清理DOM元素
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }

    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      progressContainer.remove();
    }

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
  }
}

// 创建全局实例
export const unifiedSearchManager = new UnifiedSearchManager();
export default unifiedSearchManager;

// 向后兼容导出
export const searchManager = unifiedSearchManager;
export const enhancedSearchManager = unifiedSearchManager;