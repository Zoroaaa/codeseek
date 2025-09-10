// src/components/detail-card.js - 详情展示卡片组件
import { escapeHtml, formatRelativeTime, formatFileSize } from '../utils/format.js';
import { showToast } from '../utils/dom.js';
import authManager from '../services/auth.js';
import detailAPIService from '../services/detail-api.js';
import favoritesManager from './favorites.js';

export class DetailCardManager {
  constructor() {
    this.isInitialized = false;
    this.activeCards = new Map();
    this.defaultConfig = {
      showScreenshots: true,
      showDownloadLinks: true,
      showMagnetLinks: true,
      showActressInfo: true,
      enableImagePreview: true,
      compactMode: false
    };
  }

  async init() {
    if (this.isInitialized) return;

    try {
      // 加载用户配置
      await this.loadUserConfig();
      this.bindGlobalEvents();
      this.isInitialized = true;
      console.log('详情卡片管理器初始化完成');
    } catch (error) {
      console.error('详情卡片管理器初始化失败:', error);
    }
  }

  /**
   * 创建详情卡片HTML
   * @param {Object} searchResult - 搜索结果
   * @param {Object} detailInfo - 详情信息
   * @param {Object} options - 显示选项
   * @returns {string} HTML字符串
   */
  createDetailCardHTML(searchResult, detailInfo, options = {}) {
    const config = { ...this.defaultConfig, ...options };
    const cardId = this.generateCardId(searchResult.url);
    
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
    const actionsHTML = this.createActionsHTML(searchResult, detailInfo);
    
    // 状态指示器
    const statusHTML = this.createStatusHTML(detailInfo);

    return `
      <div class="detail-card ${config.compactMode ? 'compact' : ''}" 
           data-card-id="${cardId}" 
           data-url="${escapeHtml(searchResult.url)}">
        
        <!-- 状态指示器 -->
        ${statusHTML}
        
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
          </small>
        </div>
      </div>
    `;
  }

  /**
   * 创建基本信息HTML
   * @param {Object} searchResult - 搜索结果
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
   */
  createBasicInfoHTML(searchResult, detailInfo) {
    const title = detailInfo.title || searchResult.title || '未知标题';
    const code = detailInfo.code || '未知编号';
    const originalTitle = detailInfo.originalTitle || '';

    return `
      <div class="detail-basic-info">
        <h3 class="detail-title" title="${escapeHtml(title)}">
          ${escapeHtml(title)}
        </h3>
        
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

  /**
   * 创建媒体信息HTML
   * @param {Object} detailInfo - 详情信息
   * @param {Object} config - 配置选项
   * @returns {string} HTML字符串
   */
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
             ${config.enableImagePreview ? 'onclick="window.detailCardManager.previewImage(this.src)"' : ''}>
      </div>
    ` : '';

    const descriptionHTML = detailInfo.description ? `
      <div class="detail-description">
        <h4>简介:</h4>
        <p class="description-text">${escapeHtml(detailInfo.description)}</p>
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
   * 创建元数据HTML
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
   */
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

  /**
   * 创建演员信息HTML
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
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
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
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
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
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
   * 创建截图预览HTML
   * @param {Object} detailInfo - 详情信息
   * @param {Object} config - 配置选项
   * @returns {string} HTML字符串
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
             ${config.enableImagePreview ? `onclick="window.detailCardManager.previewImage('${escapeHtml(screenshot)}')"` : ''}>
      </div>
    `).join('');

    return `
      <div class="detail-screenshots">
        <h4>截图预览:</h4>
        <div class="screenshots-grid">
          ${screenshotsHTML}
        </div>
      </div>
    `;
  }

  /**
   * 创建详细信息HTML
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
   */
  createDetailsHTML(detailInfo) {
    const tagsHTML = detailInfo.tags && detailInfo.tags.length > 0 ? `
      <div class="detail-tags">
        <h4>标签:</h4>
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

  /**
   * 创建操作按钮HTML
   * @param {Object} searchResult - 搜索结果
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
   */
  createActionsHTML(searchResult, detailInfo) {
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
      </div>
    `;
  }

  /**
   * 创建状态指示器HTML
   * @param {Object} detailInfo - 详情信息
   * @returns {string} HTML字符串
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
      </div>
    `;
  }

  // ===================== 事件处理方法 =====================

  /**
   * 切换收藏状态
   * @param {string} url - 搜索结果URL
   */
  async toggleFavorite(url) {
    if (!authManager.isAuthenticated()) {
      showToast('请先登录后再收藏', 'error');
      return;
    }

    try {
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
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 分享详情
   * @param {string} url - 搜索结果URL
   */
  async shareDetail(url) {
    try {
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
        await navigator.clipboard.writeText(url);
        showToast('链接已复制到剪贴板', 'success');
      }

    } catch (error) {
      console.error('分享失败:', error);
      showToast('分享失败', 'error');
    }
  }

  /**
   * 刷新详情
   * @param {string} url - 搜索结果URL
   */
  async refreshDetail(url) {
    try {
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
      this.renderDetailCard(result.searchResult, detailInfo);
      
      showToast('详情刷新成功', 'success');

    } catch (error) {
      console.error('刷新详情失败:', error);
      showToast('刷新失败: ' + error.message, 'error');
    }
  }

  /**
   * 打开原页面
   * @param {string} url - 原页面URL
   */
  openOriginal(url) {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
      showToast('已在新标签页打开原页面', 'success');
    } catch (error) {
      console.error('打开原页面失败:', error);
      showToast('无法打开原页面', 'error');
    }
  }

  /**
   * 复制磁力链接
   * @param {string} magnetLink - 磁力链接
   */
  async copyMagnetLink(magnetLink) {
    try {
      await navigator.clipboard.writeText(magnetLink);
      showToast('磁力链接已复制到剪贴板', 'success');
      
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('copy_magnet', { magnetLink });
      }
    } catch (error) {
      console.error('复制磁力链接失败:', error);
      showToast('复制失败', 'error');
    }
  }

  /**
   * 记录下载点击
   * @param {string} downloadUrl - 下载URL
   * @param {string} type - 下载类型
   */
  async recordDownloadClick(downloadUrl, type) {
    try {
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('download_click', { downloadUrl, type });
      }
    } catch (error) {
      console.error('记录下载点击失败:', error);
    }
  }

  /**
   * 记录磁力链接点击
   * @param {string} magnetLink - 磁力链接
   */
  async recordMagnetClick(magnetLink) {
    try {
      if (authManager.isAuthenticated()) {
        await apiService.recordAction('magnet_click', { magnetLink });
      }
    } catch (error) {
      console.error('记录磁力点击失败:', error);
    }
  }

  /**
   * 预览图片
   * @param {string} imageSrc - 图片URL
   */
  previewImage(imageSrc) {
    try {
      // 创建图片预览模态框
      const modal = document.createElement('div');
      modal.className = 'image-preview-modal';
      modal.innerHTML = `
        <div class="image-preview-backdrop" onclick="this.parentElement.remove()">
          <div class="image-preview-container">
            <img src="${escapeHtml(imageSrc)}" alt="图片预览" class="preview-image">
            <button class="preview-close-btn" onclick="this.closest('.image-preview-modal').remove()">×</button>
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
      showToast('无法预览图片', 'error');
    }
  }

  // ===================== 工具方法 =====================

  /**
   * 生成卡片ID
   * @param {string} url - URL
   * @returns {string} 卡片ID
   */
  generateCardId(url) {
    return 'detail_card_' + btoa(url).substring(0, 16);
  }

  /**
   * 获取状态文本
   * @param {string} status - 状态
   * @returns {string} 状态文本
   */
  getStatusText(status) {
    const statusTexts = {
      'success': '提取成功',
      'cached': '缓存数据',
      'error': '提取失败',
      'unknown': '未知状态'
    };
    return statusTexts[status] || '未知状态';
  }

  /**
   * 获取状态图标
   * @param {string} status - 状态
   * @returns {string} 状态图标
   */
  getStatusIcon(status) {
    const statusIcons = {
      'success': '✅',
      'cached': '💾',
      'error': '❌',
      'unknown': '❓'
    };
    return statusIcons[status] || '❓';
  }

  /**
   * 获取下载类型图标
   * @param {string} type - 下载类型
   * @returns {string} 类型图标
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
   * @param {number} rating - 评分(0-10)
   * @returns {string} 星级HTML
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
   * 更新收藏按钮状态
   * @param {string} url - 搜索结果URL
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
   * @param {Object} searchResult - 搜索结果
   * @param {Object} detailInfo - 详情信息
   * @param {string|Element} container - 容器选择器或元素
   * @param {Object} options - 渲染选项
   */
  renderDetailCard(searchResult, detailInfo, container, options = {}) {
    try {
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

    } catch (error) {
      console.error('渲染详情卡片失败:', error);
      throw error;
    }
  }

  /**
   * 绑定卡片事件
   * @param {string} url - 搜索结果URL
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

    // 绑定其他交互事件
    // 这里可以添加更多的事件绑定逻辑
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
      previewImage: (imageSrc) => this.previewImage(imageSrc)
    };

    // 监听收藏变化事件
    document.addEventListener('favoritesChanged', () => {
      this.updateAllFavoriteButtons();
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
        const config = await detailAPIService.getConfig();
        this.defaultConfig = {
          ...this.defaultConfig,
          ...config
        };
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.activeCards.clear();
    
    // 移除全局方法
    if (window.detailCardManager) {
      delete window.detailCardManager;
    }
  }
}

// 创建全局实例
export const detailCardManager = new DetailCardManager();
export default detailCardManager;