"use client"

import * as React from "react"
import { ArrowRight, Minus, MousePointer2, Plus, Share2, Sparkles, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

import {
  euclidean,
  type BoardEdge,
  type BoardMode,
  type BoardNode,
  type BoardSelection,
} from "./astar-board"

interface AstarPanelProps {
  nodes: BoardNode[]
  edges: BoardEdge[]
  mode: BoardMode
  onModeChange: (mode: BoardMode) => void
  /** 新建边的默认方向 */
  newEdgeDirected: boolean
  onNewEdgeDirectedChange: (directed: boolean) => void
  snap: boolean
  onSnapChange: (snap: boolean) => void
  selected: BoardSelection | null
  onSelect: (selection: BoardSelection | null) => void
  startId: string
  goalId: string
  onStartChange: (id: string) => void
  onGoalChange: (id: string) => void
  onNodeLabelChange: (id: string, label: string) => void
  onEdgeWeightChange: (id: string, weight: number | null) => void
  onEdgeDirectedChange: (id: string, directed: boolean) => void
  onDeleteSelected: () => void
  onClear: () => void
  onLoadPreset: () => void
  disabled: boolean
}

const MODE_OPTIONS: { value: BoardMode; label: string; icon: React.ElementType }[] = [
  { value: "select", label: "选择", icon: MousePointer2 },
  { value: "node", label: "加点", icon: Plus },
  { value: "edge", label: "连线", icon: Share2 },
]

const MODE_HINTS: Record<BoardMode, string> = {
  select: "单击节点或边进行选中，按住节点可拖动调整坐标。",
  node: "在画板空白处单击创建节点，坐标决定启发函数取值。",
  edge: "依次单击两个节点创建一条边，再次单击已选节点可取消。",
}

export function AstarPanel({
  nodes,
  edges,
  mode,
  onModeChange,
  newEdgeDirected,
  onNewEdgeDirectedChange,
  snap,
  onSnapChange,
  selected,
  onSelect,
  startId,
  goalId,
  onStartChange,
  onGoalChange,
  onNodeLabelChange,
  onEdgeWeightChange,
  onEdgeDirectedChange,
  onDeleteSelected,
  onClear,
  onLoadPreset,
  disabled,
}: AstarPanelProps) {
  // 边权输入允许中间态（空串、"1."），故单独维护草稿
  const [weightDrafts, setWeightDrafts] = React.useState<Record<string, string>>({})

  // 边被删除或画板被清空后丢弃其草稿，避免残留数值
  React.useEffect(() => {
    setWeightDrafts((prev) => {
      const ids = new Set(edges.map((edge) => edge.id))
      const kept = Object.entries(prev).filter(([id]) => ids.has(id))
      return kept.length === Object.keys(prev).length
        ? prev
        : Object.fromEntries(kept)
    })
  }, [edges])

  const nodeMap = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )

  const selectedNode =
    selected?.kind === "node" ? nodeMap.get(selected.id) ?? null : null
  const selectedEdge =
    selected?.kind === "edge"
      ? edges.find((edge) => edge.id === selected.id) ?? null
      : null

  const handleWeightInput = (edge: BoardEdge, raw: string) => {
    setWeightDrafts((prev) => ({ ...prev, [edge.id]: raw }))
    const trimmed = raw.trim()
    if (!trimmed) {
      onEdgeWeightChange(edge.id, null)
      return
    }
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && parsed > 0) onEdgeWeightChange(edge.id, parsed)
  }

  const weightValue = (edge: BoardEdge) =>
    weightDrafts[edge.id] ?? (edge.weight == null ? "" : String(edge.weight))

  return (
    <div className="flex flex-col gap-3">
      {/* 绘制工具 */}
      <section className="rounded-lg border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold">绘制工具</h3>

        <div className="grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon
            return (
              <Button
                key={option.value}
                size="sm"
                variant={mode === option.value ? "default" : "outline"}
                disabled={disabled}
                onClick={() => onModeChange(option.value)}
              >
                <Icon className="size-4" />
                {option.label}
              </Button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{MODE_HINTS[mode]}</p>

        <div className="mt-3 flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">新建边方向</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant={newEdgeDirected ? "outline" : "default"}
              disabled={disabled}
              onClick={() => onNewEdgeDirectedChange(false)}
            >
              <Minus className="size-4" />
              无向
            </Button>
            <Button
              size="sm"
              variant={newEdgeDirected ? "default" : "outline"}
              disabled={disabled}
              onClick={() => onNewEdgeDirectedChange(true)}
            >
              <ArrowRight className="size-4" />
              有向
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Label htmlFor="astar-snap" className="text-sm">
            网格吸附
          </Label>
          <Switch
            id="astar-snap"
            checked={snap}
            disabled={disabled}
            onCheckedChange={onSnapChange}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || !selected}
            onClick={onDeleteSelected}
          >
            <Trash2 className="size-4" />
            删除选中
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || nodes.length === 0}
            onClick={onClear}
          >
            清空画板
          </Button>
        </div>

        <Button
          className="mt-2 w-full"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={onLoadPreset}
        >
          <Sparkles className="size-4" />
          使用预设
        </Button>
      </section>

      {/* 起终点 */}
      <section className="rounded-lg border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold">起点与终点</h3>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
            <Label className="text-sm">起点</Label>
            <Select value={startId} onValueChange={onStartChange} disabled={disabled}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择起点节点" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label && node.label !== node.id
                      ? `${node.id} · ${node.label}`
                      : node.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
            <Label className="text-sm">终点</Label>
            <Select value={goalId} onValueChange={onGoalChange} disabled={disabled}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择终点节点" />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((node) => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label && node.label !== node.id
                      ? `${node.id} · ${node.label}`
                      : node.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* 选中对象属性 */}
      {selectedNode && (
        <section className="rounded-lg border bg-card p-3">
          <h3 className="mb-3 text-sm font-semibold">节点 {selectedNode.id}</h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
              <Label className="text-sm">名称</Label>
              <Input
                value={selectedNode.label}
                disabled={disabled}
                placeholder={selectedNode.id}
                onChange={(event) =>
                  onNodeLabelChange(selectedNode.id, event.target.value)
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              坐标：({selectedNode.x}, {selectedNode.y})
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onStartChange(selectedNode.id)}
              >
                设为起点
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onGoalChange(selectedNode.id)}
              >
                设为终点
              </Button>
            </div>
          </div>
        </section>
      )}

      {selectedEdge && (
        <section className="rounded-lg border bg-card p-3">
          <h3 className="mb-3 text-sm font-semibold">
            边 {selectedEdge.source} {selectedEdge.directed ? "→" : "—"}{" "}
            {selectedEdge.target}
          </h3>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
              <Label className="text-sm">边权</Label>
              <Input
                type="number"
                min={0}
                step="any"
                disabled={disabled}
                placeholder="留空则按欧氏距离"
                value={weightValue(selectedEdge)}
                onChange={(event) => handleWeightInput(selectedEdge, event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={selectedEdge.directed ? "outline" : "default"}
                disabled={disabled}
                onClick={() => onEdgeDirectedChange(selectedEdge.id, false)}
              >
                无向
              </Button>
              <Button
                size="sm"
                variant={selectedEdge.directed ? "default" : "outline"}
                disabled={disabled}
                onClick={() => onEdgeDirectedChange(selectedEdge.id, true)}
              >
                有向
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* 全部边的权重速览 */}
      {edges.length > 0 && (
        <section className="rounded-lg border bg-card p-3">
          <h3 className="mb-1 text-sm font-semibold">边权设置</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            留空表示使用两端坐标的欧氏距离
          </p>
          <div className="flex flex-col gap-2">
            {edges.map((edge) => {
              const source = nodeMap.get(edge.source)
              const target = nodeMap.get(edge.target)
              const fallback =
                source && target ? euclidean(source, target).toFixed(2) : "—"
              return (
                <div
                  key={edge.id}
                  className="grid grid-cols-[1fr_6rem] items-center gap-2"
                >
                  <button
                    type="button"
                    className={`truncate rounded px-1 py-1 text-left text-sm transition-colors hover:bg-accent ${
                      selected?.kind === "edge" && selected.id === edge.id
                        ? "bg-accent font-medium"
                        : ""
                    }`}
                    onClick={() => onSelect({ kind: "edge", id: edge.id })}
                  >
                    {edge.source} {edge.directed ? "→" : "—"} {edge.target}
                  </button>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    className="h-8"
                    disabled={disabled}
                    placeholder={fallback}
                    value={weightValue(edge)}
                    onChange={(event) => handleWeightInput(edge, event.target.value)}
                  />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {nodes.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          先在右侧画板绘制节点与边，再回到这里指定起终点。
        </p>
      )}
    </div>
  )
}
