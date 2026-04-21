"use client"

import { useState } from "react"
import { Bot, User, ChevronDown, ChevronRight, BrainCircuit } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  modelName?: string // 模型名称，仅 assistant 消息有效
  reasoning?: string // 推理内容，仅 assistant 消息有效
}

interface MessageProps {
  message: ChatMessage
  isStreaming?: boolean // 是否正在流式生成（通常用于最后一条 assistant 消息）
}

export function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === "user"
  const [reasoningExpanded, setReasoningExpanded] = useState(false)

  // 正在推理中：有 reasoning 但还没有 content
  const isReasoning = isStreaming && !!message.reasoning && !message.content

  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* 头像 & 模型名称 */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-full border",
            isUser
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border"
          )}
        >
          {isUser ? <User size={15} /> : <Bot size={15} />}
        </div>
        {!isUser && message.modelName && (
          <span className="text-[10px] leading-tight text-muted-foreground text-center max-w-18 break-all">
            {message.modelName}
          </span>
        )}
      </div>

      {/* 消息气泡 */}
      <div className={cn("max-w-[75%] flex flex-col gap-1.5 text-sm")}>
        {/* 推理内容块 */}
        {!isUser && message.reasoning && (
          <div className="rounded-lg border border-border/60 bg-muted/40 overflow-hidden">
            <button
              onClick={() => setReasoningExpanded((v) => !v)}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <BrainCircuit size={12} />
              <span className="flex-1 text-left">
                {isReasoning ? "思考中..." : "已完成思考"}
              </span>
              {isReasoning ? (
                <span className="flex gap-0.5 items-center">
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              ) : reasoningExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )}
            </button>
            {(isReasoning || reasoningExpanded) && (
              <p className="px-3 pb-2 text-xs text-muted-foreground whitespace-pre-wrap wrap-break-word border-t border-border/40">
                {message.reasoning}
              </p>
            )}
          </div>
        )}

        {/* 主内容气泡 */}
        <div
          className={cn(
            "rounded-lg px-4 py-2.5",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {message.content ? (
            <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
          ) : isStreaming && !isReasoning ? (
            // 等待首个 content chunk
            <span className="flex gap-1 items-center h-4">
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
            </span>
          ) : isReasoning ? null : (
            <p className="text-muted-foreground italic">（无内容）</p>
          )}
        </div>
      </div>
    </div>
  )
}
