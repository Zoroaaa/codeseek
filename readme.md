<p align="center">
  <img src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=modern%20minimalist%20search%20engine%20logo%2C%20magnifying%20glass%20with%20code%20brackets%2C%20gradient%20blue%20to%20purple%2C%20clean%20white%20background%2C%20professional%20tech%20brand&image_size=square_hd" width="120" alt="CodeSeek Logo" />
</p>

<h1 align="center">CodeSeek</h1>

<p align="center">
  <strong>开源聚合搜索引擎</strong> — JAV / 动漫 / 影视，一站式搜索
</p>

<p align="center">
  <a href="#功能特性">功能</a> •
  <a href="#技术架构">架构</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#项目结构">目录</a> •
  <a href="#部署指南">部署</a> •
  <a href="#api-文档">API</a> •
  <a href="#更新日志">更新</a>
 •
  <a href="#贡献指南">贡献</a>
</p>

---

## 功能特性

### 三大搜索类别

| 类别 | 说明 | 数据源 |
|------|------|--------|
| **JAV** | 成人影片元数据 + 磁力链接 | DMM/FANZA、JavBus、JavDB、磁力源 |
| **动漫** | 动画番剧信息 + 字幕组资源 + 磁力 | Bangumi、Mikan、Nyaa、ShowRSS |
| **影视** | 电影/剧集元数据 + 种子资源 | TMDB、YTS、EZTV、TPB |

### 三层搜索架构

```
搜索大类 (Category)          搜索分类 (Classification)        搜索源 (Source)
┌─────────────┐           ┌──────────────────┐           ┌──────────────┐
│   anime     │ ────────> │ bangumi          │ ────────> │ Bangumi API  │
│             │           │ mikan            │           │ Mikan Project│
│             │           │ nyaa             │           │ Nyaa.si      │
│             │           │ showrss          │           │ ShowRSS      │
├─────────────┤           ├──────────────────┤           ├──────────────┤
│   movie     │ ────────> │ tmdb             │ ────────> │ TMDB API     │
│             │           │ yts              │           │ YTS          │
│             │           │ eztv             │           │ EZTV         │
│             │           │ tpb              │           │ TPB          │
├─────────────┤           ├──────────────────┤           ├──────────────┤
│    jav      │ ────────> │ metadata         │ ────────> │ DMM/FANZA    │
│             │           │ magnet           │           │ JavBus       │
│             │           │                  │           │ JavDB        │
└─────────────┘           └──────────────────┘           └──────────────┘
```

**核心设计：**
- **Provider 注册模式**：新增搜索类别只需创建 Provider 类并在 `backend/src/index.ts` 注册一行
- **分类独立路由**：每个分类有独立的搜索逻辑和结果面板
- **数据库驱动的源管理**：搜索源的启用/禁用/权重通过后台管理

### 其他核心功能

- **用户系统**：GitHub OAuth 登录、收藏管理、搜索历史（支持三大类别）
- **社区模块**：评论、评分、举报、排行榜
- **后台管理**：用户/评论/源管理、系统监控仪表盘
- **反馈系统**：用户反馈收集与处理
- **暗色模式**：完整的明暗主题切换
- **图片代理**：统一后端代理，解决跨域和防盗链问题

## 技术架构

```
codeseek/
├── frontend/              # React 19 + Vite 前端
│   ├── src/
│   │   ├── components/
│   │   │   ├── search/           # 搜索组件（含动漫/影视/JAV 面板）
│   │   │   ├── jav/              # JAV 专属组件
│   │   │   └── ui/               # 通用 UI 组件
│   │   ├── pages/                # 页面（首页/登录/详情/管理）
│   │   └── types/                # TypeScript 类型定义
│   └── package.json
│
├── backend/               # Hono + Cloudflare Workers 后端
│   ├── src/
│   │   ├── providers/            # 搜索 Provider（核心扩展点）
│   │   │   ├── anime-provider.ts # 动漫搜索 Provider
│   │   │   ├── movie-provider.ts  # 影视搜索 Provider
│   │   │   └── jav-provider.ts   # JAV 搜索 Provider
│   │   ├── services/             # 业务服务层
│   │   │   ├── anime-search.ts   # 动漫搜索服务
│   │   │   ├── movie-search.ts   # 影视搜索服务
│   │   │   └── search-provider.ts # Provider 注册中心
│   │   ├── routes/               # API 路由
│   │   └── types/                # 后端类型定义
│   └── wrangler.toml
│
├── packages/shared/        # 共享类型与工具
│   └── src/types/search.ts # 统一搜索类型定义
│
├── database/              # Cloudflare D1 数据库
│   ├── schema.sql         # 完整建表语句
│   ├── 06_data_search_sources.sql  # 搜索源种子数据
│   └── 13_schema_history_cover.sql # 历史记录封面字段
│
└── docs/                  # 项目文档
    ├── api/               # API 文档
    │   ├── index.md       # API 总览
    │   ├── search.md      # 搜索接口文档
    │   ├── sources.md     # 搜索源管理
    │   └── auth.md        # 认证接口
    ├── config.md          # 配置说明
    ├── deploy.md          # 部署指南
    └── changelog*.md      # 版本更新记录
```

### 技术栈

| 层级 | 技术 |
|------|------|
| **前端框架** | React 19 + TypeScript + Vite |
| **UI 库** | Tailwind CSS + Lucide Icons + Framer Motion |
| **状态管理** | Zustand |
| **后端框架** | Hono (Cloudflare Workers) |
| **运行时** | Cloudflare Workers + Edge Runtime |
| **数据库** | Cloudflare D1 (SQLite) |
| **对象存储** | Cloudflare R2 |
| **认证** | GitHub OAuth (PKCE) |
| **构建工具** | Turborepo (monorepo) |
| **包管理** | pnpm |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 8
- Cloudflare 账号（Workers + D1 + R2）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/codeseek-team/codeseek.git
cd codeseek
pnpm install
```

### 2. 配置环境变量

```bash
# 复制模板
cp .env.example .env.local

# 编辑配置（必填项）
# GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET - GitHub OAuth
# TMDB_API_KEY - TMDB API（影视搜索）
# BANGUMI_API_KEY - Bangumi API（动漫搜索，可选）
# R2_*** - R2 对象存储（封面图等）
```

### 3. 初始化数据库

```bash
# 创建 D1 数据库
npx wrangler d1 create codeseek-db

# 执行建表 SQL
npx wrangler d1 execute codeseek-db --file=database/schema.sql
npx wrangler d1 execute codeseek-db --file=database/06_data_search_sources.sql
```

### 4. 本地开发

```bash
# 启动开发服务器（前端 :5173 + 后端 :8787）
pnpm dev
```

访问 http://localhost:5173 即可使用。

### 5. 生产部署

```bash
# 构建并部署到 Cloudflare Workers
pnpm deploy
```

详细部署步骤见 [deploy.md](docs/deploy.md)

## 项目结构

详见上方 [技术架构](#技术架构) 章节。

关键扩展点：

- **新增搜索类别** → 创建 `backend/src/providers/xxx-provider.ts` → 在 `index.ts` 注册
- **新增搜索源** → 在 `search_sources` 表插入记录或通过后台管理界面添加
- **新增前端页面** → 在 `frontend/src/pages/` 创建组件并在 `App.tsx` 配置路由

## 部署指南

完整部署文档见 [deploy.md](docs/deploy.md)，包括：
- Cloudflare Workers 部署
- D1 数据库初始化与迁移
- R2 存储桶配置
- 自定义域名 + SSL
- 环境变量管理
- CI/CD 自动化部署

## API 文档

### 核心接口

| 模块 | 路径 | 说明 |
|------|------|------|
| **搜索** | `POST /api/search` | 统一搜索入口（支持 anime/movie/jav） |
| **搜索源** | `GET /api/search-sources` | 获取所有搜索源列表 |
| **历史** | `GET /api/search/history` | 搜索历史（含封面） |
| **收藏** | `GET/POST /api/favorites` | 收藏管理 |
| **用户** | `GET /api/user/me` | 当前用户信息 |
| **认证** | `GET /api/auth/github` | GitHub OAuth 登录 |
| **社区** | `GET/POST /api/community/comments` | 评论系统 |
| **反馈** | `POST /api/feedback` | 提交反馈 |
| **JAV** | `GET /api/jav/:id` | JAV 详情（含代理图片） |
| **管理** | `GET /api/admin/*` | 后台管理接口 |

完整 API 文档见 [docs/api/index.md](docs/api/index.md)

### 搜索接口示例

```bash
# 动漫搜索
curl -X POST https://api.codeseek.pp.ua/api/search \
  -H "Content-Type: application/json" \
  -d '{"category":"anime","keyword":"葬送的芙莉莲","classification":"bangumi"}'

# 影视搜索
curl -X POST https://api.codeseek.pp.ua/api/search \
  -H "Content-Type: application/json" \
  -d '{"category":"movie","keyword":"盗梦空间","classification":"tmdb"}'

# JAV 搜索
curl -X POST https://api.codeseek.pp.ua/api/search \
  -H "Content-Type: application/json" \
  -d '{"category":"jav","keyword":"SSIS","classification":"metadata"}'
```

## 更新日志

### v4.0.0 — 动漫 & 影视搜索 + 架构升级 (2026-06)

#### 新增功能
- **动漫搜索系统**
  - Bangumi 番剧信息集成（评分、标签、放送日期）
  - Mikan Project 字幕组数据（订阅数、更新状态）
  - Nyaa.si 磁力搜索（做种/下载量、可信标记）
  - ShowRSS RSS 订阅源
  - 专属 AnimeSearchResultPanel 结果面板

- **影视搜索系统**
  - TMDB 电影/剧集元数据（海报、评分、简介）
  - YTS 电影种子（720p/1080p/4K 多画质）
  - EZTV 剧集种子（季/集信息）
  - TPB 兜底磁力源
  - 专属 MovieSearchResultPanel 结果面板

- **三层搜索架构重构**
  - Category（大类）→ Classification（分类）→ Source（源）
  - Provider 注册模式，新增类别只需一行注册代码
  - 数据库驱动源管理，支持动态启停

#### 架构改进
- 新增 `SearchProvider` 接口与 `ProviderRegistry` 注册中心
- 新增 `anime-provider`、`movie-provider` Provider 实现
- `history` 表扩展支持 anime/movie/jav 全类别
- `history` 表新增 `cover_image` 封面字段
- `search_sources` 表新增 `category` / `classification` 字段
- 共享类型包 `packages/shared` 统一前后端类型
- 图片代理统一走 `/api/jav/proxy-image`（复用于动漫/影视封面）

#### 前端改进
- 搜索页新增「动漫」「影视」Tab 切换
- 分类选择器按类别动态加载
- 动漫结果面板：Bangumi 卡片 + Mikan 字幕组 + Nyaa 磁力列表
- 影视结果面板：TMDB 卡片 + YTS/EZTV/TPB 资源列表
- 暗色模式全面适配新组件

<details>
<summary><b>历史版本</b></summary>

### v3.1.0 — 社区互动 + 反馈机制 (2026-05)
- 社区评论系统（嵌套回复、点赞、排序）
- 用户反馈系统（分类提交、管理审核）
- 后台管理增强（评论/反馈/用户管理、操作日志）
- 前端交互优化（无限滚动、骨架屏、错误边界）

### v3.0.0 — 用户体系 + 安全加固 (2026-04)
- GitHub OAuth 登录（PKCE 流程）
- 收藏夹 / 搜索历史 / 个人中心
- 安全中间件（速率限制、CSRF、输入校验）
- Cloudflare D1 数据库迁移

### v2.0.0 — MVP 上线 (2026-03)
- JAV 元数据聚合（DMM/FANZA、JavBus、JavDB）
- 磁力链接搜索（多源聚合、去重排序）
- 前后端分离架构（React + Hono）

</details>

## 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 开发规范

- 使用 **Conventional Commits** 规范提交信息
- 前端代码遵循项目现有 ESLint/Prettier 配置
- 后端代码使用 TypeScript strict 模式
- 新增搜索类别需同步更新：Provider → Service → Route → Frontend Panel → Type → DB Seed

## License

MIT License © 2024-2026 CodeSeek Team

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/codeseek-team">CodeSeek Team</a>
</p>
