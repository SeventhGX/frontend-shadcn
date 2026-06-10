"use client"

import { useState } from "react"
import { Bot, User, ChevronDown, ChevronRight, BrainCircuit } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { cn } from "@/lib/utils"
import { CopyButton } from "./CopyButton"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Send, Copy as CopyIcon, Download } from "lucide-react"
import { downloadFile } from "@/features/chat/api"

export interface ChatImageItem {
  type: "b64_json" | "url"
  // 原始图像数据（base64 或 url）。从历史加载时可能不存在，只有 compressedData
  data?: string
  // 压缩后的 JPEG base64 数据，用于历史会话快速预览
  compressedData?: string
  name?: string // 可选的原始文件名
  mimeType?: string // 可选的 MIME 类型，默认 image/png
  id?: string // 后端已保存的文件 ID（若已保存）
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
  // 父组件提供时显示"提交"菜单项；回调接收图片内容及推断/生成的文件名
  onSubmitImage?: (image: ChatImageItem, name: string) => void
}

function normalizeMarkdownBreakTags(content: string) {
  return content.replace(/<br\s*\/?\s*>/gi, "\n")
}

// 与 saveFile 调用一致的取名逻辑：未提供名称时按当前时间戳生成
function resolveImageName(img: ChatImageItem): string {
  if (img.name && img.name.trim()) return img.name
  return `generated-${Date.now()}.png`
}

// base64 转 Blob
function base64ToBlob(base64: string, mimeType = "image/png"): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

async function imageToBlob(img: ChatImageItem): Promise<Blob> {
  if (img.type === "b64_json") {
    if (img.data) return base64ToBlob(img.data, img.mimeType ?? "image/png")
    if (img.compressedData) return base64ToBlob(img.compressedData, "image/jpeg")
    throw new Error("图像数据为空")
  }
  const url = img.data ?? ""
  if (!url) throw new Error("图像 URL 为空")
  const r = await fetch(url)
  return await r.blob()
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Message({ message, isStreaming, onSubmitImage }: MessageProps) {
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
                    ? img.data
                      ? `data:${img.mimeType ?? "image/png"};base64,${img.data}`
                      : img.compressedData
                        ? `data:image/jpeg;base64,${img.compressedData}`
                        : ""
                    : img.data ?? ""
                const name = resolveImageName(img)

                const handleCopy = async () => {
                  try {
                    const blob = await imageToBlob(img)
                    // 浏览器剪贴板对图像类型限制较多，统一转 PNG
                    const pngBlob =
                      blob.type === "image/png"
                        ? blob
                        : await new Promise<Blob>((resolve, reject) => {
                            const image = new Image()
                            image.crossOrigin = "anonymous"
                            image.onload = () => {
                              const canvas = document.createElement("canvas")
                              canvas.width = image.naturalWidth
                              canvas.height = image.naturalHeight
                              const ctx = canvas.getContext("2d")
                              if (!ctx) return reject(new Error("canvas 不可用"))
                              ctx.drawImage(image, 0, 0)
                              canvas.toBlob((b) => {
                                if (b) resolve(b)
                                else reject(new Error("转换 PNG 失败"))
                              }, "image/png")
                            }
                            image.onerror = () => reject(new Error("图像加载失败"))
                            image.src = URL.createObjectURL(blob)
                          })
                    await navigator.clipboard.write([
                      new ClipboardItem({ "image/png": pngBlob }),
                    ])
                  } catch (err) {
                    console.error("复制图像失败:", err)
                  }
                }

                const handleSave = async () => {
                  try {
                    // 已保存到后端的图像：通过 downloadFile 流式拉取原始文件，
                    // 避免下载历史会话里的压缩 JPEG，也避免 url 类型走前端 fetch 的 CORS 限制
                    if (img.id) {
                      const res = await downloadFile(img.id)
                      let downloadName = name
                      const disposition = res.headers.get("content-disposition")
                      if (disposition) {
                        const m = disposition.match(/filename\*=UTF-8''([^;]+)/i)
                        if (m) {
                          try {
                            downloadName = decodeURIComponent(m[1])
                          } catch {}
                        }
                      }
                      const blob = await res.blob()
                      triggerDownload(blob, downloadName)
                      return
                    }
                    const blob = await imageToBlob(img)
                    triggerDownload(blob, name)
                  } catch (err) {
                    console.error("保存图像失败:", err)
                  }
                }

                return (
                  <ContextMenu key={i}>
                    <ContextMenuTrigger asChild>
                      <a href={src} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={name}
                          className="max-w-full rounded-md"
                        />
                      </a>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-36">
                      {onSubmitImage && (
                        <ContextMenuItem
                          onClick={() => onSubmitImage(img, name)}
                        >
                          <Send size={14} />
                          提交
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onClick={handleCopy}>
                        <CopyIcon size={14} />
                        复制
                      </ContextMenuItem>
                      <ContextMenuItem onClick={handleSave}>
                        <Download size={14} />
                        保存
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
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
