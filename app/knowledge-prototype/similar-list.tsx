"use client"

import * as React from "react"
import { Bookmark, Clock, LoaderCircle, Sparkles } from "lucide-react"

import type { SimilarQuestionLog } from "@/features/knowledge-v2/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChunkList } from "./chunk-list"

function formatTime(value?: string) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

/** 相似典型问答列表；点击条目用弹窗展示完整会话 */
export function SimilarList({
  items,
  loading,
  query,
  onRefresh,
}: {
  items: SimilarQuestionLog[]
  loading: boolean
  query: string
  onRefresh: () => void
}) {
  const [detail, setDetail] = React.useState<SimilarQuestionLog | null>(null)

  return (
    <>
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            基于本轮提问检索到的跨用户典型案例
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !query}
            onClick={onRefresh}
          >
            重新检索
          </Button>
        </div>

        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
            <LoaderCircle size={16} className="animate-spin" />
            检索中...
          </div>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            暂无相似的典型案例
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDetail(item)}
              className="hover:bg-accent rounded-md border px-3 py-2.5 text-left transition-colors"
            >
              <div className="flex items-start gap-2">
                <Sparkles
                  size={14}
                  className="text-muted-foreground mt-0.5 shrink-0"
                />
                <p className="line-clamp-2 flex-1 text-sm font-medium">
                  {item.question}
                </p>
                <Badge variant="secondary" className="shrink-0">
                  {item.score.toFixed(3)}
                </Badge>
              </div>
              <p className="text-muted-foreground line-clamp-2 mt-1 pl-6 text-xs">
                {item.answer}
              </p>
              <p className="text-muted-foreground/80 mt-1 flex items-center gap-2 pl-6 text-xs">
                <Clock size={11} />
                {formatTime(item.create_time)}
                <Bookmark size={11} />
                典型案例
              </p>
            </button>
          ))
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>典型问答</DialogTitle>
            <DialogDescription>
              相似度 {detail?.score.toFixed(3) ?? "-"} ·{" "}
              {formatTime(detail?.create_time)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground mb-1 text-xs">问题</p>
              <p className="bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                {detail?.question}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs">回答</p>
              <p className="bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                {detail?.answer}
              </p>
            </div>
            {detail?.chunks && detail.chunks.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs">
                  引用片段（{detail.chunks.length}）
                </p>
                <ChunkList chunks={detail.chunks} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
