"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { addDays } from "date-fns"
import { FilePlus } from "lucide-react"

import SelectArticleDate from "@/components/common/selectArticleDate"
import ArticleCard from "@/components/common/article"
import { format } from "date-fns"

import { getArticleByDate } from "@/features/article/api"

export function ArticleDialog({ articles: initialArticles, onAddToMail }: { articles: any[], onAddToMail: (selectedArticles: any[]) => void }) {
  // 获取本周周五作为默认值
  const getThisFriday = (): Date => {
    const today = new Date()
    const currentDay = today.getDay() // 0 (周日) 到 6 (周六)
    const daysToFriday = currentDay <= 5 ? 5 - currentDay : -(currentDay - 5)
    return addDays(today, daysToFriday)
  }

  const [date, setDate] = useState<Date | undefined>(getThisFriday())
  const [articles, setArticlesState] = useState<any[]>(
    initialArticles.map(article => ({
      ...article,
      isSelected: true
    }))
  )

  // 当 initialArticles 更新时，同步更新内部的 articles state
  useEffect(() => {
    setArticlesState(
      initialArticles.map(article => ({
        ...article,
        isSelected: true
      }))
    )
  }, [initialArticles])

  const fetchArticles = async (selectedDate: Date) => {
    try {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd')
      const result = await getArticleByDate(formattedDate)
      // const result = await response.json()
      console.log('接口结果:', result)
      const fetchedArticles = result.data || []
      setArticlesState(
        fetchedArticles.map((article: any) => ({
          ...article,
          isSelected: true
        }))
      )
    } catch (error) {
      console.error('Error fetching articles:', error)
      toast.error('获取文章失败')
    }
  }

  const handleDateChange = (newDate: Date | undefined) => {
    setDate(newDate)
    if (newDate) {
      fetchArticles(newDate)
    }
  }

  const toggleArticleSelection = (index: number) => {
    setArticlesState(prev => prev.map((article, i) =>
      i === index ? { ...article, isSelected: !article.isSelected } : article
    ))
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FilePlus className="h-4 w-4" />
          选择文章
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-6 gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>选择文章</DialogTitle>
          <DialogDescription>
            选择要添加到邮件的文章。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
          <div className="grid grid-cols-4 items-center gap-4 shrink-0">
            <Label>选择邮件日期</Label>
            <SelectArticleDate date={date} setDate={handleDateChange} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 border-2 rounded-md p-2">
            <div className="space-y-4 pr-2">
              {articles.map((article, index) => (
                <ArticleCard
                  key={index}
                  title={article.title}
                  key_words={article.key_words}
                  summary={article.summary}
                  isSelected={article.isSelected}
                  setIsSelected={() => toggleArticleSelection(index)}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 pt-4">
          <Label>共{articles.length}篇文章，已选择{articles.filter(article => article.isSelected).length}篇文章</Label>
          <DialogClose asChild>
            <Button type="submit" onClick={() => {
              const selectedArticles = articles.filter(article => article.isSelected)
              if (selectedArticles.length > 0) {
                onAddToMail(selectedArticles)
                // 重置所有文章的选中状态
                setArticlesState(prev => prev.map(article => ({
                  ...article,
                  isSelected: true
                })))
                // 将日期调回默认值
                const defaultDate = getThisFriday()
                setDate(defaultDate)
                fetchArticles(defaultDate)
                toast.success(`已添加 ${selectedArticles.length} 篇文章到邮件`)
              }
            }}>添加到邮件</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
