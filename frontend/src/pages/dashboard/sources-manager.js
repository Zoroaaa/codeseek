// 搜索源管理器
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class SourcesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinSearchSources = [];
    this.customSearchSources = [];
    this.allSearchSources = [];
    this.enabledSources = [];
    this.editingCustomSource = null;
  }

  async init() {
    console.log('🔧 初始化搜索源管理器');
    this.loadBuiltinData();
    this.bindEvents();
  }

  async loadData() {
    await this.loadUserSearchSettings();
  }

  async loadTabData() {
    try {
      await this.loadUserSearchSettings();
      this.updateCategoryFilterOptions();
      this.renderSourcesList();
      this.updateSourcesStats();
    } catch (error) {
      console.error('加载搜索源数据失败:', error);
      showToast('加载搜索源数据失败', 'error');
    }
  }

  loadBuiltinData() {
    try {
      this.builtinSearchSources = APP_CONSTANTS.SEARCH_SOURCES.map(source => ({
        ...source,
        isBuiltin: true,
        isCustom: false
      }));
      
      this.allSearchSources = [...this.builtinSearchSources];
      console.log(`从constants.js加载了 ${this.builtinSearchSources.length} 个内置搜索源`);
      
    } catch (error) {
      console.error('加载内置数据失败:', error);
      this.builtinSearchSources = [];
      this.allSearchSources = [];
    }
  }

  async loadUserSearchSettings() {
    if (!this.app.getCurrentUser()) return;
    
    try {
      const userSettings = await apiService.getUserSettings();
      
      this.customSearchSources = userSettings.customSearchSources || [];
      this.enabledSources = userSettings.searchSources || APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      
      // 合并内置和自定义数据
      this.allSearchSources = [
        ...this.builtinSearchSources,
        ...this.customSearchSources.map(s => ({ ...s, isBuiltin: false, isCustom: true }))
      ];
      
      console.log(`用户设置：启用 ${this.enabledSources.length} 个搜索源，包含 ${this.customSearchSources.length} 个自定义源`);
      
    } catch (error) {
      console.warn('加载用户搜索源设置失败，使用默认设置:', error);
      this.customSearchSources = [];
      this.enabledSources = APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources;
      this.allSearchSources = [...this.builtinSearchSources];
    }
  }

  bindEvents() {
    // 添加自定义搜索源按钮
    const addCustomSourceBtn = document.getElementById('addCustomSourceBtn');
    if (addCustomSourceBtn) {
      addCustomSourceBtn.addEventListener('click', () => this.showCustomSourceModal());
    }

    // 搜索源筛选和排序
    const sourcesFilter = document.getElementById('sourcesFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const sourcesSort = document.getElementById('sourcesSort');

    if (sourcesFilter) {
      sourcesFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (sourcesSort) {
      sourcesSort.addEventListener('change', () => this.filterAndSortSources());
    }

    // 批量操作按钮
    this.bindBulkActionEvents();
  }

  bindBulkActionEvents() {
    const bulkActions = {
      'enableAllSources': () => this.enableAllSources(),
      'disableAllSources': () => this.disableAllSources(),
      'resetToDefaults': () => this.resetToDefaults()
    };

    Object.entries(bulkActions).forEach(([action, handler]) => {
      const element = document.querySelector(`[onclick*="${action}"]`);
      if (element) {
        element.removeAttribute('onclick');
        element.addEventListener('click', handler);
      }
    });
  }

  updateCategoryFilterOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const categoriesManager = this.app.getManager('categories');
    const allCategories = categoriesManager ? categoriesManager.getAllCategories() : [];

    const categoriesHTML = allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    categoryFilter.innerHTML = `
      <option value="all">全部分类</option>
      ${categoriesHTML}
    `;
  }

  renderSourcesList() {
    const sourcesList = document.getElementById('sourcesList');
    if (!sourcesList) return;

    // 获取当前筛选和排序设置
    const filter = document.getElementById('sourcesFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const sort = document.getElementById('sourcesSort')?.value || 'priority';

    // 应用筛选
    let filteredSources = this.allSearchSources;

    if (filter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        switch (filter) {
          case 'enabled':
            return this.enabledSources.includes(source.id);
          case 'disabled':
            return !this.enabledSources.includes(source.id);
          case 'builtin':
            return source.isBuiltin;
          case 'custom':
            return source.isCustom;
          case 'searchable':  // 🔧 新增：可搜索源
            return source.searchable !== false;
          case 'browse_only': // 🔧 新增：仅浏览站点
            return source.searchable === false;
          case 'supports_detail':
            return this.supportsDetailExtraction(source.id);
          default:
            return true;
        }
      });
    }

    if (categoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => source.category === categoryFilter);
    }

    // 应用排序
    this.sortSources(filteredSources, sort);

    if (filteredSources.length === 0) {
      sourcesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的搜索源</p>
          <button class="btn-primary" onclick="app.getManager('sources').showCustomSourceModal()">添加自定义搜索源</button>
        </div>
      `;
      return;
    }

    sourcesList.innerHTML = `
      <div class="sources-grid">
        ${filteredSources.map(source => this.renderSourceItem(source)).join('')}
      </div>
    `;

    this.bindSourceItemEvents();
  }

  sortSources(sources, sortBy) {
    sources.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          const catA = this.getCategoryById(a.category)?.name || 'Unknown';
          const catB = this.getCategoryById(b.category)?.name || 'Unknown';
          return catA.localeCompare(catB);
        case 'status':
          const statusA = this.enabledSources.includes(a.id) ? 0 : 1;
          const statusB = this.enabledSources.includes(b.id) ? 0 : 1;
          return statusA - statusB;
        case 'site_type':  // 🔧 新增：按网站类型排序
          const siteTypeA = a.siteType || 'search';
          const siteTypeB = b.siteType || 'search';
          return siteTypeA.localeCompare(siteTypeB);
        case 'searchable': // 🔧 新增：按可搜索性排序
          const searchableA = a.searchable !== false ? 0 : 1;
          const searchableB = b.searchable !== false ? 0 : 1;
          return searchableA - searchableB;
        case 'priority':
        default:
          if (a.isBuiltin && b.isBuiltin) {
            return (a.priority || 999) - (b.priority || 999);
          }
          if (a.isBuiltin && !b.isBuiltin) return -1;
          if (!a.isBuiltin && b.isBuiltin) return 1;
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });
  }

  renderSourceItem(source) {
    const category = this.getCategoryById(source.category);
    const isEnabled = this.enabledSources.includes(source.id);
    const supportsDetailExtraction = this.supportsDetailExtraction(source.id);
    
    // 🔧 网站类型标识
    const siteTypeLabel = {
      'search': '搜索源',
      'browse': '浏览站',
      'reference': '参考站'
    }[source.siteType || 'search'];
    
    const searchableIcon = source.searchable === false ? '🚫' : '🔍';
    const searchableTitle = source.searchable === false ? '不参与搜索' : '参与搜索';
    
    return `
      <div class="source-item ${isEnabled ? 'enabled' : 'disabled'}" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-toggle">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                   onchange="app.getManager('sources').toggleSourceEnabled('${source.id}', this.checked)">
          </div>
          <div class="source-info">
            <div class="source-name">
              <span class="source-icon">${source.icon}</span>
              <span class="source-title">${escapeHtml(source.name)}</span>
              ${source.isCustom ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
            </div>
            <div class="source-subtitle">${escapeHtml(source.subtitle || '')}</div>
            <div class="source-meta">
              <div class="source-category">
                <span>分类：${category ? `${category.icon} ${category.name}` : '未知分类'}</span>
              </div>
              <div class="source-url">${escapeHtml(source.urlTemplate)}</div>
            </div>
            <!-- 🔧 新增：网站类型标识 -->
            <div class="source-badges">
              <span class="searchable-badge" title="${searchableTitle}">
                ${searchableIcon}
              </span>
              <span class="site-type-badge">${siteTypeLabel}</span>
              ${source.searchPriority ? `<span class="priority-badge">优先级: ${source.searchPriority}</span>` : ''}
              ${supportsDetailExtraction ? '<span class="detail-support-badge">支持详情提取</span>' : ''}
            </div>
          </div>
        </div>
        <div class="source-actions">
          <button class="action-btn test-btn" onclick="app.getManager('sources').testSource('${source.id}')" title="测试搜索">
            测试
          </button>
          <button class="action-btn visit-btn" onclick="app.getManager('sources').visitSource('${source.id}')" title="访问网站">
            访问
          </button>
          ${source.isCustom ? `
            <button class="action-btn edit-btn" onclick="app.getManager('sources').editCustomSource('${source.id}')" title="编辑">
              编辑
            </button>
            <button class="action-btn delete-btn" onclick="app.getManager('sources').deleteCustomSource('${source.id}')" title="删除">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  bindSourceItemEvents() {
    // 这里可以绑定额外的事件，目前使用onclick处理
  }

  filterAndSortSources() {
    this.renderSourcesList();
  }

  async toggleSourceEnabled(sourceId, enabled) {
    try {
      if (enabled) {
        if (!this.enabledSources.includes(sourceId)) {
          this.enabledSources.push(sourceId);
        }
      } else {
        this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      }

      await this.saveSearchSourcesSettings();
      this.updateSourcesStats();
      
      showToast(`搜索源已${enabled ? '启用' : '禁用'}`, 'success', 2000);
      
    } catch (error) {
      console.error('切换搜索源状态失败:', error);
      showToast('操作失败: ' + error.message, 'error');
      this.renderSourcesList();
    }
  }

  async enableAllSources() {
    try {
      this.enabledSources = this.allSearchSources.map(s => s.id);
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已启用所有搜索源', 'success');
    } catch (error) {
      console.error('启用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async disableAllSources() {
    if (!confirm('确定要禁用所有搜索源吗？这将影响搜索功能。')) return;
    
    try {
      this.enabledSources = [];
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已禁用所有搜索源', 'success');
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (!confirm('确定要重置为默认搜索源配置吗？')) return;
    
    try {
      this.enabledSources = [...APP_CONSTANTS.DEFAULT_USER_SETTINGS.searchSources];
      await this.saveSearchSourcesSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已重置为默认配置', 'success');
    } catch (error) {
      console.error('重置搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async testSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      const testUrl = source.urlTemplate.replace('{keyword}', 'test');
      window.open(testUrl, '_blank', 'noopener,noreferrer');
      showToast('已在新窗口中打开测试链接', 'success', 2000);
    } catch (error) {
      console.error('测试搜索源失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    }
  }

  async visitSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      const urlObj = new URL(source.urlTemplate.replace('{keyword}', ''));
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('访问搜索源失败:', error);
      showToast('访问失败: ' + error.message, 'error');
    }
  }

  showCustomSourceModal(source = null) {
    this.editingCustomSource = source;
    
    let modal = document.getElementById('customSourceModal');
    if (!modal) {
      modal = this.createCustomSourceModal();
      document.body.appendChild(modal);
    }
    
    this.populateCustomSourceForm(modal, source);
    modal.style.display = 'block';
    
    setTimeout(() => {
      const nameInput = modal.querySelector('#sourceName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  createCustomSourceModal() {
    const modal = document.createElement('div');
    modal.id = 'customSourceModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义搜索源</h2>
        <form id="customSourceForm">
          <input type="hidden" name="sourceId">
          
          <div class="form-row">
            <div class="form-group">
              <label for="sourceName">搜索源名称 *</label>
              <input type="text" name="sourceName" id="sourceName" required maxlength="50" 
                     placeholder="例如：我的搜索站">
            </div>
            
            <div class="form-group">
              <label for="sourceIcon">图标</label>
              <input type="text" name="sourceIcon" id="sourceIcon" maxlength="5" 
                     placeholder="🔍" value="🔍">
            </div>
          </div>
          
          <div class="form-group">
            <label for="sourceSubtitle">描述信息</label>
            <input type="text" name="sourceSubtitle" id="sourceSubtitle" maxlength="100" 
                   placeholder="例如：专业的搜索引擎">
          </div>
          
          <div class="form-group">
            <label for="sourceCategory">搜索源分类 *</label>
            <select name="sourceCategory" id="sourceCategory" required>
              <!-- 分类选项将动态生成 -->
            </select>
          </div>
          
          <div class="form-group">
            <label for="sourceUrl">搜索URL模板 *</label>
            <input type="url" name="sourceUrl" id="sourceUrl" required 
                   placeholder="https://example.com/search?q={keyword}">
            <small class="form-help">
              URL中必须包含 <code>{keyword}</code> 占位符，搜索时会被替换为实际关键词
            </small>
          </div>
          
          <!-- 🔧 新增：网站类型配置 -->
          <fieldset class="site-config-section">
            <legend>网站类型配置</legend>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="searchable" id="searchable" checked>
                参与番号搜索
              </label>
              <small>取消勾选后，搜索时不会显示该网站</small>
            </div>
            
            <div class="form-group">
              <label for="siteType">网站类型</label>
              <select name="siteType" id="siteType">
                <option value="search">搜索源</option>
                <option value="browse">浏览站</option>
                <option value="reference">参考站</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="searchPriority">搜索优先级</label>
              <input type="number" name="searchPriority" id="searchPriority" 
                     min="1" max="10" value="5">
              <small>数字越小优先级越高</small>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="requiresKeyword" id="requiresKeyword" checked>
                需要搜索关键词
              </label>
            </div>
          </fieldset>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">添加搜索源</button>
          </div>
        </form>
      </div>
    `;
    
    const form = modal.querySelector('#customSourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomSourceSubmit(e));
    }
    
    return modal;
  }

  // 🔧 修改 populateCustomSourceForm - 自动设置默认值
  populateCustomSourceForm(modal, source) {
    const form = modal.querySelector('#customSourceForm');
    if (!form) return;

    if (source) {
      // 编辑模式 - 加载现有值
      form.sourceId.value = source.id;
      form.sourceName.value = source.name;
      form.sourceSubtitle.value = source.subtitle || '';
      form.sourceIcon.value = source.icon || '🔍';
      form.sourceUrl.value = source.urlTemplate;
      form.sourceCategory.value = source.category || 'others';
      form.searchable.checked = source.searchable !== false;
      form.siteType.value = source.siteType || 'search';
      form.searchPriority.value = source.searchPriority || 5;
      form.requiresKeyword.checked = source.requiresKeyword !== false;
      modal.querySelector('h2').textContent = '编辑自定义搜索源';
      modal.querySelector('[type="submit"]').textContent = '更新搜索源';
    } else {
      // 新增模式 - 根据分类设置默认值
      form.reset();
      form.sourceIcon.value = '🔍';
      form.sourceCategory.value = 'others';
      form.searchable.checked = true;
      form.siteType.value = 'search';
      form.searchPriority.value = 5;
      form.requiresKeyword.checked = true;
      modal.querySelector('h2').textContent = '添加自定义搜索源';
      modal.querySelector('[type="submit"]').textContent = '添加搜索源';
      
      // 🔧 根据分类的默认配置自动设置
      const categorySelect = form.sourceCategory;
      categorySelect.addEventListener('change', (e) => {
        const category = this.app.getManager('categories').getCategoryById(e.target.value);
        if (category) {
          form.searchable.checked = category.defaultSearchable !== false;
          form.siteType.value = category.defaultSiteType || 'search';
          form.searchPriority.value = category.searchPriority || 5;
        }
      });
    }
    
    this.updateSourceCategorySelect(form.sourceCategory);
  }

  updateSourceCategorySelect(selectElement) {
    if (!selectElement) return;

    const categoriesManager = this.app.getManager('categories');
    const allCategories = categoriesManager ? categoriesManager.getAllCategories() : [];

    const categoriesHTML = allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    selectElement.innerHTML = categoriesHTML;
  }

  async handleCustomSourceSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const sourceData = {
      id: formData.get('sourceId') || null,
      name: formData.get('sourceName').trim(),
      subtitle: formData.get('sourceSubtitle').trim(),
      icon: formData.get('sourceIcon').trim() || '🔍',
      urlTemplate: formData.get('sourceUrl').trim(),
      category: formData.get('sourceCategory'),
      // 🔧 新增：网站类型配置
      searchable: formData.get('searchable') === 'on',
      siteType: formData.get('siteType') || 'search',
      searchPriority: parseInt(formData.get('searchPriority')) || 5,
      requiresKeyword: formData.get('requiresKeyword') === 'on'
    };
    
    const validation = this.validateCustomSource(sourceData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingCustomSource && sourceData.id) {
        await this.updateCustomSource(sourceData);
        showToast('自定义搜索源更新成功', 'success');
      } else {
        await this.addCustomSource(sourceData);
        showToast('自定义搜索源添加成功', 'success');
      }
      
      await this.loadUserSearchSettings();
      await this.loadTabData();
      this.app.closeModals();
      
    } catch (error) {
      console.error('保存自定义搜索源失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  validateCustomSource(sourceData) {
    const rules = APP_CONSTANTS.VALIDATION_RULES.SOURCE;
    
    const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
    
    for (const field of requiredFieldsForValidation) {
      if (!sourceData[field] || sourceData[field].trim() === '') {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(sourceData.name)) {
      return { valid: false, message: '搜索源名称格式不正确' };
    }
    
    if (!rules.URL_PATTERN.test(sourceData.urlTemplate)) {
      return { valid: false, message: 'URL模板必须包含{keyword}占位符' };
    }
    
    try {
      const hostname = new URL(sourceData.urlTemplate.replace('{keyword}', 'test')).hostname;
      if (rules.FORBIDDEN_DOMAINS.some(domain => hostname.includes(domain))) {
        return { valid: false, message: '不允许使用该域名' };
      }
    } catch (error) {
      return { valid: false, message: 'URL格式无效' };
    }
    
    if (!sourceData.id) {
      const generatedId = this.generateSourceId(sourceData.name);
      if (this.allSearchSources.some(s => s.id === generatedId)) {
        return { valid: false, message: '搜索源名称已存在，请使用不同的名称' };
      }
    }
    
    const categoriesManager = this.app.getManager('categories');
    if (!categoriesManager || !categoriesManager.getCategoryById(sourceData.category)) {
      return { valid: false, message: '选择的分类不存在' };
    }
    
    return { valid: true };
  }

  generateSourceId(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20) + '_' + Date.now().toString(36);
  }

  async addCustomSource(sourceData) {
    sourceData.id = this.generateSourceId(sourceData.name);
    sourceData.createdAt = Date.now();
    sourceData.isCustom = true;
    sourceData.isBuiltin = false;
    
    this.customSearchSources.push(sourceData);
    this.allSearchSources.push({ ...sourceData, isCustom: true, isBuiltin: false });
    
    await this.saveCustomSearchSources();
  }

  async updateCustomSource(sourceData) {
    const index = this.customSearchSources.findIndex(s => s.id === sourceData.id);
    if (index === -1) {
      throw new Error('未找到要更新的搜索源');
    }
    
    this.customSearchSources[index] = { ...this.customSearchSources[index], ...sourceData };
    
    const allIndex = this.allSearchSources.findIndex(s => s.id === sourceData.id);
    if (allIndex !== -1) {
      this.allSearchSources[allIndex] = { ...this.allSearchSources[allIndex], ...sourceData };
    }
    
    await this.saveCustomSearchSources();
  }

  editCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    this.showCustomSourceModal(source);
  }

  async deleteCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义搜索源"${source.name}"吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      
      this.customSearchSources = this.customSearchSources.filter(s => s.id !== sourceId);
      this.allSearchSources = this.allSearchSources.filter(s => s.id !== sourceId);
      this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      
      await this.saveCustomSearchSources();
      await this.loadTabData();
      
      showToast('自定义搜索源删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async saveCustomSearchSources() {
    const settings = {
      customSearchSources: this.customSearchSources,
      searchSources: this.enabledSources,
      customSourceCategories: this.getCustomCategories()
    };
    
    await apiService.updateUserSettings(settings);
  }

  async saveSearchSourcesSettings() {
    const settings = {
      searchSources: this.enabledSources,
      customSearchSources: this.customSearchSources,
      customSourceCategories: this.getCustomCategories()
    };
    
    await apiService.updateUserSettings(settings);
    
    // 通知主页面更新站点导航
    window.dispatchEvent(new CustomEvent('searchSourcesChanged', {
      detail: { newSources: this.enabledSources }
    }));
  }

  updateSourcesStats() {
    const elements = {
      totalSourcesCount: document.getElementById('totalSourcesCount'),
      enabledSourcesCount: document.getElementById('enabledSourcesCount'),
      customSourcesCount: document.getElementById('customSourcesCount'),
      categoriesCount: document.getElementById('categoriesCount')
    };

    if (elements.totalSourcesCount) elements.totalSourcesCount.textContent = this.allSearchSources.length;
    if (elements.enabledSourcesCount) elements.enabledSourcesCount.textContent = this.enabledSources.length;
    if (elements.customSourcesCount) elements.customSourcesCount.textContent = this.customSearchSources.length;
    
    const categoriesManager = this.app.getManager('categories');
    const categoriesCount = categoriesManager ? categoriesManager.getAllCategories().length : 0;
    if (elements.categoriesCount) elements.categoriesCount.textContent = categoriesCount;
  }

  async exportSources() {
    try {
      const data = {
        builtinSources: this.builtinSearchSources,
        customSources: this.customSearchSources,
        enabledSources: this.enabledSources,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-sources-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('搜索源配置导出成功', 'success');
    } catch (error) {
      console.error('导出搜索源失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  resetEditingState() {
    this.editingCustomSource = null;
  }

  // 🔧 新增：检查搜索源是否支持详情提取
  supportsDetailExtraction(sourceId) {
    const detailSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [];
    return detailSources.includes(sourceId);
  }

  // 辅助方法
  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  getCategoryById(categoryId) {
    const categoriesManager = this.app.getManager('categories');
    return categoriesManager ? categoriesManager.getCategoryById(categoryId) : null;
  }

  getCustomCategories() {
    const categoriesManager = this.app.getManager('categories');
    return categoriesManager ? categoriesManager.getCustomCategories() : [];
  }

  // 公共方法供其他管理器调用
  getTotalSourcesCount() {
    return this.allSearchSources.length;
  }

  getEnabledSourcesCount() {
    return this.enabledSources.length;
  }

  getAllSearchSources() {
    return this.allSearchSources;
  }
}

export default SourcesManager;