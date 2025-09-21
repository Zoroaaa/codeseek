// 搜索源管理器 - 完全集成新的搜索源管理API
import { APP_CONSTANTS, validateSourceUrl } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
// 🔴 导入新的搜索源管理API
import searchSourcesAPI from '../../services/search-sources-api.js';

export class SourcesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinSearchSources = [];
    this.customSearchSources = [];
    this.allSearchSources = [];
    this.enabledSources = [];
    this.editingCustomSource = null;
    
    // 🆕 添加大类和分类数据
    this.majorCategories = [];
    this.allCategories = [];
  }

  async init() {
    console.log('🔧 初始化搜索源管理器');
    // 🔴 移除loadBuiltinData调用，完全从API获取
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

  // 🆕 完全使用新API加载用户搜索源设置
  async loadUserSearchSettings() {
    if (!this.app.getCurrentUser()) {
      // 未登录时加载最小数据集
      await this.loadMinimalDataSet();
      return;
    }
    
    try {
      console.log('🔡 从新API加载搜索源数据...');
      
      // 🔴 获取大类数据
      this.majorCategories = await searchSourcesAPI.getMajorCategories();
      
      // 🔴 获取所有分类
      this.allCategories = await searchSourcesAPI.getSourceCategories({
        includeSystem: true
      });
      
      // 🔴 获取所有搜索源
      const allSources = await searchSourcesAPI.getSearchSources({
        includeSystem: true,
        enabledOnly: false
      });
      
      // 🔴 获取用户配置
      const userConfigs = await searchSourcesAPI.getUserSourceConfigs();
      
      // 分离内置和自定义源
      this.builtinSearchSources = allSources.filter(s => s.isSystem || s.isBuiltin);
      this.customSearchSources = allSources.filter(s => s.isCustom || !s.isSystem);
      
      // 合并所有源
      this.allSearchSources = allSources;
      
      // 🔴 从用户配置中提取启用的源ID列表
      this.enabledSources = userConfigs
        .filter(config => config.isEnabled !== false)
        .map(config => config.sourceId);
      
      // 如果没有配置,使用所有系统源作为默认启用
      if (this.enabledSources.length === 0) {
        this.enabledSources = this.builtinSearchSources.map(s => s.id);
      }
      
      console.log(`✅ 已加载 ${this.majorCategories.length} 个大类，${this.allCategories.length} 个分类，${this.allSearchSources.length} 个搜索源 (${this.builtinSearchSources.length} 内置, ${this.customSearchSources.length} 自定义), ${this.enabledSources.length} 个已启用`);
      
    } catch (error) {
      console.warn('⚠️ 从API加载搜索源失败,使用最小数据集:', error);
      await this.loadMinimalDataSet();
    }
  }

  // 🆕 加载最小数据集（API不可用时的回退方案）
  async loadMinimalDataSet() {
    try {
      // 创建最基本的大类
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

      // 创建最基本的分类
      this.allCategories = [
        {
          id: 'torrents',
          name: '种子资源',
          icon: '🧲',
          description: '提供种子下载的站点',
          majorCategory: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 1,
          isSystem: true,
          isBuiltin: true
        },
        {
          id: 'info_sites',
          name: '信息站点',
          icon: '📚',
          description: '提供影片信息的站点',
          majorCategory: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 2,
          isSystem: true,
          isBuiltin: true
        }
      ];

      // 创建最基本的搜索源
      this.builtinSearchSources = [
        {
          id: 'javbus',
          name: 'JavBus',
          subtitle: '番号+磁力一体站，信息完善',
          icon: '🎬',
          category: 'info_sites',
          urlTemplate: 'https://www.javbus.com/search/{keyword}',
          searchable: true,
          siteType: 'search',
          searchPriority: 1,
          requiresKeyword: true,
          isSystem: true,
          isBuiltin: true
        },
        {
          id: 'javdb',
          name: 'JavDB',
          subtitle: '极简风格番号资料站，轻量快速',
          icon: '📚',
          category: 'info_sites',
          urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
          searchable: true,
          siteType: 'search',
          searchPriority: 2,
          requiresKeyword: true,
          isSystem: true,
          isBuiltin: true
        }
      ];

      this.customSearchSources = [];
      this.allSearchSources = [...this.builtinSearchSources];
      this.enabledSources = this.builtinSearchSources.map(s => s.id);
      
      console.log('🔧 已加载最小数据集');
      
    } catch (error) {
      console.error('❌ 加载最小数据集失败:', error);
      // 设置为空数组，防止应用崩溃
      this.majorCategories = [];
      this.allCategories = [];
      this.builtinSearchSources = [];
      this.customSearchSources = [];
      this.allSearchSources = [];
      this.enabledSources = [];
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

  // 🔴 修改更新分类筛选选项 - 使用动态数据
  updateCategoryFilterOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    // 🔴 使用从API获取的分类数据
    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    categoryFilter.innerHTML = `
      <option value="all">全部分类</option>
      ${categoriesHTML}
    `;
  }

  // 🔴 修改更新大分类筛选选项 - 使用动态数据
  updateMajorCategoryFilterOptions() {
    const majorCategoryFilter = document.getElementById('majorCategoryFilter');
    if (!majorCategoryFilter) return;

    // 🔴 使用从API获取的大类数据
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

    // 获取当前筛选和排序设置
    const filter = document.getElementById('sourcesFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const majorCategoryFilter = document.getElementById('majorCategoryFilter')?.value || 'all';
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
            return source.isBuiltin || source.isSystem;
          case 'custom':
            return source.isCustom;
          case 'searchable':
            return source.searchable !== false;
          case 'browse_only':
            return source.searchable === false;
          case 'supports_detail':
            return this.supportsDetailExtraction(source.id);
          default:
            return true;
        }
      });
    }

    // 大类筛选
    if (majorCategoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        const category = this.getCategoryById(source.category);
        return category && category.majorCategory === majorCategoryFilter;
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
          if ((a.isBuiltin || a.isSystem) && !(b.isBuiltin || b.isSystem)) return -1;
          if (!(a.isBuiltin || a.isSystem) && (b.isBuiltin || b.isSystem)) return 1;
          return (a.searchPriority || a.priority || 999) - (b.searchPriority || b.priority || 999);
      }
    });
  }

  // 🔴 修改渲染源项目 - 使用动态数据
  renderSourceItem(source) {
    const category = this.getCategoryById(source.category);
    const majorCategory = this.getMajorCategoryForSource(source.id);
    const isEnabled = this.enabledSources.includes(source.id);
    const supportsDetailExtraction = this.supportsDetailExtraction(source.id);
    
    const siteTypeLabel = {
      'search': '搜索源',
      'browse': '浏览站',
      'reference': '参考站'
    }[source.siteType || 'search'];
    
    const searchableIcon = source.searchable === false ? '🚫' : '🔍';
    const searchableTitle = source.searchable === false ? '不参与搜索' : '参与搜索';
    
    // 🔴 使用动态获取的大类信息
    const majorCategoryInfo = this.majorCategories.find(mc => mc.id === majorCategory);
    const majorCategoryLabel = majorCategoryInfo ? `${majorCategoryInfo.icon} ${majorCategoryInfo.name}` : '未知大类';
    
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
              <div class="source-major-category">
                <span>大类:${majorCategoryLabel}</span>
              </div>
              <div class="source-category">
                <span>小类:${category ? `${category.icon} ${category.name}` : '未知分类'}</span>
              </div>
              <div class="source-url">${escapeHtml(source.urlTemplate)}</div>
            </div>
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
    // 这里可以绑定额外的事件,目前使用onclick处理
  }

  filterAndSortSources() {
    this.renderSourcesList();
  }

  // 🔴 使用新API切换源启用状态
  async toggleSourceEnabled(sourceId, enabled) {
    try {
      if (enabled) {
        if (!this.enabledSources.includes(sourceId)) {
          this.enabledSources.push(sourceId);
        }
      } else {
        this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      }

      // 🔴 使用新API更新用户配置
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

  // 🔴 使用新API启用所有源
  async enableAllSources() {
    try {
      this.enabledSources = this.allSearchSources.map(s => s.id);
      
      // 🔴 批量更新用户配置
      await searchSourcesAPI.enableAllSources();
      
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已启用所有搜索源', 'success');
    } catch (error) {
      console.error('启用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 🔴 使用新API禁用所有源
  async disableAllSources() {
    if (!confirm('确定要禁用所有搜索源吗?这将影响搜索功能。')) return;
    
    try {
      this.enabledSources = [];
      
      // 🔴 批量更新用户配置
      await searchSourcesAPI.disableAllSources();
      
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已禁用所有搜索源', 'success');
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  // 🔴 使用新API重置为默认配置
  async resetToDefaults() {
    if (!confirm('确定要重置为默认搜索源配置吗?')) return;
    
    try {
      // 🔴 使用新API重置
      await searchSourcesAPI.resetToDefaults();
      
      // 重新加载数据
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
                     placeholder="例如:我的搜索站">
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
            <button type="submit" class="btn-primary">添加搜索源</button>
          </div>
        </form>
      </div>
    `;
    
    const form = modal.querySelector('#customSourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomSourceSubmit(e));
      
      // 监听搜索类型变化,动态调整URL验证提示
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

  populateCustomSourceForm(modal, source) {
    const form = modal.querySelector('#customSourceForm');
    if (!form) return;

    if (source) {
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
      form.reset();
      form.sourceIcon.value = '🔍';
      form.sourceCategory.value = 'others';
      form.searchable.checked = true;
      form.siteType.value = 'search';
      form.searchPriority.value = 5;
      form.requiresKeyword.checked = true;
      modal.querySelector('h2').textContent = '添加自定义搜索源';
      modal.querySelector('[type="submit"]').textContent = '添加搜索源';
      
      // 根据分类的默认配置自动设置
      const categorySelect = form.sourceCategory;
      categorySelect.addEventListener('change', (e) => {
        const category = this.getCategoryById(e.target.value);
        if (category) {
          form.searchable.checked = category.defaultSearchable !== false;
          form.siteType.value = category.defaultSiteType || 'search';
          form.searchPriority.value = category.searchPriority || 5;
          form.searchable.dispatchEvent(new Event('change'));
        }
      });
    }
    
    this.updateSourceCategorySelect(form.sourceCategory);
    
    if (form.searchable) {
      form.searchable.dispatchEvent(new Event('change'));
    }
  }

  // 🔴 修改更新源分类选择器 - 使用动态数据
  updateSourceCategorySelect(selectElement) {
    if (!selectElement) return;

    // 🔴 使用从API获取的分类数据
    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    selectElement.innerHTML = categoriesHTML;
  }

  // 🔴 使用新API保存自定义搜索源
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
      categoryId: formData.get('sourceCategory'), // 🔴 新API需要
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
        // 🔴 使用新API更新
        await searchSourcesAPI.updateSearchSource(sourceData.id, sourceData);
        showToast('自定义搜索源更新成功', 'success');
      } else {
        // 🔴 使用新API创建
        await searchSourcesAPI.createSearchSource(sourceData);
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
      const value = sourceData[field] || sourceData[field.replace('Template', '')];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(sourceData.name)) {
      return { valid: false, message: '搜索源名称格式不正确' };
    }
    
    // 使用新的URL验证逻辑
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

  editCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    this.showCustomSourceModal(source);
  }

  // 🔴 使用新API删除自定义搜索源
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
      
      // 🔴 使用新API删除
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

  // 🔴 使用新API导出搜索源
  async exportSources() {
    try {
      // 🔴 使用新API导出
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
    this.editingCustomSource = null;
  }

  supportsDetailExtraction(sourceId) {
    const detailSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [];
    return detailSources.includes(sourceId);
  }

  // 🔴 修改获取源的大分类方法
  getMajorCategoryForSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) return null;
    
    const category = this.getCategoryById(source.category);
    return category ? category.majorCategory : null;
  }

  // 辅助方法
  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  // 🔴 修改获取分类方法
  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
  }

  // 🔴 修改获取自定义分类方法
  getCustomCategories() {
    return this.allCategories.filter(category => category.isCustom);
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

  getMajorCategories() {
    return this.majorCategories;
  }

  getAllCategories() {
    return this.allCategories;
  }
}

export default SourcesManager;