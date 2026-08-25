"use client"

import * as React from "react"
import { Database, MessagesSquare, PanelLeft, Wrench } from "lucide-react"

import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/common/auth-guard"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { KnowledgeQaView } from "./qa-view"

type ModuleId = "qa" | "overview" | "workbench"

const MODULES: Array<{
  id: ModuleId
  label: string
  desc: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}> = [
  {
    id: "qa",
    label: "智能问答",
    desc: "基于公开知识库的检索增强问答",
    icon: MessagesSquare,
  },
  {
    id: "overview",
    label: "知识库总览",
    desc: "浏览分库、元数据与已入库文件",
    icon: Database,
  },
  {
    id: "workbench",
    label: "工作台",
    desc: "上传与维护本人知识文件、处理知识缺口",
    icon: Wrench,
  },
]

function ComingSoon({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{desc}</p>
      <p className="text-muted-foreground/70 mt-2 text-xs">该模块尚未实现</p>
    </div>
  )
}

export default function KnowledgePrototypePage() {
  const [active, setActive] = React.useState<ModuleId>("qa")
  const [expanded, setExpanded] = React.useState(false)

  return (
    <AuthGuard>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-full overflow-hidden">
          {/* 侧边栏：默认折叠，仅显示图标 */}
          <aside
            className={cn(
              "bg-card flex shrink-0 flex-col gap-1 border-r p-2 transition-[width] duration-200",
              expanded ? "w-52" : "w-14"
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={expanded ? "折叠侧边栏" : "展开侧边栏"}
                  aria-expanded={expanded}
                  onClick={() => setExpanded((v) => !v)}
                  className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-10 items-center gap-3 rounded-md px-2.5 transition-colors"
                >
                  <PanelLeft size={18} className="shrink-0" />
                  {expanded && (
                    <span className="truncate text-sm font-medium">
                      知识库原型
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              {!expanded && (
                <TooltipContent side="right">展开侧边栏</TooltipContent>
              )}
            </Tooltip>

            <div className="my-1 border-t" />

            <nav className="flex flex-col gap-1">
              {MODULES.map((mod) => {
                const Icon = mod.icon
                const isActive = active === mod.id
                return (
                  <Tooltip key={mod.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setActive(mod.id)}
                        className={cn(
                          "flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <Icon size={18} className="shrink-0" />
                        {expanded && (
                          <span className="truncate">{mod.label}</span>
                        )}
                      </button>
                    </TooltipTrigger>
                    {!expanded && (
                      <TooltipContent side="right">{mod.label}</TooltipContent>
                    )}
                  </Tooltip>
                )
              })}
            </nav>
          </aside>

          <section className="min-w-0 flex-1 overflow-hidden">
            {active === "qa" && <KnowledgeQaView />}
            {active === "overview" && (
              <ComingSoon
                title="知识库总览"
                desc="用于浏览公开分库、元数据模板与已入库文件。"
              />
            )}
            {active === "workbench" && (
              <ComingSoon
                title="工作台"
                desc="用于上传、重传、删除本人知识文件，并处理知识库缺口。"
              />
            )}
          </section>
        </div>
      </TooltipProvider>
    </AuthGuard>
  )
}
