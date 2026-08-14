"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Route,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  downloadResultFile,
  solveAstar,
  type AstarEdgeInput,
  type AstarOpenEntry,
  type AstarSolveResult,
} from "@/features/demo/api"

import {
  AstarBoard,
  BOARD_COLOR,
  euclidean,
  type BoardAnimation,
  type BoardEdge,
  type BoardMode,
  type BoardNode,
  type BoardSelection,
} from "./astar-board"
import { AstarPanel } from "./astar-panel"

/** 无向边在有向图中会被拆成两条，反向边 ID 追加该后缀 */
const REVERSE_SUFFIX = "__rev"

const PLAY_SPEEDS = ["0.5", "1", "2", "4"]

const LEGEND: { color: string; label: string }[] = [
  { color: BOARD_COLOR.start, label: "起点" },
  { color: BOARD_COLOR.goal, label: "终点" },
  { color: BOARD_COLOR.current, label: "当前节点" },
  { color: BOARD_COLOR.open, label: "开放集合" },
  { color: BOARD_COLOR.closed, label: "已探索" },
  { color: BOARD_COLOR.accepted, label: "接受的邻边" },
  { color: BOARD_COLOR.rejected, label: "放弃的邻边" },
]

interface PresetEdge {
  source: string
  target: string
  /** 省略时按两端欧氏距离计算 */
  weight?: number
  directed?: boolean
}

/** 预设路网：14 个路口、25 条道路，含两条单行道与若干拥堵路段（自定义边权） */
const PRESET_NODES: BoardNode[] = [
  { id: "N1", label: "西门", x: 1, y: 8 },
  { id: "N2", label: "", x: 5, y: 13 },
  { id: "N3", label: "", x: 5, y: 8 },
  { id: "N4", label: "", x: 5, y: 3 },
  { id: "N5", label: "", x: 10, y: 15 },
  { id: "N6", label: "中心广场", x: 10, y: 10 },
  { id: "N7", label: "", x: 10, y: 5 },
  { id: "N8", label: "", x: 14, y: 13 },
  { id: "N9", label: "", x: 14, y: 6 },
  { id: "N10", label: "", x: 18, y: 15 },
  { id: "N11", label: "", x: 18, y: 9 },
  { id: "N12", label: "", x: 18, y: 3 },
  { id: "N13", label: "", x: 22, y: 12 },
  { id: "N14", label: "东门", x: 25, y: 8 },
]

const PRESET_EDGES: PresetEdge[] = [
  { source: "N1", target: "N2" },
  { source: "N1", target: "N3", weight: 6 },
  { source: "N1", target: "N4" },
  { source: "N2", target: "N3" },
  { source: "N2", target: "N5" },
  { source: "N3", target: "N4" },
  { source: "N3", target: "N6" },
  { source: "N4", target: "N7" },
  { source: "N5", target: "N6" },
  { source: "N5", target: "N8" },
  { source: "N6", target: "N7" },
  { source: "N6", target: "N8" },
  { source: "N6", target: "N9", weight: 9 },
  { source: "N7", target: "N9" },
  { source: "N7", target: "N12", weight: 10 },
  { source: "N8", target: "N10" },
  { source: "N8", target: "N11", weight: 7 },
  { source: "N9", target: "N11", weight: 6 },
  { source: "N9", target: "N12" },
  { source: "N10", target: "N11" },
  { source: "N10", target: "N13", directed: true },
  { source: "N11", target: "N12" },
  { source: "N11", target: "N13" },
  { source: "N12", target: "N14", weight: 11, directed: true },
  { source: "N13", target: "N14" },
]

const PRESET_START = "N1"
const PRESET_GOAL = "N14"

/** 反向边回落到原始边，供高亮时定位画板上的同一条线 */
function baseEdgeId(id: string): string {
  return id.endsWith(REVERSE_SUFFIX) ? id.slice(0, -REVERSE_SUFFIX.length) : id
}

function nextId(prefix: string, used: Set<string>): string {
  let index = 1
  while (used.has(`${prefix}${index}`)) index++
  return `${prefix}${index}`
}

interface AstarViewProps {
  /** 左侧面板顶部内容（页面标题与 Demo 选择器） */
  header: React.ReactNode
}

export function AstarView({ header }: AstarViewProps) {
  const [nodes, setNodes] = React.useState<BoardNode[]>([])
  const [edges, setEdges] = React.useState<BoardEdge[]>([])
  const [mode, setMode] = React.useState<BoardMode>("node")
  const [newEdgeDirected, setNewEdgeDirected] = React.useState(false)
  const [snap, setSnap] = React.useState(true)
  const [selected, setSelected] = React.useState<BoardSelection | null>(null)
  const [pendingSource, setPendingSource] = React.useState("")
  const [startId, setStartId] = React.useState("")
  const [goalId, setGoalId] = React.useState("")

  const [solving, setSolving] = React.useState(false)
  const [result, setResult] = React.useState<AstarSolveResult | null>(null)
  const [frame, setFrame] = React.useState(0)
  const [playing, setPlaying] = React.useState(false)
  const [speed, setSpeed] = React.useState("1")

  // 边 ID 只增不复用，避免删除或清空后新边沿用旧 ID 而继承遗留状态
  const edgeSeq = React.useRef(0)

  // 图结构一旦变动，已有的求解结果与动画即失效
  const resetResult = React.useCallback(() => {
    setResult(null)
    setFrame(0)
    setPlaying(false)
  }, [])

  const totalFrames = result ? result.steps.length + 1 : 0

  React.useEffect(() => {
    if (!playing || !result) return
    if (frame >= totalFrames - 1) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(
      () => setFrame((prev) => Math.min(prev + 1, totalFrames - 1)),
      900 / Number(speed)
    )
    return () => clearTimeout(timer)
  }, [playing, frame, result, totalFrames, speed])

  const animation = React.useMemo<BoardAnimation | null>(() => {
    if (!result) return null
    const isFinal = frame >= result.steps.length
    const step = isFinal ? result.steps.at(-1) : result.steps[frame]

    const closed = new Set<string>(step?.closed_set ?? [])
    const open = new Map<string, AstarOpenEntry>()
    if (!isFinal) {
      for (const entry of step?.open_set ?? []) open.set(entry.node_id, entry)
    }

    const neighborEdges = new Map<string, boolean>()
    if (!isFinal) {
      for (const neighbor of step?.neighbors ?? []) {
        neighborEdges.set(baseEdgeId(neighbor.edge_id), neighbor.accepted)
      }
    }

    return {
      closed,
      open,
      currentId: isFinal ? "" : (step?.current_id ?? ""),
      neighborEdges,
      pathNodes: isFinal ? new Set(result.path ?? []) : new Set<string>(),
      pathEdges: isFinal
        ? new Set((result.path_edge_ids ?? []).map(baseEdgeId))
        : new Set<string>(),
    }
  }, [result, frame])

  const handleCanvasClick = (x: number, y: number) => {
    if (solving) return
    if (mode !== "node") {
      setSelected(null)
      setPendingSource("")
      return
    }
    // 同一格已有节点时不重复创建
    if (nodes.some((node) => Math.hypot(node.x - x, node.y - y) < 0.4)) return

    const id = nextId("N", new Set(nodes.map((node) => node.id)))
    setNodes((prev) => [...prev, { id, label: "", x, y }])
    setSelected({ kind: "node", id })
    resetResult()
  }

  const handleNodeClick = (id: string) => {
    if (solving) return
    if (mode !== "edge") {
      setSelected({ kind: "node", id })
      return
    }
    if (!pendingSource) {
      setPendingSource(id)
      return
    }
    if (pendingSource === id) {
      setPendingSource("")
      return
    }
    const exists = edges.some(
      (edge) =>
        (edge.source === pendingSource && edge.target === id) ||
        (!edge.directed && edge.source === id && edge.target === pendingSource)
    )
    if (exists) {
      toast.info("两点之间已存在同向的边")
      setPendingSource("")
      return
    }
    const edgeId = `E${++edgeSeq.current}`
    setEdges((prev) => [
      ...prev,
      {
        id: edgeId,
        source: pendingSource,
        target: id,
        weight: null,
        directed: newEdgeDirected,
      },
    ])
    setPendingSource("")
    setSelected({ kind: "edge", id: edgeId })
    resetResult()
  }

  const handleEdgeClick = (id: string) => {
    if (solving) return
    setSelected({ kind: "edge", id })
  }

  const handleNodeMove = (id: string, x: number, y: number) => {
    if (solving) return
    setNodes((prev) =>
      prev.map((node) => (node.id === id ? { ...node, x, y } : node))
    )
    resetResult()
  }

  const handleNodeLabelChange = (id: string, label: string) => {
    setNodes((prev) => prev.map((node) => (node.id === id ? { ...node, label } : node)))
  }

  const handleEdgeWeightChange = (id: string, weight: number | null) => {
    setEdges((prev) => prev.map((edge) => (edge.id === id ? { ...edge, weight } : edge)))
    resetResult()
  }

  const handleEdgeDirectedChange = (id: string, directed: boolean) => {
    setEdges((prev) =>
      prev.map((edge) => (edge.id === id ? { ...edge, directed } : edge))
    )
    resetResult()
  }

  const handleDeleteSelected = React.useCallback(() => {
    if (!selected) return
    if (selected.kind === "edge") {
      setEdges((prev) => prev.filter((edge) => edge.id !== selected.id))
    } else {
      setNodes((prev) => prev.filter((node) => node.id !== selected.id))
      setEdges((prev) =>
        prev.filter(
          (edge) => edge.source !== selected.id && edge.target !== selected.id
        )
      )
      if (startId === selected.id) setStartId("")
      if (goalId === selected.id) setGoalId("")
    }
    setSelected(null)
    resetResult()
  }, [selected, startId, goalId, resetResult])

  const handleClear = () => {
    setNodes([])
    setEdges([])
    setSelected(null)
    setPendingSource("")
    setStartId("")
    setGoalId("")
    resetResult()
  }

  const handleLoadPreset = () => {
    setNodes(PRESET_NODES.map((node) => ({ ...node })))
    setEdges(
      PRESET_EDGES.map((edge) => ({
        id: `E${++edgeSeq.current}`,
        source: edge.source,
        target: edge.target,
        weight: edge.weight ?? null,
        directed: edge.directed ?? false,
      }))
    )
    setSelected(null)
    setPendingSource("")
    setStartId(PRESET_START)
    setGoalId(PRESET_GOAL)
    setMode("select")
    resetResult()
  }

  // 选中节点或边时支持 Delete / Backspace 快捷删除
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return
      const target = event.target as HTMLElement | null
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return
      if (target?.isContentEditable) return
      if (!selected || solving) return
      event.preventDefault()
      handleDeleteSelected()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selected, solving, handleDeleteSelected])

  const handleSolve = async () => {
    if (nodes.length === 0) {
      toast.error("请先在画板上绘制节点")
      return
    }
    if (!startId || !goalId) {
      toast.error("请先指定起点与终点")
      return
    }
    if (startId === goalId) {
      toast.error("起点与终点不能相同")
      return
    }

    const start = nodes.find((node) => node.id === startId)
    const goal = nodes.find((node) => node.id === goalId)
    if (!start || !goal) {
      toast.error("起点或终点已不存在，请重新指定")
      return
    }

    const isolated = [start, goal].filter(
      (node) =>
        !edges.some((edge) => edge.source === node.id || edge.target === node.id)
    )
    if (isolated.length > 0) {
      toast.error(
        `节点 ${isolated.map((node) => node.id).join("、")} 尚未连接任何边，请先连线后再求解`
      )
      return
    }

    // 后端按整图区分有无向，混合场景下把无向边展开为双向边
    const directed = edges.some((edge) => edge.directed)
    const payloadEdges: AstarEdgeInput[] = edges.flatMap((edge) => {
      const base: AstarEdgeInput = {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        weight: edge.weight,
      }
      if (!directed || edge.directed) return [base]
      return [
        base,
        {
          id: `${edge.id}${REVERSE_SUFFIX}`,
          source: edge.target,
          target: edge.source,
          weight: edge.weight,
        },
      ]
    })

    try {
      setSolving(true)
      setPlaying(false)
      setResult(null)
      const data = await solveAstar({
        nodes: nodes.map((node) => ({
          id: node.id,
          label: node.label || null,
          x: node.x,
          y: node.y,
        })),
        edges: payloadEdges,
        start_id: startId,
        goal_id: goalId,
        directed,
        start_to_goal_distance: euclidean(start, goal),
      })
      setResult(data)
      setFrame(0)
      if (data.metrics.found) {
        toast.success("求解完成，可播放探索过程")
        setPlaying(true)
      } else {
        toast.warning("终点不可达，仍可回看探索过程")
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "求解失败，请检查图结构")
    } finally {
      setSolving(false)
    }
  }

  const handleDownload = async (kind: "csv" | "excel") => {
    if (!result) return
    try {
      await downloadResultFile(
        result.links[kind],
        `astar-${result.result_id}.${kind === "csv" ? "csv" : "xlsx"}`
      )
    } catch (error) {
      console.error(error)
      toast.error(`下载 ${kind === "csv" ? "CSV" : "Excel"} 失败`)
    }
  }

  const currentStep =
    result && frame < result.steps.length ? result.steps[frame] : null

  return (
    <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
      {/* 左侧：画板设置区 */}
      <ResizablePanel defaultSize={25} minSize={20}>
        <div className="flex h-full flex-col gap-3 p-4">
          {header}

          <div className="min-h-0 flex-1 overflow-auto pr-1">
            <AstarPanel
              nodes={nodes}
              edges={edges}
              mode={mode}
              onModeChange={setMode}
              newEdgeDirected={newEdgeDirected}
              onNewEdgeDirectedChange={setNewEdgeDirected}
              snap={snap}
              onSnapChange={setSnap}
              selected={selected}
              onSelect={setSelected}
              startId={startId}
              goalId={goalId}
              onStartChange={(id) => {
                setStartId(id)
                resetResult()
              }}
              onGoalChange={(id) => {
                setGoalId(id)
                resetResult()
              }}
              onNodeLabelChange={handleNodeLabelChange}
              onEdgeWeightChange={handleEdgeWeightChange}
              onEdgeDirectedChange={handleEdgeDirectedChange}
              onDeleteSelected={handleDeleteSelected}
              onClear={handleClear}
              onLoadPreset={handleLoadPreset}
              disabled={solving}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSolve}
            disabled={solving || nodes.length === 0 || !startId || !goalId}
          >
            {solving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                求解中…
              </>
            ) : (
              <>
                <Route className="size-4" />
                开始求解
              </>
            )}
          </Button>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* 右侧：画板与求解演示 */}
      <ResizablePanel defaultSize={75} minSize={40}>
        <div className="flex h-full flex-col gap-3 p-4">
          {result && <AstarMetrics result={result} onDownload={handleDownload} />}

          {/* 图例 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {LEGEND.map((item) => (
              <span
                key={item.label}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30 p-1">
            <AstarBoard
              nodes={nodes}
              edges={edges}
              mode={mode}
              snap={snap}
              selected={selected}
              pendingSource={pendingSource}
              startId={startId}
              goalId={goalId}
              animation={animation}
              locked={solving}
              onCanvasClick={handleCanvasClick}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onNodeMove={handleNodeMove}
            />
          </div>

          {result ? (
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFrame(0)
                    setPlaying(false)
                  }}
                >
                  <RotateCcw className="size-4" />
                  重置
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={frame === 0}
                  onClick={() => {
                    setPlaying(false)
                    setFrame((prev) => Math.max(0, prev - 1))
                  }}
                >
                  <ChevronLeft className="size-4" />
                  上一步
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (frame >= totalFrames - 1) setFrame(0)
                    setPlaying((prev) => !prev)
                  }}
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {playing ? "暂停" : "播放"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={frame >= totalFrames - 1}
                  onClick={() => {
                    setPlaying(false)
                    setFrame((prev) => Math.min(totalFrames - 1, prev + 1))
                  }}
                >
                  下一步
                  <ChevronRight className="size-4" />
                </Button>

                <div className="ml-auto flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">速度</Label>
                  <Select value={speed} onValueChange={setSpeed}>
                    <SelectTrigger size="sm" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAY_SPEEDS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Slider
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  step={1}
                  value={[frame]}
                  onValueChange={([value]) => {
                    setPlaying(false)
                    setFrame(value)
                  }}
                />
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {Math.min(frame + 1, totalFrames)} / {totalFrames}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {currentStep
                  ? `第 ${currentStep.iteration + 1} 轮 · 当前节点 ${currentStep.current_id} · 开放集合 ${currentStep.open_set.length} 个 · 已探索 ${currentStep.closed_set.length} 个`
                  : result.metrics.found
                    ? `最终路径：${(result.path ?? []).join(" → ")}`
                    : "终点不可达，未找到可行路径"}
              </p>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground">
              绘制图网络并指定起终点后开始求解，求解步骤将在画板上循环演示
            </p>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

interface AstarMetricsProps {
  result: AstarSolveResult
  onDownload: (kind: "csv" | "excel") => void
}

/** 不可达时后端部分指标可能缺失，统一兜底避免调用 toFixed 崩溃 */
function formatMetric(value: number | null | undefined, digits: number): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "—"
}

/** 求解指标卡片与结果下载 */
function AstarMetrics({ result, onDownload }: AstarMetricsProps) {
  const { metrics } = result
  const fields: { label: string; value: string }[] = [
    { label: "是否可达", value: metrics.found ? "是" : "否" },
    { label: "路径代价", value: formatMetric(metrics.path_cost, 3) },
    {
      label: "路径直线长度",
      value: formatMetric(metrics.path_euclidean_distance, 3),
    },
    { label: "启发缩放系数", value: formatMetric(metrics.heuristic_scale, 3) },
    { label: "探索节点数", value: String(metrics.explored_nodes ?? "—") },
    { label: "迭代步数", value: String(metrics.step_count ?? "—") },
    { label: "节点数", value: String(metrics.node_count ?? "—") },
    { label: "边数", value: String(metrics.edge_count ?? "—") },
    {
      label: "求解耗时",
      value:
        typeof metrics.solve_seconds === "number" &&
        Number.isFinite(metrics.solve_seconds)
          ? `${(metrics.solve_seconds * 1000).toFixed(2)} ms`
          : "—",
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
        {fields.map((field) => (
          <div key={field.label} className="rounded-lg border bg-card p-2">
            <p className="truncate text-xs text-muted-foreground">{field.label}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{field.value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onDownload("csv")}>
          <FileText className="size-4" />
          下载 CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDownload("excel")}>
          <FileSpreadsheet className="size-4" />
          下载 Excel
        </Button>
      </div>
    </div>
  )
}
