// src/components/detail-card.js - 适配后端架构升级v2.0.0：支持模块化解析器和动态配置管理
// 版本 2.0.0 - 完全适配新架构的详情卡片组件，专注于视觉展现和交互逻辑

import { escapeHtml, formatRelativeTime, formatFileSize } from '../utils/format.js';
import { showToast } from '../utils/dom.js';
import authManager from '../services/auth.js';
import detailAPIService from '../services/detail-api.js';
import detailConfigAPI from '../services/detail-config-api.js';
import favoritesManager from './favorites.js';
import apiService from '../services/api.js';
import { ARCHITECTURE_FEATURES, SERVICE_STATUS } from '../core/detail-config.js';

export class DetailCardManager {
  constructor() {
    this.isInitialized = false;
    this.activeCards = new Map();
    this.cardInstances = new Map();
    this.version = '2.0.0'; // 新架构版本
    
    // 新架构配置管理
    this.configManager = null;
    this.configCache = null;
    this.configLastUpdate = 0;
    this.configCacheExpiration = 5 * 60 * 1000; // 5分钟配置缓存
    
    // 新架构服务状态
    this.serviceHealth = {
      status: SERVICE_STATUS.HEALTHY,
      lastCheck: 0,
      features: Object.values(ARCHITECTURE_FEATURES)
    };
    
    // 性能监控 - 增强版本
    this.performanceMetrics = {
      renderTime: [],
      interactionCount: 0,
      errorCount: 0,
      configFetches: 0,
      cacheHits: 0,
      // 新架构性能指标
      parserPerformance: new Map(),
      dataStructureVersion: '2.0',
      architectureMetrics: {
        totalCards: 0,
        modularParserCards: 0,
        unifiedDataCards: 0
      }
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      console.log('初始化详情卡片管理器 (新架构 v2.0.0)');
      
      // 初始化配置服务连接
      await this.initConfigService();
      
      // 检查服务健康状态
      await this.checkServiceHealth();
      
      // 绑定全局事件
      this.bindGlobalEvents();
      
      // 初始化性能监控
      this.initPerformanceMonitoring();
      
      // 启动配置自动更新
      this.startConfigAutoUpdate();
      
      this.isInitialized = true;
      console.log('详情卡片管理器初始化完成 (新架构 v2.0.0)');
      console.log('支持的新架构特性:', this.serviceHealth.features);
      
    } catch (error) {
      console.error('详情卡片管理器初始化失败:', error);
      // 使用降级模式
      await this.initFallbackMode();
      throw error;
    }
  }

  /**
   * 初始化配置服务连接 - 新架构核心功能
   */
  async initConfigService() {
    try {
      // 连接到新的配置API服务
      this.configManager = detailConfigAPI;
      
      // 获取初始配置
      const configData = await this.configManager.getUserConfig();
      this.updateConfigCache(configData);
      
      console.log('配置服务连接成功 (新架构)', {
        version: configData.serviceInfo?.version,
        architecture: configData.serviceInfo?.architecture,
        supportedSites: configData.supportedSites?.length || 0
      });
      
      this.performanceMetrics.configFetches++;
      
    } catch (error) {
      console.warn('配置服务连接失败，使用默认配置:', error);
      // 使用默认配置作为后备
      this.configCache = {
        config: await this.getDefaultConfig(),
        metadata: {
          architecture: 'modular_parsers',
          version: '2.0.0',
          isDefault: true
        }
      };
    }
  }

  /**
   * 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const healthCheck = await this.configManager.checkServiceHealth();
      this.serviceHealth = {
        ...this.serviceHealth,
        ...healthCheck,
        lastCheck: Date.now()
      };
      
      if (!healthCheck.healthy) {
        console.warn('详情提取服务健康检查失败:', healthCheck.error);
        this.serviceHealth.status = SERVICE_STATUS.DEGRADED;
      }
      
    } catch (error) {
      console.error('服务健康检查失败:', error);
      this.serviceHealth.status = SERVICE_STATUS.ERROR;
      this.serviceHealth.error = error.message;
    }
  }

  /**
   * 启动配置自动更新
   */
  startConfigAutoUpdate() {
    // 每5分钟检查配置更新
    setInterval(async () => {
      try {
        if (this.isConfigCacheExpired()) {
          await this.refreshConfig();
        }
      } catch (error) {
        console.warn('配置自动更新失败:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 获取有效配置 - 适配新架构动态配置
   */
  async getEffectiveConfig(overrides = {}) {
    try {
      // 检查缓存有效性
      if (this.isConfigCacheExpired()) {
        await this.refreshConfig();
      }
      
      const baseConfig = this.configCache?.config || await this.getDefaultConfig();
      const effectiveConfig = {
        ...baseConfig,
        ...overrides
      };
      
      this.performanceMetrics.cacheHits++;
      
      // 添加新架构标识
      effectiveConfig._architecture = 'modular_parsers';
      effectiveConfig._version = '2.0.0';
      effectiveConfig._configSource = this.configCache?.metadata?.isDefault ? 'default' : 'user';
      
      return effectiveConfig;
      
    } catch (error) {
      console.error('获取配置失败，使用默认配置:', error);
      return {
        ...(await this.getDefaultConfig()),
        ...overrides,
        _architecture: 'modular_parsers',
        _version: '2.0.0',
        _configSource: 'fallback'
      };
    }
  }

  /**
   * 渲染详情卡片到指定容器 - 适配新架构数据结构
   */
  async renderDetailCard(searchResult, detailInfo, container, options = {}) {
    try {
      const startTime = performance.now();
      
      const containerElement = typeof container === 'string' ? 
        document.querySelector(container) : container;
      
      if (!containerElement) {
        throw new Error('未找到指定的容器元素');
      }

      // 验证新架构数据结构
      const validatedDetailInfo = this.validateAndNormalizeDetailInfo(detailInfo);
      
      // 使用配置感知的方法生成HTML
      const cardHTML = await this.createDetailCardHTML(searchResult, validatedDetailInfo, options);
      
      if (options.append) {
        containerElement.insertAdjacentHTML('beforeend', cardHTML);
      } else {
        containerElement.innerHTML = cardHTML;
      }

      // 保存活动卡片数据
      this.activeCards.set(searchResult.url, {
        searchResult,
        detailInfo: validatedDetailInfo,
        container: containerElement,
        options
      });

      // 绑定卡片事件
      await this.bindCardEvents(searchResult.url);
      
      // 记录性能和架构指标
      const renderTime = performance.now() - startTime;
      this.recordPerformanceMetric('renderTime', renderTime);
      this.updateArchitectureMetrics(validatedDetailInfo);

      console.log(`详情卡片渲染完成 (新架构): ${validatedDetailInfo.title || searchResult.url} (${renderTime.toFixed(2)}ms)`);

    } catch (error) {
      console.error('渲染详情卡片失败:', error);
      this.performanceMetrics.errorCount++;
      throw error;
    }
  }

  /**
   * 验证和标准化详情信息 - 适配新架构ParsedData格式
   */
  validateAndNormalizeDetailInfo(detailInfo) {
    if (!detailInfo) {
      throw new Error('详情信息不能为空');
    }

    // 检查新架构数据结构版本
    const dataStructureVersion = detailInfo.dataStructureVersion || '2.0';
    const architecture = detailInfo.architecture || 'modular_parsers';
    
    console.log('验证详情信息数据结构:', {
      version: dataStructureVersion,
      architecture: architecture,
      hasTitle: !!detailInfo.title,
      hasCode: !!detailInfo.code,
      sourceType: detailInfo.sourceType
    });

    // 标准化数据结构 - 确保向后兼容
    const normalized = {
      // 基础信息
      title: detailInfo.title || '未知标题',
      code: detailInfo.code || '',
      sourceType: detailInfo.sourceType || 'generic',
      
      // URL信息 - 适配新架构字段
      detailUrl: detailInfo.detailUrl || detailInfo.detailPageUrl || detailInfo.url,
      searchUrl: detailInfo.searchUrl || detailInfo.originalUrl,
      
      // 媒体信息 - 统一字段名
      cover: detailInfo.cover || detailInfo.coverImage || '',
      coverImage: detailInfo.cover || detailInfo.coverImage || '', // 兼容性
      screenshots: Array.isArray(detailInfo.screenshots) ? detailInfo.screenshots : [],
      
      // 演员信息 - 支持actors和actresses字段
      actors: Array.isArray(detailInfo.actors) ? detailInfo.actors : 
              (Array.isArray(detailInfo.actresses) ? detailInfo.actresses : []),
      actresses: Array.isArray(detailInfo.actresses) ? detailInfo.actresses :
                 (Array.isArray(detailInfo.actors) ? detailInfo.actors : []),
      
      // 基本信息
      director: detailInfo.director || '',
      studio: detailInfo.studio || '',
      label: detailInfo.label || '',
      series: detailInfo.series || '',
      releaseDate: detailInfo.releaseDate || '',
      duration: detailInfo.duration || '',
      
      // 技术信息
      quality: detailInfo.quality || '',
      fileSize: detailInfo.fileSize || '',
      resolution: detailInfo.resolution || '',
      
      // 下载信息 - 适配新架构链接格式
      downloadLinks: this.normalizeDownloadLinks(detailInfo.downloadLinks || detailInfo.links),
      magnetLinks: this.normalizeMagnetLinks(detailInfo.magnetLinks || detailInfo.links),
      links: detailInfo.links || [], // 新架构统一链接格式
      
      // 内容信息
      description: detailInfo.description || '',
      tags: this.normalizeTags(detailInfo.tags || detailInfo.genres),
      genres: detailInfo.genres || detailInfo.tags || [],
      rating: typeof detailInfo.rating === 'number' ? detailInfo.rating : 0,
      
      // 提取元数据
      extractionStatus: detailInfo.extractionStatus || 'success',
      extractionTime: detailInfo.extractionTime || 0,
      extractedAt: detailInfo.extractedAt || Date.now(),
      fromCache: detailInfo.fromCache || false,
      retryCount: detailInfo.retryCount || 0,
      
      // 新架构特有字段
      architecture: architecture,
      dataStructureVersion: dataStructureVersion,
      parser: detailInfo.parser || detailInfo.sourceType,
      configApplied: detailInfo.configApplied || false,
      
      // 解析器信息
      parserInfo: detailInfo.parserInfo || {},
      parserFeatures: detailInfo.parserFeatures || [],
      
      // 质量指标
      qualityScore: detailInfo.qualityScore || this.calculateQualityScore(detailInfo),
      completeness: detailInfo.completeness || this.calculateCompleteness(detailInfo)
    };

    return normalized;
  }

  /**
   * 标准化下载链接 - 适配新架构链接格式
   */
  normalizeDownloadLinks(links) {
    if (!Array.isArray(links)) return [];
    
    return links
      .filter(link => link.type === 'download' || link.type === 'http' || link.type === 'https' || !link.type)
      .map(link => ({
        url: link.url,
        name: link.name || '下载链接',
        size: link.size || '',
        quality: link.quality || '',
        type: link.type || 'download',
        // 新架构字段
        verified: link.verified || false,
        speed: link.speed || '',
        seeds: link.seeds || 0
      }));
  }

  /**
   * 标准化磁力链接
   */
  normalizeMagnetLinks(links) {
    if (!Array.isArray(links)) return [];
    
    return links
      .filter(link => link.type === 'magnet')
      .map(link => ({
        magnet: link.url,
        url: link.url, // 兼容性
        name: link.name || '磁力链接',
        size: link.size || '',
        seeders: link.seeders || link.seeds || 0,
        leechers: link.leechers || link.peers || 0,
        quality: link.quality || '',
        // 新架构字段
        hash: link.hash || '',
        trackers: link.trackers || [],
        verified: link.verified || false
      }));
  }

  /**
   * 标准化标签
   */
  normalizeTags(tags) {
    if (!Array.isArray(tags)) return [];
    
    return tags
      .filter(tag => tag && tag.trim())
      .map(tag => {
        if (typeof tag === 'string') {
          return tag.trim();
        } else if (tag.name) {
          return tag.name.trim();
        } else {
          return String(tag).trim();
        }
      })
      .filter(tag => tag.length > 0);
  }

  /**
   * 创建详情卡片HTML - 增强新架构支持
   */
  async createDetailCardHTML(searchResult, detailInfo, options = {}) {
    const startTime = performance.now();
    
    try {
      const config = await this.getEffectiveConfig(options);
      const cardId = this.generateCardId(searchResult.url);
      
      // 新架构内容过滤
      if (config.enableContentFilter && config.contentFilterKeywords.length > 0) {
        const filtered = this.applyContentFilter(detailInfo, config.contentFilterKeywords);
        if (filtered.blocked) {
          return this.createFilteredContentHTML(cardId, filtered.reason);
        }
      }
      
      // 新架构服务状态指示器
      const serviceStatusHTML = this.createServiceStatusHTML();
      
      // 基本信息部分
      const basicInfoHTML = this.createBasicInfoHTML(searchResult, detailInfo);
      
      // 媒体信息部分 - 配置控制
      const mediaInfoHTML = this.createMediaInfoHTML(detailInfo, config);
      
      // 演员信息部分 - 配置控制
      const actressInfoHTML = config.showActressInfo ? 
        this.createActressInfoHTML(detailInfo) : '';
      
      // 下载链接部分 - 配置控制
      const downloadLinksHTML = config.showDownloadLinks ? 
        this.createDownloadLinksHTML(detailInfo) : '';
      
      // 磁力链接部分 - 配置控制
      const magnetLinksHTML = config.showMagnetLinks ? 
        this.createMagnetLinksHTML(detailInfo) : '';
      
      // 截图预览部分 - 配置控制
      const screenshotsHTML = config.showScreenshots ? 
        this.createScreenshotsHTML(detailInfo, config) : '';
      
      // 详情信息部分 - 配置控制
      const detailsHTML = this.createDetailsHTML(detailInfo, config);
      
      // 操作按钮部分
      const actionsHTML = this.createActionsHTML(searchResult, detailInfo, config);
      
      // 状态指示器
      const statusHTML = this.createStatusHTML(detailInfo);
      
      // 质量指示器 - 新架构增强
      const qualityHTML = this.createQualityIndicatorHTML(detailInfo);
      
      // 解析器信息指示器
      const parserInfoHTML = this.createParserInfoHTML(detailInfo);

      // 配置相关的CSS类
      const configClasses = this.generateConfigClasses(config);
      
      // 新架构CSS类
      const architectureClasses = this.generateArchitectureClasses(detailInfo);

      const cardHTML = `
        <div class="detail-card ${configClasses} ${architectureClasses}" 
             data-card-id="${cardId}" 
             data-url="${escapeHtml(searchResult.url)}"
             data-extraction-status="${detailInfo.extractionStatus || 'unknown'}"
             data-source-type="${detailInfo.sourceType || 'generic'}"
             data-config-mode="${config.compactMode ? 'compact' : 'normal'}"
             data-architecture="${detailInfo.architecture || 'modular_parsers'}"
             data-data-version="${detailInfo.dataStructureVersion || '2.0'}"
             data-parser="${detailInfo.parser || 'unknown'}">
          
          <!-- 服务状态指示器 -->
          ${serviceStatusHTML}
          
          <!-- 状态指示器 -->
          ${statusHTML}
          
          <!-- 质量指示器 -->
          ${qualityHTML}
          
          <!-- 解析器信息 -->
          ${parserInfoHTML}
          
          <!-- 卡片头部 -->
          <div class="detail-card-header">
            ${basicInfoHTML}
            ${actionsHTML}
          </div>
          
          <!-- 媒体信息 - 配置控制 -->
          ${mediaInfoHTML}
          
          <!-- 演员信息 - 配置控制 -->
          ${actressInfoHTML}
          
          <!-- 下载信息 - 配置控制 -->
          <div class="detail-card-downloads">
            ${downloadLinksHTML}
            ${magnetLinksHTML}
          </div>
          
          <!-- 截图预览 - 配置控制 -->
          ${screenshotsHTML}
          
          <!-- 详细信息 - 配置控制 -->
          ${detailsHTML}
          
          <!-- 新架构元数据 -->
          <div class="detail-card-meta">
            <small class="extraction-info">
              提取来源: ${escapeHtml(detailInfo.sourceType || 'unknown')} | 
              解析器: ${escapeHtml(detailInfo.parser || 'generic')} |
              提取时间: ${detailInfo.extractionTime ? `${detailInfo.extractionTime}ms` : '未知'} |
              ${detailInfo.fromCache ? '来自缓存' : '实时提取'} |
              ${formatRelativeTime(detailInfo.extractedAt || Date.now())}
              ${detailInfo.retryCount > 0 ? ` | 重试次数: ${detailInfo.retryCount}` : ''}
              ${detailInfo.qualityScore ? ` | 质量评分: ${detailInfo.qualityScore}` : ''}
            </small>
            ${this.createArchitectureIndicatorHTML(detailInfo, config)}
            ${this.createConfigIndicatorHTML(config)}
          </div>
        </div>
      `;
      
      // 记录渲染性能
      const renderTime = performance.now() - startTime;
      this.recordPerformanceMetric('renderTime', renderTime);
      
      return cardHTML;
      
    } catch (error) {
      console.error('创建详情卡片HTML失败:', error);
      this.performanceMetrics.errorCount++;
      return this.createErrorCardHTML(searchResult, error);
    }
  }

  /**
   * 创建服务状态HTML
   */
  createServiceStatusHTML() {
    if (this.serviceHealth.status === SERVICE_STATUS.HEALTHY) {
      return ''; // 健康状态不显示
    }
    
    const statusClass = `service-status-${this.serviceHealth.status}`;
    const statusIcon = this.getServiceStatusIcon(this.serviceHealth.status);
    const statusText = this.getServiceStatusText(this.serviceHealth.status);
    
    return `
      <div class="detail-service-status ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
        ${this.serviceHealth.error ? `<span class="status-error" title="${escapeHtml(this.serviceHealth.error)}">!</span>` : ''}
      </div>
    `;
  }

  /**
   * 创建解析器信息HTML
   */
  createParserInfoHTML(detailInfo) {
    if (!detailInfo.parser || detailInfo.parser === 'generic') {
      return '';
    }
    
    const parserFeatures = Array.isArray(detailInfo.parserFeatures) ? detailInfo.parserFeatures : [];
    const hasAdvancedFeatures = parserFeatures.length > 0;
    
    return `
      <div class="detail-parser-info">
        <div class="parser-badge">
          <span class="parser-icon">${this.getParserIcon(detailInfo.parser)}</span>
          <span class="parser-name">${escapeHtml(detailInfo.parser.toUpperCase())}</span>
          ${hasAdvancedFeatures ? '<span class="parser-enhanced">✨</span>' : ''}
        </div>
        ${hasAdvancedFeatures ? `
          <div class="parser-features" title="解析器特性: ${parserFeatures.join(', ')}">
            ${parserFeatures.slice(0, 3).map(feature => `<span class="feature-badge">${escapeHtml(feature)}</span>`).join('')}
            ${parserFeatures.length > 3 ? `<span class="feature-more">+${parserFeatures.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建架构指示器HTML
   */
  createArchitectureIndicatorHTML(detailInfo, config) {
    if (!config.compactMode && detailInfo.architecture === 'modular_parsers') {
      return `
        <div class="architecture-indicators">
          <span class="architecture-badge" title="新架构 v${detailInfo.dataStructureVersion || '2.0'}">
            🏗️ 模块化解析器
          </span>
          ${detailInfo.configApplied ? '<span class="config-applied-badge" title="已应用用户配置">⚙️</span>' : ''}
        </div>
      `;
    }
    return '';
  }

  /**
   * 创建基本信息HTML
   */
  createBasicInfoHTML(searchResult, detailInfo) {
    const title = detailInfo.title || searchResult.title || '未知标题';
    const code = detailInfo.code || '';
    const sourceType = detailInfo.sourceType || 'generic';
    
    const sourceTypeHTML = sourceType !== 'generic' ? `
      <div class="detail-source-type">
        <span class="source-type-badge">${this.getSourceTypeIcon(sourceType)} ${sourceType.toUpperCase()}</span>
      </div>
    ` : '';

    return `
      <div class="detail-basic-info">
        <h3 class="detail-title" title="${escapeHtml(title)}">
          ${escapeHtml(title)}
        </h3>
        
        ${code ? `
          <div class="detail-code">
            <span class="code-label">番号:</span>
            <span class="code-value">${escapeHtml(code)}</span>
            <button class="copy-code-btn" onclick="window.detailCardManager.copyToClipboard('${escapeHtml(code)}')" title="复制番号">
              📋
            </button>
          </div>
        ` : ''}
        
        ${sourceTypeHTML}
      </div>
    `;
  }

  /**
   * 创建媒体信息HTML - 增强配置控制
   */
  createMediaInfoHTML(detailInfo, config) {
    if (!detailInfo.cover && 
        (!config.showDescription || !detailInfo.description) && 
        !this.hasMetadata(detailInfo)) {
      return '';
    }

    const coverImageHTML = detailInfo.cover ? `
      <div class="detail-cover">
        <img src="${escapeHtml(detailInfo.cover)}" 
             alt="封面图片" 
             class="cover-image"
             loading="lazy"
             onerror="this.style.display='none'"
             ${config.enableImagePreview ? `onclick="window.detailCardManager.previewImage('${escapeHtml(detailInfo.cover)}', '${escapeHtml(detailInfo.title || '')}')"` : ''}>
        <div class="cover-overlay">
          <button class="cover-download-btn" onclick="window.detailCardManager.downloadImage('${escapeHtml(detailInfo.cover)}', '${escapeHtml(detailInfo.code || 'cover')}')" title="下载封面">
            ⬇️
          </button>
        </div>
      </div>
    ` : '';

    // 描述信息 - 配置控制
    const descriptionHTML = (config.showDescription && detailInfo.description) ? `
      <div class="detail-description">
        <h4>简介:</h4>
        <p class="description-text">${escapeHtml(detailInfo.description)}</p>
        <button class="description-toggle" onclick="this.parentElement.classList.toggle('expanded')">
          <span class="toggle-text">展开</span>
        </button>
      </div>
    ` : '';

    const metadataHTML = this.createMetadataHTML(detailInfo);

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

  /**
   * 创建演员信息HTML
   */
  createActressInfoHTML(detailInfo) {
    if (!detailInfo.actors || detailInfo.actors.length === 0) {
      return '';
    }

    const actorsHTML = detailInfo.actors.map(actor => {
      const name = actor.name || actor;
      const avatarHTML = actor.avatar ? `
        <img src="${escapeHtml(actor.avatar)}" 
             alt="${escapeHtml(name)}" 
             class="actress-avatar"
             loading="lazy"
             onerror="this.style.display='none'">
      ` : '';

      const profileLinkHTML = actor.profileUrl ? `
        <a href="${escapeHtml(actor.profileUrl)}" 
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
        <h4>演员信息:</h4>
        <div class="actresses-list">
          ${actorsHTML}
        </div>
      </div>
    `;
  }

  /**
   * 创建下载链接HTML
   */
  createDownloadLinksHTML(detailInfo) {
    if (!detailInfo.downloadLinks || detailInfo.downloadLinks.length === 0) {
      return '';
    }

    const linksHTML = detailInfo.downloadLinks.map((link, index) => {
      const name = link.name || `下载链接 ${index + 1}`;
      const sizeInfo = link.size ? `<span class="link-size">(${escapeHtml(link.size)})</span>` : '';
      const qualityInfo = link.quality ? `<span class="link-quality">[${escapeHtml(link.quality)}]</span>` : '';
      const typeInfo = link.type ? `<span class="link-type">${this.getDownloadTypeIcon(link.type)}</span>` : '';
      const verifiedInfo = link.verified ? `<span class="link-verified" title="已验证">✓</span>` : '';

      return `
        <div class="download-link-item">
          <a href="${escapeHtml(link.url)}" 
             target="_blank" 
             rel="noopener noreferrer"
             class="download-link"
             onclick="window.detailCardManager.recordDownloadClick('${escapeHtml(link.url)}', '${escapeHtml(link.type || 'unknown')}')">
            ${typeInfo}
            <span class="link-name">${escapeHtml(name)}</span>
            ${qualityInfo}
            ${sizeInfo}
            ${verifiedInfo}
          </a>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-download-links">
        <h4>下载链接:</h4>
        <div class="download-links-list">
          ${linksHTML}
        </div>
      </div>
    `;
  }

  /**
   * 创建磁力链接HTML
   */
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
      const verifiedInfo = link.verified ? `<span class="magnet-verified" title="已验证">✓</span>` : '';

      return `
        <div class="magnet-link-item">
          <div class="magnet-link-header">
            <span class="magnet-icon">🧲</span>
            <span class="magnet-name">${escapeHtml(name)}</span>
            ${qualityInfo}
            ${sizeInfo}
            ${verifiedInfo}
          </div>
          
          ${seedInfo ? `<div class="magnet-stats">${seedInfo}</div>` : ''}
          
          <div class="magnet-actions">
            <button class="magnet-copy-btn" 
                    onclick="window.detailCardManager.copyMagnetLink('${escapeHtml(link.magnet)}')">
              复制磁力链接
            </button>
            <a href="${escapeHtml(link.magnet)}" 
               class="magnet-open-btn"
               onclick="window.detailCardManager.recordMagnetClick('${escapeHtml(link.magnet)}')">
              打开磁力链接
            </a>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="detail-magnet-links">
        <h4>磁力链接:</h4>
        <div class="magnet-links-list">
          ${linksHTML}
        </div>
      </div>
    `;
  }

  /**
   * 创建截图预览HTML
   */
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
             ${config.enableImagePreview ? `onclick="window.detailCardManager.previewScreenshots(${index}, ${JSON.stringify(detailInfo.screenshots).replace(/"/g, '&quot;')})"` : ''}>
        <div class="screenshot-overlay">
          <span class="screenshot-number">${index + 1}</span>
          <button class="screenshot-download-btn" onclick="window.detailCardManager.downloadImage('${escapeHtml(screenshot)}', '${escapeHtml(detailInfo.code || 'screenshot')}_${index + 1}')" title="下载截图">
            ⬇️
          </button>
        </div>
      </div>
    `).join('');

    return `
      <div class="detail-screenshots">
        <div class="screenshots-header">
          <h4>截图预览:</h4>
          <div class="screenshots-controls">
            <span class="screenshots-count">${detailInfo.screenshots.length} 张</span>
            <button class="screenshots-download-all" onclick="window.detailCardManager.downloadAllImages(${JSON.stringify(detailInfo.screenshots).replace(/"/g, '&quot;')}, '${escapeHtml(detailInfo.code || 'screenshots')}')" title="下载全部截图">
              ⬇️ 全部下载
            </button>
          </div>
        </div>
        <div class="screenshots-grid">
          ${screenshotsHTML}
        </div>
      </div>
    `;
  }

  /**
   * 创建详细信息HTML - 增强配置控制
   */
  createDetailsHTML(detailInfo, config) {
    let html = '';
    
    // 标签信息 - 配置控制
    if (config.showExtractedTags && detailInfo.tags && detailInfo.tags.length > 0) {
      html += `
        <div class="detail-tags">
          <h4>标签:</h4>
          <div class="tags-list">
            ${detailInfo.tags.map(tag => `
              <span class="tag-item" onclick="window.detailCardManager.searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    // 评分信息 - 配置控制
    if (config.showRating && detailInfo.rating && detailInfo.rating > 0) {
      const stars = this.generateStarsHTML(detailInfo.rating);
      html += `
        <div class="detail-rating">
          <h4>评分:</h4>
          <div class="rating-display">
            ${stars}
            <span class="rating-value">${detailInfo.rating}/10</span>
          </div>
        </div>
      `;
    }
    
    return html ? `<div class="detail-details">${html}</div>` : '';
  }

  /**
   * 创建操作按钮HTML
   */
  createActionsHTML(searchResult, detailInfo, config) {
    const isFavorited = favoritesManager.isFavorited(searchResult.url);
    
    return `
      <div class="detail-card-actions">
        <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}"
                onclick="window.detailCardManager.toggleFavorite('${escapeHtml(searchResult.url)}')"
                title="${isFavorited ? '取消收藏' : '添加收藏'}">
          <span class="btn-icon">${isFavorited ? '★' : '☆'}</span>
          <span class="btn-text">${isFavorited ? '已收藏' : '收藏'}</span>
        </button>
        
        <button class="action-btn share-btn"
                onclick="window.detailCardManager.shareDetail('${escapeHtml(searchResult.url)}')"
                title="分享详情">
          <span class="btn-icon">📤</span>
          <span class="btn-text">分享</span>
        </button>
        
        <button class="action-btn refresh-btn"
                onclick="window.detailCardManager.refreshDetail('${escapeHtml(searchResult.url)}')"
                title="刷新详情">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">刷新</span>
        </button>
        
        <button class="action-btn original-btn"
                onclick="window.detailCardManager.openOriginal('${escapeHtml(searchResult.url)}')"
                title="查看原页面">
          <span class="btn-icon">🔗</span>
          <span class="btn-text">原页面</span>
        </button>
        
        <div class="action-dropdown">
          <button class="action-btn dropdown-toggle" onclick="this.parentElement.classList.toggle('active')" title="更多操作">
            <span class="btn-icon">⋯</span>
          </button>
          <div class="dropdown-menu">
            <button onclick="window.detailCardManager.exportDetail('${escapeHtml(searchResult.url)}')" class="dropdown-item">
              💾 导出详情
            </button>
            <button onclick="window.detailCardManager.reportIssue('${escapeHtml(searchResult.url)}')" class="dropdown-item">
              🚩 报告问题
            </button>
            <button onclick="window.detailCardManager.copyDetailURL('${escapeHtml(searchResult.url)}')" class="dropdown-item">
              📋 复制链接
            </button>
            ${detailInfo.parser !== 'generic' ? `
              <button onclick="window.detailCardManager.validateParser('${escapeHtml(detailInfo.parser)}')" class="dropdown-item">
                🔧 验证解析器
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建状态HTML
   */
  createStatusHTML(detailInfo) {
    const status = detailInfo.extractionStatus || 'unknown';
    const statusClass = `status-${status}`;
    const statusText = this.getStatusText(status);
    const statusIcon = this.getStatusIcon(status);

    return `
      <div class="detail-card-status ${statusClass}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
        ${detailInfo.extractionTime ? `<span class="status-time">${detailInfo.extractionTime}ms</span>` : ''}
      </div>
    `;
  }

  /**
   * 创建元数据HTML
   */
  createMetadataHTML(detailInfo) {
    const metadata = [];

    if (detailInfo.releaseDate) {
      metadata.push({
        label: '发行日期',
        value: detailInfo.releaseDate,
        icon: '📅'
      });
    }

    if (detailInfo.duration) {
      metadata.push({
        label: '时长',
        value: `${detailInfo.duration}分钟`,
        icon: 'ⱱ'
      });
    }

    if (detailInfo.director) {
      metadata.push({
        label: '导演',
        value: detailInfo.director,
        icon: '🎬'
      });
    }

    if (detailInfo.studio) {
      metadata.push({
        label: '制作商',
        value: detailInfo.studio,
        icon: '🏢'
      });
    }

    if (detailInfo.label) {
      metadata.push({
        label: '发行商',
        value: detailInfo.label,
        icon: '🏷️'
      });
    }

    if (detailInfo.series) {
      metadata.push({
        label: '系列',
        value: detailInfo.series,
        icon: '📂'
      });
    }

    if (detailInfo.quality) {
      metadata.push({
        label: '画质',
        value: detailInfo.quality,
        icon: '🎯'
      });
    }

    if (detailInfo.fileSize) {
      metadata.push({
        label: '文件大小',
        value: detailInfo.fileSize,
        icon: '💾'
      });
    }

    if (detailInfo.resolution) {
      metadata.push({
        label: '分辨率',
        value: detailInfo.resolution,
        icon: '🔧'
      });
    }

    if (detailInfo.rating && detailInfo.rating > 0) {
      const stars = this.generateStarsHTML(detailInfo.rating);
      metadata.push({
        label: '评分',
        value: `${stars} (${detailInfo.rating}/10)`,
        icon: '⭐'
      });
    }

    return metadata.length > 0 ? `
      <div class="detail-metadata">
        ${metadata.map(item => `
          <div class="meta-item">
            <span class="meta-icon">${item.icon}</span>
            <span class="meta-label">${item.label}:</span>
            <span class="meta-value">${escapeHtml(item.value)}</span>
          </div>
        `).join('')}
      </div>
    ` : '';
  }

  /**
   * 创建配置指示器HTML
   */
  createConfigIndicatorHTML(config) {
    if (!config.compactMode) return '';
    
    const indicators = [];
    if (!config.showScreenshots) indicators.push('无截图');
    if (!config.showDownloadLinks) indicators.push('无下载');
    if (!config.showMagnetLinks) indicators.push('无磁力');
    if (!config.showActressInfo) indicators.push('无演员');
    
    return indicators.length > 0 ? `
      <div class="config-indicators">
        <span class="config-indicator-label">显示设置:</span>
        ${indicators.map(ind => `<span class="config-indicator">${ind}</span>`).join('')}
      </div>
    ` : '';
  }

  /**
   * 创建错误卡片HTML
   */
  createErrorCardHTML(searchResult, error) {
    const cardId = this.generateCardId(searchResult.url);
    
    return `
      <div class="detail-card error-card" data-card-id="${cardId}">
        <div class="error-content">
          <div class="error-icon">⚠️</div>
          <div class="error-message">
            <h4>详情卡片生成失败</h4>
            <p>错误信息: ${escapeHtml(error.message)}</p>
            <button class="retry-render-btn" onclick="window.detailCardManager.retryRender('${escapeHtml(searchResult.url)}')">
              重新生成
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建被过滤内容的HTML
   */
  createFilteredContentHTML(cardId, reason) {
    return `
      <div class="detail-card filtered-content" data-card-id="${cardId}">
        <div class="filtered-notice">
          <div class="filter-icon">🚫</div>
          <div class="filter-message">
            <h4>内容已被过滤</h4>
            <p>${escapeHtml(reason)}</p>
            <button class="show-anyway-btn" onclick="window.detailCardManager.showFilteredContent('${cardId}')">
              仍要显示
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 生成配置相关的CSS类 - 增强版本
   */
  generateConfigClasses(config) {
    const classes = [];
    
    if (config.compactMode) classes.push('compact');
    if (!config.showScreenshots) classes.push('no-screenshots');
    if (!config.showDownloadLinks) classes.push('no-downloads');
    if (!config.showMagnetLinks) classes.push('no-magnets');
    if (!config.showActressInfo) classes.push('no-actress-info');
    if (!config.enableImagePreview) classes.push('no-image-preview');
    
    // 新架构配置类
    if (config._configSource) classes.push(`config-${config._configSource}`);
    
    return classes.join(' ');
  }

  /**
   * 生成架构相关的CSS类
   */
  generateArchitectureClasses(detailInfo) {
    const classes = [];
    
    if (detailInfo.architecture) {
      classes.push(`arch-${detailInfo.architecture.replace(/_/g, '-')}`);
    }
    
    if (detailInfo.dataStructureVersion) {
      classes.push(`data-v${detailInfo.dataStructureVersion.replace(/\./g, '-')}`);
    }
    
    if (detailInfo.parser && detailInfo.parser !== 'generic') {
      classes.push(`parser-${detailInfo.parser}`);
    }
    
    if (detailInfo.qualityScore) {
      const qualityLevel = detailInfo.qualityScore >= 80 ? 'high' : 
                          detailInfo.qualityScore >= 60 ? 'medium' : 'low';
      classes.push(`quality-${qualityLevel}`);
    }
    
    return classes.join(' ');
  }

  /**
   * 创建质量指示器HTML - 增强新架构支持
   */
  createQualityIndicatorHTML(detailInfo) {
    const quality = this.calculateContentQuality(detailInfo);
    
    if (quality.score < 50) return '';
    
    const qualityClass = quality.score >= 80 ? 'excellent' : quality.score >= 60 ? 'good' : 'fair';
    
    // 新架构质量指标
    const architectureBonus = detailInfo.architecture === 'modular_parsers' ? ' 🏗️' : '';
    const parserQuality = detailInfo.parser && detailInfo.parser !== 'generic' ? ' ⚡' : '';
    
    return `
      <div class="detail-quality-indicator ${qualityClass}">
        <span class="quality-score">${quality.score}${architectureBonus}${parserQuality}</span>
        <span class="quality-label">质量分</span>
        <div class="quality-details" title="${quality.details.join(', ')}">
          ${quality.indicators.map(indicator => `<span class="quality-badge">${indicator}</span>`).join('')}
        </div>
        ${detailInfo.completeness ? `<div class="completeness-bar" style="width: ${detailInfo.completeness}%" title="完整度: ${detailInfo.completeness}%"></div>` : ''}
      </div>
    `;
  }

  /**
   * 计算内容质量分数 - 适配新架构
   */
  calculateContentQuality(detailInfo) {
    let score = 0;
    const details = [];
    const indicators = [];
    
    // 基础信息完整性 (30分)
    if (detailInfo.title && detailInfo.title.length > 5) {
      score += 10;
      details.push('标题完整');
    }
    if (detailInfo.code) {
      score += 10;
      indicators.push('📋');
      details.push('有番号');
    }
    if (detailInfo.description && detailInfo.description.length > 20) {
      score += 10;
      details.push('有描述');
    }
    
    // 媒体内容丰富度 (40分)
    if (detailInfo.cover) {
      score += 15;
      indicators.push('🖼️');
      details.push('有封面');
    }
    if (detailInfo.screenshots && detailInfo.screenshots.length > 0) {
      score += 15;
      indicators.push('📸');
      details.push(`${detailInfo.screenshots.length}张截图`);
    }
    if (detailInfo.actors && detailInfo.actors.length > 0) {
      score += 10;
      indicators.push('👥');
      details.push(`${detailInfo.actors.length}位演员`);
    }
    
    // 下载资源可用性 (20分)
    const downloadCount = (detailInfo.downloadLinks || []).length;
    const magnetCount = (detailInfo.magnetLinks || []).length;
    
    if (downloadCount > 0) {
      score += 10;
      indicators.push('⬇️');
      details.push(`${downloadCount}个下载链接`);
    }
    if (magnetCount > 0) {
      score += 10;
      indicators.push('🧲');
      details.push(`${magnetCount}个磁力链接`);
    }
    
    // 元数据完整性 (10分)
    const metaFields = ['releaseDate', 'duration', 'studio', 'director'].filter(field => detailInfo[field]);
    if (metaFields.length > 0) {
      score += Math.min(metaFields.length * 2.5, 10);
      details.push(`${metaFields.length}项元数据`);
    }
    
    // 新架构奖励分 (最多10分)
    if (detailInfo.architecture === 'modular_parsers') {
      score += 5;
      details.push('新架构解析');
      indicators.push('🏗️');
    }
    
    if (detailInfo.parser && detailInfo.parser !== 'generic') {
      score += 3;
      details.push('专用解析器');
      indicators.push('⚡');
    }
    
    if (detailInfo.configApplied) {
      score += 2;
      details.push('应用用户配置');
    }
    
    return {
      score: Math.min(Math.round(score), 100), // 最高100分
      details,
      indicators
    };
  }

  /**
   * 计算完整度
   */
  calculateCompleteness(detailInfo) {
    const fields = [
      'title', 'code', 'description', 'cover', 'releaseDate', 
      'duration', 'studio', 'director', 'actors', 'screenshots',
      'downloadLinks', 'magnetLinks', 'tags', 'quality'
    ];
    
    let filledFields = 0;
    fields.forEach(field => {
      const value = detailInfo[field];
      if (value) {
        if (Array.isArray(value) && value.length > 0) {
          filledFields++;
        } else if (typeof value === 'string' && value.trim()) {
          filledFields++;
        } else if (typeof value === 'number' && value > 0) {
          filledFields++;
        }
      }
    });
    
    return Math.round((filledFields / fields.length) * 100);
  }

  /**
   * 计算质量评分
   */
  calculateQualityScore(detailInfo) {
    // 基于现有的 calculateContentQuality 方法
    const quality = this.calculateContentQuality(detailInfo);
    return quality.score;
  }

  /**
   * 更新架构指标
   */
  updateArchitectureMetrics(detailInfo) {
    const metrics = this.performanceMetrics.architectureMetrics;
    
    metrics.totalCards++;
    
    if (detailInfo.architecture === 'modular_parsers') {
      metrics.modularParserCards++;
    }
    
    if (detailInfo.dataStructureVersion === '2.0') {
      metrics.unifiedDataCards++;
    }
    
    // 记录解析器性能
    if (detailInfo.parser && detailInfo.extractionTime) {
      const parser = detailInfo.parser;
      if (!this.performanceMetrics.parserPerformance.has(parser)) {
        this.performanceMetrics.parserPerformance.set(parser, {
          count: 0,
          totalTime: 0,
          averageTime: 0,
          successCount: 0
        });
      }
      
      const parserStats = this.performanceMetrics.parserPerformance.get(parser);
      parserStats.count++;
      parserStats.totalTime += detailInfo.extractionTime;
      parserStats.averageTime = parserStats.totalTime / parserStats.count;
      
      if (detailInfo.extractionStatus === 'success') {
        parserStats.successCount++;
      }
    }
  }

  /**
   * 重新渲染卡片 - 适配新架构
   */
  async rerenderCard(url, cardData) {
    const cardId = this.generateCardId(url);
    const existingCard = document.querySelector(`[data-card-id="${cardId}"]`);
    
    if (!existingCard) {
      console.warn(`未找到卡片元素: ${cardId}`);
      return;
    }

    try {
      // 重新验证数据结构
      const validatedDetailInfo = this.validateAndNormalizeDetailInfo(cardData.detailInfo);
      
      // 使用最新配置重新生成HTML
      const newHTML = await this.createDetailCardHTML(
        cardData.searchResult, 
        validatedDetailInfo, 
        cardData.options
      );
      
      existingCard.outerHTML = newHTML;
      await this.bindCardEvents(url);
      
      console.log(`卡片重新渲染完成 (新架构): ${validatedDetailInfo.title || url}`);
      
    } catch (error) {
      console.error('重新渲染卡片失败:', error);
      // 显示错误卡片
      existingCard.outerHTML = this.createErrorCardHTML(cardData.searchResult, error);
    }
  }

  /**
   * 刷新所有活动卡片 - 增强新架构支持
   */
  async refreshAllCards() {
    console.log(`刷新 ${this.activeCards.size} 个活动卡片 (新架构)`);
    
    // 先刷新配置
    await this.refreshConfig();
    
    const refreshPromises = [];
    for (const [url, cardData] of this.activeCards) {
      refreshPromises.push(
        this.rerenderCard(url, cardData).catch(error => {
          console.error(`刷新卡片失败 [${url}]:`, error);
        })
      );
    }
    
    await Promise.all(refreshPromises);
    console.log('所有卡片刷新完成 (新架构)');
  }

  /**
   * 绑定卡片事件
   */
  async bindCardEvents(url) {
    const cardId = this.generateCardId(url);
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!card) return;

    // 绑定图片懒加载
    const images = card.querySelectorAll('img[loading="lazy"]');
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
            }
            imageObserver.unobserve(img);
          }
        });
      });

      images.forEach(img => imageObserver.observe(img));
    }

    // 绑定描述展开/收起
    const descriptionToggles = card.querySelectorAll('.description-toggle');
    descriptionToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        const description = e.target.closest('.detail-description');
        const isExpanded = description.classList.contains('expanded');
        const toggleText = e.target.querySelector('.toggle-text');
        
        description.classList.toggle('expanded');
        if (toggleText) {
          toggleText.textContent = isExpanded ? '展开' : '收起';
        }
      });
    });

    // 绑定下拉菜单
    const dropdowns = card.querySelectorAll('.action-dropdown');
    dropdowns.forEach(dropdown => {
      const toggle = dropdown.querySelector('.dropdown-toggle');
      if (toggle) {
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('active');
        });
      }
    });

    // 点击外部关闭下拉菜单
    document.addEventListener('click', () => {
      dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
    });
  }

  /**
   * 绑定全局事件 - 增强新架构支持
   */
  bindGlobalEvents() {
    // 暴露全局方法
    window.detailCardManager = {
      // 现有方法保持不变
      toggleFavorite: (url) => this.toggleFavorite(url),
      shareDetail: (url) => this.shareDetail(url),
      refreshDetail: (url) => this.refreshDetail(url),
      openOriginal: (url) => this.openOriginal(url),
      copyMagnetLink: (magnetLink) => this.copyMagnetLink(magnetLink),
      recordDownloadClick: (url, type) => this.recordDownloadClick(url, type),
      recordMagnetClick: (magnetLink) => this.recordMagnetClick(magnetLink),
      previewImage: (imageSrc, title) => this.previewImage(imageSrc, title),
      previewScreenshots: (index, screenshots) => this.previewScreenshots(index, screenshots),
      navigatePreview: (element, direction) => this.navigatePreview(element, direction),
      switchPreview: (element, index) => this.switchPreview(element, index),
      downloadImage: (imageUrl, filename) => this.downloadImage(imageUrl, filename),
      downloadAllImages: (imageUrls, baseName) => this.downloadAllImages(imageUrls, baseName),
      exportDetail: (url) => this.exportDetail(url),
      reportIssue: (url) => this.reportIssue(url),
      copyDetailURL: (url) => this.copyDetailURL(url),
      copyToClipboard: (text) => this.copyToClipboard(text),
      showFilteredContent: (cardId) => this.showFilteredContent(cardId),
      retryRender: (url) => this.retryRender(url),
      searchByTag: (tag) => this.searchByTag(tag),
      getPerformanceStats: () => this.getPerformanceStats(),
      refreshAllCards: () => this.refreshAllCards(),
      
      // 新架构方法
      refreshConfig: () => this.refreshConfig(),
      checkServiceHealth: () => this.checkServiceHealth(),
      getArchitectureInfo: () => this.getArchitectureInfo(),
      validateParser: (sourceType) => this.validateParser(sourceType),
      getParserStats: () => this.getParserStats(),
      exportServiceStatus: () => this.exportServiceStatus()
    };

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateAllFavoriteButtons();
    });

    // 监听配置变更 - 新架构
    document.addEventListener('detailConfigChanged', async (event) => {
      console.log('详情配置变更，刷新所有卡片 (新架构)', event.detail);
      await this.refreshAllCards();
    });
    
    // 监听服务状态变更
    document.addEventListener('detailServiceStatusChanged', (event) => {
      this.serviceHealth = { ...this.serviceHealth, ...event.detail };
      this.updateServiceStatusIndicators();
    });
  }

  // ===================== 交互方法 =====================

  /**
   * 切换收藏状态
   */
  async toggleFavorite(url) {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
      return;
    }

    try {
      this.performanceMetrics.interactionCount++;
      
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的搜索结果', 'error');
        return;
      }

      const isFavorited = favoritesManager.isFavorited(url);
      
      if (isFavorited) {
        const favorite = favoritesManager.favorites.find(fav => fav.url === url);
        if (favorite) {
          await favoritesManager.removeFavorite(favorite.id);
        }
      } else {
        await favoritesManager.addFavorite(result.searchResult);
      }

      this.updateFavoriteButton(url);
      
    } catch (error) {
      console.error('切换收藏状态失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 分享详情
   */
  async shareDetail(url) {
    try {
      this.performanceMetrics.interactionCount++;
      
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的详情信息', 'error');
        return;
      }

      const shareData = {
        title: result.detailInfo.title || '番号详情',
        text: `${result.detailInfo.code || ''} - ${result.detailInfo.title || ''}`,
        url: url
      };

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await this.copyToClipboard(url);
        showToast('链接已复制到剪贴板', 'success');
      }

    } catch (error) {
      console.error('分享失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('分享失败', 'error');
    }
  }

  /**
   * 刷新详情 - 适配新架构
   */
  async refreshDetail(url) {
    try {
      this.performanceMetrics.interactionCount++;
      
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的搜索结果', 'error');
        return;
      }

      showToast('正在刷新详情...', 'info');

      // 使用新架构API删除缓存
      await detailAPIService.deleteCache(url);
      
      const detailInfo = await detailAPIService.extractSingleDetail(result.searchResult, {
        enableCache: false,
        useLocalCache: false
      });

      // 验证新架构数据结构
      const validatedDetailInfo = this.validateAndNormalizeDetailInfo(detailInfo);

      this.activeCards.set(url, {
        ...result,
        detailInfo: validatedDetailInfo
      });

      await this.rerenderCard(url, {
        ...result,
        detailInfo: validatedDetailInfo
      });
      
      showToast('详情刷新成功', 'success');

    } catch (error) {
      console.error('刷新详情失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('刷新失败: ' + error.message, 'error');
    }
  }

  /**
   * 打开原页面
   */
  openOriginal(url) {
    try {
      this.performanceMetrics.interactionCount++;
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast('已在新标签页打开原页面', 'success');
    } catch (error) {
      console.error('打开原页面失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('无法打开原页面', 'error');
    }
  }

  /**
   * 复制磁力链接
   */
  async copyMagnetLink(magnetLink) {
    try {
      this.performanceMetrics.interactionCount++;
      await this.copyToClipboard(magnetLink);
      showToast('磁力链接已复制到剪贴板', 'success');
      
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('copy_magnet', { magnetLink });
      }
    } catch (error) {
      console.error('复制磁力链接失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('复制失败', 'error');
    }
  }

  /**
   * 记录下载点击
   */
  async recordDownloadClick(downloadUrl, type) {
    try {
      this.performanceMetrics.interactionCount++;
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('download_click', { downloadUrl, type });
      }
    } catch (error) {
      console.error('记录下载点击失败:', error);
    }
  }

  /**
   * 记录磁力链接点击
   */
  async recordMagnetClick(magnetLink) {
    try {
      this.performanceMetrics.interactionCount++;
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('magnet_click', { magnetLink });
      }
    } catch (error) {
      console.error('记录磁力点击失败:', error);
    }
  }

  /**
   * 预览图片
   */
  previewImage(imageSrc, title = '') {
    try {
      this.performanceMetrics.interactionCount++;
      
      const modal = document.createElement('div');
      modal.className = 'image-preview-modal';
      modal.innerHTML = `
        <div class="image-preview-backdrop" onclick="this.parentElement.remove()">
          <div class="image-preview-container">
            <div class="preview-header">
              ${title ? `<h3 class="preview-title">${escapeHtml(title)}</h3>` : ''}
              <button class="preview-close-btn" onclick="this.closest('.image-preview-modal').remove()">×</button>
            </div>
            <img src="${escapeHtml(imageSrc)}" alt="图片预览" class="preview-image">
            <div class="preview-actions">
              <button onclick="window.detailCardManager.downloadImage('${escapeHtml(imageSrc)}', 'preview_image')" class="preview-download-btn">
                ⬇️ 下载
              </button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          modal.remove();
          document.removeEventListener('keydown', handleKeyDown);
        }
      };
      document.addEventListener('keydown', handleKeyDown);

    } catch (error) {
      console.error('预览图片失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('无法预览图片', 'error');
    }
  }

  /**
   * 预览截图（支持画廊模式）
   */
  previewScreenshots(index, screenshots) {
    try {
      this.performanceMetrics.interactionCount++;
      
      const modal = document.createElement('div');
      modal.className = 'screenshots-preview-modal';
      modal.innerHTML = `
        <div class="screenshots-preview-backdrop" onclick="this.parentElement.remove()">
          <div class="screenshots-preview-container">
            <div class="preview-header">
              <span class="preview-counter">${index + 1} / ${screenshots.length}</span>
              <button class="preview-close-btn" onclick="this.closest('.screenshots-preview-modal').remove()">×</button>
            </div>
            <div class="preview-content">
              <button class="preview-nav prev" onclick="event.stopPropagation(); window.detailCardManager.navigatePreview(this, -1)">‹</button>
              <img src="${escapeHtml(screenshots[index])}" alt="截图预览" class="preview-image-main" data-index="${index}">
              <button class="preview-nav next" onclick="event.stopPropagation(); window.detailCardManager.navigatePreview(this, 1)">›</button>
            </div>
            <div class="preview-thumbnails">
              ${screenshots.map((src, i) => `
                <img src="${escapeHtml(src)}" 
                     alt="缩略图 ${i + 1}" 
                     class="preview-thumbnail ${i === index ? 'active' : ''}"
                     data-index="${i}"
                     onclick="event.stopPropagation(); window.detailCardManager.switchPreview(this, ${i})">
              `).join('')}
            </div>
          </div>
        </div>
      `;

      modal.screenshotsData = screenshots;
      document.body.appendChild(modal);
      
      const handleKeyDown = (e) => {
        switch (e.key) {
          case 'Escape':
            modal.remove();
            document.removeEventListener('keydown', handleKeyDown);
            break;
          case 'ArrowLeft':
            this.navigatePreview(modal, -1);
            break;
          case 'ArrowRight':
            this.navigatePreview(modal, 1);
            break;
        }
      };
      document.addEventListener('keydown', handleKeyDown);

    } catch (error) {
      console.error('预览截图失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('无法预览截图', 'error');
    }
  }

  /**
   * 导航预览图片
   */
  navigatePreview(element, direction) {
    const modal = element.closest('.screenshots-preview-modal');
    const img = modal.querySelector('.preview-image-main');
    const screenshots = modal.screenshotsData;
    
    let currentIndex = parseInt(img.dataset.index);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = screenshots.length - 1;
    if (newIndex >= screenshots.length) newIndex = 0;
    
    this.switchPreview(modal, newIndex);
  }

  /**
   * 切换预览图片
   */
  switchPreview(element, index) {
    const modal = element.closest ? element.closest('.screenshots-preview-modal') : element;
    const img = modal.querySelector('.preview-image-main');
    const counter = modal.querySelector('.preview-counter');
    const thumbnails = modal.querySelectorAll('.preview-thumbnail');
    const screenshots = modal.screenshotsData;
    
    img.src = screenshots[index];
    img.dataset.index = index;
    counter.textContent = `${index + 1} / ${screenshots.length}`;
    
    thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });
  }

  /**
   * 下载图片
   */
  async downloadImage(imageUrl, filename) {
    try {
      this.performanceMetrics.interactionCount++;
      
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      showToast('图片下载已开始', 'success');
      
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('download_image', { imageUrl, filename });
      }
      
    } catch (error) {
      console.error('下载图片失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('下载失败', 'error');
    }
  }

  /**
   * 下载所有图片
   */
  async downloadAllImages(imageUrls, baseName) {
    try {
      this.performanceMetrics.interactionCount++;
      
      if (!imageUrls || imageUrls.length === 0) {
        showToast('没有可下载的图片', 'warning');
        return;
      }
      
      showToast(`开始下载 ${imageUrls.length} 张图片...`, 'info');
      
      for (let i = 0; i < imageUrls.length; i++) {
        await this.downloadImage(imageUrls[i], `${baseName}_${i + 1}`);
        if (i < imageUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      showToast('所有图片下载完成', 'success');
      
    } catch (error) {
      console.error('批量下载图片失败:', error);
      this.performanceMetrics.errorCount++;
      showToast('批量下载失败', 'error');
    }
  }

  /**
   * 导出详情信息
   */
  async exportDetail(url) {
    try {
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的详情信息', 'error');
        return;
      }

      const exportData = {
        ...result.detailInfo,
        exportTime: new Date().toISOString(),
        sourceUrl: url,
        version: '2.0.0',
        architecture: 'modular_parsers'
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `detail_${result.detailInfo.code || 'unknown'}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast('详情信息导出成功', 'success');

    } catch (error) {
      console.error('导出详情失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  /**
   * 报告问题
   */
  async reportIssue(url) {
    try {
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的详情信息', 'error');
        return;
      }

      const reason = prompt('请描述遇到的问题：');
      if (!reason || reason.trim() === '') return;

      if (authManager.isAuthenticated()) {
        await apiService.recordAction('report_issue', {
          url,
          sourceType: result.detailInfo.sourceType,
          extractionStatus: result.detailInfo.extractionStatus,
          reason: reason.trim(),
          timestamp: Date.now(),
          architecture: 'modular_parsers'
        });

        showToast('问题报告已提交，谢谢您的反馈', 'success');
      } else {
        showToast('请登录后再报告问题', 'warning');
      }

    } catch (error) {
      console.error('报告问题失败:', error);
      showToast('提交失败: ' + error.message, 'error');
    }
  }

  /**
   * 复制详情链接
   */
  async copyDetailURL(url) {
    try {
      await this.copyToClipboard(url);
      showToast('链接已复制到剪贴板', 'success');
    } catch (error) {
      console.error('复制链接失败:', error);
      showToast('复制失败', 'error');
    }
  }

  /**
   * 显示被过滤的内容
   */
  showFilteredContent(cardId) {
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!card) return;

    showToast('内容过滤已临时关闭', 'info');
  }

  /**
   * 重新渲染卡片
   */
  async retryRender(url) {
    try {
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的详情信息', 'error');
        return;
      }

      const newHTML = await this.createDetailCardHTML(result.searchResult, result.detailInfo, result.options);
      
      const cardId = this.generateCardId(url);
      const existingCard = document.querySelector(`[data-card-id="${cardId}"]`);
      
      if (existingCard) {
        existingCard.outerHTML = newHTML;
        await this.bindCardEvents(url);
        showToast('卡片重新生成成功', 'success');
      }

    } catch (error) {
      console.error('重新渲染失败:', error);
      showToast('重新生成失败: ' + error.message, 'error');
    }
  }

  /**
   * 按标签搜索
   */
  searchByTag(tag) {
    try {
      if (window.unifiedSearchManager && window.unifiedSearchManager.performSearch) {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = tag;
          window.unifiedSearchManager.performSearch();
        }
      }
    } catch (error) {
      console.error('按标签搜索失败:', error);
      showToast('搜索失败', 'error');
    }
  }

  /**
   * 复制到剪贴板
   */
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        throw new Error('复制失败');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  // ===================== 新架构特有方法 =====================

  /**
   * 刷新配置
   */
  async refreshConfig() {
    try {
      console.log('刷新配置 (新架构)');
      const configData = await this.configManager.getUserConfig(false); // 强制从服务器获取
      this.updateConfigCache(configData);
      this.performanceMetrics.configFetches++;
      
      // 触发配置更新事件
      document.dispatchEvent(new CustomEvent('detailConfigUpdated', {
        detail: { configData, timestamp: Date.now() }
      }));
      
    } catch (error) {
      console.error('刷新配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证解析器状态
   */
  async validateParser(sourceType) {
    try {
      const validation = await this.configManager.validateParser(sourceType);
      showToast(`解析器 ${sourceType} 验证${validation.validation.isValid ? '成功' : '失败'}`, 
                validation.validation.isValid ? 'success' : 'error');
      return validation;
    } catch (error) {
      console.error('验证解析器失败:', error);
      showToast(`验证解析器失败: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * 获取解析器统计
   */
  getParserStats() {
    const stats = {};
    
    for (const [parser, metrics] of this.performanceMetrics.parserPerformance) {
      stats[parser] = {
        ...metrics,
        successRate: metrics.count > 0 ? (metrics.successCount / metrics.count * 100).toFixed(1) : 0
      };
    }
    
    return {
      parsers: stats,
      totalCards: this.performanceMetrics.architectureMetrics.totalCards,
      modularParserCards: this.performanceMetrics.architectureMetrics.modularParserCards,
      architecture: 'modular_parsers',
      version: this.version
    };
  }

  /**
   * 获取架构信息
   */
  getArchitectureInfo() {
    return {
      version: this.version,
      architecture: 'modular_parsers',
      features: this.serviceHealth.features,
      serviceStatus: this.serviceHealth.status,
      configManager: {
        available: !!this.configManager,
        version: this.configManager?.version || 'unknown',
        cacheValid: this.isConfigCacheValid()
      },
      performance: this.performanceMetrics.architectureMetrics,
      lastHealthCheck: this.serviceHealth.lastCheck
    };
  }

  /**
   * 更新服务状态指示器
   */
  updateServiceStatusIndicators() {
    const cards = document.querySelectorAll('.detail-card');
    cards.forEach(card => {
      const statusIndicator = card.querySelector('.detail-service-status');
      if (statusIndicator) {
        const newStatusHTML = this.createServiceStatusHTML();
        if (newStatusHTML) {
          statusIndicator.outerHTML = newStatusHTML;
        } else {
          statusIndicator.remove();
        }
      }
    });
  }

  // ===================== 配置缓存管理 =====================

  /**
   * 检查配置缓存是否过期
   */
  isConfigCacheExpired() {
    return !this.configCache || (Date.now() - this.configLastUpdate) > this.configCacheExpiration;
  }

  /**
   * 更新配置缓存
   */
  updateConfigCache(configData) {
    this.configCache = configData;
    this.configLastUpdate = Date.now();
  }

  /**
   * 获取默认配置
   */
  async getDefaultConfig() {
    return {
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      showExtractedTags: true,
      showRating: true,
      showDescription: true,
      compactMode: false,
      enableImagePreview: true,
      showExtractionProgress: true,
      enableContentFilter: false,
      contentFilterKeywords: []
    };
  }

  /**
   * 降级模式初始化
   */
  async initFallbackMode() {
    console.warn('启动降级模式');
    this.configCache = {
      config: await this.getDefaultConfig(),
      metadata: {
        architecture: 'fallback',
        version: '2.0.0',
        isDefault: true,
        fallbackMode: true
      }
    };
    this.serviceHealth.status = SERVICE_STATUS.DEGRADED;
  }

  // ===================== 工具方法 =====================

  /**
   * 更新收藏按钮状态
   */
  updateFavoriteButton(url) {
    const cardId = this.generateCardId(url);
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!card) return;

    const favoriteBtn = card.querySelector('.favorite-btn');
    if (!favoriteBtn) return;

    const isFavorited = favoritesManager.isFavorited(url);
    
    favoriteBtn.classList.toggle('favorited', isFavorited);
    favoriteBtn.title = isFavorited ? '取消收藏' : '添加收藏';
    
    const icon = favoriteBtn.querySelector('.btn-icon');
    const text = favoriteBtn.querySelector('.btn-text');
    
    if (icon) icon.textContent = isFavorited ? '★' : '☆';
    if (text) text.textContent = isFavorited ? '已收藏' : '收藏';
  }

  /**
   * 更新所有收藏按钮状态
   */
  updateAllFavoriteButtons() {
    for (const url of this.activeCards.keys()) {
      this.updateFavoriteButton(url);
    }
  }

  /**
   * 生成卡片ID
   */
  generateCardId(url) {
    return 'detail_card_' + btoa(encodeURIComponent(url)).substring(0, 16);
  }

  /**
   * 获取解析器图标
   */
  getParserIcon(parser) {
    const icons = {
      'javbus': '🎬',
      'javdb': '📚',
      'jable': '📺',
      'javmost': '🎦',
      'javgg': '⚡',
      'sukebei': '🌙',
      'javguru': '🎭',
      'generic': '📄'
    };
    return icons[parser] || icons.generic;
  }

  /**
   * 获取服务状态图标
   */
  getServiceStatusIcon(status) {
    const icons = {
      [SERVICE_STATUS.HEALTHY]: '✅',
      [SERVICE_STATUS.DEGRADED]: '⚠️',
      [SERVICE_STATUS.ERROR]: '❌',
      [SERVICE_STATUS.MAINTENANCE]: '🔧'
    };
    return icons[status] || '❓';
  }

  /**
   * 获取服务状态文本
   */
  getServiceStatusText(status) {
    const texts = {
      [SERVICE_STATUS.HEALTHY]: '服务正常',
      [SERVICE_STATUS.DEGRADED]: '服务降级',
      [SERVICE_STATUS.ERROR]: '服务异常',
      [SERVICE_STATUS.MAINTENANCE]: '维护中'
    };
    return texts[status] || '状态未知';
  }

  /**
   * 获取源类型图标
   */
  getSourceTypeIcon(sourceType) {
    const icons = {
      'javbus': '🎬',
      'javdb': '📚',
      'javlibrary': '📖',
      'jable': '📺',
      'javmost': '🎦',
      'sukebei': '🌙',
      'generic': '📄'
    };
    
    return icons[sourceType] || icons.generic;
  }

  /**
   * 获取状态文本
   */
  getStatusText(status) {
    const statusTexts = {
      'success': '提取成功',
      'cached': '缓存数据',
      'error': '提取失败',
      'partial': '部分成功',
      'timeout': '提取超时',
      'unknown': '未知状态'
    };
    return statusTexts[status] || '未知状态';
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const statusIcons = {
      'success': '✅',
      'cached': '💾',
      'error': '❌',
      'partial': '⚠️',
      'timeout': 'ⱱ',
      'unknown': '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 获取下载类型图标
   */
  getDownloadTypeIcon(type) {
    const typeIcons = {
      'magnet': '🧲',
      'torrent': '📁',
      'ed2k': '🔗',
      'ftp': '📂',
      'baidu_pan': '☁️',
      'google_drive': '💾',
      'http': '🌐'
    };
    return typeIcons[type] || '📄';
  }

  /**
   * 生成星级评分HTML
   */
  generateStarsHTML(rating) {
    const stars = Math.round(rating / 2);
    const fullStars = Math.floor(stars);
    const hasHalfStar = stars % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHTML = '';
    
    for (let i = 0; i < fullStars; i++) {
      starsHTML += '<span class="star star-full">★</span>';
    }
    
    if (hasHalfStar) {
      starsHTML += '<span class="star star-half">☆</span>';
    }
    
    for (let i = 0; i < emptyStars; i++) {
      starsHTML += '<span class="star star-empty">☆</span>';
    }

    return starsHTML;
  }

  /**
   * 检查是否有元数据
   */
  hasMetadata(detailInfo) {
    const metaFields = ['releaseDate', 'duration', 'director', 'studio', 'label', 'series', 'quality', 'fileSize', 'rating'];
    return metaFields.some(field => detailInfo[field]);
  }

  /**
   * 应用内容过滤
   */
  applyContentFilter(detailInfo, keywords) {
    const checkFields = [
      detailInfo.title,
      detailInfo.description,
      ...(detailInfo.tags || []),
      ...(detailInfo.actors || []).map(a => a.name || a)
    ].filter(Boolean);
    
    const content = checkFields.join(' ').toLowerCase();
    
    for (const keyword of keywords) {
      if (content.includes(keyword.toLowerCase())) {
        return {
          blocked: true,
          reason: `包含敏感词汇: ${keyword}`,
          keyword
        };
      }
    }
    
    return { blocked: false };
  }

  /**
   * 记录性能指标
   */
  recordPerformanceMetric(metric, value) {
    if (!this.performanceMetrics[metric]) {
      this.performanceMetrics[metric] = [];
    }
    
    this.performanceMetrics[metric].push(value);
    
    if (this.performanceMetrics[metric].length > 100) {
      this.performanceMetrics[metric].shift();
    }
  }

  /**
   * 初始化性能监控
   */
  initPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name.includes('detail-card')) {
            this.recordPerformanceMetric('renderTime', entry.duration);
          }
        }
      });
      
      observer.observe({ entryTypes: ['measure'] });
    }
  }

  /**
   * 获取性能统计 - 增强新架构指标
   */
  getPerformanceStats() {
    const stats = {};
    
    for (const [metric, values] of Object.entries(this.performanceMetrics)) {
      if (Array.isArray(values) && values.length > 0) {
        stats[metric] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      } else {
        stats[metric] = values;
      }
    }
    
    return {
      ...stats,
      activeCardsCount: this.activeCards.size,
      configManagerAvailable: !!this.configManager,
      serviceHealth: this.serviceHealth,
      // 新架构性能指标
      architectureMetrics: this.performanceMetrics.architectureMetrics,
      parserPerformance: this.getParserStats(),
      configCacheHitRate: this.performanceMetrics.configFetches > 0 ? 
        (this.performanceMetrics.cacheHits / this.performanceMetrics.configFetches * 100).toFixed(1) : 0
    };
  }

  /**
   * 导出服务状态 - 增强新架构信息
   */
  exportServiceStatus() {
    return {
      type: 'detail-card-manager',
      version: this.version,
      architecture: 'modular_parsers',
      serviceHealth: this.serviceHealth,
      performanceMetrics: {
        ...this.performanceMetrics,
        parserPerformance: Object.fromEntries(this.performanceMetrics.parserPerformance)
      },
      configStatus: {
        hasConfigManager: !!this.configManager,
        cacheValid: this.isConfigCacheValid(),
        lastUpdate: this.configLastUpdate,
        configSource: this.configCache?.metadata?._configSource || 'unknown'
      },
      activeCards: this.activeCards.size,
      timestamp: Date.now(),
      features: {
        modularParsers: true,
        dynamicConfiguration: true,
        unifiedDataStructure: true,
        enhancedQualityIndicators: true,
        parserValidation: true,
        serviceHealthMonitoring: true,
        configurationCaching: true,
        architectureMetrics: true
      }
    };
  }

  // ===================== 生命周期方法 =====================

  /**
   * 清理资源 - 增强新架构清理
   */
  cleanup() {
    this.activeCards.clear();
    this.cardInstances.clear();
    
    // 清理新架构资源
    this.configCache = null;
    this.configLastUpdate = 0;
    this.performanceMetrics.parserPerformance.clear();
    
    this.performanceMetrics = {
      renderTime: [],
      interactionCount: 0,
      errorCount: 0,
      configFetches: 0,
      cacheHits: 0,
      parserPerformance: new Map(),
      dataStructureVersion: '2.0',
      architectureMetrics: {
        totalCards: 0,
        modularParserCards: 0,
        unifiedDataCards: 0
      }
    };
    
    if (window.detailCardManager) {
      delete window.detailCardManager;
    }
    
    console.log('详情卡片管理器已清理 (新架构 v2.0.0)');
  }

  /**
   * 获取服务状态 - 增强新架构信息
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      activeCardsCount: this.activeCards.size,
      configManagerAvailable: !!this.configManager,
      configCacheValid: this.isConfigCacheValid(),
      serviceHealth: this.serviceHealth,
      performanceStats: this.getPerformanceStats(),
      version: this.version,
      architecture: 'modular_parsers',
      features: {
        configIntegration: true,
        performanceMonitoring: true,
        imagePreview: true,
        galleryMode: true,
        contentFiltering: true,
        qualityIndicators: true,
        // 新架构特性
        modularParsers: true,
        dynamicConfiguration: true,
        unifiedDataStructure: true,
        parserValidation: true,
        serviceHealthMonitoring: true,
        enhancedErrorHandling: true,
        architectureMetrics: true
      }
    };
  }

  /**
   * 重新初始化 - 适配新架构
   */
  async reinitialize() {
    console.log('重新初始化详情卡片管理器 (新架构 v2.0.0)...');
    
    this.cleanup();
    this.isInitialized = false;
    
    await this.init();
    
    console.log('详情卡片管理器重新初始化完成 (新架构 v2.0.0)');
  }
}

// 创建全局实例
export const detailCardManager = new DetailCardManager();
export default detailCardManager;