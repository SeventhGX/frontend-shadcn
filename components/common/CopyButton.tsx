"use client"
import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { copyToClipboard } from "@/lib/utils"

export function CopyButton({ text, className }: { text: string, className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={className}
      title="复制 Markdown 源码"
      onClick={async (e) => {
        e.preventDefault()
        const ok = await copyToClipboard(text)
        if (!ok) return
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
    </button>
  )
}
