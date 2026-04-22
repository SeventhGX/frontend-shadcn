"use client"
import { useState } from "react"
import { Check, Copy } from "lucide-react"

export function CopyButton({ text, className }: { text: string, className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className={className}
      title="复制 Markdown 源码"
      onClick={async (e) => {
        e.preventDefault()
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
    >
      {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
    </button>
  )
}
