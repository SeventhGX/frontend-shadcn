"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AuthGuard } from "@/components/common/auth-guard"
import { Message, type ChatMessage } from "@/components/common/message"
import { chatByStream } from "@/features/chat/api"

// TODO: 根据实际支持的模型列表修改
const AI_MODELS = [
  { value: "deepseek-r1", label: "DeepSeek-R1" },
  { value: "deepseek-v3", label: "DeepSeek-V3" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "qwen2.5-72b", label: "Qwen2.5-72B" },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(AI_MODELS[0].value)
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const selectedModelLabel =
    AI_MODELS.find((m) => m.value === selectedModel)?.label ?? selectedModel

  // 每次消息更新后自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
        messages: conversationMessages,
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
          <Bot size={18} />
          <Label className="font-bold">模型</Label>
          <Select
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={isStreaming}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODELS.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
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
