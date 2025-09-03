// 社区搜索源管理器 - 从community-manager.js拆分出来的搜索源分享相关功能
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast, createElement } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import communitySourcesService from '../../services/community-sources-api.js';

export class CommunitySourcesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.currentPage = 1;
    this.currentLimit = 20;
    this.currentFilters = {
      category: 'all',
      sort: 'created_at',
      order: 'desc',
      search: '',
      featured: false
    };
    this.communityStats = null;
    this.userStats = null;
    this.isInitialized = false;
    this.currentSources = [];
    this.currentPagination = null;
    
    // 声誉系统配置
    this.reputationLevels = {
      'beginner': { min: 0, max: 99, name: '新手', icon: '🌱', color: '#6b7280' },
      'contributor': { min: 100, max: 499, name: '贡献者', icon: '⭐', color: '#3b82f6' },
      'expert': { min: 500, max: 1999, name: '专家', icon: '🏅', color: '#f59e0b' },
      'master': { min: 2000, max: 9999, name: '大师', icon: '👑', color: '#8b5cf6' },
      'legend': { min: 10000, max: Infinity, name: '传奇', icon: '💎', color: '#ef4444' }
    };
  }

  async init() {
    console.log('初始化社区搜索源管理器');
    try {
      this.isInitialized = true;
      console.log('社区搜索源管理器初始化完成');
    } catch (error) {
      console.error('社区搜索源管理器初始化失败:', error);
    }
  }

  async loadTabData() {
    if (!this.isInitialized) {
      await this.init();
    }
    
    try {
      showLoading(true);
      
      // 先绑定事件
      await this.bindEvents();
      
      await Promise.all([
        this.loadUserCommunityStats()
      ]);
      
      // 加载搜索源列表
      await this.loadCommunitySourcesList();
      
      this.renderCommunityControls();
      this.updateCommunityStats();
      
    } catch (error) {
      console.error('加载社区数据失败:', error);
      showToast('加载社区数据失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async bindEvents() {
    const waitForDOM = () => {
      return new Promise(resolve => {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', resolve);
        } else {
          resolve();
        }
      });
    };
    
    await waitForDOM();
    
    console.log('开始绑定社区搜索源管理器事件');
    
    // 绑定搜索和过滤事件
    const searchInput = document.getElementById('communitySearch');
    const categoryFilter = document.getElementById('communityCategory');
    const sortSelect = document.getElementById('communitySort');
    const featuredToggle = document.getElementById('featuredOnly');
    const searchBtn = document.getElementById('communitySearchBtn');

    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentFilters.search = e.target.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }, 500);
      });
      
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.currentFilters.search = e.target.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const searchInput = document.getElementById('communitySearch');
        if (searchInput) {
          this.currentFilters.search = searchInput.value;
          this.currentPage = 1;
          this.loadCommunitySourcesList();
        }
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilters.category = e.target.value;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const [sort, order] = e.target.value.split('-');
        this.currentFilters.sort = sort;
        this.currentFilters.order = order;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    if (featuredToggle) {
      featuredToggle.addEventListener('change', (e) => {
        this.currentFilters.featured = e.target.checked;
        this.currentPage = 1;
        this.loadCommunitySourcesList();
      });
    }

    // 绑定分享按钮事件
    const shareSourceBtn = document.getElementById('shareSourceBtn');
    if (shareSourceBtn) {
      shareSourceBtn.addEventListener('click', () => this.showShareSourceModal());
    }

    // 我的分享按钮事件
    const mySharesBtn = document.getElementById('mySharesBtn');
    if (mySharesBtn) {
      mySharesBtn.addEventListener('click', () => this.showMySharesModal());
    }

    console.log('社区搜索源管理器所有事件绑定完成');
  }

  // 加载社区搜索源列表
  async loadCommunitySourcesList() {
    try {
      console.log('开始加载社区搜索源列表');
      
      const options = {
        page: this.currentPage,
        limit: this.currentLimit,
        ...this.currentFilters
      };

      const result = await communitySourcesService.getCommunitySearchSources(options);
      
      if (result.success) {
        this.currentSources = result.sources;
        this.currentPagination = result.pagination;
        this.renderCommunitySourcesList(result.sources, result.pagination);
      } else {
        throw new Error(result.error || '加载社区搜索源失败');
      }

    } catch (error) {
      console.error('加载社区搜索源列表失败:', error);
      showToast('加载搜索源列表失败: ' + error.message, 'error');
      
      const container = document.getElementById('communitySourcesList');
      if (container) {
        container.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">⚠️</span>
            <p>加载搜索源失败</p>
            <p>错误信息: ${escapeHtml(error.message)}</p>
            <button class="btn-primary" onclick="window.app.getManager('community').communitySources.loadCommunitySourcesList()">
              重新加载
            </button>
          </div>
        `;
      }
    }
  }

  // 加载用户社区统计
  async loadUserCommunityStats() {
    if (!this.app.getCurrentUser()) {
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
          totalDownloads: 0,
          totalViews: 0,
          reputationScore: 0
        }
      };
      this.updateCommunityStats();
      return;
    }

    try {
      const result = await communitySourcesService.getUserCommunityStats();
      
      if (result.success) {
        this.userStats = result.stats;
        console.log('用户社区统计加载成功:', this.userStats);
      } else {
        this.userStats = {
          general: {
            sharedSources: 0,
            sourcesDownloaded: 0,
            totalLikes: 0,
            totalDownloads: 0,
            totalViews: 0,
            reputationScore: 0
          }
        };
      }
      this.updateCommunityStats();
    } catch (error) {
      console.warn('加载用户社区统计失败:', error);
      this.userStats = {
        general: {
          sharedSources: 0,
          sourcesDownloaded: 0,
          totalLikes: 0,
          totalDownloads: 0,
          totalViews: 0,
          reputationScore: 0
        }
      };
      this.updateCommunityStats();
    }
  }

  // 🆕 显示分享搜索源模态框 - 支持标签选择器
  showShareSourceModal() {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('显示分享搜索源模态框');

    // 获取分类选项
    const getCategoryOptions = () => {
      if (APP_CONSTANTS.SOURCE_CATEGORIES) {
        return Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(cat => 
          `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`
        ).join('');
      }
      return `
        <option value="jav">🎬 JAV资源</option>
        <option value="movie">🎭 影视资源</option>
        <option value="torrent">🧲 种子磁力</option>
        <option value="other">🔍 其他搜索</option>
      `;
    };

    // 获取我的搜索源选项
    const getMySourcesOptions = () => {
      const sourcesManager = this.app.getManager('sources');
      if (!sourcesManager) return '<option value="">搜索源管理器未加载</option>';
      
      const allSources = sourcesManager.getAllSearchSources() || [];
      const enabledSources = sourcesManager.enabledSources || [];
      
      const enabledSourcesData = allSources.filter(source => enabledSources.includes(source.id));
      
      if (enabledSourcesData.length === 0) {
        return '<option value="">您还没有可用的搜索源</option>';
      }
      
      return enabledSourcesData.map(source => `
        <option value="${source.id}" 
                data-name="${escapeHtml(source.name)}"
                data-subtitle="${escapeHtml(source.subtitle || '')}"
                data-icon="${escapeHtml(source.icon || '🔍')}"
                data-url="${escapeHtml(source.urlTemplate)}"
                data-category="${source.category || 'other'}">
          ${source.icon || '🔍'} ${source.name} (${source.category || '其他'})
        </option>
      `).join('');
    };

    const modalHTML = `
      <div id="shareSourceModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('shareSourceModal').remove()">&times;</span>
          <h2>分享搜索源到社区</h2>
          
          <!-- 分享方式选择 -->
          <div class="share-method-selector" style="margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 1rem; justify-content: center;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="shareMethod" value="existing" checked>
                <span>从我的搜索源中选择</span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="shareMethod" value="manual">
                <span>手动填写新搜索源</span>
              </label>
            </div>
          </div>

          <div id="shareFormError" style="display: none;"></div>
          
          <form id="shareSourceForm">
            <!-- 选择现有搜索源区域 -->
            <div id="existingSourceSection">
              <div class="form-group">
                <label for="existingSource">选择搜索源 <span style="color: red;">*</span>:</label>
                <select id="existingSource" name="existingSource" required>
                  <option value="">请选择一个搜索源</option>
                  ${getMySourcesOptions()}
                </select>
                <small class="form-help">从您已启用的搜索源中选择一个进行分享</small>
                <div class="field-error" id="existingSourceError"></div>
              </div>
            </div>

            <!-- 手动填写区域 -->
            <div id="manualSourceSection" style="display: none;">
              <div class="form-grid">
                <div class="form-group">
                  <label for="shareName">搜索源名称 <span style="color: red;">*</span>:</label>
                  <input type="text" id="shareName" name="shareName" data-original-required="true" placeholder="例如：JavDB" maxlength="50">
                  <div class="field-error" id="shareNameError"></div>
                </div>
                
                <div class="form-group">
                  <label for="shareSubtitle">副标题:</label>
                  <input type="text" id="shareSubtitle" name="shareSubtitle" placeholder="简短描述" maxlength="100">
                </div>
                
                <div class="form-group">
                  <label for="shareIcon">图标 (emoji):</label>
                  <input type="text" id="shareIcon" name="shareIcon" placeholder="🔍" maxlength="4" value="🔍">
                </div>
                
                <div class="form-group">
                  <label for="shareCategory">分类 <span style="color: red;">*</span>:</label>
                  <select id="shareCategory" name="shareCategory" data-original-required="true">
                    <option value="">请选择分类</option>
                    ${getCategoryOptions()}
                  </select>
                  <div class="field-error" id="shareCategoryError"></div>
                </div>
              </div>
              
              <div class="form-group">
                <label for="shareUrl">URL模板 <span style="color: red;">*</span>:</label>
                <input type="text" id="shareUrl" name="shareUrl" data-original-required="true" 
                  placeholder="https://example.com/search?q={keyword}" 
                  pattern=".*\\{keyword\\}.*">
                <small class="form-help">URL必须包含{keyword}占位符，例如：https://example.com/search?q={keyword}</small>
                <div class="field-error" id="shareUrlError"></div>
              </div>
            </div>
            
            <!-- 公共字段 -->
            <div class="form-group">
              <label for="shareDescription">详细描述:</label>
              <textarea id="shareDescription" name="shareDescription" placeholder="介绍这个搜索源的特点和用法..." rows="4" maxlength="500"></textarea>
            </div>
            
            <!-- 标签选择器 -->
            <div class="form-group">
              <label>选择标签:</label>
              ${this.renderTagSelector()}
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>📤</span>
                <span>分享到社区</span>
              </button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('shareSourceModal').remove()">
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // 移除现有模态框
    const existingModal = document.getElementById('shareSourceModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定事件
    this.bindShareModalEvents();
  }

  // 🆕 渲染标签选择器
  renderTagSelector() {
    // 从标签管理器获取可用标签
    const communityTags = this.app.getManager('community').communityTags;
    if (!communityTags) {
      return `
        <div class="tag-selector">
          <div class="empty-tags">
            <p>标签管理器未加载</p>
          </div>
        </div>
      `;
    }

    return communityTags.renderTagSelector();
  }

  // 🆕 过滤标签
  filterTags(searchTerm) {
    const items = document.querySelectorAll('.tag-selector-item');
    const term = searchTerm.toLowerCase().trim();
    
    items.forEach(item => {
      const tagName = item.textContent.toLowerCase();
      if (term === '' || tagName.includes(term)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  // 🆕 更新已选择的标签显示
  updateSelectedTags() {
    const selectedItems = document.querySelectorAll('.tag-selector-item.selected');
    const display = document.getElementById('selectedTagsDisplay');
    
    if (!display) return;
    
    if (selectedItems.length === 0) {
      display.innerHTML = '<span class="placeholder">未选择标签</span>';
      return;
    }
    
    const tagsHTML = Array.from(selectedItems).map(item => {
      const tagName = item.querySelector('span').textContent;
      const checkbox = item.querySelector('input[type="checkbox"]');
      const tagId = checkbox.value;
      
      return `
        <span class="selected-tag-item">
          ${escapeHtml(tagName)}
          <button type="button" class="selected-tag-remove" onclick="window.app.getManager('community').communitySources.removeSelectedTag('${tagId}')">×</button>
        </span>
      `;
    }).join('');
    
    display.innerHTML = tagsHTML;
  }

  // 🆕 移除已选择的标签
  removeSelectedTag(tagId) {
    const item = document.querySelector(`.tag-selector-item input[value="${tagId}"]`);
    if (item) {
      item.parentNode.classList.remove('selected');
      this.updateSelectedTags();
    }
  }

  // 绑定分享模态框事件
  bindShareModalEvents() {
    const form = document.getElementById('shareSourceForm');
    const existingSourceSelect = document.getElementById('existingSource');
    const shareMethodRadios = document.querySelectorAll('input[name="shareMethod"]');
    
    if (!form) return;

    // 分享方式切换
    shareMethodRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        const existingSection = document.getElementById('existingSourceSection');
        const manualSection = document.getElementById('manualSourceSection');
        
        const manualRequiredFields = manualSection.querySelectorAll('input[required], select[required]');
        const existingRequiredFields = existingSection.querySelectorAll('select[required]');
        
        if (radio.value === 'existing') {
          existingSection.style.display = 'block';
          manualSection.style.display = 'none';
          
          manualRequiredFields.forEach(field => {
            field.removeAttribute('required');
            field.classList.remove('error');
          });
          
          existingRequiredFields.forEach(field => {
            field.setAttribute('required', 'required');
          });
          
          this.clearAllErrors();
          
        } else {
          existingSection.style.display = 'none';
          manualSection.style.display = 'block';
          
          manualRequiredFields.forEach(field => {
            if (field.dataset.originalRequired !== 'false') {
              field.setAttribute('required', 'required');
            }
          });
          
          existingRequiredFields.forEach(field => {
            field.removeAttribute('required');
          });
          
          this.clearAllErrors();
        }
      });
    });

    // 现有搜索源选择事件
    if (existingSourceSelect) {
      existingSourceSelect.addEventListener('change', (e) => {
        const option = e.target.selectedOptions[0];
        if (option && option.value) {
          const descriptionField = document.getElementById('shareDescription');
          if (descriptionField && !descriptionField.value) {
            descriptionField.value = `来自我的搜索源库: ${option.dataset.name}`;
          }
          
          e.target.classList.remove('error');
          const errorDiv = document.getElementById('existingSourceError');
          if (errorDiv) {
            errorDiv.style.display = 'none';
          }
        }
      });
    }

    // 表单提交事件
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitShareSourceForm(e);
    });
    
    // 绑定表单验证
    this.bindFormValidation();
  }

  // 清除所有错误状态的方法
  clearAllErrors() {
    document.querySelectorAll('.field-error').forEach(errorDiv => {
      errorDiv.style.display = 'none';
    });
    
    document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
      field.classList.remove('error');
      field.style.borderColor = '';
    });
    
    const formError = document.getElementById('shareFormError');
    if (formError) {
      formError.style.display = 'none';
    }
  }

  // 绑定表单验证事件
  bindFormValidation() {
    const form = document.getElementById('shareSourceForm');
    if (!form) return;

    const clearError = (fieldId) => {
      const errorDiv = document.getElementById(fieldId + 'Error');
      if (errorDiv) {
        errorDiv.textContent = '';
        errorDiv.style.display = 'none';
      }
      const field = document.getElementById(fieldId);
      if (field) {
        field.style.borderColor = '';
      }
    };

    const showError = (fieldId, message) => {
      const errorDiv = document.getElementById(fieldId + 'Error');
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.style.color = 'red';
      }
      const field = document.getElementById(fieldId);
      if (field) {
        field.style.borderColor = 'red';
      }
    };

    // 验证搜索源名称
    const nameField = document.getElementById('shareName');
    if (nameField) {
      nameField.addEventListener('blur', () => {
        const value = nameField.value.trim();
        if (!value) {
          showError('shareName', '搜索源名称不能为空');
        } else if (value.length < 2) {
          showError('shareName', '搜索源名称至少需要2个字符');
        } else {
          clearError('shareName');
        }
      });
    }

    // 验证URL模板
    const urlField = document.getElementById('shareUrl');
    if (urlField) {
      urlField.addEventListener('blur', () => {
        const value = urlField.value.trim();
        if (!value) {
          showError('shareUrl', 'URL模板不能为空');
        } else if (!value.includes('{keyword}')) {
          showError('shareUrl', 'URL模板必须包含{keyword}占位符');
        } else {
          try {
            new URL(value.replace('{keyword}', 'test'));
            clearError('shareUrl');
          } catch (error) {
            showError('shareUrl', 'URL格式不正确');
          }
        }
      });
    }
  }

  // 提交分享表单
  async submitShareSourceForm(event) {
    event.preventDefault();
    
    console.log('开始提交分享表单');
    
    const form = document.getElementById('shareSourceForm');
    if (!form) {
      console.error('表单未找到');
      return;
    }

    this.clearAllErrors();

    const showFormError = (message) => {
      const errorDiv = document.getElementById('shareFormError');
      if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showToast(message, 'error');
      }
    };

    try {
      const shareMethod = document.querySelector('input[name="shareMethod"]:checked')?.value;
      
      // 🆕 获取选中的标签ID
      const selectedTags = Array.from(document.querySelectorAll('.tag-selector-item.selected input[type="checkbox"]'))
        .map(checkbox => checkbox.value);

      let sourceData;

      if (shareMethod === 'existing') {
        const existingSourceSelect = document.getElementById('existingSource');
        if (!existingSourceSelect || !existingSourceSelect.value) {
          if (existingSourceSelect) {
            existingSourceSelect.classList.add('error');
          }
          const errorDiv = document.getElementById('existingSourceError') || 
            this.createErrorDiv('existingSource', '请选择一个搜索源');
          errorDiv.textContent = '请选择一个搜索源';
          errorDiv.style.display = 'block';
          return;
        }

        const selectedOption = existingSourceSelect.selectedOptions[0];
        
        if (!selectedOption.dataset.name || !selectedOption.dataset.url) {
          showFormError('所选搜索源数据不完整，请选择其他搜索源');
          return;
        }

        sourceData = {
          name: selectedOption.dataset.name,
          subtitle: selectedOption.dataset.subtitle || '',
          icon: selectedOption.dataset.icon || '🔍',
          urlTemplate: selectedOption.dataset.url,
          category: selectedOption.dataset.category || 'other',
          description: document.getElementById('shareDescription')?.value.trim() || 
            `来自我的搜索源库: ${selectedOption.dataset.name}`,
          tags: selectedTags // 🆕 使用选中的标签ID
        };

      } else {
        // 手动填写的数据
        const name = document.getElementById('shareName')?.value.trim();
        const subtitle = document.getElementById('shareSubtitle')?.value.trim();
        const icon = document.getElementById('shareIcon')?.value.trim() || '🔍';
        const category = document.getElementById('shareCategory')?.value.trim();
        const urlTemplate = document.getElementById('shareUrl')?.value.trim();
        const description = document.getElementById('shareDescription')?.value.trim() || '';

        // 验证必填字段
        const errors = [];
        const fieldErrors = {};
        
        if (!name || name.length < 2) {
          errors.push('搜索源名称必须至少2个字符');
          fieldErrors.shareName = '搜索源名称必须至少2个字符';
        }
        
        if (!urlTemplate) {
          errors.push('URL模板不能为空');
          fieldErrors.shareUrl = 'URL模板不能为空';
        } else if (!urlTemplate.includes('{keyword}')) {
          errors.push('URL模板必须包含{keyword}占位符');
          fieldErrors.shareUrl = 'URL模板必须包含{keyword}占位符';
        } else {
          try {
            new URL(urlTemplate.replace('{keyword}', 'test'));
          } catch (error) {
            errors.push('URL格式不正确');
            fieldErrors.shareUrl = 'URL格式不正确';
          }
        }
        
        if (!category) {
          errors.push('请选择一个分类');
          fieldErrors.shareCategory = '请选择一个分类';
        }

        // 显示字段级错误
        Object.entries(fieldErrors).forEach(([fieldId, message]) => {
          const field = document.getElementById(fieldId);
          if (field) {
            field.classList.add('error');
          }
          
          const errorDiv = document.getElementById(fieldId + 'Error') ||
            this.createErrorDiv(fieldId, message);
          errorDiv.textContent = message;
          errorDiv.style.display = 'block';
        });

        if (errors.length > 0) {
          showFormError('请修复以下问题：\n' + errors.join('\n'));
          return;
        }

        sourceData = {
          name,
          subtitle: subtitle || '',
          icon,
          urlTemplate,
          category,
          description,
          tags: selectedTags // 🆕 使用选中的标签ID
        };
      }
      
      console.log('准备提交的数据:', sourceData);

      showLoading(true);
      
      const result = await communitySourcesService.shareSourceToCommunity(sourceData);
      
      if (result.success) {
        showToast(result.message || '分享成功！', 'success');
        document.getElementById('shareSourceModal').remove();
        
        // 刷新社区列表和统计
        await Promise.all([
          this.loadCommunitySourcesList(),
          this.loadUserCommunityStats()
        ]);
        
      } else {
        showFormError(result.message || '分享失败，请重试');
      }

    } catch (error) {
      console.error('分享搜索源失败:', error);
      showFormError('分享失败：' + error.message);
    } finally {
      showLoading(false);
    }
  }

  // 创建错误提示元素的方法
  createErrorDiv(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return null;
    
    const errorDiv = document.createElement('div');
    errorDiv.id = fieldId + 'Error';
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    field.parentNode.insertBefore(errorDiv, field.nextSibling);
    
    return errorDiv;
  }

  // 渲染社区搜索源项目
  renderCommunitySourceItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
      Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    const ratingStars = this.renderRatingStars(source.stats?.rating || 0);
    
    // 🔧 修复：处理标签数据，确保显示名称而不是ID
    let tags = [];
    if (source.tags && Array.isArray(source.tags)) {
      const communityTags = this.app.getManager('community').communityTags;
      const availableTags = communityTags ? communityTags.getAvailableTags() : [];
      
      tags = source.tags.slice(0, 3).map(tag => {
        // 如果tag是对象且有name属性，直接使用
        if (typeof tag === 'object' && tag.name) {
          return {
            id: tag.id,
            name: tag.name,
            color: tag.color || '#3b82f6',
            isOfficial: Boolean(tag.isOfficial)
          };
        }
        // 如果tag是字符串，检查是否是ID格式
        else if (typeof tag === 'string') {
          // 如果是UUID格式的ID，尝试从已知标签中查找
          if (tag.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
            // 尝试从available tags中查找对应的名称
            const knownTag = availableTags.find(availableTag => availableTag.id === tag);
            if (knownTag) {
              return {
                id: knownTag.id,
                name: knownTag.name,
                color: knownTag.color || '#3b82f6',
                isOfficial: Boolean(knownTag.isOfficial)
              };
            } else {
              // 如果找不到对应的标签名称，显示简化的ID
              return {
                id: tag,
                name: `标签-${tag.slice(0, 8)}`,
                color: '#6b7280',
                isOfficial: false
              };
            }
          } else {
            // 如果是普通字符串，直接作为名称使用
            return {
              id: tag,
              name: tag,
              color: '#3b82f6',
              isOfficial: false
            };
          }
        }
        // 兜底处理
        else {
          return {
            id: 'unknown',
            name: '未知标签',
            color: '#6b7280',
            isOfficial: false
          };
        }
      });
    }
    
    const authorReputation = this.calculateReputationLevel(source.author?.reputation || 0);
    
    return `
      <div class="community-source-item" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-icon">${source.icon || '🔍'}</div>
          <div class="source-title-area">
            <h3 class="source-title">${escapeHtml(source.name)}</h3>
            ${source.subtitle ? `<p class="source-subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
          </div>
          <div class="source-badges">
            ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
            ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
          </div>
        </div>

        <div class="source-meta">
          <div class="source-category">
            <span class="category-badge" style="background: ${category?.color || '#6b7280'}">
              ${category?.icon || '🌟'} ${category?.name || '其他'}
            </span>
          </div>
          <div class="source-author">
            由 <strong>${escapeHtml(source.author ? source.author.name : 'Unknown')}</strong> 分享
            <span class="author-reputation" style="color: ${authorReputation.color}; margin-left: 0.5rem;">
              ${authorReputation.icon} ${authorReputation.name}
            </span>
          </div>
        </div>

        ${source.description ? `
          <div class="source-description">
            ${escapeHtml(source.description)}
          </div>
        ` : ''}

  ${tags.length > 0 ? `
      <div class="source-tags">
          ${tags.map(tag => `
              <span class="tag ${tag.isOfficial ? 'official' : ''}" 
                    style="background-color: ${tag.color}15; border-color: ${tag.color}; color: ${tag.color};"
                    onclick="window.app.getManager('community').communitySources.showTagSourcesModal('${tag.id}', '${escapeHtml(tag.name)}')"
                    title="点击查看使用此标签的所有搜索源">
                  ${escapeHtml(tag.name)}
              </span>
          `).join('')}
      </div>
  ` : ''}

        <div class="source-stats">
          <div class="stat-item">
            <span class="stat-icon">🔥</span>
            <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
            <span class="stat-label">下载</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👍</span>
            <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👁</span>
            <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
            <span class="stat-label">浏览</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <div class="rating-display">
              ${ratingStars}
              <span class="rating-count">(${source.stats?.reviewCount || 0})</span>
            </div>
          </div>
        </div>

        <div class="source-actions">
          <button class="action-btn primary" onclick="window.app.getManager('community').communitySources.downloadSource('${source.id}')">
            <span>🔥</span>
            <span>添加到我的搜索源</span>
          </button>
          <button class="action-btn secondary" onclick="window.app.getManager('community').communitySources.viewSourceDetails('${source.id}')">
            <span>👁️</span>
            <span>查看详情</span>
          </button>
          <button class="action-btn tertiary like-btn" data-source-id="${source.id}" onclick="window.app.getManager('community').communitySources.toggleLike('${source.id}')">
            <span>👍</span>
            <span>点赞</span>
          </button>
          <button class="action-btn tertiary" onclick="window.app.getManager('community').communitySources.showReviewModal('${source.id}')">
            <span>💬</span>
            <span>评价</span>
          </button>
          <button class="action-btn tertiary text-warning" onclick="window.app.getManager('community').communitySources.showReportModal('${source.id}')">
            <span>🚨</span>
            <span>举报</span>
          </button>
        </div>

        <div class="source-footer">
          <span class="source-date">分享于 ${this.formatDate(source.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // 渲染社区控件
  renderCommunityControls() {
    const categoryFilter = document.getElementById('communityCategory');
    if (categoryFilter && APP_CONSTANTS.SOURCE_CATEGORIES) {
      const categories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES);
      categoryFilter.innerHTML = `
        <option value="all">全部分类</option>
        ${categories.map(cat => `
          <option value="${cat.id}" ${this.currentFilters.category === cat.id ? 'selected' : ''}>
            ${cat.icon} ${cat.name}
          </option>
        `).join('')}
      `;
    }
  }

  // 渲染社区搜索源列表
  renderCommunitySourcesList(sources, pagination) {
    const container = document.getElementById('communitySourcesList');
    if (!container) {
      console.error('找不到社区搜索源容器');
      return;
    }

    if (!sources || sources.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🛒</span>
          <p>暂无搜索源分享</p>
          <p>成为第一个分享搜索源的人吧！</p>
          <button class="btn-primary" onclick="window.app.getManager('community').communitySources.showShareSourceModal()">
            分享搜索源
          </button>
        </div>
      `;
      return;
    }

    const sourcesHTML = sources.map(source => this.renderCommunitySourceItem(source)).join('');
    const paginationHTML = this.renderPagination(pagination);

    container.innerHTML = `
      <div class="community-sources-grid">
        ${sourcesHTML}
      </div>
      ${paginationHTML}
    `;

    this.bindSourceItemEvents();
  }

  // 其他渲染和操作方法
  renderRatingStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(emptyStars);
    
    return `<span class="rating-stars" title="${rating.toFixed(1)}/5.0">${stars}</span>`;
  }

  renderPagination(pagination) {
    if (!pagination || pagination.totalPages <= 1) return '';

    const { page = 1, totalPages = 1, hasPrev = false, hasNext = false, total = 0 } = pagination;
    
    return `
      <div class="pagination">
        <button class="pagination-btn" 
                ${!hasPrev ? 'disabled' : ''} 
                onclick="window.app.getManager('community').communitySources.goToPage(${page - 1})">
          ‹ 上一页
        </button>
        
        <div class="pagination-info">
          <span>第 ${page} 页，共 ${totalPages} 页 (${total} 个搜索源)</span>
        </div>
        
        <button class="pagination-btn" 
                ${!hasNext ? 'disabled' : ''} 
                onclick="window.app.getManager('community').communitySources.goToPage(${page + 1})">
          下一页 ›
        </button>
      </div>
    `;
  }

  bindSourceItemEvents() {
    console.log('绑定搜索源项目事件');
  }

  async goToPage(page) {
    this.currentPage = page;
    await this.loadCommunitySourcesList();
  }

  async searchByTag(tagName) {
    console.log('按标签搜索:', tagName);
    const searchInput = document.getElementById('communitySearch');
    if (searchInput) {
      searchInput.value = tagName;
    }
    this.currentFilters.search = tagName;
    this.currentPage = 1;
    await this.loadCommunitySourcesList();
  }

  // 下载搜索源
  async downloadSource(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    try {
      showLoading(true);
      
      const result = await communitySourcesService.downloadCommunitySource(sourceId);
      
      if (result.success) {
        showToast(result.message || '下载成功', 'success');
        
        window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
          detail: { action: 'added', source: result.source }
        }));
        
        setTimeout(() => {
          this.loadCommunitySourcesList();
          this.loadUserCommunityStats();
        }, 1000);
      } else {
        showToast(result.message || '下载失败', 'error');
      }

    } catch (error) {
      console.error('下载搜索源失败:', error);
      showToast('下载失败，请稍后重试: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 切换点赞状态
  async toggleLike(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    try {
      const result = await communitySourcesService.toggleSourceLike(sourceId, 'like');
      
      if (result.success) {
        showToast(result.message || '操作成功', 'success', 2000);
        
        const likeBtn = document.querySelector(`[data-source-id="${sourceId}"].like-btn`);
        if (likeBtn) {
          if (result.action === 'added') {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<span>❤️</span><span>已点赞</span>';
          } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<span>👍</span><span>点赞</span>';
          }
        }
        
        setTimeout(() => {
          this.loadCommunitySourcesList();
          this.loadUserCommunityStats();
        }, 1000);
      } else {
        showToast(result.message || '操作失败', 'error');
      }

    } catch (error) {
      console.error('点赞操作失败:', error);
      showToast('操作失败，请稍后重试: ' + error.message, 'error');
    }
  }

  // 查看搜索源详情
  async viewSourceDetails(sourceId) {
    try {
      showLoading(true);
      
      const result = await communitySourcesService.getCommunitySourceDetails(sourceId);
      
      if (result.success) {
        this.showSourceDetailsModal(result.source);
      } else {
        throw new Error(result.error || '获取搜索源详情失败');
      }

    } catch (error) {
      console.error('获取搜索源详情失败:', error);
      showToast('获取详情失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 显示搜索源详情模态框
  showSourceDetailsModal(source) {
    const modalHTML = `
      <div id="sourceDetailsModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('sourceDetailsModal').remove()">&times;</span>
          <div class="modal-header">
            <div class="source-icon-large">${source.icon || '🔍'}</div>
            <div>
              <h2>${escapeHtml(source.name)}</h2>
              ${source.subtitle ? `<p class="subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
            </div>
            <div class="source-badges">
              ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
              ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
            </div>
          </div>
          
          <div class="modal-body">
            <div class="source-details-grid">
              <div class="detail-section">
                <h4>基本信息</h4>
                <p><strong>URL模板:</strong> <code>${escapeHtml(source.urlTemplate)}</code></p>
                <p><strong>分类:</strong> ${escapeHtml(source.category)}</p>
                <p><strong>作者:</strong> ${escapeHtml(source.author ? source.author.name : 'Unknown')}</p>
                ${source.description ? `<p><strong>描述:</strong> ${escapeHtml(source.description)}</p>` : ''}
              </div>
              
              <div class="detail-section">
                <h4>统计数据</h4>
                <div class="stats-grid">
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
                    <span class="stat-label">下载次数</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
                    <span class="stat-label">点赞数</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
                    <span class="stat-label">浏览量</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-value">${(source.stats?.rating || 0).toFixed(1)}/5.0</span>
                    <span class="stat-label">评分 (${source.stats?.reviewCount || 0}条评价)</span>
                  </div>
                </div>
              </div>
              
              ${source.reviews && source.reviews.length > 0 ? `
                <div class="detail-section">
                  <h4>最新评价</h4>
                  <div class="reviews-list">
                    ${source.reviews.slice(0, 5).map(review => `
                      <div class="review-item">
                        <div class="review-header">
                          <span class="reviewer">${escapeHtml(review.reviewerName)}</span>
                          <span class="review-rating">${this.renderRatingStars(review.rating)}</span>
                          <span class="review-date">${this.formatDate(review.createdAt)}</span>
                        </div>
                        ${review.comment ? `<p class="review-comment">${escapeHtml(review.comment)}</p>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          
          <div class="modal-footer">
            <button class="btn-primary" onclick="window.app.getManager('community').communitySources.downloadSource('${source.id}'); document.getElementById('sourceDetailsModal').remove();">
              添加到我的搜索源
            </button>
            <button class="btn-secondary" onclick="window.app.getManager('community').communitySources.showReviewModal('${source.id}')">
              评价这个搜索源
            </button>
            <button class="btn-tertiary" onclick="document.getElementById('sourceDetailsModal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 显示评价模态框
  showReviewModal(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    const modalHTML = `
      <div id="reviewModal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="document.getElementById('reviewModal').remove()">&times;</span>
          <h2>评价搜索源</h2>
          <form id="reviewForm" onsubmit="window.app.getManager('community').communitySources.submitReview(event, '${sourceId}')">
            <div class="form-group">
              <label for="reviewRating">评分 (1-5星):</label>
              <div class="rating-input">
                <input type="range" id="reviewRating" min="1" max="5" value="5" oninput="document.getElementById('ratingDisplay').textContent = this.value + '星'">
                <span id="ratingDisplay">5星</span>
              </div>
            </div>
            <div class="form-group">
              <label for="reviewComment">评价内容 (可选):</label>
              <textarea id="reviewComment" placeholder="分享您的使用体验..." rows="4"></textarea>
            </div>
            <div class="form-group">
              <label>
                <input type="checkbox" id="reviewAnonymous">
                匿名评价
              </label>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-primary">提交评价</button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('reviewModal').remove()">取消</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 提交评价
  async submitReview(event, sourceId) {
    event.preventDefault();
    
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();
    const isAnonymous = document.getElementById('reviewAnonymous').checked;
    
    try {
      showLoading(true);
      
      const result = await communitySourcesService.reviewCommunitySource(sourceId, {
        rating,
        comment,
        isAnonymous
      });
      
      if (result.success) {
        showToast(result.message || '评价提交成功', 'success');
        document.getElementById('reviewModal').remove();
        
        setTimeout(() => this.loadCommunitySourcesList(), 1000);
      } else {
        showToast(result.message || '评价提交失败', 'error');
      }
      
    } catch (error) {
      console.error('提交评价失败:', error);
      showToast('提交失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 显示举报模态框
  showReportModal(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    const modalHTML = `
      <div id="reportModal" class="modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="document.getElementById('reportModal').remove()">&times;</span>
          <h2>举报搜索源</h2>
          <form id="reportForm" onsubmit="window.app.getManager('community').communitySources.submitReport(event, '${sourceId}')">
            <div class="form-group">
              <label for="reportReason">举报原因:</label>
              <select id="reportReason" required>
                <option value="">请选择举报原因</option>
                <option value="spam">垃圾信息</option>
                <option value="inappropriate">内容不当</option>
                <option value="copyright">版权侵犯</option>
                <option value="malicious">恶意链接</option>
                <option value="misleading">信息误导</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div class="form-group">
              <label for="reportDetails">详细说明:</label>
              <textarea id="reportDetails" placeholder="请详细说明举报原因..." rows="4" required></textarea>
            </div>
            <div class="modal-actions">
              <button type="submit" class="btn-danger">提交举报</button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('reportModal').remove()">取消</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 提交举报
  async submitReport(event, sourceId) {
    event.preventDefault();
    
    const reason = document.getElementById('reportReason').value;
    const details = document.getElementById('reportDetails').value.trim();
    
    if (!reason || !details) {
      showToast('请填写完整的举报信息', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      const result = await communitySourcesService.reportCommunitySource(sourceId, {
        reason,
        details
      });
      
      if (result.success) {
        showToast(result.message || '举报已提交，我们会尽快处理', 'success');
        document.getElementById('reportModal').remove();
      } else {
        showToast(result.message || '举报提交失败', 'error');
      }
      
    } catch (error) {
      console.error('提交举报失败:', error);
      showToast('提交失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔧 修复：更新社区统计显示，包含浏览量统计
  updateCommunityStats() {
    console.log('更新社区统计显示，包含浏览量统计');

    const elements = {
      userSharedCount: document.getElementById('userSharedCount'),
      userDownloadsCount: document.getElementById('userDownloadsCount'), 
      userLikesCount: document.getElementById('userLikesCount'),
      userReputationScore: document.getElementById('userReputationScore')
    };

    const stats = this.userStats?.general || {};
    
    if (elements.userSharedCount) {
      elements.userSharedCount.textContent = stats.sharedSources || 0;
    }
    
    if (elements.userDownloadsCount) {
      elements.userDownloadsCount.textContent = stats.totalDownloads || 0;
    }
    
    if (elements.userLikesCount) {
      elements.userLikesCount.textContent = stats.totalLikes || 0;
    }
    
    // 新增：检查是否有浏览量显示元素 
    const userViewsElement = document.getElementById('userViewsCount'); 
    if (userViewsElement) {
      userViewsElement.textContent = this.formatNumber(stats.totalViews || 0);
    }
    
    if (elements.userReputationScore) {
      const comprehensiveScore = this.calculateComprehensiveReputation(stats);
      const reputationLevel = this.calculateReputationLevel(comprehensiveScore);
      
      elements.userReputationScore.innerHTML = `
        <span style="color: ${reputationLevel.color};">
          ${reputationLevel.icon} ${comprehensiveScore}
        </span>
      `;
      elements.userReputationScore.title = `${reputationLevel.name} - ${comprehensiveScore}点声誉`;
    }
    
    console.log('社区统计更新完成，当前数据:', stats);
  }

  // 计算声誉等级
  calculateReputationLevel(reputationScore) {
    for (const [level, config] of Object.entries(this.reputationLevels)) {
      if (reputationScore >= config.min && reputationScore <= config.max) {
        return config;
      }
    }
    return this.reputationLevels.beginner;
  }

  // 根据各种统计计算综合声誉分数
  calculateComprehensiveReputation(stats) {
    const {
      sharedSources = 0,
      totalDownloads = 0,
      totalLikes = 0,
      totalViews = 0,
      reviewsGiven = 0
    } = stats;
    
    const weights = {
      share: 100,
      download: 10,
      like: 20,
      view: 1,
      review: 5
    };
    
    const score = 
      (sharedSources * weights.share) +
      (totalDownloads * weights.download) +
      (totalLikes * weights.like) +
      (totalViews * weights.view) +
      (reviewsGiven * weights.review);
    
    return Math.floor(score);
  }

  // 显示我的分享弹窗
  async showMySharesModal() {
    console.log('显示我的分享弹窗');
    
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      const result = await communitySourcesService.getCommunitySearchSources({
        author: this.app.getCurrentUser().username,
        limit: 50,
        sort: 'created_at',
        order: 'desc'
      });
      
      if (result.success) {
        this.showMySharesModalContent(result.sources);
      } else {
        throw new Error(result.error || '获取我的分享失败');
      }
      
    } catch (error) {
      console.error('获取我的分享失败:', error);
      showToast('获取我的分享失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 显示我的分享弹窗内容
  showMySharesModalContent(sources) {
    const modalHTML = `
      <div id="mySharesModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('mySharesModal').remove()">&times;</span>
          <div class="modal-header">
            <h2>我的分享 (${sources.length})</h2>
            <p>管理您分享到社区的搜索源</p>
          </div>
          
          <div class="modal-body">
            ${sources.length > 0 ? `
              <div class="my-shares-list">
                ${sources.map(source => this.renderMyShareItem(source)).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <span style="font-size: 3rem;">📁</span>
                <p>您还没有分享过搜索源</p>
                <p>分享您的搜索源让更多人受益吧！</p>
                <button class="btn-primary" onclick="document.getElementById('mySharesModal').remove(); window.app.getManager('community').communitySources.showShareSourceModal();">
                  立即分享搜索源
                </button>
              </div>
            `}
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('mySharesModal').remove()">
              关闭
            </button>
            <button class="btn-primary" onclick="document.getElementById('mySharesModal').remove(); window.app.getManager('community').communitySources.showShareSourceModal();">
              分享新的搜索源
            </button>
          </div>
        </div>
      </div>
    `;
    
    const existingModal = document.getElementById('mySharesModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 渲染我的分享项目
  renderMyShareItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
      Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    // 🔧 修复：处理我的分享中的标签显示
    let tags = [];
    if (source.tags && Array.isArray(source.tags)) {
      const communityTags = this.app.getManager('community').communityTags;
      const availableTags = communityTags ? communityTags.getAvailableTags() : [];
      
      tags = source.tags.slice(0, 3).map(tag => {
        if (typeof tag === 'object' && tag.name) {
          return tag;
        } else if (typeof tag === 'string') {
          const knownTag = availableTags.find(availableTag => availableTag.id === tag);
          return knownTag || { id: tag, name: tag.includes('-') ? `标签-${tag.slice(0, 8)}` : tag, isOfficial: false };
        }
        return { id: 'unknown', name: '未知标签', isOfficial: false };
      });
    }
    
    return `
      <div class="my-share-item" data-source-id="${source.id}">
        <div class="share-item-header">
          <div class="share-item-icon">${source.icon || '🔍'}</div>
          <div class="share-item-info">
            <h4 class="share-item-title">${escapeHtml(source.name)}</h4>
            ${source.subtitle ? `<p class="share-item-subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
            <div class="share-item-meta">
              <span class="category-badge" style="background: ${category?.color || '#6b7280'}">
                ${category?.icon || '🌟'} ${category?.name || '其他'}
              </span>
              <span class="share-date">分享于 ${this.formatDate(source.createdAt)}</span>
            </div>
          </div>
          <div class="share-item-badges">
            ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
            ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
          </div>
        </div>

        ${tags.length > 0 ? `
          <div class="share-item-tags" style="margin-bottom: 1rem;">
            ${tags.map(tag => `
              <span class="tag ${tag.isOfficial ? 'official' : ''}" 
                    style="background-color: ${tag.color || '#3b82f6'}15; border-color: ${tag.color || '#3b82f6'}; color: ${tag.color || '#3b82f6'};">
                ${escapeHtml(tag.name)}
              </span>
            `).join('')}
          </div>
        ` : ''}

        <div class="share-item-stats">
          <div class="stat-item">
            <span class="stat-icon">🔥</span>
            <span class="stat-value">${this.formatNumber(source.stats?.downloads || 0)}</span>
            <span class="stat-label">下载</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👍</span>
            <span class="stat-value">${this.formatNumber(source.stats?.likes || 0)}</span>
            <span class="stat-label">点赞</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">👁</span>
            <span class="stat-value">${this.formatNumber(source.stats?.views || 0)}</span>
            <span class="stat-label">浏览</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">⭐</span>
            <span class="stat-value">${(source.stats?.rating || 0).toFixed(1)}</span>
            <span class="stat-label">评分 (${source.stats?.reviewCount || 0})</span>
          </div>
        </div>

        ${source.description ? `
          <div class="share-item-description">
            ${escapeHtml(source.description)}
          </div>
        ` : ''}

        <div class="share-item-actions">
          <button class="action-btn secondary" onclick="window.app.getManager('community').communitySources.viewSourceDetails('${source.id}')">
            <span>👁️</span>
            <span>查看详情</span>
          </button>
          <button class="action-btn tertiary" onclick="window.app.getManager('community').communitySources.editMyShare('${source.id}')">
            <span>✏️</span>
            <span>编辑</span>
          </button>
          <button class="action-btn danger" onclick="window.app.getManager('community').communitySources.confirmDeleteShare('${source.id}', '${escapeHtml(source.name)}')">
            <span>🗑️</span>
            <span>删除</span>
          </button>
        </div>
      </div>
    `;
  }

  // 确认删除分享的搜索源
  confirmDeleteShare(sourceId, sourceName) {
    const confirmed = confirm(`确定要删除搜索源"${sourceName}"吗？\n\n此操作不可撤销，将同时删除所有相关的评价和统计数据。`);
    
    if (confirmed) {
      this.deleteMyShare(sourceId);
    }
  }

  // 删除我的分享
  async deleteMyShare(sourceId) {
    if (!this.app.getCurrentUser()) {
        showToast('请先登录', 'error');
        return;
    }
    
    try {
        showLoading(true);
        
        console.log('前端开始删除分享的搜索源:', sourceId);
        
        // 添加前端验证
        if (!sourceId || typeof sourceId !== 'string' || sourceId.length < 10) {
            throw new Error('搜索源ID无效');
        }
        
        const result = await communitySourcesService.deleteCommunitySource(sourceId);
        
        if (result.success) {
            showToast(result.message || '删除成功', 'success');
            
            // 从DOM中移除项目
            const shareItem = document.querySelector(`.my-share-item[data-source-id="${sourceId}"]`);
            if (shareItem) {
                shareItem.style.opacity = '0.5';
                shareItem.style.pointerEvents = 'none';
                
                setTimeout(() => {
                    shareItem.remove();
                    this.updateMySharesModalAfterDelete();
                }, 1000);
            }
            
            // 延迟刷新列表
            setTimeout(() => {
                Promise.all([
                    this.loadCommunitySourcesList(),
                    this.loadUserCommunityStats()
                ]).catch(error => {
                    console.warn('刷新数据失败:', error);
                });
            }, 2000);
            
        } else {
            throw new Error(result.message || result.error || '删除失败');
        }
        
    } catch (error) {
        console.error('删除分享失败:', error);
        
        // 用户友好的错误处理
        let errorMessage = '删除失败';
        
        if (error.message.includes('GREATEST') || error.message.includes('兼容性')) {
            errorMessage = '检测到数据库更新，正在应用修复...';
            showToast(errorMessage, 'warning');
            
            // 建议刷新页面
            setTimeout(() => {
                if (confirm('数据库兼容性问题已修复，是否刷新页面以应用修复？')) {
                    window.location.reload();
                }
            }, 3000);
        } else if (error.message.includes('超时')) {
            errorMessage = '删除请求超时，请检查网络连接后重试';
            showToast(errorMessage, 'error');
        } else if (error.message.includes('权限')) {
            errorMessage = '您没有权限删除此搜索源';
            showToast(errorMessage, 'error');
        } else {
            errorMessage += ': ' + error.message;
            showToast(errorMessage, 'error');
        }
        
    } finally {
        showLoading(false);
    }
  }

  // 更新模态框状态的辅助方法
  updateMySharesModalAfterDelete() {
    const remainingItems = document.querySelectorAll('.my-share-item');
    
    if (remainingItems.length === 0) {
      const modalBody = document.querySelector('#mySharesModal .modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">📂</span>
            <p>您还没有分享过搜索源</p>
            <p>分享您的搜索源让更多人受益吧！</p>
            <button class="btn-primary" onclick="document.getElementById('mySharesModal').remove(); window.app.getManager('community').communitySources.showShareSourceModal();">
              立即分享搜索源
            </button>
          </div>
        `;
      }
    }
    
    // 更新标题中的数量
    const modalHeader = document.querySelector('#mySharesModal .modal-header h2');
    if (modalHeader) {
      const newCount = remainingItems.length;
      modalHeader.textContent = `我的分享 (${newCount})`;
    }
  }

  // 编辑我的分享
  editMyShare(sourceId) {
    console.log('编辑我的分享:', sourceId);
    this.showEditMyShareModal(sourceId);
  }

  // 🆕 显示编辑我的分享模态框
  showEditMyShareModal(sourceId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('显示编辑分享模态框:', sourceId);
    this.loadAndShowEditShareModal(sourceId);
  }

  // 🆕 加载并显示编辑分享模态框
  async loadAndShowEditShareModal(sourceId) {
    try {
      showLoading(true);
      
      // 获取搜索源详情
      const result = await communitySourcesService.getMySharedSourceDetails(sourceId);
      
      if (!result.success || !result.source) {
        throw new Error(result.error || '获取搜索源详情失败');
      }
      
      const source = result.source;
      
      // 获取分类选项
      const getCategoryOptions = () => {
        if (APP_CONSTANTS.SOURCE_CATEGORIES) {
          return Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(cat => 
            `<option value="${cat.id}" ${source.category === cat.id ? 'selected' : ''}>${cat.icon} ${cat.name}</option>`
          ).join('');
        }
        return `
          <option value="jav" ${source.category === 'jav' ? 'selected' : ''}>🎬 JAV资源</option>
          <option value="movie" ${source.category === 'movie' ? 'selected' : ''}>🎭 影视资源</option>
          <option value="torrent" ${source.category === 'torrent' ? 'selected' : ''}>🧲 种子磁力</option>
          <option value="other" ${source.category === 'other' ? 'selected' : ''}>🔍 其他搜索</option>
        `;
      };

      const modalHTML = `
        <div id="editShareModal" class="modal" style="display: block;">
          <div class="modal-content large">
            <span class="close" onclick="document.getElementById('editShareModal').remove()">&times;</span>
            <h2>✏️ 编辑分享的搜索源</h2>
            
            <div id="editShareFormError" style="display: none;"></div>
            
            <form id="editShareForm">
              <div class="form-grid">
                <div class="form-group">
                  <label for="editShareName">搜索源名称 <span style="color: red;">*</span>:</label>
                  <input type="text" id="editShareName" name="name" required 
                    value="${escapeHtml(source.name)}" 
                    placeholder="例如：JavDB" maxlength="50">
                  <div class="field-error" id="editShareNameError"></div>
                </div>
                
                <div class="form-group">
                  <label for="editShareSubtitle">副标题:</label>
                  <input type="text" id="editShareSubtitle" name="subtitle" 
                    value="${escapeHtml(source.subtitle || '')}"
                    placeholder="简短描述" maxlength="100">
                </div>
                
                <div class="form-group">
                  <label for="editShareIcon">图标 (emoji):</label>
                  <input type="text" id="editShareIcon" name="icon" 
                    value="${escapeHtml(source.icon || '🔍')}"
                    placeholder="🔍" maxlength="4">
                </div>
                
                <div class="form-group">
                  <label for="editShareCategory">分类 <span style="color: red;">*</span>:</label>
                  <select id="editShareCategory" name="category" required>
                    ${getCategoryOptions()}
                  </select>
                  <div class="field-error" id="editShareCategoryError"></div>
                </div>
              </div>
              
              <div class="form-group">
                <label for="editShareDescription">详细描述:</label>
                <textarea id="editShareDescription" name="description" 
                  placeholder="介绍这个搜索源的特点和用法..." 
                  rows="4" maxlength="500">${escapeHtml(source.description || '')}</textarea>
              </div>
              
              <!-- 标签选择器 -->
              <div class="form-group">
                <label>选择标签:</label>
                ${this.renderEditTagSelector(source.tags || [])}
              </div>
              
              <div class="form-actions">
                <button type="submit" class="btn-primary">
                  <span>💾</span>
                  <span>保存更改</span>
                </button>
                <button type="button" class="btn-secondary" onclick="document.getElementById('editShareModal').remove()">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      
      // 绑定表单提交事件
      const form = document.getElementById('editShareForm');
      if (form) {
        form.addEventListener('submit', (e) => this.submitEditShareForm(e, sourceId));
      }
      
    } catch (error) {
      console.error('加载编辑分享模态框失败:', error);
      showToast('加载失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🆕 渲染编辑时的标签选择器（预选已有标签）
  renderEditTagSelector(selectedTags = []) {
    const communityTags = this.app.getManager('community').communityTags;
    if (!communityTags) {
      return `
        <div class="tag-selector">
          <div class="empty-tags">
            <p>标签管理器未加载</p>
          </div>
        </div>
      `;
    }

    return communityTags.renderEditTagSelector(selectedTags);
  }

  // 🆕 提交编辑分享表单
  async submitEditShareForm(event, sourceId) {
    event.preventDefault();
    
    const form = document.getElementById('editShareForm');
    if (!form) return;

    this.clearFormErrors('editShareModal');

    const formData = new FormData(form);
    
    // 获取选中的标签ID
    const selectedTags = Array.from(document.querySelectorAll('#editShareModal .tag-selector-item.selected input[type="checkbox"]'))
      .map(checkbox => checkbox.value);

    const updates = {
      name: formData.get('name')?.trim(),
      subtitle: formData.get('subtitle')?.trim() || '',
      icon: formData.get('icon')?.trim() || '🔍',
      category: formData.get('category'),
      description: formData.get('description')?.trim() || '',
      tags: selectedTags
    };

    // 前端验证
    let hasError = false;

    if (!updates.name || updates.name.length < 2) {
      this.showFieldError('editShareName', '搜索源名称至少需要2个字符');
      hasError = true;
    }

    if (!updates.category) {
      this.showFieldError('editShareCategory', '请选择一个分类');
      hasError = true;
    }

    if (hasError) return;

    try {
      showLoading(true);
      
      console.log('提交编辑分享:', sourceId, updates);
      
      const result = await communitySourcesService.editCommunitySource(sourceId, updates);
      
      if (result.success) {
        showToast('搜索源更新成功！', 'success');
        document.getElementById('editShareModal').remove();
        
        // 刷新我的分享列表和社区列表
        await Promise.all([
          this.loadCommunitySourcesList(),
          this.loadUserCommunityStats()
        ]);
        
        // 如果我的分享模态框是打开的，也刷新它
        const mySharesModal = document.getElementById('mySharesModal');
        if (mySharesModal) {
          this.showMySharesModal();
        }
        
      } else {
        this.showFormError('editShareFormError', result.message || '更新失败');
      }
      
    } catch (error) {
      console.error('编辑分享失败:', error);
      this.showFormError('editShareFormError', '编辑失败: ' + error.message);
    } finally {
      showLoading(false);
    }
  }

  // 显示标签搜索源模态框
  async showTagSourcesModal(tagId, tagName) {
    try {
      showLoading(true);
      
      console.log(`开始查找标签 "${tagName}" (ID: ${tagId}) 相关的搜索源`);
      
      // 方法1：通过标签ID直接过滤（主要方式）
      let result = await communitySourcesService.getCommunitySearchSources({
        tags: [tagId],
        limit: 100,
        sort: 'created_at',
        order: 'desc'
      });
      
      // 🔧 如果后端标签过滤返回空结果，尝试前端过滤作为降级方案
      if (!result.success || !result.sources || result.sources.length === 0) {
        console.log('后端标签过滤未返回结果，尝试获取所有源然后前端过滤...');
        
        // 获取所有搜索源
        const allSourcesResult = await communitySourcesService.getCommunitySearchSources({
          limit: 200, // 获取更多数据用于过滤
          sort: 'created_at',
          order: 'desc'
        });
        
        if (allSourcesResult.success && allSourcesResult.sources) {
          // 前端过滤包含该标签的搜索源
          const filteredSources = allSourcesResult.sources.filter(source => {
            if (!source.tags || !Array.isArray(source.tags)) {
              return false;
            }
            
            // 检查标签数组中是否包含目标标签
            return source.tags.some(tag => {
              if (typeof tag === 'object' && tag.id) {
                return tag.id === tagId || tag.name === tagName;
              } else if (typeof tag === 'string') {
                return tag === tagId || tag === tagName;
              }
              return false;
            });
          });
          
          console.log(`前端过滤结果：从 ${allSourcesResult.sources.length} 个搜索源中找到 ${filteredSources.length} 个包含标签 "${tagName}" 的搜索源`);
          
          result = {
            success: true,
            sources: filteredSources
          };
        }
      }
      
      if (result.success) {
        console.log(`找到 ${result.sources.length} 个使用标签 "${tagName}" 的搜索源`);
        this.renderTagSourcesModal(tagName, result.sources, tagId);
      } else {
        throw new Error(result.error || '获取标签相关搜索源失败');
      }
      
    } catch (error) {
      console.error('获取标签搜索源失败:', error);
      
      // 🔧 降级方案：使用搜索功能
      console.log('尝试降级方案：使用标签名称搜索...');
      try {
        const searchResult = await this.searchByTagName(tagName);
        if (searchResult && searchResult.length > 0) {
          console.log(`降级方案成功：通过搜索找到 ${searchResult.length} 个相关搜索源`);
          this.renderTagSourcesModal(tagName, searchResult, tagId, true); // 第四个参数表示是搜索结果
        } else {
          this.renderTagSourcesModal(tagName, [], tagId);
        }
      } catch (searchError) {
        console.error('降级搜索也失败:', searchError);
        this.renderTagSourcesModal(tagName, [], tagId);
      }
    } finally {
      showLoading(false);
    }
  }

  // 🔧 新增：通过标签名称搜索的降级方案
  async searchByTagName(tagName) {
    try {
      const result = await communitySourcesService.searchCommunityPosts(tagName, {
        limit: 50,
        category: 'all'
      });
      
      return result.success ? result.sources : [];
    } catch (error) {
      console.error('标签名称搜索失败:', error);
      return [];
    }
  }

  // 🆕 渲染标签搜索源弹窗
  renderTagSourcesModal(tagName, sources) {
    const modalHTML = `
      <div id="tagSourcesModal" class="modal" style="display: block;">
        <div class="modal-content large">
          <span class="close" onclick="document.getElementById('tagSourcesModal').remove()">&times;</span>
          <div class="modal-header">
            <h2>🏷️ 标签: ${escapeHtml(tagName)}</h2>
            <p>共找到 ${sources.length} 个相关搜索源</p>
          </div>
          
          <div class="modal-body">
            ${sources.length > 0 ? `
              <div class="tag-sources-grid">
                ${sources.map(source => this.renderTagSourceItem(source)).join('')}
              </div>
            ` : `
              <div class="empty-state">
                <span style="font-size: 3rem;">📂</span>
                <p>暂无使用此标签的搜索源</p>
              </div>
            `}
          </div>
          
          <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('tagSourcesModal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 🆕 渲染标签搜索源项目（简化版）
  renderTagSourceItem(source) {
    const category = APP_CONSTANTS.SOURCE_CATEGORIES ? 
        Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).find(cat => cat.id === source.category) : null;
    
    return `
      <div class="tag-source-item" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-icon">${source.icon || '🔍'}</div>
          <div class="source-info">
            <h4 class="source-title">${escapeHtml(source.name)}</h4>
            ${source.subtitle ? `<p class="source-subtitle">${escapeHtml(source.subtitle)}</p>` : ''}
          </div>
          <div class="source-badges">
            ${source.isVerified ? '<span class="badge verified">已验证</span>' : ''}
            ${source.isFeatured ? '<span class="badge featured">推荐</span>' : ''}
          </div>
        </div>
        
        <div class="source-meta">
          <span class="category-badge" style="background: ${category?.color || '#6b7280'}">
            ${category?.icon || '🌟'} ${category?.name || '其他'}
          </span>
          <span class="source-author">
            由 ${escapeHtml(source.author?.name || 'Unknown')} 分享
          </span>
        </div>
        
        <div class="source-stats-mini">
          <span class="stat">⭐ ${(source.stats?.rating || 0).toFixed(1)}</span>
          <span class="stat">🔥 ${this.formatNumber(source.stats?.downloads || 0)}</span>
          <span class="stat">👍 ${this.formatNumber(source.stats?.likes || 0)}</span>
        </div>
        
        <div class="source-actions-mini">
          <button class="btn-primary btn-sm" onclick="window.app.getManager('community').communitySources.downloadSource('${source.id}')">
            添加到我的搜索源
          </button>
          <button class="btn-secondary btn-sm" onclick="window.app.getManager('community').communitySources.viewSourceDetails('${source.id}')">
            查看详情
          </button>
        </div>
      </div>
    `;
  }

  // 辅助方法：清除表单错误
  clearFormErrors(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.querySelectorAll('.field-error').forEach(error => {
      error.style.display = 'none';
      error.textContent = '';
    });
    
    modal.querySelectorAll('.form-group input, .form-group select, .form-group textarea').forEach(field => {
      field.classList.remove('error');
      field.style.borderColor = '';
    });
    
    const formError = modal.querySelector('[id$="FormError"]');
    if (formError) {
      formError.style.display = 'none';
      formError.textContent = '';
    }
  }
  
  // 辅助方法：显示表单错误
  showFormError(errorId, message) {
    const errorDiv = document.getElementById(errorId);
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      showToast(message, 'error');
    }
  }

  // 辅助方法：显示字段错误
  showFieldError(fieldId, message) {
    const errorDiv = document.getElementById(fieldId + 'Error');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.style.color = '#ef4444';
    }
    
    const field = document.getElementById(fieldId);
    if (field) {
      field.classList.add('error');
      field.style.borderColor = '#ef4444';
      
      // 聚焦到错误字段
      setTimeout(() => field.focus(), 100);
      
      // 清除错误状态当用户开始输入
      const clearError = () => {
        field.classList.remove('error');
        field.style.borderColor = '';
        if (errorDiv) {
          errorDiv.style.display = 'none';
        }
        field.removeEventListener('input', clearError);
        field.removeEventListener('focus', clearError);
      };
      
      field.addEventListener('input', clearError);
      field.addEventListener('focus', clearError);
    }
  }

  // 辅助方法
  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatDate(timestamp) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '未知时间';
    }
  }

  // 刷新社区数据
  async refreshCommunityData() {
    console.log('刷新社区数据');
    await this.loadTabData();
  }

  // 搜索社区内容
  async searchCommunity(query) {
    console.log('搜索社区内容:', query);
    
    try {
      const result = await communitySourcesService.searchCommunityPosts(query, {
        category: this.currentFilters.category,
        limit: this.currentLimit
      });
      
      if (result.success) {
        this.currentSources = result.sources;
        this.renderCommunitySourcesList(result.sources, { page: 1, totalPages: 1 });
        return result.sources;
      } else {
        throw new Error(result.error || '搜索失败');
      }
      
    } catch (error) {
      console.error('搜索社区内容失败:', error);
      showToast('搜索失败: ' + error.message, 'error');
      return [];
    }
  }

  // 公共方法供其他管理器调用
  getTotalCommunityStats() {
    return this.communityStats;
  }

  getCurrentSources() {
    return this.currentSources;
  }

  getCurrentPagination() {
    return this.currentPagination;
  }

  getUserStats() {
    return this.userStats;
  }
}

export default CommunitySourcesManager;