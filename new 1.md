# 前端展示设计：智能提取结果界面

## 🎯 设计思路

### 核心理念
- **渐进增强**：保留原有"访问"功能，新增"智能提取"
- **两阶段展示**：先显示基础结果，后台智能提取后展开详情
- **用户控制**：用户可以选择是否启用智能提取

## 🎨 界面设计方案

### 方案一：卡片展开式（推荐）

#### 1.1 基础搜索结果卡片
```html
<!-- 现有的搜索结果卡片，增加智能提取按钮 -->
<div class="result-item" data-id="result_001">
  <!-- 现有内容保持不变 -->
  <div class="result-content">
    <div class="result-title">JavBus - 专业番号搜索</div>
    <div class="result-subtitle">番号+磁力一体站，信息完善</div>
    <div class="result-url">https://javbus.com/search/keyword</div>
  </div>
  
  <!-- 操作按钮区域 - 新增智能提取 -->
  <div class="result-actions">
    <button class="action-btn visit-btn" data-action="visit">
      <span>🌐</span>
      <span>访问网站</span>
    </button>
    
    <!-- 新增：智能提取按钮 -->
    <button class="action-btn smart-extract-btn" data-action="smart-extract">
      <span class="extract-icon">🎯</span>
      <span class="extract-text">智能提取</span>
      <span class="extract-spinner" style="display:none;">⏳</span>
    </button>
    
    <button class="action-btn favorite-btn" data-action="favorite">
      <span>⭐</span>
      <span>收藏</span>
    </button>
  </div>
  
  <!-- 新增：智能提取结果展开区域 -->
  <div class="smart-extract-results" style="display:none;">
    <!-- 内容将通过JavaScript动态填充 -->
  </div>
</div>
```

#### 1.2 智能提取结果展开内容
```html
<!-- 展开后显示的智能提取结果 -->
<div class="smart-extract-results expanded">
  <!-- 提取状态指示 -->
  <div class="extract-status">
    <span class="status-icon">✅</span>
    <span class="status-text">智能提取完成</span>
    <span class="extract-time">用时 2.3s</span>
  </div>
  
  <!-- 找到的最佳匹配 -->
  <div class="best-match-section">
    <h4 class="section-title">🎯 最佳匹配</h4>
    
    <div class="best-match-item">
      <!-- 资源预览 -->
      <div class="resource-preview">
        <div class="preview-image">
          <img src="https://example.com/cover.jpg" alt="封面" loading="lazy">
        </div>
        <div class="preview-info">
          <h5 class="resource-title">SSIS-123 完整标题信息</h5>
          <div class="resource-meta">
            <span class="meta-item">📅 2024-01-15</span>
            <span class="meta-item">⏱️ 120分钟</span>
            <span class="meta-item">🏷️ HD</span>
          </div>
          <div class="resource-actors">
            <span class="actor-label">演员:</span>
            <span class="actor-name">演员A</span>
            <span class="actor-name">演员B</span>
          </div>
        </div>
      </div>
      
      <!-- 磁力链接区域 -->
      <div class="magnet-links-section">
        <div class="magnet-header">
          <span class="magnet-icon">🧲</span>
          <span class="magnet-count">3个磁力链接</span>
          <button class="toggle-magnets-btn" data-action="toggle-magnets">展开</button>
        </div>
        
        <div class="magnet-links-list" style="display:none;">
          <div class="magnet-link-item">
            <div class="magnet-info">
              <span class="magnet-quality">1080P</span>
              <span class="magnet-size">4.2GB</span>
              <span class="magnet-hash">A1B2C3D4...</span>
            </div>
            <div class="magnet-actions">
              <button class="magnet-action-btn copy-btn" title="复制磁力链接">
                📋 复制
              </button>
              <button class="magnet-action-btn download-btn" title="下载">
                ⬇️ 下载
              </button>
            </div>
          </div>
          
          <div class="magnet-link-item">
            <div class="magnet-info">
              <span class="magnet-quality">720P</span>
              <span class="magnet-size">2.1GB</span>
              <span class="magnet-hash">E5F6G7H8...</span>
            </div>
            <div class="magnet-actions">
              <button class="magnet-action-btn copy-btn">📋 复制</button>
              <button class="magnet-action-btn download-btn">⬇️ 下载</button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 快速操作 -->
      <div class="quick-actions">
        <button class="quick-action-btn" data-action="view-original">
          🔗 查看原页面
        </button>
        <button class="quick-action-btn" data-action="add-to-favorites">
          ⭐ 加入收藏
        </button>
        <button class="quick-action-btn" data-action="share">
          📤 分享资源
        </button>
      </div>
    </div>
  </div>
  
  <!-- 其他匹配结果（折叠显示） -->
  <div class="other-matches-section">
    <div class="section-header" data-action="toggle-other-matches">
      <h4 class="section-title">📋 其他匹配 (2个)</h4>
      <span class="toggle-icon">▶</span>
    </div>
    
    <div class="other-matches-list" style="display:none;">
      <!-- 简化显示的其他匹配项 -->
      <div class="other-match-item">
        <span class="match-title">SSIS-123 其他版本</span>
        <span class="match-source">来源: JavDB</span>
        <button class="view-match-btn">查看</button>
      </div>
    </div>
  </div>
</div>
```

### 方案二：侧边栏详情（可选）

#### 2.1 主要搜索结果 + 侧边栏详情
```html
<div class="search-results-container">
  <!-- 左侧：搜索结果列表 -->
  <div class="results-main">
    <div class="result-item active" data-result-id="001">
      <div class="result-basic-info">
        <div class="result-title">JavBus</div>
        <div class="result-subtitle">专业番号搜索站</div>
      </div>
      <div class="result-actions">
        <button class="smart-extract-btn" data-action="extract">🎯 智能提取</button>
      </div>
    </div>
  </div>
  
  <!-- 右侧：智能提取详情面板 -->
  <div class="extract-details-panel">
    <div class="panel-header">
      <h3>🎯 智能提取结果</h3>
      <button class="close-panel-btn">✕</button>
    </div>
    
    <div class="panel-content">
      <!-- 详细信息和磁力链接 -->
    </div>
  </div>
</div>
```

## 💻 前端JavaScript实现

### 3.1 增强的搜索管理器
```javascript
class SmartSearchManager extends SearchManager {
  constructor() {
    super();
    this.extractionResults = new Map(); // 缓存提取结果
    this.isExtracting = new Set(); // 正在提取的结果集合
  }

  // 重写结果创建方法，添加智能提取按钮
  createResultHTML(result) {
    const isFavorited = favoritesManager.isFavorited(result.url);
    
    return `
      <div class="result-item" data-id="${result.id}" data-source="${result.source}">
        <div class="result-image">
          <span style="font-size: 2rem;">${result.icon}</span>
        </div>
        
        <div class="result-content">
          <div class="result-title">${escapeHtml(result.title)}</div>
          <div class="result-subtitle">${escapeHtml(result.subtitle)}</div>
          <div class="result-url" title="${escapeHtml(result.url)}">
            ${this.truncateUrl(result.url)}
          </div>
          <div class="result-meta">
            <span class="result-source">${result.source}</span>
            <span class="result-time">${this.formatRelativeTime(result.timestamp)}</span>
          </div>
        </div>
        
        <div class="result-actions">
          <!-- 保留原有的访问按钮 -->
          <button class="action-btn visit-btn" data-action="visit" data-url="${escapeHtml(result.url)}">
            <span class="btn-icon">🌐</span>
            <span class="btn-text">访问网站</span>
          </button>
          
          <!-- 新增智能提取按钮 -->
          <button class="action-btn smart-extract-btn" 
                  data-action="smart-extract" 
                  data-result-id="${result.id}"
                  data-source="${result.source}">
            <span class="btn-icon extract-icon">🎯</span>
            <span class="btn-text extract-text">智能提取</span>
            <span class="btn-spinner extract-spinner" style="display:none;">
              <div class="spinner-icon">⏳</div>
            </span>
          </button>
          
          <!-- 原有的收藏按钮 -->
          <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                  data-action="favorite" data-result-id="${result.id}">
            <span class="btn-icon">⭐</span>
            <span class="btn-text">${isFavorited ? '已收藏' : '收藏'}</span>
          </button>
        </div>
        
        <!-- 智能提取结果展开区域 -->
        <div class="smart-extract-results" id="extract-${result.id}" style="display:none;">
          <!-- 内容将动态加载 -->
        </div>
      </div>
    `;
  }

  // 绑定事件处理（扩展原有方法）
  bindResultsEvents(container) {
    // 调用父类方法处理原有事件
    super.bindResultsEvents(container);
    
    // 添加智能提取事件处理
    container.addEventListener('click', (e) => {
      const extractBtn = e.target.closest('[data-action="smart-extract"]');
      if (extractBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const resultId = extractBtn.dataset.resultId;
        const source = extractBtn.dataset.source;
        
        this.handleSmartExtract(resultId, source, extractBtn);
      }
    });
  }

  // 智能提取处理
  async handleSmartExtract(resultId, source, button) {
    // 防止重复提取
    if (this.isExtracting.has(resultId)) {
      return;
    }

    // 检查缓存
    if (this.extractionResults.has(resultId)) {
      this.showCachedExtractionResult(resultId);
      return;
    }

    try {
      this.isExtracting.add(resultId);
      this.updateExtractButtonState(button, 'loading');
      
      // 获取搜索关键词
      const keyword = this.getCurrentSearchKeyword();
      
      // 调用智能提取API
      const response = await apiService.smartExtract(source, keyword);
      
      if (response.success && response.result) {
        this.extractionResults.set(resultId, response.result);
        this.showExtractionResult(resultId, response.result);
        this.updateExtractButtonState(button, 'success');
      } else {
        throw new Error(response.message || '未找到匹配结果');
      }
      
    } catch (error) {
      console.error('智能提取失败:', error);
      this.showExtractionError(resultId, error.message);
      this.updateExtractButtonState(button, 'error');
    } finally {
      this.isExtracting.delete(resultId);
    }
  }

  // 更新提取按钮状态
  updateExtractButtonState(button, state) {
    const icon = button.querySelector('.extract-icon');
    const text = button.querySelector('.extract-text');
    const spinner = button.querySelector('.extract-spinner');
    
    // 重置所有状态
    button.classList.remove('loading', 'success', 'error');
    spinner.style.display = 'none';
    
    switch (state) {
      case 'loading':
        button.classList.add('loading');
        button.disabled = true;
        icon.textContent = '';
        text.textContent = '提取中...';
        spinner.style.display = 'inline-block';
        break;
        
      case 'success':
        button.classList.add('success');
        button.disabled = false;
        icon.textContent = '✅';
        text.textContent = '提取完成';
        break;
        
      case 'error':
        button.classList.add('error');
        button.disabled = false;
        icon.textContent = '❌';
        text.textContent = '提取失败';
        // 3秒后恢复初始状态
        setTimeout(() => {
          icon.textContent = '🎯';
          text.textContent = '智能提取';
          button.classList.remove('error');
        }, 3000);
        break;
        
      default:
        button.disabled = false;
        icon.textContent = '🎯';
        text.textContent = '智能提取';
    }
  }

  // 显示提取结果
  showExtractionResult(resultId, extractResult) {
    const resultContainer = document.getElementById(`extract-${resultId}`);
    if (!resultContainer) return;

    const { bestMatch, otherMatches, totalFound } = extractResult;
    
    resultContainer.innerHTML = this.createExtractionResultHTML(bestMatch, otherMatches, totalFound);
    
    // 展开显示
    resultContainer.style.display = 'block';
    
    // 绑定交互事件
    this.bindExtractionResultEvents(resultContainer);
    
    // 平滑滚动到结果
    setTimeout(() => {
      resultContainer.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }, 100);
  }

  // 创建提取结果HTML
  createExtractionResultHTML(bestMatch, otherMatches = [], totalFound = 0) {
    const magnetLinks = bestMatch.magnetLinks || [];
    
    return `
      <div class="extraction-result-content">
        <!-- 提取状态 -->
        <div class="extract-status">
          <span class="status-icon">✅</span>
          <span class="status-text">找到 ${totalFound} 个匹配，显示最佳结果</span>
        </div>
        
        <!-- 最佳匹配 -->
        <div class="best-match-section">
          <div class="best-match-header">
            <h4 class="section-title">🎯 最佳匹配</h4>
            ${bestMatch.score ? `<span class="match-score">匹配度: ${bestMatch.score}%</span>` : ''}
          </div>
          
          <div class="best-match-content">
            <!-- 资源信息 -->
            <div class="resource-info">
              ${bestMatch.cover ? `
                <div class="resource-cover">
                  <img src="${bestMatch.cover}" alt="封面" loading="lazy" 
                       onerror="this.style.display='none'">
                </div>
              ` : ''}
              
              <div class="resource-details">
                <h5 class="resource-title">${escapeHtml(bestMatch.title)}</h5>
                
                ${bestMatch.code ? `<div class="resource-code">番号: ${bestMatch.code}</div>` : ''}
                
                <div class="resource-meta">
                  ${bestMatch.actors ? `
                    <div class="meta-row">
                      <span class="meta-label">演员:</span>
                      <span class="meta-value">${bestMatch.actors.slice(0, 3).join(', ')}</span>
                    </div>
                  ` : ''}
                  
                  ${bestMatch.duration ? `
                    <div class="meta-row">
                      <span class="meta-label">时长:</span>
                      <span class="meta-value">${bestMatch.duration}</span>
                    </div>
                  ` : ''}
                  
                  ${bestMatch.releaseDate ? `
                    <div class="meta-row">
                      <span class="meta-label">发行:</span>
                      <span class="meta-value">${bestMatch.releaseDate}</span>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <!-- 磁力链接 -->
            ${magnetLinks.length > 0 ? `
              <div class="magnet-links-section">
                <div class="magnet-header">
                  <span class="magnet-icon">🧲</span>
                  <span class="magnet-count">${magnetLinks.length} 个磁力链接</span>
                  <button class="toggle-magnets-btn" data-action="toggle-magnets">
                    <span class="toggle-text">展开</span>
                    <span class="toggle-icon">▼</span>
                  </button>
                </div>
                
                <div class="magnet-links-list" style="display:none;">
                  ${magnetLinks.map((link, index) => `
                    <div class="magnet-link-item" data-index="${index}">
                      <div class="magnet-info">
                        <span class="magnet-quality">${link.quality || 'Unknown'}</span>
                        <span class="magnet-size">${link.size || ''}</span>
                        <span class="magnet-hash" title="${link.hash}">${link.hash ? link.hash.substring(0, 8) + '...' : ''}</span>
                      </div>
                      <div class="magnet-actions">
                        <button class="magnet-copy-btn" 
                                data-magnet="${escapeHtml(link.magnet)}"
                                title="复制磁力链接">
                          📋 复制
                        </button>
                        <button class="magnet-download-btn" 
                                data-magnet="${escapeHtml(link.magnet)}"
                                title="打开下载">
                          ⬇️ 下载
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : '<div class="no-magnets">❌ 未找到磁力链接</div>'}
            
            <!-- 操作按钮 -->
            <div class="extract-actions">
              <button class="extract-action-btn primary" 
                      data-action="view-original" 
                      data-url="${escapeHtml(bestMatch.originalUrl)}">
                🔗 查看原页面
              </button>
              <button class="extract-action-btn secondary" 
                      data-action="add-to-favorites" 
                      data-resource='${JSON.stringify(bestMatch).replace(/'/g, "&#39;")}'>
                ⭐ 加入收藏
              </button>
              ${magnetLinks.length > 0 ? `
                <button class="extract-action-btn secondary" 
                        data-action="copy-all-magnets"
                        data-magnets='${JSON.stringify(magnetLinks.map(l => l.magnet))}'>
                  📋 复制全部链接
                </button>
              ` : ''}
            </div>
          </div>
        </div>
        
        <!-- 其他匹配结果（如果有） -->
        ${otherMatches.length > 0 ? `
          <div class="other-matches-section">
            <div class="other-matches-header" data-action="toggle-other-matches">
              <h4 class="section-title">📋 其他匹配 (${otherMatches.length}个)</h4>
              <span class="toggle-icon">▶</span>
            </div>
            <div class="other-matches-list" style="display:none;">
              ${otherMatches.map(match => `
                <div class="other-match-item">
                  <span class="match-title">${escapeHtml(match.title)}</span>
                  <span class="match-meta">${match.score ? `匹配度: ${match.score}%` : ''}</span>
                  <button class="view-match-btn" data-url="${escapeHtml(match.originalUrl)}">
                    查看
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 绑定提取结果的交互事件
  bindExtractionResultEvents(container) {
    container.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      
      switch (action) {
        case 'toggle-magnets':
          this.toggleMagnetsList(e.target);
          break;
          
        case 'toggle-other-matches':
          this.toggleOtherMatches(e.target);
          break;
          
        case 'view-original':
          window.open(e.target.dataset.url, '_blank');
          break;
          
        case 'add-to-favorites':
          await this.addResourceToFavorites(JSON.parse(e.target.dataset.resource));
          break;
          
        case 'copy-all-magnets':
          await this.copyAllMagnets(JSON.parse(e.target.dataset.magnets));
          break;
      }
    });

    // 磁力链接操作
    container.addEventListener('click', async (e) => {
      if (e.target.classList.contains('magnet-copy-btn')) {
        await this.copyMagnetLink(e.target.dataset.magnet);
      } else if (e.target.classList.contains('magnet-download-btn')) {
        this.openMagnetLink(e.target.dataset.magnet);
      }
    });
  }

  // 切换磁力链接列表显示
  toggleMagnetsList(button) {
    const section = button.closest('.magnet-links-section');
    const list = section.querySelector('.magnet-links-list');
    const icon = button.querySelector('.toggle-icon');
    const text = button.querySelector('.toggle-text');
    
    if (list.style.display === 'none') {
      list.style.display = 'block';
      icon.textContent = '▲';
      text.textContent = '收起';
    } else {
      list.style.display = 'none';
      icon.textContent = '▼';
      text.textContent = '展开';
    }
  }

  // 复制磁力链接
  async copyMagnetLink(magnetLink) {
    try {
      await navigator.clipboard.writeText(magnetLink);
      showToast('磁力链接已复制', 'success');
      
      // 记录用户行为
      if (authManager.isAuthenticated()) {
        apiService.recordAction('magnet_copy', { 
          source: 'smart_extract',
          hash: magnetLink.match(/btih:([a-zA-Z0-9]{8})/)?.[1] || 'unknown'
        }).catch(console.error);
      }
    } catch (error) {
      showToast('复制失败，请手动复制', 'error');
    }
  }

  // 打开磁力链接
  openMagnetLink(magnetLink) {
    try {
      // 尝试通过协议打开下载工具
      window.location.href = magnetLink;
      showToast('正在打开下载工具...', 'info');
    } catch (error) {
      // 降级到复制
      this.copyMagnetLink(magnetLink);
    }
  }

  // 复制所有磁力链接
  async copyAllMagnets(magnetLinks) {
    try {
      const allLinks = magnetLinks.join('\n');
      await navigator.clipboard.writeText(allLinks);
      showToast(`已复制 ${magnetLinks.length} 个磁力链接`, 'success');
    } catch (error) {
      showToast('复制失败', 'error');
    }
  }

  // 显示缓存的提取结果
  showCachedExtractionResult(resultId) {
    const cachedResult = this.extractionResults.get(resultId);
    if (cachedResult) {
      this.showExtractionResult(resultId, cachedResult);
      showToast('显示缓存结果', 'info', 2000);
    }
  }

  // 显示提取错误
  showExtractionError(resultId, errorMessage) {
    const resultContainer = document.getElementById(`extract-${resultId}`);
    if (!resultContainer) return;

    resultContainer.innerHTML = `
      <div class="extraction-error">
        <div class="error-icon">❌</div>
        <div class="error-message">智能提取失败: ${escapeHtml(errorMessage)}</div>
        <div class="error-actions">
          <button class="retry-extract-btn" data-result-id="${resultId}">
            🔄 重试
          </button>
          <button class="fallback-visit-btn" onclick="this.closest('.result-item').querySelector('.visit-btn').click()">
            🌐 访问原网站
          </button>
        </div>
      </div>
    `;

    resultContainer.style.display = 'block';
  }

  // 获取当前搜索关键词
  getCurrentSearchKeyword() {
    const searchInput = document.getElementById('searchInput');
    return searchInput ? searchInput.value.trim() : '';
  }
}

// 扩展API服务
apiService.smartExtract = async function(source, keyword) {
  return await this.request(`/api/smart-extract/${source}`, {
    method: 'POST',
    body: JSON.stringify({ keyword })
  });
};
```

## 🎨 CSS样式设计

### 智能提取结果样式
```css
/* 智能提取按钮 */
.smart-extract-btn {
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  transition: all 0.3s ease;
}

.smart-extract-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.smart-extract-btn.loading {
  background: #6b7280;
  cursor: not-allowed;
}

.smart-extract-btn.success {
  background: #10b981;
}

.smart-extract-btn.error {
  background: #ef4444;
}

/* 提取结果容器 */
.smart-extract-results {
  margin-top: 1rem;
  border-top: 2px solid #e5e7eb;
  background: #f8fafc;
  border-radius: 0 0 8px 8px;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 500px;
  }
}

/* 最佳匹配区域 */
.best-match-section {
  padding: 1rem;
  background: white;
  margin: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.resource-info {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.resource-cover img {
  width: 120px;
  height: 160px;
  object-fit: cover;
  border-radius: 6px;
}

.resource-details {
  flex: 1;
}

.resource-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
}

/* 磁力链接区域 */
.magnet-links-section {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  margin: 1rem 0;
}

.magnet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f3f4f6;
  border-bottom: 1px solid #e5e7eb;
}

.magnet-link-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid #f3f4f6;
}

.magnet-link-item:last-child {
  border-bottom: none;
}

.magnet-info {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.magnet-quality {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.magnet-actions {
  display: flex;
  gap: 0.5rem;
}

.magnet-copy-btn, .magnet-download-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.magnet-copy-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

.magnet-download-btn:hover {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #3b82f6;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .resource-info {
    flex-direction: column;
  }
  
  .resource-cover img {
    width: 100%;
    height: auto;
    max-width: 200px;
    margin: 0 auto;
  }
  
  .magnet-link-item {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }
  
  .magnet-actions {
    justify-content: center;
  }
}
```

## 📱 用户体验优化

### 设置选项
```javascript
// 在用户设置中添加智能提取选项
const smartExtractSettings = {
  enabled: true,              // 是否启用智能提取
  autoExtract: false,         // 搜索后自动提取（可选）
  maxResults: 2,              // 最多提取几个结果
  showOtherMatches: true,     // 是否显示其他匹配
  cacheResults: true          // 是否缓存提取结果
};
```

### 渐进式加载
1. **搜索完成** → 立即显示基础结果
2. **点击智能提取** → 显示加载状态
3. **提取完成** → 展开显示详细信息
4. **用户可选择** → 查看磁力链接或访问原网站

这样既保留了原有功能的简洁性，又提供了强大的智能提取能力，用户可以根据需要选择使用方式。