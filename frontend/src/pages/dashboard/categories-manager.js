// 分类管理器
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import apiService from '../../services/api.js';

export class CategoriesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinCategories = [];
    this.customCategories = [];
    this.allCategories = [];
    this.editingCustomCategory = null;
  }

  async init() {
    console.log('📁 初始化分类管理器');
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

  async loadUserCategorySettings() {
    if (!this.app.getCurrentUser()) return;
    
    try {
      const userSettings = await apiService.getUserSettings();
      this.customCategories = userSettings.customSourceCategories || [];
      
      // 合并内置和自定义数据
      this.allCategories = [
        ...this.builtinCategories,
        ...this.customCategories.map(c => ({ ...c, isBuiltin: false, isCustom: true }))
      ];
      
      console.log(`分类设置：${this.builtinCategories.length} 个内置分类，${this.customCategories.length} 个自定义分类`);
      
    } catch (error) {
      console.warn('加载用户分类设置失败，使用默认设置:', error);
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

    builtinCategoriesList.innerHTML = `
      <div class="categories-grid">
        ${this.builtinCategories
          .sort((a, b) => (a.order || 999) - (b.order || 999))
          .map(category => this.renderCategoryItem(category)).join('')}
      </div>
    `;
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

  renderCategoryItem(category) {
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const enabledSources = sourcesManager ? sourcesManager.enabledSources : [];
    
    const sourceCount = allSources.filter(s => s.category === category.id).length;
    const enabledSourceCount = allSources.filter(s => 
      s.category === category.id && enabledSources.includes(s.id)
    ).length;
    
    return `
      <div class="category-item ${category.isCustom ? 'custom' : 'builtin'}" data-category-id="${category.id}">
        <div class="category-header">
          <div class="category-icon">${category.icon}</div>
          <div class="category-info">
            <div class="category-name">${escapeHtml(category.name)}</div>
            <div class="category-description">${escapeHtml(category.description || '')}</div>
            <div class="category-meta">
              <span class="category-usage">
                ${enabledSourceCount}/${sourceCount} 个搜索源已启用
              </span>
              ${category.isCustom ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
            </div>
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
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义分类</h2>
        <form id="customCategoryForm">
          <input type="hidden" name="categoryId">
          
          <div class="form-row">
            <div class="form-group">
              <label for="categoryName">分类名称 *</label>
              <input type="text" name="categoryName" id="categoryName" required maxlength="30" 
                     placeholder="例如：我的分类">
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
                   placeholder="例如：专门的搜索资源分类">
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
      // 编辑模式
      form.categoryId.value = category.id;
      form.categoryName.value = category.name;
      form.categoryDescription.value = category.description || '';
      form.categoryIcon.value = category.icon || '🌟';
      form.categoryColor.value = category.color || '#6b7280';
      modal.querySelector('h2').textContent = '编辑自定义分类';
      modal.querySelector('[type="submit"]').textContent = '更新分类';
    } else {
      // 新增模式
      form.reset();
      form.categoryIcon.value = '🌟';
      form.categoryColor.value = '#6b7280';
      modal.querySelector('h2').textContent = '添加自定义分类';
      modal.querySelector('[type="submit"]').textContent = '添加分类';
    }
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
      color: formData.get('categoryColor')
    };
    
    const validation = this.validateCustomCategory(categoryData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingCustomCategory && categoryData.id) {
        await this.updateCustomCategory(categoryData);
        showToast('自定义分类更新成功', 'success');
      } else {
        await this.addCustomCategory(categoryData);
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
    
    const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
    
    for (const field of requiredFieldsForValidation) {
      if (!categoryData[field] || categoryData[field].trim() === '') {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(categoryData.name)) {
      return { valid: false, message: '分类名称格式不正确' };
    }
    
    if (categoryData.color && !rules.COLOR_PATTERN.test(categoryData.color)) {
      return { valid: false, message: '颜色格式不正确' };
    }
    
    if (!categoryData.id) {
      const generatedId = this.generateCategoryId(categoryData.name);
      if (this.allCategories.some(c => c.id === generatedId)) {
        return { valid: false, message: '分类名称已存在，请使用不同的名称' };
      }
    }
    
    if (!categoryData.id && this.customCategories.length >= APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES) {
      return { valid: false, message: `最多只能创建 ${APP_CONSTANTS.LIMITS.MAX_CUSTOM_CATEGORIES} 个自定义分类` };
    }
    
    return { valid: true };
  }

  generateCategoryId(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 15) + '_' + Date.now().toString(36);
  }

  async addCustomCategory(categoryData) {
    categoryData.id = this.generateCategoryId(categoryData.name);
    categoryData.createdAt = Date.now();
    categoryData.isCustom = true;
    categoryData.isBuiltin = false;
    categoryData.order = 50; // 自定义分类排序权重
    
    this.customCategories.push(categoryData);
    this.allCategories.push({ ...categoryData, isCustom: true, isBuiltin: false });
    
    await this.saveCustomCategories();
  }

  async updateCustomCategory(categoryData) {
    const index = this.customCategories.findIndex(c => c.id === categoryData.id);
    if (index === -1) {
      throw new Error('未找到要更新的分类');
    }
    
    this.customCategories[index] = { ...this.customCategories[index], ...categoryData };
    
    const allIndex = this.allCategories.findIndex(c => c.id === categoryData.id);
    if (allIndex !== -1) {
      this.allCategories[allIndex] = { ...this.allCategories[allIndex], ...categoryData };
    }
    
    await this.saveCustomCategories();
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
    
    // 检查是否有搜索源使用此分类
    const sourcesManager = this.app.getManager('sources');
    const allSources = sourcesManager ? sourcesManager.getAllSearchSources() : [];
    const sourcesUsingCategory = allSources.filter(s => s.category === categoryId);
    
    if (sourcesUsingCategory.length > 0) {
      showToast(`无法删除分类"${category.name}"，因为有 ${sourcesUsingCategory.length} 个搜索源正在使用此分类`, 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义分类"${category.name}"吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      
      this.customCategories = this.customCategories.filter(c => c.id !== categoryId);
      this.allCategories = this.allCategories.filter(c => c.id !== categoryId);
      
      await this.saveCustomCategories();
      await this.loadTabData();
      
      showToast('自定义分类删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义分类失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async saveCustomCategories() {
    const sourcesManager = this.app.getManager('sources');
    const customSources = sourcesManager ? sourcesManager.customSearchSources : [];
    const enabledSources = sourcesManager ? sourcesManager.enabledSources : [];
    
    const settings = {
      customSourceCategories: this.customCategories,
      customSearchSources: customSources,
      searchSources: enabledSources
    };
    
    await apiService.updateUserSettings(settings);
  }

  async exportCategories() {
    try {
      const data = {
        builtinCategories: this.builtinCategories,
        customCategories: this.customCategories,
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
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