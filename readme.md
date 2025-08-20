# 磁力快搜 - 专业版

<div align="center">

![Logo](images/logo.png)

**一个现代化的磁力搜索聚合平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/yourusername/magnet-search)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange.svg)](https://www.cloudflare.com/)

</div>

## ✨ 项目特色

- 🚀 **现代化架构**: 基于ES6模块化开发，无框架依赖
- 🌐 **多搜索源聚合**: 支持15+主流磁力搜索站点
- 🔧 **高度可定制**: 自定义搜索源和分类管理
- ☁️ **云端同步**: 基于Cloudflare生态的数据同步
- 📱 **响应式设计**: 完美适配桌面和移动设备
- 🎨 **主题切换**: 支持亮色/暗色/自动主题
- 📊 **数据统计**: 详细的使用统计和分析

## 🏗️ 技术架构

### 前端技术栈
- **核心**: 原生JavaScript ES6+ 模块化
- **样式**: CSS3 + 响应式设计
- **存储**: LocalStorage + IndexedDB
- **部署**: Cloudflare Pages

### 后端技术栈
- **运行时**: Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT Token
- **API**: RESTful 风格

### 项目结构
```
magnet-search-app/
├── 📄 index.html                  # 主搜索页面
├── 📄 dashboard.html              # 用户仪表板
├── 📁 src/                        # ES6源码目录
│   ├── 📁 core/                   # 核心配置层
│   ├── 📁 utils/                  # 工具函数层
│   ├── 📁 services/               # 服务层
│   ├── 📁 components/             # 组件层
│   └── 📁 pages/                  # 页面应用层
├── 📁 css/                        # 样式文件
├── 📁 images/                     # 静态资源
└── 📄 worker.js                   # Cloudflare Worker后端
```

## 🚀 快速开始

### 环境要求
- Node.js 16+ (开发环境)
- Cloudflare 账户
- Git

### 本地开发
```bash
# 克隆项目
git clone https://github.com/yourusername/magnet-search.git
cd magnet-search

# 启动本地服务器
npx http-server . -p 3000

# 或使用Live Server扩展（推荐）
```

### 部署到Cloudflare

#### 前端部署 (Cloudflare Pages)
1. 连接GitHub仓库到Cloudflare Pages
2. 构建设置：
   - 框架预设：`None`
   - 构建命令：`echo "Static site"`
   - 构建输出目录：`/`

#### 后端部署 (Cloudflare Workers)
```bash
# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler auth login

# 创建D1数据库
wrangler d1 create magnet-search-db

# 部署Worker
wrangler deploy
```

#### 环境变量配置
在Cloudflare Workers中设置以下环境变量：
```
JWT_SECRET=your-super-secret-key
APP_VERSION=1.3.0
ENABLE_ACTION_LOGGING=true
MAX_FAVORITES_PER_USER=1000
MAX_HISTORY_PER_USER=1000
```

### 数据库初始化
```bash
# 运行数据库迁移
wrangler d1 execute magnet-search-db --file=./schema.sql
```

## 🎯 核心功能

### 1. 智能搜索系统
- **多源聚合**: 同时搜索15+主流站点
- **结果缓存**: 智能缓存提升搜索速度
- **搜索建议**: 基于历史的智能提示
- **源管理**: 可自由启用/禁用搜索源

### 2. 自定义搜索源
- **源配置**: 支持添加自定义搜索站点
- **分类管理**: 自定义搜索源分类
- **模板系统**: 灵活的URL模板配置
- **批量操作**: 批量启用/禁用搜索源

### 3. 收藏系统
- **云端同步**: 收藏数据云端存储
- **分类整理**: 按关键词自动分类
- **搜索过滤**: 收藏内容快速搜索
- **批量管理**: 批量导入/导出功能

### 4. 用户系统
- **安全认证**: JWT基础的安全认证
- **个人设置**: 丰富的个性化配置
- **数据同步**: 跨设备数据同步
- **隐私保护**: 本地优先的隐私策略

### 5. 数据统计
- **使用分析**: 详细的搜索行为分析
- **趋势图表**: 可视化的数据趋势
- **热门统计**: 热门关键词和搜索源
- **活动热力图**: 用户活动时间分布

## 🔧 配置说明

### 前端配置
在`src/core/config.js`中配置API地址：
```javascript
const config = {
  BASE_URL: 'https://your-worker.your-subdomain.workers.dev',
  DEV_URL: 'http://localhost:8787',
  PROD_URL: 'https://your-production-api.com'
}
```

### 搜索源配置
在`src/core/constants.js`中管理内置搜索源：
```javascript
SEARCH_SOURCES: [
  {
    id: 'custom-site',
    name: '自定义站点',
    urlTemplate: 'https://example.com/search?q={keyword}',
    category: 'database',
    icon: '🔍'
  }
]
```

## 📊 性能优化

### 前端优化
- **模块化加载**: ES6模块按需加载
- **缓存策略**: 多层次缓存机制
- **响应式图片**: 适配不同屏幕尺寸
- **代码压缩**: 生产环境代码压缩

### 后端优化
- **边缘计算**: Cloudflare全球边缘节点
- **数据库优化**: 索引优化和查询优化
- **连接池**: 数据库连接复用
- **缓存层**: Redis兼容的KV存储

## 🔒 安全特性

- **XSS防护**: 输入输出严格过滤
- **CSRF保护**: Token验证机制
- **SQL注入防护**: 参数化查询
- **访问控制**: 基于角色的权限管理
- **数据加密**: 敏感数据加密存储

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration

# 生成测试覆盖率报告
npm run test:coverage
```

## 📝 API文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/verify-token` - Token验证
- `POST /api/auth/logout` - 用户登出

### 用户数据接口
- `GET /api/user/settings` - 获取用户设置
- `PUT /api/user/settings` - 更新用户设置
- `GET /api/user/favorites` - 获取收藏列表
- `POST /api/user/favorites` - 同步收藏数据

### 搜索接口
- `GET /api/user/search-history` - 获取搜索历史
- `POST /api/user/search-history` - 保存搜索记录
- `DELETE /api/user/search-history/:id` - 删除历史记录
- `GET /api/user/search-stats` - 获取搜索统计

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 代码规范
- 使用ES6+现代JavaScript语法
- 遵循ESLint规则
- 保持代码注释完整
- 单元测试覆盖率>80%

## 📋 更新日志

### v1.3.0 (2024-12-19)
- ✨ 新增自定义搜索源和分类管理
- 🚀 优化搜索性能和缓存机制
- 🎨 改进用户界面和交互体验
- 🔧 重构Dashboard架构，提升可维护性
- 📊 增强数据统计和可视化功能

### v1.2.0
- 🔐 完善用户认证和安全机制
- ☁️ 实现云端数据同步功能
- 📱 优化移动端适配
- 🐛 修复若干已知问题

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

- [Cloudflare](https://www.cloudflare.com/) - 提供优秀的边缘计算平台
- [各搜索站点](docs/SOURCES.md) - 提供丰富的搜索资源
- 所有贡献者和用户的支持

## 📧 联系方式

- 项目主页: [https://github.com/yourusername/magnet-search](https://github.com/yourusername/magnet-search)
- 问题反馈: [Issues](https://github.com/yourusername/magnet-search/issues)
- 功能建议: [Discussions](https://github.com/yourusername/magnet-search/discussions)

---

<div align="center">
<p>⭐ 如果这个项目对你有帮助，请给我们一个Star！⭐</p>
</div>