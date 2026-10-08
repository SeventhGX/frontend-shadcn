"use client"

import { useState } from "react"
import { toast } from "sonner"
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
import { newArticleByStream } from "@/features/article/api"
import { readSseStream } from "@/lib/sse"
import { getFridayOfWeek } from "@/components/common/selectArticleDate"
import {
  ArticleFormFields,
  parseArticleData,
  saveArticle,
  validateArticle,
  type ArticleFormData,
} from "@/app/articles/addArticle"

export interface SearchResult {
  title: string
  url: string
  positive: number // 1：完全满足搜索条件；0：不完全满足
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
  article?: ArticleFormData
  saving?: boolean
  saved?: boolean
}

const idleRow: RowState = { status: 'idle' }

export function SearchResultTable({ results }: { results: SearchResult[] }) {
  // 各行的获取/保存状态，以 url 为键
  const [rows, setRows] = useState<Record<string, RowState>>({})
  const [detailUrl, setDetailUrl] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const updateRow = (url: string, patch: Partial<RowState>) => {
    setRows(prev => ({ ...prev, [url]: { ...(prev[url] ?? idleRow), ...patch } }))
  }

  // 明细查看中修改的字段写回该行的文章数据
  const updateArticle = (url: string, patch: Partial<ArticleFormData>) => {
    setRows(prev => {
      const row = prev[url]
      if (!row?.article) return prev
      return { ...prev, [url]: { ...row, article: { ...row.article, ...patch } } }
    })
  }

  // 获取内容：等同于 articles 页面的“获取文章内容”，在后台流式获取并解析
  const handleFetch = async (url: string) => {
    updateRow(url, { status: 'fetching', saved: false })
    try {
      const response = await newArticleByStream(url)
      let content = ''
      await readSseStream(response, (data) => {
        if (data.content !== undefined) {
          content += data.content
        }
      })

      const article = parseArticleData(content)
      updateRow(url, {
        status: 'fetched',
        article: {
          ...article,
          url: article.url || url,
          mail_date: article.mail_date ?? getFridayOfWeek(0), // 预计邮件发送日期默认本周
        },
      })
      toast.success(`内容获取成功：${article.title || url}`)
    } catch (error) {
      console.error('Error fetching article:', error)
      updateRow(url, { status: 'error' })
      toast.error(`内容获取失败：${url}`)
    }
  }

  // 保存：通过接口保存解析完成的文章
  const handleSave = async (url: string) => {
    const article = rows[url]?.article
    if (!article) return

    const error = validateArticle(article)
    if (error) {
      toast.error(error)
      return
    }

    updateRow(url, { saving: true })
    try {
      await saveArticle(article)
      updateRow(url, { saving: false, saved: true })
      toast.success(`文章保存成功：${article.title}`)
    } catch (error) {
      console.error('Error saving article:', error)
      updateRow(url, { saving: false })
      toast.error('保存文章失败')
    }
  }

  const detailArticle = detailUrl ? rows[detailUrl]?.article : undefined

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">序号</TableHead>
            <TableHead>标题</TableHead>
            <TableHead className="w-28">匹配度</TableHead>
            {/* w-px：操作列按按钮实际宽度收缩，剩余空间留给标题列 */}
            <TableHead className="w-px">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((result, index) => {
            const row = rows[result.url] ?? idleRow
            const isFetching = row.status === 'fetching'
            const isFetched = row.status === 'fetched'

            return (
              <TableRow key={`${index}-${result.url}`}>
                <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="whitespace-normal">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">{result.title}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md break-all">{result.url}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {result.positive === 1 ? (
                    <Badge>
                      <CircleCheck />
                      完全符合
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <CircleDashed />
                      部分符合
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink />
                        打开链接
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-w-25" // 固定最小宽度，避免状态文本切换时按钮宽度跳动
                      disabled={isFetching}
                      onClick={() => handleFetch(result.url)}
                    >
                      {isFetching ? <Loader2 className="animate-spin" /> : row.status === 'idle' ? <Download /> : <RotateCw />}
                      {isFetching ? "获取中..." : row.status === 'idle' ? "获取内容" : "重新获取"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!isFetched}
                      onClick={() => {
                        setDetailUrl(result.url)
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
                      onClick={() => handleSave(result.url)}
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
            {detailUrl && detailArticle && (
              <ArticleFormFields
                data={detailArticle}
                onChange={(patch) => updateArticle(detailUrl, patch)}
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
