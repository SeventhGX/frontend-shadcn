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
  downloadResultFile,
  fetchResultImageObjectUrl,
  getDemoList,
  getLstmParamList,
  trainLstm,
  type DemoItem,
  type LstmParamNode,
  type LstmTrainResult,
} from "@/features/demo/api"
import { ParamPanel } from "./param-panel"
import { ResultPanel } from "./result-panel"

/** 递归遍历参数树，用默认值构建以点分路径为 key 的取值表 */
function buildDefaultValues(
  nodes: LstmParamNode[],
  prefix = ""
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const node of nodes) {
    const path = prefix ? `${prefix}.${node.name}` : node.name
    if (node.type === "group") {
      Object.assign(values, buildDefaultValues(node.sub_nodes ?? [], path))
    } else {
      values[path] = node.value === null ? "" : String(node.value)
    }
  }
  return values
}

/** 递归遍历参数树，结合取值表构建与结构一致的嵌套请求体 */
function buildRequestBody(
  nodes: LstmParamNode[],
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

export default function DemoPage() {
  const [demoList, setDemoList] = React.useState<DemoItem[]>([])
  const [selectedDemo, setSelectedDemo] = React.useState<string>("")

  const [paramNodes, setParamNodes] = React.useState<LstmParamNode[]>([])
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [loadingParams, setLoadingParams] = React.useState(false)

  const [training, setTraining] = React.useState(false)
  const [result, setResult] = React.useState<LstmTrainResult | null>(null)

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

  // 选中 Demo 后加载对应参数清单（目前仅 lstm）
  const handleSelectDemo = React.useCallback(async (name: string) => {
    setSelectedDemo(name)
    setResult(null)
    setParamNodes([])
    setValues({})
    if (name !== "lstm") return

    try {
      setLoadingParams(true)
      const res = await getLstmParamList()
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

  const handleTrain = async () => {
    if (paramNodes.length === 0) return
    try {
      setTraining(true)
      setResult(null)
      const body = buildRequestBody(paramNodes, values)
      const res = await trainLstm(body)
      if (res?.data) {
        setResult(res.data)
        toast.success("训练完成")
      } else {
        toast.error("训练返回结果为空")
      }
    } catch (error) {
      console.error(error)
      toast.error("训练失败，请检查参数后重试")
    } finally {
      setTraining(false)
    }
  }

  const handleDownloadCsv = async () => {
    if (!result) return
    try {
      await downloadResultFile(result.links.csv, `lstm-${result.result_id}.csv`)
    } catch (error) {
      console.error(error)
      toast.error("下载 CSV 失败")
    }
  }

  const handleDownloadExcel = async () => {
    if (!result) return
    try {
      await downloadResultFile(result.links.excel, `lstm-${result.result_id}.xlsx`)
    } catch (error) {
      console.error(error)
      toast.error("下载 Excel 失败")
    }
  }

  const handleSaveImage = () => {
    if (!imageUrl || !result) return
    const anchor = document.createElement("a")
    anchor.href = imageUrl
    anchor.download = `lstm-${result.result_id}.png`
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
                    disabled={training}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {selectedDemo ? "该演示暂无可配置参数" : "请先选择一个演示项目"}
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                onClick={handleTrain}
                disabled={training || paramNodes.length === 0}
              >
                {training ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    训练中…
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    开始训练
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
                result={result}
                imageUrl={imageUrl}
                imageLoading={imageLoading}
                imageError={imageError}
                training={training}
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
