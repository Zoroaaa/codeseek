// 分类管理器 - 修复版本:解决分类显示和大类关联问题
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import searchSourcesAPI from '../../services/search-sources-api.js';

export class CategoriesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinCategories = [];
    this.customCategories = [];
    this.allCategories = [];
    this.editingCustomCategory = null;
    this.majorCategories = [];
  }

  async init() {
    console.log('🏷️ 初始化分类管理器');
    this.bindEvents();
  }

  async loadData() {
    await this.loadUserCategorySettings();
  }

  async loadTabData() {
    try {
      await this.loadUserCategorySettings();
      this.renderBuiltinCategories();
      this.renderCustomCategories();
      this.updateCategoriesStats();
    } catch (error) {
      console.error('加载分类数据失败:', error);
      showToast('加载分类数据失败', 'error');
    }
  }

  async loadUserCategorySettings() {
    if (!this.app.getCurrentUser()) {
      await this.loadMinimalDataSet();
      return;
    }
    
    try {
      console.log('📡 从新API加载分类数据...');
      
      // 获取大类数据
      this.majorCategories = await searchSourcesAPI.getMajorCategories();
      console.log('✅ 已加载大类:', this.majorCategories);
      
      // 获取所有分类
      const allCategories = await searchSourcesAPI.getSourceCategories({
        includeSystem: true
      });
      console.log('✅ 已加载分类:', allCategories);
      
      // 🔴 修复:正确区分内置和自定义分类
      this.builtinCategories = allCategories.filter(c => c.isSystem === true);
      this.customCategories = allCategories.filter(c => !c.isSystem);
      this.allCategories = allCategories;
      
      console.log(`✅ 已加载 ${this.majorCategories.length} 个大类,${this.allCategories.length} 个分类 (${this.builtinCategories.length} 内置, ${this.customCategories.length} 自定义)`);
      
    } catch (error) {
      console.warn('⚠️ 从API加载分类失败,使用最小数据集:', error);
      await this.loadMinimalDataSet();
    }
  }

  async loadMinimalDataSet() {
    try {
      this.majorCategories = [
        {
          id: 'search_sources',
          name: '🔍 搜索源',
          icon: '🔍',
          description: '支持番号搜索的网站',
          order: 1
        },
        {
          id: 'browse_sites',
          name: '🌐 浏览站点',
          icon: '🌐',
          description: '仅供访问,不参与搜索',
          order: 2
        }
      ];

      this.builtinCategories = [
        {
          id: 'database',
          name: '📚 番号资料站',
          icon: '📚',
          description: '提供详细的番号信息、封面和演员资料',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 1,
          isSystem: true
        },
        {
          id: 'streaming',
          name: '🎥 在线播放平台',
          icon: '🎥',
          description: '提供在线观看和下载服务',
          majorCategoryId: 'browse_sites',
          defaultSearchable: false,
          defaultSiteType: 'browse',
          searchPriority: 5,
          isSystem: true
        },
        {
          id: 'torrent',
          name: '🧲 磁力搜索',
          icon: '🧲',
          description: '提供磁力链接和种子文件',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 3,
          isSystem: true
        }
      ];

      this.customCategories = [];
      this.allCategories = [...this.builtinCategories];
      
      console.log('🔧 已加载最小分类数据集');
      
    } catch (error) {
      console.error('❌ 加载最小分类数据集失败:', error);
      this.majorCategories = [];
      this.builtinCategories = [];
      this.customCategories = [];
      this.allCategories = [];
    }
  }

  bindEvents() {
    const addCustomCategoryBtn = document.getElementById('addCustomCategoryBtn');
    if (addCustomCategoryBtn) {
      addCustomCategoryBtn.addEventListener('click', () => this.showCustomCategoryModal());
    }
  }

  // 🔴 修复:正确渲染内置分类,按大类分组
  renderBuiltinCategories() {
    const builtinCategoriesList = document.getElementById('builtinCategoriesList');
    if (!builtinCategoriesList) return;

    console.log('🎨 渲染内置分类:', this.builtinCategories);

    if (this.builtinCategories.length === 0) {
      builtinCategoriesList.innerHTML = '<p class="empty-state">没有内置分类</p>';
      return;
    }

    // 按大类分组
    const categoriesByMajor = this.groupCategoriesByMajorCategory(this.builtinCategories);
    console.log('📊 按大类分组:', categoriesByMajor);
    
    let html = '';
    
    // 遍历所有大类
    this.majorCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .forEach(majorCategory => {
        const categories = categoriesByMajor[majorCategory.id] || [];
        
        console.log(`📁 大类 ${majorCategory.id} (${majorCategory.name}) 包含 ${categories.length} 个分类`);
        
        if (categories.length === 0) return;
        
        html += `
          <div class="major-category-group">
            <h4 class="major-category-header">
              ${majorCategory.icon} ${majorCategory.name}
              <span class="category-count">(${categories.length}个)</span>
            </h4>
            <div class="categories-grid">
              ${categories.map(category => this.renderCategoryItem(category)).join('')}
            </div>
          </div>
        `;
      });

    if (html) {
      builtinCategoriesList.innerHTML = html;
    } else {
      builtinCategoriesList.innerHTML = '<p class="empty-state">没有可显示的内置分类</p>';
    }
  }

  renderCustomCategories() {
    const customCategoriesList = document.getElementById('customCategoriesList');
    if (!customCategoriesList) return;

    if (this.customCategories.length === 0) {
      customCategoriesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🎨</span>
          <p>暂无自定义分类</p>
          <button class="btn-primary" onclick="app.getManager('categories').showCustomCategoryModal()">添加自定义分类</button>
        </div>
      `;
      return;
    }

    customCategoriesList.innerHTML = `
      <div class="categories-grid">
        ${this.customCategories.map(category => this.renderCategoryItem(category)).join('')}
      </div>
    `;
  }

  groupCategoriesByMajorCategory(categories) {
    const grouped = {};
    
    categories.forEach(category => {
      // 🔴 修复:同时支持 majorCategory 和 majorCategoryId 字段
      const majorCategoryId = category.majorCategoryId || category.majorCategory || 'others';
      if (!grouped[majorCategoryId]) {
        grouped[majorCategoryId] = [];
      }
      grouped[majorCategoryId].push(category);
    });
    
    // 对每个组内的分类按order排序
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.displayOrder || a.order || 999) - (b.displayOrder || b.order || 999));
    });
    
    return grouped;
  }

  // 🔴 修复:正确渲染分类项目
  renderCategoryItem(category) {
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const enabledSources = sourcesManager ? sourcesManager.enabledSources : [];
    
    // 🔴 修复:支持 categoryId 字段匹配
    const sourceCount = allSources.filter(s => {
      const sourceCategoryId = s.categoryId || s.category;
      return sourceCategoryId === category.id;
    }).length;
    
    const enabledSourceCount = allSources.filter(s => {
      const sourceCategoryId = s.categoryId || s.category;
      return sourceCategoryId === category.id && enabledSources.includes(s.id);
    }).length;
    
    const searchableSources = allSources.filter(s => {
      const sourceCategoryId = s.categoryId || s.category;
      return sourceCategoryId === category.id && s.searchable !== false;
    }).length;
    
    const browseSources = allSources.filter(s => {
      const sourceCategoryId = s.categoryId || s.category;
      return sourceCategoryId === category.id && s.searchable === false;
    }).length;
    
    // 🔴 修复:同时支持两种字段名
    const majorCategoryId = category.majorCategoryId || category.majorCategory;
    const majorCategoryInfo = this.majorCategories.find(mc => mc.id === majorCategoryId);
    const majorCategoryLabel = majorCategoryInfo ? 
      `${majorCategoryInfo.icon} ${majorCategoryInfo.name}` : '未知大类';
    
    // 🔴 判断是否为自定义分类
    const isCustomCategory = !category.isSystem;
    
    return `
      <div class="category-item ${isCustomCategory ? 'custom' : 'builtin'}" data-category-id="${category.id}">
        <div class="category-header">
          <div class="category-icon">${category.icon || '📁'}</div>
          <div class="category-info">
            <div class="category-name">${escapeHtml(category.name)}</div>
            <div class="category-description">${escapeHtml(category.description || '')}</div>
            
            <div class="category-meta">
              <div class="category-stats">
                <span class="category-usage">
                  ${enabledSourceCount}/${sourceCount} 个搜索源已启用
                </span>
                ${isCustomCategory ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
              </div>
              
              ${!isCustomCategory ? `
                <div class="major-category-info">
                  <span class="major-category-label">归属: ${majorCategoryLabel}</span>
                </div>
              ` : ''}
            </div>
            
            ${!isCustomCategory ? `
              <div class="category-search-config">
                <span class="search-default-badge ${category.defaultSearchable ? 'searchable' : 'non-searchable'}">
                  ${category.defaultSearchable ? '🔍 默认可搜索' : '🌐 默认仅浏览'}
                </span>
                <span class="site-type-badge">${this.getSiteTypeLabel(category.defaultSiteType)}</span>
                ${category.searchPriority ? `<span class="priority-badge">优先级: ${category.searchPriority}</span>` : ''}
              </div>
              
              <div class="category-source-stats">
                ${searchableSources > 0 ? `<span class="stat-item">🔍 ${searchableSources}个搜索源</span>` : ''}
                ${browseSources > 0 ? `<span class="stat-item">🌐 ${browseSources}个浏览站</span>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="category-actions">
          <button class="action-btn view-btn" onclick="app.getManager('categories').viewCategorySources('${category.id}')" title="查看搜索源">
            查看源
          </button>
          ${isCustomCategory ? `
            <button class="action-btn edit-btn" onclick="app.getManager('categories').editCustomCategory('${category.id}')" title="编辑">
              编辑
            </button>
            <button class="action-btn delete-btn" onclick="app.getManager('categories').deleteCustomCategory('${category.id}')" title="删除">
              删除
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  getSiteTypeLabel(siteType) {
    const labels = {
      'search': '搜索源',
      'browse': '浏览站',
      'reference': '参考站'
    };
    return labels[siteType] || '搜索源';
  }

  updateCategoriesStats() {
    const elements = {
      totalCategoriesCount: document.getElementById('totalCategoriesCount'),
      builtinCategoriesCount: document.getElementById('builtinCategoriesCount'),
      customCategoriesCount: document.getElementById('customCategoriesCount'),
      usedCategoriesCount: document.getElementById('usedCategoriesCount')
    };

    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    
    // 🔴 修复:计算使用中的分类时支持字段兼容
    const usedCategories = new Set(
      allSources.map(s => s.categoryId || s.category).filter(Boolean)
    );

    if (elements.totalCategoriesCount) elements.totalCategoriesCount.textContent = this.allCategories.length;
    if (elements.builtinCategoriesCount) elements.builtinCategoriesCount.textContent = this.builtinCategories.length;
    if (elements.customCategoriesCount) elements.customCategoriesCount.textContent = this.customCategories.length;
    if (elements.usedCategoriesCount) elements.usedCategoriesCount.textContent = usedCategories.size;
  }

  viewCategorySources(categoryId) {
    this.app.switchTab('sources');
    
    setTimeout(() => {
      const categoryFilter = document.getElementById('categoryFilter');
      if (categoryFilter) {
        categoryFilter.value = categoryId;
        const sourcesManager = this.app.getManager('sources');
        if (sourcesManager) {
          sourcesManager.filterAndSortSources();
        }
      }
    }, 100);
  }

  showCustomCategoryModal(category = null) {
    this.editingCustomCategory = category;
    
    let modal = document.getElementById('customCategoryModal');
    if (!modal) {
      modal = this.createCustomCategoryModal();
      document.body.appendChild(modal);
    }
    
    this.populateCustomCategoryForm(modal, category);
    modal.style.display = 'block';
    
    setTimeout(() => {
      const nameInput = modal.querySelector('#categoryName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  createCustomCategoryModal() {
    const modal = document.createElement('div');
    modal.id = 'customCategoryModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content custom-category-modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义分类</h2>
        <form id="customCategoryForm" class="custom-category-form">
          <input type="hidden" name="categoryId">
          
          <div class="form-section basic-info">
            <h3>基本信息</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="categoryName">分类名称 *</label>
                <input type="text" name="categoryName" id="categoryName" required maxlength="30" 
                       placeholder="例如:我的分类">
              </div>
              
              <div class="form-group">
                <label for="categoryIcon">图标 *</label>
                <select name="categoryIcon" id="categoryIcon" required>
                  ${APP_CONSTANTS.DEFAULT_ICONS.map(icon => `
                    <option value="${icon}">${icon}</option>
                  `).join('')}
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label for="categoryDescription">分类描述</label>
              <input type="text" name="categoryDescription" id="categoryDescription" maxlength="100" 
                     placeholder="例如:专门的搜索资源分类">
            </div>
            
            <div class="form-group">
              <label for="categoryColor">分类颜色</label>
              <select name="categoryColor" id="categoryColor">
                ${APP_CONSTANTS.DEFAULT_COLORS.map(color => `
                  <option value="${color}" style="background-color: ${color}; color: white;">
                    ${color}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              <label for="majorCategoryId">所属大类 *</label>
              <select name="majorCategoryId" id="majorCategoryId" required>
                <!-- 大类选项将动态生成 -->
              </select>
            </div>
          </div>
          
          <div class="form-section search-config">
            <h3>搜索配置</h3>
            <p class="section-description">设置该分类下网站的默认行为</p>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="defaultSearchable" id="defaultSearchable" checked>
                该分类下的网站默认参与搜索
              </label>
            </div>
            
            <div class="form-group">
              <label for="defaultSiteType">默认网站类型</label>
              <select name="defaultSiteType" id="defaultSiteType">
                <option value="search">搜索源(需要关键词)</option>
                <option value="browse">浏览站(仅供访问)</option>
                <option value="reference">参考站(可选关键词)</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="searchPriority">搜索优先级 (1-10)</label>
              <input type="number" name="searchPriority" id="searchPriority" 
                     min="1" max="10" value="5">
              <small>数字越小优先级越高</small>
            </div>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">添加分类</button>
          </div>
        </form>
      </div>
    `;
    
    const form = modal.querySelector('#customCategoryForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomCategorySubmit(e));
    }
    
    return modal;
  }

  populateCustomCategoryForm(modal, category) {
    const form = modal.querySelector('#customCategoryForm');
    if (!form) return;

    // 更新大类选择器选项
    this.updateMajorCategorySelect(form.majorCategoryId);

    if (category) {
      form.categoryId.value = category.id;
      form.categoryName.value = category.name;
      form.categoryDescription.value = category.description || '';
      form.categoryIcon.value = category.icon || '🌟';
      form.categoryColor.value = category.color || '#6b7280';
      form.majorCategoryId.value = category.majorCategoryId || category.majorCategory || 'search_sources';
      form.defaultSearchable.checked = category.defaultSearchable !== false;
      form.defaultSiteType.value = category.defaultSiteType || 'search';
      form.searchPriority.value = category.searchPriority || 5;
      modal.querySelector('h2').textContent = '编辑自定义分类';
      modal.querySelector('[type="submit"]').textContent = '更新分类';
    } else {
      form.reset();
      form.categoryIcon.value = '🌟';
      form.categoryColor.value = '#6b7280';
      form.majorCategoryId.value = this.majorCategories.length > 0 ? this.majorCategories[0].id : 'search_sources';
      form.defaultSearchable.checked = true;
      form.defaultSiteType.value = 'search';
      form.searchPriority.value = 5;
      modal.querySelector('h2').textContent = '添加自定义分类';
      modal.querySelector('[type="submit"]').textContent = '添加分类';
    }
  }

  updateMajorCategorySelect(selectElement) {
    if (!selectElement) return;

    const majorCategoriesHTML = this.majorCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(majorCategory => `
        <option value="${majorCategory.id}">${majorCategory.icon} ${majorCategory.name}</option>
      `).join('');

    selectElement.innerHTML = majorCategoriesHTML;
  }

  async handleCustomCategorySubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const categoryData = {
      id: formData.get('categoryId') || null,
      name: formData.get('categoryName').trim(),
      description: formData.get('categoryDescription').trim(),
      icon: formData.get('categoryIcon'),
      color: formData.get('categoryColor'),
      majorCategoryId: formData.get('majorCategoryId'),
      defaultSearchable: formData.get('defaultSearchable') === 'on',
      defaultSiteType: formData.get('defaultSiteType') || 'search',
      searchPriority: parseInt(formData.get('searchPriority')) || 5
    };
    
    const validation = this.validateCustomCategory(categoryData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingCustomCategory && categoryData.id) {
        await searchSourcesAPI.updateSourceCategory(categoryData.id, categoryData);
        showToast('自定义分类更新成功', 'success');
      } else {
        await searchSourcesAPI.createSourceCategory(categoryData);
        showToast('自定义分类添加成功', 'success');
      }
      
      await this.loadUserCategorySettings();
      await this.loadTabData();
      this.app.closeModals();
      
    } catch (error) {
      console.error('保存自定义分类失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  validateCustomCategory(categoryData) {
    const rules = APP_CONSTANTS.VALIDATION_RULES.CATEGORY;
    
    const requiredFields = ['name', 'icon', 'majorCategoryId'];
    
    for (const field of requiredFields) {
      if (!categoryData[field] || (typeof categoryData[field] === 'string' && categoryData[field].trim() === '')) {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(categoryData.name)) {
      return { valid: false, message: '分类名称格式不正确' };
    }
    
    if (categoryData.color && !rules.COLOR_PATTERN.test(categoryData.color)) {
      return { valid: false, message: '颜色格式不正确' };
    }
    
    if (!categoryData.id && this.customCategories.length >= APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES) {
      return { valid: false, message: `最多只能创建 ${APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES} 个自定义分类` };
    }
    
    return { valid: true };
  }

  editCustomCategory(categoryId) {
    const category = this.customCategories.find(c => c.id === categoryId);
    if (!category) {
      showToast('未找到指定的自定义分类', 'error');
      return;
    }
    
    this.showCustomCategoryModal(category);
  }

  async deleteCustomCategory(categoryId) {
    const category = this.customCategories.find(c => c.id === categoryId);
    if (!category) {
      showToast('未找到指定的自定义分类', 'error');
      return;
    }
    
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    
    // 🔴 修复:检查时支持字段兼容
    const sourcesUsingCategory = allSources.filter(s => {
      const sourceCategoryId = s.categoryId || s.category;
      return sourceCategoryId === categoryId;
    });
    
    if (sourcesUsingCategory.length > 0) {
      showToast(`无法删除分类"${category.name}",因为有 ${sourcesUsingCategory.length} 个搜索源正在使用此分类`, 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义分类"${category.name}"吗?此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      await searchSourcesAPI.deleteSourceCategory(categoryId);
      
      this.customCategories = this.customCategories.filter(c => c.id !== categoryId);
      this.allCategories = this.allCategories.filter(c => c.id !== categoryId);
      
      await this.loadTabData();
      showToast('自定义分类删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义分类失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async exportCategories() {
    try {
      const exportData = await searchSourcesAPI.exportUserSearchSources();
      
      const categoriesData = {
        majorCategories: this.majorCategories,
        builtinCategories: this.builtinCategories,
        customCategories: this.customCategories,
        exportTime: exportData.exportTime,
        version: exportData.version
      };

      const blob = new Blob([JSON.stringify(categoriesData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `source-categories-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('分类配置导出成功', 'success');
    } catch (error) {
      console.error('导出分类失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  resetEditingState() {
    this.editingCustomCategory = null;
  }

  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
  }

  getAllCategories() {
    return this.allCategories;
  }

  getCustomCategories() {
    return this.customCategories;
  }

  getBuiltinCategories() {
    return this.builtinCategories;
  }

  getMajorCategories() {
    return this.majorCategories;
  }
}

export default CategoriesManager;