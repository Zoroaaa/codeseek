// 增强版搜索组件 - 集成详情提取功能
import { APP_CONSTANTS } from '../core/constants.js';
import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml, truncateUrl, formatRelativeTime } from '../utils/format.js';
import { validateSearchKeyword } from '../utils/validation.js';
import { debounce } from '../utils/helpers.js';
import searchService, { searchHistoryManager } from '../services/search.js';
import authManager from '../services/auth.js';
import favoritesManager from './favorites.js';
import apiService from '../services/api.js';

// 🆕 导入详情提取相关服务
import detailAPIService from '../services/detail-api.js';

export class SearchManager {
  constructor() {
    this.currentResults = [];
    this.searchHistory = [];
    this.isInitialized = false;
    this.statusCheckInProgress = false;
    this.lastStatusCheckKeyword = null;
    
    // 🆕 详情提取相关属性
    this.detailExtractionEnabled = false;
    this.detailExtractionInProgress = false;
    this.detailExtractionQueue = [];
    this.detailExtractionConfig = {
      autoExtractDetails: false,
      maxAutoExtractions: 5,
      extractionBatchSize: 3,
      showExtractionProgress: true,
      enableCache: true
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadSearchHistory();
      // 🆕 加载详情提取配置
      await this.loadDetailExtractionConfig();
      this.bindEvents();
      this.handleURLParams();
      this.exposeGlobalMethods();
      this.isInitialized = true;
    } catch (error) {
      console.error('搜索管理器初始化失败:', error);
    }
  }

  // 🆕 加载详情提取配置
async loadDetailExtractionConfig() {
    try {
      // 无论是否登录，都尝试获取设置（未登录时会返回默认值）
      const userSettings = authManager.isAuthenticated() 
        ? await apiService.getUserSettings() 
        : APP_CONSTANTS.DEFAULT_USER_SETTINGS;
      
      this.detailExtractionEnabled = userSettings.enableDetailExtraction;
      this.detailExtractionConfig = {
        autoExtractDetails: userSettings.autoExtractDetails,
        maxAutoExtractions: userSettings.maxAutoExtractions,
        extractionBatchSize: userSettings.extractionBatchSize,
        showExtractionProgress: userSettings.showExtractionProgress,
        enableCache: userSettings.enableCache,
        showScreenshots: userSettings.showScreenshots,
        showDownloadLinks: userSettings.showDownloadLinks,
        showMagnetLinks: userSettings.showMagnetLinks,
        showActressInfo: userSettings.showActressInfo,
        compactMode: userSettings.compactMode,
        enableImagePreview: userSettings.enableImagePreview
      };

      console.log('详情提取配置已加载:', {
        enabled: this.detailExtractionEnabled,
        config: this.detailExtractionConfig
      });

    } catch (error) {
      console.warn('加载详情提取配置失败，使用默认配置:', error);
      // 这种情况下已经在 getUserSettings 中处理了默认值
    }
}
  
  // 暴露必要的全局方法
  exposeGlobalMethods() {
    window.searchManager = {
      openResult: (url, source) => this.openResult(url, source),
      toggleFavorite: (resultId) => this.toggleFavorite(resultId),
      copyToClipboard: (text) => this.copyToClipboard(text),
      searchFromHistory: (keyword) => this.searchFromHistory(keyword),
      deleteHistoryItem: (historyId) => this.deleteHistoryItem(historyId),
      checkSourceStatus: (sourceId) => this.checkSingleSourceStatus(sourceId),
      refreshSourceStatus: () => this.refreshAllSourcesStatus(),
      toggleStatusCheck: () => this.toggleStatusCheck(),
      viewStatusHistory: () => this.viewStatusHistory(),
      
      // 🆕 详情提取相关方法
      toggleDetailExtraction: () => this.toggleDetailExtraction(),
      extractSingleDetail: (resultId) => this.extractSingleDetail(resultId),
      extractBatchDetails: () => this.extractBatchDetails(),
      toggleDetailDisplay: (resultId) => this.toggleDetailDisplay(resultId),
      retryDetailExtraction: (resultId) => this.retryDetailExtraction(resultId),
      previewImage: (imageUrl) => this.previewImage(imageUrl),
      copyMagnetLink: (magnetLink) => this.copyMagnetLink(magnetLink),
      recordDownloadClick: (url, type) => this.recordDownloadClick(url, type),
      recordMagnetClick: (magnetLink) => this.recordMagnetClick(magnetLink)
    };
  }

  // 绑定事件
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
  }

  // 绑定键盘快捷键
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
        this.hideImagePreview(); // 🆕 关闭图片预览
      }
    });
  }

  // 处理URL参数
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

  // 🆕 执行增强搜索 - 支持详情提取
  async performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput?.value.trim();
    
    if (!keyword) {
      showToast('请输入搜索关键词', 'error');
      searchInput?.focus();
      return;
    }

    // 验证关键词
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

      // 获取搜索选项
      const useCache = true;
      const saveToHistory = authManager.isAuthenticated();

      // 执行搜索
      const results = await searchService.performSearch(keyword, {
        useCache,
        saveToHistory
      });
      
      // 显示搜索结果
      this.displaySearchResults(keyword, results);

      // 🆕 处理详情提取
      if (this.detailExtractionEnabled && authManager.isAuthenticated()) {
        await this.handleDetailExtraction(results, keyword);
      }

      // 更新搜索历史
      if (saveToHistory) {
        await this.addToHistory(keyword);
      }

    } catch (error) {
      console.error('搜索失败:', error);
      showToast(`搜索失败: ${error.message}`, 'error');
    } finally {
      showLoading(false);
      this.statusCheckInProgress = false;
      this.detailExtractionInProgress = false;
    }
  }

  // 🆕 处理详情提取
  async handleDetailExtraction(searchResults, keyword) {
    if (this.detailExtractionInProgress) {
      console.log('详情提取正在进行中，跳过本次请求');
      return;
    }

    try {
      this.detailExtractionInProgress = true;
      
      // 确定要提取详情的结果
      const resultsToExtract = this.detailExtractionConfig.autoExtractDetails ? 
        searchResults.slice(0, this.detailExtractionConfig.maxAutoExtractions) :
        searchResults.filter(result => this.shouldExtractDetail(result));

      if (resultsToExtract.length === 0) {
        console.log('没有需要提取详情的结果');
        return;
      }

      // 显示提取进度
      if (this.detailExtractionConfig.showExtractionProgress) {
        this.showExtractionProgress(resultsToExtract.length);
      }

      // 分批提取详情
      await this.extractDetailsInBatches(resultsToExtract);

    } catch (error) {
      console.error('详情提取失败:', error);
      showToast('详情提取失败: ' + error.message, 'error');
    } finally {
      this.detailExtractionInProgress = false;
      this.hideExtractionProgress();
    }
  }

  // 🆕 分批提取详情
  async extractDetailsInBatches(results) {
    const batchSize = this.detailExtractionConfig.extractionBatchSize;
    let processedCount = 0;

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      
      try {
        // 批量提取详情
        const extractionResult = await detailAPIService.extractBatchDetails(batch, {
          enableCache: this.detailExtractionConfig.enableCache,
          timeout: 15000
        });

        // 处理提取结果
        for (const result of extractionResult.results) {
          await this.handleSingleExtractionResult(result);
          processedCount++;
          
          // 更新进度
          if (this.detailExtractionConfig.showExtractionProgress) {
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
          if (this.detailExtractionConfig.showExtractionProgress) {
            this.updateExtractionProgress(processedCount, results.length);
          }
        });
      }
    }

    console.log(`详情提取完成: ${processedCount}/${results.length}`);
  }

  // 🆕 处理单个提取结果
  async handleSingleExtractionResult(result) {
    try {
      const resultContainer = document.querySelector(`[data-result-id="${result.id}"]`);
      if (!resultContainer) {
        console.warn('未找到对应的结果容器:', result.id);
        return;
      }

      if (result.extractionStatus === 'success') {
        // 创建详情卡片并插入到结果中
        this.insertDetailCard(resultContainer, result);
        // 添加展开/收起按钮
        this.addDetailToggleButton(resultContainer);
      } else {
        // 显示提取失败状态
        this.showExtractionError(resultContainer, result.extractionError);
      }

    } catch (error) {
      console.error('处理提取结果失败:', error);
    }
  }

  // 🆕 插入详情卡片
  insertDetailCard(resultContainer, detailInfo) {
    let detailContainer = resultContainer.querySelector('.result-detail-container');
    
    if (!detailContainer) {
      detailContainer = document.createElement('div');
      detailContainer.className = 'result-detail-container';
      detailContainer.style.display = 'none';
      resultContainer.appendChild(detailContainer);
    }

    const detailCardHTML = this.createDetailCardHTML(detailInfo);
    detailContainer.innerHTML = detailCardHTML;
  }

  // 🆕 创建详情卡片HTML
  createDetailCardHTML(detailInfo) {
    const config = this.detailExtractionConfig;
    
    // 基本信息部分
    const basicInfoHTML = this.createBasicInfoHTML(detailInfo);
    
    // 媒体信息部分
    const mediaInfoHTML = this.createMediaInfoHTML(detailInfo, config);
    
    // 演员信息部分
    const actressInfoHTML = config.showActressInfo ? 
      this.createActressInfoHTML(detailInfo) : '';
    
    // 下载链接部分
    const downloadLinksHTML = config.showDownloadLinks ? 
      this.createDownloadLinksHTML(detailInfo) : '';
    
    // 磁力链接部分
    const magnetLinksHTML = config.showMagnetLinks ? 
      this.createMagnetLinksHTML(detailInfo) : '';
    
    // 截图预览部分
    const screenshotsHTML = config.showScreenshots ? 
      this.createScreenshotsHTML(detailInfo, config) : '';
    
    // 详情信息部分
    const detailsHTML = this.createDetailsHTML(detailInfo);
    
    // 状态指示器
    const statusHTML = this.createStatusHTML(detailInfo);

    return `
      <div class="detail-card ${config.compactMode ? 'compact' : ''}" 
           data-card-id="${detailInfo.id}" 
           data-url="${escapeHtml(detailInfo.detailUrl || detailInfo.url)}">
        
        <!-- 状态指示器 -->
        ${statusHTML}
        
        <!-- 卡片头部 -->
        <div class="detail-card-header">
          ${basicInfoHTML}
        </div>
        
        <!-- 媒体信息 -->
        ${mediaInfoHTML}
        
        <!-- 演员信息 -->
        ${actressInfoHTML}
        
        <!-- 下载信息 -->
        <div class="detail-card-downloads">
          ${downloadLinksHTML}
          ${magnetLinksHTML}
        </div>
        
        <!-- 截图预览 -->
        ${screenshotsHTML}
        
        <!-- 详细信息 -->
        ${detailsHTML}
        
        <!-- 提取信息 -->
        <div class="detail-card-meta">
          <small class="extraction-info">
            提取来源: ${escapeHtml(detailInfo.sourceType || 'unknown')} | 
            提取时间: ${detailInfo.extractionTime ? `${detailInfo.extractionTime}ms` : '未知'} |
            ${detailInfo.fromCache ? '来自缓存' : '实时提取'} |
            ${formatRelativeTime(detailInfo.extractedAt || Date.now())}
          </small>
        </div>
      </div>
    `;
  }

  // 🆕 创建基本信息HTML
  createBasicInfoHTML(detailInfo) {
    const title = detailInfo.title || '未知标题';
    const code = detailInfo.code || '';
    const originalTitle = detailInfo.originalTitle || '';

    return `
      <div class="detail-basic-info">
        <h4 class="detail-title" title="${escapeHtml(title)}">
          ${escapeHtml(title)}
        </h4>
        
        ${code ? `
          <div class="detail-code">
            <span class="code-label">番号:</span>
            <span class="code-value">${escapeHtml(code)}</span>
          </div>
        ` : ''}
        
        ${originalTitle ? `
          <div class="detail-original-title">
            <span class="original-title-label">原标题:</span>
            <span class="original-title-value">${escapeHtml(originalTitle)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 🆕 创建媒体信息HTML
  createMediaInfoHTML(detailInfo, config) {
    if (!detailInfo.coverImage && !detailInfo.description) {
      return '';
    }

    const coverImageHTML = detailInfo.coverImage ? `
      <div class="detail-cover">
        <img src="${escapeHtml(detailInfo.coverImage)}" 
             alt="封面图片" 
             class="cover-image"
             loading="lazy"
             onerror="this.style.display='none'"
             ${config.enableImagePreview ? `onclick="window.searchManager.previewImage('${escapeHtml(detailInfo.coverImage)}')"` : ''}>
      </div>
    ` : '';

    const metadataHTML = this.createMetadataHTML(detailInfo);

    const descriptionHTML = detailInfo.description ? `
      <div class="detail-description">
        <h5>简介:</h5>
        <p class="description-text">${escapeHtml(detailInfo.description)}</p>
      </div>
    ` : '';

    return `
      <div class="detail-media-info">
        <div class="media-content">
          ${coverImageHTML}
          <div class="media-details">
            ${metadataHTML}
            ${descriptionHTML}
          </div>
        </div>
      </div>
    `;
  }

  // 🆕 创建元数据HTML
  createMetadataHTML(detailInfo) {
    const metadata = [];

    if (detailInfo.releaseDate) {
      metadata.push(`<span class="meta-item"><strong>发行日期:</strong> ${escapeHtml(detailInfo.releaseDate)}</span>`);
    }

    if (detailInfo.duration) {
      metadata.push(`<span class="meta-item"><strong>时长:</strong> ${escapeHtml(detailInfo.duration)}分钟</span>`);
    }

    if (detailInfo.director) {
      metadata.push(`<span class="meta-item"><strong>导演:</strong> ${escapeHtml(detailInfo.director)}</span>`);
    }

    if (detailInfo.studio) {
      metadata.push(`<span class="meta-item"><strong>制作商:</strong> ${escapeHtml(detailInfo.studio)}</span>`);
    }

    if (detailInfo.label) {
      metadata.push(`<span class="meta-item"><strong>发行商:</strong> ${escapeHtml(detailInfo.label)}</span>`);
    }

    if (detailInfo.series) {
      metadata.push(`<span class="meta-item"><strong>系列:</strong> ${escapeHtml(detailInfo.series)}</span>`);
    }

    if (detailInfo.quality) {
      metadata.push(`<span class="meta-item"><strong>画质:</strong> ${escapeHtml(detailInfo.quality)}</span>`);
    }

    if (detailInfo.fileSize) {
      metadata.push(`<span class="meta-item"><strong>文件大小:</strong> ${escapeHtml(detailInfo.fileSize)}</span>`);
    }

    if (detailInfo.rating && detailInfo.rating > 0) {
      const stars = this.generateStarsHTML(detailInfo.rating);
      metadata.push(`<span class="meta-item"><strong>评分:</strong> ${stars} (${detailInfo.rating}/10)</span>`);
    }

    return metadata.length > 0 ? `
      <div class="detail-metadata">
        ${metadata.join('')}
      </div>
    ` : '';
  }

  // 🆕 创建演员信息HTML
  createActressInfoHTML(detailInfo) {
    if (!detailInfo.actresses || detailInfo.actresses.length === 0) {
      return '';
    }

    const actressesHTML = detailInfo.actresses.map(actress => {
      const name = actress.name || actress;
      const avatarHTML = actress.avatar ? `
        <img src="${escapeHtml(actress.avatar)}" 
             alt="${escapeHtml(name)}" 
             class="actress-avatar"
             loading="lazy"
             onerror="this.style.display='none'">
      ` : '';

      const profileLinkHTML = actress.profileUrl ? `
        <a href="${escapeHtml(actress.profileUrl)}" 
           target="_blank" 
           rel="noopener noreferrer"
           class="actress-profile-link">查看资料</a>
      ` : '';

      return `
        <div class="actress-item">
          ${avatarHTML}
          <div class="actress-info">
            <span class="actress-name">${escapeHtml(name)}</span>
            ${profileLinkHTML}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-actresses">
        <h5>演员信息:</h5>
        <div class="actresses-list">
          ${actressesHTML}
        </div>
      </div>
    `;
  }

  // 🆕 创建下载链接HTML
  createDownloadLinksHTML(detailInfo) {
    if (!detailInfo.downloadLinks || detailInfo.downloadLinks.length === 0) {
      return '';
    }

    const linksHTML = detailInfo.downloadLinks.map((link, index) => {
      const name = link.name || `下载链接 ${index + 1}`;
      const sizeInfo = link.size ? `<span class="link-size">(${escapeHtml(link.size)})</span>` : '';
      const qualityInfo = link.quality ? `<span class="link-quality">[${escapeHtml(link.quality)}]</span>` : '';
      const typeInfo = link.type ? `<span class="link-type">${this.getDownloadTypeIcon(link.type)}</span>` : '';

      return `
        <div class="download-link-item">
          <a href="${escapeHtml(link.url)}" 
             target="_blank" 
             rel="noopener noreferrer"
             class="download-link"
             onclick="window.searchManager.recordDownloadClick('${escapeHtml(link.url)}', '${escapeHtml(link.type || 'unknown')}')">
            ${typeInfo}
            <span class="link-name">${escapeHtml(name)}</span>
            ${qualityInfo}
            ${sizeInfo}
          </a>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-download-links">
        <h5>下载链接:</h5>
        <div class="download-links-list">
          ${linksHTML}
        </div>
      </div>
    `;
  }

  // 🆕 创建磁力链接HTML
  createMagnetLinksHTML(detailInfo) {
    if (!detailInfo.magnetLinks || detailInfo.magnetLinks.length === 0) {
      return '';
    }

    const linksHTML = detailInfo.magnetLinks.map((link, index) => {
      const name = link.name || `磁力链接 ${index + 1}`;
      const sizeInfo = link.size ? `<span class="magnet-size">(${escapeHtml(link.size)})</span>` : '';
      const seedInfo = link.seeders || link.leechers ? `
        <span class="magnet-seeds">
          种子: ${link.seeders || 0} | 下载: ${link.leechers || 0}
        </span>
      ` : '';
      const qualityInfo = link.quality ? `<span class="magnet-quality">[${escapeHtml(link.quality)}]</span>` : '';

      return `
        <div class="magnet-link-item">
          <div class="magnet-link-header">
            <span class="magnet-icon">🧲</span>
            <span class="magnet-name">${escapeHtml(name)}</span>
            ${qualityInfo}
            ${sizeInfo}
          </div>
          
          ${seedInfo ? `<div class="magnet-stats">${seedInfo}</div>` : ''}
          
          <div class="magnet-actions">
            <button class="magnet-copy-btn" 
                    onclick="window.searchManager.copyMagnetLink('${escapeHtml(link.magnet)}')">
              复制磁力链接
            </button>
            <a href="${escapeHtml(link.magnet)}" 
               class="magnet-open-btn"
               onclick="window.searchManager.recordMagnetClick('${escapeHtml(link.magnet)}')">
              打开磁力链接
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-magnet-links">
        <h5>磁力链接:</h5>
        <div class="magnet-links-list">
          ${linksHTML}
        </div>
      </div>
    `;
  }

  // 🆕 创建截图预览HTML
  createScreenshotsHTML(detailInfo, config) {
    if (!detailInfo.screenshots || detailInfo.screenshots.length === 0) {
      return '';
    }

    const screenshotsHTML = detailInfo.screenshots.map((screenshot, index) => `
      <div class="screenshot-item">
        <img src="${escapeHtml(screenshot)}" 
             alt="截图 ${index + 1}" 
             class="screenshot-image"
             loading="lazy"
             onerror="this.parentElement.style.display='none'"
             ${config.enableImagePreview ? `onclick="window.searchManager.previewImage('${escapeHtml(screenshot)}')"` : ''}>
      </div>
    `).join('');

    return `
      <div class="detail-screenshots">
        <h5>截图预览:</h5>
        <div class="screenshots-grid">
          ${screenshotsHTML}
        </div>
      </div>
    `;
  }

  // 🆕 创建详细信息HTML
  createDetailsHTML(detailInfo) {
    const tagsHTML = detailInfo.tags && detailInfo.tags.length > 0 ? `
      <div class="detail-tags">
        <h5>标签:</h5>
        <div class="tags-list">
          ${detailInfo.tags.map(tag => `
            <span class="tag-item">${escapeHtml(tag)}</span>
          `).join('')}
        </div>
      </div>
    ` : '';

    return tagsHTML ? `
      <div class="detail-details">
        ${tagsHTML}
      </div>
    ` : '';
  }

  // 🆕 创建状态指示器HTML
  createStatusHTML(detailInfo) {
    const status = detailInfo.extractionStatus || 'unknown';
    const statusClass = `status-${status}`;
    const statusText = this.getExtractionStatusText(status);
    const statusIcon = this.getExtractionStatusIcon(status);

    return `
      <div class="detail-card-status ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
      </div>
    `;
  }

  // 🆕 添加详情展开/收起按钮
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

  // 🆕 切换详情显示状态
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

  // 显示搜索状态检查进度
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

  // 显示搜索结果 - 增强版，支持状态显示和不可用结果处理
  displaySearchResults(keyword, results) {
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 计算状态统计（包含不可用结果统计）
    const statusStats = this.calculateStatusStats(results);
    
    if (searchInfo) {
      let statusInfo = '';
      if (statusStats.hasStatus) {
        const availableCount = statusStats.available;
        const unavailableCount = statusStats.unavailable + statusStats.timeout + statusStats.error;
        const totalCount = results.length;
        const contentMatches = statusStats.contentMatches || 0;
        
        statusInfo = ` | 可用: ${availableCount}/${totalCount}`;
        
        // 显示不可用数量
        if (unavailableCount > 0) {
          statusInfo += ` | 不可用: ${unavailableCount}`;
        }
        
        // 添加内容匹配信息
        if (contentMatches > 0) {
          statusInfo += ` | 内容匹配: ${contentMatches}`;
        }
      }
      
      // 🆕 添加详情提取信息
      let detailExtractionInfo = '';
      if (this.detailExtractionEnabled && authManager.isAuthenticated()) {
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
      // 使用grid布局而不是简单的join，以支持不可用结果的特殊样式
      resultsContainer.className = 'results-grid';
      resultsContainer.innerHTML = results.map(result => this.createResultHTML(result)).join('');
      
      // 绑定事件委托
      this.bindResultsEvents(resultsContainer);
    }

    this.currentResults = results;
    
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

  // 计算状态统计（包括不可用结果统计）
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
        
        // 统计内容匹配和缓存使用
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
  
  // 绑定结果区域事件
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
        case 'checkStatus':
          this.checkSingleSourceStatus(source, resultId);
          break;
        case 'viewDetails':
          this.viewSourceStatusDetails(resultId);
          break;
        // 🆕 详情提取相关操作
        case 'extractDetail':
          this.extractSingleDetail(resultId);
          break;
        case 'toggleDetail':
          this.toggleDetailDisplay(resultId);
          break;
        case 'retryExtraction':
          this.retryDetailExtraction(resultId);
          break;
      }
    });
  }

  // 创建搜索结果HTML - 支持不可用结果的特殊显示
  createResultHTML(result) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    
    // 状态指示器HTML（增强版，包含不可用原因）
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
    
    // 访问按钮状态（不可用时禁用）
    const visitButtonHTML = isUnavailable ? `
      <button class="action-btn visit-btn disabled" disabled title="该搜索源当前不可用">
        <span>不可用</span>
      </button>
    ` : `
      <button class="action-btn visit-btn" data-action="visit" data-url="${escapeHtml(result.url)}" data-source="${result.source}">
        <span>访问</span>
      </button>
    `;

    // 🆕 详情提取按钮
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable ? `
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
        
        <!-- 🆕 详情显示容器 -->
        <div class="result-detail-container" style="display: none;">
          <!-- 详情内容将在这里动态插入 -->
        </div>
      </div>
    `;
  }

  // 🆕 判断是否应该提取详情
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    return APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES.includes(result.source);
  }

  // 🆕 判断结果是否不可用
  isResultUnavailable(result) {
    if (!result.status) return false;
    
    return result.status === APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.TIMEOUT ||
           result.status === APP_CONSTANTS.SOURCE_STATUS.ERROR;
  }

  // 🆕 显示提取进度
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

  // 🆕 更新提取进度
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

  // 🆕 隐藏提取进度
  hideExtractionProgress() {
    const progressContainer = document.getElementById('extraction-progress');
    if (progressContainer) {
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 2000);
    }
  }

  // 🆕 显示提取错误
  showExtractionError(resultContainer, error) {
    const detailContainer = resultContainer.querySelector('.result-detail-container') ||
                           this.createDetailContainer(resultContainer);

    detailContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">⌘</div>
        <div class="error-message">
          <strong>详情提取失败</strong>
          <small>${escapeHtml(error || '未知错误')}</small>
        </div>
        <button class="retry-btn" onclick="window.searchManager.retryDetailExtraction('${resultContainer.dataset.resultId}')">
          重试
        </button>
      </div>
    `;
  }

  // 🆕 创建详情容器
  createDetailContainer(resultContainer) {
    const detailContainer = document.createElement('div');
    detailContainer.className = 'result-detail-container';
    detailContainer.style.display = 'none';
    resultContainer.appendChild(detailContainer);
    return detailContainer;
  }

  // 🆕 单独提取详情
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
        enableCache: this.detailExtractionConfig.enableCache,
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

  // 🆕 重试详情提取
  async retryDetailExtraction(resultId) {
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

  // 🆕 切换详情提取功能
  async toggleDetailExtraction() {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录以使用详情提取功能', 'error');
      return;
    }

    try {
      const userSettings = await apiService.getUserSettings();
      const newState = !this.detailExtractionEnabled;
      
      await apiService.updateUserSettings({
        ...userSettings,
        enableDetailExtraction: newState
      });
      
      this.detailExtractionEnabled = newState;
      
      // 重新加载配置
      await this.loadDetailExtractionConfig();
      
      showToast(`详情提取功能已${newState ? '启用' : '禁用'}`, 'success');
      
    } catch (error) {
      console.error('切换详情提取功能失败:', error);
      showToast('设置更新失败: ' + error.message, 'error');
    }
  }

  // 🆕 图片预览
  previewImage(imageUrl) {
    if (!imageUrl) return;

    // 创建预览模态框
    let previewModal = document.getElementById('image-preview-modal');
    
    if (!previewModal) {
      previewModal = document.createElement('div');
      previewModal.id = 'image-preview-modal';
      previewModal.className = 'image-preview-modal';
      previewModal.innerHTML = `
        <div class="image-preview-backdrop" onclick="window.searchManager.hideImagePreview()"></div>
        <div class="image-preview-container">
          <img class="image-preview-img" src="" alt="图片预览">
          <button class="image-preview-close" onclick="window.searchManager.hideImagePreview()">×</button>
        </div>
      `;
      document.body.appendChild(previewModal);
    }

    const previewImg = previewModal.querySelector('.image-preview-img');
    previewImg.src = imageUrl;
    previewModal.style.display = 'flex';

    // 记录行为
    if (authManager.isAuthenticated()) {
      apiService.recordAction('image_preview', { imageUrl }).catch(console.error);
    }
  }

  // 🆕 隐藏图片预览
  hideImagePreview() {
    const previewModal = document.getElementById('image-preview-modal');
    if (previewModal) {
      previewModal.style.display = 'none';
    }
  }

  // 🆕 复制磁力链接
  async copyMagnetLink(magnetLink) {
    try {
      await navigator.clipboard.writeText(magnetLink);
      showToast('磁力链接已复制到剪贴板', 'success');
      
      if (authManager.isAuthenticated()) {
        apiService.recordAction('magnet_link_copied', { magnetLink }).catch(console.error);
      }
    } catch (error) {
      // 降级到传统方法
      const textArea = document.createElement('textarea');
      textArea.value = magnetLink;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast('磁力链接已复制到剪贴板', 'success');
      } catch (err) {
        showToast('复制失败', 'error');
      }
      document.body.removeChild(textArea);
    }
  }

  // 🆕 记录下载点击
  recordDownloadClick(url, type) {
    if (authManager.isAuthenticated()) {
      apiService.recordAction('download_link_clicked', { url, type }).catch(console.error);
    }
  }

  // 🆕 记录磁力点击
  recordMagnetClick(magnetLink) {
    if (authManager.isAuthenticated()) {
      apiService.recordAction('magnet_link_clicked', { magnetLink }).catch(console.error);
    }
  }

  // 🆕 获取下载类型图标
  getDownloadTypeIcon(type) {
    const icons = {
      'http': '🌐',
      'https': '🔒',
      'ftp': '📁',
      'magnet': '🧲',
      'torrent': '📦',
      'unknown': '📎'
    };
    return icons[type] || icons.unknown;
  }

  // 🆕 生成星级评分HTML
  generateStarsHTML(rating) {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('<span class="star">★</span>');
    }
    
    if (hasHalfStar) {
      stars.push('<span class="star star-half">★</span>');
    }
    
    const emptyStars = 10 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
      stars.push('<span class="star star-empty">★</span>');
    }
    
    return stars.join('');
  }

  // 🆕 获取提取状态文本
  getExtractionStatusText(status) {
    const statusTexts = {
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.SUCCESS]: '提取成功',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.ERROR]: '提取失败',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.TIMEOUT]: '提取超时',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.CACHED]: '来自缓存',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.PARTIAL]: '部分成功',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.PENDING]: '等待中',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.IN_PROGRESS]: '提取中'
    };
    return statusTexts[status] || '未知';
  }

  // 🆕 获取提取状态图标
  getExtractionStatusIcon(status) {
    const statusIcons = {
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.SUCCESS]: '✅',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.ERROR]: '❌',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.CACHED]: '💾',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.PARTIAL]: '⚠️',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.PENDING]: '⏳',
      [APP_CONSTANTS.DETAIL_EXTRACTION_STATUS.IN_PROGRESS]: '🔄'
    };
    return statusIcons[status] || '❓';
  }

  // 🆕 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 获取状态样式类
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

  // 获取状态文本
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

  // 获取状态图标
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

  // 检查单个搜索源状态
  async checkSingleSourceStatus(sourceId, resultId) {
    try {
      showLoading(true);
      showToast(`正在检查 ${sourceId} 状态...`, 'info');

      // 调用搜索服务检查状态
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
        
        // 显示不可用原因
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

  // 刷新所有搜索源状态
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

  // 查看搜索源状态详情（增强版，显示不可用原因）
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

  // 切换状态检查功能
  async toggleStatusCheck() {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录以使用状态检查功能', 'error');
      return;
    }

    try {
      const userSettings = await apiService.getUserSettings();
      const newStatus = !userSettings.checkSourceStatus;
      
      await apiService.updateUserSettings({
        ...userSettings,
        checkSourceStatus: newStatus
      });
      
      showToast(`搜索源状态检查已${newStatus ? '启用' : '禁用'}`, 'success');
      
      // 清除搜索服务的用户设置缓存，强制重新获取
      searchService.clearUserSettingsCache();
      
    } catch (error) {
      console.error('切换状态检查失败:', error);
      showToast('设置更新失败: ' + error.message, 'error');
    }
  }

  // 查看状态检查历史
  async viewStatusHistory() {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录以查看状态历史', 'error');
      return;
    }

    try {
      showLoading(true);
      const historyData = await apiService.getSourceStatusHistory({ limit: 20 });
      
      if (historyData.success && historyData.history.length > 0) {
        // 简单显示历史（实际项目中可以用更好的UI）
        const historyText = historyData.history.map(item => 
          `${item.sourceId}: ${item.status} (${item.keyword}) - ${new Date(item.lastChecked).toLocaleString()}`
        ).join('\n');
        
        alert(`状态检查历史:\n\n${historyText}`);
      } else {
        showToast('暂无状态检查历史', 'info');
      }
    } catch (error) {
      console.error('获取状态历史失败:', error);
      showToast('获取历史失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 打开搜索结果
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

  // 复制到剪贴板
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

  // 切换收藏状态
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

  // 更新收藏按钮状态
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

  // 加载搜索历史
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

  // 添加到历史记录
  async addToHistory(keyword) {
    const settings = await apiService.getUserSettings();
    const maxHistory = settings.maxHistoryPerUser || 100;
    
    // 如果超出限制，删除最旧的记录
    if (this.searchHistory.length >= maxHistory) {
        const oldestId = this.searchHistory[this.searchHistory.length - 1].id;
        await apiService.deleteSearchHistory(oldestId);
        this.searchHistory.pop();
    }
      
    if (!authManager.isAuthenticated()) return;

    try {
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

      const maxHistory = APP_CONSTANTS.LIMITS.MAX_HISTORY;
      if (this.searchHistory.length > maxHistory) {
        this.searchHistory = this.searchHistory.slice(0, maxHistory);
      }

      this.renderHistory();
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      showToast('保存搜索历史失败', 'warning');
    }
  }

  // 删除单条历史记录
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

  // 渲染搜索历史
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

  // 从历史记录搜索
  searchFromHistory(keyword) {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.value = keyword;
      this.performSearch();
    }
  }

  // 清空搜索历史
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

  // 清空搜索结果
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

  // 导出搜索结果
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
        detailExtractionEnabled: this.detailExtractionEnabled, // 🆕 包含详情提取状态
        detailExtractionConfig: this.detailExtractionConfig
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

  // 处理搜索输入
  handleSearchInput(value) {
    if (value.length > 0) {
      this.showSearchSuggestions(value);
    } else {
      this.hideSearchSuggestions();
    }
  }

  // 显示搜索建议
  showSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return;
    
    const suggestions = searchService.getSearchSuggestions(query, this.searchHistory);
    this.renderSearchSuggestions(suggestions);
  }

  // 渲染搜索建议
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
          <span class="suggestion-icon">🕑</span>
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

  // 隐藏搜索建议
  hideSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (suggestionsContainer) {
      suggestionsContainer.style.display = 'none';
    }
  }

  // 隐藏快速提示
  hideQuickTips() {
    const quickTips = document.getElementById('quickTips');
    if (quickTips) {
      quickTips.style.display = 'none';
    }
  }
}

// 创建全局实例
export const searchManager = new SearchManager();
export default searchManager;