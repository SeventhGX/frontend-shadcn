"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Send,
  Settings2,
} from "lucide-react"

import {
  chatKnowledgeStream,
  RAG_DEFAULTS,
  type KnowledgeChunk,
  type KnowledgeFile,
  type KnowledgeTag,
  type RetrievalMethod,
} from "@/features/knowledge/api"
import { cn, uuid } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Message, type ChatMessage } from "@/components/common/message"

interface RagMessage extends ChatMessage {
  /** 未开启 rerank 时使用的召回片段 */
  chunks?: KnowledgeChunk[]
  /** 开启 rerank 时的初筛片段 */
  initialChunks?: KnowledgeChunk[]
  /** 开启 rerank 时重排后保留的片段 */
  rerankedChunks?: KnowledgeChunk[]
  /** 流式进行中的阶段提示 */
  stageMessage?: string
}

interface KnowledgeChatPanelProps {
  /** 全部知识库文件（内部会筛选出已编码的用于问答范围） */
  files: KnowledgeFile[]
}

const RETRIEVAL_METHOD_OPTIONS: Array<{
  value: RetrievalMethod
  label: string
}> = [
    { value: "vector", label: "向量检索" },
    { value: "hybrid", label: "混合检索" },
  ]

/** 检索参数（权重以百分比保存，提交时换算为小数） */
interface RetrievalConfig {
  retrievalMethod: RetrievalMethod
  semanticPercent: number
  topK: number
  enableRerank: boolean
  rerankTopK: number
  rerankTopN: number
  temperature: number
}

const DEFAULT_CONFIG: RetrievalConfig = {
  retrievalMethod: "hybrid",
  semanticPercent: Math.round(RAG_DEFAULTS.semantic_weight * 100),
  topK: RAG_DEFAULTS.top_k,
  enableRerank: RAG_DEFAULTS.enable_rerank,
  rerankTopK: RAG_DEFAULTS.rerank_top_k,
  rerankTopN: RAG_DEFAULTS.rerank_top_n,
  temperature: RAG_DEFAULTS.temperature,
}

/** 权重数值：默认展示百分比，点击后可手动输入 */
function WeightValueEditor({
  value,
  disabled,
  onCommit,
  label,
}: {
  value: number
  disabled?: boolean
  onCommit: (value: number) => void
  label: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")

  const commitDraft = () => {
    const parsed = Number(draft)
    if (!Number.isNaN(parsed)) {
      onCommit(Math.round(Math.min(100, Math.max(0, parsed))))
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        type="number"
        autoFocus
        value={draft}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commitDraft()
          } else if (e.key === "Escape") {
            e.preventDefault()
            setEditing(false)
          }
        }}
        className="h-6 w-14 px-2 py-0 text-xs tabular-nums"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (disabled) return
        setDraft(String(value))
        setEditing(true)
      }}
      title="点击手动输入"
      disabled={disabled}
      className="text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 text-xs tabular-nums transition-colors hover:bg-muted/50 disabled:opacity-50 w-12 text-right"
    >
      {value}%
    </button>
  )
}

/** 带范围钳制的数值输入 */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  hint,
  onCommit,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  hint?: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = React.useState(String(value))

  React.useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = () => {
    const parsed = Number(draft)
    if (Number.isNaN(parsed)) {
      setDraft(String(value))
      return
    }
    onCommit(Math.min(max, Math.max(min, parsed)))
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
        {hint && (
          <span className="text-muted-foreground font-normal">（{hint}）</span>
        )}
      </Label>
      <Input
        id={id}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            commit()
          }
        }}
        className="h-8 text-xs tabular-nums"
      />
    </div>
  )
}

/** 可折叠的检索参数设置面板，默认折叠 */
function RetrievalSettings({
  config,
  onChange,
  disabled,
}: {
  config: RetrievalConfig
  onChange: (patch: Partial<RetrievalConfig>) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const keywordPercent = 100 - config.semanticPercent

  const summary = [
    config.retrievalMethod === "hybrid"
      ? `混合检索 ${config.semanticPercent}/${keywordPercent}`
      : "向量检索",
    config.enableRerank
      ? `rerank ${config.rerankTopK}→${config.rerankTopN}`
      : `top_k ${config.topK}`,
  ].join(" · ")

  return (
    <div className="bg-card rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
      >
        <Settings2 size={14} className="text-muted-foreground shrink-0" />
        <span className="shrink-0 text-xs font-medium">检索参数</span>
        <span className="text-muted-foreground truncate text-xs">
          {summary}
        </span>
        <ChevronDown
          size={14}
          className={cn(
            "text-muted-foreground ml-auto shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-2.5 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">检索方式</span>
              <div
                role="group"
                aria-label="检索方式"
                className="bg-muted inline-flex rounded-md p-0.5"
              >
                {RETRIEVAL_METHOD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={config.retrievalMethod === option.value}
                    disabled={disabled}
                    onClick={() => onChange({ retrievalMethod: option.value })}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      config.retrievalMethod === option.value
                        ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                        : "text-muted-foreground hover:text-foreground",
                      disabled && "pointer-events-none opacity-50"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enable-rerank"
                checked={config.enableRerank}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  onChange({ enableRerank: checked })
                }
              />
              <Label htmlFor="enable-rerank" className="text-xs font-medium">
                启用 rerank 重排
              </Label>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => onChange(DEFAULT_CONFIG)}
              className="ml-auto h-7 text-xs"
            >
              恢复默认
            </Button>
          </div>

          {config.retrievalMethod === "hybrid" && (
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex flex-1 items-center gap-2 text-xs">
                <span className="text-muted-foreground w-10 shrink-0">
                  语义
                </span>
                <Slider
                  value={[config.semanticPercent]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  aria-label="语义权重"
                  className="min-w-20 flex-1"
                  onValueChange={(values) =>
                    onChange({ semanticPercent: values[0] })
                  }
                />
                <WeightValueEditor
                  value={config.semanticPercent}
                  disabled={disabled}
                  label="语义权重"
                  onCommit={(value) => onChange({ semanticPercent: value })}
                />
              </div>
              <div className="flex flex-1 items-center gap-2 text-xs">
                <span className="text-muted-foreground w-10 shrink-0">
                  关键词
                </span>
                <Slider
                  value={[keywordPercent]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={disabled}
                  aria-label="关键词权重"
                  className="min-w-20 flex-1"
                  onValueChange={(values) =>
                    onChange({ semanticPercent: 100 - values[0] })
                  }
                />
                <WeightValueEditor
                  value={keywordPercent}
                  disabled={disabled}
                  label="关键词权重"
                  onCommit={(value) =>
                    onChange({ semanticPercent: 100 - value })
                  }
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <NumberField
              id="rag-top-k"
              label="top_k"
              hint="召回"
              value={config.topK}
              min={1}
              max={200}
              disabled={disabled || config.enableRerank}
              onCommit={(value) => onChange({ topK: value })}
            />
            <NumberField
              id="rag-rerank-top-k"
              label="rerank_top_k"
              hint="初筛"
              value={config.rerankTopK}
              min={1}
              max={200}
              disabled={disabled || !config.enableRerank}
              onCommit={(value) =>
                onChange({
                  rerankTopK: value,
                  rerankTopN: Math.min(config.rerankTopN, value),
                })
              }
            />
            <NumberField
              id="rag-rerank-top-n"
              label="rerank_top_n"
              hint="保留"
              value={config.rerankTopN}
              min={1}
              max={config.rerankTopK}
              disabled={disabled || !config.enableRerank}
              onCommit={(value) => onChange({ rerankTopN: value })}
            />
            <NumberField
              id="rag-temperature"
              label="temperature"
              value={config.temperature}
              min={0}
              max={2}
              step={0.1}
              disabled={disabled}
              onCommit={(value) => onChange({ temperature: value })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** 单个召回片段展示 */
function ChunkCard({ chunk, rank }: { chunk: KnowledgeChunk; rank: number }) {
  const [expanded, setExpanded] = React.useState(false)
  const filename = chunk.meta_data?.filename ?? chunk.file_id
  const header =
    (chunk.meta_data?.["Header 2"] as string | undefined) ??
    (chunk.meta_data?.["Header 1"] as string | undefined)
  const semanticScore =
    typeof chunk.semantic_score === "number"
      ? chunk.semantic_score
      : chunk.score
  const keywordScore =
    typeof chunk.keyword_score === "number" ? chunk.keyword_score : null
  const rerankScore =
    typeof chunk.rerank_score === "number" ? chunk.rerank_score : null
  const isHybrid =
    (chunk.retrieval_method ?? (keywordScore !== null ? "hybrid" : "vector")) ===
    "hybrid"

  return (
    <div className="bg-background/60 rounded-md border text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        {expanded ? (
          <ChevronDown size={12} className="shrink-0" />
        ) : (
          <ChevronRight size={12} className="shrink-0" />
        )}
        <span className="text-muted-foreground shrink-0 tabular-nums">
          #{rank}
        </span>
        <FileText size={12} className="text-muted-foreground shrink-0" />
        <span className="truncate font-medium" title={filename}>
          {filename}
        </span>
        {header && (
          <span className="text-muted-foreground truncate">· {header}</span>
        )}
        <Badge variant="secondary" className="ml-auto shrink-0">
          {chunk.score.toFixed(3)}
        </Badge>
      </button>
      {expanded && (
        <div className="space-y-2 border-t px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">综合 {chunk.score.toFixed(3)}</Badge>
            {rerankScore !== null && (
              <Badge variant="outline">重排 {rerankScore.toFixed(3)}</Badge>
            )}
            <Badge variant="outline">语义 {semanticScore.toFixed(3)}</Badge>
            {isHybrid && keywordScore !== null && (
              <Badge variant="outline">关键词 {keywordScore.toFixed(3)}</Badge>
            )}
            <span className="text-muted-foreground">
              切片 {chunk.chunk_index}
            </span>
          </div>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {chunk.content}
          </p>
        </div>
      )}
    </div>
  )
}

/** 召回片段列表 */
function ChunkList({ chunks }: { chunks: KnowledgeChunk[] }) {
  if (chunks.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {chunks.map((chunk, index) => (
        <ChunkCard
          key={`${chunk.chunk_id}-${index}`}
          chunk={chunk}
          rank={index + 1}
        />
      ))}
    </div>
  )
}

type ChunkView = "initial" | "reranked"

/** 片段展示区：开启 rerank 时可在初筛与重排结果间切换比对 */
function ChunkSection({ message }: { message: RagMessage }) {
  const [view, setView] = React.useState<ChunkView | null>(null)

  const initialChunks = message.initialChunks ?? []
  const rerankedChunks = message.rerankedChunks ?? []
  const hasCompare = initialChunks.length > 0 || rerankedChunks.length > 0

  if (!hasCompare) {
    const chunks = message.chunks ?? []
    if (chunks.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-xs font-medium">
          引用片段（{chunks.length}）
        </span>
        <ChunkList chunks={chunks} />
      </div>
    )
  }

  // 未手动切换时默认展示最终使用的重排片段
  const activeView: ChunkView =
    view ?? (rerankedChunks.length > 0 ? "reranked" : "initial")
  const chunks = activeView === "reranked" ? rerankedChunks : initialChunks

  const options: Array<{ value: ChunkView; label: string; count: number }> = [
    { value: "initial", label: "初筛", count: initialChunks.length },
    { value: "reranked", label: "重排", count: rerankedChunks.length },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          引用片段
        </span>
        <div
          role="group"
          aria-label="片段视图"
          className="bg-muted inline-flex rounded-md p-0.5"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={activeView === option.value}
              disabled={option.count === 0}
              onClick={() => setView(option.value)}
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                activeView === option.value
                  ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                  : "text-muted-foreground hover:text-foreground",
                option.count === 0 && "pointer-events-none opacity-50"
              )}
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>
      </div>
      <ChunkList chunks={chunks} />
    </div>
  )
}

export function KnowledgeChatPanel({ files }: KnowledgeChatPanelProps) {
  const embeddedFiles = React.useMemo(
    () => files.filter((f) => f.is_embedded),
    [files]
  )

  // 问答范围：按标签批量选择，为空表示检索全部已编码知识库
  const [scopeTagIds, setScopeTagIds] = React.useState<string[]>([])

  // 已编码文件上出现过的标签（不含未编码文件的标签）
  const availableTags = React.useMemo(() => {
    const map = new Map<string, KnowledgeTag>()
    embeddedFiles.forEach((file) => {
      file.tags?.forEach((tag) => map.set(tag.id, tag))
    })
    return Array.from(map.values())
  }, [embeddedFiles])

  // 检索参数
  const [config, setConfig] = React.useState<RetrievalConfig>(DEFAULT_CONFIG)
  const patchConfig = React.useCallback((patch: Partial<RetrievalConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  // 问答状态
  const [messages, setMessages] = React.useState<RagMessage[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [streamingId, setStreamingId] = React.useState<string | null>(null)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const chatComposingRef = React.useRef(false)

  // 移除已不存在（如被删除/取消编码）的范围标签
  React.useEffect(() => {
    setScopeTagIds((prev) =>
      prev.filter((id) => availableTags.some((tag) => tag.id === id))
    )
  }, [availableTags])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const noEmbedded = embeddedFiles.length === 0

  // 命中所选标签的已编码文件；未选标签时为 null（表示全部）
  const effectiveFileIds = React.useMemo(() => {
    if (scopeTagIds.length === 0) return null
    return embeddedFiles
      .filter((file) => file.tags?.some((tag) => scopeTagIds.includes(tag.id)))
      .map((file) => file.file_id)
  }, [embeddedFiles, scopeTagIds])

  // 选了标签却没有命中任何文件时，不能退化成检索全部
  const noScopeMatch = effectiveFileIds !== null && effectiveFileIds.length === 0
  const disabled = noEmbedded || noScopeMatch

  const scopeLabel =
    scopeTagIds.length === 0
      ? "全部知识库（含公共）"
      : `已选 ${scopeTagIds.length} 个标签 · ${effectiveFileIds?.length ?? 0} 个文件`

  const toggleScope = (tagId: string, checked: boolean) => {
    setScopeTagIds((prev) =>
      checked ? [...prev, tagId] : prev.filter((id) => id !== tagId)
    )
  }

  const handleSend = async () => {
    const query = input.trim()
    if (!query || sending) return

    const userMessage: RagMessage = {
      id: uuid(),
      role: "user",
      content: query,
    }
    const assistantId = uuid()
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        stageMessage: "正在检索知识库...",
      },
    ])
    setInput("")

    const patchAssistant = (updater: (message: RagMessage) => RagMessage) => {
      setMessages((prev) =>
        prev.map((item) => (item.id === assistantId ? updater(item) : item))
      )
    }

    try {
      setSending(true)
      setStreamingId(assistantId)
      await chatKnowledgeStream(
        {
          query,
          file_ids: effectiveFileIds,
          top_k: config.topK,
          retrieval_method: config.retrievalMethod,
          semantic_weight: config.semanticPercent / 100,
          keyword_weight: (100 - config.semanticPercent) / 100,
          enable_rerank: config.enableRerank,
          rerank_top_k: config.rerankTopK,
          rerank_top_n: config.rerankTopN,
          temperature: config.temperature,
        },
        {
          onProgress: (_stage, message) =>
            patchAssistant((item) => ({ ...item, stageMessage: message })),
          onChunks: (chunks) => patchAssistant((item) => ({ ...item, chunks })),
          onInitialChunks: (chunks) =>
            patchAssistant((item) => ({ ...item, initialChunks: chunks })),
          onRerankedChunks: (chunks) =>
            patchAssistant((item) => ({ ...item, rerankedChunks: chunks })),
          onAnswer: (delta) =>
            patchAssistant((item) => ({
              ...item,
              content: item.content + delta,
              stageMessage: undefined,
            })),
          onDone: () =>
            patchAssistant((item) => ({ ...item, stageMessage: undefined })),
        }
      )
    } catch (error) {
      console.error(error)
      toast.error("回答生成失败，请重试")
      patchAssistant((item) => ({
        ...item,
        content: item.content || "抱歉，回答生成失败，请稍后重试。",
        stageMessage: undefined,
      }))
    } finally {
      setSending(false)
      setStreamingId(null)
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文输入法候选期间的 Enter 不触发发送
    // （部分浏览器在 IME 中 e.key 为 "Process" 或 keyCode 为 229）
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !chatComposingRef.current &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      handleSend()
    }
  }

  const scopeSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={noEmbedded}>
          <Filter size={16} />
          {scopeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>按标签选择范围（不选=个人+公共）</span>
          <button
            type="button"
            disabled={scopeTagIds.length === 0}
            onClick={() => setScopeTagIds([])}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs font-normal disabled:pointer-events-none disabled:opacity-50"
          >
            清空
          </button>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableTags.length === 0 ? (
          <div className="text-muted-foreground px-2 py-1.5 text-xs">
            已编码文件暂无标签，请先在左侧为文件添加标签
          </div>
        ) : (
          availableTags.map((tag) => (
            <DropdownMenuCheckboxItem
              key={tag.id}
              checked={scopeTagIds.includes(tag.id)}
              onCheckedChange={(checked) => toggleScope(tag.id, !!checked)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate" title={tag.name}>
                {tag.name}
              </span>
            </DropdownMenuCheckboxItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">问答</span>
        {scopeSelector}
      </div>

      <RetrievalSettings
        config={config}
        onChange={patchConfig}
        disabled={noEmbedded}
      />

      {noEmbedded && (
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
          暂无已编码的文件，请先在左侧选择文件并点击「编码选中」完成编码后再提问。
        </div>
      )}

      {!noEmbedded && noScopeMatch && (
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
          所选标签没有匹配到任何已编码文件，请调整范围。
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-sm">
            <span>基于你的知识库开始提问吧</span>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="space-y-1.5">
              {(message.role === "user" || message.content) && (
                <Message
                  message={message}
                  isStreaming={streamingId === message.id}
                />
              )}
              {message.stageMessage && (
                <div className="text-muted-foreground pl-11 text-sm">
                  {message.stageMessage}
                </div>
              )}
              {message.role === "assistant" && (
                <div className="pl-11">
                  <ChunkSection message={message} />
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onCompositionStart={() => (chatComposingRef.current = true)}
          onCompositionEnd={() => (chatComposingRef.current = false)}
          placeholder={
            noEmbedded
              ? "请先完成文件编码"
              : noScopeMatch
                ? "当前标签范围无可用文件"
                : "输入你的问题，Enter 发送"
          }
          disabled={disabled || sending}
          className="max-h-40 min-h-11 flex-1 resize-none"
        />
        <Button
          onClick={handleSend}
          disabled={disabled || sending || !input.trim()}
          className="shrink-0"
        >
          <Send size={16} />
          发送
        </Button>
      </div>
    </div>
  )
}
