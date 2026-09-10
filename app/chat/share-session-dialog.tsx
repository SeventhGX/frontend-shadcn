"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, Link as LinkIcon, Ban } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CopyButton } from "@/components/common/CopyButton"
import {
  shareSession,
  cancelSessionShare,
  type SessionShare,
} from "@/features/chat/api"

interface ShareSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionId: string | null
  sessionName: string
  // 分享/取消分享成功后回调，供外部刷新会话列表中的分享标识
  onShareChange?: () => void
}

const EXPIRE_OPTIONS = [
  { value: "permanent", label: "永久有效" },
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
]

export function ShareSessionDialog({
  open,
  onOpenChange,
  sessionId,
  sessionName,
  onShareChange,
}: ShareSessionDialogProps) {
  const [loading, setLoading] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [share, setShare] = useState<SessionShare | null>(null)
  const [expireOption, setExpireOption] = useState("permanent")

  // 打开弹窗时自动创建/复用分享链接
  useEffect(() => {
    if (!open || !sessionId) return
    setError(null)
    setShare(null)
    setExpireOption("permanent")
    setLoading(true)
    shareSession({ session_id: sessionId })
      .then((res) => setShare(res.data))
      .catch((err) => {
        console.error("创建分享链接失败:", err)
        setError("创建分享链接失败，请稍后重试")
      })
      .finally(() => setLoading(false))
  }, [open, sessionId])

  const handleRegenerate = async () => {
    if (!sessionId) return
    setLoading(true)
    setError(null)
    try {
      const expireDays = expireOption === "permanent" ? undefined : Number(expireOption)
      const res = await shareSession({ session_id: sessionId, expire_days: expireDays })
      setShare(res.data)
      onShareChange?.()
    } catch (err) {
      console.error("重新生成分享链接失败:", err)
      setError("重新生成分享链接失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelShare = async () => {
    if (!share) return
    setCanceling(true)
    try {
      await cancelSessionShare(share.share_code)
      setShare(null)
      onShareChange?.()
      onOpenChange(false)
    } catch (err) {
      console.error("取消分享失败:", err)
      setError("取消分享失败，请稍后重试")
    } finally {
      setCanceling(false)
    }
  }

  const shareLink =
    share && typeof window !== "undefined"
      ? `${window.location.origin}/chat/share?code=${encodeURIComponent(share.share_code)}`
      : ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享会话</DialogTitle>
          <DialogDescription>
            将“{sessionName || "未命名会话"}”生成分享链接，任何已登录用户凭链接即可查看会话内容。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <LoaderCircle size={18} className="animate-spin mr-2" />
            <span className="text-sm">生成中...</span>
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : share ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input readOnly value={shareLink} className="flex-1" />
              <CopyButton text={shareLink} className="shrink-0 p-2 border rounded-md hover:bg-muted" />
            </div>
            <p className="text-xs text-muted-foreground">
              {share.expire_time ? `有效期至 ${share.expire_time}` : "永久有效"} · 已被访问 {share.visit_count} 次
            </p>
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">重新生成有效期</Label>
              <Select value={expireOption} onValueChange={setExpireOption}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRegenerate} className="gap-2">
                <LinkIcon size={14} />
                重新生成
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={handleCancelShare}
            disabled={!share || canceling}
            className="gap-2"
          >
            {canceling ? <LoaderCircle size={14} className="animate-spin" /> : <Ban size={14} />}
            取消分享
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
