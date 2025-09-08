// src/components/enhanced-search.js - 集成详情提取功能的增强搜索组件
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import searchService from '../services/search.js';
import detailAPIService from '../services/detail-api.js';
import detailCardManager from './detail-card.js';
import authManager from '../services/auth.js';

export class EnhancedSearchManager {
  constructor() {
    this.currentResults = [];
    this.detailExtractionEnabled = false;
    this.extractionInProgress = false;
    this.extractionQueue = [];
    this.config = {
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      showExtractionProgress: true
    };
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
    try {
      showLoading(true);
      
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
      if (this.detailExtractionEnabled && authManager.isAuthenticated()) {
        await this.handleDetailExtraction(searchResults, options);
      }

    } catch (error) {
      console.error('增强搜索失败:', error);
      showToast('搜索失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
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
          enableCache: options.enableCache !== false,
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
          compactMode: true,
          showScreenshots: false // 在搜索结果中不显示截图
        });

        // 插入详情卡片
        const detailContainer = resultContainer.querySelector('.result-detail-container');
        if (detailContainer) {
          detailContainer.innerHTML = detailCardHTML;
          detailContainer.style.display = 'block';
        } else {
          // 创建详情容器
          const newDetailContainer = document.createElement('div');
          newDetailContainer.className = 'result-detail-container';
          newDetailContainer.innerHTML = detailCardHTML;
          resultContainer.appendChild(newDetailContainer);
        }

        // 添加展开/收起功能
        this.addDetailToggleButton(resultContainer);

      } else {
        // 显示提取失败状态
        this.showExtractionError(resultContainer, result.extractionError);
      }

    } catch (error) {
      console.error('处理提取结果失败:', error);
    }
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
      this.toggleDetailDisplay(resultContainer);
    });

    actionsContainer.appendChild(toggleButton);
  }

  /**
   * 切换详情显示状态
   * @param {Element} resultContainer - 结果容器
   */
  toggleDetailDisplay(resultContainer) {
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
    const detailContainer = resultContainer.querySelector('.result-detail-container') ||
                           this.createDetailContainer(resultContainer);

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
  }

  /**
   * 创建详情容器
   * @param {Element} resultContainer - 结果容器
   * @returns {Element} 详情容器
   */
  createDetailContainer(resultContainer) {
    const detailContainer = document.createElement('div');
    detailContainer.className = 'result-detail-container';
    detailContainer.style.display = 'none';
    resultContainer.appendChild(detailContainer);
    return detailContainer;
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
    // 可以根据搜索源、URL模式等条件判断
    const supportedSources = ['javbus', 'javdb', 'javlibrary', 'jable', 'missav'];
    return supportedSources.includes(result.source);
  }

  /**
   * 显示搜索结果
   * @param {string} keyword - 搜索关键词
   * @param {Array} results - 搜索结果
   */
  displaySearchResults(keyword, results) {
    this.currentResults = results;
    
    // 调用原有的搜索结果显示逻辑
    // 这里需要根据你现有的代码进行调整
    
    // 为每个结果添加详情容器占位符
    results.forEach(result => {
      // 添加详情容器占位符到结果HTML中
      // 具体实现取决于你现有的结果显示结构
    });
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      if (authManager.isAuthenticated()) {
        const userConfig = await detailAPIService.getConfig();
        
        this.detailExtractionEnabled = userConfig.enableDetailExtraction !== false;
        this.config = {
          ...this.config,
          autoExtractDetails: userConfig.autoExtractDetails || false,
          maxAutoExtractions: userConfig.maxAutoExtractions || 5,
          extractionBatchSize: Math.min(userConfig.extractionBatchSize || 3, 5),
          showExtractionProgress: userConfig.showExtractionProgress !== false
        };
        
        console.log('用户详情提取配置已加载:', this.config);
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
      toggleDetailExtraction: () => this.toggleDetailExtraction(),
      refreshConfig: () => this.loadUserConfig()
    };

    // 监听认证状态变化
    document.addEventListener('authStateChanged', () => {
      this.loadUserConfig();
    });
  }

  /**
   * 切换详情提取功能
   */
  async toggleDetailExtraction() {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录以使用详情提取功能', 'error');
      return;
    }

    try {
      const newState = !this.detailExtractionEnabled;
      
      await detailAPIService.updateConfig({
        enableDetailExtraction: newState
      });
      
      this.detailExtractionEnabled = newState;
      
      showToast(`详情提取功能已${newState ? '启用' : '禁用'}`, 'success');
      
    } catch (error) {
      console.error('切换详情提取功能失败:', error);
      showToast('设置更新失败: ' + error.message, 'error');
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