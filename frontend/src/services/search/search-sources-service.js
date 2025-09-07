// src/services/search/search-sources-service.js
// 搜索源管理服务 - 从api.js拆分的搜索源管理功能

import { APP_CONSTANTS } from '../../core/constants.js';

export class SearchSourcesService {
  constructor() {
    this.apiClient = null;
    this.authService = null;
    this.userSettingsService = null;
    this.notificationService = null;
    
    this.sourcesCache = null;
    this.cacheTimestamp = null;
    this.cacheExpiry = 10 * 60 * 1000; // 10分钟缓存
  }

  // 依赖注入
  setDependencies(dependencies) {
    const [apiClient, authService, userSettingsService, notificationService] = dependencies;
    this.apiClient = apiClient;
    this.authService = authService;
    this.userSettingsService = userSettingsService;
    this.notificationService = notificationService;
  }

  // 初始化
  initialize() {
    console.log('搜索源管理服务已初始化');
  }

  // 获取启用的搜索源
  async getEnabledSources() {
    try {
      // 如果用户未登录，使用默认搜索源
      if (!this.authService?.isAuthenticated()) {
        return this.getDefaultSources();
      }

      // 获取用户设置
      const { success, settings } = await this.userSettingsService.getSettings();
      
      if (!success) {
        console.error('获取用户设置失败，使用默认搜索源');
        return this.getDefaultSources();
      }

      const enabledSources = settings.searchSources || ['javbus', 'javdb', 'javlibrary'];
      
      // 验证搜索源ID的有效性
      const validSources = enabledSources.filter(sourceId => 
        APP_CONSTANTS.SEARCH_SOURCES.some(source => source.id === sourceId)
      );
      
      if (validSources.length === 0) {
        console.warn('用户设置的搜索源无效，使用默认源');
        return this.getDefaultSources();
      }
      
      // 合并内置搜索源和自定义搜索源
      const builtinSources = APP_CONSTANTS.SEARCH_SOURCES.filter(
        source => validSources.includes(source.id)
      );
      
      const customSources = settings.customSearchSources || [];
      const enabledCustomSources = customSources.filter(
        source => validSources.includes(source.id)
      );

      return [...builtinSources, ...enabledCustomSources];
    } catch (error) {
      console.error('获取搜索源配置失败:', error);
      return this.getDefaultSources();
    }
  }

  // 获取所有可用搜索源（包括自定义）
  async getAllAvailableSources() {
    try {
      // 检查缓存
      if (this.isSourcesCacheValid()) {
        return { success: true, sources: this.sourcesCache };
      }

      const builtinSources = [...APP_CONSTANTS.SEARCH_SOURCES];
      let customSources = [];

      // 如果用户已登录，获取自定义搜索源
      if (this.authService?.isAuthenticated()) {
        try {
          const { success, settings } = await this.userSettingsService.getSettings();
          if (success) {
            customSources = settings.customSearchSources || [];
          }
        } catch (error) {
          console.warn('获取自定义搜索源失败:', error);
        }
      }

      const allSources = [...builtinSources, ...customSources];
      
      // 缓存结果
      this.cacheSource(allSources);
      
      return { success: true, sources: allSources };
    } catch (error) {
      console.error('获取所有可用搜索源失败:', error);
      return { 
        success: false, 
        sources: [...APP_CONSTANTS.SEARCH_SOURCES],
        error: error.message 
      };
    }
  }

  // 添加自定义搜索源
  async addCustomSource(sourceData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceData || !sourceData.name || !sourceData.urlTemplate) {
        throw new Error('缺少必需字段：name, urlTemplate');
      }
      
      if (!sourceData.urlTemplate.includes('{keyword}')) {
        throw new Error('URL模板必须包含{keyword}占位符');
      }
      
      // 生成唯一ID
      if (!sourceData.id) {
        sourceData.id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      const newSource = {
        id: sourceData.id,
        name: sourceData.name.trim(),
        subtitle: sourceData.subtitle?.trim() || '自定义搜索源',
        icon: sourceData.icon?.trim() || '🔍',
        urlTemplate: sourceData.urlTemplate.trim(),
        category: sourceData.category || 'other',
        isCustom: true,
        createdAt: Date.now(),
        description: sourceData.description?.trim() || ''
      };
      
      // 获取当前设置
      const { success, settings } = await this.userSettingsService.getSettings();
      if (!success) {
        throw new Error('获取用户设置失败');
      }

      const customSources = settings.customSearchSources || [];
      
      // 检查重复
      const existingSource = customSources.find(s => 
        s.id === newSource.id || s.name === newSource.name
      );
      
      if (existingSource) {
        throw new Error('搜索源ID或名称已存在');
      }
      
      const updatedCustomSources = [...customSources, newSource];
      
      // 更新设置
      const updateResult = await this.userSettingsService.updateSettings({
        ...settings,
        customSearchSources: updatedCustomSources
      });

      if (updateResult.success) {
        // 清除缓存
        this.clearSourcesCache();
        
        this.showNotification('自定义搜索源添加成功', 'success');
        
        return { 
          success: true, 
          message: '搜索源添加成功',
          source: newSource 
        };
      } else {
        throw new Error(updateResult.error || '更新设置失败');
      }
    } catch (error) {
      console.error('添加自定义搜索源失败:', error);
      this.showNotification(error.message, 'error');
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 更新自定义搜索源
  async updateCustomSource(sourceId, updates) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }

      if (!updates || typeof updates !== 'object') {
        throw new Error('更新数据不能为空');
      }
      
      // 获取当前设置
      const { success, settings } = await this.userSettingsService.getSettings();
      if (!success) {
        throw new Error('获取用户设置失败');
      }

      const customSources = settings.customSearchSources || [];
      
      const sourceIndex = customSources.findIndex(s => s.id === sourceId);
      if (sourceIndex === -1) {
        throw new Error('未找到指定的自定义搜索源');
      }
      
      // 验证URL模板
      if (updates.urlTemplate && !updates.urlTemplate.includes('{keyword}')) {
        throw new Error('URL模板必须包含{keyword}占位符');
      }
      
      customSources[sourceIndex] = {
        ...customSources[sourceIndex],
        ...updates,
        updatedAt: Date.now()
      };
      
      // 更新设置
      const updateResult = await this.userSettingsService.updateSettings({
        ...settings,
        customSearchSources: customSources
      });

      if (updateResult.success) {
        // 清除缓存
        this.clearSourcesCache();
        
        this.showNotification('搜索源更新成功', 'success');
        
        return { 
          success: true, 
          message: '搜索源更新成功',
          source: customSources[sourceIndex] 
        };
      } else {
        throw new Error(updateResult.error || '更新设置失败');
      }
    } catch (error) {
      console.error('更新自定义搜索源失败:', error);
      this.showNotification(error.message, 'error');
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 删除自定义搜索源
  async deleteCustomSource(sourceId) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }
      
      if (!sourceId) {
        throw new Error('搜索源ID不能为空');
      }
      
      // 获取当前设置
      const { success, settings } = await this.userSettingsService.getSettings();
      if (!success) {
        throw new Error('获取用户设置失败');
      }

      let customSources = settings.customSearchSources || [];
      let enabledSources = settings.searchSources || [];
      
      const sourceExists = customSources.some(s => s.id === sourceId);
      if (!sourceExists) {
        throw new Error('未找到指定的自定义搜索源');
      }
      
      // 从自定义源列表中删除
      customSources = customSources.filter(s => s.id !== sourceId);
      
      // 从启用列表中删除
      enabledSources = enabledSources.filter(id => id !== sourceId);
      
      // 更新设置
      const updateResult = await this.userSettingsService.updateSettings({
        ...settings,
        customSearchSources: customSources,
        searchSources: enabledSources
      });

      if (updateResult.success) {
        // 清除缓存
        this.clearSourcesCache();
        
        this.showNotification('搜索源删除成功', 'success');
        
        return { 
          success: true, 
          message: '搜索源删除成功' 
        };
      } else {
        throw new Error(updateResult.error || '更新设置失败');
      }
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      this.showNotification(error.message, 'error');
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取搜索源分类
  async getSourceCategories() {
    try {
      const { success, sources } = await this.getAllAvailableSources();
      
      if (success) {
        const categories = new Set();
        
        sources.forEach(source => {
          if (source.category) {
            categories.add(source.category);
          }
        });

        const categoryList = Array.from(categories).map(category => ({
          id: category,
          name: this.getCategoryDisplayName(category),
          icon: this.getCategoryIcon(category)
        }));

        return { 
          success: true, 
          categories: categoryList 
        };
      } else {
        throw new Error('获取搜索源失败');
      }
    } catch (error) {
      console.error('获取搜索源分类失败:', error);
      return { 
        success: false, 
        categories: this.getDefaultCategories(),
        error: error.message 
      };
    }
  }

  // 按分类获取搜索源
  async getSourcesByCategory(category = 'all') {
    try {
      const { success, sources } = await this.getAllAvailableSources();
      
      if (success) {
        const filteredSources = category === 'all' 
          ? sources 
          : sources.filter(source => source.category === category);
          
        return { 
          success: true, 
          sources: filteredSources,
          category 
        };
      } else {
        throw new Error('获取搜索源失败');
      }
    } catch (error) {
      console.error('按分类获取搜索源失败:', error);
      return { 
        success: false, 
        sources: [],
        error: error.message 
      };
    }
  }

  // 导入搜索源
  async importSources(sourcesData) {
    try {
      if (!this.authService?.isAuthenticated()) {
        throw new Error('用户未登录');
      }

      if (!Array.isArray(sourcesData)) {
        throw new Error('导入数据格式错误');
      }

      const validSources = sourcesData.filter(source => {
        return source && source.name && source.urlTemplate && 
               source.urlTemplate.includes('{keyword}');
      });

      if (validSources.length === 0) {
        throw new Error('没有有效的搜索源可导入');
      }

      // 获取当前设置
      const { success, settings } = await this.userSettingsService.getSettings();
      if (!success) {
        throw new Error('获取用户设置失败');
      }

      const customSources = settings.customSearchSources || [];
      const newSources = [];

      validSources.forEach(source => {
        // 生成唯一ID
        const id = `custom_import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 检查名称重复
        const nameExists = customSources.some(s => s.name === source.name);
        const finalName = nameExists ? `${source.name}_导入` : source.name;

        const newSource = {
          id,
          name: finalName,
          subtitle: source.subtitle || '导入的搜索源',
          icon: source.icon || '🔍',
          urlTemplate: source.urlTemplate,
          category: source.category || 'other',
          isCustom: true,
          createdAt: Date.now(),
          description: source.description || ''
        };

        newSources.push(newSource);
      });

      const updatedCustomSources = [...customSources, ...newSources];

      // 更新设置
      const updateResult = await this.userSettingsService.updateSettings({
        ...settings,
        customSearchSources: updatedCustomSources
      });

      if (updateResult.success) {
        // 清除缓存
        this.clearSourcesCache();
        
        this.showNotification(`成功导入 ${newSources.length} 个搜索源`, 'success');
        
        return { 
          success: true, 
          message: `成功导入 ${newSources.length} 个搜索源`,
          importedCount: newSources.length 
        };
      } else {
        throw new Error(updateResult.error || '更新设置失败');
      }
    } catch (error) {
      console.error('导入搜索源失败:', error);
      this.showNotification(error.message, 'error');
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 导出搜索源
  async exportSources(includeBuiltin = false) {
    try {
      const { success, sources } = await this.getAllAvailableSources();
      
      if (!success) {
        throw new Error('获取搜索源失败');
      }

      let exportSources;
      if (includeBuiltin) {
        exportSources = sources;
      } else {
        exportSources = sources.filter(source => source.isCustom);
      }

      const exportData = {
        sources: exportSources,
        exportTime: new Date().toISOString(),
        totalCount: exportSources.length,
        includeBuiltin,
        version: '1.0'
      };

      return { 
        success: true, 
        data: JSON.stringify(exportData, null, 2),
        filename: `search_sources_${new Date().toISOString().split('T')[0]}.json`,
        count: exportSources.length 
      };
    } catch (error) {
      console.error('导出搜索源失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 测试搜索源
  async testSource(source, testKeyword = 'MIMK-186') {
    try {
      if (!source || !source.urlTemplate) {
        throw new Error('搜索源数据不完整');
      }

      const testUrl = source.urlTemplate.replace('{keyword}', encodeURIComponent(testKeyword));
      
      // 这里可以添加实际的URL测试逻辑
      // 目前只返回构造的URL作为测试结果
      
      return { 
        success: true, 
        testUrl,
        message: '搜索源URL构造成功',
        status: 'untested' // 可以是 'success', 'failed', 'timeout'
      };
    } catch (error) {
      console.error('测试搜索源失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取默认搜索源
  getDefaultSources() {
    const defaultSources = ['javbus', 'javdb', 'javlibrary'];
    return APP_CONSTANTS.SEARCH_SOURCES.filter(
      source => defaultSources.includes(source.id)
    );
  }

  // 获取默认分类
  getDefaultCategories() {
    return [
      { id: 'jav', name: 'JAV', icon: '🎬' },
      { id: 'movie', name: '电影', icon: '🎭' },
      { id: 'torrent', name: '种子', icon: '🌱' },
      { id: 'other', name: '其他', icon: '📂' }
    ];
  }

  // 获取分类显示名称
  getCategoryDisplayName(category) {
    const categoryNames = {
      'jav': 'JAV',
      'movie': '电影',
      'torrent': '种子',
      'other': '其他'
    };
    
    return categoryNames[category] || category;
  }

  // 获取分类图标
  getCategoryIcon(category) {
    const categoryIcons = {
      'jav': '🎬',
      'movie': '🎭',
      'torrent': '🌱',
      'other': '📂'
    };
    
    return categoryIcons[category] || '📁';
  }

  // 验证搜索源数据
  validateSourceData(sourceData) {
    const errors = [];

    if (!sourceData.name || sourceData.name.trim().length < 2) {
      errors.push('搜索源名称长度至少2个字符');
    }

    if (!sourceData.urlTemplate) {
      errors.push('URL模板不能为空');
    } else if (!sourceData.urlTemplate.includes('{keyword}')) {
      errors.push('URL模板必须包含{keyword}占位符');
    }

    try {
      new URL(sourceData.urlTemplate.replace('{keyword}', 'test'));
    } catch (error) {
      errors.push('URL模板格式无效');
    }

    const validCategories = ['jav', 'movie', 'torrent', 'other'];
    if (sourceData.category && !validCategories.includes(sourceData.category)) {
      errors.push('无效的分类');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 缓存管理
  cacheSource(sources) {
    this.sourcesCache = sources;
    this.cacheTimestamp = Date.now();
  }

  isSourcesCacheValid() {
    return this.sourcesCache && 
           this.cacheTimestamp && 
           Date.now() - this.cacheTimestamp < this.cacheExpiry;
  }

  clearSourcesCache() {
    this.sourcesCache = null;
    this.cacheTimestamp = null;
  }

  // 获取搜索源统计
  getSourcesStats() {
    const sources = this.sourcesCache || [];
    
    const stats = {
      total: sources.length,
      builtin: sources.filter(s => !s.isCustom).length,
      custom: sources.filter(s => s.isCustom).length,
      byCategory: {}
    };

    sources.forEach(source => {
      const category = source.category || 'other';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    return stats;
  }

  // 工具方法
  showNotification(message, type = 'info') {
    if (this.notificationService) {
      this.notificationService.showToast(message, type);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, type);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  // 健康检查
  healthCheck() {
    const dependenciesStatus = {
      apiClient: !!this.apiClient,
      authService: !!this.authService,
      userSettingsService: !!this.userSettingsService,
      notificationService: !!this.notificationService
    };

    return {
      status: 'healthy',
      dependencies: dependenciesStatus,
      cacheValid: this.isSourcesCacheValid(),
      cacheSize: this.sourcesCache?.length || 0,
      stats: this.getSourcesStats(),
      timestamp: Date.now()
    };
  }

  // 销毁服务
  destroy() {
    this.clearSourcesCache();
  }
}
export { SearchSourcesService };
export default SearchSourcesService;