// src/components/search/SearchResultsRenderer.js - 搜索结果渲染子组件 v2.0.0
// 完全适配新架构：模块化解析器、统一数据结构、增强错误处理、详情提取集成、性能监控
import { APP_CONSTANTS } from '../../core/constants.js';
import { escapeHtml, truncateUrl, formatRelativeTime, formatFileSize } from '../../utils/format.js';
import favoritesManager from '../favorites.js';
import authManager from '../../services/auth.js';
import { 
  DETAIL_EXTRACTION_STATUS, 
  SUPPORTED_SOURCE_TYPES,
  ARCHITECTURE_FEATURES 
} from '../../core/detail-config.js';

export class SearchResultsRenderer {
  constructor() {
    this.currentResults = [];
    this.config = {}; // 配置属性
    this.version = '2.0.0'; // 🆕 新架构版本
    
    // 🆕 新架构特性支持
    this.architectureFeatures = {
      modularParsers: true,
      unifiedDataStructure: true,
      enhancedErrorHandling: true,
      detailExtractionIntegration: true,
      performanceMonitoring: true
    };
    
    // 🆕 渲染统计和性能监控
    this.renderingStats = {
      totalRenders: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      renderHistory: []
    };
    
    // 🆕 详情显示状态管理
    this.detailDisplayStates = new Map(); // resultId -> isExpanded
    this.detailExtractionStates = new Map(); // resultId -> extractionStatus
    
    // 🆕 结果质量分析
    this.qualityMetrics = {
      highQuality: 0,
      mediumQuality: 0,
      lowQuality: 0,
      withDetails: 0,
      supportedSources: 0
    };
    
    // 🆕 架构兼容性标记
    this.dataStructureVersion = '2.0';
    this.supportedExtractionSources = SUPPORTED_SOURCE_TYPES;
  }

  /**
   * 初始化结果渲染器 - 增强新架构支持
   */
  async init() {
    try {
      this.bindResultsEvents();
      this.initPerformanceMonitoring();
      this.setupArchitectureCompatibility();
      console.log(`搜索结果渲染器初始化完成 (v${this.version})`);
      console.log('支持的架构特性:', this.architectureFeatures);
    } catch (error) {
      console.error('搜索结果渲染器初始化失败:', error);
    }
  }
  
  /**
   * 🆕 初始化性能监控
   */
  initPerformanceMonitoring() {
    // 监控渲染性能
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name.startsWith('search-render')) {
          this.recordRenderPerformance(entry);
        }
      }
    });
    
    if (typeof PerformanceObserver !== 'undefined') {
      this.performanceObserver.observe({ entryTypes: ['measure'] });
    }
  }

  /**
   * 🆕 设置架构兼容性
   */
  setupArchitectureCompatibility() {
    // 检查数据结构版本兼容性
    this.dataStructureSupport = {
      v1: true, // 向后兼容
      v2: true, // 新架构
      parsedData: true, // 统一数据结构
      enhancedMetadata: true // 增强元数据
    };
    
    // 设置支持的解析器源
    this.supportedExtractionSources = Object.values(SUPPORTED_SOURCE_TYPES);
    
    console.log('架构兼容性已设置:', this.dataStructureSupport);
  }

  /**
   * 更新配置 - 增强新架构支持
   */
  updateConfig(config) {
    if (!config || typeof config !== 'object') {
      console.warn('SearchResultsRenderer: 无效的配置对象');
      return;
    }

    // 合并配置
    this.config = { ...this.config, ...config };
    
    // 🆕 检查新架构配置
    if (config.architectureVersion) {
      this.version = config.architectureVersion;
    }
    
    if (config.architectureFeatures) {
      this.architectureFeatures = { ...this.architectureFeatures, ...config.architectureFeatures };
    }
    
    console.log(`SearchResultsRenderer: 配置已更新 (v${this.version})`, this.config);
    
    // 如果当前有结果，重新渲染以应用新配置
    if (this.currentResults.length > 0) {
      const keyword = document.getElementById('searchInput')?.value || '';
      this.displaySearchResults(keyword, this.currentResults, this.config);
    }
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { 
      ...this.config,
      architectureVersion: this.version,
      architectureFeatures: this.architectureFeatures,
      dataStructureVersion: this.dataStructureVersion
    };
  }

  /**
   * 处理配置变更 - 兼容方法
   */
  handleConfigChange(config) {
    this.updateConfig(config);
  }

  /**
   * 显示搜索结果 - 增强新架构支持
   */
  displaySearchResults(keyword, results, config) {
    const renderStartTime = performance.now();
    performance.mark('search-render-start');
    
    this.currentResults = results;
    
    const resultsSection = document.getElementById('resultsSection');
    const searchInfo = document.getElementById('searchInfo');
    const resultsContainer = document.getElementById('results');
    const clearResultsBtn = document.getElementById('clearResultsBtn');
    const exportResultsBtn = document.getElementById('exportResultsBtn');

    if (resultsSection) resultsSection.style.display = 'block';
    
    // 🆕 分析结果质量和架构兼容性
    this.analyzeResultsQuality(results);
    
    // 计算状态统计
    const statusStats = this.calculateStatusStats(results);
    
    // 🆕 计算架构增强统计
    const architectureStats = this.calculateArchitectureStats(results);
    
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
      
      // 🆕 添加详情提取和架构信息
      let detailExtractionInfo = '';
      if (config.enableDetailExtraction) {
        const supportedCount = results.filter(r => this.shouldExtractDetail(r)).length;
        const extractedCount = results.filter(r => this.hasDetailExtracted(r)).length;
        detailExtractionInfo = ` | 支持详情: ${supportedCount}`;
        if (extractedCount > 0) {
          detailExtractionInfo += ` | 已提取: ${extractedCount}`;
        }
      }
      
      // 🆕 架构信息
      let architectureInfo = '';
      if (architectureStats.v2Results > 0) {
        architectureInfo = ` | v${this.version}: ${architectureStats.v2Results}`;
      }
      
      searchInfo.innerHTML = `
        <div class="search-info-content">
          <div class="search-info-main">
            搜索关键词: <strong>${escapeHtml(keyword)}</strong> 
            (${results.length}个结果${statusInfo}${detailExtractionInfo}${architectureInfo})
          </div>
          <div class="search-info-meta">
            <span class="search-time">${new Date().toLocaleString()}</span>
            ${this.renderQualityIndicators()}
            ${this.renderArchitectureIndicators()}
          </div>
        </div>
      `;
    }

    if (clearResultsBtn) clearResultsBtn.style.display = 'inline-block';
    if (exportResultsBtn) exportResultsBtn.style.display = 'inline-block';

    if (resultsContainer) {
      resultsContainer.className = 'results-grid';
      
      // 🆕 按质量和优先级排序结果
      const sortedResults = this.sortResultsByQuality(results);
      
      resultsContainer.innerHTML = sortedResults
        .map(result => this.createResultHTML(result, config))
        .join('');
      
      // 🆕 渲染架构增强信息面板
      this.renderArchitectureEnhancementsPanel(resultsContainer, architectureStats);
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

    // 🆕 记录渲染性能
    performance.mark('search-render-end');
    performance.measure('search-render-duration', 'search-render-start', 'search-render-end');
    
    const renderTime = performance.now() - renderStartTime;
    this.updateRenderingStats(renderTime, results.length);

    // 触发结果渲染完成事件 - 增强新架构信息
    document.dispatchEvent(new CustomEvent('searchResultsRendered', {
      detail: { 
        keyword, 
        results, 
        resultCount: results.length,
        statusStats,
        architectureStats,
        qualityMetrics: this.qualityMetrics,
        renderTime,
        version: this.version
      }
    }));
  }

  /**
   * 🆕 分析结果质量
   */
  analyzeResultsQuality(results) {
    this.qualityMetrics = {
      highQuality: 0,
      mediumQuality: 0,
      lowQuality: 0,
      withDetails: 0,
      supportedSources: 0,
      v2Compatible: 0,
      enhancedMetadata: 0
    };

    results.forEach(result => {
      // 质量分析
      const quality = this.calculateResultQuality(result);
      switch (quality.level) {
        case 'high':
          this.qualityMetrics.highQuality++;
          break;
        case 'medium':
          this.qualityMetrics.mediumQuality++;
          break;
        case 'low':
          this.qualityMetrics.lowQuality++;
          break;
      }

      // 详情提取支持
      if (this.shouldExtractDetail(result)) {
        this.qualityMetrics.supportedSources++;
      }

      if (this.hasDetailExtracted(result)) {
        this.qualityMetrics.withDetails++;
      }

      // 🆕 架构兼容性
      if (result.architectureVersion === '2.0') {
        this.qualityMetrics.v2Compatible++;
      }

      if (result.enhancedMetadata) {
        this.qualityMetrics.enhancedMetadata++;
      }
    });
  }

  /**
   * 🆕 计算架构统计
   */
  calculateArchitectureStats(results) {
    const stats = {
      v1Results: 0,
      v2Results: 0,
      parsedDataResults: 0,
      enhancedMetadataResults: 0,
      modularParserResults: 0,
      unifiedStructureResults: 0
    };

    results.forEach(result => {
      // 架构版本统计
      if (result.architectureVersion === '2.0') {
        stats.v2Results++;
      } else {
        stats.v1Results++;
      }

      // 新架构特性统计
      if (result.dataStructureVersion === '2.0') {
        stats.unifiedStructureResults++;
      }

      if (result.enhancedMetadata) {
        stats.enhancedMetadataResults++;
      }

      if (result.parser || result.sourceType) {
        stats.modularParserResults++;
      }

      // ParsedData格式检测
      if (this.isParsedDataFormat(result)) {
        stats.parsedDataResults++;
      }
    });

    return stats;
  }

  /**
   * 🆕 检测是否为ParsedData格式
   */
  isParsedDataFormat(result) {
    return result.dataStructureVersion === '2.0' || 
           (result.extractionStatus && result.extractedAt) ||
           result.architecture === 'modular_parsers';
  }

  /**
   * 🆕 按质量排序结果
   */
  sortResultsByQuality(results) {
    return [...results].sort((a, b) => {
      // 首先按提取状态排序（已提取的优先）
      const aHasDetails = this.hasDetailExtracted(a) ? 3 : 0;
      const bHasDetails = this.hasDetailExtracted(b) ? 3 : 0;

      // 然后按质量评分排序
      const aQuality = this.calculateResultQuality(a);
      const bQuality = this.calculateResultQuality(b);

      // 最后按架构版本排序（v2.0优先）
      const aArchitecture = a.architectureVersion === '2.0' ? 1 : 0;
      const bArchitecture = b.architectureVersion === '2.0' ? 1 : 0;

      const aScore = aHasDetails + aQuality.score / 10 + aArchitecture;
      const bScore = bHasDetails + bQuality.score / 10 + bArchitecture;

      return bScore - aScore;
    });
  }

  /**
   * 🆕 计算结果质量
   */
  calculateResultQuality(result) {
    let score = 0;
    const indicators = [];
    
    // 基础信息完整性
    if (result.title && result.title.length > 5) {
      score += 20;
      indicators.push('title');
    }
    if (result.subtitle && result.subtitle.length > 10) {
      score += 15;
      indicators.push('subtitle');
    }
    if (result.url && result.url.startsWith('https://')) {
      score += 10;
      indicators.push('secure_url');
    }
    
    // 源站信誉
    if (this.supportedExtractionSources.includes(result.source)) {
      score += 30;
      indicators.push('supported_source');
    }
    
    // 时效性
    if (result.timestamp && (Date.now() - result.timestamp) < 86400000) {
      score += 25;
      indicators.push('recent');
    }
    
    // 🆕 新架构质量指标
    if (result.architectureVersion === '2.0') {
      score += 10;
      indicators.push('v2_architecture');
    }
    
    if (result.enhancedMetadata) {
      score += 15;
      indicators.push('enhanced_metadata');
    }
    
    if (result.qualityIndicators) {
      score += result.qualityIndicators.score || 0;
      indicators.push('quality_indicators');
    }
    
    if (result.extractionPriority && result.extractionPriority.level === 'high') {
      score += 20;
      indicators.push('high_priority');
    }
    
    return {
      score: Math.min(score, 100),
      indicators,
      level: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low'
    };
  }

  /**
   * 🆕 渲染质量指示器
   */
  renderQualityIndicators() {
    const total = this.qualityMetrics.highQuality + this.qualityMetrics.mediumQuality + this.qualityMetrics.lowQuality;
    if (total === 0) return '';

    const highPercent = Math.round((this.qualityMetrics.highQuality / total) * 100);
    const mediumPercent = Math.round((this.qualityMetrics.mediumQuality / total) * 100);

    return `
      <div class="quality-indicators">
        <span class="quality-label">质量:</span>
        <span class="quality-high" title="高质量结果">${this.qualityMetrics.highQuality} (${highPercent}%)</span>
        <span class="quality-medium" title="中等质量结果">${this.qualityMetrics.mediumQuality} (${mediumPercent}%)</span>
        <span class="quality-low" title="低质量结果">${this.qualityMetrics.lowQuality}</span>
      </div>
    `;
  }

  /**
   * 🆕 渲染架构指示器
   */
  renderArchitectureIndicators() {
    if (this.qualityMetrics.v2Compatible === 0) return '';

    return `
      <div class="architecture-indicators">
        <span class="arch-label">架构:</span>
        <span class="arch-v2" title="新架构v2.0结果">v${this.version}: ${this.qualityMetrics.v2Compatible}</span>
        ${this.qualityMetrics.enhancedMetadata > 0 ? `
          <span class="arch-enhanced" title="增强元数据">增强: ${this.qualityMetrics.enhancedMetadata}</span>
        ` : ''}
      </div>
    `;
  }

  /**
   * 🆕 渲染架构增强信息面板
   */
  renderArchitectureEnhancementsPanel(container, stats) {
    if (stats.v2Results === 0) return;

    const enhancementsPanel = document.createElement('div');
    enhancementsPanel.className = 'architecture-enhancements-panel';
    enhancementsPanel.innerHTML = `
      <div class="enhancements-header">
        <h4>🏗️ 架构增强 v${this.version}</h4>
        <button class="toggle-enhancements" onclick="this.parentElement.parentElement.classList.toggle('collapsed')">
          <span class="toggle-icon">−</span>
        </button>
      </div>
      <div class="enhancements-content">
        <div class="enhancement-stats">
          <div class="stat-item">
            <span class="stat-label">v2.0结果:</span>
            <span class="stat-value">${stats.v2Results}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">统一结构:</span>
            <span class="stat-value">${stats.unifiedStructureResults}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">模块化解析:</span>
            <span class="stat-value">${stats.modularParserResults}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">增强元数据:</span>
            <span class="stat-value">${stats.enhancedMetadataResults}</span>
          </div>
        </div>
        
        <div class="enhancement-features">
          <div class="feature-badge ${this.architectureFeatures.unifiedDataStructure ? 'active' : ''}">
            统一数据结构
          </div>
          <div class="feature-badge ${this.architectureFeatures.enhancedErrorHandling ? 'active' : ''}">
            增强错误处理
          </div>
          <div class="feature-badge ${this.architectureFeatures.detailExtractionIntegration ? 'active' : ''}">
            详情提取集成
          </div>
          <div class="feature-badge ${this.architectureFeatures.performanceMonitoring ? 'active' : ''}">
            性能监控
          </div>
        </div>
      </div>
    `;

    container.insertBefore(enhancementsPanel, container.firstChild);
  }

  /**
   * 创建搜索结果HTML - 增强新架构支持
   */
  createResultHTML(result, config) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    const isUnavailable = this.isResultUnavailable(result);
    const supportsDetailExtraction = this.shouldExtractDetail(result);
    const hasDetailExtracted = this.hasDetailExtracted(result);
    const isDetailExpanded = this.detailDisplayStates.get(result.id) || false;
    
    // 🆕 质量分析
    const qualityAnalysis = this.calculateResultQuality(result);
    
    // 状态指示器HTML - 增强新架构支持
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
      
      // 🆕 新架构状态信息
      if (result.architectureVersion) {
        statusDetails.push(`v${result.architectureVersion}`);
      }
      if (result.parser) {
        statusDetails.push(`解析器: ${result.parser}`);
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
          ${result.architectureVersion === '2.0' ? '<span class="arch-badge">v2.0</span>' : ''}
        </div>
        ${unavailableReasonHTML}
      `;
    }
    
    // 🆕 质量指示器
    const qualityIndicator = `
      <div class="quality-indicator ${qualityAnalysis.level}" title="质量评分: ${qualityAnalysis.score}/100">
        <span class="quality-icon">${this.getQualityIcon(qualityAnalysis.level)}</span>
        <span class="quality-score">${qualityAnalysis.score}</span>
      </div>
    `;
    
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

    // 详情提取按钮 - 增强新架构支持
    const detailExtractionButtonHTML = supportsDetailExtraction && !isUnavailable && config.enableDetailExtraction ? `
      <button class="action-btn detail-btn ${hasDetailExtracted ? 'extracted' : ''}" 
              data-action="extractDetail" 
              data-result-id="${result.id}" 
              title="${hasDetailExtracted ? '重新提取详情' : '提取详情信息'}">
        <span class="btn-icon">${hasDetailExtracted ? '🔄' : '📋'}</span>
        <span class="btn-text">${hasDetailExtracted ? '重新提取' : '详情'}</span>
      </button>
    ` : '';
    
    // 🆕 详情显示切换按钮
    const detailToggleButtonHTML = hasDetailExtracted ? `
      <button class="action-btn toggle-detail-btn ${isDetailExpanded ? 'expanded' : ''}" 
              data-action="toggleDetail" 
              data-result-id="${result.id}" 
              title="${isDetailExpanded ? '收起详情' : '展开详情'}">
        <span class="btn-icon">${isDetailExpanded ? '🔼' : '🔽'}</span>
        <span class="btn-text">${isDetailExpanded ? '收起' : '展开'}</span>
      </button>
    ` : '';
    
    // 🆕 渲染详情内容
    const detailContentHTML = hasDetailExtracted && isDetailExpanded ? 
      this.renderDetailContent(result) : '';
    
    return `
      <div class="result-item ${isUnavailable ? 'result-unavailable' : ''} ${qualityAnalysis.level}-quality" 
           data-id="${result.id}" 
           data-result-id="${result.id}"
           data-architecture="${result.architectureVersion || '1.0'}"
           data-quality="${qualityAnalysis.level}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
          ${qualityIndicator}
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
            ${this.renderArchitectureMetadata(result)}
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
          ${detailToggleButtonHTML}
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
        
        <!-- 详情显示容器 - 增强新架构支持 -->
        <div class="result-detail-container ${isDetailExpanded ? 'expanded' : ''}" 
             style="display: ${isDetailExpanded ? 'block' : 'none'};">
          ${detailContentHTML}
        </div>
      </div>
    `;
  }

  /**
   * 🆕 渲染架构元数据
   */
  renderArchitectureMetadata(result) {
    const metadata = [];
    
    if (result.architectureVersion === '2.0') {
      metadata.push('<span class="arch-meta v2" title="新架构v2.0">v2.0</span>');
    }
    
    if (result.enhancedMetadata) {
      metadata.push('<span class="arch-meta enhanced" title="增强元数据">增强</span>');
    }
    
    if (result.parser) {
      metadata.push(`<span class="arch-meta parser" title="解析器: ${result.parser}">${result.parser}</span>`);
    }
    
    if (result.dataStructureVersion === '2.0') {
      metadata.push('<span class="arch-meta unified" title="统一数据结构">统一</span>');
    }
    
    return metadata.length > 0 ? `<div class="architecture-metadata">${metadata.join('')}</div>` : '';
  }

  /**
   * 🆕 渲染详情内容
   */
  renderDetailContent(result) {
    if (!this.hasDetailExtracted(result)) return '';

    const detail = result.detailInfo || result;
    
    return `
      <div class="detail-content v2">
        <div class="detail-header">
          <h4 class="detail-title">${escapeHtml(detail.title || result.title)}</h4>
          <div class="detail-meta">
            <span class="extraction-status ${detail.extractionStatus}">${this.getExtractionStatusText(detail.extractionStatus)}</span>
            <span class="extraction-time">${formatRelativeTime(detail.extractedAt)}</span>
            ${detail.fromCache ? '<span class="cache-indicator">缓存</span>' : ''}
            ${detail.architectureVersion ? `<span class="arch-indicator">v${detail.architectureVersion}</span>` : ''}
          </div>
        </div>

        <div class="detail-body">
          ${this.renderBasicInfo(detail)}
          ${this.renderMediaContent(detail)}
          ${this.renderDownloadLinks(detail)}
          ${this.renderTechnicalInfo(detail)}
          ${this.renderArchitectureInfo(detail)}
        </div>
      </div>
    `;
  }

  /**
   * 🆕 渲染基础信息
   */
  renderBasicInfo(detail) {
    const fields = [];
    
    if (detail.code) {
      fields.push({ label: '番号', value: detail.code, class: 'detail-code' });
    }
    if (detail.releaseDate) {
      fields.push({ label: '发布日期', value: detail.releaseDate, class: 'detail-date' });
    }
    if (detail.duration) {
      fields.push({ label: '时长', value: detail.duration, class: 'detail-duration' });
    }
    if (detail.studio) {
      fields.push({ label: '制作商', value: detail.studio, class: 'detail-studio' });
    }
    if (detail.director) {
      fields.push({ label: '导演', value: detail.director, class: 'detail-director' });
    }
    if (detail.series) {
      fields.push({ label: '系列', value: detail.series, class: 'detail-series' });
    }
    
    if (fields.length === 0) return '';

    return `
      <div class="detail-section basic-info">
        <h5>基础信息</h5>
        <div class="info-grid">
          ${fields.map(field => `
            <div class="info-item ${field.class}">
              <span class="info-label">${field.label}:</span>
              <span class="info-value">${escapeHtml(field.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 🆕 渲染媒体内容
   */
  renderMediaContent(detail) {
    const sections = [];
    
    // 封面图片
    if (detail.cover || detail.coverImage) {
      sections.push(`
        <div class="media-section cover-section">
          <h6>封面</h6>
          <div class="cover-image">
            <img src="${escapeHtml(detail.cover || detail.coverImage)}" 
                 alt="封面" 
                 loading="lazy"
                 onerror="this.style.display='none'">
          </div>
        </div>
      `);
    }
    
    // 截图
    if (detail.screenshots && Array.isArray(detail.screenshots) && detail.screenshots.length > 0) {
      sections.push(`
        <div class="media-section screenshots-section">
          <h6>截图 (${detail.screenshots.length})</h6>
          <div class="screenshots-grid">
            ${detail.screenshots.slice(0, 6).map((screenshot, index) => `
              <div class="screenshot-item">
                <img src="${escapeHtml(screenshot.url || screenshot)}" 
                     alt="截图 ${index + 1}" 
                     loading="lazy"
                     onclick="window.searchConfigManager?.showImagePreview('${escapeHtml(screenshot.url || screenshot)}')"
                     onerror="this.parentElement.style.display='none'">
              </div>
            `).join('')}
            ${detail.screenshots.length > 6 ? `
              <div class="screenshot-more">+${detail.screenshots.length - 6} 更多</div>
            ` : ''}
          </div>
        </div>
      `);
    }
    
    // 演员信息
    if (detail.actors || detail.actresses) {
      const actors = detail.actors || detail.actresses || [];
      if (Array.isArray(actors) && actors.length > 0) {
        sections.push(`
          <div class="media-section actors-section">
            <h6>演员 (${actors.length})</h6>
            <div class="actors-list">
              ${actors.slice(0, 8).map(actor => `
                <span class="actor-name" onclick="window.unifiedSearchManager?.searchByActress('${escapeHtml(actor.name || actor)}')">${escapeHtml(actor.name || actor)}</span>
              `).join('')}
              ${actors.length > 8 ? `<span class="actor-more">+${actors.length - 8} 更多</span>` : ''}
            </div>
          </div>
        `);
      }
    }
    
    return sections.length > 0 ? `
      <div class="detail-section media-content">
        <h5>媒体内容</h5>
        ${sections.join('')}
      </div>
    ` : '';
  }

  /**
   * 🆕 渲染下载链接
   */
  renderDownloadLinks(detail) {
    const sections = [];
    
    // 下载链接
    if (detail.downloadLinks && Array.isArray(detail.downloadLinks) && detail.downloadLinks.length > 0) {
      sections.push(`
        <div class="links-section download-links">
          <h6>下载链接 (${detail.downloadLinks.length})</h6>
          <div class="links-list">
            ${detail.downloadLinks.map((link, index) => `
              <div class="link-item download-link">
                <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                  <span class="link-name">${escapeHtml(link.name || `下载链接 ${index + 1}`)}</span>
                  ${link.size ? `<span class="link-size">${formatFileSize(link.size)}</span>` : ''}
                  ${link.quality ? `<span class="link-quality">${escapeHtml(link.quality)}</span>` : ''}
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }
    
    // 磁力链接
    if (detail.magnetLinks && Array.isArray(detail.magnetLinks) && detail.magnetLinks.length > 0) {
      sections.push(`
        <div class="links-section magnet-links">
          <h6>磁力链接 (${detail.magnetLinks.length})</h6>
          <div class="links-list">
            ${detail.magnetLinks.map((link, index) => `
              <div class="link-item magnet-link">
                <a href="${escapeHtml(link.magnet || link.url)}" target="_blank">
                  <span class="link-name">${escapeHtml(link.name || `磁力链接 ${index + 1}`)}</span>
                  ${link.size ? `<span class="link-size">${formatFileSize(link.size)}</span>` : ''}
                  ${link.seeders ? `<span class="link-seeders">${link.seeders} 种子</span>` : ''}
                  ${link.leechers ? `<span class="link-leechers">${link.leechers} 下载</span>` : ''}
                </a>
                <button class="copy-magnet-btn" onclick="navigator.clipboard.writeText('${escapeHtml(link.magnet || link.url)}')" title="复制磁力链接">
                  📋
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }
    
    // 🆕 新架构统一链接格式
    if (detail.links && Array.isArray(detail.links) && detail.links.length > 0) {
      const downloadLinks = detail.links.filter(link => link.type === 'download' || link.type === 'http');
      const magnetLinks = detail.links.filter(link => link.type === 'magnet');
      
      if (downloadLinks.length > 0) {
        sections.push(`
          <div class="links-section unified-download-links">
            <h6>下载资源 (${downloadLinks.length})</h6>
            <div class="links-list">
              ${downloadLinks.map((link, index) => `
                <div class="link-item unified-link download">
                  <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
                    <span class="link-type">${this.getLinkTypeIcon(link.type)}</span>
                    <span class="link-name">${escapeHtml(link.name || `资源 ${index + 1}`)}</span>
                    ${link.size ? `<span class="link-size">${formatFileSize(link.size)}</span>` : ''}
                    ${link.quality ? `<span class="link-quality">${escapeHtml(link.quality)}</span>` : ''}
                  </a>
                </div>
              `).join('')}
            </div>
          </div>
        `);
      }
      
      if (magnetLinks.length > 0) {
        sections.push(`
          <div class="links-section unified-magnet-links">
            <h6>磁力资源 (${magnetLinks.length})</h6>
            <div class="links-list">
              ${magnetLinks.map((link, index) => `
                <div class="link-item unified-link magnet">
                  <a href="${escapeHtml(link.url)}" target="_blank">
                    <span class="link-type">🧲</span>
                    <span class="link-name">${escapeHtml(link.name || `磁力 ${index + 1}`)}</span>
                    ${link.size ? `<span class="link-size">${formatFileSize(link.size)}</span>` : ''}
                  </a>
                  <button class="copy-magnet-btn" onclick="navigator.clipboard.writeText('${escapeHtml(link.url)}')" title="复制磁力链接">
                    📋
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        `);
      }
    }
    
    return sections.length > 0 ? `
      <div class="detail-section download-content">
        <h5>下载资源</h5>
        ${sections.join('')}
      </div>
    ` : '';
  }

  /**
   * 🆕 渲染技术信息
   */
  renderTechnicalInfo(detail) {
    const fields = [];
    
    if (detail.quality) {
      fields.push({ label: '画质', value: detail.quality, class: 'tech-quality' });
    }
    if (detail.resolution) {
      fields.push({ label: '分辨率', value: detail.resolution, class: 'tech-resolution' });
    }
    if (detail.fileSize) {
      fields.push({ label: '文件大小', value: detail.fileSize, class: 'tech-filesize' });
    }
    if (detail.rating && detail.rating > 0) {
      fields.push({ label: '评分', value: `${detail.rating}/10`, class: 'tech-rating' });
    }
    
    // 标签
    const tags = detail.tags || detail.genres || [];
    if (Array.isArray(tags) && tags.length > 0) {
      fields.push({ 
        label: '标签', 
        value: tags.slice(0, 8).map(tag => `<span class="tag">${escapeHtml(tag.name || tag)}</span>`).join(''),
        class: 'tech-tags',
        isHTML: true
      });
    }
    
    if (fields.length === 0) return '';

    return `
      <div class="detail-section technical-info">
        <h5>技术信息</h5>
        <div class="tech-grid">
          ${fields.map(field => `
            <div class="tech-item ${field.class}">
              <span class="tech-label">${field.label}:</span>
              <span class="tech-value">${field.isHTML ? field.value : escapeHtml(field.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 🆕 渲染架构信息
   */
  renderArchitectureInfo(detail) {
    const info = [];
    
    if (detail.extractionTime) {
      info.push({ label: '提取用时', value: `${detail.extractionTime}ms` });
    }
    if (detail.retryCount > 0) {
      info.push({ label: '重试次数', value: detail.retryCount });
    }
    if (detail.parser || detail.sourceType) {
      info.push({ label: '解析器', value: detail.parser || detail.sourceType });
    }
    if (detail.dataStructureVersion) {
      info.push({ label: '数据版本', value: detail.dataStructureVersion });
    }
    if (detail.architectureVersion) {
      info.push({ label: '架构版本', value: detail.architectureVersion });
    }
    
    if (info.length === 0) return '';

    return `
      <div class="detail-section architecture-info">
        <h5>架构信息</h5>
        <div class="arch-info-grid">
          ${info.map(item => `
            <div class="arch-info-item">
              <span class="arch-info-label">${item.label}:</span>
              <span class="arch-info-value">${escapeHtml(item.value)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 🆕 获取链接类型图标
   */
  getLinkTypeIcon(type) {
    const icons = {
      'download': '⬇️',
      'http': '🌐',
      'https': '🔒',
      'magnet': '🧲',
      'torrent': '📁'
    };
    return icons[type] || '🔗';
  }

  /**
   * 🆕 获取质量图标
   */
  getQualityIcon(level) {
    const icons = {
      'high': '🟢',
      'medium': '🟡',
      'low': '🔴'
    };
    return icons[level] || '⚪';
  }

  /**
   * 🆕 获取提取状态文本
   */
  getExtractionStatusText(status) {
    const statusTexts = {
      [DETAIL_EXTRACTION_STATUS.SUCCESS]: '提取成功',
      [DETAIL_EXTRACTION_STATUS.CACHED]: '缓存数据',
      [DETAIL_EXTRACTION_STATUS.PARTIAL]: '部分提取',
      [DETAIL_EXTRACTION_STATUS.ERROR]: '提取失败',
      [DETAIL_EXTRACTION_STATUS.TIMEOUT]: '提取超时'
    };
    return statusTexts[status] || '未知状态';
  }

  /**
   * 绑定结果事件 - 增强新架构支持
   */
  bindResultsEvents() {
    // 使用事件委托处理结果点击事件
    document.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const url = button.dataset.url;
      const resultId = button.dataset.resultId;
      const source = button.dataset.source;

      // 触发相应的事件，让主组件处理
      switch (action) {
        case 'visit':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'visit', url, source }
          }));
          break;
        case 'favorite':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'favorite', resultId }
          }));
          break;
        case 'copy':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'copy', url }
          }));
          break;
        case 'extractDetail':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'extractDetail', resultId }
          }));
          break;
        case 'checkStatus':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'checkStatus', source, resultId }
          }));
          break;
        case 'viewDetails':
          document.dispatchEvent(new CustomEvent('resultActionRequested', {
            detail: { action: 'viewDetails', resultId }
          }));
          break;
        // 🆕 新架构操作
        case 'toggleDetail':
          this.toggleDetailDisplay(resultId);
          break;
      }
    });

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateFavoriteButtons();
    });

    // 🆕 监听详情提取完成事件
    document.addEventListener('detailExtractionCompleted', (e) => {
      this.handleDetailExtractionCompleted(e.detail);
    });
  }

  /**
   * 🆕 处理详情提取完成
   */
  handleDetailExtractionCompleted(detail) {
    const { resultId, detailInfo, extractionStatus } = detail;
    
    // 更新详情提取状态
    this.detailExtractionStates.set(resultId, extractionStatus);
    
    // 如果提取成功，更新结果数据
    if (extractionStatus === DETAIL_EXTRACTION_STATUS.SUCCESS && detailInfo) {
      const result = this.currentResults.find(r => r.id === resultId);
      if (result) {
        // 合并详情信息到结果中
        Object.assign(result, detailInfo);
        result.hasDetailExtracted = true;
        result.detailInfo = detailInfo;
        
        // 重新渲染该结果项
        this.rerenderResultItem(resultId);
      }
    }
    
    // 更新按钮状态
    this.updateDetailExtractionButtons(resultId, extractionStatus);
  }

  /**
   * 🆕 重新渲染结果项
   */
  rerenderResultItem(resultId) {
    const resultElement = document.querySelector(`[data-result-id="${resultId}"]`);
    const result = this.currentResults.find(r => r.id === resultId);
    
    if (resultElement && result) {
      const updatedHTML = this.createResultHTML(result, this.config);
      resultElement.outerHTML = updatedHTML;
    }
  }

  /**
   * 🆕 切换详情显示
   */
  toggleDetailDisplay(resultId) {
    const isExpanded = this.detailDisplayStates.get(resultId) || false;
    this.detailDisplayStates.set(resultId, !isExpanded);
    
    // 更新UI
    const resultElement = document.querySelector(`[data-result-id="${resultId}"]`);
    if (resultElement) {
      const detailContainer = resultElement.querySelector('.result-detail-container');
      const toggleButton = resultElement.querySelector('[data-action="toggleDetail"]');
      
      if (detailContainer) {
        if (!isExpanded) {
          // 展开详情
          detailContainer.style.display = 'block';
          detailContainer.classList.add('expanded');
          
          // 如果还没有详情内容，渲染它
          if (!detailContainer.innerHTML.trim()) {
            const result = this.currentResults.find(r => r.id === resultId);
            if (result && this.hasDetailExtracted(result)) {
              detailContainer.innerHTML = this.renderDetailContent(result);
            }
          }
        } else {
          // 收起详情
          detailContainer.style.display = 'none';
          detailContainer.classList.remove('expanded');
        }
      }
      
      if (toggleButton) {
        const icon = toggleButton.querySelector('.btn-icon');
        const text = toggleButton.querySelector('.btn-text');
        if (icon) icon.textContent = !isExpanded ? '🔼' : '🔽';
        if (text) text.textContent = !isExpanded ? '收起' : '展开';
        toggleButton.classList.toggle('expanded', !isExpanded);
      }
    }
  }

  /**
   * 🆕 更新详情提取按钮状态
   */
  updateDetailExtractionButtonStates(enabled) {
    const detailButtons = document.querySelectorAll('.detail-btn');
    detailButtons.forEach(btn => {
      btn.disabled = !enabled;
      if (!enabled) {
        btn.title = '详情提取功能已禁用';
      }
    });
  }

  /**
   * 🆕 更新单个详情提取按钮
   */
  updateDetailExtractionButtons(resultId, status) {
    const resultElement = document.querySelector(`[data-result-id="${resultId}"]`);
    if (!resultElement) return;
    
    const detailButton = resultElement.querySelector('.detail-btn');
    if (detailButton) {
      const icon = detailButton.querySelector('.btn-icon');
      const text = detailButton.querySelector('.btn-text');
      
      switch (status) {
        case DETAIL_EXTRACTION_STATUS.SUCCESS:
          detailButton.classList.add('extracted');
          if (icon) icon.textContent = '✅';
          if (text) text.textContent = '已提取';
          detailButton.title = '详情提取成功，点击重新提取';
          break;
        case DETAIL_EXTRACTION_STATUS.ERROR:
          detailButton.classList.add('error');
          if (icon) icon.textContent = '❌';
          if (text) text.textContent = '失败';
          detailButton.title = '详情提取失败，点击重试';
          break;
        case DETAIL_EXTRACTION_STATUS.TIMEOUT:
          detailButton.classList.add('timeout');
          if (icon) icon.textContent = '⏱️';
          if (text) text.textContent = '超时';
          detailButton.title = '详情提取超时，点击重试';
          break;
        default:
          detailButton.classList.remove('extracted', 'error', 'timeout');
          if (icon) icon.textContent = '📋';
          if (text) text.textContent = '详情';
          detailButton.title = '提取详情信息';
      }
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
    
    // 🆕 清理新架构状态
    this.detailDisplayStates.clear();
    this.detailExtractionStates.clear();
    this.resetQualityMetrics();

    // 触发结果清空事件
    document.dispatchEvent(new CustomEvent('searchResultsCleared'));
  }

  /**
   * 🆕 重置质量指标
   */
  resetQualityMetrics() {
    this.qualityMetrics = {
      highQuality: 0,
      mediumQuality: 0,
      lowQuality: 0,
      withDetails: 0,
      supportedSources: 0,
      v2Compatible: 0,
      enhancedMetadata: 0
    };
  }

  /**
   * 导出搜索结果 - 增强新架构支持
   */
  async exportResults(extractionStats = {}) {
    if (this.currentResults.length === 0) {
      return { success: false, error: '没有搜索结果可以导出' };
    }

    try {
      const data = {
        results: this.currentResults,
        exportTime: new Date().toISOString(),
        version: this.version,
        extractionStats,
        // 🆕 新架构导出数据
        architectureInfo: {
          version: this.version,
          features: this.architectureFeatures,
          dataStructureVersion: this.dataStructureVersion
        },
        qualityMetrics: this.qualityMetrics,
        renderingStats: this.renderingStats,
        detailExtractionStates: Object.fromEntries(this.detailExtractionStates),
        // 统计信息
        summary: {
          totalResults: this.currentResults.length,
          highQualityResults: this.qualityMetrics.highQuality,
          withDetailExtraction: this.qualityMetrics.withDetails,
          v2CompatibleResults: this.qualityMetrics.v2Compatible,
          supportedSources: this.qualityMetrics.supportedSources
        }
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-v${this.version}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true };
    } catch (error) {
      console.error('导出搜索结果失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新单个结果的状态
   */
  updateResultStatus(resultId, statusData) {
    const resultIndex = this.currentResults.findIndex(r => r.id === resultId);
    if (resultIndex === -1) return false;

    // 更新结果数据
    this.currentResults[resultIndex] = {
      ...this.currentResults[resultIndex],
      ...statusData
    };

    // 重新渲染该结果项
    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (resultElement) {
      const updatedHTML = this.createResultHTML(this.currentResults[resultIndex], {
        enableDetailExtraction: this.config.enableDetailExtraction || true
      });
      resultElement.outerHTML = updatedHTML;
    }

    return true;
  }

  /**
   * 获取当前结果
   */
  getCurrentResults() {
    return [...this.currentResults];
  }

  /**
   * 查找结果
   */
  findResult(resultId) {
    return this.currentResults.find(r => r.id === resultId);
  }

  /**
   * 获取结果统计 - 增强新架构支持
   */
  getResultsStats() {
    const statusStats = this.calculateStatusStats(this.currentResults);
    const architectureStats = this.calculateArchitectureStats(this.currentResults);
    
    return {
      total: this.currentResults.length,
      statusStats,
      qualityMetrics: this.qualityMetrics,
      architectureStats,
      renderingStats: this.renderingStats,
      sources: [...new Set(this.currentResults.map(r => r.source))],
      timeRange: this.currentResults.length > 0 ? {
        oldest: Math.min(...this.currentResults.map(r => r.timestamp)),
        newest: Math.max(...this.currentResults.map(r => r.timestamp))
      } : null,
      // 🆕 新架构统计
      dataStructureVersions: this.getDataStructureVersionStats(),
      extractionCapabilities: this.getExtractionCapabilitiesStats(),
      performanceMetrics: this.getPerformanceMetrics()
    };
  }

  /**
   * 🆕 获取数据结构版本统计
   */
  getDataStructureVersionStats() {
    const versions = {};
    this.currentResults.forEach(result => {
      const version = result.dataStructureVersion || 'unknown';
      versions[version] = (versions[version] || 0) + 1;
    });
    return versions;
  }

  /**
   * 🆕 获取提取能力统计
   */
  getExtractionCapabilitiesStats() {
    return {
      supportedSources: this.qualityMetrics.supportedSources,
      extractedResults: this.qualityMetrics.withDetails,
      extractionRate: this.qualityMetrics.supportedSources > 0 ? 
        (this.qualityMetrics.withDetails / this.qualityMetrics.supportedSources) * 100 : 0
    };
  }

  /**
   * 🆕 获取性能指标
   */
  getPerformanceMetrics() {
    return {
      ...this.renderingStats,
      averageResultsPerRender: this.renderingStats.totalRenders > 0 ? 
        this.currentResults.length / this.renderingStats.totalRenders : 0
    };
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
   * 判断是否应该提取详情 - 增强新架构支持
   */
  shouldExtractDetail(result) {
    if (!result || !result.source) return false;
    
    // 检查是否在支持的源类型中
    return this.supportedExtractionSources.includes(result.source) || 
           (APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES && 
            APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES.includes(result.source));
  }

  /**
   * 🆕 判断是否已提取详情
   */
  hasDetailExtracted(result) {
    return result.hasDetailExtracted || 
           result.detailInfo || 
           result.extractionStatus === DETAIL_EXTRACTION_STATUS.SUCCESS ||
           result.extractionStatus === DETAIL_EXTRACTION_STATUS.CACHED;
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
      [APP_CONSTANTS.SOURCE_STATUS.UNAVAILABLE]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.TIMEOUT]: '⏱️',
      [APP_CONSTANTS.SOURCE_STATUS.ERROR]: '⚠️',
      [APP_CONSTANTS.SOURCE_STATUS.CHECKING]: '🔄',
      [APP_CONSTANTS.SOURCE_STATUS.UNKNOWN]: '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 设置搜索状态显示
   */
  showSearchStatus(keyword) {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'block';
      statusIndicator.innerHTML = `
        <div class="status-check-progress">
          <div class="progress-spinner"></div>
          <span>检查搜索源状态中...</span>
          <small>正在验证 "${escapeHtml(keyword)}" 的内容匹配</small>
          <div class="architecture-info">v${this.version} 架构检查</div>
        </div>
      `;
    }
  }

  /**
   * 隐藏搜索状态显示
   */
  hideSearchStatus() {
    const statusIndicator = document.getElementById('searchStatusIndicator');
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }
  }

  // ===================== 🆕 性能监控方法 =====================

  /**
   * 🆕 记录渲染性能
   */
  recordRenderPerformance(entry) {
    const renderTime = entry.duration;
    this.renderingStats.renderHistory.push({
      timestamp: Date.now(),
      duration: renderTime,
      entryType: entry.entryType
    });

    // 保持最近50次记录
    if (this.renderingStats.renderHistory.length > 50) {
      this.renderingStats.renderHistory.shift();
    }
  }

  /**
   * 🆕 更新渲染统计
   */
  updateRenderingStats(renderTime, resultCount) {
    this.renderingStats.totalRenders++;
    this.renderingStats.lastRenderTime = renderTime;
    
    // 计算平均渲染时间
    const totalTime = (this.renderingStats.averageRenderTime * (this.renderingStats.totalRenders - 1)) + renderTime;
    this.renderingStats.averageRenderTime = totalTime / this.renderingStats.totalRenders;
    
    console.log(`渲染性能 (v${this.version}): ${Math.round(renderTime)}ms, ${resultCount}个结果`);
  }

  /**
   * 🆕 获取渲染性能报告
   */
  getRenderingPerformanceReport() {
    return {
      ...this.renderingStats,
      performanceGrade: this.calculatePerformanceGrade(),
      recommendations: this.getPerformanceRecommendations()
    };
  }

  /**
   * 🆕 计算性能等级
   */
  calculatePerformanceGrade() {
    const avgTime = this.renderingStats.averageRenderTime;
    
    if (avgTime < 100) return 'excellent';
    if (avgTime < 300) return 'good';
    if (avgTime < 800) return 'fair';
    return 'poor';
  }

  /**
   * 🆕 获取性能建议
   */
  getPerformanceRecommendations() {
    const recommendations = [];
    
    if (this.renderingStats.averageRenderTime > 500) {
      recommendations.push('考虑减少同时显示的结果数量');
    }
    
    if (this.qualityMetrics.enhancedMetadata / this.currentResults.length > 0.8) {
      recommendations.push('大量增强元数据可能影响渲染性能');
    }
    
    if (this.renderingStats.totalRenders > 10 && this.renderingStats.averageRenderTime > 300) {
      recommendations.push('考虑启用虚拟滚动或分页显示');
    }
    
    return recommendations;
  }

  /**
   * 清理资源 - 增强新架构支持
   */
  cleanup() {
    this.currentResults = [];
    
    // 🆕 清理新架构数据
    this.detailDisplayStates.clear();
    this.detailExtractionStates.clear();
    this.resetQualityMetrics();
    
    // 清理性能监控
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    this.renderingStats = {
      totalRenders: 0,
      averageRenderTime: 0,
      lastRenderTime: 0,
      renderHistory: []
    };
    
    console.log(`搜索结果渲染器资源已清理 (v${this.version})`);
  }
}

export default SearchResultsRenderer;