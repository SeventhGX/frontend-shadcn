"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { useState, useEffect } from "react"
import { ArticleCard } from "@/components/common/article"
import { getArticleByBody } from "@/features/article/api"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from 'lucide-react';
import { DateRange } from "react-day-picker"


export default function DataPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [publishRange, setPublishRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })
  const [mailRange, setMailRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })
  const [realMailRange, setRealMailRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined,
  })

  useEffect(() => {
    async function fetchArticles() {
      const fetchedArticles = await getArticleByBody({
      })
      // console.log("Fetched articles:", fetchedArticles)
      setArticles(fetchedArticles.data || [])
    }
    fetchArticles()
  }, [])

  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        <div className="flex space-x-2">
          <Sheet key="top">
            <SheetTrigger asChild>
              <Button variant="outline">
                <Search size={16} />
                查询
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="h-max">
              <SheetHeader>
                <SheetTitle>查询条件设置</SheetTitle>
                {/* <SheetDescription>
                Make changes to your profile here. Click save when you're done.
              </SheetDescription> */}
              </SheetHeader>
              <div className="flex space-x-2 p-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    新闻发布时间
                  </Label>
                  <Input id="name" value="Pedro Duarte" className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">
                    Username
                  </Label>
                  <Input id="username" value="@peduarte" className="col-span-3" />
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="submit">Save changes</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

        </div>

        <div className="h-full flex flex-col gap-2 overflow-auto">
          {articles.map((article, index) => (
            <ArticleCard
              key={index}
              title={article.title}
              key_words={article.key_words}
              summary={article.summary}
              url={article.url}
              publish_time={article.publish_time}
              mail_date={article.mail_date}
              real_mail_date={article.real_mail_date}
            />
          ))}
        </div>
      </div>
    </AuthGuard >
  )
}