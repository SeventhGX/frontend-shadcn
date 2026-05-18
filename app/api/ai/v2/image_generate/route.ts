import { NextRequest } from 'next/server'

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

  const backendRes = await fetch(
    `${backendBase}/ai/v2/image_generate`,
    { method: 'POST', headers, body },
  )

  const data = await backendRes.json()
  return new Response(JSON.stringify(data), {
    status: backendRes.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
