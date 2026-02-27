"use client"

import { newArticleByStream } from "@/features/article/api"
import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileText, Send, Sparkle, ArrowUpDown } from "lucide-react"
import { AddArticle } from "@/app/articles/addArticle"

export default function ArticlesPage() {
  const [url, setUrl] = useState("")
  const [reasoning_content, setReasoningContent] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string | undefined>("reasoning") // 推理内容默认展开
  const [isReasoning, setIsReasoning] = useState(false) // 是否正在推理

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setIsReasoning(true)
      setAccordionValue("reasoning")
      // 清空之前的内容
      setReasoningContent("")
      setContent("")

      const response = await newArticleByStream(url)

      // 获取流读取器
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法获取流读取器')
      }

      let buffer = '' // 用于缓存不完整的行
      let hasReceivedContent = false // 用于跟踪是否已经接收到 content 数据

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 按行分割
        const lines = buffer.split('\n')

        // 保留最后一个不完整的行
        buffer = lines.pop() || ''

        // 处理每一行
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            // 移除 SSE 格式的 "data: " 前缀
            let jsonStr = trimmedLine
            if (trimmedLine.startsWith('data: ')) {
              jsonStr = trimmedLine.substring(6)
            }

            // 检查是否为 SSE 终止标记
            if (jsonStr === '[DONE]' || jsonStr.trim() === '[DONE]') {
              console.log('SSE 流已完成')
              continue
            }

            // 跳过空字符串
            if (!jsonStr.trim()) {
              continue
            }

            try {
              const data = JSON.parse(jsonStr)

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
            } catch (parseError) {
              console.warn('JSON 解析错误:', trimmedLine, parseError)
            }
          }
        }
      }

      // 处理最后剩余的缓冲区内容
      if (buffer.trim()) {
        // 移除 SSE 格式的 "data: " 前缀
        let jsonStr = buffer.trim()
        if (jsonStr.startsWith('data: ')) {
          jsonStr = jsonStr.substring(6)
        }

        // 检查是否为 SSE 终止标记
        if (jsonStr === '[DONE]' || jsonStr.trim() === '[DONE]') {
          console.log('SSE 流已完成')
        } else if (jsonStr.trim()) {
          try {
            const data = JSON.parse(jsonStr)
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
          } catch (parseError) {
            console.warn('JSON 解析错误:', buffer, parseError)
          }
        }
      }

      // alert('文章获取成功！')
    } catch (error) {
      console.error('Error:', error)
      alert('文章获取失败，请检查控制台错误信息。')
    } finally {
      setIsSubmitting(false)
      setIsReasoning(false) // 确保在任何情况下都能重置推理状态
    }
  }

  return (
    <div className="flex flex-col flex-1 gap-1 min-h-0 mt-2">
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

        <span className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={!url || isSubmitting}
            variant="outline"
          >
            <ArrowUpDown size={16} className="mr-1" />
            {isSubmitting ? "处理中..." : "获取文章内容"}
          </Button>
          <AddArticle
            initialData={content}
            onArticleAdded={(dataString) => {
              setContent(dataString)
            }} />
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
  )
}