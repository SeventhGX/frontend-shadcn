import { fetcher } from '@/lib/fetcher'

interface ApiResponse<T> {
  message: string
  code: number
  data: T
}

/** 教学文档条目 */
export interface DocItem {
  id: string
  docs_name: string
  docs_desc: string | null
  /** Markdown 正文，列表接口即返回 */
  content: string
  create_time?: string
  update_time?: string
}

/** 文档图片元数据（不含二进制） */
export interface DocImage {
  id: string
  docs_id: string | null
  image_name: string
  image_desc: string | null
  create_time?: string
  create_by?: string
}

/** 新增文档请求体 */
export interface CreateDocBody {
  docs_name: string
  docs_desc?: string | null
  content: string
}

/** 更新文档请求体（仅传需要修改的字段） */
export interface UpdateDocBody {
  docs_name?: string
  docs_desc?: string | null
  content?: string
}

/** 新增图片请求体，image_data 为纯 Base64（不带 data: 前缀） */
export interface CreateImageBody {
  docs_id?: string | null
  image_name: string
  image_desc?: string | null
  image_data: string
}

/** 更新图片请求体 */
export interface UpdateImageBody {
  docs_id?: string | null
  image_name?: string
  image_desc?: string | null
  image_data?: string
}

// ==================== 文档接口 ====================

/**
 * 获取文档列表（含 Markdown 正文）
 */
export async function getDocList(): Promise<ApiResponse<DocItem[]>> {
  return fetcher(`/docs/list`, { method: 'GET' })
}

/**
 * 获取单个文档
 * @param docId 文档 UUID
 */
export async function getDoc(docId: string): Promise<ApiResponse<DocItem>> {
  return fetcher(`/docs/docs?doc_id=${encodeURIComponent(docId)}`, {
    method: 'GET',
  })
}

/**
 * 新增文档
 */
export async function createDoc(body: CreateDocBody): Promise<ApiResponse<DocItem>> {
  return fetcher(`/docs/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * 更新文档（仅传需要修改的字段）
 * @param docId 文档 UUID
 */
export async function updateDoc(
  docId: string,
  body: UpdateDocBody
): Promise<ApiResponse<DocItem>> {
  return fetcher(`/docs/docs?doc_id=${encodeURIComponent(docId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * 删除文档（同时删除其关联图片）
 * @param docId 文档 UUID
 */
export async function deleteDoc(docId: string): Promise<ApiResponse<null>> {
  return fetcher(`/docs/docs?doc_id=${encodeURIComponent(docId)}`, {
    method: 'DELETE',
  })
}

// ==================== 图片接口 ====================

/**
 * 获取图片列表（不含二进制）
 * @param docId 传入后仅返回该文档的图片，不传返回全部
 */
export async function getImageList(docId?: string): Promise<ApiResponse<DocImage[]>> {
  const query = docId ? `?doc_id=${encodeURIComponent(docId)}` : ''
  return fetcher(`/docs/images${query}`, { method: 'GET' })
}

/**
 * 获取单张图片元数据（不含 image_data）
 * @param imageId 图片 UUID
 */
export async function getImageInfo(imageId: string): Promise<ApiResponse<DocImage>> {
  return fetcher(`/docs/docs_image?image_id=${encodeURIComponent(imageId)}`, {
    method: 'GET',
  })
}

/**
 * 新增图片，image_data 必须是纯 Base64（不带 data:image/png;base64, 前缀）
 */
export async function createImage(
  body: CreateImageBody
): Promise<ApiResponse<{ id: string }>> {
  return fetcher(`/docs/docs_image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * 更新图片
 * @param imageId 图片 UUID
 */
export async function updateImage(
  imageId: string,
  body: UpdateImageBody
): Promise<ApiResponse<DocImage>> {
  return fetcher(`/docs/docs_image?image_id=${encodeURIComponent(imageId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * 删除图片
 * @param imageId 图片 UUID
 */
export async function deleteImage(imageId: string): Promise<ApiResponse<null>> {
  return fetcher(`/docs/docs_image?image_id=${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
  })
}

/**
 * 构建原图下载地址（image_id 形式）
 * @param imageId 图片 UUID
 */
export function buildImageDownloadUrl(imageId: string): string {
  return `/docs/docs_image/download?image_id=${encodeURIComponent(imageId)}`
}

/**
 * 构建缩略图地址
 * @param imageId 图片 UUID
 * @param maxSize 最长边像素，范围 64~2048，默认 320
 */
export function buildImageThumbnailUrl(imageId: string, maxSize = 320): string {
  return `/docs/docs_image/thumbnail?image_id=${encodeURIComponent(
    imageId
  )}&max_size=${maxSize}`
}

/**
 * 携带认证信息拉取图片二进制，返回可用于 <img src> 的 ObjectURL。
 * 图片接口需要 Bearer Token，浏览器直接用 <img src> 无法携带请求头，
 * 因此统一走 fetch 获取 Blob 再转 ObjectURL。调用方在不再使用时需
 * URL.revokeObjectURL 释放。
 *
 * @param src Markdown 中的图片地址，通常形如 /docs/docs_image/download?image_id=...
 */
export async function fetchDocImageObjectUrl(src: string): Promise<string> {
  // 外部绝对地址直接使用，无需鉴权代理
  if (/^https?:\/\//i.test(src) || src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }

  const res: Response = await fetcher(src, { method: 'GET' })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
