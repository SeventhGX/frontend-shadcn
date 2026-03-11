import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  // 转发 Authorization 头
  const headers: Record<string, string> = {}
  const auth = request.headers.get('authorization')
  if (auth) {
    headers['Authorization'] = auth
  }

  const backendRes = await fetch(
    `${backendBase}/articles/v1/url_stream?url=${encodeURIComponent(url)}`,
    {
      method: 'POST',
      headers,
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
      'X-Accel-Buffering': 'no', // 禁用 Nginx 等反向代理的缓冲
    },
  })
}
