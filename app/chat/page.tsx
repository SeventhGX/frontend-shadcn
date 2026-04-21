"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, Trash2, History, Clock, LoaderCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AuthGuard } from "@/components/common/auth-guard"
import { Message, type ChatMessage } from "@/components/common/message"
import {
  chatByStream,
  getModels,
  getChatSessions,
  getChatSessionById,
  type ChatSession,
  type ModelItem,
} from "@/features/chat/api"

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [models, setModels] = useState<ModelItem[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 历史会话侧边栏状态
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState<string | null>(null) // 正在加载的 sessionId

  const selectedModelLabel = selectedModel

  // 页面加载时获取模型列表
  useEffect(() => {
    getModels()
      .then((res) => {
        const list = res.data || []
        setModels(list)
        if (list.length > 0) setSelectedModel(list[0].model)
      })
      .catch((err) => console.error("获取模型列表失败:", err))
  }, [])

  // 按 modelType 分组
  const modelGroups = models.reduce<Record<string, ModelItem[]>>((acc, m) => {
    ; (acc[m.modelType] ??= []).push(m)
    return acc
  }, {})

  // 每次消息更新后自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // 打开侧边栏时加载历史会话列表
  const handleSheetOpenChange = async (open: boolean) => {
    setSheetOpen(open)
    if (!open) return
    setSessionsLoading(true)
    try {
      const data = await getChatSessions()
      setSessions(data.data || [])
    } catch (error) {
      console.error("获取历史会话失败:", error)
    } finally {
      setSessionsLoading(false)
    }
  }

  // 选中某条历史会话，加载会话内容
  const handleSelectSession = async (session: ChatSession) => {
    if (sessionDetailLoading) return
    setSessionDetailLoading(session.id)
    try {
      const detail = await getChatSessionById(session.id)
      const session_detail = detail.data.content.messages || []
      // 将会话消息转换为页面所用格式
      const loaded: ChatMessage[] = session_detail.map((m: { role: string; content: any }, i: any) => ({
        id: `loaded-${session.id}-${i}`,
        role: m.role,
        content: m.content,
        modelName: m.role === "assistant" ? detail.model : undefined,
      }))
      setMessages(loaded)
      // 同步模型选择（若当前列表包含该模型）
      if (models.some((m) => m.model === detail.model)) {
        setSelectedModel(detail.model)
      }
      setSheetOpen(false)
    } catch (error) {
      console.error("获取会话详情失败:", error)
    } finally {
      setSessionDetailLoading(null)
    }
  }

  const handleSend = async () => {
    const userContent = input.trim()
    if (!userContent || isStreaming) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userContent,
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      modelName: selectedModelLabel,
    }

    // 在 state 更新前记录当前历史，用于构造请求体
    const historyMessages = messages

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput("")
    setIsStreaming(true)

    try {
      const conversationMessages = [
        ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: userMessage.role, content: userMessage.content },
      ]

      const response = await chatByStream({
        model: selectedModel,
        content: conversationMessages,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error("无法获取流读取器")

      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine) continue

          // 移除 SSE "data: " 前缀
          let jsonStr = trimmedLine
          if (trimmedLine.startsWith("data: ")) {
            jsonStr = trimmedLine.substring(6)
          }

          if (jsonStr === "[DONE]" || !jsonStr.trim()) continue

          try {
            const data = JSON.parse(jsonStr)

            // TODO: 根据后端返回的字段名调整（当前解析 data.content）
            if (data.content !== undefined) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + data.content,
                  }
                }
                return updated
              })
            }
          } catch (e) {
            console.warn("JSON 解析错误:", trimmedLine, e)
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error)
      // 发生错误时，在最后一条 assistant 消息中显示错误提示
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last && last.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "请求失败，请稍后重试。",
          }
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearMessages = () => {
    if (isStreaming) return
    setMessages([])
  }

  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        {/* 顶部工具栏：模型选择 */}
        <div className="flex-none flex items-center gap-3">
          {/* 历史会话侧边栏 */}
          <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <History size={14} />
                历史会话
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 sm:max-w-xs flex flex-col gap-0 p-0">
              <SheetHeader className="px-4 py-3 border-b">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <History size={16} />
                  历史会话
                </SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto">
                {sessionsLoading ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    <LoaderCircle size={18} className="animate-spin mr-2" />
                    <span className="text-sm">加载中...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex items-center justify-center h-32">
                    <p className="text-sm text-muted-foreground">暂无历史会话</p>
                  </div>
                ) : (
                  <ul className="divide-y">
                    {sessions.map((session) => {
                      const isLoading = sessionDetailLoading === session.id
                      return (
                        <li key={session.id}>
                          <button
                            onClick={() => handleSelectSession(session)}
                            disabled={!!sessionDetailLoading}
                            className="w-full text-left px-4 py-3 hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-start gap-2">
                              {isLoading ? (
                                <LoaderCircle size={14} className="animate-spin mt-0.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <Clock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{session.session_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{session.create_time}</span>
                                  {/* {session.model && (
                                    <span className="text-xs text-muted-foreground truncate">{session.model}</span>
                                  )} */}
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Bot size={18} />
          <Label className="font-bold">模型</Label>
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={isStreaming || models.length === 0}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder={models.length === 0 ? "当前无可用模型" : "加载中..."} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(modelGroups).map(([type, items]) => (
                <SelectGroup key={type}>
                  <SelectLabel>{type}</SelectLabel>
                  {items.map((m) => (
                    <SelectItem key={m.model} value={m.model}>
                      {m.model}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            disabled={isStreaming || messages.length === 0}
            className="ml-auto gap-2"
          >
            <Trash2 size={14} />
            清空对话
          </Button>
        </div>

        <Separator />

        {/* 消息列表区域 */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2 px-1">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                选择模型，开始与 AI 对话
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <Message
                key={msg.id}
                message={msg}
                // 最后一条 assistant 消息且正在流式生成时显示加载动画
                isStreaming={
                  isStreaming &&
                  index === messages.length - 1 &&
                  msg.role === "assistant"
                }
              />
            ))
          )}
          {/* 用于自动滚动到底部的锚点 */}
          <div ref={messagesEndRef} />
        </div>

        <Separator />

        {/* 输入区域 */}
        <div className="flex-none flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，Enter 发送，Shift+Enter 换行"
            className="min-h-15 max-h-36 resize-none"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="gap-2 h-15 px-5"
          >
            <Send size={16} />
            {isStreaming ? "生成中..." : "发送"}
          </Button>
        </div>
      </div>
    </AuthGuard>
  )
}
