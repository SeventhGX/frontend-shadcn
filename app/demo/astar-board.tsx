"use client"

import * as React from "react"

import type { AstarOpenEntry } from "@/features/demo/api"

/** 画板节点，x / y 为逻辑网格坐标（右上为正） */
export interface BoardNode {
  id: string
  label: string
  x: number
  y: number
}

/** 画板边，weight 为 null 时按两端欧氏距离计算 */
export interface BoardEdge {
  id: string
  source: string
  target: string
  weight: number | null
  directed: boolean
}

/** 画板操作模式：选择 / 加点 / 连线 */
export type BoardMode = "select" | "node" | "edge"

/** 画板选中对象 */
export interface BoardSelection {
  kind: "node" | "edge"
  id: string
}

/** 由求解结果派生的当前帧动画状态 */
export interface BoardAnimation {
  /** 已探索（闭合集合）节点 */
  closed: Set<string>
  /** 开放集合节点及其 g / h / f */
  open: Map<string, AstarOpenEntry>
  /** 本轮取出的当前节点 */
  currentId: string
  /** 本轮评估的邻边：边 ID -> 是否被接受 */
  neighborEdges: Map<string, boolean>
  /** 最终路径节点 */
  pathNodes: Set<string>
  /** 最终路径边 */
  pathEdges: Set<string>
}

/** 每个网格单元的像素尺寸 */
const UNIT = 40
/** 横向 / 纵向网格数量，同时作为坐标取值上限 */
export const BOARD_COLS = 26
export const BOARD_ROWS = 16
/** 坐标轴留白 */
const PAD = 34
const WIDTH = PAD + BOARD_COLS * UNIT + 16
const HEIGHT = 16 + BOARD_ROWS * UNIT + PAD
const ORIGIN_X = PAD
const ORIGIN_Y = HEIGHT - PAD
const NODE_R = 15

/** 各状态配色，直接写死以保证浅色 / 深色主题下对比度一致 */
export const BOARD_COLOR = {
  start: "#10b981",
  goal: "#8b5cf6",
  current: "#3b82f6",
  open: "#f59e0b",
  closed: "#94a3b8",
  accepted: "#22c55e",
  rejected: "#f43f5e",
  path: "#22c55e",
  selected: "#0ea5e9",
}

const toPx = (x: number, y: number): [number, number] => [
  ORIGIN_X + x * UNIT,
  ORIGIN_Y - y * UNIT,
]

/** 两点间欧氏距离，用于未自定义权重的边 */
export function euclidean(a: BoardNode, b: BoardNode): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

interface AstarBoardProps {
  nodes: BoardNode[]
  edges: BoardEdge[]
  mode: BoardMode
  /** 是否吸附到整数网格 */
  snap: boolean
  selected: BoardSelection | null
  /** 连线模式下已选中的起始节点 */
  pendingSource: string
  startId: string
  goalId: string
  animation: BoardAnimation | null
  /** 编辑锁定（求解中或已有结果回放时） */
  locked: boolean
  onCanvasClick: (x: number, y: number) => void
  onNodeClick: (id: string) => void
  onEdgeClick: (id: string) => void
  onNodeMove: (id: string, x: number, y: number) => void
}

export function AstarBoard({
  nodes,
  edges,
  mode,
  snap,
  selected,
  pendingSource,
  startId,
  goalId,
  animation,
  locked,
  onCanvasClick,
  onNodeClick,
  onEdgeClick,
  onNodeMove,
}: AstarBoardProps) {
  const svgRef = React.useRef<SVGSVGElement>(null)
  const dragRef = React.useRef<{ id: string; moved: boolean } | null>(null)

  const nodeMap = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes]
  )

  /** 屏幕坐标转逻辑网格坐标，viewBox 缩放下需借助 CTM 换算 */
  const clientToWorld = React.useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current
      const ctm = svg?.getScreenCTM()
      if (!svg || !ctm) return null
      const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      const x = (point.x - ORIGIN_X) / UNIT
      const y = (ORIGIN_Y - point.y) / UNIT
      return {
        x: clamp(snap ? Math.round(x) : round2(x), 0, BOARD_COLS),
        y: clamp(snap ? Math.round(y) : round2(y), 0, BOARD_ROWS),
      }
    },
    [snap]
  )

  const handleBackgroundClick = (event: React.MouseEvent<SVGRectElement>) => {
    if (dragRef.current) return
    const world = clientToWorld(event.clientX, event.clientY)
    if (world) onCanvasClick(world.x, world.y)
  }

  const handleNodePointerDown = (
    event: React.PointerEvent<SVGGElement>,
    id: string
  ) => {
    event.stopPropagation()
    if (mode !== "select" || locked) {
      onNodeClick(id)
      return
    }
    dragRef.current = { id, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleNodePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const world = clientToWorld(event.clientX, event.clientY)
    if (!world) return
    const node = nodeMap.get(drag.id)
    if (node && node.x === world.x && node.y === world.y) return
    drag.moved = true
    onNodeMove(drag.id, world.x, world.y)
  }

  const handleNodePointerUp = (
    event: React.PointerEvent<SVGGElement>,
    id: string
  ) => {
    const drag = dragRef.current
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag && !drag.moved) onNodeClick(id)
  }

  const cursor =
    mode === "node" && !locked
      ? "cursor-crosshair"
      : mode === "edge" && !locked
        ? "cursor-pointer"
        : "cursor-default"

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full touch-none select-none ${cursor}`}
    >
      <defs>
        {/* 仅坐标轴使用箭头 marker，有向边的箭头单独绘制以便随强调程度变化 */}
        <marker
          id="astar-arrow-default"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
        </marker>
      </defs>

      {/* 背景与点击热区 */}
      <rect
        x={0}
        y={0}
        width={WIDTH}
        height={HEIGHT}
        fill="var(--card)"
        onClick={handleBackgroundClick}
      />

      <Grid />
      <Axes />

      {/* 边 */}
      <g>
        {edges.map((edge) => {
          const source = nodeMap.get(edge.source)
          const target = nodeMap.get(edge.target)
          if (!source || !target) return null
          return (
            <EdgeShape
              key={edge.id}
              edge={edge}
              source={source}
              target={target}
              selected={selected?.kind === "edge" && selected.id === edge.id}
              animation={animation}
              onClick={() => onEdgeClick(edge.id)}
            />
          )
        })}
      </g>

      {/* 节点 */}
      <g>
        {nodes.map((node) => (
          <NodeShape
            key={node.id}
            node={node}
            isStart={node.id === startId}
            isGoal={node.id === goalId}
            selected={selected?.kind === "node" && selected.id === node.id}
            pending={node.id === pendingSource}
            animation={animation}
            draggable={mode === "select" && !locked}
            onPointerDown={(event) => handleNodePointerDown(event, node.id)}
            onPointerMove={handleNodePointerMove}
            onPointerUp={(event) => handleNodePointerUp(event, node.id)}
          />
        ))}
      </g>

      {nodes.length === 0 && (
        <text
          x={WIDTH / 2}
          y={HEIGHT / 2}
          textAnchor="middle"
          fill="var(--muted-foreground)"
          fontSize={14}
        >
          切换到「加点」模式后在画板上单击即可创建节点
        </text>
      )}
    </svg>
  )
}

/** 网格线 */
function Grid() {
  const lines: React.ReactNode[] = []
  for (let i = 0; i <= BOARD_COLS; i++) {
    const x = ORIGIN_X + i * UNIT
    lines.push(
      <line
        key={`v${i}`}
        x1={x}
        y1={ORIGIN_Y}
        x2={x}
        y2={ORIGIN_Y - BOARD_ROWS * UNIT}
        stroke="var(--border)"
        strokeWidth={i % 5 === 0 ? 1.2 : 0.6}
      />
    )
  }
  for (let i = 0; i <= BOARD_ROWS; i++) {
    const y = ORIGIN_Y - i * UNIT
    lines.push(
      <line
        key={`h${i}`}
        x1={ORIGIN_X}
        y1={y}
        x2={ORIGIN_X + BOARD_COLS * UNIT}
        y2={y}
        stroke="var(--border)"
        strokeWidth={i % 5 === 0 ? 1.2 : 0.6}
      />
    )
  }
  return <g pointerEvents="none">{lines}</g>
}

/** 坐标轴与刻度 */
function Axes() {
  const ticks: React.ReactNode[] = []
  for (let i = 0; i <= BOARD_COLS; i += 5) {
    ticks.push(
      <text
        key={`tx${i}`}
        x={ORIGIN_X + i * UNIT}
        y={ORIGIN_Y + 16}
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize={11}
      >
        {i}
      </text>
    )
  }
  for (let i = 0; i <= BOARD_ROWS; i += 5) {
    if (i === 0) continue
    ticks.push(
      <text
        key={`ty${i}`}
        x={ORIGIN_X - 8}
        y={ORIGIN_Y - i * UNIT + 4}
        textAnchor="end"
        fill="var(--muted-foreground)"
        fontSize={11}
      >
        {i}
      </text>
    )
  }
  return (
    <g pointerEvents="none">
      <line
        x1={ORIGIN_X}
        y1={ORIGIN_Y}
        x2={ORIGIN_X + BOARD_COLS * UNIT + 10}
        y2={ORIGIN_Y}
        stroke="var(--muted-foreground)"
        strokeWidth={1.5}
        markerEnd="url(#astar-arrow-default)"
      />
      <line
        x1={ORIGIN_X}
        y1={ORIGIN_Y}
        x2={ORIGIN_X}
        y2={ORIGIN_Y - BOARD_ROWS * UNIT - 10}
        stroke="var(--muted-foreground)"
        strokeWidth={1.5}
        markerEnd="url(#astar-arrow-default)"
      />
      {ticks}
    </g>
  )
}

interface EdgeShapeProps {
  edge: BoardEdge
  source: BoardNode
  target: BoardNode
  selected: boolean
  animation: BoardAnimation | null
  onClick: () => void
}

function EdgeShape({
  edge,
  source,
  target,
  selected,
  animation,
  onClick,
}: EdgeShapeProps) {
  const [sx, sy] = toPx(source.x, source.y)
  const [tx, ty] = toPx(target.x, target.y)
  const len = Math.hypot(tx - sx, ty - sy) || 1
  const ux = (tx - sx) / len
  const uy = (ty - sy) / len

  const inPath = animation?.pathEdges.has(edge.id) ?? false
  const evaluated = animation?.neighborEdges.get(edge.id)

  let color = "var(--muted-foreground)"
  let width = 1.8
  let halo = false
  let dash: string | undefined

  if (evaluated === true) {
    color = BOARD_COLOR.accepted
    width = 2.8
    halo = true
  } else if (evaluated === false) {
    color = BOARD_COLOR.rejected
    width = 2.2
    dash = "6 4"
  } else if (inPath) {
    color = BOARD_COLOR.path
    width = 3.2
    halo = true
  } else if (selected) {
    color = BOARD_COLOR.selected
    width = 2.4
    halo = true
  }

  // 箭头随强调程度放大，且与线身留出缺口，避免加粗后被"吞掉"
  const arrowLen = 12 + width * 1.4
  const arrowHalf = 5 + width * 0.8
  const tipDist = NODE_R + 3
  const lineEndDist = edge.directed ? tipDist + arrowLen * 0.8 : NODE_R

  const x1 = sx + ux * NODE_R
  const y1 = sy + uy * NODE_R
  const x2 = tx - ux * lineEndDist
  const y2 = ty - uy * lineEndDist
  const visibleLen = Math.hypot(x2 - x1, y2 - y1)

  const weight = edge.weight ?? euclidean(source, target)
  const midX = (x1 + x2) / 2 - uy * 12
  const midY = (y1 + y2) / 2 + ux * 12
  const text = formatWeight(weight)

  return (
    <g>
      {/* 加宽的透明热区，便于点击细线 */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={14}
        className="cursor-pointer"
        onClick={onClick}
      />
      {halo && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width + 7}
          strokeLinecap="round"
          opacity={0.2}
          pointerEvents="none"
        />
      )}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap="round"
        pointerEvents="none"
      />

      {edge.directed && (
        <g pointerEvents="none">
          <path
            d={arrowPath(tx - ux * tipDist, ty - uy * tipDist, ux, uy, arrowLen, arrowHalf)}
            fill={color}
            stroke="var(--card)"
            strokeWidth={0.8}
            strokeLinejoin="round"
          />
          {/* 长边中段补一个方向指示，远距离也能看清朝向 */}
          {visibleLen > 80 && (
            <path
              d={arrowPath(
                x1 + ux * visibleLen * 0.45,
                y1 + uy * visibleLen * 0.45,
                ux,
                uy,
                arrowLen * 0.7,
                arrowHalf * 0.7
              )}
              fill={color}
              stroke="var(--card)"
              strokeWidth={0.8}
              strokeLinejoin="round"
              opacity={0.9}
            />
          )}
        </g>
      )}

      <g pointerEvents="none">
        <rect
          x={midX - text.length * 3.4 - 3}
          y={midY - 8}
          width={text.length * 6.8 + 6}
          height={14}
          rx={3}
          fill="var(--card)"
          fillOpacity={0.85}
        />
        <text
          x={midX}
          y={midY + 3}
          textAnchor="middle"
          fontSize={11}
          fill={edge.weight == null ? "var(--muted-foreground)" : color}
          fontWeight={edge.weight == null ? 400 : 600}
        >
          {text}
        </text>
      </g>
    </g>
  )
}

/** 以 (tipX, tipY) 为顶点、沿 (ux, uy) 方向的实心三角形 */
function arrowPath(
  tipX: number,
  tipY: number,
  ux: number,
  uy: number,
  length: number,
  half: number
): string {
  const baseX = tipX - ux * length
  const baseY = tipY - uy * length
  const nx = -uy
  const ny = ux
  return `M ${tipX} ${tipY} L ${baseX + nx * half} ${baseY + ny * half} L ${baseX - nx * half} ${baseY - ny * half} Z`
}

interface NodeShapeProps {
  node: BoardNode
  isStart: boolean
  isGoal: boolean
  selected: boolean
  pending: boolean
  animation: BoardAnimation | null
  draggable: boolean
  onPointerDown: (event: React.PointerEvent<SVGGElement>) => void
  onPointerMove: (event: React.PointerEvent<SVGGElement>) => void
  onPointerUp: (event: React.PointerEvent<SVGGElement>) => void
}

function NodeShape({
  node,
  isStart,
  isGoal,
  selected,
  pending,
  animation,
  draggable,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: NodeShapeProps) {
  const [cx, cy] = toPx(node.x, node.y)
  const openEntry = animation?.open.get(node.id)
  const isCurrent = animation?.currentId === node.id
  const isClosed = animation?.closed.has(node.id) ?? false
  const inPath = animation?.pathNodes.has(node.id) ?? false

  let stroke = "var(--muted-foreground)"
  let fill = "var(--card)"
  let width = 1.8

  if (isStart) {
    stroke = BOARD_COLOR.start
    fill = `${BOARD_COLOR.start}22`
    width = 2.4
  } else if (isGoal) {
    stroke = BOARD_COLOR.goal
    fill = `${BOARD_COLOR.goal}22`
    width = 2.4
  }

  if (animation) {
    if (isCurrent) {
      stroke = BOARD_COLOR.current
      fill = `${BOARD_COLOR.current}33`
      width = 3
    } else if (inPath) {
      stroke = BOARD_COLOR.path
      fill = `${BOARD_COLOR.path}33`
      width = 3
    } else if (openEntry) {
      stroke = BOARD_COLOR.open
      fill = `${BOARD_COLOR.open}26`
      width = 2.4
    } else if (isClosed) {
      stroke = BOARD_COLOR.closed
      fill = `${BOARD_COLOR.closed}26`
    }
  }

  return (
    <g
      className={draggable ? "cursor-grab" : "cursor-pointer"}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {(selected || pending) && (
        <circle
          cx={cx}
          cy={cy}
          r={NODE_R + 5}
          fill="none"
          stroke={pending ? BOARD_COLOR.current : BOARD_COLOR.selected}
          strokeWidth={1.6}
          strokeDasharray="4 3"
        />
      )}
      {isCurrent && (
        <circle
          cx={cx}
          cy={cy}
          r={NODE_R + 8}
          fill="none"
          stroke={BOARD_COLOR.current}
          strokeWidth={1.4}
          opacity={0.5}
        />
      )}
      <circle cx={cx} cy={cy} r={NODE_R} fill={fill} stroke={stroke} strokeWidth={width} />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--foreground)"
        pointerEvents="none"
      >
        {node.id}
      </text>

      {node.label && node.label !== node.id && (
        <text
          x={cx}
          y={cy + NODE_R + 13}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted-foreground)"
          pointerEvents="none"
        >
          {node.label}
        </text>
      )}

      {(isStart || isGoal) && (
        <text
          x={cx}
          y={cy - NODE_R - (openEntry ? 18 : 6)}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={isStart ? BOARD_COLOR.start : BOARD_COLOR.goal}
          pointerEvents="none"
        >
          {isStart ? "起点" : "终点"}
        </text>
      )}

      {openEntry && (
        <text
          x={cx}
          y={cy - NODE_R - 6}
          textAnchor="middle"
          fontSize={10}
          fill={BOARD_COLOR.open}
          fontWeight={600}
          pointerEvents="none"
        >
          {`g${formatWeight(openEntry.g)} h${formatWeight(openEntry.h)} f${formatWeight(openEntry.f)}`}
        </text>
      )}
    </g>
  )
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
