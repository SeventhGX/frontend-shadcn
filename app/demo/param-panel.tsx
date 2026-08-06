"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DemoParamNode } from "@/features/demo/api"

interface ParamPanelProps {
  /** 参数树（分组 + 叶子节点） */
  nodes: DemoParamNode[]
  /** 以点分路径为 key 的当前取值表，如 "synthesis.n_samples" */
  values: Record<string, string>
  /** 叶子节点变更回调 */
  onChange: (path: string, value: string) => void
  /** 训练进行中时禁用整个表单 */
  disabled?: boolean
}

/**
 * 根据参数树递归渲染表单。
 * 分组节点渲染为带标题的区块，叶子节点根据类型选择合适的输入控件。
 */
export function ParamPanel({ nodes, values, onChange, disabled }: ParamPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      {nodes.map((node) => (
        <ParamNode
          key={node.name}
          node={node}
          path={node.name}
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      ))}
    </div>
  )
}

interface ParamNodeProps {
  node: DemoParamNode
  path: string
  values: Record<string, string>
  onChange: (path: string, value: string) => void
  disabled?: boolean
}

function ParamNode({ node, path, values, onChange, disabled }: ParamNodeProps) {
  if (node.type === "group") {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold">{node.desc || node.name}</h3>
        </div>
        <div className="flex flex-col gap-3">
          {(node.sub_nodes ?? []).map((child) => (
            <ParamNode
              key={child.name}
              node={child}
              path={`${path}.${child.name}`}
              values={values}
              onChange={onChange}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <ParamField
      node={node}
      path={path}
      value={values[path] ?? ""}
      onChange={onChange}
      disabled={disabled}
    />
  )
}

interface ParamFieldProps {
  node: DemoParamNode
  path: string
  value: string
  onChange: (path: string, value: string) => void
  disabled?: boolean
}

function ParamField({ node, path, value, onChange, disabled }: ParamFieldProps) {
  const rangeHint =
    node.minimum != null && node.maximum != null
      ? `范围 ${node.minimum} ~ ${node.maximum}`
      : node.minimum != null
        ? `≥ ${node.minimum}`
        : node.maximum != null
          ? `≤ ${node.maximum}`
          : ""

  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="min-w-0">
        {node.desc ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Label htmlFor={path} className="w-fit cursor-help truncate">
                {node.desc}
              </Label>
            </TooltipTrigger>
            <TooltipContent>{node.name}</TooltipContent>
          </Tooltip>
        ) : (
          <Label htmlFor={path} className="truncate">
            {node.name}
          </Label>
        )}
        {rangeHint && (
          <p className="mt-0.5 text-xs text-muted-foreground">{rangeHint}</p>
        )}
      </div>

      {node.type === "select" ? (
        <Select
          value={value}
          onValueChange={(next) => onChange(path, next)}
          disabled={disabled}
        >
          <SelectTrigger id={path} className="w-40">
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            {(node.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={path}
          type="number"
          className="w-40"
          value={value}
          disabled={disabled}
          min={node.minimum ?? undefined}
          max={node.maximum ?? undefined}
          step={node.type === "integer" ? 1 : "any"}
          onChange={(e) => onChange(path, e.target.value)}
        />
      )}
    </div>
  )
}
