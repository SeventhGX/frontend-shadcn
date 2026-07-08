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
 * TODO: 后端接口尚未完成，接口路径与请求体待确认后补充。
 * @param fileIds 需要编码的文件 file_id 列表
 */
export async function embedKnowledgeFiles(fileIds: string[]): Promise<ApiResponse<unknown>> {
  return fetcher(
    `/knowledge/v1/embed`,
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
 * 删除选中的知识库文件
 * TODO: 后端接口尚未完成，接口路径与请求体待确认后补充。
 * @param fileIds 需要删除的文件 file_id 列表
 */
export async function deleteKnowledgeFiles(fileIds: string[]): Promise<ApiResponse<unknown>> {
  return fetcher(
    `/knowledge/v1/delete`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_ids: fileIds }),
    }
  )
}
