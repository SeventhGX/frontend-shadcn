"use client"

import * as React from "react"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"

import type { KnowledgeChunkV2 } from "@/features/knowledge-v2/api"
import { Badge } from "@/components/ui/badge"

function formatScore(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(3) : "—"
}

function ChunkCard({ chunk, index }: { chunk: KnowledgeChunkV2; index: number }) {
  const [expanded, setExpanded] = React.useState(false)

  const filename = chunk.filename || chunk.knowledge_id
  const header =
    (chunk.meta_data?.["Header 2"] as string | undefined) ??
    (chunk.meta_data?.["Header 1"] as string | undefined)
  const isHybrid = chunk.retrieval_method === "hybrid"

  const metaEntries = Object.entries(chunk.meta_data ?? {}).filter(
    ([key, value]) =>
      !key.startsWith("Header") &&
      (typeof value === "string" || typeof value === "number")
  )

  return (
    <div className="bg-background/60 rounded-md border text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="shrink-0" />
        ) : (
          <ChevronRight size={12} className="shrink-0" />
        )}
        <span className="text-muted-foreground shrink-0 tabular-nums">
          #{index + 1}
        </span>
        <FileText size={12} className="text-muted-foreground shrink-0" />
        <span className="truncate font-medium" title={filename}>
          {filename}
        </span>
        {header && (
          <span className="text-muted-foreground truncate">· {header}</span>
        )}
        {typeof chunk.score === "number" && (
          <Badge variant="secondary" className="ml-auto shrink-0">
            {formatScore(chunk.score)}
          </Badge>
        )}
      </button>
      {expanded && (
        <div className="space-y-2 border-t px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {typeof chunk.score === "number" ? (
              <>
                <Badge variant="secondary">
                  综合 {formatScore(chunk.score)}
                </Badge>
                <Badge variant="outline">
                  语义 {formatScore(chunk.semantic_score)}
                </Badge>
                {isHybrid && (
                  <Badge variant="outline">
                    关键词 {formatScore(chunk.keyword_score)}
                  </Badge>
                )}
              </>
            ) : (
              <Badge variant="outline">历史记录不保留检索分数</Badge>
            )}
            {metaEntries.map(([key, value]) => (
              <Badge key={key} variant="outline">
                {key}: {String(value)}
              </Badge>
            ))}
          </div>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {chunk.content}
          </p>
        </div>
      )}
    </div>
  )
}

export function ChunkList({ chunks }: { chunks: KnowledgeChunkV2[] }) {
  if (chunks.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        本次回答没有命中任何知识片段
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      {chunks.map((chunk, index) => (
        <ChunkCard key={chunk.chunk_id} chunk={chunk} index={index} />
      ))}
    </div>
  )
}
