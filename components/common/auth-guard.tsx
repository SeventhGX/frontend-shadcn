"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/app/providers"

/**
 * 路由保护组件
 * 用于保护需要认证的页面，未登录时自动跳转到登录页
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // 等待认证状态加载完成
    if (isLoading) return

    // 如果未登录且不在登录页，跳转到登录页
    if (!isAuthenticated && pathname && !pathname.startsWith('/login')) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [isAuthenticated, isLoading, pathname, router])

  // 加载中或未登录时显示加载状态
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && pathname && !pathname.startsWith('/login')) {
    return null // 将跳转到登录页
  }

  return <>{children}</>
}
