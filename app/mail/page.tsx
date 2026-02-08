"use client"

import { ArticleDialog } from "@/app/mail/selectArticle"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { addDays } from "date-fns"
import { useState, useEffect } from "react"

import { getArticleByDate, maToHtml } from "@/features/article/api"
import { Recipient } from "@/app/mail/recipient"
import MailView from "@/app/mail/mailView"
import { ScanSearch, SendHorizontal } from "lucide-react"


export default function MailPage() {
  const [mailContent, setMailContent] = useState<string>("")
  const [initialArticles, setInitialArticles] = useState<any[]>([])
  const [previewHtml, setPreviewHtml] = useState<string>("")
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  // 获取本周周五作为默认值
  const getThisFriday = (): Date => {
    const today = new Date()
    const currentDay = today.getDay() // 0 (周日) 到 6 (周六)
    const daysToFriday = currentDay <= 5 ? 5 - currentDay : -(currentDay - 5)
    return addDays(today, daysToFriday)
  }

  useEffect(() => {
    async function fetchInitialArticles() {
      // console.log("Fetching initial articles for", getThisFriday())
      const articles = await getArticles(getThisFriday())
      setInitialArticles(articles)
    }
    fetchInitialArticles()
  }, [])

  const handleAddToMail = (selectedArticles: any[]) => {
    const newContent = selectedArticles.map((article, index) =>
      `#### (${index + 1}) ${article.title}\n` +
      `**关键词：**${article.key_words}\n` +
      `**摘要：**${article.summary}\n` +
      `**链接：**${article.url}\n\n`
    ).join("")
    setMailContent(prev => prev + newContent)
  }

  return (
    <div className="flex flex-col flex-1 gap-1 min-h-0 mt-2">
      <Recipient />
      <Label htmlFor="mail" className="font-bold">编辑邮件(当前仅支持MD格式)</Label>
      <Textarea
        id="mail"
        className="flex-1 resize-none min-h-0"
        placeholder="正文"
        value={mailContent}
        onChange={(e) => setMailContent(e.target.value)}
      />
      <div className="flex mt-1">
        <ArticleDialog articles={initialArticles} onAddToMail={handleAddToMail} />
        <MailView mailContent={mailContent} />
        <Button className="ml-2">
          <SendHorizontal size={16} />
          发送邮件
        </Button>
      </div>
    </div>
  );
}

async function getArticles(date: Date) {
  const articles = await getArticleByDate(date);
  return articles["data"] || [];
}