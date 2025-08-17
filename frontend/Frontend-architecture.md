magnet-search-app/
├── 📄 index.html                              # 主页面 (ES6模块化版本)
├── 📄 dashboard.html                          # 仪表板页面 (ES6模块化版本)
├── 📄 README.md                               # 项目说明文档
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
│   └── 📁 app/                               # 🚀 应用层
│       ├── 📄 main.js                        # 主应用入口
│       └── 📄 dashboard-app.js               # Dashboard应用逻辑
│
├── 📁 css/                                   # 🎨 样式文件
│   ├── 📄 style.css                          # 主样式文件 (增强版)
│   └── 📄 dashboard.css                      # Dashboard专用样式
│
├── 📁 js/                                    # 📜 兼容性脚本 (保留旧版兼容)
│   └── 📄 config.js                          # 全局配置文件 (兼容ES6和传统)
│
├── 📁 images/                                # 🖼️ 静态资源
│   ├── 📄 favicon.ico                        # 网站图标
│   └── 📄 logo.png                           # 应用Logo
│
├── 📁 Frontend-architecture.md               # 📚 前端架构
├── 📁 Frontend-readme.md                     # 📚 前端介绍
