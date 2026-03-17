"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { useState, useEffect } from "react"
import { ArticleCard } from "@/components/common/article"
import { addDays, format } from "date-fns"
import { getArticleByBody, getArticleByDateRange } from "@/features/article/api"
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
import { Search, } from 'lucide-react';
import { DateRange } from "react-day-picker"
import { DatePickerWithRange } from "@/components/common/selectDateRange"


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

  async function onSearch() {
    const fetchedArticles = await getArticleByDateRange({
      publish_time_start: publishRange?.from ? format(publishRange.from, 'yyyy-MM-dd') + ' 00:00:00' : null,
      publish_time_end: publishRange?.to ? format(publishRange.to, 'yyyy-MM-dd') + ' 23:59:59' : null,
      mail_date_start: mailRange?.from ? format(mailRange.from, 'yyyy-MM-dd') : null,
      mail_date_end: mailRange?.to ? format(mailRange.to, 'yyyy-MM-dd') : null,
      real_mail_date_start: realMailRange?.from ? format(realMailRange.from, 'yyyy-MM-dd') : null,
      real_mail_date_end: realMailRange?.to ? format(realMailRange.to, 'yyyy-MM-dd') : null,
    })
    setArticles(fetchedArticles.data || [])
  }

  // useEffect(() => {
  //   async function fetchArticles() {
  //     const fetchedArticles = await getArticleByBody({
  //     })
  //     // console.log("Fetched articles:", fetchedArticles)
  //     setArticles(fetchedArticles.data || [])
  //   }
  //   fetchArticles()
  // }, [])

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
                  <Label htmlFor="publishRange" className="text-right">
                    新闻发布时间
                  </Label>
                  <DatePickerWithRange
                    id="publishRange"
                    className="w-40"
                    date={publishRange}
                    setDate={setPublishRange}
                    placeholder="选择新闻发布时间范围" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="mailRange" className="text-right">
                    预计邮件发送日期
                  </Label>
                  <DatePickerWithRange
                    id="mailRange"
                    className="w-40"
                    date={mailRange}
                    setDate={setMailRange}
                    placeholder="选择预计邮件发送日期范围" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="realMailRange" className="text-right">
                    实际邮件发送日期
                  </Label>
                  <DatePickerWithRange
                    id="realMailRange"
                    className="w-40"
                    date={realMailRange}
                    setDate={setRealMailRange}
                    placeholder="选择实际邮件发送日期范围" />
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button type="submit" className="w-20" onClick={onSearch}>确定</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>

        </div>

        <div className="h-full flex flex-col gap-2 overflow-auto">
          {articles.length > 0 ? articles.map((article, index) => (
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
          )) : <p className="text-center">请设置查询条件。</p>}
        </div>
      </div>
    </AuthGuard >
  )
}