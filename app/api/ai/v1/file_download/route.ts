import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 600

export async function GET(request: NextRequest) {
  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  const fileId = request.nextUrl.searchParams.get('file_id') ?? ''

  const headers: Record<string, string> = {}
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth

  const backendRes = await fetch(
    `${backendBase}/ai/v1/file_download?file_id=${encodeURIComponent(fileId)}`,
    { method: 'GET', headers }
  )

  if (!backendRes.ok) {
    return new Response(backendRes.body, {
      status: backendRes.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 透传文件流，保留下载相关头
  const respHeaders: Record<string, string> = {
    'Content-Type':
      backendRes.headers.get('content-type') || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  }
  const disposition = backendRes.headers.get('content-disposition')
  if (disposition) respHeaders['Content-Disposition'] = disposition
  const length = backendRes.headers.get('content-length')
  if (length) respHeaders['Content-Length'] = length

  return new Response(backendRes.body, {
    status: 200,
    headers: respHeaders,
  })
}
