// src/components/enhanced-search.js - 集成详情提取功能的增强搜索组件（重构版）
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import searchService from '../services/search.js';
import detailAPIService from '../services/detail-api.js';
import detailCardManager from './detail-card.js';
import authManager from '../services/auth.js';
import apiService from '../services/api.js';
import { APP_CONSTANTS } from '../core/constants.js';

export class EnhancedSearchManager {
  constructor() {
    this.currentResults = [];
    this.extractionInProgress = false;
    this.extractionQueue = [];
    this.config = {
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      showExtractionProgress: true,
      enableCache: true
    };
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
  }

  async init() {
    try {
      // 初始化详情卡片管理器
      await detailCardManager.init();
      
      // 加载用户配置
      await this.loadUserConfig();
      
      // 绑定事件
      this.bindEvents();
      
      console.log('增强搜索管理器初始化完成');
    } catch (error) {
      console.error('增强搜索管理器初始化失败:', error);
    }
  }

  /**
   * 执行增强搜索 - 支持自动详情提取
   * @param {string} keyword - 搜索关键词
   * @param {Object} options - 搜索选项
   */
  async performEnhancedSearch(keyword, options = {}) {
    const validation = validateSearchKeyword(keyword);
    if (!validation.valid) {
      throw new Error(validation.errors[0]);
    }

    try {
      showLoading(true);
      
      // 隐藏提示区域
      this.hideQuickTips();

      // 显示搜索状态检查进度（如果启用）
      await this.showSearchStatusIfEnabled(keyword);

      // 执行基础搜索
      const searchResults = await searchService.performSearch(keyword, options);
      
      if (!searchResults || searchResults.length === 0) {
        showToast('未找到搜索结果', 'warning');
        this.displaySearchResults(keyword, []);
        return;
      }

      // 显示基础搜索结果
      this.displaySearchResults(keyword, searchResults);
      
      // 检查是否启用详情提取
      if (this.isDetailExtractionEnabled() && authManager.isAuthenticated()) {
        await this.handleDetailExtraction(searchResults, options);
      } else if (!authManager.isAuthenticated()) {
        showToast('登录后可使用详情提取功能', 'info', 3000);
      }

    } catch (error) {
      console.error('增强搜索失败:', error);
      showToast('搜索失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
      this.extractionInProgress = false;
    }
  }

  /**
   * 检查是否启用详情提取
   * @returns {boolean} 是否启用
   */
  isDetailExtractionEnabled() {
    return this.config.enableDetailExtraction && 
           authManager.isAuthenticated();
  }

  /**
   * 显示搜索状态检查进度
   * @param {string} keyword - 搜索关键词
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
   * @param {Array} searchResults - 搜索结果
   * @param {Object} options - 选项
   */
  async handleDetailExtraction(searchResults, options = {}) {
    if (this.extractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.extractionInProgress = true;
      
      // 确定要提取详情的结果
      const resultsToExtract = this.config.autoExtractDetails ? 
        searchResults.slice(0, this.config.maxAutoExtractions) :
        searchResults.filter(result => this.shouldExtractDetail(result));

      if (resultsToExtract.length === 0) {
        console.log('没有需要提取详情的结果');
        return;
      }

      // 显示提取进度
      if (this.config.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length);
      }

      // 分批提取详情
      await this.extractDetailsInBatches(resultsToExtract, options);

    } catch (error) {
      console.error('详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      this.extractionInProgress = false;
      this.hideExtractionProgress();
    }
  }

  /**
   * 分批提取详情
   * @param {Array} results - 搜索结果数组
   * @param {Object} options - 提取选项
   */
  async extractDetailsInBatches(results, options = {}) {
    const batchSize = this.config.extractionBatchSize;
    let processedCount = 0;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      try {
        // 批量提取详情
        const extractionResult = await detailAPIService.extractBatchDetails(batch, {
          enableCache: this.config.enableCache,
          timeout: options.timeout || 15000
        });

        // 处理提取结果
        for (const result of extractionResult.results) {
          await this.handleSingleExtractionResult(result);
          processedCount++;
          
          // 更新进度
          if (this.config.showExtractionProgress) {
            this.updateExtractionProgress(processedCount, results.length);
          }
        }

        // 批次间延迟
        if (i + batchSize < results.length) {
          await this.delay(500);
        }

      } catch (error) {
        console.error(`批次 ${i / batchSize + 1} 详情提取失败:`, error);
        
        // 处理失败的批次中的每个结果
        batch.forEach(() => {
          processedCount++;
          if (this.config.showExtractionProgress) {
            this.updateExtractionProgress(processedCount, results.length);
          }
        });
      }
    }

    console.log(`详情提取完成: ${processedCount}/${results.length}`);
  }

  /**
   * 处理单个提取结果
   * @param {Object} result - 提取结果
   */
  async handleSingleExtractionResult(result) {
    try {
      const resultContainer = document.querySelector(`[data-result-id="${result.id}"]`);
      if (!resultContainer) {
        console.warn('未找到对应的结果容器:', result.id);
        return;
      }

      if (result.extractionStatus === 'success') {
        // 创建详情卡片
        const detailCardHTML = detailCardManager.createDetailCardHTML(result, result, {
          compactMode: this.config.compactMode,
          showScreenshots: this.config.showScreenshots,
          showDownloadLinks: this.config.showDownloadLinks,
          showMagnetLinks: this.config.showMagnetLinks,
          showActressInfo: this.config.showActressInfo,
          enableImagePreview: this.config.enableImagePreview
        });

        // 插入详情卡片
        const detailContainer = this.getOrCreateDetailContainer(resultContainer);
        detailContainer.innerHTML = detailCardHTML;
        detailContainer.style.display = 'block';

        // 添加展开/收起功能
        this.addDetailToggleButton(resultContainer);

      } else if (result.extractionStatus === 'cached') {
        // 处理缓存结果
        await this.handleSingleExtractionResult({
          ...result,
          extractionStatus: 'success'
        });
      } else {
        // 显示提取失败状态
        this.showExtractionError(resultContainer, result.extractionError);
      }

    } catch (error) {
      console.error('处理提取结果失败:', error);
    }
  }

  /**
   * 获取或创建详情容器
   * @param {Element} resultContainer - 结果容器
   * @returns {Element} 详情容器
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
   * @param {Element} resultContainer - 结果容器
   */
  addDetailToggleButton(resultContainer) {
    const actionsContainer = resultContainer.querySelector('.result-actions');
    if (!actionsContainer) return;

    // 检查是否已存在按钮
    if (actionsContainer.querySelector('.detail-toggle-btn')) return;

    const toggleButton = document.createElement('button');
    toggleButton.className = 'action-btn detail-toggle-btn';
    toggleButton.innerHTML = `
      <span class="btn-icon">📋</span>
      <span class="btn-text">查看详情</span>
    `;
    
    toggleButton.addEventListener('click', () => {
      this.toggleDetailDisplay(resultContainer.dataset.resultId || resultContainer.dataset.id);
    });

    actionsContainer.appendChild(toggleButton);
  }

  /**
   * 切换详情显示状态
   * @param {string} resultId - 结果ID
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
      btnIcon.textContent = isVisible ? '📋' : '📄';
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
   * @param {Element} resultContainer - 结果容器
   * @param {string} error - 错误信息
   */
  showExtractionError(resultContainer, error) {
    const detailContainer = this.getOrCreateDetailContainer(resultContainer);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">❌</div>
        <div class="error-message">
          <strong>详情提取失败</strong>
          <small>${escapeHtml(error || '未知错误')}</small>
        </div>
        <button class="retry-btn" onclick="window.enhancedSearchManager.retryExtraction('${resultContainer.dataset.resultId}')">
          重试
        </button>
      </div>
    `;
    
    detailContainer.style.display = 'block';
  }

  /**
   * 重试单个结果的详情提取
   * @param {string} resultId - 结果ID
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
   * @param {number} total - 总数
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
   * @param {number} processed - 已处理数量
   * @param {number} total - 总数
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

  /**
   * 判断是否应该提取详情
   * @param {Object} result - 搜索结果
   * @returns {boolean} 是否应该提取
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    
    // 检查搜索源是否支持详情提取
    return APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source) || false;
  }

  /**
   * 显示搜索结果
   * @param {string} keyword - 搜索关键词
   * @param {Array} results - 搜索结果
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
      if (this.isDetailExtractionEnabled()) {
        const supportedCount = results.filter(r => this.shouldExtractDetail(r)).length;
        detailExtractionInfo = ` | 支持详情提取: ${supportedCount}`;
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
    
    // 滚动到结果区域
    setTimeout(() => {
      resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  /**
   * 计算状态统计
   * @param {Array} results - 搜索结果
   * @returns {Object} 状态统计
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
   * 创建搜索结果HTML
   * @param {Object} result - 搜索结果
   * @returns {string} HTML字符串
   */
  createResultHTML(result) {
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    
    // 状态指示器
    let statusIndicator = '';
    if (result.status) {
      const statusClass = this.getStatusClass(result.status);
      const statusText = this.getStatusText(result.status);
      
      let statusDetails = [];
      if (result.responseTime > 0) {
        statusDetails.push(`响应: ${result.responseTime}ms`);
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
        <div class="result-status ${statusClass}" title="${statusText}${detailsText}">
          <span class="status-icon">${this.getStatusIcon(result.status)}</span>
          <span class="status-text">${statusText}</span>
          ${result.contentMatch ? '<span class="content-match-badge">✓</span>' : ''}
          ${result.fromCache ? '<span class="cache-badge">💾</span>' : ''}
        </div>
        ${unavailableReasonHTML}
      `;
    }
    
    // 访问按钮
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
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable && this.isDetailExtractionEnabled() ? `
      <button class="action-btn detail-btn" data-action="extractDetail" data-result-id="${result.id}" title="提取详情信息">
        <span class="btn-icon">📋</span>
        <span class="btn-text">详情</span>
      </button>
    ` : '';
    
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
            ${this.truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${statusIndicator}
          </div>
        </div>
        <div class="result-actions">
          ${visitButtonHTML}
          <button class="action-btn favorite-btn" data-action="favorite" data-result-id="${result.id}">
            <span>收藏</span>
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
   * 绑定结果事件
   * @param {Element} container - 结果容器
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
      }
    });
  }

  /**
   * 提取单个详情
   * @param {string} resultId - 结果ID
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
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, {
        enableCache: this.config.enableCache,
        timeout: 15000
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      });

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('单独详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 打开搜索结果
   * @param {string} url - URL
   * @param {string} source - 搜索源
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
   * @param {string} text - 文本
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('已复制到剪贴板', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('copy_url', { url: text }).catch(console.error);
      }
    } catch (error) {
      // 降级到传统方法
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
   * @param {string} resultId - 结果ID
   */
  async toggleFavorite(resultId) {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
      return;
    }

    // 这里需要实际的收藏管理器实现
    // 暂时只显示提示
    showToast('收藏功能需要收藏管理器支持', 'info');
  }

  /**
   * 检查单个搜索源状态
   * @param {string} sourceId - 搜索源ID
   * @param {string} resultId - 结果ID
   */
  async checkSingleSourceStatus(sourceId, resultId) {
    try {
      showLoading(true);
      showToast(`正在检查 ${sourceId} 状态...`, 'info');

      const statusResult = await searchService.checkSingleSourceStatus(sourceId);

      if (statusResult) {
        // 更新结果状态
        const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
        if (resultIndex !== -1) {
          this.currentResults[resultIndex] = {
            ...this.currentResults[resultIndex],
            ...statusResult
          };
          
          // 重新渲染该结果项
          const resultElement = document.querySelector(`[data-id="${resultId}"]`);
          if (resultElement) {
            resultElement.outerHTML = this.createResultHTML(this.currentResults[resultIndex]);
          }
        }

        const statusEmoji = statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? '✅' : '❌';
        showToast(`${sourceId} ${statusEmoji} ${statusResult.statusText}`, 
          statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? 'success' : 'warning');
      }
    } catch (error) {
      console.error('检查搜索源状态失败:', error);
      showToast('状态检查失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 判断结果是否不可用
   * @param {Object} result - 搜索结果
   * @returns {boolean} 是否不可用
   */
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  /**
   * 获取状态样式类
   * @param {string} status - 状态
   * @returns {string} 样式类
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
   * @param {string} status - 状态
   * @returns {string} 状态文本
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
   * @param {string} status - 状态
   * @returns {string} 状态图标
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
   * 截断URL显示
   * @param {string} url - URL
   * @returns {string} 截断后的URL
   */
  truncateUrl(url) {
    if (!url || url.length <= 50) return url;
    return url.substring(0, 47) + '...';
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      if (authManager.isAuthenticated()) {
        const userSettings = await apiService.getUserSettings();
        
        this.config = {
          enableDetailExtraction: userSettings.enableDetailExtraction !== false,
          autoExtractDetails: userSettings.autoExtractDetails || false,
          maxAutoExtractions: userSettings.maxAutoExtractions || 5,
          extractionBatchSize: Math.min(userSettings.extractionBatchSize || 3, 5),
          showExtractionProgress: userSettings.showExtractionProgress !== false,
          enableCache: userSettings.enableCache !== false,
          showScreenshots: userSettings.showScreenshots !== false,
          showDownloadLinks: userSettings.showDownloadLinks !== false,
          showMagnetLinks: userSettings.showMagnetLinks !== false,
          showActressInfo: userSettings.showActressInfo !== false,
          compactMode: userSettings.compactMode || false,
          enableImagePreview: userSettings.enableImagePreview !== false
        };
        
        console.log('用户详情提取配置已加载:', this.config);
      } else {
        // 未登录用户使用默认配置
        this.config = {
          enableDetailExtraction: false,
          autoExtractDetails: false,
          maxAutoExtractions: 5,
          extractionBatchSize: 3,
          showExtractionProgress: true,
          enableCache: true,
          showScreenshots: true,
          showDownloadLinks: true,
          showMagnetLinks: true,
          showActressInfo: true,
          compactMode: false,
          enableImagePreview: true
        };
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
    }
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 暴露全局方法
    window.enhancedSearchManager = {
      retryExtraction: (resultId) => this.retryExtraction(resultId),
      toggleDetailDisplay: (resultId) => this.toggleDetailDisplay(resultId),
      extractSingleDetail: (resultId) => this.extractSingleDetail(resultId),
      refreshConfig: () => this.loadUserConfig()
    };

    // 监听认证状态变化
    document.addEventListener('authStateChanged', () => {
      this.loadUserConfig();
    });
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
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.currentResults = [];
    this.extractionQueue = [];
    
    // 清理DOM元素
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      progressContainer.remove();
    }

    // 清理全局方法
    if (window.enhancedSearchManager) {
      delete window.enhancedSearchManager;
    }
  }
}

// 创建全局实例
export const enhancedSearchManager = new EnhancedSearchManager();
export default enhancedSearchManager;