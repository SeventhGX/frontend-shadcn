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
 * @param query 用户问题或检索关键词
 * @param fileIds 限定检索的文件范围；不传（null）则检索全部已编码知识库
 * @param topK 返回最相似的 chunk 数量，默认 5
 */
export async function retrieveKnowledge(
  query: string,
  fileIds?: string[] | null,
  topK = 5
): Promise<ApiResponse<KnowledgeChunk[]>> {
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
      }),
    }
  )
}

/**
 * RAG 问答：先检索片段再交给大模型生成回答
 * @param query 用户问题
 * @param fileIds 限定检索的文件范围；不传（null）则检索全部已编码知识库
 * @param topK 提供给大模型的召回 chunk 数量，默认 5
 * @param temperature 生成随机性，越低越稳定，默认 0.2
 */
export async function chatKnowledge(
  query: string,
  fileIds?: string[] | null,
  topK = 5,
  temperature = 0.2
): Promise<ApiResponse<ChatResult>> {
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
