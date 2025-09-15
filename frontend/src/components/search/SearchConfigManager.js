// src/components/search/SearchConfigManager.js - 统一配置管理组件 v2.0.0
// 完全适配新架构：模块化解析器、统一数据结构、动态配置管理、服务健康监控
import { showToast, showLoading } from '../../utils/dom.js';
import { escapeHtml, formatRelativeTime } from '../../utils/format.js';
import detailConfigAPI from '../../services/detail-config-api.js';
import authManager from '../../services/auth.js';
import apiService from '../../services/api.js';
import {
  CONFIG_FIELD_GROUPS,
  CONFIG_PRESETS,
  DEFAULT_USER_CONFIG,
  CONFIG_VALIDATION_RULES,
  detectConfigChanges,
  ARCHITECTURE_FEATURES,
  SERVICE_STATUS,
  SUPPORTED_SOURCE_TYPES,
  assessConfigPerformanceImpact,
  generateConfigRecommendations,
  checkConfigCompatibility
} from '../../core/detail-config.js';

export class SearchConfigManager {
  constructor() {
    // 基础搜索配置
    this.config = {
      // 基础搜索配置
      useCache: true,
      saveToHistory: true,
      
      // 详情提取配置 - 从DEFAULT_USER_CONFIG继承
      ...DEFAULT_USER_CONFIG
    };
    
    // 🆕 新架构版本和特性
    this.version = '2.0.0';
    this.architectureFeatures = {
      modularParsers: true,
      unifiedDataStructure: true,
      dynamicConfiguration: true,
      enhancedErrorHandling: true,
      serviceHealthMonitoring: true,
      parserValidation: true,
      serviceStats: true
    };
    
    // 配置管理状态
    this.isInitialized = false;
    this.originalConfig = null;
    this.hasUnsavedChanges = false;
    this.validationErrors = [];
    this.validationWarnings = [];
    
    // 配置缓存
    this.configCache = null;
    this.configCacheTime = 0;
    this.configCacheExpiration = 5 * 60 * 1000; // 5分钟本地缓存
    
    // UI管理
    this.configUIContainer = null;
    this.configForm = null;
    this.presetSelector = null;
    this.saveButton = null;
    this.resetButton = null;
    this.previewContainer = null;
    this.alertsContainer = null;
    this.serviceStatusContainer = null;
    this.supportedSitesContainer = null;
    
    // 配置变更监听器
    this.changeListeners = new Set();
    this.validationTimer = null;
    this.previewDebounceTimer = null;
    this.healthCheckTimer = null;
    
    // 🆕 新架构数据
    this.configMetadata = null;
    this.availablePresets = CONFIG_PRESETS;
    this.usageStats = null;
    this.isUsingDefault = true;
    this.supportedSites = [];
    this.serviceStats = null;
    this.serviceHealth = null;
    this.parserCapabilities = {};
    
    // 🆕 性能监控
    this.performanceMetrics = [];
    this.healthCheckHistory = [];
    this.configChangeHistory = [];
  }

  /**
   * 初始化配置管理器 - 增强新架构支持
   */
  async init() {
    if (this.isInitialized) return;

    try {
      console.log(`开始初始化统一配置管理器 (v${this.version})...`);
      
      await this.loadUserConfig();
      await this.loadArchitectureData();
      this.setupConfigChangeListeners();
      this.startHealthMonitoring();
      this.exposeGlobalMethods();
      
      this.isInitialized = true;
      console.log(`统一配置管理器初始化完成 (v${this.version})`);
      console.log('支持的架构特性:', this.architectureFeatures);
    } catch (error) {
      console.error('配置管理器初始化失败:', error);
      this.resetToDefaultConfig();
    }
  }

  /**
   * 🆕 加载架构数据
   */
  async loadArchitectureData() {
    if (!authManager.isAuthenticated()) {
      console.log('用户未认证，跳过架构数据加载');
      return;
    }

    try {
      // 并行加载架构相关数据
      const [supportedSitesData, serviceStatsData] = await Promise.allSettled([
        detailConfigAPI.getSupportedSites(),
        detailConfigAPI.getServiceStats()
      ]);

      // 处理支持的站点数据
      if (supportedSitesData.status === 'fulfilled') {
        this.supportedSites = supportedSitesData.value.sites || [];
        this.parserCapabilities = supportedSitesData.value.capabilities || {};
        console.log(`加载了 ${this.supportedSites.length} 个支持的站点`);
      }

      // 处理服务统计数据
      if (serviceStatsData.status === 'fulfilled') {
        this.serviceStats = serviceStatsData.value.stats || {};
        console.log('服务统计数据已加载');
      }

    } catch (error) {
      console.warn('加载架构数据失败:', error);
    }
  }

  /**
   * 🆕 开始健康监控
   */
  startHealthMonitoring() {
    if (!authManager.isAuthenticated()) return;

    // 定期检查服务健康状态
    this.healthCheckTimer = setInterval(async () => {
      try {
        const healthData = await this.checkServiceHealth();
        this.updateServiceHealthStatus(healthData);
      } catch (error) {
        console.warn('健康检查失败:', error);
      }
    }, 30000); // 每30秒检查一次
  }

  /**
   * 🆕 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const startTime = performance.now();
      
      // 并行检查各个服务组件
      const [configHealth, extractionHealth, parserHealth] = await Promise.allSettled([
        detailConfigAPI.checkServiceHealth(),
        this.checkExtractionServiceHealth(),
        this.checkParserValidation()
      ]);
      
      const responseTime = performance.now() - startTime;
      
      const healthData = {
        overall: {
          healthy: configHealth.status === 'fulfilled' && configHealth.value.healthy,
          responseTime,
          timestamp: Date.now(),
          version: this.version
        },
        components: {
          config: configHealth.status === 'fulfilled' && configHealth.value.healthy,
          extraction: extractionHealth.status === 'fulfilled' && extractionHealth.value.healthy,
          parser: parserHealth.status === 'fulfilled' && parserHealth.value.valid
        },
        details: {
          configHealth: configHealth.status === 'fulfilled' ? configHealth.value : { error: configHealth.reason },
          extractionHealth: extractionHealth.status === 'fulfilled' ? extractionHealth.value : { error: extractionHealth.reason },
          parserHealth: parserHealth.status === 'fulfilled' ? parserHealth.value : { error: parserHealth.reason }
        },
        architecture: {
          version: this.version,
          features: this.architectureFeatures,
          supportedParsers: this.supportedSites.length
        }
      };

      // 记录健康检查历史
      this.healthCheckHistory.push({
        timestamp: Date.now(),
        health: healthData.overall.healthy,
        responseTime
      });

      // 保持最近50次记录
      if (this.healthCheckHistory.length > 50) {
        this.healthCheckHistory.shift();
      }

      return healthData;
    } catch (error) {
      console.error('健康检查失败:', error);
      return {
        overall: { healthy: false, error: error.message, timestamp: Date.now() },
        components: { config: false, extraction: false, parser: false },
        details: { error: error.message },
        architecture: { version: this.version, features: this.architectureFeatures }
      };
    }
  }

  /**
   * 🆕 检查提取服务健康状态
   */
  async checkExtractionServiceHealth() {
    try {
      // 通过验证解析器来检查提取服务
      const testValidation = await detailConfigAPI.validateParser('generic');
      return {
        healthy: testValidation.validation.isValid !== false,
        details: testValidation
      };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * 🆕 检查解析器验证状态
   */
  async checkParserValidation() {
    try {
      if (this.supportedSites.length === 0) {
        return { valid: true, message: '无解析器需要验证' };
      }

      // 随机选择一个解析器进行验证
      const randomSite = this.supportedSites[Math.floor(Math.random() * this.supportedSites.length)];
      if (!randomSite.sourceType) {
        return { valid: true, message: '无有效解析器' };
      }

      const validation = await detailConfigAPI.validateParser(randomSite.sourceType);
      return {
        valid: validation.validation.isValid,
        sourceType: randomSite.sourceType,
        details: validation
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 🆕 更新服务健康状态
   */
  updateServiceHealthStatus(healthData) {
    this.serviceHealth = healthData;
    
    // 触发健康状态变更事件
    document.dispatchEvent(new CustomEvent('serviceHealthChanged', {
      detail: { health: healthData, architecture: this.version }
    }));

    // 如果UI已初始化，更新健康状态显示
    if (this.serviceStatusContainer) {
      this.renderServiceHealthStatus();
    }
  }

  /**
   * 初始化配置UI界面 - 增强新架构支持
   */
  async initConfigUI(containerId = 'detailConfigContainer') {
    try {
      this.configUIContainer = document.getElementById(containerId);
      if (!this.configUIContainer) {
        throw new Error(`配置容器元素未找到: ${containerId}`);
      }

      // 检查用户认证状态
      if (!authManager.isAuthenticated()) {
        this.renderUnauthenticatedView();
        return;
      }

      // 显示加载状态
      this.renderLoadingView();

      // 确保配置已加载
      if (!this.isInitialized) {
        await this.init();
      }

      // 🆕 确保架构数据已加载
      if (this.supportedSites.length === 0) {
        await this.loadArchitectureData();
      }

      // 渲染配置界面
      this.renderConfigInterface();

      // 绑定事件
      this.bindUIEvents();

      // 初始化表单验证
      this.initFormValidation();

      // 🆕 渲染架构信息
      this.renderArchitectureInfo();

      console.log('配置UI界面初始化完成 (新架构)');

    } catch (error) {
      console.error('配置UI界面初始化失败:', error);
      this.renderErrorView(error.message);
      throw error;
    }
  }

  /**
   * 设置配置变更监听器 - 增强新架构支持
   */
  setupConfigChangeListeners() {
    // 监听认证状态变更
    document.addEventListener('authStateChanged', () => {
      this.loadUserConfig();
      this.loadArchitectureData();
    });

    // 监听详情配置变更事件 (兼容现有代码)
    document.addEventListener('detailExtractionConfigChanged', (event) => {
      console.log('检测到详情配置变更，更新搜索组件配置');
      if (event.detail.config) {
        this.updateConfigFromDetailConfig(event.detail.config);
        this.emitConfigChanged();
      }
    });

    // 🆕 监听架构升级事件
    document.addEventListener('architectureUpgraded', (event) => {
      console.log('检测到架构升级:', event.detail);
      this.handleArchitectureUpgrade(event.detail);
    });

    // 🆕 监听服务状态变更
    document.addEventListener('serviceStatusChanged', (event) => {
      console.log('检测到服务状态变更:', event.detail);
      this.handleServiceStatusChange(event.detail);
    });
  }

  /**
   * 🆕 处理架构升级
   */
  async handleArchitectureUpgrade(upgradeDetail) {
    const { version, features } = upgradeDetail;
    
    if (version !== this.version) {
      console.log(`架构升级: ${this.version} -> ${version}`);
      this.version = version;
      this.architectureFeatures = { ...this.architectureFeatures, ...features };
      
      // 重新加载架构数据
      await this.loadArchitectureData();
      
      // 重新渲染UI
      if (this.configUIContainer) {
        this.renderArchitectureInfo();
        this.updatePreview();
      }
      
      showToast(`已升级到新架构 v${version}`, 'success');
    }
  }

  /**
   * 🆕 处理服务状态变更
   */
  handleServiceStatusChange(statusDetail) {
    console.log('处理服务状态变更:', statusDetail);
    
    // 更新服务健康状态
    if (statusDetail.health) {
      this.updateServiceHealthStatus(statusDetail.health);
    }
    
    // 如果服务状态恶化，重新验证配置
    if (statusDetail.status === 'error' || statusDetail.status === 'degraded') {
      this.validateFullConfig();
    }
  }

  /**
   * 从详情配置更新搜索配置 - 增强新架构支持
   */
  updateConfigFromDetailConfig(detailConfig) {
    const oldConfig = { ...this.config };
    
    // 更新搜索组件配置
    Object.assign(this.config, detailConfig);
    
    // 🆕 记录配置变更历史
    this.configChangeHistory.push({
      timestamp: Date.now(),
      from: oldConfig,
      to: { ...this.config },
      source: 'detail_config_update',
      architecture: this.version
    });
    
    // 保持最近20次变更记录
    if (this.configChangeHistory.length > 20) {
      this.configChangeHistory.shift();
    }
    
    console.log('搜索组件配置已更新 (新架构):', this.config);
    
    // 检查是否有变更
    if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
      this.emitConfigChanged();
    }
  }

  /**
   * 加载用户配置 - 增强新架构支持
   */
  async loadUserConfig() {
    try {
      if (authManager.isAuthenticated()) {
        // 首先尝试从缓存获取
        if (this.isConfigCacheValid()) {
          console.log('使用缓存的配置');
          this.config = { ...this.configCache };
          return;
        }

        // 获取用户设置（基础搜索配置）
        const userSettings = await apiService.getUserSettings();
        
        // 🆕 获取详情提取配置（新架构）
        const detailConfigData = await detailConfigAPI.getUserConfig();
        
        // 更新基础搜索配置
        this.config.useCache = userSettings.cacheResults !== false;
        this.config.saveToHistory = userSettings.allowHistory !== false;
        
        // 更新详情提取配置
        Object.assign(this.config, detailConfigData.config);
        this.originalConfig = { ...this.config };
        
        // 🆕 存储配置元数据和架构信息
        this.configMetadata = detailConfigData.metadata;
        this.availablePresets = detailConfigData.presets || CONFIG_PRESETS;
        this.usageStats = detailConfigData.usage;
        this.isUsingDefault = detailConfigData.isDefault;
        this.supportedSites = detailConfigData.supportedSites || [];
        this.parserCapabilities = detailConfigData.serviceInfo || {};
        
        // 缓存配置
        this.configCache = { ...this.config };
        this.configCacheTime = Date.now();
        
        console.log(`用户配置已加载 (v${this.version}):`, this.config);
        this.emitConfigChanged();
      } else {
        // 未登录用户使用默认配置
        this.resetToDefaultConfig();
      }
    } catch (error) {
      console.warn('加载用户配置失败:', error);
      this.resetToDefaultConfig();
    }
  }

  /**
   * 重置为默认配置 - 增强新架构支持
   */
  resetToDefaultConfig() {
    this.config = {
      useCache: true,
      saveToHistory: false,
      ...DEFAULT_USER_CONFIG
    };
    this.originalConfig = { ...this.config };
    this.hasUnsavedChanges = false;
    this.isUsingDefault = true;
    this.supportedSites = [];
    this.parserCapabilities = {};
    this.serviceStats = null;
    this.clearConfigCache();
    this.emitConfigChanged();
  }

  /**
   * 检查配置缓存是否有效
   */
  isConfigCacheValid() {
    return this.configCache && 
           (Date.now() - this.configCacheTime) < this.configCacheExpiration;
  }

  /**
   * 清除配置缓存
   */
  clearConfigCache() {
    this.configCache = null;
    this.configCacheTime = 0;
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 获取有效配置 - 合并用户配置和覆盖选项
   */
  getEffectiveConfig(overrides = {}) {
    return {
      ...this.config,
      ...overrides,
      // 🆕 添加架构信息
      architectureVersion: this.version,
      architectureFeatures: this.architectureFeatures
    };
  }

  /**
   * 更新显示配置
   */
  updateDisplayConfig(displayConfig) {
    const updatedFields = [];
    
    Object.entries(displayConfig).forEach(([key, value]) => {
      if (this.config[key] !== value) {
        this.config[key] = value;
        updatedFields.push(key);
      }
    });
    
    if (updatedFields.length > 0) {
      console.log('搜索组件显示配置已更新:', updatedFields);
      this.checkForChanges();
      this.emitConfigChanged();
    }
  }

  /**
   * 刷新详情提取配置 - 增强新架构支持
   */
  async refreshDetailConfig() {
    try {
      if (!authManager.isAuthenticated()) {
        console.log('用户未登录，无法刷新详情配置');
        return;
      }

      console.log('正在刷新详情提取配置...');
      
      // 清除缓存
      this.clearConfigCache();
      
      // 重新加载配置和架构数据
      const [configData, supportedSitesData] = await Promise.all([
        detailConfigAPI.getUserConfig(false),
        detailConfigAPI.getSupportedSites()
      ]);
      
      Object.assign(this.config, configData.config);
      this.supportedSites = supportedSitesData.sites || [];
      this.parserCapabilities = supportedSitesData.capabilities || {};
      
      // 更新缓存
      this.configCache = { ...this.config };
      this.configCacheTime = Date.now();
      
      console.log(`详情提取配置已刷新 (v${this.version}):`, this.config);
      this.emitConfigChanged();
      
    } catch (error) {
      console.error('刷新详情配置失败:', error);
      throw error;
    }
  }

  /**
   * 验证搜索配置 - 增强新架构支持
   */
  validateSearchConfig() {
    const issues = [];
    
    // 检查基础配置
    if (!authManager.isAuthenticated() && this.config.saveToHistory) {
      issues.push('未登录用户无法保存搜索历史');
    }
    
    // 检查详情提取配置
    if (this.config.enableDetailExtraction) {
      if (!authManager.isAuthenticated()) {
        issues.push('详情提取功能需要登录');
      }
      
      if (this.config.autoExtractDetails && this.config.maxAutoExtractions <= 0) {
        issues.push('自动提取数量必须大于0');
      }
      
      if (this.config.extractionBatchSize <= 0) {
        issues.push('批量处理大小必须大于0');
      }
      
      if (this.config.extractionTimeout < 5000) {
        issues.push('提取超时时间不应小于5秒');
      }

      if (this.config.autoExtractDetails && !this.config.enableDetailExtraction) {
        issues.push('启用自动提取需要先启用详情提取功能');
      }
      
      // 🆕 新架构验证
      if (this.supportedSites.length === 0) {
        issues.push('没有可用的解析器');
      }
      
      if (this.config.enableConcurrentExtraction && this.config.maxConcurrentExtractions > this.supportedSites.length) {
        issues.push('并发数不能超过可用解析器数量');
      }
    }
    
    // 🆕 架构兼容性检查
    const compatibility = checkConfigCompatibility(this.config);
    if (!compatibility.compatible) {
      issues.push(...compatibility.issues.map(issue => issue.message));
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  // ===================== UI界面管理方法 - 增强新架构支持 =====================

  /**
   * 渲染配置界面 - 增强新架构支持
   */
  renderConfigInterface() {
    this.configUIContainer.innerHTML = `
      <div class="detail-config-manager v2">
        <!-- 配置头部 -->
        <div class="config-header">
          <div class="config-title">
            <h2>搜索与详情提取配置</h2>
            <div class="config-status">
              ${this.isUsingDefault ? 
                '<span class="status-badge default">使用默认配置</span>' : 
                '<span class="status-badge custom">自定义配置</span>'
              }
              <span class="architecture-badge">v${this.version}</span>
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

        <!-- 🆕 架构信息面板 -->
        <div class="architecture-info-panel" id="architectureInfo">
          ${this.renderArchitectureInfoContent()}
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

        <!-- 🆕 服务状态面板 -->
        <div class="service-status-panel" id="serviceStatus">
          ${this.renderServiceStatusContent()}
        </div>

        <!-- 配置底部信息 -->
        <div class="config-footer">
          ${this.renderConfigFooter()}
        </div>
      </div>
    `;

    // 获取UI元素引用
    this.configForm = this.configUIContainer.querySelector('#configForm');
    this.presetSelector = this.configUIContainer.querySelector('#presetSelector');
    this.saveButton = this.configUIContainer.querySelector('#saveConfigBtn');
    this.resetButton = this.configUIContainer.querySelector('#resetConfigBtn');
    this.previewContainer = this.configUIContainer.querySelector('#configPreview');
    this.alertsContainer = this.configUIContainer.querySelector('#configAlerts');
    this.serviceStatusContainer = this.configUIContainer.querySelector('#serviceStatus');
    this.supportedSitesContainer = this.configUIContainer.querySelector('#architectureInfo');

    // 填充当前配置值
    this.populateFormValues();
  }

  /**
   * 🆕 渲染架构信息内容
   */
  renderArchitectureInfoContent() {
    return `
      <div class="architecture-info-content">
        <h3>
          <span class="arch-icon">🏗️</span>
          架构信息 v${this.version}
        </h3>
        
        <div class="architecture-features">
          <div class="feature-grid">
            ${Object.entries(this.architectureFeatures).map(([key, enabled]) => `
              <div class="feature-item ${enabled ? 'enabled' : 'disabled'}">
                <span class="feature-status">${enabled ? '✅' : '❌'}</span>
                <span class="feature-name">${this.getFeatureName(key)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${this.supportedSites.length > 0 ? `
          <div class="supported-parsers">
            <h4>支持的解析器 (${this.supportedSites.length})</h4>
            <div class="parser-grid">
              ${this.supportedSites.slice(0, 8).map(site => `
                <div class="parser-item ${site.isActive ? 'active' : 'inactive'}">
                  <span class="parser-name">${site.sourceType || 'Unknown'}</span>
                  <span class="parser-status">${site.isActive ? '🟢' : '🔴'}</span>
                </div>
              `).join('')}
              ${this.supportedSites.length > 8 ? `
                <div class="parser-item more">
                  <span class="parser-name">+${this.supportedSites.length - 8} 更多</span>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 🆕 渲染服务状态内容
   */
  renderServiceStatusContent() {
    if (!this.serviceHealth) {
      return `
        <div class="service-status-content">
          <h3>
            <span class="status-icon">❓</span>
            服务状态检查中...
          </h3>
        </div>
      `;
    }

    const { overall, components, architecture } = this.serviceHealth;
    
    return `
      <div class="service-status-content">
        <h3>
          <span class="status-icon">${overall.healthy ? '✅' : '⚠️'}</span>
          服务状态 ${overall.healthy ? '健康' : '异常'}
        </h3>
        
        <div class="status-details">
          <div class="status-item">
            <span class="status-label">响应时间:</span>
            <span class="status-value">${overall.responseTime ? Math.round(overall.responseTime) + 'ms' : 'N/A'}</span>
          </div>
          <div class="status-item">
            <span class="status-label">最后检查:</span>
            <span class="status-value">${formatRelativeTime(overall.timestamp)}</span>
          </div>
        </div>

        <div class="component-status">
          <h4>组件状态</h4>
          <div class="component-grid">
            ${Object.entries(components).map(([component, healthy]) => `
              <div class="component-item ${healthy ? 'healthy' : 'unhealthy'}">
                <span class="component-icon">${healthy ? '✅' : '❌'}</span>
                <span class="component-name">${this.getComponentName(component)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        ${this.healthCheckHistory.length > 0 ? `
          <div class="health-trends">
            <h4>健康趋势</h4>
            <div class="trend-chart">
              ${this.renderHealthTrendChart()}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 🆕 渲染健康趋势图表
   */
  renderHealthTrendChart() {
    const recentChecks = this.healthCheckHistory.slice(-10);
    if (recentChecks.length === 0) return '<div class="no-data">暂无数据</div>';

    const maxResponseTime = Math.max(...recentChecks.map(c => c.responseTime));
    const avgResponseTime = recentChecks.reduce((sum, c) => sum + c.responseTime, 0) / recentChecks.length;
    const healthyCount = recentChecks.filter(c => c.health).length;

    return `
      <div class="trend-summary">
        <div class="trend-metric">
          <span class="metric-label">健康率:</span>
          <span class="metric-value">${Math.round(healthyCount / recentChecks.length * 100)}%</span>
        </div>
        <div class="trend-metric">
          <span class="metric-label">平均响应:</span>
          <span class="metric-value">${Math.round(avgResponseTime)}ms</span>
        </div>
        <div class="trend-metric">
          <span class="metric-label">峰值响应:</span>
          <span class="metric-value">${Math.round(maxResponseTime)}ms</span>
        </div>
      </div>
      <div class="trend-bars">
        ${recentChecks.map((check, index) => `
          <div class="trend-bar ${check.health ? 'healthy' : 'unhealthy'}" 
               style="height: ${(check.responseTime / maxResponseTime) * 100}%"
               title="${check.health ? '健康' : '异常'} - ${Math.round(check.responseTime)}ms">
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * 渲染配置组 - 保持现有功能
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
   * 渲染单个配置字段 - 保持现有功能
   */
  renderConfigField(field) {
    const value = this.config[field.key];
    const fieldId = `config_${field.key}`;
    const isDisabled = field.dependency && !this.config[field.dependency];
    
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
                    <button type="button" class="remove-item-btn" onclick="this.parentElement.remove(); window.searchConfigManager.updateArrayField('${field.key}')">×</button>
                  </div>
                `).join('')}
              </div>
              <button type="button" class="add-item-btn" onclick="window.searchConfigManager.addArrayItem('${field.key}')">
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
   * 渲染配置预览 - 增强新架构支持
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
              <span class="metric-value">${this.config.enableConcurrentExtraction ? this.config.maxConcurrentExtractions + ' 个' : '禁用'}</span>
            </div>
          </div>
        </div>

        <!-- 功能状态 -->
        <div class="preview-section feature-status">
          <h4>功能状态</h4>
          <div class="feature-list">
            <div class="feature-item ${this.config.enableDetailExtraction ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.config.enableDetailExtraction ? '✅' : '❌'}</span>
              <span class="feature-name">详情提取</span>
            </div>
            <div class="feature-item ${this.config.autoExtractDetails ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.config.autoExtractDetails ? '✅' : '❌'}</span>
              <span class="feature-name">自动提取</span>
            </div>
            <div class="feature-item ${this.config.enableCache ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.config.enableCache ? '✅' : '❌'}</span>
              <span class="feature-name">缓存功能</span>
            </div>
            <div class="feature-item ${this.config.enableRetry ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.config.enableRetry ? '✅' : '❌'}</span>
              <span class="feature-name">重试机制</span>
            </div>
            <div class="feature-item ${this.architectureFeatures.modularParsers ? 'enabled' : 'disabled'}">
              <span class="feature-icon">${this.architectureFeatures.modularParsers ? '✅' : '❌'}</span>
              <span class="feature-name">模块化解析器</span>
            </div>
          </div>
        </div>

        <!-- 🆕 解析器支持状态 -->
        ${this.supportedSites.length > 0 ? `
          <div class="preview-section parser-support">
            <h4>解析器支持 (${this.supportedSites.length})</h4>
            <div class="parser-support-list">
              ${this.supportedSites.slice(0, 5).map(site => `
                <div class="parser-support-item ${site.isActive ? 'active' : 'inactive'}">
                  <span class="parser-icon">${site.isActive ? '🟢' : '🔴'}</span>
                  <span class="parser-name">${site.sourceType}</span>
                  <span class="parser-features">${this.getParserFeatureCount(site)} 特性</span>
                </div>
              `).join('')}
              ${this.supportedSites.length > 5 ? `
                <div class="parser-more">... 还有 ${this.supportedSites.length - 5} 个解析器</div>
              ` : ''}
            </div>
          </div>
        ` : ''}

        <!-- 兼容性检查 -->
        <div class="preview-section compatibility-check">
          <h4>兼容性检查</h4>
          <div class="compatibility-status ${compatibility.level}">
            <span class="status-icon">${compatibility.icon}</span>
            <span class="status-text">${compatibility.message}</span>
          </div>
          ${compatibility.issues && compatibility.issues.length > 0 ? `
            <div class="compatibility-issues">
              ${compatibility.issues.map(issue => `
                <div class="issue-item ${issue.severity}">
                  <span class="issue-icon">${issue.severity === 'error' ? '❌' : '⚠️'}</span>
                  <span class="issue-text">${issue.message}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
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
   * 渲染配置底部信息 - 增强新架构支持
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
          
          <!-- 🆕 架构统计 -->
          <div class="stat-item">
            <span class="stat-label">架构版本:</span>
            <span class="stat-value">v${this.version}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">支持解析器:</span>
            <span class="stat-value">${this.supportedSites.length}</span>
          </div>
          ${this.performanceMetrics.length > 0 ? `
            <div class="stat-item">
              <span class="stat-label">性能记录:</span>
              <span class="stat-value">${this.performanceMetrics.length}</span>
            </div>
          ` : ''}
        </div>
        
        <div class="config-help">
          <button class="btn btn-link" onclick="window.searchConfigManager.showConfigHelp()">
            配置帮助
          </button>
          <button class="btn btn-link" onclick="window.searchConfigManager.exportConfig()">
            导出配置
          </button>
          <button class="btn btn-link" onclick="window.searchConfigManager.importConfig()">
            导入配置
          </button>
          <button class="btn btn-link" onclick="window.searchConfigManager.showArchitectureInfo()">
            架构信息
          </button>
          <button class="btn btn-link" onclick="window.searchConfigManager.showServiceStats()">
            服务统计
          </button>
        </div>
      </div>
    `;
  }

  // ===================== 🆕 新架构专用方法 =====================

  /**
   * 🆕 获取特性名称
   */
  getFeatureName(featureKey) {
    const featureNames = {
      modularParsers: '模块化解析器',
      unifiedDataStructure: '统一数据结构',
      dynamicConfiguration: '动态配置',
      enhancedErrorHandling: '增强错误处理',
      serviceHealthMonitoring: '服务健康监控',
      parserValidation: '解析器验证',
      serviceStats: '服务统计'
    };
    return featureNames[featureKey] || featureKey;
  }

  /**
   * 🆕 获取组件名称
   */
  getComponentName(componentKey) {
    const componentNames = {
      config: '配置服务',
      extraction: '提取服务',
      parser: '解析器'
    };
    return componentNames[componentKey] || componentKey;
  }

  /**
   * 🆕 获取解析器特性数量
   */
  getParserFeatureCount(site) {
    if (!site.siteInfo || !site.siteInfo.features) return 0;
    return Array.isArray(site.siteInfo.features) ? site.siteInfo.features.length : 0;
  }

  /**
   * 🆕 显示架构信息
   */
  showArchitectureInfo() {
    const modal = document.createElement('div');
    modal.className = 'architecture-info-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content large" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>架构信息 v${this.version}</h3>
            <button class="modal-close-btn" onclick="this.closest('.architecture-info-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="architecture-details">
              <div class="arch-section">
                <h4>架构特性</h4>
                <div class="features-grid">
                  ${Object.entries(this.architectureFeatures).map(([key, enabled]) => `
                    <div class="feature-detail ${enabled ? 'enabled' : 'disabled'}">
                      <span class="feature-status">${enabled ? '✅' : '❌'}</span>
                      <div class="feature-info">
                        <span class="feature-name">${this.getFeatureName(key)}</span>
                        <span class="feature-desc">${this.getFeatureDescription(key)}</span>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>

              ${this.supportedSites.length > 0 ? `
                <div class="arch-section">
                  <h4>支持的解析器 (${this.supportedSites.length})</h4>
                  <div class="parsers-list">
                    ${this.supportedSites.map(site => `
                      <div class="parser-detail ${site.isActive ? 'active' : 'inactive'}">
                        <div class="parser-header">
                          <span class="parser-status">${site.isActive ? '🟢' : '🔴'}</span>
                          <span class="parser-name">${site.sourceType || 'Unknown'}</span>
                          <span class="parser-class">${site.className || 'N/A'}</span>
                        </div>
                        ${site.siteInfo ? `
                          <div class="parser-info">
                            <div class="parser-features">
                              特性: ${Array.isArray(site.siteInfo.features) ? site.siteInfo.features.join(', ') : '无'}
                            </div>
                            ${site.siteInfo.performance ? `
                              <div class="parser-performance">
                                性能: ${JSON.stringify(site.siteInfo.performance)}
                              </div>
                            ` : ''}
                            ${site.siteInfo.lastValidated ? `
                              <div class="parser-validated">
                                最后验证: ${formatRelativeTime(site.siteInfo.lastValidated)}
                              </div>
                            ` : ''}
                          </div>
                        ` : ''}
                        ${site.error ? `
                          <div class="parser-error">错误: ${site.error}</div>
                        ` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              ${this.serviceStats ? `
                <div class="arch-section">
                  <h4>服务统计</h4>
                  <div class="service-stats">
                    <pre>${JSON.stringify(this.serviceStats, null, 2)}</pre>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="this.closest('.architecture-info-modal').remove()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  }

  /**
   * 🆕 获取特性描述
   */
  getFeatureDescription(featureKey) {
    const descriptions = {
      modularParsers: '每个站点独立解析器，易于维护和扩展',
      unifiedDataStructure: '标准化的数据格式，确保一致性',
      dynamicConfiguration: '运行时配置更新，无需重启',
      enhancedErrorHandling: '改进的错误分类和处理机制',
      serviceHealthMonitoring: '实时监控服务状态和性能',
      parserValidation: '验证解析器工作状态',
      serviceStats: '详细的服务性能统计'
    };
    return descriptions[featureKey] || '暂无描述';
  }

  /**
   * 🆕 显示服务统计
   */
  async showServiceStats() {
    try {
      showLoading(true);
      
      const [serviceStats, supportedSites] = await Promise.all([
        detailConfigAPI.getServiceStats(),
        detailConfigAPI.getSupportedSites()
      ]);

      const modal = document.createElement('div');
      modal.className = 'service-stats-modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.remove()">
          <div class="modal-content large" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3>服务统计 v${this.version}</h3>
              <button class="modal-close-btn" onclick="this.closest('.service-stats-modal').remove()">×</button>
            </div>
            <div class="modal-body">
              <div class="stats-content">
                <div class="stats-section">
                  <h4>服务信息</h4>
                  <div class="service-info">
                    <div class="info-item">
                      <span class="info-label">版本:</span>
                      <span class="info-value">${serviceStats.serviceInfo?.version || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">架构:</span>
                      <span class="info-value">${serviceStats.serviceInfo?.architecture || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                      <span class="info-label">时间戳:</span>
                      <span class="info-value">${formatRelativeTime(serviceStats.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div class="stats-section">
                  <h4>解析器工厂</h4>
                  <div class="parser-factory-stats">
                    <div class="factory-item">
                      <span class="factory-label">支持站点:</span>
                      <span class="factory-value">${serviceStats.parserFactory?.supportedSites || 0}</span>
                    </div>
                    <div class="factory-item">
                      <span class="factory-label">缓存解析器:</span>
                      <span class="factory-value">${serviceStats.parserFactory?.cachedParsers || 0}</span>
                    </div>
                  </div>
                </div>

                ${serviceStats.performance ? `
                  <div class="stats-section">
                    <h4>性能指标</h4>
                    <div class="performance-stats">
                      <pre>${JSON.stringify(serviceStats.performance, null, 2)}</pre>
                    </div>
                  </div>
                ` : ''}

                ${serviceStats.health ? `
                  <div class="stats-section">
                    <h4>健康状态</h4>
                    <div class="health-status ${serviceStats.health.status}">
                      <span class="health-icon">${serviceStats.health.status === 'healthy' ? '✅' : '⚠️'}</span>
                      <span class="health-text">${serviceStats.health.status}</span>
                      ${serviceStats.health.error ? `<span class="health-error">${serviceStats.health.error}</span>` : ''}
                    </div>
                  </div>
                ` : ''}

                <div class="stats-section">
                  <h4>详细统计</h4>
                  <div class="detailed-stats">
                    <pre>${JSON.stringify(serviceStats.stats, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="window.searchConfigManager.refreshServiceStats()">
                刷新数据
              </button>
              <button class="btn btn-primary" onclick="this.closest('.service-stats-modal').remove()">
                关闭
              </button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);

    } catch (error) {
      console.error('显示服务统计失败:', error);
      showToast('获取服务统计失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 🆕 刷新服务统计
   */
  async refreshServiceStats() {
    try {
      await this.loadArchitectureData();
      showToast('服务统计已刷新', 'success');
      
      // 重新渲染服务状态面板
      if (this.serviceStatusContainer) {
        this.renderServiceHealthStatus();
      }
    } catch (error) {
      console.error('刷新服务统计失败:', error);
      showToast('刷新服务统计失败: ' + error.message, 'error');
    }
  }

  /**
   * 🆕 渲染架构信息
   */
  renderArchitectureInfo() {
    if (this.supportedSitesContainer) {
      this.supportedSitesContainer.innerHTML = this.renderArchitectureInfoContent();
    }
  }

  /**
   * 🆕 渲染服务健康状态
   */
  renderServiceHealthStatus() {
    if (this.serviceStatusContainer) {
      this.serviceStatusContainer.innerHTML = this.renderServiceStatusContent();
    }
  }

  // ===================== 配置验证和分析 - 增强新架构支持 =====================

  /**
   * 计算配置性能 - 增强新架构支持
   */
  calculateConfigPerformance() {
    let score = 0;
    let factors = [];
    
    // 超时时间影响
    if (this.config.extractionTimeout <= 10000) {
      score += 2;
      factors.push('快速超时');
    } else if (this.config.extractionTimeout <= 20000) {
      score += 1;
    } else {
      score -= 1;
      factors.push('超时时间较长');
    }
    
    // 并发影响
    if (this.config.enableConcurrentExtraction) {
      if (this.config.maxConcurrentExtractions >= 3) {
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
    if (this.config.enableCache) {
      score += 3;
      factors.push('启用缓存');
    } else {
      score -= 2;
      factors.push('禁用缓存');
    }
    
    // 批量大小影响
    if (this.config.extractionBatchSize <= 3) {
      score += 1;
    } else if (this.config.extractionBatchSize > 5) {
      score -= 1;
      factors.push('批量较大');
    }
    
    // 自动提取影响
    if (this.config.autoExtractDetails) {
      if (this.config.maxAutoExtractions > 8) {
        score -= 1;
        factors.push('自动提取过多');
      }
    }
    
    // 🆕 新架构特性影响
    if (this.architectureFeatures.modularParsers) {
      score += 1;
      factors.push('模块化解析器');
    }
    
    if (this.architectureFeatures.unifiedDataStructure) {
      score += 1;
      factors.push('统一数据结构');
    }
    
    if (this.supportedSites.length > 5) {
      score += 1;
      factors.push('丰富的解析器');
    }
    
    let level, text, resourceUsage;
    
    if (score >= 6) {
      level = 'excellent';
      text = '优秀';
      resourceUsage = '低';
    } else if (score >= 3) {
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
   * 检查配置兼容性 - 使用新架构检查
   */
  checkConfigCompatibility() {
    return checkConfigCompatibility(this.config);
  }

  /**
   * 获取配置建议 - 使用新架构生成
   */
  getConfigRecommendations() {
    const recommendations = generateConfigRecommendations(this.config);
    
    // 🆕 添加新架构特定建议
    if (!this.architectureFeatures.modularParsers) {
      recommendations.push({
        type: 'architecture',
        icon: '🏗️',
        message: '建议升级到模块化解析器架构',
        suggestion: '新架构提供更好的性能和可维护性'
      });
    }
    
    if (this.supportedSites.length === 0) {
      recommendations.push({
        type: 'warning',
        icon: '⚠️',
        message: '没有可用的解析器',
        suggestion: '请检查服务状态或联系管理员'
      });
    }
    
    if (this.serviceHealth && !this.serviceHealth.overall.healthy) {
      recommendations.push({
        type: 'error',
        icon: '🚨',
        message: '服务健康状态异常',
        suggestion: '请检查服务状态面板了解详情'
      });
    }
    
    return recommendations;
  }

  // ===================== 继续保持所有现有方法... =====================

  /**
   * 填充表单值
   */
  populateFormValues() {
    if (!this.configForm) return;
    
    Object.entries(this.config).forEach(([key, value]) => {
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
   * 绑定UI事件
   */
  bindUIEvents() {
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
    this.config[fieldName] = newValue;
    
    // 检查是否有变更
    this.checkForChanges();
    
    // 更新依赖字段状态
    this.updateDependencyStates();
    
    // 实时验证
    this.validateConfigField(fieldName, newValue);
    
    // 更新预览
    this.updatePreview();
    
    // 触发变更事件
    this.emitConfigChanged();
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
        this.config = { ...this.config, ...result.config };
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
      
      const result = await detailConfigAPI.updateUserConfig(this.config);
      
      if (result.valid) {
        this.originalConfig = { ...this.config };
        this.hasUnsavedChanges = false;
        this.updateSaveButtonState();
        
        // 更新缓存
        this.configCache = { ...this.config };
        this.configCacheTime = Date.now();
        
        // 显示保存结果
        let message = '配置保存成功';
        if (result.warnings && result.warnings.length > 0) {
          message += `\n注意: ${result.warnings.join(', ')}`;
        }
        
        showToast(message, 'success');
        
        // 触发配置保存事件
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
        this.config = { ...this.config, ...result.config };
        this.originalConfig = { ...this.config };
        this.hasUnsavedChanges = false;
        this.isUsingDefault = true;
        
        // 更新缓存
        this.configCache = { ...this.config };
        this.configCacheTime = Date.now();
        
        this.populateFormValues();
        this.updatePreview();
        this.updateSaveButtonState();
        
        showToast('配置已重置为默认值', 'success');
        
        // 触发配置保存事件
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
   * 验证完整配置
   */
  async validateFullConfig() {
    try {
      const validation = detailConfigAPI.validateConfig(this.config);
      
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
        if (value > 8 && this.config.autoExtractDetails) {
          warnings.push('自动提取数量过多可能影响页面加载');
        }
        break;
        
      case 'autoExtractDetails':
        if (value && !this.config.enableDetailExtraction) {
          errors.push('启用自动提取需要先启用详情提取功能');
        }
        break;
        
      case 'enableLocalCache':
        if (value && !this.config.enableCache) {
          errors.push('启用本地缓存需要先启用缓存功能');
        }
        break;
        
      case 'maxRetryAttempts':
        if (value && !this.config.enableRetry) {
          warnings.push('设置了重试次数但未启用重试功能');
        }
        break;
        
      // 🆕 新架构特定验证
      case 'maxConcurrentExtractions':
        if (value > this.supportedSites.length && this.supportedSites.length > 0) {
          warnings.push(`并发数不应超过可用解析器数量 (${this.supportedSites.length})`);
        }
        break;
    }
    
    return { errors, warnings };
  }

  // ===================== UI辅助方法 =====================

  /**
   * 检查配置变更
   */
  checkForChanges() {
    const changes = detectConfigChanges(this.originalConfig, this.config);
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
    if (!this.configForm) return;
    
    CONFIG_FIELD_GROUPS.forEach(group => {
      group.fields.forEach(field => {
        if (field.dependency) {
          const fieldElement = this.configForm.querySelector(`[data-field="${field.key}"]`);
          const isEnabled = this.config[field.dependency];
          
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
   * 更新字段验证状态
   */
  updateFieldValidationState(fieldName, errors, warnings) {
    if (!this.configForm) return;
    
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
    if (!this.previewContainer) return;
    
    // 防抖更新
    clearTimeout(this.previewDebounceTimer);
    this.previewDebounceTimer = setTimeout(() => {
      this.previewContainer.innerHTML = this.renderConfigPreview();
    }, 300);
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

  // ===================== 数组字段管理 =====================

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
      <button type="button" class="remove-item-btn" onclick="this.parentElement.remove(); window.searchConfigManager.updateArrayField('${fieldKey}')">×</button>
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
    
    this.config[fieldKey] = values;
    this.checkForChanges();
    this.validateConfigField(fieldKey, values);
    this.updatePreview();
    this.emitConfigChanged();
  }

  // ===================== 工具方法 =====================

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
   * 显示验证错误
   */
  showValidationErrors(errors) {
    const errorMessage = errors.join('\n');
    alert(`配置验证失败：\n\n${errorMessage}`);
  }

  // ===================== 配置导入导出 =====================

  /**
   * 导出搜索配置
   */
  exportSearchConfig() {
    const configData = {
      searchConfig: {
        useCache: this.config.useCache,
        saveToHistory: this.config.saveToHistory
      },
      detailExtractionConfig: this.config,
      // 🆕 新架构信息
      architectureInfo: {
        version: this.version,
        features: this.architectureFeatures,
        supportedSites: this.supportedSites.length,
        serviceHealth: this.serviceHealth?.overall.healthy || false
      },
      exportTime: new Date().toISOString(),
      version: '3.0.0'
    };

    return JSON.stringify(configData, null, 2);
  }

  /**
   * 导出配置文件
   */
  async exportConfig() {
    try {
      const exportData = this.exportSearchConfig();
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-config-v${this.version}-${new Date().toISOString().split('T')[0]}.json`;
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
        
        if (!importData.detailExtractionConfig) {
          throw new Error('无效的配置文件格式');
        }
        
        // 验证导入的配置
        const validation = detailConfigAPI.validateConfig(importData.detailExtractionConfig);
        if (!validation.valid) {
          throw new Error('导入的配置验证失败: ' + validation.errors.join(', '));
        }
        
        if (this.hasUnsavedChanges) {
          const confirmed = confirm('当前有未保存的配置更改，导入将丢失这些更改。确定继续吗？');
          if (!confirmed) return;
        }
        
        // 应用导入的配置
        this.config = { 
          ...this.config, 
          ...importData.detailExtractionConfig 
        };
        this.populateFormValues();
        this.updatePreview();
        this.checkForChanges();
        
        showToast('配置导入成功', 'success');
        
        // 🆕 如果导入了不同架构版本的配置，显示提示
        if (importData.architectureInfo && importData.architectureInfo.version !== this.version) {
          showToast(`注意：导入的配置来自 v${importData.architectureInfo.version}，当前架构为 v${this.version}`, 'warning', 5000);
        }
        
      } catch (error) {
        console.error('导入配置失败:', error);
        showToast('导入配置失败: ' + error.message, 'error');
      }
    };
    
    input.click();
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
            <h3>配置帮助 v${this.version}</h3>
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

              <h4>新架构特性 v${this.version}</h4>
              <div class="help-features">
                ${Object.entries(this.architectureFeatures).map(([key, enabled]) => `
                  <div class="help-feature ${enabled ? 'enabled' : 'disabled'}">
                    <span class="feature-status">${enabled ? '✅' : '❌'}</span>
                    <div class="feature-info">
                      <strong>${this.getFeatureName(key)}</strong>
                      <p>${this.getFeatureDescription(key)}</p>
                    </div>
                  </div>
                `).join('')}
              </div>

              ${this.supportedSites.length > 0 ? `
                <h4>支持的解析器</h4>
                <p>当前架构支持 ${this.supportedSites.length} 个解析器，采用模块化设计，每个解析器独立维护。</p>
              ` : ''}
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

  // ===================== 不同状态的视图渲染 =====================

  /**
   * 渲染未认证视图
   */
  renderUnauthenticatedView() {
    this.configUIContainer.innerHTML = `
      <div class="config-unauthenticated">
        <div class="unauth-content">
          <h2>需要登录</h2>
          <p>搜索与详情提取配置管理需要登录后才能使用。</p>
          <div class="unauth-actions">
            <button class="btn btn-primary" onclick="window.location.href='/login'">
              立即登录
            </button>
            <button class="btn btn-secondary" onclick="window.searchConfigManager.showDefaultConfig()">
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
    this.configUIContainer.innerHTML = `
      <div class="config-loading">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <p>正在加载配置...</p>
          <div class="loading-steps">
            <div class="step">📋 加载用户配置</div>
            <div class="step">🏗️ 加载架构数据</div>
            <div class="step">⚡ 检查服务状态</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染错误视图
   */
  renderErrorView(errorMessage) {
    this.configUIContainer.innerHTML = `
      <div class="config-error">
        <div class="error-content">
          <h2>配置加载失败</h2>
          <p>${escapeHtml(errorMessage)}</p>
          <div class="error-details">
            <p>可能的原因：</p>
            <ul>
              <li>网络连接问题</li>
              <li>服务器临时不可用</li>
              <li>架构版本不兼容</li>
              <li>用户权限不足</li>
            </ul>
          </div>
          <div class="error-actions">
            <button class="btn btn-primary" onclick="window.searchConfigManager.retry()">
              重试
            </button>
            <button class="btn btn-secondary" onclick="window.searchConfigManager.useDefaultConfig()">
              使用默认配置
            </button>
            <button class="btn btn-link" onclick="window.searchConfigManager.checkServiceHealth()">
              检查服务状态
            </button>
          </div>
        </div>
      </div>
    `;
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
        <div class="modal-content large" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>默认配置预览 v${this.version}</h3>
            <button class="modal-close-btn" onclick="this.closest('.default-config-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            <div class="default-config-preview">
              <div class="config-section">
                <h4>基础配置</h4>
                <pre>${JSON.stringify({
                  useCache: true,
                  saveToHistory: false
                }, null, 2)}</pre>
              </div>
              <div class="config-section">
                <h4>详情提取配置</h4>
                <pre>${JSON.stringify(defaultConfig, null, 2)}</pre>
              </div>
              <div class="config-section">
                <h4>架构信息</h4>
                <pre>${JSON.stringify({
                  version: this.version,
                  features: this.architectureFeatures
                }, null, 2)}</pre>
              </div>
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
   * 重试初始化
   */
  async retry() {
    this.isInitialized = false;
    await this.initConfigUI(this.configUIContainer.id);
  }

  /**
   * 使用默认配置
   */
  useDefaultConfig() {
    this.resetToDefaultConfig();
    this.renderConfigInterface();
    this.bindUIEvents();
    this.initFormValidation();
  }

  // ===================== 事件通知 =====================

  /**
   * 触发配置变更事件
   */
  emitConfigChanged() {
    // 记录性能指标
    this.recordConfigChangeMetric();
    
    document.dispatchEvent(new CustomEvent('searchConfigChanged', {
      detail: { 
        config: this.getConfig(),
        architecture: this.version,
        timestamp: Date.now()
      }
    }));
  }

  /**
   * 🆕 记录配置变更性能指标
   */
  recordConfigChangeMetric() {
    this.performanceMetrics.push({
      type: 'config_change',
      timestamp: Date.now(),
      architecture: this.version,
      hasUnsavedChanges: this.hasUnsavedChanges,
      validationErrors: this.validationErrors.length,
      supportedSites: this.supportedSites.length
    });
    
    // 保持最近100条记录
    if (this.performanceMetrics.length > 100) {
      this.performanceMetrics.shift();
    }
  }

  /**
   * 通知配置保存
   */
  notifyConfigSaved() {
    const event = new CustomEvent('detailConfigSaved', {
      detail: {
        config: { ...this.config },
        architecture: this.version,
        timestamp: Date.now()
      }
    });
    
    document.dispatchEvent(event);
    
    // 也触发搜索配置变更事件
    this.emitConfigChanged();
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

  // ===================== 全局方法暴露 - 增强新架构支持 =====================

  /**
   * 暴露全局方法
   */
  exposeGlobalMethods() {
    window.searchConfigManager = {
      // 基础方法
      getConfig: () => this.getConfig(),
      getEffectiveConfig: (overrides) => this.getEffectiveConfig(overrides),
      updateDisplayConfig: (config) => this.updateDisplayConfig(config),
      validateSearchConfig: () => this.validateSearchConfig(),
      refreshDetailConfig: () => this.refreshDetailConfig(),
      clearConfigCache: () => this.clearConfigCache(),
      
      // UI方法
      initConfigUI: (containerId) => this.initConfigUI(containerId),
      addArrayItem: (fieldKey) => this.addArrayItem(fieldKey),
      updateArrayField: (fieldKey) => this.updateArrayField(fieldKey),
      showConfigHelp: () => this.showConfigHelp(),
      exportConfig: () => this.exportConfig(),
      importConfig: () => this.importConfig(),
      showDefaultConfig: () => this.showDefaultConfig(),
      retry: () => this.retry(),
      useDefaultConfig: () => this.useDefaultConfig(),
      
      // 配置操作方法
      applyPreset: (presetKey) => this.applyPreset(presetKey),
      saveConfiguration: () => this.saveConfiguration(),
      resetConfiguration: () => this.resetConfiguration(),
      
      // 监听器方法
      addChangeListener: (listener) => this.addChangeListener(listener),
      removeChangeListener: (listener) => this.removeChangeListener(listener),
      
      // 状态方法
      hasUnsavedConfigChanges: () => this.hasUnsavedChanges,
      isConfigCacheValid: () => this.isConfigCacheValid(),
      getStatus: () => this.getStatus(),
      
      // 🆕 新架构方法
      getArchitectureVersion: () => this.version,
      getArchitectureFeatures: () => this.architectureFeatures,
      getSupportedSites: () => this.supportedSites,
      getServiceHealth: () => this.serviceHealth,
      checkServiceHealth: () => this.checkServiceHealth(),
      showArchitectureInfo: () => this.showArchitectureInfo(),
      showServiceStats: () => this.showServiceStats(),
      refreshServiceStats: () => this.refreshServiceStats(),
      getPerformanceMetrics: () => this.performanceMetrics,
      getConfigChangeHistory: () => this.configChangeHistory,
      validateParser: (sourceType) => detailConfigAPI.validateParser(sourceType),
      reloadParser: (sourceType) => detailConfigAPI.reloadParser(sourceType)
    };
  }

  // ===================== 状态管理 =====================

  /**
   * 获取组件状态 - 增强新架构支持
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasUnsavedChanges: this.hasUnsavedChanges,
      validationErrors: this.validationErrors.length,
      validationWarnings: this.validationWarnings.length,
      isUsingDefault: this.isUsingDefault,
      changeListeners: this.changeListeners.size,
      configCacheValid: this.isConfigCacheValid(),
      uiInitialized: !!this.configUIContainer,
      
      // 🆕 新架构状态
      architectureVersion: this.version,
      architectureFeatures: this.architectureFeatures,
      supportedSites: this.supportedSites.length,
      serviceHealth: this.serviceHealth?.overall.healthy || false,
      performanceMetrics: this.performanceMetrics.length,
      configChangeHistory: this.configChangeHistory.length,
      healthCheckHistory: this.healthCheckHistory.length,
      
      // 服务组件状态
      detailConfigAPI: {
        available: true,
        version: '2.0.0'
      },
      
      // 监控状态
      healthCheckRunning: !!this.healthCheckTimer,
      validationRunning: !!this.validationTimer,
      
      // 缓存状态
      configCacheTime: this.configCacheTime,
      configCacheExpiration: this.configCacheExpiration
    };
  }

  /**
   * 🆕 获取诊断信息
   */
  getDiagnosticInfo() {
    return {
      status: this.getStatus(),
      config: this.getConfig(),
      originalConfig: this.originalConfig,
      supportedSites: this.supportedSites,
      serviceHealth: this.serviceHealth,
      performanceMetrics: this.performanceMetrics.slice(-10), // 最近10条
      configChangeHistory: this.configChangeHistory.slice(-5), // 最近5次变更
      healthCheckHistory: this.healthCheckHistory.slice(-10), // 最近10次健康检查
      validationErrors: this.validationErrors,
      validationWarnings: this.validationWarnings,
      architectureInfo: {
        version: this.version,
        features: this.architectureFeatures
      }
    };
  }

  /**
   * 🆕 导出诊断报告
   */
  async exportDiagnosticReport() {
    try {
      const diagnosticInfo = this.getDiagnosticInfo();
      
      const reportData = {
        reportType: 'SearchConfigManager_Diagnostic',
        generatedAt: new Date().toISOString(),
        architecture: this.version,
        diagnosticInfo,
        environment: {
          userAgent: navigator.userAgent,
          location: window.location.href,
          authenticated: authManager.isAuthenticated()
        }
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-config-diagnostic-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
      showToast('诊断报告已导出', 'success');
    } catch (error) {
      console.error('导出诊断报告失败:', error);
      showToast('导出诊断报告失败: ' + error.message, 'error');
    }
  }

  /**
   * 清理资源 - 增强新架构支持
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
    
    // 🆕 清理健康检查定时器
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    // 清理监听器
    this.changeListeners.clear();
    
    // 清理缓存
    this.clearConfigCache();
    
    // 🆕 清理新架构数据
    this.supportedSites = [];
    this.parserCapabilities = {};
    this.serviceStats = null;
    this.serviceHealth = null;
    this.performanceMetrics = [];
    this.healthCheckHistory = [];
    this.configChangeHistory = [];
    
    // 清理全局方法
    if (window.searchConfigManager) {
      delete window.searchConfigManager;
    }
    
    // 重置状态
    this.isInitialized = false;
    this.hasUnsavedChanges = false;
    this.validationErrors = [];
    this.validationWarnings = [];
    
    console.log(`统一配置管理器资源已清理 (v${this.version})`);
  }
}

export default SearchConfigManager;