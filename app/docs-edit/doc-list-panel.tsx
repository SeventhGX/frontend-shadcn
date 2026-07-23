"use client"

import * as React from "react"
import { FilePlus2, FileText, Loader2, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DocItem } from "@/features/docs/api"

interface DocListPanelProps {
  docs: DocItem[]
  loading: boolean
  activeId: string | null
  deletingId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (doc: DocItem) => void
}

/**
 * 编辑页左侧：已有教程清单，支持新建、加载、删除。
 */
export function DocListPanel({
  docs,
  loading,
  activeId,
  deletingId,
  onSelect,
  onNew,
  onDelete,
}: DocListPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">教程清单</h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onNew}>
          <FilePlus2 size={14} />
          新建
        </Button>
      </div>
      <nav className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">暂无教程，点击右上角新建</p>
        ) : (
          <ul className="space-y-1">
            {docs.map((doc) => (
              <li key={doc.id}>
                <div
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 transition-colors",
                    doc.id === activeId
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(doc.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                  >
                    <FileText size={14} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{doc.docs_name}</span>
                      {doc.docs_desc && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {doc.docs_desc}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="删除教程"
                    title="删除教程"
                    onClick={() => onDelete(doc)}
                    disabled={deletingId === doc.id}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-50"
                  >
                    {deletingId === doc.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </div>
  )
}
