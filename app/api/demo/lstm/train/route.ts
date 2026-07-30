import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
// 训练为长耗时请求（可达数十秒），以 SSE 流式返回进度，需放宽超时并禁用缓冲
export const maxDuration = 600

export async function POST(request: NextRequest) {
  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth

  const body = await request.text()

  const backendRes = await fetch(`${backendBase}/demo/lstm/train`, {
    method: 'POST',
    headers,
    body,
  })

  if (!backendRes.ok) {
    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 将后端 SSE 流直接透传给客户端，不做缓冲
  return new Response(backendRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
