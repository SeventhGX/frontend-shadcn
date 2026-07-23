"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { fetchDocImageObjectUrl } from "@/features/docs/api"

/**
 * 文档内图片：接口需要 Bearer Token，无法直接用 <img src>，
 * 统一通过鉴权 fetch 拉取 Blob 再转 ObjectURL 显示。
 */
function AuthImage({ src, alt }: { src?: string; alt?: string }) {
  const [objectUrl, setObjectUrl] = React.useState<string>("")
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!src) return

    let cancelled = false
    let createdUrl = ""

    setError(false)
    setObjectUrl("")

    fetchDocImageObjectUrl(src)
      .then((url) => {
        if (cancelled) {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url)
          return
        }
        createdUrl = url
        setObjectUrl(url)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
      if (createdUrl.startsWith("blob:")) URL.revokeObjectURL(createdUrl)
    }
  }, [src])

  if (error) {
    return (
      <span className="my-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
        <ImageOff size={14} />
        图片加载失败
      </span>
    )
  }

  if (!objectUrl) {
    return (
      <span className="my-2 inline-flex h-24 w-40 animate-pulse items-center justify-center rounded-md border border-border bg-muted/40 text-xs text-muted-foreground">
        图片加载中…
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={objectUrl} alt={alt ?? ""} className="my-2 max-w-full rounded-md border border-border" />
  )
}

interface DocMarkdownProps {
  content: string
  className?: string
}

/**
 * 教学文档正文渲染：Markdown + 鉴权图片。
 * 标题锚点 id 由 docs-view 在渲染后按顺序统一赋予，
 * 与 extractHeadings 的目录保持一致，避免渲染期副作用导致不一致。
 */
export function DocMarkdown({ content, className }: DocMarkdownProps) {
  return (
    <div className={cn("markdown-body wrap-break-word text-sm", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className="scroll-mt-4 text-2xl font-bold mt-4 mb-3 pb-1 border-b border-border">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="scroll-mt-4 text-xl font-semibold mt-4 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="scroll-mt-4 text-lg font-semibold mt-3 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="scroll-mt-4 text-base font-semibold mt-2 mb-1">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="scroll-mt-4 text-sm font-semibold mt-2 mb-1">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="scroll-mt-4 text-sm font-semibold text-muted-foreground mt-2 mb-1">
              {children}
            </h6>
          ),
          p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
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
          img: ({ src, alt }) => (
            <AuthImage src={typeof src === "string" ? src : undefined} alt={alt} />
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName
            if (isInline) {
              return (
                <code
                  className="px-1 py-0.5 rounded bg-muted text-[0.85em] font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={cn("font-mono text-[0.85em]", codeClassName)} {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-3 p-3 rounded-md bg-muted overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 pl-3 border-l-2 border-border text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 bg-muted font-medium text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top">{children}</td>
          ),
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
