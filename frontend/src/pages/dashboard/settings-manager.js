// 修复版本的 settings-manager.js - 解决设置保存后不生效的问题
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import apiService from '../../services/api.js';
import themeManager from '../../services/theme.js';
import searchService from '../../services/search.js';

export class SettingsManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.currentSettings = {};
    this.hasUnsavedChanges = false;
    this.isLoading = false; // 🔧 添加加载状态标识
  }

  async init() {
    console.log('⚙️ 初始化设置管理器');
    this.bindEvents();
  }

  async loadData() {
    // 设置数据在切换到设置标签时加载
  }

  async loadTabData() {
    if (this.isLoading) return; // 🔧 防止重复加载
    await this.loadSettingsData();
  }

  bindEvents() {
    this.bindSettingsEvents();
    this.bindDataActionButtons();
    this.bindPasswordEvents();
    this.bindSourceStatusTestButton();
  }

  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
        
        if (input.id === 'enableSourceStatusCheck') {
          this.updateSourceStatusCheckControls();
        }
      });
      
      input.addEventListener('input', () => {
        this.markSettingsChanged();
      });
    });
  }

  bindDataActionButtons() {
    const buttonMap = {
      syncAllDataBtn: () => this.syncAllData(),
      exportDataBtn: () => this.exportData(),
      exportFavoritesBtn: () => this.exportFavorites(),
      exportSourcesBtn: () => this.exportSources(),
      exportCategoriesBtn: () => this.exportCategories(),
      clearAllHistoryBtn: () => this.clearAllHistory(),
      clearAllDataBtn: () => this.clearAllData(),
      deleteAccountBtn: () => this.deleteAccount(),
      resetSettingsBtn: () => this.resetSettings(),
      saveSettingsBtn: () => this.saveSettings()
    };

    Object.entries(buttonMap).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', handler);
    });
  }

  bindPasswordEvents() {
    const changePasswordBtn = document.querySelector('[onclick*="changePassword"]');
    if (changePasswordBtn) {
      changePasswordBtn.removeAttribute('onclick');
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }

    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }
  }

  bindSourceStatusTestButton() {
    const testBtn = document.getElementById('testSourceStatusBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testSourceStatusCheck());
    }
  }

  // 🔧 修复版本的加载设置数据方法
async loadSettingsData() {
  if (this.isLoading) return;
  
  try {
    this.isLoading = true;
    console.log('📄 开始加载设置数据...');
    
    // 🔧 清除API缓存，确保获取最新数据
    if (searchService && searchService.clearUserSettingsCache) {
      searchService.clearUserSettingsCache();
    }
    
    const settings = await apiService.getUserSettings();
    console.log('📥 从API获取的设置:', settings);
    
    this.currentSettings = settings;
    
    // 🔧 修复：只对未定义的设置使用默认值
    const processedSettings = {};
    
    // 遍历所有可能的设置项
    const allPossibleSettings = {
      ...APP_CONSTANTS.DEFAULT_USER_SETTINGS,
      ...settings
    };
    
    Object.keys(allPossibleSettings).forEach(key => {
      if (settings.hasOwnProperty(key)) {
        // 如果API返回了这个设置，使用API的值
        processedSettings[key] = settings[key];
      } else {
        // 只有API没有返回的设置才使用默认值
        processedSettings[key] = APP_CONSTANTS.DEFAULT_USER_SETTINGS[key];
      }
    });
    
    console.log('🔀 处理后的设置:', processedSettings);
    console.log('🔍 状态检查设置处理详情:', {
      API返回值: settings.checkSourceStatus,
      是否有该字段: settings.hasOwnProperty('checkSourceStatus'),
      最终使用值: processedSettings.checkSourceStatus
    });
    
    // 更新UI元素
    this.updateUIElementsDirectly(processedSettings);
    this.updateSourceStatusCheckControls();
    
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
    
    console.log('✅ 设置数据加载完成');

  } catch (error) {
    console.error('❌ 加载设置失败:', error);
    showToast('加载设置失败', 'error');
  } finally {
    this.isLoading = false;
  }
}

// 4. 添加设置保存后的验证方法
async verifySettingsSaved(expectedSettings) {
  try {
    // 等待一秒后重新获取设置进行验证
    setTimeout(async () => {
      const freshSettings = await apiService.getUserSettings();
      const isCheckSourceStatusCorrect = freshSettings.checkSourceStatus === expectedSettings.checkSourceStatus;
      
      console.log('🔍 设置保存验证:', {
        期望值: expectedSettings.checkSourceStatus,
        实际值: freshSettings.checkSourceStatus,
        验证通过: isCheckSourceStatusCorrect
      });
      
      if (!isCheckSourceStatusCorrect) {
        console.error('⚠️ 设置保存验证失败，状态检查设置未正确保存');
        showToast('设置可能未正确保存，请重试', 'warning');
      }
    }, 1000);
  } catch (error) {
    console.error('设置验证失败:', error);
  }
}

  // 🔧 新增：更新UI元素的独立方法，包含详细日志
  updateUIElements(settings) {
    const elements = {
      themeMode: document.getElementById('themeMode'),
      maxFavorites: document.getElementById('maxFavorites'),
      historyRetention: document.getElementById('historyRetention'),
      allowAnalytics: document.getElementById('allowAnalytics'),
      searchSuggestions: document.getElementById('searchSuggestions'),
      
      // 搜索源状态检查相关设置
      enableSourceStatusCheck: document.getElementById('enableSourceStatusCheck'),
      sourceCheckTimeout: document.getElementById('sourceCheckTimeout'),
      sourceStatusCacheDuration: document.getElementById('sourceStatusCacheDuration'),
      skipUnavailableSources: document.getElementById('skipUnavailableSources'),
      showSourceStatus: document.getElementById('showSourceStatus'),
      retryFailedSources: document.getElementById('retryFailedSources')
    };

    // 🔧 基本设置
    if (elements.themeMode) {
      elements.themeMode.value = settings.theme || 'auto';
      console.log('🎨 主题设置:', elements.themeMode.value);
    }
    
    if (elements.maxFavorites) {
      elements.maxFavorites.value = settings.maxFavoritesPerUser ?? 500;
    }
    
    if (elements.historyRetention) {
      elements.historyRetention.value = settings.maxHistoryPerUser ?? 90;
    }
    
    if (elements.allowAnalytics) {
      elements.allowAnalytics.checked = settings.allowAnalytics !== false;
    }
    
    if (elements.searchSuggestions) {
      elements.searchSuggestions.checked = settings.searchSuggestions !== false;
    }

    // 🔧 搜索源状态检查设置 - 添加详细日志
    if (elements.enableSourceStatusCheck) {
      const checkSourceStatus = Boolean(settings.checkSourceStatus);
      elements.enableSourceStatusCheck.checked = checkSourceStatus;
      console.log('🔍 搜索源状态检查设置:', {
        原始值: settings.checkSourceStatus,
        转换后: checkSourceStatus,
        UI状态: elements.enableSourceStatusCheck.checked
      });
    }
    
    if (elements.sourceCheckTimeout) {
      elements.sourceCheckTimeout.value = settings.sourceStatusCheckTimeout || 8000;
    }
    
    if (elements.sourceStatusCacheDuration) {
      elements.sourceStatusCacheDuration.value = (settings.sourceStatusCacheDuration || 300000) / 1000;
    }
    
    if (elements.skipUnavailableSources) {
      elements.skipUnavailableSources.checked = settings.skipUnavailableSources !== false;
    }
    
    if (elements.showSourceStatus) {
      elements.showSourceStatus.checked = settings.showSourceStatus !== false;
    }
    
    if (elements.retryFailedSources) {
      elements.retryFailedSources.checked = settings.retryFailedSources || false;
    }
  }

  updateSourceStatusCheckControls() {
    const enableCheckbox = document.getElementById('enableSourceStatusCheck');
    const dependentControls = [
      'sourceCheckTimeout',
      'sourceStatusCacheDuration', 
      'skipUnavailableSources',
      'showSourceStatus',
      'retryFailedSources'
    ];
    
    if (enableCheckbox) {
      const isEnabled = enableCheckbox.checked;
      console.log('🎛️ 更新状态检查控件，启用状态:', isEnabled);
      
      dependentControls.forEach(controlId => {
        const control = document.getElementById(controlId);
        if (control) {
          control.disabled = !isEnabled;
          const container = control.closest('.setting-item');
          if (container) {
            container.style.opacity = isEnabled ? '1' : '0.6';
          }
        }
      });
    }
  }

  // 🔧 修复版本的保存设置方法
async saveSettings() {
  if (!this.app.getCurrentUser()) {
    showToast('用户未登录', 'error');
    return;
  }

  if (this.isLoading) {
    showToast('正在处理中，请稍候...', 'warning');
    return;
  }

  try {
    showLoading(true);
    this.isLoading = true;
    
    console.log('💾 开始保存设置...');
    
    const ui = this.collectSettings();
    console.log('📝 收集的UI设置:', ui);
    
    const payload = {
      theme: ui.themeMode,
      maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
      maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10),
      allowAnalytics: !!ui.allowAnalytics,
      searchSuggestions: !!ui.searchSuggestions,
      
      // 搜索源状态检查设置 - 确保布尔值正确转换
      checkSourceStatus: !!ui.enableSourceStatusCheck,
      sourceStatusCheckTimeout: parseInt(ui.sourceCheckTimeout, 10) || 8000,
      sourceStatusCacheDuration: (parseInt(ui.sourceStatusCacheDuration, 10) || 300) * 1000,
      skipUnavailableSources: !!ui.skipUnavailableSources,
      showSourceStatus: !!ui.showSourceStatus,
      retryFailedSources: !!ui.retryFailedSources
    };
    
    console.log('📤 准备发送的设置:', payload);
    console.log('🔍 状态检查设置详情:', {
      原始UI值: ui.enableSourceStatusCheck,
      转换后值: payload.checkSourceStatus,
      类型检查: typeof payload.checkSourceStatus
    });
    
    // 验证设置
    const validation = this.validateSettings(payload);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    // 保存到API
    const response = await apiService.updateUserSettings(payload);
    console.log('📡 API保存响应:', response);
    
    // 🔧 重要：确保API响应包含我们刚才保存的设置
    if (response && response.settings) {
      // 使用API返回的设置更新本地状态
      this.currentSettings = { ...this.currentSettings, ...response.settings };
      console.log('✅ 使用API响应更新本地设置:', this.currentSettings);
    } else {
      // 如果API没有返回设置，使用我们发送的设置
      this.currentSettings = { ...this.currentSettings, ...payload };
      console.log('⚠️ API未返回设置，使用发送的设置:', this.currentSettings);
    }
    
    // 🔧 立即应用主题设置
    if (payload.theme) {
      themeManager.setTheme(payload.theme);
    }
    
    // 🔧 强制清除所有相关缓存
    if (searchService) {
      if (searchService.clearUserSettingsCache) {
        searchService.clearUserSettingsCache();
      }
      if (searchService.clearCache) {
        searchService.clearCache();
      }
      if (!payload.checkSourceStatus && searchService.clearStatusCache) {
        searchService.clearStatusCache();
      }
    }
    
    // 🔧 立即更新UI以反映保存的状态 - 不合并默认设置
    this.updateUIElementsDirectly(this.currentSettings);
    this.updateSourceStatusCheckControls();
    
    showToast('设置保存成功', 'success');
    this.markSettingsSaved();
    
    // 记录分析事件
    apiService.recordAction('settings_updated', {
      checkSourceStatus: payload.checkSourceStatus,
      sourceStatusCheckTimeout: payload.sourceStatusCheckTimeout
    }).catch(console.error);
    
    console.log('✅ 设置保存完成');
    
  } catch (error) {
    console.error('❌ 保存设置失败:', error);
    showToast('保存设置失败: ' + error.message, 'error');
  } finally {
    showLoading(false);
    this.isLoading = false;
  }
}

// 2. 新增直接更新UI的方法，不合并默认设置
updateUIElementsDirectly(settings) {
  console.log('🔄 直接更新UI元素，不合并默认设置...');
  
  const elements = {
    themeMode: document.getElementById('themeMode'),
    maxFavorites: document.getElementById('maxFavorites'),
    historyRetention: document.getElementById('historyRetention'),
    allowAnalytics: document.getElementById('allowAnalytics'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    
    enableSourceStatusCheck: document.getElementById('enableSourceStatusCheck'),
    sourceCheckTimeout: document.getElementById('sourceCheckTimeout'),
    sourceStatusCacheDuration: document.getElementById('sourceStatusCacheDuration'),
    skipUnavailableSources: document.getElementById('skipUnavailableSources'),
    showSourceStatus: document.getElementById('showSourceStatus'),
    retryFailedSources: document.getElementById('retryFailedSources')
  };

  // 🔧 基本设置
  if (elements.themeMode && settings.theme !== undefined) {
    elements.themeMode.value = settings.theme;
  }
  
  if (elements.maxFavorites && settings.maxFavoritesPerUser !== undefined) {
    elements.maxFavorites.value = settings.maxFavoritesPerUser;
  }
  
  if (elements.historyRetention && settings.maxHistoryPerUser !== undefined) {
    elements.historyRetention.value = settings.maxHistoryPerUser;
  }
  
  if (elements.allowAnalytics && settings.allowAnalytics !== undefined) {
    elements.allowAnalytics.checked = settings.allowAnalytics;
  }
  
  if (elements.searchSuggestions && settings.searchSuggestions !== undefined) {
    elements.searchSuggestions.checked = settings.searchSuggestions;
  }

  // 🔧 搜索源状态检查设置 - 关键修复
  if (elements.enableSourceStatusCheck) {
    // 直接使用设置值，不做任何默认值合并
    const checkSourceStatus = settings.checkSourceStatus === true;
    elements.enableSourceStatusCheck.checked = checkSourceStatus;
    
    console.log('🔍 直接更新搜索源状态检查设置:', {
      设置值: settings.checkSourceStatus,
      UI状态: checkSourceStatus,
      元素checked: elements.enableSourceStatusCheck.checked
    });
  }
  
  // 其他状态检查相关设置
  if (elements.sourceCheckTimeout && settings.sourceStatusCheckTimeout !== undefined) {
    elements.sourceCheckTimeout.value = settings.sourceStatusCheckTimeout;
  }
  
  if (elements.sourceStatusCacheDuration && settings.sourceStatusCacheDuration !== undefined) {
    elements.sourceStatusCacheDuration.value = Math.floor(settings.sourceStatusCacheDuration / 1000);
  }
  
  if (elements.skipUnavailableSources && settings.skipUnavailableSources !== undefined) {
    elements.skipUnavailableSources.checked = settings.skipUnavailableSources;
  }
  
  if (elements.showSourceStatus && settings.showSourceStatus !== undefined) {
    elements.showSourceStatus.checked = settings.showSourceStatus;
  }
  
  if (elements.retryFailedSources && settings.retryFailedSources !== undefined) {
    elements.retryFailedSources.checked = settings.retryFailedSources;
  }
}


  // 🔧 新增：同步UI与当前设置的方法
  async syncUIWithCurrentSettings() {
    console.log('🔄 同步UI与当前设置...');
    
    // 使用当前设置更新UI，不从API重新获取
    const mergedSettings = { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS, ...this.currentSettings };
    this.updateUIElements(mergedSettings);
    this.updateSourceStatusCheckControls();
    
    console.log('✅ UI同步完成');
  }

  validateSettings(settings) {
    // 验证超时时间
    const timeout = settings.sourceStatusCheckTimeout;
    const timeoutRange = APP_CONSTANTS.VALIDATION_RULES?.STATUS_CHECK?.TIMEOUT_RANGE || [1000, 30000];
    if (timeout < timeoutRange[0] || timeout > timeoutRange[1]) {
      return {
        valid: false,
        message: `状态检查超时时间必须在 ${timeoutRange[0]/1000}-${timeoutRange[1]/1000} 秒之间`
      };
    }

    // 验证缓存持续时间
    const cacheDuration = settings.sourceStatusCacheDuration;
    if (cacheDuration < 60000 || cacheDuration > 3600000) {
      return {
        valid: false,
        message: '状态缓存时间必须在 60-3600 秒之间'
      };
    }

    // 验证最大收藏数
    if (settings.maxFavoritesPerUser < 100 || settings.maxFavoritesPerUser > 2000) {
      return {
        valid: false,
        message: '最大收藏数必须在 100-2000 之间'
      };
    }

    // 验证历史保留天数
    if (settings.maxHistoryPerUser !== 999999 && (settings.maxHistoryPerUser < 7 || settings.maxHistoryPerUser > 365)) {
      return {
        valid: false,
        message: '历史保留天数必须在 7-365 之间，或选择永久保留'
      };
    }

    return { valid: true };
  }

  collectSettings() {
    const settings = {};
    
    const elements = {
      themeMode: document.getElementById('themeMode'),
      maxFavorites: document.getElementById('maxFavorites'),
      historyRetention: document.getElementById('historyRetention'),
      allowAnalytics: document.getElementById('allowAnalytics'),
      searchSuggestions: document.getElementById('searchSuggestions'),
      
      // 搜索源状态检查设置
      enableSourceStatusCheck: document.getElementById('enableSourceStatusCheck'),
      sourceCheckTimeout: document.getElementById('sourceCheckTimeout'),
      sourceStatusCacheDuration: document.getElementById('sourceStatusCacheDuration'),
      skipUnavailableSources: document.getElementById('skipUnavailableSources'),
      showSourceStatus: document.getElementById('showSourceStatus'),
      retryFailedSources: document.getElementById('retryFailedSources')
    };
    
    // 🔧 收集设置时添加调试日志
    if (elements.enableSourceStatusCheck) {
      settings.enableSourceStatusCheck = elements.enableSourceStatusCheck.checked;
      console.log('📋 收集搜索源状态检查设置:', settings.enableSourceStatusCheck);
    }
    
    if (elements.themeMode) settings.themeMode = elements.themeMode.value;
    if (elements.maxFavorites) settings.maxFavorites = elements.maxFavorites.value;
    if (elements.historyRetention) settings.historyRetention = elements.historyRetention.value;
    if (elements.allowAnalytics) settings.allowAnalytics = elements.allowAnalytics.checked;
    if (elements.searchSuggestions) settings.searchSuggestions = elements.searchSuggestions.checked;
    
    if (elements.sourceCheckTimeout) settings.sourceCheckTimeout = elements.sourceCheckTimeout.value;
    if (elements.sourceStatusCacheDuration) settings.sourceStatusCacheDuration = elements.sourceStatusCacheDuration.value;
    if (elements.skipUnavailableSources) settings.skipUnavailableSources = elements.skipUnavailableSources.checked;
    if (elements.showSourceStatus) settings.showSourceStatus = elements.showSourceStatus.checked;
    if (elements.retryFailedSources) settings.retryFailedSources = elements.retryFailedSources.checked;
    
    return settings;
  }

  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    const defaultSettings = {
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true,
      
      // 搜索源状态检查默认设置
      enableSourceStatusCheck: false,
      sourceCheckTimeout: '8000',
      sourceStatusCacheDuration: '300',
      skipUnavailableSources: true,
      showSourceStatus: true,
      retryFailedSources: false
    };

    Object.entries(defaultSettings).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = value;
        } else {
          element.value = value;
        }
      }
    });

    this.updateSourceStatusCheckControls();
    this.markSettingsChanged();
    showToast('设置已重置为默认值，请点击保存', 'success');
  }

  markSettingsChanged() {
    this.hasUnsavedChanges = true;
    this.updateSaveButtonState();
  }

  markSettingsSaved() {
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }

  updateSaveButtonState() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
      saveBtn.classList.toggle('changed', this.hasUnsavedChanges);
      saveBtn.textContent = this.hasUnsavedChanges ? '保存更改' : '已保存';
    }
    
    const legacySaveBtn = document.querySelector('#settings .btn-primary');
    if (legacySaveBtn && legacySaveBtn !== saveBtn) {
      legacySaveBtn.textContent = this.hasUnsavedChanges ? '保存设置*' : '保存设置';
      legacySaveBtn.classList.toggle('changed', this.hasUnsavedChanges);
    }
  }

  // 🔧 增强版本的测试搜索源状态检查功能
  async testSourceStatusCheck() {
    const enableCheckbox = document.getElementById('enableSourceStatusCheck');
    if (!this.currentSettings.checkSourceStatus && !enableCheckbox?.checked) {
      showToast('请先启用搜索源状态检查功能', 'info');
      return;
    }

    try {
      showLoading(true);
      showToast('正在测试搜索源状态检查...', 'info');
      
      // 获取可用的搜索源
      const enabledSources = await searchService.getEnabledSearchSources();
      
      if (enabledSources.length === 0) {
        showToast('没有可用的搜索源可以测试', 'warning');
        return;
      }
      
      // 检查状态（强制清除缓存）
      if (searchService.clearStatusCache) {
        searchService.clearStatusCache();
      }
      
      const checkedSources = await searchService.checkSourcesAvailability(enabledSources, {
        showProgress: true,
        useCache: false
      });
      
      const availableCount = checkedSources.filter(s => s.available).length;
      const totalCount = checkedSources.length;
      
      // 显示详细结果
      const results = checkedSources.map(source => 
        `${source.name}: ${source.available ? '✅ 可用' : '❌ 不可用'} (${source.responseTime || 0}ms)`
      ).join('\n');
      
      alert(`状态检查测试完成：\n\n${results}\n\n可用: ${availableCount}/${totalCount}`);
      
    } catch (error) {
      console.error('测试状态检查失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 其他方法保持不变...
  changePassword() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
      modal.style.display = 'block';
      setTimeout(() => {
        const currentPassword = document.getElementById('currentPassword');
        if (currentPassword) currentPassword.focus();
      }, 100);
    }
  }

  async handlePasswordChange(event) {
    event.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('请填写所有字段', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast('新密码确认不一致', 'error');
      return;
    }

    const minLength = APP_CONSTANTS.LIMITS?.MIN_PASSWORD_LENGTH || 6;
    if (newPassword.length < minLength) {
      showToast(`新密码至少${minLength}个字符`, 'error');
      return;
    }

    try {
      showLoading(true);
      
      const response = await apiService.changePassword(currentPassword, newPassword);
      
      if (response.success) {
        showToast('密码修改成功', 'success');
        this.app.closeModals();
        document.getElementById('passwordForm').reset();
      } else {
        throw new Error(response.message || '密码修改失败');
      }
    } catch (error) {
      showToast('密码修改失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 数据同步
  async syncAllData() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      showToast('正在同步数据...', 'info');
      
      const favoritesManager = this.app.getManager('favorites');
      const historyManager = this.app.getManager('history');
      
      if (favoritesManager) {
        await apiService.syncFavorites(favoritesManager.getFavorites());
      }
      
      const promises = [];
      if (favoritesManager) promises.push(favoritesManager.loadData());
      if (historyManager) promises.push(historyManager.loadData());
      
      await Promise.allSettled(promises);
      
      showToast('数据同步成功', 'success');
    } catch (error) {
      console.error('数据同步失败:', error);
      showToast('同步失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 数据导出
  async exportData() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      const [favorites, history, settings] = await Promise.all([
        apiService.getFavorites(),
        apiService.getSearchHistory(),
        apiService.getUserSettings()
      ]);

      const sourcesManager = this.app.getManager('sources');
      const categoriesManager = this.app.getManager('categories');

      const data = {
        favorites: favorites || [],
        searchHistory: history || [],
        settings: settings || this.collectSettings(),
        customSearchSources: sourcesManager ? sourcesManager.customSearchSources : [],
        customCategories: categoriesManager ? categoriesManager.getCustomCategories() : [],
        exportTime: new Date().toISOString(),
        version: window.API_CONFIG?.APP_VERSION || '1.3.1'
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `magnet-search-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('数据导出成功', 'success');
    } catch (error) {
      console.error('导出数据失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  // 导出收藏
  async exportFavorites() {
    const favoritesManager = this.app.getManager('favorites');
    if (favoritesManager) {
      await favoritesManager.exportFavorites();
    } else {
      showToast('收藏管理器未初始化', 'error');
    }
  }

  // 导出搜索源
  async exportSources() {
    const sourcesManager = this.app.getManager('sources');
    if (sourcesManager) {
      await sourcesManager.exportSources();
    } else {
      showToast('搜索源管理器未初始化', 'error');
    }
  }

  // 导出分类
  async exportCategories() {
    const categoriesManager = this.app.getManager('categories');
    if (categoriesManager) {
      await categoriesManager.exportCategories();
    } else {
      showToast('分类管理器未初始化', 'error');
    }
  }

  // 清空历史
  async clearAllHistory() {
    const historyManager = this.app.getManager('history');
    if (historyManager) {
      await historyManager.clearAllHistory();
    } else {
      showToast('历史管理器未初始化', 'error');
    }
  }

  // 清空所有数据
  async clearAllData() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    const confirmText = '确定要清空所有数据吗？这将删除您的收藏、搜索历史等所有个人数据，此操作不可撤销！';
    if (!confirm(confirmText)) return;

    const doubleConfirm = prompt('请输入 "DELETE ALL" 来确认此操作：');
    if (doubleConfirm !== 'DELETE ALL') {
      showToast('确认文本不匹配，操作已取消', 'info');
      return;
    }

    try {
      showLoading(true);
      
      await Promise.all([
        apiService.clearAllSearchHistory(),
        apiService.syncFavorites([])
      ]);
      
      const defaultSettings = { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS };
      await apiService.updateUserSettings(defaultSettings);
      
      if (searchService.clearCache) {
        searchService.clearCache();
      }
      
      const managers = ['favorites', 'history', 'overview'];
      const loadPromises = managers.map(name => {
        const manager = this.app.getManager(name);
        return manager && manager.loadData ? manager.loadData() : Promise.resolve();
      });
      
      await Promise.allSettled(loadPromises);
      
      this.currentSettings = defaultSettings;
      await this.loadSettingsData();
      
      showToast('所有数据已清空', 'success');
    } catch (error) {
      console.error('清空数据失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 删除账户
  async deleteAccount() {
    const confirmText = '确定要删除账户吗？这将永久删除您的账户和所有相关数据，此操作不可撤销！';
    if (!confirm(confirmText)) return;

    const username = this.app.getCurrentUser()?.username;
    const confirmUsername = prompt(`请输入您的用户名 "${username}" 来确认删除账户：`);
    if (confirmUsername !== username) {
      showToast('用户名不匹配，操作已取消', 'info');
      return;
    }

    try {
      showLoading(true);
      
      const response = await apiService.deleteAccount();
      
      if (response.success) {
        showToast('账户已删除', 'success');
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      } else {
        throw new Error(response.message || '删除账户失败');
      }
    } catch (error) {
      console.error('删除账户失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 重置编辑状态
  resetEditingState() {
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }
}

export default SettingsManager;