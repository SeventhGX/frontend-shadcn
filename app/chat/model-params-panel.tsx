"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, HelpCircle, Settings2 } from "lucide-react"

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
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ModelKwarg } from "@/features/chat/api"
import { cn } from "@/lib/utils"

type ParamValue = string | number | boolean

interface ModelParamsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kwargs: ModelKwarg[]
  values: Record<string, ParamValue>
  disabled: boolean
  onValueChange: (name: string, value: ParamValue) => void
}

export function ModelParamsPanel({
  open,
  onOpenChange,
  kwargs,
  values,
  disabled,
  onValueChange,
}: ModelParamsPanelProps) {
  const [editingParam, setEditingParam] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState("")

  return (
    <aside
      className={cn(
        "flex-none flex flex-col border rounded-md bg-card transition-all duration-200",
        open ? "w-72" : "w-10"
      )}
    >
      {open ? (
        <>
          <div className="flex-none flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <Settings2 size={14} />
              <span className="text-sm font-medium">参数设置</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => onOpenChange(false)}
              title="收起"
            >
              <ChevronLeft size={14} />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
            {kwargs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center pt-4">
                当前模型暂无可配置参数
              </p>
            ) : (
              kwargs.map((kw) => {
                const value = values[kw.name]
                const labelNode = (
                  <div className="flex items-center gap-1 min-w-0">
                    <Label className="text-xs font-medium truncate" title={kw.name}>
                      {kw.name}
                    </Label>
                    {kw.description && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-help"
                            aria-label={`${kw.name} 说明`}
                          >
                            <HelpCircle size={12} />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          {kw.description}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                )

                if (kw.type === "boolean") {
                  return (
                    <div key={kw.name} className="flex items-center justify-between gap-3">
                      {labelNode}
                      <Switch
                        checked={Boolean(value)}
                        onCheckedChange={(nextValue) => onValueChange(kw.name, nextValue)}
                        disabled={disabled}
                      />
                    </div>
                  )
                }

                if (kw.type === "string") {
                  const options = kw.option ?? []
                  return (
                    <div key={kw.name} className="space-y-2">
                      {labelNode}
                      <Select
                        value={String(value ?? "")}
                        onValueChange={(nextValue) => onValueChange(kw.name, nextValue)}
                        disabled={disabled || options.length === 0}
                      >
                        <SelectTrigger className="w-full h-8">
                          <SelectValue placeholder="请选择" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                }

                const step = kw.type === "integer" ? 1 : 0.01
                const minV = kw.min ?? 0
                const maxV = kw.max ?? 100
                const numValue =
                  typeof value === "number" ? value : Number(kw.default ?? minV)
                const isEditing = editingParam === kw.name

                const commitDraft = () => {
                  const parsed =
                    kw.type === "integer"
                      ? parseInt(editingDraft, 10)
                      : parseFloat(editingDraft)
                  if (!Number.isNaN(parsed)) {
                    const clamped = Math.min(maxV, Math.max(minV, parsed))
                    onValueChange(
                      kw.name,
                      kw.type === "integer" ? Math.round(clamped) : clamped
                    )
                  }
                  setEditingParam(null)
                }

                return (
                  <div key={kw.name} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      {labelNode}
                      {isEditing ? (
                        <Input
                          type="number"
                          autoFocus
                          value={editingDraft}
                          min={minV}
                          max={maxV}
                          step={step}
                          onChange={(e) => setEditingDraft(e.target.value)}
                          onBlur={commitDraft}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault()
                              commitDraft()
                            } else if (e.key === "Escape") {
                              e.preventDefault()
                              setEditingParam(null)
                            }
                          }}
                          disabled={disabled}
                          className="h-6 w-24 px-2 py-0 text-xs tabular-nums"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (disabled) return
                            setEditingDraft(String(numValue))
                            setEditingParam(kw.name)
                          }}
                          title="点击手动输入"
                          className="text-xs tabular-nums text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded px-1.5 py-0.5 transition-colors disabled:opacity-50"
                          disabled={disabled}
                        >
                          {numValue}
                        </button>
                      )}
                    </div>
                    <Slider
                      value={[numValue]}
                      min={minV}
                      max={maxV}
                      step={step}
                      disabled={disabled}
                      onValueChange={(nextValue) =>
                        onValueChange(
                          kw.name,
                          kw.type === "integer" ? Math.round(nextValue[0]) : nextValue[0]
                        )
                      }
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>{minV}</span>
                      <span>{maxV}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors rounded-md"
          title="展开参数设置"
        >
          <ChevronRight size={14} />
          <Settings2 size={14} />
        </button>
      )}
    </aside>
  )
}