**CodeSeek 2.0  前后端 API 对照审计报告**

审计范围：backend/src/routes/  vs  frontend/src/services/api/  vs  pages/hooks/stores/

**汇总**

**问题分类**

**数量**

**严重程度**

后端有、前端 API 定义有、但页面从未调用

28 个方法

低（代码冗余，无运行时错误）

前端调用、后端路由不存在（404）

2 个接口

高（实际调用会失败）

参数或返回字段不匹配

3 个接口

中/高（source-status-history 字段名错误）

重复定义同一接口

2 组

低（维护隐患）

直接用 apiClient 绕过封装层

4 处

中（可维护性差）

后端有、前端无任何封装

5 个接口

低（功能可用，但不一致）

**一、后端提供但前端未调用的 API**

以下接口在后端路由中已实现，前端 services/api/ 中也定义了对应方法，但在 pages/、hooks/、stores/ 中没有任何实际调用。

**1.1  admin 路由（/api/admin）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/admin/dashboard/overview

adminApi.getDashboardOverview()

AdminPanelOverview 直接用 apiClient 调用，方法本身从未使用

GET

/api/admin/stats

adminApi.getStats()

未在任何页面中调用

GET

/api/admin/active-users

adminApi.getActiveUsers()

未在任何页面中调用

GET

/api/admin/login-stats

adminApi.getLoginStats()

未在任何页面中调用

GET

/api/admin/users/:id/login-logs

adminApi.getUserLoginLogs()

未在任何页面中调用

**1.2  auth 路由（/api/auth）**

**方法**

**路径**

**前端方法名**

**说明**

POST

/api/auth/refresh

authApi.refreshToken()

定义但从未调用；登录态续期未实现

POST

/api/auth/verify-token

authApi.verifyToken()

定义但从未调用

POST

/api/auth/send-password-reset-code

authApi.sendPasswordResetCode()

忘记密码页面用 forgotPassword() 而非此接口

*⚠  /api/auth/forgot-password（authApi.forgotPassword）与 /api/auth/send-password-reset-code 是两个功能不同的接口，前者同时发码并校验，后者仅发验证码。前端只使用了 forgot-password。*

**1.3  community 路由（/api/community）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/community/tags/:id

communityApi.getTag()

后端有此路由，前端方法已定义，但页面从未调用

GET

/api/community/sources/:id

communityApi.getSharedSource()

浏览页直接内联数据，未单独获取详情

GET

/api/community/sources/recent

communityApi.getRecentSources()

未在任何页面中调用

GET

/api/community/sources/search

communityApi.searchSources()

未在任何页面中调用（浏览页用 getSharedSources 传 search 参数）

PUT

/api/community/sources/:id/status

approveSharedSource() / rejectSharedSource()

后端实际无独立 /status 子路由；见二2.1说明

PUT

/api/community/reviews/:id

communityApi.updateReview()

未在任何页面中调用

DELETE

/api/community/reviews/:id

communityApi.deleteReview()

未在任何页面中调用

**1.4  search-sources 路由（/api/search-sources）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/search-sources/:id

sourceApi.getSource()

未在任何页面中调用

GET

/api/search-sources/major-categories/:id

sourceApi.getMajorCategory()

未在任何页面中调用

GET

/api/search-sources/categories/:id

sourceApi.getCategory()

未在任何页面中调用

GET

/api/search-sources/popular

sourceApi.getPopularSources()

未在任何页面中调用

GET

/api/search-sources/search

sourceApi.searchSources()

未在任何页面中调用

GET

/api/search-sources/user-configs/:userId

（无对应前端方法）

后端存在；前端 getUserSourceConfigs() 调用的是 /user/source-configs

GET

/api/search-sources/export-user-configs/:userId

sourceApi.exportUserConfigs()

方法已定义，但页面无任何调用入口

**1.5  system 路由（/api/*）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/health

systemApi.healthCheck()

未在任何页面中调用

GET

/api/stats

systemApi.getStats()

未在任何页面中调用

GET

/api/source-status-history/:sourceId

sourceApi.getSourceStatusHistory()

方法已定义，但页面无任何调用；另有字段不匹配问题见第三节

DELETE

/api/source-status-cache/:sourceId

sourceApi.clearSourceStatusCache()

方法已定义，但页面无调用入口

**1.6  user 路由（/api/user）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/user/settings

userApi.getSettings()

设置页只调用 updateSettings()，从未读取

POST

/api/user/search-history

userApi.saveSearchHistory()

搜索历史由后端搜索接口自动记录，前端从未主动调用此接口

GET

/api/user/activities

userApi.getActivities()

UserActivitiesPage 直接用 apiClient.get() 调用，方法本身从未使用

GET

/api/user/source-configs

userApi.getSourceConfigs()

sourceApi.getUserSourceConfigs() 和 userApi.getSourceConfigs() 均指向此路径，两者都从未被调用

**1.7  config 路由（/api/config）**

**方法**

**路径**

**前端方法名**

**说明**

GET

/api/config/all

configApi.getAllConfigs()

未在任何页面中调用

GET

/api/config/:key

configApi.getConfigByKey()

未在任何页面中调用

DELETE

/api/config/:key

configApi.deleteConfig()

未在任何页面中调用

PUT

/api/config/batch

configApi.batchUpdateConfig()

未在任何页面中调用

GET

/api/config/analytics/stats

analyticsApi.getStats()

未在任何页面中调用（analyticsApi.recordEvent 有被调用）

**二、前端调用了但后端未对应提供的 API**

以下情况属于前端实际发出请求，但后端路由不存在或接口语义不匹配。

**前端调用路径**

**调用位置**

**问题描述**

GET /api/config

systemApi.getConfig()

后端 config 路由无 GET / 根路径，仅有 /public、/all、/groups、/:key 等子路径。此方法如被调用将返回 404。

PUT /community/sources/:id/status

approveSharedSource() / rejectSharedSource()

后端只有 PUT /community/sources/:id（通用更新），无 /status 子路由。前端两个方法向 /sources/:id/status 发请求，后端实际 404。

**三、前后端参数或返回字段不匹配**

以下接口路径匹配，但请求参数或响应字段存在差异，会导致功能异常。

**接口**

**问题类型**

**前端行为**

**后端实际**

**风险**

GET /api/source-status-check

多余请求参数

传 sourceId + keyword

只读取 sourceId，keyword 被忽略

低（功能可用，无副作用）

POST /api/source-status-batch

多余请求参数

传 { sourceIds, keyword }

只解构 sourceIds，keyword 被丢弃

低（功能可用，无副作用）

GET /api/source-status-history/:sourceId

响应字段名不匹配

前端期望 history[].checkedAt (string)

后端返回 history 中的字段为 created_at (number)

高（如调用此接口则 UI 展示为空/undefined）

**四、其他值得关注的问题**

**4.1  重复定义（两处定义同一接口）**

**接口路径**

**重复定义位置**

**说明**

GET /api/config/public

configApi.getPublicConfig() + systemApi.getPublicConfig()

两个方法调用完全相同的路径。实际使用的是 configApi.getPublicConfig()（通过 configService），systemApi.getPublicConfig() 从未被调用。

GET /api/user/source-configs

sourceApi.getUserSourceConfigs() + userApi.getSourceConfigs()

两个方法调用完全相同的路径，两者均未被任何页面调用。

**4.2  绕过封装、直接使用 apiClient 调用的接口**

以下接口在页面中直接使用 apiClient.get/put() 发起请求，未通过 services/api/ 中的封装方法，存在维护风险：

**页面文件**

**直接调用路径**

**建议**

AdminPanelOverview.tsx

GET /admin/dashboard/overview

应使用 adminApi.getDashboardOverview()

ReportsTab.tsx

GET /admin/reports
PUT /admin/reports/:id

建议封装为 adminApi.getReports() / adminApi.handleReport()

NotificationsTab.tsx

GET /community/notifications

建议封装为 communityApi.getNotifications()

UserActivitiesPage.tsx

GET /user/activities
GET /user/activities/stats

应使用 userApi.getActivities() 和 userApi.getActivitiesStats()

**4.3  后端有但前端完全未定义（无封装方法）的接口**

**路径**

**所属路由文件**

**说明**

GET /api/admin/reports

admin.ts

ReportsTab 直接调用，无封装

PUT /api/admin/reports/:id

admin.ts

ReportsTab 直接调用，无封装

GET /api/community/notifications

community.ts

NotificationsTab 直接调用，无封装

GET /api/source-status-batch (GET)

system.ts

后端有 GET 版本，前端只用了 POST 版本

GET /api/search-sources/user-configs/:userId

sources.ts

后端存在但前端无对应封装；实际用的是 /user/source-configs