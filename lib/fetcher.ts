import { useRouter } from 'next/navigation'
import { getToken } from './auth'

/**
 * 统一的 API 请求函数
 * 自动添加 JWT Bearer Token 到请求头
 */
export async function fetcher(
  path: string,
  options?: RequestInit
) {
  // 获取 JWT token
  const token = getToken()
  
  // 合并请求头，添加 Authorization
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  }
  
  // 如果有 token，添加到 Authorization 头
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(
    path,
    {
      credentials: 'include',
      ...options,
      headers,
    }
  )

  if (!res.ok) {
    // 如果返回 401，表示未授权，可能需要重新登录
    if (res.status === 401) {
      // 可以在这里触发全局的登录跳转
      // 或者抛出特定的错误让调用方处理
      throw new Error('Unauthorized')
      // useRouter().push(`/login`)
    }
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
