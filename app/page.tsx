import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="h-full w-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-8">并没有做完也并不知道有多AI的应用平台</h1>
      <div className="flex gap-4 border rounded-lg py-2 px-4">
        <Link href="/search" target="_blank">
          <Button size="lg">集成搜索</Button>
        </Link>
        <Link href="/articles" target="_blank">
          <Button size="lg">新增文章</Button>
        </Link>
        <Link href="/mail" target="_blank">
          <Button size="lg">发送邮件</Button>
        </Link>
        <Link href="/database" target="_blank">
          <Button size="lg">资料库</Button>
        </Link>
      </div>
    </div>
  )
}
