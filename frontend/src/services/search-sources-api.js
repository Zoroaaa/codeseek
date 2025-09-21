// src/services/search-sources-api.js - 优化版本：修复前后端字段匹配问题
import { APP_CONSTANTS } from '../core/constants.js';
import { generateId } from '../utils/helpers.js';

class SearchSourcesAPI {
  constructor() {
    this.baseURL = this.getAPIBaseURL();
    this.token = localStorage.getItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
    this.maxRetries = 3;
    this.retryDelay = 1000;
    
    // 缓存机制
    this.cache = new Map();
    this.cacheExpiry = {
      majorCategories: 600000,    // 10分钟
      categories: 300000,         // 5分钟
      sources: 300000,            // 5分钟
      userConfigs: 120000,        // 2分钟
      stats: 60000                // 1分钟
    };
    
    // 请求统计
    this.requestStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      averageResponseTime: 0
    };
  }

  // 从环境变量或配置获取API基础URL
  getAPIBaseURL() {
    if (window.API_CONFIG && window.API_CONFIG.BASE_URL) {
      return window.API_CONFIG.BASE_URL;
    }
    
    const isDev = window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1';
    
    if (isDev) {
      return window.API_CONFIG?.DEV_URL || 'http://localhost:8787';
    }
    
    return window.API_CONFIG?.PROD_URL || 'https://backend.codeseek.pp.ua';
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(APP_CONSTANTS.STORAGE_KEYS.AUTH_TOKEN);
      this.clearCache();
    }
  }

  // 增强的请求方法，带缓存和统计
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = this.getCacheKey(endpoint, options);
    const startTime = Date.now();
    
    // 检查缓存
    if (options.method === 'GET' || !options.method) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        this.requestStats.cacheHits++;
        console.log(`缓存命中: ${endpoint}`);
        return cached;
      }
    }
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method: 'GET',
      credentials: 'omit',
      ...options,
      headers
    };

    this.requestStats.totalRequests++;
    
    let lastError;
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (!navigator.onLine) {
          throw new Error('网络连接不可用');
        }
        
        const response = await fetch(url, config);
        
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          let result;
          
          if (contentType && contentType.includes('application/json')) {
            result = await response.json();
          } else {
            result = await response.text();
          }
          
          // 缓存GET请求结果
          if (options.method === 'GET' || !options.method) {
            this.setToCache(cacheKey, result, this.getCacheExpiry(endpoint));
          }
          
          // 更新统计
          const responseTime = Date.now() - startTime;
          this.updateStats('success', responseTime);
          
          return result;
        }
        
        if (response.status === 401) {
          this.setToken(null);
          throw new Error('认证失败，请重新登录');
        }
        
        if (response.status >= 500 && attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        
        const errorText = await response.text().catch(() => '');
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          if (errorText) errorMessage += `: ${errorText}`;
        }
        
        throw new Error(errorMessage);
        
      } catch (error) {
        lastError = error;
        
        if ((error.name === 'TypeError' || error.message.includes('fetch')) && 
            attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * (attempt + 1));
          continue;
        }
        break;
      }
    }
    
    this.updateStats('error');
    console.error(`搜索源管理API请求失败 (${endpoint}):`, lastError);
    throw lastError;
  }

  // 缓存相关方法
  getCacheKey(endpoint, options) {
    const method = options.method || 'GET';
    const params = new URLSearchParams(new URL(`${this.baseURL}${endpoint}`).search).toString();
    return `${method}:${endpoint}:${params}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  setToCache(key, data, expiry) {
    // 限制缓存大小
    if (this.cache.size >= 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data,
      expiry: Date.now() + expiry,
      timestamp: Date.now()
    });
  }

  getCacheExpiry(endpoint) {
    if (endpoint.includes('major-categories')) return this.cacheExpiry.majorCategories;
    if (endpoint.includes('categories')) return this.cacheExpiry.categories;
    if (endpoint.includes('sources')) return this.cacheExpiry.sources;
    if (endpoint.includes('user-configs')) return this.cacheExpiry.userConfigs;
    if (endpoint.includes('stats')) return this.cacheExpiry.stats;
    return 300000; // 默认5分钟
  }

  clearCache() {
    this.cache.clear();
    console.log('搜索源API缓存已清空');
  }

  // 统计更新方法
  updateStats(type, responseTime = 0) {
    switch (type) {
      case 'success':
        this.requestStats.successfulRequests++;
        if (responseTime > 0) {
          this.requestStats.averageResponseTime = Math.round(
            (this.requestStats.averageResponseTime + responseTime) / 2
          );
        }
        break;
      case 'error':
        this.requestStats.failedRequests++;
        break;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===================== 搜索源大类管理 =====================

  // 获取所有搜索源大类
  async getMajorCategories() {
    try {
      const response = await this.request('/api/search-sources/major-categories');
      return response.majorCategories || [];
    } catch (error) {
      console.error('获取搜索源大类失败:', error);
      return [];
    }
  }

  // 创建搜索源大类 (需要管理员权限)
  async createMajorCategory(majorCategoryData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    // 验证输入数据
    const validation = this.validateMajorCategoryData(majorCategoryData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      const result = await this.request('/api/search-sources/major-categories', {
        method: 'POST',
        body: JSON.stringify({
          name: majorCategoryData.name.trim(),
          description: majorCategoryData.description?.trim() || '',
          icon: majorCategoryData.icon?.trim() || '🌟',
          color: majorCategoryData.color?.trim() || '#6b7280',
          requiresKeyword: majorCategoryData.requiresKeyword !== false
        })
      });
      
      // 清除相关缓存
      this.invalidateCache(['major-categories', 'categories', 'stats']);
      
      return result;
    } catch (error) {
      console.error('创建搜索源大类失败:', error);
      throw error;
    }
  }

  // 验证大类数据
  validateMajorCategoryData(data) {
    const errors = [];
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('大类名称不能为空');
    }
    
    if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH) {
      errors.push(`大类名称不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH}个字符`);
    }
    
    if (data.description && data.description.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_DESC_LENGTH) {
      errors.push(`大类描述不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_DESC_LENGTH}个字符`);
    }
    
    if (data.color && !APP_CONSTANTS.VALIDATION_RULES.MAJOR_CATEGORY.COLOR_PATTERN.test(data.color)) {
      errors.push('颜色格式不正确');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ===================== 搜索源分类管理 =====================

  // 获取用户的搜索源分类
  async getSourceCategories(options = {}) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.majorCategory) {
        params.append('majorCategory', options.majorCategory);
      }
      if (options.includeSystem !== undefined) {
        params.append('includeSystem', options.includeSystem.toString());
      }

      const endpoint = `/api/search-sources/categories${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.request(endpoint);
      return response.categories || [];
    } catch (error) {
      console.error('获取搜索源分类失败:', error);
      return [];
    }
  }

  // 创建搜索源分类
  async createSourceCategory(categoryData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    // 验证输入数据
    const validation = this.validateCategoryData(categoryData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      const result = await this.request('/api/search-sources/categories', {
        method: 'POST',
        body: JSON.stringify({
          majorCategoryId: categoryData.majorCategoryId.trim(),
          name: categoryData.name.trim(),
          description: categoryData.description?.trim() || '',
          icon: categoryData.icon?.trim() || '📁',
          color: categoryData.color?.trim() || '#3b82f6',
          defaultSearchable: categoryData.defaultSearchable !== false,
          defaultSiteType: categoryData.defaultSiteType || 'search',
          searchPriority: Math.min(Math.max(parseInt(categoryData.searchPriority) || 5, 1), 10)
        })
      });
      
      // 清除相关缓存
      this.invalidateCache(['categories', 'sources', 'stats']);
      
      return result;
    } catch (error) {
      console.error('创建搜索源分类失败:', error);
      throw error;
    }
  }

  // 验证分类数据
  validateCategoryData(data) {
    const errors = [];
    
    if (!data.majorCategoryId || typeof data.majorCategoryId !== 'string') {
      errors.push('大类ID不能为空');
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('分类名称不能为空');
    }
    
    if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH) {
      errors.push(`分类名称不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH}个字符`);
    }
    
    if (data.description && data.description.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_DESC_LENGTH) {
      errors.push(`分类描述不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_DESC_LENGTH}个字符`);
    }
    
    if (data.color && !APP_CONSTANTS.VALIDATION_RULES.CATEGORY.COLOR_PATTERN.test(data.color)) {
      errors.push('颜色格式不正确');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 更新搜索源分类
  async updateSourceCategory(categoryId, updateData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!categoryId) {
      throw new Error('分类ID不能为空');
    }

    // 验证更新数据
    const validation = this.validateCategoryUpdateData(updateData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      const cleanedData = {};
      
      // 清理和验证更新数据
      if (updateData.name !== undefined) cleanedData.name = updateData.name.trim();
      if (updateData.description !== undefined) cleanedData.description = updateData.description.trim();
      if (updateData.icon !== undefined) cleanedData.icon = updateData.icon.trim();
      if (updateData.color !== undefined) cleanedData.color = updateData.color.trim();
      if (updateData.defaultSearchable !== undefined) cleanedData.defaultSearchable = updateData.defaultSearchable;
      if (updateData.defaultSiteType !== undefined) cleanedData.defaultSiteType = updateData.defaultSiteType;
      if (updateData.searchPriority !== undefined) {
        cleanedData.searchPriority = Math.min(Math.max(parseInt(updateData.searchPriority) || 5, 1), 10);
      }

      const result = await this.request(`/api/search-sources/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify(cleanedData)
      });
      
      // 清除相关缓存
      this.invalidateCache(['categories', 'sources', 'stats']);
      
      return result;
    } catch (error) {
      console.error('更新搜索源分类失败:', error);
      throw error;
    }
  }

  // 验证分类更新数据
  validateCategoryUpdateData(data) {
    const errors = [];
    
    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
      errors.push('分类名称不能为空');
    }
    
    if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH) {
      errors.push(`分类名称不能超过${APP_CONSTANTS.LIMITS.MAX_CATEGORY_NAME_LENGTH}个字符`);
    }
    
    if (data.color && !APP_CONSTANTS.VALIDATION_RULES.CATEGORY.COLOR_PATTERN.test(data.color)) {
      errors.push('颜色格式不正确');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 删除搜索源分类
  async deleteSourceCategory(categoryId) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!categoryId) {
      throw new Error('分类ID不能为空');
    }

    try {
      const result = await this.request(`/api/search-sources/categories/${categoryId}`, {
        method: 'DELETE'
      });
      
      // 清除相关缓存
      this.invalidateCache(['categories', 'sources', 'stats']);
      
      return result;
    } catch (error) {
      console.error('删除搜索源分类失败:', error);
      throw error;
    }
  }

  // ===================== 搜索源管理 =====================

  // 获取用户的搜索源
  async getSearchSources(options = {}) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.category) params.append('category', options.category);
      if (options.majorCategory) params.append('majorCategory', options.majorCategory);
      if (options.searchable !== undefined) params.append('searchable', options.searchable.toString());
      if (options.includeSystem !== undefined) params.append('includeSystem', options.includeSystem.toString());
      if (options.enabledOnly !== undefined) params.append('enabledOnly', options.enabledOnly.toString());

      const endpoint = `/api/search-sources/sources${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.request(endpoint);
      return response.sources || [];
    } catch (error) {
      console.error('获取搜索源失败:', error);
      return [];
    }
  }

  // 创建搜索源
  async createSearchSource(sourceData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    // 验证输入数据
    const validation = this.validateSourceData(sourceData);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      const result = await this.request('/api/search-sources/sources', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: sourceData.categoryId.trim(),
          name: sourceData.name.trim(),
          subtitle: sourceData.subtitle?.trim() || '',
          description: sourceData.description?.trim() || '',
          icon: sourceData.icon?.trim() || '🔍',
          urlTemplate: sourceData.urlTemplate.trim(),
          homepageUrl: sourceData.homepageUrl?.trim() || '',
          siteType: sourceData.siteType || 'search',
          searchable: sourceData.searchable !== false,
          requiresKeyword: sourceData.requiresKeyword !== false,
          searchPriority: Math.min(Math.max(parseInt(sourceData.searchPriority) || 5, 1), 10),
          supportsDetailExtraction: sourceData.supportsDetailExtraction === true,
          extractionQuality: sourceData.extractionQuality || 'none',
          supportedFeatures: Array.isArray(sourceData.supportedFeatures) ? sourceData.supportedFeatures : []
        })
      });
      
      // 清除相关缓存
      this.invalidateCache(['sources', 'user-configs', 'stats']);
      
      return result;
    } catch (error) {
      console.error('创建搜索源失败:', error);
      throw error;
    }
  }

  // 验证搜索源数据
  validateSourceData(data) {
    const errors = [];
    
    if (!data.categoryId || typeof data.categoryId !== 'string') {
      errors.push('分类ID不能为空');
    }
    
    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('搜索源名称不能为空');
    }
    
    if (data.name && data.name.length > APP_CONSTANTS.LIMITS.MAX_SOURCE_NAME_LENGTH) {
      errors.push(`搜索源名称不能超过${APP_CONSTANTS.LIMITS.MAX_SOURCE_NAME_LENGTH}个字符`);
    }
    
    if (!data.urlTemplate || typeof data.urlTemplate !== 'string' || data.urlTemplate.trim().length === 0) {
      errors.push('URL模板不能为空');
    }
    
    // 验证URL模板格式
    if (data.urlTemplate && data.searchable !== false && !data.urlTemplate.includes('{keyword}')) {
      errors.push('搜索源的URL模板必须包含{keyword}占位符');
    }
    
    if (data.urlTemplate && !APP_CONSTANTS.VALIDATION_RULES.SOURCE.URL_PATTERN.test(data.urlTemplate)) {
      errors.push('URL模板格式不正确');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // 更新搜索源
  async updateSearchSource(sourceId, updateData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }

    try {
      const cleanedData = {};
      
      // 清理和验证更新数据
      if (updateData.categoryId !== undefined) cleanedData.categoryId = updateData.categoryId.trim();
      if (updateData.name !== undefined) cleanedData.name = updateData.name.trim();
      if (updateData.subtitle !== undefined) cleanedData.subtitle = updateData.subtitle.trim();
      if (updateData.description !== undefined) cleanedData.description = updateData.description.trim();
      if (updateData.icon !== undefined) cleanedData.icon = updateData.icon.trim();
      if (updateData.urlTemplate !== undefined) {
        cleanedData.urlTemplate = updateData.urlTemplate.trim();
        // 验证URL模板格式
        if (updateData.searchable !== false && !cleanedData.urlTemplate.includes('{keyword}')) {
          throw new Error('搜索源的URL模板必须包含{keyword}占位符');
        }
      }
      if (updateData.homepageUrl !== undefined) cleanedData.homepageUrl = updateData.homepageUrl.trim();
      if (updateData.siteType !== undefined) cleanedData.siteType = updateData.siteType;
      if (updateData.searchable !== undefined) cleanedData.searchable = updateData.searchable;
      if (updateData.requiresKeyword !== undefined) cleanedData.requiresKeyword = updateData.requiresKeyword;
      if (updateData.searchPriority !== undefined) {
        cleanedData.searchPriority = Math.min(Math.max(parseInt(updateData.searchPriority) || 5, 1), 10);
      }
      if (updateData.supportsDetailExtraction !== undefined) cleanedData.supportsDetailExtraction = updateData.supportsDetailExtraction;
      if (updateData.extractionQuality !== undefined) cleanedData.extractionQuality = updateData.extractionQuality;
      if (updateData.supportedFeatures !== undefined) {
        cleanedData.supportedFeatures = Array.isArray(updateData.supportedFeatures) ? updateData.supportedFeatures : [];
      }

      const result = await this.request(`/api/search-sources/sources/${sourceId}`, {
        method: 'PUT',
        body: JSON.stringify(cleanedData)
      });
      
      // 清除相关缓存
      this.invalidateCache(['sources', 'user-configs', 'stats']);
      
      return result;
    } catch (error) {
      console.error('更新搜索源失败:', error);
      throw error;
    }
  }

  // 删除搜索源
  async deleteSearchSource(sourceId) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!sourceId) {
      throw new Error('搜索源ID不能为空');
    }

    try {
      const result = await this.request(`/api/search-sources/sources/${sourceId}`, {
        method: 'DELETE'
      });
      
      // 清除相关缓存
      this.invalidateCache(['sources', 'user-configs', 'stats']);
      
      return result;
    } catch (error) {
      console.error('删除搜索源失败:', error);
      throw error;
    }
  }

  // ===================== 用户搜索源配置管理 =====================

  // 获取用户搜索源配置
  async getUserSourceConfigs() {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    try {
      const response = await this.request('/api/search-sources/user-configs');
      return response.configs || [];
    } catch (error) {
      console.error('获取用户搜索源配置失败:', error);
      return [];
    }
  }

  // 更新用户搜索源配置
  async updateUserSourceConfig(configData) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!configData.sourceId) {
      throw new Error('搜索源ID不能为空');
    }

    try {
      const result = await this.request('/api/search-sources/user-configs', {
        method: 'POST',
        body: JSON.stringify({
          sourceId: configData.sourceId.trim(),
          isEnabled: configData.isEnabled !== false,
          customPriority: configData.customPriority ? Math.min(Math.max(parseInt(configData.customPriority), 1), 10) : null,
          customName: configData.customName?.trim() || null,
          customSubtitle: configData.customSubtitle?.trim() || null,
          customIcon: configData.customIcon?.trim() || null,
          notes: configData.notes?.trim() || null
        })
      });
      
      // 清除相关缓存
      this.invalidateCache(['user-configs', 'sources', 'stats']);
      
      return result;
    } catch (error) {
      console.error('更新用户搜索源配置失败:', error);
      throw error;
    }
  }

  // 批量更新用户搜索源配置
  async batchUpdateUserSourceConfigs(configs) {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error('配置列表不能为空');
    }

    try {
      // 清理和验证配置数据
      const cleanedConfigs = configs.map(config => ({
        sourceId: config.sourceId.trim(),
        isEnabled: config.isEnabled !== false,
        customPriority: config.customPriority ? Math.min(Math.max(parseInt(config.customPriority), 1), 10) : null,
        customName: config.customName?.trim() || null,
        customSubtitle: config.customSubtitle?.trim() || null,
        customIcon: config.customIcon?.trim() || null,
        notes: config.notes?.trim() || null
      }));

      const result = await this.request('/api/search-sources/user-configs/batch', {
        method: 'POST',
        body: JSON.stringify({ configs: cleanedConfigs })
      });
      
      // 清除相关缓存
      this.invalidateCache(['user-configs', 'sources', 'stats']);
      
      return result;
    } catch (error) {
      console.error('批量更新用户搜索源配置失败:', error);
      throw error;
    }
  }

  // ===================== 便捷方法 =====================

  // 切换搜索源可用状态
  async toggleSourceEnabled(sourceId, enabled) {
    return await this.updateUserSourceConfig({
      sourceId,
      isEnabled: enabled
    });
  }

  // 批量可用/禁用搜索源
  async batchToggleSources(sourceIds, enabled) {
    const configs = sourceIds.map(sourceId => ({
      sourceId,
      isEnabled: enabled
    }));
    return await this.batchUpdateUserSourceConfigs(configs);
  }

  // 可用所有搜索源
  async enableAllSources() {
    try {
      const sources = await this.getSearchSources({ includeSystem: true });
      const configs = sources.map(source => ({
        sourceId: source.id,
        isEnabled: true
      }));
      return await this.batchUpdateUserSourceConfigs(configs);
    } catch (error) {
      console.error('可用所有搜索源失败:', error);
      throw error;
    }
  }

  // 禁用所有搜索源
  async disableAllSources() {
    try {
      const sources = await this.getSearchSources({ includeSystem: true });
      const configs = sources.map(source => ({
        sourceId: source.id,
        isEnabled: false
      }));
      return await this.batchUpdateUserSourceConfigs(configs);
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      throw error;
    }
  }

  // 重置为默认配置
  async resetToDefaults() {
    try {
      // 获取所有搜索源
      const sources = await this.getSearchSources({ includeSystem: true });
      
      // 默认可用的搜索源ID列表（回退到基本搜索源）
      const defaultEnabledSources = ['javbus', 'javdb', 'javlibrary', 'btsow'];
      
      const configs = sources.map(source => ({
        sourceId: source.id,
        isEnabled: defaultEnabledSources.includes(source.id),
        customPriority: null,
        customName: null,
        customSubtitle: null,
        customIcon: null,
        notes: null
      }));
      
      return await this.batchUpdateUserSourceConfigs(configs);
    } catch (error) {
      console.error('重置为默认配置失败:', error);
      throw error;
    }
  }

  // ===================== 统计和导出功能 =====================

  // 获取搜索源统计信息
  async getSearchSourceStats() {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    try {
      const response = await this.request('/api/search-sources/stats');
      return response;
    } catch (error) {
      console.error('获取搜索源统计信息失败:', error);
      return {
        overview: {
          majorCategories: 0,
          categories: 0,
          totalSources: 0,
          enabledSources: 0
        },
        majorCategoryStats: []
      };
    }
  }

  // 导出用户搜索源配置
  async exportUserSearchSources() {
    if (!this.token) {
      throw new Error('用户未登录');
    }

    try {
      const response = await this.request('/api/search-sources/export');
      return response;
    } catch (error) {
      console.error('导出搜索源配置失败:', error);
      throw error;
    }
  }

  // ===================== 缓存管理方法 =====================
  invalidateCache(patterns) {
    let deletedCount = 0;
    
    for (const [key] of this.cache) {
      const shouldDelete = patterns.some(pattern => key.includes(pattern));
      if (shouldDelete) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      console.log(`已清除 ${deletedCount} 个相关缓存项`);
    }
  }

  // 获取API统计信息
  getApiStats() {
    return {
      ...this.requestStats,
      cacheSize: this.cache.size,
      cacheHitRate: this.requestStats.totalRequests > 0 ? 
        ((this.requestStats.cacheHits / this.requestStats.totalRequests) * 100).toFixed(1) + '%' : '0%',
      successRate: this.requestStats.totalRequests > 0 ? 
        ((this.requestStats.successfulRequests / this.requestStats.totalRequests) * 100).toFixed(1) + '%' : '0%'
    };
  }

  // 健康检查
  async performHealthCheck() {
    try {
      const startTime = Date.now();
      await this.request('/api/search-sources/major-categories');
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        apiStats: this.getApiStats(),
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        apiStats: this.getApiStats(),
        timestamp: Date.now()
      };
    }
  }

  // ===================== 兼容性方法 =====================

  // 为了兼容现有代码，提供一些兼容性方法

  // 获取可用的搜索源（兼容原有接口）
  async getEnabledSearchSources() {
    try {
      return await this.getSearchSources({ enabledOnly: true });
    } catch (error) {
      console.error('获取可用的搜索源失败:', error);
      return [];
    }
  }

  // 获取所有分类（兼容原有接口）
  async getAllCategories() {
    try {
      return await this.getSourceCategories({ includeSystem: true });
    } catch (error) {
      console.error('获取所有分类失败:', error);
      return [];
    }
  }

  // 获取所有搜索源（兼容原有接口）
  async getAllSearchSources() {
    try {
      return await this.getSearchSources({ includeSystem: true });
    } catch (error) {
      console.error('获取所有搜索源失败:', error);
      return [];
    }
  }
}

// 创建搜索源管理API实例
export const searchSourcesAPI = new SearchSourcesAPI();
export default searchSourcesAPI;