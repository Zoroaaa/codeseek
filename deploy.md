# 部署配置指南

## Cloudflare Pages 环境变量配置

### 1. Worker 后端部署

首先部署 Cloudflare Worker：

1. 将 `worker.js` 上传到 Cloudflare Workers
2. 配置以下环境变量：

**必需变量：**
- `JWT_SECRET`: JWT密钥 (随机字符串，至少32位)
- `DB`: D1数据库绑定名称

**可选变量：**
- `ALLOW_REGISTRATION`: 是否允许注册 (true/false, 默认true)
- `JWT_EXPIRY_DAYS`: Token过期天数 (默认30)
- `MAX_FAVORITES_PER_USER`: 每用户最大收藏数 (默认1000)
- `MAX_HISTORY_PER_USER`: 每用户最大历史记录数 (默认1000)
- `ENABLE_ACTION_LOGGING`: 是否启用行为日志 (true/false, 默认false)
- `APP_VERSION`: 应用版本号 (默认1.0.0)

3. 绑定D1数据库，执行 `schema.sql` 初始化数据库

### 2. Pages 前端部署

在 Cloudflare Pages 项目设置中配置环境变量：

**生产环境变量：**
```bash
# API配置
API_BASE_URL=https://your-worker.your-subdomain.workers.dev
APP_NAME=磁力快搜
APP_VERSION=1.0.0

# 功能开关
ENABLE_ANALYTICS=false
ENABLE_DEBUG=false


**预览环境变量：**
# API配置
API_BASE_URL=https://your-worker-dev.your-subdomain.workers.dev
APP_NAME=磁力快搜-测试版
APP_VERSION=1.0.0-preview

# 功能开关
ENABLE_ANALYTICS=false
ENABLE_DEBUG=true
