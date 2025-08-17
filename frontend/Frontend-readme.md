📋 文件清单与职责
🏠 根目录文件
文件 描述 更新状态
index.html主页面，使用ES6模块导入✅ 已重构
dashboard.html仪表板页面，使用ES6模块导入✅ 已重构
🎯 核心配置层 (src/core/)
文件 描述 主要功能
constants.js应用常量定义存储键、API端点、限制值等
config.js配置管理器环境配置、API配置、功能开关
🛠️ 工具函数层 (src/utils/)
文件 描述 主要功能
helpers.js通用帮助函数ID生成、防抖节流、深拷贝等
validation.js数据验证工具表单验证、数据格式检查
format.js格式化工具时间格式化、文本处理、HTML转义
dom.jsDOM操作工具Toast通知、Loading状态、元素操作
storage.js存储管理工具localStorage安全封装、Cookie操作
network.js网络工具函数连接检测、设备识别、性能监控
🔧 服务层 (src/services/)
文件 描述 主要功能
api.jsAPI服务模块HTTP请求、认证、收藏、搜索历史
auth.js认证服务模块登录、注册、token管理、权限检查
theme.js主题管理服务主题切换、系统主题检测
search.js搜索服务模块搜索执行、历史管理、缓存管理
🧩 组件层 (src/components/)
文件 描述 主要功能
favorites.js收藏管理组件收藏增删改查、同步、导入导出
search.js搜索组件搜索界面、结果展示、建议系统
🚀 应用层 (src/app/)
文件 描述 主要功能
main.js主应用入口应用初始化、事件绑定、路由管理
dashboard-app.jsDashboard应用逻辑仪表板功能、数据管理、设置
🎨 样式文件 (css/)
文件 描述 更新状态
style.css主样式文件✅ 增强版 (响应式、现代化)
dashboard.cssDashboard专用样式✅ 已适配ES6版本
📜 兼容性文件 (js/)
文件 描述 用途
config.js全局配置文件兼容ES6模块和传统script标签

🔄 模块依赖关系
graph TD
    A[index.html] --> B[src/app/main.js]
    C[dashboard.html] --> D[src/app/dashboard-app.js]
    
    B --> E[src/services/auth.js]
    B --> F[src/services/theme.js]
    B --> G[src/components/search.js]
    B --> H[src/components/favorites.js]
    
    D --> E
    D --> F
    D --> I[src/services/api.js]
    
    E --> I
    E --> J[src/utils/validation.js]
    E --> K[src/utils/dom.js]
    
    F --> L[src/core/constants.js]
    F --> K
    
    G --> M[src/services/search.js]
    G --> J
    G --> K
    
    H --> I
    H --> K
    H --> N[src/utils/format.js]
    
    I --> O[src/core/config.js]
    I --> P[src/utils/helpers.js]
    
    M --> I
    M --> L
    M --> J
    
    O --> L
    
    K --> P
    N --> P
    J --> P