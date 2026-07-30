"use client"

import * as React from "react"
import { Download, FileSpreadsheet, FileText, ImageIcon, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { LstmEpochProgress, LstmMetrics, LstmTrainResult } from "@/features/demo/api"

interface ResultPanelProps {
  /** 训练结果，未训练时为 null */
  result: LstmTrainResult | null
  /** 结果图片的 ObjectURL */
  imageUrl: string
  /** 图片是否加载中 */
  imageLoading: boolean
  /** 图片是否加载失败 */
  imageError: boolean
  /** 是否正在训练 */
  training: boolean
  /** 最近一轮训练进度 */
  progress: LstmEpochProgress | null
  /** 是否进入预测阶段 */
  predicting: boolean
  onDownloadCsv: () => void
  onDownloadExcel: () => void
  onSaveImage: () => void
}

/** 指标字段的中文标签与格式化方式 */
const METRIC_FIELDS: {
  key: keyof LstmMetrics
  label: string
  format: (value: number | string) => string
}[] = [
  { key: "final_train_loss", label: "训练集 Loss", format: (v) => Number(v).toFixed(5) },
  { key: "final_validation_loss", label: "验证集 Loss", format: (v) => Number(v).toFixed(5) },
  { key: "best_validation_loss", label: "最优验证 Loss", format: (v) => Number(v).toFixed(5) },
  { key: "forecast_mae", label: "预测 MAE", format: (v) => Number(v).toFixed(4) },
  { key: "forecast_rmse", label: "预测 RMSE", format: (v) => Number(v).toFixed(4) },
  { key: "training_seconds", label: "训练耗时", format: (v) => `${Number(v).toFixed(2)} s` },
  { key: "device", label: "训练设备", format: (v) => String(v).toUpperCase() },
]

export function ResultPanel({
  result,
  imageUrl,
  imageLoading,
  imageError,
  training,
  progress,
  predicting,
  onDownloadCsv,
  onDownloadExcel,
  onSaveImage,
}: ResultPanelProps) {
  if (training) {
    return <TrainingProgress progress={progress} predicting={predicting} />
  }

  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <ImageIcon className="size-10 opacity-40" />
        <p className="text-sm">配置左侧参数并开始训练，结果将展示在此处</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* 指标卡片 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold">结果指标</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {METRIC_FIELDS.map((field) => (
            <div key={field.key} className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {field.format(result.metrics[field.key])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 下载操作 */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onSaveImage} disabled={!imageUrl}>
          <Download className="size-4" />
          保存图片
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadCsv}>
          <FileText className="size-4" />
          下载 CSV
        </Button>
        <Button variant="outline" size="sm" onClick={onDownloadExcel}>
          <FileSpreadsheet className="size-4" />
          下载 Excel
        </Button>
      </div>

      {/* 结果图片 */}
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border bg-muted/30 p-2">
        {imageLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">图片加载中…</p>
          </div>
        ) : imageError ? (
          <p className="text-sm text-destructive">图片加载失败</p>
        ) : imageUrl ? (
          // 结果图片由后端实时渲染，宽高不定，等比适配容器
          <img
            src={imageUrl}
            alt="LSTM 预测结果"
            className="max-h-full max-w-full object-contain"
          />
        ) : null}
      </div>
    </div>
  )
}

interface TrainingProgressProps {
  progress: LstmEpochProgress | null
  predicting: boolean
}

/** 训练过程中的动态进度：进度条 + 当前轮次与实时 Loss */
function TrainingProgress({ progress, predicting }: TrainingProgressProps) {
  const percent = progress
    ? Math.min(100, Math.round((progress.epoch / progress.total_epochs) * 100))
    : 0

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-8">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
        <p className="text-sm">
          {predicting
            ? "训练完成，正在生成预测结果…"
            : progress
              ? `模型训练中 · 第 ${progress.epoch}/${progress.total_epochs} 轮`
              : "正在初始化训练…"}
        </p>
      </div>

      <div className="w-full max-w-md">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${predicting ? 100 : percent}%` }}
          />
        </div>
        {progress && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">训练集 Loss</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {progress.train_loss.toFixed(5)}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <p className="text-xs text-muted-foreground">验证集 Loss</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {progress.validation_loss.toFixed(5)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
