import { NextRequest } from 'next/server'

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
  if (auth) {
    headers['Authorization'] = auth
  }

  const body = await request.text()

  const backendRes = await fetch(`${backendBase}/knowledge/v1/embedding_files`, {
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

  return new Response(backendRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}