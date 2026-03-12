一句话总结三层

wrangler：部署时决定，换域名/换环境才改（当前有大量业务配置混入，需清理）
constants：格式/枚举/正则，改了要改代码重新部署（当前有大量"后备值"重复了 DB，需删掉）
database：管理员在后台就能改，不需要重新部署（当前已完整，是整个系统的配置真相来源）





重构内容总览
wrangler.toml — 删掉 15 个 vars，只留 6 个
删除的 var迁移目标ALLOW_REGISTRATIONDB: enable_registrationMAX_FAVORITES_PER_USERDB: max_favoritesMAX_HISTORY_PER_USERDB: max_search_historyMAX_TAGS_PER_USERDB: max_tags_per_userCOMMUNITY_MAX_SHARES_PER_USERDB: community_max_shares_per_userCOMMUNITY_REQUIRE_APPROVALDB: community_require_approvalEMAIL_VERIFICATION_ENABLED/REQUIREDDB: 对应字段VERIFICATION_CODE_LENGTH/EXPIRYDB: 对应字段MAX_VERIFICATION_ATTEMPTSDB: max_verification_attemptsEMAIL_RATE_LIMIT_*DB: 对应字段ENABLE_SOURCE_STATUS_CHECKDB: source_check_enabledSOURCE_STATUS_CHECK_TIMEOUTDB: default_check_timeoutSOURCE_STATUS_CACHE_DURATIONDB: cache_duration_ms
保留的 6 个：APP_VERSION、APP_ENV、SITE_URL、DEFAULT_FROM_EMAIL、DEFAULT_FROM_NAME、JWT_EXPIRY_DAYS、ENABLE_ACTION_LOGGING（你说的两个值已更正）。
backend/src/constants.ts — 删掉所有"后备值"分组
删除了 VALIDATION 的长度数字、SECURITY 所有数值、Email 整个分组、Pagination 分组、Community 分组、Search 分组、Cleanup 分组、SourceStatus 分组。
新增 DB_CONFIG_KEYS：将所有 DB key 字符串集中到一个常量对象，避免各路由散落的拼写错误（以前 auth.ts 写 'enable_registration'、其他地方可能写错）。
backend/src/types/index.ts — Env 接口清理
删除了 15 个业务 var 的类型声明，加了注释说明哪些已迁移到 DB。
backend/src/routes/system.ts — public-config 接口重写
原来全部读 c.env.*，现在用 ConfigService + Promise.all 并行读 DB，返回结构也更完整（增加 features、search 子对象供前端 ConfigContext 消费）。
backend/src/routes/auth.ts — 两处修复
if (!enableRegistration && c.env.ALLOW_REGISTRATION !== 'true') 改为 if (!enableRegistration)，去掉了不一致的双重判断。所有 configService.getInt/getBoolean 调用改用 DB_CONFIG_KEYS 常量。
backend/src/routes/user.ts — 清理 env 直读
parseInt(c.env.MAX_FAVORITES_PER_USER || ...) 改为 configService.getInt(DB_CONFIG_KEYS.MAX_FAVORITES, 1000)，与同文件其他位置保持一致。
frontend/src/constants.ts — 删掉所有业务数字
删除了 VALIDATION_RULES 中的长度数字、SECURITY_CONFIG、COMMUNITY_CONFIG、SEARCH_CONFIG、SEARCH_HISTORY_CONFIG、APP_INFO（保留 APP_INFO_FALLBACK 仅作骨架屏占位）。正则表达式重命名为 VALIDATION_REGEX，明确它们是格式规则不是业务参数。