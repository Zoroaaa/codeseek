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

# 磁力快搜 - 项目架构树

## 项目根目录结构
```
磁力快搜/
├── 📁 backend/                    # 后端代码 (Cloudflare Workers)
├── 📁 frontend/                  # 前端代码
├── 📄 backend-frontend-tree.md   # 项目架构文档
├── 📄 readme.md                  # 项目说明文档
└── 📄 本地项目推送到GitHub.txt   # GitHub推送指南
```

## 前端架构 (部署在Cloudflare Pages)
```
frontend/
├── 📄 dashboard.html                      # 用户仪表板页面
├── 📄 index.html                          # 主搜索页面
│
├── 📁 src/                                # ES6源码目录
│   ├── 📁 core/                          # 🎯 核心配置层
│   │   ├── 📄 constants.js               # 应用常量定义 (v1.4.0)
│   │   ├── 📄 config.js                  # 配置管理器 (动态配置机制)
│   │   └── 📄 proxy-config.js            # 代理配置文件
│   │
│   ├── 📁 utils/                         # 🛠️ 工具函数层
│   │   ├── 📄 helpers.js                 # 通用帮助函数
│   │   ├── 📄 validation.js              # 数据验证工具
│   │   ├── 📄 format.js                  # 格式化工具
│   │   ├── 📄 dom.js                     # DOM操作工具
│   │   ├── 📄 storage.js                 # 存储管理工具
│   │   └── 📄 network.js                 # 网络工具函数
│   │
│   ├── 📁 services/                      # 🔧 服务层
│   │   ├── 📄 api.js                     # API服务模块
│   │   ├── 📄 auth.js                    # 认证服务模块
│   │   ├── 📄 theme.js                   # 主题管理服务
│   │   ├── 📄 search.js                  # 搜索服务模块
│   │   ├── 📄 community-sources-api.js   # 搜索源社区-搜索源服务模块
│   │   ├── 📄 community-tags-api.js      # 搜索源社区-标签服务模块
│   │   ├── 📄 enhanced-source-checker.js # 搜索源可用性检查服务
│   │   ├── 📄 email-verification-service.js # 📧 邮箱验证服务
│   │   ├── 📄 search-sources-api.js      # 搜索源API服务
│   │   └── 📄 proxy-service.js           # 代理服务
│   │
│   ├── 📁 components/                    # 🧩 组件层
│   │   ├── 📄 favorites.js               # 收藏管理组件
│   │   ├── 📄 email-verification-ui.js   # 📧 邮箱验证UI组件
│   │   ├── 📄 search.js                  # 统一搜索组件（主组件集成子组件）
│   │   └── 📁 search/                    # 搜索子组件
│   │       ├── 📄 SearchHistoryManager.js    # 搜索历史管理子组件
│   │       ├── 📄 SearchResultsRenderer.js   # 搜索结果渲染子组件
│   │       └── 📄 SearchSuggestionManager.js # 搜索建议管理子组件
│   │
│   └── 📁 pages/                         # 🚀 页面应用层
│       ├── 📁 main/                      # 主页应用模块
│       │   └── 📄 main.js                # 主页应用入口
│       │
│       └── 📁 dashboard/                 # 仪表板应用模块
│           ├── 📄 dashboard-app.js       # Dashboard主应用
│           ├── 📄 overview-manager.js    # 📊 概览页面管理器
│           ├── 📄 favorites-manager.js   # ⭐ 收藏页面管理器
│           ├── 📄 history-manager.js     # 🕒 历史页面管理器
│           ├── 📄 sources-manager.js     # 🔍 搜索源管理器
│           ├── 📄 categories-manager.js  # 📂 分类管理器
│           ├── 📄 community-manager.js   # 📈 搜索源社区管理器
│           ├── 📄 community-sources-manager.js # 📈 搜索源社区-搜索源管理器
│           ├── 📄 community-tags-manager.js  # 📈 搜索源社区-标签管理器
│           ├── 📄 settings-manager.js    # ⚙️ 设置管理器
│           └── 📄 stats-manager.js       # 📈 统计管理器
│
├── 📁 css/                               # 样式文件目录
│   ├── 📁 core/                          # 🎯 核心样式层
│   │   ├── 📄 variables.css              # CSS变量定义（主题色、尺寸等）
│   │   └── 📄 base.css                   # 基础重置和全局样式
│   │
│   ├── 📁 components/                    # 🧩 组件样式层
│   │   ├── 📄 navbar.css                 # 导航栏组件样式
│   │   ├── 📄 buttons.css                # 按钮系统样式
│   │   ├── 📄 modal.css                  # 模态框组件样式 
│   │   ├── 📄 toast.css                  # 通知组件样式
│   │   ├── 📄 loading.css                # 加载组件样式
│   │   ├── 📄 search.css                 # 搜索组件样式
│   │   ├── 📄 status.css                 # 状态指示器组件样式
│   │   ├── 📄 search-status.css          # 搜索源状态检查相关样式
│   │   ├── 📄 email-verification.css     # 📧 邮箱验证组件样式
│   │   ├── 📄 navigation-proxy.css       # 导航栏代理UI组件样式
│   │   └── 📄 proxy-ui.css               # 代理UI组件样式
│   │
│   ├── 📁 pages/                         # 🚀 页面样式层
│   │   ├── 📄 main.css                   # 主页面专用样式
│   │   └── 📁 dashboard/                 # 仪表板页面专用样式
│   │       ├── 📄 dashboard.css                  # Dashboard主布局样式
│   │       ├── 📄 categories-management.css       # 分类管理页面样式
│   │       ├── 📄 community.css                   # 社区功能页面样式
│   │       └── 📄 sources-management.css          # 搜索源管理页面样式
│   │
│   └── 📁 utils/                         # 🛠️ 工具样式层
│       ├── 📄 animations.css             # 动画效果
│       ├── 📄 responsive.css             # 响应式布局
│       ├── 📄 accessibility.css          # 无障碍样式
│       └── 📄 print.css                  # 打印样式
│
└── 📁 images/                            # 🖼️ 静态资源
    ├── 📄 favicon.ico                    # 网站图标
    └── 📄 logo.png                       # 应用Logo
```

## 后端架构 (部署在Cloudflare Workers v2.1.0)
```
backend/
├── 📁 .github/                        # 🤖 GitHub配置
│   └── 📁 workflows/                  # CI/CD工作流配置
│       └── 📄 deploy_backend.yml      # 🚀 自动部署配置
│
├── 📁 .wrangler/                      # Wrangler临时文件目录
│   └── 📁 tmp/                         # 临时文件
│
├── 📁 sqllite d1/                     # 🗄️ 模块化数据库结构 (Cloudflare D1)
│   ├── 📄 01_user_management.sql      # 用户管理模块（基础模块）
│   ├── 📄 02_search_engine.sql        # 搜索引擎核心模块
│   ├── 📄 03_community.sql            # 社区功能模块
│   ├── 📄 04_search_source.sql        # 搜索源相关数据
│   ├── 📄 05_email_security.sql       # 邮箱验证与安全模块
│   ├── 📄 06_system_analytics.sql     # 系统配置和分析模块
│   └── 📄 07_initialization_data.sql  # 初始化数据
│
├── 📁 src/                            # 🎯 核心代码目录
│   ├── 📄 index.js                     # 🚀 主入口文件（Cloudflare Workers兼容版本）
│   ├── 📄 router.js                    # 🛣️ 路由器类
│   ├── 📄 middleware.js                # 🔐 认证等中间件
│   ├── 📄 constants.js                 # 📋 常量配置
│   ├── 📄 utils.js                     # 🛠️ 工具函数主入口
│   │
│   ├── 📁 handlers/                    # 📁 路由处理器目录 
│   │   ├── 📄 auth.js                  # 🔑 认证相关处理器
│   │   ├── 📄 community.js             # 🏘️ 社区相关处理器（标签+搜索源）
│   │   ├── 📄 user.js                  # 👤 用户相关处理器（设置+收藏+历史等）
│   │   ├── 📄 system.js                # ⚙️ 系统相关处理器（状态检查+配置等）
│   │   └── 📄 search-sources.js        # 🔍 搜索源相关处理器
│   │
│   └── 📁 services/                    # 📁 业务服务目录
│       ├── 📄 services.js              # 🔧 状态检查、数据库操作等
│       ├── 📄 email-verification.js    # 📧 邮箱验证服务
│       └── 📄 search-sources-service.js # 🔍 搜索源服务
│
├── 📄 package.json                     # 📦 项目配置文件 (v2.1.0)
├── 📄 package-lock.json                # 依赖锁定文件
│
├── 📄 wrangler.toml                    # ☁️ Cloudflare Workers 配置
└── 📄 wranger部署.txt                   # Wrangler部署说明文档
```

> **注意**: 代理服务功能模块已独立为新项目，访问 [https://github.com/Zoroaaa/OmniBox](https://github.com/Zoroaaa/OmniBox) 获取最新信息。

## 部署架构
- **前端**: 部署在 Cloudflare Pages
- **后端**: 部署在 Cloudflare Workers (v2.1.0)
- **数据库**: 部署在 Cloudflare D1 (SQLite) - 模块化结构设计

## 数据库模块化结构说明
- 采用模块化设计，每个功能模块有独立的SQL文件
- 用户管理模块（01_user_management.sql）是基础模块，其他模块依赖它
- 可以根据需要选择性执行相应模块的SQL文件
- 初始化时按顺序执行所有模块文件

## 版本信息
- 前端应用版本: v1.4.0
- 后端服务版本: v2.1.0
