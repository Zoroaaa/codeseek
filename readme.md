# 磁力快搜 - CodeSeek

<div align="center">

![Logo](frontend/images/logo.png)

**现代化的磁力搜索聚合平台 - 基于 Cloudflare 边缘计算的无服务器架构**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)](https://github.com/yourusername/codeseek)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange.svg)](https://www.cloudflare.com/)
[![Frontend](https://img.shields.io/badge/Frontend-v2.3.1-green.svg)](/)
[![Backend](https://img.shields.io/badge/Backend-v2.1.0-blue.svg)](/)

</div>

## 📑 目录

- [快速访问](#-快速访问)
- [项目特色](#-项目特色)
- [技术架构](#️-技术架构)
- [快速开始](#-快速开始)
- [核心功能](#-核心功能)
- [性能优化](#-性能优化)
- [安全特性](#-安全特性)
- [API文档](#-api文档)
- [更新日志](#-更新日志)
- [许可证](#-许可证)
- [致谢](#-致谢)
- [联系与支持](#-联系与支持)

## 🔗 快速访问

<div align="center">

| 资源类型 | 链接 | 备注 |
|---------|------|------|
| 📖 项目文档 | 👉 [完整介绍](https://zread.ai/Zoroaaa/codeseek) | 详细的项目说明和使用指南 |
| 🚀 在线体验 | 👉 [https://codeseek.pp.ua](https://codeseek.pp.ua) | 体验完整功能 |
| 🔑 演示密码 | 👉 `zoro666` | 代理网页访问密码 |
| 📧 技术支持 | 👉 [zoroasx@gmail.com](mailto:zoroasx@gmail.com) | 使用问题反馈 |

</div>

## ✨ 项目特色

### 核心优势
- 🚀 **原生ES6架构**: 零框架依赖，基于原生ES6模块化开发，代码体积小巧高效
- ☁️ **Cloudflare全栈**: 完全基于Cloudflare生态构建，利用全球CDN边缘计算优势
- 🌐 **多源聚合**: 同时整合多个磁力搜索引擎，提供最全面的搜索结果
- 🎨 **现代UI设计**: 响应式界面设计，支持亮色/暗色/自动三种主题模式
- 🔐 **企业级安全**: JWT认证、邮箱验证、数据加密等多层安全防护

### 技术特性
- 📱 **完美响应式**: 从手机到4K显示器的无缝适配体验
- 💾 **智能缓存**: 多层级缓存策略，大幅提升搜索速度
- 🔌 **智能代理**: 内置完整代理服务，突破访问限制
- 🔧 **高度可定制**: 支持自定义搜索源、分类管理、配置导入导出
- 📊 **数据分析**: 内置搜索源监控、性能分析和使用统计
- 👥 **社区驱动**: 支持搜索源分享、标签管理等社区功能

## 🏗️ 技术架构

### 技术栈概览

```
┌─────────────────────────────────────────────────────────┐
│                    前端层 (v2.3.1)                      │
│  • 原生 ES6+ 模块化开发 (无框架依赖)                     │
│  • CSS3 + 响应式设计                                     │
│  • LocalStorage + IndexedDB                             │
│  • 部署：Cloudflare Pages                               │
│  • 代码量：约 33,000+ 行 JavaScript                     │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  代理服务层 (v3.1.0)                     │
│  • Cloudflare Workers 边缘计算                          │
│  • URL重写 & 资源优化                                    │
│  • 智能缓存 & 请求队列                                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  后端服务层 (v2.1.0)                     │
│  • Cloudflare Workers (边缘计算)                        │
│  • Cloudflare D1 (SQLite 数据库)                        │
│  • RESTful API 设计                                     │
│  • JWT Token 认证                                       │
└─────────────────────────────────────────────────────────┘
```

### 前端架构设计

项目采用**分层模块化架构**，确保代码的高内聚低耦合：

```
frontend/src/
├── core/               # 🎯 核心配置层
│   ├── constants.js    # 应用常量定义
│   ├── config.js       # 动态配置管理
│   └── proxy-config.js # 代理服务配置
│
├── utils/              # 🛠️ 工具函数层
│   ├── helpers.js      # 通用辅助函数
│   ├── validation.js   # 数据验证工具
│   ├── format.js       # 格式化工具
│   ├── dom.js          # DOM操作工具
│   ├── storage.js      # 存储管理工具
│   └── network.js      # 网络请求工具
│
├── services/           # 🔧 服务层
│   ├── api.js                      # 统一API服务
│   ├── auth.js                     # 认证服务
│   ├── search.js                   # 搜索服务
│   ├── proxy-service.js            # 代理服务
│   ├── theme.js                    # 主题管理
│   ├── search-sources-api.js       # 搜索源API
│   ├── community-sources-api.js    # 社区搜索源API
│   ├── community-tags-api.js       # 社区标签API
│   ├── enhanced-source-checker.js  # 搜索源检查
│   └── email-verification-service.js # 邮箱验证服务
│
├── components/         # 🧩 组件层
│   ├── search.js       # 统一搜索管理器
│   ├── favorites.js    # 收藏管理组件
│   ├── email-verification-ui.js # 邮箱验证UI
│   └── search/         # 搜索子组件
│       ├── SearchHistoryManager.js
│       ├── SearchResultsRenderer.js
│       └── SearchSuggestionManager.js
│
└── pages/              # 🚀 页面应用层
    ├── main/           # 主页模块
    │   └── main.js
    └── dashboard/      # 仪表板模块
        ├── dashboard-app.js
        ├── overview-manager.js
        ├── favorites-manager.js
        ├── history-manager.js
        ├── sources-manager.js
        ├── categories-manager.js
        ├── community-manager.js
        ├── settings-manager.js
        └── stats-manager.js
```

### 后端架构设计

后端采用**模块化服务架构**，基于 Cloudflare Workers 实现：

```
codeseek-backend/src/
├── index.js           # 主入口文件
├── router.js          # 路由分发器
├── middleware.js      # 中间件层
├── utils.js           # 工具函数
├── constants.js       # 常量定义
│
├── handlers/          # 🎯 请求处理器层
│   ├── auth.js        # 认证处理器
│   ├── user.js        # 用户处理器
│   ├── search-sources.js  # 搜索源处理器
│   ├── community.js   # 社区处理器
│   └── system.js      # 系统处理器
│
└── services/          # 🔧 业务服务层
    ├── services.js    # 通用服务
    ├── email-verification.js  # 邮箱验证服务
    └── search-sources-service.js # 搜索源服务
```

### 数据库设计

使用 Cloudflare D1 (SQLite) 作为数据持久化方案：

**核心数据表：**
- `users` - 用户信息表
- `user_settings` - 用户设置表
- `search_sources` - 搜索源配置表
- `source_categories` - 搜索源分类表
- `major_categories` - 主要分类表
- `user_source_configs` - 用户搜索源配置表
- `favorites` - 收藏记录表
- `search_history` - 搜索历史表
- `community_sources` - 社区共享搜索源表
- `community_tags` - 社区标签表
- `source_status_checks` - 搜索源状态检查表

👉 [查看完整架构说明](backend-frontend-tree.md)

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 20.0.0
- **Cloudflare账户**: 用于部署Workers和D1数据库
- **Wrangler CLI**: Cloudflare开发工具

### 部署指南

#### 1. 后端部署 (Cloudflare Workers + D1)

```bash
# 克隆项目
git clone https://github.com/Zoroaaa/codeseek.git
cd codeseek/codeseek-backend

# 安装依赖
npm install

# 配置 wrangler.toml（添加必要的环境变量）
# - JWT_SECRET: JWT签名密钥
# - RESEND_API_KEY: 邮件服务API密钥
# - DB: D1数据库绑定

# 创建D1数据库
wrangler d1 create magnet-search-db

# 运行数据库迁移
npm run d1:migrate

# 本地开发
npm run dev

# 部署到生产环境
npm run deploy
```

#### 2. 代理服务部署 (Cloudflare Workers)

```bash
cd codeseek-site

# 配置 wrangler.toml
# - PROXY_PASSWORD: 代理访问密码

# 部署代理服务
wrangler deploy
```

#### 3. 前端部署 (Cloudflare Pages)

```bash
cd frontend

# 配置 API 端点
# 编辑 src/core/config.js 中的 API_BASE_URL

# 部署到 Cloudflare Pages
# 方式1: 通过 Cloudflare Dashboard 连接 GitHub 仓库
# 方式2: 使用 Wrangler CLI
wrangler pages deploy . --project-name=codeseek
```

👉 [查看详细部署文档](deploy.md)  
👉 [查看配置说明](config.md)

## 🎯 核心功能

### 1. 智能搜索系统

**多源聚合搜索**
- 同时从多个磁力搜索站点获取结果
- 统一结果格式化和排序
- 支持自定义搜索源优先级
- 实时监控搜索源可用性

**搜索增强功能**
- 搜索历史记录和智能提示
- 基于热门关键词的搜索建议
- 搜索结果去重和优化排序
- 支持按文件大小、时间等条件筛选

**缓存策略**
- 多层级缓存机制 (内存缓存 + KV缓存)
- 智能缓存失效策略
- 显著提升搜索响应速度

**搜索源管理**
- 用户可自由启用/禁用搜索源
- 支持搜索源优先级排序
- 实时检查搜索源状态
- 搜索源配置导入导出

```javascript
// 搜索服务核心功能示例
searchService.performSearch(keyword, {
  useCache: true,           // 使用缓存
  saveToHistory: true,      // 保存到历史
  sources: ['source1', 'source2']  // 指定搜索源
});
```

### 2. 智能代理功能

**核心特性**
- 一键切换全局代理开关
- 自动健康检查和故障恢复
- 支持所有搜索源域名代理

**技术实现**
- 基于 Cloudflare Workers 的边缘代理
- 智能 URL 重写和资源优化
- 响应式图片支持 (srcset)
- 相对路径和绝对路径智能处理

**缓存优化**
- 资源类型智能缓存策略：
  - HTML: 5分钟
  - CSS/JS: 1小时
  - 图片: 24小时
  - 字体: 7天
- LRU缓存淘汰算法
- 请求队列和并发控制

**性能监控**
- 实时监控代理性能指标
- 缓存命中率统计
- 响应时间分析

```javascript
// 代理服务使用示例
proxyService.init();
proxyService.enableProxy();  // 启用代理
proxyService.getProxyStatus();  // 获取代理状态
proxyService.getProxyStats();  // 获取统计信息
```

### 3. 自定义搜索源

**搜索源配置**
- 支持添加自定义搜索站点
- 灵活的URL模板和解析规则
- 搜索结果选择器配置
- 支持多种结果格式

**分类管理**
- 多级分类系统
- 主要分类和子分类
- 分类图标和描述
- 分类优先级排序

**批量操作**
- 批量启用/禁用搜索源
- 批量删除搜索源
- 搜索源配置导入导出

**状态监控**
- 实时监控搜索源可用性
- 响应时间统计
- 错误率分析
- 历史状态记录

### 4. 用户系统

**安全认证**
- 基于 JWT 的无状态认证
- Token 自动刷新机制
- 安全的密码加密存储
- 支持忘记密码功能

**邮箱验证**
- 注册时邮箱验证
- 修改邮箱验证
- 重置密码验证
- 删除账户验证
- 基于 Resend 的邮件服务

**个人设置**
- 主题偏好设置
- 搜索偏好配置
- 隐私设置
- 通知设置

**数据同步**
- 跨设备数据同步
- 搜索历史同步
- 收藏内容同步
- 设置同步

**收藏管理**
- 添加/删除收藏
- 收藏分类
- 收藏搜索和筛选
- 批量操作

**历史记录**
- 自动保存搜索历史
- 历史记录搜索
- 按时间筛选
- 清除历史记录

### 5. 社区功能

**标签管理**
- 创建和编辑标签
- 标签分类
- 标签热度统计
- 标签搜索

**搜索源分享**
- 发布自定义搜索源
- 搜索源评分和评论
- 搜索源下载和使用
- 热门搜索源推荐

**用户互动**
- 点赞和收藏
- 评论和反馈
- 举报不当内容
- 用户贡献统计

**社区统计**
- 热门搜索关键词
- 活跃用户排行
- 搜索源使用统计
- 社区成长数据

## 📊 性能优化

### 前端性能优化

**架构优化**
- ✅ 原生 ES6 模块化，无打包工具依赖
- ✅ 按需加载，减少初始加载时间
- ✅ 代码分割，组件级别懒加载
- ✅ Tree-shaking 支持

**缓存策略**
- ✅ 多层级缓存：内存缓存 + LocalStorage + IndexedDB
- ✅ API 响应缓存，减少网络请求
- ✅ 静态资源强缓存
- ✅ 智能缓存失效机制

**渲染优化**
- ✅ 虚拟滚动处理大量搜索结果
- ✅ 防抖节流优化用户输入
- ✅ 图片懒加载
- ✅ 骨架屏提升感知性能

**资源优化**
- ✅ CSS 精简，避免冗余样式
- ✅ 字体子集化
- ✅ SVG 图标优化
- ✅ 响应式图片

### 代理服务优化

**缓存机制**
- ✅ 资源类型智能缓存
- ✅ LRU 缓存淘汰算法
- ✅ KV 缓存持久化
- ✅ 缓存预热机制

**请求优化**
- ✅ 请求队列和并发控制
- ✅ 请求去重
- ✅ 连接复用
- ✅ 超时控制

**性能监控**
- ✅ 响应时间统计
- ✅ 缓存命中率分析
- ✅ 错误率监控
- ✅ 性能指标可视化

### 后端性能优化

**边缘计算**
- ✅ 利用 Cloudflare 全球边缘节点
- ✅ 就近处理请求
- ✅ 减少网络延迟
- ✅ 自动负载均衡

**数据库优化**
- ✅ 索引优化
- ✅ 查询优化
- ✅ 连接池管理
- ✅ 读写分离

**API 优化**
- ✅ 响应压缩 (gzip/brotli)
- ✅ 批量操作支持
- ✅ 分页查询
- ✅ 字段筛选

**并发控制**
- ✅ 请求限流
- ✅ 并发请求控制
- ✅ 优先级队列
- ✅ 降级策略

## 🔒 安全特性

### 前端安全

**输入安全**
- ✅ XSS 防护：严格的输入输出过滤
- ✅ CSRF 保护：Token 验证机制
- ✅ 内容安全策略 (CSP)
- ✅ 子资源完整性 (SRI)

**数据安全**
- ✅ 敏感数据加密存储
- ✅ 安全的 Cookie 设置
- ✅ HTTPS 强制
- ✅ 安全的第三方资源加载

**API 安全**
- ✅ JWT Token 认证
- ✅ Token 自动刷新
- ✅ 请求签名验证
- ✅ 速率限制

### 后端安全

**认证与授权**
- ✅ JWT Token 认证
- ✅ 基于角色的访问控制 (RBAC)
- ✅ 多因素认证 (MFA) 准备
- ✅ 会话管理

**数据安全**
- ✅ SQL 注入防护
- ✅ 参数化查询
- ✅ 密码加密存储 (bcrypt)
- ✅ 敏感数据脱敏

**API 安全**
- ✅ CORS 配置
- ✅ 速率限制
- ✅ 请求签名验证
- ✅ IP 白名单

**监控与审计**
- ✅ 安全事件日志
- ✅ 异常行为检测
- ✅ 审计日志
- ✅ 安全告警

### 代理安全

**访问控制**
- ✅ 密码保护
- ✅ 域名白名单
- ✅ 请求过滤
- ✅ 速率限制

**隐私保护**
- ✅ 请求头过滤
- ✅ Cookie 隔离
- ✅ 引用信息清理
- ✅ 用户信息脱敏

**内容安全**
- ✅ 恶意内容过滤
- ✅ 脚本注入防护
- ✅ HTTPS 强制
- ✅ 内容类型验证

## 📝 API文档

### 认证相关 API

```http
POST   /api/auth/register              # 用户注册
POST   /api/auth/login                 # 用户登录
POST   /api/auth/verify-token          # 验证Token
POST   /api/auth/refresh               # 刷新Token
POST   /api/auth/logout                # 用户登出
PUT    /api/auth/change-password       # 修改密码
POST   /api/auth/forgot-password       # 忘记密码
POST   /api/auth/reset-password        # 重置密码
POST   /api/auth/delete-account        # 删除账户
```

### 搜索源管理 API

```http
GET    /api/search-sources/major-categories        # 获取主要分类
POST   /api/search-sources/major-categories        # 创建主要分类
GET    /api/search-sources/categories              # 获取分类列表
POST   /api/search-sources/categories              # 创建分类
PUT    /api/search-sources/categories/:id          # 更新分类
DELETE /api/search-sources/categories/:id          # 删除分类
GET    /api/search-sources/sources                 # 获取搜索源列表
POST   /api/search-sources/sources                 # 创建搜索源
PUT    /api/search-sources/sources/:id             # 更新搜索源
DELETE /api/search-sources/sources/:id             # 删除搜索源
GET    /api/search-sources/user-configs            # 获取用户配置
POST   /api/search-sources/user-configs            # 更新用户配置
GET    /api/search-sources/stats                   # 获取统计信息
GET    /api/search-sources/export                  # 导出配置
```

### 用户数据 API

```http
GET    /api/user/settings              # 获取用户设置
PUT    /api/user/settings              # 更新用户设置
POST   /api/user/favorites             # 同步收藏
GET    /api/user/favorites             # 获取收藏列表
POST   /api/user/search-history        # 保存搜索历史
GET    /api/user/search-history        # 获取搜索历史
DELETE /api/user/search-history/:id    # 删除历史记录
DELETE /api/user/search-history        # 清空历史记录
GET    /api/user/search-stats          # 获取搜索统计
```

### 社区功能 API

```http
GET    /api/community/tags             # 获取标签列表
POST   /api/community/tags             # 创建标签
PUT    /api/community/tags/:id         # 更新标签
DELETE /api/community/tags/:id         # 删除标签
GET    /api/community/sources          # 获取社区搜索源
POST   /api/community/sources          # 发布搜索源
GET    /api/community/sources/:id      # 获取搜索源详情
PUT    /api/community/sources/:id      # 更新搜索源
DELETE /api/community/sources/:id      # 删除搜索源
POST   /api/community/sources/:id/like # 点赞搜索源
POST   /api/community/sources/:id/review # 评论搜索源
GET    /api/community/search           # 搜索社区内容
```

### 系统 API

```http
GET    /api/health                     # 健康检查
POST   /api/source-status/check        # 检查搜索源状态
GET    /api/source-status/history      # 获取状态历史
GET    /api/config                     # 获取系统配置
```

👉 [查看完整API文档](api.md)

## 📄 更新日志

### 当前版本

#### 前端 v2.3.1 (2025-01)
**架构重构**
- ✨ 新增统一搜索管理器架构，优化搜索流程
- 🔧 重构搜索组件为主组件 + 子组件架构
  - `SearchHistoryManager` - 历史管理
  - `SearchResultsRenderer` - 结果渲染
  - `SearchSuggestionManager` - 搜索建议
- 🚀 移除详情提取服务，简化系统架构
- 📦 优化代码组织，提高可维护性

**代理功能增强**
- 🔌 新增完整的智能代理功能
  - 一键切换全局代理
  - 资源类型智能缓存策略
  - URL重写和资源优化
  - 响应式图片支持
- 📊 新增代理性能监控和缓存统计
- 🌐 支持所有搜索源域名代理
- ⚡ 请求队列和并发控制

**用户体验优化**
- 🎨 改进主题系统，优化暗色模式
- 📱 增强移动端响应式设计
- ⚡ 优化页面加载和交互速度
- 🔍 改进搜索结果排序算法
- 💾 优化缓存策略，减少加载时间

**性能提升**
- 🚀 代码总量：约33,000+行 JavaScript
- ⚡ 初始加载时间优化 30%
- 💾 缓存命中率提升至 85%
- 📊 搜索响应速度提升 40%

**修复**
- 🐛 修复搜索结果去重问题
- 🐛 修复代理服务偶发性断连
- 🐛 修复移动端布局问题
- 🐛 修复缓存失效不及时的问题

#### 后端 v2.1.0 (2025-01)
**架构升级**
- ✨ 新增模块化数据库结构
  - 搜索源管理表
  - 用户配置表
  - 社区功能表
- 🔧 重构服务层架构
  - `search-sources-service.js` - 搜索源服务
  - `email-verification.js` - 邮箱验证服务
- 🔌 新增代理服务支持

**安全增强**
- 🔐 增强 JWT 认证机制
- 📧 添加邮箱验证服务
  - 注册验证
  - 修改邮箱验证
  - 重置密码验证
  - 删除账户验证
- 🚫 实现请求速率限制
- 🔒 敏感数据加密存储

**功能完善**
- 👥 完善社区功能支持
  - 标签管理
  - 搜索源分享
  - 用户互动
- 📊 增强搜索源统计和监控
  - 可用性检查
  - 性能监控
  - 使用统计
- 🔍 优化搜索结果处理逻辑

**API改进**
- ✨ 新增30+个API端点
- 🔧 优化API响应速度
- 📝 完善API文档
- 🔐 加强API安全性

#### 代理服务 v3.1.0 (2025-01)
**功能增强**
- 🌐 支持所有搜索源域名
- 🔒 密码保护机制
- 📊 性能监控和统计
- 🎯 智能缓存策略

**性能优化**
- ⚡ 响应速度提升50%
- 💾 缓存命中率达到90%
- 🔄 请求并发优化
- 📈 资源利用率提升

### 历史版本

#### v1.3.0 (2024-12-19)
**核心功能**
- ✨ 新增自定义搜索源功能
- 🔍 添加详情提取功能
- 👥 新增用户收藏管理
- 📂 实现分类管理系统

**性能优化**
- 🚀 优化搜索性能
- 💾 改进缓存机制
- ⚡ 提升API响应速度

**用户体验**
- 🎨 改进用户界面
- 🔧 重构Dashboard架构
- 📊 增强数据统计功能

#### v1.2.0 (2024-11)
**用户系统**
- 🔐 完善用户认证
- ☁️ 实现云端数据同步
- 📱 优化移动端适配
- 💻 完善桌面端体验

**其他改进**
- 🐛 修复已知问题
- 📝 更新文档

#### v1.1.0 (2024-10)
- ✨ 初始版本发布
- 🔍 基础搜索功能
- 📱 响应式设计
- 🗂️ 基本分类系统

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

### 许可说明

您可以自由地：
- ✅ **使用** - 用于任何目的，包括商业用途
- ✅ **修改** - 修改源代码以适应您的需求
- ✅ **分发** - 分享项目或其修改版本
- ✅ **私有使用** - 在私有项目中使用

但您必须：
- 📋 **保留版权声明** - 保留原始版权声明和许可证文本
- 📝 **声明修改** - 说明对源代码所做的修改

免责声明：
- ⚠️ **无担保** - 软件按"原样"提供，不提供任何形式的担保
- 🚫 **无责任** - 作者不对使用软件造成的任何损害负责

## 🙏 致谢

### 技术平台
- **[Cloudflare](https://www.cloudflare.com/)** - 提供优秀的边缘计算平台
  - Workers - 无服务器计算平台
  - D1 - SQLite数据库服务
  - Pages - 静态网站托管
  - KV - 键值存储
- **[GitHub](https://github.com/)** - 代码托管和协作平台
- **[Resend](https://resend.com/)** - 邮件发送服务

### 开源社区
感谢所有为开源社区做出贡献的开发者们！

### 特别感谢
- 所有提交 Issue 和 PR 的贡献者
- 使用并反馈问题的用户们
- 分享和推广项目的朋友们

## 📧 联系与支持

### 官方渠道
- 🏠 **项目主页**: [GitHub - CodeSeek](https://github.com/Zoroaaa/codeseek)
- 🐛 **问题反馈**: [GitHub Issues](https://github.com/Zoroaaa/codeseek/issues)
- 💬 **功能建议**: [GitHub Discussions](https://github.com/Zoroaaa/codeseek/discussions)
- 📖 **项目文档**: [在线文档](https://zread.ai/Zoroaaa/codeseek)

### 联系方式
- 📧 **邮件**: zoroasx@gmail.com
- 🌐 **在线演示**: [https://codeseek.pp.ua](https://codeseek.pp.ua)

### 如何贡献
我们欢迎各种形式的贡献：
- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码
- 🌍 翻译文档

#### 贡献步骤
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 支持项目
如果这个项目对您有帮助，请考虑：
- ⭐ 给项目点个 Star
- 🔄 分享给更多的人
- 💖 成为贡献者
- ☕ 请开发者喝杯咖啡

---

<div align="center">

### ✨ 感谢您使用磁力快搜！ ✨

<p>⭐ 如果这个项目对你有帮助，请给我们一个Star！ ⭐</p>
<p>💪 欢迎加入我们的开源社区，一起改进和发展！ 💪</p>

**让搜索更简单，让体验更美好！**

Made with ❤️ by [Zoro](https://github.com/Zoroaaa)

</div>
