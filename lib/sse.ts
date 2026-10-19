/** 流式接口每行返回的数据：推理内容与正文内容分别增量下发 */
export interface SseChunk {
  reasoning_content?: string
  content?: string
}

/**
 * 逐行读取 SSE 流，并把每行解析出的 JSON 对象交给 onData 处理。
 * 兼容带 "data: " 前缀和不带前缀的行，自动跳过空行与 [DONE] 终止标记。
 * 默认按豆包的增量格式解析，其他格式（如 DeepSeek 分阶段事件）可通过泛型指定。
 */
export async function readSseStream<T = SseChunk>(
  response: Response,
  onData: (data: T) => void
) {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('无法获取流读取器')
  }
  const decoder = new TextDecoder()

  const handleLine = (line: string) => {
    let jsonStr = line.trim()
    // 移除 SSE 格式的 "data: " 前缀
    if (jsonStr.startsWith('data: ')) {
      jsonStr = jsonStr.substring(6).trim()
    }
    // 跳过空行与 SSE 终止标记
    if (!jsonStr || jsonStr === '[DONE]') {
      return
    }
    try {
      onData(JSON.parse(jsonStr))
    } catch (parseError) {
      console.warn('JSON 解析错误:', line, parseError)
    }
  }

  let buffer = '' // 用于缓存不完整的行
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // 保留最后一个不完整的行
    buffer = lines.pop() || ''
    lines.forEach(handleLine)
  }

  // 处理最后剩余的缓冲区内容
  buffer += decoder.decode()
  handleLine(buffer)
}
