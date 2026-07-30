import { fetcher } from '@/lib/fetcher'

interface ApiResponse<T> {
  message: string
  code: number
  data: T
}

/** Demo 列表条目 */
export interface DemoItem {
  name: string
  desc: string
  type: string
}

/** 参数节点：可为分组或具体的输入项 */
export interface LstmParamNode {
  name: string
  desc: string
  type: 'group' | 'integer' | 'number' | 'select'
  value: number | string | boolean | null
  minimum: number | null
  maximum: number | null
  options: string[] | null
  sub_nodes: LstmParamNode[] | null
}

/** 训练结果指标 */
export interface LstmMetrics {
  final_train_loss: number
  final_validation_loss: number
  best_validation_loss: number
  forecast_mae: number
  forecast_rmse: number
  training_seconds: number
  device: string
}

/** 训练结果链接 */
export interface LstmResultLinks {
  image: string
  csv: string
  excel: string
}

/** 训练结果 */
export interface LstmTrainResult {
  result_id: string
  created_at: string
  metrics: LstmMetrics
  links: LstmResultLinks
}

/**
 * 获取当前后端支持的 Demo 列表
 */
export async function getDemoList(): Promise<ApiResponse<DemoItem[]>> {
  return fetcher(`/demo/list`, { method: 'GET' })
}

/**
 * 获取 LSTM 可配置参数（分组树结构）
 */
export async function getLstmParamList(): Promise<ApiResponse<LstmParamNode[]>> {
  return fetcher(`/demo/lstm/param-list`, { method: 'GET' })
}

/**
 * 训练 LSTM 并生成预测结果
 * @param body 与参数树结构一致的嵌套请求体，缺省字段后端会使用默认值
 */
export async function trainLstm(
  body: Record<string, unknown>
): Promise<ApiResponse<LstmTrainResult>> {
  return fetcher(`/demo/lstm/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * 携带认证信息拉取结果图片二进制，返回可用于 <img src> 的 ObjectURL。
 * 图片接口需要 Bearer Token，浏览器直接用 <img src> 无法携带请求头，
 * 因此统一走鉴权 fetch 取 Blob 再转 ObjectURL，调用方需在不再使用时释放。
 * @param src 训练结果返回的 image 链接
 */
export async function fetchResultImageObjectUrl(src: string): Promise<string> {
  const res: Response = await fetcher(src, { method: 'GET' })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * 携带认证信息下载结果文件（CSV / Excel）并触发浏览器下载。
 * @param src 训练结果返回的 csv 或 excel 链接
 * @param fallbackName 无法从响应头解析文件名时使用的兜底文件名
 */
export async function downloadResultFile(
  src: string,
  fallbackName: string
): Promise<void> {
  const res: Response = await fetcher(src, { method: 'GET' })
  const blob = await res.blob()
  const filename = parseFilename(res.headers.get('content-disposition')) || fallbackName
  triggerBlobDownload(blob, filename)
}

/** 触发浏览器下载指定 Blob */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

/** 从 Content-Disposition 头解析文件名，兼容 RFC 5987 的 filename* 形式 */
function parseFilename(disposition: string | null): string {
  if (!disposition) return ''
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1])
    } catch {
      return utf8Match[1]
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition)
  return plainMatch ? plainMatch[1] : ''
}
