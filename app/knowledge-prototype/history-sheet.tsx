"use client"

import * as React from "react"
import { toast } from "sonner"
import { Clock, LoaderCircle, Search, Trash2 } from "lucide-react"

import {
  deleteQuestionLog,
  getQuestionHistory,
  type QuestionLog,
} from "@/features/knowledge-v2/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const PAGE_SIZE = 20

function formatTime(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

export function HistorySheet({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (log: QuestionLog) => void
}) {
  const [keyword, setKeyword] = React.useState("")
  const [items, setItems] = React.useState<QuestionLog[]>([])
  const [page, setPage] = React.useState(1)
  const [pages, setPages] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const load = React.useCallback(async (nextPage: number, question: string) => {
    try {
      setLoading(true)
      const res = await getQuestionHistory({
        page: nextPage,
        page_size: PAGE_SIZE,
        question: question.trim() || undefined,
      })
      setItems(res?.data?.items ?? [])
      setPage(res?.data?.page ?? nextPage)
      setPages(res?.data?.pages ?? 1)
    } catch (error) {
      console.error(error)
      toast.error("加载历史问答失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) load(1, "")
  }, [open, load])

  const handleDelete = async (log: QuestionLog) => {
    try {
      setDeletingId(log.id)
      await deleteQuestionLog(log.id)
      setItems((prev) => prev.filter((item) => item.id !== log.id))
      toast.success("已删除该条历史问答")
    } catch (error) {
      console.error(error)
      toast.error("删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>历史问答</SheetTitle>
          <SheetDescription>
            点击任意记录可将其加载到当前对话中继续查看。
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 px-4">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load(1, keyword)
            }}
            placeholder="按问题内容搜索"
            className="h-9"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => load(1, keyword)}
          >
            <Search size={16} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
              <LoaderCircle size={16} className="animate-spin" />
              加载中...
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              暂无历史问答
            </p>
          ) : (
            items.map((log) => (
              <div
                key={log.id}
                className="hover:bg-accent flex items-start gap-2 rounded-md border px-3 py-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(log)
                    onOpenChange(false)
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="line-clamp-2 text-sm font-medium">
                    {log.question}
                  </p>
                  <p className="text-muted-foreground line-clamp-1 mt-1 text-xs">
                    {log.answer}
                  </p>
                  <p className="text-muted-foreground/80 mt-1 flex items-center gap-1 text-xs">
                    <Clock size={11} />
                    {formatTime(log.create_time)}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="删除该条历史问答"
                  title="删除"
                  disabled={deletingId === log.id}
                  onClick={() => handleDelete(log)}
                  className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1.5 transition-colors disabled:opacity-50"
                >
                  {deletingId === log.id ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
          <span className="text-muted-foreground text-xs tabular-nums">
            第 {page} / {pages} 页
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page <= 1}
              onClick={() => load(page - 1, keyword)}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || page >= pages}
              onClick={() => load(page + 1, keyword)}
            >
              下一页
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
