"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoaderCircle, Save, ArrowRight, AlertTriangle } from "lucide-react"

import { AuthGuard } from "@/components/common/auth-guard"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Message, type ChatMessage, type ChatImageItem } from "@/components/common/message"
import {
  getSharedSession,
  saveSharedSession,
  getCompressedFile,
  type SharedSession,
} from "@/features/chat/api"
import { toast } from "sonner"

const IMAGE_REF_PREFIX = "Image-:"

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

function SharedSessionView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const shareCode = searchParams.get("code") || ""

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<SharedSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!shareCode) {
      setError("缺少分享码")
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getSharedSession(shareCode)
      .then((res) => {
        const data = res.data
        setShared(data)
        const rawMessages = data.content?.messages || []
        const parsed = rawMessages.map((m, i) => {
          const content = typeof m.content === "string" ? m.content : ""
          const imageIds = extractImageIds(content)
          const msg: ChatMessage = {
            id: `shared-${data.share_code}-${i}`,
            role: m.role,
            content: imageIds.length > 0 ? "" : content,
            images: imageIds.length > 0 ? [] : undefined,
          }
          return { msg, imageIds }
        })
        setMessages(parsed.map((p) => p.msg))

        parsed.forEach(async (p) => {
          if (p.imageIds.length === 0) return
          const images: ChatImageItem[] = []
          for (const id of p.imageIds) {
            try {
              const r = await getCompressedFile(id)
              images.push({
                type: "b64_json",
                compressedData: r.data.data,
                id,
                name: r.data.filename,
                mimeType: r.data.file_type || "image/png",
              })
            } catch (err) {
              console.error("获取分享图像失败:", id, err)
            }
          }
          if (images.length === 0) return
          setMessages((prev) =>
            prev.map((m) => (m.id === p.msg.id ? { ...m, images } : m))
          )
        })
      })
      .catch((err) => {
        console.error("加载分享会话失败:", err)
        const status = err?.status
        if (status === 410) setError("分享链接已过期")
        else if (status === 404) setError("分享链接不存在或已被取消")
        else setError("加载分享会话失败，请稍后重试")
      })
      .finally(() => setLoading(false))
  }, [shareCode])

  const handleSave = async () => {
    if (!shared || saving) return
    setSaving(true)
    try {
      const res = await saveSharedSession({ share_code: shared.share_code })
      toast.success("已保存到我的会话")
      if (res.data?.id) {
        router.push("/chat")
      }
    } catch (err) {
      console.error("保存分享会话失败:", err)
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
      <div className="flex-none flex items-center gap-3">
        <p className="text-sm font-medium truncate">
          {shared?.session_name || "分享的会话"}
        </p>
        {shared?.shared_by && (
          <span className="text-xs text-muted-foreground">来自 {shared.shared_by} 的分享</span>
        )}
        {shared && !shared.is_owner && (
          <Button size="sm" className="ml-auto gap-2" onClick={handleSave} disabled={saving}>
            {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />}
            保存到我的会话
          </Button>
        )}
        {shared?.is_owner && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => router.push("/chat")}
          >
            前往我的会话
            <ArrowRight size={14} />
          </Button>
        )}
      </div>

      <Separator />

      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2 px-1">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle size={24} />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          messages.map((msg) => <Message key={msg.id} message={msg} />)
        )}
      </div>
    </div>
  )
}

export default function SharedSessionPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin mr-2" />
            <span className="text-sm">加载中...</span>
          </div>
        }
      >
        <SharedSessionView />
      </Suspense>
    </AuthGuard>
  )
}
