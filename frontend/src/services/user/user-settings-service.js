// src/services/user/user-settings-service.js
// 用户设置服务 - 从api.js拆分的设置相关功能

export class UserSettingsService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.settingsCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟缓存
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
  }

  // 初始化
  initialize() {
    // 监听认证状态变化，清理设置缓存
    if (this.authService) {
      this.authService.onAuthStateChanged((event) => {
        if (event.type === 'logout') {
          this.clearSettingsCache();
        }
      });
    }
  }

  // 获取用户设置
  async getSettings() {
    try {
      // 检查缓存
      if (this.isSettingsCacheValid()) {
        return { success: true, settings: this.settingsCache };
      }

      // 如果用户未登录，返回默认设置
      if (!this.authService?.isAuthenticated()) {
        const defaultSettings = this.getDefaultSettings();
        return { success: true, settings: defaultSettings };
      }

      const response = await this.apiClient.get('/api/user/settings');

      if (response.success) {
        const settings = this.mergeWithDefaults(response.settings || {});
        this.cacheSettings(settings);
        return { success: true, settings };
      } else {
        throw new Error(response.message || '获取用户设置失败');
      }
    } catch (error) {
      console.error('获取用户设置失败:', error);
      
      // 返回默认设置作为降级方案
      const defaultSettings = this.getDefaultSettings();
      return { 
        success: false, 
        settings: defaultSettings,
        error: error.message 
      };
    }
  }

  // 更新用户设置
  async updateSettings(settings) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!settings || typeof settings !== 'object') {
        throw new Error('设置数据格式错误');
      }

      // 验证设置字段
      const validatedSettings = this.validateSettings(settings);
      
      const response = await this.apiClient.put('/api/user/settings', {
        settings: validatedSettings
      });

      if (response.success) {
        // 更新缓存
        const updatedSettings = this.mergeWithDefaults(validatedSettings);
        this.cacheSettings(updatedSettings);
        
        return { 
          success: true, 
          message: response.message || '设置更新成功',
          settings: updatedSettings 
        };
      } else {
        throw new Error(response.message || '更新设置失败');
      }
    } catch (error) {
      console.error('更新用户设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 重置设置为默认值
  async resetSettings() {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      const defaultSettings = this.getDefaultSettings();
      return await this.updateSettings(defaultSettings);
    } catch (error) {
      console.error('重置设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取搜索相关设置
  async getSearchSettings() {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        return {
          success: true,
          searchSettings: {
            searchSources: settings.searchSources || [],
            customSearchSources: settings.customSearchSources || [],
            checkSourceStatus: settings.checkSourceStatus || false,
            sourceStatusCheckTimeout: settings.sourceStatusCheckTimeout || 10000,
            sourceStatusCacheDuration: settings.sourceStatusCacheDuration || 300000,
            skipUnavailableSources: settings.skipUnavailableSources || false,
            showSourceStatus: settings.showSourceStatus || true,
            retryFailedSources: settings.retryFailedSources || true,
            maxConcurrentChecks: settings.maxConcurrentChecks || 3
          }
        };
      } else {
        throw new Error('获取设置失败');
      }
    } catch (error) {
      console.error('获取搜索设置失败:', error);
      return { 
        success: false, 
        error: error.message,
        searchSettings: this.getDefaultSearchSettings()
      };
    }
  }

  // 获取UI相关设置
  async getUISettings() {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        return {
          success: true,
          uiSettings: {
            theme: settings.theme || 'light',
            language: settings.language || 'zh-CN',
            autoSync: settings.autoSync || true,
            cacheResults: settings.cacheResults || true,
            searchSuggestions: settings.searchSuggestions || true,
            compactMode: settings.compactMode || false,
            showThumbnails: settings.showThumbnails || true,
            animationsEnabled: settings.animationsEnabled || true
          }
        };
      } else {
        throw new Error('获取设置失败');
      }
    } catch (error) {
      console.error('获取UI设置失败:', error);
      return { 
        success: false, 
        error: error.message,
        uiSettings: this.getDefaultUISettings()
      };
    }
  }

  // 获取隐私相关设置
  async getPrivacySettings() {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        return {
          success: true,
          privacySettings: {
            allowAnalytics: settings.allowAnalytics || false,
            shareUsageData: settings.shareUsageData || false,
            profileVisibility: settings.profileVisibility || 'private',
            activityLogging: settings.activityLogging || true,
            dataExportAllowed: settings.dataExportAllowed || true,
            searchHistoryRetention: settings.searchHistoryRetention || 30, // 天数
            autoDeleteHistory: settings.autoDeleteHistory || false
          }
        };
      } else {
        throw new Error('获取设置失败');
      }
    } catch (error) {
      console.error('获取隐私设置失败:', error);
      return { 
        success: false, 
        error: error.message,
        privacySettings: this.getDefaultPrivacySettings()
      };
    }
  }

  // 更新搜索设置
  async updateSearchSettings(searchSettings) {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        const updatedSettings = {
          ...settings,
          ...searchSettings
        };
        
        return await this.updateSettings(updatedSettings);
      } else {
        throw new Error('获取当前设置失败');
      }
    } catch (error) {
      console.error('更新搜索设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 更新UI设置
  async updateUISettings(uiSettings) {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        const updatedSettings = {
          ...settings,
          ...uiSettings
        };
        
        return await this.updateSettings(updatedSettings);
      } else {
        throw new Error('获取当前设置失败');
      }
    } catch (error) {
      console.error('更新UI设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 更新隐私设置
  async updatePrivacySettings(privacySettings) {
    try {
      const { success, settings } = await this.getSettings();
      
      if (success) {
        const updatedSettings = {
          ...settings,
          ...privacySettings
        };
        
        return await this.updateSettings(updatedSettings);
      } else {
        throw new Error('获取当前设置失败');
      }
    } catch (error) {
      console.error('更新隐私设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 验证设置数据
  validateSettings(settings) {
    const allowedSettings = [
      'theme', 'autoSync', 'cacheResults', 'maxHistoryPerUser', 'maxFavoritesPerUser',
      'searchSources', 'customSearchSources', 'customSourceCategories',
      'allowAnalytics', 'searchSuggestions', 'language', 'compactMode',
      'checkSourceStatus', 'sourceStatusCheckTimeout', 'sourceStatusCacheDuration',
      'skipUnavailableSources', 'showSourceStatus', 'retryFailedSources',
      'profileVisibility', 'activityLogging', 'dataExportAllowed',
      'searchHistoryRetention', 'autoDeleteHistory', 'shareUsageData',
      'showThumbnails', 'animationsEnabled', 'maxConcurrentChecks'
    ];

    const validSettings = {};
    Object.keys(settings).forEach(key => {
      if (allowedSettings.includes(key)) {
        validSettings[key] = settings[key];
      }
    });

    return validSettings;
  }

  // 获取默认设置
  getDefaultSettings() {
    return {
      // UI设置
      theme: 'light',
      language: 'zh-CN',
      autoSync: true,
      cacheResults: true,
      searchSuggestions: true,
      compactMode: false,
      showThumbnails: true,
      animationsEnabled: true,
      
      // 搜索设置
      searchSources: ['javbus', 'javdb', 'javlibrary'],
      customSearchSources: [],
      customSourceCategories: [],
      checkSourceStatus: false,
      sourceStatusCheckTimeout: 10000,
      sourceStatusCacheDuration: 300000,
      skipUnavailableSources: false,
      showSourceStatus: true,
      retryFailedSources: true,
      maxConcurrentChecks: 3,
      
      // 隐私设置
      allowAnalytics: false,
      shareUsageData: false,
      profileVisibility: 'private',
      activityLogging: true,
      dataExportAllowed: true,
      searchHistoryRetention: 30,
      autoDeleteHistory: false,
      
      // 限制设置
      maxHistoryPerUser: 1000,
      maxFavoritesPerUser: 500
    };
  }

  // 获取默认搜索设置
  getDefaultSearchSettings() {
    const defaults = this.getDefaultSettings();
    return {
      searchSources: defaults.searchSources,
      customSearchSources: defaults.customSearchSources,
      checkSourceStatus: defaults.checkSourceStatus,
      sourceStatusCheckTimeout: defaults.sourceStatusCheckTimeout,
      sourceStatusCacheDuration: defaults.sourceStatusCacheDuration,
      skipUnavailableSources: defaults.skipUnavailableSources,
      showSourceStatus: defaults.showSourceStatus,
      retryFailedSources: defaults.retryFailedSources,
      maxConcurrentChecks: defaults.maxConcurrentChecks
    };
  }

  // 获取默认UI设置
  getDefaultUISettings() {
    const defaults = this.getDefaultSettings();
    return {
      theme: defaults.theme,
      language: defaults.language,
      autoSync: defaults.autoSync,
      cacheResults: defaults.cacheResults,
      searchSuggestions: defaults.searchSuggestions,
      compactMode: defaults.compactMode,
      showThumbnails: defaults.showThumbnails,
      animationsEnabled: defaults.animationsEnabled
    };
  }

  // 获取默认隐私设置
  getDefaultPrivacySettings() {
    const defaults = this.getDefaultSettings();
    return {
      allowAnalytics: defaults.allowAnalytics,
      shareUsageData: defaults.shareUsageData,
      profileVisibility: defaults.profileVisibility,
      activityLogging: defaults.activityLogging,
      dataExportAllowed: defaults.dataExportAllowed,
      searchHistoryRetention: defaults.searchHistoryRetention,
      autoDeleteHistory: defaults.autoDeleteHistory
    };
  }

  // 合并默认设置
  mergeWithDefaults(userSettings) {
    const defaults = this.getDefaultSettings();
    return { ...defaults, ...userSettings };
  }

  // 缓存管理
  cacheSettings(settings) {
    this.settingsCache = settings;
    this.cacheTimestamp = Date.now();
  }

  isSettingsCacheValid() {
    return this.settingsCache && 
           this.cacheTimestamp && 
           Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  clearSettingsCache() {
    this.settingsCache = null;
    this.cacheTimestamp = null;
  }

  // 设置导入导出
  exportSettings() {
    if (this.settingsCache) {
      return {
        settings: this.settingsCache,
        exportTime: new Date().toISOString(),
        version: '1.0'
      };
    }
    return null;
  }

  async importSettings(settingsData) {
    try {
      if (!settingsData || !settingsData.settings) {
        throw new Error('无效的设置数据');
      }

      const result = await this.updateSettings(settingsData.settings);
      
      if (result.success) {
        return { 
          success: true, 
          message: '设置导入成功' 
        };
      } else {
        throw new Error(result.error || '导入设置失败');
      }
    } catch (error) {
      console.error('导入设置失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 设置验证
  validateSettingValue(key, value) {
    const validators = {
      theme: (v) => ['light', 'dark', 'auto'].includes(v),
      language: (v) => ['zh-CN', 'en-US', 'ja-JP'].includes(v),
      sourceStatusCheckTimeout: (v) => Number.isInteger(v) && v >= 1000 && v <= 30000,
      sourceStatusCacheDuration: (v) => Number.isInteger(v) && v >= 60000 && v <= 3600000,
      maxHistoryPerUser: (v) => Number.isInteger(v) && v >= 100 && v <= 10000,
      maxFavoritesPerUser: (v) => Number.isInteger(v) && v >= 50 && v <= 5000,
      searchHistoryRetention: (v) => Number.isInteger(v) && v >= 1 && v <= 365,
      maxConcurrentChecks: (v) => Number.isInteger(v) && v >= 1 && v <= 10
    };

    const validator = validators[key];
    return validator ? validator(value) : true;
  }

  // 健康检查
  healthCheck() {
    return {
      status: 'healthy',
      apiClientConnected: !!this.apiClient,
      authServiceConnected: !!this.authService,
      isAuthenticated: this.authService?.isAuthenticated() || false,
      cacheValid: this.isSettingsCacheValid(),
      cacheTimestamp: this.cacheTimestamp
    };
  }

  // 销毁服务
  destroy() {
    this.clearSettingsCache();
  }
}

export default UserSettingsService;