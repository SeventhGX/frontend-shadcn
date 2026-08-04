import { fetcher } from '@/lib/fetcher'

/** 知识库文件条目 */
export interface KnowledgeFile {
  file_id: string
  knowledge_id: string
  filename: string
  file_type: string
  is_embedded: boolean
  create_time?: string
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
}

/** 知识库 RAG 问答请求参数 */
export interface RagChatRequest extends RagRetrieveRequest {
  temperature?: number
}

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
 */
export async function uploadKnowledgeFile(file: File): Promise<ApiResponse<KnowledgeFile[]>> {
  const formData = new FormData()
  formData.append('file', file)

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

/**
 * 检索知识库中最相似的片段（不调用大模型，仅返回召回片段）
 * @param request 检索请求；file_ids 不传（null）则检索全部已编码知识库
 */
export async function retrieveKnowledge(
  request: RagRetrieveRequest
): Promise<ApiResponse<KnowledgeChunk[]>> {
  const {
    query,
    file_ids: fileIds,
    top_k: topK = 5,
    retrieval_method: retrievalMethod,
    semantic_weight: semanticWeight,
    keyword_weight: keywordWeight,
  } = request

  return fetcher(
    `/knowledge/v1/retrieve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        file_ids: fileIds && fileIds.length > 0 ? fileIds : null,
        top_k: topK,
        retrieval_method: retrievalMethod,
        semantic_weight: semanticWeight,
        keyword_weight: keywordWeight,
      }),
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
  const {
    query,
    file_ids: fileIds,
    top_k: topK = 5,
    temperature = 0.2,
    retrieval_method: retrievalMethod,
    semantic_weight: semanticWeight,
    keyword_weight: keywordWeight,
  } = request

  return fetcher(
    `/knowledge/v1/chat`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        file_ids: fileIds && fileIds.length > 0 ? fileIds : null,
        top_k: topK,
        temperature,
        retrieval_method: retrievalMethod,
        semantic_weight: semanticWeight,
        keyword_weight: keywordWeight,
      }),
    }
  )
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
