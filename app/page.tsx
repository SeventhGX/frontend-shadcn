import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import MailPage from "@/app/mail/page"
import ArticlesPage from "./articles/page"

import { Recipient } from "@/app/mail/recipient"


export default function Home() {
  // return (
  //   <div className="p-8">
  //     <h1 className="text-2xl font-bold mb-4">首页</h1>
  //     <p className="mb-4">主页内容</p>
  //     <Link href="/mail">
  //       <Button>跳转到 Mail</Button>
  //     </Link>
  //   </div>
  // )
  return (
    <div className="h-screen w-screen flex flex-col p-2 overflow-hidden">
      <Tabs defaultValue="mail" className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-2 shrink-0">
          <TabsTrigger value="mail">发送邮件</TabsTrigger>
          <TabsTrigger value="article">新增文章</TabsTrigger>
        </TabsList>
        <TabsContent value="mail" className="flex flex-col flex-1 gap-2 min-h-0">
          <MailPage />
        </TabsContent>
        <TabsContent value="article" className="flex flex-col flex-1 gap-2 min-h-0">
          <ArticlesPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
