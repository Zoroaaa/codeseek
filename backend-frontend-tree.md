

codeseek/frontend/
├── 📄 index.html                              # 主页面
├── 📄 dashboard.html                          # 仪表板页面
│
├── 📁 src/                                    # ES6源码目录
│   ├── 📁 core/                              # 🎯 核心配置层
│   │   ├── 📄 constants.js                   # 应用常量定义
│   │   └── 📄 config.js                      # 配置管理器
│   │
│   ├── 📁 utils/                             # 🛠️ 工具函数层
│   │   ├── 📄 helpers.js                     # 通用帮助函数
│   │   ├── 📄 validation.js                  # 数据验证工具
│   │   ├── 📄 format.js                      # 格式化工具
│   │   ├── 📄 dom.js                         # DOM操作工具
│   │   ├── 📄 storage.js                     # 存储管理工具
│   │   └── 📄 network.js                     # 网络工具函数
│   │
│   ├── 📁 services/                          # 🔧 服务层
│   │   ├── 📄 api.js                         # API服务模块
│   │   ├── 📄 auth.js                        # 认证服务模块
│   │   ├── 📄 theme.js                       # 主题管理服务
│   │   ├── 📄 search.js                      # 搜索服务模块
│   │   ├── 📄 detail-api.js                  # 详情提取API服务
│   │   ├── 📄 community-sources-api.js       # 搜索源社区-搜索源服务模块
│   │   ├── 📄 community-tags-api.js          # 搜索源社区-标签服务模块
│   │   └── 📄 enhanced-source-checker.js     # 搜索源可用性检查服务
│   │
│   ├── 📁 components/                        # 🧩 组件层
│   │   ├── 📄 favorites.js                   # 收藏管理组件
│   │   ├── 📄 detail-card.js                 # 详情展示卡片组件
│   │   ├── 📄 search.js                      # 统一搜索组件（主组件集成子组件）
│   │   └── 📁 search/                        # 搜索子组件
│   │       ├── 📄 DetailExtractionManager.js # 详情提取管理子组件
│   │       ├── 📄 SearchConfigManager.js     # 统一配置管理组件
│   │       ├── 📄 SearchHistoryManager.js    # 搜索历史管理子组件
│   │       ├── 📄 SearchResultsRenderer.js   # 搜索结果渲染子组件
│   │       └── 📄 SearchSuggestionManager.js # 搜索建议管理子组件
│   │
│   └── 📁 pages/                             # 🚀 页面应用层 (重构)
│       ├── 📁 main/                          # 主页应用模块
│       │   └── 📄 main.js                    # 主页应用入口
│       │
│       └── 📁 dashboard/                     # 仪表板应用模块
│           ├── 📄 dashboard-app.js           # Dashboard主应用(精简版)
│           ├── 📄 overview-manager.js        # 📊 概览页面管理器
│           ├── 📄 favorites-manager.js       # ⭐ 收藏页面管理器
│           ├── 📄 history-manager.js         # 🕒 历史页面管理器
│           ├── 📄 sources-manager.js         # 🔍 搜索源管理器
│           ├── 📄 categories-manager.js      # 📂 分类管理器
│           ├── 📄 community-manager.js       # 📈 搜索源社区管理器
│           ├── 📄 community-sources-manager.js # 📈 搜索源社区-搜索源管理器
│           ├── 📄 community-tags-manager.js  # 📈 搜索源社区-标签管理器
│           ├── 📄 settings-manager.js        # ⚙️ 设置管理器
│           └── 📄 stats-manager.js           # 📈 统计管理器
│
├── 📁 css/
│   ├── 📁 core/                              # 🎯 核心样式层
│   │   ├── 📄 variables.css                  # CSS变量定义（主题色、尺寸等）
│   │   └── 📄 base.css                       # 基础重置和全局样式
│   │
│   ├── 📁 components/                        # 🧩 组件样式层
│   │   ├── 📄 navbar.css                     # 导航栏组件样式
│   │   ├── 📄 buttons.css                    # 按钮系统样式
│   │   ├── 📄 modal.css                      # 模态框组件样式 
│   │   ├── 📄 toast.css                      # 通知组件样式
│   │   ├── 📄 loading.css                    # 加载组件样式
│   │   ├── 📄 search.css                     # 搜索组件样式
│   │   ├── 📄 search-config.css              # 搜索配置管理核心样式
│   │   ├── 📄 detail-card.css                # 详情卡片组件样式
│   │   ├── 📄 status.css                     # 状态指示器组件样式
│   │   └── 📄 search-status.css              # 搜索源状态检查相关样式
│   │
│   ├── 📁 pages/                             # 🚀 页面样式层
│   │   ├── 📄 main.css                       # 主页面专用样式
│   │   └── 📁 dashboard/                     # 仪表板页面专用样式
│   │        ├── 📄 dashboard.css             # Dashboard主样式
│   │        ├── 📄 sources-management.css    # 搜索源管理样式
│   │        ├── 📄 categories-management.css # 搜索源分类管理样式
│   │        └── 📄 community.css             # 搜索源社区样式
│   │
│   └── 📁 utils/                             # 🛠️ 工具样式层
│       ├── 📄 animations.css                 # 动画效果
│       ├── 📄 responsive.css                 # 响应式布局
│       ├── 📄 accessibility.css              # 无障碍样式
│       └── 📄 print.css                      # 打印样式
│
│
└── 📁 images/                                # 🖼️ 静态资源
    ├── 📄 favicon.ico                        # 网站图标
    └── 📄 logo.png                           # 应用Logo
	
前端部署在cloudflare pages
	
	

codeseek/codeseek-backend/
├── src/                              # 🎯 核心代码目录
│   ├── index.js                      # 🚀 主入口文件
│   ├── router.js                     # 🛣️ 路由器类（精简版）
│   ├── middleware.js                 # 🔐 认证等中间件
│   ├── utils.js                      # 🛠️ 工具函数集合
│   ├── services.js                   # 🔧 业务服务（状态检查、数据库操作等）
│   ├── constants.js                  # 📋 常量配置
│   ├── config/                       # 📁 搜索详情配置目录 
│   │   └── parser-rules.js           # 🔑 网站解析规则配置
│   │
│   ├── config/                       # 📁  
│   │   └── html-parser.js            # 🔑 cloudflare worker的HTML解析
│   │
│   ├── services/                     # 📁 业务服务目录
│   │   ├── services.js               # 🔧 状态检查、数据库操作等
│   │   ├── detail-config-service.js  # 🔧 详情提取配置管理服务
│   │   ├── extraction-validator.js   # 🔧 URL验证和工具函数
│   │   ├── search-link-extractor.js  # 🔧 搜索页面详情链接提取服务
│   │   ├── cache-manager.js          # 🔑 详情缓存管理服务
│   │   ├── detail-content-parser.js  # 🏘️ 详情页面内容解析服务
│   │   └── detail-extractor.js       # 👤 详情提取主服务
│   │
│   └── handlers/                     # 📁 路由处理器目录 
│       ├── auth.js                   # 🔑 认证相关处理器
│       ├── detail.js                 # 🔑 详情提取API处理器
│       ├── detail-helpers.js         # 🔑 detail.js 的辅助函数集合
│       ├── community.js              # 🏘️ 社区相关处理器（标签+搜索源）
│       ├── user.js                   # 👤 用户相关处理器（设置+收藏+历史等）
│       └── system.js                 # ⚙️ 系统相关处理器（状态检查+配置等）
│   
├── wrangler.toml                     # ☁️ Cloudflare Workers 配置
├── package.json                      # 📦 项目配置
├── .github/workflows/                # 🤖 CI/CD 配置
│   └── deploy.yml                    # 🚀 自动部署配置
└── schema.sql                        # 🗄️ 数据库结构


后端部署在cloudflare workers
数据库部署在cloudflare D1
