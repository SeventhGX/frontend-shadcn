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
import { useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { ChevronDown, ChevronUp, Save } from "lucide-react"
import { newArticle } from "@/features/article/api"
import SelectArticleDate from "@/components/common/selectArticleDate"

export interface ArticleFormData {
  title: string
  key_words: string
  publish_time: string
  url: string
  summary: string
  content: string
  mail_date?: Date
}

export const emptyArticle: ArticleFormData = {
  title: "",
  key_words: "",
  publish_time: "",
  url: "",
  summary: "",
  content: "",
  mail_date: undefined,
}

// 解析接口返回的文章 JSON 字符串（兼容被 ```json 代码块包裹的情况）
export function parseArticleData(dataString: string): ArticleFormData {
  const jsonStr = dataString.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  return toArticleFormData(JSON.parse(jsonStr))
}

// 将接口返回的文章对象转换为表单数据，缺失或为 null 的字段置为空
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toArticleFormData(parsedData: Record<string, any>): ArticleFormData {
  return {
    title: parsedData.title || "",
    key_words: parsedData.key_words || "",
    publish_time: parsedData.publish_time || "",
    url: parsedData.url || "",
    summary: parsedData.summary || "",
    content: parsedData.content || "",
    mail_date: parsedData.mail_date ? new Date(parsedData.mail_date) : undefined,
  }
}

// 校验必填项，返回错误信息；校验通过返回 null
export function validateArticle(data: ArticleFormData): string | null {
  if (!data.title.trim()) return '请输入标题'
  if (!data.url.trim()) return '请输入链接'
  return null
}

// 调用 API 保存文章
export async function saveArticle(data: ArticleFormData) {
  return newArticle({
    "title": data.title || null,
    "key_words": data.key_words || null,
    "publish_time": data.publish_time || null,
    "content": data.content || null,
    "summary": data.summary || null,
    "url": data.url || null,
    "mail_date": data.mail_date ? format(data.mail_date, 'yyyy-MM-dd') : null
  })
}

// 将表单数据拼接为字符串
function stringifyFormData(data: ArticleFormData): string {
  const formData = {
    "title": data.title,
    "key_words": data.key_words,
    "publish_time": data.publish_time,
    "content": data.content,
    "summary": data.summary,
    "url": data.url,
    "mail_date": data.mail_date ? format(data.mail_date, 'yyyy-MM-dd') : ''
  }
  return JSON.stringify(formData, null, 2) // 格式化输出，每项后增加换行符和缩进
}

interface ArticleFormFieldsProps {
  data: ArticleFormData
  onChange: (patch: Partial<ArticleFormData>) => void
}

// 文章表单字段，供保存弹窗与明细查看弹窗复用
export function ArticleFormFields({ data, onChange }: ArticleFormFieldsProps) {
  const [summaryExpanded, setSummaryExpanded] = useState(true)
  const [contentExpanded, setContentExpanded] = useState(false)

  return (
    <div className="space-y-4 pr-2">
      {/* 标题 */}
      <div className="space-y-2">
        <Label htmlFor="title">标题</Label>
        <Input
          id="title"
          value={data.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="请输入文章标题"
        />
      </div>

      {/* 关键词 */}
      <div className="space-y-2">
        <Label htmlFor="keywords">关键词</Label>
        <Input
          id="keywords"
          value={data.key_words}
          onChange={(e) => onChange({ key_words: e.target.value })}
          placeholder="请输入关键词"
        />
      </div>

      {/* 新闻发布时间 */}
      <div className="space-y-2">
        <Label htmlFor="publishTime">新闻发布时间</Label>
        <Input
          id="publishTime"
          value={data.publish_time}
          onChange={(e) => onChange({ publish_time: e.target.value })}
          placeholder="请输入发布时间"
        />
      </div>

      {/* 链接 */}
      <div className="space-y-2">
        <Label htmlFor="link">链接</Label>
        <Input
          id="link"
          value={data.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="请输入文章链接"
        />
      </div>

      {/* 预计邮件发送日期 */}
      <div className="space-y-2">
        <Label>预计邮件发送日期</Label>
        <SelectArticleDate
          date={data.mail_date}
          setDate={(mail_date) => onChange({ mail_date })} />
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
            value={data.summary}
            onChange={(e) => onChange({ summary: e.target.value })}
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
            value={data.content}
            onChange={(e) => onChange({ content: e.target.value })}
            placeholder="请输入文章原文"
            className="min-h-48"
          />
        )}
      </div>
    </div>
  )
}

interface AddArticleProps {
  onArticleAdded?: (articleData: string) => void
  initialData?: string
  isSubmitting?: boolean
}

export function AddArticle({ onArticleAdded, initialData, isSubmitting }: AddArticleProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<ArticleFormData>(emptyArticle)

  // 当 dialog 打开时，如果有 initialData 则解析；关闭时清空表单
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    setForm(isOpen && initialData ? parseArticleData(initialData) : emptyArticle)
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      // 简单验证
      const error = validateArticle(form)
      if (error) {
        toast.error(error)
        return
      }

      // 调用 API 保存
      await saveArticle(form)

      // 拼接数据并返回给父组件
      onArticleAdded?.(stringifyFormData(form))

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
        <Button disabled={isSubmitting}>
          <Save className="h-4 w-4" />
          {isSubmitting ? "处理中..." : "保存文章"}
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
          <ArticleFormFields
            data={form}
            onChange={(patch) => setForm(prev => ({ ...prev, ...patch }))}
          />
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
