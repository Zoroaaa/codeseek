// src/components/search/DetailExtractionManager.js - 详情提取管理子组件
import { APP_CONSTANTS } from '../../core/constants.js';
import { showToast, showLoading } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import detailAPIService from '../../services/detail-api.js';
import detailCardManager from '../detail-card.js';
import authManager from '../../services/auth.js';
import apiService from '../../services/api.js';

export class DetailExtractionManager {
  constructor() {
    this.extractionInProgress = false;
    this.extractionQueue = [];
	this.config = {}; // 添加配置属性
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageTime: 0
    };
    this.progressCallbacks = new Map();
    this.extractionInsights = [];
  }

  /**
   * 初始化详情提取管理器
   */
  async init() {
    try {
      // 初始化详情卡片管理器
      await detailCardManager.init();
      
      // 检查详情API服务健康状态
      await this.checkDetailServiceHealth();
      
      console.log('详情提取管理器初始化完成');
    } catch (error) {
      console.error('详情提取管理器初始化失败:', error);
    }
  }
  
    /**
   * 更新配置 - 新增方法
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('DetailExtractionManager: 无效的配置对象');
      return;
    }

    // 合并配置
    this.config = { ...this.config, ...config };
    
    console.log('DetailExtractionManager: 配置已更新', this.config);
    
    // 根据配置更新功能状态
    this.handleConfigUpdate();
  }

  /**
   * 处理配置更新 - 新增方法
   */
  handleConfigUpdate() {
    // 检查详情提取是否被启用
    if (this.config.enableDetailExtraction !== undefined) {
      const wasEnabled = this.isExtractionEnabled;
      this.isExtractionEnabled = this.config.enableDetailExtraction;
      
      if (wasEnabled !== this.isExtractionEnabled) {
        console.log(`详情提取功能${this.isExtractionEnabled ? '已启用' : '已禁用'}`);
        
        // 触发状态变更事件
        document.dispatchEvent(new CustomEvent('detailExtractionStateChanged', {
          detail: { enabled: this.isExtractionEnabled }
        }));
      }
    }

    // 更新批处理大小
    if (this.config.extractionBatchSize) {
      this.batchSize = this.config.extractionBatchSize;
    }

    // 更新超时设置
    if (this.config.extractionTimeout) {
      this.timeout = this.config.extractionTimeout;
    }

    // 更新重试设置
    if (this.config.enableRetry !== undefined) {
      this.retryEnabled = this.config.enableRetry;
    }

    // 更新缓存设置
    if (this.config.enableCache !== undefined) {
      this.cacheEnabled = this.config.enableCache;
    }
  }

  /**
   * 获取当前配置 - 新增方法
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 处理配置变更 - 新增方法（别名方法，兼容不同调用方式）
   */
  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * 检查详情提取是否启用 - 新增方法
   */
  get isExtractionEnabled() {
    return this.config.enableDetailExtraction && authManager.isAuthenticated();
  }

  /**
   * 检查详情提取服务健康状态
   */
  async checkDetailServiceHealth() {
    try {
      if (!authManager.isAuthenticated()) {
        console.log('用户未登录，跳过详情服务健康检查');
        return;
      }
      
      const healthCheck = await detailAPIService.checkServiceHealth();
      
      if (healthCheck.healthy) {
        console.log(`详情提取服务健康检查通过 (响应时间: ${healthCheck.responseTime}ms)`);
        this.updateServiceStatus(true, healthCheck);
      } else {
        console.warn('详情提取服务健康检查失败:', healthCheck.error);
        this.updateServiceStatus(false, healthCheck);
      }
    } catch (error) {
      console.warn('详情服务健康检查异常:', error);
      this.updateServiceStatus(false, { error: error.message });
    }
  }

  /**
   * 更新服务状态指示器
   */
  updateServiceStatus(isHealthy, healthData) {
    const statusIndicator = document.getElementById('detailServiceStatus');
    if (statusIndicator) {
      statusIndicator.className = `service-status ${isHealthy ? 'healthy' : 'unhealthy'}`;
      statusIndicator.innerHTML = `
        <span class="status-icon">${isHealthy ? '✅' : '⚠️'}</span>
        <span class="status-text">详情提取: ${isHealthy ? '正常' : '异常'}</span>
        ${healthData.responseTime ? `<small>${healthData.responseTime}ms</small>` : ''}
      `;
      statusIndicator.title = isHealthy ? 
        `详情提取服务运行正常\n响应时间: ${healthData.responseTime}ms\n缓存命中率: ${healthData.localCache?.hitRate || 0}%` :
        `详情提取服务异常: ${healthData.error || '未知错误'}`;
    }
  }

  /**
   * 判断是否应该使用详情提取
   */
  shouldUseDetailExtraction(config) {
    return config.enableDetailExtraction && authManager.isAuthenticated();
  }

  /**
   * 判断是否应该提取详情
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    return APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES?.includes(result.source) || false;
  }

  /**
   * 处理详情提取 - 主入口
   */
  async handleDetailExtraction(searchResults, keyword, config) {
    if (this.extractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.extractionInProgress = true;
      
      console.log(`=== 开始详情提取流程 ===`);
      console.log(`搜索结果数量: ${searchResults.length}`);
      console.log(`关键词: ${keyword}`);
      console.log(`配置:`, config);
      
      // 确定要提取详情的结果
      const resultsToExtract = this.selectResultsForExtraction(searchResults, config);
      
      if (resultsToExtract.length === 0) {
        console.log('没有需要提取详情的结果');
        this.showExtractionInsight('no_results', { 
          total: searchResults.length,
          keyword 
        });
        return;
      }

      console.log(`筛选出 ${resultsToExtract.length} 个结果进行详情提取`);

      // 显示提取进度
      if (config.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length);
      }

      // 执行详情提取
      const extractionResult = await this.executeDetailExtraction(resultsToExtract, keyword, config);
      
      // 处理提取结果
      await this.processExtractionResults(extractionResult, resultsToExtract, config);
      
      // 更新统计信息
      this.updateExtractionStats(extractionResult);
      
      // 显示提取洞察
      this.showExtractionInsights(extractionResult, keyword);

    } catch (error) {
      console.error('详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
      this.showExtractionInsight('error', { 
        error: error.message,
        keyword 
      });
    } finally {
      this.extractionInProgress = false;
      this.hideExtractionProgress();
    }
  }

  /**
   * 选择要提取详情的结果
   */
  selectResultsForExtraction(searchResults, config) {
    // 过滤支持详情提取的结果
    const supportedResults = searchResults.filter(result => 
      this.shouldExtractDetail(result)
    );
    
    console.log(`支持详情提取的结果: ${supportedResults.length}/${searchResults.length}`);
    
    if (config.autoExtractDetails) {
      // 自动提取模式：取前N个结果
      const selected = supportedResults.slice(0, config.maxAutoExtractions);
      console.log(`自动提取模式，选择前 ${selected.length} 个结果`);
      return selected;
    } else {
      // 手动模式：返回所有支持的结果，让用户选择
      console.log(`手动提取模式，返回所有 ${supportedResults.length} 个支持的结果`);
      return supportedResults;
    }
  }

  /**
   * 执行详情提取
   */
  async executeDetailExtraction(results, keyword, config) {
    const startTime = Date.now();
    
    try {
      // 生成批次ID用于进度跟踪
      const batchId = this.generateBatchId();
      
      console.log(`=== 开始详情提取流程 ===`);
      console.log(`搜索结果数量: ${results.length}`);
      console.log(`关键词: ${keyword}`);
      console.log(`批次ID: ${batchId}`);
      
      // 构建ID映射表，确保结果能正确对应
      const resultIdMap = new Map();
      const resultUrlMap = new Map();
      results.forEach(result => {
        if (result.id) {
          resultIdMap.set(result.url, result.id);
          resultUrlMap.set(result.id, result);
          console.log(`ID映射: ${result.id} -> ${result.url} (${result.title})`);
        }
      });

      console.log(`构建了 ${resultIdMap.size} 个ID映射`);
      
      // 设置进度回调
      const progressCallback = (progress) => {
        if (config.showExtractionProgress) {
          this.updateExtractionProgress(progress.current, progress.total, progress.item);
        }
        
        // 记录详细进度信息
        console.log(`详情提取进度 [${progress.current}/${progress.total}]: ${progress.item} - ${progress.status}`);
        
        if (progress.error) {
          console.warn(`提取错误 [${progress.item}]:`, progress.error);
        }
      };

      // 使用detailAPIService执行批量详情提取
      const extractionResult = await detailAPIService.extractBatchDetails(results, {
        enableCache: config.enableCache,
        timeout: config.extractionTimeout,
        enableRetry: config.enableRetry,
        maxRetries: config.maxRetryAttempts,
        maxConcurrency: config.extractionBatchSize,
        progressInterval: 1000,
        stopOnError: false,
        strictValidation: config.strictValidation,
        batchId,
        onProgress: progressCallback
      });

      // 关键修复：处理返回结果，确保ID正确映射
      if (extractionResult.results) {
        console.log(`=== 修复返回结果的ID映射 ===`);
        
        extractionResult.results.forEach((result, index) => {
          // 确保每个结果都有正确的ID
          let finalId = result.id;
          
          // 如果后端返回的结果没有id，通过多种方式找回原始id
          if (!finalId) {
            // 方法1：通过searchUrl或originalUrl找回ID
            if (result.searchUrl) {
              finalId = resultIdMap.get(result.searchUrl);
            }
            
            if (!finalId && result.originalUrl) {
              finalId = resultIdMap.get(result.originalUrl);
            }
            
            // 方法2：通过url字段找回ID
            if (!finalId && result.url) {
              finalId = resultIdMap.get(result.url);
            }
            
            // 方法3：通过索引对应原始结果
            if (!finalId && index < results.length) {
              finalId = results[index].id;
            }
            
            // 方法4：生成临时ID
            if (!finalId) {
              finalId = `temp_${Date.now()}_${index}`;
              console.warn(`无法找回原始ID，生成临时ID: ${finalId}`);
            }
            
            result.id = finalId;
          }
          
          // 确保原始搜索结果信息被保留
          const originalResult = resultUrlMap.get(finalId) || results.find(r => r.id === finalId);
          if (originalResult) {
            result.originalId = originalResult.id;
            result.originalTitle = originalResult.title || result.title;
            result.originalSource = originalResult.source;
            result.originalUrl = originalResult.url;
            
            // 如果标题为空，使用原始标题
            if (!result.title || result.title === '未知标题') {
              result.title = originalResult.title || result.title;
            }
          }
          
          console.log(`结果ID映射完成: ${finalId} -> ${result.title} (${result.extractionStatus})`);
        });
      }

      const totalTime = Date.now() - startTime;
      
      console.log(`=== 批量详情提取完成 ===`);
      console.log(`总用时: ${totalTime}ms`);
      console.log(`处理结果: ${extractionResult.results?.length || 0} 个`);
      console.log(`统计信息:`, extractionResult.stats);
      
      return {
        ...extractionResult,
        totalTime,
        keyword,
        batchId
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('批量详情提取失败:', error);
      
      // 构建错误响应，确保每个结果都有正确的ID
      const errorResults = results.map(result => ({
        ...result, // 保留原始结果的所有字段，包括ID
        extractionStatus: 'error',
        extractionError: error.message,
        extractionTime: 0,
        extractedAt: Date.now()
      }));
      
      return {
        results: errorResults,
        stats: {
          total: results.length,
          successful: 0,
          failed: results.length,
          cached: 0,
          totalTime,
          averageTime: 0,
          successRate: 0,
          cacheHitRate: 0
        },
        summary: {
          processed: results.length,
          successful: 0,
          failed: results.length,
          message: `批量详情提取失败: ${error.message}`
        },
        totalTime,
        keyword,
        error: error.message
      };
    }
  }

  /**
   * 处理提取结果
   */
  async processExtractionResults(extractionResult, originalResults, config) {
    const { results, stats } = extractionResult;
    
    console.log(`=== 处理详情提取结果 ===`);
    console.log(`结果数量: ${results?.length || 0}`);
    console.log(`成功: ${stats?.successful || 0}`);
    console.log(`失败: ${stats?.failed || 0}`);
    console.log(`缓存命中: ${stats?.cached || 0}`);
    
    if (!results || results.length === 0) {
      console.warn('没有详情提取结果需要处理');
      return;
    }

    // 逐个处理提取结果
    for (const result of results) {
      try {
        await this.handleSingleExtractionResult(result, config);
      } catch (error) {
        console.error(`处理单个提取结果失败 [${result.id}]:`, error);
      }
    }

    // 显示批量处理完成提示
    const successCount = stats?.successful || 0;
    const cachedCount = stats?.cached || 0;
    const totalProcessed = successCount + cachedCount;
    
    if (totalProcessed > 0) {
      showToast(
        `详情提取完成: ${totalProcessed} 个成功 (${successCount} 新提取, ${cachedCount} 缓存)`,
        'success',
        5000
      );
    } else {
      showToast('详情提取完成，但没有成功获取到详细信息', 'warning');
    }

    // 触发提取完成事件
    document.dispatchEvent(new CustomEvent('detailExtractionCompleted', {
      detail: { 
        results, 
        stats, 
        keyword: extractionResult.keyword 
      }
    }));
  }

  /**
   * 处理单个提取结果
   */
  async handleSingleExtractionResult(result, config) {
    try {
      console.log(`=== 处理单个提取结果 ===`);
      console.log(`结果ID: ${result.id}`);
      console.log(`标题: ${result.title}`);
      console.log(`源类型: ${result.sourceType}`);
      console.log(`提取状态: ${result.extractionStatus}`);
      
      // 尝试多种方式找到对应的DOM容器
      let resultContainer = null;
      
      // 方式1：使用data-result-id属性
      if (result.id) {
        resultContainer = document.querySelector(`[data-result-id="${result.id}"]`);
        if (resultContainer) {
          console.log(`通过data-result-id找到容器: ${result.id}`);
        }
      }
      
      // 方式2：使用data-id属性（备选）
      if (!resultContainer && result.id) {
        resultContainer = document.querySelector(`[data-id="${result.id}"]`);
        if (resultContainer) {
          console.log(`通过data-id找到容器: ${result.id}`);
        }
      }
      
      // 方式3：使用originalId（如果存在）
      if (!resultContainer && result.originalId) {
        resultContainer = document.querySelector(`[data-result-id="${result.originalId}"]`) ||
                         document.querySelector(`[data-id="${result.originalId}"]`);
        if (resultContainer) {
          console.log(`通过originalId找到容器: ${result.originalId}`);
        }
      }
      
      if (!resultContainer) {
        console.error('完全找不到结果容器，详细信息:', {
          searchId: result.id,
          originalId: result.originalId,
          title: result.title,
          url: result.originalUrl || result.searchUrl,
          extractionStatus: result.extractionStatus
        });
        return;
      }

      // 处理提取结果
      if (result.extractionStatus === 'success' || result.extractionStatus === 'cached') {
        await this.processSuccessfulExtraction(resultContainer, result, config);
      } else {
        await this.processFailedExtraction(resultContainer, result);
      }

    } catch (error) {
      console.error('处理提取结果失败:', error, {
        resultId: result.id,
        title: result.title,
        extractionStatus: result.extractionStatus
      });
    }
  }

  /**
   * 处理成功的提取结果
   */
  async processSuccessfulExtraction(resultContainer, result, config) {
    try {
      // 创建详情卡片
      const detailCardHTML = detailCardManager.createDetailCardHTML(result, result, {
        compactMode: config.compactMode,
        showScreenshots: config.showScreenshots,
        showDownloadLinks: config.showDownloadLinks,
        showMagnetLinks: config.showMagnetLinks,
        showActressInfo: config.showActressInfo,
        enableImagePreview: config.enableImagePreview,
        enableContentFilter: config.enableContentFilter,
        contentFilterKeywords: config.contentFilterKeywords
      });

      // 插入详情卡片
      const detailContainer = this.getOrCreateDetailContainer(resultContainer);
      detailContainer.innerHTML = detailCardHTML;
      detailContainer.style.display = 'block';

      // 添加展开/收起功能
      this.addDetailToggleButton(resultContainer);
      
      // 添加详情卡片事件绑定
      this.bindDetailCardEvents(detailContainer, result);

      console.log(`详情卡片创建成功: ${result.title} (${result.extractionStatus})`);
      
    } catch (error) {
      console.error('处理成功提取结果失败:', error);
      await this.processFailedExtraction(resultContainer, result);
    }
  }

  /**
   * 处理失败的提取结果
   */
  async processFailedExtraction(resultContainer, result) {
    // 显示提取失败状态
    this.showExtractionError(resultContainer, result.extractionError, result);
  }

  /**
   * 提取单个详情
   */
  async extractSingleDetail(resultId, currentResults, config) {
    const result = currentResults.find(r => r.id === resultId);
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
        enableCache: config.enableCache,
        timeout: config.extractionTimeout,
        enableRetry: config.enableRetry,
        maxRetries: config.maxRetryAttempts,
        strictValidation: config.strictValidation
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      }, config);

      // 更新统计
      this.updateExtractionStats({
        stats: {
          total: 1,
          successful: extractedDetail.extractionStatus === 'success' ? 1 : 0,
          failed: extractedDetail.extractionStatus === 'error' ? 1 : 0,
          cached: extractedDetail.extractionStatus === 'cached' ? 1 : 0,
          averageTime: extractedDetail.extractionTime || 0
        }
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
   * 重试详情提取
   */
  async retryExtraction(resultId, currentResults, config) {
    const result = currentResults.find(r => r.id === resultId);
    if (!result) {
      showToast('未找到对应的搜索结果', 'error');
      return;
    }

    try {
      showToast('正在重试详情提取...', 'info');
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, {
        enableCache: false,
        useLocalCache: false,
        enableRetry: true,
        maxRetries: config.maxRetryAttempts,
        timeout: config.extractionTimeout
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      }, config);

      showToast('详情提取成功', 'success');

    } catch (error) {
      console.error('重试详情提取失败:', error);
      showToast('重试失败: ' + error.message, 'error');
    }
  }

  // ===================== 辅助方法 =====================

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
      <span class="btn-icon">📋</span>
      <span class="btn-text">查看详情</span>
    `;
    
    toggleButton.addEventListener('click', () => {
      const resultId = resultContainer.dataset.resultId || resultContainer.dataset.id;
      this.toggleDetailDisplay(resultId);
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
   * 绑定详情卡片事件
   */
  bindDetailCardEvents(detailContainer, result) {
    // 下载链接点击事件
    const downloadLinks = detailContainer.querySelectorAll('.download-link');
    downloadLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        this.handleDownloadLinkClick(e, result);
      });
    });

    // 磁力链接点击事件
    const magnetLinks = detailContainer.querySelectorAll('.magnet-link');
    magnetLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        this.handleMagnetLinkClick(e, result);
      });
    });

    // 图片预览事件
    const images = detailContainer.querySelectorAll('.preview-image');
    images.forEach(img => {
      img.addEventListener('click', (e) => {
        this.handleImagePreview(e, result);
      });
    });

    // 演员信息点击事件
    const actresses = detailContainer.querySelectorAll('.actress-link');
    actresses.forEach(actress => {
      actress.addEventListener('click', (e) => {
        this.handleActressClick(e, result);
      });
    });
  }

  /**
   * 处理下载链接点击
   */
  handleDownloadLinkClick(event, result) {
    const link = event.currentTarget;
    const url = link.dataset.url;
    const name = link.dataset.name || '下载链接';
    
    if (url) {
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('download_click', { 
          url, 
          name, 
          sourceResult: result.url,
          extractionId: result.id 
        }).catch(console.error);
      }
      
      // 复制链接到剪贴板
      this.copyToClipboard(url).then(() => {
        showToast(`下载链接已复制: ${name}`, 'success');
      });
    }
  }

  /**
   * 处理磁力链接点击
   */
  handleMagnetLinkClick(event, result) {
    const link = event.currentTarget;
    const magnet = link.dataset.magnet;
    const name = link.dataset.name || '磁力链接';
    
    if (magnet) {
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('magnet_click', { 
          magnet: magnet.substring(0, 50), // 只记录前50个字符
          name, 
          sourceResult: result.url,
          extractionId: result.id 
        }).catch(console.error);
      }
      
      // 复制磁力链接到剪贴板
      this.copyToClipboard(magnet).then(() => {
        showToast(`磁力链接已复制: ${name}`, 'success');
      });
    }
  }

  /**
   * 处理图片预览
   */
  handleImagePreview(event, result) {
    const img = event.currentTarget;
    const src = img.src || img.dataset.src;
    
    if (src) {
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('image_preview', { 
          imageUrl: src,
          sourceResult: result.url,
          extractionId: result.id 
        }).catch(console.error);
      }
      
      // 显示图片预览
      this.showImagePreview(src, result);
    }
  }

  /**
   * 处理演员点击
   */
  handleActressClick(event, result) {
    const actress = event.currentTarget;
    const name = actress.dataset.name;
    const profileUrl = actress.dataset.profileUrl;
    
    if (name) {
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('actress_click', { 
          actressName: name,
          profileUrl,
          sourceResult: result.url,
          extractionId: result.id 
        }).catch(console.error);
      }
      
      // 触发演员搜索事件
      document.dispatchEvent(new CustomEvent('actressSearchRequested', {
        detail: { name, profileUrl }
      }));
    }
  }

  /**
   * 显示图片预览
   */
  showImagePreview(src, result) {
    // 创建图片预览模态框
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.innerHTML = `
      <div class="image-preview-backdrop" onclick="this.parentElement.remove()">
        <div class="image-preview-container">
          <img src="${escapeHtml(src)}" alt="预览图片" class="preview-image-large">
          <button class="close-preview" onclick="this.closest('.image-preview-modal').remove()">×</button>
          <div class="image-info">
            <small>来源: ${escapeHtml(result.title || result.url)}</small>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加键盘事件
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        throw new Error('复制失败');
      }
      document.body.removeChild(textArea);
    }
  }

  /**
   * 显示提取错误
   */
  showExtractionError(resultContainer, error, result) {
    const detailContainer = this.getOrCreateDetailContainer(resultContainer);

    // 生成错误建议
    const suggestions = this.generateErrorSuggestions(error, result);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">⚠</div>
        <div class="error-content">
          <div class="error-message">
            <strong>详情提取失败</strong>
            <small>${escapeHtml(error || '未知错误')}</small>
          </div>
          ${suggestions.length > 0 ? `
            <div class="error-suggestions">
              <strong>建议:</strong>
              <ul>
                ${suggestions.map(suggestion => `<li>${escapeHtml(suggestion)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
        <div class="error-actions">
          <button class="retry-btn" onclick="window.detailExtractionManager?.retryExtraction('${result.id}')">
            重试
          </button>
        </div>
      </div>
    `;
    
    detailContainer.style.display = 'block';
    this.addDetailToggleButton(resultContainer);
  }

  /**
   * 生成错误建议
   */
  generateErrorSuggestions(error, result) {
    const suggestions = [];
    const errorLower = (error || '').toLowerCase();
    
    if (errorLower.includes('timeout') || errorLower.includes('超时')) {
      suggestions.push('网络连接较慢，建议稍后重试');
      suggestions.push('可以在设置中增加提取超时时间');
    } else if (errorLower.includes('network') || errorLower.includes('网络')) {
      suggestions.push('检查网络连接状态');
      suggestions.push('目标网站可能暂时无法访问');
    } else if (errorLower.includes('parse') || errorLower.includes('解析')) {
      suggestions.push('目标页面结构可能已变更');
      suggestions.push('尝试直接访问页面查看内容');
    } else if (errorLower.includes('validation') || errorLower.includes('验证')) {
      suggestions.push('URL格式可能有问题');
      suggestions.push('确保搜索结果来源有效');
    } else {
      suggestions.push('请稍后重试');
      suggestions.push('如问题持续存在，请联系支持');
    }
    
    return suggestions;
  }

  // ===================== 进度管理 =====================

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
        <button class="progress-close" onclick="this.closest('.extraction-progress-container').style.display='none'">×</button>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: 0%"></div>
      </div>
      <div class="progress-message">正在处理搜索结果...</div>
      <div class="progress-details">
        <small>平均用时: <span class="avg-time">计算中...</span> | 成功率: <span class="success-rate">计算中...</span></small>
      </div>
    `;

    progressContainer.style.display = 'block';
  }

  /**
   * 更新提取进度
   */
  updateExtractionProgress(processed, total, currentItem) {
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
        progressMessage.textContent = `正在处理: ${currentItem || '搜索结果'}`;
      }
    }

    // 更新详细信息
    this.updateProgressDetails(processed, total);
  }

  /**
   * 更新进度详细信息
   */
  updateProgressDetails(processed, total) {
    const progressContainer = document.getElementById('extraction-progress');
    if (!progressContainer || this.extractionStats.totalExtractions === 0) return;

    const avgTimeElement = progressContainer.querySelector('.avg-time');
    const successRateElement = progressContainer.querySelector('.success-rate');

    if (avgTimeElement && this.extractionStats.averageTime > 0) {
      avgTimeElement.textContent = `${Math.round(this.extractionStats.averageTime)}ms`;
    }

    if (successRateElement && this.extractionStats.totalExtractions > 0) {
      const rate = (this.extractionStats.successfulExtractions / this.extractionStats.totalExtractions * 100).toFixed(1);
      successRateElement.textContent = `${rate}%`;
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
      }, 3000);
    }
  }

  // ===================== 统计和洞察 =====================

  /**
   * 更新提取统计信息
   */
  updateExtractionStats(extractionResult) {
    const { stats } = extractionResult;
    
    if (stats) {
      this.extractionStats.totalExtractions += stats.total || 0;
      this.extractionStats.successfulExtractions += stats.successful || 0;
      this.extractionStats.failedExtractions += stats.failed || 0;
      this.extractionStats.cacheHits += stats.cached || 0;
      
      // 更新平均时间
      if (stats.averageTime) {
        this.extractionStats.averageTime = 
          (this.extractionStats.averageTime + stats.averageTime) / 2;
      }
    }
  }

  /**
   * 显示提取洞察
   */
  showExtractionInsights(extractionResult, keyword) {
    const { stats, results } = extractionResult;
    
    const insights = [];
    
    // 性能洞察
    if (stats && stats.averageTime) {
      if (stats.averageTime < 5000) {
        insights.push({
          type: 'performance',
          icon: '⚡',
          message: `详情提取速度良好 (平均 ${Math.round(stats.averageTime)}ms)`,
          level: 'success'
        });
      } else if (stats.averageTime > 15000) {
        insights.push({
          type: 'performance',
          icon: '⏰',
          message: `详情提取较慢，建议检查网络或降低批次大小`,
          level: 'warning'
        });
      }
    }
    
    // 缓存洞察
    if (stats && stats.cacheHitRate > 50) {
      insights.push({
        type: 'cache',
        icon: '💾',
        message: `缓存命中率 ${stats.cacheHitRate.toFixed(1)}%，显著提升了提取速度`,
        level: 'info'
      });
    }
    
    // 内容洞察
    if (results && results.length > 0) {
      const withScreenshots = results.filter(r => r.screenshots && r.screenshots.length > 0).length;
      const withDownloads = results.filter(r => r.downloadLinks && r.downloadLinks.length > 0).length;
      
      if (withScreenshots > 0) {
        insights.push({
          type: 'content',
          icon: '🖼️',
          message: `${withScreenshots} 个结果包含截图预览`,
          level: 'info'
        });
      }
      
      if (withDownloads > 0) {
        insights.push({
          type: 'content',
          icon: '⬇️',
          message: `${withDownloads} 个结果包含下载链接`,
          level: 'info'
        });
      }
    }
    
    // 显示洞察
    this.displayInsights(insights);
  }

  /**
   * 显示单个提取洞察
   */
  showExtractionInsight(type, data) {
    const insights = [];
    
    switch (type) {
      case 'no_results':
        insights.push({
          type: 'info',
          icon: 'ℹ️',
          message: `搜索到 ${data.total} 个结果，但没有支持详情提取的源`,
          level: 'info'
        });
        break;
        
      case 'error':
        insights.push({
          type: 'error',
          icon: '❌',
          message: `详情提取失败: ${data.error}`,
          level: 'error'
        });
        break;
        
      case 'partial':
        insights.push({
          type: 'warning',
          icon: '⚠️',
          message: `部分详情提取失败，已获取 ${data.successful}/${data.total} 个结果`,
          level: 'warning'
        });
        break;
    }
    
    this.displayInsights(insights);
  }

  /**
   * 显示洞察信息
   */
  displayInsights(insights) {
    if (insights.length === 0) return;
    
    const insightsContainer = document.getElementById('extractionInsights');
    if (!insightsContainer) return;
    
    insightsContainer.innerHTML = insights.map(insight => `
      <div class="insight-item insight-${insight.level}">
        <span class="insight-icon">${insight.icon}</span>
        <span class="insight-message">${escapeHtml(insight.message)}</span>
      </div>
    `).join('');
    
    insightsContainer.style.display = 'block';
    
    // 自动隐藏信息类洞察
    if (insights.every(i => i.level === 'info')) {
      setTimeout(() => {
        insightsContainer.style.display = 'none';
      }, 8000);
    }
  }

  // ===================== 工具方法 =====================

  /**
   * 生成批次ID
   */
  generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 获取提取统计
   */
  getExtractionStats() {
    return { ...this.extractionStats };
  }

  /**
   * 重置提取统计
   */
  resetExtractionStats() {
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageTime: 0
    };
  }

  /**
   * 获取提取能力信息
   */
  getExtractionCapabilities(config) {
    return {
      enabled: config.enableDetailExtraction,
      authenticated: authManager.isAuthenticated(),
      supportedSources: APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [],
      maxAutoExtractions: config.maxAutoExtractions,
      batchSize: config.extractionBatchSize,
      timeout: config.extractionTimeout,
      caching: config.enableCache,
      retry: config.enableRetry,
      currentQueue: this.extractionQueue.length,
      inProgress: this.extractionInProgress
    };
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.extractionQueue = [];
    this.progressCallbacks.clear();
    this.extractionInsights = [];
    this.extractionInProgress = false;
    
    // 清理DOM元素
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      progressContainer.remove();
    }

    const insightsContainer = document.getElementById('extractionInsights');
    if (insightsContainer) {
      insightsContainer.remove();
    }
    
    console.log('详情提取管理器资源已清理');
  }
}

export default DetailExtractionManager;