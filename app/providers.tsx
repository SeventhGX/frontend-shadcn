"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { User, getUser, getToken, clearAuth, verifyToken, logout as logoutAPI } from '@/lib/auth'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * 认证上下文提供者
 * 管理全局认证状态，支持多标签页同步
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()

  // 初始化：从 localStorage 读取用户信息
  useEffect(() => {
    const initAuth = async () => {
      const storedUser = getUser()
      const storedToken = getToken()
      console.log(storedToken, storedUser)

      if (storedToken && storedUser) {
        // 验证 token 是否仍然有效
        const isValid = await verifyToken()
        if (isValid) {
          setUserState(storedUser)
        } else {
          // Token 已过期，清除认证信息
          console.log('Token 已过期，清除认证信息')
          clearAuth()
          setUserState(null)
        }
      } else {
        setUserState(null)
      }

      setIsLoading(false)
    }

    initAuth()
  }, [])

  // 定期验证 token 有效性
  useEffect(() => {
    // 如果没有用户信息，不需要验证
    if (!user) return

    const verifyInterval = setInterval(async () => {
      const isValid = await verifyToken()
      if (!isValid) {
        console.log('Token 验证失败，清除认证信息')
        clearAuth()
        setUserState(null)
        // 如果当前不在登录页，跳转到登录页
        if (pathname && !pathname.startsWith('/login')) {
          router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
        }
      }
    }, 5 * 60 * 1000) // 每 5 分钟验证一次

    return () => clearInterval(verifyInterval)
  }, [user, pathname, router])

  // 监听 localStorage 变化，实现多标签页同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // 监听 token 或 user 的变化
      if (e.key === 'auth_token' || e.key === 'auth_user') {
        if (e.newValue) {
          // token 或 user 更新了
          const storedUser = getUser()
          setUserState(storedUser)
        } else {
          // token 或 user 被清除了
          setUserState(null)
          // 如果当前不在登录页，跳转到登录页
          if (pathname && !pathname.startsWith('/login')) {
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
          }
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [pathname, router])

  const setUser = (newUser: User | null) => {
    setUserState(newUser)
  }

  const logout = async () => {
    try {
      await logoutAPI() // 调用后端注销接口
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // 无论 API 调用成功与否，都清除本地状态
      setUserState(null)
      router.push('/login')
    }
  }

  // 基于 user state 和 token 计算 isAuthenticated
  const authenticated = !!(user && getToken())

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: authenticated,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * 使用认证上下文的 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
