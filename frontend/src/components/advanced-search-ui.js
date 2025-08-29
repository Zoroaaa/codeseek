// 高级搜索UI组件 - 支持多层次可用性显示和详细分析
import { escapeHtml, formatRelativeTime } from '../utils/format.js';
import { showToast } from '../utils/dom.js';

export class AdvancedSearchUI {
  constructor(searchManager) {
    this.searchManager = searchManager;
    this.currentResults = [];
    
    // 可用性等级配置
    this.availabilityLevels = {
      '优秀': { color: '#10b981', icon: '✅', bgColor: '#ecfdf5', textColor: '#065f46' },
      '良好': { color: '#3b82f6', icon: '🔵', bgColor: '#eff6ff', textColor: '#1e40af' },
      '一般': { color: '#f59e0b', icon: '⚠️', bgColor: '#fffbeb', textColor: '#92400e' },
      '较差': { color: '#f97316', icon: '🔶', bgColor: '#fff7ed', textColor: '#9a3412' },
      '故障': { color: '#ef4444', icon: '❌', bgColor: '#fef2f2', textColor: '#991b1b' }
    };
  }

  /**
   * 创建高级搜索结果HTML
   */
  createAdvancedResultHTML(result) {
    const levelConfig = this.availabilityLevels[result.availabilityLevel] || this.availabilityLevels['故障'];
    const isFavorited = this.searchManager.favoritesManager?.isFavorited(result.url) || false;
    
    return `
      <div class="result-item advanced-result ${this.getResultClasses(result)}" 
           data-id="${result.id}" 
           data-level="${result.availabilityRank || 0}">
        
        <!-- 结果头部 -->
        <div class="result-header">
          <div class="result-icon-section">
            <div class="source-icon">
              <span class="icon-emoji">${result.icon}</span>
            </div>
            <div class="availability-badge" 
                 style="background-color: ${levelConfig.bgColor}; color: ${levelConfig.textColor};">
              <span class="level-icon">${levelConfig.icon}</span>
              <span class="level-text">${result.availabilityLevel}</span>
            </div>
          </div>
          
          <div class="result-content">
            <div class="result-title-row">
              <h3 class="result-title">${escapeHtml(result.title)}</h3>
              ${this.createQualityIndicator(result)}
            </div>
            
            <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
            
            <!-- 详细状态信息 -->
            ${this.createDetailedStatus(result)}
            
            <!-- URL显示 -->
            <div class="result-url" title="${escapeHtml(result.url)}">
              ${this.truncateUrl(result.url)}
            </div>
            
            <!-- 元信息 -->
            <div class="result-meta">
              <span class="result-source">${escapeHtml(result.source)}</span>
              <span class="result-time">${formatRelativeTime(result.timestamp)}</span>
              ${result.responseTime ? `<span class="response-time">${result.responseTime}ms</span>` : ''}
              ${result.lastChecked ? `<span class="last-checked">检查于 ${new Date(result.lastChecked).toLocaleTimeString()}</span>` : ''}
            </div>
          </div>
        </div>
        
        <!-- 操作按钮 -->
        <div class="result-actions">
          <button class="action-btn visit-btn ${this.getVisitButtonClass(result)}" 
                  data-action="visit" 
                  data-url="${escapeHtml(result.url)}" 
                  data-source="${result.source}"
                  ${!result.available ? 'disabled' : ''}
                  title="${this.getVisitButtonTooltip(result)}">
            <span>访问</span>
          </button>
          
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" 
                  data-result-id="${result.id}">
            <span>${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
          
          <button class="action-btn copy-btn" 
                  data-action="copy" 
                  data-url="${escapeHtml(result.url)}">
            <span>复制</span>
          </button>
          
          <button class="action-btn recheck-btn" 
                  data-action="recheck" 
                  data-result-id="${result.id}" 
                  title="重新检查状态">
            <span>🔄</span>
          </button>
          
          <button class="action-btn detail-btn" 
                  data-action="detail" 
                  data-result-id="${result.id}" 
                  title="查看详细分析">
            <span>📊</span>
          </button>
        </div>
        
        <!-- 可折叠的详细信息面板 -->
        ${this.createCollapsibleDetails(result)}
      </div>
    `;
  }

  /**
   * 创建质量指示器
   */
  createQualityIndicator(result) {
    if (!result.finalScore) return '';
    
    const score = Math.round(result.finalScore * 100);
    const qualityClass = this.getQualityClass(result.finalScore);
    
    return `
      <div class="quality-indicator ${qualityClass}">
        <div class="quality-bar">
          <div class="quality-fill" style="width: ${score}%"></div>
        </div>
        <span class="quality-score">${score}%</span>
      </div>
    `;
  }

  /**
   * 创建详细状态信息
   */
  createDetailedStatus(result) {
    const statusItems = [];
    
    // 基础连通性
    if (result.basicScore !== undefined) {
      statusItems.push({
        label: '连通性',
        value: `${Math.round(result.basicScore * 100)}%`,
        status: result.basicConnectivity ? 'good' : 'bad'
      });
    }
    
    // 功能性
    if (result.functionalScore !== undefined) {
      statusItems.push({
        label: '功能性',
        value: `${Math.round(result.functionalScore * 100)}%`,
        status: result.functionalAvailable ? 'good' : 'bad'
      });
    }
    
    // 内容匹配
    if (result.contentScore !== undefined) {
      statusItems.push({
        label: '内容匹配',
        value: `${Math.round(result.contentScore * 100)}%`,
        status: result.contentMatched ? 'good' : 'bad'
      });
    }
    
    // 目标关键词
    if (result.targetKeyword) {
      statusItems.push({
        label: '测试词',
        value: result.targetKeyword,
        status: result.keywordPresence ? 'good' : 'neutral'
      });
    }
    
    // 预估结果数
    if (result.estimatedResults !== undefined) {
      statusItems.push({
        label: '结果数',
        value: result.estimatedResults.toString(),
        status: result.estimatedResults > 0 ? 'good' : 'bad'
      });
    }
    
    if (statusItems.length === 0) return '';
    
    return `
      <div class="detailed-status">
        ${statusItems.map(item => `
          <div class="status-item status-${item.status}">
            <span class="status-label">${item.label}:</span>
            <span class="status-value">${item.value}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 创建可折叠详细信息
   */
  createCollapsibleDetails(result) {
    if (!result.contentDetails && !result.basicDetails && !result.multiKeywordTests) {
      return '';
    }
    
    return `
      <div class="collapsible-details" id="details-${result.id}">
        <button class="details-toggle" onclick="this.parentElement.classList.toggle('expanded')">
          <span>详细分析</span>
          <span class="toggle-icon">▼</span>
        </button>
        
        <div class="details-content">
          ${this.createBasicDetails(result)}
          ${this.createContentDetails(result)}
          ${this.createDeepTestDetails(result)}
        </div>
      </div>
    `;
  }

  /**
   * 创建基础检测详情
   */
  createBasicDetails(result) {
    if (!result.basicDetails) return '';
    
    const { domainCheck, httpCheck, staticCheck } = result.basicDetails;
    
    return `
      <div class="detail-section">
        <h4>基础检测</h4>
        <div class="detail-grid">
          <div class="detail-item ${domainCheck?.success ? 'success' : 'failed'}">
            <span class="detail-label">域名解析:</span>
            <span class="detail-value">${domainCheck?.success ? '正常' : '失败'}</span>
          </div>
          <div class="detail-item ${httpCheck?.success ? 'success' : 'failed'}">
            <span class="detail-label">HTTP响应:</span>
            <span class="detail-value">${httpCheck?.success ? '正常' : '失败'}</span>
          </div>
          <div class="detail-item ${staticCheck?.success ? 'success' : 'failed'}">
            <span class="detail-label">静态资源:</span>
            <span class="detail-value">${staticCheck?.success ? '可访问' : '不可访问'}</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建内容检测详情
   */
  createContentDetails(result) {
    if (!result.contentDetails) return '';
    
    const details = result.contentDetails;
    
    return `
      <div class="detail-section">
        <h4>内容分析</h4>
        <div class="detail-grid">
          <div class="detail-item ${details.titleMatch ? 'success' : 'neutral'}">
            <span class="detail-label">标题匹配:</span>
            <span class="detail-value">${details.titleMatch ? '是' : '否'}</span>
          </div>
          <div class="detail-item ${details.directMatches > 0 ? 'success' : 'neutral'}">
            <span class="detail-label">关键词出现:</span>
            <span class="detail-value">${details.directMatches}次</span>
          </div>
          <div class="detail-item ${details.pageStructure?.hasSearchResults ? 'success' : 'neutral'}">
            <span class="detail-label">搜索结构:</span>
            <span class="detail-value">${details.pageStructure?.hasSearchResults ? '完整' : '不完整'}</span>
          </div>
          <div class="detail-item ${details.estimatedResults > 0 ? 'success' : 'neutral'}">
            <span class="detail-label">预估结果:</span>
            <span class="detail-value">${details.estimatedResults}个</span>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 创建深度测试详情
   */
  createDeepTestDetails(result) {
    if (!result.multiKeywordTests) return '';
    
    return `
      <div class="detail-section">
        <h4>多关键词测试</h4>
        <div class="keyword-tests">
          ${result.multiKeywordTests.map(test => `
            <div class="keyword-test ${test.contentRelevant ? 'success' : 'failed'}">
              <span class="test-keyword">${test.keyword}</span>
              <span class="test-result">${test.contentRelevant ? '✓ 相关' : '✗ 不相关'}</span>
            </div>
          `).join('')}
        </div>
        ${result.overallQuality ? `
          <div class="overall-quality">
            <span class="quality-label">整体质量:</span>
            <span class="quality-value ${result.overallQuality.level}">${result.overallQuality.message}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 创建搜索结果统计摘要
   */
  createSearchSummary(results, keyword) {
    if (!results || results.length === 0) return '';
    
    const levelCounts = {};
    const totalSources = results.length;
    let totalScore = 0;
    
    results.forEach(result => {
      const level = result.availabilityLevel || '故障';
      levelCounts[level] = (levelCounts[level] || 0) + 1;
      totalScore += result.finalScore || 0;
    });
    
    const avgScore = totalScore / totalSources;
    const excellentCount = levelCounts['优秀'] || 0;
    const goodCount = levelCounts['良好'] || 0;
    const qualitySourcesCount = excellentCount + goodCount;
    
    return `
      <div class="search-summary">
        <div class="summary-header">
          <h3>搜索结果分析</h3>
          ${keyword ? `<div class="search-keyword">关键词: <strong>${escapeHtml(keyword)}</strong></div>` : ''}
        </div>
        
        <div class="summary-stats">
          <div class="stat-item primary">
            <div class="stat-value">${qualitySourcesCount}/${totalSources}</div>
            <div class="stat-label">优质源</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${Math.round(avgScore * 100)}%</div>
            <div class="stat-label">平均质量</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${excellentCount}</div>
            <div class="stat-label">优秀</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${goodCount}</div>
            <div class="stat-label">良好</div>
          </div>
        </div>
        
        <div class="quality-distribution">
          ${Object.entries(levelCounts).map(([level, count]) => {
            const config = this.availabilityLevels[level];
            const percentage = (count / totalSources) * 100;
            return `
              <div class="distribution-item">
                <div class="level-info">
                  <span class="level-icon">${config.icon}</span>
                  <span class="level-name">${level}</span>
                  <span class="level-count">${count}</span>
                </div>
                <div class="level-bar">
                  <div class="level-fill" 
                       style="width: ${percentage}%; background-color: ${config.color}">
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        ${this.createRecommendations(results)}
      </div>
    `;
  }

  /**
   * 创建优化建议
   */
  createRecommendations(results) {
    const recommendations = [];
    const excellentCount = results.filter(r => r.availabilityLevel === '优秀').length;
    const failingCount = results.filter(r => r.availabilityLevel === '故障').length;
    const totalCount = results.length;
    
    if (excellentCount / totalCount > 0.7) {
      recommendations.push({
        type: 'success',
        message: '搜索源质量优秀，建议保持当前配置'
      });
    } else if (excellentCount / totalCount < 0.3) {
      recommendations.push({
        type: 'warning',
        message: '优质搜索源较少，建议添加更多可靠的搜索源'
      });
    }
    
    if (failingCount > totalCount / 3) {
      recommendations.push({
        type: 'error',
        message: '多个搜索源出现故障，建议检查网络连接或更新搜索源'
      });
    }
    
    const contentMismatchCount = results.filter(r => 
      r.contentScore !== undefined && r.contentScore < 0.3
    ).length;
    
    if (contentMismatchCount > 0) {
      recommendations.push({
        type: 'info',
        message: `${contentMismatchCount}个搜索源内容匹配度较低，可能影响搜索准确性`
      });
    }
    
    if (recommendations.length === 0) return '';
    
    return `
      <div class="recommendations">
        <h4>优化建议</h4>
        ${recommendations.map(rec => `
          <div class="recommendation ${rec.type}">
            <div class="rec-icon">${this.getRecommendationIcon(rec.type)}</div>
            <div class="rec-message">${rec.message}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 显示详细分析模态框
   */
  showDetailedAnalysisModal(result) {
    const modalHTML = `
      <div id="analysisModal" class="modal analysis-modal">
        <div class="modal-content">
          <div class="modal-header">
            <h2>${escapeHtml(result.title)} - 详细分析</h2>
            <span class="close" onclick="document.getElementById('analysisModal').remove()">&times;</span>
          </div>
          
          <div class="modal-body">
            <div class="analysis-overview">
              <div class="availability-status">
                <div class="status-badge ${result.availabilityLevel}">
                  ${this.availabilityLevels[result.availabilityLevel]?.icon} ${result.availabilityLevel}
                </div>
                <div class="final-score">
                  综合得分: <strong>${Math.round((result.finalScore || 0) * 100)}%</strong>
                </div>
              </div>
              
              ${result.qualityAssessment ? `
                <div class="quality-assessment ${result.qualityAssessment.level}">
                  <div class="assessment-level">${result.qualityAssessment.level}</div>
                  <div class="assessment-message">${result.qualityAssessment.message}</div>
                </div>
              ` : ''}
            </div>
            
            <div class="analysis-sections">
              ${this.createBasicDetails(result)}
              ${this.createContentDetails(result)}
              ${this.createDeepTestDetails(result)}
              
              ${result.searchTests ? `
                <div class="detail-section">
                  <h4>搜索功能测试</h4>
                  <div class="search-tests">
                    ${result.searchTests.map(test => `
                      <div class="test-item ${test.searchFunctional ? 'success' : 'failed'}">
                        <span class="test-keyword">${test.keyword}</span>
                        <span class="test-status">${test.searchFunctional ? '✓ 功能正常' : '✗ 功能异常'}</span>
                        ${test.responseCode ? `<span class="response-code">${test.responseCode}</span>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('analysisModal').remove()">关闭</button>
            <button class="btn-primary" onclick="window.searchManager.recheckSourceAdvanced('${result.id}')">重新检测</button>
          </div>
        </div>
      </div>
    `;
    
    // 移除已存在的模态框
    const existingModal = document.getElementById('analysisModal');
    if (existingModal) existingModal.remove();
    
    // 添加新模态框
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 显示模态框
    const modal = document.getElementById('analysisModal');
    modal.style.display = 'block';
    
    // 点击外部关闭
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  /**
   * 工具方法
   */
  getResultClasses(result) {
    const classes = [];
    
    if (!result.available) classes.push('result-unavailable');
    if (result.availabilityRank >= 4) classes.push('result-excellent');
    if (result.availabilityRank <= 2) classes.push('result-poor');
    if (result.contentMatched) classes.push('content-matched');
    if (result.responseTime > 10000) classes.push('slow-response');
    
    return classes.join(' ');
  }

  getQualityClass(score) {
    if (score >= 0.8) return 'quality-excellent';
    if (score >= 0.6) return 'quality-good';
    if (score >= 0.4) return 'quality-moderate';
    return 'quality-poor';
  }

  getVisitButtonClass(result) {
    const classes = ['visit-btn'];
    
    if (!result.available) classes.push('disabled');
    if (result.availabilityRank >= 4) classes.push('btn-excellent');
    if (result.availabilityRank <= 2) classes.push('btn-warning');
    
    return classes.join(' ');
  }

  getVisitButtonTooltip(result) {
    if (!result.available) {
      return '搜索源当前不可用，可能无法正常访问';
    }
    
    if (result.qualityAssessment) {
      return result.qualityAssessment.message;
    }
    
    return '点击访问该搜索源';
  }

  getRecommendationIcon(type) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  }

  truncateUrl(url, maxLength = 60) {
    if (url.length <= maxLength) return escapeHtml(url);
    
    const start = url.substring(0, maxLength / 2);
    const end = url.substring(url.length - maxLength / 2);
    return escapeHtml(start + '...' + end);
  }

  /**
   * 公共接口方法
   */
  renderAdvancedResults(results, keyword, container) {
    if (!container) return;
    
    const summaryHTML = this.createSearchSummary(results, keyword);
    const resultsHTML = results.map(result => this.createAdvancedResultHTML(result)).join('');
    
    container.innerHTML = `
      ${summaryHTML}
      <div class="advanced-results-grid">
        ${resultsHTML}
      </div>
    `;
    
    // 绑定事件
    this.bindAdvancedEvents(container);
  }

  bindAdvancedEvents(container) {
    container.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button) return;

      const action = button.dataset.action;
      const resultId = button.dataset.resultId;
      
      switch (action) {
        case 'detail':
          const result = this.currentResults.find(r => r.id === resultId);
          if (result) this.showDetailedAnalysisModal(result);
          break;
        case 'recheck':
          this.recheckAdvancedSource(resultId);
          break;
        // 其他操作由searchManager处理
        default:
          if (window.searchManager) {
            window.searchManager.handleResultAction(button, action);
          }
      }
    });
  }

  async recheckAdvancedSource(resultId) {
    const result = this.currentResults.find(r => r.id === resultId);
    if (!result || !window.advancedSourceChecker) return;
    
    showToast('正在重新检测...', 'info');
    
    try {
      const recheckResult = await window.advancedSourceChecker.checkSingleSourceAdvanced(result, {
        level: 'content',
        useCache: false,
        timeout: 15000
      });
      
      // 更新结果
      const index = this.currentResults.findIndex(r => r.id === resultId);
      if (index >= 0) {
        this.currentResults[index] = recheckResult;
        this.updateResultDisplay(resultId, recheckResult);
      }
      
      showToast(`${result.title}: ${recheckResult.availabilityLevel}`, 
                recheckResult.available ? 'success' : 'warning');
                
    } catch (error) {
      console.error('重新检测失败:', error);
      showToast('重新检测失败', 'error');
    }
  }

  updateResultDisplay(resultId, newResult) {
    const resultElement = document.querySelector(`[data-id="${resultId}"]`);
    if (!resultElement) return;
    
    // 更新可用性徽章
    const badge = resultElement.querySelector('.availability-badge');
    if (badge) {
      const levelConfig = this.availabilityLevels[newResult.availabilityLevel];
      badge.style.backgroundColor = levelConfig.bgColor;
      badge.style.color = levelConfig.textColor;
      badge.querySelector('.level-icon').textContent = levelConfig.icon;
      badge.querySelector('.level-text').textContent = newResult.availabilityLevel;
    }
    
    // 更新质量指示器
    const qualityIndicator = resultElement.querySelector('.quality-indicator');
    if (qualityIndicator && newResult.finalScore) {
      const score = Math.round(newResult.finalScore * 100);
      qualityIndicator.className = `quality-indicator ${this.getQualityClass(newResult.finalScore)}`;
      qualityIndicator.querySelector('.quality-fill').style.width = `${score}%`;
      qualityIndicator.querySelector('.quality-score').textContent = `${score}%`;
    }
    
    // 更新详细状态
    const detailedStatus = resultElement.querySelector('.detailed-status');
    if (detailedStatus) {
      detailedStatus.innerHTML = this.createDetailedStatus(newResult).replace('<div class="detailed-status">', '').replace('</div>', '');
    }
  }

  setCurrentResults(results) {
    this.currentResults = results;
  }
}

export default AdvancedSearchUI;