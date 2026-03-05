"use client"

import Link from "next/link"
import { useAuth } from "@/app/providers"
import { Button } from "@/components/ui/button"
import { Home, LogOut, User } from "lucide-react"

/**
 * 全局顶部导航栏
 * 包含回到首页和用户登录/注销功能
 */
export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* 左侧：回到首页 */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <Home size={16} />
            首页
          </Button>
        </Link>

        {/* 右侧：用户信息和登录/注销 */}
        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated && user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-secondary/50">
                <User size={14} />
                <span className="text-sm font-medium">{user.user_code}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="gap-2"
              >
                <LogOut size={16} />
                注销
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="default" size="sm" className="gap-2">
                <User size={16} />
                登录
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
