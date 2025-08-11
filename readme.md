# 磁力快搜 - 专业版

一个现代化的磁力搜索工具，支持用户注册、云端同步、智能缓存等功能。采用前后端分离架构，前端部署在 Cloudflare Pages，后端部署在 Cloudflare Workers。

## ✨ 功能特色

### 🔍 智能搜索
- **多源搜索**: 同时搜索 JavBus、JavDB、JavLibrary 等多个资源站点
- **搜索缓存**: 智能缓存搜索结果，提升访问速度
- **搜索历史**: 本地和云端双重保存搜索记录
- **搜索建议**: 基于历史记录提供智能搜索建议

### 👤 用户系统
- **用户注册/登录**: 完整的用户认证系统
- **JWT认证**: 安全的token认证机制
- **会话管理**: 自动刷新token，支持长期登录
- **权限管理**: 细粒度的用户权限控制

### ⭐ 收藏管理
- **云端同步**: 收藏夹自动同步到云端
- **分类管理**: 支持标签和分类功能
- **批量操作**: 支持批量添加/删除收藏
- **离线访问**: 本地缓存确保离线访问

### 🎨 用户体验
- **响应式设计**: 完美适配桌面端和移动端
- **深色主题**: 支持浅色/深色主题切换
- **现代UI**: Material Design风格界面
- **快速加载**: 优化的资源加载和缓存策略

### 📊 数据统计
- **搜索统计**: 个人搜索数据统计分析
- **使用分析**: 用户行为数据追踪
- **性能监控**: 实时监控系统性能
- **站点状态**: 监控目标站点可用性

## 🚀 技术栈

### 前端技术
- **HTML5 + CSS3**: 语义化标签和现代CSS特性
- **Vanilla JavaScript**: 原生JavaScript，无框架依赖
- **CSS Variables**: 动态主题切换
- **Responsive Design**: 响应式布局设计
- **Progressive Web App**: PWA特性支持

### 后端技术
- **Cloudflare Workers**: 边缘计算平台
- **Cloudflare D1**: SQLite兼容的边缘数据库
- **JWT Authentication**: JSON Web Token认证
- **RESTful API**: RESTful风格API设计
- **Edge Caching**: 边缘缓存优化

### 数据库设计
- **用户管理**: users, user_sessions表
- **数据同步**: user_favorites, user_search_history表  
- **缓存系统**: search_cache表
- **行为追踪**: user_actions表
- **系统监控**: site_monitoring表

## 📁 项目结构

```
磁力快搜/
├── frontend/                 # 前端文件
│   ├── index.html           # 主页面
│   ├── login.html           # 登录页面
│   ├── dashboard.html       # 用户面板
│   ├── css/
│   │   ├── style.css        # 主样式
│   │   ├── login.css        # 登录样式
│   │   └── dashboard.css    # 面板样式
│   ├── js/
│   │   ├── main.js          # 主逻辑
│   │   ├── auth.js          # 认证模块
│   │   ├── api.js           # API调用
│   │   └── utils.js         # 工具函数
│   └── images/
│       ├── favicon.ico      # 网站图标
│       └── logo.png         # LOGO
├── backend/                 # 后端文件
│   ├── worker.js           # Worker主文件
│   ├── schema.sql          # 数据库结构
│   └── wrangler.toml       # CF配置
├── docs/                   # 文档
│   ├── README.md           # 项目说明
│   └── DEPLOY.md          # 部署指南
└── package.json           # 项目配置
```

## 🛠️ 本地开发

### 环境要求
- Node.js 18+
- npm 或 yarn
- Cloudflare账户

### 安装依赖
```bash
npm install
```

### 本地开发
```bash
# 启动前端开发服务器
npm run dev:frontend

# 启动Worker开发服务器  
npm run dev:backend

# 同时启动前后端
npm run dev
```

### 数据库初始化
```bash
# 创建D1数据库
wrangler d1 create magnet-search-db

# 执行数据库迁移
wrangler d1 execute magnet-search-db --file=./backend/schema.sql
```

## 🌐 部署指南

详细部署步骤请查看 [DEPLOY.md](./DEPLOY.md)

### 快速部署

1. **后端部署 (Cloudflare Workers)**
   ```bash
   cd backend
   wrangler deploy
   ```

2. **前端部署 (Cloudflare Pages)**
   - 连接GitHub仓库
   - 设置构建命令: `无需构建`
   - 设置输出目录: `frontend`
   - 部署即可

### 环境配置

需要设置以下环境变量:
- `JWT_SECRET`: JWT签名密钥
- `DB`: D1数据库绑定

## 📱 功能截图

### 主页面
![主页面](./docs/screenshots/homepage.png)

### 搜索结果
![搜索结果](./docs/screenshots/search-results.png)

### 用户面板
![用户面板](./docs/screenshots/dashboard.png)

## 🔧 配置说明

### API配置
在 `frontend/js/api.js` 中修改API基础URL:
```javascript
getAPIBaseURL() {
    return 'https://your-worker.your-subdomain.workers.dev';
}
```

### 数据库配置
在 `wrangler.toml` 中配置D1数据库:
```toml
[[d1_databases]]
binding = "DB"
database_name = "magnet-search-db"
database_id = "your-database-id"
```

## 🐛 问题反馈

如果您在使用过程中遇到任何问题，请通过以下方式反馈:

1. **GitHub Issues**: 在项目页面提交Issue
2. **应用内反馈**: 使用应用内的反馈功能
3. **邮件联系**: [your-email@example.com](mailto:your-email@example.com)

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🤝 贡献指南

欢迎提交Pull Request来改进项目！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 🌟 致谢

感谢以下项目和服务:
- [Cloudflare Workers](https://workers.cloudflare.com/) - 边缘计算平台
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - 边缘数据库
- [Cloudflare Pages](https://pages.cloudflare.com/) - 静态网站托管

## 📊 项目状态

- ✅ 基础功能完成
- ✅ 用户系统完成
- ✅ 数据同步完成
- ✅ 缓存系统完成
- 🔄 移动端优化进行中
- 🔄 高级搜索功能开发中
- 📋 管理后台计划中

---

**⭐ 如果这个项目对您有帮助，请给个Star支持一下！**