import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  // 转发 Authorization 和 Content-Type 头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const auth = request.headers.get('authorization')
  if (auth) {
    headers['Authorization'] = auth
  }

  const body = await request.text()

  // 原样转发 Query 参数（如 crawler_type），客户端断开时同时取消后端请求
  const backendRes = await fetch(
    `${backendBase}/articles/v1/search_stream${request.nextUrl.search}`,
    {
      method: 'POST',
      headers,
      body,
      signal: request.signal,
    },
  )

  if (!backendRes.ok) {
    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 将后端的流直接透传给客户端，不做缓冲
  return new Response(backendRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
