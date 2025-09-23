// 搜索源管理器 - 集成代理功能版本:解决字段匹配和分类显示问题，添加代理配置管理
import { APP_CONSTANTS, validateSourceUrl } from '../../core/constants.js';
import { showLoading, showToast } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import searchSourcesAPI from '../../services/search-sources-api.js';

export class SourcesManager {
  constructor(dashboardApp) {
    this.app = dashboardApp;
    this.builtinSearchSources = [];
    this.customSearchSources = [];
    this.allSearchSources = [];
    this.enabledSources = [];
    this.editingCustomSource = null;
    
    this.majorCategories = [];
    this.allCategories = [];
    
    // 代理配置相关属性
    this.proxyConfig = null;
    this.proxyServers = [];
    this.proxyStats = null;
  }

  async init() {
    console.log('🔧 初始化搜索源管理器');
    this.bindEvents();
  }

  async loadData() {
    await this.loadUserSearchSettings();
    await this.loadProxyConfig();
  }

  async loadTabData() {
    try {
      await this.loadUserSearchSettings();
      await this.loadProxyConfig();
      this.updateCategoryFilterOptions();
      this.updateMajorCategoryFilterOptions();
      this.renderSourcesList();
      this.updateSourcesStats();
      this.renderProxyConfiguration();
    } catch (error) {
      console.error('加载搜索源数据失败:', error);
      showToast('加载搜索源数据失败', 'error');
    }
  }

  // 🔴 改进 loadUserSearchSettings 方法，确保加载用户自定义分类
  async loadUserSearchSettings() {
    if (!this.app.getCurrentUser()) {
      await this.loadMinimalDataSet();
      return;
    }
    
    try {
      console.log('📡 从新API加载搜索源数据...');
      
      // 获取大类数据
      this.majorCategories = await searchSourcesAPI.getMajorCategories();
      console.log('✅ 已加载大类:', this.majorCategories);
      
      // 🔴 修复：确保获取所有分类，包括用户自定义的
      this.allCategories = await searchSourcesAPI.getSourceCategories({
        includeSystem: true,
        includeCustom: true  // 确保包含用户自定义分类
      });
      console.log('✅ 已加载分类:', this.allCategories);
      
      // 获取所有搜索源
      const allSources = await searchSourcesAPI.getSearchSources({
        includeSystem: true,
        enabledOnly: false
      });
      console.log('✅ 已加载搜索源:', allSources);
      
      // 获取用户配置
      const userConfigs = await searchSourcesAPI.getUserSourceConfigs();
      console.log('✅ 已加载用户配置:', userConfigs);
      
      // 🔴 修复：正确区分内置和自定义源
      this.builtinSearchSources = allSources.filter(s => s.isSystem === true);
      this.customSearchSources = allSources.filter(s => !s.isSystem);
      
      console.log(`📊 源分类: ${this.builtinSearchSources.length} 个内置, ${this.customSearchSources.length} 个自定义`);
      
      // 合并所有源,并标准化字段
      this.allSearchSources = allSources.map(source => {
        // 🔴 修复：确保 categoryId 字段存在
        if (!source.categoryId && source.category) {
          source.categoryId = source.category;
        }
        return source;
      });
      
      // 从用户配置中提取启用的源ID列表
      this.enabledSources = userConfigs
        .filter(config => config.isEnabled !== false)
        .map(config => config.sourceId);
      
      // 如果没有配置,使用所有系统源作为默认启用
      if (this.enabledSources.length === 0) {
        this.enabledSources = this.builtinSearchSources.map(s => s.id);
      }
      
      console.log(`✅ 已加载 ${this.majorCategories.length} 个大类,${this.allCategories.length} 个分类,${this.allSearchSources.length} 个搜索源 (${this.builtinSearchSources.length} 内置, ${this.customSearchSources.length} 自定义), ${this.enabledSources.length} 个已启用`);
      
    } catch (error) {
      console.warn('⚠️ 从API加载搜索源失败,使用最小数据集:', error);
      await this.loadMinimalDataSet();
    }
  }

  async loadMinimalDataSet() {
    try {
      this.majorCategories = [
        {
          id: 'search_sources',
          name: '搜索资源',
          icon: '🔍',
          description: '参与番号搜索的资源站点',
          order: 1
        },
        {
          id: 'browse_sites',
          name: '浏览站点',
          icon: '🌐',
          description: '仅供浏览的资源站点',
          order: 2
        }
      ];

      this.allCategories = [
        {
          id: 'database',
          name: '📚 番号资料站',
          icon: '📚',
          description: '提供详细番号信息',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 1,
          isSystem: true
        },
        {
          id: 'torrent',
          name: '🧲 磁力搜索',
          icon: '🧲',
          description: '提供种子下载',
          majorCategoryId: 'search_sources',
          defaultSearchable: true,
          defaultSiteType: 'search',
          searchPriority: 3,
          isSystem: true
        }
      ];

      this.builtinSearchSources = [
        {
          id: 'javbus',
          name: 'JavBus',
          subtitle: '番号+磁力一体站,信息完善',
          icon: '🎬',
          categoryId: 'database',
          urlTemplate: 'https://www.javbus.com/search/{keyword}',
          searchable: true,
          siteType: 'search',
          searchPriority: 1,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true,
          needsProxy: true,
          proxyRegions: ['CN', 'RU', 'IR', 'KR']
        },
        {
          id: 'javdb',
          name: 'JavDB',
          subtitle: '极简风格番号资料站,轻量快速',
          icon: '📚',
          categoryId: 'database',
          urlTemplate: 'https://javdb.com/search?q={keyword}&f=all',
          searchable: true,
          siteType: 'search',
          searchPriority: 2,
          requiresKeyword: true,
          isSystem: true,
          userEnabled: true,
          needsProxy: true,
          proxyRegions: ['CN', 'RU', 'IR']
        }
      ];

      this.customSearchSources = [];
      this.allSearchSources = [...this.builtinSearchSources];
      this.enabledSources = this.builtinSearchSources.map(s => s.id);
      
      console.log('🔧 已加载最小数据集');
      
    } catch (error) {
      console.error('❌ 加载最小数据集失败:', error);
      this.majorCategories = [];
      this.allCategories = [];
      this.builtinSearchSources = [];
      this.customSearchSources = [];
      this.allSearchSources = [];
      this.enabledSources = [];
    }
  }

  /**
   * 加载代理配置
   */
  async loadProxyConfig() {
    if (!this.app.getCurrentUser()) {
      this.proxyConfig = null;
      this.proxyServers = [];
      this.proxyStats = null;
      return;
    }

    try {
      console.log('🔐 加载代理配置...');
      
      // 获取代理配置
      const proxyData = await searchSourcesAPI.getProxyConfig();
      this.proxyConfig = proxyData.userConfig;
      this.proxyServers = proxyData.proxyServers || [];
      
      // 获取代理统计
      try {
        this.proxyStats = await searchSourcesAPI.getProxyStats();
      } catch (error) {
        console.warn('获取代理统计失败:', error);
        this.proxyStats = null;
      }
      
      console.log('✅ 代理配置加载完成');
    } catch (error) {
      console.error('❌ 加载代理配置失败:', error);
      this.proxyConfig = null;
      this.proxyServers = [];
      this.proxyStats = null;
    }
  }

  bindEvents() {
    const addCustomSourceBtn = document.getElementById('addCustomSourceBtn');
    if (addCustomSourceBtn) {
      addCustomSourceBtn.addEventListener('click', () => this.showCustomSourceModal());
    }

    const sourcesFilter = document.getElementById('sourcesFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const majorCategoryFilter = document.getElementById('majorCategoryFilter');
    const sourcesSort = document.getElementById('sourcesSort');

    if (sourcesFilter) {
      sourcesFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (majorCategoryFilter) {
      majorCategoryFilter.addEventListener('change', () => this.filterAndSortSources());
    }
    if (sourcesSort) {
      sourcesSort.addEventListener('change', () => this.filterAndSortSources());
    }

    this.bindBulkActionEvents();
    this.bindProxyEvents();
  }

  bindBulkActionEvents() {
    const bulkActions = {
      'enableAllSources': () => this.enableAllSources(),
      'disableAllSources': () => this.disableAllSources(),
      'resetToDefaults': () => this.resetToDefaults()
    };

    Object.entries(bulkActions).forEach(([action, handler]) => {
      const element = document.querySelector(`[onclick*="${action}"]`);
      if (element) {
        element.removeAttribute('onclick');
        element.addEventListener('click', handler);
      }
    });
  }

  /**
   * 绑定代理相关事件
   */
  bindProxyEvents() {
    // 全局代理开关
    const proxyToggle = document.getElementById('globalProxyToggle');
    if (proxyToggle) {
      proxyToggle.addEventListener('change', (e) => {
        this.toggleGlobalProxy(e.target.checked);
      });
    }

    // 智能路由开关
    const intelligentRoutingToggle = document.getElementById('intelligentRoutingToggle');
    if (intelligentRoutingToggle) {
      intelligentRoutingToggle.addEventListener('change', (e) => {
        this.toggleIntelligentRouting(e.target.checked);
      });
    }

    // 用户地区选择
    const userRegionSelect = document.getElementById('userRegionSelect');
    if (userRegionSelect) {
      userRegionSelect.addEventListener('change', (e) => {
        this.updateUserRegion(e.target.value);
      });
    }

    // 首选代理服务器选择
    const preferredProxySelect = document.getElementById('preferredProxySelect');
    if (preferredProxySelect) {
      preferredProxySelect.addEventListener('change', (e) => {
        this.updatePreferredProxy(e.target.value);
      });
    }

    // 检查代理健康状态按钮
    const checkProxyHealthBtn = document.getElementById('checkProxyHealthBtn');
    if (checkProxyHealthBtn) {
      checkProxyHealthBtn.addEventListener('click', () => this.checkProxyHealth());
    }

    // 重置代理设置按钮
    const resetProxyBtn = document.getElementById('resetProxyBtn');
    if (resetProxyBtn) {
      resetProxyBtn.addEventListener('click', () => this.resetProxySettings());
    }
  }

  updateCategoryFilterOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    if (!categoryFilter) return;

    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.displayOrder || a.order || 999) - (b.displayOrder || b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    categoryFilter.innerHTML = `
      <option value="all">全部分类</option>
      ${categoriesHTML}
    `;
  }

  updateMajorCategoryFilterOptions() {
    const majorCategoryFilter = document.getElementById('majorCategoryFilter');
    if (!majorCategoryFilter) return;

    const majorCategoriesHTML = this.majorCategories
      .sort((a, b) => (a.order || 999) - (b.order || 999))
      .map(majorCategory => `
        <option value="${majorCategory.id}">${majorCategory.icon} ${majorCategory.name}</option>
      `).join('');

    majorCategoryFilter.innerHTML = `
      <option value="all">全部大类</option>
      ${majorCategoriesHTML}
    `;
  }

  renderSourcesList() {
    const sourcesList = document.getElementById('sourcesList');
    if (!sourcesList) return;

    const filter = document.getElementById('sourcesFilter')?.value || 'all';
    const categoryFilter = document.getElementById('categoryFilter')?.value || 'all';
    const majorCategoryFilter = document.getElementById('majorCategoryFilter')?.value || 'all';
    const sort = document.getElementById('sourcesSort')?.value || 'priority';

    let filteredSources = this.allSearchSources;

    if (filter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        switch (filter) {
          case 'enabled':
            return this.enabledSources.includes(source.id);
          case 'disabled':
            return !this.enabledSources.includes(source.id);
          case 'builtin':
            return source.isSystem;
          case 'custom':
            return !source.isSystem;
          case 'searchable':
            return source.searchable !== false;
          case 'browse_only':
            return source.searchable === false;
          case 'supports_detail':
            return this.supportsDetailExtraction(source.id);
          case 'needs_proxy':
            return source.needsProxy === true;
          case 'proxy_enabled':
            return source.userUseProxy === true;
          default:
            return true;
        }
      });
    }

    if (majorCategoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        const categoryId = source.categoryId || source.category;
        const category = this.getCategoryById(categoryId);
        const majorCategoryId = category?.majorCategoryId || category?.majorCategory;
        return majorCategoryId === majorCategoryFilter;
      });
    }

    if (categoryFilter !== 'all') {
      filteredSources = filteredSources.filter(source => {
        const sourceCategoryId = source.categoryId || source.category;
        return sourceCategoryId === categoryFilter;
      });
    }

    this.sortSources(filteredSources, sort);

    if (filteredSources.length === 0) {
      sourcesList.innerHTML = `
        <div class="empty-state">
          <span style="font-size: 3rem;">🔍</span>
          <p>没有找到匹配的搜索源</p>
          <button class="btn-primary" onclick="app.getManager('sources').showCustomSourceModal()">添加自定义搜索源</button>
        </div>
      `;
      return;
    }

    sourcesList.innerHTML = `
      <div class="sources-grid">
        ${filteredSources.map(source => this.renderSourceItem(source)).join('')}
      </div>
    `;

    this.bindSourceItemEvents();
  }

  sortSources(sources, sortBy) {
    sources.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          const catA = this.getCategoryById(a.categoryId || a.category)?.name || 'Unknown';
          const catB = this.getCategoryById(b.categoryId || b.category)?.name || 'Unknown';
          return catA.localeCompare(catB);
        case 'status':
          const statusA = this.enabledSources.includes(a.id) ? 0 : 1;
          const statusB = this.enabledSources.includes(b.id) ? 0 : 1;
          return statusA - statusB;
        case 'site_type':
          const siteTypeA = a.siteType || 'search';
          const siteTypeB = b.siteType || 'search';
          return siteTypeA.localeCompare(siteTypeB);
        case 'searchable':
          const searchableA = a.searchable !== false ? 0 : 1;
          const searchableB = b.searchable !== false ? 0 : 1;
          return searchableA - searchableB;
        case 'major_category':
          const majorCatA = this.getMajorCategoryForSource(a.id) || 'zzz';
          const majorCatB = this.getMajorCategoryForSource(b.id) || 'zzz';
          return majorCatA.localeCompare(majorCatB);
        case 'proxy_status':
          const proxyA = a.needsProxy ? (a.userUseProxy ? 0 : 1) : 2;
          const proxyB = b.needsProxy ? (b.userUseProxy ? 0 : 1) : 2;
          return proxyA - proxyB;
        case 'priority':
        default:
          if (a.isSystem && !b.isSystem) return -1;
          if (!a.isSystem && b.isSystem) return 1;
          return (a.searchPriority || a.priority || 999) - (b.searchPriority || b.priority || 999);
      }
    });
  }

  // 🔴 修复:正确渲染源项目,支持字段兼容和代理配置显示
  renderSourceItem(source) {
    // 🔴 兼容 categoryId 和 category 字段
    const categoryId = source.categoryId || source.category;
    const category = this.getCategoryById(categoryId);
    const majorCategory = this.getMajorCategoryForSource(source.id);
    const isEnabled = this.enabledSources.includes(source.id);
    const supportsDetailExtraction = this.supportsDetailExtraction(source.id);
    
    const siteTypeLabel = {
      'search': '搜索源',
      'browse': '浏览站',
      'reference': '参考站'
    }[source.siteType || 'search'];
    
    const searchableIcon = source.searchable === false ? '🚫' : '🔍';
    const searchableTitle = source.searchable === false ? '不参与搜索' : '参与搜索';
    
    const majorCategoryInfo = this.majorCategories.find(mc => mc.id === majorCategory);
    const majorCategoryLabel = majorCategoryInfo ? `${majorCategoryInfo.icon} ${majorCategoryInfo.name}` : '未知大类';
    
    // 🔴 修复:正确判断是否为自定义源
    const isCustomSource = !source.isSystem;
    
    // 代理配置信息
    const proxyInfo = this.renderSourceProxyInfo(source);
    
    return `
      <div class="source-item ${isEnabled ? 'enabled' : 'disabled'}" data-source-id="${source.id}">
        <div class="source-header">
          <div class="source-toggle">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} 
                   onchange="app.getManager('sources').toggleSourceEnabled('${source.id}', this.checked)">
          </div>
          <div class="source-info">
            <div class="source-name">
              <span class="source-icon">${source.icon || '🔍'}</span>
              <span class="source-title">${escapeHtml(source.name)}</span>
              ${isCustomSource ? '<span class="custom-badge">自定义</span>' : '<span class="builtin-badge">内置</span>'}
            </div>
            <div class="source-subtitle">${escapeHtml(source.subtitle || '')}</div>
            <div class="source-meta">
              <div class="source-major-category">
                <span>大类: ${majorCategoryLabel}</span>
              </div>
              <div class="source-category">
                <span>小类: ${category ? `${category.icon} ${category.name}` : '未知分类'}</span>
              </div>
              <div class="source-url">${escapeHtml(source.urlTemplate)}</div>
            </div>
            <div class="source-badges">
              <span class="searchable-badge" title="${searchableTitle}">
                ${searchableIcon}
              </span>
              <span class="site-type-badge">${siteTypeLabel}</span>
              ${source.searchPriority ? `<span class="priority-badge">优先级: ${source.searchPriority}</span>` : ''}
              ${supportsDetailExtraction ? '<span class="detail-support-badge">支持详情提取</span>' : ''}
              ${proxyInfo.badge}
            </div>
            ${proxyInfo.config}
          </div>
        </div>
        <div class="source-actions">
          <button class="action-btn test-btn" onclick="app.getManager('sources').testSource('${source.id}')" title="测试搜索">
            测试
          </button>
          <button class="action-btn visit-btn" onclick="app.getManager('sources').visitSource('${source.id}')" title="访问网站">
            访问
          </button>
          ${isCustomSource ? `
            <button class="action-btn edit-btn" onclick="app.getManager('sources').editCustomSource('${source.id}')" title="编辑">
              编辑
            </button>
            <button class="action-btn delete-btn" onclick="app.getManager('sources').deleteCustomSource('${source.id}')" title="删除">
              删除
            </button>
          ` : ''}
          ${proxyInfo.actions}
        </div>
      </div>
    `;
  }

  /**
   * 渲染源的代理信息
   */
  renderSourceProxyInfo(source) {
    let badge = '';
    let config = '';
    let actions = '';

    // 代理徽章
    if (source.needsProxy) {
      const proxyEnabled = source.userUseProxy === true;
      badge = `<span class="proxy-badge ${proxyEnabled ? 'proxy-enabled' : 'proxy-disabled'}" 
                     title="${proxyEnabled ? '已启用代理访问' : '需要代理但未启用'}">
                 ${proxyEnabled ? '🔐 代理' : '⚠️ 需代理'}
               </span>`;
    }

    // 代理配置详情
    if (source.needsProxy || source.userUseProxy) {
      const proxyRegions = source.proxyRegions || [];
      const customProxyUrl = source.customProxyUrl;
      const proxyPreference = source.proxyPreference || 'auto';

      config = `
        <div class="source-proxy-config">
          <div class="proxy-config-header">
            <span class="config-label">代理配置:</span>
            <span class="config-status ${source.userUseProxy ? 'enabled' : 'disabled'}">
              ${source.userUseProxy ? '已启用' : '已禁用'}
            </span>
          </div>
          ${proxyRegions.length > 0 ? `
            <div class="proxy-regions">
              <small>需要代理的地区: ${proxyRegions.join(', ')}</small>
            </div>
          ` : ''}
          ${customProxyUrl ? `
            <div class="custom-proxy">
              <small>自定义代理: ${escapeHtml(customProxyUrl)}</small>
            </div>
          ` : ''}
          <div class="proxy-preference">
            <small>代理偏好: ${this.getProxyPreferenceLabel(proxyPreference)}</small>
          </div>
        </div>
      `;
    }

    // 代理操作按钮
    if (source.needsProxy || source.userUseProxy) {
      actions = `
        <button class="action-btn proxy-btn" 
                onclick="app.getManager('sources').toggleSourceProxy('${source.id}', ${!source.userUseProxy})" 
                title="${source.userUseProxy ? '禁用代理' : '启用代理'}">
          ${source.userUseProxy ? '🔓 禁代理' : '🔐 启代理'}
        </button>
        <button class="action-btn proxy-config-btn" 
                onclick="app.getManager('sources').configureSourceProxy('${source.id}')" 
                title="配置代理设置">
          ⚙️ 代理设置
        </button>
      `;
    }

    return { badge, config, actions };
  }

  /**
   * 获取代理偏好标签
   */
  getProxyPreferenceLabel(preference) {
    const labels = {
      'auto': '自动',
      'always': '始终',
      'never': '禁用',
      'manual': '手动'
    };
    return labels[preference] || preference;
  }

  /**
   * 渲染代理配置界面
   */
  renderProxyConfiguration() {
    const proxyConfigContainer = document.getElementById('proxyConfigContainer');
    if (!proxyConfigContainer) return;

    if (!this.app.getCurrentUser()) {
      proxyConfigContainer.innerHTML = `
        <div class="proxy-config-disabled">
          <p>请登录以配置代理设置</p>
        </div>
      `;
      return;
    }

    const config = this.proxyConfig || {};
    const servers = this.proxyServers || [];
    const stats = this.proxyStats || {};

    proxyConfigContainer.innerHTML = `
      <div class="proxy-configuration">
        <!-- 全局代理设置 -->
        <div class="proxy-section">
          <h3>🔐 全局代理设置</h3>
          <div class="proxy-global-controls">
            <div class="control-group">
              <label class="toggle-label">
                <input type="checkbox" id="globalProxyToggle" ${config.proxyEnabled ? 'checked' : ''}>
                <span class="toggle-switch"></span>
                启用代理功能
              </label>
              <small>启用后，需要代理的搜索源将自动通过代理访问</small>
            </div>
            
            <div class="control-group">
              <label class="toggle-label">
                <input type="checkbox" id="intelligentRoutingToggle" ${config.intelligentRouting !== false ? 'checked' : ''}>
                <span class="toggle-switch"></span>
                智能路由
              </label>
              <small>根据用户地区和搜索源自动选择是否使用代理</small>
            </div>
            
            <div class="control-group">
              <label for="userRegionSelect">用户地区:</label>
              <select id="userRegionSelect">
                ${this.renderRegionOptions(config.userRegion || 'CN')}
              </select>
              <small>用于智能代理路由判断</small>
            </div>
            
            <div class="control-group">
              <label for="preferredProxySelect">首选代理服务器:</label>
              <select id="preferredProxySelect">
                <option value="">自动选择</option>
                ${servers.map(server => `
                  <option value="${server.id}" ${config.preferredProxyServer === server.id ? 'selected' : ''}>
                    ${server.name} (${server.serverRegion})
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- 代理服务器状态 -->
        <div class="proxy-section">
          <h3>🌐 代理服务器状态</h3>
          <div class="proxy-servers-status">
            ${this.renderProxyServersStatus(servers)}
          </div>
          <div class="proxy-server-actions">
            <button class="btn-secondary" id="checkProxyHealthBtn">
              🔄 检查服务器健康状态
            </button>
          </div>
        </div>

        <!-- 代理使用统计 -->
        ${this.renderProxyStats(stats)}

        <!-- 高级代理设置 -->
        <div class="proxy-section advanced-settings">
          <h3>⚙️ 高级设置</h3>
          <div class="advanced-controls">
            <div class="control-group">
              <label>
                <input type="checkbox" ${config.autoSwitchOnFailure !== false ? 'checked' : ''}>
                代理失败时自动切换
              </label>
            </div>
            <div class="control-group">
              <label>
                <input type="checkbox" ${config.autoFallbackDirect !== false ? 'checked' : ''}>
                所有代理失败时自动直连
              </label>
            </div>
            <div class="control-group">
              <label for="requestTimeout">请求超时时间 (毫秒):</label>
              <input type="number" id="requestTimeout" value="${config.requestTimeout || 30000}" min="5000" max="120000" step="1000">
            </div>
            <div class="control-group">
              <label for="maxRetries">最大重试次数:</label>
              <input type="number" id="maxRetries" value="${config.maxRetries || 2}" min="0" max="5">
            </div>
          </div>
          <div class="advanced-actions">
            <button class="btn-secondary" id="resetProxyBtn">
              🔄 重置代理设置
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染地区选项
   */
  renderRegionOptions(selectedRegion) {
    const regions = [
      { code: 'CN', name: '中国大陆' },
      { code: 'TW', name: '台湾' },
      { code: 'HK', name: '香港' },
      { code: 'MO', name: '澳门' },
      { code: 'JP', name: '日本' },
      { code: 'KR', name: '韩国' },
      { code: 'SG', name: '新加坡' },
      { code: 'US', name: '美国' },
      { code: 'UK', name: '英国' },
      { code: 'DE', name: '德国' },
      { code: 'FR', name: '法国' },
      { code: 'RU', name: '俄罗斯' },
      { code: 'OTHER', name: '其他地区' }
    ];

    return regions.map(region => `
      <option value="${region.code}" ${selectedRegion === region.code ? 'selected' : ''}>
        ${region.name}
      </option>
    `).join('');
  }

  /**
   * 渲染代理服务器状态
   */
  renderProxyServersStatus(servers) {
    if (servers.length === 0) {
      return '<p>暂无可用的代理服务器</p>';
    }

    return `
      <div class="servers-grid">
        ${servers.map(server => this.renderProxyServerItem(server)).join('')}
      </div>
    `;
  }

  /**
   * 渲染单个代理服务器项
   */
  renderProxyServerItem(server) {
    const healthStatusClass = {
      'healthy': 'status-healthy',
      'degraded': 'status-degraded',
      'unhealthy': 'status-unhealthy',
      'unknown': 'status-unknown'
    }[server.healthStatus] || 'status-unknown';

    const healthStatusText = {
      'healthy': '健康',
      'degraded': '降级',
      'unhealthy': '不健康',
      'unknown': '未知'
    }[server.healthStatus] || '未知';

    const successRate = ((server.successRate || 0) * 100).toFixed(1);
    const responseTime = server.averageResponseTime || 0;

    return `
      <div class="proxy-server-item">
        <div class="server-header">
          <div class="server-name">${escapeHtml(server.name)}</div>
          <div class="server-status ${healthStatusClass}">
            <span class="status-indicator"></span>
            ${healthStatusText}
          </div>
        </div>
        <div class="server-details">
          <div class="server-region">地区: ${server.serverRegion}</div>
          <div class="server-type">类型: ${server.serverType}</div>
          <div class="server-metrics">
            <span class="metric">成功率: ${successRate}%</span>
            <span class="metric">响应时间: ${responseTime}ms</span>
          </div>
        </div>
        <div class="server-actions">
          <button class="btn-small" onclick="app.getManager('sources').testProxyServer('${server.id}')">
            测试
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 渲染代理统计信息
   */
  renderProxyStats(stats) {
    if (!stats || !stats.user) {
      return '';
    }

    const user = stats.user;
    const successRate = user.successRate || 0;
    const totalRequests = user.totalProxyRequests || 0;

    return `
      <div class="proxy-section">
        <h3>📊 代理使用统计</h3>
        <div class="proxy-stats-grid">
          <div class="stat-item">
            <div class="stat-value">${totalRequests}</div>
            <div class="stat-label">总请求数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${user.successfulProxyRequests || 0}</div>
            <div class="stat-label">成功请求</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${successRate}%</div>
            <div class="stat-label">成功率</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${this.formatDataSize(user.dataTransferred || 0)}</div>
            <div class="stat-label">传输数据</div>
          </div>
        </div>
        
        ${stats.sources && stats.sources.length > 0 ? `
          <div class="source-proxy-stats">
            <h4>搜索源代理使用情况</h4>
            <div class="source-stats-list">
              ${stats.sources.map(source => `
                <div class="source-stat-item">
                  <span class="source-name">${escapeHtml(source.name)}</span>
                  <span class="proxy-usage">${source.proxy_usage_percentage}% 代理</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 格式化数据大小
   */
  formatDataSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  bindSourceItemEvents() {
    // 这里可以绑定额外的事件
  }

  filterAndSortSources() {
    this.renderSourcesList();
  }

  async toggleSourceEnabled(sourceId, enabled) {
    try {
      if (enabled) {
        if (!this.enabledSources.includes(sourceId)) {
          this.enabledSources.push(sourceId);
        }
      } else {
        this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      }

      await searchSourcesAPI.updateUserSourceConfig({
        sourceId: sourceId,
        isEnabled: enabled
      });
      
      this.updateSourcesStats();
      showToast(`搜索源已${enabled ? '启用' : '禁用'}`, 'success', 2000);
      
    } catch (error) {
      console.error('切换搜索源状态失败:', error);
      showToast('操作失败: ' + error.message, 'error');
      this.renderSourcesList();
    }
  }

  /**
   * 切换搜索源代理设置
   */
  async toggleSourceProxy(sourceId, useProxy) {
    try {
      await searchSourcesAPI.updateSourceProxy({
        sourceId: sourceId,
        useProxy: useProxy
      });
      
      // 更新本地数据
      const source = this.getSourceById(sourceId);
      if (source) {
        source.userUseProxy = useProxy;
      }
      
      this.renderSourcesList();
      showToast(`搜索源代理已${useProxy ? '启用' : '禁用'}`, 'success', 2000);
      
    } catch (error) {
      console.error('切换搜索源代理失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 配置搜索源代理
   */
  async configureSourceProxy(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    // 显示代理配置对话框
    this.showSourceProxyConfigModal(source);
  }

  /**
   * 显示搜索源代理配置对话框
   */
  showSourceProxyConfigModal(source) {
    let modal = document.getElementById('sourceProxyConfigModal');
    if (!modal) {
      modal = this.createSourceProxyConfigModal();
      document.body.appendChild(modal);
    }

    this.populateSourceProxyConfigForm(modal, source);
    modal.style.display = 'block';
  }

  /**
   * 创建搜索源代理配置对话框
   */
  createSourceProxyConfigModal() {
    const modal = document.createElement('div');
    modal.id = 'sourceProxyConfigModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>代理配置 - <span id="sourceProxyConfigTitle"></span></h2>
        <form id="sourceProxyConfigForm">
          <input type="hidden" name="sourceId">
          
          <div class="form-group">
            <label>
              <input type="checkbox" name="useProxy" id="useProxy">
              启用代理访问
            </label>
          </div>
          
          <div class="form-group">
            <label for="proxyPreference">代理偏好:</label>
            <select name="proxyPreference" id="proxyPreference">
              <option value="auto">自动</option>
              <option value="always">始终使用</option>
              <option value="never">从不使用</option>
              <option value="manual">手动选择</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="customProxyUrl">自定义代理URL:</label>
            <input type="url" name="customProxyUrl" id="customProxyUrl" placeholder="https://your-proxy.workers.dev">
            <small>留空使用系统默认代理服务器</small>
          </div>
          
          <div class="form-group">
            <label>
              <input type="checkbox" name="allowFallbackDirect" id="allowFallbackDirect" checked>
              代理失败时允许直连
            </label>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">保存设置</button>
          </div>
        </form>
      </div>
    `;

    const form = modal.querySelector('#sourceProxyConfigForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSourceProxyConfigSubmit(e));
    }

    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    return modal;
  }

  /**
   * 填充搜索源代理配置表单
   */
  populateSourceProxyConfigForm(modal, source) {
    const form = modal.querySelector('#sourceProxyConfigForm');
    const title = modal.querySelector('#sourceProxyConfigTitle');
    
    if (title) {
      title.textContent = source.name;
    }

    if (form) {
      form.sourceId.value = source.id;
      form.useProxy.checked = source.userUseProxy === true;
      form.proxyPreference.value = source.proxyPreference || 'auto';
      form.customProxyUrl.value = source.customProxyUrl || '';
      form.allowFallbackDirect.checked = source.allowFallbackDirect !== false;
    }
  }

  /**
   * 处理搜索源代理配置提交
   */
  async handleSourceProxyConfigSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const configData = {
      sourceId: formData.get('sourceId'),
      useProxy: formData.get('useProxy') === 'on',
      proxyPreference: formData.get('proxyPreference'),
      customProxyUrl: formData.get('customProxyUrl') || null,
      allowFallbackDirect: formData.get('allowFallbackDirect') === 'on'
    };

    try {
      showLoading(true);
      
      await searchSourcesAPI.updateSourceProxy(configData);
      
      // 更新本地数据
      const source = this.getSourceById(configData.sourceId);
      if (source) {
        Object.assign(source, configData);
      }
      
      this.renderSourcesList();
      this.app.closeModals();
      showToast('代理配置已保存', 'success');
      
    } catch (error) {
      console.error('保存代理配置失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 切换全局代理
   */
  async toggleGlobalProxy(enabled) {
    try {
      await searchSourcesAPI.updateProxySettings({
        proxyEnabled: enabled
      });
      
      if (this.proxyConfig) {
        this.proxyConfig.proxyEnabled = enabled;
      }
      
      showToast(`全局代理已${enabled ? '启用' : '禁用'}`, 'success');
    } catch (error) {
      console.error('切换全局代理失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 切换智能路由
   */
  async toggleIntelligentRouting(enabled) {
    try {
      await searchSourcesAPI.updateProxySettings({
        intelligentRouting: enabled
      });
      
      if (this.proxyConfig) {
        this.proxyConfig.intelligentRouting = enabled;
      }
      
      showToast(`智能路由已${enabled ? '启用' : '禁用'}`, 'success');
    } catch (error) {
      console.error('切换智能路由失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 更新用户地区
   */
  async updateUserRegion(region) {
    try {
      await searchSourcesAPI.updateProxySettings({
        userRegion: region
      });
      
      if (this.proxyConfig) {
        this.proxyConfig.userRegion = region;
      }
      
      showToast('用户地区已更新', 'success');
    } catch (error) {
      console.error('更新用户地区失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 更新首选代理
   */
  async updatePreferredProxy(serverId) {
    try {
      await searchSourcesAPI.updateProxySettings({
        preferredProxyServer: serverId || null
      });
      
      if (this.proxyConfig) {
        this.proxyConfig.preferredProxyServer = serverId;
      }
      
      showToast('首选代理服务器已更新', 'success');
    } catch (error) {
      console.error('更新首选代理失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  /**
   * 检查代理健康状态
   */
  async checkProxyHealth() {
    try {
      showLoading(true, '检查代理服务器健康状态...');
      
      const healthChecks = await Promise.all(
        this.proxyServers.map(server => 
          searchSourcesAPI.checkProxyHealth(server.id).catch(error => ({
            serverId: server.id,
            error: error.message
          }))
        )
      );
      
      // 重新加载代理配置以获取最新状态
      await this.loadProxyConfig();
      this.renderProxyConfiguration();
      
      const healthyCount = healthChecks.filter(check => !check.error).length;
      showToast(`健康检查完成: ${healthyCount}/${this.proxyServers.length} 个服务器健康`, 'success');
      
    } catch (error) {
      console.error('检查代理健康状态失败:', error);
      showToast('健康检查失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 测试代理服务器
   */
  async testProxyServer(serverId) {
    try {
      showLoading(true, `测试代理服务器...`);
      
      const result = await searchSourcesAPI.checkProxyHealth(serverId);
      
      const server = this.proxyServers.find(s => s.id === serverId);
      const serverName = server ? server.name : serverId;
      
      if (result.error) {
        showToast(`${serverName} 测试失败: ${result.error}`, 'error');
      } else {
        showToast(`${serverName} 测试成功 (${result.responseTime}ms)`, 'success');
      }
      
    } catch (error) {
      console.error('测试代理服务器失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 重置代理设置
   */
  async resetProxySettings() {
    if (!confirm('确定要重置所有代理设置吗？此操作不可撤销。')) {
      return;
    }

    try {
      showLoading(true);
      
      await searchSourcesAPI.resetProxySettings();
      await this.loadProxyConfig();
      this.renderProxyConfiguration();
      
      showToast('代理设置已重置', 'success');
    } catch (error) {
      console.error('重置代理设置失败:', error);
      showToast('重置失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  async enableAllSources() {
    try {
      this.enabledSources = this.allSearchSources.map(s => s.id);
      await searchSourcesAPI.enableAllSources();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已启用所有搜索源', 'success');
    } catch (error) {
      console.error('启用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async disableAllSources() {
    if (!confirm('确定要禁用所有搜索源吗?这将影响搜索功能。')) return;
    
    try {
      this.enabledSources = [];
      await searchSourcesAPI.disableAllSources();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已禁用所有搜索源', 'success');
    } catch (error) {
      console.error('禁用所有搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async resetToDefaults() {
    if (!confirm('确定要重置为默认搜索源配置吗?')) return;
    
    try {
      await searchSourcesAPI.resetToDefaults();
      await this.loadUserSearchSettings();
      this.renderSourcesList();
      this.updateSourcesStats();
      showToast('已重置为默认配置', 'success');
    } catch (error) {
      console.error('重置搜索源失败:', error);
      showToast('操作失败: ' + error.message, 'error');
    }
  }

  async testSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      let testUrl;
      if (source.searchable !== false) {
        testUrl = source.urlTemplate.replace('{keyword}', 'test');
      } else {
        testUrl = source.urlTemplate;
      }
      
      window.open(testUrl, '_blank', 'noopener,noreferrer');
      showToast('已在新窗口中打开测试链接', 'success', 2000);
    } catch (error) {
      console.error('测试搜索源失败:', error);
      showToast('测试失败: ' + error.message, 'error');
    }
  }

  async visitSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) {
      showToast('未找到指定的搜索源', 'error');
      return;
    }

    try {
      let baseUrl;
      if (source.searchable === false) {
        baseUrl = source.urlTemplate;
      } else {
        const urlObj = new URL(source.urlTemplate.replace('{keyword}', ''));
        baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
      }
      
      window.open(baseUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('访问搜索源失败:', error);
      showToast('访问失败: ' + error.message, 'error');
    }
  }

  showCustomSourceModal(source = null) {
    this.editingCustomSource = source;
    
    let modal = document.getElementById('customSourceModal');
    if (!modal) {
      modal = this.createCustomSourceModal();
      document.body.appendChild(modal);
    }
    
    this.populateCustomSourceForm(modal, source);
    modal.style.display = 'block';
    
    setTimeout(() => {
      const nameInput = modal.querySelector('#sourceName');
      if (nameInput) nameInput.focus();
    }, 100);
  }

  createCustomSourceModal() {
    const modal = document.createElement('div');
    modal.id = 'customSourceModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <h2>添加自定义搜索源</h2>
        <form id="customSourceForm">
          <input type="hidden" name="sourceId">
          
          <div class="form-row">
            <div class="form-group">
              <label for="sourceName">搜索源名称 *</label>
              <input type="text" name="sourceName" id="sourceName" required maxlength="50" 
                     placeholder="例如:我的搜索站">
            </div>
            
            <div class="form-group">
              <label for="sourceIcon">图标</label>
              <input type="text" name="sourceIcon" id="sourceIcon" maxlength="5" 
                     placeholder="🔍" value="🔍">
            </div>
          </div>
          
          <div class="form-group">
            <label for="sourceSubtitle">描述信息</label>
            <input type="text" name="sourceSubtitle" id="sourceSubtitle" maxlength="100" 
                   placeholder="例如:专业的搜索引擎">
          </div>
          
          <div class="form-group">
            <label for="sourceCategory">搜索源分类 *</label>
            <select name="sourceCategory" id="sourceCategory" required>
              <!-- 分类选项将动态生成 -->
            </select>
          </div>
          
          <div class="form-group">
            <label for="sourceUrl">搜索URL模板 *</label>
            <input type="url" name="sourceUrl" id="sourceUrl" required 
                   placeholder="https://example.com/search?q={keyword}">
            <small class="form-help">
              <span id="urlHelpText">URL中必须包含 <code>{keyword}</code> 占位符,搜索时会被替换为实际关键词</span>
            </small>
          </div>
          
          <fieldset class="site-config-section">
            <legend>网站类型配置</legend>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="searchable" id="searchable" checked>
                参与番号搜索
              </label>
              <small>取消勾选后,搜索时不会显示该网站</small>
            </div>
            
            <div class="form-group">
              <label for="siteType">网站类型</label>
              <select name="siteType" id="siteType">
                <option value="search">搜索源</option>
                <option value="browse">浏览站</option>
                <option value="reference">参考站</option>
              </select>
            </div>
            
            <div class="form-group">
              <label for="searchPriority">搜索优先级</label>
              <input type="number" name="searchPriority" id="searchPriority" 
                     min="1" max="10" value="5">
              <small>数字越小优先级越高</small>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="requiresKeyword" id="requiresKeyword" checked>
                需要搜索关键词
              </label>
            </div>
          </fieldset>

          <fieldset class="proxy-config-section">
            <legend>代理配置</legend>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="needsProxy" id="needsProxy">
                需要代理访问
              </label>
              <small>勾选后，该搜索源将通过代理访问</small>
            </div>
            
            <div class="form-group">
              <label for="proxyRegions">需要代理的地区</label>
              <input type="text" name="proxyRegions" id="proxyRegions" 
                     placeholder="例如: CN,RU,IR">
              <small>多个地区用逗号分隔，留空表示所有地区都需要代理</small>
            </div>
            
            <div class="form-group">
              <label for="customProxyUrl">自定义代理URL</label>
              <input type="url" name="customProxyUrl" id="customProxyUrl" 
                     placeholder="https://your-proxy.workers.dev">
              <small>留空使用系统默认代理服务器</small>
            </div>
          </fieldset>
          
          <div class="form-actions">
            <button type="button" class="btn-secondary" onclick="app.closeModals()">取消</button>
            <button type="submit" class="btn-primary">添加搜索源</button>
          </div>
        </form>
      </div>
    `;
    
    const form = modal.querySelector('#customSourceForm');
    if (form) {
      form.addEventListener('submit', (e) => this.handleCustomSourceSubmit(e));
      
      const searchableCheckbox = form.querySelector('#searchable');
      const urlInput = form.querySelector('#sourceUrl');
      const urlHelpText = form.querySelector('#urlHelpText');
      
      if (searchableCheckbox && urlHelpText) {
        searchableCheckbox.addEventListener('change', () => {
          if (searchableCheckbox.checked) {
            urlHelpText.innerHTML = 'URL中必须包含 <code>{keyword}</code> 占位符,搜索时会被替换为实际关键词';
            urlInput.placeholder = 'https://example.com/search?q={keyword}';
          } else {
            urlHelpText.innerHTML = '浏览站点只需提供基础访问URL,无需包含搜索参数';
            urlInput.placeholder = 'https://example.com';
          }
        });
      }
    }
    
    return modal;
  }

  // 修复 populateCustomSourceForm 方法中的分类显示问题
  populateCustomSourceForm(modal, source) {
    const form = modal.querySelector('#customSourceForm');
    if (!form) return;

    // 首先更新分类选择框
    this.updateSourceCategorySelect(form.sourceCategory);

    if (source) {
      // 编辑模式
      form.sourceId.value = source.id;
      form.sourceName.value = source.name;
      form.sourceSubtitle.value = source.subtitle || '';
      form.sourceIcon.value = source.icon || '🔍';
      form.sourceUrl.value = source.urlTemplate;
      
      // 🔴 修复：确保分类值正确设置
      const sourceCategoryId = source.categoryId || source.category;
      
      // 检查分类是否存在于当前分类列表中
      const categoryExists = this.allCategories.some(cat => cat.id === sourceCategoryId);
      
      if (categoryExists) {
        form.sourceCategory.value = sourceCategoryId;
      } else {
        // 如果分类不存在，添加一个临时选项保持原始值
        const tempOption = document.createElement('option');
        tempOption.value = sourceCategoryId;
        tempOption.textContent = `🔍 ${sourceCategoryId} (原分类)`;
        tempOption.style.color = '#888';
        form.sourceCategory.appendChild(tempOption);
        form.sourceCategory.value = sourceCategoryId;
        
        console.warn(`分类 ${sourceCategoryId} 不存在于当前分类列表中，已添加临时选项`);
      }
      
      form.searchable.checked = source.searchable !== false;
      form.siteType.value = source.siteType || 'search';
      form.searchPriority.value = source.searchPriority || 5;
      form.requiresKeyword.checked = source.requiresKeyword !== false;
      
      // 代理配置
      form.needsProxy.checked = source.needsProxy === true;
      form.proxyRegions.value = source.proxyRegions ? source.proxyRegions.join(',') : '';
      form.customProxyUrl.value = source.customProxyUrl || '';
      
      modal.querySelector('h2').textContent = '编辑自定义搜索源';
      modal.querySelector('[type="submit"]').textContent = '更新搜索源';
    } else {
      // 新增模式
      form.reset();
      form.sourceIcon.value = '🔍';
      form.sourceCategory.value = 'others';
      form.searchable.checked = true;
      form.siteType.value = 'search';
      form.searchPriority.value = 5;
      form.requiresKeyword.checked = true;
      form.needsProxy.checked = false;
      modal.querySelector('h2').textContent = '添加自定义搜索源';
      modal.querySelector('[type="submit"]').textContent = '添加搜索源';
      
      // 只在新增模式下添加分类变更监听器
      const categorySelect = form.sourceCategory;
      // 移除之前的监听器（如果存在）
      const newCategorySelect = categorySelect.cloneNode(true);
      categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);
      
      newCategorySelect.addEventListener('change', (e) => {
        const category = this.getCategoryById(e.target.value);
        if (category) {
          form.searchable.checked = category.defaultSearchable !== false;
          form.siteType.value = category.defaultSiteType || 'search';
          form.searchPriority.value = category.searchPriority || 5;
          form.searchable.dispatchEvent(new Event('change'));
        }
      });
    }
    
    if (form.searchable) {
      form.searchable.dispatchEvent(new Event('change'));
    }
  }

  // 🔴 增强 updateSourceCategorySelect 方法，支持保持原有分类
  updateSourceCategorySelect(selectElement, preserveCurrentValue = false) {
    if (!selectElement) return;

    const currentValue = preserveCurrentValue ? selectElement.value : null;

    const categoriesHTML = this.allCategories
      .sort((a, b) => (a.displayOrder || a.order || 999) - (b.displayOrder || b.order || 999))
      .map(category => `
        <option value="${category.id}">${category.icon} ${category.name}</option>
      `).join('');

    selectElement.innerHTML = categoriesHTML;

    // 如果需要保持原有值且该值不在新选项中，添加临时选项
    if (preserveCurrentValue && currentValue) {
      const valueExists = this.allCategories.some(cat => cat.id === currentValue);
      if (!valueExists) {
        const tempOption = document.createElement('option');
        tempOption.value = currentValue;
        tempOption.textContent = `🔍 ${currentValue} (原分类)`;
        tempOption.style.color = '#888';
        selectElement.appendChild(tempOption);
      }
      selectElement.value = currentValue;
    }
  }

  // 🔴 修复:保存时使用 categoryId 字段
  async handleCustomSourceSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const sourceData = {
      id: formData.get('sourceId') || null,
      name: formData.get('sourceName').trim(),
      subtitle: formData.get('sourceSubtitle').trim(),
      icon: formData.get('sourceIcon').trim() || '🔍',
      urlTemplate: formData.get('sourceUrl').trim(),
      categoryId: formData.get('sourceCategory'),  // 🔴 使用 categoryId
      searchable: formData.get('searchable') === 'on',
      siteType: formData.get('siteType') || 'search',
      searchPriority: parseInt(formData.get('searchPriority')) || 5,
      requiresKeyword: formData.get('requiresKeyword') === 'on',
      needsProxy: formData.get('needsProxy') === 'on',
      proxyRegions: formData.get('proxyRegions') ? formData.get('proxyRegions').split(',').map(s => s.trim()) : [],
      customProxyUrl: formData.get('customProxyUrl') || null
    };
    
    const validation = this.validateCustomSource(sourceData);
    if (!validation.valid) {
      showToast(validation.message, 'error');
      return;
    }
    
    try {
      showLoading(true);
      
      if (this.editingCustomSource && sourceData.id) {
        await searchSourcesAPI.updateSearchSource(sourceData.id, sourceData);
        showToast('自定义搜索源更新成功', 'success');
      } else {
        await searchSourcesAPI.createSearchSource(sourceData);
        showToast('自定义搜索源添加成功', 'success');
      }
      
      await this.loadUserSearchSettings();
      await this.loadTabData();
      this.app.closeModals();
      
    } catch (error) {
      console.error('保存自定义搜索源失败:', error);
      showToast('保存失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  validateCustomSource(sourceData) {
    const rules = APP_CONSTANTS.VALIDATION_RULES.SOURCE;
    
    const requiredFieldsForValidation = rules.REQUIRED_FIELDS.filter(field => field !== 'id');
    
    for (const field of requiredFieldsForValidation) {
      const value = sourceData[field] || sourceData[field.replace('Template', '')];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        return { valid: false, message: `${field} 是必需的` };
      }
    }
    
    if (!rules.NAME_PATTERN.test(sourceData.name)) {
      return { valid: false, message: '搜索源名称格式不正确' };
    }
    
    if (!validateSourceUrl(sourceData.urlTemplate, sourceData.searchable)) {
      if (sourceData.searchable) {
        return { valid: false, message: '搜索源URL必须包含{keyword}占位符' };
      } else {
        return { valid: false, message: 'URL格式无效' };
      }
    }
    
    try {
      const testUrl = sourceData.searchable ? 
        sourceData.urlTemplate.replace('{keyword}', 'test') : 
        sourceData.urlTemplate;
      const hostname = new URL(testUrl).hostname;
      
      if (rules.FORBIDDEN_DOMAINS.some(domain => hostname.includes(domain))) {
        return { valid: false, message: '不允许使用该域名' };
      }
    } catch (error) {
      return { valid: false, message: 'URL格式无效' };
    }
    
    const categoryId = sourceData.categoryId || sourceData.category;
    if (!this.getCategoryById(categoryId)) {
      return { valid: false, message: '选择的分类不存在' };
    }
    
    return { valid: true };
  }

  editCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    this.showCustomSourceModal(source);
  }

  async deleteCustomSource(sourceId) {
    const source = this.customSearchSources.find(s => s.id === sourceId);
    if (!source) {
      showToast('未找到指定的自定义搜索源', 'error');
      return;
    }
    
    if (!confirm(`确定要删除自定义搜索源"${source.name}"吗?此操作不可撤销。`)) {
      return;
    }
    
    try {
      showLoading(true);
      await searchSourcesAPI.deleteSearchSource(sourceId);
      
      this.customSearchSources = this.customSearchSources.filter(s => s.id !== sourceId);
      this.allSearchSources = this.allSearchSources.filter(s => s.id !== sourceId);
      this.enabledSources = this.enabledSources.filter(id => id !== sourceId);
      
      await this.loadTabData();
      showToast('自定义搜索源删除成功', 'success');
      
    } catch (error) {
      console.error('删除自定义搜索源失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  updateSourcesStats() {
    const elements = {
      totalSourcesCount: document.getElementById('totalSourcesCount'),
      enabledSourcesCount: document.getElementById('enabledSourcesCount'),
      customSourcesCount: document.getElementById('customSourcesCount'),
      categoriesCount: document.getElementById('categoriesCount')
    };

    if (elements.totalSourcesCount) elements.totalSourcesCount.textContent = this.allSearchSources.length;
    if (elements.enabledSourcesCount) elements.enabledSourcesCount.textContent = this.enabledSources.length;
    if (elements.customSourcesCount) elements.customSourcesCount.textContent = this.customSearchSources.length;
    if (elements.categoriesCount) elements.categoriesCount.textContent = this.allCategories.length;
  }

  async exportSources() {
    try {
      const exportData = await searchSourcesAPI.exportUserSearchSources();
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-sources-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('搜索源配置导出成功', 'success');
    } catch (error) {
      console.error('导出搜索源失败:', error);
      showToast('导出失败: ' + error.message, 'error');
    }
  }

  resetEditingState() {
    this.editingCustomSource = null;
  }

  supportsDetailExtraction(sourceId) {
    const detailSources = APP_CONSTANTS.DETAIL_EXTRACTION_SOURCES || [];
    return detailSources.includes(sourceId);
  }

  // 🔴 修复:获取源的大类,支持字段兼容
  getMajorCategoryForSource(sourceId) {
    const source = this.getSourceById(sourceId);
    if (!source) return null;
    
    const categoryId = source.categoryId || source.category;
    const category = this.getCategoryById(categoryId);
    return category ? (category.majorCategoryId || category.majorCategory) : null;
  }

  // 🆕 新增:获取指定大类下的所有源
  getSourcesByMajorCategory(majorCategoryId) {
    return this.allSearchSources.filter(source => {
      const categoryId = source.categoryId || source.category;
      const category = this.getCategoryById(categoryId);
      const sourceMajorCategoryId = category?.majorCategoryId || category?.majorCategory;
      return sourceMajorCategoryId === majorCategoryId;
    });
  }

  getSourceById(sourceId) {
    return this.allSearchSources.find(source => source.id === sourceId);
  }

  getCategoryById(categoryId) {
    return this.allCategories.find(category => category.id === categoryId);
  }

  getCustomCategories() {
    return this.allCategories.filter(category => !category.isSystem);
  }

  getTotalSourcesCount() {
    return this.allSearchSources.length;
  }

  getEnabledSourcesCount() {
    return this.enabledSources.length;
  }

  getAllSearchSources() {
    return this.allSearchSources;
  }

  getMajorCategories() {
    return this.majorCategories;
  }

  getAllCategories() {
    return this.allCategories;
  }
}

export default SourcesManager;