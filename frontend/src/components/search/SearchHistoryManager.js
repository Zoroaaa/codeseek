// src/components/search/SearchHistoryManager.js - 搜索历史管理子组件
// 版本 2.0.0 - 适配后端架构升级，支持新架构元数据记录
import { APP_CONSTANTS } from '../../core/constants.js';
import { showToast, showLoading } from '../../utils/dom.js';
import { escapeHtml } from '../../utils/format.js';
import { searchHistoryManager as apiHistoryManager } from '../../services/search.js';
import apiService from '../../services/api.js';
import authManager from '../../services/auth.js';

export class SearchHistoryManager {
  constructor() {
    this.searchHistory = [];
    this.maxHistoryItems = 100;
    this.version = '2.0.0'; // 🆕 新架构版本
    
    // 🆕 新架构特性支持
    this.architectureFeatures = {
      modularParsers: true,
      unifiedDataStructure: true,
      enhancedMetadata: true
    };
    
    // 🆕 架构元数据
    this.historyMetadata = {
      architecture: 'modular_parsers',
      dataStructureVersion: '2.0',
      lastSync: 0,
      syncEnabled: true
    };
  }

  /**
   * 初始化历史管理器 - 适配新架构v2.0.0
   */
  async init() {
    try {
      console.log(`初始化搜索历史管理器 (新架构 v${this.version})`);
      
      await this.loadSearchHistory();
      this.bindHistoryEvents();
      
      // 🆕 初始化新架构特性
      await this.initArchitectureFeatures();
      
      console.log(`搜索历史管理器初始化完成 (v${this.version})`);
      console.log('支持的新架构特性:', this.architectureFeatures);
      
    } catch (error) {
      console.error('搜索历史管理器初始化失败:', error);
    }
  }

  /**
   * 🆕 初始化新架构特性
   */
  async initArchitectureFeatures() {
    try {
      // 检查用户设置中的新架构配置
      if (authManager.isAuthenticated()) {
        const userSettings = await apiService.getUserSettings();
        
        // 更新架构元数据
        this.historyMetadata.syncEnabled = userSettings.allowHistory !== false;
        this.historyMetadata.lastSync = Date.now();
        
        console.log('新架构历史管理特性已启用:', {
          version: this.version,
          syncEnabled: this.historyMetadata.syncEnabled,
          architecture: this.historyMetadata.architecture
        });
      }
      
    } catch (error) {
      console.warn('初始化新架构特性失败，使用默认配置:', error);
    }
  }

  /**
   * 加载搜索历史 - 增强新架构支持
   */
  async loadSearchHistory() {
    if (!authManager.isAuthenticated()) {
      this.searchHistory = [];
      this.renderHistory();
      return;
    }

    try {
      console.log('加载搜索历史 (新架构)');
      
      this.searchHistory = await apiHistoryManager.getHistory();
      
      // 🆕 增强历史数据，添加架构信息
      this.searchHistory = this.enhanceHistoryWithArchitectureInfo(this.searchHistory);
      
      this.renderHistory();
      
      // 🆕 更新同步状态
      this.historyMetadata.lastSync = Date.now();
      
    } catch (error) {
      console.error('加载搜索历史失败:', error);
      this.searchHistory = [];
      this.renderHistory();
    }
  }

  /**
   * 🆕 增强历史数据，添加架构信息
   */
  enhanceHistoryWithArchitectureInfo(historyData) {
    return historyData.map(item => ({
      ...item,
      // 添加新架构元数据（如果不存在）
      architecture: item.architecture || 'modular_parsers',
      dataStructureVersion: item.dataStructureVersion || '2.0',
      enhancedMetadata: item.enhancedMetadata || {
        platform: 'web',
        userAgent: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
        timestamp: item.timestamp
      }
    }));
  }

  /**
   * 添加到历史记录 - 增强新架构支持
   */
  async addToHistory(keyword, resultCount = 0) {
    if (!authManager.isAuthenticated()) return;

    try {
      const settings = await apiService.getUserSettings();
      const maxHistory = settings.maxHistoryPerUser || this.maxHistoryItems;
      
      // 如果超出限制，删除最旧的记录
      if (this.searchHistory.length >= maxHistory) {
        const oldestId = this.searchHistory[this.searchHistory.length - 1].id;
        await apiService.deleteSearchHistory(oldestId);
        this.searchHistory.pop();
      }

      // 🆕 构建包含新架构信息的历史记录
      const historyItem = {
        keyword: keyword,
        query: keyword,
        resultCount: resultCount,
        timestamp: Date.now(),
        source: 'manual',
        // 🆕 新架构元数据
        architecture: this.historyMetadata.architecture,
        dataStructureVersion: this.historyMetadata.dataStructureVersion,
        enhancedMetadata: {
          platform: 'web',
          userAgent: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop',
          searchVersion: this.version,
          hasDetailExtraction: resultCount > 0,
          performanceMetrics: {
            searchTime: 0, // 会在实际调用时更新
            resultQuality: this.calculateResultQuality(resultCount)
          }
        }
      };

      await apiHistoryManager.addToHistory(keyword, 'manual', historyItem);
      
      // 从本地数组中移除重复项
      this.searchHistory = this.searchHistory.filter(item => 
        item.keyword !== keyword
      );
      
      // 添加新项到数组开头
      this.searchHistory.unshift({
        id: `history_v2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...historyItem,
        count: 1
      });

      // 确保不超过最大限制
      const maxHistoryLimit = APP_CONSTANTS.LIMITS.MAX_HISTORY;
      if (this.searchHistory.length > maxHistoryLimit) {
        this.searchHistory = this.searchHistory.slice(0, maxHistoryLimit);
      }

      this.renderHistory();
      
      // 🆕 触发新架构历史更新事件
      this.emitHistoryUpdated();
      
    } catch (error) {
      console.error('保存搜索历史失败:', error);
      showToast('保存搜索历史失败', 'warning');
    }
  }

  /**
   * 🆕 计算结果质量
   */
  calculateResultQuality(resultCount) {
    if (resultCount === 0) return 'no_results';
    if (resultCount < 5) return 'low';
    if (resultCount < 15) return 'medium';
    if (resultCount < 30) return 'high';
    return 'excellent';
  }

  /**
   * 渲染搜索历史 - 增强新架构信息显示
   */
  renderHistory() {
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    if (this.searchHistory.length === 0) {
      if (historySection) historySection.style.display = 'none';
      return;
    }

    if (historySection) historySection.style.display = 'block';
    
    if (historyList) {
      historyList.innerHTML = this.searchHistory.slice(0, 10).map(item => {
        // 🆕 生成架构信息显示
        const architectureInfo = this.generateArchitectureInfo(item);
        const qualityIndicator = this.getQualityIndicator(item);
        
        return `<div class="history-item-container" data-architecture="${item.architecture || 'unknown'}">
          <span class="history-item" data-keyword="${escapeHtml(item.keyword)}">
            <span class="history-keyword">${escapeHtml(item.keyword)}</span>
            ${item.resultCount !== undefined ? `<small class="history-count">(${item.resultCount}个结果)</small>` : ''}
            ${qualityIndicator}
            ${architectureInfo}
          </span>
          <button class="history-delete-btn" data-history-id="${item.id}" title="删除这条记录">
            ×
          </button>
        </div>`;
      }).join('');
    }
  }

  /**
   * 🆕 生成架构信息显示
   */
  generateArchitectureInfo(item) {
    if (!item.architecture || item.architecture === 'unknown') return '';
    
    const isNewArchitecture = item.dataStructureVersion === '2.0';
    const hasEnhancedData = item.enhancedMetadata && Object.keys(item.enhancedMetadata).length > 0;
    
    if (isNewArchitecture || hasEnhancedData) {
      return `<span class="architecture-badge v2" title="新架构 v${item.dataStructureVersion || '2.0'}">🗂️</span>`;
    }
    
    return '';
  }

  /**
   * 🆕 获取质量指示器
   */
  getQualityIndicator(item) {
    if (!item.enhancedMetadata?.performanceMetrics?.resultQuality) return '';
    
    const quality = item.enhancedMetadata.performanceMetrics.resultQuality;
    const indicators = {
      'no_results': { icon: '❌', title: '无结果' },
      'low': { icon: '🔸', title: '结果较少' },
      'medium': { icon: '🔶', title: '结果适中' },
      'high': { icon: '🔥', title: '结果丰富' },
      'excellent': { icon: '⭐', title: '结果优秀' }
    };
    
    const indicator = indicators[quality];
    if (!indicator) return '';
    
    return `<span class="quality-indicator ${quality}" title="${indicator.title}">${indicator.icon}</span>`;
  }

  /**
   * 从历史记录搜索 - 增强新架构支持
   */
  searchFromHistory(keyword) {
    // 🆕 记录从历史记录搜索的元数据
    const searchMetadata = {
      source: 'history',
      architecture: this.historyMetadata.architecture,
      timestamp: Date.now()
    };
    
    // 触发历史搜索事件（包含新架构信息）
    document.dispatchEvent(new CustomEvent('historySearchRequested', {
      detail: { 
        keyword,
        metadata: searchMetadata,
        version: this.version
      }
    }));
  }

  /**
   * 删除单条历史记录 - 保持原有功能
   */
  async deleteHistoryItem(historyId) {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要删除这条搜索记录吗？')) return;

    try {
      showLoading(true);
      
      // 调用API删除
      await apiService.deleteSearchHistory(historyId);
      
      // 从本地数组中移除
      this.searchHistory = this.searchHistory.filter(item => item.id !== historyId);
      
      // 重新渲染历史列表
      this.renderHistory();
      
      // 🆕 触发新架构历史更新事件
      this.emitHistoryUpdated();
      
      showToast('搜索记录已删除', 'success');
    } catch (error) {
      console.error('删除搜索历史失败:', error);
      showToast('删除失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 清空搜索历史 - 保持原有功能
   */
  async clearAllHistory() {
    if (!authManager.isAuthenticated()) {
      showToast('用户未登录', 'error');
      return;
    }

    if (!confirm('确定要清空所有搜索历史吗？')) return;
    
    try {
      showLoading(true);
      
      await apiHistoryManager.clearAllHistory();
      this.searchHistory = [];
      this.renderHistory();
      
      // 🆕 重置架构元数据
      this.historyMetadata.lastSync = Date.now();
      
      // 🆕 触发新架构历史更新事件
      this.emitHistoryUpdated();
      
      showToast('搜索历史已清空', 'success');
    } catch (error) {
      console.error('清空搜索历史失败:', error);
      showToast('清空失败: ' + error.message, 'error');
    } finally {
      showLoading(false);
    }
  }

  /**
   * 绑定历史事件 - 增强新架构支持
   */
  bindHistoryEvents() {
    // 绑定历史列表点击事件
    document.addEventListener('click', (e) => {
      const historyItem = e.target.closest('.history-item');
      const deleteBtn = e.target.closest('.history-delete-btn');
      
      if (deleteBtn) {
        e.stopPropagation();
        const historyId = deleteBtn.dataset.historyId;
        this.deleteHistoryItem(historyId);
      } else if (historyItem) {
        const keyword = historyItem.dataset.keyword;
        this.searchFromHistory(keyword);
      }
    });

    // 绑定清空历史按钮
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => this.clearAllHistory());
    }

    // 监听认证状态变更
    document.addEventListener('authStateChanged', () => {
      this.loadSearchHistory();
    });

    // 🆕 监听新架构配置变更
    document.addEventListener('searchConfigChanged', (event) => {
      if (event.detail.config) {
        this.handleConfigUpdate(event.detail.config);
      }
    });

    // 🆕 监听架构升级事件
    document.addEventListener('architectureUpgraded', (event) => {
      const { version, features } = event.detail;
      this.handleArchitectureUpgrade(version, features);
    });
  }

  /**
   * 🆕 处理配置更新
   */
  handleConfigUpdate(config) {
    // 只处理与历史记录相关的配置
    if (config.saveToHistory !== undefined) {
      this.historyMetadata.syncEnabled = config.saveToHistory;
      console.log(`搜索历史同步${config.saveToHistory ? '已启用' : '已禁用'} (新架构)`);
    }
  }

  /**
   * 🆕 处理架构升级
   */
  handleArchitectureUpgrade(version, features) {
    if (version !== this.version) {
      console.log(`升级到新架构版本: ${this.version} -> ${version}`);
      this.version = version;
      this.architectureFeatures = { ...this.architectureFeatures, ...features };
      this.historyMetadata.architecture = 'modular_parsers';
      this.historyMetadata.dataStructureVersion = version;
      
      // 重新渲染以应用新架构标识
      this.renderHistory();
    }
  }

  /**
   * 🆕 触发历史更新事件
   */
  emitHistoryUpdated() {
    document.dispatchEvent(new CustomEvent('historyUpdated', {
      detail: { 
        history: this.getHistory(),
        metadata: this.historyMetadata,
        version: this.version
      }
    }));
  }

  /**
   * 🆕 更新搜索结果数量（供外部调用）
   */
  updateSearchResultCount(keyword, resultCount) {
    const historyItem = this.searchHistory.find(item => item.keyword === keyword);
    if (historyItem) {
      historyItem.resultCount = resultCount;
      
      // 更新性能指标
      if (historyItem.enhancedMetadata) {
        historyItem.enhancedMetadata.performanceMetrics = {
          ...historyItem.enhancedMetadata.performanceMetrics,
          resultQuality: this.calculateResultQuality(resultCount),
          lastUpdated: Date.now()
        };
      }
      
      // 重新渲染以更新显示
      this.renderHistory();
    }
  }

  /**
   * 获取搜索建议 - 保持原有功能
   */
  getSearchSuggestions(query) {
    if (!query || typeof query !== 'string') return [];
    
    const queryLower = query.toLowerCase();
    return this.searchHistory
      .filter(item => item.keyword.toLowerCase().includes(queryLower))
      .slice(0, 5); // 最多返回5个建议
  }

  /**
   * 获取历史统计 - 增强新架构信息
   */
  getHistoryStats() {
    const architectureStats = this.getArchitectureStats();
    
    return {
      totalItems: this.searchHistory.length,
      recentItems: this.searchHistory.slice(0, 10).length,
      oldestTimestamp: this.searchHistory.length > 0 ? 
        Math.min(...this.searchHistory.map(item => item.timestamp)) : null,
      newestTimestamp: this.searchHistory.length > 0 ? 
        Math.max(...this.searchHistory.map(item => item.timestamp)) : null,
      // 🆕 新架构统计信息
      architecture: {
        version: this.version,
        metadata: this.historyMetadata,
        stats: architectureStats
      }
    };
  }

  /**
   * 🆕 获取架构统计信息
   */
  getArchitectureStats() {
    const v2Items = this.searchHistory.filter(item => 
      item.dataStructureVersion === '2.0'
    ).length;
    
    const withEnhancedData = this.searchHistory.filter(item => 
      item.enhancedMetadata && Object.keys(item.enhancedMetadata).length > 0
    ).length;
    
    const qualityDistribution = this.searchHistory.reduce((acc, item) => {
      const quality = item.enhancedMetadata?.performanceMetrics?.resultQuality || 'unknown';
      acc[quality] = (acc[quality] || 0) + 1;
      return acc;
    }, {});
    
    return {
      v2Items,
      withEnhancedData,
      qualityDistribution,
      averageResultCount: this.searchHistory.length > 0 ? 
        this.searchHistory
          .filter(item => item.resultCount !== undefined)
          .reduce((sum, item) => sum + item.resultCount, 0) / 
        this.searchHistory.filter(item => item.resultCount !== undefined).length : 0
    };
  }

  /**
   * 导出搜索历史 - 增强新架构信息
   */
  exportHistory() {
    const exportData = {
      searchHistory: this.searchHistory,
      stats: this.getHistoryStats(),
      exportTime: new Date().toISOString(),
      // 🆕 新架构导出信息
      version: this.version,
      architecture: this.historyMetadata.architecture,
      metadata: this.historyMetadata,
      features: this.architectureFeatures
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search-history-v${this.version}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`搜索历史导出成功 (新架构 v${this.version})`, 'success');
  }

  /**
   * 获取当前历史列表 - 保持原有功能
   */
  getHistory() {
    return [...this.searchHistory];
  }

  /**
   * 检查关键词是否在历史中 - 保持原有功能
   */
  isInHistory(keyword) {
    return this.searchHistory.some(item => item.keyword === keyword);
  }

  /**
   * 获取最近搜索的关键词 - 保持原有功能
   */
  getRecentKeywords(limit = 5) {
    return this.searchHistory
      .slice(0, limit)
      .map(item => item.keyword);
  }

  /**
   * 🆕 获取架构信息
   */
  getArchitectureInfo() {
    return {
      version: this.version,
      features: this.architectureFeatures,
      metadata: this.historyMetadata
    };
  }

  /**
   * 🆕 检查服务健康状态
   */
  async checkServiceHealth() {
    try {
      const startTime = performance.now();
      
      // 检查历史服务健康状态
      const historyHealth = await this.loadSearchHistory();
      
      const responseTime = performance.now() - startTime;
      
      return {
        healthy: true,
        responseTime,
        lastCheck: Date.now(),
        version: this.version,
        architecture: this.historyMetadata.architecture,
        syncEnabled: this.historyMetadata.syncEnabled,
        itemCount: this.searchHistory.length
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        lastCheck: Date.now(),
        version: this.version,
        architecture: this.historyMetadata.architecture
      };
    }
  }

  /**
   * 清理资源 - 增强新架构支持
   */
  cleanup() {
    this.searchHistory = [];
    
    // 🆕 重置架构元数据
    this.historyMetadata = {
      architecture: 'modular_parsers',
      dataStructureVersion: '2.0',
      lastSync: 0,
      syncEnabled: true
    };
    
    console.log(`搜索历史管理器资源已清理 (新架构 v${this.version})`);
  }
}

export default SearchHistoryManager;