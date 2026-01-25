# 磁力快搜 - codeseek

<div align="center">

![Logo](frontend/images/logo.png)

**一个现代化的磁力搜索聚合平台**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.3.1-blue.svg)](https://github.com/yourusername/magnet-search)
[![Cloudflare](https://img.shields.io/badge/Powered%20by-Cloudflare-orange.svg)](https://www.cloudflare.com/)

</div>

## 🔗 快速访问

<div align="center">

| 资源类型 | 链接 | 备注 |
|---------|------|------|
| 📖 项目文档 | [完整介绍](https://zread.ai/Zoroaaa/codeseek) | 详细的项目说明和使用指南 |
| 🚀 在线演示 | [https://codeseek.pp.ua](https://codeseek.pp.ua) | 体验完整功能 |
| 🔑 演示密码 | `zoro666` | 代理网页访问密码 |
| 📧 技术支持 | [zoroasx@gmail.com](mailto:zoroasx@gmail.com) | 使用问题反馈 |

</div>

> **提示**: 演示站点仅供测试体验，请勿存储重要数据。生产环境建议自行部署。
=======


## ✨ 项目特色

- 🚀 **无框架架构**: 基于原生ES6模块化开发，无第三方框架依赖，极致轻量
- 🌐 **多源聚合搜索**: 同时整合多个主流磁力搜索站点结果
- 🔧 **高度可定制**: 支持添加、编辑、分类管理自定义搜索源
- ☁️ **Cloudflare生态**: 基于Cloudflare Workers和D1构建的无服务器架构
- 📱 **完美响应式**: 从移动设备到大屏显示器的无缝体验
- 🎨 **主题系统**: 内置亮色/暗色/自动三种主题模式
- 📋 **统一搜索管理**: 集中管理搜索流程、结果处理和缓存策略
- 🔐 **安全认证**: 基于JWT的安全用户认证系统
- 📧 **邮箱验证**: 增强账户安全的邮箱验证机制
- 🔌 **智能代理功能**: 内置完整代理服务，突破网络限制，提升访问体验
- 💾 **多层级缓存**: 智能缓存策略大幅提升搜索速度和用户体验
- 📊 **数据分析**: 内置搜索源状态监控和性能分析
- 👥 **社区功能**: 支持标签管理和搜索源分享

## 🏗️ 技术架构

### 前端技术栈
- **核心**: 原生JavaScript ES6+ 模块化
- **样式**: CSS3 + 响应式设计
- **存储**: LocalStorage + IndexedDB
- **部署**: Cloudflare Pages
- **版本**: v2.3.1

### 后端技术栈
- **运行时**: Cloudflare Workers
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT Token
- **API**: RESTful 风格
- **版本**: v2.1.0

### 代理服务
- **架构**: Cloudflare Workers边缘计算
- **功能**: URL重写、资源优化、请求转发
- **版本**: v3.1.0

### 项目结构
👉 [查看前后端项目结构说明](backend-frontend-tree.md)
## 🚀 快速开始
👉 [查看项目部署说明](deploy.md)

## 🎯 核心功能

### 1. 智能搜索系统
- **多源聚合**: 同时从多个主流磁力搜索站点获取结果
- **统一结果格式**: 将不同站点的结果规范化为统一格式
- **智能缓存**: 内置多层级缓存机制，大幅提升搜索速度
- **搜索建议**: 基于历史搜索记录和热门关键词的智能提示
- **源管理**: 用户可自由启用、禁用和优先排序搜索源
- **统一搜索管理**: 集中管理搜索流程、结果处理和性能优化
- **源状态检查**: 实时监控搜索源的可用性和响应速度

### 2. 智能代理功能
- **一键切换**: 简单易用的全局代理开关
- **健康检查**: 自动检测代理服务器状态和响应时间
- **域名支持**: 支持多个搜索源域名的代理访问
- **资源类型智能缓存**: 基于资源类型的TTL缓存策略
  - HTML (5分钟)、CSS/JS (1小时)、图片 (24小时)、字体 (7天)
- **请求队列**: 智能请求队列管理，优化并发请求
- **性能监控**: 实时监控代理性能指标和缓存命中率
- **URL重写**: 智能重写网页中的所有URL引用
- **资源优化**: 自动处理相对路径、绝对路径和协议相对URL
- **响应式图片支持**: 智能处理srcset属性

### 3. 自定义搜索源
- **源配置**: 支持添加和编辑自定义搜索站点
- **分类管理**: 多级分类系统，支持主要分类和子分类
- **模板系统**: 灵活的URL模板和结果解析配置
- **批量操作**: 批量启用、禁用和删除搜索源
- **源导入导出**: 支持搜索源配置的导入和导出
- **源状态监控**: 实时监控每个搜索源的可用性

### 4. 用户系统
- **安全认证**: 基于JWT的安全用户认证系统
- **个人设置**: 丰富的个性化配置选项
- **数据同步**: 跨设备的用户数据同步
- **隐私保护**: 本地优先的数据存储策略
- **邮箱验证**: 增强账户安全的邮箱验证机制
- **收藏管理**: 管理用户收藏的磁力链接
- **历史记录**: 记录和管理用户的搜索历史

### 5. 社区功能
- **标签管理**: 创建和分享搜索标签
- **源分享**: 社区贡献和分享优质搜索源
- **用户互动**: 支持社区内的用户交流和反馈
- **数据统计**: 收集和展示社区使用数据和热门内容

## 🔧 配置说明
👉 [查看项目配置说明](config.md)


## 📊 性能优化

### 前端优化策略
- **ES6模块化**: 原生模块化加载，无需打包工具
- **智能缓存**: 多层级缓存机制，包含API响应缓存和资源缓存
- **按需加载**: 组件和服务按需加载，减少初始加载时间
- **响应式设计**: 针对不同设备优化的资源和布局
- **本地存储**: 充分利用LocalStorage和IndexedDB减少API调用
- **延迟执行**: 非关键任务延迟执行，提升首屏加载速度

### 代理服务优化
- **资源类型缓存**: 基于资源类型的智能缓存策略
- **LRU缓存淘汰**: 高效的缓存淘汰算法
- **请求队列**: 智能请求队列和并发控制
- **URL重写优化**: 高效的URL重写算法，减少不必要的处理
- **代理健康检查**: 自动检测和规避不健康的代理节点

### 后端优化
- **边缘计算**: 利用Cloudflare全球边缘节点，就近处理请求
- **数据库优化**: 索引优化、查询优化和连接池管理
- **KV缓存**: 使用Cloudflare KV存储缓存频繁访问的数据
- **并发控制**: 优化的并发请求处理策略
- **错误重试**: 智能错误重试机制，提高系统稳定性
- **请求路由**: 基于地理位置的智能请求路由

## 🔒 安全特性

### 前端安全
- **XSS防护**: 输入输出严格过滤，使用内容安全策略(CSP)
- **CSRF保护**: Token验证机制和同源策略严格执行
- **内容安全**: 资源白名单机制，防止恶意资源加载
- **安全沙箱**: 重要操作在安全沙箱中执行
- **CORS配置**: 严格的跨域资源共享策略

### 后端安全
- **SQL注入防护**: 参数化查询和输入验证
- **访问控制**: 基于角色的权限管理系统
- **数据加密**: 敏感数据(如用户凭证)加密存储
- **速率限制**: 防暴力破解的请求速率限制
- **认证安全**: JWT令牌定期轮换和权限范围控制
- **异常处理**: 安全的错误信息返回策略

### 代理安全
- **请求过滤**: 基于URL和内容的请求过滤
- **白名单机制**: 只代理已验证的安全域名
- **HTTPS强制**: 所有代理连接强制使用HTTPS
- **资源隔离**: 代理资源与主应用资源完全隔离
- **隐私保护**: 代理请求中移除可能泄露用户信息的请求头

## 🧪 测试方法

项目采用多维度的测试策略，确保代码质量和系统稳定性：

### 前端测试
- **单元测试**: 组件和服务的独立功能测试
- **集成测试**: 验证模块间交互是否正常
- **端到端测试**: 模拟用户真实操作流程的完整测试
- **性能测试**: 页面加载和交互响应性能检测
- **响应式测试**: 不同设备和屏幕尺寸的兼容性测试
- **调试工具**: 浏览器开发者工具调试和控制台日志分析

### 后端测试
- **API测试**: 使用Postman或CURL测试所有API端点
- **功能测试**: 验证业务逻辑和数据处理正确性
- **负载测试**: 评估系统在高并发下的表现
- **安全测试**: 检测潜在的安全漏洞和攻击面
- **日志分析**: Cloudflare Dashboard中的请求日志和错误跟踪
- **数据完整性测试**: 确保数据库操作的数据一致性

### 代理服务测试
- **连通性测试**: 验证代理服务对不同域名的访问能力
- **性能测试**: 测量代理延迟和吞吐量
- **稳定性测试**: 长时间运行的稳定性监控
- **兼容性测试**: 验证不同类型资源的代理支持
- **缓存效率测试**: 评估缓存策略的有效性和命中率

### 开发测试工具
```javascript
// 前端调试模式启用方法
// 在URL中添加debug参数：?debug=true
// 或在控制台执行：
window.DEBUG_MODE = true;

// 代理调试方法
// 查看代理服务状态
const proxyStatus = await ProxyService.getStatus();

// 查看缓存统计
const cacheStats = await ProxyService.getCacheStats();

// 后端API测试示例
// 健康检查
fetch('/api/health')
  .then(res => res.json())
  .then(data => console.log('API Health:', data));
```

## 📝 API文档

项目提供了完整的RESTful API，支持前端应用和第三方集成：

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

## 🤝 贡献指南

我们非常欢迎社区贡献！无论是修复bug、添加新功能还是改进文档，都能帮助项目变得更好。

### 贡献流程

1. **Fork 项目**
   - 在GitHub上点击"Fork"按钮创建你自己的项目副本

2. **克隆仓库**
   ```bash
   git clone https://github.com/YOUR_USERNAME/magnet-search.git
   cd magnet-search
   ```

3. **创建功能分支**
   ```bash
   git checkout -b feature/YourFeatureName
   ```
   或修复分支
   ```bash
   git checkout -b fix/YourBugfixName
   ```

4. **安装依赖**
   ```bash
   # 前端依赖
   cd frontend
   npm install
   
   # 后端依赖 (Cloudflare Workers)
   cd ../codeseek-backend
   npm install
   ```

5. **开发和测试**
   - 实现你的功能或修复
   - 确保代码通过所有测试
   - 编写新的测试用例（如有必要）

6. **提交更改**
   ```bash
   git add .
   git commit -m "Add: 简明扼要的提交信息"
   ```
   请遵循[语义化提交信息](https://www.conventionalcommits.org/zh-hans/v1.0.0/)规范

7. **推送到分支**
   ```bash
   git push origin feature/YourFeatureName
   ```

8. **打开 Pull Request**
   - 在GitHub上导航到原始仓库
   - 点击"Pull Request"按钮
   - 填写详细的描述说明你的更改

### 代码规范

- **JavaScript/ES6+**：使用现代JavaScript语法和特性
- **代码风格**：遵循项目中的ESLint配置和代码风格
- **命名规范**：使用清晰、描述性的变量和函数名
- **注释**：为复杂逻辑添加适当的注释
- **测试**：确保单元测试覆盖率达到80%以上
- **文档**：更新相关文档以反映你的更改

### 提交信息规范

我们使用语义化提交信息格式，结构如下：
```
<类型>: <描述>

[可选的正文]

[可选的页脚]
```

常用类型：
- `Add`: 添加新功能
- `Fix`: 修复bug
- `Update`: 更新现有功能
- `Refactor`: 代码重构，不改变功能
- `Docs`: 文档更改
- `Style`: 格式调整，不影响代码功能
- `Test`: 添加或修改测试
- `Chore`: 构建过程或辅助工具变动

### 报告问题

如果你发现了bug或有功能建议，请在GitHub上创建Issue，并尽可能提供详细信息：
- 问题的详细描述
- 复现步骤
- 预期行为和实际行为
- 环境信息（浏览器、操作系统等）
- 相关截图（如有）

### 开发资源

- **文档**: 项目根目录下的README.md和docs文件夹
- **API参考**: 项目中的API文档部分
- **社区**: GitHub Discussions和Issues

## 📄 更新日志

### 最新版本

#### 前端 v2.3.1
- **架构重构**
  - ✨ 新增统一搜索管理器架构，优化搜索流程
  - 🔧 重构搜索组件架构，提高可维护性
  - 🚀 移除详情提取服务，简化系统架构
- **新功能**
  - 🔌 新增完整的智能代理功能
    - 一键切换全局代理
    - 资源类型智能缓存策略
    - URL重写和资源优化
    - 响应式图片支持
  - 📊 新增代理性能监控和缓存统计
- **用户体验**
  - 🎨 改进主题系统和UI体验
  - 📱 增强移动端响应式设计
  - ⚡ 优化页面加载和交互速度
- **修复**
  - 🐛 修复已知性能和显示问题
  - 🔍 修复搜索结果排序问题

#### 后端 v2.1.0
- **架构升级**
  - ✨ 新增模块化数据库结构，提高可扩展性
  - 🔧 重构服务层架构，优化代码组织
  - 🔌 新增代理服务支持，实现搜索源访问优化
- **安全增强**
  - 🔐 增强认证和安全机制
  - 📧 添加邮箱验证服务，提升账户安全性
  - 🚫 实现请求速率限制，防止滥用
- **功能完善**
  - 👥 完善社区功能支持
  - 📊 增强搜索源统计和监控
  - 🔍 优化搜索结果处理逻辑

### 历史版本

#### v1.3.0 (2024-12-19)
- **核心功能**
  - ✨ 新增自定义搜索源和分类管理
  - 🔍 添加详情提取功能
  - 👥 新增用户收藏管理
- **性能优化**
  - 🚀 优化搜索性能和缓存机制
  - ⚡ 提升API响应速度
- **用户体验**
  - 🎨 改进用户界面和交互体验
  - 🔧 重构Dashboard架构，提升可维护性
  - 📊 增强数据统计和可视化功能

#### v1.2.0
- **用户系统**
  - 🔐 完善用户认证和安全机制
  - ☁️ 实现云端数据同步功能
- **跨设备支持**
  - 📱 优化移动端适配
  - 💻 完善桌面端体验
- **其他**
  - 🐛 修复若干已知问题
  - 📝 更新API文档和使用说明

#### v1.1.0
- ✨ 初始版本发布
- 🔍 基础搜索功能实现
- 📱 响应式设计支持
- 🗂️ 基本分类系统
- 🚀 性能优化和bug修复

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。在遵循以下条款的前提下，您可以自由使用、修改和分发本软件：

- 您可以使用本软件用于任何目的，包括商业用途
- 您可以修改本软件的源代码
- 您可以在您的项目中包含本软件
- 您需要保留原始版权声明和许可证文本
- 作者和贡献者不对软件提供任何担保，不承担任何责任

## 🙏 致谢

我们衷心感谢所有为项目做出贡献的个人和组织：

- **技术平台支持**
  - [Cloudflare](https://www.cloudflare.com/) - 提供优秀的边缘计算平台和Worker服务
  - [GitHub](https://github.com/) - 提供代码托管和协作平台

- **开源社区**
  - 所有项目贡献者和提交者
  - 所有提供反馈和建议的用户
  - 所有分享和推广项目的朋友

- **资源支持**
  - 开源软件社区提供的各种工具和库

## 📧 联系与支持

### 官方渠道
- **项目主页**: [codeseek](https://github.com/Zoroaaa/codeseek)
- **问题反馈**: [Issues](https://github.com/Zoroaaa/codeseek/issues)
- **功能建议**: [Discussions](https://github.com/Zoroaaa/codeseek/discussions)

### 贡献交流
- **邮件列表**: zoroasx@gmail.com

---

<div align="center">
  <p>✨ 感谢您使用磁力快搜！ ✨</p>
  <p>⭐ 如果这个项目对你有帮助，请给我们一个Star！ ⭐</p>
  <p>💪 欢迎加入我们的开源社区，一起改进和发展！ 💪</p>
</div>
