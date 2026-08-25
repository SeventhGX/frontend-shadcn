"use client"

import * as React from "react"
import { Check, Database, SlidersHorizontal, X } from "lucide-react"

import type {
  KnowledgeDatabase,
  KnowledgeTagV2,
  RetrievalMethodV2,
} from "@/features/knowledge-v2/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/** 问答检索参数 */
export interface RetrievalParams {
  retrievalMethod: RetrievalMethodV2
  /** 混合检索时语义权重百分比，关键词权重为 100 - semanticPercent */
  semanticPercent: number
  topK: number
  temperature: number
}

export const DEFAULT_RETRIEVAL_PARAMS: RetrievalParams = {
  retrievalMethod: "hybrid",
  semanticPercent: 70,
  topK: 10,
  temperature: 0.2,
}

const RETRIEVAL_METHOD_OPTIONS: Array<{
  value: RetrievalMethodV2
  label: string
}> = [
  { value: "vector", label: "向量检索" },
  { value: "hybrid", label: "混合检索" },
]

/** 知识范围：分库单选 + 公开标签多选（多标签为全部匹配语义） */
export function ScopePopover({
  databases,
  databaseName,
  onDatabaseNameChange,
  tags,
  selectedTagNames,
  onSelectedTagNamesChange,
  loading,
}: {
  databases: KnowledgeDatabase[]
  databaseName: string
  onDatabaseNameChange: (name: string) => void
  tags: KnowledgeTagV2[]
  selectedTagNames: string[]
  onSelectedTagNamesChange: (names: string[]) => void
  loading?: boolean
}) {
  const [keyword, setKeyword] = React.useState("")

  const filteredTags = React.useMemo(() => {
    const q = keyword.trim().toLowerCase()
    if (!q) return tags
    return tags.filter((tag) => tag.name.toLowerCase().includes(q))
  }, [keyword, tags])

  const toggleTag = (name: string) => {
    onSelectedTagNamesChange(
      selectedTagNames.includes(name)
        ? selectedTagNames.filter((n) => n !== name)
        : [...selectedTagNames, name]
    )
  }

  const label =
    databases.find((db) => db.database_name === databaseName)
      ?.database_desc || databaseName || "选择知识库"

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={databaseName ? "outline" : "destructive"}
          size="sm"
          disabled={loading}
        >
          <Database size={16} />
          <span className="max-w-40 truncate">{label}</span>
          {selectedTagNames.length > 0 && (
            <Badge variant="secondary">+{selectedTagNames.length} 标签</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="space-y-2 border-b p-3">
          <Label className="text-xs">知识库（必选）</Label>
          {databases.length === 0 ? (
            <p className="text-muted-foreground text-xs">暂无可用知识库</p>
          ) : (
            <div className="max-h-40 space-y-0.5 overflow-y-auto">
              {databases.map((db) => (
                <button
                  key={db.id}
                  type="button"
                  onClick={() => onDatabaseNameChange(db.database_name)}
                  className={cn(
                    "hover:bg-accent flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    databaseName === db.database_name && "bg-accent"
                  )}
                >
                  <Check
                    size={14}
                    className={cn(
                      "mt-0.5 shrink-0",
                      databaseName === db.database_name
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {db.database_desc || db.database_name}
                    </span>
                    {db.database_desc && (
                      <span className="text-muted-foreground block truncate">
                        {db.database_name}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">标签过滤（同时具备全部标签）</Label>
            <button
              type="button"
              disabled={selectedTagNames.length === 0}
              onClick={() => onSelectedTagNamesChange([])}
              className="text-muted-foreground hover:text-foreground shrink-0 text-xs disabled:pointer-events-none disabled:opacity-50"
            >
              清空
            </button>
          </div>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索标签"
            className="h-8 text-xs"
          />
          {selectedTagNames.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedTagNames.map((name) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => toggleTag(name)}
                >
                  {name}
                  <X size={11} />
                </Badge>
              ))}
            </div>
          )}
          <div className="flex max-h-40 flex-wrap gap-1 overflow-y-auto">
            {filteredTags.length === 0 ? (
              <p className="text-muted-foreground text-xs">无匹配标签</p>
            ) : (
              filteredTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={
                    selectedTagNames.includes(tag.name) ? "default" : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag.name)}
                >
                  {tag.name}
                </Badge>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** 检索与生成参数 */
export function RetrievalPopover({
  params,
  onChange,
}: {
  params: RetrievalParams
  onChange: (params: RetrievalParams) => void
}) {
  const patch = (next: Partial<RetrievalParams>) =>
    onChange({ ...params, ...next })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal size={16} />
          检索参数
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">检索方式</Label>
          <div
            role="group"
            aria-label="检索方式"
            className="bg-muted inline-flex rounded-md p-0.5"
          >
            {RETRIEVAL_METHOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={params.retrievalMethod === option.value}
                onClick={() => patch({ retrievalMethod: option.value })}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  params.retrievalMethod === option.value
                    ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {params.retrievalMethod === "hybrid" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <Label className="text-xs">语义权重</Label>
              <span className="text-muted-foreground tabular-nums">
                {params.semanticPercent}% / {100 - params.semanticPercent}%
              </span>
            </div>
            <Slider
              value={[params.semanticPercent]}
              min={0}
              max={100}
              step={1}
              aria-label="语义权重"
              onValueChange={(values) => patch({ semanticPercent: values[0] })}
            />
            <p className="text-muted-foreground text-xs">语义 / 关键词</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-xs">召回数量 top_k</Label>
            <span className="text-muted-foreground tabular-nums">
              {params.topK}
            </span>
          </div>
          <Slider
            value={[params.topK]}
            min={1}
            max={30}
            step={1}
            aria-label="召回数量"
            onValueChange={(values) => patch({ topK: values[0] })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <Label className="text-xs">生成温度</Label>
            <span className="text-muted-foreground tabular-nums">
              {params.temperature.toFixed(2)}
            </span>
          </div>
          <Slider
            value={[params.temperature]}
            min={0}
            max={1}
            step={0.05}
            aria-label="生成温度"
            onValueChange={(values) => patch({ temperature: values[0] })}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
