"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Play } from "lucide-react"

import { AuthGuard } from "@/components/common/auth-guard"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  detectIsolationForest,
  downloadResultFile,
  fetchResultImageObjectUrl,
  getDemoList,
  getIsolationForestParamList,
  getLstmParamList,
  trainLstm,
  type DemoItem,
  type DemoParamNode,
  type DemoRunResult,
  type LstmEpochProgress,
} from "@/features/demo/api"
import { ParamPanel } from "./param-panel"
import { ResultPanel } from "./result-panel"

/** 已完成前端对接的 Demo 及其参数接口 */
const PARAM_LOADERS: Record<string, () => Promise<{ data: DemoParamNode[] }>> = {
  lstm: getLstmParamList,
  "isolation-forest": getIsolationForestParamList,
}

/** 递归遍历参数树，用默认值构建以点分路径为 key 的取值表 */
function buildDefaultValues(
  nodes: DemoParamNode[],
  prefix = ""
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name
    if (node.type === "group") {
      Object.assign(values, buildDefaultValues(node.sub_nodes ?? [], path))
    } else {
      values[path] = node.value == null ? "" : String(node.value)
    }
  }
  return values
}

/** 递归遍历参数树，结合取值表构建与结构一致的嵌套请求体 */
function buildRequestBody(
  nodes: DemoParamNode[],
  values: Record<string, string>,
  prefix = ""
): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name
    if (node.type === "group") {
      body[node.name] = buildRequestBody(node.sub_nodes ?? [], values, path)
      continue
    }

    const raw = values[path]
    if (node.type === "select") {
      body[node.name] = raw
    } else {
      const parsed = node.type === "integer" ? parseInt(raw, 10) : parseFloat(raw)
      // 输入为空或非法时回退到默认值，保证请求体始终有效
      body[node.name] = Number.isNaN(parsed) ? node.value : parsed
    }
  }
  return body
}

/**
 * Isolation Forest 的严格正数与跨字段约束。
 * 参数元数据中浮点字段的 minimum 为 0，但后端校验为严格大于 0，故在此补齐。
 * @returns 首个错误提示，全部通过时返回空串
 */
function validateIsolationForest(body: Record<string, unknown>): string {
  const synthesis = (body.synthesis ?? {}) as Record<string, number>
  const model = (body.model ?? {}) as Record<string, number>

  const positiveFields: [number, string][] = [
    [synthesis.cluster_std, "正常样本簇标准差"],
    [synthesis.anomaly_radius_min, "异常点最小分布半径"],
    [synthesis.anomaly_radius_max, "异常点最大分布半径"],
  ]
  for (const [value, label] of positiveFields) {
    if (!(value > 0)) return `${label}必须大于 0`
  }

  if (!(synthesis.anomaly_samples < synthesis.normal_samples)) {
    return "异常样本数量必须小于正常样本数量"
  }
  if (!(synthesis.anomaly_radius_max > synthesis.anomaly_radius_min)) {
    return "异常点最大分布半径必须大于最小分布半径"
  }
  if (model.max_samples > synthesis.normal_samples + synthesis.anomaly_samples) {
    return "每棵孤立树的采样数量不能大于样本总数"
  }
  return ""
}

export default function DemoPage() {
  const [demoList, setDemoList] = React.useState<DemoItem[]>([])
  const [selectedDemo, setSelectedDemo] = React.useState<string>("")

  const [paramNodes, setParamNodes] = React.useState<DemoParamNode[]>([])
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [loadingParams, setLoadingParams] = React.useState(false)

  const [running, setRunning] = React.useState(false)
  const [result, setResult] = React.useState<DemoRunResult | null>(null)

  // LSTM 训练过程中的进度：最近一轮 epoch 事件与是否进入预测阶段
  const [progress, setProgress] = React.useState<LstmEpochProgress | null>(null)
  const [predicting, setPredicting] = React.useState(false)

  const [imageUrl, setImageUrl] = React.useState("")
  const [imageLoading, setImageLoading] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)

  // 进入页面拉取可用 Demo 列表，默认不选中
  React.useEffect(() => {
    getDemoList()
      .then((res) => setDemoList(res?.data ?? []))
      .catch((error) => {
        console.error(error)
        toast.error("获取 Demo 列表失败")
      })
  }, [])

  // 选中 Demo 后加载对应参数清单
  const handleSelectDemo = React.useCallback(async (name: string) => {
    setSelectedDemo(name)
    setResult(null)
    setParamNodes([])
    setValues({})
    const loadParams = PARAM_LOADERS[name]
    if (!loadParams) return

    try {
      setLoadingParams(true)
      const res = await loadParams()
      const nodes = res?.data ?? []
      setParamNodes(nodes)
      setValues(buildDefaultValues(nodes))
    } catch (error) {
      console.error(error)
      toast.error("获取参数列表失败")
    } finally {
      setLoadingParams(false)
    }
  }, [])

  const handleValueChange = React.useCallback((path: string, value: string) => {
    setValues((prev) => ({ ...prev, [path]: value }))
  }, [])

  const runLabel = selectedDemo === "isolation-forest" ? "检测" : "训练"

  // 训练成功后按结果链接鉴权拉取图片并转 ObjectURL
  React.useEffect(() => {
    const src = result?.links.image
    if (!src) {
      setImageUrl("")
      return
    }

    let cancelled = false
    let created = ""
    setImageLoading(true)
    setImageError(false)

    fetchResultImageObjectUrl(src)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        created = url
        setImageUrl(url)
      })
      .catch((error) => {
        console.error(error)
        if (!cancelled) setImageError(true)
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false)
      })

    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [result])

  const handleRun = async () => {
    if (paramNodes.length === 0) return
    const body = buildRequestBody(paramNodes, values)

    if (selectedDemo === "isolation-forest") {
      const invalid = validateIsolationForest(body)
      if (invalid) {
        toast.error(invalid)
        return
      }
    }

    try {
      setRunning(true)
      setResult(null)
      setProgress(null)
      setPredicting(false)

      if (selectedDemo === "isolation-forest") {
        setResult(await detectIsolationForest(body))
        toast.success("检测完成")
      } else {
        const data = await trainLstm(body, {
          onEpoch: (p) => {
            setProgress(p)
            setPredicting(false)
          },
          onPredicting: () => setPredicting(true),
        })
        setResult(data)
        toast.success("训练完成")
      }
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "运行失败，请检查参数后重试")
    } finally {
      setRunning(false)
      setPredicting(false)
    }
  }

  const handleDownloadCsv = async () => {
    if (!result) return
    try {
      await downloadResultFile(result.links.csv, `${selectedDemo}-${result.result_id}.csv`)
    } catch (error) {
      console.error(error)
      toast.error("下载 CSV 失败")
    }
  }

  const handleDownloadExcel = async () => {
    if (!result) return
    try {
      await downloadResultFile(result.links.excel, `${selectedDemo}-${result.result_id}.xlsx`)
    } catch (error) {
      console.error(error)
      toast.error("下载 Excel 失败")
    }
  }

  const handleSaveImage = () => {
    if (!imageUrl || !result) return
    const anchor = document.createElement("a")
    anchor.href = imageUrl
    anchor.download = `${selectedDemo}-${result.result_id}.png`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }

  return (
    <AuthGuard>
      <div className="h-full p-4">
        <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
          {/* 左侧：参数设定区（1/4 宽度） */}
          <ResizablePanel defaultSize={25} minSize={20}>
            <div className="flex h-full flex-col gap-3 p-4">
              <h1 className="text-xl font-bold">机器学习演示</h1>

              <div className="flex flex-col gap-2">
                <Label>演示项目</Label>
                <Select value={selectedDemo} onValueChange={handleSelectDemo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="请选择演示项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {demoList.map((demo) => (
                      <SelectItem key={demo.name} value={demo.name}>
                        {demo.desc || demo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 参数表单区 */}
              <div className="min-h-0 flex-1 overflow-auto">
                {loadingParams ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin" />
                  </div>
                ) : paramNodes.length > 0 ? (
                  <ParamPanel
                    nodes={paramNodes}
                    values={values}
                    onChange={handleValueChange}
                    disabled={running}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {selectedDemo ? "该演示暂无可配置参数" : "请先选择一个演示项目"}
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleRun}
                disabled={running || paramNodes.length === 0}
              >
                {running ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {runLabel}中…
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    开始{runLabel}
                  </>
                )}
              </Button>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧：结果展示区（3/4 宽度） */}
          <ResizablePanel defaultSize={75} minSize={40}>
            <div className="h-full p-4">
              <ResultPanel
                demo={selectedDemo}
                result={result}
                imageUrl={imageUrl}
                imageLoading={imageLoading}
                imageError={imageError}
                running={running}
                progress={progress}
                predicting={predicting}
                onDownloadCsv={handleDownloadCsv}
                onDownloadExcel={handleDownloadExcel}
                onSaveImage={handleSaveImage}
              />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </AuthGuard>
  )
}
