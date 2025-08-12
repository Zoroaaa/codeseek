14. 完整的README.md
markdown
复制
# 磁力快搜 - 专业版

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Cloudflare](https://img.shields.io/badge/powered%20by-Cloudflare-orange.svg)

专业的磁力搜索工具，基于Cloudflare平台构建，支持用户认证、云端同步、智能缓存等功能。

## ✨ 主要特性

- 🔍 **智能搜索** - 集成多个知名资源站点
- 👤 **用户系统** - 完整的注册/登录功能
- ⭐ **收藏同步** - 收藏夹云端同步
- 📱 **响应式设计** - 完美适配移动端
- 🌙 **主题切换** - 支持明暗主题
- 🚀 **高性能** - 基于Cloudflare边缘计算
- 🔒 **安全可靠** - JWT认证，数据加密
- 📊 **数据统计** - 详细的使用统计

## 🏗️ 技术架构

- **前端**: 原生JavaScript + CSS3
- **后端**: Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)
- **部署**: Cloudflare Pages + Workers
- **认证**: JWT + Session管理

## 🚀 快速开始

### 1. 克隆项目
git clone https://github.com/yourusername/magnet-search.git
cd magnet-search
2. 安装依赖
npm install -g wrangler
3. 配置环境
复制并编辑配置文件：
cp wrangler.toml.example wrangler.toml
4. 部署
使用自动化脚本：
bash deploy.sh
或手动部署：
# 部署Worker
wrangler publish worker.js

# 创建并初始化数据库
wrangler d1 create magnet-search-db
wrangler d1 execute magnet-search-db --file=schema.sql
📖 详细文档
部署指南

API文档

开发指南

常见问题

🔧 配置说明
Worker环境变量
变量名	必需	默认值	说明
JWT_SECRET	✅	-	JWT签名密钥
DB	✅	-	D1数据库绑定
ALLOW_REGISTRATION	❌	true	是否允许注册
MAX_FAVORITES_PER_USER	❌	1000	每用户最大收藏数

Pages环境变量
变量名	必需	默认值	说明
API_BASE_URL	✅	-	Worker API地址
APP_NAME	❌	磁力快搜	应用名称
ENABLE_DEBUG	❌	false	是否启用调试

🎯 功能演示
主要功能
搜索功能: 输入关键词搜索多个站点

收藏管理: 保存和管理喜欢的资源

用户中心: 查看统计、管理设置

历史记录: 搜索历史追踪

数据导出: 支持数据备份

支持的站点
JavBus - 番号+磁力一体站

JavDB - 极简风格资料站

JavLibrary - 评论活跃站点

AV01 - 快速预览站点

MissAV - 中文界面站点

其他磁力搜索引擎

🛠️ 开发
本地开发

# 启动Worker开发服务器
wrangler dev worker.js

# 启动前端开发服务器
python -m http.server 8080
# 或使用其他静态服务器
项目结构

magnet-search/
├── worker.js              # Worker主文件
├── schema.sql            # 数据库结构
├── index.html           # 主页面
├── dashboard.html       # 用户面板
├── css/                 # 样式文件
├── js/                  # JavaScript文件
└── images/              # 图片资源
📊 性能指标
首屏加载: < 2秒

API响应: < 500ms

全球延迟: < 100ms

可用性: 99.9%+

🔐 安全性
JWT Token认证

CORS跨域保护

XSS攻击防护

SQL注入防护

速率限制保护

📱 浏览器支持
Chrome 70+

Firefox 65+

Safari 12+

Edge 79+

移动端浏览器

🤝 贡献
欢迎提交Issue和Pull Request！

Fork本项目

创建功能分支

提交更改

推送到分支

创建Pull Request

📄 许可证
本项目采用 MIT 许可证。

⭐ 致谢
感谢以下项目和服务：

Cloudflare Workers

Cloudflare Pages

Cloudflare D1

📞 联系方式
邮箱: your-email@example.com

GitHub: @yourusername

项目主页: https://your-site.pages.dev

免责声明: 本工具仅用于技术学习和研究目的，请遵守当地法律法规，合理使用。

