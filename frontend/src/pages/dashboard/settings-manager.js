// 设置管理器 - 支持搜索源状态检查设置
import { APP_CONSTANTS } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import apiService from '../../services/api.js';
import themeManager from '../../services/theme.js';
import searchService from '../../services/search.js';

export class SettingsManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.currentSettings = {};
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
  }

  bindSettingsEvents() {
    const settingInputs = document.querySelectorAll('#settings input, #settings select');
    settingInputs.forEach(input => {
      input.addEventListener('change', () => {
        this.markSettingsChanged();
      });
    });

    // 特别绑定搜索源状态检查相关设置
    const statusCheckSettings = [
      'enableSourceStatusCheck',
      'sourceCheckTimeout', 
      'sourceStatusCacheDuration',
      'skipUnavailableSources',
      'showSourceStatus',
      'retryFailedSources'
    ];

    statusCheckSettings.forEach(settingId => {
      const element = document.getElementById(settingId);
      if (element) {
        element.addEventListener('change', () => {
          console.log(`搜索源状态检查设置 ${settingId} 已更改:`, element.type === 'checkbox' ? element.checked : element.value);
          this.markSettingsChanged();
        });
      }
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

  async loadSettingsData() {
    try {
      const settings = await apiService.getUserSettings();
      this.currentSettings = settings;
      
      // 基础设置
      const elements = {
        themeMode: document.getElementById('themeMode'),
        maxFavorites: document.getElementById('maxFavorites'),
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

      // 加载基础设置
      if (elements.themeMode) elements.themeMode.value = settings.theme || 'auto';
      if (elements.maxFavorites) elements.maxFavorites.value = settings.maxFavoritesPerUser ?? 500;
      if (elements.allowAnalytics) elements.allowAnalytics.checked = settings.allowAnalytics !== false;
      if (elements.searchSuggestions) elements.searchSuggestions.checked = settings.searchSuggestions !== false;

      // 🆕 加载搜索源状态检查设置
      if (elements.enableSourceStatusCheck) {
        elements.enableSourceStatusCheck.checked = settings.checkSourceStatus === true;
      }
      if (elements.sourceCheckTimeout) {
        elements.sourceCheckTimeout.value = settings.sourceStatusCheckTimeout ?? 8000;
      }
      if (elements.sourceStatusCacheDuration) {
        elements.sourceStatusCacheDuration.value = settings.sourceStatusCacheDuration ?? 300000;
      }
      if (elements.skipUnavailableSources) {
        elements.skipUnavailableSources.checked = settings.skipUnavailableSources !== false;
      }
      if (elements.showSourceStatus) {
        elements.showSourceStatus.checked = settings.showSourceStatus !== false;
      }
      if (elements.retryFailedSources) {
        elements.retryFailedSources.checked = settings.retryFailedSources === true;
      }

      console.log('设置加载完成:', settings);

    } catch (error) {
      console.error('加载设置失败:', error);
      showToast('加载设置失败', 'error');
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
        
// 🆕 搜索源状态检查设置（直接毫秒）
        checkSourceStatus: !!ui.enableSourceStatusCheck,
        sourceStatusCheckTimeout: parseInt(ui.sourceCheckTimeout, 10) || 8000,
        sourceStatusCacheDuration: parseInt(ui.sourceStatusCacheDuration, 10) || 300000,
        skipUnavailableSources: !!ui.skipUnavailableSources,
        showSourceStatus: !!ui.showSourceStatus,
        retryFailedSources: !!ui.retryFailedSources
      };
      
      console.log('保存设置payload:', payload);
      
      await apiService.updateUserSettings(payload);
      
      // 立即应用主题设置
      if (payload.theme) {
        themeManager.setTheme(payload.theme);
      }
      
      // 清除搜索服务的用户设置缓存，确保下次搜索使用新设置
      if (searchService && searchService.clearUserSettingsCache) {
        searchService.clearUserSettingsCache();
      }
      
      showToast('设置保存成功', 'success');
      this.markSettingsSaved();
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('保存设置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
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
    
    // 收集基础设置
    if (elements.themeMode) settings.themeMode = elements.themeMode.value;
    if (elements.maxFavorites) settings.maxFavorites = elements.maxFavorites.value;
    if (elements.historyRetention) settings.historyRetention = elements.historyRetention.value;
    if (elements.allowAnalytics) settings.allowAnalytics = elements.allowAnalytics.checked;
    if (elements.searchSuggestions) settings.searchSuggestions = elements.searchSuggestions.checked;
    
    // 🆕 收集搜索源状态检查设置
    if (elements.enableSourceStatusCheck) {
      settings.enableSourceStatusCheck = elements.enableSourceStatusCheck.checked;
    }
// 🆕🆕🆕 
if (elements.sourceCheckTimeout) {
    // 后端存储的是毫秒
    elements.sourceCheckTimeout.value = settings.sourceStatusCheckTimeout || 8000;
}
if (elements.sourceStatusCacheDuration) {
    // 后端存储的是毫秒
    elements.sourceStatusCacheDuration.value = settings.sourceStatusCacheDuration || 300000;
}
    if (elements.skipUnavailableSources) {
      settings.skipUnavailableSources = elements.skipUnavailableSources.checked;
    }
    if (elements.showSourceStatus) {
      settings.showSourceStatus = elements.showSourceStatus.checked;
    }
    if (elements.retryFailedSources) {
      settings.retryFailedSources = elements.retryFailedSources.checked;
    }
    
    return settings;
  }

  resetSettings() {
    if (!confirm('确定要重置所有设置为默认值吗？')) return;

    // 重置为默认设置
    const defaultSettings = {
      themeMode: 'auto',
      historyRetention: '90',
      maxFavorites: '500',
      allowAnalytics: true,
      searchSuggestions: true,
      
      // 🆕 搜索源状态检查默认设置
      enableSourceStatusCheck: false,
      sourceCheckTimeout: 8,
      sourceStatusCacheDuration: 300,
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

    this.markSettingsChanged();
    showToast('设置已重置为默认值，请点击保存', 'success');
  }

  markSettingsChanged() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置*';
      saveBtn.classList.add('changed');
    }
  }

  markSettingsSaved() {
    const saveBtn = document.querySelector('#settings .btn-primary');
    if (saveBtn) {
      saveBtn.textContent = '保存设置';
      saveBtn.classList.remove('changed');
    }
  }

  // 🆕 新增：测试搜索源状态检查功能
  async testSourceStatusCheck() {
    try {
      showLoading(true);
      showToast('开始测试搜索源状态检查...', 'info');
      
      // 显示进度指示器
      const progressElement = document.getElementById('statusCheckProgress');
      if (progressElement) {
        progressElement.style.display = 'block';
      }
      
      // 这里可以调用搜索源状态检查服务进行测试
      // 模拟测试过程
      const testSources = ['javbus', 'javdb', 'javlibrary'];
      let checkedCount = 0;
      
      for (const sourceId of testSources) {
        // 更新进度
        checkedCount++;
        const progressStats = document.querySelector('.progress-stats');
        if (progressStats) {
          progressStats.textContent = `${checkedCount}/${testSources.length}`;
        }
        
        // 模拟检查延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      showToast('搜索源状态检查测试完成', 'success');
    } catch (error) {
      console.error('测试搜索源状态检查失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
      
      // 隐藏进度指示器
      const progressElement = document.getElementById('statusCheckProgress');
      if (progressElement) {
        progressElement.style.display = 'none';
      }
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

    if (newPassword.length < 6) {
      showToast('新密码至少6个字符', 'error');
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
        version: window.API_CONFIG?.APP_VERSION || '1.3.0'
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

    if (!confirm('确定要清空所有数据吗？此操作不可恢复，建议先导出数据备份。')) return;
    if (!confirm('再次确认：这将清空您的所有收藏和搜索历史！')) return;

    try {
      showLoading(true);
      
      // 清空云端数据
      await Promise.all([
        apiService.clearAllSearchHistory(),
        apiService.syncFavorites([]) // 传空数组清空收藏
      ]);
      
      // 重新加载各管理器数据
      const managers = ['favorites', 'history', 'overview'];
      const loadPromises = managers.map(name => {
        const manager = this.app.getManager(name);
        return manager && manager.loadData ? manager.loadData() : Promise.resolve();
      });
      
      await Promise.allSettled(loadPromises);
      
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
    const confirmText = '我确定要删除账户';
    const userInput = prompt(`删除账户将无法恢复，请输入"${confirmText}"确认：`);
    
    if (userInput !== confirmText) {
      showToast('确认文本不匹配，取消删除', 'info');
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
}

export default SettingsManager;