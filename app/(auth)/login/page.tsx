import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function LoginPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">登录页面</h1>
      <p className="mb-4">请在此处登录以继续。</p>
      {/* 在这里添加登录表单或其他内容 */}
      <Link href="/">
        <Button>返回首页</Button>
      </Link>
    </div>
  )
}