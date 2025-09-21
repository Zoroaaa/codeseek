// 分类管理器 - 完全集成新的搜索源分类管理API
import { APP_CONSTANTS, MAJOR_CATEGORIES } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
// 🔴 导入新的搜索源管理API
import searchSourcesAPI from '../../services/search-sources-api.js';

export class CategoriesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinCategories = [];
    this.customCategories = [];
    this.allCategories = [];
    this.editingCustomCategory = null;
  }

  async init() {
    console.log('🏷️ 初始化分类管理器');
    this.loadBuiltinData();
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

  loadBuiltinData() {
    try {
      this.builtinCategories = Object.values(APP_CONSTANTS.SOURCE_CATEGORIES).map(category => ({
        ...category,
        isBuiltin: true,
        isCustom: false
      }));
      
      this.allCategories = [...this.builtinCategories];
      console.log(`从constants.js加载了 ${this.builtinCategories.length} 个内置分类`);
      
    } catch (error) {
      console.error('加载内置分类数据失败:', error);
      this.builtinCategories = [];
      this.allCategories = [];
    }
  }

  // 🔴 使用新API加载用户分类设置
  async loadUserCategorySettings() {
    if (!this.app.getCurrentUser()) return;
    
    try {
      console.log('📡 从新API加载分类数据...');
      
      // 🔴 使用新的搜索源管理API获取所有分类
      const allCategories = await searchSourcesAPI.getSourceCategories({
        includeSystem: true
      });
      
      // 分离内置和自定义分类
      this.builtinCategories = allCategories.filter(c => c.isSystem || c.isBuiltin);
      this.customCategories = allCategories.filter(c => c.isCustom || !c.isSystem);
      
      // 合并所有分类
      this.allCategories = allCategories;
      
      console.log(`✅ 已加载 ${this.allCategories.length} 个分类 (${this.builtinCategories.length} 内置, ${this.customCategories.length} 自定义)`);
      
    } catch (error) {
      console.warn('⚠️ 从API加载分类失败,使用默认设置:', error);
      this.customCategories = [];
      this.allCategories = [...this.builtinCategories];
    }
  }

  bindEvents() {
    // 添加自定义分类按钮
    const addCustomCategoryBtn = document.getElementById('addCustomCategoryBtn');
    if (addCustomCategoryBtn) {
      addCustomCategoryBtn.addEventListener('click', () => this.showCustomCategoryModal());
    }
  }

  renderBuiltinCategories() {
    const builtinCategoriesList = document.getElementById('builtinCategoriesList');
    if (!builtinCategoriesList) return;

    if (this.builtinCategories.length === 0) {
      builtinCategoriesList.innerHTML = '<p class="empty-state">没有内置分类</p>';
      return;
    }

    // 按大分类分组显示内置分类
    const categoriesByMajor = this.groupCategoriesByMajorCategory(this.builtinCategories);
    
    let html = '';
    Object.values(MAJOR_CATEGORIES).sort((a, b) => a.order - b.order).forEach(majorCategory => {
      const categories = categoriesByMajor[majorCategory.id] || [];
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

    builtinCategoriesList.innerHTML = html;
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
      const majorCategoryId = category.majorCategory || 'others';
      if (!grouped[majorCategoryId]) {
        grouped[majorCategoryId] = [];
      }
      grouped[majorCategoryId].push(category);
    });
    
    // 对每个组内的分类按order排序
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => (a.order || 999) - (b.order || 999));
    });
    
    return grouped;
  }

  renderCategoryItem(category) {
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const enabledSources = sourcesManager ? sourcesManager.enabledSources : [];
    
    const sourceCount = allSources.filter(s => s.category === category.id).length;
    const enabledSourceCount = allSources.filter(s => 
      s.category === category.id && enabledSources.includes(s.id)
    ).length;
    
    // 搜索源类型统计
    const searchableSources = allSources.filter(s => 
      s.category === category.id && s.searchable !== false
    ).length;
    const browseSources = allSources.filter(s => 
      s.category === category.id && s.searchable === false
    ).length;
    
    // 获取大分类信息
    const majorCategoryInfo = MAJOR_CATEGORIES[category.majorCategory];
    const majorCategoryLabel = majorCategoryInfo ? 
      `${majorCategoryInfo.icon} ${majorCategoryInfo.name}` : '未知大类';
    
    return `
      <div class="category-item ${category.isCustom ? 'custom' : 'builtin'}" data-category-id="${category.id}">
        <div class="category-header">
          <div class="category-icon">${category.icon}</div>
          <div class="category-info">
            <div class="category-name">${escapeHtml(category.name)}</div>
            <div class="category-description">${escapeHtml(category.description || '')}</div>
            
            <div class="category-meta">
              <div class="category-stats">
                <span class="category-usage">
                  ${enabledSourceCount}/${sourceCount} 个搜索源已启用
                </span>
                ${category.isCustom ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
              </div>
              
              ${!category.isCustom ? `
                <div class="major-category-info">
                  <span class="major-category-label">归属:${majorCategoryLabel}</span>
                </div>
              ` : ''}
            </div>
            
            ${category.isBuiltin ? `
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
          ${category.isCustom ? `
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

    // 计算使用中的分类数量
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const usedCategories = new Set(allSources.map(s => s.category));

    if (elements.totalCategoriesCount) elements.totalCategoriesCount.textContent = this.allCategories.length;
    if (elements.builtinCategoriesCount) elements.builtinCategoriesCount.textContent = this.builtinCategories.length;
    if (elements.customCategoriesCount) elements.customCategoriesCount.textContent = this.customCategories.length;
    if (elements.usedCategoriesCount) elements.usedCategoriesCount.textContent = usedCategories.size;
  }

  viewCategorySources(categoryId) {
    // 切换到搜索源管理页面
    this.app.switchTab('sources');
    
    // 设置分类筛选
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

    if (category) {
      form.categoryId.value = category.id;
      form.categoryName.value = category.name;
      form.categoryDescription.value = category.description || '';
      form.categoryIcon.value = category.icon || '🌟';
      form.categoryColor.value = category.color || '#6b7280';
      form.defaultSearchable.checked = category.defaultSearchable !== false;
      form.defaultSiteType.value = category.defaultSiteType || 'search';
      form.searchPriority.value = category.searchPriority || 5;
      modal.querySelector('h2').textContent = '编辑自定义分类';
      modal.querySelector('[type="submit"]').textContent = '更新分类';
    } else {
      form.reset();
      form.categoryIcon.value = '🌟';
      form.categoryColor.value = '#6b7280';
      form.defaultSearchable.checked = true;
      form.defaultSiteType.value = 'search';
      form.searchPriority.value = 5;
      modal.querySelector('h2').textContent = '添加自定义分类';
      modal.querySelector('[type="submit"]').textContent = '添加分类';
    }
  }

  // 🔴 使用新API保存自定义分类
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
        // 🔴 使用新API更新
        await searchSourcesAPI.updateSourceCategory(categoryData.id, categoryData);
        showToast('自定义分类更新成功', 'success');
      } else {
        // 🔴 使用新API创建
        // 需要添加majorCategoryId,默认为'others'
        categoryData.majorCategoryId = 'others';
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
    
    // 注意:创建时不需要majorCategoryId验证,因为会使用默认值
    const requiredFields = categoryData.id ? 
      rules.REQUIRED_FIELDS.filter(f => f !== 'id') : 
      ['name', 'icon'];
    
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

  // 🔴 使用新API删除自定义分类
  async deleteCustomCategory(categoryId) {
    const category = this.customCategories.find(c => c.id === categoryId);
    if (!category) {
      showToast('未找到指定的自定义分类', 'error');
      return;
    }
    
    // 检查是否有搜索源使用此分类
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const sourcesUsingCategory = allSources.filter(s => s.category === categoryId);
    
    if (sourcesUsingCategory.length > 0) {
      showToast(`无法删除分类"${category.name}",因为有 ${sourcesUsingCategory.length} 个搜索源正在使用此分类`, 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义分类"${category.name}"吗?此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      
      // 🔴 使用新API删除
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

  // 🔴 使用新API导出分类
  async exportCategories() {
    try {
      // 🔴 使用新API导出
      const exportData = await searchSourcesAPI.exportUserSearchSources();
      
      // 只导出分类部分
      const categoriesData = {
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

  // 公共方法供其他管理器调用
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
}

export default CategoriesManager;