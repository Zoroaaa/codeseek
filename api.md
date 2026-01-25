### 认证接口
- `POST /api/auth/register` - 用户注册
  - **参数**: `username`, `email`, `password`
  - **返回**: 用户信息和JWT令牌

- `POST /api/auth/login` - 用户登录
  - **参数**: `email`, `password`
  - **返回**: 用户信息和JWT令牌

- `POST /api/auth/verify-token` - Token验证
  - **参数**: `token`
  - **返回**: 验证结果和用户信息

- `POST /api/auth/logout` - 用户登出
  - **参数**: 无
  - **返回**: 操作结果

- `POST /api/auth/change-password` - 更改密码
  - **参数**: `currentPassword`, `newPassword`
  - **返回**: 操作结果

- `DELETE /api/auth/delete-account` - 删除账户
  - **参数**: `password`
  - **返回**: 操作结果

- `POST /api/auth/verify-email` - 发送邮箱验证邮件
  - **参数**: 无
  - **返回**: 操作结果

- `GET /api/auth/verify-email/:token` - 验证邮箱
  - **参数**: URL参数 `token`
  - **返回**: 验证结果和重定向

### 用户数据接口
- `GET /api/user/settings` - 获取用户设置
  - **参数**: 无
  - **返回**: 用户设置对象

- `PUT /api/user/settings` - 更新用户设置
  - **参数**: 部分或全部用户设置
  - **返回**: 更新后的设置

- `GET /api/user/favorites` - 获取收藏列表
  - **参数**: `page`, `limit`
  - **返回**: 收藏列表和分页信息

- `POST /api/user/favorites` - 同步收藏数据
  - **参数**: `favorites` (收藏数据数组)
  - **返回**: 同步结果

- `GET /api/user/search-history` - 获取搜索历史
  - **参数**: `page`, `limit`, `startDate`, `endDate`
  - **返回**: 搜索历史记录

- `POST /api/user/search-history` - 保存搜索记录
  - **参数**: `query`, `source`, `timestamp`
  - **返回**: 保存结果

- `DELETE /api/user/search-history/:id` - 删除历史记录
  - **参数**: URL参数 `id`
  - **返回**: 删除结果

### 搜索源管理接口
- `GET /api/search-sources/major-categories` - 获取主要分类
  - **参数**: 无
  - **返回**: 主要分类列表

- `GET /api/search-sources/categories` - 获取所有分类
  - **参数**: `majorCategoryId` (可选)
  - **返回**: 分类列表

- `GET /api/search-sources/sources` - 获取所有搜索源
  - **参数**: `categoryId`, `enabled` (可选)
  - **返回**: 搜索源列表

- `GET /api/search-sources/user-configs` - 获取用户搜索源配置
  - **参数**: 无
  - **返回**: 用户配置的搜索源设置

- `GET /api/search-sources/stats` - 获取搜索源统计
  - **参数**: `startDate`, `endDate` (可选)
  - **返回**: 搜索源使用统计数据

- `GET /api/search-sources/export` - 导出搜索源配置
  - **参数**: 无
  - **返回**: JSON格式的配置文件

### 社区接口
- `GET /api/community/tags` - 获取标签列表
  - **参数**: `search`, `page`, `limit` (可选)
  - **返回**: 标签列表

- `POST /api/community/tags` - 创建标签
  - **参数**: `name`, `description`, `color`
  - **返回**: 创建的标签信息

- `GET /api/community/sources` - 获取社区搜索源
  - **参数**: `search`, `categoryId`, `page`, `limit` (可选)
  - **返回**: 社区贡献的搜索源列表

- `POST /api/community/sources` - 提交搜索源
  - **参数**: 搜索源配置信息
  - **返回**: 提交结果

- `GET /api/community/sources/:id` - 获取源详情
  - **参数**: URL参数 `id`
  - **返回**: 搜索源详细信息

### 系统接口
- `GET /api/health` - 健康检查
  - **参数**: 无
  - **返回**: 系统健康状态

- `GET /api/sources/status` - 搜索源状态
  - **参数**: 无
  - **返回**: 所有搜索源的实时状态

- `GET /api/config` - 获取系统配置
  - **参数**: 无
  - **返回**: 系统配置信息

### API调用示例
```javascript
// 使用Fetch API调用登录接口
async function login(email, password) {
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (response.ok) {
      // 保存token
      localStorage.setItem('authToken', data.token);
      return data.user;
    } else {
      throw new Error(data.message || '登录失败');
    }
  } catch (error) {
    console.error('登录错误:', error);
    throw error;
  }
}

// 带认证的API调用
async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('authToken');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  return fetch(url, { ...options, headers });
}
```
