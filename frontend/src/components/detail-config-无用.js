// src/components/detail-config.js - 详情提取配置管理组件
// 与后端 detail-config-service.js 和前端 detail-config-api.js 完全集成

import { showToast, showLoading } from '../utils/dom.js';
import { escapeHtml } from '../utils/format.js';
import { validateConfig } from '../utils/validation.js';
import detailConfigAPI from '../services/detail-config-api.js';
import authManager from '../services/auth.js';
import {
  CONFIG_FIELD_GROUPS,
  CONFIG_PRESETS,
  DEFAULT_USER_CONFIG,
  CONFIG_VALIDATION_RULES,
  detectConfigChanges
} from '../core/detail-config.js';

export class DetailConfigManager {
  constructor() {
    this.isInitialized = false;
    this.currentConfig = { ...DEFAULT_USER_CONFIG };
    this.originalConfig = null;
    this.hasUnsavedChanges = false;
    this.validationErrors = [];
    this.validationWarnings = [];
    
    // UI元素引用
    this.container = null;
    this.configForm = null;
    this.presetSelector = null;
    this.saveButton = null;
    this.resetButton = null;
    this.previewContainer = null;
    
    // 配置变更监听器
    this.changeListeners = new Set();
    this.validationTimer = null;
    
    // 实时预览相关
    this.previewEnabled = true;
    this.previewDebounceTimer = null;
  }

  async init(containerId = 'detailConfigContainer') {
    if (this.isInitialized) return;

    try {
      this.container = document.getElementById(containerId);
      if (!this.container) {
        throw new Error(`配置容器元素未找到: ${containerId}`);
      }

      // 检查用户认证状态
      if (!authManager.isAuthenticated()) {
        this.renderUnauthenticatedView();
        return;
      }

      // 显示加载状态
      this.renderLoadingView();

      // 加载用户配置
      await this.loadUserConfig();

      // 渲染配置界面
      this.renderConfigInterface();

      // 绑定事件
      this.bindEvents();

      // 初始化表单验证
      this.initFormValidation();

      this.isInitialized = true;
      console.log('详情配置管理组件初始化完成');

    } catch (error) {
      console.error('详情配置管理组件初始化失败:', error);
      this.renderErrorView(error.message);
      throw error;
    }
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig() {
    try {
      const configData = await detailConfigAPI.getUserConfig();
      
      this.currentConfig = { ...configData.config };
      this.originalConfig = { ...configData.config };
      this.hasUnsavedChanges = false;
      
      // 存储配置元数据
      this.configMetadata = configData.metadata;
      this.availablePresets = configData.presets || CONFIG_PRESETS;
      this.usageStats = configData.usage;
      this.isUsingDefault = configData.isDefault;
      
      console.log('用户配置加载完成:', this.currentConfig);
      
    } catch (error) {
      console.error('加载用户配置失败:', error);
      // 使用默认配置作为后备
      this.currentConfig = { ...DEFAULT_USER_CONFIG };
      this.originalConfig = { ...DEFAULT_USER_CONFIG };
      this.isUsingDefault = true;
      
      showToast('加载配置失败，使用默认配置', 'warning');
    }
  }

  /**
   * 渲染配置界面
   */
  renderConfigInterface() {
    this.container.innerHTML = `
      <div class="detail-config-manager">
        <!-- 配置头部 -->
        <div class="config-header">
          <div class="config-title">
            <h2>详情提取配置</h2>
            <div class="config-status">
              ${this.isUsingDefault ? 
                '<span class="status-badge default">使用默认配置</span>' : 
                '<span class="status-badge custom">自定义配置</span>'
              }
            </div>
          </div>
          
          <div class="config-actions">
            <select class="config-preset-selector" id="presetSelector">
              <option value="">选择预设配置...</option>
              ${Object.entries(this.availablePresets).map(([key, preset]) => `
                <option value="${key}">${preset.name}</option>
              `).join('')}
            </select>
            
            <button class="btn btn-secondary" id="resetConfigBtn" title="重置为默认配置">
              重置配置
            </button>
            
            <button class="btn btn-primary" id="saveConfigBtn" disabled>
              保存配置
            </button>
          </div>
        </div>

        <!-- 配置警告/错误提示 -->
        <div class="config-alerts" id="configAlerts" style="display: none;"></div>

        <!-- 配置主体 -->
        <div class="config-body">
          <!-- 配置表单 -->
          <div class="config-form-container">
            <form class="config-form" id="configForm">
              ${this.renderConfigGroups()}
            </form>
          </div>

          <!-- 配置预览 -->
          <div class="config-preview-container">
            <div class="config-preview" id="configPreview">
              ${this.renderConfigPreview()}
            </div>
          </div>
        </div>

        <!-- 配置底部信息 -->
        <div class="config-footer">
          ${this.renderConfigFooter()}
        </div>
      </div>
    `;

    // 获取UI元素引用
    this.configForm = this.container.querySelector('#configForm');
    this.presetSelector = this.container.querySelector('#presetSelector');
    this.saveButton = this.container.querySelector('#saveConfigBtn');
    this.resetButton = this.container.querySelector('#resetConfigBtn');
    this.previewContainer = this.container.querySelector('#configPreview');
    this.alertsContainer = this.container.querySelector('#configAlerts');

    // 填充当前配置值
    this.populateFormValues();
  }

  /**
   * 渲染配置组
   */
  renderConfigGroups() {
    return CONFIG_FIELD_GROUPS.map(group => `
      <div class="config-group" data-group-id="${group.id}">
        <div class="config-group-header">
          <h3 class="group-title">
            <span class="group-icon">${group.icon || '⚙️'}</span>
            ${group.name}
          </h3>
          <p class="group-description">${group.description}</p>
        </div>
        
        <div class="config-group-fields">
          ${group.fields.map(field => this.renderConfigField(field)).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * 渲染单个配置字段
   */
  renderConfigField(field) {
    const value = this.currentConfig[field.key];
    const fieldId = `config_${field.key}`;
    const isDisabled = field.dependency && !this.currentConfig[field.dependency];
    
    let fieldHTML = '';
    
    switch (field.type) {
      case 'boolean':
        fieldHTML = `
          <div class="form-field ${isDisabled ? 'disabled' : ''}" data-field="${field.key}">
            <div class="checkbox-field">
              <input type="checkbox" 
                     id="${fieldId}" 
                     name="${field.key}"
                     ${value ? 'checked' : ''} 
                     ${isDisabled ? 'disabled' : ''}
                     data-field-type="boolean">
              <label for="${fieldId}" class="checkbox-label">
                <span class="checkbox-custom"></span>
                <span class="field-name">${field.name}</span>
              </label>
            </div>
            <div class="field-description">${field.description}</div>
            ${field.dependency ? `<div class="field-dependency">需要启用: ${this.getFieldName(field.dependency)}</div>` : ''}
          </div>
        `;
        break;
        
      case 'number':
        fieldHTML = `
          <div class="form-field ${isDisabled ? 'disabled' : ''}" data-field="${field.key}">
            <label for="${fieldId}" class="field-label">${field.name}</label>
            <div class="number-field">
              <input type="number" 
                     id="${fieldId}" 
                     name="${field.key}"
                     value="${value}" 
                     min="${field.min || 0}"
                     max="${field.max || 999999}"
                     step="${field.step || 1}"
                     ${isDisabled ? 'disabled' : ''}
                     data-field-type="number">
              <div class="field-range">
                <span class="range-min">${field.min || 0}</span>
                <input type="range" 
                       class="range-slider"
                       min="${field.min || 0}"
                       max="${field.max || 999999}"
                       step="${field.step || 1}"
                       value="${value}"
                       ${isDisabled ? 'disabled' : ''}>
                <span class="range-max">${field.max || 999999}</span>
              </div>
            </div>
            <div class="field-description">${field.description}</div>
            ${field.dependency ? `<div class="field-dependency">需要启用: ${this.getFieldName(field.dependency)}</div>` : ''}
          </div>
        `;
        break;
        
      case 'array':
        const arrayValue = Array.isArray(value) ? value : [];
        fieldHTML = `
          <div class="form-field ${isDisabled ? 'disabled' : ''}" data-field="${field.key}">
            <label for="${fieldId}" class="field-label">${field.name}</label>
            <div class="array-field">
              <div class="array-items" id="${fieldId}_items">
                ${arrayValue.map((item, index) => `
                  <div class="array-item">
                    <input type="text" value="${escapeHtml(item)}" class="array-item-input">
                    <button type="button" class="remove-item-btn" onclick="this.parentElement.remove(); window.detailConfigManager.updateArrayField('${field.key}')">×</button>
                  </div>
                `).join('')}
              </div>
              <button type="button" class="add-item-btn" onclick="window.detailConfigManager.addArrayItem('${field.key}')">
                添加项目
              </button>
            </div>
            <div class="field-description">${field.description}</div>
            ${field.dependency ? `<div class="field-dependency">需要启用: ${this.getFieldName(field.dependency)}</div>` : ''}
          </div>
        `;
        break;
        
      default:
        fieldHTML = `
          <div class="form-field ${isDisabled ? 'disabled' : ''}" data-field="${field.key}">
            <label for="${fieldId}" class="field-label">${field.name}</label>
            <input type="text" 
                   id="${fieldId}" 
                   name="${field.key}"
                   value="${escapeHtml(value || '')}" 
                   ${isDisabled ? 'disabled' : ''}
                   data-field-type="text">
            <div class="field-description">${field.description}</div>
            ${field.dependency ? `<div class="field-dependency">需要启用: ${this.getFieldName(field.dependency)}</div>` : ''}
          </div>
        `;
    }
    
    return fieldHTML;
  }

  /**
   * 渲染配置预览
   */
  renderConfigPreview() {
    const performance = this.calculateConfigPerformance();
    const compatibility = this.checkConfigCompatibility();
    const recommendations = this.getConfigRecommendations();
    
    return `
      <div class="config-preview-content">
        <h3>配置预览</h3>
        
        <!-- 性能评估 -->
        <div class="preview-section performance-assessment">
          <h4>性能评估</h4>
          <div class="performance-metrics">
            <div class="metric-item">
              <span class="metric-label">预期性能:</span>
              <span class="metric-value ${performance.level}">${performance.text}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">资源使用:</span>
              <span class="metric-value">${performance.resourceUsage}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">并发处理:</span>
              <span class="metric-value">${this.currentConfig.enableConcurrentExtraction ? this.currentConfig.maxConcurrentExtractions + ' 个' : '禁用'}</span>
            </div>
          </div>
        </div>

        <!-- 功能状态 -->
        <div class="preview-section feature-status">
          <h4>功能状态</h4>
          <div class="feature-list">
            <div class="feature-item ${this.currentConfig.enableDetailExtraction ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.currentConfig.enableDetailExtraction ? '✅' : '❌'}</span>
              <span class="feature-name">详情提取</span>
            </div>
            <div class="feature-item ${this.currentConfig.autoExtractDetails ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.currentConfig.autoExtractDetails ? '✅' : '❌'}</span>
              <span class="feature-name">自动提取</span>
            </div>
            <div class="feature-item ${this.currentConfig.enableCache ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.currentConfig.enableCache ? '✅' : '❌'}</span>
              <span class="feature-name">缓存功能</span>
            </div>
            <div class="feature-item ${this.currentConfig.enableRetry ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.currentConfig.enableRetry ? '✅' : '❌'}</span>
              <span class="feature-name">重试机制</span>
            </div>
          </div>
        </div>

        <!-- 兼容性检查 -->
        <div class="preview-section compatibility-check">
          <h4>兼容性检查</h4>
          <div class="compatibility-status ${compatibility.level}">
            <span class="status-icon">${compatibility.icon}</span>
            <span class="status-text">${compatibility.message}</span>
          </div>
        </div>

        <!-- 配置建议 -->
        ${recommendations.length > 0 ? `
          <div class="preview-section config-recommendations">
            <h4>配置建议</h4>
            <div class="recommendations-list">
              ${recommendations.map(rec => `
                <div class="recommendation-item ${rec.type}">
                  <span class="rec-icon">${rec.icon}</span>
                  <div class="rec-content">
                    <span class="rec-message">${rec.message}</span>
                    ${rec.suggestion ? `<span class="rec-suggestion">${rec.suggestion}</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 渲染配置底部信息
   */
  renderConfigFooter() {
    return `
      <div class="config-footer-content">
        <div class="config-stats">
          ${this.usageStats ? `
            <div class="stat-item">
              <span class="stat-label">总提取次数:</span>
              <span class="stat-value">${this.usageStats.totalExtractions}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">成功率:</span>
              <span class="stat-value">${this.usageStats.successRate}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">缓存命中率:</span>
              <span class="stat-value">${this.usageStats.cacheHitRate}%</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">平均用时:</span>
              <span class="stat-value">${this.usageStats.averageTime}ms</span>
            </div>
          ` : ''}
        </div>
        
        <div class="config-help">
          <button class="btn btn-link" onclick="window.detailConfigManager.showConfigHelp()">
            配置帮助
          </button>
          <button class="btn btn-link" onclick="window.detailConfigManager.exportConfig()">
            导出配置
          </button>
          <button class="btn btn-link" onclick="window.detailConfigManager.importConfig()">
            导入配置
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 填充表单值
   */
  populateFormValues() {
    if (!this.configForm) return;
    
    Object.entries(this.currentConfig).forEach(([key, value]) => {
      const field = this.configForm.querySelector(`[name="${key}"]`);
      if (!field) return;
      
      const fieldType = field.dataset.fieldType || field.type;
      
      switch (fieldType) {
        case 'boolean':
          field.checked = Boolean(value);
          break;
        case 'number':
          field.value = value;
          // 同步滑块值
          const slider = field.parentElement.querySelector('.range-slider');
          if (slider) slider.value = value;
          break;
        default:
          field.value = value || '';
      }
    });
    
    // 更新依赖字段状态
    this.updateDependencyStates();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    if (!this.configForm) return;
    
    // 表单字段变更事件
    this.configForm.addEventListener('input', (e) => {
      this.handleFieldChange(e);
    });
    
    this.configForm.addEventListener('change', (e) => {
      this.handleFieldChange(e);
    });
    
    // 预设选择事件
    if (this.presetSelector) {
      this.presetSelector.addEventListener('change', (e) => {
        if (e.target.value) {
          this.applyPreset(e.target.value);
        }
      });
    }
    
    // 保存按钮事件
    if (this.saveButton) {
      this.saveButton.addEventListener('click', () => {
        this.saveConfiguration();
      });
    }
    
    // 重置按钮事件
    if (this.resetButton) {
      this.resetButton.addEventListener('click', () => {
        this.resetConfiguration();
      });
    }
    
    // 滑块同步事件
    const sliders = this.configForm.querySelectorAll('.range-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const input = e.target.parentElement.querySelector('input[type="number"]');
        if (input) {
          input.value = e.target.value;
          this.handleFieldChange({ target: input });
        }
      });
    });
    
    // 数组字段项目移除事件委托
    this.configForm.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-item-btn')) {
        e.preventDefault();
        const fieldKey = e.target.closest('[data-field]').dataset.field;
        setTimeout(() => this.updateArrayField(fieldKey), 0);
      }
    });
    
    // 暴露全局方法
    window.detailConfigManager = {
      addArrayItem: (fieldKey) => this.addArrayItem(fieldKey),
      updateArrayField: (fieldKey) => this.updateArrayField(fieldKey),
      showConfigHelp: () => this.showConfigHelp(),
      exportConfig: () => this.exportConfig(),
      importConfig: () => this.importConfig()
    };
  }

  /**
   * 处理字段变更
   */
  handleFieldChange(event) {
    const field = event.target;
    const fieldName = field.name;
    const fieldType = field.dataset.fieldType || field.type;
    
    if (!fieldName) return;
    
    let newValue;
    
    switch (fieldType) {
      case 'boolean':
        newValue = field.checked;
        break;
      case 'number':
        newValue = parseInt(field.value) || 0;
        break;
      default:
        newValue = field.value;
    }
    
    // 更新配置
    this.currentConfig[fieldName] = newValue;
    
    // 检查是否有变更
    this.checkForChanges();
    
    // 更新依赖字段状态
    this.updateDependencyStates();
    
    // 实时验证
    this.validateConfigField(fieldName, newValue);
    
    // 更新预览
    this.updatePreview();
    
    // 触发变更事件
    this.notifyConfigChange();
  }

  /**
   * 应用预设配置
   */
  async applyPreset(presetKey) {
    if (!this.availablePresets[presetKey]) {
      showToast('未知的预设配置', 'error');
      return;
    }
    
    try {
      const preset = this.availablePresets[presetKey];
      
      if (this.hasUnsavedChanges) {
        const confirmed = confirm('当前有未保存的配置更改，应用预设将丢失这些更改。确定继续吗？');
        if (!confirmed) {
          this.presetSelector.value = '';
          return;
        }
      }
      
      showLoading(true);
      showToast(`正在应用 ${preset.name} 预设配置...`, 'info');
      
      const result = await detailConfigAPI.applyPreset(presetKey);
      
      if (result.config) {
        this.currentConfig = { ...result.config };
        this.populateFormValues();
        this.updatePreview();
        this.checkForChanges();
        
        showToast(`${preset.name} 预设配置已应用`, 'success');
      }
      
    } catch (error) {
      console.error('应用预设配置失败:', error);
      showToast('应用预设失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
      this.presetSelector.value = '';
    }
  }

  /**
   * 保存配置
   */
  async saveConfiguration() {
    try {
      showLoading(true);
      
      // 先进行完整验证
      const validation = await this.validateFullConfig();
      if (!validation.valid) {
        this.showValidationErrors(validation.errors);
        return;
      }
      
      // 显示警告（如果有）
      if (validation.warnings.length > 0) {
        const proceed = confirm(`配置验证通过，但有以下警告：\n${validation.warnings.join('\n')}\n\n确定要保存吗？`);
        if (!proceed) return;
      }
      
      showToast('正在保存配置...', 'info');
      
      const result = await detailConfigAPI.updateUserConfig(this.currentConfig);
      
      if (result.valid) {
        this.originalConfig = { ...this.currentConfig };
        this.hasUnsavedChanges = false;
        this.updateSaveButtonState();
        
        // 显示保存结果
        let message = '配置保存成功';
        if (result.warnings && result.warnings.length > 0) {
          message += `\n注意: ${result.warnings.join(', ')}`;
        }
        
        showToast(message, 'success');
        
        // 触发配置变更事件
        this.notifyConfigSaved();
      }
      
    } catch (error) {
      console.error('保存配置失败:', error);
      showToast('保存配置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 重置配置
   */
  async resetConfiguration() {
    if (!confirm('确定要重置为默认配置吗？这将丢失所有自定义设置。')) {
      return;
    }
    
    try {
      showLoading(true);
      showToast('正在重置配置...', 'info');
      
      const result = await detailConfigAPI.resetConfig();
      
      if (result.config) {
        this.currentConfig = { ...result.config };
        this.originalConfig = { ...result.config };
        this.hasUnsavedChanges = false;
        this.isUsingDefault = true;
        
        this.populateFormValues();
        this.updatePreview();
        this.updateSaveButtonState();
        
        showToast('配置已重置为默认值', 'success');
        
        // 触发配置变更事件
        this.notifyConfigSaved();
      }
      
    } catch (error) {
      console.error('重置配置失败:', error);
      showToast('重置配置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 检查配置变更
   */
  checkForChanges() {
    const changes = detectConfigChanges(this.originalConfig, this.currentConfig);
    this.hasUnsavedChanges = changes.changed.length > 0 || changes.added.length > 0 || changes.removed.length > 0;
    this.updateSaveButtonState();
  }

  /**
   * 更新保存按钮状态
   */
  updateSaveButtonState() {
    if (this.saveButton) {
      this.saveButton.disabled = !this.hasUnsavedChanges || this.validationErrors.length > 0;
      this.saveButton.textContent = this.hasUnsavedChanges ? '保存配置 *' : '保存配置';
    }
  }

  /**
   * 更新依赖字段状态
   */
  updateDependencyStates() {
    CONFIG_FIELD_GROUPS.forEach(group => {
      group.fields.forEach(field => {
        if (field.dependency) {
          const fieldElement = this.configForm.querySelector(`[data-field="${field.key}"]`);
          const isEnabled = this.currentConfig[field.dependency];
          
          if (fieldElement) {
            fieldElement.classList.toggle('disabled', !isEnabled);
            const inputs = fieldElement.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
              input.disabled = !isEnabled;
            });
          }
        }
      });
    });
  }

  /**
   * 验证单个配置字段
   */
  validateConfigField(fieldName, value) {
    const errors = [];
    const warnings = [];
    
    // 获取字段定义
    const fieldDef = this.getFieldDefinition(fieldName);
    if (!fieldDef) return { valid: true, errors, warnings };
    
    // 基础验证
    switch (fieldDef.type) {
      case 'number':
        if (fieldDef.min !== undefined && value < fieldDef.min) {
          errors.push(`${fieldDef.name} 不能小于 ${fieldDef.min}`);
        }
        if (fieldDef.max !== undefined && value > fieldDef.max) {
          errors.push(`${fieldDef.name} 不能大于 ${fieldDef.max}`);
        }
        break;
    }
    
    // 业务逻辑验证
    const businessValidation = this.validateBusinessLogic(fieldName, value);
    errors.push(...businessValidation.errors);
    warnings.push(...businessValidation.warnings);
    
    // 更新字段验证状态
    this.updateFieldValidationState(fieldName, errors, warnings);
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * 验证完整配置
   */
  async validateFullConfig() {
    try {
      const validation = detailConfigAPI.validateConfig(this.currentConfig);
      
      this.validationErrors = validation.errors || [];
      this.validationWarnings = validation.warnings || [];
      
      this.updateValidationDisplay();
      
      return validation;
    } catch (error) {
      console.error('配置验证失败:', error);
      return {
        valid: false,
        errors: ['配置验证失败: ' + error.message],
        warnings: []
      };
    }
  }

  /**
   * 业务逻辑验证
   */
  validateBusinessLogic(fieldName, value) {
    const errors = [];
    const warnings = [];
    
    switch (fieldName) {
      case 'extractionTimeout':
        if (value > 20000) {
          warnings.push('提取超时时间过长可能影响用户体验');
        }
        break;
        
      case 'extractionBatchSize':
        if (value > 10) {
          warnings.push('批量大小过大可能导致请求阻塞');
        }
        break;
        
      case 'maxAutoExtractions':
        if (value > 8 && this.currentConfig.autoExtractDetails) {
          warnings.push('自动提取数量过多可能影响页面加载');
        }
        break;
        
      case 'autoExtractDetails':
        if (value && !this.currentConfig.enableDetailExtraction) {
          errors.push('启用自动提取需要先启用详情提取功能');
        }
        break;
        
      case 'enableLocalCache':
        if (value && !this.currentConfig.enableCache) {
          errors.push('启用本地缓存需要先启用缓存功能');
        }
        break;
        
      case 'maxRetryAttempts':
        if (value && !this.currentConfig.enableRetry) {
          warnings.push('设置了重试次数但未启用重试功能');
        }
        break;
    }
    
    return { errors, warnings };
  }

  /**
   * 更新字段验证状态
   */
  updateFieldValidationState(fieldName, errors, warnings) {
    const fieldElement = this.configForm.querySelector(`[data-field="${fieldName}"]`);
    if (!fieldElement) return;
    
    // 清除之前的验证状态
    fieldElement.classList.remove('field-error', 'field-warning');
    
    // 移除之前的验证消息
    const existingMessages = fieldElement.querySelectorAll('.validation-message');
    existingMessages.forEach(msg => msg.remove());
    
    // 添加新的验证状态和消息
    if (errors.length > 0) {
      fieldElement.classList.add('field-error');
      const errorMessage = document.createElement('div');
      errorMessage.className = 'validation-message error';
      errorMessage.textContent = errors.join(', ');
      fieldElement.appendChild(errorMessage);
    } else if (warnings.length > 0) {
      fieldElement.classList.add('field-warning');
      const warningMessage = document.createElement('div');
      warningMessage.className = 'validation-message warning';
      warningMessage.textContent = warnings.join(', ');
      fieldElement.appendChild(warningMessage);
    }
  }

  /**
   * 更新验证显示
   */
  updateValidationDisplay() {
    if (!this.alertsContainer) return;
    
    const hasErrors = this.validationErrors.length > 0;
    const hasWarnings = this.validationWarnings.length > 0;
    
    if (!hasErrors && !hasWarnings) {
      this.alertsContainer.style.display = 'none';
      return;
    }
    
    let alertsHTML = '';
    
    if (hasErrors) {
      alertsHTML += `
        <div class="config-alert error">
          <div class="alert-icon">⚠️</div>
          <div class="alert-content">
            <h4>配置错误</h4>
            <ul>
              ${this.validationErrors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
    
    if (hasWarnings) {
      alertsHTML += `
        <div class="config-alert warning">
          <div class="alert-icon">💡</div>
          <div class="alert-content">
            <h4>配置警告</h4>
            <ul>
              ${this.validationWarnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }
    
    this.alertsContainer.innerHTML = alertsHTML;
    this.alertsContainer.style.display = 'block';
  }

  /**
   * 更新预览
   */
  updatePreview() {
    if (!this.previewContainer || !this.previewEnabled) return;
    
    // 防抖更新
    clearTimeout(this.previewDebounceTimer);
    this.previewDebounceTimer = setTimeout(() => {
      this.previewContainer.innerHTML = this.renderConfigPreview();
    }, 300);
  }

  /**
   * 计算配置性能
   */
  calculateConfigPerformance() {
    let score = 0;
    let factors = [];
    
    // 超时时间影响
    if (this.currentConfig.extractionTimeout <= 10000) {
      score += 2;
      factors.push('快速超时');
    } else if (this.currentConfig.extractionTimeout <= 20000) {
      score += 1;
    } else {
      score -= 1;
      factors.push('超时时间较长');
    }
    
    // 并发影响
    if (this.currentConfig.enableConcurrentExtraction) {
      if (this.currentConfig.maxConcurrentExtractions >= 3) {
        score += 2;
        factors.push('高并发处理');
      } else {
        score += 1;
      }
    } else {
      score -= 1;
      factors.push('串行处理');
    }
    
    // 缓存影响
    if (this.currentConfig.enableCache) {
      score += 3;
      factors.push('启用缓存');
    } else {
      score -= 2;
      factors.push('禁用缓存');
    }
    
    // 批量大小影响
    if (this.currentConfig.extractionBatchSize <= 3) {
      score += 1;
    } else if (this.currentConfig.extractionBatchSize > 5) {
      score -= 1;
      factors.push('批量较大');
    }
    
    // 自动提取影响
    if (this.currentConfig.autoExtractDetails) {
      if (this.currentConfig.maxAutoExtractions > 8) {
        score -= 1;
        factors.push('自动提取过多');
      }
    }
    
    let level, text, resourceUsage;
    
    if (score >= 5) {
      level = 'excellent';
      text = '优秀';
      resourceUsage = '低';
    } else if (score >= 2) {
      level = 'good';
      text = '良好';
      resourceUsage = '中等';
    } else if (score >= 0) {
      level = 'fair';
      text = '一般';
      resourceUsage = '中等';
    } else {
      level = 'poor';
      text = '较差';
      resourceUsage = '高';
    }
    
    return { level, text, resourceUsage, score, factors };
  }

  /**
   * 检查配置兼容性
   */
  checkConfigCompatibility() {
    const issues = [];
    
    // 检查依赖关系
    if (this.currentConfig.autoExtractDetails && !this.currentConfig.enableDetailExtraction) {
      issues.push('自动提取需要启用详情提取');
    }
    
    if (this.currentConfig.enableLocalCache && !this.currentConfig.enableCache) {
      issues.push('本地缓存需要启用缓存功能');
    }
    
    if (this.currentConfig.maxRetryAttempts > 0 && !this.currentConfig.enableRetry) {
      issues.push('重试次数设置但未启用重试');
    }
    
    // 检查合理性
    if (this.currentConfig.enableConcurrentExtraction && this.currentConfig.maxConcurrentExtractions === 1) {
      issues.push('启用并发但并发数为1');
    }
    
    if (issues.length === 0) {
      return {
        level: 'compatible',
        icon: '✅',
        message: '配置兼容性良好'
      };
    } else if (issues.length <= 2) {
      return {
        level: 'warning',
        icon: '⚠️',
        message: `发现 ${issues.length} 个兼容性问题`
      };
    } else {
      return {
        level: 'error',
        icon: '❌',
        message: `发现 ${issues.length} 个兼容性问题，可能影响功能`
      };
    }
  }

  /**
   * 获取配置建议
   */
  getConfigRecommendations() {
    const recommendations = [];
    
    // 性能建议
    if (!this.currentConfig.enableCache) {
      recommendations.push({
        type: 'performance',
        icon: '💾',
        message: '建议启用缓存以提高性能',
        suggestion: '缓存可以显著减少重复提取的时间'
      });
    }
    
    if (this.currentConfig.extractionTimeout > 20000) {
      recommendations.push({
        type: 'performance',
        icon: '⏱️',
        message: '建议缩短提取超时时间',
        suggestion: '推荐设置为15秒以下以提升用户体验'
      });
    }
    
    if (!this.currentConfig.enableConcurrentExtraction) {
      recommendations.push({
        type: 'performance',
        icon: '⚡',
        message: '考虑启用并发提取',
        suggestion: '可以显著提升批量提取的速度'
      });
    }
    
    // 功能建议
    if (!this.currentConfig.enableRetry) {
      recommendations.push({
        type: 'reliability',
        icon: '🔄',
        message: '建议启用重试机制',
        suggestion: '可以提高提取成功率，减少临时网络问题的影响'
      });
    }
    
    if (this.currentConfig.autoExtractDetails && this.currentConfig.maxAutoExtractions > 8) {
      recommendations.push({
        type: 'usability',
        icon: '📱',
        message: '自动提取数量较多',
        suggestion: '建议减少到5个以下以避免页面加载缓慢'
      });
    }
    
    // 质量建议
    if (!this.currentConfig.requireMinimumData) {
      recommendations.push({
        type: 'quality',
        icon: '🎯',
        message: '建议启用最少数据要求',
        suggestion: '可以过滤掉质量较低的提取结果'
      });
    }
    
    return recommendations;
  }

  /**
   * 添加数组项目
   */
  addArrayItem(fieldKey) {
    const itemsContainer = document.getElementById(`config_${fieldKey}_items`);
    if (!itemsContainer) return;
    
    const newItem = document.createElement('div');
    newItem.className = 'array-item';
    newItem.innerHTML = `
      <input type="text" value="" class="array-item-input" placeholder="输入内容...">
      <button type="button" class="remove-item-btn" onclick="this.parentElement.remove(); window.detailConfigManager.updateArrayField('${fieldKey}')">×</button>
    `;
    
    itemsContainer.appendChild(newItem);
    newItem.querySelector('.array-item-input').focus();
  }

  /**
   * 更新数组字段
   */
  updateArrayField(fieldKey) {
    const itemsContainer = document.getElementById(`config_${fieldKey}_items`);
    if (!itemsContainer) return;
    
    const inputs = itemsContainer.querySelectorAll('.array-item-input');
    const values = Array.from(inputs)
      .map(input => input.value.trim())
      .filter(value => value.length > 0);
    
    this.currentConfig[fieldKey] = values;
    this.checkForChanges();
    this.validateConfigField(fieldKey, values);
    this.updatePreview();
    this.notifyConfigChange();
  }

  /**
   * 初始化表单验证
   */
  initFormValidation() {
    // 实时验证定时器
    this.validationTimer = setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.validateFullConfig();
      }
    }, 2000);
  }

  /**
   * 显示配置帮助
   */
  showConfigHelp() {
    const helpModal = document.createElement('div');
    helpModal.className = 'config-help-modal';
    helpModal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>配置帮助</h3>
            <button class="modal-close-btn" onclick="this.closest('.config-help-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="help-content">
              <h4>配置组说明</h4>
              ${CONFIG_FIELD_GROUPS.map(group => `
                <div class="help-group">
                  <h5>${group.icon} ${group.name}</h5>
                  <p>${group.description}</p>
                  <ul>
                    ${group.fields.map(field => `
                      <li><strong>${field.name}</strong>: ${field.description}</li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
              
              <h4>预设配置说明</h4>
              ${Object.entries(this.availablePresets).map(([key, preset]) => `
                <div class="help-preset">
                  <h5>${preset.icon || '⚙️'} ${preset.name}</h5>
                  <p>${preset.description}</p>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="this.closest('.config-help-modal').remove()">
              知道了
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(helpModal);
  }

  /**
   * 导出配置
   */
  async exportConfig() {
    try {
      const exportData = await detailConfigAPI.exportConfig('json');
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `detail-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      showToast('配置导出成功', 'success');
      
    } catch (error) {
      console.error('导出配置失败:', error);
      showToast('导出配置失败: ' + error.message, 'error');
    }
  }

  /**
   * 导入配置
   */
  importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.config) {
          throw new Error('无效的配置文件格式');
        }
        
        // 验证导入的配置
        const validation = detailConfigAPI.validateConfig(importData.config);
        if (!validation.valid) {
          throw new Error('导入的配置验证失败: ' + validation.errors.join(', '));
        }
        
        if (this.hasUnsavedChanges) {
          const confirmed = confirm('当前有未保存的配置更改，导入将丢失这些更改。确定继续吗？');
          if (!confirmed) return;
        }
        
        // 应用导入的配置
        this.currentConfig = { ...importData.config };
        this.populateFormValues();
        this.updatePreview();
        this.checkForChanges();
        
        showToast('配置导入成功', 'success');
        
      } catch (error) {
        console.error('导入配置失败:', error);
        showToast('导入配置失败: ' + error.message, 'error');
      }
    };
    
    input.click();
  }

  /**
   * 渲染未认证视图
   */
  renderUnauthenticatedView() {
    this.container.innerHTML = `
      <div class="config-unauthenticated">
        <div class="unauth-content">
          <h2>需要登录</h2>
          <p>详情提取配置管理需要登录后才能使用。</p>
          <div class="unauth-actions">
            <button class="btn btn-primary" onclick="window.location.href='/login'">
              立即登录
            </button>
            <button class="btn btn-secondary" onclick="window.detailConfigManager.showDefaultConfig()">
              查看默认配置
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染加载视图
   */
  renderLoadingView() {
    this.container.innerHTML = `
      <div class="config-loading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>正在加载配置...</p>
        </div>
      </div>
    `;
  }

  /**
   * 渲染错误视图
   */
  renderErrorView(errorMessage) {
    this.container.innerHTML = `
      <div class="config-error">
        <div class="error-content">
          <h2>配置加载失败</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <div class="error-actions">
            <button class="btn btn-primary" onclick="window.detailConfigManager.retry()">
              重试
            </button>
            <button class="btn btn-secondary" onclick="window.detailConfigManager.useDefaultConfig()">
              使用默认配置
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示验证错误
   */
  showValidationErrors(errors) {
    const errorMessage = errors.join('\n');
    alert(`配置验证失败：\n\n${errorMessage}`);
  }

  /**
   * 获取字段定义
   */
  getFieldDefinition(fieldName) {
    for (const group of CONFIG_FIELD_GROUPS) {
      const field = group.fields.find(f => f.key === fieldName);
      if (field) return field;
    }
    return null;
  }

  /**
   * 获取字段名称
   */
  getFieldName(fieldKey) {
    const field = this.getFieldDefinition(fieldKey);
    return field ? field.name : fieldKey;
  }

  /**
   * 通知配置变更
   */
  notifyConfigChange() {
    const event = new CustomEvent('detailConfigChanged', {
      detail: {
        config: { ...this.currentConfig },
        hasUnsavedChanges: this.hasUnsavedChanges
      }
    });
    
    document.dispatchEvent(event);
    
    // 通知监听器
    this.changeListeners.forEach(listener => {
      try {
        listener(this.currentConfig, this.hasUnsavedChanges);
      } catch (error) {
        console.error('配置变更监听器执行失败:', error);
      }
    });
  }

  /**
   * 通知配置保存
   */
  notifyConfigSaved() {
    const event = new CustomEvent('detailConfigSaved', {
      detail: {
        config: { ...this.currentConfig }
      }
    });
    
    document.dispatchEvent(event);
  }

  /**
   * 添加配置变更监听器
   */
  addChangeListener(listener) {
    if (typeof listener === 'function') {
      this.changeListeners.add(listener);
    }
  }

  /**
   * 移除配置变更监听器
   */
  removeChangeListener(listener) {
    this.changeListeners.delete(listener);
  }

  /**
   * 获取当前配置
   */
  getCurrentConfig() {
    return { ...this.currentConfig };
  }

  /**
   * 检查是否有未保存的变更
   */
  hasUnsavedConfigChanges() {
    return this.hasUnsavedChanges;
  }

  /**
   * 重试初始化
   */
  async retry() {
    this.isInitialized = false;
    await this.init(this.container.id);
  }

  /**
   * 使用默认配置
   */
  useDefaultConfig() {
    this.currentConfig = { ...DEFAULT_USER_CONFIG };
    this.originalConfig = { ...DEFAULT_USER_CONFIG };
    this.hasUnsavedChanges = false;
    this.isUsingDefault = true;
    
    this.renderConfigInterface();
    this.bindEvents();
    this.initFormValidation();
  }

  /**
   * 显示默认配置
   */
  showDefaultConfig() {
    const defaultConfig = { ...DEFAULT_USER_CONFIG };
    
    const modal = document.createElement('div');
    modal.className = 'default-config-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>默认配置预览</h3>
            <button class="modal-close-btn" onclick="this.closest('.default-config-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="default-config-preview">
              <pre>${JSON.stringify(defaultConfig, null, 2)}</pre>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="this.closest('.default-config-modal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 清理定时器
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
    
    if (this.previewDebounceTimer) {
      clearTimeout(this.previewDebounceTimer);
      this.previewDebounceTimer = null;
    }
    
    // 清理监听器
    this.changeListeners.clear();
    
    // 清理全局方法
    if (window.detailConfigManager) {
      delete window.detailConfigManager;
    }
    
    // 重置状态
    this.isInitialized = false;
    this.currentConfig = { ...DEFAULT_USER_CONFIG };
    this.originalConfig = null;
    this.hasUnsavedChanges = false;
    this.validationErrors = [];
    this.validationWarnings = [];
  }

  /**
   * 获取组件状态
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasUnsavedChanges: this.hasUnsavedChanges,
      validationErrors: this.validationErrors.length,
      validationWarnings: this.validationWarnings.length,
      isUsingDefault: this.isUsingDefault,
      changeListeners: this.changeListeners.size
    };
  }
}

// 创建全局实例
export const detailConfigManager = new DetailConfigManager();
export default detailConfigManager;