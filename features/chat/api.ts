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

// ---------- 历史会话相关 ----------

export interface ChatSession {
  id: string        // 会话唯一 ID
  session_name: string     // 会话标题（如第一条消息摘要）
  create_time: string // 创建时间（ISO 字符串）
}

export interface ChatSessionDetail {
  id: string
  model: string
  content: ChatRequestMessage[]
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
