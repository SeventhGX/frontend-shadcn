import { fetcher } from '@/lib/fetcher'

/** 知识文档标签（按用户隔离） */
export interface KnowledgeTag {
  id: string
  name: string
}

/** 单个标签名称长度上限 */
export const TAG_NAME_MAX_LENGTH = 50

/** 单次手动设置时已有标签 / 新建标签各自的数量上限 */
export const TAG_SELECT_MAX_COUNT = 20

/** 知识库文件条目 */
export interface KnowledgeFile {
  file_id: string
  knowledge_id: string
  filename: string
  file_type: string
  is_embedded: boolean
  create_time?: string
  /** 文件来源用户的 user_name；公共文件为原发布者 */
  source?: string
  /** 是否属于公共知识库 */
  is_public?: boolean
  tags?: KnowledgeTag[]
}

interface ApiResponse<T> {
  message: string
  code: number
  data: T
}

/** 知识库检索方式：向量检索 / 混合检索 */
export type RetrievalMethod = "vector" | "hybrid"

/** 检索/问答返回的知识片段 */
export interface KnowledgeChunk {
  chunk_id: string
  file_id: string
  chunk_index: number
  content: string
  meta_data?: {
    filename?: string
    file_type?: string
    [key: string]: unknown
  } | null
  score: number
  semantic_score: number
  keyword_score: number | null
  /** 未开启 rerank 时为 null */
  rerank_score?: number | null
  retrieval_method: RetrievalMethod
}

/** 单个文件的编码结果 */
export interface EmbeddingResult {
  file_id: string
  chunk_count: number
}

/** RAG 问答返回结果 */
export interface ChatResult {
  answer: string
  chunks: KnowledgeChunk[]
}

/** 知识库检索请求参数 */
export interface RagRetrieveRequest {
  query: string
  file_ids?: string[] | null
  top_k?: number
  retrieval_method?: RetrievalMethod
  semantic_weight?: number
  keyword_weight?: number
  enable_rerank?: boolean
  rerank_top_k?: number
  rerank_top_n?: number
}

/** 知识库 RAG 问答请求参数 */
export interface RagChatRequest extends RagRetrieveRequest {
  temperature?: number
}

/** 流式问答的进度阶段 */
export type RagStreamStage = 'retrieving' | 'reranking' | 'answering'

/** 后端各参数的默认值，前端表单与之保持一致 */
export const RAG_DEFAULTS = {
  top_k: 10,
  semantic_weight: 0.7,
  keyword_weight: 0.3,
  enable_rerank: true, // 用户需求默认开启重排序
  rerank_top_k: 30,
  rerank_top_n: 5,
  temperature: 0.2,
} as const

/**
 * 获取当前用户的全部知识库文件列表
 */
export async function getAllKnowledgeFiles(): Promise<ApiResponse<KnowledgeFile[]>> {
  return fetcher(
    `/knowledge/v1/get_all`,
    { method: 'POST' }
  )
}

/**
 * 上传本地文件到知识库
 * @param file 需要上传的文件
 * @param tagNames 可选，本次上传统一应用的标签名（已存在的同名标签会被复用）
 */
export async function uploadKnowledgeFile(
  file: File,
  tagNames?: string[]
): Promise<ApiResponse<KnowledgeFile[]>> {
  const formData = new FormData()
  formData.append('file', file)
  tagNames?.forEach((name) => formData.append('tag_names', name))

  // 注意：使用 FormData 时不要手动设置 Content-Type，
  // 浏览器会自动带上带 boundary 的 multipart/form-data。
  return fetcher(
    `/knowledge/v1/upload_file`,
    {
      method: 'POST',
      body: formData,
    }
  )
}

/**
 * 获取当前用户的标签库
 */
export async function getKnowledgeTags(): Promise<ApiResponse<KnowledgeTag[]>> {
  return fetcher(
    `/knowledge/v1/tags`,
    { method: 'GET' }
  )
}

/** 手动设置文档标签的请求参数 */
export interface SetKnowledgeTagsRequest {
  file_id: string
  /** 从标签库中选择的标签 ID */
  tag_ids?: string[]
  /** 同时创建的自定义标签名 */
  new_tags?: string[]
}

/**
 * 手动设置文档标签（覆盖文档当前标签，全部为空表示清空）
 */
export async function setKnowledgeTags(
  request: SetKnowledgeTagsRequest
): Promise<ApiResponse<KnowledgeTag[]>> {
  const { file_id: fileId, tag_ids: tagIds = [], new_tags: newTags = [] } = request

  return fetcher(
    `/knowledge/v1/set_tags`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        tag_ids: tagIds,
        new_tags: newTags,
      }),
    }
  )
}

/** AI 自动打标的请求参数 */
export interface AutoTagRequest {
  file_id: string
  /** 建议标签数量上限 */
  max_tags?: number
  /** 是否允许把 AI 建议的新名称加入标签库 */
  allow_new_tags?: boolean
}

/** AI 打标需要读取全文，超过该时长视为请求超时（后端通常仍在后台继续生成） */
export const AUTO_TAG_TIMEOUT_MS = 180_000

/**
 * AI 自动打标：在文档原有标签基础上追加 AI 建议的标签
 */
export async function autoTagKnowledgeFile(
  request: AutoTagRequest
): Promise<ApiResponse<KnowledgeTag[]>> {
  const { file_id: fileId, max_tags: maxTags = 5, allow_new_tags: allowNewTags = true } = request

  return fetcher(
    `/knowledge/v1/auto_tag`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_id: fileId,
        max_tags: maxTags,
        allow_new_tags: allowNewTags,
      }),
      signal: AbortSignal.timeout(AUTO_TAG_TIMEOUT_MS),
    }
  )
}

/**
 * 对选中的文件进行向量编码（Embedding）
 * 已编码过的文件会被后端跳过，返回本次实际完成编码的文件列表。
 * @param fileIds 需要编码的文件 file_id 列表
 */
export async function embedKnowledgeFiles(fileIds: string[]): Promise<ApiResponse<EmbeddingResult[]>> {
  return fetcher(
    `/knowledge/v1/embedding_files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // 请求体直接是文件 ID 数组
      body: JSON.stringify(fileIds),
    }
  )
}

/** 组装检索/问答请求体：仅混合检索时提交权重，仅开启 rerank 时提交 rerank 参数 */
function buildRagBody(request: RagChatRequest): Record<string, unknown> {
  const {
    query,
    file_ids: fileIds,
    top_k: topK = RAG_DEFAULTS.top_k,
    retrieval_method: retrievalMethod = 'vector',
    semantic_weight: semanticWeight = RAG_DEFAULTS.semantic_weight,
    keyword_weight: keywordWeight = RAG_DEFAULTS.keyword_weight,
    enable_rerank: enableRerank = RAG_DEFAULTS.enable_rerank,
    rerank_top_k: rerankTopK = RAG_DEFAULTS.rerank_top_k,
    rerank_top_n: rerankTopN = RAG_DEFAULTS.rerank_top_n,
    temperature,
  } = request

  const body: Record<string, unknown> = {
    query,
    file_ids: fileIds && fileIds.length > 0 ? fileIds : null,
    top_k: topK,
    retrieval_method: retrievalMethod,
    enable_rerank: enableRerank,
  }

  if (retrievalMethod === 'hybrid') {
    body.semantic_weight = semanticWeight
    body.keyword_weight = keywordWeight
  }
  if (enableRerank) {
    body.rerank_top_k = rerankTopK
    body.rerank_top_n = rerankTopN
  }
  if (typeof temperature === 'number') {
    body.temperature = temperature
  }

  return body
}

/**
 * 检索知识库中最相似的片段（不调用大模型，仅返回召回片段）
 * @param request 检索请求；file_ids 不传（null）则检索全部已编码知识库
 */
export async function retrieveKnowledge(
  request: RagRetrieveRequest
): Promise<ApiResponse<KnowledgeChunk[]>> {
  return fetcher(
    `/knowledge/v1/retrieve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildRagBody(request)),
    }
  )
}

/**
 * RAG 问答：先检索片段再交给大模型生成回答
 * @param request 问答请求；file_ids 不传（null）则检索全部已编码知识库
 */
export async function chatKnowledge(
  request: RagChatRequest
): Promise<ApiResponse<ChatResult>> {
  return fetcher(
    `/knowledge/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        temperature: RAG_DEFAULTS.temperature,
        ...buildRagBody(request),
      }),
    }
  )
}

/** 流式问答事件回调 */
export interface RagChatStreamHandlers {
  /** 进度阶段变化 */
  onProgress?: (stage: RagStreamStage, message: string) => void
  /** 未开启 rerank 时的最终片段 */
  onChunks?: (chunks: KnowledgeChunk[]) => void
  /** 开启 rerank 时的初筛片段 */
  onInitialChunks?: (chunks: KnowledgeChunk[]) => void
  /** 开启 rerank 时重排后保留的片段 */
  onRerankedChunks?: (chunks: KnowledgeChunk[]) => void
  /** 回答文本增量，需要自行拼接 */
  onAnswer?: (delta: string) => void
  /** 流程结束 */
  onDone?: () => void
}

/** 解析并分发单个 SSE 事件块 */
function dispatchRagSseBlock(block: string, handlers: RagChatStreamHandlers) {
  let eventName = 'message'
  const dataLines: string[] = []

  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue
    if (line.startsWith('event:')) eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }
  if (dataLines.length === 0) return

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(dataLines.join('\n'))
  } catch {
    return
  }

  if (eventName === 'progress') {
    handlers.onProgress?.(
      payload.stage as RagStreamStage,
      String(payload.message ?? '')
    )
  } else if (eventName === 'chunks') {
    if (Array.isArray(payload.initial_chunks)) {
      handlers.onInitialChunks?.(payload.initial_chunks as KnowledgeChunk[])
    } else if (Array.isArray(payload.reranked_chunks)) {
      handlers.onRerankedChunks?.(payload.reranked_chunks as KnowledgeChunk[])
    } else if (Array.isArray(payload.chunks)) {
      handlers.onChunks?.(payload.chunks as KnowledgeChunk[])
    }
  } else if (eventName === 'answer') {
    handlers.onAnswer?.(String(payload.answer ?? ''))
  } else if (eventName === 'done') {
    handlers.onDone?.()
  }
}

/**
 * 流式 RAG 问答：依次收到进度、检索片段与回答增量
 * @param request 问答请求；file_ids 不传（null）则检索全部已编码知识库
 */
export async function chatKnowledgeStream(
  request: RagChatRequest,
  handlers: RagChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const res: Response = await fetcher(
    `/knowledge/v1/chat_stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        temperature: RAG_DEFAULTS.temperature,
        ...buildRagBody(request),
      }),
      signal,
    }
  )

  const reader = res.body?.getReader()
  if (!reader) throw new Error('无法读取问答响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) dispatchRagSseBlock(block, handlers)
  }

  if (buffer.trim()) dispatchRagSseBlock(buffer, handlers)
}

/** 删除文件返回结果 */
export interface DeleteResult {
  deleted_file_ids: string[]
  deleted_count: number
}

/**
 * 删除选中的知识库文件
 * 若文件已编码，后端会同步删除对应的切片和向量内容。
 * @param fileIds 需要删除的文件 file_id 列表
 */
export async function deleteKnowledgeFiles(fileIds: string[]): Promise<ApiResponse<DeleteResult>> {
  return fetcher(
    `/knowledge/v1/delete_files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    }
  )
}

/** 公开 / 取消公开的返回结果 */
export interface KnowledgeVisibilityResult {
  file_ids: string[]
  count: number
}

/**
 * 将当前用户已完成编码的文件公开到公共知识库
 * 批量操作具有原子性：任一文件不满足条件时整批都不会公开。
 * @param fileIds 需要公开的文件 file_id 列表
 */
export async function publishKnowledgeFiles(
  fileIds: string[]
): Promise<ApiResponse<KnowledgeVisibilityResult>> {
  return fetcher(
    `/knowledge/v1/publish_files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    }
  )
}

/**
 * 取消公开：仅原发布者可以把公共文件转回个人知识文件
 * 不会删除文件或切片，也不需要重新编码。
 * @param fileIds 需要取消公开的文件 file_id 列表
 */
export async function unpublishKnowledgeFiles(
  fileIds: string[]
): Promise<ApiResponse<KnowledgeVisibilityResult>> {
  return fetcher(
    `/knowledge/v1/unpublish_files`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    }
  )
}
