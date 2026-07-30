import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
// 训练为同步长请求（可达数十秒），需放宽超时，避免走通用 rewrite 代理被缓冲/超时
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

  const respText = await backendRes.text()
  return new Response(respText, {
    status: backendRes.status,
    headers: {
      'Content-Type':
        backendRes.headers.get('content-type') || 'application/json',
    },
  })
}
