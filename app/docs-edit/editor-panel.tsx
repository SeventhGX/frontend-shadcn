"use client"

import * as React from "react"
import { Code2, Eye, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { DocMarkdown } from "../docs/doc-markdown"

type EditorMode = "source" | "preview"

interface EditorPanelProps {
  docName: string
  docDesc: string
  content: string
  mode: EditorMode
  isNew: boolean
  dirty: boolean
  saving: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onDocNameChange: (value: string) => void
  onDocDescChange: (value: string) => void
  onContentChange: (value: string) => void
  onModeChange: (mode: EditorMode) => void
  onSave: () => void
}

/**
 * 编辑页中间：教程元信息 + Markdown 编辑区。
 * 支持源码/预览切换，预览仅用于查看（图片经接口鉴权加载），不可编辑。
 */
export function EditorPanel({
  docName,
  docDesc,
  content,
  mode,
  isNew,
  dirty,
  saving,
  textareaRef,
  onDocNameChange,
  onDocDescChange,
  onContentChange,
  onModeChange,
  onSave,
}: EditorPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 元信息 */}
      <div className="space-y-2 border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {isNew ? "新建教程" : "编辑教程"}
            {dirty && <span className="ml-1 text-xs text-amber-500">（未保存）</span>}
          </h2>
          <Button size="sm" className="gap-1.5" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="doc-name" className="text-xs text-muted-foreground">
              文档名称 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="doc-name"
              value={docName}
              onChange={(e) => onDocNameChange(e.target.value)}
              placeholder="例如：快速开始"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="doc-desc" className="text-xs text-muted-foreground">
              文档描述（功能页面路由，用于自动匹配）
            </Label>
            <Input
              id="doc-desc"
              value={docDesc}
              onChange={(e) => onDocDescChange(e.target.value)}
              placeholder="例如：/knowledge，留空表示不匹配"
            />
          </div>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <div className="inline-flex overflow-hidden rounded-md border">
          <button
            type="button"
            onClick={() => onModeChange("source")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs transition-colors",
              mode === "source"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Code2 size={13} />
            源码
          </button>
          <button
            type="button"
            onClick={() => onModeChange("preview")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs transition-colors",
              mode === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent"
            )}
          >
            <Eye size={13} />
            预览
          </button>
        </div>
        <span className="ml-2 text-xs text-muted-foreground">
          {mode === "source" ? "编辑 Markdown 源码" : "预览渲染效果（只读）"}
        </span>
      </div>

      {/* 编辑 / 预览区 */}
      <div className="min-h-0 flex-1 overflow-auto">
        {mode === "source" ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            spellCheck={false}
            placeholder="在此输入 Markdown 内容…"
            className="h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <div className="px-6 py-4">
            {content.trim() ? (
              <DocMarkdown content={content} />
            ) : (
              <p className="text-sm text-muted-foreground">暂无内容可预览</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
