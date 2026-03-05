import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">欢迎来到首页</h1>
      <div className="flex gap-4">
        <Link href="/mail" target="_blank">
          <Button size="lg">发送邮件</Button>
        </Link>
        <Link href="/articles" target="_blank">
          <Button size="lg">新增文章</Button>
        </Link>
      </div>
    </div>
  )
}
