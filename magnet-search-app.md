magnet-search-app/
├── 📄 index.html                              # 主页面
├── 📄 dashboard.html                          # 仪表板页面
├── 📄 README.md                               # 项目文档
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
│   │
│   ├── 📁 components/                        # 🧩 组件层
│   │   ├── 📄 favorites.js                   # 收藏管理组件
│   │   └── 📄 search.js                      # 搜索组件
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
├── 📁 css/                                   # 🎨 样式文件
│   ├── 📄 style.css                          # 主样式文件
│   └── 📄 dashboard.css                      # Dashboard专用样式
│
├── 📁 js/                                    # 📜 兼容性脚本
│   └── 📄 config.js                          # 全局配置文件
│
├── 📁 images/                                # 🖼️ 静态资源
│   ├── 📄 favicon.ico                        # 网站图标
│   └── 📄 logo.png                           # 应用Logo
│
└── 📁 docs/                                  # 📚 项目文档
    ├── 📄 API.md                             # API接口文档
    ├── 📄 DEPLOYMENT.md                      # 部署指南
    └── 📄 CHANGELOG.md                       # 更新日志