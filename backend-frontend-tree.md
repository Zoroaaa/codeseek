

# 磁力快搜 - 项目架构树

## 项目根目录结构
```
磁力快搜/
├── 📁 codeseek-backend/          # 后端代码 (Cloudflare Workers)
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
│   │   └── 📄 detail-config.js           # 详情提取配置文件
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
│   │   ├── 📄 detail-api.js              # 详情提取API服务
│   │   ├── 📄 detail-config-api.js       # 详情配置API服务
│   │   ├── 📄 community-sources-api.js   # 搜索源社区-搜索源服务模块
│   │   ├── 📄 community-tags-api.js      # 搜索源社区-标签服务模块
│   │   ├── 📄 enhanced-source-checker.js # 搜索源可用性检查服务
│   │   └── 📄 email-verification-service.js # 📧 邮箱验证服务
│   │
│   ├── 📁 components/                    # 🧩 组件层
│   │   ├── 📄 favorites.js               # 收藏管理组件
│   │   ├── 📄 detail-card.js             # 详情展示卡片组件
│   │   ├── 📄 email-verification-ui.js   # 📧 邮箱验证UI组件
│   │   ├── 📄 search.js                  # 统一搜索组件（主组件集成子组件）
│   │   └── 📁 search/                    # 搜索子组件
│   │       ├── 📄 DetailExtractionManager.js # 详情提取管理子组件
│   │       ├── 📄 SearchConfigManager.js     # 统一配置管理组件
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
├── 📁 css/
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
│   │   ├── 📄 search-config.css          # 搜索配置管理核心样式
│   │   ├── 📄 detail-card.css            # 详情卡片组件样式
│   │   ├── 📄 status.css                 # 状态指示器组件样式
│   │   ├── 📄 search-status.css          # 搜索源状态检查相关样式
│   │   └── 📄 email-verification.css     # 📧 邮箱验证组件样式
│   │
│   ├── 📁 pages/                         # 🚀 页面样式层
│   │   ├── 📄 main.css                   # 主页面专用样式
│   │   └── 📁 dashboard/                 # 仪表板页面专用样式
│   │        ├── 📄 dashboard.css         # Dashboard主样式
│   │        ├── 📄 sources-management.css    # 搜索源管理样式
│   │        ├── 📄 categories-management.css # 搜索源分类管理样式
│   │        └── 📄 community.css         # 搜索源社区样式
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
codeseek-backend/
├── 📁 .github/                        # 🤖 GitHub配置
│   └── 📁 workflows/                  # CI/CD工作流配置
│       └── 📄 deploy.yml              # 🚀 自动部署配置
│
├── 📁 .wrangler/                      # Wrangler临时文件目录
│   └── 📁 tmp/                         # 临时文件
│
├── 📁 sqllite d1/                     # 🗄️ 模块化数据库结构 (Cloudflare D1)
│   ├── 📄 00_main_schema.sql          # 主入口文件（模块说明和依赖关系）
│   ├── 📄 01_user_management.sql      # 用户管理模块（基础模块）
│   ├── 📄 02_search_engine.sql        # 搜索引擎核心模块
│   ├── 📄 03_community.sql            # 社区功能模块
│   ├── 📄 04_detail_extraction.sql    # 详情提取功能模块
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
│   ├── 📁 config/                      # 📁 配置文件目录
│   │   └── 📄 parser-rules.js          # 🔑 网站解析规则配置
│   │
│   ├── 📁 handlers/                    # 📁 路由处理器目录 
│   │   ├── 📄 auth.js                  # 🔑 认证相关处理器
│   │   ├── 📄 detail.js                # 🔑 详情提取API处理器
│   │   ├── 📄 detail-helpers.js        # 🔑 detail.js 的辅助函数集合
│   │   ├── 📄 community.js             # 🏘️ 社区相关处理器（标签+搜索源）
│   │   ├── 📄 user.js                  # 👤 用户相关处理器（设置+收藏+历史等）
│   │   └── 📄 system.js                # ⚙️ 系统相关处理器（状态检查+配置等）
│   │
│   ├── 📁 services/                    # 📁 业务服务目录
│   │   ├── 📄 services.js              # 🔧 状态检查、数据库操作等
│   │   ├── 📄 detail-config-service.js # 🔧 详情提取配置管理服务
│   │   ├── 📄 extraction-validator.js  # 🔧 URL验证和工具函数
│   │   ├── 📄 search-link-extractor.js # 🔧 搜索页面详情链接提取服务
│   │   ├── 📄 cache-manager.js         # 🔑 详情缓存管理服务
│   │   ├── 📄 detail-content-parser.js # 🏘️ 详情页面内容解析服务
│   │   ├── 📄 detail-extractor.js      # 👤 详情提取主服务
│   │   └── 📄 email-verification.js    # 📧 邮箱验证服务
│   │
│   └── 📁 utils/                       # 🛠️ 工具函数目录
│       └── 📄 html-parser.js           # 🔍 HTML解析工具
│
├── 📄 package.json                     # 📦 项目配置文件 (v2.1.0)
├── 📄 package-lock.json                # 依赖锁定文件
├── 📄 schema.sql                       # 🗄️ 数据库结构（完整版本）
├── 📄 wrangler.toml                    # ☁️ Cloudflare Workers 配置
└── 📄 wranger部署.txt                   # Wrangler部署说明文档
```

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
