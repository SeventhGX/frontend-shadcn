"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Search,
  Send,
  SlidersHorizontal,
} from "lucide-react"

import {
  chatKnowledge,
  retrieveKnowledge,
  type KnowledgeChunk,
  type KnowledgeFile,
  type RetrievalMethod,
} from "@/features/knowledge/api"
import { cn, uuid } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  /** assistant 消息使用的召回片段 */
  chunks?: KnowledgeChunk[]
}

interface KnowledgeChatPanelProps {
  /** 全部知识库文件（内部会筛选出已编码的用于问答范围） */
  files: KnowledgeFile[]
}

const TOP_K = 10

const RETRIEVAL_METHOD_OPTIONS: Array<{
  value: RetrievalMethod
  label: string
}> = [
  { value: "vector", label: "向量检索" },
  { value: "hybrid", label: "混合检索" },
]

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

/** 检索参数设置：方式切换 + 混合检索时的权重联动滑块 */
function RetrievalSettings({
  retrievalMethod,
  onRetrievalMethodChange,
  semanticPercent,
  onSemanticPercentChange,
  disabled,
}: {
  retrievalMethod: RetrievalMethod
  onRetrievalMethodChange: (method: RetrievalMethod) => void
  semanticPercent: number
  onSemanticPercentChange: (percent: number) => void
  disabled?: boolean
}) {
  const keywordPercent = 100 - semanticPercent

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border bg-card px-2.5 py-2">
      <div className="flex items-center gap-2">
        <SlidersHorizontal
          size={14}
          className="text-muted-foreground shrink-0"
        />
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
              aria-pressed={retrievalMethod === option.value}
              disabled={disabled}
              onClick={() => onRetrievalMethodChange(option.value)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                retrievalMethod === option.value
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

      {retrievalMethod === "hybrid" && (
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-10 shrink-0">语义</span>
            <Slider
              value={[semanticPercent]}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              aria-label="语义权重"
              className="min-w-20 flex-1"
              onValueChange={(values) => onSemanticPercentChange(values[0])}
            />
            <WeightValueEditor
              value={semanticPercent}
              disabled={disabled}
              label="语义权重"
              onCommit={onSemanticPercentChange}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground w-10 shrink-0">关键词</span>
            <Slider
              value={[keywordPercent]}
              min={0}
              max={100}
              step={1}
              disabled={disabled}
              aria-label="关键词权重"
              className="min-w-20 flex-1"
              onValueChange={(values) =>
                onSemanticPercentChange(100 - values[0])
              }
            />
            <WeightValueEditor
              value={keywordPercent}
              disabled={disabled}
              label="关键词权重"
              onCommit={(value) => onSemanticPercentChange(100 - value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** 单个召回片段展示 */
function ChunkCard({ chunk }: { chunk: KnowledgeChunk }) {
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
  const isHybrid =
    (chunk.retrieval_method ?? (keywordScore !== null ? "hybrid" : "vector")) ===
    "hybrid"

  return (
    <div className="rounded-md border bg-background/60 text-xs">
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
            {isHybrid && keywordScore !== null && (
              <>
                <Badge variant="outline">语义 {semanticScore.toFixed(3)}</Badge>
                <Badge variant="outline">
                  关键词 {keywordScore.toFixed(3)}
                </Badge>
              </>
            )}
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
function ChunkList({
  chunks,
  title,
}: {
  chunks: KnowledgeChunk[]
  title?: string
}) {
  if (chunks.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {title && (
        <span className="text-muted-foreground text-xs font-medium">
          {title}（{chunks.length}）
        </span>
      )}
      {chunks.map((chunk) => (
        <ChunkCard key={chunk.chunk_id} chunk={chunk} />
      ))}
    </div>
  )
}

export function KnowledgeChatPanel({ files }: KnowledgeChatPanelProps) {
  const embeddedFiles = React.useMemo(
    () => files.filter((f) => f.is_embedded),
    [files]
  )

  // 问答范围：为空表示检索全部已编码知识库
  const [scopeIds, setScopeIds] = React.useState<string[]>([])

  // 检索参数
  const [retrievalMethod, setRetrievalMethod] =
    React.useState<RetrievalMethod>("vector")
  const [semanticPercent, setSemanticPercent] = React.useState(70)

  // 问答状态
  const [messages, setMessages] = React.useState<RagMessage[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)

  // 检索状态
  const [retrieveQuery, setRetrieveQuery] = React.useState("")
  const [retrieveResults, setRetrieveResults] = React.useState<KnowledgeChunk[]>(
    []
  )
  const [retrieving, setRetrieving] = React.useState(false)
  const [retrieved, setRetrieved] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const chatComposingRef = React.useRef(false)
  const retrieveComposingRef = React.useRef(false)

  // 移除已不存在（如被删除/取消编码）的范围文件
  React.useEffect(() => {
    setScopeIds((prev) =>
      prev.filter((id) => embeddedFiles.some((f) => f.file_id === id))
    )
  }, [embeddedFiles])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const noEmbedded = embeddedFiles.length === 0
  const effectiveFileIds = scopeIds.length > 0 ? scopeIds : null

  const scopeLabel =
    scopeIds.length === 0
      ? "全部知识库"
      : `已选 ${scopeIds.length} 个文件`

  const toggleScope = (fileId: string, checked: boolean) => {
    setScopeIds((prev) =>
      checked ? [...prev, fileId] : prev.filter((id) => id !== fileId)
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
    setMessages((prev) => [...prev, userMessage])
    setInput("")

    try {
      setSending(true)
      const res = await chatKnowledge({
        query,
        file_ids: effectiveFileIds,
        top_k: TOP_K,
        retrieval_method: retrievalMethod,
        ...(retrievalMethod === "hybrid"
          ? {
              semantic_weight: semanticPercent / 100,
              keyword_weight: (100 - semanticPercent) / 100,
            }
          : {}),
      })
      const data = res?.data
      const assistantMessage: RagMessage = {
        id: uuid(),
        role: "assistant",
        content: data?.answer ?? "",
        chunks: data?.chunks ?? [],
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error(error)
      toast.error("问答失败，请稍后重试")
      setMessages((prev) => [
        ...prev,
        {
          id: uuid(),
          role: "assistant",
          content: "抱歉，问答失败，请稍后重试。",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleRetrieve = async () => {
    const query = retrieveQuery.trim()
    if (!query || retrieving) return
    try {
      setRetrieving(true)
      const res = await retrieveKnowledge({
        query,
        file_ids: effectiveFileIds,
        top_k: TOP_K,
        retrieval_method: retrievalMethod,
        ...(retrievalMethod === "hybrid"
          ? {
              semantic_weight: semanticPercent / 100,
              keyword_weight: (100 - semanticPercent) / 100,
            }
          : {}),
      })
      setRetrieveResults(res?.data ?? [])
      setRetrieved(true)
    } catch (error) {
      console.error(error)
      toast.error("检索失败，请稍后重试")
    } finally {
      setRetrieving(false)
    }
  }

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    onEnter: () => void,
    isComposingRef: { current: boolean }
  ) => {
    // 中文输入法候选期间的 Enter 不触发发送
    // （部分浏览器在 IME 中 e.key 为 "Process" 或 keyCode 为 229）
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !isComposingRef.current &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      onEnter()
    }
  }

  // 范围选择器（问答/检索共用）
  const scopeSelector = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={noEmbedded}>
          <Filter size={16} />
          {scopeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto">
        <DropdownMenuLabel>问答范围（不选=全部）</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {embeddedFiles.map((file) => (
          <DropdownMenuCheckboxItem
            key={file.file_id}
            checked={scopeIds.includes(file.file_id)}
            onCheckedChange={(checked) =>
              toggleScope(file.file_id, !!checked)
            }
            onSelect={(e) => e.preventDefault()}
          >
            <span className="truncate" title={file.filename}>
              {file.filename}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <Tabs defaultValue="chat" className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="chat">问答</TabsTrigger>
          <TabsTrigger value="retrieve">检索</TabsTrigger>
        </TabsList>
        {scopeSelector}
      </div>

      <RetrievalSettings
        retrievalMethod={retrievalMethod}
        onRetrievalMethodChange={setRetrievalMethod}
        semanticPercent={semanticPercent}
        onSemanticPercentChange={setSemanticPercent}
        disabled={noEmbedded}
      />

      {noEmbedded && (
        <div className="text-muted-foreground rounded-md border border-dashed p-3 text-center text-sm">
          暂无已编码的文件，请先在左侧选择文件并点击「编码选中」完成编码后再提问。
        </div>
      )}

      {/* 问答 */}
      <TabsContent
        value="chat"
        className="mt-0 flex min-h-0 flex-1 flex-col gap-2"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 text-sm">
              <span>基于你的知识库开始提问吧</span>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="space-y-1.5">
                <Message message={message} />
                {message.role === "assistant" &&
                  message.chunks &&
                  message.chunks.length > 0 && (
                    <div className="pl-11">
                      <ChunkList
                        chunks={message.chunks}
                        title="引用片段"
                      />
                    </div>
                  )}
              </div>
            ))
          )}
          {sending && (
            <div className="text-muted-foreground pl-11 text-sm">
              正在思考...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              handleInputKeyDown(e, handleSend, chatComposingRef)
            }
            onCompositionStart={() => (chatComposingRef.current = true)}
            onCompositionEnd={() => (chatComposingRef.current = false)}
            placeholder={
              noEmbedded ? "请先完成文件编码" : "输入你的问题，Enter 发送"
            }
            disabled={noEmbedded || sending}
            className="max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={noEmbedded || sending || !input.trim()}
            className="shrink-0"
          >
            <Send size={16} />
            发送
          </Button>
        </div>
      </TabsContent>

      {/* 检索 */}
      <TabsContent
        value="retrieve"
        className="mt-0 flex min-h-0 flex-1 flex-col gap-2"
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={retrieveQuery}
            onChange={(e) => setRetrieveQuery(e.target.value)}
            onKeyDown={(e) =>
              handleInputKeyDown(e, handleRetrieve, retrieveComposingRef)
            }
            onCompositionStart={() => (retrieveComposingRef.current = true)}
            onCompositionEnd={() => (retrieveComposingRef.current = false)}
            placeholder={
              noEmbedded ? "请先完成文件编码" : "输入检索关键词，Enter 检索"
            }
            disabled={noEmbedded || retrieving}
            className="max-h-40 min-h-11 flex-1 resize-none"
          />
          <Button
            variant="outline"
            onClick={handleRetrieve}
            disabled={noEmbedded || retrieving || !retrieveQuery.trim()}
            className="shrink-0"
          >
            <Search size={16} />
            检索
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {retrieving ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              检索中...
            </div>
          ) : retrieveResults.length > 0 ? (
            <ChunkList chunks={retrieveResults} title="召回片段" />
          ) : retrieved ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              未检索到相关片段
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center text-sm">
              输入关键词预览召回效果
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
