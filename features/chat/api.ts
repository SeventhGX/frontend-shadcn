import { fetcher } from '@/lib/fetcher'

export type ModelKwargType = 'string' | 'number' | 'integer' | 'boolean'

export interface ModelKwarg {
  name: string
  type: ModelKwargType
  default: string | number | boolean
  description?: string
  min?: number
  max?: number
  option?: string[]
}

export interface ModelItem {
  modelType: string
  model: string
  kwargs?: ModelKwarg[]
}

/*
 * 获取可用的模型列表
 */
export async function getModels(): Promise<{ data: ModelItem[] }> {
  return fetcher(
    `/ai/v2/models`,
    { method: 'GET' }
  )
}


export interface ChatRequestMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequest {
  id?: string | null
  session_name?: string | null
  model_type?: string | null
  model: string
  content: { messages: ChatRequestMessage[] }
  kwargs?: Record<string, string | number | boolean>
}

/**
 * 与 AI 模型进行流式对话
 */
export async function chatByStream(body: ChatRequest): Promise<Response> {
  return fetcher(
    `/ai/v2/chat_stream`, // TODO: 修改为实际的后端 API 路径
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}

/**
 * 图像生成
 */
export interface ImageGenerateRequest {
  model_type: string
  model: string
  content: { prompt: string }
  kwargs?: Record<string, string | number | boolean>
}

export interface ImageItem {
  type: "b64_json" | "url"
  data: string
}

export interface ImageGenerateResponse {
  message: string
  code: number
  data: ImageItem[]
}

export async function generateImage(body: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  return fetcher(
    `/ai/v2/image_generate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

/**
 * 图像编辑（在已有图像基础上修改）
 *
 * content.image 可传 URL 或 data URL 数组
 */
export interface ImageEditRequest {
  model_type: string
  model: string
  content: { image: string[]; prompt: string }
  kwargs?: Record<string, string | number | boolean>
}

export async function editImage(body: ImageEditRequest): Promise<ImageGenerateResponse> {
  return fetcher(
    `/ai/v2/image_edit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

// ---------- 历史会话相关 ----------

// 分享来源信息（会话为“保存分享”创建的副本时才非空）
export interface SessionShareOrigin {
  share_code: string
  shared_by: string | null
  origin_session_id: string | null
}

export interface ChatSession {
  id: string        // 会话唯一 ID
  session_name: string     // 会话标题（如第一条消息摘要）
  create_time: string // 创建时间（ISO 字符串）
  shared_from: SessionShareOrigin | null // 非空表示该会话是通过“保存分享”创建的副本
  is_shared_by_me: boolean // 当前用户是否曾为该会话创建过分享（未取消即为 true）
}

export interface ChatSessionDetail {
  id: string
  model: string
  content: ChatRequestMessage[]
  shared_from: SessionShareOrigin | null
  is_shared_by_me: boolean
}

/**
 * 获取历史会话列表
 *
 * TODO: 修改 endpoint 路径及请求方式，按需调整返回类型 ChatSession
 */
export async function getChatSessions() {
  return fetcher(
    `/ai/v1/sessions`, // TODO: 修改为实际的后端 API 路径
    { method: 'GET' }
  )
}

/**
 * 根据会话 ID 获取会话详情（消息列表）
 *
 * TODO: 修改 endpoint 路径及请求方式，按需调整返回类型 ChatSessionDetail
 */
export async function getChatSessionById(sessionId: string) {
  return fetcher(
    `/ai/v1/session?session_id=${sessionId}`, // TODO: 修改为实际的后端 API 路径
    { method: 'GET' }
  )
}

/**
 * 删除会话
 */
export async function deleteSession(sessionId: string): Promise<{ message: string; code: number }> {
  return fetcher(
    `/ai/v1/delete_session?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' }
  )
}

/**
 * 新增会话
 */
export interface AddSessionRequest {
  id?: string | null
  session_name?: string | null
  model_type?: string | null
  model?: string | null
  content?: { messages: ChatRequestMessage[] } | null
  create_time?: string | null
}

export interface SessionData {
  id: string
  user_id?: string
  session_name: string
  create_time?: string
  content?: { messages: ChatRequestMessage[] } | null
}

export async function addSession(body: AddSessionRequest): Promise<{ data: SessionData }> {
  return fetcher(
    `/ai/v1/add_session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

/**
 * 更新会话
 */
export interface UpdateSessionRequest {
  id: string
  user_id?: string
  session_name: string
  create_time?: string | null
  content?: { messages: ChatRequestMessage[] } | null
}

export async function updateSession(body: UpdateSessionRequest): Promise<{ data: SessionData }> {
  return fetcher(
    `/ai/v1/update_session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

// ---------- 文件相关 ----------

export interface SaveFileRequest {
  source_url?: string | null
  filename: string
  file_type: string
  data: string // base64 编码
}

export interface SaveFileResponse {
  message: string
  code: number
  data: { id: string }
}

/**
 * 保存文件（base64 形式上传）
 */
export async function saveFile(body: SaveFileRequest): Promise<SaveFileResponse> {
  return fetcher(
    `/ai/v1/save_file`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

export interface FileData {
  id: string
  source_url: string | null
  filename: string
  file_type: string
  data: string // base64 编码
}

export interface GetFileResponse {
  message: string
  code: number
  data: FileData
}

/**
 * 根据文件 ID 获取文件内容
 */
export async function getFile(fileId: string): Promise<GetFileResponse> {
  return fetcher(
    `/ai/v1/file?file_id=${encodeURIComponent(fileId)}`,
    { method: 'GET' }
  )
}

/**
 * 根据文件 ID 获取压缩后的文件内容
 */
export async function getCompressedFile(fileId: string): Promise<GetFileResponse> {
  return fetcher(
    `/ai/v1/file_compression?file_id=${encodeURIComponent(fileId)}`,
    { method: 'GET' }
  )
}

/*
* 根据文件 ID 下载文件（返回原始二进制 Response，由调用方自行 .blob() / .body 处理）
*/
export async function downloadFile(fileId: string): Promise<Response> {
  return fetcher(
    `/ai/v1/file_download?file_id=${encodeURIComponent(fileId)}`,
    { method: 'GET' }
  )
}

/*
* 根据会话 ID 下载会话内容为 Word 文件（返回原始二进制 Response，由调用方自行 .blob() / .body 处理）
*/
export async function downloadSessionWord(sessionId: string): Promise<Response> {
  return fetcher(
    `/ai/v1/session_word_download?session_id=${encodeURIComponent(sessionId)}`,
    { method: 'GET' }
  )
}

// ---------- 会话分享相关 ----------

export interface CreateSessionShareRequest {
  session_id: string
  expire_days?: number | null
}

export interface SessionShare {
  id: string
  session_id: string
  session_name: string | null
  share_code: string
  create_time: string | null
  expire_time: string | null
  visit_count: number
  is_expired: boolean
}

export interface SharedSession {
  share_code: string
  session_id: string
  session_name: string | null
  content: { messages: ChatRequestMessage[] } | null
  create_time: string | null
  expire_time: string | null
  shared_by: string | null
  is_owner: boolean
}

export interface SaveSharedSessionRequest {
  share_code: string
  session_name?: string | null
}

/**
 * 为自己的会话创建分享链接
 * 已存在未过期分享且不传 expire_days 时会复用原分享码；传入 expire_days 会作废旧分享码并重新生成
 */
export async function shareSession(body: CreateSessionShareRequest): Promise<{ data: SessionShare }> {
  return fetcher(
    `/ai/v1/share_session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}

/**
 * 获取当前用户创建的分享列表
 */
export async function getShareSessions(): Promise<{ data: SessionShare[] }> {
  return fetcher(
    `/ai/v1/share_sessions`,
    { method: 'GET' }
  )
}

/**
 * 取消分享
 */
export async function cancelSessionShare(shareCode: string): Promise<{ message: string; code: number }> {
  return fetcher(
    `/ai/v1/share_session?share_code=${encodeURIComponent(shareCode)}`,
    { method: 'DELETE' }
  )
}

/**
 * 通过分享码只读加载会话内容
 */
export async function getSharedSession(shareCode: string): Promise<{ data: SharedSession }> {
  return fetcher(
    `/ai/v1/shared_session?share_code=${encodeURIComponent(shareCode)}`,
    { method: 'GET' }
  )
}

/**
 * 把分享的会话保存为自己的会话
 */
export async function saveSharedSession(body: SaveSharedSessionRequest): Promise<{ data: SessionData }> {
  return fetcher(
    `/ai/v1/save_shared_session`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}