"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import { ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"
import { useState, useEffect } from "react";

import { maToHtml } from "@/features/article/api"

export default function MailView({ mailContent }: { mailContent: string }) {

  const [open, setOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string>("")
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)

  useEffect(() => {
    const handlePreview = async () => {
      if (!open) return
      
      if (!mailContent.trim()) {
        toast.warning("邮件内容不能为空")
        setOpen(false)
        return
      }

      setIsPreviewLoading(true)
      try {
        const result = await maToHtml(mailContent)
        if (result.code === 200 && result.data) {
          console.log("Preview HTML:", result.data)
          setPreviewHtml(result.data)
        } else {
          toast.error("预览失败：" + (result.message || "未知错误"))
        }
      } catch (error) {
        console.error("Preview error:", error)
        toast.error("预览失败，请检查网络连接")
      } finally {
        setIsPreviewLoading(false)
      }
    }

    handlePreview()
  }, [open, mailContent])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="ml-2"
          variant="outline"
        >
          <ScanSearch size={16} />
          邮件样式预览
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-4 gap-0">
        <DialogHeader className="shrink-0 pb-4">
          <DialogTitle>邮件样式预览</DialogTitle>
          <DialogDescription>
            为了安全考虑，预览时超链接被禁用，发送邮件时将恢复正常。
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 border-2 rounded-md">
            <iframe
              className="w-full h-full border-0"
              srcDoc={previewHtml}
              title="邮件预览"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}