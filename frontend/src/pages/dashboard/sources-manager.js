// 搜索源管理器 - 修复版本:解决字段匹配和分类显示问题，支持内置搜索源编辑
import { APP_CONSTANTS, validateSourceUrl } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import searchSourcesAPI from '../../services/search-sources-api.js';

export class SourcesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinSearchSources = [];
    this.customSearchSources = [];
    this.allSearchSources = [];
    this.enabledSources = [];
    this.editingSource = null; // 🔄 改名为通用的编辑状态
    
    this.majorCategories = [];
    this.allCategories = [];
  }

  async init() {
    console.log('🔧 初始化搜索源管理器');
    this.bindEvents();
  }

  async loadData() {
    await this.loadUserSearchSettings();
  }

  async loadTabData() {
    try {
      await this.loadUserSearchSettings();
      this.updateCategoryFilterOptions();
      this.updateMajorCategoryFilterOptions();
      this.renderSourcesList();
      this.updateSourcesStats();
    } catch (error) {
      console.error('加载搜索源数据失败:', error);
      showToast('加载搜索源数据失败', 'error');
    }
  }

// 🔴 改进 loadUserSearchSettings 方法，确保加载用户自定义分类
async loadUserSearchSettings() {
  if (!this.app.getCurrentUser()) {
    await this.loadMinimalDataSet();
    return;
  }
  
  try {
    console.log('📡 从新API加载搜索源数据...');
    
    // 获取大类数据
    this.majorCategories = await searchSourcesAPI.getMajorCategories();
    console.log('✅ 已加载大类:', this.majorCategories);
    
    // 🔴 修复：确保获取所有分类，包括用户自定义的
    this.allCategories = await searchSourcesAPI.getSourceCategories({
      includeSystem: true,
      includeCustom: true  // 确保包含用户自定义分类
    });
    console.log('✅ 已加载分类:', this.allCategories);
    
    // 获取所有搜索源
    const allSources = await searchSourcesAPI.getSearchSources({
      includeSystem: true,
      enabledOnly: false
    });
    console.log('✅ 已加载搜索源:', allSources);
    
    // 获取用户配置
    const userConfigs = await searchSourcesAPI.getUserSourceConfigs();
    console.log('✅ 已加载用户配置:', userConfigs);
    
    // 🔴 修复：正确区分内置和自定义源
    this.builtinSearchSources = allSources.filter(s => s.isSystem === true);
    this.customSearchSources = allSources.filter(s => !s.isSystem);
    
    console.log(`📊 源分类: ${this.builtinSearchSources.length} 个内置, ${this.customSearchSources.length} 个自定义`);
    
    // 合并所有源,并标准化字段
    this.allSearchSources = allSources.map(source => {
      // 🔴 修复：确保 categoryId 字段存在
      if (!source.categoryId && source.category) {
        source.categoryId = source.category;
      }
      return source;
    });
    
    // 从用户配置中提取启用的源ID列表
    this.enabledSources = userConfigs
      .filter(config => config.isEnabled !== false)
      .map(config => config.sourceId);
    
    // 如果没有配置,使用所有系统源作为默认启用
    if (this.enabledSources.length === 0) {
      this.enabledSources = this.builtinSearchSources.map(s => s.id);
    }
    
    console.log(`✅ 已加载 ${this.majorCategories.length} 个大类,${this.allCategories.length} 个分类,${this.allSearchSources.length} 个搜索源 (${this.builtinSearchSources.length} 内置, ${this.customSearchSources.length} 自定义), ${this.enabledSources.length} 个已启用`);
    
  } catch (error) {
    console.warn('⚠️ 从API加载搜索源失败,使用最小数据集:', error);
    await this.loadMinimalDataSet();
  }
}

  async loadMinimalDataSet() {
    try {
      this.majorCategories = [
        {
          id: 'search_sources',
          name: '搜索资源',
          icon: '🔍',
          description: '参与番号搜索的资源站点',
          order: 1
        },
        {
          id: 'browse_sites',
          name: '浏览站点',
          icon: '🌐',
          description: '仅供浏览的资源站点',
          order: 2
        }
      ];

      this.allCategories = [
        {
          id: 'database',
          name: '📚 番号资料站',
          icon: '📚',
          description: '提供详细番号信息',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 1,
          isSystem: true
        },
        {
          id: 'torrent',
          name: '🧲 磁力搜索',
          icon: '🧲',
          description: '提供种子下载',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 3,
          isSystem: true
        }
      ];

      this.builtinSearchSources = [
        {
          id: 'javbus',
          name: 'JavBus',
          subtitle: '番号+磁力一体站,信息完善',
          icon: '🎬',
          categoryId: 'database',
          urlTemplate: 'https://www.javbus.com/search/{keyword}',
          searchable: true,
          siteType: 'search',
          searchPriority: 1,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true
        },
        {
          id: 'javdb',
          name: 'JavDB',
          subtitle: '极简风格番号资料站,轻量快速',
          icon: '📚',
          categoryId: 'database',
          urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
          searchable: true,
          siteType: 'search',
          searchPriority: 2,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true
        }
      ];

      this.customSearchSources = [];
      this.allSearchSources = [...this.builtinSearchSources];
      this.enabledSources = this.builtinSearchSources.map(s => s.id);
      
      console.log('🔧 已加载最小数据集');
      
    } catch (error) {
      console.error('❌ 加载最小数据集失败:', error);
      this.majorCategories = [];
      this.allCategories = [];
      this.builtinSearchSources = [];
      this.customSearchSources = [];
      this.allSearchSources = [];
      this.enabledSources = [];
    }
  }

  bindEvents() {
    const addCustomSourceBtn = document.getElementById('addCustomSourceBtn');
    if (addCustomSourceBtn) {
      addCustomSourceBtn.addEventListener('click', () => this.showSourceModal());
    }

    const sourcesFilter = document.getElementById('sourcesFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const majorCategoryFilter = document.getElementById('majorCategoryFilter');
    const sourcesSort = document.getElementById('sourcesSort');

    if (sourcesFilter) {
      sourcesFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (majorCategoryFilter) {
      majorCategoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (sourcesSort) {
      sourcesSort.addEventListener('change', () => this.filterAndSortSources());
    }

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

    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.displayOrder || a.order || 999) - (b.displayOrder || b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    categoryFilter.innerHTML = `
      <option value="all">全部分类</option>
      ${categoriesHTML}
    `;
  }

  updateMajorCategoryFilterOptions() {
    const majorCategoryFilter = document.getElementById('majorCategoryFilter');
    if (!majorCategoryFilter) return;

    const majorCategoriesHTML = this.majorCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(majorCategory => `
        <option value="${majorCategory.id}">${majorCategory.icon} ${majorCategory.name}</option>
      `).join('');

    majorCategoryFilter.innerHTML = `
      <option value="all">全部大类</option>
      ${majorCategoriesHTML}
    `;
  }

  renderSourcesList() {
    const sourcesList = document.getElementById('sourcesList');
    if (!sourcesList) return;

    const filter = document.getElementById('sourcesFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const majorCategoryFilter = document.getElementById('majorCategoryFilter')?.value || 'all';
    const sort = document.getElementById('sourcesSort')?.value || 'priority';

    let filteredSources = this.allSearchSources;

    if (filter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        switch (filter) {
          case 'enabled':
            return this.enabledSources.includes(source.id);
          case 'disabled':
            return !this.enabledSources.includes(source.id);
          case 'builtin':
            return source.isSystem;
          case 'custom':
            return !source.isSystem;
          case 'searchable':
            return source.searchable !== false;
          case 'browse_only':
            return source.searchable === false;
          default:
            return true;
        }
      });
    }

    if (majorCategoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        const categoryId = source.categoryId || source.category;
        const category = this.getCategoryById(categoryId);
        const majorCategoryId = category?.majorCategoryId || category?.majorCategory;
        return majorCategoryId === majorCategoryFilter;
      });
    }

    if (categoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        const sourceCategoryId = source.categoryId || source.category;
        return sourceCategoryId === categoryFilter;
      });
    }

    this.sortSources(filteredSources, sort);

    if (filteredSources.length === 0) {
      sourcesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的搜索源</p>
          <button class="btn-primary" onclick="app.getManager('sources').showSourceModal()">添加自定义搜索源</button>
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
          const catA = this.getCategoryById(a.categoryId || a.category)?.name || 'Unknown';
          const catB = this.getCategoryById(b.categoryId || b.category)?.name || 'Unknown';
          return catA.localeCompare(catB);
        case 'status':
          const statusA = this.enabledSources.includes(a.id) ? 0 : 1;
          const statusB = this.enabledSources.includes(b.id) ? 0 : 1;
          return statusA - statusB;
        case 'site_type':
          const siteTypeA = a.siteType || 'search';
          const siteTypeB = b.siteType || 'search';
          return siteTypeA.localeCompare(siteTypeB);
        case 'searchable':
          const searchableA = a.searchable !== false ? 0 : 1;
          const searchableB = b.searchable !== false ? 0 : 1;
          return searchableA - searchableB;
        case 'major_category':
          const majorCatA = this.getMajorCategoryForSource(a.id) || 'zzz';
          const majorCatB = this.getMajorCategoryForSource(b.id) || 'zzz';
          return majorCatA.localeCompare(majorCatB);
        case 'priority':
        default:
          if (a.isSystem && !b.isSystem) return -1;
          if (!a.isSystem && b.isSystem) return 1;
          return (a.searchPriority || a.priority || 999) - (b.searchPriority || b.priority || 999);
      }
    });
  }

  // 🔄 修复:正确渲染源项目,内置源只显示编辑按钮
  renderSourceItem(source) {
    // 🔴 兼容 categoryId 和 category 字段
    const categoryId = source.categoryId || source.category;
    const category = this.getCategoryById(categoryId);
    const majorCategory = this.getMajorCategoryForSource(source.id);
    const isEnabled = this.enabledSources.includes(source.id);
    
    // 🆕 检查是否为搜索资源大类
    const isSearchSourceCategory = majorCategory === 'search_sources';
    
    const siteTypeLabel = {
      'search': '搜索源',
      'browse': '浏览站',
      'reference': '参考站'
    }[source.siteType || 'search'];
    
    const searchableIcon = source.searchable === false ? '🚫' : '🔍';
    const searchableTitle = source.searchable === false ? '不参与搜索' : '参与搜索';
    
    const majorCategoryInfo = this.majorCategories.find(mc => mc.id === majorCategory);
    const majorCategoryLabel = majorCategoryInfo ? `${majorCategoryInfo.icon} ${majorCategoryInfo.name}` : '未知大类';
    
    // 🔄 正确判断是否为内置源
    const isBuiltinSource = source.isSystem === true;
    
    return `
      <div class="source-item ${isEnabled ? 'enabled' : 'disabled'}" data-source-id="${source.id}">
        <div class="source-header">
          ${isSearchSourceCategory ? `
            <div class="source-toggle">
              <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                     onchange="app.getManager('sources').toggleSourceEnabled('${source.id}', this.checked)">
            </div>
          ` : `
            <div class="source-toggle disabled-toggle">
              <span class="toggle-placeholder" title="该类型源不参与搜索启用控制">—</span>
            </div>
          `}
          <div class="source-info">
            <div class="source-name">
              <span class="source-icon">${source.icon || '🔗'}</span>
              <span class="source-title">${escapeHtml(source.name)}</span>
              ${isBuiltinSource ? '<span class="builtin-badge">内置</span>' : '<span class="custom-badge">自定义</span>'}
              ${!isSearchSourceCategory ? '<span class="non-search-badge">仅浏览</span>' : ''}
            </div>
            <div class="source-subtitle">${escapeHtml(source.subtitle || '')}</div>
            <div class="source-meta">
              <div class="source-major-category">
                <span>大类: ${majorCategoryLabel}</span>
              </div>
              <div class="source-category">
                <span>小类: ${category ? `${category.icon} ${category.name}` : '未知分类'}</span>
              </div>
              <div class="source-url">${escapeHtml(source.urlTemplate)}</div>
            </div>
            <div class="source-badges">
              <span class="searchable-badge" title="${searchableTitle}">
                ${searchableIcon}
              </span>
              <span class="site-type-badge">${siteTypeLabel}</span>
              ${source.searchPriority ? `<span class="priority-badge">优先级: ${source.searchPriority}</span>` : ''}
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
          <!-- 🔄 内置源只显示编辑按钮，不显示删除按钮 -->
          <button class="action-btn edit-btn" onclick="app.getManager('sources').editSource('${source.id}')" title="编辑">
            编辑
          </button>
          ${!isBuiltinSource ? `
            <button class="action-btn delete-btn" onclick="app.getManager('sources').deleteCustomSource('${source.id}')" title="删除">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  bindSourceItemEvents() {
    // 这里可以绑定额外的事件
  }

  filterAndSortSources() {
    this.renderSourcesList();
  }

  async toggleSourceEnabled(sourceId, enabled) {
    // 🆕 检查源是否属于搜索资源大类
    const majorCategory = this.getMajorCategoryForSource(sourceId);
    if (majorCategory !== 'search_sources') {
      showToast('该搜索源不属于搜索资源类别，无法启用/禁用', 'warning');
      return;
    }

    try {
      if (enabled) {
        if (!this.enabledSources.includes(sourceId)) {
          this.enabledSources.push(sourceId);
        }
      } else {
        this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      }

      await searchSourcesAPI.updateUserSourceConfig({
        sourceId: sourceId,
        isEnabled: enabled
      });
      
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
      // 🆕 只启用搜索资源大类的源
      const searchSources = this.allSearchSources.filter(source => {
        const majorCategory = this.getMajorCategoryForSource(source.id);
        return majorCategory === 'search_sources';
      });
      
      this.enabledSources = searchSources.map(s => s.id);
      await searchSourcesAPI.enableAllSources();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已启用所有搜索资源', 'success');
    } catch (error) {
      console.error('启用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async disableAllSources() {
    if (!confirm('确定要禁用所有搜索资源吗?这将影响搜索功能。')) return;
    
    try {
      // 🆕 只禁用搜索资源大类的源
      const searchSources = this.allSearchSources.filter(source => {
        const majorCategory = this.getMajorCategoryForSource(source.id);
        return majorCategory === 'search_sources';
      });
      
      const searchSourceIds = searchSources.map(s => s.id);
      this.enabledSources = this.enabledSources.filter(id => !searchSourceIds.includes(id));
      
      await searchSourcesAPI.disableAllSources();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已禁用所有搜索资源', 'success');
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (!confirm('确定要重置为默认搜索源配置吗?')) return;
    
    try {
      await searchSourcesAPI.resetToDefaults();
      await this.loadUserSearchSettings();
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
      let testUrl;
      if (source.searchable !== false) {
        testUrl = source.urlTemplate.replace('{keyword}', 'test');
      } else {
        testUrl = source.urlTemplate;
      }
      
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
      let baseUrl;
      if (source.searchable === false) {
        baseUrl = source.urlTemplate;
      } else {
        const urlObj = new URL(source.urlTemplate.replace('{keyword}', ''));
        baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      }
      
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('访问搜索源失败:', error);
      showToast('访问失败: ' + error.message, 'error');
    }
  }

  // 🔄 修改为通用的编辑方法，同时支持内置和自定义搜索源
  editSource(sourceId) {
    const source = this.allSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }
    
    this.showSourceModal(source);
  }

  // 🔄 修改方法名为通用的显示搜索源模态框
  showSourceModal(source = null) {
    this.editingSource = source;
    
    let modal = document.getElementById('sourceModal'); // 🔄 改为通用的ID
    if (!modal) {
      modal = this.createSourceModal();
      document.body.appendChild(modal);
    }
    
    this.populateSourceForm(modal, source);
    modal.style.display = 'block';
    
    setTimeout(() => {
      const nameInput = modal.querySelector('#sourceName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  // 🔄 修改方法名为通用的创建搜索源模态框
  createSourceModal() {
    const modal = document.createElement('div');
    modal.id = 'sourceModal'; // 🔄 改为通用的ID
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>搜索源管理</h2>
        <form id="sourceForm">
          <input type="hidden" name="sourceId">
          
          <div class="form-row">
            <div class="form-group">
              <label for="sourceName">搜索源名称 *</label>
              <input type="text" name="sourceName" id="sourceName" required maxlength="50" 
                     placeholder="例如:我的搜索站">
            </div>
            
            <div class="form-group">
              <label for="sourceIcon">图标</label>
              <input type="text" name="sourceIcon" id="sourceIcon" maxlength="5" 
                     placeholder="🔗" value="🔗">
            </div>
          </div>
          
          <div class="form-group">
            <label for="sourceSubtitle">描述信息</label>
            <input type="text" name="sourceSubtitle" id="sourceSubtitle" maxlength="100" 
                   placeholder="例如:专业的搜索引擎">
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
              <span id="urlHelpText">URL中必须包含 <code>{keyword}</code> 占位符,搜索时会被替换为实际关键词</span>
            </small>
          </div>
          
          <fieldset class="site-config-section">
            <legend>网站类型配置</legend>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="searchable" id="searchable" checked>
                参与番号搜索
              </label>
              <small>取消勾选后,搜索时不会显示该网站</small>
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
            <button type="submit" class="btn-primary">保存搜索源</button>
          </div>
        </form>
      </div>
    `;
    
    const form = modal.querySelector('#sourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSourceSubmit(e));
      
      const searchableCheckbox = form.querySelector('#searchable');
      const urlInput = form.querySelector('#sourceUrl');
      const urlHelpText = form.querySelector('#urlHelpText');
      
      if (searchableCheckbox && urlHelpText) {
        searchableCheckbox.addEventListener('change', () => {
          if (searchableCheckbox.checked) {
            urlHelpText.innerHTML = 'URL中必须包含 <code>{keyword}</code> 占位符,搜索时会被替换为实际关键词';
            urlInput.placeholder = 'https://example.com/search?q={keyword}';
          } else {
            urlHelpText.innerHTML = '浏览站点只需提供基础访问URL,无需包含搜索参数';
            urlInput.placeholder = 'https://example.com';
          }
        });
      }
    }
    
    return modal;
  }

// 🔄 修复 populateSourceForm 方法中的分类显示问题
populateSourceForm(modal, source) {
  const form = modal.querySelector('#sourceForm');
  if (!form) return;

  // 首先更新分类选择框
  this.updateSourceCategorySelect(form.sourceCategory);

  if (source) {
    // 编辑模式
    form.sourceId.value = source.id;
    form.sourceName.value = source.name;
    form.sourceSubtitle.value = source.subtitle || '';
    form.sourceIcon.value = source.icon || '🔗';
    form.sourceUrl.value = source.urlTemplate;
    
    // 🔴 修复：确保分类值正确设置
    const sourceCategoryId = source.categoryId || source.category;
    
    // 检查分类是否存在于当前分类列表中
    const categoryExists = this.allCategories.some(cat => cat.id === sourceCategoryId);
    
    if (categoryExists) {
      form.sourceCategory.value = sourceCategoryId;
    } else {
      // 如果分类不存在，添加一个临时选项保持原始值
      const tempOption = document.createElement('option');
      tempOption.value = sourceCategoryId;
      tempOption.textContent = `🔗 ${sourceCategoryId} (原分类)`;
      tempOption.style.color = '#888';
      form.sourceCategory.appendChild(tempOption);
      form.sourceCategory.value = sourceCategoryId;
      
      console.warn(`分类 ${sourceCategoryId} 不存在于当前分类列表中，已添加临时选项`);
    }
    
    form.searchable.checked = source.searchable !== false;
    form.siteType.value = source.siteType || 'search';
    form.searchPriority.value = source.searchPriority || 5;
    form.requiresKeyword.checked = source.requiresKeyword !== false;
    
    // 🔄 根据搜索源类型显示不同标题
    const isBuiltin = source.isSystem === true;
    modal.querySelector('h2').textContent = isBuiltin ? '编辑内置搜索源' : '编辑自定义搜索源';
    modal.querySelector('[type="submit"]').textContent = '保存修改';
  } else {
    // 新增模式
    form.reset();
    form.sourceIcon.value = '🔗';
    form.sourceCategory.value = 'others';
    form.searchable.checked = true;
    form.siteType.value = 'search';
    form.searchPriority.value = 5;
    form.requiresKeyword.checked = true;
    modal.querySelector('h2').textContent = '添加自定义搜索源';
    modal.querySelector('[type="submit"]').textContent = '添加搜索源';
    
    // 只在新增模式下添加分类变更监听器
    const categorySelect = form.sourceCategory;
    // 移除之前的监听器（如果存在）
    const newCategorySelect = categorySelect.cloneNode(true);
    categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);
    
    newCategorySelect.addEventListener('change', (e) => {
      const category = this.getCategoryById(e.target.value);
      if (category) {
        form.searchable.checked = category.defaultSearchable !== false;
        form.siteType.value = category.defaultSiteType || 'search';
        form.searchPriority.value = category.searchPriority || 5;
        form.searchable.dispatchEvent(new Event('change'));
      }
    });
  }
  
  if (form.searchable) {
    form.searchable.dispatchEvent(new Event('change'));
  }
}

// 🔴 增强 updateSourceCategorySelect 方法，支持保持原有分类
updateSourceCategorySelect(selectElement, preserveCurrentValue = false) {
  if (!selectElement) return;

  const currentValue = preserveCurrentValue ? selectElement.value : null;

  const categoriesHTML = this.allCategories
    .sort((a, b) => (a.displayOrder || a.order || 999) - (b.displayOrder || b.order || 999))
    .map(category => `
      <option value="${category.id}">${category.icon} ${category.name}</option>
    `).join('');

  selectElement.innerHTML = categoriesHTML;

  // 如果需要保持原有值且该值不在新选项中，添加临时选项
  if (preserveCurrentValue && currentValue) {
    const valueExists = this.allCategories.some(cat => cat.id === currentValue);
    if (!valueExists) {
      const tempOption = document.createElement('option');
      tempOption.value = currentValue;
      tempOption.textContent = `🔗 ${currentValue} (原分类)`;
      tempOption.style.color = '#888';
      selectElement.appendChild(tempOption);
    }
    selectElement.value = currentValue;
  }
}

  // 🔄 修改方法名为通用的表单提交处理
  async handleSourceSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const sourceData = {
      id: formData.get('sourceId') || null,
      name: formData.get('sourceName').trim(),
      subtitle: formData.get('sourceSubtitle').trim(),
      icon: formData.get('sourceIcon').trim() || '🔗',
      urlTemplate: formData.get('sourceUrl').trim(),
      categoryId: formData.get('sourceCategory'),  // 🔴 使用 categoryId
      searchable: formData.get('searchable') === 'on',
      siteType: formData.get('siteType') || 'search',
      searchPriority: parseInt(formData.get('searchPriority')) || 5,
      requiresKeyword: formData.get('requiresKeyword') === 'on'
    };
    
    const validation = this.validateSource(sourceData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingSource && sourceData.id) {
        await searchSourcesAPI.updateSearchSource(sourceData.id, sourceData);
        showToast('搜索源更新成功', 'success');
      } else {
        await searchSourcesAPI.createSearchSource(sourceData);
        showToast('自定义搜索源添加成功', 'success');
      }
      
      await this.loadUserSearchSettings();
      await this.loadTabData();
      this.app.closeModals();
      
    } catch (error) {
      console.error('保存搜索源失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🔄 修改方法名为通用的搜索源验证
  validateSource(sourceData) {
    const rules = APP_CONSTANTS.VALIDATION_RULES.SOURCE;
    
    const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
    
    for (const field of requiredFieldsForValidation) {
      const value = sourceData[field] || sourceData[field.replace('Template', '')];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(sourceData.name)) {
      return { valid: false, message: '搜索源名称格式不正确' };
    }
    
    if (!validateSourceUrl(sourceData.urlTemplate, sourceData.searchable)) {
      if (sourceData.searchable) {
        return { valid: false, message: '搜索源URL必须包含{keyword}占位符' };
      } else {
        return { valid: false, message: 'URL格式无效' };
      }
    }
    
    try {
      const testUrl = sourceData.searchable ? 
        sourceData.urlTemplate.replace('{keyword}', 'test') : 
        sourceData.urlTemplate;
      const hostname = new URL(testUrl).hostname;
      
      if (rules.FORBIDDEN_DOMAINS.some(domain => hostname.includes(domain))) {
        return { valid: false, message: '不允许使用该域名' };
      }
    } catch (error) {
      return { valid: false, message: 'URL格式无效' };
    }
    
    const categoryId = sourceData.categoryId || sourceData.category;
    if (!this.getCategoryById(categoryId)) {
      return { valid: false, message: '选择的分类不存在' };
    }
    
    return { valid: true };
  }

  // 🔄 保留原有的自定义搜索源删除功能
  async deleteCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义搜索源"${source.name}"吗?此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      await searchSourcesAPI.deleteSearchSource(sourceId);
      
      this.customSearchSources = this.customSearchSources.filter(s => s.id !== sourceId);
      this.allSearchSources = this.allSearchSources.filter(s => s.id !== sourceId);
      this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      
      await this.loadTabData();
      showToast('自定义搜索源删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
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
    if (elements.categoriesCount) elements.categoriesCount.textContent = this.allCategories.length;
  }

  async exportSources() {
    try {
      const exportData = await searchSourcesAPI.exportUserSearchSources();
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
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
    this.editingSource = null;
  }

  // 🔴 修复:获取源的大类,支持字段兼容
  getMajorCategoryForSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) return null;
    
    const categoryId = source.categoryId || source.category;
    const category = this.getCategoryById(categoryId);
    return category ? (category.majorCategoryId || category.majorCategory) : null;
  }

  // 🆕 新增:获取指定大类下的所有源
  getSourcesByMajorCategory(majorCategoryId) {
    return this.allSearchSources.filter(source => {
      const categoryId = source.categoryId || source.category;
      const category = this.getCategoryById(categoryId);
      const sourceMajorCategoryId = category?.majorCategoryId || category?.majorCategory;
      return sourceMajorCategoryId === majorCategoryId;
    });
  }

  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
  }

  getCustomCategories() {
    return this.allCategories.filter(category => !category.isSystem);
  }

  getTotalSourcesCount() {
    return this.allSearchSources.length;
  }

  getEnabledSourcesCount() {
    return this.enabledSources.length;
  }

  getAllSearchSources() {
    return this.allSearchSources;
  }

  getMajorCategories() {
    return this.majorCategories;
  }

  getAllCategories() {
    return this.allCategories;
  }
}

export default SourcesManager;