frontend-tree/
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
│   │   └── 📄 search.js                      # 搜索服务模块
│   │   └── 📄 enhanced-source-checker.js     # 搜索源可用性检查服务
│   │
│   ├── 📁 components/                        # 🧩 组件层
│   │   ├── 📄 favorites.js                   # 收藏管理组件
│   │   └── 📄 search.js                      # 搜索组件
│   │   └── 📄 enhanced-search-ui.js          # 搜索界面组件 - 支持搜索源状态显示
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
│   │   └── 📄 status.css                     # 状态指示器组件样式
│   │
│   ├── 📁 pages/                             # 🚀 页面样式层
│   │   ├── 📄 main.css                       # 主页面专用样式
│   │   └── 📄 dashboard.css                  # 仪表板页面专用样式
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
	
	
backend-tree/
├── 📄 schema.sql                             # 数据库结构
├── 📄 worker.js                              # 后端主逻辑

后端部署在cloudflare workers
数据库部署在cloudflare D1
