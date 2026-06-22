"use client"

import { useState, useRef, useEffect } from "react"
import {
  Send,
  Bot,
  Trash2,
  Download,
  LoaderCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
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
import { AuthGuard } from "@/components/common/auth-guard"
import { Message, type ChatMessage, type ChatImageItem } from "@/components/common/message"
import {
  ImageAttachments,
  type ImageAttachmentsHandle,
} from "@/components/common/image-attachments"
import { HistorySessionSidebar } from "./history-session-sidebar"
import { ModelParamsPanel } from "./model-params-panel"
import {
  chatByStream,
  generateImage,
  editImage,
  getModels,
  getChatSessions,
  getChatSessionById,
  deleteSession,
  addSession,
  updateSession,
  saveFile,
  getFile,
  getCompressedFile,
  downloadSessionWord,
  type ChatSession,
  type ModelItem,
  type ModelKwarg,
  type ChatRequestMessage,
} from "@/features/chat/api"

const IMAGE_REF_PREFIX = "Image-:"

// 从消息 content 中提取所有 Image-: 前缀的文件 ID
function extractImageIds(content: string): string[] {
  if (!content) return []
  const ids: string[] = []
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed.startsWith(IMAGE_REF_PREFIX)) {
      const id = trimmed.slice(IMAGE_REF_PREFIX.length).trim()
      if (id) ids.push(id)
    }
  }
  return ids
}

// 将 Blob 转 base64（不含 data: 前缀）
async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

type ParamValue = string | number | boolean

function buildDefaults(kwargs: ModelKwarg[] | undefined): Record<string, ParamValue> {
  const out: Record<string, ParamValue> = {}
  ;(kwargs ?? []).forEach((k) => {
    out[k.name] = k.default
  })
  return out
}

function chatMessageToRequestMessage(
  message: ChatMessage,
  imageOverride?: ChatImageItem[],
  fallbackImageIds: string[] = []
): ChatRequestMessage {
  const images = imageOverride ?? message.images
  if (images && images.length > 0) {
    const ids = images
      .map((image) => image.id)
      .filter((id): id is string => !!id)
    if (ids.length > 0) {
      return {
        role: message.role,
        content: ids.map((id) => `${IMAGE_REF_PREFIX}${id}`).join("\n"),
      }
    }
    const content = fallbackImageIds.length > 0
      ? fallbackImageIds.map((id) => `${IMAGE_REF_PREFIX}${id}`).join("\n")
      : ""
    return { role: message.role, content }
  }
  return { role: message.role, content: message.content }
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
  // 图片附件组件引用，便于外部通过 addImage 注入 base64 图像
  const imageAttachmentsRef = useRef<ImageAttachmentsHandle>(null)

  // 历史会话侧边栏状态
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionDetailLoading, setSessionDetailLoading] = useState<string | null>(null) // 正在加载的 sessionId
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)

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

  const loadSessions = async () => {
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

  // 打开侧边栏时加载历史会话列表
  const handleSheetOpenChange = async (open: boolean) => {
    setSheetOpen(open)
    if (!open) return
    await loadSessions()
  }

  // 选中某条历史会话，加载会话内容
  const handleSelectSession = async (session: ChatSession) => {
    if (sessionDetailLoading) return
    setSessionDetailLoading(session.id)
    try {
      const detail = await getChatSessionById(session.id)
      const session_detail = detail.data.content.messages || []
      // 将会话消息转换为页面所用格式；识别 Image-: 前缀的图像引用消息
      const parsed = session_detail.map((m: { role: string; content: unknown }, i: number) => {
        const content = typeof m.content === "string" ? m.content : ""
        const imageIds = extractImageIds(content)
        const msg: ChatMessage = {
          id: `loaded-${session.id}-${i}`,
          role: m.role as "user" | "assistant",
          content: imageIds.length > 0 ? "" : content,
          modelName: m.role === "assistant" ? detail.model : undefined,
          images: imageIds.length > 0 ? [] : undefined,
        }
        return { msg, imageIds }
      })
      const loaded: ChatMessage[] = parsed.map((p: { msg: ChatMessage }) => p.msg)
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

      // 异步加载历史消息中引用的图像（仅压缩版，用于快速预览；原图按需在"提交"时再拉取）
      parsed.forEach(async (p: { msg: ChatMessage; imageIds: string[] }) => {
        if (p.imageIds.length === 0) return
        const images: ChatImageItem[] = []
        for (const id of p.imageIds) {
          try {
            const res = await getCompressedFile(id)
            images.push({
              type: "b64_json",
              compressedData: res.data.data,
              id,
              name: res.data.filename,
              mimeType: res.data.file_type || "image/png",
            })
          } catch (err) {
            console.error("获取历史图像失败:", id, err)
          }
        }
        if (images.length === 0) return
        setMessages((prev) =>
          prev.map((m) => (m.id === p.msg.id ? { ...m, images } : m))
        )
      })
    } catch (error) {
      console.error("获取会话详情失败:", error)
    } finally {
      setSessionDetailLoading(null)
    }
  }

  const handleDeleteSession = async () => {
    if (!deleteTarget || deletingSessionId) return
    const session = deleteTarget
    setDeletingSessionId(session.id)
    try {
      await deleteSession(session.id)
      setDeleteTarget(null)
      await loadSessions()
      if (currentSessionId === session.id) {
        setMessages([])
        setCurrentSessionId(null)
        setCurrentSessionName("")
        setHistoryCount(0)
      }
    } catch (error) {
      console.error("删除会话失败:", error)
    } finally {
      setDeletingSessionId(null)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    if (isStreaming) return
    const currentMessages = messagesRef.current
    const deleteIndex = currentMessages.findIndex((message) => message.id === messageId)
    if (deleteIndex < 0) return

    const nextMessages = currentMessages.filter((message) => message.id !== messageId)
    setMessages(nextMessages)
    messagesRef.current = nextMessages
    setHistoryCount((prev) => {
      if (prev <= 0) return prev
      return deleteIndex < prev ? Math.max(prev - 1, 0) : prev
    })

    if (!currentSessionId) return

    try {
      await updateSession({
        id: currentSessionId,
        session_name: currentSessionName,
        content: { messages: nextMessages.map((message) => chatMessageToRequestMessage(message)) },
      })
    } catch (error) {
      console.error("删除消息后更新会话失败:", error)
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

    const selectedModelType = models.find((m) => m.model === selectedModel)?.modelType
    const isImageModel = selectedModelType?.toLowerCase() === "image"
    // 在进入流式状态之前读取附件，避免发送过程中被外部更新
    const attachedImages = isImageModel
      ? imageAttachmentsRef.current?.getImages() ?? []
      : []
    const isImageEdit = isImageModel && attachedImages.length > 0

    // 改图场景：将每张附件图片作为一条独立的 user 消息插入到本次文字消息之前
    // 立即写入 state，让用户在等待响应时就能看到自己发送的图片
    const baseTs = Date.now()
    const attachedImageMessages: ChatMessage[] = attachedImages.map(
      (att, i) => ({
        id: `user-img-${baseTs}-${i}`,
        role: "user",
        content: "",
        images: [
          {
            type: "b64_json",
            data: att.base64,
            name: att.name,
            mimeType: att.mimeType,
            id: att.sourceId, // 已有 sourceId 则直接附带，否则稍后回填
          },
        ],
      })
    )

    setMessages((prev) => [
      ...prev,
      ...attachedImageMessages,
      userMessage,
      assistantMessage,
    ])
    setInput("")
    setIsStreaming(true)

    // 记录本次生成的图像，供 finally 中构造保存请求时使用（避免 messagesRef 滞后）
    let pendingImages: ChatImageItem[] | null = null
    // 本次生成图像在后端保存后返回的文件 ID
    const savedImageIds: string[] = []

    try {
      if (isImageModel) {
        // 图像生成 / 编辑：根据是否有附件图片决定调用哪个接口
        let res
        if (isImageEdit) {
          // 先把用户手选的图（未保存）入库，回填 id 到附件与对应 user 图像消息
          for (let i = 0; i < attachedImages.length; i++) {
            const att = attachedImages[i]
            if (att.sourceId) continue
            try {
              const sres = await saveFile({
                source_url: null,
                filename: att.name,
                file_type: att.mimeType,
                data: att.base64,
              })
              const newId = sres.data?.id
              if (newId) {
                att.sourceId = newId
                const msgId = attachedImageMessages[i].id
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgId
                      ? {
                          ...m,
                          images: m.images?.map((im, k) =>
                            k === 0 ? { ...im, id: newId } : im
                          ),
                        }
                      : m
                  )
                )
              }
            } catch (err) {
              console.error("保存附件图像失败:", err)
            }
          }

          const imageInputs = attachedImages.map(
            // (img) => `data:${img.mimeType};base64,${img.base64}`
            (img) => `${img.base64}`
          )
          res = await editImage({
            model_type: selectedModelType!,
            model: selectedModel,
            content: { image: imageInputs, prompt: userContent },
            kwargs: paramValues,
          })
        } else {
          res = await generateImage({
            model_type: selectedModelType!,
            model: selectedModel,
            content: { prompt: userContent },
            kwargs: paramValues,
          })
        }

        pendingImages = res.data ?? []

        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              images: pendingImages ?? [],
            }
          }
          return updated
        })

        // 异步保存图像到后端，收集返回的文件 ID，用于会话内容持久化
        for (const img of pendingImages) {
          try {
            if (!img.data) continue
            let base64 = img.data
            let fileType = "image/png"
            let sourceUrl: string | null = null
            const filename = `generated-${Date.now()}.png`
            if (img.type === "url") {
              sourceUrl = img.data
              const r = await fetch(img.data)
              fileType = r.headers.get("content-type") || "image/png"
              const blob = await r.blob()
              base64 = await blobToBase64(blob)
            }
            const sres = await saveFile({
              source_url: sourceUrl,
              filename,
              file_type: fileType,
              data: base64,
            })
            if (sres.data?.id) {
              savedImageIds.push(sres.data.id)
              // 回填到 pendingImages，便于右键菜单"提交"复用已保存 id
              img.id = sres.data.id
              img.mimeType = fileType
              img.name = filename
            }
          } catch (err) {
            console.error("保存图像失败:", err)
          }
        }

        // 同步带 id 的图像信息到 UI 状态
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last && last.role === "assistant" && pendingImages) {
            updated[updated.length - 1] = { ...last, images: [...pendingImages] }
          }
          return updated
        })
      } else {
        // 流式对话模式
        const conversationMessages = [
          ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: userMessage.role, content: userMessage.content },
        ]

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
      const finalMessages: ChatRequestMessage[] = messagesRef.current.map(
        (m, idx, arr) => {
          const isLastAssistant =
            idx === arr.length - 1 && m.role === "assistant"
          // 本次生成的图像可能尚未通过 setState 同步到 ref，这里手动覆盖到最后一条 assistant 消息
          if (isLastAssistant && pendingImages && pendingImages.length > 0) {
            return chatMessageToRequestMessage(m, pendingImages, savedImageIds)
          }
          return chatMessageToRequestMessage(m)
        }
      )

      // 一次改图对话完成后清空附件
      if (isImageEdit) {
        imageAttachmentsRef.current?.clear()
      }

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

  const [isDownloadingSession, setIsDownloadingSession] = useState(false)

  const handleDownloadSession = async () => {
    if (!currentSessionId || isDownloadingSession) return
    try {
      setIsDownloadingSession(true)
      const res = await downloadSessionWord(currentSessionId)
      let downloadName = `${currentSessionName || "session"}.docx`
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
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = downloadName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error("下载会话失败:", err)
    } finally {
      setIsDownloadingSession(false)
    }
  }

  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex-none flex items-center gap-3 relative">
          <HistorySessionSidebar
            open={sheetOpen}
            onOpenChange={handleSheetOpenChange}
            sessions={sessions}
            sessionsLoading={sessionsLoading}
            sessionDetailLoading={sessionDetailLoading}
            deleteTarget={deleteTarget}
            deletingSessionId={deletingSessionId}
            onSelectSession={handleSelectSession}
            onDeleteTargetChange={setDeleteTarget}
            onConfirmDelete={handleDeleteSession}
          />

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

          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownloadSession}
              disabled={isStreaming || !currentSessionId || isDownloadingSession}
              className="ml-auto gap-2"
            >
              {isDownloadingSession ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              下载会话
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            disabled={isStreaming || messages.length === 0}
            className={cn("gap-2", messages.length === 0 && "ml-auto")}
          >
            <Trash2 size={14} />
            清空对话
          </Button>
        </div>

        <Separator />

        {/* 主体区域：左侧参数设置 + 右侧消息列表 */}
        <div className="flex-1 min-h-0 flex gap-2">
          <ModelParamsPanel
            open={paramsOpen}
            onOpenChange={setParamsOpen}
            kwargs={currentModelKwargs}
            values={paramValues}
            disabled={isStreaming}
            onValueChange={setParamValue}
          />

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
                      onDeleteMessage={!isStreaming ? handleDeleteMessage : undefined}
                      onSubmitImage={async (img, name) => {
                        try {
                          let base64 = img.data
                          let mimeType = img.mimeType ?? "image/png"
                          if (img.type === "url") {
                            const r = await fetch(img.data ?? "")
                            mimeType = r.headers.get("content-type") || mimeType
                            const blob = await r.blob()
                            base64 = await blobToBase64(blob)
                          } else if (!base64 && img.id) {
                            // 历史会话中只持有压缩 JPEG 预览，提交到附件栏需走 getFile 取回原图
                            // 必须等原图加载完成后再添加，否则后续 editImage 会拿不到原始数据
                            const res = await getFile(img.id)
                            base64 = res.data.data
                            mimeType = res.data.file_type || mimeType
                          }
                          if (!base64) throw new Error("原始图像数据为空")
                          imageAttachmentsRef.current?.addImage({
                            name,
                            base64,
                            mimeType,
                            sourceId: img.id,
                          })
                        } catch (err) {
                          console.error("提交图像到附件失败:", err)
                        }
                      }}
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
        <div className="flex-none flex flex-col gap-2">
          <div className="flex gap-2 items-end">
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
          <ImageAttachments
            ref={imageAttachmentsRef}
            disabled={isStreaming}
          />
        </div>
      </div>
    </AuthGuard>
  )
}
