"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { BookOpen, FileText, List } from "lucide-react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils"
import { getDoc, getDocList, type DocItem } from "@/features/docs/api"
import { DocMarkdown } from "./doc-markdown"
import { extractHeadings, type HeadingItem } from "./markdown-utils"

const WELCOME_DOC_NAME = "欢迎页"

/**
 * 根据来源路由挑选默认文档：
 * docs_desc === from 命中对应功能文档，否则回退到欢迎页（目录页）。
 */
function pickDefaultDoc(docs: DocItem[], from: string | null): DocItem | null {
  if (docs.length === 0) return null

  if (from && from !== "/") {
    const matched = docs.find((doc) => doc.docs_desc === from)
    if (matched) return matched
  }

  const welcome = docs.find((doc) => doc.docs_name === WELCOME_DOC_NAME)
  return welcome ?? docs[0]
}

export function DocsView() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from")

  const [docs, setDocs] = React.useState<DocItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [activeHeadingId, setActiveHeadingId] = React.useState<string>("")

  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const res = await getDocList()
        if (cancelled) return
        const list = res?.data ?? []
        setDocs(list)
        setActiveId((prev) => prev ?? pickDefaultDoc(list, from)?.id ?? null)
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error("获取教学文档失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // 仅在挂载与来源变化时重新选择默认文档
  }, [from])

  const activeDoc = React.useMemo(
    () => docs.find((doc) => doc.id === activeId) ?? null,
    [docs, activeId]
  )

  // 左侧清单：欢迎页固定置顶，其余保持接口返回顺序
  const orderedDocs = React.useMemo(() => {
    const welcome = docs.filter((doc) => doc.docs_name === WELCOME_DOC_NAME)
    const rest = docs.filter((doc) => doc.docs_name !== WELCOME_DOC_NAME)
    return [...welcome, ...rest]
  }, [docs])

  const headings = React.useMemo<HeadingItem[]>(
    () => extractHeadings(activeDoc?.content ?? ""),
    [activeDoc?.content]
  )

  // 切换文档时回到顶部
  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
    setActiveHeadingId("")
  }, [activeId])

  // 选择文档：立即展示缓存内容，同时拉取最新正文（数据库可能已更新）
  const selectDoc = React.useCallback(async (id: string) => {
    setActiveId(id)
    try {
      const res = await getDoc(id)
      const fresh = res?.data
      if (fresh) {
        setDocs((prev) => prev.map((doc) => (doc.id === id ? fresh : doc)))
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  // 为渲染出的标题按顺序赋锚点 id（与目录一致），并设置滚动高亮
  React.useEffect(() => {
    const root = contentRef.current
    if (!root) return

    // Markdown 渲染完成后，按文档顺序把目录 id 写回真实标题元素
    const headingEls = Array.from(
      root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")
    )
    headingEls.forEach((el, i) => {
      if (headings[i]) el.id = headings[i].id
    })

    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) {
          setActiveHeadingId(visible[0].target.id)
        }
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    )

    for (const heading of headings) {
      const el = root.querySelector(`#${CSS.escape(heading.id)}`)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [headings])

  const handleTocClick = (id: string) => {
    const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      setActiveHeadingId(id)
    }
  }

  return (
    <div className="h-full p-4">
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
        {/* 左侧：文档清单 */}
        <ResizablePanel defaultSize={20} minSize={14}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <BookOpen size={16} />
              <h2 className="text-sm font-semibold">文档清单</h2>
            </div>
            <nav className="min-h-0 flex-1 overflow-auto p-2">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-9 animate-pulse rounded-md bg-muted/60" />
                  ))}
                </div>
              ) : docs.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">暂无教学文档</p>
              ) : (
                <ul className="space-y-1">
                  {orderedDocs.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => selectDoc(doc.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                          doc.id === activeId
                            ? "bg-accent text-accent-foreground font-medium"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                      >
                        <FileText size={14} className="shrink-0" />
                        <span className="truncate">{doc.docs_name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 中间：文档正文 */}
        <ResizablePanel defaultSize={56} minSize={40}>
          <div ref={contentRef} className="h-full overflow-auto">
            {loading ? (
              <div className="space-y-3 p-8">
                <div className="h-8 w-1/3 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-muted/60" />
                <div className="h-4 w-4/6 animate-pulse rounded bg-muted/60" />
              </div>
            ) : activeDoc ? (
              <article className="mx-auto max-w-3xl px-8 py-6">
                {activeDoc.docs_desc && activeDoc.docs_name !== WELCOME_DOC_NAME && (
                  <p className="mb-2 text-xs text-muted-foreground">{activeDoc.docs_desc}</p>
                )}
                <DocMarkdown content={activeDoc.content ?? ""} />
              </article>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                请选择左侧文档查看
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：当前文档目录 */}
        <ResizablePanel defaultSize={24} minSize={14}>
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <List size={16} />
              <h2 className="text-sm font-semibold">目录</h2>
            </div>
            <nav className="min-h-0 flex-1 overflow-auto p-3">
              {headings.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">当前文档暂无目录</p>
              ) : (
                <ul className="space-y-0.5 border-l border-border">
                  {headings.map((heading) => (
                    <li key={heading.id}>
                      <button
                        type="button"
                        onClick={() => handleTocClick(heading.id)}
                        className={cn(
                          "-ml-px block w-full border-l-2 py-1 pr-2 text-left text-xs leading-snug transition-colors",
                          heading.id === activeHeadingId
                            ? "border-primary text-foreground font-medium"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                        style={{ paddingLeft: `${(heading.level - 1) * 12 + 12}px` }}
                        title={heading.text}
                      >
                        <span className="line-clamp-2">{heading.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </nav>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
