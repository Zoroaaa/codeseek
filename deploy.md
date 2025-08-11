# 🚀 磁力快搜 - 部署指南

本指南将详细介绍如何在 Cloudflare 平台上部署磁力快搜项目。整个部署过程大约需要 15-30 分钟。

## 📋 部署前准备

### 1. 账户要求
- [Cloudflare 账户](https://cloudflare.com) (免费版即可)
- [GitHub 账户](https://github.com) (用于代码托管)
- 基础的命令行操作能力

### 2. 本地环境
- Node.js 18 或更高版本
- npm 或 yarn 包管理器
- Git 版本控制工具

### 3. 安装 Wrangler CLI
```bash
npm install -g wrangler
```

验证安装:
```bash
wrangler --version
```

## 🗄️ 第一步: 数据库部署

### 1. 登录 Cloudflare
```bash
wrangler auth login
```
这会打开浏览器，完成登录授权。

### 2. 创建 D1 数据库
```bash
# 创建生产环境数据库
wrangler d1 create magnet-search-db

# 创建开发环境数据库（可选）
wrangler d1 create magnet-search-db-dev
```

**重要**: 保存输出中的数据库ID，格式类似:
```
database_id = "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
```

### 3. 更新配置文件
编辑 `backend/wrangler.toml` 文件，替换数据库ID:
```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "magnet-search-db"
database_id = "你的数据库ID"  # 替换这里

[[env.development.d1_databases]]
binding = "DB"
database_name = "magnet-search-db-dev" 
database_id = "你的开发数据库ID"  # 替换这里
```

### 4. 初始化数据库结构
```bash
# 初始化生产数据库
wrangler d1 execute magnet-search-db --file=backend/schema.sql

# 初始化开发数据库（可选）
wrangler d1 execute magnet-search-db-dev --file=backend/schema.sql
```

## 🔧 第二步: 后端部署 (Cloudflare Workers)

### 1. 设置环境密钥
```bash
# 设置JWT密钥（请使用强密码）
wrangler secret put JWT_SECRET
# 输入提示时，输入一个复杂的密钥，如: MyVerySecureJWTSecret2024!

# 设置管理员密码（可选）
wrangler secret put ADMIN_PASSWORD
# 输入管理员密码
```

### 2. 部署Worker
```bash
cd backend

# 部署到生产环境
wrangler deploy

# 部署到开发环境
wrangler deploy --env development
```

### 3. 验证部署
部署成功后，你会看到类似输出:
```
Published magnet-search-backend (1.23s)
  https://magnet-search-backend.your-subdomain.workers.dev
```

测试API健康状态:
```bash
curl https://your-worker-url.workers.dev/api/health
```

应该返回:
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1703123456789,
  "version": "1.0.0"
}
```

### 4. 初始化数据库数据
```bash
# 调用初始化API
curl -X POST https://your-worker-url.workers.dev/api/admin/init-db
```

## 🌐 第三步: 前端部署 (Cloudflare Pages)

### 方式一: 通过 Cloudflare Dashboard（推荐）

1. **上传代码到 GitHub**
   ```bash
   # 创建新的 GitHub 仓库
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/magnet-search.git
   git push -u origin main
   ```

2. **连接 Cloudflare Pages**
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
   - 转到 "Pages" 部分
   - 点击 "创建项目"
   - 选择 "连接到 Git"
   - 选择你的 GitHub 仓库

3. **配置构建设置**
   ```
   项目名称: magnet-search
   生产分支: main
   构建命令: (留空)
   构建输出目录: frontend
   根目录: /
   ```

4. **配置环境变量**
   在 Pages 项目设置中添加:
   ```
   API_URL = https://your-worker-url.workers.dev
   ```

5. **部署**
   - 点击 "保存并部署"
   - 等待构建完成（约2-3分钟）

### 方式二: 通过 Wrangler CLI

1. **修改前端API地址**
   编辑 `frontend/js/api.js`，更新 `getAPIBaseURL()` 方法:
   ```javascript
   getAPIBaseURL() {
       if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
           return 'http://localhost:8787';
       }
       return 'https://your-worker-url.workers.dev'; // 替换为你的Worker URL
   }
   ```

2. **部署到Pages**
   ```bash
   cd frontend
   wrangler pages deploy . --project-name=magnet-search
   ```

## 🔒 第四步: 安全配置

### 1. 自定义域名（推荐）
在 Cloudflare Dashboard 中:
- Pages: 添加自定义域名
- Workers: 添加路由规则

### 2. 安全头配置
在 Worker 中已包含基本的 CORS 配置，生产环境建议限制:
```javascript
'Access-Control-Allow-Origin': 'https://your-domain.com'
```

### 3. 速率限制
Worker 已包含基本限制，可根据需要调整。

## 📊 第五步: 验证部署

### 1. 功能测试清单
- [ ] 前端页面正常加载
- [ ] 用户注册功能
- [ ] 用户登录功能
- [ ] 搜索功能正常
- [ ] 收藏功能正常
- [ ] 数据同步功能
- [ ] 主题切换功能
- [ ] 响应式布局

### 2. API测试
```bash
# 健康检查
curl https://your-worker-url.workers.dev/api/health

# 注册测试
curl -X POST https://your-worker-url.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"testpass123"}'

# 登录测试
curl -X POST https://your-worker-url.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"testpass123"}'
```

## 🔧 常见问题解决

### 问题 1: 数据库连接失败
**症状**: API返回500错误，日志显示数据库连接问题
**解决方案**: 
1. 检查 `wrangler.toml` 中的数据库ID是否正确
2. 确认数据库已正确初始化
3. 检查绑定名称是否为 "DB"

### 问题 2: CORS错误
**症状**: 前端无法请求API，浏览器控制台显示CORS错误
**解决方案**:
1. 检查Worker中的CORS配置
2. 确认前端API URL配置正确
3. 如使用自定义域名，更新CORS允许源

### 问题 3: JWT验证失败
**症状**: 登录后立即掉线，token验证失败
**解决方案**:
1. 检查JWT_SECRET是否正确设置
2. 确认Worker中的JWT生成和验证逻辑
3. 检查token过期时间设置

### 问题 4: 前端资源404
**症状**: 页面加载时CSS/JS文件404
**解决方案**:
1. 检查Pages部署的输出目录配置
2. 确认文件路径和大小写
3. 检查构建设置是否正确

## 🚀 性能优化

### 1. 启用缓存
- Pages自动启用静态资源缓存
- Worker中已实现搜索结果缓存
- D1查询结果可增加KV缓存

### 2. CDN优化
- Cloudflare自动提供全球CDN
- 静态资源压缩已启用
- HTTP/2和HTTP/3自动支持

### 3. 数据库优化
- 定期清理过期数据
- 优化查询索引
- 分页加载大数据集

## 📈 监控和维护

### 1. 监控工具
- Cloudflare Analytics 查看流量数据
- Worker Analytics 查看API调用数据
- Pages Analytics 查看页面性能数据

### 2. 日志查看
```bash
# 查看Worker实时日志
wrangler tail

# 查看特定环境的日志
wrangler tail --env production
```

### 3. 定期维护
建议设置定时任务：
- 清理过期会话和缓存
- 备份重要用户数据
- 更新依赖和安全补丁

## 💡 进阶配置

### 1. 自定义域名配置
1. 在Cloudflare中添加域名
2. 更新DNS设置
3. 配置SSL证书
4. 更新Worker和Pages绑定

### 2. 多环境部署
```bash
# 部署到测试环境
wrangler deploy --env development

# 部署到生产环境
wrangler deploy --env production
```

### 3. CI/CD集成
可集成GitHub Actions实现自动部署:
```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Worker
        run: wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## 🎯 部署完成

恭喜！您已经成功部署了磁力快搜项目。现在您可以：

1. 访问您的网站URL
2. 注册新账户测试功能
3. 配置自定义域名（推荐）
4. 监控使用情况和性能
5. 根据需要进行定制化开发

如果在部署过程中遇到任何问题，请查看上述常见问题解决方案，或在GitHub上提交Issue获取帮助。

---

**📞 需要帮助？**
- GitHub Issues: [项目Issues页面]
- 邮件支持: [your-email@example.com]
- 社区讨论: [Discord/Telegram群组]