import { ApiError, fetcher } from "@/lib/fetcher"

/** 后端统一响应包装 */
interface ApiResponse<T> {
  message: string
  code: number
  data: T
}

/** 后端统一分页结构 */
export interface Paginated<T> {
  items: T[]
  page: number
  page_size: number
  total: number
  pages: number
}

/* ------------------------------------------------------------------ */
/* 分库与元数据                                                        */
/* ------------------------------------------------------------------ */

/** 公开知识分库 */
export interface KnowledgeDatabase {
  id: string
  database_name: string
  database_desc?: string | null
  /** 该分库允许的元数据字段名列表 */
  meta_data_template?: string[] | null
}

/** 全局元数据选项 */
export interface MetadataOption {
  id: string
  field_name: string
  field_desc: string
  value: string
  desc: string
}

/** 获取全部公开知识分库（按名称排序） */
export async function getDatabases(): Promise<ApiResponse<KnowledgeDatabase[]>> {
  return fetcher(`/knowledge/v2/databases`, { method: "GET" })
}

/** 获取全部可用元数据选项（无需鉴权） */
export async function getAllMetadata(): Promise<ApiResponse<MetadataOption[]>> {
  return fetcher(`/metadata/v1/all`, { method: "GET" })
}

/* ------------------------------------------------------------------ */
/* 标签与文件                                                          */
/* ------------------------------------------------------------------ */

/** 公开标签 */
export interface KnowledgeTagV2 {
  id: string
  name: string
}

/** V2 知识文件 */
export interface KnowledgeFileV2 {
  knowledge_id: string
  filename: string
  file_type: string
  meta_data?: Record<string, string> | null
  databases?: KnowledgeDatabase[]
  tags?: KnowledgeTagV2[]
  create_time?: string
}

/** 获取全部公开标签 */
export async function getTagsV2(): Promise<ApiResponse<KnowledgeTagV2[]>> {
  return fetcher(`/knowledge/v2/tags`, { method: "GET" })
}

/** 按分库分页查询文件 */
export async function getFilesV2(params: {
  database_name: string
  page?: number
  page_size?: number
  /** 元数据精确筛选，会被序列化为 JSON 字符串 */
  metadata?: Record<string, string>
  /** 多个标签为「全部匹配」语义 */
  tag_names?: string[]
}): Promise<ApiResponse<Paginated<KnowledgeFileV2>>> {
  const search = new URLSearchParams()
  search.set("database_name", params.database_name)
  search.set("page", String(params.page ?? 1))
  search.set("page_size", String(params.page_size ?? 20))
  if (params.metadata && Object.keys(params.metadata).length > 0) {
    search.set("metadata", JSON.stringify(params.metadata))
  }
  params.tag_names?.forEach((name) => search.append("tag_names", name))

  return fetcher(`/knowledge/v2/files?${search.toString()}`, { method: "GET" })
}

/** 分页查询当前用户上传的文件 */
export async function getMyFilesV2(params?: {
  page?: number
  page_size?: number
  /** 文件名模糊查询 */
  filename?: string
}): Promise<ApiResponse<Paginated<KnowledgeFileV2>>> {
  const search = new URLSearchParams()
  search.set("page", String(params?.page ?? 1))
  search.set("page_size", String(params?.page_size ?? 20))
  if (params?.filename) search.set("filename", params.filename)

  return fetcher(`/knowledge/v2/files/mine?${search.toString()}`, {
    method: "GET",
  })
}

/* ------------------------------------------------------------------ */
/* 检索与问答                                                          */
/* ------------------------------------------------------------------ */

/** 检索方式：向量检索 / 混合检索 */
export type RetrievalMethodV2 = "vector" | "hybrid"

/** 检索/问答返回的知识片段；历史问答内联的片段不保留检索分数，相关字段为 null */
export interface KnowledgeChunkV2 {
  chunk_id: string
  knowledge_id: string
  filename: string
  chunk_index: number
  content: string
  meta_data?: Record<string, unknown> | null
  score: number | null
  semantic_score: number | null
  keyword_score: number | null
  retrieval_method: RetrievalMethodV2 | null
}

/** 检索请求参数 */
export interface RetrieveRequestV2 {
  query: string
  database_name: string
  /** 多个标签为「全部匹配」语义 */
  tag_names?: string[]
  top_k?: number
  retrieval_method?: RetrievalMethodV2
  semantic_weight?: number
  keyword_weight?: number
}

/** 问答请求参数 */
export interface ChatRequestV2 extends RetrieveRequestV2 {
  temperature?: number
}

/** 问答返回结果 */
export interface ChatResultV2 {
  question_log_id: string
  answer: string
  chunks: KnowledgeChunkV2[]
}

function buildRetrieveBody(request: ChatRequestV2) {
  const body: Record<string, unknown> = {
    query: request.query,
    database_name: request.database_name,
    top_k: request.top_k ?? 10,
    retrieval_method: request.retrieval_method ?? "vector",
  }
  if (request.tag_names && request.tag_names.length > 0) {
    body.tag_names = request.tag_names
  }
  if (request.retrieval_method === "hybrid") {
    body.semantic_weight = request.semantic_weight
    body.keyword_weight = request.keyword_weight
  }
  if (typeof request.temperature === "number") {
    body.temperature = request.temperature
  }
  return body
}

/** 仅检索片段，不调用大模型 */
export async function retrieveV2(
  request: RetrieveRequestV2
): Promise<ApiResponse<KnowledgeChunkV2[]>> {
  return fetcher(`/knowledge/v2/retrieve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRetrieveBody(request)),
  })
}

/** RAG 问答：检索片段后由大模型生成回答 */
export async function chatV2(
  request: ChatRequestV2
): Promise<ApiResponse<ChatResultV2>> {
  return fetcher(`/knowledge/v2/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRetrieveBody(request)),
  })
}

/** 流式问答事件回调 */
export interface ChatStreamHandlers {
  /** 检索完成，先于回答文本到达 */
  onChunks?: (chunks: KnowledgeChunkV2[]) => void
  /** 回答文本增量，需要自行拼接 */
  onAnswer?: (delta: string) => void
  /** 回答落库完成 */
  onDone?: (questionLogId: string) => void
}

/** 解析单个 SSE 事件块 */
function dispatchSseBlock(block: string, handlers: ChatStreamHandlers) {
  let eventName = "message"
  const dataLines: string[] = []

  for (const line of block.split("\n")) {
    if (line.startsWith(":")) continue
    if (line.startsWith("event:")) eventName = line.slice(6).trim()
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(dataLines.join("\n"))
  } catch {
    return
  }

  if (eventName === "chunks") {
    handlers.onChunks?.((payload.chunks as KnowledgeChunkV2[]) ?? [])
  } else if (eventName === "answer") {
    handlers.onAnswer?.(String(payload.answer ?? ""))
  } else if (eventName === "done") {
    handlers.onDone?.(String(payload.question_log_id ?? ""))
  }
}

/** 流式 RAG 问答：依次收到 chunks、answer 增量与 done */
export async function chatStreamV2(
  request: ChatRequestV2,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res: Response = await fetcher(`/knowledge/v2/chat_stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildRetrieveBody(request)),
    signal,
  })

  const reader = res.body?.getReader()
  if (!reader) throw new Error("无法读取问答响应流")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n")

    const blocks = buffer.split("\n\n")
    buffer = blocks.pop() ?? ""
    for (const block of blocks) dispatchSseBlock(block, handlers)
  }

  if (buffer.trim()) dispatchSseBlock(buffer, handlers)
}

/* ------------------------------------------------------------------ */
/* 问答日志、反馈与相似案例                                            */
/* ------------------------------------------------------------------ */

/** 问答反馈类型 */
export type QuestionFeedback = "helpful" | "not_helpful" | "collect"

/** 历史问答记录 */
export interface QuestionLog {
  id: string
  question: string
  answer: string
  user_feedback: QuestionFeedback | null
  related_chunkv2_ids: string[]
  /** 内联的完整片段内容；检索分数字段为 null */
  chunks: KnowledgeChunkV2[]
  create_time: string
}

/** 相似典型问答（带相似度得分） */
export interface SimilarQuestionLog extends QuestionLog {
  score: number
}

/** 检索反馈为 collect 的跨用户典型案例 */
export async function getSimilarQuestions(params: {
  query: string
  top_k?: number
}): Promise<ApiResponse<SimilarQuestionLog[]>> {
  return fetcher(`/knowledge/v2/questions/similar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: params.query, top_k: params.top_k ?? 10 }),
  })
}

/** 更新本人问答记录的反馈 */
export async function updateQuestionFeedback(
  questionLogId: string,
  feedback: QuestionFeedback
): Promise<ApiResponse<QuestionLog>> {
  return fetcher(`/knowledge/v2/questions/${questionLogId}/feedback`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback }),
  })
}

/** 当前用户的历史问答 */
export async function getQuestionHistory(params?: {
  page?: number
  page_size?: number
  /** 问题文本模糊查询 */
  question?: string
}): Promise<ApiResponse<Paginated<QuestionLog>>> {
  const search = new URLSearchParams()
  search.set("page", String(params?.page ?? 1))
  search.set("page_size", String(params?.page_size ?? 20))
  if (params?.question) search.set("question", params.question)

  return fetcher(`/knowledge/v2/questions/history?${search.toString()}`, {
    method: "GET",
  })
}

/** 全部用户反馈为 collect 的典型案例 */
export async function getTypicalCases(params?: {
  page?: number
  page_size?: number
  question?: string
}): Promise<ApiResponse<Paginated<QuestionLog>>> {
  const search = new URLSearchParams()
  search.set("page", String(params?.page ?? 1))
  search.set("page_size", String(params?.page_size ?? 20))
  if (params?.question) search.set("question", params.question)

  return fetcher(`/knowledge/v2/questions/typical-cases?${search.toString()}`, {
    method: "GET",
  })
}

/** 删除当前用户自己的历史问答 */
export async function deleteQuestionLog(
  questionLogId: string
): Promise<ApiResponse<{ id: string; deleted: boolean }>> {
  return fetcher(`/knowledge/v2/questions/${questionLogId}`, {
    method: "DELETE",
  })
}

/* ------------------------------------------------------------------ */
/* 知识库缺口                                                          */
/* ------------------------------------------------------------------ */

/** 缺口状态 */
export type RequirementStatus = "open" | "closed"

/** 知识库缺口请求 */
export interface KnowledgeRequirement {
  id: string
  owner_user_id: string
  owner_name?: string
  requirement?: string | null
  question?: string | null
  status: RequirementStatus
  is_resolved: boolean
  file_ids?: string[]
  create_time?: string
}

/** 同一问答重复创建缺口时后端返回的冲突信息 */
export interface RequirementConflict {
  message: string
  requirement_id: string
}

/** 从 409 响应中提取已存在的缺口信息 */
export function getRequirementConflict(
  error: unknown
): RequirementConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null
  const detail = (error.data as { detail?: RequirementConflict } | null)?.detail
  return detail?.requirement_id ? detail : null
}

/** 针对本人 not_helpful 的问答创建缺口；每条问答最多一个缺口 */
export async function createRequirement(params: {
  related_log_id: string
  requirement?: string
}): Promise<ApiResponse<KnowledgeRequirement>> {
  return fetcher(`/knowledge/v2/requirements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      related_log_id: params.related_log_id,
      ...(params.requirement ? { requirement: params.requirement } : {}),
    }),
  })
}

/** 分页查询知识库缺口 */
export async function getRequirements(params?: {
  page?: number
  page_size?: number
  status?: RequirementStatus
  keyword?: string
}): Promise<ApiResponse<Paginated<KnowledgeRequirement>>> {
  const search = new URLSearchParams()
  search.set("page", String(params?.page ?? 1))
  search.set("page_size", String(params?.page_size ?? 20))
  if (params?.status) search.set("status", params.status)
  if (params?.keyword) search.set("keyword", params.keyword)

  return fetcher(`/knowledge/v2/requirements?${search.toString()}`, {
    method: "GET",
  })
}

/** 更新缺口状态（仅所有者或管理员） */
export async function updateRequirementStatus(
  requirementId: string,
  status: RequirementStatus
): Promise<ApiResponse<KnowledgeRequirement>> {
  return fetcher(`/knowledge/v2/requirements/${requirementId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  })
}
