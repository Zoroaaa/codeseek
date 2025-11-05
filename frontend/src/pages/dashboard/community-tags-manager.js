// 社区标签管理器 - 从community-manager.js拆分出来的标签相关功能
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast, createElement } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import communityTagsService from '../../services/community-tags-api.js';

export class CommunityTagsManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.availableTags = []; // 存储所有可用标签
    this.popularTags = [];
    this.isInitialized = false;
  }

  async init() {
    console.log('初始化社区标签管理器');
    try {
      this.isInitialized = true;
      console.log('社区标签管理器初始化完成');
    } catch (error) {
      console.error('社区标签管理器初始化失败:', error);
    }
  }

  // 🆕 加载所有可用标签
  async loadAvailableTags() {
    try {
      console.log('开始加载所有可用标签');
      const result = await communityTagsService.getAllTags({
        active: true,
        category: 'all'
      });
      
      if (result.success) {
        this.availableTags = result.tags || [];
        console.log('可用标签加载成功:', this.availableTags.length, '个标签');
        
        // 验证标签数据结构
        this.availableTags = this.availableTags.filter(tag => {
          if (!tag || !tag.name) {
            console.warn('发现无效标签数据:', tag);
            return false;
          }
          return true;
        });
        
      } else {
        console.warn('加载可用标签失败:', result.error);
        this.availableTags = [];
      }
    } catch (error) {
      console.error('加载可用标签异常:', error);
      this.availableTags = [];
      
      // 显示用户友好的错误信息
      if (error.message.includes('ambiguous column name')) {
        console.log('检测到数据库列名冲突，尝试重新初始化...');
      }
    }
  }

  // 🆕 显示创建标签模态框
  showCreateTagModal() {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    // 移除现有模态框
    const existingModal = document.getElementById('createTagModal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = `
      <div id="createTagModal" class="modal tag-modal" style="display: block;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>🏷️ 创建新标签</h2>
            <span class="close" onclick="document.getElementById('createTagModal').remove()">&times;</span>
          </div>
          
          <form id="createTagForm">
            <div class="form-group">
              <label for="tagName">标签名称 <span style="color: red;">*</span>:</label>
              <input type="text" id="tagName" name="tagName" required 
                placeholder="例如：高质量、热门推荐" 
                maxlength="20">
              <small class="form-help">2-20个字符，支持中文、英文、数字</small>
              <div class="field-error" id="tagNameError"></div>
            </div>
            
            <div class="form-group">
              <label for="tagDescription">标签描述:</label>
              <input type="text" id="tagDescription" name="tagDescription" 
                placeholder="简要描述这个标签的用途" maxlength="100">
            </div>
            
            <div class="form-group">
              <label for="tagColor">标签颜色:</label>`}]}}}`}],"fixes":[{"type":"add_drag_functionality","changes":["添加了可拖动的modal-header容器","将标题和关闭按钮移到模态框头部","添加了draggable-header类以支持拖动功能"]}]}}
              <input type="color" id="tagColor" name="tagColor" value="#3b82f6">
              <div class="tag-color-preview">
                <span>预览:</span>
                <span class="color-sample" style="background-color: #3b82f6;"></span>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>✨</span>
                <span>创建标签</span>
              </button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('createTagModal').remove()">
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定颜色预览事件
    const colorInput = document.getElementById('tagColor');
    const colorSample = document.querySelector('.color-sample');
    if (colorInput && colorSample) {
      colorInput.addEventListener('input', (e) => {
        colorSample.style.backgroundColor = e.target.value;
      });
    }
    
    // 绑定表单提交事件
    const form = document.getElementById('createTagForm');
    if (form) {
      form.addEventListener('submit', (e) => this.submitCreateTagForm(e));
    }
  }

  // 🆕 提交创建标签表单
  async submitCreateTagForm(event) {
    event.preventDefault();
    
    const form = document.getElementById('createTagForm');
    if (!form) return;

    // 清除之前的错误状态
    document.querySelectorAll('.field-error').forEach(error => {
      error.style.display = 'none';
    });
    document.querySelectorAll('.form-group input, .form-group select').forEach(field => {
      field.classList.remove('error');
    });

    const formData = new FormData(form);
    const tagData = {
      name: formData.get('tagName')?.trim(),
      description: formData.get('tagDescription')?.trim() || '',
      color: formData.get('tagColor') || '#3b82f6'
    };

    // 前端验证 - 移除复杂的正则表达式
    let hasError = false;

    if (!tagData.name || tagData.name.length < 2) {
      this.showFieldError('tagName', '标签名称至少需要2个字符');
      hasError = true;
    }

    if (tagData.name && tagData.name.length > 20) {
      this.showFieldError('tagName', '标签名称不能超过20个字符');
      hasError = true;
    }

    // 简化的字符验证 - 只检查长度和基本字符
    if (tagData.name && !/^[\u4e00-\u9fa5\w\s\-]{2,20}$/.test(tagData.name)) {
      this.showFieldError('tagName', '标签名称只能包含中文、英文、数字、空格和短横线');
      hasError = true;
    }

    // 检查标签名称是否已存在 - 使用本地数据检查
    const existingTag = this.availableTags.find(tag => 
      tag.name && tag.name.toLowerCase() === tagData.name.toLowerCase()
    );
    
    if (existingTag) {
      this.showFieldError('tagName', '标签名称已存在，请使用其他名称');
      hasError = true;
    }

    if (hasError) return;

    try {
      showLoading(true);
      
      console.log('提交标签创建请求:', tagData);
      
      const result = await communityTagsService.createTag(tagData);
      
      if (result.success) {
        showToast('标签创建成功！', 'success');
        document.getElementById('createTagModal').remove();
        
        // 重新加载标签数据
        await this.loadAvailableTags();
        await this.loadPopularTags();
        
      } else {
        // 处理服务器端错误 - 改进的错误处理
        let errorMessage = result.message || result.error || '创建标签失败';
        
        // 处理数据库相关错误
        if (errorMessage.includes('ambiguous column name')) {
          errorMessage = '数据库结构正在更新中，请联系管理员或稍后重试';
          showToast(errorMessage, 'warning');
          
          // 建议刷新页面
          setTimeout(() => {
            if (confirm('检测到数据库结构已更新，是否刷新页面以应用更新？')) {
              window.location.reload();
            }
          }, 2000);
        } else if (errorMessage.includes('SQLITE_ERROR')) {
          errorMessage = '数据库操作失败，请检查输入或稍后重试';
          showToast(errorMessage, 'error');
        } else if (errorMessage.includes('已存在')) {
          // 后端检查到重复，显示在对应字段
          this.showFieldError('tagName', '标签名称已存在，请使用其他名称');
          return; // 不显示toast，字段级错误已显示
        } else if (errorMessage.includes('权限')) {
          errorMessage = '没有创建标签的权限，请联系管理员';
          showToast(errorMessage, 'error');
        } else if (errorMessage.includes('限制') || errorMessage.includes('超过')) {
          errorMessage = '您创建的标签数量已达上限，请先删除一些不常用的标签';
          showToast(errorMessage, 'warning');
        } else {
          showToast(errorMessage, 'error');
        }
      }
      
    } catch (error) {
      console.error('创建标签失败:', error);
      
      let errorMessage = '创建标签失败';
      if (error.message.includes('ambiguous column name')) {
        errorMessage = '数据库列名冲突，请联系管理员更新数据库架构';
        showToast(errorMessage, 'error');
        
        // 提供解决建议
        setTimeout(() => {
          if (confirm('检测到数据库架构问题，建议刷新页面。是否立即刷新？')) {
            window.location.reload();
          }
        }, 3000);
      } else if (error.message.includes('SQLITE_ERROR')) {
        errorMessage = 'SQLite数据库错误，请检查服务器状态';
        showToast(errorMessage, 'error');
      } else if (error.message.includes('网络')) {
        errorMessage = '网络连接失败，请检查网络后重试';
        showToast(errorMessage, 'error');
      } else if (error.message.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试';
        showToast(errorMessage, 'error');
      } else {
        errorMessage += ': ' + error.message;
        showToast(errorMessage, 'error');
      }
      
    } finally {
      showLoading(false);
    }
  }

  // 显示字段错误
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

  // 加载真实热门标签
  async loadPopularTags() {
    try {
      const result = await communityTagsService.getPopularTags();
      
      if (result.success && result.tags && result.tags.length > 0) {
        this.popularTags = result.tags.filter(tag => 
          tag && tag.name && (tag.usageCount > 0 || tag.count > 0)
        );
        this.renderPopularTags();
        console.log('热门标签加载成功:', this.popularTags.length, '个标签');
      } else {
        console.log('没有热门标签数据，显示空状态');
        this.popularTags = [];
        this.renderEmptyTags();
      }
    } catch (error) {
      console.warn('加载热门标签失败:', error);
      this.popularTags = [];
      this.renderEmptyTags();
    }
  }

// 渲染热门标签
  renderPopularTags() {
    const container = document.getElementById('popularTagsList');
    if (!container) return;

    if (!this.popularTags || this.popularTags.length === 0) {
        this.renderEmptyTags();
        return;
    }

    const validTags = this.popularTags
        .filter(tag => (tag.usageCount || tag.count) > 0)
        .sort((a, b) => (b.usageCount || b.count) - (a.usageCount || a.count))
        .slice(0, 15);

    if (validTags.length === 0) {
        this.renderEmptyTags();
        return;
    }

    const tagsHTML = validTags.map(tag => {
        const isOfficial = tag.isOfficial || false;
        const usageCount = tag.usageCount || tag.count || 0;
        const tagClass = isOfficial ? 'tag-item official' : 'tag-item';
        
        return `
            <span class="${tagClass}" 
                  onclick="window.app.getManager('community').communitySources.showTagSourcesModal('${tag.id}', '${escapeHtml(tag.name)}')"
                  title="点击查看标签相关的搜索源 (使用次数: ${usageCount})">
                ${escapeHtml(tag.name)} 
                <span class="tag-count">(${usageCount})</span>
            </span>
        `;
    }).join('');

    container.innerHTML = `
        <div class="tags-cloud">
            ${tagsHTML}
        </div>
    `;
  }

  // 渲染空标签状态
  renderEmptyTags() {
    const container = document.getElementById('popularTagsList');
    if (container) {
      container.innerHTML = `
        <div class="empty-tags">
          <span style="font-size: 2rem; opacity: 0.5;">🏷️</span>
          <p style="color: var(--text-muted); margin: 0.5rem 0;">暂无热门标签</p>
          <small style="color: var(--text-muted);">开始分享搜索源来创建标签吧</small>
        </div>
      `;
    }
  }

  // 🆕 显示编辑标签模态框
  showEditTagModal(tagId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }

    console.log('显示编辑标签模态框:', tagId);

    // 查找标签数据
    const tag = this.availableTags.find(t => t.id === tagId);
    if (!tag) {
      showToast('标签不存在', 'error');
      return;
    }

    const modalHTML = `
      <div id="editTagModal" class="modal tag-modal" style="display: block;">
        <div class="modal-content">
          <span class="close" onclick="document.getElementById('editTagModal').remove()">&times;</span>
          <h2>✏️ 编辑标签</h2>
          
          <form id="editTagForm">
            <div class="form-group">
              <label for="editTagName">标签名称 <span style="color: red;">*</span>:</label>
              <input type="text" id="editTagName" name="tagName" required 
                value="${escapeHtml(tag.name)}" 
                placeholder="例如：高质量、热门推荐" 
                maxlength="20">
              <small class="form-help">2-20个字符，支持中文、英文、数字</small>
              <div class="field-error" id="editTagNameError"></div>
            </div>
            
            <div class="form-group">
              <label for="editTagDescription">标签描述:</label>
              <input type="text" id="editTagDescription" name="tagDescription" 
                value="${escapeHtml(tag.description || '')}"
                placeholder="简要描述这个标签的用途" maxlength="100">
            </div>
            
            <div class="form-group">
              <label for="editTagColor">标签颜色:</label>
              <input type="color" id="editTagColor" name="tagColor" value="${tag.color || '#3b82f6'}">
              <div class="tag-color-preview">
                <span>预览:</span>
                <span class="color-sample" style="background-color: ${tag.color || '#3b82f6'};"></span>
              </div>
            </div>

            <div class="form-group">
              <label>
                <input type="checkbox" id="editTagActive" ${tag.isActive ? 'checked' : ''}>
                启用此标签
              </label>
              <small class="form-help">禁用后，此标签将不会在标签列表中显示</small>
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn-primary">
                <span>💾</span>
                <span>保存更改</span>
              </button>
              <button type="button" class="btn-secondary" onclick="document.getElementById('editTagModal').remove()">
                取消
              </button>
              ${!tag.isOfficial ? `
              <button type="button" class="btn-danger" onclick="window.app.getManager('community').communityTags.confirmDeleteTag('${tag.id}', '${escapeHtml(tag.name)}')">
                <span>🗑️</span>
                <span>删除标签</span>
              </button>` : ''}
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 绑定颜色预览事件
    const colorInput = document.getElementById('editTagColor');
    const colorSample = document.querySelector('#editTagModal .color-sample');
    if (colorInput && colorSample) {
      colorInput.addEventListener('input', (e) => {
        colorSample.style.backgroundColor = e.target.value;
      });
    }
    
    // 绑定表单提交事件
    const form = document.getElementById('editTagForm');
    if (form) {
      form.addEventListener('submit', (e) => this.submitEditTagForm(e, tagId));
    }
  }

  // 🆕 提交编辑标签表单
  async submitEditTagForm(event, tagId) {
    event.preventDefault();
    
    const form = document.getElementById('editTagForm');
    if (!form) return;

    // 清除之前的错误状态
    this.clearFormErrors('editTagModal');

    const formData = new FormData(form);
    const updates = {
      name: formData.get('tagName')?.trim(),
      description: formData.get('tagDescription')?.trim() || '',
      color: formData.get('tagColor') || '#3b82f6',
      isActive: document.getElementById('editTagActive')?.checked
    };

    // 前端验证
    if (!updates.name || updates.name.length < 2) {
      this.showFieldError('editTagName', '标签名称至少需要2个字符');
      return;
    }

    if (updates.name.length > 20) {
      this.showFieldError('editTagName', '标签名称不能超过20个字符');
      return;
    }

    try {
      showLoading(true);
      
      console.log('提交标签编辑:', tagId, updates);
      
      const result = await communityTagsService.editTag(tagId, updates);
      
      if (result.success) {
        showToast('标签更新成功！', 'success');
        document.getElementById('editTagModal').remove();
        
        // 重新加载标签数据
        await Promise.all([
          this.loadAvailableTags(),
          this.loadPopularTags()
        ]);
        
      } else {
        showToast(result.message || '更新失败', 'error');
      }
      
    } catch (error) {
      console.error('编辑标签失败:', error);
      showToast('编辑失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🆕 确认删除标签
  confirmDeleteTag(tagId, tagName) {
    const confirmed = confirm(`确定要删除标签"${tagName}"吗？\n\n删除后不可恢复，且所有使用此标签的搜索源将失去此标签。`);
    
    if (confirmed) {
      this.deleteTag(tagId);
    }
  }

  // 🆕 删除标签
  async deleteTag(tagId) {
    if (!this.app.getCurrentUser()) {
      showToast('请先登录', 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      console.log('删除标签:', tagId);
      
      const result = await communityTagsService.deleteTag(tagId);
      
      if (result.success) {
        showToast('标签删除成功', 'success');
        
        // 🔧 立即从本地数据中移除已删除的标签
        this.availableTags = this.availableTags.filter(tag => tag.id !== tagId);
        this.popularTags = this.popularTags.filter(tag => tag.id !== tagId);
        
        // 关闭模态框
        const modal = document.getElementById('editTagModal');
        if (modal) modal.remove();
        
        // 🔧 立即更新所有相关的UI组件
        this.updateAllTagRelatedUI(tagId);
        
        // 🔧 异步重新加载最新数据（确保与服务器同步）
        Promise.all([
          this.loadAvailableTags(),
          this.loadPopularTags()
        ]).then(() => {
          console.log('标签数据重新加载完成');
          // 再次更新UI，确保完全同步
          this.updateAllTagRelatedUI();
        }).catch(error => {
          console.warn('重新加载标签数据失败:', error);
        });
        
      } else {
        throw new Error(result.message || result.error || '删除失败');
      }
      
    } catch (error) {
      console.error('删除标签失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🆕 新增方法：更新所有标签相关的UI组件
  updateAllTagRelatedUI(deletedTagId = null) {
    console.log('更新所有标签相关的UI组件', deletedTagId ? `删除的标签ID: ${deletedTagId}` : '');
    
    try {
      // 1. 更新热门标签显示
      this.renderPopularTags();
      
      // 2. 更新我的标签管理模态框（如果打开）
      const myTagsModal = document.getElementById('manageMyTagsModal');
      if (myTagsModal) {
        console.log('更新我的标签管理模态框');
        this.updateMyTagsModalContent(deletedTagId);
      }
      
      // 3. 更新标签选择器（如果存在）
      const tagSelectorList = document.getElementById('tagSelectorList');
      if (tagSelectorList) {
        console.log('更新标签选择器');
        this.updateTagSelectorContent(deletedTagId);
      }
      
      // 4. 如果有标签源模态框打开，也需要更新
      const tagSourcesModal = document.getElementById('tagSourcesModal');
      if (tagSourcesModal && deletedTagId) {
        console.log('关闭已删除标签的源模态框');
        tagSourcesModal.remove();
      }
      
      console.log('所有标签相关UI组件更新完成');
      
    } catch (error) {
      console.error('更新标签UI时出错:', error);
    }
  }

  // 🆕 新增方法：更新我的标签管理模态框内容
  updateMyTagsModalContent(deletedTagId) {
    const modalBody = document.querySelector('#manageMyTagsModal .modal-body');
    if (!modalBody) return;
    
    if (deletedTagId) {
      // 立即移除已删除的标签项
      const deletedTagItem = document.querySelector(`#manageMyTagsModal .my-tag-item[data-tag-id="${deletedTagId}"]`);
      if (deletedTagItem) {
        deletedTagItem.style.opacity = '0.5';
        deletedTagItem.style.pointerEvents = 'none';
        setTimeout(() => {
          deletedTagItem.remove();
          this.checkEmptyTagsState();
        }, 500);
      }
    }
    
    // 重新生成我的标签列表
    const myTags = this.availableTags.filter(tag => 
        tag.creator && tag.creator.id === this.app.getCurrentUser().id
    );
    
    if (myTags.length === 0) {
      modalBody.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🏷️</span>
          <p>您还没有创建过标签</p>
          <button class="btn-primary" onclick="document.getElementById('manageMyTagsModal').remove(); window.app.getManager('community').communityTags.showCreateTagModal();">
            立即创建标签
          </button>
        </div>
      `;
    } else {
      modalBody.innerHTML = `
        <div class="my-tags-list">
          ${myTags.map(tag => this.renderMyTagItem(tag)).join('')}
        </div>
      `;
    }
    
    // 更新标题中的数量
    const modalHeader = document.querySelector('#manageMyTagsModal .modal-header h2');
    if (modalHeader) {
      modalHeader.textContent = `⚙️ 管理我的标签 (${myTags.length})`;
    }
  }

  // 🆕 新增方法：更新标签选择器内容
  updateTagSelectorContent(deletedTagId) {
    const tagSelectorList = document.getElementById('tagSelectorList');
    if (!tagSelectorList) return;
    
    if (deletedTagId) {
      // 立即移除已删除的标签选择项
      const deletedSelectorItem = tagSelectorList.querySelector(`[data-tag-id="${deletedTagId}"]`);
      if (deletedSelectorItem) {
        deletedSelectorItem.style.opacity = '0.5';
        setTimeout(() => {
          deletedSelectorItem.remove();
        }, 300);
      }
    }
    
    // 重新生成标签选择器内容
    if (this.availableTags && this.availableTags.length > 0) {
      const tagsHTML = this.availableTags.map(tag => `
        <div class="tag-selector-item" data-tag-id="${tag.id}" 
             onclick="this.classList.toggle('selected'); this.querySelector('input[type=checkbox]').checked = this.classList.contains('selected'); window.app.getManager('community').communitySources.updateSelectedTags()">
          <input type="checkbox" value="${tag.id}" name="selectedTags" style="display: none;">
          <span class="tag-name" style="color: ${tag.color || '#3b82f6'}">${escapeHtml(tag.name)}</span>
          ${tag.isOfficial ? '<span class="official-badge">官方</span>' : ''}
        </div>
      `).join('');
      
      tagSelectorList.innerHTML = tagsHTML;
    } else {
      const tagSelector = document.querySelector('.tag-selector');
      if (tagSelector) {
        tagSelector.innerHTML = `
          <div class="empty-tags">
            <p>暂无可用标签</p>
            <button type="button" class="btn-secondary btn-sm" onclick="window.app.getManager('community').communityTags.showCreateTagModal()">
              创建标签
            </button>
          </div>
        `;
      }
    }
  }

  // 🆕 新增方法：检查空标签状态
  checkEmptyTagsState() {
    const myTagsList = document.querySelector('#manageMyTagsModal .my-tags-list');
    if (myTagsList && myTagsList.children.length === 0) {
      const modalBody = document.querySelector('#manageMyTagsModal .modal-body');
      if (modalBody) {
        modalBody.innerHTML = `
          <div class="empty-state">
            <span style="font-size: 3rem;">📂</span>
            <p>您还没有创建过标签</p>
            <button class="btn-primary" onclick="document.getElementById('manageMyTagsModal').remove(); window.app.getManager('community').communityTags.showCreateTagModal();">
              立即创建标签
            </button>
          </div>
        `;
      }
    }
    
    // 更新标题中的数量
    const modalHeader = document.querySelector('#manageMyTagsModal .modal-header h2');
    if (modalHeader) {
      const newCount = myTagsList ? myTagsList.children.length : 0;
      modalHeader.textContent = `⚙️ 管理我的标签 (${newCount})`;
    }
  }

  // 🆕 显示管理我的标签弹窗
  showManageMyTagsModal() {
    if (!this.app.getCurrentUser()) {
        showToast('请先登录', 'error');
        return;
    }

    // 获取我创建的标签
    const myTags = this.availableTags.filter(tag => 
        tag.creator && tag.creator.id === this.app.getCurrentUser().id
    );

    const modalHTML = `
        <div id="manageMyTagsModal" class="modal" style="display: block;">
            <div class="modal-content large">
                <span class="close" onclick="document.getElementById('manageMyTagsModal').remove()">&times;</span>
                <div class="modal-header">
                    <h2>⚙️ 管理我的标签 (${myTags.length})</h2>
                    <p>管理您创建的标签，已被使用的标签不能删除</p>
                </div>
                
                <div class="modal-body">
                    ${myTags.length > 0 ? `
                        <div class="my-tags-list">
                            ${myTags.map(tag => this.renderMyTagItem(tag)).join('')}
                        </div>
                    ` : `
                        <div class="empty-state">
                            <span style="font-size: 3rem;">🏷️</span>
                            <p>您还没有创建过标签</p>
                            <button class="btn-primary" onclick="document.getElementById('manageMyTagsModal').remove(); window.app.getManager('community').communityTags.showCreateTagModal();">
                                立即创建标签
                            </button>
                        </div>
                    `}
                </div>
                
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('manageMyTagsModal').remove()">
                        关闭
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  // 🆕 渲染我的标签项目
  renderMyTagItem(tag) {
    const canDelete = (tag.usageCount || 0) === 0;
    
    return `
        <div class="my-tag-item" data-tag-id="${tag.id}">
            <div class="tag-item-header">
                <div class="tag-item-info">
                    <span class="tag-name" style="color: ${tag.color || '#3b82f6'}">${escapeHtml(tag.name)}</span>
                    ${tag.isOfficial ? '<span class="badge official">官方</span>' : ''}
                </div>
                <div class="tag-item-stats">
                    <span class="usage-count">使用次数: ${tag.usageCount || 0}</span>
                </div>
            </div>
            
            ${tag.description ? `
                <div class="tag-item-description">
                    ${escapeHtml(tag.description)}
                </div>
            ` : ''}
            
            <div class="tag-item-actions">
                <button class="action-btn secondary" onclick="window.app.getManager('community').communitySources.showTagSourcesModal('${tag.id}', '${escapeHtml(tag.name)}')">
                    <span>👁️</span>
                    <span>查看使用的搜索源</span>
                </button>
                <button class="action-btn tertiary" onclick="window.app.getManager('community').communityTags.showEditTagModal('${tag.id}')">
                    <span>✏️</span>
                    <span>编辑</span>
                </button>
                ${canDelete ? `
                    <button class="action-btn danger" onclick="window.app.getManager('community').communityTags.confirmDeleteTag('${tag.id}', '${escapeHtml(tag.name)}')">
                        <span>🗑️</span>
                        <span>删除</span>
                    </button>
                ` : `
                    <span class="disabled-action" title="标签正在被使用中，无法删除">
                        🚫 无法删除
                    </span>
                `}
            </div>
        </div>
    `;
  }

  // 🆕 渲染标签选择器
  renderTagSelector() {
    if (!this.availableTags || this.availableTags.length === 0) {
        return `
            <div class="tag-selector">
                <div class="empty-tags">
                    <p>暂无可用标签</p>
                    <button type="button" class="btn-secondary btn-sm" onclick="window.app.getManager('community').communityTags.showCreateTagModal()">
                        创建标签
                    </button>
                </div>
            </div>
        `;
    }

    const tagsHTML = this.availableTags.map(tag => `
        <div class="tag-selector-item" data-tag-id="${tag.id}" onclick="this.classList.toggle('selected'); this.querySelector('input[type=checkbox]').checked = this.classList.contains('selected'); window.app.getManager('community').communitySources.updateSelectedTags()">
            <input type="checkbox" value="${tag.id}" name="selectedTags" style="display: none;">
            <span class="tag-name" style="color: ${tag.color || '#3b82f6'}">${escapeHtml(tag.name)}</span>
            ${tag.isOfficial ? '<span class="official-badge">官方</span>' : ''}
        </div>
    `).join('');

    return `
        <div class="tag-selector">
            <div class="tag-selector-header">
                <input type="text" class="tag-selector-search" placeholder="搜索标签..." onkeyup="window.app.getManager('community').communitySources.filterTags(this.value)">
                <button type="button" class="btn-secondary btn-sm" onclick="window.app.getManager('community').communityTags.showCreateTagModal()">
                    + 创建标签
                </button>
            </div>
            <div class="tag-selector-list" id="tagSelectorList">
                ${tagsHTML}
            </div>
            <div class="selected-tags-display" id="selectedTagsDisplay">
                <span class="placeholder">未选择标签</span>
            </div>
        </div>
    `;
  }

  // 🆕 渲染编辑时的标签选择器（预选已有标签）
  renderEditTagSelector(selectedTags = []) {
    if (!this.availableTags || this.availableTags.length === 0) {
      return `
        <div class="tag-selector">
          <div class="empty-tags">
            <p>暂无可用标签</p>
            <button type="button" class="btn-secondary btn-sm" onclick="window.app.getManager('community').communityTags.showCreateTagModal()">
              创建标签
            </button>
          </div>
        </div>
      `;
    }

    // 获取已选中标签的ID列表
    const selectedTagIds = Array.isArray(selectedTags) ? 
      selectedTags.map(tag => typeof tag === 'object' ? tag.id : tag) : [];

    const tagsHTML = this.availableTags.map(tag => {
      const isSelected = selectedTagIds.includes(tag.id);
      return `
        <div class="tag-selector-item ${isSelected ? 'selected' : ''}" 
             data-tag-id="${tag.id}" 
             onclick="this.classList.toggle('selected'); this.querySelector('input[type=checkbox]').checked = this.classList.contains('selected'); window.app.getManager('community').communitySources.updateSelectedTags()">
          <input type="checkbox" value="${tag.id}" name="selectedTags" ${isSelected ? 'checked' : ''} style="display: none;">
          <span class="tag-name" style="color: ${tag.color || '#3b82f6'}">${escapeHtml(tag.name)}</span>
          ${tag.isOfficial ? '<span class="official-badge">官方</span>' : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="tag-selector">
        <div class="tag-selector-header">
          <input type="text" class="tag-selector-search" placeholder="搜索标签..." onkeyup="window.app.getManager('community').communitySources.filterTags(this.value)">
          <button type="button" class="btn-secondary btn-sm" onclick="window.app.getManager('community').communityTags.showCreateTagModal()">
            + 创建标签
          </button>
        </div>
        <div class="tag-selector-list" id="tagSelectorList">
          ${tagsHTML}
        </div>
        <div class="selected-tags-display" id="selectedTagsDisplay">
          ${this.renderSelectedTagsDisplay(selectedTags)}
        </div>
      </div>
    `;
  }

  // 🆕 渲染已选中标签显示
  renderSelectedTagsDisplay(selectedTags) {
    if (!selectedTags || selectedTags.length === 0) {
      return '<span class="placeholder">未选择标签</span>';
    }

    return selectedTags.map(tag => {
      const tagData = typeof tag === 'object' ? tag : 
        this.availableTags.find(t => t.id === tag) || { id: tag, name: tag };
      
      return `
        <span class="selected-tag-item">
          ${escapeHtml(tagData.name)}
          <button type="button" class="selected-tag-remove" onclick="window.app.getManager('community').communitySources.removeSelectedTag('${tagData.id}')">×</button>
        </span>
      `;
    }).join('');
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

  // 获取所有可用标签
  getAvailableTags() {
    return this.availableTags;
  }

  // 获取热门标签
  getPopularTags() {
    return this.popularTags;
  }
}

export default CommunityTagsManager;