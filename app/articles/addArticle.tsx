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
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { FilePlus, CalendarIcon, ChevronDown, ChevronUp, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { json } from "stream/consumers"

interface AddArticleProps {
  onArticleAdded?: (articleData: string) => void
  initialData?: string
}

export function AddArticle({ onArticleAdded, initialData }: AddArticleProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [keyWords, setKeyWords] = useState("")
  const [publishTime, setPublishTime] = useState("")
  const [url, setUrl] = useState("")
  const [summary, setSummary] = useState("")
  const [content, setContent] = useState("")
  const [mailDate, setMailDate] = useState<Date | undefined>(undefined)

  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [contentExpanded, setContentExpanded] = useState(false)

  // 解析父组件传入的字符串并赋值给表单
  const parseDataString = (dataString: string) => {
    let parsedData = JSON.parse(dataString)
    setTitle(parsedData.title || "")
    setKeyWords(parsedData.key_words || "")
    setPublishTime(parsedData.publish_time || "")
    setUrl(parsedData.url || "")
    setSummary(parsedData.summary || "")
    setContent(parsedData.content || "")
    setMailDate(parsedData.mail_date ? new Date(parsedData.mail_date) : undefined)
  }

  // 当 dialog 打开时，如果有 initialData 则解析
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    setSummaryExpanded(true)
    setContentExpanded(false)
    if (isOpen && initialData) {
      parseDataString(initialData)
    }
    // 关闭时清空表单
    if (!isOpen) {
      resetForm()
    }
  }

  // 重置表单
  const resetForm = () => {
    setTitle("")
    setKeyWords("")
    setPublishTime("")
    setUrl("")
    setSummary("")
    setContent("")
    setMailDate(undefined)
  }

  // 将表单数据拼接为字符串
  const stringifyFormData = (): string => {
    const formData = {
      "title": title,
      "key_words": keyWords,
      "publish_time": publishTime,
      "content": content,
      "summary": summary,
      "url": url,
      "mail_date": mailDate ? format(mailDate, 'yyyy-MM-dd') : ''
    }
    return JSON.stringify(formData, null, 2) // 格式化输出，每项后增加换行符和缩进
  }

  // 调用 API 保存文章
  const saveArticle = async () => {
    // TODO: 在这里实现 API 调用

    // 模拟成功
    return Promise.resolve({ success: true })
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      // 简单验证
      if (!title.trim()) {
        toast.error('请输入标题')
        return
      }

      // 调用 API 保存
      await saveArticle()

      // 拼接数据并返回给父组件
      const dataString = stringifyFormData()
      onArticleAdded?.(dataString)

      toast.success('文章添加成功')
      setOpen(false)
    } catch (error) {
      console.error('Error saving article:', error)
      toast.error('保存文章失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Save className="h-4 w-4" />
          保存文章
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-6 gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>保存文章</DialogTitle>
          <DialogDescription>
            填写文章信息并提交。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 rounded-md pt-4">
          <div className="space-y-4 pr-2">
            {/* 标题 */}
            <div className="space-y-2">
              <Label htmlFor="title">标题</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入文章标题"
              />
            </div>

            {/* 关键词 */}
            <div className="space-y-2">
              <Label htmlFor="keywords">关键词</Label>
              <Input
                id="keywords"
                value={keyWords}
                onChange={(e) => setKeyWords(e.target.value)}
                placeholder="请输入关键词"
              />
            </div>

            {/* 新闻发布时间 */}
            <div className="space-y-2">
              <Label htmlFor="publishTime">新闻发布时间</Label>
              <Input
                id="publishTime"
                value={publishTime}
                onChange={(e) => setPublishTime(e.target.value)}
                placeholder="请输入发布时间"
              />
            </div>

            {/* 链接 */}
            <div className="space-y-2">
              <Label htmlFor="link">链接</Label>
              <Input
                id="link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="请输入文章链接"
              />
            </div>

            {/* 预计邮件发送日期 */}
            <div className="space-y-2">
              <Label>预计邮件发送日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !mailDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {mailDate ? format(mailDate, "PPP") : <span>选择日期</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={mailDate}
                    onSelect={setMailDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 总结 - 可折叠 */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Label htmlFor="summary"
                  onClick={() => setSummaryExpanded(!summaryExpanded)}
                >
                  总结
                  {summaryExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Label>
              </div>
              {summaryExpanded && (
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="请输入文章总结"
                  className="min-h-32"
                />
              )}
            </div>

            {/* 原文 - 可折叠 */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Label htmlFor="content"
                  onClick={() => setContentExpanded(!contentExpanded)}
                >
                  原文
                  {contentExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Label>
              </div>
              {contentExpanded && (
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="请输入文章原文"
                  className="min-h-48"
                />
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              取消
            </Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit}>
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}