// 增强的搜索界面组件 - 支持搜索源状态显示
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import searchService from '../services/search.js';

export class EnhancedSearchUI {
  constructor(searchManager) {
    this.searchManager = searchManager;
    this.currentResults = [];
  }

  /**
   * 创建增强的搜索结果HTML - 包含详细的源状态信息
   */
  createEnhancedResultHTML(result) {
    const isFavorited = this.searchManager.favoritesManager?.isFavorited(result.url) || false;
    const showStatus = result.hasOwnProperty('available');
    
    // 质量指标
    const qualityScore = result.qualityScore || 50;
    const recommendLevel = result.recommendLevel || 'fair';
    
    // 状态指示器
    let statusIndicator = '';
    if (showStatus) {
      const statusInfo = this.buildStatusIndicator(result);
      statusIndicator = statusInfo.html;
    }
    
    // 质量评分条
    const qualityBar = this.buildQualityBar(qualityScore, recommendLevel);
    
    // 推荐标签
    const recommendBadge = this.buildRecommendBadge(recommendLevel);
    
    return `
      <div class="result-item enhanced ${this.getResultItemClasses(result)}" 
           data-id="${result.id}" 
           data-quality="${qualityScore}"
           data-recommend="${recommendLevel}">
        
        <div class="result-header">
          <div class="result-image">
            <span style="font-size: 2rem;">${result.icon}</span>
            ${recommendBadge}
          </div>
          
          <div class="result-content">
            <div class="result-title">
              ${escapeHtml(result.title)}
              ${statusIndicator}
            </div>
            <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
            
            <!-- 质量指标 -->
            <div class="result-quality">
              <div class="quality-score">
                <span class="quality-label">质量评分:</span>
                ${qualityBar}
                <span class="quality-value">${qualityScore}%</span>
              </div>
              
              ${result.reliability !== undefined ? `
                <div class="reliability-info">
                  <span class="reliability-label">可靠性:</span>
                  <div class="reliability-bar">
                    <div class="reliability-fill" style="width: ${result.reliability * 100}%"></div>
                  </div>
                  <span class="reliability-value">${Math.round(result.reliability * 100)}%</span>
                </div>
              ` : ''}
            </div>
            
            <div class="result-url" title="${escapeHtml(result.url)}">
              ${this.truncateUrl(result.url)}
            </div>
            
            <div class="result-meta">
              <span class="result-source">${result.source}</span>
              <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
              ${result.responseTime ? `<span class="response-time">${result.responseTime}ms</span>` : ''}
              ${result.lastChecked ? `<span class="last-checked">检查于 ${new Date(result.lastChecked).toLocaleTimeString()}</span>` : ''}
            </div>
          </div>
        </div>
        
        <div class="result-actions">
          <button class="action-btn visit-btn ${this.getVisitButtonClass(result)}" 
                  data-action="visit" data-url="${escapeHtml(result.url)}" data-source="${result.source}"
                  ${result.available === false ? 'disabled title="搜索源当前不可用"' : ''}
                  title="${this.getVisitButtonTooltip(result)}">
            <span>访问</span>
          </button>
          
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          
          <button class="action-btn copy-btn" data-action="copy" data-url="${escapeHtml(result.url)}">
            <span>复制</span>
          </button>
          
          ${showStatus ? `
            <button class="action-btn status-btn" data-action="recheck" data-result-id="${result.id}" 
                    title="重新检查状态">
              <span>🔄</span>
            </button>
            
            <button class="action-btn info-btn" data-action="detail" data-result-id="${result.id}" 
                    title="查看详细信息">
              <span>ℹ️</span>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 构建状态指示器
   */
  buildStatusIndicator(result) {
    const statusClass = this.getStatusClass(result.status);
    const statusText = this.getStatusText(result.status, result.available);
    const responseTimeText = result.responseTime ? ` (${result.responseTime}ms)` : '';
    
    return {
      html: `
        <div class="result-status ${statusClass}" title="${statusText}${responseTimeText}">
          <span class="status-dot"></span>
          <span class="status-text">${statusText}</span>
        </div>
      `,
      class: statusClass,
      text: statusText
    };
  }

  /**
   * 构建质量评分条
   */
  buildQualityBar(score, level) {
    const color = this.getQualityColor(level);
    return `
      <div class="quality-bar">
        <div class="quality-fill ${level}" style="width: ${score}%; background-color: ${color}"></div>
      </div>
    `;
  }

  /**
   * 构建推荐标签
   */
  buildRecommendBadge(level) {
    const badges = {
      excellent: { text: '优秀', class: 'badge-excellent' },
      good: { text: '良好', class: 'badge-good' },
      fair: { text: '一般', class: 'badge-fair' },
      poor: { text: '较差', class: 'badge-poor' }
    };

    const badge = badges[level] || badges.fair;
    
    if (level === 'excellent' || level === 'good') {
      return `<div class="recommend-badge ${badge.class}">${badge.text}</div>`;
    }
    
    return '';
  }

  /**
   * 获取结果项CSS类
   */
  getResultItemClasses(result) {
    const classes = [];
    
    if (result.available === false) classes.push('result-unavailable');
    if (result.recommendLevel === 'excellent') classes.push('result-excellent');
    if (result.recommendLevel === 'poor') classes.push('result-poor');
    if (result.responseTime && result.responseTime > 8000) classes.push('result-slow');
    
    return classes.join(' ');
  }

  /**
   * 获取访问按钮CSS类
   */
  getVisitButtonClass(result) {
    const classes = [];
    
    if (result.available === false) classes.push('disabled');
    if (result.recommendLevel === 'excellent') classes.push('btn-excellent');
    if (result.recommendLevel === 'poor') classes.push('btn-poor');
    
    return classes.join(' ');
  }

  /**
   * 获取访问按钮提示文字
   */
  getVisitButtonTooltip(result) {
    if (result.available === false) {
      return '搜索源当前不可用，可能无法正常访问';
    }
    
    if (result.recommendLevel === 'excellent') {
      return '推荐访问 - 该搜索源质量优秀';
    }
    
    if (result.recommendLevel === 'poor') {
      return '谨慎访问 - 该搜索源可能存在问题';
    }
    
    return '点击访问该搜索源';
  }

  /**
   * 获取状态CSS类
   */
  getStatusClass(status) {
    const statusClasses = {
      online: 'status-online',
      offline: 'status-offline',
      error: 'status-error',
      timeout: 'status-timeout',
      checking: 'status-checking',
      partial: 'status-partial',
      search_failed: 'status-search-failed',
      dns_failed: 'status-dns-failed'
    };
    
    return statusClasses[status] || 'status-unknown';
  }

  /**
   * 获取状态文本
   */
  getStatusText(status, available) {
    if (available === true) {
      if (status === 'partial') return '部分可用';
      return '可用';
    }
    
    if (available === false) {
      const statusTexts = {
        timeout: '超时',
        error: '错误',
        offline: '离线',
        search_failed: '搜索失败',
        dns_failed: 'DNS失败'
      };
      return statusTexts[status] || '不可用';
    }
    
    return '未检查';
  }

  /**
   * 获取质量颜色
   */
  getQualityColor(level) {
    const colors = {
      excellent: '#10b981', // 绿色
      good: '#3b82f6',      // 蓝色
      fair: '#f59e0b',      // 黄色
      poor: '#ef4444'       // 红色
    };
    
    return colors[level] || colors.fair;
  }

  /**
   * 创建搜索结果统计信息
   */
  createResultsStats(results, checkedSources = null) {
    if (!results || results.length === 0) return '';
    
    const available = results.filter(r => r.available !== false).length;
    const excellent = results.filter(r => r.recommendLevel === 'excellent').length;
    const avgQuality = results.reduce((sum, r) => sum + (r.qualityScore || 50), 0) / results.length;
    
    let statsHtml = `
      <div class="results-stats">
        <div class="stats-item">
          <span class="stats-label">搜索结果:</span>
          <span class="stats-value">${results.length} 个</span>
        </div>
        
        <div class="stats-item">
          <span class="stats-label">可用源:</span>
          <span class="stats-value ${available === results.length ? 'all-available' : ''}">${available}/${results.length}</span>
        </div>
        
        <div class="stats-item">
          <span class="stats-label">优质源:</span>
          <span class="stats-value">${excellent} 个</span>
        </div>
        
        <div class="stats-item">
          <span class="stats-label">平均质量:</span>
          <span class="stats-value quality-${this.getQualityLevel(avgQuality)}">${Math.round(avgQuality)}%</span>
        </div>
      </div>
    `;
    
    if (checkedSources) {
      const checkStats = this.buildCheckStats(checkedSources);
      statsHtml += checkStats;
    }
    
    return statsHtml;
  }

  /**
   * 构建检查统计信息
   */
  buildCheckStats(sources) {
    const totalChecked = sources.length;
    const onlineCount = sources.filter(s => s.status === 'online').length;
    const partialCount = sources.filter(s => s.status === 'partial').length;
    const offlineCount = sources.filter(s => s.available === false).length;
    const avgResponseTime = sources
      .filter(s => s.responseTime)
      .reduce((sum, s) => sum + s.responseTime, 0) / 
      Math.max(sources.filter(s => s.responseTime).length, 1);

    return `
      <div class="check-stats">
        <div class="check-stats-title">搜索源检查详情:</div>
        <div class="check-stats-grid">
          <div class="check-stat-item online">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <div class="stat-label">完全在线</div>
              <div class="stat-value">${onlineCount}</div>
            </div>
          </div>
          
          ${partialCount > 0 ? `
            <div class="check-stat-item partial">
              <div class="stat-icon">⚠️</div>
              <div class="stat-info">
                <div class="stat-label">部分可用</div>
                <div class="stat-value">${partialCount}</div>
              </div>
            </div>
          ` : ''}
          
          ${offlineCount > 0 ? `
            <div class="check-stat-item offline">
              <div class="stat-icon">❌</div>
              <div class="stat-info">
                <div class="stat-label">离线</div>
                <div class="stat-value">${offlineCount}</div>
              </div>
            </div>
          ` : ''}
          
          <div class="check-stat-item response-time">
            <div class="stat-icon">⏱️</div>
            <div class="stat-info">
              <div class="stat-label">平均响应</div>
              <div class="stat-value">${Math.round(avgResponseTime)}ms</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建搜索源状态面板
   */
  createSourceStatusPanel(sources) {
    if (!sources || sources.length === 0) return '';

    const sortedSources = [...sources].sort((a, b) => {
      // 按质量评分降序排列
      const scoreA = a.qualityScore || 50;
      const scoreB = b.qualityScore || 50;
      return scoreB - scoreA;
    });

    return `
      <div class="source-status-panel">
        <div class="panel-header">
          <h3>搜索源状态</h3>
          <button class="refresh-all-btn" onclick="searchManager.refreshAllSources()">
            刷新全部
          </button>
        </div>
        
        <div class="source-status-list">
          ${sortedSources.map(source => `
            <div class="source-status-item ${this.getStatusClass(source.status)}">
              <div class="source-info">
                <span class="source-icon">${source.icon}</span>
                <span class="source-name">${escapeHtml(source.name)}</span>
                <span class="source-status">${this.getStatusText(source.status, source.available)}</span>
              </div>
              
              <div class="source-metrics">
                ${source.responseTime ? `<span class="response-time">${source.responseTime}ms</span>` : ''}
                ${source.reliability !== undefined ? `<span class="reliability">${Math.round(source.reliability * 100)}%</span>` : ''}
                <span class="quality-score">${source.qualityScore || 50}%</span>
              </div>
              
              <div class="source-actions">
                <button class="mini-btn test-btn" onclick="searchManager.testSingleSource('${source.id}')">测试</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * 显示详细的源状态信息
   */
  showSourceDetailModal(source) {
    const modalHtml = `
      <div id="sourceDetailModal" class="modal source-detail-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>${escapeHtml(source.name)} - 详细状态</h2>
            <span class="close">&times;</span>
          </div>
          
          <div class="modal-body">
            <div class="source-detail-grid">
              <!-- 基本信息 -->
              <div class="detail-section">
                <h3>基本信息</h3>
                <div class="detail-item">
                  <span class="detail-label">名称:</span>
                  <span class="detail-value">${escapeHtml(source.name)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">描述:</span>
                  <span class="detail-value">${escapeHtml(source.subtitle || '')}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">URL模板:</span>
                  <span class="detail-value">${escapeHtml(source.urlTemplate)}</span>
                </div>
              </div>
              
              <!-- 状态信息 -->
              <div class="detail-section">
                <h3>当前状态</h3>
                <div class="detail-item">
                  <span class="detail-label">可用性:</span>
                  <span class="detail-value ${source.available ? 'available' : 'unavailable'}">
                    ${source.available ? '✅ 可用' : '❌ 不可用'}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">状态:</span>
                  <span class="detail-value">${this.getStatusText(source.status, source.available)}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">最后检查:</span>
                  <span class="detail-value">${source.lastChecked ? new Date(source.lastChecked).toLocaleString() : '未检查'}</span>
                </div>
              </div>
              
              <!-- 性能指标 -->
              <div class="detail-section">
                <h3>性能指标</h3>
                <div class="detail-item">
                  <span class="detail-label">响应时间:</span>
                  <span class="detail-value">${source.responseTime ? source.responseTime + 'ms' : '未知'}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">可靠性:</span>
                  <span class="detail-value">
                    ${source.reliability !== undefined ? Math.round(source.reliability * 100) + '%' : '未知'}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">质量评分:</span>
                  <span class="detail-value quality-${this.getQualityLevel(source.qualityScore || 50)}">
                    ${source.qualityScore || 50}%
                  </span>
                </div>
              </div>
              
              ${source.details ? `
                <!-- 检查详情 -->
                <div class="detail-section">
                  <h3>检查详情</h3>
                  ${Object.entries(source.details).map(([key, value]) => `
                    <div class="detail-item">
                      <span class="detail-label">${key}:</span>
                      <span class="detail-value">${JSON.stringify(value)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" onclick="this.closest('.modal').style.display='none'">关闭</button>
            <button class="btn-primary" onclick="searchManager.performDetailedSourceCheck('${source.id}')">重新检查</button>
          </div>
        </div>
      </div>
    `;

    // 移除已存在的模态框
    const existingModal = document.getElementById('sourceDetailModal');
    if (existingModal) {
      existingModal.remove();
    }

    // 添加新的模态框
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // 显示模态框
    const modal = document.getElementById('sourceDetailModal');
    modal.style.display = 'block';

    // 绑定关闭事件
    modal.querySelector('.close').onclick = () => {
      modal.style.display = 'none';
    };

    window.onclick = (event) => {
      if (event.target === modal) {
        modal.style.display = 'none';
      }
    };
  }

  /**
   * 获取质量等级
   */
  getQualityLevel(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  /**
   * 截断URL显示
   */
  truncateUrl(url, maxLength = 60) {
    if (url.length <= maxLength) return escapeHtml(url);
    
    const start = url.substring(0, maxLength / 2);
    const end = url.substring(url.length - maxLength / 2);
    return escapeHtml(start + '...' + end);
  }
}

export default EnhancedSearchUI;