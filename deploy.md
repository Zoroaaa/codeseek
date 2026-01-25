### 环境要求
- Node.js 18+ (开发环境)
- Cloudflare 账户
- Git
- Wrangler CLI 2.0+

### 本地开发

#### 前端开发
```bash
# 克隆项目
git clone https://github.com/yourusername/magnet-search.git
cd magnet-search

# 启动本地服务器
npx http-server frontend -p 3000

# 或使用Live Server扩展（推荐）
```

#### 后端开发
```bash
# 进入后端目录
cd codeseek-backend

# 安装依赖
npm install

# 登录Cloudflare（首次运行）
wrangler login

# 创建D1数据库
wrangler d1 create codeseek

# 初始化数据库结构
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

# 本地开发服务器
wrangler dev
```

#### 代理服务开发
```bash
# 进入代理服务目录
cd codeseek-site

# 本地开发服务器
wrangler dev
```

### 部署到Cloudflare

#### 前端部署 (Cloudflare Pages)
1. 连接GitHub仓库到Cloudflare Pages
2. 构建设置：
   - 框架预设：`None`
   - 构建命令：`echo "Static site"`
   - 构建输出目录：`frontend`
3. 环境变量配置（可选）：
   - `CF_API_BASE_URL`：后端API地址
   - `CF_PROD_API_URL`：生产环境API地址
   - `CF_PROXY_BASE_URL`：代理服务地址

#### 后端部署 (Cloudflare Workers)
```bash
# 安装Wrangler CLI
npm install -g wrangler

# 登录Cloudflare
wrangler auth login

# 创建D1数据库
wrangler d1 create codeseek

# 初始化数据库结构
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/08_search_source.sql

# 部署Worker
cd codeseek-backend
wrangler deploy
```

#### 代理服务部署
```bash
# 部署代理Worker
cd codeseek-site
wrangler deploy
```

#### 环境变量配置
在Cloudflare Workers中设置以下环境变量：
```
JWT_SECRET=your-super-secret-key
APP_VERSION=2.1.0
FRONTEND_VERSION=2.3.1
PROXY_VERSION=3.1.0
ENABLE_ACTION_LOGGING=true
MAX_FAVORITES_PER_USER=1000
MAX_HISTORY_PER_USER=1000
MAX_TAGS_PER_USER=50
MAX_SHARES_PER_USER=50
EMAIL_VERIFICATION_ENABLED=true
EMAIL_VERIFICATION_REQUIRED=false
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
DEFAULT_FROM_NAME=磁力快搜
SITE_URL=https://yourdomain.com
PROXY_SITE_URL=https://your-proxy-domain.com
```

#### 数据库初始化
```bash
# 运行数据库迁移（按顺序执行模块化SQL文件）
cd codeseek-backend
wrangler d1 execute codeseek --file=./sqllite\ d1/01_user_management.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/02_search_engine.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/03_community.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/04_search_source.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/05_email_security.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/06_system_analytics.sql
wrangler d1 execute codeseek --file=./sqllite\ d1/07_initialization_data.sql
```

