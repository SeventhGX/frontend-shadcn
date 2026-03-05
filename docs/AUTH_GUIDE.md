# 认证系统使用说明

本文档说明了新增的认证功能及其使用方法。

## 功能概述

已为应用添加完整的认证系统，包括：

1. **全局顶部导航栏** - 包含回到首页和用户登录/注销功能
2. **JWT Bearer Token 认证** - 基于 OAuth2 的认证机制
3. **路由保护** - 自动检查认证状态，未登录时跳转到登录页
4. **多标签页状态共享** - 不同标签页可以共享登录状态
5. **统一的 API 调用** - 自动在请求头中添加 JWT token

## 新增文件

### 1. 认证工具和 API (`lib/auth.ts`)

提供认证相关的工具函数和 API：

- **Token 管理**: `setToken()`, `getToken()`, `removeToken()`
- **用户信息管理**: `setUser()`, `getUser()`, `removeUser()`
- **认证状态检查**: `isAuthenticated()`, `verifyToken()`
- **API 调用**: `login()`, `logout()`, `getCurrentUser()`

### 2. 认证上下文 (`app/providers.tsx`)

提供全局认证状态管理：

```tsx
import { useAuth } from '@/app/providers'

const { user, isLoading, isAuthenticated, setUser, logout } = useAuth()
```

### 3. 顶部导航栏 (`components/common/navbar.tsx`)

全局导航栏组件，显示：
- 回到首页按钮
- 用户信息（已登录时）
- 登录/注销按钮

### 4. 路由保护组件 (`components/common/auth-guard.tsx`)

用于保护需要认证的页面：

```tsx
import { AuthGuard } from '@/components/common/auth-guard'

export default function ProtectedPage() {
  return (
    <AuthGuard>
      {/* 页面内容 */}
    </AuthGuard>
  )
}
```

### 5. 登录页面 (`app/(auth)/login/page.tsx`)

完整的登录页面，包含：
- 用户名和密码输入
- 登录表单提交
- 错误处理和提示
- 登录后跳转到原页面

## 配置说明

### 环境变量

创建 `.env.local` 文件并配置：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

参考 `.env.example` 文件。

### 后端 API 接口要求

需要后端提供以下接口：

#### 1. 登录接口

```
POST /auth/login
Content-Type: application/x-www-form-urlencoded

username=xxx&password=xxx
```

返回格式：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "1",
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

#### 2. 验证 Token 接口（可选）

```
GET /auth/verify
Authorization: Bearer {token}
```

#### 3. 获取当前用户信息接口（可选）

```
GET /auth/me
Authorization: Bearer {token}
```

返回格式：
```json
{
  "id": "1",
  "username": "admin",
  "email": "admin@example.com"
}
```

## 使用方法

### 1. 在组件中使用认证状态

```tsx
'use client'

import { useAuth } from '@/app/providers'

export default function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth()

  if (!isAuthenticated) {
    return <div>请先登录</div>
  }

  return (
    <div>
      <p>欢迎, {user?.username}</p>
      <button onClick={logout}>退出登录</button>
    </div>
  )
}
```

### 2. 保护需要认证的页面

在页面组件中使用 `AuthGuard`：

```tsx
import { AuthGuard } from '@/components/common/auth-guard'

export default function ProtectedPage() {
  return (
    <AuthGuard>
      {/* 这里的内容只有登录后才能访问 */}
      <div>受保护的内容</div>
    </AuthGuard>
  )
}
```

### 3. 调用需要认证的 API

使用 `fetcher` 函数会自动添加 JWT token：

```tsx
import { fetcher } from '@/lib/fetcher'

// 自动在请求头中添加 Authorization: Bearer {token}
const data = await fetcher('/api/protected-endpoint', {
  method: 'GET',
})
```

### 4. 程序化导航到登录页

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()

// 跳转到登录页，登录后返回当前页面
router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
```

## 多标签页同步

认证状态通过 `localStorage` 和 `storage` 事件实现多标签页同步：

- 在一个标签页登录，其他标签页会自动更新状态
- 在一个标签页注销，其他标签页会自动跳转到登录页

## 待实现的 API

在 `lib/auth.ts` 中标记了 `TODO` 的地方，需要根据实际后端 API 进行调整：

1. `login()` - 登录接口
2. `logout()` - 注销接口（可选）
3. `verifyToken()` - 验证 token 接口
4. `getCurrentUser()` - 获取当前用户信息接口

## 已保护的页面

以下页面已添加认证保护：

- `/mail` - 邮件发送页面
- `/articles` - 文章管理页面

未登录访问这些页面会自动跳转到登录页。

## 样式说明

所有新增组件都使用 shadcn/ui 组件库，保持与现有页面的风格一致。
