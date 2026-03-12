# CodeSeek API 文档 (v2.0.0)

本文档详细说明CodeSeek项目的所有API接口，100%基于实际后端代码。

---

## 基础信息

- **基础URL**: `/api`
- **认证方式**: JWT Bearer Token（在请求头中添加 `Authorization: Bearer <token>`）
- **响应格式**: JSON
- **API框架**: Hono 4.6.0
- **运行时**: Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)

## 统一响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}
```

## 错误码说明

| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 400 | 参数验证失败 |
| `AUTH_ERROR` | 401 | 认证失败/未授权 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `DUPLICATE_ERROR` | 400 | 资源已存在 |
| `RATE_LIMIT` | 429 | 请求频率超限 |
| `SERVER_ERROR` | 500 | 服务器内部错误 |
| `LOCKED` | 423 | 账户被锁定 |

---

## 根接口

### `GET /` - API信息

获取API基本信息。

**返回**:
```json
{
  "name": "CodeSeek API",
  "version": "2.0.0",
  "status": "running"
}
```

---

## 认证接口 `/api/auth`

### `POST /api/auth/register` - 用户注册

注册新用户账号。

**请求体**:
```json
{
  "username": "string (3-20字符，字母数字下划线)",
  "email": "string (有效邮箱格式)",
  "password": "string (6-100字符)",
  "verificationCode": "string? (6位验证码，邮箱验证必填时需要)"
}
```

**返回**: 用户信息和JWT令牌

---

### `POST /api/auth/login` - 用户登录

使用用户名或邮箱登录。

**请求体**:
```json
{
  "identifier": "string",
  "password": "string"
}
```

**说明**: `identifier` 可以是用户名或邮箱地址

**返回**: 用户信息和JWT令牌

---

### `POST /api/auth/logout` - 用户登出

登出当前会话。

**认证**: 需要

**返回**: 操作结果

---

### `GET /api/auth/me` - 获取当前用户信息

获取当前登录用户的详细信息。

**认证**: 需要

**返回**: 用户信息对象

---

### `POST /api/auth/verify-token` - Token验证

验证当前Token是否有效。

**认证**: 需要

**返回**: 验证结果和用户基本信息

---

### `POST /api/auth/refresh` - Token刷新

刷新当前Token，延长会话有效期。

**认证**: 需要

**返回**: 新的JWT令牌

---

### `POST /api/auth/forgot-password` - 忘记密码

发送密码重置验证码到邮箱。

**请求体**:
```json
{
  "email": "string"
}
```

**返回**: 操作结果提示

---

### `POST /api/auth/reset-password` - 重置密码

使用验证码重置密码。

**请求体**:
```json
{
  "email": "string",
  "code": "string (6位验证码)",
  "newPassword": "string (6-100字符)"
}
```

**返回**: 操作结果

---

### `POST /api/auth/change-password` - 更改密码

修改当前用户密码。

**认证**: 需要

**请求体**:
```json
{
  "currentPassword": "string",
  "newPassword": "string (6-100字符)"
}
```

**返回**: 操作结果

---

### `DELETE /api/auth/account` - 删除账户

删除当前用户账户（需要验证码确认）。

**认证**: 需要

**请求体**:
```json
{
  "verificationCode": "string (6位验证码)",
  "confirmText": "删除我的账户"
}
```

**返回**: 操作结果

---

### `POST /api/auth/send-registration-code` - 发送注册验证码

向指定邮箱发送注册验证码。

**请求体**:
```json
{
  "email": "string"
}
```

**返回**: 脱敏邮箱、过期时间

---

### `POST /api/auth/send-password-reset-code` - 发送密码重置验证码

向指定邮箱发送密码重置验证码。

**认证**: 需要

**返回**: 脱敏邮箱、过期时间

---

### `POST /api/auth/request-email-change` - 申请更改邮箱

创建邮箱更改请求。

**认证**: 需要

**请求体**:
```json
{
  "newEmail": "string",
  "currentPassword": "string"
}
```

**返回**: 请求ID、脱敏邮箱、过期时间

---

### `POST /api/auth/send-email-change-code` - 发送邮箱更改验证码

向原邮箱或新邮箱发送验证码。

**认证**: 需要

**请求体**:
```json
{
  "requestId": "string",
  "emailType": "old | new"
}
```

**返回**: 脱敏邮箱、过期时间

---

### `POST /api/auth/verify-email-change-code` - 验证邮箱更改验证码

验证并完成邮箱更改流程。

**认证**: 需要

**请求体**:
```json
{
  "requestId": "string",
  "emailType": "old | new",
  "code": "string"
}
```

**返回**: 是否完成、新邮箱（脱敏）

---

### `POST /api/auth/cancel-email-change-request` - 取消邮箱更改请求

取消当前进行中的邮箱更改请求。

**认证**: 需要

**请求体**:
```json
{
  "requestId": "string"
}
```

**返回**: 操作结果

---

### `POST /api/auth/send-account-delete-code` - 发送账户删除验证码

向当前用户邮箱发送账户删除确认验证码。

**认证**: 需要

**返回**: 脱敏邮箱、过期时间

---

### `GET /api/auth/verification-status` - 检查验证状态

检查指定邮箱的验证码状态。

**查询参数**:
- `email` - 邮箱地址
- `type` - 验证类型（registration/password_reset/email_change_old/email_change_new/account_delete）

**返回**: 是否有待验证的验证码、是否可重发、剩余时间

---

### `GET /api/auth/user-verification-status` - 获取用户验证状态

获取当前用户的所有待处理验证。

**认证**: 需要

**返回**: 待处理验证列表、邮箱更改请求

---

### `POST /api/auth/smart-send-code` - 智能发送验证码

根据验证类型智能发送验证码，自动处理重发间隔。

**请求体**:
```json
{
  "email": "string",
  "verificationType": "registration | password_reset | email_change_old | email_change_new | account_delete",
  "force": "boolean?"
}
```

**返回**: 脱敏邮箱、过期时间、是否可重发

---

## 用户数据接口 `/api/user`

### `GET /api/user/settings` - 获取用户设置

获取当前用户的设置信息。

**认证**: 需要

**返回**: 用户设置对象

---

### `PUT /api/user/settings` - 更新用户设置

更新当前用户的设置。

**认证**: 需要

**请求体**:
```json
{
  "settings": {}
}
```

**返回**: 更新后的设置

---

### `GET /api/user/favorites` - 获取收藏列表

获取当前用户的所有收藏。

**认证**: 需要

**返回**: 收藏列表

---

### `POST /api/user/favorites` - 添加收藏

添加一个新的收藏。

**认证**: 需要

**请求体**:
```json
{
  "title": "string (必填，最多100字符)",
  "subtitle": "string? (最多200字符)",
  "url": "string (必填，有效URL，最多500字符)",
  "icon": "string? (最多50字符)",
  "keyword": "string? (最多100字符)"
}
```

**返回**: 新创建的收藏信息

---

### `POST /api/user/favorites/sync` - 同步收藏数据

批量同步收藏数据（覆盖式同步）。

**认证**: 需要

**请求体**:
```json
{
  "favorites": [
    {
      "id": "string?",
      "title": "string",
      "subtitle": "string?",
      "url": "string",
      "icon": "string?",
      "keyword": "string?",
      "createdAt": "number?"
    }
  ]
}
```

**返回**: 同步结果（包含同步数量）

---

### `DELETE /api/user/favorites/:id` - 删除收藏

删除指定的收藏项。

**认证**: 需要

**URL参数**: `id` - 收藏项ID

**返回**: 操作结果

---

### `GET /api/user/search-history` - 获取搜索历史

获取当前用户的搜索历史记录。

**认证**: 需要

**查询参数**:
- `limit` - 返回数量限制（默认100）

**返回**: 搜索历史记录列表

---

### `POST /api/user/search-history` - 保存搜索记录

保存一条搜索历史记录。

**认证**: 需要

**请求体**:
```json
{
  "query": "string (必填，最多200字符)",
  "source": "string? (最多100字符)",
  "resultsCount": "number?"
}
```

**返回**: 新创建的历史记录

---

### `DELETE /api/user/search-history` - 清空搜索历史

清空当前用户的所有搜索历史。

**认证**: 需要

**返回**: 操作结果

---

### `DELETE /api/user/search-history/:id` - 删除单条搜索历史

删除指定的搜索历史记录。

**认证**: 需要

**URL参数**: `id` - 历史记录ID

**返回**: 操作结果

---

### `GET /api/user/search-stats` - 获取搜索统计

获取当前用户的搜索统计数据。

**认证**: 需要

**返回**: 
- totalSearches - 总搜索次数
- topSources - 常用搜索源（Top 5）
- recentSearches - 最近搜索记录（10条）
- searchGrowthPercent - 搜索增长百分比
- thisWeekSearches - 本周搜索次数
- lastWeekSearches - 上周搜索次数

---

### `GET /api/user/source-configs` - 获取用户搜索源配置

获取当前用户对所有搜索源的个性化配置。

**认证**: 需要

**返回**: 搜索源配置列表

---

### `PUT /api/user/source-configs/:sourceId` - 更新搜索源配置

更新用户对特定搜索源的个性化配置。

**认证**: 需要

**URL参数**: `sourceId` - 搜索源ID

**请求体**:
```json
{
  "isEnabled": "boolean?",
  "customPriority": "number?",
  "customName": "string?",
  "customSubtitle": "string?",
  "customIcon": "string?",
  "notes": "string?"
}
```

**返回**: 操作结果

---

### `GET /api/user/activities` - 获取个人活动记录

获取当前用户的活动记录。

**认证**: 需要

**查询参数**:
- `limit` - 返回数量（默认100，最大100）
- `offset` - 偏移量（默认0）
- `action` - 行为类型筛选（可选）

**返回**: 
- activities - 活动列表（包含行为标签）
- total - 总数
- limit - 限制
- offset - 偏移量

---

### `GET /api/user/activities/stats` - 获取个人活动统计

获取当前用户的活动统计数据。

**认证**: 需要

**返回**: 
- total - 总活动数
- today - 今日活动数
- week - 本周活动数
- month - 本月活动数
- actionsByType - 按类型分组统计
- summary - 摘要（登录、失败登录、搜索、收藏操作次数）

---

## 搜索接口 `/api/search`

### `POST /api/search` - 执行搜索

执行搜索并返回搜索源列表，自动记录搜索历史。

**认证**: 可选（认证后记录历史）

**请求体**:
```json
{
  "keyword": "string (必填)",
  "page": "number? (默认1)",
  "pageSize": "number? (默认20，最大100)",
  "majorCategoryId": "string?",
  "categoryId": "string?"
}
```

**返回**: 
- keyword - 搜索关键词
- results - 搜索结果列表（包含搜索源信息和生成的URL）
- total - 总数
- page - 页码
- pageSize - 每页数量
- hasMore - 是否有更多

---

### `GET /api/search/history` - 获取搜索历史

获取当前用户的搜索历史记录。

**认证**: 需要

**查询参数**:
- `limit` - 返回数量限制（默认50，最大200）

**返回**: 搜索历史记录列表（包含搜索源名称和图标）

---

### `DELETE /api/search/history` - 清空搜索历史

清空当前用户的所有搜索历史。

**认证**: 需要

**返回**: 操作结果

---

### `DELETE /api/search/history/:id` - 删除单条搜索历史

删除指定的搜索历史记录。

**认证**: 需要

**URL参数**: `id` - 历史记录ID

**返回**: 操作结果

---

### `GET /api/search/favorites` - 获取收藏列表

获取当前用户的收藏列表。

**认证**: 需要

**返回**: 收藏列表

---

### `POST /api/search/favorites` - 添加收藏

添加一个新的收藏。

**认证**: 需要

**请求体**:
```json
{
  "title": "string (必填)",
  "subtitle": "string?",
  "url": "string (必填，有效URL)",
  "icon": "string?",
  "keyword": "string?"
}
```

**返回**: 新创建的收藏信息

---

### `DELETE /api/search/favorites/:id` - 删除收藏

删除指定的收藏项。

**认证**: 需要

**URL参数**: `id` - 收藏项ID

**返回**: 操作结果

---

### `GET /api/search/suggestions` - 获取搜索建议

根据关键词获取搜索建议。

**查询参数**:
- `keyword` - 搜索关键词（至少2个字符）
- `limit` - 返回数量（默认10，最大20）

**返回**: 建议关键词列表及搜索次数

---

### `GET /api/search/trending` - 获取热门搜索

获取热门搜索关键词。

**查询参数**:
- `limit` - 返回数量（默认20，最大50）
- `hours` - 时间范围（默认24小时，最大168小时/7天）

**返回**: 热门关键词列表及搜索次数

---

## 搜索源管理接口 `/api/search-sources`

### `GET /api/search-sources/major-categories` - 获取主分类列表

获取所有激活的主分类。

**返回**: 主分类列表（按显示顺序排序）

---

### `GET /api/search-sources/major-categories/:id` - 获取单个主分类

获取指定主分类的详细信息。

**URL参数**: `id` - 主分类ID

**返回**: 主分类详情

---

### `POST /api/search-sources/major-categories` - 创建主分类

创建新的搜索源大类。

**认证**: 需要（管理员权限）

**请求体**:
```json
{
  "name": "string (1-30字符)",
  "description": "string?",
  "icon": "string?",
  "color": "string? (格式: #RRGGBB)",
  "requiresKeyword": "boolean?"
}
```

**返回**: 新创建的主分类信息

---

### `PUT /api/search-sources/major-categories/:id` - 更新主分类

更新指定主分类的信息。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 主分类ID

**请求体**:
```json
{
  "name": "string?",
  "description": "string?",
  "icon": "string?",
  "color": "string?",
  "requiresKeyword": "boolean?",
  "displayOrder": "number?",
  "isActive": "boolean?"
}
```

**返回**: 操作结果

---

### `DELETE /api/search-sources/major-categories/:id` - 删除主分类

删除指定主分类（分类下不能有子分类）。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 主分类ID

**返回**: 操作结果

---

### `GET /api/search-sources/categories` - 获取分类列表

获取所有激活的分类。

**查询参数**:
- `majorCategoryId` - 主分类ID（可选，用于筛选）

**返回**: 分类列表（包含所属主分类名称）

---

### `GET /api/search-sources/categories/:id` - 获取单个分类

获取指定分类的详细信息。

**URL参数**: `id` - 分类ID

**返回**: 分类详情

---

### `POST /api/search-sources/categories` - 创建分类

创建新的搜索源分类。

**认证**: 需要（管理员权限）

**请求体**:
```json
{
  "majorCategoryId": "string (必填)",
  "name": "string (1-50字符)",
  "description": "string?",
  "icon": "string?",
  "color": "string?",
  "defaultSearchable": "boolean?",
  "defaultSiteType": "search | browse | reference?",
  "searchPriority": "number? (1-10)"
}
```

**返回**: 新创建的分类信息

---

### `PUT /api/search-sources/categories/:id` - 更新分类

更新指定分类的信息。

**认证**: 需要（登录用户即可，系统分类需要管理员权限）

**URL参数**: `id` - 分类ID

**请求体**:
```json
{
  "name": "string?",
  "description": "string?",
  "icon": "string?",
  "color": "string?",
  "defaultSearchable": "boolean?",
  "defaultSiteType": "string?",
  "searchPriority": "number?"
}
```

**返回**: 操作结果

---

### `DELETE /api/search-sources/categories/:id` - 删除分类

删除指定分类（分类下不能有搜索源）。

**认证**: 需要（登录用户即可，系统分类需要管理员权限）

**URL参数**: `id` - 分类ID

**返回**: 操作结果

---

### `GET /api/search-sources/` - 获取搜索源列表

获取所有激活的搜索源。

**查询参数**:
- `categoryId` - 分类ID（可选）
- `searchable` - 是否可搜索（可选，`true`/`false`）
- `siteType` - 站点类型（可选）

**返回**: 搜索源列表（按搜索优先级和显示顺序排序）

---

### `GET /api/search-sources/:id` - 获取单个搜索源

获取指定搜索源的详细信息。

**URL参数**: `id` - 搜索源ID

**返回**: 搜索源详情

---

### `POST /api/search-sources/` - 创建搜索源

创建新的搜索源。

**认证**: 需要（登录用户即可）

**请求体**:
```json
{
  "categoryId": "string (必填)",
  "name": "string (必填，最多100字符)",
  "subtitle": "string?",
  "description": "string?",
  "icon": "string?",
  "urlTemplate": "string (必填，有效URL模板)",
  "homepageUrl": "string?",
  "siteType": "search | browse | reference?",
  "searchable": "boolean?",
  "requiresKeyword": "boolean?",
  "searchPriority": "number? (1-10)"
}
```

**返回**: 新创建的搜索源信息

---

### `PUT /api/search-sources/:id` - 更新搜索源

更新指定搜索源的信息。

**认证**: 需要（登录用户即可，系统搜索源需要管理员权限）

**URL参数**: `id` - 搜索源ID

**请求体**:
```json
{
  "categoryId": "string?",
  "name": "string?",
  "subtitle": "string?",
  "description": "string?",
  "icon": "string?",
  "urlTemplate": "string?",
  "homepageUrl": "string?",
  "siteType": "string?",
  "searchable": "boolean?",
  "requiresKeyword": "boolean?",
  "searchPriority": "number?"
}
```

**返回**: 操作结果

---

### `DELETE /api/search-sources/:id` - 删除搜索源

删除指定搜索源。

**认证**: 需要（登录用户即可，系统搜索源需要管理员权限）

**URL参数**: `id` - 搜索源ID

**返回**: 操作结果

---

### `POST /api/search-sources/:id/increment-usage` - 增加使用次数

增加指定搜索源的使用计数。

**URL参数**: `id` - 搜索源ID

**返回**: 操作结果

---

### `GET /api/search-sources/user-configs/:userId` - 获取用户配置

获取指定用户的搜索源配置。

**URL参数**: `userId` - 用户ID

**返回**: 用户配置列表

---

### `DELETE /api/search-sources/user-configs/:sourceId` - 删除用户配置

删除用户对指定搜索源的配置。

**认证**: 需要

**URL参数**: `sourceId` - 搜索源ID

**返回**: 操作结果

---

### `GET /api/search-sources/with-user-config/:userId` - 获取带用户配置的搜索源

获取所有搜索源并附带用户的个性化配置。

**URL参数**: `userId` - 用户ID

**返回**: 带用户配置的搜索源列表

---

### `POST /api/search-sources/user-configs/batch` - 批量更新用户配置

批量更新用户对多个搜索源的个性化配置。

**认证**: 需要

**请求体**:
```json
{
  "configs": [
    {
      "sourceId": "string (必填)",
      "isEnabled": "boolean?",
      "customPriority": "number?",
      "customName": "string?",
      "customSubtitle": "string?",
      "customIcon": "string?",
      "notes": "string?"
    }
  ]
}
```

**返回**: 更新数量统计

---

### `GET /api/search-sources/popular` - 获取热门搜索源

获取使用量最高的搜索源。

**查询参数**:
- `limit` - 返回数量（默认20）

**返回**: 热门搜索源列表

---

### `GET /api/search-sources/search` - 搜索搜索源

根据关键词搜索搜索源。

**查询参数**:
- `keyword` - 搜索关键词（必填）

**返回**: 匹配的搜索源列表（最多20条）

---

### `GET /api/search-sources/stats` - 获取搜索源统计

获取搜索源的整体统计数据。

**返回**: 
- total - 总搜索源数
- searchable - 可搜索数
- totalCategories - 总分类数
- totalMajorCategories - 总主分类数
- topUsedSources - 使用量Top 10搜索源
- sourcesByCategory - 各分类搜索源数量
- sourcesBySiteType - 各站点类型数量

---

### `GET /api/search-sources/export` - 导出搜索源

导出搜索源数据。

**查询参数**:
- `format` - 导出格式（`json`/`csv`/`opml`，默认`json`）
- `categoryId` - 分类ID（可选，用于筛选）

**返回**: 
- JSON格式：搜索源列表
- CSV格式：CSV文件下载
- OPML格式：OPML文件下载

---

### `GET /api/search-sources/export-user-configs/:userId` - 导出用户配置

导出用户的搜索源配置。

**URL参数**: `userId` - 用户ID

**返回**: 用户配置列表

---

## 社区接口 `/api/community`

### `GET /api/community/tags` - 获取标签列表

获取所有激活的标签。

**返回**: 标签列表（按使用量和名称排序）

---

### `POST /api/community/tags` - 创建标签

创建一个新标签。

**认证**: 需要

**请求体**:
```json
{
  "name": "string (2-20字符)",
  "description": "string?",
  "color": "string? (格式: #RRGGBB)"
}
```

**返回**: 新创建的标签信息

---

### `PUT /api/community/tags/:id` - 更新标签

更新指定标签的信息。

**认证**: 需要

**URL参数**: `id` - 标签ID

**请求体**:
```json
{
  "name": "string?",
  "description": "string?",
  "color": "string?",
  "isActive": "boolean?"
}
```

**返回**: 操作结果

---

### `DELETE /api/community/tags/:id` - 删除标签

删除指定标签（不能删除正在使用的标签）。

**认证**: 需要

**URL参数**: `id` - 标签ID

**返回**: 操作结果

---

### `GET /api/community/sources` - 获取社区搜索源列表

获取社区分享的搜索源列表。

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）
- `status` - 状态筛选（默认`active`）
- `search` - 搜索关键词（可选）
- `tags` - 标签筛选（可选，逗号分隔）
- `sort` - 排序方式（默认`popular`）
- `category` - 分类筛选（可选）

**返回**: 分页的搜索源列表

---

### `GET /api/community/sources/:id` - 获取搜索源详情

获取指定社区搜索源的详细信息。

**URL参数**: `id` - 搜索源ID

**返回**: 搜索源详情（同时增加浏览计数）

---

### `POST /api/community/sources` - 提交搜索源

向社区提交一个新的搜索源。

**认证**: 需要

**请求体**:
```json
{
  "sourceName": "string (2-100字符)",
  "sourceSubtitle": "string?",
  "sourceIcon": "string?",
  "sourceUrlTemplate": "string (必填，有效URL模板)",
  "sourceCategory": "string (必填)",
  "description": "string?",
  "tags": "string[]? (最多10个)"
}
```

**返回**: 新创建的搜索源信息

---

### `PUT /api/community/sources/:id` - 更新搜索源

更新自己提交的搜索源信息。

**认证**: 需要

**URL参数**: `id` - 搜索源ID

**请求体**:
```json
{
  "sourceName": "string?",
  "sourceSubtitle": "string?",
  "sourceIcon": "string?",
  "description": "string?",
  "tags": "string[]?",
  "sourceCategory": "string?"
}
```

**返回**: 操作结果

---

### `DELETE /api/community/sources/:id` - 删除搜索源

删除自己提交的搜索源。

**认证**: 需要

**URL参数**: `id` - 搜索源ID

**返回**: 操作结果

---

### `POST /api/community/sources/:id/like` - 点赞/取消点赞

对搜索源进行点赞或取消点赞操作。

**认证**: 需要

**URL参数**: `id` - 搜索源ID

**返回**: 当前点赞状态

---

### `GET /api/community/sources/:id/reviews` - 获取评论列表

获取指定搜索源的评论列表。

**URL参数**: `id` - 搜索源ID

**返回**: 评论列表（包含用户名）

---

### `POST /api/community/reviews` - 创建评论

对搜索源发表评价。

**认证**: 需要

**请求体**:
```json
{
  "sharedSourceId": "string (必填)",
  "rating": "number (1-5)",
  "comment": "string? (最多1000字符)"
}
```

**返回**: 新创建的评论信息

---

### `PUT /api/community/reviews/:id` - 更新评论

更新自己发表的评论。

**认证**: 需要

**URL参数**: `id` - 评论ID

**请求体**:
```json
{
  "rating": "number? (1-5)",
  "comment": "string? (最多1000字符)"
}
```

**返回**: 更新后的评论信息

---

### `DELETE /api/community/reviews/:id` - 删除评论

删除自己发表的评论。

**认证**: 需要

**URL参数**: `id` - 评论ID

**返回**: 操作结果

---

### `POST /api/community/sources/:id/report` - 举报搜索源

举报违规搜索源。

**认证**: 需要

**URL参数**: `id` - 搜索源ID

**请求体**:
```json
{
  "reason": "string (必填，最多100字符)",
  "details": "string? (最多1000字符)"
}
```

**返回**: 举报ID

---

### `POST /api/community/sources/:id/download` - 记录下载

记录搜索源的下载行为。

**认证**: 可选

**URL参数**: `id` - 搜索源ID

**返回**: 操作结果

---

### `GET /api/community/sources/my-favorites` - 获取我的收藏

获取当前用户在社区收藏的搜索源列表。

**认证**: 需要

**返回**: 收藏的搜索源列表

---

### `GET /api/community/sources/my-sources` - 获取我的分享

获取当前用户分享的搜索源列表。

**认证**: 需要

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）
- `status` - 状态筛选（可选）

**返回**: 分页的搜索源列表

---

### `GET /api/community/sources/popular` - 获取热门分享

获取社区热门搜索源。

**查询参数**:
- `limit` - 返回数量（默认10）
- `tag` - 标签筛选（可选）

**返回**: 热门搜索源列表

---

### `GET /api/community/sources/recent` - 获取最新分享

获取社区最新分享的搜索源。

**查询参数**:
- `limit` - 返回数量（默认10）

**返回**: 最新搜索源列表

---

### `GET /api/community/sources/search` - 搜索社区资源

在社区中搜索搜索源。

**查询参数**:
- `keyword` - 搜索关键词（必填）
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

**返回**: 分页的搜索结果

---

### `GET /api/community/sources/user-stats` - 获取用户统计

获取当前用户在社区的统计数据。

**认证**: 需要

**返回**: 
- sharedSources - 分享数量
- pendingSources - 待审核数量
- totalDownloads - 总下载量
- totalLikes - 总点赞
- totalViews - 总浏览
- avgRating - 平均评分
- reviewsGiven - 评论数
- tagsCreated - 创建标签数
- recentShares - 最近分享记录

---

### `GET /api/community/sources/stats` - 获取社区统计

获取社区整体统计数据。

**返回**: 
- totalSources - 总搜索源数
- totalDownloads - 总下载量
- totalUsers - 总用户数
- totalReviews - 总评论数
- averageRating - 平均评分
- categoriesCount - 分类数量
- topCategories - 热门分类
- recentActivity - 最近活动

---

### `GET /api/community/notifications` - 获取通知列表

获取当前用户的通知列表。

**认证**: 需要

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

**返回**: 分页的通知列表

---

## 管理员接口 `/api/admin`

所有管理员接口需要管理员或超级管理员权限。

### `GET /api/admin/roles` - 获取角色列表

获取系统中所有角色列表。

**认证**: 需要（管理员权限）

**返回**: 角色列表（包含权限、优先级等）

---

### `GET /api/admin/users` - 获取用户列表

获取系统用户列表。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20，最大100）
- `search` - 搜索关键词（用户名/邮箱）
- `status` - 状态筛选（`active`/`inactive`）
- `roleId` - 角色筛选（可选）

**返回**: 
- users - 用户列表（ID、用户名、邮箱、状态、登录次数等）
- total - 总数
- page - 页码
- pageSize - 每页数量
- totalPages - 总页数

---

### `GET /api/admin/users/:id` - 获取用户详情

获取指定用户的详细信息。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 用户ID

**返回**: 
- 用户详细信息
- 统计数据（收藏数、历史数、活跃会话数）
- 最近会话列表
- 最近活动记录

---

### `PUT /api/admin/users/:id/role` - 更新用户角色

更新指定用户的角色。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 用户ID

**请求体**:
```json
{
  "roleId": "string"
}
```

**返回**: 更新后的角色信息

---

### `GET /api/admin/users/:id/login-logs` - 获取用户登录日志

获取指定用户的登录日志记录。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 用户ID

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）

**返回**: 登录日志列表

---

### `GET /api/admin/active-users` - 获取活跃用户排行

获取指定时间范围内的活跃用户排行。

**认证**: 需要（管理员权限）

**查询参数**:
- `limit` - 返回数量（默认20）
- `days` - 统计天数（默认7）

**返回**: 活跃用户列表

---

### `GET /api/admin/login-stats` - 获取登录统计

获取系统登录统计数据。

**认证**: 需要（管理员权限）

**查询参数**:
- `days` - 统计天数（默认7）

**返回**: 
- dailyStats - 每日登录统计
- topIPs - 登录最多的IP
- failedAttempts - 失败尝试最多的IP

---

### `PUT /api/admin/users/:id/status` - 更新用户状态

启用或禁用用户账户。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 用户ID

**请求体**:
```json
{
  "isActive": "boolean",
  "reason": "string?"
}
```

**返回**: 操作结果

---

### `PUT /api/admin/users/:id/permissions` - 更新用户权限

更新用户的权限列表。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 用户ID

**请求体**:
```json
{
  "permissions": "string[]"
}
```

**返回**: 操作结果

---

### `GET /api/admin/reports` - 获取举报列表

获取社区举报列表。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20，最大100）
- `status` - 状态筛选（默认`pending`）

**返回**: 
- reports - 举报列表（包含搜索源名称、举报人信息）
- total - 总数
- page - 页码
- pageSize - 每页数量
- totalPages - 总页数

---

### `PUT /api/admin/reports/:id` - 处理举报

处理举报并执行相应操作。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 举报ID

**请求体**:
```json
{
  "status": "resolved | dismissed",
  "action": "remove_source | warning | ignore?",
  "notes": "string?"
}
```

**返回**: 操作结果

---

### `GET /api/admin/stats` - 获取系统统计

获取系统整体统计数据。

**认证**: 需要（管理员权限）

**返回**: 
- users - 用户统计（总数、活跃、已验证、本周新增、日活）
- roles - 角色分布
- sources - 搜索源统计（总数、活跃、可搜索、总使用量）
- searches - 搜索统计（总数、独立用户、独立关键词）
- community - 社区统计（分享数、标签数、评论数、待处理举报）
- topSearchKeywords - Top搜索关键词（10条）
- topUsedSources - Top使用搜索源（10条）

---

### `GET /api/admin/logs` - 获取行为日志

获取用户行为日志。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认50，最大200）
- `userId` - 用户ID筛选
- `action` - 行为类型筛选

**返回**: 
- logs - 日志列表（包含用户名）
- total - 总数
- page - 页码
- pageSize - 每页数量
- totalPages - 总页数

---

### `POST /api/admin/cleanup` - 清理过期数据

清理系统中的过期数据。

**认证**: 需要（管理员权限）

**返回**: 
- oldPasswordResetLogs - 旧密码重置日志数
- oldActions - 旧行为日志数
- oldSecurityEvents - 过期安全事件数

---

### `GET /api/admin/sessions` - 获取会话列表

获取系统会话列表。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认20）
- `userId` - 用户ID筛选
- `status` - 状态筛选（`active`/`expired`）

**返回**: 
- sessions - 会话列表
- total - 总数
- page - 页码
- pageSize - 每页数量
- totalPages - 总页数

---

### `DELETE /api/admin/sessions/:id` - 终止会话

终止指定会话。

**认证**: 需要（管理员权限）

**URL参数**: `id` - 会话ID

**返回**: 操作结果

---

### `GET /api/admin/analytics/stats` - 获取分析统计

获取分析事件统计数据。

**认证**: 需要（管理员权限）

**查询参数**:
- `days` - 统计天数（默认7）

**返回**: 
- totalEvents - 总事件数
- uniqueUsers - 独立用户数
- uniqueSessions - 独立会话数
- eventsByType - 按类型分组统计
- dailyEvents - 每日事件统计
- topReferers - 来源网站排行
- hourlyDistribution - 小时分布

---

### `GET /api/admin/analytics/events` - 获取分析事件

获取分析事件列表。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认50）
- `eventType` - 事件类型筛选
- `userId` - 用户ID筛选

**返回**: 分页的事件列表

---

### `GET /api/admin/dashboard/overview` - 仪表盘概览

获取管理员仪表盘概览数据。

**认证**: 需要（管理员权限）

**返回**: 
- users - 用户统计
- sessions - 会话统计
- actions - 行为统计
- analytics - 分析统计
- sources - 搜索源统计
- searches - 搜索统计
- logins - 登录统计
- community - 社区统计
- recentActions - 最近活动

---

### `GET /api/admin/dashboard/trends` - 趋势分析

获取系统趋势分析数据。

**认证**: 需要（管理员权限）

**查询参数**:
- `days` - 统计天数（默认7）

**返回**: 趋势数据（用户注册、登录、搜索、分析事件、活跃用户）

---

### `GET /api/admin/dashboard/user-behavior` - 用户行为分析

获取用户行为分析数据。

**认证**: 需要（管理员权限）

**查询参数**:
- `days` - 统计天数（默认7）

**返回**: 用户行为分析数据（行为类型分布、活跃用户排行、小时分布、周分布）

---

## 系统配置接口 `/api/config`

### `GET /api/config/public` - 获取公开配置

获取系统公开配置信息（无需认证），返回已解析类型的配置值。

**返回**: 系统公开配置对象

---

### `GET /api/config/all` - 获取所有配置

获取所有系统配置项。

**认证**: 需要（管理员权限）

**返回**: 配置列表（包含配置类型、分组、是否公开、是否敏感等）

---

### `GET /api/config/groups` - 获取配置分组

获取按功能分组的配置列表。

**认证**: 需要（管理员权限）

**返回**: 
- groups - 配置分组列表
- groupedConfigs - 分组后的配置对象

---

### `GET /api/config/logs` - 获取配置变更日志

获取配置变更历史记录。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认50，最大200）
- `key` - 配置键名筛选
- `type` - 变更类型筛选（create/update/delete/reset）

**返回**: 
- logs - 变更日志列表
- total - 总数
- page - 页码
- pageSize - 每页数量

---

### `GET /api/config/export` - 导出配置

导出系统配置数据。

**认证**: 需要（管理员权限）

**返回**: 导出的配置数据

---

### `POST /api/config/import` - 导入配置

批量导入系统配置。

**认证**: 需要（超级管理员权限）

**请求体**:
```json
{
  "configs": [
    {
      "key": "string",
      "value": "string",
      "description": "string?",
      "configType": "string?",
      "configGroup": "string?",
      "isPublic": "boolean?",
      "isSensitive": "boolean?"
    }
  ],
  "overwrite": "boolean? (默认false)"
}
```

**返回**: 
- results - 导入结果列表
- created - 创建数量
- updated - 更新数量
- skipped - 跳过数量

---

### `GET /api/config/:key` - 获取单个配置

获取指定配置项详情。

**URL参数**: `key` - 配置键名

**返回**: 配置详情对象

---

### `PUT /api/config/:key` - 更新配置

更新指定配置项。

**认证**: 需要（管理员权限）

**URL参数**: `key` - 配置键名

**请求体**:
```json
{
  "value": "string",
  "description": "string?",
  "configType": "string | integer | float | boolean | json?",
  "configGroup": "string?",
  "isPublic": "boolean?",
  "isSensitive": "boolean?",
  "changeReason": "string?"
}
```

**返回**: 操作结果

---

### `DELETE /api/config/:key` - 删除配置

删除指定配置项。

**认证**: 需要（超级管理员权限）

**URL参数**: `key` - 配置键名

**返回**: 操作结果

---

### `PUT /api/config/batch` - 批量更新配置

批量更新多个配置项。

**认证**: 需要（管理员权限）

**请求体**:
```json
{
  "configs": [
    {
      "key": "string",
      "value": "string"
    }
  ],
  "changeReason": "string?"
}
```

**返回**: 
- results - 更新结果列表
- updated - 更新数量

---

### `POST /api/config/reset/:key` - 重置配置为默认值

将指定配置重置为系统默认值。

**认证**: 需要（超级管理员权限）

**URL参数**: `key` - 配置键名

**返回**: 重置后的配置值

---

### `POST /api/config/analytics/events` - 记录分析事件

记录用户行为分析事件。

**请求体**:
```json
{
  "userId": "string?",
  "sessionId": "string?",
  "eventType": "string (必填)",
  "eventData": "object?",
  "referer": "string?"
}
```

**返回**: 事件ID

---

### `GET /api/config/analytics/stats` - 获取分析统计

获取分析事件统计数据。

**认证**: 需要（管理员权限）

**查询参数**:
- `days` - 统计天数（默认7）

**返回**: 
- totalEvents - 总事件数
- uniqueUsers - 独立用户数
- uniqueSessions - 独立会话数
- eventsByType - 按类型分组统计
- dailyEvents - 每日事件统计

---

### `GET /api/config/email/logs` - 获取邮件发送日志

获取邮件发送日志。

**认证**: 需要（管理员权限）

**查询参数**:
- `page` - 页码（默认1）
- `pageSize` - 每页数量（默认50，最大200）
- `type` - 邮件类型筛选
- `status` - 发送状态筛选

**返回**: 
- logs - 日志列表（包含用户名）
- total - 总数
- page - 页码
- pageSize - 每页数量

---

## 系统接口 `/api`

### `GET /api/public-config` - 获取公开配置

获取系统公开配置信息（无需认证）。

**返回**: 
- appVersion - 应用版本
- siteName - 网站名称
- siteDescription - 网站描述
- allowRegistration - 是否允许注册
- communityEnabled - 是否启用社区功能
- minUsernameLength - 用户名最小长度
- maxUsernameLength - 用户名最大长度
- minPasswordLength - 密码最小长度
- maxFavoritesPerUser - 每用户最大收藏数
- maxHistoryPerUser - 每用户最大历史数
- maxTagsPerUser - 每用户最大标签数
- features - 功能开关
- search - 搜索相关配置

---

### `GET /api/source-status-check` - 搜索源状态检查

检查指定搜索源的可用状态（带5分钟缓存）。

**查询参数**:
- `sourceId` - 搜索源ID（必填）

**返回**: 
- status - 状态（online/offline/error/timeout/restricted/unknown）
- available - 是否可用
- responseTime - 响应时间（毫秒）
- qualityScore - 质量分数（0-100）
- error - 错误信息（如有）
- cached - 是否来自缓存
- checkedUrl - 实际检测的URL

---

### `POST /api/source-status-batch` - 批量状态检查

批量检查多个搜索源的状态（并发执行，最多30个）。

**请求体**:
```json
{
  "sourceIds": ["string"]
}
```

**返回**: 
- results - 各搜索源状态列表
- checkedAt - 检查时间
- summary - 摘要（total/available/unavailable）

---

### `GET /api/source-status-batch` - 批量状态检查（GET方式）

批量查询多个搜索源的缓存状态（不触发新检查，最多50个）。

**查询参数**:
- `sourceIds` - 搜索源ID列表（逗号分隔）

**返回**: 各搜索源缓存状态列表（包含cacheAgeSeconds）

---

### `POST /api/record-action` - 记录用户行为

记录用户行为日志。

**请求体**:
```json
{
  "userId": "string?",
  "action": "string (必填)",
  "data": "object?"
}
```

**返回**: 行为记录ID

---

### `GET /api/stats` - 获取统计信息

获取系统统计数据。

**返回**: 
- users - 活跃用户数
- sources - 活跃搜索源数
- searches - 总搜索次数
- activeUsers - 本周活跃用户数
- activeUsersGrowthPercent - 活跃用户增长率

---

### `GET /api/health` - 健康检查

检查服务健康状态。

**返回**: 
- status - 状态（ok）
- timestamp - 时间戳
- version - 版本

---

### `GET /api/source-status-history/:sourceId` - 获取状态检查历史

获取指定搜索源的状态检查历史记录。

**URL参数**: `sourceId` - 搜索源ID

**查询参数**:
- `limit` - 返回数量（默认50）
- `hours` - 时间范围（默认24小时）

**返回**: 
- source - 搜索源信息
- history - 历史记录列表
- summary - 统计摘要（可用率、平均响应时间等）

---

### `DELETE /api/source-status-cache/:sourceId` - 清除状态缓存

清除指定搜索源的状态检查缓存。

**URL参数**: `sourceId` - 搜索源ID

**返回**: 操作结果

---

### `GET /api/user-actions` - 获取行为日志

查询用户行为日志。

**查询参数**:
- `userId` - 用户ID（可选）
- `action` - 行为类型（可选）
- `limit` - 返回数量（默认100）
- `offset` - 偏移量（默认0）

**返回**: 
- actions - 行为日志列表
- total - 总数
- limit - 限制
- offset - 偏移量

---

## API调用示例

```typescript
const API_BASE = '/api';

async function login(identifier: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('authToken', data.data.token);
    return data.data.user;
  }
  throw new Error(data.error?.message || '登录失败');
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('authToken');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
}

async function search(keyword: string, majorCategoryId?: string, categoryId?: string) {
  const response = await fetch(`${API_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyword, majorCategoryId, categoryId })
  });
  return response.json();
}

async function getFavorites() {
  const response = await fetchWithAuth(`${API_BASE}/user/favorites`);
  return response.json();
}

async function addFavorite(favorite: { title: string; url: string; subtitle?: string; icon?: string; keyword?: string }) {
  const response = await fetchWithAuth(`${API_BASE}/user/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(favorite)
  });
  return response.json();
}

async function getSearchSources(categoryId?: string) {
  const url = categoryId 
    ? `${API_BASE}/search-sources/?categoryId=${categoryId}`
    : `${API_BASE}/search-sources/`;
  const response = await fetch(url);
  return response.json();
}

async function createSearchSource(sourceData: object) {
  const response = await fetchWithAuth(`${API_BASE}/search-sources/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sourceData)
  });
  return response.json();
}

async function batchUpdateConfigs(configs: object[]) {
  const response = await fetchWithAuth(`${API_BASE}/search-sources/user-configs/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configs })
  });
  return response.json();
}

async function exportSources(format: string = 'json') {
  const response = await fetch(`${API_BASE}/search-sources/export?format=${format}`);
  if (format === 'json') {
    return response.json();
  }
  return response.blob();
}

async function checkSourceStatus(sourceId: string) {
  const response = await fetch(`${API_BASE}/source-status-check?sourceId=${sourceId}`);
  return response.json();
}

async function sendVerificationCode(email: string, type: string) {
  const response = await fetch(`${API_BASE}/auth/smart-send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, verificationType: type })
  });
  return response.json();
}

async function getTrendingSearches(hours: number = 24) {
  const response = await fetch(`${API_BASE}/search/trending?hours=${hours}`);
  return response.json();
}

async function getSearchSuggestions(keyword: string) {
  const response = await fetch(`${API_BASE}/search/suggestions?keyword=${encodeURIComponent(keyword)}`);
  return response.json();
}

async function getAdminStats() {
  const response = await fetchWithAuth(`${API_BASE}/admin/stats`);
  return response.json();
}

async function getAdminUsers(page: number = 1, search: string = '') {
  const url = `${API_BASE}/admin/users?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const response = await fetchWithAuth(url);
  return response.json();
}

async function updateUserStatus(userId: string, isActive: boolean, reason: string = '') {
  const response = await fetchWithAuth(`${API_BASE}/admin/users/${userId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive, reason })
  });
  return response.json();
}

async function getAdminReports(status: string = 'pending') {
  const response = await fetchWithAuth(`${API_BASE}/admin/reports?status=${status}`);
  return response.json();
}

async function handleReport(reportId: string, status: string, action: string, notes: string = '') {
  const response = await fetchWithAuth(`${API_BASE}/admin/reports/${reportId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, action, notes })
  });
  return response.json();
}

async function getUserActivities(limit: number = 100, offset: number = 0) {
  const response = await fetchWithAuth(`${API_BASE}/user/activities?limit=${limit}&offset=${offset}`);
  return response.json();
}

async function getUserActivitiesStats() {
  const response = await fetchWithAuth(`${API_BASE}/user/activities/stats`);
  return response.json();
}

async function getCommunityNotifications(page: number = 1) {
  const response = await fetchWithAuth(`${API_BASE}/community/notifications?page=${page}`);
  return response.json();
}

async function getDashboardOverview() {
  const response = await fetchWithAuth(`${API_BASE}/admin/dashboard/overview`);
  return response.json();
}

async function getConfigGroups() {
  const response = await fetchWithAuth(`${API_BASE}/config/groups`);
  return response.json();
}

async function resetConfig(key: string) {
  const response = await fetchWithAuth(`${API_BASE}/config/reset/${key}`, {
    method: 'POST'
  });
  return response.json();
}
```

---

## 路由注册汇总

后端路由注册顺序（index.ts）：

```typescript
app.route('/api/auth', authRoutes);              // 认证路由
app.route('/api/user', userRoutes);              // 用户路由
app.route('/api/search', searchRoutes);          // 搜索路由
app.route('/api/search-sources', sourceRoutes);  // 搜索源路由
app.route('/api/community', communityRoutes);    // 社区路由
app.route('/api/admin', adminRoutes);            // 管理员路由
app.route('/api/config', configRoutes);          // 配置路由
app.route('/api', systemRoutes);                // 系统路由
```

### 路由模块说明

| 模块 | 路由前缀 | 文件 | 功能 |
|------|---------|------|------|
| authRoutes | /api/auth | routes/auth.ts | 用户认证、登录注册、邮箱验证、密码管理 |
| userRoutes | /api/user | routes/user.ts | 用户设置、收藏、搜索历史、活动记录 |
| searchRoutes | /api/search | routes/search.ts | 搜索执行、历史管理、收藏、建议、热门 |
| sourceRoutes | /api/search-sources | routes/sources.ts | 搜索源CRUD、分类管理、用户配置 |
| communityRoutes | /api/community | routes/community.ts | 社区分享、标签、评论、举报、通知 |
| adminRoutes | /api/admin | routes/admin.ts | 用户管理、举报处理、统计、日志、会话管理 |
| configRoutes | /api/config | routes/config.ts | 系统配置管理、分析事件、邮件日志 |
| systemRoutes | /api | routes/system.ts | 健康检查、状态检测、统计、行为记录 |

---

## 数据库表结构参考

项目使用Cloudflare D1 (SQLite)，数据库Schema分为4个文件：

### 核心表 (01_schema_core.sql)

| 表名 | 说明 |
|------|------|
| `roles` | 角色定义表（id, name, display_name, permissions, is_system, priority） |
| `users` | 用户基础信息表（id, username, email, password_hash, role_id, permissions, settings） |
| `user_sessions` | 用户会话表（id, user_id, token_hash, expires_at, ip_address, user_agent） |
| `user_favorites` | 用户收藏表（id, user_id, title, subtitle, url, icon, keyword） |
| `user_search_history` | 用户搜索历史表（id, user_id, query, source, results_count） |
| `user_actions` | 用户行为日志表（id, user_id, action, data, ip_address, user_agent） |
| `system_config` | 系统配置表（key, value, description, config_type, config_group, validation_rules） |
| `config