"use client"

import { searchByStream, type CrawlerType, type DeepSeekStreamEvent } from "@/features/article/api"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { FileText, Sparkle, Search, Loader2 } from "lucide-react"
import { AuthGuard } from "@/components/common/auth-guard"
import { Textarea } from "@/components/ui/textarea"
import { readSseStream } from "@/lib/sse"
import { extractSearchResults, fromDeepSeekResults, SearchResultTable, type SearchResult } from "@/app/search/searchResultTable"
import { PromptTemplateToolbar } from "@/app/search/promptTemplate"
import { CrawlerSplitButton } from "@/app/search/crawlerSplitButton"

export default function SearchPage() {
  const [question, setQuestion] = useState("")
  const [crawlerType, setCrawlerType] = useState<CrawlerType>("doubao") // 下拉框中选择的搜索方式
  const [resultCrawlerType, setResultCrawlerType] = useState<CrawlerType>("doubao") // 当前结果实际使用的搜索方式
  const [reasoning_content, setReasoningContent] = useState("")
  const [content, setContent] = useState("") // 豆包：流式返回的原始 JSON 文本
  const [deepseekResults, setDeepseekResults] = useState<SearchResult[] | null>(null) // DeepSeek：一次性返回的结果列表
  const [deepseekQuery, setDeepseekQuery] = useState("") // DeepSeek 模型提炼出的搜索关键词
  const [progress, setProgress] = useState("") // DeepSeek 阶段提示
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string | undefined>("reasoning") // 推理内容默认展开
  const [isReasoning, setIsReasoning] = useState(false) // 是否正在推理
  const [searchId, setSearchId] = useState(0) // 每次搜索递增，用于重置结果表格中各行的状态
  const abortRef = useRef<AbortController | null>(null)

  // 离开页面时中止仍在进行中的搜索
  useEffect(() => () => abortRef.current?.abort(), [])

  // 豆包的 content 为流式返回的 JSON，每解析出一条完整数据就在表格中显示一行；DeepSeek 直接使用返回的列表
  const results = useMemo(
    () => resultCrawlerType === "deepseek" ? deepseekResults ?? [] : extractSearchResults(content),
    [resultCrawlerType, deepseekResults, content]
  )
  const hasResults = resultCrawlerType === "deepseek" ? deepseekResults !== null : !!content

  const handleSubmit = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const currentCrawlerType = crawlerType

    try {
      setIsSubmitting(true)
      setIsReasoning(currentCrawlerType === "doubao") // DeepSeek 分支关闭思考模式，没有推理过程
      setAccordionValue("reasoning")
      // 清空上一次搜索的全部结果
      setResultCrawlerType(currentCrawlerType)
      setReasoningContent("")
      setContent("")
      setDeepseekResults(null)
      setDeepseekQuery("")
      setProgress("")
      setSearchId(prev => prev + 1)

      const response = await searchByStream({ "system_prompt": "", "content": question }, currentCrawlerType, controller.signal)

      if (currentCrawlerType === "deepseek") {
        const streamError: { message?: string } = {}
        await readSseStream<DeepSeekStreamEvent>(response, (event) => {
          switch (event.type) {
            case "progress":
              setProgress(event.message)
              if (event.query) setDeepseekQuery(event.query)
              break
            case "search_results":
              setDeepseekResults(fromDeepSeekResults(event.data ?? []))
              setDeepseekQuery(event.query)
              break
            case "error":
              streamError.message = event.error.message
              break
          }
        })
        // 收到 [DONE] 不代表成功，以是否出现 error 事件为准
        if (streamError.message) throw new Error(streamError.message)
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
      if (controller.signal.aborted) return
      console.error('Error:', error)
      toast.error(`搜索失败：${error instanceof Error && error.message ? error.message : '请检查控制台错误信息'}`)
    } finally {
      // 已被新的搜索替代时，状态由新的搜索负责
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsSubmitting(false)
        setIsReasoning(false) // 确保在任何情况下都能重置推理状态
        setProgress("")
      }
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

          <span className="flex items-center gap-4">
            <CrawlerSplitButton
              crawlerType={crawlerType}
              onCrawlerTypeChange={setCrawlerType}
              menuLabel="搜索方式"
              onClick={handleSubmit}
              disabled={!question || isSubmitting}
            >
              <Search size={16} className="mr-1" />
              {isSubmitting ? "处理中..." : "搜索"}
            </CrawlerSplitButton>
            {isSubmitting && progress && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                {progress}
              </span>
            )}
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
          {hasResults && (
            <div className="space-y-2">
              <span className="flex flex-wrap items-center gap-2">
                <FileText size={16} />
                <Label className="font-bold">搜索结果（{results.length} 条）</Label>
                {deepseekQuery && (
                  <span className="text-sm text-muted-foreground break-all">搜索关键词：{deepseekQuery}</span>
                )}
                {isSubmitting && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    接收中...
                  </span>
                )}
              </span>
              {results.length > 0 ? (
                <SearchResultTable key={searchId} results={results} crawlerType={resultCrawlerType} />
              ) : !isSubmitting && (
                resultCrawlerType === "deepseek" ? (
                  <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground">未找到相关结果</div>
                ) : (
                  // 未能解析出任何结果时，展示原始内容以便排查
                  <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                    {content}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
