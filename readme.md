# 磁力快搜 - codeseek

<div align="center">

![Logo](frontend/images/logo.png)

**一个现代化的磁力搜索聚合平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)](https://github.com/yourusername/magnet-search)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange.svg)](https://www.cloudflare.com/)

</div>

<<<<<<< HEAD
## 🔗 快速访问

<div align="center">

| 资源类型 | 链接 | 备注 |
|---------|------|------|
| 📖 项目文档 | [完整介绍](https://zread.ai/Zoroaaa/codeseek) | 详细的项目说明和使用指南 |
| 🚀 在线演示 | [https://codeseek.pp.ua](https://codeseek.pp.ua) | 体验完整功能 |
| 🔑 演示密码 | `zoro666` | 代理网页访问密码 |
| 📧 技术支持 | [zoroasx@gmail.com](mailto:zoroasx@gmail.com) | 使用问题反馈 |

</div>

> **提示**: 演示站点仅供测试体验，请勿存储重要数据。生产环境建议自行部署。
=======


## ✨ 项目特色

- 🚀 **无框架架构**: 基于原生ES6模块化开发，无第三方框架依赖，极致轻量
- 🌐 **多源聚合搜索**: 同时整合多个主流磁力搜索站点结果
- 🔧 **高度可定制**: 支持添加、编辑、分类管理自定义搜索源
- ☁️ **Cloudflare生态**: 基于Cloudflare Workers和D1构建的无服务器架构
- 📱 **完美响应式**: 从移动设备到大屏显示器的无缝体验
- 🎨 **主题系统**: 内置亮色/暗色/自动三种主题模式
- 📋 **统一搜索管理**: 集中管理搜索流程、结果处理和缓存策略
- 🔐 **安全认证**: 基于JWT的安全用户认证系统
- 📧 **邮箱验证**: 增强账户安全的邮箱验证机制
- 🔌 **智能代理功能**: 内置完整代理服务，突破网络限制，提升访问体验
- 💾 **多层级缓存**: 智能缓存策略大幅提升搜索速度和用户体验
- 📊 **数据分析**: 内置搜索源状态监控和性能分析
- 👥 **社区功能**: 支持标签管理和搜索源分享

## 🏗️ 技术架构

### 前端技术栈
- **核心**: 原生JavaScript ES6+ 模块化
- **样式**: CSS3 + 响应式设计
- **存储**: LocalStorage + IndexedDB
- **部署**: Cloudflare Pages
- **版本**: v2.3.1

### 后端技术栈
- **运行时**: Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT Token
- **API**: RESTful 风格
- **版本**: v2.1.0

### 代理服务
- **架构**: Cloudflare Workers边缘计算
- **功能**: URL重写、资源优化、请求转发
- **版本**: v3.1.0

### 项目结构
```
磁力快搜/
├── 📁 codeseek-backend/         # 后端代码 (Cloudflare Workers)
│   ├── 📁 sqllite d1/          # 数据库模块化结构
│   │   ├── 01_user_management.sql    # 用户管理相关表结构
│   │   ├── 02_search_engine.sql      # 搜索引擎相关表结构
│   │   ├── 03_community.sql          # 社区功能相关表结构
│   │   ├── 04_search_source.sql      # 搜索源管理相关表结构
│   │   ├── 05_email_security.sql     # 邮箱安全相关表结构
│   │   ├── 06_system_analytics.sql   # 系统分析相关表结构
│   │   └── 07_initialization_data.sql # 初始化数据
│   ├── 📁 src/                 # 源代码目录
│   │   ├── constants.js        # 系统常量定义
│   │   ├── handlers/           # 请求处理函数
│   │   ├── index.js            # 应用入口
│   │   ├── middleware.js       # 中间件
│   │   ├── router.js           # 路由配置
│   │   ├── services/           # 业务服务层
│   │   └── utils.js            # 工具函数
│   ├── 📄 package.json         # 项目依赖配置
│   ├── 📄 wrangler.toml        # Wrangler配置文件
│   └── 📄 wranger部署.txt      # 部署说明
├── 📁 codeseek-site/           # 代理服务配置
│   ├── 📁 src/                 # 代理服务代码
│   │   ├── cache.js            # 缓存管理
│   │   ├── config.js           # 代理配置
│   │   ├── injector.js         # 资源注入器
│   │   ├── proxy.js            # 代理核心逻辑
│   │   ├── templates.js        # 模板处理
│   │   ├── utils.js            # 工具函数
│   │   └── worker.js           # Worker入口
│   ├── 📄 wrangler.toml        # Wrangler配置文件
│   └── 📄 wranger部署.txt      # 部署说明
├── 📁 frontend/                # 前端代码
│   ├── 📁 css/                 # 样式文件
│   │   ├── components/         # 组件样式
│   │   ├── core/               # 核心样式
│   │   ├── pages/              # 页面样式
│   │   └── utils/              # 样式工具
│   ├── 📁 images/              # 静态资源
│   │   ├── favicon.ico         # 网站图标
│   │   └── logo.png            # 网站Logo
│   ├── 📁 src/                 # ES6源码目录
│   │   ├── components/         # UI组件
│   │   ├── core/               # 核心功能
│   │   ├── pages/              # 页面模块
│   │   ├── services/           # 服务层
│   │   └── utils/              # 工具函数
│   ├── 📄 dashboard.html       # 用户仪表板
│   └── 📄 index.html           # 主搜索页面
├── 📄 backend-frontend-tree.md # 目录结构详细说明
├── 📄 readme.md                # 项目文档
└── 📄 本地项目推送到GitHub.txt # GitHub部署指南
```

## 🚀 快速开始

### 环境要求
- Node.js 18+ (开发环境)
- Cloudflare 账户
- Git
- Wrangler CLI 2.0+

### 本地开发

#### 前端开发
```bash
# 克隆项目
git clone https://github.com/yourusername/magnet-search.git
cd magnet-search

# 启动本地服务器
npx http-server frontend -p 3000

# 或使用Live Server扩展（推荐）
```

#### 后端开发
```bash
# 进入后端目录
cd codeseek-backend

# 安装依赖
npm install

# 登录Cloudflare（首次运行）
wrangler login

# 创建D1数据库
wrangler d1 create codeseek

# 初始化数据库结构
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

# 本地开发服务器
wrangler dev
```

#### 代理服务开发
```bash
# 进入代理服务目录
cd codeseek-site

# 本地开发服务器
wrangler dev
```

### 部署到Cloudflare

#### 前端部署 (Cloudflare Pages)
1. 连接GitHub仓库到Cloudflare Pages
2. 构建设置：
   - 框架预设：`None`
   - 构建命令：`echo "Static site"`
   - 构建输出目录：`frontend`
3. 环境变量配置（可选）：
   - `CF_API_BASE_URL`：后端API地址
   - `CF_PROD_API_URL`：生产环境API地址
   - `CF_PROXY_BASE_URL`：代理服务地址

#### 后端部署 (Cloudflare Workers)
```bash
# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler auth login

# 创建D1数据库
wrangler d1 create codeseek

# 初始化数据库结构
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

# 部署Worker
cd codeseek-backend
wrangler deploy
```

#### 代理服务部署
```bash
# 部署代理Worker
cd codeseek-site
wrangler deploy
```

#### 环境变量配置
在Cloudflare Workers中设置以下环境变量：
```
JWT_SECRET=your-super-secret-key
APP_VERSION=2.1.0
FRONTEND_VERSION=2.3.1
PROXY_VERSION=3.1.0
ENABLE_ACTION_LOGGING=true
MAX_FAVORITES_PER_USER=1000
MAX_HISTORY_PER_USER=1000
MAX_TAGS_PER_USER=50
MAX_SHARES_PER_USER=50
EMAIL_VERIFICATION_ENABLED=true
EMAIL_VERIFICATION_REQUIRED=false
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=磁力快搜
SITE_URL=https://yourdomain.com
PROXY_SITE_URL=https://your-proxy-domain.com
```

#### 数据库初始化
```bash
# 运行数据库迁移（按顺序执行模块化SQL文件）
cd codeseek-backend
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/04_search_source.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
```

## 🎯 核心功能

### 1. 智能搜索系统
- **多源聚合**: 同时从多个主流磁力搜索站点获取结果
- **统一结果格式**: 将不同站点的结果规范化为统一格式
- **智能缓存**: 内置多层级缓存机制，大幅提升搜索速度
- **搜索建议**: 基于历史搜索记录和热门关键词的智能提示
- **源管理**: 用户可自由启用、禁用和优先排序搜索源
- **统一搜索管理**: 集中管理搜索流程、结果处理和性能优化
- **源状态检查**: 实时监控搜索源的可用性和响应速度

### 2. 智能代理功能
- **一键切换**: 简单易用的全局代理开关
- **健康检查**: 自动检测代理服务器状态和响应时间
- **域名支持**: 支持多个搜索源域名的代理访问
- **资源类型智能缓存**: 基于资源类型的TTL缓存策略
  - HTML (5分钟)、CSS/JS (1小时)、图片 (24小时)、字体 (7天)
- **请求队列**: 智能请求队列管理，优化并发请求
- **性能监控**: 实时监控代理性能指标和缓存命中率
- **URL重写**: 智能重写网页中的所有URL引用
- **资源优化**: 自动处理相对路径、绝对路径和协议相对URL
- **响应式图片支持**: 智能处理srcset属性

### 3. 自定义搜索源
- **源配置**: 支持添加和编辑自定义搜索站点
- **分类管理**: 多级分类系统，支持主要分类和子分类
- **模板系统**: 灵活的URL模板和结果解析配置
- **批量操作**: 批量启用、禁用和删除搜索源
- **源导入导出**: 支持搜索源配置的导入和导出
- **源状态监控**: 实时监控每个搜索源的可用性

### 4. 用户系统
- **安全认证**: 基于JWT的安全用户认证系统
- **个人设置**: 丰富的个性化配置选项
- **数据同步**: 跨设备的用户数据同步
- **隐私保护**: 本地优先的数据存储策略
- **邮箱验证**: 增强账户安全的邮箱验证机制
- **收藏管理**: 管理用户收藏的磁力链接
- **历史记录**: 记录和管理用户的搜索历史

### 5. 社区功能
- **标签管理**: 创建和分享搜索标签
- **源分享**: 社区贡献和分享优质搜索源
- **用户互动**: 支持社区内的用户交流和反馈
- **数据统计**: 收集和展示社区使用数据和热门内容

## 🔧 配置说明

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

## 📊 性能优化

### 前端优化策略
- **ES6模块化**: 原生模块化加载，无需打包工具
- **智能缓存**: 多层级缓存机制，包含API响应缓存和资源缓存
- **按需加载**: 组件和服务按需加载，减少初始加载时间
- **响应式设计**: 针对不同设备优化的资源和布局
- **本地存储**: 充分利用LocalStorage和IndexedDB减少API调用
- **延迟执行**: 非关键任务延迟执行，提升首屏加载速度

### 代理服务优化
- **资源类型缓存**: 基于资源类型的智能缓存策略
- **LRU缓存淘汰**: 高效的缓存淘汰算法
- **请求队列**: 智能请求队列和并发控制
- **URL重写优化**: 高效的URL重写算法，减少不必要的处理
- **代理健康检查**: 自动检测和规避不健康的代理节点

### 后端优化
- **边缘计算**: 利用Cloudflare全球边缘节点，就近处理请求
- **数据库优化**: 索引优化、查询优化和连接池管理
- **KV缓存**: 使用Cloudflare KV存储缓存频繁访问的数据
- **并发控制**: 优化的并发请求处理策略
- **错误重试**: 智能错误重试机制，提高系统稳定性
- **请求路由**: 基于地理位置的智能请求路由

## 🔒 安全特性

### 前端安全
- **XSS防护**: 输入输出严格过滤，使用内容安全策略(CSP)
- **CSRF保护**: Token验证机制和同源策略严格执行
- **内容安全**: 资源白名单机制，防止恶意资源加载
- **安全沙箱**: 重要操作在安全沙箱中执行
- **CORS配置**: 严格的跨域资源共享策略

### 后端安全
- **SQL注入防护**: 参数化查询和输入验证
- **访问控制**: 基于角色的权限管理系统
- **数据加密**: 敏感数据(如用户凭证)加密存储
- **速率限制**: 防暴力破解的请求速率限制
- **认证安全**: JWT令牌定期轮换和权限范围控制
- **异常处理**: 安全的错误信息返回策略

### 代理安全
- **请求过滤**: 基于URL和内容的请求过滤
- **白名单机制**: 只代理已验证的安全域名
- **HTTPS强制**: 所有代理连接强制使用HTTPS
- **资源隔离**: 代理资源与主应用资源完全隔离
- **隐私保护**: 代理请求中移除可能泄露用户信息的请求头

## 🧪 测试方法

项目采用多维度的测试策略，确保代码质量和系统稳定性：

### 前端测试
- **单元测试**: 组件和服务的独立功能测试
- **集成测试**: 验证模块间交互是否正常
- **端到端测试**: 模拟用户真实操作流程的完整测试
- **性能测试**: 页面加载和交互响应性能检测
- **响应式测试**: 不同设备和屏幕尺寸的兼容性测试
- **调试工具**: 浏览器开发者工具调试和控制台日志分析

### 后端测试
- **API测试**: 使用Postman或CURL测试所有API端点
- **功能测试**: 验证业务逻辑和数据处理正确性
- **负载测试**: 评估系统在高并发下的表现
- **安全测试**: 检测潜在的安全漏洞和攻击面
- **日志分析**: Cloudflare Dashboard中的请求日志和错误跟踪
- **数据完整性测试**: 确保数据库操作的数据一致性

### 代理服务测试
- **连通性测试**: 验证代理服务对不同域名的访问能力
- **性能测试**: 测量代理延迟和吞吐量
- **稳定性测试**: 长时间运行的稳定性监控
- **兼容性测试**: 验证不同类型资源的代理支持
- **缓存效率测试**: 评估缓存策略的有效性和命中率

### 开发测试工具
```javascript
// 前端调试模式启用方法
// 在URL中添加debug参数：?debug=true
// 或在控制台执行：
window.DEBUG_MODE = true;

// 代理调试方法
// 查看代理服务状态
const proxyStatus = await ProxyService.getStatus();

// 查看缓存统计
const cacheStats = await ProxyService.getCacheStats();

// 后端API测试示例
// 健康检查
fetch('/api/health')
  .then(res => res.json())
  .then(data => console.log('API Health:', data));
```

## 📝 API文档

项目提供了完整的RESTful API，支持前端应用和第三方集成：

### 认证接口
- `POST /api/auth/register` - 用户注册
  - **参数**: `username`, `email`, `password`
  - **返回**: 用户信息和JWT令牌

- `POST /api/auth/login` - 用户登录
  - **参数**: `email`, `password`
  - **返回**: 用户信息和JWT令牌

- `POST /api/auth/verify-token` - Token验证
  - **参数**: `token`
  - **返回**: 验证结果和用户信息

- `POST /api/auth/logout` - 用户登出
  - **参数**: 无
  - **返回**: 操作结果

- `POST /api/auth/change-password` - 更改密码
  - **参数**: `currentPassword`, `newPassword`
  - **返回**: 操作结果

- `DELETE /api/auth/delete-account` - 删除账户
  - **参数**: `password`
  - **返回**: 操作结果

- `POST /api/auth/verify-email` - 发送邮箱验证邮件
  - **参数**: 无
  - **返回**: 操作结果

- `GET /api/auth/verify-email/:token` - 验证邮箱
  - **参数**: URL参数 `token`
  - **返回**: 验证结果和重定向

### 用户数据接口
- `GET /api/user/settings` - 获取用户设置
  - **参数**: 无
  - **返回**: 用户设置对象

- `PUT /api/user/settings` - 更新用户设置
  - **参数**: 部分或全部用户设置
  - **返回**: 更新后的设置

- `GET /api/user/favorites` - 获取收藏列表
  - **参数**: `page`, `limit`
  - **返回**: 收藏列表和分页信息

- `POST /api/user/favorites` - 同步收藏数据
  - **参数**: `favorites` (收藏数据数组)
  - **返回**: 同步结果

- `GET /api/user/search-history` - 获取搜索历史
  - **参数**: `page`, `limit`, `startDate`, `endDate`
  - **返回**: 搜索历史记录

- `POST /api/user/search-history` - 保存搜索记录
  - **参数**: `query`, `source`, `timestamp`
  - **返回**: 保存结果

- `DELETE /api/user/search-history/:id` - 删除历史记录
  - **参数**: URL参数 `id`
  - **返回**: 删除结果

### 搜索源管理接口
- `GET /api/search-sources/major-categories` - 获取主要分类
  - **参数**: 无
  - **返回**: 主要分类列表

- `GET /api/search-sources/categories` - 获取所有分类
  - **参数**: `majorCategoryId` (可选)
  - **返回**: 分类列表

- `GET /api/search-sources/sources` - 获取所有搜索源
  - **参数**: `categoryId`, `enabled` (可选)
  - **返回**: 搜索源列表

- `GET /api/search-sources/user-configs` - 获取用户搜索源配置
  - **参数**: 无
  - **返回**: 用户配置的搜索源设置

- `GET /api/search-sources/stats` - 获取搜索源统计
  - **参数**: `startDate`, `endDate` (可选)
  - **返回**: 搜索源使用统计数据

- `GET /api/search-sources/export` - 导出搜索源配置
  - **参数**: 无
  - **返回**: JSON格式的配置文件

### 社区接口
- `GET /api/community/tags` - 获取标签列表
  - **参数**: `search`, `page`, `limit` (可选)
  - **返回**: 标签列表

- `POST /api/community/tags` - 创建标签
  - **参数**: `name`, `description`, `color`
  - **返回**: 创建的标签信息

- `GET /api/community/sources` - 获取社区搜索源
  - **参数**: `search`, `categoryId`, `page`, `limit` (可选)
  - **返回**: 社区贡献的搜索源列表

- `POST /api/community/sources` - 提交搜索源
  - **参数**: 搜索源配置信息
  - **返回**: 提交结果

- `GET /api/community/sources/:id` - 获取源详情
  - **参数**: URL参数 `id`
  - **返回**: 搜索源详细信息

### 系统接口
- `GET /api/health` - 健康检查
  - **参数**: 无
  - **返回**: 系统健康状态

- `GET /api/sources/status` - 搜索源状态
  - **参数**: 无
  - **返回**: 所有搜索源的实时状态

- `GET /api/config` - 获取系统配置
  - **参数**: 无
  - **返回**: 系统配置信息

### API调用示例
```javascript
// 使用Fetch API调用登录接口
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      // 保存token
      localStorage.setItem('authToken', data.token);
      return data.user;
    } else {
      throw new Error(data.message || '登录失败');
    }
  } catch (error) {
    console.error('登录错误:', error);
    throw error;
  }
}

// 带认证的API调用
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, { ...options, headers });
}
```

## 🤝 贡献指南

我们非常欢迎社区贡献！无论是修复bug、添加新功能还是改进文档，都能帮助项目变得更好。

### 贡献流程

1. **Fork 项目**
   - 在GitHub上点击"Fork"按钮创建你自己的项目副本

2. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/magnet-search.git
   cd magnet-search
   ```

3. **创建功能分支**
   ```bash
   git checkout -b feature/YourFeatureName
   ```
   或修复分支
   ```bash
   git checkout -b fix/YourBugfixName
   ```

4. **安装依赖**
   ```bash
   # 前端依赖
   cd frontend
   npm install
   
   # 后端依赖 (Cloudflare Workers)
   cd ../codeseek-backend
   npm install
   ```

5. **开发和测试**
   - 实现你的功能或修复
   - 确保代码通过所有测试
   - 编写新的测试用例（如有必要）

6. **提交更改**
   ```bash
   git add .
   git commit -m "Add: 简明扼要的提交信息"
   ```
   请遵循[语义化提交信息](https://www.conventionalcommits.org/zh-hans/v1.0.0/)规范

7. **推送到分支**
   ```bash
   git push origin feature/YourFeatureName
   ```

8. **打开 Pull Request**
   - 在GitHub上导航到原始仓库
   - 点击"Pull Request"按钮
   - 填写详细的描述说明你的更改

### 代码规范

- **JavaScript/ES6+**：使用现代JavaScript语法和特性
- **代码风格**：遵循项目中的ESLint配置和代码风格
- **命名规范**：使用清晰、描述性的变量和函数名
- **注释**：为复杂逻辑添加适当的注释
- **测试**：确保单元测试覆盖率达到80%以上
- **文档**：更新相关文档以反映你的更改

### 提交信息规范

我们使用语义化提交信息格式，结构如下：
```
<类型>: <描述>

[可选的正文]

[可选的页脚]
```

常用类型：
- `Add`: 添加新功能
- `Fix`: 修复bug
- `Update`: 更新现有功能
- `Refactor`: 代码重构，不改变功能
- `Docs`: 文档更改
- `Style`: 格式调整，不影响代码功能
- `Test`: 添加或修改测试
- `Chore`: 构建过程或辅助工具变动

### 报告问题

如果你发现了bug或有功能建议，请在GitHub上创建Issue，并尽可能提供详细信息：
- 问题的详细描述
- 复现步骤
- 预期行为和实际行为
- 环境信息（浏览器、操作系统等）
- 相关截图（如有）

### 开发资源

- **文档**: 项目根目录下的README.md和docs文件夹
- **API参考**: 项目中的API文档部分
- **社区**: GitHub Discussions和Issues

## 📄 更新日志

### 最新版本

#### 前端 v2.3.1
- **架构重构**
  - ✨ 新增统一搜索管理器架构，优化搜索流程
  - 🔧 重构搜索组件架构，提高可维护性
  - 🚀 移除详情提取服务，简化系统架构
- **新功能**
  - 🔌 新增完整的智能代理功能
    - 一键切换全局代理
    - 资源类型智能缓存策略
    - URL重写和资源优化
    - 响应式图片支持
  - 📊 新增代理性能监控和缓存统计
- **用户体验**
  - 🎨 改进主题系统和UI体验
  - 📱 增强移动端响应式设计
  - ⚡ 优化页面加载和交互速度
- **修复**
  - 🐛 修复已知性能和显示问题
  - 🔍 修复搜索结果排序问题

#### 后端 v2.1.0
- **架构升级**
  - ✨ 新增模块化数据库结构，提高可扩展性
  - 🔧 重构服务层架构，优化代码组织
  - 🔌 新增代理服务支持，实现搜索源访问优化
- **安全增强**
  - 🔐 增强认证和安全机制
  - 📧 添加邮箱验证服务，提升账户安全性
  - 🚫 实现请求速率限制，防止滥用
- **功能完善**
  - 👥 完善社区功能支持
  - 📊 增强搜索源统计和监控
  - 🔍 优化搜索结果处理逻辑

### 历史版本

#### v1.3.0 (2024-12-19)
- **核心功能**
  - ✨ 新增自定义搜索源和分类管理
  - 🔍 添加详情提取功能
  - 👥 新增用户收藏管理
- **性能优化**
  - 🚀 优化搜索性能和缓存机制
  - ⚡ 提升API响应速度
- **用户体验**
  - 🎨 改进用户界面和交互体验
  - 🔧 重构Dashboard架构，提升可维护性
  - 📊 增强数据统计和可视化功能

#### v1.2.0
- **用户系统**
  - 🔐 完善用户认证和安全机制
  - ☁️ 实现云端数据同步功能
- **跨设备支持**
  - 📱 优化移动端适配
  - 💻 完善桌面端体验
- **其他**
  - 🐛 修复若干已知问题
  - 📝 更新API文档和使用说明

#### v1.1.0
- ✨ 初始版本发布
- 🔍 基础搜索功能实现
- 📱 响应式设计支持
- 🗂️ 基本分类系统
- 🚀 性能优化和bug修复

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。在遵循以下条款的前提下，您可以自由使用、修改和分发本软件：

- 您可以使用本软件用于任何目的，包括商业用途
- 您可以修改本软件的源代码
- 您可以在您的项目中包含本软件
- 您需要保留原始版权声明和许可证文本
- 作者和贡献者不对软件提供任何担保，不承担任何责任

## 🙏 致谢

我们衷心感谢所有为项目做出贡献的个人和组织：

- **技术平台支持**
  - [Cloudflare](https://www.cloudflare.com/) - 提供优秀的边缘计算平台和Worker服务
  - [GitHub](https://github.com/) - 提供代码托管和协作平台

- **开源社区**
  - 所有项目贡献者和提交者
  - 所有提供反馈和建议的用户
  - 所有分享和推广项目的朋友

- **资源支持**
  - 开源软件社区提供的各种工具和库

## 📧 联系与支持

### 官方渠道
- **项目主页**: [codeseek](https://github.com/Zoroaaa/codeseek)
- **问题反馈**: [Issues](https://github.com/Zoroaaa/codeseek/issues)
- **功能建议**: [Discussions](https://github.com/Zoroaaa/codeseek/discussions)

### 贡献交流
- **邮件列表**: zoroasx@gmail.com

---

<div align="center">
  <p>✨ 感谢您使用磁力快搜！ ✨</p>
  <p>⭐ 如果这个项目对你有帮助，请给我们一个Star！ ⭐</p>
  <p>💪 欢迎加入我们的开源社区，一起改进和发展！ 💪</p>
</div>
