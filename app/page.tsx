import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  Search,
  FilePlus,
  Mail,
  Database,
  ArrowUpRight,
  Sparkles,
  DatabaseSearch,
  FlaskConical,
} from "lucide-react"

const features = [
  {
    href: "/chat",
    title: "AI对话",
    description: "与多种大模型进行流式对话，支持历史会话管理与图像生成。",
    icon: MessageSquare,
    badge: "对话",
  },
  {
    href: "/search",
    title: "集成搜索",
    description: "多源聚合搜索，快速获取信息并整合结果。",
    icon: Search,
    badge: "搜索",
  },
  {
    href: "/articles",
    title: "新增文章",
    description: "通过 URL 抓取文章内容，AI 辅助生成摘要与关键词。",
    icon: FilePlus,
    badge: "文章",
  },
  {
    href: "/mail",
    title: "发送邮件",
    description: "编辑邮件内容，选择文章组合，一键发送。",
    icon: Mail,
    badge: "邮件",
  },
  {
    href: "/database",
    title: "历史数据查询",
    description: "按多维度筛选已收录文章，生成结论与导出。",
    icon: DatabaseSearch,
    badge: "查询",
  },
  {
    href: "/knowledge",
    title: "知识库",
    description: "构建个人知识库，支持多种数据源的接入与管理。",
    icon: Database,
    badge: "知识",
  },
  {
    href: "/demo",
    title: "机器学习演示",
    description: "在线配置参数训练模型，实时查看预测指标、结果图并导出数据。",
    icon: FlaskConical,
    badge: "演示",
  }
]

export default function Home() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* 背景装饰：柔和径向渐变，增加层次感但不喧宾夺主 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 0%, oklch(0.9 0 0), transparent 80%)",
        }}
      />

      {/* 标题区 */}
      <div className="w-full max-w-5xl flex flex-col items-center text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground mb-4 shadow-xs">
          <Sparkles size={12} />
          工业智能 · 效率工具集
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          AI应用平台-持续建设中
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          集成 AI 对话、搜索、文章管理、邮件推送与资料库的一站式工作台。
        </p>
      </div>

      {/* 功能卡片网格 */}
      <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature) => {
          const Icon = feature.icon
          return (
            <Link key={feature.href} href={feature.href} target="_blank" className="group">
              <Card className="h-full hover:shadow-md hover:border-foreground/20 transition-all">
                <CardContent className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-center size-10 rounded-lg bg-primary text-primary-foreground">
                      <Icon size={20} />
                    </div>
                    <Badge variant="secondary">{feature.badge}</Badge>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    打开
                    <ArrowUpRight size={14} className="ml-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}