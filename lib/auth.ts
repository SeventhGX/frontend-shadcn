/**
 * 认证工具函数和 API
 * 基于 JWT Bearer Token + OAuth2
 */

import { getApiBaseUrl } from './fetcher'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export interface User {
  user_code: string
  user_name: string
  email?: string
  phone?: string
  del_flag?: boolean
  // 根据实际后端返回的用户信息添加其他字段
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  // user: User
}

// ==================== Token 管理 ====================

/**
 * 保存 Token 到 localStorage
 */
export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token)
    // 触发自定义事件，通知其他标签页
    window.dispatchEvent(new StorageEvent('storage', {
      key: TOKEN_KEY,
      newValue: token,
      storageArea: localStorage
    }))
  }
}

/**
 * 获取 Token
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY)
  }
  return null
}

/**
 * 移除 Token
 */
export function removeToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY)
    // 触发自定义事件，通知其他标签页
    window.dispatchEvent(new StorageEvent('storage', {
      key: TOKEN_KEY,
      newValue: null,
      storageArea: localStorage
    }))
  }
}

// ==================== User 管理 ====================

/**
 * 保存用户信息到 localStorage
 */
export function setUser(user: User): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    window.dispatchEvent(new StorageEvent('storage', {
      key: USER_KEY,
      newValue: JSON.stringify(user),
      storageArea: localStorage
    }))
  }
}

/**
 * 获取用户信息
 */
export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem(USER_KEY)
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch {
        return null
      }
    }
  }
  return null
}

/**
 * 移除用户信息
 */
export function removeUser(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY)
    window.dispatchEvent(new StorageEvent('storage', {
      key: USER_KEY,
      newValue: null,
      storageArea: localStorage
    }))
  }
}

// ==================== 认证状态检查 ====================

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!getUser()
}

/**
 * 清除所有认证信息
 */
export function clearAuth(): void {
  removeToken()
  removeUser()
}

// ==================== API 调用 ====================

/**
 * 登录 API
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const API_BASE_URL = getApiBaseUrl()

  // OAuth2 password flow 通常使用 form-data 格式
  const formData = new URLSearchParams()
  formData.append('username', credentials.username)
  formData.append('password', credentials.password)

  const response = await fetch(`${API_BASE_URL}/system/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '登录失败' }))
    throw new Error(error.detail || '登录失败')
  }

  const data: LoginResponse = await response.json()

  // 保存 token 和用户信息
  setToken(data.access_token)
  setUser(await getCurrentUser()) // 获取并保存当前用户信息

  return data
}

/**
 * 注销 API
 */
export async function logout(): Promise<void> {
  // 某些后端需要调用注销接口来使 token 失效
  const API_BASE_URL = getApiBaseUrl()
  const token = getToken()

  if (token) {
    try {
      await fetch(`${API_BASE_URL}/system/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
    } catch (error) {
      console.error('Logout API error:', error)
    }
  }

  // 清除本地存储的认证信息
  clearAuth()
}

/**
 * 验证 Token 是否有效
 */
export async function verifyToken(): Promise<boolean> {
  const token = getToken()
  if (!token) return false

  try {
    const API_BASE_URL = getApiBaseUrl()

    const response = await fetch(`${API_BASE_URL}/system/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    return response.ok
  } catch {
    return false
  }
}

/**
 * 获取当前用户信息（从服务器）
 */
export async function getCurrentUser(): Promise<User> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录')
  }

  const API_BASE_URL = getApiBaseUrl()

  const response = await fetch(`${API_BASE_URL}/system/users/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('获取用户信息失败')
  }

  const user: User = await response.json()
  setUser(user) // 更新本地缓存

  return user
}
