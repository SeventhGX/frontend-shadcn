"use client"

import { useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Search,
  FilePlus,
  Mail,
  DatabaseSearch,
  Database,
  ArrowUpRight,
  Sparkles,
  FlaskConical,
  LayoutGrid,
  Bot,
  FileText,
  Wrench,
  Plus,
} from "lucide-react"

type IconType = ComponentType<{ size?: number; className?: string }>

type FeatureCategory = "ai" | "content" | "tools"

type Feature = {
  href: string
  title: string
  description: string
  icon: IconType
  category: FeatureCategory
}

const categoryMeta: { id: "all" | FeatureCategory; label: string; icon: IconType }[] = [
  { id: "all", label: "全部", icon: LayoutGrid },
  { id: "ai", label: "AI 助手", icon: Bot },
  { id: "content", label: "内容中心", icon: FileText },
  { id: "tools", label: "实用工具", icon: Wrench },
]

const features: Feature[] = [
  {
    href: "/chat",
    title: "AI 对话",
    description: "与多种大模型进行流式对话，支持历史会话管理与图像生成。",
    icon: MessageSquare,
    category: "ai",
  },
  {
    href: "/search",
    title: "集成搜索",
    description: "多源聚合搜索，快速获取信息并整合结果。",
    icon: Search,
    category: "ai",
  },
  {
    href: "/articles",
    title: "新增文章",
    description: "通过 URL 抓取文章内容，AI 辅助生成摘要与关键词。",
    icon: FilePlus,
    category: "content",
  },
  {
    href: "/database",
    title: "历史数据查询",
    description: "按多维度筛选已收录文章，生成结论与导出。",
    icon: DatabaseSearch,
    category: "content",
  },
  {
    href: "/knowledge",
    title: "知识库",
    description: "构建个人知识库，支持多种数据源的接入与管理。",
    icon: Database,
    category: "content",
  },
  {
    href: "/mail",
    title: "发送邮件",
    description: "编辑邮件内容，选择文章组合，一键发送。",
    icon: Mail,
    category: "tools",
  },
  {
    href: "/demo",
    title: "机器学习演示",
    description: "在线配置参数训练模型，实时查看预测指标、结果图并导出数据。",
    icon: FlaskConical,
    category: "tools",
  },
]

const categoryLabel = (c: FeatureCategory) =>
  categoryMeta.find((m) => m.id === c)?.label ?? ""

export default function Home() {
  const [query, setQuery] = useState("")
  const [active, setActive] = useState<"all" | FeatureCategory>("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return features.filter((f) => {
      const matchCat = active === "all" || f.category === active
      const matchQuery =
        !q ||
        f.title.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q) ||
        categoryLabel(f.category).toLowerCase().includes(q)
      return matchCat && matchQuery
    })
  }, [query, active])

  const showPlaceholder = active === "all" && !query.trim()

  return (
    <div className="relative min-h-full w-full flex flex-col items-center px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* 背景装饰：极淡中性径向渐变，增加层次感但不引入彩色 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--muted) 60%, transparent), transparent 80%)",
        }}
      />

      {/* 标题区 */}
      <div className="w-full max-w-6xl flex flex-col items-center text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-5 shadow-xs">
          <Sparkles size={12} />
          工业智能 · 效率工具集
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          AI 应用平台
          <span className="ml-3 align-middle inline-flex items-center gap-1.5 text-xs font-medium rounded-full border bg-background px-2.5 py-1 text-muted-foreground">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-foreground/40 animate-ping" />
              <span className="relative inline-flex rounded-full size-1.5 bg-foreground/60" />
            </span>
            持续建设中
          </span>
        </h1>

        <p className="text-muted-foreground max-w-2xl mb-6">
          集成多种AI应用的一站式工作台，让日常工作更高效。
        </p>

        {/* 统计 */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{features.length}</span> 个工具
          <span className="text-border">·</span>
          <span className="font-medium text-foreground">{categoryMeta.length - 1}</span> 个分类
        </div>
      </div>

      {/* 搜索 + 分类筛选 */}
      <div className="w-full max-w-6xl flex flex-col items-center gap-4 mb-8">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索功能名称或关键词…"
            aria-label="搜索功能"
            className="pl-9 h-10 rounded-full bg-background/80 backdrop-blur"
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {categoryMeta.map((cat) => {
            const CatIcon = cat.icon
            const isActive = active === cat.id
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActive(cat.id)}
                aria-pressed={isActive}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background/70 text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                <CatIcon size={13} />
                {cat.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 功能卡片网格 */}
      <div className="w-full max-w-6xl">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <Search className="size-8 mb-3 opacity-40" />
            <p className="text-sm">没有找到匹配的功能，换个关键词试试。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filtered.map((feature) => {
              const Icon = feature.icon
              return (
                <Link
                  key={feature.href}
                  href={feature.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group h-full"
                >
                  <Card className="relative h-full overflow-hidden hover:-translate-y-1 hover:shadow-lg hover:border-foreground/20 transition-all duration-300">
                    <CardContent className="flex flex-col gap-4 h-full">
                      <div className="flex items-center justify-between">
                        {/* 经典 shadcn 黑白交互：默认 muted，hover 反转为 primary */}
                        <div className="flex items-center justify-center size-11 rounded-xl bg-muted text-muted-foreground transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                          <Icon size={20} />
                        </div>
                        <Badge variant="outline" className="font-normal">
                          {categoryLabel(feature.category)}
                        </Badge>
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>

                      <div className="flex items-center text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                        进入
                        <ArrowUpRight
                          size={14}
                          className="ml-1 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}

            {/* 扩展占位卡：表达平台持续演进 */}
            {showPlaceholder && (
              <div className="relative h-full rounded-xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground/70">
                <div className="flex items-center justify-center size-11 rounded-xl bg-muted">
                  <Plus size={20} />
                </div>
                <p className="text-sm font-medium">更多功能开发中</p>
                <p className="text-xs">平台持续迭代演进</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 页脚 */}
      <footer className="w-full max-w-6xl mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
        工业智能 · 效率工具集 — 持续建设中
      </footer>
    </div>
  )
}