# CodeSeek 2.0 API 对照审计修复方案

## 概述

根据 `api_audit_report.md` 审计报告，本方案按照"有问题修复、有缺失新增、有bug优化、有重复择优、有冗余全局清除"的原则，分阶段、分步骤执行修复工作。

---

## 阶段一：高优先级问题修复（阻断性Bug）

### 1.1 前端调用但后端不存在的接口（404错误）

#### 问题1：`GET /api/config` 路由不存在

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/services/api/system.ts` 第97-99行 |
| **问题描述** | `systemApi.getConfig()` 调用 `/config`，但后端 config 路由无根路径 |
| **修复方案** | 删除 `systemApi.getConfig()` 方法（该功能已被 `configApi` 覆盖） |

**修复步骤**：
1. 删除 `frontend/src/services/api/system.ts` 中的 `getConfig` 方法
2. 检查是否有页面调用此方法，如有则改用 `configApi.getAllConfigs()`

---

#### 问题2：`PUT /community/sources/:id/status` 路由不存在

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/services/api/community.ts` 第181-187行 |
| **问题描述** | `approveSharedSource()` 和 `rejectSharedSource()` 向 `/sources/:id/status` 发请求，后端只有 `PUT /sources/:id` |
| **后端实际** | `backend/src/routes/community.ts` 第672-726行 `PUT /sources/:id` 通用更新 |
| **修复方案** | 修改前端方法，直接调用 `PUT /community/sources/:id` |

**修复步骤**：
1. 修改 `communityApi.approveSharedSource()` 调用 `PUT /community/sources/:id` 并传 `{ status: 'active' }`
2. 修改 `communityApi.rejectSharedSource()` 调用 `PUT /community/sources/:id` 并传 `{ status: 'rejected', reason }`

---

### 1.2 参数或返回字段不匹配

#### 问题3：`GET /api/source-status-history/:sourceId` 字段名不匹配

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/services/api/source.ts` 第493-512行 |
| **问题描述** | 前端期望 `history[].checkedAt` (string)，后端返回 `created_at` (number) |
| **后端实际** | `backend/src/routes/system.ts` 第355-385行 |
| **修复方案** | 后端返回数据时进行字段映射 |

**修复步骤**：
1. 修改后端 `system.ts` 第377-380行，将 `created_at` 映射为 `checkedAt`
2. 添加 `checkedAt` 字段格式化为 ISO 字符串

---

## 阶段二：中优先级问题优化（可维护性）

### 2.1 绕过封装层直接使用 apiClient 的接口

#### 问题4：AdminPanelOverview.tsx 直接调用 apiClient

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/pages/admin/AdminPanelOverview.tsx` 第175行 |
| **问题描述** | 直接使用 `apiClient.get('/admin/dashboard/overview')` |
| **修复方案** | 改用 `adminApi.getDashboardOverview()` |

**修复步骤**：
1. 导入 `adminApi`
2. 将 `apiClient.get()` 改为 `adminApi.getDashboardOverview()`

---

#### 问题5：ReportsTab.tsx 直接调用 apiClient

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/pages/admin/ReportsTab.tsx` |
| **问题描述** | 直接调用 `GET /admin/reports` 和 `PUT /admin/reports/:id` |
| **修复方案** | 在 `adminApi` 中新增封装方法 |

**修复步骤**：
1. 在 `frontend/src/services/api/admin.ts` 新增 `getReports()` 方法
2. 在 `frontend/src/services/api/admin.ts` 新增 `handleReport()` 方法
3. 修改 ReportsTab.tsx 使用新方法

---

#### 问题6：NotificationsTab.tsx 直接调用 apiClient

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/pages/community/NotificationsTab.tsx` |
| **问题描述** | 直接调用 `GET /community/notifications` |
| **修复方案** | 在 `communityApi` 中新增封装方法 |

**修复步骤**：
1. 在 `frontend/src/services/api/community.ts` 新增 `getNotifications()` 方法
2. 修改 NotificationsTab.tsx 使用新方法

---

#### 问题7：UserActivitiesPage.tsx 直接调用 apiClient

| 项目 | 内容 |
|------|------|
| **问题位置** | `frontend/src/pages/dashboard/UserActivitiesPage.tsx` |
| **问题描述** | 直接调用 `GET /user/activities` 和 `GET /user/activities/stats` |
| **修复方案** | 使用已有的 `userApi.getActivities()` 并新增 `getActivitiesStats()` |

**修复步骤**：
1. 检查 `userApi` 是否有 `getActivitiesStats()` 方法
2. 如无则新增
3. 修改 UserActivitiesPage.tsx 使用封装方法

---

### 2.2 后端有但前端无封装的接口

#### 问题8：缺少 admin 相关接口封装

| 接口 | 封装位置 |
|------|----------|
| `GET /api/admin/reports` | adminApi.getReports() |
| `PUT /api/admin/reports/:id` | adminApi.handleReport() |

#### 问题9：缺少 community 相关接口封装

| 接口 | 封装位置 |
|------|----------|
| `GET /api/community/notifications` | communityApi.getNotifications() |

#### 问题10：缺少 system 相关接口封装

| 接口 | 说明 |
|------|------|
| `GET /api/source-status-batch` (GET版本) | 后端有GET版本，前端只用了POST版本，可保留现状 |

---

## 阶段三：低优先级问题清理（代码冗余）

### 3.1 重复定义的接口（择优保留）

#### 问题11：`GET /api/config/public` 重复定义

| 项目 | 内容 |
|------|------|
| **重复位置** | `configApi.getPublicConfig()` 和 `systemApi.getPublicConfig()` |
| **使用情况** | 实际使用 `configApi.getPublicConfig()` |
| **修复方案** | 删除 `systemApi.getPublicConfig()` |

**修复步骤**：
1. 删除 `frontend/src/services/api/system.ts` 中的 `getPublicConfig` 方法
2. 确认无其他地方调用此方法

---

#### 问题12：`GET /api/user/source-configs` 重复定义

| 项目 | 内容 |
|------|------|
| **重复位置** | `sourceApi.getUserSourceConfigs()` 和 `userApi.getSourceConfigs()` |
| **使用情况** | 两者均未被调用 |
| **修复方案** | 保留 `sourceApi.getUserSourceConfigs()`，删除 `userApi.getSourceConfigs()` |

---

### 3.2 从未调用的API方法（全局清除）

以下方法定义但从未被任何页面调用，建议分批评估后决定是否保留或删除：

#### admin.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `getStats()` | 保留（管理员统计功能可能后续使用） |
| `getActiveUsers()` | 保留 |
| `getLoginStats()` | 保留 |
| `getUserLoginLogs()` | 保留 |

#### auth.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `refreshToken()` | 保留（登录态续期功能需要） |
| `verifyToken()` | 保留（Token验证功能需要） |
| `sendPasswordResetCode()` | 删除（已被 `forgotPassword()` 替代） |

#### community.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `getTag()` | 保留（标签详情功能可能需要） |
| `getSharedSource()` | 保留（搜索源详情功能可能需要） |
| `getRecentSources()` | 保留 |
| `searchSources()` | 删除（已被 `getSharedSources` 的 search 参数替代） |
| `updateReview()` | 保留（用户可能需要修改评论） |
| `deleteReview()` | 保留 |

#### source.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `getSource()` | 保留 |
| `getMajorCategory()` | 保留 |
| `getCategory()` | 保留 |
| `getPopularSources()` | 保留 |
| `searchSources()` | 保留 |
| `exportUserConfigs()` | 保留（用户配置导出功能） |
| `getSourceStatusHistory()` | 修复字段后保留 |
| `clearSourceStatusCache()` | 保留 |

#### system.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `healthCheck()` | 保留（健康检查接口） |
| `getStats()` | 保留 |

#### config.ts 中未使用的方法
| 方法 | 建议 |
|------|------|
| `getAllConfigs()` | 保留（管理员配置管理需要） |
| `getConfigByKey()` | 保留 |
| `deleteConfig()` | 保留 |
| `batchUpdateConfig()` | 保留 |
| `analyticsApi.getStats()` | 保留 |

---

## 执行计划

### 第一阶段：高优先级修复（预计1-2小时）
1. 修复 `systemApi.getConfig()` 404问题
2. 修复 `approveSharedSource()` 和 `rejectSharedSource()` 404问题
3. 修复 `source-status-history` 字段不匹配问题
4. 运行 lint 和 typecheck 验证

### 第二阶段：中优先级优化（预计2-3小时）
1. 封装 ReportsTab 相关API
2. 封装 NotificationsTab 相关API
3. 封装 UserActivitiesPage 相关API
4. 修改 AdminPanelOverview 使用封装方法
5. 运行 lint 和 typecheck 验证

### 第三阶段：低优先级清理（预计1小时）
1. 删除重复定义的方法
2. 评估并清理未使用的API方法
3. 运行 lint 和 typecheck 验证

### 第四阶段：全面测试
1. 运行前端构建测试
2. 运行后端构建测试
3. 功能回归测试

---

## 风险评估

| 风险项 | 等级 | 缓解措施 |
|--------|------|----------|
| 删除方法可能影响隐藏调用 | 低 | 全局搜索确认无调用 |
| 修改接口路径可能影响功能 | 中 | 修改后进行功能测试 |
| 字段映射可能遗漏边界情况 | 低 | 添加默认值处理 |

---

## 验收标准

1. 所有高优先级问题修复完成，无404错误
2. 所有页面使用封装后的API方法
3. 无重复定义的API方法
4. `npm run lint` 无错误
5. `npm run typecheck` 无错误
6. `npm run build` 成功
