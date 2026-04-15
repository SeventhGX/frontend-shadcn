"use client"

import { Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  modelName?: string // 模型名称，仅 assistant 消息有效
}

interface MessageProps {
  message: ChatMessage
  isStreaming?: boolean // 是否正在流式生成（通常用于最后一条 assistant 消息）
}

export function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === "user"

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
      <div
        className={cn(
          "max-w-[75%] rounded-lg px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.content ? (
          <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        ) : isStreaming ? (
          // 流式生成中的加载动画
          <span className="flex gap-1 items-center h-4">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
          </span>
        ) : (
          <p className="text-muted-foreground italic">（无内容）</p>
        )}
      </div>
    </div>
  )
}
