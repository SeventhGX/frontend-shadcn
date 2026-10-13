"use client"

import { searchByStream } from "@/features/article/api"
import { useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileText, Sparkle, Search, Loader2 } from "lucide-react"
import { AuthGuard } from "@/components/common/auth-guard"
import { Textarea } from "@/components/ui/textarea"
import { readSseStream } from "@/lib/sse"
import { extractSearchResults, SearchResultTable } from "@/app/search/searchResultTable"
import { PromptTemplateToolbar } from "@/app/search/promptTemplate"

export default function SearchPage() {
  const [question, setQuestion] = useState("")
  const [reasoning_content, setReasoningContent] = useState("")
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string | undefined>("reasoning") // 推理内容默认展开
  const [isReasoning, setIsReasoning] = useState(false) // 是否正在推理
  const [searchId, setSearchId] = useState(0) // 每次搜索递增，用于重置结果表格中各行的状态

  // content 为流式返回的 JSON，每解析出一条完整数据就在表格中显示一行
  const results = useMemo(() => extractSearchResults(content), [content])

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setIsReasoning(true)
      setAccordionValue("reasoning")
      // 清空之前的内容
      setReasoningContent("")
      setContent("")
      setSearchId(prev => prev + 1)

      const response = await searchByStream({ "system_prompt": "", "content": question })

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
      alert('搜索失败，请检查控制台错误信息。')
    } finally {
      setIsSubmitting(false)
      setIsReasoning(false) // 确保在任何情况下都能重置推理状态
    }
  }

  return (
    <AuthGuard>
      <div className="h-full flex flex-col flex-1 gap-2 p-4 overflow-hidden">
        {/* 固定高度区域：输入框和按钮 */}
        <div className="flex-none space-y-2">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="question" className="font-bold">搜索需求</Label>
              {/* 加载模版后直接填入搜索框，也可将搜索框内容保存为模版 */}
              <PromptTemplateToolbar content={question} onContentChange={setQuestion} />
            </div>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入查询需求，或从模版加载"
              className="max-h-40 overflow-auto"
            />
          </div>

          <span className="flex gap-4">
            <Button
              onClick={handleSubmit}
              disabled={!question || isSubmitting}
            >
              <Search size={16} className="mr-1" />
              {isSubmitting ? "处理中..." : "搜索"}
            </Button>
          </span>

        </div>

        {/* 可滚动区域：推理内容和搜索结果展示 */}
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

          {/* 搜索结果显示区域 */}
          {content && (
            <div className="space-y-2">
              <span className="flex items-center gap-2">
                <FileText size={16} />
                <Label className="font-bold">搜索结果（{results.length} 条）</Label>
                {isSubmitting && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    接收中...
                  </span>
                )}
              </span>
              {results.length > 0 ? (
                <SearchResultTable key={searchId} results={results} />
              ) : !isSubmitting && (
                // 未能解析出任何结果时，展示原始内容以便排查
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
