# CodeSeek 配置说明文档 (v2.0.0)

本文档详细说明CodeSeek项目的配置系统，包括前端配置、后端配置和环境变量设置。

---

## 目录

- [前端配置](#前端配置)
- [后端配置](#后端配置)
- [环境变量](#环境变量)
- [代理服务配置](#代理服务配置)
- [数据库配置](#数据库配置)
- [角色权限配置](#角色权限配置)

---

## 前端配置

### Vite配置 (vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['lucide-react', 'clsx'],
          state: ['zustand'],
          utils: ['date-fns']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true
      }
    }
  }
})
```

### Tailwind CSS配置 (tailwind.config.js)

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      }
    },
  },
  plugins: [],
}
```

### TypeScript配置 (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### API客户端配置 (services/api/client.ts)

```typescript
const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
}

const apiClient = {
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_CONFIG.baseURL}${endpoint}`
    const token = localStorage.getItem('authToken')
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }
    
    return response.json()
  }
}
```

---

## 后端配置

### Wrangler配置 (wrangler.toml)

```toml
name = "codeseek-backend"
main = "src/index.ts"
compatibility_date = "2024-09-09"

[vars]
ENVIRONMENT = "production"
APP_VERSION = "2.0.0"

[[d1_databases]]
binding = "DB"
database_name = "codeseek-db"
database_id = "your-database-id"

[env.development]
name = "codeseek-backend-dev"
vars = { ENVIRONMENT = "development" }

[env.production]
name = "codeseek-backend"
vars = { ENVIRONMENT = "production" }
```

### Hono应用配置 (src/index.ts)

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'

const app = new Hono()

app.use('*', cors({
  origin: ['https://codeseek.pp.ua', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use('*', logger())
app.use('*', secureHeaders())

export default app
```

### 常量配置 (src/constants.ts)

```typescript
export const APP_CONFIG = {
  APP_NAME: 'CodeSeek',
  APP_VERSION: '2.0.0',
  
  JWT_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN: '30d',
  
  VERIFICATION_CODE_EXPIRY: 10 * 60 * 1000,
  VERIFICATION_RESEND_INTERVAL: 60 * 1000,
  
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000,
}

export const LIMITS = {
  MAX_TAGS_PER_USER: 50,
  MAX_SHARES_PER_USER: 50,
  MAX_FAVORITES_PER_USER: 1000,
  MAX_HISTORY_PER_USER: 1000,
  
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 20,
  PASSWORD_MIN_LENGTH: 6,
  PASSWORD_MAX_LENGTH: 100,
}

export const ALLOWED_ACTIONS = [
  'search', 'login', 'logout', 'register', 'visit_site', 'copy_url',
  'favorite_add', 'favorite_remove', 'settings_update', 'export_data',
  'sync_data', 'page_view', 'session_start', 'session_end',
  'custom_source_add', 'custom_source_edit', 'custom_source_delete',
  'tag_created', 'tag_updated', 'tag_deleted',
  'major_category_create', 'major_category_update', 'major_category_delete',
  'source_category_create', 'source_category_update', 'source_category_delete',
  'search_source_create', 'search_source_update', 'search_source_delete',
  'user_source_config_update', 'search_sources_export'
] as const
```

---

## 环境变量

### 前端环境变量 (.env)

```bash
VITE_API_URL=/api
VITE_APP_NAME=CodeSeek
VITE_APP_VERSION=2.0.0
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG=false
```

### 后端环境变量 (Cloudflare Workers Secrets)

在Cloudflare Dashboard中设置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `JWT_SECRET` | JWT签名密钥 | `your-super-secret-key-min-32-chars` |
| `RESEND_API_KEY` | Resend邮件服务API密钥 | `re_xxxxxxxxxxxx` |
| `DEFAULT_FROM_EMAIL` | 默认发件人邮箱 | `noreply@yourdomain.com` |
| `DEFAULT_FROM_NAME` | 默认发件人名称 | `磁力快搜` |
| `SITE_URL` | 网站URL | `https://codeseek.pp.ua` |

### 设置环境变量命令

```bash
# 使用Wrangler设置密钥
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY

# 或在Cloudflare Dashboard中设置
# Workers & Pages > codeseek-backend > Settings > Variables
```

---

## 代理服务配置

> **注意**: 代理服务已独立为 [OmniBox](https://github.com/Zoroaaa/OmniBox) 项目，以下为历史参考。

### 代理配置 (services/proxy/proxy-config.ts)

```typescript
export const PROXY_CONFIG = {
  enabled: true,
  
  cache: {
    enabled: true,
    ttl: {
      HTML: 5 * 60 * 1000,
      CSS: 60 * 60 * 1000,
      JS: 60 * 60 * 1000,
      IMAGE: 24 * 60 * 60 * 1000,
      FONT: 7 * 24 * 60 * 60 * 1000,
      API: 60 * 1000,
      OTHER: 30 * 60 * 1000,
    }
  },
  
  concurrency: {
    maxConcurrent: 10,
    queueSize: 100,
  },
  
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
  }
}
```

---

## 数据库配置

### D1数据库创建

```bash
# 创建数据库
wrangler d1 create codeseek-db

# 查看数据库信息
wrangler d1 info codeseek-db

# 执行迁移
wrangler d1 migrations apply codeseek-db
```

### 数据库迁移文件

数据库迁移文件位于 `database/` 目录：

```
database/
├── 01_user_management.sql      # 用户管理（基础模块）
├── 02_search_engine.sql        # 搜索引擎核心
├── 03_community.sql            # 社区功能
├── 04_search_source.sql        # 搜索源管理（含50+预置源）
├── 05_email_security.sql       # 邮箱验证与安全
├── 06_system_analytics.sql     # 系统配置与分析
├── 07_initialization_data.sql  # 初始化数据
└── 08_role_management.sql      # 角色权限管理
```

### 数据库初始化

```bash
# 按顺序执行SQL文件
cd backend

# 开发环境
wrangler d1 execute codeseek-db --local --file="../database/01_user_management.sql"
wrangler d1 execute codeseek-db --local --file="../database/02_search_engine.sql"
wrangler d1 execute codeseek-db --local --file="../database/03_community.sql"
wrangler d1 execute codeseek-db --local --file="../database/04_search_source.sql"
wrangler d1 execute codeseek-db --local --file="../database/05_email_security.sql"
wrangler d1 execute codeseek-db --local --file="../database/06_system_analytics.sql"
wrangler d1 execute codeseek-db --local --file="../database/07_initialization_data.sql"
wrangler d1 execute codeseek-db --local --file="../database/08_role_management.sql"

# 生产环境
wrangler d1 execute codeseek-db --remote --file="../database/01_user_management.sql"
# ... 其他文件（按相同顺序执行）
```

---

## 角色权限配置

### 系统角色

系统内置四种角色：

| 角色 | 权限级别 | 说明 |
|------|---------|------|
| super_admin | 100 | 超级管理员，拥有所有权限 |
| admin | 50 | 管理员，可管理用户和内容 |
| user | 10 | 普通用户，基本功能权限 |
| guest | 1 | 访客，仅搜索权限 |

### 权限列表

```typescript
// 超级管理员权限
const SUPER_ADMIN_PERMISSIONS = ['*'];

// 管理员权限
const ADMIN_PERMISSIONS = [
  'user:read', 'user:write',
  'stats:read',
  'report:read', 'report:write',
  'source:read', 'source:write',
  'community:read', 'community:write'
];

// 普通用户权限
const USER_PERMISSIONS = [
  'search', 'favorite', 'history', 'sync',
  'community:share', 'community:review'
];

// 访客权限
const GUEST_PERMISSIONS = ['search'];
```

### 权限中间件使用

```typescript
import { authMiddleware, roleMiddleware, permissionMiddleware } from './middleware';

// 需要认证的路由
app.use('/api/user/*', authMiddleware);

// 需要管理员权限的路由
app.use('/api/admin/*', authMiddleware, adminMiddleware);

// 需要特定权限的路由
app.post('/api/sources', 
  authMiddleware, 
  roleMiddleware, 
  permissionMiddleware('source:write'),
  createSourceHandler
);
```

---

## 配置最佳实践

### 安全建议

1. **密钥管理**
   - 使用强随机密钥（至少32字符）
   - 定期轮换JWT密钥
   - 不要在代码中硬编码密钥

2. **CORS配置**
   - 仅允许可信域名
   - 生产环境禁用 `*` 通配符
   - 启用credentials时需指定具体域名

3. **环境隔离**
   - 开发和生产使用不同的数据库
   - 使用不同的API密钥
   - 区分日志级别

### 性能优化

1. **缓存策略**
   - 静态资源使用长期缓存
   - API响应使用适当TTL
   - 启用CDN缓存

2. **资源优化**
   - 启用代码分割
   - 使用Tree-shaking
   - 压缩静态资源

3. **数据库优化**
   - 创建必要的索引
   - 使用参数化查询
   - 定期清理过期数据
