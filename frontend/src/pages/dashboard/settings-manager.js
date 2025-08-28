// 设置管理器 - 整合搜索源状态检查功能
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import apiService from '../../services/api.js';
import themeManager from '../../services/theme.js';
import searchService from '../../services/search.js';

export class SettingsManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.currentSettings = {};
    this.hasUnsavedChanges = false; // 新增：跟踪未保存的更改
  }

  async init() {
    console.log('⚙️ 初始化设置管理器');
    this.bindEvents();
  }

  async loadData() {
    // 设置数据在切换到设置标签时加载
  }

  async loadTabData() {
    await this.loadSettingsData();
  }

  bindEvents() {
    // 绑定设置表单事件
    this.bindSettingsEvents();
    
    // 绑定数据操作按钮
    this.bindDataActionButtons();
    
    // 绑定密码修改事件
    this.bindPasswordEvents();

    // 🆕 新增：绑定搜索源状态检查测试按钮
    this.bindSourceStatusTestButton();
  }

  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
        
        // 🆕 新增：动态控制搜索源状态检查相关设置
        if (input.id === 'enableSourceStatusCheck') {
          this.updateSourceStatusCheckControls();
        }
      });
      
      // 🆕 新增：监听输入变化
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
    // 修改密码按钮
    const changePasswordBtn = document.querySelector('[onclick*="changePassword"]');
    if (changePasswordBtn) {
      changePasswordBtn.removeAttribute('onclick');
      changePasswordBtn.addEventListener('click', () => this.changePassword());
    }

    // 密码表单提交
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
    }
  }

  // 🆕 新增：绑定搜索源状态检查测试按钮
  bindSourceStatusTestButton() {
    const testBtn = document.getElementById('testSourceStatusBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testSourceStatusCheck());
    }
  }

  async loadSettingsData() {
    try {
      const settings = await apiService.getUserSettings();
      this.currentSettings = settings;
      
      // 合并默认设置
      const mergedSettings = { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS, ...settings };
      
      const elements = {
        themeMode: document.getElementById('themeMode'),
        maxFavorites: document.getElementById('maxFavorites'),
        historyRetention: document.getElementById('historyRetention'), // 保留现有功能
        allowAnalytics: document.getElementById('allowAnalytics'),
        searchSuggestions: document.getElementById('searchSuggestions'),
        
        // 🆕 新增：搜索源状态检查相关设置
        enableSourceStatusCheck: document.getElementById('enableSourceStatusCheck'),
        sourceCheckTimeout: document.getElementById('sourceCheckTimeout'),
        sourceStatusCacheDuration: document.getElementById('sourceStatusCacheDuration'),
        skipUnavailableSources: document.getElementById('skipUnavailableSources'),
        showSourceStatus: document.getElementById('showSourceStatus'),
        retryFailedSources: document.getElementById('retryFailedSources')
      };

      // 设置基本配置
      if (elements.themeMode) elements.themeMode.value = mergedSettings.theme || 'auto';
      if (elements.maxFavorites) elements.maxFavorites.value = mergedSettings.maxFavoritesPerUser ?? 500;
      if (elements.historyRetention) elements.historyRetention.value = mergedSettings.maxHistoryPerUser ?? 90;
      if (elements.allowAnalytics) elements.allowAnalytics.checked = mergedSettings.allowAnalytics !== false;
      if (elements.searchSuggestions) elements.searchSuggestions.checked = mergedSettings.searchSuggestions !== false;

      // 🆕 设置搜索源状态检查配置
      if (elements.enableSourceStatusCheck) elements.enableSourceStatusCheck.checked = mergedSettings.checkSourceStatus || false;
      if (elements.sourceCheckTimeout) elements.sourceCheckTimeout.value = mergedSettings.sourceStatusCheckTimeout || 8000;
      if (elements.sourceStatusCacheDuration) elements.sourceStatusCacheDuration.value = (mergedSettings.sourceStatusCacheDuration || 300000) / 1000;
      if (elements.skipUnavailableSources) elements.skipUnavailableSources.checked = mergedSettings.skipUnavailableSources !== false;
      if (elements.showSourceStatus) elements.showSourceStatus.checked = mergedSettings.showSourceStatus !== false;
      if (elements.retryFailedSources) elements.retryFailedSources.checked = mergedSettings.retryFailedSources || false;

      // 🆕 更新状态检查控件的启用状态
      this.updateSourceStatusCheckControls();
      
      this.hasUnsavedChanges = false;
      this.updateSaveButtonState();

    } catch (error) {
      console.error('加载设置失败:', error);
      showToast('加载设置失败', 'error');
    }
  }

  // 🆕 新增：更新搜索源状态检查相关控件的启用状态
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

  async saveSettings() {
    if (!this.app.getCurrentUser()) {
      showToast('用户未登录', 'error');
      return;
    }

    try {
      showLoading(true);
      const ui = this.collectSettings();
      
      const payload = {
        theme: ui.themeMode,
        maxFavoritesPerUser: parseInt(ui.maxFavorites, 10),
        maxHistoryPerUser: ui.historyRetention === '-1' ? 999999 : parseInt(ui.historyRetention, 10),
        allowAnalytics: !!ui.allowAnalytics,
        searchSuggestions: !!ui.searchSuggestions,
        
        // 🆕 新增：搜索源状态检查设置
        checkSourceStatus: !!ui.enableSourceStatusCheck,
        sourceStatusCheckTimeout: parseInt(ui.sourceCheckTimeout, 10) || 8000,
        sourceStatusCacheDuration: (parseInt(ui.sourceStatusCacheDuration, 10) || 300) * 1000, // 转换为毫秒
        skipUnavailableSources: !!ui.skipUnavailableSources,
        showSourceStatus: !!ui.showSourceStatus,
        retryFailedSources: !!ui.retryFailedSources
      };
      
      // 🆕 验证设置
      const validation = this.validateSettings(payload);
      if (!validation.valid) {
        showToast(validation.message, 'error');
        return;
      }
      
      await apiService.updateUserSettings(payload);
      
      // 立即应用主题设置
      if (payload.theme) {
        themeManager.setTheme(payload.theme);
      }
      
      // 清除搜索服务的用户设置缓存，确保下次搜索使用新设置
      if (searchService && searchService.clearUserSettingsCache) {
        searchService.clearUserSettingsCache();
      }
      
      // 🆕 如果禁用了状态检查，清除状态缓存
      if (!payload.checkSourceStatus && searchService.clearStatusCache) {
        searchService.clearStatusCache();
      }
      
      // 更新本地设置
      this.currentSettings = { ...this.currentSettings, ...payload };
      
      showToast('设置保存成功', 'success');
      this.markSettingsSaved();
      
      // 记录分析事件
      apiService.recordAction('settings_updated', {
        checkSourceStatus: payload.checkSourceStatus,
        sourceStatusCheckTimeout: payload.sourceStatusCheckTimeout
      }).catch(console.error);
      
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存设置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  // 🆕 新增：验证设置数据
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
    if (cacheDuration < 60000 || cacheDuration > 3600000) { // 1分钟到1小时
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
    
    // 基础设置
    const elements = {
      themeMode: document.getElementById('themeMode'),
      maxFavorites: document.getElementById('maxFavorites'),
      historyRetention: document.getElementById('historyRetention'),
      allowAnalytics: document.getElementById('allowAnalytics'),
      searchSuggestions: document.getElementById('searchSuggestions'),
      
      // 🆕 搜索源状态检查设置
      enableSourceStatusCheck: document.getElementById('enableSourceStatusCheck'),
      sourceCheckTimeout: document.getElementById('sourceCheckTimeout'),
      sourceStatusCacheDuration: document.getElementById('sourceStatusCacheDuration'),
      skipUnavailableSources: document.getElementById('skipUnavailableSources'),
      showSourceStatus: document.getElementById('showSourceStatus'),
      retryFailedSources: document.getElementById('retryFailedSources')
    };
    
    if (elements.themeMode) settings.themeMode = elements.themeMode.value;
    if (elements.maxFavorites) settings.maxFavorites = elements.maxFavorites.value;
    if (elements.historyRetention) settings.historyRetention = elements.historyRetention.value;
    if (elements.allowAnalytics) settings.allowAnalytics = elements.allowAnalytics.checked;
    if (elements.searchSuggestions) settings.searchSuggestions = elements.searchSuggestions.checked;
    
    // 🆕 收集搜索源状态检查设置
    if (elements.enableSourceStatusCheck) settings.enableSourceStatusCheck = elements.enableSourceStatusCheck.checked;
    if (elements.sourceCheckTimeout) settings.sourceCheckTimeout = elements.sourceCheckTimeout.value;
    if (elements.sourceStatusCacheDuration) settings.sourceStatusCacheDuration = elements.sourceStatusCacheDuration.value;
    if (elements.skipUnavailableSources) settings.skipUnavailableSources = elements.skipUnavailableSources.checked;
    if (elements.showSourceStatus) settings.showSourceStatus = elements.showSourceStatus.checked;
    if (elements.retryFailedSources) settings.retryFailedSources = elements.retryFailedSources.checked;
    
    return settings;
  }

  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    // 重置为默认设置（包含新的搜索源状态检查设置）
    const defaultSettings = {
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true,
      
      // 🆕 搜索源状态检查默认设置
      enableSourceStatusCheck: false,
      sourceCheckTimeout: '8000',
      sourceStatusCacheDuration: '300', // 5分钟
      skipUnavailableSources: true,
      showSourceStatus: true,
      retryFailedSources: false
    };

    // 重置基础设置
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

    // 🆕 更新状态检查控件
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

  // 🆕 新增：更新保存按钮状态
  updateSaveButtonState() {
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) {
      saveBtn.classList.toggle('changed', this.hasUnsavedChanges);
      saveBtn.textContent = this.hasUnsavedChanges ? '保存更改' : '已保存';
    }
    
    // 兼容原有的按钮选择器
    const legacySaveBtn = document.querySelector('#settings .btn-primary');
    if (legacySaveBtn && legacySaveBtn !== saveBtn) {
      legacySaveBtn.textContent = this.hasUnsavedChanges ? '保存设置*' : '保存设置';
      legacySaveBtn.classList.toggle('changed', this.hasUnsavedChanges);
    }
  }

  // 🆕 新增：测试搜索源状态检查功能
  async testSourceStatusCheck() {
    if (!this.currentSettings.checkSourceStatus && !document.getElementById('enableSourceStatusCheck')?.checked) {
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

  // 修改密码
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
      
      // 同步收藏夹到云端
      if (favoritesManager) {
        await apiService.syncFavorites(favoritesManager.getFavorites());
      }
      
      // 重新从云端加载数据以确保一致性
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
      // 从云端重新获取最新数据
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
      
      // 清空云端数据
      await Promise.all([
        apiService.clearAllSearchHistory(),
        apiService.syncFavorites([]) // 传空数组清空收藏
      ]);
      
      // 重置设置到默认值
      const defaultSettings = { ...APP_CONSTANTS.DEFAULT_USER_SETTINGS };
      await apiService.updateUserSettings(defaultSettings);
      
      // 清除本地缓存
      if (searchService.clearCache) {
        searchService.clearCache();
      }
      
      // 重新加载各管理器数据
      const managers = ['favorites', 'history', 'overview'];
      const loadPromises = managers.map(name => {
        const manager = this.app.getManager(name);
        return manager && manager.loadData ? manager.loadData() : Promise.resolve();
      });
      
      await Promise.allSettled(loadPromises);
      
      // 更新界面
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

  // 🆕 新增：重置编辑状态
  resetEditingState() {
    this.hasUnsavedChanges = false;
    this.updateSaveButtonState();
  }
}

export default SettingsManager;