"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import { Check, CircleCheck, CircleDashed, Download, ExternalLink, Eye, Loader2, RotateCw, Save } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  newArticleByStream,
  type CrawlerType,
  type DeepSeekArticle,
  type DeepSeekSearchItem,
  type DeepSeekStreamEvent,
} from "@/features/article/api"
import { readSseStream } from "@/lib/sse"
import { getFridayOfWeek } from "@/components/common/selectArticleDate"
import {
  ArticleFormFields,
  parseArticleData,
  saveArticle,
  toArticleFormData,
  validateArticle,
  type ArticleFormData,
} from "@/app/articles/addArticle"
import { CrawlerSplitButton } from "@/app/search/crawlerSplitButton"

export interface SearchResult {
  title: string
  url: string
  positive?: number // 豆包：1 完全满足搜索条件；0 不完全满足
  // 以下为 DeepSeek 返回的字段
  snippet?: string
  summary?: string
  rerank_score?: number
  site_name?: string | null
  date?: string | null
  authority?: number
}

/** DeepSeek 一次性返回完整的搜索结果列表，过滤掉缺少 url 的条目 */
export function fromDeepSeekResults(items: DeepSeekSearchItem[]): SearchResult[] {
  return items
    .filter(item => typeof item.url === 'string' && item.url)
    .map(item => ({
      title: item.title || item.url,
      url: item.url,
      snippet: item.snippet,
      summary: item.summary,
      rerank_score: item.rerank_score,
      site_name: item.site_name,
      date: item.date,
      authority: item.authority,
    }))
}

/**
 * 从流式返回的（可能尚不完整的）content 中解析出已完整的搜索结果。
 * content 形如 {"data": [{...}, {...}]}，逐字符扫描 data 数组，
 * 每遇到一个闭合的对象就解析为一条结果，未闭合的尾部对象留待后续数据到达。
 */
export function extractSearchResults(content: string): SearchResult[] {
  const dataKeyIndex = content.indexOf('"data"')
  const arrayStart = content.indexOf('[', dataKeyIndex === -1 ? 0 : dataKeyIndex)
  if (arrayStart === -1) return []

  const results: SearchResult[] = []
  let depth = 0
  let inString = false
  let escaped = false
  let objectStart = -1

  for (let i = arrayStart + 1; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
    } else if (ch === '{') {
      if (depth === 0) objectStart = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && objectStart !== -1) {
        try {
          const item = JSON.parse(content.slice(objectStart, i + 1))
          if (typeof item.url === 'string') {
            results.push({ title: item.title || item.url, url: item.url, positive: Number(item.positive) })
          }
        } catch (parseError) {
          console.warn('搜索结果解析错误:', content.slice(objectStart, i + 1), parseError)
        }
        objectStart = -1
      }
    } else if (ch === ']' && depth === 0) {
      break
    }
  }

  return results
}

interface RowState {
  status: 'idle' | 'fetching' | 'fetched' | 'error'
  progress?: string // DeepSeek 获取过程中的阶段提示
  article?: ArticleFormData
  saving?: boolean
  saved?: boolean
}

const idleRow: RowState = { status: 'idle' }

// DeepSeek 文章提取各阶段在按钮上显示的文本，长度与“获取中...”保持一致，避免按钮宽度跳动
const fetchStageLabels: Record<string, string> = {
  fetching: '抓取中...',
  extracting: '提取中...',
}

/**
 * 按所选方式流式获取文章内容。
 * 豆包：增量拼接 content 后整体解析；DeepSeek：分阶段事件，article 事件一次性返回完整文章，
 * 收到 error 事件即视为失败（即使随后收到 [DONE]）。
 */
async function fetchArticle(
  url: string,
  crawlerType: CrawlerType,
  signal: AbortSignal,
  onProgress: (stage: string) => void,
): Promise<{ article: ArticleFormData; truncated: boolean }> {
  const response = await newArticleByStream(url, crawlerType, signal)

  if (crawlerType === 'deepseek') {
    const result: { article?: DeepSeekArticle; truncated: boolean; error?: string } = { truncated: false }
    await readSseStream<DeepSeekStreamEvent>(response, (event) => {
      switch (event.type) {
        case 'progress':
          onProgress(event.stage)
          break
        case 'article':
          result.article = event.data
          result.truncated = event.analysis_truncated
          break
        case 'error':
          result.error = event.error.message
          break
      }
    })
    if (result.error) throw new Error(result.error)
    if (!result.article) throw new Error('未返回文章内容')
    return { article: toArticleFormData(result.article), truncated: result.truncated }
  }

  let content = ''
  await readSseStream(response, (data) => {
    if (data.content !== undefined) {
      content += data.content
    }
  })
  return { article: parseArticleData(content), truncated: false }
}

// 将 DeepSeek 返回的 UTC 时间转换为本地日期
function formatResultDate(date?: string | null) {
  if (!date) return null
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? null : format(parsed, 'yyyy-MM-dd')
}

function MatchBadge({ result, crawlerType }: { result: SearchResult; crawlerType: CrawlerType }) {
  if (crawlerType === 'deepseek') {
    // rerank_score 为 0～3，官方将 ≥1.5 视为优质结果
    const score = result.rerank_score ?? 0
    return score >= 1.5 ? (
      <Badge>
        <CircleCheck />
        优质 {score.toFixed(2)}
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        <CircleDashed />
        一般 {score.toFixed(2)}
      </Badge>
    )
  }

  return result.positive === 1 ? (
    <Badge>
      <CircleCheck />
      完全符合
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      <CircleDashed />
      部分符合
    </Badge>
  )
}

interface SearchResultTableProps {
  results: SearchResult[]
  crawlerType: CrawlerType // 本次搜索使用的方式，决定匹配度列的展示
}

/**
 * 搜索结果表格。每次搜索时父组件通过 key 重新挂载本组件，以清空各行状态；
 * 卸载时会中止仍在进行中的获取请求，避免上一次搜索的请求结果影响新的搜索。
 */
export function SearchResultTable({ results, crawlerType }: SearchResultTableProps) {
  // 各行的获取/保存状态，以行序号为键（同一次搜索内结果只会追加，序号稳定；且重复的 url 不会共享状态）
  const [rows, setRows] = useState<Record<number, RowState>>({})
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  // “获取内容”的方式，表格内所有行共用；DeepSeek 获取文章的速度和效果均优于豆包，因此固定默认 DeepSeek，不跟随搜索方式
  const [fetchCrawlerType, setFetchCrawlerType] = useState<CrawlerType>("deepseek")
  const controllersRef = useRef(new Map<number, AbortController>())

  useEffect(() => {
    const controllers = controllersRef.current
    return () => {
      controllers.forEach(controller => controller.abort())
      controllers.clear()
    }
  }, [])

  const updateRow = (index: number, patch: Partial<RowState>) => {
    setRows(prev => ({ ...prev, [index]: { ...(prev[index] ?? idleRow), ...patch } }))
  }

  // 明细查看中修改的字段写回该行的文章数据
  const updateArticle = (index: number, patch: Partial<ArticleFormData>) => {
    setRows(prev => {
      const row = prev[index]
      if (!row?.article) return prev
      return { ...prev, [index]: { ...row, article: { ...row.article, ...patch } } }
    })
  }

  // 获取内容：等同于 articles 页面的“获取文章内容”，在后台流式获取并解析
  const handleFetch = async (index: number, url: string) => {
    controllersRef.current.get(index)?.abort()
    const controller = new AbortController()
    controllersRef.current.set(index, controller)

    // 重新获取会覆盖之前的文章数据，因此同时清除“已保存”标记
    updateRow(index, { status: 'fetching', progress: undefined, saved: false })
    try {
      const { article, truncated } = await fetchArticle(url, fetchCrawlerType, controller.signal, (stage) => {
        updateRow(index, { progress: stage })
      })
      if (controller.signal.aborted) return

      updateRow(index, {
        status: 'fetched',
        progress: undefined,
        article: {
          ...article,
          url: article.url || url,
          mail_date: article.mail_date ?? getFridayOfWeek(0), // 预计邮件发送日期默认本周
        },
      })
      toast.success(`内容获取成功：${article.title || url}`)
      if (truncated) {
        toast.warning('正文过长，摘要仅覆盖已分析的部分，正文内容完整保留')
      }
    } catch (error) {
      // 组件卸载（重新搜索）或被新的请求替代时，静默结束
      if (controller.signal.aborted) return
      console.error('Error fetching article:', error)
      updateRow(index, { status: 'error', progress: undefined })
      toast.error(`内容获取失败：${error instanceof Error && error.message ? error.message : url}`)
    } finally {
      if (controllersRef.current.get(index) === controller) {
        controllersRef.current.delete(index)
      }
    }
  }

  // 保存：通过接口保存解析完成的文章
  const handleSave = async (index: number) => {
    const article = rows[index]?.article
    if (!article) return

    const error = validateArticle(article)
    if (error) {
      toast.error(error)
      return
    }

    updateRow(index, { saving: true })
    try {
      await saveArticle(article)
      updateRow(index, { saving: false, saved: true })
      toast.success(`文章保存成功：${article.title}`)
    } catch (error) {
      console.error('Error saving article:', error)
      updateRow(index, { saving: false })
      toast.error('保存文章失败')
    }
  }

  const detailArticle = detailIndex !== null ? rows[detailIndex]?.article : undefined

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">序号</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-28">{crawlerType === 'deepseek' ? '相关度' : '匹配度'}</TableHead>
            {/* w-px：操作列按按钮实际宽度收缩，剩余空间留给标题列 */}
            <TableHead className="w-px">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result, index) => {
            const row = rows[index] ?? idleRow
            const isFetching = row.status === 'fetching'
            const isFetched = row.status === 'fetched'
            const resultDate = formatResultDate(result.date)
            const meta = [
              result.site_name,
              resultDate,
              (result.authority ?? -1) >= 3 ? '权威来源' : null,
            ].filter(Boolean).join(' · ')

            return (
              <TableRow key={`${index}-${result.url}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">{result.title}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md break-all space-y-1">
                      <p>{result.url}</p>
                      {result.summary && <p className="line-clamp-6">{result.summary}</p>}
                    </TooltipContent>
                  </Tooltip>
                  {meta && <div className="text-xs text-muted-foreground mt-0.5">{meta}</div>}
                  {result.snippet && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{result.snippet}</div>
                  )}
                </TableCell>
                <TableCell>
                  <MatchBadge result={result} crawlerType={crawlerType} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        打开链接
                      </a>
                    </Button>
                    <CrawlerSplitButton
                      variant="outline"
                      size="sm"
                      className="min-w-25" // 固定最小宽度，避免状态文本切换时按钮宽度跳动
                      crawlerType={fetchCrawlerType}
                      onCrawlerTypeChange={setFetchCrawlerType}
                      menuLabel="获取方式（所有行通用）"
                      disabled={isFetching}
                      onClick={() => handleFetch(index, result.url)}
                    >
                      {isFetching ? <Loader2 className="animate-spin" /> : row.status === 'idle' ? <Download /> : <RotateCw />}
                      {isFetching
                        ? (row.progress && fetchStageLabels[row.progress]) || "获取中..."
                        : row.status === 'idle' ? "获取内容" : "重新获取"}
                    </CrawlerSplitButton>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isFetched}
                      onClick={() => {
                        setDetailIndex(index)
                        setDetailOpen(true)
                      }}
                    >
                      <Eye />
                      明细查看
                    </Button>
                    <Button
                      size="sm"
                      className="min-w-22" // 固定最小宽度，避免“保存/保存中.../已保存”切换时按钮宽度跳动
                      disabled={!isFetched || row.saving || row.saved}
                      onClick={() => handleSave(index)}
                    >
                      {row.saving ? <Loader2 className="animate-spin" /> : row.saved ? <Check /> : <Save />}
                      {row.saving ? "保存中..." : row.saved ? "已保存" : "保存"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* 明细查看：仅用于查看解析结果，保存通过表格行尾的“保存”按钮完成 */}
      <Dialog open={detailOpen && !!detailArticle} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-6 gap-0">
          <DialogHeader className="shrink-0 pb-4">
            <DialogTitle>明细查看</DialogTitle>
            <DialogDescription>
              查看解析出的文章信息，此处的修改会在点击行尾“保存”时一并提交。
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 rounded-md pt-4">
            {detailIndex !== null && detailArticle && (
              <ArticleFormFields
                data={detailArticle}
                onChange={(patch) => updateArticle(detailIndex, patch)}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                关闭
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
