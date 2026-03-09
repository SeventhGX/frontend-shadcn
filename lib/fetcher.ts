import { getToken } from './auth'

/**
 * 获取 API 基础 URL
 * 根据运行环境（浏览器端 vs 服务器端）返回不同的 API 地址
 */
export function getApiBaseUrl(): string {
  // 在浏览器端，使用 NEXT_PUBLIC_API_URL 或 NEXT_PUBLIC_API_BASE_URL（向后兼容）
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || '/api'
  }
  
  // 在服务器端，优先使用 INTERNAL_API_URL（用于容器间通信）
  // 如果没有配置，则使用 NEXT_PUBLIC_API_URL 或 NEXT_PUBLIC_API_BASE_URL
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
}

/**
 * 构建完整的 API URL
 * @param path - API 路径，可以是相对路径或完整 URL
 */
function buildApiUrl(path: string): string {
  // 如果 path 已经是完整的 URL，直接返回
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  // 否则，拼接基础 URL 和路径
  const baseUrl = getApiBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${baseUrl}${normalizedPath}`
}

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

  // 构建完整的 API URL
  const url = buildApiUrl(path)

  const res = await fetch(
    url,
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
