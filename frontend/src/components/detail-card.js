// src/components/detail-card.js - 完善的详情展示卡片组件
import { escapeHtml, formatRelativeTime, formatFileSize } from '../utils/format.js';
import { showToast } from '../utils/dom.js';
import authManager from '../services/auth.js';
import detailAPIService from '../services/detail-api.js';
import favoritesManager from './favorites.js';
import apiService from '../services/api.js';

export class DetailCardManager {
  constructor() {
    this.isInitialized = false;
    this.activeCards = new Map();
    this.cardInstances = new Map(); // 新增：跟踪卡片实例
    this.defaultConfig = {
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      enableImagePreview: true,
      compactMode: false,
      enableContentFilter: false,
      contentFilterKeywords: []
    };
    
    // 新增：性能监控
    this.performanceMetrics = {
      renderTime: [],
      interactionCount: 0,
      errorCount: 0
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 加载用户配置
      await this.loadUserConfig();
      
      // 绑定全局事件
      this.bindGlobalEvents();
      
      // 初始化性能监控
      this.initPerformanceMonitoring();
      
      this.isInitialized = true;
      console.log('详情卡片管理器初始化完成');
    } catch (error) {
      console.error('详情卡片管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建详情卡片HTML - 完善版本
   * @param {Object} searchResult - 搜索结果
   * @param {Object} detailInfo - 详情信息
   * @param {Object} options - 显示选项
   * @returns {string} HTML字符串
   */
  createDetailCardHTML(searchResult, detailInfo, options = {}) {
    const startTime = performance.now();
    
    try {
      const config = { ...this.defaultConfig, ...options };
      const cardId = this.generateCardId(searchResult.url);
      
      // 内容过滤处理
      if (config.enableContentFilter && config.contentFilterKeywords.length > 0) {
        const filtered = this.applyContentFilter(detailInfo, config.contentFilterKeywords);
        if (filtered.blocked) {
          return this.createFilteredContentHTML(cardId, filtered.reason);
        }
      }
      
      // 基本信息部分
      const basicInfoHTML = this.createBasicInfoHTML(searchResult, detailInfo);
      
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
      
      // 操作按钮部分
      const actionsHTML = this.createActionsHTML(searchResult, detailInfo, config);
      
      // 状态指示器
      const statusHTML = this.createStatusHTML(detailInfo);
      
      // 提取质量评分
      const qualityHTML = this.createQualityIndicatorHTML(detailInfo);

      const cardHTML = `
        <div class="detail-card ${config.compactMode ? 'compact' : ''}" 
             data-card-id="${cardId}" 
             data-url="${escapeHtml(searchResult.url)}"
             data-extraction-status="${detailInfo.extractionStatus || 'unknown'}"
             data-source-type="${detailInfo.sourceType || 'generic'}">
          
          <!-- 状态指示器 -->
          ${statusHTML}
          
          <!-- 质量指示器 -->
          ${qualityHTML}
          
          <!-- 卡片头部 -->
          <div class="detail-card-header">
            ${basicInfoHTML}
            ${actionsHTML}
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
              ${detailInfo.retryCount > 0 ? ` | 重试次数: ${detailInfo.retryCount}` : ''}
            </small>
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
   * 应用内容过滤
   * @param {Object} detailInfo - 详情信息
   * @param {Array} keywords - 过滤关键词
   * @returns {Object} 过滤结果
   */
  applyContentFilter(detailInfo, keywords) {
    const checkFields = [
      detailInfo.title,
      detailInfo.description,
      ...(detailInfo.tags || []),
      ...(detailInfo.actresses || []).map(a => a.name || a)
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
   * 创建被过滤内容的HTML
   * @param {string} cardId - 卡片ID
   * @param {string} reason - 过滤原因
   * @returns {string} HTML字符串
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
   * 创建质量指示器HTML
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
   */
  createQualityIndicatorHTML(detailInfo) {
    const quality = this.calculateContentQuality(detailInfo);
    
    if (quality.score < 50) return ''; // 低质量内容不显示指示器
    
    const qualityClass = quality.score >= 80 ? 'excellent' : quality.score >= 60 ? 'good' : 'fair';
    
    return `
      <div class="detail-quality-indicator ${qualityClass}">
        <span class="quality-score">${quality.score}</span>
        <span class="quality-label">质量分</span>
        <div class="quality-details" title="${quality.details.join(', ')}">
          ${quality.indicators.map(indicator => `<span class="quality-badge">${indicator}</span>`).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 计算内容质量分数
   * @param {Object} detailInfo - 详情信息
   * @returns {Object} 质量评分结果
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
    if (detailInfo.coverImage) {
      score += 15;
      indicators.push('🖼️');
      details.push('有封面');
    }
    if (detailInfo.screenshots && detailInfo.screenshots.length > 0) {
      score += 15;
      indicators.push('📸');
      details.push(`${detailInfo.screenshots.length}张截图`);
    }
    if (detailInfo.actresses && detailInfo.actresses.length > 0) {
      score += 10;
      indicators.push('👥');
      details.push(`${detailInfo.actresses.length}位演员`);
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
    
    return {
      score: Math.round(score),
      details,
      indicators
    };
  }

  /**
   * 创建错误卡片HTML
   * @param {Object} searchResult - 搜索结果
   * @param {Error} error - 错误对象
   * @returns {string} HTML字符串
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
   * 创建基本信息HTML - 增强版本
   */
  createBasicInfoHTML(searchResult, detailInfo) {
    const title = detailInfo.title || searchResult.title || '未知标题';
    const code = detailInfo.code || '';
    const sourceType = detailInfo.sourceType || 'generic';
    
    // 添加源类型标识
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
   * 获取源类型图标
   * @param {string} sourceType - 源类型
   * @returns {string} 图标
   */
  getSourceTypeIcon(sourceType) {
    const icons = {
      'javbus': '🎬',
      'javdb': '📚',
      'javlibrary': '📖',
      'jable': '📺',
      'javmost': '🎦',
      'sukebei': '🌙',
      'generic': '🔍'
    };
    
    return icons[sourceType] || icons.generic;
  }

  /**
   * 创建媒体信息HTML - 增强版本
   */
  createMediaInfoHTML(detailInfo, config) {
    if (!detailInfo.coverImage && !detailInfo.description && !this.hasMetadata(detailInfo)) {
      return '';
    }

    const coverImageHTML = detailInfo.coverImage ? `
      <div class="detail-cover">
        <img src="${escapeHtml(detailInfo.coverImage)}" 
             alt="封面图片" 
             class="cover-image"
             loading="lazy"
             onerror="this.style.display='none'"
             ${config.enableImagePreview ? `onclick="window.detailCardManager.previewImage('${escapeHtml(detailInfo.coverImage)}', '${escapeHtml(detailInfo.title || '')}')"` : ''}>
        <div class="cover-overlay">
          <button class="cover-download-btn" onclick="window.detailCardManager.downloadImage('${escapeHtml(detailInfo.coverImage)}', '${escapeHtml(detailInfo.code || 'cover')}')" title="下载封面">
            ⬇️
          </button>
        </div>
      </div>
    ` : '';

    const descriptionHTML = detailInfo.description ? `
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
   * 检查是否有元数据
   * @param {Object} detailInfo - 详情信息
   * @returns {boolean} 是否有元数据
   */
  hasMetadata(detailInfo) {
    const metaFields = ['releaseDate', 'duration', 'director', 'studio', 'label', 'series', 'quality', 'fileSize', 'rating'];
    return metaFields.some(field => detailInfo[field]);
  }

  /**
   * 创建元数据HTML - 增强版本
   */
  createMetadataHTML(detailInfo) {
    const metadata = [];

    // 基本信息
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
        icon: '⏱️'
      });
    }

    // 制作信息
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

    // 技术信息
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
        icon: '📐'
      });
    }

    // 评分信息
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
   * 创建截图预览HTML - 增强版本
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
   * 创建操作按钮HTML - 增强版本
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
              📥 导出详情
            </button>
            <button onclick="window.detailCardManager.reportIssue('${escapeHtml(searchResult.url)}')" class="dropdown-item">
              🚩 报告问题
            </button>
            <button onclick="window.detailCardManager.copyDetailURL('${escapeHtml(searchResult.url)}')" class="dropdown-item">
              📋 复制链接
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ===================== 新增的交互方法 =====================

  /**
   * 预览截图（支持画廊模式）
   * @param {number} index - 截图索引
   * @param {Array} screenshots - 截图数组
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

      // 存储截图数据
      modal.screenshotsData = screenshots;
      
      document.body.appendChild(modal);
      
      // 键盘导航
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
   * @param {Element} element - 触发元素
   * @param {number} direction - 方向（-1向前，1向后）
   */
  navigatePreview(element, direction) {
    const modal = element.closest('.screenshots-preview-modal');
    const img = modal.querySelector('.preview-image-main');
    const counter = modal.querySelector('.preview-counter');
    const screenshots = modal.screenshotsData;
    
    let currentIndex = parseInt(img.dataset.index);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = screenshots.length - 1;
    if (newIndex >= screenshots.length) newIndex = 0;
    
    this.switchPreview(modal, newIndex);
  }

  /**
   * 切换预览图片
   * @param {Element} element - 元素或模态框
   * @param {number} index - 新的索引
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
    
    // 更新缩略图状态
    thumbnails.forEach((thumb, i) => {
      thumb.classList.toggle('active', i === index);
    });
  }

  /**
   * 下载图片
   * @param {string} imageUrl - 图片URL
   * @param {string} filename - 文件名
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
      
      // 记录用户行为
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
   * @param {Array} imageUrls - 图片URL数组
   * @param {string} baseName - 基础文件名
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
        // 添加延迟避免请求过于频繁
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
   * @param {string} url - 搜索结果URL
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
        version: '1.0.0'
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
   * @param {string} url - 搜索结果URL
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
          timestamp: Date.now()
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
   * @param {string} url - 搜索结果URL
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
   * @param {string} cardId - 卡片ID
   */
  showFilteredContent(cardId) {
    const card = document.querySelector(`[data-card-id="${cardId}"]`);
    if (!card) return;

    // 这里需要重新渲染原始内容
    // 实际实现中需要存储原始数据
    showToast('内容过滤已临时关闭', 'info');
  }

  /**
   * 重新渲染卡片
   * @param {string} url - 搜索结果URL
   */
  async retryRender(url) {
    try {
      const result = this.activeCards.get(url);
      if (!result) {
        showToast('未找到对应的详情信息', 'error');
        return;
      }

      // 重新生成HTML
      const newHTML = this.createDetailCardHTML(result.searchResult, result.detailInfo, result.options);
      
      const cardId = this.generateCardId(url);
      const existingCard = document.querySelector(`[data-card-id="${cardId}"]`);
      
      if (existingCard) {
        existingCard.outerHTML = newHTML;
        this.bindCardEvents(url);
        showToast('卡片重新生成成功', 'success');
      }

    } catch (error) {
      console.error('重新渲染失败:', error);
      showToast('重新生成失败: ' + error.message, 'error');
    }
  }

  // ===================== 性能监控方法 =====================

  /**
   * 初始化性能监控
   */
  initPerformanceMonitoring() {
    // 监控卡片渲染性能
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
   * 记录性能指标
   * @param {string} metric - 指标名称
   * @param {number} value - 指标值
   */
  recordPerformanceMetric(metric, value) {
    if (!this.performanceMetrics[metric]) {
      this.performanceMetrics[metric] = [];
    }
    
    this.performanceMetrics[metric].push(value);
    
    // 保持最近100个记录
    if (this.performanceMetrics[metric].length > 100) {
      this.performanceMetrics[metric].shift();
    }
  }

  /**
   * 获取性能统计
   * @returns {Object} 性能统计信息
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
    
    return stats;
  }

  // ===================== 原有方法保持不变 =====================
  
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

      // 更新按钮状态
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
        // 降级到复制链接
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
   * 刷新详情
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

      // 清除缓存并重新提取
      await detailAPIService.deleteCache(url);
      
      const detailInfo = await detailAPIService.extractSingleDetail(result.searchResult, {
        enableCache: false,
        useLocalCache: false
      });

      // 更新活动卡片数据
      this.activeCards.set(url, {
        ...result,
        detailInfo
      });

      // 重新渲染卡片
      this.renderDetailCard(result.searchResult, detailInfo, result.container, result.options);
      
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
      
      // 记录用户行为
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
      
      // 创建图片预览模态框
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

      // 添加键盘事件监听
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

  // ===================== 工具方法 =====================

  /**
   * 生成卡片ID
   */
  generateCardId(url) {
    return 'detail_card_' + btoa(encodeURIComponent(url)).substring(0, 16);
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
      'timeout': '⏱️',
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
    const stars = Math.round(rating / 2); // 转换为5星制
    const fullStars = Math.floor(stars);
    const hasHalfStar = stars % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHTML = '';
    
    // 实心星
    for (let i = 0; i < fullStars; i++) {
      starsHTML += '<span class="star star-full">★</span>';
    }
    
    // 半星
    if (hasHalfStar) {
      starsHTML += '<span class="star star-half">☆</span>';
    }
    
    // 空星
    for (let i = 0; i < emptyStars; i++) {
      starsHTML += '<span class="star star-empty">☆</span>';
    }

    return starsHTML;
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
   * 创建演员信息HTML
   */
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
        <h4>演员信息:</h4>
        <div class="actresses-list">
          ${actressesHTML}
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
   * 创建详细信息HTML
   */
  createDetailsHTML(detailInfo) {
    const tagsHTML = detailInfo.tags && detailInfo.tags.length > 0 ? `
      <div class="detail-tags">
        <h4>标签:</h4>
        <div class="tags-list">
          ${detailInfo.tags.map(tag => `
            <span class="tag-item" onclick="window.detailCardManager.searchByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</span>
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
   * 渲染详情卡片到指定容器
   */
  renderDetailCard(searchResult, detailInfo, container, options = {}) {
    try {
      const startTime = performance.now();
      
      const containerElement = typeof container === 'string' ? 
        document.querySelector(container) : container;
      
      if (!containerElement) {
        throw new Error('未找到指定的容器元素');
      }

      const cardHTML = this.createDetailCardHTML(searchResult, detailInfo, options);
      
      if (options.append) {
        containerElement.insertAdjacentHTML('beforeend', cardHTML);
      } else {
        containerElement.innerHTML = cardHTML;
      }

      // 保存活动卡片数据
      this.activeCards.set(searchResult.url, {
        searchResult,
        detailInfo,
        container: containerElement,
        options
      });

      // 绑定卡片事件
      this.bindCardEvents(searchResult.url);
      
      // 记录渲染性能
      const renderTime = performance.now() - startTime;
      this.recordPerformanceMetric('renderTime', renderTime);

    } catch (error) {
      console.error('渲染详情卡片失败:', error);
      this.performanceMetrics.errorCount++;
      throw error;
    }
  }

  /**
   * 绑定卡片事件
   */
  bindCardEvents(url) {
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
   * 绑定全局事件
   */
  bindGlobalEvents() {
    // 暴露全局方法
    window.detailCardManager = {
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
      getPerformanceStats: () => this.getPerformanceStats()
    };

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateAllFavoriteButtons();
    });

    // 监听详情提取配置变化
    document.addEventListener('detailExtractionConfigChanged', () => {
      this.loadUserConfig();
    });
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
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      if (authManager.isAuthenticated()) {
        const userSettings = await apiService.getUserSettings();
        this.defaultConfig = {
          ...this.defaultConfig,
          showScreenshots: userSettings.showScreenshots !== false,
          showDownloadLinks: userSettings.showDownloadLinks !== false,
          showMagnetLinks: userSettings.showMagnetLinks !== false,
          showActressInfo: userSettings.showActressInfo !== false,
          enableImagePreview: userSettings.enableImagePreview !== false,
          compactMode: userSettings.compactMode === true,
          enableContentFilter: userSettings.enableContentFilter === true,
          contentFilterKeywords: Array.isArray(userSettings.contentFilterKeywords) ? 
            userSettings.contentFilterKeywords : []
        };
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
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
      // 降级方案
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

  /**
   * 清理资源
   */
  cleanup() {
    this.activeCards.clear();
    this.cardInstances.clear();
    
    // 清理性能监控数据
    this.performanceMetrics = {
      renderTime: [],
      interactionCount: 0,
      errorCount: 0
    };
    
    // 移除全局方法
    if (window.detailCardManager) {
      delete window.detailCardManager;
    }
  }

  /**
   * 获取服务状态
   */
  getServiceStatus() {
    return {
      isInitialized: this.isInitialized,
      activeCardsCount: this.activeCards.size,
      performanceStats: this.getPerformanceStats(),
      version: '3.0.0'
    };
  }
}

// 创建全局实例
export const detailCardManager = new DetailCardManager();
export default detailCardManager;