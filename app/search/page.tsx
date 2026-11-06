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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface SearchGroup {
  callIndex: number
  totalCalls: number
  toolCallId?: string
  query?: string
  results: SearchResult[]
  status: "searching" | "completed" | "error"
  message?: string
}

export default function SearchPage() {
  const [question, setQuestion] = useState("")
  const [crawlerType, setCrawlerType] = useState<CrawlerType>("doubao") // 下拉框中选择的搜索方式
  const [resultCrawlerType, setResultCrawlerType] = useState<CrawlerType>("doubao") // 当前结果实际使用的搜索方式
  const [reasoning_content, setReasoningContent] = useState("")
  const [content, setContent] = useState("") // 豆包：流式返回的原始 JSON 文本
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([])
  const [searchError, setSearchError] = useState("")
  const [progress, setProgress] = useState("") // DeepSeek 阶段提示
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accordionValue, setAccordionValue] = useState<string | undefined>("reasoning") // 推理内容默认展开
  const [isReasoning, setIsReasoning] = useState(false) // 是否正在推理
  const [searchId, setSearchId] = useState(0) // 每次搜索递增，用于重置结果表格中各行的状态
  const abortRef = useRef<AbortController | null>(null)

  // 离开页面时中止仍在进行中的搜索
  useEffect(() => () => abortRef.current?.abort(), [])

  const results = useMemo(() => extractSearchResults(content), [content])
  const isDeepseek = resultCrawlerType === "deepseek"
  const hasResults = isDeepseek ? searchGroups.length > 0 : !!content
  const resultCount = isDeepseek ? searchGroups.reduce((sum, group) => sum + group.results.length, 0) : results.length

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
      setSearchGroups([])
      setSearchError("")
      setProgress("")
      setSearchId(prev => prev + 1)

      const response = await searchByStream({ "system_prompt": "", "content": question }, currentCrawlerType, controller.signal)

      if (currentCrawlerType === "deepseek") {
        await readSseStream<DeepSeekStreamEvent>(response, (event) => {
          if (controller.signal.aborted) return
          if (event.type === "article") return

          if (event.call_index !== undefined) {
            const callIndex = event.call_index
            setSearchGroups(prev => {
              const existing = prev.find(group => group.callIndex === callIndex)
              const group: SearchGroup = {
                callIndex,
                totalCalls: event.total_calls ?? existing?.totalCalls ?? callIndex,
                toolCallId: event.tool_call_id ?? existing?.toolCallId,
                query: event.query ?? existing?.query,
                results: event.type === "search_results" ? fromDeepSeekResults(event.data) : existing?.results ?? [],
                status: event.type === "error" ? "error" : event.type === "search_results" ? "completed" : "searching",
                message: event.type === "error" ? event.error.message : event.type === "progress" ? event.message : undefined,
              }
              return existing
                ? prev.map(item => item.callIndex === callIndex ? group : item)
                : [...prev, group]
            })
          }

          switch (event.type) {
            case "progress":
              setProgress(event.call_index === undefined
                ? event.message
                : `第 ${event.call_index}/${event.total_calls} 次搜索：${event.message}`)
              break
            case "error":
              if (event.call_index === undefined) setSearchError(event.error.message)
              toast.error(`${event.call_index === undefined ? "搜索失败" : `第 ${event.call_index} 次搜索失败`}：${event.error.message}`)
              break
          }
        })
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
      const message = error instanceof Error && error.message ? error.message : '请检查控制台错误信息'
      setSearchError(message)
      setSearchGroups(prev => prev.map(group => group.status === "searching"
        ? { ...group, status: "error", message }
        : group))
      toast.error(`搜索失败：${message}`)
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
          {searchError && (
            <div role="alert" className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
              搜索失败：{searchError}
            </div>
          )}
          {hasResults && (
            <div className="space-y-2">
              <span className="flex flex-wrap items-center gap-2">
                <FileText size={16} />
                <Label className="font-bold">搜索结果（{resultCount} 条）</Label>
                {isDeepseek && (
                  <span className="text-sm text-muted-foreground">
                    {searchGroups.filter(group => group.status !== "searching").length}/{searchGroups[0].totalCalls} 次搜索已结束
                  </span>
                )}
                {isSubmitting && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    接收中...
                  </span>
                )}
              </span>
              {isDeepseek ? (
                <Tabs key={searchId} defaultValue={String(searchGroups[0].callIndex)} className="min-w-0">
                  <div className="overflow-x-auto">
                    <TabsList aria-label="搜索调用">
                      {searchGroups.map(group => (
                        <TabsTrigger key={group.callIndex} value={String(group.callIndex)} title={group.query}>
                          搜索 {group.callIndex}
                          {group.status === "searching" ? (
                            <><Loader2 size={14} className="animate-spin" />搜索中</>
                          ) : group.status === "error" ? (
                            <span className="text-destructive">失败</span>
                          ) : `（${group.results.length} 条）`}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                  {searchGroups.map(group => (
                    <TabsContent
                      key={group.callIndex}
                      value={String(group.callIndex)}
                      forceMount
                      className="space-y-2 data-[state=inactive]:hidden"
                    >
                      <p className="text-sm text-muted-foreground break-all">
                        搜索关键词：{group.query || "未生成有效搜索词"}
                      </p>
                      {group.status === "searching" ? (
                        <div role="status" className="flex items-center gap-2 p-4 bg-muted rounded-md text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" />
                          {group.message}
                        </div>
                      ) : group.status === "error" ? (
                        <div role="alert" className="p-4 bg-destructive/10 text-destructive rounded-md text-sm">
                          第 {group.callIndex} 次搜索失败：{group.message}
                        </div>
                      ) : group.results.length > 0 ? (
                        <SearchResultTable results={group.results} crawlerType="deepseek" />
                      ) : (
                        <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground">未找到相关结果</div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : results.length > 0 ? (
                <SearchResultTable key={searchId} results={results} crawlerType={resultCrawlerType} />
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
