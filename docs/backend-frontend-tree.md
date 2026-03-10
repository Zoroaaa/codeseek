# 磁力快搜 - 项目架构树 (v2.0.0)

## 技术栈版本

### 前端技术栈
- **核心**: React 18 + TypeScript
- **构建工具**: Vite 5
- **样式框架**: Tailwind CSS 3
- **状态管理**: Zustand 4
- **路由管理**: React Router 6
- **图标库**: Lucide React
- **日期处理**: date-fns
- **部署**: Cloudflare Pages
- **版本**: v2.0.0

### 后端技术栈
- **运行时**: Cloudflare Workers
- **框架**: Hono 4
- **语言**: TypeScript
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT (jose库)
- **API**: RESTful 风格
- **版本**: v2.0.0

### 代理服务
- **架构**: Cloudflare Workers边缘计算
- **功能**: URL重写、资源优化、请求转发
- **状态**: 已独立为 [OmniBox](https://github.com/Zoroaaa/OmniBox) 项目

---

## 项目根目录结构

```
codeseek/
├── 📁 backend/                    # 后端代码 (Cloudflare Workers + Hono)
├── 📁 frontend/                   # 前端代码 (React + TypeScript)
├── 📁 database/                   # 数据库迁移文件 (Cloudflare D1)
├── 📁 codeseek-1.0/              # 版本1.0存档（历史参考）
├── 📁 docs/                       # 项目文档目录
├── 📄 readme.md                   # 项目说明文档
└── 📄 LICENSE                     # MIT许可证
```

---

## 前端架构 (部署在Cloudflare Pages)

```
frontend/
├── 📁 images/                            # 🖼️ 静态资源
│   ├── 📄 favicon.ico                    # 网站图标
│   └── 📄 logo.png                       # 应用Logo
│
├── 📁 public/                            # 公共资源
│   ├── 📄 _headers                       # Cloudflare Headers配置
│   └── 📄 _redirects                     # Cloudflare重定向配置
│
├── 📁 src/                               # 📦 源码目录
│   │
│   ├── 📁 components/                    # 🧩 组件层
│   │   ├── 📁 layout/                    # 布局组件
│   │   │   ├── 📄 DashboardLayout.tsx    # 仪表板布局组件
│   │   │   ├── 📄 MainLayout.tsx         # 主页面布局组件
│   │   │   └── 📄 index.ts               # 布局组件导出
│   │   │
│   │   └── 📁 ui/                        # UI基础组件
│   │       ├── 📄 Badge.tsx              # 徽章组件
│   │       ├── 📄 Button.tsx             # 按钮组件
│   │       ├── 📄 Card.tsx               # 卡片组件
│   │       ├── 📄 Checkbox.tsx           # 复选框组件
│   │       ├── 📄 Dropdown.tsx           # 下拉菜单组件
│   │       ├── 📄 EmptyState.tsx         # 空状态组件
│   │       ├── 📄 Input.tsx              # 输入框组件
│   │       ├── 📄 Loading.tsx            # 加载组件
│   │       ├── 📄 Modal.tsx              # 模态框组件
│   │       ├── 📄 Select.tsx             # 选择器组件
│   │       ├── 📄 Tabs.tsx               # 标签页组件
│   │       ├── 📄 TextArea.tsx           # 文本域组件
│   │       ├── 📄 Toast.tsx              # 通知组件
│   │       └── 📄 index.ts               # UI组件导出
│   │
│   ├── 📁 hooks/                         # 🎣 自定义Hooks
│   │   ├── 📄 useAuth.ts                 # 认证Hook
│   │   ├── 📄 useFavorites.ts            # 收藏Hook
│   │   ├── 📄 useSearch.ts               # 搜索Hook
│   │   ├── 📄 useSearchSuggestions.ts    # 搜索建议Hook
│   │   └── 📄 index.ts                   # Hooks导出
│   │
│   ├── 📁 pages/                         # 📄 页面组件
│   │   ├── 📁 auth/                      # 认证页面
│   │   │   ├── 📄 ForgotPasswordPage.tsx # 忘记密码页
│   │   │   ├── 📄 LoginPage.tsx          # 登录页
│   │   │   ├── 📄 RegisterPage.tsx       # 注册页
│   │   │   └── 📄 index.ts               # 认证页面导出
│   │   │
│   │   ├── 📁 dashboard/                 # 仪表板页面
│   │   │   ├── 📄 CategoryManager.tsx    # 分类管理页
│   │   │   ├── 📄 CommunityManager.tsx   # 社区管理页
│   │   │   ├── 📄 DashboardPage.tsx      # 仪表板主页
│   │   │   ├── 📄 FavoritesHistoryManager.tsx # 收藏历史管理
│   │   │   ├── 📄 OverviewManager.tsx    # 概览页
│   │   │   ├── 📄 SettingsManager.tsx    # 设置页
│   │   │   ├── 📄 SourceManager.tsx      # 搜索源管理页
│   │   │   ├── 📄 StatsManager.tsx       # 统计页
│   │   │   └── 📄 index.ts               # 仪表板页面导出
│   │   │
│   │   ├── 📄 HomePage.tsx               # 首页
│   │   └── 📄 MainSearchPage.tsx         # 主搜索页
│   │
│   ├── 📁 services/                      # 🔧 服务层
│   │   ├── 📁 api/                       # API服务
│   │   │   ├── 📄 auth.ts                # 认证API
│   │   │   ├── 📄 client.ts              # API客户端
│   │   │   ├── 📄 community.ts           # 社区API
│   │   │   ├── 📄 index.ts               # API服务导出
│   │   │   ├── 📄 search.ts              # 搜索API
│   │   │   ├── 📄 source.ts              # 搜索源API
│   │   │   └── 📄 system.ts              # 系统API
│   │   │
│   │   └── 📁 proxy/                     # 代理服务
│   │       ├── 📄 ProxyService.ts        # 代理服务实现
│   │       └── 📄 proxy-config.ts        # 代理配置
│   │
│   ├── 📁 stores/                        # 📦 状态管理 (Zustand)
│   │   ├── 📄 authStore.ts               # 认证状态
│   │   ├── 📄 communityStore.ts          # 社区状态
│   │   ├── 📄 index.ts                   # Store导出
│   │   ├── 📄 proxyStore.ts              # 代理状态
│   │   ├── 📄 searchStore.ts             # 搜索状态
│   │   ├── 📄 sourceStore.ts             # 搜索源状态
│   │   ├── 📄 themeStore.ts              # 主题状态
│   │   └── 📄 uiStore.ts                 # UI状态
│   │
│   ├── 📁 types/                         # 📝 TypeScript类型定义
│   │   ├── 📄 auth.ts                    # 认证类型
│   │   ├── 📄 common.ts                  # 通用类型
│   │   ├── 📄 community.ts               # 社区类型
│   │   ├── 📄 index.ts                   # 类型导出
│   │   ├── 📄 search.ts                  # 搜索类型
│   │   └── 📄 source.ts                  # 搜索源类型
│   │
│   ├── 📄 App.tsx                        # 应用入口组件
│   ├── 📄 index.css                      # 全局样式 (Tailwind)
│   └── 📄 main.tsx                       # 主入口文件
│
├── 📄 index.html                         # HTML入口
├── 📄 package.json                       # 项目配置
├── 📄 postcss.config.js                  # PostCSS配置
├── 📄 tailwind.config.js                 # Tailwind配置
├── 📄 tsconfig.json                      # TypeScript配置
└── 📄 vite.config.ts                     # Vite配置
```

---

## 后端架构 (部署在Cloudflare Workers v2.0.0)

```
backend/
├── 📁 .github/                           # 🤖 GitHub配置
│   └── 📁 workflows/                     # CI/CD工作流配置
│       └── 📄 backend-deploy.yml         # 🚀 自动部署配置
│
├── 📁 src/                               # 🎯 核心代码目录
│   │
│   ├── 📁 middleware/                    # 🔐 中间件层
│   │   ├── 📄 auth.ts                    # 认证中间件
│   │   └── 📄 index.ts                   # 中间件导出
│   │
│   ├── 📁 routes/                        # 🛣️ 路由层
│   │   ├── 📄 admin.ts                   # 管理员路由
│   │   ├── 📄 auth.ts                    # 认证路由
│   │   ├── 📄 community.ts               # 社区路由
│   │   ├── 📄 config.ts                  # 配置路由
│   │   ├── 📄 search.ts                  # 搜索路由
│   │   ├── 📄 sources.ts                 # 搜索源路由
│   │   ├── 📄 system.ts                  # 系统路由
│   │   └── 📄 user.ts                    # 用户路由
│   │
│   ├── 📁 services/                      # 🔧 业务服务层
│   │   ├── 📄 email-verification.ts      # 📧 邮箱验证服务
│   │   ├── 📄 index.ts                   # 服务导出
│   │   └── 📄 search-sources-service.ts  # 🔍 搜索源服务
│   │
│   ├── 📁 types/                         # 📝 TypeScript类型定义
│   │   └── 📄 index.ts                   # 类型定义
│   │
│   ├── 📁 utils/                         # 🛠️ 工具函数
│   │   ├── 📄 index.ts                   # 工具函数入口
│   │   └── 📄 security.ts                # 安全工具
│   │
│   ├── 📁 validation/                    # ✅ 验证层
│   │   └── 📄 index.ts                   # 请求验证
│   │
│   ├── 📄 constants.ts                   # 📋 常量配置
│   └── 📄 index.ts                       # 🚀 主入口文件
│
├── 📄 eslint.config.js                   # ESLint配置
├── 📄 package.json                       # 📦 项目配置文件
├── 📄 tsconfig.json                      # TypeScript配置
└── 📄 wrangler.toml                      # ☁️ Cloudflare Workers配置
```

> **注意**: 数据库迁移文件位于项目根目录的 `database/` 目录下。

---

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  前端应用 (React)                     │   │
│  │  • 静态资源托管                                       │   │
│  │  • 全球CDN加速                                        │   │
│  │  • 自动HTTPS                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Cloudflare Workers                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 后端API服务 (Hono)                    │   │
│  │  • 边缘计算                                          │   │
│  │  • 全球分布                                          │   │
│  │  • 自动扩缩容                                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare D1                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  SQLite数据库                        │   │
│  │  • 用户数据                                          │   │
│  │  • 搜索源配置                                        │   │
│  │  • 社区数据                                          │   │
│  │  • 系统配置                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 数据库模块化结构说明

### 模块依赖关系

```
01_user_management.sql (基础模块)
        │
        ├──► 02_search_engine.sql
        │
        ├──► 03_community.sql
        │
        ├──► 04_search_source.sql
        │
        ├──► 05_email_security.sql
        │
        ├──► 06_system_analytics.sql
        │
        └──► 07_initialization_data.sql
```

### 数据表说明

| 模块文件 | 核心数据表 | 说明 |
|---------|-----------|------|
| 01_user_management.sql | users, user_settings, sessions | 用户管理基础模块 |
| 02_search_engine.sql | search_history, favorites | 搜索引擎核心 |
| 03_community.sql | community_sources, community_tags, reviews | 社区功能 |
| 04_search_source.sql | search_sources, source_categories, major_categories | 搜索源管理 |
| 05_email_security.sql | verification_codes, security_locks | 邮箱验证与安全 |
| 06_system_analytics.sql | system_config, user_actions, analytics_events | 系统配置与分析 |
| 07_initialization_data.sql | - | 初始化数据 |

---

## 版本信息

| 组件 | 版本 | 说明 |
|-----|------|------|
| 前端应用 | v2.0.0 | React 18 + TypeScript |
| 后端服务 | v2.0.0 | Hono + TypeScript |
| 数据库 | v2.0.0 | Cloudflare D1 |

---

## 与版本1.0的主要区别

### 前端变化

| 特性 | 版本1.0 | 版本2.0 |
|-----|---------|---------|
| 技术栈 | 原生ES6 JavaScript | React 18 + TypeScript |
| 构建工具 | 无（直接运行） | Vite 5 |
| 样式方案 | 原生CSS | Tailwind CSS |
| 状态管理 | 自定义Store | Zustand |
| 类型安全 | 无 | TypeScript |
| 组件化 | 模块化函数 | React函数组件 |
| 路由 | 无 | React Router 6 |

### 后端变化

| 特性 | 版本1.0 | 版本2.0 |
|-----|---------|---------|
| 语言 | JavaScript | TypeScript |
| 框架 | 原生Workers | Hono框架 |
| 路由 | 自定义Router | Hono路由 |
| 类型安全 | 无 | TypeScript |
| 验证 | 自定义验证 | 统一验证层 |

### 架构优势

1. **类型安全**: TypeScript提供编译时类型检查
2. **开发体验**: React生态系统和现代工具链
3. **可维护性**: 组件化架构，代码组织更清晰
4. **性能优化**: Vite构建，代码分割，Tree-shaking
5. **开发效率**: 热更新，更好的IDE支持
