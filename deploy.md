# 部署配置指南

## 项目架构

本项目采用前后端分离架构：
- **前端**: Cloudflare Pages (静态托管)
- **后端**: Cloudflare Workers (边缘计算)
- **数据库**: Cloudflare D1 (分布式SQLite)

## 部署步骤

### 1. 后端部署 (Cloudflare Workers)

#### 1.1 创建D1数据库

 复制schema.sql文件里的语句至D1数据库进行初始化

####1.2 Worker配置
上传 worker.js 到 Cloudflare Workers，并配置以下环境变量：

必需环境变量：
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars-long
DB=your-d1-database-binding-name
可选环境变量：


# 功能开关
ALLOW_REGISTRATION=true                    # 是否允许新用户注册
ENABLE_ACTION_LOGGING=false               # 是否启用用户行为日志
ENABLE_ANALYTICS=false                    # 是否启用分析统计

# 安全配置
JWT_EXPIRY_DAYS=30                        # JWT过期天数
MIN_USERNAME_LENGTH=3                     # 用户名最小长度
MAX_USERNAME_LENGTH=20                    # 用户名最大长度
MIN_PASSWORD_LENGTH=6                     # 密码最小长度

# 限制配置
MAX_FAVORITES_PER_USER=1000              # 用户最大收藏数
MAX_HISTORY_PER_USER=1000                # 用户最大历史记录数

# 应用信息
APP_VERSION=1.0.0                        # 应用版本
APP_NAME=磁力快搜                        # 应用名称
####1.3 绑定D1数据库
在Worker设置中绑定D1数据库：

绑定名称: DB

数据库: 选择上面创建的数据库

###2. 前端部署 (Cloudflare Pages)
####2.1 上传静态文件
将以下文件上传到Cloudflare Pages项目：

frontend/
├── index.html
├── dashboard.html
├── css/
│   ├── style.css
│   └── dashboard.css
├── js/
│   ├── api.js
│   ├── auth.js
│   ├── dashboard.js
│   ├── main.js
│   ├── utils.js
│   └── config.js
└── images/
    ├── logo.png
    └── favicon.ico
####2.2 配置环境变量
在Cloudflare Pages项目设置中配置：

生产环境变量：

# API配置
API_BASE_URL=https://your-worker.your-subdomain.workers.dev
APP_NAME=磁力快搜
APP_VERSION=1.0.0

# 功能开关
ENABLE_ANALYTICS=false                    # 是否启用前端分析
ENABLE_DEBUG=false                        # 是否启用调试模式

# 开发配置（可选）
DEV_URL=http://localhost:8787             # 开发环境API地址
####2.3 配置自定义域名（可选）
在Pages项目中添加自定义域名

更新Worker的CORS配置以允许新域名

更新前端配置中的API_BASE_URL

###3. 域名和SSL配置
####3.1 自定义域名设置
Pages: your-app.pages.dev 或 your-domain.com

Worker: your-worker.workers.dev 或 api.your-domain.com

####3.2 SSL证书
Cloudflare自动提供免费SSL证书

###4. 部署验证
####4.1 功能测试清单
 用户注册功能

 用户登录功能

 搜索功能正常

 收藏功能正常

 历史记录同步

 主题切换功能

 移动端适配

 API连接状态

####4.2 性能测试
 首屏加载 < 2秒

 API响应 < 500ms

 搜索响应 < 1秒

####4.3 安全测试
 JWT认证正常

 CORS配置正确

 输入验证有效

 XSS防护正常

常见问题
Q: Worker部署后出现500错误
A: 检查环境变量配置，确保JWT_SECRET和DB绑定正确设置

Q: 前端无法连接API
A: 检查CORS配置，确保API_BASE_URL设置正确

Q: D1数据库连接失败
A: 确认数据库已创建并正确绑定到Worker

Q: 用户注册失败
A: 检查数据库表是否正确创建，查看Worker日志

监控和维护
性能监控
Cloudflare Analytics

Worker日志监控

用户行为分析（如果启用）

数据备份
定期导出D1数据库数据

用户可通过面板导出个人数据

更新部署
更新Worker代码

更新前端静态文件

执行数据库迁移（如需要）

测试功能正常性

扩展配置
添加新搜索源
修改 worker.js 中的搜索源配置

更新前端搜索逻辑

测试新源的可用性

自定义主题
修改CSS变量

添加主题切换选项

更新用户设置

增加语言支持
添加语言包

实现i18n逻辑

更新UI界面

如需技术支持，请提交Issue或联系开发团队。