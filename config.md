### 前端配置系统
项目采用了智能的配置管理系统，在`frontend/src/core/config.js`中实现：
```javascript
// 配置管理模块支持多种配置来源：
// 1. 全局变量
// 2. 环境变量
// 3. URL参数
// 4. 默认值

// 核心配置项目
const config = {
  // API基础URL配置
  BASE_URL: this.getConfigValue('CF_API_BASE_URL', null),
  DEV_URL: this.getConfigValue('CF_DEV_API_URL', 'http://localhost:8787'),
  PROD_URL: this.getConfigValue('CF_PROD_API_URL', this.getDefaultProdURL()),
  
  // 应用配置
  APP_NAME: this.getConfigValue('CF_APP_NAME', APP_CONSTANTS.APP_NAME),
  APP_VERSION: this.getConfigValue('CF_APP_VERSION', APP_CONSTANTS.DEFAULT_VERSION),
  
  // 功能开关
  ENABLE_ANALYTICS: this.getBooleanConfig('CF_ENABLE_ANALYTICS', false),
  ENABLE_DEBUG: this.getBooleanConfig('CF_ENABLE_DEBUG', this.isDevelopment()),
  ENABLE_OFFLINE_MODE: this.getBooleanConfig('CF_ENABLE_OFFLINE_MODE', true),
  
  // 性能配置
  API_TIMEOUT: parseInt(this.getConfigValue('CF_API_TIMEOUT', APP_CONSTANTS.API.TIMEOUT)),
  RETRY_ATTEMPTS: parseInt(this.getConfigValue('CF_RETRY_ATTEMPTS', APP_CONSTANTS.API.RETRY_ATTEMPTS)),
  CACHE_DURATION: parseInt(this.getConfigValue('CF_CACHE_DURATION', APP_CONSTANTS.API.CACHE_DURATION))
}

// 配置会自动检测开发环境
// 自动选择最佳API URL
// 支持运行时配置覆盖
```

### 代理服务配置
代理服务由`frontend/src/services/proxy-service.js`和`codeseek-site/src/worker.js`共同实现：
```javascript
// 前端代理服务核心功能:
// 1. 智能代理请求处理
// 2. 多级缓存管理 (按资源类型设置TTL)
// 3. 请求队列和并发控制
// 4. 代理健康检查
// 5. 性能监控和统计

// 代理服务提供的资源类型智能缓存策略:
const ttlMap = {
  HTML: 5 * 60 * 1000,        // 5分钟
  CSS: 60 * 60 * 1000,        // 1小时
  JS: 60 * 60 * 1000,         // 1小时
  IMAGE: 24 * 60 * 60 * 1000, // 24小时
  FONT: 7 * 24 * 60 * 60 * 1000, // 7天
  API: 60 * 1000,             // 1分钟
  OTHER: 30 * 60 * 1000       // 30分钟
};

// 代理后端支持智能URL重写:
// 1. 绝对URL重写
// 2. 相对URL重写
// 3. srcset属性处理 (响应式图片)
// 4. 内联样式URL重写
// 5. Meta标签处理
```

### 后端常量配置
后端系统在`codeseek-backend/src/constants.js`中定义了系统级别的不可变配置：
```javascript
// 系统级别的最大限制（安全相关，不可修改）
MAX_TAGS_PER_USER: 50,
MAX_SHARES_PER_USER: 50,
MAX_FAVORITES_PER_USER: 1000,
MAX_HISTORY_PER_USER: 1000,

// 系统行为枚举（不可变）
ALLOWED_ACTIONS: [
  'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
  'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
  'sync_data', 'page_view', 'session_start', 'session_end',
  'custom_source_add', 'custom_source_edit', 'custom_source_delete',
  'tag_created', 'tag_updated', 'tag_deleted',
  // 搜索源管理相关行为
  'major_category_create', 'major_category_update', 'major_category_delete',
  'source_category_create', 'source_category_update', 'source_category_delete',
  'search_source_create', 'search_source_update', 'search_source_delete',
  'user_source_config_update', 'search_sources_export'
]
```
