"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  History,
  LoaderCircle,
  MessagesSquare,
  Plus,
  Send,
  ThumbsDown,
  ThumbsUp,
  Bookmark,
} from "lucide-react"

import {
  chatStreamV2,
  createRequirement,
  getDatabases,
  getRequirementConflict,
  getSimilarQuestions,
  getTagsV2,
  updateQuestionFeedback,
  type KnowledgeChunkV2,
  type KnowledgeDatabase,
  type KnowledgeTagV2,
  type QuestionFeedback,
  type QuestionLog,
  type SimilarQuestionLog,
} from "@/features/knowledge-v2/api"
import { cn, uuid } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Message } from "@/components/common/message"
import { ChunkList } from "./chunk-list"
import { HistorySheet } from "./history-sheet"
import { SimilarList } from "./similar-list"
import {
  DEFAULT_RETRIEVAL_PARAMS,
  RetrievalPopover,
  ScopePopover,
  type RetrievalParams,
} from "./qa-settings"

type TurnView = "answer" | "chunks" | "similar"

/** 一次完整的知识库问答 */
interface QaTurn {
  id: string
  question: string
  answer: string
  chunks: KnowledgeChunkV2[]
  view: TurnView
  questionLogId?: string
  feedback?: QuestionFeedback | null
  /** 请求进行中 */
  pending?: boolean
  similar: SimilarQuestionLog[]
  similarLoading?: boolean
  /** 相似案例已拉取过（包括结果为空） */
  similarLoaded?: boolean
}

/** 队列上限：只保留最近的问答轮次 */
const MAX_TURNS = 20

/** 流式回答的最小渲染间隔，避免逐 token 重排 markdown */
const STREAM_FLUSH_INTERVAL = 80

/** 追加到队尾，超出上限时从队首出队 */
function enqueue(turns: QaTurn[], appended: QaTurn[]): QaTurn[] {
  return [...turns, ...appended].slice(-MAX_TURNS)
}

const FEEDBACK_OPTIONS: Array<{
  value: QuestionFeedback
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}> = [
  { value: "helpful", label: "有帮助", icon: ThumbsUp },
  { value: "not_helpful", label: "无帮助", icon: ThumbsDown },
  { value: "collect", label: "设为典型案例", icon: Bookmark },
]

export function KnowledgeQaView() {
  const [databases, setDatabases] = React.useState<KnowledgeDatabase[]>([])
  const [databaseName, setDatabaseName] = React.useState("")
  const [tags, setTags] = React.useState<KnowledgeTagV2[]>([])
  const [selectedTagNames, setSelectedTagNames] = React.useState<string[]>([])
  const [params, setParams] = React.useState<RetrievalParams>(
    DEFAULT_RETRIEVAL_PARAMS
  )
  const [metaLoading, setMetaLoading] = React.useState(true)

  const [turns, setTurns] = React.useState<QaTurn[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)

  const [historyOpen, setHistoryOpen] = React.useState(false)
  const [requirementTurn, setRequirementTurn] = React.useState<QaTurn | null>(
    null
  )
  const [requirementText, setRequirementText] = React.useState("")
  const [requirementSubmitting, setRequirementSubmitting] =
    React.useState(false)

  const bottomRef = React.useRef<HTMLDivElement>(null)
  const composingRef = React.useRef(false)

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [dbRes, tagRes] = await Promise.all([
          getDatabases(),
          getTagsV2(),
        ])
        if (cancelled) return
        setDatabases(dbRes?.data ?? [])
        setTags(tagRes?.data ?? [])
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error("加载知识库列表失败")
      } finally {
        if (!cancelled) setMetaLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [turns])

  const hasConversation = turns.length > 0
  const canSend = !!databaseName && !!input.trim() && !sending

  const loadSimilar = React.useCallback(
    async (turnId: string, query: string) => {
      if (!query) return
      setTurns((prev) =>
        prev.map((t) => (t.id === turnId ? { ...t, similarLoading: true } : t))
      )
      try {
        const res = await getSimilarQuestions({ query, top_k: 10 })
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? {
                  ...t,
                  similar: res?.data ?? [],
                  similarLoaded: true,
                  similarLoading: false,
                }
              : t
          )
        )
      } catch (error) {
        console.error(error)
        toast.error("相似案例检索失败")
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, similar: [], similarLoaded: true, similarLoading: false }
              : t
          )
        )
      }
    },
    []
  )

  const handleSend = async () => {
    const query = input.trim()
    if (!query || sending) return
    if (!databaseName) {
      toast.error("请先选择知识库")
      return
    }

    const turnId = uuid()
    setTurns((prev) =>
      enqueue(prev, [
        {
          id: turnId,
          question: query,
          answer: "",
          chunks: [],
          view: "answer",
          pending: true,
          similar: [],
        },
      ])
    )
    setInput("")

    let answer = ""

    try {
      setSending(true)

      let lastFlushAt = 0
      const flush = () => {
        lastFlushAt = Date.now()
        const snapshot = answer
        setTurns((prev) =>
          prev.map((turn) =>
            turn.id === turnId ? { ...turn, answer: snapshot } : turn
          )
        )
      }

      await chatStreamV2(
        {
          query,
          database_name: databaseName,
          tag_names: selectedTagNames,
          top_k: params.topK,
          retrieval_method: params.retrievalMethod,
          semantic_weight: params.semanticPercent / 100,
          keyword_weight: (100 - params.semanticPercent) / 100,
          temperature: params.temperature,
        },
        {
          onChunks: (chunks) => {
            setTurns((prev) =>
              prev.map((turn) =>
                turn.id === turnId ? { ...turn, chunks } : turn
              )
            )
          },
          onAnswer: (delta) => {
            answer += delta
            if (Date.now() - lastFlushAt >= STREAM_FLUSH_INTERVAL) flush()
          },
          onDone: (questionLogId) => {
            setTurns((prev) =>
              prev.map((turn) =>
                turn.id === turnId
                  ? {
                      ...turn,
                      pending: false,
                      answer,
                      questionLogId: questionLogId || undefined,
                    }
                  : turn
              )
            )
          },
        }
      )

      // 后端未发送 done 事件时兜底结束等待态
      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === turnId ? { ...turn, pending: false, answer } : turn
        )
      )
    } catch (error) {
      console.error(error)
      toast.error("问答失败，请稍后重试")
      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                pending: false,
                answer: answer
                  ? `${answer}\n\n（回答中断，请稍后重试）`
                  : "抱歉，问答失败，请稍后重试。",
              }
            : turn
        )
      )
    } finally {
      setSending(false)
    }
  }

  const handleFeedback = async (turn: QaTurn, feedback: QuestionFeedback) => {
    if (!turn.questionLogId) return
    try {
      const res = await updateQuestionFeedback(turn.questionLogId, feedback)
      const updated = res?.data?.user_feedback ?? feedback
      setTurns((prev) =>
        prev.map((t) => (t.id === turn.id ? { ...t, feedback: updated } : t))
      )
      if (updated === "not_helpful") {
        setRequirementText("")
        setRequirementTurn({ ...turn, feedback: updated })
      }
    } catch (error) {
      console.error(error)
      toast.error("反馈提交失败")
    }
  }

  const handleCreateRequirement = async () => {
    if (!requirementTurn?.questionLogId) return
    try {
      setRequirementSubmitting(true)
      await createRequirement({
        related_log_id: requirementTurn.questionLogId,
        requirement: requirementText.trim() || undefined,
      })
      toast.success("已提交知识库缺口")
      setRequirementTurn(null)
    } catch (error) {
      console.error(error)
      if (getRequirementConflict(error)) {
        toast.info("该问答已登记过知识库缺口")
        setRequirementTurn(null)
        return
      }
      toast.error("提交知识库缺口失败")
    } finally {
      setRequirementSubmitting(false)
    }
  }

  const handleLoadHistory = (log: QuestionLog) => {
    setTurns((prev) =>
      enqueue(prev, [
        {
          id: uuid(),
          question: log.question,
          answer: log.answer,
          chunks: log.chunks ?? [],
          view: "answer",
          questionLogId: log.id,
          feedback: log.user_feedback,
          similar: [],
        },
      ])
    )
  }

  const handleNewConversation = () => {
    setTurns([])
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 中文输入法候选期间的 Enter 不触发发送
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing &&
      !composingRef.current &&
      e.keyCode !== 229
    ) {
      e.preventDefault()
      handleSend()
    }
  }

  const composer = (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          placeholder={
            databaseName
              ? "输入你的问题，Enter 发送，Shift + Enter 换行"
              : "请先选择知识库"
          }
          disabled={sending || !databaseName}
          className="max-h-40 min-h-11 flex-1 resize-none"
        />
        <Button onClick={handleSend} disabled={!canSend} className="shrink-0">
          {sending ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
          发送
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ScopePopover
          databases={databases}
          databaseName={databaseName}
          onDatabaseNameChange={setDatabaseName}
          tags={tags}
          selectedTagNames={selectedTagNames}
          onSelectedTagNamesChange={setSelectedTagNames}
          loading={metaLoading}
        />
        <RetrievalPopover params={params} onChange={setParams} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setHistoryOpen(true)}
        >
          <History size={16} />
          历史问答
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasConversation}
          onClick={handleNewConversation}
        >
          <Plus size={16} />
          新对话
        </Button>
      </div>
    </div>
  )

  const setTurnView = (turn: QaTurn, view: TurnView) => {
    setTurns((prev) =>
      prev.map((t) => (t.id === turn.id ? { ...t, view } : t))
    )
    if (view === "similar" && !turn.similarLoaded && !turn.similarLoading) {
      loadSimilar(turn.id, turn.question)
    }
  }

  const renderTurn = (turn: QaTurn, index: number) => {
    const view = turn.view
    const viewOptions: Array<{ value: TurnView; label: string }> = [
      { value: "answer", label: "模型消息" },
      { value: "chunks", label: `召回片段 (${turn.chunks.length})` },
      {
        value: "similar",
        label: turn.similarLoaded
          ? `相似对话 (${turn.similar.length})`
          : "相似对话",
      },
    ]

    return (
      <div key={turn.id} className="space-y-1.5">
        {index > 0 && (
          <div className="flex items-center gap-3 py-2">
            <Separator className="flex-1" />
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              第 {index + 1} 轮
            </span>
            <Separator className="flex-1" />
          </div>
        )}
        <Message
          message={{
            id: `${turn.id}-q`,
            role: "user",
            content: turn.question,
          }}
        />

        {view === "answer" ? (
          <Message
            message={{
              id: `${turn.id}-a`,
              role: "assistant",
              content: turn.answer,
            }}
            isStreaming={turn.pending}
          />
        ) : (
          <div className="max-w-[75%] pl-11">
            {view === "chunks" ? (
              <ChunkList chunks={turn.chunks} />
            ) : (
              <SimilarList
                items={turn.similar}
                loading={!!turn.similarLoading}
                query={turn.question}
                onRefresh={() => loadSimilar(turn.id, turn.question)}
              />
            )}
          </div>
        )}

        {!turn.pending && (
          <div className="flex flex-wrap items-center gap-2 pl-11">
            <div
              role="group"
              aria-label="回答内容切换"
              className="bg-muted inline-flex rounded-md p-0.5"
            >
              {viewOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={view === option.value}
                  onClick={() => setTurnView(turn, option.value)}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    view === option.value
                      ? "bg-background text-foreground shadow-sm dark:bg-input/30"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {turn.questionLogId && (
              <div className="flex items-center gap-1">
                {FEEDBACK_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const active = turn.feedback === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      title={option.label}
                      aria-label={option.label}
                      aria-pressed={active}
                      onClick={() => handleFeedback(turn, option.value)}
                      className={cn(
                        "rounded p-1.5 transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon size={14} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {!hasConversation ? (
        /* 空态：对话框居中 */
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
              <MessagesSquare size={24} />
            </div>
            <h2 className="text-2xl font-semibold">知识库智能问答</h2>
            <p className="text-muted-foreground text-sm">
              选择知识库后提问，回答仅基于检索到的知识片段生成。
            </p>
          </div>
          {composer}
        </div>
      ) : (
        <>
          <div className="mx-auto mb-2 flex w-full max-w-3xl items-center justify-end gap-2">
            {databaseName && (
              <Badge variant="outline">
                {databases.find((db) => db.database_name === databaseName)
                  ?.database_desc || databaseName}
              </Badge>
            )}
            <span
              className="text-muted-foreground text-xs tabular-nums"
              title={`最多保留最近 ${MAX_TURNS} 轮问答`}
            >
              {turns.length} / {MAX_TURNS} 轮
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mx-auto w-full max-w-3xl space-y-4">
              {turns.map(renderTurn)}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="pt-3">{composer}</div>
        </>
      )}

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        onSelect={handleLoadHistory}
      />

      {/* 反馈为「无帮助」后可直接登记知识库缺口 */}
      <Dialog
        open={!!requirementTurn}
        onOpenChange={(open) => !open && setRequirementTurn(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>登记知识库缺口</DialogTitle>
            <DialogDescription>
              该问答已标记为无帮助，可以描述缺失的知识，供其他用户补充材料。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={requirementText}
            onChange={(e) => setRequirementText(e.target.value)}
            placeholder="例如：补充窑炉高温报警后的停机与复位步骤（可留空）"
            className="min-h-24 resize-none"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">暂不登记</Button>
            </DialogClose>
            <Button
              onClick={handleCreateRequirement}
              disabled={requirementSubmitting}
            >
              {requirementSubmitting && (
                <LoaderCircle size={16} className="animate-spin" />
              )}
              提交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
