"use client"

import { newArticleByStream, type CrawlerType, type DeepSeekArticle, type DeepSeekStreamEvent } from "@/features/article/api"
import { useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileText, Sparkle, ArrowUpDown, Loader2 } from "lucide-react"
import { AddArticle } from "@/app/articles/addArticle"
import { AuthGuard } from "@/components/common/auth-guard"
import { readSseStream } from "@/lib/sse"
import { CrawlerSplitButton } from "@/app/search/crawlerSplitButton"

export default function ArticlesPage() {
  const [url, setUrl] = useState("")
  const [crawlerType, setCrawlerType] = useState<CrawlerType>("deepseek") // DeepSeek 获取文章的速度和效果均优于豆包，默认使用
  const [progress, setProgress] = useState("") // DeepSeek 阶段提示
  const [reasoning_content, setReasoningContent] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string | undefined>("reasoning") // 推理内容默认展开
  const [isReasoning, setIsReasoning] = useState(false) // 是否正在推理

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setIsReasoning(crawlerType === "doubao") // DeepSeek 分支没有推理过程
      setAccordionValue("reasoning")
      // 清空之前的内容
      setReasoningContent("")
      setContent("")
      setProgress("")

      const response = await newArticleByStream(url, crawlerType)

      if (crawlerType === "deepseek") {
        // DeepSeek 分阶段返回事件，article 事件一次性返回完整文章，收到 error 事件即视为失败（即使随后收到 [DONE]）
        const result: { article?: DeepSeekArticle; truncated: boolean; error?: string } = { truncated: false }
        await readSseStream<DeepSeekStreamEvent>(response, (event) => {
          switch (event.type) {
            case "progress":
              setProgress(event.message)
              break
            case "article":
              result.article = event.data
              result.truncated = event.analysis_truncated
              break
            case "error":
              result.error = event.error.message
              break
          }
        })
        if (result.error) throw new Error(result.error)
        if (!result.article) throw new Error("未返回文章内容")
        // 序列化为与豆包一致的 JSON 文本，供展示及“保存文章”解析
        setContent(JSON.stringify(result.article, null, 2))
        if (result.truncated) {
          toast.warning("正文过长，摘要仅覆盖已分析的部分，正文内容完整保留")
        }
        return
      }

      let hasReceivedContent = false // 用于跟踪是否已经接收到 content 数据
      await readSseStream(response, (data) => {
        // 根据字段类型更新对应的状态
        if (data.reasoning_content !== undefined) {
          setReasoningContent(prev => prev + data.reasoning_content)
        }

        if (data.content !== undefined) {
          setContent(prev => prev + data.content)
          // 只在第一次接收到 content 时切换状态
          if (!hasReceivedContent) {
            hasReceivedContent = true
            setIsReasoning(false) // 推理完成，切换状态
            setAccordionValue(undefined) // 推理完成后自动折叠推理内容
          }
        }
      })
    } catch (error) {
      console.error('Error:', error)
      alert(`文章获取失败：${error instanceof Error && error.message ? error.message : '请检查控制台错误信息。'}`)
    } finally {
      setIsSubmitting(false)
      setIsReasoning(false) // 确保在任何情况下都能重置推理状态
      setProgress("")
    }
  }

  return (
    <AuthGuard>
      <div className="h-full flex flex-col flex-1 gap-2 p-4 overflow-hidden">
        {/* 固定高度区域：输入框和按钮 */}
        <div className="flex-none space-y-2">
        <div>
          <Label htmlFor="url" className="font-bold">文章 URL</Label>
          <Input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="请输入文章 URL"
            className="mt-1"
          />
        </div>

        <span className="flex items-center gap-4">
          <CrawlerSplitButton
            variant="outline"
            crawlerType={crawlerType}
            onCrawlerTypeChange={setCrawlerType}
            menuLabel="获取方式"
            onClick={handleSubmit}
            disabled={!url || isSubmitting}
          >
            <ArrowUpDown size={16} className="mr-1" />
            {isSubmitting ? "处理中..." : "获取文章内容"}
          </CrawlerSplitButton>
          <AddArticle
            initialData={content}
            onArticleAdded={(dataString) => {
              setContent(dataString)
            }}
            isSubmitting={isSubmitting}
          />
          {isSubmitting && progress && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />
              {progress}
            </span>
          )}
        </span>

      </div>

      {/* 可滚动区域：推理内容和内容展示 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {/* 推理内容显示区域 - 使用 Accordion 折叠 */}
        {reasoning_content && (
          <Accordion type="single" collapsible className="w-full" value={accordionValue} onValueChange={setAccordionValue}>
            <AccordionItem value="reasoning">
              <AccordionTrigger className="font-bold">
                <span className="flex items-center gap-2">
                  <Sparkle size={16} />
                  推理过程 {isReasoning ? <span className="text-sm text-muted-foreground">(推理中...)</span> : null}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {reasoning_content}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* 内容显示区域 */}
        {content && (
          <div className="space-y-2">
            <span className="flex gap-2">
              <FileText size={16} />
              <Label className="font-bold">内容</Label>
            </span>
            <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
              {content}
            </div>
          </div>
        )}
      </div>
    </div>
    </AuthGuard>
  )
}