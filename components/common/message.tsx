"use client"

import { useState } from "react"
import { Bot, User, ChevronDown, ChevronRight, BrainCircuit } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { cn } from "@/lib/utils"
import { CopyButton } from "./CopyButton"

export interface ChatImageItem {
  type: "b64_json" | "url"
  data: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  modelName?: string // 模型名称，仅 assistant 消息有效
  reasoning?: string // 推理内容，仅 assistant 消息有效
  images?: ChatImageItem[] // 图像生成结果
}

interface MessageProps {
  message: ChatMessage
  isStreaming?: boolean // 是否正在流式生成（通常用于最后一条 assistant 消息）
}

function normalizeMarkdownBreakTags(content: string) {
  return content.replace(/<br\s*\/?\s*>/gi, "\n")
}

export function Message({ message, isStreaming }: MessageProps) {
  const isUser = message.role === "user"
  const [reasoningExpanded, setReasoningExpanded] = useState(false)
  // assistant 消息支持切换渲染/源码
  const [showRaw, setShowRaw] = useState(false)

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
            "rounded-lg px-4 py-2.5 relative group",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground"
          )}
        >
          {message.images && message.images.length > 0 ? (
            <div className="flex flex-col gap-2">
              {message.images.map((img, i) => {
                const src =
                  img.type === "b64_json"
                    ? `data:image/png;base64,${img.data}`
                    : img.data
                return (
                  <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`generated-${i}`}
                      className="max-w-full rounded-md"
                    />
                  </a>
                )
              })}
            </div>
          ) : message.content ? (
            isUser ? (
              <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
            ) : (
              <div className="markdown-body wrap-break-word">
                {/* 工具栏 */}
                <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    className="px-1 py-0.5 rounded text-xs border border-border bg-background/70 hover:bg-background"
                    onClick={() => setShowRaw(v => !v)}
                  >
                    {showRaw ? "显示渲染" : "显示源码"}
                  </button>
                  <CopyButton text={message.content} className="px-1 py-0.5 rounded border border-border bg-background/70 hover:bg-background" />
                </div>
                {showRaw ? (
                  <pre className="whitespace-pre-wrap text-xs bg-transparent p-0 m-0 min-h-[2em]">{message.content}</pre>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      p: ({ children }) => <p className="my-1 leading-relaxed">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-semibold mt-2 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold mt-2 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-semibold mt-1.5 mb-1">{children}</h4>,
                      a: ({ children, href }) => (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2 hover:opacity-80"
                        >
                          {children}
                        </a>
                      ),
                      code: ({ className, children, ...props }) => {
                        const isInline = !className
                        if (isInline) {
                          return (
                            <code
                              className="px-1 py-0.5 rounded bg-background/60 text-[0.85em] font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          )
                        }
                        return (
                          <code className={cn("font-mono text-[0.85em]", className)} {...props}>
                            {children}
                          </code>
                        )
                      },
                      pre: ({ children }) => (
                        <pre className="my-2 p-3 rounded-md bg-background/60 overflow-x-auto text-xs">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="my-2 pl-3 border-l-2 border-border text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      table: ({ children }) => (
                        <div className="my-2 overflow-x-auto">
                          <table className="w-full border-collapse text-xs">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-border px-2 py-1 bg-background/40 font-medium text-left">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => {
                        return <td className="border border-border px-2 py-1 align-top">{children}</td>
                      },
                      br: () => <br />,
                      hr: () => <hr className="my-2 border-border" />,
                    }}
                  >
                    {normalizeMarkdownBreakTags(message.content)}
                  </ReactMarkdown>
                )}
              </div>
            )
          ) : isStreaming && !isReasoning ? (
            // 等待响应
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
