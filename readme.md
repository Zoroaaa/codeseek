# 磁力快搜 - 专业版

<div align="center">

![Logo](frontend/images/logo.png)

**一个现代化的磁力搜索聚合平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)](https://github.com/yourusername/magnet-search)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange.svg)](https://www.cloudflare.com/)

</div>

## ✨ 项目特色

- 🚀 **现代化架构**: 基于ES6模块化开发，无框架依赖
- 🌐 **多搜索源聚合**: 支持主流磁力搜索站点
- 🔧 **高度可定制**: 自定义搜索源和分类管理
- ☁️ **云端同步**: 基于Cloudflare生态的数据同步
- 📱 **响应式设计**: 完美适配桌面和移动设备
- 🎨 **主题切换**: 支持亮色/暗色/自动主题
- 🔍 **详情提取**: 智能自动提取磁力链接详细信息
- 📋 **统一搜索管理**: 集中管理搜索流程和组件
- 🔐 **安全认证**: JWT基础的用户认证系统
- 📧 **邮箱验证**: 增强账户安全性的邮箱验证机制

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

### 项目结构
```
磁力快搜/
├── 📁 codeseek-backend/         # 后端代码 (Cloudflare Workers)
│   ├── 📁 .github/workflows/   # CI/CD工作流
│   ├── 📁 .wrangler/           # Wrangler本地配置
│   ├── 📁 src/                 # 源代码目录
│   │   ├── 📁 config/          # 配置文件
│   │   │   └── 📄 parser-rules.js   # 解析规则配置
│   │   ├── 📄 constants.js     # 常量定义
│   │   ├── 📁 handlers/        # API处理器
│   │   │   ├── 📄 auth.js              # 认证处理
│   │   │   ├── 📄 community.js          # 社区处理
│   │   │   ├── 📄 detail.js             # 详情提取处理
│   │   │   ├── 📄 detail-helpers.js     # 详情提取辅助函数
│   │   │   ├── 📄 search-sources.js     # 搜索源管理
│   │   │   ├── 📄 system.js             # 系统处理
│   │   │   └── 📄 user.js               # 用户管理
│   │   ├── 📄 index.js         # 主入口文件
│   │   ├── 📄 middleware.js    # 中间件
│   │   ├── 📄 router.js        # 路由管理
│   │   ├── 📁 services/        # 服务层
│   │   │   ├── 📄 cache-manager.js        # 缓存管理
│   │   │   ├── 📄 detail-config-service.js    # 详情配置服务
│   │   │   ├── 📄 detail-content-parser.js    # 详情内容解析器
│   │   │   ├── 📄 detail-extractor.js         # 详情提取器
│   │   │   ├── 📄 email-verification.js       # 邮箱验证服务
│   │   │   ├── 📄 extraction-validator.js     # 提取验证器
│   │   │   ├── 📄 search-link-extractor.js    # 搜索链接提取器
│   │   │   ├── 📄 search-sources-service.js   # 搜索源服务
│   │   │   └── 📄 services.js                # 服务统一入口
│   │   ├── 📄 utils.js         # 工具函数
│   │   └── 📁 utils/           # 工具目录
│   │       └── 📄 html-parser.js   # HTML解析工具
│   ├── 📁 sqllite d1/          # 数据库模块化结构
│   │   ├── 📄 00_main_schema.sql           # 主数据库架构
│   │   ├── 📄 01_user_management.sql       # 用户管理模块
│   │   ├── 📄 02_search_engine.sql         # 搜索引擎模块
│   │   ├── 📄 03_community.sql             # 社区功能模块
│   │   ├── 📄 04_detail_extraction.sql     # 详情提取模块
│   │   ├── 📄 05_email_security.sql        # 邮箱安全模块
│   │   ├── 📄 06_system_analytics.sql      # 系统分析模块
│   │   ├── 📄 07_initialization_data.sql   # 初始数据
│   │   └── 📄 08_search_source.sql         # 搜索源数据
│   └── 📄 wrangler.toml        # Wrangler配置文件
├── 📁 frontend/                # 前端代码
│   ├── 📁 css/                 # 样式文件
│   │   ├── 📁 components/      # 组件样式
│   │   │   ├── 📄 detail-card.css         # 详情卡片样式
│   │   │   ├── 📄 email-verification.css  # 邮箱验证组件样式
│   │   │   ├── 📄 favorites.css           # 收藏样式
│   │   │   ├── 📄 search-status.css       # 搜索状态样式
│   │   │   └── 📄 search.css              # 搜索样式
│   │   ├── 📁 core/            # 核心样式
│   │   │   ├── 📄 base.css                # 基础样式
│   │   │   └── 📄 theme.css               # 主题样式
│   │   ├── 📁 pages/           # 页面样式
│   │   │   ├── 📁 dashboard/              # 仪表板样式
│   │   │   │   ├── 📄 categories-management.css  # 分类管理样式
│   │   │   │   ├── 📄 community.css             # 社区样式
│   │   │   │   ├── 📄 dashboard.css             # 仪表板主样式
│   │   │   │   └── 📄 sources-management.css    # 源管理样式
│   │   │   └── 📄 main.css                # 主页面样式
│   │   └── 📁 utils/           # 工具样式
│   │       ├── 📄 accessibility.css       # 无障碍样式
│   │       ├── 📄 animations.css          # 动画效果
│   │       ├── 📄 responsive.css          # 响应式样式
│   │       └── 📄 variables.css           # 变量定义
│   ├── 📁 images/              # 静态资源
│   ├── 📁 src/                 # ES6源码目录
│   │   ├── 📁 components/      # UI组件
│   │   │   ├── 📄 detail-card.js          # 详情卡片组件
│   │   │   ├── 📄 email-verification-ui.js  # 邮箱验证UI组件
│   │   │   ├── 📄 favorites.js            # 收藏组件
│   │   │   ├── 📄 search.js               # 搜索组件
│   │   │   └── 📁 search/                 # 搜索相关组件
│   │   │       ├── 📄 DetailExtractionManager.js  # 详情提取管理器
│   │   │       ├── 📄 SearchEngineSelector.js    # 搜索引擎选择器
│   │   │       ├── 📄 SearchFilters.js          # 搜索过滤器
│   │   │       ├── 📄 SearchResultsManager.js   # 搜索结果管理器
│   │   │       └── 📄 SearchStatusManager.js    # 搜索状态管理器
│   │   ├── 📁 core/            # 核心配置
│   │   │   ├── 📄 config.js               # 核心配置文件
│   │   │   ├── 📄 constants.js            # 常量定义
│   │   │   └── 📄 detail-config.js        # 详情提取配置文件
│   │   ├── 📁 pages/           # 页面应用
│   │   │   ├── 📁 dashboard/              # 仪表板页面
│   │   │   │   ├── 📄 categories-manager.js       # 分类管理器
│   │   │   │   ├── 📄 community.js                # 社区页面
│   │   │   │   ├── 📄 dashboard.js                # 仪表板主页面
│   │   │   │   ├── 📄 favorites-manager.js        # 收藏管理器
│   │   │   │   ├── 📄 search-history.js           # 搜索历史
│   │   │   │   ├── 📄 search-stats.js             # 搜索统计
│   │   │   │   ├── 📄 settings.js                 # 设置页面
│   │   │   │   ├── 📄 sources-manager.js          # 源管理器
│   │   │   │   ├── 📄 system-status.js            # 系统状态
│   │   │   │   ├── 📄 user-profile.js             # 用户资料
│   │   │   │   └── 📄 verification.js             # 验证页面
│   │   │   └── 📁 main/                   # 主页面
│   │   │       └── 📄 main.js              # 主搜索页面
│   │   ├── 📁 services/        # 服务层
│   │   │   ├── 📄 api.js                  # API服务
│   │   │   ├── 📄 auth.js                 # 认证服务
│   │   │   ├── 📄 community-sources-api.js    # 社区搜索源API
│   │   │   ├── 📄 community-tags-api.js       # 社区标签API
│   │   │   ├── 📄 detail-api.js            # 详情API
│   │   │   ├── 📄 detail-config-api.js     # 详情配置API
│   │   │   ├── 📄 email-verification-service.js  # 邮箱验证服务
│   │   │   ├── 📄 enhanced-source-checker.js    # 增强源检查器
│   │   │   ├── 📄 search.js               # 搜索服务
│   │   │   └── 📄 theme.js                # 主题服务
│   │   └── 📁 utils/           # 工具函数
│   ├── 📄 index.html           # 主搜索页面
│   └── 📄 dashboard.html       # 用户仪表板
└── 📄 readme.md                # 项目文档
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
wrangler d1 execute codeseek --file=./sqllite\ d1/00_main_schema.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/04_detail_extraction.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

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

#### 后端部署 (Cloudflare Workers)
```bash
# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler auth login

# 创建D1数据库
wrangler d1 create codeseek

# 初始化数据库结构
wrangler d1 execute codeseek --file=./sqllite\ d1/00_main_schema.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/04_detail_extraction.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

# 部署Worker
cd codeseek-backend
wrangler deploy
```

#### 环境变量配置
在Cloudflare Workers中设置以下环境变量：
```
JWT_SECRET=your-super-secret-key
APP_VERSION=2.1.0
FRONTEND_VERSION=2.3.1
ENABLE_ACTION_LOGGING=true
MAX_FAVORITES_PER_USER=1000
MAX_HISTORY_PER_USER=1000
EMAIL_VERIFICATION_ENABLED=true
EMAIL_VERIFICATION_REQUIRED=false
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=磁力快搜
SITE_URL=https://yourdomain.com
```

#### 数据库初始化
```bash
# 运行数据库迁移（按顺序执行模块化SQL文件）
cd codeseek-backend
wrangler d1 execute codeseek --file=./sqllite\ d1/00_main_schema.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/04_detail_extraction.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql
```

## 🎯 核心功能

### 1. 智能搜索系统
- **多源聚合**: 同时搜索主流磁力站点
- **结果缓存**: 智能缓存提升搜索速度
- **搜索建议**: 基于历史的智能提示
- **源管理**: 可自由启用/禁用搜索源
- **统一搜索管理**: 集中管理搜索流程和组件

### 2. 详情提取服务
- **自动提取**: 智能提取磁力链接详细信息
- **多源适配**: 支持7个搜索源的详情提取
- **缓存优化**: 高效的详情缓存机制
- **配置管理**: 灵活的详情提取配置系统
- **批量处理**: 支持批量提取多个结果的详情

### 3. 自定义搜索源
- **源配置**: 支持添加自定义搜索站点
- **分类管理**: 自定义搜索源分类
- **模板系统**: 灵活的URL模板配置
- **批量操作**: 批量启用/禁用搜索源

### 4. 用户系统
- **安全认证**: JWT基础的安全认证
- **个人设置**: 丰富的个性化配置
- **数据同步**: 跨设备数据同步
- **隐私保护**: 本地优先的隐私策略
- **邮箱验证**: 增强账户安全性的邮箱验证机制

### 5. 社区功能
- **标签管理**: 创建和分享搜索标签
- **源分享**: 社区贡献和分享搜索源
- **用户互动**: 支持社区交流功能

## 🔧 配置说明

### 前端配置
在`frontend/src/core/config.js`中，配置采用了动态管理方式：
```javascript
// 配置会自动检测并设置最佳API URL
// 可以通过环境变量或localStorage覆盖默认配置
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
```

### 搜索源配置
`frontend/src/core/constants.js`文件中定义了应用常量，包括搜索相关的配置：
```javascript
// 搜索源管理API端点
SEARCH_SOURCES: {
  MAJOR_CATEGORIES: '/api/search-sources/major-categories',
  CATEGORIES: '/api/search-sources/categories', 
  SOURCES: '/api/search-sources/sources',
  USER_CONFIGS: '/api/search-sources/user-configs',
  STATS: '/api/search-sources/stats',
  EXPORT: '/api/search-sources/export'
}

// 详情提取API配置
DETAIL_EXTRACTION_TIMEOUT: 15000,
DETAIL_CACHE_DURATION: 86400000,
DETAIL_BATCH_SIZE: 20,
DETAIL_MAX_CONCURRENT: 3,
DETAIL_HEALTH_CHECK_INTERVAL: 300000,
DETAIL_RETRY_DELAY: 1000,
DETAIL_PROGRESS_UPDATE_INTERVAL: 1000

// 详细的搜索源配置通过API动态加载
```

## 📊 性能优化

### 前端优化
- **模块化加载**: ES6模块按需加载
- **缓存策略**: 多层次缓存机制
- **响应式图片**: 适配不同屏幕尺寸
- **代码压缩**: 生产环境代码压缩

### 后端优化
- **边缘计算**: Cloudflare全球边缘节点
- **数据库优化**: 索引优化和查询优化
- **缓存层**: Cloudflare KV存储缓存
- **并发控制**: 优化的并发请求处理

## 🔒 安全特性

- **XSS防护**: 输入输出严格过滤
- **CSRF保护**: Token验证机制
- **SQL注入防护**: 参数化查询
- **访问控制**: 基于角色的权限管理
- **数据加密**: 敏感数据加密存储

## 🧪 测试

目前项目暂未配置自动化测试框架。在开发过程中，您可以使用以下方法进行测试：

### 前端测试
- 使用浏览器开发者工具进行调试
- 检查控制台输出的调试信息
- 验证不同设备上的响应式显示

### 后端测试
- 使用Postman或类似工具测试API端点
- 检查Cloudflare Dashboard中的日志
- 验证数据库操作和数据一致性

## 📝 API文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/verify-token` - Token验证
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/change-password` - 更改密码
- `DELETE /api/auth/delete-account` - 删除账户
- `POST /api/auth/verify-email` - 发送邮箱验证邮件
- `GET /api/auth/verify-email/:token` - 验证邮箱

### 用户数据接口
- `GET /api/user/settings` - 获取用户设置
- `PUT /api/user/settings` - 更新用户设置
- `GET /api/user/favorites` - 获取收藏列表
- `POST /api/user/favorites` - 同步收藏数据
- `GET /api/user/search-history` - 获取搜索历史
- `POST /api/user/search-history` - 保存搜索记录
- `DELETE /api/user/search-history/:id` - 删除历史记录

### 详情提取接口
- `POST /api/detail/extract` - 提取单个搜索结果详情
- `POST /api/detail/batch-extract` - 批量提取搜索结果详情
- `GET /api/detail/history` - 获取详情提取历史
- `GET /api/detail/stats` - 获取详情提取统计
- `POST /api/detail/config/preset` - 应用详情提取配置预设
- `GET /api/detail/config/user` - 获取用户详情提取配置
- `PUT /api/detail/config/user` - 更新用户详情提取配置
- `DELETE /api/detail/cache` - 清除详情提取缓存

### 搜索源管理接口
- `GET /api/search-sources/major-categories` - 获取主要分类
- `GET /api/search-sources/categories` - 获取所有分类
- `GET /api/search-sources/sources` - 获取所有搜索源
- `GET /api/search-sources/user-configs` - 获取用户搜索源配置
- `GET /api/search-sources/stats` - 获取搜索源统计
- `GET /api/search-sources/export` - 导出搜索源配置

### 社区接口
- `GET /api/community/tags` - 获取标签列表
- `POST /api/community/tags` - 创建标签
- `GET /api/community/sources` - 获取社区搜索源
- `POST /api/community/sources` - 提交搜索源
- `GET /api/community/sources/:id` - 获取源详情

### 系统接口
- `GET /api/health` - 健康检查
- `GET /api/sources/status` - 搜索源状态
- `GET /api/config` - 获取系统配置

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 代码规范
- 使用ES6+现代JavaScript语法
- 遵循ESLint规则
- 保持代码注释完整
- 单元测试覆盖率>80%

## 📄 更新日志

### 前端 v2.3.1
- ✨ 新增统一搜索管理器架构
- 🚀 优化详情提取配置管理
- 🎨 改进主题系统和UI体验
- 🔧 重构搜索组件架构
- 📱 增强移动端响应式设计
- 🐛 修复已知性能和显示问题

### 后端 v2.1.0
- ✨ 新增模块化数据库结构
- 🚀 优化详情提取服务
- 🔐 增强认证和安全机制
- 🔧 重构服务层架构
- 📧 添加邮箱验证服务
- 👥 完善社区功能支持

### v1.3.0 (2024-12-19)
- ✨ 新增自定义搜索源和分类管理
- 🚀 优化搜索性能和缓存机制
- 🎨 改进用户界面和交互体验
- 🔧 重构Dashboard架构，提升可维护性
- 📊 增强数据统计和可视化功能
- 🔍 添加详情提取功能

### v1.2.0
- 🔐 完善用户认证和安全机制
- ☁️ 实现云端数据同步功能
- 📱 优化移动端适配
- 🐛 修复若干已知问题

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- [Cloudflare](https://www.cloudflare.com/) - 提供优秀的边缘计算平台
- [各搜索站点](docs/SOURCES.md) - 提供丰富的搜索资源
- 所有贡献者和用户的支持

## 📧 联系方式

- 项目主页: [https://github.com/yourusername/magnet-search](https://github.com/yourusername/magnet-search)
- 问题反馈: [Issues](https://github.com/yourusername/magnet-search/issues)
- 功能建议: [Discussions](https://github.com/yourusername/magnet-search/discussions)

---

<div align="center">
<p>⭐ 如果这个项目对你有帮助，请给我们一个Star！⭐</p>
</div>