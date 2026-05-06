"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Bot,
  Trash2,
  History,
  Clock,
  LoaderCircle,
  Settings2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
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
  addSession,
  updateSession,
  type ChatSession,
  type ModelItem,
  type ModelKwarg,
} from "@/features/chat/api"

type ParamValue = string | number | boolean

function buildDefaults(kwargs: ModelKwarg[] | undefined): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  ;(kwargs ?? []).forEach((k) => {
    out[k.name] = k.default
  })
  return out
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [models, setModels] = useState<ModelItem[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  // 当前会话信息（新建会话时由后端返回 id 与 session_name）
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [currentSessionName, setCurrentSessionName] = useState<string>("")
  // 从历史加载的消息数量，用于在其后渲染分隔线，区分历史会话与新内容
  const [historyCount, setHistoryCount] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false) // 记录输入法候选状态
  // 保存最新的 messages，供流式结束后同步会话使用（避免在 setState updater 中执行副作用）
  const messagesRef = useRef<ChatMessage[]>([])

  // 历史会话侧边栏状态
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState<string | null>(null) // 正在加载的 sessionId

  // 模型参数设置面板
  const [paramsOpen, setParamsOpen] = useState(true)
  const [paramValues, setParamValues] = useState<Record<string, ParamValue>>({})

  const selectedModelLabel = selectedModel
  const currentModelKwargs: ModelKwarg[] =
    models.find((m) => m.model === selectedModel)?.kwargs ?? []

  // 页面加载时获取模型列表
  useEffect(() => {
    getModels()
      .then((res) => {
        const list = res.data || []
        setModels(list)
        if (list.length > 0) {
          setSelectedModel(list[0].model)
          setParamValues(buildDefaults(list[0].kwargs))
        }
      })
      .catch((err) => console.error("获取模型列表失败:", err))
  }, [])

  // 打开模型下拉框时刷新模型列表（保留先前选中项；选项不在则回退到第一项并重置参数）
  const handleModelSelectOpenChange = async (open: boolean) => {
    if (!open) return
    const prev = selectedModel
    try {
      const res = await getModels()
      const list = res.data || []
      setModels(list)
      if (list.some((m) => m.model === prev)) {
        setSelectedModel(prev)
      } else if (list.length > 0) {
        setSelectedModel(list[0].model)
        setParamValues(buildDefaults(list[0].kwargs))
        setParamsOpen(true)
      }
    } catch (err) {
      console.error("获取模型列表失败:", err)
    }
  }

  // 切换模型：未变化时不动；切换后展开参数面板并重置为新模型默认值
  const handleModelChange = (next: string) => {
    if (next === selectedModel) return
    setSelectedModel(next)
    const kwargs = models.find((m) => m.model === next)?.kwargs
    setParamValues(buildDefaults(kwargs))
    setParamsOpen(true)
  }

  const setParamValue = (name: string, value: ParamValue) => {
    setParamValues((prev) => ({ ...prev, [name]: value }))
  }

  // 按 modelType 分组
  const modelGroups = models.reduce<Record<string, ModelItem[]>>((acc, m) => {
    ; (acc[m.modelType] ??= []).push(m)
    return acc
  }, {})

  // 每次消息更新后自动滚动到底部，同时同步 ref
  useEffect(() => {
    messagesRef.current = messages
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
      setHistoryCount(loaded.length)
      // 同步当前会话 id 与标题
      setCurrentSessionId(session.id)
      setCurrentSessionName(session.session_name || "")
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

      const selectedModelType =
        models.find((m) => m.model === selectedModel)?.modelType

      const response = await chatByStream({
        model: selectedModel,
        model_type: selectedModelType,
        content: { messages: conversationMessages },
        kwargs: paramValues,
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
            } else if (data.reasoning_content !== undefined) {
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    reasoning: (last.reasoning ?? "") + data.reasoning_content,
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

      // 流式传输完成后，同步会话到后台
      // 从 ref 读最新 messages，避免在 setState updater 里发请求（Strict Mode 会重复调用）
      const finalMessages = messagesRef.current.map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const selectedModelType =
        models.find((m) => m.model === selectedModel)?.modelType

      if (!currentSessionId) {
        // 新建会话：调用 add_session 获取 id 与名称
        addSession({
          session_name: userContent.slice(0, 30),
          model: selectedModel,
          model_type: selectedModelType,
          content: { messages: finalMessages },
        })
          .then((res) => {
            const data = res.data
            if (data?.id) {
              setCurrentSessionId(data.id)
              setCurrentSessionName(data.session_name || "")
            }
          })
          .catch((err) => console.error("新建会话失败:", err))
      } else {
        // 已有会话：调用 update_session 更新内容
        updateSession({
          id: currentSessionId,
          session_name: currentSessionName,
          content: { messages: finalMessages },
        }).catch((err) => console.error("更新会话失败:", err))
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送，Shift+Enter 换行
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
      handleSend()
    }
  }

  const clearMessages = () => {
    if (isStreaming) return
    setMessages([])
    // 清空对话视为开启新会话
    setCurrentSessionId(null)
    setCurrentSessionName("")
    setHistoryCount(0)
  }

  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        {/* 顶部工具栏：模型选择 */}
        <div className="flex-none flex items-center gap-3 relative">
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
            onValueChange={handleModelChange}
            onOpenChange={handleModelSelectOpenChange}
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

          {/* 居中显示当前会话标题 */}
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[40%] pointer-events-none">
            <p className="text-sm font-medium truncate text-center" title={currentSessionName}>
              {currentSessionName || "新会话"}
            </p>
          </div>

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

        {/* 主体区域：左侧参数设置 + 右侧消息列表 */}
        <div className="flex-1 min-h-0 flex gap-2">
          {/* 参数设置面板 */}
          <aside
            className={cn(
              "flex-none flex flex-col border rounded-md bg-card transition-all duration-200",
              paramsOpen ? "w-72" : "w-10"
            )}
          >
            {paramsOpen ? (
              <>
                <div className="flex-none flex items-center justify-between px-3 py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Settings2 size={14} />
                    <span className="text-sm font-medium">参数设置</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setParamsOpen(false)}
                    title="收起"
                  >
                    <ChevronLeft size={14} />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
                  {currentModelKwargs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center pt-4">
                      当前模型暂无可配置参数
                    </p>
                  ) : (
                    currentModelKwargs.map((kw) => {
                      const value = paramValues[kw.name]
                      if (kw.type === "boolean") {
                        return (
                          <div key={kw.name} className="flex items-center justify-between gap-3">
                            <Label className="text-xs font-medium truncate" title={kw.name}>
                              {kw.name}
                            </Label>
                            <Switch
                              checked={Boolean(value)}
                              onCheckedChange={(v) => setParamValue(kw.name, v)}
                              disabled={isStreaming}
                            />
                          </div>
                        )
                      }
                      if (kw.type === "string") {
                        const options = kw.option ?? []
                        return (
                          <div key={kw.name} className="space-y-2">
                            <Label className="text-xs font-medium" title={kw.name}>
                              {kw.name}
                            </Label>
                            <Select
                              value={String(value ?? "")}
                              onValueChange={(v) => setParamValue(kw.name, v)}
                              disabled={isStreaming || options.length === 0}
                            >
                              <SelectTrigger className="w-full h-8">
                                <SelectValue placeholder="请选择" />
                              </SelectTrigger>
                              <SelectContent>
                                {options.map((opt) => (
                                  <SelectItem key={opt} value={opt}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )
                      }
                      // number / integer
                      const step = kw.type === "integer" ? 1 : 0.01
                      const numValue =
                        typeof value === "number" ? value : Number(kw.default ?? kw.min ?? 0)
                      return (
                        <div key={kw.name} className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-xs font-medium truncate" title={kw.name}>
                              {kw.name}
                            </Label>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {numValue}
                            </span>
                          </div>
                          <Slider
                            value={[numValue]}
                            min={kw.min ?? 0}
                            max={kw.max ?? 100}
                            step={step}
                            disabled={isStreaming}
                            onValueChange={(v) =>
                              setParamValue(
                                kw.name,
                                kw.type === "integer" ? Math.round(v[0]) : v[0]
                              )
                            }
                          />
                          <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                            <span>{kw.min ?? 0}</span>
                            <span>{kw.max ?? 100}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setParamsOpen(true)}
                className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-md"
                title="展开参数设置"
              >
                <ChevronRight size={14} />
                <Settings2 size={14} />
              </button>
            )}
          </aside>

          {/* 消息列表区域 */}
          <div className="flex-1 min-w-0 min-h-0 overflow-y-auto space-y-4 py-2 px-1">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  选择模型，开始与 AI 对话
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => (
                  <div key={msg.id} className="space-y-4">
                    <Message
                      message={msg}
                      // 最后一条 assistant 消息且正在流式生成时显示加载动画
                      isStreaming={
                        isStreaming &&
                        index === messages.length - 1 &&
                        msg.role === "assistant"
                      }
                    />
                    {/* 历史会话末尾的分隔线，区分历史与后续新内容 */}
                    {historyCount > 0 && index === historyCount - 1 && (
                      <div className="flex items-center gap-3 px-2">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground shrink-0">以上为历史会话</span>
                        <Separator className="flex-1" />
                      </div>
                    )}
                  </div>
                ))}
                {/* 用于自动滚动到底部的锚点 */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </div>

        <Separator />

        {/* 输入区域 */}
        <div className="flex-none flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => (isComposingRef.current = true)}
            onCompositionEnd={() => (isComposingRef.current = false)}
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
