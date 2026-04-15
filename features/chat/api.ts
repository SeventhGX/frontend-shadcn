import { fetcher } from '@/lib/fetcher'

export interface ChatRequestMessage {
  role: "user" | "assistant"
  content: string
}

export interface ChatRequest {
  model: string
  messages: ChatRequestMessage[]
}

/**
 * 与 AI 模型进行流式对话
 *
 * TODO: 请根据实际后端接口完善此函数：
 *   1. 修改 endpoint 路径
 *   2. 按需调整请求体结构（如添加 temperature、max_tokens 等参数）
 *   3. 解析响应数据的字段名（当前 chat page 中解析 data.content 字段）
 */
export async function chatByStream(body: ChatRequest): Promise<Response> {
  return fetcher(
    `/chat/v1/chat_stream`, // TODO: 修改为实际的后端 API 路径
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}
