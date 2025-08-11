# 磁力快搜 - Cloudflare Worker 部署指南

这个指南将帮助您在 Cloudflare Worker 控制台中直接部署后端服务。

## 前置要求

1. 一个 Cloudflare 账户
2. 已启用 Workers 服务
3. 已创建 D1 数据库（如果需要数据库功能）

## 部署步骤

### 1. 创建 D1 数据库（可选但推荐）

如果您需要用户系统和数据持久化功能：

1. 在 Cloudflare 仪表板中，进入 `Workers & Pages` > `D1`
2. 点击 `Create database`
3. 输入数据库名称，例如：`magnet-search-db`
4. 点击 `Create`
5. 记录下数据库 ID，稍后会用到

### 2. 创建 Worker

1. 在 Cloudflare 仪表板中，进入 `Workers & Pages`
2. 点击 `Create application`
3. 选择 `Create Worker`
4. 输入 Worker 名称，例如：`magnet-search-backend`
5. 点击 `Deploy`

### 3. 配置 Worker 代码

1. 在 Worker 概览页面，点击 `Quick edit`
2. 删除默认代码
3. 复制粘贴提供的 `optimized-worker.js` 代码
4. 点击 `Save and deploy`

### 4. 配置环境变量

在 Worker 设置中添加以下环境变量：

1. 进入 Worker 的 `Settings` 页面
2. 找到 `Environment Variables` 部分
3. 添加以下变量：

```
JWT_SECRET = your-very-secure-jwt-secret-key-here-make-it-long-and-random
ENVIRONMENT = production
```

**重要**: JWT_SECRET 应该是一个长且随机的字符串，建议至少 32 个字符。

### 5. 绑定 D1 数据库（如果使用）

1. 在 Worker 设置页面，找到 `Variables and Secrets`
2. 点击 `D1 database bindings` 下的 `Add binding`
3. 设置：
   - Variable name: `DB`
   - D1 database: 选择之前创建的数据库
4. 点击 `Save and deploy`

### 6. 测试部署

访问您的 Worker URL + `/api/health`，例如：
```
https://your-worker-name.your-account.workers.dev/api/health
```

如果看到类似以下响应，说明部署成功：
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1234567890000,
  "version": "1.0.0"
}
```

### 7. 初始化数据库（如果使用 D1）

首次部署后，访问以下 URL 初始化数据库：
```
POST https://your-worker-name.your-account.workers.dev/api/admin/init-db
```

可以使用 curl 或 Postman：
```bash
curl -X POST https://your-worker-name.your-account.workers.dev/api/admin/init-db
```

成功后应该看到：
```json
{
  "success": true,
  "message": "数据库初始化成功"
}
```

## API 端点

部署成功后，您的后端将提供以下主要 API 端点：

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/verify` - 验证 token
- `POST /api/auth/logout` - 退出登录

### 用户数据
- `GET /api/user/favorites` - 获取收藏夹
- `POST /api/user/favorites` - 同步收藏夹
- `GET /api/user/search-history` - 获取搜索历史
- `POST /api/user/search-history` - 同步搜索历史
- `GET /api/user/settings` - 获取用户设置
- `PUT /api/user/settings` - 更新用户设置

### 搜索相关
- `POST /api/search/enhanced` - 增强搜索
- `POST /api/search/record` - 记录搜索行为
- `GET /api/search/stats` - 获取搜索统计

### 其他功能
- `POST /api/sites/status` - 检查站点状态
- `GET /api/stats` - 获取系统统计
- `POST /api/feedback` - 提交反馈
- `GET /api/config` - 获取系统配置

## 配置选项

在代码中的 `CONFIG` 对象中，您可以调整以下设置：

```javascript
const CONFIG = {
    JWT_SECRET: 'your-jwt-secret-change-this-in-production',
    DB_CACHE_TTL: 3600,        // 数据库缓存TTL（秒）
    SESSION_TTL: 30 * 24 * 60 * 60,  // 会话TTL（30天）
    SEARCH_CACHE_TTL: 1800,    // 搜索缓存TTL（30分钟）
    MAX_FAVORITES: 500,        // 最大收藏数量
    MAX_SEARCH_HISTORY: 100    // 最大搜索历史数
};
```

## 安全建议

1. **更改默认 JWT_SECRET**: 在生产环境中必须使用强随机密钥
2. **启用 HTTPS**: Cloudflare Worker 默认提供 HTTPS
3. **限制访问**: 考虑添加速率限制和访问控制
4. **监控日志**: 定期检查 Worker 日志以发现异常活动

## 故障排除

### 常见问题

1. **数据库连接错误**
   - 检查 D1 绑定是否正确配置
   - 确保数据库已创建并且 ID 正确

2. **JWT 错误**
   - 确保 JWT_SECRET 已设置且足够长
   - 检查环境变量是否正确配置

3. **CORS 错误**
   - Worker 已配置允许跨域请求
   - 检查前端请求头是否正确

4. **部署失败**
   - 检查代码语法是否正确
   - 确保所有依赖项都已正确导入

### 查看日志

在 Worker 概览页面点击 `View logs` 查看实时日志。

## 进阶配置

### 自定义域名

1. 在 Worker 设置中找到 `Triggers`
2. 点击 `Add Custom Domain`
3. 输入您的域名
4. 配置 DNS 记录

### 定时任务

可以添加 Cron 触发器来定期清理过期数据：

1. 在 `Triggers` 中点击 `Add Cron Trigger`
2. 设置时间表，例如：`0 2 * * *`（每天凌晨2点）
3. 触发器将调用 `/api/admin/cleanup` 端点

### KV 存储（可选）

如果需要更高性能的缓存，可以添加 KV 存储绑定：

1. 创建 KV Namespace
2. 在 Worker 设置中添加 KV 绑定
3. 修改代码以使用 KV 存储

## 成本估算

- Worker 请求：免费套餐每天 100,000 次请求
- D1 数据库：免费套餐每天 100,000 次读取，50,000 次写入
- 存储：每个数据库 5GB 免费存储

对于中小型应用，通常可以在免费套餐内运行。

## 支持

如果在部署过程中遇到问题，可以：

1. 检查 Cloudflare Worker 文档
2. 查看 Worker 日志
3. 在项目仓库提交 Issue

祝您部署顺利！