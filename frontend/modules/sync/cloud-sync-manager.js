import { apiClient } from '../api/api-client.js';
import { networkUtils } from '../network/network-utils.js';
import { EVENT_NAMES, APP_CONSTANTS } from '../../shared/constants.js';
import { delay } from '../utils/common.js';

/**
 * 云端数据同步管理器
 */
export class CloudSyncManager {
  constructor() {
    this.syncQueue = new Map();
    this.isOnline = navigator.onLine;
    this.pendingOperations = new Set();
    this.lastSyncTime = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;

    // 监听网络状态
    networkUtils.onNetworkChange((isOnline) => {
      this.isOnline = isOnline;
      if (isOnline) {
        this.processPendingSync();
      }
    });

    // 监听认证状态变化
    window.addEventListener(EVENT_NAMES.AUTH_STATE_CHANGED, (event) => {
      const { type } = event.detail;
      if (type === 'logout') {
        this.clearQueue();
      }
    });

    this.isInitialized = true;
  }

  // 添加同步任务
  addSyncTask(operation, data, priority = 'normal') {
    const taskId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.syncQueue.set(taskId, {
      id: taskId,
      operation,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: APP_CONSTANTS.NETWORK.MAX_SYNC_RETRIES
    });

    console.log(`📋 添加同步任务: ${operation} (${taskId})`);
    
    if (this.isOnline) {
      this.processTask(taskId);
    }
    
    return taskId;
  }

  // 处理单个任务
  async processTask(taskId) {
    const task = this.syncQueue.get(taskId);
    if (!task || this.pendingOperations.has(taskId)) return;

    this.pendingOperations.add(taskId);

    try {
      console.log(`🔄 执行同步任务: ${task.operation}`);
      
      let result;
      switch (task.operation) {
        case 'sync_favorites':
          result = await apiClient.syncFavorites(task.data);
          break;
        case 'save_search_history':
          result = await apiClient.saveSearchHistory(task.data.query, task.data.source);
          break;
        case 'sync_search_history':
          result = await apiClient.syncSearchHistory(task.data);
          break;
        case 'update_settings':
          result = await apiClient.updateUserSettings(task.data);
          break;
        case 'record_action':
          result = await apiClient.recordAction(task.data.action, task.data.data);
          break;
        default:
          throw new Error(`未知的同步操作: ${task.operation}`);
      }

      // 任务成功
      this.syncQueue.delete(taskId);
      this.lastSyncTime = Date.now();
      console.log(`✅ 同步任务完成: ${task.operation}`);
      
      // 触发同步完成事件
      this.dispatchSyncEvent('completed', { taskId, operation: task.operation });
      
    } catch (error) {
      console.error(`❌ 同步任务失败: ${task.operation}`, error);
      
      // 重试逻辑
      task.retryCount++;
      if (task.retryCount < task.maxRetries) {
        console.log(`🔄 任务重试 ${task.retryCount}/${task.maxRetries}: ${task.operation}`);
        setTimeout(() => this.processTask(taskId), Math.pow(2, task.retryCount) * 1000);
      } else {
        console.error(`💀 任务最终失败: ${task.operation}`);
        this.syncQueue.delete(taskId);
        this.dispatchSyncEvent('failed', { taskId, operation: task.operation, error: error.message });
      }
    } finally {
      this.pendingOperations.delete(taskId);
    }
  }

  // 处理所有待同步任务
  async processPendingSync() {
    if (!this.isOnline || this.syncQueue.size === 0) return;

    console.log(`🌐 网络恢复，处理 ${this.syncQueue.size} 个待同步任务`);
    
    const taskIds = Array.from(this.syncQueue.keys());
    for (const taskId of taskIds) {
      if (this.syncQueue.has(taskId)) {
        await this.processTask(taskId);
        // 添加小延迟避免请求过于频繁
        await delay(200);
      }
    }
  }

  // 批量同步收藏
  async syncFavorites(favorites) {
    return this.addSyncTask('sync_favorites', favorites, 'high');
  }

  // 同步搜索历史
  async syncSearchHistory(history) {
    return this.addSyncTask('sync_search_history', history, 'normal');
  }

  // 保存单条搜索历史
  async saveSearchHistory(query, source = 'unknown') {
    return this.addSyncTask('save_search_history', { query, source }, 'normal');
  }

  // 更新用户设置
  async updateUserSettings(settings) {
    return this.addSyncTask('update_settings', settings, 'high');
  }

  // 记录用户行为
  async recordAction(action, data) {
    return this.addSyncTask('record_action', { action, data }, 'low');
  }

  // 强制同步所有数据
  async forceSyncAll() {
    if (!this.isOnline) {
      throw new Error('网络不可用，无法同步');
    }

    console.log('🔄 强制同步所有数据');
    
    try {
      // 获取所有本地数据
      const favorites = window.favoritesManager?.getFavorites() || [];
      const searchHistory = window.searchManager?.searchHistory || [];
      
      // 并行同步
      await Promise.all([
        this.syncFavorites(favorites),
        this.syncSearchHistory(searchHistory)
      ]);
      
      console.log('✅ 强制同步完成');
      this.dispatchSyncEvent('force_sync_completed');
      
    } catch (error) {
      console.error('❌ 强制同步失败:', error);
      this.dispatchSyncEvent('force_sync_failed', { error: error.message });
      throw error;
    }
  }

  // 智能同步：根据数据变化自动决定同步策略
  async smartSync(dataType, data, options = {}) {
    const { priority = 'normal', immediate = false } = options;
    
    if (immediate && this.isOnline) {
      // 立即同步
      switch (dataType) {
        case 'favorites':
          return await apiClient.syncFavorites(data);
        case 'search_history':
          return await apiClient.syncSearchHistory(data);
        case 'settings':
          return await apiClient.updateUserSettings(data);
      }
    } else {
      // 添加到队列
      return this.addSyncTask(`sync_${dataType}`, data, priority);
    }
  }

  // 获取同步状态
  getStatus() {
    return {
      isOnline: this.isOnline,
      queueSize: this.syncQueue.size,
      pendingCount: this.pendingOperations.size,
      lastSyncTime: this.lastSyncTime,
      isInitialized: this.isInitialized,
      tasks: Array.from(this.syncQueue.values()).map(task => ({
        operation: task.operation,
        timestamp: task.timestamp,
        retryCount: task.retryCount,
        priority: task.priority
      }))
    };
  }

  // 获取详细的同步统计
  getSyncStats() {
    const tasks = Array.from(this.syncQueue.values());
    const stats = {
      total: tasks.length,
      byOperation: {},
      byPriority: { high: 0, normal: 0, low: 0 },
      retrying: 0,
      oldestTask: null,
      averageAge: 0
    };

    if (tasks.length === 0) return stats;

    const now = Date.now();
    let totalAge = 0;

    tasks.forEach(task => {
      // 按操作类型统计
      stats.byOperation[task.operation] = (stats.byOperation[task.operation] || 0) + 1;
      
      // 按优先级统计
      stats.byPriority[task.priority]++;
      
      // 重试任务统计
      if (task.retryCount > 0) stats.retrying++;
      
      // 任务年龄
      const age = now - task.timestamp;
      totalAge += age;
      
      if (!stats.oldestTask || age > (now - stats.oldestTask.timestamp)) {
        stats.oldestTask = task;
      }
    });

    stats.averageAge = totalAge / tasks.length;
    
    return stats;
  }

  // 清空队列
  clearQueue() {
    this.syncQueue.clear();
    this.pendingOperations.clear();
    console.log('🗑️ 同步队列已清空');
  }

  // 重试失败的任务
  retryFailedTasks() {
    const failedTasks = Array.from(this.syncQueue.values())
      .filter(task => task.retryCount >= task.maxRetries);
    
    failedTasks.forEach(task => {
      task.retryCount = 0;
      this.processTask(task.id);
    });
    
    console.log(`🔄 重试 ${failedTasks.length} 个失败任务`);
  }

  // 暂停同步
  pauseSync() {
    this.isPaused = true;
    console.log('⏸️ 同步已暂停');
  }

  // 恢复同步
  resumeSync() {
    this.isPaused = false;
    console.log('▶️ 同步已恢复');
    if (this.isOnline) {
      this.processPendingSync();
    }
  }

  // 设置同步优先级
  updateTaskPriority(taskId, newPriority) {
    const task = this.syncQueue.get(taskId);
    if (task) {
      task.priority = newPriority;
      console.log(`📝 任务 ${taskId} 优先级已更新为 ${newPriority}`);
    }
  }

  // 取消任务
  cancelTask(taskId) {
    if (this.syncQueue.delete(taskId)) {
      this.pendingOperations.delete(taskId);
      console.log(`❌ 任务 ${taskId} 已取消`);
      return true;
    }
    return false;
  }

  // 触发同步事件
  dispatchSyncEvent(type, detail = {}) {
    const event = new CustomEvent(EVENT_NAMES.DATA_SYNCED, {
      detail: { type, ...detail, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  // 监听同步事件
  onSyncEvent(callback) {
    window.addEventListener(EVENT_NAMES.DATA_SYNCED, callback);
    return () => window.removeEventListener(EVENT_NAMES.DATA_SYNCED, callback);
  }

  // 清理过期任务
  cleanupExpiredTasks(maxAge = 24 * 60 * 60 * 1000) { // 24小时
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [taskId, task] of this.syncQueue.entries()) {
      if (now - task.timestamp > maxAge) {
        this.syncQueue.delete(taskId);
        this.pendingOperations.delete(taskId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期同步任务`);
    }
  }

  // 健康检查
  healthCheck() {
    const status = this.getStatus();
    const stats = this.getSyncStats();
    
    const health = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };

    // 检查队列大小
    if (status.queueSize > 50) {
      health.status = 'warning';
      health.issues.push('同步队列过大');
      health.recommendations.push('考虑清理过期任务或检查网络连接');
    }

    // 检查重试任务
    if (stats.retrying > 10) {
      health.status = 'warning';
      health.issues.push('重试任务过多');
      health.recommendations.push('检查API连接状态');
    }

    // 检查最后同步时间
    if (status.lastSyncTime && Date.now() - status.lastSyncTime > 60 * 60 * 1000) {
      health.status = 'warning';
      health.issues.push('长时间未同步');
      health.recommendations.push('检查网络连接和认证状态');
    }

    return health;
  }
}

// 创建全局实例
export const cloudSyncManager = new CloudSyncManager();