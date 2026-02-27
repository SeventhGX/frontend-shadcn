export async function fetcher(
  path: string,
  options?: RequestInit
) {
  const res = await fetch(
    path,
    {
      credentials: 'include',
      ...options,
    }
  )

  if (!res.ok) {
    throw new Error('API Error')
  }

  // 检查 Content-Type 判断是否为流式响应
  const contentType = res.headers.get('content-type')
  
  // 如果是流式响应（text/event-stream 或包含 stream），返回 Response 对象
  if (contentType?.includes('stream') || contentType?.includes('text/event-stream')) {
    return res
  }

  // 默认返回 JSON
  return res.json()
}
