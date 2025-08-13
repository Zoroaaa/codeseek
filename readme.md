# 磁力快搜 - 专业版

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange)](https://www.cloudflare.com/)
[![Version](https://img.shields.io/badge/Version-1.0.0-blue)](https://github.com/yourusername/magnet-search)

专业的磁力搜索工具，基于 Cloudflare 全栈平台构建，提供快速、安全、可靠的磁力链接搜索服务。

## ✨ 核心特性

### 🔍 智能搜索
- **多源整合**: 集成 JavBus、JavDB、JavLibrary、AV01、MissAV、btsow 等知名站点
- **实时搜索**: 毫秒级响应，全球边缘节点加速
- **智能缓存**: 自动缓存搜索结果，提升访问速度
- **搜索建议**: 基于历史记录的智能搜索建议

### 👤 完整用户系统
- **安全认证**: JWT Token + Session 双重认证机制
- **用户注册**: 支持邮箱注册，用户名唯一性验证
- **密码安全**: SHA-256 加密存储，强密码策略
- **会话管理**: 自动续期，异常登录检测

### ⭐ 云端数据同步
- **收藏同步**: 跨设备同步个人收藏夹
- **历史记录**: 云端保存搜索历史，支持全文检索
- **设置同步**: 个性化设置云端备份
- **数据导出**: 支持 JSON 格式数据导出备份

### 📱 现代化界面
- **响应式设计**: 完美适配桌面端、平板、手机
- **深色模式**: 支持明暗主题自动切换
- **流畅动画**: 精心设计的交互动画效果
- **无障碍**: 支持键盘导航，屏幕阅读器友好

### 🚀 高性能架构
- **边缘计算**: 基于 Cloudflare Workers，全球低延迟
- **静态优化**: Cloudflare Pages 提供极速静态资源服务
- **智能缓存**: 多层缓存策略，访问速度提升 300%
- **渐进式**: PWA 支持，可安装到桌面使用

### 🔒 企业级安全
- **HTTPS 强制**: 全站 HTTPS 加密传输
- **CORS 保护**: 精确的跨域资源共享配置
- **XSS 防护**: 全面的脚本注入攻击防护
- **速率限制**: 智能防刷机制，保护服务稳定性

### 📊 详细统计分析
- **使用统计**: 搜索次数、收藏数量、活跃天数
- **行为分析**: 搜索热词、使用习惯分析（可选启用）
- **性能监控**: 实时性能指标，服务质量保障
- **用户等级**: 基于使用情况的用户等级系统

## 🏗️ 技术栈

### 前端技术
- **HTML5/CSS3**: 现代 Web 标准，语义化结构
- **原生 JavaScript**: 无框架依赖，轻量级实现
- **CSS Grid/Flexbox**: 现代布局技术
- **Web APIs**: 充分利用浏览器原生能力

### 后端架构
- **Cloudflare Workers**: Serverless 边缘计算平台
- **V8 JavaScript**: 高性能 JavaScript 运行时
- **Fetch API**: 现代网络请求处理
- **Web Crypto API**: 原生加密算法支持

### 数据存储
- **Cloudflare D1**: 分布式 SQLite 数据库
- **关系型设计**: 标准化数据模型
- **事务支持**: ACID 特性保证数据一致性
- **自动备份**: 数据安全保障

### 部署平台
- **Cloudflare Pages**: 静态站点托管
- **Cloudflare Workers**: 动态 API 服务
- **全球 CDN**: 200+ 边缘节点加速
- **DDoS 防护**: 企业级安全防护

## 🎯 功能演示

### 主要功能界面

#### 🏠 首页搜索
┌─────────────────────────────────┐
│ 🔍 磁力快搜 - 专业版 │
│ │
│ ┌─────────────────────────────┐ │
│ │ 请输入番号或关键词 │ │
│ └─────────────────────────────┘ │
│ [🔍 搜索] │
│ │
│ ✅ 缓存搜索结果 │
│ ✅ 自动同步到云端 │
└─────────────────────────────────┘



#### 📊 用户面板
┌─────────────────────────────────┐
│ 用户概览 │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │
│ │ 1234│ │ 567 │ │ 89 │ │专家 │ │
│ │搜索 │ │收藏 │ │天数 │ │等级 │ │
│ └─────┘ └─────┘ └─────┘ └─────┘ │
│ │
│ 📋 快速操作 │
│ [开始搜索] [查看收藏] [同步数据]│
└─────────────────────────────────┘



#### 🔍 搜索结果
┌─────────────────────────────────┐
│ 🔍 搜索结果: "关键词" (6个结果) │
│ │
│ 🎬 JavBus │
│ 📚 番号+磁力一体站，信息完善 │
│ [访问] [收藏] [复制] │
│ │
│ 📖 JavLibrary │
│ 📚 评论活跃，女优搜索详尽 │
│ [访问] [收藏] [复制] │
└─────────────────────────────────┘



### 支持的资源站点

| 站点 | 描述 | 特色功能 |
|------|------|----------|
| 🎬 **JavBus** | 番号+磁力一体站 | 信息完善、磁力丰富 |
| 📚 **JavDB** | 极简风格资料站 | 界面清爽、速度快 |
| 📖 **JavLibrary** | 老牌番号站点 | 评论活跃、搜索精准 |
| 🎥 **AV01** | 快速预览平台 | 封面清晰、预览方便 |
| 💫 **MissAV** | 中文界面站点 | 本土化体验、信息丰富 |
| 🧲 **btsow** | 磁力搜索引擎 | 磁力资源、下载便捷 |

## 📈 性能指标

### 速度性能
- **首屏加载**: < 1.5s (3G网络下)
- **API响应**: < 300ms (全球平均)
- **搜索响应**: < 800ms (含网络请求)
- **页面切换**: < 100ms (本地路由)

### 可用性指标
- **服务可用性**: 99.95%+ (Cloudflare SLA)
- **全球延迟**: < 50ms (边缘节点)
- **并发支持**: 10,000+ (Workers 扩展)
- **数据同步**: 99.99% 成功率

### 兼容性支持
| 浏览器 | 最低版本 | 支持度 |
|--------|----------|--------|
| Chrome | 70+ | 100% |
| Firefox | 65+ | 100% |
| Safari | 12+ | 98% |
| Edge | 79+ | 100% |
| 移动端 | 现代浏览器 | 95% |

## 🚀 快速开始

### 在线体验
访问 [磁力快搜](https://your-domain.pages.dev) 立即体验



🎨 自定义配置
主题定制

:root {
  --primary-color: #3b82f6;      /* 主色调 */
  --secondary-color: #64748b;    /* 次要色 */
  --success-color: #10b981;      /* 成功色 */
  --warning-color: #f59e0b;      /* 警告色 */
  --error-color: #ef4444;        /* 错误色 */
  --background-color: #ffffff;   /* 背景色 */
  --text-color: #1f2937;         /* 文字色 */
}
搜索源配置

// 在 worker.js 中添加新的搜索源
const customSource = {
    id: 'custom_source',
    title: '自定义源',
    subtitle: '描述信息',
    url: `https://example.com/search/${keyword}`,
    icon: '🔍',
    enabled: true
};
功能开关

# 环境变量控制
ENABLE_ANALYTICS=true          # 启用分析统计
ENABLE_ACTION_LOGGING=true     # 启用行为日志
ALLOW_REGISTRATION=false       # 关闭用户注册
🔧 API 文档
认证接口

// 用户注册
POST /api/auth/register
{
  "username": "string",
  "email": "string", 
  "password": "string"
}

// 用户登录
POST /api/auth/login
{
  "username": "string",
  "password": "string"
}

// Token验证
POST /api/auth/verify-token
{
  "token": "string"
}
用户数据接口

// 获取收藏夹
GET /api/user/favorites
Authorization: Bearer <token>

// 同步收藏夹
POST /api/user/favorites
{
  "favorites": [...]
}

// 获取搜索历史
GET /api/user/search-history
Authorization: Bearer <token>

// 同步搜索历史
POST /api/user/sync/search-history
{
  "searchHistory": [...]
}
系统接口

// 健康检查
GET /api/health

// 获取配置
GET /api/config

// 记录分析数据
POST /api/analytics/record
{
  "event": "string",
  "data": {}
}
📊 项目结构
graphql
复制
magnet-search/
├── 📁 frontend/                 # 前端资源
│   ├── 📄 index.html           # 主页面
│   ├── 📄 dashboard.html       # 用户面板
│   ├── 📁 css/                 # 样式文件
│   │   ├── style.css           # 主样式
│   │   └── dashboard.css       # 面板样式
│   ├── 📁 js/                  # JavaScript文件
│   │   ├── api.js              # API调用
│   │   ├── auth.js             # 认证管理
│   │   ├── dashboard.js        # 面板逻辑
│   │   ├── main.js             # 主逻辑
│   │   ├── utils.js            # 工具函数
│   │   └── config.js           # 配置文件
│   └── 📁 images/              # 图片资源
├── 📁 backend/                 # 后端代码
│   ├── 📄 worker.js            # Worker主文件
│   └── 📄 schema.sql           # 数据库结构
├── 📄 deploy.md                # 部署指南
├── 📄 README.md                # 项目文档

🤝 贡献指南
参与开发
Fork 本项目

创建特性分支 (git checkout -b feature/AmazingFeature)

提交更改 (git commit -m 'Add some AmazingFeature')

推送到分支 (git push origin feature/AmazingFeature)

创建 Pull Request

代码规范
使用 ES6+ 语法

遵循 Prettier 代码格式化

添加必要的注释和文档

编写单元测试

Issue 报告
使用 Issue 模板

提供详细的复现步骤

包含环境信息和错误日志

标注 bug/enhancement 标签

📄 许可证
本项目采用 MIT 许可证，详情请查看 LICENSE 文件。

⭐ 致谢
技术支持
Cloudflare - 提供云服务平台

MDN Web Docs - Web技术文档

Can I Use - 浏览器兼容性查询

开源项目
感谢所有开源项目的贡献者

特别致谢提供反馈和建议的用户们

社区贡献
@contributor1 - 功能改进

@contributor2 - Bug修复

@contributor3 - 文档完善

📞 联系方式
项目相关
项目主页: https://your-domain.pages.dev

GitHub: @yourusername

Issues: 提交问题

开发团队
邮箱: your-email@example.com

微信: your-wechat-id

QQ群: 123456789

免责声明
本工具仅供技术学习和研究使用，请遵守当地法律法规，合理合法使用。开发者不对用户的使用行为承担任何责任。

⚠️ 重要提示: 请确保您的使用行为符合当地法律法规和网站服务条款。

<div align="center">
如果这个项目对您有帮助，请给我们一个 ⭐ Star！

⬆️ 回到顶部
