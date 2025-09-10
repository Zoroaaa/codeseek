// src/components/search.js - 完善的统一搜索组件（集成完善的后端详情提取服务）
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
    
    // 详情提取相关状态 - 与后端服务对齐
    this.extractionInProgress = false;
    this.extractionQueue = [];
    this.extractionStats = {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      cacheHits: 0,
      averageTime: 0
    };
    
    // 配置管理 - 与后端constants.js保持一致
    this.config = {
      // 基础搜索配置
      useCache: true,
      saveToHistory: true,
      
      // 详情提取配置 - 与后端CONFIG.DETAIL_EXTRACTION对齐
      enableDetailExtraction: false,
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      extractionTimeout: 15000,
      enableRetry: true,
      maxRetryAttempts: 2,
      enableCache: true,
      showExtractionProgress: true,
      
      // 显示选项
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      compactMode: false,
      enableImagePreview: true,
      
      // 高级选项
      strictValidation: true,
      enableContentFilter: false,
      contentFilterKeywords: []
    };
    
    // 进度追踪
    this.progressCallbacks = new Map();
    this.extractionInsights = [];
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 初始化详情卡片管理器
      await detailCardManager.init();
      
      // 检查详情API服务健康状态
      await this.checkDetailServiceHealth();
      
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
      
      this.isInitialized = true;
      console.log('统一搜索管理器初始化完成，详情提取服务已就绪');
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
      showToast('搜索功能初始化失败，部分功能可能不可用', 'warning');
    }
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
   * 执行搜索 - 增强版本，完整集成后端详情提取服务
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
      
      // 隐藏提示区域
      this.hideQuickTips();

      // 显示搜索状态检查进度（如果可用）
      await this.showSearchStatusIfEnabled(keyword);

      // 执行基础搜索
      const searchResults = await searchService.performSearch(keyword, {
        useCache: this.config.useCache,
        saveToHistory: this.config.saveToHistory && authManager.isAuthenticated()
      });
      
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
        console.log('开始详情提取流程...');
        await this.handleDetailExtraction(searchResults, keyword);
      } else if (!authManager.isAuthenticated() && this.config.enableDetailExtraction) {
        showToast('登录后可使用详情提取功能', 'info', 3000);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
      this.extractionInProgress = false;
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
   * 处理详情提取 - 完全重写，集成完善的后端服务
   */
  async handleDetailExtraction(searchResults, keyword) {
    if (this.extractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.extractionInProgress = true;
      
      console.log(`=== 开始详情提取流程 ===`);
      console.log(`搜索结果数量: ${searchResults.length}`);
      console.log(`关键词: ${keyword}`);
      console.log(`配置:`, this.config);
      
      // 确定要提取详情的结果
      const resultsToExtract = this.selectResultsForExtraction(searchResults);
      
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
      if (this.config.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length);
      }

      // 执行详情提取
      const extractionResult = await this.executeDetailExtraction(resultsToExtract, keyword);
      
      // 处理提取结果
      await this.processExtractionResults(extractionResult, resultsToExtract);
      
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
  selectResultsForExtraction(searchResults) {
    // 过滤支持详情提取的结果
    const supportedResults = searchResults.filter(result => 
      this.shouldExtractDetail(result)
    );
    
    console.log(`支持详情提取的结果: ${supportedResults.length}/${searchResults.length}`);
    
    if (this.config.autoExtractDetails) {
      // 自动提取模式：取前N个结果
      const selected = supportedResults.slice(0, this.config.maxAutoExtractions);
      console.log(`自动提取模式，选择前 ${selected.length} 个结果`);
      return selected;
    } else {
      // 手动模式：返回所有支持的结果，让用户选择
      console.log(`手动提取模式，返回所有 ${supportedResults.length} 个支持的结果`);
      return supportedResults;
    }
  }

/**
 * 执行详情提取 - 使用完善的detailAPIService
 */
async executeDetailExtraction(results, keyword) {
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
        resultIdMap.set(result.url, result.id); // 以URL为键建立映射
        resultUrlMap.set(result.id, result); // 以ID为键建立反向映射
        console.log(`ID映射: ${result.id} -> ${result.url} (${result.title})`);
      }
    });

    console.log(`构建了 ${resultIdMap.size} 个ID映射`);
    
    // 设置进度回调
    const progressCallback = (progress) => {
      if (this.config.showExtractionProgress) {
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
      enableCache: this.config.enableCache,
      timeout: this.config.extractionTimeout,
      enableRetry: this.config.enableRetry,
      maxRetries: this.config.maxRetryAttempts,
      maxConcurrency: this.config.extractionBatchSize,
      progressInterval: 1000,
      stopOnError: false,
      strictValidation: this.config.strictValidation,
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
  async processExtractionResults(extractionResult, originalResults) {
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
        await this.handleSingleExtractionResult(result);
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
  }

/**
 * 处理单个提取结果
 */
async handleSingleExtractionResult(result) {
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
    
    // 方式4：通过URL匹配（最后的备选方案）
    if (!resultContainer && (result.originalUrl || result.searchUrl)) {
      const searchUrl = result.originalUrl || result.searchUrl;
      const allContainers = document.querySelectorAll('.result-item');
      
      for (const container of allContainers) {
        const titleElement = container.querySelector('.result-title');
        const urlElement = container.querySelector('.result-url');
        const visitButton = container.querySelector('[data-url]');
        
        if (visitButton && visitButton.dataset.url === searchUrl) {
          resultContainer = container;
          console.log(`通过URL匹配找到容器: ${searchUrl}`);
          break;
        }
        
        if (urlElement && urlElement.textContent.includes(searchUrl)) {
          resultContainer = container;
          console.log(`通过URL文本匹配找到容器: ${searchUrl}`);
          break;
        }
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
      
      // 输出当前页面所有可用容器的信息用于调试
      const allContainers = Array.from(document.querySelectorAll('.result-item'));
      console.log('所有可用的结果容器:', allContainers.map(el => ({
        dataId: el.dataset.id,
        resultId: el.dataset.resultId,
        title: el.querySelector('.result-title')?.textContent?.trim(),
        url: el.querySelector('[data-url]')?.dataset.url
      })));
      
      return;
    }

    // 处理提取结果
    if (result.extractionStatus === 'success' || result.extractionStatus === 'cached') {
      await this.processSuccessfulExtraction(resultContainer, result);
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
async processSuccessfulExtraction(resultContainer, result) {
  try {
    // 创建详情卡片
    const detailCardHTML = detailCardManager.createDetailCardHTML(result, result, {
      compactMode: this.config.compactMode,
      showScreenshots: this.config.showScreenshots,
      showDownloadLinks: this.config.showDownloadLinks,
      showMagnetLinks: this.config.showMagnetLinks,
      showActressInfo: this.config.showActressInfo,
      enableImagePreview: this.config.enableImagePreview,
      enableContentFilter: this.config.enableContentFilter,
      contentFilterKeywords: this.config.contentFilterKeywords
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
    if (!this.config.enableImagePreview) return;
    
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
      
      // 显示图片预览（这里可以集成现有的图片预览组件）
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
      
      // 可以集成演员搜索功能
      if (profileUrl) {
        window.open(profileUrl, '_blank', 'noopener,noreferrer');
      } else {
        // 使用演员名称进行新搜索
        this.searchByActress(name);
      }
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
    
    // 更新UI中的统计显示
    this.updateStatsDisplay();
  }

  /**
   * 更新统计显示
   */
  updateStatsDisplay() {
    const statsContainer = document.getElementById('extractionStats');
    if (statsContainer && this.extractionStats.totalExtractions > 0) {
      const successRate = (this.extractionStats.successfulExtractions / this.extractionStats.totalExtractions * 100).toFixed(1);
      const cacheHitRate = (this.extractionStats.cacheHits / this.extractionStats.totalExtractions * 100).toFixed(1);
      
      statsContainer.innerHTML = `
        <div class="stats-summary">
          <span class="stat-item">总提取: ${this.extractionStats.totalExtractions}</span>
          <span class="stat-item">成功率: ${successRate}%</span>
          <span class="stat-item">缓存命中: ${cacheHitRate}%</span>
          <span class="stat-item">平均用时: ${Math.round(this.extractionStats.averageTime)}ms</span>
        </div>
      `;
      statsContainer.style.display = 'block';
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
      
      const extractedDetail = await detailAPIService.extractSingleDetail(result, {
        enableCache: this.config.enableCache,
        timeout: this.config.extractionTimeout,
        enableRetry: this.config.enableRetry,
        maxRetries: this.config.maxRetryAttempts,
        strictValidation: this.config.strictValidation
      });

      await this.handleSingleExtractionResult({
        ...result,
        ...extractedDetail
      });

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
        useLocalCache: false,
        enableRetry: true,
        maxRetries: this.config.maxRetryAttempts,
        timeout: this.config.extractionTimeout
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
      btnIcon.textContent = isVisible ? '📋' : '🔄';
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
  showExtractionError(resultContainer, error, result) {
    const detailContainer = this.getOrCreateDetailContainer(resultContainer);

    // 生成错误建议
    const suggestions = this.generateErrorSuggestions(error, result);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">⌫</div>
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
          <button class="retry-btn" onclick="window.unifiedSearchManager.retryExtraction('${resultContainer.dataset.resultId}')">
            重试
          </button>
          <button class="diagnose-btn" onclick="window.unifiedSearchManager.diagnoseExtraction('${resultContainer.dataset.resultId}')">
            诊断
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

  /**
   * 诊断提取问题
   */
  async diagnoseExtraction(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result) return;
    
    try {
      showToast('正在诊断提取问题...', 'info');
      
      // 检查详情API服务健康状态
      const healthCheck = await detailAPIService.checkServiceHealth();
      
      const diagnostics = [];
      
      // 服务健康检查
      if (healthCheck.healthy) {
        diagnostics.push('✅ 详情提取服务正常运行');
      } else {
        diagnostics.push('❌ 详情提取服务异常: ' + (healthCheck.error || '未知错误'));
      }
      
      // URL可访问性检查
      diagnostics.push('🔍 检查目标URL可访问性...');
      try {
        const response = await fetch(result.url, { method: 'HEAD', mode: 'no-cors' });
        diagnostics.push('✅ 目标URL可以访问');
      } catch {
        diagnostics.push('❌ 目标URL无法访问或被阻止');
      }
      
      // 源支持检查
      if (this.shouldExtractDetail(result)) {
        diagnostics.push('✅ 该源支持详情提取');
      } else {
        diagnostics.push('❌ 该源不支持详情提取');
      }
      
      // 显示诊断结果
      const diagnosticText = diagnostics.join('\n');
      
      // 创建诊断模态框
      this.showDiagnosticModal(diagnosticText, result);
      
    } catch (error) {
      console.error('诊断失败:', error);
      showToast('诊断失败: ' + error.message, 'error');
    }
  }

  /**
   * 显示诊断模态框
   */
  showDiagnosticModal(diagnosticText, result) {
    const modal = document.createElement('div');
    modal.className = 'diagnostic-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>详情提取诊断结果</h3>
            <button class="close-btn" onclick="this.closest('.diagnostic-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="diagnostic-info">
              <strong>目标结果:</strong> ${escapeHtml(result.title)}<br>
              <strong>URL:</strong> <a href="${escapeHtml(result.url)}" target="_blank">${escapeHtml(result.url)}</a><br>
              <strong>源类型:</strong> ${escapeHtml(result.source)}
            </div>
            <div class="diagnostic-results">
              <pre>${escapeHtml(diagnosticText)}</pre>
            </div>
          </div>
          <div class="modal-footer">
            <button onclick="this.closest('.diagnostic-modal').remove()">关闭</button>
            <button onclick="window.unifiedSearchManager.retryExtraction('${result.id}')">重试提取</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
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

  /**
   * 生成批次ID
   */
  generateBatchId() {
    return 'batch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // ===================== 基础搜索功能方法（保持原样） =====================

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
      
      // 详细状态信息
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
      
      // 不可用原因显示
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
            ${truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
            ${statusIndicator}
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
            ${result.status !== APP_CONSTANTS.SOURCE_STATUS.UNKNOWN ? `
              <button class="action-btn details-btn" data-action="viewDetails" data-result-id="${result.id}" title="查看详细状态">
                <span>ℹ️</span>
              </button>
            ` : ''}
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

        const statusEmoji = statusResult.status === APP_CONSTANTS.SOURCE_STATUS.AVAILABLE ? '✅' : '⌫';
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

  /**
   * 刷新所有搜索源状态
   */
  async refreshAllSourcesStatus() {
    if (!this.currentResults || this.currentResults.length === 0) {
      showToast('没有搜索结果需要刷新状态', 'warning');
      return;
    }

    try {
      showLoading(true);
      showToast('正在刷新所有搜索源状态...', 'info');

      const statusSummary = await searchService.checkAllSourcesStatus();
      
      // 更新所有结果的状态
      this.currentResults.forEach(result => {
        const sourceStatus = statusSummary.sources.find(s => s.id === result.source);
        if (sourceStatus) {
          result.status = sourceStatus.status;
          result.statusText = sourceStatus.statusText;
          result.unavailableReason = sourceStatus.unavailableReason;
          result.lastChecked = sourceStatus.lastChecked;
          result.responseTime = sourceStatus.responseTime;
          result.availabilityScore = sourceStatus.availabilityScore;
          result.verified = sourceStatus.verified;
          result.contentMatch = sourceStatus.contentMatch;
          result.fromCache = sourceStatus.fromCache;
        }
      });

      // 重新渲染结果列表
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults);

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

      const maxHistoryLimit = APP_CONSTANTS.LIMITS.MAX_HISTORY;
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

    if (resultsSection) resultsSection.style.display = 'none';
    if (resultsContainer) resultsContainer.innerHTML = '';
    if (searchInfo) searchInfo.textContent = '';
    if (clearResultsBtn) clearResultsBtn.style.display = 'none';

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
        detailExtractionEnabled: this.config.enableDetailExtraction,
        extractionStats: this.extractionStats
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
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '⌫',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: 'ⱱ️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
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
          extractionTimeout: Math.min(Math.max(userSettings.extractionTimeout || 15000, 5000), 30000),
          enableRetry: userSettings.enableRetry !== false,
          maxRetryAttempts: Math.min(userSettings.maxRetryAttempts || 2, 5),
          enableCache: userSettings.enableCache !== false,
          showExtractionProgress: userSettings.showExtractionProgress !== false,
          
          // 显示选项
          showScreenshots: userSettings.showScreenshots !== false,
          showDownloadLinks: userSettings.showDownloadLinks !== false,
          showMagnetLinks: userSettings.showMagnetLinks !== false,
          showActressInfo: userSettings.showActressInfo !== false,
          compactMode: userSettings.compactMode === true,
          enableImagePreview: userSettings.enableImagePreview !== false,
          
          // 高级选项
          strictValidation: userSettings.strictValidation !== false,
          enableContentFilter: userSettings.enableContentFilter === true,
          contentFilterKeywords: Array.isArray(userSettings.contentFilterKeywords) ? 
            userSettings.contentFilterKeywords : []
        };
        
        console.log('用户搜索配置已加载:', this.config);
      } else {
        // 未登录用户使用默认配置
        this.config = {
          useCache: true,
          saveToHistory: false,
          enableDetailExtraction: false,
          autoExtractDetails: false,
          maxAutoExtractions: 5,
          extractionBatchSize: 3,
          extractionTimeout: 15000,
          enableRetry: true,
          maxRetryAttempts: 2,
          enableCache: true,
          showExtractionProgress: true,
          showScreenshots: true,
          showDownloadLinks: true,
          showMagnetLinks: true,
          showActressInfo: true,
          compactMode: false,
          enableImagePreview: true,
          strictValidation: true,
          enableContentFilter: false,
          contentFilterKeywords: []
        };
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
      // 使用默认配置
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
      this.checkDetailServiceHealth();
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
      refreshSourceStatus: () => this.refreshAllSourcesStatus(),
      extractSingleDetail: (resultId) => this.extractSingleDetail(resultId),
      retryExtraction: (resultId) => this.retryExtraction(resultId),
      toggleDetailDisplay: (resultId) => this.toggleDetailDisplay(resultId),
      diagnoseExtraction: (resultId) => this.diagnoseExtraction(resultId),
      refreshConfig: () => this.loadUserConfig(),
      getExtractionStats: () => this.extractionStats,
      resetExtractionStats: () => {
        this.extractionStats = {
          totalExtractions: 0,
          successfulExtractions: 0,
          failedExtractions: 0,
          cacheHits: 0,
          averageTime: 0
        };
        this.updateStatsDisplay();
      }
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
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.currentResults = [];
    this.searchHistory = [];
    this.extractionQueue = [];
    this.progressCallbacks.clear();
    
    // 清理DOM元素
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.remove();
    }

    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      progressContainer.remove();
    }

    const insightsContainer = document.getElementById('extractionInsights');
    if (insightsContainer) {
      insightsContainer.remove();
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