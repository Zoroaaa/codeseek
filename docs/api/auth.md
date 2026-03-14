# 认证接口 `/api/auth`

> [返回API目录](./index.md)

**认证方式**: 无全局中间件，各接口单独处理认证

---

## 目录

- [用户登录](#用户登录)
- [用户注册](#用户注册)
- [用户登出](#用户登出)
- [获取当前用户信息](#获取当前用户信息)
- [Token验证](#token验证)
- [Token刷新](#token刷新)
- [忘记密码](#忘记密码)
- [重置密码](#重置密码)
- [更改密码](#更改密码)
- [删除账户](#删除账户)
- [发送注册验证码](#发送注册验证码)
- [申请更改邮箱](#申请更改邮箱)
- [发送邮箱更改验证码](#发送邮箱更改验证码)
- [验证邮箱更改验证码](#验证邮箱更改验证码)
- [取消邮箱更改请求](#取消邮箱更改请求)
- [发送账户删除验证码](#发送账户删除验证码)
- [检查验证状态](#检查验证状态)
- [获取用户验证状态](#获取用户验证状态)
- [智能发送验证码](#智能发送验证码)

---

## 用户登录

### `POST /api/auth/login`

使用用户名或邮箱登录。

**认证**: 公开

**请求体**:
```json
{
  "identifier": "string",
  "password": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| identifier | string | 是 | 用户名或邮箱地址 |
| password | string | 是 | 密码 |

**返回**: 用户信息和JWT令牌

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "abc123",
      "username": "testuser",
      "email": "test@example.com",
      "permissions": [],
      "settings": {},
      "isActive": true,
      "emailVerified": false,
      "createdAt": 1704067200000,
      "lastLogin": 1704067200000,
      "loginCount": 1,
      "role": "user",
      "roleDisplayName": "普通用户"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "登录成功"
}
```

**错误码**:
| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `VALIDATION_ERROR` | 400 | 请输入用户名/邮箱和密码 |
| `AUTH_ERROR` | 401 | 用户名/邮箱或密码错误 |
| `LOCKED` | 423 | 账户已锁定 |

**安全机制**:
- 登录失败次数过多会触发账户锁定（默认1小时）
- 记录登录失败日志和安全事件
- 支持IP锁定机制

---

## 用户注册

### `POST /api/auth/register`

注册新用户账号。

**认证**: 公开

**请求体**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "verificationCode": "string?"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名（3-20字符，字母数字下划线） |
| email | string | 是 | 有效邮箱格式 |
| password | string | 是 | 密码（6-100字符） |
| verificationCode | string | 否 | 6位验证码（邮箱验证时需要） |

**返回**: 用户信息和JWT令牌

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "abc123",
      "username": "newuser",
      "email": "new@example.com",
      "permissions": ["search", "favorite", "history"],
      "settings": {},
      "isActive": true,
      "emailVerified": false,
      "createdAt": 1704067200000,
      "lastLogin": 1704067200000,
      "loginCount": 1
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "注册成功"
}
```

**错误码**:
| 错误码 | HTTP状态码 | 说明 |
|--------|-----------|------|
| `FORBIDDEN` | 403 | 注册功能已关闭 |
| `VALIDATION_ERROR` | 400 | 参数验证失败 |
| `VALIDATION_ERROR` | 400 | 用户名或邮箱已被注册 |

---

## 用户登出

### `POST /api/auth/logout`

登出当前会话。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 操作结果

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "登出成功"
}
```

---

## 获取当前用户信息

### `GET /api/auth/me`

获取当前登录用户的详细信息。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 用户信息对象

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "username": "testuser",
    "email": "test@example.com",
    "permissions": ["search", "favorite", "history"],
    "settings": {
      "theme": "dark",
      "language": "zh-CN"
    },
    "isActive": true,
    "emailVerified": true,
    "createdAt": 1704067200000,
    "lastLogin": 1704153600000,
    "loginCount": 10,
    "role": "user",
    "roleDisplayName": "普通用户"
  }
}
```

---

## Token验证

### `POST /api/auth/verify-token`

验证当前Token是否有效。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 验证结果和用户基本信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "userId": "abc123",
    "username": "testuser"
  }
}
```

---

## Token刷新

### `POST /api/auth/refresh`

刷新当前Token，延长会话有效期。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 新的JWT令牌

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Token刷新成功"
}
```

---

## 忘记密码

### `POST /api/auth/forgot-password`

发送密码重置验证码到邮箱。

**认证**: 公开

**请求体**:
```json
{
  "email": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 有效邮箱格式 |

**返回**: 脱敏邮箱、过期时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "maskedEmail": "t***@example.com",
    "expiresIn": 1800
  },
  "message": "如果该邮箱已注册，您将收到密码重置邮件"
}
```

**安全机制**:
- 无论邮箱是否注册，返回相同响应（防止邮箱枚举）
- 记录密码重置日志
- 支持发送频率限制

---

## 重置密码

### `POST /api/auth/reset-password`

使用验证码重置密码。

**认证**: 公开

**请求体**:
```json
{
  "email": "string",
  "code": "string",
  "newPassword": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| code | string | 是 | 6位验证码 |
| newPassword | string | 是 | 新密码（6-100字符） |

**返回**: 操作结果

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "密码重置成功，请重新登录"
}
```

**安全机制**:
- 验证码验证后自动清除
- 重置密码后清除所有会话

---

## 更改密码

### `PUT /api/auth/change-password`

修改当前用户密码。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| currentPassword | string | 是 | 当前密码 |
| newPassword | string | 是 | 新密码（6-100字符） |

**返回**: 操作结果

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "密码修改成功"
}
```

---

## 删除账户

### `DELETE /api/auth/account`

删除当前用户账户（需要验证码确认）。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "password": "string?",
  "verificationCode": "string",
  "confirmText": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| password | string | 否 | 当前密码（可选） |
| verificationCode | string | 是 | 6位验证码 |
| confirmText | string | 是 | 确认文字，必须为"删除我的账户" |

**返回**: 操作结果

**响应示例**:
```json
{
  "success": true,
  "data": null,
  "message": "账户已删除"
}
```

**安全机制**:
- 需要验证码确认
- 删除所有关联数据（会话、收藏、历史、配置）

---

## 发送注册验证码

### `POST /api/auth/send-registration-code`

向指定邮箱发送注册验证码。

**认证**: 公开

**请求体**:
```json
{
  "email": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 有效邮箱格式 |

**返回**: 脱敏邮箱、过期时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "maskedEmail": "t***@example.com",
    "expiresIn": 900
  },
  "message": "验证码已发送"
}
```

**安全机制**:
- 检查邮箱是否已注册
- 检查是否为临时邮箱
- 支持发送频率限制

---

## 申请更改邮箱

### `POST /api/auth/request-email-change`

创建邮箱更改请求。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "newEmail": "string",
  "currentPassword": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| newEmail | string | 是 | 新邮箱地址 |
| currentPassword | string | 是 | 当前密码 |

**返回**: 请求ID、脱敏邮箱、过期时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "requestId": "req_abc123",
    "oldEmail": "o***@old.com",
    "newEmail": "n***@new.com",
    "expiresIn": 1800
  },
  "message": "邮箱更改请求已创建，请验证新邮箱"
}
```

**安全机制**:
- 验证当前密码
- 检查新邮箱是否已被使用
- 检查是否有进行中的请求

---

## 发送邮箱更改验证码

### `POST /api/auth/send-email-change-code`

向原邮箱或新邮箱发送验证码。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "requestId": "string",
  "emailType": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 是 | 邮箱更改请求ID |
| emailType | string | 是 | 邮箱类型：`old` 或 `new` |

**返回**: 脱敏邮箱、过期时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "emailType": "new",
    "maskedEmail": "n***@new.com",
    "expiresIn": 900
  },
  "message": "验证码已发送"
}
```

---

## 验证邮箱更改验证码

### `POST /api/auth/verify-email-change-code`

验证并完成邮箱更改流程。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "requestId": "string",
  "emailType": "string",
  "code": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 是 | 邮箱更改请求ID |
| emailType | string | 是 | 邮箱类型：`old` 或 `new` |
| code | string | 是 | 6位验证码 |

**返回**: 是否完成、新邮箱（脱敏）

**响应示例**:
```json
{
  "success": true,
  "data": {
    "completed": true,
    "newEmail": "n***@new.com"
  },
  "message": "邮箱更改成功！"
}
```

---

## 取消邮箱更改请求

### `POST /api/auth/cancel-email-change-request`

取消当前进行中的邮箱更改请求。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**请求体**:
```json
{
  "requestId": "string"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| requestId | string | 是 | 邮箱更改请求ID |

**返回**: 操作结果

**响应示例**:
```json
{
  "success": true,
  "data": {
    "cancelled": true
  },
  "message": "邮箱更改请求已取消"
}
```

---

## 发送账户删除验证码

### `POST /api/auth/send-account-delete-code`

向当前用户邮箱发送账户删除确认验证码。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 脱敏邮箱、过期时间

**响应示例**:
```json
{
  "success": true,
  "data": {
    "maskedEmail": "t***@example.com",
    "expiresIn": 900
  },
  "message": "验证码已发送"
}
```

---

## 检查验证状态

### `GET /api/auth/verification-status`

检查指定邮箱的验证码状态（无需认证）。用于前端页面恢复逻辑：用户发送验证码后意外关闭或刷新页面，重新打开时调用此接口，若仍有未过期的验证码则直接展示验证码输入页面。

**认证**: 公开

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| type | string | 是 | 验证类型 |

**验证类型**:
- `registration` - 注册
- `forgot_password` - 忘记密码
- `password_reset` - 密码重置
- `email_change_old` - 邮箱更改（原邮箱）
- `email_change_new` - 邮箱更改（新邮箱）
- `account_delete` - 账户删除

**返回**: 验证状态信息

**响应示例**:
```json
{
  "success": true,
  "data": {
    "hasPendingVerification": true,
    "canResend": false,
    "remainingTime": 600000,
    "expiresAt": 1704067800000
  }
}
```

---

## 获取用户验证状态

### `GET /api/auth/user-verification-status`

获取当前用户的所有待处理验证。

**认证**: 需要

**请求头**:
```
Authorization: Bearer <token>
```

**返回**: 待处理验证列表、邮箱更改请求

**响应示例**:
```json
{
  "success": true,
  "data": {
    "pendingVerifications": [
      {
        "id": "ver_abc123",
        "email": "test@example.com",
        "verificationType": "email_change_new",
        "expiresAt": 1704067800000
      }
    ],
    "emailChangeRequest": {
      "id": "req_abc123",
      "oldEmail": "old@example.com",
      "newEmail": "new@example.com",
      "status": "pending",
      "expiresAt": 1704068400000
    },
    "hasAnyPendingVerifications": true
  }
}
```

---

## 智能发送验证码

### `POST /api/auth/smart-send-code`

根据验证类型智能发送验证码，自动处理重发间隔。

**认证**: 部分需要（password_reset/email_change_old/email_change_new/account_delete需要认证）

**请求体**:
```json
{
  "email": "string",
  "verificationType": "string",
  "force": "boolean?"
}
```

**参数说明**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| email | string | 是 | 邮箱地址 |
| verificationType | string | 是 | 验证类型 |
| force | boolean | 否 | 是否强制发送（忽略重发间隔） |

**验证类型**:
- `registration` - 注册（公开）
- `password_reset` - 密码重置（需要认证）
- `email_change_old` - 邮箱更改原邮箱（需要认证）
- `email_change_new` - 邮箱更改新邮箱（需要认证）
- `account_delete` - 账户删除（需要认证）

**返回**: 脱敏邮箱、过期时间、是否可重发

**响应示例**:
```json
{
  "success": true,
  "data": {
    "maskedEmail": "t***@example.com",
    "expiresIn": 900
  },
  "message": "验证码已发送"
}
```

**重发间隔控制**:
```json
{
  "success": true,
  "data": {
    "canResend": false,
    "reason": "验证码仍然有效",
    "waitTime": 300,
    "remainingTime": 600000
  },
  "message": "存在有效的验证码"
}
```
